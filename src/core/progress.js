// Pure progression logic: unlocks, stars, player level. No DOM, no storage.
import { STAR_THRESHOLDS, SECTION_TEST_PASS, xpForNextLevel, RANKS, COMBO_TIERS } from '../config/scoring.js';

export const levelId = (sectionId, n) => `${sectionId}-${String(n).padStart(2, '0')}`;

export function newProgress() {
  return { version: 1, xp: 0, levels: {}, tests: {}, songs: {}, createdAt: Date.now() };
}

export function starsFor(accuracy) {
  return STAR_THRESHOLDS.filter((t) => accuracy >= t).length;
}

export const testPassed = (accuracy) => accuracy >= SECTION_TEST_PASS;

export function comboMultiplier(combo) {
  let m = 1;
  for (const [min, mult] of COMBO_TIERS) if (combo >= min) m = mult;
  return m;
}

/** Player level, XP into the current level and XP needed for the next one. */
export function playerLevel(totalXp) {
  let level = 1;
  let rest = totalXp;
  while (rest >= xpForNextLevel(level)) {
    rest -= xpForNextLevel(level);
    level++;
  }
  return { level, into: rest, need: xpForNextLevel(level) };
}

export function rankFor(level) {
  let name = RANKS[0][1];
  for (const [min, r] of RANKS) if (level >= min) name = r;
  return name;
}

export function nextRank(level) {
  const n = RANKS.find(([min]) => min > level);
  return n ? { level: n[0], name: n[1] } : null;
}

const cleared = (p, id) => (p.levels[id]?.stars ?? 0) >= 1;

export function sectionUnlocked(sections, p, i) {
  if (i === 0) return true;
  return !!p.tests[sections[i - 1].id]?.passed;
}

/**
 * Status of every level and test, in curriculum order.
 * Level n is open once level n-1 is cleared. A passed test opens every level of
 * its section (you tested out) and the next section.
 */
export function mapState(sections, p) {
  return sections.map((s, i) => {
    const open = sectionUnlocked(sections, p, i);
    const passed = !!p.tests[s.id]?.passed;
    const levels = s.levels.map((l, j) => {
      const id = levelId(s.id, j + 1);
      const rec = p.levels[id];
      const unlocked = open && (passed || j === 0 || cleared(p, levelId(s.id, j)));
      return { ...l, id, n: j + 1, stars: rec?.stars ?? 0, best: rec?.best ?? null, unlocked };
    });
    return {
      id: s.id,
      title: s.title,
      tagline: s.tagline,
      unlocked: open,
      levels,
      test: { id: `${s.id}-test`, unlocked: open, passed, best: p.tests[s.id]?.best ?? null },
      cleared: levels.filter((l) => l.stars > 0).length,
      stars: levels.reduce((a, l) => a + l.stars, 0),
    };
  });
}

/** The single thing to play next: first open, uncleared level; else an open, unpassed test. */
export function nextUp(state) {
  for (let i = state.length - 1; i >= 0; i--) {
    const s = state[i];
    if (!s.unlocked) continue;
    const lvl = s.levels.find((l) => l.unlocked && l.stars === 0);
    if (lvl) return { kind: 'level', section: s, level: lvl };
    if (!s.test.passed) return { kind: 'test', section: s };
  }
  const last = state[state.length - 1];
  return { kind: 'done', section: last };
}
