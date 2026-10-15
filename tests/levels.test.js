import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { parseLevel, expectedNotes } from '../src/engine/notation.js';
import { drillPrompts } from '../src/engine/drill.js';
import songsData from '../src/content/songs.json';

const root = new URL('../src/content/levels/', import.meta.url);
const songRoot = new URL('../src/content/songs/', import.meta.url);
const files = [
  ...readdirSync(root).flatMap((sec) => readdirSync(new URL(`${sec}/`, root)).map((f) => `${sec}/${f}`)),
  ...readdirSync(songRoot).map((f) => `../songs/${f}`),
];
const read = (f) => JSON.parse(readFileSync(new URL(f, root), 'utf8'));
const songSection = Object.fromEntries(songsData.songs.map((s) => [s.id, s.section]));
const sectionOf = (f) => (f.startsWith('../songs/') ? songSection[f.slice(9, -5)] : f.split('/')[0]);

describe('curriculum is complete', () => {
  for (const sec of ['noob', 'beginner']) {
    it(`${sec} has levels 01–15 and a test`, () => {
      for (let n = 1; n <= 15; n++) expect(existsSync(new URL(`${sec}/${String(n).padStart(2, '0')}.json`, root)), `${sec} ${n}`).toBe(true);
      expect(existsSync(new URL(`${sec}/test.json`, root))).toBe(true);
    });
  }
  it('every reward song in the first two sections is playable', () => {
    songsData.songs.filter((s) => ['noob', 'beginner'].includes(s.section)).forEach((s) => {
      expect(existsSync(new URL(`${s.id}.json`, songRoot)), s.id).toBe(true);
    });
  });
});

describe('level files', () => {
  for (const f of files) {
    it(`${f} is valid and fits the 61-key keyboard`, () => {
      const level = read(f);
      expect(f).toMatch(/^((noob|beginner|intermediate|advanced)\/(\d{2}|test)|\.\.\/songs\/[a-z-]+)\.json$/);
      (level.intro || []).forEach((c) => expect(['text', 'note', 'keys']).toContain(c.kind));
      if (level.type === 'find') {
        const p = drillPrompts(level);
        expect(p.length).toBeGreaterThanOrEqual(8);
        p.forEach((x) => { expect(x.midi).toBeGreaterThanOrEqual(36); expect(x.midi).toBeLessThanOrEqual(96); });
        expect(['name', 'staff', 'both']).toContain(level.show);
        return;
      }
      const parsed = parseLevel(level);
      const notes = expectedNotes(parsed);
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach((n) => { expect(n.midi).toBeGreaterThanOrEqual(36); expect(n.midi).toBeLessThanOrEqual(96); });
      expect(level.tempo.default).toBeGreaterThanOrEqual(level.tempo.min);
      expect(level.tempo.default).toBeLessThanOrEqual(level.tempo.max);
    });
  }
});

describe('first two sections are mic-friendly (one note at a time)', () => {
  for (const f of files.filter((x) => ['noob', 'beginner'].includes(sectionOf(x)))) {
    it(`${f} never has two notes sounding together`, () => {
      const level = read(f);
      if (level.type === 'find') return;
      const notes = expectedNotes(parseLevel(level));
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].beat, `${f}: ${notes[i - 1].name} still sounding when ${notes[i].name} starts`).toBeGreaterThanOrEqual(notes[i - 1].beat + notes[i - 1].beats - 1e-6);
      }
    });
  }
});
