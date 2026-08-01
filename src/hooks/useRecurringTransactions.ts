import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  createRecurringTransaction as createRecurringQuery,
  deleteRecurringTransaction as deleteRecurringQuery,
  listRecurringTransactions,
  markRecurringPaid as markRecurringPaidQuery,
  setRecurringActive as setRecurringActiveQuery,
  undoRecurringPaid as undoRecurringPaidQuery,
  updateRecurringTransaction as updateRecurringQuery,
  type RecurringInput,
  type RecurringWithStatus,
} from '../db/queries/recurring';

export function useRecurringTransactions() {
  const { db, refreshSignal, notifyDataChanged } = useDatabase();
  const [rules, setRules] = useState<RecurringWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await listRecurringTransactions(db));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, refreshSignal]),
  );

  const createRule = useCallback(
    async (input: RecurringInput) => {
      await createRecurringQuery(db, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const updateRule = useCallback(
    async (id: number, input: RecurringInput) => {
      await updateRecurringQuery(db, id, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const setActive = useCallback(
    async (id: number, isActive: boolean) => {
      await setRecurringActiveQuery(db, id, isActive);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const removeRule = useCallback(
    async (id: number) => {
      await deleteRecurringQuery(db, id);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const markPaid = useCallback(
    async (rule: RecurringWithStatus) => {
      await markRecurringPaidQuery(db, rule);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const undoPaid = useCallback(
    async (ruleId: number) => {
      await undoRecurringPaidQuery(db, ruleId);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  return { rules, loading, refresh, createRule, updateRule, setActive, removeRule, markPaid, undoPaid };
}
