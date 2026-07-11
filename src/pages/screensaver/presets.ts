import type { RainConfig } from '../../engine/rain';
import { MATRIX_CHARSET, KATAKANA, LATIN, DIGITS } from '../../engine/rain';

/**
 * The screensaver configurator drives the real `RainConfig` surface directly.
 * These preset lists are just convenient starting points the player can nudge —
 * whole-look palettes, glyph pools, and canvas fonts — each expressed as the
 * exact config fields `RainEngine.setConfig()` already understands.
 */

/** A named whole-look palette: trail, head, and background in one click. */
export interface ColorPreset {
  name: string;
  color: string;
  headColor: string;
  backgroundColor: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { name: 'MATRIX GREEN', color: '#00ff41', headColor: '#d7ffe0', backgroundColor: '#020604' },
  { name: 'AMBER CRT', color: '#ffb000', headColor: '#fff1c9', backgroundColor: '#0a0600' },
  { name: 'ICE BLUE', color: '#39c0ff', headColor: '#e4f7ff', backgroundColor: '#01060a' },
  { name: 'RED ALERT', color: '#ff2d2d', headColor: '#ffd7d7', backgroundColor: '#0a0202' },
  { name: 'GHOST WHITE', color: '#b8c6d0', headColor: '#ffffff', backgroundColor: '#04060a' },
  { name: 'VIOLET', color: '#b26bff', headColor: '#f0e0ff', backgroundColor: '#060209' },
];

/** A named glyph pool. `CUSTOM` reveals a free-text field in the UI. */
export interface CharsetPreset {
  name: string;
  chars: string;
  /** Sentinel for the "type your own glyphs" option. */
  custom?: boolean;
}

export const CHARSET_PRESETS: CharsetPreset[] = [
  { name: 'MATRIX', chars: MATRIX_CHARSET },
  { name: 'KATAKANA', chars: KATAKANA },
  { name: 'LATIN', chars: LATIN },
  { name: 'DIGITS', chars: DIGITS },
  { name: 'BINARY', chars: '01' },
  { name: 'HEX', chars: '0123456789ABCDEF' },
  { name: 'SYMBOLS', chars: '!<>-_\\/[]{}=+*^?#@$%&' },
  { name: 'CUSTOM', chars: MATRIX_CHARSET, custom: true },
];

export interface FontPreset {
  name: string;
  stack: string;
}

/**
 * Canvas font stacks. Each keeps a broad monospace fallback so the exported
 * file still renders on machines without the lead face installed — the head of
 * every stack is a common system mono, not a web font we would need to embed.
 */
export const FONT_PRESETS: FontPreset[] = [
  { name: 'SHARE TECH', stack: "'Share Tech Mono', 'MS Gothic', 'Osaka-Mono', monospace" },
  { name: 'CONSOLAS', stack: "Consolas, 'Cascadia Mono', 'MS Gothic', monospace" },
  { name: 'COURIER', stack: "'Courier New', Courier, 'MS Gothic', monospace" },
  { name: 'MONACO', stack: "Monaco, Menlo, 'MS Gothic', monospace" },
  { name: 'SYSTEM MONO', stack: "ui-monospace, 'MS Gothic', monospace" },
];

/** The configurator's opening state — canonical Matrix rain, tuned full-bleed. */
export const INITIAL_CONFIG: RainConfig = {
  charset: MATRIX_CHARSET,
  color: '#00ff41',
  headColor: '#d7ffe0',
  backgroundColor: '#020604',
  fadeAlpha: 0.09,
  fontSize: 18,
  fontFamily: FONT_PRESETS[0].stack,
  speed: 16,
  speedVariance: 0.5,
  density: 0.85,
};
