import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PALETTE } from '../constants/colors';

interface Props {
  /** Raw text the user has typed, in major units, e.g. "45.50" */
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/** Plain-text amount entry (major units, e.g. pesos) — converted to minor units at save time via `toMinorUnits`. */
export function AmountInput({ value, onChangeText, placeholder = '0.00' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.symbol}>₱</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9.]/g, ''))}
        placeholder={placeholder}
        placeholderTextColor={PALETTE.textSecondary}
        keyboardType="decimal-pad"
        inputMode="decimal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  symbol: { fontSize: 20, color: PALETTE.textSecondary, marginRight: 6 },
  input: { flex: 1, fontSize: 20, fontWeight: '600', color: PALETTE.textPrimary, paddingVertical: 12 },
});
