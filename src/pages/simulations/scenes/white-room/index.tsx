import { useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { Color, MeshBasicMaterial, MeshStandardMaterial, type Mesh, type Object3D } from 'three';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import { RendererLook } from '../../engine3d/RendererLook';
import { getGLTF, preloadGLTF } from '../../engine3d/assets';
import { useSceneStore, type Collider2D } from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { useAmbience, sfxTvClick } from '../../../../engine/audio';
import { TvOverlay } from './TvOverlay';
import sceneUrl from './assets/white-room.glb?url';

/** Awaited by the scene route behind the jack-in transition. */
export const preload = () => preloadGLTF(sceneUrl);

/** The void: floor, horizon and sky are one colour, so the room has no edges. */
const VOID_WHITE = '#eef2ee';

/**
 * Collision layout: an outer fence (the void is walkable but bounded) plus a
 * box per prop. Prop boxes mirror the placements baked into the scene file.
 */
const COLLIDERS: Collider2D[] = [
  { minX: -17, maxX: 17, minZ: -17.5, maxZ: -16.5 },
  { minX: -17, maxX: 17, minZ: 16.5, maxZ: 17.5 },
  { minX: -17.5, maxX: -16.5, minZ: -17, maxZ: 17 },
  { minX: 16.5, maxX: 17.5, minZ: -17, maxZ: 17 },
  { minX: -1.53, maxX: -0.53, minZ: -0.55, maxZ: 0.49 }, // left chair
  { minX: 0.53, maxX: 1.53, minZ: -0.55, maxZ: 0.49 }, // right chair
  { minX: -0.29, maxX: 0.29, minZ: -2.74, maxZ: -2.24 }, // television
  { minX: -0.48, maxX: -0.11, minZ: -0.87, maxZ: -0.51 }, // wine table
];

interface RoomParts {
  chairs: Object3D[];
  tv: Object3D;
  table: Object3D;
  floor: Object3D;
  screen: MeshStandardMaterial | null;
}

/** Pull the named props out of the scene file and fix up the two special materials. */
function prepareRoom(): RoomParts | null {
  const gltf = getGLTF(sceneUrl);
  if (!gltf) return null;
  const find = (name: string) => gltf.scene.getObjectByName(name);
  const chairL = find('Chair_L');
  const chairR = find('Chair_R');
  const tv = find('TV');
  const table = find('Table');
  const floor = find('Floor') as Mesh | undefined;
  if (!chairL || !chairR || !tv || !table || !floor) return null;

  // The floor is pure void colour with the baked contact shadows multiplied in.
  // Unlit and outside tone mapping, so it meets the background without a seam.
  const baked = floor.material as MeshStandardMaterial;
  if (!(floor.material instanceof MeshBasicMaterial)) {
    floor.material = new MeshBasicMaterial({
      map: baked.map,
      color: new Color(VOID_WHITE),
      toneMapped: false,
      fog: false,
    });
  }

  const screenMesh = find('TV_Screen') as Mesh | undefined;
  const screen = (screenMesh?.material as MeshStandardMaterial | undefined) ?? null;
  if (screen) {
    screen.emissive = new Color('#1d3226');
    screen.envMapIntensity = 1.4;
  }
  return { chairs: [chairL, chairR], tv, table, floor, screen };
}

/** Idle CRT flicker so the dead screen still feels powered. */
function ScreenFlicker({ screen }: { screen: MeshStandardMaterial | null }) {
  useFrame(({ clock }) => {
    if (!screen) return;
    const t = clock.elapsedTime;
    screen.emissiveIntensity = 0.5 + 0.16 * Math.sin(t * 2.1) + 0.07 * Math.sin(t * 13.7);
  });
  return null;
}

/**
 * Shadowless studio light for the void: a broad overhead source, softer walls
 * and a bright floor bounce, built in place (no HDR download).
 */
function VoidLight() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#b9beb9']} />
      <Lightformer form="rect" intensity={2.6} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[16, 16, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[0, 3, 9]} scale={[18, 6, 1]} />
      <Lightformer form="rect" intensity={1.1} position={[0, 3, -9]} scale={[18, 6, 1]} />
      <Lightformer form="rect" intensity={1.1} position={[-9, 3, 0]} rotation-y={Math.PI / 2} scale={[18, 6, 1]} />
      <Lightformer form="rect" intensity={1.1} position={[9, 3, 0]} rotation-y={Math.PI / 2} scale={[18, 6, 1]} />
      <Lightformer form="rect" intensity={0.9} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
    </Environment>
  );
}

function RoomContents({ onSwitchOn }: { onSwitchOn: () => void }) {
  const store = useSceneStore();
  const room = useMemo(prepareRoom, []);
  return (
    <>
      <RendererLook exposure={1.05} />
      <color attach="background" args={[VOID_WHITE]} />
      <VoidLight />
      {room && (
        <>
          <primitive object={room.floor} />
          {room.chairs.map((chair) => (
            <Interactable
              key={chair.name}
              label="INSPECT CHAIR"
              radius={2.3}
              onInteract={() =>
                store.toast('Oxblood leather, cracked and button-tufted. Older than the simulation pretending to contain it.')
              }
            >
              <primitive object={chair} />
            </Interactable>
          ))}
          <Interactable
            label="INSPECT REMOTE"
            radius={1.9}
            onInteract={() => store.toast('One button would be enough. It has several, for your comfort.')}
          >
            <primitive object={room.table} />
          </Interactable>
          <Interactable label="SWITCH ON THE ARCHIVE" radius={3} onInteract={onSwitchOn}>
            <primitive object={room.tv} />
          </Interactable>
          <ScreenFlicker screen={room.screen} />
        </>
      )}
    </>
  );
}

/** The White Room: the Construct's broadcast-archive tableau. */
export default function WhiteRoomScene({ onExit }: SceneComponentProps) {
  useAmbience('whiteRoom');
  const [tvOpen, setTvOpen] = useState(false);
  return (
    <SceneShell
      title="WHITE ROOM"
      spawn={[0.35, 0, 3.6]}
      colliders={COLLIDERS}
      onExit={onExit}
      overlay={tvOpen ? <TvOverlay onClose={() => setTvOpen(false)} /> : null}
    >
      <RoomContents
        onSwitchOn={() => {
          sfxTvClick();
          setTvOpen(true);
        }}
      />
    </SceneShell>
  );
}
