import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { db, type Database } from '../db/client';
import migrations from '../db/migrations/migrations';
import { repairAccountsSchema, repairSyncSchema } from '../db/repair';
import { seedAdditionalCategories, seedDefaultCategories } from '../db/seed';
import { generateDueRecurringTransactions } from '../db/queries/recurring';
import { initSettingsTable } from '../db/queries/settings';
import { backfillRowUuids } from '../db/uuidBackfill';
import { checkBudgetAlerts } from '../db/budgetAlerts';
import { checkBillReminders } from '../db/billReminders';
import { configureNotificationChannel, requestNotificationPermissions } from '../utils/notifications';
import { AppLockGate } from './AppLockGate';
import { AuthProvider } from './AuthProvider';
import { BackupReminderProvider } from './BackupReminderProvider';
import { LicenseProvider } from './LicenseProvider';
import { PALETTE } from '../constants/colors';

interface DatabaseContextValue {
  db: Database;
  /** Bumped whenever a mutation should cause data-dependent screens to refetch from SQLite */
  refreshSignal: number;
  notifyDataChanged: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

function SplashLoadingScreen() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
          Animated.delay(Math.max(0, 600 - delay)),
        ]),
      );
    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 180);
    const a3 = animateDot(dot3, 360);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
  });

  return (
    <View style={styles.splash}>
      <View style={styles.iconRing}>
        <Image
          source={require('../../assets/splash-icon.png')}
          style={styles.splashIcon}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.appName}>Expense Tracker</Text>
      <Text style={styles.tagline}>Your personal finance companion</Text>
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.dot, dotStyle(dot)]} />
        ))}
      </View>
    </View>
  );
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within a DatabaseProvider');
  return ctx;
}

/**
 * Opens the on-device SQLite database, runs pending migrations, then performs the
 * launch-time bootstrap in order: backfill sync uuids for any pre-existing rows (one-time),
 * seed default categories (first run only), add any newly-introduced categories that don't
 * exist yet, generate any recurring transactions that came due since the last open, check
 * budgets for newly crossed alert thresholds, and notify about bills entering their reminder
 * window — in that order, so a freshly generated rent/salary entry is reflected in this same
 * session's budget evaluation.
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
        await repairSyncSchema(db);
        await initSettingsTable(db);
        await backfillRowUuids(db);
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
      <View style={styles.splash}>
        <View style={styles.iconRing}>
          <Text style={styles.iconEmoji}>💸</Text>
        </View>
        <Text style={styles.appName}>Expense Tracker</Text>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Couldn't start the database</Text>
          <Text style={styles.errorBody}>{failure?.message}</Text>
        </View>
      </View>
    );
  }

  if (!success || !bootstrapped) {
    return <SplashLoadingScreen />;
  }

  return (
    <DatabaseContext.Provider value={{ db, refreshSignal, notifyDataChanged }}>
      <AppLockGate>
        <BackupReminderProvider>
          <LicenseProvider>
            <AuthProvider>{children}</AuthProvider>
          </LicenseProvider>
        </BackupReminderProvider>
      </AppLockGate>
    </DatabaseContext.Provider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.background,
    gap: 0,
  },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: PALETTE.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 28,
  },
  splashIcon: {
    width: 80,
    height: 80,
  },
  iconEmoji: { fontSize: 52 },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: PALETTE.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: PALETTE.textSecondary,
    marginBottom: 52,
  },
  dots: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    height: 20,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: PALETTE.primary,
  },
  errorCard: {
    marginTop: 24,
    backgroundColor: PALETTE.surface,
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 32,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  errorTitle: {
    color: PALETTE.danger,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    color: PALETTE.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
