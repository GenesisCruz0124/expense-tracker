import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { isValid, parseISO } from 'date-fns';

import { PALETTE } from '../constants/colors';
import { formatDisplayDate, formatIsoDate, parseIsoDate } from '../utils/dateRanges';

interface Props {
  /** ISO date string 'YYYY-MM-DD' */
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
}

/** Date entry backed by the native date picker, with a "Today" shortcut. */
export function DateField({ value, onChangeText, label }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));

  function handleChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) onChangeText(formatIsoDate(selectedDate));
      return;
    }
    if (selectedDate) onChangeText(formatIsoDate(selectedDate));
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.row, !isValidDate && value.length > 0 && styles.rowInvalid]}>
        <Pressable style={styles.field} onPress={() => setShowPicker(true)} hitSlop={4}>
          <Text style={isValidDate ? styles.value : styles.placeholder}>
            {isValidDate ? formatDisplayDate(value) : 'Select a date'}
          </Text>
        </Pressable>
        <Pressable onPress={() => onChangeText(formatIsoDate(new Date()))} hitSlop={8}>
          <Text style={styles.todayLink}>Today</Text>
        </Pressable>
      </View>
      {!isValidDate && value.length > 0 ? <Text style={styles.error}>Select a valid date.</Text> : null}
      {showPicker ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={isValidDate ? parseIsoDate(value) : new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable onPress={() => setShowPicker(false)} style={styles.doneButton} hitSlop={8}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: PALETTE.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  rowInvalid: { borderColor: PALETTE.danger },
  field: { flex: 1, paddingVertical: 12 },
  value: { fontSize: 15, color: PALETTE.textPrimary },
  placeholder: { fontSize: 15, color: PALETTE.textSecondary },
  todayLink: { fontSize: 13, fontWeight: '700', color: PALETTE.net, paddingLeft: 12 },
  error: { fontSize: 12, color: PALETTE.danger },
  pickerWrap: {
    backgroundColor: PALETTE.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
    borderRadius: 10,
    alignItems: 'center',
    paddingBottom: 8,
  },
  doneButton: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  doneButtonText: { fontSize: 14, fontWeight: '700', color: PALETTE.net },
});
