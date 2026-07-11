import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { OFFICE_FRAG } from './shader';
import { createCrtAtlas } from './crtTexture';

/** Seated at the cubicle desk, the window (and the cleaners) dead ahead. */
const DESK_CHAIR = new Vector3(0, 1.3, -0.15);

export default function OfficeScene({ onExit }: FocusSceneComponentProps) {
  // 0 = the quarterlies, 1 = the screensaver that holds your eye.
  const screenTarget = useRef(0);
  useAmbience('office');

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: DESK_CHAIR.clone() },
      uScreen: { value: 0 },
      uCrt: { value: createCrtAtlas() },
    }),
    [],
  );

  const onFrame = useCallback(
    (_time: number, delta: number) => {
      const screen = uniforms.uScreen;
      screen.value += (screenTarget.current - screen.value) * Math.min(1, delta * 3);
    },
    [uniforms],
  );

  const onAdjust = useCallback(() => {
    screenTarget.current = screenTarget.current > 0.5 ? 0 : 1;
    return screenTarget.current > 0.5
      ? 'the screensaver kicks in — something about it holds your eye'
      : 'back to the quarterlies';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusOfficeDebug = {
        setScreen: (v: number) => {
          screenTarget.current = v;
        },
      };
    }
  }, []);

  useEffect(() => {
    const crt = uniforms.uCrt.value as { dispose: () => void };
    return () => crt.dispose();
  }, [uniforms]);

  return (
    <ShaderSceneShell
      title="METACORTEX"
      yaw={Math.PI}
      pitch={-0.17}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="tap the monitor"
    >
      <RaymarchQuad fragmentShader={OFFICE_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
