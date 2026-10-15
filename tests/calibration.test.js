import { describe, it, expect } from 'vitest';
import { median, noiseFloor, levelVerdict, clickOffsets, latencyFromOffsets } from '../src/engine/calibration.js';

describe('calibration helpers', () => {
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it('rates room noise', () => {
    expect(noiseFloor(Array(50).fill(-70))).toMatchObject({ noiseDb: -70, rating: 'quiet' });
    expect(noiseFloor([...Array(45).fill(-58), ...Array(5).fill(-30)]).rating).toBe('ok');
    expect(noiseFloor(Array(50).fill(-40)).rating).toBe('noisy');
  });
  it('judges playing level against the noise', () => {
    expect(levelVerdict(-20, -65).rating).toBe('great');
    expect(levelVerdict(-45, -65).rating).toBe('ok');
    expect(levelVerdict(-55, -62).rating).toBe('quiet');
    expect(levelVerdict(-2, -65).rating).toBe('loud');
    expect(levelVerdict(-20, -65, true).rating).toBe('loud');
  });
  it('pairs clicks with the nearest played note', () => {
    expect(clickOffsets([0, 500, 1000, 1500], [80, 590, 1070, 2500])).toEqual([80, 90, 70]);
  });
  it('measures latency as the median offset and checks consistency', () => {
    expect(latencyFromOffsets([80, 90, 70, 85, 75, 300])).toMatchObject({ ok: true, latencyMs: 83 });
    expect(latencyFromOffsets([80, 90])).toMatchObject({ ok: false, reason: 'few' });
    expect(latencyFromOffsets([0, 150, -100, 200, -50, 120]).ok).toBe(false);
  });
});
