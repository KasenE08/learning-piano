// Scrolling score: the whole piece is engraved once (VexFlow) as one long line.
// A fixed playhead sits at PLAYHEAD_FRAC of the stage; setBeat() slides the music
// under it. Notes can be marked hit / miss / next. A sticky gutter keeps the
// clefs and key signature visible once the first bar has scrolled away.

export const PLAYHEAD_FRAC = 0.3;
const STAVE_GAP = 100; // distance between the treble and bass staves (unscaled)
const TOP_PAD = 30;

const vfKey = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  return `${m[1].toLowerCase()}${m[2]}/${m[3]}`;
};
const vfDur = (e) => e.dur + 'd'.repeat(e.dots) + (e.rest ? 'r' : '');

let VFp = null;
async function vexflow() {
  if (!VFp) {
    VFp = import('vexflow/bravura').then(async (m) => {
      await document.fonts.load('30px Bravura');
      return m.default;
    });
  }
  return VFp;
}

/** Which clef each part uses. Right hand on top. */
export function staffLayout(level) {
  const order = ['rh', 'lh'].filter((p) => level.parts?.[p]);
  const clefs = level.clefs || {};
  return order.map((p) => ({ part: p, clef: clefs[p] || (p === 'lh' ? 'bass' : 'treble') }));
}

