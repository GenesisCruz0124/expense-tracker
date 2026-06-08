import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { AmountInput } from '../components/AmountInput';
import { ACCOUNT_ICON_OPTIONS, DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { CATEGORY_COLOR_PALETTE, PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getAccount, type AccountType } from '../db/queries/accounts';
import { useAccounts } from '../hooks/useAccounts';
import { fromMinorUnits, toMinorUnits } from '../utils/currency';
import type { RootStackParamList } from '../navigation/types';

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'ewallet', label: 'E-wallet' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'other', label: 'Other' },
];

export default function AddEditAccountScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditAccount'>>();
  const accountId = route.params?.accountId;
  const isEditing = accountId != null;

  const { db } = useDatabase();
  const { createAccount, updateAccount } = useAccounts({ includeArchived: true });

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('cash');
  const [color, setColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<string>(DEFAULT_ACCOUNT_ICON);
  const [balanceText, setBalanceText] = useState('0');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getAccount(db, accountId);
      if (!existing || cancelled) return;
      setName(existing.name);
      setType(existing.type as AccountType);
      setColor(existing.color);
      setIcon(existing.icon ?? DEFAULT_ACCOUNT_ICON);
      setBalanceText(String(fromMinorUnits(existing.startingBalance)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isEditing, accountId]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit account' : 'Add account' });
  }, [navigation, isEditing]);

  async function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the account a name.');
      return;
    }
    const startingBalance = toMinorUnits(balanceText);
    if (startingBalance == null) {
      setError('Enter a valid starting balance.');
      return;
    }

    setSaving(true);
    try {
      const input = { name: trimmed, type, color, icon, startingBalance };
      if (isEditing) {
        await updateAccount(accountId, input);
      } else {
        await createAccount(input);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save — is the name already in use?');
    } finally {
      setSaving(false);
    }
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
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. BPI Savings"
          placeholderTextColor={PALETTE.textSecondary}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.optionRow}>
          {TYPE_OPTIONS.map((option) => {
            const selected = option.value === type;
            return (
              <Pressable
                key={option.value}
                onPress={() => setType(option.value)}
                style={[styles.optionChip, selected && styles.optionChipSelected]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Starting balance</Text>
        <AmountInput value={balanceText} onChangeText={setBalanceText} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Color</Text>
        <View style={styles.swatchRow}>
          {CATEGORY_COLOR_PALETTE.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setColor(swatch)}
              style={[styles.swatch, { backgroundColor: swatch }, swatch === color && styles.swatchSelected]}
            >
              {swatch === color ? <Text style={styles.swatchCheck}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Icon</Text>
        <View style={styles.iconRow}>
          {ACCOUNT_ICON_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setIcon(option)}
              style={[styles.iconOption, option === icon && styles.iconOptionSelected]}
            >
              <Text style={styles.iconOptionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add account'}</Text>
      </Pressable>
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
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionChip: {
    alignItems: 'center',
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
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 2.5, borderColor: PALETTE.textPrimary },
  swatchCheck: { color: '#fff', fontSize: 15, fontWeight: '700' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
  },
  iconOptionSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  iconOptionText: { fontSize: 20 },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
