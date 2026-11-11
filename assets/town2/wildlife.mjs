// New Toy Town: wildlife. Pure maths (no THREE, no DOM), shared by the scene and the tests.
//  - the pets (dogs that walk with their owners, cats that keep to their house) and the hens in the yard,
//  - dolphins and whales in the sea as pure functions of time (so they are the same however the clock jumps),
//  - the dwarfs: a rocky islet with a cave off the south-east coast, and the evenings when lanterns are seen there.
import {ISLAND, PIER, BUILDINGS, POND, PADDOCK, allRoadPoints, trackPts, building, doorOf, shore, rand} from './def.mjs';
import {COOP} from './garden.mjs';

const TAU = Math.PI * 2;
export const seaPt = (a, k) => [Math.cos(a) * ISLAND.rx * k, Math.sin(a) * ISLAND.rz * k];

/* ---- ground: where an animal on foot may stand ---- */
const CELL = .25, GX0 = -21, GZ0 = -17, NX = Math.ceil(42 / CELL), NZ = Math.ceil(34 / CELL);
let groundCache = null;
export function ground() {
  if (groundCache) return groundCache;
  const blocked = new Uint8Array(NX * NZ), disc = (x, z, r) => {
    const i0 = Math.max(0, Math.floor((x - r - GX0) / CELL)), i1 = Math.min(NX - 1, Math.ceil((x + r - GX0) / CELL)), j0 = Math.max(0, Math.floor((z - r - GZ0) / CELL)), j1 = Math.min(NZ - 1, Math.ceil((z + r - GZ0) / CELL));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (Math.hypot(GX0 + (i + .5) * CELL - x, GZ0 + (j + .5) * CELL - z) <= r) blocked[i * NZ + j] = 1;
  };
  for (const p of allRoadPoints()) disc(p[0], p[1], .5);            // the carriageway (the pavements are free)
  for (const p of trackPts(200)) disc(p[0], p[1], .8);             // the railway
  for (const b of BUILDINGS) disc(b.x, b.z, b.w * .5 * .96);
  disc(POND.x, POND.z, POND.r * 1.25 + .1);
  for (let x = PADDOCK.x0 - .2; x <= PADDOCK.x1 + .2; x += .2) for (let z = PADDOCK.z0 - .2; z <= PADDOCK.z1 + .2; z += .2) disc(x, z, .15);
  for (let x = PIER.x0 - .5; x <= PIER.x1; x += .2) disc(x, PIER.z, .55);
  groundCache = {
    free(x, z) { if (shore(x, z) > .82) return false; const i = Math.floor((x - GX0) / CELL), j = Math.floor((z - GZ0) / CELL); return i >= 0 && j >= 0 && i < NX && j < NZ && !blocked[i * NZ + j]; },
    // the nearest free point to (x, z), found by looking outwards in rings (used to put an animal back on the grass)
    nearest(x, z) { if (this.free(x, z)) return {x, z}; for (let r = .25; r < 4; r += .25) for (let a = 0; a < TAU; a += .4) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (this.free(px, pz)) return {x: px, z: pz}; } return {x, z}; }
  };
  return groundCache;
}

/* ---- who keeps what ---- */
export const PETS = [
  {id: 'biscuit', kind: 'dog', coat: 'brown', name: 'Biscuit', owner: 'moss', blurb: "Granny Moss's old brown dog: slow, loyal and always at her heel"},
  {id: 'pepper', kind: 'dog', coat: 'spotted', name: 'Pepper', owner: 'dot', blurb: "Dot's spotted puppy: chases everything that moves"},
  {id: 'bruno', kind: 'dog', coat: 'grey', name: 'Bruno', owner: 'bell', blurb: "Constable Bell's grey terrier: walks the beat with him"},
  {id: 'marmalade', kind: 'cat', coat: 'ginger', name: 'Marmalade', home: 'c9', blurb: 'A ginger cat who sits on the garden wall all afternoon'},
  {id: 'smudge', kind: 'cat', coat: 'grey', name: 'Smudge', home: 'cafe', blurb: 'The café cat: very fond of the warm doorstep'},
  {id: 'kipper', kind: 'cat', coat: 'tabby', name: 'Kipper', home: 'hut', blurb: "The harbour cat: waits by the fishermen's baskets"},
  {id: 'dusty', kind: 'cat', coat: 'black', name: 'Dusty', home: 'bakery', blurb: 'The bakery mouser, with flour on her paws'}
];
export const HENS = [
  {id: 'rosie', kind: 'hen', coat: 'brown', name: 'Rosie'}, {id: 'daisy', kind: 'hen', coat: 'white', name: 'Daisy'}, {id: 'henny', kind: 'hen', coat: 'speckled', name: 'Henny'},
  {id: 'goldie', kind: 'hen', coat: 'gold', name: 'Goldie'}, {id: 'pearl', kind: 'hen', coat: 'white', name: 'Pearl'}, {id: 'rex', kind: 'rooster', coat: 'red', name: 'Rex the rooster'}
];
export const DOLPHINS = 3;
export const WHALES = [{id: 'whale', size: 1}, {id: 'calf', size: .5}];

