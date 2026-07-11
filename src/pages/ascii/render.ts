import { KATAKANA, DIGITS } from '../../engine/rain';
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyphFor } from './font';

/**
 * Text → ASCII/block art. Every style shares the one 5×7 bitmap in font.ts;
 * they differ only in how an "on" (and its neighbourhood) becomes a character.
 * That keeps the letterforms identical across looks and the whole thing tiny,
 * offline, and dependency-free.
 */

export type AsciiStyle = 'block' | 'banner' | 'outline' | 'shadow' | 'matrix';

export interface StyleOption {
  id: AsciiStyle;
  label: string;
  hint: string;
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'block', label: 'BLOCK', hint: 'Solid full-block letters.' },
  { id: 'banner', label: 'BANNER', hint: 'Classic BBS hash-mark banner.' },
  { id: 'outline', label: 'OUTLINE', hint: 'Hollow, edges only.' },
  { id: 'shadow', label: 'SHADOW', hint: 'Block letters with a drop shadow.' },
  { id: 'matrix', label: 'MATRIX', hint: 'Letters built from falling code.' },
];

const MATRIX_GLYPHS = KATAKANA + DIGITS;
const INTER_GLYPH_GAP = 1;

/** Deterministic RNG so a given (text, style, seed) always renders identically. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lay one line of text out as a boolean pixel grid (height = GLYPH_HEIGHT). */
function lineGrid(line: string): boolean[][] {
  const chars = [...line];
  const rows: boolean[][] = [];
  for (let r = 0; r < GLYPH_HEIGHT; r++) {
    const row: boolean[] = [];
    chars.forEach((ch, i) => {
      const glyph = glyphFor(ch);
      for (let c = 0; c < GLYPH_WIDTH; c++) row.push(glyph[r]?.[c] ?? false);
      if (i < chars.length - 1) for (let g = 0; g < INTER_GLYPH_GAP; g++) row.push(false);
    });
    rows.push(row);
  }
  return rows;
}

function rstrip(s: string): string {
  return s.replace(/\s+$/, '');
}

function on(grid: boolean[][], r: number, c: number): boolean {
  return grid[r]?.[c] ?? false;
}

/** Convert one line's pixel grid to text for the chosen style. */
function styleLine(grid: boolean[][], style: AsciiStyle, rng: () => number): string {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;

  if (style === 'shadow') {
    // One extra row/col so the down-right shadow has room.
    const out: string[] = [];
    for (let r = 0; r < h + 1; r++) {
      let row = '';
      for (let c = 0; c < w + 1; c++) {
        if (on(grid, r, c)) row += '█';
        else if (on(grid, r - 1, c - 1)) row += '░';
        else row += ' ';
      }
      out.push(rstrip(row));
    }
    return out.join('\n');
  }

  const out: string[] = [];
  for (let r = 0; r < h; r++) {
    let row = '';
    for (let c = 0; c < w; c++) {
      const lit = on(grid, r, c);
      if (style === 'block') {
        row += lit ? '█' : ' ';
      } else if (style === 'banner') {
        row += lit ? '#' : ' ';
      } else {
        // matrix: on-pixels are live glyphs; a little sparse code drifts behind.
        if (lit) row += MATRIX_GLYPHS[Math.floor(rng() * MATRIX_GLYPHS.length)];
        else row += rng() < 0.05 ? MATRIX_GLYPHS[Math.floor(rng() * MATRIX_GLYPHS.length)] : ' ';
      }
    }
    out.push(rstrip(row));
  }
  return out.join('\n');
}

/**
 * Hollow one glyph: dilate it by one cell (so the 1px strokes gain body), then
 * keep only the boundary of that thickened shape. This is what makes OUTLINE
 * read as bold, hollow letters rather than collapsing to the banner look —
 * a thin font has no true interior to carve, so we grow one first. Done per
 * glyph (clamped to its own cell) so neighbouring letters never fuse.
 */
function outlineGlyph(glyph: boolean[][]): string[] {
  const at = (r: number, c: number) => glyph[r]?.[c] ?? false;
  const solid = (r: number, c: number) =>
    at(r, c) || at(r - 1, c) || at(r + 1, c) || at(r, c - 1) || at(r, c + 1);
  const rows: string[] = [];
  for (let r = -1; r <= GLYPH_HEIGHT; r++) {
    let row = '';
    for (let c = -1; c <= GLYPH_WIDTH; c++) {
      const edge =
        solid(r, c) &&
        (!solid(r - 1, c) || !solid(r + 1, c) || !solid(r, c - 1) || !solid(r, c + 1));
      row += edge ? '#' : ' ';
    }
    rows.push(row);
  }
  return rows; // (GLYPH_HEIGHT + 2) rows × (GLYPH_WIDTH + 2) cols
}

function outlineLine(line: string): string {
  const blocks = [...line].map((ch) => outlineGlyph(glyphFor(ch)));
  if (blocks.length === 0) return '';
  const rows: string[] = [];
  for (let r = 0; r < GLYPH_HEIGHT + 2; r++) {
    rows.push(rstrip(blocks.map((b) => b[r]).join(' ')));
  }
  return rows.join('\n');
}

/**
 * Render text to ASCII art. Multi-line input renders each line as its own block,
 * stacked with a blank separator. `seed` only matters for the matrix style
 * (advance it to animate); every other style ignores it and is fully stable.
 */
export function renderAscii(text: string, style: AsciiStyle, seed = 0): string {
  const source = text.length ? text : '';
  const rng = mulberry32(seed || 1);
  const blocks = source
    .split('\n')
    .map((line) => (style === 'outline' ? outlineLine(line) : styleLine(lineGrid(line), style, rng)));
  return blocks.join('\n\n');
}
