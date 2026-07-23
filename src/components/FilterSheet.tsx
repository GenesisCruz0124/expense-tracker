import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PALETTE } from '../constants/colors';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { AccountIcon } from './AccountIcon';
import { DateField } from './DateField';

export type ExcludedFilter = 'all' | 'hide' | 'only';

const EXCLUDED_FILTER_OPTIONS: { value: ExcludedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'hide', label: 'Hide excluded' },
  { value: 'only', label: 'Only excluded' },
];

export type TypeFilter = 'expense' | 'income' | 'transfer' | undefined;

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string; color: string }[] = [
  { value: undefined, label: 'All', color: PALETTE.textSecondary },
  { value: 'income', label: 'Income', color: PALETTE.income },
  { value: 'expense', label: 'Expense', color: PALETTE.expense },
  { value: 'transfer', label: 'Transfer', color: PALETTE.net },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedCategoryIds: number[];
  onToggleCategory: (id: number) => void;
  uncategorizedSelected: boolean;
  onToggleUncategorized: () => void;
  selectedAccountIds: number[];
  onToggleAccount: (id: number) => void;
  startDate: string;
  endDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  typeFilter: TypeFilter;
  onChangeTypeFilter: (value: TypeFilter) => void;
  excludedFilter: ExcludedFilter;
  onChangeExcludedFilter: (value: ExcludedFilter) => void;
  onClear: () => void;
}

/** Type + category multi-select + date-range + excluded-transactions filter for the Transactions list. */
export function FilterSheet({
  visible,
  onClose,
  selectedCategoryIds,
  onToggleCategory,
  uncategorizedSelected,
  onToggleUncategorized,
  selectedAccountIds,
  onToggleAccount,
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
  typeFilter,
  onChangeTypeFilter,
  excludedFilter,
  onChangeExcludedFilter,
  onClear,
}: Props) {
  const { categories } = useCategories({ includeArchived: true });
  const { accounts } = useAccounts({ includeArchived: true });
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!visible) setSearchText('');
  }, [visible]);

  const search = searchText.trim().toLowerCase();
  const filteredCategories = search ? categories.filter((c) => c.name.toLowerCase().includes(search)) : categories;
  const filteredAccounts = search ? accounts.filter((a) => a.name.toLowerCase().includes(search)) : accounts;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.doneLink}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search categories or accounts"
            placeholderTextColor={PALETTE.textSecondary}
          />

          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.chips}>
            {TYPE_FILTER_OPTIONS.map((option) => {
              const selected = typeFilter === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => onChangeTypeFilter(option.value)}
                  style={[styles.chip, { borderColor: option.color }, selected && { backgroundColor: option.color }]}
                >
                  <Text style={[styles.chipText, { color: selected ? '#fff' : option.color }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {(filteredCategories.length > 0 || (!search && !uncategorizedSelected) || uncategorizedSelected) ? (
            <>
              <Text style={styles.sectionLabel}>Categories</Text>
              <View style={styles.chips}>
                {!search ? (
                  <Pressable
                    onPress={onToggleUncategorized}
                    style={[styles.chip, styles.uncategorizedChip, uncategorizedSelected && styles.uncategorizedChipSelected]}
                  >
                    <Text style={[styles.chipText, uncategorizedSelected ? styles.uncategorizedChipTextSelected : styles.uncategorizedChipText]}>
                      Uncategorized
                    </Text>
                  </Pressable>
                ) : null}
                {filteredCategories.map((category) => {
                  const selected = selectedCategoryIds.includes(category.id);
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => onToggleCategory(category.id)}
                      style={[styles.chip, { borderColor: category.color }, selected && { backgroundColor: category.color }]}
                    >
                      <Text style={[styles.chipText, { color: selected ? '#fff' : category.color }]}>
                        {category.icon ? `${category.icon} ` : ''}
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {filteredAccounts.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Accounts</Text>
              <View style={styles.chips}>
                {filteredAccounts.map((account) => {
                  const selected = selectedAccountIds.includes(account.id);
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => onToggleAccount(account.id)}
                      style={[styles.chip, styles.accountChip, { borderColor: account.color }, selected && { backgroundColor: account.color }]}
                    >
                      <AccountIcon icon={account.icon} size={13} />
                      <Text style={[styles.chipText, { color: selected ? '#fff' : account.color }]}>{account.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {search && filteredCategories.length === 0 && filteredAccounts.length === 0 ? (
            <Text style={styles.noMatches}>No categories or accounts match "{searchText.trim()}".</Text>
          ) : null}

          <Text style={styles.sectionLabel}>Date range</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DateField label="From" value={startDate} onChangeText={onChangeStartDate} />
            </View>
            <View style={styles.dateField}>
              <DateField label="To" value={endDate} onChangeText={onChangeEndDate} />
            </View>
          </View>

          <Text style={styles.sectionLabel}>Excluded transactions</Text>
          <View style={styles.chips}>
            {EXCLUDED_FILTER_OPTIONS.map((option) => {
              const selected = excludedFilter === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => onChangeExcludedFilter(option.value)}
                  style={[styles.chip, { borderColor: PALETTE.net }, selected && { backgroundColor: PALETTE.net }]}
                >
                  <Text style={[styles.chipText, { color: selected ? '#fff' : PALETTE.net }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={onClear} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear all filters</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: PALETTE.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary },
  doneLink: { fontSize: 15, fontWeight: '600', color: PALETTE.net },
  content: { padding: 20, gap: 12 },
  searchInput: {
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: PALETTE.textPrimary,
  },
  noMatches: { fontSize: 13, color: PALETTE.textSecondary, textAlign: 'center', marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: PALETTE.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  uncategorizedChip: { borderColor: PALETTE.textSecondary, borderStyle: 'dashed' },
  uncategorizedChipSelected: { backgroundColor: PALETTE.textSecondary, borderStyle: 'solid' },
  uncategorizedChipText: { color: PALETTE.textSecondary },
  uncategorizedChipTextSelected: { color: '#fff' },
  accountChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  clearButton: { alignSelf: 'center', marginTop: 16, paddingVertical: 8, paddingHorizontal: 16 },
  clearText: { fontSize: 14, fontWeight: '600', color: PALETTE.danger },
});
