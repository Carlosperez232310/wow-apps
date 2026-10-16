// Persistent user state (localStorage) + JSON export/import. Buckets: done (quests), collected (forms), fished (pools/fish).
import { GAME } from './config.js';

const BUCKETS = ['done', 'collected', 'fished'];
const DEFAULT = { v: 1, spec: 'guardian', done: {}, collected: {}, fished: {}, prefs: {} };
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
  pref(k, v) { if (v === undefined) return state.prefs[k]; state.prefs[k] = v; save(); },
  setSpec(s) { state.spec = s; save(); },
  has: (b, id) => !!(state[b] || {})[id],
  toggle(b, id, on = !store.has(b, id)) { state[b] ||= {}; on ? (state[b][id] = 1) : delete state[b][id]; save(); },
  count: b => Object.keys(state[b] || {}).length,
  exportJSON() { return JSON.stringify({ app: GAME.id, exported: new Date().toISOString(), ...state }, null, 1); },
  importJSON(text) {
    const d = JSON.parse(text);
    if (!d || typeof d !== 'object' || (d.app && d.app !== GAME.id)) throw new Error('Not a ' + GAME.title + ' progress file');
    const clean = o => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => /^[a-z]?\d+(-\d+)?$/.test(k) && v).map(([k]) => [k, 1]));
    state = { ...structuredClone(DEFAULT), spec: d.spec === 'feral' ? 'feral' : 'guardian', prefs: d.prefs || {} };
    for (const b of BUCKETS) state[b] = clean(d[b]);
    save();
  },
  reset() { state = structuredClone(DEFAULT); save(); },
};
