import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import type { PeriodType } from '../utils/dateRanges';

const OPTIONS: { key: PeriodType; label: string }[] = [
  { key: 'day', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'custom', label: 'Custom' },
];

interface Props {
  value: PeriodType;
  onChange: (period: PeriodType) => void;
}

export function PeriodTypeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => onChange(opt.key)}
          style={[styles.chip, value === opt.key && styles.chipSelected]}
        >
          <Text style={[styles.chipText, value === opt.key && styles.chipTextSelected]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  chipSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  chipText: { fontSize: 12, fontWeight: '600', color: PALETTE.textSecondary },
  chipTextSelected: { color: PALETTE.net },
});
