// Chord detection by template matching. We know which notes the music asks
// for, so instead of guessing pitches from scratch we explain what got louder
// at a strike as a mix of candidate notes: the expected ones plus near misses
// (a key either side, a whole step, an octave). Each candidate is a template
// of overtones; non-negative least squares finds how much of each is sounding.
// A note counts if it carries a real share of the sound.
import { frequencyOf } from '../core/music.js';

export { hiddenNotes, HIDDEN_INTERVALS } from '../engine/notation.js';

const MAX_HARMONIC = 8;
const MAX_HZ = 5000;
const TOL = 0.015; // ± a quarter semitone
// Assumed overtone strengths; real pianos vary, so detection keeps some slack.
const PROFILE = Array.from({ length: MAX_HARMONIC }, (_, i) => 1 / (i + 1));
// Strings are stiff, so overtones run slightly sharp.
const partial = (f0, h) => f0 * h * Math.sqrt(1 + 0.0002 * h * h);

function peak(mag, binHz, f) {
  const c = f / binHz;
  const w = Math.max(1, c * TOL);
  let p = 0;
  for (let k = Math.floor(c - w); k <= Math.ceil(c + w); k++) if (k > 0 && k < mag.length) p = Math.max(p, mag[k]);
  return p;
}

// Overtone h of a note: how sharp it runs depends on the piano, so search from
// "perfectly in tune" up to "very stiff strings".
function partialPeak(mag, binHz, f0, h) {
  const lo = f0 * h * (1 - TOL);
  const hi = f0 * h * Math.sqrt(1 + 0.0008 * h * h) * (1 + TOL);
  let p = 0;
  const k0 = Math.max(1, Math.floor(lo / binHz) - (h === 1 ? 1 : 0));
  const k1 = Math.ceil(hi / binHz) + (h === 1 ? 1 : 0);
  for (let k = k0; k <= k1 && k < mag.length; k++) p = Math.max(p, mag[k]);
  return p;
}

/** Non-negative least squares (projected coordinate descent): min |A x − y|, x ≥ 0. A is rows × cols. */
export function nnls(A, y, iters = 200) {
  const rows = A.length;
  const cols = A[0]?.length || 0;
  const x = new Float64Array(cols);
  const colNorm = new Float64Array(cols);
  for (let j = 0; j < cols; j++) for (let i = 0; i < rows; i++) colNorm[j] += A[i][j] * A[i][j];
  const r = Float64Array.from(y); // residual y − A x
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let j = 0; j < cols; j++) {
      if (!colNorm[j]) continue;
      let g = 0;
      for (let i = 0; i < rows; i++) g += A[i][j] * r[i];
      const nx = Math.max(0, x[j] + g / colNorm[j]);
      const d = nx - x[j];
      if (d) {
        for (let i = 0; i < rows; i++) r[i] -= A[i][j] * d;
        x[j] = nx;
        moved = Math.max(moved, Math.abs(d));
      }
    }
    if (moved < 1e-9) break;
  }
  return x;
}

/** Candidates for a set of expected notes: each one, its neighbours, whole steps and octaves. */
export function candidatesFor(expected, { low = 21, high = 108 } = {}) {
  const set = new Set();
  for (const m of expected) for (const d of [0, -1, 1, -2, 2, -12, 12]) if (m + d >= low && m + d <= high) set.add(m + d);
  return [...set].sort((a, b) => a - b);
}

