// Feature 1: quest list + map with three Hunter categories.
import { GAME, RACES, QUEST_CATS, STATUS, ZONE_FLOW, CLASS_BIT } from './config.js';
import { store } from './store.js';
import { $, $$, esc, h, hasBit, debounce, coord } from './util.js';

const STAT_LABEL = { agi: 'Agi', sta: 'Sta', str: 'Str', int: 'Int', spi: 'Spi', atkpwr: 'AP', rgdatkpwr: 'Ranged AP',
  critstrkrtng: 'Crit', hitrtng: 'Hit', armor: 'Armor', dodgertng: 'Dodge', nslots: 'slots' };
const HUNTER_STATS = new Set(['agi', 'sta', 'atkpwr', 'rgdatkpwr', 'critstrkrtng', 'hitrtng']);
const RANGED = new Set(['Bow', 'Gun', 'Crossbow', 'Thrown']);
const AMMO = new Set(['Projectile', 'Quiver/Ammo Pouch']);
const PAGE = 50;

export function statLine(r) {
  const s = r.stats || {};
  const parts = [];
  if (s.rgddps) parts.push(`<b>${s.rgddps} DPS</b> · ${s.rgdspeed}s`);
  else if (s.mledps) parts.push(`${s.mledps} DPS · ${s.mlespeed}s`);
  else if (r.type === 'Projectile' && s.dps) parts.push(`<b>+${s.dps} DPS</b>`);
  for (const k of Object.keys(STAT_LABEL)) {
    if (!s[k]) continue;
    const txt = k === 'nslots' ? `${s[k]} slots` : `+${s[k]} ${STAT_LABEL[k]}`;
    parts.push(HUNTER_STATS.has(k) ? `<b>${txt}</b>` : txt);
  }
  return parts.join(' · ');
}

