import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isSameDay, isSameMonth, isSameWeek } from 'date-fns';

import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { CategoryPieChart } from '../components/charts/CategoryPieChart';
import { MonthlyTotalsBarChart } from '../components/charts/MonthlyTotalsBarChart';
import { TrendLineChart } from '../components/charts/TrendLineChart';
import { DateField } from '../components/DateField';
import { MonthSelector } from '../components/MonthSelector';
import { PeriodTypeSelector } from '../components/PeriodTypeSelector';
import { SummaryCard } from '../components/SummaryCard';
import { PALETTE } from '../constants/colors';
import { useReportsData, type ReportKind, type TrendPeriod } from '../hooks/useReportsData';
import {
  customRangeFor,
  dayRangeFor,
  formatIsoDate,
  monthRangeFor,
  parseIsoDate,
  shiftDay,
  shiftMonth,
  shiftWeek,
  weekRangeFor,
  type PeriodType,
} from '../utils/dateRanges';

type BreakdownView = 'pie' | 'bar';
type TrendView = 'line' | 'bar';

function SegmentButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ReportsScreen() {
  const navigation = useNavigation();
  const [period, setPeriod] = useState<PeriodType>('month');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [customRange, setCustomRange] = useState(() => ({ start: new Date(), end: new Date() }));
  const [breakdownView, setBreakdownView] = useState<BreakdownView>('pie');
  const [trendView, setTrendView] = useState<TrendView>('line');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('monthly');

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

  const { categoryData, trend, totals, breakdownKind, setBreakdownKind } = useReportsData(range, 4, trendPeriod);
  const net = totals.income - totals.expense;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
          <Text style={styles.sectionTitle}>Breakdown by category</Text>
          <View style={styles.segmented}>
            <SegmentButton label="Pie" active={breakdownView === 'pie'} onPress={() => setBreakdownView('pie')} />
            <SegmentButton label="Bar" active={breakdownView === 'bar'} onPress={() => setBreakdownView('bar')} />
          </View>
        </View>
        <View style={styles.kindToggle}>
          {(['expense', 'income'] as ReportKind[]).map((kind) => (
            <Pressable
              key={kind}
              onPress={() => setBreakdownKind(kind)}
              style={[styles.kindChip, breakdownKind === kind && styles.kindChipSelected]}
            >
              <Text style={[styles.kindChipText, breakdownKind === kind && styles.kindChipTextSelected]}>
                {kind === 'expense' ? 'Expenses' : 'Income'}
              </Text>
            </Pressable>
          ))}
        </View>
        {breakdownView === 'pie' ? <CategoryPieChart entries={categoryData} /> : <CategoryBarChart entries={categoryData} />}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {trendPeriod === 'daily' ? 'Income vs. expense (4 days)' : trendPeriod === 'weekly' ? 'Income vs. expense (4 weeks)' : 'Income vs. expense (4 months)'}
          </Text>
          <View style={styles.segmented}>
            <SegmentButton label="Line" active={trendView === 'line'} onPress={() => setTrendView('line')} />
            <SegmentButton label="Bar" active={trendView === 'bar'} onPress={() => setTrendView('bar')} />
          </View>
        </View>
        <View style={styles.kindToggle}>
          {(['daily', 'weekly', 'monthly'] as TrendPeriod[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setTrendPeriod(p)}
              style={[styles.kindChip, trendPeriod === p && styles.kindChipSelected]}
            >
              <Text style={[styles.kindChipText, trendPeriod === p && styles.kindChipTextSelected]}>
                {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'Monthly'}
              </Text>
            </Pressable>
          ))}
        </View>
        {trendView === 'line' ? <TrendLineChart entries={trend} /> : <MonthlyTotalsBarChart entries={trend} />}
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary },
  segmented: { flexDirection: 'row', backgroundColor: PALETTE.surface, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: PALETTE.border },
  segmentButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  segmentButtonActive: { backgroundColor: PALETTE.net },
  segmentButtonText: { fontSize: 12, fontWeight: '600', color: PALETTE.textSecondary },
  segmentButtonTextActive: { color: '#fff' },
  kindToggle: { flexDirection: 'row', gap: 8 },
  kindChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  kindChipSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  kindChipText: { fontSize: 12, fontWeight: '600', color: PALETTE.textSecondary },
  kindChipTextSelected: { color: PALETTE.net },
});
