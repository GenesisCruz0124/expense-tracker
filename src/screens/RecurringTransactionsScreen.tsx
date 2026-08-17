import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AccountIcon } from '../components/AccountIcon';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { AccountWithBalance } from '../db/queries/accounts';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, formatIsoDate, monthKeyFor, parseIsoDate } from '../utils/dateRanges';
import { monthlyDueDateFor, ordinal } from '../utils/monthlyDue';

const FREQUENCY_UNIT: Record<'weekly' | 'monthly', string> = { weekly: 'week', monthly: 'month' };
const MONTHLY_FACTOR: Record<'weekly' | 'monthly', number> = { weekly: 52 / 12, monthly: 1 };

export default function RecurringTransactionsScreen() {
  const navigation = useNavigation();
  const { rules, setActive, markPaid } = useRecurringTransactions();
  const { accounts, markMonthlyDuePaid, incrementBalance } = useAccounts();
  const { accountCategories } = useAccountCategories();
  const currentMonthKey = monthKeyFor(new Date());
  const [searchText, setSearchText] = useState('');
  const searchQ = searchText.trim().toLowerCase();

  const creditCardAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (account.monthlyAmountDue == null) return false;
        if (account.monthlyDueLastPaidMonth === currentMonthKey) return false;
        const category = accountCategories.find((item) => item.id === account.categoryId);
        if (category?.kind !== 'credit_card' || account.linkedCreditCardId == null) return false;
        return !searchQ || account.name.toLowerCase().includes(searchQ);
      }),
    [accounts, accountCategories, currentMonthKey, searchQ],
  );

  const loanAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (account.monthlyAmountDue == null) return false;
        if (account.monthlyDueLastPaidMonth === currentMonthKey) return false;
        const category = accountCategories.find((item) => item.id === account.categoryId);
        if (category?.kind !== 'credit_card' || account.linkedCreditCardId != null) return false;
        return !searchQ || account.name.toLowerCase().includes(searchQ);
      }),
    [accounts, accountCategories, currentMonthKey, searchQ],
  );

  const totalCreditCardDue = useMemo(
    () => creditCardAccounts.reduce((sum, account) => sum + (account.monthlyAmountDue ?? 0), 0),
    [creditCardAccounts],
  );

  const totalLoanDue = useMemo(
    () => loanAccounts.reduce((sum, account) => sum + (account.monthlyAmountDue ?? 0), 0),
    [loanAccounts],
  );

  const investmentAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (account.monthlyContribution == null) return false;
        const category = accountCategories.find((item) => item.id === account.categoryId);
        if (category?.kind !== 'investment') return false;
        if (!account.balanceLastUpdatedAt) return !searchQ || account.name.toLowerCase().includes(searchQ);
        if (monthKeyFor(parseIsoDate(account.balanceLastUpdatedAt)) === currentMonthKey) return false;
        return !searchQ || account.name.toLowerCase().includes(searchQ);
      }),
    [accounts, accountCategories, currentMonthKey, searchQ],
  );

  const totalInvestmentContribution = useMemo(
    () => investmentAccounts.reduce((sum, account) => sum + (account.monthlyContribution ?? 0), 0),
    [investmentAccounts],
  );

  const totalInvestmentBalance = useMemo(
    () => investmentAccounts.reduce((sum, account) => sum + account.balance, 0),
    [investmentAccounts],
  );

  // Every investment account, not just those still due this month, so the post-contribution
  // summary can report the full portfolio rather than the shrinking "still due" list.
  const allInvestmentBalance = useMemo(
    () =>
      accounts.reduce((sum, account) => {
        const category = accountCategories.find((item) => item.id === account.categoryId);
        return category?.kind === 'investment' ? sum + account.balance : sum;
      }, 0),
    [accounts, accountCategories],
  );

  /**
   * `paymentSource` is free text captured when the source was chosen, so it goes stale if the
   * account is later renamed. Resolve the live name through `paymentSourceAccountId` first and
   * only fall back to the stored text for untracked sources like a salary deduction.
   */
  function paymentSourceLabel(account: AccountWithBalance): string | null {
    if (account.paymentSourceAccountId != null) {
      const source = accounts.find((item) => item.id === account.paymentSourceAccountId);
      if (source) return source.name;
    }
    return account.paymentSource?.trim() || null;
  }

  function groupBySource(list: AccountWithBalance[], amountOf: (account: AccountWithBalance) => number) {
    const byLabel = new Map<string, { label: string; total: number; data: AccountWithBalance[] }>();
    for (const account of list) {
      const label = paymentSourceLabel(account) || 'Salary deduction';
      let group = byLabel.get(label);
      if (!group) {
        group = { label, total: 0, data: [] };
        byLabel.set(label, group);
      }
      group.total += amountOf(account);
      group.data.push(account);
    }
    return Array.from(byLabel.values()).sort((a, b) => {
      if (a.label === 'Salary deduction') return -1;
      if (b.label === 'Salary deduction') return 1;
      return a.label.localeCompare(b.label);
    });
  }

  const creditCardGroups = useMemo(
    () => groupBySource(creditCardAccounts, (a) => a.monthlyAmountDue ?? 0),
    [creditCardAccounts],
  );
  const loanGroups = useMemo(() => groupBySource(loanAccounts, (a) => a.monthlyAmountDue ?? 0), [loanAccounts]);
  const investmentGroups = useMemo(
    () => groupBySource(investmentAccounts, (a) => a.monthlyContribution ?? 0),
    [investmentAccounts],
  );

  const { recurringMonthlyIncome, recurringMonthlyExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const rule of rules) {
      if (!rule.isActive) continue;
      const isOneTime = rule.endDate != null && rule.endDate === rule.startDate;
      if (isOneTime) continue;
      const monthly = Math.round((rule.amount * MONTHLY_FACTOR[rule.frequency]) / rule.intervalCount);
      if (rule.type === 'income') {
        income += monthly;
      } else {
        expense += monthly;
      }
    }
    return { recurringMonthlyIncome: income, recurringMonthlyExpense: expense };
  }, [rules]);

  function handleMarkPaid(account: AccountWithBalance) {
    const amountDue = account.monthlyAmountDue ?? 0;
    Alert.alert('Mark as paid?', `This hides "${account.name}" from Recurring until next month.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark paid',
        onPress: async () => {
          await markMonthlyDuePaid(account.id, currentMonthKey, formatIsoDate(new Date()));
          // Derived from the pre-payment values, since the account drops off this list once paid.
          // The payment posts as income against a credit-card-kind account, reducing what is owed.
          const newBalance = account.balance - amountDue;
          const remaining = account.remainingMonths != null ? Math.max(0, account.remainingMonths - 1) : null;
          const source = accounts.find((item) => item.id === account.paymentSourceAccountId);
          Alert.alert(
            'Marked as paid',
            [
              account.name,
              ``,
              `Paid: ${formatCurrency(amountDue)}`,
              `Remaining balance: ${formatCurrency(newBalance)}`,
              `Months paid: ${account.totalMonths + 1}`,
              ...(remaining != null ? [`Months remaining: ${remaining}`] : []),
              ...(source ? [``, `From ${source.name}: ${formatCurrency(source.balance - amountDue)}`] : []),
            ].join('\n'),
          );
        },
      },
    ]);
  }

  function handleMarkRecurringPaid(item: (typeof rules)[number]) {
    const label = item.note || (item.type === 'income' ? 'Income' : 'Expense');
    Alert.alert(
      'Mark as paid?',
      `Log "${label}" for ${formatDisplayDate(item.nextRunDate)} and advance to the next occurrence.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: async () => {
            const outcome = await markPaid(item);
            const account = accounts.find((a) => a.id === item.accountId);
            const category = account
              ? accountCategories.find((c) => c.id === account.categoryId)
              : undefined;
            // Income raises a normal balance but pays down a credit card, so the sign flips by kind.
            const delta =
              category?.kind === 'credit_card'
                ? item.type === 'income'
                  ? -item.amount
                  : item.amount
                : item.type === 'income'
                  ? item.amount
                  : -item.amount;
            Alert.alert(
              'Marked as paid',
              [
                label,
                ``,
                `${item.type === 'income' ? 'Received' : 'Paid'}: ${formatCurrency(item.amount)}`,
                `Dated: ${formatDisplayDate(item.nextRunDate)}`,
                ...(account ? [`${account.name}: ${formatCurrency(account.balance + delta)}`] : []),
                ``,
                outcome?.isExhausted
                  ? 'No further occurrences — this rule is now inactive.'
                  : `Next due: ${formatDisplayDate(outcome?.nextRunDate ?? item.nextRunDate)}`,
              ].join('\n'),
            );
          },
        },
      ],
    );
  }

  function handleAddContribution(account: AccountWithBalance) {
    const contribution = account.monthlyContribution!;
    Alert.alert(
      'Add this month’s contribution?',
      `This adds ${formatCurrency(contribution)} to "${account.name}"'s balance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            await incrementBalance(account.id);
            // Derived from the pre-add values rather than re-reading, since the refreshed list
            // drops this account once it is no longer due this month.
            const newBalance = account.balance + contribution;
            const monthsAdded = account.totalMonths + 1;
            Alert.alert(
              'Contribution added',
              [
                `${account.name}`,
                ``,
                `Added: ${formatCurrency(contribution)}`,
                `New balance: ${formatCurrency(newBalance)}`,
                `Months added: ${monthsAdded}`,
                ``,
                `All investments: ${formatCurrency(allInvestmentBalance + contribution)}`,
              ].join('\n'),
            );
          },
        },
      ],
    );
  }

  const filteredRules = useMemo(
    () => (searchQ ? rules.filter((r) => (r.note ?? '').toLowerCase().includes(searchQ)) : rules),
    [rules, searchQ],
  );

  function renderDueAccountCard(account: AccountWithBalance) {
    return (
      <Pressable
        key={account.id}
        style={styles.card}
        onPress={() => navigation.navigate('AddEditAccount', { accountId: account.id })}
      >
        <View style={[styles.avatar, { backgroundColor: `${account.color}1A` }]}>
          <AccountIcon icon={account.icon} size={18} textStyle={styles.avatarIcon} />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{account.name}</Text>
          <Text style={styles.cardSubtitle}>
            Due {formatDisplayDate(monthlyDueDateFor(account.subscriptionDueDay, new Date()))}
            {account.subscriptionDueDay != null ? ` · ${ordinal(account.subscriptionDueDay)} monthly` : ' · month-end'}
          </Text>
          {account.totalMonths > 0 ? (
            <Text style={styles.totalMonthsBadge}>{account.totalMonths} {account.totalMonths === 1 ? 'month' : 'months'} paid</Text>
          ) : null}
          {account.remainingMonths != null && account.remainingMonths > 0 ? (
            <Text style={styles.remainingMonthsBadge}>{account.remainingMonths} {account.remainingMonths === 1 ? 'month' : 'months'} remaining</Text>
          ) : null}
        </View>
        <View style={styles.amountColumn}>
          <Text style={[styles.cardAmount, { color: PALETTE.expense }]}>
            {formatCurrency(account.monthlyAmountDue!)}
          </Text>
          <Pressable
            style={styles.actionButton}
            onPress={(event) => {
              event.stopPropagation();
              handleMarkPaid(account);
            }}
          >
            <Text style={styles.actionButtonText}>Mark paid</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function renderInvestmentAccountCard(account: AccountWithBalance) {
    return (
      <Pressable
        key={account.id}
        style={styles.card}
        onPress={() => navigation.navigate('AddEditAccount', { accountId: account.id })}
      >
        <View style={[styles.avatar, { backgroundColor: `${account.color}1A` }]}>
          <AccountIcon icon={account.icon} size={18} textStyle={styles.avatarIcon} />
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{account.name}</Text>
          <Text style={styles.cardSubtitle}>Balance {formatCurrency(account.balance)}</Text>
          {account.totalMonths > 0 ? (
            <Text style={styles.totalMonthsBadge}>{account.totalMonths} {account.totalMonths === 1 ? 'month' : 'months'} added</Text>
          ) : null}
        </View>
        <View style={styles.amountColumn}>
          <Text style={[styles.cardAmount, { color: PALETTE.income }]}>
            +{formatCurrency(account.monthlyContribution!)}
          </Text>
          <Pressable
            style={styles.actionButton}
            onPress={(event) => {
              event.stopPropagation();
              handleAddContribution(account);
            }}
          >
            <Text style={styles.actionButtonText}>Add to balance</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function renderSourceGroups(
    groups: { label: string; total: number; data: AccountWithBalance[] }[],
    renderCard: (account: AccountWithBalance) => React.ReactNode,
  ) {
    return groups.map((group) => (
      <View key={group.label} style={styles.sourceGroup}>
        {groups.length > 1 ? (
          <View style={styles.sourceGroupHeaderRow}>
            <Text style={styles.sourceGroupTitle}>{group.label}</Text>
            <Text style={styles.sourceGroupTotal}>{formatCurrency(group.total)}</Text>
          </View>
        ) : null}
        {group.data.map(renderCard)}
      </View>
    ));
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search recurring"
          placeholderTextColor={PALETTE.textSecondary}
          clearButtonMode="while-editing"
        />
      </View>
      <Text style={styles.note}>
        Recurring entries are generated when you open the app — catching up on anything due since your last visit.
      </Text>
      <FlatList
        data={filteredRules}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={
          filteredRules.length === 0 &&
          creditCardAccounts.length === 0 &&
          loanAccounts.length === 0 &&
          investmentAccounts.length === 0
            ? styles.emptyContainer
            : styles.listContent
        }
        ListHeaderComponent={
          <View style={styles.loanSection}>
            {creditCardAccounts.length > 0 ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Credit card dues</Text>
                  <Text style={styles.sectionTotal}>Total {formatCurrency(totalCreditCardDue)}</Text>
                </View>
                {renderSourceGroups(creditCardGroups, renderDueAccountCard)}
              </>
            ) : null}

            {loanAccounts.length > 0 ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Loan dues</Text>
                  <Text style={styles.sectionTotal}>Total {formatCurrency(totalLoanDue)}</Text>
                </View>
                {renderSourceGroups(loanGroups, renderDueAccountCard)}
              </>
            ) : null}

            {investmentAccounts.length > 0 ? (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Investment contributions</Text>
                  <View style={styles.recurringTotals}>
                    <Text style={styles.sectionTotalMuted}>Bal {formatCurrency(totalInvestmentBalance)}</Text>
                    <Text style={[styles.sectionTotal, styles.sectionTotalIncome]}>
                      +{formatCurrency(totalInvestmentContribution)}
                    </Text>
                  </View>
                </View>
                {renderSourceGroups(investmentGroups, renderInvestmentAccountCard)}
              </>
            ) : null}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recurring transactions</Text>
              <View style={styles.recurringTotals}>
                {recurringMonthlyIncome > 0 ? (
                  <Text style={[styles.sectionTotal, styles.sectionTotalIncome]}>
                    +{formatCurrency(recurringMonthlyIncome)}
                  </Text>
                ) : null}
                {recurringMonthlyExpense > 0 ? (
                  <Text style={styles.sectionTotal}>−{formatCurrency(recurringMonthlyExpense)}</Text>
                ) : null}
              </View>
            </View>
          </View>
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
            : item.frequency === 'monthly' && item.intervalCount === 12
              ? 'Every year'
              : item.intervalCount === 1
                ? `Every ${unit}`
                : `Every ${item.intervalCount} ${unit}s`;
          const showMarkPaid = item.isActive && !isOneTime && !item.isPaid;
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
              <View style={styles.amountColumn}>
                <Text style={[styles.cardAmount, { color: isIncome ? PALETTE.income : PALETTE.expense }]}>
                  {isIncome ? '+' : '−'}{formatCurrency(item.amount)}
                </Text>
                {showMarkPaid ? (
                  <Pressable
                    style={styles.actionButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleMarkRecurringPaid(item);
                    }}
                  >
                    <Text style={styles.actionButtonText}>Mark paid</Text>
                  </Pressable>
                ) : item.isPaid ? (
                  <Text style={styles.paidBadge}>✓ Paid</Text>
                ) : null}
              </View>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: PALETTE.textPrimary, paddingVertical: 10 },
  note: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 8,
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
  sectionTotalIncome: { color: PALETTE.income },
  sectionTotalMuted: { fontSize: 12, fontWeight: '700', color: PALETTE.textSecondary },
  recurringTotals: { flexDirection: 'row', gap: 10 },
  sourceGroup: { gap: 10 },
  sourceGroupHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 2 },
  sourceGroupTitle: { fontSize: 11, fontWeight: '700', color: PALETTE.textSecondary },
  sourceGroupTotal: { fontSize: 11, fontWeight: '600', color: PALETTE.textSecondary },
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
  totalMonthsBadge: { fontSize: 11, fontWeight: '600', color: PALETTE.net, marginTop: 2 },
  remainingMonthsBadge: { fontSize: 11, fontWeight: '600', color: PALETTE.expense, marginTop: 1 },
  cardAmount: { fontSize: 14, fontWeight: '700' },
  amountColumn: { alignItems: 'flex-end', gap: 6 },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: `${PALETTE.net}1A`,
  },
  actionButtonText: { fontSize: 11, fontWeight: '700', color: PALETTE.net },
  paidBadge: { fontSize: 11, fontWeight: '700', color: PALETTE.income },
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
