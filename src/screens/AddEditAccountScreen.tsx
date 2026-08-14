import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';

import { AccountCategoryPicker } from '../components/AccountCategoryPicker';
import { ActionSheet } from '../components/ActionSheet';
import { AmountInput } from '../components/AmountInput';
import { QrImagePicker } from '../components/QrImagePicker';
import { ACCOUNT_ICON_OPTIONS, ACCOUNT_LOGO_OPTIONS, DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { AccountIcon } from '../components/AccountIcon';
import { CATEGORY_COLOR_PALETTE, PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getAccountWithBalance } from '../db/queries/accounts';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency, fromMinorUnits, toMinorUnits } from '../utils/currency';
import { formatDisplayDate, formatIsoDate, monthKeyFor } from '../utils/dateRanges';
import type { RootStackParamList } from '../navigation/types';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default function AddEditAccountScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditAccount'>>();
  const accountId = route.params?.accountId;
  const isEditing = accountId != null;

  const { db } = useDatabase();
  const { accounts, createAccount, updateAccount, markMonthlyDuePaid, markMonthlyDueUnpaid } = useAccounts({
    includeArchived: true,
  });
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
  const [creditLimitText, setCreditLimitText] = useState('');
  const [linkedCreditCardId, setLinkedCreditCardId] = useState<number | null>(null);
  const [showCreditCardPicker, setShowCreditCardPicker] = useState(false);
  const [sharedCreditLimitAccountId, setSharedCreditLimitAccountId] = useState<number | null>(null);
  const [showSharedLimitPicker, setShowSharedLimitPicker] = useState(false);
  const [showPaymentSourcePicker, setShowPaymentSourcePicker] = useState(false);
  const [remainingMonths, setRemainingMonths] = useState(0);
  const [monthlyDueLastPaidMonth, setMonthlyDueLastPaidMonth] = useState<string | null>(null);
  const [monthlyContributionText, setMonthlyContributionText] = useState('');
  const [balanceLastUpdatedAt, setBalanceLastUpdatedAt] = useState<string | null>(null);
  const [totalMonths, setTotalMonths] = useState(0);
  const [subscriptionDueDay, setSubscriptionDueDay] = useState<number | null>(null);
  const [interestRateText, setInterestRateText] = useState('');
  const [interestFrequency, setInterestFrequency] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [paymentSource, setPaymentSource] = useState('');
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState<number | null>(null);
  const [transactionEffect, setTransactionEffect] = useState(0);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedCategory = accountCategories.find((c) => c.id === categoryId);
  const isCreditCardKind = selectedCategory?.kind === 'credit_card';
  const isInvestmentKind = selectedCategory?.kind === 'investment';

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
      setCreditLimitText(existing.creditLimit != null ? String(fromMinorUnits(existing.creditLimit)) : '');
      setLinkedCreditCardId(existing.linkedCreditCardId ?? null);
      setSharedCreditLimitAccountId(existing.sharedCreditLimitAccountId ?? null);
      setRemainingMonths(existing.remainingMonths ?? 0);
      setMonthlyDueLastPaidMonth(existing.monthlyDueLastPaidMonth ?? null);
      setMonthlyContributionText(existing.monthlyContribution != null ? String(fromMinorUnits(existing.monthlyContribution)) : '');
      setBalanceLastUpdatedAt(existing.balanceLastUpdatedAt ?? null);
      setTotalMonths(existing.totalMonths ?? 0);
      setSubscriptionDueDay(existing.subscriptionDueDay ?? null);
      setInterestRateText(existing.annualInterestRate != null ? String(existing.annualInterestRate / 100) : '');
      setInterestFrequency((existing.interestFrequency as 'daily' | 'monthly' | 'yearly') ?? 'daily');
      setPaymentSource(existing.paymentSource ?? '');
      setPaymentSourceAccountId(existing.paymentSourceAccountId ?? null);
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
    let creditLimit: number | null = null;
    if (isCreditCardKind && creditLimitText.trim()) {
      creditLimit = toMinorUnits(creditLimitText);
      if (creditLimit == null) {
        setError('Enter a valid credit limit.');
        return;
      }
    }
    let monthlyContribution: number | null = null;
    if (isInvestmentKind && monthlyContributionText.trim()) {
      monthlyContribution = toMinorUnits(monthlyContributionText);
      if (monthlyContribution == null) {
        setError('Enter a valid monthly amount.');
        return;
      }
    }
    let annualInterestRate: number | null = null;
    if (interestRateText.trim()) {
      annualInterestRate = Math.round(parseFloat(interestRateText) * 100);
      if (isNaN(annualInterestRate) || annualInterestRate <= 0) {
        setError('Enter a valid annual interest rate (e.g. 3.25).');
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
        creditLimit,
        linkedCreditCardId: isCreditCardKind ? linkedCreditCardId : null,
        remainingMonths: isCreditCardKind ? remainingMonths : null,
        subscriptionDueDay: isCreditCardKind ? subscriptionDueDay : null,
        monthlyContribution,
        balanceLastUpdatedAt,
        annualInterestRate,
        interestFrequency: annualInterestRate != null ? interestFrequency : null,
        paymentSource: isCreditCardKind || isInvestmentKind ? paymentSource : null,
        paymentSourceAccountId: isCreditCardKind || isInvestmentKind ? paymentSourceAccountId : null,
        sharedCreditLimitAccountId: isCreditCardKind ? sharedCreditLimitAccountId : null,
      };
      if (isEditing) {
        await updateAccount(accountId, { ...input, totalMonths });
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

  async function handleMarkDuePaid() {
    if (!isEditing) return;
    await markMonthlyDuePaid(accountId, currentMonthKey, formatIsoDate(new Date()));
    setMonthlyDueLastPaidMonth(currentMonthKey);
    setRemainingMonths((value) => (value > 0 ? value - 1 : value));
    setTotalMonths((value) => value + 1);
    const amountDue = toMinorUnits(monthlyAmountDueText);
    const currentBalance = toMinorUnits(balanceText);
    if (amountDue != null && currentBalance != null) {
      setBalanceText(String(fromMinorUnits(currentBalance - amountDue)));
      setBalanceLastUpdatedAt(formatIsoDate(new Date()));
    }
  }

  async function handleMarkDueUnpaid() {
    if (!isEditing) return;
    await markMonthlyDueUnpaid(accountId);
    setMonthlyDueLastPaidMonth(null);
    setRemainingMonths((value) => value + 1);
    setTotalMonths((value) => Math.max(0, value - 1));
    const amountDue = toMinorUnits(monthlyAmountDueText);
    const currentBalance = toMinorUnits(balanceText);
    if (amountDue != null && currentBalance != null) {
      setBalanceText(String(fromMinorUnits(currentBalance + amountDue)));
    }
  }

  function handleIncrementBalance() {
    const contribution = toMinorUnits(monthlyContributionText);
    const currentBalance = toMinorUnits(balanceText);
    if (contribution == null || currentBalance == null) return;
    setBalanceText(String(fromMinorUnits(currentBalance + contribution)));
    setBalanceLastUpdatedAt(formatIsoDate(new Date()));
    setTotalMonths((value) => value + 1);
  }

  /**
   * Payment source is either one of the user's own accounts or an untracked source like a salary
   * deduction, so the picker offers both. `paymentSource` keeps the display label (used to group
   * dues on the Recurring tab) and `paymentSourceAccountId` links the account when there is one.
   */
  function renderPaymentSourceField(helper: string) {
    const selectableAccounts = accounts.filter((a) => a.id !== accountId && !a.isArchived);
    return (
      <View style={styles.field}>
        <Text style={styles.label}>Payment source (optional)</Text>
        <Pressable style={styles.pickerRow} onPress={() => setShowPaymentSourcePicker(true)}>
          <Text style={[styles.pickerRowText, !paymentSource && styles.pickerRowPlaceholder]}>
            {paymentSource || 'None — tap to select'}
          </Text>
          {paymentSource ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setPaymentSource('');
                setPaymentSourceAccountId(null);
              }}
              hitSlop={8}
            >
              <Text style={styles.pickerRowClear}>✕</Text>
            </Pressable>
          ) : (
            <Text style={styles.pickerRowChevron}>›</Text>
          )}
        </Pressable>
        <Text style={styles.helperText}>{helper}</Text>
        <ActionSheet
          visible={showPaymentSourcePicker}
          onClose={() => setShowPaymentSourcePicker(false)}
          title="Select payment source"
          options={[
            {
              label: 'Salary deduction',
              onPress: () => {
                setPaymentSource('Salary deduction');
                setPaymentSourceAccountId(null);
                setShowPaymentSourcePicker(false);
              },
            },
            ...selectableAccounts.map((a) => ({
              label: a.name,
              onPress: () => {
                setPaymentSource(a.name);
                setPaymentSourceAccountId(a.id);
                setShowPaymentSourcePicker(false);
              },
            })),
          ]}
        />
      </View>
    );
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

      <View style={styles.field}>
        <Text style={styles.label}>Annual interest rate (optional)</Text>
        <View style={styles.interestRateRow}>
          <TextInput
            style={[styles.input, styles.interestRateInput]}
            value={interestRateText}
            onChangeText={setInterestRateText}
            placeholder="e.g. 3.25"
            placeholderTextColor={PALETTE.textSecondary}
            keyboardType="decimal-pad"
          />
          <Text style={styles.interestRateUnit}>% p.a.</Text>
        </View>
        <Text style={styles.helperText}>Leave blank if this account doesn't earn interest.</Text>
      </View>

      {interestRateText.trim() ? (
        <View style={styles.field}>
          <Text style={styles.label}>Interest credited</Text>
          <View style={styles.freqRow}>
            {(['daily', 'monthly', 'yearly'] as const).map((freq) => (
              <Pressable
                key={freq}
                style={[styles.freqChip, interestFrequency === freq && styles.freqChipSelected]}
                onPress={() => setInterestFrequency(freq)}
              >
                <Text style={[styles.freqChipText, interestFrequency === freq && styles.freqChipTextSelected]}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {isCreditCardKind ? (
        <View style={styles.field}>
          <Text style={styles.label}>Monthly amount due (optional)</Text>
          <AmountInput value={monthlyAmountDueText} onChangeText={setMonthlyAmountDueText} />
        </View>
      ) : null}

      {isCreditCardKind
        ? renderPaymentSourceField('Groups this due on the Recurring tab, and is the account charged when you mark it paid.')
        : null}

      {isCreditCardKind ? (
        <View style={styles.field}>
          <Text style={styles.label}>Credit limit (optional)</Text>
          <AmountInput value={creditLimitText} onChangeText={setCreditLimitText} />
        </View>
      ) : null}

      {isCreditCardKind ? (() => {
        const shareableAccounts = accounts.filter((a) => {
          const cat = accountCategories.find((c) => c.id === a.categoryId);
          return cat?.kind === 'credit_card' && a.creditLimit != null && a.id !== accountId;
        });
        const sharedWith = accounts.find((a) => a.id === sharedCreditLimitAccountId);
        return (
          <View style={styles.field}>
            <Text style={styles.label}>Shares credit limit with (optional)</Text>
            <Pressable style={styles.pickerRow} onPress={() => setShowSharedLimitPicker(true)}>
              <Text style={[styles.pickerRowText, !sharedWith && styles.pickerRowPlaceholder]}>
                {sharedWith ? sharedWith.name : 'None — tap to select'}
              </Text>
              {sharedWith ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); setSharedCreditLimitAccountId(null); }}
                  hitSlop={8}
                >
                  <Text style={styles.pickerRowClear}>✕</Text>
                </Pressable>
              ) : (
                <Text style={styles.pickerRowChevron}>›</Text>
              )}
            </Pressable>
            <Text style={styles.helperText}>
              For cards that share one combined limit — available credit is calculated across both.
            </Text>
            <ActionSheet
              visible={showSharedLimitPicker}
              onClose={() => setShowSharedLimitPicker(false)}
              title="Select card sharing this limit"
              options={shareableAccounts.map((a) => ({
                label: a.name,
                onPress: () => { setSharedCreditLimitAccountId(a.id); setShowSharedLimitPicker(false); },
              }))}
            />
          </View>
        );
      })() : null}

      {isCreditCardKind ? (() => {
        const creditCardAccounts = accounts.filter(
          (a) => {
            const cat = accountCategories.find((c) => c.id === a.categoryId);
            return cat?.kind === 'credit_card' && a.creditLimit != null && a.id !== accountId;
          }
        );
        const linked = accounts.find((a) => a.id === linkedCreditCardId);
        return (
          <View style={styles.field}>
            <Text style={styles.label}>Linked credit card (optional)</Text>
            <Pressable style={styles.pickerRow} onPress={() => setShowCreditCardPicker(true)}>
              <Text style={[styles.pickerRowText, !linked && styles.pickerRowPlaceholder]}>
                {linked ? linked.name : 'None — tap to select'}
              </Text>
              {linked ? (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); setLinkedCreditCardId(null); }}
                  hitSlop={8}
                >
                  <Text style={styles.pickerRowClear}>✕</Text>
                </Pressable>
              ) : (
                <Text style={styles.pickerRowChevron}>›</Text>
              )}
            </Pressable>
            <ActionSheet
              visible={showCreditCardPicker}
              onClose={() => setShowCreditCardPicker(false)}
              title="Select credit card"
              options={creditCardAccounts.map((a) => ({
                label: a.name,
                onPress: () => { setLinkedCreditCardId(a.id); setShowCreditCardPicker(false); },
              }))}
            />
          </View>
        );
      })() : null}

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

      {isCreditCardKind ? (
        <View style={styles.field}>
          <Text style={styles.label}>Due day (optional)</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setSubscriptionDueDay((d) => (d != null && d > 1 ? d - 1 : d))}
              disabled={subscriptionDueDay == null || subscriptionDueDay <= 1}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{subscriptionDueDay != null ? subscriptionDueDay : '—'}</Text>
            <Pressable
              style={styles.stepperButton}
              onPress={() => setSubscriptionDueDay((d) => (d != null ? Math.min(31, d + 1) : 1))}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
            <Text style={styles.stepperUnit}>
              {subscriptionDueDay != null ? `${ordinal(subscriptionDueDay)} of each month` : 'not set'}
            </Text>
            {subscriptionDueDay != null ? (
              <Pressable onPress={() => setSubscriptionDueDay(null)} hitSlop={8}>
                <Text style={styles.pickerRowClear}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {isCreditCardKind && isEditing && toMinorUnits(monthlyAmountDueText) != null ? (
        monthlyDueLastPaidMonth === currentMonthKey ? (
          <Pressable style={styles.undoRow} onPress={handleMarkDueUnpaid}>
            <Text style={styles.undoText}>This month's due is marked as paid</Text>
            <Text style={styles.undoAction}>Undo</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.undoRow} onPress={handleMarkDuePaid}>
            <View style={styles.toggleTextGroup}>
              <Text style={styles.undoText}>Mark this month's due as paid</Text>
              <Text style={styles.helperText}>Subtracts the monthly amount from the balance above.</Text>
            </View>
            <Text style={styles.undoAction}>−{formatCurrency(toMinorUnits(monthlyAmountDueText)!)}</Text>
          </Pressable>
        )
      ) : null}

      {isCreditCardKind && isEditing ? (
        <View style={styles.field}>
          <Text style={styles.label}>Total months paid</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperButton} onPress={() => setTotalMonths((v) => Math.max(0, v - 1))}>
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{totalMonths}</Text>
            <Pressable style={styles.stepperButton} onPress={() => setTotalMonths((v) => v + 1)}>
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
            <Text style={styles.stepperUnit}>{totalMonths === 1 ? 'month' : 'months'}</Text>
          </View>
        </View>
      ) : null}

      {isInvestmentKind ? (
        <View style={styles.field}>
          <Text style={styles.label}>Monthly amount (optional)</Text>
          <AmountInput value={monthlyContributionText} onChangeText={setMonthlyContributionText} />
        </View>
      ) : null}

      {isInvestmentKind ? renderPaymentSourceField('Used to group this contribution on the Recurring tab.') : null}

      {isInvestmentKind ? (
        <View style={styles.field}>
          <Text style={styles.label}>Total months contributed</Text>
          <View style={styles.stepperRow}>
            <Pressable style={styles.stepperButton} onPress={() => setTotalMonths((v) => Math.max(0, v - 1))}>
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{totalMonths}</Text>
            <Pressable style={styles.stepperButton} onPress={() => setTotalMonths((v) => v + 1)}>
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
            <Text style={styles.stepperUnit}>{totalMonths === 1 ? 'month' : 'months'}</Text>
          </View>
        </View>
      ) : null}

      {isInvestmentKind && isEditing && toMinorUnits(monthlyContributionText) != null ? (
        <Pressable style={styles.undoRow} onPress={handleIncrementBalance}>
          <View style={styles.toggleTextGroup}>
            <Text style={styles.undoText}>Add this month's amount to the balance</Text>
            {balanceLastUpdatedAt ? (
              <Text style={styles.helperText}>Last updated {formatDisplayDate(balanceLastUpdatedAt)}</Text>
            ) : null}
          </View>
          <Text style={styles.undoAction}>+{formatCurrency(toMinorUnits(monthlyContributionText)!)}</Text>
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
          {[...ACCOUNT_ICON_OPTIONS, ...ACCOUNT_LOGO_OPTIONS].map((option) => (
            <Pressable
              key={option}
              onPress={() => setIcon(option)}
              style={[styles.iconOption, option === icon && styles.iconOptionSelected]}
            >
              <AccountIcon icon={option} size={20} textStyle={styles.iconOptionText} />
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
    </KeyboardAvoidingView>
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
  interestRateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  interestRateInput: { flex: 1 },
  interestRateUnit: { fontSize: 14, color: PALETTE.textSecondary, fontWeight: '600' },
  freqRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  freqChip: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, borderColor: PALETTE.border, alignItems: 'center', backgroundColor: PALETTE.surface },
  freqChipSelected: { borderColor: PALETTE.net, backgroundColor: PALETTE.net },
  freqChipText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  freqChipTextSelected: { color: '#fff' },
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
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pickerRowText: { fontSize: 15, color: PALETTE.textPrimary, flex: 1 },
  pickerRowPlaceholder: { color: PALETTE.textSecondary },
  pickerRowChevron: { fontSize: 20, color: PALETTE.textSecondary },
  pickerRowClear: { fontSize: 14, color: PALETTE.textSecondary, fontWeight: '700', paddingLeft: 8 },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
