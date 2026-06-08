import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

const sqlite = openDatabaseSync('expense-tracker.db', { enableChangeListener: true });
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;
