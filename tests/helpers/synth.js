// Synthetic piano-ish audio for detector tests: harmonic tones with a sharp
// attack and exponential decay, optional weak fundamental, room noise, and
// metronome clicks (high-passed noise bursts like the app's click).
import { createAnalyzer, FRAME_SIZE, HOP_SIZE } from '../../src/audio/analysis.js';
import { createNoteDetector } from '../../src/audio/detector.js';

export const SR = 48000;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

let seed = 1;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 - 0.5; };

/**
 * notes: [{ midi, at (s), dur (s, key held), vel (0..1) }]
 * clicks: [times]   noiseDb: background noise level
 */
export function render({ notes = [], clicks = [], seconds, noiseDb = -60, fundamental = 1, phaseSeed = 7 }) {
  seed = phaseSeed;
  const n = Math.ceil(seconds * SR);
  const y = new Float32Array(n);
  for (const nt of notes) {
    const f0 = mtof(nt.midi);
    const tau = 0.35 + 1.4 * Math.max(0, (84 - nt.midi) / 48); // low notes ring longer
    const s0 = Math.floor(nt.at * SR);
    const rel = Math.floor((nt.at + (nt.dur ?? 0.5)) * SR);
    const end = Math.min(n, rel + Math.floor(0.08 * SR));
    const vel = nt.vel ?? 0.6;
    const harmonics = [];
    for (let k = 1; k <= 10 && f0 * k < 9000; k++) {
      const amp = (k === 1 ? fundamental : 1) / k ** 0.9;
      harmonics.push([2 * Math.PI * f0 * k * (1 + 0.0004 * k * k), amp, (rand() + 0.5) * 6.28]);
    }
    for (let i = s0; i < end; i++) {
      const t = (i - s0) / SR;
      let env = Math.min(1, t / 0.003) * Math.exp(-t / tau);
      if (i > rel) env *= Math.exp(-((i - rel) / SR) / 0.02);
      let v = 0;
      for (const [w, a, ph] of harmonics) v += a * Math.sin(w * t + ph);
      y[i] += 0.25 * vel * env * v;
    }
  }
  // Clicks: 6 ms of noise, crude high-pass (first difference twice).
  for (const c of clicks) {
    const s0 = Math.floor(c * SR);
    let p1 = 0;
    let p2 = 0;
    for (let i = 0; i < 0.006 * SR && s0 + i < n; i++) {
      const w = rand();
      const hp = w - 2 * p1 + p2;
      p2 = p1;
      p1 = w;
      y[s0 + i] += 0.35 * hp * Math.exp(-i / (0.0015 * SR));
    }
  }
  const na = 10 ** (noiseDb / 20) * 1.7;
  for (let i = 0; i < n; i++) y[i] += na * rand();
  return y;
}

/** Runs the analyzer + detector over a signal like the app does (hop by hop). */
export function detect(signal, opts = {}, phase = 0) {
  const an = createAnalyzer(SR);
  const det = createNoteDetector(SR, opts);
  const out = [];
  const frame = new Float32Array(FRAME_SIZE);
  for (let end = FRAME_SIZE + phase; end <= signal.length; end += HOP_SIZE) {
    frame.set(signal.subarray(end - FRAME_SIZE, end));
    const f = an.analyze(frame);
    out.push(...det.push(f, end / SR));
  }
  return out;
}
