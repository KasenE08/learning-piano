// Combines screenshots into contact sheets for phase reviews.
// Usage: node scripts/contact-sheet.mjs <dir> <out.png> <landscape|portrait> name1 name2 ...
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [dir, out, kind, ...names] = process.argv.slice(2);
const abs = resolve(dir);
const srv = createServer((q, r) => { try { r.end(readFileSync(abs + decodeURIComponent(q.url))); } catch { r.end(''); } }).listen(8125);
const land = kind === 'landscape';
const [w, h] = land ? [844, 390] : [390, 844];
const cols = land ? 2 : 4;
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const b = await chromium.launch({ executablePath: exe });
const p = await b.newPage({ viewport: { width: cols * (w + 18) + 30, height: 600 }, deviceScaleFactor: 1.5 });
await p.goto('http://localhost:8125/x');
await p.setContent(`<body style="margin:0;background:#161616;padding:16px;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:18px">${names.map((n) => `<div style="color:#aaa;font:13px system-ui"><img src="http://localhost:8125/${n}.png" style="width:${w}px;height:${h}px;border-radius:24px;display:block;margin-bottom:6px">${n}</div>`).join('')}</body>`, { waitUntil: 'load' });
await p.screenshot({ path: out, fullPage: true });
await b.close();
srv.close();
