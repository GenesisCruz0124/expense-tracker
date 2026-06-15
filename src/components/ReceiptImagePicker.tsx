import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ActionSheet, type ActionSheetOption } from './ActionSheet';
import { PALETTE } from '../constants/colors';

interface Props {
  uri: string | null;
  onChange: (uri: string | null) => void;
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.6,
  allowsEditing: true,
};

/** Lets the user attach a receipt photo by capturing one or picking from the library. */
export function ReceiptImagePicker({ uri, onChange }: Props) {
  const [sheetVisible, setSheetVisible] = useState(false);

  async function captureFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to choose an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
  }

  const sheetOptions: ActionSheetOption[] = [
    { label: 'Take photo', onPress: captureFromCamera },
    { label: 'Choose from library', onPress: pickFromLibrary },
  ];
  if (uri) sheetOptions.push({ label: 'Remove photo', destructive: true, onPress: () => onChange(null) });

  const sheet = (
    <ActionSheet
      visible={sheetVisible}
      onClose={() => setSheetVisible(false)}
      title="Receipt photo"
      message={uri ? 'Replace or remove the attached photo.' : 'Attach a photo of your receipt.'}
      options={sheetOptions}
    />
  );

  if (uri) {
    return (
      <>
        <Pressable onPress={() => setSheetVisible(true)} style={styles.previewWrap}>
          <Image source={{ uri }} style={styles.preview} />
          <View style={styles.previewOverlay}>
            <Text style={styles.previewOverlayText}>Change photo</Text>
          </View>
        </Pressable>
        {sheet}
      </>
    );
  }

  return (
    <>
      <Pressable onPress={() => setSheetVisible(true)} style={({ pressed }) => [styles.placeholder, pressed && styles.placeholderPressed]}>
        <Text style={styles.placeholderIcon}>📷</Text>
        <Text style={styles.placeholderText}>Add receipt photo</Text>
      </Pressable>
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: PALETTE.border,
    borderRadius: 10,
    backgroundColor: PALETTE.surface,
  },
  placeholderPressed: { backgroundColor: PALETTE.background },
  placeholderIcon: { fontSize: 22 },
  placeholderText: { fontSize: 14, fontWeight: '600', color: PALETTE.textSecondary },
  previewWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PALETTE.border,
  },
  preview: { width: '100%', height: 180, backgroundColor: PALETTE.background },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  previewOverlayText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
