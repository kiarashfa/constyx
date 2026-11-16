import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  CanvasTexture,
  Color,
  MeshBasicMaterial,
  SRGBColorSpace,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { getGLTF, preloadGLTF } from '../../engine3d/assets';
import { useSceneStore, type Collider2D } from '../../engine3d/store';
import type { WeaponArchetype } from './types';
import sceneUrl from './assets/armory.glb?url';

/** The void: floor, horizon and sky are one colour, so the room has no edges. */
export const VOID_WHITE = '#eef2ee';

/** Awaited by the scene route behind the jack-in transition. */
export const preloadArmory = () => preloadGLTF(sceneUrl);

const ARCHETYPES: WeaponArchetype[] = [
  'pistol',
  'revolver',
  'smg',
  'rifle',
  'bullpup',
  'shotgun',
  'double',
  'lmg',
  'sniper',
];

interface ArmoryParts {
  rack: Object3D;
  terminal: Object3D;
  target: Object3D;
  guns: Partial<Record<WeaponArchetype, Object3D>>;
}

let parts: ArmoryParts | null = null;

/**
 * Pull the named props out of the scene file (once per session). Baked floor
 * shadows become unlit void-coloured decals so they melt into the floor.
 */
export function getArmoryParts(): ArmoryParts | null {
  if (parts) return parts;
  const gltf = getGLTF(sceneUrl);
  if (!gltf) return null;
  const find = (name: string) => gltf.scene.getObjectByName(name);
  const rack = find('Rack');
  const terminal = find('Terminal');
  const target = find('Target');
  if (!rack || !terminal || !target) return null;

  gltf.scene.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.name.endsWith('_Shadow')) return;
    const baked = mesh.material as MeshStandardMaterial;
    mesh.material = new MeshBasicMaterial({
      map: baked.map,
      color: new Color(VOID_WHITE),
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  });

  // The screen quad ships without UVs (it has no baked texture), so derive
  // them from its extents: u across, v up the tilted face.
  const screen = terminal.getObjectByName('Terminal_Screen') as Mesh | undefined;
  if (screen) {
    const geometry = screen.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const pos = geometry.getAttribute('position');
    if (box) {
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (pos.getX(i) - box.min.x) / (box.max.x - box.min.x);
        uv[i * 2 + 1] = (pos.getY(i) - box.min.y) / (box.max.y - box.min.y);
      }
      geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    }
  }

  const guns: ArmoryParts['guns'] = {};
  for (const archetype of ARCHETYPES) {
    const gun = find(`Gun_${archetype}`);
    if (gun) guns[archetype] = gun;
  }
  parts = { rack, terminal, target, guns };
  return parts;
}

/* ------------------------------------------------------------ view models */

/** Where each class sits relative to the eye: [forward, right, up] metres. */
export const HOLD: Record<WeaponArchetype, [number, number, number]> = {
  pistol: [0.38, 0.12, -0.12],
  revolver: [0.38, 0.12, -0.11],
  // Long guns sit shouldered: the butt ends beside the eye, out of frame.
  smg: [0.4, 0.15, -0.19],
  rifle: [0.4, 0.15, -0.19],
  bullpup: [0.48, 0.15, -0.19],
  shotgun: [0.36, 0.14, -0.17],
  double: [0.36, 0.14, -0.17],
  lmg: [0.48, 0.17, -0.22],
  sniper: [0.36, 0.14, -0.17],
};

/** Muzzle position in the weapon's own frame (barrel toward -z, origin at the grip). */
export function muzzleOf(archetype: WeaponArchetype): [number, number, number] {
  const gun = getArmoryParts()?.guns[archetype];
  const m = gun?.userData.muzzle as number[] | undefined;
  return m && m.length === 3 ? [m[0], m[1], m[2]] : [0, 0.07, -0.4];
}

/** The loaded weapon's model. One instance per class, so mount one at a time. */
export function WeaponModel({ archetype }: { archetype: WeaponArchetype }) {
  const gun = getArmoryParts()?.guns[archetype];
  return gun ? <primitive object={gun} /> : null;
}

/* ---------------------------------------------------------------- terminal */

function screenTexture(lines: [string, string]): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 216;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#03140a';
    ctx.fillRect(0, 0, 384, 216);
    ctx.strokeStyle = 'rgba(46, 230, 110, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, 360, 192);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#39f07c';
    ctx.font = '52px "Share Tech Mono", monospace';
    ctx.fillText(lines[0], 192, 92);
    ctx.fillStyle = 'rgba(57, 240, 124, 0.65)';
    ctx.font = '24px "Share Tech Mono", monospace';
    ctx.fillText(lines[1], 192, 150);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < 216; y += 4) ctx.fillRect(0, y, 384, 1);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** One operator terminal with its own phosphor screen. Faces +z. */
