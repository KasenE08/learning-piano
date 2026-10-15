import { describe, it, expect } from 'vitest';
import { render, SR } from './helpers/synth.js';
import { createSpectrum, PROBE_SIZE } from '../src/audio/salience.js';
import { nnls, candidatesFor, chordHeard } from '../src/audio/chords.js';
import { hiddenNotes, micScoring, onsetGroups, parseLevel, expectedNotes } from '../src/engine/notation.js';
import { createScorer, wholeChords } from '../src/engine/scorer.js';
import { midiOf, nameOf } from '../src/core/music.js';

describe('non-negative least squares', () => {
  it('recovers a non-negative mix', () => {
    const A = [[1, 0], [0.5, 1], [0, 0.5]];
    const x = nnls(A, [2, 4, 1.5]);
    expect(x[0]).toBeCloseTo(2, 3);
    expect(x[1]).toBeCloseTo(3, 3);
  });
  it('never goes negative', () => {
    const x = nnls([[1, 1], [1, 0]], [1, 3]);
    expect(Math.min(...x)).toBeGreaterThanOrEqual(0);
  });
});

describe('hidden chord tones', () => {
  const H = (...names) => [...hiddenNotes(names.map(midiOf))].map(nameOf);
  it('an octave, 12th or two octaves above another chord tone is hidden', () => {
    expect(H('C3', 'C4')).toEqual(['C4']);
    expect(H('C3', 'G4')).toEqual(['G4']);
    expect(H('C2', 'C4')).toEqual(['C4']);
  });
  it('triads, 10ths and 17ths are not', () => {
    expect(H('C4', 'E4', 'G4')).toEqual([]);
    expect(H('C3', 'E4')).toEqual([]);
    expect(H('C2', 'E4')).toEqual([]);
  });
  it('scoring split keeps every note except hidden ones, chord by chord', () => {
    const notes = expectedNotes(parseLevel({ parts: { rh: '[C4 E4 G4]/h E4/h', lh: 'C3/h C3/h' } }));
    const { scored, ghosts } = micScoring(notes);
    expect(ghosts.map((n) => n.name)).toEqual(['C4', 'G4']);
    expect(scored.map((n) => n.name).sort()).toEqual(['C3', 'C3', 'E4', 'E4']);
    expect(onsetGroups(notes).map((g) => g.notes.length)).toEqual([4, 2]);
  });
  it('candidates cover neighbours, whole steps and octaves', () => {
    expect(candidatesFor([60])).toEqual([48, 58, 59, 60, 61, 62, 72]);
  });
});

describe('Advanced: chords are all or nothing', () => {
  const expected = [{ id: 0, midi: 60, time: 0 }, { id: 1, midi: 64, time: 0 }, { id: 2, midi: 67, time: 0 }, { id: 3, midi: 72, time: 1000 }];
  const play = (rule) => {
    const s = createScorer(expected, { windowMs: 75, chordRule: rule });
    s.input(60, 0);
    s.input(64, 0); // G4 never played
    s.input(72, 1000);
    s.tick(Infinity);
    return s.summary();
  };
  it('earlier sections score each note', () => {
    expect(play('each')).toMatchObject({ hits: 3, total: 4 });
  });
  it('Advanced misses the whole chord when one note is missing', () => {
    expect(play('all')).toMatchObject({ hits: 1, total: 4 });
  });
  it('a full chord still counts', () => {
    const marked = wholeChords(expected.map((n) => ({ ...n, result: 'ontime' })));
    expect(marked.every((n) => n.result === 'ontime')).toBe(true);
  });
});

