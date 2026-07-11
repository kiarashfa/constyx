import { useEffect, useRef } from 'react';
import { MatrixRain, type RainHandle } from '../../../../engine/rain';
import { useSceneStore } from '../../engine3d/store';
import { SWEET_START, SWEET_END, SPRINT_MAX } from './tuning';

export type RooftopPhase = 'run' | 'glitch' | 'pullout';

interface RooftopHudProps {
  phase: RooftopPhase;
  fails: number;
  maxFails: number;
  cleared: boolean;
}

/**
 * Scene HUD driven by store.motion in a rAF loop with direct DOM writes —
 * meters animate at frame rate without a single React re-render.
 */
export function RooftopHud({ phase, fails, maxFails, cleared }: RooftopHudProps) {
  const store = useSceneStore();
  const momentumFill = useRef<HTMLDivElement>(null);
  const momentumText = useRef<HTMLSpanElement>(null);
  const momentumLabel = useRef<HTMLSpanElement>(null);
  const chargeWrap = useRef<HTMLDivElement>(null);
  const chargeFill = useRef<HTMLDivElement>(null);
  const chargeStatus = useRef<HTMLSpanElement>(null);
  const fallOverlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const m = store.motion;

      if (momentumFill.current && momentumText.current && momentumLabel.current) {
        const frac = Math.min(1, m.speed / SPRINT_MAX);
        momentumFill.current.style.width = `${(frac * 100).toFixed(1)}%`;
        momentumText.current.textContent = `${m.speed.toFixed(1)} m/s`;
        const committed = m.sprint01 >= 0.97;
        momentumLabel.current.textContent = committed ? 'VELOCITY COMMITTED' : 'APPROACH VELOCITY';
        momentumLabel.current.className = committed
          ? 'glow text-phosphor'
          : 'text-phosphor/60';
        momentumFill.current.className = committed
          ? 'h-full bg-phosphor transition-none'
          : 'h-full bg-phosphor/55 transition-none';
      }

      if (chargeWrap.current && chargeFill.current && chargeStatus.current) {
        chargeWrap.current.style.opacity = m.charging ? '1' : '0.35';
        const pct = Math.min(1.15, m.charge01);
        chargeFill.current.style.width = `${(Math.min(pct, 1) * 100).toFixed(1)}%`;
        if (!m.charging) {
          chargeStatus.current.textContent = 'HOLD SPACE TO CHARGE';
          chargeStatus.current.className = 'text-phosphor/50';
        } else if (m.charge01 < SWEET_START) {
          chargeStatus.current.textContent = 'CHARGING…';
          chargeStatus.current.className = 'text-phosphor/80';
        } else if (m.charge01 <= SWEET_END) {
          chargeStatus.current.textContent = '▶ RELEASE NOW ◀';
          chargeStatus.current.className = 'glow text-phosphor';
        } else {
          chargeStatus.current.textContent = 'OVERCHARGING —';
          chargeStatus.current.className = 'text-[#ff5f56]';
        }
      }

      if (fallOverlay.current) {
        const falling = m.airborne && m.velY < -7;
        fallOverlay.current.style.opacity = falling
          ? String(Math.min(0.85, (-m.velY - 7) / 14))
          : '0';
        fallOverlay.current.classList.toggle('fall-shake', falling);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [store]);

  return (
    <>
      {/* Plummet vignette + jitter */}
      <div
        ref={fallOverlay}
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(120,10,10,0.55) 85%)',
        }}
      />

      {/* Meters */}
      <div className="pointer-events-none absolute bottom-6 left-6 space-y-3 text-[10px] tracking-[0.25em]">
        <div>
          <p className="mb-1 flex justify-between gap-6">
            <span ref={momentumLabel} className="text-phosphor/60">
              APPROACH VELOCITY
            </span>
            <span ref={momentumText} className="text-phosphor/80">
              0.0 m/s
            </span>
          </p>
          <div className="h-2.5 w-64 border border-phosphor/40 bg-terminal/70">
            <div ref={momentumFill} className="h-full bg-phosphor/55" style={{ width: '0%' }} />
          </div>
        </div>
        <div ref={chargeWrap} style={{ opacity: 0.35 }}>
          <p className="mb-1">
            <span ref={chargeStatus} className="text-phosphor/50">
              HOLD SPACE TO CHARGE
            </span>
          </p>
          <div className="relative h-2.5 w-64 border border-phosphor/40 bg-terminal/70">
            <div ref={chargeFill} className="h-full bg-phosphor/70" style={{ width: '0%' }} />
            {/* Sweet release bracket */}
            <div
              className="absolute bottom-0 top-0 border-x-2 border-phosphor bg-phosphor/20"
              style={{ left: `${SWEET_START * 100}%`, width: `${(SWEET_END - SWEET_START) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Session status */}
      <div className="pointer-events-none absolute right-4 top-10 text-right text-[10px] tracking-[0.25em]">
        <p className={fails > 0 ? 'text-[#ff5f56]' : 'text-phosphor/50'}>
          FAILS {fails}/{maxFails}
        </p>
        {cleared && <p className="glow mt-1 text-phosphor">JUMP CLEARED ✓</p>}
        <p className="mt-1 text-phosphor/40">SHIFT sprint · SPACE charge</p>
      </div>

      {/* Simulation-fault reload */}
      {phase === 'glitch' && <GlitchReload />}

      {/* Ten fails — the operator pulls the plug */}
      {phase === 'pullout' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-terminal/90">
          <div className="max-w-md border border-[#ff5f56]/60 bg-terminal/95 p-6 text-center">
            <p className="text-[10px] tracking-[0.4em] text-[#ff5f56]">SIGNAL UNSTABLE</p>
            <p className="glow mt-2 text-xl tracking-[0.25em] text-phosphor">
              THE OPERATOR IS PULLING YOU OUT
            </p>
            <p className="mt-3 text-xs leading-relaxed text-phosphor/60">
              Ten hard resets in one session strains the residual self-image. Breathe.
              Jack back in from the hub whenever you're ready — the roof isn't going anywhere.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Full-screen rain burst + white/red flashes — the construct reloading. */
function GlitchReload() {
  const rainRef = useRef<RainHandle>(null);
  useEffect(() => {
    const flashes = [
      setTimeout(() => rainRef.current?.dispatch({ type: 'glitch-flash', color: '#ffffff', durationMs: 90 }), 120),
      setTimeout(() => rainRef.current?.dispatch({ type: 'glitch-flash', color: '#ff3344', durationMs: 130 }), 450),
      setTimeout(() => rainRef.current?.dispatch({ type: 'glitch-flash', color: '#ffffff', durationMs: 90 }), 850),
    ];
    return () => flashes.forEach(clearTimeout);
  }, []);
  return (
    <div className="absolute inset-0 z-20">
      <MatrixRain
        className="block h-full w-full"
        config={{ speed: 90, density: 1, fadeAlpha: 0.28, fontSize: 14 }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="border border-phosphor/50 bg-terminal/80 px-5 py-3 text-sm tracking-[0.3em] text-phosphor">
          SIMULATION FAULT :: RELOADING CONSTRUCT
        </p>
      </div>
    </div>
  );
}
