import { sql } from 'drizzle-orm';

import type { Database } from '../client';

export async function initSettingsTable(db: Database): Promise<void> {
  await db.run(sql.raw('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'));
}

export async function getSetting(db: Database, key: string): Promise<string | null> {
  const rows = await db.all<{ value: string }>(sql`SELECT value FROM settings WHERE key = ${key}`);
  return rows[0]?.value ?? null;
}

export async function setSetting(db: Database, key: string, value: string): Promise<void> {
  await db.run(
    sql`INSERT INTO settings (key, value) VALUES (${key}, ${value}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}

export async function deleteSetting(db: Database, key: string): Promise<void> {
  await db.run(sql`DELETE FROM settings WHERE key = ${key}`);
}
