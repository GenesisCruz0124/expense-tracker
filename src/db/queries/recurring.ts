import { and, asc, eq, isNull, lte, sql } from 'drizzle-orm';

import type { Database } from '../client';
import {
  categories,
  recurringTransactions,
  transactions,
  type NewRecurringTransaction,
  type RecurringTransaction,
} from '../schema';
import { generateOccurrencesUpTo } from '../../utils/recurrence';
import { formatIsoDate } from '../../utils/dateRanges';

export interface RecurringWithStatus extends RecurringTransaction {
  /** True when a transaction has already been logged for this rule's upcoming due date */
  isPaid: boolean;
}

const isPaidExpr = sql<number>`exists (
  select 1 from ${transactions}
  where ${transactions.recurringId} = ${recurringTransactions.id}
    and ${transactions.occurredAt} = ${recurringTransactions.nextRunDate}
)`;

export async function listRecurringTransactions(db: Database): Promise<RecurringWithStatus[]> {
  const rows = await db
    .select({
      id: recurringTransactions.id,
      type: recurringTransactions.type,
      amount: recurringTransactions.amount,
      note: recurringTransactions.note,
      categoryId: recurringTransactions.categoryId,
      billerId: recurringTransactions.billerId,
      frequency: recurringTransactions.frequency,
      intervalCount: recurringTransactions.intervalCount,
      startDate: recurringTransactions.startDate,
      endDate: recurringTransactions.endDate,
      nextRunDate: recurringTransactions.nextRunDate,
      isActive: recurringTransactions.isActive,
      createdAt: recurringTransactions.createdAt,
      updatedAt: recurringTransactions.updatedAt,
      deletedAt: recurringTransactions.deletedAt,
      isPaid: isPaidExpr,
    })
    .from(recurringTransactions)
    .where(isNull(recurringTransactions.deletedAt))
    .orderBy(asc(recurringTransactions.nextRunDate));

  return rows.map((row) => ({ ...row, isPaid: Boolean(row.isPaid) }));
}

export async function getRecurringTransaction(db: Database, id: number): Promise<RecurringTransaction | undefined> {
  const [row] = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), isNull(recurringTransactions.deletedAt)))
    .limit(1);
  return row;
}

export interface RecurringInput {
  type: 'expense' | 'income';
  /** Integer amount in minor units (cents) */
  amount: number;
  note?: string | null;
  categoryId?: number | null;
  billerId?: number | null;
  frequency: 'weekly' | 'monthly';
  intervalCount: number;
  startDate: string;
  endDate?: string | null;
}

export async function createRecurringTransaction(db: Database, input: RecurringInput): Promise<RecurringTransaction> {
  const values: NewRecurringTransaction = {
    type: input.type,
    amount: input.amount,
    note: input.note?.trim() || null,
    categoryId: input.categoryId ?? null,
    billerId: input.billerId ?? null,
    frequency: input.frequency,
    intervalCount: input.intervalCount,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    nextRunDate: input.startDate,
    isActive: true,
  };
  const [row] = await db.insert(recurringTransactions).values(values).returning();
  return row;
}

export async function updateRecurringTransaction(db: Database, id: number, input: RecurringInput): Promise<void> {
  await db
    .update(recurringTransactions)
    .set({
      type: input.type,
      amount: input.amount,
      note: input.note?.trim() || null,
      categoryId: input.categoryId ?? null,
      billerId: input.billerId ?? null,
      frequency: input.frequency,
      intervalCount: input.intervalCount,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(recurringTransactions.id, id));
}

export async function setRecurringActive(db: Database, id: number, isActive: boolean): Promise<void> {
  await db
    .update(recurringTransactions)
    .set({ isActive, updatedAt: sql`(datetime('now'))` })
    .where(eq(recurringTransactions.id, id));
}

export async function deleteRecurringTransaction(db: Database, id: number): Promise<void> {
  await db
    .update(recurringTransactions)
    .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(eq(recurringTransactions.id, id));
}

export interface GeneratedOccurrenceSummary {
  ruleId: number;
  insertedCount: number;
}

/**
 * The lazy "catch-up" generator: finds every active rule whose `next_run_date` has arrived,
 * inserts one ledger transaction per elapsed due date (dated to its real due date, not today),
 * advances the rule's cursor, and deactivates rules that have run past their `end_date`.
 * Each rule is processed in its own DB transaction so a crash mid-run can't duplicate rows.
 */
export async function generateDueRecurringTransactions(
  db: Database,
  today: Date,
): Promise<GeneratedOccurrenceSummary[]> {
  const todayIso = formatIsoDate(today);
  const dueRules = await db
    .select()
    .from(recurringTransactions)
    .where(
      and(
        eq(recurringTransactions.isActive, true),
        lte(recurringTransactions.nextRunDate, todayIso),
        isNull(recurringTransactions.deletedAt),
      ),
    );

  const summaries: GeneratedOccurrenceSummary[] = [];

  for (const rule of dueRules) {
    const result = generateOccurrencesUpTo(
      {
        frequency: rule.frequency,
        intervalCount: rule.intervalCount,
        endDate: rule.endDate,
        nextRunDate: rule.nextRunDate,
      },
      today,
    );
    if (result.dueDates.length === 0) continue;

    await db.transaction(async (tx) => {
      let billerName: string | null = null;
      if (rule.billerId != null) {
        const [biller] = await tx.select({ name: categories.name }).from(categories).where(eq(categories.id, rule.billerId)).limit(1);
        billerName = biller?.name ?? null;
      }

      for (const dueDate of result.dueDates) {
        await tx.insert(transactions).values({
          type: rule.type,
          amount: rule.amount,
          occurredAt: dueDate,
          note: rule.note,
          establishment: billerName,
          categoryId: rule.categoryId,
          recurringId: rule.id,
        });
      }
      await tx
        .update(recurringTransactions)
        .set({
          nextRunDate: result.nextRunDate,
          isActive: result.isExhausted ? false : rule.isActive,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(recurringTransactions.id, rule.id));
    });

    summaries.push({ ruleId: rule.id, insertedCount: result.dueDates.length });
  }

  return summaries;
}
