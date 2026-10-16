// Persistent user state (localStorage) + JSON export/import.
import { GAME } from './config.js';

const DEFAULT = { v: 1, race: 'tauren', done: {}, caught: {}, fished: {}, prefs: {} };
let state = load();
const subs = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(GAME.storageKey));
    return raw && raw.v === 1 ? { ...structuredClone(DEFAULT), ...raw } : structuredClone(DEFAULT);
  } catch { return structuredClone(DEFAULT); }
}
function save() {
  try { localStorage.setItem(GAME.storageKey, JSON.stringify(state)); } catch {}
  subs.forEach(fn => fn(state));
}
export const store = {
  get: () => state,
  on: fn => (subs.add(fn), () => subs.delete(fn)),
  setRace(r) { state.race = r; save(); },
  pref(k, v) { if (v === undefined) return state.prefs[k]; state.prefs[k] = v; save(); },
  isDone: id => !!state.done[id],
  toggleDone(id, on = !state.done[id]) { on ? (state.done[id] = 1) : delete state.done[id]; save(); },
  isCaught: id => !!state.caught[id],
  toggleCaught(id, on = !state.caught[id]) { on ? (state.caught[id] = 1) : delete state.caught[id]; save(); },
  isFished: id => !!state.fished[id],
  toggleFished(id, on = !state.fished[id]) { state.fished ||= {}; on ? (state.fished[id] = 1) : delete state.fished[id]; save(); },
  exportJSON() {
    return JSON.stringify({ app: GAME.id, exported: new Date().toISOString(), ...state }, null, 1);
  },
  importJSON(text) {
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object' || (d.app && d.app !== GAME.id)) throw new Error('Not a ' + GAME.title + ' progress file');
    const clean = (o, re = /^\d+$/) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => re.test(k) && v).map(([k]) => [k, 1]));
    state = { ...DEFAULT, race: d.race || state.race, prefs: d.prefs || {}, done: clean(d.done), caught: clean(d.caught),
      fished: clean(d.fished, /^[a-z]\d+(-\d+)?$/) };
    save();
  },
  reset() { state = structuredClone(DEFAULT); save(); },
};
