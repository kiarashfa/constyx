import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

export type AvatarPose = 'ready' | 'back' | 'left' | 'right' | 'hit';

/** Mutable control block, same zero-re-render pattern as the dojo opponent. */
export interface AvatarCtl {
  pose: AvatarPose;
  since: number;
}

/** Joint channels — the dojo's pose-lerp technique, applied to the player. */
type Pose = {
  rootY: number;
  rootZ: number; // hips push forward/back (the arch drives hips toward +z)
  torsoX: number; // + = fold forward, − = arch back
  torsoZ: number; // side bends
  headX: number;
  shLX: number;
  shLZ: number;
  shRX: number;
  shRZ: number;
  elL: number;
  elR: number;
  hipLX: number;
  hipRX: number;
  kneeL: number;
  kneeR: number;
};

const BASE: Pose = {
  rootY: 0,
  rootZ: 0,
  torsoX: 0.03,
  torsoZ: 0,
  headX: 0,
  shLX: 0.2,
  shLZ: 0.18,
  shRX: 0.2,
  shRZ: -0.18,
  elL: -0.35,
  elR: -0.35,
  hipLX: 0,
  hipRX: 0,
  kneeL: 0.06,
  kneeR: 0.06,
};

const POSES: Record<AvatarPose, Pose> = {
  ready: { ...BASE },
  // THE arch: knees driven forward, hips ahead of the heels, torso folded
  // back near-horizontal, head thrown back, arms windmilled asymmetrically.
  back: {
    ...BASE,
    rootY: -0.32,
    rootZ: 0.18,
    torsoX: -1.25,
    headX: -0.5,
    shLX: 2.3,
    shLZ: 0.6,
    shRX: 1.6,
    shRZ: -0.9,
    elL: -0.5,
    elR: -0.9,
    hipLX: 0.75,
    hipRX: 0.85,
    kneeL: 1.25,
    kneeR: 1.1,
  },
  // The root is rotated π to face the shooter (-z), so a WORLD -x lean
  // (screen-left, camera behind) is a LOCAL +x tilt: negative torsoZ.
  left: {
    ...BASE,
    rootY: -0.12,
    torsoZ: -0.65,
    headX: -0.1,
    shRX: 0.4,
    shRZ: -0.9,
    shLX: 1.4,
    shLZ: 0.5,
    elL: -0.6,
    hipRX: 0.15,
    kneeR: 0.5,
    kneeL: 0.25,
  },
  right: {
    ...BASE,
    rootY: -0.12,
    torsoZ: 0.65,
    headX: -0.1,
    shLX: 0.4,
    shLZ: 0.9,
    shRX: 1.4,
    shRZ: -0.5,
    elR: -0.6,
    hipLX: 0.15,
    kneeL: 0.5,
    kneeR: 0.25,
  },
  hit: {
    ...BASE,
    rootY: -0.18,
    rootZ: -0.1,
    torsoX: 0.35,
    torsoZ: -0.3,
    headX: 0.3,
    shLX: 1.1,
    shLZ: -0.4, // clutching across
    elL: -1.9,
    shRX: 0.5,
    shRZ: -0.4,
    elR: -0.8,
    kneeL: 0.45,
    kneeR: 0.6,
  },
};

const COAT = '#141518';
const COAT_TRIM = '#0c0d10';
const SHIRT = '#26282c';
const SKIN = '#c8a88e';
const HAIR = '#1a1512';

interface AvatarProps {
  ctl: MutableRefObject<AvatarCtl>;
  position?: [number, number, number];
}

/**
 * The player's visible body: long dark coat, dark glasses, built from ~26
 * primitives on the dojo's channel/lerp animator. Faces -z (toward the
 * shooter); the camera rig orbits it from behind.
 */
