import { useEffect, useState, type ComponentType } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSimulationScene, type SceneComponentProps } from './scenes';
import { JackIn } from './JackIn';

/**
 * /simulations/:sceneId — plays the jack-in transition while the 3D chunk
 * downloads in parallel, then hard-cuts into the scene. No three.js code is
 * imported here; it all arrives via the scene's dynamic import.
 */
export function SimulationSceneRoute() {
  const { sceneId } = useParams();
  const navigate = useNavigate();
  const def = sceneId ? getSimulationScene(sceneId) : undefined;

  const [Scene, setScene] = useState<ComponentType<SceneComponentProps> | null>(null);
  const [jackDone, setJackDone] = useState(false);

  useEffect(() => {
    if (!def) return;
    let alive = true;
    def.load().then((mod) => {
      if (alive) setScene(() => mod.default);
    });
    return () => {
      alive = false;
    };
  }, [def]);

  if (!def) return <Navigate to="/simulations" replace />;

  if (!jackDone || !Scene) {
    return (
      <JackIn
        title={def.title}
        waiting={jackDone && !Scene}
        onComplete={() => setJackDone(true)}
      />
    );
  }
  return <Scene onExit={() => navigate('/simulations')} />;
}
