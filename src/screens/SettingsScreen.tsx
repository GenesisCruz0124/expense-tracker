import React, { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { deleteAllTransactions } from '../db/queries/transactions';
import type { MoreStackParamList } from '../navigation/types';
import { createBackupFile, pickBackupFile, restoreBackupFromFile, shareBackupFile } from '../utils/backup';
import { getNotificationPermissionStatus, requestNotificationPermissions } from '../utils/notifications';

const DEVELOPER_EMAIL = 'genesiscruz.dev@gmail.com';

const STATUS_LABEL: Record<Notifications.PermissionStatus, string> = {
  [Notifications.PermissionStatus.GRANTED]: 'Enabled',
  [Notifications.PermissionStatus.DENIED]: 'Denied',
  [Notifications.PermissionStatus.UNDETERMINED]: 'Not yet requested',
};

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { db, notifyDataChanged } = useDatabase();
  const [status, setStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [clearing, setClearing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const refreshStatus = useCallback(() => {
    getNotificationPermissionStatus().then(setStatus);
  }, []);

  useFocusEffect(refreshStatus);

  async function handleRequestPermission() {
    setStatus(await requestNotificationPermissions());
  }

  function handleClearTransactions() {
    Alert.alert(
      'Clear all transactions?',
      'This permanently deletes every logged transaction on this device. Categories, budgets, accounts, and recurring rules are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              await deleteAllTransactions(db);
              notifyDataChanged();
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  }

  async function handleCreateBackup() {
    setBackingUp(true);
    try {
      const fileUri = await createBackupFile(db);
      await shareBackupFile(fileUri);
    } catch (error) {
      Alert.alert('Backup failed', error instanceof Error ? error.message : 'Something went wrong while creating the backup.');
    } finally {
      setBackingUp(false);
    }
  }

  async function handleRestoreBackup() {
    let pickedUri: string | null;
    try {
      pickedUri = await pickBackupFile();
    } catch (error) {
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Could not open the file picker.');
      return;
    }
    if (!pickedUri) return;
    const fileUri = pickedUri;

    Alert.alert(
      'Restore from backup?',
      'This replaces all current transactions, accounts, categories, budgets, and recurring rules with the contents of this backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoring(true);
            try {
              await restoreBackupFromFile(db, fileUri);
              notifyDataChanged();
              Alert.alert('Restore complete', 'Your data has been restored from the backup.');
            } catch (error) {
              Alert.alert('Restore failed', error instanceof Error ? error.message : 'Something went wrong while restoring the backup.');
            } finally {
              setRestoring(false);
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manage</Text>
        <Pressable style={styles.row} onPress={() => navigation.navigate('Categories')}>
          <Text style={styles.rowLabel}>Transaction Categories</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => navigation.navigate('AccountCategories')}>
          <Text style={styles.rowLabel}>Account Types</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Budget alerts</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Text style={styles.rowValue}>{status != null ? STATUS_LABEL[status] : '…'}</Text>
        </View>
        {status === Notifications.PermissionStatus.UNDETERMINED ? (
          <Pressable style={styles.button} onPress={handleRequestPermission}>
            <Text style={styles.buttonText}>Enable notifications</Text>
          </Pressable>
        ) : null}
        {status === Notifications.PermissionStatus.DENIED ? (
          <Pressable style={styles.button} onPress={() => Linking.openSettings()}>
            <Text style={styles.buttonText}>Open system settings</Text>
          </Pressable>
        ) : null}
        <Text style={styles.helperText}>
          Budget alerts are checked when you open the app or log an expense — not via background polling, since this
          app runs entirely offline on your device.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup & restore</Text>
        <Text style={styles.helperText}>
          Export everything — transactions, accounts, categories, budgets, recurring rules, and attached receipt and
          QR images — into a single backup file you can save or send anywhere.
        </Text>
        <Pressable style={styles.button} onPress={handleCreateBackup} disabled={backingUp || restoring}>
          <Text style={styles.buttonText}>{backingUp ? 'Preparing backup…' : 'Create backup'}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleRestoreBackup} disabled={backingUp || restoring}>
          <Text style={styles.buttonText}>{restoring ? 'Restoring…' : 'Restore from backup'}</Text>
        </Pressable>
        <Text style={styles.helperText}>
          Restoring replaces all current data on this device with the contents of the chosen backup file.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your data</Text>
        <Text style={styles.helperText}>
          Everything you enter — transactions, categories, budgets, and recurring rules — is stored locally on this
          device using SQLite. Nothing is uploaded, synced, or shared.
        </Text>
        <Pressable
          style={[styles.button, styles.dangerButton]}
          onPress={handleClearTransactions}
          disabled={clearing}
        >
          <Text style={[styles.buttonText, styles.dangerButtonText]}>
            {clearing ? 'Clearing…' : 'Clear all transactions'}
          </Text>
        </Pressable>
        <Text style={styles.helperText}>
          Removes every logged transaction so you can start fresh. Categories, budgets, accounts, and recurring rules
          stay intact.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App</Text>
          <Text style={styles.rowValue}>Expense Tracker</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '—'}</Text>
        </View>
        <Pressable style={styles.row} onPress={() => Linking.openURL(`mailto:${DEVELOPER_EMAIL}`)}>
          <Text style={styles.rowLabel}>Developer</Text>
          <Text style={[styles.rowValue, styles.rowValueLink]}>{DEVELOPER_EMAIL}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  section: {
    gap: 10,
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: PALETTE.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: PALETTE.textPrimary, fontWeight: '600' },
  rowValue: { fontSize: 14, color: PALETTE.textSecondary },
  rowChevron: { fontSize: 18, color: PALETTE.textSecondary },
  rowValueLink: { color: PALETTE.net, fontWeight: '600' },
  button: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: `${PALETTE.net}1A` },
  buttonText: { fontSize: 13, fontWeight: '700', color: PALETTE.net },
  dangerButton: { backgroundColor: `${PALETTE.danger}1A` },
  dangerButtonText: { color: PALETTE.danger },
  helperText: { fontSize: 12, color: PALETTE.textSecondary, lineHeight: 18 },
});
