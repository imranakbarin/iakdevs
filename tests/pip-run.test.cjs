// Pip Run smoke test: loads the engine with a stub canvas, then checks the
// physics contract (variable jump height, solvable gap table) and that the demo
// player makes steady progress through generated worlds without getting stuck.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'pip-run.html'), 'utf8');
assert.match(page, /assets\/pip-run\.js\?v=\d+/);
assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<option value="pip">Pip Run<\/option>/, 'mode is listed in the app');

// In strict mode every drawing call is checked the way a browser would: finite
// numbers, no negative radii (canvas throws on those).
let strict = false, drawn = 0;
const check = (k, a) => {
  if (!strict) return;
  drawn++;
  a.forEach(v => { if (typeof v === 'number') assert.ok(Number.isFinite(v), `${k}(${a.join(', ')})`); });
  const radii = {arc: [2], ellipse: [2, 3], createRadialGradient: [2, 5]}[k] || [];
  for (const i of radii) assert.ok(a[i] >= 0, `${k} with a negative radius: (${a.join(', ')})`);
};
const ctx2d = new Proxy({}, {get: (_, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? (...a) => { check(k, a); return {addColorStop() {}}; } : k === 'measureText' ? () => ({width: 10}) : (...a) => check(k, a), set: () => true});
const canvas = () => ({getContext: () => ctx2d, clientWidth: 1363, clientHeight: 936, width: 0, height: 0, addEventListener() {}, setPointerCapture() {}});
const game = canvas();
const sandbox = {
  document: {getElementById: () => game, createElement: () => canvas(), hidden: false, addEventListener() {}},
  Image: class { constructor() { this.complete = true; this.naturalWidth = this.naturalHeight = 64; } },   // 'loaded', so every painted path is drawn
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
// A block row that runs right up to a gap's edge (the generator no longer
// builds one, but a director can): the demo must not jump under the row and
// bonk; it runs off the lip and leaps in the coyote window. Small and big.
for (const grow of [false, true]) {
  G.reset(7); if (grow) G.director.grow();
  for (let x = 10; x <= 13; x++) G.tile(x, 8, 2);                 // bricks overhead
  for (const x of [14, 15]) for (let y = 12; y < 15; y++) G.tile(x, y, 0);   // a 2-tile gap
  let f = 0, fell = false;
  while (G.state().pl.x < 17 * 16 && f < 900) { G.tick(); f++; fell = fell || !!G.state().dead; }
  assert.ok(G.state().pl.x >= 17 * 16 && !fell, `${grow ? 'big' : 'small'} Pip ${fell ? 'fell into' : 'never crossed'} the gap under a block row`);
}
// Regression: on a phone-width screen, the 28 Oct 2026 daily world puts a
// block row right up to a gap's edge (870 m, caves, big Pip). The demo used
// to jump at the lip, bonk and retry forever; it now runs off the lip and
// leaps in the coyote window.
{
  game.clientWidth = 390; G.layout(); G.reset(160565862);
  let f = 0; while (G.state().maxX < 900 * 16 && f < 60 * 200) { G.tick(); f++; }
  assert.ok(G.state().maxX >= 900 * 16, `phone daily world stalled at ${Math.round(G.state().maxX / 16)} m`);
  game.clientWidth = 1363; G.layout();
}
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
// The painted world: every biome's ground, stone and stumps paint with sane
// geometry, once per chunk, and again only after a tile of theirs changes.
{
  const biomes = new Set();
  strict = true;
  for (const seed of [1, 5]) {
    G.reset(seed);
    for (let ci = 0; ci < 50; ci++) {
      drawn = 0; const r = G.art(ci);
      biomes.add(r.biome);
      assert.ok(drawn > 200 && r.art.y0 >= 0 && r.art.y0 < 15, `seed ${seed} chunk ${ci} (${r.biome}): painted ${drawn} calls from row ${r.art.y0}`);
    }
  }
  strict = false;
  assert.deepEqual([...biomes].sort(), ['caves', 'frost', 'meadow', 'sky'], 'all four biomes painted');
  G.reset(2); const a = G.art(1).art;
  assert.equal(G.art(1).art, a, 'a chunk is painted once');
  G.tile(24 + 5, 14, 0); assert.notEqual(G.art(1).art, a, 'and repainted when its ground changes');
}
// Pip touches the world: whole frames render with sane geometry in every
// biome while footfalls kick up particles and leave prints in snow, cloud and
// glowing moss (none in meadow grass).
{
  G.reset(5); const prints = {};
  strict = true;
  for (let f = 0; f < 60 * 200; f++) {
    G.tick();
    if (f % 20) continue;
    drawn = 0; G.render();
    const b = G.biomeAt(G.state().pl.x);
    assert.ok(drawn > 300, `a whole frame draws (${drawn} calls in ${b})`);
    prints[b] = Math.max(prints[b] || 0, G.fx().prints);
  }
  strict = false;
  assert.deepEqual(Object.keys(prints).sort(), ['caves', 'frost', 'meadow', 'sky'], 'rendered in all four biomes');
  assert.equal(prints.meadow, 0, 'no prints in grass');
  for (const b of ['frost', 'sky', 'caves']) assert.ok(prints[b] >= 10, `footprints in ${b} (${prints[b]})`);
}
console.log('Pip Run PASS: jump-sized gaps, finite physics, demo player progresses through 4 seeded worlds, reaches each chapter’s destination, clears block rows that run up to a gap, and gets past ferries, lifts, crumble bridges, floating steps and podspitters, referee refuses traps and accepted walls stay passable, shared runs replay exactly as ghosts, the painted ground of all four biomes draws with sane geometry, once per chunk, and whole frames render in every biome with footprints in snow, cloud and moss.');
