// Export / import of everything stored on the device, as one JSON file.
import { newProgress } from './progress.js';
import { normalizePianos, activePiano } from './pianos.js';

export const BACKUP_APP = 'learning-piano';
export const BACKUP_VERSION = 1;

export function makeBackup({ progress, settings, calibration, pianos }, now = new Date()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    progress,
    settings,
    // The active piano's calibration (what older versions of the app read) plus every saved piano.
    calibration: (pianos ? activePiano(pianos).calibration : calibration) ?? null,
    pianos: pianos ?? null,
  };
}

export const backupFileName = (now = new Date()) => `learning-piano-backup-${now.toISOString().slice(0, 10)}.json`;

/** Parse and validate a backup file's text. Throws an Error with a friendly message. */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file isn’t a backup (it isn’t valid JSON).'); }
  if (!data || data.app !== BACKUP_APP) throw new Error('That file isn’t a Learning Piano backup.');
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of the app. Update the app first.');
  const p = data.progress;
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(p) || typeof p.xp !== 'number' || p.xp < 0 || !isObj(p.levels) || !isObj(p.tests) || !isObj(p.songs)) {
    throw new Error('The backup is damaged (progress is missing or invalid).');
  }
  for (const [id, r] of Object.entries(p.levels)) {
    if (!/^[a-z]+-\d{2}$/.test(id) || !isObj(r) || !(r.stars >= 0 && r.stars <= 3)) throw new Error(`The backup is damaged (level ${id}).`);
  }
  return {
    progress: { ...newProgress(), ...p, fresh: [] },
    settings: isObj(data.settings) ? data.settings : null,
    calibration: isObj(data.calibration) ? data.calibration : null,
    pianos: isObj(data.pianos) ? normalizePianos(data.pianos) : normalizePianos(null, isObj(data.calibration) ? data.calibration : null),
    exportedAt: data.exportedAt || null,
  };
}

/** Short human summary for the "replace your progress?" confirmation. */
export function describeBackup(b, playerLevel) {
  const levels = Object.values(b.progress.levels).filter((r) => r.stars > 0).length;
  const stars = Object.values(b.progress.levels).reduce((a, r) => a + (r.stars || 0), 0);
  return `Level ${playerLevel(b.progress.xp).level} · ${levels} levels cleared · ${stars}★`;
}
