// New Toy Town: the page. Renderer, camera and controls, lights, and the loop that moves the cast and vehicles.
import * as THREE from 'three';
import {PALETTE as P, ISLAND, CAST, VEHICLES, BUILDINGS, PADDOCK, POND, PIER, heightAt, rand} from './def.mjs';
import {along} from './graph.mjs';
import {createSim} from './sim.mjs';
import {buildTown, buildResident, buildVehicle, buildClouds, buildTrain, buildBoat, buildAnimal, buildSky, buildUmbrella, buildRain, buildFall, buildPuddles} from './build.mjs';
import {skyAt, seasonOf, SEASONS} from './sky.mjs';
import {createSound} from './sound.mjs';
import {newsStory} from './stories.mjs';
import {describeResident, describeBuilding, describeVehicle, describeAnimal, describeTrain} from './inspect.mjs';

const canvas = document.getElementById('town'), q = new URLSearchParams(location.search);
// Some browsers (Edge on a machine without a good GPU, for one) refuse a context with antialiasing or the high-performance hint: try plainer options before giving up.
const renderer = (() => { try { return new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'}); } catch (e) { try { return new THREE.WebGLRenderer({canvas, antialias: false}); } catch (e2) { throw new Error('WebGL could not start (' + (e2 && e2.message || e2) + ')'); } } })();
const phone = Math.min(innerWidth, innerHeight) < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#bfe9fb'); scene.fog = new THREE.Fog('#bfe9fb', 85, 210);
const camera = new THREE.PerspectiveCamera(30, 1, .5, 400);
scene.add(new THREE.HemisphereLight('#ffffff', '#b8d8a0', 1.55));
const sun = new THREE.DirectionalLight('#fff4dc', 2.1); sun.position.set(-14, 22, 10); sun.castShadow = true;
sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048); Object.assign(sun.shadow.camera, {left: -25, right: 25, top: 20, bottom: -20, near: 1, far: 90}); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);

const season = SEASONS.includes(q.get('season')) ? q.get('season') : seasonOf(), sim = createSim(7, {season}), built = buildTown(sim.graph, season);
const sound = createSound();
scene.add(built.ground, built.sea, built.town, built.glow, built.lampGlow); for (const m of Object.values(built.moving)) scene.add(m.group);
const clouds = buildClouds(); scene.add(clouds);
const sky = buildSky(); scene.add(sky);
const hemi = scene.children.find(o => o.isHemisphereLight), seaMat = built.sea.material, tmp = new THREE.Color();
if (q.get('h')) sim.setHour(+q.get('h'));
const people = new Map(), cars = new Map();
const brollies = new Map(), BROLLY = ['red', 'yellow', 'pink', 'blue', 'purple', 'orange', 'teal'];
sim.residents.forEach((r, i) => { const g = buildResident(r.def, i, built.material), u = buildUmbrella(built.material, BROLLY[i % BROLLY.length]); g.add(u); brollies.set(r.id, u); scene.add(g); people.set(r.id, g); });
const rain = buildRain(); scene.add(rain);
const fall = buildFall(season); scene.add(fall);
const puddles = buildPuddles(sim.graph); if (season !== 'winter') scene.add(puddles);   // (in winter the rain is snow)
const lampDrawn = sim.lamps.map(() => -1);
sim.vehicles.forEach(v => { const g = buildVehicle(v.def, built.material); scene.add(g); cars.set(v.id, g); });

// Things that live on their own: the train, the boat at the jetty, the farm animals and the ducks on the pond.
const trainCars = buildTrain(built.material); for (const c of trainCars) scene.add(c);
const loop = sim.graph.loop;
const boat = buildBoat(built.material); boat.position.set(PIER.x1 - .6, -.02, PIER.z + .95); boat.rotation.y = Math.PI / 2 - .15; scene.add(boat);
const critters = [];
for (let k = 0; k < 6; k++) { const kind = k < 3 ? 'cow' : 'sheep', g = buildAnimal(kind, built.material); scene.add(g); critters.push({g, k, x: PADDOCK.x0 + .6 + rand(k + 5) * (PADDOCK.x1 - PADDOCK.x0 - 1.2), z: PADDOCK.z0 + .6 + rand(k + 9) * (PADDOCK.z1 - PADDOCK.z0 - 1.2), tx: 0, tz: 0, wait: rand(k + 30) * 4, hd: rand(k) * 6, bounds: PADDOCK, step: kind === 'cow' ? .1 : .13}); }
for (let k = 0; k < 3; k++) { const g = buildAnimal('duck', built.material); scene.add(g); critters.push({g, k: 10 + k, x: POND.x + (rand(k + 40) - .5) * 1.4, z: POND.z + (rand(k + 50) - .5) * .8, tx: 0, tz: 0, wait: rand(k + 60) * 3, hd: rand(k + 70) * 6, bounds: {x0: POND.x - 1.1, x1: POND.x + 1.1, z0: POND.z - .65, z1: POND.z + .65}, step: .12, water: true}); }
function moveCritters(dt) {
  for (const c of critters) {
    if (c.wait > 0) c.wait -= dt;
    else {
      const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      if (d < .08 || !c.tx) { const B = c.bounds; c.tx = B.x0 + .25 + Math.random() * (B.x1 - B.x0 - .5); c.tz = B.z0 + .25 + Math.random() * (B.z1 - B.z0 - .5); c.wait = Math.random() * 4; }
      else { c.x += dx / d * c.step * dt; c.z += dz / d * c.step * dt; const want = Math.atan2(dx, dz); let df = want - c.hd; df = Math.atan2(Math.sin(df), Math.cos(df)); c.hd += df * Math.min(1, dt * 3); }
    }
    const y = heightAt(c.x, c.z) + (c.water ? .08 + Math.sin(time * 1.6 + c.k) * .012 : 0);
    c.g.position.set(c.x, y, c.z); c.g.rotation.y = c.hd;
  }
}

/* ---- camera: look down at a point on the ground from a fixed tilt; drag to pan, pinch or wheel to zoom, twist to turn ---- */
const view = {x: 0, z: .4, yaw: 0, dist: 44, tx: 0, tz: .4, tyaw: 0, tdist: 44};
const TILT = .66, clamp = (a, v, b) => Math.max(a, Math.min(b, v));
function fit() { const a = innerWidth / innerHeight; view.tdist = view.dist = clamp(34, a > 1.5 ? 43 : 43 * 1.5 / a, 92); }
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
function placeCamera() {
  const c = Math.cos(TILT), s = Math.sin(TILT);
  camera.position.set(view.x + Math.sin(view.yaw) * c * view.dist, s * view.dist, view.z + Math.cos(view.yaw) * c * view.dist); camera.lookAt(view.x, .6, view.z);
}
const pointers = new Map(); let gesture = null, follow = null;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x: e.clientX, y: e.clientY, button: e.button, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: 0}); if (pointers.size > 1) for (const p of pointers.values()) p.multi = true; gesture = null; });
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; p.moved += Math.abs(dx) + Math.abs(dy);
  if (pointers.size === 1) {
    if (p.moved > 8) follow = null;   // a drag lets go of whatever the camera was following
    if (p.button === 2 || e.shiftKey) { view.tyaw -= dx * .006; return; }
    const k = view.dist * .00135, cs = Math.cos(view.yaw), sn = Math.sin(view.yaw);
    view.tx = clamp(-22, view.tx - (dx * cs + dy * sn * 1.5) * k, 22); view.tz = clamp(-17, view.tz - (-dx * sn + dy * cs * 1.5) * k, 17);
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (gesture) { view.tdist = clamp(7, view.tdist * gesture.d / d, 96); let da = ang - gesture.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); view.tyaw -= da; }
    gesture = {d, ang};
  }
});
for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, e => {
  const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); gesture = null;
  if (t === 'pointerup' && p && !p.multi && p.moved < 10 && performance.now() - p.t0 < 600 && p.button !== 2) tap(e.clientX, e.clientY);
});
canvas.addEventListener('wheel', e => { e.preventDefault(); view.tdist = clamp(7, view.tdist * Math.exp(e.deltaY * .0012), 96); }, {passive: false});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === 'q') view.tyaw += .3; if (k === 'e') view.tyaw -= .3; if (k === '+' || k === '=') view.tdist = clamp(7, view.tdist * .85, 96); if (k === '-') view.tdist = clamp(7, view.tdist / .85, 96); if (k === '0') { view.tx = 0; view.tz = .4; view.tyaw = 0; fit(); } });
addEventListener('resize', () => { resize(); });

