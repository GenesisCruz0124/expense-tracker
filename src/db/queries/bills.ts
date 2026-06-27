import { addDays, addMonths, addYears, parseISO } from 'date-fns';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import type { Database } from '../client';
import { accounts, bills, categories, transactions, type Bill, type NewBill } from '../schema';
import { formatIsoDate } from '../../utils/dateRanges';
import { generateUuid } from '../../utils/uuid';

export type BillFrequency = Bill['frequency'];

export interface BillWithDetails extends Bill {
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  billerName: string | null;
  billerColor: string | null;
  billerIcon: string | null;
  accountName: string | null;
  accountColor: string | null;
  accountIcon: string | null;
}

const billers = alias(categories, 'billers');

export async function listBills(db: Database): Promise<BillWithDetails[]> {
  return db
    .select({
      id: bills.id,
      name: bills.name,
      amount: bills.amount,
      categoryId: bills.categoryId,
      billerId: bills.billerId,
      accountId: bills.accountId,
      toAccountId: bills.toAccountId,
      dueDate: bills.dueDate,
      frequency: bills.frequency,
      intervalDays: bills.intervalDays,
      reminderDaysBefore: bills.reminderDaysBefore,
      remindedAt: bills.remindedAt,
      isPaid: bills.isPaid,
      lastPaidAt: bills.lastPaidAt,
      paidTransactionId: bills.paidTransactionId,
      excludeFromExpense: bills.excludeFromExpense,
      createdAt: bills.createdAt,
      updatedAt: bills.updatedAt,
      deletedAt: bills.deletedAt,
      uuid: bills.uuid,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      billerName: billers.name,
      billerColor: billers.color,
      billerIcon: billers.icon,
      accountName: accounts.name,
      accountColor: accounts.color,
      accountIcon: accounts.icon,
    })
    .from(bills)
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .leftJoin(billers, eq(bills.billerId, billers.id))
    .leftJoin(accounts, eq(bills.accountId, accounts.id))
    .where(isNull(bills.deletedAt))
    .orderBy(asc(bills.isPaid), asc(bills.dueDate));
}

export async function getBill(db: Database, id: number): Promise<Bill | undefined> {
  const [row] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, id), isNull(bills.deletedAt)))
    .limit(1);
  return row;
}

/** Distinct bill names used before, most-recently-created first — powers name autocomplete suggestions. */
export async function listBillNames(db: Database, limit = 50): Promise<string[]> {
  const rows = await db
    .select({
      name: bills.name,
      lastCreated: sql<string>`max(${bills.createdAt})`,
    })
    .from(bills)
    .where(isNull(bills.deletedAt))
    .groupBy(bills.name)
    .orderBy(desc(sql`max(${bills.createdAt})`))
    .limit(limit);
  return rows.map((row) => row.name);
}

export interface BillInput {
  name: string;
  /** Integer amount in minor units (cents) */
  amount: number;
  categoryId?: number | null;
  billerId?: number | null;
  accountId?: number | null;
  /** When set, "mark as paid" records a transfer into this account instead of a plain expense. */
  toAccountId?: number | null;
  dueDate: string;
  frequency: BillFrequency;
  /** Day interval used when `frequency` is 'every_n_days', e.g. 11 for "every 11 days". */
  intervalDays?: number | null;
  reminderDaysBefore: number;
  /** When true, the expense logged by "mark as paid" is excluded from expense reports. */
  excludeFromExpense?: boolean;
}

function toNewBillValues(input: BillInput): NewBill {
  return {
    name: input.name.trim(),
    amount: input.amount,
    categoryId: input.categoryId ?? null,
    billerId: input.billerId ?? null,
    accountId: input.accountId ?? null,
    toAccountId: input.toAccountId ?? null,
    dueDate: input.dueDate,
    frequency: input.frequency,
    intervalDays: input.frequency === 'every_n_days' ? input.intervalDays ?? null : null,
    reminderDaysBefore: input.reminderDaysBefore,
    excludeFromExpense: input.excludeFromExpense ?? false,
  };
}

/** Advances a bill's due date to its next occurrence based on its repeat frequency. */
function getNextDueDate(dueDate: string, frequency: BillFrequency, intervalDays: number | null): string {
  const current = parseISO(dueDate);
  switch (frequency) {
    case 'weekly':
      return formatIsoDate(addDays(current, 7));
    case 'semi_monthly':
      return formatIsoDate(addDays(current, 15));
    case 'monthly':
      return formatIsoDate(addMonths(current, 1));
    case 'yearly':
      return formatIsoDate(addYears(current, 1));
    case 'every_n_days':
      return formatIsoDate(addDays(current, intervalDays ?? 1));
    case 'once':
    default:
      return dueDate;
  }
}

