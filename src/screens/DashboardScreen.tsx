import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInCalendarDays, isSameMonth } from 'date-fns';

import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { EmptyState } from '../components/EmptyState';
import { MonthSelector } from '../components/MonthSelector';
import { SummaryCard } from '../components/SummaryCard';
import { PALETTE } from '../constants/colors';
import type { RecurringWithStatus } from '../db/queries/recurring';
import { useBudgets } from '../hooks/useBudgets';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { useReportsData } from '../hooks/useReportsData';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, monthRangeFor, parseIsoDate, shiftMonth } from '../utils/dateRanges';

/** A bill is "due soon" once it lands within this many days — flagged amber instead of neutral. */
const DUE_SOON_THRESHOLD_DAYS = 3;

interface BillStatus {
  tone: 'paid' | 'overdue' | 'dueSoon' | 'upcoming';
  label: string;
}

const BILL_STATUS_COLOR: Record<BillStatus['tone'], string> = {
  paid: PALETTE.income,
  overdue: PALETTE.danger,
  dueSoon: PALETTE.warning,
  upcoming: PALETTE.textSecondary,
};

function billStatusFor(rule: RecurringWithStatus, today: Date): BillStatus {
  if (rule.isPaid) return { tone: 'paid', label: 'Paid' };

  const daysUntil = differenceInCalendarDays(parseIsoDate(rule.nextRunDate), today);
  if (daysUntil < 0) {
    const overdueDays = Math.abs(daysUntil);
    return { tone: 'overdue', label: overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue` };
  }
  if (daysUntil === 0) return { tone: 'dueSoon', label: 'Due today' };
  if (daysUntil <= DUE_SOON_THRESHOLD_DAYS) {
    return { tone: 'dueSoon', label: `Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}` };
  }
  return { tone: 'upcoming', label: `In ${daysUntil} days` };
}

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const range = monthRangeFor(anchorDate);
  const isCurrentMonth = isSameMonth(anchorDate, new Date());

  const { totals, categoryData, loading, refresh } = useReportsData(anchorDate, 6);
  const { budgets } = useBudgets(range);
  const { rules } = useRecurringTransactions();

  const today = new Date();
  const net = totals.income - totals.expense;
  const upcomingBills = rules.filter((rule) => rule.isActive && rule.type === 'expense').slice(0, 3);
  const attentionBudgets = budgets
    .filter((budget) => budget.percentUsed >= budget.alertThresholdPct)
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, 3);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={PALETTE.net} />}
    >
      <MonthSelector
        label={range.label}
        onPrevious={() => setAnchorDate((current) => shiftMonth(current, -1))}
        onNext={() => setAnchorDate((current) => shiftMonth(current, 1))}
        nextDisabled={isCurrentMonth}
      />

      <View style={styles.summaryRow}>
        <SummaryCard label="Income" amount={totals.income} tone="income" />
        <SummaryCard label="Expense" amount={totals.expense} tone="expense" />
        <SummaryCard label="Net" amount={net} tone="net" />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending by category</Text>
          <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Reports' })}>
            <Text style={styles.sectionLink}>Reports →</Text>
          </Pressable>
        </View>
        <CategoryBarChart entries={categoryData.slice(0, 6)} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming bills</Text>
          <View style={styles.sectionHeaderActions}>
            <Pressable onPress={() => navigation.navigate('AddBill')}>
              <Text style={styles.sectionLink}>+ Add</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Bills' })}>
              <Text style={styles.sectionLink}>Manage →</Text>
            </Pressable>
          </View>
        </View>
        {upcomingBills.length === 0 ? (
          <EmptyState icon="↻" title="No upcoming bills" message="Set up rent, subscriptions, or other recurring expenses to track them here." />
        ) : (
          <View style={styles.list}>
            {upcomingBills.map((rule) => {
              const status = billStatusFor(rule, today);
              return (
                <View key={rule.id} style={styles.listRow}>
                  <View style={styles.listRowMain}>
                    <Text style={styles.listRowTitle}>{rule.note || 'Bill'}</Text>
                    <View style={styles.billMetaRow}>
                      <Text style={styles.listRowSubtitle}>Due {formatDisplayDate(rule.nextRunDate)}</Text>
                      <View style={[styles.billStatusBadge, { backgroundColor: `${BILL_STATUS_COLOR[status.tone]}1A` }]}>
                        <Text style={[styles.billStatusText, { color: BILL_STATUS_COLOR[status.tone] }]}>{status.label}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.listRowAmount, { color: PALETTE.expense }]}>−{formatCurrency(rule.amount)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Budgets needing attention</Text>
          <Pressable
            onPress={() =>
              navigation.navigate('Tabs', {
                screen: 'MoreTab',
                params: { screen: 'Budgets', params: { fromDashboard: true } },
              })
            }
          >
            <Text style={styles.sectionLink}>View all →</Text>
          </Pressable>
        </View>
        {attentionBudgets.length === 0 ? (
          <EmptyState icon="🎯" title="On track" message="No budgets are nearing their limits this month." />
        ) : (
          <View style={styles.list}>
            {attentionBudgets.map((budget) => (
              <View key={budget.id} style={styles.listRow}>
                <View style={styles.listRowMain}>
                  <Text style={styles.listRowTitle}>{budget.categoryName}</Text>
                  <Text style={styles.listRowSubtitle}>
                    {formatCurrency(budget.spend)} of {formatCurrency(budget.amountLimit)}
                  </Text>
                </View>
                <Text style={[styles.listRowAmount, { color: budget.percentUsed >= 100 ? PALETTE.danger : PALETTE.warning }]}>
                  {budget.percentUsed}%
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary },
  sectionLink: { fontSize: 13, fontWeight: '600', color: PALETTE.net },
  list: { gap: 4, backgroundColor: PALETTE.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: PALETTE.border },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
    gap: 12,
  },
  listRowMain: { flex: 1, gap: 2 },
  listRowTitle: { fontSize: 14, fontWeight: '600', color: PALETTE.textPrimary },
  listRowSubtitle: { fontSize: 12, color: PALETTE.textSecondary },
  listRowAmount: { fontSize: 14, fontWeight: '700' },
  billMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  billStatusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  billStatusText: { fontSize: 10, fontWeight: '700' },
});
