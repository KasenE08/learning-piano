import { describe, it, expect } from 'vitest';
import { render, detect } from './helpers/synth.js';
import { freqToMidi } from '../src/audio/analysis.js';

const names = (ev) => ev.map((e) => e.midi);

describe('pitch → MIDI', () => {
  it('maps frequencies to notes', () => {
    expect(Math.round(freqToMidi(440))).toBe(69);
    expect(Math.round(freqToMidi(261.63))).toBe(60);
    expect(Math.round(freqToMidi(65.41))).toBe(36);
    expect(Math.round(freqToMidi(2093))).toBe(96);
  });
});

describe('single notes across the 61-key range (C2–C7)', () => {
  const keys = [36, 38, 40, 43, 45, 48, 52, 55, 60, 64, 67, 69, 72, 76, 79, 84, 88, 91, 96];
  for (const midi of keys) {
    it(`detects MIDI ${midi} once, on time`, () => {
      const sig = render({ notes: [{ midi, at: 0.3, dur: 0.6 }], seconds: 1.2, fundamental: midi < 48 ? 0.35 : 1 });
      const ev = detect(sig);
      expect(names(ev)).toEqual([midi]);
      expect(Math.abs(ev[0].time - 0.3)).toBeLessThan(0.035);
    });
  }
});

describe('melodies', () => {
  it('detects repeated notes (Ode to Joy opening) at 100 BPM', () => {
    const seq = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64];
    const beat = 0.6;
    const notes = seq.map((midi, i) => ({ midi, at: 0.4 + i * beat, dur: beat * 0.9 }));
    const ev = detect(render({ notes, seconds: 0.4 + seq.length * beat + 0.6 }));
    expect(names(ev)).toEqual(seq);
    ev.forEach((e, i) => expect(Math.abs(e.time - notes[i].at)).toBeLessThan(0.04));
  });

  it('detects fast repeated notes (eighths at 120 BPM)', () => {
    const notes = Array.from({ length: 8 }, (_, i) => ({ midi: 67, at: 0.3 + i * 0.25, dur: 0.22 }));
    const ev = detect(render({ notes, seconds: 2.6 }));
    expect(names(ev)).toEqual(Array(8).fill(67));
  });

  it('detects legato steps where keys overlap', () => {
    const seq = [60, 62, 64, 65, 67];
    const notes = seq.map((midi, i) => ({ midi, at: 0.3 + i * 0.4, dur: 0.48 }));
    const ev = detect(render({ notes, seconds: 2.6 }));
    expect(names(ev)).toEqual(seq);
  });

  it('detects soft playing', () => {
    const seq = [60, 64, 67, 72];
    const notes = seq.map((midi, i) => ({ midi, at: 0.3 + i * 0.5, dur: 0.45, vel: 0.12 }));
    const ev = detect(render({ notes, seconds: 2.6, noiseDb: -66 }), { noiseDb: -64 });
    expect(names(ev)).toEqual(seq);
  });
});

describe('things that are not notes', () => {
  it('ignores room noise', () => {
    expect(detect(render({ seconds: 2, noiseDb: -55 }), { noiseDb: -55 })).toEqual([]);
  });

  it('ignores metronome clicks, alone and on top of notes', () => {
    const clicks = [0.3, 0.9, 1.5, 2.1, 2.7];
    expect(detect(render({ clicks, seconds: 3 }))).toEqual([]);
    const notes = [{ midi: 60, at: 0.9, dur: 1.7 }];
    expect(names(detect(render({ notes, clicks, seconds: 3 })))).toEqual([60]);
  });

  it('does not repeat a long ringing note', () => {
    const ev = detect(render({ notes: [{ midi: 48, at: 0.2, dur: 2.5 }], seconds: 3 }));
    expect(names(ev)).toEqual([48]);
  });

  it('ignores notes outside the calibrated range', () => {
    const sig = render({ notes: [{ midi: 30, at: 0.3, dur: 0.5 }, { midi: 60, at: 1, dur: 0.5 }], seconds: 1.8 });
    expect(names(detect(sig, { low: 36, high: 96 }))).toEqual([60]);
  });
});

