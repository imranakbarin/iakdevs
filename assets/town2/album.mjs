// New Toy Town: the sticker album. Pure. Each sticker is found by seeing or doing something; found stickers are saved with the saga. `s` is a snapshot of the town (see sim.albumSnapshot).
export const STICKERS = [
  {id: 'dolphin', name: 'A leaping dolphin', hint: 'Watch the sea, or take the boat out', has: s => s.sea.dolphins > 0},
  {id: 'whale', name: 'A whale spout', hint: 'Sail out far on a summer day', has: s => s.sea.whales > 0},
  {id: 'rock', name: 'Dwarf Rock', hint: 'Land the boat on the rock', has: s => s.sea.islet > 0},
  {id: 'dwarf', name: 'A dwarf', hint: 'Land on the rock when the lanterns are out', has: s => s.sea.dwarfs > 0},
  {id: 'gem', name: 'A dwarfs\' gem', hint: 'Look on the harbour beach after a lantern night', has: s => s.wild.gemsFound > 0},
  {id: 'golden', name: 'A golden fish', hint: 'Fish at the pier', has: s => s.fishing.golden > 0},
  {id: 'firstfish', name: 'Your first fish', hint: 'Fish at the pier', has: s => s.fishing.player > 0},
  {id: 'tenfish', name: 'Ten fish', hint: 'Keep fishing', has: s => s.fishing.player >= 10},
  {id: 'treasure', name: 'The dwarfs\' treasure', hint: 'Ask the dwarfs for a map', has: s => s.hunt.done > 0},
  {id: 'festival', name: 'The Lantern Festival', hint: 'Be there on Saturday evening', has: s => s.festival > 0},
  {id: 'upgrade', name: 'A gift to the town', hint: 'Buy something from the chest', has: s => s.chest.bought.length > 0},
  {id: 'hive', name: 'A beehive', hint: 'Buy the beehive', has: s => s.chest.bought.includes('beehive')},
  {id: 'bloom', name: 'The meadow in bloom', hint: 'Plant flowers in spring or summer', has: s => s.eco.flowers >= .85},
  {id: 'honey', name: 'A honey day', hint: 'Let the bees have a feast', has: s => s.eco.honeyDays > 0},
  {id: 'wedding', name: 'A wedding', hint: 'Be patient: friends marry', has: s => s.marriages > 0},
  {id: 'baby', name: 'A new baby', hint: 'Be patient: married couples have babies', has: s => s.babies > 0},
  {id: 'case', name: 'A mystery solved', hint: 'Open the Case tab', has: s => s.mystery > 0},
  {id: 'vote', name: 'A town vote', hint: 'Vote in the town hall', has: s => s.votes > 0},
  {id: 'wish', name: 'A wish granted', hint: 'Grant a daily wish', has: s => s.wishes >= 1},
  {id: 'wish10', name: 'Ten wishes granted', hint: 'Keep helping the neighbours', has: s => s.wishes >= 10},
  {id: 'friends', name: 'Ten friendships', hint: 'Let the town mingle', has: s => s.friends >= 10},
  {id: 'season', name: 'Two seasons seen', hint: 'Use the season buttons at the top', has: s => s.seasons >= 2}
];
export const clean = list => [...new Set((Array.isArray(list) ? list : []).filter(id => typeof id === 'string' && STICKERS.some(s => s.id === id)))];
// Which stickers does the snapshot newly earn?
export function scan(found, s) { return STICKERS.filter(st => !found.includes(st.id) && st.has(s)); }
