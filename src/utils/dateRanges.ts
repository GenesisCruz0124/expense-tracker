import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';

export const ISO_DATE_FORMAT = 'yyyy-MM-dd';
export const MONTH_KEY_FORMAT = 'yyyy-MM';

export interface MonthRange {
  /** 'YYYY-MM' key identifying the month, also used as the budgets.month value */
  monthKey: string;
  /** Inclusive ISO start date 'YYYY-MM-DD' */
  start: string;
  /** Inclusive ISO end date 'YYYY-MM-DD' */
  end: string;
  /** Human label, e.g. "June 2026" */
  label: string;
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

/** Builds the last `count` month ranges ending with (and including) `anchor`, oldest first. */
export function lastMonthRanges(anchor: Date, count: number): MonthRange[] {
  const ranges: MonthRange[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    ranges.push(monthRangeFor(subMonths(anchor, i)));
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
