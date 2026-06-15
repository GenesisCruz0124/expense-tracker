import { addDays, addMonths, addYears, parseISO } from 'date-fns';
import { asc, eq } from 'drizzle-orm';

import type { Database } from '../client';
import { accounts, bills, categories, transactions, type Bill, type NewBill } from '../schema';
import { formatIsoDate } from '../../utils/dateRanges';

export type BillFrequency = Bill['frequency'];

export interface BillWithDetails extends Bill {
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountName: string | null;
  accountColor: string | null;
  accountIcon: string | null;
}

export async function listBills(db: Database): Promise<BillWithDetails[]> {
  return db
    .select({
      id: bills.id,
      name: bills.name,
      amount: bills.amount,
      categoryId: bills.categoryId,
      accountId: bills.accountId,
      dueDate: bills.dueDate,
      frequency: bills.frequency,
      reminderDaysBefore: bills.reminderDaysBefore,
      remindedAt: bills.remindedAt,
      isPaid: bills.isPaid,
      paidTransactionId: bills.paidTransactionId,
      createdAt: bills.createdAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
      accountColor: accounts.color,
      accountIcon: accounts.icon,
    })
    .from(bills)
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .leftJoin(accounts, eq(bills.accountId, accounts.id))
    .orderBy(asc(bills.isPaid), asc(bills.dueDate));
}

export async function getBill(db: Database, id: number): Promise<Bill | undefined> {
  const [row] = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
  return row;
}

export interface BillInput {
  name: string;
  /** Integer amount in minor units (cents) */
  amount: number;
  categoryId?: number | null;
  accountId?: number | null;
  dueDate: string;
  frequency: BillFrequency;
  reminderDaysBefore: number;
}

function toNewBillValues(input: BillInput): NewBill {
  return {
    name: input.name.trim(),
    amount: input.amount,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    dueDate: input.dueDate,
    frequency: input.frequency,
    reminderDaysBefore: input.reminderDaysBefore,
  };
}

/** Advances a bill's due date to its next occurrence based on its repeat frequency. */
function getNextDueDate(dueDate: string, frequency: BillFrequency): string {
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
    case 'once':
    default:
      return dueDate;
  }
}

export async function createBill(db: Database, input: BillInput): Promise<Bill> {
  const [row] = await db.insert(bills).values(toNewBillValues(input)).returning();
  return row;
}

export async function updateBill(db: Database, id: number, input: BillInput): Promise<void> {
  await db.update(bills).set(toNewBillValues(input)).where(eq(bills.id, id));
}

export async function deleteBill(db: Database, id: number): Promise<void> {
  await db.delete(bills).where(eq(bills.id, id));
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
    const [transaction] = await tx
      .insert(transactions)
      .values({
        type: 'expense',
        amount: bill.amount,
        occurredAt,
        note: bill.name,
        categoryId: bill.categoryId,
        accountId: bill.accountId,
      })
      .returning();

    if (bill.frequency === 'once') {
      await tx.update(bills).set({ isPaid: true, paidTransactionId: transaction.id }).where(eq(bills.id, id));
    } else {
      await tx
        .update(bills)
        .set({
          isPaid: false,
          paidTransactionId: null,
          remindedAt: null,
          dueDate: getNextDueDate(bill.dueDate, bill.frequency),
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
      await tx.delete(transactions).where(eq(transactions.id, bill.paidTransactionId));
    }
    await tx.update(bills).set({ isPaid: false, paidTransactionId: null }).where(eq(bills.id, id));
  });
}

/** Records that a due-date reminder has been sent so `checkBillReminders` doesn't repeat it. */
export async function markBillReminded(db: Database, id: number, remindedAt: string): Promise<void> {
  await db.update(bills).set({ remindedAt }).where(eq(bills.id, id));
}
