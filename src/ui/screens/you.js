import { html, el, pad2 } from '../dom.js';
import { icons } from '../icons.js';
import { dock } from '../components/dock.js';
import { getProgress, getSettings, saveSettings, getCalibration } from '../../core/store.js';
import { nameOf } from '../../core/music.js';
import { playerLevel, rankFor } from '../../core/progress.js';

export const orientation = 'portrait';

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function render(root) {
  const p = getProgress();
  const s = getSettings();
  const cal = getCalibration();
  const { level } = playerLevel(p.xp);
  const screen = el(html`<main class="screen screen--portrait you">
    <header class="topbar"><span class="label">You</span></header>
    <h1 class="page-title display">Lv ${pad2(level)}<span>${rankFor(level)}</span></h1>
    <p class="page-sub">${p.xp.toLocaleString()} XP total · progress is saved on this device only.</p>

    ${standalone() ? '' : html`<div class="tip"><b class="display">Install the app</b><p>In Safari tap Share, then “Add to Home Screen”. It then runs full-screen and works offline.</p></div>`}

    <h2 class="group-title label">Practice</h2>
    <ul class="rows">
      <li class="row"><span>${icons.mic}</span><span class="row__t">Play with<small>${s.inputMode === 'mic' ? 'Your keyboard, heard through the mic' : 'On-screen keys'}</small></span>
        <span class="seg seg--sm" role="radiogroup" aria-label="Input"><button class="seg__b ${s.inputMode === 'mic' ? 'is-on' : ''}" data-input="mic">Keyboard</button><button class="seg__b ${s.inputMode === 'mic' ? '' : 'is-on'}" data-input="tap">Taps</button></span></li>
      <li class="row"><a class="row__link" href="#/calibrate"><span>◎</span><span class="row__t">Calibrate mic & keyboard<small>${cal ? `${nameOf(cal.low)}–${nameOf(cal.high)} · delay ${cal.micLatencyMs} ms · room ${Math.round(cal.noiseDb)} dB` : 'Not done yet · about a minute'}</small></span>${icons.chevron}</a></li>
      <li class="row"><a class="row__link" href="#/mictest"><span>♪</span><span class="row__t">Mic test<small>See which notes the app hears</small></span>${icons.chevron}</a></li>
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
  screen.querySelectorAll('[data-input]').forEach((b) => b.addEventListener('click', async () => {
    await saveSettings({ inputMode: b.dataset.input });
    screen.querySelectorAll('[data-input]').forEach((x) => x.classList.toggle('is-on', x === b));
    b.closest('.row').querySelector('small').textContent = b.dataset.input === 'mic' ? 'Your keyboard, heard through the mic' : 'On-screen keys';
  }));
  root.append(screen, dock('you'));
}
