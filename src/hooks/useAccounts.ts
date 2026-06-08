import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  createAccount as createAccountQuery,
  listAccounts,
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

  const optionsKey = JSON.stringify(options);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await listAccounts(db, options));
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

  return { accounts, loading, refresh, createAccount, updateAccount, setArchived };
}
