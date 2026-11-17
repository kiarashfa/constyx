import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, LatheGeometry, Quaternion, Vector2, Vector3, type Group, type Mesh, type MeshBasicMaterial } from 'three';

export type DodgeDir = 'back' | 'left' | 'right';

/** One pooled bullet slot — the system mutates these, the view renders them. */
export interface BulletSlot {
  active: boolean;
  dir: DodgeDir;
  from: Vector3;
  to: Vector3;
  /** Sim-clock seconds. */
  bornAt: number;
  flightSec: number;
  /** 'doomed' = wrong lean locked in; flies on and converts to a hit. */
  resolved: 'pending' | 'dodged' | 'hit' | 'doomed';
  /** Sim-clock time the hit spark started (if hit). */
  sparkAt: number;
  promptShown: boolean;
}

export const MAX_BULLETS = 6;
const RINGS_PER_BULLET = 22;
/** Meters of travel between wake rings (the film's trail is a close train of air ripples). */
const RING_SPACING = 0.42;
const RING_LIFE = 1.5;

export function makeBulletPool(): BulletSlot[] {
  return Array.from({ length: MAX_BULLETS }, () => ({
    active: false,
    dir: 'back' as DodgeDir,
    from: new Vector3(),
    to: new Vector3(),
    bornAt: 0,
    flightSec: 1,
    resolved: 'pending' as BulletSlot['resolved'],
    sparkAt: 0,
    promptShown: false,
  }));
}

interface RingState {
  age: number;
  alive: boolean;
}

/**
 * Renders the pool: each slot is a tracer capsule plus a trail of expanding,
 * fading air-ripple rings (the film's wake effect), plus a hit spark. All
 * imperative — zero React churn during waves.
 */
export function BulletsView({
  slots,
  clockRef,
}: {
  slots: MutableRefObject<BulletSlot[]>;
  clockRef: MutableRefObject<number>;
}) {
  const groups = useRef<(Group | null)[]>([]);
  const tracers = useRef<(Mesh | null)[]>([]);
  const sparks = useRef<(Mesh | null)[]>([]);
  const rings = useRef<(Mesh | null)[][]>(
    Array.from({ length: MAX_BULLETS }, () => Array(RINGS_PER_BULLET).fill(null)),
  );
  const ringState = useRef<RingState[][]>(
    Array.from({ length: MAX_BULLETS }, () =>
      Array.from({ length: RINGS_PER_BULLET }, () => ({ age: 99, alive: false })),
    ),
  );
  const lastRingDist = useRef<number[]>(Array(MAX_BULLETS).fill(0));
  const tmp = useMemo(() => new Vector3(), []);
  const dirVec = useMemo(() => new Vector3(), []);
  const quat = useMemo(() => new Quaternion(), []);
  const Z_AXIS = useMemo(() => new Vector3(0, 0, 1), []);
  // The slug: a lathed round-nose bullet whose nose points along +z, the axis the
  // per-frame quaternion turns onto the flight direction.
  const slugGeometry = useMemo(() => {
    const r = 0.0065;
    const pts = [
      new Vector2(0, -0.016),
      new Vector2(r, -0.016),
      new Vector2(r, 0.002),
      new Vector2(r * 0.85, 0.008),
      new Vector2(r * 0.5, 0.013),
      new Vector2(0, 0.016),
    ];
    const g = new LatheGeometry(pts, 10);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const now = clockRef.current;
    slots.current.forEach((slot, i) => {
      const g = groups.current[i];
      const tracer = tracers.current[i];
      const spark = sparks.current[i];
      if (!g || !tracer || !spark) return;
      if (!slot.active) {
        g.visible = false;
        return;
      }
      g.visible = true;

      const t = (now - slot.bornAt) / slot.flightSec;
      dirVec.subVectors(slot.to, slot.from);
      const pathLen = dirVec.length();
      dirVec.normalize();
      quat.setFromUnitVectors(Z_AXIS, dirVec);

      // Tracer position: dodged bullets keep flying past (t > 1); hits stop.
      const tClamped = slot.resolved === 'hit' ? Math.min(t, 1) : t;
      tmp.copy(slot.from).addScaledVector(dirVec, tClamped * pathLen);
      tracer.position.copy(tmp);
      tracer.quaternion.copy(quat);
      tracer.visible = slot.resolved !== 'hit' || t < 1;

      // Spawn a wake ring every RING_SPACING meters while in flight.
      const traveled = Math.min(t, 1.15) * pathLen;
      if (t > 0 && t < 1.1 && traveled - lastRingDist.current[i] >= RING_SPACING) {
        lastRingDist.current[i] = traveled;
        const states = ringState.current[i];
        const idx = states.findIndex((r) => !r.alive || r.age > RING_LIFE);
        const use = idx >= 0 ? idx : 0;
        const ring = rings.current[i][use];
        if (ring) {
          ring.position.copy(tmp);
          ring.quaternion.copy(quat);
          states[use] = { age: 0, alive: true };
        }
      }
      // Age rings: expand + fade.
      ringState.current[i].forEach((r, j) => {
        const ring = rings.current[i][j];
        if (!ring) return;
        if (!r.alive || r.age > RING_LIFE) {
          ring.visible = false;
          return;
        }
        r.age += dt;
        ring.visible = true;
        // the ripple swells only a little: wide rings would seem to cut through the dodging body
        const s = 1 + r.age * 1.5;
        ring.scale.set(s, s, 1);
        const mat = ring.material as MeshBasicMaterial;
        const k = 1 - r.age / RING_LIFE;
        mat.opacity = Math.max(0, 0.42 * k * k);
      });

      // Hit spark: brief flare at the impact point.
      if (slot.resolved === 'hit' && now - slot.sparkAt < 0.3) {
        spark.visible = true;
        spark.position.copy(slot.to);
        const k = 1 + (now - slot.sparkAt) * 8;
        spark.scale.set(k, k, k);
      } else {
        spark.visible = false;
      }

      // Retire: hits after the spark, dodges once well past the avatar.
      if ((slot.resolved === 'hit' && now - slot.sparkAt > 0.35) || t > 1.6) {
        slot.active = false;
        lastRingDist.current[i] = 0;
        ringState.current[i].forEach((r) => {
          r.alive = false;
          r.age = 99;
        });
      }
    });
  });

  return (
    <>
      {Array.from({ length: MAX_BULLETS }, (_, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
          <mesh ref={(m) => void (tracers.current[i] = m)} geometry={slugGeometry}>
            <meshBasicMaterial color="#b89a5c" toneMapped={false} />
          </mesh>
          {Array.from({ length: RINGS_PER_BULLET }, (_, j) => (
            <mesh key={j} ref={(m) => void (rings.current[i][j] = m)} visible={false}>
              <torusGeometry args={[0.065, 0.0055, 6, 28]} />
              <meshBasicMaterial
                color="#f4fbf6"
                transparent
                opacity={0.4}
                depthWrite={false}
                blending={AdditiveBlending}
                toneMapped={false}
              />
            </mesh>
          ))}
          <mesh ref={(m) => void (sparks.current[i] = m)} visible={false}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#fff3dc" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}
