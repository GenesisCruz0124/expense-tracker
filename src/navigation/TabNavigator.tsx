import React from 'react';
import { Pressable, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PALETTE } from '../constants/colors';
import AccountCategoriesScreen from '../screens/AccountCategoriesScreen';
import AccountsScreen from '../screens/AccountsScreen';
import BudgetsScreen from '../screens/BudgetsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import DashboardScreen from '../screens/DashboardScreen';
import RecurringTransactionsScreen from '../screens/RecurringTransactionsScreen';
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

// Dashboard's "Manage →" / "View all →" links push these screens onto the More stack from a
// different tab. The default back button would pop to Settings (the stack's first screen),
// which feels wrong when the user actually came from the Dashboard — so swap it for a button
// that jumps straight back there.
function BackToDashboardButton({ navigation }: { navigation: NativeStackNavigationProp<MoreStackParamList> }) {
  return (
    <Pressable
      onPress={() => (navigation as unknown as { navigate: (name: 'Dashboard') => void }).navigate('Dashboard')}
      hitSlop={10}
      style={{ paddingRight: 16 }}
    >
      <Text style={{ fontSize: 17, fontWeight: '600', color: PALETTE.net }}>‹ Dashboard</Text>
    </Pressable>
  );
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
    </AccountsStack.Navigator>
  );
}

// Hosts Settings plus the management screens (Categories, Budgets) as pushes, keeping the
// bottom tab bar lean instead of one-per-screen. Recurring lives in its own "Bills" tab.
function MoreNavigator() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <MoreStack.Screen
        name="AccountCategories"
        component={AccountCategoriesScreen}
        options={{ title: 'Account categories' }}
      />
      <MoreStack.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={({ navigation, route }) =>
          route.params?.fromDashboard ? { headerLeft: () => <BackToDashboardButton navigation={navigation} /> } : {}
        }
      />
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
        component={RecurringTransactionsScreen}
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
