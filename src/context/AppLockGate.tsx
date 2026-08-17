import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import { PALETTE } from '../constants/colors';
import { getSetting } from '../db/queries/settings';
import { useDatabase } from './DatabaseProvider';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { db } = useDatabase();
  const [locked, setLocked] = useState<boolean | null>(null); // null = not yet determined
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    setError(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Expense Tracker',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        setLocked(false);
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch {
      setError('Biometric authentication is unavailable.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      const enabled = await getSetting(db, 'biometricLockEnabled');
      if (enabled === 'true') {
        setLocked(true);
        await authenticate();
      } else {
        setLocked(false);
      }
    })();
  }, [db, authenticate]);

  if (locked === null || locked === false) {
    return <>{children}</>;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Expense Tracker</Text>
      <Text style={styles.subtitle}>Biometric authentication required</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={authenticate}>
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PALETTE.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  icon: { fontSize: 52, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: PALETTE.textPrimary },
  subtitle: { fontSize: 14, color: PALETTE.textSecondary, textAlign: 'center' },
  error: { fontSize: 13, color: PALETTE.expense, textAlign: 'center', marginTop: 4 },
  button: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: PALETTE.net,
  },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
