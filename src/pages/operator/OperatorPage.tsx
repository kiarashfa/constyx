import { useCallback, useEffect, useRef, useState } from 'react';
import { MatrixRain, type RainHandle } from '../../engine/rain';
import { Panel } from '../../components/Panel';
import { PageHeader } from '../../components/PageHeader';
import { useShift } from './useShift';
import { ActionMenu } from './ActionMenu';
import { BriefingOverlay, PausedOverlay, ResultsOverlay } from './FeedOverlays';
import { CallsPanel, CareerPanel, LogPanel, SessionPanel, TracePanel } from './HudPanels';

/** Denser, slightly larger rain for the game surface: readable anomaly tells
 * and click targets ~18px wide. */
const FEED_RAIN = {
  fontSize: 18,
  speed: 11,
  speedVariance: 0.45,
  density: 0.95,
  fadeAlpha: 0.085,
};

export function OperatorPage() {
  const rainRef = useRef<RainHandle>(null);
  const getEngine = useCallback(() => rainRef.current?.engine() ?? null, []);
  const shift = useShift(getEngine);

  const feedRef = useRef<HTMLDivElement>(null);
  const [feedWidth, setFeedWidth] = useState(0);
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setFeedWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onFeedPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // An open menu absorbs the first click as "close" — no probe penalty for
    // backing out of a target.
    if (shift.target) {
      shift.cancelTarget();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    shift.clickFeed(e.clientX - rect.left);
  };

  const running = shift.phase === 'running';

  return (
    <>
      <PageHeader code="01" title="OPERATOR">
        Live feed from inside the Matrix. Anomalies surface as columns that fall wrong —
        target them and make the right call before the trace warms up.
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel
          title="MATRIX FEED"
          bodyClassName="relative min-h-[440px] p-0 lg:min-h-[520px]"
        >
          <div
            ref={feedRef}
            className={`absolute inset-0 ${running ? 'cursor-crosshair' : ''}`}
            onPointerDown={running ? onFeedPointerDown : undefined}
          >
            <MatrixRain ref={rainRef} className="block h-full w-full" config={FEED_RAIN} />

            {shift.target && (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 border-x border-phosphor-bright/70 bg-phosphor/10"
                  style={{ left: shift.target.x, width: shift.target.cellWidth }}
                />
                <ActionMenu
                  x={shift.target.x}
                  cellWidth={shift.target.cellWidth}
                  containerWidth={feedWidth}
                  column={shift.target.column}
                  onAction={shift.chooseAction}
                  onCancel={shift.cancelTarget}
                />
              </>
            )}

            {running && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={shift.togglePause}
                className="absolute right-2 top-2 border border-phosphor/30 bg-terminal/80 px-2 py-1 text-[10px] tracking-[0.25em] text-phosphor/60 hover:text-phosphor"
              >
                [ HOLD FEED ]
              </button>
            )}

            {shift.phase === 'idle' && (
              <BriefingOverlay career={shift.career} onStart={shift.startShift} />
            )}
            {shift.phase === 'paused' && <PausedOverlay onResume={shift.togglePause} />}
            {shift.phase === 'ended' && shift.result && (
              <ResultsOverlay
                result={shift.result}
                career={shift.career}
                onRestart={shift.startShift}
                onDismiss={shift.standDown}
              />
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <SessionPanel
            clockMs={shift.clockRemainingMs}
            score={shift.score}
            activeSignals={shift.activeSignals}
            running={running}
          />
          <TracePanel trace={shift.trace} />
          {shift.phase === 'idle' ? (
            <CareerPanel career={shift.career} />
          ) : (
            <CallsPanel counts={shift.counts} />
          )}
          <LogPanel log={shift.log} />
        </div>
      </div>
    </>
  );
}
