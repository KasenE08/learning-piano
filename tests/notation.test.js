import { describe, it, expect } from 'vitest';
import { parseToken, parsePart, parseLevel, expectedNotes, durationBeats, measureBeats, keyboardWindow, noteRange } from '../src/engine/notation.js';

describe('tokens', () => {
  it('reads notes, rests, dots, fingers, ties and chords', () => {
    expect(parseToken('C4/q')).toMatchObject({ keys: [60], beats: 1, rest: false, fingers: [] });
    expect(parseToken('F#4/8:3')).toMatchObject({ keys: [66], beats: 0.5, fingers: [3] });
    expect(parseToken('Bb3/qd')).toMatchObject({ keys: [58], beats: 1.5, dots: 1 });
    expect(parseToken('E4/h~')).toMatchObject({ keys: [64], tie: true });
    expect(parseToken('r/h')).toMatchObject({ rest: true, keys: [], beats: 2 });
    expect(parseToken('[C4 E4 G4]/h:1-3-5')).toMatchObject({ keys: [60, 64, 67], fingers: [1, 3, 5] });
    expect(parseToken('c4/w')).toMatchObject({ names: ['C4'], keys: [60], beats: 4 });
  });
  it('rejects malformed tokens', () => {
    expect(() => parseToken('C4')).toThrow();
    expect(() => parseToken('H4/q')).toThrow();
    expect(() => parseToken('C4/3')).toThrow();
    expect(() => parseToken('[C4 E4]/q:1')).toThrow(/fingers/);
  });
  it('knows durations and bar lengths', () => {
    expect(durationBeats('h', 2)).toBe(3.5);
    expect(measureBeats('4/4')).toBe(4);
    expect(measureBeats('3/4')).toBe(3);
    expect(measureBeats('6/8')).toBe(3);
  });
});

describe('parts and bars', () => {
  it('assigns start beats across bars', () => {
    const m = parsePart('C4/q D4/q E4/h | F4/w');
    expect(m).toHaveLength(2);
    expect(m[0].events.map((e) => e.beat)).toEqual([0, 1, 2]);
    expect(m[1].start).toBe(4);
    expect(m[1].events[0].beat).toBe(4);
  });
  it('rejects bars with the wrong number of beats', () => {
    expect(() => parsePart('C4/q D4/q | E4/w')).toThrow(/Bar 1 has 2 beats/);
    expect(() => parsePart('C4/h. ')).toThrow();
  });
  it('allows a short pickup bar only when declared', () => {
    expect(() => parsePart('G3/q | C4/w', { pickup: true })).not.toThrow();
    expect(() => parsePart('G3/q | C4/w')).toThrow();
  });
  it('supports 3/4', () => {
    expect(() => parsePart('C4/hd | D4/q E4/q F4/q', { time: '3/4' })).not.toThrow();
  });
  it('requires parts to have matching bar counts', () => {
    expect(() => parseLevel({ parts: { rh: 'C4/w | C4/w', lh: 'C3/w' } })).toThrow(/bar counts/);
  });
});

describe('expected notes', () => {
  it('lists notes in time order, chords as separate notes, rests skipped', () => {
    const p = parseLevel({ parts: { rh: 'E4/q r/q [C4 G4]/h', lh: 'C3/w' } });
    const n = expectedNotes(p);
    expect(n.map((x) => [x.name, x.beat])).toEqual([['C3', 0], ['E4', 0], ['C4', 2], ['G4', 2]]);
    expect(n.map((x) => x.id)).toEqual([0, 1, 2, 3]);
    expect(p.totalBeats).toBe(4);
  });
  it('merges tied notes into one longer note', () => {
    const n = expectedNotes(parseLevel({ parts: { rh: 'C4/h E4/h~ | E4/h D4/h' } }));
    expect(n.map((x) => [x.name, x.beat, x.beats])).toEqual([['C4', 0, 2], ['E4', 2, 4], ['D4', 6, 2]]);
  });
  it('keeps repeated (untied) notes separate', () => {
    const n = expectedNotes(parseLevel({ parts: { rh: 'E4/q E4/q E4/h' } }));
    expect(n).toHaveLength(3);
  });
});

describe('keyboard window', () => {
  it('shows 3 octaves from a C that cover the piece', () => {
    expect(keyboardWindow({ lo: 60, hi: 67 })).toEqual({ low: 48, keys: 36 });
    expect(keyboardWindow({ lo: 48, hi: 79 })).toEqual({ low: 48, keys: 36 });
    expect(keyboardWindow({ lo: 72, hi: 84 })).toEqual({ low: 60, keys: 36 });
  });
  it('stays inside the 61-key keyboard (C2–C7)', () => {
    expect(keyboardWindow({ lo: 36, hi: 40 }).low).toBe(36);
    const w = keyboardWindow({ lo: 92, hi: 96 });
    expect(w.low + w.keys - 1).toBeLessThanOrEqual(96);
  });
  it('widens for pieces larger than 3 octaves', () => {
    const w = keyboardWindow({ lo: 41, hi: 84 });
    expect(w.keys).toBeGreaterThan(36);
    expect(w.keys % 12).toBe(0);
    expect(w.low).toBeLessThanOrEqual(41);
    expect(w.low + w.keys - 1).toBeGreaterThanOrEqual(84);
  });
  it('computes note range', () => {
    expect(noteRange([{ midi: 64 }, { midi: 55 }, { midi: 72 }])).toEqual({ lo: 55, hi: 72 });
  });
});
