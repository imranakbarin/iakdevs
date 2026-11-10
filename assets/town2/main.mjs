// New Toy Town: the page. Renderer, camera and controls, lights, and the loop that moves the cast and vehicles.
import * as THREE from 'three';
import {PALETTE as P, ISLAND, CAST, VEHICLES, TRACK, PADDOCK, POND, JETTY, heightAt, rand} from './def.mjs';
import {createSim} from './sim.mjs';
import {buildTown, buildResident, buildVehicle, buildClouds, buildTrain, buildBoat, buildAnimal, buildSky, buildUmbrella, buildRain} from './build.mjs';
import {skyAt} from './sky.mjs';
import {newsStory} from './stories.mjs';

const canvas = document.getElementById('town'), q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
const phone = Math.min(innerWidth, innerHeight) < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#bfe9fb'); scene.fog = new THREE.Fog('#bfe9fb', 60, 140);
const camera = new THREE.PerspectiveCamera(30, 1, .5, 300);
scene.add(new THREE.HemisphereLight('#ffffff', '#b8d8a0', 1.55));
const sun = new THREE.DirectionalLight('#fff4dc', 2.1); sun.position.set(-14, 22, 10); sun.castShadow = true;
sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048); Object.assign(sun.shadow.camera, {left: -17, right: 17, top: 14, bottom: -14, near: 1, far: 70}); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);

const sim = createSim(7), built = buildTown(sim.graph);
scene.add(built.ground, built.sea, built.town, built.glow); for (const m of Object.values(built.moving)) scene.add(m.group);
const clouds = buildClouds(); scene.add(clouds);
const sky = buildSky(); scene.add(sky);
const hemi = scene.children.find(o => o.isHemisphereLight), seaMat = built.sea.material, tmp = new THREE.Color();
if (q.get('h')) sim.setHour(+q.get('h'));
const people = new Map(), cars = new Map();
const brollies = new Map(), BROLLY = ['red', 'yellow', 'pink', 'blue', 'purple', 'orange', 'teal'];
sim.residents.forEach((r, i) => { const g = buildResident(r.def, i, built.material), u = buildUmbrella(built.material, BROLLY[i % BROLLY.length]); g.add(u); brollies.set(r.id, u); scene.add(g); people.set(r.id, g); });
const rain = buildRain(); scene.add(rain);
sim.vehicles.forEach(v => { const g = buildVehicle(v.def, built.material); scene.add(g); cars.set(v.id, g); });

