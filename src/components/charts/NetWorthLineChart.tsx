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

export function NetWorthLineChart({ entries }: Props) {
  if (entries.length === 0 || entries.every((e) => e.income === 0 && e.expense === 0)) {
    return (
      <EmptyState icon="📊" title="No data yet" message="Keep logging income and expenses to see your net worth trend." />
    );
  }

  let running = 0;
  const data = entries.map((e) => {
    running += e.income - e.expense;
    return { value: fromMinorUnits(running), label: shortLabel(e.label) };
  });

  const finalValue = data[data.length - 1]?.value ?? 0;
  const isPositive = finalValue >= 0;
  const lineColor = isPositive ? PALETTE.net : PALETTE.expense;

  const spacing = entries.length >= 20 ? 22 : entries.length >= 10 ? 36 : 48;

  return (
    <View>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Cumulative net</Text>
        <Text style={[styles.summaryValue, { color: lineColor }]}>{formatCurrency(Math.abs(finalValue))}</Text>
      </View>
      <View style={styles.chartWrap}>
        <LineChart
          data={data}
          color={lineColor}
          thickness={2.5}
          dataPointsColor={lineColor}
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
          startFillColor={lineColor}
          startOpacity={0.18}
          endFillColor={lineColor}
          endOpacity={0.02}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: PALETTE.textSecondary },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  chartWrap: { paddingVertical: 8, paddingRight: 12 },
});
