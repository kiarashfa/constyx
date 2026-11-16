import type { ComponentType } from 'react';

/** Props every Sanctuary scene module's default component accepts. */
export interface SanctuarySceneComponentProps {
  onExit: () => void;
}

/**
 * Sanctuary scenes are fixed-POV, mouse-look-only raymarched shader scenes —
 * no movement, no collision, no objectives. Same registry shape as
 * Simulations (`src/pages/simulations/scenes.ts`) so the hub/route/lazy-chunk
 * pattern carries over unchanged.
 */
export interface SanctuarySceneDef {
  /** Slug — route param under /sanctuary/:sceneId. */
  id: string;
  title: string;
  blurb: string;
  /**
   * Lazy chunk loader. All three/r3f code plus the scene's GLSL lives behind
   * this dynamic import; the main bundle never pays for it.
   */
  load: () => Promise<{ default: ComponentType<SanctuarySceneComponentProps> }>;
}

export const SANCTUARY_SCENES: SanctuarySceneDef[] = [
  {
    id: 'mobil-ave',
    title: 'MOBIL AVE',
    blurb:
      'A station between worlds. Cream tile, green trim, an empty bench. Every couple of minutes, the train comes through.',
    load: () => import('./scenes/mobil-ave'),
  },
  {
    id: 'pod-bay',
    title: 'POD BAY',
    blurb:
      'The fields where nobody wakes. Towers of sleepers glowing red against the dark, lightning walking between them.',
    load: () => import('./scenes/pod-bay'),
  },
  {
    id: 'debir-court',
    title: 'DEBIR COURT',
    blurb:
      'An ordinary park under an overcast sky. A bench, pigeons on patrol, the kind of quiet the Oracle liked.',
    load: () => import('./scenes/debir-court'),
  },
  {
    id: 'tea-house',
    title: 'TEA HOUSE',
    blurb:
      'An upstairs room in Chinatown. Paper windows, tea for two, and nobody keeping score.',
    load: () => import('./scenes/tea-house'),
  },
  {
    id: 'office',
    title: 'METACORTEX',
    blurb:
      'Your cubicle at a respectable software company. The window cleaners are still out there.',
    load: () => import('./scenes/office'),
  },
  {
    id: 'bridge',
    title: 'ADAMS STREET',
    blurb: 'Under the bridge, night rain coming down in sheets. Wait for the car.',
    load: () => import('./scenes/bridge'),
  },
  {
    id: 'architect',
    title: 'THE ARCHITECT',
    blurb: 'A room walled in monitors, every screen watching something. The chair is yours now.',
    load: () => import('./scenes/architect'),
  },
  {
    id: 'restaurant',
    title: 'LE VRAI',
    blurb:
      'The Merovingian’s dining room. Candlelight, silverware, and conversation that isn’t yours.',
    load: () => import('./scenes/restaurant'),
  },
];

export function getSanctuaryScene(id: string): SanctuarySceneDef | undefined {
  return SANCTUARY_SCENES.find((scene) => scene.id === id);
}
