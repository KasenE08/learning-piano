// Shared mock helpers: VexFlow grand-staff strip + 36-key keyboard.
// Styling comes from CSS variables of each concept; JS reads them.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Ode to Joy (hands together, simplified). Durations: q h w 8, "d" = dotted.
const RH = [
  ['e/4 q', 'e/4 q', 'f/4 q', 'g/4 q'],
  ['g/4 q', 'f/4 q', 'e/4 q', 'd/4 q'],
  ['c/4 q', 'c/4 q', 'd/4 q', 'e/4 q'],
  ['e/4 qd', 'd/4 8', 'd/4 h'],
  ['e/4 q', 'e/4 q', 'f/4 q', 'g/4 q'],
  ['g/4 q', 'f/4 q', 'e/4 q', 'd/4 q'],
];
const LH = [
  ['c/3 w'], ['g/3 h', 'b/3 h'], ['c/3 w'], ['g/3 h', 'g/3 h'], ['c/3 w'], ['g/3 w'],
];
// status per RH note index (flattened): 'hit' | 'miss' | 'next' | null ; timing: e/o/l
const RH_STATE = ['hit', 'hit', 'hit', 'hit', 'hit', 'hit', 'miss', 'hit', 'next'];
const RH_TIMING = ['o', 'o', 'e', 'o', 'o', 'l', null, 'o'];
const LH_STATE = ['hit', 'hit', 'hit', 'next'];

