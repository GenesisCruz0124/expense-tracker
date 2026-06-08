import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import type { TransactionWithCategory } from '../db/queries/transactions';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate } from '../utils/dateRanges';
import { CategoryBadge, UncategorizedBadge } from './CategoryBadge';

interface Props {
  transaction: TransactionWithCategory;
  onPress: () => void;
}

export function TransactionListItem({ transaction, onPress }: Props) {
  const isIncome = transaction.type === 'income';
  const amountColor = isIncome ? PALETTE.income : PALETTE.expense;
  const sign = isIncome ? '+' : '−';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.main}>
        {transaction.categoryName ? (
          <CategoryBadge name={transaction.categoryName} color={transaction.categoryColor ?? PALETTE.textSecondary} icon={transaction.categoryIcon} />
        ) : (
          <UncategorizedBadge />
        )}
        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatDisplayDate(transaction.occurredAt)}</Text>
          {transaction.accountName ? <Text style={styles.accountLabel}>· {transaction.accountName}</Text> : null}
          {transaction.recurringId ? <Text style={styles.recurringBadge}>↻ recurring</Text> : null}
        </View>
        {transaction.note ? (
          <Text style={styles.note} numberOfLines={1}>
            {transaction.note}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {sign}
        {formatCurrency(transaction.amount)}
      </Text>
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
  note: { fontSize: 13, color: PALETTE.textPrimary },
  amount: { fontSize: 15, fontWeight: '700' },
});