export function Avatar({ ctl, position = [0, 0, 0] }: AvatarProps) {
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
  const root = useRef<Group>(null);
  const cur = useMemo<Pose>(() => ({ ...BASE }), []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const target = POSES[ctl.current.pose];
    // Dodges snap in hard (the whole read is the silhouette change);
    // recovery back to ready eases out slower.
    const rate = ctl.current.pose === 'ready' ? 5 : 13;
    const f = 1 - Math.exp(-rate * dt);
    for (const key of Object.keys(cur) as (keyof Pose)[]) {
      cur[key] += (target[key] - cur[key]) * f;
    }
    const breathe = Math.sin(clock.elapsedTime * 1.9) * 0.012;

    if (root.current) {
      // rootZ is "hips forward along facing"; the body faces world -z.
      root.current.position.set(position[0], position[1] + cur.rootY, position[2] - cur.rootZ);
    }
    if (torso.current) {
      torso.current.rotation.x = cur.torsoX + breathe;
      torso.current.rotation.z = cur.torsoZ;
    }
    if (head.current) head.current.rotation.x = cur.headX;
    if (shL.current) shL.current.rotation.set(cur.shLX, 0, cur.shLZ + breathe);
    if (shR.current) shR.current.rotation.set(cur.shRX, 0, cur.shRZ - breathe);
    if (elL.current) elL.current.rotation.x = cur.elL;
    if (elR.current) elR.current.rotation.x = cur.elR;
    if (hipL.current) hipL.current.rotation.x = cur.hipLX;
    if (hipR.current) hipR.current.rotation.x = cur.hipRX;
    if (kneeL.current) kneeL.current.rotation.x = cur.kneeL;
    if (kneeR.current) kneeR.current.rotation.x = cur.kneeR;
  });

  return (
    // Rotated π so the model's front (+z features) faces the shooter at -z.
    <group ref={root} position={position} rotation={[0, Math.PI, 0]}>
      {/* Hips */}
      <mesh position={[0, 0.96, 0]}>
        <boxGeometry args={[0.32, 0.2, 0.2]} />
        <meshStandardMaterial color={COAT_TRIM} roughness={0.7} />
      </mesh>

      {/* Legs */}
      {([-1, 1] as const).map((side) => {
        const hip = side < 0 ? hipL : hipR;
        const knee = side < 0 ? kneeL : kneeR;
        return (
          <group key={side} ref={hip} position={[side * 0.1, 0.92, 0]}>
            <mesh position={[0, -0.21, 0]}>
              <capsuleGeometry args={[0.07, 0.3, 4, 10]} />
              <meshStandardMaterial color={COAT_TRIM} roughness={0.7} />
            </mesh>
            <group ref={knee} position={[0, -0.45, 0]}>
              <mesh position={[0, -0.18, 0]}>
                <capsuleGeometry args={[0.055, 0.28, 4, 10]} />
                <meshStandardMaterial color={COAT_TRIM} roughness={0.7} />
              </mesh>
              <mesh position={[0, -0.36, 0.05]}>
                <boxGeometry args={[0.09, 0.05, 0.22]} />
                <meshStandardMaterial color="#08090b" roughness={0.5} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* Torso pivots at the waist — the arch bends here */}
      <group ref={torso} position={[0, 1.06, 0]}>
        <mesh position={[0, 0.27, 0]}>
          <capsuleGeometry args={[0.165, 0.3, 4, 12]} />
          <meshStandardMaterial color={COAT} roughness={0.65} />
        </mesh>
        {/* Shirt V under the coat */}
        <mesh position={[0, 0.32, 0.14]}>
          <boxGeometry args={[0.1, 0.24, 0.02]} />
          <meshStandardMaterial color={SHIRT} roughness={0.8} />
        </mesh>
        {/* Coat skirt flaps */}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.09, -0.28, -0.02]} rotation={[0.08, 0, s * -0.06]}>
            <boxGeometry args={[0.17, 0.55, 0.16]} />
            <meshStandardMaterial color={COAT} roughness={0.65} />
          </mesh>
        ))}

        {/* Head + dark glasses */}
        <group ref={head} position={[0, 0.58, 0]}>
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.11, 20, 16]} />
            <meshStandardMaterial color={SKIN} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.145, -0.01]}>
            <sphereGeometry args={[0.108, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            <meshStandardMaterial color={HAIR} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.075, 0.1]}>
            <boxGeometry args={[0.15, 0.032, 0.03]} />
            <meshStandardMaterial color="#0a0a0c" roughness={0.2} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.015, 0.02]}>
            <cylinderGeometry args={[0.042, 0.055, 0.07, 10]} />
            <meshStandardMaterial color={SKIN} roughness={0.55} />
          </mesh>
        </group>

        {/* Arms */}
        {([-1, 1] as const).map((side) => {
          const sh = side < 0 ? shL : shR;
          const el = side < 0 ? elL : elR;
          return (
            <group key={side} ref={sh} position={[side * 0.24, 0.44, 0]}>
              <mesh position={[0, -0.15, 0]}>
                <capsuleGeometry args={[0.052, 0.22, 4, 10]} />
                <meshStandardMaterial color={COAT} roughness={0.65} />
              </mesh>
              <group ref={el} position={[0, -0.3, 0]}>
                <mesh position={[0, -0.13, 0]}>
                  <capsuleGeometry args={[0.045, 0.2, 4, 10]} />
                  <meshStandardMaterial color={COAT} roughness={0.65} />
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
