import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ActionSheet } from '../components/ActionSheet';
import { EmptyState } from '../components/EmptyState';
import { DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { PALETTE } from '../constants/colors';
import type { AccountWithBalance } from '../db/queries/accounts';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';
import type { AccountsStackParamList, RootStackParamList } from '../navigation/types';

interface AccountSection {
  title: string;
  icon: string;
  color: string;
  total: number;
  data: AccountWithBalance[];
}

type AccountsScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<AccountsStackParamList, 'AccountsList'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** Returns the last 4 digits of an account number for a masked subtitle, or null if too short to mask. */
function lastFourDigits(accountNumber: string | null): string | null {
  const digits = (accountNumber ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export default function AccountsScreen() {
  const navigation = useNavigation<AccountsScreenNavigationProp>();
  const [showArchived, setShowArchived] = useState(false);
  const [menuAccount, setMenuAccount] = useState<AccountWithBalance | null>(null);
  const { accounts, error, setArchived } = useAccounts({ includeArchived: true });
  const { accountCategories } = useAccountCategories({ includeArchived: true });

  const visible = accounts.filter((account) => (showArchived ? account.isArchived : !account.isArchived));

  const netWorth = useMemo(() => {
    return visible.reduce((sum, account) => {
      const category = accountCategories.find((item) => item.id === account.categoryId);
      return sum + (category?.kind === 'credit_card' ? -account.balance : account.balance);
    }, 0);
  }, [visible, accountCategories]);

  const sections = useMemo<AccountSection[]>(() => {
    return accountCategories
      .map((category) => {
        const data = visible.filter((account) => account.categoryId === category.id);
        return {
          title: category.name,
          icon: category.icon ?? DEFAULT_ACCOUNT_ICON,
          color: category.color,
          total: data.reduce((sum, account) => sum + account.balance, 0),
          data,
        };
      })
      .filter((section) => section.data.length > 0);
  }, [accountCategories, visible]);

  return (
    <View style={styles.screen}>
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
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View>
                <Text style={styles.heroLabel}>{showArchived ? 'Archived balance' : 'Net worth'}</Text>
                <Text style={styles.heroAmount}>{formatCurrency(netWorth)}</Text>
              </View>
              <View style={styles.heroIconWrap}>
                <Text style={styles.heroIcon}>💰</Text>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Show archived</Text>
              <Switch value={showArchived} onValueChange={setShowArchived} trackColor={{ true: PALETTE.net }} />
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="🏦"
            title={showArchived ? 'No archived accounts' : 'No accounts yet'}
            message={showArchived ? undefined : 'Add an account to start tracking balances and assigning transactions.'}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIcon, { backgroundColor: `${section.color}1A` }]}>
                <Text style={styles.sectionIconText}>{section.icon}</Text>
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={[styles.sectionTotal, section.total < 0 && styles.negative]}>
              {formatCurrency(section.total)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const subtitle = lastFourDigits(item.accountNumber);
          return (
            <Pressable
              style={[styles.card, item.isArchived && styles.cardArchived]}
              onPress={() => navigation.navigate('AccountTransactions', { accountId: item.id })}
            >
              <View style={[styles.avatar, { backgroundColor: `${item.color}1A` }]}>
                <Text style={styles.avatarIcon}>{item.icon ?? DEFAULT_ACCOUNT_ICON}</Text>
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                {subtitle ? <Text style={styles.cardSubtitle}>•••• {subtitle}</Text> : null}
              </View>
              <Text style={[styles.cardBalance, item.balance < 0 && styles.negative]}>{formatCurrency(item.balance)}</Text>
              <Pressable onPress={() => setMenuAccount(item)} hitSlop={8} style={styles.moreButton}>
                <Text style={styles.moreButtonText}>⋯</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditAccount')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <ActionSheet
        visible={menuAccount != null}
        onClose={() => setMenuAccount(null)}
        title={menuAccount?.name ?? ''}
        options={
          menuAccount
            ? [
                { label: 'Edit', onPress: () => navigation.navigate('AddEditAccount', { accountId: menuAccount.id }) },
                {
                  label: menuAccount.isArchived ? 'Restore' : 'Archive',
                  onPress: () => setArchived(menuAccount.id, !menuAccount.isArchived),
                },
              ]
            : []
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  errorBannerText: { color: PALETTE.expense, fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PALETTE.net,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroAmount: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 4 },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIcon: { fontSize: 22 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 14,
  },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconText: { fontSize: 13 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionTotal: { fontSize: 13, fontWeight: '700', color: PALETTE.textPrimary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 12,
  },
  cardArchived: { opacity: 0.6 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 20 },
  cardMain: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary },
  cardSubtitle: { fontSize: 12, color: PALETTE.textSecondary, letterSpacing: 0.5 },
  cardBalance: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary },
  negative: { color: PALETTE.expense },
  moreButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.background,
  },
  moreButtonText: { fontSize: 18, fontWeight: '800', color: PALETTE.textSecondary, lineHeight: 18 },
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
