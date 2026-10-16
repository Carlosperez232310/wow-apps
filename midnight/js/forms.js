// Forms tab: a "Pokédex" of Druid form appearances a Worgen Druid can unlock, with collected checkboxes.
import { FORM_TYPES } from './config.js';
import { store } from './store.js';
import { $, $$, esc, debounce } from './util.js';

const GLYPH = { cat: '🐈', bear: '🐻', travel: '🦌', flight: '🦅', aquatic: '🐬', moonkin: '🦉', treant: '🌳', tree: '🌳' };

export class FormsView {
  constructor(root, data) {
    this.root = root; this.D = data.forms; this.E = this.D.entries;
    this.f = { type: store.pref('fType') || 'all', group: 'all', q: '', hide: !!store.pref('fHide') };
    this.render();
  }
  render() {
    const types = Object.entries(FORM_TYPES).filter(([k]) => this.E.some(e => e.type === k));
    const groups = [...new Set(this.E.map(e => e.group))];
    this.root.innerHTML = `<div class="wrap"><div class="card pad">
      <div class="row between"><h2>Druid form Pokédex</h2><span class="small" id="fCount"></span></div>
      <div class="bar"><i id="fBar"></i></div>
      <div class="row" id="fTypes"><button class="chip" data-type="all" aria-pressed="${this.f.type === 'all'}">All</button>${types.map(([k, v]) => `<button class="chip" data-type="${k}" aria-pressed="${this.f.type === k}">${GLYPH[k] || ''} ${v}</button>`).join('')}</div>
      <input class="search" id="fSearch" placeholder="Search forms, items, NPCs…" aria-label="Search forms">
      <div class="row"><label class="field">Source group<select id="fGroup"><option value="all">All groups</option>${groups.map(g => `<option>${esc(g)}</option>`).join('')}</select></label>
        <label class="check small"><input type="checkbox" id="fHide" ${this.f.hide ? 'checked' : ''}> Hide collected</label></div>
      <p class="small">From Wowhead's Druid Customization Guide (last edited ${esc((this.D.updated || '').slice(0, 10))}). Race-locked variants for other races are left out; Haranir-only forms are excluded (Haranir is a separate race). The guide predates some Midnight content — newer unlocks may be missing.</p>
    </div><div class="dex" id="fList"></div></div>`;
    $$('#fTypes .chip', this.root).forEach(b => b.onclick = () => { this.f.type = b.dataset.type; store.pref('fType', this.f.type); $$('#fTypes .chip', this.root).forEach(x => x.setAttribute('aria-pressed', x === b)); this.list(); });
    $('#fSearch', this.root).oninput = debounce(e => { this.f.q = e.target.value.trim().toLowerCase(); this.list(); });
    $('#fGroup', this.root).onchange = e => { this.f.group = e.target.value; this.list(); };
    $('#fHide', this.root).onchange = e => { this.f.hide = e.target.checked; store.pref('fHide', this.f.hide); this.list(); };
    this.root.addEventListener('change', e => {
      const t = e.target.closest('[data-col]'); if (!t) return;
      store.toggle('collected', t.dataset.col, t.checked); t.closest('.fcard').classList.toggle('isdone', t.checked); this.count();
    });
    this.list();
  }
  count() {
    const n = this.E.filter(e => store.has('collected', e.id.slice(1))).length;
    $('#fCount', this.root).innerHTML = `Collected <b>${n}</b> / ${this.E.length} · showing ${this.vis.length}`;
    $('#fBar', this.root).style.width = (100 * n / this.E.length).toFixed(1) + '%';
  }
  list() {
    const f = this.f;
    this.vis = this.E.filter(e => (f.type === 'all' || e.type === f.type) && (f.group === 'all' || e.group === f.group) && (!f.hide || !store.has('collected', e.id.slice(1)))
      && (!f.q || (e.name + ' ' + e.unlock + ' ' + (e.note || '')).toLowerCase().includes(f.q)));
    $('#fList', this.root).innerHTML = this.vis.map(e => {
      const id = e.id.slice(1), got = store.has('collected', id);
      const refs = (e.refs || []).filter((r, i, a) => a.findIndex(x => x.url === r.url) === i).map(r => `<a href="${r.url}" target="_blank" rel="noopener">${esc(r.name)}</a>`).join(' · ');
      return `<article class="card fcard ${got ? 'isdone' : ''}"><div class="fg">${GLYPH[e.type] || '✦'}</div>
        <div class="body"><div class="row between"><h3>${esc(e.name)}</h3><label class="check"><input type="checkbox" data-col="${id}" ${got ? 'checked' : ''}> Collected</label></div>
        <div class="small">${esc(FORM_TYPES[e.type] || e.type)} · ${esc(e.group)}${e.race && e.race !== 'all' ? ` · <span class="badge A">${esc(e.race)}</span>` : ''}</div>
        <p>${esc(e.unlock)}</p>${e.note ? `<p class="small">${esc(e.note)}</p>` : ''}
        ${refs ? `<div class="small">${refs}</div>` : ''}<div class="small"><a href="${e.source}" target="_blank" rel="noopener">Wowhead guide ↗</a></div></div></article>`;
    }).join('') || '<div class="empty">Nothing matches.</div>';
    this.count();
  }
}
