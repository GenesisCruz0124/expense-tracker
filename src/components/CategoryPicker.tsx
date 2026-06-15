import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import { useCategories } from '../hooks/useCategories';
import { CategoryBadge } from './CategoryBadge';
import { EmptyState } from './EmptyState';

interface Props {
  forType: 'expense' | 'income';
  selectedCategoryId: number | null;
  onSelect: (categoryId: number | null) => void;
}

/** Filters its options to categories matching `forType` (or 'both') so a user logging an
 * expense never sees income-only categories like "Salary", and vice versa. */
export function CategoryPicker({ forType, selectedCategoryId, onSelect }: Props) {
  const { categories, loading } = useCategories({ forType });
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selected = categories.find((category) => category.id === selectedCategoryId) ?? null;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(trimmed));
  }, [categories, query]);

  function open() {
    setQuery('');
    setVisible(true);
  }

  function close() {
    setVisible(false);
    setQuery('');
  }

  function handleSelect(categoryId: number) {
    onSelect(categoryId);
    close();
  }

  return (
    <View>
      <Pressable style={styles.trigger} onPress={open}>
        {selected ? (
          <CategoryBadge name={selected.name} color={selected.color} icon={selected.icon} />
        ) : (
          <Text style={styles.placeholder}>Select a category</Text>
        )}
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose a category</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={styles.closeLink}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Type to search categories"
              placeholderTextColor={PALETTE.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContainer}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="🏷️"
                  title={query ? 'No matching categories' : 'No categories yet'}
                  message={
                    query
                      ? `Nothing matches "${query}". Try a different search.`
                      : 'Add categories from the More tab to start organizing transactions.'
                  }
                />
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.optionRow, item.id === selectedCategoryId && styles.optionRowSelected]}
                onPress={() => handleSelect(item.id)}
              >
                <CategoryBadge name={item.name} color={item.color} icon={item.icon} />
                {item.id === selectedCategoryId ? <Text style={styles.checkmark}>✓</Text> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  placeholder: { fontSize: 14, color: PALETTE.textSecondary },
  chevron: { fontSize: 16, color: PALETTE.textSecondary },
  modal: { flex: 1, backgroundColor: PALETTE.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary },
  closeLink: { fontSize: 15, fontWeight: '600', color: PALETTE.net },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchInput: {
    flex: 1,
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: PALETTE.textPrimary,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  clearButtonText: { fontSize: 14, color: PALETTE.textSecondary, fontWeight: '600' },
  listContainer: { padding: 16, gap: 8 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionRowSelected: { borderColor: PALETTE.net },
  checkmark: { fontSize: 16, fontWeight: '700', color: PALETTE.net },
});
