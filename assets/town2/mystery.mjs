// New Toy Town: little mysteries. Pure. A thing goes missing; clues come out over a few minutes, all of them true to what the residents really did (their journals say so too).
export const CASES = [
  {id: 'pie', place: 'cafe', title: 'The prize pie has vanished from the Teapot Café!', item: 'the prize pie'},
  {id: 'top', place: 'toys', title: "Tilly's golden spinning top is missing from the toy shop!", item: 'the golden top'},
  {id: 'stamps', place: 'post', title: 'The rare stamps are gone from the post office!', item: 'the rare stamps'}
];
export const HIDEOUTS = ['school', 'garage', 'barn', 'bakery', 'fire', 'police'];
export const HAT_WORDS = {chef: "a chef's hat", bun: 'a hair bun', helmet: 'a helmet', cap: 'a cap', bow: 'a bow', fire: 'a fire helmet', bonnet: 'a bonnet', flat: 'a flat cap', bobble: 'a bobble hat', straw: 'a straw hat', captain: "a captain's cap", beanie: 'a woolly hat', sun: 'a sun hat', shako: 'a band leader\'s tall red hat'};
export const COAT_WORDS = {cream: 'cream', pink: 'pink', blue: 'blue', red: 'red', purple: 'purple', orange: 'orange', green: 'green', teal: 'teal', brown: 'brown', yellow: 'yellow', sky: 'sky-blue', white: 'white'};
const art = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
export const MAX_WRONG = 2, GAP = 600;
export const pickCase = (n, rnd) => CASES[Math.floor(rnd() * CASES.length) % CASES.length];
export const pickHideout = (place, rnd) => { const l = HIDEOUTS.filter(h => h !== place); return l[Math.floor(rnd() * l.length)]; };
// the clues, each with the seconds after the start at which it comes out. culprit: {coat, hat}; others: [{name, hour}] people who were really at the place
export function cluesFor(culprit, place, hideout, others = []) {
  const out = [{at: 15, text: 'A witness saw somebody in ' + art((COAT_WORDS[culprit.coat] || culprit.coat) + ' coat') + ' leaving ' + place + ' in a hurry.'}, {at: 45, text: 'The thief was wearing ' + (HAT_WORDS[culprit.hat] || 'a hat') + '.'}, {at: 75, text: 'Footprints lead from ' + place + ' towards ' + hideout + '.'}];
  const o = others[0]; out.push({at: 105, text: o ? o.name + ' was at ' + place + ' around ' + o.time + ' too, but says they saw nothing: so they are not the thief.' : 'Nobody else was at ' + place + ' at the time.'});
  out.push({at: 135, text: 'Look in the journals: who went to ' + place + ' and then straight to ' + hideout + '?'}); return out;
}
