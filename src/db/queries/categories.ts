import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { bills, budgets, categories, recurringTransactions, transactions, type Category, type NewCategory } from '../schema';
import { generateUuid } from '../../utils/uuid';

export type CategoryType = 'expense' | 'income' | 'both';

export interface ListCategoriesOptions {
  /** Only categories usable for this transaction type (matches `type` or 'both'). Omit for all. */
  forType?: 'expense' | 'income';
  includeArchived?: boolean;
  /** Only categories flagged as billers (shown in the Billers tab). */
  billersOnly?: boolean;
  /** 'name' (default) sorts alphabetically; 'recent' sorts by most recently used in a transaction first. */
  sortBy?: 'name' | 'recent';
}

const lastUsedAtExpr = sql<string | null>`max(${transactions.occurredAt})`;

export async function listCategories(db: Database, options: ListCategoriesOptions = {}): Promise<Category[]> {
  const { forType, includeArchived = false, billersOnly = false, sortBy = 'name' } = options;

  const conditions = [isNull(categories.deletedAt)];
  if (!includeArchived) conditions.push(eq(categories.isArchived, false));
  if (forType) conditions.push(or(eq(categories.type, forType), eq(categories.type, 'both'))!);
  if (billersOnly) conditions.push(eq(categories.isBiller, true));

  if (sortBy !== 'recent') {
    return db.select().from(categories).where(and(...conditions)).orderBy(asc(categories.name));
  }

  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      color: categories.color,
      icon: categories.icon,
      isArchived: categories.isArchived,
      isBiller: categories.isBiller,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      deletedAt: categories.deletedAt,
      uuid: categories.uuid,
    })
    .from(categories)
    .leftJoin(transactions, and(eq(transactions.categoryId, categories.id), isNull(transactions.deletedAt)))
    .where(and(...conditions))
    .groupBy(categories.id)
    .orderBy(sql`${lastUsedAtExpr} is null, ${lastUsedAtExpr} desc`);
}

export async function getCategory(db: Database, id: number): Promise<Category | undefined> {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
    .limit(1);
  return row;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  color: string;
  icon?: string | null;
  isBiller?: boolean;
}

/** Case-insensitive lookup — `categories.name` has a unique index, so callers must check this before inserting. */
export async function getCategoryByName(db: Database, name: string): Promise<Category | undefined> {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(sql`lower(${categories.name}) = lower(${name.trim()})`, isNull(categories.deletedAt)))
    .limit(1);
  return row;
}

/**
 * Creates a category, or if one with the same name already exists (name is unique), upgrades it
 * in place instead of failing — un-archiving it, widening its type to 'both' if it didn't already
 * cover the requested type, and flagging it as a biller if requested. This lets "add as a biller"
 * (or picking a category from the other transaction type) reuse an existing category by name
 * rather than hitting a silent unique-constraint failure.
 */
export async function createCategory(db: Database, input: CategoryInput): Promise<Category> {
  const existing = await getCategoryByName(db, input.name);
  if (existing) {
    const needsUpdate =
      existing.isArchived ||
      (input.isBiller && !existing.isBiller) ||
      (existing.type !== input.type && existing.type !== 'both');
    if (!needsUpdate) return existing;

    const [row] = await db
      .update(categories)
      .set({
        isArchived: false,
        isBiller: existing.isBiller || (input.isBiller ?? false),
        type: existing.type === input.type ? existing.type : 'both',
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(categories.id, existing.id))
      .returning();
    return row;
  }

  const values: NewCategory = {
    name: input.name.trim(),
    type: input.type,
    color: input.color,
    icon: input.icon ?? null,
    isBiller: input.isBiller ?? false,
    uuid: generateUuid(),
  };
  const [row] = await db.insert(categories).values(values).returning();
  return row;
}

export async function updateCategory(db: Database, id: number, input: CategoryInput): Promise<void> {
  await db
    .update(categories)
    .set({
      name: input.name.trim(),
      type: input.type,
      color: input.color,
      icon: input.icon ?? null,
      isBiller: input.isBiller ?? false,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(categories.id, id));
}

/**
 * Repoints everything referencing `sourceId` at `targetId`, then soft-deletes the source category.
 *
 * Budgets are the one place a straight repoint can collide: `(category_id, month)` is unique, so
 * when both categories budget the same month the two limits are summed into the target's row and
 * the source's row is deleted rather than moved.
 */
export async function mergeCategory(db: Database, sourceId: number, targetId: number): Promise<void> {
  if (sourceId === targetId) return;

  await db.transaction(async (tx) => {
    const now = sql`(datetime('now'))`;

    await tx.update(transactions).set({ categoryId: targetId, updatedAt: now }).where(eq(transactions.categoryId, sourceId));
    await tx.update(bills).set({ categoryId: targetId, updatedAt: now }).where(eq(bills.categoryId, sourceId));
    await tx.update(bills).set({ billerId: targetId, updatedAt: now }).where(eq(bills.billerId, sourceId));
    await tx
      .update(recurringTransactions)
      .set({ categoryId: targetId, updatedAt: now })
      .where(eq(recurringTransactions.categoryId, sourceId));
    await tx
      .update(recurringTransactions)
      .set({ billerId: targetId, updatedAt: now })
      .where(eq(recurringTransactions.billerId, sourceId));

    const sourceBudgets = await tx.select().from(budgets).where(eq(budgets.categoryId, sourceId));
    for (const budget of sourceBudgets) {
      const [clash] = await tx
        .select({ id: budgets.id, amountLimit: budgets.amountLimit })
        .from(budgets)
        .where(and(eq(budgets.categoryId, targetId), eq(budgets.month, budget.month)))
        .limit(1);
      if (clash) {
        await tx
          .update(budgets)
          .set({ amountLimit: clash.amountLimit + budget.amountLimit, updatedAt: now })
          .where(eq(budgets.id, clash.id));
        await tx.delete(budgets).where(eq(budgets.id, budget.id));
      } else {
        await tx.update(budgets).set({ categoryId: targetId, updatedAt: now }).where(eq(budgets.id, budget.id));
      }
    }

    await tx.update(categories).set({ deletedAt: now, updatedAt: now }).where(eq(categories.id, sourceId));
  });
}

export async function setCategoryArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(categories).set({ isArchived, updatedAt: sql`(datetime('now'))` }).where(eq(categories.id, id));
}
