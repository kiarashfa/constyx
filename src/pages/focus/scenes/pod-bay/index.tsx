import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { POD_BAY_FRAG } from './shader';

/**
 * Viewing position: nestled at one pod on the (20,20) harvest tower, in the
 * gap between two pod rows, ~13.4m from the tower axis — the three sibling
 * towers sit 32–43m ahead across the fog. Initial yaw faces the far tower.
 */
const VIEWPOINT = new Vector3(10.52, 2.5, 10.52);

export default function PodBayScene({ onExit }: FocusSceneComponentProps) {
  // 0 = calm cycle, 1 = storm cycle; uMode chases this smoothly per frame.
  const cycleTarget = useRef(0);

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: VIEWPOINT },
      uMode: { value: 0 },
    }),
    [],
  );

  const bed = useAmbience('podBay');

  const onFrame = useCallback(
    (_time: number, delta: number) => {
      const mode = uniforms.uMode;
      mode.value += (cycleTarget.current - mode.value) * Math.min(1, delta * 1.5);
      bed.set('storm', mode.value as number);
    },
    [uniforms, bed],
  );

  const onAdjust = useCallback(() => {
    cycleTarget.current = cycleTarget.current > 0.5 ? 0 : 1;
    return cycleTarget.current > 0.5
      ? 'the grid surges — lightning walks the towers'
      : 'the grid settles — the fields dim to a red murmur';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusPodDebug = {
        setStorm: (v: number) => {
          cycleTarget.current = v;
        },
        mode: () => uniforms.uMode.value as number,
      };
    }
  }, [uniforms]);

  return (
    <ShaderSceneShell
      title="POD BAY"
      yaw={Math.PI / 4 + 0.42}
      pitch={-0.12}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="cycle the power grid"
    >
      <RaymarchQuad fragmentShader={POD_BAY_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
