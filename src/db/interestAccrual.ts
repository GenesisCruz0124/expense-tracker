import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import type { Database } from './client';
import { accounts, categories, transactions } from './schema';
import { generateUuid } from '../utils/uuid';
import { formatIsoDate } from '../utils/dateRanges';

function fmtPhp(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

function lastDayOfMonth(year: number, month: number): string {
  return formatIsoDate(new Date(year, month + 1, 0));
}

/**
 * Generates interest income transactions for every account with `annualInterestRate` set.
 * Uses a lazy catch-up pattern: runs on each app launch and inserts any missed periods
 * since the last run. Applies 20% Philippine withholding tax on gross interest.
 *
 * Frequency formula (gross before 20% WHT):
 *   daily   = floor(balance × rate / 3_650_000)
 *   monthly = floor(balance × rate / 120_000)
 *   yearly  = floor(balance × rate / 10_000)
 */
export async function generateDailyInterest(db: Database, today: Date): Promise<void> {
  const todayIso = formatIsoDate(today);

  // Look up the "Interest" income category seeded at launch
  const [interestCat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.name, 'Interest'), isNull(categories.deletedAt)))
    .limit(1);
  const interestCategoryId = interestCat?.id ?? null;

  const rows = await db
    .select({
      id: accounts.id,
      annualInterestRate: accounts.annualInterestRate,
      lastInterestAccruedDate: accounts.lastInterestAccruedDate,
      interestFrequency: accounts.interestFrequency,
      startingBalance: accounts.startingBalance,
    })
    .from(accounts)
    .where(and(isNotNull(accounts.annualInterestRate), isNull(accounts.deletedAt)));

  for (const account of rows) {
    const rate = account.annualInterestRate!;
    const frequency = (account.interestFrequency ?? 'daily') as 'daily' | 'monthly' | 'yearly';

    // Query current running balance
    const [balRow] = await db
      .select({
        balance: sql<number>`COALESCE(${accounts.startingBalance} + SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END), ${accounts.startingBalance})`,
      })
      .from(accounts)
      .leftJoin(transactions, and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)))
      .where(eq(accounts.id, account.id))
      .groupBy(accounts.id);
    const balance = balRow?.balance ?? account.startingBalance;

    if (frequency === 'daily') {
      await accrueDailyInterest(db, account.id, balance, rate, account.lastInterestAccruedDate, todayIso, interestCategoryId);
    } else if (frequency === 'monthly') {
      await accrueMonthlyInterest(db, account.id, balance, rate, account.lastInterestAccruedDate, todayIso, interestCategoryId);
    } else {
      await accrueYearlyInterest(db, account.id, balance, rate, account.lastInterestAccruedDate, todayIso, interestCategoryId);
    }
  }
}

async function insertInterestTransaction(
  db: Database,
  accountId: number,
  amount: number,
  occurredAt: string,
  note: string,
  categoryId: number | null,
): Promise<void> {
  await db.insert(transactions).values({
    type: 'income',
    amount,
    occurredAt,
    note,
    categoryId,
    accountId,
    uuid: generateUuid(),
  });
}

async function setLastAccrued(db: Database, accountId: number, date: string): Promise<void> {
  await db.update(accounts)
    .set({ lastInterestAccruedDate: date, updatedAt: sql`(datetime('now'))` })
    .where(eq(accounts.id, accountId));
}

