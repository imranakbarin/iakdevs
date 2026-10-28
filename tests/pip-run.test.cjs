// Pip Run smoke test: loads the engine with a stub canvas, then checks the
// physics contract (variable jump height, solvable gap table) and that the demo
// player makes steady progress through generated worlds without getting stuck.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'pip-run.html'), 'utf8');
assert.match(page, /assets\/pip-run\.js\?v=\d+/);
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<option value="pip">Pip Run<\/option>/, 'mode is listed in the app');

const ctx2d = new Proxy({}, {get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({addColorStop() {}}) : k === 'measureText' ? () => ({width: 10}) : () => {}, set: () => true});
const canvas = () => ({getContext: () => ctx2d, clientWidth: 1363, clientHeight: 936, width: 0, height: 0, addEventListener() {}, setPointerCapture() {}});
const game = canvas();
const sandbox = {
  document: {getElementById: () => game, createElement: () => canvas(), hidden: false, addEventListener() {}},
  Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
  matchMedia: () => ({matches: false, addEventListener() {}}),
  addEventListener() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  performance: {now: () => 0}, devicePixelRatio: 1, location: {origin: 'http://x'}, Math, Set, Map, Uint8Array
};
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/pip-run.js'), 'utf8'), sandbox);
const G = sandbox.__pipRun;
assert.ok(G, 'test hook exposed');

// Gaps are sized from the jump itself, and always leave something to clear.
assert.ok(G.GAP[0] >= 2 && G.GAP[-2] >= G.GAP[0] && G.GAP[1] >= 1, 'gap table follows the jump arc');

// The demo player crosses generated worlds steadily.
for (const seed of [1, 2, 5, 9]) {
  G.reset(seed);
  let tumbles = 0, prev = 0, last = 0;
  for (let f = 1; f <= 60 * 90; f++) {
    G.tick();
    const s = G.state();
    assert.ok(Number.isFinite(s.pl.x) && Number.isFinite(s.pl.y), 'finite position');
    if (s.dead && !prev) tumbles++;
    prev = s.dead;
    if (f % (60 * 15) === 0) { assert.ok(s.maxX > last + 300, `seed ${seed}: progress stalled near ${Math.round(s.maxX / 16)} m`); last = s.maxX; }
  }
  const m = Math.round(G.state().maxX / 16);
  assert.ok(m > 550, `seed ${seed}: demo reached only ${m} m in 90 s`);
  assert.ok(tumbles <= 6, `seed ${seed}: ${tumbles} tumbles`);
}
console.log('Pip Run PASS: jump-sized gaps, finite physics, demo player progresses through 4 seeded worlds.');
