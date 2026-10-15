import { html, el } from '../dom.js';
import { icons, stars } from '../icons.js';
import { dock } from '../components/dock.js';
import { songs, getProgress } from '../../core/store.js';

export const orientation = 'portrait';

const levelLabel = (id) => { const [sec, n] = id.split('-'); return `${sec[0].toUpperCase()}${sec.slice(1)} ${n}`; };

export function render(root) {
  const p = getProgress();
  const got = songs.filter((s) => p.songs[s.id]?.unlocked).length;
  const screen = el(html`<main class="screen screen--portrait songs">
    <header class="topbar"><span class="label">Song library</span></header>
    <h1 class="page-title display">Songs<span>${got}/${songs.length}</span></h1>
    <p class="page-sub">Public-domain classics and folk tunes. Clear levels to unlock them — some are hidden.</p>
    <ul class="songlist">
      ${songs.map((s) => {
        const on = !!p.songs[s.id]?.unlocked;
        const secret = s.hidden && !on;
        const rec = p.songs[s.id] || {};
        const isNew = (p.fresh || []).includes(s.id);
        const body = html`<span class="song__icon">${on ? icons.songs : icons.lock}</span>
          <span class="song__t"><b class="display">${secret ? '???' : s.title}${isNew ? html`<span class="new">NEW</span>` : ''}</b><small>${secret ? 'Hidden song' : s.by}</small></span>
          <span class="song__hint">${on ? (rec.stars ? stars(rec.stars) : 'Play ▸') : secret ? 'Keep playing' : `Clear ${levelLabel(s.unlock.level)}`}</span>`;
        return on ? html`<li class="song"><a class="song__link" href="#/lesson/song-${s.id}">${body}</a></li>` : html`<li class="song is-locked">${body}</li>`;
      })}
    </ul>
  </main>`);
  root.append(screen, dock('songs'));
}
