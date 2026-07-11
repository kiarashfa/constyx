import { GLYPH_COUNT } from './glyphAtlas';

/**
 * Full-screen NDC quad — identical to RaymarchQuad's vertex stage. The quad
 * bypasses the camera transform; the effect works purely in screen space.
 */
export const CODE_VISION_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * The shared "seeing the code" fragment shader. ONE shader serves every
 * consumer — the standalone webcam section, the Focus Mode overlay, and the
 * Locations overlay — because the only thing that differs is what feeds
 * `uSource` (a camera VideoTexture, or a scene's captured frame) plus the
 * `uSrcMul`/`uSrcAdd` cover/mirror transform.
 *
 * LEGIBILITY IS THE PRIMARY GOAL (round-14 clarity pass). The effect must
 * read as *the actual scene, rendered in code* — you should be able to tell
 * "that's a teapot on a table" through it, not just "green texture". The
 * living-code motion serves that, it does not compete with it. To keep the
 * underlying image readable:
 *
 *   - The per-cell brightness tracks the source luminance directly, with a
 *     local-contrast (unsharp) boost so mid-tones separate and a gentle
 *     shadow lift so dark detail survives. It is NOT gated by the rain wave.
 *   - Edges (central-difference across neighbouring cells) add a bright rim,
 *     because boundaries are what let the eye parse shape.
 *   - The falling-code wave is a small ADDITIVE shimmer, image-proportional,
 *     so a static object keeps a stable brightness instead of blinking as the
 *     wave sweeps past.
 *   - Glyph identity churns SLOWLY (a constant ~1Hz), so a form can be parsed
 *     before the pattern shifts; a base cell-fill keeps a bright cell reading
 *     as continuous tone rather than depending on which glyph is up.
 *
 * `uMix` cross-fades raw source → effect (0..1) for smooth toggling.
 * `uDebug` (DEV) swaps the output for an intermediate signal: 1 = raw luma,
 * 2 = edge signal, 3 = the pre-glyph brightness field.
 */
export const CODE_VISION_FRAG = /* glsl */ `
uniform sampler2D uSource; // scene/camera frame (screen-space via uSrcMul/Add)
uniform sampler2D uGlyphs; // single-row glyph atlas, white ink on black
uniform vec2 uRes;         // drawing-buffer size in device px
uniform float uTime;       // effect clock (seconds)
uniform float uMix;        // 0 = raw source, 1 = full effect
uniform vec2 uSrcMul;      // source-UV scale  (mirror/cover)
uniform vec2 uSrcAdd;      // source-UV offset (mirror/cover)
uniform float uCell;       // cell size in device px
uniform float uDebug;      // DEV signal viewer (0 = off)

#define GLYPH_COUNT ${GLYPH_COUNT}.0

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Screen UV -> source UV (applies the cover-fit + mirror transform).
vec2 toSrc(vec2 uv) { return uv * uSrcMul + uSrcAdd; }

float srcLuma(vec2 uv) { return luma(texture2D(uSource, toSrc(uv)).rgb); }

// Sample one glyph's coverage from the single-row atlas. Atlas is drawn
// flipY=false, so flip v to render upright on the y-up framebuffer.
float glyphInk(float index, vec2 cellUV) {
  cellUV = clamp(cellUV, 0.04, 0.96);
  float u = (index + cellUV.x) / GLYPH_COUNT;
  return texture2D(uGlyphs, vec2(u, 1.0 - cellUV.y)).r;
}

vec3 codeVision(vec2 fragCoord) {
  vec2 res = uRes;
  float cell = max(uCell, 4.0);
  vec2 cellId = floor(fragCoord / cell);
  vec2 cellUV = fract(fragCoord / cell);
  vec2 grid = res / cell;
  vec2 px = cell / res; // one cell step in source-UV space

  vec2 centre = (cellId + 0.5) * px;

  // Box-average the whole cell footprint (4x4 taps spanning the cell) so
  // features thinner than a cell — e.g. the tea-house window muntins — are
  // captured CONSISTENTLY instead of aliasing in and out with sub-cell
  // alignment as the camera moves. A single centre tap (round-15) only saw a
  // thin muntin when it happened to fall under the cell centre, so grid lines
  // flickered and whole segments dropped out; the box filter darkens every
  // cell a muntin passes through, stably, and anti-aliases the source too.
  float Lbox = 0.0;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 f = (vec2(float(i), float(j)) - 1.5) / 3.0; // -0.5 .. 0.5 of a cell
      Lbox += srcLuma(centre + f * px);
    }
  }
  Lbox *= 1.0 / 16.0;

  // Local background from the four neighbouring cells — the unsharp / edge
  // reference.
  float lR = srcLuma(centre + vec2(px.x, 0.0));
  float lL = srcLuma(centre - vec2(px.x, 0.0));
  float lU = srcLuma(centre + vec2(0.0, px.y));
  float lD = srcLuma(centre - vec2(0.0, px.y));
  float wide = (lR + lL + lU + lD) * 0.25;

  // Local contrast (unsharp): lift this cell away from its surround so form and
  // mid-tone shading separate regardless of the scene's overall brightness —
  // legible in both dark and bright scenes without a global curve. The same
  // signal rims boundaries.
  float detail = Lbox - wide;
  float sharp = clamp(Lbox + detail * 1.5, 0.0, 1.0);
  float Lc = pow(sharp, 0.8); // gentle shadow lift; keeps highlights
  float edge = clamp(abs(detail) * 3.2, 0.0, 1.0);

  // Falling-code wave: one head per column, top -> bottom. ADDITIVE and
  // image-proportional so it never darkens the underlying scene.
  float col = cellId.x;
  float rowFromTop = grid.y - (cellId.y + 0.5); // fragCoord.y is bottom-origin
  float speed = 3.0 + 5.0 * hash11(col * 1.7 + 11.0);
  float head = fract(uTime * speed * 0.09 + hash11(col) * 7.0) * (grid.y + 10.0);
  float d = head - rowFromTop;
  float glow = exp(-abs(d) * 0.5) + 0.28 * exp(-max(d, 0.0) * 0.08);
  glow = clamp(glow, 0.0, 1.5);

  // The brightness field the eye reads as the image. The edge rim is
  // MULTIPLICATIVE, not additive: it brightens the lit side of a boundary but
  // can't lift a dark cell, so dark lines (e.g. the window muntins) stay dark
  // and legible instead of being washed to mid-grey by their own edge.
  float lit = Lc * (1.0 + edge * 0.6);
  lit += glow * (0.04 + 0.22 * Lc);
  lit = clamp(lit, 0.0, 1.4);

  // Slow, constant-rate glyph churn (parse-friendly), per-cell phase offset so
  // cells don't all flip together.
  float churn = floor(uTime * 1.1 + hash21(cellId) * 6.2831);
  float gi = floor(hash21(cellId + churn * 1.37) * GLYPH_COUNT);
  gi = clamp(gi, 0.0, GLYPH_COUNT - 1.0);
  float ink = glyphInk(gi, cellUV);

  // Base cell-fill: bright cells glow a little even between glyph strokes, so
  // perceived brightness tracks the image rather than which glyph is showing.
  float cellFill = mix(0.16, 1.0, ink);

  vec3 green = vec3(0.20, 1.0, 0.38);
  vec3 hot = vec3(0.82, 1.0, 0.86);
  float headness = smoothstep(0.85, 1.4, glow);
  vec3 c = mix(green, hot, headness) * lit * cellFill;

  // ---- DEV signal viewer ----
  if (uDebug > 0.5 && uDebug < 1.5) return vec3(Lbox);
  if (uDebug > 1.5 && uDebug < 2.5) return vec3(edge);
  if (uDebug > 2.5) return green * lit;

  return c;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec3 eff = codeVision(fc);
  if (uDebug > 0.5) {
    gl_FragColor = vec4(eff, 1.0);
    return;
  }
  vec3 src = texture2D(uSource, toSrc(fc / uRes)).rgb;
  gl_FragColor = vec4(mix(src, eff, clamp(uMix, 0.0, 1.0)), 1.0);
}
`;
