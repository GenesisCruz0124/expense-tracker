import { asc, eq } from 'drizzle-orm';

import type { Database } from '../client';
import { accountCategories, type AccountCategory, type NewAccountCategory } from '../schema';

export interface ListAccountCategoriesOptions {
  includeArchived?: boolean;
}

export async function listAccountCategories(
  db: Database,
  options: ListAccountCategoriesOptions = {},
): Promise<AccountCategory[]> {
  const { includeArchived = false } = options;

  const query = db.select().from(accountCategories).orderBy(asc(accountCategories.name));
  if (includeArchived) return query;
  return query.where(eq(accountCategories.isArchived, false));
}

export async function getAccountCategory(db: Database, id: number): Promise<AccountCategory | undefined> {
  const [row] = await db.select().from(accountCategories).where(eq(accountCategories.id, id)).limit(1);
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
    })
    .where(eq(accountCategories.id, id));
}

export async function setAccountCategoryArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(accountCategories).set({ isArchived }).where(eq(accountCategories.id, id));
}
