// Staff strip. Phase 1: an empty grand staff with clefs and the playhead.
// Phase 2 replaces this with the scrolling, note-by-note renderer.

export async function renderEmptyStaff(host, { clefs = ['treble', 'bass'], time = '4/4' } = {}) {
  const VF = (await import('vexflow/bravura')).default;
  await document.fonts.load('30px Bravura');

  const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  const w = host.clientWidth;
  const h = host.clientHeight;
  const scale = Math.min(1, h / 210);
  const div = document.createElement('div');
  div.className = 'staff__svg';
  host.appendChild(div);

  const r = new VF.Renderer(div, VF.Renderer.Backends.SVG);
  r.resize(w, h);
  const ctx = r.getContext();
  ctx.scale(scale, scale);
  ctx.setFillStyle(ink);
  ctx.setStrokeStyle(ink);

  const grand = clefs.length === 2;
  const blockH = grand ? 190 : 90;
  const top = (h / scale - blockH) / 2 - 10;
  const width = w / scale - 24;
  const staves = clefs.map((c, i) => {
    const s = new VF.Stave(12, top + i * 95, width).addClef(c).addTimeSignature(time);
    s.setStyle({ strokeStyle: ink, fillStyle: ink });
    s.setContext(ctx).draw();
    return s;
  });
  if (grand) {
    new VF.StaveConnector(staves[0], staves[1]).setType('brace').setContext(ctx).draw();
    new VF.StaveConnector(staves[0], staves[1]).setType('singleLeft').setContext(ctx).draw();
  }
}
