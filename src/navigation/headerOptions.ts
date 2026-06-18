import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { PALETTE } from '../constants/colors';

/**
 * Shared native-stack header look, themed off the app icon's piggy-bank pink. Every stack in the
 * app applies this same object so header height/weight/animation stay identical regardless of
 * which tab or modal a screen is reached from.
 */
export const themedHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: PALETTE.primary },
  headerTintColor: PALETTE.onPrimary,
  headerTitleStyle: { fontWeight: '700', fontSize: 18 },
  headerShadowVisible: false,
  animation: 'slide_from_right',
};