export async function createScore(host, { level, parsed, fingers = true }) {
  const VF = await vexflow();
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f2f2f2';
  const layout = staffLayout(level);
  const staffCount = layout.length;
  // Vertical span: fingerings/ledger lines above, the staves, fingerings/ledger lines below.
  const above = TOP_PAD;
  const below = layout.some((l) => l.part === 'lh') ? 48 : 30;
  const span = above + (staffCount - 1) * STAVE_GAP + 40 + below;
  const H = host.clientHeight;
  const W = host.clientWidth;
  const scale = Math.min(1.05, H / (span + 8));
  const top = (H / scale - span) / 2 + above - 40; // Stave y sits 40px above its top line
  const key = level.key || 'C';
  const time = level.time || '4/4';

  // ---------- build notes per bar, measure widths ----------
  const bars = [];
  for (let i = 0; i < parsed.bars; i++) {
    const voices = [];
    const all = [];
    for (const { part, clef } of layout) {
      const m = parsed.parts[part][i];
      const notes = m.events.map((e) => {
        const n = new VF.StaveNote({
          keys: e.rest ? [clef === 'bass' ? 'd/3' : 'b/4'] : e.names.map(vfKey),
          duration: vfDur(e),
          clef,
          autoStem: !e.rest,
        });
        for (let d = 0; d < e.dots; d++) VF.Dot.buildAndAttach([n], { all: true });
        if (fingers && e.fingers.length && !e.rest) {
          const txt = e.fingers.join('\n');
          const a = new VF.Annotation(txt).setFont('Manrope', 10, 'bold');
          a.setVerticalJustification(part === 'lh' ? VF.AnnotationVerticalJustify.BOTTOM : VF.AnnotationVerticalJustify.TOP);
          n.addModifier(a, 0);
        }
        e._vf = n;
        return n;
      });
      const [num, den] = time.split('/').map(Number);
      const v = new VF.Voice({ numBeats: (m.beats * den) / 4, beatValue: den }).setMode(VF.Voice.Mode.SOFT).addTickables(notes);
      VF.Accidental.applyAccidentals([v], key);
      voices.push({ part, clef, voice: v, notes, events: m.events, num });
      all.push(v);
    }
    const fmt = new VF.Formatter();
    voices.forEach(({ voice }) => fmt.joinVoices([voice]));
    const minW = fmt.preCalculateMinTotalWidth(all);
    const beats = parsed.parts[layout[0].part][i].beats;
    const width = Math.max(minW * 1.5 + 36, beats * 46, 120);
    bars.push({ voices, fmt, width, all });
  }

  // ---------- engrave ----------
  // Room taken by clef + key + time signature at the start of bar 1.
  const probe = (withTime) => {
    const st = new VF.Stave(0, 0, 600).addClef(layout[0].clef).addKeySignature(key);
    if (withTime) st.addTimeSignature(time);
    return st.getNoteStartX();
  };
  const firstExtra = probe(true) + 6;
  const totalW = 20 + bars.reduce((a, b) => a + b.width, 0) + firstExtra + 40;
  const strip = document.createElement('div');
  strip.className = 'score__strip';
  host.appendChild(strip);
  const renderer = new VF.Renderer(strip, VF.Renderer.Backends.SVG);
  renderer.resize(Math.ceil(totalW * scale), H);
  const ctx = renderer.getContext();
  ctx.scale(scale, scale);
  ctx.setFillStyle(ink);
  ctx.setStrokeStyle(ink);

  const anchors = []; // [beat, x] (unscaled)
  let x = 20;
  const ties = [];
  bars.forEach((bar, i) => {
    const staves = layout.map(({ clef }, s) => {
      const w = bar.width + (i === 0 ? firstExtra : 0);
      const st = new VF.Stave(x, top + s * STAVE_GAP, w);
      if (i === 0) st.addClef(clef).addKeySignature(key).addTimeSignature(time);
      if (i === bars.length - 1) st.setEndBarType(VF.Barline.type.END);
      st.setStyle({ strokeStyle: ink, fillStyle: ink });
      st.setContext(ctx).draw();
      return st;
    });
    if (i === 0 && staves.length === 2) {
      new VF.StaveConnector(staves[0], staves[1]).setType('brace').setContext(ctx).draw();
      new VF.StaveConnector(staves[0], staves[1]).setType('singleLeft').setContext(ctx).draw();
    }
    if (staves.length === 2) {
      new VF.StaveConnector(staves[0], staves[1]).setType(i === bars.length - 1 ? 'boldDoubleRight' : 'singleRight').setContext(ctx).draw();
    }
    const startX = staves[0].getNoteStartX();
    const avail = staves[0].getNoteEndX() - startX - 14;
    bar.fmt.format(bar.all, avail);
    bar.voices.forEach((v, s) => {
      v.voice.draw(ctx, staves[s]);
      VF.Beam.generateBeams(v.notes.filter((n) => !n.isRest())).forEach((b) => b.setContext(ctx).draw());
    });
    const mStart = parsed.parts[layout[0].part][i].start;
    anchors.push([mStart, startX - 4]);
    bar.voices.forEach((v) => v.events.forEach((e) => {
      anchors.push([e.beat, e._vf.getAbsoluteX() + 6]);
      if (e.tie) ties.push(e);
    }));
    x += bar.width + (i === 0 ? firstExtra : 0);
    if (i === bars.length - 1) anchors.push([mStart + parsed.parts[layout[0].part][i].beats, staves[0].getNoteEndX() - 6]);
  });

  // Ties (drawn after all notes exist).
  for (const { part } of layout) {
    const flat = parsed.parts[part].flatMap((m) => m.events);
    flat.forEach((e, i) => {
      const nx = flat[i + 1];
      if (e.tie && nx && !e.rest) {
        new VF.StaveTie({ firstNote: e._vf, lastNote: nx._vf, firstIndexes: e.keys.map((_, k) => k), lastIndexes: nx.keys.map((_, k) => k) }).setContext(ctx).draw();
      }
    });
  }

  // Beat → x map: monotonic anchors (unscaled px).
  anchors.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const pts = [];
  for (const a of anchors) {
    const last = pts.at(-1);
    if (last && Math.abs(last[0] - a[0]) < 1e-6) continue;
    if (last && a[1] <= last[1]) continue;
    pts.push(a);
  }
  const firstSlope = pts.length > 1 ? (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]) : 40;
  const lastSlope = pts.length > 1 ? (pts.at(-1)[1] - pts.at(-2)[1]) / (pts.at(-1)[0] - pts.at(-2)[0]) : 40;
  const beatToX = (b) => {
    if (b <= pts[0][0]) return pts[0][1] + (b - pts[0][0]) * firstSlope;
    if (b >= pts.at(-1)[0]) return pts.at(-1)[1] + (b - pts.at(-1)[0]) * lastSlope;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][0] <= b) lo = mid; else hi = mid; }
    const [b0, x0] = pts[lo];
    const [b1, x1] = pts[hi];
    return x0 + ((b - b0) / (b1 - b0)) * (x1 - x0);
  };

  // ---------- sticky clef gutter ----------
  const gutter = document.createElement('div');
  gutter.className = 'score__gutter';
  host.appendChild(gutter);
  const gr = new VF.Renderer(gutter, VF.Renderer.Backends.SVG);
  const gw = probe(false) + 22;
  gr.resize(Math.ceil(gw * scale), H);
  const gctx = gr.getContext();
  gctx.scale(scale, scale);
  gctx.setFillStyle(ink);
  gctx.setStrokeStyle(ink);
  const gst = layout.map(({ clef }, s) => {
    const st = new VF.Stave(10, top + s * STAVE_GAP, gw - 10).addClef(clef).addKeySignature(key);
    st.setStyle({ strokeStyle: ink, fillStyle: ink });
    st.setContext(gctx).draw();
    return st;
  });
  if (gst.length === 2) {
    new VF.StaveConnector(gst[0], gst[1]).setType('brace').setContext(gctx).draw();
    new VF.StaveConnector(gst[0], gst[1]).setType('singleLeft').setContext(gctx).draw();
  }
  gutter.style.width = `${Math.ceil(gw * scale) + 24}px`;

  const playX = Math.round(W * PLAYHEAD_FRAC);
  const svgOf = (e) => e._vf.getSVGElement?.() || null;
  const marked = new Map();

  const api = {
    playX,
    scale,
    beatToX,
    setBeat(beat) {
      const tx = playX - beatToX(beat) * scale;
      strip.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
      // Gutter appears once the first bar's own clefs have slid under it.
      gutter.classList.toggle('is-on', tx < -10);
    },
    /** state: 'hit' | 'miss' | 'next' | null, applied to the note's event (chords share). */
    mark(note, state) {
      const el = svgOf(note.event);
      if (!el) return;
      const prev = marked.get(el);
      if (prev === 'miss' && state === 'hit') return; // a chord with any miss stays red
      el.classList.remove('is-hit', 'is-miss', 'is-next');
      if (state) el.classList.add(`is-${state}`);
      marked.set(el, state);
    },
    clearMarks() {
      marked.forEach((_, el) => el.classList.remove('is-hit', 'is-miss', 'is-next'));
      marked.clear();
    },
    destroy() { host.replaceChildren(); },
  };
  api.setBeat(-0.5);
  return api;
}