export class QuestView {
  constructor(root, data, mapView, app) {
    Object.assign(this, { root, data, mv: mapView, app });
    this.f = { cats: new Set(Object.keys(QUEST_CATS)), zone: 'all', min: 1, max: 60, hideDone: false, q: '',
      sort: 'path', mine: true, status: 'all' };
    this.limit = PAGE;
    this.sel = null;
    this.renderShell();
    this.bind();
  }
  get race() { return RACES[store.get().race] || RACES.tauren; }
  eligible(q) {
    const r = this.race;
    if (q.side !== 'B' && q.side !== r.faction) return false;
    if (q.races && !hasBit(q.races, r.bit)) return false;
    return true;
  }
  renderShell() {
    const chips = Object.entries(QUEST_CATS).map(([k, c]) =>
      `<button class="chip" data-cat="${k}" aria-pressed="true" title="${esc(c.desc)}"><i class="sw" style="background:${c.color}"></i>${esc(c.label)}</button>`).join('');
    this.root.innerHTML = `
    <div class="wrap qlayout">
      <section class="mapcol">
        <div class="mapbar">
          <select id="mapSel" aria-label="Map"></select>
          <button class="btn ghost" id="mapStart" title="Jump to your starting zone">Start zone</button>
        </div>
        <div id="map" role="region" aria-label="Quest map"></div>
        <div class="maplegend" style="margin-top:6px">${Object.values(QUEST_CATS).map(c => `<span><i class="mk" style="background:${c.color};width:12px;height:12px"></i>${esc(c.short)}</span>`).join('')}
          <span><i class="mk beast" style="background:#c58bff;width:11px;height:11px"></i>Beast spawn</span>
          <span><i class="mk fish" style="background:#2fd3a1;width:11px;height:11px"></i>Fishing</span>
          <label class="check small"><input type="checkbox" id="mFish" ${store.pref('fishLayer') ? 'checked' : ''}> Fishing layer</label>
          <label class="check small"><input type="checkbox" id="mFishV" ${store.pref('fishVendors') ? 'checked' : ''}> + pole vendors</label>
          <label class="check small"><input type="checkbox" id="mLayer-fish" data-layer="fish" ${store.pref('trLayer') ? 'checked' : ''}><i class="mk tr" style="background:#ffd24a;width:11px;height:11px"></i> Treasure (fishing)</label>
          <label class="check small"><input type="checkbox" id="mLayer-world" data-layer="world" ${store.pref('wtLayer') ? 'checked' : ''}><i class="mk tr" style="background:#ff6fb1;width:11px;height:11px"></i> World treasures</label>
          <span id="beastChip"></span></div>
      </section>
      <section class="listcol">
        <div class="card filters">
          <div class="row">${chips}</div>
          <input class="search" id="qSearch" type="search" placeholder="Search quests, givers, rewards…" aria-label="Search quests">
          <div class="fgrid">
            <label class="field">Zone<select id="qZone"><option value="all">All zones</option></select></label>
            <label class="field">Sort<select id="qSort">
              <option value="path">Leveling path</option><option value="level">Quest level</option>
              <option value="zone">Zone</option><option value="name">Name</option></select></label>
            <label class="field">Min level<input id="qMin" type="number" min="1" max="60" value="1" inputmode="numeric"></label>
            <label class="field">Max level<input id="qMax" type="number" min="1" max="60" value="60" inputmode="numeric"></label>
            <label class="field">Data<select id="qStatus"><option value="all">All sources</option>
              <option value="confirmed">Forever-confirmed only</option><option value="classic">Classic carry-over only</option></select></label>
          </div>
          <div class="row">
            <label class="check"><input type="checkbox" id="qMine" checked> Only my race/faction</label>
            <label class="check"><input type="checkbox" id="qHide"> Hide done</label>
          </div>
        </div>
        <div class="listhead"><span class="counter" id="qCount"></span><span class="small" id="qRace"></span></div>
        <div class="qlist" id="qList"></div>
      </section>
    </div>`;
  }
  bind() {
    const r = this.root;
    $$('.chip[data-cat]', r).forEach(b => b.onclick = () => {
      const k = b.dataset.cat; this.f.cats.has(k) ? this.f.cats.delete(k) : this.f.cats.add(k);
      b.setAttribute('aria-pressed', this.f.cats.has(k)); this.refresh();
    });
    $('#qSearch', r).oninput = debounce(e => { this.f.q = e.target.value.trim().toLowerCase(); this.refresh(); });
    $('#qZone', r).onchange = e => { this.f.zone = e.target.value; this.refresh();
      if (e.target.value !== 'all') { const ui = this.uiForArea(+e.target.value); if (ui) this.showMap(ui); } };
    $('#qSort', r).onchange = e => { this.f.sort = e.target.value; this.refresh(); };
    $('#qMin', r).onchange = e => { this.f.min = +e.target.value || 1; this.refresh(); };
    $('#qMax', r).onchange = e => { this.f.max = +e.target.value || 60; this.refresh(); };
    $('#qStatus', r).onchange = e => { this.f.status = e.target.value; this.refresh(); };
    $('#qMine', r).onchange = e => { this.f.mine = e.target.checked; this.refresh(); };
    $('#qHide', r).onchange = e => { this.f.hideDone = e.target.checked; this.refresh(); };
    $('#mapSel', r).onchange = e => this.showMap(+e.target.value);
    $('#mFish', r).onchange = e => { store.pref('fishLayer', e.target.checked); const f = document.getElementById('fLayer'); if (f) f.checked = e.target.checked; this.drawMarkers(); };
    $('#mFishV', r).onchange = e => { store.pref('fishVendors', e.target.checked); if (e.target.checked) { store.pref('fishLayer', true); $('#mFish', r).checked = true; } this.drawMarkers(); };
    $('#mapStart', r).onclick = () => this.showMap(this.race.start.uiMapId);
    $('#qList', r).addEventListener('change', e => {
      const cb = e.target.closest('input[data-done]');
      if (cb) { store.toggleDone(cb.dataset.done, cb.checked); cb.closest('.q').classList.toggle('done', cb.checked); this.drawMarkers(); this.count(); }
    });
    $('#qList', r).addEventListener('click', e => {
      const more = e.target.closest('.more'); if (more) { this.limit += PAGE; this.renderList(); return; }
      const pin = e.target.closest('[data-pin]'); if (pin) this.focus(+pin.dataset.pin);
    });
  }
  uiForArea(a) { const z = this.data.zones.zones.find(z => z.areaId === a); return z && z.uiMapId; }
  populateSelectors() {
    // map selector: continents + zones that have an image, grouped
    const zs = this.data.zones;
    const opts = [`<optgroup label="Continents">${zs.continents.map(c => `<option value="${c.uiMapId}">${esc(c.name)} (overview)</option>`).join('')}</optgroup>`];
    const zoneOpts = zs.zones.filter(z => z.image).sort((a, b) => a.name.localeCompare(b.name))
      .map(z => `<option value="${z.uiMapId}">${esc(z.name)}</option>`).join('');
    opts.push(`<optgroup label="Zones">${zoneOpts}</optgroup>`);
    $('#mapSel', this.root).innerHTML = opts.join('');
    const areas = new Map();
    for (const q of this.data.quests) if (q.zoneArea && q.zone) areas.set(q.zoneArea, q.zone);
    $('#qZone', this.root).innerHTML = '<option value="all">All zones</option>' +
      [...areas].sort((a, b) => a[1].localeCompare(b[1])).map(([a, n]) => `<option value="${a}">${esc(n)}</option>`).join('');
  }
  start() {
    this.populateSelectors();
    this.showMap(store.pref('map') || this.race.start.uiMapId);
    this.refresh();
  }
  onRaceChange() { this.limit = PAGE; this.showMap(this.race.start.uiMapId); this.refresh(); }
  showMap(ui) {
    if (!this.mv.byUi.has(ui) && !this.mv.cont.has(ui)) ui = this.race.start.uiMapId;
    this.mv.show(ui); store.pref('map', ui);
    $('#mapSel', this.root).value = String(ui);
    this.drawMarkers();
  }
  filtered() {
    const f = this.f, out = [];
    for (const q of this.data.quests) {
      if (!q.cats.some(c => f.cats.has(c))) continue;
      if (f.mine && !this.eligible(q)) continue;
      if (q.lvl < f.min || q.lvl > f.max) continue;
      if (f.zone !== 'all' && String(q.zoneArea) !== f.zone) continue;
      if (f.hideDone && store.isDone(q.id)) continue;
      if (f.status === 'confirmed' && !STATUS[q.status].confirmed) continue;
      if (f.status === 'classic' && STATUS[q.status].confirmed) continue;
      if (f.q) {
        const hay = (q.name + ' ' + (q.zone || '') + ' ' + (q.giver?.name || '') + ' ' + q.rewards.map(r => r.name).join(' ')).toLowerCase();
        if (!hay.includes(f.q)) continue;
      }
      out.push(q);
    }
    const flow = ZONE_FLOW[this.race.faction];
    const startArea = this.race.start.areaId;
    const zi = a => a === startArea ? -1 : (flow.indexOf(a) < 0 ? 99 : flow.indexOf(a));
    const cmp = {
      path: (a, b) => a.lvl - b.lvl || zi(a.zoneArea) - zi(b.zoneArea) || a.req - b.req || a.name.localeCompare(b.name),
      level: (a, b) => a.lvl - b.lvl || a.req - b.req || a.name.localeCompare(b.name),
      zone: (a, b) => (a.zone || '~').localeCompare(b.zone || '~') || a.lvl - b.lvl,
      name: (a, b) => a.name.localeCompare(b.name),
    }[f.sort];
    return out.sort(cmp);
  }
  bestRanged(list) {
    // "Best" per 10-level bracket among eligible quests: highest ranged DPS weapon, best ammo DPS, biggest quiver.
    const best = new Map();
    for (const q of list) for (const r of q.rewards) {
      const s = r.stats || {}; let kind, score;
      if (RANGED.has(r.type) && s.rgddps) { kind = 'weapon'; score = s.rgddps; }
      else if (r.type === 'Projectile' && s.dps) { kind = 'ammo'; score = s.dps; }
      else if (r.type === 'Quiver/Ammo Pouch') { kind = 'quiver'; score = (s.nslots || 0) + (r.ilvl || 0) / 100; }
      else continue;
      const key = kind + ':' + Math.floor(Math.max(0, (r.req || q.req || 1) - 1) / 10);
      const cur = best.get(key);
      if (!cur || score > cur.score) best.set(key, { score, id: r.id, q: q.id });
    }
    this.best = new Set([...best.values()].map(b => b.q + ':' + b.id));
  }
  refresh() {
    this.list = this.filtered();
    this.bestRanged(this.data.quests.filter(q => this.eligible(q)));
    this.limit = Math.max(PAGE, Math.min(this.limit, this.list.length));
    this.renderList(); this.drawMarkers(); this.count();
    $('#qRace', this.root).textContent = `${this.race.name} · starts in ${this.race.start.zone}`;
  }
  count() {
    const done = this.list.filter(q => store.isDone(q.id)).length;
    $('#qCount', this.root).innerHTML = `<b>${this.list.length}</b> quests · <b>${done}</b> done`;
  }
  questHTML(q) {
    const g = q.giver || {};
    const cat = q.cats.map(c => `<span class="badge cat-${c}">${esc(QUEST_CATS[c].short)}</span>`).join(' ');
    const st = STATUS[q.status];
    const side = q.side === 'B' ? '<span class="badge B">Both</span>' : `<span class="badge ${q.side}">${q.side === 'H' ? 'Horde' : 'Alliance'}</span>`;
    const giver = g.name ? `${esc(g.name)}${g.kind === 'item' ? ' (item)' : ''}${g.x != null ? ` · ${esc(g.zone || '')} <span class="lvl" style="font-weight:600">${coord(g.x, g.y)}</span>` : ''}` : '<span class="small">unknown</span>';
    const rew = q.rewards.filter(r => r.hunter).map(r => `<div class="reward"><a class="q-${r.q}" href="${GAME.wowhead}/item=${r.id}" target="_blank" rel="noopener">${esc(r.name)}</a>
      <span class="small">${esc(r.type)}${r.req ? ` · req ${r.req}` : ''}${r.choice ? ' · choice' : ''}${r.type === 'Mail' && (r.req || 0) < 40 ? ' · Hunters wear Mail from 40 in Classic' : ''}</span>
      ${this.best.has(q.id + ':' + r.id) ? '<span class="badge best">Best in bracket</span>' : ''}
      <div class="stats">${statLine(r)}</div></div>`).join('');
    const other = q.rewards.filter(r => !r.hunter).map(r => esc(r.name)).join(', ');
    const color = QUEST_CATS[q.cats.includes('ranged') ? 'ranged' : q.cats.includes('class') ? 'class' : 'gear'].color;
    return `<article class="card q${store.isDone(q.id) ? ' done' : ''}${this.sel === q.id ? ' sel' : ''}" data-id="${q.id}" style="border-left-color:${color}">
      <label class="check" title="Mark done"><input type="checkbox" data-done="${q.id}" ${store.isDone(q.id) ? 'checked' : ''}><span class="sr">Done</span></label>
      <div>
        <h3>${esc(q.name)}</h3>
        <div class="meta"><span class="lvl">${q.req && q.req !== q.lvl ? `${q.req}–${q.lvl}` : q.lvl}</span> · ${esc(q.zone || 'Unknown zone')} · ${side} ${cat}</div>
        <div class="meta">Giver: ${giver}${q.ender && q.ender.name !== g.name ? ` · Turn in: ${esc(q.ender.name)}` : ''}</div>
        ${rew ? `<div class="rew">${rew}</div>` : ''}
        ${other ? `<div class="small" style="margin-top:3px">Other rewards: ${other}</div>` : ''}
        <div class="links"><a href="${GAME.wowhead}/quest=${q.id}" target="_blank" rel="noopener">Wowhead Forever ↗</a>
          ${g.x != null ? `<button class="btn ghost" style="padding:3px 9px" data-pin="${q.id}">Show on map</button>` : ''}
          <span class="st ${st.cls}" title="${esc(q.src.join(' + '))}">${esc(st.label)}</span></div>
      </div></article>`;
  }
  renderList() {
    const el = $('#qList', this.root);
    if (!this.list.length) { el.innerHTML = '<div class="empty card">No quests match these filters.</div>'; return; }
    el.innerHTML = this.list.slice(0, this.limit).map(q => this.questHTML(q)).join('') +
      (this.list.length > this.limit ? `<button class="btn ghost more">Show ${Math.min(PAGE, this.list.length - this.limit)} more (${this.list.length - this.limit} left)</button>` : '');
  }
  drawMarkers() {
    this.mv.clear();
    const cont = this.mv.isContinent(this.mv.current);
    for (const q of this.list || []) {
      const g = q.giver; if (!g || g.x == null) continue;
      const ll = this.mv.project(g.ui, g.x, g.y); if (!ll) continue;
      const c = q.cats.includes('ranged') && this.f.cats.has('ranged') ? 'ranged' : q.cats.includes('class') && this.f.cats.has('class') ? 'class' : 'gear';
      const done = store.isDone(q.id);
      this.mv.marker(ll, { color: QUEST_CATS[c].color, cls: done ? 'done' : '', title: q.name,
        popup: `<b>${esc(q.name)}</b><br><span class="lvl">${q.lvl}</span> · ${esc(g.name)} (${coord(g.x, g.y)})<br>
          ${q.rewards.filter(r => r.hunter).map(r => `${esc(r.name)} <span class="small">${statLine(r)}</span>`).join('<br>')}
          <br><a href="${GAME.wowhead}/quest=${q.id}" target="_blank" rel="noopener">Wowhead ↗</a>`,
        onClick: () => this.select(q.id) });
    }
    this.drawBeast();
    this.app.fishing?.drawLayer(this.mv);
    if (cont) this.mv.labels.eachLayer(l => l.bringToFront && l.bringToFront());
  }
  select(id) {
    this.sel = id;
    $$('.q.sel', this.root).forEach(e => e.classList.remove('sel'));
    let el = $(`.q[data-id="${id}"]`, this.root);
    if (!el) { const i = this.list.findIndex(q => q.id === id); if (i >= 0) { this.limit = i + 10; this.renderList(); el = $(`.q[data-id="${id}"]`, this.root); } }
    if (el) { el.classList.add('sel'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  focus(id) {
    const q = this.data.quests.find(q => q.id === id); if (!q || !q.giver || q.giver.ui == null) return;
    if (!this.mv.byUi.get(q.giver.ui)?.image) return;
    this.showMap(q.giver.ui);
    const ll = this.mv.project(q.giver.ui, q.giver.x, q.giver.y);
    this.mv.map.setView(ll, 1);
    this.mv.layer.eachLayer(m => { if (m.getLatLng && m.getLatLng().equals(L.latLng(ll))) m.openPopup(); });
    this.sel = id; this.select(id);
    document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // beast overlay (set from the Pokédex)
  setBeast(b) {
    this.beast = b;
    const chip = $('#beastChip', this.root);
    chip.innerHTML = b ? `<button class="chip" id="clearBeast">Showing ${esc(b.name)} ✕</button>` : '';
    if (b) $('#clearBeast', this.root).onclick = () => { this.setBeast(null); this.drawMarkers(); };
    const z = b && b.zones.find(z => z.ui && this.mv.byUi.get(z.ui)?.image);
    if (z) this.showMap(z.ui); else this.drawMarkers();
  }
  drawBeast() {
    const b = this.beast; if (!b) return;
    for (const z of b.zones) for (const [x, y, n] of z.pts) {
      const ll = this.mv.project(z.ui, x, y); if (!ll) continue;
      this.mv.marker(ll, { color: '#c58bff', cls: 'beast', title: b.name,
        popup: `<b>${esc(b.name)}</b> (${b.min ?? '?'}–${b.max ?? '?'})<br>${esc(z.zone || '')} ${coord(x, y)} · ${n} spawn point${n > 1 ? 's' : ''}` });
    }
  }
}
