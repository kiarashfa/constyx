import layout from './layout.json';

/**
 * All rooftop gameplay numbers in one place. The leap is the film's: a
 * street-wide canyon, cleared in a long high arc. SUCCESS REQUIRES BOTH skills
 * (launching from the coping, landing 3 m lower on the far roof):
 *  - full sprint (7 m/s) + release in the bracket: ~34 m of air, clears the 28 m gap
 *  - full sprint + mediocre release (q = 0.5): ~19 m, falls short
 *  - 80% sprint + perfect release: ~29.7 m, only clears from the very lip
 *  - walk speed + perfect release: ~12.6 m, nowhere close
 */
export const GAP: number = layout.gap;
/** Height of the far roof relative to ours (negative: it is lower). */
export const ROOF_B_Y: number = layout.roofB;
export const STREET_Y: number = layout.street;

export const SPRINT_MAX = 7;
export const SPRINT_RAMP_SEC = 1.6;
export const GRAVITY = 12;

export const CHARGE_MS = 1100;
export const SWEET_START = 0.68;
export const SWEET_END = 0.92;
export const JUMP_MIN_VY = 5;
export const JUMP_MAX_VY = 17;
export const FORWARD_BOOST = 0.61;

/** Below this height a jump has plainly failed (the fall vignette starts). */
export const FALL_START = -6;
export const MAX_FAILS = 10;
export const SPAWN = layout.spawn as [number, number, number];
