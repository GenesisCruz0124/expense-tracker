import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isSameMonth } from 'date-fns';

import { CategoryBarChart } from '../components/charts/CategoryBarChart';
import { CategoryPieChart } from '../components/charts/CategoryPieChart';
import { MonthlyTotalsBarChart } from '../components/charts/MonthlyTotalsBarChart';
import { TrendLineChart } from '../components/charts/TrendLineChart';
import { MonthSelector } from '../components/MonthSelector';
import { SummaryCard } from '../components/SummaryCard';
import { PALETTE } from '../constants/colors';
import { useReportsData, type ReportKind } from '../hooks/useReportsData';
import { monthRangeFor, shiftMonth } from '../utils/dateRanges';

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
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [breakdownView, setBreakdownView] = useState<BreakdownView>('pie');
  const [trendView, setTrendView] = useState<TrendView>('line');

  const range = monthRangeFor(anchorDate);
  const isCurrentMonth = isSameMonth(anchorDate, new Date());
  const { categoryData, trend, totals, breakdownKind, setBreakdownKind } = useReportsData(anchorDate, 6);
  const net = totals.income - totals.expense;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
          <Text style={styles.sectionTitle}>Income vs. expense (6 months)</Text>
          <View style={styles.segmented}>
            <SegmentButton label="Line" active={trendView === 'line'} onPress={() => setTrendView('line')} />
            <SegmentButton label="Bar" active={trendView === 'bar'} onPress={() => setTrendView('bar')} />
          </View>
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
