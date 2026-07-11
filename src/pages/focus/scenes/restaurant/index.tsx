import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { RESTAURANT_FRAG } from './shader';

/** Seated at your table on the inner row, facing across the aisle. */
const YOUR_TABLE = new Vector3(3.15, 1.22, 0.05);

export default function RestaurantScene({ onExit }: FocusSceneComponentProps) {
  // 0 = full service, 1 = the maître d' lowers the lights.
  const dimTarget = useRef(0);

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: YOUR_TABLE.clone() },
      uDim: { value: 0 },
    }),
    [],
  );

  const bed = useAmbience('restaurant');

  const onFrame = useCallback(
    (_time: number, delta: number) => {
      const dim = uniforms.uDim;
      dim.value += (dimTarget.current - dim.value) * Math.min(1, delta * 1.2);
      bed.set('dim', dim.value as number);
    },
    [uniforms, bed],
  );

  const onAdjust = useCallback(() => {
    dimTarget.current = dimTarget.current > 0.5 ? 0 : 1;
    return dimTarget.current > 0.5
      ? 'the maître d’ lowers the chandeliers — candlelight takes the room'
      : 'the chandeliers come back up; the room brightens around the conversation';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusRestaurantDebug = {
        setDim: (v: number) => {
          dimTarget.current = v;
        },
      };
    }
  }, []);

  return (
    <ShaderSceneShell
      title="LE VRAI"
      yaw={Math.PI / 2}
      pitch={-0.05}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="ask for the lights"
    >
      <RaymarchQuad fragmentShader={RESTAURANT_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
