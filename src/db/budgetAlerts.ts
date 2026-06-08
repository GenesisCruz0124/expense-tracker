import type { Database } from './client';
import { getCategorySpend, listBudgetsForMonth, setBudgetLastAlertPct } from './queries/budgets';
import { formatCurrency } from '../utils/currency';
import { monthRangeFor } from '../utils/dateRanges';
import { presentBudgetAlert } from '../utils/notifications';

const EXCEEDED_PCT = 100;

/**
 * Recomputes spend-vs-limit for every budget in the month containing `referenceDate` and
 * fires an immediate local notification the *first* time a threshold is newly crossed,
 * tracked via `budgets.lastAlertPct` so re-running this (e.g. on every app open) doesn't
 * spam the user with repeat alerts. At most two notifications per budget per month:
 * "nearing" (default 90%) and "exceeded" (100%).
 */
export async function checkBudgetAlerts(db: Database, referenceDate: Date): Promise<void> {
  const range = monthRangeFor(referenceDate);
  const budgetsForMonth = await listBudgetsForMonth(db, range.monthKey);

  for (const budget of budgetsForMonth) {
    if (budget.amountLimit <= 0) continue;

    const spend = await getCategorySpend(db, budget.categoryId, range);
    const pct = Math.floor((spend / budget.amountLimit) * 100);

    const crossedExceeded = pct >= EXCEEDED_PCT && budget.lastAlertPct < EXCEEDED_PCT;
    const crossedNearing = pct >= budget.alertThresholdPct && budget.lastAlertPct < budget.alertThresholdPct;

    if (crossedExceeded) {
      await presentBudgetAlert(
        `Budget exceeded: ${budget.categoryName}`,
        `You've spent ${formatCurrency(spend)} of your ${formatCurrency(budget.amountLimit)} ` +
          `${budget.categoryName} budget for ${range.label}.`,
      );
      await setBudgetLastAlertPct(db, budget.id, EXCEEDED_PCT);
    } else if (crossedNearing) {
      await presentBudgetAlert(
        `Nearing budget: ${budget.categoryName}`,
        `You've used ${pct}% (${formatCurrency(spend)} of ${formatCurrency(budget.amountLimit)}) ` +
          `of your ${budget.categoryName} budget for ${range.label}.`,
      );
      await setBudgetLastAlertPct(db, budget.id, budget.alertThresholdPct);
    }
  }
}
