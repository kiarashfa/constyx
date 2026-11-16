import { useEffect, useState, type ComponentType } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSanctuaryScene, type SanctuarySceneComponentProps } from './scenes';
import { JackIn } from '../simulations/JackIn';

/**
 * /sanctuary/:sceneId — same flow as SimulationSceneRoute: the shared jack-in
 * transition plays while the shader chunk downloads in parallel, then a hard
 * cut into the scene. No three.js in the main bundle.
 */
export function SanctuarySceneRoute() {
  const { sceneId } = useParams();
  const navigate = useNavigate();
  const def = sceneId ? getSanctuaryScene(sceneId) : undefined;

  const [Scene, setScene] = useState<ComponentType<SanctuarySceneComponentProps> | null>(null);
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

  if (!def) return <Navigate to="/sanctuary" replace />;

  if (!jackDone || !Scene) {
    return (
      <JackIn
        title={def.title}
        waiting={jackDone && !Scene}
        onComplete={() => setJackDone(true)}
      />
    );
  }
  return <Scene onExit={() => navigate('/sanctuary')} />;
}
