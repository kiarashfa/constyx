import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  Object3D,
  type InstancedMesh,
  type Mesh,
  type MeshStandardMaterial,
  type PointLight,
} from 'three';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import {
  useSceneStore,
  type Collider2D,
  type Platform,
  type PlayerEvent,
  type SceneStore,
} from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { useAmbience, sfxThump } from '../../../../engine/audio';
import { RooftopHud, type RooftopPhase } from './RooftopHud';
import {
  CHARGE_MS,
  FALL_Y,
  FORWARD_BOOST,
  GAP,
  GRAVITY,
  JUMP_MAX_VY,
  JUMP_MIN_VY,
  MAX_FAILS,
  ROOF_B_DROP,
  SPAWN,
  SPRINT_MAX,
  SPRINT_RAMP_SEC,
  SWEET_END,
  SWEET_START,
} from './tuning';

const ROOF_B_Y = -ROOF_B_DROP;

/* ------------------------------------------------------------------ layout
 * Roof A: x∈[-5,5], z∈[0,14], y=0 — the run-up, spawn at z=12.5, ledge z=0.
 * Gap:    z∈[-6,0] — open street, 30m of nothing below.
 * Roof B: x∈[-5,5], z∈[-18,-6], y=-0.6 — the landing.
 */
const PLATFORMS: Platform[] = [
  { minX: -5, maxX: 5, minZ: 0, maxZ: 14, y: 0 },
  { minX: -5, maxX: 5, minZ: -18, maxZ: -6, y: ROOF_B_Y },
  // HVAC tops are hop-on-able (their colliders are height-bounded).
  { minX: 2.6, maxX: 4.2, minZ: 4.3, maxZ: 5.7, y: 1.2 },
  { minX: -4.2, maxX: -2.6, minZ: 7.3, maxZ: 8.7, y: 1.2 },
];

const COLLIDERS: Collider2D[] = [
  // Roof A parapets (three edges; the gap edge is open)
  { minX: -5, maxX: 5, minZ: 13.6, maxZ: 14, yMax: 0.85 },
  { minX: -5, maxX: -4.7, minZ: 0, maxZ: 14, yMax: 0.85 },
  { minX: 4.7, maxX: 5, minZ: 0, maxZ: 14, yMax: 0.85 },
  // Roof-access hut + HVAC + protocol terminal
  { minX: -4.5, maxX: -1.9, minZ: 12.1, maxZ: 13.7, yMax: 2.3 },
  { minX: 2.6, maxX: 4.2, minZ: 4.3, maxZ: 5.7, yMax: 1.2 },
  { minX: -4.2, maxX: -2.6, minZ: 7.3, maxZ: 8.7, yMax: 1.2 },
  { minX: 3.35, maxX: 3.85, minZ: 12.0, maxZ: 12.4 },
  // Building B street-side wall — only solid below its roofline
  { minX: -5, maxX: 5, minZ: -6.1, maxZ: -5.8, yMax: ROOF_B_Y },
  // Roof B parapets (far + sides; the gap edge is open for slide-in landings)
  { minX: -5, maxX: 5, minZ: -18, maxZ: -17.7, yMax: 0.25 },
  { minX: -5, maxX: -4.7, minZ: -18, maxZ: -6, yMax: 0.25 },
  { minX: 4.7, maxX: 5, minZ: -18, maxZ: -6, yMax: 0.25 },
  // Roof B props: beacon mast base, reset pedestal, vent
  { minX: 3.3, maxX: 3.7, minZ: -16.7, maxZ: -16.3 },
  { minX: -3.25, maxX: -2.75, minZ: -16.2, maxZ: -15.8 },
  { minX: 1.3, maxX: 2.7, minZ: -14.8, maxZ: -13.7 },
];

/* -------------------------------------------------------------- environment */

// Night reads through cool light color and fog — albedos stay mid-range,
// otherwise linear-space math crushes everything to black.
const ASPHALT = '#4d5761';
const CONCRETE = '#717c86';
const NIGHT = '#05070c';

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

interface WindowSpot {
  pos: [number, number, number];
  rotY: number;
  warm: boolean;
}

