import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import type { TransactionWithCategory } from '../db/queries/transactions';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate } from '../utils/dateRanges';
import { CategoryBadge, TransferBadge, UncategorizedBadge } from './CategoryBadge';

interface Props {
  transaction: TransactionWithCategory;
  onPress: () => void;
  runningBalance?: number;
}

export function TransactionListItem({ transaction, onPress, runningBalance }: Props) {
  const isTransfer = transaction.transferId != null;
  const isIncome = transaction.type === 'income';
  const amountColor = isTransfer ? PALETTE.net : isIncome ? PALETTE.income : PALETTE.expense;
  const sign = isIncome ? '+' : '−';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.main}>
        {isTransfer ? (
          <TransferBadge />
        ) : transaction.categoryName ? (
          <CategoryBadge name={transaction.categoryName} color={transaction.categoryColor ?? PALETTE.textSecondary} icon={transaction.categoryIcon} />
        ) : (
          <UncategorizedBadge />
        )}
        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatDisplayDate(transaction.occurredAt)}</Text>
          {transaction.accountName ? <Text style={styles.accountLabel}>· {transaction.accountName}</Text> : null}
          {transaction.recurringId ? <Text style={styles.recurringBadge}>↻ recurring</Text> : null}
        </View>
        {transaction.establishment ? (
          <Text style={styles.establishment} numberOfLines={1}>
            {transaction.establishment}
          </Text>
        ) : null}
        {transaction.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
      </View>
      <View style={styles.amountGroup}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {sign}
          {formatCurrency(transaction.amount)}
        </Text>
        {transaction.fee ? <Text style={styles.fee}>+{formatCurrency(transaction.fee)} fee</Text> : null}
        {runningBalance !== undefined ? <Text style={styles.runningBalance}>Bal {formatCurrency(runningBalance)}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: PALETTE.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
    gap: 12,
  },
  rowPressed: { backgroundColor: PALETTE.background },
  main: { flex: 1, gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { fontSize: 12, color: PALETTE.textSecondary },
  accountLabel: { fontSize: 12, color: PALETTE.textSecondary },
  recurringBadge: { fontSize: 11, color: PALETTE.textSecondary, fontStyle: 'italic' },
  establishment: { fontSize: 13, fontWeight: '600', color: PALETTE.textPrimary },
  note: { fontSize: 13, color: PALETTE.textPrimary },
  amountGroup: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  fee: { fontSize: 11, color: PALETTE.textSecondary },
  runningBalance: { fontSize: 11, color: PALETTE.net, fontWeight: '600' },
});
