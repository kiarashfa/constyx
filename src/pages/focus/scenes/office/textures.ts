import {
  DataTexture,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  Texture,
  TextureLoader,
  type IUniform,
} from 'three';
import fabricUrl from './textures/partition_fabric.jpg';
import deskUrl from './textures/desk_veneer.jpg';
import carpetUrl from './textures/office_carpet.jpg';

/**
 * Real CC0 photo-texture pipeline for the raymarched Focus scenes (round 15).
 *
 * WHY: the Focus scenes are Shadertoy-style raymarched SDF fragment shaders on
 * a full-screen quad (`RaymarchQuad`), so "using a real texture" means feeding
 * it in as a `sampler2D` uniform and sampling it in the fragment shader from a
 * hit's surface coordinate. This module is the reusable half of that pattern;
 * the shader half is the `srgbTex(...)` sampler + per-id UV in `shader.ts`.
 *
 * The three textures are Poly Haven CC0 diffuse maps, downsized to 512² JPG:
 *   - partition_fabric.jpg  poly_wool_herringbone  (grey office-panel weave)
 *   - desk_veneer.jpg       oak_veneer_01          ('90s desk laminate)
 *   - office_carpet.jpg     dirty_carpet           (worn commercial loop pile)
 *
 * COLOUR SPACE: RaymarchQuad's ShaderMaterial does its own gamma at the end
 * (`pow(col, .4545)`) and three does NOT inject a colour-management decode for
 * raw ShaderMaterials, so we upload the JPEG bytes untouched (`NoColorSpace`,
 * no hardware sRGB decode) and linearise in the shader (`srgbTex`). That keeps
 * the sampled albedo in the same linear working space as the hand-authored
 * material colours.
 *
 * ASYNC: `TextureLoader` is async, but a `sampler2D` uniform must never be null
 * or WebGL warns and samples black — so each uniform starts on a 1×1 mid-grey
 * `DataTexture` placeholder and is swapped to the real texture on load. The
 * swap reaches the GPU because `RaymarchQuad` builds its material imperatively
 * and holds these exact uniform objects (see its landmine note); reassigning
 * `.value` on a texture uniform re-binds next frame.
 */

function placeholder(v = 128): DataTexture {
  const tex = new DataTexture(new Uint8Array([v, v, v, 255]), 1, 1, RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export interface OfficeTextures {
  fabric: IUniform<Texture>;
  desk: IUniform<Texture>;
  carpet: IUniform<Texture>;
  /** Free every GPU texture this set owns (placeholders + loaded maps). */
  dispose: () => void;
}

/** Load the office's three photo textures into swap-on-load sampler uniforms. */
export function loadOfficeTextures(): OfficeTextures {
  const loader = new TextureLoader();
  const owned = new Set<Texture>();

  const slot = (url: string): IUniform<Texture> => {
    const ph = placeholder();
    owned.add(ph);
    const uniform: IUniform<Texture> = { value: ph };
    loader.load(url, (tex) => {
      tex.wrapS = tex.wrapT = RepeatWrapping;
      tex.colorSpace = NoColorSpace; // sampled raw; linearised in the shader.
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      owned.delete(ph);
      ph.dispose();
      owned.add(tex);
      uniform.value = tex;
    });
    return uniform;
  };

  return {
    fabric: slot(fabricUrl),
    desk: slot(deskUrl),
    carpet: slot(carpetUrl),
    dispose: () => {
      owned.forEach((t) => t.dispose());
      owned.clear();
    },
  };
}
