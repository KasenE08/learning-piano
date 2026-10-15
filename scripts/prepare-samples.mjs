// One-off: turns Salamander Grand Piano V3 samples (CC-BY 3.0, Alexander Holm;
// npm package @audio-samples/piano-mp3-velocity12) into small, app-ready mp3s:
// every third note A1–C8, trimmed to 5 s with a fade, mono 96 kbps.
// Usage: node scripts/prepare-samples.mjs <path to package>/audio
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('pass the sample package audio/ directory');
const out = 'public/samples/piano';
mkdirSync(out, { recursive: true });
const names = [];
for (let o = 1; o <= 8; o++) for (const n of ['C', 'D#', 'F#', 'A']) names.push(`${n}${o}`);
const wanted = names.filter((n) => {
  const order = ['C', 'D#', 'F#', 'A'];
  const midi = (Number(n.slice(-1)) + 1) * 12 + [0, 3, 6, 9][order.indexOf(n.slice(0, -1))];
  return midi >= 33 && midi <= 108; // A1 .. C8
});
for (const n of wanted) {
  const file = n.replace('#', 's');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', `${src}/${n}v12.mp3`, '-t', '5', '-af', 'afade=t=out:st=3.6:d=1.4', '-ac', '1', '-b:a', '96k', `${out}/${file}.mp3`]);
  console.log('wrote', file);
}
