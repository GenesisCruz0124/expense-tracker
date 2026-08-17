import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import { evaluateExpression, isExpression } from '../utils/calculator';

interface Props {
  /** Raw text the user has typed, in major units, e.g. "45.50", or a calculator expression like "45+5" */
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

const OPERATORS: { symbol: string; char: string }[] = [
  { symbol: '+', char: '+' },
  { symbol: '−', char: '-' },
  { symbol: '×', char: '*' },
  { symbol: '÷', char: '/' },
];

function formatResult(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * Amount entry (major units, e.g. pesos) that also accepts calculator-style expressions
 * (e.g. "80+20", "150*2") — evaluated to a plain number on blur or when "=" is tapped, then
 * converted to minor units at save time via `toMinorUnits`.
 */
export function AmountInput({ value, onChangeText, placeholder = '0.00' }: Props) {
  const [focused, setFocused] = useState(false);
  const expression = isExpression(value);
  const previewValue = expression ? evaluateExpression(value) : null;

  function commitExpression() {
    if (!isExpression(value)) return;
    const result = evaluateExpression(value);
    if (result != null && result >= 0) onChangeText(formatResult(result));
  }

  function appendOperator(char: string) {
    const trimmed = value.trim();
    if (trimmed === '') return;
    if (/[+\-*/]$/.test(trimmed)) {
      onChangeText(trimmed.slice(0, -1) + char);
    } else {
      onChangeText(trimmed + char);
    }
  }

  return (
    <View>
      <View style={styles.container}>
        <Text style={styles.symbol}>₱</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/[^0-9.+\-*/()]/g, ''))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commitExpression();
          }}
          placeholder={placeholder}
          placeholderTextColor={PALETTE.textSecondary}
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        {expression ? (
          <Pressable onPress={commitExpression} style={styles.equalsButton} hitSlop={6}>
            <Text style={styles.equalsText}>=</Text>
          </Pressable>
        ) : null}
      </View>

      {expression ? (
        <Text style={styles.preview}>{previewValue != null ? `= ₱${formatResult(previewValue)}` : 'Invalid expression'}</Text>
      ) : null}

      {focused ? (
        <View style={styles.operatorRow}>
          {OPERATORS.map((op) => (
            <Pressable key={op.char} onPress={() => appendOperator(op.char)} style={styles.operatorButton}>
              <Text style={styles.operatorText}>{op.symbol}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
  equalsButton: {
    backgroundColor: PALETTE.net,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  equalsText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  preview: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 4, marginLeft: 4 },
  operatorRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  operatorButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 8,
  },
  operatorText: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary },
});
