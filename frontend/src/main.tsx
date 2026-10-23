import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

// /rider is the riders' own app, /feedback/<order> the page from the feedback email;
// everything else is the shop (and /admin the console)
const isRider = /^\/rider(\/|$)/.test(window.location.pathname);
const isFeedback = /^\/feedback\/[^/]+/.test(window.location.pathname);
const Root = isRider
  ? lazy(() => import('./rider/RiderApp'))
  : isFeedback
    ? lazy(() => import('./feedback/FeedbackPage'))
    : lazy(() => import('./App.tsx'));
if (isFeedback) document.title = 'Your feedback · Amore';
if (isRider) {
  // Saved to a phone's home screen, it opens straight on the rider app
  document.title = 'Amore Riders';
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/rider.webmanifest');
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'Amore Riders');
}

// iPhones ignore user-scalable=no; their pinch gesture can still be cancelled
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);

// Keep the logo splash (index.html) up for at least this long after the page
// opens, so it reads as a deliberate welcome instead of a flash, then fade it out.
const SPLASH_MIN_MS = isRider || isFeedback ? 600 : 2500;
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
