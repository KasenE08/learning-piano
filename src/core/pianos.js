// Saved pianos: each has a name and its own mic calibration, so switching
// between, say, a Casio and an acoustic piano needs no recalibrating.
// State: { active: id, list: [{ id, name, calibration | null }] }. Pure functions.

export const DEFAULT_NAME = 'My keyboard';

const clean = (name) => String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);

function newId(list) {
  let n = list.length + 1;
  while (list.some((p) => p.id === `p${n}`)) n++;
  return `p${n}`;
}

/** Valid piano state from what was stored, migrating a single old calibration. */
export function normalizePianos(stored, legacyCalibration = null) {
  const list = Array.isArray(stored?.list)
    ? stored.list.filter((p) => p && typeof p.id === 'string').map((p) => ({ id: p.id, name: clean(p.name) || DEFAULT_NAME, calibration: p.calibration ?? null }))
    : [];
  if (!list.length) list.push({ id: 'p1', name: DEFAULT_NAME, calibration: legacyCalibration ?? null });
  const active = list.some((p) => p.id === stored?.active) ? stored.active : list[0].id;
  return { active, list };
}

export const activePiano = (state) => state.list.find((p) => p.id === state.active) || state.list[0];

export const setActive = (state, id) => (state.list.some((p) => p.id === id) ? { ...state, active: id } : state);

/** Adds a piano and makes it the active one. */
export function addPiano(state, name) {
  const id = newId(state.list);
  const nm = clean(name) || `Piano ${state.list.length + 1}`;
  return { active: id, list: [...state.list, { id, name: nm, calibration: null }] };
}

export function renamePiano(state, id, name) {
  const nm = clean(name);
  if (!nm) return state;
  return { ...state, list: state.list.map((p) => (p.id === id ? { ...p, name: nm } : p)) };
}

/** Removes a piano (never the last one); the active one moves to the first left. */
export function removePiano(state, id) {
  if (state.list.length < 2) return state;
  const list = state.list.filter((p) => p.id !== id);
  return { active: state.active === id ? list[0].id : state.active, list };
}

/** Stores a calibration on the active piano. */
export const setCalibration = (state, calibration) => ({
  ...state,
  list: state.list.map((p) => (p.id === state.active ? { ...p, calibration } : p)),
});
