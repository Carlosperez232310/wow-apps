// Fishing tab (Midnight): zones & skill, pools, fish (with real per-zone catch %), rods/lures, trainers, 12.1 changes & collectibles.
import { store } from './store.js';
import { $, $$, esc, debounce, coord } from './util.js';
import { qcol } from './questmap.js';

const SUBS = { zones: 'Zones & trainers', pools: 'Pools', fish: 'Fish', gear: 'Rods, lures & lines', extra: '12.1 & collectibles' };
const pct = (c, o) => (c && o ? (100 * c / o) : null);

export class FishingView {
  constructor(root, data, app) { this.root = root; this.F = data.fishing; this.Z = data.zones.zones; this.app = app; this.sub = store.pref('fSub') || 'zones'; this.q = ''; this.render(); }
  render() {
    this.root.innerHTML = `<div class="wrap"><div class="card pad">
      <div class="row between"><h2>Midnight fishing</h2><span class="small" id="fiCount"></span></div>
      <div class="seg wrapseg">${Object.entries(SUBS).map(([k, v]) => `<button data-sub="${k}" aria-pressed="${k === this.sub}">${v}</button>`).join('')}</div>
      <input class="search" id="fiSearch" placeholder="Search fish, pools, items…" aria-label="Search fishing">
      <div class="row"><label class="field">My Midnight Fishing skill<input id="fiSkill" type="number" min="0" max="300" value="${store.pref('fishSkill') ?? ''}" placeholder="0–300"></label>
        <label class="check small"><input type="checkbox" id="fiLayer" ${store.pref('fishLayer') ? 'checked' : ''}> Show trainers &amp; spots on the map</label></div>
      <p class="small">Main source: <a href="${this.F.source}" target="_blank" rel="noopener">Wowhead Midnight Fishing guide</a> (updated ${esc((this.F.updated || '').slice(0, 10))}). Catch % = Wowhead's recorded catches of that fish in the zone ÷ all recorded catches in the zone.</p>
    </div><div id="fiBody"></div></div>`;
    $$('[data-sub]', this.root).forEach(b => b.onclick = () => { this.sub = b.dataset.sub; store.pref('fSub', this.sub); $$('[data-sub]', this.root).forEach(x => x.setAttribute('aria-pressed', x === b)); this.body(); });
    $('#fiSearch', this.root).oninput = debounce(e => { this.q = e.target.value.trim().toLowerCase(); this.body(); });
    $('#fiSkill', this.root).oninput = debounce(e => { store.pref('fishSkill', e.target.value === '' ? null : +e.target.value); this.body(); });
    $('#fiLayer', this.root).onchange = e => { store.pref('fishLayer', e.target.checked); const m = document.getElementById('mFish'); if (m) m.checked = e.target.checked; this.app.quests.drawMarkers(); };
    this.root.addEventListener('change', e => {
      const t = e.target.closest('[data-fished]'); if (!t) return;
      store.toggle('fished', t.dataset.fished, t.checked); t.closest('.card')?.classList.toggle('isdone', t.checked); this.count();
    });
    this.root.addEventListener('click', e => { const b = e.target.closest('[data-fmap]'); if (b) this.app.showOnMap(+b.dataset.fmap, +b.dataset.x, +b.dataset.y); });
    this.body();
  }
  m(s) { return !this.q || s.toLowerCase().includes(this.q); }
  count() {
    const ids = [...this.F.pools.map(p => 'p' + p.id), ...this.F.fish.map(f => 'i' + f.item)];
    $('#fiCount', this.root).innerHTML = `Fished <b>${ids.filter(i => store.has('fished', i)).length}</b> / ${ids.length} pools &amp; fish`;
  }
  fishedBox(id, label = 'Fished') { return `<label class="check"><input type="checkbox" data-fished="${id}" ${store.has('fished', id) ? 'checked' : ''}> ${label}</label>`; }
  body() {
    const el = $('#fiBody', this.root);
    el.innerHTML = this[this.sub]();
    this.count();
  }
  zones() {
    const sk = store.pref('fishSkill');
    return this.F.zoneSkill.map(z => {
      const zd = this.Z.find(x => x.name.startsWith(z.zone)) || {};
      const tr = this.F.trainers.filter(t => t.areaId === zd.uiMapId || (z.zone === 'Eversong' && t.areaId === 15969));
      const pools = this.F.pools.filter(p => p.zone.includes(z.zone));
      const fish = this.F.fish.map(f => ({ f, i: (f.fishedIn || []).find(x => x.areaId === zd.uiMapId) })).filter(x => x.i).sort((a, b) => b.i.count - a.i.count);
      if (!this.m(z.zone + pools.map(p => p.name).join(' ') + fish.map(x => x.f.name).join(' '))) return '';
      const cls = sk == null ? '' : sk >= z.rec ? 'ok' : sk >= z.min ? 'mid' : 'low';
      return `<article class="card pad fz"><div class="row between"><h3>${esc(zd.name || z.zone)}</h3><span class="sk ${cls}">min ${z.min} · recommended ${z.rec}</span></div>
        ${tr.length ? `<div class="small">Trainers: ${tr.map(t => `<a href="${t.url}" target="_blank" rel="noopener">${esc(t.name)}</a> (${esc(t.zoneName)} ${coord(t.x, t.y)}) <button class="btn ghost sm" data-fmap="${t.areaId}" data-x="${t.x}" data-y="${t.y}">map</button>`).join(' · ')}</div>` : ''}
        <div class="small">Pools: ${pools.map(p => esc(p.name)).join(', ') || '—'}</div>
        <div class="plist">${fish.slice(0, 12).map(({ f, i }) => `<span class="pill" style="color:${qcol(f.quality)}">${esc(f.name)} <b>${pct(i.count, i.outof).toFixed(1)}%</b></span>`).join('')}</div>
        <div class="small">% of ${(fish[0]?.i.outof || 0).toLocaleString()} recorded catches in the zone (Wowhead), Midnight fish only; the rest is mostly grey junk and treasure.</div></article>`;
    }).join('') + `<div class="card pad"><h3>Notes</h3><ul class="notes">${this.F.zoneNotes.map(n => `<li>${esc(n)} <span class="small">[Wowhead guide]</span></li>`).join('')}
      <li>Learn Midnight Fishing from any trainer above (from level 78) before skill goes up. <span class="small">[Wowhead guide]</span></li></ul></div>`;
  }
  pools() {
    return this.F.pools.filter(p => this.m(p.name + ' ' + p.zone + ' ' + p.fish.join(' '))).map(p => `<article class="card pad ${store.has('fished', 'p' + p.id) ? 'isdone' : ''}">
      <div class="row between"><h3>${esc(p.name)}</h3>${this.fishedBox('p' + p.id)}</div>
      <div class="small">${esc(p.zone)} · <a href="${p.url}" target="_blank" rel="noopener">Wowhead ↗</a> · no fixed coordinates (pools rotate around the zone's water)</div>
      <div class="plist">${p.fish.map(f => `<span class="pill">${esc(f)}</span>`).join('')}</div>${p.note ? `<p class="small">${esc(p.note)}</p>` : ''}</article>`).join('');
  }
  fish() {
    return this.F.fish.filter(f => this.m(f.name + ' ' + f.pools.join(' ') + ' ' + f.openWater.join(' ') + ' ' + (f.effect || ''))).map(f => `<article class="card pad ${store.has('fished', 'i' + f.item) ? 'isdone' : ''}">
      <div class="row between"><h3><a href="${f.url}" target="_blank" rel="noopener" style="color:${qcol(f.quality)}">${esc(f.name)}</a></h3>${this.fishedBox('i' + f.item, 'Caught')}</div>
      <div class="small">Open water: ${esc(f.openWater.join(', ') || '—')} · Pools: ${esc(f.pools.join(', ') || '—')}</div>
      ${f.effect ? `<div class="small">Effect: ${esc(f.effect)}</div>` : ''}
      <div class="plist">${(f.fishedIn || []).slice(0, 5).map(i => `<span class="pill">${esc(i.name)} ${pct(i.count, i.outof)?.toFixed(1) ?? '?'}%</span>`).join('')}</div>
      ${f.usedFor.length ? `<div class="small">Used for: ${f.usedFor.map(u => esc(u.name)).join(', ')}</div>` : ''}
      ${f.note ? `<p class="small">${esc(f.note)}</p>` : ''}</article>`).join('');
  }
  gear() {
    const rods = this.F.rods.filter(r => this.m(r.name + (r.tooltip || ''))).map(r => `<article class="card pad"><h3><a href="${r.url}" target="_blank" rel="noopener" style="color:${qcol(r.quality)}">${esc(r.name)}</a></h3>
      <div class="small">${esc(r.how)}${r.mats ? ' · mats: ' + esc(r.mats) : ''}</div><pre class="tt">${esc(r.tooltip || '')}</pre></article>`).join('');
    const lures = this.F.lures.filter(l => this.m((l.name || '') + (l.text || ''))).map(l => `<article class="card pad"><h3><a href="${l.url}" target="_blank" rel="noopener">${esc(l.name)}</a></h3>
      <p>${esc(l.text || '')}</p><div class="small">${esc(l.how)}${l.recipe ? ' · ' + esc(l.recipe) : ''}${l.mats ? ' · guide: ' + esc(l.mats) : ''}${l.tooltipReagents ? ' · tooltip reagents: ' + esc(l.tooltipReagents) : ''}</div>
      ${l.tooltipReagents && l.mats && !l.mats.includes(l.tooltipReagents.replace(/ \(\d+\)/, '')) ? '<div class="small warn">Guide and in-game tooltip disagree on the reagent; trust the tooltip.</div>' : ''}</article>`).join('');
    const ex = this.F.extras.filter(e => e.kind !== 'mount' && e.kind !== 'collectible').map(e => `<article class="card pad"><h3>${esc(e.title)}</h3><p class="small">${esc(e.text)}</p>
      ${e.ways.map(w => `<button class="btn ghost sm" data-fmap="${w.areaId}" data-x="${w.x}" data-y="${w.y}">${coord(w.x, w.y)} on map</button>`).join(' ')}</article>`).join('');
    return `<h2 class="sect">Rods</h2><div class="grid3">${rods}</div><h2 class="sect">Lures &amp; wards</h2><div class="grid3">${lures}</div><h2 class="sect">Lines &amp; treasures</h2><div class="grid3">${ex}</div>`;
  }
  extra() {
    const c = this.F.changes121;
    const col = this.F.extras.filter(e => e.kind === 'mount' || e.kind === 'collectible');
    return `<div class="card pad"><h3>Patch 12.1 changes</h3><p>${esc(c.text)}</p>
      <div class="small">New 12.1 fish:</div><div class="plist">${c.newFish.map(f => `<a class="pill" href="${f.url}" target="_blank" rel="noopener" style="color:${qcol(f.quality)}">${esc(f.name)}</a>`).join('')}</div></div>
      <div class="grid3">${col.map(e => `<article class="card pad"><h3>${esc(e.title.replace('[/h3]', ''))}</h3><p class="small">${esc(e.text)}</p></article>`).join('')}
      <article class="card pad"><h3>"Lost" weapon transmogs (fished, BoE)</h3><div class="plist">${this.F.transmog.map(t => `<a class="pill" href="${t.url}" target="_blank" rel="noopener" style="color:${qcol(t.quality)}">${esc(t.name)}</a>`).join('')}</div></article>
      <article class="card pad"><h3>Warping Wise teleport spots</h3><p class="small">Warping Wise (level 90) teleports you to one of these; often near a pool.</p>
        ${this.F.warpingWise.map(w => `<div class="small">${esc(w.label)} ${coord(w.x, w.y)} ${w.areaId ? `<button class="btn ghost sm" data-fmap="${w.areaId}" data-x="${w.x}" data-y="${w.y}">map</button>` : ''}</div>`).join('')}</article></div>`;
  }
  drawLayer(mv) {
    const cur = mv.current;
    for (const t of this.F.trainers) if (t.areaId === cur) mv.marker(mv.project(cur, t.x, t.y), { color: '#2ad1c9', cls: 'fish', title: t.name, popup: `<b>${esc(t.name)}</b><br>Fishing trainer ${coord(t.x, t.y)}<br><a href="${t.url}" target="_blank" rel="noopener">Wowhead ↗</a>` });
    for (const w of this.F.warpingWise) if (w.areaId === cur) mv.marker(mv.project(cur, w.x, w.y), { color: '#9a7bff', cls: 'fish', title: 'Warping Wise spot', popup: `<b>Warping Wise teleport spot</b><br>${esc(w.label)} ${coord(w.x, w.y)}` });
    for (const e of this.F.extras) for (const w of e.ways) if (w.areaId === cur) mv.marker(mv.project(cur, w.x, w.y), { color: '#e0b44c', cls: 'fish', title: e.title, popup: `<b>${esc(e.title)}</b><br>${coord(w.x, w.y)}` });
  }
}
