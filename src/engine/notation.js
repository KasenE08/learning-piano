// Parses the compact level notation into measures and a timed list of notes.
//
// A part is a string of tokens separated by spaces; `|` is a bar line.
//   C4/q        quarter-note middle C           r/h       half rest
//   F#4/8:3     eighth F#4, finger 3            Bb3/qd    dotted quarter B♭3
//   [C4 E4 G4]/h:1-3-5   chord with fingers     E4/h~     tie into the next E4
//   C4/8t       eighth-note triplet (3 in the time of 2)
//   C4/q:1!mf   dynamic mark (pp p mp mf f ff, or cresc / dim) from here on
// Durations: w h q 8 16, each optionally dotted (d or dd). Beats are counted in
// quarter notes, whatever the time signature. Times are added up in integer
// ticks (48 per quarter) so triplets sum exactly.
import { midiOf } from '../core/music.js';

const BASE_BEATS = { w: 4, h: 2, q: 1, 8: 0.5, 16: 0.25 };
const TOKEN = /^(\[[^\]]+\]|[A-Ga-g][#b]?-?\d|r)\/(w|h|q|8|16)(d{0,2})(t?)(?::([\d-]+))?(~)?(?:!(pp|p|mp|mf|ff|f|cresc|dim))?$/;
const EPS = 1e-6;
export const TICKS = 48;
const toTicks = (beats) => Math.round(beats * TICKS);

/** Playback loudness for each dynamic mark (0–1). */
export const DYNAMICS = { pp: 0.32, p: 0.44, mp: 0.56, mf: 0.68, f: 0.82, ff: 0.95 };
const DEFAULT_VEL = 0.72;

export function durationBeats(dur, dots = 0, triplet = false) {
  const base = BASE_BEATS[dur];
  if (base === undefined) throw new Error(`Unknown duration "${dur}"`);
  return base * (dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1) * (triplet ? 2 / 3 : 1);
}

/** 6/8, 9/8 and 12/8 are felt in dotted-quarter beats. */
export function isCompound(time = '4/4') {
  const [n, d] = time.split('/').map(Number);
  return d === 8 && n % 3 === 0 && n > 3;
}

/** Quarter-note beats between metronome clicks: a dotted quarter in compound time. */
export function pulseBeats(time = '4/4') {
  return isCompound(time) ? 1.5 : 4 / Number(time.split('/')[1]);
}

/** Move a note name by whole octaves (8va/8vb display). */
export function shiftOctave(name, by) {
  return name.replace(/(-?\d)$/, (d) => String(Number(d) + by));
}

export function measureBeats(time) {
  const m = /^(\d+)\/(\d+)$/.exec(time);
  if (!m) throw new Error(`Bad time signature "${time}"`);
  return (Number(m[1]) * 4) / Number(m[2]);
}

export function parseToken(tok) {
  const m = TOKEN.exec(tok);
  if (!m) throw new Error(`Can't read note "${tok}"`);
  const [, pitch, dur, dotStr, trip, fing, tie, dyn] = m;
  const dots = dotStr.length;
  const triplet = trip === 't';
  const rest = pitch === 'r';
  const names = rest ? [] : pitch.startsWith('[') ? pitch.slice(1, -1).trim().split(/\s+/) : [pitch];
  const names2 = names.map((n) => n[0].toUpperCase() + n.slice(1));
  const keys = names2.map(midiOf);
  const fingers = fing ? fing.split('-').map(Number) : [];
  if (fingers.length && fingers.length !== keys.length) throw new Error(`"${tok}": ${keys.length} notes but ${fingers.length} fingers`);
  const beats = durationBeats(dur, dots, triplet);
  return { names: names2, keys, dur, dots, triplet, ticks: toTicks(beats), beats, rest, tie: !!tie, fingers, dyn: dyn || null };
}

/** Split a part string into measures of events with start beats. */
export function parsePart(src, { time = '4/4', pickup = false } = {}) {
  const perBar = toTicks(measureBeats(time));
  const bars = src.split('|').map((b) => b.trim()).filter(Boolean);
  let tick = 0;
  return bars.map((bar, i) => {
    const start = tick;
    const events = bar.match(/\[[^\]]*\]\S*|\S+/g).map((tok) => {
      const e = { ...parseToken(tok), beat: tick / TICKS };
      tick += e.ticks;
      return e;
    });
    const total = tick - start;
    const isPickup = pickup && i === 0;
    if (isPickup ? total > perBar : total !== perBar) {
      throw new Error(`Bar ${i + 1} has ${total / TICKS} beats, expected ${perBar / TICKS}: "${bar}"`);
    }
    if (events.some((e) => e.triplet) && !tripletsClosed(events)) throw new Error(`Bar ${i + 1}: triplets must come in complete groups: "${bar}"`);
    return { index: i, start: start / TICKS, beats: (isPickup ? total : perBar) / TICKS, events };
  });
}

