// Hash router. Routes: #/ (home), #/map[/<levelId>], #/lesson/<levelId>, #/songs, #/you
// Each screen module exports { orientation, render(root, params) } where render may
// return a cleanup function.

const routes = [
  { re: /^\/?$/, name: 'home' },
  { re: /^\/map(?:\/([\w-]+))?$/, name: 'map', keys: ['focus'] },
  { re: /^\/lesson\/([\w-]+)$/, name: 'lesson', keys: ['id'] },
  { re: /^\/songs$/, name: 'songs' },
  { re: /^\/you$/, name: 'you' },
];

export function parse(hash) {
  const path = (hash || '').replace(/^#/, '').split('?')[0] || '/';
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      (r.keys || []).forEach((k, i) => { if (m[i + 1] !== undefined) params[k] = m[i + 1]; });
      return { name: r.name, params };
    }
  }
  return { name: 'home', params: {} };
}

export const go = (path) => { location.hash = path; };

export function start(screens, onRoute) {
  const root = document.getElementById('app');
  let cleanup = null;
  const run = () => {
    const { name, params } = parse(location.hash);
    const screen = screens[name];
    if (cleanup) cleanup();
    root.replaceChildren();
    root.dataset.screen = name;
    window.scrollTo(0, 0);
    onRoute(screen, name);
    cleanup = screen.render(root, params) || null;
  };
  window.addEventListener('hashchange', run);
  run();
  return { rerender: run };
}
