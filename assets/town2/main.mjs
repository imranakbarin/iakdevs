// New Toy Town: the page. Renderer, camera and controls, lights, and the loop that moves the cast and vehicles.
import * as THREE from 'three';
import {PALETTE as P, ISLAND, CAST, VEHICLES, BUILDINGS, PADDOCK, POND, PIER, VENDORS, heightAt, rand} from './def.mjs';
import {along} from './graph.mjs';
import {createSim} from './sim.mjs';
import {buildTown, buildResident, buildVehicle, buildClouds, buildTrain, buildBoat, buildAnimal, buildSky, buildUmbrella, buildRain, buildFall, buildPuddles, buildCargo, buildPassengers, buildMarketGoods, buildSignals, buildTufts, buildSkyDome, buildRod, buildUmbrellas, U} from './build.mjs';
import {skyAt, seasonOf, SEASONS, mix} from './sky.mjs';
import {createSound} from './sound.mjs';
import {createSmoke} from './smoke.mjs';
import {PROFILE, createGovernor, startTier, isTier} from './quality.mjs';
import {wind} from './nature.mjs';
import {stageOf, dots} from './track.mjs';
import {journalLines} from './paper.mjs';
import {load as loadSettings, save as saveSettings, stepsFor, BUSY_FACTOR} from './settings.mjs';
import {newsStory} from './stories.mjs';
import {describeResident, describeBuilding, describeVehicle, describeAnimal, describeTrain} from './inspect.mjs';

