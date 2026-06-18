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

export const PALETTE = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  income: '#22C55E',
  expense: '#EF4444',
  net: '#3B82F6',
  warning: '#F59E0B',
  danger: '#EF4444',
  /** Piggy-bank pink lifted from the app icon — used for the themed navigation header. */
  primary: '#F76C8A',
  onPrimary: '#FFFFFF',
} as const;
