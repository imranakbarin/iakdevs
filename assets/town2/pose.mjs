// New Toy Town: poses and gaits as plain numbers (no THREE), so they can be tested in Node. A walker's legs are driven by the DISTANCE it has covered (a stride is
// `2 L sin(A) / duty` long: while a foot is on the ground it moves back at exactly the walker's speed, so it never skates), and every other motion is a blend of named
// modes that fade in and out, so stopping, turning, waving, talking, carrying and sitting flow into each other instead of snapping.
// Angles are raw rig angles (see rig.mjs): on a hanging limb a positive rx swings the far end BACKWARDS; on a neck/head a positive rx nods DOWN; +x is the figure's left.
export const TAU = Math.PI * 2;
export const clamp = (a, v, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = x => { x = clamp(0, x, 1); return x * x * (3 - 2 * x); };
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
// turn `cur` towards `target` (angles), at most `rate` radians a second, easing in: returns the new angle
export function turnToward(cur, target, dt, rate = 7, ease = 9) { const d = wrap(target - cur), s = clamp(-rate * dt, d * Math.min(1, ease * dt), rate * dt); return cur + s; }

/* ---------------- the leg cycle ---------------- */
// One leg over a cycle u in [0,1): the stance (foot on the ground, moving back at a steady rate) is the first `duty` of it, then a swing returns the leg forward.
// Returns the forward angle f (+A at the front of the stance, -A at the back) and the lift (0 on the ground, 1 at mid swing).
export function cycle(u, duty, A, out = {f: 0, lift: 0}) {
  u -= Math.floor(u);
  if (u < duty) { out.f = A * (1 - 2 * u / duty); out.lift = 0; }
  else { const s = (u - duty) / (1 - duty); out.f = -A + 2 * A * smooth(s); out.lift = Math.sin(Math.PI * s); }
  return out;
}
// the stride (distance per cycle) at which a foot with a straight leg of length L does not slide
export const strideFor = (L, A, duty) => 2 * L * Math.sin(A) / duty;

export const newGait = () => ({u: 0, speed: 0, w: 0, run: 0, px: null, pz: null, t: 0, dist: 0});
// Advance a gait to the walker's new position. o: {stride, stride2 (when running), v0 (speed below which it stands), run0/run1 (the speeds where a run begins and is full), maxStep}
export function stepGait(g, dt, x, z, o) {
  let d = 0; if (g.px !== null) d = Math.min(o.maxStep ?? .35, Math.hypot(x - g.px, z - g.pz)); g.px = x; g.pz = z; g.t += dt;
  const v = dt > 1e-6 ? d / dt : 0; g.speed += (v - g.speed) * Math.min(1, dt * 9);
  const target = g.speed > (o.v0 ?? .05) ? 1 : 0; g.w += (target - g.w) * Math.min(1, dt * (target ? 9 : 7));
  g.run = o.run0 == null ? 0 : smooth((g.speed - o.run0) / Math.max(1e-6, o.run1 - o.run0));
  g.dist += d; g.u = (g.u + d / lerp(o.stride, o.stride2 ?? o.stride, g.run)) % 1000;
  return g;
}
// fade named modes in and out: want is {mode: 1} for the modes that are on now
export function stepMix(mix, dt, want, rate = 7) { for (const k in want) if (!(k in mix)) mix[k] = 0; for (const k in mix) { mix[k] = damp(mix[k], want[k] ? 1 : 0, rate, dt); if (mix[k] < .002 && !want[k]) mix[k] = 0; } return mix; }

// A pose: a rotation (and shift) for each bone, plus body-level motion the scene applies to the whole figure.
export function newPose(names) { const n = names.length; return {names, index: Object.fromEntries(names.map((k, i) => [k, i])), rot: new Float32Array(n * 3), pos: new Float32Array(n * 3), bob: 0, pitch: 0, roll: 0, drop: 0, yaw: 0}; }
const R = (p, name, x = 0, y = 0, z = 0) => { const i = p.index[name] * 3; p.rot[i] = x; p.rot[i + 1] = y; p.rot[i + 2] = z; };
const M = (p, name, x = 0, y = 0, z = 0) => { const i = p.index[name] * 3; p.pos[i] = x; p.pos[i + 1] = y; p.pos[i + 2] = z; };
const clear = p => { p.rot.fill(0); p.pos.fill(0); p.bob = p.pitch = p.roll = p.drop = p.yaw = 0; };
// out = lerp(out, part, k) for the bones the part names (a partial target {bone: [x,y,z]})
function blend(p, part, k) { if (k <= 0) return; for (const name in part) { const i = p.index[name]; if (i === undefined) continue; const a = part[name]; for (let c = 0; c < 3; c++) p.rot[i * 3 + c] = lerp(p.rot[i * 3 + c], a[c] || 0, k); } }
export function applyPose(rig, p) { for (let i = 0; i < p.names.length; i++) { rig.set(p.names[i], p.rot[i * 3], p.rot[i * 3 + 1], p.rot[i * 3 + 2]); rig.move(p.names[i], p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]); } }

