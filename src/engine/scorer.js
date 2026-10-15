// Pure scoring: matches played notes (MIDI + time) against expected notes.
// Rules (see src/config/scoring.js):
//  - A hit needs the exact pitch (octave included) within ±window of the target time.
//  - The inner ON_TIME_FRACTION of the window is "on time"; the rest early/late.
//  - A note never hit by the end of its window is a miss (breaks the combo).
//  - Wrong or extra notes break the combo but do not change accuracy.
//  - "Ghost" notes are in the music but not scored (e.g. the left hand while the
//    mic scores only the melody). Playing one is neither a hit nor an extra.
import { ON_TIME_FRACTION, STAR_THRESHOLDS, XP, comboMultiplier } from '../config/scoring.js';

export function judgeTiming(offsetMs, windowMs, onTimeFraction = ON_TIME_FRACTION) {
  const a = Math.abs(offsetMs);
  if (a > windowMs) return null;
  if (a <= windowMs * onTimeFraction) return 'ontime';
  return offsetMs < 0 ? 'early' : 'late';
}

/**
 * @param {Array<{id:number, midi:number, time:number}>} expected  time in ms from start
 * @param {{windowMs:number, onTimeFraction?:number, ghosts?:Array<{midi:number, time:number}>}} opts
 */
export function createScorer(expected, { windowMs, onTimeFraction = ON_TIME_FRACTION, ghosts = [] }) {
  const notes = expected.map((n) => ({ ...n, result: null, offset: null }));
  let combo = 0;
  let maxCombo = 0;
  let extras = 0;
  let hitXp = 0; // XP from notes, each multiplied by the combo multiplier at that moment
  let missFrom = 0; // index before which every note is judged (notes are time-sorted)

  const bump = () => {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    hitXp += XP.perHit * comboMultiplier(combo);
  };

  return {
    notes,
    get combo() { return combo; },
    get maxCombo() { return maxCombo; },

    /** A key was played at `time` ms. Returns what happened. */
    input(midi, time) {
      let best = null;
      for (let i = missFrom; i < notes.length; i++) {
        const n = notes[i];
        if (n.time - time > windowMs) break;
        if (n.result || n.midi !== midi) continue;
        const off = time - n.time;
        if (Math.abs(off) > windowMs) continue;
        // Earliest pending match wins, so fast repeated notes are consumed in order.
        best = { note: n, offset: off };
        break;
      }
      if (!best) {
        // A note from the unscored part, played at about the right time: ignore it.
        // Its tail can be heard a little late, so allow twice the window after.
        if (ghosts.some((g) => g.midi === midi && time - g.time >= -windowMs && time - g.time <= windowMs * 2)) {
          return { type: 'ghost', midi, time, combo };
        }
        extras++;
        combo = 0;
        return { type: 'extra', midi, time, combo };
      }
      const timing = judgeTiming(best.offset, windowMs, onTimeFraction);
      best.note.result = timing;
      best.note.offset = best.offset;
      bump();
      return { type: 'hit', note: best.note, timing, offset: best.offset, combo };
    },

    /** Advance the clock: notes whose window has fully passed become misses. Returns newly missed notes. */
    tick(now) {
      const missed = [];
      while (missFrom < notes.length) {
        const n = notes[missFrom];
        if (n.result) { missFrom++; continue; }
        if (now - n.time <= windowMs) break;
        n.result = 'miss';
        combo = 0;
        missed.push(n);
        missFrom++;
      }
      return missed;
    },

    /** Unjudged notes that are next in line (all notes sharing the earliest pending time). */
    upcoming() {
      const pending = notes.find((n) => !n.result);
      return pending ? notes.filter((n) => !n.result && n.time === pending.time) : [];
    },

    done() { return notes.every((n) => n.result); },

    get multiplier() { return comboMultiplier(combo); },
    summary() { return { ...summarize(notes, { maxCombo, extras }), hitXp }; },
  };
}

export function summarize(notes, { maxCombo = 0, extras = 0 } = {}) {
  const count = (r) => notes.filter((n) => n.result === r).length;
  const early = count('early');
  const ontime = count('ontime');
  const late = count('late');
  const hits = early + ontime + late;
  const total = notes.length;
  const accuracy = total ? (hits / total) * 100 : 0;
  return {
    total,
    hits,
    early,
    ontime,
    late,
    missed: notes.filter((n) => n.result === 'miss' || !n.result),
    accuracy,
    stars: STAR_THRESHOLDS.filter((t) => accuracy >= t).length,
    maxCombo,
    extras,
  };
}
