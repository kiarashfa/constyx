import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { ARCHITECT_FRAG } from './shader';

/** Seated in the chair at the center of the monitor wall. */
const THE_CHAIR = new Vector3(0, 1.24, 0.15);

export default function ArchitectScene({ onExit }: FocusSceneComponentProps) {
  // 0 = scattered feeds, 1 = every screen the same.
  const syncTarget = useRef(0);

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: THE_CHAIR.clone() },
      uSync: { value: 0 },
    }),
    [],
  );

  const bed = useAmbience('architect');

  const onFrame = useCallback(
    (_time: number, delta: number) => {
      const sync = uniforms.uSync;
      sync.value += (syncTarget.current - sync.value) * Math.min(1, delta * 2.5);
      bed.set('sync', sync.value as number);
    },
    [uniforms, bed],
  );

  const onAdjust = useCallback(() => {
    syncTarget.current = syncTarget.current > 0.5 ? 0 : 1;
    return syncTarget.current > 0.5
      ? 'concordantly — every screen turns to the same feed'
      : 'vis-à-vis — the feeds scatter back to their own business';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusArchitectDebug = {
        setSync: (v: number) => {
          syncTarget.current = v;
        },
      };
    }
  }, []);

  return (
    <ShaderSceneShell
      title="THE ARCHITECT"
      yaw={Math.PI}
      pitch={0.02}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="turn the wall to one channel"
    >
      <RaymarchQuad fragmentShader={ARCHITECT_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
