import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  Euler,
  Quaternion,
  Vector3,
  type Bone,
  type Group,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { getGLTF, preloadGLTF } from '../../engine3d/assets';
import type { AttackKind } from './combat';
import opponentUrl from './assets/opponent.glb?url';

export const preloadOpponent = () => preloadGLTF(opponentUrl);

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

type V3 = [number, number, number];

/**
 * A pose is a handful of limb directions in the body frame (x: his left,
 * y: up, z: the way he faces) plus the torso lean. Arms ride on the leaning
 * chest; legs hang from the hips. No joint angles to keep consistent.
 */
interface Pose {
  /** Forward lean of the torso (radians), side lean, twist, head nod. */
  lean: number;
  side: number;
  twist: number;
  head: number;
  /** Step along the facing direction (lunges / recoils), metres. */
  adv: number;
  armL: V3;
  foreL: V3;
  armR: V3;
  foreR: V3;
  legL: V3;
  shinL: V3;
  legR: V3;
  shinR: V3;
}

const STAND = {
  legL: [0.09, -1, 0.02] as V3,
  shinL: [0.03, -1, -0.04] as V3,
  legR: [-0.09, -1, 0.02] as V3,
  shinR: [-0.03, -1, -0.04] as V3,
};

const POSES: Record<string, Pose> = {
  idle: {
    lean: 0.03, side: 0, twist: 0, head: 0, adv: 0,
    armL: [0.2, -1, 0.02], foreL: [0.1, -1, 0.3],
    armR: [-0.2, -1, 0.02], foreR: [-0.1, -1, 0.3],
    ...STAND,
  },
  // Open-hand guard, left side leading.
  guard: {
    lean: 0.1, side: 0, twist: -0.35, head: 0.05, adv: 0,
    armL: [0.3, -0.6, 0.75], foreL: [-0.25, 0.55, 0.8],
    armR: [-0.4, -0.85, 0.2], foreR: [0.35, 0.3, 0.9],
    legL: [0.2, -0.9, 0.4], shinL: [0, -1, -0.15],
    legR: [-0.24, -0.9, -0.25], shinR: [0, -1, -0.25],
  },
  bow: {
    lean: 0.8, side: 0, twist: 0, head: 0.25, adv: 0,
    armL: [0.16, -1, 0.0], foreL: [0.1, -1, 0.12],
    armR: [-0.16, -1, 0.0], foreR: [-0.1, -1, 0.12],
    ...STAND,
  },
  stagger: {
    lean: -0.45, side: 0.12, twist: 0.2, head: -0.3, adv: -0.7,
    armL: [0.85, 0.15, 0.3], foreL: [0.6, 0.6, 0.35],
    armR: [-0.85, 0.0, 0.2], foreR: [-0.7, 0.5, 0.4],
    legL: [0.16, -0.95, 0.3], shinL: [0, -1, -0.35],
    legR: [-0.2, -0.9, -0.3], shinR: [0, -1, -0.1],
  },
  // LOW SWEEP: sinks into a deep crouch with the right leg coiled, then the
  // leg whips through at shin height.
  sweepTele: {
    lean: 0.45, side: 0, twist: 0.3, head: -0.25, adv: 0,
    armL: [0.5, -0.5, 0.6], foreL: [-0.3, 0.2, 0.9],
    armR: [-0.6, -0.7, -0.2], foreR: [-0.2, -0.6, 0.6],
    legL: [0.35, -0.45, 0.75], shinL: [0, -0.8, -0.6],
    legR: [-0.4, -0.6, -0.3], shinR: [0, -0.55, -0.8],
  },
  sweepStrike: {
    lean: 0.3, side: 0.3, twist: -0.5, head: -0.2, adv: 0.25,
    armL: [0.75, -0.3, 0.2], foreL: [0.4, 0.3, 0.6],
    armR: [-0.8, -0.3, -0.2], foreR: [-0.7, -0.2, 0.3],
    legL: [0.4, -0.25, 0.7], shinL: [0, -0.75, -0.65],
    legR: [-0.5, -0.5, 0.75], shinR: [0.25, -0.5, 0.85],
  },
  // HEAVY PALM: both arms rise high overhead, then drive straight out.
  heavyTele: {
    lean: -0.16, side: 0, twist: 0, head: -0.25, adv: 0,
    armL: [0.28, 0.9, 0.12], foreL: [0.02, 0.95, 0.3],
    armR: [-0.28, 0.9, 0.12], foreR: [-0.02, 0.95, 0.3],
    legL: [0.14, -1, 0.1], shinL: [0, -1, -0.12],
    legR: [-0.14, -1, 0.1], shinR: [0, -1, -0.12],
  },
  heavyStrike: {
    lean: 0.5, side: 0, twist: 0, head: -0.3, adv: 0.35,
    armL: [0.12, 0.3, 1], foreL: [-0.04, 0.4, 1],
    armR: [-0.12, 0.3, 1], foreR: [0.04, 0.4, 1],
    legL: [0.16, -0.8, 0.55], shinL: [0, -1, -0.1],
    legR: [-0.2, -0.9, -0.35], shinR: [0, -1, -0.3],
  },
  // OVERCOMMITTED LUNGE: leans away with the right hand chambered at the hip,
  // then a long, deep overreach: the opening you punish.
  lungeTele: {
    lean: -0.3, side: 0, twist: 0.5, head: 0.1, adv: -0.45,
    armL: [0.3, -0.4, 0.85], foreL: [-0.2, 0.5, 0.8],
    armR: [-0.3, -0.75, -0.6], foreR: [-0.05, 0.1, 1],
    legL: [0.16, -0.9, 0.35], shinL: [0, -1, -0.05],
    legR: [-0.2, -0.85, -0.3], shinR: [0, -1, -0.35],
  },
  lungeStrike: {
    lean: 0.5, side: 0, twist: -0.55, head: -0.3, adv: 1.0,
    armL: [0.45, -0.7, -0.5], foreL: [0.3, -0.5, -0.2],
    armR: [-0.1, 0.25, 1], foreR: [-0.02, 0.3, 1],
    legL: [0.15, -0.45, 0.9], shinL: [0, -1, 0.05],
    legR: [-0.15, -0.75, -0.75], shinR: [0, -0.8, -0.6],
  },
};

