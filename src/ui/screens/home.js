import { html, el, raw, pad2 } from '../dom.js';
import { icons } from '../icons.js';
import { dock } from '../components/dock.js';
import { sections, getProgress } from '../../core/store.js';
import { mapState, nextUp, playerLevel, rankFor, nextRank } from '../../core/progress.js';
import { SECTION_TEST_PASS } from '../../config/scoring.js';

export const orientation = 'portrait';

function vuMeter(fraction) {
  const n = 36;
  const on = Math.round(fraction * n);
  let s = '';
  for (let i = 0; i < n; i++) {
    const cls = i < on ? 'on' : i === on ? 'peak' : '';
    s += `<i class="${cls}" style="height:${40 + (i / n) * 60}%"></i>`;
  }
  return s;
}

export function render(root) {
  const p = getProgress();
  const state = mapState(sections, p);
  const up = nextUp(state);
  const { level, into, need } = playerLevel(p.xp);
  const nr = nextRank(level);
  const offline = !!navigator.serviceWorker?.controller;

  let hero;
  if (up.kind === 'level') {
    hero = { eyebrow: `Up next · ${up.section.title}`, num: pad2(up.level.n), title: up.level.title, sub: up.level.sub, href: `#/lesson/${up.level.id}` };
  } else if (up.kind === 'test') {
    hero = { eyebrow: `Up next · ${up.section.title}`, num: 'T', title: 'Section test', sub: `Score ${SECTION_TEST_PASS}% to unlock the next section.`, href: `#/lesson/${up.section.test.id}` };
  } else {
    hero = { eyebrow: 'All sections cleared', num: '★', title: 'Encore', sub: 'Replay anything for more stars.', href: '#/map' };
  }

  const screen = el(html`<main class="screen screen--portrait home">
    <header class="topbar">
      <span class="brand">KEYS<span>/</span>STAGE</span>
      <span class="status-dot ${offline ? '' : 'is-off'}"><i></i>${offline ? 'Offline ready' : 'Online'}</span>
    </header>

    <section class="player" aria-label="Player level">
      <div class="player__lv display"><small>LV</small>${pad2(level)}</div>
      <div class="player__meta">
        <b class="display">${rankFor(level)}</b>
        <span>${nr ? `Lv ${pad2(nr.level)} · ${nr.name}` : 'Top rank reached'}</span>
      </div>
    </section>
    <div class="vu" role="progressbar" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${into}">${raw(vuMeter(into / need))}</div>
    <div class="vu__row"><span><b>${into.toLocaleString()}</b> / ${need.toLocaleString()} XP</span><span>${(need - into).toLocaleString()} to go</span></div>

    <a class="hero" href="${hero.href}">
      <span class="hero__num display" aria-hidden="true">${hero.num}</span>
      <span class="label">${hero.eyebrow}</span>
      <h2 class="hero__title display">${hero.title}</h2>
      <p class="hero__sub">${hero.sub}</p>
      <span class="hero__play" aria-label="Play">${icons.play}</span>
    </a>

    <section class="setlist" aria-label="Sections">
      ${state.map((s, i) => html`<a class="setlist__row ${s.unlocked ? '' : 'is-locked'}" href="#/map/${s.id}">
        <span class="setlist__n display">${pad2(i + 1)}</span>
        <span class="setlist__mid">
          <span class="setlist__t display">${s.title}</span>
          ${s.unlocked ? html`<span class="setlist__bar"><b style="width:${(s.cleared / s.levels.length) * 100}%"></b></span>` : ''}
        </span>
        <span class="setlist__m">${s.unlocked ? `${s.cleared}/${s.levels.length} · ${s.stars}★` : i === 0 || state[i - 1].unlocked ? `Test ≥ ${SECTION_TEST_PASS}%` : 'Locked'}</span>
      </a>`)}
    </section>
  </main>`);
  root.append(screen, dock('home'));
}
