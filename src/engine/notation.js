// Parses the compact level notation into measures and a timed list of notes.
//
// A part is a string of tokens separated by spaces; `|` is a bar line.
//   C4/q        quarter-note middle C           r/h       half rest
//   F#4/8:3     eighth F#4, finger 3            Bb3/qd    dotted quarter B♭3
//   [C4 E4 G4]/h:1-3-5   chord with fingers     E4/h~     tie into the next E4
// Durations: w h q 8 16, each optionally dotted (d or dd). Beats are counted in
// quarter notes, whatever the time signature.
import { midiOf } from '../core/music.js';

const BASE_BEATS = { w: 4, h: 2, q: 1, 8: 0.5, 16: 0.25 };
const TOKEN = /^(\[[^\]]+\]|[A-Ga-g][#b]?-?\d|r)\/(w|h|q|8|16)(d{0,2})(?::([\d-]+))?(~)?$/;
const EPS = 1e-6;

export function durationBeats(dur, dots = 0) {
  const base = BASE_BEATS[dur];
  if (base === undefined) throw new Error(`Unknown duration "${dur}"`);
  return base * (dots === 2 ? 1.75 : dots === 1 ? 1.5 : 1);
}

export function measureBeats(time) {
  const m = /^(\d+)\/(\d+)$/.exec(time);
  if (!m) throw new Error(`Bad time signature "${time}"`);
  return (Number(m[1]) * 4) / Number(m[2]);
}

export function parseToken(tok) {
  const m = TOKEN.exec(tok);
  if (!m) throw new Error(`Can't read note "${tok}"`);
  const [, pitch, dur, dotStr, fing, tie] = m;
  const dots = dotStr.length;
  const rest = pitch === 'r';
  const names = rest ? [] : pitch.startsWith('[') ? pitch.slice(1, -1).trim().split(/\s+/) : [pitch];
  const names2 = names.map((n) => n[0].toUpperCase() + n.slice(1));
  const keys = names2.map(midiOf);
  const fingers = fing ? fing.split('-').map(Number) : [];
  if (fingers.length && fingers.length !== keys.length) throw new Error(`"${tok}": ${keys.length} notes but ${fingers.length} fingers`);
  return { names: names2, keys, dur, dots, beats: durationBeats(dur, dots), rest, tie: !!tie, fingers };
}

/** Split a part string into measures of events with start beats. */
export function parsePart(src, { time = '4/4', pickup = false } = {}) {
  const perBar = measureBeats(time);
  const bars = src.split('|').map((b) => b.trim()).filter(Boolean);
  let beat = 0;
  return bars.map((bar, i) => {
    const start = beat;
    const events = bar.match(/\[[^\]]*\]\S*|\S+/g).map((tok) => {
      const e = { ...parseToken(tok), beat };
      beat += e.beats;
      return e;
    });
    const total = beat - start;
    const isPickup = pickup && i === 0;
    if (isPickup ? total > perBar + EPS : Math.abs(total - perBar) > EPS) {
      throw new Error(`Bar ${i + 1} has ${total} beats, expected ${perBar}: "${bar}"`);
    }
    return { index: i, start, beats: isPickup ? total : perBar, events };
  });
}

/** Parse every part of a level. Returns { parts: { rh: [...measures], lh: [...] }, bars, totalBeats }. */
export function parseLevel(level) {
  const opts = { time: level.time || '4/4', pickup: !!level.pickup };
  const parts = {};
  for (const [name, src] of Object.entries(level.parts || {})) parts[name] = parsePart(src, opts);
  const counts = Object.values(parts).map((m) => m.length);
  if (!counts.length) throw new Error('Level has no parts');
  if (new Set(counts).size > 1) throw new Error(`Parts have different bar counts: ${counts.join(', ')}`);
  const last = Object.values(parts)[0].at(-1);
  return { parts, bars: counts[0], totalBeats: last.start + last.beats };
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
      e.keys.forEach((midi, k) => out.push({ part, midi, name: e.names[k], beat: e.beat, beats, finger: e.fingers[k] ?? null, event: e }));
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
