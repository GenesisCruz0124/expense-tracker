import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PALETTE } from '../constants/colors';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';
import { AccountBadge } from './AccountBadge';
import { EmptyState } from './EmptyState';

interface Props {
  selectedAccountId: number | null;
  onSelect: (accountId: number | null) => void;
}

export function AccountPicker({ selectedAccountId, onSelect }: Props) {
  const { accounts, loading } = useAccounts({ sortBy: 'recent' });
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selected = accounts.find((account) => account.id === selectedAccountId) ?? null;

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return accounts;
    return accounts.filter((account) => account.name.toLowerCase().includes(trimmed));
  }, [accounts, query]);

  function open() {
    setQuery('');
    setVisible(true);
  }

  function close() {
    setVisible(false);
    setQuery('');
  }

  return (
    <View>
      <Pressable style={styles.trigger} onPress={open}>
        {selected ? (
          <View style={styles.triggerSelected}>
            <AccountBadge name={selected.name} color={selected.color} icon={selected.icon} />
            <Text style={styles.balanceText}>{formatCurrency(selected.balance)}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>Select an account</Text>
        )}
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose an account</Text>
            <Pressable onPress={close} hitSlop={8}>
              <Text style={styles.closeLink}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Type to search accounts"
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
                  icon="🏦"
                  title={query ? 'No matching accounts' : 'No accounts yet'}
                  message={
                    query
                      ? `Nothing matches "${query}". Try a different search.`
                      : 'Add accounts from the Accounts tab to start assigning transactions.'
                  }
                />
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.optionRow, item.id === selectedAccountId && styles.optionRowSelected]}
                onPress={() => {
                  onSelect(item.id);
                  close();
                }}
              >
                <AccountBadge name={item.name} color={item.color} icon={item.icon} />
                <View style={styles.optionRowRight}>
                  <Text style={styles.balanceText}>{formatCurrency(item.balance)}</Text>
                  {item.id === selectedAccountId ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
              </Pressable>
            )}
          />
        </SafeAreaView>
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
  triggerSelected: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  placeholder: { fontSize: 14, color: PALETTE.textSecondary },
  balanceText: { fontSize: 14, fontWeight: '600', color: PALETTE.textSecondary },
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
  optionRowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkmark: { fontSize: 16, fontWeight: '700', color: PALETTE.net },
});
