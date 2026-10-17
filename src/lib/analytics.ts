/**
 * Google Analytics 4 — the only place the measurement ID lives.
 *
 * The ID is public by design (it is visible in any page's network traffic).
 * Loaded from the app entry, so every route — including the per-route HTML
 * the build emits — picks it up through the one bundle. Production only, so
 * local development never reports. Route changes are counted by GA4's
 * enhanced measurement (browser-history page views), so no per-route calls
 * are needed here.
 */
export const GA_MEASUREMENT_ID = 'G-MMXNZPP3LC';

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: Gtag;
  }
}

export function initAnalytics(): void {
  if (!import.meta.env.PROD || window.gtag) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the `arguments` object itself, not an array copy.
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
}
