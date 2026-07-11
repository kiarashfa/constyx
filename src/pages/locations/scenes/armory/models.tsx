import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, type Group, type InstancedMesh } from 'three';
import { useSceneStore } from '../../engine3d/store';
import type { WeaponArchetype } from './types';

const GUNMETAL = '#33383f';
const GRIP = '#1d1b18';
const WOOD = '#6b4a2c';

/* ----------------------------------------------------- viewmodel archetypes
 * Procedural weapon models, barrel toward -z, origin at the grip. Detailed
 * enough to read the class instantly; the visual-refinement round can swap
 * these for real assets without touching any surrounding code.
 */
function Metal({ color = GUNMETAL }: { color?: string }) {
  return <meshStandardMaterial color={color} metalness={0.55} roughness={0.42} />;
}

export function WeaponModel({ archetype }: { archetype: WeaponArchetype }) {
  switch (archetype) {
    case 'pistol':
    case 'revolver':
      return (
        <group>
          <mesh position={[0, 0.03, -0.06]}>
            <boxGeometry args={[0.034, 0.05, 0.19]} />
            <Metal />
          </mesh>
          <mesh position={[0, 0.035, -0.19]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.011, 0.011, archetype === 'revolver' ? 0.14 : 0.09, 10]} />
            <Metal />
          </mesh>
          {archetype === 'revolver' && (
            <mesh position={[0, 0.02, -0.045]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.026, 0.026, 0.05, 12]} />
              <Metal />
            </mesh>
          )}
          <mesh position={[0, -0.045, 0.01]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[0.03, 0.1, 0.045]} />
            <Metal color={GRIP} />
          </mesh>
        </group>
      );
    case 'smg':
      return (
        <group>
          <mesh position={[0, 0.03, -0.1]}>
            <boxGeometry args={[0.045, 0.07, 0.3]} />
            <Metal />
          </mesh>
          <mesh position={[0, 0.03, -0.31]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.13, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, -0.06, -0.1]}>
            <boxGeometry args={[0.032, 0.13, 0.05]} />
            <Metal color={GRIP} />
          </mesh>
          <mesh position={[0, -0.04, 0.02]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.03, 0.09, 0.045]} />
            <Metal color={GRIP} />
          </mesh>
          <mesh position={[0, 0.02, 0.09]}>
            <boxGeometry args={[0.03, 0.03, 0.12]} />
            <Metal />
          </mesh>
        </group>
      );
    case 'rifle':
      return (
        <group>
          <mesh position={[0, 0.03, -0.14]}>
            <boxGeometry args={[0.042, 0.065, 0.42]} />
            <Metal />
          </mesh>
          <mesh position={[0, 0.032, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.26, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, -0.055, -0.16]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[0.032, 0.13, 0.06]} />
            <Metal color={GRIP} />
          </mesh>
          <mesh position={[0, -0.035, 0.03]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.03, 0.09, 0.045]} />
            <Metal color={GRIP} />
          </mesh>
          <mesh position={[0, 0.02, 0.16]}>
            <boxGeometry args={[0.038, 0.07, 0.18]} />
            <Metal color={WOOD} />
          </mesh>
        </group>
      );
    case 'bullpup':
      return (
        <group>
          <mesh position={[0, 0.025, -0.02]}>
            <boxGeometry args={[0.05, 0.085, 0.4]} />
            <Metal color="#3c4238" />
          </mesh>
          <mesh position={[0, 0.03, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, 0.09, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.08, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, -0.05, -0.12]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.03, 0.1, 0.045]} />
            <Metal color={GRIP} />
          </mesh>
        </group>
      );
    case 'shotgun':
      return (
        <group>
          <mesh position={[0, 0.03, -0.12]}>
            <boxGeometry args={[0.04, 0.06, 0.4]} />
            <Metal />
          </mesh>
          <mesh position={[0, 0.04, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.013, 0.013, 0.3, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, -0.005, -0.34]}>
            <boxGeometry args={[0.035, 0.035, 0.14]} />
            <Metal color={WOOD} />
          </mesh>
          <mesh position={[0, -0.02, 0.12]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.038, 0.09, 0.18]} />
            <Metal color={WOOD} />
          </mesh>
        </group>
      );
    case 'double':
      return (
        <group>
          {([-1, 1] as const).map((s) => (
            <mesh key={s} position={[s * 0.013, 0.04, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.011, 0.011, 0.34, 10]} />
              <Metal />
            </mesh>
          ))}
          <mesh position={[0, 0.03, -0.04]}>
            <boxGeometry args={[0.045, 0.055, 0.14]} />
            <Metal />
          </mesh>
          <mesh position={[0, -0.015, 0.12]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.04, 0.09, 0.2]} />
            <Metal color={WOOD} />
          </mesh>
        </group>
      );
    case 'lmg':
      return (
        <group>
          <mesh position={[0, 0.03, -0.14]}>
            <boxGeometry args={[0.06, 0.1, 0.5]} />
            <Metal />
          </mesh>
          <mesh position={[0, 0.045, -0.52]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, -0.09, -0.16]}>
            <boxGeometry args={[0.05, 0.09, 0.14]} />
            <Metal color={GRIP} />
          </mesh>
          {([-1, 1] as const).map((s) => (
            <mesh key={s} position={[s * 0.04, -0.06, -0.55]} rotation={[0, 0, s * 0.35]}>
              <cylinderGeometry args={[0.006, 0.006, 0.22, 6]} />
              <Metal />
            </mesh>
          ))}
          <mesh position={[0, -0.03, 0.12]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.035, 0.09, 0.14]} />
            <Metal color={GRIP} />
          </mesh>
        </group>
      );
    case 'sniper':
      return (
        <group>
          <mesh position={[0, 0.025, -0.16]}>
            <boxGeometry args={[0.038, 0.055, 0.5]} />
            <Metal color={WOOD} />
          </mesh>
          <mesh position={[0, 0.03, -0.56]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.4, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, 0.085, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.16, 10]} />
            <Metal />
          </mesh>
          <mesh position={[0, -0.03, 0.1]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.036, 0.1, 0.2]} />
            <Metal color={WOOD} />
          </mesh>
        </group>
      );
  }
}

