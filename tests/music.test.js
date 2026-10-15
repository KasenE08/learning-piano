import { describe, it, expect } from 'vitest';
import { midiOf, nameOf, isBlack, frequencyOf } from '../src/core/music.js';

describe('note helpers', () => {
  it('converts names and MIDI numbers both ways', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('Bb3')).toBe(58);
    expect(midiOf('F#5')).toBe(78);
    expect(nameOf(60)).toBe('C4');
    expect(nameOf(48)).toBe('C3');
    expect(nameOf(83)).toBe('B5');
  });
  it('knows black keys', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlack)).toEqual([false, true, false, true, false, false, true]);
  });
  it('tunes A4 to 440 Hz', () => {
    expect(frequencyOf(69)).toBe(440);
    expect(frequencyOf(81)).toBeCloseTo(880);
  });
  it('rejects bad names', () => {
    expect(() => midiOf('H2')).toThrow();
  });
});