function analyse(before, after, binHz, candidates) {
  const up = new Float32Array(after.length);
  for (let k = 1; k < after.length; k++) up[k] = Math.max(0, after[k] - before[k]);
  // Features: every candidate overtone frequency (merged when they coincide).
  const feats = [];
  candidates.forEach((m, col) => {
    const f0 = frequencyOf(m);
    for (let h = 1; h <= MAX_HARMONIC; h++) {
      const f = partial(f0, h);
      if (f > MAX_HZ || f < 40) continue;
      let ft = feats.find((x) => Math.abs(x.f - f) / f < TOL);
      if (!ft) { ft = { f, f0, h, w: new Float64Array(candidates.length) }; feats.push(ft); }
      ft.w[col] = Math.max(ft.w[col], PROFILE[h - 1]);
    }
  });
  const A = feats.map((ft) => Array.from(ft.w));
  const y = feats.map((ft) => partialPeak(up, binHz, ft.f0, ft.h));
  const x = nnls(A, y);
  return { feats, y, x, up };
}

/**
 * How strongly each candidate note started between spectra `before` and `after`.
 * @returns Map midi → share (0–1, relative to the strongest candidate)
 */
export function noteShares(before, after, binHz, candidates) {
  const { x } = analyse(before, after, binHz, candidates);
  const top = Math.max(...x, 1e-12);
  return new Map(candidates.map((m, j) => [m, x[j] / top]));
}

/**
 * Which of the `expected` notes started here? A note needs a solid share of the
 * sound, and its own overtones (the ones no other sounding note shares) must
 * really be there: that stops a lower note's overtone, or a neighbouring key
 * pressed by mistake, from crediting it.
 */
export function chordHeard(before, after, binHz, expected, { share = 0.3, own = 0.35, contrast = 1.2, why = null } = {}) {
  const candidates = candidatesFor(expected);
  const { feats, y, x, up } = analyse(before, after, binHz, candidates);
  const top = Math.max(...x, 1e-12);
  const sounding = x.map((v) => v >= 0.05 * top);
  const heard = new Set();
  for (const m of expected) {
    const j = candidates.indexOf(m);
    if (x[j] < share * top) { why?.set(m, `share ${(x[j] / top).toFixed(2)}`); continue; }
    let seen = 0;
    let want = 0;
    feats.forEach((ft, i) => {
      if (!ft.w[j]) return;
      if (ft.w.some((w, c) => c !== j && w && sounding[c])) return; // shared with another sounding note
      seen += Math.min(y[i], x[j] * ft.w[j]);
      want += x[j] * ft.w[j];
    });
    if (!want || seen < own * want) { why?.set(m, `own ${want ? (seen / want).toFixed(2) : 'none'}`); continue; }
    // And it must clearly beat the keys either side (unless those are in the chord too),
    // compared on overtones no other chord tone shares.
    const others = expected.filter((n) => n !== m);
    const clear = (f) => !others.some((n) => {
      for (let h = 1; h <= MAX_HARMONIC; h++) if (Math.abs(partial(frequencyOf(n), h) - f) / f < 2 * TOL) return true;
      return false;
    });
    // Only overtones where neighbouring keys are at least 3 FFT bins apart can tell them apart.
    const usable = [];
    for (let h = 1; h <= 6; h++) {
      const f = partial(frequencyOf(m), h);
      if (f < MAX_HZ && f * 0.059 >= 3 * binHz && clear(f)) usable.push(h);
    }
    const energy = (note) => usable.reduce((e, h) => e + PROFILE[h - 1] * partialPeak(up, binHz, frequencyOf(note), h), 0);
    const mine = energy(m);
    const xOf = (n) => { const c = candidates.indexOf(n); return c < 0 ? 0 : x[c]; };
    // Beat each neighbour clearly on overtone energy, or a bit less clearly
    // when the fit also says this note (not the neighbour) is the one sounding.
    const beats = (nb) => {
      const r = mine / Math.max(energy(nb), 1e-12);
      return r >= contrast || (r >= 1.1 && x[j] >= 3 * xOf(nb));
    };
    if (!usable.length || [m - 1, m + 1].every((nb) => expected.includes(nb) || beats(nb))) heard.add(m);
    else why?.set(m, `contrast ${(mine / Math.max(energy(m - 1), energy(m + 1), 1e-12)).toFixed(2)} on h${usable}`);
  }
  return heard;
}
