// Mic test: play anything and see what the app hears. Useful for checking
// accuracy after calibration and for reporting problems.
import { html, el } from '../dom.js';
import { icons } from '../icons.js';
import * as mic from '../../audio/mic.js';
import { nameOf } from '../../core/music.js';
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

  return () => { off.forEach((f) => f()); mic.stop(); };
}
