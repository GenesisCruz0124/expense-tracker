import React from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate } from '../utils/dateRanges';

const FREQUENCY_UNIT: Record<'weekly' | 'monthly', string> = { weekly: 'week', monthly: 'month' };

export default function RecurringTransactionsScreen() {
  const navigation = useNavigation();
  const { rules, setActive } = useRecurringTransactions();

  return (
    <View style={styles.screen}>
      <Text style={styles.note}>
        Recurring entries are generated when you open the app — catching up on anything due since your last visit.
      </Text>
      <FlatList
        data={rules}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={rules.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="↻"
            title="No recurring transactions"
            message="Add rent, salary, or subscriptions to log them automatically."
          />
        }
        renderItem={({ item }) => {
          const isIncome = item.type === 'income';
          // One-time bills are modeled as a rule whose end date equals its start date — see AddBillScreen.
          const isOneTime = item.endDate != null && item.endDate === item.startDate;
          const unit = FREQUENCY_UNIT[item.frequency];
          const cadence = isOneTime
            ? 'One-time'
            : item.intervalCount === 1
              ? `Every ${unit}`
              : `Every ${item.intervalCount} ${unit}s`;
          return (
            <Pressable
              style={[styles.card, !item.isActive && styles.cardInactive]}
              onPress={() => navigation.navigate('AddEditRecurring', { recurringId: item.id })}
            >
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{item.note || (isIncome ? 'Income' : 'Expense')}</Text>
                <Text style={styles.cardSubtitle}>
                  {cadence} · Next: {formatDisplayDate(item.nextRunDate)}
                </Text>
              </View>
              <Text style={[styles.cardAmount, { color: isIncome ? PALETTE.income : PALETTE.expense }]}>
                {isIncome ? '+' : '−'}
                {formatCurrency(item.amount)}
              </Text>
              <Switch
                value={item.isActive}
                onValueChange={(value) => setActive(item.id, value)}
                trackColor={{ true: PALETTE.net }}
              />
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditRecurring')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  note: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
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
  cardInactive: { opacity: 0.55 },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  cardSubtitle: { fontSize: 12, color: PALETTE.textSecondary },
  cardAmount: { fontSize: 14, fontWeight: '700' },
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