// the doorstep of a house: just in front of the door, on the pavement
export function doorstep(id) { const b = building(id), d = doorOf(b), f = [Math.sin(b.ry), Math.cos(b.ry)]; return {x: d.x + f[0] * .3, z: d.z + f[1] * .3}; }

/* ---- walking about ---- */
// An actor on foot: {x, z, hd, tx, tz, wait, anim}. It strolls between random points in a disc, stopping to peck, sit or sniff.
export function makeWalker(x, z, seed) { return {x, z, hd: rand(seed) * TAU, tx: 0, tz: 0, has: false, wait: rand(seed + 1) * 3, anim: 'idle', t: rand(seed + 2) * 10}; }
export function wanderStep(a, dt, rnd, o) {
  a.t += dt;
  if (a.wait > 0) { a.wait -= dt; a.anim = a.idle || 'idle'; return a; }
  if (!a.has || Math.hypot(a.tx - a.x, a.tz - a.z) < .06) {
    if (a.has) { a.has = false; a.wait = o.pause[0] + rnd() * (o.pause[1] - o.pause[0]); a.idle = o.idles[Math.floor(rnd() * o.idles.length)]; a.anim = a.idle; return a; }
    for (let k = 0; k < 14; k++) { const ang = rnd() * TAU, r = Math.sqrt(rnd()) * o.radius, x = o.cx + Math.cos(ang) * r, z = o.cz + Math.sin(ang) * r; if (!o.free || o.free(x, z)) { a.tx = x; a.tz = z; a.has = true; break; } }
    if (!a.has) { a.wait = 1; return a; }
  }
  const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), step = Math.min(d, o.speed * dt), nx = a.x + dx / d * step, nz = a.z + dz / d * step;
  if (o.free && !o.free(nx, nz)) { a.has = false; a.wait = .3; return a; }
  a.x = nx; a.z = nz; a.anim = 'walk';
  let df = Math.atan2(dx, dz) - a.hd; df = Math.atan2(Math.sin(df), Math.cos(df)); a.hd += df * Math.min(1, dt * 6);
  return a;
}
// A dog follows its owner at a polite distance (a little behind), trots when it falls back and sits when the owner stops.
export function followStep(a, dt, target, o = {}) {
  a.t += dt;
  const gap = o.gap ?? .42, dx = target.x - a.x, dz = target.z - a.z, d = Math.hypot(dx, dz);
  if (d > 6) { a.x = target.x - Math.sin(target.hd || 0) * gap; a.z = target.z - Math.cos(target.hd || 0) * gap; a.anim = 'walk'; return a; }   // (left far behind, e.g. the owner took the train: it catches up at once)
  if (d > gap + .12) {
    const sp = Math.min(d - gap, (o.speed ?? .55) * (d > 1.2 ? 1.9 : 1) * dt);
    let nx = a.x + dx / d * sp, nz = a.z + dz / d * sp; if (o.free && !o.free(nx, nz)) { if (o.free(nx, a.z)) nz = a.z; else if (o.free(a.x, nz)) nx = a.x; else { nx = a.x; nz = a.z; } }
    a.x = nx; a.z = nz; a.anim = d > 1.2 ? 'run' : 'walk';
    let df = Math.atan2(dx, dz) - a.hd; df = Math.atan2(Math.sin(df), Math.cos(df)); a.hd += df * Math.min(1, dt * 7);
  } else { a.anim = target.moving ? 'walk' : 'sit'; }
  return a;
}

