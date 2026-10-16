// "Treasure & Fishing" tab (shared by Forever Hunter and Midnight Druid):
//   Collectibles from fishing (main view) · World treasures (rares/chests with mount/pet/toy drops) · Fish (the original fishing guide).
// Draws the Treasure and World-treasure layers on the shared quest map.
import { store } from './store.js';
import { $, $$, esc, debounce, coord } from './util.js';

const TYPES = { mount: ['Mount', '🐎'], pet: ['Pet', '🐾'], toy: ['Toy', '🎲'], appearance: ['Appearance', '👕'], rare: ['Rare item', '💎'], container: ['Chest / crate', '🧰'] };
const QC = ['#9d9d9d', '#ffffff', '#1eff00', '#0070dd', '#a335ee', '#ff8000', '#e6cc80', '#00ccff'];
const KIND = { fished: 'Fished up', 'fishing chest': 'Fishing chest / pool', 'fished container': 'Inside a fished container', vendor: 'Fishing vendor', quest: 'Fishing quest',
  reputation: 'Fishing reputation', rare: 'Rare spawn', object: 'Treasure chest / object', drop: 'Drop', 'container item': 'Inside container', hatch: 'Hatches from (fished)' };
const LAYER = { fish: { pref: 'trLayer', color: '#ffd24a', label: 'Treasure (fishing)' }, world: { pref: 'wtLayer', color: '#ff6fb1', label: 'World treasures' } };
const PAGE = 40;