export function Terminal({
  position,
  lines,
}: {
  position: [number, number, number];
  lines: [string, string];
}) {
  const [top, bottom] = lines;
  const object = useMemo(() => {
    const source = getArmoryParts()?.terminal;
    if (!source) return null;
    const clone = source.clone();
    const screen = clone.getObjectByName('Terminal_Screen') as Mesh | undefined;
    if (screen) {
      screen.material = new MeshBasicMaterial({ map: screenTexture([top, bottom]), toneMapped: false });
    }
    return clone;
  }, [top, bottom]);
  return object ? <primitive object={object} position={position} /> : null;
}

/* --------------------------------------------------------------- the racks */

export interface RushState {
  /** 'placed' skips the animation; 'rushing' plays it from startedAt. */
  mode: 'hidden' | 'rushing' | 'placed';
  startedAt: number;
}

const RACK_HALF_LEN = 3.05;
const RACK_HALF_DEPTH = 0.24;
/** Inner rows line the aisle from behind the spawn point to short of the range. */
const INNER_Z = [9, 2.5, -4, -10.5, -17];
const INNER_X = [-3.4, 3.4];
/** Shorter outer rows, glimpsed through the open inner racks. */
const OUTER_Z = [2.5, -4, -10.5];
const OUTER_X = [-5.9, 5.9];
const RUSH_FROM = -150;
const RUSH_DUR = 0.55;
const RUSH_STAGGER = 0.16;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface RackSlot {
  x: number;
  z: number;
  delay: number;
  flip: boolean;
}

// Arrival order: nearest racks first, alternating sides, outer rows trailing.
const RACKS: RackSlot[] = [
  ...INNER_Z.flatMap((z) => INNER_X.map((x) => ({ x, z }))),
  ...OUTER_Z.flatMap((z) => OUTER_X.map((x) => ({ x, z }))),
].map((slot, i) => ({ ...slot, delay: i * RUSH_STAGGER, flip: i % 3 === 1 }));

/**
 * The racks plus the film's rush-in: each one races from deep in the void
 * (z=-150 to its slot) with a cubic ease-out, staggered so they thunder in
 * one after another; every arrival kicks store.shake. `mode: 'placed'`
 * (repeat visits) mounts them already parked.
 */
export function RackAisles({ rush }: { rush: MutableRefObject<RushState> }) {
  const store = useSceneStore();
  const groups = useRef<(Group | null)[]>([]);
  const arrived = useRef<boolean[]>([]);

  const racks = useMemo(() => {
    const source = getArmoryParts()?.rack;
    return source ? RACKS.map(() => source.clone()) : [];
  }, []);

  useFrame(() => {
    const state = rush.current;
    RACKS.forEach((rack, i) => {
      const g = groups.current[i];
      if (!g) return;
      if (state.mode === 'hidden') {
        g.position.z = RUSH_FROM;
        arrived.current[i] = false;
        return;
      }
      if (state.mode === 'placed') {
        g.position.z = rack.z;
        return;
      }
      const t = (performance.now() - state.startedAt) / 1000 - rack.delay;
      const p = Math.max(0, Math.min(1, t / RUSH_DUR));
      g.position.z = RUSH_FROM + (rack.z - RUSH_FROM) * easeOutCubic(p);
      if (p >= 1 && !arrived.current[i]) {
        arrived.current[i] = true;
        store.shake(0.1);
      }
    });
  });

  return (
    <>
      {racks.map((object, i) => (
        <group
          key={i}
          ref={(g) => void (groups.current[i] = g)}
          position={[RACKS[i].x, 0, RUSH_FROM]}
          rotation={[0, RACKS[i].flip ? Math.PI : 0, 0]}
        >
          <primitive object={object} />
        </group>
      ))}
    </>
  );
}

export const RUSH_TOTAL_MS = (RACKS.length - 1) * RUSH_STAGGER * 1000 + RUSH_DUR * 1000 + 400;

export const RACK_COLLIDERS: Collider2D[] = RACKS.map((rack) => ({
  minX: rack.x - RACK_HALF_DEPTH,
  maxX: rack.x + RACK_HALF_DEPTH,
  minZ: rack.z - RACK_HALF_LEN,
  maxZ: rack.z + RACK_HALF_LEN,
}));
