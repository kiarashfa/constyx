import { useEffect, useMemo, useRef, type ComponentRef, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { PlayerControls, type JumpConfig, type SprintConfig } from './PlayerControls';
import { InteractionManager } from './Interactable';
import {
  SceneStore,
  SceneStoreContext,
  useSceneSnapshot,
  useSceneStore,
  type Collider2D,
  type Platform,
  type PlayerEvent,
} from './store';

/** Movement capabilities a scene grants the player. */
export interface PlayerOptions {
  speed?: number;
  gravity?: number;
  sprint?: SprintConfig | null;
  jump?: JumpConfig | null;
  onEvent?: (event: PlayerEvent) => void;
}

export interface SceneShellProps {
  title: string;
  spawn: [number, number, number];
  yaw?: number;
  /**
   * 'first-person' (default): full PlayerControls — walk, look, collide.
   * 'scene': the shell only manages pointer lock, Esc/menu flow, and
   * store.lock/unlock; the scene drives the camera itself every frame
   * (third-person rigs, scripted shots). Mouse-look writes are harmlessly
   * overwritten by the scene rig each frame.
   */
  cameraRig?: 'first-person' | 'scene';
  colliders: Collider2D[];
  /** Walkable surfaces. Omit for an infinite floor at y=0. */
  platforms?: Platform[];
  /** Sprint/jump/gravity configuration. Omit for plain walking. */
  player?: PlayerOptions;
  onExit: () => void;
  /** DOM overlay (e.g. the TV player). While present, play input is disabled. */
  overlay?: ReactNode;
  /**
   * Scene-specific HUD (meters, effect layers). Always rendered, never gates
   * input — unlike `overlay`. Wrap interactive bits in pointer-events-auto.
   */
  hud?: ReactNode;
  /** R3F scene content. */
  children: ReactNode;
}

/**
 * Minimal rig for cameraRig="scene": pointer lock + Esc/menu wiring only.
 * The scene's own camera code owns the transform (overwriting any mouse-look
 * rotation each frame), and store.shake is left for the scene rig to wire.
 */
function LockRig() {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const controlsRef = useRef<ComponentRef<typeof PointerLockControls>>(null);
  useEffect(() => {
    store.lock = () => controlsRef.current?.lock();
    store.unlock = () => controlsRef.current?.unlock();
    return () => {
      store.lock = () => {};
      store.unlock = () => {};
    };
  }, [store]);
  // Same dev handle PlayerControls exposes, for scene-rig scene tests.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__sceneRigDebug = { camera, scene };
    }
  }, [camera, scene]);
  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={() => store.setLocked(true)}
      onUnlock={() => store.setLocked(false)}
    />
  );
}

/**
 * The reusable frame every Location scene mounts into: full-screen canvas,
 * player controls, interaction plumbing, and the terminal-styled HUD
 * (crosshair, prompt, toast, hold-menu with exit). Scenes provide geometry,
 * colliders, Interactables, and optional DOM overlays — nothing else.
 */
export function SceneShell({
  title,
  spawn,
  yaw,
  cameraRig = 'first-person',
  colliders,
  platforms,
  player,
  onExit,
  overlay,
  hud,
  children,
}: SceneShellProps) {
  const store = useMemo(() => {
    const s = new SceneStore();
    s.colliders = colliders;
    s.platforms = platforms ?? [];
    return s;
    // Store is created once per scene mount; colliders/platforms are static.
  }, []);
  const snap = useSceneSnapshot(store);

  // Interact inputs: E key, or click while locked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') store.interact();
    };
    const onClick = () => {
      if (store.getSnapshot().locked) store.interact();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [store]);

  // Overlay opening releases the pointer; play input stays gated meanwhile.
  useEffect(() => {
    store.setOverlayOpen(!!overlay);
    if (overlay) store.unlock();
  }, [overlay, store]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__sceneDebug = {
        store,
        interact: () => store.active?.onInteract(),
        entries: () => [...store.interactableValues()].map((e) => e.label),
      };
    }
  }, [store]);

  const showMenu = !snap.locked && !snap.overlayOpen;

  return (
    <SceneStoreContext.Provider value={store}>
      <div className="fixed inset-0 z-40 bg-terminal">
        <Canvas dpr={[1, 1.75]} camera={{ fov: 70, near: 0.1, far: 120 }}>
          {cameraRig === 'first-person' ? (
            <PlayerControls
              spawn={spawn}
              yaw={yaw}
              speed={player?.speed}
              gravity={player?.gravity}
              sprint={player?.sprint}
              jump={player?.jump}
              onEvent={player?.onEvent}
            />
          ) : (
            <LockRig />
          )}
          <InteractionManager />
          {children}
        </Canvas>

        {hud}

        {/* ---- HUD (DOM) ---- */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-2 text-[11px] tracking-[0.25em]">
          <span className="text-phosphor/70">CONSTRUCT :: {title}</span>
          <span className="text-phosphor/40">[ESC] HOLD PROGRAM</span>
        </div>

        {snap.locked && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-phosphor/70">
            +
          </div>
        )}

        {snap.locked && snap.prompt && (
          <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 border border-phosphor/50 bg-terminal/80 px-4 py-2 text-xs tracking-[0.25em] text-phosphor">
            [E] {snap.prompt}
          </div>
        )}

        {snap.toast && (
          <div className="pointer-events-none absolute bottom-28 left-1/2 w-full max-w-md -translate-x-1/2 px-4 text-center">
            <p className="inline-block bg-terminal/80 px-3 py-1.5 text-xs italic leading-relaxed text-phosphor/80">
              {snap.toast}
            </p>
          </div>
        )}

        {showMenu && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal/70">
            <div className="w-full max-w-sm border border-phosphor/40 bg-terminal/90 p-5 text-center">
              <p className="text-[10px] tracking-[0.35em] text-phosphor-dim">PROGRAM HELD</p>
              <p className="glow mt-1 text-xl tracking-[0.3em] text-phosphor">{title}</p>
              <p className="mt-4 text-[11px] leading-relaxed text-phosphor/60">
                WASD / arrows — move · mouse — look
                <br />E / click — interact · ESC — hold program
              </p>
              <button
                type="button"
                onClick={() => store.lock()}
                className="glow mt-5 w-full border border-phosphor/60 px-4 py-2 text-xs tracking-[0.3em] text-phosphor hover:bg-phosphor/15"
              >
                [ TAKE CONTROL ]
              </button>
              <button
                type="button"
                onClick={onExit}
                className="mt-2 w-full border border-phosphor/30 px-4 py-2 text-xs tracking-[0.3em] text-phosphor/60 hover:text-phosphor"
              >
                [ EXIT CONSTRUCT ]
              </button>
            </div>
          </div>
        )}

        {overlay}
      </div>
    </SceneStoreContext.Provider>
  );
}
