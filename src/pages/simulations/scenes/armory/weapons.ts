import type { WeaponCategory, WeaponEntry } from './types';
import { PISTOLS, SMGS } from './catalog-handguns';
import { PRECISION, RIFLES, SHOTGUNS, SUPPORT } from './catalog-longguns';

export const CATALOG: WeaponEntry[] = [
  ...PISTOLS,
  ...SMGS,
  ...RIFLES,
  ...SHOTGUNS,
  ...SUPPORT,
  ...PRECISION,
];

export const CATEGORIES: WeaponCategory[] = [
  'pistols',
  'smgs',
  'rifles',
  'shotguns',
  'support',
  'precision',
];

export function byCategory(category: WeaponCategory): WeaponEntry[] {
  return CATALOG.filter((w) => w.category === category);
}

export function getWeapon(id: string): WeaponEntry | undefined {
  return CATALOG.find((w) => w.id === id);
}
