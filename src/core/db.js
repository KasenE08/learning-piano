// Minimal IndexedDB key-value wrapper. One object store, documents keyed by name
// ('progress', 'settings', 'calibration'). Falls back to memory if IndexedDB is
// unavailable (e.g. some private-browsing modes) so the app still runs.

const DB_NAME = 'learning-piano';
const STORE = 'kv';
let dbPromise = null;
const memory = new Map();

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!('indexedDB' in globalThis)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function get(key) {
  const db = await open();
  if (!db) return memory.get(key);
  return tx(db, 'readonly', (s) => s.get(key));
}

export async function set(key, value) {
  const db = await open();
  if (!db) return void memory.set(key, value);
  await tx(db, 'readwrite', (s) => s.put(value, key));
}

/** Ask the browser not to evict our data (best effort; iOS may ignore it). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
