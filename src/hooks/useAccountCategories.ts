import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  createAccountCategory as createAccountCategoryQuery,
  listAccountCategories,
  mergeAccountCategory as mergeAccountCategoryQuery,
  setAccountCategoryArchived as setAccountCategoryArchivedQuery,
  updateAccountCategory as updateAccountCategoryQuery,
  type AccountCategoryInput,
  type ListAccountCategoriesOptions,
} from '../db/queries/accountCategories';
import type { AccountCategory } from '../db/schema';

export function useAccountCategories(options: ListAccountCategoriesOptions = {}) {
  const { db, refreshSignal, notifyDataChanged } = useDatabase();
  const [accountCategories, setAccountCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const optionsKey = JSON.stringify(options);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAccountCategories(await listAccountCategories(db, options));
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

  const createAccountCategory = useCallback(
    async (input: AccountCategoryInput) => {
      const created = await createAccountCategoryQuery(db, input);
      notifyDataChanged();
      await refresh();
      return created;
    },
    [db, notifyDataChanged, refresh],
  );

  const updateAccountCategory = useCallback(
    async (id: number, input: AccountCategoryInput) => {
      await updateAccountCategoryQuery(db, id, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const setArchived = useCallback(
    async (id: number, isArchived: boolean) => {
      await setAccountCategoryArchivedQuery(db, id, isArchived);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const mergeAccountCategory = useCallback(
    async (sourceId: number, targetId: number) => {
      await mergeAccountCategoryQuery(db, sourceId, targetId);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  return {
    accountCategories,
    loading,
    refresh,
    createAccountCategory,
    updateAccountCategory,
    setArchived,
    mergeAccountCategory,
  };
}