// Things that live on their own: the train, the boat at the jetty, the farm animals and the ducks on the pond.
const train = buildTrain(built.material); scene.add(train);
const boat = buildBoat(built.material); boat.position.set(JETTY.x1 + .15, -.02, JETTY.z + .78); boat.rotation.y = Math.PI / 2 - .15; scene.add(boat);
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
const view = {x: 0, z: .4, yaw: 0, dist: 30, tx: 0, tz: .4, tyaw: 0, tdist: 30};
const TILT = .66, clamp = (a, v, b) => Math.max(a, Math.min(b, v));
function fit() { const a = innerWidth / innerHeight; view.tdist = view.dist = clamp(24, a > 1.5 ? 29 : 29 * 1.5 / a, 62); }
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
function placeCamera() {
  const c = Math.cos(TILT), s = Math.sin(TILT);
  camera.position.set(view.x + Math.sin(view.yaw) * c * view.dist, s * view.dist, view.z + Math.cos(view.yaw) * c * view.dist); camera.lookAt(view.x, .6, view.z);
}
const pointers = new Map(); let gesture = null;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, {x: e.clientX, y: e.clientY, button: e.button}); gesture = null; });
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1) {
    if (p.button === 2 || e.shiftKey) { view.tyaw -= dx * .006; return; }
    const k = view.dist * .00135, cs = Math.cos(view.yaw), sn = Math.sin(view.yaw);
    view.tx = clamp(-13, view.tx - (dx * cs + dy * sn * 1.5) * k, 13); view.tz = clamp(-10, view.tz - (-dx * sn + dy * cs * 1.5) * k, 10);
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    if (gesture) { view.tdist = clamp(7, view.tdist * gesture.d / d, 64); let da = ang - gesture.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); view.tyaw -= da; }
    gesture = {d, ang};
  }
});
for (const t of ['pointerup', 'pointercancel']) canvas.addEventListener(t, e => { pointers.delete(e.pointerId); gesture = null; });
canvas.addEventListener('wheel', e => { e.preventDefault(); view.tdist = clamp(7, view.tdist * Math.exp(e.deltaY * .0012), 64); }, {passive: false});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === 'q') view.tyaw += .3; if (k === 'e') view.tyaw -= .3; if (k === '+' || k === '=') view.tdist = clamp(7, view.tdist * .85, 64); if (k === '-') view.tdist = clamp(7, view.tdist / .85, 64); if (k === '0') { view.tx = 0; view.tz = .4; view.tyaw = 0; fit(); } });
addEventListener('resize', () => { resize(); });

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
  const L = skyAt(sim.hour, sim.weather.rain);
  scene.background.set(L.sky); scene.fog.color.set(L.fog); seaMat.color.set(L.sea);
  hemi.color.set(L.hemiSky); hemi.groundColor.set(L.hemiGround); hemi.intensity = L.hemiI;
  sun.color.set(L.sunColor); sun.intensity = L.sunI; sun.position.set(...L.sunPos);
  const gm = built.glow.material; gm.opacity = L.glow; built.glow.visible = L.glow > .02;
  sky.visible = L.stars > .02; sky.userData.stars.material.opacity = L.stars; sky.userData.moon.material.opacity = L.stars * .95;
  { const r = sim.weather.rain; for (const u of brollies.values()) u.visible = r > .25; rain.position.set(view.x, 0, view.z); rain.userData.update(time, r > .02 ? r : 0); }
  sky.position.copy(camera.position); document.body.style.background = L.sky; return L;
}
function sync(dt) {
  time += dt;
  for (const r of sim.residents) {
    const g = people.get(r.id); g.visible = r.state === 'walking'; if (!g.visible) continue;
    const step = time * 9 + r.speed * 40, y = heightAt(r.x, r.z);
    g.position.set(r.x, y + .02 + Math.abs(Math.sin(step)) * .035, r.z); g.rotation.set(0, Math.atan2(r.tx, r.tz), Math.sin(step) * .09);
  }
  for (const v of sim.vehicles) {
    const g = cars.get(v.id); g.visible = v.state !== 'parked'; if (!g.visible) continue;
    const y = heightAt(v.x, v.z), ahead = heightAt(v.x + v.tx * .3, v.z + v.tz * .3);
    g.position.set(v.x, y + .035 + (v.v > .05 ? Math.abs(Math.sin(time * 14 + v.s)) * .008 : 0), v.z); g.rotation.set(-Math.atan2(ahead - y, .3), Math.atan2(v.tx, v.tz), 0, 'YXZ');
  }
  { const t = sim.train, y = heightAt(TRACK.x, t.z) + .06; train.position.set(TRACK.x, y, t.z); train.rotation.y = Math.PI; }
  moveCritters(dt); boat.position.y = -.02 + Math.sin(time * 1.3) * .022; boat.rotation.z = Math.sin(time * 1.1) * .03;
  built.moving.top.inner.rotation.y = time * 2.2; built.moving.sails.inner.rotation.z = -time * .55;
  built.moving.minute.inner.rotation.z = -time * .1; built.moving.hour.inner.rotation.z = -time * .1 / 12;
  clouds.rotation.y = time * .012;
  const k = Math.min(1, dt * 6); view.x += (view.tx - view.x) * k; view.z += (view.tz - view.z) * k; view.yaw += (view.tyaw - view.yaw) * k; view.dist += (view.tdist - view.dist) * k;
  placeCamera(); weatherLight(); news(); caption();
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

// Hooks for tests and screenshots.
window.ToyTownNew = {
  sim, scene, camera, renderer, view,
  hour: () => sim.hour, setHour(h) { sim.setHour(h); sync(0); renderer.render(scene, camera); },
  info: () => ({pixelRatio: renderer.getPixelRatio(), story: sim.story.current && sim.story.current.id, rain: +sim.weather.rain.toFixed(2), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, residentsOut: sim.residents.filter(r => r.state === 'walking').length, clock: sim.clock}),
  look(x, z, dist, yaw = 0) { Object.assign(view, {x, z, dist, yaw, tx: x, tz: z, tdist: dist, tyaw: yaw}); placeCamera(); renderer.render(scene, camera); },
  advance(seconds) { for (let t = 0; t < seconds; t += .05) sim.update(.05); sync(0); renderer.render(scene, camera); },
  setWeather(kind, seconds = 600) { sim.weather.force(kind, seconds); },
  freeze(on = true) { frozen = on; }
};
