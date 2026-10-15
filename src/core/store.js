// App state: progress + settings, loaded from IndexedDB, with change listeners.
import * as db from './db.js';
import { newProgress } from './progress.js';
import sectionsData from '../content/sections.json';
import songsData from '../content/songs.json';

export const sections = sectionsData.sections;
export const songs = songsData.songs;

const DEFAULT_SETTINGS = { metronome: true, sfx: true, inputMode: 'mic' };

const state = { progress: newProgress(), settings: { ...DEFAULT_SETTINGS }, calibration: null };
const listeners = new Set();

export const getProgress = () => state.progress;
export const getSettings = () => state.settings;
/** { noiseDb, low, high, peakDb, micLatencyMs, spreadMs, at } or null */
export const getCalibration = () => state.calibration;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

export async function load() {
  const [p, s, c] = await Promise.all([db.get('progress'), db.get('settings'), db.get('calibration')]);
  if (p) state.progress = { ...newProgress(), ...p };
  if (s) state.settings = { ...DEFAULT_SETTINGS, ...s };
  if (c) state.calibration = c;
  emit();
}

export async function saveProgress(next) {
  state.progress = next;
  emit();
  await db.set('progress', next);
}

export async function saveCalibration(c) {
  state.calibration = c;
  emit();
  await db.set('calibration', c);
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
