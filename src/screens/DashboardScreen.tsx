import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInCalendarDays, isSameDay, isSameMonth, isSameWeek } from 'date-fns';

import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { DateField } from '../components/DateField';
import { EmptyState } from '../components/EmptyState';
import { MonthSelector } from '../components/MonthSelector';
import { PeriodTypeSelector } from '../components/PeriodTypeSelector';
import { SummaryCard } from '../components/SummaryCard';
import { PALETTE } from '../constants/colors';
import type { BillWithDetails } from '../db/queries/bills';
import { useBills } from '../hooks/useBills';
import { useReportsData } from '../hooks/useReportsData';
import { formatCurrency } from '../utils/currency';
import {
  customRangeFor,
  dayRangeFor,
  formatDisplayDate,
  formatIsoDate,
  monthRangeFor,
  parseIsoDate,
  shiftDay,
  shiftMonth,
  shiftWeek,
  weekRangeFor,
  type PeriodType,
} from '../utils/dateRanges';

/** A bill is "due soon" once it lands within this many days — flagged amber instead of neutral. */
const DUE_SOON_THRESHOLD_DAYS = 3;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM-DD' → 'August 2026'. Parsed off the string so it stays timezone-independent. */
function monthLabelFor(isoDate: string): string {
  const [year, month] = isoDate.split('-');
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

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

function billStatusFor(bill: BillWithDetails, today: Date): BillStatus {
  if (bill.isPaid) return { tone: 'paid', label: 'Paid' };

  const daysUntil = differenceInCalendarDays(parseIsoDate(bill.dueDate), today);
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
  const [period, setPeriod] = useState<PeriodType>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [customRange, setCustomRange] = useState(() => ({ start: new Date(), end: new Date() }));

  const range =
    period === 'custom'
      ? customRangeFor(customRange.start, customRange.end)
      : period === 'day'
        ? dayRangeFor(anchorDate)
        : period === 'week'
          ? weekRangeFor(anchorDate)
          : monthRangeFor(anchorDate);

  const today = new Date();
  const nextDisabled =
    period === 'day'
      ? isSameDay(anchorDate, today)
      : period === 'week'
        ? isSameWeek(anchorDate, today, { weekStartsOn: 1 })
        : isSameMonth(anchorDate, today);

  function shiftAnchor(delta: number) {
    setAnchorDate((current) => {
      if (period === 'day') return shiftDay(current, delta);
      if (period === 'week') return shiftWeek(current, delta);
      return shiftMonth(current, delta);
    });
  }

  const { totals, categoryData, loading, refresh } = useReportsData(range, 6);
  const { bills } = useBills();

  const net = totals.income - totals.expense;
  const upcomingBills = bills.filter((bill) => !bill.isPaid);
  const upcomingBillsTotal = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);

  // `listBills` already orders unpaid bills by due date, so a single pass yields months in order.
  const upcomingBillMonths = useMemo(() => {
    const sections: { key: string; title: string; total: number; data: BillWithDetails[] }[] = [];
    const byMonth = new Map<string, (typeof sections)[number]>();
    for (const bill of upcomingBills) {
      const key = bill.dueDate.slice(0, 7);
      let section = byMonth.get(key);
      if (!section) {
        section = { key, title: monthLabelFor(bill.dueDate), total: 0, data: [] };
        byMonth.set(key, section);
        sections.push(section);
      }
      section.total += bill.amount;
      section.data.push(bill);
    }
    return sections;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={PALETTE.net} />}
    >
      <PeriodTypeSelector value={period} onChange={setPeriod} />

      {period === 'custom' ? (
        <View style={styles.customRangeRow}>
          <View style={styles.customRangeField}>
            <DateField
              label="From"
              value={formatIsoDate(customRange.start)}
              onChangeText={(text) => setCustomRange((current) => ({ ...current, start: parseIsoDate(text) }))}
            />
          </View>
          <View style={styles.customRangeField}>
            <DateField
              label="Until"
              value={formatIsoDate(customRange.end)}
              onChangeText={(text) => setCustomRange((current) => ({ ...current, end: parseIsoDate(text) }))}
            />
          </View>
        </View>
      ) : (
        <MonthSelector
          label={range.label}
          onPrevious={() => shiftAnchor(-1)}
          onNext={() => shiftAnchor(1)}
          nextDisabled={nextDisabled}
        />
      )}

      <View style={styles.summaryRow}>
        <SummaryCard
          label="Income"
          amount={totals.income}
          tone="income"
          onPress={() =>
            navigation.navigate('Tabs', {
              screen: 'TransactionsTab',
              params: { screen: 'TransactionsList', params: { type: 'income', start: range.start, end: range.end } },
            })
          }
        />
        <SummaryCard
          label="Expense"
          amount={totals.expense}
          tone="expense"
          onPress={() =>
            navigation.navigate('Tabs', {
              screen: 'TransactionsTab',
              params: { screen: 'TransactionsList', params: { type: 'expense', start: range.start, end: range.end } },
            })
          }
        />
        <SummaryCard
          label="Net"
          amount={net}
          tone="net"
          onPress={() =>
            navigation.navigate('Tabs', {
              screen: 'TransactionsTab',
              params: { screen: 'TransactionsList', params: { start: range.start, end: range.end, runningBalance: true } },
            })
          }
        />
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
          <Text style={styles.sectionTitle}>
            Upcoming bills {upcomingBills.length > 0 ? `(${upcomingBills.length}) −${formatCurrency(upcomingBillsTotal)}` : ''}
          </Text>
          <View style={styles.sectionHeaderActions}>
            <Pressable onPress={() => navigation.navigate('AddEditBill')}>
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
          <View style={styles.monthGroups}>
            {upcomingBillMonths.map((section) => (
              <View key={section.key} style={styles.monthGroup}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthTitle}>{section.title}</Text>
                  <View style={styles.monthSummary}>
                    <Text style={styles.monthCount}>
                      {section.data.length} {section.data.length === 1 ? 'bill' : 'bills'}
                    </Text>
                    <Text style={styles.monthTotal}>−{formatCurrency(section.total)}</Text>
                  </View>
                </View>
                <View style={styles.list}>
                  {section.data.map((bill) => {
                    const status = billStatusFor(bill, today);
                    return (
                      <View key={bill.id} style={styles.listRow}>
                        <View style={styles.listRowMain}>
                          <Text style={styles.listRowTitle}>{bill.name}</Text>
                          <View style={styles.billMetaRow}>
                            <Text style={styles.listRowSubtitle}>Due {formatDisplayDate(bill.dueDate)}</Text>
                            <View style={[styles.billStatusBadge, { backgroundColor: `${BILL_STATUS_COLOR[status.tone]}1A` }]}>
                              <Text style={[styles.billStatusText, { color: BILL_STATUS_COLOR[status.tone] }]}>{status.label}</Text>
                            </View>
                          </View>
                        </View>
                        <Text style={[styles.listRowAmount, { color: PALETTE.expense }]}>−{formatCurrency(bill.amount)}</Text>
                      </View>
                    );
                  })}
                </View>
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
  customRangeRow: { flexDirection: 'row', gap: 12 },
  customRangeField: { flex: 1 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary },
  sectionLink: { fontSize: 13, fontWeight: '600', color: PALETTE.net },
  list: { gap: 4, backgroundColor: PALETTE.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: PALETTE.border },
  monthGroups: { gap: 16 },
  monthGroup: { gap: 8 },
  monthHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  monthTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  monthSummary: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  monthCount: { fontSize: 12, color: PALETTE.textSecondary },
  monthTotal: { fontSize: 13, fontWeight: '700', color: PALETTE.expense },
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
