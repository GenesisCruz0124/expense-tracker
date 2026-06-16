import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { PALETTE } from '../constants/colors';
import { useLicense } from '../context/LicenseProvider';
import { TRIAL_DAYS } from '../utils/license';

export default function ActivationScreen() {
  const { status, daysLeft, deviceId, activateKey } = useLicense();
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  function formatKeyInput(raw: string): string {
    const clean = raw.toUpperCase().replace(/[^0-9A-F]/g, '');
    const groups = [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12), clean.slice(12, 16)].filter(Boolean);
    return groups.join('-');
  }

  async function handleCopyDeviceId() {
    if (!deviceId) return;
    await Clipboard.setStringAsync(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
      setKeyError('Invalid license key. Keys are bound to this specific device.');
    } else {
      Alert.alert('Activated!', 'Expense Tracker Pro is now unlocked. Thank you!');
    }
  }

  const isPro = status === 'pro';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>{isPro ? '✅' : '⭐'}</Text>
          <Text style={styles.heroTitle}>Expense Tracker Pro</Text>
          <Text style={styles.heroSub}>
            {isPro
              ? 'Your license is active. Thank you for supporting Expense Tracker!'
              : status === 'trial'
                ? `You have ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your free trial.`
                : `Your ${TRIAL_DAYS}-day free trial has ended.`}
          </Text>
        </View>

        {deviceId ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Device ID</Text>
            <Text style={styles.helperText}>
              Share this with the developer to receive a license key bound to this device.
            </Text>
            <View style={styles.deviceIdRow}>
              <Text style={styles.deviceIdValue} selectable>{deviceId}</Text>
              <Pressable style={styles.copyButton} onPress={handleCopyDeviceId}>
                <Text style={styles.copyButtonText}>{copied ? '✓ Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isPro ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activate License</Text>
            <Text style={styles.helperText}>
              Enter your license key below to unlock Pro permanently on this device.
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
                <Text style={styles.activateButtonText}>Activate</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What's included</Text>
          {[
            'Unlimited transactions, accounts & budgets',
            'Recurring rules & bill tracking',
            'Reports & analytics',
            'Backup & restore',
            'No subscription — pay once, use forever',
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Text style={styles.featureCheck}>✓</Text>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get a License Key</Text>
          <Text style={styles.helperText}>
            Contact the developer with your Device ID above to purchase a key for this device.
          </Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={[styles.rowValue, styles.rowValueLink]}>genesiscruz.dev@gmail.com</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.background },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  heroCard: {
    backgroundColor: PALETTE.net,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  heroIcon: { fontSize: 36 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20 },
  section: {
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helperText: { fontSize: 13, color: PALETTE.textSecondary, lineHeight: 19 },
  deviceIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.background,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  deviceIdValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  copyButton: {
    backgroundColor: `${PALETTE.net}1A`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyButtonText: { fontSize: 12, fontWeight: '700', color: PALETTE.net },
  inputGroup: { gap: 6 },
  keyInput: {
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: PALETTE.textPrimary,
    backgroundColor: PALETTE.background,
    textAlign: 'center',
    letterSpacing: 2,
  },
  keyInputError: { borderColor: PALETTE.expense },
  errorText: { fontSize: 12, color: PALETTE.expense },
  activateButton: {
    backgroundColor: PALETTE.net,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activateButtonDisabled: { opacity: 0.6 },
  activateButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureCheck: { fontSize: 14, color: PALETTE.income, fontWeight: '700', lineHeight: 20 },
  featureText: { flex: 1, fontSize: 13, color: PALETTE.textPrimary, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: PALETTE.textPrimary, fontWeight: '600' },
  rowValue: { fontSize: 14, color: PALETTE.textSecondary },
  rowValueLink: { color: PALETTE.net, fontWeight: '600' },
});
