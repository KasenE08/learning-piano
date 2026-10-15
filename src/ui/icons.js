import { raw } from './dom.js';

const STAR_PATH = 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z';

export const icons = {
  home: raw('<svg viewBox="0 0 22 22" fill="currentColor" aria-hidden="true"><path d="M3 10l8-6 8 6v9H3z"/></svg>'),
  map: raw('<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 3v16"/><circle cx="5" cy="6" r="2" fill="currentColor"/><circle cx="5" cy="15" r="2" fill="currentColor"/><path d="M10 6h8M10 15h6"/></svg>'),
  songs: raw('<svg viewBox="0 0 22 22" fill="currentColor" aria-hidden="true"><ellipse cx="7" cy="17" rx="3.2" ry="2.4"/><path d="M9.2 17V4l9-2v12h-1.6V4.6L10.8 6v11z"/><ellipse cx="15" cy="15" rx="3.2" ry="2.4"/></svg>'),
  you: raw('<svg viewBox="0 0 22 22" fill="currentColor" aria-hidden="true"><circle cx="11" cy="7.5" r="4"/><path d="M3 20c1-5 4.5-6.5 8-6.5s7 1.5 8 6.5z"/></svg>'),
  play: raw('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 3l15 9-15 9z"/></svg>'),
  back: raw('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>'),
  close: raw('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>'),
  metronome: raw('<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 13L6 1h2l2 12z"/><path d="M7 9l4-6"/></svg>'),
  lock: raw('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg>'),
  mic: raw('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5.5" y="1.5" width="5" height="8" rx="2.5"/><path d="M3 7.5a5 5 0 0010 0M8 12.5v2"/></svg>'),
  chevron: raw('<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>'),
};

export function stars(n, total = 3) {
  let s = '<span class="stars" aria-label="' + n + ' of ' + total + ' stars">';
  for (let i = 0; i < total; i++) s += `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="${i < n ? 'on' : 'off'}" d="${STAR_PATH}"/></svg>`;
  return raw(s + '</span>');
}
