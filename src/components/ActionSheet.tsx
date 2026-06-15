import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PALETTE } from '../constants/colors';

export interface ActionSheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  options: ActionSheetOption[];
}

/**
 * Bottom action sheet used in place of `Alert.alert` for multi-option pickers — on Android,
 * `Alert.alert` caps buttons at 3 and defaults to non-cancelable, so a 4th "Cancel" option
 * silently disappears and the back button can't dismiss the dialog.
 */
export function ActionSheet({ visible, onClose, title, message, options }: Props) {
  function handleSelect(onPress: () => void) {
    onClose();
    onPress();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {options.map((option) => (
            <Pressable key={option.label} style={styles.option} onPress={() => handleSelect(option.onPress)}>
              <Text style={[styles.optionText, option.destructive && styles.optionTextDestructive]}>{option.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.option} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: {
    backgroundColor: PALETTE.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
  },
  title: { fontSize: 16, fontWeight: '700', color: PALETTE.textPrimary, textAlign: 'center' },
  message: { fontSize: 13, color: PALETTE.textSecondary, textAlign: 'center', marginTop: 4 },
  option: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PALETTE.border,
    marginTop: 8,
  },
  optionText: { fontSize: 15, fontWeight: '600', color: PALETTE.net, textAlign: 'center' },
  optionTextDestructive: { color: PALETTE.danger },
  cancelText: { fontSize: 15, fontWeight: '600', color: PALETTE.textSecondary, textAlign: 'center' },
});
