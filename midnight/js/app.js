import { GAME } from './config.js';
import { store } from './store.js';
import { $, $$, esc } from './util.js';
import { MapView } from './mapview.js';
import { QuestMap } from './questmap.js';
import { SpecsView } from './specs.js';
import { FishingView } from './fishing.js';
import { FormsView } from './forms.js';
import { DruidView } from './druid.js';

const files = ['quests', 'zones', 'specs', 'fishing', 'forms', 'worgen', 'meta'];
async function loadData() {
  if (window.__DATA) return window.__DATA; // single-file offline build
  const out = {};
  await Promise.all(files.map(async f => { out[f] = await (await fetch(`data/${f}.json`)).json(); }));
  out.quests = out.quests.quests;
  return out;
}
const VIEWS = ['map', 'specs', 'fishing', 'forms', 'druid'];

const app = {
  async init() {
    this.data = await loadData();
    if (!Array.isArray(this.data.quests)) this.data.quests = this.data.quests.quests;
    this.mv = new MapView($('#map-holder'), this.data.zones, {});
    this.mv.map.attributionControl.setPrefix('Leaflet · schematic grid, coords from Wowhead');
    this.fishing = new FishingView($('#view-fishing'), this.data, this);
    this.quests = new QuestMap($('#view-map'), this.data, this.mv, this);
    $('#map').replaceWith($('#map-holder')); $('#map-holder').removeAttribute('style'); $('#map-holder').id = 'map';
    this.specs = new SpecsView($('#view-specs'), this.data, this);
    this.forms = new FormsView($('#view-forms'), this.data, this);
    this.druid = new DruidView($('#view-druid'), this.data, this);
    this.quests.start(); this.mv.invalidate();
    $$('.tabs button').forEach(b => b.onclick = () => this.go(b.dataset.view));
    $('#charpill').onclick = () => this.go('specs');
    window.addEventListener('hashchange', () => this.go(location.hash.slice(1) || 'map', false));
    this.go(location.hash.slice(1) || 'map', false);
    this.pill();
    $('#loading')?.remove();
  },
  go(view, push = true) {
    if (!VIEWS.includes(view)) view = 'map';
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === view));
    if (push && location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    if (view === 'map') this.mv.invalidate();
    if (view === 'druid') this.druid.summary();
    window.scrollTo({ top: 0 });
  },
  pill() { $('#charpill').innerHTML = `<span class="dot A"></span>Worgen ${esc(store.get().spec === 'feral' ? 'Feral' : 'Guardian')}`; },
  showOnMap(areaId, x, y) {
    if (!this.mv.byUi.has(areaId)) return;
    store.pref('fishLayer', true);
    for (const i of ['fiLayer', 'mFish']) { const cb = document.getElementById(i); if (cb) cb.checked = true; }
    this.go('map'); this.quests.showMap(areaId);
    const ll = this.mv.project(areaId, x, y); if (ll) this.mv.map.setView(ll, 1);
    setTimeout(() => $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  },
};
app.init().catch(err => { console.error(err); const el = document.getElementById('loading'); if (el) el.textContent = 'Could not load data: ' + err.message; });
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__DATA) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
window.__app = app;
