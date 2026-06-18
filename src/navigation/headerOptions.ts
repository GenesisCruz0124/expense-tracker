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
  // 'slide_from_right' drags the whole native header — pink background included — across the
  // screen as one unit, which reads as the color itself animating. Every screen shares the same
  // headerStyle background already, so there's nothing to transition there; 'fade' only crossfades
  // the header title/content, leaving the (already-identical) background looking static.
  animation: 'fade',
};
