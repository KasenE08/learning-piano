// Renders the app icon SVG to the PNG sizes the manifest and iOS need.
import { chromium } from 'playwright';


const keys = (scale) => `
  <g transform="translate(${50 - 30 * scale} ${50 - 28 * scale}) scale(${scale})">
    <rect x="0" y="0" width="18.5" height="56" rx="3" fill="#f2f2f2"/>
    <rect x="21.5" y="0" width="17" height="56" rx="3" fill="#f2f2f2"/>
    <rect x="41.5" y="0" width="18.5" height="56" rx="3" fill="#f2f2f2"/>
    <rect x="12" y="0" width="12" height="33" rx="2" fill="#000"/>
    <rect x="36" y="0" width="12" height="33" rx="2" fill="#000"/>
  </g>`;
// Full-bleed square (iOS rounds corners itself), soft spotlight like the app's stage.
const icon = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><radialGradient id="s" cx="50%" cy="20%" r="80%"><stop offset="0" stop-color="#2a2a2a"/><stop offset="0.6" stop-color="#000"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#s)"/>${keys(scale)}</svg>`;

const out = [
  ['public/icons/icon-192.png', 192, 1],
  ['public/icons/icon-512.png', 512, 1],
  ['public/icons/apple-touch-icon.png', 180, 1],
  ['public/icons/icon-maskable-512.png', 512, 0.72],
];
const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe });
for (const [path, size, scale] of out) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${icon(scale).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path, omitBackground: false });
  await page.close();
  console.log('wrote', path);
}
await browser.close();
