// End-to-end mic tests in Chromium with a fake microphone that plays synthetic
// piano audio. Checks the whole chain (getUserMedia → AudioWorklet → analysis →
// detector → scoring) and takes screenshots.
// Usage: node scripts/e2e-mic.mjs [outDir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render, SR } from '../tests/helpers/synth.js';
import { midiOf } from '../src/core/music.js';
import { parseLevel, expectedNotes, micScoring } from '../src/engine/notation.js';

const outDir = process.argv[2] || 'screenshots/mic';
mkdirSync(outDir, { recursive: true });
const tmp = (n) => join(tmpdir(), `lp-${n}.wav`);

function wav(path, notes, seconds, post = () => {}) {
  const sig = render({ notes, seconds, noiseDb: -64 });
  post(sig);
  const b = Buffer.alloc(44 + sig.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + sig.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(sig.length * 2, 40);
  for (let i = 0; i < sig.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sig[i] * 32767))), 44 + i * 2);
  writeFileSync(path, b);
  return path;
}

// 1) Calibration script: silence, lowest C2, highest C7, three middle Cs, then 8 notes on clicks.
const CAL_START = 12.0; // when the test presses "Start" on the timing step (s after mic opens)
const calNotes = [
  { midi: 36, at: 4.5, dur: 0.8 },
  { midi: 96, at: 6.5, dur: 0.6 },
  { midi: 60, at: 8.0, dur: 0.5 }, { midi: 60, at: 9.0, dur: 0.5 }, { midi: 60, at: 10.0, dur: 0.5 },
  ...Array.from({ length: 8 }, (_, i) => ({ midi: 64, at: CAL_START + 0.3 + 0.12 + (i + 4) * 0.75, dur: 0.5 })),
].map((n) => ({ vel: 0.7, ...n }));
const calWav = wav(tmp('cal'), calNotes, CAL_START + 12 * 0.75 + 3);

// 2) Ode to Joy, aligned to the lesson's count-in (4 beats at 80 BPM + transport lead).
const ode = JSON.parse(readFileSync('src/content/levels/noob/09.json', 'utf8'));
const beat = 60 / ode.tempo.default;
const LEAD = 3.45;
const odeNotes = expectedNotes(parseLevel(ode)).map((n) => ({ midi: n.midi, at: LEAD + n.beat * beat, dur: n.beats * beat * 0.92, vel: 0.7 }));
const odeWav = wav(tmp('ode'), odeNotes, LEAD + 32 * beat + 2);

// 2c) Chord check: the five chords the Mic test screen asks for, one every 3 s.
const chordNotes = [['C4', 'E4', 'G4'], ['C4', 'F4', 'A4'], ['B3', 'D4', 'G4'], ['A3', 'C4', 'E4'], ['C3', 'E4', 'G4']]
  .flatMap((ch, i) => ch.map((n) => ({ midi: midiOf(n), at: 3.0 + i * 3, dur: 1.2, vel: 0.6 })));
const chordWav = wav(tmp('chords'), chordNotes, 19);

// 3) Scale for the mic test screen.
const scale = [60, 62, 64, 65, 67, 69, 71, 72];
const scaleWav = wav(tmp('scale'), scale.map((midi, i) => ({ midi, at: 1 + i * 0.66, dur: 0.6, vel: 0.7 })), 8);

const server = await createServer({ server: { port: 5183, strictPort: true }, logLevel: 'error' });
await server.listen();
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed = true; };

