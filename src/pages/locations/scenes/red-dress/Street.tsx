import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh, MeshStandardMaterial } from 'three';
import type { Collider2D, Platform } from '../../engine3d/store';

/* A gray downtown block at midday — the film scene's washed, ordinary city.
 * Overcast light, drab facades; the only saturated thing on the street is
 * the dress. Corridor runs along z: spawn at +26, hardline booth at -26.
 */

export const STREET_PLATFORMS: Platform[] = [{ minX: -7.6, maxX: 7.6, minZ: -29, maxZ: 29, y: 0 }];

export const STREET_COLLIDERS: Collider2D[] = [
  { minX: -8.6, maxX: -7.4, minZ: -30, maxZ: 30 }, // west facades
  { minX: 7.4, maxX: 8.6, minZ: -30, maxZ: 30 }, // east facades
  { minX: -8, maxX: 8, minZ: 28.6, maxZ: 29.6 }, // behind spawn
  { minX: -8, maxX: 8, minZ: -29.6, maxZ: -28.6 }, // past the booth
  { minX: 4.7, maxX: 5.9, minZ: -26.6, maxZ: -25.6 }, // phone booth
  { minX: -2.4, maxX: -0.6, minZ: 18.2, maxZ: 19.4 }, // parked car A
  { minX: 0.8, maxX: 2.6, minZ: -14.6, maxZ: -13.4 }, // parked car B
  { minX: -6.9, maxX: -6.3, minZ: 2.7, maxZ: 3.3 }, // hydrant
];

const FACADE_SHADES = ['#6a6c70', '#75716a', '#5f6266', '#716d66', '#666a6e'];

function ParkedCar({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[1.7, 0.5, 1.1]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[1.0, 0.36, 1.0]} />
        <meshStandardMaterial color="#1d2126" roughness={0.2} metalness={0.5} />
      </mesh>
    </group>
  );
}

export function Street({ boothRinging }: { boothRinging: boolean }) {
  const buildings = useMemo(() => {
    let seed = 31337;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const list: { pos: [number, number, number]; size: [number, number, number]; shade: string }[] = [];
    for (const side of [-1, 1] as const) {
      let z = -30;
      while (z < 30) {
        const w = 6 + rand() * 6;
        const h = 9 + rand() * 14;
        list.push({
          pos: [side * (8.5 + 1.5), h / 2, z + w / 2],
          size: [3 + rand() * 2, h, w],
          shade: FACADE_SHADES[Math.floor(rand() * FACADE_SHADES.length)],
        });
        z += w + 0.4;
      }
    }
    return list;
  }, []);

  const boothLamp = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const mat = boothLamp.current?.material as MeshStandardMaterial | undefined;
    if (!mat) return;
    mat.emissiveIntensity = boothRinging ? 0.8 + Math.max(0, Math.sin(clock.elapsedTime * 7)) * 1.6 : 0.4;
  });

  return (
    <>
      <color attach="background" args={['#aab3ba']} />
      <fog attach="fog" args={['#aab3ba', 30, 85]} />
      {/* Overcast: big soft sky dome light, weak sun, no hard shadows */}
      <ambientLight color="#cdd3d8" intensity={1.0} />
      <hemisphereLight args={['#d8dde2', '#585c60', 1.0]} />
      <directionalLight position={[10, 24, 8]} color="#eef0f2" intensity={0.55} />

      {/* Road + sidewalks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[7, 60]} />
        <meshStandardMaterial color="#4d5156" roughness={0.85} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[s * 5.75, 0.012, 0]}>
          <planeGeometry args={[4.5, 60]} />
          <meshStandardMaterial color="#8b8f93" roughness={0.9} />
        </mesh>
      ))}
      {/* Center line + crosswalk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[0.14, 60]} />
        <meshStandardMaterial color="#c9c184" roughness={0.9} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-3 + i * 1.2, 0.02, 10]}>
          <planeGeometry args={[0.6, 2.4]} />
          <meshStandardMaterial color="#c2c6c9" roughness={0.9} />
        </mesh>
      ))}

      {/* Facades */}
      {buildings.map((b, i) => (
        <group key={i}>
          <mesh position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.shade} roughness={0.85} />
          </mesh>
          {/* storefront band */}
          <mesh position={[Math.sign(b.pos[0]) * 8.45, 1.5, b.pos[2]]}>
            <boxGeometry args={[0.15, 3, b.size[2] * 0.9]} />
            <meshStandardMaterial color="#3c4045" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Props */}
      <ParkedCar position={[-1.5, 0, 18.8]} color="#3f4a44" />
      <ParkedCar position={[1.7, 0, -14]} color="#44404e" />
      <mesh position={[-6.6, 0.3, 3]}>
        <cylinderGeometry args={[0.12, 0.16, 0.6, 8]} />
        <meshStandardMaterial color="#7a3b32" roughness={0.6} />
      </mesh>
      {/* Streetlights */}
      {[-18, 0, 18].map((z) => (
        <group key={z} position={[-4.2, 0, z]}>
          <mesh position={[0, 2.6, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 5.2, 8]} />
            <meshStandardMaterial color="#3a3e42" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* The hardline: a phone booth at the far end of the block */}
      <group position={[5.3, 0, -26.1]}>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[1.0, 2.5, 0.9]} />
          <meshStandardMaterial color="#37424c" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.35, 0.46]}>
          <planeGeometry args={[0.7, 1.6]} />
          <meshStandardMaterial color="#151c22" roughness={0.2} metalness={0.4} />
        </mesh>
        <mesh ref={boothLamp} position={[0, 2.62, 0]}>
          <boxGeometry args={[0.5, 0.22, 0.5]} />
          <meshStandardMaterial color="#1a2b22" emissive="#0d8a34" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </>
  );
}
