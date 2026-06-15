import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

import { AccountCategoryPicker } from '../components/AccountCategoryPicker';
import { AmountInput } from '../components/AmountInput';
import { QrImagePicker } from '../components/QrImagePicker';
import { ACCOUNT_ICON_OPTIONS, DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { CATEGORY_COLOR_PALETTE, PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getAccount } from '../db/queries/accounts';
import { useAccounts } from '../hooks/useAccounts';
import { fromMinorUnits, toMinorUnits } from '../utils/currency';
import type { RootStackParamList } from '../navigation/types';

export default function AddEditAccountScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditAccount'>>();
  const accountId = route.params?.accountId;
  const isEditing = accountId != null;

  const { db } = useDatabase();
  const { createAccount, updateAccount } = useAccounts({ includeArchived: true });

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [color, setColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<string>(DEFAULT_ACCOUNT_ICON);
  const [accountNumber, setAccountNumber] = useState('');
  const [qrImageUri, setQrImageUri] = useState<string | null>(null);
  const [balanceText, setBalanceText] = useState('0');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getAccount(db, accountId);
      if (!existing || cancelled) return;
      setName(existing.name);
      setCategoryId(existing.categoryId);
      setColor(existing.color);
      setIcon(existing.icon ?? DEFAULT_ACCOUNT_ICON);
      setAccountNumber(existing.accountNumber ?? '');
      setQrImageUri(existing.qrImageUri ?? null);
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
    if (categoryId == null) {
      setError('Choose an account category.');
      return;
    }

    setSaving(true);
    try {
      const input = { name: trimmed, categoryId, color, icon, accountNumber, qrImageUri, startingBalance };
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

  async function handleCopyAccountNumber() {
    const trimmed = accountNumber.trim();
    if (!trimmed) return;
    await Clipboard.setStringAsync(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <Text style={styles.label}>Category</Text>
        <AccountCategoryPicker selectedCategoryId={categoryId} onSelect={setCategoryId} />
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

      <View style={styles.field}>
        <Text style={styles.label}>Account number</Text>
        <View style={styles.accountNumberRow}>
          <TextInput
            style={[styles.input, styles.accountNumberInput]}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="e.g. 1234 5678 9012"
            placeholderTextColor={PALETTE.textSecondary}
          />
          <Pressable
            style={[styles.copyButton, !accountNumber.trim() && styles.saveButtonDisabled]}
            onPress={handleCopyAccountNumber}
            disabled={!accountNumber.trim()}
          >
            <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Received payment via QR</Text>
        <QrImagePicker uri={qrImageUri} onChange={setQrImageUri} />
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
  accountNumberRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  accountNumberInput: { flex: 1 },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  copyButtonText: { fontSize: 13, fontWeight: '600', color: PALETTE.net },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
