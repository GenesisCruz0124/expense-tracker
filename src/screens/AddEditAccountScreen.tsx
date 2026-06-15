import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

import { AccountCategoryPicker } from '../components/AccountCategoryPicker';
import { AmountInput } from '../components/AmountInput';
import { QrImagePicker } from '../components/QrImagePicker';
import { ACCOUNT_ICON_OPTIONS, DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { CATEGORY_COLOR_PALETTE, PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getAccountWithBalance } from '../db/queries/accounts';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { fromMinorUnits, toMinorUnits } from '../utils/currency';
import { monthKeyFor } from '../utils/dateRanges';
import type { RootStackParamList } from '../navigation/types';

export default function AddEditAccountScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditAccount'>>();
  const accountId = route.params?.accountId;
  const isEditing = accountId != null;

  const { db } = useDatabase();
  const { createAccount, updateAccount, markMonthlyDueUnpaid } = useAccounts({ includeArchived: true });
  const { accountCategories } = useAccountCategories({ includeArchived: true });
  const currentMonthKey = monthKeyFor(new Date());

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [color, setColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<string>(DEFAULT_ACCOUNT_ICON);
  const [accountNumber, setAccountNumber] = useState('');
  const [qrImageUri, setQrImageUri] = useState<string | null>(null);
  const [balanceText, setBalanceText] = useState('0');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [monthlyAmountDueText, setMonthlyAmountDueText] = useState('');
  const [remainingMonths, setRemainingMonths] = useState(0);
  const [monthlyDueLastPaidMonth, setMonthlyDueLastPaidMonth] = useState<string | null>(null);
  const [transactionEffect, setTransactionEffect] = useState(0);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedCategory = accountCategories.find((c) => c.id === categoryId);
  const isCreditCardKind = selectedCategory?.kind === 'credit_card';

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getAccountWithBalance(db, accountId);
      if (!existing || cancelled) return;
      setName(existing.name);
      setCategoryId(existing.categoryId);
      setColor(existing.color);
      setIcon(existing.icon ?? DEFAULT_ACCOUNT_ICON);
      setAccountNumber(existing.accountNumber ?? '');
      setQrImageUri(existing.qrImageUri ?? null);
      setBalanceText(String(fromMinorUnits(existing.balance)));
      setIncludeInNetWorth(existing.includeInNetWorth);
      setMonthlyAmountDueText(existing.monthlyAmountDue != null ? String(fromMinorUnits(existing.monthlyAmountDue)) : '');
      setRemainingMonths(existing.remainingMonths ?? 0);
      setMonthlyDueLastPaidMonth(existing.monthlyDueLastPaidMonth ?? null);
      setTransactionEffect(existing.balance - existing.startingBalance);
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
    const enteredBalance = toMinorUnits(balanceText);
    if (enteredBalance == null) {
      setError('Enter a valid balance.');
      return;
    }
    const startingBalance = enteredBalance - transactionEffect;
    if (categoryId == null) {
      setError('Choose an account category.');
      return;
    }
    let monthlyAmountDue: number | null = null;
    if (isCreditCardKind && monthlyAmountDueText.trim()) {
      monthlyAmountDue = toMinorUnits(monthlyAmountDueText);
      if (monthlyAmountDue == null) {
        setError('Enter a valid monthly amount due.');
        return;
      }
    }

    setSaving(true);
    try {
      const input = {
        name: trimmed,
        categoryId,
        color,
        icon,
        accountNumber,
        qrImageUri,
        startingBalance,
        includeInNetWorth,
        monthlyAmountDue,
        remainingMonths: isCreditCardKind ? remainingMonths : null,
      };
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

  async function handleMarkDueUnpaid() {
    if (!isEditing) return;
    await markMonthlyDueUnpaid(accountId);
    setMonthlyDueLastPaidMonth(null);
    setRemainingMonths((value) => value + 1);
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
        <Text style={styles.label}>Balance</Text>
        <AmountInput value={balanceText} onChangeText={setBalanceText} />
      </View>

      {isCreditCardKind ? (
        <View style={styles.field}>
          <Text style={styles.label}>Monthly amount due (optional)</Text>
          <AmountInput value={monthlyAmountDueText} onChangeText={setMonthlyAmountDueText} />
        </View>
      ) : null}

      {isCreditCardKind ? (
        <View style={styles.field}>
          <Text style={styles.label}>Remaining months (optional)</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperButton} onPress={() => setRemainingMonths((value) => Math.max(0, value - 1))}>
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{remainingMonths}</Text>
            <Pressable style={styles.stepperButton} onPress={() => setRemainingMonths((value) => value + 1)}>
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
            <Text style={styles.stepperUnit}>{remainingMonths === 1 ? 'month left' : 'months left'}</Text>
          </View>
        </View>
      ) : null}

      {isCreditCardKind && monthlyDueLastPaidMonth === currentMonthKey ? (
        <Pressable style={styles.undoRow} onPress={handleMarkDueUnpaid}>
          <Text style={styles.undoText}>This month's due is marked as paid</Text>
          <Text style={styles.undoAction}>Undo</Text>
        </Pressable>
      ) : null}

      <View style={styles.toggleRow}>
        <View style={styles.toggleTextGroup}>
          <Text style={styles.label}>Include in net worth</Text>
          <Text style={styles.helperText}>
            Turn off to exclude this account's balance from the net worth total — useful for loans owed to you or accounts you're just tracking.
          </Text>
        </View>
        <Switch value={includeInNetWorth} onValueChange={setIncludeInNetWorth} trackColor={{ true: PALETTE.net }} />
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleTextGroup: { flex: 1, gap: 4 },
  helperText: { fontSize: 12, color: PALETTE.textSecondary, lineHeight: 16 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  stepperButtonText: { fontSize: 20, fontWeight: '700', color: PALETTE.textPrimary },
  stepperValue: { fontSize: 18, fontWeight: '700', color: PALETTE.textPrimary, minWidth: 28, textAlign: 'center' },
  stepperUnit: { fontSize: 13, color: PALETTE.textSecondary },
  undoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: `${PALETTE.net}1A`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  undoText: { flex: 1, fontSize: 13, fontWeight: '600', color: PALETTE.textPrimary },
  undoAction: { fontSize: 13, fontWeight: '700', color: PALETTE.net },
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
