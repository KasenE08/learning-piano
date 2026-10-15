import { describe, it, expect } from 'vitest';
import sectionsData from '../src/content/sections.json';
import songsData from '../src/content/songs.json';
import { newProgress, levelId, attemptXp, addXp, evaluateUnlocks, recordAttempt, recordTest, recordSong, playerLevel } from '../src/core/progress.js';
import { createScorer } from '../src/engine/scorer.js';
import { makeBackup, parseBackup, backupFileName, describeBackup } from '../src/core/backup.js';
import { XP, xpForNextLevel } from '../src/config/scoring.js';

const sections = sectionsData.sections;
const songs = songsData.songs;

describe('combo XP', () => {
  it('multiplies note XP by the combo tier at each hit', () => {
    const notes = Array.from({ length: 30 }, (_, i) => ({ id: i, midi: 60, time: i * 500 }));
    const s = createScorer(notes, { windowMs: 150 });
    notes.forEach((n) => s.input(60, n.time));
    // hits 1–9 ×1, 10–24 ×2, 25–30 ×3
    expect(s.summary().hitXp).toBe(9 + 15 * 2 + 6 * 3);
  });
  it('a miss resets the multiplier', () => {
    const notes = Array.from({ length: 12 }, (_, i) => ({ id: i, midi: 60, time: i * 500 }));
    const s = createScorer(notes, { windowMs: 150 });
    notes.slice(0, 10).forEach((n) => s.input(60, n.time));
    expect(s.multiplier).toBe(2);
    s.tick(5300);
    expect(s.multiplier).toBe(1);
  });
});

describe('attempt XP', () => {
  it('adds attempt, notes, new stars and first clear', () => {
    const r = attemptXp({ hitXp: 57, newStars: 2, firstClear: true });
    expect(r.total).toBe(XP.perAttempt + 57 + 2 * XP.perNewStar + XP.firstClear);
    expect(r.parts.map((p) => p.label)).toEqual(['Attempt', 'Notes', 'New stars', 'First clear']);
  });
  it('replays without new stars still earn attempt + notes', () => {
    expect(attemptXp({ hitXp: 30 }).total).toBe(XP.perAttempt + 30);
  });
  it('practice earns half, no bonuses', () => {
    expect(attemptXp({ hitXp: 30, practice: true, newStars: 3, firstClear: true }).total).toBe(Math.round((XP.perAttempt + 30) * XP.practiceFactor));
  });
  it('test pass bonus', () => {
    expect(attemptXp({ hitXp: 0, firstPass: true }).total).toBe(XP.perAttempt + XP.testPass);
  });
  it('reports level ups', () => {
    const p = newProgress();
    const r = addXp(p, xpForNextLevel(1) + 1);
    expect(r).toMatchObject({ levelUp: true, before: { level: 1 }, after: { level: 2 } });
    expect(addXp(r.progress, 1).levelUp).toBe(false);
  });
});

describe('unlocks', () => {
  it('clearing a level unlocks the next one and marks it NEW', () => {
    const before = newProgress();
    const after = recordAttempt(before, 'noob-01', 80).progress;
    const r = evaluateUnlocks(before, after, sections, songs);
    expect(r.unlocks).toEqual([{ kind: 'level', id: 'noob-02', title: sections[0].levels[1].title }]);
    expect(r.progress.fresh).toEqual(['noob-02']);
  });
  it('clearing the right level unlocks a reward song', () => {
    let p = newProgress();
    for (let n = 1; n <= 4; n++) p = recordAttempt(p, levelId('noob', n), 80).progress;
    const r = evaluateUnlocks(p, recordAttempt(p, 'noob-05', 80).progress, sections, songs);
    expect(r.unlocks.map((u) => u.kind + ':' + u.id)).toContain('song:hot-cross-buns');
    expect(r.progress.songs['hot-cross-buns'].unlocked).toBe(true);
  });
  it('hidden song for 2★ on every Noob level', () => {
    let p = newProgress();
    for (let n = 1; n <= 14; n++) p = recordAttempt(p, levelId('noob', n), 90).progress;
    const r1 = evaluateUnlocks(p, recordAttempt(p, 'noob-15', 75).progress, sections, songs);
    expect(r1.unlocks.find((u) => u.id === 'jingle-bells')).toBeUndefined();
    const r2 = evaluateUnlocks(p, recordAttempt(p, 'noob-15', 90).progress, sections, songs);
    expect(r2.unlocks.find((u) => u.id === 'jingle-bells')).toMatchObject({ kind: 'song', hidden: true });
  });
  it('passing a test opens the next section; testing out reports one combined unlock', () => {
    const before = newProgress();
    const after = recordTest(before, 'noob', 90).progress;
    const r = evaluateUnlocks(before, after, sections, songs);
    expect(r.unlocks.map((u) => u.kind)).toEqual(['levels', 'section', 'level']);
    expect(r.unlocks[1]).toMatchObject({ id: 'beginner' });
  });
  it('songs keep their own stars', () => {
    const r = recordSong(newProgress(), 'hot-cross-buns', 96);
    expect(r).toMatchObject({ stars: 3, firstClear: true });
    expect(r.progress.songs['hot-cross-buns']).toMatchObject({ unlocked: true, stars: 3, best: 96, attempts: 1 });
  });
});

describe('backup', () => {
  const sample = () => {
    const p = recordAttempt(newProgress(), 'noob-01', 88).progress;
    return makeBackup({ progress: { ...p, xp: 420 }, settings: { metronome: false }, calibration: { micLatencyMs: 90 } }, new Date('2026-10-15T12:00:00Z'));
  };
  it('round-trips', () => {
    const b = parseBackup(JSON.stringify(sample()));
    expect(b.progress.xp).toBe(420);
    expect(b.progress.levels['noob-01'].stars).toBe(2);
    expect(b.settings).toEqual({ metronome: false });
    expect(b.calibration).toEqual({ micLatencyMs: 90 });
    expect(describeBackup(b, playerLevel)).toMatch(/1 levels cleared · 2★/);
  });
  it('names the file by date', () => {
    expect(backupFileName(new Date('2026-10-15T12:00:00Z'))).toBe('learning-piano-backup-2026-10-15.json');
  });
  it('rejects junk with friendly messages', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/isn.t a Learning Piano backup/);
    expect(() => parseBackup(JSON.stringify({ ...sample(), version: 99 }))).toThrow(/newer version/);
    expect(() => parseBackup(JSON.stringify({ ...sample(), progress: { xp: -1 } }))).toThrow(/damaged/);
    const bad = sample();
    bad.progress.levels['noob-01'].stars = 7;
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/damaged/);
  });
});