async function session(file, viewport, settings, calibration) {
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${file}`],
  });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.error('pageerror:', e.message); failed = true; });
  await page.addInitScript(([s, c]) => {
    const req = indexedDB.open('learning-piano', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      const tx = req.result.transaction('kv', 'readwrite');
      if (s) tx.objectStore('kv').put(s, 'settings');
      if (c) tx.objectStore('kv').put(c, 'calibration');
    };
  }, [settings, calibration]);
  return { browser, page };
}
const base = 'http://localhost:5183/learning-piano/';
const shot = (page, name) => page.screenshot({ path: `${outDir}/${name}.png` });

// ---------- calibration ----------
if (!process.env.MIC_ONLY) {
  const { browser, page } = await session(calWav, { width: 390, height: 844 }, null, null);
  await page.goto(`${base}#/calibrate`);
  await page.evaluate(() => document.fonts.ready);
  // Record detections so the timing step can be lined up with the fake audio file.
  await page.evaluate(async () => {
    window.__notes = [];
    const m = await import('/learning-piano/src/audio/mic.js');
    m.onNote((e) => window.__notes.push(e));
  });
  await shot(page, 'cal-1-setup');
  await page.click('[data-go]');
  const t0 = Date.now();
  const at = (s) => page.waitForTimeout(Math.max(0, t0 + s * 1000 - Date.now()));
  await at(1.6); await shot(page, 'cal-2-room');
  await page.waitForSelector('[data-next]:visible', { timeout: 8000 });
  await at(3.6); await page.click('[data-next]');
  await page.waitForSelector('[data-ok]:not([disabled])', { timeout: 6000 });
  const low = await page.textContent('[data-out]');
  check(low === 'C2', `calibration heard lowest key C2 (got ${low})`);
  await shot(page, 'cal-3-lowest');
  await page.click('[data-ok]');
  await page.waitForSelector('[data-ok]:not([disabled])', { timeout: 6000 });
  const high = await page.textContent('[data-out]');
  check(high === 'C7', `calibration heard highest key C7 (got ${high})`);
  await shot(page, 'cal-4-highest');
  await page.click('[data-ok]');
  await page.waitForSelector('[data-next]:visible', { timeout: 8000 });
  const lvl = await page.textContent('[data-out]');
  check(/Great|OK/.test(lvl), `level check passed (got ${lvl})`);
  await shot(page, 'cal-5-level');
  await page.click('[data-next]');
  // The 3rd middle C sits at 10.0 s in the file: use it to find the file's start on the page clock.
  await page.evaluate(([start]) => {
    const cs = window.__notes.filter((n) => n.midi === 60);
    const zero = cs[2].perf - 10.0 * 1000;
    setTimeout(() => document.querySelector('[data-start]').click(), zero + start * 1000 - performance.now());
  }, [CAL_START]);
  await page.waitForTimeout(5000); await shot(page, 'cal-6-timing');
  await page.waitForSelector('[data-btns]:visible [data-next]', { timeout: 15000 });
  const lat = await page.textContent('[data-out]');
  check(/ms/.test(lat), `timing measured a delay (got ${lat})`);
  await shot(page, 'cal-7-timing-result');
  await page.click('[data-next]');
  await page.waitForSelector('.calib__sum');
  await shot(page, 'cal-8-done');
  await browser.close();
}

// ---------- mic test screen ----------
if (!process.env.MIC_ONLY) {
  const { browser, page } = await session(scaleWav, { width: 390, height: 844 }, null, { noiseDb: -62, low: 36, high: 96, micLatencyMs: 120, spreadMs: 10, at: 1 });
  await page.goto(`${base}#/mictest`);
  await page.click('[data-start]');
  await page.waitForTimeout(7000);
  const heard = await page.$$eval('[data-hist] li', (l) => l.map((x) => x.textContent).reverse());
  check(heard.join() === 'C4,D4,E4,F4,G4,A4,B4,C5', `mic test heard the C major scale (got ${heard.join(' ')})`);
  await shot(page, 'mictest');
  await browser.close();
}

// ---------- scored lesson through the mic ----------
if (!process.env.MIC_ONLY) {
  const settings = { metronome: true, sfx: true, inputMode: 'mic', introsSeen: ['noob-09'] };
  const { browser, page } = await session(odeWav, { width: 844, height: 390 }, settings, { noiseDb: -60, low: 36, high: 96, micLatencyMs: 170, spreadMs: 10, at: 1 });
  await page.goto(`${base}#/lesson/noob-09`);
  await page.waitForFunction(() => document.querySelector('[data-act="go"]') && !document.querySelector('[data-act="go"][disabled]'), null, { timeout: 20000 });
  await shot(page, 'lesson-mic-ready');
  await page.click('[data-act="listen"]');
  await page.click('[data-act="skip"]');
  await page.waitForTimeout(200);
  await page.click('[data-act="go"]');
  await page.waitForTimeout(3450 + 9.3 * beat * 1000);
  await shot(page, 'lesson-mic-play');
  await page.waitForSelector('.results', { timeout: 40000 });
  const acc = Number((await page.textContent('.results__big')).replace(/\D/g, ''));
  check(acc >= 95, `scored Ode to Joy through the mic at ${acc}%`);
  await shot(page, 'lesson-mic-results');
  await browser.close();
}

