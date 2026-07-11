import { Link } from 'react-router-dom';
import { Panel } from '../../components/Panel';
import { PageHeader } from '../../components/PageHeader';
import { OfflineTag } from '../../components/OfflineTag';
import { SCENES } from './scenes';

/** The Locations hub: online scenes are enterable, the rest keep compiling. */
export function LocationsPage() {
  return (
    <>
      <PageHeader code="03" title="LOCATIONS">
        Simulation decks pulled from the Construct. Each one loads a place that never
        existed — walk it anyway. Jacking in takes over your screen; ESC hands it back.
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {SCENES.map((scene) =>
          scene.status === 'online' ? (
            <Link
              key={scene.id}
              to={`/locations/${scene.id}`}
              className="group flex min-h-[180px] flex-col border border-phosphor/40 bg-terminal/75 p-4 transition-colors hover:border-phosphor"
            >
              <header className="flex items-baseline justify-between">
                <span className="text-xs tracking-[0.3em] text-phosphor/80 group-hover:glow group-hover:text-phosphor">
                  {scene.title}
                </span>
                <span className="text-[11px] tracking-[0.2em] text-phosphor">● ONLINE</span>
              </header>
              <p className="mt-3 flex-1 text-sm text-phosphor/60">{scene.blurb}</p>
              <p className="mt-4 text-xs tracking-[0.3em] text-phosphor opacity-60 transition-opacity group-hover:opacity-100">
                [ JACK IN ▸ ]
              </p>
            </Link>
          ) : (
            <Panel key={scene.id} title={scene.title} className="min-h-[180px]">
              <p className="text-sm text-phosphor/60">{scene.blurb}</p>
              <p className="mt-6">
                <OfflineTag label="COMPILING // SIM OFFLINE" />
              </p>
            </Panel>
          ),
        )}
      </div>

      <p className="mt-4 text-xs text-phosphor-dim">
        &gt; simulation protocol :: WASD move · mouse look · E interact · ESC hold program
      </p>
    </>
  );
}
