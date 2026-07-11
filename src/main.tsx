import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Clean paths (/operator) on GitHub Pages: the deploy workflow copies
// index.html to 404.html, so Pages serves the SPA for any deep link and the
// router takes over. BASE_URL is '/' in dev and '/<repo>/' in the Pages build
// (the workflow passes --base), so it doubles as the router basename.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
