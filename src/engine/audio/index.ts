import { useEffect, useMemo, useRef } from 'react';
import { startBed, type BedHandle, type BedName } from './beds';

export { ensureAudio } from './core';
export { startBed, type BedHandle, type BedName } from './beds';
export {
  sfxJackIn,
  sfxGunshot,
  sfxDojo,
  sfxWhoosh,
  sfxThump,
  sfxTvClick,
  type GunKind,
  type HitKind,
} from './sfx';

/**
 * Mount-scoped ambient bed: fades in when the scene mounts, out when it
 * unmounts. The returned handle is stable and forwards `set()` to the live
 * bed (or queues it), so scenes can drive reactive params from useFrame.
 */
export function useAmbience(name: BedName): BedHandle {
  const bedRef = useRef<BedHandle | null>(null);

  useEffect(() => {
    const bed = startBed(name);
    bedRef.current = bed;
    return () => {
      bedRef.current = null;
      bed.stop();
    };
  }, [name]);

  return useMemo(
    () => ({
      set: (param: string, v: number) => bedRef.current?.set(param, v),
      stop: (fade?: number) => bedRef.current?.stop(fade),
    }),
    [],
  );
}
