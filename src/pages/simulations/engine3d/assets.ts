import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Scene asset loading. Scenes ship one meshopt-compressed .glb (WebP
 * textures, baked maps) imported with `?url`, and export a `preload()` that
 * the scene route awaits behind the jack-in transition, so the scene never
 * mounts half-loaded. Loaded files are cached for the session.
 */
const pending = new Map<string, Promise<GLTF>>();
const loaded = new Map<string, GLTF>();

let loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!loader) {
    loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
}

/** Start (or join) the download + parse of a scene file. */
export function preloadGLTF(url: string): Promise<GLTF> {
  let job = pending.get(url);
  if (!job) {
    job = getLoader()
      .loadAsync(url)
      .then((gltf) => {
        loaded.set(url, gltf);
        return gltf;
      });
    job.catch(() => pending.delete(url));
    pending.set(url, job);
  }
  return job;
}

/** The parsed scene file, or null if `preloadGLTF` has not finished for it. */
export function getGLTF(url: string): GLTF | null {
  return loaded.get(url) ?? null;
}
