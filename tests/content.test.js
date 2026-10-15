import { describe, it, expect } from 'vitest';
import sectionsData from '../src/content/sections.json';
import songsData from '../src/content/songs.json';
import { TIMING_WINDOWS_MS } from '../src/config/scoring.js';

const { sections } = sectionsData;
const { songs } = songsData;

describe('curriculum content', () => {
  it('has four sections in order, 15 levels each', () => {
    expect(sections.map((s) => s.id)).toEqual(['noob', 'beginner', 'intermediate', 'advanced']);
    sections.forEach((s) => {
      expect(s.levels).toHaveLength(15);
      s.levels.forEach((l) => {
        expect(l.title, `${s.id} level title`).toBeTruthy();
        expect(l.sub, `${s.id} ${l.title} subtitle`).toBeTruthy();
      });
    });
  });

  it('has a timing window for every section', () => {
    sections.forEach((s) => expect(TIMING_WINDOWS_MS[s.id]).toBeGreaterThan(0));
  });

  it('has unique song ids whose unlock rules point at real levels/sections', () => {
    const ids = new Set();
    const levelIds = new Set(sections.flatMap((s) => s.levels.map((_, i) => `${s.id}-${String(i + 1).padStart(2, '0')}`)));
    const sectionIds = new Set(sections.map((s) => s.id));
    songs.forEach((s) => {
      expect(ids.has(s.id), `duplicate ${s.id}`).toBe(false);
      ids.add(s.id);
      if (s.unlock.level) expect(levelIds.has(s.unlock.level), `${s.id} → ${s.unlock.level}`).toBe(true);
      if (s.unlock.stars) expect(sectionIds.has(s.unlock.stars), `${s.id} → ${s.unlock.stars}`).toBe(true);
      expect(s.unlock.level || s.unlock.stars, `${s.id} has no unlock rule`).toBeTruthy();
    });
  });
});