const canvas = document.getElementById('town'), q = new URLSearchParams(location.search);
// Some browsers (Edge on a machine without a good GPU, for one) refuse a context with antialiasing or the high-performance hint: try plainer options before giving up.
const renderer = (() => { try { return new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'}); } catch (e) { try { return new THREE.WebGLRenderer({canvas, antialias: false}); } catch (e2) { throw new Error('WebGL could not start (' + (e2 && e2.message || e2) + ')'); } } })();
const phone = Math.min(innerWidth, innerHeight) < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#bfe9fb'); scene.fog = new THREE.Fog('#bfe9fb', 85, 210);
const camera = new THREE.PerspectiveCamera(30, 1, .5, 400);
scene.add(new THREE.HemisphereLight('#ffffff', '#b8d8a0', 1.55));
const sun = new THREE.DirectionalLight('#fff4dc', 2.1); sun.position.set(-14, 22, 10); sun.castShadow = true;
sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048); Object.assign(sun.shadow.camera, {left: -25, right: 25, top: 20, bottom: -20, near: 1, far: 90}); sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
scene.add(sun, sun.target);

// the day of the week: today's, unless ?day=mon..sun (or 0..6) says otherwise
function dayFromQuery() { const d = (q.get('day') || '').toLowerCase().slice(0, 3), i = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(d); return i >= 0 ? i : /^[0-6]$/.test(q.get('day') || '') ? +q.get('day') : (new Date().getDay() + 6) % 7; }
const season = SEASONS.includes(q.get('season')) ? q.get('season') : seasonOf(), sim = createSim(7, {season, weekday: dayFromQuery()}), built = buildTown(sim.graph, season);
const sound = createSound();
scene.add(built.ground, built.sea, built.shallows, built.town, built.glow, built.lampGlow); for (const m of Object.values(built.moving)) scene.add(m.group);
const tufts = buildTufts(sim.graph); scene.add(tufts);
const clouds = buildClouds(); scene.add(clouds);
const sky = buildSky(); scene.add(sky);
const dome = buildSkyDome(); scene.add(dome);
const hemi = scene.children.find(o => o.isHemisphereLight), seaMat = built.sea.material, tmp = new THREE.Color();
if (q.get('h')) sim.setHour(+q.get('h'));
const people = new Map(), cars = new Map();
const marketDef = BUILDINGS.find(b => b.id === 'market'), rods = new Map(), BROLLY = ['red', 'yellow', 'pink', 'blue', 'purple', 'orange', 'teal'];
const umbrellas = buildUmbrellas(); scene.add(umbrellas);
sim.residents.forEach((r, i) => { const g = buildResident(r.def, i, built.material); if (r.id === 'finn' || r.id === 'salt') { const rod = buildRod(); g.add(rod); rods.set(r.id, rod); } scene.add(g); people.set(r.id, g); });
const rain = buildRain(); scene.add(rain);
const fall = buildFall(season); scene.add(fall);
const puddles = buildPuddles(sim.graph); if (season !== 'winter') scene.add(puddles);   // (in winter the rain is snow)
const lampDrawn = sim.lamps.map(() => -1);
sim.vehicles.forEach(v => { const g = buildVehicle(v.def, built.material); scene.add(g); cars.set(v.id, g); });

// Things that live on their own: the train, the boat at the jetty, the farm animals and the ducks on the pond.
const trainCars = buildTrain(built.material); for (const c of trainCars) scene.add(c);
const loop = sim.graph.loop;
// Cargo and passengers: one instanced mesh each. Crates stand on platforms, ride in the goods wagon or are carried by residents; passengers' heads show in the coaches.
const marketGoods = buildMarketGoods(BUILDINGS.find(b => b.id === 'market'), built.material); scene.add(marketGoods);
const signals = buildSignals(sim.graph); scene.add(signals);
const smokeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({color: '#f4f4f4', transparent: true, opacity: .8, depthWrite: false}), 14), smoke = createSmoke(14), smokeM = new THREE.Matrix4(); smokeMesh.frustumCulled = false; scene.add(smokeMesh);
const cargoMesh = buildCargo(), passMesh = buildPassengers(); scene.add(cargoMesh, passMesh);
const platformInfo = {}; for (const st of sim.train.stations) { const d = sim.graph.doors['platform:' + st.id], q = along(loop, sim.graph.loopS(d.x, d.z)); platformInfo[st.id] = {x: d.x, z: d.z, tx: q.tx, tz: q.tz}; }
const v3b = new THREE.Vector3();
function updateFreight() {
  let n = 0, onTrain = 0, atStation = {};
  for (const c of sim.cargo) {
    if (n >= 48) break;
    if (c.state === 'carried') { const g = people.get(c.holder); if (!g || !g.visible) continue; const a = g.rotation.y; cargoMesh.userData.set(n++, g.position.x + Math.sin(a) * .12, g.position.y + .36, g.position.z + Math.cos(a) * .12, c.kind, a); }
    else if (c.state === 'station') { const pf = platformInfo[c.at]; if (!pf) continue; const i = atStation[c.at] = (atStation[c.at] || 0) + 1, k = i - 1, x = pf.x + pf.tx * (-1.2 + (k % 5) * .4), z = pf.z + pf.tz * (-1.2 + (k % 5) * .4); cargoMesh.userData.set(n++, x, heightAt(x, z) + .23 + Math.floor(k / 5) * .125, z, c.kind); }
    else if (c.state === 'train') { const i = onTrain++, w = trainCars[3]; w.localToWorld(v3b.set(i % 2 ? .1 : -.1, .3 + Math.floor(i / 6) * .13, -.27 + (Math.floor(i / 2) % 3) * .27)); cargoMesh.userData.set(n++, v3b.x, v3b.y, v3b.z, c.kind, w.rotation.y); }
  }
  cargoMesh.userData.show(n);
  let m = 0; sim.riders.forEach((r, i) => { if (m >= 16) return; trainCars[1 + (i % 2)].localToWorld(v3b.set(i % 4 < 2 ? -.1 : .1, .34, -.2 + Math.floor(i / 2) % 3 * .2)); passMesh.userData.set(m++, v3b.x, v3b.y, v3b.z, r.def.coat); });
  passMesh.userData.show(m);
}
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
// The default highlight is a small bobbing pin above what you tapped (the ring on the ground is still there as an option, or none at all).
const pin = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({color: '#ffd54a'}), tip = new THREE.Mesh(new THREE.ConeGeometry(.1, .24, 12).rotateX(Math.PI), m), top = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8), new THREE.MeshBasicMaterial({color: '#ffffff'})); tip.position.y = .12; top.position.y = .3; pin.add(tip, top); pin.visible = false; pin.traverse(o => { o.renderOrder = 4; }); scene.add(pin); }
const PIN_UP = {resident: .78, vehicle: .62, animal: .6, train: .9, building: 2.3}, TALL = {clockTower: 4.9, windmill: 3.7, school: 2.9, bandstand: 2.7, station: 2.5, market: 1.7, policeBox: 1.8, harbourHut: 1.9};
const RING = {resident: .8, vehicle: 1.3, animal: .8, train: 1.7, building: 3.4};
let sel = null, cardAt = 0, cardText = '';
const critterKind = c => c.k >= 10 ? 'duck' : c.k < 3 ? 'cow' : 'sheep';
function posOf(o) {
  if (!o) return null;
  if (o.kind === 'resident') { const r = sim.residents.find(x => x.id === o.id); if (r && r.state === 'riding') return trainCars[1].position; const g = people.get(o.id); return g && g.visible ? g.position : null; }   // (a rider is on the train)
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
  if (!o) { ring.visible = false; pin.visible = false; if (paperMode === 'journal') closePaper(); if (cardEl) cardEl.classList.remove('on'); if (sendBtn) sendBtn.hidden = true; return; }
  ring.scale.setScalar(RING[o.kind]); refreshCard(); if (sendBtn) sendBtn.hidden = !(o.kind === 'building' && BUILDINGS.find(b => b.id === o.id).door > 0); if (journalBtn) { journalBtn.hidden = o.kind !== 'resident'; if (paperMode === 'journal' && o.kind === 'resident') renderPaper(); }
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
// Sending a parcel: press the button on a building's card, then tap where it should go.
const sendBtn = cardEl && cardEl.querySelector('#send'), toastEl = document.getElementById('toast'); let assigning = null, toastAt = 0;
function toast(text, secs = 4) { if (!toastEl) return; toastEl.textContent = text; toastEl.classList.add('on'); toastAt = secs; }
function tap(cx, cy) {
  const o = pick(cx, cy);
  if (assigning) {
    const from = assigning; assigning = null;
    if (o && o.kind === 'building') { const r = sim.sendParcel(from, o.id); if (r.ok) tracked = {id: r.cargo.id, from, to: o.id, done: null, at: sim.clock}; toast(r.ok ? r.carrier + ' takes a parcel from ' + BUILDINGS.find(b => b.id === from).name + ' to ' + BUILDINGS.find(b => b.id === o.id).name + (r.cargo.direct ? ' on foot.' : ' by train, from ' + sim.train.stations.find(x => x.id === r.cargo.originStation).name + '.') : r.reason, 5); }
    else toast('No parcel sent.', 2);
    return;
  }
  select(o && sel && o.kind === sel.kind && o.id === sel.id && o.kind === 'building' ? null : o);
}
if (sendBtn) sendBtn.addEventListener('click', () => { if (sel && sel.kind === 'building') { assigning = sel.id; toast('Now tap the building the parcel should go to (or tap anywhere else to cancel).', 8); } });
addEventListener('keydown', e => { if (e.key === 'Escape' && assigning) { assigning = null; toast('No parcel sent.', 2); } });
// Tracking a parcel you sent: where it is now, and a note when it arrives.
const trackEl = document.getElementById('track'); let tracked = null, trackAt = -1e9;
function refreshTrack() {
  if (!trackEl || Math.abs(sim.clock - trackAt) < .5) return; trackAt = sim.clock;   // (abs: the clock can jump back when the hour is set)
  if (!tracked) { trackEl.classList.remove('on'); return; }
  const name = id => BUILDINGS.find(b => b.id === id).name, c = sim.cargo.find(x => x.id === tracked.id);
  if (c) { const st = stageOf(c); trackEl.textContent = 'Your parcel, ' + name(tracked.from) + ' to ' + name(tracked.to) + ': ' + st.label + '  ' + dots(st.step, st.steps); trackEl.classList.add('on'); return; }
  if (!tracked.done) { const l = sim.freightLog.find(x => x.id === tracked.id); tracked.done = l ? l.how : 'lost'; tracked.doneAt = sim.clock; if (tracked.done === 'delivered') toast('Your parcel arrived at ' + name(tracked.to) + '.', 5); else toast('Your parcel to ' + name(tracked.to) + ' was called off.', 5); trackEl.textContent = tracked.done === 'delivered' ? 'Your parcel arrived at ' + name(tracked.to) + '  \u25CF\u25CF\u25CF' : 'Your parcel was called off'; }
  if (sim.clock - tracked.doneAt > 20) { tracked = null; trackEl.classList.remove('on'); }
}
// The town paper and the residents' journals (one panel, three views: today, yesterday, a resident's day).
const paperBtn = document.getElementById('paperBtn'), paperEl = document.getElementById('paper'), journalBtn = document.getElementById('journalBtn'); let paperMode = null, paperAt = -1e9;
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function renderPaper() {
  if (!paperEl) return; paperEl.textContent = '';
  if (paperMode === 'journal') { const o = sel && sel.kind === 'resident' && sim.residents.find(r => r.id === sel.id); if (!o) { closePaper(); return; }
    paperEl.append(el('h2', o.def.name + "'s day"), el('h3', o.def.job || '')); const lines = journalLines(o.journal, 14); if (!lines.length) paperEl.append(el('p', 'Nothing yet today.')); for (const l of lines) paperEl.append(el('p', l, 'j')); return; }
  const tabs = el('div', undefined, 'tabs'); for (const m of ['today', 'yesterday']) { const b = el('button', m === 'today' ? 'Today' : 'Yesterday'); if (m === paperMode) b.className = 'on'; b.disabled = m === 'yesterday' && !sim.paper('yesterday'); b.addEventListener('click', () => { paperMode = m; renderPaper(); }); tabs.append(b); }
  const e = sim.paper(paperMode) || sim.paper('today'); paperEl.append(tabs, el('h2', e.title), el('h3', e.date + ': ' + e.headline)); for (const it of e.items) paperEl.append(el('p', it));
}
function openPaper(mode) { paperMode = mode; paperEl.classList.add('on'); if (paperBtn) paperBtn.setAttribute('aria-expanded', 'true'); panelEl.classList.remove('on'); renderPaper(); }
function closePaper() { paperMode = null; paperEl.classList.remove('on'); if (paperBtn) paperBtn.setAttribute('aria-expanded', 'false'); }
if (paperBtn) paperBtn.addEventListener('click', () => { if (paperMode && paperMode !== 'journal') closePaper(); else openPaper('today'); });
if (journalBtn) journalBtn.addEventListener('click', () => { if (paperMode === 'journal') closePaper(); else openPaper('journal'); });
// The work board: what is being carried and where, and how much has been done.
const jobsEl = document.getElementById('jobs'); let jobsText = '', jobsAt = 0;
const KIND = {mail: 'Mail', milk: 'Milk', bread: 'Bread', fish: 'Fish', parcel: 'Parcel'};
function refreshJobs() {
  if (!jobsEl) return; const lines = sim.cargo.slice(0, 6).map(c => {
    const stn = id => (sim.train.stations.find(x => x.id === id) || {}).name || id, who = c.holder && (sim.residents.find(r => r.id === c.holder) || {def: {}}).def.name;
    const where = c.state === 'carried' ? 'carried by ' + (who || 'somebody') : c.state === 'ready' ? 'waiting for ' + (who || 'a carrier') : c.state === 'train' ? 'on the train' : c.state === 'station' ? 'waiting at ' + stn(c.at) : '';
    return KIND[c.kind] + ': ' + BUILDINGS.find(b => b.id === c.from).name + ' to ' + BUILDINGS.find(b => b.id === c.to).name + ' (' + where + ')';
  });
  const text = 'Work board | ' + sim.dayName.slice(0, 3) + ' | delivered ' + sim.freightStats.delivered + (sim.fishing.caught ? ' | fish ' + sim.fishing.sold + ' sold, ' + sim.fishing.coins + ' coins' : '') + ' | ' + sim.riders.length + ' on the train | town ' + (sim.townMood > .8 ? 'cheerful' : sim.townMood > .62 ? 'content' : 'grumpy') + '\n' + (lines.join('\n') || 'Nothing to carry just now.');
  if (text === jobsText) return; jobsText = text; jobsEl.textContent = ''; const [head, ...rest] = text.split('\n'); const h = document.createElement('b'); h.textContent = head; jobsEl.append(h); for (const l of rest) { const e = document.createElement('span'); e.textContent = l; jobsEl.append(e); }
}
if (jobsEl) jobsEl.addEventListener('click', () => jobsEl.classList.toggle('open'));
if (cardEl) cardEl.querySelector('button').addEventListener('click', () => select(null));
function trackSelection(dt) {
  if (!sel) return; const p = posOf(sel);
  if (p) { const gy = p.y || heightAt(p.x, p.z), mode = settings.highlight;
    ring.visible = mode === 'ring'; ring.position.set(p.x, gy + .06, p.z); ring.rotation.y += dt * 1.2;
    pin.visible = mode === 'pin'; if (pin.visible) { const b = sel.kind === 'building' ? BUILDINGS.find(x => x.id === sel.id) : null, up = b ? (TALL[b.type] || PIN_UP.building) : PIN_UP[sel.kind] || .7, sc = clamp(.7, view.dist / 20, 2.4); pin.scale.setScalar(sc); pin.position.set(p.x, gy + up + Math.sin(time * 3.2) * .05 * sc, p.z); pin.rotation.y += dt * 1.6; }
    if (follow) { view.tx = clamp(-22, p.x, 22); view.tz = clamp(-17, p.z, 17); } }
  else { ring.visible = false; pin.visible = false; follow = null; }
  if ((cardAt -= dt) <= 0) { cardAt = .4; refreshCard(); }
}

/* ---- the day's news: each light headline stages one of the small stories, one after another ---- */
// pace and balance: how fast the day goes, how much work the train gets, whether the news stages stories (remembered between visits)
let store = null; try { store = localStorage; } catch (e) {}
const settings = store ? loadSettings(store) : loadSettings({getItem: () => null}), setBtn = document.getElementById('set'), panelEl = document.getElementById('panel');
function applySettings(save = true) {
  sim.setBusy(BUSY_FACTOR[settings.busy]);
  if (panelEl) for (const seg of panelEl.querySelectorAll('.seg')) for (const b of seg.children) b.classList.toggle('on', String(settings[seg.dataset.key]) === b.dataset.v);
  if (save && store) saveSettings(store, settings);
}
if (panelEl) for (const seg of panelEl.querySelectorAll('.seg')) seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v, k = seg.dataset.key; settings[k] = k === 'speed' ? +v : k === 'news' ? v === 'true' : v; if (k === 'quality') setQuality(v); applySettings(); });
if (setBtn) setBtn.addEventListener('click', () => { if (paperMode) closePaper(); const on = panelEl.classList.toggle('on'); setBtn.setAttribute('aria-expanded', String(on)); });
applySettings(false);
const storyEl = document.getElementById('story'); let headlines = [], newsAt = 40, newsIdx = 0, shown = '';
if (q.get('news') !== '0') fetch(new URL('../toy-town-news.json', import.meta.url)).then(r => r.ok ? r.json() : null).then(d => { headlines = ((d && d.stories) || []).filter(s => s.tone === 'light' && s.title).slice(0, 12); }).catch(() => {});
function news() {
  if (!settings.news) return;
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
let shadowsNear = true, last = 0, frozen = false, time = 0, windNow = wind(0);
// The light follows the hour: sky, fog, sea, sun or moon, lit windows and lanterns, stars.
function weatherLight() {
  const L = skyAt(sim.hour, sim.weather.rain, season);
  scene.background.set(L.sky);
  if (dome.visible) { const u = dome.userData.u, r = clamp(0, sim.weather.rain, 1); u.uBottom.value.set(L.sky); u.uTop.value.set(mix(mix(L.sky, '#4f9fe2', (1 - L.night) * (1 - r) * .55), '#060c22', L.night * .55)); u.uSun.value.set(L.sunPos[0], Math.max(.02, L.sunPos[1]), L.sunPos[2]); u.uGlow.value = Math.max(0, Math.min(1, (1.8 - L.sunI) / 1.0)) * (1 - L.night) * (1 - r); u.uGlowColor.value.set(L.sunColor); } scene.fog.color.set(L.fog); seaMat.color.set(L.sea); if (gradeEl) { const warm = Math.max(0, Math.min(1, (1.6 - L.sunI) / .9)) * (1 - L.night), cool = L.night; gradeEl.style.setProperty('--tint', cool > .3 ? 'rgba(40,60,140,' + (cool * .12).toFixed(3) + ')' : 'rgba(255,150,70,' + (warm * .1).toFixed(3) + ')'); }
  { const k = (.05 + clamp(0, (1.55 - L.hemiI) / .55, 1) * .28) * (1 - .4 * L.night);   // water holds its colour when the light is low
    seaMat.emissive.set(L.sea).multiplyScalar(k); built.shallows.material.color.set(mix(L.sea, '#d8fff6', .5)); built.shallows.material.emissive.set(L.sea).multiplyScalar(k * 1.3); }
  hemi.color.set(L.hemiSky); hemi.groundColor.set(L.hemiGround); hemi.intensity = L.hemiI;
  sun.color.set(L.sunColor); sun.intensity = L.sunI; sun.position.set(...L.sunPos);
  const gm = built.glow.material; gm.opacity = L.glow; built.glow.visible = L.glow > .02;
  sky.visible = L.stars > .02; sky.userData.stars.material.opacity = L.stars; sky.userData.moon.material.opacity = L.stars * .95;
  { const r = sim.weather.rain; { let n = 0; if (r > .25) sim.residents.forEach((q, i) => { const g = people.get(q.id); if (g.visible && q.state === 'walking') umbrellas.userData.set(n++, g.position.x, g.position.y, g.position.z, g.rotation.y, BROLLY[i % BROLLY.length]); }); umbrellas.userData.show(n); } rain.position.set(view.x, 0, view.z); rain.userData.update(time, season === 'winter' || r < .02 ? 0 : r);
    const day = 1 - L.night, amount = season === 'winter' ? Math.max(.25, r) : season === 'summer' ? (L.night > .5 ? .7 * (1 - r) : 0) : (season === 'autumn' ? .5 : .4) * day * (1 - r * .7);
    fall.position.set(view.x, 0, view.z); fall.userData.update(time, amount, windNow);
    sound.update({dark: L.night, rain: r, season, hour: sim.hour, trainMoving: Math.abs(sim.train.v) > .1, trainAt: sim.train.at, zoom: 1 - clamp(0, (view.dist - 7) / 50, 1)}, 0.0001 + lastDt); }
  // the street lamps, one by one as the lamplighter reaches them (faint in daylight, bright after dark), and the puddles
  built.lampGlow.material.opacity = .4 + .55 * L.night;
  sim.lamps.forEach((l, i) => { const v = Math.round(l.lit * 20) / 20; if (v !== lampDrawn[i]) { lampDrawn[i] = v; built.lampGlow.userData.set(i, v); } });
  puddles.userData.set(sim.weather.wet);
  sky.position.copy(camera.position); dome.position.copy(camera.position); document.body.style.background = L.sky; return L;
}
let lastDt = 0;
function sync(dt) {
  time += dt; lastDt = dt; marketGoods.visible = sim.market.open; U.time.value = time; windNow = wind(time); U.wind.value.set(windNow.x, windNow.z);
  sim.train.stations.forEach((st, i) => signals.userData.set(i, sim.signalFor(st.id) === 'red'));
  for (const r of sim.residents) {
    const g = people.get(r.id); g.visible = r.state === 'walking' || r.onPlatform; if (!g.visible) continue;
    const step = time * (r.lampJob ? 16 : r.hurry ? 14 : 9) + r.speed * 40, y = heightAt(r.x, r.z);
    const standing = r.state !== 'walking', chat = !standing && r.pause > 0 && r.look;   // (standing: waiting on a platform, a step up from the ground)
    const onPier = r.at === 'pier' && r.state === 'inside', stall = r.at === 'market' && r.state === 'inside' && sim.market.open && VENDORS.includes(r.id);
    if (stall) { const m = marketDef, lx = [-1.12, 0, 1.12][VENDORS.indexOf(r.id)] ?? 0, lz = -.25, c = Math.cos(m.ry), sn = Math.sin(m.ry), sc = m.scale || 1; r.tx = Math.sin(m.ry); r.tz = Math.cos(m.ry); g.position.set(m.x + (lx * c + lz * sn) * sc, heightAt(m.x, m.z) + .1, m.z + (-lx * sn + lz * c) * sc); g.rotation.set(0, m.ry, 0); }
    else g.position.set(r.x, onPier ? .24 : y + (standing ? .19 : .02 + (chat ? Math.abs(Math.sin(time * 7)) * .025 : Math.abs(Math.sin(step)) * .035)), r.z); g.rotation.set(0, chat ? Math.atan2(r.look.x - r.x, r.look.z - r.z) : Math.atan2(r.tx, r.tz), chat || standing ? 0 : Math.sin(step) * .09);
    if (onPier) g.rotation.y = Math.PI / 2;   // facing out to sea
    const rod = rods.get(r.id); if (rod) { rod.visible = onPier; if (onPier) rod.userData.bob.position.y = -.1 + Math.sin(time * 2.3 + r.speed * 9) * .012; }
  }
  { const near = view.dist < 27; if (near !== shadowsNear) { shadowsNear = near; for (const g of people.values()) g.traverse(o => { if (o.isMesh) o.castShadow = near; }); for (const g of cars.values()) g.traverse(o => { if (o.isMesh) o.castShadow = near; }); } }   // (far away the little shadows are not worth a draw each)
  for (const v of sim.vehicles) {
    const g = cars.get(v.id); g.visible = v.state !== 'parked'; if (!g.visible) continue;
    const y = heightAt(v.x, v.z), ahead = heightAt(v.x + v.tx * .3, v.z + v.tz * .3);
    g.position.set(v.x, y + .035 + (v.v > .05 ? Math.abs(Math.sin(time * 14 + v.s)) * .008 : 0), v.z); g.rotation.set(-Math.atan2(ahead - y, .3), Math.atan2(v.tx, v.tz), 0, 'YXZ');
  }
  trainCars.forEach((c, k) => { const q = along(loop, sim.train.s - k * sim.train.gap), y = heightAt(q.x, q.z) + .06; c.position.set(q.x, y, q.z); c.rotation.y = Math.atan2(q.tx, q.tz); c.updateMatrixWorld(true); });   // the cars follow the head round the loop
  updateFreight(); refreshTrack(); if (paperMode && Math.abs(sim.clock - paperAt) > 1) { paperAt = sim.clock; renderPaper(); }
  { trainCars[0].localToWorld(v3b.set(0, .66, .36)); const moving = Math.abs(sim.train.v) > .1;   // the engine's smoke: more when it is working
    smoke.update(dt, {x: v3b.x, y: v3b.y, z: v3b.z, vx: windNow.x * .14, vz: windNow.z * .14}, moving ? 5 : 1.2);
    smoke.puffs.forEach((p, i) => { const z = smoke.size(p); smokeM.makeScale(z, z, z).setPosition(p.x, p.y, p.z); smokeMesh.setMatrixAt(i, smokeM); }); smokeMesh.instanceMatrix.needsUpdate = true; }
  moveCritters(dt); boat.position.y = -.02 + Math.sin(time * 1.3) * .022; boat.rotation.z = Math.sin(time * 1.1) * .03;
  built.moving.top.inner.rotation.y = time * 2.2; built.moving.sails.inner.rotation.z = -time * .55;
  built.moving.minute.inner.rotation.z = -time * .1; built.moving.hour.inner.rotation.z = -time * .1 / 12;
  clouds.rotation.y = time * .012;
  const k = Math.min(1, dt * 6); view.x += (view.tx - view.x) * k; view.z += (view.tz - view.z) * k; view.yaw += (view.tyaw - view.yaw) * k; view.dist += (view.tdist - view.dist) * k;
  if (toastAt > 0 && (toastAt -= dt) <= 0 && toastEl) toastEl.classList.remove('on');
  if ((jobsAt -= dt) <= 0) { jobsAt = .5; refreshJobs(); }
  trackSelection(dt); placeCamera(); weatherLight(); news(); caption();
}
// A phone pass: if frames run slow (under ~24 fps for two seconds) the render resolution steps down, and creeps back up when there is room.
const maxPR = Math.min(devicePixelRatio || 1, phone ? 1.5 : 2); let slow = 0, fast = 0, spent = 0, frames = 0;
// Picture quality: a tier (see quality.mjs) switches the costly effects. The governor drops a tier after a slow spell and tries one up again after a long smooth one; resolution only goes down once at the lowest tier.
const gradeEl = document.getElementById('grade');
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let tier = 'high';
function applyTier(t) {
  tier = t; const p = PROFILE[t]; U.waves.value = p.waves; U.foam.value = p.foam; U.sway.value = p.sway * (reduceMotion ? .3 : 1); tufts.userData.show(p.tufts);
  if (gradeEl) gradeEl.style.opacity = p.grade ? '1' : '0'; dome.visible = !!p.glow;
}
const forcedQ = isTier(q.get('quality')) ? q.get('quality') : isTier(settings.quality) ? settings.quality : null;
const gov = createGovernor(startTier({forced: forcedQ, phone}), {locked: !!forcedQ || q.get('tune') === '0'});
applyTier(gov.tier);
function setQuality(choice) { if (isTier(choice)) { gov.locked = true; gov.tier = choice; applyTier(choice); } else { gov.locked = false; gov.cap = 'high'; } }
function tune(dt) {
  if (q.get('tune') === '0') return; spent += dt; frames++; if (spent < 2) return;
  const avg = spent / frames; spent = 0; frames = 0;
  const pr = renderer.getPixelRatio(), act = gov.step(avg, pr >= maxPR);
  if (act) { applyTier(gov.tier); if (act === 'down') return; }
  if (avg > .042 && gov.tier === 'low' && pr > .75) { renderer.setPixelRatio(Math.max(.75, pr - .25)); renderer.setSize(innerWidth, innerHeight, false); slow++; fast = 0; if (pr <= 1 && sun.castShadow) { sun.castShadow = false; } }
  else if (avg < .022 && pr < maxPR && ++fast >= 3) { renderer.setPixelRatio(Math.min(maxPR, pr + .25)); renderer.setSize(innerWidth, innerHeight, false); fast = 0; }
}
// ?debug=1: a small readout of what the picture costs (frames a second, draw calls, triangles, resolution, tier)
if (q.get('debug') === '1') {
  const el = document.createElement('div'); el.id = 'dbg'; el.setAttribute('aria-hidden', 'true'); document.body.append(el); let acc = 0, n = 0, at = performance.now();
  window.__dbg = dt => { acc += dt; n++; if (performance.now() - at < 500) return; const i = renderer.info.render; el.textContent = (n / acc).toFixed(0) + ' fps · ' + (acc / n * 1000).toFixed(1) + ' ms · ' + i.calls + ' calls · ' + (i.triangles / 1000).toFixed(0) + 'k tris · ratio ' + renderer.getPixelRatio() + ' · ' + tier + (gov.locked ? ' (fixed)' : ' (auto)'); acc = 0; n = 0; at = performance.now(); };
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, last ? (t - last) / 1000 : 0); last = t;
  if (frozen || document.hidden) return;
  const n = stepsFor(dt, settings.speed); for (let i = 0; i < n; i++) sim.update(dt * settings.speed / n);
  sync(dt); renderer.render(scene, camera); tune(dt); if (window.__dbg) window.__dbg(dt);
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
  info: () => ({market: sim.market.open, marketVisits: sim.market.visits, delivered: sim.freightStats.delivered, cargoNow: sim.cargo.length, riders: sim.riders.length, trainLaps: sim.train.laps, trainStops: sim.train.stopsMade, lampsLit: sim.lamps.filter(l => l.on).length, wet: +sim.weather.wet.toFixed(2), season, pixelRatio: renderer.getPixelRatio(), story: sim.story.current && sim.story.current.id, rain: +sim.weather.rain.toFixed(2), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, residentsOut: sim.residents.filter(r => r.state === 'walking').length, clock: sim.clock}),
  look(x, z, dist, yaw = 0) { Object.assign(view, {x, z, dist, yaw, tx: x, tz: z, tdist: dist, tyaw: yaw}); placeCamera(); renderer.render(scene, camera); },
  advance(seconds) { for (let t = 0; t < seconds; t += .05) sim.update(.05); sync(0); renderer.render(scene, camera); },
  trainPos: () => trainCars[0].position, selected: () => sel, tapAt: (cx, cy) => tap(cx, cy), select, sendParcel: (a, b) => sim.sendParcel(a, b), jobsText: () => jobsText, trackText: () => (trackEl ? trackEl.textContent : ''), trackState: () => ({tracked, trackAt, el: !!trackEl}),
  project(x, z, y = .4) { const r = canvas.getBoundingClientRect(); camera.updateMatrixWorld(); v3.set(x, heightAt(x, z) + y, z).project(camera); return [(v3.x * .5 + .5) * r.width + r.left, (-v3.y * .5 + .5) * r.height + r.top]; },
  setWeather(kind, seconds = 600) { sim.weather.force(kind, seconds); },
  paperText: () => (paperEl ? paperEl.textContent : ''), openPaper, closePaper, rodsOut: () => [...rods.values()].filter(r => r.visible).length, highlight: () => ({pin: pin.visible, ring: ring.visible, mode: settings.highlight}), settings, applySettings, setQuality, tier: () => tier, gov, tufts, U, freeze(on = true) { frozen = on; }
};
