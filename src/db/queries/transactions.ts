import { and, between, desc, eq, inArray, isNull, like, or, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../client';
import { accounts, bills, categories, transactions, type NewTransaction, type Transaction } from '../schema';
import { generateUuid } from '../../utils/uuid';

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
  /** When true, only return transactions with no category assigned. */
  uncategorized?: boolean;
  accountIds?: number[];
  /** Inclusive ISO date range */
  start?: string;
  end?: string;
  searchText?: string;
  excludeFromExpense?: boolean;
}

function buildFilterConditions(filter: ListTransactionsFilter): SQL[] {
  const conditions: SQL[] = [isNull(transactions.deletedAt)];
  if (filter.type) conditions.push(eq(transactions.type, filter.type));
  if (filter.uncategorized) {
    conditions.push(isNull(transactions.categoryId));
  } else if (filter.categoryIds && filter.categoryIds.length > 0) {
    conditions.push(inArray(transactions.categoryId, filter.categoryIds));
  }
  if (filter.accountIds && filter.accountIds.length > 0) {
    conditions.push(inArray(transactions.accountId, filter.accountIds));
  }
  if (filter.excludeFromExpense !== undefined) {
    conditions.push(eq(transactions.excludeFromExpense, filter.excludeFromExpense));
  }
  if (filter.start && filter.end) {
    conditions.push(between(transactions.occurredAt, filter.start, filter.end));
  }
  const search = filter.searchText?.trim();
  if (search) {
    conditions.push(
      or(like(transactions.note, `%${search}%`), like(transactions.establishment, `%${search}%`))!,
    );
  }
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
      fee: transactions.fee,
      occurredAt: transactions.occurredAt,
      note: transactions.note,
      establishment: transactions.establishment,
      categoryId: transactions.categoryId,
      accountId: transactions.accountId,
      receiptImageUri: transactions.receiptImageUri,
      excludeFromExpense: transactions.excludeFromExpense,
      transferId: transactions.transferId,
      recurringId: transactions.recurringId,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      deletedAt: transactions.deletedAt,
      uuid: transactions.uuid,
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
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
    .limit(1);
  return row;
}

export interface TransactionInput {
  type: 'expense' | 'income';
  /** Integer amount in minor units (cents) */
  amount: number;
  /** Optional transaction fee in minor units (cents), e.g. a transfer or withdrawal fee */
  fee?: number;
  occurredAt: string;
  note?: string | null;
  establishment?: string | null;
  categoryId?: number | null;
  accountId?: number | null;
  receiptImageUri?: string | null;
  excludeFromExpense?: boolean;
}

function toNewTransactionValues(input: TransactionInput): NewTransaction {
  return {
    type: input.type,
    amount: input.amount,
    fee: input.fee ?? 0,
    occurredAt: input.occurredAt,
    note: input.note?.trim() || null,
    establishment: input.establishment?.trim() || null,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    receiptImageUri: input.receiptImageUri ?? null,
    excludeFromExpense: input.excludeFromExpense ?? false,
  };
}

export interface TransferInput {
  fromAccountId: number;
  toAccountId: number;
  /** Integer amount in minor units (cents) */
  amount: number;
  /** Optional fee deducted from the source account (minor units). */
  fee?: number;
  occurredAt: string;
  note?: string | null;
  receiptImageUri?: string | null;
  /** When true, the outgoing (from-account) leg counts toward expense reports/totals instead of being excluded. */
  includeAsExpense?: boolean;
  /** Category for the outgoing leg, only applied when `includeAsExpense` is true. */
  categoryId?: number | null;
}

export interface TransferLegs {
  transferId: number;
  fromTransaction: Transaction;
  toTransaction: Transaction;
}

/** A transfer is recorded as a linked pair of legs: an expense out of the source account
 * and an income into the destination account. Both legs are excluded from expense/income reports
 * by default, unless `includeAsExpense` opts the outgoing leg into expense totals (e.g. for transfers
 * that are really purchases, like paying via a bank app). */
export async function createTransfer(db: Database, input: TransferInput): Promise<TransferLegs> {
  const shared = {
    amount: input.amount,
    occurredAt: input.occurredAt,
    note: input.note?.trim() || null,
    receiptImageUri: input.receiptImageUri ?? null,
  };

  return db.transaction(async (tx) => {
    const [fromTransaction] = await tx
      .insert(transactions)
      .values({
        ...shared,
        type: 'expense',
        accountId: input.fromAccountId,
        fee: input.fee ?? 0,
        excludeFromExpense: !input.includeAsExpense,
        categoryId: input.includeAsExpense ? input.categoryId ?? null : null,
        uuid: generateUuid(),
      })
      .returning();
    const [toTransaction] = await tx
      .insert(transactions)
      .values({
        ...shared,
        type: 'income',
        accountId: input.toAccountId,
        transferId: fromTransaction.id,
        excludeFromExpense: true,
        categoryId: null,
        uuid: generateUuid(),
      })
      .returning();
    await tx.update(transactions).set({ transferId: fromTransaction.id }).where(eq(transactions.id, fromTransaction.id));

    return { transferId: fromTransaction.id, fromTransaction: { ...fromTransaction, transferId: fromTransaction.id }, toTransaction };
  });
}

