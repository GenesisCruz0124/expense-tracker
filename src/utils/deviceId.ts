import * as Application from 'expo-application';
import { Platform } from 'react-native';

export async function getDeviceId(): Promise<string> {
  if (Platform.OS === 'android') {
    return Application.getAndroidId() ?? 'unknown-android';
  }
  return (await Application.getIosIdForVendorAsync()) ?? 'unknown-ios';
}
