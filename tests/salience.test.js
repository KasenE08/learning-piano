import { describe, it, expect } from 'vitest';
import { render, SR } from './helpers/synth.js';
import { createSpectrum, newNote, PROBE_SIZE } from '../src/audio/salience.js';

const spec = createSpectrum(SR);
// Spectra just before an onset and ~120 ms after it, like the mic does.
const probe = (sig, onset, midi, after = 0.12) => {
  const end = (t) => Math.round(t * SR) - PROBE_SIZE;
  const before = spec.of(sig, end(onset - 0.01));
  const now = spec.of(sig, end(onset + after));
  return newNote(before, now, spec.binHz, midi);
};

describe('targeted note check (melody under a left hand)', () => {
  it('hears the melody note when both hands start together', () => {
    const sig = render({ notes: [{ midi: 64, at: 0.5, dur: 0.6, vel: 0.7 }, { midi: 48, at: 0.5, dur: 1, vel: 0.55 }], seconds: 1.2 });
    expect(probe(sig, 0.5, 64)).toBe(true);
    for (const m of [62, 63, 65, 66, 67]) expect(probe(sig, 0.5, m), `heard ${m}`).toBe(false);
  });

  it('does not hear a note that was not played', () => {
    const sig = render({ notes: [{ midi: 48, at: 0.5, dur: 1, vel: 0.7 }], seconds: 1.2 });
    for (const m of [62, 64, 65, 67, 69]) expect(probe(sig, 0.5, m), `heard ${m}`).toBe(false);
  });

  it('a ringing melody note is not a new one when the left hand strikes', () => {
    const sig = render({ notes: [{ midi: 64, at: 0.2, dur: 1.2, vel: 0.7 }, { midi: 43, at: 0.7, dur: 0.6, vel: 0.6 }], seconds: 1.5 });
    expect(probe(sig, 0.7, 64)).toBe(false);
  });

  it('hears a repeated melody note over a held bass', () => {
    const sig = render({ notes: [{ midi: 48, at: 0.1, dur: 1.5, vel: 0.5 }, { midi: 64, at: 0.3, dur: 0.35, vel: 0.7 }, { midi: 64, at: 0.75, dur: 0.4, vel: 0.7 }], seconds: 1.6 });
    expect(probe(sig, 0.75, 64)).toBe(true);
  });

  it('works across the right hand range with different bass notes', () => {
    let ok = 0;
    let wrong = 0;
    let total = 0;
    for (let rh = 58; rh <= 86; rh += 3) {
      for (const lh of [36, 43, 48, 52, 55]) {
        const sig = render({ notes: [{ midi: rh, at: 0.4, dur: 0.5, vel: 0.65 }, { midi: lh, at: 0.4, dur: 0.8, vel: 0.55 }], seconds: 1, phaseSeed: rh * 7 + lh });
        total++;
        if (probe(sig, 0.4, rh)) ok++;
        if (probe(sig, 0.4, rh + 1) || probe(sig, 0.4, rh - 1)) wrong++;
      }
    }
    expect(ok / total).toBeGreaterThanOrEqual(0.95);
    expect(wrong).toBe(0);
  }, 30000);
});

describe('score following on a real level (Intermediate 1, Ode to Joy over a bass)', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseLevel, expectedNotes, micMelody } = await import('../src/engine/notation.js');
  const lvl = JSON.parse(readFileSync(new URL('../src/content/levels/intermediate/01.json', import.meta.url), 'utf8'));
  const b = 60 / lvl.tempo.default;
  const all = expectedNotes(parseLevel(lvl));
  const melody = micMelody(all).scored;
  const at = (n) => 0.5 + n.beat * b;
  const play = (parts, offsetMs = () => 0) => render({
    notes: all.filter((n) => parts.includes(n.part)).map((n, i) => ({ midi: n.midi, at: at(n) + offsetMs(i) / 1000, dur: n.beats * b * 0.92, vel: n.part === 'lh' ? 0.45 : 0.7 })),
    seconds: 0.5 + 32 * b + 1,
  });
  // Same search as the app: onsets within ±100 ms in 35 ms steps.
  const startedNear = (sig, midi, t) => [0, -1, 1, -2, 2].some((k) => probe(sig, t + k * 0.035, midi, 0.13));

  it('finds nearly every melody note when both hands play (even slightly off time)', () => {
    const sig = play(['rh', 'lh'], (i) => ((i * 37) % 120) - 60);
    const hits = melody.filter((n) => startedNear(sig, n.midi, at(n))).length;
    expect(hits / melody.length).toBeGreaterThanOrEqual(0.9);
  }, 60000);

  it('awards almost nothing when only the left hand plays', () => {
    const sig = play(['lh']);
    const rhNotes = melody.filter((n) => n.part === 'rh');
    const false_ = rhNotes.filter((n) => startedNear(sig, n.midi, at(n))).length;
    expect(false_ / rhNotes.length).toBeLessThanOrEqual(0.1);
  }, 60000);

  it('does not award wrong notes a step away', () => {
    const sig = play(['rh', 'lh']);
    const wrong = melody.filter((n) => n.part === 'rh' && (startedNear(sig, n.midi + 1, at(n)) || startedNear(sig, n.midi - 1, at(n)))).length;
    expect(wrong).toBeLessThanOrEqual(1);
  }, 60000);
});

describe('right-hand keys over a held low C (the two-key check)', () => {
  // Digital pianos through a phone mic: a loud held bass, a softer right hand,
  // and weak fundamentals (most energy in the overtones).
  const at = (sig, t) => spec.of(sig, Math.round(t * SR) - PROBE_SIZE);
  for (const [lhVel, rhVel, fundamental] of [[0.6, 0.65, 1], [0.8, 0.45, 1], [0.8, 0.45, 0.4]]) {
    it(`C4–C6 over a held C3 (bass ${lhVel}, melody ${rhVel}, fundamental ${fundamental})`, () => {
      const missed = [];
      const neighbour = [];
      const bassAlone = [];
      for (let rh = 60; rh <= 84; rh++) {
        const sig = render({ notes: [{ midi: 48, at: 0.2, dur: 2.5, vel: lhVel }, { midi: rh, at: 1.4, dur: 0.6, vel: rhVel }], seconds: 2.4, phaseSeed: rh, fundamental });
        const b = at(sig, 1.39);
        const a = at(sig, 1.53);
        if (!newNote(b, a, spec.binHz, rh)) missed.push(rh);
        if (newNote(b, a, spec.binHz, rh - 1) || newNote(b, a, spec.binHz, rh + 1)) neighbour.push(rh);
        const bass = render({ notes: [{ midi: 48, at: 1.4, dur: 1, vel: lhVel }], seconds: 2.4, phaseSeed: rh, fundamental });
        if (newNote(at(bass, 1.39), at(bass, 1.53), spec.binHz, rh)) bassAlone.push(rh);
      }
      expect({ missed, neighbour, bassAlone }).toEqual({ missed: [], neighbour: [], bassAlone: [] });
    }, 60000);
  }
});
