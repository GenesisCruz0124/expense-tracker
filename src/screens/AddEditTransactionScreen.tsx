import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { AccountPicker } from '../components/AccountPicker';
import { AmountInput } from '../components/AmountInput';
import { CategoryPicker } from '../components/CategoryPicker';
import { DateField } from '../components/DateField';
import { ReceiptImagePicker } from '../components/ReceiptImagePicker';
import { PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getTransaction, getTransferLegs, listEstablishments } from '../db/queries/transactions';
import { useTransactions } from '../hooks/useTransactions';
import { fromMinorUnits, toMinorUnits } from '../utils/currency';
import { formatIsoDate } from '../utils/dateRanges';
import type { RootStackParamList } from '../navigation/types';

type TransactionType = 'expense' | 'income' | 'transfer';

export default function AddEditTransactionScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditTransaction'>>();
  const transactionId = route.params?.transactionId;
  const initialAccountId = route.params?.accountId ?? null;
  const isEditing = transactionId != null;

  const { db } = useDatabase();
  const { createTransaction, updateTransaction, deleteTransaction, createTransfer, updateTransfer, deleteTransfer } =
    useTransactions();

  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [feeText, setFeeText] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(initialAccountId);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [transferId, setTransferId] = useState<number | null>(null);
  const [occurredAt, setOccurredAt] = useState(() => formatIsoDate(new Date()));
  const [establishment, setEstablishment] = useState('');
  const [establishmentSuggestions, setEstablishmentSuggestions] = useState<string[]>([]);
  const [establishmentFocused, setEstablishmentFocused] = useState(false);
  const [note, setNote] = useState('');
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const [excludeFromExpense, setExcludeFromExpense] = useState(false);
  const [includeTransferAsExpense, setIncludeTransferAsExpense] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getTransaction(db, transactionId);
      if (!existing || cancelled) {
        setLoading(false);
        return;
      }

      if (existing.transferId != null) {
        const legs = await getTransferLegs(db, existing.transferId);
        if (!legs || cancelled) {
          setLoading(false);
          return;
        }
        setType('transfer');
        setTransferId(legs.transferId);
        setAmountText(String(fromMinorUnits(legs.fromTransaction.amount)));
        setFeeText(legs.fromTransaction.fee ? String(fromMinorUnits(legs.fromTransaction.fee)) : '');
        setAccountId(legs.fromTransaction.accountId);
        setToAccountId(legs.toTransaction.accountId);
        setOccurredAt(legs.fromTransaction.occurredAt);
        setNote(legs.fromTransaction.note ?? '');
        setReceiptImageUri(legs.fromTransaction.receiptImageUri);
        setIncludeTransferAsExpense(!legs.fromTransaction.excludeFromExpense);
        setCategoryId(legs.fromTransaction.categoryId);
        setLoading(false);
        return;
      }

      setType(existing.type);
      setAmountText(String(fromMinorUnits(existing.amount)));
      setFeeText(existing.fee ? String(fromMinorUnits(existing.fee)) : '');
      setCategoryId(existing.categoryId);
      setAccountId(existing.accountId);
      setOccurredAt(existing.occurredAt);
      setEstablishment(existing.establishment ?? '');
      setNote(existing.note ?? '');
      setReceiptImageUri(existing.receiptImageUri);
      setExcludeFromExpense(existing.excludeFromExpense);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isEditing, transactionId]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit transaction' : 'Add transaction' });
  }, [navigation, isEditing]);

  useEffect(() => {
    listEstablishments(db).then(setEstablishmentSuggestions);
  }, [db]);

  const matchingEstablishments = establishment.trim()
    ? establishmentSuggestions.filter(
        (name) =>
          name.toLowerCase().includes(establishment.trim().toLowerCase()) &&
          name.toLowerCase() !== establishment.trim().toLowerCase(),
      )
    : establishmentSuggestions;

  function handleSelectEstablishment(name: string) {
    setEstablishment(name);
    setEstablishmentFocused(false);
  }

  function handleEstablishmentBlur() {
    // Delay hiding so a tap on a suggestion below still registers before the list unmounts.
    setTimeout(() => setEstablishmentFocused(false), 150);
  }

  function handleTypeChange(nextType: TransactionType) {
    if (nextType === type) return;
    setType(nextType);
    setCategoryId(null);
    if (nextType === 'transfer') {
      setExcludeFromExpense(false);
      setIncludeTransferAsExpense(false);
      setToAccountId(null);
      setFeeText('');
    }
  }

  async function handleSave() {
    setError(null);
    const amount = toMinorUnits(amountText);
    if (amount == null || amount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    const fee = feeText.trim() ? toMinorUnits(feeText) : 0;
    if (fee == null) {
      setError('Enter a valid fee amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) {
      setError('Enter a valid date in YYYY-MM-DD format.');
      return;
    }

    if (type === 'transfer') {
      if (!accountId || !toAccountId) {
        setError('Choose both a from and to account.');
        return;
      }
      if (accountId === toAccountId) {
        setError('Choose two different accounts to transfer between.');
        return;
      }

      setSaving(true);
      try {
        const input = {
          fromAccountId: accountId,
          toAccountId,
          amount,
          fee: fee ?? 0,
          occurredAt,
          note: note.trim() || null,
          receiptImageUri,
          includeAsExpense: includeTransferAsExpense,
          categoryId: includeTransferAsExpense ? categoryId : null,
        };
        if (transferId != null) {
          await updateTransfer(transferId, input);
        } else {
          await createTransfer(input);
        }
        navigation.goBack();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong while saving.');
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const input = {
        type,
        amount,
        fee,
        occurredAt,
        note: note.trim() || null,
        establishment: establishment.trim() || null,
        categoryId,
        accountId,
        receiptImageUri,
        excludeFromExpense,
      };
      if (isEditing) {
        await updateTransaction(transactionId, input);
      } else {
        await createTransaction(input);
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
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (transferId != null) {
            await deleteTransfer(transferId);
          } else if (type !== 'transfer') {
            await deleteTransaction(transactionId, type, occurredAt);
          }
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
      <View style={styles.typeToggle}>
        {(['expense', 'income', 'transfer'] as const).map((option) => {
          const selected = option === type;
          const tone = option === 'expense' ? PALETTE.expense : option === 'income' ? PALETTE.income : PALETTE.net;
          return (
            <Pressable
              key={option}
              onPress={() => handleTypeChange(option)}
              style={[styles.typeOption, selected && { backgroundColor: tone, borderColor: tone }]}
            >
              <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                {option === 'expense' ? 'Expense' : option === 'income' ? 'Income' : 'Transfer'}
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
        <Text style={styles.label}>{type === 'transfer' ? 'Transfer fee (optional)' : 'Fee (optional)'}</Text>
        <AmountInput value={feeText} onChangeText={setFeeText} />
      </View>

      {type !== 'transfer' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <CategoryPicker forType={type} selectedCategoryId={categoryId} onSelect={setCategoryId} sortBy="recent" />
        </View>
      ) : null}

      {type === 'transfer' ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>From account</Text>
            <AccountPicker selectedAccountId={accountId} onSelect={setAccountId} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>To account</Text>
            <AccountPicker selectedAccountId={toAccountId} onSelect={setToAccountId} />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <Text style={styles.label}>Count as expense in reports</Text>
              <Text style={styles.helperText}>
                Include this transfer's amount in expense totals and reports — useful when the "transfer" is really a
                purchase, e.g. paying through a bank app.
              </Text>
            </View>
            <Switch
              value={includeTransferAsExpense}
              onValueChange={(value) => {
                setIncludeTransferAsExpense(value);
                if (!value) setCategoryId(null);
              }}
              trackColor={{ true: PALETTE.net }}
            />
          </View>
          {includeTransferAsExpense ? (
            <View style={styles.field}>
              <Text style={styles.label}>Category</Text>
              <CategoryPicker forType="expense" selectedCategoryId={categoryId} onSelect={setCategoryId} sortBy="recent" />
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Account</Text>
          <AccountPicker selectedAccountId={accountId} onSelect={setAccountId} />
        </View>
      )}

      <View style={styles.field}>
        <DateField label="Date" value={occurredAt} onChangeText={setOccurredAt} />
      </View>

      {type !== 'transfer' ? (
        <View style={[styles.field, styles.establishmentField]}>
          <Text style={styles.label}>Establishment</Text>
          <TextInput
            style={styles.input}
            value={establishment}
            onChangeText={setEstablishment}
            onFocus={() => setEstablishmentFocused(true)}
            onBlur={handleEstablishmentBlur}
            placeholder="e.g. Jollibee, SM Mall"
            placeholderTextColor={PALETTE.textSecondary}
          />
          {establishmentFocused && matchingEstablishments.length > 0 ? (
            <View style={styles.suggestionList}>
              {matchingEstablishments.slice(0, 6).map((name) => (
                <Pressable
                  key={name}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectEstablishment(name)}
                >
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>Note</Text>
        <TextInput
          style={styles.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Optional note"
          placeholderTextColor={PALETTE.textSecondary}
          multiline
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Receipt</Text>
        <ReceiptImagePicker uri={receiptImageUri} onChange={setReceiptImageUri} />
      </View>

      {type !== 'transfer' ? (
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextGroup}>
            <Text style={styles.label}>Exclude from reports</Text>
            <Text style={styles.helperText}>
              Skip this transaction in reports and totals — useful for transfers, refunds, or reimbursements.
            </Text>
          </View>
          <Switch value={excludeFromExpense} onValueChange={setExcludeFromExpense} trackColor={{ true: PALETTE.net }} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add transaction'}</Text>
      </Pressable>

      {isEditing ? (
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete transaction</Text>
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
  establishmentField: { position: 'relative', zIndex: 10 },
  label: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  suggestionList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  suggestionText: { fontSize: 14, color: PALETTE.textPrimary },
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
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  deleteButton: { alignItems: 'center', paddingVertical: 10 },
  deleteButtonText: { color: PALETTE.danger, fontSize: 14, fontWeight: '600' },
});
