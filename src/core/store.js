// App state: progress + settings, loaded from IndexedDB, with change listeners.
import * as db from './db.js';
import { newProgress } from './progress.js';
import * as pianos from './pianos.js';
import sectionsData from '../content/sections.json';
import songsData from '../content/songs.json';

export const sections = sectionsData.sections;
export const songs = songsData.songs;

const DEFAULT_SETTINGS = { metronome: true, sfx: true, inputMode: 'mic' };

const state = { progress: newProgress(), settings: { ...DEFAULT_SETTINGS }, pianos: pianos.normalizePianos(null) };
const listeners = new Set();

export const getProgress = () => state.progress;
export const getSettings = () => state.settings;
/** The active piano's calibration: { noiseDb, low, high, peakDb, micLatencyMs, spreadMs, at } or null */
export const getCalibration = () => pianos.activePiano(state.pianos).calibration;
/** Saved pianos: { active, list: [{ id, name, calibration }] } */
export const getPianos = () => state.pianos;
export const getActivePiano = () => pianos.activePiano(state.pianos);

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

export async function load() {
  const [p, s, c, pi] = await Promise.all([db.get('progress'), db.get('settings'), db.get('calibration'), db.get('pianos')]);
  if (p) state.progress = { ...newProgress(), ...p };
  if (s) state.settings = { ...DEFAULT_SETTINGS, ...s };
  // Before saved pianos there was one calibration: it becomes "My keyboard".
  state.pianos = pianos.normalizePianos(pi, c ?? null);
  if (!pi) await db.set('pianos', state.pianos);
  emit();
}

export async function saveProgress(next) {
  state.progress = next;
  emit();
  await db.set('progress', next);
}

/** Saves a calibration on the active piano. */
export async function saveCalibration(c) {
  await savePianos(pianos.setCalibration(state.pianos, c));
}

export async function savePianos(next) {
  state.pianos = pianos.normalizePianos(next);
  emit();
  await db.set('pianos', state.pianos);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  emit();
  await db.set('settings', state.settings);
}

/** Replace in-memory progress without persisting (dev-only demo data for screenshots). */
export function useTransientProgress(p) {
  state.progress = p;
  emit();
}
