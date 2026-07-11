/** Attack vocabulary, response mapping, and all dojo tuning in one place. */

export type AttackKind = 'sweep' | 'heavy' | 'lunge';
export type ResponseKind = 'dodge' | 'block' | 'counter';

export interface AttackDef {
  kind: AttackKind;
  name: string;
  correct: ResponseKind;
  /** Telegraph durations (ms): how long the player has to answer. */
  practiceTelegraphMs: number;
  sparringTelegraphMs: number;
  damage: number;
  /** Practice callout shown while the telegraph plays. */
  callout: string;
  /** Feedback lines for the resolve beat. */
  readText: string;
  hitText: string;
}

export const ATTACKS: Record<AttackKind, AttackDef> = {
  sweep: {
    kind: 'sweep',
    name: 'LOW SWEEP',
    correct: 'dodge',
    practiceTelegraphMs: 2400,
    sparringTelegraphMs: 950,
    damage: 15,
    callout: 'LOW SWEEP — get over it [SPACE]',
    readText: '✓ swept nothing but air — you were already gone',
    hitText: '✗ the sweep took your legs — that one needed [SPACE]',
  },
  heavy: {
    kind: 'heavy',
    name: 'HEAVY PALM',
    correct: 'block',
    practiceTelegraphMs: 2400,
    sparringTelegraphMs: 1050,
    damage: 18,
    callout: 'HEAVY PALM — brace for it [RIGHT-CLICK]',
    readText: '✓ braced — the palm broke on your guard',
    hitText: '✗ the palm landed clean — that one needed [RIGHT-CLICK]',
  },
  lunge: {
    kind: 'lunge',
    name: 'OVERCOMMITTED LUNGE',
    correct: 'counter',
    practiceTelegraphMs: 2800,
    sparringTelegraphMs: 1500,
    damage: 12,
    callout: 'OVERCOMMITTED LUNGE — punish the opening [LEFT-CLICK]',
    readText: '★ COUNTERED — you hit him through the opening',
    hitText: '✗ the opening closed on you — punish it with [LEFT-CLICK]',
  },
};

export const RESPONSE_LABEL: Record<ResponseKind, string> = {
  dodge: 'DODGE [SPACE]',
  block: 'BLOCK [RIGHT-CLICK]',
  counter: 'COUNTER [LEFT-CLICK]',
};

// ------------------------------------------------------------------ pacing

/** Gap between attacks, ms. */
export const PRACTICE_GAP_MS = 1900;
export const SPARRING_GAP_MIN_MS = 800;
export const SPARRING_GAP_MAX_MS = 1500;
/** Strike animation beat between telegraph end and recovery. */
export const STRIKE_MS = 320;
/** Extra recovery when a counter staggers him. */
export const STAGGER_MS = 900;

// ------------------------------------------------------------------ rules

export const MAX_HEALTH = 100;
/** Consecutive misreads that end the round on their own. */
export const STREAK_LIMIT = 3;
/** Read points needed to win; counters score double. */
export const WIN_POINTS = 12;
export const COUNTER_POINTS = 2;

/** Practice: correct reads of each kind before the "ready" nudge. */
export const PRACTICE_READY_PER_KIND = 2;
