import { useEffect, useState } from 'react';
import { useSceneStore } from '../../engine3d/store';

/**
 * PLACEHOLDER video ids — the real Matrix archive footage ids arrive in a
 * later round. Swap the `videoId` values below; nothing else changes.
 */
const TV_CHANNELS = [
  { videoId: 'dQw4w9WgXcQ', label: 'ARCHIVE 01' },
  { videoId: 'dQw4w9WgXcQ', label: 'ARCHIVE 02' },
  { videoId: 'dQw4w9WgXcQ', label: 'ARCHIVE 03' },
];

/**
 * Diegetic-ish player: the vintage set "switches on" into a clean overlay
 * framed like the TV's wooden cabinet, with three channel buttons.
 */
export function TvOverlay({ onClose }: { onClose: () => void }) {
  const store = useSceneStore();
  const [channel, setChannel] = useState(0);

  const close = () => {
    onClose();
    // Button click is a user gesture — safe to re-take pointer control.
    store.lock();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // close identity is stable enough for an escape hatch.
  }, []);

  const { videoId, label } = TV_CHANNELS[channel];

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-3xl">
        <div className="border-8 border-[#4a2f1b] bg-black shadow-[0_0_60px_rgba(0,0,0,0.8)]">
          <div className="aspect-video w-full">
            <iframe
              key={`${videoId}-${channel}`}
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
              title={`Broadcast archive — ${label}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {TV_CHANNELS.map((ch, i) => (
              <button
                key={ch.label}
                type="button"
                onClick={() => setChannel(i)}
                className={`border px-3 py-1.5 text-[11px] tracking-[0.25em] ${
                  i === channel
                    ? 'glow border-phosphor text-phosphor'
                    : 'border-phosphor/30 text-phosphor/50 hover:text-phosphor'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={close}
            className="border border-phosphor/50 px-3 py-1.5 text-[11px] tracking-[0.25em] text-phosphor hover:bg-phosphor/15"
          >
            [ POWER OFF — ESC ]
          </button>
        </div>
        <p className="mt-2 text-[10px] tracking-[0.2em] text-phosphor/40">
          placeholder feed :: real archive ids pending
        </p>
      </div>
    </div>
  );
}
