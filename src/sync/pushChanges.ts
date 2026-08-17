import { gt } from 'drizzle-orm';

import type { Database } from '../db/client';
import { getSetting, setSetting } from '../db/queries/settings';
import {
  accountCategories,
  accounts,
  bills,
  budgets,
  categories,
  recurringTransactions,
  transactions,
} from '../db/schema';
import { supabase } from './supabaseClient';

const LAST_SYNCED_AT_KEY = 'lastSyncedAt';
/** Before SQLite's `datetime('now')` strings, so the first sync pushes every existing row. */
const EPOCH = '1970-01-01 00:00:00';

export class SyncNotConfiguredError extends Error {}
export class SyncNotSignedInError extends Error {}

async function buildIdUuidMap(rows: { id: number; uuid: string | null }[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.uuid) map.set(row.id, row.uuid);
  }
  return map;
}

function toUuid(map: Map<number, string>, id: number | null): string | null {
  if (id == null) return null;
  return map.get(id) ?? null;
}

export interface PushSummary {
  pushedCounts: Record<string, number>;
  totalPushed: number;
}

/**
 * Pushes every row changed (created/updated/soft-deleted) since the last sync to Supabase,
 * translating local FK ids to the referenced row's uuid at the boundary. Tables are pushed in
 * FK-dependency order (mirroring `restoreBackupFromFile`) so a referenced row's uuid already
 * exists remotely by the time a referencing row is upserted.
 */