/** Distant towers + one InstancedMesh of lit windows — the city at night. */
function Skyline() {
  const { towers, windows } = useMemo(() => {
    const rand = seededRand(1999);
    const towers: { pos: [number, number, number]; size: [number, number, number]; shade: string }[] = [];
    const windows: WindowSpot[] = [];
    const shades = ['#10141a', '#141a21', '#0d1116'];
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + rand() * 0.2;
      const radius = 30 + rand() * 38;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const w = 5 + rand() * 9;
      const d = 5 + rand() * 9;
      const h = 10 + rand() * 32;
      towers.push({ pos: [x, -30 + h / 2, z], size: [w, h, d], shade: shades[i % 3] });
      // Lit windows on the two faces roughly toward the player
      for (const [face, rotY] of [
        [1, 0],
        [-1, Math.PI],
      ] as const) {
        const cols = Math.floor(w / 1.5);
        const rows = Math.floor(h / 2.2);
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            if (rand() > 0.15 || windows.length >= 650) continue;
            windows.push({
              pos: [
                x - w / 2 + 0.9 + c * 1.5,
                -29 + 1.2 + r * 2.2,
                z + face * (d / 2 + 0.04),
              ],
              rotY,
              warm: rand() < 0.35,
            });
          }
        }
      }
    }
    return { towers, windows };
  }, []);

  const instRef = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    const helper = new Object3D();
    const cool = new Color('#9fc0e8');
    const warm = new Color('#ffd9a0');
    windows.forEach((wnd, i) => {
      helper.position.set(...wnd.pos);
      helper.rotation.set(0, wnd.rotY, 0);
      helper.updateMatrix();
      inst.setMatrixAt(i, helper.matrix);
      inst.setColorAt(i, wnd.warm ? warm : cool);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [windows]);

  return (
    <>
      {towers.map((t, i) => (
        <mesh key={i} position={t.pos}>
          <boxGeometry args={t.size} />
          <meshStandardMaterial color={t.shade} roughness={0.85} />
        </mesh>
      ))}
      <instancedMesh ref={instRef} args={[undefined, undefined, windows.length]}>
        <planeGeometry args={[0.55, 0.75]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Blinking red aircraft-warning beacon — the landmark to aim at. */
function Beacon() {
  const lightRef = useRef<PointLight>(null);
  const bulbRef = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const pulse = Math.max(0, Math.sin(clock.elapsedTime * 2.2)) ** 3;
    if (lightRef.current) lightRef.current.intensity = pulse * 6;
    const mat = bulbRef.current?.material as MeshStandardMaterial | undefined;
    if (mat) mat.emissiveIntensity = 0.3 + pulse * 2.2;
  });
  return (
    <group position={[3.5, ROOF_B_Y, -16.5]}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[0.045, 0.07, 4, 8]} />
        <meshStandardMaterial color="#33393f" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh ref={bulbRef} position={[0, 4.1, 0]}>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#4a0a0a" emissive="#ff2222" emissiveIntensity={0.3} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 4.1, 0]} color="#ff3333" distance={14} intensity={0} />
    </group>
  );
}

function HvacUnit(props: { position: [number, number, number] }) {
  return (
    <group position={props.position}>
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.6, 1.2, 1.4]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, 1.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshStandardMaterial color="#0e1114" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Puddle({ position, r }: { position: [number, number, number]; r: number }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[r, 20]} />
      <meshStandardMaterial color="#0b1018" roughness={0.06} metalness={0.75} />
    </mesh>
  );
}

function Parapet({ pos, size }: { pos: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={CONCRETE} roughness={0.75} />
    </mesh>
  );
}

/** Pedestal terminal with a faint phosphor screen; used on both roofs. */
function Pedestal({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.5, 1.04, 0.4]} />
        <meshStandardMaterial color="#22272b" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.95, 0.16]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[0.36, 0.24]} />
        <meshStandardMaterial color="#04130a" emissive="#0d8a34" emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

