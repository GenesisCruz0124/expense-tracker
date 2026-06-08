import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import { formatCurrency } from '../utils/currency';

interface Props {
  label: string;
  /** Amount in minor units (cents); sign is rendered based on `tone` */
  amount: number;
  tone: 'income' | 'expense' | 'net';
}

export function SummaryCard({ label, amount, tone }: Props) {
  const color = PALETTE[tone];
  return (
    <View style={[styles.card, { borderTopColor: color }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.amount, { color }]}>{formatCurrency(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderTopWidth: 3,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  label: { fontSize: 12, color: PALETTE.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  amount: { fontSize: 18, fontWeight: '700' },
});
