// Fishing tab: zone waters + pools by skill/level, fish & pet food, poles/lures, trainers, quests, Forever changes.
// Also draws the optional "Fishing" layer on the shared quest map (see QuestView.drawMarkers).
import { GAME, STATUS } from './config.js';
import { store } from './store.js';
import { $, $$, esc, debounce, coord } from './util.js';

const KIND = {
  zone: { label: 'Zone waters', color: '#3fb6c6' },
  pool: { label: 'Fishing pools', color: '#2fd3a1' },
  'quest-fish': { label: 'Quest fish areas', color: '#e0b44c' },
  'guide-spot': { label: 'Guide spots', color: '#c58bff' },
};
const PAGE = 40;
const Q = ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'];
const money = c => c == null ? '' : [[Math.floor(c / 10000), 'g'], [Math.floor(c / 100) % 100, 's'], [c % 100, 'c']].filter(([v]) => v).map(([v, u]) => v + u).join(' ') || '0c';
const stTag = (status, src) => { const s = STATUS[status] || STATUS['forever-listed']; return `<span class="st ${s.cls}" title="${esc((src || []).join(' + '))}">${esc(s.label)}</span>`; };
const srcLinks = src => (src || []).map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener">${i ? 'src' + (i + 1) : 'source'} ↗</a>`).join(' ');

