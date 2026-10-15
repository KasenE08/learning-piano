// Lesson screen (landscape): intro cards → ready → listen demo → count-in → play → results.
import { html, el, raw, pad2 } from '../dom.js';
import { icons, stars } from '../icons.js';
import { createKeyboard, createKeyMap } from '../components/keyboard.js';
import { createScore, renderNoteCard, staffLayout } from '../components/score.js';
import { createDrill, drillPrompts } from '../../engine/drill.js';
import { sections, songs, getSettings, saveSettings, getProgress, saveProgress, getCalibration } from '../../core/store.js';
import { mapState, recordAttempt, recordTest, recordSong, attemptXp, addXp, evaluateUnlocks, comboMultiplier, rankFor } from '../../core/progress.js';
import { nameOf, midiOf } from '../../core/music.js';
import { parseLevel, expectedNotes, noteRange, keyboardWindow, measureBeats, pulseBeats, micScoring, hasChords, onsetGroups } from '../../engine/notation.js';
import { generatePassage } from '../../engine/generate.js';
import { createRun } from '../../engine/run.js';
import { liveAccuracy } from '../../engine/scorer.js';
import { loadLevel } from '../../content/levels.js';
import { TIMING_WINDOWS_MS, SECTION_TEST_PASS } from '../../config/scoring.js';
import * as audio from '../../audio/engine.js';
import * as mic from '../../audio/mic.js';
import { sfx } from '../../audio/sfx.js';
import { go } from '../../router.js';

export const orientation = 'landscape';

