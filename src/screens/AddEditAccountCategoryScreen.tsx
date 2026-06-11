import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { ACCOUNT_ICON_OPTIONS, DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { CATEGORY_COLOR_PALETTE, PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getAccountCategory } from '../db/queries/accountCategories';
import { useAccountCategories } from '../hooks/useAccountCategories';
import type { RootStackParamList } from '../navigation/types';

export default function AddEditAccountCategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditAccountCategory'>>();
  const accountCategoryId = route.params?.accountCategoryId;
  const isEditing = accountCategoryId != null;

  const { db } = useDatabase();
  const { createAccountCategory, updateAccountCategory } = useAccountCategories({ includeArchived: true });

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<string>(DEFAULT_ACCOUNT_ICON);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getAccountCategory(db, accountCategoryId);
      if (!existing || cancelled) return;
      setName(existing.name);
      setColor(existing.color);
      setIcon(existing.icon ?? DEFAULT_ACCOUNT_ICON);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isEditing, accountCategoryId]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit account category' : 'Add account category' });
  }, [navigation, isEditing]);

  async function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the category a name.');
      return;
    }

    setSaving(true);
    try {
      const input = { name: trimmed, color, icon };
      if (isEditing) {
        await updateAccountCategory(accountCategoryId, input);
      } else {
        await createAccountCategory(input);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save — is the name already in use?');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Savings"
          placeholderTextColor={PALETTE.textSecondary}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Color</Text>
        <View style={styles.swatchRow}>
          {CATEGORY_COLOR_PALETTE.map((swatch) => (
            <Pressable
              key={swatch}
              onPress={() => setColor(swatch)}
              style={[styles.swatch, { backgroundColor: swatch }, swatch === color && styles.swatchSelected]}
            >
              {swatch === color ? <Text style={styles.swatchCheck}>✓</Text> : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Icon</Text>
        <View style={styles.iconRow}>
          {ACCOUNT_ICON_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setIcon(option)}
              style={[styles.iconOption, option === icon && styles.iconOptionSelected]}
            >
              <Text style={styles.iconOptionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add category'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.background },
  loadingText: { color: PALETTE.textSecondary, fontSize: 14 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  input: {
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: PALETTE.textPrimary,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 2.5, borderColor: PALETTE.textPrimary },
  swatchCheck: { color: '#fff', fontSize: 15, fontWeight: '700' },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
  },
  iconOptionSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  iconOptionText: { fontSize: 20 },
  error: { fontSize: 13, color: PALETTE.danger, textAlign: 'center' },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
