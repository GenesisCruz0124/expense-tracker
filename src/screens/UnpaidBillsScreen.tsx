import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInCalendarDays, parseISO } from 'date-fns';

import { CategoryBadge, UncategorizedBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { BillFrequency, BillWithDetails } from '../db/queries/bills';
import { useBills } from '../hooks/useBills';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, formatIsoDate } from '../utils/dateRanges';

const FREQUENCY_LABELS: Record<BillFrequency, string | null> = {
  once: null,
  weekly: 'Repeats weekly',
  semi_monthly: 'Repeats semi-monthly',
  monthly: 'Repeats monthly',
  yearly: 'Repeats yearly',
};

export default function UnpaidBillsScreen() {
  const navigation = useNavigation();
  const { bills, payBill, unpayBill } = useBills();

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
        data={bills}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={bills.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="🧾"
            title="No bills yet"
            message="Add an upcoming bill to track it here and get reminded before it's due."
          />
        }
        renderItem={({ item }) => {
          const daysUntilDue = differenceInCalendarDays(parseISO(item.dueDate), new Date());
          const isOverdue = !item.isPaid && daysUntilDue < 0;
          const dueLabel = item.isPaid
            ? `Paid · was due ${formatDisplayDate(item.dueDate)}`
            : isOverdue
              ? `Overdue · due ${formatDisplayDate(item.dueDate)}`
              : `Due ${formatDisplayDate(item.dueDate)}`;
          const frequencyLabel = FREQUENCY_LABELS[item.frequency];
          return (
            <Pressable
              style={[styles.card, item.isPaid && styles.cardPaid]}
              onPress={() => navigation.navigate('AddEditBill', { billId: item.id })}
            >
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
                <Pressable
                  style={[styles.payButton, item.isPaid && styles.payButtonPaid]}
                  onPress={() => (item.isPaid ? handleMarkUnpaid(item) : handleMarkPaid(item))}
                >
                  <Text style={[styles.payButtonText, item.isPaid && styles.payButtonTextPaid]}>
                    {item.isPaid ? 'Undo' : 'Mark paid'}
                  </Text>
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
  cardPaid: { opacity: 0.55 },
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
  payButtonPaid: { backgroundColor: `${PALETTE.textSecondary}1A` },
  payButtonText: { fontSize: 12, fontWeight: '700', color: PALETTE.net },
  payButtonTextPaid: { color: PALETTE.textSecondary },
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
