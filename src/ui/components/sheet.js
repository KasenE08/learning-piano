// Bottom sheet modal. Tap the backdrop or swipe down to dismiss.
import { el, html } from '../dom.js';

export function openSheet(content) {
  const wrap = el(html`<div class="sheet" role="dialog" aria-modal="true">
    <div class="sheet__backdrop"></div>
    <div class="sheet__panel"><span class="sheet__grip" aria-hidden="true"></span><div class="sheet__body"></div></div>
  </div>`);
  wrap.querySelector('.sheet__body').append(content);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('is-open'));

  const close = () => {
    wrap.classList.remove('is-open');
    setTimeout(() => wrap.remove(), 260);
    window.removeEventListener('hashchange', close);
  };
  wrap.querySelector('.sheet__backdrop').addEventListener('click', close);
  window.addEventListener('hashchange', close);

  // Swipe-down to dismiss.
  const panel = wrap.querySelector('.sheet__panel');
  let y0 = null;
  panel.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    const dy = Math.max(0, e.touches[0].clientY - y0);
    panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - (y0 ?? 0);
    panel.style.transform = '';
    y0 = null;
    if (dy > 80) close();
  });
  return close;
}
