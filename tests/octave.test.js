import { describe, it, expect } from 'vitest';
import { render, detect } from './helpers/synth.js';
import { nameOf } from '../src/core/music.js';

// Some keyboard samples, heard through a phone mic, are mostly even harmonics:
// the pitch tracker then locks onto half the period and names the note an octave up.
const heard = (midi, opts) => detect(render({ notes: [{ midi, at: 0.5, dur: 1, vel: 0.7 }], seconds: 2, noiseDb: -64, phaseSeed: midi, ...opts }))
  .filter((e) => !e.dropped).map((e) => nameOf(e.midi));

describe('octave errors on even-heavy tones', () => {
  // At ×0.15 the pitch tracker alone names every one of these an octave up.
  it("G3 and B3 aren't heard an octave up", () => {
    expect(heard(55, { odd: 0.15 })).toEqual(['G3']);
    expect(heard(59, { odd: 0.15 })).toEqual(['B3']);
  });
  it('nearby keys (E3 to B4) keep their octave too', () => {
    for (const m of [52, 57, 60, 62, 64, 67, 71]) for (const odd of [0.15, 0.3]) expect(heard(m, { odd }), `${nameOf(m)} ×${odd}`).toEqual([nameOf(m)]);
  });
  it('an ordinary piano tone is never moved down an octave', { timeout: 60000 }, () => {
    for (let m = 36; m <= 96; m++) expect(heard(m, {})[0], nameOf(m)).toBe(nameOf(m));
  });
});
