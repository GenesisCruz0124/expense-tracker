import React, { useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { differenceInCalendarDays, parseISO } from 'date-fns';

import { CategoryBadge, UncategorizedBadge } from '../components/CategoryBadge';
import { EmptyState } from '../components/EmptyState';
import { PALETTE } from '../constants/colors';
import type { AccountWithBalance } from '../db/queries/accounts';
import type { BillWithDetails } from '../db/queries/bills';
import { useAccountCategories } from '../hooks/useAccountCategories';
import { useAccounts } from '../hooks/useAccounts';
import { useBills } from '../hooks/useBills';
import { formatCurrency } from '../utils/currency';
import { formatDisplayDate, formatIsoDate, monthKeyFor } from '../utils/dateRanges';
import { buildUpcomingItems, type UpcomingItem } from '../utils/upcoming';
import { frequencyLabelFor } from '../utils/bills';

interface MonthSection {
  title: string;
  monthKey: string;
  total: number;
  data: UpcomingItem[];
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(dueDate: string): string {
  const d = parseISO(dueDate);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function monthKey(dueDate: string): string {
  return dueDate.slice(0, 7);
}

export default function UnpaidBillsScreen() {
  const navigation = useNavigation();
  const { bills, payBill } = useBills();
  const { accounts, markMonthlyDuePaid } = useAccounts();
  const { accountCategories } = useAccountCategories();
  const [searchText, setSearchText] = useState('');

  const allUpcoming = useMemo<UpcomingItem[]>(
    () => buildUpcomingItems(bills, accounts, accountCategories),
    [bills, accounts, accountCategories],
  );

  const upcomingItems = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return q ? allUpcoming.filter((item) => item.name.toLowerCase().includes(q)) : allUpcoming;
  }, [allUpcoming, searchText]);

  const totalUpcoming = useMemo(() => upcomingItems.reduce((sum, item) => sum + item.amount, 0), [upcomingItems]);

  const overdueCount = useMemo(
    () => allUpcoming.filter((item) => differenceInCalendarDays(parseISO(item.dueDate), new Date()) < 0).length,
    [allUpcoming],
  );

  const monthSections = useMemo<MonthSection[]>(() => {
    const sections: MonthSection[] = [];
    const byMonth = new Map<string, MonthSection>();
    for (const item of upcomingItems) {
      const key = monthKey(item.dueDate);
      let section = byMonth.get(key);
      if (!section) {
        section = { title: monthLabel(item.dueDate), monthKey: key, total: 0, data: [] };
        byMonth.set(key, section);
        sections.push(section);
      }
      section.total += item.amount;
      section.data.push(item);
    }
    return sections;
  }, [upcomingItems]);

  function handleMarkDuePaid(account: AccountWithBalance) {
    Alert.alert(
      'Mark as paid?',
      `This logs a ${formatCurrency(account.monthlyAmountDue!)} payment for "${account.name}" and hides it until next month.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: () => markMonthlyDuePaid(account.id, monthKeyFor(new Date()), formatIsoDate(new Date())),
        },
      ],
    );
  }

  function handleMarkPaid(bill: BillWithDetails) {
    Alert.alert(
      'Mark as paid?',
      `This logs a ${formatCurrency(bill.amount)} expense dated today for "${bill.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark paid', onPress: () => payBill(bill.id, formatIsoDate(new Date())) },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search bills"
          placeholderTextColor={PALETTE.textSecondary}
          clearButtonMode="while-editing"
        />
      </View>
      <SectionList
        sections={monthSections}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        stickySectionHeadersEnabled
        contentContainerStyle={upcomingItems.length === 0 ? styles.emptyContainer : styles.listContent}
        ListHeaderComponent={
          upcomingItems.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total upcoming</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(totalUpcoming)}</Text>
              <Text style={styles.summaryCount}>
                {upcomingItems.length} {upcomingItems.length === 1 ? 'item' : 'items'}
                {overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="🧾"
            title="No bills yet"
            message="Add an upcoming bill to track it here and get reminded before it's due."
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader}>
            <Text style={styles.monthTitle}>{section.title}</Text>
            <View style={styles.monthSummary}>
              <Text style={styles.monthCount}>{section.data.length} {section.data.length === 1 ? 'bill' : 'bills'}</Text>
              <Text style={styles.monthTotal}>{formatCurrency(section.total)}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const daysUntilDue = differenceInCalendarDays(parseISO(item.dueDate), new Date());
          const isOverdue = daysUntilDue < 0;
          const dueLabel = isOverdue ? `Overdue · due ${formatDisplayDate(item.dueDate)}` : `Due ${formatDisplayDate(item.dueDate)}`;

          if (item.kind === 'due') {
            const account = item.account;
            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate('AddEditAccount', { accountId: account.id })}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.cardTitle}>{account.name}</Text>
                  <Text style={[styles.cardSubtitle, isOverdue && styles.cardSubtitleOverdue]}>{dueLabel}</Text>
                  <Text style={styles.cardFrequency}>Monthly due</Text>
                </View>
                <View style={styles.cardTrailing}>
                  <Text style={styles.cardAmount}>{formatCurrency(item.amount)}</Text>
                  <Pressable style={styles.payButton} onPress={() => handleMarkDuePaid(account)}>
                    <Text style={styles.payButtonText}>Mark paid</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }

          const bill = item.bill;
          const frequencyLabel = frequencyLabelFor(bill);
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate('AddEditBill', { billId: bill.id })}>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{bill.name}</Text>
                {bill.categoryName ? (
                  <CategoryBadge name={bill.categoryName} color={bill.categoryColor ?? PALETTE.textSecondary} icon={bill.categoryIcon} />
                ) : (
                  <UncategorizedBadge />
                )}
                <Text style={[styles.cardSubtitle, isOverdue && styles.cardSubtitleOverdue]}>{dueLabel}</Text>
                {frequencyLabel ? <Text style={styles.cardFrequency}>{frequencyLabel}</Text> : null}
              </View>
              <View style={styles.cardTrailing}>
                <Text style={styles.cardAmount}>{formatCurrency(bill.amount)}</Text>
                <Pressable style={styles.payButton} onPress={() => handleMarkPaid(bill)}>
                  <Text style={styles.payButtonText}>Mark paid</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddEditBill')}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.background },
  listContent: { padding: 16, gap: 10 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  summaryCard: {
    backgroundColor: PALETTE.expense,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 4,
    alignItems: 'center',
    gap: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: PALETTE.textPrimary, paddingVertical: 10 },
  summaryLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryAmount: { fontSize: 28, fontWeight: '700', color: '#fff' },
  summaryCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    backgroundColor: PALETTE.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  monthTitle: { fontSize: 13, fontWeight: '700', color: PALETTE.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  monthSummary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthCount: { fontSize: 12, color: PALETTE.textSecondary },
  monthTotal: { fontSize: 14, fontWeight: '700', color: PALETTE.expense },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardMain: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  cardSubtitle: { fontSize: 12, color: PALETTE.textSecondary },
  cardSubtitleOverdue: { color: PALETTE.danger, fontWeight: '700' },
  cardFrequency: { fontSize: 11, fontWeight: '600', color: PALETTE.net },
  cardTrailing: { alignItems: 'flex-end', gap: 8 },
  cardAmount: { fontSize: 14, fontWeight: '700', color: PALETTE.textPrimary },
  payButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: `${PALETTE.net}1A`,
  },
  payButtonText: { fontSize: 12, fontWeight: '700', color: PALETTE.net },
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