async function accrueDailyInterest(
  db: Database,
  accountId: number,
  balance: number,
  rate: number,
  lastAccruedDate: string | null,
  todayIso: string,
  categoryId: number | null,
): Promise<void> {
  let startIso: string;
  if (lastAccruedDate) {
    const d = new Date(lastAccruedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    startIso = formatIsoDate(d);
  } else {
    // First run: back-fill from start of current month so no days this month
    // are silently skipped when the feature is first activated mid-month.
    const d = new Date(todayIso + 'T00:00:00');
    d.setDate(1);
    startIso = formatIsoDate(d);
  }
  if (startIso > todayIso) return;

  const grossPerDay = Math.floor(balance * rate / 3_650_000);
  const netPerDay = Math.floor(grossPerDay * 80 / 100);
  if (netPerDay <= 0) {
    await setLastAccrued(db, accountId, todayIso);
    return;
  }

  const balPhp = fmtPhp(balance);
  const rateStr = (rate / 100).toFixed(2);
  const grossPhp = fmtPhp(grossPerDay);
  const netPhp = fmtPhp(netPerDay);
  const note = `Daily interest: ₱${balPhp} × ${rateStr}% ÷ 365 = ₱${grossPhp} gross, −20% tax = ₱${netPhp}`;

  const cursor = new Date(startIso + 'T00:00:00');
  while (formatIsoDate(cursor) <= todayIso) {
    await insertInterestTransaction(db, accountId, netPerDay, formatIsoDate(cursor), note, categoryId);
    cursor.setDate(cursor.getDate() + 1);
  }
  await setLastAccrued(db, accountId, todayIso);
}

async function accrueMonthlyInterest(
  db: Database,
  accountId: number,
  balance: number,
  rate: number,
  lastAccruedDate: string | null,
  todayIso: string,
  categoryId: number | null,
): Promise<void> {
  const todayDate = new Date(todayIso + 'T00:00:00');
  let checkYear: number, checkMonth: number;

  if (lastAccruedDate) {
    const last = new Date(lastAccruedDate + 'T00:00:00');
    checkMonth = last.getMonth() + 1;
    checkYear = last.getFullYear();
    if (checkMonth > 11) { checkMonth = 0; checkYear++; }
  } else {
    checkYear = todayDate.getFullYear();
    checkMonth = todayDate.getMonth();
  }

  const grossPerMonth = Math.floor(balance * rate / 120_000);
  const netPerMonth = Math.floor(grossPerMonth * 80 / 100);

  const balPhp = fmtPhp(balance);
  const rateStr = (rate / 100).toFixed(2);
  const grossPhp = fmtPhp(grossPerMonth);
  const netPhp = fmtPhp(netPerMonth);
  const note = `Monthly interest: ₱${balPhp} × ${rateStr}% ÷ 12 = ₱${grossPhp} gross, −20% tax = ₱${netPhp}`;

  let lastAccruedIso: string | null = null;
  while (
    checkYear < todayDate.getFullYear() ||
    (checkYear === todayDate.getFullYear() && checkMonth < todayDate.getMonth())
  ) {
    const dayStr = lastDayOfMonth(checkYear, checkMonth);
    if (netPerMonth > 0) {
      await insertInterestTransaction(db, accountId, netPerMonth, dayStr, note, categoryId);
    }
    lastAccruedIso = dayStr;
    checkMonth++;
    if (checkMonth > 11) { checkMonth = 0; checkYear++; }
  }

  if (lastAccruedIso) {
    await setLastAccrued(db, accountId, lastAccruedIso);
  } else if (!lastAccruedDate) {
    await setLastAccrued(db, accountId, todayIso);
  }
}

async function accrueYearlyInterest(
  db: Database,
  accountId: number,
  balance: number,
  rate: number,
  lastAccruedDate: string | null,
  todayIso: string,
  categoryId: number | null,
): Promise<void> {
  const todayYear = new Date(todayIso + 'T00:00:00').getFullYear();
  let checkYear: number;

  if (lastAccruedDate) {
    checkYear = new Date(lastAccruedDate + 'T00:00:00').getFullYear() + 1;
  } else {
    checkYear = todayYear;
  }

  const grossPerYear = Math.floor(balance * rate / 10_000);
  const netPerYear = Math.floor(grossPerYear * 80 / 100);

  const balPhp = fmtPhp(balance);
  const rateStr = (rate / 100).toFixed(2);
  const grossPhp = fmtPhp(grossPerYear);
  const netPhp = fmtPhp(netPerYear);
  const note = `Yearly interest: ₱${balPhp} × ${rateStr}% = ₱${grossPhp} gross, −20% tax = ₱${netPhp}`;

  let lastAccruedIso: string | null = null;
  while (checkYear < todayYear) {
    const dayStr = `${checkYear}-12-31`;
    if (netPerYear > 0) {
      await insertInterestTransaction(db, accountId, netPerYear, dayStr, note, categoryId);
    }
    lastAccruedIso = dayStr;
    checkYear++;
  }

  if (lastAccruedIso) {
    await setLastAccrued(db, accountId, lastAccruedIso);
  } else if (!lastAccruedDate) {
    await setLastAccrued(db, accountId, todayIso);
  }
}
