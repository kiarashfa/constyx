import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Vector3, type Group } from 'three';
import { useSceneStore } from './store';

interface InteractableProps {
  /** Prompt label, shown as "[E] LABEL" when focused. */
  label: string;
  onInteract: () => void;
  /** Max distance to interact, meters. */
  radius?: number;
  disabled?: boolean;
  /**
   * Set for objects that MOVE: the focus point re-derives from the group's
   * live world position on every query instead of a cached bounding-box
   * center. Static scenery should stay cached (cheaper, and bbox centers
   * are nicer focus points for furniture).
   */
  dynamic?: boolean;
  children: ReactNode;
}

/**
 * Generic interaction wrapper: put any mesh(es) inside and they become a
 * focusable, activatable object. Registration goes to the SceneStore; the
 * InteractionManager decides focus each frame; SceneShell renders the prompt
 * and routes E/click to `onInteract`. Scenes never touch that plumbing.
 */
export function Interactable({
  label,
  onInteract,
  radius = 2.8,
  disabled = false,
  dynamic = false,
  children,
}: InteractableProps) {
  const store = useSceneStore();
  const group = useRef<Group>(null);
  // The wrapper group itself sits wherever the scene graph put it — usually
  // the origin, since children carry their own position props. For STATIC
  // content the focus point is the bounding-box center of everything inside,
  // computed lazily and cached. For DYNAMIC content (a moving opponent) the
  // wrapper group is expected to carry the live transform, so we read its
  // world position each query and keep only the vertical offset to the
  // cached bbox center (so the focus point sits at chest height, not feet).
  const focus = useMemo(() => ({ center: new Vector3(), yOffset: 1, computed: false }), []);
  const bounds = useMemo(() => new Box3(), []);
  const live = useMemo(() => new Vector3(), []);

  useEffect(() => {
    if (disabled) return;
    focus.computed = false;
    return store.addInteractable({
      label,
      radius,
      getWorldPos: () => {
        const g = group.current;
        if (!g) return [focus.center.x, focus.center.y, focus.center.z];
        if (!focus.computed) {
          bounds.setFromObject(g);
          if (!bounds.isEmpty()) {
            bounds.getCenter(focus.center);
            g.getWorldPosition(live);
            focus.yOffset = focus.center.y - live.y;
            focus.computed = true;
          }
        }
        if (dynamic) {
          g.getWorldPosition(live);
          return [live.x, live.y + focus.yOffset, live.z];
        }
        return [focus.center.x, focus.center.y, focus.center.z];
      },
      onInteract,
    });
  }, [store, label, radius, disabled, dynamic, onInteract, focus, bounds, live]);

  return <group ref={group}>{children}</group>;
}

const FOCUS_CONE_DOT = 0.86; // ~30° half-angle

/**
 * Frame loop that picks the interactable the player is near AND looking at.
 * Runs every 5th frame — focus does not need 60Hz precision.
 */
export function InteractionManager() {
  const store = useSceneStore();
  const camera = useThree((state) => state.camera);
  const counter = useRef(0);
  const lookDir = useMemo(() => new Vector3(), []);
  const toObject = useMemo(() => new Vector3(), []);

  useFrame(() => {
    counter.current = (counter.current + 1) % 5;
    if (counter.current !== 0) return;

    const snap = store.getSnapshot();
    if (!snap.locked || snap.overlayOpen) {
      if (store.active) store.setActive(null);
      return;
    }

    // Focus test runs on the ground plane: interactable origins sit at floor
    // level, so a 3D cone would break the moment the player stands close and
    // the vector tilts downward. Horizontal aim + horizontal range is what
    // "looking at the thing in front of you" means in a walking sim.
    camera.getWorldDirection(lookDir);
    lookDir.y = 0;
    if (lookDir.lengthSq() < 1e-6) return; // staring straight down/up
    lookDir.normalize();

    let best = null;
    let bestDot = FOCUS_CONE_DOT;
    for (const entry of store.interactableValues()) {
      const [x, , z] = entry.getWorldPos();
      toObject.set(x - camera.position.x, 0, z - camera.position.z);
      const dist = toObject.length();
      if (dist > entry.radius || dist < 1e-3) continue;
      const dot = toObject.normalize().dot(lookDir);
      if (dot > bestDot) {
        bestDot = dot;
        best = entry;
      }
    }
    if (best?.id !== store.active?.id) store.setActive(best);
  });

  return null;
}
