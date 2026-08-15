import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AccountBadge } from '../components/AccountBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import { useAccountCategories } from '../hooks/useAccountCategories';

export default function AccountCategoriesScreen() {
  const navigation = useNavigation();
  const [showArchived, setShowArchived] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { accountCategories, setArchived } = useAccountCategories({ includeArchived: true });

  const query = searchText.trim().toLowerCase();
  const visible = accountCategories
    .filter((category) => (showArchived ? category.isArchived : !category.isArchived))
    .filter((category) => !query || category.name.toLowerCase().includes(query));

  return (
    <View style={styles.screen}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show archived</Text>
        <Switch value={showArchived} onValueChange={setShowArchived} trackColor={{ true: PALETTE.net }} />
      </View>

      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search account types"
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
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={visible.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="🏦"
            title={
              query ? 'No matching account types' : showArchived ? 'No archived account categories' : 'No account categories yet'
            }
            message={
              query
                ? `Nothing matches "${searchText.trim()}". Try a different search.`
                : showArchived
                  ? undefined
                  : 'Add a category to start organizing your accounts.'
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('AddEditAccountCategory', { accountCategoryId: item.id })}
          >
            <View style={styles.rowMain}>
              <AccountBadge name={item.name} color={item.color} icon={item.icon} />
            </View>
            <Pressable onPress={() => setArchived(item.id, !item.isArchived)} hitSlop={8} style={styles.archiveButton}>
              <Text style={styles.archiveButtonText}>{item.isArchived ? 'Restore' : 'Archive'}</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditAccountCategory')}>
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
