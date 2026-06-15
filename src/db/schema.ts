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
    isBiller: integer('is_biller', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('idx_categories_name').on(table.name)],
);

export const accountCategories = sqliteTable(
  'account_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    icon: text('icon'),
    kind: text('kind', { enum: ['standard', 'credit_card'] }).notNull().default('standard'),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex('idx_account_categories_name').on(table.name)],
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => accountCategories.id),
    color: text('color').notNull(),
    icon: text('icon'),
    accountNumber: text('account_number'),
    qrImageUri: text('qr_image_uri'),
    startingBalance: integer('starting_balance').notNull().default(0),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    includeInNetWorth: integer('include_in_net_worth', { mode: 'boolean' }).notNull().default(true),
    /** Minimum/recurring amount due each month — shown for credit-card-kind accounts (credit cards, loans). */
    monthlyAmountDue: integer('monthly_amount_due'),
    /** Number of monthly payments left — shown for credit-card-kind accounts (credit cards, loans). */
    remainingMonths: integer('remaining_months'),
    /** 'YYYY-MM' of the month whose monthly due was last marked as paid. */
    monthlyDueLastPaidMonth: text('monthly_due_last_paid_month'),
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
    billerId: integer('biller_id').references(() => categories.id, { onDelete: 'set null' }),
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
    fee: integer('fee').notNull().default(0),
    occurredAt: text('occurred_at').notNull(),
    note: text('note'),
    establishment: text('establishment'),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    recurringId: integer('recurring_id').references(() => recurringTransactions.id, {
      onDelete: 'set null',
    }),
    receiptImageUri: text('receipt_image_uri'),
    excludeFromExpense: integer('exclude_from_expense', { mode: 'boolean' }).notNull().default(false),
    transferId: integer('transfer_id'),
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

export const bills = sqliteTable(
  'bills',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    billerId: integer('biller_id').references(() => categories.id, { onDelete: 'set null' }),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    dueDate: text('due_date').notNull(),
    frequency: text('frequency', { enum: ['once', 'weekly', 'semi_monthly', 'monthly', 'yearly'] })
      .notNull()
      .default('once'),
    reminderDaysBefore: integer('reminder_days_before').notNull().default(1),
    remindedAt: text('reminded_at'),
    isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
    paidTransactionId: integer('paid_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
    excludeFromExpense: integer('exclude_from_expense', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_bills_due_date').on(table.dueDate, table.isPaid)],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type AccountCategory = typeof accountCategories.$inferSelect;
export type NewAccountCategory = typeof accountCategories.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
