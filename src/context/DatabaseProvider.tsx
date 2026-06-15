import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { db, type Database } from '../db/client';
import migrations from '../db/migrations/migrations';
import { repairAccountsSchema } from '../db/repair';
import { seedAdditionalCategories, seedDefaultCategories } from '../db/seed';
import { generateDueRecurringTransactions } from '../db/queries/recurring';
import { checkBudgetAlerts } from '../db/budgetAlerts';
import { checkBillReminders } from '../db/billReminders';
import { configureNotificationChannel, requestNotificationPermissions } from '../utils/notifications';
import { PALETTE } from '../constants/colors';

interface DatabaseContextValue {
  db: Database;
  /** Bumped whenever a mutation should cause data-dependent screens to refetch from SQLite */
  refreshSignal: number;
  notifyDataChanged: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within a DatabaseProvider');
  return ctx;
}

/**
 * Opens the on-device SQLite database, runs pending migrations, then performs the
 * launch-time bootstrap in order: seed default categories (first run only), add any
 * newly-introduced categories that don't exist yet, generate any recurring transactions
 * that came due since the last open, check budgets for newly crossed alert thresholds,
 * and notify about bills entering their reminder window — in that order, so a freshly
 * generated rent/salary entry is reflected in this same session's budget evaluation.
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const ranBootstrap = useRef(false);

  useEffect(() => {
    if (!success || ranBootstrap.current) return;
    ranBootstrap.current = true;

    (async () => {
      try {
        await repairAccountsSchema(db);
        await configureNotificationChannel();
        await requestNotificationPermissions();
        await seedDefaultCategories(db);
        await seedAdditionalCategories(db);
        await generateDueRecurringTransactions(db, new Date());
        await checkBudgetAlerts(db, new Date());
        await checkBillReminders(db, new Date());
        setBootstrapped(true);
      } catch (err) {
        setBootstrapError(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  }, [success]);

  const notifyDataChanged = () => setRefreshSignal((value) => value + 1);

  if (error || bootstrapError) {
    const failure = error ?? bootstrapError;
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Couldn't start the database</Text>
        <Text style={styles.errorBody}>{failure?.message}</Text>
      </View>
    );
  }

  if (!success || !bootstrapped) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PALETTE.net} />
        <Text style={styles.loadingText}>Setting up your data…</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{ db, refreshSignal, notifyDataChanged }}>
      {children}
    </DatabaseContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.background,
    gap: 12,
    padding: 24,
  },
  loadingText: { color: PALETTE.textSecondary, fontSize: 14 },
  errorTitle: { color: PALETTE.danger, fontSize: 16, fontWeight: '600' },
  errorBody: { color: PALETTE.textSecondary, fontSize: 13, textAlign: 'center' },
});
