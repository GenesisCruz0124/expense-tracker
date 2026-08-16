import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { TransactionWithCategory } from '../db/queries/transactions';
import { fromMinorUnits } from './currency';

/**
 * Wraps a value for CSV. Always quoting keeps commas, quotes, and newlines inside notes or
 * establishment names from breaking the column layout.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

const COLUMNS = [
  'Date',
  'Type',
  'Category',
  'Account',
  'Establishment',
  'Note',
  'Amount',
  'Fee',
  'Counts as expense',
] as const;

/**
 * Renders transactions as CSV, which both Excel and Google Sheets open directly.
 *
 * Amounts are written as plain decimals with no currency symbol or thousands separator so
 * spreadsheets read them as numbers rather than text. Transfers are labelled as such since their
 * two legs would otherwise look like an unrelated expense and income pair.
 */
export function buildTransactionsCsv(transactions: TransactionWithCategory[]): string {
  const header = COLUMNS.map(csvCell).join(',');
  const rows = transactions.map((transaction) => {
    const type = transaction.transferId != null ? 'Transfer' : transaction.type === 'income' ? 'Income' : 'Expense';
    return [
      csvCell(transaction.occurredAt),
      csvCell(type),
      csvCell(transaction.categoryName ?? 'Uncategorized'),
      csvCell(transaction.accountName ?? ''),
      csvCell(transaction.establishment ?? ''),
      csvCell(transaction.note ?? ''),
      fromMinorUnits(transaction.amount).toFixed(2),
      fromMinorUnits(transaction.fee ?? 0).toFixed(2),
      csvCell(transaction.excludeFromExpense ? 'No' : 'Yes'),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

/** Writes the CSV to a cache file named for its period and returns the URI. */
export async function writeCsvFile(csv: string, label: string): Promise<string> {
  const safeLabel = label.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const fileUri = `${FileSystem.cacheDirectory}expense-report-${safeLabel}.csv`;
  // Excel needs a BOM to read UTF-8 correctly, otherwise ₱ and accented names come out garbled.
  await FileSystem.writeAsStringAsync(fileUri, `﻿${csv}`, { encoding: FileSystem.EncodingType.UTF8 });
  return fileUri;
}

/** Opens the native share sheet so the report can be saved or sent to Sheets/Drive/email. */
export async function shareCsvFile(fileUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export report',
    UTI: 'public.comma-separated-values-text',
  });
}
