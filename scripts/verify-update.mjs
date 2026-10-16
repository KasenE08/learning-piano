// A new deploy must reach an installed app without a reinstall: build v1 and
// install it, publish v2 to the same place, then check the app offers
// "New version ready", and that Update switches to v2 (and nothing reloads by itself).
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const v = (version) => build({ logLevel: 'error', define: { __APP_VERSION__: JSON.stringify(version) } });
await v('test-1');
const server = await preview({ preview: { port: 4181, strictPort: true }, logLevel: 'error' });
const url = 'http://localhost:4181/learning-piano/';
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
let failed = false;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed = true; };
const version = () => page.evaluate(() => document.querySelector('.about.muted')?.textContent || '');

await page.goto(url + '#/you');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
check((await version()).includes('test-1'), `v1 installed (${await version()})`);

await v('test-2'); // publish the new version
// Coming back to the app triggers an update check.
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const toast = await page.waitForSelector('.update-toast', { timeout: 20000 }).then(() => true, () => false);
check(toast, 'the app offers the new version');
check((await version()).includes('test-1'), 'and keeps running the old one until asked');
if (toast) {
  await page.click('[data-update]');
  await page.waitForFunction(() => document.querySelector('.about.muted')?.textContent.includes('test-2'), null, { timeout: 20000 }).catch(() => {});
  check((await version()).includes('test-2'), `Update switches to v2 (${await version()})`);
}
await browser.close();
await server.close();
await v(process.env.npm_package_version || '0.1.0'); // leave a normal build behind
process.exit(failed ? 1 : 0);
