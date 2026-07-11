import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Vector3 } from 'three';
import {
  useSceneStore,
  type Collider2D,
  type Platform,
  type PlayerEvent,
} from './store';

export interface SprintConfig {
  maxSpeed: number;
  /** Seconds of held sprint to reach maxSpeed — the run-up commitment. */
  rampSec: number;
}

export interface JumpConfig {
  /** Time for the charge to fill 0→100% while Space is held. */
  chargeDurationMs: number;
  /** Sweet release window as fractions of the charge (e.g. 0.68–0.92). */
  sweetStart: number;
  sweetEnd: number;
  /** Vertical launch velocity at quality 0 / quality 1. */
  minVelY: number;
  maxVelY: number;
  /** Horizontal boost multiplier at perfect quality: v *= 1 + boost. */
  forwardBoost: number;
}

interface PlayerControlsProps {
  /** Feet spawn position (y = platform height, usually 0). */
  spawn: [number, number, number];
  /** Initial facing angle in radians (0 looks toward -z). */
  yaw?: number;
  /** Walk speed, m/s. Deliberately unhurried — an operator, not an arena bot. */
  speed?: number;
  eyeHeight?: number;
  /** Player body radius for collision, meters. */
  bodyRadius?: number;
  /** Gravity magnitude, m/s². Only felt when the scene has platforms/edges. */
  gravity?: number;
  /** Hold-Shift sprint with a ramp-up. Null (default) = walk only. */
  sprint?: SprintConfig | null;
  /** Hold/release-Space charged jump. Null (default) = jumping disabled. */
  jump?: JumpConfig | null;
  /** Game-logic events: jump launches, landings, fizzles. */
  onEvent?: (event: PlayerEvent) => void;
}

const UP = new Vector3(0, 1, 0);
const COYOTE_SEC = 0.12;
const FIZZLE_AT = 1.15;
const FIZZLE_COOLDOWN_MS = 450;
const BODY_HEIGHT = 1.7;
/** Height the player can step down without becoming airborne. */
const STEP_DOWN = 0.3;

/** Highest platform under the point, or -Infinity (void). No platforms = flat 0. */
function groundHeightAt(x: number, z: number, platforms: Platform[]): number {
  if (platforms.length === 0) return 0;
  let best = -Infinity;
  for (const p of platforms) {
    if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.y > best) {
      best = p.y;
    }
  }
  return best;
}

/** Push a circle at `pos` out of every collider overlapping its body height. */
function resolveCollisions(
  pos: Vector3,
  feetY: number,
  radius: number,
  colliders: Collider2D[],
): void {
  for (const box of colliders) {
    // Height-bounded colliders only apply when the body's vertical span
    // overlaps them (a small step allowance keeps roof lips from snagging).
    if (box.yMax !== undefined && feetY + 0.25 > box.yMax) continue;
    if (box.yMin !== undefined && feetY + BODY_HEIGHT < box.yMin) continue;
    const nearestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const nearestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - nearestX;
    const dz = pos.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    if (distSq > 1e-9) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      pos.x += dx * push;
      pos.z += dz * push;
    } else {
      // Center is inside the box: push out through the nearest face.
      const candidates = [
        { d: pos.x - box.minX + radius, apply: () => void (pos.x = box.minX - radius) },
        { d: box.maxX - pos.x + radius, apply: () => void (pos.x = box.maxX + radius) },
        { d: pos.z - box.minZ + radius, apply: () => void (pos.z = box.minZ - radius) },
        { d: box.maxZ - pos.z + radius, apply: () => void (pos.z = box.maxZ + radius) },
      ];
      candidates.sort((a, b) => a.d - b.d)[0].apply();
    }
  }
}

/**
 * First-person control rig: drei PointerLockControls for mouse-look plus
 * WASD/arrow movement with velocity smoothing, circle-vs-AABB collision,
 * and (opt-in per scene) gravity over platforms, ramped sprint, and a
 * charge-and-release jump. Round-4 scenes that pass no sprint/jump/platforms
 * behave exactly as before.
 */