// ---------- chord check on the mic test screen ----------
if (!process.env.MIC_ONLY) {
  const { browser, page } = await session(chordWav, { width: 390, height: 844 }, null, { noiseDb: -62, low: 36, high: 96, micLatencyMs: 120, spreadMs: 10, at: 1 });
  await page.goto(`${base}#/mictest`);
  await page.click('[data-two-start]');
  await page.waitForTimeout(4300);
  await page.locator('[data-two]').scrollIntoViewIfNeeded();
  await shot(page, 'mictest-chord-heard');
  await page.waitForSelector('.twokey__done', { timeout: 30000 });
  const score = await page.textContent('.twokey__done b');
  check(score === '5/5', `chord check heard every chord (${score})`);
  if (score !== '5/5') console.log(JSON.stringify(await page.evaluate(() => window.__chordLog)));
  await shot(page, 'mictest-chord-done');
  await browser.close();
}

// ---------- two hands and chords through the mic (Phase 7) ----------
async function micLesson(id, file, minAcc, extra = async () => {}, { mutate = (n) => n, maxAcc = 100, tag = '' } = {}) {
  if (process.env.MIC_ONLY && !process.env.MIC_ONLY.split(',').includes(id + tag)) return;
  const lvl = JSON.parse(readFileSync(file, 'utf8'));
  const pulse = lvl.time?.endsWith('/8') && Number(lvl.time.split('/')[0]) % 3 === 0 && Number(lvl.time.split('/')[0]) > 3 ? 1.5 : 4 / Number((lvl.time || '4/4').split('/')[1]);
  const beatSec = 60 / (lvl.tempo.default * pulse);
  const bar = (() => { const [n, d] = (lvl.time || '4/4').split('/').map(Number); return (n * 4) / d; })();
  const lead = 0.45 + bar * beatSec;
  const parsed = parseLevel(lvl);
  const ns = expectedNotes(parsed).map(mutate).filter(Boolean).map((n) => ({ midi: n.midi, at: lead + n.beat * beatSec, dur: Math.max(0.12, n.beats * beatSec * 0.92), vel: n.part === 'lh' ? 0.5 : 0.65 }));
  const f = wav(tmp(id + tag), ns, lead + parsed.totalBeats * beatSec + 2);
  const settings = { metronome: true, sfx: true, inputMode: 'mic', introsSeen: [id] };
  const { browser, page } = await session(f, { width: 844, height: 390 }, settings, { noiseDb: -60, low: 36, high: 96, micLatencyMs: 170, spreadMs: 10, at: 1 });
  await page.goto(`${base}#/lesson/${id}`);
  await page.waitForFunction(() => document.querySelector('[data-act="go"]') && !document.querySelector('[data-act="go"][disabled]'), null, { timeout: 20000 });
  if (await page.locator('[data-act="listen"]:visible').count()) {
    await page.click('[data-act="listen"]');
    await page.click('[data-act="skip"]');
    await page.waitForTimeout(200);
  }
  await page.click('[data-act="go"]');
  await page.waitForSelector('.results', { timeout: 300000 });
  const acc = Number((await page.textContent('.results__big')).replace(/\D/g, ''));
  check(acc >= minAcc && acc <= maxAcc, `${id}${tag} through the mic: ${acc}% (want ${minAcc}–${maxAcc})`);
  if (acc < minAcc || acc > maxAcc) {
    console.log('  missed:', await page.evaluate(() => window.__lesson.run.scorer.summary().missed.map((n) => `${n.midi}@${Math.round(n.time)}`).join(' ')));
  }
  await extra(page);
  await shot(page, `lesson-mic-${id}${tag}`);
  await browser.close();
}

