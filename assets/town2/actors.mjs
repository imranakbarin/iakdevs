// New Toy Town: the residents on stage. The simulation says what each resident is DOING (walking a route, stopping to chat, carrying a parcel, waiting on a platform, selling at the
// stall, fishing on the pier, lighting a lamp, sitting at a café table); this module turns that into a figure: the right costume for the weather, a body that faces where it goes,
// legs driven by the distance covered (no skating), and a blend of poses that fade in and out. Nothing here moves a resident on its own: positions come from the simulation.
import * as THREE from 'three';
import {buildPerson, wearFor, dimsOf, identityOf} from './people.mjs';
import {bipedPose, applyPose, newPose, BIPED, newGait, stepGait, stepMix, personStride, turnToward, clamp, TAU, smooth, damp, wrap} from './pose.mjs';
import {heightAt, VENDORS} from './def.mjs';

// what a role carries in the hand on the move (a basket or bag, a lamp pole)
export const HOLD = {fishmonger: 'basket', grocer: 'basket', granny: 'basket', visitor: 'basket', lamplighter: 'lamp', lampgirl: 'lamp', lampboy: 'lamp', post: null};
const HAND = new THREE.Vector3(), HAND2 = new THREE.Vector3(), SOLE = new THREE.Vector3();
// the lowest point of either shoe, as the pose has left it: the figure is lowered or raised by this much so the planted foot is ON the ground (never floating, never sunk in)
function lowestSole(U) { const rig = U.rig, hw = U.dims.hw; let y = 1; for (const [nm, x] of [['footL', hw * .93], ['footR', -hw * .93]]) for (const z of [-.02, .07]) y = Math.min(y, rig.point(nm, x, .004, z, SOLE).y); return y; }
export {lowestSole};

