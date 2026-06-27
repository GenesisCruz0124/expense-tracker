import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { accountCategories, type AccountCategory, type NewAccountCategory } from '../schema';
import { generateUuid } from '../../utils/uuid';

export interface ListAccountCategoriesOptions {
  includeArchived?: boolean;
}

export async function listAccountCategories(
  db: Database,
  options: ListAccountCategoriesOptions = {},
): Promise<AccountCategory[]> {
  const { includeArchived = false } = options;

  const conditions = [isNull(accountCategories.deletedAt)];
  if (!includeArchived) conditions.push(eq(accountCategories.isArchived, false));

  return db.select().from(accountCategories).where(and(...conditions)).orderBy(asc(accountCategories.name));
}

export async function getAccountCategory(db: Database, id: number): Promise<AccountCategory | undefined> {
  const [row] = await db
    .select()
    .from(accountCategories)
    .where(and(eq(accountCategories.id, id), isNull(accountCategories.deletedAt)))
    .limit(1);
  return row;
}

export interface AccountCategoryInput {
  name: string;
  color: string;
  icon?: string | null;
  /**
   * 'credit_card' accounts track a balance owed: expenses increase it, income/payments decrease it.
   * 'investment' accounts support a monthly contribution amount and a balance-update button.
   */
  kind?: 'standard' | 'credit_card' | 'investment';
}

export async function createAccountCategory(db: Database, input: AccountCategoryInput): Promise<AccountCategory> {
  const values: NewAccountCategory = {
    name: input.name.trim(),
    color: input.color,
    icon: input.icon ?? null,
    kind: input.kind ?? 'standard',
    uuid: generateUuid(),
  };
  const [row] = await db.insert(accountCategories).values(values).returning();
  return row;
}

export async function updateAccountCategory(db: Database, id: number, input: AccountCategoryInput): Promise<void> {
  await db
    .update(accountCategories)
    .set({
      name: input.name.trim(),
      color: input.color,
      icon: input.icon ?? null,
      kind: input.kind ?? 'standard',
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(accountCategories.id, id));
}

export async function setAccountCategoryArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db
    .update(accountCategories)
    .set({ isArchived, updatedAt: sql`(datetime('now'))` })
    .where(eq(accountCategories.id, id));
}
