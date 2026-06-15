import React, { useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { TransactionListItem } from '../components/TransactionListItem';
import { PALETTE } from '../constants/colors';
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

  const filter = useMemo(() => ({ accountIds: [accountId] }), [accountId]);
  const { transactions, loading } = useTransactions(filter);

  useEffect(() => {
    navigation.setOptions({ title: account?.name ?? 'Account' });
  }, [navigation, account?.name]);

  return (
    <View style={styles.screen}>
      {account ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={[styles.summaryAmount, { color: account.balance < 0 ? PALETTE.expense : PALETTE.textPrimary }]}>
            {formatCurrency(account.balance)}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TransactionListItem
            transaction={item}
            onPress={() => navigation.navigate('AddEditTransaction', { transactionId: item.id })}
          />
        )}
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="📋" title="No transactions" message="Transactions for this account will show up here." />
          ) : null
        }
      />
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
  summaryAmount: { fontSize: 16, fontWeight: '700' },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
});