/* ---- tap to inspect: a resident, vehicle, animal, the train or a building: a ring, a card, and the camera follows what moves ---- */
const cardEl = document.getElementById('card'), ring = new THREE.Mesh(new THREE.TorusGeometry(.3, .035, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({color: '#ffd54a', transparent: true, opacity: .95, depthTest: false}));
ring.renderOrder = 4; ring.visible = false; scene.add(ring);
const RING = {resident: .8, vehicle: 1.3, animal: .8, train: 1.7, building: 3.4};
let sel = null, cardAt = 0, cardText = '';
const critterKind = c => c.k >= 10 ? 'duck' : c.k < 3 ? 'cow' : 'sheep';
function posOf(o) {
  if (!o) return null;
  if (o.kind === 'resident') { const g = people.get(o.id); return g && g.visible ? g.position : null; }
  if (o.kind === 'vehicle') { const g = cars.get(o.id); return g && g.visible ? g.position : null; }
  if (o.kind === 'animal') return critters[o.id].g.position;
  if (o.kind === 'train') return trainCars[1].position;
  if (o.kind === 'building') { const b = BUILDINGS.find(x => x.id === o.id); return {x: b.x, y: heightAt(b.x, b.z), z: b.z}; }
  return null;
}
function describe(o) {
  if (o.kind === 'resident') return describeResident(sim, sim.residents.find(r => r.id === o.id));
  if (o.kind === 'vehicle') return describeVehicle(sim, sim.vehicles.find(v => v.id === o.id));
  if (o.kind === 'animal') return describeAnimal(critterKind(critters[o.id]));
  if (o.kind === 'train') return describeTrain(sim);
  return describeBuilding(sim, BUILDINGS.find(b => b.id === o.id));
}
function select(o) {
  sel = o; follow = o && o.kind !== 'building' ? o : null; cardAt = 0; cardText = '';
  const h = document.getElementById('hint'); if (h && o) h.style.opacity = '0'; if (o) sound.blip();
  if (!o) { ring.visible = false; if (cardEl) cardEl.classList.remove('on'); return; }
  ring.scale.setScalar(RING[o.kind]); refreshCard();
}
function refreshCard() {
  if (!sel || !cardEl) return; const d = describe(sel), p = posOf(sel), gone = !p && sel.kind === 'resident';
  const lines = gone ? [describeResident(sim, sim.residents.find(r => r.id === sel.id)).lines[0]] : d.lines, text = d.title + '|' + lines.join('|');
  if (text === cardText) return; cardText = text; cardEl.querySelector('b').textContent = d.title; const box = cardEl.querySelector('div'); box.textContent = '';
  for (const l of lines) { const e = document.createElement('span'); e.textContent = l; box.append(e); }
  cardEl.classList.add('on');
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.5), v3 = new THREE.Vector3();
function pick(cx, cy) {
  const r = canvas.getBoundingClientRect(); camera.updateMatrixWorld(); let best = null, bd = 34;
  const test = (pos, o, reach = bd) => { if (!pos) return; v3.set(pos.x, pos.y + .3, pos.z).project(camera); if (v3.z > 1) return; const d = Math.hypot((v3.x * .5 + .5) * r.width + r.left - cx, (-v3.y * .5 + .5) * r.height + r.top - cy); if (d < bd && d < reach) { bd = d; best = o; } };
  for (const rs of sim.residents) test(posOf({kind: 'resident', id: rs.id}), {kind: 'resident', id: rs.id});
  for (const v of sim.vehicles) test(posOf({kind: 'vehicle', id: v.id}), {kind: 'vehicle', id: v.id}, 40);
  critters.forEach((c, i) => test(c.g.position, {kind: 'animal', id: i}, 26)); for (const c of trainCars) test(c.position, {kind: 'train'}, 40);
  if (best) return best;
  ray.setFromCamera({x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1}, camera);
  const hit = ray.ray.intersectPlane(plane, v3.clone()); if (!hit) return null; let near = null, nd = 1.5;
  for (const b of BUILDINGS) { const d = Math.hypot(b.x - hit.x, b.z - hit.z); if (d < nd) { nd = d; near = b; } }
  return near ? {kind: 'building', id: near.id} : null;
}
function tap(cx, cy) { const o = pick(cx, cy); select(o && sel && o.kind === sel.kind && o.id === sel.id && o.kind === 'building' ? null : o); }
if (cardEl) cardEl.querySelector('button').addEventListener('click', () => select(null));
function trackSelection(dt) {
  if (!sel) return; const p = posOf(sel);
  if (p) { ring.visible = true; ring.position.set(p.x, (p.y || heightAt(p.x, p.z)) + .06, p.z); ring.rotation.y += dt * 1.2; if (follow) { view.tx = clamp(-22, p.x, 22); view.tz = clamp(-17, p.z, 17); } }
  else { ring.visible = false; follow = null; }
  if ((cardAt -= dt) <= 0) { cardAt = .4; refreshCard(); }
}

/* ---- the day's news: each light headline stages one of the small stories, one after another ---- */
const storyEl = document.getElementById('story'); let headlines = [], newsAt = 40, newsIdx = 0, shown = '';
if (q.get('news') !== '0') fetch(new URL('../toy-town-news.json', import.meta.url)).then(r => r.ok ? r.json() : null).then(d => { headlines = ((d && d.stories) || []).filter(s => s.tone === 'light' && s.title).slice(0, 12); }).catch(() => {});
function news() {
  if (sim.story.current || sim.story.pending || sim.clock < newsAt || !headlines.length) return;
  const h = headlines[newsIdx++ % headlines.length], m = newsStory(h.title, h.category || '');
  if (m.weather) sim.weather.force(m.weather, 70);
  sim.stage(m.story, h.title); newsAt = sim.clock + 90;
}
function caption() {
  const c = sim.story.current, text = c ? (c.headline || '') + '|' + c.title : '';
  if (text === shown) return; shown = text; if (!storyEl) return;
  if (!c) { storyEl.classList.remove('on'); return; }
  storyEl.textContent = ''; storyEl.append(c.title);
  if (c.headline) { const sm = document.createElement('small'); sm.textContent = 'In the news: ' + c.headline; storyEl.append(sm); }
  storyEl.classList.add('on');
}

/* ---- the loop ---- */
let last = 0, frozen = false, time = 0;
// The light follows the hour: sky, fog, sea, sun or moon, lit windows and lanterns, stars.
function weatherLight() {
  const L = skyAt(sim.hour, sim.weather.rain, season);
  scene.background.set(L.sky); scene.fog.color.set(L.fog); seaMat.color.set(L.sea);
  hemi.color.set(L.hemiSky); hemi.groundColor.set(L.hemiGround); hemi.intensity = L.hemiI;
  sun.color.set(L.sunColor); sun.intensity = L.sunI; sun.position.set(...L.sunPos);
  const gm = built.glow.material; gm.opacity = L.glow; built.glow.visible = L.glow > .02;
  sky.visible = L.stars > .02; sky.userData.stars.material.opacity = L.stars; sky.userData.moon.material.opacity = L.stars * .95;
  { const r = sim.weather.rain; for (const u of brollies.values()) u.visible = r > .25; rain.position.set(view.x, 0, view.z); rain.userData.update(time, season === 'winter' || r < .02 ? 0 : r);
    const day = 1 - L.night, amount = season === 'winter' ? Math.max(.25, r) : season === 'summer' ? (L.night > .5 ? .7 * (1 - r) : 0) : (season === 'autumn' ? .5 : .4) * day * (1 - r * .7);
    fall.position.set(view.x, 0, view.z); fall.userData.update(time, amount);
    sound.update({dark: L.night, rain: r, season, hour: sim.hour, trainMoving: Math.abs(sim.train.v) > .1, zoom: 1 - clamp(0, (view.dist - 7) / 50, 1)}, 0.0001 + lastDt); }
  // the street lamps, one by one as the lamplighter reaches them (faint in daylight, bright after dark), and the puddles
  built.lampGlow.material.opacity = .4 + .55 * L.night;
  sim.lamps.forEach((l, i) => { const v = Math.round(l.lit * 20) / 20; if (v !== lampDrawn[i]) { lampDrawn[i] = v; built.lampGlow.userData.set(i, v); } });
  puddles.userData.set(sim.weather.wet);
  sky.position.copy(camera.position); document.body.style.background = L.sky; return L;
}
let lastDt = 0;
function sync(dt) {
  time += dt; lastDt = dt;
  for (const r of sim.residents) {
    const g = people.get(r.id); g.visible = r.state === 'walking'; if (!g.visible) continue;
    const step = time * (r.lampJob ? 16 : 9) + r.speed * 40, y = heightAt(r.x, r.z);
    const chat = r.pause > 0 && r.look; g.position.set(r.x, y + .02 + (chat ? Math.abs(Math.sin(time * 7)) * .025 : Math.abs(Math.sin(step)) * .035), r.z); g.rotation.set(0, chat ? Math.atan2(r.look.x - r.x, r.look.z - r.z) : Math.atan2(r.tx, r.tz), chat ? 0 : Math.sin(step) * .09);
  }
  for (const v of sim.vehicles) {
    const g = cars.get(v.id); g.visible = v.state !== 'parked'; if (!g.visible) continue;
    const y = heightAt(v.x, v.z), ahead = heightAt(v.x + v.tx * .3, v.z + v.tz * .3);
    g.position.set(v.x, y + .035 + (v.v > .05 ? Math.abs(Math.sin(time * 14 + v.s)) * .008 : 0), v.z); g.rotation.set(-Math.atan2(ahead - y, .3), Math.atan2(v.tx, v.tz), 0, 'YXZ');
  }
  trainCars.forEach((c, k) => { const q = along(loop, sim.train.s - k * sim.train.gap), y = heightAt(q.x, q.z) + .06; c.position.set(q.x, y, q.z); c.rotation.y = Math.atan2(q.tx, q.tz); });   // the cars follow the head round the loop
  moveCritters(dt); boat.position.y = -.02 + Math.sin(time * 1.3) * .022; boat.rotation.z = Math.sin(time * 1.1) * .03;
  built.moving.top.inner.rotation.y = time * 2.2; built.moving.sails.inner.rotation.z = -time * .55;
  built.moving.minute.inner.rotation.z = -time * .1; built.moving.hour.inner.rotation.z = -time * .1 / 12;
  clouds.rotation.y = time * .012;
  const k = Math.min(1, dt * 6); view.x += (view.tx - view.x) * k; view.z += (view.tz - view.z) * k; view.yaw += (view.tyaw - view.yaw) * k; view.dist += (view.tdist - view.dist) * k;
  trackSelection(dt); placeCamera(); weatherLight(); news(); caption();
}
// A phone pass: if frames run slow (under ~24 fps for two seconds) the render resolution steps down, and creeps back up when there is room.
const maxPR = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2); let slow = 0, fast = 0, spent = 0, frames = 0;
function tune(dt) {
  if (q.get('tune') === '0') return; spent += dt; frames++; if (spent < 2) return;
  const avg = spent / frames; spent = 0; frames = 0;
  const pr = renderer.getPixelRatio();
  if (avg > .042 && pr > .75) { renderer.setPixelRatio(Math.max(.75, pr - .25)); renderer.setSize(innerWidth, innerHeight, false); slow++; fast = 0; if (pr <= 1 && sun.castShadow) { sun.castShadow = false; } }
  else if (avg < .022 && pr < maxPR && ++fast >= 3) { renderer.setPixelRatio(Math.min(maxPR, pr + .25)); renderer.setSize(innerWidth, innerHeight, false); fast = 0; }
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, last ? (t - last) / 1000 : 0); last = t;
  if (frozen || document.hidden) return;
  sim.update(dt); sync(dt); renderer.render(scene, camera); tune(dt);
}
resize(); fit(); placeCamera(); requestAnimationFrame(frame);
const hint = document.getElementById('hint'); if (hint) setTimeout(() => { hint.style.opacity = '0'; }, 6000);

