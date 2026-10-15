import { describe, it, expect } from 'vitest';
import { createScorer, judgeTiming, summarize } from '../src/engine/scorer.js';
import { TIMING_WINDOWS_MS } from '../src/config/scoring.js';

const notes = (...spec) => spec.map(([midi, time], id) => ({ id, midi, time }));

describe('timing judgement', () => {
  it('uses the inner 40% of the window as on time', () => {
    expect(judgeTiming(0, 200)).toBe('ontime');
    expect(judgeTiming(80, 200)).toBe('ontime');
    expect(judgeTiming(-80, 200)).toBe('ontime');
    expect(judgeTiming(81, 200)).toBe('late');
    expect(judgeTiming(-81, 200)).toBe('early');
    expect(judgeTiming(200, 200)).toBe('late');
    expect(judgeTiming(201, 200)).toBe(null);
  });
  it('tightens with each section window', () => {
    const offset = 90;
    expect(judgeTiming(offset, TIMING_WINDOWS_MS.noob)).toBe('late');
    expect(judgeTiming(offset, TIMING_WINDOWS_MS.intermediate)).toBe('late');
    expect(judgeTiming(offset, TIMING_WINDOWS_MS.advanced)).toBe(null);
    expect(judgeTiming(70, TIMING_WINDOWS_MS.noob)).toBe('ontime');
    expect(judgeTiming(70, TIMING_WINDOWS_MS.advanced)).toBe('late');
  });
});

describe('scorer', () => {
  it('scores a clean run as 100% with a full combo', () => {
    const s = createScorer(notes([60, 0], [62, 500], [64, 1000]), { windowMs: 200 });
    expect(s.input(60, 10).type).toBe('hit');
    expect(s.input(62, 470).timing).toBe('ontime');
    expect(s.input(64, 1150).timing).toBe('late');
    s.tick(5000);
    const r = s.summary();
    expect(r).toMatchObject({ total: 3, hits: 3, ontime: 2, late: 1, accuracy: 100, stars: 3, maxCombo: 3 });
  });

  it('is octave-strict: right note, wrong octave is not a hit', () => {
    const s = createScorer(notes([60, 0]), { windowMs: 200 });
    expect(s.input(72, 0).type).toBe('extra');
    s.tick(1000);
    expect(s.summary()).toMatchObject({ hits: 0, accuracy: 0 });
  });

  it('marks notes missed only after their window has passed', () => {
    const s = createScorer(notes([60, 1000]), { windowMs: 150 });
    expect(s.tick(1150)).toHaveLength(0);
    expect(s.tick(1151).map((n) => n.midi)).toEqual([60]);
    expect(s.input(60, 1160).type).toBe('extra');
  });

  it('wrong/extra notes break the combo but do not lower accuracy', () => {
    const s = createScorer(notes([60, 0], [62, 500], [64, 1000]), { windowMs: 200 });
    s.input(60, 0);
    s.input(62, 500);
    expect(s.combo).toBe(2);
    expect(s.input(65, 700).type).toBe('extra');
    expect(s.combo).toBe(0);
    s.input(64, 1000);
    s.tick(5000);
    const r = s.summary();
    expect(r.accuracy).toBe(100);
    expect(r.extras).toBe(1);
    expect(r.maxCombo).toBe(2);
  });

  it('a miss resets the combo', () => {
    const s = createScorer(notes([60, 0], [62, 500], [64, 1000]), { windowMs: 200 });
    s.input(60, 0);
    s.tick(800); // 62 missed
    expect(s.combo).toBe(0);
    s.input(64, 1000);
    expect(s.combo).toBe(1);
    s.tick(5000);
    const r = s.summary();
    expect(r.accuracy).toBeCloseTo(66.67, 1);
    expect(r.stars).toBe(0);
    expect(r.missed.map((n) => n.midi)).toEqual([62]);
  });

  it('cannot hit the same note twice', () => {
    const s = createScorer(notes([60, 0]), { windowMs: 200 });
    expect(s.input(60, 0).type).toBe('hit');
    expect(s.input(60, 20).type).toBe('extra');
  });

  it('consumes fast repeated notes in order', () => {
    const s = createScorer(notes([64, 0], [64, 250], [64, 500]), { windowMs: 200 });
    expect(s.input(64, 130).note.id).toBe(0); // late for #0 rather than early for #1
    expect(s.input(64, 260).note.id).toBe(1);
    expect(s.input(64, 480).note.id).toBe(2);
  });

  it('scores chords note by note', () => {
    const s = createScorer(notes([60, 0], [64, 0], [67, 0]), { windowMs: 150 });
    s.input(60, 5);
    s.input(67, -20);
    s.tick(1000);
    expect(s.summary()).toMatchObject({ hits: 2, total: 3 });
  });

  it('reports the next notes to play', () => {
    const s = createScorer(notes([60, 0], [64, 0], [67, 500]), { windowMs: 150 });
    expect(s.upcoming().map((n) => n.midi)).toEqual([60, 64]);
    s.input(60, 0);
    expect(s.upcoming().map((n) => n.midi)).toEqual([64]);
    s.input(64, 0);
    expect(s.upcoming().map((n) => n.midi)).toEqual([67]);
  });

  it('awards stars at the agreed thresholds', () => {
    const mk = (hits, total) => summarize(Array.from({ length: total }, (_, i) => ({ result: i < hits ? 'ontime' : 'miss' })));
    expect(mk(69, 100).stars).toBe(0);
    expect(mk(70, 100).stars).toBe(1);
    expect(mk(85, 100).stars).toBe(2);
    expect(mk(95, 100).stars).toBe(3);
  });
});
