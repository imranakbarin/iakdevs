// New Toy Town: the living land. Pure (no THREE, no DOM). A handful of stocks that feed each other, stepped by the clock and the weather:
//   rain and sun -> meadow -> flowers -> bees -> honey;   meadow -> hens and cows -> eggs and milk (at the farm);   the sea regrows and the fishermen take from it;
//   mice multiply and the cats keep them down.   Nothing can collapse: every stock has a floor, and a shortage is only ever a small story.
// Rates are per second of the sim (a day is 480 s).
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const FLOOR = {meadow: .15, flowers: 0, bees: .08, sea: .12, pests: .05};
export const CAP = {honey: 12, eggs: 14, milk: 12};
const SEASON = {spring: {grow: 1.2, bloom: 1.0, bee: 1}, summer: {grow: 1.0, bloom: 1.2, bee: 1}, autumn: {grow: .55, bloom: .45, bee: .6}, winter: {grow: .12, bloom: 0, bee: .25}};
export const newEco = () => ({meadow: .6, flowers: .5, bees: .5, honey: 2, farm: {eggs: 3, milk: 3}, pantry: {eggs: 4, milk: 4, honey: 1}, sea: .8, pests: .3, rest: false, boost: {flowers: 0, hens: 0}, today: newDay()});
// what happened today (reset at the end of each day; the story director reads it)
export const newDay = () => ({rain: 0, secs: 0, eggs: 0, milk: 0, honey: 0, caught: 0, shortages: {}, swaps: 0, meals: 0, bloomPeak: 0, beesPeak: 0, seaLow: 1});
// ctx: {season, rain 0..1, cats (how many mousers), catches (fish taken since the last step), dayFraction (unused)}
export function stepEco(e, dt, ctx) {
  const S = SEASON[ctx.season] || SEASON.summer, rain = clamp(ctx.rain || 0);
  e.boost.flowers = Math.max(0, e.boost.flowers - dt / 1440); e.boost.hens = Math.max(0, e.boost.hens - dt / 960);   // a planting or a feed counts for about three days
  e.meadow = clamp(e.meadow + dt * (.0016 * S.grow * (.45 + rain * 1.2) * (1 - e.meadow) - .0003 * (S.grow < .3 ? 1.5 : .25) * e.meadow), FLOOR.meadow, 1);
  const bloomTarget = clamp(e.meadow * S.bloom * (rain > .7 ? .85 : 1) + e.boost.flowers, 0, 1); e.flowers += (bloomTarget - e.flowers) * Math.min(1, dt * .004);
  const beeTarget = clamp((.1 + e.flowers * .9) * S.bee * (rain > .6 ? .7 : 1), FLOOR.bees, 1); e.bees += (beeTarget - e.bees) * Math.min(1, dt * .003);
  const honey = e.bees * e.flowers * dt * .004; e.honey = Math.min(CAP.honey, e.honey + honey); e.today.honey += honey;
  const fed = clamp(e.meadow * .8 + e.boost.hens + .15), eggs = fed * dt * .016, milk = clamp(e.meadow * .9 + .1) * dt * .016;
  const e0 = e.farm.eggs, m0 = e.farm.milk; e.farm.eggs = Math.min(CAP.eggs, e.farm.eggs + eggs); e.farm.milk = Math.min(CAP.milk, e.farm.milk + milk); e.today.eggs += e.farm.eggs - e0; e.today.milk += e.farm.milk - m0;
  if (ctx.catches) e.sea = Math.max(FLOOR.sea, e.sea - ctx.catches * .008); e.sea = clamp(e.sea + dt * .00045 * (e.rest ? 2.2 : 1) * (1 - e.sea), FLOOR.sea, 1);
  e.pests = clamp(e.pests + dt * (.0004 - (ctx.cats || 0) * .00022 * (e.pests > .25 ? 1 : .3)), FLOOR.pests, .9);
  const d = e.today; d.rain += rain * dt; d.secs += dt; d.bloomPeak = Math.max(d.bloomPeak, e.flowers); d.beesPeak = Math.max(d.beesPeak, e.bees); d.seaLow = Math.min(d.seaLow, e.sea);
  return e;
}
// eating at the bakery or the café uses the pantry: a bake needs an egg and some milk, a café treat a little honey and milk. Returns {ok, swap, used} where `swap` means
// the cook made do with something plainer (the hunger relief is smaller).
export function eatAt(e, place) {
  const p = e.pantry, d = e.today; d.meals++;
  if (place === 'bakery') { if (p.eggs >= .6 && p.milk >= .25) { p.eggs -= .6; p.milk -= .25; return {ok: true, swap: false}; } d.swaps++; d.shortages[p.eggs < .6 ? 'eggs' : 'milk'] = true; return {ok: true, swap: true, lacks: p.eggs < 1 ? 'eggs' : 'milk'}; }
  if (place === 'cafe') { if (p.milk >= .25) { p.milk -= .25; if (p.honey >= .5) p.honey -= .5; return {ok: true, swap: false}; } d.swaps++; d.shortages.milk = true; return {ok: true, swap: true, lacks: 'milk'}; }
  return {ok: true, swap: false};
}
// The farm cart (or the pick-up) arrives: it hands over what the farm has made, and takes the hive's honey on the way.
export function deliver(e, place, who = 'cart') {
  const p = e.pantry, take = (from, k, max) => { const n = Math.min(max, from[k]); from[k] -= n; p[k] += n; return n; };
  if (place === 'bakery' || place === 'cafe' || place === 'market') { const r = {eggs: take(e.farm, 'eggs', 6), milk: take(e.farm, 'milk', 6)}; r.honey = Math.min(2, e.honey); e.honey -= r.honey; p.honey += r.honey; return r; }
  return null;
}
// The harmony of the land, 0..1.
export const peace = (e, mood = .7) => clamp((e.meadow + e.flowers * .5 + e.bees * .5 + e.sea + (1 - e.pests) + mood * 1.5) / 5);
export function label(v, words = ['bare', 'thin', 'good', 'lush']) { return v < .25 ? words[0] : v < .5 ? words[1] : v < .75 ? words[2] : words[3]; }
export const summary = e => ({
  meadow: label(e.meadow, ['bare', 'thin', 'green', 'lush']), flowers: label(e.flowers, ['no flowers', 'a few flowers', 'in bloom', 'a riot of flowers']), bees: label(e.bees, ['few bees', 'some bees', 'busy bees', 'buzzing']),
  sea: label(e.sea, ['quiet', 'thin', 'good', 'teeming']), pests: label(e.pests, ['no mice', 'a few mice', 'some mice', 'mice about'])
});
