/**
 * Full configuration for a rain instance. Every field can be overridden per
 * instance; `defaultRainConfig` in presets.ts supplies Matrix-green defaults.
 */
export interface RainConfig {
  /** Pool of glyphs a column draws from (katakana + latin + digits by default). */
  charset: string;
  /** Trail glyph color (any CSS hex color, e.g. '#00ff41'). */
  color: string;
  /** Color of the bright leading glyph of each column. */
  headColor: string;
  /**
   * Opaque canvas background. Also used (with `fadeAlpha`) as the translucent
   * fill that fades trails out each frame, so keep it near-black.
   */
  backgroundColor: string;
  /**
   * Strength of the per-frame fade fill, 0..1. Lower = longer ghost trails,
   * higher = shorter, crisper trails.
   */
  fadeAlpha: number;
  /** Glyph size in CSS pixels. Also the cell size of the column grid. */
  fontSize: number;
  /** Canvas font stack. Needs a fallback that covers half-width katakana. */
  fontFamily: string;
  /** Base fall speed in rows (cells) per second. */
  speed: number;
  /**
   * Per-column speed variance, 0..1. Each column falls at
   * speed * (1 ± variance * random).
   */
  speedVariance: number;
  /** Fraction of columns raining at any time, 0..1. */
  density: number;
  /**
   * Optional fixed number of columns. When omitted, the count is derived from
   * canvas width / fontSize (one column per glyph cell).
   */
  columnCount?: number;
}

/**
 * A persistent per-column visual override — how game features make a single
 * column "read wrong" inside the rain (an Agent moving through it, corrupted
 * code, a signal dialing out...). Applied/removed via 'column-effect' events;
 * every field falls back to the engine config when omitted.
 */
export interface ColumnEffect {
  /** Trail color override. */
  color?: string;
  /** Leading-glyph color override. */
  headColor?: string;
  /** Glyph pool override (e.g. digits-only for a dial-out signal). */
  charset?: string;
  /** Fall-speed multiplier on top of the column's own speed. */
  speedMultiplier?: number;
  /** 'repeat' rains one fixed glyph — the déjà-vu look. Default 'random'. */
  glyphMode?: 'random' | 'repeat';
  /** Slow brightness oscillation: alpha swings between minAlpha and 1. */
  pulse?: { periodMs: number; minAlpha: number };
  /** 0..1 chance per frame to erratically redraw a recent cell (stutter). */
  jitter?: number;
}

/**
 * Events the engine can receive via `RainEngine.dispatch()`. This union is the
 * extension point for future rounds (game threats, glitches, extractions...):
 * add a variant here, handle it in `RainEngine.applyEvent()`.
 */
export type RainEvent =
  | {
      /** Tint one column for a while (future: mark a threat / extraction target). */
      type: 'column-highlight';
      column: number;
      color?: string;
      durationMs?: number;
    }
  | {
      /** Brief full-surface flash (future: agent glitch, jack-out pulse). */
      type: 'glitch-flash';
      color?: string;
      durationMs?: number;
    }
  | {
      /** Apply a persistent visual override to one column (threat visuals). */
      type: 'column-effect';
      column: number;
      effect: ColumnEffect;
    }
  | {
      /** Remove a column's effect, returning it to the ambient look. */
      type: 'column-effect-clear';
      column: number;
    };

/** Observer for dispatched events (future: HUDs reacting to engine activity). */
export type RainEventListener = (event: RainEvent) => void;
