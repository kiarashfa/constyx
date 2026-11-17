import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import { useSceneStore, type PlayerEvent, type SceneStore } from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { useAmbience, sfxThump } from '../../../../engine/audio';
import { RooftopHud, type RooftopPhase } from './RooftopHud';
import {
  BOX_AT,
  COLLIDERS,
  FAR,
  MORPHEUS_AT,
  PLATFORMS,
  RooftopWorld,
  preloadWorld,
  type DentCtl,
} from './World';
import {
  CHARGE_MS,
  FORWARD_BOOST,
  GAP,
  GRAVITY,
  JUMP_MAX_VY,
  JUMP_MIN_VY,
  MAX_FAILS,
  ROOF_B_Y,
  SPAWN,
  SPRINT_MAX,
  SPRINT_RAMP_SEC,
  STREET_Y,
  SWEET_END,
  SWEET_START,
} from './tuning';

/** Awaited by the scene route behind the jack-in transition. */
export const preload = preloadWorld;

/* ------------------------------------------------------------------ layout
 * Roof A: x in [-15, 15], z in [0, 23], y = 0. Spawn at the plant-room wall,
 *         the jump edge is the coping at z = 0 (a 0.28 m step, taken at a run).
 * Canyon: z in [-28, 0], the street 160 m below.
 * Roof B: z in [-52, -28], 3 m lower. Morpheus waits on it.
 * Platforms and colliders are generated with the scene (layout.json).
 */

/** Hands the SceneStore up to the scene root (which sits outside the provider). */
function StoreTap({ onStore }: { onStore: (store: SceneStore) => void }) {
  const store = useSceneStore();
  useEffect(() => onStore(store), [store, onStore]);
  return null;
}

/** Invisible focus point for an Interactable on part of the baked scene. */
function Anchor({ at }: { at: [number, number, number] }) {
  return (
    <mesh position={at} visible={false}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
    </mesh>
  );
}

const IMPACT_SEC = 2.0;

/**
 * The street gives like rubber: the eye sinks into the bowl, is thrown back
 * up and settles low, while the patch of street follows.
 */
