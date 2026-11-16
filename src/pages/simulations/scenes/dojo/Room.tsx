import { useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  EquirectangularReflectionMapping,
  Euler,
  LinearFilter,
  MeshBasicMaterial,
  ShaderChunk,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three';
import { getGLTF, getTexture, preloadGLTF, preloadTexture } from '../../engine3d/assets';
import { RendererLook } from '../../engine3d/RendererLook';
import type { Collider2D, Platform } from '../../engine3d/store';
import sceneUrl from './assets/dojo.glb?url';
import lightmapUrl from './assets/dojo_lm.webp?url';
import envUrl from './assets/dojo_env.webp?url';

export const preloadRoom = () =>
  Promise.all([preloadGLTF(sceneUrl), preloadTexture(lightmapUrl), preloadTexture(envUrl)]);

/**
 * The light in the hall is baked: the lightmap, the lit prop atlas and the
 * panorama all store radiance divided by this range. `PAPER_RANGE` is the
 * same idea for the glow of the paper screens (vertex colour x range).
 */
export const LIGHT_RANGE = 4;
const PAPER_RANGE = 6;
const EXPOSURE = 1.25;
const BACKDROP = '#0d0906';
/** A little warm haze gives the tall room its depth. */
const HAZE = '#4a3a28';

export const ROOM_PLATFORMS: Platform[] = [{ minX: -7, maxX: 7, minZ: -5.5, maxZ: 5.5, y: 0 }];

/** Pillars around the court that carry the galleries (x, z). */
const PILLARS: [number, number][] = [
  [-5.4, 1.833],
  [-5.4, -1.833],
  [-5.4, -3.9],
  [5.4, 1.833],
  [5.4, -1.833],
  [5.4, -3.9],
  [-2.333, -3.9],
  [2.333, -3.9],
];

/** Walls, the alcove platform, the staff rack and the pillars (from the scene layout). */
export const ROOM_COLLIDERS: Collider2D[] = [
  { minX: -7.6, maxX: -6.72, minZ: -5.8, maxZ: 5.8 },
  { minX: 6.72, maxX: 7.6, minZ: -5.8, maxZ: 5.8 },
  { minX: -7.6, maxX: 7.6, minZ: -6.1, maxZ: -5.22 },
  { minX: -7.6, maxX: 7.6, minZ: 5.22, maxZ: 6.1 },
  { minX: -2.5, maxX: 2.5, minZ: -5.5, maxZ: -4.85 },
  { minX: 3.9, maxX: 5.4, minZ: -5.5, maxZ: -4.8 },
  ...PILLARS.map(([x, z]) => ({ minX: x - 0.2, maxX: x + 0.2, minZ: z - 0.2, maxZ: z + 0.2 })),
];

/**
 * Lightmapped surfaces take their diffuse light from the bake alone; the
 * panorama still supplies their reflections.
 */
const LIGHTMAP_CHUNK = ShaderChunk.lights_fragment_maps.replace(
  'iblIrradiance += getIBLIrradiance( geometryNormal );',
  '',
);

function applyLightmap(material: MeshStandardMaterial, lightmap: Texture, reflections: number) {
  material.lightMap = lightmap;
  material.lightMapIntensity = LIGHT_RANGE * Math.PI;
  material.envMapIntensity = reflections;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', LIGHTMAP_CHUNK);
  };
  material.customProgramCacheKey = () => 'dojo-lightmapped';
  material.needsUpdate = true;
}

interface RoomParts {
  root: Object3D;
  env: Texture;
}

