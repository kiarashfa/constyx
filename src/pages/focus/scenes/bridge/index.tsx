import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { BRIDGE_FRAG } from './shader';
import { createSignAtlas } from './signTexture';
import { loadBridgeTextures } from './textures';

/** First person as Neo — a pedestrian on the RIGHT FOOTPATH under the arch,
 *  waiting for the pickup, looking down the four-lane roadway. */
const KERB = new Vector3(7.4, 1.6, 3.2);

/** Car pass tuning: the Lincoln rolls through the near lane. */
const CAR_SPEED = 6; // m/s — an unhurried roll through
const CAR_SPAN = 24; // metres of travel across the visible road
const FIRST_PASS_AT = 16;
const PASS_EVERY = () => 45 + Math.random() * 50;

export default function BridgeScene({ onExit }: FocusSceneComponentProps) {
  // 0 = steady rain, 1 = downpour.
  const stormTarget = useRef(0);
  const car = useRef({ nextAt: FIRST_PASS_AT, active: false, t0: 0, dir: 1 });
  const tex = useMemo(() => loadBridgeTextures(), []);

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: KERB.clone() },
      uStorm: { value: 0 },
      uCarOn: { value: 0 },
      uCarZ: { value: 10000 },
      uCarDir: { value: 1 },
      uSign: { value: createSignAtlas() },
      uAsphalt: tex.asphalt,
      uConcrete: tex.concrete,
      uBrick: tex.brick,
    }),
    [tex],
  );

  const bed = useAmbience('bridge');

  const onFrame = useCallback(
    (time: number, delta: number) => {
      const storm = uniforms.uStorm;
      storm.value += (stormTarget.current - storm.value) * Math.min(1, delta * 1.2);
      bed.set('storm', storm.value as number);

      const c = car.current;
      if (!c.active && time >= c.nextAt) {
        c.active = true;
        c.t0 = time;
        c.dir = -c.dir;
        uniforms.uCarDir.value = c.dir;
        uniforms.uCarOn.value = 1;
      }
      if (c.active) {
        const travelled = (time - c.t0) * CAR_SPEED;
        // +dir approaches from the far mouth (headlights); -dir recedes into it.
        const z = c.dir > 0 ? -14 + travelled : 10 - travelled;
        uniforms.uCarZ.value = z;
        const dz = Math.abs(z - KERB.z);
        bed.set('car', 1 / (1 + (dz / 9) * (dz / 9)));
        if (travelled > CAR_SPAN) {
          c.active = false;
          uniforms.uCarOn.value = 0;
          uniforms.uCarZ.value = 10000;
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
      ? 'the sky opens up — water sheets off the deck in one long curtain'
      : 'the downpour eases back to a steady, patient rain';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusBridgeDebug = {
        summonCar: () => {
          car.current.nextAt = 0;
        },
        parkCar: (z: number | null) => {
          if (z === null) {
            uniforms.uCarOn.value = car.current.active ? 1 : 0;
          } else {
            car.current.nextAt = Number.POSITIVE_INFINITY;
            car.current.active = false;
            uniforms.uCarOn.value = 1;
            uniforms.uCarZ.value = z;
          }
        },
        setStorm: (v: number) => {
          stormTarget.current = v;
        },
        carZ: () => uniforms.uCarZ.value as number,
      };
    }
  }, [uniforms]);

  useEffect(() => {
    const sign = uniforms.uSign.value as { dispose: () => void };
    return () => {
      sign.dispose();
      tex.dispose();
    };
  }, [uniforms, tex]);

  return (
    <ShaderSceneShell
      title="ADAMS STREET"
      yaw={0.16}
      pitch={-0.03}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="lean into the storm"
    >
      <RaymarchQuad fragmentShader={BRIDGE_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
