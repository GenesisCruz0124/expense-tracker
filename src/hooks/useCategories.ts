import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  createCategory as createCategoryQuery,
  listCategories,
  mergeCategory as mergeCategoryQuery,
  setCategoryArchived as setCategoryArchivedQuery,
  updateCategory as updateCategoryQuery,
  type CategoryInput,
  type ListCategoriesOptions,
} from '../db/queries/categories';
import type { Category } from '../db/schema';

export function useCategories(options: ListCategoriesOptions = {}) {
  const { db, refreshSignal, notifyDataChanged } = useDatabase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const optionsKey = JSON.stringify(options);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await listCategories(db, options));
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

  const createCategory = useCallback(
    async (input: CategoryInput) => {
      const created = await createCategoryQuery(db, input);
      notifyDataChanged();
      await refresh();
      return created;
    },
    [db, notifyDataChanged, refresh],
  );

  const updateCategory = useCallback(
    async (id: number, input: CategoryInput) => {
      await updateCategoryQuery(db, id, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const setArchived = useCallback(
    async (id: number, isArchived: boolean) => {
      await setCategoryArchivedQuery(db, id, isArchived);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const mergeCategory = useCallback(
    async (sourceId: number, targetId: number) => {
      await mergeCategoryQuery(db, sourceId, targetId);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  return { categories, loading, refresh, createCategory, updateCategory, setArchived, mergeCategory };
}
