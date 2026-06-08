import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  copyBudgetsForward,
  deleteBudget as deleteBudgetQuery,
  getCategorySpend,
  listBudgetsForMonth,
  upsertBudget,
  type BudgetInput,
  type BudgetWithCategory,
} from '../db/queries/budgets';
import type { MonthRange } from '../utils/dateRanges';

export interface BudgetWithProgress extends BudgetWithCategory {
  /** Actual expense spend in the budget's category for the month, in minor units */
  spend: number;
  /** spend / amountLimit, rounded to whole percent (can exceed 100) */
  percentUsed: number;
}

export function useBudgets(range: MonthRange) {
  const { db, refreshSignal, notifyDataChanged } = useDatabase();
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listBudgetsForMonth(db, range.monthKey);
      const withProgress = await Promise.all(
        rows.map(async (budget): Promise<BudgetWithProgress> => {
          const spend = await getCategorySpend(db, budget.categoryId, range);
          const percentUsed = budget.amountLimit > 0 ? Math.round((spend / budget.amountLimit) * 100) : 0;
          return { ...budget, spend, percentUsed };
        }),
      );
      setBudgets(withProgress);
    } finally {
      setLoading(false);
    }
  }, [db, range.monthKey, range.start, range.end]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, refreshSignal]),
  );

  const saveBudget = useCallback(
    async (input: BudgetInput) => {
      await upsertBudget(db, input);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const removeBudget = useCallback(
    async (id: number) => {
      await deleteBudgetQuery(db, id);
      notifyDataChanged();
      await refresh();
    },
    [db, notifyDataChanged, refresh],
  );

  const copyFromMonth = useCallback(
    async (fromMonthKey: string) => {
      const copied = await copyBudgetsForward(db, fromMonthKey, range.monthKey);
      notifyDataChanged();
      await refresh();
      return copied;
    },
    [db, notifyDataChanged, range.monthKey, refresh],
  );

  return { budgets, loading, refresh, saveBudget, removeBudget, copyFromMonth };
}