/* ---------------- people ---------------- */
export const BIPED = {
  names: ['pelvis', 'chest', 'head', 'armLu', 'armLl', 'armRu', 'armRl', 'legLu', 'legLl', 'footL', 'legRu', 'legRl', 'footR', 'coat'],
  parents: [null, 'pelvis', 'chest', 'chest', 'armLu', 'chest', 'armRu', 'pelvis', 'legLu', 'legLl', 'pelvis', 'legRu', 'legRl', 'pelvis']
};
// the walking and running legs: amplitude and duty for a walk and a run (a run has a longer, airborne stride)
export const PERSON_GAIT = {A: .44, duty: .62, A2: .72, duty2: .4, K: .95, K2: 1.5};
export const personStride = (leg, run = 0) => lerp(strideFor(leg, PERSON_GAIT.A, PERSON_GAIT.duty), strideFor(leg, PERSON_GAIT.A2, PERSON_GAIT.duty2), run);
const cyc = {f: 0, lift: 0};
function walkPose(p, g, run) {
  const G = PERSON_GAIT, A = lerp(G.A, G.A2, run), duty = lerp(G.duty, G.duty2, run), K = lerp(G.K, G.K2, run), lean = .05 + .2 * run;
  const side = (s, u) => {   // s = +1 left, -1 right
    cycle(u, duty, A, cyc); const th = cyc.f, lift = cyc.lift, knee = .12 + K * lift, L = s > 0 ? 'L' : 'R';
    R(p, 'leg' + L + 'u', -th, 0, s * .03); R(p, 'leg' + L + 'l', knee, 0, 0); R(p, 'foot' + L, th - knee * .9 + .12 * lift, 0, 0);
    const fa = -th * (.8 + .5 * run);   // the arm on this side swings against the leg on this side
    R(p, 'arm' + L + 'u', -fa, 0, s * (.06 + .08 * run)); R(p, 'arm' + L + 'l', -(.25 + .35 * Math.max(0, fa) / A + 1.0 * run), 0, 0);
    return th / A;
  };
  const tl = side(1, g.u); side(-1, g.u + .5);
  R(p, 'pelvis', .02, -.07 * tl, .03 * Math.sin(g.u * TAU)); R(p, 'chest', lean, .1 * tl, 0); R(p, 'head', -lean * .85, -.04 * tl, 0); R(p, 'coat', .1 + .08 * Math.sin(g.u * TAU * 2) + .25 * run, 0, 0);
  p.roll = .03 * Math.sin(g.u * TAU); p.pitch = 0;
  p.bob = (1 - Math.cos(g.u * TAU * 2)) * .5 * (.016 + .014 * run);   // two bounces a stride, the body highest as each leg passes under it
}
function standPose(p, t, seed) {
  R(p, 'pelvis', 0, 0, .02 * Math.sin(t * .7 + seed)); R(p, 'chest', .01 * Math.sin(t * 1.6 + seed), 0, -.02 * Math.sin(t * .7 + seed)); R(p, 'head', .03 * Math.sin(t * .4 + seed), .3 * Math.sin(t * .5 + seed) * Math.sin(t * .23 + seed * 2), 0);
  R(p, 'armLu', .02 * Math.sin(t * 1.6 + seed), 0, .09); R(p, 'armLl', -.18, 0, 0); R(p, 'armRu', .02 * Math.sin(t * 1.6 + seed), 0, -.09); R(p, 'armRl', -.18, 0, 0);
  R(p, 'legLu', 0, 0, .03); R(p, 'legRu', 0, 0, -.03); R(p, 'coat', .03 * Math.sin(t * 1.3), 0, 0);
  p.bob = 0; p.roll = 0; p.pitch = 0;
}
// the gestures: partial targets for the bones they use, each blended in by its own weight (S.mix)
const gesture = {
  wave: (t, S) => ({armRu: [-.2, 0, -1.95], armRl: [-.15, 0, .75 + .5 * Math.sin(t * 10)], head: [-.05, .12, .1], chest: [-.02, .1, -.05]}),
  talk: (t, S) => { const a = Math.sin(t * 5.3 + S.seed), b = Math.sin(t * 3.1 + S.seed * 2); return {armRu: [-.6, 0, -.22], armRl: [-1.0 + .35 * a, 0, .1 * b], armLu: [-.25 + .1 * b, 0, .12], armLl: [-.6 + .2 * b, 0, 0], head: [.04 + .06 * Math.max(0, a), .1 * b, 0]}; },
  listen: (t, S) => ({head: [.06 + .08 * Math.max(0, Math.sin(t * 2.2 + S.seed)), 0, .07], armLu: [-.1, 0, .08], armLl: [-.45, 0, 0]}),
  carry: (t, S) => ({armLu: [-.95, 0, -.12], armLl: [-.9, 0, 0], armRu: [-.95, 0, .12], armRl: [-.9, 0, 0], chest: [-.07, 0, 0], head: [.05, 0, 0]}),
  basket: (t, S) => ({armRu: [-.35, 0, -.3], armRl: [-1.25, 0, 0], armLu: [-.05, 0, .1], armLl: [-.2, 0, 0]}),   // a basket or bag on the right forearm
  fish: (t, S) => { const c = S.cast || 0, sw = Math.sin(c * Math.PI); return {armRu: [-.55 + 1.5 * sw * (c < .5 ? 1 : -.4), 0, -.18], armRl: [-.95 - .3 * sw, 0, 0], armLu: [-.95, 0, .12], armLl: [-.85, 0, 0], chest: [.05 - .1 * sw, 0, 0], head: [.1 + .04 * Math.sin(t * .9 + S.seed), .1 * Math.sin(t * .31), 0]}; },
  vend: (t, S) => { const a = Math.sin(t * 1.2 + S.seed), call = Math.max(0, Math.sin(t * .45 + S.seed * 3)) ** 4; return {armLu: [-.55, 0, .12], armLl: [-1.05, 0, 0], armRu: [-.8 - 1.0 * call, 0, -.3 - .3 * call], armRl: [-.5 + .3 * a - .4 * call, 0, 0], head: [-.02, .35 * Math.sin(t * .6 + S.seed), 0], chest: [0, .08 * a, 0]}; },
  wait: (t, S) => { const ph = (t + S.seed * 3) % 12, watch = smooth((ph - 7) / .6) * (1 - smooth((ph - 10) / .6)), look = smooth((ph - 2) / .8) * (1 - smooth((ph - 5) / .8));
    return {armLu: [-.1 - .5 * watch, 0, .3 * (1 - watch)], armLl: [-.45 - 1.4 * watch, 0, 0], armRu: [-.05, 0, -.3], armRl: [-.5, 0, 0], head: [.28 * watch + .02, .6 * look * (S.seed > 1.5 ? -1 : 1), 0], chest: [0, .2 * look * (S.seed > 1.5 ? -1 : 1), 0]}; },
  sit: (t, S) => { const sip = smooth((((t + S.seed * 4) % 8) - 5.2) / .5) * (1 - smooth((((t + S.seed * 4) % 8) - 6.6) / .5)); return {legLu: [-1.5, 0, .05], legLl: [1.5, 0, 0], footL: [0, 0, 0], legRu: [-1.5, 0, -.05], legRl: [1.5, 0, 0], footR: [0, 0, 0], pelvis: [0, 0, 0],
    armRu: [-.6, 0, -.18], armRl: [-1.15 - .8 * sip, 0, 0], armLu: [-.55, 0, .18], armLl: [-1.2, 0, 0], head: [.06 - .12 * sip, .25 * Math.sin(t * .4 + S.seed), 0]}; },
  lamp: (t, S) => { const k = S.lift || 0; return {armRu: [-.55 - 1.7 * k, 0, -.2], armRl: [-1.0 + .6 * k, 0, 0], armLu: [-.1, 0, .1], head: [-.2 * k, 0, 0]}; },
  umbrella: (t, S) => ({armRu: [-1.05, 0, -.38], armRl: [-1.3, 0, 0], armLu: [-.1, 0, .1], head: [.04, 0, 0]}),
  point: (t, S) => ({armRu: [-1.45, 0, -.2], armRl: [-.15, 0, 0], head: [0, .1, 0]}),
  hood: (t, S) => ({armLu: [-.35, 0, .02], armLl: [-.9, 0, 0], armRu: [-.35, 0, -.02], armRl: [-.9, 0, 0]}),   // hands tucked in against the cold
  sweep: (t, S) => ({armRu: [-.75, 0, -.12], armRl: [-.7, 0, 0], armLu: [-.65, 0, .12], armLl: [-.8, 0, 0], chest: [.12, .25 * Math.sin(t * 3), 0]})
};
export const GESTURES = Object.keys(gesture);
const ORDER = ['hood', 'sit', 'wait', 'vend', 'fish', 'basket', 'carry', 'sweep', 'lamp', 'umbrella', 'point', 'listen', 'talk', 'wave'];   // later ones win
// S: {gait, mix, t, seed, look: {yaw, pitch}, cast, lift}
export function bipedPose(p, S) {
  clear(p); const g = S.gait;
  standPose(p, S.t, S.seed);
  if (g.w > .004) { const keep = new Float32Array(p.rot); walkPose(p, g, g.run); for (let i = 0; i < p.rot.length; i++) p.rot[i] = lerp(keep[i], p.rot[i], g.w); p.bob *= g.w; p.roll *= g.w; }
  for (const m of ORDER) { const w = S.mix[m]; if (w > .003) blend(p, gesture[m](S.t, S), smooth(w)); }
  if (S.mix.sit > .003) p.drop = -(S.sitDrop || .13) * smooth(S.mix.sit);
  // the head follows what the figure is looking at (a person met, a lamp, a train), the body helping a little
  const look = S.look, hi = p.index.head * 3, ci = p.index.chest * 3; if (look) { p.rot[hi + 1] += look.yaw * .7; p.rot[ci + 1] += look.yaw * .3; p.rot[hi] += look.pitch || 0; }
  return p;
}

