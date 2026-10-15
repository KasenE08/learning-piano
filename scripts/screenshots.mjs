// Screenshots at iPhone viewports: portrait 390×844, landscape 844×390.
// Usage: npm run shots -- <outDir> [name ...]   (defaults to screenshots/)
// Uses the Vite dev server with ?demo so screens show a mid-course player.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [outDir = 'screenshots', ...only] = process.argv.slice(2);
const P = { width: 390, height: 844 };
const L = { width: 844, height: 390 };

const SHOTS = [
  { name: 'home-new', path: '#/', vp: P },
  { name: 'home', path: '#/', vp: P, demo: true },
  { name: 'map', path: '#/map', vp: P, demo: true },
  { name: 'map-sheet', path: '#/map', vp: P, demo: true, tap: '.stop.is-done[data-level="noob-07"] .stop__main' },
  { name: 'map-locked', path: '#/map/beginner', vp: P, demo: true },
  { name: 'songs', path: '#/songs', vp: P, demo: true },
  { name: 'you', path: '#/you', vp: P, demo: true },
  { name: 'lesson', path: '#/lesson/noob-09', vp: L, demo: true },
  { name: 'lesson-grand', path: '#/lesson/beginner-13', vp: L, demo: true, press: 64 },
  { name: 'rotate-to-landscape', path: '#/lesson/noob-09', vp: P, demo: true },
  { name: 'rotate-to-portrait', path: '#/map', vp: L, demo: true },
];

mkdirSync(outDir, { recursive: true });
const server = await createServer({ server: { port: 5179, strictPort: true }, logLevel: 'error' });
await server.listen();
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });

for (const s of SHOTS.filter((x) => !only.length || only.includes(x.name))) {
  const ctx = await browser.newContext({ viewport: s.vp, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${s.name}] pageerror:`, e.message));
  await page.goto(`http://localhost:5179/learning-piano/${s.demo ? '?demo' : ''}${s.path}`);
  await page.waitForSelector('#app > *');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(s.vp === L ? 1200 : 400);
  if (s.tap) { await page.click(s.tap); await page.waitForTimeout(450); }
  if (s.press) {
    const box = await page.locator(`.kb__key[data-midi="${s.press}"]`).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: `${outDir}/${s.name}.png` });
  console.log('shot', s.name);
  await ctx.close();
}
await browser.close();
await server.close();