describe('stress', () => {
  it('melody with the metronome clicking on every beat', () => {
    const seq = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
    const beat = 0.6;
    const notes = seq.map((midi, i) => ({ midi, at: 0.6 + i * beat, dur: beat * 0.92 }));
    const clicks = Array.from({ length: seq.length + 2 }, (_, i) => i * beat);
    const ev = detect(render({ notes, clicks, seconds: 0.6 + seq.length * beat + 0.6 }));
    expect(names(ev)).toEqual(seq);
  });

  it('random melodies (C3–C6, mixed rhythms, varied loudness) are ≥ 97% right', () => {
    let rng = 42;
    const r = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; };
    let total = 0;
    let right = 0;
    for (let trial = 0; trial < 6; trial++) {
      const notes = [];
      let t = 0.4;
      let prev = 60;
      for (let i = 0; i < 24; i++) {
        const midi = Math.max(48, Math.min(84, prev + Math.round((r() - 0.5) * 10)));
        const len = [0.25, 0.5, 0.5, 0.75, 1][Math.floor(r() * 5)];
        notes.push({ midi, at: t, dur: len * 0.9, vel: 0.25 + r() * 0.6 });
        t += len;
        prev = midi;
      }
      const ev = detect(render({ notes, seconds: t + 0.8, noiseDb: -62 }));
      // Match each true note to a detection of the same pitch within 60 ms.
      const used = new Set();
      for (const n of notes) {
        total++;
        const k = ev.findIndex((e, i) => !used.has(i) && e.midi === n.midi && Math.abs(e.time - n.at) < 0.06);
        if (k >= 0) { used.add(k); right++; }
      }
      // No more than one stray detection per melody.
      expect(ev.length - used.size).toBeLessThanOrEqual(1);
    }
    expect(right / total).toBeGreaterThanOrEqual(0.97);
  }, 30000);
});

describe('repeated note right after a short note', () => {
  for (const bpm of [60, 80, 100, 120, 140]) {
    it(`dotted quarter → eighth → half on the same pitch at ${bpm} BPM`, () => {
      const b = 60 / bpm;
      for (const [a, x] of [[64, 62], [62, 60], [67, 65], [72, 71]]) {
        const notes = [
          { midi: a, at: 0.3, dur: 1.5 * b * 0.92 },
          { midi: x, at: 0.3 + 1.5 * b, dur: 0.5 * b * 0.92 },
          { midi: x, at: 0.3 + 2 * b, dur: 2 * b * 0.92 },
        ];
        const ev = detect(render({ notes, seconds: 0.3 + 4 * b + 0.5, noiseDb: -64 }));
        expect(ev.map((e) => e.midi), `${a},${x},${x} @${bpm}`).toEqual([a, x, x]);
      }
    });
  }
});

describe('robust to where analysis frames fall', () => {
  it('detects every note of the full Ode to Joy level at 8 frame alignments', async () => {
    const { readFileSync } = await import('node:fs');
    const { parseLevel, expectedNotes } = await import('../src/engine/notation.js');
    const level = JSON.parse(readFileSync(new URL('../src/content/levels/noob/09.json', import.meta.url), 'utf8'));
    const beat = 60 / level.tempo.default;
    const expected = expectedNotes(parseLevel(level));
    const notes = expected.map((n) => ({ midi: n.midi, at: 0.5 + n.beat * beat, dur: n.beats * beat * 0.92, vel: 0.7 }));
    const sig = render({ notes, seconds: 0.5 + 32 * beat + 1, noiseDb: -64 });
    for (let phase = 0; phase < 512; phase += 64) {
      const ev = detect(sig, { noiseDb: -60 }, phase);
      expect(ev.map((e) => e.midi), `phase ${phase}`).toEqual(expected.map((n) => n.midi));
    }
  }, 30000);
});

describe('starting to listen', () => {
  it('does not report a note that was already ringing when listening began', () => {
    const sig = render({ notes: [{ midi: 36, at: 0.1, dur: 2.5 }, { midi: 72, at: 1.6, dur: 0.5 }], seconds: 2.6 });
    // Skip the first 0.8 s: the low C is already sounding when the detector starts.
    const ev = detect(sig.subarray(Math.floor(0.8 * 48000)), {});
    expect(ev.map((e) => e.midi)).toEqual([72]);
  });
});
