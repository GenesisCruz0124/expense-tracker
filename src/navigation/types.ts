import type { NavigatorScreenParams } from '@react-navigation/native';

export type TransactionsStackParamList = {
  TransactionsList: { type?: 'expense' | 'income'; start?: string; end?: string; runningBalance?: boolean } | undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountTransactions: { accountId: number };
};

export type MoreStackParamList = {
  Settings: undefined;
  Categories: undefined;
  AccountCategories: undefined;
  Billers: undefined;
  Activation: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  TransactionsTab: NavigatorScreenParams<TransactionsStackParamList>;
  AccountsTab: NavigatorScreenParams<AccountsStackParamList>;
  Bills: undefined;
  Reports: undefined;
  Budgets: undefined;
  MoreTab: NavigatorScreenParams<MoreStackParamList>;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  AddEditTransaction: { transactionId?: number; accountId?: number; transactionType?: 'expense' | 'income' | 'transfer' } | undefined;
  AddEditCategory: { categoryId?: number; lockType?: 'expense' | 'income' | 'both' } | undefined;
  AddEditAccountCategory: { accountCategoryId?: number } | undefined;
  AddEditBudget: { budgetId?: number; monthKey: string; prefillCategoryId?: number; prefillAmount?: number };
  AddEditRecurring: { recurringId?: number } | undefined;
  AddEditAccount: { accountId?: number } | undefined;
  AddEditBill: { billId?: number } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
