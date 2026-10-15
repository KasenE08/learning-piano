import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { parseLevel, expectedNotes, micMelody, pulseBeats } from '../src/engine/notation.js';
import { generatePassage } from '../src/engine/generate.js';
import { drillPrompts } from '../src/engine/drill.js';
import songsData from '../src/content/songs.json';

const root = new URL('../src/content/levels/', import.meta.url);
const songRoot = new URL('../src/content/songs/', import.meta.url);
const files = [
  ...readdirSync(root).flatMap((sec) => readdirSync(new URL(`${sec}/`, root)).map((f) => `${sec}/${f}`)),
  ...readdirSync(songRoot).map((f) => `../songs/${f}`),
];
const raw = (f) => JSON.parse(readFileSync(new URL(f, root), 'utf8'));
// Generated sight-reading levels are checked with a sample passage.
const read = (f) => { const l = raw(f); return l.generate ? { ...l, ...generatePassage(l.generate, 11) } : l; };
const songSection = Object.fromEntries(songsData.songs.map((s) => [s.id, s.section]));
const sectionOf = (f) => (f.startsWith('../songs/') ? songSection[f.slice(9, -5)] : f.split('/')[0]);

describe('curriculum is complete', () => {
  for (const sec of ['noob', 'beginner', 'intermediate', 'advanced']) {
    it(`${sec} has levels 01–15 and a test`, () => {
      for (let n = 1; n <= 15; n++) expect(existsSync(new URL(`${sec}/${String(n).padStart(2, '0')}.json`, root)), `${sec} ${n}`).toBe(true);
      expect(existsSync(new URL(`${sec}/test.json`, root))).toBe(true);
    });
  }
  it('every reward song is playable', () => {
    songsData.songs.forEach((s) => {
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
      for (const [bar, clef] of Object.values(level.clefChanges || {}).flat()) {
        expect(bar).toBeGreaterThanOrEqual(1);
        expect(bar).toBeLessThanOrEqual(parsed.bars);
        expect(['treble', 'bass']).toContain(clef);
      }
    });
  }
});

describe('later sections', () => {
  const later = files.filter((x) => ['intermediate', 'advanced'].includes(sectionOf(x)));
  for (const f of later) {
    it(`${f}: the mic has a melody to score`, () => {
      const level = read(f);
      if (level.type === 'find') return;
      const notes = expectedNotes(parseLevel(level));
      const { scored } = micMelody(notes);
      // Most onsets are scorable; chords reduce to their top note.
      expect(scored.length).toBeGreaterThanOrEqual(8);
      expect(new Set(scored.map((n) => n.beat)).size).toBe(scored.length);
    });
  }
  it('songs in the later sections are the long versions (32+ bars or about a minute)', () => {
    songsData.songs.filter((s) => ['intermediate', 'advanced'].includes(s.section)).forEach((s) => {
      const level = read(`../songs/${s.id}.json`);
      const p = parseLevel(level);
      const seconds = (p.totalBeats * 60) / (level.tempo.default * pulseBeats(level.time || '4/4'));
      expect(p.bars >= 32 || seconds >= 60, `${s.id}: ${p.bars} bars, ${Math.round(seconds)} s`).toBe(true);
    });
  });
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

describe('playable with two hands', () => {
  for (const f of files) {
    it(`${f} never asks both hands for the same key at once`, () => {
      const level = read(f);
      if (level.type === 'find') return;
      const notes = expectedNotes(parseLevel(level));
      for (let i = 0; i < notes.length; i++) {
        for (let j = i + 1; j < notes.length && notes[j].beat - notes[i].beat < 1e-6; j++) {
          expect(notes[j].midi, `${f}: ${notes[i].name} twice at beat ${notes[i].beat}`).not.toBe(notes[i].midi);
        }
      }
    });
  }
});
