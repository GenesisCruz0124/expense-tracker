import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/**
 * Shared native-stack header look. Every stack in the app applies this same object so header
 * height/weight/animation stay identical regardless of which tab or modal a screen is reached from.
 */
export const themedHeaderOptions: NativeStackNavigationOptions = {
  headerTitleStyle: { fontWeight: '700', fontSize: 18 },
  headerShadowVisible: false,
  animation: 'none',
};
