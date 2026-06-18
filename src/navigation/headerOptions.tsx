import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { AnimatedHeaderTitle } from '../components/AnimatedHeaderTitle';
import { PALETTE } from '../constants/colors';

/**
 * Shared native-stack header look. Every stack in the app applies this same object so header
 * height/weight/animation stay identical regardless of which tab or modal a screen is reached from.
 * The background reflects the user's chosen accent color (Settings > Appearance); the title itself
 * slides in from the left while fading in, replayed on every focus.
 */
export const themedHeaderOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: PALETTE.primary },
  headerTintColor: PALETTE.onPrimary,
  headerShadowVisible: false,
  animation: 'none',
  headerTitle: (props) => <AnimatedHeaderTitle title={props.children} tintColor={props.tintColor ?? PALETTE.onPrimary} />,
};
