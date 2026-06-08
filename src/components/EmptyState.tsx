import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';

interface Props {
  icon?: string;
  title: string;
  message?: string;
}

export function EmptyState({ icon = '📭', title, message }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 6 },
  icon: { fontSize: 32, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '600', color: PALETTE.textPrimary, textAlign: 'center' },
  message: { fontSize: 13, color: PALETTE.textSecondary, textAlign: 'center' },
});
