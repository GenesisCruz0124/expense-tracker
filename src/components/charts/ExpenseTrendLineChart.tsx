import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { PALETTE } from '../../constants/colors';
import type { MonthlyTrendEntry } from '../../db/queries/reports';
import { formatCurrency, fromMinorUnits } from '../../utils/currency';
import { EmptyState } from '../EmptyState';

interface Props {
  entries: MonthlyTrendEntry[];
}

function shortLabel(label: string): string {
  if (/\d{4}/.test(label)) return label.split(' ')[0]?.slice(0, 3) ?? label;
  return label;
}

export function ExpenseTrendLineChart({ entries }: Props) {
  if (entries.length === 0 || entries.every((e) => e.expense === 0)) {
    return (
      <EmptyState icon="📊" title="No data yet" message="Keep logging expenses to see your expense trend." />
    );
  }

  const data = entries.map((e) => ({
    value: fromMinorUnits(e.expense),
    label: shortLabel(e.label),
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const nonZero = data.filter((d) => d.value > 0);
  const average = nonZero.length > 0 ? total / nonZero.length : 0;
  const spacing = entries.length >= 20 ? 22 : entries.length >= 10 ? 36 : 48;

  return (
    <View>
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>Total spent</Text>
          <Text style={[styles.summaryValue, { color: PALETTE.expense }]}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryLabel}>Avg / period</Text>
          <Text style={[styles.avgValue, { color: PALETTE.textSecondary }]}>{formatCurrency(average)}</Text>
        </View>
      </View>
      <View style={styles.chartWrap}>
        <LineChart
          data={data}
          color={PALETTE.expense}
          thickness={2.5}
          dataPointsColor={PALETTE.expense}
          dataPointsRadius={4}
          noOfSections={4}
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={PALETTE.border}
          yAxisTextStyle={{ color: PALETTE.textSecondary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: PALETTE.textSecondary, fontSize: 10 }}
          curved
          isAnimated
          spacing={spacing}
          initialSpacing={16}
          areaChart
          startFillColor={PALETTE.expense}
          startOpacity={0.18}
          endFillColor={PALETTE.expense}
          endOpacity={0.02}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: PALETTE.textSecondary },
  summaryValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  summaryRight: { alignItems: 'flex-end' },
  avgValue: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  chartWrap: { paddingVertical: 8, paddingRight: 12 },
});
