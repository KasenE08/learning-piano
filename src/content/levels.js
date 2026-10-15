// Level files live in src/content/levels/<section>/<NN>.json (or test.json);
// reward songs in src/content/songs/<id>.json and are addressed as "song-<id>".
// Each loads as its own chunk; the service worker precaches them all.
const levelFiles = import.meta.glob('./levels/*/*.json', { import: 'default' });
const songFiles = import.meta.glob('./songs/*.json', { import: 'default' });

export function levelPath(id) {
  const s = /^song-([\w-]+)$/.exec(id);
  if (s) return `./songs/${s[1]}.json`;
  const m = /^([a-z]+)-(\d{2}|test)$/.exec(id);
  return m ? `./levels/${m[1]}/${m[2]}.json` : null;
}

const loaderFor = (id) => levelFiles[levelPath(id)] || songFiles[levelPath(id)];
export const hasLevel = (id) => !!loaderFor(id);

export async function loadLevel(id) {
  const loader = loaderFor(id);
  return loader ? { id, ...(await loader()) } : null;
}
