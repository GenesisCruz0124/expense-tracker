import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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
import { supabase } from '../sync/supabaseClient';

interface AuthContextValue {
  session: Session | null;
  isAuthModalVisible: boolean;
  showAuthModal: () => void;
  hideAuthModal: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

type Mode = 'sign_in' | 'sign_up';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthModalVisible, setAuthModalVisible] = useState(false);
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !supabase) return;
    initialized.current = true;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const showAuthModal = useCallback(() => {
    setMode('sign_in');
    setEmail('');
    setPassword('');
    setError('');
    setAuthModalVisible(true);
  }, []);

  const hideAuthModal = useCallback(() => setAuthModalVisible(false), []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  async function handleSubmit() {
    if (!supabase) return;
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: authError } =
      mode === 'sign_in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setAuthModalVisible(false);
  }

  return (
    <AuthContext.Provider value={{ session, isAuthModalVisible, showAuthModal, hideAuthModal, signOut }}>
      {children}

      <Modal visible={isAuthModalVisible} animationType="slide" statusBarTranslucent onRequestClose={hideAuthModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalRoot}>
          <View style={styles.modalContent}>
            <Pressable style={styles.closeButton} onPress={hideAuthModal}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>

            <Text style={styles.syncIcon}>🔄</Text>
            <Text style={styles.modalTitle}>{mode === 'sign_in' ? 'Sign in to sync' : 'Create an account'}</Text>
            <Text style={styles.modalSubtitle}>
              Sign in to back up your data and keep it in sync across your devices.
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={PALETTE.textSecondary}
                value={email}
                onChangeText={(text) => {
                  setError('');
                  setEmail(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={PALETTE.textSecondary}
                value={password}
                onChangeText={(text) => {
                  setError('');
                  setPassword(text);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <Pressable style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{mode === 'sign_in' ? 'Sign in' : 'Sign up'}</Text>
              )}
            </Pressable>

            <Pressable onPress={() => setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')}>
              <Text style={styles.switchModeText}>
                {mode === 'sign_in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AuthContext.Provider>
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
  closeButton: { position: 'absolute', top: 24, right: 24, padding: 8 },
  closeButtonText: { fontSize: 18, color: PALETTE.textSecondary, fontWeight: '700' },
  syncIcon: { fontSize: 48 },
  modalTitle: { fontSize: 26, fontWeight: '800', color: PALETTE.textPrimary, textAlign: 'center' },
  modalSubtitle: {
    fontSize: 14,
    color: PALETTE.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  inputGroup: { width: '100%', gap: 10 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.textPrimary,
    backgroundColor: PALETTE.surface,
  },
  errorText: { fontSize: 12, color: PALETTE.expense, textAlign: 'center' },
  submitButton: {
    width: '100%',
    backgroundColor: PALETTE.net,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchModeText: { fontSize: 13, color: PALETTE.net, fontWeight: '600' },
});
