// Level files live in src/content/levels/<section>/<NN>.json (or test.json).
// Each loads as its own chunk; the service worker precaches them all.
const files = import.meta.glob('./levels/*/*.json', { import: 'default' });

export function levelPath(id) {
  const m = /^([a-z]+)-(\d{2}|test)$/.exec(id);
  return m ? `./levels/${m[1]}/${m[2]}.json` : null;
}

export const hasLevel = (id) => !!files[levelPath(id)];

export async function loadLevel(id) {
  const loader = files[levelPath(id)];
  return loader ? { id, ...(await loader()) } : null;
}
