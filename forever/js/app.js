import { GAME, RACES } from './config.js';
import { store } from './store.js';
import { $, $$, esc } from './util.js';
import { MapView } from './mapview.js';
import { QuestView } from './quests.js';
import { BeastView } from './beasts.js';
import { SettingsView } from './settings.js';
import { FishingView } from './fishing.js';
import { TreasureView } from './treasure.js';

const files = ['quests', 'beasts', 'families', 'foods', 'zones', 'meta', 'fishing', 'treasure'];

async function loadData() {
  // Offline single-file build inlines everything as window.__DATA (no fetch under file://)
  if (window.__DATA) return window.__DATA;
  const out = {};
  await Promise.all(files.map(async f => { out[f] = await (await fetch(`data/${f}.json`)).json(); }));
  return out;
}
const VIEWS = ['quests', 'beasts', 'fishing', 'settings'];

const app = {
  async init() {
    this.data = await loadData();
    this.mv = new MapView($('#map-holder'), this.data.zones, { onZoneClick: ui => this.quests.showMap(ui) });
    this.quests = new QuestView($('#view-quests'), this.data, this.mv, this);
    // MapView needs its element inside the quest view: move it there once the shell exists
    $('#map').replaceWith($('#map-holder')); $('#map-holder').removeAttribute('style'); $('#map-holder').id = 'map';
    this.mv.invalidate();
    this.beasts = new BeastView($('#view-beasts'), this.data, this);
    this.fishing = new TreasureView($('#view-fishing'), this.data, this, FishingView);
    this.fishing.bindLegend($('#view-quests'), () => this.quests.drawMarkers());
    this.settings = new SettingsView($('#view-settings'), this.data, this);
    this.quests.start(); this.beasts.refresh(); this.fishing.refresh();
    $$('.tabs button').forEach(b => b.onclick = () => this.go(b.dataset.view));
    $('#charpill').onclick = () => this.go('settings');
    window.addEventListener('hashchange', () => this.go(location.hash.slice(1) || 'quests', false));
    this.go(location.hash.slice(1) || 'quests', false);
    this.pill();
    $('#loading')?.remove();
  },
  go(view, push = true) {
    if (!VIEWS.includes(view)) view = 'quests';
    $$('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + view));
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === view));
    if (push && location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    if (view === 'quests') this.mv.invalidate();
    if (view === 'settings') this.settings.summary();
    window.scrollTo({ top: 0 });
  },
  pill() {
    const r = RACES[store.get().race] || RACES.tauren;
    $('#charpill').innerHTML = `<span class="dot ${r.faction}"></span>${esc(r.name)} Hunter`;
  },
  race() { return RACES[store.get().race] || RACES.tauren; },
  onRaceChange() { this.pill(); this.quests.onRaceChange(); this.beasts.refresh(); this.fishing.onRaceChange(); },
  showFishingOnMap(id) {
    const t = this.fishing.find(id); if (!t || !t.ui) return;
    store.pref('fishLayer', true);
    for (const i of ['fLayer', 'mFish']) { const cb = document.getElementById(i); if (cb) cb.checked = true; }
    this.go('quests');
    this.fishing.setMode('fishguide');
    this.quests.showMap(t.ui); this.quests.drawMarkers();
    if (t.x != null) { const ll = this.mv.project(t.ui, t.x, t.y); if (ll) this.mv.map.setView(ll, 1); }
    setTimeout(() => $('#map').scrollIntoView({ behavior: 'smooth' }), 60);
  },
  mapView: 'quests',
  showBeastOnMap(b) { this.go('quests'); this.quests.setBeast(b); setTimeout(() => $('#map').scrollIntoView({ behavior: 'smooth' }), 60); },
};

app.init().catch(err => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Could not load data: ' + err.message;
});

// No service worker for the single-file offline build (file:// can't register one).
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__DATA) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
window.__app = app;
