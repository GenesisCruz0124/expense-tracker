import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PALETTE } from '../constants/colors';
import { getSetting, setSetting } from '../db/queries/settings';
import { TRIAL_DAYS, trialDaysLeft, validateKey } from '../utils/license';
import { useDatabase } from './DatabaseProvider';

export type LicenseStatus = 'loading' | 'trial' | 'pro' | 'expired';

interface LicenseContextValue {
  status: LicenseStatus;
  daysLeft: number;
  activateKey: (key: string) => Promise<'ok' | 'invalid'>;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within a LicenseProvider');
  return ctx;
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const { db } = useDatabase();
  const [status, setStatus] = useState<LicenseStatus>('loading');
  const [daysLeft, setDaysLeft] = useState(TRIAL_DAYS);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [activating, setActivating] = useState(false);
  const initialized = useRef(false);

  const computeStatus = useCallback(
    (firstLaunchAt: string | null, licenseKey: string | null) => {
      if (licenseKey && validateKey(licenseKey)) {
        setStatus('pro');
        setDaysLeft(0);
        return;
      }
      if (!firstLaunchAt) {
        setStatus('trial');
        setDaysLeft(TRIAL_DAYS);
        return;
      }
      const left = trialDaysLeft(firstLaunchAt);
      setDaysLeft(left);
      setStatus(left > 0 ? 'trial' : 'expired');
    },
    [],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        let firstLaunchAt = await getSetting(db, 'firstLaunchAt');
        if (!firstLaunchAt) {
          firstLaunchAt = new Date().toISOString().slice(0, 10);
          await setSetting(db, 'firstLaunchAt', firstLaunchAt);
        }
        const licenseKey = await getSetting(db, 'licenseKey');
        computeStatus(firstLaunchAt, licenseKey);
      } catch {
        setStatus('trial');
        setDaysLeft(TRIAL_DAYS);
      }
    })();
  }, [db, computeStatus]);

  const activateKey = useCallback(
    async (key: string): Promise<'ok' | 'invalid'> => {
      if (!validateKey(key)) return 'invalid';
      await setSetting(db, 'licenseKey', key.trim().toUpperCase());
      setStatus('pro');
      setDaysLeft(0);
      return 'ok';
    },
    [db],
  );

  async function handleActivate() {
    if (!keyInput.trim()) {
      setKeyError('Please enter a license key.');
      return;
    }
    setActivating(true);
    setKeyError('');
    const result = await activateKey(keyInput);
    setActivating(false);
    if (result === 'invalid') {
      setKeyError('Invalid license key. Please check and try again.');
    }
  }

  function formatKeyInput(raw: string): string {
    const clean = raw.toUpperCase().replace(/[^0-9A-F]/g, '');
    const groups = [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12), clean.slice(12, 16)].filter(Boolean);
    return groups.join('-');
  }

  return (
    <LicenseContext.Provider value={{ status, daysLeft, activateKey }}>
      {children}

      <Modal visible={status === 'expired'} animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalRoot}>
          <View style={styles.modalContent}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.modalTitle}>Trial Expired</Text>
            <Text style={styles.modalSubtitle}>
              Your {TRIAL_DAYS}-day free trial has ended. Enter your license key to unlock Expense Tracker Pro.
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.keyInput, keyError ? styles.keyInputError : null]}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                placeholderTextColor={PALETTE.textSecondary}
                value={keyInput}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={19}
                onChangeText={(text) => {
                  setKeyError('');
                  setKeyInput(formatKeyInput(text.replace(/-/g, '')));
                }}
              />
              {keyError ? <Text style={styles.errorText}>{keyError}</Text> : null}
            </View>

            <Pressable
              style={[styles.activateButton, activating && styles.activateButtonDisabled]}
              onPress={handleActivate}
              disabled={activating}
            >
              {activating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.activateButtonText}>Activate Pro</Text>
              )}
            </Pressable>

            <Text style={styles.contactHint}>
              Need a license key? Contact{'\n'}
              <Text style={styles.contactEmail}>genesiscruz.dev@gmail.com</Text>
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LicenseContext.Provider>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: PALETTE.background },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  lockIcon: { fontSize: 48 },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: PALETTE.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: PALETTE.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  inputGroup: { width: '100%', gap: 6 },
  keyInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.textPrimary,
    backgroundColor: PALETTE.surface,
    textAlign: 'center',
    letterSpacing: 2,
  },
  keyInputError: { borderColor: PALETTE.expense },
  errorText: { fontSize: 12, color: PALETTE.expense, textAlign: 'center' },
  activateButton: {
    width: '100%',
    backgroundColor: PALETTE.net,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activateButtonDisabled: { opacity: 0.6 },
  activateButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  contactHint: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  contactEmail: { color: PALETTE.net, fontWeight: '600' },
});