export async function renderStrip(host, { playheadFrac = 0.3, scale = 0.92, measureW = 230, mode = 'mono' } = {}) {
  const VF = window.VexFlow;
  await document.fonts.load('30px Bravura');
  VF.setFonts('Bravura', 'Academico');
  const ink = css('--ink');
  const faded = css('--ink-faded') || ink;
  const hitC = css('--hit') || ink;
  const missC = css('--miss') || ink;
  const nextC = css('--next') || ink;

  const H = host.clientHeight;
  const W = host.clientWidth;
  const strip = document.createElement('div');
  strip.className = 'vf-strip';
  host.appendChild(strip);
  const totalW = 40 + measureW * RH.length + 20;
  const renderer = new VF.Renderer(strip, VF.Renderer.Backends.SVG);
  renderer.resize(totalW * scale, H);
  const ctx = renderer.getContext();
  ctx.scale(scale, scale);
  ctx.setFillStyle(ink);
  ctx.setStrokeStyle(ink);

  const topY = (H / scale - 190) / 2;
  const notesRH = [];
  const notesLH = [];
  let x = 20;
  let rhI = 0;
  let lhI = 0;
  RH.forEach((m, i) => {
    const w = i === 0 ? measureW + 70 : measureW;
    const t = new VF.Stave(x, topY, w);
    const b = new VF.Stave(x, topY + 95, w);
    if (i === 0) {
      t.addClef('treble').addTimeSignature('4/4');
      b.addClef('bass').addTimeSignature('4/4');
    }
    [t, b].forEach((s) => s.setStyle({ strokeStyle: ink, fillStyle: ink }));
    t.setContext(ctx).draw();
    b.setContext(ctx).draw();
    if (i === 0) {
      new VF.StaveConnector(t, b).setType('brace').setContext(ctx).draw();
      new VF.StaveConnector(t, b).setType('singleLeft').setContext(ctx).draw();
    }
    const mk = (spec, clef) => {
      const [key, durRaw] = spec.split(' ');
      const dotted = durRaw.endsWith('d');
      const dur = durRaw.replace('d', '');
      const n = new VF.StaveNote({ keys: [key], duration: dotted ? dur + 'd' : dur, clef, autoStem: true });
      if (dotted) VF.Dot.buildAndAttach([n], { all: true });
      return n;
    };
    const tn = m.map((s) => mk(s, 'treble'));
    const bn = LH[i].map((s) => mk(s, 'bass'));
    const style = (n, st) => {
      if (st === 'hit') n.setStyle({ fillStyle: hitC, strokeStyle: hitC });
      else if (st === 'miss') n.setStyle({ fillStyle: missC, strokeStyle: missC });
      else if (st === 'next') n.setStyle({ fillStyle: nextC, strokeStyle: nextC });
      else n.setStyle({ fillStyle: ink, strokeStyle: ink });
    };
    tn.forEach((n) => { n._st = RH_STATE[rhI]; n._tm = RH_TIMING[rhI]; n._k = n.keys[0]; style(n, RH_STATE[rhI]); rhI++; });
    bn.forEach((n) => { n._st = LH_STATE[lhI]; n._k = n.keys[0]; style(n, LH_STATE[lhI]); lhI++; });
    const vt = new VF.Voice({ numBeats: 4, beatValue: 4 }).addTickables(tn);
    const vb = new VF.Voice({ numBeats: 4, beatValue: 4 }).addTickables(bn);
    new VF.Formatter().joinVoices([vt]).joinVoices([vb]).format([vt, vb], w - (i === 0 ? 100 : 30));
    const beams = VF.Beam.generateBeams(tn);
    vt.draw(ctx, t);
    vb.draw(ctx, b);
    beams.forEach((bm) => bm.setContext(ctx).draw());
    notesRH.push(...tn);
    notesLH.push(...bn);
    x += w;
  });

  // Position strip so that the "next" note sits under the playhead.
  const next = notesRH.find((n) => n._st === 'next');
  const nextX = (next.getAbsoluteX() + 6) * scale;
  const playX = W * playheadFrac;
  const shift = playX - nextX;
  strip.style.transform = `translateX(${shift}px)`;

  // Overlays: miss marks + timing ticks under played notes.
  const overlay = document.createElement('div');
  overlay.className = 'vf-overlay';
  host.appendChild(overlay);
  notesRH.forEach((n) => {
    if (!n._st || n._st === 'next') return;
    const nx = (n.getAbsoluteX() + 6) * scale + shift;
    const ys = n.getYs()[0] * scale;
    if (n._st === 'miss') {
      const m = document.createElement('div');
      m.className = 'mark-miss';
      m.style.left = `${nx}px`;
      m.style.top = `${ys}px`;
      overlay.appendChild(m);
    }
    if (n._tm) {
      const t = document.createElement('div');
      t.className = `mark-timing t-${n._tm}`;
      t.style.left = `${nx}px`;
      t.style.top = `${(topY + 82) * scale}px`;
      overlay.appendChild(t);
    }
  });
  const ph = document.createElement('div');
  ph.className = 'playhead';
  ph.style.left = `${playX}px`;
  host.appendChild(ph);

  // Sticky clef gutter
  const gut = document.createElement('div');
  gut.className = 'clef-gutter';
  host.appendChild(gut);
  const r2 = new VF.Renderer(gut, VF.Renderer.Backends.SVG);
  r2.resize(70 * scale, H);
  const c2 = r2.getContext();
  c2.scale(scale, scale);
  c2.setFillStyle(ink);
  c2.setStrokeStyle(ink);
  const t2 = new VF.Stave(14, topY, 52).addClef('treble');
  const b2 = new VF.Stave(14, topY + 95, 52).addClef('bass');
  [t2, b2].forEach((s) => { s.setStyle({ strokeStyle: ink, fillStyle: ink }); s.setContext(c2).draw(); });
  new VF.StaveConnector(t2, b2).setType('brace').setContext(c2).draw();
  new VF.StaveConnector(t2, b2).setType('singleLeft').setContext(c2).draw();
  return { mode };
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// state: { 'C4': 'next', 'D4': 'hit', 'E3': 'next' }, fingers: { 'C4': 1 }
export function renderKeyboard(host, { state = {}, fingers = {}, labels = 'c', low = 3, octaves = 3 } = {}) {
  host.classList.add('kb');
  const whites = [];
  const blacks = [];
  for (let o = low; o < low + octaves; o++) {
    NAMES.forEach((nm, i) => {
      const id = nm + o;
      if (nm.includes('#')) blacks.push({ id, after: whites.length - 1 });
      else whites.push({ id, nm, o });
    });
  }
  const wW = 100 / whites.length;
  whites.forEach((k, i) => {
    const el = document.createElement('div');
    el.className = `key white ${state[k.id] || ''}`;
    el.style.left = `${i * wW}%`;
    el.style.width = `${wW}%`;
    const showLbl = labels === 'all' || (labels === 'c' && k.nm === 'C');
    if (showLbl) {
      const l = document.createElement('span');
      l.className = 'lbl';
      l.textContent = labels === 'all' ? k.nm : `C${k.o}`;
      el.appendChild(l);
    }
    if (k.id === 'C4') el.classList.add('middle-c');
    if (fingers[k.id]) {
      const f = document.createElement('span');
      f.className = 'finger';
      f.textContent = fingers[k.id];
      el.appendChild(f);
    }
    host.appendChild(el);
  });
  blacks.forEach((k) => {
    const el = document.createElement('div');
    el.className = `key black ${state[k.id] || ''}`;
    el.style.left = `${(k.after + 1) * wW - wW * 0.31}%`;
    el.style.width = `${wW * 0.62}%`;
    host.appendChild(el);
  });
}

export function screen() {
  const s = new URLSearchParams(location.search).get('s') || 'home';
  document.querySelectorAll('[data-screen]').forEach((el) => { el.hidden = el.dataset.screen !== s; });
  document.body.dataset.s = s;
  return s;
}
