import { and, between, eq, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { categories, transactions } from '../schema';
import type { MonthRange } from '../../utils/dateRanges';

export interface CategoryBreakdownEntry {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  /** Sum in minor units (cents) */
  total: number;
}

/** Spend (or income) grouped by category for a date range — backs the category pie/bar charts. */
export async function categoryBreakdown(
  db: Database,
  type: 'expense' | 'income',
  range: { start: string; end: string },
): Promise<CategoryBreakdownEntry[]> {
  const totalExpr = sql<number>`coalesce(sum(${transactions.amount}), 0)`;

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      total: totalExpr,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.type, type),
        eq(transactions.excludeFromExpense, false),
        between(transactions.occurredAt, range.start, range.end),
      ),
    )
    .groupBy(transactions.categoryId)
    .orderBy(sql`${totalExpr} desc`);

  return rows.map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName ?? 'Uncategorized',
    categoryColor: row.categoryColor ?? '#94A3B8',
    total: row.total,
  }));
}

export interface MonthlyTrendEntry {
  monthKey: string;
  label: string;
  /** Sums in minor units (cents) */
  income: number;
  expense: number;
}

/** Income vs. expense totals per month across a span of months — backs the trend chart. */
export async function incomeVsExpenseTrend(db: Database, ranges: MonthRange[]): Promise<MonthlyTrendEntry[]> {
  if (ranges.length === 0) return [];

  const overallStart = ranges[0].start;
  const overallEnd = ranges[ranges.length - 1].end;
  const monthKeyExpr = sql<string>`strftime('%Y-%m', ${transactions.occurredAt})`;

  const rows = await db
    .select({
      monthKey: monthKeyExpr,
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(eq(transactions.excludeFromExpense, false), between(transactions.occurredAt, overallStart, overallEnd)),
    )
    .groupBy(monthKeyExpr, transactions.type);

  const totalsByMonth = new Map<string, { income: number; expense: number }>();
  for (const row of rows) {
    const entry = totalsByMonth.get(row.monthKey) ?? { income: 0, expense: 0 };
    if (row.type === 'income') entry.income = row.total;
    else entry.expense = row.total;
    totalsByMonth.set(row.monthKey, entry);
  }

  return ranges.map((range) => {
    const totals = totalsByMonth.get(range.monthKey) ?? { income: 0, expense: 0 };
    return { monthKey: range.monthKey, label: range.label, income: totals.income, expense: totals.expense };
  });
}

export interface MonthlyTotals {
  /** Sums in minor units (cents) */
  income: number;
  expense: number;
}

/** Income/expense totals for a single date range — backs Dashboard summary cards. */
export async function monthlyTotals(db: Database, range: { start: string; end: string }): Promise<MonthlyTotals> {
  const rows = await db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(and(eq(transactions.excludeFromExpense, false), between(transactions.occurredAt, range.start, range.end)))
    .groupBy(transactions.type);

  const totals: MonthlyTotals = { income: 0, expense: 0 };
  for (const row of rows) {
    if (row.type === 'income') totals.income = row.total;
    else totals.expense = row.total;
  }
  return totals;
}
