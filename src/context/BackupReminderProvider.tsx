import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import { getSetting, setSetting } from '../db/queries/settings';
import { createBackupFile, shareBackupFile } from '../utils/backup';
import { formatIsoDate } from '../utils/dateRanges';
import { useDatabase } from './DatabaseProvider';

export function BackupReminderProvider({ children }: { children: React.ReactNode }) {
  const { db } = useDatabase();
  const [visible, setVisible] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      const today = formatIsoDate(new Date());
      const lastShown = await getSetting(db, 'lastBackupReminderShownAt');
      const lastBackedUp = await getSetting(db, 'lastBackupCompletedAt');

      if (lastShown !== today && lastBackedUp !== today) {
        setVisible(true);
        await setSetting(db, 'lastBackupReminderShownAt', today);
      }
    })();
  }, [db]);

  async function handleBackupNow() {
    setBackingUp(true);
    try {
      const fileUri = await createBackupFile(db);
      await shareBackupFile(fileUri);
      await setSetting(db, 'lastBackupCompletedAt', formatIsoDate(new Date()));
      setVisible(false);
    } catch (error) {
      Alert.alert('Backup failed', error instanceof Error ? error.message : 'Something went wrong while creating the backup.');
    } finally {
      setBackingUp(false);
    }
  }

  function handleRemindLater() {
    setVisible(false);
  }

  return (
    <>
      {children}

      <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={handleRemindLater}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.icon}>🗄️</Text>
            <Text style={styles.title}>Back up your data</Text>
            <Text style={styles.subtitle}>
              Don't lose your transactions, accounts, and budgets — back them up regularly in case something happens to this device.
            </Text>

            <Pressable style={[styles.primaryButton, backingUp && styles.buttonDisabled]} onPress={handleBackupNow} disabled={backingUp}>
              {backingUp ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Backup now</Text>}
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={handleRemindLater} disabled={backingUp}>
              <Text style={styles.secondaryButtonText}>Remind me later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: PALETTE.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  icon: { fontSize: 36 },
  title: { fontSize: 18, fontWeight: '800', color: PALETTE.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: 13, color: PALETTE.textSecondary, textAlign: 'center', lineHeight: 19 },
  primaryButton: {
    width: '100%',
    backgroundColor: PALETTE.net,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { paddingVertical: 10, alignItems: 'center', width: '100%' },
  secondaryButtonText: { color: PALETTE.textSecondary, fontSize: 14, fontWeight: '600' },
});
