// Progress map: one continuous setlist line through all four sections.
import { html, el, pad2 } from '../dom.js';
import { icons, stars } from '../icons.js';
import { dock } from '../components/dock.js';
import { openSheet } from '../components/sheet.js';
import { sections, songs, getProgress, saveProgress } from '../../core/store.js';
import { mapState, nextUp, clearFresh } from '../../core/progress.js';
import { SECTION_TEST_PASS, TIMING_WINDOWS_MS } from '../../config/scoring.js';

export const orientation = 'portrait';

function songStops(sectionId, p) {
  // Songs tied to a level appear right after it; hidden ones sit before the test as "?".
  const after = {};
  const hidden = [];
  for (const s of songs) {
    const lvl = s.unlock.level;
    const unlocked = !!p.songs[s.id]?.unlocked;
    const starsGot = p.songs[s.id]?.stars || 0;
    if (lvl && lvl.startsWith(`${sectionId}-`) && !s.hidden) (after[lvl] ||= []).push({ ...s, unlocked, stars: starsGot });
    else if (s.hidden && (s.unlock.stars === sectionId || lvl?.startsWith(`${sectionId}-`))) hidden.push({ ...s, unlocked, stars: starsGot });
  }
  return { after, hidden };
}

let fresh = new Set();
const newBadge = (id) => (fresh.has(id) ? html`<span class="new">NEW</span>` : '');

function stopHtml(kind, data, lit, current) {
  if (kind === 'level') {
    const l = data;
    if (current) {
      return html`<li class="stop stop--current is-lit" data-level="${l.id}">
        <button class="stop__dot" aria-label="Level ${l.n}"></button>
        <button class="stop__card">
          <span class="stop__t display">${l.title}${newBadge(l.id)}<small>Level ${pad2(l.n)} · ${l.sub}</small></span>
          <span class="stop__go display">Play</span>
        </button>
      </li>`;
    }
    return html`<li class="stop ${l.unlocked ? '' : 'is-locked'} ${lit ? 'is-lit' : ''} ${l.stars ? 'is-done' : ''}" data-level="${l.id}">
      <button class="stop__dot" aria-hidden="true" tabindex="-1"></button>
      <button class="stop__main">
        <span class="stop__t display">${l.title}${newBadge(l.id)}<small>Level ${pad2(l.n)}${l.song ? ' · song' : ''}</small></span>
        ${l.stars ? stars(l.stars) : l.unlocked ? '' : html`<span class="stop__lock">${icons.lock}</span>`}
      </button>
    </li>`;
  }
  if (kind === 'song') {
    const s = data;
    const inner = html`<span class="stop__t display stop__t--song">${s.hidden && !s.unlocked ? '???' : s.title}${newBadge(s.id)}<small>${s.unlocked ? `Bonus song · ${s.stars ? '★'.repeat(s.stars) : 'tap to play'}` : s.hidden ? 'Hidden song · keep playing' : 'Bonus song · locked'}</small></span>`;
    return html`<li class="stop stop--song ${lit ? 'is-lit' : ''} ${s.unlocked ? 'is-done' : 'is-locked'}">
      <span class="stop__dot" aria-hidden="true"></span>
      ${s.unlocked ? html`<a class="stop__main" href="#/lesson/song-${s.id}">${inner}</a>` : html`<span class="stop__main">${inner}</span>`}
    </li>`;
  }
  // test
  const { section, test, nextTitle } = data;
  return html`<li class="stop stop--test ${lit ? 'is-lit' : ''} ${test.passed ? 'is-done' : test.unlocked ? '' : 'is-locked'} ${current ? 'is-current' : ''}" data-test="${section.id}">
    <button class="stop__dot" aria-hidden="true" tabindex="-1"></button>
    <button class="stop__main">
      <span class="stop__t display">Section test<small>${test.passed ? `Passed · best ${Math.round(test.best)}%` : nextTitle ? `Score ${SECTION_TEST_PASS}% to unlock ${nextTitle}` : `Score ${SECTION_TEST_PASS}% to finish the course`}</small></span>
      ${test.passed ? html`<span class="stop__badge">PASSED</span>` : test.unlocked ? '' : html`<span class="stop__lock">${icons.lock}</span>`}
    </button>
  </li>`;
}

function levelSheet(section, level) {
  const body = el(html`<div class="lsheet">
    <span class="label">${section.title} · Level ${pad2(level.n)}</span>
    <h3 class="lsheet__t display">${level.title}</h3>
    <p class="lsheet__sub">${level.sub}</p>
    <div class="lsheet__row">
      <div><b class="display">${level.best == null ? '—' : `${Math.round(level.best)}%`}</b><span class="label">Best</span></div>
      <div>${stars(level.stars)}<span class="label">Stars</span></div>
      <div><b class="display">±${TIMING_WINDOWS_MS[section.id]}</b><span class="label">ms window</span></div>
    </div>
    ${level.unlocked
      ? html`<a class="btn btn--primary btn--wide" href="#/lesson/${level.id}">${icons.play} ${level.stars ? 'Play again' : 'Play'}</a>`
      : html`<p class="lsheet__locked">${icons.lock} Clear level ${pad2(level.n - 1)} to unlock — or pass the section test to skip ahead.</p>`}
  </div>`);
  openSheet(body);
}

