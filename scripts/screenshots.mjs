// Screenshots at iPhone viewports: portrait 390×844, landscape 844×390.
// Usage: npm run shots -- <outDir> [name ...]   (defaults to screenshots/)
// Uses the Vite dev server; ?demo loads sample mid-course progress.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'node:fs';

const [outDir = 'screenshots', ...only] = process.argv.slice(2);
const P = { width: 390, height: 844 };
const L = { width: 844, height: 390 };
const SEEN = [...['noob', 'beginner', 'intermediate', 'advanced'].flatMap((s) => [...Array.from({ length: 15 }, (_, i) => `${s}-${String(i + 1).padStart(2, '0')}`), `${s}-test`]), ...readdirSync('src/content/songs').map((f) => `song-${f.replace('.json', '')}`)];

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
  // Phase 4 — gamification
  { name: 'p4-combo-tier', path: '#/lesson/noob-09', vp: L, heard: true, steps: [['click', '[data-act="go"]'], ['play', [], []], ['wait', 3200 + 9.2 * 750]] },
  { name: 'p4-results-xp', path: '#/lesson/noob-02', vp: L, fresh: true, heard: true, steps: [['click', '[data-act="go"]'], ['play', [], []], ['waitFor', '.results'], ['wait', 1250], ['shot', 'p4-results-stars'], ['wait', 900], ['shot', 'p4-level-up'], ['wait', 2000], ['shot', 'p4-unlock-toast'], ['goto', '#/map'], ['wait', 900], ['shot', 'p4-map-new'], ['goto', '#/'], ['wait', 500]] },
  { name: 'p4-song', path: '#/lesson/song-hot-cross-buns', vp: L, demo: true },
  { name: 'p4-songs', path: '#/songs', vp: P, demo: true },
  { name: 'p4-test-ready', path: '#/lesson/noob-test', vp: L },
  { name: 'p4-you', path: '#/you', vp: P, demo: true, steps: [['scroll', '[data-import]'], ['wait', 300]] },
  { name: 'p4-import', path: '#/you', vp: P, demo: true, steps: [['upload', '[data-file]'], ['wait', 600]] },
  // Phase 5 — content
  { name: 'p5-noob01-intro', path: '#/lesson/noob-01', vp: L, seen: false, steps: [['click', '[data-act="next"]'], ['click', '[data-act="next"]'], ['wait', 300]] },
  { name: 'p5-noob01-drill', path: '#/lesson/noob-01', vp: L, steps: [['click', '[data-act="go"]'], ['wait', 400], ['press', 60], ['wait', 700], ['press', 60], ['wait', 300]] },
  { name: 'p5-noob11-drill', path: '#/lesson/noob-11', vp: L, steps: [['click', '[data-act="go"]'], ['wait', 400], ['press', 64], ['wait', 700], ['press', 69], ['wait', 300]] },
  { name: 'p5-noob03-intro', path: '#/lesson/noob-03', vp: L, seen: false, steps: [['click', '[data-act="next"]'], ['wait', 400]] },
  { name: 'p5-noob12-repeat', path: '#/lesson/noob-12', vp: L },
  { name: 'p5-noob14-intro', path: '#/lesson/noob-14', vp: L, seen: false, steps: [['click', '[data-act="next"]'], ['wait', 400]] },
  { name: 'p5-b01-intro', path: '#/lesson/beginner-01', vp: L, seen: false, steps: [['click', '[data-act="next"]'], ['click', '[data-act="next"]'], ['wait', 400]] },
  { name: 'p5-b04-drill', path: '#/lesson/beginner-04', vp: L, steps: [['click', '[data-act="go"]'], ['wait', 500]] },
  { name: 'p5-b06-eighths', path: '#/lesson/beginner-06', vp: L },
  { name: 'p5-b07-threefour', path: '#/lesson/beginner-07', vp: L },
  { name: 'p5-b09-gmajor', path: '#/lesson/beginner-09', vp: L },
  { name: 'p5-b12-auralee', path: '#/lesson/beginner-12', vp: L, heard: true, steps: [['click', '[data-act="go"]'], ['play', [], []], ['wait', 3200 + 17 * 714]] },
  { name: 'p5-b14-sightread', path: '#/lesson/beginner-14', vp: L },
  { name: 'p5-b15-grace', path: '#/lesson/beginner-15', vp: L },
  { name: 'p5-btest', path: '#/lesson/beginner-test', vp: L },
  { name: 'p5-song-jingle', path: '#/lesson/song-jingle-bells', vp: L },
  // Phase 6 — intermediate, advanced, songs
  { name: 'p6-i01-mic-ready', path: '#/lesson/intermediate-01', vp: L, mic: true },
  { name: 'p6-i04-drill', path: '#/lesson/intermediate-04', vp: L, steps: [['click', '[data-act="go"]'], ['wait', 500]] },
  { name: 'p6-i05-accidentals', path: '#/lesson/intermediate-05', vp: L, steps: [['beat', 3.5]] },
  { name: 'p6-i12-chords', path: '#/lesson/intermediate-12', vp: L, steps: [['beat', 1.5]] },
  { name: 'p6-i13-dynamics', path: '#/lesson/intermediate-13', vp: L, steps: [['beat', 15.5]] },
  { name: 'p6-i15-fur-elise', path: '#/lesson/intermediate-15', vp: L, steps: [['beat', 24]] },
  { name: 'p6-a07-triplets', path: '#/lesson/advanced-07', vp: L, steps: [['beat', 3.5]] },
  { name: 'p6-a09-six-eight', path: '#/lesson/advanced-09', vp: L, steps: [['beat', 2.5]] },
  { name: 'p6-a10-sightread', path: '#/lesson/advanced-10', vp: L },
  { name: 'p6-a11-8va', path: '#/lesson/advanced-11', vp: L, steps: [['click', '[data-act="listen"]'], ['wait', 3300 + 12.6 * 790]] },
  { name: 'p6-a13-prelude', path: '#/lesson/advanced-13', vp: L, steps: [['beat', 3.5]] },
  { name: 'p6-a15-capstone', path: '#/lesson/advanced-15', vp: L, seen: false, steps: [['click', '[data-act="next"]'], ['click', '[data-act="next"]'], ['wait', 300]] },
  { name: 'p6-practice', path: '#/lesson/intermediate-14', vp: L, steps: [['click', '[data-act="mode"]'], ['click', '[data-bar="from"][data-d="1"]'], ['click', '[data-bar="from"][data-d="1"]'], ['click', '[data-bar="from"][data-d="1"]'], ['click', '[data-bar="to"][data-d="-1"]'], ['click', '[data-act="loop"]'], ['wait', 300]] },
  { name: 'p6-loop', path: '#/lesson/intermediate-14', vp: L, steps: [['click', '[data-act="mode"]'], ['click', '[data-act="loop"]'], ['click', '[data-hand="rh"]'], ['click', '[data-act="go"]'], ['play', [], []], ['wait', 3000]] },
  { name: 'p6-clair-clef', path: '#/lesson/song-clair-de-lune', vp: L, steps: [['beat', 34]] },
  { name: 'p6-song-canon', path: '#/lesson/song-canon-in-d', vp: L, steps: [['beat', 50]] },
  { name: 'p6-song-entertainer', path: '#/lesson/song-the-entertainer', vp: L, steps: [['beat', 9]] },
  { name: 'p6-map-advanced', path: '#/map/advanced', vp: P, demo: true },
  { name: 'p6-songs', path: '#/songs', vp: P, demo: true, steps: [['scroll', '.songlist li:nth-child(10)'], ['wait', 300]] },
  // Phase 7 — chords
  { name: 'p7-i12-mic-ready', path: '#/lesson/intermediate-12', vp: L, mic: true },
  { name: 'p7-a01-mic-ready', path: '#/lesson/advanced-01', vp: L, mic: true },
  { name: 'p7-i02-tenths', path: '#/lesson/intermediate-02', vp: L, steps: [['beat', 3.5]] },
  { name: 'p7-mictest', path: '#/mictest', vp: P, steps: [['scroll', '[data-two]'], ['wait', 300]] },
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
  if (s.fresh) {
    // Start from a brand-new player who has cleared level 1 (so level 2 is the next one).
    await page.addInitScript(() => {
      const req = indexedDB.open('learning-piano', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ version: 1, xp: 95, levels: { 'noob-01': { stars: 3, best: 98, attempts: 1 } }, tests: {}, songs: {}, fresh: [] }, 'progress');
      };
    });
  }
  if (s.seen !== false) {
    await page.addInitScript(([seen, mic]) => {
      const req = indexedDB.open('learning-piano', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put({ metronome: true, sfx: true, inputMode: mic ? 'mic' : 'tap', introsSeen: seen }, 'settings');
        if (mic) tx.objectStore('kv').put({ noiseDb: -60, low: 36, high: 96, micLatencyMs: 120, spreadMs: 10, at: 1 }, 'calibration');
      };
    }, [SEEN, !!s.mic]);
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
    if (act === 'shot') { await page.screenshot({ path: `${outDir}/${a}.png` }); console.log('shot', a); }
    if (act === 'goto') {
      if (s.vp === L) await page.setViewportSize(P);
      await page.evaluate((h) => { location.hash = h; }, a);
    }
    if (act === 'press') {
      const box = await page.locator(`.kb__key[data-midi="${a}"]`).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 14);
      await page.mouse.down();
      await page.mouse.up();
    }
    if (act === 'beat') { await page.evaluate((b) => window.__lesson.score.setBeat(b), a); await page.waitForTimeout(150); }
    if (act === 'scroll') await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), a);
    if (act === 'upload') {
      const backup = { app: 'learning-piano', version: 1, exportedAt: '2026-10-01T10:00:00Z', progress: { version: 1, xp: 2600, levels: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`noob-${String(i + 1).padStart(2, '0')}`, { stars: 3, best: 97, attempts: 2 }])), tests: { noob: { passed: true, best: 92, attempts: 1 } }, songs: {} }, settings: { metronome: true }, calibration: null };
      await page.setInputFiles(a, { name: 'learning-piano-backup-2026-10-01.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    }
  }
  await page.screenshot({ path: `${outDir}/${s.name}.png` });
  console.log('shot', s.name);
  await ctx.close();
}
await browser.close();
await server.close();
