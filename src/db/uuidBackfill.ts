import { eq, isNull } from 'drizzle-orm';

import type { Database } from './client';
import { getSetting, setSetting } from './queries/settings';
import { generateUuid } from '../utils/uuid';
import { accountCategories, accounts, bills, budgets, categories, recurringTransactions, transactions } from './schema';

const BACKFILL_FLAG = 'uuidBackfillCompletedAt';

const SYNCABLE_TABLES = [categories, accountCategories, accounts, recurringTransactions, transactions, budgets, bills];

/**
 * One-time, idempotent backfill that assigns a fresh uuid to every row across the syncable
 * tables that doesn't have one yet (rows created before this column existed). Gated by a
 * settings flag so it only ever runs once per device. No cross-table ordering is needed since
 * a row's uuid doesn't depend on any other row's id or uuid.
 */
export async function backfillRowUuids(db: Database): Promise<void> {
  const completedAt = await getSetting(db, BACKFILL_FLAG);
  if (completedAt) return;

  await db.transaction(async (tx) => {
    for (const table of SYNCABLE_TABLES) {
      const rows = await tx.select({ id: table.id }).from(table).where(isNull(table.uuid));
      for (const row of rows) {
        await tx.update(table).set({ uuid: generateUuid() }).where(eq(table.id, row.id));
      }
    }
  });

  await setSetting(db, BACKFILL_FLAG, new Date().toISOString());
}
