import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group } from 'three';
import type { AttackKind } from './combat';

export type OpponentMode = 'idle' | 'guard' | 'telegraph' | 'strike' | 'stagger' | 'bow';

/** Mutable control block: the scene's state machine writes it, the opponent's
 * useFrame reads it. Same zero-re-render pattern as store.motion. */
export interface OpponentCtl {
  mode: OpponentMode;
  kind: AttackKind;
  /** performance.now() of the last mode change. */
  since: number;
  /** When engaged, footwork tracks the player at sparring distance. */
  engaged: boolean;
}

/** Joint channels. Body faces local +z; root yaw turns +z toward the player. */
type Pose = {
  rootY: number; // crouch offset
  adv: number; // forward offset along facing (lunges / recoils)
  torsoX: number;
  torsoZ: number;
  headX: number;
  shLX: number;
  shLZ: number;
  shRX: number;
  shRZ: number;
  elL: number;
  elR: number;
  hipLX: number;
  hipLZ: number;
  hipRX: number;
  hipRZ: number;
  kneeL: number;
  kneeR: number;
};

const BASE: Pose = {
  rootY: 0,
  adv: 0,
  torsoX: 0.02,
  torsoZ: 0,
  headX: 0,
  shLX: 0.15,
  shLZ: 0.12,
  shRX: 0.15,
  shRZ: -0.12,
  elL: -0.25,
  elR: -0.25,
  hipLX: 0,
  hipLZ: 0.04,
  hipRX: 0,
  hipRZ: -0.04,
  kneeL: 0.08,
  kneeR: 0.08,
};

/** Silhouette-first poses: crouched-low vs arms-high vs leaning-back-cocked
 * must be tellable apart in a tenth of a second. */
const POSES: Record<string, Pose> = {
  idle: { ...BASE },
  guard: {
    ...BASE,
    rootY: -0.08,
    torsoX: 0.08,
    shLX: 0.85,
    shRX: 0.85,
    shLZ: 0.2,
    shRZ: -0.2,
    elL: -1.9,
    elR: -1.9,
    kneeL: 0.2,
    kneeR: 0.2,
  },
  bow: { ...BASE, torsoX: 0.75, headX: 0.3, shLX: 0.05, shRX: 0.05, elL: -0.1, elR: -0.1 },
  stagger: {
    ...BASE,
    torsoX: -0.55,
    headX: -0.4,
    adv: -0.7,
    shLX: 1.1,
    shLZ: 0.9,
    shRX: 1.1,
    shRZ: -0.9,
    elL: -0.3,
    elR: -0.3,
    rootY: -0.06,
    kneeL: 0.35,
    kneeR: 0.35,
  },
  // LOW SWEEP — deep crouch, right leg coiled, then the leg whips through.
  sweepTele: {
    ...BASE,
    rootY: -0.44,
    torsoX: 0.5,
    headX: -0.25,
    shLX: 0.55,
    shRX: 0.7,
    elL: -0.7,
    elR: -0.5,
    hipLX: -0.3,
    kneeL: 1.5,
    hipRX: -0.85,
    kneeR: 1.7,
  },
  sweepStrike: {
    ...BASE,
    rootY: -0.5,
    torsoX: 0.3,
    torsoZ: 0.45,
    shLX: 0.8,
    shRX: 0.2,
    elL: -0.5,
    hipLX: -0.2,
    kneeL: 1.4,
    hipRX: 1.25,
    hipRZ: 0.35,
    kneeR: 0.15,
  },
  // HEAVY PALM — both arms rise high overhead, unmistakable.
  heavyTele: {
    ...BASE,
    torsoX: -0.18,
    headX: -0.3,
    rootY: 0.03,
    shLX: 2.7,
    shRX: 2.7,
    shLZ: 0.25,
    shRZ: -0.25,
    elL: -0.45,
    elR: -0.45,
  },
  heavyStrike: {
    ...BASE,
    torsoX: 0.55,
    headX: 0.15,
    rootY: -0.22,
    adv: 0.35,
    shLX: 0.75,
    shRX: 0.75,
    elL: -0.15,
    elR: -0.15,
    kneeL: 0.5,
    kneeR: 0.5,
  },
  // OVERCOMMITTED LUNGE — long lean back with the fist chambered, then a
  // deep, slow overreach: the opening you punish.
  lungeTele: {
    ...BASE,
    torsoX: -0.35,
    headX: -0.15,
    rootY: -0.12,
    adv: -0.45,
    shRX: 0.5,
    elR: -2.3,
    shLX: 0.75,
    elL: -1.0,
    hipLX: 0.25,
    kneeL: 0.35,
  },
  lungeStrike: {
    ...BASE,
    torsoX: 0.5,
    headX: 0.2,
    rootY: -0.28,
    adv: 1.0,
    shRX: 1.55,
    shRZ: -0.05,
    elR: -0.1,
    shLX: -0.35,
    elL: -0.5,
    hipLX: 0.7,
    kneeL: 0.9,
    hipRX: -0.45,
    kneeR: 0.15,
  },
};