// Find-the-key drill (Noob 1). Each C is held into the next prompt, then let go with
// its octave overtone lingering for a moment, as a released key can: the detector
// names that as a new note, but only a real strike may answer a prompt.
if (!process.env.MIC_ONLY || process.env.MIC_ONLY.split(',').includes('noob-01')) {
  const lvl = JSON.parse(readFileSync('src/content/levels/noob/01.json', 'utf8'));
  const notes = lvl.prompts.map((name, i) => ({ midi: midiOf(name), at: 2.5 + i * 2.2, dur: 1.7, vel: 0.7 }));
  // The note's 2nd partial goes on ringing after the key is let go (same level as
  // in the synth's note at that moment, decaying over ~0.35 s).
  const overtoneTail = (sig, n) => {
    const tau = 0.35 + 1.4 * Math.max(0, (84 - n.midi) / 48);
    const amp = (0.25 * n.vel * Math.exp(-n.dur / tau)) / 2 ** 0.9;
    const f = 2 * 440 * 2 ** ((n.midi - 69) / 12) * (1 + 0.0016);
    const at = n.at + n.dur;
    for (let i = Math.floor(at * SR); i < sig.length; i++) { const t = i / SR - at; sig[i] += amp * Math.exp(-t / 0.35) * Math.sin(2 * Math.PI * f * (t + n.dur)); }
  };
  const f = wav(tmp('drill'), notes, 2.5 + notes.length * 2.2 + 2, (sig) => notes.forEach((n) => overtoneTail(sig, n)));
  const settings = { metronome: true, sfx: true, inputMode: 'mic', introsSeen: ['noob-01'] };
  const { browser, page } = await session(f, { width: 844, height: 390 }, settings, { noiseDb: -60, low: 36, high: 96, micLatencyMs: 170, spreadMs: 10, at: 1 });
  await page.goto(`${base}#/lesson/noob-01`);
  await page.waitForFunction(() => document.querySelector('[data-act="go"]') && !document.querySelector('[data-act="go"][disabled]'), null, { timeout: 20000 });
  await page.click('[data-act="go"]');
  await page.waitForSelector('.results', { timeout: 60000 });
  const acc = Number((await page.textContent('.results__big')).replace(/\D/g, ''));
  check(acc === 100, `noob-01 find-the-C drill: released keys don't answer the next prompt (${acc}%)`);
  await shot(page, 'drill-mic-noob-01');
  await browser.close();
}

await micLesson('intermediate-01', 'src/content/levels/intermediate/01.json', 90, async (page) => {
  const note = await page.textContent('.results__mic').catch(() => '');
  check(/weren't scored/.test(note), `results explain the unscored octave notes (${note.slice(0, 30)})`);
});
await micLesson('intermediate-12', 'src/content/levels/intermediate/12.json', 90);
await micLesson('intermediate-15', 'src/content/levels/intermediate/15.json', 85);
await micLesson('advanced-01', 'src/content/levels/advanced/01.json', 85);
// Wrong notes must not score: the right hand plays every chord's top note a key too high…
await micLesson('advanced-01', 'src/content/levels/advanced/01.json', 0, undefined, {
  tag: '-wrong-top', maxAcc: 30,
  mutate: (n, i, all) => (n.part === 'rh' && !all.some((o) => o.beat === n.beat && o.part === 'rh' && o.midi > n.midi) ? { ...n, midi: n.midi + 1 } : n),
});
// …and only the left hand plays the parallel-motion level.
{
  // The left-hand notes are real hits; no right-hand note may be credited.
  const scored = micScoring(expectedNotes(parseLevel(JSON.parse(readFileSync('src/content/levels/intermediate/02.json', 'utf8'))))).scored;
  const lhShare = Math.round((100 * scored.filter((n) => n.part === 'lh').length) / scored.length);
  await micLesson('intermediate-02', 'src/content/levels/intermediate/02.json', 0, undefined, { tag: '-left-only', maxAcc: lhShare + 3, mutate: (n) => (n.part === 'lh' ? n : null) });
}

await server.close();
process.exit(failed ? 1 : 0);
