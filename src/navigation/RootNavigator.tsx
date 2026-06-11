import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AddBillScreen from '../screens/AddBillScreen';
import AddEditAccountCategoryScreen from '../screens/AddEditAccountCategoryScreen';
import AddEditAccountScreen from '../screens/AddEditAccountScreen';
import AddEditBudgetScreen from '../screens/AddEditBudgetScreen';
import AddEditCategoryScreen from '../screens/AddEditCategoryScreen';
import AddEditRecurringScreen from '../screens/AddEditRecurringScreen';
import AddEditTransactionScreen from '../screens/AddEditTransactionScreen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Add/Edit forms are pushed as modal-presentation screens over whichever tab is active —
// they're transient, task-focused flows rather than peer destinations like the four tabs.
export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="AddEditTransaction" component={AddEditTransactionScreen} options={{ title: 'Transaction' }} />
        <Stack.Screen name="AddEditCategory" component={AddEditCategoryScreen} options={{ title: 'Category' }} />
        <Stack.Screen
          name="AddEditAccountCategory"
          component={AddEditAccountCategoryScreen}
          options={{ title: 'Account category' }}
        />
        <Stack.Screen name="AddEditAccount" component={AddEditAccountScreen} options={{ title: 'Account' }} />
        <Stack.Screen name="AddEditBudget" component={AddEditBudgetScreen} options={{ title: 'Budget' }} />
        <Stack.Screen
          name="AddEditRecurring"
          component={AddEditRecurringScreen}
          options={{ title: 'Recurring transaction' }}
        />
        <Stack.Screen name="AddBill" component={AddBillScreen} options={{ title: 'Add bill' }} />
      </Stack.Group>
    </Stack.Navigator>
  );
}
