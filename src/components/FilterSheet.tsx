import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PALETTE } from '../constants/colors';
import { useCategories } from '../hooks/useCategories';
import { DateField } from './DateField';

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedCategoryIds: number[];
  onToggleCategory: (id: number) => void;
  startDate: string;
  endDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
  onClear: () => void;
}

/** Category multi-select + date-range filter for the Transactions list. */
export function FilterSheet({
  visible,
  onClose,
  selectedCategoryIds,
  onToggleCategory,
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
  onClear,
}: Props) {
  const { categories } = useCategories({ includeArchived: true });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.doneLink}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>Categories</Text>
          <View style={styles.chips}>
            {categories.map((category) => {
              const selected = selectedCategoryIds.includes(category.id);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => onToggleCategory(category.id)}
                  style={[styles.chip, { borderColor: category.color }, selected && { backgroundColor: category.color }]}
                >
                  <Text style={[styles.chipText, { color: selected ? '#fff' : category.color }]}>
                    {category.icon ? `${category.icon} ` : ''}
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Date range</Text>
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DateField label="From" value={startDate} onChangeText={onChangeStartDate} />
            </View>
            <View style={styles.dateField}>
              <DateField label="To" value={endDate} onChangeText={onChangeEndDate} />
            </View>
          </View>

          <Pressable onPress={onClear} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear all filters</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: PALETTE.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary },
  doneLink: { fontSize: 15, fontWeight: '600', color: PALETTE.net },
  content: { padding: 20, gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: PALETTE.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 13, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  clearButton: { alignSelf: 'center', marginTop: 16, paddingVertical: 8, paddingHorizontal: 16 },
  clearText: { fontSize: 14, fontWeight: '600', color: PALETTE.danger },
});
