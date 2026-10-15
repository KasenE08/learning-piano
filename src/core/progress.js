// Pure progression logic: unlocks, stars, player level. No DOM, no storage.
import { STAR_THRESHOLDS, SECTION_TEST_PASS, xpForNextLevel, RANKS, XP, comboMultiplier } from '../config/scoring.js';

export { comboMultiplier };

export const levelId = (sectionId, n) => `${sectionId}-${String(n).padStart(2, '0')}`;

export function newProgress() {
  return { version: 1, xp: 0, levels: {}, tests: {}, songs: {}, fresh: [], createdAt: Date.now() };
}

export function starsFor(accuracy) {
  return STAR_THRESHOLDS.filter((t) => accuracy >= t).length;
}

export const testPassed = (accuracy) => accuracy >= SECTION_TEST_PASS;


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

/**
 * Record a scored attempt (not practice). Returns the new progress object plus
 * what changed. XP and rewards arrive in Phase 4.
 */
export function recordAttempt(p, id, accuracy) {
  const prev = p.levels[id] || { stars: 0, best: null, attempts: 0 };
  const stars = starsFor(accuracy);
  const next = {
    stars: Math.max(prev.stars, stars),
    best: prev.best == null ? accuracy : Math.max(prev.best, accuracy),
    attempts: (prev.attempts || 0) + 1,
  };
  return {
    progress: { ...p, levels: { ...p.levels, [id]: next } },
    stars,
    newBest: prev.best == null || accuracy > prev.best,
    firstClear: prev.stars === 0 && stars > 0,
    newStars: Math.max(0, stars - prev.stars),
  };
}

/** Record a section test attempt. */
export function recordTest(p, sectionId, accuracy) {
  const prev = p.tests[sectionId] || { passed: false, best: null, attempts: 0 };
  const passed = testPassed(accuracy);
  return {
    progress: { ...p, tests: { ...p.tests, [sectionId]: { passed: prev.passed || passed, best: Math.max(prev.best ?? 0, accuracy), attempts: (prev.attempts || 0) + 1 } } },
    passed,
    firstPass: passed && !prev.passed,
  };
}

/** Record a song attempt (songs keep their own best and stars). */
export function recordSong(p, id, accuracy) {
  const prev = p.songs[id] || { unlocked: true, stars: 0, best: null, attempts: 0 };
  const stars = starsFor(accuracy);
  return {
    progress: { ...p, songs: { ...p.songs, [id]: { ...prev, stars: Math.max(prev.stars || 0, stars), best: Math.max(prev.best ?? 0, accuracy), attempts: (prev.attempts || 0) + 1 } } },
    stars,
    newBest: prev.best == null || accuracy > prev.best,
    firstClear: !(prev.stars > 0) && stars > 0,
    newStars: Math.max(0, stars - (prev.stars || 0)),
  };
}

/**
 * XP for one attempt. hitXp already includes combo multipliers (from the scorer).
 * Returns { total, parts: [{ label, xp }] }.
 */
export function attemptXp({ hitXp = 0, practice = false, newStars = 0, firstClear = false, firstPass = false, song = false }) {
  const parts = [];
  if (practice) {
    const xp = Math.round((XP.perAttempt + hitXp) * XP.practiceFactor);
    if (xp) parts.push({ label: 'Practice', xp });
  } else {
    parts.push({ label: 'Attempt', xp: XP.perAttempt });
    if (hitXp) parts.push({ label: 'Notes', xp: Math.round(hitXp) });
    if (newStars) parts.push({ label: `New star${newStars > 1 ? 's' : ''}`, xp: newStars * XP.perNewStar });
    if (firstClear) parts.push({ label: 'First clear', xp: song ? XP.songFirstClear : XP.firstClear });
    if (firstPass) parts.push({ label: 'Test passed', xp: XP.testPass });
  }
  return { total: parts.reduce((a, x) => a + x.xp, 0), parts };
}

export function addXp(p, xp) {
  const before = playerLevel(p.xp);
  const next = { ...p, xp: p.xp + xp };
  const after = playerLevel(next.xp);
  return { progress: next, before, after, levelUp: after.level > before.level, rankUp: rankFor(after.level) !== rankFor(before.level) };
}

function songEarned(song, p, sections) {
  const u = song.unlock;
  if (u.level) {
    const st = p.levels[u.level]?.stars ?? 0;
    return u.stars3 ? st >= 3 : st >= 1;
  }
  if (u.stars) {
    const sec = sections.find((s) => s.id === u.stars);
    return !!sec && sec.levels.every((_, i) => (p.levels[levelId(sec.id, i + 1)]?.stars ?? 0) >= (u.min ?? 1));
  }
  return false;
}

/**
 * Compare progress before/after an attempt and unlock rewards.
 * Returns { progress, unlocks: [{ kind: 'level'|'test'|'section'|'song', id, title, hidden? }] }.
 * Newly unlocked things are also added to progress.fresh (shown as NEW on the map).
 */
export function evaluateUnlocks(before, after, sections, songs) {
  const unlocks = [];
  const s0 = mapState(sections, before);
  const s1 = mapState(sections, after);
  s1.forEach((sec, i) => {
    if (sec.unlocked && !s0[i].unlocked) unlocks.push({ kind: 'section', id: sec.id, title: sec.title });
    const opened = sec.levels.filter((l, j) => l.unlocked && !s0[i].levels[j].unlocked);
    if (opened.length > 2) unlocks.push({ kind: 'levels', id: `${sec.id}-all`, title: `Every ${sec.title} level` });
    else opened.forEach((l) => unlocks.push({ kind: 'level', id: l.id, title: l.title }));
  });
  let p = after;
  for (const song of songs) {
    if (p.songs[song.id]?.unlocked) continue;
    if (songEarned(song, p, sections)) {
      p = { ...p, songs: { ...p.songs, [song.id]: { ...(p.songs[song.id] || {}), unlocked: true } } };
      unlocks.push({ kind: 'song', id: song.id, title: song.title, hidden: !!song.hidden });
    }
  }
  if (unlocks.length) p = { ...p, fresh: [...new Set([...(p.fresh || []), ...unlocks.map((u) => u.id)])] };
  return { progress: p, unlocks };
}

export const clearFresh = (p) => ({ ...p, fresh: [] });
