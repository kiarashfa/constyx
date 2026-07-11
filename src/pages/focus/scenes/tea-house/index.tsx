import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { TEA_HOUSE_FRAG } from './shader';

/** Seated at the middle table of the east row, facing across the aisle. */
const TABLE_SEAT = new Vector3(3.06, 1.22, 0.1);

export default function TeaHouseScene({ onExit }: FocusSceneComponentProps) {
  // 0 = clear morning air, 1 = the incense is lit.
  const incenseTarget = useRef(0);
  useAmbience('teaHouse');

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: TABLE_SEAT.clone() },
      uIncense: { value: 0 },
    }),
    [],
  );

  const onFrame = useCallback(
    (_time: number, delta: number) => {
      const incense = uniforms.uIncense;
      incense.value += (incenseTarget.current - incense.value) * Math.min(1, delta * 0.8);
    },
    [uniforms],
  );

  const onAdjust = useCallback(() => {
    incenseTarget.current = incenseTarget.current > 0.5 ? 0 : 1;
    return incenseTarget.current > 0.5
      ? 'you touch a coal to the incense — sandalwood curls into the light'
      : 'the stick burns down; the air slowly clears';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusTeaDebug = {
        setIncense: (v: number) => {
          incenseTarget.current = v;
        },
      };
    }
  }, []);

  return (
    <ShaderSceneShell
      title="TEA HOUSE"
      yaw={Math.PI / 2}
      pitch={-0.12}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="light the incense"
    >
      <RaymarchQuad fragmentShader={TEA_HOUSE_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