function Environment() {
  const store = useSceneStore();
  return (
    <>
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={[NIGHT, 15, 95]} />
      <ambientLight color="#6b7fa8" intensity={0.85} />
      <hemisphereLight args={['#3a4c6e', '#11141a', 0.9]} />
      <directionalLight position={[-14, 20, -8]} color="#aebfe8" intensity={0.6} />
      {/* Low fill from behind the spawn so the run-up surface reads at night */}
      <directionalLight position={[6, 14, 24]} color="#7d92b8" intensity={0.4} />
      {/* Practicals: service lamp on the access hut, sodium lamp on roof B */}
      <pointLight position={[-1.8, 2.6, 12.2]} color="#9fd0ff" intensity={6} distance={13} />
      <pointLight position={[-3, ROOF_B_Y + 2.2, -15.5]} color="#ffb060" intensity={5} distance={12} />

      {/* Building A (run-up) and Building B (landing) */}
      <mesh position={[0, -15, 7]}>
        <boxGeometry args={[10, 30, 14]} />
        <meshStandardMaterial color={ASPHALT} roughness={0.32} metalness={0.15} />
      </mesh>
      <mesh position={[0, -15.3, -12]}>
        <boxGeometry args={[10, 29.4, 12]} />
        <meshStandardMaterial color={ASPHALT} roughness={0.32} metalness={0.15} />
      </mesh>

      {/* Roof A parapets + furniture */}
      <Parapet pos={[0, 0.42, 13.8]} size={[10, 0.85, 0.4]} />
      <Parapet pos={[-4.85, 0.42, 7]} size={[0.3, 0.85, 14]} />
      <Parapet pos={[4.85, 0.42, 7]} size={[0.3, 0.85, 14]} />
      <group position={[-3.2, 0, 12.9]}>
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[2.6, 2.3, 1.6]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.8} />
        </mesh>
        <mesh position={[0.6, 0.95, 0.81]}>
          <planeGeometry args={[0.8, 1.9]} />
          <meshStandardMaterial color="#0d0f11" roughness={0.9} />
        </mesh>
      </group>
      <HvacUnit position={[3.4, 0, 5]} />
      <HvacUnit position={[-3.4, 0, 8]} />
      <Puddle position={[-2, 0.005, 3.4]} r={1.3} />
      <Puddle position={[2.4, 0.005, 9.6]} r={0.9} />
      <Puddle position={[0.6, ROOF_B_Y + 0.005, -9]} r={1.4} />

      {/* Launch line at the ledge */}
      <mesh position={[0, 0.011, 0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 0.45]} />
        <meshStandardMaterial color="#052312" emissive="#0d8a34" emissiveIntensity={0.55} />
      </mesh>

      {/* Roof B parapets + furniture */}
      <Parapet pos={[0, ROOF_B_Y + 0.42, -17.85]} size={[10, 0.85, 0.3]} />
      <Parapet pos={[-4.85, ROOF_B_Y + 0.42, -12]} size={[0.3, 0.85, 12]} />
      <Parapet pos={[4.85, ROOF_B_Y + 0.42, -12]} size={[0.3, 0.85, 12]} />
      <mesh position={[2, ROOF_B_Y + 0.5, -14.25]}>
        <boxGeometry args={[1.4, 1, 1.1]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.7} metalness={0.25} />
      </mesh>
      {/* Edge-marker lamps along roof B's gap edge — the aim reference at night */}
      {[-3.5, 0, 3.5].map((x) => (
        <mesh key={x} position={[x, ROOF_B_Y + 0.08, -6.15]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color="#301408" emissive="#ff7733" emissiveIntensity={1.6} />
        </mesh>
      ))}
      <Beacon />

      {/* Interactables */}
      <Interactable
        label="REVIEW JUMP PROTOCOL"
        radius={2.4}
        onInteract={() =>
          store.toast(
            'Protocol: build a FULL sprint (SHIFT). Hold SPACE on approach. Release inside the bracket as you hit the ledge.',
            5600,
          )
        }
      >
        <Pedestal position={[3.6, 0, 12.2]} />
      </Interactable>
      <Interactable
        label="RE-RUN JUMP PROGRAM"
        radius={2.4}
        onInteract={() => {
          store.teleport(SPAWN, 0);
          store.toast('Program reset. Walk it back to the line.', 3000);
        }}
      >
        <Pedestal position={[-3, ROOF_B_Y, -16]} />
      </Interactable>

      <Skyline />
    </>
  );
}

/* ---------------------------------------------------------------- gameplay */

/** Hands the SceneStore up to the scene root (which sits outside the provider). */
function StoreTap({ onStore }: { onStore: (store: SceneStore) => void }) {
  const store = useSceneStore();
  useEffect(() => onStore(store), [store, onStore]);
  return null;
}