/* ---- the sea ---- */
// Dolphins: a pod of three swims round the island close to the shore, all leaping together every twelve seconds or so. Returns the pose of dolphin i at time t:
//   x, z, hd (heading), y (height above the swimming level), pitch (nose up is negative), leap (0..1 while in the air), splash (0..1 just after entering the water).
const POD = {k: 1.2, w: .036, period: 12.5, air: 1.7};
export function dolphinPose(i, t) {
  const a = .35 + t * POD.w - i * .028, k = POD.k + (i % 2 ? .025 : -.02), [x, z] = seaPt(a, k), [x2, z2] = seaPt(a + .02, k);
  const ph = ((t + i * .45) % POD.period + POD.period) % POD.period, u = ph / POD.air, hd = Math.atan2(x2 - x, z2 - z);
  if (u < 1) return {x, z, hd, y: Math.sin(u * Math.PI) * 1.05, pitch: -Math.cos(u * Math.PI) * .95, leap: Math.sin(u * Math.PI), splash: 0, dive: 0};
  const since = ph - POD.air;
  return {x, z, hd, y: -.13 + Math.sin(t * 1.9 + i) * .02, pitch: Math.sin(t * 1.9 + i) * .06, leap: 0, splash: since < 1.2 ? 1 - since / 1.2 : 0, dive: 0};
}
// Whales: a mother and her calf cruise slowly far out. Every half minute or so she comes up, blows a spout and sinks with a flick of the tail.
const WHALE = {k: 1.85, w: .0105, period: 34, up: 11};
export function whalePose(i, t) {
  const a = 2.6 + t * WHALE.w - i * .075, k = WHALE.k + i * .06, [x, z] = seaPt(a, k), [x2, z2] = seaPt(a + .01, k), hd = Math.atan2(x2 - x, z2 - z);
  const ph = (((t + i * 2.5) % WHALE.period) + WHALE.period) % WHALE.period, u = ph / WHALE.up;
  if (u >= 1) return {x, z, hd, y: -1.2, pitch: 0, spout: 0, fluke: 0, up: 0};
  const rise = Math.min(1, u / .18), sink = Math.min(1, (1 - u) / .22), vis = Math.min(rise, sink);
  const spoutAt = u > .22 && u < .62 ? Math.sin((u - .22) / .4 * Math.PI) : 0, fluke = u > .8 ? Math.sin((u - .8) / .2 * Math.PI) : 0;
  return {x, z, hd, y: -.95 + vis * .95 + Math.sin(t * .9 + i) * .02, pitch: (1 - rise) * -.18 + (u > .78 ? (u - .78) / .22 * .42 : 0), spout: spoutAt, fluke, up: vis};
}

/* ---- the dwarfs' islet ---- */
const A_ISLET = 52 * Math.PI / 180;
export const ISLET = (() => { const [x, z] = seaPt(A_ISLET, 1.5); return {x, z, s: 1.35, r: 2.4, face: Math.atan2(-.45, .9)}; })();   // the cave mouth looks south-west, towards the camera
export const DWARFS = [
  {id: 'grumble', name: 'Grumble', hat: 'red', beard: '#ececec', tool: 'pick'},
  {id: 'flint', name: 'Flint', hat: 'green', beard: '#c98a4b', tool: 'lantern'},
  {id: 'nib', name: 'Nib', hat: 'blue', beard: '#8a5a3c', tool: 'lantern'}
];
// The evening the dwarfs come out: about half the days, an hour or two at dusk, sometimes into the night. `day` counts from the first morning; hours run 0..24 on the day clock.
export function dwarfWindow(day) {
  if (day < 0 || rand(day * 13 + 5) > .56) return null;
  const from = 17.2 + rand(day * 7 + 1) * 3.6, len = 1.3 + rand(day * 5 + 2) * 2.1;
  return {from, to: from + len, n: 1 + Math.floor(rand(day * 3 + 9) * 3)};
}
// Which dwarfs are out at this hour of this day, and how far into their outing (0..1).
export function dwarfsOut(day, hour) {
  for (const d of [day, day - 1]) {
    const w = dwarfWindow(d); if (!w) continue;
    const h = d === day ? hour : hour + 24;
    if (h >= w.from && h < w.to) return {n: w.n, u: (h - w.from) / (w.to - w.from), day: d};
  }
  return null;
}
// Where dwarf i is, `secs` into an outing that lasts `dur` seconds: in the islet's own frame (x to the right of the cave mouth, z out in front of it).
// They come out of the cave one after another, walk a loop past the lantern post, the boat and the mine cart, stopping at each, and go back in before the end.
const PATH = [[0, .95, 0], [.3, 1.3, 0], [.72, 1.05, 4], [1.1, 1.5, 0], [1.38, 1.4, 5], [.85, 1.85, 0], [0, 1.75, 0], [-.78, 1.5, 6], [-.5, 1.15, 0], [0, .95, 0]];
const SPEED = .2, STOPS = PATH.map(p => p[2]);
const LEG = PATH.slice(1).map((p, k) => Math.hypot(p[0] - PATH[k][0], p[1] - PATH[k][1]) / SPEED), LAP = LEG.reduce((a, b) => a + b, 0) + STOPS.reduce((a, b) => a + b, 0);
export const DWARF_LAP = LAP;
export function dwarfPose(i, secs, dur) {
  const start = 3 + i * 6, e = secs - start;
  if (e < 0 || secs > dur - 3 - i * 2) return {inside: true};
  let t = e % LAP, k = 0;
  for (; k < LEG.length; k++) {
    if (t < STOPS[k]) { const a = PATH[k], b = PATH[k + 1]; return {inside: false, x: a[0], z: a[1], hd: Math.atan2(b[0] - a[0], b[1] - a[1]), pause: true}; }
    t -= STOPS[k];
    if (t < LEG[k]) { const a = PATH[k], b = PATH[k + 1], f = t / LEG[k]; return {inside: false, x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, hd: Math.atan2(b[0] - a[0], b[1] - a[1]), pause: false}; }
    t -= LEG[k];
  }
  return {inside: true};
}
