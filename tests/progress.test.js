import { describe, it, expect } from 'vitest';
import sectionsData from '../src/content/sections.json';
import {
  newProgress, levelId, starsFor, testPassed, comboMultiplier, playerLevel, rankFor, mapState, nextUp,
} from '../src/core/progress.js';
import { xpForNextLevel } from '../src/config/scoring.js';

const sections = sectionsData.sections;
const clear = (p, sec, n, stars = 1) => { p.levels[levelId(sec, n)] = { stars, best: 80 }; };

describe('stars and pass marks', () => {
  it('awards stars at 70 / 85 / 95', () => {
    expect(starsFor(69.9)).toBe(0);
    expect(starsFor(70)).toBe(1);
    expect(starsFor(84.9)).toBe(1);
    expect(starsFor(85)).toBe(2);
    expect(starsFor(95)).toBe(3);
    expect(starsFor(100)).toBe(3);
  });
  it('passes a section test at 85%', () => {
    expect(testPassed(84.99)).toBe(false);
    expect(testPassed(85)).toBe(true);
  });
});

describe('combo multiplier', () => {
  it('steps up at 10, 25 and 50', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(9)).toBe(1);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(25)).toBe(3);
    expect(comboMultiplier(49)).toBe(3);
    expect(comboMultiplier(50)).toBe(4);
    expect(comboMultiplier(500)).toBe(4);
  });
});

describe('player level', () => {
  it('starts at level 1 with no XP', () => {
    expect(playerLevel(0)).toEqual({ level: 1, into: 0, need: xpForNextLevel(1) });
  });
  it('carries leftover XP into the next level', () => {
    const first = xpForNextLevel(1);
    expect(playerLevel(first + 5)).toEqual({ level: 2, into: 5, need: xpForNextLevel(2) });
  });
  it('maps levels to ranks', () => {
    expect(rankFor(1)).toBe('Rookie');
    expect(rankFor(5)).toBe('Apprentice');
    expect(rankFor(31)).toBe('Maestro');
  });
});

describe('unlocks', () => {
  it('opens only Noob level 1 and the Noob test for a new player', () => {
    const s = mapState(sections, newProgress());
    expect(s[0].unlocked).toBe(true);
    expect(s[0].levels.filter((l) => l.unlocked).map((l) => l.n)).toEqual([1]);
    expect(s[0].test.unlocked).toBe(true);
    expect(s.slice(1).every((x) => !x.unlocked)).toBe(true);
    expect(nextUp(s)).toMatchObject({ kind: 'level', level: { id: 'noob-01' } });
  });

  it('opens the next level once the previous one has a star', () => {
    const p = newProgress();
    clear(p, 'noob', 1);
    const s = mapState(sections, p);
    expect(s[0].levels[1].unlocked).toBe(true);
    expect(s[0].levels[2].unlocked).toBe(false);
    expect(nextUp(s).level.id).toBe('noob-02');
  });

  it('suggests the test once every level in the section is cleared', () => {
    const p = newProgress();
    for (let n = 1; n <= 15; n++) clear(p, 'noob', n);
    expect(nextUp(mapState(sections, p))).toMatchObject({ kind: 'test', section: { id: 'noob' } });
  });

  it('lets a passed test skip the section: next section opens, all its levels open', () => {
    const p = newProgress();
    p.tests.noob = { passed: true, best: 90 };
    const s = mapState(sections, p);
    expect(s[1].unlocked).toBe(true);
    expect(s[0].levels.every((l) => l.unlocked)).toBe(true);
    expect(s[2].unlocked).toBe(false);
    expect(nextUp(s).level.id).toBe('beginner-01');
  });

  it('reports done when every test is passed and every level cleared', () => {
    const p = newProgress();
    for (const sec of sections) {
      p.tests[sec.id] = { passed: true, best: 90 };
      sec.levels.forEach((_, i) => clear(p, sec.id, i + 1, 3));
    }
    expect(nextUp(mapState(sections, p)).kind).toBe('done');
  });
});
