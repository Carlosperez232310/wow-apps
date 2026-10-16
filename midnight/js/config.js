// Game-specific configuration for the retail Midnight sister app (same codebase as Forever Hunter).
export const GAME = {
  id: 'midnight-druid',
  title: 'Midnight Druid',
  subtitle: 'WoW Midnight 12.1.5 · Worgen Guardian/Feral companion',
  patch: '12.1.5',
  wowhead: 'https://www.wowhead.com',
  storageKey: 'midnight-druid:v1',
};
export const CHAR = { race: 'Worgen', faction: 'A', cls: 'Druid', specs: ['guardian', 'feral'] };
// Quest side flags on Wowhead: 1 Alliance, 2 Horde, 3 both
export const SIDE = { 1: ['A', 'Alliance'], 2: ['H', 'Horde'], 3: ['B', 'Both'] };
export const QUEST_CATS = {
  leather: { label: 'Agility leather', short: 'Leather', color: '#5fbf5a' },
  weapon:  { label: 'Agility weapons', short: 'Weapon', color: '#e0b44c' },
  acc:     { label: 'Neck, rings, trinkets, cloaks', short: 'Accessory', color: '#5aa2e6' },
};
export const FORM_TYPES = {
  cat: 'Cat', bear: 'Bear', travel: 'Travel', flight: 'Flight', aquatic: 'Aquatic', moonkin: 'Moonkin', treant: 'Treant', tree: 'Tree of Life',
};
export const SPEC_LABEL = { guardian: 'Guardian (tank)', feral: 'Feral (melee DPS)' };
