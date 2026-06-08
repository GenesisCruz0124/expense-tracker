import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AmountInput } from '../components/AmountInput';
import { DateField } from '../components/DateField';
import { PALETTE } from '../constants/colors';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { toMinorUnits } from '../utils/currency';
import { formatIsoDate } from '../utils/dateRanges';

type Frequency = 'weekly' | 'monthly';

interface RepeatOption {
  key: string;
  label: string;
  /** `null` marks "one-time" — the rule ends on its own due date so it fires exactly once. */
  recurrence: { frequency: Frequency; intervalCount: number } | null;
}

const REPEAT_OPTIONS: RepeatOption[] = [
  { key: 'once', label: 'One-time', recurrence: null },
  { key: 'weekly', label: 'Weekly', recurrence: { frequency: 'weekly', intervalCount: 1 } },
  { key: 'biweekly', label: 'Every 2 weeks', recurrence: { frequency: 'weekly', intervalCount: 2 } },
  { key: 'monthly', label: 'Monthly', recurrence: { frequency: 'monthly', intervalCount: 1 } },
];

/** Quick-add flow for the Dashboard's "Upcoming bills" — a slimmed-down recurring-rule form
 * focused on the fields a bill actually needs (who, how much, when), with an explicit
 * one-time option for bills that shouldn't keep repeating. */
export default function AddBillScreen() {
  const navigation = useNavigation();
  const { createRule } = useRecurringTransactions();

  const [billerName, setBillerName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dueDate, setDueDate] = useState(() => formatIsoDate(new Date()));
  const [repeatKey, setRepeatKey] = useState('once');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!billerName.trim()) {
      setError('Enter who this bill is for.');
      return;
    }
    const amount = toMinorUnits(amountText);
    if (amount == null || amount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError('Select a valid due date.');
      return;
    }

    const option = REPEAT_OPTIONS.find((entry) => entry.key === repeatKey) ?? REPEAT_OPTIONS[0];
    const recurrence = option.recurrence ?? { frequency: 'monthly' as Frequency, intervalCount: 1 };

    setSaving(true);
    try {
      await createRule({
        type: 'expense',
        amount,
        note: billerName.trim(),
        categoryId: null,
        frequency: recurrence.frequency,
        intervalCount: recurrence.intervalCount,
        startDate: dueDate,
        // A one-time bill's end date equals its start date — `generateOccurrencesUpTo` then
        // logs exactly one transaction on that date and deactivates the rule, so it naturally
        // drops off "Upcoming bills" once paid instead of recurring indefinitely.
        endDate: option.recurrence == null ? dueDate : null,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={styles.label}>Biller name</Text>
        <TextInput
          style={styles.textInput}
          value={billerName}
          onChangeText={setBillerName}
          placeholder="e.g. Meralco, PLDT, Landlord"
          placeholderTextColor={PALETTE.textSecondary}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Amount due</Text>
        <AmountInput value={amountText} onChangeText={setAmountText} />
      </View>

      <View style={styles.field}>
        <DateField label="Date due" value={dueDate} onChangeText={setDueDate} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Repeats</Text>
        <View style={styles.optionRow}>
          {REPEAT_OPTIONS.map((option) => {
            const selected = option.key === repeatKey;
            return (
              <Pressable
                key={option.key}
                onPress={() => setRepeatKey(option.key)}
                style={[styles.optionChip, selected && styles.optionChipSelected]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          {repeatKey === 'once'
            ? 'Logged once on its due date, then it drops off this list.'
            : 'Generated automatically each time it comes due — just like other recurring rules.'}
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Add bill'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  textInput: {
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.textPrimary,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  optionChipSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  optionChipText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  optionChipTextSelected: { color: PALETTE.net },
  helperText: { fontSize: 12, color: PALETTE.textSecondary, lineHeight: 18 },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
