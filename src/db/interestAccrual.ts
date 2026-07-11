import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import type { Database } from './client';
import { accounts, transactions } from './schema';
import { generateUuid } from '../utils/uuid';
import { formatIsoDate } from '../utils/dateRanges';

/**
 * Generates daily interest income transactions for every account with `annualInterestRate` set.
 * Uses a lazy catch-up pattern: runs on each app launch and inserts one transaction per missed day
 * since the last run (or today if the account has never had interest accrued).
 *
 * Formula: dailyInterest = floor(balanceMinorUnits × rateCentipercent / 3_650_000)
 * Example: PHP 21,239.86 at 3.25% p.a. → floor(2,123,986 × 325 / 3,650,000) = 189 centavos = PHP 1.89/day
 */
export async function generateDailyInterest(db: Database, today: Date): Promise<void> {
  const todayIso = formatIsoDate(today);

  const rows = await db
    .select({
      id: accounts.id,
      annualInterestRate: accounts.annualInterestRate,
      lastInterestAccruedDate: accounts.lastInterestAccruedDate,
      startingBalance: accounts.startingBalance,
    })
    .from(accounts)
    .where(and(isNotNull(accounts.annualInterestRate), isNull(accounts.deletedAt)));

  for (const account of rows) {
    let startIso: string;
    if (account.lastInterestAccruedDate) {
      const d = new Date(account.lastInterestAccruedDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      startIso = formatIsoDate(d);
    } else {
      startIso = todayIso;
    }

    if (startIso > todayIso) continue;

    // Query the account's current balance (startingBalance + net of all non-deleted transactions)
    const [balRow] = await db
      .select({
        balance: sql<number>`COALESCE(${accounts.startingBalance} + SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE -${transactions.amount} END), ${accounts.startingBalance})`,
      })
      .from(accounts)
      .leftJoin(transactions, and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)))
      .where(eq(accounts.id, account.id))
      .groupBy(accounts.id);

    const balance = balRow?.balance ?? account.startingBalance;
    const dailyInterest = Math.floor((balance * account.annualInterestRate!) / 3_650_000);

    if (dailyInterest > 0) {
      const cursor = new Date(startIso + 'T00:00:00');
      while (formatIsoDate(cursor) <= todayIso) {
        await db.insert(transactions).values({
          type: 'income',
          amount: dailyInterest,
          occurredAt: formatIsoDate(cursor),
          note: 'Daily interest',
          accountId: account.id,
          uuid: generateUuid(),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    await db
      .update(accounts)
      .set({ lastInterestAccruedDate: todayIso, updatedAt: sql`(datetime('now'))` })
      .where(eq(accounts.id, account.id));
  }
}
