import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { categories, type Category, type NewCategory } from '../schema';

export type CategoryType = 'expense' | 'income' | 'both';

export interface ListCategoriesOptions {
  /** Only categories usable for this transaction type (matches `type` or 'both'). Omit for all. */
  forType?: 'expense' | 'income';
  includeArchived?: boolean;
  /** Only categories flagged as billers (shown in the Billers tab). */
  billersOnly?: boolean;
}

export async function listCategories(db: Database, options: ListCategoriesOptions = {}): Promise<Category[]> {
  const { forType, includeArchived = false, billersOnly = false } = options;

  const conditions = [isNull(categories.deletedAt)];
  if (!includeArchived) conditions.push(eq(categories.isArchived, false));
  if (forType) conditions.push(or(eq(categories.type, forType), eq(categories.type, 'both'))!);
  if (billersOnly) conditions.push(eq(categories.isBiller, true));

  return db.select().from(categories).where(and(...conditions)).orderBy(asc(categories.name));
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
