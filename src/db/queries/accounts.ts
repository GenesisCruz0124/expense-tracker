import { and, asc, desc, eq, isNull, lte, sql } from 'drizzle-orm';

import type { Database } from '../client';
import { accountCategories, accounts, transactions, type Account, type NewAccount } from '../schema';
import { formatIsoDate } from '../../utils/dateRanges';
import { generateUuid } from '../../utils/uuid';

export interface AccountWithBalance extends Account {
  /**
   * Starting balance plus the net effect of every transaction assigned to this account, in minor units.
   * For standard accounts, income adds and expenses subtract. For credit card accounts the balance
   * represents the amount owed, so expenses (purchases) add and income (payments/refunds) subtract.
   */
  balance: number;
  /** ISO datetime of the most recent transaction on this account, or null if the account has no transactions. */
  lastTransactionAt: string | null;
}

export interface ListAccountsOptions {
  includeArchived?: boolean;
  /** 'name' (default) sorts alphabetically; 'recent' sorts by most recent transaction first. */
  sortBy?: 'name' | 'recent';
}

const lastTransactionAtExpr = sql<string | null>`max(${transactions.occurredAt})`;

const balanceExpr = sql<number>`${accounts.startingBalance} + coalesce(sum(case
  when ${accountCategories.kind} = 'credit_card' then
    (case when ${transactions.type} = 'expense' then ${transactions.amount}
      when ${transactions.type} = 'income' then -${transactions.amount}
      else 0 end) + ${transactions.fee}
  else
    (case when ${transactions.type} = 'income' then ${transactions.amount}
      when ${transactions.type} = 'expense' then -${transactions.amount}
      else 0 end) - ${transactions.fee}
  end), 0)`;

export async function listAccounts(db: Database, options: ListAccountsOptions = {}): Promise<AccountWithBalance[]> {
  const { includeArchived = false, sortBy = 'name' } = options;

  const query = db
    .select({
      id: accounts.id,
      name: accounts.name,
      categoryId: accounts.categoryId,
      color: accounts.color,
      icon: accounts.icon,
      accountNumber: accounts.accountNumber,
      qrImageUri: accounts.qrImageUri,
      startingBalance: accounts.startingBalance,
      isArchived: accounts.isArchived,
      includeInNetWorth: accounts.includeInNetWorth,
      monthlyAmountDue: accounts.monthlyAmountDue,
      remainingMonths: accounts.remainingMonths,
      subscriptionDueDay: accounts.subscriptionDueDay,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyContribution: accounts.monthlyContribution,
      balanceLastUpdatedAt: accounts.balanceLastUpdatedAt,
      annualInterestRate: accounts.annualInterestRate,
      lastInterestAccruedDate: accounts.lastInterestAccruedDate,
      interestFrequency: accounts.interestFrequency,
      totalMonths: accounts.totalMonths,
      creditLimit: accounts.creditLimit,
      linkedCreditCardId: accounts.linkedCreditCardId,
      paymentSource: accounts.paymentSource,
      paymentSourceAccountId: accounts.paymentSourceAccountId,
      monthlyDuePaidTransactionId: accounts.monthlyDuePaidTransactionId,
      sharedCreditLimitAccountId: accounts.sharedCreditLimitAccountId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      deletedAt: accounts.deletedAt,
      uuid: accounts.uuid,
      balance: balanceExpr,
      lastTransactionAt: lastTransactionAtExpr,
    })
    .from(accounts)
    .leftJoin(transactions, and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)))
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .groupBy(accounts.id)
    .orderBy(
      sortBy === 'recent'
        ? sql`${lastTransactionAtExpr} is null, ${lastTransactionAtExpr} desc`
        : asc(accounts.name),
    );

  const conditions = [isNull(accounts.deletedAt)];
  if (!includeArchived) conditions.push(eq(accounts.isArchived, false));
  return query.where(and(...conditions));
}

/** Names of non-archived investment-kind accounts — used to suggest bill names like a savings/investment contribution. */
export async function listInvestmentAccountNames(db: Database): Promise<string[]> {
  const rows = await db
    .select({ name: accounts.name })
    .from(accounts)
    .innerJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .where(sql`${accountCategories.kind} = 'investment' and ${accounts.isArchived} = 0 and ${accounts.deletedAt} is null`)
    .orderBy(asc(accounts.name));
  return rows.map((row) => row.name);
}