// seats: [{x, z, yaw, table}] provided by the town's café (charm.mjs), each a bench beside a table
export function createActors({scene, sim, season, rods, marketDef, seats = () => [], lite = false}) {
  const people = new Map(), A = new Map();   // people: id -> the stable group the rest of the town knows
  const pose = newPose(BIPED.names), slotOf = new Map();
  sim.residents.forEach((r, i) => {
    const w = new THREE.Group(); w.visible = false; scene.add(w); w.userData = {variants: {}, cur: null, wear: null, rig: null, def: r.def, dims: dimsOf(identityOf(r.def)), identity: identityOf(r.def)};
    people.set(r.id, w);
    A.set(r.id, {id: r.id, r, w, gait: newGait(), mix: {}, yaw: 0, x: r.x, z: r.z, vis: false, seed: (i * 2.399) % 6.283, t: i * 3.1, chatT: 0, lift: 0, cast: 0, castAt: 0, catchUp: false, seatedBefore: false, lastYaw: 0, stride: personStride(w.userData.dims.legLen), stride2: personStride(w.userData.dims.legLen, 1)});
    if (rods.has(r.id)) w.add(rods.get(r.id));
  });
  let shadowsOn = true;
  function ensure(a, wear) {
    const w = a.w, U = w.userData;
    if (U.wear === wear) return;
    let v = U.variants[wear]; if (!v) { v = buildPerson(a.r.def, wear); v.visible = false; v.userData.mesh.castShadow = shadowsOn; w.add(v); U.variants[wear] = v; }
    if (U.cur) U.cur.visible = false; v.visible = true; U.cur = v; U.wear = wear; U.rig = v.userData.rig; U.dims = v.userData.dims; a.gait.px = null;
  }
  const terraceOpen = env => env.rain < .2 && env.season !== 'winter' && env.hour >= 7 && env.hour < 19.5;
  // who sits where: the first free seat, kept until that person leaves
  function assignSeats(env) {
    const all = seats(), open = terraceOpen(env);
    for (const r of sim.residents) {
      const here = open && r.state === 'inside' && r.at === 'cafe' && !r.onPlatform && A.get(r.id).w.userData.identity.role !== 'cafe';   // (the café's own keeper is working, not sitting)
      if (here && !slotOf.has(r.id)) { const taken = new Set(slotOf.values()); const k = all.findIndex((s, i) => !taken.has(i)); if (k >= 0) slotOf.set(r.id, k); }
      else if (!here && slotOf.has(r.id)) slotOf.delete(r.id);
    }
  }
  // c: the world's hand positions for things that are held (a rod, an umbrella, a parcel)
  function handLocal(a, side, out) { const U = a.w.userData, D = U.dims; return U.rig.point('arm' + side + 'l', side === 'L' ? D.xL : D.xR, D.wristY - .012, .004, out); }
  function handWorld(id, side, out) { const a = A.get(id); if (!a || !a.w.visible || !a.w.userData.rig) return null; handLocal(a, side, out); return a.w.localToWorld(out); }
  function parcelAnchor(id, out) { const a = A.get(id); if (!a || !a.w.visible || !a.w.userData.rig) return null; handLocal(a, 'L', HAND); handLocal(a, 'R', HAND2); out.copy(HAND).add(HAND2).multiplyScalar(.5); out.z += .045; out.y += .01; return a.w.localToWorld(out); }
  function update(dt, time, env) {
    assignSeats(env); const all = seats(), seatsNow = [];
    for (const a of A.values()) {
      const r = a.r, w = a.w, slot = slotOf.get(r.id), seat = slot !== undefined ? all[slot] : null, seated = !!seat;
      const vis = r.state === 'walking' || r.onPlatform || seated; w.visible = vis;
      if (!vis) { a.vis = false; a.mix = {}; a.seatedBefore = false; continue; }
      const justShown = !a.vis; a.vis = true; a.t += dt;
      if (justShown) { ensure(a, wearFor(env.season, env.rain)); a.x = r.x; a.z = r.z; a.gait.px = null; a.yaw = Math.atan2(r.tx, r.tz); a.mix = {}; a.catchUp = false; }
      const U = w.userData, D = U.dims, rig = U.rig, role = U.identity.role, walking = r.state === 'walking';
      const onPier = r.at === 'pier' && r.state === 'inside', stall = r.at === 'market' && r.state === 'inside' && sim.market.open && VENDORS.includes(r.id);
      // where the figure is drawn
      let px, pz, yawT, standing = !walking && !seated, y0 = 0;
      if (stall) { const m = marketDef, lx = [-1.12, 0, 1.12][VENDORS.indexOf(r.id)] ?? 0, lz = -.25, c = Math.cos(m.ry), sn = Math.sin(m.ry), sc = m.scale || 1; px = m.x + (lx * c + lz * sn) * sc; pz = m.z + (-lx * sn + lz * c) * sc; yawT = m.ry; y0 = heightAt(m.x, m.z) + .1; }
      else if (seated) { px = seat.x; pz = seat.z; yawT = seat.yaw; y0 = heightAt(seat.x, seat.z); }
      else { px = r.x; pz = r.z; yawT = Math.atan2(r.tx, r.tz); y0 = heightAt(r.x, r.z) + (onPier ? .24 - heightAt(r.x, r.z) : standing ? .19 : 0); }
      if (onPier) yawT = Math.PI / 2;
      const chat = walking && r.pause > 0 && r.look; if (chat) yawT = Math.atan2(r.look.x - r.x, r.look.z - r.z);
      // a seated resident walks to the seat; one who gets up walks back to the route: nobody teleports
      if (a.seatedBefore && !seated) a.catchUp = Math.hypot(r.x - a.x, r.z - a.z) > .05; a.seatedBefore = seated;
      let moving = false;
      if (seated || a.catchUp) { const dx = px - a.x, dz = pz - a.z, d = Math.hypot(dx, dz), sp = (seated ? .5 : 1.25) * dt; if (d > .03) { const s = Math.min(d, sp); a.x += dx / d * s; a.z += dz / d * s; moving = true; if (d > .1) yawT = Math.atan2(dx, dz); } else { a.x = px; a.z = pz; if (!seated) a.catchUp = false; } }
      else { a.x = px; a.z = pz; }
      const arrived = seated && !moving;
      // turning: a figure turns at a natural rate, leaning into the turn
      const before = a.yaw; a.yaw = turnToward(a.yaw, yawT, dt, 9, 10); const yawRate = wrap(a.yaw - before) / Math.max(dt, 1e-4);
      // legs follow the ground covered
      const gt = a.gait; stepGait(gt, dt, a.x, a.z, {stride: a.stride, stride2: a.stride2, v0: .045, run0: .78, run1: 1.1});
      // what the figure is doing
      const want = {}, hold = HOLD[role];
      let look = null, lift = 0, cast = 0;
      if (arrived) want.sit = 1;
      else if (stall) want.vend = 1;
      else if (onPier) { want.fish = 1; const k = ((time + a.seed * 4) % 16) / 1.3; cast = k < 1 ? k : 0; if (r.caught && a.caught !== r.caught) { a.caught = r.caught; a.castAt = time; } }
      else if (standing) want[r.at === 'market' ? 'basket' : 'wait'] = 1;
      else if (walking) {
        if (chat) {
          a.chatT += dt; const lamp = r.look.def && r.look.def.name === 'the lamp';
          if (lamp) { want.lamp = 1; lift = 1; } else { if (a.chatT < .6) want.wave = 1; else if (Math.sin(a.t * .9 + a.seed + (r.id < (r.look.id || '') ? 0 : 3)) > 0) want.talk = 1; else want.listen = 1; }
        } else {
          a.chatT = 0; if (hold) want[hold] = 1; if (r.carrying && !r.def.lamplighter) want.carry = 1;
          if (env.rain > .25 && !hold && !r.carrying) want.umbrella = 1; else if (U.wear === 'winter' && !hold && !r.carrying) want.hood = 1;
        }
      }
      if (!chat) a.chatT = 0;
      stepMix(a.mix, dt, want); a.lift = damp(a.lift, lift, 8, dt); a.cast = cast;
      bipedPose(pose, {gait: gt, mix: a.mix, t: a.t, seed: a.seed, look, lift: a.lift, cast: a.cast, sitDrop: D.legLen - (.2025 + .02)});
      applyPose(rig, pose); rig.update();
      if (rods.has(r.id)) { const rod = rods.get(r.id); rod.visible = onPier; if (onPier) { handLocal(a, 'R', HAND); rod.position.set(HAND.x - 0, HAND.y - .26, HAND.z - .12); rod.rotation.x = -.45 * Math.sin(Math.PI * cast); } }
      // the root: where it stands, which way it faces, how it leans
      const lean = clamp(-.12, -yawRate * .012, .12) * gt.w;
      const seatW = smooth(a.mix.sit || 0); w.position.set(a.x, y0 + pose.drop + (1 - seatW) * -lowestSole(U), a.z); w.rotation.set(0, a.yaw, 0); w.rotation.z = pose.roll + lean; w.rotation.order = 'YXZ';
      gt.t2 = time;
    }
  }
  // a photo studio for tests and screenshots: put one resident, in a chosen costume and pose, anywhere; the next render shows it (the town should be frozen)
  function stage(id, o = {}) {
    const a = A.get(id), w = a.w, wear = o.wear || 'base'; ensure(a, wear); w.visible = true; a.vis = true; const U = w.userData, D = U.dims;
    a.gait.u = o.u ?? .1; a.gait.w = o.walk ? 1 : 0; a.gait.run = o.run ? 1 : 0; a.gait.speed = o.walk ? .5 : 0; a.mix = {...(o.modes || {})}; a.t = o.t ?? 3; a.gait.t = a.t;
    bipedPose(pose, {gait: a.gait, mix: a.mix, t: a.t, seed: a.seed, look: o.look, lift: o.lift ?? 0, cast: o.cast ?? 0, sitDrop: D.legLen - (.2025 + .02)}); applyPose(U.rig, pose); U.rig.update();
    w.position.set(o.x, heightAt(o.x, o.z) + (o.y || 0) + pose.drop + (1 - smooth(a.mix.sit || 0)) * -lowestSole(U), o.z); w.rotation.set(0, o.yaw ?? 0, 0); w.updateMatrixWorld(true); a.staged = true; return a;
  }
  const gaitOf = id => { const a = A.get(id); return a ? {phase: a.gait.u * TAU, amp: a.gait.w, walk: a.gait.w, speed: a.gait.speed, run: a.gait.run} : null; };
  const modeOf = id => { const a = A.get(id); return a ? {...a.mix} : null; };
  return {people, actors: A, update, stage, handWorld, parcelAnchor, gaitOf, modeOf, wearOf: id => A.get(id).w.userData.wear, setShadows(on) { shadowsOn = on; for (const a of A.values()) for (const v of Object.values(a.w.userData.variants)) v.userData.mesh.castShadow = on; }, umbrellaUp: id => { const a = A.get(id); return !!(a && a.w.visible && (a.mix.umbrella || 0) > .5); }};
}
