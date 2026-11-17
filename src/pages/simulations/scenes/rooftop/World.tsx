import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AlwaysDepth,
  BackSide,
  BufferAttribute,
  Color,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three';
import { getGLTF, getTexture, preloadGLTF, preloadTexture } from '../../engine3d/assets';
import { RendererLook } from '../../engine3d/RendererLook';
import type { Collider2D, Platform } from '../../engine3d/store';
import layout from './layout.json';
import sceneUrl from './assets/rooftop.glb?url';
import lightmapUrl from './assets/rooftop_lm.webp?url';
import skyUrl from './assets/rooftop_sky.webp?url';

export const preloadWorld = () =>
  Promise.all([preloadGLTF(sceneUrl), preloadTexture(lightmapUrl), preloadTexture(skyUrl)]);

/** Generated with the scene (walls, parapets, plant, neighbouring roofs, the street). */
export const PLATFORMS = layout.platforms as Platform[];
export const COLLIDERS = layout.colliders as Collider2D[];
export const MORPHEUS_AT = layout.morpheus as [number, number, number];
export const BOX_AT = layout.box as [number, number, number];

/**
 * The daylight on both roofs is baked: the lightmap and the lit atlases store
 * radiance divided by this range.
 */
const LIGHT_RANGE = layout.lightmap.range;
const EXPOSURE = 0.78;
/** The horizon haze everything distant dissolves into (matches the sky panorama). */
const HAZE = '#bed2c1';
/** Roofs (near) keep the stock fog at this density; the city uses the haze below. */
const HAZE_DENSITY = 0.0004;
/** Distance haze of the backdrop: 1 - exp(-distance * k). Thick air: half gone at 1 km, the horizon all haze. */
const HAZE_K = 0.00066;
const HAZE_CHUNK = /* glsl */ `
#ifdef USE_FOG
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1.0 - exp(-vFogDepth * ${HAZE_K.toFixed(6)}));
#endif
`;
export const FAR = 12000;

const LIGHTMAPPED = ['Deck', 'Render', 'Concrete', 'Coping'];
const LIT_ATLAS = ['Props', 'Morpheus'];

interface WorldParts {
  root: Object3D;
  sky: Texture;
  street: Texture | null;
}

function prepareWorld(maxAnisotropy: number): WorldParts | null {
  const gltf = getGLTF(sceneUrl);
  const lightmap = getTexture(lightmapUrl);
  const sky = getTexture(skyUrl);
  if (!gltf || !lightmap || !sky) return null;
  const mesh = (name: string) => gltf.scene.getObjectByName(name) as Mesh | undefined;
  const streetMap = () => (mesh('Street')?.material as MeshBasicMaterial | undefined)?.map ?? null;
  if (gltf.scene.userData.rooftopReady) return { root: gltf.scene, sky, street: streetMap() };

  lightmap.channel = 1;
  lightmap.generateMipmaps = false;
  lightmap.minFilter = LinearFilter;
  lightmap.needsUpdate = true;
  sky.wrapS = RepeatWrapping;
  sky.generateMipmaps = false;
  sky.minFilter = LinearFilter;
  sky.needsUpdate = true;

  for (const name of LIGHTMAPPED) {
    const m = mesh(name)?.material as MeshStandardMaterial | undefined;
    if (!m) continue;
    m.lightMap = lightmap;
    m.lightMapIntensity = LIGHT_RANGE * Math.PI;
    m.envMapIntensity = 0;
    if (m.map) m.map.anisotropy = maxAnisotropy;
    m.needsUpdate = true;
  }
  // Props and the figure carry their own baked daylight: the atlas goes out as emission.
  for (const name of LIT_ATLAS) {
    const m = mesh(name)?.material as MeshStandardMaterial | undefined;
    if (!m) continue;
    m.emissiveMap = m.map;
    m.emissive = new Color(1, 1, 1);
    m.emissiveIntensity = LIGHT_RANGE;
    m.map = null;
    m.color = new Color(0, 0, 0);
    m.envMapIntensity = 0;
    m.needsUpdate = true;
  }
  // The city is a painted backdrop: texture x baked shade, dissolved by the haze.
  gltf.scene.traverse((node) => {
    const m = node as Mesh;
    if (!m.isMesh || LIGHTMAPPED.includes(m.name) || LIT_ATLAS.includes(m.name)) return;
    const baked = m.material as MeshStandardMaterial;
    // The ground tile repeats to the horizon: low anisotropy lets it blur into an even tone far off.
    if (baked.map) baked.map.anisotropy = m.name === 'Ground' ? 1 : maxAnisotropy;
    const flat = new MeshBasicMaterial({ map: baked.map, vertexColors: true, toneMapped: false });
    flat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', HAZE_CHUNK);
    };
    flat.customProgramCacheKey = () => 'rooftop-haze';
    m.material = flat;
    m.frustumCulled = false;
  });
  gltf.scene.userData.rooftopReady = true;
  return { root: gltf.scene, sky, street: streetMap() };
}

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const SKY_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    // The panorama's centre column is the jump direction (-Z); east (+X) is to its right.
    float u = atan(d.x, -d.z) / 6.2831853 + 0.5;
    float v = 0.5 - asin(clamp(d.y, -1.0, 1.0)) / 3.1415927;
    gl_FragColor = texture2D(map, vec2(u, v));
    #include <colorspace_fragment>
  }
