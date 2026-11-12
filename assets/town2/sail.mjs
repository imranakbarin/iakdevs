// New Toy Town: sailing the harbour boat out to sea. Pure (no THREE, no DOM): the boat's movement, where it may go, and what it sees.
// The boat steers towards a spot you tap (or turns with the arrow keys), keeps off the beach, the pier and Dwarf Rock (except the landing in front of the cave),
// and the dolphins, the whale and the dwarfs are noticed when it is close enough.
import {PIER, shore} from './def.mjs';
import {ISLET, DOLPHINS, dolphinPose, whalePose, dwarfsOut} from './wildlife.mjs';

const clamp = (a, v, b) => Math.max(a, Math.min(b, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export const MOOR = (() => { let x = PIER.x1 + .1; const z = PIER.z + 1.3; while (shore(x, z) < 1.07 && x < PIER.x1 + 3) x += .1; return {x, z, hd: Math.PI / 2 - .15}; })();   // (just off the end of the pier, in open water: if the shoreline wobbles, a little further out)   // (just off the end of the pier, in open water)
// the sand in front of the cave, in the world (the islet's own frame: out in front of the mouth by 1.7)
export const LANDING = (() => { const x = 0, z = 2.0, f = ISLET.face; return {x: ISLET.x + (x * Math.cos(f) + z * Math.sin(f)) * ISLET.s, z: ISLET.z + (-x * Math.sin(f) + z * Math.cos(f)) * ISLET.s, r: 1.5}; })();
export const SPEED = 3.2, TURN = 1.5, WORLD = {x: 58, z: 46};

// Is (x, z) somewhere a boat cannot go? Land, the pier, the rock (but not its landing) and the edge of the map.
export function blocked(x, z) {
  if (Math.abs(x) > WORLD.x || Math.abs(z) > WORLD.z) return true;
  if (Math.hypot(x - LANDING.x, z - LANDING.z) < LANDING.r) return false;
  if (Math.hypot(x - LANDING.x, z - LANDING.z) < LANDING.r + .5 && Math.hypot(x - ISLET.x, z - ISLET.z) > ISLET.s * 2 + .15 && shore(x, z) >= 1.04) return false;   // (a little apron before the landing, so the last metres of the approach are not caught by the rock's margin)
  if (Math.hypot(x - ISLET.x, z - ISLET.z) < ISLET.s * 2.3 + .3) return true;
  if (x > PIER.x0 - 1 && x < PIER.x1 + .1 && Math.abs(z - PIER.z) < .5) return true;
  return shore(x, z) < 1.04;
}
export const newBoat = () => ({x: MOOR.x, z: MOOR.z, hd: MOOR.hd, v: 0, bumped: 0, target: null});
// Going round the island: if the way ahead is blocked, turn to the nearest heading that is clear (so the boat follows the coast instead of stopping at it).
function clearHeading(b, want, look = 2.4) {
  for (const k of [0, .4, -.4, .8, -.8, 1.3, -1.3, 1.9, -1.9, 2.6, -2.6]) { const h = want + k, px = b.x + Math.sin(h) * look, pz = b.z + Math.cos(h) * look; if (!blocked(px, pz)) return h; }
  return want;
}
// Heading for the landing from behind the rock: go round it first, in hops along a circle, until the cave mouth is in view.
function routeTarget(b, t) {
  if (Math.hypot(t.x - LANDING.x, t.z - LANDING.z) > 2.5) return t;
  const fx = Math.sin(ISLET.face), fz = Math.cos(ISLET.face), bx = b.x - ISLET.x, bz = b.z - ISLET.z, d = Math.hypot(bx, bz) || 1;
  if (d < 4.3 || (bx * fx + bz * fz) / d > .35) return t;
  const ab = Math.atan2(bz, bx), da = wrap(Math.atan2(fz, fx) - ab), a = ab + clamp(da, -.9, .9), R = Math.max(7, d);
  return {x: ISLET.x + Math.cos(a) * R, z: ISLET.z + Math.sin(a) * R};
}
// One step. input: {turn -1..1 (left is negative), thrust 0..1, target {x, z} | null}.
export function stepBoat(b, dt, input = {}) {
  let turn = input.turn || 0, thrust = input.thrust || 0;
  if (input.target) {
    const dx0 = input.target.x - b.x, dz0 = input.target.z - b.z, d = Math.hypot(dx0, dz0), rt = routeTarget(b, input.target), dx = rt.x - b.x, dz = rt.z - b.z;
    if (d < .9) { thrust = 0; input.target = null; b.target = null; } else { const dh = wrap(clearHeading(b, Math.atan2(dx, dz), Math.min(2.4, Math.max(.5, d - .3))) - b.hd);   // (close to the target, look only as far as the target)
    turn = clamp(dh * 2.2, -1, 1); thrust = Math.abs(dh) > 1.4 ? .25 : 1; }
  }
  b.hd = wrap(b.hd + turn * TURN * dt); b.v += (thrust * SPEED - b.v) * Math.min(1, dt * 1.6);
  const nx = b.x + Math.sin(b.hd) * b.v * dt, nz = b.z + Math.cos(b.hd) * b.v * dt;
  const leaving = blocked(b.x, b.z) && shore(nx, nz) >= shore(b.x, b.z);   // (still at the mooring, beside the pier: moving out to sea is allowed)
  if (!blocked(nx, nz) || leaving) { b.x = nx; b.z = nz; b.bumped = 0; } else { b.v *= .3; b.bumped++; if (b.bumped > 60) { b.x = MOOR.x; b.z = MOOR.z; b.v = 0; b.bumped = 0; b.target = null; input.target = null; } }   // (pushed against the shore it slows; stuck for good: back to the mooring)
  return b;
}
// What the boat sees at time t (seconds on the sea clock) on the sim's day and hour: [{kind, key}], each key unique per event so the page can count it once.
//   dolphin: a dolphin leaping within 7; whale: the whale blowing within 13; islet: tied up at the landing (met: the dwarfs are out); 
export function sightings(b, t, day, hour) {
  const out = [];
  for (let i = 0; i < DOLPHINS; i++) { const p = dolphinPose(i, t); if (p.leap > .1 && Math.hypot(p.x - b.x, p.z - b.z) < 7) { out.push({kind: 'dolphin', key: 'd' + Math.floor((t + .45) / 12.5)}); break; } }   // (the pod leaps together: one event per leap)
  const w = whalePose(0, t); if (w.spout > .2 && Math.hypot(w.x - b.x, w.z - b.z) < 13) out.push({kind: 'whale', key: 'w' + Math.floor(t / 34)});
  if (Math.hypot(b.x - LANDING.x, b.z - LANDING.z) < LANDING.r) out.push({kind: 'islet', met: !!dwarfsOut(day, hour), key: 'i' + day + ':' + (dwarfsOut(day, hour) ? 'dw' : 'quiet')});
  return out;
}
