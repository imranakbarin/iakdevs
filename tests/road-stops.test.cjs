// Road trip stops and the horn: a tap pulls over for the next visible stop, the
// car brakes smoothly to a halt with the stop just ahead, waits, and drives on
// by itself or on the next tap; stops visited are kept once; a tap on the car
// sounds the horn; nothing is offered mid-overtake or for a stop that would not
// be drawn. Runs the module against stubs of the road globals it reads.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /assets\/road-journey\.js\?v=\d+"><\/script>\s*<script src="assets\/road-stops\.js\?v=\d+">/, 'the module loads');
assert.match(html, /RoadStops\.cruise\(journey\*42\)/, 'the drive asks it how fast to go');
assert.match(html, /RoadStops\.frame\(c,w,h,dominant\)/, 'and draws its part of each frame');
assert.match(html, /RoadStops\.install\(\)/, 'and installs it');

const store = {}, cues = [], els = {};
const sandbox = {
  Math, Object, Array, JSON, Set, String, Number,
  localStorage: {getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }},
  document: {getElementById: id => els[id] || null, createElement: () => ({style: {}, setAttribute() {}}), body: {append(e) { els[e.id] = e; }}},
  requestAnimationFrame: f => f(), performance: {now: () => 0}, addEventListener() {}, setInterval() {},
  SceneMotion: {time: 0, lane: {x: .52}}, cv: {width: 1366, height: 800, addEventListener() {}}, DPR: 1, modeBtn: {value: 'road'}, playing: true, speed: 40, journey: 0, tripDrive: {x: 1, v: 0}, seed: 1,
  places: ['Mountain pass', 'Desert highway', 'Forest trail', 'Coastal drive', 'City outskirts'].map(name => ({name})),
  // Stops every 260 road units, as the road places them.
  RoadIllustration: {encounters(j) { const cam = j * 42, out = []; for (let k = Math.floor(cam / 260); k <= Math.floor(cam / 260) + 6; k++) { const d = k * 260 + 120 - cam, z = 36 / d - .025; if (d > 34 && z > 0 && z < 1.03) out.push({i: k, z, side: k % 2 ? 1 : -1, variant: k % 3}); } return out; }, onRiver: () => false},
  roadProjection: (j, w, h, horizon) => ({rx: () => w / 2, hw: z => w * .45 * z, yy: z => horizon + (h - horizon) * z}),
  roadObjectTheme: (key, z) => 0, roadDryGround: () => 1, roadThemeFit: () => 1,
  RoadTraffic: {snapshot: () => ({state: sandbox.overtaking ? 'passing' : 'follow'})},
  WorldSound: {cue: k => cues.push(k)}, overtaking: false
};
const box = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/road-stops.js'), 'utf8') + ';this.RoadStops = RoadStops;', box);
const R = sandbox.RoadStops;
const drive = secs => { for (let i = 0; i < secs * 60; i++) { const dt = 1 / 60, f = R.cruise(sandbox.journey * 42); sandbox.tripDrive.x += (40 / 40 * f - sandbox.tripDrive.x) * (1 - Math.exp(-dt * 2.4)); sandbox.journey += sandbox.tripDrive.x * dt; sandbox.SceneMotion.time += dt; R.frame(new Proxy({}, {get: (o, k) => k === 'createRadialGradient' ? () => ({addColorStop() {}}) : () => {}, set: () => true}), 1366, 800, 0); } };

// Nothing to stop for in the middle of an overtake.
sandbox.overtaking = true; assert.equal(R.reachable(0), null, 'no stop is offered while overtaking'); sandbox.overtaking = false;
// A stop the road would not draw where the car parks is passed by.
sandbox.RoadIllustration.onRiver = () => true; assert.equal(R.reachable(0), null, 'not one over a river'); sandbox.RoadIllustration.onRiver = () => false;

drive(2);
const e = R.reachable(sandbox.journey * 42);
assert.ok(e && e.ahead, 'a stop ahead can be reached');
assert.equal(R.tap(100, 100), 'stop', 'a tap on the road pulls over');
assert.equal(els['road-stop-hint'] ? els['road-stop-hint'].style.opacity : '0', '0', 'the hint goes once pulling over');
let peak = 0, parkedAt = null, prev = sandbox.tripDrive.x;
for (let s = 0; s < 20 * 60 && !parkedAt; s++) {
  drive(1 / 60);
  peak = Math.max(peak, prev - sandbox.tripDrive.x); prev = sandbox.tripDrive.x;
  if (R.state() && R.state().phase === 'parked') parkedAt = sandbox.SceneMotion.time;
}
assert.ok(parkedAt, 'the car comes to a halt');
const st = R.state(), gap = st.s - sandbox.journey * 42;
assert.ok(Math.abs(gap - st.ahead) < 12, `with the stop just ahead (${gap.toFixed(1)} units, aiming for ${st.ahead})`);
assert.ok(peak < .02, `braking is smooth (largest drop ${peak.toFixed(4)} of cruise in a frame)`);
assert.ok(els['road-stop-card'] && /PULLED OVER · MOUNTAIN PASS/.test(els['road-stop-card'].innerHTML) && /1 of 15 stops/.test(els['road-stop-card'].innerHTML), 'a card names the stop and counts it');
assert.ok(R.pace() < .05, 'the trip clock waits while parked');
drive(2); const j0 = sandbox.journey; drive(5);
assert.ok((sandbox.journey - j0) * 42 < .5, `and once settled the car stays put (${((sandbox.journey - j0) * 42).toFixed(2)} units in 5 s)`);
// The horn: a tap on the car.
const horizon = 800 * .44, z = .88, hx = 683 + 1366 * .45 * z * .52, hy = horizon + (800 - horizon) * z - 1366 * .45 * z * .44 * .3;
assert.equal(R.tap(hx, hy), 'honk', 'a tap on the car sounds the horn');
assert.deepEqual(cues, ['honk']);
assert.equal(R.state().phase, 'parked', 'and does not drive on');
// It drives on by itself after a while, and the stop is kept once.
drive(8);
assert.equal(R.state(), null, 'it drives on by itself');
drive(4);
assert.ok(sandbox.tripDrive.x > .7, 'back up to speed');
assert.deepEqual(JSON.parse(store['road-trip:stops']), [st.name], 'the stop is in the trip log');
// A second stop: the next tap drives on early.
drive(3);
assert.equal(R.tap(100, 100), 'stop');
for (let s = 0; s < 20 * 60 && R.state().phase !== 'parked'; s++) drive(1 / 60);
assert.equal(R.tap(100, 100), 'go', 'a tap while parked drives on');
assert.equal(R.state(), null);
console.log(`Road stops PASS: pulls over for a visible stop (never mid-overtake), brakes smoothly to ${gap.toFixed(0)} units short of it, waits with the trip clock paused, the horn on a tap of the car, drives on by itself or on a tap, ${R.stops()} stops kept.`);
