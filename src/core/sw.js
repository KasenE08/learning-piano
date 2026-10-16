// Registers the Workbox service worker (production builds only) so the whole
// app, including fonts and content, works offline after the first visit.
// New versions wait until you tap "Update" (never a reload mid-lesson). Installed
// apps on iPhone stay open for days, so we also check for updates every hour and
// whenever the app comes back to the foreground.
import { html, el } from '../ui/dom.js';

export async function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const { registerSW } = await import('virtual:pwa-register');
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => showUpdateToast(() => updateSW(true)),
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      setInterval(check, 60 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    },
  });
}

export function showUpdateToast(onUpdate) {
  if (document.querySelector('.update-toast')) return;
  const t = el(html`<div class="update-toast" role="status">
    <span><b class="display">New version ready</b><small>Update now, or keep going: it waits.</small></span>
    <button class="btn btn--primary" data-update>Update</button>
    <button class="update-toast__x" data-later aria-label="Later">✕</button>
  </div>`);
  t.querySelector('[data-update]').addEventListener('click', () => { t.querySelector('[data-update]').disabled = true; onUpdate(); });
  t.querySelector('[data-later]').addEventListener('click', () => t.remove());
  document.body.append(t);
}
