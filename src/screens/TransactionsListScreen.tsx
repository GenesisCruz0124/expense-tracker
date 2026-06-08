import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { FilterSheet } from '../components/FilterSheet';
import { TransactionListItem } from '../components/TransactionListItem';
import { PALETTE } from '../constants/colors';
import { useTransactions } from '../hooks/useTransactions';
import type { ListTransactionsFilter } from '../db/queries/transactions';

export default function TransactionsListScreen() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  const filter = useMemo<ListTransactionsFilter>(() => {
    const next: ListTransactionsFilter = {};
    if (searchText.trim()) next.searchText = searchText.trim();
    if (selectedCategoryIds.length > 0) next.categoryIds = selectedCategoryIds;
    if (startDate && endDate) {
      next.start = startDate;
      next.end = endDate;
    }
    return next;
  }, [searchText, selectedCategoryIds, startDate, endDate]);

  const { transactions, loading } = useTransactions(filter);
  const activeFilterCount = selectedCategoryIds.length + (startDate && endDate ? 1 : 0);

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  function clearFilters() {
    setSelectedCategoryIds([]);
    setStartDate('');
    setEndDate('');
  }

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search notes"
            placeholderTextColor={PALETTE.textSecondary}
          />
        </View>
        <Pressable style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]} onPress={() => setFilterVisible(true)}>
          <Text style={[styles.filterButtonText, activeFilterCount > 0 && styles.filterButtonTextActive]}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TransactionListItem
            transaction={item}
            onPress={() => navigation.navigate('AddEditTransaction', { transactionId: item.id })}
          />
        )}
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="📋"
              title="No transactions"
              message={
                activeFilterCount > 0 || searchText
                  ? 'Nothing matches your filters yet.'
                  : 'Add your first income or expense to get started.'
              }
            />
          ) : null
        }
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditTransaction')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={toggleCategory}
        startDate={startDate}
        endDate={endDate}
        onChangeStartDate={setStartDate}
        onChangeEndDate={setEndDate}
        onClear={clearFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: PALETTE.textPrimary, paddingVertical: 10 },
  filterButton: {
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: PALETTE.surface,
  },
  filterButtonActive: { borderColor: PALETTE.net, backgroundColor: `${PALETTE.net}1A` },
  filterButtonText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  filterButtonTextActive: { color: PALETTE.net },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PALETTE.net,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '600', lineHeight: 30 },
});
