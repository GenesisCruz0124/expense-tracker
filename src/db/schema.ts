import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['expense', 'income', 'both'] }).notNull(),
    color: text('color').notNull(),
    icon: text('icon'),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('idx_categories_name').on(table.name)],
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    type: text('type', { enum: ['cash', 'bank', 'ewallet', 'credit_card', 'other'] }).notNull(),
    color: text('color').notNull(),
    icon: text('icon'),
    startingBalance: integer('starting_balance').notNull().default(0),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('idx_accounts_name').on(table.name)],
);

export const recurringTransactions = sqliteTable(
  'recurring_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: ['expense', 'income'] }).notNull(),
    amount: integer('amount').notNull(),
    note: text('note'),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    frequency: text('frequency', { enum: ['weekly', 'monthly'] }).notNull(),
    intervalCount: integer('interval_count').notNull().default(1),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    nextRunDate: text('next_run_date').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_recurring_next_run').on(table.nextRunDate, table.isActive)],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: ['expense', 'income'] }).notNull(),
    amount: integer('amount').notNull(),
    occurredAt: text('occurred_at').notNull(),
    note: text('note'),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    recurringId: integer('recurring_id').references(() => recurringTransactions.id, {
      onDelete: 'set null',
    }),
    receiptImageUri: text('receipt_image_uri'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_transactions_occurred_at').on(table.occurredAt),
    index('idx_transactions_category_id').on(table.categoryId),
    index('idx_transactions_account_id').on(table.accountId),
    index('idx_transactions_type_occurred_at').on(table.type, table.occurredAt),
    index('idx_transactions_category_occurred').on(table.categoryId, table.occurredAt),
  ],
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    amountLimit: integer('amount_limit').notNull(),
    alertThresholdPct: integer('alert_threshold_pct').notNull().default(90),
    lastAlertPct: integer('last_alert_pct').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('idx_budgets_category_month').on(table.categoryId, table.month),
    index('idx_budgets_month').on(table.month),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
