import type { AccountCategory } from '../db/schema';
import type { AccountWithBalance } from '../db/queries/accounts';
import type { BillWithDetails } from '../db/queries/bills';
import { monthKeyFor } from './dateRanges';
import { monthlyDueDateFor } from './monthlyDue';

/**
 * What's still owed: unpaid bills plus the monthly dues configured on credit card and loan
 * accounts, which are obligations with a due date just like a bill. Investment contributions are
 * excluded — those are savings rather than something owed.
 */
export type UpcomingItem =
  | { kind: 'bill'; id: number; name: string; amount: number; dueDate: string; bill: BillWithDetails }
  | { kind: 'due'; id: number; name: string; amount: number; dueDate: string; account: AccountWithBalance };

export function buildUpcomingItems(
  bills: BillWithDetails[],
  accounts: AccountWithBalance[],
  accountCategories: AccountCategory[],
  today: Date = new Date(),
): UpcomingItem[] {
  const currentMonthKey = monthKeyFor(today);

  const billItems: UpcomingItem[] = bills
    .filter((bill) => !bill.isPaid)
    .map((bill) => ({ kind: 'bill', id: bill.id, name: bill.name, amount: bill.amount, dueDate: bill.dueDate, bill }));

  const dueItems: UpcomingItem[] = accounts
    .filter((account) => {
      if (account.monthlyAmountDue == null) return false;
      if (account.monthlyDueLastPaidMonth === currentMonthKey) return false;
      return accountCategories.find((category) => category.id === account.categoryId)?.kind === 'credit_card';
    })
    .map((account) => ({
      kind: 'due',
      id: account.id,
      name: account.name,
      amount: account.monthlyAmountDue!,
      dueDate: monthlyDueDateFor(account.subscriptionDueDay, today),
      account,
    }));

  return [...billItems, ...dueItems].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
