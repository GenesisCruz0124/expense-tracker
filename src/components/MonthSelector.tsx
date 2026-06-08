import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';

interface Props {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  /** Disable the "next" arrow, e.g. to prevent navigating into the future */
  nextDisabled?: boolean;
}

export function MonthSelector({ label, onPrevious, onNext, nextDisabled }: Props) {
  return (
    <View style={styles.container}>
      <Pressable onPress={onPrevious} style={styles.arrow} hitSlop={8}>
        <Text style={styles.arrowText}>‹</Text>
      </Pressable>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onNext} disabled={nextDisabled} style={styles.arrow} hitSlop={8}>
        <Text style={[styles.arrowText, nextDisabled && styles.arrowDisabled]}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  arrow: { paddingHorizontal: 12, paddingVertical: 4 },
  arrowText: { fontSize: 22, color: PALETTE.net, fontWeight: '600' },
  arrowDisabled: { color: PALETTE.border },
  label: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary, minWidth: 140, textAlign: 'center' },
});