function ImpactRig({ dent, startedAt }: { dent: DentCtl; startedAt: { current: number } }) {
  const store = useSceneStore();
  useFrame(() => {
    if (!dent.active) {
      if (store.eyeDrop !== 0) store.eyeDrop = 0;
      return;
    }
    const t = (performance.now() - startedAt.current) / 1000;
    store.teleport([dent.x, STREET_Y, dent.z]); // held in the bowl: no walking out of it
    const sink = Math.sin(Math.min(1, t / 0.42) * Math.PI * 0.5);
    if (t < 0.42) {
      store.eyeDrop = 1.9 * sink;
      dent.depth = 2.7 * sink;
    } else if (t < 1.05) {
      const k = (t - 0.42) / 0.63;
      store.eyeDrop = 1.9 - 3.3 * Math.sin(k * Math.PI * 0.5);
      dent.depth = 2.7 * Math.cos(Math.min(1, k * 1.6) * Math.PI * 0.5) - 0.3 * Math.sin(Math.min(1, k * 1.6) * Math.PI);
    } else {
      const k = Math.min(1, (t - 1.05) / 0.55);
      store.eyeDrop = -1.4 + 2.45 * k * k;
      dent.depth = 0.35 * Math.sin(k * Math.PI) * (1 - k);
    }
  });
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
  const lastJump = useRef<{ charge01: number; approach: number; fromZ: number } | null>(null);
  const everCleared = useRef(false);
  const dent = useMemo<DentCtl>(() => ({ x: 0, z: -GAP / 2, depth: 0, active: false }), []);
  const impactAt = useRef(0);

  const fail = useCallback(() => {
    if (phaseRef.current === 'pullout' || phaseRef.current === 'glitch') return;
    const store = storeRef.current;
    if (!store) return;
    dent.active = false;
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
      ? 'You ran out of roof. Release the jump before the coping.'
      : j.approach < SPRINT_MAX * 0.9
        ? `Approach too slow (${j.approach.toFixed(1)} of ${SPRINT_MAX.toFixed(0)} m/s). Commit to the full sprint.`
        : j.charge01 < SWEET_START
          ? 'Released early. Hold the charge into the bracket.'
          : j.charge01 > SWEET_END
            ? 'Released late. The arc collapsed under you.'
            : 'Short. Release closer to the coping. Again.';
    lastJump.current = null;
    setPhase('glitch');
    store.teleport(SPAWN, 0);
    setTimeout(() => {
      setPhase('run');
      storeRef.current?.toast(message, 4400);
    }, 1500);
  }, [onExit, dent]);

  /** Street level: the asphalt gives, throws you back, and only then the construct reloads. */
  const impact = useCallback(
    (x: number, z: number) => {
      if (phaseRef.current !== 'run') return;
      dent.x = x;
      dent.z = z;
      dent.depth = 0;
      dent.active = true;
      impactAt.current = performance.now();
      setPhase('impact');
      setTimeout(fail, IMPACT_SEC * 1000);
    },
    [dent, fail],
  );

  const onPlayerEvent = useCallback(
    (event: PlayerEvent) => {
      if (event.type === 'jump') {
        lastJump.current = {
          charge01: event.charge01,
          approach: event.speed / (1 + FORWARD_BOOST * event.quality),
          fromZ: event.position[2],
        };
        return;
      }
      if (event.type === 'charge-fizzle') {
        storeRef.current?.toast('Overcharged. The jump fizzled out of your legs.', 2800);
        return;
      }
      // land
      sfxThump(0.6 + Math.min(1, event.impact / 20) * 1.4);
      const [x, y, z] = event.position;
      if (y < STREET_Y + 1) {
        impact(x, z);
        return;
      }
      const onFarRoof = z < -GAP + 0.5 && Math.abs(y - ROOF_B_Y) < 0.6;
      if (y < ROOF_B_Y - 1 || (y < -1 && !onFarRoof)) {
        // Came down on some other roof: as failed as the street, without the bounce.
        if (phaseRef.current === 'run') fail();
        return;
      }
      const j = lastJump.current;
      if (onFarRoof && j && j.fromZ > -1) {
        lastJump.current = null;
        failsRef.current = 0;
        setFails(0);
        setCleared(true);
        const store = storeRef.current;
        if (!everCleared.current) {
          everCleared.current = true;
          store?.toast('NOBODY MAKES THE FIRST ONE. You just made yours.', 5600);
        } else {
          store?.toast('Cleared again. The roof believes you now.', 3200);
        }
      }
    },
    [fail, impact],
  );

  // Entry hint + dev handle.
  useEffect(() => {
    const t = setTimeout(
      () =>
        storeRef.current?.toast(
          'Jump program: full sprint, hold SPACE on approach, release in the bracket at the coping.',
          5600,
        ),
      900,
    );
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__rooftopDebug = {
        fail,
        impact,
        forceFails: (n: number) => {
          failsRef.current = n;
          setFails(n);
        },
        phase: () => phaseRef.current,
      };
    }
    return () => clearTimeout(t);
  }, [fail, impact]);

  return (
    <SceneShell
      title="ROOFTOP :: JUMP PROGRAM"
      spawn={SPAWN}
      colliders={COLLIDERS}
      platforms={PLATFORMS}
      far={FAR}
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
          carryMomentum: true,
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
      <RooftopWorld dent={dent} />
      <ImpactRig dent={dent} startedAt={impactAt} />
      <Interactable
        label="REVIEW JUMP PROTOCOL"
        radius={2.4}
        onInteract={() =>
          storeRef.current?.toast(
            'Protocol: build a FULL sprint (SHIFT). Hold SPACE on approach. Release inside the bracket as you reach the coping.',
            5600,
          )
        }
      >
        <Anchor at={BOX_AT} />
      </Interactable>
      <Interactable
        label="RE-RUN JUMP PROGRAM"
        radius={2.6}
        onInteract={() => {
          storeRef.current?.teleport(SPAWN, 0);
          storeRef.current?.toast('Program reset. Walk it back to the wall.', 3000);
        }}
      >
        <Anchor at={[MORPHEUS_AT[0], MORPHEUS_AT[1] + 1.3, MORPHEUS_AT[2]]} />
      </Interactable>
    </SceneShell>
  );
}
