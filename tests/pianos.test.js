import { describe, it, expect } from 'vitest';
import { normalizePianos, activePiano, setActive, addPiano, renamePiano, removePiano, setCalibration, DEFAULT_NAME } from '../src/core/pianos.js';
import { makeBackup, parseBackup } from '../src/core/backup.js';
import { newProgress } from '../src/core/progress.js';

const casioCal = { noiseDb: -58, low: 36, high: 96, micLatencyMs: 110, at: 1 };
const acousticCal = { noiseDb: -52, low: 36, high: 96, micLatencyMs: 70, at: 2 };

describe('saved pianos', () => {
  it('starts with one piano, carrying over an old calibration', () => {
    const s = normalizePianos(null, casioCal);
    expect(s.list).toEqual([{ id: 'p1', name: DEFAULT_NAME, calibration: casioCal }]);
    expect(activePiano(s).calibration).toBe(casioCal);
  });
  it('a new piano becomes active and starts uncalibrated', () => {
    const s = addPiano(normalizePianos(null, casioCal), '  Acoustic   piano ');
    expect(s.list).toHaveLength(2);
    expect(activePiano(s)).toMatchObject({ name: 'Acoustic piano', calibration: null });
  });
  it('each piano keeps its own calibration', () => {
    let s = normalizePianos(null, casioCal);
    s = setCalibration(addPiano(s, 'Acoustic'), acousticCal);
    expect(activePiano(s).calibration).toBe(acousticCal);
    s = setActive(s, 'p1');
    expect(activePiano(s).calibration).toBe(casioCal);
  });
  it('renames, ignoring blank names', () => {
    let s = renamePiano(normalizePianos(null), 'p1', 'Casio');
    expect(s.list[0].name).toBe('Casio');
    s = renamePiano(s, 'p1', '   ');
    expect(s.list[0].name).toBe('Casio');
  });
  it('deleting the active piano switches to another; the last one stays', () => {
    let s = addPiano(normalizePianos(null), 'Acoustic');
    s = removePiano(s, s.active);
    expect(s.list).toHaveLength(1);
    expect(s.active).toBe('p1');
    expect(removePiano(s, 'p1').list).toHaveLength(1);
  });
  it('ids stay unique after deletions', () => {
    let s = addPiano(addPiano(normalizePianos(null), 'A'), 'B'); // p1 p2 p3
    s = removePiano(s, 'p2');
    s = addPiano(s, 'C');
    expect(new Set(s.list.map((p) => p.id)).size).toBe(s.list.length);
  });
  it('repairs a damaged stored state', () => {
    expect(normalizePianos({ active: 'zz', list: [{ id: 'p7', name: '' }] })).toEqual({ active: 'p7', list: [{ id: 'p7', name: DEFAULT_NAME, calibration: null }] });
  });
  it('setting an unknown piano active changes nothing', () => {
    const s = normalizePianos(null);
    expect(setActive(s, 'nope')).toBe(s);
  });
});

describe('backups carry every piano', () => {
  const pianos = setCalibration(addPiano(normalizePianos(null, casioCal), 'Acoustic'), acousticCal);
  it('round-trips the piano list', () => {
    const b = parseBackup(JSON.stringify(makeBackup({ progress: newProgress(), settings: {}, pianos })));
    expect(b.pianos).toEqual(pianos);
    expect(b.calibration).toEqual(acousticCal); // what older versions read
  });
  it('an old backup with one calibration becomes one piano', () => {
    const old = JSON.stringify({ app: 'learning-piano', version: 1, progress: newProgress(), calibration: casioCal });
    expect(parseBackup(old).pianos.list).toEqual([{ id: 'p1', name: DEFAULT_NAME, calibration: casioCal }]);
  });
});
