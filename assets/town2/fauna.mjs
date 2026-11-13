// New Toy Town: how the animals behave and how that becomes a pose. Cows and sheep graze, look up, wander to a fresh patch and lie down to chew; ducks paddle, dabble, preen and flap;
// pets rest, sniff, scratch, groom and watch the world; hens peck, scratch, preen (the rooster crows at dawn). The state machines are pure (no THREE); `poseBeast` runs any animal's
// skeleton from them, with leg phase driven by the DISTANCE walked (no skating) and the gait (walk, trot, bound) chosen from the real speed.
import {newPose, quadSkeleton, BIRD, quadPose, birdPose, applyPose, newGait, stepGait, stepMix, quadStride, birdStride, turnToward, wrap, clamp} from './pose.mjs';
import {rand} from './def.mjs';

const TAU = Math.PI * 2;
// speeds (world units a second) at which each animal changes gait: [trot, bound]
export const GAIT_V = {horse: [.58, 9], dog: [.3, .75], cat: [.3, .6], cow: [9, 99], sheep: [9, 99]};
export function gaitFor(sp, speed, prev = 'walk') {
  const [t, bd] = GAIT_V[sp] || [9, 99], h = .93;   // (a little hysteresis, so it does not flicker at the border)
  if (prev === 'bound') return speed > bd * h ? 'bound' : speed > t * h ? 'trot' : 'walk';
  if (prev === 'trot') return speed > bd ? 'bound' : speed > t * h ? 'trot' : 'walk';
  return speed > bd ? 'bound' : speed > t ? 'trot' : 'walk';
}

/* ---------------- the state machines ---------------- */
const pickWeighted = (list, r) => { let tot = 0; for (const [, w] of list) tot += w; let x = r * tot; for (const [k, w] of list) { x -= w; if (x <= 0) return k; } return list[list.length - 1][0]; };
export const newGrazer = (x, z, seed) => ({x, z, hd: rand(seed) * TAU, mode: 'graze', left: 2 + rand(seed + 1) * 6, tx: x, tz: z, seed, speed: 0});
// c: {bounds: {x0, x1, z0, z1}, hour, rnd, speed (walking), creep (grazing)}
export function stepGrazer(s, dt, c) {
  s.left -= dt; const night = c.hour >= 21.5 || c.hour < 5.5, B = c.bounds, m = .3, others = c.others || [], minD = c.minD ?? .42;
  const inside = (x, z) => x > B.x0 + m && x < B.x1 - m && z > B.z0 + m && z < B.z1 - m;
  const nearest = (x, z) => { let d = 9; for (const o of others) if (o !== s) d = Math.min(d, Math.hypot(o.x - x, o.z - z)); return d; };
  const go = mode => { s.mode = mode; s.left = mode === 'graze' ? 5 + c.rnd() * 14 : mode === 'look' ? 2 + c.rnd() * 4 : mode === 'lie' ? 25 + c.rnd() * 40 : 12; };
  // a new patch of grass: of a few tries, the one with the most room round it
  const target = () => { let best = null, bd = -1; for (let k = 0; k < 10; k++) { const x = B.x0 + m + c.rnd() * (B.x1 - B.x0 - 2 * m), z = B.z0 + m + c.rnd() * (B.z1 - B.z0 - 2 * m), d = Math.min(nearest(x, z), 3) + (Math.hypot(x - s.x, z - s.z) > .5 ? .3 : 0); if (d > bd) { bd = d; best = [x, z]; } } s.tx = best[0]; s.tz = best[1]; };
  s.speed = 0;
  if (c.attract && !night) {   // somebody is at the fence: a curious animal gets up if need be, ambles over and watches them
    const tx = clamp(B.x0 + m, c.attract.x, B.x1 - m), tz = clamp(B.z0 + m, c.attract.z, B.z1 - m), off = (s.seed % 3 - 1) * .5, gx = tx + (Math.abs(c.attract.z - tz) > Math.abs(c.attract.x - tx) ? off : 0), gz = tz + (Math.abs(c.attract.z - tz) > Math.abs(c.attract.x - tx) ? 0 : off), dx = gx - s.x, dz = gz - s.z, d = Math.hypot(dx, dz);
    if (d > .12) { s.mode = 'walk'; const st = Math.min(d, c.speed * 1.6 * dt); s.x += dx / d * st; s.z += dz / d * st; s.speed = c.speed; s.hd = turnToward(s.hd, Math.atan2(dx, dz), dt, 2.2, 3); } else { s.mode = 'look'; s.left = 2; s.hd = turnToward(s.hd, Math.atan2(c.attract.x - s.x, c.attract.z - s.z), dt, 2, 3); }
    return separate(s, others, minD, dt, B, m);
  }
  if (s.mode === 'lie') { if (s.left <= 0 && !night) go('look'); return separate(s, others, minD, dt, B, m); }
  if (night && s.mode !== 'walk') { go('lie'); return s; }
  if (s.mode === 'walk') {
    const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
    if (d < .08 || s.left <= 0) go('graze'); else { const st = Math.min(d, c.speed * dt); s.x += dx / d * st; s.z += dz / d * st; s.speed = c.speed; s.hd = turnToward(s.hd, Math.atan2(dx, dz), dt, 2.2, 3); }
  } else if (s.mode === 'graze') {
    const nx = s.x + Math.sin(s.hd) * c.creep * dt, nz = s.z + Math.cos(s.hd) * c.creep * dt;
    if (!inside(nx, nz)) { go('walk'); target(); }   // (at the fence: wander off along it)
    else if (nearest(nx, nz) > minD * .9) { s.x = nx; s.z = nz; s.speed = c.creep; }
    else s.left = Math.min(s.left, 2.5);   // (crowded: stop creeping and soon wander to somewhere roomier; the others' spacing eases them apart)
    if (s.left <= 0) { const nx2 = pickWeighted([['walk', 3], ['look', 2], ['graze', 3], ['lie', night || c.hour > 12 && c.hour < 16 ? 2 : .5]], c.rnd()); go(nx2); if (nx2 === 'walk') target(); }
  } else if (s.mode === 'look') { if (s.left <= 0) { const n = pickWeighted([['graze', 5], ['walk', 2]], c.rnd()); go(n); if (n === 'walk') target(); } }
  return separate(s, others, minD, dt, B, m);
}
// animals never stand on each other: anyone closer than minD is eased apart (and kept inside the fence)
export function separate(s, others, minD, dt, B, m = .3) {
  for (const o of others) { if (o === s) continue; const dx = s.x - o.x, dz = s.z - o.z, d = Math.hypot(dx, dz); if (d < minD) { const k = Math.min(1, dt * 2.5) * (minD - d) * (d > 1e-4 ? 1 / d : 0), ux = d > 1e-4 ? dx : 1, uz = d > 1e-4 ? dz : 0; s.x += ux * k * .5; s.z += uz * k * .5; if (d < 1e-4) s.x += minD * .3 * dt; } }
  s.x = clamp(B.x0 + m * .6, s.x, B.x1 - m * .6); s.z = clamp(B.z0 + m * .6, s.z, B.z1 - m * .6); return s;
}
export const grazerWant = s => s.mode === 'graze' ? {graze: 1} : s.mode === 'look' ? {look: 1} : s.mode === 'lie' ? {lie: 1} : {};

