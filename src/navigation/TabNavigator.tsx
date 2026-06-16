import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PALETTE } from '../constants/colors';
import AccountCategoriesScreen from '../screens/AccountCategoriesScreen';
import AccountsScreen from '../screens/AccountsScreen';
import AccountTransactionsScreen from '../screens/AccountTransactionsScreen';
import ActivationScreen from '../screens/ActivationScreen';
import BillersScreen from '../screens/BillersScreen';
import BillsScreen from '../screens/BillsScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TransactionsListScreen from '../screens/TransactionsListScreen';
import type { AccountsStackParamList, MoreStackParamList, TabParamList, TransactionsStackParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();
const TransactionsStack = createNativeStackNavigator<TransactionsStackParamList>();
const AccountsStack = createNativeStackNavigator<AccountsStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function TabGlyph({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>;
}

function TransactionsNavigator() {
  return (
    <TransactionsStack.Navigator>
      <TransactionsStack.Screen
        name="TransactionsList"
        component={TransactionsListScreen}
        options={{ title: 'Transactions' }}
      />
    </TransactionsStack.Navigator>
  );
}

function AccountsNavigator() {
  return (
    <AccountsStack.Navigator>
      <AccountsStack.Screen name="AccountsList" component={AccountsScreen} options={{ title: 'Accounts' }} />
      <AccountsStack.Screen name="AccountTransactions" component={AccountTransactionsScreen} />
    </AccountsStack.Navigator>
  );
}

// Hosts Settings plus the management screens (Transaction Categories, Account Types, Billers) as
// pushes, keeping the bottom tab bar lean instead of one-per-screen. Recurring and Budgets
// live in their own tabs.
function MoreNavigator() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: 'Transaction Categories' }}
      />
      <MoreStack.Screen
        name="AccountCategories"
        component={AccountCategoriesScreen}
        options={{ title: 'Account Types' }}
      />
      <MoreStack.Screen name="Billers" component={BillersScreen} options={{ title: 'Billers' }} />
      <MoreStack.Screen name="Activation" component={ActivationScreen} options={{ title: 'Activate Pro' }} />
    </MoreStack.Navigator>
  );
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: PALETTE.net,
        tabBarInactiveTintColor: PALETTE.textSecondary,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabGlyph glyph="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="TransactionsTab"
        component={TransactionsNavigator}
        options={{
          headerShown: false,
          title: 'Transactions',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="📋" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AccountsTab"
        component={AccountsNavigator}
        options={{
          headerShown: false,
          title: 'Accounts',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="🏦" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Bills"
        component={BillsScreen}
        options={{
          title: 'Bills',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="🧾" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabGlyph glyph="📊" focused={focused} /> }}
      />
      <Tab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabGlyph glyph="🎯" focused={focused} /> }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreNavigator}
        options={{
          headerShown: false,
          title: 'More',
          tabBarIcon: ({ focused }) => <TabGlyph glyph="⚙️" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('MoreTab', { screen: 'Settings' });
          },
        })}
      />
    </Tab.Navigator>
  );
}
