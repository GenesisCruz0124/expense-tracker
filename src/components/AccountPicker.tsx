import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';
import { useAccounts } from '../hooks/useAccounts';
import { AccountBadge } from './AccountBadge';
import { EmptyState } from './EmptyState';

interface Props {
  selectedAccountId: number | null;
  onSelect: (accountId: number | null) => void;
}

export function AccountPicker({ selectedAccountId, onSelect }: Props) {
  const { accounts, loading } = useAccounts();
  const [visible, setVisible] = useState(false);

  const selected = accounts.find((account) => account.id === selectedAccountId) ?? null;

  return (
    <View>
      <Pressable style={styles.trigger} onPress={() => setVisible(true)}>
        {selected ? (
          <AccountBadge name={selected.name} color={selected.color} icon={selected.icon} />
        ) : (
          <Text style={styles.placeholder}>Select an account</Text>
        )}
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose an account</Text>
            <Pressable onPress={() => setVisible(false)} hitSlop={8}>
              <Text style={styles.closeLink}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={accounts}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={accounts.length === 0 ? styles.emptyContainer : styles.listContainer}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="🏦"
                  title="No accounts yet"
                  message="Add accounts from the Accounts tab to start assigning transactions."
                />
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={[styles.optionRow, item.id === selectedAccountId && styles.optionRowSelected]}
                onPress={() => {
                  onSelect(item.id);
                  setVisible(false);
                }}
              >
                <AccountBadge name={item.name} color={item.color} icon={item.icon} />
                {item.id === selectedAccountId ? <Text style={styles.checkmark}>✓</Text> : null}
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
