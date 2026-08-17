import React, { useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { TransactionListItem } from '../components/TransactionListItem';
import { PALETTE } from '../constants/colors';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { useTransactions } from '../hooks/useTransactions';
import { formatCurrency } from '../utils/currency';
import type { AccountsStackParamList } from '../navigation/types';

export default function AccountTransactionsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AccountsStackParamList, 'AccountTransactions'>>();
  const { accountId } = route.params;

  const { accounts } = useAccounts({ includeArchived: true });
  const account = useMemo(() => accounts.find((item) => item.id === accountId), [accounts, accountId]);

  const { accountCategories } = useAccountCategories({ includeArchived: true });
  const category = accountCategories.find((c) => c.id === account?.categoryId);
  const showMonthlyAmountDue = category?.kind === 'credit_card' && account?.monthlyAmountDue != null;

  const filter = useMemo(() => ({ accountIds: [accountId] }), [accountId]);
  const { transactions, loading } = useTransactions(filter);

  /** Per-transaction effect on this account's balance, mirroring the SQL `balanceExpr` in db/queries/accounts.ts. */
  function balanceEffect(transaction: (typeof transactions)[number]): number {
    if (category?.kind === 'credit_card') {
      return (transaction.type === 'expense' ? transaction.amount : -transaction.amount) + transaction.fee;
    }
    return (transaction.type === 'income' ? transaction.amount : -transaction.amount) - transaction.fee;
  }

  const transactionsWithBalance = useMemo(() => {
    if (!account) return transactions.map((transaction) => ({ transaction, runningBalance: undefined as number | undefined }));
    let cursor = account.balance;
    return transactions.map((transaction) => {
      const runningBalance = cursor;
      cursor -= balanceEffect(transaction);
      return { transaction, runningBalance };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, account?.balance, category?.kind]);

  useEffect(() => {
    navigation.setOptions({ title: account?.name ?? 'Account' });
  }, [navigation, account?.name]);

  return (
    <View style={styles.screen}>
      {account ? (
        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryAmount, { color: account.balance < 0 ? PALETTE.expense : PALETTE.textPrimary }]}>
              {formatCurrency(account.balance)}
            </Text>
          </View>
          {showMonthlyAmountDue ? (
            <View style={styles.dueGroup}>
              <Text style={styles.summaryLabel}>Monthly amount due</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(account.monthlyAmountDue!)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={transactionsWithBalance}
        keyExtractor={(item) => String(item.transaction.id)}
        renderItem={({ item }) => (
          <TransactionListItem
            transaction={item.transaction}
            runningBalance={item.runningBalance}
            onPress={() => navigation.navigate('AddEditTransaction', { transactionId: item.transaction.id })}
          />
        )}
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="📋" title="No transactions" message="Transactions for this account will show up here." />
          ) : null
        }
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditTransaction', { accountId })}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  summaryAmount: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary },
  dueGroup: { alignItems: 'flex-end' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PALETTE.net,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
});
