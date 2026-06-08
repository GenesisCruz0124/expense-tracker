import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_CATEGORY_ICON } from '../constants/categoryIcons';
import { PALETTE } from '../constants/colors';

interface Props {
  name: string;
  color: string;
  icon?: string | null;
}

export function CategoryBadge({ name, color, icon }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: `${color}40` }]}>
      <Text style={styles.icon}>{icon ?? DEFAULT_CATEGORY_ICON}</Text>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

export function UncategorizedBadge() {
  return (
    <View style={[styles.badge, { backgroundColor: `${PALETTE.textSecondary}1A`, borderColor: `${PALETTE.textSecondary}40` }]}>
      <Text style={styles.icon}>❔</Text>
      <Text style={[styles.label, { color: PALETTE.textSecondary }]}>Uncategorized</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { fontSize: 12 },
  label: { fontSize: 12, fontWeight: '600', maxWidth: 140 },
});
