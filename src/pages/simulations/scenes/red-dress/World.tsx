import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  MeshBasicMaterial,
  RepeatWrapping,
  ShaderMaterial,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three';
import { getGLTF, getTexture, preloadGLTF, preloadTexture } from '../../engine3d/assets';
import { RendererLook } from '../../engine3d/RendererLook';
import type { Collider2D, Platform } from '../../engine3d/store';
import layout from './layout.json';
import sceneUrl from './assets/street.glb?url';
import lightmapUrl from './assets/street_lm.webp?url';

export const preloadWorld = () => Promise.all([preloadGLTF(sceneUrl), preloadTexture(lightmapUrl)]);

/** Generated with the scene (buildings, columns, the fountain, stairs, cars, street furniture). */
export const PLATFORMS = layout.platforms as Platform[];
export const COLLIDERS = layout.colliders as Collider2D[];
export const SPAWN = layout.spawn as [number, number, number];

/** The overcast light is baked: lightmap and lit atlases store radiance divided by this range. */
const LIGHT_RANGE = layout.lightmap.range;
export const EXPOSURE = 1.5;
/** The haze the street canyon dissolves into; the sky is the same tone, brighter overhead. */
export const HAZE = '#c3d2c4';
const SKY_TOP = '#e9f2e8';
export const HAZE_DENSITY = 0.0052;
export const FAR = 700;

const LIGHTMAPPED = ['Paving', 'Asphalt', 'Paint', 'Granite', 'Rustic', 'Stone'];
/** Cascade and pool: unlit, their textures slide. Metres per second along v. */
const FLOW: Record<string, number> = { Water: 0.55, Pool: 0.05 };
const WATER_GAIN: Record<string, number> = { Water: 1.15, Pool: 1.0 };

interface WorldParts {
  root: Object3D;
  flowing: { map: Texture; speed: number }[];
  lampRed: Mesh | undefined;
  lampGreen: Mesh | undefined;
}

/** Pedestrian signal symbol, white on black (the lamp's vertex colour tints it): a standing or a walking figure. */
function signalSymbol(walking: boolean): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.beginPath();
  g.arc(32, 12, 5.5, 0, Math.PI * 2);
  g.fill();
  const limb = (pts: number[], w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  };
  if (walking) {
    limb([31, 20, 29, 38], 8);
    limb([30, 24, 22, 34], 4.5);
    limb([31, 24, 40, 31], 4.5);
    limb([29, 37, 22, 48, 18, 58], 5.5);
    limb([29, 37, 36, 47, 42, 57], 5.5);
  } else {
    limb([32, 20, 32, 38], 11);
    limb([25, 22, 23, 39], 4.5);
    limb([39, 22, 41, 39], 4.5);
    limb([28.5, 37, 28, 58], 5.5);
    limb([35.5, 37, 36, 58], 5.5);
  }
  const t = new CanvasTexture(c);
  t.flipY = false;
  return t;
}