// The sound button: off until asked (browsers need a tap first anyway); remembered for next time.
const sndBtn = document.getElementById('snd');
function showSound() { if (!sndBtn) return; sndBtn.textContent = sound.enabled ? '\u{1F50A}' : '\u{1F507}'; sndBtn.setAttribute('aria-pressed', String(sound.enabled)); sndBtn.title = sound.enabled ? 'Sound on' : 'Sound off'; }
if (sndBtn) { if (!sound.supported) sndBtn.style.display = 'none'; sndBtn.addEventListener('click', () => { sound.toggle(); try { localStorage.setItem('toytown-new-sound', sound.enabled ? '1' : '0'); } catch (e) {} showSound(); }); showSound(); }
try { if (localStorage.getItem('toytown-new-sound') === '1') { const resume = e => { if (e.target === sndBtn) { removeEventListener('pointerdown', resume); return; } removeEventListener('pointerdown', resume); if (!sound.enabled) { sound.toggle(true); showSound(); } }; addEventListener('pointerdown', resume); } } catch (e) {}
const seasonsEl = document.getElementById('seasons');
if (seasonsEl) for (const [name, icon] of [['spring', '\u{1F338}'], ['summer', '\u2600\uFE0F'], ['autumn', '\u{1F342}'], ['winter', '\u2744\uFE0F']]) {
  const a = document.createElement('a'), u = new URL(location.href); u.searchParams.set('season', name); a.href = u.search; a.textContent = icon; a.title = name + (name === season ? ' (now)' : ''); if (name === season) a.className = 'on'; seasonsEl.append(a);
}
document.addEventListener('visibilitychange', () => sound.pause(document.hidden));

