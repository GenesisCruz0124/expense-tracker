import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { PALETTE } from '../../constants/colors';
import type { CategoryBreakdownEntry } from '../../db/queries/reports';
import { fromMinorUnits } from '../../utils/currency';
import { EmptyState } from '../EmptyState';

interface Props {
  entries: CategoryBreakdownEntry[];
}

export function CategoryBarChart({ entries }: Props) {
  if (entries.length === 0) {
    return <EmptyState icon="📊" title="Nothing to show yet" message="Log some transactions to see a breakdown by category." />;
  }

  const data = entries.map((entry) => ({
    value: fromMinorUnits(entry.total),
    frontColor: entry.categoryColor,
    label: entry.categoryName.length > 8 ? `${entry.categoryName.slice(0, 7)}…` : entry.categoryName,
  }));

  return (
    <View style={styles.chartWrap}>
      <BarChart
        data={data}
        barWidth={28}
        spacing={22}
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
