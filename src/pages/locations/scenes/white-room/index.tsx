import { useRef, useState } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { ContactShadows, RoundedBox } from '@react-three/drei';
import type { Mesh, MeshStandardMaterial } from 'three';
import { SceneShell } from '../../engine3d/SceneShell';
import { Interactable } from '../../engine3d/Interactable';
import { useSceneStore, type Collider2D } from '../../engine3d/store';
import type { SceneComponentProps } from '../../scenes';
import { useAmbience, sfxTvClick } from '../../../../engine/audio';
import { TvOverlay } from './TvOverlay';

type GroupProps = ThreeElements['group'];

const VOID_WHITE = '#f2f5f3';
const LEATHER = '#571e1e';
const LEATHER_DARK = '#3d1414';
const WOOD = '#5a3a22';
const WOOD_DARK = '#392412';
const BRASS = '#967a44';

/**
 * Collision layout: an outer fence (the "void" is walkable but bounded) plus
 * boxes around each furniture piece. Coordinates mirror the models below.
 */
const COLLIDERS: Collider2D[] = [
  { minX: -17, maxX: 17, minZ: -17.5, maxZ: -16.5 },
  { minX: -17, maxX: 17, minZ: 16.5, maxZ: 17.5 },
  { minX: -17.5, maxX: -16.5, minZ: -17, maxZ: 17 },
  { minX: 16.5, maxX: 17.5, minZ: -17, maxZ: 17 },
  { minX: -2.35, maxX: -1.05, minZ: -1.45, maxZ: -0.15 }, // left chair
  { minX: 1.05, maxX: 2.35, minZ: -1.45, maxZ: -0.15 }, // right chair
  { minX: -0.85, maxX: 0.85, minZ: -2.75, maxZ: -1.85 }, // television
];

