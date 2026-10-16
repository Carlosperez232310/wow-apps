// Map tab: Midnight zone quests whose rewards are Druid (agility leather / weapon / accessory) upgrades, on schematic zone maps.
import { QUEST_CATS, SIDE, GAME } from './config.js';
import { store } from './store.js';
import { $, $$, esc, debounce, coord } from './util.js';

const Q = ['#9d9d9d', '#ffffff', '#1eff00', '#0070dd', '#a335ee', '#ff8000'];
export const qcol = q => Q[q] || '#fff';

export class QuestMap {
  constructor(root, data, mv, app) {
    this.root = root; this.D = data; this.mv = mv; this.app = app;
    this.zones = data.zones.zones;
    this.f = { zone: store.pref('qZone') ?? 'all', cats: new Set(store.pref('qCats') || Object.keys(QUEST_CATS)), q: '', hideDone: !!store.pref('qHideDone'), ally: store.pref('qAlly') ?? true };
    this.render();
  }
  render() {
    const z = this.zones.map(z => `<option value="${z.uiMapId}">${esc(z.name)} (${z.levels ? z.levels.join('–') : '?'})</option>`).join('');
    this.root.innerHTML = `<div class="wrap qlayout">
      <div class="mapcol">
        <div class="mapbar"><select id="qZoneMap" aria-label="Map zone">${z}</select></div>
        <div id="map"></div>
        <div class="maplegend">${Object.entries(QUEST_CATS).map(([k, c]) => `<span><i class="mk" style="background:${c.color}"></i>${c.short}</span>`).join('')}
          <span><i class="mk fish" style="background:#2ad1c9"></i>Fishing</span>
          <label class="check small"><input type="checkbox" id="mFish" ${store.pref('fishLayer') ? 'checked' : ''}> Fishing layer</label></div>
        <p class="small">Schematic grid map (0–100 in-game coordinates); not Blizzard map art. Pins = quest givers from Wowhead's quest mapper.</p>
      </div>
      <div class="listcol">
        <div class="card pad">
          <div class="row between"><h2>Druid gear quests</h2><span class="small" id="qCount"></span></div>
          <div class="row" id="qCats">${Object.entries(QUEST_CATS).map(([k, c]) => `<button class="chip" data-cat="${k}" aria-pressed="${this.f.cats.has(k)}"><i class="sw" style="background:${c.color}"></i>${c.label}</button>`).join('')}</div>
          <input class="search" id="qSearch" placeholder="Search quests, items, givers…" aria-label="Search">
          <div class="row">
            <label class="field">Zone<select id="qZone"><option value="all">All Midnight zones</option>${z}</select></label>
            <label class="check small"><input type="checkbox" id="qAlly" ${this.f.ally ? 'checked' : ''}> Alliance + neutral only</label>
            <label class="check small"><input type="checkbox" id="qHide" ${this.f.hideDone ? 'checked' : ''}> Hide done</label>
          </div>
          <p class="small">Quests in Wowhead's zone lists whose reward (or reward choice) is agility leather, an agility weapon a Druid can use (staff, polearm, mace, dagger, fist) or a neck/ring/trinket/cloak. Leveling rewards (80–90); at max level gear comes from Delves, dungeons and raids.</p>
        </div>
        <div id="qList" class="qlist"></div>
      </div></div>`;
    $('#qZone', this.root).value = this.f.zone;
    $('#qZoneMap', this.root).value = this.f.zone === 'all' ? this.zones[0].uiMapId : this.f.zone;
    $('#qZone', this.root).onchange = e => { this.f.zone = e.target.value; store.pref('qZone', this.f.zone); if (this.f.zone !== 'all') this.showMap(+this.f.zone); this.list(); };
    $('#qZoneMap', this.root).onchange = e => this.showMap(+e.target.value);
    $$('#qCats .chip', this.root).forEach(b => b.onclick = () => {
      const k = b.dataset.cat; this.f.cats.has(k) ? this.f.cats.delete(k) : this.f.cats.add(k);
      b.setAttribute('aria-pressed', this.f.cats.has(k)); store.pref('qCats', [...this.f.cats]); this.list(); this.drawMarkers();
    });
    $('#qSearch', this.root).oninput = debounce(e => { this.f.q = e.target.value.trim().toLowerCase(); this.list(); });
    $('#qAlly', this.root).onchange = e => { this.f.ally = e.target.checked; store.pref('qAlly', this.f.ally); this.list(); this.drawMarkers(); };
    $('#qHide', this.root).onchange = e => { this.f.hideDone = e.target.checked; store.pref('qHideDone', this.f.hideDone); this.list(); this.drawMarkers(); };
    $('#mFish', this.root).onchange = e => { store.pref('fishLayer', e.target.checked); this.drawMarkers(); };
    this.root.addEventListener('change', e => {
      const t = e.target.closest('[data-done]'); if (!t) return;
      store.toggle('done', t.dataset.done, t.checked); t.closest('.qcard')?.classList.toggle('isdone', t.checked); this.count(); this.drawMarkers();
    });
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-qmap]'); if (!b) return;
      const q = this.D.quests.find(x => x.id === +b.dataset.qmap); if (q) this.focus(q);
    });
  }
  start() { this.showMap(this.f.zone === 'all' ? this.zones[0].uiMapId : +this.f.zone); this.list(); }
  catsOf(q) { return [...new Set(q.items.map(i => i.kind))]; }
  visible() {
    const f = this.f;
    return this.D.quests.filter(q => (f.zone === 'all' || q.areaId === +f.zone) && this.catsOf(q).some(c => f.cats.has(c))
      && (!f.ally || q.side !== 2) && (!f.hideDone || !store.has('done', q.id))
      && (!f.q || (q.name + ' ' + q.zone + ' ' + (q.start?.name || '') + ' ' + q.items.map(i => i.name).join(' ')).toLowerCase().includes(f.q)))
      .sort((a, b) => (a.reqlevel - b.reqlevel) || (a.areaId - b.areaId) || a.name.localeCompare(b.name));
  }
  count() {
    const all = this.D.quests.filter(q => !this.f.ally || q.side !== 2);
    $('#qCount', this.root).innerHTML = `Done <b>${all.filter(q => store.has('done', q.id)).length}</b> / ${all.length} · showing ${this.vis.length}`;
  }
  card(q) {
    const s = SIDE[q.side] || SIDE[3];
    const items = q.items.map(i => `<li><a href="${i.url}" target="_blank" rel="noopener" style="color:${qcol(i.quality)}">${esc(i.name)}</a>
      <span class="small">${esc([i.slot, i.weapon, i.kind === 'leather' ? 'Leather' : null, i.reqlevel ? 'req ' + i.reqlevel : null].filter(Boolean).join(' · '))}${i.choice ? ' · choice' : ''}</span>
      ${i.stats ? `<span class="small dimmed">${esc(Object.entries(i.stats).map(([k, v]) => `${v} ${k}`).join(', '))}</span>` : ''}</li>`).join('');
    const st = q.start ? `${esc(q.start.name || '')} · ${esc(q.start.zone || '')} <b>${coord(q.start.x, q.start.y)}</b>` : '<span class="small">no giver coordinates on Wowhead</span>';
    return `<article class="card qcard ${store.has('done', q.id) ? 'isdone' : ''}" style="border-left:4px solid ${QUEST_CATS[this.catsOf(q)[0]].color}">
      <label class="check big"><input type="checkbox" data-done="${q.id}" ${store.has('done', q.id) ? 'checked' : ''} aria-label="Done: ${esc(q.name)}"></label>
      <div class="body"><h3>${esc(q.name)}</h3>
        <div class="small">${q.reqlevel ?? '?'}${q.level && q.level !== q.reqlevel ? '–' + q.level : ''} · ${esc(q.zone)} <span class="badge ${s[0]}">${s[1]}</span>
          ${q.campaign ? '<span class="badge elite">Campaign</span>' : ''} ${this.catsOf(q).map(c => `<span class="badge" style="border-color:${QUEST_CATS[c].color}">${QUEST_CATS[c].short}</span>`).join(' ')}</div>
        <div class="small">Giver: ${st}</div>
        <ul class="rewards">${items}</ul>
        <div class="row"><a href="${q.url}" target="_blank" rel="noopener">Wowhead ↗</a>${q.start && this.mv.byUi.has(q.start.areaId) ? `<button class="btn ghost sm" data-qmap="${q.id}">Show on map</button>` : ''}
          <span class="tag">Wowhead${q.patch ? ' · added ' + esc(q.patch) : ''}</span></div></div></article>`;
  }
  list() {
    this.vis = this.visible();
    const el = $('#qList', this.root);
    el.innerHTML = this.vis.length ? this.vis.map(q => this.card(q)).join('') : '<div class="empty">No quests match these filters.</div>';
    this.count();
    this.drawMarkers();
  }
  showMap(id) {
    this.mv.show(id); $('#qZoneMap', this.root).value = id; this.drawMarkers(); this.mv.invalidate();
  }
  focus(q) {
    this.showMap(q.start.areaId);
    const ll = this.mv.project(q.start.areaId, q.start.x, q.start.y);
    if (ll) this.mv.map.setView(ll, 1);
    const m = this.markers?.get(q.id); if (m) m.openPopup();
    $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  drawMarkers() {
    if (!this.vis) return;
    this.mv.clear(); this.markers = new Map();
    const cur = this.mv.current;
    for (const q of this.D.quests) {
      if (!q.start || q.start.areaId !== cur) continue;
      if (!this.catsOf(q).some(c => this.f.cats.has(c)) || (this.f.ally && q.side === 2) || (this.f.hideDone && store.has('done', q.id))) continue;
      const c = QUEST_CATS[this.catsOf(q)[0]];
      const m = this.mv.marker(this.mv.project(cur, q.start.x, q.start.y), {
        color: c.color, cls: store.has('done', q.id) ? 'done' : '', title: q.name,
        popup: `<b>${esc(q.name)}</b><br>${esc(q.start.name || '')} ${coord(q.start.x, q.start.y)}<br>${q.items.map(i => `<span style="color:${qcol(i.quality)}">${esc(i.name)}</span>`).join('<br>')}<br><a href="${q.url}" target="_blank" rel="noopener">Wowhead ↗</a>` });
      this.markers.set(q.id, m);
    }
    if (store.pref('fishLayer')) this.app.fishing?.drawLayer(this.mv);
  }
}
