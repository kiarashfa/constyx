export type WeaponCategory =
  | 'pistols'
  | 'smgs'
  | 'rifles'
  | 'shotguns'
  | 'support'
  | 'precision';

export const CATEGORY_LABEL: Record<WeaponCategory, string> = {
  pistols: 'PISTOLS',
  smgs: 'SUBMACHINE GUNS',
  rifles: 'RIFLES',
  shotguns: 'SHOTGUNS',
  support: 'SUPPORT WEAPONS',
  precision: 'PRECISION RIFLES',
};

/** Procedural viewmodel archetype — proportions for the range model. */
export type WeaponArchetype =
  | 'pistol'
  | 'revolver'
  | 'smg'
  | 'rifle'
  | 'bullpup'
  | 'shotgun'
  | 'double'
  | 'lmg'
  | 'sniper';

export interface FireConfig {
  /** Full-auto: hold to fire. Semi: one shot per click. */
  auto: boolean;
  /** Minimum ms between shots. */
  intervalMs: number;
  /** Radian half-angle of random spread per shot. */
  spread: number;
  /** Pellets per trigger pull (shotguns). */
  pellets: number;
  /** Camera shake per shot. */
  kick: number;
}

export interface WeaponEntry {
  id: string;
  name: string;
  category: WeaponCategory;
  /** Spec line: origin · service year · cartridge · action. */
  spec: string;
  /** Educational content, ~2 short paragraphs, written from research. */
  body: string[];
  /** Optional film-connection note (kept to well-documented ties). */
  filmNote?: string;
  archetype: WeaponArchetype;
  fire: FireConfig;
}

export const FIRE_BY_ARCHETYPE: Record<WeaponArchetype, FireConfig> = {
  pistol: { auto: false, intervalMs: 160, spread: 0.006, pellets: 1, kick: 0.06 },
  revolver: { auto: false, intervalMs: 320, spread: 0.005, pellets: 1, kick: 0.09 },
  smg: { auto: true, intervalMs: 80, spread: 0.011, pellets: 1, kick: 0.045 },
  rifle: { auto: true, intervalMs: 100, spread: 0.005, pellets: 1, kick: 0.07 },
  bullpup: { auto: true, intervalMs: 95, spread: 0.0045, pellets: 1, kick: 0.06 },
  shotgun: { auto: false, intervalMs: 900, spread: 0.028, pellets: 8, kick: 0.16 },
  double: { auto: false, intervalMs: 650, spread: 0.03, pellets: 8, kick: 0.18 },
  lmg: { auto: true, intervalMs: 90, spread: 0.013, pellets: 1, kick: 0.08 },
  sniper: { auto: false, intervalMs: 1300, spread: 0.0012, pellets: 1, kick: 0.2 },
};
