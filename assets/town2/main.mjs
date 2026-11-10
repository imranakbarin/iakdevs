// New Toy Town: the page. Renderer, camera and controls, lights, and the loop that moves the cast and vehicles.
import * as THREE from 'three';
import {PALETTE as P, ISLAND, CAST, VEHICLES, heightAt} from './def.mjs';
import {createSim} from './sim.mjs';
import {buildTown, buildResident, buildVehicle, buildClouds} from './build.mjs';

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
scene.add(built.ground, built.sea, built.town); for (const m of Object.values(built.moving)) scene.add(m.group);
const clouds = buildClouds(); scene.add(clouds);
const people = new Map(), cars = new Map();
sim.residents.forEach((r, i) => { const g = buildResident(r.def, i, built.material); scene.add(g); people.set(r.id, g); });
sim.vehicles.forEach(v => { const g = buildVehicle(v.def, built.material); scene.add(g); cars.set(v.id, g); });

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

/* ---- the loop ---- */
let last = 0, frozen = false, time = 0;
function sync(dt) {
  time += dt;
  for (const r of sim.residents) {
    const g = people.get(r.id); g.visible = r.state === 'walking'; if (!g.visible) continue;
    const step = time * 9 + r.speed * 40, y = heightAt(r.x, r.z);
    g.position.set(r.x, y + .02 + Math.abs(Math.sin(step)) * .035, r.z); g.rotation.set(0, Math.atan2(r.tx, r.tz), Math.sin(step) * .09);
  }
  for (const v of sim.vehicles) {
    const g = cars.get(v.id), y = heightAt(v.x, v.z), ahead = heightAt(v.x + v.tx * .3, v.z + v.tz * .3);
    g.position.set(v.x, y + .035 + (v.v > .05 ? Math.abs(Math.sin(time * 14 + v.s)) * .008 : 0), v.z); g.rotation.set(-Math.atan2(ahead - y, .3), Math.atan2(v.tx, v.tz), 0, 'YXZ');
  }
  built.moving.top.inner.rotation.y = time * 2.2; built.moving.sails.inner.rotation.z = -time * .55;
  built.moving.minute.inner.rotation.z = -time * .1; built.moving.hour.inner.rotation.z = -time * .1 / 12;
  clouds.rotation.y = time * .012;
  const k = Math.min(1, dt * 6); view.x += (view.tx - view.x) * k; view.z += (view.tz - view.z) * k; view.yaw += (view.tyaw - view.yaw) * k; view.dist += (view.tdist - view.dist) * k;
  placeCamera();
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, last ? (t - last) / 1000 : 0); last = t;
  if (frozen || document.hidden) return;
  sim.update(dt); sync(dt); renderer.render(scene, camera);
}
resize(); fit(); placeCamera(); requestAnimationFrame(frame);
const hint = document.getElementById('hint'); if (hint) setTimeout(() => { hint.style.opacity = '0'; }, 6000);

// Hooks for tests and screenshots.
window.ToyTownNew = {
  sim, scene, camera, renderer, view,
  info: () => ({calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, residentsOut: sim.residents.filter(r => r.state === 'walking').length, clock: sim.clock}),
  look(x, z, dist, yaw = 0) { Object.assign(view, {x, z, dist, yaw, tx: x, tz: z, tdist: dist, tyaw: yaw}); placeCamera(); renderer.render(scene, camera); },
  advance(seconds) { for (let t = 0; t < seconds; t += .05) sim.update(.05); sync(0); renderer.render(scene, camera); },
  freeze(on = true) { frozen = on; }
};
