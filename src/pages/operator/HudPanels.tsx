import { Panel } from '../../components/Panel';
import type { LogEntry, ShiftCounts } from './useShift';
import type { CareerStats } from './storage';

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SessionPanel({
  clockMs,
  score,
  activeSignals,
  running,
}: {
  clockMs: number;
  score: number;
  activeSignals: number;
  running: boolean;
}) {
  return (
    <Panel title="SESSION">
      <ul className="space-y-2 text-xs text-phosphor/70">
        <li className="flex justify-between">
          <span>SHIFT CLOCK</span>
          <span className={`text-base ${running ? 'glow text-phosphor' : 'text-phosphor/40'}`}>
            {formatClock(clockMs)}
          </span>
        </li>
        <li className="flex justify-between">
          <span>STANDING</span>
          <span className={score < 0 ? 'text-[#ff5f56]' : 'text-phosphor'}>{score}</span>
        </li>
        <li className="flex justify-between">
          <span>ACTIVE SIGNALS</span>
          <span className={activeSignals > 0 ? 'glow text-phosphor' : 'text-phosphor/40'}>
            {activeSignals}
          </span>
        </li>
      </ul>
    </Panel>
  );
}

const TRACE_BLOCKS = 20;

export function TracePanel({ trace }: { trace: number }) {
  const filled = Math.round((trace / 100) * TRACE_BLOCKS);
  const status =
    trace < 30 ? 'COLD' : trace < 60 ? 'WARM' : trace < 85 ? 'HOT' : 'CRITICAL';
  const color =
    trace < 30 ? 'text-phosphor' : trace < 60 ? 'text-[#b8e62e]' : trace < 85 ? 'text-[#ffb020]' : 'text-[#ff3344]';
  return (
    <Panel title="TRACE">
      <p className={`text-sm leading-none ${color}`}>
        {'▓'.repeat(filled)}
        <span className="text-phosphor/25">{'░'.repeat(TRACE_BLOCKS - filled)}</span>
      </p>
      <p className="mt-2 flex justify-between text-xs text-phosphor/70">
        <span>
          STATUS :: <span className={color}>{status}</span>
        </span>
        <span>{Math.round(trace)}%</span>
      </p>
    </Panel>
  );
}

export function CallsPanel({ counts }: { counts: ShiftCounts }) {
  return (
    <Panel title="CALLS">
      <ul className="space-y-2 text-xs text-phosphor/70">
        <li className="flex justify-between"><span>CORRECT</span><span className="text-phosphor">{counts.correct}</span></li>
        <li className="flex justify-between"><span>WRONG</span><span className={counts.wrong ? 'text-[#ff5f56]' : ''}>{counts.wrong}</span></li>
        <li className="flex justify-between"><span>MISSED</span><span className={counts.missed ? 'text-[#ff5f56]' : ''}>{counts.missed}</span></li>
        <li className="flex justify-between"><span>CLEAN PROBES</span><span>{counts.probes}</span></li>
      </ul>
    </Panel>
  );
}

const TONE_CLASS: Record<LogEntry['tone'], string> = {
  info: 'text-phosphor/80',
  good: 'text-phosphor-bright',
  bad: 'text-[#ff5f56]',
  dim: 'text-phosphor/40',
};

export function LogPanel({ log }: { log: LogEntry[] }) {
  return (
    <Panel title="SIGNAL LOG" bodyClassName="p-3">
      {log.length === 0 ? (
        <p className="text-[11px] text-phosphor/40">channel quiet…</p>
      ) : (
        <ul className="space-y-1.5">
          {log.slice(0, 9).map((entry) => (
            <li key={entry.id} className={`text-[11px] leading-snug ${TONE_CLASS[entry.tone]}`}>
              <span className="text-phosphor/35">T+{formatClock(entry.at)}</span> {entry.text}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function CareerPanel({ career }: { career: CareerStats }) {
  return (
    <Panel title="OPERATOR RECORD">
      <ul className="space-y-2 text-xs text-phosphor/70">
        <li className="flex justify-between"><span>SHIFTS</span><span className="text-phosphor">{career.shiftsCompleted}</span></li>
        <li className="flex justify-between"><span>BEST SHIFT</span><span className="text-phosphor">{career.bestScore}</span></li>
        <li className="flex justify-between"><span>BEST ACCURACY</span><span>{Math.round(career.bestAccuracy * 100)}%</span></li>
        <li className="flex justify-between"><span>TIMES TRACED</span><span>{career.shiftsTraced}</span></li>
      </ul>
    </Panel>
  );
}