export class TreasureView {
  constructor(root, data, app, FishCtor) {
    Object.assign(this, { root, T: data.treasure, app });
    this.mode = store.pref('trMode') || 'fish';
    this.f = { q: '', types: new Set(Object.keys(TYPES)), zone: 'all', hide: false };
    this.limit = PAGE;
    root.innerHTML = `<div class="wrap"><div class="card pad trhead">
        <div class="row between"><h2 class="serif">Treasure &amp; Fishing</h2><span class="small" id="trCount"></span></div>
        <div class="progress bar" aria-hidden="true"><i id="trBar" style="width:0"></i></div>
        <div class="seg" id="trModes"><button data-mode="fish" aria-pressed="false">Fishing collectibles</button><button data-mode="world" aria-pressed="false">World treasures</button><button data-mode="fishguide" aria-pressed="false">Fish</button></div>
        <div id="trFilters">
          <div class="row" id="trTypes"></div>
          <input class="search" id="trSearch" type="search" placeholder="Search mounts, pets, toys, zones, rares…" aria-label="Search treasure">
          <div class="row"><label class="field">Zone<select id="trZone"></select></label>
            <label class="check small"><input type="checkbox" id="trHide"> Hide "got it"</label>
            <label class="check small"><input type="checkbox" id="trLayerCb"> Show this layer on the map</label></div>
          <p class="small" id="trNote"></p>
        </div></div>
      <div id="trBody" class="trlist"></div><div id="trFish" hidden></div></div>`;
    this.fish = new FishCtor($('#trFish', root), data, app);
    this.bind(); this.setMode(this.mode);
  }
  // --- delegation so existing app code that talks to "fishing" keeps working
  find(id) { return this.fish.find?.(id); }
  refresh() { this.fish.refresh?.(); this.list(); }
  onRaceChange() { this.fish.onRaceChange?.(); }
  bind() {
    const r = this.root;
    $$('#trModes button', r).forEach(b => b.onclick = () => this.setMode(b.dataset.mode));
    $('#trSearch', r).oninput = debounce(e => { this.f.q = e.target.value.trim().toLowerCase(); this.limit = PAGE; this.list(); });
    $('#trZone', r).onchange = e => { this.f.zone = e.target.value; this.limit = PAGE; this.list(); };
    $('#trHide', r).onchange = e => { this.f.hide = e.target.checked; this.list(); };
    $('#trLayerCb', r).onchange = e => { store.pref(LAYER[this.mode].pref, e.target.checked); this.syncMapBoxes(); this.app.quests?.drawMarkers(); };
    r.addEventListener('change', e => {
      const t = e.target.closest('[data-got]'); if (!t) return;
      store.toggle('got', t.dataset.got, t.checked); t.closest('.trcard')?.classList.toggle('isdone', t.checked); this.count();
    });
    r.addEventListener('click', e => {
      const b = e.target.closest('[data-trmap]'); if (b) { this.showOnMap(+b.dataset.ui, +b.dataset.x, +b.dataset.y, b.dataset.layer); return; }
      if (e.target.closest('.trmore')) { this.limit += PAGE; this.list(); }
      const c = e.target.closest('[data-type]'); if (c) {
        const k = c.dataset.type; this.f.types.has(k) ? this.f.types.delete(k) : this.f.types.add(k);
        c.setAttribute('aria-pressed', this.f.types.has(k)); this.limit = PAGE; this.list();
      }
    });
  }
  setMode(m) {
    this.mode = m; store.pref('trMode', m);
    $$('#trModes button', this.root).forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
    const guide = m === 'fishguide';
    $('#trFilters', this.root).hidden = guide; $('#trBody', this.root).hidden = guide; $('#trFish', this.root).hidden = !guide;
    $('#trCount', this.root).hidden = guide; $('#trBar', this.root).parentElement.hidden = guide;
    if (guide) { this.fish.refresh?.(); return; }
    const pool = this.pool();
    const types = Object.keys(TYPES).filter(k => pool.some(i => i.type === k));
    $('#trTypes', this.root).innerHTML = types.map(k => `<button class="chip" data-type="${k}" aria-pressed="${this.f.types.has(k)}">${TYPES[k][1]} ${TYPES[k][0]} <span class="small">${pool.filter(i => i.type === k).length}</span></button>`).join('');
    const zones = [...new Set(pool.flatMap(i => i.sources.map(s => s.zone).filter(Boolean)))].sort();
    $('#trZone', this.root).innerHTML = `<option value="all">All zones</option>` + zones.map(z => `<option>${esc(z)}</option>`).join('');
    this.f.zone = 'all';
    $('#trLayerCb', this.root).checked = !!store.pref(LAYER[m].pref);
    $('#trNote', this.root).innerHTML = esc(m === 'fish' ? this.T.notes.fish : this.T.notes.world);
    this.limit = PAGE; this.list();
  }
  pool(m = this.mode) { return this.T.items.filter(i => (m === 'fish' ? i.fishing : i.world)); }
  srcFor(i, m = this.mode) { return i.sources.filter(s => m === 'fish' ? !['rare', 'object', 'drop', 'container item'].includes(s.kind) : ['rare', 'object'].includes(s.kind)); }
  visible() {
    const f = this.f;
    return this.pool().filter(i => f.types.has(i.type) && (!f.hide || !store.has('got', i.id))
      && (f.zone === 'all' || this.srcFor(i).some(s => s.zone === f.zone))
      && (!f.q || (i.name + ' ' + TYPES[i.type][0] + ' ' + i.sources.map(s => (s.name || '') + ' ' + (s.zone || '')).join(' ')).toLowerCase().includes(f.q)));
  }
  count() {
    if (this.mode === 'fishguide') return;
    const p = this.pool(), n = p.filter(i => store.has('got', i.id)).length;
    $('#trCount', this.root).innerHTML = `Got <b>${n}</b> / ${p.length} · showing ${this.vis.length}`;
    $('#trBar', this.root).style.width = (p.length ? 100 * n / p.length : 0).toFixed(1) + '%';
  }
  srcLine(s, layer) {
    const pc = s.pct != null ? `<b>${s.pct < 0.01 ? '&lt;0.01' : s.pct < 0.1 ? s.pct.toFixed(2) : s.pct.toFixed(1)}%</b>${s.outof ? ` <span class="small">(${s.count?.toLocaleString()} / ${s.outof.toLocaleString()} on Wowhead)</span>` : ''}` : '<span class="small">chance not listed</span>';
    const c0 = s.coords && s.coords[0];
    return `<li><span class="badge">${esc(KIND[s.kind] || s.kind)}</span> <a href="${s.url}" target="_blank" rel="noopener">${esc(s.name || '?')}</a>
      ${s.zone ? `· ${esc(s.zone)}` : ''} ${c0 ? `<b>${coord(c0[0], c0[1])}</b>${s.spawns > 1 ? ` <span class="small">+${s.spawns - 1} more spawn points</span>` : ''}` : ''}
      ${s.pool ? `· pool: ${esc(s.pool)}` : ''} ${s.kind === 'vendor' && s.cost ? `· ${esc(s.costText || '')}` : ''} · ${pc}
      ${c0 && s.ui ? `<button class="btn ghost sm" data-trmap="1" data-ui="${s.ui}" data-x="${c0[0]}" data-y="${c0[1]}" data-layer="${layer}">map</button>` : ''}</li>`;
  }
  card(i) {
    const got = store.has('got', i.id), srcs = this.srcFor(i);
    const req = [i.req.skill != null ? `Fishing skill ${i.req.skill}+ <span class="small">(${esc(i.req.skillSrc || '')})</span>` : '', i.req.level ? `Level ${i.req.level}` : '', ...(i.req.other || []).map(esc)].filter(Boolean);
    return `<article class="card trcard ${got ? 'isdone' : ''}"><div class="fg">${TYPES[i.type][1]}</div><div class="body">
      <div class="row between"><h3><a href="${i.url}" target="_blank" rel="noopener" style="color:${QC[i.quality] || '#fff'}">${esc(i.name)}</a></h3>
        <label class="check"><input type="checkbox" data-got="${i.id}" ${got ? 'checked' : ''}> Got it</label></div>
      <div class="small">${TYPES[i.type][0]} <span class="st ${i.tag.cls}">${esc(i.tag.label)}</span></div>
      <ul class="srcs">${srcs.slice(0, 8).map(s => this.srcLine(s, this.mode)).join('') || '<li class="small">Source details not listed on Wowhead.</li>'}${srcs.length > 8 ? `<li class="small">+${srcs.length - 8} more sources on <a href="${i.url}" target="_blank" rel="noopener">Wowhead</a></li>` : ''}</ul>
      ${req.length ? `<div class="small">Requirements: ${req.join(' · ')}</div>` : ''}
      ${i.tips.map(t => `<p class="small tip">💡 ${esc(t.text)} <a href="${t.src}" target="_blank" rel="noopener">[guide]</a></p>`).join('')}
      ${i.tooltip ? `<details class="small"><summary>Tooltip</summary><pre class="tt">${esc(i.tooltip)}</pre></details>` : ''}
      </div></article>`;
  }
  list() {
    if (this.mode === 'fishguide') return;
    this.vis = this.visible();
    const el = $('#trBody', this.root);
    el.innerHTML = (this.vis.slice(0, this.limit).map(i => this.card(i)).join('') || '<div class="empty">Nothing matches.</div>')
      + (this.vis.length > this.limit ? `<button class="btn trmore">Show more (${this.vis.length - this.limit})</button>` : '');
    this.count();
  }
  syncMapBoxes() { for (const k of Object.keys(LAYER)) { const cb = document.getElementById('mLayer-' + k); if (cb) cb.checked = !!store.pref(LAYER[k].pref); } }
  /** legend checkboxes for the quest map */
  legendHTML() {
    return Object.entries(LAYER).map(([k, l]) => `<label class="check small"><input type="checkbox" id="mLayer-${k}" data-layer="${k}" ${store.pref(l.pref) ? 'checked' : ''}><i class="mk tr" style="background:${l.color}"></i> ${l.label}</label>`).join('');
  }
  bindLegend(root, redraw) {
    $$('[data-layer]', root).forEach(cb => cb.onchange = () => { store.pref(LAYER[cb.dataset.layer].pref, cb.checked); if (this.mode === cb.dataset.layer) $('#trLayerCb', this.root).checked = cb.checked; redraw(); });
  }
  showOnMap(ui, x, y, layer) {
    store.pref(LAYER[layer]?.pref || 'trLayer', true); this.syncMapBoxes(); $('#trLayerCb', this.root).checked = true;
    this.app.go(this.app.mapView || 'quests');
    this.app.quests.showMap(ui); this.app.quests.drawMarkers();
    const ll = this.app.mv.project(ui, x, y); if (ll) this.app.mv.map.setView(ll, 1);
    setTimeout(() => document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }
  drawLayer(mv) {
    if (store.pref('fishLayer')) this.fish.drawLayer?.(mv);
    for (const [k, l] of Object.entries(LAYER)) {
      if (!store.pref(l.pref)) continue;
      const pins = new Map();   // one pin per spawn point; items sharing a chest/rare are listed together
      for (const i of this.pool(k)) for (const s of this.srcFor(i, k)) {
        if (!s.coords || !s.ui) continue;
        for (const [x, y] of s.coords.slice(0, 25)) {
          const key = `${s.kind}|${s.id || s.name}|${s.ui}|${x}|${y}`;
          if (!pins.has(key)) pins.set(key, { s, x, y, items: [] });
          pins.get(key).items.push(i);
        }
      }
      for (const { s, x, y, items } of pins.values()) {
        const ll = mv.project(s.ui, x, y); if (!ll) continue;
        const top = items[0], allGot = items.every(i => store.has('got', i.id));
        mv.marker(ll, { color: l.color, cls: 'tr' + (allGot ? ' done' : ''), html: TYPES[top.type][1], title: `${s.name || ''}: ${items.map(i => i.name).join(', ')}`,
          popup: `<b>${esc(KIND[s.kind] || s.kind)}: <a href="${s.url}" target="_blank" rel="noopener">${esc(s.name || '')}</a></b><br>${esc(s.zone || '')} ${coord(x, y)}${s.spawns > 1 ? ` · ${s.spawns} spawn points` : ''}
            <br>${items.slice(0, 8).map(i => `${TYPES[i.type][1]} <span style="color:${QC[i.quality] || '#fff'}">${esc(i.name)}</span>${(i.sources.find(o => o.kind === s.kind && (o.id || o.name) === (s.id || s.name)) || {}).pct != null ? ` – ${(i.sources.find(o => o.kind === s.kind && (o.id || o.name) === (s.id || s.name))).pct}%` : ''}`).join('<br>')}${items.length > 8 ? `<br>+${items.length - 8} more` : ''}` });
      }
    }
  }
}
