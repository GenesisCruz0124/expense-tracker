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
];

/** Adds back any of `ACCOUNT_COLUMNS` that are missing from the `accounts` table, regardless of migration history. */
export async function repairAccountsSchema(db: Database): Promise<void> {
  const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(accounts)`);
  const existing = new Set(columns.map((column) => column.name));

  for (const column of ACCOUNT_COLUMNS) {
    if (existing.has(column.name)) continue;
    await db.run(sql.raw(`ALTER TABLE \`accounts\` ADD \`${column.name}\` ${column.type}`));
  }
}
