import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { categories, transactions, type Category, type NewCategory } from '../schema';
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

export async function createCategory(db: Database, input: CategoryInput): Promise<Category> {
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

export async function setCategoryArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(categories).set({ isArchived, updatedAt: sql`(datetime('now'))` }).where(eq(categories.id, id));
}
