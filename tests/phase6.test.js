import { describe, it, expect } from 'vitest';
import {
  parseToken, parsePart, parseLevel, expectedNotes, tripletGroups, isCompound, pulseBeats,
  shiftOctave, micMelody, hasChords, DYNAMICS,
} from '../src/engine/notation.js';
import { createScorer } from '../src/engine/scorer.js';
import { generatePassage, scaleNote, rng } from '../src/engine/generate.js';
import { midiOf } from '../src/core/music.js';

describe('triplets', () => {
  it('three triplet eighths fill exactly one beat', () => {
    const t = parseToken('C4/8t:1');
    expect(t.triplet).toBe(true);
    expect(t.beats).toBeCloseTo(1 / 3);
    const [bar] = parsePart('C4/8t D4/8t E4/8t F4/q G4/h');
    expect(bar.events.map((e) => e.beat)).toEqual([0, 1 / 3, 2 / 3, 1, 2]);
  });
  it('beats after many triplets stay exact (no float drift)', () => {
    const bar = Array(12).fill('C4/8t').join(' ');
    const ms = parsePart(`${bar} | C4/w`);
    expect(ms[1].start).toBe(4);
    expect(ms[1].events[0].beat).toBe(4);
  });
  it('quarter-note triplets take two beats', () => {
    const [bar] = parsePart('C4/qt D4/qt E4/qt F4/h');
    expect(bar.events[3].beat).toBe(2);
    expect(tripletGroups(bar.events)).toHaveLength(1);
  });
  it('rejects an incomplete triplet group', () => {
    expect(() => parsePart('C4/8t D4/8t E4/q F4/8t r/h')).toThrow(/triplet/);
  });
  it('groups consecutive triplets in threes', () => {
    const [bar] = parsePart('C4/8t D4/8t E4/8t F4/8t G4/8t A4/8t r/h');
    expect(tripletGroups(bar.events).map((g) => g.events.length)).toEqual([3, 3]);
  });
});

describe('dynamics', () => {
  it('reads dynamic marks after fingers and ties', () => {
    expect(parseToken('C4/q:1!mf').dyn).toBe('mf');
    expect(parseToken('C4/h~!p').dyn).toBe('p');
    expect(parseToken('C4/q').dyn).toBe(null);
  });
  it('sets playback velocity from the marks', () => {
    const n = expectedNotes(parseLevel({ parts: { rh: 'C4/q!p D4/q E4/q!f F4/q' } }));
    expect(n.map((x) => x.vel)).toEqual([DYNAMICS.p, DYNAMICS.p, DYNAMICS.f, DYNAMICS.f]);
  });
  it('crescendo ramps up to the next mark', () => {
    const n = expectedNotes(parseLevel({ parts: { rh: 'C4/q!p D4/q!cresc E4/q F4/q | G4/w!f' } }));
    const v = n.map((x) => x.vel);
    expect(v[1]).toBeCloseTo(DYNAMICS.p);
    expect(v[2]).toBeGreaterThan(v[1]);
    expect(v[3]).toBeGreaterThan(v[2]);
    expect(v[4]).toBe(DYNAMICS.f);
  });
  it('diminuendo with no later mark fades a little', () => {
    const n = expectedNotes(parseLevel({ parts: { rh: 'C4/q!f D4/q!dim E4/q F4/q' } }));
    expect(n[3].vel).toBeLessThan(n[1].vel);
  });
  it('dynamics never change what must be played', () => {
    const a = expectedNotes(parseLevel({ parts: { rh: 'C4/q!p D4/q!cresc E4/h!f' } }));
    const b = expectedNotes(parseLevel({ parts: { rh: 'C4/q D4/q E4/h' } }));
    expect(a.map((x) => [x.midi, x.beat])).toEqual(b.map((x) => [x.midi, x.beat]));
  });
});

describe('compound time', () => {
  it('6/8 and 9/8 are compound, 3/4 and 3/8 are not', () => {
    expect(isCompound('6/8')).toBe(true);
    expect(isCompound('9/8')).toBe(true);
    expect(isCompound('3/4')).toBe(false);
    expect(isCompound('3/8')).toBe(false);
  });
  it('clicks every dotted quarter in 6/8, every quarter in 4/4', () => {
    expect(pulseBeats('6/8')).toBe(1.5);
    expect(pulseBeats('4/4')).toBe(1);
    expect(pulseBeats('3/4')).toBe(1);
  });
  it('a 6/8 bar holds six eighths', () => {
    const ms = parsePart('C4/8 D4/8 E4/8 F4/qd | G4/hd', { time: '6/8' });
    expect(ms[1].start).toBe(3);
  });
});

