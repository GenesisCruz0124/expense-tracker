import { eq, inArray } from 'drizzle-orm';
import type { Database } from './client';
import { categories, type NewCategory } from './schema';

const DEFAULT_CATEGORIES: NewCategory[] = [
  { name: 'Food', type: 'expense', color: '#F97316', icon: '🍔' },
  { name: 'Transport', type: 'expense', color: '#3B82F6', icon: '🚗' },
  { name: 'Rent', type: 'expense', color: '#6366F1', icon: '🏠' },
  { name: 'Utilities', type: 'expense', color: '#F59E0B', icon: '💡' },
  { name: 'Entertainment', type: 'expense', color: '#EC4899', icon: '🎬' },
  { name: 'Shopping', type: 'expense', color: '#A855F7', icon: '🛍️' },
  { name: 'Health', type: 'expense', color: '#EF4444', icon: '🏥' },
  { name: 'Salary', type: 'income', color: '#22C55E', icon: '💰' },
  { name: 'Other', type: 'both', color: '#64748B', icon: '🧾' },
];

/** Inserts a starter set of categories the first time the app runs on a fresh database. */
export async function seedDefaultCategories(db: Database): Promise<void> {
  const existing = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing.length > 0) return;

  await db.insert(categories).values(DEFAULT_CATEGORIES);
}

const ADDITIONAL_CATEGORIES: NewCategory[] = [
  // Income
  { name: 'Clothing Allowance for Officers', type: 'income', color: '#6366F1', icon: '💼' },
  { name: '1st Tranche of Rice Subsidy for Officers', type: 'income', color: '#84CC16', icon: '🎁' },
  { name: 'Monetization of Excess Unused Leave Credits', type: 'income', color: '#F59E0B', icon: '💰' },
  { name: '13th Month Pay', type: 'income', color: '#22C55E', icon: '💰' },
  { name: 'Reimbursement - Bus.', type: 'income', color: '#06B6D4', icon: '🧾' },
  { name: '2nd Tranche of Rice Subsidy for Officers', type: 'income', color: '#14B8A6', icon: '🎁' },
  { name: '14th Month Pay', type: 'income', color: '#3B82F6', icon: '💰' },
  { name: '15th Month Pay', type: 'income', color: '#A855F7', icon: '💰' },
  { name: '16th Month Pay', type: 'income', color: '#EC4899', icon: '💰' },
  { name: 'Side Hustle', type: 'income', color: '#F97316', icon: '📈' },
  // Billers
  { name: 'SPayLater', type: 'expense', color: '#EF4444', icon: '📱' },
  { name: 'Spotify', type: 'expense', color: '#22C55E', icon: '🎬' },
  { name: 'PNB Parking', type: 'expense', color: '#3B82F6', icon: '🚗', isBiller: true },
  { name: 'Netflix', type: 'expense', color: '#F59E0B', icon: '🎬', isBiller: true },
  { name: 'Claude', type: 'expense', color: '#A855F7', icon: '💼' },
  { name: 'Mother', type: 'expense', color: '#EC4899', icon: '🎁', isBiller: true },
  { name: 'Meralco', type: 'expense', color: '#EAB308', icon: '💡', isBiller: true },
  { name: 'Maynilad', type: 'expense', color: '#14B8A6', icon: '🧾', isBiller: true },
  { name: 'Manila Water', type: 'expense', color: '#06B6D4', icon: '🧾', isBiller: true },
  { name: 'St. Peter Plan', type: 'expense', color: '#F97316', icon: '🏥', isBiller: true },
  { name: 'Disney+', type: 'expense', color: '#3B82F6', icon: '🎬', isBiller: true },
  { name: 'Google Play', type: 'expense', color: '#22C55E', icon: '📱', isBiller: true },
  // Food
  { name: 'Dine-In', type: 'expense', color: '#14B8A6', icon: '🍔' },
  { name: 'Fast Food', type: 'expense', color: '#EF4444', icon: '🍔' },
  { name: 'Food Delivery', type: 'expense', color: '#84CC16', icon: '🚗' },
  { name: 'Cafe', type: 'expense', color: '#F59E0B', icon: '☕' },
  { name: 'Grocery', type: 'expense', color: '#22C55E', icon: '🛍️' },
  { name: 'Parcel Delivery', type: 'expense', color: '#6366F1', icon: '🎁' },
  // Transport
  { name: 'Fuel', type: 'expense', color: '#F97316', icon: '🚗' },
];

const BILLER_NAMES = [
  'Meralco',
  'Maynilad',
  'Manila Water',
  'St. Peter Plan',
  'Disney+',
  'Google Play',
  'Mother',
  'Netflix',
  'PNB Parking',
];

/** Adds the requested income/biller categories on every launch, skipping any that already exist. */
export async function seedAdditionalCategories(db: Database): Promise<void> {
  // Fix up the earlier "Mothe" typo for installs that already seeded it.
  await db.update(categories).set({ name: 'Mother' }).where(eq(categories.name, 'Mothe'));
  await db.insert(categories).values(ADDITIONAL_CATEGORIES).onConflictDoNothing({ target: categories.name });
  // Flag the curated biller set, including for categories seeded before `isBiller` existed.
  await db.update(categories).set({ isBiller: true }).where(inArray(categories.name, BILLER_NAMES));
}
