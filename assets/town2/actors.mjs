// New Toy Town: the residents on stage. The simulation says what each resident is DOING (walking a route, stopping to chat, carrying a parcel, waiting on a platform, selling at the
// stall, fishing on the pier, lighting a lamp, sitting at a café table); this module turns that into a figure: the right costume for the weather, a body that faces where it goes,
// legs driven by the distance covered (no skating), and a blend of poses that fade in and out. Nothing here moves a resident on its own: positions come from the simulation.
import * as THREE from 'three';
import {buildPerson, wearFor, dimsOf, identityOf} from './people.mjs';
import {sipAt, applyProps, bipedPose, applyPose, newPose, BIPED, newGait, stepGait, stepMix, personStride, turnToward, clamp, TAU, smooth, damp, wrap} from './pose.mjs';
import {heightAt, VENDORS, building} from './def.mjs';
import {Bag} from './build.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {planFor, servicePlan, faceDoor, SERVED_AT} from './activities.mjs';
import {SEAT_TOP} from './charm.mjs';

// what a role carries in the hand on the move (a basket or bag, a lamp pole)
export const HOLD = {fishmonger: 'basket', grocer: 'basket', granny: 'basket', visitor: 'basket', lamplighter: 'lamp', lampgirl: 'lamp', lampboy: 'lamp', post: null};
const HAND = new THREE.Vector3(), HAND2 = new THREE.Vector3(), SOLE = new THREE.Vector3();
// the lowest point of either shoe, as the pose has left it: the figure is lowered or raised by this much so the planted foot is ON the ground (never floating, never sunk in)
function lowestSole(U) { const rig = U.rig, hw = U.dims.hw; let y = 1; for (const [nm, x] of [['footL', hw * .93], ['footR', -hw * .93]]) for (const z of [-.02, .07]) y = Math.min(y, rig.point(nm, x, .004, z, SOLE).y); return y; }
export {lowestSole};

