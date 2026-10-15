// Turns a stream of analysis frames into "note played" events: { midi, time, how }.
// Pure logic, fed one frame per hop with the time (s) of the frame's last sample.
//
// Two ways a note is recognised:
//  1. Attack: band spectral flux jumps (a key strike). The pitch is then confirmed
//     from the next few clear frames. This also catches a repeated note that is
//     still ringing, as long as the level jumps.
//  2. Pitch change: a new, clear, stable pitch appears without a detectable attack
//     (smooth legato or a soft touch). It must differ from the sounding note.
import { freqToMidi, FRAME_SIZE, HOP_SIZE } from './analysis.js';

export const DEFAULTS = {
  noiseDb: -60, // room noise in the piano band (from calibration)
  low: 36, // lowest key (C2)
  high: 96, // highest key (C7)
  minClarity: 0.85,
  maxCents: 45,
  fluxRatio: 2.2, // onset when flux exceeds the recent average by this factor…
  fluxMin: 0.035, // …and this absolute amount
  refractory: 0.06, // s between onsets
  confirmFrames: 2,
  confirmWindow: 0.13, // s to settle the pitch after an attack
  stableFrames: 4, // frames for a pitch-change note
  // A same-pitch re-strike must show a dip-then-rise in level of at least this much.
  // (A key release only falls; a note left ringing barely moves.)
  reattackDb: 3,
};

export function createNoteDetector(sampleRate, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const hop = HOP_SIZE / sampleRate;
  const win = FRAME_SIZE / sampleRate;
  const gate = () => o.noiseDb + 10;

  const fluxHist = [];
  let prevFlux = 0;
  let lastOnset = -Infinity;
  let pending = null; // { time, low, swing, flux, votes: [] }
  let sounding = null; // midi of the last note we reported, while it rings
  let lastEmit = -Infinity;
  let run = null; // { midi, start, n } — consecutive clear frames of one pitch
  let prevLevel = -120;
  let firstT = null; // time of the first frame since (re)start
  let frames = 0;
  const seen = new Map(); // midi → last time it was the clear pitch (for resurfacing notes)
  const recentLevels = []; // last few band levels, to find the dip before an attack

  const toMidi = (f) => {
    if (!f) return null;
    const m = freqToMidi(f);
    const r = Math.round(m);
    if (Math.abs(m - r) * 100 > o.maxCents) return null;
    if (r < o.low || r > o.high) return null;
    return r;
  };

  const emit = (midi, time, how, out) => {
    out.push({ midi, time, how });
    sounding = midi;
    lastEmit = time;
  };

  return {
    options: o,
    /** Feed one frame; returns an array (usually empty) of new note events. */
    push(f, t) {
      const out = [];
      if (firstT == null) firstT = t;
      frames++;
      const loud = f.bandDb > gate();
      const midi = f.clarity >= o.minClarity && loud ? toMidi(f.pitch) : null;

      // --- attack detection -------------------------------------------------
      const avg = fluxHist.length ? fluxHist.reduce((a, b) => a + b, 0) / fluxHist.length : 0;
      const thr = Math.max(o.fluxMin, avg * o.fluxRatio);
      // The first frames compare against silence, so they can't be attacks.
      const rising = frames > 2 && f.flux > thr && f.flux > prevFlux && loud;
      // A much stronger attack right after a weak one (e.g. the previous key's
      // release, then the real strike) replaces it instead of being ignored. So
      // does any attack whose level jumps, since a strike can spread over 2 frames.
      const supersedes = rising && pending && (f.flux > pending.flux * 2.5 || (f.flux > pending.flux && f.bandDb - prevLevel > 3));
      if (rising && (t - lastOnset > o.refractory || supersedes)) {
        if (pending && !supersedes && pending.votes.length) settle(pending, out);
        const dip = Math.min(...recentLevels, supersedes ? pending.low : Infinity);
        lastOnset = t;
        pending = { time: t - hop / 2, low: dip, swing: f.bandDb - dip, flux: f.flux, votes: [] };
      }
      fluxHist.push(f.flux);
      if (fluxHist.length > 12) fluxHist.shift();
      prevFlux = f.flux;

      // --- confirm the pitch after an attack --------------------------------
      if (pending) {
        pending.low = Math.min(pending.low, f.bandDb);
        pending.swing = Math.max(pending.swing, f.bandDb - pending.low);
        if (midi != null && t - pending.time >= 0.012) pending.votes.push(midi);
        const v = pending.votes;
        // Don't settle mid-attack: the level (and so the re-strike check) is still rising.
        const agreed = v.length >= o.confirmFrames && v.slice(-o.confirmFrames).every((m) => m === v.at(-1)) && f.flux <= thr;
        if (agreed || t - pending.time > o.confirmWindow) settle(pending, out);
      }

      // --- pitch change without an attack -----------------------------------
      if (midi != null) {
        if (run && run.midi === midi) run.n++;
        else {
          if (run && run.n >= 2) seen.set(run.midi, run.last);
          run = { midi, start: t - win / 2, n: 1 };
        }
        run.last = t;
        if (!pending && run.n === o.stableFrames && midi !== sounding && run.start > lastEmit + 0.05) {
          // A pitch already ringing when we started listening, or one that resurfaces
          // as a louder note fades (e.g. a held bass note), isn't a new note.
          const resurfacing = (seen.get(midi) ?? -Infinity) > run.start - 1.5;
          if (run.start < firstT || resurfacing) sounding = midi;
          else emit(midi, run.start, 'change', out);
        }
      } else if (!loud) {
        run = null;
      }
      if (!loud) { sounding = null; seen.clear(); }
      prevLevel = f.bandDb;
      recentLevels.push(f.bandDb);
      if (recentLevels.length > 3) recentLevels.shift();
      return out;

      function settle(p, sink) {
        pending = null;
        if (!p.votes.length) { lastOnset = -Infinity; return; }
        // Most common vote wins (ties → the latest).
        const count = new Map();
        p.votes.forEach((m) => count.set(m, (count.get(m) || 0) + 1));
        let best = null;
        count.forEach((c, m) => { if (!best || c >= best[1]) best = [m, c]; });
        const m = best[0];
        // Same pitch as a note that's ringing (or just was, e.g. a held bass note heard
        // again when a higher key is released): a new strike only if the level dipped and rose.
        const wasRinging = m === sounding || (seen.get(m) ?? -Infinity) > p.time - 1.5;
        if (wasRinging && p.swing < o.reattackDb) { lastOnset = -Infinity; return; }
        emit(m, p.time, 'attack', sink);
        if (run && run.midi !== m && run.n >= 2) seen.set(run.midi, run.last);
        run = { midi: m, start: p.time, n: o.stableFrames + 1, last: p.time };
      }
    },
    reset() {
      fluxHist.length = 0;
      firstT = null;
      frames = 0;
      seen.clear();
      recentLevels.length = 0;
      prevFlux = 0;
      lastOnset = -Infinity;
      pending = null;
      sounding = null;
      lastEmit = -Infinity;
      run = null;
    },
  };
}
