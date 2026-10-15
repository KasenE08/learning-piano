// Portrait for menus, landscape for lessons. iOS ignores manifest orientation
// locks, so we show a friendly overlay when the phone is held the wrong way.
// Only phone-sized screens are nagged; desktop browsers just get the layout.

const overlay = () => document.getElementById('rotate');
let want = 'portrait';
let onBack = null;

const isPortrait = () => window.matchMedia('(orientation: portrait)').matches;
const isPhone = () => Math.min(window.innerWidth, window.innerHeight) < 540;

function update() {
  const el = overlay();
  const portrait = isPortrait();
  const wrong = want === 'landscape' ? portrait : !portrait && isPhone();
  document.documentElement.dataset.orientation = portrait ? 'portrait' : 'landscape';
  el.hidden = !wrong;
  if (!wrong) return;
  el.dataset.want = want;
  el.querySelector('.rotate__title').textContent = want === 'landscape' ? 'Turn your phone sideways' : 'Turn back to portrait';
  el.querySelector('.rotate__sub').textContent = want === 'landscape'
    ? 'Lessons use the full width so the music and all 36 keys fit.'
    : 'Menus and the map are designed for portrait.';
  let btn = el.querySelector('.rotate__back');
  if (want === 'landscape' && onBack) {
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'btn btn--ghost rotate__back';
      btn.textContent = 'Back to map';
      el.appendChild(btn);
    }
    btn.onclick = onBack;
  } else if (btn) btn.remove();
}

export function requireOrientation(orientation, back = null) {
  want = orientation;
  onBack = back;
  update();
}

export function init() {
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => setTimeout(update, 250));
  update();
}
