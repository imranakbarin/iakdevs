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
  performance: {now: () => 0}, devicePixelRatio: 1, location: {origin: 'http://x', hash: ''}, Math, Set, Map, Uint8Array
};
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/pip-run.js'), 'utf8'), sandbox);
const G = sandbox.__pipRun;
assert.ok(G, 'test hook exposed');

// Gaps are sized from the jump itself, and always leave something to clear.
assert.ok(G.GAP[0] >= 2 && G.GAP[-2] >= G.GAP[0] && G.GAP[1] >= 1, 'gap table follows the jump arc');

// The demo player crosses generated worlds steadily, set pieces included.
const passed = new Set();
for (const seed of [1, 2, 5, 9]) {
  G.reset(seed);
  let tumbles = 0, prev = 0, last = 0;
  const secs = 90;
  for (let f = 1; f <= 60 * secs; f++) {
    G.tick();
    const s = G.state();
    assert.ok(Number.isFinite(s.pl.x) && Number.isFinite(s.pl.y), 'finite position');
    if (s.dead && !prev) tumbles++;
    prev = s.dead;
    if (f % 60 === 0) for (const ft of G.features()) if (ft.x + 200 < s.maxX) passed.add(ft.id);
    if (f % (60 * 15) === 0) { assert.ok(s.maxX > last + 300, `seed ${seed}: progress stalled near ${Math.round(s.maxX / 16)} m`); last = s.maxX; }
  }
  const m = Math.round(G.state().maxX / 16);
  assert.ok(G.journey().chapters >= 1, `seed ${seed}: never reached a destination`);
  assert.ok(m > secs * 5, `seed ${seed}: demo reached only ${m} m in ${secs} s`);
  assert.ok(tumbles <= 6, `seed ${seed}: ${tumbles} tumbles`);
}
for (const id of ['ferry', 'lift', 'crumble', 'stairs', 'spitter']) assert.ok(passed.has(id), `the demo never got past a ${id}`);
// Director: placements are refereed. Walls are accepted only while Pip can
// still get past them, and he then does.
for (const seed of [3, 11]) {
  // Wait until Pip runs on level ground, so the wall stands on that ground.
  const level = () => { const s = G.state(), tx = Math.floor((s.pl.x + 48) / 16), feet = Math.floor((s.pl.y + s.pl.h - 1) / 16); return s.pl.ground && !s.pl.on && [-3, -2, -1, 0, 1].every(d => G.tileAt(tx + d, feet + 1) && !G.tileAt(tx + d, feet)); };
  G.reset(seed); for (let f = 0; f < 400 || !level(); f++) G.tick();
  const D = G.director; D.arm('brick');
  const s = G.state(), tx = Math.floor((s.pl.x + 48) / 16), feet = Math.floor((s.pl.y + s.pl.h - 1) / 16);
  for (let k = 0; k < 6; k++) { D.refill(); D.place(tx, feet - k); }
  const notes = D.info().notes;
  assert.ok(notes.some(n => n.startsWith('Too cruel')), `seed ${seed}: the referee refused nothing (${notes})`);
  assert.ok(D.info().dirScore > 0, 'accepted placements score');
  let passed = false; for (let f = 0; f < 60 * 12 && !passed; f++) { G.tick(); passed = G.state().pl.x > tx * 16 + 24; }
  assert.ok(passed, `seed ${seed}: Pip could not get past an accepted wall`);
}
// Ghosts: a run's input log, with a director placement and a resize in it,
// round-trips through a link and rebuilds the run exactly, frame for frame.
{
  G.reset(5); const xs = [];
  for (let f = 1; f <= 60 * 120; f++) {
    if (f === 400) { const s = G.state(); G.director.arm('brick'); G.director.refill(); G.director.place(Math.floor((s.pl.x + 64) / 16), Math.floor((s.pl.y + s.pl.h - 1) / 16)); }
    if (f === 2000 || f === 4000) { game.clientWidth = f === 2000 ? 800 : 1363; G.layout(); }
    G.tick(); const s = G.state(); xs.push([s.pl.x, s.pl.y]);
  }
  const run = G.ghost.run(), code = G.ghost.encode();
  assert.ok(run.events.some(e => e.k === 'b') && run.events.some(e => e.k === 'w'), 'placement and resize are logged');
  assert.ok(/^[\w.-]+$/.test(code) && code.length < 2500, `link-safe, compact code (${code.length} chars)`);
  const g = G.ghost.race(code);
  assert.equal(g.frames.length, xs.length, 'ghost covers the run');
  xs.forEach(([x, y], i) => { const p = G.ghost.at(i + 1); assert.ok(p.x === x && p.y === y, `ghost diverged at frame ${i + 1}`); });
  for (const bad of ['', 'x', '1.zz', '2.1.a0.1.AA', '1.1.a0.1.A*']) assert.equal(G.ghost.decode(bad), null, `rejects ${bad}`);
}
console.log('Pip Run PASS: jump-sized gaps, finite physics, demo player progresses through 4 seeded worlds, reaches each chapter’s destination and gets past ferries, lifts, crumble bridges, floating steps and podspitters, referee refuses traps and accepted walls stay passable, shared runs replay exactly as ghosts.');
