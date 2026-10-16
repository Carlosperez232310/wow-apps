export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const hasBit = (mask, bit) => Math.floor(Number(mask) / bit) % 2 === 1;
export function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
export function toast(msg) {
  const el = h(`<div class="toast" role="status">${esc(msg)}</div>`);
  document.body.append(el); setTimeout(() => el.remove(), 2600);
}
export const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const coord = (x, y) => (x == null ? '' : `${x.toFixed(1)}, ${y.toFixed(1)}`);
