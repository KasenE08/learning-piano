// Screenshots at iPhone viewports: portrait 390×844, landscape 844×390.
// Usage: npm run shots -- <outDir> [name ...]   (defaults to screenshots/)
// Uses the Vite dev server; ?demo loads sample mid-course progress.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [outDir = 'screenshots', ...only] = process.argv.slice(2);
const P = { width: 390, height: 844 };
const L = { width: 844, height: 390 };
const SEEN = ['noob-01', 'noob-02', 'noob-03', 'noob-04', 'noob-05', 'noob-09', 'beginner-13', 'intermediate-01'];

// Taps every expected note on time, except the ones listed in `skip` (by index).
const playAlong = (skip = [], wrongAt = []) => {
  const L = window.__lesson;
  const go = () => {
    const run = L.run;
    if (!run?.perfBeat0) return setTimeout(go, 20);
    const ms = run.msPerBeat;
    L.notes.forEach((n, i) => {
      if (skip.includes(i)) return;
      const at = run.perfBeat0 + n.beat * ms + (i % 3 === 1 ? 70 : 0) - performance.now();
      setTimeout(() => {
        const k = document.querySelector(`.kb__key[data-midi="${wrongAt.includes(i) ? n.midi + 2 : n.midi}"]`);
        if (!k) return;
        const r = k.getBoundingClientRect();
        const opts = { bubbles: true, pointerId: 7 + i, clientX: r.left + r.width / 2, clientY: r.bottom - 12, isPrimary: true };
        k.dispatchEvent(new PointerEvent('pointerdown', opts));
        setTimeout(() => k.dispatchEvent(new PointerEvent('pointerup', opts)), 120);
      }, Math.max(0, at));
    });
  };
  go();
};

const SHOTS = [
  { name: 'home', path: '#/', vp: P, demo: true },
  { name: 'map', path: '#/map', vp: P, demo: true },
  { name: 'lesson-intro', path: '#/lesson/noob-03', vp: L, seen: false },
  { name: 'lesson-ready', path: '#/lesson/noob-09', vp: L },
  { name: 'lesson-practice', path: '#/lesson/noob-09', vp: L, steps: [['click', '[data-act="mode"]']] },
  { name: 'lesson-listen', path: '#/lesson/noob-09', vp: L, steps: [['click', '[data-act="listen"]'], ['wait', 4300]] },
  { name: 'lesson-countin', path: '#/lesson/noob-09', vp: L, heard: true, steps: [['click', '[data-act="go"]'], ['wait', 1500]] },
  { name: 'lesson-play', path: '#/lesson/noob-09', vp: L, heard: true, steps: [['click', '[data-act="go"]'], ['play', [5], [9]], ['wait', 3000 + 7.4 * 750]] },
  { name: 'lesson-results', path: '#/lesson/noob-09', vp: L, heard: true, steps: [['click', '[data-act="go"]'], ['play', [5, 17], [9]], ['waitFor', '.results'], ['wait', 300]] },
  { name: 'lesson-grand', path: '#/lesson/beginner-13', vp: L },
  { name: 'lesson-hands-together', path: '#/lesson/intermediate-01', vp: L, heard: true, steps: [['click', '[data-act="go"]'], ['play', [], []], ['wait', 3333 + 5.3 * 833]] },
  { name: 'lesson-soon', path: '#/lesson/noob-06', vp: L },
];

mkdirSync(outDir, { recursive: true });
const server = await createServer({ server: { port: 5179, strictPort: true }, logLevel: 'error' });
await server.listen();
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });

for (const s of SHOTS.filter((x) => !only.length || only.includes(x.name))) {
  const ctx = await browser.newContext({ viewport: s.vp, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${s.name}] pageerror:`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`[${s.name}] console:`, m.text()); });
  if (s.seen !== false) {
    await page.addInitScript((seen) => {
      const req = indexedDB.open('learning-piano', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ metronome: true, sfx: true, introsSeen: seen }, 'settings');
      };
    }, SEEN);
  }
  await page.goto(`http://localhost:5179/learning-piano/${s.demo ? '?demo' : ''}${s.path}`);
  await page.waitForSelector('#app > *');
  await page.evaluate(() => document.fonts.ready);
  if (s.vp === L && s.path.includes('lesson')) {
    await page.waitForSelector('.panel .card, .panel .results', { timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector('[data-act="go"][disabled]'), null, { timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(600);
  if (s.heard) {
    // Skip the automatic listen-through so we land straight in the count-in.
    await page.click('[data-act="listen"]');
    await page.click('[data-act="skip"]');
    await page.waitForTimeout(200);
  }
  for (const [act, a, b] of s.steps || []) {
    if (act === 'click') await page.click(a);
    if (act === 'wait') await page.waitForTimeout(a);
    if (act === 'waitFor') await page.waitForSelector(a, { timeout: 30000 });
    if (act === 'play') await page.evaluate(`(${playAlong})(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
  }
  await page.screenshot({ path: `${outDir}/${s.name}.png` });
  console.log('shot', s.name);
  await ctx.close();
}
await browser.close();
await server.close();
