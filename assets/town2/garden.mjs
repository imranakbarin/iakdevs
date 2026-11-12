// New Toy Town: the garden plots. Pure (no THREE, no DOM): where the flower beds, the allotment, the greenhouse and the hen yard go.
// Free ground is found once from the town definition: a plot is a disc of open grass clear of every building, road, the railway, the pond,
// the paddock and the pier. The biggest pockets become plots, largest first, none touching another; one near the farm becomes the hen yard.
import {shore, BUILDINGS, POND, PADDOCK, PIER, FLAT, STATIONS, baseHeight, allRoadPoints, trackPts, loopPt, building, rand} from './def.mjs';

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

// A few big gardens, each of its own kind, spread round the island (the biggest pocket gets the orchard, the smallest the greenhouse); the farm has its own corner and keeps the gardens away.
const KINDS = ['orchard', 'maze', 'water', 'pavilion', 'wild', 'allotment', 'greenhouse'];
function findPlots() {
  const farm = ['barn', 'farm'].map(building), nearFarm = (x, z, pad) => farm.some(b => Math.hypot(b.x - x, b.z - z) < b.w * .5 + pad) || (x > PADDOCK.x0 - pad && x < PADDOCK.x1 + pad && z > PADDOCK.z0 - pad && z < PADDOCK.z1 + pad);
  const halts = STATIONS.map(st => loopPt(st.t)), nearHalt = (x, z, pad) => halts.some(h => Math.hypot(h[0] - x, h[1] - z) < pad), cand = [];   // (a station's platform and its sign reach further in than the clearance sees)
  for (let x = -19; x <= 19; x += .5) for (let z = -15; z <= 15; z += .5) { const c = clearance(x, z); if (c >= 1.2 && !nearFarm(x, z, c + 2.2) && !nearHalt(x, z, c + 2.6)) cand.push({x, z, c}); }
  cand.sort((a, b) => b.c - a.c || a.x - b.x || a.z - b.z);
  const out = [];
  for (const q of cand) { const r = Math.min(2.1, q.c + .1); if (out.length < KINDS.length && out.every(o => Math.hypot(o.x - q.x, o.z - q.z) > o.r + r + 1.8)) out.push({x: q.x, z: q.z, r}); }
  out.sort((a, b) => b.r - a.r);
  const plots = out.map((p, i) => ({...p, id: 'plot' + i, kind: KINDS[i], seed: i * 7 + 3}));
  // the hen yard: the open patch nearest the barn
  const barn = farm[0]; let best = null;
  for (let x = barn.x - 6; x <= barn.x + 6; x += .25) for (let z = barn.z - 6; z <= barn.z + 6; z += .25) {
    const c = clearance(x, z), r = Math.min(1.1, c - .2); if (r < .8 || plots.some(o => Math.hypot(o.x - x, o.z - z) < o.r + r + .3)) continue;
    const d = Math.hypot(x - barn.x, z - barn.z); if (!best || d < best.d) best = {x, z, r, d};
  }
  if (best) plots.push({x: best.x, z: best.z, r: best.r, id: 'plot' + plots.length, kind: 'coop', seed: 99});
  return plots;
}
export const PLOTS = findPlots();
for (const p of PLOTS) FLAT.push({x: p.x, z: p.z, r: p.r, y: baseHeight(p.x, p.z)});
export const COOP = PLOTS.find(p => p.kind === 'coop');
// Is (x, z) inside a plot (grown by `pad`)?
export const inGarden = (x, z, pad = 0) => PLOTS.some(p => Math.hypot(p.x - x, p.z - z) < p.r + pad);

// What grows in a plot in a season: the flower (or blossom, or fruit) colours. Winter is white.
export const BLOOM = {
  spring: {pavilion: ['#f59ac1', '#ffffff', '#f7c3d8'], orchard: ['#fbd0e0', '#ffffff'], water: ['#ffffff', '#f59ac1'], wild: ['#ffffff', '#f7c93e', '#f59ac1', '#9a7fe0'], allotment: ['#a5d86a'], maze: ['#79bf58'], greenhouse: ['#f7c93e']},
  summer: {pavilion: ['#e2473b', '#f59ac1', '#ffffff', '#f7c93e'], orchard: ['#e2473b', '#f2a93e'], water: ['#f59ac1', '#ffffff'], wild: ['#ffffff', '#f7c93e', '#f59ac1', '#9a7fe0', '#e2473b'], allotment: ['#e2473b', '#f28b3c'], maze: ['#79bf58'], greenhouse: ['#e2473b']},
  autumn: {pavilion: ['#b5551f', '#d9822b'], orchard: ['#e8b83a', '#d9822b', '#b5551f'], water: ['#e8b83a', '#d9822b'], wild: ['#e8b83a', '#d9822b', '#b5551f'], allotment: ['#f28b3c', '#d9822b'], maze: ['#b5551f'], greenhouse: ['#d9822b']},
  winter: {pavilion: ['#ffffff'], orchard: ['#ffffff'], water: ['#ffffff'], wild: ['#ffffff'], allotment: ['#ffffff'], maze: ['#ffffff'], greenhouse: ['#ffffff']}
};
export const plotName = p => ({orchard: 'an orchard', maze: 'a hedge maze', water: 'a water garden', pavilion: 'a rose pavilion', wild: 'a wildflower field with beehives', allotment: 'an allotment', greenhouse: 'the greenhouse', coop: 'the hen yard'}[p.kind]);
export const seedOf = p => rand(p.seed * 31 + 7);

// The best open spot (at least `minR` clear on every side) that is not in a plot: where a new lawn can go.
export function freeSpot(minR = 1.2) {
  let best = null;
  for (let x = -19; x <= 19; x += .5) for (let z = -15; z <= 15; z += .5) { const c = clearance(x, z); if (c >= minR && PLOTS.every(p => Math.hypot(p.x - x, p.z - z) > p.r + minR + .3) && (!best || c > best.c)) best = {x, z, c}; }
  return best;
}
