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
const kept = {};
const sandbox = {
  localStorage: {getItem: k => kept[k] ?? null, setItem: (k, v) => { kept[k] = String(v); }, removeItem: k => { delete kept[k]; }},
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
// Holes in the ground are at least two tiles wide (Pip is wider than one tile,
// so a one-tile crack looked like ground he walks across). The floating steps,
// single stones rising over a pit, keep their one-tile hops.
for (const seed of [1, 2, 3]) {
  G.reset(seed);
  const count = tx => { let n = 0; for (let y = 0; y < 15; y++) if (G.tileAt(tx, y)) n++; return n; };
  let run = 0, narrow = 0, holes = 0, from = 0;
  for (let tx = 24; tx < 24 * 120; tx++) {
    const n = count(tx);
    if (!n) { if (!run) from = count(tx - 1); run++; continue; }
    if (run && from > 1 && n > 1) { holes++; if (run < 2) narrow++; }
    run = 0;
  }
  assert.ok(holes > 40 && narrow === 0, `seed ${seed}: ${narrow} of ${holes} holes are one tile wide`);
}
// A row of blocks leaves two clear tiles before the ground rises: with only
// one, big Pip could not rise onto a two-tile step without bumping the step
// or the blocks (the demo stalled there on the 29 Oct 2026 world).
for (const seed of [1, 2, 3, 497663883]) {
  G.reset(seed);
  const top = (tx, below) => { for (let y = below + 1; y < 15; y++) { const v = G.tileAt(tx, y); if (v === 1 || (v >= 5 && v <= 7)) return y; } return 99; };
  let ends = 0, tight = 0;
  for (let tx = 24; tx < 24 * 200; tx++) for (let y = 1; y < 14; y++) {
    const v = G.tileAt(tx, y), next = G.tileAt(tx + 1, y);
    if (!(v >= 2 && v <= 4) || (next >= 2 && next <= 4)) continue;
    ends++; const ground = top(tx, y);
    if (ground < 99 && (top(tx + 1, y) < ground || top(tx + 2, y) < ground)) tight++;
  }
  assert.ok(ends > 30 && tight === 0, `seed ${seed}: ${tight} of ${ends} block rows end right before a rise`);
}

// Pip stands on his feet: at a hole's edge with only the side of his body
// over the lip he slips off and falls; with his feet on the lip he stands.
for (const [over, falls] of [[1, true], [3, true], [5, false], [10, false]]) {
  G.reset(1); for (let f = 0; f < 20; f++) G.tick(() => ({}));
  for (let w = 0; w < 3; w++) for (let y = 0; y < 15; y++) G.tile(14 + w, y, 0);
  const pl = G.state().pl; pl.x = 14 * 16 - over; pl.vx = 0;
  for (let f = 0; f < 40; f++) G.tick(() => ({}));
  assert.equal(G.state().pl.y > 15 * 16 || G.state().dead > 0, falls, `${over} px of body on the lip: ${falls ? 'falls' : 'stands'}`);
}

// The planner foresees creatures by their own rules: a walker heading into a
// wall turns back there (the old guess carried it straight through).
{
  G.reset(1); for (let f = 0; f < 5; f++) G.tick(() => ({}));
  for (let y = 9; y < 12; y++) G.tile(20, y, 1);
  const s = G.state(); s.enemies.length = 0;
  s.enemies.push({kind: 'walker', x: 20 * 16 - 30, y: 12 * 16 - 14, baseY: 0, w: 14, h: 14, vx: .5, vy: 0, ground: true, state: 'walk', t: 0, period: 99});
  const [w] = G.foresee(), [x48] = w.at(48), [x96] = w.at(96);
  assert.ok(x48 <= 20 * 16 - 14 && x96 < x48, `a walker turns at the wall (${w.x} → ${x48.toFixed(1)} → ${x96.toFixed(1)})`);
}

// The demo player crosses generated worlds steadily, set pieces included.
const passed = new Set();
for (const seed of [1, 2, 5, 9]) {
  G.reset(seed);
  let tumbles = 0, prev = 0, last = 0, leaps = 0, late = 0;
  const secs = 90;
  for (let f = 1; f <= 60 * secs; f++) {
    const b = G.state().pl, was = b.ground, vy0 = b.vy, on = b.on;
    G.tick();
    const s = G.state();
    if (!s.dead && s.pl.vy < -6.5 && vy0 >= -.01 && !on) { leaps++; if (!was) late++; }   // a take-off, from the ground or after walking off it
    assert.ok(Number.isFinite(s.pl.x) && Number.isFinite(s.pl.y), 'finite position');
    if (s.dead && !prev) tumbles++;
    prev = s.dead;
    if (f % 60 === 0) for (const ft of G.features()) if (ft.x + 200 < s.maxX) passed.add(ft.id);
    if (f % (60 * 15) === 0) { assert.ok(s.maxX > last + 300, `seed ${seed}: progress stalled near ${Math.round(s.maxX / 16)} m`); last = s.maxX; }
  }
  const m = Math.round(G.state().maxX / 16);
  assert.ok(G.journey().chapters >= 1, `seed ${seed}: never reached a destination`);
  assert.ok(G.celebrated().length >= G.journey().chapters, `seed ${seed}: every arrival plays its landmark scene`);
  assert.ok(m > secs * 5, `seed ${seed}: demo reached only ${m} m in ${secs} s`);
  assert.ok(tumbles <= 6, `seed ${seed}: ${tumbles} tumbles`);
  // He leaps from the lip, not after slipping off it (a coyote-window leap
  // starts from below the edge and looks like a slip).
  assert.ok(leaps > 50 && late < leaps * .05, `seed ${seed}: ${late} of ${leaps} leaps after walking off the edge`);
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
  for (const bad of ['', 'x', '6.zz', '7.1.a0.1.AA', '5.1.a0.1.AA', '4.1.a0.1.AA', '3.1.a0.1.AA', '2.1.a0.1.AA', '1.1.a0.1.AA', '6.1.a0.1.A*']) assert.equal(G.ghost.decode(bad), null, `rejects ${bad}`);
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
  assert.deepEqual([...biomes].sort(), ['caves', 'coast', 'frost', 'meadow', 'sky'], 'all five biomes painted');
  G.reset(2); const a = G.art(1).art;
  assert.equal(G.art(1).art, a, 'a chunk is painted once');
  G.tile(24 + 5, 14, 0); assert.notEqual(G.art(1).art, a, 'and repainted when its ground changes');
}
// Painted trees, rocks and cottages stand on level, unbroken ground under
// their whole base and a tile beyond: never over an edge or by a ledge.
{
  const FOOT = {cottage: 4, oak: 3, rock: 2, pine: 2, blossom: 3}, kinds = {}, byBiome = {};
  for (const seed of [1, 2, 3, 5]) {
    G.reset(seed);
    for (let ci = 0; ci < 48; ci++) {
      G.art(ci);
      for (const q of G.props(ci)) {
        kinds[q.kind] = (kinds[q.kind] || 0) + 1; (byBiome[G.biomeAt(ci * 384 + 8)] = byBiome[G.biomeAt(ci * 384 + 8)] || new Set()).add(q.kind);
        const tx = ci * 24 + q.x;
        for (let d = -FOOT[q.kind]; d <= FOOT[q.kind]; d++) {
          let y = 0; while (y < 15 && !G.tileAt(tx + d, y)) y++;
          assert.ok(y === q.s && G.tileAt(tx + d, y) === 1, `seed ${seed}: a ${q.kind} at tile ${tx} stands by uneven ground at ${tx + d} (row ${y}, not ${q.s})`);
        }
      }
    }
  }
  for (const [b, ks] of Object.entries(byBiome)) assert.ok([...ks].every(k => ({meadow: ['oak', 'rock', 'cottage'], frost: ['pine', 'rock'], sky: ['blossom']})[b].includes(k)), `${b} keeps to its own trees (${[...ks]})`);
  assert.ok(!byBiome.coast && !byBiome.caves, 'the coast and the caves have no shared trees or rocks');
  for (const k of ['oak', 'pine', 'rock', 'blossom']) assert.ok(kinds[k] > 3, `some ${k}s are placed (${JSON.stringify(kinds)})`);
}
// Route dressing (fences, signposts, wells, ponds, snowmen...) sits on level
// ground with three tiles of headroom under its whole width, inside its chunk, clear of the bigger props
// and of each other; every region opens with a signpost.
{
  const DFOOT = {fence: 3, mushrooms: 1, lamp: 1, flowers: 1, snowman: 1, pond: 3, bunting: 3, pinwheel: 1, glowcaps: 1, sign: 1, well: 2, palm: 1, shells: 1, sandcastle: 1, umbrella: 1, driftwood: 2, boat: 3}, ROOM = {palm: 5}, kinds = {};
  for (const seed of [1, 2, 3, 4, 5, 11]) {
    G.reset(seed);
    for (let ci = 0; ci < 48; ci++) {
      G.art(ci);
      const props = G.props(ci), dress = G.dressing(ci);
      for (const q of dress) {
        kinds[q.kind] = (kinds[q.kind] || 0) + 1;
        const n = DFOOT[q.kind], tx = ci * 24 + q.x;
        assert.ok(q.x - n >= 0 && q.x + n < 24, `seed ${seed}: a ${q.kind} at tile ${tx} hangs over its chunk`);
        for (let d = -n; d <= n; d++) {
          const col = Array.from({length: ROOM[q.kind] || 3}, (_, k) => G.tileAt(tx + d, q.s - k - 1));
          assert.ok(G.tileAt(tx + d, q.s) === 1 && col.every(t => !t), `seed ${seed}: a ${q.kind} at tile ${tx} stands by uneven ground or under a ledge at ${tx + d} (${col})`);
        }
        for (const p of props) assert.ok(Math.abs(p.x - q.x) > n + 2, `seed ${seed}: a ${q.kind} at tile ${tx} crowds a ${p.kind}`);
        for (const o of dress) if (o !== q) assert.ok(Math.abs(o.x - q.x) > Math.max(n, DFOOT[o.kind]), `seed ${seed}: a ${q.kind} and a ${o.kind} overlap at tile ${tx}`);
      }
    }
  }
  for (const k of ['sign', 'fence', 'mushrooms', 'snowman', 'pond', 'bunting', 'glowcaps', 'palm', 'boat']) assert.ok(kinds[k] > 1, `some ${k} dressing is placed (${JSON.stringify(kinds)})`);
  for (const k of ['shells', 'sandcastle', 'umbrella', 'driftwood']) assert.ok(kinds[k] >= 1, `a ${k} on the beach (${JSON.stringify(kinds)})`);
}
// Pip touches the world: whole frames render with sane geometry in every
// biome while footfalls kick up particles and leave prints in snow, cloud,
// sand and glowing moss (none in meadow grass).
{
  G.reset(1); const prints = {}, seen = {};
  strict = true;
  for (let f = 0; f < 60 * 270; f++) {
    G.tick();
    if (f % 20) continue;
    drawn = 0; G.render();
    const b = G.biomeAt(G.state().pl.x);
    assert.ok(drawn > 300, `a whole frame draws (${drawn} calls in ${b})`);
    seen[b] = true;
    for (const q of G.fx().printList) { const look = G.lookAt(q.x); (prints[look] = prints[look] || new Set()).add(q.x + ':' + q.at); }
  }
  strict = false;
  assert.deepEqual(Object.keys(seen).sort(), ['caves', 'coast', 'frost', 'meadow', 'sky'], 'rendered in all five biomes');
  assert.ok(!prints.meadow, `no prints on grass (${prints.meadow && prints.meadow.size})`);
  for (const b of ['frost', 'sky', 'caves', 'coast']) assert.ok(prints[b] && prints[b].size >= 10, `footprints in ${b} (${prints[b] && prints[b].size})`);
}
// Passing weather is a function of distance alone (the same for everyone on a
// seed, and for ghosts): never in the first region, never over a plaza, one
// kind per biome; and the frames it draws (rain, snow, light, drips, puddles,
// a rainbow) have sane geometry.
{
  const kinds = {};
  for (const sd of [1, 2, 3, 4, 5, 6, 7, 8]) {
    G.reset(sd);
    for (let x = 0; x < 10 * 4608; x += 32) {
      const a = G.weatherAt(x), b = G.weatherAt(x), f = x / 4608 % 1;
      assert.deepEqual(a, b, 'weather is a function of distance');
      assert.ok(a.w >= 0 && a.w <= 1 && a.after >= 0 && a.after <= 1, `weather weights in range (${JSON.stringify(a)})`);
      if (x < 4608 || f > .9) assert.equal(a.w + a.after, 0, `clear in the first region and over the plaza (x ${x})`);
      if (a.w > .5) { kinds[a.kind] = (kinds[a.kind] || 0) + 1; assert.equal(a.kind, {meadow: 'shower', frost: 'blizzard', coast: 'squall', sky: 'sunbreak', caves: 'drip'}[G.biomeAt(x)]); }
    }
  }
  assert.deepEqual(Object.keys(kinds).sort(), ['blizzard', 'drip', 'shower', 'squall', 'sunbreak'], `every kind of weather comes along (${JSON.stringify(kinds)})`);
  strict = true;
  for (const sd of [1, 2, 3, 4, 5, 6, 7, 8]) {
    G.reset(sd); const seen = new Set();
    for (let f = 0; f < 60 * 400 && seen.size < 3; f++) { G.tick(); const w = G.weatherAt(G.state().pl.x); if ((w.w > .8 || w.after > .8) && f % 15 === 0) { drawn = 0; G.render(); assert.ok(drawn > 300, 'a whole frame draws under the weather'); seen.add(w.kind + (w.after > .8 ? '+after' : '')); } }
  }
  strict = false;
}
// Stomps land with a ring and star sparks.
{
  G.reset(5); let rings = 0, sparks = 0;
  for (let f = 0; f < 60 * 120; f++) { G.tick(); const x = G.fx(); rings = Math.max(rings, x.rings); sparks = Math.max(sparks, x.sparks); }
  assert.ok(rings >= 1 && sparks >= 5, `a stomp throws a ring and sparks (${rings} rings, ${sparks} sparks)`);
}
// A stomped seed pod bursts the new way: the husk splits and its halves fall
// away with seed fluff, instead of a flat pod hanging in the air.
{
  G.reset(1); for (let f = 0; f < 30; f++) G.tick(() => ({}));
  const s = G.state(), pl = s.pl; pl.y -= 30; pl.vy = 2; pl.ground = false;
  s.enemies.push({kind: 'pod', x: pl.x - 1, y: pl.y + pl.h + 1, baseY: 0, w: 12, h: 10, vx: 0, vy: 0, ground: false, state: 'walk', t: 0, period: 99});
  G.tick(() => ({}));
  const pod = G.state().enemies.find(e => e.kind === 'pod');
  assert.ok(pod && pod.state === 'squash' && !G.state().dead && G.state().pl.vy < 0, 'Pip stomps the pod and bounces');
  assert.ok(G.fx().fluff >= 5 && G.fx().rings >= 1, `the pod bursts into fluff (${G.fx().fluff})`);
  strict = true; for (let f = 0; f < 34; f += 3) { G.tick(() => ({})); G.render(); } strict = false;
}
// Small lives keep to their places: fish leap only from open sea on the
// coast, butterflies flutter over the meadow, and all of it draws sanely.
{
  G.reset(1); let fish = 0, astray = 0, flutter = 0;
  for (let f = 0; f < 60 * 160; f++) {
    G.tick(); if (f % 5) continue;
    const L = G.life(), here = G.biomeAt(G.state().pl.x);
    for (const q of L.fish) { fish++; const tx = Math.floor(q.xc / 16); let ground = false; for (let y = 4; y < 15; y++) if (G.tileAt(tx, y)) ground = true; if (ground || G.biomeAt(q.xc) !== 'coast') astray++; }
    if (L.flutter && here === 'meadow') flutter++;
    if (f % 400 === 0 || (L.fish.length && f % 50 === 0) || (L.bats && here === 'caves' && f % 50 === 0)) { strict = true; G.render(); strict = false; }
  }
  assert.ok(fish > 20 && astray === 0, `fish leap from the sea (${fish} seen, ${astray} astray)`);
  assert.ok(flutter > 20, `butterflies over the meadow (${flutter})`);
}
// The journey book stamps each landmark reached, on this device; a ghost
// rebuild (which replays a run) does not stamp anything. The book draws.
{
  for (const k of Object.keys(kept)) delete kept[k];
  G.reset(1);
  for (let f = 0; f < 60 * 200 && G.journey().chapters < 1; f++) G.tick();
  const b1 = G.book(); assert.ok(b1 && b1.coast && b1.coast.visits === 1 && b1.coast.best > 0, `the Lighthouse is stamped (${JSON.stringify(b1)})`);
  const code = G.ghost.encode(); G.ghost.race(code);
  assert.equal(G.book().coast.visits, 1, 'a ghost rebuild stamps nothing');
  strict = true; G.openBook(); drawn = 0; G.render(); strict = false;
  assert.ok(G.bookOpen() && drawn > 200, `the book draws (${drawn} calls)`);
}
// Pip talks: lines come from what is happening, worded from the moment, not
// too often and not the same line twice running; a ghost rebuild says
// nothing; and the bubble draws with sane geometry.
{
  G.reset(1); const said = [];
  strict = true;
  for (let f = 0; f < 60 * 240; f++) {
    G.tick(); const s = G.speech();
    if (s && (!said.length || said[said.length - 1].at !== s.at)) { said.push(s); assert.ok(!/[{}]/.test(s.text) && s.text.length > 1, `a worded line (${s.text})`); drawn = 0; G.render(); assert.ok(drawn > 300, 'a frame with a bubble draws'); }
  }
  strict = false;
  const mins = 60 * 240 / 40 / 60;
  assert.ok(said.length >= 3 * mins && said.length <= 12 * mins, `Pip talks now and then (${said.length} lines in ${mins} min)`);
  for (let i = 1; i < said.length; i++) assert.notEqual(said[i].text, said[i - 1].text, 'never the same line twice running');
  assert.ok(said.some(q => /Lighthouse/.test(q.text)), `a line names the landmark ahead (${said.map(q => q.text).join(' | ')})`);
  const n = said.length; G.ghost.race(G.ghost.encode());
  assert.ok(!G.speech(), 'a ghost rebuild says nothing');
}
// Resolution follows the device: frames slower than about 50 a second drop a
// step (a smaller canvas the browser scales up), a step that does not help is
// taken back, and then it settles.
{
  const feed = ms => { const w = G.quality().windows; for (let i = 0; i < 2000 && G.quality().windows === w; i++) G.pace(ms); };   // until one window is judged
  const q0 = G.quality(); assert.equal(q0.level, 0);
  feed(16.7); assert.equal(G.quality().level, 0, 'a smooth 60 fps keeps full resolution');
  feed(33); const q1 = G.quality(); assert.equal(q1.level, 1, 'slow frames drop a step'); assert.ok(q1.width < q0.width, `and the canvas is smaller (${q1.width} < ${q0.width})`);
  feed(24); assert.equal(G.quality().level, 2, 'better but still slow: another step');
  feed(23); assert.equal(G.quality().level, 1, 'a step that does not help is taken back');
  assert.ok(G.quality().settled); feed(40); assert.equal(G.quality().level, 1, 'and then it settles');
  strict = true; drawn = 0; G.render(); strict = false; assert.ok(drawn > 300, `and still draws whole frames (${drawn} calls)`);
}
console.log('Pip Run PASS: jump-sized gaps at least two tiles wide, Pip stands on his feet (slips off a lip he only touches), the planner foresees creatures by their rules, the demo leaps from the lip, finite physics, demo player progresses through 4 seeded worlds, reaches each chapter’s destination and plays its landmark scene, clears block rows that run up to a gap, and gets past ferries, lifts, crumble bridges, floating steps and podspitters, referee refuses traps and accepted walls stay passable, shared runs replay exactly as ghosts, the painted ground of all four biomes draws with sane geometry, once per chunk, route dressing stands on level ground, whole frames render in every biome with footprints in snow, cloud and moss, the weather comes and goes with sane geometry, Pip talks about what is happening, stomps ring and spark, seed pods burst, fish leap only from the sea and butterflies keep to the meadow, the journey book stamps landmarks (not in ghost rebuilds), and the resolution steps down on a slow device.');