`;

/** The hazy sky: a panorama on a dome that travels with the camera. */
function Sky({ map }: { map: Texture }) {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { map: { value: map } },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [map],
  );
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[50, 32, 16]} />
    </mesh>
  );
}

export interface DentCtl {
  /** Where the street gives (three x, z) and how deep at the centre right now (m, negative bulges up). */
  x: number;
  z: number;
  depth: number;
  active: boolean;
}

const DENT_SIZE = 16;
const DENT_SEGMENTS = 48;
const DENT_SIGMA = 1.7;

/**
 * The street that gives like rubber: a patch of the canyon street, redrawn
 * over the flat one with a bowl pressed into it while `ctl.active`.
 */
export function StreetDent({ ctl, map }: { ctl: DentCtl; map: Texture | null }) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(DENT_SIZE, DENT_SIZE, DENT_SEGMENTS, DENT_SEGMENTS);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const material = useMemo(
    () => new MeshBasicMaterial({ map, toneMapped: false, depthFunc: AlwaysDepth }),
    [map],
  );
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.visible = ctl.active;
    if (!ctl.active) return;
    mesh.position.set(ctl.x, layout.street + 0.08, ctl.z);
    const pos = geometry.attributes.position as BufferAttribute;
    const uv = geometry.attributes.uv as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const r2 = lx * lx + lz * lz;
      const edge = Math.max(0, 1 - Math.sqrt(r2) / (DENT_SIZE / 2));
      pos.setY(i, -ctl.depth * Math.exp(-r2 / (2 * DENT_SIGMA * DENT_SIGMA)) * Math.min(1, edge * 4));
      // Same mapping as the street strip in the scene file: u across the canyon, v along it.
      uv.setXY(i, -(ctl.z + lz) / layout.gap, 1 - (ctl.x + lx) / 16);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
  });
  return <mesh ref={ref} geometry={geometry} material={material} renderOrder={5} visible={false} frustumCulled={false} />;
}

/** Both roofs, the canyon and the city to the horizon, under the hazy sky. */
export function RooftopWorld({ dent }: { dent: DentCtl }) {
  const gl = useThree((state) => state.gl);
  const world = useMemo(() => prepareWorld(gl.capabilities.getMaxAnisotropy()), [gl]);
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.far = FAR;
    camera.updateProjectionMatrix();
  }, [camera]);
  return (
    <>
      <RendererLook exposure={EXPOSURE} />
      <color attach="background" args={[HAZE]} />
      <fogExp2 attach="fog" args={[HAZE, HAZE_DENSITY]} />
      {world && (
        <>
          <Sky map={world.sky} />
          <primitive object={world.root} />
          <StreetDent ctl={dent} map={world.street} />
        </>
      )}
    </>
  );
}