const SCALARS = ['lean', 'side', 'twist', 'head', 'adv'] as const;
const VECTORS = ['armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR'] as const;

function clonePose(p: Pose): Pose {
  const out = { ...p };
  for (const key of VECTORS) out[key] = [...p[key]] as V3;
  return out;
}

const ENGAGE_DIST: Partial<Record<OpponentMode, number>> = {
  strike: 1.85,
  telegraph: 2.05,
  stagger: 3.1,
};
const DEFAULT_DIST = 2.25;
const HOME: [number, number, number] = [0, 0, -1.6];
/** Ankle height when the sole is flat on the mat. */
const ANKLE = 0.076;

interface Rig {
  root: Object3D;
  bones: Record<string, Bone>;
  rest: Map<Bone, Quaternion>;
  /** Rest orientation of the torso bones in model space. */
  restWorld: Map<Bone, Quaternion>;
}

function prepareRig(): Rig | null {
  const gltf = getGLTF(opponentUrl);
  if (!gltf) return null;
  const root = gltf.scene;
  const bones: Record<string, Bone> = {};
  const rest = new Map<Bone, Quaternion>();
  const restWorld = new Map<Bone, Quaternion>();
  root.updateMatrixWorld(true);
  const inverseRoot = root.getWorldQuaternion(new Quaternion()).invert();
  root.traverse((node) => {
    const bone = node as Bone;
    if (bone.isBone) {
      bones[bone.name] = bone;
      if (!bone.userData.rest) bone.userData.rest = bone.quaternion.clone();
      bone.quaternion.copy(bone.userData.rest as Quaternion);
    }
    const mesh = node as SkinnedMesh;
    if (mesh.isSkinnedMesh) {
      mesh.frustumCulled = false;
      (mesh.material as MeshStandardMaterial).envMapIntensity = 1.0;
    }
  });
  root.updateMatrixWorld(true);
  for (const bone of Object.values(bones)) {
    rest.set(bone, (bone.userData.rest as Quaternion).clone());
    restWorld.set(bone, inverseRoot.clone().multiply(bone.getWorldQuaternion(new Quaternion())));
  }
  if (!bones.Hips || !bones.Chest || !bones.UpperArmL || !bones.ThighL) return null;
  return { root, bones, rest, restWorld };
}

/** Soft blob that grounds him on the mat. */
function makeShadowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

interface OpponentProps {
  ctl: MutableRefObject<OpponentCtl>;
  /** Rendered inside the moving root, e.g. a dynamic Interactable anchor. */
  children?: ReactNode;
}

const UP = new Vector3(0, 1, 0);
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const qTorso = new Quaternion();
const qYaw = new Quaternion();
const vA = new Vector3();
const vB = new Vector3();
const euler = new Euler();

/**
 * The sparring partner: a skinned figure posed procedurally. Each frame the
 * active pose (limb directions) is eased in, bones are aimed along those
 * directions, and the whole figure is dropped so the lower foot stays on the
 * mat. Footwork keeps sparring distance from the live player position.
 */
