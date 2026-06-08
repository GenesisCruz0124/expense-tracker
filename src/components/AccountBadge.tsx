import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';

interface Props {
  name: string;
  color: string;
  icon?: string | null;
}

export function AccountBadge({ name, color, icon }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A`, borderColor: `${color}40` }]}>
      <Text style={styles.icon}>{icon ?? DEFAULT_ACCOUNT_ICON}</Text>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {name}
      </Text>
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
