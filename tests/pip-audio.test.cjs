// Pip Run sound: runs the synthesizer against a stub AudioContext (every
// ramp target must be positive and finite, as browsers require), then plays
// the game with sound on and checks which events it voices, and that a ghost
// rebuild stays silent.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
assert.match(fs.readFileSync(path.join(root, 'pip-run.html'), 'utf8'), /assets\/pip-audio\.js\?v=\d+[\s\S]*assets\/pip-run\.js/, 'audio loads before the game');

const count = {started: 0}, clock = {t: 0}, trace = [];
const param = () => ({
  value: 0,
  setValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t), 'finite setValueAtTime'); trace.push(Math.round(v)); },
  exponentialRampToValueAtTime(v, t) { assert.ok(v > 0 && Number.isFinite(v) && Number.isFinite(t), `exponential ramp to ${v}`); },
  linearRampToValueAtTime(v, t) { assert.ok(Number.isFinite(v) && Number.isFinite(t)); },
  setTargetAtTime(v, t, c) { assert.ok(Number.isFinite(v) && Number.isFinite(t) && c > 0, `target ${v}`); }
});
class Node {
  constructor() { for (const k of ['gain', 'frequency', 'Q', 'detune', 'threshold', 'ratio']) this[k] = param(); }
  connect(d) { assert.ok(d, 'connects to a node'); return d; }
  start(t = 0) { assert.ok(Number.isFinite(t)); count.started++; }
  stop() {}
}
class AC {
  get currentTime() { return clock.t; }
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(); }
  createGain() { return new Node(); } createOscillator() { return new Node(); } createBufferSource() { return new Node(); }
  createBiquadFilter() { return new Node(); } createDynamicsCompressor() { return new Node(); }
  createBuffer(c, n) { return {getChannelData: () => new Float32Array(n)}; }
  resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); }
}
let store = {};
const ctx2d = new Proxy({}, {get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({addColorStop() {}}) : k === 'measureText' ? () => ({width: 10}) : () => {}, set: () => true});
const canvas = () => ({getContext: () => ctx2d, clientWidth: 1363, clientHeight: 936, width: 0, height: 0, addEventListener() {}, setPointerCapture() {}});
const game = canvas();
const sandbox = {
  AudioContext: AC, localStorage: {getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }},
  document: {getElementById: () => game, createElement: () => canvas(), hidden: false, addEventListener() {}},
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
  matchMedia: () => ({matches: false, addEventListener() {}}), addEventListener() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  performance: {now: () => 0}, devicePixelRatio: 1, location: {origin: 'http://x', hash: ''}, Math, Set, Map, Uint8Array, Float32Array, Promise
};
sandbox.window = sandbox;
const context = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/pip-audio.js'), 'utf8'), context);
const A = vm.runInContext('PipAudio', context);

// Off by default, and the choice is remembered.
assert.equal(A.mode(), 0); A.fx('jump'); assert.equal(count.started, 0, 'silent while off');
A.cycle(); assert.equal(A.mode(), 1); assert.equal(store['pip-run:sound'], 'fx');
A.cycle(); assert.equal(A.mode(), 2); assert.equal(store['pip-run:sound'], 'music');

// Every effect builds a valid graph.
for (const name of ['step', 'jump', 'land', 'seed', 'bump', 'smash', 'sprout', 'grow', 'shrink', 'stomp', 'spring', 'tumble', 'crumble', 'spit', 'arrive', 'find', 'place', 'refuse', 'gotcha', 'ui', 'rustle', 'splash'])
  for (const o of [{}, {surface: 'grass'}, {surface: 'snow'}, {surface: 'moss'}, {surface: 'ice'}, {surface: 'cloud'}, {surface: 'crystal'}, {surface: 'wood'}, {surface: 'stone'}, {surface: 'sand'}, {snow: true}, {impact: 9, streak: 12, v: 1}]) A.fx(name, o);
// Each landmark's arrival scene sounds different, and fuller than the bare fanfare.
const voices = mark => { const n = count.started; trace.length = 0; A.fx('arrive', {mark}); return [count.started - n, trace.filter(v => v > 1).sort((a, b) => a - b).join()]; };
const [plain] = voices(undefined), scenes = ['meadow', 'frost', 'sky', 'caves', 'coast'].map(voices);
for (const [n] of scenes) assert.ok(n >= plain, `a landmark scene adds to the fanfare (${n} vs ${plain} voices)`);
assert.equal(new Set(scenes.map(q => q[1])).size, 5, 'five distinct scene sounds');

// Thirty seconds of ambience and score across all biomes and tensions.
const before = count.started;
for (let i = 0; i < 1800; i++) {
  const k = ['meadow', 'frost', 'sky', 'caves', 'coast'][Math.floor(i / 360)];
  clock.t += 1 / 60;
  A.update({biomes: {[k]: 1}, biome: k, tension: (i % 600) / 600, wind: Math.sin(i / 90), night: (i % 450) / 450, dt: 1 / 60});
}
assert.ok(count.started - before > 60, `score and details played (${count.started - before} voices)`);
// A meadow night is alive with crickets.
A.cycle(); A.cycle(); assert.equal(A.mode(), 1, 'effects without the score');
const dusk = count.started;
for (let i = 0; i < 3600; i++) { clock.t += 1 / 60; A.update({biomes: {meadow: 1}, biome: 'meadow', tension: 0, wind: 0, night: 1, dt: 1 / 60}); }
assert.ok(count.started - dusk > 40, `crickets at night (${count.started - dusk} voices in 60 s)`);   // ~36 chirps expected; random, so a long sample
A.cycle();
A.pause(true); const paused = count.started; A.update({biomes: {meadow: 1}, biome: 'meadow', tension: 0, wind: 0, dt: 1}); A.fx('jump');
assert.equal(count.started, paused, 'silent while paused'); A.pause(false);

// The game voices its events, and a ghost rebuild is silent.
vm.runInContext(fs.readFileSync(path.join(root, 'assets/pip-run.js'), 'utf8'), context);
const G = sandbox.__pipRun, heard = {};
A.fx = (name) => { heard[name] = (heard[name] || 0) + 1; };
G.reset(5); for (let f = 0; f < 60 * 100; f++) G.tick();
for (const name of ['step', 'jump', 'land', 'seed', 'bump', 'arrive']) assert.ok(heard[name], `the game never voiced "${name}" (${JSON.stringify(heard)})`);
const total = Object.values(heard).reduce((a, b) => a + b, 0), code = G.ghost.encode();
G.ghost.race(code);
assert.equal(Object.values(heard).reduce((a, b) => a + b, 0), total, 'ghost rebuild is silent');
console.log(`Pip Run sound PASS: 22 effects build valid graphs, five landmark scenes sound distinct, ambience and score over 5 biomes, crickets after sunset (${count.started} voices), off by default and remembered, silent while paused, game voices ${Object.keys(heard).length} event kinds, ghost rebuilds are silent.`);
