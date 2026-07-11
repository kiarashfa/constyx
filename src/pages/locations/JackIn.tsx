import { useEffect, useRef, useState } from 'react';
import { MatrixRain, type RainHandle } from '../../engine/rain';
import { playJackInSound } from './audio';

interface JackInProps {
  title: string;
  /** True when the timeline finished but the scene chunk is still loading. */
  waiting: boolean;
  onComplete: () => void;
}

const STAGE_LINES = [
  'locating construct…',
  'signal accelerating…',
  'geometry compiling…',
  'residual self-image ok',
];

/**
 * The jack-in moment: a dedicated full-screen rain instance is retuned live
 * through the round-1 engine API — accelerate, then a tunnel-pull (CSS scale
 * + blur on the canvas), then a white glitch-flash — and hard-cuts to the
 * scene. Runs while the 3D chunk downloads in parallel.
 */
export function JackIn({ title, waiting, onComplete }: JackInProps) {
  const rainRef = useRef<RainHandle>(null);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    playJackInSound();
    const engine = () => rainRef.current?.engine();
    const timers = [
      setTimeout(() => {
        engine()?.setConfig({ speed: 42, density: 1, fadeAlpha: 0.16 });
        setStage(1);
      }, 700),
      setTimeout(() => {
        engine()?.setConfig({ speed: 130, fadeAlpha: 0.3 });
        setStage(2);
      }, 1500),
      setTimeout(() => {
        rainRef.current?.dispatch({ type: 'glitch-flash', color: '#ffffff', durationMs: 700 });
        setStage(3);
      }, 2150),
      setTimeout(onComplete, 2650),
    ];
    return () => timers.forEach(clearTimeout);
    // Timeline runs exactly once per mount by design.
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-terminal">
      <div
        className={`h-full w-full transition-[transform,filter] duration-1000 ease-in ${
          stage >= 2 ? 'scale-[2.4] blur-[2px]' : ''
        }`}
      >
        <MatrixRain
          ref={rainRef}
          className="block h-full w-full"
          config={{ speed: 18, density: 0.9, fadeAlpha: 0.1 }}
        />
      </div>

      {/* White-out beat before the hard cut. */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-500 ${
          stage >= 3 ? 'opacity-90' : 'opacity-0'
        }`}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`border border-phosphor/40 bg-terminal/80 px-6 py-4 text-center transition-opacity duration-300 ${
            stage >= 3 ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <p className="text-[11px] tracking-[0.4em] text-phosphor-dim">JACKING IN</p>
          <p className="glow mt-2 text-2xl tracking-[0.3em] text-phosphor">{title}</p>
          <p className="mt-3 text-xs text-phosphor/60">
            {waiting ? 'stabilizing signal…' : STAGE_LINES[stage]}
          </p>
        </div>
      </div>
    </div>
  );
}
