import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';

/* ---------------------------------------------------------------- people
 * Lightweight crowd: each pedestrian is ~9 primitives with only four
 * animated joints (both hips + both shoulders) driven by one shared
 * useFrame — no per-NPC subscriptions, no React state. The walk cycle is
 * a phase-offset sine; personality comes from palette, height, speed and
 * bob amplitude. The Agent is the one body that DOESN'T move like that.
 */

export interface Walker {
  root: Group | null;
  armL: Group | null;
  armR: Group | null;
  legL: Group | null;
  legR: Group | null;
  head: Group | null;
  x: number;
  z: number;
  dir: 1 | -1;
  speed: number;
  phase: number;
  bob: number;
  /** 'npc' sway normally; 'agent' is unnaturally level; 'woman' glances. */
  kind: 'npc' | 'agent' | 'woman';
  active: boolean;
  /** Agent only: patrol turnaround points. */
  patrolMin: number;
  patrolMax: number;
}

const COATS = ['#5a5348', '#4a4f58', '#6b5f4c', '#57604f', '#5f5560', '#4e463f'];
const PANTS = ['#3a3833', '#33373d', '#403a30'];
const SKINS = ['#c8a88e', '#8a6248', '#deb896', '#a97c5c'];

function seededRand(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Body builder shared by NPCs / the Agent / the woman in red. */
function Body({
  walker,
  coat,
  pants,
  skin,
  scale,
  suit = false,
  dress = false,
}: {
  walker: Walker;
  coat: string;
  pants: string;
  skin: string;
  scale: number;
  suit?: boolean;
  dress?: boolean;
}) {
  return (
    <group ref={(g) => void (walker.root = g)} scale={scale}>
      {/* legs (hidden under the dress skirt for the woman) */}
      {([-1, 1] as const).map((s) => (
        <group
          key={s}
          ref={(g) => void (s < 0 ? (walker.legL = g) : (walker.legR = g))}
          position={[s * 0.1, 0.9, 0]}
        >
          <mesh position={[0, -0.44, 0]}>
            <capsuleGeometry args={[0.062, 0.72, 4, 8]} />
            <meshStandardMaterial color={dress ? skin : pants} roughness={0.75} />
          </mesh>
        </group>
      ))}
      {/* torso */}
      <mesh position={[0, 1.26, 0]}>
        <capsuleGeometry args={[0.16, 0.42, 4, 10]} />
        <meshStandardMaterial color={coat} roughness={dress ? 0.5 : 0.75} />
      </mesh>
      {dress && (
        <mesh position={[0, 0.78, 0]}>
          <coneGeometry args={[0.3, 0.75, 12]} />
          <meshStandardMaterial color={coat} roughness={0.5} />
        </mesh>
      )}
      {suit && (
        <>
          <mesh position={[0, 1.32, 0.14]}>
            <boxGeometry args={[0.08, 0.28, 0.02]} />
            <meshStandardMaterial color="#d8dade" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.29, 0.15]}>
            <boxGeometry args={[0.028, 0.22, 0.015]} />
            <meshStandardMaterial color="#101216" roughness={0.6} />
          </mesh>
        </>
      )}
      {/* arms */}
      {([-1, 1] as const).map((s) => (
        <group
          key={s}
          ref={(g) => void (s < 0 ? (walker.armL = g) : (walker.armR = g))}
          position={[s * 0.23, 1.5, 0]}
        >
          <mesh position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.048, 0.42, 4, 8]} />
            <meshStandardMaterial color={coat} roughness={dress ? 0.55 : 0.75} />
          </mesh>
        </group>
      ))}
      {/* head */}
      <group ref={(g) => void (walker.head = g)} position={[0, 1.78, 0]}>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.105, 14, 12]} />
          <meshStandardMaterial color={skin} roughness={0.55} />
        </mesh>
        {dress ? (
          <mesh position={[0, 0.1, -0.02]}>
            <sphereGeometry args={[0.112, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color="#d9b36a" roughness={0.6} />
          </mesh>
        ) : (
          <mesh position={[0, 0.11, -0.01]}>
            <sphereGeometry args={[0.106, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color={suit ? '#2a2118' : '#3a2f24'} roughness={0.8} />
          </mesh>
        )}
        {suit && (
          <>
            <mesh position={[0, 0.06, 0.095]}>
              <boxGeometry args={[0.135, 0.03, 0.026]} />
              <meshStandardMaterial color="#0a0a0c" roughness={0.2} metalness={0.4} />
            </mesh>
            {/* the earpiece — visible when you get close enough to look */}
            <mesh position={[0.105, 0.04, 0]}>
              <boxGeometry args={[0.022, 0.035, 0.022]} />
              <meshStandardMaterial color="#1c1e22" roughness={0.4} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}

/* -------------------------------------------------------------- the crowd */

export interface CrowdCtl {
  walkers: Walker[];
  agent: Walker;
  woman: Walker;
  /** 0..100, written by the detection logic in index. */
  hintRingUntil: number;
}

export function makeWalker(kind: Walker['kind']): Walker {
  return {
    root: null,
    armL: null,
    armR: null,
    legL: null,
    legR: null,
    head: null,
    x: 0,
    z: 0,
    dir: 1,
    speed: 1.2,
    phase: 0,
    bob: 1,
    kind,
    active: true,
    patrolMin: -6,
    patrolMax: 6,
  };
}

const LANES = [-6.4, -5.3, -4.5, 4.5, 5.6, 6.6];
const WRAP = 30;

export function makeCrowd(agentSeed: number): CrowdCtl {
  const rand = seededRand(9000 + agentSeed);
  const walkers: Walker[] = [];
  for (let i = 0; i < 22; i++) {
    const w = makeWalker('npc');
    w.x = LANES[Math.floor(rand() * LANES.length)] + (rand() - 0.5) * 0.5;
    w.z = -28 + rand() * 56;
    w.dir = rand() < 0.5 ? 1 : -1;
    w.speed = 1.0 + rand() * 0.6;
    w.phase = rand() * Math.PI * 2;
    w.bob = 0.8 + rand() * 0.5;
    walkers.push(w);
  }
  // The Agent: posted mid-street, patrolling a short beat. Side + center
  // re-randomize every reset so failed attempts still require scanning.
  const agent = makeWalker('agent');
  agent.x = rand() < 0.5 ? 5.0 : -5.0;
  const center = -8 + rand() * 16;
  agent.patrolMin = center - 6;
  agent.patrolMax = center + 6;
  agent.z = center;
  agent.dir = 1;
  agent.speed = 0.9;
  agent.bob = 0;
  // Her: walks against the flow on the player's side, unhurried.
  const woman = makeWalker('woman');
  woman.x = 5.9;
  woman.z = -4;
  woman.dir = 1;
  woman.speed = 1.05;
  woman.phase = 1.3;
  woman.bob = 0.9;
  return { walkers: [...walkers, agent, woman], agent, woman, hintRingUntil: 0 };
}

export function Crowd({ ctl, children }: { ctl: MutableRefObject<CrowdCtl>; children?: ReactNode }) {
  const camera = useThree((state) => state.camera);
  const hintRing = useRef<Group>(null);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const { walkers, agent } = ctl.current;
    for (const w of walkers) {
      const g = w.root;
      if (!g) continue;
      g.visible = w.active;
      if (!w.active) continue;

      // Locomotion
      if (w.kind === 'agent') {
        w.z += w.dir * w.speed * dt;
        if (w.z > w.patrolMax) w.dir = -1;
        if (w.z < w.patrolMin) w.dir = 1;
      } else {
        w.z += w.dir * w.speed * dt;
        if (w.z > WRAP) w.z = -WRAP;
        if (w.z < -WRAP) w.z = WRAP;
      }
      g.position.set(w.x, 0, w.z);

      // Facing + gait
      const swing = Math.sin(t * 4.2 * w.speed + w.phase);
      if (w.kind === 'agent') {
        // The tell: no bob, no sway, machine-straight — and he watches you.
        g.position.y = 0;
        g.rotation.y = w.dir > 0 ? 0 : Math.PI;
        if (w.armL) w.armL.rotation.x = swing * 0.08;
        if (w.armR) w.armR.rotation.x = -swing * 0.08;
        if (w.legL) w.legL.rotation.x = swing * 0.35;
        if (w.legR) w.legR.rotation.x = -swing * 0.35;
        if (w.head) {
          const dx = camera.position.x - w.x;
          const dz = camera.position.z - w.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 16) {
            // World yaw toward the player, converted into head-local yaw.
            const worldYaw = Math.atan2(dx, dz);
            const target = worldYaw - g.rotation.y;
            w.head.rotation.y = MathUtils.lerp(
              w.head.rotation.y,
              Math.atan2(Math.sin(target), Math.cos(target)),
              1 - Math.exp(-4 * dt),
            );
          } else {
            w.head.rotation.y = MathUtils.lerp(w.head.rotation.y, 0, 1 - Math.exp(-2 * dt));
          }
        }
      } else {
        g.position.y = Math.abs(Math.sin(t * 4.2 * w.speed + w.phase)) * 0.03 * w.bob;
        g.rotation.y = (w.dir > 0 ? 0 : Math.PI) + swing * 0.045 * w.bob;
        if (w.armL) w.armL.rotation.x = swing * 0.5;
        if (w.armR) w.armR.rotation.x = -swing * 0.5;
        if (w.legL) w.legL.rotation.x = swing * 0.55;
        if (w.legR) w.legR.rotation.x = -swing * 0.55;
        if (w.head && w.kind === 'woman') {
          // A passing glance — human, brief, nothing like the Agent's lock.
          const dz = camera.position.z - w.z;
          const near = Math.abs(dz) < 4 && Math.abs(camera.position.x - w.x) < 4;
          w.head.rotation.y = MathUtils.lerp(
            w.head.rotation.y,
            near ? Math.sign(camera.position.x - w.x) * (w.dir > 0 ? 0.4 : -0.4) : 0,
            1 - Math.exp(-3 * dt),
          );
        }
      }
    }

    // Accessibility ping: a brief ring under the Agent.
    if (hintRing.current) {
      const show = performance.now() < ctl.current.hintRingUntil;
      hintRing.current.visible = show;
      if (show) {
        hintRing.current.position.set(agent.x, 0.05, agent.z);
        const p = 1 + Math.sin(t * 6) * 0.12;
        hintRing.current.scale.set(p, p, p);
      }
    }
  });

  const bodies = useMemo(() => {
    const rand = seededRand(777);
    return ctl.current.walkers.map((w, i) => {
      if (w.kind === 'agent') {
        return (
          <Body key={i} walker={w} coat="#22242b" pants="#1c1e24" skin="#c9a68a" scale={1.02} suit />
        );
      }
      if (w.kind === 'woman') {
        return <Body key={i} walker={w} coat="#c8102e" pants="#c8102e" skin="#deb896" scale={0.97} dress />;
      }
      return (
        <Body
          key={i}
          walker={w}
          coat={COATS[Math.floor(rand() * COATS.length)]}
          pants={PANTS[Math.floor(rand() * PANTS.length)]}
          skin={SKINS[Math.floor(rand() * SKINS.length)]}
          scale={0.92 + rand() * 0.14}
        />
      );
    });
    // Crowd composition is fixed per mount; resets remake the whole ctl.
  }, []);

  return (
    <>
      {bodies}
      <group ref={hintRing} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 24]} />
          <meshStandardMaterial color="#0d8a34" emissive="#00ff41" emissiveIntensity={1.2} transparent opacity={0.8} />
        </mesh>
      </group>
      {children}
    </>
  );
}

