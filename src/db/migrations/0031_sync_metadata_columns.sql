-- Superseded by repairSyncSchema() in src/db/repair.ts (see DatabaseProvider.tsx bootstrap), which
-- idempotently adds these columns regardless of whether a device already has them. The original
-- ALTER TABLE ... ADD updated_at text DEFAULT (datetime('now')) NOT NULL statements below crash
-- with "Cannot add a column with non-constant default" on any table that already has rows (a
-- SQLite restriction on ALTER TABLE ADD COLUMN) -- which every real user upgrading with existing
-- data (e.g. seeded categories) hits deterministically, crash-looping the app on every launch.
-- This migration is kept as a registered no-op so the journal/migrations.js entries stay intact.
SELECT 1;
