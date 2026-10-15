// Every tunable scoring number lives here.

// Timing window per section: a note counts if it lands within ±windowMs of its
// target time (after latency compensation). The inner `onTimeFraction` of the
// window is "on time"; the rest is "early" or "late".
export const TIMING_WINDOWS_MS = {
  noob: 200,
  beginner: 150,
  intermediate: 100,
  advanced: 75,
};
export const ON_TIME_FRACTION = 0.4;

// Pitch must match exactly, including the octave.
export const OCTAVE_STRICT = true;

// Wrong or extra notes break the combo but do not lower accuracy.
export const EXTRA_NOTE_BREAKS_COMBO = true;
export const EXTRA_NOTE_LOWERS_ACCURACY = false;

// Accuracy % needed for 1, 2 and 3 stars. One star clears a level.
export const STAR_THRESHOLDS = [70, 85, 95];

// Passing a section test unlocks the next section. It can be taken at any time
// once the section is open, so a passed test also skips the section.
export const SECTION_TEST_PASS = 85;

// Combo multiplier tiers: [minimum combo, XP multiplier].
export const COMBO_TIERS = [
  [0, 1],
  [10, 2],
  [25, 3],
  [50, 4],
];

export const XP = {
  perAttempt: 10,
  perHit: 1, // multiplied by the combo multiplier at the moment of the hit
  perNewStar: 30,
  firstClear: 50,
  testPass: 150,
  songFirstClear: 40,
  practiceFactor: 0, // practice runs earn no XP
};

export function comboMultiplier(combo) {
  let m = 1;
  for (const [min, mult] of COMBO_TIERS) if (combo >= min) m = mult;
  return m;
}

// XP needed to go from `level` to `level + 1`.
export const xpForNextLevel = (level) => 150 + 75 * (level - 1);

export const RANKS = [
  [1, 'Rookie'],
  [5, 'Apprentice'],
  [10, 'Journeyman'],
  [15, 'Performer'],
  [20, 'Virtuoso'],
  [30, 'Maestro'],
];
