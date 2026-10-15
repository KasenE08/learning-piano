// Registers the Workbox service worker (production builds only) so the whole
// app, including fonts and content, works offline after the first visit.
export async function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  registerSW({ immediate: true });
}
