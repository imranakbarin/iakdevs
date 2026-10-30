// Soundscapes and the road-trip journey, run headless against stubs of the
// page state they read. The AudioContext stub rejects ramps browsers reject
// (non-positive or non-finite exponential targets).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /<button id="sound"[^>]*>/, 'the bar has a sound button');
assert.match(html, /assets\/road-journey\.js\?v=\d+[\s\S]*assets\/world-sound\.js\?v=\d+/, 'both modules load');
assert.match(html, /WorldSound\.install\(\)/, 'sound is installed');
assert.match(html, /RoadJourney\.update\(/, 'the road status comes from the journey');

const count = {voices: 0}, clock = {t: 0};
const param = () => ({
  value: 0,
  setValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); },
  exponentialRampToValueAtTime(v, t) { assert.ok(v > 0 && Number.isFinite(v) && Number.isFinite(t), `exponential ramp to ${v}`); },
  linearRampToValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); },
  setTargetAtTime(v, t, c) { assert.ok(Number.isFinite(v) && Number.isFinite(t) && c > 0, `target ${v}`); }
});
class Node {
  constructor() { for (const k of ['gain', 'frequency', 'Q', 'detune', 'threshold', 'ratio']) this[k] = param(); }
  connect(d) { assert.ok(d); return d; } start() { count.voices++; } stop() {}
}
class AC {
  get currentTime() { return clock.t; }
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(); }
  createGain() { return new Node(); } createOscillator() { return new Node(); } createBufferSource() { return new Node(); }
  createBiquadFilter() { return new Node(); } createDynamicsCompressor() { return new Node(); } createConvolver() { return new Node(); }
  createBuffer(c, n) { return {getChannelData: () => new Float32Array(n)}; }
  resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
const els = {}, listeners = {}, store = {};
const element = id => els[id] || (els[id] = {id, value: '', hidden: false, textContent: '', style: {}, innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(e, f) { (listeners[id + ':' + e] = listeners[id + ':' + e] || []).push(f); }});
let frameCb = null;
const sandbox = {
  AudioContext: AC, Math, Promise, Float32Array, JSON, Set, Map, Object, Number, String,
  localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }},
  document: {hidden: false, getElementById: element, createElement: () => element('created-' + Object.keys(els).length), body: {append() {}}},
  addEventListener() {}, requestAnimationFrame: cb => { frameCb = cb; return 1; }, performance: {now: () => clock.t * 1000}, innerWidth: 1280
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
// The page state the modules read (normally the page's own globals).
vm.runInContext(`
  var modeBtn = {value: 'road'}, playing = true, drag = null, speed = 40, journey = 0, tripCue = 'Cruising';
  var roadAtmosphere = {current: {sun: .5, sunset: 0, rain: .5, fog: 0, snow: 0, night: .3}};
  var roadPlaceTransition = {current: [.2, .2, .2, .2, .2], autoTime: 0};
  var RoadTraffic = {snapshot: () => ({cars: [{id: 1, front: true, distance: Math.max(10, 200 - journey * 40)}]})};
  var zenDistance = 0, zenGarden = 'moon', zenRipples = [];
`, ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/world-sound.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/road-journey.js'), 'utf8'), ctx);
const S = vm.runInContext('WorldSound', ctx), J = vm.runInContext('RoadJourney', ctx), g = expr => vm.runInContext(expr, ctx);

// Sound: off by default and remembered; 30 s of every scene plays.
element('sty').value = 'japan';
S.install();
assert.equal(S.on(), false); assert.equal(element('sound').textContent, '♪ Sound off');
S.toggle(); assert.equal(S.on(), true); assert.equal(store['world-sound'], 'on'); assert.equal(element('sound').textContent, '♪ Sound on');
const run = (secs, step) => { for (let i = 0; i < secs * 60; i++) { clock.t += 1 / 60; if (step) step(i); frameCb(clock.t * 1000); } };
for (const [mode, step] of [['road', () => g('journey += .02')], ['zen', i => { g('zenDistance += 34 / 60'); if (i % 400 === 0) g('zenRipples.push({})'); }], ['art', null]]) {
  g(`modeBtn.value = '${mode}'`);
  const before = count.voices; run(mode === 'art' ? 60 : 30, step);   // the art scene's voices are sparse and random: 30 s sometimes held only ten
  assert.ok(count.voices - before > 10, `${mode}: the soundscape played (${count.voices - before} voices)`);
}
for (const style of ['gond', 'warli', 'madhubani', 'kangra', 'china', 'mexico']) { element('sty').value = style; run(30); }
g("modeBtn.value = 'cozy'"); const quiet = count.voices; run(5);
assert.equal(count.voices, quiet, 'no voices in a mode that keeps its own sound');
assert.equal(S.state(), 'suspended', 'and the context sleeps');

// Journey: a full place cycle in auto mode visits every landscape and stamps a postcard each time.
const places = ['Mountain pass', 'Desert highway', 'Forest trail', 'Coastal drive', 'City outskirts'].map(name => ({name}));
let shown = 0, label = '';
for (let f = 0, auto = 0; f < 60 * 44 * 5 + 60; f++) {
  auto += 1 / 60; const phase = auto / 44, frac = phase % 1, idx = Math.floor(phase) % 5, fade = Math.min(1, Math.max(0, (frac - 32 / 44) / (12 / 44)));
  const dominant = fade > .5 ? (idx + 1) % 5 : idx;
  label = J.update({dt: 1 / 60, km: f * 42 / 60 / 1000, speed: 42, dominant, auto: true, phase, weights: {sun: 1, rain: f % 900 < 300 ? .8 : 0}, weather: 'sun', names: places[dominant].name, cue: 'Cruising', stop: '', places});
  const card = Object.values(els).find(e => e.id && e.id.startsWith('created'));
  if (card && card.style.opacity === '1' && !card.counted) { card.counted = true; }
  shown = J.stamps();
}
assert.ok(shown >= 5, `a postcard per landscape (${shown} stamps)`);
assert.match(label, / in \d+\.\d km$|arriving$/, `the status counts down to the next town (${label})`);
assert.match(Object.values(els).find(e => e.innerHTML.includes('POSTCARD')).innerHTML, /came through rain/, 'postcards remember the weather on the way');
console.log(`World sound + road journey PASS: 3 soundscapes (${count.voices} voices) with valid ramps, off by default and remembered, silent in modes with their own sound; ${shown} postcards over a full place cycle, a live countdown, weather remembered.`);
