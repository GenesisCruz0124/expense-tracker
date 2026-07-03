import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { accountCategories, accounts, transactions, type Account, type NewAccount } from '../schema';
import { formatIsoDate } from '../../utils/dateRanges';
import { generateUuid } from '../../utils/uuid';

export interface AccountWithBalance extends Account {
  /**
   * Starting balance plus the net effect of every transaction assigned to this account, in minor units.
   * For standard accounts, income adds and expenses subtract. For credit card accounts the balance
   * represents the amount owed, so expenses (purchases) add and income (payments/refunds) subtract.
   */
  balance: number;
  /** ISO datetime of the most recent transaction on this account, or null if the account has no transactions. */
  lastTransactionAt: string | null;
}

export interface ListAccountsOptions {
  includeArchived?: boolean;
  /** 'name' (default) sorts alphabetically; 'recent' sorts by most recent transaction first. */
  sortBy?: 'name' | 'recent';
}

const lastTransactionAtExpr = sql<string | null>`max(${transactions.occurredAt})`;

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
  const { includeArchived = false, sortBy = 'name' } = options;

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
      subscriptionDueDay: accounts.subscriptionDueDay,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyContribution: accounts.monthlyContribution,
      balanceLastUpdatedAt: accounts.balanceLastUpdatedAt,
      totalMonths: accounts.totalMonths,
      creditLimit: accounts.creditLimit,
      linkedCreditCardId: accounts.linkedCreditCardId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      deletedAt: accounts.deletedAt,
      uuid: accounts.uuid,
      balance: balanceExpr,
      lastTransactionAt: lastTransactionAtExpr,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .groupBy(accounts.id)
    .orderBy(
      sortBy === 'recent'
        ? sql`${lastTransactionAtExpr} is null, ${lastTransactionAtExpr} desc`
        : asc(accounts.name),
    );

  const conditions = [isNull(accounts.deletedAt)];
  if (!includeArchived) conditions.push(eq(accounts.isArchived, false));
  return query.where(and(...conditions));
}

/** Names of non-archived investment-kind accounts — used to suggest bill names like a savings/investment contribution. */
export async function listInvestmentAccountNames(db: Database): Promise<string[]> {
  const rows = await db
    .select({ name: accounts.name })
    .from(accounts)
    .innerJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .where(sql`${accountCategories.kind} = 'investment' and ${accounts.isArchived} = 0 and ${accounts.deletedAt} is null`)
    .orderBy(asc(accounts.name));
  return rows.map((row) => row.name);
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
      subscriptionDueDay: accounts.subscriptionDueDay,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyContribution: accounts.monthlyContribution,
      balanceLastUpdatedAt: accounts.balanceLastUpdatedAt,
      totalMonths: accounts.totalMonths,
      creditLimit: accounts.creditLimit,
      linkedCreditCardId: accounts.linkedCreditCardId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      deletedAt: accounts.deletedAt,
      uuid: accounts.uuid,
      balance: balanceExpr,
      lastTransactionAt: lastTransactionAtExpr,
    })
    .from(accounts)
    .leftJoin(transactions, eq(transactions.accountId, accounts.id))
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
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
  /** Running count of months contributed (investment) or months paid (credit_card). */
  totalMonths?: number;
  /** Credit limit in minor units — for credit-card-kind accounts. */
  creditLimit?: number | null;
  /** For loan accounts: the credit card account ID this loan is charged against. */
  linkedCreditCardId?: number | null;
  /** Day of the month (1–31) when the subscription renews — for subscription accounts. */
  subscriptionDueDay?: number | null;
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
    totalMonths: input.totalMonths ?? 0,
    creditLimit: input.creditLimit ?? null,
    linkedCreditCardId: input.linkedCreditCardId ?? null,
    subscriptionDueDay: input.subscriptionDueDay ?? null,
    uuid: generateUuid(),
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
      ...(input.totalMonths != null ? { totalMonths: input.totalMonths } : {}),
      creditLimit: input.creditLimit ?? null,
      linkedCreditCardId: input.linkedCreditCardId ?? null,
      subscriptionDueDay: input.subscriptionDueDay ?? null,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(accounts.id, id));
}

export async function setAccountArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(accounts).set({ isArchived, updatedAt: sql`(datetime('now'))` }).where(eq(accounts.id, id));
}

/**
 * Marks an account's monthly amount due as paid for `monthKey` ('YYYY-MM'), hiding it from the
 * Recurring screen until the next month, decrements `remainingMonths` if set and above zero, and
 * subtracts `monthlyAmountDue` from the account's balance.
 */
export async function markMonthlyDuePaid(db: Database, id: number, monthKey: string): Promise<void> {
  const [account] = await db
    .select({
      remainingMonths: accounts.remainingMonths,
      monthlyAmountDue: accounts.monthlyAmountDue,
      startingBalance: accounts.startingBalance,
      totalMonths: accounts.totalMonths,
    })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account) return;
  await db
    .update(accounts)
    .set({
      monthlyDueLastPaidMonth: monthKey,
      remainingMonths:
        account.remainingMonths != null && account.remainingMonths > 0 ? account.remainingMonths - 1 : account.remainingMonths,
      startingBalance: account.startingBalance - (account.monthlyAmountDue ?? 0),
      totalMonths: account.totalMonths + 1,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(accounts.id, id));
}

/**
 * Reverses `markMonthlyDuePaid`, restoring the account's monthly due to the Recurring screen and
 * adding `monthlyAmountDue` back to the account's balance.
 */
export async function markMonthlyDueUnpaid(db: Database, id: number): Promise<void> {
  const [account] = await db
    .select({
      remainingMonths: accounts.remainingMonths,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyAmountDue: accounts.monthlyAmountDue,
      startingBalance: accounts.startingBalance,
    })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account?.monthlyDueLastPaidMonth) return;
  await db
    .update(accounts)
    .set({
      monthlyDueLastPaidMonth: null,
      remainingMonths: account.remainingMonths != null ? account.remainingMonths + 1 : null,
      startingBalance: account.startingBalance + (account.monthlyAmountDue ?? 0),
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(accounts.id, id));
}

/**
 * Adds an investment-kind account's `monthlyContribution` to its starting balance and records
 * today's date as `balanceLastUpdatedAt`.
 */
export async function incrementAccountBalance(db: Database, id: number): Promise<void> {
  const [account] = await db
    .select({ startingBalance: accounts.startingBalance, monthlyContribution: accounts.monthlyContribution, totalMonths: accounts.totalMonths })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account?.monthlyContribution) return;
  await db
    .update(accounts)
    .set({
      startingBalance: account.startingBalance + account.monthlyContribution,
      balanceLastUpdatedAt: formatIsoDate(new Date()),
      totalMonths: account.totalMonths + 1,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(accounts.id, id));
}
