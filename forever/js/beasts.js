// Feature 2: Beast Pokédex.
import { GAME, DIET, STATUS } from './config.js';
import { store } from './store.js';
import { $, $$, esc, debounce, coord } from './util.js';

const PAGE = 48;
const CLS = { 1: 'Elite', 2: 'Rare Elite', 3: 'Boss', 4: 'Rare' };
const PAW = '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="6" cy="9" rx="2.2" ry="3"/><ellipse cx="10" cy="5.5" rx="2.2" ry="3"/><ellipse cx="14.5" cy="5.5" rx="2.2" ry="3"/><ellipse cx="18.5" cy="9" rx="2.2" ry="3"/><path d="M12 11c3.5 0 6.5 4.2 6.5 6.8 0 2.2-1.8 3.2-3.6 3.2-1.2 0-1.9-.6-2.9-.6s-1.7.6-2.9.6c-1.8 0-3.6-1-3.6-3.2C5.5 15.2 8.5 11 12 11z"/></svg>';

export function dietList(mask) {
  if (mask == null) return [];
  return Object.entries(DIET).filter(([b]) => Math.floor(mask / +b) % 2 === 1).map(([, n]) => n);
}

export class BeastView {
  constructor(root, data, app) {
    Object.assign(this, { root, data, app });
    this.fam = new Map(data.families.map(f => [f.id, f]));
    this.f = { q: '', fam: 'all', zone: 'all', min: 1, max: 60, rare: false, caught: 'all', sort: 'level' };
    this.limit = PAGE;
    this.renderShell(); this.bind();
  }
  renderShell() {
    const fams = this.data.families.filter(f => f.id !== 'fox').sort((a, b) => a.name.localeCompare(b.name));
    const zones = new Map();
    for (const b of this.data.beasts) for (const z of b.zones) if (z.zone) zones.set(z.area, z.zone);
    this.root.innerHTML = `<div class="wrap">
      <div class="card dexhead">
        <div class="row" style="justify-content:space-between"><h2 class="serif" style="margin:0;color:var(--gold2)">Beast Pokédex</h2>
          <span class="counter" id="bCount"></span></div>
        <div class="progress" aria-hidden="true"><i id="bBar" style="width:0"></i></div>
        <input class="search" id="bSearch" type="search" placeholder="Search beasts, zones, abilities…" aria-label="Search beasts">
        <div class="fgrid">
          <label class="field">Family<select id="bFam"><option value="all">All families</option>${fams.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select></label>
          <label class="field">Zone<select id="bZone"><option value="all">All zones</option>${[...zones].sort((a, b) => a[1].localeCompare(b[1])).map(([a, n]) => `<option value="${a}">${esc(n)}</option>`).join('')}</select></label>
          <label class="field">Min level<input id="bMin" type="number" min="1" max="63" value="1" inputmode="numeric"></label>
          <label class="field">Max level<input id="bMax" type="number" min="1" max="63" value="60" inputmode="numeric"></label>
          <label class="field">Sort<select id="bSort"><option value="level">Level</option><option value="start">Near my start zone</option><option value="name">Name</option><option value="family">Family</option></select></label>
          <label class="field">Caught<select id="bCaught"><option value="all">All</option><option value="no">Not caught</option><option value="yes">Caught</option></select></label>
        </div>
        <div class="row"><label class="check"><input type="checkbox" id="bRare"> Rares only</label>
          <span class="small" id="foxNote"></span></div>
      </div>
      <div class="dex" id="dex"></div></div>`;
    const fox = this.fam.get('fox');
    if (fox) $('#foxNote', this.root).innerHTML = `<span class="badge best">New: Fox</span> ${esc(fox.unique?.name || '')} — ${esc(fox.note || '')}`;
  }
  bind() {
    const r = this.root;
    $('#bSearch', r).oninput = debounce(e => { this.f.q = e.target.value.trim().toLowerCase(); this.refresh(); });
    $('#bFam', r).onchange = e => { this.f.fam = e.target.value; this.refresh(); };
    $('#bZone', r).onchange = e => { this.f.zone = e.target.value; this.refresh(); };
    $('#bMin', r).onchange = e => { this.f.min = +e.target.value || 1; this.refresh(); };
    $('#bMax', r).onchange = e => { this.f.max = +e.target.value || 63; this.refresh(); };
    $('#bCaught', r).onchange = e => { this.f.caught = e.target.value; this.refresh(); };
    $('#bSort', r).onchange = e => { this.f.sort = e.target.value; this.refresh(); };
    $('#bRare', r).onchange = e => { this.f.rare = e.target.checked; this.refresh(); };
    $('#dex', r).addEventListener('change', e => {
      const cb = e.target.closest('input[data-caught]'); if (!cb) return;
      store.toggleCaught(cb.dataset.caught, cb.checked);
      cb.closest('.bcard').classList.toggle('caught', cb.checked); this.progress();
    });
    $('#dex', r).addEventListener('click', e => {
      if (e.target.closest('.more')) { this.limit += PAGE; this.render(); return; }
      const m = e.target.closest('[data-map]');
      if (m) this.app.showBeastOnMap(this.data.beasts.find(b => b.id === +m.dataset.map));
    });
  }
  filtered() {
    const f = this.f;
    const startUi = this.app.race().start.uiMapId;
    const lvl = b => b.min ?? 99;
    const cmp = {
      level: (a, b) => lvl(a) - lvl(b) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      family: (a, b) => (this.fam.get(a.fam)?.name || '').localeCompare(this.fam.get(b.fam)?.name || '') || lvl(a) - lvl(b),
      start: (a, b) => (b.zones.some(z => z.ui === startUi) - a.zones.some(z => z.ui === startUi)) || lvl(a) - lvl(b),
    }[f.sort];
    return this.data.beasts.filter(b => {
      if (f.fam !== 'all' && String(b.fam) !== f.fam) return false;
      if (f.zone !== 'all' && !b.zones.some(z => String(z.area) === f.zone)) return false;
      const lo = b.min ?? 0, hi = b.max ?? lo;
      if (hi < f.min || lo > f.max) return false;
      if (f.rare && !b.rare) return false;
      if (f.caught === 'yes' && !store.isCaught(b.id)) return false;
      if (f.caught === 'no' && store.isCaught(b.id)) return false;
      if (f.q) {
        const fam = this.fam.get(b.fam);
        const hay = [b.name, fam?.name, ...b.zones.map(z => z.zone), ...b.teaches.map(t => t.n)].join(' ').toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    }).sort(cmp);
  }
  refresh() { this.list = this.filtered(); this.limit = PAGE; this.render(); this.progress(); }
  progress() {
    const all = this.data.beasts, caught = all.filter(b => store.isCaught(b.id)).length;
    const rares = all.filter(b => b.rare), rc = rares.filter(b => store.isCaught(b.id)).length;
    $('#bCount', this.root).innerHTML = `Caught <b>${caught}</b> / ${all.length} · rares <b>${rc}</b> / ${rares.length} · showing ${this.list.length}`;
    $('#bBar', this.root).style.width = (100 * caught / all.length).toFixed(1) + '%';
  }
  foodFor(b, fam) {
    const types = Object.keys(DIET).map(Number).filter(t => fam.diet != null && Math.floor(fam.diet / t) % 2 === 1);
    const lvl = b.max ?? b.min ?? 1;
    const picks = [];
    for (const t of types) {
      const cands = this.data.foods.filter(f => f.type === t && f.vendor && f.ilvl <= Math.max(lvl, 5));
      const best = cands.sort((a, b2) => b2.ilvl - a.ilvl)[0];
      if (best) picks.push(best);
    }
    return picks.sort((a, b2) => b2.ilvl - a.ilvl).slice(0, 3);
  }
  card(b) {
    const fam = this.fam.get(b.fam) || {}; const st = STATUS[b.status];
    const caught = store.isCaught(b.id);
    const lvl = b.min == null ? '?' : (b.min === b.max ? b.min : `${b.min}–${b.max}`);
    const zones = b.zones.slice(0, 3).map(z => {
      const top = z.pts[0];
      return `${esc(z.zone || 'Unknown')}${top ? ` <span class="lvl" style="font-weight:600">${coord(top[0], top[1])}</span>` : ''}${z.pts.length > 1 ? ` <span class="small">+${z.pts.length - 1} spots</span>` : ''}`;
    }).join('<br>');
    const uniq = fam.unique?.name?.replace(/!$/, '');
    const teach = b.teaches.length ? b.teaches.map(t => `<span class="${uniq && t.n.replace(/!$/, '') === uniq ? 'uniq' : ''}" title="Learned at pet level ${t.l ?? '?'}">${esc(t.n)} ${t.r}</span>`).join('')
      : '<span class="small" style="border:0">None listed</span>';
    const diet = dietList(fam.diet);
    const food = fam.diet != null ? this.foodFor(b, fam) : [];
    const look = b.look.map(l => {
      const sk = l.skin ? `${esc(l.skin.model)}${l.skin.skin ? ' · <b>' + esc(l.skin.skin) + '</b> skin' : ''} <span title="Blizzard texture file">(${esc(l.skin.file)})</span>` : '';
      const same = l.same.length ? `same look as ${l.same.slice(0, 3).map(esc).join(', ')}` : 'unique look among tameable beasts';
      return [sk, same].filter(Boolean).join(' — ');
    }).join('<br>');
    return `<article class="card bcard${caught ? ' caught' : ''}${b.rare ? ' israre' : ''}">
      <div class="fam"><div class="famicon" title="${esc(fam.name)}">${PAW}</div>
        <div style="flex:1;min-width:0"><h3>${esc(b.name)}</h3>
          <div class="small">${esc(fam.name || '')} · level <span class="lvl">${lvl}</span>
          ${b.rare ? ' <span class="badge rare">' + CLS[b.cls] + '</span>' : b.elite ? ' <span class="badge elite">' + (CLS[b.cls] || 'Elite') + '</span>' : ''}</div></div>
        <label class="check" title="Caught"><input type="checkbox" data-caught="${b.id}" ${caught ? 'checked' : ''}><span class="sr">Caught</span></label></div>
      <dl class="kv">
        <dt>Where</dt><dd>${zones || '<span class="small">No coordinates</span>'}</dd>
        <dt>Family skill</dt><dd>${fam.unique ? `<b style="color:var(--gold2)">${esc(fam.unique.name)}</b> <span class="small">${esc(fam.unique.desc || '')}</span>` : '—'}</dd>
        <dt>Teaches</dt><dd class="abil">${teach}</dd>
        <dt>Diet</dt><dd>${diet.length ? diet.join(', ') : '—'}</dd>
        <dt>Carry</dt><dd>${food.length ? food.map(f => `<a href="${GAME.wowhead}/item=${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a> <span class="small">(ilvl ${f.ilvl})</span>`).join(', ') : '—'}</dd>
      </dl>
      ${look ? `<div class="look">${b.rare ? '<b style="color:var(--rare)">Rare look:</b> ' : 'Look: '}${look}</div>` : ''}
      <div class="links row" style="font-size:12.5px">
        <a href="${GAME.wowhead}/npc=${b.id}" target="_blank" rel="noopener">Wowhead Forever ↗</a>
        ${b.zones.some(z => z.pts.length) ? `<button class="btn ghost" style="padding:3px 9px" data-map="${b.id}">Show on map</button>` : ''}
        <span class="st ${st.cls}" title="Beast list: Wowhead Forever · coords: ${esc(b.coordSrc || 'none')}">${esc(st.label)}</span></div>
    </article>`;
  }
  render() {
    const el = $('#dex', this.root);
    if (!this.list.length) { el.innerHTML = '<div class="empty card">No beasts match.</div>'; return; }
    el.innerHTML = this.list.slice(0, this.limit).map(b => this.card(b)).join('') +
      (this.list.length > this.limit ? `<button class="btn ghost more" style="grid-column:1/-1">Show more (${this.list.length - this.limit} left)</button>` : '');
  }
}
