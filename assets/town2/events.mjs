// New Toy Town: emergencies. Pure: what can go wrong, who comes, and when. The simulation (sim.mjs) runs them.
export const EVENTS = {
  fire: {dur: 75, targets: ['bakery', 'toys', 'cafe', 'post', 'c1', 'c3', 'c5', 'c9', 'c12', 'c13'], responders: ['embers', 'sparky'], police: 'bell', nurse: 'nell', watchers: 3,
    start: b => 'Fire at ' + b + '! The fire engine is on its way', end: b => 'The fire at ' + b + ' is out. Nobody was hurt'},
  lostchild: {dur: 200, children: ['dot', 'dash'], searcher: 'bell', helpers: 3, places: ['farm', 'mill', 'hut', 'school', 'toys', 'bakery', 'barn', 'cafe'],
    start: c => c + ' is missing! Constable Bell is organising a search', end: (c, p) => c + ' is found safe at ' + p},
  storm: {dur: 220, debris: ['cafe', 'bakery', 'school', 'c3', 'c10', 'farm'], crew: ['sparky', 'hay', 'apple', 'ivy'], rain: 160,
    start: () => 'A storm! Branches are down and the harbour is rising', end: () => 'The storm has passed and the streets are clear'}
};
// how long until the next one, in seconds of simulation (about one a day, never in a rush)
export const nextEventIn = rnd => 150 + rnd() * 240;
// which one, given the hour and the weather (a storm needs the day to be wet-ish; nothing at night)
export function pickEvent(rnd, hour, rain, last) {
  if (hour < 8 || hour > 17.5) return null;
  const pool = ['fire', 'lostchild'].concat(rain > .3 ? ['storm', 'storm'] : ['storm']).filter(t => t !== last || rnd() < .25);
  return pool[Math.floor(rnd() * pool.length)];
}
