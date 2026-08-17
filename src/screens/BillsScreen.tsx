import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import PaidBillsScreen from './PaidBillsScreen';
import RecurringTransactionsScreen from './RecurringTransactionsScreen';
import UnpaidBillsScreen from './UnpaidBillsScreen';

type Segment = 'upcoming' | 'paid' | 'recurring';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'paid', label: 'Paid this month' },
  { key: 'recurring', label: 'Recurring' },
];

/** Hosts the unpaid-bill tracker and recurring-transaction rules under one "Bills" tab. */
export default function BillsScreen() {
  const [segment, setSegment] = useState<Segment>('upcoming');

  return (
    <View style={styles.screen}>
      <View style={styles.segmentRow}>
        {SEGMENTS.map((option) => {
          const selected = option.key === segment;
          return (
            <Pressable
              key={option.key}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => setSegment(option.key)}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {segment === 'upcoming' ? (
        <UnpaidBillsScreen />
      ) : segment === 'paid' ? (
        <PaidBillsScreen />
      ) : (
        <RecurringTransactionsScreen />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  segmentRow: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: PALETTE.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentSelected: { backgroundColor: PALETTE.net },
  segmentText: { fontSize: 13, fontWeight: '700', color: PALETTE.textSecondary },
  segmentTextSelected: { color: '#fff' },
});
