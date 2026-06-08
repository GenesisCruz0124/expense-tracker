import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import { checkBudgetAlerts } from '../db/budgetAlerts';
import {
  createTransaction as createTransactionQuery,
  deleteTransaction as deleteTransactionQuery,
  listTransactions,
  updateTransaction as updateTransactionQuery,
  type ListTransactionsFilter,
  type TransactionInput,
  type TransactionWithCategory,
} from '../db/queries/transactions';

export function useTransactions(filter: ListTransactionsFilter = {}) {
  const { db, refreshSignal, notifyDataChanged } = useDatabase();
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Serialize so the callback identity is stable across renders that pass equivalent filters
  const filterKey = JSON.stringify(filter);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTransactions(await listTransactions(db, filter));
    } finally {
      setLoading(false);
    }
    // filterKey mirrors `filter`'s contents
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, filterKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, refreshSignal]),
  );

  // Re-evaluate budget alerts right after any expense mutation — see DatabaseProvider for
  // the launch-time check; this is the "immediately after a relevant mutation" trigger.
  const afterMutation = useCallback(
    async (type: 'expense' | 'income', occurredAt: string) => {
      notifyDataChanged();
      if (type === 'expense') await checkBudgetAlerts(db, new Date(occurredAt));
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const createTransaction = useCallback(
    async (input: TransactionInput) => {
      await createTransactionQuery(db, input);
      await afterMutation(input.type, input.occurredAt);
    },
    [db, afterMutation],
  );

  const updateTransaction = useCallback(
    async (id: number, input: TransactionInput) => {
      await updateTransactionQuery(db, id, input);
      await afterMutation(input.type, input.occurredAt);
    },
    [db, afterMutation],
  );

  const deleteTransaction = useCallback(
    async (id: number, type: 'expense' | 'income', occurredAt: string) => {
      await deleteTransactionQuery(db, id);
      await afterMutation(type, occurredAt);
    },
    [db, afterMutation],
  );

  return { transactions, loading, refresh, createTransaction, updateTransaction, deleteTransaction };
}
