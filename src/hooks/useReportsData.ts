import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  categoryBreakdown,
  incomeVsExpenseTrend,
  monthlyTotals,
  type CategoryBreakdownEntry,
  type MonthlyTotals,
  type MonthlyTrendEntry,
} from '../db/queries/reports';
import { lastMonthRanges, type DateRange } from '../utils/dateRanges';

export type ReportKind = 'expense' | 'income';

export function useReportsData(range: DateRange, monthsBack: number = 6) {
  const { db, refreshSignal } = useDatabase();
  const [breakdownKind, setBreakdownKind] = useState<ReportKind>('expense');
  const [categoryData, setCategoryData] = useState<CategoryBreakdownEntry[]>([]);
  const [trend, setTrend] = useState<MonthlyTrendEntry[]>([]);
  const [totals, setTotals] = useState<MonthlyTotals>({ income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ranges = lastMonthRanges(new Date(), monthsBack);
      const [breakdown, trendData, totalsData] = await Promise.all([
        categoryBreakdown(db, breakdownKind, range),
        incomeVsExpenseTrend(db, ranges),
        monthlyTotals(db, range),
      ]);
      setCategoryData(breakdown);
      setTrend(trendData);
      setTotals(totalsData);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, range.start, range.end, monthsBack, breakdownKind]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, refreshSignal]),
  );

  return { categoryData, trend, totals, loading, breakdownKind, setBreakdownKind, refresh };
}
