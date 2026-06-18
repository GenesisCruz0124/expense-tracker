import { openDatabaseSync } from 'expo-sqlite';

/**
 * Tiny standalone key-value store for UI preferences (theme mode/accent), read synchronously so
 * `constants/colors.ts` can bake the chosen palette into every screen's StyleSheet at import time —
 * before drizzle/the main app database is even touched. Deliberately not part of the main schema/
 * migration system since it only ever needs one table and no relations.
 */
const db = openDatabaseSync('app-preferences.db');
db.execSync('CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');

export function getPreference(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM preferences WHERE key = ?;', [key]);
  return row?.value ?? null;
}

export function setPreference(key: string, value: string): void {
  db.runSync(
    'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
    [key, value],
  );
}
