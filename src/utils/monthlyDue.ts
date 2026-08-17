import { formatIsoDate } from './dateRanges';

/** 1 -> "1st", 22 -> "22nd". */
export function ordinal(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]);
}

/**
 * The ISO date a monthly due falls on within `reference`'s month.
 *
 * A due day past the end of a short month (the 31st in April, say) lands on that month's last day
 * rather than spilling into the next one. With no due day set the due is treated as month-end,
 * which is when a statement-style balance is typically settled.
 */
export function monthlyDueDateFor(dueDay: number | null | undefined, reference: Date): string {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = dueDay == null ? lastDay : Math.min(Math.max(dueDay, 1), lastDay);
  return formatIsoDate(new Date(year, month, day));
}
