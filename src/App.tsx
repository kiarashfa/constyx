import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Landing } from './pages/Landing';
import { OperatorPage } from './pages/operator/OperatorPage';
import { ConstructLayout, ConstructPage } from './pages/construct/ConstructPage';
import { LessonRoute } from './pages/construct/LessonRoute';
import { LocationsPage } from './pages/locations/LocationsPage';
import { SceneRoute } from './pages/locations/SceneRoute';
import { FocusPage } from './pages/focus/FocusPage';
import { FocusSceneRoute } from './pages/focus/FocusSceneRoute';
import { ScreensaverPage } from './pages/screensaver/ScreensaverPage';
import { AsciiPage } from './pages/ascii/AsciiPage';
import { CodeVisionPage } from './pages/code-vision/CodeVisionPage';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Landing />} />
        <Route path="operator" element={<OperatorPage />} />
        <Route path="construct" element={<ConstructLayout />}>
          <Route index element={<ConstructPage />} />
          <Route path=":programId" element={<LessonRoute />} />
        </Route>
        <Route path="locations" element={<LocationsPage />} />
        <Route path="locations/:sceneId" element={<SceneRoute />} />
        <Route path="focus" element={<FocusPage />} />
        <Route path="focus/:sceneId" element={<FocusSceneRoute />} />
        <Route path="screensaver" element={<ScreensaverPage />} />
        <Route path="ascii" element={<AsciiPage />} />
        <Route path="code-vision" element={<CodeVisionPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
