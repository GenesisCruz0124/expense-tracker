import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { AccountPicker } from '../components/AccountPicker';
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

interface RepeatPreset {
  key: string;
  label: string;
  /** `null` marks "one-time" — the rule logs once on its start date, then deactivates. */
  recurrence: { frequency: Frequency; intervalCount: number } | null;
}

/** Quick-pick presets for the "Repeats" row — each sets both the frequency and its interval. */
const REPEAT_PRESETS: RepeatPreset[] = [
  { key: 'once', label: 'One-time', recurrence: null },
  { key: 'weekly', label: 'Weekly', recurrence: { frequency: 'weekly', intervalCount: 1 } },
  { key: 'biweekly', label: 'Every 2 weeks', recurrence: { frequency: 'weekly', intervalCount: 2 } },
  { key: 'monthly', label: 'Monthly', recurrence: { frequency: 'monthly', intervalCount: 1 } },
  { key: 'yearly', label: 'Yearly', recurrence: { frequency: 'monthly', intervalCount: 12 } },
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
  const [billerId, setBillerId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [isOneTime, setIsOneTime] = useState(false);
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
      setBillerId(existing.billerId);
      setAccountId(existing.accountId ?? null);
      setFrequency(existing.frequency);
      setIntervalText(String(existing.intervalCount));
      setStartDate(existing.startDate);
      setIsOneTime(existing.endDate != null && existing.endDate === existing.startDate);
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

    let saveFrequency: Frequency = frequency;
    let saveIntervalCount = Number(intervalText);
    let saveEndDate: string | null = null;

    if (isOneTime) {
      saveFrequency = 'monthly';
      saveIntervalCount = 1;
      saveEndDate = startDate;
    } else {
      if (hasEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        setError('Enter a valid end date, or turn the end date off.');
        return;
      }
      if (!Number.isInteger(saveIntervalCount) || saveIntervalCount < 1) {
        setError('Repeat interval must be a whole number of 1 or more.');
        return;
      }
      saveEndDate = hasEndDate ? endDate : null;
    }

    setSaving(true);
    try {
      const input = {
        type,
        amount,
        note: note.trim() || null,
        categoryId,
        billerId: type === 'expense' ? billerId : null,
        accountId,
        frequency: saveFrequency,
        intervalCount: saveIntervalCount,
        startDate,
        endDate: saveEndDate,
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
      <View style={styles.field}>
        <Text style={styles.label}>Amount</Text>
        <AmountInput value={amountText} onChangeText={setAmountText} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <CategoryPicker forType={type} selectedCategoryId={categoryId} onSelect={setCategoryId} />
      </View>

      {type === 'expense' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Biller (optional)</Text>
          <CategoryPicker forType="expense" selectedCategoryId={billerId} onSelect={setBillerId} billersOnly />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Account (optional)</Text>
        <AccountPicker selectedAccountId={accountId} onSelect={setAccountId} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Repeats</Text>
        <View style={styles.optionRow}>
          {REPEAT_PRESETS.map((preset) => {
            const selected =
              preset.recurrence == null
                ? isOneTime
                : !isOneTime &&
                  preset.recurrence.frequency === frequency &&
                  preset.recurrence.intervalCount === Number(intervalText);
            return (
              <Pressable
                key={preset.key}
                onPress={() => {
                  if (preset.recurrence == null) {
                    setIsOneTime(true);
                  } else {
                    setIsOneTime(false);
                    setFrequency(preset.recurrence.frequency);
                    setIntervalText(String(preset.recurrence.intervalCount));
                  }
                }}
                style={[styles.optionChip, selected && styles.optionChipSelected]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isOneTime ? null : (
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
      )}

      <View style={styles.field}>
        <DateField label="Start date" value={startDate} onChangeText={setStartDate} />
      </View>

      {isOneTime ? (
        <Text style={styles.helperText}>Logged once on its start date, then it drops off this list.</Text>
      ) : (
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
      )}

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
