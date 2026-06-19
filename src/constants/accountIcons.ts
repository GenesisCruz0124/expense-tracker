import type { ImageSourcePropType } from 'react-native';

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

/**
 * Real bank/e-wallet logos, selectable alongside the emoji above. Stored on the account/category
 * record as the `logo:<key>` string below — `AccountIcon` renders these as images instead of text.
 */
export const ACCOUNT_LOGOS: Record<string, ImageSourcePropType> = {
  'logo:pnb': require('../../assets/bank-icons/pnb.png'),
};

export const ACCOUNT_LOGO_OPTIONS = Object.keys(ACCOUNT_LOGOS);
