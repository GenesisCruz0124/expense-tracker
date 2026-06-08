import { and, asc, eq, or } from 'drizzle-orm';

import type { Database } from '../client';
import { categories, type Category, type NewCategory } from '../schema';

export type CategoryType = 'expense' | 'income' | 'both';

export interface ListCategoriesOptions {
  /** Only categories usable for this transaction type (matches `type` or 'both'). Omit for all. */
  forType?: 'expense' | 'income';
  includeArchived?: boolean;
}

export async function listCategories(db: Database, options: ListCategoriesOptions = {}): Promise<Category[]> {
  const { forType, includeArchived = false } = options;

  const conditions = [];
  if (!includeArchived) conditions.push(eq(categories.isArchived, false));
  if (forType) conditions.push(or(eq(categories.type, forType), eq(categories.type, 'both')));

  const query = db.select().from(categories).orderBy(asc(categories.name));
  if (conditions.length === 0) return query;
  return query.where(and(...conditions));
}

export async function getCategory(db: Database, id: number): Promise<Category | undefined> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  color: string;
  icon?: string | null;
}

export async function createCategory(db: Database, input: CategoryInput): Promise<Category> {
  const values: NewCategory = {
    name: input.name.trim(),
    type: input.type,
    color: input.color,
    icon: input.icon ?? null,
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
    })
    .where(eq(categories.id, id));
}

export async function setCategoryArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(categories).set({ isArchived }).where(eq(categories.id, id));
}
