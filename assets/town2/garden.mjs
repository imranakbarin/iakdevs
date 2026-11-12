// New Toy Town: the garden plots. Pure (no THREE, no DOM): where the flower beds, the allotment, the greenhouse and the hen yard go.
// Free ground is found once from the town definition: a plot is a disc of open grass clear of every building, road, the railway, the pond,
// the paddock and the pier. The biggest pockets become plots, largest first, none touching another; one near the farm becomes the hen yard.
import {shore, BUILDINGS, POND, PADDOCK, PIER, FLAT, baseHeight, allRoadPoints, trackPts, building, rand} from './def.mjs';

const roadPts = allRoadPoints(), loopPts = trackPts(200);
// How much room there is around (x, z): the distance to the nearest thing in the way (0 or less: blocked).
export function clearance(x, z) {
  if (shore(x, z) > .78) return 0;
  let c = 9;
  for (const b of BUILDINGS) c = Math.min(c, Math.hypot(b.x - x, b.z - z) - b.w * .5 - .1);
  for (const p of roadPts) c = Math.min(c, Math.hypot(p[0] - x, p[1] - z) - .8);
  for (const p of loopPts) c = Math.min(c, Math.hypot(p[0] - x, p[1] - z) - 1.05);
  c = Math.min(c, Math.hypot(x - POND.x, z - POND.z) - POND.r - .55);
  if (x > PADDOCK.x0 - .6 && x < PADDOCK.x1 + .6 && z > PADDOCK.z0 - .6 && z < PADDOCK.z1 + .6) c = Math.min(c, 0);
  if (x > PIER.x0 - 1 && Math.abs(z - PIER.z) < 1.6) c = Math.min(c, 0);
  return c;
}

const KINDS = ['roses', 'tulips', 'lavender', 'allotment', 'sunflowers', 'meadow', 'herbs', 'roses', 'tulips', 'lavender', 'meadow', 'sunflowers', 'herbs', 'allotment'];
function findPlots() {
  const cand = [];
  for (let x = -19; x <= 19; x += .5) for (let z = -15; z <= 15; z += .5) { const c = clearance(x, z); if (c >= 1.0) cand.push({x, z, c}); }
  cand.sort((a, b) => b.c - a.c || a.x - b.x || a.z - b.z);
  const out = [];
  for (const q of cand) { const r = Math.min(1.45, q.c - .2); if (out.length < 14 && out.every(o => Math.hypot(o.x - q.x, o.z - q.z) > (o.r + r) + .25)) out.push({x: q.x, z: q.z, r}); }
  // the hen yard: the plot nearest the farm
  const farm = building('farm');
  let yard = 0; out.forEach((p, i) => { if (Math.hypot(p.x - farm.x, p.z - farm.z) < Math.hypot(out[yard].x - farm.x, out[yard].z - farm.z)) yard = i; });
  // the greenhouse: the largest of the rest
  let glass = -1; out.forEach((p, i) => { if (i !== yard && (glass < 0 || p.r > out[glass].r)) glass = i; });
  let n = 0;
  return out.map((p, i) => ({...p, id: 'plot' + i, kind: i === yard ? 'coop' : i === glass ? 'greenhouse' : KINDS[n++ % KINDS.length], seed: i * 7 + 3}));
}
export const PLOTS = findPlots();
for (const p of PLOTS) FLAT.push({x: p.x, z: p.z, r: p.r, y: baseHeight(p.x, p.z)});
export const COOP = PLOTS.find(p => p.kind === 'coop');
// Is (x, z) inside a plot (grown by `pad`)?
export const inGarden = (x, z, pad = 0) => PLOTS.some(p => Math.hypot(p.x - x, p.z - z) < p.r + pad);

// What grows in a plot in a season: the flower colours, and whether the beds are bare, in bloom or under snow.
export const BLOOM = {
  spring: {roses: ['#f59ac1', '#ffffff'], tulips: ['#e2473b', '#f7c93e', '#f59ac1', '#9a7fe0'], lavender: ['#cdb9f0', '#ffffff'], sunflowers: ['#f7c93e'], meadow: ['#ffffff', '#f7c93e', '#f59ac1'], herbs: ['#ffffff'], allotment: ['#a5d86a']},
  summer: {roses: ['#e2473b', '#f59ac1', '#ffffff', '#f7c93e'], tulips: ['#f28b3c', '#e2473b', '#f7c93e'], lavender: ['#9a7fe0', '#b79af0'], sunflowers: ['#f7c93e', '#f2a93e'], meadow: ['#ffffff', '#f7c93e', '#f59ac1', '#9a7fe0', '#e2473b'], herbs: ['#9a7fe0', '#ffffff'], allotment: ['#e2473b', '#f28b3c']},
  autumn: {roses: ['#b5551f', '#d9822b'], tulips: ['#d9822b', '#b5551f', '#e8b83a'], lavender: ['#8b78b8'], sunflowers: ['#c98a2b'], meadow: ['#e8b83a', '#d9822b', '#b5551f'], herbs: ['#d9822b'], allotment: ['#f28b3c', '#d9822b']},
  winter: {roses: ['#ffffff'], tulips: ['#ffffff'], lavender: ['#d8e4f2'], sunflowers: ['#d8e4f2'], meadow: ['#ffffff'], herbs: ['#ffffff'], allotment: ['#ffffff']}
};
export const plotName = p => ({roses: 'a rose garden', tulips: 'a bed of tulips', lavender: 'a lavender garden', allotment: 'an allotment', sunflowers: 'a patch of sunflowers', meadow: 'a wildflower meadow', herbs: 'a herb garden', coop: 'the hen yard', greenhouse: 'the greenhouse'}[p.kind]);
export const seedOf = p => rand(p.seed * 31 + 7);

// The best open spot (at least `minR` clear on every side) that is not in a plot: where a new lawn can go.
export function freeSpot(minR = 1.2) {
  let best = null;
  for (let x = -19; x <= 19; x += .5) for (let z = -15; z <= 15; z += .5) { const c = clearance(x, z); if (c >= minR && PLOTS.every(p => Math.hypot(p.x - x, p.z - z) > p.r + minR + .3) && (!best || c > best.c)) best = {x, z, c}; }
  return best;
}