/* --------------------------------------------------------------- the racks */

export interface RushState {
  /** 'placed' skips the animation; 'rushing' plays it from startedAt. */
  mode: 'hidden' | 'rushing' | 'placed';
  startedAt: number;
}

const RACK_LEN = 6;
const RACK_SLOTS_Z = [-4, -10.5, -17, -23.5];
const AISLE_X = 3.4;
const SHELF_YS = [0.55, 1.15, 1.75, 2.35];
const GUNS_PER_SHELF = 10;
const RUSH_FROM = -150;
const RUSH_DUR = 0.55;
const RUSH_STAGGER = 0.3;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** One rack: steel frame + two InstancedMeshes of densely racked weapons. */
function Rack({ seed }: { seed: number }) {
  const bodies = useRef<InstancedMesh>(null);
  const barrels = useRef<InstancedMesh>(null);
  const count = SHELF_YS.length * GUNS_PER_SHELF;

  useLayoutEffect(() => {
    const rand = seededRand(seed);
    const helper = new Object3D();
    const shade = new Color();
    let i = 0;
    for (const y of SHELF_YS) {
      for (let s = 0; s < GUNS_PER_SHELF; s++) {
        const z = -RACK_LEN / 2 + 0.35 + s * ((RACK_LEN - 0.7) / (GUNS_PER_SHELF - 1));
        const lean = (rand() - 0.5) * 0.12;
        const h = 0.34 + rand() * 0.22;
        // Body (racked upright)
        helper.position.set((rand() - 0.5) * 0.1, y + h / 2, z);
        helper.rotation.set(lean, rand() * 0.3 - 0.15, 0);
        helper.scale.set(0.8 + rand() * 0.5, h / 0.45, 0.9 + rand() * 0.4);
        helper.updateMatrix();
        bodies.current?.setMatrixAt(i, helper.matrix);
        shade.setHSL(0.58 + rand() * 0.04, 0.06 + rand() * 0.05, 0.16 + rand() * 0.1);
        bodies.current?.setColorAt(i, shade);
        // Barrel above the body
        helper.position.set(helper.position.x, y + h + 0.1, z);
        helper.scale.set(1, 0.7 + rand() * 0.6, 1);
        helper.updateMatrix();
        barrels.current?.setMatrixAt(i, helper.matrix);
        barrels.current?.setColorAt(i, shade);
        i++;
      }
    }
    for (const inst of [bodies.current, barrels.current]) {
      if (!inst) continue;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
  }, [seed, count]);

  return (
    <group>
      {/* Uprights */}
      {([-1, 1] as const).map((end) => (
        <mesh key={end} position={[0, 1.45, (end * RACK_LEN) / 2]}>
          <boxGeometry args={[0.5, 2.9, 0.07]} />
          <meshStandardMaterial color="#c8ccd0" roughness={0.5} metalness={0.35} />
        </mesh>
      ))}
      {/* Shelves */}
      {SHELF_YS.map((y) => (
        <mesh key={y} position={[0, y - 0.02, 0]}>
          <boxGeometry args={[0.55, 0.04, RACK_LEN]} />
          <meshStandardMaterial color="#d4d8dc" roughness={0.45} metalness={0.3} />
        </mesh>
      ))}
      {/* Back rail */}
      <mesh position={[0.24, 1.45, 0]}>
        <boxGeometry args={[0.03, 2.9, RACK_LEN]} />
        <meshStandardMaterial color="#dde1e4" roughness={0.5} metalness={0.25} transparent opacity={0.35} />
      </mesh>
      <instancedMesh ref={bodies} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.075, 0.45, 0.12]} />
        <meshStandardMaterial metalness={0.5} roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={barrels} args={[undefined, undefined, count]}>
        <cylinderGeometry args={[0.012, 0.012, 0.24, 6]} />
        <meshStandardMaterial metalness={0.5} roughness={0.45} />
      </instancedMesh>
    </group>
  );
}

