// New Toy Town: elections. Pure. Every third day (days 2, 5, 8 ...) the town votes on a small question from 10:00 to 18:00; the winner changes the town for good.
export const QUESTIONS = [
  {id: 'green', text: 'What should the village green get?', options: [{id: 'fountain', label: 'A fountain'}, {id: 'flowers', label: 'Flower beds'}]},
  {id: 'market', text: 'How long should the market stay open?', options: [{id: 'longer', label: 'Two hours longer'}, {id: 'same', label: 'As it is'}]},
  {id: 'evening', text: 'What should we do on Saturday evenings?', options: [{id: 'concert', label: 'A band concert'}, {id: 'film', label: 'A film night'}]},
  {id: 'harbour', text: 'What should the harbour get?', options: [{id: 'lights', label: 'String lights on the pier'}, {id: 'bench', label: 'A bench to watch the boats'}]}
];
export const VOTE_EVERY = 3, OPENS = 10, CLOSES = 18, YOU = 3;
const hash = s => { let h = 11; for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h; };
// the question for a day (null on days without a vote); it never repeats until all have been asked
export function questionFor(day, asked = []) { if (day < 2 || (day - 2) % VOTE_EVERY !== 0) return null; const left = QUESTIONS.filter(q => !asked.includes(q.id)); return (left.length ? left : QUESTIONS)[((day - 2) / VOTE_EVERY) % (left.length || QUESTIONS.length) | 0]; }
// what a resident prefers: a steady taste of their own (from their name), pushed a little by their mood (cheerful people like the lively option)
export function preference(id, q, mood = .7) { const h = hash(id + q.id); return (h % 100) / 100 + (mood - .7) * .3 > .5 ? 0 : 1; }
// tally: residents [{id, mood}] plus your own vote (an option id or null, worth YOU votes)
export function tally(q, residents, you) {
  const t = Object.fromEntries(q.options.map(o => [o.id, 0])); for (const r of residents) t[q.options[preference(r.id, q, r.mood)].id]++; if (you && t[you] !== undefined) t[you] += YOU;
  const sorted = q.options.map(o => [o.id, t[o.id]]).sort((a, b) => b[1] - a[1]), tie = sorted[0][1] === sorted[1][1];
  return {counts: t, winner: tie ? q.options[0].id : sorted[0][0], tie};
}
export const labelOf = (q, id) => (q.options.find(o => o.id === id) || {}).label || id;
