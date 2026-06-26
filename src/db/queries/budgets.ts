import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { budgets, categories, type Budget, type NewBudget } from '../schema';
import { sumTransactions } from './transactions';

export interface BudgetWithCategory extends Budget {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
}

export async function listBudgetsForMonth(db: Database, monthKey: string): Promise<BudgetWithCategory[]> {
  return db
    .select({
      id: budgets.id,
      categoryId: budgets.categoryId,
      month: budgets.month,
      amountLimit: budgets.amountLimit,
      alertThresholdPct: budgets.alertThresholdPct,
      lastAlertPct: budgets.lastAlertPct,
      createdAt: budgets.createdAt,
      updatedAt: budgets.updatedAt,
      deletedAt: budgets.deletedAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.month, monthKey), isNull(budgets.deletedAt)))
    .orderBy(asc(categories.name));
}

/** Sum of expense transactions for a category within an inclusive ISO date range — the "actual" side of budget-vs-limit. */
export async function getCategorySpend(
  db: Database,
  categoryId: number,
  range: { start: string; end: string },
): Promise<number> {
  return sumTransactions(db, { type: 'expense', categoryIds: [categoryId], start: range.start, end: range.end });
}

export interface BudgetInput {
  categoryId: number;
  month: string;
  /** Integer limit in minor units (cents) */
  amountLimit: number;
  alertThresholdPct?: number;
}

/** Creates or replaces the budget for a (category, month) pair — enforced by the table's unique index. */
export async function upsertBudget(db: Database, input: BudgetInput): Promise<Budget> {
  const values: NewBudget = {
    categoryId: input.categoryId,
    month: input.month,
    amountLimit: input.amountLimit,
    alertThresholdPct: input.alertThresholdPct ?? 90,
    lastAlertPct: 0,
  };

  const [row] = await db
    .insert(budgets)
    .values(values)
    .onConflictDoUpdate({
      target: [budgets.categoryId, budgets.month],
      set: {
        amountLimit: values.amountLimit,
        alertThresholdPct: values.alertThresholdPct,
        lastAlertPct: 0,
        deletedAt: null,
        updatedAt: sql`(datetime('now'))`,
      },
    })
    .returning();
  return row;
}

export async function deleteBudget(db: Database, id: number): Promise<void> {
  await db
    .update(budgets)
    .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
    .where(eq(budgets.id, id));
}

/** Records the highest alert threshold already notified for a budget, so the alert routine doesn't repeat itself. */
export async function setBudgetLastAlertPct(db: Database, id: number, pct: number): Promise<void> {
  await db
    .update(budgets)
    .set({ lastAlertPct: pct, updatedAt: sql`(datetime('now'))` })
    .where(eq(budgets.id, id));
}

/** Copies every budget from one month to another (skips categories that already have a budget for `toMonth`). */
export async function copyBudgetsForward(db: Database, fromMonth: string, toMonth: string): Promise<number> {
  const source = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.month, fromMonth), isNull(budgets.deletedAt)));
  let copied = 0;
  for (const budget of source) {
    const [existing] = await db
      .select({ id: budgets.id })
      .from(budgets)
      .where(and(eq(budgets.categoryId, budget.categoryId), eq(budgets.month, toMonth), isNull(budgets.deletedAt)))
      .limit(1);
    if (existing) continue;

    await db.insert(budgets).values({
      categoryId: budget.categoryId,
      month: toMonth,
      amountLimit: budget.amountLimit,
      alertThresholdPct: budget.alertThresholdPct,
      lastAlertPct: 0,
    });
    copied += 1;
  }
  return copied;
}
