import { useEffect } from 'react';
import { ACTIONS, type ActionId } from './threats';

interface ActionMenuProps {
  /** Canvas-relative x of the targeted column's left edge (CSS px). */
  x: number;
  cellWidth: number;
  /** Width of the feed container, for clamping the popover. */
  containerWidth: number;
  column: number;
  onAction: (action: ActionId) => void;
  onCancel: () => void;
}

const MENU_WIDTH = 232;

/**
 * Verb menu anchored to the targeted column. The menu is fixed — one verb per
 * anomaly signature — so identifying the threat from its look in the rain IS
 * the game; the menu never leaks the answer.
 */
export function ActionMenu({ x, cellWidth, containerWidth, column, onAction, onCancel }: ActionMenuProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      const idx = Number.parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < ACTIONS.length) onAction(ACTIONS[idx].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAction, onCancel]);

  const center = x + cellWidth / 2;
  const left = Math.max(8, Math.min(center - MENU_WIDTH / 2, containerWidth - MENU_WIDTH - 8));

  return (
    <div
      className="absolute top-3 z-10 border border-phosphor/60 bg-terminal/95 shadow-[0_0_24px_rgba(0,255,65,0.15)]"
      style={{ left, width: MENU_WIDTH }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="flex items-center justify-between border-b border-phosphor/40 px-2 py-1 text-[10px] tracking-[0.25em] text-phosphor/80">
        <span>NODE {String(column).padStart(2, '0')} :: ANOMALY</span>
        <button type="button" onClick={onCancel} className="text-phosphor/50 hover:text-phosphor">
          [ESC]
        </button>
      </header>
      <ul className="p-1">
        {ACTIONS.map(({ id, label, hint }, i) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onAction(id)}
              className="group flex w-full items-baseline gap-2 px-2 py-1.5 text-left hover:bg-phosphor/15"
            >
              <span className="text-[10px] text-phosphor/40 group-hover:text-phosphor/70">{i + 1}</span>
              <span className="text-xs tracking-widest text-phosphor group-hover:glow">{label}</span>
              <span className="ml-auto text-[10px] text-phosphor/40">{hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
