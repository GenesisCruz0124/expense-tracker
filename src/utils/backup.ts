import { eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { Database } from '../db/client';
import {
  accountCategories,
  accounts,
  budgets,
  categories,
  recurringTransactions,
  transactions,
  type Account,
  type AccountCategory,
  type Budget,
  type Category,
  type RecurringTransaction,
  type Transaction,
} from '../db/schema';

const BACKUP_VERSION = 1;

interface BackupImage {
  data: string;
  extension: string;
}

interface BackupFile {
  version: number;
  exportedAt: string;
  tables: {
    categories: Category[];
    accountCategories: AccountCategory[];
    accounts: Account[];
    recurringTransactions: RecurringTransaction[];
    transactions: Transaction[];
    budgets: Budget[];
  };
  images: Record<string, BackupImage>;
}

function extensionFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(\?.*)?$/.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

async function readImageAsBackupEntry(uri: string): Promise<BackupImage | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return { data, extension: extensionFromUri(uri) };
  } catch {
    return null;
  }
}

/** Gathers every table and referenced image into a single JSON backup file and returns its local URI. */
export async function createBackupFile(db: Database): Promise<string> {
  const [categoryRows, accountCategoryRows, accountRows, recurringRows, transactionRows, budgetRows] =
    await Promise.all([
      db.select().from(categories),
      db.select().from(accountCategories),
      db.select().from(accounts),
      db.select().from(recurringTransactions),
      db.select().from(transactions),
      db.select().from(budgets),
    ]);

  const imageUris = new Set<string>();
  for (const account of accountRows) {
    if (account.qrImageUri) imageUris.add(account.qrImageUri);
  }
  for (const transaction of transactionRows) {
    if (transaction.receiptImageUri) imageUris.add(transaction.receiptImageUri);
  }

  const images: Record<string, BackupImage> = {};
  for (const uri of imageUris) {
    const image = await readImageAsBackupEntry(uri);
    if (image) images[uri] = image;
  }

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      categories: categoryRows,
      accountCategories: accountCategoryRows,
      accounts: accountRows,
      recurringTransactions: recurringRows,
      transactions: transactionRows,
      budgets: budgetRows,
    },
    images,
  };

  const fileName = `expense-tracker-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup), { encoding: FileSystem.EncodingType.UTF8 });
  return fileUri;
}

/** Opens the native share sheet so the user can save or send the backup file. */
export async function shareBackupFile(fileUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Save expense tracker backup',
  });
}

/** Lets the user pick a backup JSON file. Returns its local URI, or null if cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BackupFile>;
  return (
    candidate.version === BACKUP_VERSION &&
    typeof candidate.tables === 'object' &&
    candidate.tables !== null &&
    Array.isArray(candidate.tables.categories) &&
    Array.isArray(candidate.tables.accountCategories) &&
    Array.isArray(candidate.tables.accounts) &&
    Array.isArray(candidate.tables.recurringTransactions) &&
    Array.isArray(candidate.tables.transactions) &&
    Array.isArray(candidate.tables.budgets) &&
    typeof candidate.images === 'object' &&
    candidate.images !== null
  );
}

/**
 * Replaces all data on the device with the contents of the given backup file, including
 * restoring attached images. IDs are remapped during re-insertion, so foreign keys (including
 * transfer pairs) are relinked to their new rows.
 */
export async function restoreBackupFromFile(db: Database, fileUri: string): Promise<void> {
  const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

  let backup: unknown;
  try {
    backup = JSON.parse(content);
  } catch {
    throw new Error('This file is not a valid expense tracker backup.');
  }
  if (!isBackupFile(backup)) {
    throw new Error('This file is not a valid expense tracker backup.');
  }

  const imageDir = `${FileSystem.documentDirectory}backup-images/`;
  await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true }).catch(() => {});

  const uriMap = new Map<string, string>();
  let imageIndex = 0;
  for (const [oldUri, image] of Object.entries(backup.images)) {
    const newUri = `${imageDir}restored-${Date.now()}-${imageIndex}.${image.extension}`;
    await FileSystem.writeAsStringAsync(newUri, image.data, { encoding: FileSystem.EncodingType.Base64 });
    uriMap.set(oldUri, newUri);
    imageIndex += 1;
  }

  await db.transaction(async (tx) => {
    // Delete children before parents so foreign key constraints stay satisfied.
    await tx.delete(transactions);
    await tx.delete(budgets);
    await tx.delete(recurringTransactions);
    await tx.delete(accounts);
    await tx.delete(accountCategories);
    await tx.delete(categories);

    const categoryIdMap = new Map<number, number>();
    for (const { id, ...rest } of backup.tables.categories) {
      const [inserted] = await tx.insert(categories).values(rest).returning();
      categoryIdMap.set(id, inserted.id);
    }

    const accountCategoryIdMap = new Map<number, number>();
    for (const { id, ...rest } of backup.tables.accountCategories) {
      const [inserted] = await tx.insert(accountCategories).values(rest).returning();
      accountCategoryIdMap.set(id, inserted.id);
    }

    const accountIdMap = new Map<number, number>();
    for (const { id, categoryId, qrImageUri, ...rest } of backup.tables.accounts) {
      const [inserted] = await tx
        .insert(accounts)
        .values({
          ...rest,
          categoryId: accountCategoryIdMap.get(categoryId) ?? categoryId,
          qrImageUri: qrImageUri ? uriMap.get(qrImageUri) ?? qrImageUri : null,
        })
        .returning();
      accountIdMap.set(id, inserted.id);
    }

    const recurringIdMap = new Map<number, number>();
    for (const { id, categoryId, ...rest } of backup.tables.recurringTransactions) {
      const [inserted] = await tx
        .insert(recurringTransactions)
        .values({
          ...rest,
          categoryId: categoryId != null ? categoryIdMap.get(categoryId) ?? null : null,
        })
        .returning();
      recurringIdMap.set(id, inserted.id);
    }

    for (const { id, categoryId, ...rest } of backup.tables.budgets) {
      await tx.insert(budgets).values({
        ...rest,
        categoryId: categoryIdMap.get(categoryId) ?? categoryId,
      });
    }

    const transactionIdMap = new Map<number, number>();
    const transferPairs: { newId: number; oldTransferId: number }[] = [];
    for (const { id, categoryId, accountId, recurringId, receiptImageUri, transferId, ...rest } of backup.tables
      .transactions) {
      const [inserted] = await tx
        .insert(transactions)
        .values({
          ...rest,
          categoryId: categoryId != null ? categoryIdMap.get(categoryId) ?? null : null,
          accountId: accountId != null ? accountIdMap.get(accountId) ?? null : null,
          recurringId: recurringId != null ? recurringIdMap.get(recurringId) ?? null : null,
          receiptImageUri: receiptImageUri ? uriMap.get(receiptImageUri) ?? receiptImageUri : null,
          transferId: null,
        })
        .returning();
      transactionIdMap.set(id, inserted.id);
      if (transferId != null) transferPairs.push({ newId: inserted.id, oldTransferId: transferId });
    }

    for (const { newId, oldTransferId } of transferPairs) {
      const newTransferId = transactionIdMap.get(oldTransferId);
      if (newTransferId != null) {
        await tx.update(transactions).set({ transferId: newTransferId }).where(eq(transactions.id, newId));
      }
    }
  });
}
