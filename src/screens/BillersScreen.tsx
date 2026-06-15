import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { CategoryBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import { useCategories } from '../hooks/useCategories';

/** Billers are just the expense-facing categories used to tag recurring bills. */
export default function BillersScreen() {
  const navigation = useNavigation();
  const [showArchived, setShowArchived] = useState(false);
  const { categories, setArchived } = useCategories({ forType: 'expense', includeArchived: true });

  const visible = categories.filter((category) => (showArchived ? category.isArchived : !category.isArchived));

  return (
    <View style={styles.screen}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show archived</Text>
        <Switch value={showArchived} onValueChange={setShowArchived} trackColor={{ true: PALETTE.net }} />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={visible.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="🧾"
            title={showArchived ? 'No archived billers' : 'No billers yet'}
            message={showArchived ? undefined : 'Add a biller to quickly categorize your bills, like Netflix or Meralco.'}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('AddEditCategory', { categoryId: item.id, lockType: 'expense' })}
          >
            <View style={styles.rowMain}>
              <CategoryBadge name={item.name} color={item.color} icon={item.icon} />
            </View>
            <Pressable onPress={() => setArchived(item.id, !item.isArchived)} hitSlop={8} style={styles.archiveButton}>
              <Text style={styles.archiveButtonText}>{item.isArchived ? 'Restore' : 'Archive'}</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditCategory', { lockType: 'expense' })}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: PALETTE.textPrimary },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  archiveButton: { paddingVertical: 6, paddingHorizontal: 10 },
  archiveButtonText: { fontSize: 13, fontWeight: '600', color: PALETTE.net },
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