function prepareRoom(): RoomParts | null {
  const gltf = getGLTF(sceneUrl);
  const lightmap = getTexture(lightmapUrl);
  const env = getTexture(envUrl);
  if (!gltf || !lightmap || !env) return null;
  if (gltf.scene.userData.dojoReady) return { root: gltf.scene, env };

  lightmap.channel = 1;
  lightmap.generateMipmaps = false;
  lightmap.minFilter = LinearFilter;
  lightmap.needsUpdate = true;
  env.mapping = EquirectangularReflectionMapping;

  const mesh = (name: string) => gltf.scene.getObjectByName(name) as Mesh | undefined;
  const reflections: Record<string, number> = { Wood: 0.22, Tatami: 0.4, Reed: 0.4, Plaster: 0.15 };
  for (const [name, amount] of Object.entries(reflections)) {
    const m = mesh(name);
    if (m) applyLightmap(m.material as MeshStandardMaterial, lightmap, amount);
  }
  // Keep the boards satin: a mirror-sharp floor would glare under the screens.
  const wood = mesh('Wood');
  if (wood) (wood.material as MeshStandardMaterial).roughness = 1.7;

  // Paper screens are the light source: unlit, texture x vertex colour x range.
  const paper = mesh('Paper');
  if (paper) {
    const baked = paper.material as MeshStandardMaterial;
    paper.material = new MeshBasicMaterial({
      map: baked.map,
      vertexColors: true,
      color: new Color(PAPER_RANGE, PAPER_RANGE, PAPER_RANGE),
    });
  }

  // Props carry their own baked light: the atlas goes out as emission and the
  // surface keeps only its reflections.
  const props = mesh('Props');
  if (props) {
    const m = props.material as MeshStandardMaterial;
    m.emissiveMap = m.map;
    m.emissive = new Color(1, 1, 1);
    m.emissiveIntensity = LIGHT_RANGE;
    m.map = null;
    m.color = new Color(0, 0, 0);
    m.envMapIntensity = 0.8;
    m.needsUpdate = true;
  }
  gltf.scene.userData.dojoReady = true;
  return { root: gltf.scene, env };
}

/** North is the centre column of the panorama; in the scene it is -Z. */
const ENV_ROTATION = new Euler(0, -Math.PI / 2, 0);

function RoomLight({ env }: { env: Texture }) {
  const scene = useThree((state) => state.scene);
  useLayoutEffect(() => {
    const previous = {
      environment: scene.environment,
      intensity: scene.environmentIntensity,
      rotation: scene.environmentRotation.clone(),
    };
    scene.environment = env;
    scene.environmentIntensity = LIGHT_RANGE;
    scene.environmentRotation.copy(ENV_ROTATION);
    return () => {
      scene.environment = previous.environment;
      scene.environmentIntensity = previous.intensity;
      scene.environmentRotation.copy(previous.rotation);
    };
  }, [scene, env]);
  return null;
}

/** Sunlight direction: down the room from the upper west screens at 45 degrees (matches the bake). */
const SUN: [number, number, number] = [0.704, -0.704, -0.106];
/** The sunlit screens: three bays (z ranges) by two storeys (y ranges) on the west wall. */
const SUN_BAYS: [number, number][] = [
  [-5.36, -1.973],
  [-1.693, 1.693],
  [1.973, 5.36],
];
const SUN_STOREYS: [number, number][] = [
  [4.6, 5.8],
  [5.95, 7.5],
];

/**
 * Light shafts in the haze: each sunlit screen is swept along the sun
 * direction down to the mats, drawn additively and fading with distance.
 */
function buildShafts(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const x0 = -6.9;
  const near = 0.013;
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: number, cb: number) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (const k of [ca, cb, cb, ca, cb, ca]) colors.push(k, k * 0.93, k * 0.82);
  };
  for (const [z0, z1] of SUN_BAYS) {
    for (const [y0, y1] of SUN_STOREYS) {
      const corners = [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ];
      const far = corners.map(([x, y, z]) => {
        const t = y / -SUN[1];
        return [x + SUN[0] * t, 0.02, z + SUN[2] * t];
      });
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        quad(corners[i], corners[j], far[j], far[i], near, near * 0.25);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function LightShafts() {
  const geometry = useMemo(buildShafts, []);
  return (
    <mesh geometry={geometry} renderOrder={2} frustumCulled={false}>
      <meshBasicMaterial
        vertexColors
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        side={DoubleSide}
        fog={false}
      />
    </mesh>
  );
}

/** The sparring hall: timber frame, tatami, paper screens, alcove, gallery. */
export function DojoRoom() {
  const room = useMemo(prepareRoom, []);
  return (
    <>
      <RendererLook exposure={EXPOSURE} />
      <color attach="background" args={[BACKDROP]} />
      <fogExp2 attach="fog" args={[HAZE, 0.011]} />
      {room && (
        <>
          <RoomLight env={room.env} />
          <primitive object={room.root} />
          <LightShafts />
        </>
      )}
    </>
  );
}