export function PlayerControls({
  spawn,
  yaw = 0,
  speed = 2.6,
  eyeHeight = 1.62,
  bodyRadius = 0.35,
  gravity = 14,
  sprint = null,
  jump = null,
  onEvent,
}: PlayerControlsProps) {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const controlsRef = useRef<ComponentRef<typeof PointerLockControls>>(null);
  const pressed = useRef(new Set<string>());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Feet position is the source of truth; the camera is derived from it each
  // frame (plus eye height and shake), so shake never corrupts physics.
  // NOTE: initialized once per mount via useState — never keyed on `spawn`,
  // whose identity changes whenever the parent re-renders (an inline array
  // prop). Keying on it silently teleported the player home mid-play.
  const [pos] = useState(() => new Vector3(spawn[0], spawn[1], spawn[2]));
  const velocity = useMemo(() => new Vector3(), []);
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const targetVel = useMemo(() => new Vector3(), []);

  const state = useRef({
    velY: 0,
    airborne: false,
    lastGroundedAt: 0,
    sprint01: 0,
    charging: false,
    charge01: 0,
    fizzleUntil: 0,
    launchSpeed: 0,
    shakeMag: 0,
  });

  useEffect(() => {
    camera.position.set(spawn[0], spawn[1] + eyeHeight, spawn[2]);
    camera.rotation.set(0, yaw, 0, 'YXZ');
    // Spawn/yaw are mount-time inputs by design.
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => pressed.current.add(e.code);
    const up = (e: KeyboardEvent) => pressed.current.delete(e.code);
    const clear = () => pressed.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  // Dev-only handle so scene tests can read/steer the player.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__playerDebug = {
        camera,
        position: pos,
        scene,
      };
    }
  }, [camera, pos, scene]);

  // Expose lock/unlock/teleport/shake so DOM code can drive them.
  useEffect(() => {
    store.lock = () => controlsRef.current?.lock();
    store.unlock = () => controlsRef.current?.unlock();
    store.teleport = (to, newYaw) => {
      pos.set(to[0], to[1], to[2]);
      velocity.set(0, 0, 0);
      const s = state.current;
      s.velY = 0;
      s.airborne = false;
      s.sprint01 = 0;
      s.charging = false;
      s.charge01 = 0;
      s.launchSpeed = 0;
      if (newYaw !== undefined) camera.rotation.set(0, newYaw, 0, 'YXZ');
    };
    store.shake = (magnitude) => {
      state.current.shakeMag = Math.min(0.6, Math.max(state.current.shakeMag, magnitude));
    };
    return () => {
      store.lock = () => {};
      store.unlock = () => {};
      store.teleport = () => {};
      store.shake = () => {};
    };
  }, [store, camera, pos, velocity]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    const keys = pressed.current;
    const locked = store.getSnapshot().locked;
    const nowMs = performance.now();

    let move = 0;
    let strafe = 0;
    let wantSprint = false;
    let spaceDown = false;
    if (locked) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) move += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) move -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
      wantSprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
      spaceDown = keys.has('Space');
    }

    // ---- sprint ramp (builds only grounded + shift + forward) ----
    if (sprint) {
      if (!s.airborne && wantSprint && move > 0) {
        s.sprint01 = Math.min(1, s.sprint01 + dt / sprint.rampSec);
      } else if (!s.airborne) {
        s.sprint01 = Math.max(0, s.sprint01 - (3 * dt) / sprint.rampSec);
      }
      // Airborne: ramp freezes — momentum is whatever you left the roof with.
    }
    const groundMax = sprint ? speed + (sprint.maxSpeed - speed) * s.sprint01 : speed;

    // ---- charged jump ----
    if (jump) {
      const grounded = !s.airborne;
      const coyote = nowMs - s.lastGroundedAt < COYOTE_SEC * 1000;
      if (spaceDown && !s.charging && grounded && nowMs > s.fizzleUntil) {
        s.charging = true;
        s.charge01 = 0;
      }
      if (s.charging) {
        s.charge01 += (dt * 1000) / jump.chargeDurationMs;
        if (s.charge01 > FIZZLE_AT) {
          s.charging = false;
          s.charge01 = 0;
          s.fizzleUntil = nowMs + FIZZLE_COOLDOWN_MS;
          onEventRef.current?.({ type: 'charge-fizzle' });
        } else if (!spaceDown) {
          // Release: quality 1 inside the sweet window, fading over ±0.25.
          const c = s.charge01;
          let quality: number;
          if (c >= jump.sweetStart && c <= jump.sweetEnd) quality = 1;
          else {
            const d = c < jump.sweetStart ? jump.sweetStart - c : c - jump.sweetEnd;
            quality = Math.max(0, 1 - d / 0.25);
          }
          s.charging = false;
          if (grounded || coyote) {
            s.velY = jump.minVelY + (jump.maxVelY - jump.minVelY) * quality;
            s.airborne = true;
            velocity.multiplyScalar(1 + jump.forwardBoost * quality);
            s.launchSpeed = Math.hypot(velocity.x, velocity.z);
            onEventRef.current?.({
              type: 'jump',
              charge01: c,
              quality,
              speed: s.launchSpeed,
              position: [pos.x, pos.y, pos.z],
            });
          }
          s.charge01 = 0;
        }
      }
    }

    // ---- horizontal movement ----
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, UP); // forward × up = right

    targetVel.set(0, 0, 0);
    targetVel.addScaledVector(forward, move).addScaledVector(right, strafe);
    if (targetVel.lengthSq() > 1) targetVel.normalize();
    targetVel.multiplyScalar(s.airborne ? Math.max(s.launchSpeed, speed) : groundMax);

    // Exponential smoothing — grounded feels heavy; airborne preserves
    // momentum with only faint steering authority.
    const smoothing = s.airborne ? 0.6 : 7;
    velocity.lerp(targetVel, 1 - Math.exp(-smoothing * dt));

    pos.x += velocity.x * dt;
    pos.z += velocity.z * dt;
    resolveCollisions(pos, pos.y, bodyRadius, store.colliders);

    // ---- vertical: platforms, gravity, landing ----
    const ground = groundHeightAt(pos.x, pos.z, store.platforms);
    if (!s.airborne) {
      if (ground > -Infinity && pos.y - ground <= STEP_DOWN && ground - pos.y <= STEP_DOWN) {
        pos.y = ground;
        s.lastGroundedAt = nowMs;
      } else {
        s.airborne = true; // walked off an edge
      }
    }
    if (s.airborne) {
      s.velY -= gravity * dt;
      pos.y += s.velY * dt;
      if (s.velY <= 0 && ground > -Infinity && pos.y <= ground) {
        const impact = Math.abs(s.velY);
        pos.y = ground;
        s.velY = 0;
        s.airborne = false;
        s.launchSpeed = 0;
        s.lastGroundedAt = nowMs;
        store.shake(Math.min(0.55, impact * 0.05));
        onEventRef.current?.({ type: 'land', impact, position: [pos.x, pos.y, pos.z] });
      }
    }

    // ---- camera = feet + eye height + decaying shake ----
    camera.position.set(pos.x, pos.y + eyeHeight, pos.z);
    if (s.shakeMag > 0.002) {
      camera.position.x += (Math.random() - 0.5) * s.shakeMag;
      camera.position.y += (Math.random() - 0.5) * s.shakeMag;
      camera.position.z += (Math.random() - 0.5) * s.shakeMag;
      s.shakeMag *= Math.exp(-6 * dt);
    }

    // ---- publish telemetry for HUDs ----
    const motion = store.motion;
    motion.speed = Math.hypot(velocity.x, velocity.z);
    motion.sprint01 = s.sprint01;
    motion.charging = s.charging;
    motion.charge01 = s.charging ? s.charge01 : 0;
    motion.airborne = s.airborne;
    motion.feetY = pos.y;
    motion.velY = s.velY;
  });

  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={() => store.setLocked(true)}
      onUnlock={() => store.setLocked(false)}
    />
  );
}
