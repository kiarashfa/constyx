import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { BRIDGE_FRAG } from './shader';
import { createSignAtlas } from './signTexture';

/** Standing on the sidewalk under the girders, street ahead. */
const KERB = new Vector3(0, 1.62, -0.4);

/** Car pass tuning: ~14s crossing, first soon, then irregular. */
const CAR_SPEED = 9; // m/s — an unhurried roll through the underpass
const CAR_FROM = 60;
const FIRST_PASS_AT = 20;
const PASS_EVERY = () => 45 + Math.random() * 50;

export default function BridgeScene({ onExit }: FocusSceneComponentProps) {
  // 0 = steady rain, 1 = downpour.
  const stormTarget = useRef(0);
  const car = useRef({ nextAt: FIRST_PASS_AT, active: false, t0: 0, dir: 1, now: 0 });

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: KERB.clone() },
      uStorm: { value: 0 },
      uCarOn: { value: 0 },
      uCarX: { value: 10000 },
      uCarDir: { value: 1 },
      uSign: { value: createSignAtlas() },
    }),
    [],
  );

  const bed = useAmbience('bridge');

  const onFrame = useCallback(
    (time: number, delta: number) => {
      const storm = uniforms.uStorm;
      storm.value += (stormTarget.current - storm.value) * Math.min(1, delta * 1.2);
      bed.set('storm', storm.value as number);

      const c = car.current;
      c.now = time;
      if (!c.active && time >= c.nextAt) {
        c.active = true;
        c.t0 = time;
        c.dir = -c.dir;
        uniforms.uCarDir.value = c.dir;
        uniforms.uCarOn.value = 1;
      }
      if (c.active) {
        const travelled = (time - c.t0) * CAR_SPEED;
        const x = (-CAR_FROM + travelled) * c.dir;
        uniforms.uCarX.value = x;
        const ax = Math.abs(x);
        bed.set('car', 1 / (1 + (ax / 20) * (ax / 20)));
        if (travelled > CAR_FROM * 2) {
          c.active = false;
          uniforms.uCarOn.value = 0;
          uniforms.uCarX.value = 10000;
          c.nextAt = time + PASS_EVERY();
          bed.set('car', 0);
        }
      }
    },
    [uniforms, bed],
  );

  const onAdjust = useCallback(() => {
    stormTarget.current = stormTarget.current > 0.5 ? 0 : 1;
    return stormTarget.current > 0.5
      ? 'the sky opens up — rain sheets off the deck in one long curtain'
      : 'the downpour eases back to a steady, patient rain';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusBridgeDebug = {
        summonCar: () => {
          car.current.nextAt = 0;
        },
        parkCar: (x: number | null) => {
          if (x === null) {
            uniforms.uCarOn.value = car.current.active ? 1 : 0;
          } else {
            car.current.nextAt = Number.POSITIVE_INFINITY;
            car.current.active = false;
            uniforms.uCarOn.value = 1;
            uniforms.uCarX.value = x;
          }
        },
        setStorm: (v: number) => {
          stormTarget.current = v;
        },
        carX: () => uniforms.uCarX.value as number,
      };
    }
  }, [uniforms]);

  useEffect(() => {
    const sign = uniforms.uSign.value as { dispose: () => void };
    return () => sign.dispose();
  }, [uniforms]);

  return (
    <ShaderSceneShell
      title="ADAMS STREET"
      yaw={Math.PI - 1.05}
      pitch={-0.03}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="lean into the storm"
    >
      <RaymarchQuad fragmentShader={BRIDGE_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
