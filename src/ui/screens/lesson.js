// Lesson screen shell (landscape). The engine (notes, playback, scoring) lands in Phase 2.
import { html, el, pad2 } from '../dom.js';
import { icons } from '../icons.js';
import { createKeyboard } from '../components/keyboard.js';
import { renderEmptyStaff } from '../components/staff.js';
import { sections, getSettings, saveSettings } from '../../core/store.js';
import { nameOf } from '../../core/music.js';
import { go } from '../../router.js';

export const orientation = 'landscape';

function lookup(id) {
  const m = /^([a-z]+)-(\d+|test)$/.exec(id || '');
  const s = m && sections.find((x) => x.id === m[1]);
  if (!s) return null;
  if (m[2] === 'test') return { section: s, title: 'Section test', label: `${s.title} · Test`, clefs: s.id === 'noob' ? ['treble'] : ['treble', 'bass'] };
  const n = Number(m[2]);
  const l = s.levels[n - 1];
  if (!l) return null;
  return { section: s, title: l.title, label: `${s.title} · ${pad2(n)}`, clefs: s.id === 'noob' ? ['treble'] : ['treble', 'bass'] };
}

export function render(root, params) {
  const info = lookup(params.id);
  if (!info) { go('/map'); return; }
  const settings = getSettings();

  const screen = el(html`<main class="screen screen--landscape lesson">
    <header class="hud">
      <a class="circle-btn" href="#/map/${params.id}" aria-label="Back to map">${icons.close}</a>
      <div class="hud__title"><span class="label">${info.label}</span><b class="display">${info.title}</b></div>
      <button class="pill" data-act="listen">${icons.play} Listen</button>
      <button class="pill ${settings.metronome ? 'pill--on' : ''}" data-act="metro" aria-pressed="${settings.metronome}">${icons.metronome} 72 BPM</button>
      <span class="hud__acc display">0<small>%</small></span>
      <span class="hud__combo"><b class="display">×0</b><span>combo</span></span>
    </header>
    <div class="stage">
      <div class="stage__staff"></div>
      <div class="playhead" aria-hidden="true"></div>
      <div class="stage__note">
        <span class="label">Preview build</span>
        <p>The lesson engine arrives in Phase 2. For now, try the keyboard below.</p>
        <p class="stage__last" aria-live="polite"></p>
      </div>
    </div>
    <div class="kbwrap"></div>
  </main>`);

  const last = screen.querySelector('.stage__last');
  const kb = createKeyboard({
    low: 48,
    keys: 36,
    onPress: (m) => { last.textContent = nameOf(m); },
  });
  screen.querySelector('.kbwrap').append(kb.el);
  // Demo marks so the shell shows the visual language: next key with finger, last hit.
  kb.setMarks({ 60: 'next' }, { 60: 1 });

  screen.querySelector('[data-act="metro"]').addEventListener('click', (e) => {
    const on = !getSettings().metronome;
    saveSettings({ metronome: on });
    e.currentTarget.classList.toggle('pill--on', on);
    e.currentTarget.setAttribute('aria-pressed', on);
  });

  root.append(screen);
  let alive = true;
  requestAnimationFrame(() => {
    if (alive) renderEmptyStaff(screen.querySelector('.stage__staff'), { clefs: info.clefs });
  });
  let t = 0;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const host = screen.querySelector('.stage__staff');
      host.replaceChildren();
      renderEmptyStaff(host, { clefs: info.clefs });
    }, 150);
  };
  window.addEventListener('resize', onResize);
  return () => { alive = false; clearTimeout(t); window.removeEventListener('resize', onResize); };
}
