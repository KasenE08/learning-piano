// "Find the key" drills: the app names (or shows) a note, you press it.
// Untimed: only the first answer to each prompt counts. Same summary shape as
// the timed scorer so results, stars and XP work unchanged.
import { midiOf } from '../core/music.js';
import { STAR_THRESHOLDS, XP, comboMultiplier } from '../config/scoring.js';

/** Expand a level's prompt list (note names) into prompt objects. */
export function drillPrompts(level) {
  return (level.prompts || []).map((name, i) => ({ id: i, name, midi: midiOf(name) }));
}

export function createDrill(prompts) {
  const results = prompts.map(() => null); // 'hit' | 'miss'
  let i = 0;
  let combo = 0;
  let maxCombo = 0;
  let hitXp = 0;

  return {
    get index() { return i; },
    get current() { return prompts[i] || null; },
    get combo() { return combo; },
    get multiplier() { return comboMultiplier(combo); },
    done() { return i >= prompts.length; },
    /** Answer the current prompt. Returns { type: 'hit'|'miss', prompt, combo }. */
    answer(midi) {
      const p = prompts[i];
      if (!p) return null;
      const ok = midi === p.midi;
      results[i] = ok ? 'hit' : 'miss';
      if (ok) {
        combo++;
        maxCombo = Math.max(maxCombo, combo);
        hitXp += XP.perHit * comboMultiplier(combo);
      } else combo = 0;
      i++;
      return { type: ok ? 'hit' : 'miss', prompt: p, combo };
    },
    summary() {
      const hits = results.filter((r) => r === 'hit').length;
      const total = prompts.length;
      const accuracy = total ? (hits / total) * 100 : 0;
      return {
        total,
        hits,
        early: 0,
        ontime: hits,
        late: 0,
        missed: prompts.filter((_, k) => results[k] !== 'hit'),
        accuracy,
        stars: STAR_THRESHOLDS.filter((t) => accuracy >= t).length,
        maxCombo,
        extras: 0,
        hitXp,
        untimed: true,
      };
    },
  };
}
