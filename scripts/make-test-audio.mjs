// Writes a WAV of synthetic piano notes, used as a fake microphone in browser tests:
//   chromium --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>
// Usage: node scripts/make-test-audio.mjs <out.wav> <bpm> <midi,midi,...> [leadSeconds]
import { writeFileSync } from 'node:fs';
import { render, SR } from '../tests/helpers/synth.js';

const [out = 'test-audio.wav', bpm = '90', list = '60,62,64,65,67,69,71,72', lead = '1'] = process.argv.slice(2);
const beat = 60 / Number(bpm);
const seq = list.split(',').map(Number);
const notes = seq.map((midi, i) => ({ midi, at: Number(lead) + i * beat, dur: beat * 0.9, vel: 0.7 }));
const sig = render({ notes, seconds: Number(lead) + seq.length * beat + 1.5, noiseDb: -64 });
const pcm = Buffer.alloc(44 + sig.length * 2);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + sig.length * 2, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(sig.length * 2, 40);
for (let i = 0; i < sig.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sig[i] * 32767))), 44 + i * 2);
writeFileSync(out, pcm);
console.log(`wrote ${out}: ${seq.length} notes, ${(sig.length / SR).toFixed(1)} s`);
