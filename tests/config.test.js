import { describe, it, expect } from 'vitest';
import { TIMING_WINDOWS_MS, STAR_THRESHOLDS, SECTION_TEST_PASS, ON_TIME_FRACTION } from '../src/config/scoring.js';

describe('scoring config', () => {
  it('uses the agreed timing windows, tightening every section', () => {
    expect(TIMING_WINDOWS_MS).toEqual({ noob: 200, beginner: 150, intermediate: 100, advanced: 75 });
    const w = Object.values(TIMING_WINDOWS_MS);
    w.slice(1).forEach((x, i) => expect(x).toBeLessThan(w[i]));
  });
  it('has ascending star thresholds and an 85% test pass mark', () => {
    expect(STAR_THRESHOLDS).toEqual([70, 85, 95]);
    expect(SECTION_TEST_PASS).toBe(85);
  });
  it('keeps the on-time band inside the window', () => {
    expect(ON_TIME_FRACTION).toBeGreaterThan(0);
    expect(ON_TIME_FRACTION).toBeLessThan(1);
  });
});
