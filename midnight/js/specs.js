// Specs tab: Guardian / Feral stat priorities + 12.1.5 talent export strings from Icy Veins, Wowhead and Method.
import { SPEC_LABEL } from './config.js';
import { store } from './store.js';
import { $, $$, esc, toast } from './util.js';

const fmtDate = s => { if (!s) return ''; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); };

export class SpecsView {
  constructor(root, data, app) { this.root = root; this.D = data.specs; this.app = app; this.render(); }
  render() {
    const spec = store.get().spec;
    const S = this.D.specs[spec];
    const src = s => S.sources.filter(x => x.site === s);
    const upd = site => { const x = src(site); return x.length ? fmtDate(x[0].updated) : ''; };
    const stats = S.stats.map(s => `<div class="card pad statcard"><div class="row between"><b>${esc(s.site)}</b><span class="small">${esc(s.context)}</span></div>
        ${s.order ? `<ol class="stats">${s.order.map(o => `<li>${esc(o)}</li>`).join('')}</ol>` : `<p class="statline">${esc(s.text)}</p>`}
        <div class="small"><a href="${s.url}" target="_blank" rel="noopener">source ↗</a> · updated ${esc(upd(s.site))}</div></div>`).join('');
    const heroes = [...new Set(S.builds.map(b => b.hero || 'Other / encounter-specific'))];
    const builds = heroes.map(hn => `<h3 class="hero">${esc(hn)}</h3>` + S.builds.filter(b => (b.hero || 'Other / encounter-specific') === hn).map(b => `
      <div class="build"><div class="row between"><div><b>${esc(b.name)}</b> <span class="badge">${esc(b.site)}</span></div>
        <div class="row"><button class="btn sm" data-copy="${esc(b.code)}">Copy string</button><a class="small" href="${b.url}" target="_blank" rel="noopener">source ↗</a></div></div>
        <code class="tstr">${esc(b.code)}</code></div>`).join('')).join('');
    const notes = this.D.switching.map(n => `<li>${esc(n.text)} ${n.src ? `<a class="small" href="${n.src}" target="_blank" rel="noopener">[${esc(n.srcName)}]</a>` : '<span class="small">[derived from the stat/build data on this page]</span>'}</li>`).join('');
    this.root.innerHTML = `<div class="wrap">
      <div class="card pad"><div class="row between"><h2>Guardian &amp; Feral · ${esc(this.D.patch)}</h2>
        <div class="seg" role="tablist">${Object.entries(SPEC_LABEL).map(([k, v]) => `<button data-spec="${k}" aria-pressed="${k === spec}">${v}</button>`).join('')}</div></div>
        <p class="small">Talent strings import in-game: Talents (N) → loadout menu → Import. Sources: ${S.sources.filter((x, i, a) => a.findIndex(y => y.url === x.url) === i).map(x => `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.site)} ${esc(x.what)}</a> (${esc(fmtDate(x.updated))})`).join(' · ')}</p></div>
      <h2 class="sect">Stat priority</h2><div class="grid3">${stats}</div>
      <h2 class="sect">Talent builds (${S.builds.length})</h2><div class="card pad">${builds}</div>
      <h2 class="sect">Switching between Guardian and Feral</h2><div class="card pad"><ul class="notes">${notes}</ul></div>
    </div>`;
    $$('[data-spec]', this.root).forEach(b => b.onclick = () => { store.setSpec(b.dataset.spec); this.render(); this.app.pill(); });
    $$('[data-copy]', this.root).forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('Talent string copied'); }
      catch { const r = document.createRange(); r.selectNodeContents(b.closest('.build').querySelector('code')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selected — press Ctrl+C'); }
    });
  }
}
