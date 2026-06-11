import { and, between, desc, eq, inArray, like, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../client';
import { accounts, categories, transactions, type NewTransaction, type Transaction } from '../schema';

export interface TransactionWithCategory extends Transaction {
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountName: string | null;
  accountColor: string | null;
  accountIcon: string | null;
}

export interface ListTransactionsFilter {
  type?: 'expense' | 'income';
  categoryIds?: number[];
  /** Inclusive ISO date range */
  start?: string;
  end?: string;
  searchText?: string;
}

function buildFilterConditions(filter: ListTransactionsFilter): SQL[] {
  const conditions: SQL[] = [];
  if (filter.type) conditions.push(eq(transactions.type, filter.type));
  if (filter.categoryIds && filter.categoryIds.length > 0) {
    conditions.push(inArray(transactions.categoryId, filter.categoryIds));
  }
  if (filter.start && filter.end) {
    conditions.push(between(transactions.occurredAt, filter.start, filter.end));
  }
  const search = filter.searchText?.trim();
  if (search) conditions.push(like(transactions.note, `%${search}%`));
  return conditions;
}

export async function listTransactions(
  db: Database,
  filter: ListTransactionsFilter = {},
): Promise<TransactionWithCategory[]> {
  const conditions = buildFilterConditions(filter);

  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      occurredAt: transactions.occurredAt,
      note: transactions.note,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      receiptImageUri: transactions.receiptImageUri,
      excludeFromExpense: transactions.excludeFromExpense,
      recurringId: transactions.recurringId,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
      accountColor: accounts.color,
      accountIcon: accounts.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.occurredAt), desc(transactions.id));
}

export async function getTransaction(db: Database, id: number): Promise<Transaction | undefined> {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return row;
}

export interface TransactionInput {
  type: 'expense' | 'income';
  /** Integer amount in minor units (cents) */
  amount: number;
  occurredAt: string;
  note?: string | null;
  categoryId?: number | null;
  accountId?: number | null;
  receiptImageUri?: string | null;
  excludeFromExpense?: boolean;
}

function toNewTransactionValues(input: TransactionInput): NewTransaction {
  return {
    type: input.type,
    amount: input.amount,
    occurredAt: input.occurredAt,
    note: input.note?.trim() || null,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    receiptImageUri: input.receiptImageUri ?? null,
    excludeFromExpense: input.excludeFromExpense ?? false,
  };
}

export async function createTransaction(db: Database, input: TransactionInput): Promise<Transaction> {
  const [row] = await db.insert(transactions).values(toNewTransactionValues(input)).returning();
  return row;
}

export async function updateTransaction(db: Database, id: number, input: TransactionInput): Promise<void> {
  await db
    .update(transactions)
    .set({ ...toNewTransactionValues(input), updatedAt: sql`(datetime('now'))` })
    .where(eq(transactions.id, id));
}

export async function deleteTransaction(db: Database, id: number): Promise<void> {
  await db.delete(transactions).where(eq(transactions.id, id));
}

/** Wipes every logged transaction — used by the "Clear all transactions" reset in Settings. */
export async function deleteAllTransactions(db: Database): Promise<void> {
  await db.delete(transactions);
}

/** Sum of transaction amounts (minor units) matching a filter — used for budget-vs-actual checks. */
export async function sumTransactions(db: Database, filter: ListTransactionsFilter): Promise<number> {
  const conditions = buildFilterConditions(filter);
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  return row?.total ?? 0;
}
