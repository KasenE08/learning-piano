import { html, el } from '../dom.js';
import { icons } from '../icons.js';

const TABS = [
  ['home', '#/', 'Home'],
  ['map', '#/map', 'Map'],
  ['songs', '#/songs', 'Songs'],
  ['you', '#/you', 'You'],
];

export function dock(active) {
  return el(html`<nav class="dock" aria-label="Main">
    ${TABS.map(([id, href, label]) => html`<a class="dock__tab ${id === active ? 'is-on' : ''}" href="${href}" ${id === active ? html`aria-current="page"` : ''}>${icons[id]}<span>${label}</span></a>`)}
  </nav>`);
}
