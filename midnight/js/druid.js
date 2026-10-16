// Druid tab: Worgen racials & notes, progress summary, export/import, sources.
import { GAME, CHAR } from './config.js';
import { store } from './store.js';
import { $, esc, toast } from './util.js';

export class DruidView {
  constructor(root, data, app) { this.root = root; this.D = data; this.app = app; this.render(); }
  render() {
    const W = this.D.worgen, M = this.D.meta;
    this.root.innerHTML = `<div class="wrap">
      <div class="card pad"><h2>Worgen Druid</h2><p class="small">${esc(CHAR.race)} (${CHAR.faction === 'A' ? 'Alliance' : 'Horde'}) ${esc(CHAR.cls)} · Guardian / Feral. Racials from <a href="${W.source}" target="_blank" rel="noopener">Wowhead's Worgen race page</a> + spell tooltips.</p></div>
      <div class="grid3">${W.racials.map(r => `<article class="card pad"><h3><a href="${r.url}" target="_blank" rel="noopener">${esc(r.name)}</a> <span class="badge">${esc(r.rank || '')}</span></h3><pre class="tt">${esc(r.text || '—')}</pre></article>`).join('')}</div>
      <h2 class="sect">Worgen &amp; Druid forms</h2><div class="card pad"><ul class="notes">${W.notes.map(n => `<li>${esc(n.text)} <a class="small" href="${n.src}" target="_blank" rel="noopener">[${esc(n.srcName)}]</a></li>`).join('')}</ul></div>
      <h2 class="sect">Progress</h2><div class="card pad" id="dSum"></div>
      <div class="card pad"><h3>Backup</h3><div class="row"><button class="btn" id="dExp">Export JSON</button><label class="btn ghost">Import JSON<input type="file" id="dImp" accept="application/json" hidden></label><button class="btn ghost" id="dReset">Reset all</button></div>
        <p class="small">Progress is stored only in this browser (${esc(GAME.storageKey)}).</p></div>
      <h2 class="sect">Data &amp; sources</h2><div class="card pad"><p class="small">Built ${esc(M.built)} · patch ${esc(GAME.patch)}. Counts: ${Object.entries(M.counts).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</p>
        <ul class="notes">${M.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a> <span class="small">${esc(s.what)}${s.updated ? ' · updated ' + esc(s.updated) : ''}${s.fetched ? ' · fetched ' + esc(s.fetched) : ''}</span></li>`).join('')}</ul>
        <p class="small">Fan-made, unofficial. World of Warcraft is a trademark of Blizzard Entertainment. Maps are schematic grids, not Blizzard art.</p></div></div>`;
    $('#dExp', this.root).onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' }));
      a.download = 'midnight-druid-progress.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#dImp', this.root).onchange = async e => { try { store.importJSON(await e.target.files[0].text()); toast('Imported'); location.reload(); } catch (err) { toast(err.message); } };
    $('#dReset', this.root).onclick = () => { if (confirm('Reset all progress?')) { store.reset(); location.reload(); } };
    this.summary();
  }
  summary() {
    const D = this.D, el = $('#dSum', this.root); if (!el) return;
    const ally = D.quests.filter(q => q.side !== 2);
    el.innerHTML = `<div class="row"><span class="pill">Gear quests done <b>${ally.filter(q => store.has('done', q.id)).length}</b> / ${ally.length}</span>
      <span class="pill">Forms collected <b>${D.forms.entries.filter(e => store.has('collected', e.id.slice(1))).length}</b> / ${D.forms.entries.length}</span>
      <span class="pill">Treasure got <b>${store.count('got')}</b> / ${(D.treasure?.items || []).length}</span>
      <span class="pill">Pools &amp; fish <b>${store.count('fished')}</b> / ${D.fishing.pools.length + D.fishing.fish.length}</span>
      <span class="pill">Current spec <b>${esc(store.get().spec)}</b></span></div>`;
  }
}
