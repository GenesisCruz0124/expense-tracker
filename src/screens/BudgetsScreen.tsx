import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { EmptyState } from '../components/EmptyState';
import { MonthSelector } from '../components/MonthSelector';
import { PALETTE } from '../constants/colors';
import { useBudgets } from '../hooks/useBudgets';
import { formatCurrency } from '../utils/currency';
import { monthRangeFor, shiftMonth } from '../utils/dateRanges';

export default function BudgetsScreen() {
  const navigation = useNavigation();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const range = monthRangeFor(anchorDate);
  const { budgets, copyFromMonth } = useBudgets(range);
  const [searchText, setSearchText] = useState('');

  const query = searchText.trim().toLowerCase();
  const visibleBudgets = query
    ? budgets.filter((budget) => budget.categoryName.toLowerCase().includes(query))
    : budgets;

  async function handleCopyFromLastMonth() {
    const fromRange = monthRangeFor(shiftMonth(anchorDate, -1));
    const copied = await copyFromMonth(fromRange.monthKey);
    Alert.alert(
      copied > 0 ? 'Budgets copied' : 'Nothing to copy',
      copied > 0
        ? `Copied ${copied} budget${copied === 1 ? '' : 's'} from ${fromRange.label}.`
        : `No new budgets to copy from ${fromRange.label}.`,
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <MonthSelector
          label={range.label}
          onPrevious={() => setAnchorDate((current) => shiftMonth(current, -1))}
          onNext={() => setAnchorDate((current) => shiftMonth(current, 1))}
        />
        <Pressable style={styles.copyButton} onPress={handleCopyFromLastMonth}>
          <Text style={styles.copyButtonText}>Copy budgets from last month</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search budgets"
          placeholderTextColor={PALETTE.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchText.length > 0 ? (
          <Pressable onPress={() => setSearchText('')} hitSlop={8}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={visibleBudgets}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={visibleBudgets.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="🎯"
            title={query ? 'No matching budgets' : 'No budgets set'}
            message={
              query
                ? `Nothing matches "${searchText.trim()}". Try a different search.`
                : 'Set a monthly limit for a category to get notified as you approach it.'
            }
          />
        }
        renderItem={({ item }) => {
          const barColor =
            item.percentUsed >= 100 ? PALETTE.danger : item.percentUsed >= item.alertThresholdPct ? PALETTE.warning : PALETTE.net;
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('AddEditBudget', { budgetId: item.id, monthKey: range.monthKey })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {item.categoryIcon ?? '🧾'} {item.categoryName}
                </Text>
                <Text style={styles.cardAmounts}>
                  {formatCurrency(item.spend)} / {formatCurrency(item.amountLimit)}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(item.percentUsed, 100)}%`, backgroundColor: barColor }]} />
              </View>
              <Text style={[styles.percentLabel, { color: barColor }]}>{item.percentUsed}% used</Text>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditBudget', { monthKey: range.monthKey })}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  header: {
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  copyButton: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: PALETTE.textPrimary, paddingVertical: 10 },
  searchClear: { fontSize: 13, color: PALETTE.textSecondary, fontWeight: '600' },
  copyButtonText: { fontSize: 13, fontWeight: '600', color: PALETTE.net },
  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  cardAmounts: { fontSize: 13, color: PALETTE.textSecondary },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: PALETTE.background, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  percentLabel: { fontSize: 12, fontWeight: '600' },
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