export function Opponent({ ctl, children }: OpponentProps) {
  const camera = useThree((state) => state.camera);
  const root = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const rig = useMemo(prepareRig, []);
  const shadow = useMemo(makeShadowTexture, []);
  const cur = useMemo<Pose>(() => clonePose(POSES.idle), []);
  const forced = useRef<string | null>(null);
  const turned = useRef(0);

  useEffect(() => () => shadow.dispose(), [shadow]);

  // Dev handle: hold a named pose for inspection.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__opponentDebug = {
        pose: (name: string | null) => void (forced.current = name),
        turn: (offset: number) => void (turned.current = offset),
        poses: Object.keys(POSES),
        root,
      };
    }
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = ctl.current;
    const t = clock.elapsedTime;
    const g = root.current;
    if (!g) return;

    // ---- pick and ease toward the target pose ----
    let target: Pose;
    if (forced.current && POSES[forced.current]) target = POSES[forced.current];
    else if (c.mode === 'telegraph') target = POSES[`${c.kind}Tele`];
    else if (c.mode === 'strike') target = POSES[`${c.kind}Strike`];
    else target = POSES[c.mode] ?? POSES.idle;

    // Strikes snap; telegraphs settle quickly; everything else eases.
    const rate = c.mode === 'strike' ? 16 : c.mode === 'telegraph' ? 8 : 5;
    const f = 1 - Math.exp(-rate * dt);
    for (const key of SCALARS) cur[key] += (target[key] - cur[key]) * f;
    for (const key of VECTORS) {
      for (let i = 0; i < 3; i++) cur[key][i] += (target[key][i] - cur[key][i]) * f;
    }

    // ---- footwork: hold sparring distance from the live player ----
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
      // Unengaged: drift slowly around the centre of the mat.
      targetX = HOME[0] + Math.sin(t * 0.35) * 1.4;
      targetZ = HOME[2] + Math.cos(t * 0.22) * 0.7;
    }
    const moveRate = c.mode === 'strike' ? 8 : 2.4;
    const mf = 1 - Math.exp(-moveRate * dt);
    g.position.x += (targetX - g.position.x) * mf;
    g.position.z += (targetZ - g.position.z) * mf;

    // Face the player (he never turns his back), advance along the gaze.
    const yaw = Math.atan2(px - g.position.x, pz - g.position.z) + turned.current;
    let dYaw = yaw - g.rotation.y;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    g.rotation.y += dYaw * Math.min(1, 6 * dt);
    g.position.x += Math.sin(g.rotation.y) * cur.adv * mf * 2;
    g.position.z += Math.cos(g.rotation.y) * cur.adv * mf * 2;

    if (!rig || !lift.current) return;
    const { bones, rest, restWorld } = rig;

    // ---- pose the skeleton ----
    for (const [bone, q] of rest) bone.quaternion.copy(q);
    // Breathing / telegraph tremor so held poses stay alive.
    const breathe = c.mode === 'telegraph' ? Math.sin(t * 9) * 0.02 : Math.sin(t * 1.7) * 0.012;
    const lean = cur.lean + breathe;

    // Torso: half of the lean in the lower spine, half in the chest.
    const bend = (bone: Bone, x: number, y: number, z: number) => {
      const world = restWorld.get(bone)!;
      qA.setFromEuler(euler.set(x, y, z, 'YXZ'));
      qB.copy(world).invert().multiply(qA).multiply(world);
      bone.quaternion.multiply(qB);
    };
    bend(bones.Spine, lean * 0.5, cur.twist * 0.5, cur.side * 0.5);
    bend(bones.Chest, lean * 0.5, cur.twist * 0.5, cur.side * 0.5);
    bend(bones.Head, cur.head, -cur.twist * 0.8, 0);

    g.updateWorldMatrix(true, false);
    qYaw.setFromEuler(euler.set(0, g.rotation.y, 0, 'YXZ'));
    qA.setFromEuler(euler.set(lean * 0.5, cur.twist * 0.5, cur.side * 0.5, 'YXZ'));
    qTorso.copy(qYaw).multiply(qA).multiply(qA);

    // Aim a bone's length along a direction given in `frame`.
    const aim = (bone: Bone, dir: V3 | Vector3, frame: Quaternion) => {
      const parent = bone.parent!;
      parent.updateWorldMatrix(true, false);
      parent.getWorldQuaternion(qA);
      if (Array.isArray(dir)) vA.set(dir[0], dir[1], dir[2]);
      else vA.copy(dir);
      vA.normalize().applyQuaternion(frame);
      vB.copy(UP).applyQuaternion(qB.copy(qA).multiply(bone.quaternion));
      qC.setFromUnitVectors(vB, vA);
      // local = parent^-1 * arc * parent * local
      bone.quaternion.premultiply(qB.copy(qA)).premultiply(qC).premultiply(qA.invert());
    };
    aim(bones.UpperArmL, cur.armL, qTorso);
    aim(bones.ForeArmL, cur.foreL, qTorso);
    aim(bones.UpperArmR, cur.armR, qTorso);
    aim(bones.ForeArmR, cur.foreR, qTorso);
    aim(bones.ThighL, cur.legL, qYaw);
    aim(bones.ShinL, cur.shinL, qYaw);
    aim(bones.ThighR, cur.legR, qYaw);
    aim(bones.ShinR, cur.shinR, qYaw);
    // Feet stay flat, toes turned out a touch.
    aim(bones.FootL, vB.set(0.12, -0.3, 0.95), qYaw);
    aim(bones.FootR, vB.set(-0.12, -0.3, 0.95), qYaw);

    // ---- keep the lower foot on the mat ----
    lift.current.updateWorldMatrix(true, true);
    const yL = bones.FootL.getWorldPosition(vA).y;
    const yR = bones.FootR.getWorldPosition(vB).y;
    lift.current.position.y -= Math.min(yL, yR) - ANKLE;
  });

  return (
    <group ref={root} position={HOME}>
      {children}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={1}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={lift}>{rig && <primitive object={rig.root} />}</group>
    </group>
  );
}
