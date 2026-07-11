import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, PlaneGeometry, Scene, SRGBColorSpace, Vector2, WebGLRenderTarget } from 'three';
import { createCodeVisionMaterial } from './material';

interface CodeVisionPassProps {
  /** Whether the code-vision overlay is engaged. */
  active: boolean;
  /** Cell size in device px. */
  cell?: number;
}

/**
 * The shared "code vision" overlay pass — mounted by the Focus shell
 * (`ShaderSceneShell`) for every raymarched shader scene. It takes over the
 * render loop (priority 1) and works for any scene with zero per-scene code,
 * because it operates on whatever the scene rendered:
 *
 *   - OFF: render the scene straight to the screen (identical to r3f's own
 *     auto-render — the only change is that we drive it explicitly).
 *   - ON:  render the scene into an offscreen FBO, then run the shared
 *     code-vision material over that captured frame to the screen.
 *
 * The FBO texture is sRGB so that any material whose output the renderer
 * colour-encodes captures exactly as it'd appear on screen; the Focus scenes'
 * raw ShaderMaterials aren't colour-encoded either way, so they're unaffected.
 * `uMix` ramps 0↔1 for a smooth cross-fade. The scene shader, its uniforms,
 * audio and interaction are all untouched.
 */
export function CodeVisionPass({ active, cell = 8 }: CodeVisionPassProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const rig = useMemo(() => {
    const cv = createCodeVisionMaterial(cell);
    const mesh = new Mesh(new PlaneGeometry(2, 2), cv.material);
    mesh.frustumCulled = false;
    const postScene = new Scene();
    postScene.add(mesh);
    const fbo = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
    fbo.texture.colorSpace = SRGBColorSpace;
    return { cv, mesh, postScene, fbo };
  }, [cell]);

  useEffect(
    () => () => {
      rig.cv.dispose();
      rig.mesh.geometry.dispose();
      rig.fbo.dispose();
    },
    [rig],
  );

  const activeRef = useRef(active);
  activeRef.current = active;
  const mix = useRef(0);
  const time = useRef(0);
  const size = useMemo(() => new Vector2(), []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__codeVision = {
        mix: () => mix.current,
        active: () => activeRef.current,
        debug: (n: number) => {
          rig.cv.uniforms.uDebug.value = n;
        },
      };
    }
  }, [rig]);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1);
    time.current += dt;

    // Track the (adaptive) drawing-buffer size; keep the FBO matched to it.
    gl.getDrawingBufferSize(size);
    if (rig.fbo.width !== size.x || rig.fbo.height !== size.y) {
      rig.fbo.setSize(size.x, size.y);
    }

    // Smooth cross-fade toward the toggle target.
    const target = activeRef.current ? 1 : 0;
    mix.current += (target - mix.current) * Math.min(1, dt * 3.5);
    const engaged = target > 0.5 || mix.current > 0.002;

    if (!engaged) {
      gl.setRenderTarget(null);
      gl.render(scene, camera);
      return;
    }

    // 1) Scene → FBO (the scene renders exactly as it would to screen).
    gl.setRenderTarget(rig.fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    // 2) Code-vision material over the captured frame → screen.
    const u = rig.cv.uniforms;
    u.uSource.value = rig.fbo.texture;
    u.uRes.value.copy(size);
    u.uTime.value = time.current;
    u.uMix.value = mix.current;
    u.uCell.value = cell;
    gl.render(rig.postScene, camera);
  }, 1);

  return null;
}
