import { html, el } from '../dom.js';
import { icons } from '../icons.js';
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
        return html`<li class="song ${on ? '' : 'is-locked'}">
          <span class="song__icon">${on ? icons.songs : icons.lock}</span>
          <span class="song__t"><b class="display">${secret ? '???' : s.title}</b><small>${secret ? 'Hidden song' : s.by}</small></span>
          <span class="song__hint">${on ? 'Play' : secret ? 'Keep playing' : `Clear ${levelLabel(s.unlock.level)}`}</span>
        </li>`;
      })}
    </ul>
  </main>`);
  root.append(screen, dock('songs'));
}
