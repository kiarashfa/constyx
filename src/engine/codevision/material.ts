import { ShaderMaterial, Vector2, type IUniform, type Texture } from 'three';
import { createGlyphAtlas } from './glyphAtlas';
import { CODE_VISION_FRAG, CODE_VISION_VERT } from './glsl';

export interface CodeVisionUniforms {
  uSource: IUniform<Texture | null>;
  uGlyphs: IUniform<Texture>;
  uRes: IUniform<Vector2>;
  uTime: IUniform<number>;
  uMix: IUniform<number>;
  uSrcMul: IUniform<Vector2>;
  uSrcAdd: IUniform<Vector2>;
  uCell: IUniform<number>;
  /** DEV signal viewer: 0 off, 1 raw luma, 2 edges, 3 pre-glyph brightness. */
  uDebug: IUniform<number>;
}

export interface CodeVisionMaterial {
  material: ShaderMaterial;
  uniforms: CodeVisionUniforms;
  /** The glyph atlas — dispose it alongside the material. */
  glyphs: Texture;
  dispose: () => void;
}

/**
 * Build the shared code-vision post material + its glyph atlas. Every consumer
 * (webcam section, Focus overlay, Locations overlay) uses this exact material;
 * they only differ in what they feed `uSource` and how they set the
 * cover/mirror transform (`uSrcMul`/`uSrcAdd`).
 *
 * Built imperatively (not via r3f's `uniforms` prop) for the same reason
 * RaymarchQuad is: r3f shallow-clones the uniforms prop, which silently
 * disconnects scalar `.value =` writes.
 */
export function createCodeVisionMaterial(cell = 8): CodeVisionMaterial {
  const glyphs = createGlyphAtlas();
  const uniforms: CodeVisionUniforms = {
    uSource: { value: null },
    uGlyphs: { value: glyphs },
    uRes: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uMix: { value: 0 },
    uSrcMul: { value: new Vector2(1, 1) },
    uSrcAdd: { value: new Vector2(0, 0) },
    uCell: { value: cell },
    uDebug: { value: 0 },
  };
  const material = new ShaderMaterial({
    vertexShader: CODE_VISION_VERT,
    fragmentShader: CODE_VISION_FRAG,
    uniforms: uniforms as unknown as Record<string, IUniform>,
    depthTest: false,
    depthWrite: false,
  });
  return {
    material,
    uniforms,
    glyphs,
    dispose: () => {
      material.dispose();
      glyphs.dispose();
    },
  };
}

/**
 * Cover-fit + horizontal-mirror UV transform for a source of `srcW x srcH`
 * shown on a `dstW x dstH` viewport, written into `mul`/`add` so the shader's
 * `toSrc(uv) = uv*mul + add` centres and crops the source like CSS
 * `object-fit: cover`, mirrored in x (selfie view). Pass `mirror=false` for a
 * plain cover fit.
 */
export function coverMirrorTransform(
  mul: Vector2,
  add: Vector2,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  mirror = true,
): void {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) {
    mul.set(mirror ? -1 : 1, 1);
    add.set(mirror ? 1 : 0, 0);
    return;
  }
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  let sx = 1;
  let sy = 1;
  if (srcAspect > dstAspect) {
    sx = dstAspect / srcAspect; // crop the sides
  } else {
    sy = srcAspect / dstAspect; // crop top/bottom
  }
  if (mirror) {
    mul.set(-sx, sy);
    add.set(0.5 * sx + 0.5, 0.5 * (1 - sy));
  } else {
    mul.set(sx, sy);
    add.set(0.5 * (1 - sx), 0.5 * (1 - sy));
  }
}
