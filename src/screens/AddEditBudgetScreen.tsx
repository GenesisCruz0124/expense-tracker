import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { parseISO } from 'date-fns';

import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { PALETTE } from '../constants/colors';
import { useBudgets } from '../hooks/useBudgets';
import { fromMinorUnits, toMinorUnits } from '../utils/currency';
import { monthRangeFor } from '../utils/dateRanges';
import type { RootStackParamList } from '../navigation/types';

export default function AddEditBudgetScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditBudget'>>();
  const { budgetId, monthKey } = route.params;
  const isEditing = budgetId != null;

  const range = useMemo(() => monthRangeFor(parseISO(`${monthKey}-01`)), [monthKey]);
  const { budgets, saveBudget, removeBudget } = useBudgets(range);
  const existing = budgets.find((budget) => budget.id === budgetId);

  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [limitText, setLimitText] = useState('');
  const [thresholdText, setThresholdText] = useState('90');
  const [hydrated, setHydrated] = useState(!isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing || hydrated || !existing) return;
    setCategoryId(existing.categoryId);
    setLimitText(String(fromMinorUnits(existing.amountLimit)));
    setThresholdText(String(existing.alertThresholdPct));
    setHydrated(true);
  }, [isEditing, hydrated, existing]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit budget' : 'Set a budget' });
  }, [navigation, isEditing]);

  async function handleSave() {
    setError(null);
    if (categoryId == null) {
      setError('Choose a category for this budget.');
      return;
    }
    const amountLimit = toMinorUnits(limitText);
    if (amountLimit == null || amountLimit <= 0) {
      setError('Enter a valid limit greater than zero.');
      return;
    }
    const alertThresholdPct = Number(thresholdText);
    if (!Number.isFinite(alertThresholdPct) || alertThresholdPct <= 0 || alertThresholdPct > 100) {
      setError('Alert threshold must be a percentage between 1 and 100.');
      return;
    }

    setSaving(true);
    try {
      await saveBudget({ categoryId, month: monthKey, amountLimit, alertThresholdPct });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this budget.');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Delete budget', 'This removes the limit for this category and month.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeBudget(existing.id);
          navigation.goBack();
        },
      },
    ]);
  }

  if (isEditing && !hydrated) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.monthLabel}>{range.label}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <CategoryPicker forType="expense" selectedCategoryId={categoryId} onSelect={setCategoryId} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Monthly limit</Text>
        <AmountInput value={limitText} onChangeText={setLimitText} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Alert me at (% of limit)</Text>
        <TextInput
          style={styles.input}
          value={thresholdText}
          onChangeText={(text) => setThresholdText(text.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="90"
          placeholderTextColor={PALETTE.textSecondary}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Set budget'}</Text>
      </Pressable>

      {isEditing ? (
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete budget</Text>
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
  monthLabel: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary, textAlign: 'center' },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  input: {
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.textPrimary,
  },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteButton: { alignItems: 'center', paddingVertical: 10 },
  deleteButtonText: { color: PALETTE.danger, fontSize: 14, fontWeight: '600' },
});