export default function RooftopScene({ onExit }: SceneComponentProps) {
  useAmbience('rooftopWind');
  const storeRef = useRef<SceneStore | null>(null);
  const [phase, setPhase] = useState<RooftopPhase>('run');
  const [fails, setFails] = useState(0);
  const [cleared, setCleared] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const failsRef = useRef(0);
  const lastJump = useRef<{ charge01: number; speed: number; fromZ: number } | null>(null);
  const everCleared = useRef(false);

  const fail = useCallback(() => {
    if (phaseRef.current !== 'run') return;
    const store = storeRef.current;
    if (!store) return;
    const n = failsRef.current + 1;
    failsRef.current = n;
    setFails(n);
    if (n >= MAX_FAILS) {
      setPhase('pullout');
      setTimeout(onExit, 3200);
      return;
    }
    // Diagnose the miss so the player can actually learn from it.
    const j = lastJump.current;
    const message = !j
      ? 'You ran out of roof — release the jump before the ledge.'
      : j.speed < 5.8
        ? `Approach too slow (${j.speed.toFixed(1)} of ${SPRINT_MAX.toFixed(0)} m/s) — commit to the full sprint.`
        : j.charge01 < SWEET_START
          ? 'Released early — hold the charge into the bracket.'
          : j.charge01 > SWEET_END
            ? 'Released late — the arc collapsed under you.'
            : 'Inches short. Release closer to the ledge. Again.';
    lastJump.current = null;
    setPhase('glitch');
    store.teleport(SPAWN, 0);
    setTimeout(() => {
      setPhase('run');
      storeRef.current?.toast(message, 4400);
    }, 1500);
  }, [onExit]);

  // Plummet watcher — feetY below street-fail depth triggers the reload.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const store = storeRef.current;
      if (store && phaseRef.current === 'run' && store.motion.feetY < FALL_Y) fail();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fail]);

  const onPlayerEvent = useCallback((event: PlayerEvent) => {
    if (event.type === 'jump') {
      lastJump.current = {
        charge01: event.charge01,
        speed: event.speed,
        fromZ: event.position[2],
      };
      return;
    }
    if (event.type === 'charge-fizzle') {
      storeRef.current?.toast('Overcharged — the jump fizzled out of your legs.', 2800);
      return;
    }
    // land
    sfxThump(0.6 + event.impact * 1.4);
    const j = lastJump.current;
    lastJump.current = null;
    if (j && j.fromZ > -0.5 && event.position[2] < -GAP) {
      // Launched from roof A, touched down on roof B: cleared.
      failsRef.current = 0;
      setFails(0);
      setCleared(true);
      const store = storeRef.current;
      if (!everCleared.current) {
        everCleared.current = true;
        store?.toast("NOBODY MAKES THE FIRST ONE. You just made yours.", 5600);
      } else {
        store?.toast('Cleared again. The roof believes you now.', 3200);
      }
    }
  }, []);

  // Entry hint + dev handle.
  useEffect(() => {
    const t = setTimeout(
      () =>
        storeRef.current?.toast(
          'Jump program: full sprint, hold SPACE on approach, release in the bracket at the ledge.',
          5600,
        ),
      900,
    );
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__rooftopDebug = {
        fail,
        forceFails: (n: number) => {
          failsRef.current = n;
          setFails(n);
        },
        phase: () => phaseRef.current,
      };
    }
    return () => clearTimeout(t);
  }, [fail]);

  return (
    <SceneShell
      title="ROOFTOP :: JUMP PROGRAM"
      spawn={SPAWN}
      colliders={COLLIDERS}
      platforms={PLATFORMS}
      player={{
        gravity: GRAVITY,
        sprint: { maxSpeed: SPRINT_MAX, rampSec: SPRINT_RAMP_SEC },
        jump: {
          chargeDurationMs: CHARGE_MS,
          sweetStart: SWEET_START,
          sweetEnd: SWEET_END,
          minVelY: JUMP_MIN_VY,
          maxVelY: JUMP_MAX_VY,
          forwardBoost: FORWARD_BOOST,
        },
        onEvent: onPlayerEvent,
      }}
      onExit={onExit}
      hud={
        <>
          <StoreTap onStore={(s) => void (storeRef.current = s)} />
          <RooftopHud phase={phase} fails={fails} maxFails={MAX_FAILS} cleared={cleared} />
        </>
      }
    >
      <Environment />
    </SceneShell>
  );
}
