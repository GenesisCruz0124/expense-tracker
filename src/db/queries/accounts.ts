import { asc, eq, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { accountCategories, accounts, transactions, type Account, type NewAccount } from '../schema';
import { formatIsoDate } from '../../utils/dateRanges';

export interface AccountWithBalance extends Account {
  /**
   * Starting balance plus the net effect of every transaction assigned to this account, in minor units.
   * For standard accounts, income adds and expenses subtract. For credit card accounts the balance
   * represents the amount owed, so expenses (purchases) add and income (payments/refunds) subtract.
   */
  balance: number;
}

export interface ListAccountsOptions {
  includeArchived?: boolean;
}

const balanceExpr = sql<number>`${accounts.startingBalance} + coalesce(sum(case
  when ${accountCategories.kind} = 'credit_card' then
    (case when ${transactions.type} = 'expense' then ${transactions.amount}
      when ${transactions.type} = 'income' then -${transactions.amount}
      else 0 end) + ${transactions.fee}
  else
    (case when ${transactions.type} = 'income' then ${transactions.amount}
      when ${transactions.type} = 'expense' then -${transactions.amount}
      else 0 end) - ${transactions.fee}
  end), 0)`;

export async function listAccounts(db: Database, options: ListAccountsOptions = {}): Promise<AccountWithBalance[]> {
  const { includeArchived = false } = options;

  const query = db
    .select({
      id: accounts.id,
      name: accounts.name,
      categoryId: accounts.categoryId,
      color: accounts.color,
      icon: accounts.icon,
      accountNumber: accounts.accountNumber,
      qrImageUri: accounts.qrImageUri,
      startingBalance: accounts.startingBalance,
      isArchived: accounts.isArchived,
      includeInNetWorth: accounts.includeInNetWorth,
      monthlyAmountDue: accounts.monthlyAmountDue,
      remainingMonths: accounts.remainingMonths,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyContribution: accounts.monthlyContribution,
      balanceLastUpdatedAt: accounts.balanceLastUpdatedAt,
      createdAt: accounts.createdAt,
      balance: balanceExpr,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.name));

  if (includeArchived) return query;
  return query.where(eq(accounts.isArchived, false));
}

export async function getAccountWithBalance(db: Database, id: number): Promise<AccountWithBalance | undefined> {
  const [row] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      categoryId: accounts.categoryId,
      color: accounts.color,
      icon: accounts.icon,
      accountNumber: accounts.accountNumber,
      qrImageUri: accounts.qrImageUri,
      startingBalance: accounts.startingBalance,
      isArchived: accounts.isArchived,
      includeInNetWorth: accounts.includeInNetWorth,
      monthlyAmountDue: accounts.monthlyAmountDue,
      remainingMonths: accounts.remainingMonths,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyContribution: accounts.monthlyContribution,
      balanceLastUpdatedAt: accounts.balanceLastUpdatedAt,
      createdAt: accounts.createdAt,
      balance: balanceExpr,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .where(eq(accounts.id, id))
    .groupBy(accounts.id)
    .limit(1);
  return row;
}

export interface AccountInput {
  name: string;
  categoryId: number;
  color: string;
  icon?: string | null;
  accountNumber?: string | null;
  qrImageUri?: string | null;
  /** Integer amount in minor units (centavos) */
  startingBalance: number;
  includeInNetWorth?: boolean;
  /** Minimum/recurring amount due each month, in minor units (centavos) — for credit-card-kind accounts. */
  monthlyAmountDue?: number | null;
  /** Number of monthly payments left — for credit-card-kind accounts. */
  remainingMonths?: number | null;
  /** Amount added to the balance on each manual update, in minor units (centavos) — for investment-kind accounts. */
  monthlyContribution?: number | null;
  /** ISO date ('YYYY-MM-DD') the balance was last updated via the increment button — for investment-kind accounts. */
  balanceLastUpdatedAt?: string | null;
}

export async function createAccount(db: Database, input: AccountInput): Promise<Account> {
  const values: NewAccount = {
    name: input.name.trim(),
    categoryId: input.categoryId,
    color: input.color,
    icon: input.icon ?? null,
    accountNumber: input.accountNumber?.trim() || null,
    qrImageUri: input.qrImageUri ?? null,
    startingBalance: input.startingBalance,
    includeInNetWorth: input.includeInNetWorth ?? true,
    monthlyAmountDue: input.monthlyAmountDue ?? null,
    remainingMonths: input.remainingMonths ?? null,
    monthlyContribution: input.monthlyContribution ?? null,
    balanceLastUpdatedAt: input.balanceLastUpdatedAt ?? null,
  };
  const [row] = await db.insert(accounts).values(values).returning();
  return row;
}

export async function updateAccount(db: Database, id: number, input: AccountInput): Promise<void> {
  await db
    .update(accounts)
    .set({
      name: input.name.trim(),
      categoryId: input.categoryId,
      color: input.color,
      icon: input.icon ?? null,
      accountNumber: input.accountNumber?.trim() || null,
      qrImageUri: input.qrImageUri ?? null,
      startingBalance: input.startingBalance,
      includeInNetWorth: input.includeInNetWorth ?? true,
      monthlyAmountDue: input.monthlyAmountDue ?? null,
      remainingMonths: input.remainingMonths ?? null,
      monthlyContribution: input.monthlyContribution ?? null,
      balanceLastUpdatedAt: input.balanceLastUpdatedAt ?? null,
    })
    .where(eq(accounts.id, id));
}

export async function setAccountArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(accounts).set({ isArchived }).where(eq(accounts.id, id));
}

/**
 * Marks an account's monthly amount due as paid for `monthKey` ('YYYY-MM'), hiding it from the
 * Recurring screen until the next month, and decrements `remainingMonths` if set and above zero.
 */
export async function markMonthlyDuePaid(db: Database, id: number, monthKey: string): Promise<void> {
  const [account] = await db.select({ remainingMonths: accounts.remainingMonths }).from(accounts).where(eq(accounts.id, id)).limit(1);
  await db
    .update(accounts)
    .set({
      monthlyDueLastPaidMonth: monthKey,
      remainingMonths:
        account?.remainingMonths != null && account.remainingMonths > 0 ? account.remainingMonths - 1 : account?.remainingMonths ?? null,
    })
    .where(eq(accounts.id, id));
}

/** Reverses `markMonthlyDuePaid`, restoring the account's monthly due to the Recurring screen. */
export async function markMonthlyDueUnpaid(db: Database, id: number): Promise<void> {
  const [account] = await db
    .select({ remainingMonths: accounts.remainingMonths, monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account?.monthlyDueLastPaidMonth) return;
  await db
    .update(accounts)
    .set({
      monthlyDueLastPaidMonth: null,
      remainingMonths: account.remainingMonths != null ? account.remainingMonths + 1 : null,
    })
    .where(eq(accounts.id, id));
}

/**
 * Adds an investment-kind account's `monthlyContribution` to its starting balance and records
 * today's date as `balanceLastUpdatedAt`.
 */
export async function incrementAccountBalance(db: Database, id: number): Promise<void> {
  const [account] = await db
    .select({ startingBalance: accounts.startingBalance, monthlyContribution: accounts.monthlyContribution })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account?.monthlyContribution) return;
  await db
    .update(accounts)
    .set({
      startingBalance: account.startingBalance + account.monthlyContribution,
      balanceLastUpdatedAt: formatIsoDate(new Date()),
    })
    .where(eq(accounts.id, id));
}
