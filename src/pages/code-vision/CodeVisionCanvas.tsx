import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { VideoTexture, LinearFilter, Vector2 } from 'three';
import { createCodeVisionMaterial, coverMirrorTransform } from '../../engine/codevision';

interface CodeVisionCanvasProps {
  video: HTMLVideoElement;
  /** Cell size in CSS px (converted to device px internally). */
  cell: number;
  mirror: boolean;
}

/**
 * Standalone webcam → code-vision renderer (Part 1). Lazy-loaded so three.js
 * never lands in the main bundle. The live camera frame is wrapped in a
 * VideoTexture and pushed through the shared code-vision material; a
 * cover-fit + mirror transform maps the (arbitrary-aspect) camera feed onto
 * the viewport, and the effect fades in on first frames.
 */
export default function CodeVisionCanvas({ video, cell, mirror }: CodeVisionCanvasProps) {
  return (
    <Canvas
      dpr={1}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      className="block h-full w-full"
    >
      <Feed video={video} cell={cell} mirror={mirror} />
    </Canvas>
  );
}

function Feed({ video, cell, mirror }: CodeVisionCanvasProps) {
  const cv = useMemo(() => createCodeVisionMaterial(cell), []); // eslint-disable-line react-hooks/exhaustive-deps
  const texture = useMemo(() => {
    const t = new VideoTexture(video);
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [video]);

  const size = useMemo(() => new Vector2(), []);
  const mirrorRef = useRef(mirror);
  const cellRef = useRef(cell);
  mirrorRef.current = mirror;
  cellRef.current = cell;

  useEffect(() => {
    cv.uniforms.uSource.value = texture;
    return () => {
      cv.dispose();
      texture.dispose();
    };
  }, [cv, texture]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const u = cv.uniforms;
    u.uTime.value += dt;
    state.gl.getDrawingBufferSize(size);
    u.uRes.value.copy(size);
    // Device px per cell (getDrawingBufferSize already folds in the DPR).
    u.uCell.value = Math.max(4, cellRef.current * state.viewport.dpr);
    coverMirrorTransform(
      u.uSrcMul.value,
      u.uSrcAdd.value,
      video.videoWidth,
      video.videoHeight,
      size.x,
      size.y,
      mirrorRef.current,
    );
    // Ease the effect in (and never quite to a hard 1 — keeps a faint ghost of
    // the real frame beneath the code, which reads better than pure glyphs).
    u.uMix.value += (0.94 - u.uMix.value) * Math.min(1, dt * 2.2);
  });

  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <primitive object={cv.material} attach="material" />
    </mesh>
  );
}