export async function pushChanges(db: Database): Promise<PushSummary> {
  if (!supabase) throw new SyncNotConfiguredError('Supabase is not configured.');
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new SyncNotSignedInError('Not signed in.');

  const lastSyncedAt = (await getSetting(db, LAST_SYNCED_AT_KEY)) ?? EPOCH;
  const pushedCounts: Record<string, number> = {};

  // Full id->uuid maps (not just changed rows) since unchanged rows can still be referenced by FK.
  const categoryMap = await buildIdUuidMap(await db.select({ id: categories.id, uuid: categories.uuid }).from(categories));
  const accountCategoryMap = await buildIdUuidMap(
    await db.select({ id: accountCategories.id, uuid: accountCategories.uuid }).from(accountCategories),
  );
  const accountMap = await buildIdUuidMap(await db.select({ id: accounts.id, uuid: accounts.uuid }).from(accounts));
  const recurringMap = await buildIdUuidMap(
    await db.select({ id: recurringTransactions.id, uuid: recurringTransactions.uuid }).from(recurringTransactions),
  );
  const transactionMap = await buildIdUuidMap(
    await db.select({ id: transactions.id, uuid: transactions.uuid }).from(transactions),
  );

  const changedCategories = await db.select().from(categories).where(gt(categories.updatedAt, lastSyncedAt));
  if (changedCategories.length > 0) {
    const rows = changedCategories
      .filter((row) => row.uuid)
      .map((row) => ({
        uuid: row.uuid,
        user_id: userId,
        name: row.name,
        type: row.type,
        color: row.color,
        icon: row.icon,
        is_archived: row.isArchived,
        is_biller: row.isBiller,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt,
      }));
    const { error } = await supabase.from('categories').upsert(rows, { onConflict: 'uuid' });
    if (error) throw error;
    pushedCounts.categories = rows.length;
  }

  const changedAccountCategories = await db
    .select()
    .from(accountCategories)
    .where(gt(accountCategories.updatedAt, lastSyncedAt));
  if (changedAccountCategories.length > 0) {
    const rows = changedAccountCategories
      .filter((row) => row.uuid)
      .map((row) => ({
        uuid: row.uuid,
        user_id: userId,
        name: row.name,
        color: row.color,
        icon: row.icon,
        kind: row.kind,
        is_archived: row.isArchived,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt,
      }));
    const { error } = await supabase.from('account_categories').upsert(rows, { onConflict: 'uuid' });
    if (error) throw error;
    pushedCounts.accountCategories = rows.length;
  }

  const changedAccounts = await db.select().from(accounts).where(gt(accounts.updatedAt, lastSyncedAt));
  if (changedAccounts.length > 0) {
    const rows = changedAccounts
      .filter((row) => row.uuid)
      .map((row) => ({
        uuid: row.uuid,
        user_id: userId,
        name: row.name,
        category_uuid: toUuid(accountCategoryMap, row.categoryId),
        color: row.color,
        icon: row.icon,
        account_number: row.accountNumber,
        qr_image_uri: row.qrImageUri,
        starting_balance: row.startingBalance,
        is_archived: row.isArchived,
        include_in_net_worth: row.includeInNetWorth,
        monthly_amount_due: row.monthlyAmountDue,
        remaining_months: row.remainingMonths,
        monthly_due_last_paid_month: row.monthlyDueLastPaidMonth,
        monthly_contribution: row.monthlyContribution,
        balance_last_updated_at: row.balanceLastUpdatedAt,
        total_months: row.totalMonths,
        credit_limit: row.creditLimit,
        linked_credit_card_uuid: toUuid(accountMap, row.linkedCreditCardId),
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt,
      }));
    const { error } = await supabase.from('accounts').upsert(rows, { onConflict: 'uuid' });
    if (error) throw error;
    pushedCounts.accounts = rows.length;
  }

  const changedRecurring = await db
    .select()
    .from(recurringTransactions)
    .where(gt(recurringTransactions.updatedAt, lastSyncedAt));
  if (changedRecurring.length > 0) {
    const rows = changedRecurring
      .filter((row) => row.uuid)
      .map((row) => ({
        uuid: row.uuid,
        user_id: userId,
        type: row.type,
        amount: row.amount,
        note: row.note,
        category_uuid: toUuid(categoryMap, row.categoryId),
        biller_uuid: toUuid(categoryMap, row.billerId),
        frequency: row.frequency,
        interval_count: row.intervalCount,
        start_date: row.startDate,
        end_date: row.endDate,
        next_run_date: row.nextRunDate,
        is_active: row.isActive,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt,
      }));
    const { error } = await supabase.from('recurring_transactions').upsert(rows, { onConflict: 'uuid' });
    if (error) throw error;
    pushedCounts.recurringTransactions = rows.length;
  }

  const changedTransactions = await db.select().from(transactions).where(gt(transactions.updatedAt, lastSyncedAt));
  if (changedTransactions.length > 0) {
    const rows = changedTransactions
      .filter((row) => row.uuid)
      .map((row) => ({
        uuid: row.uuid,
        user_id: userId,
        type: row.type,
        amount: row.amount,
        fee: row.fee,
        occurred_at: row.occurredAt,
        note: row.note,
        establishment: row.establishment,
        category_uuid: toUuid(categoryMap, row.categoryId),
        account_uuid: toUuid(accountMap, row.accountId),
        recurring_uuid: toUuid(recurringMap, row.recurringId),
        receipt_image_uri: row.receiptImageUri,
        exclude_from_expense: row.excludeFromExpense,
        transfer_uuid: toUuid(transactionMap, row.transferId),
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt,
      }));
    const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'uuid' });
    if (error) throw error;
    pushedCounts.transactions = rows.length;
  }

  const changedBudgets = await db.select().from(budgets).where(gt(budgets.updatedAt, lastSyncedAt));
  if (changedBudgets.length > 0) {
    const rows = changedBudgets
      .filter((row) => row.uuid && categoryMap.has(row.categoryId))
      .map((row) => ({
        uuid: row.uuid,
        user_id: userId,
        category_uuid: toUuid(categoryMap, row.categoryId),
        month: row.month,
        amount_limit: row.amountLimit,
        alert_threshold_pct: row.alertThresholdPct,
        last_alert_pct: row.lastAlertPct,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt,
      }));
    const { error } = await supabase.from('budgets').upsert(rows, { onConflict: 'uuid' });
    if (error) throw error;
    pushedCounts.budgets = rows.length;
  }

  const changedBills = await db.select().from(bills).where(gt(bills.updatedAt, lastSyncedAt));
  if (changedBills.length > 0) {
    const rows = changedBills
      .filter((row) => row.uuid)
      .map((row) => ({
        uuid: row.uuid,
        user_id: userId,
        name: row.name,
        amount: row.amount,
        category_uuid: toUuid(categoryMap, row.categoryId),
        biller_uuid: toUuid(categoryMap, row.billerId),
        account_uuid: toUuid(accountMap, row.accountId),
        to_account_uuid: toUuid(accountMap, row.toAccountId),
        due_date: row.dueDate,
        frequency: row.frequency,
        interval_days: row.intervalDays,
        reminder_days_before: row.reminderDaysBefore,
        reminded_at: row.remindedAt,
        is_paid: row.isPaid,
        last_paid_at: row.lastPaidAt,
        paid_transaction_uuid: toUuid(transactionMap, row.paidTransactionId),
        exclude_from_expense: row.excludeFromExpense,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        deleted_at: row.deletedAt,
      }));
    const { error } = await supabase.from('bills').upsert(rows, { onConflict: 'uuid' });
    if (error) throw error;
    pushedCounts.bills = rows.length;
  }

  await setSetting(db, LAST_SYNCED_AT_KEY, new Date().toISOString().slice(0, 19).replace('T', ' '));

  const totalPushed = Object.values(pushedCounts).reduce((sum, count) => sum + count, 0);
  return { pushedCounts, totalPushed };
}
