import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  createAccount as createAccountQuery,
  incrementAccountBalance as incrementAccountBalanceQuery,
  listAccounts,
  markMonthlyDuePaid as markMonthlyDuePaidQuery,
  markMonthlyDueUnpaid as markMonthlyDueUnpaidQuery,
  updateMonthlyDuePaidDate as updateMonthlyDuePaidDateQuery,
  setAccountArchived as setAccountArchivedQuery,
  updateAccount as updateAccountQuery,
  type AccountInput,
  type AccountWithBalance,
  type ListAccountsOptions,
} from '../db/queries/accounts';

export function useAccounts(options: ListAccountsOptions = {}) {
  const { db, refreshSignal, notifyDataChanged } = useDatabase();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const optionsKey = JSON.stringify(options);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAccounts(db, options);
      setAccounts(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, optionsKey]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, refreshSignal]),
  );

  const createAccount = useCallback(
    async (input: AccountInput) => {
      const created = await createAccountQuery(db, input);
      notifyDataChanged();
      await refresh();
      return created;
    },
    [db, notifyDataChanged, refresh],
  );

  const updateAccount = useCallback(
    async (id: number, input: AccountInput) => {
      await updateAccountQuery(db, id, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const setArchived = useCallback(
    async (id: number, isArchived: boolean) => {
      await setAccountArchivedQuery(db, id, isArchived);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const markMonthlyDuePaid = useCallback(
    async (id: number, monthKey: string, occurredAt: string) => {
      await markMonthlyDuePaidQuery(db, id, monthKey, occurredAt);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const markMonthlyDueUnpaid = useCallback(
    async (id: number) => {
      await markMonthlyDueUnpaidQuery(db, id);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const updateMonthlyDuePaidDate = useCallback(
    async (id: number, occurredAt: string) => {
      await updateMonthlyDuePaidDateQuery(db, id, occurredAt);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const incrementBalance = useCallback(
    async (id: number) => {
      await incrementAccountBalanceQuery(db, id);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  return {
    accounts,
    loading,
    error,
    refresh,
    createAccount,
    updateAccount,
    setArchived,
    markMonthlyDuePaid,
    markMonthlyDueUnpaid,
    updateMonthlyDuePaidDate,
    incrementBalance,
  };
}
