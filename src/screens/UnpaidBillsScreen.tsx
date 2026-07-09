import React, { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInCalendarDays, parseISO } from 'date-fns';

import { CategoryBadge, UncategorizedBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { BillWithDetails } from '../db/queries/bills';
import { useBills } from '../hooks/useBills';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, formatIsoDate } from '../utils/dateRanges';
import { frequencyLabelFor } from '../utils/bills';

export default function UnpaidBillsScreen() {
  const navigation = useNavigation();
  const { bills, payBill } = useBills();
  const unpaidBills = useMemo(() => bills.filter((bill) => !bill.isPaid), [bills]);

  const totalUpcoming = useMemo(() => unpaidBills.reduce((sum, bill) => sum + bill.amount, 0), [unpaidBills]);

  const overdueCount = useMemo(
    () => unpaidBills.filter((bill) => differenceInCalendarDays(parseISO(bill.dueDate), new Date()) < 0).length,
    [unpaidBills],
  );

  function handleMarkPaid(bill: BillWithDetails) {
    Alert.alert(
      'Mark as paid?',
      `This logs a ${formatCurrency(bill.amount)} expense dated today for "${bill.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark paid', onPress: () => payBill(bill.id, formatIsoDate(new Date())) },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={unpaidBills}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={unpaidBills.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          unpaidBills.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total upcoming</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalUpcoming)}</Text>
              <Text style={styles.summaryCount}>
                {unpaidBills.length} {unpaidBills.length === 1 ? 'bill' : 'bills'}
                {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="🧾"
            title="No bills yet"
            message="Add an upcoming bill to track it here and get reminded before it's due."
          />
        }
        renderItem={({ item }) => {
          const daysUntilDue = differenceInCalendarDays(parseISO(item.dueDate), new Date());
          const isOverdue = daysUntilDue < 0;
          const dueLabel = isOverdue ? `Overdue · due ${formatDisplayDate(item.dueDate)}` : `Due ${formatDisplayDate(item.dueDate)}`;
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
                <Text style={[styles.cardSubtitle, isOverdue && styles.cardSubtitleOverdue]}>{dueLabel}</Text>
                {frequencyLabel ? <Text style={styles.cardFrequency}>{frequencyLabel}</Text> : null}
              </View>
              <View style={styles.cardTrailing}>
                <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
                <Pressable style={styles.payButton} onPress={() => handleMarkPaid(item)}>
                  <Text style={styles.payButtonText}>Mark paid</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditBill')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
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
  summaryCard: {
    backgroundColor: PALETTE.expense,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 4,
    alignItems: 'center',
    gap: 2,
  },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryAmount: { fontSize: 28, fontWeight: '700', color: '#fff' },
  summaryCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  cardMain: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  cardSubtitle: { fontSize: 12, color: PALETTE.textSecondary },
  cardSubtitleOverdue: { color: PALETTE.danger, fontWeight: '700' },
  cardFrequency: { fontSize: 11, fontWeight: '600', color: PALETTE.net },
  cardTrailing: { alignItems: 'flex-end', gap: 8 },
  cardAmount: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  payButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: `${PALETTE.net}1A`,
  },
  payButtonText: { fontSize: 12, fontWeight: '700', color: PALETTE.net },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PALETTE.net,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
});
