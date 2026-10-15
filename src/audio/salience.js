// "Did this note just start?" — a targeted check for when the one-pitch
// detector can't name a note because another one is sounding (both hands).
// Instead of asking what the pitch is, we ask whether a specific expected
// note's harmonics got louder at an onset. A long FFT (8192 samples, ~6 Hz
// bins) separates neighbouring semitones from about C3 up.
import FFT from 'fft.js';
import { frequencyOf } from '../core/music.js';

export const PROBE_SIZE = 8192;
const WEIGHTS = [1, 0.6, 0.4, 0.3, 0.2];

export function createSpectrum(sampleRate, size = PROBE_SIZE) {
  const fft = new FFT(size);
  const out = fft.createComplexArray();
  const buf = new Float32Array(size);
  const hann = new Float32Array(size);
  for (let i = 0; i < size; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  const maxBin = Math.min(size / 2 - 1, Math.ceil((5000 * size) / sampleRate));
  return {
    binHz: sampleRate / size,
    /** Magnitude spectrum (to 5 kHz) of `size` samples starting at `start` in `samples`. */
    of(samples, start) {
      for (let i = 0; i < size; i++) buf[i] = (samples[start + i] || 0) * hann[i];
      fft.realTransform(out, buf);
      const mag = new Float32Array(maxBin + 1);
      for (let k = 1; k <= maxBin; k++) mag[k] = Math.hypot(out[2 * k], out[2 * k + 1]);
      return mag;
    },
  };
}

/** Peak magnitude near frequency f (± a quarter semitone, at least ±1 bin). */
function peakNear(mag, binHz, f) {
  const c = f / binHz;
  const w = Math.max(1, c * 0.015);
  let p = 0;
  for (let k = Math.floor(c - w); k <= Math.ceil(c + w); k++) if (k > 0 && k < mag.length) p = Math.max(p, mag[k]);
  return p;
}

/** Weighted harmonic strength of `midi` in a spectrum. */
export function salience(mag, binHz, midi) {
  const f0 = frequencyOf(midi);
  let s = 0;
  WEIGHTS.forEach((w, i) => { if ((i + 1) * f0 < binHz * mag.length) s += w * peakNear(mag, binHz, (i + 1) * f0); });
  return s;
}

/**
 * Is `midi` a new note between spectrum `before` and `after`?
 * Judged on what got louder (after − before), so a note already being held
 * (and its overtones) drops out:
 *  - its fundamental is a real part of that rise (not noise beside a loud note),
 *  - it isn't just a harmonic of a lower note that started too,
 *  - it stands out from both neighbouring semitones,
 *  - and its harmonics clearly grew (a ringing note only fades).
 */
export function newNote(before, after, binHz, midi, { rise = 1.6, neighbour = 1.5, floor = 0.04 } = {}) {
  const f0 = frequencyOf(midi);
  const up = new Float32Array(after.length);
  let top = 0;
  for (let k = 1; k < after.length; k++) {
    up[k] = Math.max(0, after[k] - before[k]);
    top = Math.max(top, up[k]);
  }
  const fund = peakNear(up, binHz, f0);
  if (fund < top * floor) return false;
  // A lower note starting with it, whose harmonic lands here (C3's 3rd harmonic
  // is G4), explains this peak unless it's well above that note's neighbouring harmonics.
  for (let d = 2; d <= 8; d++) {
    const low = f0 / d;
    if (low < 50) break;
    // Piano overtones run sharp (string stiffness), so look a little wider for the low note.
    const pl = Math.max(peakNear(up, binHz, low), peakNear(up, binHz, low * 0.985));
    if (pl < top * floor || pl < fund * 0.25) continue;
    const near = (h) => Math.max(peakNear(up, binHz, low * h), peakNear(up, binHz, low * h * 1.015));
    const est = (near(d - 1) + near(d + 1)) / 2;
    if (fund < 2 * est) return false;
  }
  const s = salience(up, binHz, midi);
  if (s < neighbour * Math.max(salience(up, binHz, midi - 1), salience(up, binHz, midi + 1))) return false;
  return salience(after, binHz, midi) > rise * salience(before, binHz, midi);
}