export async function getAccountWithBalance(db: Database, id: number): Promise<AccountWithBalance | undefined> {
  const [row] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      categoryId: accounts.categoryId,
      color: accounts.color,
      icon: accounts.icon,
      accountNumber: accounts.accountNumber,
      qrImageUri: accounts.qrImageUri,
      startingBalance: accounts.startingBalance,
      isArchived: accounts.isArchived,
      includeInNetWorth: accounts.includeInNetWorth,
      monthlyAmountDue: accounts.monthlyAmountDue,
      remainingMonths: accounts.remainingMonths,
      subscriptionDueDay: accounts.subscriptionDueDay,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyContribution: accounts.monthlyContribution,
      balanceLastUpdatedAt: accounts.balanceLastUpdatedAt,
      annualInterestRate: accounts.annualInterestRate,
      lastInterestAccruedDate: accounts.lastInterestAccruedDate,
      interestFrequency: accounts.interestFrequency,
      totalMonths: accounts.totalMonths,
      creditLimit: accounts.creditLimit,
      linkedCreditCardId: accounts.linkedCreditCardId,
      paymentSource: accounts.paymentSource,
      paymentSourceAccountId: accounts.paymentSourceAccountId,
      monthlyDuePaidTransactionId: accounts.monthlyDuePaidTransactionId,
      sharedCreditLimitAccountId: accounts.sharedCreditLimitAccountId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      deletedAt: accounts.deletedAt,
      uuid: accounts.uuid,
      balance: balanceExpr,
      lastTransactionAt: lastTransactionAtExpr,
    })
    .from(accounts)
    .leftJoin(transactions, and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt)))
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
    .groupBy(accounts.id)
    .limit(1);
  return row;
}

export interface AccountInput {
  name: string;
  categoryId: number;
  color: string;
  icon?: string | null;
  accountNumber?: string | null;
  qrImageUri?: string | null;
  /** Integer amount in minor units (centavos) */
  startingBalance: number;
  includeInNetWorth?: boolean;
  /** Minimum/recurring amount due each month, in minor units (centavos) — for credit-card-kind accounts. */
  monthlyAmountDue?: number | null;
  /** Number of monthly payments left — for credit-card-kind accounts. */
  remainingMonths?: number | null;
  /** Amount added to the balance on each manual update, in minor units (centavos) — for investment-kind accounts. */
  monthlyContribution?: number | null;
  /** ISO date ('YYYY-MM-DD') the balance was last updated via the increment button — for investment-kind accounts. */
  balanceLastUpdatedAt?: string | null;
  /** Running count of months contributed (investment) or months paid (credit_card). */
  totalMonths?: number;
  /** Credit limit in minor units — for credit-card-kind accounts. */
  creditLimit?: number | null;
  /** For loan accounts: the credit card account ID this loan is charged against. */
  linkedCreditCardId?: number | null;
  /** Day of the month (1–31) when the subscription renews — for subscription accounts. */
  subscriptionDueDay?: number | null;
  /** Annual interest rate in centipercent (3.25% → 325) — for savings accounts earning interest. */
  annualInterestRate?: number | null;
  /** How often interest is credited: 'daily' | 'monthly' | 'yearly'. */
  interestFrequency?: 'daily' | 'monthly' | 'yearly' | null;
  /** Free-text label for how this account's monthly due/contribution is funded, e.g. "Salary deduction" or "Cash". */
  paymentSource?: string | null;
  /** Account the monthly due/contribution is paid from. Null means an untracked source (e.g. salary deduction). */
  paymentSourceAccountId?: number | null;
  /** For credit-card-kind accounts: another credit card account ID that shares the same credit limit. */
  sharedCreditLimitAccountId?: number | null;
}

/**
 * Keeps a shared-credit-limit pairing mutual: clears the old partner's back-link (if it pointed
 * at `id` and isn't the new partner) and points the new partner back at `id`.
 */
async function syncSharedCreditLimitPartner(
  db: Database,
  id: number,
  oldPartnerId: number | null,
  newPartnerId: number | null,
): Promise<void> {
  if (oldPartnerId === newPartnerId) return;
  if (oldPartnerId != null) {
    await db
      .update(accounts)
      .set({ sharedCreditLimitAccountId: null, updatedAt: sql`(datetime('now'))` })
      .where(eq(accounts.id, oldPartnerId));
  }
  if (newPartnerId != null) {
    await db
      .update(accounts)
      .set({ sharedCreditLimitAccountId: id, updatedAt: sql`(datetime('now'))` })
      .where(eq(accounts.id, newPartnerId));
  }
}