function testSheet(section, nextTitle) {
  const t = section.test;
  const body = el(html`<div class="lsheet">
    <span class="label">${section.title} · Section test</span>
    <h3 class="lsheet__t display">Section test</h3>
    <p class="lsheet__sub">${nextTitle ? `Score ${SECTION_TEST_PASS}% or more to unlock ${nextTitle}.` : `Score ${SECTION_TEST_PASS}% or more to finish the course.`} No listen-through, tightest timing. You can take it any time to skip ahead.</p>
    <div class="lsheet__row">
      <div><b class="display">${t.best == null ? '—' : `${Math.round(t.best)}%`}</b><span class="label">Best</span></div>
      <div><b class="display">${SECTION_TEST_PASS}%</b><span class="label">To pass</span></div>
      <div><b class="display">±${TIMING_WINDOWS_MS[section.id]}</b><span class="label">ms window</span></div>
    </div>
    ${t.unlocked
      ? html`<a class="btn btn--primary btn--wide" href="#/lesson/${t.id}">${icons.play} Take the test</a>`
      : html`<p class="lsheet__locked">${icons.lock} Unlock this section first.</p>`}
  </div>`);
  openSheet(body);
}

export function render(root, params) {
  const p = getProgress();
  fresh = new Set(p.fresh || []);
  const state = mapState(sections, p);
  const up = nextUp(state);
  const currentId = up.kind === 'level' ? up.level.id : up.kind === 'test' ? up.section.test.id : null;

  const screen = el(html`<main class="screen screen--portrait map">
    <header class="topbar">
      <a class="circle-btn" href="#/" aria-label="Home">${icons.back}</a>
      <span class="label">The setlist</span>
      <span class="circle-btn" aria-hidden="true" style="visibility:hidden"></span>
    </header>
    <div class="map__sections"></div>
  </main>`);
  const host = screen.querySelector('.map__sections');

  state.forEach((s, i) => {
    const { after, hidden } = songStops(s.id, p);
    const songsTotal = songs.filter((x) => x.unlock.level?.startsWith(`${s.id}-`) || x.unlock.stars === s.id).length;
    const songsGot = songs.filter((x) => (x.unlock.level?.startsWith(`${s.id}-`) || x.unlock.stars === s.id) && p.songs[x.id]?.unlocked).length;
    const nextTitle = state[i + 1]?.title;
    const stops = [];
    s.levels.forEach((l) => {
      stops.push(stopHtml('level', l, l.unlocked, l.id === currentId));
      (after[l.id] || []).forEach((song) => stops.push(stopHtml('song', song, l.stars > 0)));
    });
    hidden.forEach((song) => stops.push(stopHtml('song', song, song.unlocked)));
    stops.push(stopHtml('test', { section: s, test: s.test, nextTitle }, s.test.unlocked, s.test.id === currentId));

    const sec = el(html`<section class="msec ${s.unlocked ? '' : 'is-locked'}" id="sec-${s.id}">
      <div class="msec__head">
        <span class="label">Setlist ${pad2(i + 1)} / 04</span>
        <h2 class="msec__title display">${s.title}${newBadge(s.id)}</h2>
        <p class="msec__tag">${s.tagline}</p>
        ${s.unlocked
          ? html`<div class="msec__stats">
              <div><b class="display">${s.cleared}/${s.levels.length}</b><span class="label">Cleared</span></div>
              <div><b class="display">${s.stars}/${s.levels.length * 3}</b><span class="label">Stars</span></div>
              <div><b class="display">${songsGot}/${songsTotal}</b><span class="label">Songs</span></div>
            </div>`
          : html`<p class="msec__lock">${icons.lock} Pass the ${state[i - 1].title} test to open</p>`}
      </div>
      <ol class="line">${stops}</ol>
    </section>`);
    host.append(sec);

    sec.querySelectorAll('[data-level]').forEach((li) => {
      const lvl = s.levels.find((l) => l.id === li.dataset.level);
      li.addEventListener('click', () => levelSheet(s, lvl));
    });
    sec.querySelectorAll('[data-test]').forEach((li) => li.addEventListener('click', () => testSheet(s, nextTitle)));
  });

  root.append(screen, dock('map'));

  // Scroll to the requested section, or to the current stop.
  requestAnimationFrame(() => {
    const target = params.focus
      ? screen.querySelector(`#sec-${params.focus}`) || screen.querySelector(`[data-level="${params.focus}"]`)
      : screen.querySelector('.stop--current, .stop--test.is-current');
    if (target) target.scrollIntoView({ block: params.focus ? 'start' : 'center' });
  });

  // NEW badges are shown once: clear them when leaving the map.
  return () => { if (getProgress().fresh?.length) saveProgress(clearFresh(getProgress())); };
}