/** Group consecutive triplet events into tuplets (3 in the time of 2 of the first note's value). */
export function tripletGroups(events) {
  const groups = [];
  let cur = null;
  for (const e of events) {
    if (!e.triplet) { if (cur) groups.push(cur); cur = null; continue; }
    if (!cur) cur = { unit: toTicks(BASE_BEATS[e.dur] * 2), ticks: 0, events: [] };
    cur.events.push(e);
    cur.ticks += e.ticks;
    if (cur.ticks >= cur.unit) { groups.push(cur); cur = null; }
  }
  if (cur) groups.push(cur);
  return groups;
}
const tripletsClosed = (events) => tripletGroups(events).every((g) => g.ticks === g.unit);

/** Parse every part of a level. Returns { parts: { rh: [...measures], lh: [...] }, bars, totalBeats }. */
export function parseLevel(level) {
  const opts = { time: level.time || '4/4', pickup: !!level.pickup };
  const parts = {};
  for (const [name, src] of Object.entries(level.parts || {})) parts[name] = parsePart(src, opts);
  for (const [name, measures] of Object.entries(parts)) applyDynamics(measures.flatMap((m) => m.events));
  for (const o of level.ottava || []) {
    const by = o.type === '8vb' ? 1 : -1; // written an octave away from where it sounds
    for (let b = o.from; b <= o.to; b++) {
      const m = parts[o.part || 'rh']?.[b - 1];
      if (!m) throw new Error(`Ottava bar ${b} is outside the piece`);
      m.ottava = o.type;
      m.events.forEach((e) => { if (!e.rest) e.shown = e.names.map((n) => shiftOctave(n, by)); });
    }
  }
  const counts = Object.values(parts).map((m) => m.length);
  if (!counts.length) throw new Error('Level has no parts');
  if (new Set(counts).size > 1) throw new Error(`Parts have different bar counts: ${counts.join(', ')}`);
  const last = Object.values(parts)[0].at(-1);
  const passage = last.start + last.beats;
  if (!level.repeat) return { parts, display: parts, bars: counts[0], displayBars: counts[0], totalBeats: passage, repeatBeats: null };
  // Repeat signs: engrave once (display), play twice (parts). Second-pass events
  // point back at the first-pass event they repeat (orig) for highlighting.
  const played = {};
  for (const [name, measures] of Object.entries(parts)) {
    const again = measures.map((m, i) => ({
      ...m,
      index: measures.length + i,
      start: m.start + passage,
      events: m.events.map((e) => ({ ...e, beat: e.beat + passage, orig: e })),
    }));
    played[name] = [...measures, ...again];
  }
  return { parts: played, display: parts, bars: counts[0] * 2, displayBars: counts[0], totalBeats: passage * 2, repeatBeats: passage };
}

/** Give every event a playback velocity from the dynamic marks (crescendo/diminuendo ramp to the next mark). */
function applyDynamics(flat) {
  let vel = DEFAULT_VEL;
  for (let i = 0; i < flat.length; i++) {
    const e = flat[i];
    if (e.dyn && DYNAMICS[e.dyn]) vel = DYNAMICS[e.dyn];
    if (e.dyn === 'cresc' || e.dyn === 'dim') {
      const up = e.dyn === 'cresc';
      let j = i + 1;
      while (j < flat.length && !DYNAMICS[flat[j].dyn]) j++;
      const target = j < flat.length ? DYNAMICS[flat[j].dyn] : Math.max(0.2, Math.min(1, vel + (up ? 0.2 : -0.2)));
      const end = j < flat.length ? flat[j].beat : flat.at(-1).beat + flat.at(-1).beats;
      const b0 = e.beat;
      for (let k = i; k < j; k++) flat[k].vel = vel + (target - vel) * ((flat[k].beat - b0) / Math.max(EPS, end - b0));
      vel = target;
      i = j - 1;
      continue;
    }
    e.vel = vel;
  }
}

/**
 * Notes the player must play, in time order. Tied continuations are merged into
 * the first note. Each chord tone is its own expected note.
 */
