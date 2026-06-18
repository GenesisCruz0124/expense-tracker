import type { BillFrequency, BillWithDetails } from '../db/queries/bills';

const FREQUENCY_LABELS: Record<BillFrequency, string | null> = {
  once: null,
  weekly: 'Repeats weekly',
  semi_monthly: 'Repeats semi-monthly',
  monthly: 'Repeats monthly',
  yearly: 'Repeats yearly',
  every_n_days: null,
};

export function frequencyLabelFor(bill: Pick<BillWithDetails, 'frequency' | 'intervalDays'>): string | null {
  if (bill.frequency === 'every_n_days') {
    return bill.intervalDays != null ? `Repeats every ${bill.intervalDays} days` : 'Repeats every N days';
  }
  return FREQUENCY_LABELS[bill.frequency];
}
