import type { ComponentType } from 'react';

/** Props every 3D scene module's default component accepts. */
export interface SceneComponentProps {
  onExit: () => void;
}

export interface LocationSceneDef {
  /** Slug — route param under /locations/:sceneId. */
  id: string;
  title: string;
  blurb: string;
  status: 'online' | 'pending';
  /**
   * Lazy chunk loader. Everything 3D (three/r3f/drei + engine3d + the scene)
   * lives behind this dynamic import so the main bundle never pays for it.
   */
  load?: () => Promise<{ default: ComponentType<SceneComponentProps> }>;
}

export const SCENES: LocationSceneDef[] = [
  {
    id: 'white-room',
    title: 'WHITE ROOM',
    blurb: 'Broadcast archive. A room, a television, and the world as it was.',
    status: 'online',
    load: () => import('./scenes/white-room'),
  },
  {
    id: 'dojo',
    title: 'DOJO',
    blurb: 'Sparring program. Free your mind.',
    status: 'online',
    load: () => import('./scenes/dojo'),
  },
  {
    id: 'rooftop',
    title: 'ROOFTOP',
    blurb: 'The jump program. Nobody makes the first one.',
    status: 'online',
    load: () => import('./scenes/rooftop'),
  },
  {
    id: 'armory',
    title: 'ARMORY',
    blurb: 'Guns. Lots of guns.',
    status: 'online',
    load: () => import('./scenes/armory'),
  },
  {
    id: 'bullet-time',
    title: 'BULLET TIME',
    blurb: 'The air remembers. Bend where the bullet is not.',
    status: 'online',
    load: () => import('./scenes/bullet-time'),
  },
  {
    id: 'red-dress',
    title: 'THE STREET',
    blurb: 'A crowd, a distraction in red, and one face that is watching you back.',
    status: 'online',
    load: () => import('./scenes/red-dress'),
  },
];

export function getScene(id: string): LocationSceneDef | undefined {
  return SCENES.find((scene) => scene.id === id);
}