export const newDuck = (x, z, seed) => ({x, z, hd: rand(seed) * TAU, mode: 'swim', left: 1 + rand(seed + 1) * 4, tx: x, tz: z, seed, speed: 0});
export function stepDuck(s, dt, c) {   // c: {cx, cz, rx, rz, rnd, speed}
  s.left -= dt; s.speed = 0; const inPond = (x, z) => ((x - c.cx) / c.rx) ** 2 + ((z - c.cz) / c.rz) ** 2 < 1;
  const go = mode => { s.mode = mode; s.left = mode === 'swim' ? 5 + c.rnd() * 6 : mode === 'dabble' ? 2 + c.rnd() * 1.5 : mode === 'preen' ? 3 + c.rnd() * 3 : mode === 'flap' ? 1.2 : 2 + c.rnd() * 3; };
  const target = () => { for (let k = 0; k < 8; k++) { const a = c.rnd() * TAU, r = Math.sqrt(c.rnd()) * .85, x = c.cx + Math.cos(a) * c.rx * r, z = c.cz + Math.sin(a) * c.rz * r; if (Math.hypot(x - s.x, z - s.z) > .25) { s.tx = x; s.tz = z; return; } } s.tx = c.cx; s.tz = c.cz; };
  if (s.mode === 'swim') {
    if (Math.hypot(s.tx - s.x, s.tz - s.z) < .06 || (s.tx === s.x && s.tz === s.z)) target();
    const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), st = Math.min(d, c.speed * dt), nx = s.x + dx / d * st, nz = s.z + dz / d * st;
    if (inPond(nx, nz)) { s.x = nx; s.z = nz; s.speed = c.speed; s.hd = turnToward(s.hd, Math.atan2(dx, dz), dt, 3.5, 5); } else target();
    if (s.left <= 0) go(pickWeighted([['swim', 3], ['dabble', 3], ['preen', 2], ['idle', 2], ['flap', .5]], c.rnd()));
  } else if (s.left <= 0) go('swim');
  return s;
}
export const duckWant = s => ({swim: 1, ...(s.mode === 'dabble' ? {dabble: 1} : s.mode === 'preen' ? {preen: 1} : s.mode === 'flap' ? {flap: 1} : {})});

