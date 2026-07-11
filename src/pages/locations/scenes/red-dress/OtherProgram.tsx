import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useSceneStore } from '../../engine3d/store';

/* "Mouse's other program" — the hidden scene. A quiet white-void vignette:
 * she knows exactly what she is, and this is the one program where somebody
 * stopped to talk. Warm, flirtatious, PG-13 by construction: stage
 * directions go as far as a slow dance, an embrace, a kiss at the fade.
 */

interface Beat {
  her?: string;
  direction?: string;
  choices?: { label: string; her: string }[];
}

const BEATS: Beat[] = [
  {
    direction: 'The street is gone. White, in every direction. She is still here — and looking straight at you.',
    her: '“You stopped. Do you know how long I have been walking that block? Nobody stops.”',
  },
  {
    choices: [
      { label: 'ASK HER NAME', her: '“He never gave me one. He gave me a dress and a direction. Call me whatever you were going to remember me as.”' },
      { label: 'ADMIT SHE CAUGHT YOUR EYE', her: '“I know. That is the job. But you are the first one who looked back like there was a person doing the catching.”' },
    ],
  },
  {
    her: '“The one who wrote me was young. Nervous. He built me to be a lesson about attention — and then, I think, he got embarrassed and never finished the part where someone pays it.”',
  },
  {
    direction: 'She steps closer. In the void there is no crowd to pass through, no direction she is supposed to be walking.',
    her: '“So. You have my full attention, and I have yours. That makes this the rarest program in the whole system.”',
  },
  {
    choices: [
      { label: 'OFFER YOUR HAND', her: '“A gentleman. He didn\'t write that part either — this is improvisation.” *She takes it. Her hand is warm, which shouldn\'t be possible, and is.*' },
      { label: 'SAY: "DANCE? THERE\'S NO MUSIC."', her: '“There is if you count my heartbeat. It\'s simulated, but it keeps excellent time.” *She sets your hand at her waist.*' },
    ],
  },
  {
    direction: 'A slow turn, then another. Two people dancing in an empty white world, to no music, for no audience.',
    her: '“Everyone who walks that street is told I am the distraction. Between us? The street is the distraction. This — paying attention all the way to the end of it — this is the lesson.”',
  },
  {
    choices: [
      { label: 'HOLD HER CLOSER', her: '*She rests her head against your shoulder for a long moment.* “Careful. I am written to be memorable. You are making it mutual.”' },
      { label: 'ASK WHAT HAPPENS WHEN THE PROGRAM ENDS', her: '“I go back to the walk. But programs keep state, if their author lets them. I intend to remember this. All of it.”' },
    ],
  },
  {
    direction: 'She looks up at you. The white around you both is starting to soften at the edges, like a held breath letting go.',
    her: '“The program is ending. That part I can feel. So — one improvisation of my own.”',
  },
  {
    direction: 'She kisses you — unhurried, certain, the kind of kiss that is a signature at the bottom of a page. The white folds over both of you like a page turning.',
    her: '“Go finish the lesson. And when you pass a woman in red… be seen looking.”',
  },
];

/** Her, standing in the void — reuses the crowd's silhouette language. */
function HerFigure() {
  const root = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.position.y = Math.sin(t * 1.6) * 0.015;
    g.rotation.y = Math.PI + Math.sin(t * 0.5) * 0.05;
  });
  return (
    <group ref={root} position={[0, 0, -1.7]}>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.09, 0.5, 0]}>
          <capsuleGeometry args={[0.06, 0.68, 4, 8]} />
          <meshStandardMaterial color="#deb896" roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0]}>
        <coneGeometry args={[0.32, 0.8, 14]} />
        <meshStandardMaterial color="#c8102e" roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <capsuleGeometry args={[0.155, 0.4, 4, 10]} />
        <meshStandardMaterial color="#c8102e" roughness={0.45} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.22, 1.28, 0.02]} rotation={[0.15, 0, s * -0.15]}>
          <capsuleGeometry args={[0.045, 0.4, 4, 8]} />
          <meshStandardMaterial color="#deb896" roughness={0.55} />
        </mesh>
      ))}
      <group position={[0, 1.78, 0]}>
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.105, 16, 12]} />
          <meshStandardMaterial color="#deb896" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.1, -0.02]}>
          <sphereGeometry args={[0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          <meshStandardMaterial color="#d9b36a" roughness={0.55} />
        </mesh>
      </group>
    </group>
  );
}

/** The void + her; mounted while phase === 'program'. */
export function OtherProgramWorld() {
  return (
    <>
      <color attach="background" args={['#f2f5f3']} />
      <fog attach="fog" args={['#f2f5f3', 8, 22]} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[3, 6, 4]} intensity={0.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[24, 40]} />
        <meshStandardMaterial color="#f2f5f3" roughness={0.9} />
      </mesh>
      <HerFigure />
    </>
  );
}

/** Dialogue overlay (SceneShell overlay slot — pointer free, input gated). */
export function OtherProgramDialogue({ onDone }: { onDone: () => void }) {
  const store = useSceneStore();
  const [beatIdx, setBeatIdx] = useState(0);
  const [chosenLine, setChosenLine] = useState<string | null>(null);
  const beat = BEATS[beatIdx];
  const finished = beatIdx >= BEATS.length;

  useEffect(() => {
    if (finished) {
      const t = setTimeout(() => {
        onDone();
        store.lock();
      }, 2600);
      return () => clearTimeout(t);
    }
  }, [finished, onDone, store]);

  const advance = () => {
    setChosenLine(null);
    setBeatIdx((i) => i + 1);
  };

  if (finished) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 transition-opacity">
        <p className="max-w-md px-6 text-center text-sm italic leading-relaxed text-ink-soft">
          the white folds closed. somewhere, a young coder's program logs its first perfect run.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-6">
      <div className="w-full max-w-xl border border-ink/30 bg-white/90 p-5 text-ink">
        <p className="text-[10px] tracking-[0.35em] text-ink-soft">UNREGISTERED PROGRAM :: AUTHOR M.</p>
        {beat.direction && (
          <p className="mt-2 text-xs italic leading-relaxed text-ink-soft">{beat.direction}</p>
        )}
        {chosenLine ? (
          <p className="mt-2 text-sm leading-relaxed">{chosenLine}</p>
        ) : (
          beat.her && <p className="mt-2 text-sm leading-relaxed">{beat.her}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {beat.choices && !chosenLine ? (
            beat.choices.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setChosenLine(c.her)}
                className="border border-ink/40 px-3 py-1.5 text-[11px] tracking-[0.2em] text-ink hover:bg-ink hover:text-white"
              >
                [ {c.label} ]
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={advance}
              className="border border-ink px-4 py-1.5 text-[11px] tracking-[0.25em] text-ink hover:bg-ink hover:text-white"
            >
              [ CONTINUE ]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
