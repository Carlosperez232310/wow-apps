// Game-specific configuration. A sister app (e.g. retail Midnight) swaps this file + data/.
export const GAME = {
  id: 'forever',
  title: 'Forever Hunter',
  subtitle: 'WoW: Forever quest map & beast Pokédex',
  launch: '2026-11-04',
  levelCap: 60,
  betaCap: 30,
  wowhead: 'https://www.wowhead.com/forever',
  wowheadClassic: 'https://www.wowhead.com/classic',
  storageKey: 'forever-hunter:v1',
};

// Hunter-capable races only (Undead/Gnome can't be Hunters). Add more rows here if Blizzard opens combos.
// Race bits follow QuestieDB's Forever race masks (Skyborne use bits 32/33).
export const RACES = {
  tauren:   { name: 'Tauren',            faction: 'H', bit: 2 ** 5,  start: { uiMapId: 1412, areaId: 215, zone: 'Mulgore' } },
  orc:      { name: 'Orc',               faction: 'H', bit: 2 ** 1,  start: { uiMapId: 1411, areaId: 14, zone: 'Durotar' } },
  troll:    { name: 'Troll',             faction: 'H', bit: 2 ** 7,  start: { uiMapId: 1411, areaId: 14, zone: 'Durotar' } },
  skyborneH:{ name: 'Skyborne (Horde)',  faction: 'H', bit: 2 ** 33, start: { uiMapId: 2521, areaId: 16593, zone: 'Zephras Isle' } },
  nightelf: { name: 'Night Elf',         faction: 'A', bit: 2 ** 3,  start: { uiMapId: 1438, areaId: 141, zone: 'Teldrassil' } },
  dwarf:    { name: 'Dwarf',             faction: 'A', bit: 2 ** 2,  start: { uiMapId: 1426, areaId: 1, zone: 'Dun Morogh' } },
  human:    { name: 'Human',             faction: 'A', bit: 2 ** 0,  start: { uiMapId: 1429, areaId: 12, zone: 'Elwynn Forest' } },
  skyborneA:{ name: 'Skyborne (Alliance)', faction: 'A', bit: 2 ** 32, start: { uiMapId: 2521, areaId: 16593, zone: 'Zephras Isle' } },
};
export const FACTIONS = { H: 'Horde', A: 'Alliance' };
export const CLASS_BIT = 2 ** 2; // Hunter

// Typical Classic-era leveling flow (area ids) used only as a tie-breaker after quest level.
export const ZONE_FLOW = {
  H: [215, 14, 85, 16593, 17, 130, 406, 331, 400, 267, 405, 45, 33, 15, 3, 8, 357, 47, 440, 51, 16, 490, 361, 46, 28, 139, 618, 1377],
  A: [12, 1, 141, 16593, 40, 38, 148, 44, 10, 11, 331, 406, 267, 45, 405, 33, 15, 3, 8, 357, 47, 440, 51, 16, 490, 361, 46, 28, 139, 618, 1377],
};

export const QUEST_CATS = {
  gear:   { label: 'Gear upgrades', short: 'Gear', color: '#5fbf5a', desc: 'Agility / Stamina / Attack Power rewards a Hunter can use' },
  class:  { label: 'Hunter & pet quests', short: 'Hunter', color: '#e0b44c', desc: 'Class quests, taming & pet training' },
  ranged: { label: 'Bows, guns, crossbows & ammo', short: 'Ranged', color: '#5aa2e6', desc: 'Ranged weapon, ammo and quiver rewards' },
};

export const DIET = { 1: 'Meat', 2: 'Fish', 4: 'Cheese', 8: 'Bread', 16: 'Fungus', 32: 'Fruit', 64: 'Raw Meat', 128: 'Raw Fish' };

export const STATUS = {
  'forever-new':     { label: 'Forever · new', cls: 'st-new', confirmed: true },
  'forever-changed': { label: 'Forever · changed', cls: 'st-changed', confirmed: true },
  'forever-listed':  { label: 'Forever data · same as Classic', cls: 'st-listed', confirmed: true },
  'classic':         { label: 'Carried over from Classic', cls: 'st-classic', confirmed: false },
};