// pets and hens keep their movement in wildlife.mjs (wanderStep, followStep); this picks how they carry themselves in each of their states, changing sub-state every few seconds
const slot = (k, time, period) => rand(Math.floor(time / period + k * .37) * 17 + k * 131);
export function petWant(kind, anim, k, time, hour = 12, ownerBusy = false) {
  const r = slot(k, time, 5);
  if (kind === 'dog') {
    if (ownerBusy && (anim === 'sit' || anim === 'idle')) return {play: 1};   // the owner is chatting or playing: bows and bounces, wanting a game
    if (anim === 'sleep') return {lie: 1};
    if (anim === 'sit') return r < .14 ? {scratch: 1} : r < .5 ? {look: 1} : {sit: 1};
    if (anim === 'idle' || anim === 'groom') return r < .25 ? {sniff: 1} : r < .6 ? {look: 1} : {};
    return {};
  }
  if (anim === 'sleep') return {lie: 1};
  if (anim === 'groom') return {sit: 1, groom: 1};
  if (anim === 'sit') return r < .3 ? {sit: 1, groom: 1} : r < .55 ? {sit: 1, look: 1} : {sit: 1};
  if (anim === 'idle') return r < .25 ? {sniff: 1} : r < .55 ? {look: 1} : {};
  return {};
}
export function henWant(kind, anim, k, time, hour = 12) {
  if (anim === 'peck') return {peck: 1};
  if (anim === 'walk' || anim === 'run') return {};
  const r = slot(k, time, 4);
  if (kind === 'rooster') return hour < 8.5 && r < .3 ? {crow: 1} : r < .5 ? {scratch: 1} : r < .62 ? {preen: 1} : {};
  return r < .25 ? {scratch: 1} : r < .42 ? {preen: 1} : {};
}

/* ---------------- posing ---------------- */
// bt: a beast {g (the figure group from animals.mjs), gait, mix, pose, gaitName, t, seed}. Returns the pose (the caller places the group with bob/pitch/roll/drop).
export function createBeast(g, seed = 0) {
  const U = g.userData, bird = ['hen', 'rooster', 'chick', 'duck'].includes(U.kind), names = bird ? BIRD.names : U.rig.names;
  return {g, sp: U.sp, bird, pose: newPose(names), gait: newGait(), mix: {}, gaitName: 'walk', t: seed * 3.7, seed, wheel: 0};
}
export function poseBeast(bt, dt, x, z, want, o = {}) {
  const U = bt.g.userData, scale = U.scale; bt.t += dt;
  if (!bt.bird) bt.gaitName = gaitFor(bt.sp, bt.gait.speed, bt.gaitName);
  const stride = scale * (bt.bird ? birdStride(bt.sp) : quadStride(bt.sp, bt.gaitName));
  stepGait(bt.gait, dt, x, z, {stride, v0: o.v0 ?? .028, maxStep: o.maxStep ?? .5});
  stepMix(bt.mix, dt, want, o.rate ?? 6);
  const S = {gait: bt.gait, gaitName: bt.gaitName, mix: bt.mix, t: bt.t, seed: bt.seed, sp: bt.sp, look: o.look};
  (bt.bird ? birdPose : quadPose)(bt.pose, S);
  const rig = U.rig; applyPose(rig, bt.pose);
  if (U.cart) { const rr = (U.wheel || .14) * scale; bt.wheel = bt.gait.dist / rr; rig.set('wheelL', bt.wheel, 0, 0); rig.set('wheelR', bt.wheel, 0, 0); }
  rig.update(); return bt.pose;
}
// place a posed beast's group: ground height y, heading hd, plus the pose's body motion
export function placeBeast(bt, x, y, z, hd, extraY = 0) { const g = bt.g, p = bt.pose, s = g.userData.scale; g.position.set(x, y + (p.bob + p.drop) * s + extraY, z); g.rotation.set(p.pitch, hd, p.roll, 'YXZ'); }
