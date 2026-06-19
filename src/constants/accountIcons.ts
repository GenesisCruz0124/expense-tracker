/**
 * Emoji glyphs used as lightweight account icons — no extra icon-font dependency required.
 * The colored circles give banks/e-wallets (BDO, BPI, Maya, GoTyme, etc.) a distinct, color-coded
 * icon to pick without needing real bank logo artwork.
 */
export const ACCOUNT_ICON_OPTIONS = [
  '💵', '🏦', '💳', '📱', '👛', '🪙', '💰', '🧾', '💸', '🏛️', '📲',
  '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪',
] as const;

export const DEFAULT_ACCOUNT_ICON = '💵';
