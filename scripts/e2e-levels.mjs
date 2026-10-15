// Plays every level of the given sections in Chromium with perfectly timed taps
// (and correct answers for drills) and checks each scores 100%.
// Usage: node scripts/e2e-levels.mjs [section|songs ...]   (default: noob beginner songs)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';

const sections = process.argv.slice(2).length ? process.argv.slice(2) : ['noob', 'beginner', 'songs'];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const ids = sections.flatMap((s) => (s === 'songs' ? readdirSync('src/content/songs').map((f) => `song-${f.replace('.json', '')}`) : readdirSync(`src/content/levels/${s}`).map((f) => `${s}-${f.replace('.json', '')}`))).filter((id) => !only || only.includes(id)).sort();
const server = await createServer({ server: { port: 5185, strictPort: true }, logLevel: 'error' });
await server.listen();
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });

async function playLevel(id) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((lid) => {
    const req = indexedDB.open('learning-piano', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => req.result.transaction('kv', 'readwrite').objectStore('kv').put({ metronome: false, sfx: false, inputMode: 'tap', introsSeen: [lid] }, 'settings');
  }, id);
  await page.goto(`http://localhost:5185/learning-piano/#/lesson/${id}`);
  await page.waitForSelector('[data-act="go"]:not([disabled])', { timeout: 20000 });
  const isDrill = await page.evaluate(() => !!document.querySelector('.drill'));
  if (!isDrill && await page.locator('[data-act="listen"]:visible').count()) {
    await page.click('[data-act="listen"]');
    await page.click('[data-act="skip"]');
    await page.waitForTimeout(150);
  }
  await page.click('[data-act="go"]');
  await page.evaluate((drillMode) => {
    const L = window.__lesson;
    const tap = (midi) => {
      const k = document.querySelector(`.kb__key[data-midi="${midi}"]`);
      if (!k) { console.error('no key', midi); return; }
      const r = k.getBoundingClientRect();
      const o = { bubbles: true, pointerId: Math.floor(Math.random() * 1e6), clientX: r.left + r.width / 2, clientY: r.bottom - 10 };
      k.dispatchEvent(new PointerEvent('pointerdown', o));
      setTimeout(() => k.dispatchEvent(new PointerEvent('pointerup', o)), 60);
    };
    if (drillMode) {
      const step = () => { const d = L.drill; if (!d) return setTimeout(step, 50); if (d.done()) return; tap(d.current.midi); setTimeout(step, 600); };
      setTimeout(step, 300);
      return;
    }
    const go = () => {
      const run = L.run;
      if (!run?.perfBeat0) return setTimeout(go, 20);
      L.notes.forEach((n) => setTimeout(() => tap(n.midi), Math.max(0, run.perfBeat0 + n.beat * run.msPerBeat - performance.now())));
    };
    go();
  }, isDrill);
  await page.waitForSelector('.results', { timeout: 120000 });
  const acc = Number((await page.textContent('.results__big')).replace(/\D/g, ''));
  await ctx.close();
  return { id, acc, errors };
}

let failed = 0;
const queue = [...ids];
const worker = async () => {
  while (queue.length) {
    const id = queue.shift();
    try {
      const r = await playLevel(id);
      const ok = r.acc === 100 && !r.errors.length;
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${r.acc}%${r.errors.length ? ' errors: ' + r.errors.join('; ') : ''}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${id} ${e.message.split('\n')[0]}`);
    }
  }
};
await Promise.all(Array.from({ length: 6 }, worker));
await browser.close();
await server.close();
console.log(`${ids.length - failed}/${ids.length} levels at 100%`);
process.exit(failed ? 1 : 0);
