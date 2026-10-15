// Lesson screen (landscape): intro cards → ready → listen demo → count-in → play → results.
import { html, el, raw, pad2 } from '../dom.js';
import { icons, stars } from '../icons.js';
import { createKeyboard, createKeyMap } from '../components/keyboard.js';
import { createScore } from '../components/score.js';
import { sections, getSettings, saveSettings, getProgress, saveProgress } from '../../core/store.js';
import { mapState, recordAttempt, recordTest } from '../../core/progress.js';
import { nameOf, midiOf } from '../../core/music.js';
import { parseLevel, expectedNotes, noteRange, keyboardWindow, measureBeats } from '../../engine/notation.js';
import { createRun } from '../../engine/run.js';
import { loadLevel } from '../../content/levels.js';
import { TIMING_WINDOWS_MS, SECTION_TEST_PASS } from '../../config/scoring.js';
import * as audio from '../../audio/engine.js';
import { go } from '../../router.js';

export const orientation = 'landscape';

function lookup(id) {
  const m = /^([a-z]+)-(\d+|test)$/.exec(id || '');
  const s = m && sections.find((x) => x.id === m[1]);
  if (!s) return null;
  if (m[2] === 'test') return { section: s, isTest: true, n: null, title: 'Section test', label: `${s.title} · Test` };
  const n = Number(m[2]);
  const l = s.levels[n - 1];
  return l ? { section: s, isTest: false, n, title: l.title, sub: l.sub, label: `${s.title} · ${pad2(n)}` } : null;
}

const fmtPct = (x) => `${Math.floor(x)}`;