/** Fetches both legs of a transfer, identifying the expense (from) and income (to) sides. */
export async function getTransferLegs(db: Database, transferId: number): Promise<TransferLegs | undefined> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.transferId, transferId), isNull(transactions.deletedAt)));
  let fromTransaction = rows.find((row) => row.type === 'expense');
  const toTransaction = rows.find((row) => row.type === 'income');

  // Fallback: for legacy transfers where the expense leg has transferId=NULL (UPDATE didn't persist),
  // the expense leg's id IS the transferId, so look it up directly.
  if (!fromTransaction) {
    const [fallback] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, transferId), isNull(transactions.deletedAt)));
    if (fallback?.type === 'expense') fromTransaction = fallback;
  }

  if (!fromTransaction || !toTransaction) return undefined;
  return { transferId, fromTransaction, toTransaction };
}

export async function updateTransfer(db: Database, transferId: number, input: TransferInput): Promise<void> {
  const legs = await getTransferLegs(db, transferId);
  if (!legs) throw new Error('Transfer not found.');

  const shared = {
    amount: input.amount,
    occurredAt: input.occurredAt,
    note: input.note?.trim() || null,
    receiptImageUri: input.receiptImageUri ?? null,
    updatedAt: sql`(datetime('now'))`,
  };

  await db
    .update(transactions)
    .set({
      ...shared,
      accountId: input.fromAccountId,
      fee: input.fee ?? 0,
      excludeFromExpense: !input.includeAsExpense,
      categoryId: input.includeAsExpense ? input.categoryId ?? null : null,
    })
    .where(eq(transactions.id, legs.fromTransaction.id));
  await db
    .update(transactions)
    .set({ ...shared, accountId: input.toAccountId })
    .where(eq(transactions.id, legs.toTransaction.id));
}

export async function deleteTransfer(db: Database, transferId: number): Promise<void> {
  await db
    .update(transactions)
    .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(eq(transactions.transferId, transferId));
  await db
    .update(bills)
    .set({ paidTransactionId: null, updatedAt: sql`(datetime('now'))` })
    .where(eq(bills.paidTransactionId, transferId));
}

export async function createTransaction(db: Database, input: TransactionInput): Promise<Transaction> {
  const [row] = await db
    .insert(transactions)
    .values({ ...toNewTransactionValues(input), uuid: generateUuid() })
    .returning();
  return row;
}

export async function updateTransaction(db: Database, id: number, input: TransactionInput): Promise<void> {
  await db
    .update(transactions)
    .set({ ...toNewTransactionValues(input), updatedAt: sql`(datetime('now'))` })
    .where(eq(transactions.id, id));
}

export async function deleteTransaction(db: Database, id: number): Promise<void> {
  await db
    .update(transactions)
    .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(eq(transactions.id, id));
  await db
    .update(bills)
    .set({ paidTransactionId: null, updatedAt: sql`(datetime('now'))` })
    .where(eq(bills.paidTransactionId, id));
}

/** Wipes every logged transaction — used by the "Clear all transactions" reset in Settings. */
export async function deleteAllTransactions(db: Database): Promise<void> {
  await db
    .update(transactions)
    .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(isNull(transactions.deletedAt));
  await db
    .update(bills)
    .set({ paidTransactionId: null, updatedAt: sql`(datetime('now'))` })
    .where(sql`${bills.paidTransactionId} is not null`);
}

/** Distinct establishment names used before, most-recently-used first — powers the autocomplete suggestions. */
export async function listEstablishments(db: Database, limit = 50): Promise<string[]> {
  const rows = await db
    .select({
      establishment: transactions.establishment,
      lastUsed: sql<string>`max(${transactions.occurredAt})`,
    })
    .from(transactions)
    .where(
      sql`${transactions.establishment} is not null and ${transactions.establishment} != '' and ${transactions.deletedAt} is null`,
    )
    .groupBy(transactions.establishment)
    .orderBy(desc(sql`max(${transactions.occurredAt})`))
    .limit(limit);
  return rows.map((row) => row.establishment!);
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
