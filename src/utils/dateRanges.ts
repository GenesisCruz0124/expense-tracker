import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';

export const ISO_DATE_FORMAT = 'yyyy-MM-dd';
export const MONTH_KEY_FORMAT = 'yyyy-MM';

export type PeriodType = 'day' | 'week' | 'month' | 'custom';

export interface DateRange {
  /** Inclusive ISO start date 'YYYY-MM-DD' */
  start: string;
  /** Inclusive ISO end date 'YYYY-MM-DD' */
  end: string;
  /** Human label, e.g. "June 2026" */
  label: string;
}

export interface MonthRange extends DateRange {
  /** 'YYYY-MM' key identifying the month, also used as the budgets.month value */
  monthKey: string;
}

export function monthRangeFor(date: Date): MonthRange {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return {
    monthKey: format(start, MONTH_KEY_FORMAT),
    start: format(start, ISO_DATE_FORMAT),
    end: format(end, ISO_DATE_FORMAT),
    label: format(start, 'MMMM yyyy'),
  };
}

export function monthKeyFor(date: Date): string {
  return format(startOfMonth(date), MONTH_KEY_FORMAT);
}

export function shiftMonth(date: Date, deltaMonths: number): Date {
  return deltaMonths >= 0 ? addMonths(date, deltaMonths) : subMonths(date, -deltaMonths);
}

export function dayRangeFor(date: Date): DateRange {
  const iso = formatIsoDate(date);
  return { start: iso, end: iso, label: format(date, 'MMM d, yyyy') };
}

export function weekRangeFor(date: Date): DateRange {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
    label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
  };
}

export function customRangeFor(start: Date, end: Date): DateRange {
  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
    label: `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`,
  };
}

export function shiftDay(date: Date, delta: number): Date {
  return delta >= 0 ? addDays(date, delta) : subDays(date, -delta);
}

export function shiftWeek(date: Date, delta: number): Date {
  return delta >= 0 ? addWeeks(date, delta) : subWeeks(date, -delta);
}

/** Builds the last `count` month ranges ending with (and including) `anchor`, oldest first. */
export function lastMonthRanges(anchor: Date, count: number): MonthRange[] {
  const ranges: MonthRange[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    ranges.push(monthRangeFor(subMonths(anchor, i)));
  }
  return ranges;
}

export interface WeekRange extends DateRange {
  /** 'YYYY-MM-DD' of the week's Monday — used as the bucket key for weekly trend queries. */
  weekKey: string;
}

/** Builds the last `count` week ranges (Mon–Sun) ending with the week containing `anchor`, oldest first. */
export function lastWeekRanges(anchor: Date, count: number): WeekRange[] {
  const ranges: WeekRange[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const weekStart = startOfWeek(subWeeks(anchor, i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(subWeeks(anchor, i), { weekStartsOn: 1 });
    ranges.push({
      weekKey: format(weekStart, ISO_DATE_FORMAT),
      start: format(weekStart, ISO_DATE_FORMAT),
      end: format(weekEnd, ISO_DATE_FORMAT),
      label: format(weekStart, 'MMM d'),
    });
  }
  return ranges;
}

export function formatIsoDate(date: Date): string {
  return format(date, ISO_DATE_FORMAT);
}

export function parseIsoDate(value: string): Date {
  return parseISO(value);
}

export function formatDisplayDate(value: string): string {
  return format(parseISO(value), 'MMM d, yyyy');
}
