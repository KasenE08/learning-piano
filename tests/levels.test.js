import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { parseLevel, expectedNotes } from '../src/engine/notation.js';

const root = new URL('../src/content/levels/', import.meta.url);
const files = [
  ...readdirSync(root).flatMap((sec) => readdirSync(new URL(`${sec}/`, root)).map((f) => `${sec}/${f}`)),
  ...readdirSync(new URL('../songs/', root)).map((f) => `../songs/${f}`),
];

describe('level files', () => {
  it('exist', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(`${f} parses and fits the 61-key keyboard`, () => {
      const level = JSON.parse(readFileSync(new URL(f, root), 'utf8'));
      expect(f).toMatch(/^((noob|beginner|intermediate|advanced)\/(\d{2}|test)|\.\.\/songs\/[a-z-]+)\.json$/);
      const parsed = parseLevel(level);
      const notes = expectedNotes(parsed);
      expect(notes.length).toBeGreaterThan(0);
      notes.forEach((n) => { expect(n.midi).toBeGreaterThanOrEqual(36); expect(n.midi).toBeLessThanOrEqual(96); });
      expect(level.tempo.default).toBeGreaterThanOrEqual(level.tempo.min);
      expect(level.tempo.default).toBeLessThanOrEqual(level.tempo.max);
      (level.intro || []).forEach((c) => expect(['text', 'note', 'keys']).toContain(c.kind));
    });
  }
});
