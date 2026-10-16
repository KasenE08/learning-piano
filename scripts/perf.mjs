// Rough phone-speed check: CPU throttled 4×, measures how long a lesson takes to
// get ready (score engraved) and how smooth play is (frame times while scrolling).
// Usage: node scripts/perf.mjs [lesson-id ...]
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['advanced-13', 'song-clair-de-lune', 'song-swan-lake', 'song-the-entertainer', 'intermediate-15', 'noob-09'];
// PERF_PROD=1 measures the production build (run `npm run build` first) instead of the dev server.
const prod = !!process.env.PERF_PROD;
const server = prod
  ? await preview({ preview: { port: 5187, strictPort: true }, logLevel: 'error' })
  : await createServer({ server: { port: 5187, strictPort: true }, logLevel: 'error' });
if (!prod) await server.listen();
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
// Warm Vite's module cache so dev compilation doesn't count.
{ const p = await browser.newPage(); await p.goto('http://localhost:5187/learning-piano/#/lesson/noob-02'); await p.waitForSelector('.score__strip svg', { timeout: 60000 }); await p.close(); }
for (const id of ids) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await page.addInitScript((lid) => {
    const req = indexedDB.open('learning-piano', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => req.result.transaction('kv', 'readwrite').objectStore('kv').put({ metronome: false, sfx: false, inputMode: 'tap', introsSeen: [lid] }, 'settings');
  }, id);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto(`http://localhost:5187/learning-piano/#/lesson/${id}`);
  await page.waitForSelector('.score__strip svg', { timeout: 60000 });
  const ready = Date.now() - t0;
  const nodes = await page.evaluate(() => document.querySelectorAll('.score__strip svg *').length);
  // Simulate playing: scroll through the score for 6 s and record frame gaps.
  const frames = await page.evaluate(() => new Promise((resolve) => {
    const L = window.__lesson;
    if (!L) { resolve([]); return; } // production builds don't expose the lesson
    const gaps = [];
    let last = performance.now();
    const start = last;
    const tick = (t) => {
      gaps.push(t - last);
      last = t;
      L.score.setBeat(((t - start) / 1000) * 2);
      if (t - start < 6000) requestAnimationFrame(tick); else resolve(gaps.slice(1));
    };
    requestAnimationFrame(tick);
  }));
  frames.sort((a, b) => a - b);
  const smooth = frames.length ? ` · frames p95 ${frames[Math.floor(frames.length * 0.95)].toFixed(1)} ms · ${frames.filter((g) => g > 50).length} long (>50 ms) of ${frames.length}` : '';
  console.log(`${id.padEnd(22)} ready ${String(ready).padStart(5)} ms · ${nodes} svg nodes${smooth}`);
  await ctx.close();
}
await browser.close();
await server.close();
