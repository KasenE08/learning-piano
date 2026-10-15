import { html, el, pad2 } from '../dom.js';
import { icons } from '../icons.js';
import { dock } from '../components/dock.js';
import { getProgress, getSettings, saveSettings } from '../../core/store.js';
import { playerLevel, rankFor } from '../../core/progress.js';

export const orientation = 'portrait';

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function render(root) {
  const p = getProgress();
  const s = getSettings();
  const { level } = playerLevel(p.xp);
  const screen = el(html`<main class="screen screen--portrait you">
    <header class="topbar"><span class="label">You</span></header>
    <h1 class="page-title display">Lv ${pad2(level)}<span>${rankFor(level)}</span></h1>
    <p class="page-sub">${p.xp.toLocaleString()} XP total · progress is saved on this device only.</p>

    ${standalone() ? '' : html`<div class="tip"><b class="display">Install the app</b><p>In Safari tap Share, then “Add to Home Screen”. It then runs full-screen and works offline.</p></div>`}

    <h2 class="group-title label">Practice</h2>
    <ul class="rows">
      <li class="row is-soon"><span>${icons.mic}</span><span class="row__t">Calibrate mic & keyboard<small>Range, latency, room noise · Phase 3</small></span>${icons.chevron}</li>
      <li class="row"><span>${icons.metronome}</span><span class="row__t">Metronome during play<small>Count-in always plays</small></span><button class="switch ${s.metronome ? 'is-on' : ''}" data-set="metronome" role="switch" aria-checked="${s.metronome}"><i></i></button></li>
      <li class="row"><span>${icons.songs}</span><span class="row__t">Sound effects<small>Muted while the mic listens</small></span><button class="switch ${s.sfx ? 'is-on' : ''}" data-set="sfx" role="switch" aria-checked="${s.sfx}"><i></i></button></li>
    </ul>

    <h2 class="group-title label">Your data</h2>
    <ul class="rows">
      <li class="row is-soon"><span>↓</span><span class="row__t">Export backup<small>Save progress as a JSON file · Phase 4</small></span>${icons.chevron}</li>
      <li class="row is-soon"><span>↑</span><span class="row__t">Import backup<small>Load a JSON backup · Phase 4</small></span>${icons.chevron}</li>
    </ul>

    <h2 class="group-title label">About</h2>
    <p class="about">Free, no accounts, no tracking. Piano samples: Salamander Grand Piano by Alexander Holm (CC-BY 3.0). Notation: VexFlow. Music: public domain or original.</p>
    <p class="about muted">Version ${__APP_VERSION__}</p>
  </main>`);

  screen.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.set;
    const on = !getSettings()[key];
    saveSettings({ [key]: on });
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', on);
  }));
  root.append(screen, dock('you'));
}