function prepareWorld(maxAnisotropy: number): WorldParts | null {
  const gltf = getGLTF(sceneUrl);
  const lightmap = getTexture(lightmapUrl);
  if (!gltf || !lightmap) return null;
  const cached = gltf.scene.userData.streetParts as WorldParts | undefined;
  if (cached) return cached;

  lightmap.channel = 1;
  lightmap.generateMipmaps = false;
  lightmap.minFilter = LinearFilter;
  lightmap.needsUpdate = true;

  const flowing: WorldParts['flowing'] = [];
  const done = new Set<Material>();
  let lampRed: Mesh | undefined;
  let lampGreen: Mesh | undefined;
  gltf.scene.traverse((node) => {
    const m = node as Mesh;
    if (!m.isMesh) return;
    const baked = m.material as MeshStandardMaterial;
    if (LIGHTMAPPED.includes(m.name)) {
      baked.lightMap = lightmap;
      baked.lightMapIntensity = LIGHT_RANGE * Math.PI;
      baked.envMapIntensity = 0;
      if (baked.map) baked.map.anisotropy = maxAnisotropy;
      baked.needsUpdate = true;
      return;
    }
    if (m.name === 'Props' || m.name.startsWith('Car_')) {
      // Props and cars carry their own baked daylight: the atlas goes out as emission.
      if (done.has(baked)) return;
      done.add(baked);
      baked.emissiveMap = baked.map;
      baked.emissive = new Color(1, 1, 1);
      baked.emissiveIntensity = LIGHT_RANGE;
      baked.map = null;
      baked.color = new Color(0, 0, 0);
      baked.envMapIntensity = 0;
      baked.needsUpdate = true;
      return;
    }
    if (m.name === 'LampRed' || m.name === 'LampGreen') {
      m.material = new MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false, map: signalSymbol(m.name === 'LampGreen') });
      if (m.name === 'LampRed') lampRed = m;
      else lampGreen = m;
      return;
    }
    // Everything else is a painted backdrop: texture x baked shade, dissolved by the haze.
    const map = baked.map;
    if (map) map.anisotropy = maxAnisotropy;
    const flat = new MeshBasicMaterial({ map, vertexColors: true, toneMapped: true });
    if (m.name in FLOW && map) {
      map.wrapS = map.wrapT = RepeatWrapping;
      flat.color = new Color().setScalar(WATER_GAIN[m.name] * 0.62);
      flowing.push({ map, speed: FLOW[m.name] });
    } else {
      // Backdrop albedo was painted as it should appear: scale it to sit with the lit ground.
      flat.color = new Color().setScalar(0.62);
    }
    if (m.name === 'Leaves') {
      flat.alphaTest = 0.5;
      flat.side = DoubleSide;
    }
    if (m.name === 'Water' || m.name === 'Pool' || m.name === 'Flat' || m.name === 'Bark') flat.side = DoubleSide;
    m.material = flat;
    m.frustumCulled = false;
  });
  const parts: WorldParts = { root: gltf.scene, flowing, lampRed, lampGreen };
  gltf.scene.userData.streetParts = parts;
  return parts;
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
  uniform vec3 top;
  uniform vec3 horizon;
  varying vec3 vDir;
  void main() {
    float h = clamp(normalize(vDir).y, 0.0, 1.0);
    gl_FragColor = vec4(mix(horizon, top, pow(h, 0.45)), 1.0);
    #include <colorspace_fragment>
  }
`;

/** Flat overcast sky: the haze at the horizon, brighter overhead. */
function Sky() {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { top: { value: new Color(SKY_TOP) }, horizon: { value: new Color(HAZE) } },
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[50, 24, 12]} />
    </mesh>
  );
}

/**
 * The street, the plaza and the fountain. `walk` switches the pedestrian
 * signals from the red standing man to the green walking man; `frozen` stops
 * the water with everything else.
 */
export function StreetWorld({ walk, frozen }: { walk: boolean; frozen: boolean }) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const world = useMemo(() => prepareWorld(gl.capabilities.getMaxAnisotropy()), [gl]);
  useLayoutEffect(() => {
    camera.far = FAR;
    camera.updateProjectionMatrix();
  }, [camera]);
  useFrame((_, dt) => {
    if (!world) return;
    if (world.lampRed) world.lampRed.visible = !walk;
    if (world.lampGreen) world.lampGreen.visible = walk;
    if (frozen) return;
    for (const f of world.flowing) f.map.offset.y = (f.map.offset.y + (Math.min(dt, 0.05) * f.speed) / 2.6) % 1;
  });
  return (
    <>
      <RendererLook exposure={EXPOSURE} />
      <color attach="background" args={[HAZE]} />
      <fogExp2 attach="fog" args={[HAZE, HAZE_DENSITY]} />
      <Sky />
      {world && <primitive object={world.root} />}
    </>
  );
}
