import type { NavigatorScreenParams } from '@react-navigation/native';

export type TransactionsStackParamList = {
  TransactionsList: undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
};

export type MoreStackParamList = {
  Settings: undefined;
  Categories: undefined;
  AccountCategories: undefined;
  /** `fromDashboard` swaps the back button to jump straight to the Dashboard tab instead of Settings. */
  Budgets: { fromDashboard?: boolean } | undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  TransactionsTab: NavigatorScreenParams<TransactionsStackParamList>;
  AccountsTab: NavigatorScreenParams<AccountsStackParamList>;
  Bills: undefined;
  Reports: undefined;
  MoreTab: NavigatorScreenParams<MoreStackParamList>;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  AddEditTransaction: { transactionId?: number } | undefined;
  AddEditCategory: { categoryId?: number } | undefined;
  AddEditAccountCategory: { accountCategoryId?: number } | undefined;
  AddEditBudget: { budgetId?: number; monthKey: string };
  AddEditRecurring: { recurringId?: number } | undefined;
  AddBill: undefined;
  AddEditAccount: { accountId?: number } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
