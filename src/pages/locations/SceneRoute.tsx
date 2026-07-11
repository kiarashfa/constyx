import { useEffect, useState, type ComponentType } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getScene, type SceneComponentProps } from './scenes';
import { JackIn } from './JackIn';

/**
 * /locations/:sceneId — plays the jack-in transition while the 3D chunk
 * downloads in parallel, then hard-cuts into the scene. No three.js code is
 * imported here; it all arrives via the scene's dynamic import.
 */
export function SceneRoute() {
  const { sceneId } = useParams();
  const navigate = useNavigate();
  const def = sceneId ? getScene(sceneId) : undefined;
  const loadable = def?.status === 'online' && def.load ? def : null;

  const [Scene, setScene] = useState<ComponentType<SceneComponentProps> | null>(null);
  const [jackDone, setJackDone] = useState(false);

  useEffect(() => {
    if (!loadable?.load) return;
    let alive = true;
    loadable.load().then((mod) => {
      if (alive) setScene(() => mod.default);
    });
    return () => {
      alive = false;
    };
  }, [loadable]);

  if (!loadable) return <Navigate to="/locations" replace />;

  if (!jackDone || !Scene) {
    return (
      <JackIn
        title={loadable.title}
        waiting={jackDone && !Scene}
        onComplete={() => setJackDone(true)}
      />
    );
  }
  return <Scene onExit={() => navigate('/locations')} />;
}
