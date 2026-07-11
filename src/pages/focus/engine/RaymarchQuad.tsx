import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix3, Matrix4, ShaderMaterial, Vector2, type IUniform } from 'three';

export interface RaymarchQuadProps {
  fragmentShader: string;
  /** Scene-specific uniforms (create once with useMemo). */
  uniforms: Record<string, IUniform>;
  /** Per-frame hook for driving scene uniforms (train timing, mode lerps). */
  onFrame?: (time: number, delta: number) => void;
}

const VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Render-scale ladder for adaptive quality: raymarching cost scales with
 * pixel count, so when the moving-average frame time stays above ~27fps we
 * step the drawing-buffer scale down (never back up — no oscillation).
 */
const DPR_STEPS = [1, 0.8, 0.66, 0.5];

/**
 * The whole environment lives in one fragment shader raymarched over a
 * full-screen quad. The quad bypasses the camera transform in the vertex
 * stage; the camera's *rotation* (driven by pointer-lock mouse-look) is fed
 * back in as a mat3 so the shader can aim its rays.
 */
export function RaymarchQuad({ fragmentShader, uniforms, onFrame }: RaymarchQuadProps) {
  const merged = useMemo(
    () => ({
      uTime: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uCamBasis: { value: new Matrix3() },
      ...uniforms,
    }),
    [uniforms],
  );
  // Build the material imperatively: r3f's `uniforms` prop shallow-clones
  // each entry, which silently disconnects scalar uniform writes (mutating a
  // Vector3 in place still works, `u.value = 2` does not). With a hand-made
  // ShaderMaterial the scene mutates the exact objects the GPU reads.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader,
        uniforms: merged,
        depthTest: false,
        depthWrite: false,
      }),
    [fragmentShader, merged],
  );
  useEffect(() => () => material.dispose(), [material]);

  const tmpM4 = useMemo(() => new Matrix4(), []);
  const perf = useRef({ ema: 1 / 60, warmup: 0, cooldown: 0, step: 0 });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    merged.uTime.value += dt;
    state.gl.getDrawingBufferSize(merged.uRes.value);
    // matrixWorld lags a frame behind the controls; compose from the live
    // quaternion instead so look direction is never stale.
    tmpM4.makeRotationFromQuaternion(state.camera.quaternion);
    merged.uCamBasis.value.setFromMatrix4(tmpM4);
    onFrame?.(merged.uTime.value, dt);

    // Adaptive quality: settle in for 3s, then step render scale down if the
    // smoothed frame time can't hold ~27fps. Deltas are clamped rather than
    // skipped so a catastrophically slow shader still trips the ladder
    // (round-12 lesson: >0.5s frames used to be ignored as tab switches).
    const p = perf.current;
    p.warmup += dt;
    if (p.warmup < 3) return;
    p.ema += (Math.min(delta, 0.75) - p.ema) * 0.05;
    p.cooldown -= dt;
    if (p.ema > 1 / 27 && p.cooldown <= 0 && p.step < DPR_STEPS.length - 1) {
      p.step += 1;
      p.cooldown = 3;
      p.ema = 1 / 60;
      state.setDpr(DPR_STEPS[p.step]);
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__focusQuality = DPR_STEPS[p.step];
      }
    }
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
