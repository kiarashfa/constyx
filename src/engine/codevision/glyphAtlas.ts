import { CanvasTexture, LinearFilter } from 'three';

/**
 * The glyph pool the code-vision effect draws from. Mirrored/half-width
 * katakana + digits + a few line symbols — the same character family the
 * films' digital rain uses (Simon Whiteley's original glyphs were sourced
 * from a Japanese cookbook, then mirrored). Kept roughly uniform in ink
 * weight: brightness is carried by the effect's per-cell luminance multiplier,
 * NOT by glyph identity, so the pool can churn freely without changing how
 * bright a cell reads.
 */
const GLYPHS = 'ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｶ0123456789ﾈｾ';

export const GLYPH_COUNT = GLYPHS.length;

/** Square atlas cell in px — matches the square on-screen code cells. */
const CELL = 48;

/**
 * A single-row texture atlas of the glyph pool, white ink on black (the effect
 * shader multiplies the sampled coverage by its own green tint + luminance).
 * `flipY=false` so texel-row 0 is the top of each drawn glyph; the shader
 * samples `1 - cellUV.y` to render upright on the y-up framebuffer.
 */
export function createGlyphAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * GLYPH_COUNT;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Bold monospace, sized to sit inside the cell with a little margin so
  // adjacent glyphs never bleed across the u-boundary when sampled.
  ctx.font = `700 ${Math.round(CELL * 0.78)}px "MS Gothic", "Yu Gothic", "Noto Sans JP", monospace`;

  for (let i = 0; i < GLYPH_COUNT; i++) {
    ctx.fillText(GLYPHS[i], i * CELL + CELL / 2, CELL / 2 + 1);
  }

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
