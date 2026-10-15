import { describe, it, expect } from 'vitest';
import { createDrill, drillPrompts } from '../src/engine/drill.js';

describe('find-the-key drills', () => {
  const prompts = drillPrompts({ prompts: ['C4', 'C5', 'E4', 'G3'] });
  it('turns names into MIDI prompts', () => {
    expect(prompts.map((p) => p.midi)).toEqual([60, 72, 64, 55]);
  });
  it('counts only the first answer to each prompt, octave-strict', () => {
    const d = createDrill(prompts);
    expect(d.answer(60).type).toBe('hit');
    expect(d.answer(60).type).toBe('miss'); // C4 for C5: wrong octave
    expect(d.answer(64).type).toBe('hit');
    expect(d.done()).toBe(false);
    expect(d.answer(55).type).toBe('hit');
    expect(d.done()).toBe(true);
    const s = d.summary();
    expect(s).toMatchObject({ total: 4, hits: 3, accuracy: 75, stars: 1, maxCombo: 2, untimed: true });
    expect(s.missed.map((p) => p.name)).toEqual(['C5']);
  });
  it('builds combo XP like timed levels', () => {
    const many = drillPrompts({ prompts: Array(12).fill('C4') });
    const d = createDrill(many);
    many.forEach(() => d.answer(60));
    expect(d.summary().hitXp).toBe(9 + 3 * 2);
  });
});
