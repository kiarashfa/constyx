import { useEffect, useState, type ComponentType } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { getFocusScene, type FocusSceneComponentProps } from './scenes';
import { JackIn } from '../locations/JackIn';

/**
 * /focus/:sceneId — same flow as Locations' SceneRoute: the shared jack-in
 * transition plays while the shader chunk downloads in parallel, then a hard
 * cut into the scene. No three.js in the main bundle.
 */
export function FocusSceneRoute() {
  const { sceneId } = useParams();
  const navigate = useNavigate();
  const def = sceneId ? getFocusScene(sceneId) : undefined;
  const loadable = def?.status === 'online' && def.load ? def : null;

  const [Scene, setScene] = useState<ComponentType<FocusSceneComponentProps> | null>(null);
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

  if (!loadable) return <Navigate to="/focus" replace />;

  if (!jackDone || !Scene) {
    return (
      <JackIn
        title={loadable.title}
        waiting={jackDone && !Scene}
        onComplete={() => setJackDone(true)}
      />
    );
  }
  return <Scene onExit={() => navigate('/focus')} />;
}
