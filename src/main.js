import '@fontsource/big-shoulders-display/latin-500';
import '@fontsource/big-shoulders-display/latin-700';
import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/manrope/latin-400';
import '@fontsource/manrope/latin-600';
import '@fontsource/manrope/latin-800';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/app.css';

import { start, go } from './router.js';
import * as orientation from './core/orientation.js';
import { registerServiceWorker } from './core/sw.js';
import { requestPersistence } from './core/db.js';
import * as store from './core/store.js';
import * as home from './ui/screens/home.js';
import * as map from './ui/screens/map.js';
import * as lesson from './ui/screens/lesson.js';
import * as songs from './ui/screens/songs.js';
import * as you from './ui/screens/you.js';
import * as calibrate from './ui/screens/calibrate.js';
import * as mictest from './ui/screens/mictest.js';

const screens = { home, map, lesson, songs, you, calibrate, mictest };

async function boot() {
  await store.load();
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('toast')) {
    const { showUpdateToast } = await import('./core/sw.js');
    showUpdateToast(() => {});
  }
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { demoProgress } = await import('./dev/demo.js');
    store.useTransientProgress(demoProgress());
  }
  orientation.init();
  start(screens, (screen, name) => {
    orientation.requireOrientation(screen.orientation, name === 'lesson' ? () => go('/map') : null);
  });
  registerServiceWorker();
  requestPersistence();
}

boot();
