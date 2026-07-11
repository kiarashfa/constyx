import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { CodeVisionPass } from '../../../engine/codevision';

export interface ShaderSceneShellProps {
  title: string;
  /** Initial look direction (radians). The viewing *position* lives in the shader. */
  yaw?: number;
  pitch?: number;
  onExit: () => void;
  /**
   * The scene's one ambience interaction, fired on click while viewing.
   * Return a toast line to show (or null for silence).
   */
  onAdjust?: () => string | null;
  /** Short verb phrase for the hold-menu help line, e.g. "cycle the power grid". */
  adjustHint?: string;
  /** R3F content — normally a single <RaymarchQuad>. */
  children: ReactNode;
}

/**
 * Focus Mode's counterpart to Locations' SceneShell, for camera-fixed
 * raymarched shader scenes. Kept from SceneShell: the pointer-lock + Esc
 * "hold program" flow, the terminal HUD conventions (title bar, hold-menu,
 * toast), and DEV debug handles. Dropped: PlayerControls/colliders/platforms
 * (no movement), the Interactable registry and crosshair (no aimed
 * interactions — one click adjusts the ambience), and the SceneStore (plain
 * React state is enough without 60Hz telemetry).
 */
export function ShaderSceneShell({
  title,
  yaw = 0,
  pitch = 0,
  onExit,
  onAdjust,
  adjustHint,
  children,
}: ShaderSceneShellProps) {
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [codeVision, setCodeVision] = useState(false);
  const lockRef = useRef<() => void>(() => {});
  const lockedRef = useRef(false);
  const firstLockRef = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  lockedRef.current = locked;

  const showToast = useMemo(
    () => (text: string, ms = 3600) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(text);
      toastTimer.current = setTimeout(() => setToast(null), ms);
    },
    [],
  );
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // The one interaction: click while viewing adjusts the ambience.
  useEffect(() => {
    const onClick = () => {
      if (!lockedRef.current || !onAdjust) return;
      const line = onAdjust();
      if (line) showToast(line);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [onAdjust, showToast]);

  // Code-vision overlay: 'V' toggles it on/off. Independent of the click
  // interaction and the audio, so toggling never disturbs either. The
  // CodeVisionCompositor ramps the effect in/out smoothly.
  const toggleCodeVision = useMemo(
    () => () =>
      setCodeVision((on) => {
        showToast(on ? 'code vision — released' : 'code vision — engaged', 2600);
        return !on;
      }),
    [showToast],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        toggleCodeVision();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggleCodeVision]);

  // Nudge discoverability once per visit, without a persistent HUD element.
  useEffect(() => {
    if (locked && firstLockRef.current) {
      firstLockRef.current = false;
      if (adjustHint) showToast(`click — ${adjustHint}  ·  V — code vision`, 4200);
    }
  }, [locked, adjustHint, showToast]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusDebug = {
        setLocked,
        adjust: () => onAdjust?.(),
        codeVision: (on?: boolean) => setCodeVision((prev) => (on === undefined ? !prev : on)),
      };
    }
  }, [onAdjust]);

  return (
    <div className="fixed inset-0 z-40 bg-terminal">
      <Canvas dpr={1} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <LookRig yaw={yaw} pitch={pitch} lockRef={lockRef} setLocked={setLocked} />
        {children}
        <CodeVisionPass active={codeVision} />
      </Canvas>

      {/* ---- HUD (DOM) — same conventions as Locations ---- */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-2 text-[11px] tracking-[0.25em]">
        <span className="text-phosphor/70">FOCUS :: {title}</span>
        <span className="flex items-center gap-3">
          {codeVision && <span className="glow text-phosphor">◈ CODE VISION</span>}
          <span className="text-phosphor/40">[ESC] HOLD PROGRAM</span>
        </span>
      </div>

      {toast && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 w-full max-w-md -translate-x-1/2 px-4 text-center">
          <p className="inline-block bg-terminal/80 px-3 py-1.5 text-xs italic leading-relaxed text-phosphor/80">
            {toast}
          </p>
        </div>
      )}

      {!locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-terminal/70">
          <div className="w-full max-w-sm border border-phosphor/40 bg-terminal/90 p-5 text-center">
            <p className="text-[10px] tracking-[0.35em] text-phosphor-dim">PROGRAM HELD</p>
            <p className="glow mt-1 text-xl tracking-[0.3em] text-phosphor">{title}</p>
            <p className="mt-4 text-[11px] leading-relaxed text-phosphor/60">
              mouse — look around
              {adjustHint && (
                <>
                  <br />
                  click — {adjustHint}
                </>
              )}
              <br />
              V — code vision {codeVision ? '(on)' : ''}
              <br />
              ESC — hold program
            </p>
            <button
              type="button"
              onClick={() => lockRef.current()}
              className="glow mt-5 w-full border border-phosphor/60 px-4 py-2 text-xs tracking-[0.3em] text-phosphor hover:bg-phosphor/15"
            >
              [ SETTLE IN ]
            </button>
            <button
              type="button"
              onClick={onExit}
              className="mt-2 w-full border border-phosphor/30 px-4 py-2 text-xs tracking-[0.3em] text-phosphor/60 hover:text-phosphor"
            >
              [ JACK OUT ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pointer-lock mouse-look from a fixed position — the LockRig subset of
 * SceneShell. The camera never translates; RaymarchQuad reads its rotation
 * into the shader every frame.
 */
function LookRig({
  yaw,
  pitch,
  lockRef,
  setLocked,
}: {
  yaw: number;
  pitch: number;
  lockRef: MutableRefObject<() => void>;
  setLocked: (locked: boolean) => void;
}) {
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const controlsRef = useRef<ComponentRef<typeof PointerLockControls>>(null);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);
    // Initial framing only — mouse-look owns the rotation afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useEffect(() => {
    lockRef.current = () => controlsRef.current?.lock();
    return () => {
      lockRef.current = () => {};
    };
  }, [lockRef]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__focusRigDebug = { camera, scene };
    }
  }, [camera, scene]);

  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={() => setLocked(true)}
      onUnlock={() => setLocked(false)}
    />
  );
}