describe('hearing chords (template matching, simulated piano)', () => {
  const spec = createSpectrum(SR);
  const at = (sig, t) => spec.of(sig, Math.round(t * SR) - PROBE_SIZE);
  const CHORDS = [
    ['C4', 'E4', 'G4'], ['A3', 'C4', 'E4'], ['E4', 'G4', 'C5'], ['G3', 'C4', 'E4'], ['C4', 'F4', 'A4'], ['B3', 'D4', 'G4'],
    ['D4', 'F#4', 'A4'], ['Eb4', 'G4', 'Bb4'], ['C5', 'E5', 'G5'], ['E4', 'G4'], ['C4', 'A4'], ['E4', 'F4'], ['C4', 'D4', 'E4'],
    ['C3', 'G3'], ['C3', 'E4'], ['C3', 'C4', 'E4', 'G4'], ['G2', 'B3', 'D4', 'G4'], ['F2', 'A3', 'C4', 'F4'],
  ];
  const play = (midis, fundamental, seed) => render({
    notes: midis.map((m, i) => ({ midi: m, at: 0.6 + i * 0.004, dur: 0.8, vel: m < 52 ? 0.55 : 0.6 })), seconds: 1.6, fundamental, phaseSeed: seed,
  });
  const heard = (sig, midis) => chordHeard(at(sig, 0.59), at(sig, 0.73), spec.binHz, midis);

  for (const fundamental of [1, 0.4]) {
    it(`hears chord tones and doesn't credit wrong or missing ones (fundamental ${fundamental})`, () => {
      let total = 0;
      let got = 0;
      let leftOut = 0;
      let wrongKey = 0;
      for (const names of CHORDS) {
        const ms = names.map(midiOf);
        const hid = hiddenNotes(ms);
        const scorable = ms.filter((m) => !hid.has(m));
        const h = heard(play(ms, fundamental, ms[0]), ms);
        total += scorable.length;
        got += scorable.filter((m) => h.has(m)).length;
        scorable.forEach((m, k) => {
          const rest = ms.filter((x) => x !== m);
          if (rest.length && heard(play(rest, fundamental, ms[0] + k), ms).has(m)) leftOut++;
          const swapped = ms.map((x) => (x === m ? m + 1 : x));
          if (heard(play(swapped, fundamental, ms[0] + 7 * k), ms).has(m)) wrongKey++;
        });
      }
      expect(got / total).toBeGreaterThanOrEqual(0.95);
      expect(leftOut).toBe(0);
      // Known weak spot: a wrong bass key right next to the right one (low notes sit close together).
      expect(wrongKey / total).toBeLessThanOrEqual(0.08);
    }, 120000);
  }
});

describe('detector reports chord strikes', async () => {
  const { detect } = await import('./helpers/synth.js');
  it('every block chord shows up as an attack for onset listeners', () => {
    const chords = [['C4', 'E4', 'G4'], ['C4', 'F4', 'A4'], ['B3', 'D4', 'G4'], ['A3', 'C4', 'E4'], ['C3', 'E4', 'G4']];
    const sig = render({ notes: chords.flatMap((ch, i) => ch.map((n) => ({ midi: midiOf(n), at: 0.5 + i * 1.5, dur: 1, vel: 0.6 }))), seconds: 8 });
    const attacks = detect(sig, { reportDropped: true }).filter((e) => e.how === 'attack');
    chords.forEach((_, i) => {
      const t = 0.5 + i * 1.5;
      expect(attacks.some((e) => Math.abs(e.time - t) < 0.08), `chord ${i + 1} at ${t}s`).toBe(true);
    });
  }, 30000);
  it('pitchless attacks are not passed to plain note listeners (they come marked dropped)', () => {
    const sig = render({ notes: ['C4', 'E4', 'G4'].map((n) => ({ midi: midiOf(n), at: 0.5, dur: 1, vel: 0.6 })), seconds: 2 });
    detect(sig, { reportDropped: true }).filter((e) => e.midi == null).forEach((e) => expect(e.dropped).toBe(true));
  });
});

describe('live accuracy follows the chord rule', async () => {
  const { liveAccuracy } = await import('../src/engine/scorer.js');
  const notes = [
    { time: 0, result: 'ontime' }, { time: 0, result: 'ontime' }, { time: 0, result: 'miss' },
    { time: 500, result: 'ontime' }, { time: 1000, result: null },
  ];
  it('each note on its own', () => expect(liveAccuracy(notes, 'each')).toBe(75));
  it('a broken chord counts as missed in full (Advanced)', () => expect(liveAccuracy(notes, 'all')).toBe(25));
  it('nothing judged yet', () => expect(liveAccuracy([{ time: 0, result: null }])).toBe(null));
});
