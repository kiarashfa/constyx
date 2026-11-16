import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Landing } from './pages/Landing';
import { OperatorPage } from './pages/operator/OperatorPage';
import { ConstructLayout, ConstructPage } from './pages/construct/ConstructPage';
import { LessonRoute } from './pages/construct/LessonRoute';
import { SimulationsPage } from './pages/simulations/SimulationsPage';
import { SimulationSceneRoute } from './pages/simulations/SimulationSceneRoute';
import { SanctuaryPage } from './pages/sanctuary/SanctuaryPage';
import { SanctuarySceneRoute } from './pages/sanctuary/SanctuarySceneRoute';
import { ScreensaverPage } from './pages/screensaver/ScreensaverPage';
import { AsciiPage } from './pages/ascii/AsciiPage';
import { CodeVisionPage } from './pages/code-vision/CodeVisionPage';
import { AboutPage } from './pages/about/AboutPage';
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
        <Route path="simulations" element={<SimulationsPage />} />
        <Route path="simulations/:sceneId" element={<SimulationSceneRoute />} />
        <Route path="sanctuary" element={<SanctuaryPage />} />
        <Route path="sanctuary/:sceneId" element={<SanctuarySceneRoute />} />
        <Route path="screensaver" element={<ScreensaverPage />} />
        <Route path="ascii" element={<AsciiPage />} />
        <Route path="code-vision" element={<CodeVisionPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
