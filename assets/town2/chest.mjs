// New Toy Town: the town chest. Pure (no THREE, no DOM). The coins the town earns (fish sold at the stall, golden fish, the dwarfs' gems, gems from the sea)
// go into one chest that is kept between visits; the visitor spends it on things the town can see.
export const UPGRADES = [
  {id: 'bunting', name: 'Bunting along the pier', cost: 15, blurb: 'Little flags strung along the pier'},
  {id: 'pierlights', name: 'Lights along the pier', cost: 25, blurb: 'A row of warm lights, lovely at night'},
  {id: 'fountain', name: 'A fountain on a new lawn', cost: 30, blurb: 'A stone fountain with benches in a quiet corner'},
  {id: 'secondboat', name: 'A second boat', cost: 40, blurb: 'Another boat moored beside the pier'},
  {id: 'beehive', name: 'A beehive for the bees', cost: 20, blurb: 'A hive that keeps the bees from dwindling and makes more honey'},
  {id: 'lighthouse', name: 'A lighthouse on Dwarf Rock', cost: 60, blurb: 'A beam sweeps the sea at night'}
];
export const upgradeOf = id => UPGRADES.find(u => u.id === id);
// state: {earned, spent, bought: [ids]}
export const balance = s => Math.max(0, Math.floor(s.earned) - s.spent);
export function canBuy(s, id) {
  const u = upgradeOf(id); if (!u) return {ok: false, why: 'unknown'};
  if (s.bought.includes(id)) return {ok: false, why: 'owned'};
  const b = balance(s); if (b < u.cost) return {ok: false, why: 'short', need: u.cost - b};
  return {ok: true};
}
// Keep what a stored chest says, if it makes sense.
export function cleanChest(o) {
  if (!o || typeof o !== 'object') return {earned: 0, spent: 0, bought: []};
  const num = v => typeof v === 'number' && v >= 0 && v < 1e6 ? Math.floor(v) : 0, bought = (Array.isArray(o.bought) ? o.bought : []).filter((id, i, a) => typeof id === 'string' && upgradeOf(id) && a.indexOf(id) === i);
  return {earned: num(o.earned), spent: num(o.spent), bought};
}