export async function createAccount(db: Database, input: AccountInput): Promise<Account> {
  const values: NewAccount = {
    name: input.name.trim(),
    categoryId: input.categoryId,
    color: input.color,
    icon: input.icon ?? null,
    accountNumber: input.accountNumber?.trim() || null,
    qrImageUri: input.qrImageUri ?? null,
    startingBalance: input.startingBalance,
    includeInNetWorth: input.includeInNetWorth ?? true,
    monthlyAmountDue: input.monthlyAmountDue ?? null,
    remainingMonths: input.remainingMonths ?? null,
    monthlyContribution: input.monthlyContribution ?? null,
    balanceLastUpdatedAt: input.balanceLastUpdatedAt ?? null,
    totalMonths: input.totalMonths ?? 0,
    creditLimit: input.creditLimit ?? null,
    linkedCreditCardId: input.linkedCreditCardId ?? null,
    subscriptionDueDay: input.subscriptionDueDay ?? null,
    annualInterestRate: input.annualInterestRate ?? null,
    interestFrequency: input.interestFrequency ?? null,
    paymentSource: input.paymentSource?.trim() || null,
    paymentSourceAccountId: input.paymentSourceAccountId ?? null,
    sharedCreditLimitAccountId: input.sharedCreditLimitAccountId ?? null,
    uuid: generateUuid(),
  };
  const [row] = await db.insert(accounts).values(values).returning();
  if (input.sharedCreditLimitAccountId != null) {
    await syncSharedCreditLimitPartner(db, row.id, null, input.sharedCreditLimitAccountId);
  }
  return row;
}

export async function updateAccount(db: Database, id: number, input: AccountInput): Promise<void> {
  const [existing] = await db
    .select({ sharedCreditLimitAccountId: accounts.sharedCreditLimitAccountId })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);

  await db
    .update(accounts)
    .set({
      name: input.name.trim(),
      categoryId: input.categoryId,
      color: input.color,
      icon: input.icon ?? null,
      accountNumber: input.accountNumber?.trim() || null,
      qrImageUri: input.qrImageUri ?? null,
      startingBalance: input.startingBalance,
      includeInNetWorth: input.includeInNetWorth ?? true,
      monthlyAmountDue: input.monthlyAmountDue ?? null,
      remainingMonths: input.remainingMonths ?? null,
      monthlyContribution: input.monthlyContribution ?? null,
      balanceLastUpdatedAt: input.balanceLastUpdatedAt ?? null,
      ...(input.totalMonths != null ? { totalMonths: input.totalMonths } : {}),
      creditLimit: input.creditLimit ?? null,
      linkedCreditCardId: input.linkedCreditCardId ?? null,
      subscriptionDueDay: input.subscriptionDueDay ?? null,
      annualInterestRate: input.annualInterestRate ?? null,
      interestFrequency: input.interestFrequency ?? null,
      paymentSource: input.paymentSource?.trim() || null,
      paymentSourceAccountId: input.paymentSourceAccountId ?? null,
      sharedCreditLimitAccountId: input.sharedCreditLimitAccountId ?? null,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(accounts.id, id));

  await syncSharedCreditLimitPartner(
    db,
    id,
    existing?.sharedCreditLimitAccountId ?? null,
    input.sharedCreditLimitAccountId ?? null,
  );
}

export async function setAccountArchived(db: Database, id: number, isArchived: boolean): Promise<void> {
  await db.update(accounts).set({ isArchived, updatedAt: sql`(datetime('now'))` }).where(eq(accounts.id, id));
}

/**
 * Marks an account's monthly amount due as paid for `monthKey` ('YYYY-MM'), hiding it from the
 * Recurring screen until the next month, and decrements `remainingMonths` if set and above zero.
 *
 * The payment is logged as a two-leg transfer so it shows up in the ledger: an expense leg on the
 * configured `paymentSourceAccountId` (or with no account, for untracked sources like a salary
 * deduction) and an income leg on this account, which is what actually reduces the balance owed.
 */
export async function markMonthlyDuePaid(
  db: Database,
  id: number,
  monthKey: string,
  occurredAt: string,
): Promise<void> {
  const [account] = await db
    .select({
      name: accounts.name,
      remainingMonths: accounts.remainingMonths,
      monthlyAmountDue: accounts.monthlyAmountDue,
      totalMonths: accounts.totalMonths,
      paymentSourceAccountId: accounts.paymentSourceAccountId,
    })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account) return;

  const amount = account.monthlyAmountDue ?? 0;

  await db.transaction(async (tx) => {
    let paidTransactionId: number | null = null;

    if (amount > 0) {
      const [expenseLeg] = await tx
        .insert(transactions)
        .values({
          type: 'expense',
          amount,
          occurredAt,
          note: account.name,
          accountId: account.paymentSourceAccountId ?? null,
          uuid: generateUuid(),
        })
        .returning();

      await tx.insert(transactions).values({
        type: 'income',
        amount,
        occurredAt,
        note: account.name,
        accountId: id,
        transferId: expenseLeg.id,
        excludeFromExpense: true,
        uuid: generateUuid(),
      });
      await tx.update(transactions).set({ transferId: expenseLeg.id }).where(eq(transactions.id, expenseLeg.id));
      paidTransactionId = expenseLeg.id;
    }

    await tx
      .update(accounts)
      .set({
        monthlyDueLastPaidMonth: monthKey,
        remainingMonths:
          account.remainingMonths != null && account.remainingMonths > 0 ? account.remainingMonths - 1 : account.remainingMonths,
        totalMonths: account.totalMonths + 1,
        monthlyDuePaidTransactionId: paidTransactionId,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(accounts.id, id));
  });
}

