import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { CategoryBadge, UncategorizedBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { AccountWithBalance } from '../db/queries/accounts';
import type { BillWithDetails } from '../db/queries/bills';
import { useAccounts } from '../hooks/useAccounts';
import { useBills } from '../hooks/useBills';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, monthKeyFor, monthRangeFor } from '../utils/dateRanges';
import { frequencyLabelFor } from '../utils/bills';

type PaidListItem =
  | { kind: 'bill'; data: BillWithDetails }
  | { kind: 'due'; data: AccountWithBalance };

export default function PaidBillsScreen() {
  const navigation = useNavigation();
  const { bills, unpayBill } = useBills();
  const { accounts, markMonthlyDueUnpaid } = useAccounts();
  const [searchText, setSearchText] = useState('');

  const paidThisMonth = useMemo(() => {
    const { start, end } = monthRangeFor(new Date());
    return bills
      .filter((bill) => bill.lastPaidAt != null && bill.lastPaidAt >= start && bill.lastPaidAt <= end)
      .sort((a, b) => b.lastPaidAt!.localeCompare(a.lastPaidAt!));
  }, [bills]);

  const paidDuesThisMonth = useMemo(() => {
    const currentMonthKey = monthKeyFor(new Date());
    return accounts.filter(
      (account) => account.monthlyAmountDue != null && account.monthlyDueLastPaidMonth === currentMonthKey,
    );
  }, [accounts]);

  const combinedList = useMemo((): PaidListItem[] => {
    const q = searchText.trim().toLowerCase();
    const billItems: PaidListItem[] = paidThisMonth
      .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.accountName ?? '').toLowerCase().includes(q))
      .map((data) => ({ kind: 'bill', data }));
    const dueItems: PaidListItem[] = paidDuesThisMonth
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .map((data) => ({ kind: 'due', data }));
    return [...billItems, ...dueItems];
  }, [paidThisMonth, paidDuesThisMonth, searchText]);

  const totalPaid = useMemo(() => {
    const billsTotal = paidThisMonth.reduce((sum, bill) => sum + bill.amount, 0);
    const duesTotal = paidDuesThisMonth.reduce((sum, account) => sum + (account.monthlyAmountDue ?? 0), 0);
    return billsTotal + duesTotal;
  }, [paidThisMonth, paidDuesThisMonth]);

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
      <FlatList
        data={combinedList}
        keyExtractor={(item) => item.kind === 'bill' ? `bill-${item.data.id}` : `due-${item.data.id}`}
        contentContainerStyle={combinedList.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          combinedList.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total paid this month</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalPaid)}</Text>
              <Text style={styles.summaryCount}>{combinedList.length} {combinedList.length === 1 ? 'item' : 'items'}</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="✅"
            title="Nothing paid yet this month"
            message="Bills you mark as paid from the Upcoming tab will show up here."
          />
        }
        renderItem={({ item }) => {
          if (item.kind === 'due') {
            const account = item.data;
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
                  <Text style={styles.cardSubtitle}>Monthly due · Paid this month</Text>
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
                <Text style={styles.cardSubtitle}>Paid {formatDisplayDate(bill.lastPaidAt!)}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
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
});