// Hooks for tests and screenshots.
window.ToyTownNew = {
  sim, scene, camera, renderer, view, season, sound,
  hour: () => sim.hour, setHour(h) { sim.setHour(h); sync(0); renderer.render(scene, camera); },
  info: () => ({trainLaps: sim.train.laps, trainStops: sim.train.stopsMade, lampsLit: sim.lamps.filter(l => l.on).length, wet: +sim.weather.wet.toFixed(2), season, pixelRatio: renderer.getPixelRatio(), story: sim.story.current && sim.story.current.id, rain: +sim.weather.rain.toFixed(2), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, residentsOut: sim.residents.filter(r => r.state === 'walking').length, clock: sim.clock}),
  look(x, z, dist, yaw = 0) { Object.assign(view, {x, z, dist, yaw, tx: x, tz: z, tdist: dist, tyaw: yaw}); placeCamera(); renderer.render(scene, camera); },
  advance(seconds) { for (let t = 0; t < seconds; t += .05) sim.update(.05); sync(0); renderer.render(scene, camera); },
  selected: () => sel, tapAt: (cx, cy) => tap(cx, cy), select,
  project(x, z, y = .4) { const r = canvas.getBoundingClientRect(); camera.updateMatrixWorld(); v3.set(x, heightAt(x, z) + y, z).project(camera); return [(v3.x * .5 + .5) * r.width + r.left, (-v3.y * .5 + .5) * r.height + r.top]; },
  setWeather(kind, seconds = 600) { sim.weather.force(kind, seconds); },
  freeze(on = true) { frozen = on; }
};
