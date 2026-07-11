import type { ColumnEffect } from '../../engine/rain';
import { DIGITS, LATIN } from '../../engine/rain';

export type ThreatKind = 'agent' | 'glitch' | 'redpill' | 'echo';
export type ActionId = 'jackout' | 'patch' | 'hardline' | 'dismiss';
export type Sector = 'WEST' | 'CENTRAL' | 'EAST';

export interface ThreatDef {
  kind: ThreatKind;
  /** Shown once the call is made / in results — never while live in the HUD. */
  name: string;
  /** Vague wording for the live alert log (must not give the type away). */
  alertText: string;
  /** How the threat manifests inside the rain. */
  effect: ColumnEffect;
  correctAction: ActionId;
  /** Time the player has to resolve it, ms (scaled down late-shift). */
  ttlMs: number;
  reward: number;
  wrongPenalty: number;
  missPenalty: number;
  traceOnWrong: number;
  traceOnMiss: number;
  /** Trace relief for a correct call (negative). */
  traceRelief: number;
  successText: string;
  failText: string;
  missText: string;
}

/**
 * The four anomaly signatures, each with a distinct in-rain tell:
 *  - AGENT: cold white column, falling fast, latin-only glyphs. White = the
 *    reserved "real-world/threat" contrast color; speed sells the pursuit.
 *  - GLITCH: déjà-vu — one glyph repeating down the column in acid green,
 *    with stutter (jitter) and sluggish fall. Repetition is the lore tell.
 *  - REDPILL: a column of pure digits pulsing like a heartbeat — someone
 *    dialing out, looking for a hardline.
 *  - ECHO: dim, slow, faint pulse. Residual static; the false positive that
 *    punishes trigger-happy operators. Correct call is DISMISS.
 */
export const THREATS: Record<ThreatKind, ThreatDef> = {
  agent: {
    kind: 'agent',
    name: 'AGENT INTRUSION',
    alertText: 'fast-moving signature',
    effect: {
      color: '#cfe8ff',
      headColor: '#ffffff',
      charset: LATIN,
      speedMultiplier: 1.8,
    },
    correctAction: 'jackout',
    ttlMs: 13000,
    reward: 120,
    wrongPenalty: 60,
    missPenalty: 80,
    traceOnWrong: 14,
    traceOnMiss: 22,
    traceRelief: -6,
    successText: 'crew jacked out clean — Agent lost the thread',
    failText: 'wrong call — the Agent reached them first',
    missText: 'SIGNAL LOST — Agent took the exit node',
  },
  glitch: {
    kind: 'glitch',
    name: 'CODE GLITCH',
    alertText: 'pattern fault detected',
    effect: {
      color: '#b8e62e',
      glyphMode: 'repeat',
      jitter: 0.4,
      speedMultiplier: 0.7,
    },
    correctAction: 'patch',
    ttlMs: 15000,
    reward: 100,
    wrongPenalty: 50,
    missPenalty: 60,
    traceOnWrong: 10,
    traceOnMiss: 15,
    traceRelief: -5,
    successText: 'sector reseeded — déjà vu suppressed',
    failText: 'wrong call — corruption spread before cleanup',
    missText: 'SIGNAL LOST — glitch cascaded upstream',
  },
  redpill: {
    kind: 'redpill',
    name: 'REDPILL SIGNAL',
    alertText: 'outbound signal rising',
    effect: {
      color: '#6bffa8',
      headColor: '#eafff0',
      charset: DIGITS,
      pulse: { periodMs: 1500, minAlpha: 0.35 },
    },
    correctAction: 'hardline',
    ttlMs: 16000,
    reward: 110,
    wrongPenalty: 50,
    missPenalty: 70,
    traceOnWrong: 12,
    traceOnMiss: 18,
    traceRelief: -6,
    successText: 'hardline routed — one more mind unplugged',
    failText: 'wrong call — the line went dead mid-dial',
    missText: 'SIGNAL LOST — the call was never answered',
  },
  echo: {
    kind: 'echo',
    name: 'RESIDUAL ECHO',
    alertText: 'faint irregularity',
    effect: {
      color: '#41604d',
      headColor: '#6d8a78',
      speedMultiplier: 0.85,
      pulse: { periodMs: 2600, minAlpha: 0.3 },
    },
    correctAction: 'dismiss',
    ttlMs: 13000,
    reward: 60,
    wrongPenalty: 40,
    missPenalty: 0,
    traceOnWrong: 8,
    traceOnMiss: 0,
    traceRelief: -3,
    successText: 'logged as residual static — good eye',
    failText: 'that was nothing — you just lit up the grid',
    missText: 'echo faded on its own',
  },
};

/** Fixed verb menu: one verb per signature. Reading the rain picks the verb. */
export const ACTIONS: { id: ActionId; label: string; hint: string }[] = [
  { id: 'jackout', label: 'JACK OUT', hint: 'pull crew from the node' },
  { id: 'patch', label: 'PATCH', hint: 'reseed corrupted code' },
  { id: 'hardline', label: 'HARDLINE', hint: 'route an exit line' },
  { id: 'dismiss', label: 'DISMISS', hint: 'log as residual static' },
];

// ------------------------------------------------------------------- pacing

export const SHIFT_DURATION_MS = 120_000;
export const FIRST_SPAWN_MS = 3_500;
/** Probing a clean column isn't free — keeps eyes on the rain, not the mouse. */
export const PROBE_TRACE_COST = 3;
/** Passive trace cool-down per second. */
export const TRACE_DECAY_PER_S = 0.35;

/** Seconds between spawns shrinks as the shift progresses (t = 0..1). */
export function spawnIntervalMs(t: number): number {
  const base = 11_000 - (11_000 - 4_500) * t;
  return base * (0.7 + Math.random() * 0.6);
}

/** Max simultaneous anomalies: 1 early, 2 mid, 3 late. */
export function maxActive(t: number): number {
  return 1 + Math.floor(t * 2.5);
}

/** Threat mix drifts toward ambiguity: echoes get common late. */
export function rollKind(t: number): ThreatKind {
  const weights: [ThreatKind, number][] = [
    ['agent', 0.30 + 0.05 * t],
    ['redpill', 0.32 - 0.06 * t],
    ['glitch', 0.22 + 0.04 * t],
    ['echo', 0.16 + 0.24 * t],
  ];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [kind, w] of weights) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return 'echo';
}

/** Late-shift threats give slightly less time (down to 75% of base TTL). */
export function ttlScale(t: number): number {
  return 1 - 0.25 * t;
}

// -------------------------------------------------------------------- ranks

export interface RankDef {
  id: string;
  label: string;
  blurb: string;
}

export function rateShift(score: number, accuracy: number, traced: boolean): RankDef {
  if (traced) {
    return { id: 'traced', label: 'TRACED', blurb: 'They found the line. Move the ship.' };
  }
  if (score >= 900 && accuracy >= 0.85) {
    return { id: 'elite', label: 'ZION ELITE', blurb: 'You read the code like the Oracle reads people.' };
  }
  if (score >= 550 && accuracy >= 0.7) {
    return { id: 'senior', label: 'SENIOR OPERATOR', blurb: 'Clean board. Morpheus would nod, once.' };
  }
  if (score >= 250) {
    return { id: 'operator', label: 'OPERATOR', blurb: 'Solid shift. The code is starting to talk to you.' };
  }
  return { id: 'potential', label: 'POTENTIAL', blurb: 'Everybody falls the first time.' };
}
