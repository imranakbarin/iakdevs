// New Toy Town: the dwarfs' treasure maps. Pure (no THREE, no DOM). A map is five riddles; each answer is a building in town (tap it), and the last is
// Dwarf Rock itself (sail to the landing). Finish a map and the dwarfs' treasure goes in the town chest.
export const MAPS = [
  {id: 'bakers', name: 'The baker\'s map', reward: 40, clues: [
    {at: 'bakery', text: 'Where the loaves are baked before the sun is high, the first mark waits.'},
    {at: 'station', text: 'Where the little train sleeps and wakes, look for the second.'},
    {at: 'mill', text: 'Where the sails go round and round in the wind, the third lies beneath.'},
    {at: 'hut', text: 'Where the fishermen keep their baskets, the fourth is hidden.'},
    {at: 'islet', text: 'Out where the lantern glows by the cave, sail to the end of the map.'}]},
  {id: 'gardeners', name: 'The gardener\'s map', reward: 45, clues: [
    {at: 'school', text: 'Where the children learn their letters, the first mark is chalked.'},
    {at: 'cafe', text: 'Where the teapot steams and the cake is cut, the second is under a saucer.'},
    {at: 'farm', text: 'Where the hens scratch and the milk is poured, the third is in the straw.'},
    {at: 'bandstand', text: 'Where the band plays on a Saturday, the fourth rings out.'},
    {at: 'islet', text: 'Past the dolphins and the whale, land on the rock where the dwarfs dwell.'}]},
  {id: 'captains', name: 'The captain\'s map', reward: 50, clues: [
    {at: 'toys', text: 'Where the spinning top is never still, the first mark spins.'},
    {at: 'post', text: 'Where letters leave and parcels arrive, the second is stamped.'},
    {at: 'fire', text: 'Where the red engine waits for a bell, the third is polished.'},
    {at: 'garage', text: 'Where the spanners hang, the fourth is oily.'},
    {at: 'islet', text: 'Row to the rock at dusk, when the lanterns are lit, for the last.'}]}
];
export const mapOf = i => MAPS[((i % MAPS.length) + MAPS.length) % MAPS.length];
// The hunt: {active, map, step, done, coins}. `answer(h, where)` takes a building id (or 'islet') and says what happened.
export const newHunt = () => ({active: false, map: 0, step: 0, done: 0, coins: 0});
export const start = h => { if (h.active) return false; h.active = true; h.step = 0; return true; };
export const clueNow = h => h.active ? mapOf(h.map).clues[h.step] : null;
export function answer(h, where) {
  if (!h.active) return {ok: false, kind: 'idle'};
  const m = mapOf(h.map), c = m.clues[h.step];
  if (where !== c.at) return {ok: false, kind: 'wrong'};
  h.step++;
  if (h.step >= m.clues.length) { h.active = false; h.done++; h.coins += m.reward; h.map++; return {ok: true, kind: 'done', reward: m.reward, map: m}; }
  return {ok: true, kind: 'next', clue: m.clues[h.step], step: h.step, of: m.clues.length};
}
