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
    fmt.preCalculateMinTotalWidth(all); // sizes each tick context (accidentals, dots…)
    const m0 = parts[layout[0].part][i];
    // Onsets in this bar (both hands share them): room each needs left and right of its x.
    // Beamed notes draw no flag, so their flag's width doesn't count (beams group by
    // beat, by dotted quarter in compound time, and each triplet on its own: as drawn below).
    const beatLen = time.endsWith('/8') ? 1.5 : 1;
    const onsets = new Map();
    voices.forEach(({ events }) => {
      const tri = new Map();
      tripletGroups(events).forEach((g, k) => g.events.forEach((e) => tri.set(e, `t${k}`)));
      const group = (e) => tri.get(e) ?? Math.floor((e.beat - m0.start) / beatLen + 1e-6);
      const flagged = (e) => e && !e.rest && !BEAMLESS.has(e._vf.getDuration());
      events.forEach((e, k) => {
        const n = e._vf;
        const mt = n.getMetrics();
        const beamed = flagged(e) && [events[k - 1], events[k + 1]].some((o) => flagged(o) && group(o) === group(e));
        const flag = beamed && n.getStemDirection() === VF.Stem.UP ? n.getGlyphWidth() : 0;
        const key = Math.round(e.beat * 1e6);
        const o = onsets.get(key) || { beat: e.beat, left: 0, right: 0 };
        o.left = Math.max(o.left, mt.modLeftPx + mt.leftDisplacedHeadPx);
        o.right = Math.max(o.right, mt.notePx - flag + mt.modRightPx + mt.rightDisplacedHeadPx);
        onsets.set(key, o);
      });
    });
    bars.push({ voices, fmt, all, start: m0.start, beats: m0.beats, onsets: [...onsets.values()].sort((a, b) => a.beat - b.beat) });
  }

  // ---------- engrave ----------
  // Room taken by clef + key + time signature at the start of bar 1.
  const probe = (withTime) => {
    const st = new VF.Stave(0, 0, 600).addClef(layout[0].clef).addKeySignature(key);
    if (withTime) st.addTimeSignature(time);
    return st.getNoteStartX();
  };
  // ---------- time-proportional layout ----------
  // Every beat gets the same width, so the score scrolls at one steady speed.
  // A note sits at X(beat); barlines, clef/key/time signatures and accidentals fit
  // in the gap before it. The width per beat is the least that keeps the busiest
  // spot in the piece from colliding.
  const staveFor = (i, x = 0, y = 0, w = 600) => layout.map(({ part }, s) => {
    const clef = clefAt(part, i);
    const st = new VF.Stave(x, y + s * STAVE_GAP, w);
    if (i === 0) st.addClef(clef).addKeySignature(key).addTimeSignature(time);
    else if (clef !== clefAt(part, i - 1)) st.addClef(clef, 'small');
    if (i === 0 && parsed.repeatBeats) st.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
    return st;
  });
  // From a stave's left edge to where a note with tick-context x = 0 is drawn.
  const notePad = (() => {
    const st = new VF.Stave(0, 0, 600);
    const n = new VF.StaveNote({ keys: ['c/4'], duration: 'q' }).setStave(st);
    new VF.TickContext().addTickable(n).preFormat().setX(0);
    return n.getAbsoluteX() - st.getNoteStartX();
  })();
  // Room from a barline to the next note: just a gap, or the clef/key/time signs.
  const lead = bars.map((bar, i) => (i === 0 || clefChangesAt(i)
    ? Math.max(...staveFor(i).map((st) => st.getNoteStartX() - st.getX())) + 4
    : bar.onsets[0]?.left > 0 ? 5 : 10));
  const GAP = 8;
  const BAR_GAP = 6; // last note to the barline
  const gapBefore = (o) => (o.left > 0 ? 4 : GAP); // an accidental brings its own margin
  const END_LEAD = 14;
  // Wide enough for the busiest spots, but capped so a few beats always show
  // ahead of the playhead; anything still cramped is nudged right a little below.
  const MAX_PX_PER_BEAT = 130;
  let need = 44;
  const flat = bars.flatMap((bar, i) => bar.onsets.map((o) => ({ ...o, bar: i })));
  const pieceEnd = bars.at(-1).start + bars.at(-1).beats;
  flat.forEach((a, k) => {
    const b = flat[k + 1];
    const [room, gap] = !b ? [a.right + GAP + END_LEAD, pieceEnd - a.beat]
      : b.bar === a.bar ? [a.right + gapBefore(b) + b.left, b.beat - a.beat]
        : [a.right + BAR_GAP + lead[b.bar] + b.left, bars[b.bar].start - a.beat];
    if (gap > 1e-9) need = Math.max(need, room / gap);
  });
  const pxPerBeat = Math.ceil(Math.min(MAX_PX_PER_BEAT, need));
  const start0 = bars[0].start;
  const X0 = 20 + lead[0] + (bars[0].onsets[0]?.left ?? 0);
  const X = (beat) => X0 + (beat - start0) * pxPerBeat;
  // Where each note is drawn: at its time, unless the one before needs the room.
  const noteX = new Map();
  let edge = 20; // right edge (plus gap) of the last note placed
  bars.forEach((bar, i) => {
    const first = bar.onsets[0];
    bar.x = Math.max(X(bar.start) - lead[i] - (first?.left ?? 0), i === 0 ? 20 : edge);
    let min = bar.x + lead[i];
    let prevRight = null;
    bar.onsets.forEach((o) => {
      const x = Math.max(X(o.beat), (prevRight == null ? min : prevRight + gapBefore(o)) + o.left);
      noteX.set(Math.round(o.beat * 1e6), x);
      prevRight = x + o.right;
    });
    edge = (prevRight ?? min) + BAR_GAP;
  });
  const endX = Math.max(X(pieceEnd), edge) + END_LEAD;
  bars.forEach((bar, i) => { bar.width = (i + 1 < bars.length ? bars[i + 1].x : endX) - bar.x; });

  // The score is cut into chunks of a few bars, each its own SVG whose viewBox
  // is its slice of one long line (so drawing code uses the same coordinates).
  // Only chunks near the playhead are shown: a 30-bar piece would otherwise be
  // one image tens of thousands of pixels wide, slow to move on a phone.
  const strip = document.createElement('div');
  strip.className = 'score__strip';
  host.appendChild(strip);
  const barX = [];
  {
    bars.forEach((bar) => barX.push(bar.x));
    barX.push(endX);
  }
  const CHUNK_W = 1200;
  const chunks = [];
  const chunkOfBar = [];
  bars.forEach((_, i) => {
    let c = chunks.at(-1);
    if (!c || barX[i + 1] - c.x0 > CHUNK_W) {
      c = { x0: i === 0 ? 0 : barX[i], bars: [] };
      chunks.push(c);
    }
    c.bars.push(i);
    c.x1 = i === bars.length - 1 ? barX[i + 1] + 40 : barX[i + 1];
    chunkOfBar[i] = chunks.length - 1;
  });
  chunks.forEach((c) => {
    c.el = document.createElement('div');
    c.el.className = 'score__chunk';
    c.el.style.left = `${(c.x0 * scale).toFixed(2)}px`;
    strip.appendChild(c.el);
    const r = new VF.Renderer(c.el, VF.Renderer.Backends.SVG);
    r.resize(Math.ceil((c.x1 - c.x0) * scale), H);
    c.ctx = r.getContext();
    c.ctx.setViewBox(c.x0, 0, (Math.ceil((c.x1 - c.x0) * scale)) / scale, H / scale);
    c.ctx.svg.style.overflow = 'visible'; // ties and brackets may run into the next chunk
    c.ctx.setFillStyle(ink);
    c.ctx.setStrokeStyle(ink);
  });
  const ctxOfBar = (i) => chunks[chunkOfBar[i]].ctx;

  const ties = [];
  bars.forEach((bar, i) => {
    const ctx = ctxOfBar(i);
    const staves = staveFor(i, bar.x, top, bar.width);
    staves.forEach((st) => {
      if (i === bars.length - 1) st.setEndBarType(parsed.repeatBeats ? VF.Barline.type.REPEAT_END : VF.Barline.type.END);
      st.setStyle({ strokeStyle: ink, fillStyle: ink });
      st.setContext(ctx).draw();
    });
    if (i === 0 && staves.length === 2) {
      new VF.StaveConnector(staves[0], staves[1]).setType('brace').setContext(ctx).draw();
      new VF.StaveConnector(staves[0], staves[1]).setType('singleLeft').setContext(ctx).draw();
    }
    if (staves.length === 2) {
      new VF.StaveConnector(staves[0], staves[1]).setType(i === bars.length - 1 ? 'boldDoubleRight' : 'singleRight').setContext(ctx).draw();
    }
    // Both hands' notes share x positions, so both staves start their notes at
    // the same x (past a clef change in either).
    const startX = Math.max(...staves.map((st) => st.getNoteStartX()));
    staves.forEach((st) => st.setNoteStartX(startX));
    bar.fmt.format(bar.all, staves[0].getNoteEndX() - startX - 14);
    // Then put every note at its time: X(beat).
    bar.voices.forEach((v) => v.events.forEach((e) => e._vf.getTickContext().setX(noteX.get(Math.round(e.beat * 1e6)) - startX - notePad)));
    // A rest filling the whole bar sits in its middle, as printed music has it.
    const mid = (startX + bar.x + bar.width) / 2;
    bar.voices.forEach((v) => {
      const [e] = v.events;
      if (v.events.length === 1 && e.rest) e._vf.setXShift(mid - noteX.get(Math.round(e.beat * 1e6)) - e._vf.getGlyphWidth() / 2);
    });
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
    bar.voices.forEach((v) => v.events.forEach((e) => {
      e._bar = i;
      if (e.tie) ties.push(e);
    }));
  });

  // Ties (drawn after all notes exist).
  for (const { part } of layout) {
    const flat = parts[part].flatMap((m) => m.events);
    flat.forEach((e, i) => {
      const nx = flat[i + 1];
      if (e.tie && nx && !e.rest) {
        new VF.StaveTie({ firstNote: e._vf, lastNote: nx._vf, firstIndexes: e.keys.map((_, k) => k), lastIndexes: nx.keys.map((_, k) => k) }).setContext(ctxOfBar(e._bar)).draw();
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
        tb.setLine(3).setContext(ctxOfBar(runStart.index)).draw();
        runStart = null;
      }
    });
  }

  // Beat → x (unscaled px): a straight line, so the scroll speed never changes.
  // The +6 puts the playhead on the notehead rather than its left edge.
  const beatToX = (b) => X(b) + 6;
  // Furthest any note is drawn from its time (nudged where the music is crowded).
  const drift = Math.max(0, ...bars.flatMap((bar) => bar.voices.flatMap((v) => v.events.map((e) => Math.abs(e._vf.getAbsoluteX() - X(e.beat))))));

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
    pxPerBeat,
    drift,
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
      // Show only the chunks on screen (plus a margin either side).
      const left = -tx / scale - 300;
      const right = (W - tx) / scale + 600;
      for (const c of chunks) {
        const off = c.x1 < left || c.x0 > right;
        if (c.el.hidden !== off) c.el.hidden = off;
      }
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
