import { html, el, pad2 } from '../dom.js';
import { icons } from '../icons.js';
import { dock } from '../components/dock.js';
import { getProgress, getSettings, saveSettings, saveProgress, getPianos, savePianos } from '../../core/store.js';
import { addPiano, renamePiano, removePiano, setActive, activePiano } from '../../core/pianos.js';
import { makeBackup, parseBackup, backupFileName, describeBackup } from '../../core/backup.js';
import { openSheet } from '../components/sheet.js';
import { nameOf } from '../../core/music.js';
import { playerLevel, rankFor } from '../../core/progress.js';

export const orientation = 'portrait';

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export function render(root) {
  const p = getProgress();
  const s = getSettings();
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
      <li class="row"><a class="row__link" href="#/mictest"><span>♪</span><span class="row__t">Mic test<small>See which notes the app hears</small></span>${icons.chevron}</a></li>
      <li class="row"><span>${icons.metronome}</span><span class="row__t">Metronome during play<small>Count-in always plays</small></span><button class="switch ${s.metronome ? 'is-on' : ''}" data-set="metronome" role="switch" aria-checked="${s.metronome}"><i></i></button></li>
      <li class="row"><span>${icons.songs}</span><span class="row__t">Sound effects<small>Muted while the mic listens</small></span><button class="switch ${s.sfx ? 'is-on' : ''}" data-set="sfx" role="switch" aria-checked="${s.sfx}"><i></i></button></li>
    </ul>

    <h2 class="group-title label">Pianos</h2>
    <ul class="rows" data-pianos></ul>

    <h2 class="group-title label">Your data</h2>
    <ul class="rows">
      <li class="row"><button class="row__link" data-export><span>↓</span><span class="row__t">Export backup<small>Save everything as a JSON file (Files, iCloud, AirDrop…)</small></span>${icons.chevron}</button></li>
      <li class="row"><button class="row__link" data-import><span>↑</span><span class="row__t">Import backup<small>Restore from a backup file</small></span>${icons.chevron}</button></li>
      <input type="file" accept="application/json,.json" data-file hidden>
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
  // ---------- pianos ----------
  const calSummary = (cal) => (cal ? `${nameOf(cal.low)}–${nameOf(cal.high)} · delay ${cal.micLatencyMs} ms · room ${Math.round(cal.noiseDb)} dB` : 'Not calibrated yet · about a minute');
  const pianoList = screen.querySelector('[data-pianos]');
  function drawPianos() {
    const ps = getPianos();
    const act = activePiano(ps);
    pianoList.replaceChildren(...ps.list.map((pn) => el(html`<li class="row piano ${pn.id === ps.active ? 'is-active' : ''}">
      <button class="row__link" data-piano="${pn.id}" aria-pressed="${pn.id === ps.active}"><span class="piano__dot" aria-hidden="true"></span><span class="row__t">${pn.name}<small>${pn.id === ps.active ? 'In use · ' : ''}${calSummary(pn.calibration)}</small></span></button>
      <button class="piano__edit" data-edit="${pn.id}" aria-label="Edit ${pn.name}">•••</button>
    </li>`)),
    el(html`<li class="row"><a class="row__link" href="#/calibrate"><span>◎</span><span class="row__t">Calibrate ${act.name}<small>Mic, room and timing for this piano</small></span>${icons.chevron}</a></li>`),
    el(html`<li class="row"><button class="row__link" data-add><span>＋</span><span class="row__t">Add a piano<small>Another keyboard or an acoustic piano: each keeps its own calibration</small></span>${icons.chevron}</button></li>`));
    pianoList.querySelectorAll('[data-piano]').forEach((b) => b.addEventListener('click', async () => {
      await savePianos(setActive(getPianos(), b.dataset.piano));
      drawPianos();
    }));
    pianoList.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editPiano(b.dataset.edit)));
    pianoList.querySelector('[data-add]').addEventListener('click', addPianoSheet);
  }
  function nameField(value = '', placeholder = '') {
    return html`<input class="field" data-name type="text" maxlength="24" autocomplete="off" value="${value}" placeholder="${placeholder}" aria-label="Piano name">`;
  }
  function addPianoSheet() {
    const body = el(html`<div class="lsheet">
      <span class="label">New piano</span>
      <h3 class="lsheet__t display">Add a piano</h3>
      <p class="lsheet__sub">Give it a name, then calibrate it once. Switch pianos any time here or on a lesson's start card.</p>
      ${nameField('', 'e.g. Acoustic piano')}
      <div class="chips">${['Casio', 'Acoustic piano', 'School piano'].map((n) => html`<button class="chip" data-chip="${n}">${n}</button>`)}</div>
      <div class="ready__btns"><button class="btn btn--primary" data-yes>Add and calibrate</button><button class="btn btn--ghost" data-no>Cancel</button></div>
    </div>`);
    const close = openSheet(body);
    const input = body.querySelector('[data-name]');
    body.querySelectorAll('[data-chip]').forEach((c) => c.addEventListener('click', () => { input.value = c.dataset.chip; }));
    body.querySelector('[data-no]').addEventListener('click', close);
    body.querySelector('[data-yes]').addEventListener('click', async () => {
      await savePianos(addPiano(getPianos(), input.value));
      close();
      setTimeout(() => { location.hash = '#/calibrate/you'; }, 280);
    });
  }
  function editPiano(id) {
    const ps = getPianos();
    const pn = ps.list.find((x) => x.id === id);
    if (!pn) return;
    const body = el(html`<div class="lsheet">
      <span class="label">Piano</span>
      <h3 class="lsheet__t display">${pn.name}</h3>
      <p class="lsheet__sub">${calSummary(pn.calibration)}</p>
      ${nameField(pn.name)}
      <div class="ready__btns">
        <button class="btn btn--primary" data-save>Save name</button>
        <button class="btn btn--ghost" data-cal>Calibrate</button>
        ${ps.list.length > 1 ? html`<button class="btn btn--ghost" data-del>Delete</button>` : ''}
      </div>
    </div>`);
    const close = openSheet(body);
    body.querySelector('[data-save]').addEventListener('click', async () => {
      await savePianos(renamePiano(getPianos(), id, body.querySelector('[data-name]').value));
      close();
      drawPianos();
    });
    body.querySelector('[data-cal]').addEventListener('click', async () => {
      await savePianos(setActive(getPianos(), id));
      close();
      setTimeout(() => { location.hash = '#/calibrate/you'; }, 280);
    });
    body.querySelector('[data-del]')?.addEventListener('click', async () => {
      await savePianos(removePiano(getPianos(), id));
      close();
      drawPianos();
    });
  }
  drawPianos();

  // ---------- backup ----------
  const message = (title, text) => openSheet(el(html`<div class="lsheet"><h3 class="lsheet__t display">${title}</h3><p class="lsheet__sub">${text}</p></div>`));
  screen.querySelector('[data-export]').addEventListener('click', async () => {
    const data = makeBackup({ progress: getProgress(), settings: getSettings(), pianos: getPianos() });
    const name = backupFileName();
    const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Learning Piano backup' });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  const fileInput = screen.querySelector('[data-file]');
  screen.querySelector('[data-import]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    let b;
    try { b = parseBackup(await f.text()); } catch (e) { message('Can’t import', e.message); return; }
    const body = el(html`<div class="lsheet">
      <span class="label">Import backup${b.exportedAt ? ` · saved ${new Date(b.exportedAt).toLocaleDateString()}` : ''}</span>
      <h3 class="lsheet__t display">Replace your progress?</h3>
      <p class="lsheet__sub">Backup: ${describeBackup(b, playerLevel)}.<br>Now: ${describeBackup({ progress: getProgress() }, playerLevel)}.<br>This replaces what's on this phone.</p>
      <div class="ready__btns"><button class="btn btn--primary" data-yes>Replace</button><button class="btn btn--ghost" data-no>Cancel</button></div>
    </div>`);
    const close = openSheet(body);
    body.querySelector('[data-no]').addEventListener('click', close);
    body.querySelector('[data-yes]').addEventListener('click', async () => {
      await saveProgress(b.progress);
      if (b.settings) await saveSettings(b.settings);
      await savePianos(b.pianos);
      close();
      setTimeout(() => { location.hash = '#/'; }, 300);
    });
  });

  root.append(screen, dock('you'));
}