const SKIN = '#7a5240';
const GI = '#e6e0d2';
const GI_TRIM = '#c9c2b0';
const DARK = '#22201c';

const ENGAGE_DIST: Partial<Record<OpponentMode, number>> = {
  strike: 1.85,
  telegraph: 2.05,
  stagger: 3.1,
};
const DEFAULT_DIST = 2.25;
const HOME: [number, number, number] = [0, 0, -1.6];

interface OpponentProps {
  ctl: MutableRefObject<OpponentCtl>;
  /** Rendered inside the moving root — e.g. a dynamic Interactable anchor. */
  children?: ReactNode;
}

/**
 * The sparring partner: ~22 primitive meshes articulated through group
 * pivots, posed by exponential lerp toward the active pose each frame, with
 * footwork that keeps sparring distance from the live player position.
 * No skeletons, no clips — the whole animator is this file.
 */
export function Opponent({ ctl, children }: OpponentProps) {
  const camera = useThree((state) => state.camera);
  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const shL = useRef<Group>(null);
  const shR = useRef<Group>(null);
  const elL = useRef<Group>(null);
  const elR = useRef<Group>(null);
  const hipL = useRef<Group>(null);
  const hipR = useRef<Group>(null);
  const kneeL = useRef<Group>(null);
  const kneeR = useRef<Group>(null);

  const cur = useMemo<Pose>(() => ({ ...BASE }), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = ctl.current;
    const t = clock.elapsedTime;

    // ---- pick target pose ----
    let target: Pose;
    switch (c.mode) {
      case 'telegraph':
        target = POSES[`${c.kind}Tele`];
        break;
      case 'strike':
        target = POSES[`${c.kind}Strike`];
        break;
      case 'guard':
      case 'stagger':
      case 'bow':
        target = POSES[c.mode];
        break;
      default:
        target = POSES.idle;
    }

    // Strikes snap; telegraphs settle quickly; everything else eases.
    const rate = c.mode === 'strike' ? 16 : c.mode === 'telegraph' ? 8 : 5;
    const f = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(cur) as (keyof Pose)[]) {
      cur[key] += (target[key] - cur[key]) * f;
    }

    // Breathing / telegraph pulse so held poses stay alive.
    const breathe = c.mode === 'telegraph' ? Math.sin(t * 9) * 0.025 : Math.sin(t * 1.7) * 0.012;

    // ---- apply channels ----
    if (torso.current) {
      torso.current.rotation.x = cur.torsoX + breathe;
      torso.current.rotation.z = cur.torsoZ;
    }
    if (head.current) head.current.rotation.x = cur.headX;
    if (shL.current) shL.current.rotation.set(cur.shLX, 0, cur.shLZ + breathe * 0.6);
    if (shR.current) shR.current.rotation.set(cur.shRX, 0, cur.shRZ - breathe * 0.6);
    if (elL.current) elL.current.rotation.x = cur.elL;
    if (elR.current) elR.current.rotation.x = cur.elR;
    if (hipL.current) hipL.current.rotation.set(cur.hipLX, 0, cur.hipLZ);
    if (hipR.current) hipR.current.rotation.set(cur.hipRX, 0, cur.hipRZ);
    if (kneeL.current) kneeL.current.rotation.x = cur.kneeL;
    if (kneeR.current) kneeR.current.rotation.x = cur.kneeR;

    // ---- footwork: hold sparring distance from the live player ----
    const g = root.current;
    if (!g) return;
    const px = camera.position.x;
    const pz = camera.position.z;
    let targetX: number;
    let targetZ: number;
    if (c.engaged) {
      const dist = ENGAGE_DIST[c.mode] ?? DEFAULT_DIST;
      const dx = g.position.x - px;
      const dz = g.position.z - pz;
      const len = Math.hypot(dx, dz) || 1;
      targetX = px + (dx / len) * dist;
      targetZ = pz + (dz / len) * dist;
    } else {
      // Unengaged: pace slowly around the center — a live target, which is
      // exactly what the dynamic Interactable focus exists to track.
      targetX = HOME[0] + Math.sin(t * 0.35) * 1.4;
      targetZ = HOME[2] + Math.cos(t * 0.22) * 0.7;
    }
    const moveRate = c.mode === 'strike' ? 8 : 2.4;
    const mf = 1 - Math.exp(-moveRate * dt);
    g.position.x += (targetX - g.position.x) * mf;
    g.position.z += (targetZ - g.position.z) * mf;

    // Face the player (always — he never turns his back), advance along gaze.
    const yaw = Math.atan2(px - g.position.x, pz - g.position.z);
    let dYaw = yaw - g.rotation.y;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    g.rotation.y += dYaw * Math.min(1, 6 * dt);

    g.position.x += Math.sin(g.rotation.y) * cur.adv * mf * 2;
    g.position.z += Math.cos(g.rotation.y) * cur.adv * mf * 2;
    g.position.y = cur.rootY;
  });

  return (
    <group ref={root} position={HOME}>
      {children}
      {/* pelvis + legs hang off the root so the torso can lean independently */}
      <mesh position={[0, 0.94, 0]}>
        <boxGeometry args={[0.32, 0.2, 0.22]} />
        <meshStandardMaterial color={GI} roughness={0.75} />
      </mesh>

      {([-1, 1] as const).map((side) => {
        const hip = side < 0 ? hipL : hipR;
        const knee = side < 0 ? kneeL : kneeR;
        return (
          <group key={side} ref={hip} position={[side * 0.11, 0.9, 0]}>
            <mesh position={[0, -0.2, 0]}>
              <capsuleGeometry args={[0.072, 0.3, 4, 10]} />
              <meshStandardMaterial color={GI} roughness={0.75} />
            </mesh>
            <group ref={knee} position={[0, -0.44, 0]}>
              <mesh position={[0, -0.18, 0]}>
                <capsuleGeometry args={[0.055, 0.28, 4, 10]} />
                <meshStandardMaterial color={GI_TRIM} roughness={0.75} />
              </mesh>
              <mesh position={[0, -0.36, 0.06]}>
                <boxGeometry args={[0.09, 0.05, 0.21]} />
                <meshStandardMaterial color={DARK} roughness={0.8} />
              </mesh>
            </group>
          </group>
        );
      })}

      <group ref={torso} position={[0, 1.04, 0]}>
        <mesh position={[0, 0.28, 0]}>
          <capsuleGeometry args={[0.17, 0.3, 4, 12]} />
          <meshStandardMaterial color={GI} roughness={0.75} />
        </mesh>
        {/* Gi lapel V */}
        <mesh position={[-0.05, 0.3, 0.145]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.05, 0.34, 0.02]} />
          <meshStandardMaterial color={GI_TRIM} roughness={0.7} />
        </mesh>
        <mesh position={[0.05, 0.3, 0.145]} rotation={[0, 0, -0.5]}>
          <boxGeometry args={[0.05, 0.34, 0.02]} />
          <meshStandardMaterial color={GI_TRIM} roughness={0.7} />
        </mesh>
        {/* Belt */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.37, 0.07, 0.27]} />
          <meshStandardMaterial color={DARK} roughness={0.6} />
        </mesh>

        {/* Head: bald, calm, pince-nez glasses */}
        <group ref={head} position={[0, 0.6, 0]}>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.115, 20, 16]} />
            <meshStandardMaterial color={SKIN} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.02, 0.02]}>
            <cylinderGeometry args={[0.045, 0.06, 0.08, 10]} />
            <meshStandardMaterial color={SKIN} roughness={0.55} />
          </mesh>
          {([-1, 1] as const).map((s) => (
            <mesh key={s} position={[s * 0.048, 0.075, 0.104]} rotation={[0.1, 0, 0]}>
              <cylinderGeometry args={[0.034, 0.034, 0.012, 16]} />
              <meshStandardMaterial color="#0c0c0e" roughness={0.25} metalness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, 0.082, 0.112]}>
            <boxGeometry args={[0.032, 0.008, 0.008]} />
            <meshStandardMaterial color="#3a3630" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>

        {/* Arms hang from the torso so they follow leans */}
        {([-1, 1] as const).map((side) => {
          const sh = side < 0 ? shL : shR;
          const el = side < 0 ? elL : elR;
          return (
            <group key={side} ref={sh} position={[side * 0.245, 0.46, 0]}>
              <mesh position={[0, -0.15, 0]}>
                <capsuleGeometry args={[0.052, 0.22, 4, 10]} />
                <meshStandardMaterial color={GI} roughness={0.75} />
              </mesh>
              <group ref={el} position={[0, -0.3, 0]}>
                <mesh position={[0, -0.13, 0]}>
                  <capsuleGeometry args={[0.045, 0.2, 4, 10]} />
                  <meshStandardMaterial color={GI_TRIM} roughness={0.75} />
                </mesh>
                <mesh position={[0, -0.28, 0]}>
                  <sphereGeometry args={[0.05, 10, 8]} />
                  <meshStandardMaterial color={SKIN} roughness={0.55} />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}
