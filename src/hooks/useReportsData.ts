import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useDatabase } from '../context/DatabaseProvider';
import {
  categoryBreakdown,
  incomeVsExpenseTrend,
  incomeVsExpenseTrendDaily,
  incomeVsExpenseTrendWeekly,
  monthlyTotals,
  type CategoryBreakdownEntry,
  type MonthlyTotals,
  type MonthlyTrendEntry,
} from '../db/queries/reports';
import { lastDayRanges, lastMonthRanges, lastWeekRanges, type DateRange } from '../utils/dateRanges';

export type ReportKind = 'expense' | 'income';
export type TrendPeriod = 'daily' | 'weekly' | 'monthly';

export function useReportsData(range: DateRange, monthsBack: number = 8, trendPeriod: TrendPeriod = 'monthly', periodCount: number = 8) {
  const { db, refreshSignal } = useDatabase();
  const [breakdownKind, setBreakdownKindState] = useState<ReportKind>('expense');
  const [expenseData, setExpenseData] = useState<CategoryBreakdownEntry[]>([]);
  const [incomeData, setIncomeData] = useState<CategoryBreakdownEntry[]>([]);
  const [trend, setTrend] = useState<MonthlyTrendEntry[]>([]);
  const [totals, setTotals] = useState<MonthlyTotals>({ income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);
  // Tracks whether the user has manually chosen a kind for the current range.
  const userChoseKind = useRef(false);
  const lastRangeKey = useRef('');

  const refresh = useCallback(async () => {
    setLoading(true);
    // Reset manual-choice flag when the date range changes so auto-switch can run again.
    const rangeKey = `${range.start}|${range.end}`;
    if (rangeKey !== lastRangeKey.current) {
      lastRangeKey.current = rangeKey;
      userChoseKind.current = false;
    }
    try {
      const monthRanges = lastMonthRanges(new Date(), periodCount);
      const weekRanges = lastWeekRanges(new Date(), periodCount);
      const dayRanges = lastDayRanges(new Date(), periodCount);
      const [expBreakdown, incBreakdown, trendData, totalsData] = await Promise.all([
        categoryBreakdown(db, 'expense', range),
        categoryBreakdown(db, 'income', range),
        trendPeriod === 'daily'
          ? incomeVsExpenseTrendDaily(db, dayRanges)
          : trendPeriod === 'weekly'
            ? incomeVsExpenseTrendWeekly(db, weekRanges)
            : incomeVsExpenseTrend(db, monthRanges),
        monthlyTotals(db, range),
      ]);
      setExpenseData(expBreakdown);
      setIncomeData(incBreakdown);
      setTrend(trendData);
      setTotals(totalsData);
      // Auto-switch to income when there are no expenses but there is income data,
      // unless the user has already manually selected a kind for this range.
      if (!userChoseKind.current) {
        if (expBreakdown.length === 0 && incBreakdown.length > 0) {
          setBreakdownKindState('income');
        } else {
          setBreakdownKindState('expense');
        }
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, range.start, range.end, monthsBack, trendPeriod, periodCount]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, refreshSignal]),
  );

  const setBreakdownKind = useCallback((kind: ReportKind) => {
    userChoseKind.current = true;
    setBreakdownKindState(kind);
  }, []);

  const categoryData = breakdownKind === 'expense' ? expenseData : incomeData;

  return { categoryData, trend, totals, loading, breakdownKind, setBreakdownKind, refresh };
}
