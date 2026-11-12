// New Toy Town: the town chronicle. Pure (no THREE, no DOM). Each day is closed into a small record of what the land did (weather, bloom, bees, honey, eggs, milk,
// catches, the sea, shortages, the stories told); the record becomes a cause chain for the paper ("rain -> the meadow bloomed -> the bees were busy -> ..."), a
// headline, and a hint for the next morning's story. The last two weeks are kept with the saga, so the town remembers.
export const LIMIT = 14;
const num = (v, d = 0) => Number.isFinite(v) ? v : d, r1 = v => Math.round(v * 10) / 10;
export function record(day, season, today, extra = {}) {
  const t = today || {};
  return {day, season, rain: t.secs > 0 ? Math.min(1, num(t.rain) / t.secs) : 0, bloom: num(t.bloomPeak), bees: num(t.beesPeak), honey: r1(num(t.honey)), eggs: r1(num(t.eggs)), milk: r1(num(t.milk)), caught: num(t.caught),
    sea: t.seaLow === undefined ? 1 : num(t.seaLow, 1), swaps: num(t.swaps), meals: num(t.meals), shortages: Object.keys(t.shortages || {}), stories: (extra.stories || []).slice(0, 12), peace: num(extra.peace, .7), deliveries: num(extra.deliveries)};
}
const plural = (n, a, b = a + 's') => n + ' ' + (n === 1 ? a : b);
// The links of the chain, in the order of the food chain; a link is only told if it really happened.
export function chain(rec) {
  if (!rec) return [];
  const out = [], winter = rec.season === 'winter';
  out.push(rec.rain > .35 ? 'Rain fell for much of the day' : rec.rain > .08 ? 'A little rain fell' : winter ? 'A cold, dry day' : 'A dry, bright day');
  out.push(winter ? 'the meadow slept under the cold' : rec.bloom > .8 ? 'the meadow was in full bloom' : rec.bloom > .5 ? 'the meadow stayed green' : 'the meadow was thin and bare');
  if (!winter && rec.bees > .75 && rec.bloom > .5) out.push('the bees were busy' + (rec.honey > .4 ? ' and the hives made ' + plural(r1(rec.honey), 'jar') + ' of honey' : ''));
  else if (winter || rec.bees < .3) out.push('the hives were quiet');
  const farm = []; if (rec.eggs >= 1.5) farm.push('the hens laid ' + plural(Math.round(rec.eggs), 'egg')); if (rec.milk >= 2) farm.push('the cows gave ' + plural(Math.round(rec.milk), 'pail')); if (farm.length) out.push(farm.join(' and '));
  if (rec.swaps > 0) out.push('the bakery ran short ' + (rec.shortages.includes('eggs') ? 'of eggs ' : 'of milk ') + plural(rec.swaps, 'time') + ' and baked plain rolls');
  else if (rec.meals > 2) out.push('the bakery and the café had everything they needed');
  if (rec.caught > 0) out.push('the fishermen landed ' + plural(rec.caught, 'fish', 'fish') + (rec.sea < .4 ? ' and the sea needs a rest' : ''));
  if (rec.stories.length) out.push('the town told ' + plural(rec.stories.length, 'story', 'stories'));
  return out;
}
// Every headline that fits the day, most striking first; `headline` takes the first one that is not the same as yesterday's (so the paper does not say the same thing every morning).
export function headlines(rec) {
  if (!rec) return [];
  const out = [];
  if (rec.swaps >= 3) out.push(rec.shortages.includes('eggs') ? 'Plain rolls at the bakery: the hens are behind' : 'The café is out of milk: the cows are behind');
  if (rec.season !== 'winter' && rec.honey >= 1.2 && rec.bees > .7) out.push('A honey day: the bees had a feast');
  if (rec.sea < .4) out.push('The sea is resting: the fishermen wait for the fish to return');
  if (rec.rain > .4 && rec.bloom > .7) out.push('Rain, then blossom: the town is in bloom');
  if (rec.caught >= 8) out.push('A fine catch at the harbour');
  if (rec.season !== 'winter' && rec.bloom > .85) out.push('The meadow is in full flower');
  if (rec.eggs >= 6 && rec.swaps === 0) out.push('Plenty of eggs: the hens have been busy');
  if (rec.peace > .8) out.push('A peaceful day in Toy Town');
  out.push('An ordinary, good day');
  return out;
}
export function headline(rec, prev) { const all = headlines(rec), before = prev && headlines(prev)[0]; return all.find(h => h !== before) || all[0] || null; }
// What the town does about it tomorrow morning (a story id the director gives a head start) and the line for the paper.
export const FOLLOW = {cowhelp: 'Dot and Dash will help Farmer Hay with the cows', henhelp: 'Dot and Dash will help Farmer Hay with the hens', honeycakes: 'Honey cakes are baked at the café', seaquiet: 'Captain Salt will mend his nets while the sea rests', bloomwalk: 'A walk to see the wildflowers and the bees'};
export function followUp(rec) {
  if (!rec) return null;
  if (rec.swaps >= 2) return rec.shortages.includes('eggs') ? 'henhelp' : 'cowhelp';
  if (rec.season !== 'winter' && rec.honey >= 1.2) return 'honeycakes';
  if (rec.sea < .4) return 'seaquiet';
  if (rec.season !== 'winter' && rec.bloom > .85) return 'bloomwalk';
  return null;
}
export function push(list, rec) { const out = (list || []).filter(r => r.day !== rec.day); out.push(rec); return out.slice(-LIMIT); }
// A saved chronicle may be old or damaged: keep only well-formed records.
export function clean(list) {
  return (Array.isArray(list) ? list : []).filter(r => r && Number.isFinite(r.day) && typeof r.season === 'string').slice(-LIMIT).map(r => ({day: r.day | 0, season: r.season.slice(0, 8), rain: num(r.rain), bloom: num(r.bloom), bees: num(r.bees), honey: num(r.honey), eggs: num(r.eggs), milk: num(r.milk), caught: num(r.caught), sea: num(r.sea, 1), swaps: num(r.swaps), meals: num(r.meals), shortages: (Array.isArray(r.shortages) ? r.shortages : []).filter(x => x === 'eggs' || x === 'milk'), stories: (Array.isArray(r.stories) ? r.stories : []).filter(x => typeof x === 'string').slice(0, 12), peace: num(r.peace, .7), deliveries: num(r.deliveries)}));
}
