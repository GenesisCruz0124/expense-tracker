import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AccountIcon } from '../components/AccountIcon';
import { ActionSheet } from '../components/ActionSheet';
import { EmptyState } from '../components/EmptyState';
import { DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';
import { PALETTE } from '../constants/colors';
import { useDatabase } from '../context/DatabaseProvider';
import type { AccountWithBalance } from '../db/queries/accounts';
import { getSetting, setSetting } from '../db/queries/settings';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { formatCurrency } from '../utils/currency';
import type { AccountsStackParamList, RootStackParamList } from '../navigation/types';

const COLLAPSED_GROUPS_KEY = 'accountsCollapsedGroups';
const SELECTED_CATEGORY_IDS_KEY = 'accountsSelectedCategoryIds';

function accountOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
const NET_WORTH_FILTER_KEY = 'accountsNetWorthFilter';

type NetWorthFilter = 'all' | 'included' | 'excluded';


interface AccountSection {
  key: string;
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

const AMOUNT_MASK = '••••••';

type SortOption = 'name_asc' | 'name_desc' | 'balance_desc' | 'balance_asc' | 'recent';

const SORT_LABELS: Record<SortOption, string> = {
  name_asc: 'Name (A–Z)',
  name_desc: 'Name (Z–A)',
  balance_desc: 'Balance (high to low)',
  balance_asc: 'Balance (low to high)',
  recent: 'Recent',
};

function sortAccounts(accounts: AccountWithBalance[], sort: SortOption): AccountWithBalance[] {
  const sorted = [...accounts];
  switch (sort) {
    case 'name_asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'name_desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case 'balance_desc':
      return sorted.sort((a, b) => b.balance - a.balance);
    case 'balance_asc':
      return sorted.sort((a, b) => a.balance - b.balance);
    case 'recent':
      return sorted.sort((a, b) => {
        if (!a.lastTransactionAt && !b.lastTransactionAt) return 0;
        if (!a.lastTransactionAt) return 1;
        if (!b.lastTransactionAt) return -1;
        return b.lastTransactionAt.localeCompare(a.lastTransactionAt);
      });
  }
}

/** Returns the last 4 digits of an account number for a masked subtitle, or null if too short to mask. */
function lastFourDigits(accountNumber: string | null): string | null {
  const digits = (accountNumber ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export default function AccountsScreen() {
  const navigation = useNavigation<AccountsScreenNavigationProp>();
  const [showArchived, setShowArchived] = useState(false);
  const [hideAmounts, setHideAmounts] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [netWorthFilter, setNetWorthFilter] = useState<NetWorthFilter>('all');
  const [netWorthFilterLoaded, setNetWorthFilterLoaded] = useState(false);
  const [menuAccount, setMenuAccount] = useState<AccountWithBalance | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('balance_desc');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [categoryFilterLoaded, setCategoryFilterLoaded] = useState(false);
  const { db } = useDatabase();

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  useEffect(() => {
    (async () => {
      const stored = await getSetting(db, COLLAPSED_GROUPS_KEY);
      if (stored) {
        try {
          setCollapsedGroups(new Set(JSON.parse(stored)));
        } catch {
          // ignore malformed stored value
        }
      }
      setGroupsLoaded(true);
    })();
  }, [db]);

  useEffect(() => {
    if (!groupsLoaded) return;
    setSetting(db, COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(collapsedGroups)));
  }, [collapsedGroups, groupsLoaded, db]);

  useEffect(() => {
    (async () => {
      const stored = await getSetting(db, SELECTED_CATEGORY_IDS_KEY);
      if (stored) {
        try {
          setSelectedCategoryIds(JSON.parse(stored));
        } catch {
          // ignore malformed stored value
        }
      }
      setCategoryFilterLoaded(true);
    })();
  }, [db]);

  useEffect(() => {
    if (!categoryFilterLoaded) return;
    setSetting(db, SELECTED_CATEGORY_IDS_KEY, JSON.stringify(selectedCategoryIds));
  }, [selectedCategoryIds, categoryFilterLoaded, db]);

  useEffect(() => {
    (async () => {
      const stored = await getSetting(db, NET_WORTH_FILTER_KEY);
      if (stored === 'included' || stored === 'excluded') {
        setNetWorthFilter(stored);
      }
      setNetWorthFilterLoaded(true);
    })();
  }, [db]);

  useEffect(() => {
    if (!netWorthFilterLoaded) return;
    setSetting(db, NET_WORTH_FILTER_KEY, netWorthFilter);
  }, [netWorthFilter, netWorthFilterLoaded, db]);

  const { accounts, error, setArchived } = useAccounts({ includeArchived: true });
  const { accountCategories } = useAccountCategories({ includeArchived: true });

  const visible = accounts.filter((account) => (showArchived ? account.isArchived : !account.isArchived));

  const filterableCategories = useMemo(
    () => accountCategories.filter((category) => visible.some((account) => account.categoryId === category.id)),
    [accountCategories, visible],
  );

  const filtered = visible
    .filter((account) => selectedCategoryIds.length === 0 || (account.categoryId != null && selectedCategoryIds.includes(account.categoryId)))
    .filter((account) => {
      if (netWorthFilter === 'included') return account.includeInNetWorth;
      if (netWorthFilter === 'excluded') return !account.includeInNetWorth;
      return true;
    })
    .filter((account) => !searchQuery.trim() || account.name.toLowerCase().includes(searchQuery.toLowerCase()));

  function toggleCategoryFilter(id: number) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  const netWorth = useMemo(() => {
    return visible.reduce((sum, account) => {
      if (!account.includeInNetWorth) return sum;
      const category = accountCategories.find((item) => item.id === account.categoryId);
      return sum + (category?.kind === 'credit_card' ? -account.balance : account.balance);
    }, 0);
  }, [visible, accountCategories]);

  const linkedLoanTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const acc of visible) {
      if (acc.linkedCreditCardId != null) {
        totals[acc.linkedCreditCardId] = (totals[acc.linkedCreditCardId] ?? 0) + acc.balance;
      }
    }
    return totals;
  }, [visible]);

  const sections = useMemo<AccountSection[]>(() => {
    if (!grouped) {
      const data = sortAccounts(filtered, sortOption);
      if (data.length === 0) return [];
      return [
        {
          key: 'all',
          title: 'All accounts',
          icon: '🏦',
          color: PALETTE.net,
          total: data.reduce((sum, account) => sum + account.balance, 0),
          data,
        },
      ];
    }
    return accountCategories
      .map((category) => {
        const data = sortAccounts(filtered.filter((account) => account.categoryId === category.id), sortOption);
        return {
          key: String(category.id),
          title: category.name,
          icon: category.icon ?? DEFAULT_ACCOUNT_ICON,
          color: category.color,
          total: data.reduce((sum, account) => sum + account.balance, 0),
          data,
        };
      })
      .filter((section) => section.data.length > 0);
  }, [accountCategories, filtered, sortOption, grouped]);

  const sectionListData = useMemo(
    () => sections.map((s) => (collapsedGroups.has(s.key) ? { ...s, data: [] } : s)),
    [sections, collapsedGroups],
  );

  return (
    <View style={styles.screen}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Couldn't load accounts: {error.message}</Text>
        </View>
      ) : null}

      <SectionList
        sections={sectionListData}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.listContent}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View>
                <View style={styles.heroLabelRow}>
                  <Text style={styles.heroLabel}>{showArchived ? 'Archived balance' : 'Net worth'}</Text>
                  <Pressable onPress={() => setHideAmounts((value) => !value)} hitSlop={8}>
                    <Text style={styles.eyeIcon}>{hideAmounts ? '🙈' : '👁️'}</Text>
                  </Pressable>
                </View>
                <Text style={styles.heroAmount}>{hideAmounts ? AMOUNT_MASK : formatCurrency(netWorth)}</Text>
              </View>
              <View style={styles.heroIconWrap}>
                <Text style={styles.heroIcon}>💰</Text>
              </View>
            </View>

            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search accounts…"
                placeholderTextColor={PALETTE.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Text style={styles.searchClear}>✕</Text>
                </Pressable>
              ) : null}
            </View>

            {filterableCategories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <Pressable
                  onPress={() => setSelectedCategoryIds([])}
                  style={[styles.filterChip, selectedCategoryIds.length === 0 && styles.filterChipAllSelected]}
                >
                  <Text style={[styles.filterChipText, selectedCategoryIds.length === 0 && styles.filterChipTextSelected]}>
                    All
                  </Text>
                </Pressable>
                {filterableCategories.map((category) => {
                  const selected = selectedCategoryIds.includes(category.id);
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => toggleCategoryFilter(category.id)}
                      style={[
                        styles.filterChip,
                        { borderColor: category.color },
                        selected && { backgroundColor: category.color },
                      ]}
                    >
                      <View style={styles.filterChipContent}>
                        <AccountIcon icon={category.icon} size={13} />
                        <Text style={[styles.filterChipText, { color: selected ? '#fff' : category.color }]}>
                          {category.name}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'included', label: 'In net worth' },
                  { key: 'excluded', label: 'Excluded' },
                ] as { key: NetWorthFilter; label: string }[]
              ).map(({ key, label }) => {
                const selected = netWorthFilter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setNetWorthFilter(key)}
                    style={[styles.filterChip, selected && styles.filterChipAllSelected]}
                  >
                    <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.controlsRow}>
              <Pressable style={styles.sortButton} onPress={() => setGrouped((value) => !value)}>
                <Text style={styles.sortButtonText}>{grouped ? '▦ Grouped' : '☰ Ungrouped'}</Text>
              </Pressable>
              <Pressable style={styles.sortButton} onPress={() => setShowSortPicker(true)}>
                <Text style={styles.sortButtonText}>⇅ Sort: {SORT_LABELS[sortOption]}</Text>
              </Pressable>
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
        renderSectionHeader={({ section }) => {
          const collapsed = collapsedGroups.has(section.key);
          return (
            <Pressable style={styles.sectionHeader} onPress={() => toggleGroup(section.key)}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionChevron}>{collapsed ? '▸' : '▾'}</Text>
                <View style={[styles.sectionIcon, { backgroundColor: `${section.color}1A` }]}>
                  <AccountIcon icon={section.icon} size={16} textStyle={styles.sectionIconText} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={[styles.sectionTotal, section.total < 0 && styles.negative]}>
                {hideAmounts ? AMOUNT_MASK : formatCurrency(section.total)}
              </Text>
            </Pressable>
          );
        }}
        renderItem={({ item }) => {
          const subtitle = lastFourDigits(item.accountNumber);
          const categoryKind = accountCategories.find((c) => c.id === item.categoryId)?.kind;
          const isInvestment = categoryKind === 'investment';
          const isLoan = categoryKind === 'credit_card';
          return (
            <Pressable
              style={[styles.card, item.isArchived && styles.cardArchived]}
              onPress={() => navigation.navigate('AccountTransactions', { accountId: item.id })}
            >
              <View style={[styles.avatar, { backgroundColor: `${item.color}1A` }]}>
                <AccountIcon icon={item.icon} size={20} textStyle={styles.avatarIcon} />
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                {subtitle ? <Text style={styles.cardSubtitle}>•••• {subtitle}</Text> : null}
                {isInvestment && item.totalMonths > 0 ? (
                  <Text style={styles.cardMeta}>{item.totalMonths} {item.totalMonths === 1 ? 'month' : 'months'} contributed</Text>
                ) : null}
                {isLoan && item.remainingMonths != null && item.remainingMonths > 0 ? (
                  <Text style={styles.cardMeta}>{item.remainingMonths} {item.remainingMonths === 1 ? 'month' : 'months'} remaining</Text>
                ) : null}
                {isLoan && item.creditLimit != null ? (
                  <Text style={styles.cardMetaLimit}>
                    {hideAmounts ? '••••••' : (() => {
                      const used = item.balance + (linkedLoanTotals[item.id] ?? 0);
                      const avail = Math.max(0, item.creditLimit - used);
                      return `${formatCurrency(item.creditLimit)} limit · ${formatCurrency(avail)} avail.`;
                    })()}
                  </Text>
                ) : null}
                {item.subscriptionDueDay != null ? (
                  <Text style={styles.cardMeta}>Due: {accountOrdinal(item.subscriptionDueDay)} of month</Text>
                ) : null}
              </View>
              <Text style={[styles.cardBalance, item.balance < 0 && styles.negative]}>
                {hideAmounts ? AMOUNT_MASK : formatCurrency(item.balance)}
              </Text>
              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => navigation.navigate('AddEditTransaction', { accountId: item.id })}
                  hitSlop={8}
                  style={styles.transactButton}
                >
                  <Text style={styles.transactButtonText}>+</Text>
                </Pressable>
                <Pressable onPress={() => setMenuAccount(item)} hitSlop={8} style={styles.moreButton}>
                  <Text style={styles.moreButtonText}>⋯</Text>
                </Pressable>
              </View>
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

      <ActionSheet
        visible={showSortPicker}
        onClose={() => setShowSortPicker(false)}
        title="Sort accounts by"
        options={(Object.keys(SORT_LABELS) as SortOption[]).map((option) => ({
          label: SORT_LABELS[option],
          onPress: () => { setSortOption(option); setShowSortPicker(false); },
        }))}
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
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  eyeIcon: { fontSize: 13 },
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: PALETTE.textPrimary, padding: 0 },
  searchClear: { fontSize: 13, color: PALETTE.textSecondary, fontWeight: '600' },
  filterRow: { gap: 8, paddingBottom: 12 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PALETTE.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: PALETTE.surface,
  },
  filterChipAllSelected: { borderColor: PALETTE.net, backgroundColor: PALETTE.net },
  filterChipContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterChipText: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  filterChipTextSelected: { color: '#fff' },
  controlsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingBottom: 10 },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: PALETTE.surface,
    borderWidth: 1.5,
    borderColor: PALETTE.border,
  },
  sortButtonText: { fontSize: 12, fontWeight: '600', color: PALETTE.textSecondary },
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
  sectionChevron: { fontSize: 12, color: PALETTE.textSecondary, width: 14 },
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
  cardMeta: { fontSize: 11, fontWeight: '600', color: PALETTE.net, marginTop: 1 },
  cardMetaLimit: { fontSize: 11, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 1 },
  cardBalance: { fontSize: 15, fontWeight: '700', color: PALETTE.textPrimary },
  negative: { color: PALETTE.expense },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  transactButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${PALETTE.net}1A`,
  },
  transactButtonText: { fontSize: 18, fontWeight: '700', color: PALETTE.net, lineHeight: 20 },
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
