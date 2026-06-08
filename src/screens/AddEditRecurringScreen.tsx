import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { DateField } from '../components/DateField';
import { PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getRecurringTransaction } from '../db/queries/recurring';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { fromMinorUnits, toMinorUnits } from '../utils/currency';
import { formatIsoDate } from '../utils/dateRanges';
import type { RootStackParamList } from '../navigation/types';

type TransactionType = 'expense' | 'income';
type Frequency = 'weekly' | 'monthly';

/** Quick-pick presets for the "Repeats" row — each sets both the frequency and its interval. */
const REPEAT_PRESETS: Array<{ key: string; label: string; frequency: Frequency; intervalCount: number }> = [
  { key: 'weekly', label: 'Weekly', frequency: 'weekly', intervalCount: 1 },
  { key: 'biweekly', label: 'Every 2 weeks', frequency: 'weekly', intervalCount: 2 },
  { key: 'monthly', label: 'Monthly', frequency: 'monthly', intervalCount: 1 },
];

export default function AddEditRecurringScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditRecurring'>>();
  const recurringId = route.params?.recurringId;
  const isEditing = recurringId != null;

  const { db } = useDatabase();
  const { createRule, updateRule, removeRule } = useRecurringTransactions();

  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [intervalText, setIntervalText] = useState('1');
  const [startDate, setStartDate] = useState(() => formatIsoDate(new Date()));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getRecurringTransaction(db, recurringId);
      if (!existing || cancelled) return;
      setType(existing.type);
      setAmountText(String(fromMinorUnits(existing.amount)));
      setCategoryId(existing.categoryId);
      setFrequency(existing.frequency);
      setIntervalText(String(existing.intervalCount));
      setStartDate(existing.startDate);
      setHasEndDate(existing.endDate != null);
      setEndDate(existing.endDate ?? '');
      setNote(existing.note ?? '');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isEditing, recurringId]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit recurring transaction' : 'Add recurring transaction' });
  }, [navigation, isEditing]);

  function handleTypeChange(nextType: TransactionType) {
    if (nextType === type) return;
    setType(nextType);
    setCategoryId(null);
  }

  async function handleSave() {
    setError(null);
    const amount = toMinorUnits(amountText);
    if (amount == null || amount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setError('Enter a valid start date in YYYY-MM-DD format.');
      return;
    }
    if (hasEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      setError('Enter a valid end date, or turn the end date off.');
      return;
    }
    const intervalCount = Number(intervalText);
    if (!Number.isInteger(intervalCount) || intervalCount < 1) {
      setError('Repeat interval must be a whole number of 1 or more.');
      return;
    }

    setSaving(true);
    try {
      const input = {
        type,
        amount,
        note: note.trim() || null,
        categoryId,
        frequency,
        intervalCount,
        startDate,
        endDate: hasEndDate ? endDate : null,
      };
      if (isEditing) {
        await updateRule(recurringId, input);
      } else {
        await createRule(input);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!isEditing) return;
    Alert.alert(
      'Delete recurring transaction',
      'Already-generated transactions stay in your history — only future occurrences stop.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await removeRule(recurringId);
            navigation.goBack();
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.typeToggle}>
        {(['expense', 'income'] as const).map((option) => {
          const selected = option === type;
          const tone = option === 'expense' ? PALETTE.expense : PALETTE.income;
          return (
            <Pressable
              key={option}
              onPress={() => handleTypeChange(option)}
              style={[styles.typeOption, selected && { backgroundColor: tone, borderColor: tone }]}
            >
              <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                {option === 'expense' ? 'Expense' : 'Income'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Amount</Text>
        <AmountInput value={amountText} onChangeText={setAmountText} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <CategoryPicker forType={type} selectedCategoryId={categoryId} onSelect={setCategoryId} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Repeats</Text>
        <View style={styles.optionRow}>
          {REPEAT_PRESETS.map((preset) => {
            const selected = preset.frequency === frequency && preset.intervalCount === Number(intervalText);
            return (
              <Pressable
                key={preset.key}
                onPress={() => {
                  setFrequency(preset.frequency);
                  setIntervalText(String(preset.intervalCount));
                }}
                style={[styles.optionChip, selected && styles.optionChipSelected]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Every</Text>
        <View style={styles.intervalRow}>
          <TextInput
            style={styles.intervalInput}
            value={intervalText}
            onChangeText={(text) => setIntervalText(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={PALETTE.textSecondary}
          />
          <Text style={styles.intervalUnit}>{frequency === 'weekly' ? 'week(s)' : 'month(s)'}</Text>
        </View>
      </View>

      <View style={styles.field}>
        <DateField label="Start date" value={startDate} onChangeText={setStartDate} />
      </View>

      <View style={styles.field}>
        <View style={styles.endDateHeader}>
          <Text style={styles.label}>End date</Text>
          <Switch value={hasEndDate} onValueChange={setHasEndDate} trackColor={{ true: PALETTE.net }} />
        </View>
        {hasEndDate ? (
          <DateField value={endDate} onChangeText={setEndDate} />
        ) : (
          <Text style={styles.helperText}>Leave off to repeat indefinitely.</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Note</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="e.g. Rent, Salary"
          placeholderTextColor={PALETTE.textSecondary}
          multiline
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add recurring transaction'}
        </Text>
      </Pressable>

      {isEditing ? (
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete recurring transaction</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.background },
  loadingText: { color: PALETTE.textSecondary, fontSize: 14 },
  typeToggle: { flexDirection: 'row', gap: 10 },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  typeOptionText: { fontSize: 14, fontWeight: '700', color: PALETTE.textSecondary },
  typeOptionTextSelected: { color: '#fff' },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  optionRow: { flexDirection: 'row', gap: 10 },
  optionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  optionChipSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  optionChipText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  optionChipTextSelected: { color: PALETTE.net },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  intervalInput: {
    width: 72,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.textPrimary,
    textAlign: 'center',
  },
  intervalUnit: { fontSize: 14, color: PALETTE.textSecondary },
  endDateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helperText: { fontSize: 12, color: PALETTE.textSecondary },
  noteInput: {
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteButton: { alignItems: 'center', paddingVertical: 10 },
  deleteButtonText: { color: PALETTE.danger, fontSize: 14, fontWeight: '600' },
});