/* ---------------- four-legged animals ---------------- */
export const quadSkeleton = (extra = []) => ({
  names: ['body', 'neck', 'head', 'jaw', 'earL', 'earR', 'tail1', 'tail2', 'fLu', 'fLl', 'fRu', 'fRl', 'hLu', 'hLl', 'hRu', 'hRl', ...extra],
  parents: [null, 'body', 'neck', 'head', 'head', 'head', 'body', 'tail1', 'body', 'fLu', 'body', 'fRu', 'body', 'hLu', 'body', 'hRu', ...extra.map(() => 'body')]
});
// leg phase offsets [fL, fR, hL, hR] and duty for each gait
export const QUAD_GAITS = {
  walk: {off: [.25, .75, 0, .5], duty: .68}, trot: {off: [0, .5, .5, 0], duty: .5}, bound: {off: [0, .1, .5, .6], duty: .38}
};
// species: leg length, swing amplitudes, knee folds and the head/neck poses
export const QUAD = {
  horse: {leg: .27, A: .5, Atrot: .62, kf: .95, kh: .85, neckGraze: 1.0, headGraze: .5, headRest: .1, neckRest: -.05, nod: .07, tail: .22, sit: false},
  cow: {leg: .17, A: .38, Atrot: .5, kf: .8, kh: .7, neckGraze: .95, headGraze: .35, headRest: .12, neckRest: .1, nod: .06, tail: .3},
  sheep: {leg: .13, A: .42, Atrot: .55, kf: .8, kh: .7, neckGraze: .95, headGraze: .4, headRest: .08, neckRest: .05, nod: .06, tail: .25},
  dog: {leg: .115, A: .5, Atrot: .7, kf: 1.0, kh: .9, neckGraze: .8, headGraze: .4, headRest: .05, neckRest: -.1, nod: .1, tail: .5, sitPitch: -.75, sitDrop: .045},
  cat: {leg: .08, A: .55, Atrot: .75, kf: 1.0, kh: .9, neckGraze: .8, headGraze: .4, headRest: .05, neckRest: -.05, nod: .08, tail: .45, sitPitch: -.8, sitDrop: .035}
};
export const quadStride = (sp, gait) => { const G = QUAD_GAITS[gait], S = QUAD[sp]; return strideFor(S.leg, gait === 'walk' ? S.A : S.Atrot, G.duty) * (gait === 'bound' ? 1.25 : 1); };
export const quadGaitFor = (sp, speed) => { const S = QUAD[sp], v = speed / S.leg; return v > (sp === 'dog' || sp === 'cat' ? 6.5 : 4.4) ? (sp === 'dog' || sp === 'cat' ? 'bound' : 'trot') : v > (sp === 'dog' || sp === 'cat' ? 3.6 : 2.7) ? 'trot' : 'walk'; };
const flick = (t, seed, every = 5) => { const x = (t / every + seed) % 1; return x < .06 ? Math.sin(x / .06 * Math.PI) : 0; };
// S: {gait, gaitName, mix, t, seed, sp}
export function quadPose(p, S) {
  clear(p); const g = S.gait, sp = QUAD[S.sp], t = S.t, seed = S.seed, G = QUAD_GAITS[S.gaitName || 'walk'], A = (S.gaitName || 'walk') === 'walk' ? sp.A : sp.Atrot, mix = S.mix, mv = g.w;
  const gr = smooth(mix.graze || 0), sn = smooth(mix.sniff || 0), si = smooth(mix.sit || 0), li = smooth(mix.lie || 0), sc = smooth(mix.scratch || 0), lk = smooth(mix.look || 0), pw = smooth(mix.paw || 0), gr2 = smooth(mix.groom || 0);
  const legs = ['fL', 'fR', 'hL', 'hR'];
  for (let k = 0; k < 4; k++) {
    const hind = k > 1; cycle(g.u + G.off[k], G.duty, A, cyc); const th = cyc.f, lift = cyc.lift, nm = legs[k];
    // standing: the legs hang straight down (and a standing animal that is not moving keeps all four feet planted); moving, they swing
    R(p, nm + 'u', -th * mv, 0, 0); R(p, nm + 'l', (hind ? -sp.kh : sp.kf) * lift * mv + (hind ? -.05 : .05) * mv, 0, 0);
  }
  const ph = g.u * TAU / (S.gaitName === 'walk' ? 1 : 2), bounce = S.gaitName === 'bound' ? Math.sin(g.u * TAU) : 0;
  const nodU = g.u * TAU;
  R(p, 'neck', sp.neckRest + mv * sp.nod * Math.sin(nodU + 1.2), 0, 0); R(p, 'head', sp.headRest + mv * sp.nod * .8 * Math.sin(nodU + 2.1), 0, 0);
  const wag = Math.sin(g.t * (4 + 5 * mv) + seed * 7);
  R(p, 'tail1', sp.sitPitch ? (-.5 + .15 * Math.sin(g.t * 1.1)) : (.15 + .05 * Math.sin(g.t * 1.1)), sp.tail * wag * (S.sp === 'dog' ? 1.4 : .5) + .15 * Math.sin(nodU) * mv, 0); R(p, 'tail2', 0, sp.tail * .8 * Math.sin(g.t * (4 + 5 * mv) + seed * 7 - .9), 0);
  R(p, 'earL', .0 + .4 * flick(t, seed), 0, .05); R(p, 'earR', .4 * flick(t, seed + .5, 7), 0, -.05);
  p.bob = mv * (S.gaitName === 'trot' ? (1 - Math.cos(g.u * TAU * 2)) * .5 * .012 : S.gaitName === 'bound' ? Math.abs(Math.sin(g.u * TAU)) * .03 : (1 - Math.cos(g.u * TAU * 2)) * .5 * .006); p.pitch = mv * (S.gaitName === 'bound' ? .12 * bounce : .015 * Math.sin(nodU * 2)); p.roll = mv * .012 * Math.sin(nodU);
  // grazing: head right down to the grass, the jaw chewing; sniffing: nose to the ground, quick little nods
  if (gr > 0) { blend(p, {neck: [sp.neckGraze, 0, 0], head: [sp.headGraze, 0, 0], jaw: [.05, 0, 0]}, gr); R(p, 'jaw', .06 + .09 * Math.max(0, Math.sin(t * 7.5 + seed)), 0, 0); const j = p.index.jaw * 3; p.rot[j] = lerp(0, p.rot[j], gr); }
  if (sn > 0) blend(p, {neck: [sp.neckGraze * .85 + .08 * Math.sin(t * 9), 0, 0], head: [sp.headGraze * .8, .15 * Math.sin(t * 2.3), 0], tail1: [-.3, 0, 0]}, sn);
  if (lk > 0) blend(p, {neck: [-.18, (S.look ? S.look.yaw : 0) * .5, 0], head: [-.05, (S.look ? S.look.yaw : 0) * .5, 0], earL: [-.25, 0, .1], earR: [-.25, 0, -.1]}, lk);
  if (pw > 0) blend(p, {fLu: [-.9 + .5 * Math.max(0, Math.sin(t * 6)) , 0, 0], fLl: [1.3 - .5 * Math.max(0, Math.sin(t * 6)), 0, 0], head: [.12, 0, 0]}, pw);
  // sitting (dogs, cats): rump down, front legs straight; lying (cats curled up, dogs asleep, cows resting)
  if (si > 0) { const sp0 = sp.sitPitch || -.7; p.pitch = lerp(p.pitch, sp0, si); p.drop = -(sp.sitDrop || .04) * si; blend(p, {hLu: [-1.35, 0, 0], hLl: [1.45, 0, 0], hRu: [-1.35, 0, 0], hRl: [1.45, 0, 0], fLu: [-sp0, 0, 0], fLl: [0, 0, 0], fRu: [-sp0, 0, 0], fRl: [0, 0, 0], neck: [-sp0 * .9, 0, 0], head: [.05, 0, 0]}, si); }
  if (li > 0) { p.drop = lerp(p.drop, -(sp.leg * .6), li); p.pitch = lerp(p.pitch, 0, li); blend(p, {fLu: [-1.3, 0, .1], fLl: [2.5, 0, 0], fRu: [-1.3, 0, -.1], fRl: [2.5, 0, 0], hLu: [-1.5, 0, .25], hLl: [2.6, 0, 0], hRu: [-1.5, 0, -.25], hRl: [2.6, 0, 0], neck: [(sp.neckRest + .3), 0, 0], head: [.4 + .02 * Math.sin(t * 1.6), 0, 0]}, li); R(p, 'tail1', .1, .6 * li, 0); }
  if (sc > 0) { p.pitch = lerp(p.pitch, sp.sitPitch || -.7, sc); p.drop = -(sp.sitDrop || .04) * sc; blend(p, {hRu: [-1.35, 0, 0], hRl: [1.45, 0, 0], hLu: [-1.9 + .0, 0, .5], hLl: [1.0 + .7 * Math.sin(t * 17), 0, 0], fLu: [.4, 0, 0], fRu: [.4, 0, 0], neck: [.15, 0, .0], head: [.3, 0, .35]}, sc); }
  if (gr2 > 0) { blend(p, {neck: [.55 + .1 * Math.sin(t * 6), 0, .5], head: [.45 + .1 * Math.sin(t * 6 + 1), 0, .3]}, gr2); }
  return p;
}

