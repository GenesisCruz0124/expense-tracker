-- Superseded by repairSyncSchema() in src/db/repair.ts (see DatabaseProvider.tsx bootstrap), which
-- idempotently adds the `uuid` columns/indexes regardless of whether a device already has them.
-- This migration is kept as a registered no-op so the journal/migrations.js entries stay intact.
SELECT 1;
