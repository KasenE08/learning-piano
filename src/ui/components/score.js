// Scrolling score: the whole piece is engraved once (VexFlow) as one long line.
// A fixed playhead sits at PLAYHEAD_FRAC of the stage; setBeat() slides the music
// under it. Notes can be marked hit / miss / next. A sticky gutter keeps the
// clefs and key signature visible once the first bar has scrolled away.
import { tripletGroups } from '../../engine/notation.js';

export const PLAYHEAD_FRAC = 0.3;
const STAVE_GAP = 100; // distance between the treble and bass staves (unscaled)
const TOP_PAD = 30;

const vfKey = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  return `${m[1].toLowerCase()}${m[2]}/${m[3]}`;
};
const vfDur = (e) => e.dur + 'd'.repeat(e.dots) + (e.rest ? 'r' : '');
const BEAMLESS = new Set(['w', 'h', 'q']);
const DYN_TEXT = { cresc: 'cresc.', dim: 'dim.' };

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
  // Clef changes: level.clefChanges = { lh: [[bar, 'treble'], [bar, 'bass']] } (bars 1-based).
  const changes = level.clefChanges || {};
  const clefAt = (part, i) => {
    let c = layout.find((l) => l.part === part).clef;
    for (const [bar, clef] of changes[part] || []) if (bar - 1 <= i) c = clef;
    return c;
  };
  const clefChangesAt = (i) => i > 0 && layout.some(({ part }) => clefAt(part, i) !== clefAt(part, i - 1));
  // Vertical span: fingerings/ledger lines above, the staves, fingerings/ledger lines below.
  // Extra room for 8va brackets above (and 8vb below), clear of the fingerings.
  const ott = level.ottava || [];
  const above = TOP_PAD + (ott.some((o) => o.type !== '8vb') ? 36 : 0);
  const below = (layout.some((l) => l.part === 'lh') ? 48 : 30) + (ott.some((o) => o.type === '8vb') ? 22 : 0);
  const span = above + (staffCount - 1) * STAVE_GAP + 40 + below;
  const H = host.clientHeight;
  const W = host.clientWidth;
  const scale = Math.min(1.05, H / (span + 8));
  const top = (H / scale - span) / 2 + above - 40; // Stave y sits 40px above its top line
  const key = level.key || 'C';
  const time = level.time || '4/4';

  // ---------- build notes per bar, measure widths ----------
  const bars = [];
  const parts = parsed.display || parsed.parts;
  const nBars = parsed.displayBars ?? parsed.bars;
  for (let i = 0; i < nBars; i++) {
    const voices = [];
    const all = [];
    for (const { part } of layout) {
      const clef = clefAt(part, i);
      const m = parts[part][i];
      const notes = m.events.map((e) => {
        const n = new VF.StaveNote({
          keys: e.rest ? [clef === 'bass' ? 'd/3' : 'b/4'] : (e.shown || e.names).map(vfKey),
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
        // Shared dynamics are written once, between the staves (the right hand's copy).
        const dupDyn = part === 'lh' && e.dyn && parts.rh?.[i]?.events.some((r) => r.dyn === e.dyn && Math.abs(r.beat - e.beat) < 1e-6);
        if (e.dyn && !dupDyn) {
          // Dynamics sit between the staves: under the right hand, over the left.
          const d = new VF.Annotation(DYN_TEXT[e.dyn] || e.dyn).setFont('Times New Roman', DYN_TEXT[e.dyn] ? 13 : 16, 'bold', 'italic');
          d.setVerticalJustification(part === 'lh' ? VF.AnnotationVerticalJustify.TOP : VF.AnnotationVerticalJustify.BOTTOM);
          d.setStyle({ fillStyle: ink, strokeStyle: ink });
          n.addModifier(d, 0);
        }
        e._vf = n;
        return n;
      });
      // Triplets: 3 in the time of 2. Must exist before the voice counts ticks.
      const tuplets = tripletGroups(m.events).map((g) => new VF.Tuplet(g.events.map((e) => e._vf), {
        numNotes: 3, notesOccupied: 2, bracketed: g.events.some((e) => e.rest || BEAMLESS.has(e.dur)),
        location: part === 'lh' ? 1 : -1, // opposite the fingerings, so the 3 isn't read as a finger
      }));
      const [num, den] = time.split('/').map(Number);
      const v = new VF.Voice({ numBeats: (m.beats * den) / 4, beatValue: den }).setMode(VF.Voice.Mode.SOFT).addTickables(notes);
      VF.Accidental.applyAccidentals([v], key);
      voices.push({ part, clef, voice: v, notes, events: m.events, num, tuplets, ottava: m.ottava });
      all.push(v);
    }
    const fmt = new VF.Formatter();
    voices.forEach(({ voice }) => fmt.joinVoices([voice]));
    const minW = fmt.preCalculateMinTotalWidth(all);
    const beats = parts[layout[0].part][i].beats;
    const width = Math.max(minW * 1.5 + 36, beats * 46, 120) + (clefChangesAt(i) ? 28 : 0);
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
    const staves = layout.map(({ part }, s) => {
      const clef = clefAt(part, i);
      const w = bar.width + (i === 0 ? firstExtra : 0);
      const st = new VF.Stave(x, top + s * STAVE_GAP, w);
      if (i === 0) st.addClef(clef).addKeySignature(key).addTimeSignature(time);
      else if (clef !== clefAt(part, i - 1)) st.addClef(clef, 'small');
      if (i === 0 && parsed.repeatBeats) st.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
      if (i === bars.length - 1) st.setEndBarType(parsed.repeatBeats ? VF.Barline.type.REPEAT_END : VF.Barline.type.END);
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
      // Beam plain notes by beat (by dotted quarter in 6/8); each triplet group beams on its own.
      const inTuplet = new Set(v.tuplets.flatMap((t) => t.getNotes()));
      const groups = time.endsWith('/8') ? [new VF.Fraction(3, 8)] : undefined;
      let run = [];
      const flush = () => {
        const plain = run.filter((n) => !n.isRest());
        if (plain.length > 1) VF.Beam.generateBeams(plain, groups ? { groups } : {}).forEach((b) => b.setContext(ctx).draw());
        run = [];
      };
      v.notes.forEach((n) => { if (inTuplet.has(n)) flush(); else run.push(n); });
      flush();
      v.tuplets.forEach((t) => {
        const tn = t.getNotes();
        if (!tn.some((n) => n.isRest()) && tn.every((n) => !BEAMLESS.has(n.getDuration()))) new VF.Beam(tn).setContext(ctx).draw();
        t.setStyle({ fillStyle: ink, strokeStyle: ink });
        t.setContext(ctx).draw();
      });
    });
    const mStart = parts[layout[0].part][i].start;
    anchors.push([mStart, startX - 4]);
    bar.voices.forEach((v) => v.events.forEach((e) => {
      anchors.push([e.beat, e._vf.getAbsoluteX() + 6]);
      if (e.tie) ties.push(e);
    }));
    x += bar.width + (i === 0 ? firstExtra : 0);
    if (i === bars.length - 1) anchors.push([mStart + parts[layout[0].part][i].beats, staves[0].getNoteEndX() - 6]);
  });

  // Ties (drawn after all notes exist).
  for (const { part } of layout) {
    const flat = parts[part].flatMap((m) => m.events);
    flat.forEach((e, i) => {
      const nx = flat[i + 1];
      if (e.tie && nx && !e.rest) {
        new VF.StaveTie({ firstNote: e._vf, lastNote: nx._vf, firstIndexes: e.keys.map((_, k) => k), lastIndexes: nx.keys.map((_, k) => k) }).setContext(ctx).draw();
      }
    });
  }

  // 8va / 8vb brackets over runs of marked bars.
  for (const { part } of layout) {
    let runStart = null;
    const ms = parts[part];
    ms.forEach((m, i) => {
      const nx = ms[i + 1];
      if (m.ottava && !runStart) runStart = m;
      if (runStart && (!nx || nx.ottava !== m.ottava)) {
        const evs = ms.slice(runStart.index, i + 1).flatMap((x) => x.events);
        const tb = new VF.TextBracket({
          start: evs[0]._vf, stop: evs.at(-1)._vf, text: '8', superscript: m.ottava === '8vb' ? 'vb' : 'va',
          position: m.ottava === '8vb' ? VF.TextBracket.Position.BOTTOM : VF.TextBracket.Position.TOP,
        });
        tb.renderOptions.color = ink;
        tb.setStyle({ fillStyle: ink, strokeStyle: ink });
        tb.setLine(3).setContext(ctx).draw();
        runStart = null;
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
  const gw = probe(false) + 22;
  let gutterClefs = '';
  // Redrawn when a clef change scrolls past, so the gutter always shows the clefs in force.
  const drawGutter = (i) => {
    const clefs = layout.map(({ part }) => clefAt(part, i));
    if (clefs.join() === gutterClefs) return;
    gutterClefs = clefs.join();
    gutter.replaceChildren();
    const gr = new VF.Renderer(gutter, VF.Renderer.Backends.SVG);
    gr.resize(Math.ceil(gw * scale), H);
    const gctx = gr.getContext();
    gctx.scale(scale, scale);
    gctx.setFillStyle(ink);
    gctx.setStrokeStyle(ink);
    const gst = clefs.map((clef, s) => {
      const st = new VF.Stave(10, top + s * STAVE_GAP, gw - 10).addClef(clef).addKeySignature(key);
      st.setStyle({ strokeStyle: ink, fillStyle: ink });
      st.setContext(gctx).draw();
      return st;
    });
    if (gst.length === 2) {
      new VF.StaveConnector(gst[0], gst[1]).setType('brace').setContext(gctx).draw();
      new VF.StaveConnector(gst[0], gst[1]).setType('singleLeft').setContext(gctx).draw();
    }
  };
  drawGutter(0);
  gutter.style.width = `${Math.ceil(gw * scale) + 24}px`;
  const barStarts = parts[layout[0].part].map((m) => m.start);
  const barAt = (b) => { let i = 0; while (i + 1 < barStarts.length && barStarts[i + 1] <= b) i++; return i; };
  const hasChanges = Object.keys(changes).length > 0;

  const playX = Math.round(W * PLAYHEAD_FRAC);
  const svgOf = (e) => e._vf.getSVGElement?.() || null;
  const marked = new Map();

  const api = {
    pass: 0,
    playX,
    scale,
    beatToX,
    setBeat(beat) {
      // With repeat signs the second pass scrolls the same music again.
      const rb = parsed.repeatBeats;
      const pass = rb && beat >= rb ? 1 : 0;
      if (rb && pass !== api.pass) { api.pass = pass; api.clearMarks(); }
      const local = pass ? beat - rb : beat;
      const tx = playX - beatToX(local) * scale;
      // The gutter covers about one bar left of the playhead: show the clef of the bar under it.
      if (hasChanges) drawGutter(barAt(Math.max(0, local - 1)));
      strip.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
      // Gutter appears once the first bar's own clefs have slid under it.
      gutter.classList.toggle('is-on', tx < -10);
    },
    /** state: 'hit' | 'miss' | 'next' | null, applied to the note's event (chords share). */
    mark(note, state) {
      const el = svgOf(note.event.orig || note.event);
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

/** A single note on a small staff, for intro cards and drills. */
export async function renderNoteCard(host, { note, clef = 'treble', keySig = 'C', scale = 1.25 }) {
  const VF = await vexflow();
  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#f2f2f2';
  host.replaceChildren();
  const w = 150;
  const h = 128;
  const r = new VF.Renderer(host, VF.Renderer.Backends.SVG);
  r.resize(w * scale, h * scale);
  const ctx = r.getContext();
  ctx.scale(scale, scale);
  ctx.setFillStyle(ink);
  ctx.setStrokeStyle(ink);
  const st = new VF.Stave(4, 14, w - 8).addClef(clef).addKeySignature(keySig);
  st.setStyle({ strokeStyle: ink, fillStyle: ink });
  st.setContext(ctx).draw();
  const n = new VF.StaveNote({ keys: [vfKey(note)], duration: 'w', clef });
  const v = new VF.Voice({ numBeats: 4, beatValue: 4 }).addTickables([n]);
  VF.Accidental.applyAccidentals([v], keySig);
  new VF.Formatter().joinVoices([v]).format([v], w - st.getNoteStartX() - 10);
  v.draw(ctx, st);
}
