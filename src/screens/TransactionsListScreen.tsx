import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { FilterSheet, type ExcludedFilter, type TypeFilter } from '../components/FilterSheet';
import { TransactionListItem } from '../components/TransactionListItem';
import { PALETTE } from '../constants/colors';
import { useTransactions } from '../hooks/useTransactions';
import type { ListTransactionsFilter, TransactionWithCategory } from '../db/queries/transactions';
import type { TransactionsStackParamList } from '../navigation/types';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate } from '../utils/dateRanges';

interface TransactionRow {
  transaction: TransactionWithCategory;
  runningBalance: number | undefined;
}

interface DaySection {
  title: string;
  subtotal: number;
  data: TransactionRow[];
}

export default function TransactionsListScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<TransactionsStackParamList, 'TransactionsList'>>();
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(route.params?.type);
  const [runningBalanceMode, setRunningBalanceMode] = useState(route.params?.runningBalance ?? false);
  const [uncategorizedSelected, setUncategorizedSelected] = useState(false);
  const [excludedFilter, setExcludedFilter] = useState<ExcludedFilter>('hide');
  const [transferCountAsExpense, setTransferCountAsExpense] = useState(false);
  const [groupByDay, setGroupByDay] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);

  useEffect(() => {
    setTypeFilter(route.params?.type);
    setRunningBalanceMode(route.params?.runningBalance ?? false);
    setStartDate(route.params?.start ?? '');
    setEndDate(route.params?.end ?? '');
    setSelectedCategoryIds([]);
    setSelectedAccountIds([]);
    setUncategorizedSelected(false);
    setSearchText('');
    setExcludedFilter('hide');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.type, route.params?.start, route.params?.end, route.params?.runningBalance]);

  const filter = useMemo<ListTransactionsFilter>(() => {
    const next: ListTransactionsFilter = {};
    if (searchText.trim()) next.searchText = searchText.trim();
    if (uncategorizedSelected) next.uncategorized = true;
    else if (selectedCategoryIds.length > 0) next.categoryIds = selectedCategoryIds;
    if (selectedAccountIds.length > 0) next.accountIds = selectedAccountIds;
    if (startDate && endDate) {
      next.start = startDate;
      next.end = endDate;
    }
    if (typeFilter === 'transfer') {
      next.transferOnly = true;
      if (transferCountAsExpense) next.excludeFromExpense = false;
    } else {
      if (typeFilter) next.type = typeFilter;
      if (excludedFilter === 'only') next.excludeFromExpense = true;
      else if (excludedFilter !== 'all') next.excludeFromExpense = false;
    }
    return next;
  }, [searchText, uncategorizedSelected, selectedCategoryIds, selectedAccountIds, startDate, endDate, typeFilter, runningBalanceMode, excludedFilter, transferCountAsExpense]);

  const { transactions, loading } = useTransactions(filter);
  const transactionsWithBalance = useMemo(() => {
    if (!runningBalanceMode) {
      return transactions.map((transaction) => ({ transaction, runningBalance: undefined as number | undefined }));
    }
    let cursor = transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
    return transactions.map((transaction) => {
      const runningBalance = cursor;
      cursor -= transaction.type === 'income' ? transaction.amount : -transaction.amount;
      return { transaction, runningBalance };
    });
  }, [transactions, runningBalanceMode]);
  const daySections = useMemo<DaySection[]>(() => {
    const sections: DaySection[] = [];
    const sectionByDay = new Map<string, DaySection>();
    for (const item of transactionsWithBalance) {
      const dayKey = item.transaction.occurredAt.slice(0, 10);
      let section = sectionByDay.get(dayKey);
      if (!section) {
        section = { title: dayKey, subtotal: 0, data: [] };
        sectionByDay.set(dayKey, section);
        sections.push(section);
      }
      if (!item.transaction.excludeFromExpense) {
        section.subtotal += item.transaction.type === 'income' ? item.transaction.amount : -item.transaction.amount;
      }
      section.data.push(item);
    }
    return sections;
  }, [transactionsWithBalance]);

  const activeFilterCount =
    (uncategorizedSelected ? 1 : 0) +
    selectedCategoryIds.length +
    selectedAccountIds.length +
    (startDate && endDate ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (runningBalanceMode ? 1 : 0) +
    (excludedFilter === 'only' ? 1 : 0) +
    (typeFilter === 'transfer' && transferCountAsExpense ? 1 : 0);

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  function toggleAccount(id: number) {
    setSelectedAccountIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  function clearFilters() {
    setUncategorizedSelected(false);
    setSelectedCategoryIds([]);
    setSelectedAccountIds([]);
    setStartDate('');
    setEndDate('');
    setTypeFilter(undefined);
    setRunningBalanceMode(false);
    setExcludedFilter('hide');
    setTransferCountAsExpense(false);
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
            placeholder="Search notes & establishments"
            placeholderTextColor={PALETTE.textSecondary}
          />
        </View>
        <Pressable
          style={[styles.filterButton, groupByDay && styles.filterButtonActive]}
          onPress={() => setGroupByDay((current) => !current)}
        >
          <Text style={[styles.filterButtonText, groupByDay && styles.filterButtonTextActive]}>Group by day</Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, runningBalanceMode && styles.filterButtonActive]}
          onPress={() =>
            setRunningBalanceMode((current) => {
              // A running balance only reads correctly over income and expenses together, so
              // drop a type filter when switching it on.
              if (!current) setTypeFilter(undefined);
              return !current;
            })
          }
        >
          <Text style={[styles.filterButtonText, runningBalanceMode && styles.filterButtonTextActive]}>Balance</Text>
        </Pressable>
        <Pressable style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]} onPress={() => setFilterVisible(true)}>
          <Text style={[styles.filterButtonText, activeFilterCount > 0 && styles.filterButtonTextActive]}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {typeFilter || runningBalanceMode ? (
        <View style={styles.typeFilterRow}>
          <View style={styles.typeFilterChip}>
            <Text style={styles.typeFilterChipText}>
              Showing: {runningBalanceMode ? 'Net (running balance)' : typeFilter === 'income' ? 'Income' : typeFilter === 'transfer' ? 'Transfer' : 'Expense'}
            </Text>
            <Pressable onPress={() => (runningBalanceMode ? setRunningBalanceMode(false) : setTypeFilter(undefined))}>
              <Text style={styles.typeFilterChipClose}>✕</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {groupByDay ? (
        <SectionList
          sections={daySections}
          keyExtractor={(item) => String(item.transaction.id)}
          renderItem={({ item }) => (
            <TransactionListItem
              transaction={item.transaction}
              runningBalance={item.runningBalance}
              onPress={() => navigation.navigate('AddEditTransaction', { transactionId: item.transaction.id })}
            />
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderDate}>{formatDisplayDate(section.title)}</Text>
              <Text style={[styles.dayHeaderSubtotal, { color: section.subtotal >= 0 ? PALETTE.income : PALETTE.expense }]}>
                {section.subtotal >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(section.subtotal))}
              </Text>
            </View>
          )}
          contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
          stickySectionHeadersEnabled
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
      ) : (
        <FlatList
          data={transactionsWithBalance}
          keyExtractor={(item) => String(item.transaction.id)}
          renderItem={({ item }) => (
            <TransactionListItem
              transaction={item.transaction}
              runningBalance={item.runningBalance}
              onPress={() => navigation.navigate('AddEditTransaction', { transactionId: item.transaction.id })}
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
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditTransaction')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <FilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={toggleCategory}
        uncategorizedSelected={uncategorizedSelected}
        onToggleUncategorized={() => setUncategorizedSelected((v) => !v)}
        selectedAccountIds={selectedAccountIds}
        onToggleAccount={toggleAccount}
        startDate={startDate}
        endDate={endDate}
        onChangeStartDate={setStartDate}
        onChangeEndDate={setEndDate}
        typeFilter={typeFilter}
        onChangeTypeFilter={setTypeFilter}
        transferCountAsExpense={transferCountAsExpense}
        onChangeTransferCountAsExpense={setTransferCountAsExpense}
        excludedFilter={excludedFilter}
        onChangeExcludedFilter={setExcludedFilter}
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
  typeFilterRow: { paddingHorizontal: 16, paddingBottom: 12 },
  typeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: PALETTE.net,
    backgroundColor: `${PALETTE.net}1A`,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  typeFilterChipText: { fontSize: 12, fontWeight: '600', color: PALETTE.net },
  typeFilterChipClose: { fontSize: 12, fontWeight: '700', color: PALETTE.net },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: PALETTE.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  dayHeaderDate: { fontSize: 12, fontWeight: '700', color: PALETTE.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  dayHeaderSubtotal: { fontSize: 13, fontWeight: '700' },
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