/**
 * Both aisles of racks plus the film's rush-in: each rack races from deep in
 * the void (z=-150 → slot) with a cubic ease-out over ~0.55s, staggered so
 * they thunder in one after another; every arrival kicks store.shake.
 * `mode: 'placed'` (repeat visits) mounts them already parked.
 */
export function RackAisles({ rush }: { rush: MutableRefObject<RushState> }) {
  const store = useSceneStore();
  const groups = useRef<(Group | null)[]>([]);
  const arrived = useRef<boolean[]>([]);

  const racks = useMemo(() => {
    const list: { x: number; z: number; delay: number; seed: number }[] = [];
    RACK_SLOTS_Z.forEach((z, i) => {
      // Alternate sides so arrivals hammer left-right-left-right.
      list.push({ x: -AISLE_X, z, delay: i * 2 * RUSH_STAGGER, seed: 100 + i });
      list.push({ x: AISLE_X, z, delay: (i * 2 + 1) * RUSH_STAGGER, seed: 200 + i });
    });
    return list;
  }, []);

  useFrame(() => {
    const state = rush.current;
    racks.forEach((rack, i) => {
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
        store.shake(0.14);
      }
    });
  });

  return (
    <>
      {racks.map((rack, i) => (
        <group
          key={i}
          ref={(g) => void (groups.current[i] = g)}
          position={[rack.x, 0, RUSH_FROM]}
          rotation={[0, rack.x < 0 ? 0 : Math.PI, 0]}
        >
          <Rack seed={rack.seed} />
        </group>
      ))}
    </>
  );
}

export const RUSH_TOTAL_MS = (RACK_SLOTS_Z.length * 2 - 1) * RUSH_STAGGER * 1000 + RUSH_DUR * 1000 + 400;
export const RACK_COLLIDERS = RACK_SLOTS_Z.flatMap((z) => [
  { minX: -AISLE_X - 0.5, maxX: -AISLE_X + 0.35, minZ: z - RACK_LEN / 2, maxZ: z + RACK_LEN / 2 },
  { minX: AISLE_X - 0.35, maxX: AISLE_X + 0.5, minZ: z - RACK_LEN / 2, maxZ: z + RACK_LEN / 2 },
]);
