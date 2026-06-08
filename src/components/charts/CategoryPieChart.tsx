import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { PALETTE } from '../../constants/colors';
import type { CategoryBreakdownEntry } from '../../db/queries/reports';
import { formatCurrency, fromMinorUnits } from '../../utils/currency';
import { EmptyState } from '../EmptyState';

interface Props {
  entries: CategoryBreakdownEntry[];
}

export function CategoryPieChart({ entries }: Props) {
  if (entries.length === 0) {
    return <EmptyState icon="🥧" title="Nothing to show yet" message="Log some transactions to see a breakdown by category." />;
  }

  const total = entries.reduce((sum, entry) => sum + entry.total, 0);
  const data = entries.map((entry) => ({
    value: fromMinorUnits(entry.total),
    color: entry.categoryColor,
    text: total > 0 ? `${Math.round((entry.total / total) * 100)}%` : '0%',
  }));

  return (
    <View style={styles.container}>
      <View style={styles.chartWrap}>
        <PieChart
          data={data}
          donut
          radius={88}
          innerRadius={56}
          innerCircleColor={PALETTE.surface}
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={styles.centerLabelValue}>{formatCurrency(total)}</Text>
              <Text style={styles.centerLabelCaption}>total</Text>
            </View>
          )}
        />
      </View>
      <View style={styles.legend}>
        {entries.map((entry) => (
          <View key={`${entry.categoryId ?? 'uncategorized'}`} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: entry.categoryColor }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {entry.categoryName}
            </Text>
            <Text style={styles.legendValue}>{formatCurrency(entry.total)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  chartWrap: { alignItems: 'center', paddingVertical: 8 },
  centerLabel: { alignItems: 'center' },
  centerLabelValue: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary },
  centerLabelCaption: { fontSize: 12, color: PALETTE.textSecondary },
  legend: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 14, color: PALETTE.textPrimary },
  legendValue: { fontSize: 14, fontWeight: '600', color: PALETTE.textPrimary },
});
