import { addMonths, addWeeks, format, isAfter, parseISO } from 'date-fns';

import { ISO_DATE_FORMAT } from './dateRanges';

export interface RecurrenceRule {
  frequency: 'weekly' | 'monthly';
  intervalCount: number;
  endDate: string | null;
  nextRunDate: string;
}

/**
 * date-fns' addMonths clamps to the last valid day of the target month (e.g. Jan 31 + 1mo
 * -> Feb 28/29), which is exactly the behavior we want for "every month on this date" rules.
 */
export function computeNextRunDate(
  rule: Pick<RecurrenceRule, 'frequency' | 'intervalCount'>,
  fromDate: Date,
): Date {
  return rule.frequency === 'weekly'
    ? addWeeks(fromDate, rule.intervalCount)
    : addMonths(fromDate, rule.intervalCount);
}

export interface OccurrenceGenerationResult {
  /** Due dates (ISO 'YYYY-MM-DD'), oldest first, that have elapsed since the rule's last run */
  dueDates: string[];
  /** The rule's `next_run_date` after accounting for every generated occurrence */
  nextRunDate: string;
  /** True once the cursor has passed `endDate` — the rule should be deactivated */
  isExhausted: boolean;
}

/**
 * Walks a rule forward from its stored `nextRunDate`, collecting every date that is due
 * on or before `today`. This is what makes "catch up" possible: a monthly rule that hasn't
 * been seen in three months yields three due dates in a single pass, each correctly dated
 * to when it was actually due (not "today") so historical reports stay accurate.
 */
export function generateOccurrencesUpTo(rule: RecurrenceRule, today: Date): OccurrenceGenerationResult {
  const end = rule.endDate ? parseISO(rule.endDate) : null;
  const dueDates: string[] = [];

  let cursor = parseISO(rule.nextRunDate);
  while (!isAfter(cursor, today) && (!end || !isAfter(cursor, end))) {
    dueDates.push(format(cursor, ISO_DATE_FORMAT));
    cursor = computeNextRunDate(rule, cursor);
  }

  return {
    dueDates,
    nextRunDate: format(cursor, ISO_DATE_FORMAT),
    isExhausted: end ? isAfter(cursor, end) : false,
  };
}
