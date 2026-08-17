import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { addMonths } from 'date-fns';

import { CategoryBadge, UncategorizedBadge } from '../components/CategoryBadge';
import { DateField } from '../components/DateField';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { AccountWithBalance } from '../db/queries/accounts';
import type { BillWithDetails } from '../db/queries/bills';
import type { TransactionWithCategory } from '../db/queries/transactions';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { useBills } from '../hooks/useBills';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { useTransactions } from '../hooks/useTransactions';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, monthRangeFor } from '../utils/dateRanges';
import { frequencyLabelFor } from '../utils/bills';

type PaidListItem =
  | { kind: 'bill'; data: BillWithDetails }
  | { kind: 'due'; data: AccountWithBalance }
  | { kind: 'recurring'; data: TransactionWithCategory };

interface SourceSection {
  title: string;
  total: number;
  /** Current balance across the accounts that funded this group, or null when none are tracked. */
  balance: number | null;
  data: PaidListItem[];
}

const UNGROUPED_LAST = ['Payroll deduction', 'Other'];

export default function PaidBillsScreen() {
  const navigation = useNavigation();
  const { bills, unpayBill, updatePaidDate } = useBills();
  const { accounts, markMonthlyDueUnpaid, updateMonthlyDuePaidDate } = useAccounts();
  const { accountCategories } = useAccountCategories();
  const { undoPaid: undoRecurringPaid } = useRecurringTransactions();
  const [monthOffset, setMonthOffset] = useState(0);
  const viewedDate = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);
  const { start, end, label, monthKey } = monthRangeFor(viewedDate);
  const isCurrentMonth = monthOffset === 0;
  const { transactions: monthTransactions } = useTransactions({ start, end });
  const [searchText, setSearchText] = useState('');

  const paidThisMonth = useMemo(() => {
    return bills
      .filter((bill) => bill.lastPaidAt != null && bill.lastPaidAt >= start && bill.lastPaidAt <= end)
      .sort((a, b) => b.lastPaidAt!.localeCompare(a.lastPaidAt!));
  }, [bills, start, end]);

  const paidDuesThisMonth = useMemo(() => {
    return accounts.filter(
      (account) => account.monthlyAmountDue != null && account.monthlyDueLastPaidMonth === monthKey,
    );
  }, [accounts, monthKey]);

  const paidRecurringThisMonth = useMemo(
    () => monthTransactions.filter((transaction) => transaction.recurringId != null),
    [monthTransactions],
  );

  const combinedList = useMemo((): PaidListItem[] => {
    const q = searchText.trim().toLowerCase();
    const billItems: PaidListItem[] = paidThisMonth
      .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.accountName ?? '').toLowerCase().includes(q))
      .map((data) => ({ kind: 'bill', data }));
    const dueItems: PaidListItem[] = paidDuesThisMonth
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .map((data) => ({ kind: 'due', data }));
    const recurringItems: PaidListItem[] = paidRecurringThisMonth
      .filter((t) => !q || (t.note ?? '').toLowerCase().includes(q) || (t.establishment ?? '').toLowerCase().includes(q))
      .map((data) => ({ kind: 'recurring', data }));
    return [...billItems, ...dueItems, ...recurringItems];
  }, [paidThisMonth, paidDuesThisMonth, paidRecurringThisMonth, searchText]);

  const transactionById = useMemo(
    () => new Map(monthTransactions.map((transaction) => [transaction.id, transaction])),
    [monthTransactions],
  );
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(() => new Map(accountCategories.map((category) => [category.id, category])), [accountCategories]);

  /**
   * `paymentSource` is free text captured when the source was chosen, so it goes stale if the
   * account is later renamed. Resolve the live name through `paymentSourceAccountId` first and
   * only fall back to the stored text for untracked sources like a salary deduction.
   */
  function paymentSourceLabel(account: AccountWithBalance): string | null {
    if (account.paymentSourceAccountId != null) {
      const source = accountById.get(account.paymentSourceAccountId);
      if (source) return source.name;
    }
    return account.paymentSource?.trim() || null;
  }

  function sourceLabelFor(item: PaidListItem): string {
    if (item.kind === 'due') {
      return paymentSourceLabel(item.data) || categoryById.get(item.data.categoryId ?? -1)?.name || 'Other';
    }
    const accountId = item.data.accountId;
    if (accountId == null) return 'Payroll deduction';
    const account = accountById.get(accountId);
    if (!account) return 'Other';
    return paymentSourceLabel(account) || categoryById.get(account.categoryId ?? -1)?.name || 'Other';
  }

  /** The account the money came out of, or null for untracked sources like a salary deduction. */
  function sourceAccountIdFor(item: PaidListItem): number | null {
    if (item.kind === 'due') return item.data.paymentSourceAccountId ?? null;
    return item.data.accountId ?? null;
  }

  function itemSignedAmount(item: PaidListItem): number {
    if (item.kind === 'recurring') {
      return item.data.type === 'income' ? -item.data.amount : item.data.amount;
    }
    return item.kind === 'bill' ? item.data.amount : item.data.monthlyAmountDue ?? 0;
  }

  const sourceSections = useMemo((): SourceSection[] => {
    const byLabel = new Map<string, SourceSection>();
    // Distinct funding accounts per group, so an account shared by several items is only counted
    // once toward the group's balance.
    const accountIdsByLabel = new Map<string, Set<number>>();
    for (const item of combinedList) {
      const label = sourceLabelFor(item);
      let section = byLabel.get(label);
      if (!section) {
        section = { title: label, total: 0, balance: null, data: [] };
        byLabel.set(label, section);
        accountIdsByLabel.set(label, new Set());
      }
      section.total += itemSignedAmount(item);
      section.data.push(item);
      const sourceId = sourceAccountIdFor(item);
      if (sourceId != null) accountIdsByLabel.get(label)!.add(sourceId);
    }

    for (const [label, ids] of accountIdsByLabel) {
      const section = byLabel.get(label)!;
      // Groups funded by an untracked source (salary-deducted loans, say) have no source account
      // to report, so fall back to what the paid accounts themselves are still carrying.
      const targetIds =
        ids.size > 0
          ? ids
          : new Set(section.data.filter((item) => item.kind === 'due').map((item) => item.data.id));

      let balance = 0;
      let found = false;
      for (const id of targetIds) {
        const account = accountById.get(id);
        if (!account) continue;
        const kind = categoryById.get(account.categoryId ?? -1)?.kind;
        balance += kind === 'credit_card' ? -account.balance : account.balance;
        found = true;
      }
      if (found) section.balance = balance;
    }

    return Array.from(byLabel.values()).sort((a, b) => {
      const aLast = UNGROUPED_LAST.includes(a.title);
      const bLast = UNGROUPED_LAST.includes(b.title);
      if (aLast !== bLast) return aLast ? 1 : -1;
      return b.total - a.total;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedList, accountById, categoryById]);

  const totalPaid = useMemo(() => {
    const billsTotal = paidThisMonth.reduce((sum, bill) => sum + bill.amount, 0);
    const duesTotal = paidDuesThisMonth.reduce((sum, account) => sum + (account.monthlyAmountDue ?? 0), 0);
    const recurringTotal = paidRecurringThisMonth.reduce(
      (sum, transaction) => sum + (transaction.type === 'income' ? -transaction.amount : transaction.amount),
      0,
    );
    return billsTotal + duesTotal + recurringTotal;
  }, [paidThisMonth, paidDuesThisMonth, paidRecurringThisMonth]);

  const [editDateTarget, setEditDateTarget] = useState<{ kind: 'bill' | 'due'; id: number; name: string } | null>(null);
  const [editDateText, setEditDateText] = useState('');

  function handleOpenEditDate(target: { kind: 'bill' | 'due'; id: number; name: string }, currentDate: string) {
    setEditDateTarget(target);
    setEditDateText(currentDate);
  }

  function handleSaveEditDate() {
    if (editDateTarget && editDateText) {
      if (editDateTarget.kind === 'bill') {
        updatePaidDate(editDateTarget.id, editDateText);
      } else {
        updateMonthlyDuePaidDate(editDateTarget.id, editDateText);
      }
    }
    setEditDateTarget(null);
  }

  function handleMarkUnpaid(bill: BillWithDetails) {
    Alert.alert(
      'Mark as unpaid?',
      'This removes the transaction that was logged when this bill was marked paid.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark unpaid', style: 'destructive', onPress: () => unpayBill(bill.id) },
      ],
    );
  }

  function handleUndoRecurring(transaction: TransactionWithCategory) {
    Alert.alert(
      'Undo this payment?',
      `This removes the logged transaction and restores "${transaction.note || transaction.establishment || 'this recurring entry'}" to the Recurring tab as due.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: () => undoRecurringPaid(transaction.recurringId!) },
      ],
    );
  }

  function handleMarkDueUnpaid(account: AccountWithBalance) {
    Alert.alert(
      'Mark as unpaid?',
      `This restores "${account.name}" to the Recurring tab for this month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark unpaid', style: 'destructive', onPress: () => markMonthlyDueUnpaid(account.id) },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.monthNavRow}>
        <Pressable style={styles.monthNavButton} onPress={() => setMonthOffset((value) => value - 1)}>
          <Text style={styles.monthNavButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.monthNavLabel}>{label}</Text>
        <Pressable
          style={[styles.monthNavButton, isCurrentMonth && styles.monthNavButtonDisabled]}
          onPress={() => setMonthOffset((value) => Math.min(0, value + 1))}
          disabled={isCurrentMonth}
        >
          <Text style={[styles.monthNavButtonText, isCurrentMonth && styles.monthNavButtonTextDisabled]}>›</Text>
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search paid bills"
          placeholderTextColor={PALETTE.textSecondary}
          clearButtonMode="while-editing"
        />
      </View>
      <SectionList
        sections={sourceSections}
        keyExtractor={(item) => `${item.kind}-${item.data.id}`}
        stickySectionHeadersEnabled
        contentContainerStyle={combinedList.length === 0 ? styles.emptyContainer : styles.listContent}
        renderSectionHeader={({ section }) => (
          <View style={styles.sourceHeader}>
            <Text style={styles.sourceTitle} numberOfLines={1}>{section.title}</Text>
            <View style={styles.sourceSummary}>
              {section.balance != null ? (
                <Text style={styles.sourceBalance}>Bal {formatCurrency(section.balance)}</Text>
              ) : null}
              <Text style={styles.sourceCount}>{section.data.length} {section.data.length === 1 ? 'item' : 'items'}</Text>
              <Text style={styles.sourceTotal}>{formatCurrency(section.total)}</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={
          combinedList.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total paid {isCurrentMonth ? 'this month' : `in ${label}`}</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalPaid)}</Text>
              <Text style={styles.summaryCount}>{combinedList.length} {combinedList.length === 1 ? 'item' : 'items'}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="✅"
            title={isCurrentMonth ? 'Nothing paid yet this month' : `Nothing paid in ${label}`}
            message="Bills you mark as paid from the Upcoming tab will show up here."
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'due') {
            const account = item.data;
            // Dues paid before transaction logging existed have no linked transaction, so their
            // exact date is unknown and the row keeps the old "Paid this month" wording.
            const paidDate = transactionById.get(account.monthlyDuePaidTransactionId ?? -1)?.occurredAt ?? null;
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('AddEditAccount', { accountId: account.id })}
              >
                <View style={styles.cardMain}>
                  <View style={styles.accountRow}>
                    <View style={[styles.accountDot, { backgroundColor: account.color ?? PALETTE.textSecondary }]} />
                    <Text style={styles.cardTitle}>{account.name}</Text>
                  </View>
                  {paidDate ? (
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        handleOpenEditDate({ kind: 'due', id: account.id, name: account.name }, paidDate);
                      }}
                      hitSlop={4}
                    >
                      <Text style={styles.cardSubtitleLink}>Paid {formatDisplayDate(paidDate)} · Edit</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.cardSubtitle}>Monthly due · Paid this month</Text>
                  )}
                </View>
                <View style={styles.cardTrailing}>
                  <Text style={styles.cardAmount}>{formatCurrency(account.monthlyAmountDue!)}</Text>
                  <Pressable style={styles.undoButton} onPress={() => handleMarkDueUnpaid(account)}>
                    <Text style={styles.undoButtonText}>Undo</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }

          if (item.kind === 'recurring') {
            const transaction = item.data;
            const isIncome = transaction.type === 'income';
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('AddEditTransaction', { transactionId: transaction.id })}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>{transaction.note || transaction.establishment || 'Recurring'}</Text>
                  {transaction.categoryName ? (
                    <CategoryBadge
                      name={transaction.categoryName}
                      color={transaction.categoryColor ?? PALETTE.textSecondary}
                      icon={transaction.categoryIcon}
                    />
                  ) : (
                    <UncategorizedBadge />
                  )}
                  <Text style={styles.cardSubtitle}>Paid {formatDisplayDate(transaction.occurredAt)} · Recurring</Text>
                </View>
                <View style={styles.cardTrailing}>
                  <Text style={[styles.cardAmount, { color: isIncome ? PALETTE.income : PALETTE.textPrimary }]}>
                    {isIncome ? '+' : ''}{formatCurrency(transaction.amount)}
                  </Text>
                  {isCurrentMonth ? (
                    <Pressable
                      style={styles.undoButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        handleUndoRecurring(transaction);
                      }}
                    >
                      <Text style={styles.undoButtonText}>Undo</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
            );
          }

          const bill = item.data;
          const frequencyLabel = frequencyLabelFor(bill);
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate('AddEditBill', { billId: bill.id })}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{bill.name}</Text>
                {bill.categoryName ? (
                  <CategoryBadge name={bill.categoryName} color={bill.categoryColor ?? PALETTE.textSecondary} icon={bill.categoryIcon} />
                ) : (
                  <UncategorizedBadge />
                )}
                {bill.accountName ? (
                  <View style={styles.accountRow}>
                    <View style={[styles.accountDot, { backgroundColor: bill.accountColor ?? PALETTE.textSecondary }]} />
                    <Text style={styles.accountName}>{bill.accountName}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    handleOpenEditDate({ kind: 'bill', id: bill.id, name: bill.name }, bill.lastPaidAt ?? '');
                  }}
                  hitSlop={4}
                >
                  <Text style={styles.cardSubtitleLink}>Paid {formatDisplayDate(bill.lastPaidAt!)} · Edit</Text>
                </Pressable>
                {frequencyLabel ? <Text style={styles.cardFrequency}>{frequencyLabel}</Text> : null}
              </View>
              <View style={styles.cardTrailing}>
                <Text style={styles.cardAmount}>{formatCurrency(bill.amount)}</Text>
                {bill.frequency === 'once' ? (
                  <Pressable style={styles.undoButton} onPress={() => handleMarkUnpaid(bill)}>
                    <Text style={styles.undoButtonText}>Undo</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Modal visible={editDateTarget != null} transparent animationType="fade" onRequestClose={() => setEditDateTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit paid date</Text>
            <Text style={styles.modalSubtitle}>{editDateTarget?.name}</Text>
            <DateField value={editDateText} onChangeText={setEditDateText} />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setEditDateTarget(null)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSaveButton} onPress={handleSaveEditDate}>
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  monthNavButtonDisabled: { opacity: 0.4 },
  monthNavButtonText: { fontSize: 18, fontWeight: '700', color: PALETTE.textPrimary },
  monthNavButtonTextDisabled: { color: PALETTE.textSecondary },
  monthNavLabel: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    backgroundColor: PALETTE.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  // A long account name as a group title has to shrink rather than push the totals off-screen.
  sourceTitle: {
    flexShrink: 1,
    marginRight: 8,
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sourceSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  sourceCount: { fontSize: 12, color: PALETTE.textSecondary },
  sourceBalance: { fontSize: 12, fontWeight: '600', color: PALETTE.net },
  sourceTotal: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: PALETTE.net,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 4,
    alignItems: 'center',
    gap: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: PALETTE.textPrimary, paddingVertical: 10 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryAmount: { fontSize: 28, fontWeight: '700', color: '#fff' },
  summaryCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  cardMain: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  cardSubtitle: { fontSize: 12, color: PALETTE.textSecondary },
  cardSubtitleLink: { fontSize: 12, color: PALETTE.net, fontWeight: '600' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  accountName: { fontSize: 12, color: PALETTE.textSecondary, fontWeight: '600' },
  cardFrequency: { fontSize: 11, fontWeight: '600', color: PALETTE.net },
  cardTrailing: { alignItems: 'flex-end', gap: 8 },
  cardAmount: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  undoButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: `${PALETTE.textSecondary}1A`,
  },
  undoButtonText: { fontSize: 12, fontWeight: '700', color: PALETTE.textSecondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: PALETTE.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary },
  modalSubtitle: { fontSize: 13, color: PALETTE.textSecondary, marginTop: -10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancelButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  modalCancelButtonText: { fontSize: 14, fontWeight: '600', color: PALETTE.textSecondary },
  modalSaveButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: PALETTE.net },
  modalSaveButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
