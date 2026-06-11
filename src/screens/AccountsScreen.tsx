import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { AccountBadge } from '../components/AccountBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { AccountWithBalance } from '../db/queries/accounts';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';

interface AccountSection {
  title: string;
  total: number;
  data: AccountWithBalance[];
}

export default function AccountsScreen() {
  const navigation = useNavigation();
  const [showArchived, setShowArchived] = useState(false);
  const { accounts, error, setArchived } = useAccounts({ includeArchived: true });
  const { accountCategories } = useAccountCategories({ includeArchived: true });

  const visible = accounts.filter((account) => (showArchived ? account.isArchived : !account.isArchived));

  const sections = useMemo<AccountSection[]>(() => {
    return accountCategories
      .map((category) => {
        const data = visible.filter((account) => account.categoryId === category.id);
        return { title: category.name, total: data.reduce((sum, account) => sum + account.balance, 0), data };
      })
      .filter((section) => section.data.length > 0);
  }, [accountCategories, visible]);

  return (
    <View style={styles.screen}>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show archived</Text>
        <Switch value={showArchived} onValueChange={setShowArchived} trackColor={{ true: PALETTE.net }} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Couldn't load accounts: {error.message}</Text>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="🏦"
            title={showArchived ? 'No archived accounts' : 'No accounts yet'}
            message={showArchived ? undefined : 'Add an account to start tracking balances and assigning transactions.'}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={[styles.sectionTotal, { color: section.total < 0 ? PALETTE.expense : PALETTE.textPrimary }]}>
              {formatCurrency(section.total)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('AddEditAccount', { accountId: item.id })}>
            <View style={styles.rowMain}>
              <AccountBadge name={item.name} color={item.color} icon={item.icon} />
              <Text style={[styles.balance, { color: item.balance < 0 ? PALETTE.expense : PALETTE.textPrimary }]}>
                {formatCurrency(item.balance)}
              </Text>
            </View>
            <Pressable onPress={() => setArchived(item.id, !item.isArchived)} hitSlop={8} style={styles.archiveButton}>
              <Text style={styles.archiveButtonText}>{item.isArchived ? 'Restore' : 'Archive'}</Text>
            </Pressable>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditAccount')}>
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
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  errorBannerText: { color: PALETTE.expense, fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: PALETTE.textSecondary, textTransform: 'uppercase' },
  sectionTotal: { fontSize: 13, fontWeight: '700' },
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
    marginBottom: 10,
    gap: 12,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  balance: { fontSize: 14, fontWeight: '700' },
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
