import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

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

/** Grouped income/expense bars per month — an alternate view of the same trend data as a line chart. */
export function MonthlyTotalsBarChart({ entries }: Props) {
  if (entries.length === 0 || entries.every((entry) => entry.income === 0 && entry.expense === 0)) {
    return <EmptyState icon="📊" title="Nothing to show yet" message="Log income and expenses to see your monthly totals." />;
  }

  const compact = entries.length >= 20;
  const barWidth = compact ? 8 : 14;
  const outerSpacing = compact ? 6 : 18;

  const data = entries.flatMap((entry, index) => [
    {
      value: fromMinorUnits(entry.income),
      frontColor: PALETTE.income,
      label: shortLabel(entry.label),
      spacing: 2,
    },
    {
      value: fromMinorUnits(entry.expense),
      frontColor: PALETTE.expense,
      spacing: index === entries.length - 1 ? 0 : outerSpacing,
    },
  ]);

  return (
    <View style={styles.chartWrap}>
      <BarChart
        data={data}
        barWidth={barWidth}
        roundedTop
        noOfSections={4}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={PALETTE.border}
        yAxisTextStyle={{ color: PALETTE.textSecondary, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: PALETTE.textSecondary, fontSize: 10 }}
        isAnimated
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { paddingVertical: 8, paddingRight: 12 },
});
