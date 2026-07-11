import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Vector3, type IUniform } from 'three';
import { ShaderSceneShell } from '../../engine/ShaderSceneShell';
import { RaymarchQuad } from '../../engine/RaymarchQuad';
import { useAmbience } from '../../../../engine/audio';
import type { FocusSceneComponentProps } from '../../scenes';
import { DEBIR_COURT_FRAG } from './shader';

/** Seated on the Oracle's bench, path and court ahead, trees overhead. */
const BENCH_SEAT = new Vector3(-0.35, 1.12, 0.18);

export default function DebirCourtScene({ onExit }: FocusSceneComponentProps) {
  // 0 = pigeons on patrol, 1 = crumbs out, flock gathers.
  const feedTarget = useRef(0);

  const uniforms = useMemo<Record<string, IUniform>>(
    () => ({
      uCamPos: { value: BENCH_SEAT.clone() },
      uFeed: { value: 0 },
    }),
    [],
  );

  const bed = useAmbience('park');

  const onFrame = useCallback(
    (_time: number, delta: number) => {
      const feed = uniforms.uFeed;
      feed.value += (feedTarget.current - feed.value) * Math.min(1, delta * 0.9);
      bed.set('feed', feed.value as number);
    },
    [uniforms, bed],
  );

  const onAdjust = useCallback(() => {
    feedTarget.current = feedTarget.current > 0.5 ? 0 : 1;
    return feedTarget.current > 0.5
      ? 'you scatter the crumbs from the paper bag — the pigeons remember'
      : 'the crumbs are gone; the pigeons drift back to their patrols';
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusParkDebug = {
        setFeed: (v: number) => {
          feedTarget.current = v;
        },
        feed: () => uniforms.uFeed.value as number,
      };
    }
  }, [uniforms]);

  return (
    <ShaderSceneShell
      title="DEBIR COURT"
      yaw={Math.PI}
      pitch={-0.08}
      onExit={onExit}
      onAdjust={onAdjust}
      adjustHint="scatter some crumbs"
    >
      <RaymarchQuad fragmentShader={DEBIR_COURT_FRAG} uniforms={uniforms} onFrame={onFrame} />
    </ShaderSceneShell>
  );
}
