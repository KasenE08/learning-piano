// Builds must be fully usable offline after one visit. Serves dist/ with
// `vite preview`, lets the service worker install, then goes offline and
// reloads every screen, including the lazily loaded notation engine.
import { preview } from 'vite';
import { chromium } from 'playwright';

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'error' });
const url = 'http://localhost:4179/learning-piano/';
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
let failed = false;
page.on('pageerror', (e) => { failed = true; console.error('pageerror:', e.message); });

await page.goto(url);
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready.then(() => true), null, { timeout: 15000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });

await ctx.setOffline(true);
const checks = [
  ['#/', '.hero'],
  ['#/map', '.stop--current'],
  ['#/songs', '.songlist'],
  ['#/you', '.rows'],
];
for (const [hash, sel] of checks) {
  await page.goto(url + hash);
  await page.reload();
  const ok = await page.locator(sel).count();
  console.log(`${ok ? 'PASS' : 'FAIL'} offline ${hash}`);
  if (!ok) failed = true;
}
await page.setViewportSize({ width: 844, height: 390 });
await page.goto(url + '#/lesson/noob-02');
await page.reload();
const staff = await page.locator('.score__strip svg').waitFor({ timeout: 10000 }).then(() => true, () => false);
console.log(`${staff ? 'PASS' : 'FAIL'} offline lesson + VexFlow score`);
if (!staff) failed = true;
const piano = await page.locator('[data-act="go"]:not([disabled]), .intro').first().waitFor({ timeout: 15000 }).then(() => true, () => false);
const samples = await page.evaluate(async (u) => {
  const r = await Promise.all(['C4', 'Fs3', 'A5'].map((n) => fetch(`${u}samples/piano/${n}.mp3`).then((x) => x.ok && x.headers.get('content-length') !== '0', () => false)));
  return r.every(Boolean);
}, url);
console.log(`${piano && samples ? 'PASS' : 'FAIL'} offline piano samples + Tone.js`);
if (!piano || !samples) failed = true;

await browser.close();
server.httpServer.close();
process.exit(failed ? 1 : 0);