describe('8va / 8vb', () => {
  it('shifts note names by octaves', () => {
    expect(shiftOctave('C6', -1)).toBe('C5');
    expect(shiftOctave('Bb2', 1)).toBe('Bb3');
    expect(shiftOctave('F#5', -1)).toBe('F#4');
  });
  it('writes 8va bars an octave lower but keeps the sounding pitch', () => {
    const p = parseLevel({ parts: { rh: 'C5/w | C6/q D6/q E6/h' }, ottava: [{ part: 'rh', from: 2, to: 2, type: '8va' }] });
    const e = p.parts.rh[1].events[0];
    expect(e.names).toEqual(['C6']);
    expect(e.shown).toEqual(['C5']);
    expect(p.parts.rh[1].ottava).toBe('8va');
    expect(p.parts.rh[0].events[0].shown).toBeUndefined();
    expect(expectedNotes(p)[1].midi).toBe(midiOf('C6'));
  });
  it('8vb writes an octave higher', () => {
    const p = parseLevel({ parts: { lh: 'C2/w' }, ottava: [{ part: 'lh', from: 1, to: 1, type: '8vb' }] });
    expect(p.parts.lh[0].events[0].shown).toEqual(['C3']);
  });
  it('rejects ottava bars outside the piece', () => {
    expect(() => parseLevel({ parts: { rh: 'C5/w' }, ottava: [{ part: 'rh', from: 1, to: 3, type: '8va' }] })).toThrow();
  });
});

describe('mic melody (one note at a time until chord detection)', () => {
  const lvl = (rh, lh) => expectedNotes(parseLevel({ parts: { rh, lh } }));
  it('keeps everything when no notes start together', () => {
    const n = lvl('C4/q r/q E4/q r/q', 'r/q G3/q r/q G3/q');
    expect(hasChords(n)).toBe(false);
    expect(micMelody(n).scored).toHaveLength(4);
  });
  it('keeps the top right-hand note when hands start together', () => {
    const n = lvl('E4/q F4/q G4/h', 'C3/w');
    const { scored, ghosts } = micMelody(n);
    expect(scored.map((x) => x.name)).toEqual(['E4', 'F4', 'G4']);
    expect(ghosts.map((x) => x.name)).toEqual(['C3']);
  });
  it('keeps the top note of a right-hand chord', () => {
    const n = lvl('[C4 E4 G4]/w', 'C3/w');
    expect(micMelody(n).scored.map((x) => x.name)).toEqual(['G4']);
  });
  it('uses the left hand when the right hand is resting', () => {
    const n = lvl('r/h E4/h', '[C3 G3]/h C3/h');
    expect(micMelody(n).scored.map((x) => x.name)).toEqual(['G3', 'E4']);
  });
});

describe('scorer ghosts', () => {
  const sc = () => createScorer([{ id: 0, midi: 64, time: 0 }, { id: 1, midi: 65, time: 500 }], { windowMs: 100, ghosts: [{ midi: 48, time: 0 }] });
  it('an unscored note at the right time keeps the combo', () => {
    const s = sc();
    s.input(64, 0);
    expect(s.input(48, 20).type).toBe('ghost');
    expect(s.combo).toBe(1);
    s.input(65, 500);
    expect(s.summary()).toMatchObject({ hits: 2, extras: 0, accuracy: 100 });
  });
  it('the same note far from its time is an extra', () => {
    const s = sc();
    s.input(64, 0);
    expect(s.input(48, 450).type).toBe('extra');
    expect(s.combo).toBe(0);
  });
});

describe('generated sight-reading', () => {
  const spec = { keys: ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb'], times: ['4/4', '3/4'], bars: 8 };
  it('is deterministic per seed', () => {
    expect(generatePassage(spec, 42)).toEqual(generatePassage(spec, 42));
    expect(generatePassage(spec, 42)).not.toEqual(generatePassage(spec, 43));
  });
  it('spells scale notes from the key signature', () => {
    expect(scaleNote('G', 'G4', 6)).toBe('F#5');
    expect(scaleNote('Bb', 'Bb3', 1)).toBe('C4');
    expect(scaleNote('Eb', 'Eb4', 3)).toBe('Ab4');
    expect(scaleNote('A', 'A2', -1)).toBe('G#2');
  });
  it('rng stays in [0, 1)', () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) { const x = r(); expect(x >= 0 && x < 1).toBe(true); }
  });
  it('every passage parses, fits the keyboard and ends on the tonic', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const g = generatePassage(spec, seed);
      const p = parseLevel(g);
      expect(p.bars).toBe(8);
      const notes = expectedNotes(p);
      for (const n of notes) expect(n.midi >= 36 && n.midi <= 96).toBe(true);
      const rh = notes.filter((n) => n.part === 'rh');
      const lh = notes.filter((n) => n.part === 'lh');
      expect(rh.at(-1).name.replace(/\d/, '')).toBe(g.key);
      expect(lh.at(-1).name.replace(/\d/, '')).toBe(g.key);
      // Hands stay apart: left hand below the right hand's lowest note.
      expect(Math.max(...lh.map((n) => n.midi))).toBeLessThan(Math.min(...rh.map((n) => n.midi)));
      // Mostly steps: few leaps bigger than a fourth.
      const leaps = rh.slice(1).filter((n, i) => Math.abs(n.midi - rh[i].midi) > 5).length;
      expect(leaps).toBeLessThanOrEqual(4);
    }
  });
  it('right-hand-only passages have no left hand', () => {
    expect(generatePassage({ ...spec, hands: 'right' }, 3).parts.lh).toBeUndefined();
  });
});
