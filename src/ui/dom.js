// Tiny DOM helpers: escaped HTML templates without a framework.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Raw HTML marker so nested templates are not escaped twice. */
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);

/** html`<p>${text}</p>` escapes interpolations unless they are raw() or arrays of raw(). */
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => {
    if (Array.isArray(v)) out += v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('');
    else out += v instanceof Raw ? v.s : esc(v);
    out += strings[i + 1];
  });
  return raw(out);
}

/** Create an element from an html`` result. */
export function el(tpl) {
  const t = document.createElement('template');
  t.innerHTML = String(tpl).trim();
  return t.content.firstElementChild;
}

export const pad2 = (n) => String(n).padStart(2, '0');
