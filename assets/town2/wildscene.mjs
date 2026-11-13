// New Toy Town: the living nature in the scene. One object owns the gardens, the hen yard, the pets, the dolphins and whales, the dwarfs' islet
// and the butterflies; main.mjs builds it once and calls `update` every frame. The sea creatures and the dwarfs are pure functions of time (wildlife.mjs).
import * as THREE from 'three';
import {ISLAND, BUILDINGS, heightAt, rand} from './def.mjs';
import {buildDolphin, buildWhale, buildDrops, buildButterflies, buildMeadow, buildGardens, buildBorders, buildIslet, buildDwarf} from './wild3d.mjs';
import {PETS, HENS, DOLPHINS, WHALES, ISLET, DWARFS, ground, makeWalker, wanderStep, followStep, doorstep, dolphinPose, whalePose, dwarfsOut, dwarfWindow, dwarfPose} from './wildlife.mjs';
import {PLOTS, COOP, clearance, inGarden} from './garden.mjs';
import {buildDog, buildCat, buildHen, buildChick} from './animals.mjs';
import {createBeast, poseBeast, placeBeast, petWant, henWant} from './fauna.mjs';

const TAU = Math.PI * 2, clamp = (a, v, b) => Math.max(a, Math.min(b, v));
export function createWildlife({scene, sim, people, material, season, lite = false}) {
  const gr = ground(), gardens = buildGardens(season, material), borders = lite ? new THREE.Group() : buildBorders(sim.graph, season, material), islet = buildIslet(material), meadow = buildMeadow(season, lite ? 1 : 800);
  scene.add(gardens, borders, islet, meadow);
  let seed = 100; const rnd = () => rand(seed++);
  const pick = [];   // everything a visitor can tap: {g, describe()}
  const holder = g => { scene.add(g); return g; };
  const ownerName = id => (sim.residents.find(r => r.id === id) || {def: {name: 'its owner'}}).def.name;

  /* ---- hens: half in the coop yard, half scratching about the farmyard by the barn, with a few chicks ---- */
  const house = {x: COOP.x, z: COOP.z - COOP.r * .5}, hensIn = () => sim.hour >= 19.6 || sim.hour < 6.2;
  const henFree = (x, z) => Math.hypot(x - COOP.x, z - COOP.z) < COOP.r * .8 && Math.hypot(x - house.x, z - house.z) > .5 && Math.hypot(x - COOP.x - COOP.r * .4 * 0, z - COOP.z - COOP.r * .4) > .2;
  const farmDoor = doorstep('farm'), farmYard = (() => { let best = {x: farmDoor.x, z: farmDoor.z, c: -1}; for (let r = 1.2; r <= 2.8; r += .2) for (let k = 0; k < 24; k++) { const x = farmDoor.x + Math.cos(k / 24 * TAU) * r, z = farmDoor.z + Math.sin(k / 24 * TAU) * r, c = clearance(x, z) - Math.hypot(x - farmDoor.x, z - farmDoor.z) * .12 - (inGarden(x, z, .6) ? 9 : 0); if (c > best.c) best = {x, z, c}; } return {cx: best.x, cz: best.z, r: Math.max(.7, Math.min(1.3, best.c + .5))}; })();
  const YARDS = [{cx: COOP.x, cz: COOP.z, r: COOP.r * .8, free: henFree}, {...farmYard, free: (x, z) => Math.hypot(x - farmYard.cx, z - farmYard.cz) < farmYard.r && clearance(x, z) > .18 && !inGarden(x, z, .2)}];
  const hens = HENS.map((h, k) => {
    const yard = YARDS[k % 2], g = holder(buildHen(h.kind, h.coat)), w = makeWalker(yard.cx + (rand(k + 5) - .5) * yard.r, yard.cz + (rand(k + 9) - .3) * yard.r * .8, k * 3 + 400);
    const a = {kind: h.kind, def: h, g, w, k, yard, describe: () => ({title: h.name + (h.kind === 'hen' ? ' the hen' : ''), lines: [h.kind === 'hen' ? 'Scratching and pecking about the yard' : 'Struts about the yard and crows at dawn', w.anim === 'peck' ? 'Busy pecking' : 'Out for a stroll', hensIn() ? 'Roosting in the henhouse for the night' : 'Lays eggs for the bakery and the café'].filter(Boolean)})};
    pick.push(a); return a;
  });
  for (let k = 0; k < 4; k++) { const yard = YARDS[1], g = holder(buildChick()), w = makeWalker(yard.cx + (rand(k + 50) - .5) * yard.r, yard.cz + (rand(k + 60) - .5) * yard.r, k * 7 + 700), a = {kind: 'chick', def: {name: 'A chick'}, g, w, k: k + 20, yard, describe: () => ({title: 'A chick', lines: ['Peeping after the hens', w.anim === 'peck' ? 'Busy pecking' : 'Out for a scamper']})}; pick.push(a); hens.push(a); }

  /* ---- dogs and cats ---- */
  const pets = PETS.map((p, k) => {
    const start = p.kind === 'dog' ? doorstep((sim.residents.find(r => r.id === p.owner) || {def: {home: 'c1'}}).def.home) : doorstep(p.home);
    const g = holder((p.kind === 'dog' ? buildDog(p.coat) : buildCat(p.coat))), w = makeWalker(start.x, start.z, k * 5 + 900);
    const a = {kind: p.kind, def: p, g, w, k, still: 0, lx: start.x, lz: start.z, describe() {
      const s = w.anim, asleep = s === 'sleep';
      return {title: p.name, lines: [p.blurb, p.kind === 'dog' ? (asleep ? 'Asleep at ' + ownerName(p.owner).split(' ')[0] + "'s door" : s === 'sit' ? 'Sitting and waiting for ' + ownerName(p.owner) : s === 'run' ? 'Bounding after ' + ownerName(p.owner) : 'Trotting along with ' + ownerName(p.owner)) : (asleep ? 'Curled up asleep on the doorstep' : s === 'sit' ? 'Sitting and watching the world go by' : s === 'groom' ? 'Washing a paw' : 'Out for a stroll')]};
    }};
    pick.push(a); return a;
  });
  function moveToward(w, dt, p, speed) { const dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz); if (d < .05) return d; const st = Math.min(d, speed * dt); w.x += dx / d * st; w.z += dz / d * st; let df = Math.atan2(dx, dz) - w.hd; df = Math.atan2(Math.sin(df), Math.cos(df)); w.hd += df * Math.min(1, dt * 6); w.anim = 'walk'; return d; }
  function updateDog(a, dt, ctx) {
    const o = sim.residents.find(r => r.id === a.def.owner), og = people.get(a.def.owner), w = a.w;
    let target, sleeping = false;
    if (og && og.visible && (o.state === 'walking' || o.onPlatform)) target = {x: og.position.x, z: og.position.z, hd: og.rotation.y, moving: o.state === 'walking'};
    else if (o.state === 'riding') target = {x: w.x, z: w.z, hd: w.hd, moving: false};
    else { const here = BUILDINGS.some(b => b.id === o.at && b.door > 0) ? o.at : o.def.home, d = doorstep(here); target = {x: d.x, z: d.z, hd: w.hd, moving: false}; sleeping = (ctx.hour >= 21 || ctx.hour < 6) && here === o.def.home; }
    followStep(w, dt, target, {free: gr.free, speed: .5});
    if (sleeping && Math.hypot(target.x - w.x, target.z - w.z) < .3) w.anim = 'sleep';
    // stuck behind a building? go round it the quick way: stand at the nearest free spot to the target
    const moved = Math.hypot(w.x - a.lx, w.z - a.lz); a.lx = w.x; a.lz = w.z; a.still = moved < .0006 && Math.hypot(target.x - w.x, target.z - w.z) > .9 ? a.still + dt : 0;
    if (a.still > 2.5) { const f = gr.nearest(target.x - Math.sin(target.hd || 0) * .5, target.z - Math.cos(target.hd || 0) * .5); w.x = f.x; w.z = f.z; a.still = 0; }
  }
  function updateCat(a, dt, ctx) {
    const home = doorstep(a.def.home), w = a.w, night = ctx.hour >= 21 || ctx.hour < 6.2, wet = ctx.rain > .3;
    if (night || wet) { const d = Math.hypot(home.x - w.x, home.z - w.z); if (d > .12) moveToward(w, dt, home, .35); else w.anim = night ? 'sleep' : 'sit'; return; }
    wanderStep(w, dt, rnd, {cx: home.x, cz: home.z, radius: 2.6, free: gr.free, speed: .26, pause: [4, 14], idles: ['sit', 'sit', 'groom', 'idle']});
  }
  function updateHen(a, dt, ctx) {
    const w = a.w, y = a.yard; a.g.visible = !hensIn() && ctx.dist < 110 && lifeOn && !(lite && a.kind === 'chick'); if (hensIn()) return;   // (the light version for TVs leaves the chicks out: every animal is a draw call)
    wanderStep(w, dt, rnd, {cx: y.cx, cz: y.cz, radius: y.r, free: y.free, speed: a.kind === 'rooster' ? .26 : a.kind === 'chick' ? .24 : .22, pause: a.kind === 'chick' ? [.4, 2.5] : [1, 4.5], idles: ['peck', 'peck', 'peck', 'idle']});
  }
  // a pet or hen: its movement comes from wildlife.mjs; how it carries itself (walk, trot, bound, sit, scratch, peck, preen...) comes from its state and fauna.mjs
  let curHour = 12;
  const poseOn = (a, time, dt) => {
    const w = a.w, g = a.g, bt = a.bt || (a.bt = createBeast(g, a.k + 1));
    const want = a.kind === 'dog' || a.kind === 'cat' ? petWant(a.kind, w.anim, a.k, time, curHour) : henWant(a.kind === 'chick' ? 'hen' : a.kind, w.anim, a.k, time, curHour);
    poseBeast(bt, dt, w.x, w.z, want, {v0: .03}); placeBeast(bt, w.x, heightAt(w.x, w.z), w.z, w.hd);
  };

  /* ---- the sea ---- */
  const dolphins = Array.from({length: DOLPHINS}, (_, i) => { const g = holder(buildDolphin(material)); const a = {kind: 'dolphin', g, i, describe: () => ({title: 'A dolphin', lines: ['One of a pod of three, leaping together out past the shallows', 'They come round the island every few minutes']})}; pick.push(a); return a; });
  const whales = WHALES.map((wd, i) => { const g = holder(buildWhale(material)); g.scale.setScalar(wd.size); const a = {kind: 'whale', g, i, wd, describe: () => ({title: i ? 'A whale calf' : 'A humpback whale', lines: [i ? 'Stays close to its mother' : 'She comes up to blow every half minute, then dives with a flick of her tail', 'Far out beyond the island']})}; pick.push(a); return a; });
  const drops = buildDrops(64); scene.add(drops);

  /* ---- the dwarfs ---- */
  const dwarfs = DWARFS.map((d, i) => { const g = buildDwarf(i, material), a = {kind: 'dwarf', g, i, d, describe: () => ({title: d.name + ' the dwarf', lines: ['A little dwarf seen on Dwarf Rock at dusk', d.tool === 'pick' ? 'Carries a pickaxe from the cave' : 'Carries a lantern', 'Nobody has ever talked to one']})}; g.visible = false; scene.add(g); pick.push(a); return a; });
  const lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(.04, 8, 6), new THREE.MeshBasicMaterial({color: '#ffd27a', fog: false}), 3); lanterns.frustumCulled = false; lanterns.count = 0; scene.add(lanterns);
  const lm = new THREE.Matrix4(), lp = new THREE.Vector3(), lq = new THREE.Quaternion(), ls = new THREE.Vector3(1, 1, 1);
  const fx = Math.cos(ISLET.face), fz = -Math.sin(ISLET.face);   // the islet frame's x axis in the world
  const toWorld = (x, z) => ({x: ISLET.x + (x * Math.cos(ISLET.face) + z * Math.sin(ISLET.face)) * ISLET.s, z: ISLET.z + (-x * Math.sin(ISLET.face) + z * Math.cos(ISLET.face)) * ISLET.s});

  /* ---- the dwarfs' gem, waiting on the harbour beach for somebody to find it ---- */
  const gemSpot = doorstep('hut'), gem = new THREE.Mesh(new THREE.OctahedronGeometry(.07, 0).scale(1, 1.4, 1), new THREE.MeshBasicMaterial({color: '#8fd8ff', fog: false})); gem.visible = false; scene.add(gem);

  /* ---- butterflies ---- */
  const flowerPlots = PLOTS.filter(p => ['pavilion', 'orchard', 'wild'].includes(p.kind)), flies = buildButterflies(14); scene.add(flies);
  // bees: little striped dots that circle the beds in daylight, as many as the hives can spare
  const bees = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 6, 4), new THREE.MeshBasicMaterial({color: '#f2c14e'}), 18); bees.frustumCulled = false; bees.count = 0; scene.add(bees); const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bp = new THREE.Vector3(), bs = new THREE.Vector3(1, 1, 1);
  let fliesMax = 14, forced = null, lifeOn = true, ecoNow = null, flowersBase = 800;

  function update(dt, time, ctx) {
    curHour = ctx.hour;
    const near = ctx.dist < 110 && lifeOn;
    for (const a of pets) { a.g.visible = near; if (a.kind === 'dog') updateDog(a, dt, ctx); else updateCat(a, dt, ctx); poseOn(a, time, dt); }
    for (const a of hens) { updateHen(a, dt, ctx); if (a.g.visible) poseOn(a, time, dt); }
    // dolphins and whales, and the drops they throw up
    let nd = 0;
    for (const a of dolphins) {
      const p = dolphinPose(a.i, time); a.g.position.set(p.x, ISLAND.sea + p.y, p.z); a.g.rotation.set(p.pitch + Math.sin(time * 6 + a.i) * (p.leap ? 0 : .05), p.hd, 0, 'YXZ'); a.p = p;
      if (p.splash > 0) for (let j = 0; j < 6; j++) { const ang = j / 6 * TAU + a.i, r = (1 - p.splash) * .5 + .12, h = Math.sin((1 - p.splash) * Math.PI) * .38; drops.userData.set(nd++, p.x + Math.cos(ang) * r, ISLAND.sea + h, p.z + Math.sin(ang) * r, .04 * (.4 + p.splash)); }
    }
    for (const a of whales) {
      if (ecoNow && ecoNow.sea < .55) { a.g.visible = false; continue; }   // the whales only come to a rich sea
      const p = whalePose(a.i, time); if (a.i === 0) whaleSpout = p.spout; a.g.position.set(p.x, ISLAND.sea + p.y, p.z); a.g.rotation.set(p.pitch, p.hd, 0, 'YXZ'); a.g.visible = p.up > .02;
      if (p.spout > .02) { const hx = p.x + Math.sin(p.hd) * .9 * a.wd.size, hz = p.z + Math.cos(p.hd) * .9 * a.wd.size; for (let j = 0; j < 8; j++) { const u = (time * 1.1 + j / 8) % 1; drops.userData.set(nd++, hx + Math.sin(j * 2.1) * u * .32, ISLAND.sea + .4 + u * 1.25 * p.spout * a.wd.size - u * u * .3, hz + Math.cos(j * 2.1) * u * .32, .07 * (1 - u * .7) * a.wd.size * (.5 + p.spout)); } }
    }
    drops.userData.show(nd);
    // the dwarfs
    let out = dwarfsOut(ctx.day, ctx.hour), win = out && dwarfWindow(out.day), dur = win ? (win.to - win.from) * 20 : 0;
    if (forced) { dur = 200; out = {n: forced.n, u: forced.u, day: ctx.day}; }
    else if (ctx.festival) { dur = 200; out = {n: 3, u: .25 + ((time * .02) % .55), day: ctx.day}; }   // (the dwarfs come out for the Lantern Festival)
    let nl = 0;
    for (const a of dwarfs) {
      const p = out && a.i < out.n ? dwarfPose(a.i, out.u * dur, dur) : {inside: true};
      a.g.visible = !p.inside; if (p.inside) continue;
      const w = toWorld(p.x, p.z), bob = p.pause ? 0 : Math.abs(Math.sin(time * 7 + a.i)) * .01;
      a.g.position.set(w.x, ISLAND.sea + .07 * ISLET.s + bob, w.z); a.g.rotation.y = p.hd + ISLET.face + (p.pause ? Math.sin(time * .8 + a.i) * .5 : 0);
      if (a.d.tool === 'lantern') { const c = Math.cos(a.g.rotation.y), s = Math.sin(a.g.rotation.y); lanterns.setMatrixAt(nl++, lm.compose(lp.set(w.x + c * .08, ISLAND.sea + .2 + bob, w.z - s * .08), lq, ls)); }
    }
    lanterns.count = nl; lanterns.instanceMatrix.needsUpdate = true; lanterns.visible = nl > 0;
    const gl = islet.userData.glow, lit = clamp(0, ctx.night * 1.05 + (out ? .3 : 0), 1);
    if (gl) { gl.material.opacity = lit; gl.visible = lit > .02; }
    islet.userData.innerMat.opacity = clamp(0, (ctx.night * .5 + (out ? .35 : 0) + .04) * (.82 + .18 * Math.sin(time * 6.3) * Math.sin(time * 2.7 + 1)), .95);
    gem.visible = sim.wild.gems > 0; if (gem.visible) { gem.position.set(gemSpot.x + .35, heightAt(gemSpot.x, gemSpot.z) + .14 + Math.sin(time * 2.2) * .03, gemSpot.z + .25); gem.rotation.y = time * 1.6; }
    if (ctx.eco) { ecoNow = ctx.eco; const sea = ctx.eco.sea, pod = sea > .7 ? 3 : sea > .45 ? 2 : 1; dolphins.forEach(a => { a.g.visible = a.i < pod; });   // the richer the sea, the bigger the pod
      meadow.userData.show(Math.round(flowersBase * (.2 + .8 * ctx.eco.flowers)));
      const nb = ctx.night < .3 && ctx.rain < .3 && lifeOn ? Math.round(ctx.eco.bees * 18) : 0; for (let i = 0; i < nb; i++) { const p = flowerPlots[i % flowerPlots.length], tt = time * 1.3 + i * 2.1; bees.setMatrixAt(i, bm.compose(bp.set(p.x + Math.sin(tt) * p.r * .7, heightAt(p.x, p.z) + .22 + Math.sin(tt * 3 + i) * .07, p.z + Math.cos(tt * 1.3) * p.r * .6), bq, bs)); } bees.count = nb; bees.instanceMatrix.needsUpdate = true; }
    // butterflies: by day, in the warm seasons, when it is dry
    const want = ctx.night < .3 && ctx.rain < .2 ? ({spring: 8, summer: 14, autumn: 5, winter: 0}[season] || 0) : 0, n = Math.min(want, fliesMax);
    for (let i = 0; i < n; i++) { const p = flowerPlots[i % flowerPlots.length], tt = time * .5 + i * 1.7, x = p.x + Math.sin(tt) * p.r * .85 + Math.sin(tt * 3.1 + i) * .08, z = p.z + Math.sin(tt * 2) * p.r * .55 + Math.cos(tt * 2.3 + i) * .08, dx = Math.cos(tt) * p.r * .85, dz = Math.cos(tt * 2) * p.r * 1.1; flies.userData.set(i, x, heightAt(x, z) + .3 + Math.sin(tt * 4 + i) * .06 + (i % 3) * .08, z, Math.atan2(dx, dz), time * 14 + i * 2); }
    flies.userData.show(n);
  }
  // what the sound should know: who is out and what they are doing (see sound.mjs, wildDue)
  const soundState = () => ({hens: lifeOn && hens.some(a => a.g.visible), dogRun: lifeOn && pets.some(a => a.kind === 'dog' && (a.w.anim === 'run' || a.w.anim === 'walk')), cats: lifeOn && pets.some(a => a.kind === 'cat' && a.w.anim !== 'sleep'), leap: dolphins.some(a => a.p && a.p.leap > .05), spout: whales[0].g.visible && whaleSpout > .2, dwarfs: dwarfs.filter(a => a.g.visible).length});
  let whaleSpout = 0;
  return {soundState, pick, update, hens, pets, dwarfs, meadow, gardens, borders, islet, forceDwarfs(n, u = .3) { forced = n ? {n, u} : null; }, setQuality(p) { flowersBase = p.flowers; meadow.userData.show(p.flowers); fliesMax = p.flies; lifeOn = p.life !== 0; }, dwarfsOut: ctx => dwarfsOut(ctx.day, ctx.hour)};
}
