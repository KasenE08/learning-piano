// Mic test: play anything and see what the app hears. Useful for checking
// accuracy after calibration and for reporting problems. The two-key check
// tests hands-together listening with no skill needed: hold a low key with the
// left hand, press single keys with the right.
import { html, el } from '../dom.js';
import { icons } from '../icons.js';
import * as mic from '../../audio/mic.js';
import { nameOf, midiOf } from '../../core/music.js';
import { getCalibration } from '../../core/store.js';
import { meter, setMeter } from './calibrate.js';

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
      <h1 class="display">Two-key check</h1>
      <p>Tests listening with both hands down. Hold one low key with your left hand, then press single keys with your right when they're named. No rhythm, no rush.</p>
      <div class="twokey__stage" data-stage></div>
      <ol class="twokey__dots" data-dots></ol>
      <div class="calib__btns"><button class="btn btn--primary" data-two-start>${icons.mic} Start two-key check</button></div>
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

  // ---------- two-key check ----------
  const HOLD = 'C3';
  const PROMPTS = ['E4', 'G4', 'D4', 'F4', 'C5', 'A4'];
  const HINTS = {
    C3: 'the C below middle C',
    D4: 'the white key just right of middle C',
    E4: 'two white keys right of middle C',
    F4: 'three white keys right of middle C',
    G4: 'four white keys right of middle C',
    A4: 'five white keys right of middle C',
    C5: 'the C above middle C',
  };
  const stage = $('[data-stage]');
  const dots = $('[data-dots]');
  const startBtn = $('[data-two-start]');
  let twoOff = null;
  const show = (tpl) => stage.replaceChildren(el(tpl));
  const ask = (name, hand, extra = '') => show(html`<div class="twokey__ask">
    <span class="label">${hand}</span>
    <b class="display">${name.replace(/\d/, '')}<small>${name.match(/\d/)[0]}</small></b>
    <span class="twokey__hint">${HINTS[name]}</span>
    ${extra ? html`<span class="twokey__fb">${extra}</span>` : ''}
  </div>`);

  async function runTwoKey() {
    twoOff?.();
    const st = await mic.start();
    if (st !== 'on') { show(html`<p class="calib__warn">${st === 'denied' ? 'Microphone blocked.' : 'The microphone could not start.'}</p>`); return; }
    if (cal) mic.configure({ noiseDb: cal.noiseDb, low: cal.low, high: cal.high });
    mic.setDetecting(true);
    startBtn.hidden = true;
    dots.replaceChildren(...PROMPTS.map(() => document.createElement('li')));
    const hold = midiOf(HOLD);
    let step = -1; // -1: waiting for the held key
    let busy = false;
    let heard = 0;
    let guessed = 0;
    ask(HOLD, 'Left hand · press and keep holding');
    const next = () => {
      step++;
      busy = false;
      if (step >= PROMPTS.length) return finish();
      [...dots.children].forEach((d, i) => d.classList.toggle('is-now', i === step));
      ask(PROMPTS[step], `Right hand · ${step + 1} of ${PROMPTS.length}`, 'Keep holding the low C');
    };
    const finish = () => {
      twoOff?.();
      twoOff = null;
      show(html`<div class="twokey__done">
        <b class="display">${heard}/${PROMPTS.length}</b>
        <p>right-hand keys heard while your left hand held C3.</p>
        <p class="twokey__fine">One-pitch guess alone: ${guessed}/${PROMPTS.length}. ${heard >= PROMPTS.length - 1 ? 'Hands-together scoring should work well for you.' : 'Some keys were missed: try the phone a little closer, or re-run calibration.'}</p>
      </div>`);
      startBtn.textContent = 'Run it again';
      startBtn.hidden = false;
    };
    // Judge each attack once enough of it has been heard.
    twoOff = mic.onOnset((e) => setTimeout(() => {
      if (busy || !twoOff) return;
      if (step === -1) {
        if ((!e.dropped && e.midi === hold) || e.hears(hold)) { busy = true; setTimeout(next, 500); }
        return;
      }
      const want = midiOf(PROMPTS[step]);
      const guess = !e.dropped && e.midi === want;
      const ok = guess || e.hears(want);
      // Only a clear new key strike counts as a wrong answer: not the low C again,
      // a repeat the detector dropped, or a pitch that surfaced as another key let go.
      if (!ok && (e.dropped || e.how !== 'attack' || e.midi === hold || e.hears(hold))) return;
      busy = true;
      if (guess) guessed++;
      if (ok) heard++;
      const dot = dots.children[step];
      dot.classList.remove('is-now');
      dot.classList.add(ok ? 'is-hit' : 'is-miss');
      ask(PROMPTS[step], ok ? 'Heard it' : 'Not heard', ok ? '✓' : e.dropped ? 'Nothing new heard' : `Heard ${nameOf(e.midi)}`);
      setTimeout(next, ok ? 700 : 1400);
    }, Math.max(0, e.perf + mic.ATTACK_MS - performance.now())));
  }
  startBtn.addEventListener('click', runTwoKey);

  return () => { off.forEach((f) => f()); twoOff?.(); mic.stop(); };
}