export function render(root, params) {
  const info = lookup(params.id);
  if (!info) { go('/map'); return; }
  const windowMs = TIMING_WINDOWS_MS[info.section.id];

  const screen = el(html`<main class="screen screen--landscape lesson">
    <header class="hud">
      <a class="circle-btn" href="#/map/${params.id}" aria-label="Back to map">${icons.close}</a>
      <div class="hud__title"><span class="label">${info.label}</span><b class="display">${info.title}</b></div>
      <button class="pill" data-act="listen" disabled>${icons.play} Listen</button>
      <button class="pill" data-act="tempo" disabled>${icons.metronome} <span class="tempo-val">—</span></button>
      <span class="hud__acc display"><span class="acc-val">—</span><small>%</small></span>
      <span class="hud__combo"><b class="display combo-val">×0</b><span>combo</span></span>
    </header>
    <div class="stage">
      <div class="score"></div>
      <div class="playhead" aria-hidden="true"></div>
      <div class="countin display" aria-live="assertive"></div>
      <div class="panel" hidden></div>
    </div>
    <div class="kbarea">
      <div class="kbmap"></div>
      <div class="kbwrap"></div>
    </div>
  </main>`);
  root.append(screen);
  if (import.meta.env.DEV) window.__lesson = { get run() { return run; }, get notes() { return notes; } };

  const $ = (s) => screen.querySelector(s);
  const scoreHost = $('.score');
  const panel = $('.panel');
  const countEl = $('.countin');
  const accEl = $('.acc-val');
  const comboEl = $('.combo-val');
  const comboBox = $('.hud__combo');
  const listenBtn = $('[data-act="listen"]');
  const tempoBtn = $('[data-act="tempo"]');

  let level = null;
  let parsed = null;
  let notes = [];
  let score = null;
  let kb = null;
  let run = null;
  let tempo = 80;
  let practice = false;
  let heardDemo = false;
  let alive = true;
  let state = 'loading';

  // ---------- panels ----------
  const showPanel = (tpl) => {
    panel.replaceChildren(el(tpl));
    panel.hidden = false;
    return panel.firstElementChild;
  };
  const hidePanel = () => { panel.hidden = true; panel.replaceChildren(); panel.classList.remove('panel--corner'); };

  function setHud({ acc = null, combo = 0 } = {}) {
    accEl.textContent = acc == null ? '—' : fmtPct(acc);
    comboEl.textContent = `×${combo}`;
    comboBox.classList.toggle('is-hot', combo >= 10);
  }
  const updateTempoBtn = () => {
    tempoBtn.querySelector('.tempo-val').textContent = `${tempo} BPM`;
    tempoBtn.classList.toggle('pill--on', !!getSettings().metronome);
  };

  // ---------- keyboard ----------
  function buildKeyboard(range) {
    const win = keyboardWindow(range);
    kb = createKeyboard({
      low: win.low,
      keys: win.keys,
      onPress: async (midi, ts) => {
        if (!audio.running()) { try { await audio.unlock(); } catch { /* ignore */ } }
        audio.playNote(midi, 0.8);
        if (run && run.mode === 'play') run.input(midi, ts);
        else showFreeNote(midi);
      },
    });
    $('.kbwrap').replaceChildren(kb.el);
    $('.kbmap').replaceChildren(createKeyMap({ low: win.low, keys: win.keys }));
  }
  function showFreeNote(midi) {
    const t = panel.querySelector('.free-note');
    if (t) t.textContent = nameOf(midi);
  }
  function markNext(list) {
    const st = {};
    const fg = {};
    list.forEach((n) => { st[n.midi] = 'next'; if (n.finger) fg[n.midi] = n.finger; });
    kb.setMarks(st, fg);
  }

  // ---------- score ----------
  async function buildScore() {
    scoreHost.replaceChildren();
    score = await createScore(scoreHost, { level, parsed, fingers: level.showFingers !== false });
    score.setBeat(-0.5);
  }

  // ---------- flow ----------
  function ready(note = '') {
    state = 'ready';
    run = null;
    countEl.textContent = '';
    countEl.classList.remove('is-on');
    score?.setBeat(-0.5);
    markNext(notes.filter((n) => n.beat === notes[0].beat));
    listenBtn.disabled = false;
    tempoBtn.disabled = false;
    updateTempoBtn();
    const rec = info.isTest ? getProgress().tests[info.section.id] : getProgress().levels[params.id];
    const loaded = audio.isLoaded();
    hidePanel();
    const p = showPanel(html`<div class="card ready">
      <span class="label">${practice ? 'Practice · not scored for stars' : info.isTest ? `Pass with ${SECTION_TEST_PASS}%` : `Timing window ±${windowMs} ms`}</span>
      <h2 class="display">${info.title}</h2>
      ${note ? html`<p class="ready__note">${note}</p>` : ''}
      ${practice ? html`<div class="tempo-row">
          <span class="label">Tempo</span>
          <input type="range" min="${level.tempo.min}" max="${level.tempo.max}" step="2" value="${tempo}" aria-label="Tempo">
          <b class="display tempo-out">${tempo}</b>
        </div>
        <div class="metro-row"><span class="label">Metronome while playing</span><button class="switch ${getSettings().metronome ? 'is-on' : ''}" data-act="metro" role="switch" aria-checked="${!!getSettings().metronome}"><i></i></button></div>` : ''}
      <div class="ready__btns">
        <button class="btn btn--primary" data-act="go" ${loaded ? '' : 'disabled'}>${icons.play} ${loaded ? (practice ? 'Start practice' : info.isTest ? 'Start test' : 'Play') : 'Loading piano…'}</button>
        ${info.isTest ? '' : html`<button class="btn btn--ghost" data-act="mode">${practice ? 'Scored play' : 'Practice'}</button>`}
      </div>
      ${rec?.best != null ? html`<p class="ready__best">Best ${fmtPct(rec.best)}% ${info.isTest ? '' : stars(rec.stars)}</p>` : ''}
    </div>`);
    p.querySelector('[data-act="go"]').addEventListener('click', onGo);
    p.querySelector('[data-act="mode"]')?.addEventListener('click', () => {
      practice = !practice;
      if (!practice) tempo = level.tempo.default;
      ready();
    });
    const range = p.querySelector('input[type="range"]');
    range?.addEventListener('input', () => {
      tempo = Number(range.value);
      p.querySelector('.tempo-out').textContent = tempo;
      updateTempoBtn();
    });
    p.querySelector('[data-act="metro"]')?.addEventListener('click', (e) => {
      const on = !getSettings().metronome;
      saveSettings({ metronome: on });
      e.currentTarget.classList.toggle('is-on', on);
      e.currentTarget.setAttribute('aria-checked', on);
      updateTempoBtn();
    });
    if (!loaded) audio.load().then(() => { if (alive && state === 'ready') ready(note); });
  }

  async function onGo() {
    try { await audio.unlock(); } catch { /* handled below */ }
    if (!audio.running()) { ready('Tap again to turn on sound.'); return; }
    // The first scored attempt of a visit starts with the Listen demo (skippable).
    if (!heardDemo && !practice && !info.isTest) startListen(true);
    else startPlay();
  }

  function startListen(thenPlay = false) {
    stopRun();
    state = 'running';
    heardDemo = true;
    listenBtn.disabled = true;
    tempoBtn.disabled = true;
    hidePanel();
    showPanel(html`<div class="card card--mini"><span class="label">Listening</span><button class="btn btn--ghost" data-act="skip">${thenPlay ? 'Skip to play' : 'Stop'}</button></div>`)
      .querySelector('[data-act="skip"]').addEventListener('click', () => { stopRun(); if (thenPlay) startPlay(); else ready(); });
    panel.classList.add('panel--corner');
    let lastKey = '';
    run = createRun({
      notes, totalBeats: parsed.totalBeats, tempo, beatsPerBar: measureBeats(level.time || '4/4'), mode: 'listen', windowMs,
      onFrame: (beat) => {
        score.setBeat(beat);
        const sounding = notes.filter((n) => beat >= n.beat && beat < n.beat + n.beats);
        const key = sounding.map((n) => n.id).join();
        if (key !== lastKey) { lastKey = key; markNext(sounding); }
      },
      onEnd: ({ completed }) => {
        if (!alive || !completed) return;
        if (thenPlay) setTimeout(() => { if (alive && state === 'running') startPlay(); }, 400);
        else ready();
      },
    });
    run.start();
  }

  function startPlay() {
    stopRun();
    hidePanel();
    state = 'running';
    listenBtn.disabled = true;
    tempoBtn.disabled = true;
    score.clearMarks();
    setHud({ acc: null, combo: 0 });
    let judged = 0;
    let hits = 0;
    let nextIds = '';
    const refreshNext = (scorer) => {
      const up = scorer.upcoming();
      const ids = up.map((n) => n.id).join();
      if (ids === nextIds) return;
      nextIds = ids;
      markNext(up.map((n) => notes[n.id]));
      up.forEach((n) => score.mark(notes[n.id], 'next'));
    };
    run = createRun({
      notes, totalBeats: parsed.totalBeats, tempo, beatsPerBar: measureBeats(level.time || '4/4'), mode: 'play', windowMs,
      metronome: !!getSettings().metronome, latencyMs: getSettings().tapLatencyMs || 0,
      onFrame: (beat, scorer) => {
        score.setBeat(beat);
        const counting = beat < 0;
        countEl.textContent = counting ? String(Math.ceil(-beat)) : '';
        countEl.classList.toggle('is-on', counting);
        refreshNext(scorer);
      },
      onJudge: (res, scorer) => {
        if (res.type === 'hit') {
          hits++;
          judged++;
          score.mark(notes[res.note.id], 'hit');
          kb.flash(res.note.midi, 'hit');
        } else {
          kb.flash(res.midi, 'miss');
        }
        setHud({ acc: judged ? (hits / judged) * 100 : null, combo: scorer.combo });
        refreshNext(scorer);
      },
      onMiss: (n, scorer) => {
        judged++;
        score.mark(notes[n.id], 'miss');
        setHud({ acc: (hits / judged) * 100, combo: scorer ? scorer.combo : 0 });
      },
      onEnd: ({ completed, summary }) => {
        countEl.textContent = '';
        countEl.classList.remove('is-on');
        if (alive && completed) results(summary);
      },
    });
    run.start();
  }

  function stopRun() {
    if (run && !run.finished) run.stop();
    run = null;
  }

  function nextLevelId() {
    if (info.isTest) return null;
    const sec = mapState(sections, getProgress()).find((s) => s.id === info.section.id);
    const nx = sec.levels[info.n];
    if (nx?.unlocked) return nx.id;
    if (!nx && sec.test.unlocked && !sec.test.passed) return sec.test.id;
    return null;
  }

  async function results(sum) {
    state = 'results';
    kb.setMarks({});
    listenBtn.disabled = false;
    tempoBtn.disabled = false;
    let rec = null;
    if (!practice) {
      const r = info.isTest
        ? recordTest(getProgress(), info.section.id, sum.accuracy)
        : recordAttempt(getProgress(), params.id, sum.accuracy);
      await saveProgress(r.progress);
      rec = r;
    }
    const next = !practice ? nextLevelId() : null;
    const missedNames = [...new Set(sum.missed.map((n) => nameOf(n.midi)))];
    const headline = practice ? 'Practice run · not saved'
      : info.isTest ? (rec.passed ? 'Test passed' : `Need ${SECTION_TEST_PASS}% to pass`)
        : sum.stars ? (rec.firstClear ? 'Level cleared' : rec.newBest ? 'New best' : 'Cleared') : 'Not quite · 70% clears it';
    const p = showPanel(html`<div class="results">
      <div class="results__score">
        <span class="label">${headline}</span>
        <div class="results__big display">${fmtPct(sum.accuracy)}<small>%</small></div>
        ${info.isTest ? '' : html`<div class="results__stars">${stars(sum.stars)}</div>`}
      </div>
      <div class="results__panel">
        <div class="tile"><b class="display">${sum.maxCombo}</b><span class="label">Max combo</span></div>
        <div class="tile"><b class="display">${sum.hits}/${sum.total}</b><span class="label">Notes hit</span></div>
        <div class="tile tile--wide"><b class="display missed">${missedNames.length ? missedNames.slice(0, 5).join(' · ') : 'None'}</b><span class="label">Missed notes</span></div>
        <div class="timing">
          <div class="tbar">
            <i style="flex:${sum.early}" class="t-early"></i><i style="flex:${sum.ontime}" class="t-on"></i><i style="flex:${sum.late}" class="t-late"></i><i style="flex:${sum.missed.length}" class="t-miss"></i>
            ${sum.total ? '' : raw('<i style="flex:1"></i>')}
          </div>
          <div class="tlegend"><span><b>${sum.early}</b> early</span><span><b>${sum.ontime}</b> on time</span><span><b>${sum.late}</b> late</span><span><b>${sum.missed.length}</b> missed</span></div>
        </div>
        <div class="results__btns">
          <button class="btn" data-act="retry">Retry</button>
          <button class="btn" data-act="practice">${practice ? 'Practice again' : 'Practice'}</button>
          ${next ? html`<a class="btn btn--primary" href="#/lesson/${next}">Next →</a>` : html`<a class="btn btn--primary" href="#/map/${params.id}">Map</a>`}
        </div>
      </div>
    </div>`);
    p.querySelector('[data-act="retry"]').addEventListener('click', () => startPlay());
    p.querySelector('[data-act="practice"]').addEventListener('click', () => { practice = true; ready(); });
  }

  function intro(cards, i = 0) {
    state = 'intro';
    const c = cards[i];
    const last = i === cards.length - 1;
    const p = showPanel(html`<div class="card intro">
      <span class="label">${info.label} · ${i + 1}/${cards.length}</span>
      <div class="intro__head">
        ${c.kind === 'note' ? html`<div class="intro__note"><b class="display">${c.note.replace(/-?\d/, '')}<small>${c.note.match(/-?\d/)[0]}</small></b>${c.finger ? html`<span>finger ${c.finger}</span>` : ''}</div>` : ''}
        <h2 class="display">${c.title || info.title}</h2>
      </div>
      <p>${c.text}</p>
      <div class="ready__btns">
        <button class="btn btn--primary" data-act="next">${last ? 'Got it' : 'Next'}</button>
        ${i > 0 ? html`<button class="btn btn--ghost" data-act="prev">Back</button>` : ''}
      </div>
    </div>`);
    // Light the relevant keys on the keyboard.
    if (c.kind === 'note') kb.setMarks({ [midiOf(c.note)]: 'next' }, c.finger ? { [midiOf(c.note)]: c.finger } : {});
    else if (c.kind === 'keys') kb.setMarks(Object.fromEntries((c.highlight || []).map((n) => [midiOf(n), 'next'])));
    else kb.setMarks({});
    p.querySelector('[data-act="next"]').addEventListener('click', () => {
      if (last) {
        const seen = new Set(getSettings().introsSeen || []);
        seen.add(params.id);
        saveSettings({ introsSeen: [...seen] });
        ready();
      } else intro(cards, i + 1);
    });
    p.querySelector('[data-act="prev"]')?.addEventListener('click', () => intro(cards, i - 1));
  }

  // ---------- HUD buttons ----------
  listenBtn.addEventListener('click', async () => {
    if (state === 'running' || !level) return;
    try { await audio.unlock(); } catch { /* ignore */ }
    if (audio.running()) startListen(false);
  });
  tempoBtn.addEventListener('click', () => {
    if (state === 'running' || !level || info.isTest) return;
    practice = true;
    ready();
  });

  // ---------- boot ----------
  (async () => {
    showPanel(html`<div class="card card--mini"><span class="label">Loading…</span></div>`);
    audio.load();
    level = await loadLevel(params.id);
    if (!alive) return;
    if (!level) {
      buildKeyboard({ lo: 48, hi: 83 });
      showPanel(html`<div class="card ready">
        <span class="label">${info.label}</span>
        <h2 class="display">${info.title}</h2>
        <p class="ready__note">This ${info.isTest ? 'test' : 'level'}'s music arrives with the full curriculum (Phase 5). Until then, play freely on the keyboard.</p>
        <b class="display free-note"></b>
        <div class="ready__btns"><a class="btn btn--ghost" href="#/map/${params.id}">Back to map</a></div>
      </div>`);
      return;
    }
    parsed = parseLevel(level);
    notes = expectedNotes(parsed);
    tempo = level.tempo.default;
    buildKeyboard(noteRange(notes));
    await buildScore();
    if (!alive) return;
    const seen = new Set(getSettings().introsSeen || []);
    if (level.intro?.length && !seen.has(params.id)) intro(level.intro);
    else ready();
  })();

  // Pause if the app is backgrounded mid-run.
  const onHide = () => {
    if (document.hidden && state === 'running') { stopRun(); ready('Paused: the app went to the background.'); }
  };
  document.addEventListener('visibilitychange', onHide);

  // Re-engrave when the screen size changes (rotation).
  let rt = 0;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(async () => {
      if (!level || !alive) return;
      const wasRunning = state === 'running';
      if (wasRunning) stopRun();
      await buildScore();
      if (wasRunning) ready('Stopped because the screen rotated.');
    }, 200);
  };
  window.addEventListener('resize', onResize);

  return () => {
    alive = false;
    stopRun();
    clearTimeout(rt);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('resize', onResize);
  };
}
