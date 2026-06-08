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
