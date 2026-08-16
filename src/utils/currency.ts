const CURRENCY = 'PHP';
const LOCALE = 'en-PH';

const formatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
});

/** Converts a stored integer amount (minor units, e.g. centavos) to a display string like "₱45.50". */
export function formatCurrency(minorUnits: number): string {
  const value = minorUnits / 100;
  // Negating a zero balance (e.g. a paid-off credit card) produces -0 in JS, and
  // Intl.NumberFormat honors that sign — printing "-₱0.00" instead of "₱0.00".
  return formatter.format(value === 0 ? 0 : value);
}

/** Converts a stored integer amount (minor units) to a plain major-unit number, e.g. 4550 -> 45.5. */
export function fromMinorUnits(minorUnits: number): number {
  return minorUnits / 100;
}

/**
 * Parses a user-entered amount string (major units, e.g. "45.50" or "45") into an integer
 * number of minor units (4550). Returns null if the input isn't a valid non-negative amount.
 */
export function toMinorUnits(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (trimmed === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;

  const [whole, fraction = ''] = trimmed.split('.');
  const paddedFraction = (fraction + '00').slice(0, 2);
  return Number(whole) * 100 + Number(paddedFraction);
}
