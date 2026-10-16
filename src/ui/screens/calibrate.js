// Calibration: mic permission → room noise → lowest key → highest key → playing
// level → timing (play along with clicks). Works in either orientation.
import { html, el, raw } from '../dom.js';
import { icons } from '../icons.js';
import * as mic from '../../audio/mic.js';
import * as audio from '../../audio/engine.js';
import { nameOf } from '../../core/music.js';
import { getCalibration, saveCalibration, saveSettings, getActivePiano } from '../../core/store.js';
import { noiseFloor, levelVerdict, clickOffsets, latencyFromOffsets } from '../../engine/calibration.js';

export const orientation = 'any';

const DEFAULT_LOW = 36; // C2 — CTK-2400
const DEFAULT_HIGH = 96; // C7
const STEPS = ['Setup', 'Room', 'Lowest', 'Highest', 'Level', 'Timing', 'Done'];

export function meter(n = 28) {
  return raw(`<div class="meter" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i style="height:${35 + (i / n) * 65}%"></i>`).join('')}</div>`);
}
/** Lights a meter from a band level in dB (-80 … -6). */
export function setMeter(elm, dbv) {
  const bars = elm.children;
  const lit = Math.round(Math.max(0, Math.min(1, (dbv + 80) / 74)) * bars.length);
  for (let i = 0; i < bars.length; i++) bars[i].className = i < lit ? (i > bars.length * 0.88 ? 'hot' : 'on') : '';
}

export function render(root, params) {
  const back = params.back ? `#/${params.back}` : '#/you';
  const prev = getCalibration();
  const cal = {
    noiseDb: prev?.noiseDb ?? -60,
    low: prev?.low ?? DEFAULT_LOW,
    high: prev?.high ?? DEFAULT_HIGH,
    peakDb: prev?.peakDb ?? null,
    micLatencyMs: prev?.micLatencyMs ?? null,
    spreadMs: prev?.spreadMs ?? null,
  };

  const screen = el(html`<main class="screen screen--any calib">
    <header class="topbar">
      <a class="circle-btn" href="${back}" aria-label="Close">${icons.close}</a>
      <span class="label">Calibrate · ${getActivePiano().name}</span>
      <span class="circle-btn" style="visibility:hidden"></span>
    </header>
    <ol class="steps" aria-label="Steps">${STEPS.map((s) => html`<li>${s}</li>`)}</ol>
    <section class="calib__card"></section>
  </main>`);
  root.append(screen);
  const card = screen.querySelector('.calib__card');
  const stepEls = [...screen.querySelectorAll('.steps li')];

  let off = []; // unsubscribe functions for the current step
  let timers = [];
  let alive = true;
  const cleanupStep = () => {
    off.forEach((f) => f());
    off = [];
    timers.forEach(clearTimeout);
    timers = [];
    mic.setDetecting(false);
    audio.stopAll();
  };

  const show = (i, tpl) => {
    cleanupStep();
    stepEls.forEach((s, j) => { s.classList.toggle('is-on', j === i); s.classList.toggle('is-done', j < i); });
    card.replaceChildren(el(tpl));
    return card.firstElementChild;
  };

  // ---------- 0. setup + permission ----------
  function setup(msg = '') {
    const c = show(0, html`<div>
      <h1 class="display">Set up like you practise</h1>
      <ul class="calib__list">
        <li>Phone 6–12 inches (15–30 cm) from the keyboard's speakers, screen facing you.</li>
        <li>Keyboard at your normal volume, piano sound, no rhythm or effects.</li>
        <li>No headphones: the app listens through the phone's own mic.</li>
      </ul>
      ${msg ? html`<p class="calib__warn">${msg}</p>` : ''}
      <div class="calib__btns"><button class="btn btn--primary" data-go>${icons.mic} Allow microphone</button></div>
      <p class="calib__fine">Takes about a minute. Everything stays on this phone.</p>
    </div>`);
    c.querySelector('[data-go]').addEventListener('click', async () => {
      const st = await mic.start();
      if (!alive) return;
      if (st === 'on') room();
      else if (st === 'denied') setup('Microphone access was blocked. On iPhone: Settings → Safari → Microphone → Allow (or Ask), then come back and tap again.');
      else if (st === 'unsupported') setup('This browser cannot use the microphone. Open the app in Safari.');
      else setup('The microphone could not start. Close other apps using it and try again.');
    });
  }

  // ---------- 1. room noise ----------
  function room() {
    const c = show(1, html`<div>
      <h1 class="display">Quiet, please</h1>
      <p>Don't play for 3 seconds while we measure the room.</p>
      ${meter()}
      <p class="calib__big display" data-out>3</p>
      <div class="calib__btns" hidden data-btns><button class="btn btn--primary" data-next>Next</button><button class="btn btn--ghost" data-redo>Measure again</button></div>
    </div>`);
    const m = c.querySelector('.meter');
    const out = c.querySelector('[data-out]');
    const levels = [];
    const t0 = performance.now();
    off.push(mic.onFrame((f) => {
      setMeter(m, f.bandDb);
      const left = 3 - (performance.now() - t0) / 1000;
      if (left > 0) { levels.push(f.bandDb); out.textContent = Math.ceil(left); return; }
      if (c.querySelector('[data-btns]').hidden) {
        const r = noiseFloor(levels);
        cal.noiseDb = r.noiseDb;
        out.innerHTML = `${{ quiet: 'Quiet', ok: 'Fine', noisy: 'Noisy' }[r.rating]}<small>${Math.round(r.noiseDb)} dB</small>`;
        if (r.rating === 'noisy') out.insertAdjacentHTML('afterend', '<p class="calib__warn">Background noise may cause false notes. Turn off fans or TV if you can.</p>');
        c.querySelector('[data-btns]').hidden = false;
      }
    }));
    c.querySelector('[data-next]').addEventListener('click', () => keyStep('low'));
    c.querySelector('[data-redo]').addEventListener('click', room);
  }

  // ---------- 2/3. lowest & highest key ----------
  function keyStep(which) {
    const isLow = which === 'low';
    const def = isLow ? DEFAULT_LOW : DEFAULT_HIGH;
    let heard = null;
    const c = show(isLow ? 2 : 3, html`<div>
      <h1 class="display">${isLow ? 'Play your lowest key' : 'Play your highest key'}</h1>
      <p>${isLow ? 'The white key at the far left.' : 'The white key at the far right.'} Play it firmly, once.</p>
      ${meter()}
      <p class="calib__big display" data-out>…</p>
      <div class="calib__adjust" hidden data-adj>
        <button class="circle-btn" data-dn aria-label="Lower">−</button>
        <span>Not right? Adjust by octave</span>
        <button class="circle-btn" data-up aria-label="Higher">+</button>
      </div>
      <div class="calib__btns">
        <button class="btn btn--primary" data-ok disabled>Use this key</button>
        <button class="btn btn--ghost" data-skip>Skip (use ${nameOf(def)})</button>
      </div>
    </div>`);
    const m = c.querySelector('.meter');
    const out = c.querySelector('[data-out]');
    const ok = c.querySelector('[data-ok]');
    const setHeard = (midi) => {
      heard = midi;
      out.textContent = nameOf(midi);
      ok.disabled = false;
      c.querySelector('[data-adj]').hidden = false;
    };
    mic.configure({ noiseDb: cal.noiseDb, low: 21, high: 108 });
    mic.setDetecting(true);
    off.push(mic.onFrame((f) => setMeter(m, f.bandDb)));
    // Only fresh key strikes count here (not the previous step's note still ringing).
    off.push(mic.onNote((e) => { if (e.how === 'attack' && (isLow || e.midi > cal.low)) setHeard(e.midi); }));
    c.querySelector('[data-up]').addEventListener('click', () => heard != null && setHeard(Math.min(108, heard + 12)));
    c.querySelector('[data-dn]').addEventListener('click', () => heard != null && setHeard(Math.max(21, heard - 12)));
    const next = (v) => {
      if (isLow) { cal.low = v; keyStep('high'); } else { cal.high = v; level(); }
    };
    ok.addEventListener('click', () => next(heard));
    c.querySelector('[data-skip]').addEventListener('click', () => next(def));
  }

  // ---------- 4. playing level ----------
  function level() {
    const c = show(4, html`<div>
      <h1 class="display">Play middle C three times</h1>
      <p>At your normal strength, with a short pause between.</p>
      ${meter()}
      <p class="calib__big display" data-out>0 / 3</p>
      <p class="calib__tip" data-tip></p>
      <div class="calib__btns" hidden data-btns><button class="btn btn--primary" data-next>Next</button><button class="btn btn--ghost" data-redo>Try again</button></div>
    </div>`);
    const m = c.querySelector('.meter');
    const out = c.querySelector('[data-out]');
    let peak = -120;
    let clipped = false;
    let count = 0;
    let watchUntil = 0;
    mic.configure({ noiseDb: cal.noiseDb, low: cal.low, high: cal.high });
    mic.setDetecting(true);
    off.push(mic.onFrame((f, t, ring) => {
      setMeter(m, f.bandDb);
      if (performance.now() < watchUntil) {
        peak = Math.max(peak, f.bandDb);
        for (let i = 0; i < ring.length; i += 4) if (Math.abs(ring[i]) > 0.98) { clipped = true; break; }
      }
    }));
    off.push(mic.onNote(() => {
      if (count >= 3) return;
      count++;
      watchUntil = performance.now() + 250;
      out.textContent = `${count} / 3`;
      if (count === 3) {
        timers.push(setTimeout(() => {
          const v = levelVerdict(peak, cal.noiseDb, clipped);
          cal.peakDb = Math.round(peak);
          out.innerHTML = `${{ great: 'Great', ok: 'OK', quiet: 'Too quiet', loud: 'Too loud' }[v.rating]}`;
          c.querySelector('[data-tip]').textContent = v.tip;
          c.querySelector('[data-btns]').hidden = false;
          c.querySelector('[data-next]').textContent = v.ok ? 'Next' : 'Continue anyway';
        }, 300));
      }
    }));
    c.querySelector('[data-next]').addEventListener('click', timing);
    c.querySelector('[data-redo]').addEventListener('click', level);
  }

  // ---------- 5. timing ----------
  function timing() {
    const c = show(5, html`<div>
      <h1 class="display">Play along with the clicks</h1>
      <p>You'll hear 4 count-in clicks. Then play any key exactly on each of the next 8 clicks.</p>
      <div class="beats" data-beats>${raw(Array.from({ length: 12 }, (_, i) => `<i class="${i < 4 ? 'ci' : ''}"></i>`).join(''))}</div>
      <p class="calib__big display" data-out>Ready</p>
      <p class="calib__tip" data-tip></p>
      <div class="calib__btns" data-btns><button class="btn btn--primary" data-start>${icons.play} Start</button></div>
    </div>`);
    const out = c.querySelector('[data-out]');
    const beats = [...c.querySelectorAll('[data-beats] i')];
    c.querySelector('[data-start]').addEventListener('click', async () => {
      await audio.unlock();
      c.querySelector('[data-btns]').hidden = true;
      const spb = 0.75; // 80 BPM
      const notes = [];
      mic.configure({ noiseDb: cal.noiseDb, low: cal.low, high: cal.high });
      mic.setDetecting(true);
      off.push(mic.onNote((e) => notes.push(e.perf)));
      const events = beats.map((_, i) => ({ at: i * spb, fn: (time) => audio.playClick(time, i % 4 === 0) }));
      const startAt = audio.startTransport(events, 0.3);
      const clickPerf = beats.map((_, i) => audio.audioToPerf(startAt + i * spb));
      clickPerf.forEach((p, i) => {
        timers.push(setTimeout(() => {
          beats.forEach((b, j) => b.classList.toggle('is-now', j === i));
          out.textContent = i < 4 ? `${4 - i}` : 'Play!';
        }, Math.max(0, p - performance.now())));
      });
      timers.push(setTimeout(() => {
        beats.forEach((b) => b.classList.remove('is-now'));
        const r = latencyFromOffsets(clickOffsets(clickPerf.slice(4), notes));
        const btns = c.querySelector('[data-btns]');
        btns.hidden = false;
        if (r.ok) {
          cal.micLatencyMs = r.latencyMs;
          cal.spreadMs = r.spreadMs;
          out.innerHTML = `${r.latencyMs} ms<small>±${r.spreadMs}</small>`;
          c.querySelector('[data-tip]').textContent = 'Your setup’s delay. Timing scores will subtract it so you’re judged fairly.';
          btns.innerHTML = '<button class="btn btn--primary" data-next>Save</button><button class="btn btn--ghost" data-redo>Again</button>';
        } else {
          out.textContent = r.reason === 'few' ? 'Missed it' : 'Uneven';
          c.querySelector('[data-tip]').textContent = r.reason === 'few'
            ? 'We heard fewer than 5 of the 8 notes. Play a little louder, right on each click.'
            : 'The taps were uneven. Try to land exactly on each click.';
          btns.innerHTML = '<button class="btn btn--primary" data-redo>Try again</button><button class="btn btn--ghost" data-next>Skip</button>';
        }
        btns.querySelector('[data-next]').addEventListener('click', done);
        btns.querySelector('[data-redo]').addEventListener('click', timing);
      }, clickPerf.at(-1) - performance.now() + 700));
    });
  }

  // ---------- 6. done ----------
  async function done() {
    const saved = { ...cal, micLatencyMs: cal.micLatencyMs ?? 80, at: Date.now() };
    await saveCalibration(saved);
    await saveSettings({ inputMode: 'mic' });
    mic.configure({ noiseDb: saved.noiseDb, low: saved.low, high: saved.high });
    const c = show(6, html`<div>
      <h1 class="display">You're calibrated</h1>
      <dl class="calib__sum">
        <div><dt class="label">Keyboard</dt><dd class="display">${nameOf(saved.low)}–${nameOf(saved.high)}</dd></div>
        <div><dt class="label">Room</dt><dd class="display">${Math.round(saved.noiseDb)} dB</dd></div>
        <div><dt class="label">Delay</dt><dd class="display">${saved.micLatencyMs} ms</dd></div>
      </dl>
      <p>Saved for ${getActivePiano().name}. Redo it any time from You → Pianos, e.g. if you move the phone. Playing another piano? Add it there: each piano keeps its own calibration.</p>
      <div class="calib__btns">
        <a class="btn btn--primary" href="${back}">Done</a>
        <a class="btn btn--ghost" href="#/mictest">Test the mic</a>
      </div>
    </div>`);
    void c;
  }

  setup();
  return () => {
    alive = false;
    cleanupStep();
    mic.stop();
  };
}