export async function createBill(db: Database, input: BillInput): Promise<Bill> {
  const [row] = await db
    .insert(bills)
    .values({ ...toNewBillValues(input), uuid: generateUuid() })
    .returning();
  return row;
}

export async function updateBill(db: Database, id: number, input: BillInput): Promise<void> {
  await db
    .update(bills)
    .set({ ...toNewBillValues(input), updatedAt: sql`(datetime('now'))` })
    .where(eq(bills.id, id));
}

export async function deleteBill(db: Database, id: number): Promise<void> {
  await db
    .update(bills)
    .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(eq(bills.id, id));
}

/**
 * Marks a bill as paid by logging an expense transaction and linking it back via `paidTransactionId`.
 * For recurring bills (`frequency` other than 'once'), the bill instead rolls forward to its next
 * due date and stays unpaid, ready for the next cycle.
 */
export async function markBillPaid(db: Database, id: number, occurredAt: string): Promise<void> {
  const bill = await getBill(db, id);
  if (!bill || bill.isPaid) return;

  await db.transaction(async (tx) => {
    let billerName: string | null = null;
    if (bill.billerId != null) {
      const [biller] = await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, bill.billerId)).limit(1);
      billerName = biller?.name ?? null;
    }

    let transactionId: number;
    if (bill.toAccountId != null) {
      const [fromTransaction] = await tx
        .insert(transactions)
        .values({
          type: 'expense',
          amount: bill.amount,
          occurredAt,
          note: bill.name,
          establishment: billerName,
          categoryId: bill.categoryId,
          accountId: bill.accountId,
          excludeFromExpense: bill.excludeFromExpense,
          uuid: generateUuid(),
        })
        .returning();
      await tx.insert(transactions).values({
        type: 'income',
        amount: bill.amount,
        occurredAt,
        note: bill.name,
        accountId: bill.toAccountId,
        transferId: fromTransaction.id,
        excludeFromExpense: true,
        categoryId: null,
        uuid: generateUuid(),
      });
      await tx.update(transactions).set({ transferId: fromTransaction.id }).where(eq(transactions.id, fromTransaction.id));
      transactionId = fromTransaction.id;
    } else {
      const [transaction] = await tx
        .insert(transactions)
        .values({
          type: 'expense',
          amount: bill.amount,
          occurredAt,
          note: bill.name,
          establishment: billerName,
          categoryId: bill.categoryId,
          accountId: bill.accountId,
          excludeFromExpense: bill.excludeFromExpense,
          uuid: generateUuid(),
        })
        .returning();
      transactionId = transaction.id;
    }

    if (bill.frequency === 'once') {
      await tx
        .update(bills)
        .set({
          isPaid: true,
          paidTransactionId: transactionId,
          lastPaidAt: occurredAt,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(bills.id, id));
    } else {
      await tx
        .update(bills)
        .set({
          isPaid: false,
          paidTransactionId: null,
          remindedAt: null,
          lastPaidAt: occurredAt,
          dueDate: getNextDueDate(bill.dueDate, bill.frequency, bill.intervalDays),
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(bills.id, id));
    }
  });
}

/** Reverses `markBillPaid` — deletes the linked transaction and resets the bill to unpaid. */
export async function markBillUnpaid(db: Database, id: number): Promise<void> {
  const bill = await getBill(db, id);
  if (!bill || !bill.isPaid) return;

  await db.transaction(async (tx) => {
    if (bill.paidTransactionId != null) {
      const [paidTransaction] = await tx
        .select({ transferId: transactions.transferId })
        .from(transactions)
        .where(eq(transactions.id, bill.paidTransactionId))
        .limit(1);
      if (paidTransaction?.transferId != null) {
        await tx
          .update(transactions)
          .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
          .where(eq(transactions.transferId, paidTransaction.transferId));
      } else {
        await tx
          .update(transactions)
          .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
          .where(eq(transactions.id, bill.paidTransactionId));
      }
    }
    await tx
      .update(bills)
      .set({ isPaid: false, paidTransactionId: null, lastPaidAt: null, updatedAt: sql`(datetime('now'))` })
      .where(eq(bills.id, id));
  });
}

/** Records that a due-date reminder has been sent so `checkBillReminders` doesn't repeat it. */
export async function markBillReminded(db: Database, id: number, remindedAt: string): Promise<void> {
  await db
    .update(bills)
    .set({ remindedAt, updatedAt: sql`(datetime('now'))` })
    .where(eq(bills.id, id));
}