export function expectedNotes(parsed) {
  const out = [];
  for (const [part, measures] of Object.entries(parsed.parts)) {
    const flat = measures.flatMap((m) => m.events);
    for (let i = 0; i < flat.length; i++) {
      const e = flat[i];
      if (e.rest) continue;
      const prev = flat[i - 1];
      if (prev && prev.tie && !prev.rest && prev.keys.join() === e.keys.join()) continue; // continuation
      let beats = e.beats;
      for (let j = i; flat[j]?.tie && flat[j + 1] && flat[j + 1].keys.join() === e.keys.join(); j++) beats += flat[j + 1].beats;
      e.keys.forEach((midi, k) => out.push({ part, midi, name: e.names[k], beat: e.beat, beats, finger: e.fingers[k] ?? null, vel: e.vel ?? DEFAULT_VEL, event: e }));
    }
  }
  out.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  out.forEach((n, i) => { n.id = i; });
  return out;
}

export function noteRange(notes) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
  return { lo, hi };
}

/**
 * Pick the on-screen keyboard window: `size` keys starting on a C, covering the
 * piece, kept inside the physical keyboard. Grows by octaves if the piece is wider.
 */
export function keyboardWindow({ lo, hi }, { size = 36, min = 36, max = 96 } = {}) {
  if (!Number.isFinite(lo)) return { low: 48, keys: size };
  let low = Math.floor(lo / 12) * 12;
  let keys = Math.max(size, Math.ceil((hi - low + 1) / 12) * 12);
  // Centre the piece: move down an octave while there is much more room above than below.
  while (low - 12 >= min && low + keys - 1 - hi > lo - low + 12) low -= 12;
  // Keep inside the physical keyboard; the top C may need one extra key.
  if (low + keys - 1 > max) {
    low = Math.max(min, Math.floor((max - keys + 1) / 12) * 12);
    if (low + keys - 1 < hi) keys = hi - low + 1;
  }
  low = Math.max(min, low);
  return { low, keys: Math.min(keys, max - low + 1) };
}

/**
 * What the (one-note-at-a-time) mic can score. Where several notes start
 * together, only the top right-hand note is scored (the top note overall if
 * the right hand is silent there); notes that start alone are all scored.
 * The rest come back as `ghosts`: heard but not scored.
 */
export function micMelody(notes) {
  const scored = [];
  const ghosts = [];
  for (let i = 0; i < notes.length;) {
    let j = i;
    while (j < notes.length && Math.abs(notes[j].beat - notes[i].beat) < EPS) j++;
    const group = notes.slice(i, j);
    if (group.length === 1) scored.push(group[0]);
    else {
      const rh = group.filter((n) => n.part === 'rh');
      const pool = rh.length ? rh : group;
      const top = pool.reduce((a, b) => (b.midi > a.midi ? b : a));
      scored.push(top);
      group.forEach((n) => { if (n !== top) ghosts.push(n); });
    }
    i = j;
  }
  return { scored, ghosts };
}

// Intervals (semitones) at which every overtone of the upper note is also an
// overtone of the lower one: octave, 12th, two octaves. No microphone method can
// tell whether that upper note was played too.
export const HIDDEN_INTERVALS = new Set([12, 19, 24]);

/** Notes (midi numbers) of a chord that sit entirely in another chord tone's overtones. */
export function hiddenNotes(midis) {
  return new Set(midis.filter((m) => midis.some((n) => n < m && HIDDEN_INTERVALS.has(m - n))));
}

/** Notes grouped by shared start (chords, or both hands together). */
export function onsetGroups(notes) {
  const groups = [];
  for (const n of notes) {
    const g = groups.at(-1);
    if (g && Math.abs(g.beat - n.beat) < EPS) g.notes.push(n);
    else groups.push({ beat: n.beat, notes: [n] });
  }
  return groups;
}

/**
 * What the mic scores with chord detection: every note, except one hidden in
 * another chord tone's overtones (octave, 12th, two octaves above it), which
 * comes back as a ghost: heard, not scored.
 */
export function micScoring(notes) {
  const scored = [];
  const ghosts = [];
  for (const g of onsetGroups(notes)) {
    const hid = hiddenNotes(g.notes.map((n) => n.midi));
    g.notes.forEach((n) => (hid.has(n.midi) ? ghosts : scored).push(n));
  }
  return { scored, ghosts };
}

/** Do any notes start together (so the mic can't score all of them yet)? */
export const hasChords = (notes) => notes.some((n, i) => i > 0 && Math.abs(n.beat - notes[i - 1].beat) < EPS);