/**
 * Reverses `markMonthlyDuePaid`, restoring the account's monthly due to the Recurring screen and
 * deleting the transfer legs it logged. Dues paid before transaction logging existed have no
 * `monthlyDuePaidTransactionId` — those adjusted `startingBalance` directly, so undo restores it
 * the same way.
 */
export async function markMonthlyDueUnpaid(db: Database, id: number): Promise<void> {
  const [account] = await db
    .select({
      remainingMonths: accounts.remainingMonths,
      monthlyDueLastPaidMonth: accounts.monthlyDueLastPaidMonth,
      monthlyAmountDue: accounts.monthlyAmountDue,
      startingBalance: accounts.startingBalance,
      monthlyDuePaidTransactionId: accounts.monthlyDuePaidTransactionId,
      totalMonths: accounts.totalMonths,
    })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account?.monthlyDueLastPaidMonth) return;

  const paidTransactionId = account.monthlyDuePaidTransactionId;

  await db.transaction(async (tx) => {
    if (paidTransactionId != null) {
      await tx
        .update(transactions)
        .set({ deletedAt: sql`(datetime('now'))`, updatedAt: sql`(datetime('now'))` })
        .where(eq(transactions.transferId, paidTransactionId));
    }

    await tx
      .update(accounts)
      .set({
        monthlyDueLastPaidMonth: null,
        remainingMonths: account.remainingMonths != null ? account.remainingMonths + 1 : null,
        // Legacy rows adjusted the balance directly instead of logging a transfer.
        ...(paidTransactionId == null
          ? { startingBalance: account.startingBalance + (account.monthlyAmountDue ?? 0) }
          : {}),
        totalMonths: Math.max(0, account.totalMonths - 1),
        monthlyDuePaidTransactionId: null,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(accounts.id, id));
  });
}

/**
 * Adds an investment-kind account's `monthlyContribution` to its starting balance and records
 * today's date as `balanceLastUpdatedAt`.
 */
export async function incrementAccountBalance(db: Database, id: number): Promise<void> {
  const [account] = await db
    .select({ startingBalance: accounts.startingBalance, monthlyContribution: accounts.monthlyContribution, totalMonths: accounts.totalMonths })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account?.monthlyContribution) return;
  await db
    .update(accounts)
    .set({
      startingBalance: account.startingBalance + account.monthlyContribution,
      balanceLastUpdatedAt: formatIsoDate(new Date()),
      totalMonths: account.totalMonths + 1,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(accounts.id, id));
}

export async function getHistoricalTotals(
  db: Database,
  asOfDate: string,
): Promise<{ netWorth: number; totalBalance: number }> {
  const rows = await db
    .select({
      balance: sql<number>`${accounts.startingBalance} + coalesce(sum(case
        when ${accountCategories.kind} = 'credit_card' then
          (case when ${transactions.type} = 'expense' then ${transactions.amount}
            when ${transactions.type} = 'income' then -${transactions.amount}
            else 0 end) + ${transactions.fee}
        else
          (case when ${transactions.type} = 'income' then ${transactions.amount}
            when ${transactions.type} = 'expense' then -${transactions.amount}
            else 0 end) - ${transactions.fee}
        end), 0)`,
      includeInNetWorth: accounts.includeInNetWorth,
      kind: accountCategories.kind,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt), lte(transactions.occurredAt, asOfDate)),
    )
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .where(and(isNull(accounts.deletedAt), eq(accounts.isArchived, false)))
    .groupBy(accounts.id);

  let netWorth = 0;
  let totalBalance = 0;
  for (const row of rows) {
    const signed = row.kind === 'credit_card' ? -row.balance : row.balance;
    if (row.includeInNetWorth) netWorth += signed;
    totalBalance += signed;
  }
  return { netWorth, totalBalance };
}

export async function getHistoricalAccountBalances(
  db: Database,
  asOfDate: string,
): Promise<Record<number, number>> {
  const rows = await db
    .select({ id: accounts.id, balance: balanceExpr })
    .from(accounts)
    .leftJoin(
      transactions,
      and(eq(transactions.accountId, accounts.id), isNull(transactions.deletedAt), lte(transactions.occurredAt, asOfDate)),
    )
    .leftJoin(accountCategories, eq(accountCategories.id, accounts.categoryId))
    .where(and(isNull(accounts.deletedAt), eq(accounts.isArchived, false)))
    .groupBy(accounts.id);

  const result: Record<number, number> = {};
  for (const row of rows) result[row.id] = row.balance;
  return result;
}
