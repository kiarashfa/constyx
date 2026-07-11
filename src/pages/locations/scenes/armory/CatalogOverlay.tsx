import { useEffect, useState } from 'react';
import { useSceneStore } from '../../engine3d/store';
import { CATEGORY_LABEL, type WeaponCategory, type WeaponEntry } from './types';
import { byCategory, CATALOG, CATEGORIES } from './weapons';

interface CatalogOverlayProps {
  loadedId: string | null;
  onLoad: (weapon: WeaponEntry) => void;
  onClose: () => void;
}

/**
 * The armory manifest: category rail → rack list → dossier panel. Terminal
 * styling throughout; reads like ordnance paperwork, not a storefront.
 */
export function CatalogOverlay({ loadedId, onLoad, onClose }: CatalogOverlayProps) {
  const store = useSceneStore();
  const [category, setCategory] = useState<WeaponCategory>('pistols');
  const [selectedId, setSelectedId] = useState<string>(byCategory('pistols')[0].id);
  const list = byCategory(category);
  const selected = CATALOG.find((w) => w.id === selectedId) ?? list[0];

  const close = () => {
    onClose();
    store.lock();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyM') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Stable enough for an escape hatch.
  }, []);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-terminal/90 p-4">
      <div className="flex h-[min(78vh,640px)] w-full max-w-4xl flex-col border border-phosphor/40 bg-terminal/95">
        <header className="flex items-center justify-between border-b border-phosphor/30 px-4 py-2">
          <p className="text-[11px] tracking-[0.35em] text-phosphor/80">
            ARMORY MANIFEST :: {CATALOG.length} ENTRIES ON RACK
          </p>
          <button
            type="button"
            onClick={close}
            className="text-[11px] tracking-[0.25em] text-phosphor/50 hover:text-phosphor"
          >
            [ CLOSE — ESC ]
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[150px_200px_minmax(0,1fr)]">
          {/* Category rail */}
          <nav className="overflow-y-auto border-r border-phosphor/20 p-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  setSelectedId(byCategory(cat)[0].id);
                }}
                className={`block w-full px-2 py-2 text-left text-[10px] tracking-[0.2em] ${
                  cat === category
                    ? 'bg-phosphor/15 text-phosphor'
                    : 'text-phosphor/50 hover:text-phosphor'
                }`}
              >
                {CATEGORY_LABEL[cat]}
                <span className="ml-1 text-phosphor/40">({byCategory(cat).length})</span>
              </button>
            ))}
          </nav>

          {/* Rack list */}
          <ul className="overflow-y-auto border-r border-phosphor/20 p-2">
            {list.map((weapon) => (
              <li key={weapon.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(weapon.id)}
                  className={`block w-full px-2 py-2 text-left text-xs tracking-[0.12em] ${
                    weapon.id === selected.id
                      ? 'bg-phosphor/15 text-phosphor'
                      : 'text-phosphor/60 hover:text-phosphor'
                  }`}
                >
                  {weapon.name}
                  {weapon.id === loadedId && <span className="ml-2 text-phosphor">◈</span>}
                </button>
              </li>
            ))}
          </ul>

          {/* Dossier */}
          <article className="flex min-h-0 flex-col p-4">
            <p className="text-[10px] tracking-[0.3em] text-phosphor-dim">
              {CATEGORY_LABEL[selected.category]}
            </p>
            <h2 className="glow mt-1 text-xl tracking-[0.2em] text-phosphor">{selected.name}</h2>
            <p className="mt-1 border-b border-phosphor/20 pb-2 text-[11px] tracking-[0.08em] text-phosphor/60">
              {selected.spec}
            </p>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3 pr-1">
              {selected.body.map((para, i) => (
                <p key={i} className="text-[13px] leading-relaxed text-phosphor/75">
                  {para}
                </p>
              ))}
              {selected.filmNote && (
                <p className="border-l-2 border-phosphor/50 pl-3 text-xs italic leading-relaxed text-phosphor/60">
                  ◈ {selected.filmNote}
                </p>
              )}
            </div>
            <div className="flex gap-2 border-t border-phosphor/20 pt-3">
              <button
                type="button"
                onClick={() => {
                  onLoad(selected);
                  store.lock();
                }}
                className="glow flex-1 border border-phosphor/60 px-3 py-2 text-xs tracking-[0.3em] text-phosphor hover:bg-phosphor/15"
              >
                {selected.id === loadedId ? '[ RELOAD WEAPON ]' : '[ LOAD WEAPON ]'}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-phosphor/40">
              reference notes written for this console from standard firearms literature —
              manufacturer histories and military adoption records. range is hot down the aisle.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
