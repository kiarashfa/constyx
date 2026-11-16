import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { NeutralToneMapping, type ToneMapping } from 'three';

interface RendererLookProps {
  /** Defaults to the Khronos PBR Neutral curve, which keeps baked colours true. */
  toneMapping?: ToneMapping;
  exposure?: number;
}

/**
 * Per-scene renderer grade. Mount once inside a scene; restores the previous
 * settings on unmount so scenes cannot leak their look into each other.
 */
export function RendererLook({ toneMapping = NeutralToneMapping, exposure = 1 }: RendererLookProps) {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    const previous = { toneMapping: gl.toneMapping, exposure: gl.toneMappingExposure };
    gl.toneMapping = toneMapping;
    gl.toneMappingExposure = exposure;
    return () => {
      gl.toneMapping = previous.toneMapping;
      gl.toneMappingExposure = previous.exposure;
    };
  }, [gl, toneMapping, exposure]);
  return null;
}
