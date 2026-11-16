import type { ComponentType } from 'react';

/** Props every 3D scene module's default component accepts. */
export interface SceneComponentProps {
  onExit: () => void;
}

export interface SimulationSceneDef {
  /** Slug — route param under /simulations/:sceneId. */
  id: string;
  title: string;
  blurb: string;
  /**
   * Lazy chunk loader. Everything 3D (three/r3f/drei + engine3d + the scene)
   * lives behind this dynamic import so the main bundle never pays for it.
   */
  load: () => Promise<{ default: ComponentType<SceneComponentProps> }>;
}

export const SIMULATION_SCENES: SimulationSceneDef[] = [
  {
    id: 'white-room',
    title: 'WHITE ROOM',
    blurb: 'Broadcast archive. A room, a television, and the world as it was.',
    load: () => import('./scenes/white-room'),
  },
  {
    id: 'dojo',
    title: 'DOJO',
    blurb: 'Sparring program. Free your mind.',
    load: () => import('./scenes/dojo'),
  },
  {
    id: 'rooftop',
    title: 'ROOFTOP',
    blurb: 'The jump program. Nobody makes the first one.',
    load: () => import('./scenes/rooftop'),
  },
  {
    id: 'armory',
    title: 'ARMORY',
    blurb: 'Guns. Lots of guns.',
    load: () => import('./scenes/armory'),
  },
  {
    id: 'bullet-time',
    title: 'BULLET TIME',
    blurb: 'The air remembers. Bend where the bullet is not.',
    load: () => import('./scenes/bullet-time'),
  },
  {
    id: 'red-dress',
    title: 'THE STREET',
    blurb: 'A crowd, a distraction in red, and one face that is watching you back.',
    load: () => import('./scenes/red-dress'),
  },
];

export function getSimulationScene(id: string): SimulationSceneDef | undefined {
  return SIMULATION_SCENES.find((scene) => scene.id === id);
}
