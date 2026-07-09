import React, { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { CategoryBadge, UncategorizedBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { BillWithDetails } from '../db/queries/bills';
import { useBills } from '../hooks/useBills';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, monthRangeFor } from '../utils/dateRanges';
import { frequencyLabelFor } from '../utils/bills';

export default function PaidBillsScreen() {
  const navigation = useNavigation();
  const { bills, unpayBill } = useBills();

  const paidThisMonth = useMemo(() => {
    const { start, end } = monthRangeFor(new Date());
    return bills
      .filter((bill) => bill.lastPaidAt != null && bill.lastPaidAt >= start && bill.lastPaidAt <= end)
      .sort((a, b) => b.lastPaidAt!.localeCompare(a.lastPaidAt!));
  }, [bills]);

  function handleMarkUnpaid(bill: BillWithDetails) {
    Alert.alert(
      'Mark as unpaid?',
      'This removes the transaction that was logged when this bill was marked paid.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark unpaid', style: 'destructive', onPress: () => unpayBill(bill.id) },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={paidThisMonth}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={paidThisMonth.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="✅"
            title="Nothing paid yet this month"
            message="Bills you mark as paid from the Upcoming tab will show up here."
          />
        }
        renderItem={({ item }) => {
          const frequencyLabel = frequencyLabelFor(item);
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate('AddEditBill', { billId: item.id })}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.categoryName ? (
                  <CategoryBadge name={item.categoryName} color={item.categoryColor ?? PALETTE.textSecondary} icon={item.categoryIcon} />
                ) : (
                  <UncategorizedBadge />
                )}
                {item.accountName ? (
                  <View style={styles.accountRow}>
                    <View style={[styles.accountDot, { backgroundColor: item.accountColor ?? PALETTE.textSecondary }]} />
                    <Text style={styles.accountName}>{item.accountName}</Text>
                  </View>
                ) : null}
                <Text style={styles.cardSubtitle}>Paid {formatDisplayDate(item.lastPaidAt!)}</Text>
                {frequencyLabel ? <Text style={styles.cardFrequency}>{frequencyLabel}</Text> : null}
              </View>
              <View style={styles.cardTrailing}>
                <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
                {item.frequency === 'once' ? (
                  <Pressable style={styles.undoButton} onPress={() => handleMarkUnpaid(item)}>
                    <Text style={styles.undoButtonText}>Undo</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardMain: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  cardSubtitle: { fontSize: 12, color: PALETTE.textSecondary },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  accountName: { fontSize: 12, color: PALETTE.textSecondary, fontWeight: '600' },
  cardFrequency: { fontSize: 11, fontWeight: '600', color: PALETTE.net },
  cardTrailing: { alignItems: 'flex-end', gap: 8 },
  cardAmount: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  undoButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: `${PALETTE.textSecondary}1A`,
  },
  undoButtonText: { fontSize: 12, fontWeight: '700', color: PALETTE.textSecondary },
});
