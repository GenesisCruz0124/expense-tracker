import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { ActionSheet, type ActionSheetOption } from './ActionSheet';
import { PALETTE } from '../constants/colors';

interface Props {
  uri: string | null;
  onChange: (uri: string | null) => void;
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.8,
  allowsEditing: true,
};

/** Lets the user attach a "received payment" QR code image by picking one from the gallery or capturing it. */
export function QrImagePicker({ uri, onChange }: Props) {
  const [zoomVisible, setZoomVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const { width, height } = useWindowDimensions();

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
    { label: 'Choose from gallery', onPress: pickFromLibrary },
    { label: 'Take photo', onPress: captureFromCamera },
  ];
  if (uri) sheetOptions.push({ label: 'Remove image', destructive: true, onPress: () => onChange(null) });

  const sheet = (
    <ActionSheet
      visible={sheetVisible}
      onClose={() => setSheetVisible(false)}
      title="Payment QR image"
      message={uri ? 'Replace or remove the QR image.' : 'Add an image of your payment QR code.'}
      options={sheetOptions}
    />
  );

  if (uri) {
    return (
      <>
        <Pressable onPress={() => setSheetVisible(true)} style={styles.previewWrap}>
          <Image source={{ uri }} style={styles.preview} resizeMode="contain" />
          <Pressable onPress={() => setZoomVisible(true)} style={styles.zoomButton} hitSlop={8}>
            <Text style={styles.zoomButtonText}>🔍</Text>
          </Pressable>
          <View style={styles.previewOverlay}>
            <Text style={styles.previewOverlayText}>Change image</Text>
          </View>
        </Pressable>

        <Modal visible={zoomVisible} transparent animationType="fade" onRequestClose={() => setZoomVisible(false)}>
          <View style={styles.zoomBackdrop}>
            <ScrollView
              style={styles.zoomScroll}
              contentContainerStyle={{ width, height }}
              minimumZoomScale={1}
              maximumZoomScale={4}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
            </ScrollView>
            <Pressable onPress={() => setZoomVisible(false)} style={styles.zoomClose} hitSlop={8}>
              <Text style={styles.zoomCloseText}>✕</Text>
            </Pressable>
          </View>
        </Modal>

        {sheet}
      </>
    );
  }

  return (
    <>
      <Pressable onPress={() => setSheetVisible(true)} style={({ pressed }) => [styles.placeholder, pressed && styles.placeholderPressed]}>
        <Text style={styles.placeholderIcon}>🖼️</Text>
        <Text style={styles.placeholderText}>Add QR image</Text>
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
    backgroundColor: '#fff',
  },
  preview: { width: '100%', height: 220 },
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
  zoomButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  zoomButtonText: { fontSize: 15 },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.92)' },
  zoomScroll: { flex: 1 },
  zoomClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  zoomCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