export class FishingView {
  constructor(root, data, app) {
    Object.assign(this, { root, data: data.fishing, app });
    this.fish = new Map(this.data.fish.map(f => [f.id, f]));
    this.zoneByArea = new Map(this.data.zones.map(z => [z.areaId, z]));
    this.f = { q: '', kinds: new Set(Object.keys(KIND)), mine: true, hide: false, sort: 'skill', sub: 'spots' };
    this.skill = +(store.pref('fishSkill') ?? 1);
    this.limit = PAGE;
    this.renderShell(); this.bind();
  }
  get side() { return this.app.race().faction; }
  /** zone waters + point spots as one list */
  entries() {
    const zs = this.data.zones.map(z => ({ ...z, kind: 'zone', zone: z.name, pts: [], fish: z.catches.map(c => c.id) }));
    const sp = this.data.spots.map(s => ({ ...s, side: this.zoneByArea.get(s.areaId)?.side || 'B', levels: this.zoneByArea.get(s.areaId)?.levels }));
    return zs.concat(sp);
  }
  renderShell() {
    const chips = Object.entries(KIND).map(([k, c]) => `<button class="chip" data-kind="${k}" aria-pressed="true"><i class="sw" style="background:${c.color}"></i>${c.label}</button>`).join('');
    const subs = [['spots', 'Spots'], ['fish', 'Fish & pet food'], ['gear', 'Poles & lures'], ['people', 'Trainers & quests'], ['changes', 'Forever changes']];
    this.root.innerHTML = `<div class="wrap">
      <div class="card dexhead">
        <div class="row" style="justify-content:space-between"><h2 class="serif" style="margin:0;color:var(--gold2)">Fishing</h2>
          <span class="counter" id="fCount"></span></div>
        <div class="progress" aria-hidden="true"><i id="fBar" style="width:0"></i></div>
        <div class="seg" role="tablist">${subs.map(([k, l]) => `<button data-sub="${k}" aria-pressed="${k === 'spots'}">${l}</button>`).join('')}</div>
        <div id="fFilters" class="filters" style="padding:0">
          <div class="row">${chips}</div>
          <input class="search" id="fSearch" type="search" placeholder="Search zones, fish, pools…" aria-label="Search fishing spots">
          <div class="fgrid">
            <label class="field">My Fishing skill<input id="fSkill" type="number" min="1" max="425" value="${this.skill}" inputmode="numeric"></label>
            <label class="field">Sort<select id="fSort"><option value="skill">Required skill</option><option value="best">Best for my skill</option>
              <option value="level">Zone level</option><option value="name">Name</option></select></label>
          </div>
          <div class="row"><label class="check"><input type="checkbox" id="fMine" checked> My faction + contested</label>
            <label class="check"><input type="checkbox" id="fHide"> Hide fished</label>
            <label class="check"><input type="checkbox" id="fLayer" ${store.pref('fishLayer') ? 'checked' : ''}> Show on quest map</label></div>
        </div>
      </div>
      <div id="fBody" style="margin-top:10px"></div></div>`;
  }
  bind() {
    const r = this.root;
    $$('.chip[data-kind]', r).forEach(b => b.onclick = () => {
      const k = b.dataset.kind; this.f.kinds.has(k) ? this.f.kinds.delete(k) : this.f.kinds.add(k);
      b.setAttribute('aria-pressed', this.f.kinds.has(k)); this.limit = PAGE; this.refresh();
    });
    $$('.seg button', r).forEach(b => b.onclick = () => {
      this.f.sub = b.dataset.sub; $$('.seg button', r).forEach(x => x.setAttribute('aria-pressed', x === b));
      $('#fFilters', r).style.display = this.f.sub === 'spots' ? '' : 'none'; this.refresh();
    });
    $('#fSearch', r).oninput = debounce(e => { this.f.q = e.target.value.trim().toLowerCase(); this.limit = PAGE; this.refresh(); });
    $('#fSkill', r).onchange = e => { this.skill = Math.max(1, +e.target.value || 1); store.pref('fishSkill', this.skill); this.refresh(); };
    $('#fSort', r).onchange = e => { this.f.sort = e.target.value; this.refresh(); };
    $('#fMine', r).onchange = e => { this.f.mine = e.target.checked; this.refresh(); };
    $('#fHide', r).onchange = e => { this.f.hide = e.target.checked; this.refresh(); };
    $('#fLayer', r).onchange = e => { store.pref('fishLayer', e.target.checked); this.app.quests.drawMarkers(); };
    $('#fBody', r).addEventListener('change', e => {
      const cb = e.target.closest('input[data-fished]'); if (!cb) return;
      store.toggleFished(cb.dataset.fished, cb.checked); cb.closest('.bcard').classList.toggle('caught', cb.checked); this.count();
    });
    $('#fBody', r).addEventListener('click', e => {
      if (e.target.closest('.more')) { this.limit += PAGE; this.refresh(); return; }
      const m = e.target.closest('[data-fmap]'); if (m) this.app.showFishingOnMap(m.dataset.fmap);
    });
  }
  onRaceChange() { this.refresh(); }
  skillState(e) {
    if (e.skillMin == null) return { cls: '', txt: 'skill unknown' };
    if (this.skill >= (e.skillFull ?? 999)) return { cls: 'ok', txt: 'every cast catches' };
    if (this.skill >= e.skillMin) return { cls: 'mid', txt: 'some fish get away' };
    return { cls: 'low', txt: `needs ${e.skillMin}` };
  }
  filtered() {
    const f = this.f, side = this.side;
    const out = this.entries().filter(e => {
      if (!f.kinds.has(e.kind)) return false;
      if (f.mine && e.side !== 'B' && e.side !== side) return false;
      if (f.hide && store.isFished(e.id)) return false;
      if (f.q) {
        const hay = [e.name, e.zone, ...(e.fish || []).map(id => this.fish.get(id)?.name || ''), ...(e.byCatch || [])].join(' ').toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
    const start = this.app.race().start.areaId;
    const sk = e => (e.skillMin ?? 999) - (e.areaId === start ? 0.5 : 0), lv = e => (e.levels || [99])[0];
    const best = e => { const s = this.skillState(e); return s.cls === 'mid' ? 0 : s.cls === 'ok' ? 1 : s.cls === 'low' ? 3 : 2; };
    const cmp = {
      skill: (a, b) => sk(a) - sk(b) || lv(a) - lv(b) || a.name.localeCompare(b.name),
      best: (a, b) => best(a) - best(b) || (b.skillMin ?? -1) - (a.skillMin ?? -1) || lv(a) - lv(b),
      level: (a, b) => lv(a) - lv(b) || sk(a) - sk(b),
      name: (a, b) => a.name.localeCompare(b.name),
    }[f.sort];
    return out.sort(cmp);
  }
  refresh() {
    const body = $('#fBody', this.root);
    const sub = this.f.sub;
    if (sub === 'spots') { this.list = this.filtered(); body.innerHTML = `<div class="dex">${this.list.slice(0, this.limit).map(e => this.entryHTML(e)).join('')}</div>` +
      (this.list.length > this.limit ? `<button class="btn ghost more">Show more (${this.list.length - this.limit} left)</button>` : '') +
      (this.list.length ? '' : '<div class="empty card">No fishing spots match these filters.</div>'); }
    else if (sub === 'fish') body.innerHTML = this.fishHTML();
    else if (sub === 'gear') body.innerHTML = this.gearHTML();
    else if (sub === 'people') body.innerHTML = this.peopleHTML();
    else body.innerHTML = this.changesHTML();
    this.count();
  }
  count() {
    const all = this.entries(), n = all.filter(e => store.isFished(e.id)).length;
    $('#fCount', this.root).innerHTML = `Fished <b>${n}</b> / ${all.length} spots` + (this.f.sub === 'spots' && this.list ? ` · showing ${this.list.length}` : '');
    $('#fBar', this.root).style.width = (100 * n / Math.max(1, all.length)).toFixed(1) + '%';
  }
  fishChip(id, pct) {
    const f = this.fish.get(id); if (!f) return '';
    const pet = f.pet ? ' <span title="Hunter pet food (Fish diet)">🐾</span>' : '';
    return `<span class="${f.pet ? 'uniq' : ''}" title="${esc(f.recipes.map(r => r.name).join(', '))}">${esc(f.name)}${pct != null ? ` <b>${pct}%</b>` : ''}${pet}</span>`;
  }
  entryHTML(e) {
    const k = KIND[e.kind], s = this.skillState(e), done = store.isFished(e.id);
    const catches = e.kind === 'zone'
      ? e.catches.filter(c => c.pct >= 0.1).map(c => this.fishChip(c.id, c.pct)).join('')
      : (e.fish || []).map(id => this.fishChip(id)).join('');
    const pts = (e.pts || []).slice(0, 6).map(([x, y, n]) => coord(x, y) + (n > 1 ? ` (${n})` : '')).join(' · ');
    const pools = e.kind === 'zone' ? this.data.spots.filter(p => p.areaId === e.areaId && p.kind === 'pool').map(p => p.name) : [];
    const canMap = e.ui && (e.pts?.length || e.kind === 'zone');
    return `<article class="card bcard fspot ${done ? 'caught' : ''}" style="border-top-color:${k.color}" data-id="${esc(e.id)}">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><h3>${esc(e.name)}</h3><div class="small">${esc(k.label)} · ${esc(e.zone || '')}${e.levels ? ` · zone lvl ${e.levels[0]}–${e.levels[1]}` : ''}
          <span class="badge ${e.side}">${e.side === 'B' ? 'Contested' : e.side === 'H' ? 'Horde' : 'Alliance'}</span></div></div>
        <label class="check"><input type="checkbox" data-fished="${esc(e.id)}" ${done ? 'checked' : ''}> Fished here</label></div>
      <dl class="kv">
        <dt>Skill</dt><dd>${e.skillMin != null ? `<b>${e.skillMin}</b> to fish · <b>${e.skillFull}</b> for no get-aways` : '<span class="small">not listed for this zone</span>'}
          <span class="sk ${s.cls}">${esc(s.txt)}</span>${(e.skillNotes || []).length ? `<div class="small">${esc(e.skillNotes.join('; '))}</div>` : ''}</dd>
        ${pts ? `<dt>Coords</dt><dd>${pts}</dd>` : ''}
        ${catches ? `<dt>${e.kind === 'zone' ? 'Catches' : 'Fish'}</dt><dd class="abil">${catches}</dd>` : ''}
        ${e.kind === 'zone' && e.sample ? `<dt></dt><dd class="small">% of ${e.sample.toLocaleString()} recorded casts in this zone (Wowhead)</dd>` : ''}
        ${pools.length ? `<dt>Pools</dt><dd>${esc([...new Set(pools)].join(', '))}</dd>` : ''}
        ${e.byCatch?.length ? `<dt>By-catch</dt><dd class="small">${esc(e.byCatch.slice(0, 5).join(', '))}</dd>` : ''}
        ${e.note ? `<dt>Note</dt><dd class="small">${esc(e.note)}</dd>` : ''}
      </dl>
      <div class="links">${canMap ? `<button class="btn ghost" style="padding:3px 9px" data-fmap="${esc(e.id)}">Show on map</button>` : ''}
        ${stTag(e.status, e.src)} ${srcLinks(e.src)}</div></article>`;
  }
  fishHTML() {
    const q = this.f.q;
    const rows = this.data.fish.filter(f => !q || f.name.toLowerCase().includes(q));
    return `<div class="card" style="padding:12px"><p class="small">Fish marked 🐾 are Hunter pet food (Fish diet): ${esc(this.data.fishEaters.join(', '))} eat them. Percentages are the share of Wowhead-recorded catches in that zone.</p></div>
      <div class="dex" style="margin-top:10px">${rows.map(f => `<article class="card bcard"><h3 class="q-${Q[f.q ?? 1] || 'common'}">${esc(f.name)} ${f.pet ? '🐾' : ''}</h3>
        <dl class="kv">
          ${f.pet ? `<dt>Pet food</dt><dd>Fish diet · item level/req ${f.pet.level ?? '?'}</dd>` : ''}
          ${f.recipes.length ? `<dt>Used for</dt><dd>${f.recipes.map(r => `${esc(r.name)} <span class="small">(${esc(r.skill)}${r.at ? ' ' + r.at : ''})</span>`).join(', ')}</dd>` : ''}
          ${f.sell ? `<dt>Vendor</dt><dd>${money(f.sell)}</dd>` : ''}
          ${f.use.length ? `<dt>Effect</dt><dd class="small">${esc(f.use.join(' '))}</dd>` : ''}
          ${f.best.length ? `<dt>Best zones</dt><dd>${f.best.slice(0, 5).map(b => `${esc(b.zone)} <b>${b.pct}%</b>`).join(' · ')}</dd>` : ''}
          ${f.classic ? `<dt>Classic guide</dt><dd class="small">${esc([f.classic.type, f.classic.min && 'min ' + f.classic.min, f.classic.avoid && 'no get-aways ' + f.classic.avoid, f.classic.best, f.classic.special].filter(Boolean).join(' · '))}</dd>` : ''}
        </dl><div class="links">${stTag(f.status, f.src)} ${srcLinks(f.src)}</div></article>`).join('')}</div>`;
  }
  gearHTML() {
    const kinds = { pole: 'Fishing poles', lure: 'Lures', food: 'Fishing-boost food', equipment: 'Equipment', camp: 'Camp objects (new in Forever)', prize: 'Books & tournament prizes' };
    const place = p => `${esc(p.name)}${p.zone ? ` <span class="small">(${esc(p.zone)}${p.x != null ? ' ' + coord(p.x, p.y) : ''})</span>` : ''}${p.pct ? ` <b>${p.pct}%</b>` : ''}`;
    return Object.entries(kinds).map(([k, label]) => {
      const rows = this.data.gear.filter(g => g.kind === k); if (!rows.length) return '';
      return `<h3 class="serif" style="color:var(--gold2);margin:14px 2px 6px">${label}</h3><div class="dex">${rows.map(g => {
        const bonus = g.bonusGuide != null || g.bonusTooltip != null
          ? (g.bonusGuide != null && g.bonusTooltip != null && g.bonusGuide !== g.bonusTooltip
            ? `<b>+${g.bonusGuide}</b> per guide · <b>+${g.bonusTooltip}</b> in beta tooltip <span class="small">(sources disagree)</span>`
            : `<b>+${g.bonusGuide ?? g.bonusTooltip}</b>`) : '';
        const src = [g.soldBy.length && `Sold by: ${g.soldBy.slice(0, 4).map(place).join('; ')}${g.soldBy.length > 4 ? ` +${g.soldBy.length - 4} more` : ''}`,
          g.droppedBy.length && `Drops from: ${g.droppedBy.slice(0, 3).map(place).join('; ')}`,
          g.rewardFrom.length && `Quest: ${g.rewardFrom.map(q => `<a href="${GAME.wowhead}/quest=${q.id}" target="_blank" rel="noopener">${esc(q.name)}</a>`).join(', ')}`,
          g.createdBy.length && `Made by: ${g.createdBy.map(c => esc(c.name)).join(', ')}`].filter(Boolean);
        return `<article class="card bcard"><h3 class="q-${Q[g.q ?? 1] || 'common'}">${esc(g.name || 'item ' + g.id)} ${g.horde ? '<span class="badge H">Horde</span>' : ''}</h3>
          <dl class="kv">${bonus ? `<dt>Fishing</dt><dd>${bonus}</dd>` : ''}
            ${g.minSkill ? `<dt>Needs</dt><dd>Fishing ${g.minSkill}${g.reqLevel ? ` · level ${g.reqLevel}` : ''}</dd>` : g.reqLevel ? `<dt>Needs</dt><dd>level ${g.reqLevel}</dd>` : ''}
            ${g.text.length ? `<dt>Tooltip</dt><dd class="small">${esc(g.text.join(' · '))}</dd>` : ''}
            ${src.length ? `<dt>Get it</dt><dd class="small">${src.join('<br>')}</dd>` : '<dt>Get it</dt><dd class="small">Source not listed in the Forever data yet.</dd>'}</dl>
          <div class="links">${stTag(g.status, g.src)} ${srcLinks(g.src)}</div></article>`;
      }).join('')}</div>`;
    }).join('');
  }
  peopleHTML() {
    const side = this.side;
    const ppl = this.data.people.filter(p => !this.f.mine || p.side === 'B' || p.side === side);
    const role = { trainer: 'Fishing trainers', other: 'Key fishing NPCs', supplies: 'Fishing Pole vendors' };
    const ranks = this.data.ranks.map(r => `<li><b>${esc(r.rank)}</b> (${r.range.join('–')}): ${esc(r.how)}</li>`).join('');
    const lev = this.data.leveling.map(l => `<li><b>${esc(l.skill)}</b>: ${esc(l[side] || l.zones || '')}</li>`).join('');
    const quests = this.data.quests.filter(q => !this.f.mine || q.side === 'B' || q.side === side);
    return `<div class="card" style="padding:12px"><h3 class="serif" style="margin-top:0;color:var(--gold2)">Ranks &amp; leveling (${side === 'H' ? 'Horde' : 'Alliance'})</h3>
        <ul class="small">${ranks}</ul><ul class="small">${lev}</ul><ul class="small">${this.data.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
      <h3 class="serif" style="color:var(--gold2);margin:14px 2px 6px">Fishing quests</h3>
      <div class="dex">${quests.map(q => `<article class="card bcard"><h3>${esc(q.name)}</h3>
        <div class="small">Level ${q.lvl ?? '?'}${q.req ? ` · requires ${q.req}` : ''}${q.reqSkill ? ` · Fishing ${q.reqSkill}` : ''} <span class="badge ${q.side}">${q.side === 'B' ? 'Both' : q.side === 'H' ? 'Horde' : 'Alliance'}</span></div>
        <dl class="kv">${q.giver ? `<dt>Giver</dt><dd>${esc(q.giver.name || '')}${q.giver.zone ? ` — ${esc(q.giver.zone)} ${coord(q.giver.x, q.giver.y)}` : ''}</dd>` : ''}
          ${q.rewards.length ? `<dt>Rewards</dt><dd>${q.rewards.map(r => `${r.choice ? '(choice) ' : ''}${esc(r.name || 'item ' + r.id)}${r.n > 1 ? ' ×' + r.n : ''}`).join(', ')}</dd>` : ''}
          ${q.objectives.length ? `<dt>Goal</dt><dd class="small">${esc(q.objectives.join(' '))}</dd>` : ''}</dl>
        <div class="links">${q.giver?.x != null ? `<button class="btn ghost" style="padding:3px 9px" data-fmap="quest:${q.id}">Show on map</button>` : ''}${stTag(q.status, q.src)} ${srcLinks(q.src)}</div></article>`).join('')}</div>
      ${Object.entries(role).map(([k, label]) => { const rows = ppl.filter(p => p.role === k); return rows.length ? `<h3 class="serif" style="color:var(--gold2);margin:14px 2px 6px">${label} (${rows.length})</h3>
        <div class="card" style="padding:8px 12px"><ul class="plist">${rows.map(p => `<li><b>${esc(p.name)}</b> <span class="small">${esc(p.sub || '')}</span>
          <span class="badge ${p.side}">${p.side === 'B' ? 'Neutral' : p.side === 'H' ? 'Horde' : 'Alliance'}</span><br><span class="small">${esc(p.place || p.zone || '')}${p.x != null ? ` · ${esc(p.zone || '')} ${coord(p.x, p.y)}` : ''}${p.way ? ` · guide /way ${p.way.join(' ')}` : ''}</span>
          ${p.x != null ? `<button class="btn ghost" style="padding:2px 8px;margin-left:6px" data-fmap="npc:${p.id}">Map</button>` : ''} ${stTag(p.status, p.src)}</li>`).join('')}</ul></div>` : ''; }).join('')}`;
  }
  changesHTML() {
    return `<div class="card" style="padding:12px"><h3 class="serif" style="margin-top:0;color:var(--gold2)">What Forever changes about fishing</h3>
      <ul>${this.data.changes.map(c => `<li style="margin-bottom:6px">${esc(c.text)} <a class="small" href="${esc(c.src)}" target="_blank" rel="noopener">source ↗</a></li>`).join('')}</ul>
      <p class="small">From Wowhead’s Forever fishing guide (beta). Values can still change before launch on ${esc(GAME.launch)}.</p>
      <h3 class="serif" style="color:var(--gold2)">Sources</h3><ol class="small">${this.data.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></li>`).join('')}</ol>
      <p class="small">Data built ${esc(this.data.generated)}.</p></div>`;
  }
  // ---- map layer
  layerPoints() {
    const side = this.side, out = [];
    for (const e of this.entries()) {
      if (e.kind === 'zone' || !e.pts?.length) continue;
      if (this.f.mine && e.side !== 'B' && e.side !== side) continue;
      for (const [x, y, n] of e.pts) out.push({ e, ui: e.ui, x, y, n, color: KIND[e.kind].color });
    }
    for (const p of this.data.people) {
      if (p.x == null || (p.side !== 'B' && p.side !== side) || p.role === 'supplies' && !store.pref('fishVendors')) continue;
      out.push({ p, ui: p.ui, x: p.x, y: p.y, color: p.role === 'trainer' ? '#ffffff' : '#9fd0ff' });
    }
    return out;
  }
  drawLayer(mv) {
    if (!store.pref('fishLayer')) return;
    for (const pt of this.layerPoints()) {
      const ll = mv.project(pt.ui, pt.x, pt.y); if (!ll) continue;
      if (pt.e) {
        const fish = (pt.e.fish || []).map(id => this.fish.get(id)?.name).filter(Boolean).join(', ');
        mv.marker(ll, { color: pt.color, cls: 'fish' + (store.isFished(pt.e.id) ? ' done' : ''), title: pt.e.name,
          popup: `<b>${esc(pt.e.name)}</b><br>${esc(pt.e.zone || '')} ${coord(pt.x, pt.y)}${pt.n > 1 ? ` · ${pt.n} spawn points` : ''}
            <br>${pt.e.skillMin != null ? `Fishing ${pt.e.skillMin} / ${pt.e.skillFull}` : ''}${fish ? `<br>${esc(fish)}` : ''}` });
      } else {
        mv.marker(ll, { color: pt.color, cls: 'fishnpc', title: pt.p.name,
          popup: `<b>${esc(pt.p.name)}</b><br>${esc(pt.p.sub || pt.p.role)}<br>${esc(pt.p.zone || '')} ${coord(pt.x, pt.y)}` });
      }
    }
  }
  find(id) {
    if (id.startsWith('npc:')) { const p = this.data.people.find(p => p.id === +id.slice(4)); return p && { ui: p.ui, x: p.x, y: p.y }; }
    if (id.startsWith('quest:')) { const q = this.data.quests.find(q => q.id === +id.slice(6)); return q?.giver && { ui: q.giver.ui, x: q.giver.x, y: q.giver.y }; }
    const e = this.entries().find(e => e.id === id); if (!e) return null;
    return { ui: e.ui, x: e.pts?.[0]?.[0], y: e.pts?.[0]?.[1] };
  }
}
