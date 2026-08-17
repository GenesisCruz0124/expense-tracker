import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { PALETTE } from '../constants/colors';
import PaidBillsScreen from './PaidBillsScreen';
import RecurringTransactionsScreen from './RecurringTransactionsScreen';

type Segment = 'paid' | 'recurring';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'paid', label: 'Paid this month' },
  { key: 'recurring', label: 'Recurring' },
];

/** Hosts the paid-bill history and recurring-transaction rules under one "Bills" tab. */
export default function BillsScreen() {
  const navigation = useNavigation();
  const [segment, setSegment] = useState<Segment>('paid');

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
      {segment === 'paid' ? <PaidBillsScreen /> : <RecurringTransactionsScreen />}

      {/* The upcoming-bills segment used to own the "add bill" shortcut; keep it available here. */}
      {segment === 'paid' ? (
        <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditBill')}>
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      ) : null}
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PALETTE.net,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
});