/* ------------------------------------------------- scripted distractions */

/** Black cat crosses… then crosses again. Déjà vu. */
export function DejaVuCat({ clockRef }: { clockRef: MutableRefObject<number> }) {
  const cat = useRef<Group>(null);
  useFrame(() => {
    const g = cat.current;
    if (!g) return;
    const t = clockRef.current;
    // Two identical crossings: 22s and 25.5s, then again every ~50s.
    const cycle = t % 50;
    const pass = cycle > 22 && cycle < 25 ? cycle - 22 : cycle > 25.5 && cycle < 28.5 ? cycle - 25.5 : -1;
    if (pass < 0) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(7.2 - pass * 2.2, 0, 14);
    g.rotation.y = -Math.PI / 2;
  });
  return (
    <group ref={cat} visible={false}>
      <mesh position={[0, 0.14, 0]}>
        <capsuleGeometry args={[0.07, 0.24, 4, 8]} />
        <meshStandardMaterial color="#0d0d0f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.24, 0.16]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshStandardMaterial color="#0d0d0f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, -0.18]} rotation={[0.9, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 0.22, 6]} />
        <meshStandardMaterial color="#0d0d0f" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Pigeons burst off the crosswalk when the player walks into them. */
export function Pigeons() {
  const camera = useThree((state) => state.camera);
  const flock = useRef<Group>(null);
  const state = useRef({ burstAt: -99 });
  useFrame(({ clock }) => {
    const g = flock.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const since = t - state.current.burstAt;
    const near = Math.hypot(camera.position.x - 0, camera.position.z - 10) < 5.5;
    if (near && since > 30) state.current.burstAt = t;
    g.children.forEach((bird, i) => {
      const b = since < 3 ? since : -1;
      if (b < 0) {
        bird.position.set(((i % 4) - 1.5) * 0.8, 0.06, 10 + Math.floor(i / 4) * 0.7);
        bird.rotation.z = 0;
      } else {
        bird.position.y = 0.06 + b * (2 + i * 0.3);
        bird.position.x = ((i % 4) - 1.5) * 0.8 + b * (i % 2 === 0 ? 2 : -2);
        bird.position.z = 10 + Math.floor(i / 4) * 0.7 - b * 1.5;
        bird.rotation.z = Math.sin(t * 18 + i) * 0.6;
      }
    });
  });
  return (
    <group ref={flock}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i}>
          <coneGeometry args={[0.05, 0.16, 5]} />
          <meshStandardMaterial color="#4a4f56" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
