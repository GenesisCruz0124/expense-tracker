import React, { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { PALETTE } from '../constants/colors';
import type { AccountWithBalance } from '../db/queries/accounts';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, monthKeyFor } from '../utils/dateRanges';

const FREQUENCY_UNIT: Record<'weekly' | 'monthly', string> = { weekly: 'week', monthly: 'month' };

export default function RecurringTransactionsScreen() {
  const navigation = useNavigation();
  const { rules, setActive } = useRecurringTransactions();
  const { accounts, markMonthlyDuePaid } = useAccounts();
  const { accountCategories } = useAccountCategories();
  const currentMonthKey = monthKeyFor(new Date());

  const loanAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (account.monthlyAmountDue == null) return false;
        if (account.monthlyDueLastPaidMonth === currentMonthKey) return false;
        const category = accountCategories.find((item) => item.id === account.categoryId);
        return category?.kind === 'credit_card';
      }),
    [accounts, accountCategories, currentMonthKey],
  );

  const totalLoanDue = useMemo(
    () => loanAccounts.reduce((sum, account) => sum + (account.monthlyAmountDue ?? 0), 0),
    [loanAccounts],
  );

  function handleMarkPaid(account: AccountWithBalance) {
    Alert.alert('Mark as paid?', `This hides "${account.name}" from Recurring until next month.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark paid', onPress: () => markMonthlyDuePaid(account.id, currentMonthKey) },
    ]);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.note}>
        Recurring entries are generated when you open the app — catching up on anything due since your last visit.
      </Text>
      <FlatList
        data={rules}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={
          rules.length === 0 && loanAccounts.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListHeaderComponent={
          loanAccounts.length > 0 ? (
            <View style={styles.loanSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Loan & credit card dues</Text>
                <Text style={styles.sectionTotal}>Total {formatCurrency(totalLoanDue)}</Text>
              </View>
              {loanAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('AddEditAccount', { accountId: account.id })}
                >
                  <View style={[styles.avatar, { backgroundColor: `${account.color}1A` }]}>
                    <Text style={styles.avatarIcon}>{account.icon ?? DEFAULT_ACCOUNT_ICON}</Text>
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardTitle}>{account.name}</Text>
                    <Text style={styles.cardSubtitle}>Due every month</Text>
                  </View>
                  <View style={styles.loanAmountColumn}>
                    <Text style={[styles.cardAmount, { color: PALETTE.expense }]}>
                      {formatCurrency(account.monthlyAmountDue!)}
                    </Text>
                    <Pressable
                      style={styles.markPaidButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleMarkPaid(account);
                      }}
                    >
                      <Text style={styles.markPaidText}>Mark paid</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
              <Text style={styles.sectionTitle}>Recurring transactions</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="↻"
            title="No recurring transactions"
            message="Add rent, salary, or subscriptions to log them automatically."
          />
        }
        renderItem={({ item }) => {
          const isIncome = item.type === 'income';
          // One-time bills are modeled as a rule whose end date equals its start date — see AddEditRecurringScreen.
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
  loanSection: { gap: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionTotal: { fontSize: 12, fontWeight: '700', color: PALETTE.expense },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 18 },
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
  loanAmountColumn: { alignItems: 'flex-end', gap: 6 },
  markPaidButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${PALETTE.net}1A`,
  },
  markPaidText: { fontSize: 11, fontWeight: '700', color: PALETTE.net },
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
