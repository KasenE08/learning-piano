// On-screen 36-key keyboard. Multi-touch; reports presses as MIDI numbers.
// Visual states per key: 'next' (glow + finger number), 'hit' (green), 'miss' (red).
import { isBlack, nameOf, octaveOf } from '../../core/music.js';

export function createKeyboard({ low = 48, keys = 36, onPress = () => {}, onRelease = () => {} } = {}) {
  const root = document.createElement('div');
  root.className = 'kb';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Piano keyboard');

  const whites = [];
  for (let m = low; m < low + keys; m++) if (!isBlack(m)) whites.push(m);
  const wPct = 100 / whites.length;
  const byMidi = new Map();

  for (let m = low; m < low + keys; m++) {
    const k = document.createElement('div');
    k.dataset.midi = m;
    k.setAttribute('aria-label', nameOf(m));
    if (isBlack(m)) {
      const leftWhite = whites.indexOf(m - 1);
      k.className = 'kb__key kb__key--black';
      k.style.left = `${(leftWhite + 1) * wPct - wPct * 0.31}%`;
      k.style.width = `${wPct * 0.62}%`;
    } else {
      const i = whites.indexOf(m);
      k.className = 'kb__key kb__key--white';
      k.style.left = `${i * wPct}%`;
      k.style.width = `${wPct}%`;
      if (m % 12 === 0) {
        const l = document.createElement('span');
        l.className = 'kb__label';
        l.textContent = `C${octaveOf(m)}`;
        k.appendChild(l);
        if (m === 60) k.classList.add('kb__key--middle-c');
      }
    }
    byMidi.set(m, k);
    root.appendChild(k);
  }

  // Pointer handling: each pointer tracks the key it is on (supports glissando).
  const active = new Map();
  const keyAt = (x, y) => {
    const t = document.elementFromPoint(x, y)?.closest('.kb__key');
    return t && root.contains(t) ? t : null;
  };
  const press = (id, k) => {
    const prev = active.get(id);
    if (prev === k) return;
    if (prev) { prev.classList.remove('is-down'); onRelease(Number(prev.dataset.midi)); }
    active.set(id, k);
    if (k) { k.classList.add('is-down'); onPress(Number(k.dataset.midi)); }
  };
  const release = (id) => {
    const k = active.get(id);
    if (k) { k.classList.remove('is-down'); onRelease(Number(k.dataset.midi)); }
    active.delete(id);
  };
  root.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    root.setPointerCapture?.(e.pointerId);
    press(e.pointerId, keyAt(e.clientX, e.clientY));
  });
  root.addEventListener('pointermove', (e) => { if (active.has(e.pointerId)) press(e.pointerId, keyAt(e.clientX, e.clientY)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => root.addEventListener(t, (e) => release(e.pointerId)));

  return {
    el: root,
    /** states: { [midi]: 'next' | 'hit' | 'miss' }, fingers: { [midi]: 1..5 } */
    setMarks(states = {}, fingers = {}) {
      byMidi.forEach((k, m) => {
        k.classList.toggle('is-next', states[m] === 'next');
        k.classList.toggle('is-hit', states[m] === 'hit');
        k.classList.toggle('is-miss', states[m] === 'miss');
        let f = k.querySelector('.kb__finger');
        if (fingers[m]) {
          if (!f) { f = document.createElement('span'); f.className = 'kb__finger'; k.appendChild(f); }
          f.textContent = fingers[m];
        } else if (f) f.remove();
      });
    },
  };
}
