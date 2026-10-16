// Mic test: play anything and see what the app hears. Useful for checking
// accuracy after calibration and for reporting problems. The chord check
// lights a chord's keys and shows which of its notes the mic heard.
import { html, el } from '../dom.js';
import { icons } from '../icons.js';
import * as mic from '../../audio/mic.js';
import { nameOf, midiOf } from '../../core/music.js';
import { getCalibration } from '../../core/store.js';
import { meter, setMeter } from './calibrate.js';
import { createKeyboard } from '../components/keyboard.js';

export const orientation = 'any';

export function render(root) {
  const cal = getCalibration();
  const screen = el(html`<main class="screen screen--any calib mictest">
    <header class="topbar">
      <a class="circle-btn" href="#/you" aria-label="Close">${icons.close}</a>
      <span class="label">Mic test</span>
      <span class="circle-btn" style="visibility:hidden"></span>
    </header>
    <section class="calib__card">
      <h1 class="display">Play anything</h1>
      <p>Each note the app hears appears below. Play a scale slowly and check every note is right.</p>
      ${meter()}
      <p class="calib__big display" data-note>—</p>
      <p class="mictest__hz" data-hz>&nbsp;</p>
      <ol class="mictest__hist" data-hist></ol>
      <div class="calib__btns">
        <button class="btn btn--primary" data-start>${icons.mic} Start listening</button>
        <button class="btn btn--ghost" data-clear>Clear</button>
      </div>
      ${cal ? '' : html`<p class="calib__warn">Not calibrated yet: results may be less reliable. <a href="#/calibrate/mictest">Calibrate</a></p>`}
    </section>
    <section class="calib__card twokey" data-two>
      <h1 class="display">Chord check</h1>
      <p>Checks that the app hears chords on your piano. It names a chord and lights its keys: press them together. No rhythm, no rush.</p>
      <div class="twokey__stage" data-stage></div>
      <div class="twokey__kb" data-kb></div>
      <ol class="twokey__dots" data-dots></ol>
      <div class="calib__btns"><button class="btn btn--primary" data-two-start>${icons.mic} Start chord check</button></div>
    </section>
  </main>`);
  root.append(screen);
  const $ = (s) => screen.querySelector(s);
  const hist = $('[data-hist]');
  const off = [];

  $('[data-clear]').addEventListener('click', () => hist.replaceChildren());
  $('[data-start]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const st = await mic.start();
    if (st !== 'on') { $('[data-note]').textContent = st === 'denied' ? 'Mic blocked' : 'Mic error'; return; }
    btn.hidden = true;
    if (cal) mic.configure({ noiseDb: cal.noiseDb, low: cal.low, high: cal.high });
    mic.setDetecting(true);
    const m = screen.querySelector('.meter');
    off.push(mic.onFrame((f) => {
      setMeter(m, f.bandDb);
      $('[data-hz]').textContent = f.clarity > 0.8 && f.pitch ? `${f.pitch.toFixed(1)} Hz · clarity ${f.clarity.toFixed(2)}` : ' ';
    }));
    off.push(mic.onNote((ev) => {
      $('[data-note]').textContent = nameOf(ev.midi);
      const li = document.createElement('li');
      li.textContent = nameOf(ev.midi);
      li.title = ev.how;
      hist.prepend(li);
      while (hist.children.length > 24) hist.lastChild.remove();
    }));
  });

  // ---------- chord check ----------
  // Names a chord, lights its keys, and shows which notes the mic heard.
  const CHORDS = [
    ['C major', ['C4', 'E4', 'G4'], 'Right hand: thumb, middle finger, pinky'],
    ['F major', ['C4', 'F4', 'A4'], 'Right hand'],
    ['G major', ['B3', 'D4', 'G4'], 'Right hand'],
    ['A minor', ['A3', 'C4', 'E4'], 'Right hand'],
    ['Both hands', ['C3', 'E4', 'G4'], 'Left hand C3, right hand E4 and G4, together'],
  ];
  const stage = $('[data-stage]');
  const dots = $('[data-dots]');
  const startBtn = $('[data-two-start]');
  const kbHost = $('[data-kb]');
  let twoOff = null;
  const kb = createKeyboard({ low: 48, keys: 25 });
  kbHost.append(kb.el);
  const show = (tpl) => stage.replaceChildren(el(tpl));

  async function runChordCheck() {
    twoOff?.();
    const st = await mic.start();
    if (st !== 'on') { show(html`<p class="calib__warn">${st === 'denied' ? 'Microphone blocked.' : 'The microphone could not start.'}</p>`); return; }
    if (cal) mic.configure({ noiseDb: cal.noiseDb, low: cal.low, high: cal.high });
    mic.setDetecting(true);
    startBtn.hidden = true;
    dots.replaceChildren(...CHORDS.map(() => document.createElement('li')));
    let step = -1;
    let busy = false;
    let full = 0;
    let notesHeard = 0;
    const notesTotal = CHORDS.reduce((a, c) => a + c[1].length, 0);
    const next = () => {
      step++;
      busy = false;
      if (step >= CHORDS.length) return finish();
      const [name, keys, how] = CHORDS[step];
      [...dots.children].forEach((d, i) => d.classList.toggle('is-now', i === step));
      kb.setMarks(Object.fromEntries(keys.map((k) => [midiOf(k), 'next'])));
      show(html`<div class="twokey__ask">
        <span class="label">Chord ${step + 1} of ${CHORDS.length}</span>
        <b class="display">${name}</b>
        <span class="twokey__hint">${keys.join(' · ')}</span>
        <span class="twokey__how">${how}. Press the lit keys at the same moment.</span>
      </div>`);
    };
    const finish = () => {
      twoOff?.();
      twoOff = null;
      kb.setMarks({});
      show(html`<div class="twokey__done">
        <b class="display">${full}/${CHORDS.length}</b>
        <p>chords heard complete · ${notesHeard}/${notesTotal} notes.</p>
        <p class="twokey__fine">${full >= CHORDS.length - 1 ? 'Chord scoring should work well for you.' : 'Some notes were missed: press the keys together and firmly, try the phone a little closer, or re-run calibration.'}</p>
      </div>`);
      startBtn.textContent = 'Run it again';
      startBtn.hidden = false;
    };
    const judge = (e) => {
      if (busy || !twoOff || step < 0 || step >= CHORDS.length) return;
      const [name, keys] = CHORDS[step];
      const midis = keys.map(midiOf);
      const { heard } = mic.chordStartedNear(midis, e.perf, 70);
      if (import.meta.env.DEV) (window.__chordLog ||= []).push({ step, midi: e.midi, how: e.how, dropped: !!e.dropped, perf: Math.round(e.perf), heard: [...heard] });
      // Only a clear new strike is an answer: letting go of keys can look like an
      // attack to the detector, but the sound only gets quieter.
      if (mic.riseDb(e.perf) < 4 || (!heard.size && ((e.dropped && !e.pitchless) || e.how !== 'attack'))) return;
      busy = true;
      notesHeard += heard.size;
      const ok = heard.size === midis.length;
      if (ok) full++;
      kb.setMarks(Object.fromEntries(midis.map((m) => [m, heard.has(m) ? 'hit' : 'miss'])));
      const dot = dots.children[step];
      dot.classList.remove('is-now');
      dot.classList.add(ok ? 'is-hit' : 'is-miss');
      show(html`<div class="twokey__ask">
        <span class="label">${ok ? 'Heard every note' : 'Not every note heard'}</span>
        <b class="display">${name}</b>
        <span class="twokey__fb">${keys.map((k) => `${heard.has(midiOf(k)) ? '✓' : '✗'} ${k}`).join('   ')}</span>
      </div>`);
      setTimeout(next, ok ? 1200 : 2000);
    };
    // Judge each strike once enough of it has been heard.
    const offOnset = mic.onOnset((e) => setTimeout(() => judge(e), Math.max(0, e.perf + mic.ATTACK_MS - performance.now())));
    twoOff = () => { offOnset(); };
    next();
  }
  startBtn.addEventListener('click', runChordCheck);

  return () => { off.forEach((f) => f()); twoOff?.(); mic.stop(); };
}
