import { getPreference } from '../db/themePreferences';

/** Preset palette offered when creating/editing a category — keeps chart segments visually distinct. */
export const CATEGORY_COLOR_PALETTE = [
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#EAB308', // yellow
  '#84CC16', // lime
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#A855F7', // purple
  '#EC4899', // pink
] as const;

export type ThemeMode = 'light' | 'dark';

/** Accent presets for the themed header/primary color, offered in Settings > Appearance. */
export const ACCENT_PRESETS = {
  pink: { label: 'Pink', color: '#F76C8A' },
  blue: { label: 'Blue', color: '#3B82F6' },
  green: { label: 'Green', color: '#22C55E' },
  purple: { label: 'Purple', color: '#A855F7' },
  orange: { label: 'Orange', color: '#F97316' },
} as const;
export type AccentKey = keyof typeof ACCENT_PRESETS;

export const THEME_MODE_KEY = 'themeMode';
export const THEME_ACCENT_KEY = 'themeAccent';

export function getStoredThemeMode(): ThemeMode {
  return getPreference(THEME_MODE_KEY) === 'dark' ? 'dark' : 'light';
}

export function getStoredAccentKey(): AccentKey {
  const stored = getPreference(THEME_ACCENT_KEY);
  return stored != null && stored in ACCENT_PRESETS ? (stored as AccentKey) : 'pink';
}

const LIGHT = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
};

const DARK = {
  background: '#0B1120',
  surface: '#1E293B',
  border: '#334155',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
};

const mode = getStoredThemeMode();
const accent = ACCENT_PRESETS[getStoredAccentKey()].color;

// Baked in once at app start from the persisted preference — changing the theme in Settings takes
// effect the next time the app launches rather than live, since every screen's StyleSheet is built
// from this constant at module-load time.
export const PALETTE = {
  ...(mode === 'dark' ? DARK : LIGHT),
  income: '#22C55E',
  expense: '#EF4444',
  net: '#3B82F6',
  warning: '#F59E0B',
  danger: '#EF4444',
  /** Themed header/primary color — defaults to the piggy-bank pink lifted from the app icon. */
  primary: accent,
  onPrimary: '#FFFFFF',
} as const;