// How a resident sits on a café bench: the hips rest on it and the thighs slope down to where the feet reach the ground (a child's feet dangle)
export function sitParams(D) { const hip = SEAT_TOP + .018, Lt = D.legLen - D.kneeY; return {sitDrop: D.legLen - hip, sitTilt: Math.asin(clamp(0, (hip - D.kneeY) / Lt, .95))}; }
// seats: [{x, z, yaw, table}] provided by the town's café (charm.mjs), each a bench beside a table
// the swinging length of a leg: hip to ankle (the shoe is flat on the ground, so the ground contact moves as this radius swings)
const effLeg = D => D.legLen - D.ankleY - .004;
export function createActors({scene, sim, season, rods, marketDef, seats = () => [], lite = false, platform = () => null, farm = () => null, trainDoor = () => null}) {
  const people = new Map(), A = new Map();   // people: id -> the stable group the rest of the town knows
  const pose = newPose(BIPED.names), slotOf = new Map(), TD = new THREE.Vector3();
  sim.residents.forEach((r, i) => {
    const w = new THREE.Group(); w.visible = false; scene.add(w); w.userData = {variants: {}, cur: null, wear: null, rig: null, def: r.def, dims: dimsOf(identityOf(r.def)), identity: identityOf(r.def)};
    people.set(r.id, w);
    A.set(r.id, {id: r.id, r, w, role: w.userData.identity.role, gait: newGait(), mix: {}, yaw: 0, x: r.x, z: r.z, vis: false, seed: (i * 2.399) % 6.283, t: i * 3.1, chatT: 0, lift: 0, cast: 0, castAt: 0, catchUp: false, wasPlan: false, plan: null, planKind: null, stayKey: null, stayT: 0, seatT: 0, wasSeat: false, phase: null, doorT: 0, prevState: r.state, prevWalking: false, hasBag: false, props: {}, tilt: {}, stride: personStride(effLeg(w.userData.dims)), stride2: personStride(effLeg(w.userData.dims), 1)});
    if (rods.has(r.id)) w.add(rods.get(r.id));
  });
  const focusNow = {feeder: null, visitor: null}, stats = {};   // stats: how many times each kind of thing has happened (for tests)
  const count = k => { stats[k] = (stats[k] || 0) + 1; };
  let shadowsOn = true;
  function ensure(a, wear) {
    const w = a.w, U = w.userData;
    if (U.wear === wear) return;
    let v = U.variants[wear]; if (!v) { v = buildPerson(a.r.def, wear); v.visible = false; v.userData.mesh.castShadow = shadowsOn; w.add(v); U.variants[wear] = v; }
    if (U.cur) U.cur.visible = false; v.visible = true; U.cur = v; U.wear = wear; U.rig = v.userData.rig; U.dims = v.userData.dims; a.gait.px = null;
  }
  const terraceOpen = env => env.rain < .2 && env.season !== 'winter' && env.hour >= 7 && env.hour < 19.5;
  // who sits where: a free seat opposite somebody already sitting (so friends chat across a table), else a free table; kept until that person leaves
  function assignSeats(env) {
    const all = seats(), open = terraceOpen(env);
    for (const r of sim.residents) {
      const here = open && r.state === 'inside' && r.at === 'cafe' && !r.onPlatform && A.get(r.id).role !== 'cafe';   // (the café's own keeper is working, not sitting)
      if (here && !slotOf.has(r.id)) { const taken = new Set(slotOf.values()); let k = all.findIndex((s, i) => !taken.has(i) && taken.has(i ^ 1)); if (k < 0) k = all.findIndex((s, i) => !taken.has(i)); if (k >= 0) slotOf.set(r.id, k); }
      else if (!here && slotOf.has(r.id)) slotOf.delete(r.id);
    }
  }
  // c: the world's hand positions for things that are held (a rod, an umbrella, a parcel)
  function handLocal(a, side, out) { const U = a.w.userData, D = U.dims; return U.rig.point('arm' + side + 'l', side === 'L' ? D.xL : D.xR, D.wristY - .012, .004, out); }
  function handWorld(id, side, out) { const a = A.get(id); if (!a || !a.w.visible || !a.w.userData.rig) return null; handLocal(a, side, out); return a.w.localToWorld(out); }
  function parcelAnchor(id, out) { const a = A.get(id); if (!a || !a.w.visible || !a.w.userData.rig) return null; handLocal(a, 'L', HAND); handLocal(a, 'R', HAND2); out.copy(HAND).add(HAND2).multiplyScalar(.5); out.z += .045; out.y += .01; return a.w.localToWorld(out); }
  // cups on the café tables, once the keeper has brought the tea (one small instanced mesh, drawn only while there is something on a table)
  const ware = (() => { const b = new Bag(); b.cyl(.026, .02, .03, '#fffdf8', {y: 0, seg: 8}); b.cyl(.022, .022, .004, '#8a5a3a', {y: .03, seg: 8}); b.cyl(.04, .04, .006, '#e9e3d6', {y: -.004, seg: 8}); const m = new THREE.InstancedMesh(mergeGeometries(b.parts, false), new THREE.MeshLambertMaterial({vertexColors: true}), 8); m.count = 0; m.visible = false; m.frustumCulled = false; scene.add(m); return m; })();
  const WM = new THREE.Matrix4();
  function updateWare(all) {
    let n = 0; for (const a of A.values()) { const slot = slotOf.get(a.id); if (slot === undefined || !a.wasSeat || a.seatT < SERVED_AT || !a.plan || n >= 8) continue; const s = all[slot], k = .3, x = s.x + (s.table[0] - s.x) * k, z = s.z + (s.table[1] - s.z) * k; ware.setMatrixAt(n++, WM.makeTranslation(x, heightAt(s.table[0], s.table[1]) + .02 + .32 + .035 + .02, z)); }
    ware.count = n; ware.visible = n > 0; ware.instanceMatrix.needsUpdate = true;
  }
  const DOOR_T = 1.15, PRIVATE = /^(c\d+|mushroom|hut|farm|barn|mill)$/;
  const modesOfPlan = (plan, arrived) => arrived ? plan.modes : (plan.walkModes || {});
  function update(dt, time, env) {
    assignSeats(env); const all = seats(), E = {...env, marketOpen: sim.market.open}, ctxBase = {market: marketDef, platform, farm: farm(), trainAt: sim.train.at, school: true};
    // pass 1: how long each stay has lasted, and what each resident should be doing outside right now
    const seatOcc = [];
    for (const a of A.values()) {
      const r = a.r, slot = slotOf.get(r.id), key = r.state === 'inside' ? r.at : null;
      if (key !== a.stayKey) { a.stayKey = key; a.stayT = 0; } else a.stayT += dt;
      a.plan = null;
      if (slot !== undefined) { const s = all[slot]; a.seatT = a.wasSeat ? a.seatT + dt : 0; a.wasSeat = true; seatOcc.push(a); }
      else { a.seatT = 0; a.wasSeat = false; }
    }
    for (const a of A.values()) {
      const r = a.r, slot = slotOf.get(r.id);
      if (slot !== undefined) {
        const s = all[slot], partner = seatOcc.find(o => o !== a && slotOf.get(o.id) === (slot ^ 1)), talking = partner && a.seatT > 4.5 && partner.seatT > 4.5, lead = partner && (r.id < partner.id ? 0 : 3), modes = {sit: 1};
        if (talking) { if (Math.sin(a.t * .7 + a.seed + lead) > 0) modes.talk = 1; else modes.listen = 1; }
        a.plan = {kind: 'cafe', x: s.x, z: s.z, yaw: s.yaw, speed: .5, modes, props: {}, sit: true, text: partner ? 'Chatting over tea at the café' : 'Sitting outside the café with a cup of tea'};
      } else if (a.role === 'cafe' && r.at === 'cafe' && r.state === 'inside') {
        for (const o of seatOcc) { const sp = servicePlan(r, ctxBase, all[slotOf.get(o.id)], o.seatT); if (sp) { a.plan = {...sp, walkModes: {serve: 1}}; break; } }
      } else a.plan = planFor(r, a.role, E, ctxBase, a.stayT);
      const kind = a.plan ? a.plan.kind : null; if (kind !== a.planKind) { if (kind) count(kind); a.planKind = kind; }
    }
    // the market: a vendor hands over the goods while a shopper is paying
    const paying = new Set(); for (const a of A.values()) if (a.plan && a.plan.kind === 'shop' && a.plan.phase === 'pay') paying.add(a.plan.stall);
    let feeder = null, visitor = null;
    // pass 2: put each figure where it is, facing where it is going, doing what it is doing
    for (const a of A.values()) {
      const r = a.r, w = a.w, plan = a.plan, walking = r.state === 'walking', onPierR = r.at === 'pier' && r.state === 'inside';
      const bld = r.state === 'inside' ? building(r.at) : null, shopDoor = bld && bld.door > 0;
      // arrivals and departures that need a moment on stage: the knock at a door, boarding a train
      if (a.vis) {
        if (r.state === 'inside' && !plan && a.prevWalking && !r.onPlatform && shopDoor) { a.phase = 'door'; a.doorT = 0; count('door'); }
        else if (r.state === 'inside' && !plan && a.wasPlan && !r.onPlatform && shopDoor) a.phase = 'return';
        else if (r.state === 'riding' && a.prevState !== 'riding' && trainDoor()) { a.phase = 'board'; a.doorT = 0; count('board'); }
      }
      if (a.phase === 'door') { a.doorT += dt; if (a.doorT > DOOR_T) a.phase = null; }
      if (a.phase && (walking || (plan && a.phase !== 'board'))) a.phase = null;
      const vis = walking || r.onPlatform || !!plan || !!a.phase; w.visible = vis; const prevState = a.prevState;
      a.prevWalking = walking; a.prevState = r.state; a.wasPlan = !!plan;
      if (!vis) { a.vis = false; a.mix = {}; a.catchUp = false; a.phase = null; if (r.state !== 'inside') a.hasBag = false; continue; }
      const justShown = !a.vis; a.vis = true; a.t += dt;
      if (justShown) { ensure(a, wearFor(env.season, env.rain)); a.x = r.x; a.z = r.z; a.gait.px = null; a.yaw = Math.atan2(r.tx, r.tz); a.mix = {}; a.catchUp = false;
        if (prevState === 'riding' && trainDoor()) { const td = trainDoor(); a.x = td.x + Math.sin(a.seed * 7) * .24; a.z = td.z + Math.cos(a.seed * 5) * .24; a.catchUp = true; count('alight'); } }
      const U = w.userData, D = U.dims, rig = U.rig, role = a.role;
      const onPier = onPierR, stall = r.at === 'market' && r.state === 'inside' && sim.market.open && VENDORS.includes(r.id);
      // where the figure is drawn, and how it gets there
      let px, pz, yawT, standing = !walking && !plan && !a.phase, y0 = 0, speed = null, fast = false;
      if (plan) { px = plan.x; pz = plan.z; yawT = plan.yaw; speed = plan.speed; fast = !!plan.fast; y0 = heightAt(px, pz) + (plan.platform ? .19 : 0); standing = false; }
      else if (a.phase === 'board') { const td = trainDoor() || {x: a.x, z: a.z}; px = td.x + Math.sin(a.seed * 7) * .24; pz = td.z + Math.cos(a.seed * 5) * .24; speed = 1.3; yawT = Math.atan2(px - a.x, pz - a.z); y0 = heightAt(px, pz) + .1; }
      else if (a.phase === 'return') { px = r.x; pz = r.z; speed = .95; yawT = Math.atan2(px - a.x, pz - a.z); y0 = heightAt(px, pz); }
      else if (a.phase === 'door') { px = a.x; pz = a.z; speed = 0; yawT = bld ? faceDoor(bld) : a.yaw; y0 = heightAt(px, pz); }
      else if (stall) { const m = marketDef, lx = [-1.12, 0, 1.12][VENDORS.indexOf(r.id)] ?? 0, lz = -.25, c = Math.cos(m.ry), sn = Math.sin(m.ry), sc = m.scale || 1; px = m.x + (lx * c + lz * sn) * sc; pz = m.z + (-lx * sn + lz * c) * sc; yawT = m.ry; y0 = heightAt(m.x, m.z) + .1; }
      else { px = r.x; pz = r.z; yawT = Math.atan2(r.tx, r.tz); y0 = heightAt(r.x, r.z) + (onPier ? .24 - heightAt(r.x, r.z) : standing ? .19 : 0); }
      if (onPier) yawT = Math.PI / 2;
      const chat = walking && r.pause > 0 && r.look && !plan; if (chat) yawT = Math.atan2(r.look.x - r.x, r.look.z - r.z);
      // somebody who has been somewhere else (a table, a stall, a train) walks back to the route: nobody teleports
      if (a.wasPlanFrame && !plan && walking) a.catchUp = Math.hypot(r.x - a.x, r.z - a.z) > .05; a.wasPlanFrame = !!plan;
      let moving = false;
      if (speed !== null || a.catchUp) {
        const dx = px - a.x, dz = pz - a.z, d = Math.hypot(dx, dz), sp = (speed ?? 1.25) * dt;
        if (d > .03) { const st = Math.min(d, sp); a.x += dx / d * st; a.z += dz / d * st; moving = d > .06; if (d > .12 && !fast) yawT = Math.atan2(dx, dz); } else { a.x = px; a.z = pz; if (!plan && walking) a.catchUp = false; }
        if (a.phase === 'board' && (d < .1 || a.doorT > 3)) { a.phase = null; w.visible = false; a.vis = false; continue; }
        if (a.phase === 'board') a.doorT += dt;
        if (a.phase === 'return' && d <= .06) { a.phase = 'door'; a.doorT = 0; }
      } else { a.x = px; a.z = pz; }
      const arrived = !!plan && !moving;
      // turning: a figure turns at a natural rate, leaning into the turn
      const before = a.yaw; a.yaw = turnToward(a.yaw, yawT, dt, 9, 10); const yawRate = wrap(a.yaw - before) / Math.max(dt, 1e-4);
      // legs follow the ground covered
      const gt = a.gait; stepGait(gt, dt, a.x, a.z, {stride: a.stride, stride2: a.stride2, v0: .045, run0: .78, run1: 1.1});
      // what the figure is doing
      const want = {}, hold = HOLD[role];
      let look = null, lift = 0, cast = 0, props = {}, tilt = {};
      if (plan) { Object.assign(want, modesOfPlan(plan, arrived || plan.fast)); props = {...plan.props}; tilt = plan.tilt || {}; if (plan.feeder && arrived) feeder = plan.feeder; if (plan.visitor && arrived) visitor = plan.visitor; if (plan.kind === 'shop' && plan.phase === 'done') a.hasBag = true;
        if (plan.sit && arrived) { if (sipAt(a.t, a.seed) > .35) props.pCup = 1; } }
      else if (a.phase === 'door') want[PRIVATE.test(r.at) || role === 'post' ? 'knock' : 'enter'] = 1;
      else if (stall) { want.vend = 1; const idx = VENDORS.indexOf(r.id); if (paying.has(idx)) { want.give = 1; props.pBag = 1; } }
      else if (onPier) { want.fish = 1; const k = ((time + a.seed * 4) % 16) / 1.3; cast = k < 1 ? k : 0; if (r.caught && a.caught !== r.caught) { a.caught = r.caught; a.castAt = time; } }
      else if (standing) want[r.at === 'market' ? 'basket' : 'wait'] = 1;
      else if (walking) {
        if (chat) {
          a.chatT += dt; const lamp = r.look.def && r.look.def.name === 'the lamp';
          if (lamp) { want.lamp = 1; lift = 1; } else { if (a.chatT < .6) want.wave = 1; else if (Math.sin(a.t * .9 + a.seed + (r.id < (r.look.id || '') ? 0 : 3)) > 0) want.talk = 1; else want.listen = 1; }
        } else {
          a.chatT = 0; if (hold) want[hold] = 1; if (r.carrying && !r.def.lamplighter) want.carry = 1;
          if (a.hasBag && !hold && !r.carrying) { want.basket = 1; props.pBag = 1; }
          else if (env.rain > .25 && !hold && !r.carrying) want.umbrella = 1; else if (U.wear === 'winter' && !hold && !r.carrying) want.hood = 1;
          if (U.identity.age === 'child' && !hold && env.rain < .3 && r.mood && r.mood.score > .75 && !r.carrying && gt.w > .5 && gt.run < .3) want.cheer = Math.sin(a.t * .4 + a.seed) > .7 ? 1 : 0;
        }
      }
      if (!chat) a.chatT = 0;
      if (r.state === 'inside' && !plan && !a.phase && !r.onPlatform) a.hasBag = false;
      stepMix(a.mix, dt, want); a.lift = damp(a.lift, lift, 8, dt); a.cast = cast;
      bipedPose(pose, {gait: gt, mix: a.mix, t: a.t, seed: a.seed, look, lift: a.lift, cast: a.cast, ...sitParams(D)});
      applyPose(rig, pose); applyProps(rig, pose, props, tilt); rig.update();
      if (rods.has(r.id)) { const rod = rods.get(r.id); rod.visible = onPier; if (onPier) { handLocal(a, 'R', HAND); rod.position.set(HAND.x - 0, HAND.y - .26, HAND.z - .12); rod.rotation.x = -.45 * Math.sin(Math.PI * cast); } }
      // the root: where it stands, which way it faces, how it leans
      const lean = clamp(-.12, -yawRate * .012, .12) * gt.w;
      const seatW = smooth(a.mix.sit || 0); w.position.set(a.x, y0 + pose.drop + (1 - seatW) * -lowestSole(U), a.z); w.rotation.set(0, a.yaw, 0); w.rotation.z = pose.roll + lean; w.rotation.order = 'YXZ';
      a.props = props; gt.t2 = time;
    }
    updateWare(all); focusNow.feeder = feeder; focusNow.visitor = visitor;
  }
  // a photo studio for tests and screenshots: put one resident, in a chosen costume and pose, anywhere; the next render shows it (the town should be frozen)
  function stage(id, o = {}) {
    const a = A.get(id), w = a.w, wear = o.wear || 'base'; ensure(a, wear); w.visible = true; a.vis = true; const U = w.userData, D = U.dims;
    a.gait.u = o.u ?? .1; a.gait.w = o.walk ? 1 : 0; a.gait.run = o.run ? 1 : 0; a.gait.speed = o.walk ? .5 : 0; a.mix = {...(o.modes || {})}; a.t = o.t ?? 3; a.gait.t = a.t;
    bipedPose(pose, {gait: a.gait, mix: a.mix, t: a.t, seed: a.seed, look: o.look, lift: o.lift ?? 0, cast: o.cast ?? 0, ...sitParams(D)}); applyPose(U.rig, pose); applyProps(U.rig, pose, o.props || {}, o.tilt || {}); U.rig.update();
    w.position.set(o.x, heightAt(o.x, o.z) + (o.y || 0) + pose.drop + (1 - smooth(a.mix.sit || 0)) * -lowestSole(U), o.z); w.rotation.set(0, o.yaw ?? 0, 0); w.updateMatrixWorld(true); a.staged = true; return a;
  }
  const gaitOf = id => { const a = A.get(id); return a ? {phase: a.gait.u * TAU, amp: a.gait.w, walk: a.gait.w, speed: a.gait.speed, run: a.gait.run} : null; };
  const modeOf = id => { const a = A.get(id); return a ? {...a.mix} : null; };
  return {people, actors: A, update, stage, stats: () => ({...stats}), tableware: () => ware.count, focus: () => focusNow, activityOf: id => { const a = A.get(id); if (!a || !a.vis) return null; if (a.plan) return a.plan.text; if (a.phase === 'door') return 'Arriving at the door'; if (a.phase === 'board') return 'Boarding the train'; return null; }, handWorld, parcelAnchor, gaitOf, modeOf, wearOf: id => A.get(id).w.userData.wear, setShadows(on) { shadowsOn = on; for (const a of A.values()) for (const v of Object.values(a.w.userData.variants)) v.userData.mesh.castShadow = on; }, umbrellaUp: id => { const a = A.get(id); return !!(a && a.w.visible && (a.mix.umbrella || 0) > .5); }};
}
