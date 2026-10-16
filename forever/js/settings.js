// Character + data settings, progress export/import, sources.
import { GAME, RACES, FACTIONS, STATUS } from './config.js';
import { store } from './store.js';
import { $, $$, esc, toast } from './util.js';

export class SettingsView {
  constructor(root, data, app) { Object.assign(this, { root, data, app }); this.render(); }
  render() {
    const cur = store.get().race, m = this.data.meta.counts;
    const races = f => Object.entries(RACES).filter(([, r]) => r.faction === f).map(([k, r]) =>
      `<button class="race" data-race="${k}" aria-pressed="${k === cur}"><b>${esc(r.name)}</b><small>Starts: ${esc(r.start.zone)}</small></button>`).join('');
    const sc = (o) => Object.entries(o).map(([k, v]) => `${esc(STATUS[k]?.label || k)}: <b>${v}</b>`).join(' · ');
    this.root.innerHTML = `<div class="settings">
      <section class="card" style="padding:14px">
        <h2 class="serif" style="margin-top:0;color:var(--gold2)">Your Hunter</h2>
        <p class="small">Race decides faction, starting zone, quest availability and leveling order.</p>
        <h3><span class="dot H" style="display:inline-block"></span> ${FACTIONS.H}</h3><div class="racegrid">${races('H')}</div>
        <h3><span class="dot A" style="display:inline-block"></span> ${FACTIONS.A}</h3><div class="racegrid">${races('A')}</div>
      </section>
      <section class="card" style="padding:14px">
        <h2 class="serif" style="margin-top:0;color:var(--gold2)">Progress</h2>
        <p class="small">Done quests and caught beasts are saved in this browser (localStorage). Export to back up or move to another device.</p>
        <div class="row"><button class="btn" id="exp">Export JSON</button>
          <label class="btn ghost" for="impFile">Import JSON</label><input type="file" id="impFile" accept="application/json,.json" hidden>
          <button class="btn ghost" id="reset">Reset all</button></div>
        <p class="small" id="progSummary"></p>
      </section>
      <section class="card" style="padding:14px">
        <h2 class="serif" style="margin-top:0;color:var(--gold2)">Data &amp; sources</h2>
        <p class="small">Built ${esc(this.data.meta.generated)} by scripts (no hand-typed entries). WoW: Forever launches ${GAME.launch}; the beta is capped at level ${GAME.betaCap}, so later content can still change.</p>
        <ul class="small">
          <li><b>${m.quests}</b> quests (${Object.entries(m.questCats).map(([k, v]) => `${k}: ${v}`).join(', ')}) — ${sc(m.questStatus)}</li>
          <li><b>${m.beasts}</b> tameable beasts (${m.rares} rares) in ${m.families} families — ${sc(m.beastStatus)}</li>
          <li><b>${m.foods}</b> pet foods</li>
          ${m.fishing ? `<li>Fishing: <b>${m.fishing.zones}</b> zone waters, <b>${Object.values(m.fishing.spots).reduce((a, b) => a + b, 0)}</b> mapped spots, <b>${m.fishing.fish}</b> fish (${m.fishing.petFoodFish} pet food), <b>${m.fishing.quests}</b> quests, ${Object.values(m.fishing.people).reduce((a, b) => a + b, 0)} NPCs</li>` : ''}</ul>
        <h3>Source tags</h3>
        <ul class="small">
          <li><span class="st st-new">Forever · new</span> listed as new content in Wowhead’s Forever database.</li>
          <li><span class="st st-changed">Forever · changed</span> in Wowhead Forever, flagged as changed from Classic.</li>
          <li><span class="st st-listed">Forever data · same as Classic</span> in Wowhead Forever, flagged unchanged.</li>
          <li><span class="st st-classic">Carried over from Classic</span> only in QuestieDB’s Era-based data; not yet seen in a Forever source.</li></ul>
        <h3>Sources</h3>
        <ol class="small sources">
          <li><a href="https://www.wowhead.com/forever" target="_blank" rel="noopener">Wowhead Forever database</a>: quest lists (levels, side, rewards), quest-reward item stats, pet families, tameable beasts, ability ranks, model groups.</li>
          <li><a href="https://github.com/Questie/QuestieDB" target="_blank" rel="noopener">QuestieDB</a> (GPL-3.0) Forever export: quest givers, NPC/object spawn coordinates (Era coordinates converted to Forever maps by QuestieDB), race masks.</li>
          <li><a href="https://news.blizzard.com/en-us/article/24301515" target="_blank" rel="noopener">Blizzard: Forever class deep dive (Hunter &amp; Druid)</a>: family-unique pet abilities, Fox.</li>
          <li>Blizzard client tables (UiMap, UiMapAssignment, AreaTable, Item pet-food types) via <a href="https://wago.tools" target="_blank" rel="noopener">wago.tools</a>, Forever beta branch.</li>
          <li><a href="https://www.wowhead.com/forever/guide/professions/fishing/overview-leveling" target="_blank" rel="noopener">Wowhead: Fishing Profession Overview in Forever</a> (zone skill table, trainers, poles, lures, Forever changes) and <a href="https://www.wowhead.com/classic/guide=8957" target="_blank" rel="noopener">Wowhead Classic best fishing spots</a> (carry-over fish notes).</li>
          <li><a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a> (BSD-2). Map images are generated by this app from spawn-point density; no Blizzard map art is used.</li></ol>
        <p class="small">Fan-made and unofficial. World of Warcraft is a trademark of Blizzard Entertainment. Coordinates for unchanged areas come from Classic data converted to Forever maps and may be slightly off; rare-beast looks are given as “same model as …” because no openly licensed images are available.</p>
      </section></div>`;
    this.summary();
    $$('.race', this.root).forEach(b => b.onclick = () => {
      store.setRace(b.dataset.race);
      $$('.race', this.root).forEach(x => x.setAttribute('aria-pressed', x === b));
      this.app.onRaceChange(); toast(`Now playing ${RACES[b.dataset.race].name}`);
    });
    $('#exp', this.root).onclick = () => {
      const blob = new Blob([store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `forever-hunter-progress-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('#impFile', this.root).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { store.importJSON(await f.text()); toast('Progress imported'); this.app.onRaceChange(); this.render(); }
      catch (err) { toast('Import failed: ' + err.message); }
      e.target.value = '';
    };
    $('#reset', this.root).onclick = () => { if (confirm('Clear all done quests, caught beasts and fished spots?')) { store.reset(); this.app.onRaceChange(); this.render(); } };
  }
  summary() {
    const s = store.get();
    const el = $('#progSummary', this.root);
    if (el) el.textContent = `${Object.keys(s.done).length} quests done · ${Object.keys(s.caught).length} beasts caught · ${Object.keys(s.fished || {}).length} fishing spots fished · ${Object.keys(s.got || {}).length} treasures got`;
  }
}
