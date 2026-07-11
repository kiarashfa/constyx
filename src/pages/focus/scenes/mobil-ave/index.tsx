import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { MOBIL_AVE_FRAG } from './shader';
import { createStationAtlas } from './signTexture';

/** Seated on the platform bench at z=0, eyes at 1.18m, facing the track. */
const SEAT = new Vector3(2.95, 1.18, 0);

/** Train pass tuning: ~20s per pass, first one soon, then every ~2 minutes. */
const TRAIN_SPEED = 13; // m/s
const TRAIN_START_Z = 130; // spawn depth in the bore (center of the 59m train)
const FIRST_PASS_AT = 25; // s after entering
const PASS_EVERY = () => 100 + Math.random() * 45; // s between passes

export default function MobilAveScene({ onExit }: FocusSceneComponentProps) {
  const nightTarget = useRef(0);
  const train = useRef({
    nextAt: FIRST_PASS_AT,
    active: false,
    t0: 0,
    dir: 1,
    now: 0,
    /** DEV: pin the train at this z (throttled-tab screenshots). */
    parkedAt: null as number | null,
  });

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: SEAT.clone() },
      uNight: { value: 0 },
      uTrainOn: { value: 0 },
      uTrainZ: { value: 10000 },
      uTrainDir: { value: 1 },
      uSign: { value: createStationAtlas() },
    }),
    [],
  );

  const bed = useAmbience('mobilAve');

  const onFrame = useCallback(
    (time: number, delta: number) => {
      const night = uniforms.uNight;
      night.value += (nightTarget.current - night.value) * Math.min(1, delta * 2);

      const t = train.current;
      t.now = time;
      if (t.parkedAt !== null) {
        uniforms.uTrainOn.value = 1;
        uniforms.uTrainZ.value = t.parkedAt;
        return;
      }
      if (!t.active && time >= t.nextAt) {
        t.active = true;
        t.t0 = time;
        t.dir = -t.dir; // alternate directions
        uniforms.uTrainDir.value = t.dir;
        uniforms.uTrainOn.value = 1;
      }

      const cam = uniforms.uCamPos.value as Vector3;
      if (t.active) {
        const travelled = (time - t.t0) * TRAIN_SPEED;
        const z = (-TRAIN_START_Z + travelled) * t.dir;
        uniforms.uTrainZ.value = z;

        // Low rumble through the bench while the train is in the hall.
        const near = Math.max(0, 1 - Math.abs(z) / 45);
        cam.y = SEAT.y + (Math.random() - 0.5) * 0.012 * near;

        if (travelled > TRAIN_START_Z * 2) {
          t.active = false;
          uniforms.uTrainOn.value = 0;
          uniforms.uTrainZ.value = 10000;
          t.nextAt = time + PASS_EVERY();
        }
        // Audio closeness: swells as the train nears, pitch riding with it.
        const dz = Math.abs(z);
        bed.set('train', 1 / (1 + (dz / 28) * (dz / 28)));
      } else {
        cam.y = SEAT.y;
        bed.set('train', 0);
      }
    },
    [uniforms, bed],
  );

  const onAdjust = useCallback(() => {
    nightTarget.current = nightTarget.current > 0.5 ? 0 : 1;
    return nightTarget.current > 0.5
      ? 'night service — half the tubes go dark, and the hum drops'
      : 'full service — every tube flickers back on';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusMobilDebug = {
        summonTrain: () => {
          train.current.nextAt = 0;
        },
        // Teleport an active pass to the middle of the hall (throttled-tab testing).
        warpTrain: () => {
          const t = train.current;
          t.t0 = t.now - TRAIN_START_Z / TRAIN_SPEED;
        },
        parkTrain: (z: number | null) => {
          train.current.parkedAt = z;
          if (z === null) uniforms.uTrainOn.value = train.current.active ? 1 : 0;
        },
        setNight: (v: number) => {
          nightTarget.current = v;
        },
        trainZ: () => uniforms.uTrainZ.value as number,
        uniforms,
      };
    }
  }, [uniforms]);

  // The canvas texture belongs to this mount; free it with the scene.
  useEffect(() => {
    const sign = uniforms.uSign.value as { dispose: () => void };
    return () => sign.dispose();
  }, [uniforms]);

  return (
    <ShaderSceneShell
      title="MOBIL AVE"
      yaw={Math.PI / 2}
      pitch={-0.02}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="switch the station lighting"
    >
      <RaymarchQuad fragmentShader={MOBIL_AVE_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
