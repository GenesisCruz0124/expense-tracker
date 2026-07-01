import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { PALETTE } from '../../constants/colors';
import type { MonthlyTrendEntry } from '../../db/queries/reports';
import { fromMinorUnits } from '../../utils/currency';
import { EmptyState } from '../EmptyState';

interface Props {
  entries: MonthlyTrendEntry[];
}

function shortLabel(label: string): string {
  // Monthly "June 2026" -> "Jun"; weekly "Jun 23" already short, use as-is
  if (/\d{4}/.test(label)) return label.split(' ')[0]?.slice(0, 3) ?? label;
  return label;
}

export function TrendLineChart({ entries }: Props) {
  if (entries.length === 0 || entries.every((entry) => entry.income === 0 && entry.expense === 0)) {
    return <EmptyState icon="📈" title="No trend yet" message="Keep logging income and expenses to see how they compare over time." />;
  }

  const incomeData = entries.map((entry) => ({ value: fromMinorUnits(entry.income), label: shortLabel(entry.label) }));
  const expenseData = entries.map((entry) => ({ value: fromMinorUnits(entry.expense) }));

  return (
    <View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PALETTE.income }]} />
          <Text style={styles.legendLabel}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: PALETTE.expense }]} />
          <Text style={styles.legendLabel}>Expense</Text>
        </View>
      </View>
      <View style={styles.chartWrap}>
        <LineChart
          data={incomeData}
          data2={expenseData}
          color={PALETTE.income}
          color2={PALETTE.expense}
          thickness={2.5}
          thickness2={2.5}
          dataPointsColor={PALETTE.income}
          dataPointsColor2={PALETTE.expense}
          dataPointsRadius={4}
          noOfSections={4}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={PALETTE.border}
          yAxisTextStyle={{ color: PALETTE.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: PALETTE.textSecondary, fontSize: 10 }}
          curved
          isAnimated
          spacing={48}
          initialSpacing={16}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', gap: 20, paddingHorizontal: 4, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 12, color: PALETTE.textSecondary, fontWeight: '600' },
  chartWrap: { paddingVertical: 8, paddingRight: 12 },
});
