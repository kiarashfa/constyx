import {
  DataTexture,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  Texture,
  TextureLoader,
  type IUniform,
} from 'three';
import asphaltUrl from './textures/wet_asphalt.jpg';
import concreteUrl from './textures/concrete.jpg';
import brickUrl from './textures/brick.jpg';

/**
 * Real CC0 photo textures for the Adams Street bridge scene, wired through the
 * same swap-on-load sampler pattern the office scene established (see
 * `office/textures.ts` and HANDOFF §2 for the full rationale):
 *
 *   - wet_asphalt.jpg  Poly Haven worn_asphalt        (the wet roadway)
 *   - concrete.jpg     Poly Haven concrete_wall_008   (board-formed viaduct arch)
 *   - brick.jpg        Poly Haven dark_brick_wall     (abutment / embankment walls)
 *
 * Each is a CC0 diffuse map, downsized to 512² JPG q82. They upload raw
 * (`NoColorSpace`, no hardware sRGB decode) and are linearised in the shader
 * (`srgbTex`), matching the raymarch material's own closing `pow(col,.4545)`.
 * A `sampler2D` must never be null, so each uniform starts on a 1×1 placeholder
 * and swaps to the loaded texture on load — the reassignment reaches the GPU
 * because RaymarchQuad holds these exact uniform objects.
 */

function placeholder(v = 90): DataTexture {
  const tex = new DataTexture(new Uint8Array([v, v, v, 255]), 1, 1, RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export interface BridgeTextures {
  asphalt: IUniform<Texture>;
  concrete: IUniform<Texture>;
  brick: IUniform<Texture>;
  /** Free every GPU texture this set owns (placeholders + loaded maps). */
  dispose: () => void;
}

/** Load the bridge's three photo textures into swap-on-load sampler uniforms. */
export function loadBridgeTextures(): BridgeTextures {
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
    asphalt: slot(asphaltUrl),
    concrete: slot(concreteUrl),
    brick: slot(brickUrl),
    dispose: () => {
      owned.forEach((t) => t.dispose());
      owned.clear();
    },
  };
}
