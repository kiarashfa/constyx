import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * Axis-aligned collision box on the XZ ground plane. Optional yMin/yMax make
 * a collider height-bounded (e.g. a building wall you can clear by jumping
 * above its roofline); omitted = infinite, which preserves round-4 scenes.
 */
export interface Collider2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yMin?: number;
  yMax?: number;
}

/**
 * A walkable surface: an XZ rectangle at a fixed height. Ground height at a
 * point is the highest platform under it; outside all platforms is void
 * (the player falls). Scenes that define no platforms get an infinite floor
 * at y=0 — the round-4 behavior.
 */
export interface Platform {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

/**
 * Live movement telemetry, mutated by PlayerControls every frame and read by
 * scene HUDs in their own rAF loops (never through React state — meters need
 * 60Hz without re-renders).
 */
export interface MotionState {
  /** Horizontal speed, m/s. */
  speed: number;
  /** Sprint ramp progress 0..1. */
  sprint01: number;
  charging: boolean;
  charge01: number;
  airborne: boolean;
  feetY: number;
  velY: number;
}

/** Events emitted by PlayerControls for scene game logic. */
export type PlayerEvent =
  | {
      type: 'jump';
      charge01: number;
      quality: number;
      speed: number;
      position: [number, number, number];
    }
  | { type: 'land'; impact: number; position: [number, number, number] }
  | { type: 'charge-fizzle' };

export interface InteractableEntry {
  id: number;
  /** Prompt text, shown as "[E] LABEL". */
  label: string;
  /** Max interaction distance in meters. */
  radius: number;
  getWorldPos: () => [number, number, number];
  onInteract: () => void;
}

export interface SceneSnapshot {
  locked: boolean;
  /** Prompt label of the interactable currently in focus, if any. */
  prompt: string | null;
  overlayOpen: boolean;
  toast: string | null;
}

/**
 * Tiny external store bridging the R3F world and the DOM HUD without
 * re-render storms: useFrame code mutates it, React reads it via
 * useSyncExternalStore, and only actual state changes notify.
 */
export class SceneStore {
  private listeners = new Set<() => void>();
  private snapshot: SceneSnapshot = {
    locked: false,
    prompt: null,
    overlayOpen: false,
    toast: null,
  };
  private nextId = 1;
  private interactables = new Map<number, InteractableEntry>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  /** Static scene collision, set once by SceneShell. */
  colliders: Collider2D[] = [];
  /** Walkable surfaces; empty = infinite floor at y=0 (round-4 scenes). */
  platforms: Platform[] = [];
  /** Currently focused interactable (non-reactive, for the frame loop). */
  active: InteractableEntry | null = null;
  /** Live movement telemetry — mutated by PlayerControls, polled by HUDs. */
  readonly motion: MotionState = {
    speed: 0,
    sprint01: 0,
    charging: false,
    charge01: 0,
    airborne: false,
    feetY: 0,
    velY: 0,
  };
  /** Wired by PlayerControls; callable from DOM buttons (user gestures). */
  lock: () => void = () => {};
  unlock: () => void = () => {};
  /** Wired by PlayerControls: reset position/velocity (respawns, resets). */
  teleport: (pos: [number, number, number], yaw?: number) => void = () => {};
  /** Wired by PlayerControls: decaying camera shake (landings, hits). */
  shake: (magnitude: number) => void = () => {};

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SceneSnapshot => this.snapshot;

  private set(patch: Partial<SceneSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  setLocked(locked: boolean): void {
    if (locked !== this.snapshot.locked) this.set({ locked });
  }

  setOverlayOpen(overlayOpen: boolean): void {
    if (overlayOpen !== this.snapshot.overlayOpen) this.set({ overlayOpen });
  }

  setActive(entry: InteractableEntry | null): void {
    this.active = entry;
    const prompt = entry?.label ?? null;
    if (prompt !== this.snapshot.prompt) this.set({ prompt });
  }

  addInteractable(entry: Omit<InteractableEntry, 'id'>): () => void {
    const id = this.nextId++;
    this.interactables.set(id, { ...entry, id });
    return () => {
      this.interactables.delete(id);
      if (this.active?.id === id) this.setActive(null);
    };
  }

  interactableValues(): IterableIterator<InteractableEntry> {
    return this.interactables.values();
  }

  /** Fire the focused interactable — gated to locked, overlay-free play. */
  interact(): void {
    if (this.snapshot.locked && !this.snapshot.overlayOpen) {
      this.active?.onInteract();
    }
  }

  /** Transient HUD message (inspection flavor text, hints). */
  toast(text: string, ms = 3600): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.set({ toast: text });
    this.toastTimer = setTimeout(() => this.set({ toast: null }), ms);
  }
}

export const SceneStoreContext = createContext<SceneStore | null>(null);

export function useSceneStore(): SceneStore {
  const store = useContext(SceneStoreContext);
  if (!store) throw new Error('useSceneStore must be used inside SceneShell');
  return store;
}

export function useSceneSnapshot(store: SceneStore): SceneSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
