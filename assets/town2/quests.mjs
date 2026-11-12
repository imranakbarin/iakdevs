// New Toy Town: the daily wishes. Pure. Each morning three residents ask the visitor for something small; each is done by a real action in the town and pays coins into the chest.
// `counters` are what the visitor has done today: {fish, plant, feed, rest, tap: {id: true}, parcel, boat, paper}.
export const WISHES = [
  {kind: 'fish', need: 2, reward: 3, ask: n => `Catch ${n} fish for the café` , who: ['crumb', 'pott', 'moss']},
  {kind: 'fish', need: 4, reward: 5, ask: n => `Catch ${n} fish: the whole street is hungry`, who: ['salt', 'bea', 'chalk']},
  {kind: 'plant', need: 1, reward: 3, ask: () => 'Plant some flowers for the bees', who: ['ivy', 'june', 'hay']},
  {kind: 'feed', need: 1, reward: 3, ask: () => 'Feed the hens for me', who: ['hay', 'dot', 'dash']},
  {kind: 'tap', need: 3, reward: 3, ask: n => `Say hello to ${n} people`, who: ['bell', 'tilly', 'pip']},
  {kind: 'parcel', need: 1, reward: 4, ask: () => 'Send a parcel to a neighbour', who: ['pott', 'sparky', 'moss']},
  {kind: 'boat', need: 1, reward: 4, ask: () => 'Take the harbour boat out', who: ['salt', 'finn', 'gill']},
  {kind: 'paper', need: 1, reward: 2, ask: () => 'Read the paper and tell me the news', who: ['moss', 'bell', 'chalk']},
  {kind: 'rest', need: 1, reward: 3, ask: () => 'Give the sea a day of rest', who: ['finn', 'june', 'gill']}
];
export const newCounters = () => ({fish: 0, plant: 0, feed: 0, rest: 0, tap: {}, parcel: 0, boat: 0, paper: 0});
const hash = n => { let x = Math.imul(n + 1, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };
// Three different kinds of wish for a day (the same day always gives the same wishes). `know` lists the residents that exist.
export function makeDay(day, know = null) {
  const out = [], kinds = new Set(); let k = 0;
  while (out.length < 3 && k < 60) { const w = WISHES[Math.floor(hash(day * 31 + k++) * WISHES.length)]; if (kinds.has(w.kind)) continue; kinds.add(w.kind);
    const pool = know ? w.who.filter(id => know.includes(id)) : w.who, who = (pool.length ? pool : w.who)[Math.floor(hash(day * 17 + k) * (pool.length || w.who.length))];
    out.push({id: 'd' + day + w.kind + out.length, kind: w.kind, who, need: w.need, reward: w.reward, text: w.ask(w.need)}); }
  return out;
}
export function have(w, c) { return w.kind === 'tap' ? Math.min(w.need, Object.keys(c.tap || {}).length) : Math.min(w.need, c[w.kind] || 0); }
export const isDone = (w, c) => have(w, c) >= w.need;
export const note = (c, kind, id) => { if (kind === 'tap') { c.tap[id] = true; } else if (kind in c) c[kind]++; return c; };