/* ---------------- birds (hens, chicks, ducks) ---------------- */
export const BIRD = {names: ['body', 'neck', 'head', 'wingL', 'wingR', 'tail', 'legL', 'legR'], parents: [null, 'body', 'neck', 'body', 'body', 'body', 'body', 'body']};
export const BIRDS = {hen: {leg: .065, A: .5, step: .035, peck: 1.15}, rooster: {leg: .07, A: .5, step: .04, peck: 1.1}, chick: {leg: .03, A: .55, step: .018, peck: 1.2}, duck: {leg: .05, A: .5, step: .03, peck: 1.0}};
export const birdStride = sp => strideFor(BIRDS[sp].leg, BIRDS[sp].A, .6);
// S: {gait, mix: {peck, scratch, preen, crow, flap, swim, dabble}, t, seed, sp}
export function birdPose(p, S) {
  clear(p); const g = S.gait, B = BIRDS[S.sp], mv = g.w, t = S.t, mix = S.mix, seed = S.seed, pk = smooth(mix.peck || 0), sc = smooth(mix.scratch || 0), pr = smooth(mix.preen || 0), cr = smooth(mix.crow || 0), sw = smooth(mix.swim || 0), db = smooth(mix.dabble || 0), fl = smooth(mix.flap || 0);
  for (const [s, nm, off] of [[1, 'legL', 0], [-1, 'legR', .5]]) { cycle(g.u + off, .6, B.A, cyc); R(p, nm, -cyc.f * mv, 0, 0); M(p, nm, 0, cyc.lift * B.step * mv * (1 - sw) + .035 * sw, 0); }
  const u = g.u * TAU, duck = S.sp === 'duck';
  // a bird's head moves forward and back as it walks (the neck pumps), and the body rocks from side to side when a duck waddles
  R(p, 'neck', -.05 + mv * .1 * Math.sin(u), 0, 0); M(p, 'head', 0, 0, mv * .016 * Math.sin(u + .6)); R(p, 'head', .0, .12 * Math.sin(t * .5 + seed) * (1 - pk), 0);
  p.roll = mv * (duck ? .14 : .03) * Math.sin(u); p.pitch = mv * .03 * Math.sin(u * 2); p.bob = mv * (1 - Math.cos(u * 2)) * .5 * .006;
  R(p, 'tail', .08 * Math.sin(t * 2.2 + seed) + .06 * mv * Math.sin(u * 2), 0, 0);
  if (pk > 0) { const dip = Math.max(0, Math.sin(t * 5.2 + seed * 3)); blend(p, {neck: [B.peck * (.5 + .5 * dip), 0, 0], head: [.35 * dip, 0, 0], body: [.2 * dip, 0, 0]}, pk); p.pitch += .22 * pk * dip; }
  if (sc > 0) { const k = Math.sin(t * 9 + seed); blend(p, {legL: [.9 * Math.max(0, k) + -.4, 0, 0], legR: [.0, 0, 0], neck: [.4, 0, 0]}, sc); M(p, 'legL', 0, .01 * Math.max(0, k) * 2, 0); p.pitch += .12 * sc; }
  if (pr > 0) blend(p, {neck: [.55, .5 + .1 * Math.sin(t * 5), .5], head: [.5, 0, .3], wingR: [0, 0, -.35]}, pr);
  if (cr > 0) { const k = Math.sin(Math.min(1, ((t * .7 + seed) % 1)) * Math.PI); blend(p, {neck: [-.75, 0, 0], head: [-.4, 0, 0], wingL: [0, 0, .35 * k], wingR: [0, 0, -.35 * k]}, cr); p.pitch -= .25 * cr; }
  if (fl > 0) { const k = Math.sin(t * 24); blend(p, {wingL: [0, 0, .9 + .5 * k], wingR: [0, 0, -.9 - .5 * k]}, fl); }
  if (db > 0) { blend(p, {neck: [1.2, 0, 0], head: [.2, 0, 0]}, db); p.pitch += 1.0 * db; M(p, 'body', 0, -.02 * db, 0); }
  if (sw > 0) { p.bob = lerp(p.bob, .004 * Math.sin(t * 2 + seed), sw); p.roll = lerp(p.roll, .04 * Math.sin(t * 1.7 + seed), sw); p.pitch = lerp(p.pitch, .02 * Math.sin(t * 1.4), sw); }
  return p;
}
