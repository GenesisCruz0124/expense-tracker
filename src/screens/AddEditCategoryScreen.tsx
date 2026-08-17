import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { ActionSheet } from '../components/ActionSheet';
import { CATEGORY_ICON_OPTIONS, DEFAULT_CATEGORY_ICON } from '../constants/categoryIcons';
import { CATEGORY_COLOR_PALETTE, PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import { getCategory, type CategoryType } from '../db/queries/categories';
import { useCategories } from '../hooks/useCategories';
import type { RootStackParamList } from '../navigation/types';

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'both', label: 'Both' },
];

export default function AddEditCategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddEditCategory'>>();
  const categoryId = route.params?.categoryId;
  const lockType = route.params?.lockType;
  const isEditing = categoryId != null;
  const noun = lockType ? 'biller' : 'category';

  const { db } = useDatabase();
  const { categories, createCategory, updateCategory, mergeCategory } = useCategories({ includeArchived: true });

  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(lockType ?? 'expense');
  const [color, setColor] = useState<string>(CATEGORY_COLOR_PALETTE[0]);
  const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);
  const [isBiller, setIsBiller] = useState<boolean>(!!lockType);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [merging, setMerging] = useState(false);

  // Anything active except this category itself is a valid destination; from the Billers screen the
  // list is narrowed to billers so it matches what that screen shows.
  const mergeTargets = categories.filter(
    (candidate) => candidate.id !== categoryId && !candidate.isArchived && (lockType ? candidate.isBiller : true),
  );

  function confirmMerge(targetId: number, targetName: string) {
    setShowMergePicker(false);
    Alert.alert(
      `Merge into "${targetName}"?`,
      `Every transaction, bill, budget, and recurring rule using "${name}" will be moved to "${targetName}", and "${name}" will be deleted. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          style: 'destructive',
          onPress: async () => {
            setMerging(true);
            try {
              await mergeCategory(categoryId!, targetId);
              navigation.goBack();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not merge.');
            } finally {
              setMerging(false);
            }
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;
    (async () => {
      const existing = await getCategory(db, categoryId);
      if (!existing || cancelled) return;
      setName(existing.name);
      setType(existing.type);
      setColor(existing.color);
      setIcon(existing.icon ?? DEFAULT_CATEGORY_ICON);
      setIsBiller(lockType ? true : existing.isBiller);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isEditing, categoryId]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? `Edit ${noun}` : `Add ${noun}` });
  }, [navigation, isEditing, noun]);

  async function handleSave() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the category a name.');
      return;
    }

    setSaving(true);
    try {
      const input = { name: trimmed, type, color, icon, isBiller };
      if (isEditing) {
        await updateCategory(categoryId, input);
      } else {
        await createCategory(input);
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
          placeholder="e.g. Groceries"
          placeholderTextColor={PALETTE.textSecondary}
        />
      </View>

      {!lockType ? (
        <View style={styles.field}>
          <Text style={styles.label}>Used for</Text>
          <View style={styles.optionRow}>
            {TYPE_OPTIONS.map((option) => {
              const selected = option.value === type;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setType(option.value)}
                  style={[styles.optionChip, selected && styles.optionChipSelected]}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

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
          {CATEGORY_ICON_OPTIONS.map((option) => (
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

      {isEditing ? (
        <View style={styles.field}>
          <Text style={styles.label}>Merge into another {noun}</Text>
          <Pressable style={styles.mergeButton} onPress={() => setShowMergePicker(true)} disabled={merging}>
            <Text style={styles.mergeButtonText}>{merging ? 'Merging…' : `Merge this ${noun} into…`}</Text>
          </Pressable>
          <Text style={styles.helperText}>
            Moves every transaction, bill, and budget onto the {noun} you pick, then deletes this one.
          </Text>
          <ActionSheet
            visible={showMergePicker}
            onClose={() => setShowMergePicker(false)}
            title={`Merge "${name}" into`}
            message="This can't be undone."
            options={mergeTargets.map((target) => ({
              label: target.name,
              onPress: () => confirmMerge(target.id, target.name),
            }))}
          />
        </View>
      ) : null}

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : isEditing ? 'Save changes' : `Add ${noun}`}</Text>
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
  optionRow: { flexDirection: 'row', gap: 10 },
  optionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.surface,
  },
  optionChipSelected: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  optionChipText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  optionChipTextSelected: { color: PALETTE.net },
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
  helperText: { fontSize: 12, color: PALETTE.textSecondary, lineHeight: 16 },
  mergeButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
  },
  mergeButtonText: { fontSize: 14, fontWeight: '700', color: PALETTE.danger },
  saveButton: { backgroundColor: PALETTE.net, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