function lookup(id) {
  const sg = /^song-([\w-]+)$/.exec(id || '');
  if (sg) {
    const song = songs.find((x) => x.id === sg[1]);
    if (!song) return null;
    const section = sections.find((x) => x.id === song.section);
    return { section, isSong: true, songId: song.id, isTest: false, n: null, title: song.title, sub: song.by, label: `Song · ${song.by}` };
  }
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
      <div class="hud__title"><span class="label">${info.label} <span class="hud__in" hidden><i></i>Mic</span></span><b class="display">${info.title}</b></div>
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
  if (import.meta.env.DEV) window.__lesson = { get run() { return run; }, get notes() { return notes; }, get drill() { return drill; }, get score() { return score; } };

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
  // Practice options: a bar range, looping, and one hand at a time.
  const pr = { from: 1, to: 1, loop: false, hand: 'both' };
  let heardDemo = false;
  let alive = true;
  let state = 'loading';
  const micMode = () => getSettings().inputMode === 'mic';
  // Mic notes reach us ~100 ms after they're played; wait that long before calling a miss.
  const MIC_JUDGE_DELAY_MS = 160;
  const hudIn = $('.hud__in');
  let micOff = [];
  const micState = (st) => { hudIn.hidden = st !== 'on'; };
  micOff.push(mic.onState(micState));
  micOff.push(mic.onFrame((f) => { hudIn.style.setProperty('--lvl', Math.max(0, Math.min(1, (f.bandDb + 75) / 60)).toFixed(2)); }));

  // ---------- panels ----------
  const showPanel = (tpl) => {
    panel.replaceChildren(el(tpl));
    panel.hidden = false;
    return panel.firstElementChild;
  };
  const hidePanel = () => { panel.hidden = true; panel.replaceChildren(); panel.classList.remove('panel--corner'); };

  let lastTier = 1;
  function setHud({ acc = null, combo = 0, bump = false } = {}) {
    accEl.textContent = acc == null ? '—' : fmtPct(acc);
    comboEl.textContent = `×${combo}`;
    const tier = comboMultiplier(combo);
    comboBox.dataset.tier = tier;
    comboBox.querySelector('span').textContent = tier > 1 ? `${tier}× XP` : 'combo';
    if (bump) { comboBox.classList.remove('bump'); void comboBox.offsetWidth; comboBox.classList.add('bump'); }
    if (tier > lastTier && state === 'running') tierUp(tier);
    lastTier = tier;
  }
  const playheadEl = $('.playhead');
  function playheadFlash() {
    playheadEl.classList.remove('is-hit');
    void playheadEl.offsetWidth;
    playheadEl.classList.add('is-hit');
  }
  // Escalating feedback when the combo reaches a new multiplier.
  function tierUp(tier) {
    const t = el(html`<div class="tierup tierup--${tier} display"><b>${tier}× XP</b><span>Combo ${[0, 0, 10, 25, 50][tier]}</span></div>`);
    screen.querySelector('.stage').append(t);
    setTimeout(() => t.remove(), 1300);
    sfx.comboTier(tier - 1);
  }
  const updateTempoBtn = () => {
    tempoBtn.querySelector('.tempo-val').textContent = `${tempo} BPM`;
    tempoBtn.title = pulse() === 1.5 ? 'Beats per minute, one beat = a dotted quarter' : '';
    tempoBtn.classList.toggle('pill--on', !!getSettings().metronome);
  };

  // ---------- keyboard ----------
  function buildKeyboard(range) {
    const win = keyboardWindow(range);
    kb = createKeyboard({
      low: win.low,
      keys: win.keys,
      onPress: async (midi, ts) => {
        // While the mic is scoring, taps are off (the phone's own sound would be heard as notes).
        if (micMode() && state === 'running') return;
        if (!audio.running()) { try { await audio.unlock(); } catch { /* ignore */ } }
        audio.playNote(midi, 0.8);
        if (run && run.mode === 'play') run.input(midi, ts);
        else if (drillAnswer) drillAnswer(midi);
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

  // ---------- timing helpers ----------
  const time = () => level.time || '4/4';
  // Clicks per beat unit: 1.5 quarter notes in 6/8 (tempo is in those beats).
  const pulse = () => pulseBeats(time());
  const quarterTempo = () => tempo * pulse();
  const barsOf = () => (parsed.display || parsed.parts)[Object.keys(parsed.parts)[0]];
  const hasBothHands = () => !!(level.parts?.rh && level.parts?.lh);

  /** The notes and length to play now: the whole piece, or the practice bars/hand. */
  function playSet({ forListen = false } = {}) {
    let list = notes;
    let total = parsed.totalBeats;
    let offset = 0;
    if (practice) {
      const bars = barsOf();
      if (!(pr.from === 1 && pr.to === bars.length)) {
        offset = bars[pr.from - 1].start;
        const end = bars[pr.to - 1].start + bars[pr.to - 1].beats;
        list = notes.filter((n) => !n.event.orig && n.beat >= offset - 1e-6 && n.beat < end - 1e-6).map((n) => ({ ...n, beat: n.beat - offset }));
        total = end - offset;
      }
      if (!forListen && pr.hand !== 'both') list = list.filter((n) => n.part === pr.hand);
    }
    return { list, total, offset };
  }

  /** In mic mode, a note an octave (12th, two octaves) above another chord tone can't be told apart: not scored. */
  function micSplit(list) {
    const { scored, ghosts } = micScoring(list);
    return { scored, ghosts, partial: ghosts.length > 0 };
  }
  // Advanced: a chord counts only if every note in it is played.
  const chordRule = () => (info.section.id === 'advanced' ? 'all' : 'each');
  const micNote = () => {
    if (!micMode() || !notes.length || !hasChords(notes)) return '';
    const hidden = micScoring(notes).ghosts.length;
    return `Keyboard mode hears chords and both hands.${hidden ? ' A note an octave above another one in the same chord can’t be told apart, so it isn’t scored.' : ''}${chordRule() === 'all' ? ' Advanced: a chord counts only if every note is right.' : ''}`;
  };

  // ---------- flow ----------
  function ready(note = '') {
    if (isDrill()) return drillReady(note);
    state = 'ready';
    run = null;
    countEl.textContent = '';
    countEl.classList.remove('is-on');
    score?.setBeat((practice ? barsOf()[pr.from - 1].start : 0) - 0.5);
    const first = playSet().list;
    markNext(first.filter((n) => n.beat === first[0]?.beat));
    listenBtn.disabled = false;
    tempoBtn.disabled = false;
    updateTempoBtn();
    const rec = info.isTest ? getProgress().tests[info.section.id] : info.isSong ? getProgress().songs[info.songId] : getProgress().levels[params.id];
    const loaded = audio.isLoaded();
    hidePanel();
    const nBars = practice ? barsOf().length : 0;
    const mn = micNote();
    const p = showPanel(html`<div class="card ready ${practice ? 'ready--practice' : ''}">
      <span class="label">${practice ? 'Practice · not scored for stars' : info.isTest ? `Pass with ${SECTION_TEST_PASS}%` : `Timing window ±${windowMs} ms`}</span>
      ${practice ? '' : html`<h2 class="display">${info.title}</h2>`}
      ${level.generate ? html`<p class="ready__gen">Passage ${String(level.seed % 10000).padStart(4, '0')} · ${level.key.replace('b', '♭')} major · ${time()} <button class="link" data-act="newpassage">New passage</button></p>` : ''}
      ${note ? html`<p class="ready__note">${note}</p>` : ''}
      ${mn && !note ? html`<p class="ready__mic">${mn}</p>` : ''}
      <div class="ready__foot">
        <div class="seg" role="radiogroup" aria-label="Input">
          <button class="seg__b ${micMode() ? 'is-on' : ''}" data-input="mic" role="radio" aria-checked="${micMode()}">${icons.mic} Keyboard</button>
          <button class="seg__b ${micMode() ? '' : 'is-on'}" data-input="tap" role="radio" aria-checked="${!micMode()}">Taps</button>
        </div>
        <div class="ready__btns">
          <button class="btn btn--primary" data-act="go" ${loaded ? '' : 'disabled'}>${icons.play} ${loaded ? (practice ? 'Start' : info.isTest ? 'Start test' : 'Play') : 'Loading piano…'}</button>
          ${info.isTest ? '' : html`<button class="btn btn--ghost" data-act="mode">${practice ? 'Scored play' : 'Practice'}</button>`}
        </div>
      </div>
      ${micMode() && !getCalibration() ? html`<p class="ready__note">First, a 1-minute mic calibration. <a class="link" href="#/calibrate/lesson/${params.id}">Calibrate now →</a></p>` : ''}
      ${practice ? html`<div class="prac">
        <div class="tempo-row">
          <span class="label">Tempo</span>
          <input type="range" min="${level.tempo.min}" max="${level.tempo.max}" step="2" value="${tempo}" aria-label="Tempo">
          <b class="display tempo-out">${tempo}</b>
        </div>
        <div class="bars-row">
          <span class="label">Bars</span>
          <span class="stepper"><button data-bar="from" data-d="-1" aria-label="Start one bar earlier">−</button><b class="display" data-out="from">${pr.from}</b><button data-bar="from" data-d="1" aria-label="Start one bar later">+</button></span>
          <span class="label">to</span>
          <span class="stepper"><button data-bar="to" data-d="-1" aria-label="End one bar earlier">−</button><b class="display" data-out="to">${pr.to}</b><button data-bar="to" data-d="1" aria-label="End one bar later">+</button></span>
          <small class="label">of ${nBars}</small>
        </div>
        <div class="toggles">
          <span class="tog"><span class="label">Click</span><button class="switch ${getSettings().metronome ? 'is-on' : ''}" data-act="metro" role="switch" aria-label="Metronome" aria-checked="${!!getSettings().metronome}"><i></i></button></span>
          <span class="tog"><span class="label">Loop</span><button class="switch ${pr.loop ? 'is-on' : ''}" data-act="loop" role="switch" aria-label="Loop the bars" aria-checked="${pr.loop}"><i></i></button></span>
        </div>
        ${hasBothHands() ? html`<div class="hands-row"><span class="label">Hands</span><div class="seg seg--sm" role="radiogroup" aria-label="Hands">
          ${[['both', 'Both'], ['rh', 'Right'], ['lh', 'Left']].map(([v, t]) => html`<button class="seg__b ${pr.hand === v ? 'is-on' : ''}" data-hand="${v}" role="radio" aria-checked="${pr.hand === v}">${t}</button>`)}
        </div></div>` : ''}
      </div>` : ''}
      ${rec?.best != null ? html`<p class="ready__best">Best ${fmtPct(rec.best)}% ${info.isTest ? '' : stars(rec.stars)}</p>` : ''}
    </div>`);
    p.querySelector('[data-act="go"]').addEventListener('click', onGo);
    p.querySelectorAll('[data-input]').forEach((b) => b.addEventListener('click', async () => {
      await saveSettings({ inputMode: b.dataset.input });
      if (b.dataset.input === 'tap') mic.stop();
      ready(note);
    }));
    p.querySelector('[data-act="mode"]')?.addEventListener('click', () => {
      practice = !practice;
      if (!practice) tempo = level.tempo.default;
      score.setBeat(-0.5);
      ready();
    });
    const range = p.querySelector('input[type="range"]');
    range?.addEventListener('input', () => {
      tempo = Number(range.value);
      p.querySelector('.tempo-out').textContent = tempo;
      updateTempoBtn();
    });
    p.querySelectorAll('[data-bar]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.bar;
      pr[k] = Math.max(1, Math.min(nBars, pr[k] + Number(b.dataset.d)));
      if (pr.from > pr.to) { if (k === 'from') pr.to = pr.from; else pr.from = pr.to; }
      p.querySelector('[data-out="from"]').textContent = pr.from;
      p.querySelector('[data-out="to"]').textContent = pr.to;
      const first = playSet().list;
      markNext(first.filter((n) => n.beat === first[0]?.beat));
      score.setBeat(barsOf()[pr.from - 1].start - 0.5);
    }));
    p.querySelector('[data-act="loop"]')?.addEventListener('click', (e) => {
      pr.loop = !pr.loop;
      e.currentTarget.classList.toggle('is-on', pr.loop);
      e.currentTarget.setAttribute('aria-checked', pr.loop);
    });
    p.querySelectorAll('[data-hand]').forEach((b) => b.addEventListener('click', () => { pr.hand = b.dataset.hand; ready(note); }));
    p.querySelector('[data-act="newpassage"]')?.addEventListener('click', () => newPassage());
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
    if (micMode()) {
      if (!getCalibration()) { location.hash = `#/calibrate/lesson/${params.id}`; return; }
      const st = await mic.start();
      if (st !== 'on') {
        ready(st === 'denied'
          ? 'Microphone blocked. Allow it in Settings → Safari → Microphone, or switch to Taps.'
          : 'The microphone could not start. Try again, or switch to Taps.');
        return;
      }
      const cal = getCalibration();
      mic.configure({ noiseDb: cal.noiseDb, low: cal.low, high: cal.high });
    }
    if (isDrill()) return startDrill();
    // The first scored attempt of a visit starts with the Listen demo (skippable),
    // except in tests and sight-reading levels.
    if (!heardDemo && !practice && !info.isTest && !level.noListen) startListen(true);
    else startPlay();
  }

  function startListen(thenPlay = false) {
    stopRun();
    mic.setDetecting(false);
    state = 'running';
    heardDemo = true;
    listenBtn.disabled = true;
    tempoBtn.disabled = true;
    hidePanel();
    showPanel(html`<div class="card card--mini"><span class="label">Listening</span><button class="btn btn--ghost" data-act="skip">${thenPlay ? 'Skip to play' : 'Stop'}</button></div>`)
      .querySelector('[data-act="skip"]').addEventListener('click', () => { stopRun(); if (thenPlay) startPlay(); else ready(); });
    panel.classList.add('panel--corner');
    let lastKey = '';
    const { list, total, offset } = playSet({ forListen: true });
    run = createRun({
      notes: list, totalBeats: total, tempo: quarterTempo(), beatsPerBar: measureBeats(time()), pulse: pulse(), mode: 'listen', windowMs,
      onFrame: (beat) => {
        score.setBeat(beat + offset);
        const sounding = list.filter((n) => beat >= n.beat && beat < n.beat + n.beats);
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
    if (!(practice && pr.loop)) loopAcc = null;
    state = 'running';
    listenBtn.disabled = true;
    tempoBtn.disabled = true;
    score.clearMarks();
    lastTier = 1;
    setHud({ acc: null, combo: 0 });
    let nextIds = '';
    const useMic = micMode() && mic.getState() === 'on';
    const { list, total, offset } = playSet();
    const split = useMic ? micSplit(list) : { scored: list, ghosts: [], partial: false };
    const verify = useMic && (hasChords(list) || hasBothHands());
    const byId = new Map(list.map((n) => [n.id, n]));
    const refreshNext = (scorer) => {
      const up = scorer.upcoming();
      const ids = up.map((n) => n.id).join();
      if (ids === nextIds) return;
      nextIds = ids;
      // Show every key that starts with the next scored note (both hands), even if only the melody is scored.
      const at = up.length ? byId.get(up[0].id).beat : null;
      markNext(at == null ? [] : list.filter((n) => Math.abs(n.beat - at) < 1e-6));
      up.forEach((n) => score.mark(notes[n.id], 'next'));
    };
    const looping = practice && pr.loop;
    if (looping) {
      showPanel(html`<div class="card card--mini loopcard"><span class="label">Looping bars ${pr.from}–${pr.to}${loopAcc == null ? '' : ` · last ${fmtPct(loopAcc)}%`}</span><button class="btn btn--ghost" data-act="stoploop">Stop</button></div>`)
        .querySelector('[data-act="stoploop"]').addEventListener('click', () => { loopAcc = null; stopRun(); ready(); });
      panel.classList.add('panel--corner');
    }
    run = createRun({
      notes: split.scored, ghosts: split.ghosts, chordRule: chordRule(), totalBeats: total, tempo: quarterTempo(), beatsPerBar: measureBeats(time()), pulse: pulse(), mode: 'play', windowMs,
      metronome: !!getSettings().metronome,
      latencyMs: useMic ? (getCalibration()?.micLatencyMs ?? 80) : getSettings().tapLatencyMs || 0,
      // Score-following checks run ATTACK_MS after a note's window closes, so misses wait a bit longer.
      judgeDelayMs: useMic ? (verify ? mic.ATTACK_MS + 90 : MIC_JUDGE_DELAY_MS) : 0,
      onFrame: (beat, scorer) => {
        score.setBeat(beat + offset);
        const counting = beat < 0;
        countEl.textContent = counting ? String(Math.ceil(-beat / pulse() - 1e-6)) : '';
        countEl.classList.toggle('is-on', counting);
        refreshNext(scorer);
      },
      onJudge: (res, scorer) => {
        if (res.type === 'hit') {
          score.mark(notes[res.note.id], 'hit');
          kb.flash(res.note.midi, 'hit');
          playheadFlash();
        } else if (res.type === 'extra') {
          kb.flash(res.midi, 'miss');
        }
        setHud({ acc: liveAccuracy(scorer.notes, chordRule()), combo: scorer.combo, bump: res.type === 'hit' });
        refreshNext(scorer);
      },
      onMiss: (n, scorer) => {
        score.mark(notes[n.id], 'miss');
        const sc = scorer || run?.scorer;
        setHud({ acc: sc ? liveAccuracy(sc.notes, chordRule()) : null, combo: sc ? sc.combo : 0 });
      },
      onEnd: ({ completed, summary }) => {
        stopMicNotes();
        countEl.textContent = '';
        countEl.classList.remove('is-on');
        if (!alive || !completed) return;
        if (looping) {
          loopAcc = summary.accuracy;
          setTimeout(() => { if (alive && state === 'running' && run?.finished) startPlay(); }, 300);
          return;
        }
        loopAcc = null;
        results({ ...summary, notScored: split.partial ? { hidden: split.ghosts.length, all: list.length } : null });
      },
    });
    run.start();
    if (useMic) {
      const thisRun = run;
      const latency = getCalibration()?.micLatencyMs ?? 80;
      mic.setDetecting(true);
      if (!verify) {
        micNotesOff = mic.onNote((e) => { if (run === thisRun) run.input(e.midi, e.perf); });
      } else {
        // Both hands sound together, so the one-pitch detector often names the
        // left hand (or the hands' shared root). Follow the score instead: as each
        // scored note's window closes, check the audio for that note starting near
        // its time. Detector notes still count right away when they match, and as
        // wrong notes only if nothing in the music explains them.
        const sounding = (t) => list.some((n) => {
          const a = n.beat * run.msPerBeat;
          return t >= a - windowMs && t <= a + n.beats * run.msPerBeat + windowMs;
        });
        const offNote = mic.onOnset((e) => {
          if (run !== thisRun || run.finished || e.dropped) return;
          const t = e.perf - run.perfBeat0 - latency;
          const due = run.scorer.notes.some((n) => !n.result && n.midi === e.midi && Math.abs(n.time - t) <= windowMs);
          if (due) run.input(e.midi, e.perf);
          else if (e.how === 'attack' && !list.some((n) => n.midi === e.midi && sounding(t))) run.input(e.midi, e.perf);
        });
        // One check per onset: a single note, or a chord (both hands count).
        const scoredIds = new Set(split.scored.map((n) => n.id));
        const timers = onsetGroups(list).filter((g) => g.notes.some((n) => scoredIds.has(n.id))).map((g) => setTimeout(() => {
          if (run !== thisRun || run.finished) return;
          const pending = g.notes.filter((n) => scoredIds.has(n.id) && !run.scorer.notes.find((x) => x.id === n.id)?.result);
          if (!pending.length) return;
          const t = run.perfBeat0 + g.beat * run.msPerBeat + latency;
          if (g.notes.length === 1) {
            const at = mic.noteStartedNear(g.notes[0].midi, t, windowMs);
            if (at != null) run.input(g.notes[0].midi, at);
            return;
          }
          // The model gets every note of the chord (hidden ones too, to explain their sound).
          const { at, heard } = mic.chordStartedNear(g.notes.map((n) => n.midi), t, windowMs);
          pending.forEach((n) => { if (heard.has(n.midi)) run.input(n.midi, at); });
        }, Math.max(0, run.perfBeat0 + g.beat * run.msPerBeat + latency + windowMs + mic.ATTACK_MS + 10 - performance.now())));
        micNotesOff = () => { offNote(); timers.forEach(clearTimeout); };
      }
    }
  }

  let micNotesOff = null;
  let loopAcc = null;
  function stopMicNotes() {
    micNotesOff?.();
    micNotesOff = null;
    mic.setDetecting(false);
  }

  function stopRun() {
    stopMicNotes();
    drill = null;
    drillAnswer = null;
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

    // ---- record, XP, unlocks ----
    const before = getProgress();
    let rec = null;
    if (!practice) {
      rec = info.isTest ? recordTest(before, info.section.id, sum.accuracy)
        : info.isSong ? recordSong(before, info.songId, sum.accuracy)
          : recordAttempt(before, params.id, sum.accuracy);
    }
    const xp = attemptXp({ hitXp: sum.hitXp, practice, newStars: rec?.newStars || 0, firstClear: !!rec?.firstClear, firstPass: !!rec?.firstPass, song: !!info.isSong });
    const { progress: unlockedP, unlocks } = evaluateUnlocks(before, rec ? rec.progress : before, sections, songs);
    const gained = addXp(unlockedP, xp.total);
    await saveProgress(gained.progress);

    const next = info.isSong ? null : !practice ? nextLevelId() : null;
    const missedNames = [...new Set(sum.missed.map((n) => nameOf(n.midi)))];
    const headline = practice ? 'Practice run · stars not saved'
      : info.isTest ? (rec.passed ? 'Test passed' : `Need ${SECTION_TEST_PASS}% to pass`)
        : sum.stars ? (rec.firstClear ? (info.isSong ? 'Song cleared' : 'Level cleared') : rec.newBest ? 'New best' : 'Cleared') : 'Not quite · 70% clears it';
    const { before: lv0, after: lv1 } = gained;
    const fill0 = lv0.into / lv0.need;
    const fill1 = gained.levelUp ? 1 : lv1.into / lv1.need;
    const p = showPanel(html`<div class="results">
      <div class="results__score">
        <span class="label">${headline}</span>
        <div class="results__big display">${fmtPct(sum.accuracy)}<small>%</small></div>
        ${info.isTest ? '' : html`<div class="results__stars">${stars(sum.stars)}</div>`}
        <div class="results__xp">
          <b class="display">+<span data-xp>0</span> XP</b>
          <div class="xpbar"><i style="width:${(fill0 * 100).toFixed(1)}%"></i></div>
          <span class="label">LV ${pad2(lv0.level)}${gained.levelUp ? ` → ${pad2(lv1.level)}` : ''}</span>
        </div>
      </div>
      <div class="results__panel">
        <div class="tile"><b class="display">${sum.maxCombo}</b><span class="label">Max combo</span></div>
        <div class="tile"><b class="display">${sum.hits}/${sum.total}</b><span class="label">Notes hit</span></div>
        <div class="tile tile--wide"><b class="display missed">${missedNames.length ? missedNames.slice(0, 5).join(' · ') : 'None'}</b><span class="label">Missed notes</span></div>
        ${sum.notScored ? html`<p class="results__mic">${sum.notScored.hidden} of ${sum.notScored.all} notes weren't scored: each sits an octave (or 12th, or two octaves) above another note in the same chord, and no microphone can tell them apart.</p>` : ''}
        ${sum.untimed ? html`<div class="timing"><span class="label">Untimed drill · your first answer to each note counts</span></div>` : html`<div class="timing">
          <div class="tbar">
            <i style="flex:${sum.early}" class="t-early"></i><i style="flex:${sum.ontime}" class="t-on"></i><i style="flex:${sum.late}" class="t-late"></i><i style="flex:${sum.missed.length}" class="t-miss"></i>
            ${sum.total ? '' : raw('<i style="flex:1"></i>')}
          </div>
          <div class="tlegend"><span><b>${sum.early}</b> early</span><span><b>${sum.ontime}</b> on time</span><span><b>${sum.late}</b> late</span><span><b>${sum.missed.length}</b> missed</span></div>
        </div>`}
        <div class="results__btns">
          <span class="xpparts">${xp.parts.map((x) => html`<i>${x.label} +${x.xp}</i>`)}</span>
          <button class="btn" data-act="retry">Retry</button>
          ${info.isTest || isDrill() ? '' : html`<button class="btn" data-act="practice">${practice ? 'Practice again' : 'Practice'}</button>`}
          ${next ? html`<a class="btn btn--primary" href="#/lesson/${next}">Next →</a>`
            : html`<a class="btn btn--primary" href="${info.isSong ? '#/songs' : `#/map/${params.id}`}">${info.isSong ? 'Songs' : 'Map'}</a>`}
        </div>
      </div>
    </div>`);
    p.querySelector('[data-act="retry"]').addEventListener('click', () => (isDrill() ? startDrill() : startPlay()));
    p.querySelector('[data-act="practice"]')?.addEventListener('click', () => { practice = true; ready(); });

    // ---- the reveal: stars, XP count-up, level up, unlocks ----
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const starEls = [...p.querySelectorAll('.results__stars svg')];
    starEls.forEach((e) => e.classList.add('pre'));
    await wait(250);
    for (let i = 0; i < starEls.length; i++) {
      if (!alive || state !== 'results') return;
      starEls[i].classList.remove('pre');
      if (i < sum.stars) { starEls[i].classList.add('pop'); sfx.star(i + 1); }
      await wait(i < sum.stars ? 260 : 80);
    }
    if (!sum.stars && !practice && !info.isTest) sfx.fail();
    const xpEl = p.querySelector('[data-xp]');
    const bar = p.querySelector('.xpbar i');
    const steps = 14;
    for (let k = 1; k <= steps; k++) {
      if (!alive || state !== 'results') return;
      xpEl.textContent = Math.round((xp.total * k) / steps);
      bar.style.width = `${((fill0 + (fill1 - fill0) * (k / steps)) * 100).toFixed(1)}%`;
      if (k % 3 === 0) sfx.tick();
      await wait(32);
    }
    if (gained.levelUp) await levelUpMoment(lv1.level, gained.rankUp);
    for (const u of unlocks) {
      if (!alive || state !== 'results') return;
      await unlockToast(u);
    }
  }

  function levelUpMoment(level, rankUp) {
    return new Promise((resolve) => {
      const o = el(html`<div class="lvlup" role="status">
        <span class="label">Level up</span>
        <b class="display">LV ${pad2(level)}</b>
        ${rankUp ? html`<span class="lvlup__rank display">New rank · ${rankFor(level)}</span>` : ''}
      </div>`);
      screen.querySelector('.stage').append(o);
      sfx.levelUp();
      const done = () => { o.classList.add('out'); setTimeout(() => { o.remove(); resolve(); }, 250); };
      o.addEventListener('click', done);
      setTimeout(done, 2200);
    });
  }

  function unlockToast(u) {
    return new Promise((resolve) => {
      const what = { level: 'New level', levels: 'Unlocked', section: 'New section', song: u.hidden ? 'Hidden song found' : 'New song' }[u.kind];
      const t = el(html`<div class="unlock"><span class="label">${what}</span><b class="display">${u.title}</b></div>`);
      screen.querySelector('.stage').append(t);
      sfx.unlock();
      const done = () => { t.classList.add('out'); setTimeout(() => { t.remove(); resolve(); }, 220); };
      t.addEventListener('click', done);
      setTimeout(done, 1900);
    });
  }

  // ---------- find-the-key drills ----------
  let drill = null;
  let drillAnswer = null;
  let prompts = [];
  const isDrill = () => level?.type === 'find';
  const octave = (name) => name.match(/-?\d/)[0];
  const letter = (name) => name.replace(/-?\d/, '');

  function drillStage() {
    scoreHost.replaceChildren(el(html`<div class="drill">
      <div class="drill__prompt"></div>
      <ol class="drill__dots" aria-hidden="true">${prompts.map(() => html`<li></li>`)}</ol>
    </div>`));
    $('.playhead').hidden = true;
  }

  function showPrompt(pr, result = null) {
    const box = scoreHost.querySelector('.drill__prompt');
    const mode = level.show || 'name';
    const showName = mode !== 'staff' || result === 'miss';
    box.replaceChildren(el(html`<div class="drill__card ${result ? `is-${result}` : ''}">
      ${mode !== 'name' ? html`<div class="drill__staff"></div>` : ''}
      ${showName ? html`<div class="drill__name"><b class="display">${letter(pr.name)}<small>${octave(pr.name)}</small></b>${level.hints?.[pr.name] ? html`<span class="label">${level.hints[pr.name]}</span>` : ''}</div>` : ''}
      ${result === 'miss' ? html`<span class="drill__fb">It was ${pr.name}: here's the key</span>` : ''}
    </div>`));
    if (mode !== 'name') renderNoteCard(box.querySelector('.drill__staff'), { note: pr.name, clef: level.clef || 'treble', keySig: level.key || 'C' });
  }

  function drillReady(note = '') {
    state = 'ready';
    drill = null;
    drillAnswer = null;
    kb.setMarks({});
    scoreHost.querySelectorAll('.drill__dots li').forEach((d) => { d.className = ''; });
    const box = scoreHost.querySelector('.drill__prompt');
    box.replaceChildren(el(html`<div class="drill__card drill__card--idle"><b class="display">?</b></div>`));
    const rec = getProgress().levels[params.id];
    const p = showPanel(html`<div class="card ready">
      <span class="label">Untimed · ${prompts.length} notes · first answer counts</span>
      <h2 class="display">${info.title}</h2>
      <p>${(level.show || 'name') === 'staff' ? 'A note appears on the staff. Find it and play it.' : 'The app names a note. Find that key and play it.'}</p>
      ${note ? html`<p class="ready__note">${note}</p>` : ''}
      <div class="seg" role="radiogroup" aria-label="Input">
        <button class="seg__b ${micMode() ? 'is-on' : ''}" data-input="mic" role="radio" aria-checked="${micMode()}">${icons.mic} Keyboard</button>
        <button class="seg__b ${micMode() ? '' : 'is-on'}" data-input="tap" role="radio" aria-checked="${!micMode()}">Taps</button>
      </div>
      ${micMode() && !getCalibration() ? html`<p class="ready__note">First, a 1-minute mic calibration. <a class="link" href="#/calibrate/lesson/${params.id}">Calibrate now →</a></p>` : ''}
      <div class="ready__btns"><button class="btn btn--primary" data-act="go">${icons.play} Start</button></div>
      ${rec?.best != null ? html`<p class="ready__best">Best ${fmtPct(rec.best)}% ${stars(rec.stars)}</p>` : ''}
    </div>`);
    p.querySelector('[data-act="go"]').addEventListener('click', onGo);
    p.querySelectorAll('[data-input]').forEach((b) => b.addEventListener('click', async () => {
      await saveSettings({ inputMode: b.dataset.input });
      if (b.dataset.input === 'tap') mic.stop();
      drillReady(note);
    }));
  }

  function startDrill() {
    stopRun();
    hidePanel();
    state = 'running';
    lastTier = 1;
    setHud({ acc: null, combo: 0 });
    drill = createDrill(prompts);
    const d = drill;
    const dots = [...scoreHost.querySelectorAll('.drill__dots li')];
    dots.forEach((x) => { x.className = ''; });
    let hits = 0;
    let locked = false;
    const next = () => {
      if (drill !== d) return;
      if (d.done()) {
        const sum = d.summary();
        stopRun();
        results(sum);
        return;
      }
      dots.forEach((x, i) => x.classList.toggle('is-now', i === d.index));
      kb.setMarks({});
      showPrompt(d.current);
      locked = false;
    };
    drillAnswer = (midi) => {
      if (locked || drill !== d || d.done()) return;
      locked = true;
      const idx = d.index;
      const r = d.answer(midi);
      dots[idx].classList.remove('is-now');
      dots[idx].classList.add(r.type === 'hit' ? 'is-hit' : 'is-miss');
      if (r.type === 'hit') hits++;
      setHud({ acc: (hits / (idx + 1)) * 100, combo: d.combo, bump: r.type === 'hit' });
      if (r.type === 'hit') {
        kb.flash(midi, 'hit');
        showPrompt(r.prompt, 'hit');
        setTimeout(next, 420);
      } else {
        kb.flash(midi, 'miss');
        kb.setMarks({ [r.prompt.midi]: 'next' });
        showPrompt(r.prompt, 'miss');
        setTimeout(next, 1400);
      }
    };
    if (micMode() && mic.getState() === 'on') {
      mic.setDetecting(true);
      micNotesOff = mic.onNote((e) => drillAnswer?.(e.midi));
    }
    next();
  }

  function intro(cards, i = 0) {
    state = 'intro';
    const c = cards[i];
    const last = i === cards.length - 1;
    const isNote = c.kind === 'note';
    const p = showPanel(html`<div class="card intro ${isNote ? 'intro--note' : ''}">
      ${isNote ? html`<div class="intro__head">
        <div class="intro__note"><b class="display">${c.note.replace(/-?\d/, '')}<small>${c.note.match(/-?\d/)[0]}</small></b>${c.finger ? html`<span>finger ${c.finger}</span>` : ''}</div>
      </div>` : ''}
      <div class="intro__body">
        <span class="label">${info.label} · ${i + 1}/${cards.length}</span>
        <h2 class="display">${c.title || info.title}</h2>
        <p>${c.text}</p>
        <div class="ready__btns">
          <button class="btn btn--primary" data-act="next">${last ? 'Got it' : 'Next'}</button>
          ${i > 0 ? html`<button class="btn btn--ghost" data-act="prev">Back</button>` : ''}
        </div>
      </div>
    </div>`);
    if (c.kind === 'note') {
      const staff = el(html`<div class="intro__staff" aria-hidden="true"></div>`);
      p.querySelector('.intro__head').prepend(staff);
      renderNoteCard(staff, { note: c.note, clef: c.clef || level.clef || staffLayout(level)[0]?.clef || 'treble', keySig: level.key || 'C', scale: 0.72 });
    }
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
    if (state === 'running' || !level || isDrill()) return;
    try { await audio.unlock(); } catch { /* ignore */ }
    if (audio.running()) startListen(false);
  });
  tempoBtn.addEventListener('click', () => {
    if (state === 'running' || !level || info.isTest || isDrill()) return;
    practice = true;
    ready();
  });

  // ---------- boot ----------
  function prepare() {
    parsed = parseLevel(level);
    notes = expectedNotes(parsed);
    pr.from = 1;
    pr.to = barsOf().length;
  }
  const freshSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  // Sight-reading: swap in another unseen passage.
  async function newPassage() {
    if (state === 'running') return;
    level = { ...level, ...generatePassage(level.generate, freshSeed()) };
    prepare();
    buildKeyboard(noteRange(notes));
    await buildScore();
    ready();
  }

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
    if (isDrill()) {
      prompts = drillPrompts(level);
      buildKeyboard(noteRange(prompts));
      listenBtn.hidden = true;
      tempoBtn.hidden = true;
      drillStage();
    } else {
      if (level.generate) level = { ...level, ...generatePassage(level.generate, freshSeed()) };
      prepare();
      tempo = level.tempo.default;
      buildKeyboard(noteRange(notes));
      await buildScore();
      if (level.noListen) listenBtn.hidden = true;
    }
    if (!alive) return;
    const seen = new Set(getSettings().introsSeen || []);
    if (level.intro?.length && !seen.has(params.id)) intro(level.intro);
    else ready();
  })();

  // Pause if the app is backgrounded mid-run.
  const onHide = () => {
    if (!document.hidden) return;
    if (state === 'running') { stopRun(); ready('Paused: the app went to the background.'); }
    mic.stop(); // iOS ends the mic in the background anyway; reopened on the next Play
  };
  document.addEventListener('visibilitychange', onHide);

  // Re-engrave when the screen size changes (rotation).
  let rt = 0;
  const onResize = () => {
    clearTimeout(rt);
    rt = setTimeout(async () => {
      if (!level || !alive || isDrill()) return;
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
    micOff.forEach((f) => f());
    mic.stop();
    clearTimeout(rt);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('resize', onResize);
  };
}
