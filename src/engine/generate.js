// Unseen sight-reading passages, made up on the spot from a seed. The right
// hand plays a mostly stepwise tune that fits the chords; the left hand plays
// the chord roots. Same seed, same passage.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
// Accidentals per key signature, by letter.
const SIGNATURES = {
  C: {}, G: { F: '#' }, D: { F: '#', C: '#' }, A: { F: '#', C: '#', G: '#' },
  F: { B: 'b' }, Bb: { B: 'b', E: 'b' }, Eb: { B: 'b', E: 'b', A: 'b' },
};
// Where the right hand's tonic and the left hand's root sit for each key.
const HOME = { C: ['C4', 'C3'], G: ['G4', 'G2'], D: ['D4', 'D3'], A: ['A4', 'A2'], F: ['F4', 'F3'], Bb: ['Bb3', 'Bb2'], Eb: ['Eb4', 'Eb3'] };

const CHORDS = { I: [0, 2, 4], IV: [3, 5, 0], V: [4, 6, 1], vi: [5, 0, 2], ii: [1, 3, 5] };
const ROOT = { I: 0, IV: 3, V: 4, vi: 5, ii: 1 };
// Chord plans by bar count (4 or 8 bars), always ending V → I.
const PLANS = [
  ['I', 'IV', 'V', 'I'], ['I', 'V', 'I', 'I'], ['I', 'vi', 'ii', 'V'], ['I', 'IV', 'I', 'V'],
];

const RHYTHMS = {
  '4/4': {
    easy: [['q', 'q', 'q', 'q'], ['h', 'q', 'q'], ['q', 'q', 'h'], ['h', 'h']],
    medium: [['q', 'q', 'q', 'q'], ['h', 'q', 'q'], ['q', 'q', 'h'], ['q', '8', '8', 'q', 'q'], ['qd', '8', 'q', 'q'], ['q', 'q', '8', '8', 'q'], ['qd', '8', 'h']],
    end: ['w'],
  },
  '3/4': {
    easy: [['q', 'q', 'q'], ['h', 'q'], ['q', 'h']],
    medium: [['q', 'q', 'q'], ['h', 'q'], ['q', '8', '8', 'q'], ['qd', '8', 'q'], ['q', 'q', '8', '8']],
    end: ['hd'],
  },
};

/** Small, fast, seedable random numbers (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Note name `steps` scale steps above `home` (a name like "Bb3") in `key`. */
export function scaleNote(key, home, steps) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(home);
  const li = LETTERS.indexOf(m[1]) + steps;
  const letter = LETTERS[((li % 7) + 7) % 7];
  const octave = Number(m[3]) + Math.floor(li / 7);
  return `${letter}${SIGNATURES[key][letter] || ''}${octave}`;
}

/**
 * @param {{keys?:string[], times?:string[], bars?:number, hands?:'both'|'right', rhythm?:'easy'|'medium'}} spec
 * @param {number} seed
 * @returns {{key:string, time:string, parts:{rh:string, lh?:string}, seed:number}}
 */
export function generatePassage(spec = {}, seed = 1) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const key = pick(spec.keys || ['C', 'G', 'F']);
  const time = pick(spec.times || ['4/4']);
  const bars = spec.bars || 8;
  const [rhHome, lhHome] = HOME[key];
  const rhythms = RHYTHMS[time];
  const pool = rhythms[spec.rhythm || 'medium'];

  // Chord per bar: one or two 4-bar plans, the last always ending V → I.
  const plan = [];
  while (plan.length < bars) plan.push(...pick(PLANS));
  plan.length = bars;
  plan[bars - 2] = 'V';
  plan[bars - 1] = 'I';

  const LO = -1;
  const HI = 5;
  let pos = pick([0, 2, 4]);
  const rh = [];
  const lh = [];
  for (let b = 0; b < bars; b++) {
    const last = b === bars - 1;
    const chord = CHORDS[plan[b]];
    const rhythm = last ? rhythms.end : pick(pool);
    const notes = [];
    rhythm.forEach((d, i) => {
      if (last) pos = 0;
      else if (i === 0) {
        // Downbeats land on a chord tone near the previous note.
        const options = [];
        for (let s = LO; s <= HI; s++) if (chord.includes(((s % 7) + 7) % 7)) options.push(s);
        options.sort((a, c) => Math.abs(a - pos) - Math.abs(c - pos));
        pos = r() < 0.75 ? options[0] : options[Math.min(1, options.length - 1)];
      } else {
        const x = r();
        const step = x < 0.62 ? 1 : x < 0.72 ? 0 : x < 0.94 ? 2 : 3;
        let dir = r() < 0.5 ? -1 : 1;
        if (pos + dir * step > HI || pos + dir * step < LO) dir = -dir;
        pos += dir * step;
      }
      notes.push(`${scaleNote(key, rhHome, pos)}/${d}`);
    });
    rh.push(notes.join(' '));

    // Left hand: the chord root, held (whole bar), or root then fifth in 4/4.
    const root = ROOT[plan[b]] >= 3 ? ROOT[plan[b]] - 7 : ROOT[plan[b]]; // IV, V and vi sit below the tonic
    const rootName = scaleNote(key, lhHome, root);
    const fifthName = scaleNote(key, lhHome, root + 4);
    if (time === '3/4') lh.push(`${rootName}/hd`);
    else if (!last && r() < 0.5) lh.push(`${rootName}/h ${fifthName}/h`);
    else lh.push(`${rootName}/w`);
  }
  const parts = { rh: rh.join(' | ') };
  if (spec.hands !== 'right') parts.lh = lh.join(' | ');
  return { key, time, parts, seed };
}
