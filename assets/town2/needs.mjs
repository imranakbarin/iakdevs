// New Toy Town: what residents need and how they feel. Pure (no THREE, no DOM). Needs run from 0 (fine) to 1 (urgent):
// hunger and tiredness grow while awake, loneliness grows while alone; eating, company and sleep bring them back down.
// A day is 480 s, so the rates are per game hour (20 s) of waking life.
export const RATES = {hunger: 1 / (12 * 20), tired: 1 / (15 * 20), lonely: 1 / (10 * 20)};
const clamp01 = v => Math.max(0, Math.min(1, v));
export const makeNeeds = rnd => ({hunger: rnd() * .4, tired: rnd() * .2, lonely: rnd() * .4, tryAt: 0});
export function stepNeeds(n, dt, ctx) {   // ctx: {asleep, alone}
  if (ctx.asleep) { n.tired = clamp01(n.tired - dt * .05); n.hunger = clamp01(n.hunger + dt * RATES.hunger * .3); return n; }
  n.hunger = clamp01(n.hunger + dt * RATES.hunger); n.tired = clamp01(n.tired + dt * RATES.tired); if (ctx.alone) n.lonely = clamp01(n.lonely + dt * RATES.lonely);
  return n;
}
// where a visit helps: a bite to eat at the bakery, the café or the market; company at the café, the market, the school, the bandstand
export const EATS = ['bakery', 'cafe', 'market'], MEETS = ['cafe', 'market', 'school', 'bandstand', 'toys', 'post'];
export function arrive(n, place, home) {
  if (EATS.includes(place) || place === home) n.hunger = place === home ? n.hunger * .6 : 0;
  if (MEETS.includes(place)) n.lonely = 0; if (place === home) n.tired = clamp01(n.tired - .15);
  return n;
}
export function meet(n) { n.lonely = clamp01(n.lonely - .3); return n; }   // a hello on the pavement
// something worth a trip: 'eat' or 'company' (or null)
export function want(n) { return n.hunger > .75 ? 'eat' : n.lonely > .85 ? 'company' : null; }
export function moodOf(n, rain = 0, sheltered = false) {
  const score = clamp01(1 - (.4 * n.hunger + .25 * n.tired + .3 * n.lonely) - (sheltered ? 0 : .12 * clamp01(rain))), worst = Math.max(n.hunger, n.tired, n.lonely);
  let label = score > .8 ? 'cheerful' : score > .62 ? 'content' : 'grumpy', why = null;
  if (worst > .7) { if (n.hunger === worst) { label = 'hungry'; why = 'could do with something to eat'; } else if (n.lonely === worst) { label = 'lonely'; why = 'would like some company'; } else { label = 'tired'; why = 'ready for a rest'; } }
  return {score, label, why};
}
