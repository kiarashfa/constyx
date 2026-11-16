/**
 * All rooftop gameplay numbers in one place. The gap is tuned so that
 * SUCCESS REQUIRES BOTH skills:
 *  - full sprint (7 m/s) + perfect release → ~8.0 m of air, clears the 6 m gap
 *  - full sprint + mediocre release (q≈0.5) → ~5.5 m, falls short
 *  - walk speed + perfect release → ~2.9 m, nowhere close
 *  - ~80% sprint + perfect release → ~5.9 m, just barely fails
 */
export const GAP = 6;
export const ROOF_B_DROP = 0.6;

export const SPRINT_MAX = 7;
export const SPRINT_RAMP_SEC = 1.6;
export const GRAVITY = 14;

export const CHARGE_MS = 1100;
export const SWEET_START = 0.68;
export const SWEET_END = 0.92;
export const JUMP_MIN_VY = 2.2;
export const JUMP_MAX_VY = 6.2;
export const FORWARD_BOOST = 0.18;

/** Feet height that counts as "fallen into the street". */
export const FALL_Y = -26;
export const MAX_FAILS = 10;
export const SPAWN: [number, number, number] = [0, 0, 12.5];
