import { asc, eq, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { accountCategories, accounts, transactions, type Account, type NewAccount } from '../schema';

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
    })
    .where(eq(accounts.id, id));
}

export async function setAccountArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(accounts).set({ isArchived }).where(eq(accounts.id, id));
}
