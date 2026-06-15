import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { AccountPicker } from '../components/AccountPicker';
import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { DateField } from '../components/DateField';
import { PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getBill } from '../db/queries/bills';
import { useBills } from '../hooks/useBills';
import { fromMinorUnits, toMinorUnits } from '../utils/currency';
import { formatIsoDate } from '../utils/dateRanges';
import type { RootStackParamList } from '../navigation/types';

interface ReminderPreset {
  key: string;
  label: string;
  days: number;
}

const REMINDER_PRESETS: ReminderPreset[] = [
  { key: 'same-day', label: 'On due date', days: 0 },
  { key: '1-day', label: '1 day before', days: 1 },
  { key: '3-days', label: '3 days before', days: 3 },
  { key: '1-week', label: '1 week before', days: 7 },
];

export default function AddEditBillScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditBill'>>();
  const billId = route.params?.billId;
  const isEditing = billId != null;

  const { db } = useDatabase();
  const { addBill, editBill, removeBill, payBill, unpayBill } = useBills();

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState(() => formatIsoDate(new Date()));
  const [reminderDays, setReminderDays] = useState(1);
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getBill(db, billId);
      if (!existing || cancelled) return;
      setName(existing.name);
      setAmountText(String(fromMinorUnits(existing.amount)));
      setCategoryId(existing.categoryId);
      setAccountId(existing.accountId);
      setDueDate(existing.dueDate);
      setReminderDays(existing.reminderDaysBefore);
      setIsPaid(existing.isPaid);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isEditing, billId]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit bill' : 'Add bill' });
  }, [navigation, isEditing]);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError('Enter a name for this bill.');
      return;
    }
    const amount = toMinorUnits(amountText);
    if (amount == null || amount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError('Enter a valid due date in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      const input = {
        name,
        amount,
        categoryId,
        accountId,
        dueDate,
        reminderDaysBefore: reminderDays,
      };
      if (isEditing) {
        await editBill(billId, input);
      } else {
        await addBill(input);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  function handleMarkPaid() {
    if (!isEditing) return;
    Alert.alert('Mark as paid?', `This logs an expense dated today for "${name}".`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark paid',
        onPress: async () => {
          await payBill(billId, formatIsoDate(new Date()));
          navigation.goBack();
        },
      },
    ]);
  }

  function handleMarkUnpaid() {
    if (!isEditing) return;
    Alert.alert('Mark as unpaid?', 'This removes the transaction that was logged when this bill was marked paid.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark unpaid',
        style: 'destructive',
        onPress: async () => {
          await unpayBill(billId);
          navigation.goBack();
        },
      },
    ]);
  }

  function handleDelete() {
    if (!isEditing) return;
    Alert.alert('Delete bill', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeBill(billId);
          navigation.goBack();
        },
      },
    ]);
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
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Electric bill"
          placeholderTextColor={PALETTE.textSecondary}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Amount</Text>
        <AmountInput value={amountText} onChangeText={setAmountText} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <CategoryPicker forType="expense" selectedCategoryId={categoryId} onSelect={setCategoryId} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Pay from (optional)</Text>
        <AccountPicker selectedAccountId={accountId} onSelect={setAccountId} />
      </View>

      <View style={styles.field}>
        <DateField label="Due date" value={dueDate} onChangeText={setDueDate} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Remind me</Text>
        <View style={styles.optionRow}>
          {REMINDER_PRESETS.map((preset) => {
            const selected = preset.days === reminderDays;
            return (
              <Pressable
                key={preset.key}
                onPress={() => setReminderDays(preset.days)}
                style={[styles.optionChip, selected && styles.optionChipSelected]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add bill'}</Text>
      </Pressable>

      {isEditing ? (
        <Pressable onPress={isPaid ? handleMarkUnpaid : handleMarkPaid} style={[styles.payButton, isPaid && styles.payButtonUndo]}>
          <Text style={[styles.payButtonText, isPaid && styles.payButtonTextUndo]}>
            {isPaid ? 'Mark as unpaid' : 'Mark as paid'}
          </Text>
        </Pressable>
      ) : null}

      {isEditing ? (
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete bill</Text>
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
  nameInput: {
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.textPrimary,
  },
  optionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  optionChip: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  optionChipSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  optionChipText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  optionChipTextSelected: { color: PALETTE.net },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  payButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: `${PALETTE.income}1A`,
  },
  payButtonUndo: { backgroundColor: `${PALETTE.textSecondary}1A` },
  payButtonText: { color: PALETTE.income, fontSize: 14, fontWeight: '700' },
  payButtonTextUndo: { color: PALETTE.textSecondary },
  deleteButton: { alignItems: 'center', paddingVertical: 10 },
  deleteButtonText: { color: PALETTE.danger, fontSize: 14, fontWeight: '600' },
});
