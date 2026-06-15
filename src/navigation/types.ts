import type { NavigatorScreenParams } from '@react-navigation/native';

export type TransactionsStackParamList = {
  TransactionsList: undefined;
};

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountTransactions: { accountId: number };
};

export type MoreStackParamList = {
  Settings: undefined;
  Categories: undefined;
  AccountCategories: undefined;
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
  AddEditTransaction: { transactionId?: number } | undefined;
  AddEditCategory: { categoryId?: number } | undefined;
  AddEditAccountCategory: { accountCategoryId?: number } | undefined;
  AddEditBudget: { budgetId?: number; monthKey: string };
  AddEditRecurring: { recurringId?: number } | undefined;
  AddEditAccount: { accountId?: number } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
