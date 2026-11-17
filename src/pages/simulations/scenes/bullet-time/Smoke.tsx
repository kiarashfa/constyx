import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, type Mesh, type MeshBasicMaterial } from 'three';

/** Soft lumpy puff: a few overlapping radial blobs on a canvas. */
function makePuffTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 9; k++) {
    const x = size * (0.3 + 0.4 * rand());
    const y = size * (0.3 + 0.4 * rand());
    const r = size * (0.18 + 0.16 * rand());
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

interface Puff {
  x: number;
  y: number;
  z: number;
  size: number;
  drift: number;
  phase: number;
}

/**
 * The grey smoke left by the fight, hanging low over the deck and rolling
 * slowly across it (film: the bend shots have it banked behind the operator
 * and around the plant room). Camera-facing sprites, depth-tested, no writes.
 */
export function Smoke() {
  const tex = useMemo(makePuffTexture, []);
  const puffs = useMemo<Puff[]>(() => {
    let seed = 99;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out: Puff[] = [];
    // banks: around the plant room behind the player, along the left, a thin veil behind the agent
    const banks: [number, number, number, number, number][] = [
      [-6.5, 8.5, 5, 3.5, 9],
      [-11, -1, 3, 7, 8],
      [4, 9, 6, 2.5, 6],
      [-3, -15.5, 9, 2, 6],
    ];
    for (const [cx, cz, rx, rz, n] of banks) {
      for (let i = 0; i < n; i++) {
        out.push({
          x: cx + (rand() - 0.5) * 2 * rx,
          y: 0.5 + rand() * 1.6,
          z: cz + (rand() - 0.5) * 2 * rz,
          size: 2.6 + rand() * 3.2,
          drift: 0.05 + rand() * 0.12,
          phase: rand() * Math.PI * 2,
        });
      }
    }
    return out;
  }, []);
  const refs = useRef<(Mesh | null)[]>([]);

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    puffs.forEach((p, i) => {
      const m = refs.current[i];
      if (!m) return;
      // drift downwind (toward +x) and wrap, swell and thin as it goes
      const span = 14;
      const along = ((t * p.drift + p.phase) % span) - span / 2;
      m.position.set(p.x + along, p.y + Math.sin(t * 0.2 + p.phase) * 0.15, p.z);
      m.quaternion.copy(camera.quaternion);
      const s = p.size * (1 + 0.15 * Math.sin(t * 0.13 + p.phase));
      m.scale.set(s, s * 0.7, 1);
      const edge = 1 - Math.abs(along) / (span / 2);
      (m.material as MeshBasicMaterial).opacity = 0.32 * Math.min(1, edge * 3);
    });
  });

  return (
    <>
      {puffs.map((_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} renderOrder={4}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} color="#dfe8e0" transparent depthWrite={false} opacity={0.3} />
        </mesh>
      ))}
    </>
  );
}