/** Ornate high-backed leather wingback, film-style, built from primitives. */
function WingbackChair(props: GroupProps) {
  return (
    <group {...props}>
      <RoundedBox args={[0.62, 0.18, 0.58]} radius={0.05} position={[0, 0.47, 0.05]}>
        <meshStandardMaterial color={LEATHER} roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[0.66, 0.34, 0.62]} radius={0.04} position={[0, 0.26, 0.03]}>
        <meshStandardMaterial color={LEATHER_DARK} roughness={0.6} />
      </RoundedBox>
      <RoundedBox
        args={[0.68, 1.08, 0.16]}
        radius={0.06}
        position={[0, 1.0, -0.27]}
        rotation={[-0.09, 0, 0]}
      >
        <meshStandardMaterial color={LEATHER} roughness={0.5} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Wing */}
          <RoundedBox
            args={[0.13, 0.62, 0.34]}
            radius={0.05}
            position={[side * 0.31, 1.14, -0.12]}
            rotation={[0, side * -0.45, 0]}
          >
            <meshStandardMaterial color={LEATHER} roughness={0.5} />
          </RoundedBox>
          {/* Arm */}
          <RoundedBox args={[0.15, 0.26, 0.55]} radius={0.06} position={[side * 0.315, 0.63, 0.06]}>
            <meshStandardMaterial color={LEATHER} roughness={0.55} />
          </RoundedBox>
          {/* Arm-front roll */}
          <mesh position={[side * 0.315, 0.58, 0.31]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
            <meshStandardMaterial color={LEATHER_DARK} roughness={0.5} />
          </mesh>
          {/* Legs */}
          {[-1, 1].map((frontBack) => (
            <mesh key={frontBack} position={[side * 0.26, 0.08, frontBack * 0.22 + 0.03]}>
              <cylinderGeometry args={[0.025, 0.035, 0.16, 10]} />
              <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** 1950s furniture-style console television with a curved glass screen. */
function ConsoleTV({ screenRef, ...props }: GroupProps & { screenRef: React.RefObject<Mesh | null> }) {
  return (
    <group {...props}>
      <RoundedBox args={[1.15, 0.72, 0.48]} radius={0.03} position={[0, 0.62, 0]}>
        <meshStandardMaterial color={WOOD} roughness={0.45} />
      </RoundedBox>
      {/* Splayed tapered legs */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * 0.47, 0.13, sz * 0.15]}
            rotation={[sz * 0.07, 0, sx * -0.09]}
          >
            <cylinderGeometry args={[0.016, 0.032, 0.27, 10]} />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.6} />
          </mesh>
        )),
      )}
      {/* Screen bezel (left two-thirds of the cabinet face) */}
      <RoundedBox args={[0.64, 0.52, 0.05]} radius={0.02} position={[-0.17, 0.66, 0.235]}>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.5} />
      </RoundedBox>
      {/* Curved CRT glass — a squashed sphere bulging out of the bezel */}
      <mesh ref={screenRef} position={[-0.17, 0.66, 0.2]} scale={[0.29, 0.23, 0.09]}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial
          color="#0b110d"
          roughness={0.25}
          metalness={0.1}
          emissive="#182b1f"
          emissiveIntensity={0.4}
        />
      </mesh>
      {/* Speaker grille */}
      <RoundedBox args={[0.3, 0.5, 0.04]} radius={0.02} position={[0.35, 0.68, 0.235]}>
        <meshStandardMaterial color="#2c1f16" roughness={0.95} />
      </RoundedBox>
      {/* Channel + volume knobs */}
      {[0.5, 0.36].map((y) => (
        <mesh key={y} position={[0.35, y - 0.06, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.035, 14]} />
          <meshStandardMaterial color={BRASS} roughness={0.35} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ChairWithInspect(props: GroupProps) {
  const store = useSceneStore();
  return (
    <Interactable
      label="INSPECT CHAIR"
      radius={2.3}
      onInteract={() =>
        store.toast('Oxblood leather, high back — older than the simulation pretending to contain it.')
      }
    >
      <WingbackChair {...props} />
    </Interactable>
  );
}

/** Idle CRT flicker so the dead screen still feels powered. */
function ScreenFlicker({ screenRef }: { screenRef: React.RefObject<Mesh | null> }) {
  useFrame(({ clock }) => {
    const mat = screenRef.current?.material as MeshStandardMaterial | undefined;
    if (!mat) return;
    const t = clock.elapsedTime;
    mat.emissiveIntensity = 0.35 + 0.12 * Math.sin(t * 2.1) + 0.05 * Math.sin(t * 13.7);
  });
  return null;
}

function RoomContents({ onSwitchOn }: { onSwitchOn: () => void }) {
  const screenRef = useRef<Mesh>(null);
  return (
    <>
      <color attach="background" args={[VOID_WHITE]} />
      <fog attach="fog" args={[VOID_WHITE, 9, 24]} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[4, 7, 3]} intensity={0.65} />
      <directionalLight position={[-5, 4, -2]} intensity={0.25} />

      {/* The endless white floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color={VOID_WHITE} roughness={0.9} />
      </mesh>
      <ContactShadows position={[0, 0.01, -1.4]} scale={10} far={3} blur={2.6} opacity={0.32} frames={1} />

      <ChairWithInspect position={[-1.7, 0, -0.8]} rotation={[0, 0.55, 0]} />
      <ChairWithInspect position={[1.7, 0, -0.8]} rotation={[0, -0.55, 0]} />

      <Interactable label="SWITCH ON THE ARCHIVE" radius={3} onInteract={onSwitchOn}>
        <ConsoleTV position={[0, 0, -2.3]} screenRef={screenRef} />
      </Interactable>
      <ScreenFlicker screenRef={screenRef} />
    </>
  );
}

/** The White Room — the Construct's broadcast-archive tableau. */
export default function WhiteRoomScene({ onExit }: SceneComponentProps) {
  useAmbience('whiteRoom');
  const [tvOpen, setTvOpen] = useState(false);
  return (
    <SceneShell
      title="WHITE ROOM"
      spawn={[0, 0, 5.5]}
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
