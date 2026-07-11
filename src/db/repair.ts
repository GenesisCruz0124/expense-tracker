import { sql } from 'drizzle-orm';

import type { Database } from './client';

interface AccountColumnSpec {
  name: string;
  type: 'integer' | 'text';
}

/**
 * Columns added to `accounts` by migrations 0020-0023. A missing statement-breakpoint in an
 * earlier migration caused some of these to be silently skipped on already-upgraded devices
 * while still being recorded as applied, so `__drizzle_migrations` can't be trusted to tell
 * us whether they actually exist.
 */
const ACCOUNT_COLUMNS: AccountColumnSpec[] = [
  { name: 'remaining_months', type: 'integer' },
  { name: 'monthly_due_last_paid_month', type: 'text' },
  { name: 'monthly_contribution', type: 'integer' },
  { name: 'balance_last_updated_at', type: 'text' },
  { name: 'subscription_due_day', type: 'integer' },
  { name: 'annual_interest_rate', type: 'integer' },
  { name: 'last_interest_accrued_date', type: 'text' },
];

const RECURRING_COLUMNS: AccountColumnSpec[] = [
  { name: 'account_id', type: 'integer' },
];

/** Adds back any of `ACCOUNT_COLUMNS` that are missing from the `accounts` table, regardless of migration history. */
export async function repairAccountsSchema(db: Database): Promise<void> {
  const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(accounts)`);
  const existing = new Set(columns.map((column) => column.name));

  for (const column of ACCOUNT_COLUMNS) {
    if (existing.has(column.name)) continue;
    await db.run(sql.raw(`ALTER TABLE \`accounts\` ADD \`${column.name}\` ${column.type}`));
  }

  const recurringColumns = await db.all<{ name: string }>(sql`PRAGMA table_info(recurring_transactions)`);
  const existingRecurring = new Set(recurringColumns.map((column) => column.name));
  for (const column of RECURRING_COLUMNS) {
    if (existingRecurring.has(column.name)) continue;
    await db.run(sql.raw(`ALTER TABLE \`recurring_transactions\` ADD \`${column.name}\` ${column.type}`));
  }
}

interface SyncTableSpec {
  table: string;
  /** `transactions` already had `updated_at` since migration 0000, so it's omitted there. */
  hasUpdatedAt: boolean;
}

/** The 7 tables migrations 0031/0032 add `updated_at`/`deleted_at`/`uuid` (+ a unique index on `uuid`) to. */
const SYNC_TABLES: SyncTableSpec[] = [
  { table: 'categories', hasUpdatedAt: true },
  { table: 'account_categories', hasUpdatedAt: true },
  { table: 'accounts', hasUpdatedAt: true },
  { table: 'recurring_transactions', hasUpdatedAt: true },
  { table: 'transactions', hasUpdatedAt: false },
  { table: 'budgets', hasUpdatedAt: true },
  { table: 'bills', hasUpdatedAt: true },
];

/**
 * Adds back the `updated_at`/`deleted_at`/`uuid` columns (and `uuid` unique index) introduced by
 * migrations 0031/0032 to any of `SYNC_TABLES` missing them, regardless of migration history.
 *
 * Migration 0031 added `updated_at` via `ALTER TABLE ... ADD updated_at text DEFAULT (datetime('now'))
 * NOT NULL` — but SQLite rejects a non-constant default (`datetime('now')`) on `ALTER TABLE ADD COLUMN`
 * for any table that already has rows ("Cannot add a column with non-constant default"). Every device
 * upgrading with existing data (i.e. virtually every real user, since `categories` is seeded on first
 * launch) hit this deterministically and crash-looped forever, since the failing statement is retried
 * on every launch. Fixed here by adding the column as plain nullable (no default, which SQLite always
 * allows) and backfilling existing rows with a separate `UPDATE`, instead of doing both in one
 * `ALTER TABLE`. The column is left nullable at the SQL level — same as `deleted_at`/`uuid` already
 * are — relying on every write path setting `updated_at` explicitly (the existing codebase convention).
 * Migrations 0031/0032 are no-ops now; this function is the source of truth for these columns/indexes.
 */
export async function repairSyncSchema(db: Database): Promise<void> {
  for (const { table, hasUpdatedAt } of SYNC_TABLES) {
    const columns = await db.all<{ name: string }>(sql.raw(`PRAGMA table_info(\`${table}\`)`));
    const existing = new Set(columns.map((column) => column.name));

    if (hasUpdatedAt && !existing.has('updated_at')) {
      await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD \`updated_at\` text`));
      await db.run(sql.raw(`UPDATE \`${table}\` SET \`updated_at\` = datetime('now') WHERE \`updated_at\` IS NULL`));
    }
    if (!existing.has('deleted_at')) {
      await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD \`deleted_at\` text`));
    }
    if (!existing.has('uuid')) {
      await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD \`uuid\` text`));
    }

    await db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS \`idx_${table}_uuid\` ON \`${table}\` (\`uuid\`)`));
  }
}
