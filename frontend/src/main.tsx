import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// iPhones ignore user-scalable=no; their pinch gesture can still be cancelled
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Keep the logo splash (index.html) up for at least this long after the page
// opens, so it reads as a deliberate welcome instead of a flash, then fade it out.
const SPLASH_MIN_MS = 2500;
const SPLASH_FADE_MS = 600;

const splash = document.getElementById('boot-splash');
if (splash) {
  const remaining = Math.max(0, SPLASH_MIN_MS - performance.now());
  window.setTimeout(() => {
    splash.classList.add('is-hiding');
    document.documentElement.classList.remove('splash-on');
    window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
  }, remaining);
}
