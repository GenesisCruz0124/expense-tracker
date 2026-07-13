import React, { useCallback, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';

import {
  ACCENT_PRESETS,
  getStoredAccentKey,
  getStoredThemeMode,
  PALETTE,
  THEME_ACCENT_KEY,
  THEME_MODE_KEY,
  type AccentKey,
  type ThemeMode,
} from '../constants/colors';
import { useAuth } from '../context/AuthProvider';
import { useDatabase } from '../context/DatabaseProvider';
import { useLicense } from '../context/LicenseProvider';
import { setPreference } from '../db/themePreferences';
import { TRIAL_DAYS } from '../utils/license';
import { deleteAllTransactions } from '../db/queries/transactions';
import { getSetting, setSetting } from '../db/queries/settings';
import type { MoreStackParamList } from '../navigation/types';
import { createBackupFile, pickBackupFile, restoreBackupFromFile, shareBackupFile } from '../utils/backup';
import { formatIsoDate } from '../utils/dateRanges';
import { getNotificationPermissionStatus, requestNotificationPermissions } from '../utils/notifications';
import { isSyncConfigured } from '../sync/supabaseClient';
import { pushChanges, SyncNotSignedInError } from '../sync/pushChanges';
import { useAppUpdate } from '../hooks/useAppUpdate';

const DEVELOPER_EMAIL = 'genesiscruz.dev@gmail.com';

const STATUS_LABEL: Record<Notifications.PermissionStatus, string> = {
  [Notifications.PermissionStatus.GRANTED]: 'Enabled',
  [Notifications.PermissionStatus.DENIED]: 'Denied',
  [Notifications.PermissionStatus.UNDETERMINED]: 'Not yet requested',
};

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { db, notifyDataChanged } = useDatabase();
  const { status: licenseStatus, daysLeft } = useLicense();
  const { session, showAuthModal, signOut } = useAuth();
  const [status, setStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [clearing, setClearing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState('');
  const { checking, downloading, progress, release, currentVersion, checkForUpdate, downloadAndInstall } = useAppUpdate();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredThemeMode);
  const [accentKey, setAccentKey] = useState<AccentKey>(getStoredAccentKey);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const refreshStatus = useCallback(() => {
    getNotificationPermissionStatus().then(setStatus);
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      getSetting(db, 'biometricLockEnabled'),
    ]).then(([hasHardware, isEnrolled, stored]) => {
      setBiometricAvailable(hasHardware && isEnrolled);
      setBiometricEnabled(stored === 'true');
    });
  }, [db]);

  useFocusEffect(refreshStatus);

  function promptRestart() {
    Alert.alert('Theme updated', 'Close and reopen the app to see the new theme.');
  }

  function handleSelectThemeMode(mode: ThemeMode) {
    if (mode === themeMode) return;
    setPreference(THEME_MODE_KEY, mode);
    setThemeMode(mode);
    promptRestart();
  }

  function handleSelectAccent(key: AccentKey) {
    if (key === accentKey) return;
    setPreference(THEME_ACCENT_KEY, key);
    setAccentKey(key);
    promptRestart();
  }

  async function handleRequestPermission() {
    setStatus(await requestNotificationPermissions());
  }

  async function handleBiometricToggle(value: boolean) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: value ? 'Authenticate to enable biometric lock' : 'Authenticate to disable biometric lock',
      fallbackLabel: 'Use passcode',
    });
    if (!result.success) return;
    await setSetting(db, 'biometricLockEnabled', String(value));
    setBiometricEnabled(value);
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
      await setSetting(db, 'lastBackupCompletedAt', formatIsoDate(new Date()));
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

  async function handleSync() {
    if (!session) {
      showAuthModal();
      return;
    }
    setSyncing(true);
    setLastSyncResult('');
    try {
      const summary = await pushChanges(db);
      setLastSyncResult(
        summary.totalPushed > 0 ? `Synced ${summary.totalPushed} change${summary.totalPushed !== 1 ? 's' : ''}.` : 'Already up to date.',
      );
    } catch (error) {
      if (error instanceof SyncNotSignedInError) {
        showAuthModal();
      } else {
        Alert.alert('Sync failed', error instanceof Error ? error.message : 'Something went wrong while syncing.');
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleCheckForUpdates() {
    try {
      const info = await checkForUpdate();
      if (!info) {
        Alert.alert("You're up to date", `Version ${currentVersion} is the latest.`);
      } else {
        setUpdateModalVisible(true);
      }
    } catch (err) {
      Alert.alert('Update check failed', err instanceof Error ? err.message : 'Could not reach GitHub.');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Text style={styles.rowLabel}>Mode</Text>
        <View style={styles.modeRow}>
          {(['light', 'dark'] as ThemeMode[]).map((mode) => {
            const selected = mode === themeMode;
            return (
              <Pressable
                key={mode}
                style={[styles.modeOption, selected && styles.modeOptionSelected]}
                onPress={() => handleSelectThemeMode(mode)}
              >
                <Text style={[styles.modeOptionText, selected && styles.modeOptionTextSelected]}>
                  {mode === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.rowLabel}>Accent color</Text>
        <View style={styles.accentRow}>
          {(Object.keys(ACCENT_PRESETS) as AccentKey[]).map((key) => {
            const preset = ACCENT_PRESETS[key];
            const selected = key === accentKey;
            return (
              <Pressable
                key={key}
                style={[styles.accentSwatch, { backgroundColor: preset.color }, selected && styles.accentSwatchSelected]}
                onPress={() => handleSelectAccent(key)}
                accessibilityLabel={preset.label}
              >
                {selected ? <Text style={styles.accentSwatchCheck}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>Theme changes take effect the next time you open the app.</Text>
      </View>

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
        <Pressable style={styles.row} onPress={() => navigation.navigate('Billers')}>
          <Text style={styles.rowLabel}>Billers</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>

      {biometricAvailable ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.row}>
            <View style={styles.rowLabelGroup}>
              <Text style={styles.rowLabel}>Biometric lock</Text>
              <Text style={styles.rowSubLabel}>Require fingerprint or face to open the app</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ true: PALETTE.net }}
            />
          </View>
        </View>
      ) : null}

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

      {isSyncConfigured ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Account</Text>
            <Text style={styles.rowValue}>{session ? session.user.email : 'Not signed in'}</Text>
          </View>
          <Text style={styles.helperText}>
            Push your transactions, accounts, categories, budgets, bills, and recurring rules to your account so they
            can be restored on another device.
          </Text>
          <Pressable style={styles.button} onPress={handleSync} disabled={syncing}>
            <Text style={styles.buttonText}>{syncing ? 'Syncing…' : session ? 'Sync now' : 'Sign in to sync'}</Text>
          </Pressable>
          {lastSyncResult ? <Text style={styles.helperText}>{lastSyncResult}</Text> : null}
          {session ? (
            <Pressable style={styles.button} onPress={() => signOut()}>
              <Text style={styles.buttonText}>Sign out</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
        <Text style={styles.sectionTitle}>License</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Status</Text>
          <Text style={[styles.rowValue, licenseStatus === 'pro' && styles.rowValuePro]}>
            {licenseStatus === 'pro'
              ? 'Pro — Activated'
              : licenseStatus === 'trial'
                ? `Trial — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
                : 'Trial expired'}
          </Text>
        </View>
        {licenseStatus !== 'pro' ? (
          <Pressable style={styles.button} onPress={() => navigation.navigate('Activation')}>
            <Text style={styles.buttonText}>Activate License Key</Text>
          </Pressable>
        ) : null}
        {licenseStatus === 'trial' ? (
          <Text style={styles.helperText}>
            You have {daysLeft} of {TRIAL_DAYS} trial days remaining. Activate a license key to unlock Pro permanently.
          </Text>
        ) : null}
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
        {Platform.OS === 'android' ? (
          <Pressable style={styles.row} onPress={handleCheckForUpdates} disabled={checking}>
            <View style={styles.rowLabelGroup}>
              <Text style={styles.rowLabel}>{checking ? 'Checking…' : 'Check for Updates'}</Text>
              <Text style={styles.rowSubLabel}>Installed: v{currentVersion}</Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        ) : null}
      </View>

      {release ? (
        <Modal visible={updateModalVisible} transparent animationType="fade" onRequestClose={() => setUpdateModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Update available</Text>
              <Text style={styles.modalVersionLine}>
                v{currentVersion} → {release.tagName}
              </Text>
              {release.body ? (
                <ScrollView style={styles.releaseNotes} nestedScrollEnabled>
                  <Text style={styles.releaseNotesText}>{release.body}</Text>
                </ScrollView>
              ) : null}
              {downloading ? (
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
              ) : null}
              {downloading ? (
                <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
              ) : null}
              <View style={styles.modalButtons}>
                <Pressable style={styles.modalCancel} onPress={() => setUpdateModalVisible(false)} disabled={downloading}>
                  <Text style={styles.modalCancelText}>Later</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalInstall, downloading && styles.modalInstallDisabled]}
                  onPress={() => downloadAndInstall(release.downloadUrl)}
                  disabled={downloading}
                >
                  <Text style={styles.modalInstallText}>{downloading ? 'Downloading…' : 'Install Update'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
  rowLabelGroup: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, color: PALETTE.textPrimary, fontWeight: '600' },
  rowSubLabel: { fontSize: 12, color: PALETTE.textSecondary },
  rowValue: { fontSize: 14, color: PALETTE.textSecondary },
  rowChevron: { fontSize: 18, color: PALETTE.textSecondary },
  rowValueLink: { color: PALETTE.net, fontWeight: '600' },
  rowValuePro: { color: PALETTE.income, fontWeight: '700' },
  button: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: `${PALETTE.net}1A` },
  buttonText: { fontSize: 13, fontWeight: '700', color: PALETTE.net },
  dangerButton: { backgroundColor: `${PALETTE.danger}1A` },
  dangerButtonText: { color: PALETTE.danger },
  helperText: { fontSize: 12, color: PALETTE.textSecondary, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  modeOptionSelected: { backgroundColor: PALETTE.primary, borderColor: PALETTE.primary },
  modeOptionText: { fontSize: 13, fontWeight: '700', color: PALETTE.textSecondary },
  modeOptionTextSelected: { color: PALETTE.onPrimary },
  accentRow: { flexDirection: 'row', gap: 12 },
  accentSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentSwatchSelected: { borderWidth: 2, borderColor: PALETTE.textPrimary },
  accentSwatchCheck: { color: PALETTE.onPrimary, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: PALETTE.surface, borderRadius: 16, padding: 20, width: '100%', gap: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: PALETTE.textPrimary },
  modalVersionLine: { fontSize: 14, color: PALETTE.textSecondary, fontWeight: '600' },
  releaseNotes: { maxHeight: 180, backgroundColor: PALETTE.background, borderRadius: 8, padding: 10 },
  releaseNotesText: { fontSize: 13, color: PALETTE.textSecondary, lineHeight: 20 },
  progressBarTrack: { height: 6, borderRadius: 3, backgroundColor: PALETTE.border, overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: PALETTE.net },
  progressLabel: { fontSize: 12, color: PALETTE.textSecondary, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: PALETTE.border },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: PALETTE.textSecondary },
  modalInstall: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: PALETTE.net },
  modalInstallDisabled: { opacity: 0.5 },
  modalInstallText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
