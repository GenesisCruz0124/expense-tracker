import { differenceInCalendarDays, parseISO } from 'date-fns';

import type { Database } from './client';
import { listBills, markBillReminded } from './queries/bills';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, formatIsoDate } from '../utils/dateRanges';
import { presentBillReminder } from '../utils/notifications';

/**
 * Fires a one-time local notification for each unpaid bill once it enters its reminder
 * window (`reminderDaysBefore` days before `dueDate`, inclusive of overdue bills), tracked
 * via `bills.remindedAt` so re-running this on every app open doesn't repeat the alert.
 */
export async function checkBillReminders(db: Database, referenceDate: Date): Promise<void> {
  const allBills = await listBills(db);

  for (const bill of allBills) {
    if (bill.isPaid || bill.remindedAt != null) continue;

    const daysUntilDue = differenceInCalendarDays(parseISO(bill.dueDate), referenceDate);
    if (daysUntilDue > bill.reminderDaysBefore) continue;

    const title = daysUntilDue < 0 ? `Overdue: ${bill.name}` : daysUntilDue === 0 ? `Due today: ${bill.name}` : `Upcoming bill: ${bill.name}`;
    const body = `${formatCurrency(bill.amount)} due ${formatDisplayDate(bill.dueDate)}.`;

    await presentBillReminder(title, body);
    await markBillReminded(db, bill.id, formatIsoDate(referenceDate));
  }
}
