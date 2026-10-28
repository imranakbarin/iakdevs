/* Pip Run — a small original platformer.
 * - Fixed 60 Hz physics with sub-pixel motion: acceleration, skids, variable
 *   jump height (hold to jump higher), coyote time and jump buffering.
 * - A seeded, endless tile world built from a chunk grammar whose gaps are
 *   sized from the same physics, so every stretch can be cleared.
 * - Creatures are tiny rule sets: a walker that turns at walls, a snail that
 *   turns at ledges and retreats into a kickable shell, a hopper and a flier.
 * - When nobody plays, a demo player takes over. It presses the same buttons
 *   a person would and plans each move by simulating the real physics ahead.
 * Original characters and art; no franchise assets or tracking. Sound is
 * synthesized in assets/pip-audio.js (no audio files).
 */
(() => {
  'use strict';
  const cv = document.getElementById('game'), main = cv.getContext('2d');
  let ctx = main;   // swapped to an offscreen buffer while the camera pushes in
  const TS = 16, ROWS = 15, CW = 24, VIEW_H = ROWS * TS;
  // Logical pixels per 1/60 s frame.
  const P = {acc: .085, airAcc: .065, skid: .27, fric: .15, max: 1.75, jump: 6.6, jumpRun: .24,
    gHold: .36, g: .92, maxFall: 6.2, coyote: 6, buffer: 7, w: 12, h: 20};
  const EPS = 1e-3;
  const EMPTY = 0, EARTH = 1, BRICK = 2, BLOCK = 3, USED = 4, PIPE_L = 5, STONE = 6, PIPE_R = 7, SPRING = 8, CEIL = 9, CRUMBLE = 10, SPITTER = 11, BRIDGE = 12;
  // Tiles that never change in play: painted once per chunk (see paintChunk).
  const STATIC = new Set([EARTH, STONE, PIPE_L, PIPE_R, CEIL]);

  const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return h >>> 0; };
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const toward = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // Sine from plain arithmetic: Math.sin may differ in the last bit between
  // engines, and a run must replay exactly from its input log on any browser.
  const dsin = x => {
    x -= Math.round(x / (2 * Math.PI)) * 2 * Math.PI;
    if (x > Math.PI / 2) x = Math.PI - x; else if (x < -Math.PI / 2) x = -Math.PI - x;
    const q = x * x; return x * (1 - q / 6 * (1 - q / 20 * (1 - q / 42 * (1 - q / 72))));
  };

  /* ---------------- physics ---------------- */
  let tileAt = () => EMPTY;
  // The time physics is evaluated at: the tick's frame, or a frame of the
  // planner's imagined future. Lifts and crumbling planks depend on it.
  let simNow = 0, moversNear = () => [], crumbleFall = new Map();
  const solid = (tx, ty) => { const v = tileAt(tx, ty); return v !== EMPTY && (v !== CRUMBLE || !(crumbleFall.get(tx * 64 + ty) <= simNow)); };
  // Lifts glide back and forth on an eased path. Where one is is a pure
  // function of time, so the planner and a ghost see exactly where it will be.
  function moverAt(m, t) {
    let p = ((t + m.ph) % m.per) / m.per; p = p < .5 ? p * 2 : 2 - p * 2; p = p * p * (3 - 2 * p);
    return [m.x + m.ax * p, m.y + m.ay * p];
  }
  function moveX(b) {
    b.x += b.vx;
    const top = Math.floor(b.y / TS), bot = Math.floor((b.y + b.h - EPS) / TS);
    if (b.vx > 0) {
      const tx = Math.floor((b.x + b.w - EPS) / TS);
      for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { b.x = tx * TS - b.w; b.vx = 0; return true; }
    } else if (b.vx < 0) {
      const tx = Math.floor(b.x / TS);
      for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { b.x = (tx + 1) * TS; b.vx = 0; return true; }
    }
    return false;
  }
  function moveY(b) {
    b.y += b.vy; b.ground = false;
    const l = Math.floor(b.x / TS), r = Math.floor((b.x + b.w - EPS) / TS);
    if (b.vy > 0) {
      const ty = Math.floor((b.y + b.h - EPS) / TS);
      for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { b.y = ty * TS - b.h; b.vy = 0; b.ground = true; return null; }
    } else if (b.vy < 0) {
      const ty = Math.floor(b.y / TS), cx = Math.floor((b.x + b.w / 2) / TS);
      let hit = null;
      for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) hit = hit && hit[0] === cx ? hit : [tx, ty];
      if (solid(cx, ty)) hit = [cx, ty];
      if (hit) { b.y = (ty + 1) * TS; b.vy = 0; return hit; }
    }
    return null;
  }
  /* ---------------- biomes ----------------
     The run passes through regions with their own rules. The rules live in the
     shared physics below, so the planner adapts to them without special cases. */
  const REGION = 12;                                  // chunks per region (~288 m, about a minute)
  const BIOMES = {
    meadow: {name: 'Mushroom Meadow', sub: 'Run, jump, gather star seeds', mark: 'Mushroom Gate', rules: {}, lo: 2, hi: 7},
    frost: {name: 'Frost Ridge', sub: 'Ice is slick: skids run long', mark: 'Frost Spire', rules: {fric: .022, acc: .055, skid: .07, airAcc: .06}, lo: 2, hi: 7},
    sky: {name: 'Sky Isles', sub: 'Lighter gravity, gusting wind', mark: 'Sky Harbor', rules: {g: .74, gHold: .29, wind: .55}, lo: 3, hi: 8},
    caves: {name: 'Glow Caves', sub: 'Dark: Pip carries his own light', mark: 'Crystal Heart', rules: {}, lo: 2, hi: 5}
  };
  const RULES = {};
  for (const [k, b] of Object.entries(BIOMES)) RULES[k] = {...P, ...b.rules};
  // Meadow first, then the three special regions in a seeded order, then meadow again.
  function regionBiome(r) {
    if (r <= 0) return 'meadow';
    const k = (r - 1) % 4;
    return k === 3 ? 'meadow' : ['frost', 'sky', 'caves'][(hash(seed ^ 0xb10, 7) + k) % 3];
  }
  const biomeOfChunk = ci => regionBiome(Math.floor(ci / REGION));
  const biomeAt = x => biomeOfChunk(Math.floor(x / (CW * TS)));
  // Wind gusts vary along the route: + pushes Pip forward, - is a headwind.
  const windAt = x => dsin(x * .0042 + (seed % 97));

  // One frame of player physics. Shared verbatim by the player and the planner.
  function stepBody(b, inp, R = RULES[biomeAt(b.x)], gust) {
    if (b.on) { const x0 = moverAt(b.on, simNow - 1)[0], [x1, y1] = moverAt(b.on, simNow); b.x += x1 - x0; b.y = y1 - b.h; }   // riding a lift
    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (dir === 0) b.vx = toward(b.vx, 0, b.ground ? R.fric : R.fric * .35);
    else b.vx = toward(b.vx, dir * R.max, b.ground ? (b.vx * dir < 0 ? R.skid : R.acc) : R.airAcc);
    const pressed = inp.j && !b.jprev; b.jprev = inp.j;
    b.buf = pressed ? P.buffer : Math.max(0, b.buf - 1);
    b.coyote = b.ground ? P.coyote : Math.max(0, b.coyote - 1);
    let jumped = false;
    if (b.buf > 0 && b.coyote > 0) {
      b.vy = -(R.jump + Math.abs(b.vx) * R.jumpRun); b.buf = 0; b.coyote = 0; b.jumping = true; b.ground = false; jumped = true;
    }
    if (!inp.j || b.vy >= 0) b.jumping = false;
    b.vy = Math.min(R.maxFall, b.vy + (b.jumping ? R.gHold : R.g));
    // Wind drifts Pip (half as much when his feet are planted).
    const drift = R.wind ? R.wind * (gust ?? windAt(b.x)) * (b.ground ? .4 : 1) : 0;
    b.vx += drift;
    if (!moveX(b)) b.vx -= drift;
    const was = b.ground, falling = b.vy >= 0, prevBottom = b.y + b.h, bump = moveY(b);
    // Lifts are one-way platforms: land on one from above, or be scooped up.
    b.on = null;
    if (falling) for (const m of moversNear(b.x)) {
      const [mx, my] = moverAt(m, simNow), py = moverAt(m, simNow - 1)[1];
      if (b.x + b.w > mx + 1 && b.x < mx + m.w - 1 && prevBottom <= Math.max(my, py) + .5 && b.y + b.h >= my) { b.y = my - b.h; b.vy = 0; b.ground = true; b.on = m; break; }
    }
    // Springs are part of the shared physics, so the planner can use them too.
    let sprung = false;
    if (b.ground) {
      const ty = Math.floor((b.y + b.h + 1) / TS);
      for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w - EPS) / TS); tx++)
        if (tileAt(tx, ty) === SPRING) { b.vy = -9.6; b.ground = false; b.coyote = 0; b.jumping = false; sprung = [tx, ty]; break; }
    }
    return {jumped, bump, landed: b.ground && !was, sprung};
  }
  // How far a full-speed, full-hold jump carries Pip before landing dh tiles
  // higher, under a biome's rules and its worst headwind.
  function reach(dh, R = P) {
    // Take-off speed is what a short (2.5 tile) run-up can build under this
    // biome's acceleration: on ice that is well short of full speed.
    const b = {x: 0, y: 0, vx: Math.min(R.max, Math.sqrt(2 * R.acc * 40)), vy: 0, w: P.w, h: P.h, ground: true, jprev: false, buf: 0, coyote: P.coyote, jumping: false};
    const saved = tileAt; tileAt = () => EMPTY;
    let best = 0;
    for (let f = 0; f < 160; f++) {
      stepBody(b, {r: true, j: true}, R, -1); b.ground = false; b.coyote = 0;
      if (b.vy > 0 && b.y >= -dh * TS) { best = b.x; break; }
    }
    tileAt = saved; return best;
  }
  const GAPS = {};
  // (A full-speed reach would overstate icy gaps; see the run-up note above.)
  for (const k of Object.keys(BIOMES)) { GAPS[k] = {}; for (let dh = -4; dh <= 2; dh++) GAPS[k][dh] = Math.max(0, Math.floor((reach(dh, RULES[k]) * .8 - 14) / TS)); }
  const GAP = GAPS.meadow;

  /* ---------------- world ---------------- */
  let seed = 1, chunks = new Map(), gen = {ci: -1, h: 3, recent: []}, regrow = [];
  moversNear = x => {
    const ci = Math.floor(x / (CW * TS)), out = [];
    for (let k = ci - 1; k <= ci + 1; k++) { const ch = chunks.get(k); if (ch) for (const m of ch.movers) out.push(m); }
    return out;
  };
  function chunk(ci) {
    if (ci < 0) return null;
    while (gen.ci < ci) generate();
    return chunks.get(ci) || null;
  }
  tileAt = (tx, ty) => {
    if (ty < 0 || ty >= ROWS) return EMPTY;
    const ci = Math.floor(tx / CW);
    if (ci < 0) return EARTH;
    const ch = chunk(ci);
    return ch ? ch.t[ty * CW + tx - ci * CW] : EARTH;
  };
  function setTile(tx, ty, v) {
    const ci = Math.floor(tx / CW), ch = chunks.get(ci), i = ty * CW + tx - ci * CW;
    if (!ch) return;
    if (STATIC.has(ch.t[i]) || STATIC.has(v)) ch.v = (ch.v || 0) + 1;   // its painting is stale
    ch.t[i] = v;
  }

  const PIECES = [
    {id: 'run', w: 24, from: 1}, {id: 'gap', w: 22, from: 1}, {id: 'step', w: 14, from: 1}, {id: 'tier', w: 16, from: 1},
    {id: 'pipe', w: 12, from: 1, not: ['sky']}, {id: 'pyramid', w: 12, from: 1, not: ['caves']},
    {id: 'pad', w: 12, from: 1, only: ['sky']}, {id: 'isles', w: 10, from: 1, only: ['sky']},
    {id: 'ferry', w: 1.5, from: 2, feature: true}, {id: 'stairs', w: 1.2, from: 2, feature: true}, {id: 'crumble', w: 1.5, from: 3, feature: true},
    {id: 'spitter', w: 1.2, from: 5, feature: true}, {id: 'lift', w: 1.4, from: 4, feature: true, not: ['sky', 'caves']}
  ];
  const PLAZA = 11;   // tiles of quiet ground before each region's end
  const gateX = r => (r + 1) * REGION * CW * TS - 4 * TS;
  function generate() {
    const ci = ++gen.ci, r = rng(hash(seed, ci)), d = Math.min(1, ci / 16), biome = biomeOfChunk(ci), B = BIOMES[biome], GAP = GAPS[biome];
    const sky = biome === 'sky', caves = biome === 'caves';
    const t = new Uint8Array(CW * ROWS), ch = {ci, t, biome, spawns: [], seeds: [], safe: new Set(), spawned: false, crystals: [], movers: [], plants: [], features: []};
    const set = (c, row, v) => { if (c >= 0 && c < CW && row >= 0 && row < ROWS) t[row * CW + c] = v; };
    // Sky islands float: only a two-tile crust under the surface.
    const col = (c, h) => { for (let k = sky ? h - 2 : 0; k < h; k++) set(c, ROWS - 1 - k, EARTH); };
    const H = v => clamp(B.lo, v, B.hi);
    const surface = h => (ROWS - h) * TS;
    const wx = c => (ci * CW + c) * TS;
    let c = 0, h = H(gen.h);
    let lim = CW;   // pieces stop short of the plaza at a region's end
    const flat = n => { n = Math.min(n, lim - c); for (let i = 0; i < n; i++) { col(c, h); if (i > 0 && i < n - 1) ch.safe.add(c); c++; } return n; };
    const seedRow = (c0, n, row) => { for (let i = 0; i < n; i++) ch.seeds.push({x: wx(c0 + i) + 8, y: row * TS + 8, got: false}); };
    const enemy = (kind, c0, hh) => ch.spawns.push({kind, x: wx(c0) + 1, y: surface(hh) - 14});
    const kinds = () => { const k = r(); return d > .5 && k < .2 ? 'flier' : d > .3 && k < .4 ? 'hopper' : d > .15 && k < .65 ? 'snail' : 'walker'; };
    if (ci === 0) {
      flat(CW); seedRow(14, 3, ROWS - h - 3);
      gen.h = h; chunks.set(ci, ch); prune(); return;
    }
    const feature = (id, c0) => ch.features.push({id, x: wx(c0)});
    // Gap tables assume a run-up of about three clear tiles; after a pipe or
    // other obstacle the run-up is shorter, so the gap is one tile narrower.
    const shortRun = () => { let n = 0; for (let k = c - 1; k >= 0 && n < 3; k--, n++) if (!t[(ROWS - h) * CW + k] || t[(ROWS - h - 1) * CW + k]) break; return c >= 3 && n < 3 ? 1 : 0; };
    // One piece of route. Returns false when it did not fit (a short run
    // is laid instead), so the bag only remembers pieces that were placed.
    function piece(id, room) {
      switch (id) {
        case 'run': {                                  // open run, maybe a creature and a block row
          const c0 = c, n = flat(4 + (r() * 5 | 0));
          if (n >= 4 && r() < .4 + .3 * d) { const kd = kinds(); kd === 'flier' ? ch.spawns.push({kind: kd, x: wx(c0 + 2), y: surface(h) - 56}) : enemy(kd, c0 + 1 + (r() * (n - 2) | 0), h); }
          if (n >= 4 && r() < .45) {
            // The row stops a tile short of the run's end: open sky to leap from
            // before whatever comes next (a gap, a step up).
            const row = ROWS - h - 4, len = 1 + (r() * Math.min(4, n - 2) | 0), s0 = c0 + 1;
            for (let i = 0; i < len; i++) set(s0 + i, row, r() < .45 ? BLOCK : BRICK);
            if (r() < .5) seedRow(s0, len, row - 2);
          } else if (r() < .35) seedRow(c0 + 1, Math.min(3, n - 1), ROWS - h - 2);
          return true;
        }
        case 'gap': {                                  // sized from the jump physics
          const dh = [-2, -1, 0, 0, 1][r() * 5 | 0], h2 = H(h + dh), max = (GAP[h2 - h] || 0) - shortRun();
          if (max < 1 || room < 4 + max) break;
          const w = 1 + (r() * Math.min(max, 1 + Math.round(d * 2)) | 0);
          if (w > room - 3) break;
          const mid = c + w / 2;
          for (let i = 0; i < 3; i++) ch.seeds.push({x: wx(0) + (mid + i - 1) * TS, y: surface(Math.max(h, h2)) - 30 - (i === 1 ? 14 : 4), got: false});
          c += w; h = h2; flat(2 + (r() * 2 | 0));
          return true;
        }
        case 'step': h = H(h + [-2, -1, 1, 2][r() * 4 | 0]); flat(2 + (r() * 3 | 0)); return true;
        case 'pipe': {
          if (room < 7) break;
          flat(2); const ph = 2 + (r() < .35 + .3 * d ? 1 : 0);
          for (let q = 0; q < 2; q++) { col(c + q, h); for (let k = 0; k < ph; k++) set(c + q, ROWS - 1 - h - k, q ? PIPE_R : PIPE_L); }
          ch.seeds.push({x: wx(c) + 16, y: surface(h + ph) - 22, got: false});
          c += 2; flat(2);
          return true;
        }
        case 'pad': {                                  // a spring pad on a sky island
          if (room < 6) break;
          flat(2); set(c, ROWS - 1 - h, SPRING); col(c, h); c++; flat(2);
          ch.seeds.push({x: wx(c - 2) + 8, y: surface(h) - 120, got: false});
          return true;
        }
        case 'isles': {                                // extra gaps between sky islands
          const h2 = H(h + [-1, 0, 1][r() * 3 | 0]), max = (GAP[h2 - h] || 0) - shortRun();
          if (max < 1 || room < 4 + max) break;
          c += 1 + (r() * Math.min(max, 2) | 0); h = h2; flat(2 + (r() * 2 | 0));
          return true;
        }
        case 'pyramid': {
          const n = 3 + (r() < .5 ? 1 : 0);
          if (room < n * 2 + 3 || h + n > 10) break;
          flat(1);
          for (let i = 0; i < n; i++) { col(c, h); for (let k = 0; k <= i; k++) set(c, ROWS - 1 - h - k, STONE); c++; }
          for (let i = n - 1; i >= 0; i--) { col(c, h); for (let k = 0; k <= i; k++) set(c, ROWS - 1 - h - k, STONE); c++; }
          flat(1);
          return true;
        }
        case 'tier': {                                 // a block tier with seeds on top
          if (room < 7) break;
          const c0 = c; flat(6);
          const row = ROWS - h - 4;
          for (let i = 1; i <= 4; i++) set(c0 + i, row, i === 2 ? BLOCK : BRICK);
          if (r() < .6 && !caves) { set(c0 + 2, row - 4, BLOCK); seedRow(c0 + 1, 4, row - 1); }
          if (r() < .5 + .3 * d) enemy(kinds() === 'flier' ? 'walker' : kinds(), c0 + 4, h);
          return true;
        }
        case 'ferry': {                                // a chasm too wide to jump, and a lift across it
          const w = 7 + (r() * 3 | 0);
          if (room < w + 5) break;
          flat(2);
          const h2 = H(h + [0, 0, 1][r() * 3 | 0]), x0 = wx(c), span = w * TS, pw = 32;
          ch.movers.push({kind: 'ferry', x: x0 + 6, y: surface(h), ax: span - pw - 12, ay: surface(h2) - surface(h), w: pw, per: Math.round(2 * (span - pw) / .7), ph: r() * 997 | 0});
          for (let i = 1; i < w - 1; i += 2) ch.seeds.push({x: x0 + i * TS + 8, y: surface(Math.max(h, h2)) - 44 - (i === (w >> 1) ? 10 : 0), got: false});
          feature('ferry', c); c += w; h = h2; flat(3);
          return true;
        }
        case 'lift': {                                 // a cliff too tall to jump, and a lift up it
          if (room < 8) break;
          const h2 = Math.min(11, h + 4 + (r() < .5 ? 1 : 0));
          flat(2); const x0 = wx(c);
          ch.movers.push({kind: 'lift', x: x0, y: surface(h), ax: 0, ay: surface(h2) - surface(h), w: 32, per: Math.round(2 * (h2 - h) * TS / .55), ph: r() * 997 | 0});
          col(c, h); col(c + 1, h);
          ch.seeds.push({x: x0 + 16, y: surface(h2) - 26, got: false});
          feature('lift', c); c += 2; h = h2; flat(3);
          return true;
        }
        case 'crumble': {                              // planks over a pit that fall soon after you step on them
          const w = 3 + (r() * (2 + d * 3) | 0);
          if (room < w + 4) break;
          flat(2); feature('crumble', c);
          for (let i = 0; i < w; i++) set(c + i, ROWS - h, CRUMBLE);
          if (w > 3) seedRow(c + 1, w - 2, ROWS - h - 3);
          c += w; flat(2 + (r() * 2 | 0));
          return true;
        }
        case 'stairs': {                               // floating stones rising over a pit
          const n = 3 + (r() < .5 ? 1 : 0), pit = 1 + (d > .5 && r() < .5 ? 1 : 0);
          if (room < n * (pit + 1) + pit + 4 || h + n + 1 > (caves ? B.hi + 1 : 10)) break;
          flat(2); feature('stairs', c);
          let hh = h;
          for (let i = 0; i < n; i++) { c += pit; hh++; set(c, ROWS - hh, STONE); if (i === n - 1) ch.seeds.push({x: wx(c) + 8, y: surface(hh) - 24, got: false}); c++; }
          c += pit; h = hh; flat(3);
          return true;
        }
        case 'spitter': {                              // a plant that spits seed pods along the ground
          if (room < 8) break;
          const c0 = c; flat(7);
          set(c0 + 5, ROWS - 1 - h, SPITTER); ch.plants.push({tx: wx(c0 + 5) / TS, ty: ROWS - 1 - h, ph: r() * 160 | 0});
          seedRow(c0 + 1, 3, ROWS - h - 4); feature('spitter', c0);
          return true;
        }
      }
      flat(2); return false;
    }
    // Pieces are dealt from a bag that remembers what came recently, so the
    // route keeps changing; set pieces unlock as the run goes on.
    const bag = PIECES.filter(q => ci >= q.from && (!q.only || q.only.includes(biome)) && !(q.not || []).includes(biome));
    // Each region ends at its destination: a flat, quiet plaza where the next
    // region's landmark stands (see the journey section). The next region
    // starts with a short flat run too.
    const last = ci % REGION === REGION - 1, first = ci % REGION === 0;
    if (first) flat(6);
    if (last) lim = CW - PLAZA;
    while (c < lim) {
      const room = lim - c;
      if (room < 5) { flat(room); break; }
      // Ground carried over from the previous region (sky islands sit high)
      // steps back into this biome's range first: a cave roof leaves no room
      // above high ground for pipes or steps.
      if (h > B.hi || h < B.lo) { h = H(h); flat(2); continue; }
      let sum = 0;
      const wts = bag.map(q => { const w = q.w * (q.feature ? .6 + .8 * d : 1) * .3 ** gen.recent.filter(id => id === q.id).length; sum += w; return w; });
      let k = r() * sum, i = 0;
      while (i < bag.length - 1 && k > wts[i]) k -= wts[i++];
      if (piece(bag[i].id, room)) { gen.recent.push(bag[i].id); if (gen.recent.length > 6) gen.recent.shift(); }
    }
    if (first) ch.spawns = ch.spawns.filter(q => q.x > wx(10));
    if (last) {
      lim = CW; flat(CW - c);
      ch.spawns = ch.spawns.filter(q => q.x < wx(CW - PLAZA - 3));
      ch.plants = ch.plants.filter(q => q.tx * TS < wx(CW - PLAZA - 6));
    }
    if (caves) {
      // A jagged roof (always at least six tiles above the floor) and glowing crystals.
      for (let x = 0; x < CW; x++) {
        const depth = 1 + (hash(seed ^ 0xce1, ci * CW + x) % 3 === 0 ? 1 : 0) + (hash(seed ^ 0xce2, (ci * CW + x) >> 2) % 2);
        for (let y = 0; y < depth; y++) set(x, y, CEIL);
        if (hash(seed ^ 0xc75, ci * CW + x) % 7 === 0) {
          let floor = depth; while (floor < ROWS && t[floor * CW + x] === EMPTY) floor++;
          if (floor < ROWS) ch.crystals.push({x: wx(x) + 8, y: floor * TS, up: true, hue: hash(seed, x + ci * 31) % 3});
        }
        if (hash(seed ^ 0xc76, ci * CW + x) % 9 === 0) ch.crystals.push({x: wx(x) + 8, y: depth * TS, up: false, hue: hash(seed, x + ci * 37) % 3});
      }
    }
    gen.h = h; chunks.set(ci, ch); prune();
  }
  function prune() { for (const k of chunks.keys()) if (k < gen.ci - 6) chunks.delete(k); }

  /* ---------------- actors ---------------- */
  let pl, enemies, parts, seeds, cam, cp, maxX, dead, inv, landedAt, anim, facing, frameNo;
  let sq = 0, skidding = false, big = false, growing = 0, items = [];
  // simW is the width the simulation sees (camera lead, spawn range). It is
  // logged with the run, so a ghost replays with the sharer's screen, not yours.
  let simW = 400, run = null, ghostSim = null, ghost = null;
  let marks = [], risk = .25, tension = 0, wary = 0, stompTimes = [], history = [], moment = null, replay = null, lastReplay = -1e9, usedAt = new Map();
  function reset(newSeed) {
    seed = newSeed; chunks = new Map(); gen = {ci: -1, h: 3, recent: []}; crumbleFall = new Map(); regrow = [];
    chunk(0);
    pl = {x: 40, y: (ROWS - 3) * TS - P.h, vx: 0, vy: 0, w: P.w, h: P.h, ground: false, jprev: false, buf: 0, coyote: 0, jumping: false};
    enemies = []; parts = []; prints = []; rustle.clear(); seeds = 0; cam = 0; cp = {x: 40, y: pl.y}; maxX = 40; dead = 0; inv = 0; landedAt = -99; anim = 0; facing = 1; frameNo = 0;
    big = false; growing = 0; items = []; if (typeof stats !== 'undefined') stats = {bumps: 0, sprouts: 0};
    if (typeof charges !== 'undefined') { tool = null; charges = 3; chargeT = 0; dirScore = 0; notes = []; placed = []; }
    title = null; lastRegion = -1; arrival = null; chapter = null; chapters = 0; journey = {start: 0, seeds0: 0, tumbles: 0, finds0: 0, arrived: -1};
    plan = null; stuckX = 0; stuckSince = 0; impatience = 0; progressX = 0; progressAt = 0; marks = []; risk = .25; tension = 0; wary = 0; stompTimes = []; history = []; moment = null; replay = null; lastReplay = -1e9; usedAt = new Map();
    simW = Math.round(viewW); run = {seed, w: simW, inputs: [], events: [], human: 0, m: 0};
    prev = {cam, x: pl.x, y: pl.y};
  }
  function spawnUpTo(xRight) {
    for (let ci = Math.max(0, Math.floor(cam / (CW * TS)) - 1); ci <= Math.floor(xRight / (CW * TS)); ci++) {
      const ch = chunk(ci);
      if (!ch || ch.spawned) continue;
      ch.spawned = true;
      for (const s of ch.spawns) enemies.push({kind: s.kind, x: s.x, y: s.y, baseY: s.y, w: 14, h: 14, vx: s.kind === 'flier' ? -.45 : -.5,
        vy: 0, ground: false, state: 'walk', t: hash(s.x, 7) % 97, period: 80 + hash(s.x, 9) % 50});
    }
  }
  // Plazas are quiet: creatures turn back at their edges (a world rule, so
  // ghosts and the planner see the same world).
  const quiet = x => { const span = REGION * CW * TS, k = x - Math.floor(x / span) * span; return x > span && (k > span - PLAZA * TS || k < 8 * TS); };
  function updateEnemy(e) {
    e.t++;
    if ((e.state === 'walk' || e.kind === 'flier') && e.kind !== 'pod' && quiet(e.x + 7 + e.vx * 8) && !quiet(e.x + 7)) { e.vx = -e.vx; if (e.dir) e.dir = -e.dir; }
    if (e.state === 'dead') { e.vy += .35; e.y += e.vy; e.x += e.vx; return e.y < VIEW_H + 80; }
    if (e.state === 'squash') return e.t < 34;
    if (e.kind === 'flier') { e.x += e.vx; e.y = e.baseY + dsin(e.t * .045) * 20; return e.x > cam - 64; }
    if (e.kind === 'pod') {   // seed pods fly straight and burst on whatever they hit
      e.x += e.vx;
      if (solid(Math.floor(e.x / TS), Math.floor((e.y + 5) / TS))) { e.state = 'squash'; e.t = 0; puff(e.x + 5, e.y + 5, '#d9b27a', 4); }
      return e.x > cam - 64 && e.t < 600;
    }
    if (e.kind === 'hopper') {
      e.vx = e.ground ? 0 : e.dir || -.8;
      if (e.ground && e.t % e.period === 0) { e.vy = -5.4; e.dir = pl.x < e.x ? -.8 : .8; e.ground = false; }
    }
    if (e.kind === 'snail' && e.state === 'walk' && e.ground) {
      const ahead = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
      if (!solid(Math.floor(ahead / TS), Math.floor((e.y + e.h + 2) / TS))) e.vx = -e.vx;
    }
    if (e.state === 'shell') e.vx = 0;
    const v = e.vx;
    if (moveX(e) && v) e.vx = -v;
    e.vy = Math.min(6, e.vy + .35); moveY(e);
    if (e.ground) e.gY = e.y;
    if (e.state === 'slide') for (const o of enemies) if (o !== e && o.state !== 'dead' && o.state !== 'squash' && overlap(e, o)) { o.state = 'dead'; o.vy = -3.5; o.vx = e.vx * .3; puff(o.x + 7, o.y + 7, '#fff2c8', 6); }
    return e.y < VIEW_H + 40 && e.x > cam - 96;
  }

  /* ---------------- effects ---------------- */
  function puff(x, y, col, n, up = 1) { for (let i = 0; i < n; i++) { const a = Math.PI * (1 + i / (n - 1 || 1)) * up; parts.push({x, y, vx: Math.cos(a) * (1 + i % 3 * .5), vy: Math.sin(a) * 1.2 - .4, life: 26 + i % 4 * 4, col, r: 1.6 + i % 3 * .6}); } }
  // What a footfall throws up depends on the ground: dust and grass clippings,
  // snow, cloud, or glowing spores in the caves.
  function kick(x, y, n, power = 1, m = surface()) {
    const bio = biomeAt(x);
    for (let i = 0; i < n; i++) {
      const s = (i % 2 ? 1 : -1) * (.35 + (i * 7 % 5) * .22) * power, up = (.5 + (i * 3 % 4) * .3) * power, life = 26 + i % 3 * 7;
      if (bio === 'frost') parts.push({x: x + s * 1.5, y: y - .5, vx: s, vy: -up, life: life + 6, l0: life + 6, col: '#ffffff', r: 2 + i % 3 * .8, soft: true, g: .035, drag: .92});
      else if (m === 'cloud') parts.push({x: x + s * 2, y: y - 1, vx: s * .8, vy: -up * .5, life: life + 10, l0: life + 10, col: '#f4f0ff', r: 2.6 + i % 3, soft: true, g: -.012, drag: .9});
      else if (bio === 'caves') parts.push({x: x + s * 2.5, y: y - 1 - i % 3, vx: ((i * 37 + frameNo) % 11 - 5) * .09, vy: -(.2 + (i * 53 + frameNo) % 7 * .09), life: 50 + i % 4 * 14, l0: 50 + i % 4 * 14, col: ['#8ff7de', '#c9a8ff', '#a5fbe8'][i % 3], r: .9, glow: true, g: -.006, drag: .97});
      else if (m === 'grass' && i % 2) parts.push({x, y: y - 1, vx: s * 1.2, vy: -up * 1.6, life: 34, l0: 34, col: ['#7cc24e', '#a6dc6a', '#5aa83f'][i % 3], r: 1.1, leaf: true, spin: s, g: .06, drag: .95});
      else parts.push({x: x + s, y: y - .5, vx: s, vy: -up * .7, life, l0: life, col: m === 'stone' ? '#e4e0d6' : '#efdcb7', r: 1.8 + i % 3 * .6, soft: true, g: .02, drag: .93});
    }
  }
  // Each footfall: a little kick, a footprint in snow or cloud (the moss
  // lights up under Pip's boots in the caves), petals where he runs through flowers.
  function stepFx(st) {
    const m = surface(), x = pl.x + 6 + (st % 2 ? 1.5 : -1.5), y = pl.y + pl.h, bio = biomeAt(x);
    if (bio !== 'meadow' || st % 2) kick(x, y, 1, .7, m);
    if (!pl.on && (m === 'snow' || m === 'cloud' || m === 'moss')) { prints.push({x, y, at: frameNo, m}); if (prints.length > 40) prints.shift(); }
    if (m === 'grass') {
      const tx = Math.floor(x / TS), ty = Math.floor((y + 1) / TS), hf = hash(seed ^ 0xf10, tx * 16 + ty), fx = tx * TS + 3 + (hf >>> 3) % 10;
      if (hf % 5 === 0 && Math.abs(fx - x) < 5) {
        const col = ['#fffaf0', '#ffd23f', '#f29ab8'][(hf >>> 7) % 3];
        for (let i = 0; i < 3; i++) parts.push({x: fx, y: y - 2.5, vx: (i - 1) * .5 + pl.vx * .3, vy: -1 - i * .3, life: 44, l0: 44, col, r: .8, leaf: true, spin: i - 1 || .5, g: .03, drag: .95});
      }
    }
  }
  function sparkle(x, y) { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; parts.push({x, y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, life: 22, col: '#ffe9a0', r: 1.4, star: true}); } }

  /* ---------------- the demo player ---------------- */
  // Options: hold a direction, wait some frames, then hold jump for some frames.
  const OPTIONS = [];
  // Run and jump at a chosen moment; or back off / pause (optionally hopping)
  // to gain a run-up or let a creature pass. Then the default policy continues.
  for (const wait of [0, 5, 10, 18, 30]) for (const hold of [0, 3, 7, 11, 16]) if (hold || !wait) OPTIONS.push({dir: 1, wait, hold});
  for (const dir of [0, -1]) for (const wait of [8, 16, 30]) for (const hold of [0, 7, 16]) OPTIONS.push({dir, wait, hold});
  let plan = null;
  // After a plan's own moves, rollouts continue with a sensible default: run
  // right and jump when the ground ends, a wall rises or a creature is ahead.
  // Without it, any plan whose one jump came early looked fatal and Pip froze.
  // Where a creature will be f frames from now, from its own rules: fliers bob,
  // hoppers leap on a timer toward Pip, everything else keeps its heading.
  function predict(e, f) {
    if (e.kind === 'flier') return [e.x + e.vx * f, e.baseY + dsin((e.t + f) * .045) * 20];
    if (e.kind === 'hopper') {
      const gY = e.gY ?? e.y, dir = pl.x < e.x ? -.8 : .8;
      let u, x0 = e.x;
      if (!e.ground) { u = f + Math.max(0, Math.round((-5.4 - e.vy) / -.35)); }
      else { const k0 = e.period - (e.t % e.period); if (f < k0) return [e.x, e.y]; u = f - k0; }
      const y = gY - (5.4 * u - .35 * u * (u + 1) / 2);
      return y >= gY && u > 2 ? [x0 + dir * 31 * .8, gY] : [x0 + (e.ground ? dir : e.dir || dir) * .8 * u, Math.min(gY, y)];
    }
    return [e.x + e.vx * f, e.y];
  }
  function danger(b, threats, f) {
    const ahead = b.x + b.w + Math.max(6, b.vx * 9), feet = Math.floor((b.y + b.h + 2) / TS);
    // Scan every column up to the lookahead point: a single probe stepped
    // right over one-tile pits when Pip landed fast at their lip.
    for (let col = Math.floor((b.x + b.w + 1) / TS); col <= Math.floor(ahead / TS); col++) {
      if (!solid(col, feet)) return true;
      for (let ty = Math.floor(b.y / TS); ty <= Math.floor((b.y + b.h - 1) / TS); ty++) if (solid(col, ty)) return true;
    }
    for (const e of threats) { const [ex, ey] = predict(e, f); if (ex > b.x - 4 && ex - b.x < 44 + b.vx * 6 && Math.abs(ey - b.y) < 40) return true; }
    return false;
  }
  // Lifts: ride one rather than leap into the gap it crosses. On board, wait
  // until ground is within a hop; at the edge, wait until the lift is there.
  const STAND = {l: false, r: false, j: false};
  function liftPolicy(b) {
    const feet = Math.floor((b.y + b.h + 2) / TS);
    if (b.on) {
      for (let col = Math.floor((b.x + b.w) / TS) + 1; col <= Math.floor((b.x + b.w + 40) / TS); col++)
        for (let row = feet - 4; row <= feet; row++) if (solid(col, row)) return null;
      return STAND;
    }
    if (!b.ground) return null;
    const R = RULES[biomeAt(b.x)], look = b.x + b.w + 12 + b.vx * b.vx / (2 * R.skid);
    let edge = -1;
    for (let col = Math.floor((b.x + b.w + 1) / TS); col <= Math.floor(look / TS); col++) if (!solid(col, feet)) { edge = col * TS; break; }
    if (edge < 0) return null;
    const m = moversNear(b.x).find(q => q.ax > 0 && q.x <= edge + 10 && q.x + q.ax + q.w > edge);
    if (!m) return null;
    const [mx, my] = moverAt(m, simNow + 14);
    if (mx <= b.x + b.w + 10 && mx + m.w >= b.x + 24 && Math.abs(my - b.y - b.h) < 10) return null;
    return b.vx > .3 ? {l: true, r: false, j: false} : STAND;
  }
  function policy(o, f, b, st, threats, tf) {
    const own = o.dir === 1 ? (o.hold ? o.wait + o.hold + 2 : 0) : o.wait;
    if (f < own) return o.dir === 1 ? {r: true, l: false, j: f >= o.wait && f < o.wait + o.hold}
      : {r: false, l: o.dir < 0, j: f < o.hold};
    const lift = liftPolicy(b);
    if (lift) return lift;
    // Leap only under open sky: jumping under a block row bonks Pip's head and
    // drops him short of the gap. Where the row runs right up to the edge, run
    // off the lip and leap in the coyote window once clear (or, as a last
    // resort, as the window closes).
    if (st.auto <= 0 && (b.ground || b.coyote > 0) && danger(b, threats, tf) && (headroom(b) || (!b.ground && b.coyote <= 2))) st.auto = 15;
    return {r: true, l: false, j: st.auto-- > 0};
  }
  function headroom(b) {
    const top = Math.floor(b.y / TS);
    for (let tx = Math.floor(b.x / TS); tx <= Math.floor((b.x + b.w + Math.max(0, b.vx) * 12) / TS); tx++)
      for (let ty = top - 3; ty < top; ty++) if (solid(tx, ty)) return false;
    return true;
  }
  // One imagined future: its score, the frame it would end in a tumble (if
  // any) and a sparse path for the thought overlay.
  function simulate(o, threats) {
    const b = {...pl}, stomped = new Set(), got = new Set(), st = {auto: 0}, pts = [[b.x + 6, b.y + 10]];
    const near = marks.filter(k => k.x > pl.x - 32 && k.x < pl.x + 260);
    let bonus = 0, sumX = 0, wary = 0, hit = false;
    const lazy = impatience * (o.dir !== 1 ? 500 : o.wait * 10);
    const end = (score, death) => { pts.push([b.x + 6, b.y + 10]); return {score: score - lazy, death, pts}; };
    // A tumble near the end of a rollout, while the simple default policy is
    // driving, is a risk rather than a certainty: Pip replans long before then.
    // Counting it as doom made "stand still" beat a clean jump available now.
    const own = o.dir === 1 ? (o.hold ? o.wait + o.hold + 2 : 0) : o.wait;
    const fall = f => f >= 64 && f >= own ? end(b.x - pl.x + (sumX / 96 - pl.x) * f / 96 + bonus - 420, -1) : end(-1e6 + f * 100, f);
    const bumped = new Set(), gotItem = new Set();
    for (let f = 0; f < 96; f++) {
      simNow = frameNo + f;
      const ev = stepBody(b, policy(o, f, b, st, threats, f));
      // Star blocks are worth a detour: a seed, and sometimes a Golden Sprout.
      if (ev.bump && tileAt(ev.bump[0], ev.bump[1]) === BLOCK && !bumped.has(ev.bump[0])) { bumped.add(ev.bump[0]); bonus += big ? 14 : 30; }
      if (b.x < cam) { b.x = cam; b.vx = Math.max(0, b.vx); }
      sumX += b.x;
      if (f % 4 === 3) pts.push([b.x + 6, b.y + 10]);
      if (b.y > VIEW_H) return fall(f);
      // Near a remembered tumble Pip keeps a wider berth and avoids retracing it.
      const mk = near.find(k => Math.abs(k.x - b.x) < 56);
      const m = mk ? 1 + 3 * risk : 0;
      if (mk && Math.abs(mk.x - b.x) < 14 && Math.abs(mk.y - b.y) < 18) wary += 1.2 * (1 + risk);
      for (const e of threats) {
        if (stomped.has(e)) continue;
        const [ex, ey] = predict(e, f);
        if (b.x < ex + e.w + m && b.x + b.w > ex - m && b.y < ey + e.h + m && b.y + b.h > ey - m) {
          if (e.state === 'shell') continue;
          if (b.vy > 0 && b.y + b.h - ey < 9) { stomped.add(e); b.vy = -4.4; bonus += 35 * (1 - .5 * risk); }
          else if (big && !hit) { hit = true; bonus -= 260; }
          else if (!big || hit) return fall(f);
        }
      }
      for (const it of items) {
        if (gotItem.has(it)) continue;
        // A sprout slides on, then drops to whatever ground lies below it.
        const ix = it.x + (it.rise ? 0 : 1.3) * Math.max(0, f - (it.rise || 0)), col = Math.floor((ix + 6) / TS);
        let iy = it.y; if (!solid(col, Math.floor((it.y + 13) / TS))) { let r = Math.floor((it.y + 12) / TS); while (r < ROWS && !solid(col, r)) r++; iy = r * TS - 12; }
        if (Math.abs(ix - b.x) < 13 && Math.abs(iy + 12 - b.y - b.h) < 18) { gotItem.add(it); bonus += big ? 10 : 70; }
      }
      for (const s of seedsNear) if (!got.has(s) && Math.abs(s.x - b.x - 6) < 11 && Math.abs(s.y - b.y - 10) < 14) { got.add(s); bonus += 25 * (1 - .4 * risk); }
    }
    // Average position rewards moving now: otherwise "wait, then go" ties with
    // "go" on every replan and Pip procrastinates forever.
    return end(b.x - pl.x + (sumX / 96 - pl.x) + bonus + (b.ground ? 8 : 0) - o.hold * .15 - wary, -1);
  }
  let seedsNear = [];
  function imagine() {
    const threats = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash' && Math.abs(e.x - pl.x) < 260);
    seedsNear = [];
    for (const ch of chunks.values()) for (const s of ch.seeds) if (!s.got && s.x > pl.x - 16 && s.x < pl.x + 200) seedsNear.push(s);
    const keep = simNow, arcs = OPTIONS.map(o => simulate(o, threats));
    simNow = keep;
    let best = 0;
    arcs.forEach((a, i) => { if (a.score > arcs[best].score) best = i; });
    return {arcs, best};
  }
  function think() {
    const {arcs, best} = imagine();
    // Tension: how many imagined futures end in a tumble soon. It drives slow
    // motion and the camera, so drama comes from the planner, not a script.
    const soon = arcs.filter(a => a.death >= 0 && a.death < 40).length / arcs.length;
    const closeCall = arcs[best].death < 0 && arcs.some(a => a.death >= 0 && a.death <= 12);
    const order = arcs.map((a, i) => i).sort((i, j) => arcs[j].score - arcs[i].score);
    arcs.forEach((a, i) => { a.rank = order.indexOf(i) / (arcs.length - 1); a.chosen = i === best; });
    plan = {...OPTIONS[best], f: 0, st: {auto: 0}, arcs, tension: soon, at: frameNo};
    if (closeCall) noteMoment('close call');
  }
  // Impatience: when every future ends in a fall, the one that falls latest
  // scores best, and "wait a moment" would win forever. After ~3 s without
  // progress, waiting and backing off are penalized more and more, so Pip
  // commits to his best attempt (waiting for a lift is a forward plan, so it
  // is unaffected).
  let stuckX = 0, stuckSince = 0, impatience = 0;
  function demoInput() {
    if (pl.x > stuckX + 24 || arrival) { stuckX = pl.x; stuckSince = frameNo; }
    impatience = clamp(0, (frameNo - stuckSince - 150) / 150, 1);
    // Commit to a plan's own moves before reconsidering; replanning mid-plan
    // re-chose "jump in 5 frames" every 5 frames and the jump never came.
    const own = plan ? (plan.dir === 1 ? (plan.hold ? plan.wait + plan.hold + 2 : 0) : plan.wait) : 0;
    if (!plan || (pl.ground && plan.f >= Math.max(5, own)) || plan.f >= Math.max(22, own + 8)) think();
    const live = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash');
    // Approaching a remembered tumble: a little "!" while Pip thinks it over.
    if (plan.f === 0) wary = marks.some(k => k.x > pl.x + 8 && k.x < pl.x + 90) ? 40 : wary;
    return policy(plan, plan.f++, pl, plan.st, live, 0);
  }

  /* ---------------- director ----------------
     While the demo plays, viewers drop a brick, a creature or a spring ahead
     of Pip. The planner referees: a placement that no imagined future survives
     is refused. Accepted ones force a visible replan and score for the viewer. */
  const TOOLS = [{id: 'brick', key: 'Digit1'}, {id: 'creature', key: 'Digit2'}, {id: 'spring', key: 'Digit3'}];
  let tool = null, charges = 3, chargeT = 0, dirScore = 0, notes = [], placed = [], hover = null, view = {zoom: 1, cx: 0, fy: 0};
  function note(text, x, y, col) { notes.push({text, x, y, t: 0, col: col || '#fffbea'}); }
  // Rows of the portrait console, in CSS pixels.
  function rows() {
    const H = cv.clientHeight, top = consoleY, size = Math.round(Math.max(40, Math.min(56, VIEW_H * S / dpr * .1)));
    return {strip: top + 10, tools: top + 60, hint: Math.min(H - 24, top + 60 + size + 12 + Math.round(size * .72) + 26), pad: (top + 64 + H) / 2};
  }
  function toolbar() {
    const top = oy / dpr, bandH = VIEW_H * S / dpr;
    const size = Math.round(Math.max(40, Math.min(56, bandH * .1))), gap = Math.round(size * .25);
    const y = portrait ? rows().tools : top + bandH - size - 12;
    return TOOLS.map((t, i) => ({...t, x: 12 + i * (size + gap), y, w: size, h: size}));
  }
  // Share and restart sit at the opposite end of the toolbar's row. Hidden while
  // someone plays by touch: that corner is the jump button then.
  function actions() {
    if (replay || (human && usingTouch)) return [];
    // In portrait the row is too narrow for both, so they go on a row below.
    const bar = toolbar(), h = Math.round(bar[0].h * .72), W = cv.clientWidth, y = cv.clientHeight <= W ? bar[0].y + (bar[0].h - h) / 2 : bar[0].y + bar[0].h + 12;
    const font = main.font;   // measuring must not leak into whatever is drawn next
    main.font = `600 ${Math.round(h * .38)}px system-ui,-apple-system,sans-serif`;
    let x = W - 12;
    const list = [['share', '⤴ Share run'], ['restart', ghost ? '↺ Race again' : '↺ Restart']];
    if (typeof PipAudio !== 'undefined') list.push(['sound', PipAudio.label()]);
    const out = list.map(([id, label]) => {
      const w = Math.round(main.measureText(label).width + h * .9); x -= w; const b = {id, label, x, y, w, h}; x -= 8; return b;
    });
    main.font = font;
    return out;
  }
  // Screen point to tile, undoing the tension push-in when it is active.
  function cellAt(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    let dx = (clientX - r.left) * dpr, dy = (clientY - r.top) * dpr;
    if (view.zoom > 1.003) { dx = (dx - view.cx + view.cx * view.zoom) / view.zoom; dy = (dy - view.fy + view.fy * view.zoom) / view.zoom; }
    return [Math.floor((dx - ox + Math.round(cam * S)) / S / TS), Math.floor((dy - oy) / S / TS)];
  }
  function groundBelow(tx, ty) { let y = ty; while (y < ROWS - 1 && !solid(tx, y + 1)) y++; return y < ROWS - 1 ? y : -1; }
  function why(kind, tx, ty) {
    if (replay || dead) return 'Wait a moment';
    if (tx * TS < pl.x + 28 || tx * TS > pl.x + TS * 10) return 'Place it just ahead of Pip';
    if (ty < 1 || ty >= ROWS - 1 || tileAt(tx, ty) !== EMPTY) return 'That spot is taken';
    const box = {x: tx * TS, y: ty * TS, w: TS, h: TS};
    if (overlap(box, pl) || enemies.some(e => e.state !== 'dead' && overlap(box, e))) return 'That spot is taken';
    if (kind === 'spring' && !solid(tx, ty + 1)) return 'Springs need ground under them';
    if (kind === 'creature' && groundBelow(tx, ty) < 0) return 'No ground there';
    return null;
  }
  function place(tx, ty) {
    const reason = why(tool, tx, ty);
    if (reason) { sfx('refuse'); note(reason, tx * TS + 8, ty * TS, '#ffd9cf'); return; }
    if (charges < 1) { sfx('refuse'); note('Recharging…', tx * TS + 8, ty * TS, '#ffd9cf'); return; }
    const before = imagine(), undo = applyPlacement(tool, tx, ty), after = imagine();
    // Unfair is either certain doom or a trap: no surviving future gets past a
    // spot that some future could get past before.
    const past = r => r.arcs.some(a => a.death < 0 && a.pts[a.pts.length - 1][0] > tx * TS + 20);
    if (after.arcs[after.best].death >= 0) { undo(); sfx('refuse'); note('Too cruel — Pip couldn’t survive that', tx * TS + 8, ty * TS, '#ff9f8f'); return; }
    if (past(before) && !past(after)) { undo(); sfx('refuse'); note('Too cruel — that would trap Pip', tx * TS + 8, ty * TS, '#ff9f8f'); return; }
    charges--;
    logEvent({f: frameNo + 1, k: tool[0], x: tx, y: ty});   // it is in the world from the next tick on
    placed.push({kind: tool, tx, ty, x: tx * TS + 8, frame: frameNo});
    const rerouted = after.best !== before.best, cost = Math.max(0, before.arcs[before.best].score - after.arcs[after.best].score);
    const pts = rerouted ? Math.round(20 + Math.min(80, cost * .5)) : 5;
    dirScore += pts; note(rerouted ? `Pip reroutes +${pts}` : `Pip shrugs it off +${pts}`, tx * TS + 8, ty * TS);
    sfx('place'); sparkle(tx * TS + 8, ty * TS + 8); plan = null;   // replan now: the thought lines visibly change
  }
  function applyPlacement(kind, tx, ty) {
    if (kind === 'creature') {
      const gy = groundBelow(tx, ty), e = {kind: 'walker', x: tx * TS + 1, y: (gy + 1) * TS - 14, baseY: 0, w: 14, h: 14, vx: -.5, vy: 0, ground: true, state: 'walk', t: 0, period: 99, director: true};
      enemies.push(e); return () => enemies.splice(enemies.indexOf(e), 1);
    }
    setTile(tx, ty, kind === 'spring' ? SPRING : BRICK); return () => setTile(tx, ty, EMPTY);
  }
  function gotcha() {
    if (human) return;
    const p = placed.find(q => frameNo - q.frame < 300 && Math.abs(q.x - pl.x) < 80);
    if (p) { placed.splice(placed.indexOf(p), 1); dirScore += 150; sfx('gotcha'); note('Gotcha! +150', pl.x + 6, pl.y - 6, '#ffd36a'); }
  }
  function assist([tx, ty]) {
    if (human) return;
    const p = placed.find(q => q.kind === 'spring' && q.tx === tx && q.ty === ty && !q.used);
    if (p) { p.used = true; dirScore += 40; note('Boing! Pip used your spring +40', tx * TS + 8, ty * TS - 8, '#c8f5ff'); }
  }
  function directorTick() {
    if (charges < 3 && ++chargeT >= 360) { charges++; chargeT = 0; }
    notes = notes.filter(n => ++n.t < 110);
    placed = placed.filter(q => frameNo - q.frame < 1200);
  }
  function directorPointer(e) {
    const hit = toolbar().find(b => e.offsetX >= b.x && e.offsetX <= b.x + b.w && e.offsetY >= b.y && e.offsetY <= b.y + b.h);
    if (hit) { tool = tool === hit.id ? null : hit.id; return true; }
    if (tool) { if (portrait && e.offsetY > consoleY) { tool = null; return true; } place(...cellAt(e.clientX, e.clientY)); return true; }
    return false;
  }

  /* ---------------- input ---------------- */
  const keys = new Set(), touch = {l: false, r: false, j: false};
  let human = false, idleSince = 0, usingTouch = false, hintUntil = 0;
  const takeOver = () => { if (!human) { human = true; hintUntil = performance.now() + 6000; } idleSince = performance.now(); };
  addEventListener('keydown', e => {
    const k = e.code;
    if (typeof PipAudio !== 'undefined') { PipAudio.unlock(); if (k === 'KeyM' && !e.repeat) { PipAudio.cycle(); return; } }
    if (k === 'KeyR' && !e.repeat) { restart(); return; }
    if (!human) {
      const t = TOOLS.find(q => q.key === k);
      if (t) { tool = tool === t.id ? null : t.id; return; }
      if (k === 'Escape') { tool = null; return; }
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyZ', 'KeyX'].includes(k)) { e.preventDefault(); keys.add(k); usingTouch = false; takeOver(); }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const zones = () => {
    const W = cv.clientWidth, H = cv.clientHeight;
    if (portrait) {   // big thumb zones in the console
      const R = rows(), s = Math.min(W * .2, (H - R.tools) * .4);
      return {l: [W * .15, R.pad, s * .62], r: [W * .4, R.pad, s * .62], j: [W * .78, R.pad, s * .82]};
    }
    const s = Math.min(W, H) * .16, y = H - s * .9;
    return {l: [s * .85, y, s * .55], r: [s * 2.05, y, s * .55], j: [W - s * .95, y, s * .65]};
  };
  function readTouches(list) {
    touch.l = touch.r = touch.j = false;
    const z = zones();
    for (const p of list.values()) {
      // Anywhere in the console counts: left quarter runs left, the next
      // quarter runs right, the right half jumps. Thumbs need not aim.
      if (portrait && p.y > consoleY) { const f = p.x / cv.clientWidth; touch[f < .28 ? 'l' : f < .56 ? 'r' : 'j'] = true; continue; }
      for (const k of ['l', 'r', 'j']) { const [x, y, rad] = z[k]; if (Math.hypot(p.x - x, p.y - y) < rad * 1.5) touch[k] = true; }
      if (!touch.l && !touch.r && !touch.j) { if (p.x > cv.clientWidth * .5) touch.j = true; }
    }
  }
  const pointers = new Map();
  cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') usingTouch = true; const a = actions().find(b => e.offsetX >= b.x && e.offsetX <= b.x + b.w && e.offsetY >= b.y && e.offsetY <= b.y + b.h); if (typeof PipAudio !== 'undefined') PipAudio.unlock(); if (a) { (a.id === 'share' ? shareRun : a.id === 'sound' ? PipAudio.cycle : restart)(); return; } if (!human && directorPointer(e)) return; if (e.pointerType === 'mouse') { takeOver(); return; } usingTouch = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY}); readTouches(pointers); takeOver(); });
  cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons) hover = tool ? cellAt(e.clientX, e.clientY) : null; if (pointers.has(e.pointerId)) { pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY}); readTouches(pointers); } });
  const lift = e => { pointers.delete(e.pointerId); readTouches(pointers); };
  cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
  function humanInput() {
    const any = keys.size || pointers.size;
    if (any) idleSince = performance.now();
    else if (performance.now() - idleSince > 9000) human = false;   // hand back to the demo
    return {l: keys.has('ArrowLeft') || keys.has('KeyA') || touch.l, r: keys.has('ArrowRight') || keys.has('KeyD') || touch.r,
      j: keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyZ') || keys.has('KeyX') || touch.j};
  }

  /* ---------------- simulation tick ---------------- */
  function grow() {
    sfx(big ? 'seed' : 'grow', {streak: 5});
    if (big) { seeds += 5; sparkle(pl.x + 6, pl.y); return; }
    big = true; growing = 36; pl.y -= 9; pl.h = P.h + 9; pl.w = P.w + 2; sparkle(pl.x + 6, pl.y + 8);
  }
  function shrink() { sfx('shrink'); big = false; growing = 36; pl.y += 9; pl.h = P.h; pl.w = P.w; inv = 110; puff(pl.x + 6, pl.y + 10, '#fff4dc', 7); }
  function die() {
    if (dead || inv) return;
    if (big) { shrink(); return; }     // a big Pip takes one hit and shrinks instead of tumbling
    gotcha(); remember(); sfx('tumble'); dead = 1; pl.vy = -5.2; pl.vx = 0; puff(pl.x + 6, pl.y + 10, '#fff4dc', 7); }
  // A tumble leaves a mark the planner steers around, and makes Pip warier for a while.
  // After three falls into the same gap, a bridge grows across it at the
  // height of the near lip. It is a world rule driven by the world's own
  // state, so a ghost rebuild grows the same bridge at the same moment.
  function helpBridge() {
    const k = marks[marks.length - 1];
    if (marks.filter(q => Math.abs(q.x - k.x) < 40).length < 3) return;
    const top = x => { for (let y = 3; y < ROWS; y++) { const v = tileAt(x, y); if (v && v !== CEIL) return y; } return ROWS; };
    const tx = Math.floor((k.x + 6) / TS);
    let L = tx; while (L > tx - 8 && top(L) === ROWS) L--;
    const row = top(L); if (row === ROWS) return;
    let n = 0; for (let x = L + 1; x <= L + 10 && top(x) === ROWS; x++, n++) setTile(x, row, BRIDGE);
    if (!n) return;
    note('A bridge grows to help', (L + 1 + n / 2) * TS, row * TS - 6, '#c8f5b0'); sparkle((L + 1 + n / 2) * TS, row * TS); sfx('sprout');
  }
  let progressX = 0, progressAt = 0;
  function carry() {
    const top = x => { for (let y = 3; y < ROWS; y++) { const v = tileAt(x, y); if (v && v !== CEIL) return y; } return ROWS; };
    for (let tx = Math.floor(maxX / TS) + 3, end = tx + 3 * CW; tx < end; tx++) {
      const ch = chunk(Math.floor(tx / CW)), row = top(tx);
      if (!ch || !ch.safe.has(tx - ch.ci * CW) || row === ROWS || enemies.some(e => Math.abs(e.x - tx * TS) < 64)) continue;
      puff(pl.x + 6, pl.y + 10, '#ffffff', 8);
      pl.x = tx * TS + 2; pl.y = row * TS - pl.h; pl.vx = pl.vy = 0; pl.on = null; cp = {x: pl.x, y: pl.y};
      progressX = pl.x; progressAt = frameNo; plan = null;
      note('A breeze carries Pip on', pl.x + 6, pl.y - 8, '#e6f6ff'); sparkle(pl.x + 6, pl.y + 6); sfx('find');
      return;
    }
    progressAt = frameNo;   // nowhere safe yet: try again later
  }
  function remember() { marks.push({x: pl.x, y: Math.min(pl.y, VIEW_H - P.h), at: frameNo}); risk = Math.min(1, risk + .35); journey.tumbles++; arrival = null; }
  const liveInput = () => arrival ? arrivalInput() : human ? humanInput() : demoInput();
  /* ---------------- journey ----------------
     Each region is a chapter that ends at the next region's landmark. Pip
     slows to a walk across the plaza, reaches it and hops, and a card sums
     the chapter up. The walk goes through the input log like any other
     input, so ghosts replay it exactly. */
  let arrival = null, chapter = null, journey = {start: 0, seeds0: 0, tumbles: 0, finds0: 0, arrived: -1}, chapters = 0;
  function arrivalInput() {
    const a = arrival; a.t++;
    const held = human ? humanInput() : null;
    if (a.phase === 'walk') {
      if (pl.x + 6 >= a.gx) { a.phase = 'cheer'; a.t = 0; arrive(); }
      return {l: false, r: pl.vx < .9, j: false};
    }
    if (a.t > 80 || (held && held.j && a.t > 30)) { arrival = null; plan = null; return held || demoInput(); }
    return {l: false, r: false, j: a.t >= 10 && a.t < 16};
  }
  function arrive() {
    const r = arrival.region, next = BIOMES[regionBiome(r + 1)];
    seen = seen || new Set(store.get('pip-run:seen') || []);
    let vs = '';
    if (ghost) {
      const i = ghost.frames.findIndex(g => g.x + 6 >= arrival.gx);
      if (i >= 0) { const d = Math.round((frameNo - i - 1) / RATE); vs = d === 0 ? 'Level with the ghost here' : `${Math.abs(d)} s ${d < 0 ? 'ahead of' : 'behind'} the ghost here`; }
    }
    chapter = {t: 0, num: r + 1, done: BIOMES[regionBiome(r)].name, mark: next.mark, next: next.name, sub: next.sub,
      seeds: seeds - journey.seeds0, time: (frameNo - journey.start) / RATE, tumbles: journey.tumbles, finds: seen.size - journey.finds0, vs};
    journey.arrived = r; chapters++; sfx('arrive');
    for (let k = 0; k < 4; k++) sparkle(arrival.gx + 8 + (k - 1.5) * 18, pl.y - 10 - (k % 2) * 14);
  }
  const clock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  let prev = {cam: 0, x: 0, y: 0};
  function tick(src = liveInput) {
    if (replay) replay = null;   // only headless callers tick during a replay; the live loop pauses
    if (!ghostSim) { prev = {cam, x: pl.x, y: pl.y}; for (const e of enemies) { e.px = e.x; e.py = e.y; } }
    frameNo++;
    if (ghostSim) replayEvents();
    else { const w = Math.round(viewW); if (w !== simW) { simW = w; logEvent({f: frameNo, k: 'w', w}); } }
    risk = Math.max(.25, risk - .0002); if (wary) wary--;
    tension += ((human || !plan || dead ? 0 : plan.tension) - tension) * .06;
    directorTick();
    if (human) tool = null;
    if (!ghostSim) record();
    if (dead) {
      dead++; pl.vy = Math.min(6, pl.vy + .3); pl.y += pl.vy;
      if (dead > 75) { regrowAll(); pl.on = null; pl.x = cp.x; pl.y = cp.y - 4; pl.vx = pl.vy = 0; dead = 0; inv = 110; cam = Math.min(cam, Math.max(0, cp.x - simW * .3)); plan = null; enemies = enemies.filter(e => Math.abs(e.x - cp.x) > 90 || e.kind === 'flier'); }
      return;
    }
    const inp = src();
    if (!ghostSim) {
      if (!human && (keys.size || pointers.size)) takeOver();
      if (run.inputs.length < RUN_MAX) { run.inputs.push((inp.l ? 1 : 0) | (inp.r ? 2 : 0) | (inp.j ? 4 : 0)); if (human) run.human++; }
    }
    simNow = frameNo;   // the planner may have moved it while imagining
    const vy0 = pl.vy, under = pl.ground ? surface() : 'wood', ev = stepBody(pl, inp);
    crumbleTick();
    if (pl.x < cam) { pl.x = cam; pl.vx = Math.max(0, pl.vx); }
    if (inp.r && !inp.l) facing = 1; else if (inp.l && !inp.r) facing = -1;
    anim += Math.abs(pl.vx);
    if (pl.ground && Math.abs(pl.vx) > .3) { const st = Math.floor(anim / (stride() / 2)); if (st !== stepAt) { stepAt = st; sfx('step', {surface: surface(), v: Math.abs(pl.vx) / P.max}); stepFx(st); } }
    sq *= .78;
    skidding = pl.ground && Math.abs(pl.vx) > 1 && (inp.l && pl.vx > 0 || inp.r && pl.vx < 0);
    if (ev.jumped) { sfx('jump'); sq = 1; kick(pl.x + 6, pl.y + pl.h, 4, 1, under); }
    if (ev.landed) { sfx('land', {impact: vy0}); sq = -1; landedAt = frameNo; kick(pl.x + 6, pl.y + pl.h, 4 + Math.min(4, vy0 | 0), Math.min(1.6, .6 + vy0 / 5)); }
    if (pl.ground && Math.abs(pl.vx) > 1.4 && (inp.l && pl.vx > 0 || inp.r && pl.vx < 0) && frameNo % 4 === 0) kick(pl.x + 6, pl.y + pl.h, 2, 1.2);
    if (ev.bump) bump(ev.bump[0], ev.bump[1]);
    if (pl.y > VIEW_H + 24) { if (!dead) { gotcha(); remember(); sfx('tumble'); helpBridge(); } dead = 30; pl.vy = 0; if (big) { big = false; pl.h = P.h; pl.w = P.w; } }
    if (inv) inv--;
    if (growing) growing--;
    if (ev.sprung) { sfx('spring'); sq = 1; bumps.push({tx: ev.sprung[0], ty: ev.sprung[1], t: 0}); puff(pl.x + 6, pl.y + pl.h, '#fff4dc', 5); assist(ev.sprung); }
    items = items.filter(updateItem);
    // A safe, grounded spot becomes the next respawn point.
    if (pl.ground) {
      const tx = Math.floor((pl.x + 6) / TS), ch = chunks.get(Math.floor(tx / CW));
      if (ch && ch.safe.has(tx - ch.ci * CW) && pl.x > cp.x + 64 && !enemies.some(e => Math.abs(e.x - pl.x) < 80)) cp = {x: pl.x, y: pl.y};
    }
    maxX = Math.max(maxX, pl.x);
    // Last resort: the world never holds Pip for long. After 30 s without
    // progress a breeze carries him on to the next safe ground. It depends
    // only on the world's state, so ghosts replay it exactly.
    if (maxX > progressX + 8) { progressX = maxX; progressAt = frameNo; }
    else if (!dead && frameNo - progressAt > 60 * 30) carry();
    if (!ghostSim && run.inputs.length < RUN_MAX) { run.m = Math.floor(maxX / TS); if (frameNo % 300 === 0) saveBest(); }
    const region = Math.floor(pl.x / (REGION * CW * TS));
    if (region !== lastRegion) {
      lastRegion = region; title = {id: regionBiome(region), t: chapter ? Math.min(0, chapter.t - 240) : 0};
      journey = {start: frameNo, seeds0: seeds, tumbles: 0, finds0: seen ? seen.size : 0, arrived: journey.arrived};
    }
    if (!ghostSim && !arrival && !dead && pl.ground && journey.arrived !== region) {
      const gx = gateX(region);
      if (pl.x > gx - 7 * TS && pl.x < gx) { arrival = {region, gx, phase: 'walk', t: 0}; plan = null; }
    }
    if (chapter && ++chapter.t > 300) chapter = null;
    if (title && ++title.t > 210) title = null;
    if (!ghostSim) {
      const ci = Math.floor(pl.x / (CW * TS)), span = REGION * CW * TS, wd = regionWonder(region);
      for (const ch of [chunks.get(ci), chunks.get(ci + 1)]) if (ch) for (const ft of ch.features) if (ft.x - pl.x < 170 && ft.x - pl.x > -40) discover(ft.id);
      if (wd && pl.x / span - region > .25) discover(wd);
      if (card && ++card.t > 300) card = null;
    }
    cam = Math.max(cam, pl.x - simW * .38);
    spawnUpTo(cam + simW + 48);
    spit();
    enemies = enemies.filter(updateEnemy);
    for (const e of enemies) {
      if (e.state === 'dead' || e.state === 'squash' || !overlap(pl, e)) continue;
      const stomp = pl.vy > 0 && pl.y + pl.h - e.y < 9;
      if (e.state === 'shell') {
        e.state = 'slide'; e.vx = pl.x + 6 < e.x + 7 ? 3.6 : -3.6; inv = Math.max(inv, 12); sfx('bump');
        if (stomp) pl.vy = -4.4;
      } else if (stomp) {
        if (e.kind === 'snail') { e.state = 'shell'; e.vx = 0; e.h = 12; e.y += 2; }
        else if (e.kind === 'flier') { e.state = 'dead'; e.vy = 0; e.vx = 0; }
        else { e.state = 'squash'; e.t = 0; }
        pl.vy = inp.j ? -6.4 : -4.4; pl.jumping = inp.j; puff(e.x + 7, e.y + 4, '#fff4dc', 6);
        sfx('stomp'); stompTimes = stompTimes.filter(t => frameNo - t < 100); stompTimes.push(frameNo); if (stompTimes.length >= 2) noteMoment('stomp chain');
      } else die();
    }
    for (const ch of chunks.values()) for (const s of ch.seeds)
      if (!s.got && Math.abs(s.x - pl.x - 6) < 11 && Math.abs(s.y - pl.y - 10) < 14) { s.got = true; s.gotAt = frameNo; seeds++; seedStreak = frameNo - lastSeedAt < 50 ? seedStreak + 1 : 0; lastSeedAt = frameNo; sfx('seed', {streak: seedStreak}); sparkle(s.x, s.y); }
    parts = parts.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.g ?? (p.star ? 0 : .08); p.vx *= p.drag ?? .96; return --p.life > 0; });
    for (const b of bumps) b.t++;
    bumps = bumps.filter(b => b.t < 10);
  }
  let bumps = [], stepAt = 0, seedStreak = 0, lastSeedAt = -99, prints = [];
  // Sound lives in assets/pip-audio.js; the simulation only names events.
  // Nothing sounds while a ghost is rebuilt or the planner imagines.
  const BUZZ = {stomp: 12, tumble: 30, spring: 10, grow: 16, arrive: [12, 60, 12], smash: 14};
  const sfx = (name, o) => {
    if (ghostSim) return;
    if (typeof PipAudio !== 'undefined') PipAudio.fx(name, o);
    // A light tap on the hand for a person playing by touch, where supported.
    const ms = name === 'land' ? (o && o.impact > 4 ? 6 : 0) : BUZZ[name];
    if (ms && human && usingTouch && typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {}
  };
  function surface() {
    if (pl.on) return biomeAt(pl.x) === 'sky' ? 'cloud' : 'wood';
    const id = tileAt(Math.floor((pl.x + 6) / TS), Math.floor((pl.y + pl.h + 1) / TS));
    if (id === EARTH) return {meadow: 'grass', frost: 'snow', sky: 'cloud', caves: 'moss'}[biomeAt(pl.x)];
    const pillar = (id === PIPE_L || id === PIPE_R) && biomeAt(pl.x) === 'caves';   // columns are stumps, or stone pillars in the caves
    return id === CRUMBLE && biomeAt(pl.x) === 'caves' ? 'crystal' : id === STONE || pillar ? 'stone' : 'wood';
  }
  // Crumble planks start to go once Pip stands on them, fall half a second
  // later and grow back after a while (or at once when Pip respawns).
  function crumbleTick() {
    if (pl.ground && !pl.on) {
      const ty = Math.floor((pl.y + pl.h + 1) / TS);
      for (let tx = Math.floor(pl.x / TS); tx <= Math.floor((pl.x + pl.w - EPS) / TS); tx++)
        if (tileAt(tx, ty) === CRUMBLE && !crumbleFall.has(tx * 64 + ty)) crumbleFall.set(tx * 64 + ty, frameNo + 30);
    }
    for (const [k, at] of crumbleFall) if (frameNo >= at) {
      const tx = Math.floor(k / 64), ty = k - tx * 64;
      if (Math.abs(tx * TS - pl.x) < 320) sfx('crumble');
      crumbleFall.delete(k); setTile(tx, ty, EMPTY); regrow.push({tx, ty, at: frameNo + 480});
      for (let q = 0; q < 3; q++) parts.push({x: tx * TS + 3 + q * 5, y: ty * TS + 6, vx: (q - 1) * .4, vy: .4 + q * .3, life: 40, col: crumbleCol(tx), r: 2.2, debris: true});
    }
    regrow = regrow.filter(g => frameNo < g.at || !regrowOne(g));
  }
  function regrowOne(g) {
    if (overlap({x: g.tx * TS, y: g.ty * TS, w: TS, h: TS}, pl)) return false;
    setTile(g.tx, g.ty, CRUMBLE); return true;
  }
  function regrowAll() { regrow = regrow.filter(g => !regrowOne(g)); crumbleFall.clear(); }
  const crumbleCol = tx => ({meadow: '#b98a58', frost: '#cfe9fb', sky: '#ffffff', caves: '#b18cf2'})[biomeAt(tx * TS)];
  // Podspitters fire along the ground while Pip approaches from the left.
  function spit() {
    for (const ch of chunks.values()) for (const p of ch.plants) {
      const px = p.tx * TS;
      if ((frameNo + p.ph) % 160 === 0 && px > pl.x + 110 && px - pl.x < 300) {
        enemies.push({kind: 'pod', x: px - 10, y: p.ty * TS + 3, baseY: 0, w: 10, h: 10, vx: -1.05, vy: 0, ground: false, state: 'walk', t: 0, period: 99});
        p.fired = frameNo; sfx('spit'); puff(px - 2, p.ty * TS + 8, '#e8d6a0', 3);
      }
    }
  }
  // Highlights come from the planner (a close call) or play (a stomp chain).
  // Replays re-render recorded frames, so they look exactly like the live run.
  function noteMoment(kind) {
    if (human || replay || moment || frameNo - lastReplay < 1800) return;
    moment = {kind, at: frameNo};
  }
  function record() {
    history.push({frameNo, pl: {...pl}, facing, anim, landedAt, dead, inv, cam, sq, skidding, big, growing, items: items.map(q => ({...q})), enemies: enemies.map(e => ({...e})),
      parts: parts.map(q => ({...q})), bumps: bumps.map(q => ({...q})), arcs: plan && plan.arcs, at: plan && plan.at});
    if (history.length > 360) history.shift();
    if (moment && !human && frameNo - moment.at > 50 && pl.ground && !dead) {
      const frames = history.filter(h => h.frameNo >= moment.at - 80 && h.frameNo <= moment.at + 36);
      if (frames.length > 40) { replay = {frames, i: 0, kind: moment.kind}; lastReplay = frameNo; }
      moment = null;
    }
  }

  /* ---------------- ghosts ----------------
     A run is its seed, the simulation width and one 3-bit input per tick, plus
     the director's placements. The engine is deterministic, so that log
     rebuilds the run exactly: it travels in a link and races as a ghost. */
  const RUN_MAX = 60 * 180;   // the first three minutes of a run are kept
  function logEvent(e) { if (!ghostSim && run.inputs.length < RUN_MAX) run.events.push(e); }
  function replayEvents() {
    const evs = ghostSim.events;
    while (ghostSim.ev < evs.length && evs[ghostSim.ev].f <= frameNo) {
      const e = evs[ghostSim.ev++];
      if (e.k === 'w') simW = e.w; else applyPlacement({b: 'brick', c: 'creature', s: 'spring'}[e.k], e.x, e.y);
    }
  }
  function buildGhost(r, label) {
    ghostSim = {events: r.events, ev: 0};
    reset(r.seed); simW = r.w;
    const frames = []; let i = 0;
    const src = () => { const c = r.inputs[i++]; return {l: !!(c & 1), r: !!(c & 2), j: !!(c & 4)}; };
    try {
      while (i < r.inputs.length && frames.length < RUN_MAX + 600) {
        tick(src);
        frames.push({x: pl.x, y: pl.y, h: pl.h, w: pl.w, vx: pl.vx, vy: pl.vy, ground: pl.ground, facing, anim, landedAt, dead, inv, sq, skidding, big, growing, m: Math.floor(maxX / TS)});
      }
    } finally { ghostSim = null; }
    return {frames, label, m: frames.length ? frames[frames.length - 1].m : 0, seed: r.seed};
  }
  const ghostAt = f => ghost && ghost.frames[Math.min(f, ghost.frames.length) - 1];
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  // Inputs are run-length coded: 3 bits of buttons and 5 bits of repeat count
  // per byte, written six bits to a character.
  function encodeRun(r) {
    const bytes = [];
    for (let i = 0; i < r.inputs.length;) { const c = r.inputs[i]; let n = 1; while (n < 32 && r.inputs[i + n] === c) n++; bytes.push(c | (n - 1) << 3); i += n; }
    let bits = '', out = '';
    for (const b of bytes) bits += b.toString(2).padStart(8, '0');
    for (let i = 0; i < bits.length; i += 6) out += B64[parseInt(bits.slice(i, i + 6).padEnd(6, '0'), 2)];
    const ev = r.events.map(e => e.k === 'w' ? `w${e.f.toString(36)}-${e.w.toString(36)}` : `${e.k}${e.f.toString(36)}-${e.x.toString(36)}-${e.y.toString(36)}`).join('_');
    return ['1', (r.seed >>> 0).toString(36), r.w.toString(36), bytes.length.toString(36), out].join('.') + (ev ? '.' + ev : '');
  }
  function decodeRun(code) {
    const [v, sd, w, nb, data = '', ev = ''] = String(code).split('.');
    if (v !== '1' || !w || !nb || !/^[0-9a-z]+$/.test(sd + w + nb) || /[^A-Za-z0-9_-]/.test(data)) return null;
    let bits = ''; for (const ch of data) bits += B64.indexOf(ch).toString(2).padStart(6, '0');
    const inputs = [];
    for (let i = 0, n = parseInt(nb, 36); i < n; i++) { const b = parseInt(bits.slice(i * 8, i * 8 + 8), 2); if (!(b >= 0)) return null; for (let k = 0; k <= b >> 3; k++) inputs.push(b & 7); }
    const events = [];
    for (const t of ev ? ev.split('_') : []) {
      const k = t[0], a = t.slice(1).split('-').map(q => parseInt(q, 36));
      if (a.some(q => !Number.isFinite(q))) return null;
      if (k === 'w' && a.length === 2) events.push({f: a[0], k, w: a[1]});
      else if ('bcs'.includes(k) && a.length === 3) events.push({f: a[0], k, x: a[1], y: a[2]});
      else return null;
    }
    const r = {seed: parseInt(sd, 36), w: parseInt(w, 36), inputs, events};
    return inputs.length && r.w >= 100 && r.w <= 4000 ? r : null;
  }

  // The default world is the day's (UTC), so everyone gets the same one; a
  // person's best run of the day is kept on this device and raced as a ghost.
  let worldMode = 'daily', day = '', toast = null;
  const today = () => new Date().toISOString().slice(0, 10);
  const dailySeed = d => hash(+d.replace(/-/g, ''), 0xda1) % 1e9;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };
  let bestToday = 0;
  function saveBest() {
    if (ghostSim || !run || worldMode !== 'daily' || seed !== dailySeed(day) || run.human < 300) return;
    const b = store.get('pip-run:best');
    if (!b || b.day !== day || run.m > b.m) { store.set('pip-run:best', {day, m: run.m, code: encodeRun(run)}); bestToday = run.m; }
  }
  function bestGhost() {
    const b = store.get('pip-run:best'), r = b && b.day === day && decodeRun(b.code);
    return r && r.seed === dailySeed(day) ? buildGhost(r, 'best') : null;
  }
  function start() {
    const h = (location.hash || '').slice(1), shared = h.startsWith('r=') ? decodeRun(h.slice(2)) : null;
    day = today(); ghost = null; toast = null;
    { const b = store.get('pip-run:best'); bestToday = b && b.day === day ? b.m : 0; }
    if (shared) { worldMode = 'friend'; ghost = buildGhost(shared, 'friend'); reset(shared.seed); }
    else if (h.startsWith('new')) { worldMode = 'random'; reset((Math.random() * 1e9) | 0); }
    else { worldMode = 'daily'; ghost = bestGhost(); reset(dailySeed(day)); }
    render();
  }
  function restart() {
    const sd = seed;
    if (worldMode === 'daily') { saveBest(); ghost = bestGhost(); }
    reset(sd); toast = {text: ghost ? 'Go! Race the ghost' : 'Same world, fresh start', until: performance.now() + 2500};
  }
  // The link opens the same world with this run as the ghost.
  function shareRun() {
    if (run.inputs.length < 120) { toast = {text: 'Run a little first, then share', until: performance.now() + 2500}; return; }
    const code = encodeRun(run), text = `Race my Pip Run: ${run.m} m`;
    let url = '';
    try { if (parent !== window && parent.location.origin === location.origin) { parent.history.replaceState(null, '', '#pip-run-' + code); url = parent.location.href; } } catch (_) {}
    if (!url) { history.replaceState(null, '', '#r=' + code); url = location.href; }
    const done = t => { toast = {text: t, until: performance.now() + 3200}; };
    if (navigator.share && (usingTouch || matchMedia('(pointer:coarse)').matches)) navigator.share({title: 'Pip Run', text, url}).then(() => done('Shared — they race your ghost'), () => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => done('Link copied — friends race your ghost'), () => done('Link is in the address bar'));
    else done('Link is in the address bar');
  }

  // The Golden Sprout rises from its block, then slides along and bounces off walls.
  function updateItem(it) {
    it.t++;
    if (it.rise > 0) { it.y -= 1; it.rise--; if (!it.rise) it.vx = 1.3; return true; }
    const v = it.vx; if (moveX(it) && v) it.vx = -v;
    it.vy = Math.min(6, it.vy + .3); moveY(it);
    if (overlap(it, pl) && !dead) { grow(); return false; }
    return it.y < VIEW_H + 20 && it.x > cam - 40;
  }
  let stats = {bumps: 0, sprouts: 0};
  function bump(tx, ty) {
    const id = tileAt(tx, ty);
    if (id === BRICK && big) sfx('smash');
    else { sfx('bump'); if (id === BLOCK) sfx(hash(seed ^ 0x5b0, tx * 31 + ty) % 3 === 0 ? 'sprout' : 'seed', {streak: 2}); }
    if (id === BLOCK) stats.bumps++;
    if (id === BLOCK && hash(seed ^ 0x5b0, tx * 31 + ty) % 3 === 0) { setTile(tx, ty, USED); usedAt.set(tx + ',' + ty, frameNo); items.push({x: tx * TS + 2, y: ty * TS, w: 12, h: 12, vx: 0, vy: 0, rise: 14, ground: false, t: 0}); stats.sprouts++; bumps.push({tx, ty, t: 0}); return; }
    if (id === BRICK && big) { setTile(tx, ty, EMPTY); for (let k = 0; k < 4; k++) parts.push({x: tx * TS + 4 + (k % 2) * 8, y: ty * TS + 4 + (k >> 1) * 8, vx: (k % 2 ? 1.6 : -1.6), vy: -3.2 - (k >> 1), life: 40, col: '#c9693f', r: 2.4, debris: true}); return; }
    if (id === BLOCK) { setTile(tx, ty, USED); usedAt.set(tx + ',' + ty, frameNo); seeds++; parts.push({x: tx * TS + 8, y: ty * TS - 4, vx: 0, vy: -3, life: 26, col: '#ffe08a', r: 3, star: true, seed: true}); sparkle(tx * TS + 8, ty * TS - 8); }
    if (id === BLOCK || id === BRICK || id === USED) bumps.push({tx, ty, t: 0});
    if (id === BRICK) puff(tx * TS + 8, ty * TS, '#e9b28a', 4, -1);
    // Creatures standing on a bumped block are knocked off, as on any good stage.
    for (const e of enemies) if (e.state === 'walk' && e.ground && Math.abs(e.x + 7 - (tx * TS + 8)) < 14 && Math.abs(e.y + e.h - ty * TS) < 3) { e.state = 'dead'; e.vy = -4; e.vx = 0; }
  }

  /* ---------------- rendering ---------------- */
  const sheet = new Image(), backdrop = new Image();
  sheet.src = 'assets/pip-full-run-22.webp'; backdrop.src = 'assets/mushroom-cinematic-kingdom.webp';
  // Painted Pip: 16 run frames, then take-off, rise, apex, reach, landing, crouch.
  const FRAME_W = 244, FRAME_H = 305;
  // While growing or shrinking, the displayed size flickers between the two.
  const shownBig = () => growing && Math.floor(growing / 4) % 2 ? !big : big;
  const pipVisual = () => (shownBig() ? 40 : 30);
  let dpr = 1, S = 1, viewW = 400, ox = 0, oy = 0, tileCache = new Map();
  // Portrait (phones): the stage sits right under the host page's bar with
  // larger tiles, and a console below holds the journey strip, the tools,
  // the buttons and, once someone plays, the thumb pad.
  const CONSOLE = 210, EMBEDDED = (() => { try { return window.parent !== window; } catch (_) { return true; } })();
  let portrait = false, consoleY = 0;
  function layout() {
    const W = cv.clientWidth, H = cv.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    portrait = H > W;
    // At least 16 tiles across in landscape; in portrait 12 or more, as tall
    // as the console allows (tall phones get the largest tiles).
    const top = portrait ? (EMBEDDED ? 60 : 10) : 0;
    const k = portrait ? Math.max(.5, Math.min((H - top - CONSOLE) / VIEW_H, W / (12 * TS))) : Math.min(H / VIEW_H, W / (16 * TS));
    const tsd = Math.max(8, Math.round(TS * k * dpr));
    S = tsd / TS; viewW = cv.width / S;
    const bandH = VIEW_H * S;
    oy = portrait ? Math.round(top * dpr) : Math.round((cv.height - bandH) / 2); ox = 0;
    consoleY = (oy + bandH) / dpr;
    tileCache = new Map(); farCache = null; propCache.clear(); cloudCache.clear(); mtnCache = {}; lightCache = {}; foreCache.clear(); spriteCache.clear();
  }
  function tileCanvas(id, top, biome = 'meadow', v = 0) {
    const key = id + ':' + (top ? 1 : 0) + (id === BRICK ? ':' + biome + v : id === CRUMBLE ? ':' + biome : '');
    if (tileCache.has(key)) return tileCache.get(key);
    const n = Math.round(TS * S), c2 = document.createElement('canvas'); c2.width = c2.height = n;
    const g = c2.getContext('2d'); g.scale(n / TS, n / TS);
    const rr = (x, y, w, h, r, col) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = col; g.fill(); };
    const grad = (a, b) => { const q = g.createLinearGradient(0, 0, 0, 16); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
    const specks = (col, pts) => { g.fillStyle = col; for (const [x, y, r] of pts) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } };
    if (id === CRUMBLE) {                        // a bridge that will not hold for long
      if (biome === 'sky') {
        g.fillStyle = '#ffffff'; for (const [x, y, r] of [[3, 5, 4], [8, 3.5, 4.6], [13, 5, 4]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.fillRect(0, 4, 16, 4); g.fillStyle = 'rgba(170,185,225,.55)'; g.fillRect(0, 7.5, 16, 1.5);
      } else {
        const [a, b2, line] = {meadow: ['#c99a62', '#9b6a3c', '#6d4526'], frost: ['#e9f7ff', '#a9d8f2', '#7fb6d9'], caves: ['#c9a8ff', '#7b52c8', '#4b2f86']}[biome];
        rr(0, 0, 16, 7, 1.4, line); rr(.6, .6, 14.8, 5.6, 1.1, grad(a, b2));
        g.strokeStyle = line; g.lineWidth = .7; g.beginPath(); g.moveTo(5.5, 1); g.lineTo(4.5, 3.4); g.lineTo(6, 6); g.moveTo(11, 1); g.lineTo(12, 4); g.stroke();
        if (biome === 'meadow') { g.fillStyle = '#6d4526'; for (const x of [2, 14]) { g.beginPath(); g.arc(x, 3.4, .7, 0, 7); g.fill(); } g.strokeStyle = 'rgba(109,69,38,.6)'; g.beginPath(); g.moveTo(0, 7); g.quadraticCurveTo(8, 11, 16, 7); g.stroke(); }
        else { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(2, 1.4, 5, .9); }
      }
      tileCache.set(key, c2); return c2;
    }
    if (id === BRIDGE) {                         // a helping bridge: planks on vines
      rr(0, 1, 16, 6, 1.2, '#7a5230'); rr(.6, 1.6, 14.8, 4.8, 1, grad('#d9a66a', '#a8743f'));
      g.strokeStyle = '#4f9a45'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, 1.4); g.quadraticCurveTo(8, 3.4, 16, 1.4); g.stroke();
      g.fillStyle = '#6fbf4f'; for (const x of [3, 11]) { g.beginPath(); g.ellipse(x, 1.2, 2, 1, -.4, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(79,154,69,.7)'; g.beginPath(); g.moveTo(2, 7); g.quadraticCurveTo(4, 11, 2, 14); g.moveTo(13, 7); g.quadraticCurveTo(11, 10, 13, 12); g.stroke();
      tileCache.set(key, c2); return c2;
    }
    if (id === SPITTER) {                        // Podspitter: a bulb that spits seed pods to the left
      g.fillStyle = '#3f8d4a'; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(8 + sd * 5, 14.4, 4.6, 1.8, sd * .3, 0, 7); g.fill(); }
      const q = g.createRadialGradient(9, 6, 1, 8, 8, 8); q.addColorStop(0, '#d7f58a'); q.addColorStop(1, '#5aa83c');
      g.fillStyle = q; g.beginPath(); g.ellipse(8.5, 8.5, 6.6, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#2f5f2a'; g.beginPath(); g.ellipse(2.8, 8.5, 2.6, 2.2, 0, 0, 7); g.fill();
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(8, 6, 1.6, 0, 7); g.fill(); g.fillStyle = '#2b2018'; g.beginPath(); g.arc(7.5, 6.2, .8, 0, 7); g.fill();
      g.fillStyle = '#e8484f'; g.beginPath(); g.ellipse(9.5, 2.2, 2, 1.3, .4, 0, 7); g.fill();
      tileCache.set(key, c2); return c2;
    }
    // Bricks: terracotta, ice, sandstone or amethyst; each tile one of three variants.
    if (id === BRICK) {
      if (biome === 'frost') {                   // a block of clear ice
        rr(0, 0, 16, 16, 2, '#4b8fbf');
        const q = g.createLinearGradient(0, 0, 16, 16); q.addColorStop(0, '#effbff'); q.addColorStop(.45, '#a9dcf5'); q.addColorStop(1, '#5eaedc');
        rr(.8, .8, 14.4, 14.4, 1.6, q);
        g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(1.5, 1.5); g.lineTo(14.5, 1.5); g.lineTo(11, 5); g.lineTo(5, 5); g.lineTo(1.5, 9); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .9; g.beginPath(); g.moveTo(3.5, 11.5 - v); g.lineTo(8.5, 4.5 - v * .5); g.moveTo(7.5, 13.5); g.lineTo(12.5, 6.5 + v * .5); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.7)'; for (const [x, y, r] of [[11, 11, .6], [12.5, 9.5, .4], [4 + v * 2, 6, .45]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .5; g.strokeRect(1.3, 1.3, 13.4, 13.4);
      } else if (biome === 'caves') {            // a cut amethyst
        rr(0, 0, 16, 16, 2, '#24154a');
        const facet = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.fill(); };
        facet([[.8, .8], [15.2, .8], [12, 4], [4, 4]], '#d9c2ff'); facet([[15.2, .8], [15.2, 15.2], [12, 12], [12, 4]], '#5b38a8');
        facet([[15.2, 15.2], [.8, 15.2], [4, 12], [12, 12]], '#3d2380'); facet([[.8, 15.2], [.8, .8], [4, 4], [4, 12]], '#a27cf0');
        const q = g.createLinearGradient(4, 4, 12, 12); q.addColorStop(0, '#b994ff'); q.addColorStop(1, '#6a45c0'); g.fillStyle = q; g.fillRect(4, 4, 8, 8);
        g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(5, 5); g.lineTo(8, 5); g.lineTo(5, 8); g.fill();
      } else {
        const pal = biome === 'sky' ? ['#a06a2a', '#fbe0a2', '#d9a24f'] : ['#7a3c22', '#ec9562', '#b5552d'];
        rr(0, 0, 16, 16, 1.6, pal[0]);
        let k = 0;
        for (const [y, list] of [[0, [[0, 7.5], [8.5, 7.5]]], [8.5, [[0, 3.5], [4.5, 7], [12.5, 3.5]]]]) for (const [x, w] of list) {
          const j = ((v * 7 + k++ * 3) % 5 - 2) * .045;
          g.fillStyle = grad(pal[1], pal[2]); g.beginPath(); g.roundRect(x + .45, y + .45, w - .45, 6.7, .9); g.fill();
          if (j) { g.fillStyle = j > 0 ? `rgba(255,244,226,${j})` : `rgba(50,14,0,${-j})`; g.fill(); }
          g.fillStyle = 'rgba(255,240,215,.5)'; g.fillRect(x + 1.1, y + .85, w - 2, .6);
          g.fillStyle = 'rgba(70,24,8,.28)'; g.fillRect(x + 1.1, y + 6.15, w - 2, .55);
          g.fillStyle = 'rgba(90,34,12,.3)'; for (let p = 0; p < 2; p++) { g.beginPath(); g.arc(x + 1.5 + ((v * 5 + k * 7 + p * 11) % 10) / 10 * (w - 3), y + 2.3 + (v + p * 2 + k) % 3 * 1.1, .35, 0, 7); g.fill(); }
        }
        if (v === 2) { g.fillStyle = pal[0]; g.beginPath(); g.moveTo(16, 8.5); g.lineTo(13.2, 8.5); g.lineTo(16, 11.4); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, 16, 1); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 15.2, 16, .8);
      }
      tileCache.set(key, c2); return c2;
    }
    if (id === EARTH) {
      const soil = g.createLinearGradient(0, 0, 0, 16); soil.addColorStop(0, '#a8714a'); soil.addColorStop(1, '#8a5a3b');
      g.fillStyle = soil; g.fillRect(0, 0, 16, 16);
      g.fillStyle = 'rgba(70,40,24,.3)'; for (const [x, y, r] of top ? [[3, 11, 1.1], [12, 13, 1.3]] : [[3, 10, 1.2], [11, 4, 1], [8, 13, 1.4], [14, 9, .9]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,226,180,.12)'; for (const [x, y] of top ? [[9, 9]] : [[6, 6], [13, 14]]) { g.beginPath(); g.arc(x, y, .8, 0, 7); g.fill(); }
      if (top) {
        const gr = g.createLinearGradient(0, 0, 0, 6); gr.addColorStop(0, '#9be06a'); gr.addColorStop(1, '#5aa846');
        g.fillStyle = gr; g.fillRect(0, 0, 16, 5);
        g.beginPath(); for (let x = 0; x <= 16; x += 4) { g.moveTo(x, 4.5); g.quadraticCurveTo(x + 2, 8, x + 4, 4.5); } g.fill();
        g.fillStyle = '#c8f39a'; g.fillRect(0, 0, 16, 1.2);
      }
    } else if (id === USED) {                    // a spent block: dull bronze, the star worn away
      rr(0, 0, 16, 16, 2.2, '#5a4130'); rr(.8, .8, 14.4, 14.4, 1.8, grad('#b8946f', '#86644a'));
      g.fillStyle = 'rgba(70,46,30,.35)'; g.beginPath(); g.roundRect(3, 3, 10, 10, 1.2); g.fill();
      g.fillStyle = 'rgba(255,236,206,.35)'; g.fillRect(1.6, 1.3, 12.8, .8); g.fillStyle = 'rgba(40,24,14,.3)'; g.fillRect(1.6, 14, 12.8, .7);
      for (const [x, y] of [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]]) { g.fillStyle = '#5a4130'; g.beginPath(); g.arc(x, y, .9, 0, 7); g.fill(); g.fillStyle = 'rgba(255,230,190,.5)'; g.beginPath(); g.arc(x - .25, y - .25, .35, 0, 7); g.fill(); }
    } else if (id === BLOCK) {                   // a star block: gold, bevelled, the star raised
      rr(0, 0, 16, 16, 2.6, '#874811');
      const gd = g.createLinearGradient(0, 0, 16, 16); gd.addColorStop(0, '#ffe896'); gd.addColorStop(.5, '#f8b73a'); gd.addColorStop(1, '#d9821c');
      rr(.8, .8, 14.4, 14.4, 2.1, gd);
      g.fillStyle = 'rgba(255,252,220,.5)'; g.beginPath(); g.moveTo(1.4, 1.4); g.lineTo(14.6, 1.4); g.lineTo(12.6, 3.2); g.lineTo(3.2, 3.2); g.lineTo(3.2, 12.6); g.lineTo(1.4, 14.6); g.fill();
      g.fillStyle = 'rgba(150,70,8,.32)'; g.beginPath(); g.moveTo(14.6, 1.4); g.lineTo(14.6, 14.6); g.lineTo(1.4, 14.6); g.lineTo(3.2, 12.6); g.lineTo(12.6, 12.6); g.lineTo(12.6, 3.2); g.fill();
      const face = g.createRadialGradient(6.5, 6, 0, 8, 8, 8); face.addColorStop(0, '#ffd970'); face.addColorStop(1, '#eea12c'); g.fillStyle = face; g.fillRect(3.2, 3.2, 9.4, 9.4);
      const starPath = (dx, dy, k) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 2.2 : 4.9) * k; g.lineTo(7.9 + dx + Math.cos(a) * r, 8.2 + dy + Math.sin(a) * r); } g.closePath(); };
      starPath(.5, .6, 1); g.fillStyle = 'rgba(130,56,0,.45)'; g.fill();
      const sg = g.createRadialGradient(7, 6.8, 0, 7.9, 8.2, 5); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#ffe39a'); starPath(0, 0, 1); g.fillStyle = sg; g.fill();
      starPath(-.3, -.4, .45); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
      for (const [x, y] of [[2.4, 2.4], [13.6, 2.4], [2.4, 13.6], [13.6, 13.6]]) { g.fillStyle = '#8a4a12'; g.beginPath(); g.arc(x, y, .8, 0, 7); g.fill(); g.fillStyle = 'rgba(255,240,200,.75)'; g.beginPath(); g.arc(x - .2, y - .2, .3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(5, 3.6, 3.4, 1.2, -.35, 0, 7); g.fill();
    } else if (id === SPRING) {                  // a coiled spring with a glossy pad
      const base = g.createLinearGradient(0, 13, 0, 16); base.addColorStop(0, '#5b6d82'); base.addColorStop(1, '#2c3846'); g.fillStyle = base; g.beginPath(); g.roundRect(1.5, 12.8, 13, 3.2, 1); g.fill();
      for (let k = 0; k < 4; k++) {
        const y0 = 12.4 - k * 2.4, y1 = 11.2 - k * 2.4;
        g.strokeStyle = '#7d8896'; g.lineWidth = 1.9; g.beginPath(); g.moveTo(3, y0); g.lineTo(13, y1); g.stroke();
        g.strokeStyle = '#e6ecf3'; g.lineWidth = .7; g.beginPath(); g.moveTo(3.4, y0 - .45); g.lineTo(12.6, y1 - .45); g.stroke();
      }
      const pad = g.createLinearGradient(0, 2, 0, 6); pad.addColorStop(0, '#ff7d6e'); pad.addColorStop(1, '#c8322d'); g.fillStyle = pad; g.beginPath(); g.roundRect(1, 2, 14, 4.2, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(6, 3, 4, .7, 0, 0, 7); g.fill();
    }
    tileCache.set(key, c2); return c2;
  }
  /* ---------------- painted terrain ----------------
     Ground, stone and stumps never change in play, so each chunk's are painted
     once into one canvas: soil that darkens with depth, strata, pebbles and
     roots, a grass (snow, cloud, moss) cap that rounds over its edges, lit and
     shaded faces, and painted trees and rocks standing behind. Only the look
     changes: collision still reads the tile grid. Tiles that change in play
     (blocks, bricks, springs...) are drawn one by one on top. */
  const propsImg = new Image(), mtnImg = new Image();
  propsImg.src = 'assets/road-painted-props.webp'; mtnImg.src = 'assets/road-painted-mountains.webp';
  // Each painted prop's place on its sheet, and its height in world pixels.
  const PROP = {pine: [80, 12, 520, 672, 104], oak: [608, 32, 640, 640, 92], rock: [16, 784, 608, 448, 30], cottage: [676, 704, 568, 532, 62]};
  const PROPS_IN = {meadow: ['oak', 'rock', 'oak', 'pine', 'oak'], frost: ['pine', 'pine', 'rock', 'pine'], sky: ['oak']};
  const PAINT = {
    meadow: {soil: ['#a97046', '#80502f', '#4c2d1a'], strata: ['rgba(255,214,160,.10)', 'rgba(64,32,14,.17)'], grain: .2, pebble: ['#cdb796', '#957f66', 'rgba(50,28,14,.45)'],
      lit: 'rgba(255,226,170,.34)', shade: 'rgba(36,18,8,.5)', ao: 'rgba(42,22,8,.55)', cap: ['#dcf890', '#9ad85c', '#5fab40', '#3a7a2b'], depth: 6,
      blade: ['#468c33', '#64b247', '#8bd058', '#bcea80'], stone: ['#ddd5c4', '#b3a993', '#7a705f', '#5c5446'], haze: 'rgba(222,236,232,.26)'},
    frost: {soil: ['#cbd9ec', '#93abc8', '#5c7498'], strata: ['rgba(255,255,255,.17)', 'rgba(40,60,98,.15)'], grain: .08, pebble: ['#dde7f2', '#9fb1c9', 'rgba(40,58,92,.35)'],
      lit: 'rgba(255,255,255,.4)', shade: 'rgba(30,48,88,.38)', ao: 'rgba(58,88,140,.38)', cap: ['#ffffff', '#f6faff', '#dce9f7', '#a9c3e2'], depth: 5.5,
      stone: ['#f4f9fd', '#cbdaea', '#93aac5', '#6d84a3'], haze: 'rgba(206,224,246,.42)'},
    sky: {soil: ['#e9e2f8', '#c6bae7', '#9a8bcb'], strata: ['rgba(255,236,190,.18)', 'rgba(90,70,150,.13)'], grain: .07, pebble: ['#f4ecf9', '#cbbde8', 'rgba(80,64,140,.28)'],
      lit: 'rgba(255,248,226,.45)', shade: 'rgba(70,55,130,.32)', ao: 'rgba(110,95,170,.38)', cap: ['#ffffff', '#fdfcff', '#e9e4f9', '#c4bce8'], depth: 6,
      stone: ['#fbf8ff', '#ddd3f1', '#ab9dd8', '#8577b8'], haze: 'rgba(240,236,255,.26)'},
    caves: {soil: ['#463e60', '#2f2944', '#1b172a'], strata: ['rgba(160,130,240,.10)', 'rgba(8,6,16,.28)'], grain: .22, pebble: ['#7a70a0', '#4a4266', 'rgba(6,4,14,.6)'],
      lit: 'rgba(170,150,255,.2)', shade: 'rgba(5,4,12,.55)', ao: 'rgba(5,4,12,.5)', cap: ['#9af8e2', '#3cc4a6', '#1f8a74', '#145a4d'], depth: 3.6,
      blade: ['#1f8a74', '#2fb79c', '#5fe3c4', '#a5fbe8'], stone: ['#6a6088', '#4a4266', '#2c263f', '#1c1829']}
  };
  let grain = null;
  const propCache = new Map();
  function grainTile(n) {                       // speckle that keeps the soil from looking flat
    if (grain && grain.n === n) return grain.c;
    const k = n / TS, c2 = document.createElement('canvas'); c2.width = c2.height = Math.max(8, Math.round(64 * k));
    const g = c2.getContext('2d'), r = rng(0x5eed);
    for (let i = 0; i < 320; i++) { g.fillStyle = i % 2 ? 'rgba(255,240,220,.9)' : 'rgba(0,0,0,.9)'; g.beginPath(); g.arc(r() * c2.width, r() * c2.height, (.3 + r() * .6) * k, 0, 7); g.fill(); }
    grain = {n, c: c2}; return c2;
  }
  // A painted prop, sized for the screen once and graded into its biome.
  function propSprite(kind, biome, k) {
    const key = kind + biome + k; if (propCache.has(key)) return propCache.get(key);
    const [sx, sy, sw, sh, H] = PROP[kind], w = Math.max(1, Math.round(H * sw / sh * k)), h = Math.max(1, Math.round(H * k)), c2 = document.createElement('canvas');
    c2.width = w; c2.height = h;
    const g = c2.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(propsImg, sx, sy, sw, sh, 0, 0, w, h);
    g.globalCompositeOperation = 'source-atop';
    if (biome === 'frost') { const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, 'rgba(255,255,255,.55)'); q.addColorStop(.7, 'rgba(255,255,255,.12)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h); }
    g.fillStyle = PAINT[biome].haze; g.fillRect(0, 0, w, h);
    propCache.set(key, c2); return c2;
  }
  // Trees and rocks stand on wide flat ground, clear of block rows and of the plaza.
  function chunkProps(ch, at) {
    const out = [], kinds = PROPS_IN[ch.biome]; if (!kinds) return out;
    const end = ch.ci % REGION === REGION - 1 ? CW - PLAZA - 3 : CW - 3;
    const surf = x => { for (let y = 0; y < ROWS; y++) { const v = at(x, y); if (v !== EMPTY) return v === EARTH ? y : -1; } return -1; };
    for (let x = 2 + hash(seed ^ 0x9a0, ch.ci) % 4; x <= end;) {
      const s = surf(x), hv = hash(seed ^ 0x9a1, ch.ci * CW + x);
      if (s >= 7 && surf(x - 1) === s && surf(x + 1) === s && hv % 4) {
        const kind = ch.biome === 'meadow' && (hv >>> 11) % 11 === 0 && !out.some(p => p.kind === 'cottage') ? 'cottage' : kinds[(hv >>> 3) % kinds.length];
        out.push({x, s, kind, hv}); x += 9 + (hv >>> 7) % 7;
      }
      else x++;
    }
    return out;
  }
  function paintChunk(ch, n) {
    const k = n / TS, M = 1, bio = ch.biome, P = PAINT[bio], wx0 = ch.ci * CW * TS, L = chunks.get(ch.ci - 1), R = chunks.get(ch.ci + 1);
    // Tiles around this chunk: the rock goes on above a cave roof and below the band.
    const at = (x, y) => {
      if (y < 0) return bio === 'caves' && ch.t[clamp(0, x, CW - 1)] === CEIL ? CEIL : EMPTY;
      if (y >= ROWS) return at(x, ROWS - 1) === EARTH ? EARTH : EMPTY;
      if (x < 0) return L ? L.t[y * CW + x + CW] : ch.t[y * CW];
      if (x >= CW) return R ? R.t[y * CW + x - CW] : ch.t[y * CW + CW - 1];
      return ch.t[y * CW + x];
    };
    const mass = (x, y) => { const v = at(x, y); return v === EARTH || v === CEIL; };
    const hv = (x, y, salt) => hash(seed ^ salt, (ch.ci * CW + x) * 16 + y);
    // The canvas starts a row above the highest ground (or the tallest tree), so
    // the empty sky above costs nothing to draw.
    const props = propsImg.complete && propsImg.naturalWidth ? (ch.props = ch.props || chunkProps(ch, at)) : [];
    let y0 = ROWS; for (let y = 0; y < ROWS && y0 === ROWS; y++) for (let x = 0; x < CW; x++) if (STATIC.has(at(x, y))) { y0 = y; break; }
    y0 = Math.max(0, y0 - 1); for (const p of props) y0 = Math.max(0, Math.min(y0, Math.floor((p.s * TS + 3 - PROP[p.kind][4]) / TS)));
    const c2 = document.createElement('canvas'); c2.width = (CW + 2 * M) * n; c2.height = Math.max(1, ROWS - y0) * n;
    const g = c2.getContext('2d'), lin = (x0, y0, x1, y1, a, b) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
    g.setTransform(k, 0, 0, k, M * n, -y0 * n); g.lineCap = 'round'; g.lineJoin = 'round';
    // 1. The ground mass, rounded where two faces are open.
    g.fillStyle = '#000';
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < CW; x++) if (mass(x, y)) {
      const up = !mass(x, y - 1), dn = !mass(x, y + 1), lf = !mass(x - 1, y), rt = !mass(x + 1, y), r = 3.5;
      g.beginPath(); g.roundRect(x * TS, y * TS, TS, TS, [up && lf ? r : 0, up && rt ? r : 0, dn && rt ? r : 0, dn && lf ? r : 0]); g.fill();
    }
    // 2. Inside it: soil darkening with depth, strata and speckle (all in world
    //    coordinates, so neighbouring chunks meet without a seam).
    g.globalCompositeOperation = 'source-atop';
    const dg = g.createLinearGradient(0, 3 * TS, 0, ROWS * TS); dg.addColorStop(0, P.soil[0]); dg.addColorStop(.45, P.soil[1]); dg.addColorStop(1, P.soil[2]);
    g.fillStyle = dg; g.fillRect(-TS, 0, (CW + 2) * TS, ROWS * TS);
    for (let i = 0; i < 10; i++) {
      const yb = 2 * TS + i * 21 + hash(seed ^ 0x57a, i) % 9;
      g.strokeStyle = P.strata[i % 2]; g.lineWidth = 1.6 + (i % 3) * 1.4; g.beginPath();
      for (let X = -TS; X <= (CW + 1) * TS; X += 4) { const w = wx0 + X; g.lineTo(X, yb + Math.sin(w * .045 + i * 1.7) * 2.2 + Math.sin(w * .012 + i) * 4); }
      g.stroke();
    }
    const pat = g.createPattern && g.createPattern(grainTile(n), 'repeat');
    if (pat) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = P.grain; g.fillStyle = pat; g.fillRect(0, 0, c2.width, c2.height); g.restore(); }
    const pebble = (x, y, r) => {
      g.fillStyle = P.pebble[2]; g.beginPath(); g.ellipse(x + .35, y + .45, r * 1.15, r * .85, 0, 0, 7); g.fill();
      const q = g.createRadialGradient(x - r * .4, y - r * .4, 0, x, y, r * 1.2); q.addColorStop(0, P.pebble[0]); q.addColorStop(1, P.pebble[1]);
      g.fillStyle = q; g.beginPath(); g.ellipse(x, y, r * 1.1, r * .8, 0, 0, 7); g.fill();
    };
    const clear = 'rgba(0,0,0,0)', shades = {lf: lin(0, 0, 4.5, 0, P.lit, clear), rt: lin(TS, 0, TS - 6, 0, P.shade, clear), dn: lin(0, TS, 0, TS - 6, P.shade, clear), ao: lin(0, P.depth - 1, 0, P.depth + 6, P.ao, clear)};
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < CW; x++) if (mass(x, y)) {
      const X = x * TS, Y = y * TS, up = !mass(x, y - 1), dn = !mass(x, y + 1), lf = !mass(x - 1, y), rt = !mass(x + 1, y), h = hv(x, y, 0x9eb), top = up ? 8 : 0;
      for (let q = 0; q < 2; q++) { const hq = h >>> (q * 9); if (hq % 7 > 1) continue; pebble(X + 2.5 + (hq >>> 3) % 11, Y + top + 2.5 + (hq >>> 6) % (12 - top), .7 + (hq >>> 10) % 4 * .4); }
      if (bio === 'meadow' && up && h % 3 === 0) {          // roots under the turf
        const rx = X + 3 + (h >>> 4) % 10; g.strokeStyle = 'rgba(58,32,16,.55)'; g.lineWidth = .6;
        g.beginPath(); g.moveTo(rx, Y + 4); g.quadraticCurveTo(rx + 2.5, Y + 8, rx + 1, Y + 10 + (h >>> 8) % 4); g.moveTo(rx + 1.3, Y + 7.5); g.quadraticCurveTo(rx - 1.5, Y + 9, rx - 2, Y + 11); g.stroke();
      }
      if (bio === 'sky' && h % 4 === 1) {                   // gold veins
        g.strokeStyle = 'rgba(236,186,92,.6)'; g.lineWidth = .55; g.beginPath(); const vy = Y + 5 + (h >>> 4) % 8;
        g.moveTo(X, vy); g.bezierCurveTo(X + 5, vy - 2.5, X + 10, vy + 2.5, X + 16, vy - 1); g.stroke();
        g.fillStyle = 'rgba(255,236,170,.9)'; g.beginPath(); g.arc(X + 4 + (h >>> 7) % 8, vy - .6, .45, 0, 7); g.fill();
      }
      if ((bio === 'frost' || bio === 'caves') && !up && h % 9 === 2) {   // ice or crystal set in the rock
        const cx = X + 4 + (h >>> 4) % 8, cy = Y + 4 + (h >>> 8) % 8, col = bio === 'frost' ? ['rgba(235,250,255,.95)', 'rgba(150,205,240,.8)'] : [['#9ffbe6', '#2fb79c'], ['#e2d2ff', '#8f62e0'], ['#ffd0ec', '#d06aa8']][h % 3];
        if (bio === 'caves') { const q = g.createRadialGradient(cx, cy, 0, cx, cy, 6); q.addColorStop(0, col[0] + '66'); q.addColorStop(1, col[0] + '00'); g.fillStyle = q; g.fillRect(cx - 6, cy - 6, 12, 12); }
        g.fillStyle = lin(cx - 2, cy - 3, cx + 2, cy + 3, col[0], col[1]); g.beginPath(); g.moveTo(cx, cy - 3.2); g.lineTo(cx + 1.6, cy); g.lineTo(cx, cy + 2.6); g.lineTo(cx - 1.6, cy); g.fill();
      }
      // Lit and shaded faces: one gradient each, moved from tile to tile.
      const face = (on, q, fx, fy, fw, fh) => { if (!on) return; g.translate(X, Y); g.fillStyle = q; g.fillRect(fx, fy, fw, fh); g.translate(-X, -Y); };
      face(lf, shades.lf, 0, 0, 4.5, TS); face(rt, shades.rt, TS - 6, 0, 6, TS); face(dn, shades.dn, 0, TS - 6, TS, 6);
      face(up && at(x, y) === EARTH, shades.ao, 0, 0, TS, P.depth + 6);
    }
    g.globalCompositeOperation = 'source-over';
    // 3. Under overhangs and roofs: roots, icicles, cloud fringe, stalactites.
    const icicle = (x, y, len, w = 1) => {
      g.fillStyle = lin(0, y, 0, y + len, 'rgba(255,255,255,.95)', 'rgba(170,215,250,.25)');
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * .3, y + len * .5, x, y + len); g.quadraticCurveTo(x + w * .3, y + len * .5, x + w, y); g.fill();
    };
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < CW; x++) if (mass(x, y) && !mass(x, y + 1)) {
      const X = x * TS, Yb = (y + 1) * TS, hu = hv(x, y, 0xd0d);
      if (bio === 'sky') { g.fillStyle = lin(0, Yb - 3, 0, Yb + 5, '#f4f1fc', 'rgba(205,198,236,0)'); g.fillRect(X - 1, Yb - 3, TS + 2, 8); }   // a soft cloud base the puffs grow from
      for (let i = 0; i < 3; i++) {
        const hq = hash(hu, i), sx = X + 2 + i * 5 + (hq % 30) / 10 + (bio === 'sky' ? (hq >>> 12) % 9 - 4 : 0);
        if (bio === 'meadow' && hq % 3 === 0) { g.strokeStyle = 'rgba(70,40,20,.7)'; g.lineWidth = .55; g.beginPath(); g.moveTo(sx, Yb - 1); g.quadraticCurveTo(sx + 1.4, Yb + 2, sx + .4, Yb + 2 + (hq >>> 4) % 5); g.stroke(); }
        else if (bio === 'frost' && hq % 4) icicle(sx, Yb - .6, 2.5 + (hq >>> 4) % 7, .9 + (hq >>> 8) % 3 * .3);
        else if (bio === 'sky' && (i !== 1 || hq % 4 === 0)) {
          const r = 3.6 + (hq >>> 4) % 9 * .62, cy = Yb - 2.2 + (hq >>> 8) % 5 * .7, q = g.createRadialGradient(sx - r * .35, cy - r * .5, 0, sx, cy, r * 1.05);
          q.addColorStop(0, '#ffffff'); q.addColorStop(.55, '#ece8fa'); q.addColorStop(1, '#bdb3e4');
          g.fillStyle = q; g.beginPath(); g.arc(sx, cy, r, 0, 7); g.fill();
        } else if (bio === 'caves' && hq % 3 !== 2) {
          const len = 3 + (hq >>> 6) % 9, w = 1.4 + (hq >>> 10) % 3 * .6;
          g.fillStyle = lin(0, Yb, 0, Yb + len, P.soil[1], P.soil[2]); g.beginPath(); g.moveTo(sx - w, Yb - .5); g.quadraticCurveTo(sx - w * .3, Yb + len * .5, sx, Yb + len); g.quadraticCurveTo(sx + w * .3, Yb + len * .5, sx + w, Yb - .5); g.fill();
          g.strokeStyle = 'rgba(170,150,255,.28)'; g.lineWidth = .35; g.beginPath(); g.moveTo(sx - w * .8, Yb); g.quadraticCurveTo(sx - w * .3, Yb + len * .5, sx, Yb + len); g.stroke();
          if (hq % 5 === 0) { g.fillStyle = 'rgba(140,255,230,.85)'; g.beginPath(); g.arc(sx, Yb + len + .9, .5, 0, 7); g.fill(); }
        }
      }
    }
    // 4. The cap: grass, snow, cloud or glowing moss, overhanging open edges.
    const flower = (fx, fy, v) => {
      const kind = v % 3, hgt = 2 + v % 2 * 1.2, cx = fx + .2, cy = fy - hgt;
      g.strokeStyle = '#3f8a30'; g.lineWidth = .45; g.beginPath(); g.moveTo(fx, fy + 1); g.quadraticCurveTo(fx + .5, fy - hgt * .5, cx, cy); g.stroke();
      if (kind === 0) {
        g.fillStyle = '#fffaf0'; for (let p = 0; p < 5; p++) { const an = p * 1.2566 + v; g.beginPath(); g.ellipse(cx + Math.cos(an) * .95, cy + Math.sin(an) * .95, .75, .5, an, 0, 7); g.fill(); }
        g.fillStyle = '#f5c03a'; g.beginPath(); g.arc(cx, cy, .55, 0, 7); g.fill();
      } else if (kind === 1) {
        g.fillStyle = '#ffd23f'; for (let p = 0; p < 5; p++) { const an = p * 1.2566; g.beginPath(); g.arc(cx + Math.cos(an) * .7, cy + Math.sin(an) * .7, .6, 0, 7); g.fill(); }
        g.fillStyle = '#e39a17'; g.beginPath(); g.arc(cx, cy, .4, 0, 7); g.fill();
      } else {
        g.fillStyle = '#f29ab8'; for (const [dx, dy] of [[-.5, 0], [.5, 0], [0, -.6]]) { g.beginPath(); g.arc(cx + dx, cy + dy, .55, 0, 7); g.fill(); }
        g.fillStyle = '#fff0f5'; g.beginPath(); g.arc(cx - .2, cy - .3, .2, 0, 7); g.fill();
      }
    };
    const glowcap = (fx, fy, v) => {
      const hgt = 2 + v % 3 * .8, q = g.createRadialGradient(fx, fy - hgt, 0, fx, fy - hgt, 5); q.addColorStop(0, 'rgba(120,255,230,.45)'); q.addColorStop(1, 'rgba(120,255,230,0)');
      g.fillStyle = q; g.fillRect(fx - 5, fy - hgt - 5, 10, 10);
      g.strokeStyle = '#cfeee6'; g.lineWidth = .6; g.beginPath(); g.moveTo(fx, fy + .8); g.lineTo(fx, fy - hgt); g.stroke();
      g.fillStyle = '#6ff5d6'; g.beginPath(); g.ellipse(fx, fy - hgt, 1.6, 1, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#e6fff9'; g.beginPath(); g.arc(fx - .5, fy - hgt - .5, .3, 0, 7); g.fill();
    };
    const wave = X => { const w = wx0 + X, b3 = Math.floor(w / 3), f = w / 3 - b3; return Math.sin(w * .71) * .4 + Math.sin(w * .23 + 1.3) * .75 + (hash(seed ^ 0xd21, b3) % 7 === 0 ? 1.8 * Math.sin(Math.PI * f) : 0); };
    const crest = X => {                         // the top edge: flat turf, snow lumps, cloud billows
      const w = wx0 + X;
      if (bio === 'frost') return -.6 - Math.max(0, Math.sin(w * .42 + Math.sin(w * .09) * 2)) * 1.1;
      if (bio === 'sky') { const b6 = Math.floor(w / 6), f = w / 6 - b6; return -.4 - Math.sqrt(Math.max(0, 1 - (f * 2 - 1) ** 2)) * (1.1 + hash(seed ^ 0x5c1, b6) % 3 * .55); }
      return -.6;
    };
    const cap = (a, b, y) => {
      const XA = a * TS, XB = b * TS, Y = y * TS, d = P.depth, lipL = !mass(a - 1, y), lipR = !mass(b, y), dl = 1 + hv(a, y, 0x11) % 4, dr = 1 + hv(b, y, 0x12) % 4;
      g.beginPath();
      if (lipL) { g.moveTo(XA - 1.3, Y + d + dl); g.quadraticCurveTo(XA - 2.2, Y + .6, XA + 1, Y + crest(XA + 1)); } else g.moveTo(XA, Y + crest(XA));
      for (let X = XA + 1.5; X < XB - 1; X += 1.5) g.lineTo(X, Y + crest(X));
      if (lipR) { g.lineTo(XB - 1, Y + crest(XB - 1)); g.quadraticCurveTo(XB + 2.2, Y + .6, XB + 1.3, Y + d + dr); g.quadraticCurveTo(XB + .6, Y + d + dr + 1.6, XB - 1.6, Y + d + wave(XB - 1.6)); }
      else { g.lineTo(XB, Y + crest(XB)); g.lineTo(XB, Y + d + wave(XB)); }
      for (let X = XB - 3; X > XA + 1.6; X -= 1.5) g.lineTo(X, Y + d + wave(X));
      if (lipL) { g.lineTo(XA + 1.6, Y + d + wave(XA + 1.6)); g.quadraticCurveTo(XA - .6, Y + d + dl + 1.6, XA - 1.3, Y + d + dl); } else g.lineTo(XA, Y + d + wave(XA));
      g.closePath();
      const q = g.createLinearGradient(0, Y - 2.5, 0, Y + d + 3); q.addColorStop(0, P.cap[0]); q.addColorStop(.28, P.cap[1]); q.addColorStop(.68, P.cap[2]); q.addColorStop(1, P.cap[3]);
      g.fillStyle = q; g.fill();
      if (bio === 'frost') { if (lipR) for (const o of [-.4, .9]) icicle(XB + o, Y + d + dr - .4, 2 + hv(b, y, 0x1c1 + o * 8) % 5, .8); if (lipL) icicle(XA - .6, Y + d + dl - .4, 2 + hv(a, y, 0x1c2) % 5, .8); }
      for (let x = a; x < b; x++) {
        const X = x * TS, hf = hv(x, y, 0xf10);
        const blade = (bx, by, bh, lean, col, w = .6) => { g.fillStyle = col; g.beginPath(); g.moveTo(bx - w, by); g.quadraticCurveTo(bx + lean * .4, by - bh * .55, bx + lean, by - bh); g.quadraticCurveTo(bx + lean * .3 + .25, by - bh * .45, bx + w, by); g.fill(); };
        if (P.blade) for (let i = 0; i < 8; i++) {   // blades of grass (tufts of moss) along the top
          const hb = hash(hv(x, y, 0xb1a), i), bx = X + i * 2 + (hb % 10) * .16, bh = (bio === 'caves' ? 1 : 1.8) + (hb >>> 4) % 10 * (bio === 'caves' ? .24 : .3), lean = ((hb >>> 8) % 11 - 5) * .15;
          blade(bx, Y + 1.3, bh, lean, P.blade[(hb >>> 12) % 4]);
        }
        if (bio === 'meadow') {
          const ht = hv(x, y, 0x7f7);
          if (ht % 3 === 0) { const tx = X + 2 + ht % 12; for (const [dl, hh, c] of [[-1.6, 3.6, 0], [0, 5, 2], [1.7, 3.9, 1], [.6, 4.4, 3]]) blade(tx + dl * .6, Y + 1.2, hh + (ht >>> 6) % 3 * .5, dl, P.blade[c], .7); }
          for (let i = 0; i < 6; i++) {             // brush strokes through the turf
            const hs = hash(ht, i), sx = X + 1 + i * 2.6 + hs % 2, sy = Y + 1.6 + (hs >>> 3) % 3;
            g.strokeStyle = hs % 3 ? 'rgba(52,108,38,.45)' : 'rgba(226,250,160,.55)'; g.lineWidth = .5; g.beginPath(); g.moveTo(sx, sy + 2); g.quadraticCurveTo(sx + .4, sy + .8, sx + .2 + (hs >>> 6) % 3 * .3, sy); g.stroke();
          }
        }
        if (bio === 'meadow') {
          for (let i = 0; i < 2; i++) { const hb = hash(hv(x, y, 0xb1b), i); if (hb % 3) continue; const bx = X + 3 + (hb >>> 3) % 10, by = Y + d + wave(bx) - .6, bl = 1.2 + (hb >>> 8) % 4 * .5; g.strokeStyle = P.cap[3]; g.lineWidth = .55; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + .5, by + bl * .6, bx + .2, by + bl); g.stroke(); }
          if (hf % 5 === 0) flower(X + 3 + (hf >>> 3) % 10, Y - .6, hf >>> 7);
        } else if (bio === 'caves' && hf % 6 === 0) glowcap(X + 3 + (hf >>> 3) % 10, Y - .3, hf >>> 7);
        else if (bio === 'frost') for (let i = 0; i < 2; i++) {   // sparkle in the snow
          const hs = hash(hf, i); if (hs % 2) continue; const sx = X + 2 + hs % 12, sy = Y + .6 + (hs >>> 4) % 4;
          g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(sx - .9, sy - .15, 1.8, .3); g.fillRect(sx - .15, sy - .9, .3, 1.8);
          g.fillStyle = 'rgba(160,215,255,.85)'; g.beginPath(); g.arc(sx, sy, .3, 0, 7); g.fill();
        } else if (bio === 'sky' && hf % 3 === 0) { g.fillStyle = 'rgba(255,214,120,.9)'; g.beginPath(); g.arc(X + 3 + hf % 10, Y + 2.2 + (hf >>> 4) % 2, .5, 0, 7); g.fill(); }
      }
    };
    ch.tops = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < CW;) {
      if (at(x, y) !== EARTH || mass(x, y - 1)) { x++; continue; }
      let b = x; while (b < CW && at(b, y) === EARTH && !mass(b, y - 1)) b++;
      cap(x, b, y); for (let q = x; q < b; q++) ch.tops.push([ch.ci * CW + q, y]);
      x = b;
    }
    // 5. Stone blocks, each a little different, and stumps where the generator put columns.
    const C = P.stone;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < CW; x++) {
      const id = at(x, y), X = x * TS, Y = y * TS, h = hv(x, y, 0x570), open = at(x, y - 1) === EMPTY;
      if (id === STONE) {
        g.fillStyle = C[3]; g.beginPath(); g.roundRect(X + .25, Y + .25, 15.5, 15.5, 2.2); g.fill();
        const q = g.createLinearGradient(X, Y, X + 12, Y + 16); q.addColorStop(0, C[0]); q.addColorStop(.5, C[1]); q.addColorStop(1, C[2]);
        g.fillStyle = q; g.beginPath(); g.roundRect(X + .9, Y + .9, 14.2, 14.2, 1.8); g.fill();
        const j = (h % 7 - 3) * .03; if (j) { g.fillStyle = j > 0 ? `rgba(255,255,255,${j})` : `rgba(0,0,0,${-j})`; g.fill(); }
        g.fillStyle = 'rgba(255,255,255,.38)'; g.fillRect(X + 1.8, Y + 1.2, 12.4, .9); g.fillRect(X + 1.2, Y + 1.8, .9, 11.6);
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(X + 1.8, Y + 13.9, 12.4, .9); g.fillRect(X + 13.9, Y + 1.8, .9, 12.4);
        for (let i = 0; i < 5; i++) { const hs = hash(h, i); g.fillStyle = hs % 2 ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(X + 3 + hs % 10, Y + 3 + (hs >>> 5) % 10, .35 + (hs >>> 9) % 3 * .2, 0, 7); g.fill(); }
        if (h % 4 === 0) { const cx = X + 4 + (h >>> 4) % 8; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .45; g.beginPath(); g.moveTo(cx, Y + 1.5); g.lineTo(cx + 1.2, Y + 4.5); g.lineTo(cx - .4, Y + 7); g.lineTo(cx + .8, Y + 9.5); g.stroke(); }
        if (bio === 'meadow' && open && h % 3) {        // moss on the open top
          for (let i = 0; i < 4; i++) { const hm = hash(h, i + 9), mx = X + 2 + i * 4 + hm % 2; g.fillStyle = '#5c9a3a'; g.beginPath(); g.ellipse(mx, Y + 1.2, 2.5, 1.5 + (hm >>> 3) % 2 * .6, 0, 0, 7); g.fill(); g.fillStyle = '#93cf5a'; g.beginPath(); g.ellipse(mx - .4, Y + .7, 1.5, .7, 0, 0, 7); g.fill(); }
        } else if (bio === 'frost' && open) {
          g.fillStyle = lin(0, Y - 1.2, 0, Y + 3, '#ffffff', '#d5e5f6'); g.beginPath(); g.moveTo(X + .3, Y + 2.6); g.quadraticCurveTo(X - .2, Y - 1.2, X + 4, Y - 1); g.quadraticCurveTo(X + 8, Y - 1.8, X + 12, Y - 1); g.quadraticCurveTo(X + 16.2, Y - 1.2, X + 15.7, Y + 2.6); g.quadraticCurveTo(X + 8, Y + 3.6, X + .3, Y + 2.6); g.fill();
        } else if (bio === 'sky') { g.strokeStyle = 'rgba(226,176,84,.6)'; g.lineWidth = .5; g.strokeRect(X + 3, Y + 3, 10, 10); }
      } else if (id === PIPE_L && at(x, y - 1) !== PIPE_L) {
        let hh = 0; while (at(x, y + hh) === PIPE_L) hh++;
        const Hh = hh * TS, W = 32, frost = bio === 'frost', cave = bio === 'caves';
        const B = cave ? ['#7a6f9c', '#554b78', '#3a3354', '#221d33'] : frost ? ['#b0a296', '#867868', '#5d5149', '#3c342f'] : ['#a77447', '#7f5334', '#5c3a22', '#382212'];
        const sh = g.createRadialGradient(X + 16, Y + Hh, 0, X + 16, Y + Hh, 22); sh.addColorStop(0, 'rgba(20,10,4,.35)'); sh.addColorStop(1, 'rgba(20,10,4,0)'); g.fillStyle = sh; g.fillRect(X - 8, Y + Hh - 7, 48, 12);
        const body = g.createLinearGradient(X, 0, X + W, 0); body.addColorStop(0, B[0]); body.addColorStop(.3, B[1]); body.addColorStop(.72, B[2]); body.addColorStop(1, B[3]);
        g.fillStyle = body; g.beginPath(); g.moveTo(X + 1.5, Y + 3); g.lineTo(X + 1.5, Y + Hh - 3); g.quadraticCurveTo(X + 1, Y + Hh, X - 3, Y + Hh + 1.2); g.lineTo(X + W + 3, Y + Hh + 1.2); g.quadraticCurveTo(X + W - 1, Y + Hh, X + W - 1.5, Y + Hh - 3); g.lineTo(X + W - 1.5, Y + 3); g.closePath(); g.fill();
        if (cave) for (let yy = Y + 9; yy < Y + Hh - 2; yy += 7) { g.strokeStyle = 'rgba(10,8,20,.35)'; g.lineWidth = .6; g.beginPath(); g.moveTo(X + 2, yy); g.quadraticCurveTo(X + 16, yy + 1.6, X + W - 2, yy); g.stroke(); }
        else for (let i = 0; i < 9; i++) {           // bark furrows, catching the light on the left
          const hb = hash(h, i), bx = X + 3.2 + i * 3.2 + (hb % 10) * .08;
          g.strokeStyle = i < 3 ? 'rgba(255,228,190,.18)' : 'rgba(30,14,6,.42)'; g.lineWidth = .55 + (hb >>> 4) % 3 * .2;
          g.beginPath(); g.moveTo(bx, Y + 6); for (let yy = Y + 8; yy <= Y + Hh; yy += 3) g.lineTo(bx + Math.sin(yy * .5 + i) * .5, yy); g.stroke();
        }
        g.fillStyle = B[2]; for (const [rx, rw] of [[X + 1, 5], [X + W - 1, 5], [X + 12, 4]]) { g.beginPath(); g.ellipse(rx, Y + Hh + 1, rw, 2.4, 0, Math.PI, 0); g.fill(); }
        g.fillStyle = B[3]; g.beginPath(); g.ellipse(X + 16, Y + 3, 15, 3.6, 0, 0, 7); g.fill();
        const face = g.createRadialGradient(X + 13, Y + 2.4, 0, X + 16, Y + 3, 14), fc = cave ? ['#9a8fc4', '#665c90', '#40395c'] : ['#f3d7a6', '#d3a46b', '#a87342'];
        face.addColorStop(0, fc[0]); face.addColorStop(.6, fc[1]); face.addColorStop(1, fc[2]);
        g.fillStyle = face; g.beginPath(); g.ellipse(X + 16, Y + 2.8, 13.6, 2.9, 0, 0, 7); g.fill();
        if (!cave) { g.strokeStyle = 'rgba(140,84,40,.4)'; g.lineWidth = .4; for (const r of [3, 6.5, 10]) { g.beginPath(); g.ellipse(X + 16.3, Y + 2.85, r, r * .21, 0, 0, 7); g.stroke(); } }
        if (frost) {                                   // a snow cap, drooping over the rim
          g.fillStyle = lin(0, Y - 1.5, 0, Y + 6, '#ffffff', '#d3e3f5'); g.beginPath(); g.moveTo(X + .2, Y + 4); g.quadraticCurveTo(X - .5, Y - 1.4, X + 8, Y - 1.2); g.quadraticCurveTo(X + 16, Y - 2.4, X + 24, Y - 1.2); g.quadraticCurveTo(X + 32.5, Y - 1.4, X + 31.8, Y + 4);
          g.quadraticCurveTo(X + 30, Y + 7.5, X + 27, Y + 5.6); g.quadraticCurveTo(X + 16, Y + 7, X + 6, Y + 5.6); g.quadraticCurveTo(X + 2, Y + 7.5, X + .2, Y + 4); g.fill();
          for (const o of [4, 11, 21, 28]) icicle(X + o, Y + 6, 2 + hash(h, o) % 5, .8);
        } else if (cave) {                             // crystals growing on the pillar
          for (const [dx, hgt, w2, ci] of [[11, 9, 2.6, 0], [17, 13, 3.2, 1], [23, 7, 2.2, 2]]) {
            const col = [['#9ffbe6', '#2fb79c'], ['#e2d2ff', '#8f62e0'], ['#ffd0ec', '#d06aa8']][(h + ci) % 3], gx = X + dx;
            const q = g.createRadialGradient(gx, Y - hgt * .5, 0, gx, Y - hgt * .5, hgt); q.addColorStop(0, col[0] + '55'); q.addColorStop(1, col[0] + '00'); g.fillStyle = q; g.fillRect(gx - hgt, Y - hgt * 1.5, hgt * 2, hgt * 2);
            g.fillStyle = lin(gx - w2, 0, gx + w2, 0, col[0], col[1]); g.beginPath(); g.moveTo(gx - w2, Y + 3); g.lineTo(gx, Y + 3 - hgt); g.lineTo(gx + w2, Y + 3); g.fill();
          }
        } else {                                       // moss on the rim, a shelf fungus on the side
          for (let i = 0; i < 5; i++) { const hm = hash(h, i + 20), mx = X + 2 + i * 2.6 + hm % 2; g.fillStyle = '#5c9a3a'; g.beginPath(); g.ellipse(mx, Y + 3.6 + Math.abs(i - 2) * .4, 2.4, 1.4, 0, 0, 7); g.fill(); g.fillStyle = '#93cf5a'; g.beginPath(); g.ellipse(mx - .3, Y + 3, 1.4, .6, 0, 0, 7); g.fill(); }
          if (hh > 1 && h % 2) { const fy = Y + 10 + h % 8; g.fillStyle = '#e0a860'; g.beginPath(); g.ellipse(X + W - 2, fy, 4, 1.6, -.15, Math.PI, 0); g.fill(); g.fillStyle = '#f6d39a'; g.beginPath(); g.ellipse(X + W - 2.4, fy - .5, 3, .7, -.15, Math.PI, 0); g.fill(); }
        }
      }
    }
    // 6. Painted trees and rocks, standing behind everything above.
    if (props.length) {
      g.globalCompositeOperation = 'destination-over';
      for (const p of props) {
        const spr = propSprite(p.kind, bio, k), w = spr.width / k, hh = spr.height / k, X = p.x * TS + 8 - w / 2 + ((p.hv >>> 5) % 7 - 3), Y = p.s * TS + 3 - hh;
        if (p.hv & 1) { g.save(); g.translate(X + w, Y); g.scale(-1, 1); g.drawImage(spr, 0, 0, w, hh); g.restore(); } else g.drawImage(spr, X, Y, w, hh);
      }
      g.globalCompositeOperation = 'source-over';
    }
    return {c: c2, y0};
  }
  function chunkArt(ch, n) {
    const key = `${n}:${ch.v || 0}:${!!chunks.get(ch.ci - 1)}${!!chunks.get(ch.ci + 1)}:${!!propsImg.naturalWidth}`;
    if (!ch.art || ch.art.key !== key) ch.art = {key, ...paintChunk(ch, n)};
    return ch.art;
  }
  const camDev = () => Math.round(cam * S);
  // A softened, hazier copy of the kingdom painting keeps the stage readable.
  let farCache = null;
  function farLayer() {
    if (!backdrop.complete || !backdrop.naturalWidth) return null;
    const h = Math.round(VIEW_H * S * 1.05), w = Math.round(h * backdrop.naturalWidth / backdrop.naturalHeight);
    if (farCache && farCache.height === h) return farCache;
    farCache = document.createElement('canvas'); farCache.width = w; farCache.height = h;
    const g = farCache.getContext('2d');
    g.filter = `blur(${Math.max(1, S * .35).toFixed(1)}px) saturate(.82) brightness(1.06)`; g.drawImage(backdrop, 0, 0, w, h); g.filter = 'none';
    const haze = g.createLinearGradient(0, 0, 0, h); haze.addColorStop(0, 'rgba(226,242,248,.32)'); haze.addColorStop(.55, 'rgba(238,240,228,.48)'); haze.addColorStop(1, 'rgba(244,236,214,.72)');
    g.fillStyle = haze; g.fillRect(0, 0, w, h);
    return farCache;
  }

  // Which biome the camera is in, and how far it has blended into the next one
  // (the last chunk of a region crossfades into the next region's look).
  function biomeMix() {
    const centre = cam + viewW / 2, chunkF = centre / (CW * TS), region = Math.floor(chunkF / REGION), inRegion = chunkF - region * REGION;
    const a = regionBiome(region), b = regionBiome(region + 1), w = Math.max(0, Math.min(1, inRegion - (REGION - 1)));
    return {a, b, w: a === b ? 0 : w, region, centre};
  }
  const weightOf = (m, id) => (m.a === id ? 1 - m.w : 0) + (m.b === id ? m.w : 0);
  const noise = (x, k) => Math.sin(x * .013 + k) * .6 + Math.sin(x * .037 + k * 2.1) * .3 + Math.sin(x * .091 + k * 3.3) * .1;
  function ridge(par, base, amp, col, k, jag, fromTop) {
    const W = cv.width, bandH = VIEW_H * S, y0 = oy + bandH * base;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, fromTop ? 0 : cv.height);
    for (let x = 0; x <= W + 10; x += 10) { const wx = x / S + cam * par, n = noise(wx, k); ctx.lineTo(x, y0 + (fromTop ? 1 : -1) * (jag ? Math.abs(n) * 1.6 - .3 : n) * amp * S); }
    ctx.lineTo(W, fromTop ? 0 : cv.height); ctx.fill();
  }
  // Painted mountains, graded for frost (near, wintry) or sky (far below, hazy).
  let mtnCache = {};
  const cloudCache = new Map();
  function mtnLayer(kind) {
    if (!mtnImg.complete || !mtnImg.naturalWidth) return null;
    const h = Math.round(VIEW_H * S * (kind === 'sky' ? .34 : kind === 'caves' ? .42 : .6)), w = Math.round(h * mtnImg.naturalWidth / mtnImg.naturalHeight);
    if (mtnCache[kind] && mtnCache[kind].height === h) return mtnCache[kind];
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const g = c2.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.filter = `blur(${Math.max(.5, S * (kind === 'sky' ? .4 : .22)).toFixed(1)}px)`; g.drawImage(mtnImg, 0, 0, w, h); g.filter = 'none';
    g.globalCompositeOperation = 'source-atop';
    const [tint, mist] = kind === 'sky' ? ['rgba(176,206,242,.62)', '240,248,255'] : kind === 'caves' ? ['rgba(26,20,44,.86)', '20,16,34'] : ['rgba(198,218,246,.36)', '238,245,252'];
    g.fillStyle = tint; g.fillRect(0, 0, w, h);
    const q = g.createLinearGradient(0, h * .3, 0, h); q.addColorStop(0, `rgba(${mist},0)`); q.addColorStop(.6, `rgba(${mist},.6)`); q.addColorStop(1, `rgba(${mist},.95)`); g.fillStyle = q; g.fillRect(0, 0, w, h);
    return (mtnCache[kind] = c2);
  }
  // A cumulus: lit tops, a lavender underside, a flat base.
  function cloudSprite(v) {
    const key = v + ':' + S; if (cloudCache.has(key)) return cloudCache.get(key);
    const c2 = document.createElement('canvas'); c2.width = Math.round(100 * S); c2.height = Math.round(44 * S);
    const g = c2.getContext('2d'), r = rng(0xc10d + v); g.scale(S, S);
    for (let i = 0; i < 9; i++) {
      const x = 12 + i * 9.5 + r() * 4, rr = 6 + Math.sin(i / 8 * Math.PI) * (9 + v % 3 * 2) + r() * 4, y = 38 - rr * .8;
      const q = g.createRadialGradient(x - rr * .3, y - rr * .45, rr * .1, x, y, rr); q.addColorStop(0, '#ffffff'); q.addColorStop(.7, '#f3f0fc'); q.addColorStop(1, '#d4cdee');
      g.fillStyle = q; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'destination-out'; g.fillRect(0, 38, 100, 10);
    g.globalCompositeOperation = 'source-atop';
    const q = g.createLinearGradient(0, 24, 0, 38); q.addColorStop(0, 'rgba(160,150,210,0)'); q.addColorStop(1, 'rgba(160,150,210,.4)'); g.fillStyle = q; g.fillRect(0, 0, 100, 44);
    cloudCache.set(key, c2); return c2;
  }
  // An image tiled sideways with every other copy mirrored, so it never shows a seam.
  function mirrored(img, par, y) {
    const W = cv.width, w = img.width, off = (cam * S * par) % (2 * w);
    for (let x = -off - 2 * w, i = 0; x < W + w; x += w, i++) {
      ctx.save(); ctx.translate(x + (i % 2 ? w : 0), y); ctx.scale(i % 2 ? -1 : 1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
    }
  }
  const ridgeY = (u, base, amp, k, jag) => { const n = noise(u, k); return oy + VIEW_H * S * base - (jag ? Math.abs(n) * 1.6 - .3 : n) * amp * S; };
  function biomeBackground(id) {
    const W = cv.width, H = cv.height, bandH = VIEW_H * S, fill = (stops) => { const q = ctx.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => q.addColorStop(o, c)); ctx.fillStyle = q; ctx.fillRect(0, 0, W, H); };
    const vgrad = (y0, y1, a, b) => { const q = ctx.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, a); q.addColorStop(1, b); return q; };
    const glow = (x, y, r, col) => { const q = ctx.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, col); q.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); ctx.fillStyle = q; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    if (id === 'meadow') {
      fill([[0, '#8fcdf2'], [.6, '#d8eef0'], [1, '#f4e6c8']]);
      const far = farLayer();
      if (far) mirrored(far, .12, oy - bandH * .02);   // the painted kingdom far away, softened once
      ctx.fillStyle = '#4c2d1a'; ctx.fillRect(0, oy + bandH, W, H - oy - bandH);
    } else if (id === 'frost') {
      fill([[0, '#a3c4e8'], [.5, '#dce8f6'], [1, '#f4f8fd']]);
      glow(W * .78, oy + bandH * .16, bandH * .55, 'rgba(255,250,232,.85)');
      const mt = mtnLayer('frost');
      if (mt) mirrored(mt, .07, oy + bandH * .7 - mt.height);
      else { ridge(.1, .5, 46, '#e9f0f8', 1.3, true); ridge(.2, .64, 38, '#c9d9eb', 2.7, true); }
      // A near ridge of snow with painted pines along it.
      ridge(.3, .66, 18, vgrad(oy + bandH * .56, oy + bandH, '#f2f7fc', '#c4d5e8'), 4.1, true);
      if (propsImg.complete && propsImg.naturalWidth) {
        const k = .4 * S, spr = propSprite('pine', 'frost', k), sw = spr.width, sh = spr.height, par = .3, step = 46;
        for (let i = Math.floor((cam * par - 60) / step), u; (u = i * step) < cam * par + W / S + 60; i++) {
          const hp = hash(seed ^ 0x917, i); if (hp % 3 === 0) continue;
          const uu = u + hp % 30, x = (uu - cam * par) * S, y = ridgeY(uu, .66, 18, 4.1, true), sc = .7 + (hp >>> 4) % 5 * .1;
          ctx.globalAlpha = .9; ctx.drawImage(spr, x - sw * sc / 2, y - sh * sc + 3 * S, sw * sc, sh * sc); ctx.globalAlpha = 1;
        }
      }
      ctx.fillStyle = '#5c7498'; ctx.fillRect(0, oy + bandH, W, H - oy - bandH);
    } else if (id === 'sky') {
      fill([[0, '#58a8ee'], [.55, '#bfe2ff'], [1, '#f0f8ff']]);
      glow(W * .2, oy + bandH * .1, bandH * .6, 'rgba(255,244,214,.75)');
      const mt = mtnLayer('sky');   // the world far below, through a gap in the clouds
      if (mt) mirrored(mt, .03, oy + bandH * .86 - mt.height);
      const sea = (par, base, a, shade) => {
        ctx.fillStyle = vgrad(oy + bandH * (base - .08), oy + bandH, `rgba(255,255,255,${a})`, `rgba(${shade},${a})`); ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W + 12; x += 12) { const wx = x / S + cam * par + frameNo * .08; ctx.lineTo(x, oy + bandH * base - (Math.abs(Math.sin(wx * .045)) * 12 + Math.sin(wx * .011) * 6) * S); }
        ctx.lineTo(W, H); ctx.fill();
      };
      sea(.25, .8, .75, '214,208,240');
      // Distant islands drift slowly, each with a painted tree.
      const tree = propsImg.complete && propsImg.naturalWidth ? propSprite('oak', 'sky', .2 * S) : null;
      for (let i = Math.floor(cam * .2 / 260) - 1, n = 0; n < Math.ceil(W / S / 260) + 3; i++, n++) {
        const x = (i * 260 - cam * .2 + (hash(seed ^ 0x51, i) % 90)) * S, y = oy + bandH * (.2 + (hash(seed ^ 0x52, i) % 26) / 100), w = (12 + hash(seed, i) % 12) * S;
        ctx.save(); ctx.globalAlpha = .82;
        ctx.fillStyle = vgrad(y, y + w * .9, '#b9aee2', '#7f72b8'); ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * .5, y + w * .5, x - w * .2, y + w * .9); ctx.quadraticCurveTo(x + w * .2, y + w * .5, x + w, y); ctx.fill();
        if (tree) { const sc = w / S / 22; ctx.drawImage(tree, x - tree.width * sc * .5 + w * .15, y - tree.height * sc + w * .06, tree.width * sc, tree.height * sc); }
        ctx.fillStyle = vgrad(y - w * .12, y + w * .14, '#9fd27a', '#5e9a4e'); ctx.beginPath(); ctx.ellipse(x, y, w * 1.05, w * .16, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - w * .7, y + w * .1, w * .45, w * .12, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      for (const [par, base, sc, a, salt] of [[.12, .42, .7, .8, 0x61], [.2, .58, 1, .95, 0x62]]) {   // drifting cumulus
        const step = 150, cw = 100 * sc;
        for (let i = Math.floor((cam * par - cw) / step), u; (u = i * step) < cam * par + W / S + cw; i++) {
          const hc = hash(seed ^ salt, i); if (hc % 3 === 0) continue;
          const spr = cloudSprite(hc % 4), x = (u + hc % 60 - cam * par - frameNo * .03 * par) * S, y = oy + bandH * (base + ((hc >>> 6) % 14) / 100);
          ctx.globalAlpha = a; ctx.drawImage(spr, x, y - spr.height * sc, spr.width * sc, spr.height * sc); ctx.globalAlpha = 1;
        }
      }
      for (const [par, base, sc, salt] of [[.42, .88, .9, 0x71], [.6, .97, 1.25, 0x72]]) {   // a sea of cumulus
        const y0 = oy + bandH * base, step = 64;
        ctx.fillStyle = vgrad(y0 - 4 * S, H, '#f6f3fd', '#d9d2f0'); ctx.fillRect(0, y0 - 4 * S, W, H - y0 + 4 * S);
        for (let i = Math.floor((cam * par - 140) / step), u; (u = i * step) < cam * par + W / S + 40; i++) {
          const hc = hash(seed ^ salt, i), k = sc * (.85 + (hc >>> 5) % 6 * .1), spr = cloudSprite(hc % 4);
          ctx.drawImage(spr, (u + hc % 30 - cam * par - frameNo * .05 * par) * S, y0 + (hc >>> 9) % 8 * S - spr.height * k * .8, spr.width * k, spr.height * k);
        }
      }
    } else {
      fill([[0, '#0c0a18'], [.5, '#171329'], [1, '#221c35']]);
      // Light leaks through cracks in the roof.
      for (let i = 0; i < 4; i++) {
        const x = (((i * 233 + 90 - cam * .1) % (W / S + 200)) + W / S + 200) % (W / S + 200) * S - 100 * S, a = .05 + .03 * Math.sin(frameNo * .01 + i);
        ctx.fillStyle = `rgba(150,190,255,${a.toFixed(3)})`; ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x + 14 * S, oy); ctx.lineTo(x + 70 * S, oy + bandH); ctx.lineTo(x + 30 * S, oy + bandH); ctx.fill();
      }
      const rock = mtnLayer('caves');   // the far walls: painted crags, darkened, hanging from the roof and rising from the floor
      if (rock) {
        ctx.save(); ctx.translate(0, oy + bandH * .34); ctx.scale(1, -1); mirrored(rock, .1, 0); ctx.restore();
        mirrored(rock, .14, oy + bandH * .86 - rock.height);
      } else { ridge(.12, .2, 26, vgrad(oy, oy + bandH * .3, '#120f20', '#1d1830'), 5.2, true, true); ridge(.12, .82, 24, vgrad(oy + bandH * .6, oy + bandH, '#221c38', '#141120'), 6.1, true); }
      ridge(.26, .9, 18, vgrad(oy + bandH * .7, oy + bandH, '#2a2342', '#17131f'), 7.4, true);
      for (let i = Math.floor((cam * .26 - 80) / 90), u; (u = i * 90) < cam * .26 + W / S + 80; i++) {   // crystal clusters glowing in the dark
        const hc = hash(seed ^ 0xc9, i); if (hc % 2) continue;
        const uu = u + hc % 40, x = (uu - cam * .26) * S, y = ridgeY(uu, .9, 18, 7.4, true), col = [[95, 242, 216], [180, 139, 255], [255, 143, 208]][hc % 3], pulse = .5 + .2 * Math.sin(frameNo * .03 + i);
        glow(x, y - 6 * S, 30 * S, `rgba(${col},${(.35 * pulse).toFixed(2)})`);
        for (const [dx, hh, w] of [[-4, 9, 2.4], [0, 15, 3], [5, 8, 2.2]]) {
          ctx.fillStyle = vgrad(y - hh * S, y, `rgba(${col},.95)`, `rgba(${col},.35)`); ctx.beginPath(); ctx.moveTo(x + (dx - w) * S, y); ctx.lineTo(x + dx * S, y - hh * S); ctx.lineTo(x + (dx + w) * S, y); ctx.fill();
        }
      }
      for (let i = 0; i < 26; i++) {   // far crystals twinkle
        const x = ((i * 131.7 - cam * .15) % (W + 40) + W + 40) % (W + 40) - 20, y = oy + bandH * (.25 + (i * 37 % 50) / 100), a = .25 + .25 * Math.sin(frameNo * .04 + i);
        ctx.fillStyle = ['rgba(95,242,216,', 'rgba(180,139,255,', 'rgba(255,143,208,'][i % 3] + a.toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, (1 + i % 3 * .5) * S * .5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#1b172a'; ctx.fillRect(0, oy + bandH, W, H - oy - bandH);
    }
  }
  function drawBackground() {
    const m = biomeMix();
    biomeBackground(m.a);
    if (m.w > 0) {
      // Into or out of the caves the light goes through the dark of the cave
      // mouth instead of mixing a bright sky with dark rock.
      const cave = m.a === 'caves' || m.b === 'caves', e = cave ? m.w * m.w * (3 - 2 * m.w) : m.w;
      ctx.save(); ctx.globalAlpha = e; biomeBackground(m.b); ctx.restore();
      if (cave) { ctx.fillStyle = `rgba(12,10,22,${(.62 * Math.sin(Math.PI * m.w)).toFixed(3)})`; ctx.fillRect(0, 0, cv.width, cv.height); }
    }
    drawLandmark(m);
    drawSkyTime(m);
    drawWonder();
  }
  /* ---------------- time of day ----------------
     The sun goes down as the journey goes on: day for the first chapters,
     golden hour, dusk, a starry night with fireflies over the next meadow,
     then dawn: one day every five regions. A function of distance, so ghosts
     and replays see the same sky. Underground, the caves keep their own dark. */
  const DAY = 5 * REGION * CW * TS;
  const DAYKEYS = [[0, 'day'], [.46, 'day'], [.54, 'gold'], [.6, 'gold'], [.66, 'dusk'], [.72, 'night'], [.9, 'night'], [.95, 'dawn'], [1, 'day']];
  function dayAt(x) {
    const p = ((x / DAY) % 1 + 1) % 1, w = {day: 0, gold: 0, dusk: 0, night: 0, dawn: 0};
    for (let i = 1; i < DAYKEYS.length; i++) if (p <= DAYKEYS[i][0]) {
      const [a, ka] = DAYKEYS[i - 1], [b, kb] = DAYKEYS[i], f = (p - a) / (b - a), e = f * f * (3 - 2 * f);
      w[ka] += 1 - e; w[kb] += e; break;
    }
    return w;
  }
  // Each phase's colour at the top, two thirds down and the foot of the sky,
  // and over the world; a frame blends them into one wash for each.
  const SKYWASH = {gold: [['255,168,84', .08], ['255,140,60', .3], ['255,140,60', .22]], dawn: [['255,182,196', .08], ['255,160,150', .3], ['255,160,150', .22]],
    dusk: [['46,36,110', .5], ['160,80,140', .32], ['255,130,110', .26]], night: [['8,12,38', .74], ['12,20,56', .62], ['20,26,64', .55]]};
  const WORLDWASH = {gold: ['255,150,70', .12], dawn: ['255,160,170', .09], dusk: ['84,52,132', .22], night: ['10,18,56', .4]};
  function mixWash(list) {
    let A = 0, r = 0, g = 0, b = 0;
    for (const [w, c, a] of list) { const k = w * a; if (k <= 0) continue; const [cr, cg, cb] = c.split(',').map(Number); A += k; r += cr * k; g += cg * k; b += cb * k; }
    return A > .005 ? `rgba(${r / A | 0},${g / A | 0},${b / A | 0},${Math.min(1, A).toFixed(3)})` : 'rgba(0,0,0,0)';
  }
  function drawSkyTime(m) {
    const o = 1 - weightOf(m, 'caves'), d = dayAt(m.centre); if (o < .02 || d.day > .99) return;
    const W = cv.width, H = cv.height, bandH = VIEW_H * S, t = drawT ?? frameNo, phases = ['gold', 'dawn', 'dusk', 'night'];
    const q = ctx.createLinearGradient(0, oy, 0, oy + bandH);
    [0, .6, 1].forEach((at, k) => q.addColorStop(at, mixWash(phases.map(ph => [d[ph] * o, ...SKYWASH[ph][k]]))));
    ctx.fillStyle = q; ctx.fillRect(0, 0, W, portrait ? oy + bandH : H);   // the phone console covers the rest
    // A low sun at golden hour (in the west) and at dawn (in the east).
    for (const [a, sx, col] of [[d.gold * o, .84, '#ffc478'], [d.dawn * o, .14, '#ffd6aa']]) {
      if (a < .01) continue;
      blob(W * sx, oy + bandH * .6, bandH * .5, col, .5 * a);
      ctx.globalAlpha = .85 * a; ctx.fillStyle = '#fff1cf'; ctx.beginPath(); ctx.arc(W * sx, oy + bandH * .6, 9 * S, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    const n = d.night * o + d.dusk * o * .35;
    if (n < .01) return;
    for (let i = 0; i < 70; i++) {   // stars, a little twinkle, almost still
      const x = ((i * 157.3 - cam * S * .02) % W + W) % W, y = (oy + bandH * .62) * ((i * 61 % 97) / 97) ** 1.3, tw = .55 + .45 * Math.sin(t * (.03 + i % 5 * .01) + i);
      ctx.globalAlpha = n * tw * (.5 + (i % 3) * .25); ctx.fillStyle = i % 7 ? '#ffffff' : '#ffe9b0'; ctx.beginPath(); ctx.arc(x, y, (.35 + (i % 4) * .18) * S, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const mx = W * .6, my = oy + bandH * .22;   // the moon, clear of the HUD's corners
    blob(mx, my, 34 * S, '#dfe8ff', .45 * n);
    ctx.globalAlpha = n; ctx.drawImage(moonSprite(), mx - 10 * S, my - 10 * S, 20 * S, 20 * S); ctx.globalAlpha = 1;
  }
  // Over the world itself: a warm or cool grade, Pip's own warm glow after
  // sunset, and fireflies over the meadow at night.
  function drawDusk(m) {
    const o = 1 - weightOf(m, 'caves'), d = dayAt(m.centre); if (o < .02 || d.day > .99) return;
    const W = cv.width, bandH = VIEW_H * S, t = drawT ?? frameNo;
    ctx.fillStyle = mixWash(Object.entries(WORLDWASH).map(([ph, [c, a]]) => [d[ph] * o, c, a])); ctx.fillRect(0, oy, W, bandH);
    const dark = (d.night + d.dusk * .5) * o; if (dark < .02) return;
    if (!dead) {
      const [px, py] = W2D(pl.x + 6, pl.y + pl.h * .45);
      ctx.globalCompositeOperation = 'lighter'; blob(px, py, 48 * S, '#ffd9a0', .3 * dark); ctx.globalCompositeOperation = 'source-over';
    }
    const ff = d.night * weightOf(m, 'meadow');
    for (let i = 0; ff > .02 && i < 22; i++) {
      const x = (((i * 83.7 - cam * .9 + Math.sin(t * .011 + i) * 30) * S) % (W + 60) + W + 60) % (W + 60) - 30, y = oy + bandH * (.32 + (i * 37 % 50) / 100) + Math.sin(t * .017 + i * 2) * 10 * S;
      const a = ff * (.35 + .65 * Math.max(0, Math.sin(t * .05 + i * 1.7))), wx = cam + x / S, wy = (y - oy) / S;
      if (tileAt(Math.floor(wx / TS), Math.floor(wy / TS))) continue;   // only in the open air
      blob(x, y, 5 * S, '#fff2a0', .8 * a); ctx.globalAlpha = a; ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(x, y, .7 * S, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  /* ---------------- foreground ----------------
     Out-of-focus plants pass close to the camera at the foot of the stage,
     faster than the world, for depth; they thin out around Pip. Painted small
     and drawn four times larger: the blur of a close, unfocused lens. */
  const foreCache = new Map();
  function foreSprite(biome, v) {
    const key = biome + v + ':' + S; if (foreCache.has(key)) return foreCache.get(key);
    const W = 64, H = 48, q = .25 * S, c2 = document.createElement('canvas'); c2.width = Math.max(4, Math.round(W * q)); c2.height = Math.max(4, Math.round(H * q));
    const g = c2.getContext('2d'), r = rng(0xf0e + v * 31 + biome.length * 7); g.scale(c2.width / W, c2.height / H);
    const blade = (x, h, lean, w, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - w, H); g.quadraticCurveTo(x + lean * .3, H - h * .6, x + lean, H - h); g.quadraticCurveTo(x + lean * .3 + w * .4, H - h * .55, x + w, H); g.fill(); };
    const dot = (x, y, rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); };
    if (biome === 'meadow' || biome === 'frost') {
      const frost = biome === 'frost', cols = frost ? ['#7f95b0', '#a8bcd2', '#62789a', '#c9d8e8'] : ['#2f6b2a', '#3f8a35', '#24541e', '#4f9c3d'];
      if (frost) { g.fillStyle = '#e8f1fa'; g.beginPath(); g.ellipse(32, H, 30, 9, 0, 0, 7); g.fill(); }
      for (let i = 0; i < 26; i++) { const x = 32 + (r() - .5) * 42; blade(x, 16 + r() * 28 * (1 - Math.abs(x - 32) / 40), (x - 32) * .45 + (r() - .5) * 10, 1.6 + r(), cols[i % 4]); }
      if (!frost && v % 2) for (let i = 0; i < 3; i++) dot(18 + i * 13 + r() * 6, 8 + r() * 12, 2.6 + r() * 1.5, ['#f6b6cf', '#ffe08a', '#ffffff'][(i + v) % 3]);
      if (frost) for (let i = 0; i < 8; i++) dot(10 + r() * 44, 14 + r() * 20, .8 + r(), '#ffffff');
    } else if (biome === 'sky') {
      for (let i = 0; i < 7; i++) { const x = 8 + i * 8 + r() * 4, rad = 8 + Math.sin(i / 6 * Math.PI) * 9 + r() * 3; dot(x, H - rad * .5, rad, i % 2 ? '#ffffff' : '#f1edfb'); }
      g.fillStyle = 'rgba(190,180,230,.45)'; g.fillRect(0, H - 6, W, 6);
    } else {
      g.fillStyle = '#14101f'; g.beginPath(); g.moveTo(10, H); g.lineTo(22 + v * 3, 10 + v * 4); g.lineTo(30, H); g.moveTo(26, H); g.lineTo(40, 20); g.lineTo(52, H); g.fill();
      dot(22 + v * 3, 11 + v * 4, 2.2, '#5ff2d8'); dot(40, 21, 1.8, '#b48bff');
    }
    foreCache.set(key, c2); return c2;
  }
  function drawFore(m) {
    const W = cv.width, base = oy + VIEW_H * S, par = 1.45, step = 120, [px] = W2D(pl.x + 6, 0);
    for (const id of new Set([m.a, m.b])) {
      const wgt = weightOf(m, id); if (wgt < .02) continue;
      for (let i = Math.floor((cam * par - 90) / step), u; (u = i * step) < cam * par + W / S + 90; i++) {
        const h = hash(seed ^ 0xf07, i); if (h % 5 < 2) continue;
        const spr = foreSprite(id, h % 3), sc = .8 + (h >>> 4) % 5 * .12, w = 64 * S * sc, hh = 48 * S * sc, x = (u + (h >>> 8) % 50 - cam * par) * S;
        ctx.globalAlpha = wgt * (.3 + .6 * clamp(0, (Math.abs(x + w / 2 - px) - 18 * S) / (40 * S), 1));
        if (h & 64) { ctx.save(); ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(spr, 0, base - hh + 6 * S, w, hh); ctx.restore(); }
        else ctx.drawImage(spr, x, base - hh + 6 * S, w, hh);
      }
    }
    ctx.globalAlpha = 1;
  }
  /* ---------------- wonders ----------------
     Most regions hold one rare sight in the sky, seeded and never the same
     twice in a row: a sky whale, lanterns, balloons, a meteor shower, aurora. */
  const WONDERS = {meadow: ['whale', 'lanterns', 'balloons', 'meteors'], frost: ['aurora', 'meteors', 'whale'], sky: ['whale', 'balloons', 'lanterns'], caves: []};
  function regionWonder(r) {
    const raw = q => { const list = WONDERS[regionBiome(q)]; return q < 1 || !list.length || hash(seed ^ 0x40d, q) % 10 < 3 ? null : list[hash(seed ^ 0x40e, q) % list.length]; };
    // Compared with the previous region's final choice, so neighbours never match.
    const w = raw(r);
    if (!w || w !== (r > 1 ? regionWonder(r - 1) : null)) return w;
    const list = WONDERS[regionBiome(r)]; return list[(list.indexOf(w) + 1) % list.length];
  }
  // Painted once (per screen scale) and reused: the sky whale, the balloons,
  // a paper lantern, the moon, the cave crystals.
  const spriteCache = new Map();
  function sprite(key, w, h, paint) {
    const k = key + ':' + S; if (spriteCache.has(k)) return spriteCache.get(k);
    const c2 = document.createElement('canvas'); c2.width = Math.max(2, Math.ceil(w * S)); c2.height = Math.max(2, Math.ceil(h * S));
    const g = c2.getContext('2d'); g.scale(S, S); g.lineCap = 'round'; g.lineJoin = 'round'; paint(g);
    spriteCache.set(k, c2); return c2;
  }
  const grad = (g, x0, y0, x1, y1, stops) => { const q = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => q.addColorStop(i / (stops.length - 1), c)); return q; };
  const radial = (g, x, y, r, stops, fx = x, fy = y) => { const q = g.createRadialGradient(fx, fy, r * .05, x, y, r); stops.forEach((c, i) => q.addColorStop(i / (stops.length - 1), c)); return q; };
  const whaleSprite = () => sprite('whale', 150, 62, g => {
    g.translate(66, 30); const L = 120;
    const body = () => { g.beginPath(); g.moveTo(-L * .5, 0); g.bezierCurveTo(-L * .5, -L * .22, L * .25, -L * .2, L * .42, -L * .03);
      g.lineTo(L * .62, -L * .14); g.quadraticCurveTo(L * .6, -L * .04, L * .56, 0); g.quadraticCurveTo(L * .6, L * .05, L * .64, L * .12); g.lineTo(L * .42, L * .03);
      g.bezierCurveTo(L * .2, L * .17, -L * .45, L * .2, -L * .5, 0); g.closePath(); };
    body(); g.fillStyle = grad(g, 0, -L * .2, 0, L * .18, ['#5c7cb0', '#7f9fcc', '#a8c2e2', '#dfe8f4']); g.fill();
    g.save(); body(); g.clip();
    g.fillStyle = radial(g, -L * .1, L * .2, L * .5, ['rgba(40,60,110,.35)', 'rgba(40,60,110,0)']); g.fillRect(-L, -L, L * 2, L * 2);
    g.fillStyle = grad(g, 0, L * .02, 0, L * .2, ['rgba(236,242,250,0)', 'rgba(236,242,250,.95)']); g.beginPath(); g.ellipse(-L * .12, L * .12, L * .36, L * .09, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,150,190,.5)'; g.lineWidth = .8; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(-L * (.42 - k * .06), L * .08); g.quadraticCurveTo(-L * (.38 - k * .06), L * .13, -L * (.33 - k * .06), L * .17); g.stroke(); }
    g.fillStyle = 'rgba(230,238,250,.55)'; for (const [x, y, r] of [[-.4, -.1, 1.4], [-.36, -.14, 1], [-.31, -.11, 1.2], [-.44, -.05, .9]]) { g.beginPath(); g.arc(L * x, L * y, r, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(235,244,255,.7)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-L * .46, -L * .1); g.bezierCurveTo(-L * .38, -L * .2, L * .1, -L * .19, L * .3, -L * .07); g.stroke();
    g.fillStyle = grad(g, -L * .1, L * .08, L * .05, L * .2, ['rgba(110,140,190,.9)', 'rgba(150,180,220,.55)']); g.beginPath(); g.ellipse(-L * .06, L * .14, L * .13, L * .035, .5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#26304a'; g.beginPath(); g.arc(-L * .36, -L * .02, 1.7, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-L * .365, -L * .028, .55, 0, Math.PI * 2); g.fill();
  });
  const BALLOON = [['#ff7a6b', '#ffe3a3'], ['#7fc8ff', '#ffffff'], ['#b98cf2', '#ffd36a'], ['#6fd59b', '#fff2c4'], ['#ffb347', '#e8484f']];
  const balloonSprite = i => sprite('balloon' + i, 32, 50, g => {
    g.translate(16, 15); const [c1, c2] = BALLOON[i];
    const env = () => { g.beginPath(); g.moveTo(0, -14); g.bezierCurveTo(15, -14, 15, 6, 4, 13); g.lineTo(-4, 13); g.bezierCurveTo(-15, 6, -15, -14, 0, -14); g.closePath(); };
    g.save(); env(); g.clip();
    for (let j = -4; j <= 4; j++) { g.fillStyle = (j + 8) % 2 ? c1 : c2; g.beginPath(); g.moveTo(0, -15); g.quadraticCurveTo(j * 3.6 - 1.8, -2, j * .9 - .45, 14); g.lineTo(j * .9 + .45, 14); g.quadraticCurveTo(j * 3.6 + 1.8, -2, 0, -15); g.fill(); }
    g.fillStyle = radial(g, -4, -6, 18, ['rgba(255,255,255,.5)', 'rgba(255,255,255,.1)', 'rgba(255,255,255,0)']); g.fillRect(-16, -16, 32, 32);
    g.fillStyle = radial(g, 2, -1, 17, ['rgba(40,20,50,0)', 'rgba(40,20,50,0)', 'rgba(40,20,50,.38)']); g.fillRect(-16, -16, 32, 32);
    g.restore();
    g.fillStyle = grad(g, -4, 13, 4, 13, ['#8a5a3b', '#5c3a22']); g.beginPath(); g.moveTo(-4, 13); g.lineTo(4, 13); g.lineTo(3, 16); g.lineTo(-3, 16); g.fill();
    g.strokeStyle = 'rgba(90,64,44,.75)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-3, 16); g.lineTo(-3, 22); g.moveTo(3, 16); g.lineTo(3, 22); g.stroke();
    g.fillStyle = grad(g, 0, 22, 0, 27, ['#c08a54', '#7a5232']); g.beginPath(); g.roundRect(-3.8, 22, 7.6, 5, 1); g.fill();
    g.strokeStyle = 'rgba(70,44,24,.5)'; g.lineWidth = .35; for (const y of [23.6, 25.2]) { g.beginPath(); g.moveTo(-3.6, y); g.lineTo(3.6, y); g.stroke(); }
  });
  const lanternSprite = n => sprite('lantern' + n, 10, 13, g => {
    g.translate(5, 6.5); const r = 3 + n;
    g.scale(r / 5, r / 5);
    g.fillStyle = radial(g, 0, .5, 6, ['#fff6c8', '#ffcf6a', '#f08a34', '#c2561c'], -.6, -.4); g.beginPath(); g.moveTo(-2.4, -5); g.quadraticCurveTo(-4.6, 0, -2.6, 5); g.lineTo(2.6, 5); g.quadraticCurveTo(4.6, 0, 2.4, -5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(150,60,20,.35)'; g.lineWidth = .3; for (const x of [-1.4, 0, 1.4]) { g.beginPath(); g.moveTo(x * .9, -5); g.quadraticCurveTo(x * 1.7, 0, x * .9, 5); g.stroke(); }
    g.fillStyle = '#7a3a14'; g.fillRect(-2.6, -5.6, 5.2, 1); g.fillRect(-2.8, 4.6, 5.6, 1);
  });
  const moonSprite = () => sprite('moon', 20, 20, g => {
    g.translate(10, 10);
    g.fillStyle = radial(g, 0, 0, 7.5, ['#fffdf4', '#f1ebd6', '#d9d0b4'], -2, -2); g.beginPath(); g.arc(0, 0, 7.5, 0, Math.PI * 2); g.fill();
    for (const [x, y, r] of [[-2.4, -1.5, 1.6], [2, 1.8, 1.2], [1.2, -3, .8], [-1, 3.4, .9], [3.6, -1, .6]]) {
      g.fillStyle = 'rgba(176,168,146,.5)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,248,.5)'; g.beginPath(); g.arc(x + r * .3, y + r * .3, r * .6, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = radial(g, -3, -3, 12, ['rgba(40,40,70,0)', 'rgba(40,40,70,0)', 'rgba(40,40,70,.3)']); g.beginPath(); g.arc(0, 0, 7.5, 0, Math.PI * 2); g.fill();
  });
  const CRYSTAL = [['#d6fff6', '#6ff5d6', '#2fb79c', '#17806b'], ['#f0e6ff', '#c8a8ff', '#8f62e0', '#5a36a8'], ['#ffe4f4', '#ff9fd2', '#d0609e', '#8e3a6a']];
  const crystalSprite = hue => sprite('crystal' + hue, 24, 22, g => {
    g.translate(12, 21); const C = CRYSTAL[hue];
    for (const [dx, h, w] of [[-5, 12, 3], [5, 10, 2.8], [0, 19, 3.8]]) {
      g.fillStyle = grad(g, dx - w, 0, dx, -h * .5, [C[0], C[1]]); g.beginPath(); g.moveTo(dx - w, 0); g.lineTo(dx - w * .45, -h * .8); g.lineTo(dx, -h); g.lineTo(dx + w * .1, 0); g.fill();
      g.fillStyle = grad(g, dx, -h, dx + w, 0, [C[2], C[3]]); g.beginPath(); g.moveTo(dx + w * .1, 0); g.lineTo(dx, -h); g.lineTo(dx + w * .5, -h * .76); g.lineTo(dx + w, 0); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .35; g.beginPath(); g.moveTo(dx - w, 0); g.lineTo(dx - w * .45, -h * .8); g.lineTo(dx, -h); g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(-.6, -15, .5, 0, Math.PI * 2); g.fill();
  });
  function drawWonder() {
    const span = REGION * CW * TS, centre = cam + viewW / 2, region = Math.floor(centre / span), id = regionWonder(region);
    if (!id) return;
    const prog = centre / span - region, a = clamp(0, Math.min(prog / .12, (1 - prog) / .12), 1);
    if (a <= 0) return;
    const W = cv.width, bandH = VIEW_H * S, t = frameNo, s = S;
    ctx.save(); ctx.globalAlpha = a;
    if (id === 'whale') {
      const L = 120 * s, x = W + L - ((t * .45 * s) % (W + L * 2.4)), y = oy + bandH * .2 + Math.sin(t * .008) * 5 * s;
      ctx.save(); ctx.globalAlpha = a * .9; ctx.translate(x, y); ctx.rotate(Math.cos(t * .008) * .025); ctx.drawImage(whaleSprite(), -66 * s, -30 * s, 150 * s, 62 * s); ctx.restore();
      const sp = (t % 420) / 420;
      if (sp < .3) { ctx.fillStyle = `rgba(255,255,255,${.7 * (1 - sp / .3)})`; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x - L * .3 + (k - 2) * 4 * s * sp * 4, y - L * .2 - sp * 50 * s - Math.abs(k - 2) * 3 * s, (2.5 + sp * 6) * s, 0, 7); ctx.fill(); } }
    } else if (id === 'lanterns') {
      for (let i = 0; i < 28; i++) {
        const rise = (t * .22 * s + i * 61 * s) % (bandH * 1.25), y = oy + bandH * 1.05 - rise, x = ((i * 137.5 * s - cam * s * .2) % (W + 40) + W + 40) % (W + 40) - 20 + Math.sin(t * .02 + i) * 6 * s;
        const r = (3 + i % 3) * s, fade = Math.min(1, rise / (bandH * .2), (bandH * 1.25 - rise) / (bandH * .25));
        ctx.globalAlpha = a * fade;
        blob(x, y, r * 3.2, '#ffbe5a', .6 * a * fade); ctx.globalAlpha = a * fade;
        ctx.drawImage(lanternSprite(i % 3), x - 5 * s, y - 6.5 * s, 10 * s, 13 * s);
      }
    } else if (id === 'balloons') {
      for (let i = 0; i < 5; i++) {
        const k = (.6 + (i % 3) * .25) * s, x = ((i * W / 5 + t * .14 * s - cam * s * .08 * (1 + i % 3)) % (W + 200 * s) + W + 200 * s) % (W + 200 * s) - 100 * s, y = oy + bandH * (.12 + (i % 3) * .09) + Math.sin(t * .01 + i) * 6 * s;
        ctx.globalAlpha = a * (.75 + .25 * (i % 3) / 2);   // the farther ones a little hazier
        ctx.drawImage(balloonSprite(i), x - 16 * k, y - 15 * k, 32 * k, 50 * k);
      }
    } else if (id === 'meteors') {
      ctx.fillStyle = '#fffbea';
      for (let i = 0; i < 24; i++) { ctx.globalAlpha = a * (.25 + .25 * Math.sin(t * .05 + i * 1.7)); ctx.beginPath(); ctx.arc((i * 211 % 997) / 997 * W, oy + bandH * ((i * 73 % 40) / 100), 1.2 * s * .6, 0, 7); ctx.fill(); }
      for (let k = 0; k < 3; k++) {
        const per = 240 + k * 70, u = ((t + k * 97) % per) / per;
        if (u > .22) continue;
        const p = u / .22, x0 = W * (.45 + .2 * k) - p * 200 * s, y0 = oy + bandH * (.06 + .06 * k) + p * 80 * s;
        ctx.globalAlpha = a * Math.sin(p * Math.PI);
        const g = ctx.createLinearGradient(x0, y0, x0 + 60 * s, y0 - 24 * s); g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + 60 * s, y0 - 24 * s); ctx.stroke();
      }
    } else if (id === 'aurora') {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k === 1 ? 'rgba(180,120,255,.16)' : 'rgba(110,255,190,.16)'; ctx.lineWidth = (24 - k * 5) * s;
        ctx.beginPath();
        for (let x = -20; x <= W + 20; x += 18) { const y = oy + bandH * (.1 + k * .05) + Math.sin(x / s * .02 + t * .012 + k * 2) * 12 * s + Math.sin(x / s * .007 - t * .006) * 8 * s; x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  /* ---------------- discoveries ----------------
     The first time a set piece or a wonder comes into view, a small card
     names it. What has been found is remembered on this device. */
  const FINDS = {
    ferry: ['Drift ferry', 'Ride it across the gap'], lift: ['Lift', 'Ride it up to the high ledge'], crumble: ['Crumble bridge', 'Keep moving: it won’t hold'],
    stairs: ['Floating steps', 'Hop up, stone by stone'], spitter: ['Podspitter', 'Jump its seed pods, or stomp them'],
    whale: ['A sky whale', 'Look up'], lanterns: ['Lantern rise', 'Look up'], balloons: ['Balloon drift', 'Look up'], meteors: ['Meteor shower', 'Look up'], aurora: ['Aurora', 'Look up']
  };
  let seen = null, card = null;
  function discover(id) {
    seen = seen || new Set(store.get('pip-run:seen') || []);
    if (seen.has(id) || card || chapter) return;
    seen.add(id); store.set('pip-run:seen', [...seen]); card = {id, t: 0}; sfx('find');
  }
  function drawCard() {
    if (!card || replay) return;
    const [name, sub] = FINDS[card.id], a = Math.min(1, card.t / 20, (300 - card.t) / 30), u = Math.max(12, 8 * S);
    const y = Math.max(oy + u * 3.4, 86 * dpr), found = `${seen.size} of ${Object.keys(FINDS).length} found`;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textBaseline = 'middle';
    ctx.font = `700 ${u}px system-ui,-apple-system,sans-serif`; const nw = ctx.measureText(name).width;
    ctx.font = `500 ${u * .78}px system-ui,-apple-system,sans-serif`; const sw = ctx.measureText(`${sub} · ${found}`).width;
    const pill = u * 3.2, w = Math.max(nw + pill, sw) + u * 2, x = cv.width / 2 - w / 2, h = u * 3.1;
    const [px, py] = W2D(pl.x - 8, pl.y - 14);   // never hide Pip: fade back while he is under the card
    if (px < x + w && px + 28 * S > x && py < y + h && py + 40 * S > y) ctx.globalAlpha *= .25;
    ctx.fillStyle = 'rgba(24,46,56,.72)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, u * .7); ctx.fill();
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.roundRect(x + u, y + u * .45, u * 2.6, u * 1.1, u * .55); ctx.fill();
    ctx.fillStyle = '#3b2a10'; ctx.font = `800 ${u * .62}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'center'; ctx.fillText('NEW', x + u * 2.3, y + u);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fffbea'; ctx.font = `700 ${u}px system-ui,-apple-system,sans-serif`; ctx.fillText(name, x + u + pill, y + u);
    ctx.fillStyle = '#d9ecf0'; ctx.font = `500 ${u * .78}px system-ui,-apple-system,sans-serif`; ctx.fillText(`${sub} · ${found}`, x + u, y + u * 2.15);
    ctx.restore();
  }
  /* ---------------- landmarks and title cards ----------------
     The next region's landmark rises on the horizon and grows as Pip nears it. */
  /* The four landmarks are painted once, large, each into its own canvas: lit
     from the upper left, shaded and textured, standing on a little ground of
     their own. They are drawn at whatever size they stand at (on the horizon,
     full size on the plaza, tiny in the phone console); only their glow and
     sparkle move. Units: x -65..65, y up from the ground (negative in canvas). */
  const LM = {u: 4, w: 130, h: 175, foot: 12};
  let lmCache = {};
  function landmarkSprite(id) {
    const key = id + (propsImg.naturalWidth ? '+' : '');
    if (lmCache[key]) return lmCache[key];
    const U = LM.u, c2 = document.createElement('canvas'); c2.width = LM.w * U; c2.height = LM.h * U;
    const g = c2.getContext('2d'); g.setTransform(U, 0, 0, U, LM.w / 2 * U, (LM.h - LM.foot) * U); g.lineCap = 'round'; g.lineJoin = 'round';
    const lin = (x0, y0, x1, y1, stops) => { const q = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => q.addColorStop(i / (stops.length - 1), c)); return q; };
    const rad = (x, y, r, stops, fx = x, fy = y) => { const q = g.createRadialGradient(fx, fy, r * .05, x, y, r); stops.forEach((c, i) => q.addColorStop(i / (stops.length - 1), c)); return q; };
    const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
    const glint = (x, y, r) => { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y - r * .25); g.lineTo(x + r, y); g.lineTo(x, y + r * .25); g.moveTo(x, y - r); g.lineTo(x + r * .25, y); g.lineTo(x, y + r); g.lineTo(x - r * .25, y); g.fill(); };
    if (id === 'meadow') {                   // Mushroom Gate: two giant mushrooms and a flowering arch
      g.fillStyle = lin(0, -6, 0, 8, ['#8cc95e', '#4f8f3a', '#3a6d2b']); g.beginPath(); g.ellipse(0, 2, 62, 9, 0, 0, Math.PI * 2); g.fill();
      for (const sd of [-1, 1]) {
        const cx = sd * 34;
        g.fillStyle = rad(cx, 0, 16, ['rgba(30,40,20,.35)', 'rgba(30,40,20,0)']); g.fillRect(cx - 18, -6, 36, 10);
        g.fillStyle = lin(cx - 10, 0, cx + 10, 0, ['#fff7e8', '#efe0c4', '#d6c2a0', '#a8916f']);
        g.beginPath(); g.moveTo(cx - 11, 0); g.quadraticCurveTo(cx - 6.5, -35, cx - 7.5, -70); g.lineTo(cx + 7.5, -70); g.quadraticCurveTo(cx + 6.5, -35, cx + 11, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(160,130,95,.35)'; g.lineWidth = .5; for (const dx of [-3, 1.5, 5]) { g.beginPath(); g.moveTo(cx + dx * 1.4, -2); g.quadraticCurveTo(cx + dx, -35, cx + dx * .9, -66); g.stroke(); }
        g.fillStyle = lin(0, -61, 0, -54, ['#fff8ea', '#e2cfaf']); g.beginPath(); g.ellipse(cx, -58, 11, 3.6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = rad(cx, -70, 28, ['#c9ab86', '#f2e3c8', '#e6d2b0'], cx, -66); g.beginPath(); g.ellipse(cx, -70, 29, 6.5, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(150,115,80,.45)'; g.lineWidth = .45; for (let a = 0; a < Math.PI * 2; a += .26) { g.beginPath(); g.moveTo(cx + Math.cos(a) * 9, -70 + Math.sin(a) * 2); g.lineTo(cx + Math.cos(a) * 27, -70 + Math.sin(a) * 6); g.stroke(); }
        g.fillStyle = rad(cx, -72, 38, ['#ffb08f', '#ee6448', '#d3432f', '#9b2a19'], cx - 11, -88); g.beginPath(); g.ellipse(cx, -72, 31, 21, 0, Math.PI, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(110,30,18,.5)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, -72, 30.5, 2.2, 0, 0, Math.PI); g.stroke();
        for (const [dx, dy, r] of [[-17, -78, 4.2], [-3, -88, 5], [12, -82, 4.4], [22, -76, 2.8], [-25, -74, 2.4], [5, -76, 2.6], [-11, -90, 2.4]]) {
          const sq = 1 - Math.abs(dx) / 34 * .55;
          g.fillStyle = 'rgba(120,30,20,.3)'; g.beginPath(); g.ellipse(cx + dx * sd + .5, dy + .6, r * sq, r * .78, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = rad(cx + dx * sd, dy, r, ['#ffffff', '#fbefdc', '#e8d2b6'], cx + dx * sd - r * .3, dy - r * .35); g.beginPath(); g.ellipse(cx + dx * sd, dy, r * sq, r * .78, 0, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = 'rgba(255,235,220,.35)'; g.beginPath(); g.ellipse(cx - 12, -86, 10, 4, -.35, 0, Math.PI * 2); g.fill();
      }
      // The arch: a vine with leaves and flowers, and a lantern hanging from it.
      const arc = t => [-30 * (1 - t) * (1 - t) + 30 * t * t, (-60) * (1 - t) * (1 - t) + 2 * t * (1 - t) * (-104) + (-60) * t * t];
      g.strokeStyle = lin(0, -95, 0, -60, ['#6fb04a', '#3f7d2f']); g.lineWidth = 3.4; g.beginPath(); for (let t = 0; t <= 1.001; t += .05) { const [x, y] = arc(t); t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      for (let t = .04, i = 0; t < .98; t += .075, i++) {
        const [x, y] = arc(t), [x2, y2] = arc(t + .01), an = Math.atan2(y2 - y, x2 - x) + (i % 2 ? 1 : -1) * 1.1;
        g.save(); g.translate(x, y); g.rotate(an); g.fillStyle = lin(0, -2, 0, 2, ['#9fdc6a', '#4c9a3a']); g.beginPath(); g.ellipse(3.2, 0, 3.6, 1.6, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(40,90,30,.6)'; g.lineWidth = .3; g.beginPath(); g.moveTo(0, 0); g.lineTo(6, 0); g.stroke(); g.restore();
        if (i % 3 === 1) { g.fillStyle = ['#f6a8c4', '#ffe08a', '#ffffff'][i % 3]; for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.26) * 1.3, y + 2 + Math.sin(p * 1.26) * 1.3, .9, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#e8a020'; g.beginPath(); g.arc(x, y + 2, .6, 0, Math.PI * 2); g.fill(); }
      }
      g.strokeStyle = '#5a4a3a'; g.lineWidth = .4; g.beginPath(); g.moveTo(0, -82); g.lineTo(0, -90); g.stroke();
      g.fillStyle = '#6b3d1c'; g.fillRect(-3, -83, 6, 1.4); g.fillRect(-2.6, -73.4, 5.2, 1.2);
      g.fillStyle = rad(0, -78, 5, ['#fff6c4', '#ffcf5a', '#e8892a'], -1, -79.5); g.beginPath(); g.roundRect(-3.4, -81.8, 6.8, 8.6, 2.2); g.fill();
    } else if (id === 'frost') {              // Frost Spire: a faceted spire of ice among shards, in snow
      const shard = (x, h, w, tip = 0) => {
        poly([[x - w, 0], [x - w * .55 + tip, -h * .72], [x + tip, -h], [x + w * .1, 0]], lin(x - w, 0, x + w * .2, -h * .5, ['#f6fcff', '#d2ecfb', '#b6dcf4']));
        poly([[x + w * .1, 0], [x + tip, -h], [x + w * .55 + tip, -h * .72], [x + w, 0]], lin(x, -h, x + w, 0, ['#a8d4f2', '#6fa8d6', '#4f86b8']));
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = .7; g.beginPath(); g.moveTo(x - w, 0); g.lineTo(x - w * .55 + tip, -h * .72); g.lineTo(x + tip, -h); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = .45; g.beginPath(); g.moveTo(x + tip, -h); g.lineTo(x + w * .1, 0); g.stroke();
      };
      g.fillStyle = rad(0, -70, 60, ['rgba(200,236,255,.6)', 'rgba(200,236,255,0)']); g.fillRect(-65, -140, 130, 140);
      for (const [x, h, w, tip] of [[-44, 30, 6, -2], [-28, 58, 8, -3], [42, 36, 6, 2], [27, 70, 9, 2]]) shard(x, h, w, tip);
      shard(0, 150, 19, 0);
      g.fillStyle = rad(0, -70, 26, ['rgba(220,248,255,.55)', 'rgba(150,215,250,.15)', 'rgba(150,215,250,0)']); g.fillRect(-26, -100, 52, 60);
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = .4; g.beginPath(); g.moveTo(-6, -40); g.lineTo(-2, -62); g.lineTo(-7, -80); g.moveTo(5, -96); g.lineTo(2, -112); g.stroke();
      g.fillStyle = lin(0, -9, 0, 9, ['#ffffff', '#e4eef9', '#b8cde6']);
      g.beginPath(); g.moveTo(-62, 6); g.quadraticCurveTo(-50, -10, -32, -4); g.quadraticCurveTo(-18, -12, -2, -5); g.quadraticCurveTo(14, -12, 30, -4); g.quadraticCurveTo(50, -11, 62, 6); g.closePath(); g.fill();
      for (const [x, y, r] of [[-12, -124, 3], [7, -86, 2.2], [-30, -50, 1.8], [30, -60, 2], [44, -24, 1.6]]) glint(x, y, r);
    } else if (id === 'sky') {                // Sky Harbor: a floating island with a pier and a docked airship
      g.fillStyle = lin(0, -32, 0, 24, ['#c9bff0', '#9a8bd2', '#6a5aa8', '#4c3f86']);
      g.beginPath(); g.moveTo(-54, -30); g.quadraticCurveTo(-46, -8, -26, 4); g.quadraticCurveTo(-10, 26, 2, 22); g.quadraticCurveTo(20, 18, 30, 2); g.quadraticCurveTo(48, -10, 54, -30); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,236,190,.35)'; g.lineWidth = .6; for (const y of [-20, -10, 0]) { g.beginPath(); g.moveTo(-46 + (y + 30) * .5, y); g.quadraticCurveTo(0, y + 5, 46 - (y + 30) * .5, y - 1); g.stroke(); }
      g.strokeStyle = 'rgba(236,186,92,.6)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-20, -6); g.bezierCurveTo(-8, 0, 4, -10, 18, -2); g.stroke();
      for (const [x, y, r] of [[-30, 2, 9], [-12, 12, 10], [8, 14, 9], [26, 4, 8], [-44, -12, 7], [42, -10, 7]]) { g.fillStyle = rad(x, y, r, ['rgba(255,255,255,.95)', 'rgba(240,236,252,.8)', 'rgba(220,214,244,0)'], x - r * .3, y - r * .4); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = lin(0, -38, 0, -26, ['#b8e88a', '#7cc45a', '#4f9a3c']); g.beginPath(); g.ellipse(0, -31, 55, 7, 0, 0, Math.PI * 2); g.fill();
      if (propsImg.naturalWidth) for (const [x, sc] of [[-36, .26], [-22, .2]]) { const spr = propSprite('oak', 'sky', 1), w = spr.width * sc, h = spr.height * sc; g.drawImage(spr, x - w / 2, -31 - h + 2, w, h); }
      g.fillStyle = lin(0, -38, 0, -34, ['#a87048', '#6b4228']); g.fillRect(22, -38.5, 40, 3);
      g.fillStyle = '#5a3a22'; for (const x of [26, 40, 54]) g.fillRect(x, -36, 1.6, 10);
      // The airship: a shaded envelope with seams, fins, a gondola with lit windows.
      const ax = 8, ay = -92;
      g.strokeStyle = '#6b4a34'; g.lineWidth = .7; g.beginPath(); for (const [x0, x1] of [[-12, -6], [8, 6], [26, 20]]) { g.moveTo(ax + x0, ay + 10); g.lineTo(ax + x1, ay + 20); } g.stroke();
      poly([[ax - 30, ay - 2], [ax - 42, ay - 13], [ax - 38, ay - 1], [ax - 42, ay + 10]], lin(ax - 42, ay - 13, ax - 30, ay + 10, ['#f2c27a', '#c47a32']));
      g.fillStyle = rad(ax, ay, 36, ['#fff2d6', '#f7c27c', '#e08e45', '#a85a22'], ax - 10, ay - 8); g.beginPath(); g.ellipse(ax, ay, 34, 14, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(140,70,25,.35)'; g.lineWidth = .5; for (const k of [-.6, -.2, .2, .6]) { g.beginPath(); g.ellipse(ax + k * 12, ay, 34 * (1 - Math.abs(k) * .5), 14, 0, -Math.PI / 2, Math.PI / 2, k < 0); g.stroke(); }
      g.strokeStyle = 'rgba(140,70,25,.3)'; g.beginPath(); g.moveTo(ax - 34, ay); g.lineTo(ax + 34, ay); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(ax - 9, ay - 8, 15, 3.2, -.08, 0, Math.PI * 2); g.fill();
      g.fillStyle = lin(0, ay + 19, 0, ay + 28, ['#b57a4a', '#7a4a28', '#5a3418']); g.beginPath(); g.roundRect(ax - 10, ay + 19, 34, 9, 2.5); g.fill();
      g.fillStyle = '#ffd98a'; for (const x of [-6, 2, 10, 18]) { g.beginPath(); g.roundRect(ax + x, ay + 21.5, 4, 3, .8); g.fill(); }
      g.fillStyle = '#4a2e18'; g.fillRect(ax - 13, ay + 21, 3, 4); g.fillStyle = 'rgba(220,220,230,.8)'; g.beginPath(); g.ellipse(ax - 13.5, ay + 23, 1.2, 5, 0, 0, Math.PI * 2); g.fill();
    } else {                                   // Crystal Heart: a great faceted crystal among smaller ones
      g.fillStyle = lin(0, -6, 0, 10, ['#3a3156', '#1f1a30', '#120f1d']); g.beginPath(); g.ellipse(0, 3, 54, 10, 0, 0, Math.PI * 2); g.fill();
      const gem = (x, h, w, cols) => {
        poly([[x - w, 0], [x - w * .45, -h * .78], [x, -h], [x + w * .05, 0]], lin(x - w, -h * .5, x, -h * .5, [cols[0], cols[1]]));
        poly([[x + w * .05, 0], [x, -h], [x + w * .5, -h * .74], [x + w, 0]], lin(x, -h * .5, x + w, -h * .5, [cols[2], cols[3]]));
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .5; g.beginPath(); g.moveTo(x - w, 0); g.lineTo(x - w * .45, -h * .78); g.lineTo(x, -h); g.stroke();
      };
      const TEAL = ['#c8fff2', '#5fe8cc', '#2fb79c', '#1a7f6c'], PINK = ['#ffe0f2', '#ff9fd2', '#d0609e', '#8e3a6a'], VIO = ['#efe2ff', '#c4a2ff', '#8c5fe0', '#5a36a8'];
      for (const [x, h, w, c] of [[-44, 22, 5, PINK], [44, 26, 5, VIO], [-30, 36, 6.5, TEAL], [31, 44, 7, TEAL], [-17, 18, 4, PINK], [18, 20, 4, PINK]]) gem(x, h, w, c);
      g.fillStyle = rad(0, -62, 46, ['rgba(232,210,255,.55)', 'rgba(200,150,255,.18)', 'rgba(200,150,255,0)']); g.fillRect(-50, -120, 100, 110);
      poly([[0, -122], [-23, -62], [-4, -66]], lin(-20, -110, 0, -64, ['#f4ecff', '#d6bfff']));
      poly([[0, -122], [-4, -66], [23, -62]], lin(0, -110, 20, -64, ['#c9a6ff', '#9b6ef0']));
      poly([[-23, -62], [0, 0], [-4, -66]], lin(-22, -60, -2, -10, ['#c7a7ff', '#8f62e0']));
      poly([[-4, -66], [0, 0], [23, -62]], lin(0, -60, 20, -10, ['#7d50cf', '#4e2c96']));
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .7; g.beginPath(); g.moveTo(-23, -62); g.lineTo(0, -122); g.lineTo(23, -62); g.moveTo(-4, -66); g.lineTo(0, -122); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-23, -62); g.lineTo(-4, -66); g.lineTo(23, -62); g.moveTo(-4, -66); g.lineTo(0, 0); g.stroke();
      for (const [x, y, r] of [[-8, -100, 2.6], [10, -58, 1.8], [-30, -30, 1.6]]) glint(x, y, r);
    }
    return (lmCache[key] = c2);
  }
  function landmarkArt(id, s, t) {
    const bob = id === 'sky' ? Math.sin(t * .03) * 3 * s : 0;
    if (id === 'caves') blob(0, -62 * s, 72 * s, '#c896ff', .35 + .25 * Math.sin(t * .06));   // the heart's glow, behind it
    ctx.drawImage(landmarkSprite(id), -LM.w / 2 * s, -(LM.h - LM.foot) * s - bob, LM.w * s, LM.h * s);
    if (id === 'meadow') blob(0, -78 * s, 12 * s, '#ffd66e', .45 + .25 * Math.sin(t * .1));   // the lantern
    else if (id === 'frost') blob(-12 * s, -124 * s, 6 * s, '#ffffff', .4 + .5 * Math.max(0, Math.sin(t * .07)));
  }
  function drawLandmark(m) {
    const span = REGION * CW * TS, lx = (m.region + 1) * span, dist = lx - m.centre;
    if (dist > span * .92 || dist < 420) return;
    const near = 1 - Math.max(0, dist) / span, x = (viewW * .66 + dist * .1) * S, y = oy + VIEW_H * S * .8;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .9 * Math.min(1, (span * .92 - dist) / 300) * Math.min(1, (dist - 420) / 260);
    landmarkArt(regionBiome(m.region + 1), (.45 + .65 * near) * S, frameNo);
    ctx.restore();
  }
  // The destination itself, full size and standing on the plaza.
  function drawDestination() {
    const span = REGION * CW * TS, r0 = Math.floor((cam + viewW / 2) / span);
    for (const r of [r0 - 1, r0]) {
      const gx = gateX(r), [x] = W2D(gx + 8, 0);
      if (r < 0 || x < -200 * S || x > cv.width + 200 * S) continue;
      const tx = Math.floor((gx + 8) / TS); let gy = 4; while (gy < ROWS && !solid(tx, gy)) gy++;
      ctx.save(); ctx.translate(x, W2D(0, gy * TS)[1]); landmarkArt(regionBiome(r + 1), S * .95, frameNo); ctx.restore();
    }
  }
  function drawChapter() {
    if (!chapter || replay) return;
    const c = chapter, a = Math.max(0, Math.min(1, c.t / 20, (240 - c.t) / 30)), u = Math.max(13, 8.5 * S);
    if (a <= 0) return;
    const lines = [
      [`CHAPTER ${c.num} · ${c.done.toUpperCase()}`, 700, .62, '#ffd36a'],
      [`${c.mark} reached`, 800, 1.45, '#fffbea'],
      [`★ ${c.seeds} seeds   ·   ${clock(c.time)}   ·   ${c.tumbles} ${c.tumbles === 1 ? 'tumble' : 'tumbles'}${c.finds ? `   ·   ${c.finds} new ${c.finds === 1 ? 'find' : 'finds'}` : ''}`, 600, .8, '#e6f2f2'],
      ...(c.vs ? [[c.vs, 600, .74, '#cfe9ff']] : []),
      [`Next: ${c.next} — ${c.sub}`, 500, .74, '#d9ecf0']
    ];
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let w = 0; for (const [t, wt, k] of lines) { ctx.font = `${wt} ${u * k}px system-ui,-apple-system,sans-serif`; w = Math.max(w, ctx.measureText(t).width); }
    const h = lines.reduce((q, l) => q + u * l[2] * 1.55, 0) + u * 1.4, x = cv.width / 2, y = Math.max(oy + VIEW_H * S * .2, 80 * dpr);
    ctx.fillStyle = 'rgba(22,42,52,.74)'; ctx.beginPath(); ctx.roundRect(x - w / 2 - u * 1.4, y, w + u * 2.8, h, u * .9); ctx.fill();
    let yy = y + u * .7;
    for (const [t, wt, k, col] of lines) { ctx.font = `${wt} ${u * k}px system-ui,-apple-system,sans-serif`; yy += u * k * .78; ctx.fillStyle = col; ctx.fillText(t, x, yy); yy += u * k * .77; }
    ctx.restore();
  }
  let title = null, lastRegion = -1;
  function drawTitle() {
    if (!title || replay) return;
    const a = Math.min(1, title.t / 25, (210 - title.t) / 35), B = BIOMES[title.id], u = Math.max(14, 11 * S), y = oy + VIEW_H * S * .3;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${u * 1.5}px system-ui,-apple-system,sans-serif`; ctx.fillStyle = 'rgba(20,28,40,.55)'; ctx.fillText(B.name, cv.width / 2 + 2, y + 2); ctx.fillStyle = '#fffbea'; ctx.fillText(B.name, cv.width / 2, y);
    ctx.font = `500 ${u * .8}px system-ui,-apple-system,sans-serif`; ctx.fillStyle = 'rgba(20,28,40,.55)'; ctx.fillText(B.sub, cv.width / 2 + 1, y + u * 1.3 + 1); ctx.fillStyle = '#fffbea'; ctx.fillText(B.sub, cv.width / 2, y + u * 1.3);
    ctx.restore();
  }
  // Weather belongs to the biome: snow, wind streaks or drifting motes.
  function drawWeather(m) {
    const W = cv.width, H = cv.height;
    for (const id of [m.a, m.b]) {
      const w = weightOf(m, id); if (w < .02) continue;
      ctx.save(); ctx.globalAlpha = w;
      if (id === 'frost') { ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 46; i++) { const x = ((i * 97.3 + frameNo * (.35 + i % 3 * .15) + Math.sin(frameNo * .02 + i) * 12 - cam * S * .4) % W + W) % W, y = ((i * 53.1 + frameNo * (.9 + i % 4 * .3)) % H); ctx.beginPath(); ctx.arc(x, y, (1 + i % 3 * .5) * S * .45, 0, 7); ctx.fill(); } }
      else if (id === 'sky') { const dirw = Math.sign(windAt(m.centre)) || 1; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, S * .3); for (let i = 0; i < 14; i++) { const x = ((i * 211 + dirw * frameNo * (6 + i % 3 * 2)) % (W + 300) + W + 300) % (W + 300) - 150, y = oy + VIEW_H * S * ((i * 37 % 80) / 100 + .05); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dirw * 40 * S * .4, y); ctx.stroke(); } }
      else if (id === 'caves') { for (let i = 0; i < 22; i++) { const x = ((i * 157 + Math.sin(frameNo * .01 + i) * 40 - cam * S * .5) % W + W) % W, y = oy + VIEW_H * S * ((i * 41 % 90) / 100) + Math.sin(frameNo * .015 + i * 2) * 10, a = .3 + .3 * Math.sin(frameNo * .05 + i); ctx.fillStyle = `rgba(160,255,230,${a.toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, S * .5, 0, 7); ctx.fill(); } }
      ctx.restore();
    }
  }
  // Light that ties the painted world together: a soft sun bloom and a
  // vignette, painted once small per biome and stretched over the stage.
  const LIGHT = {meadow: [.1, -.1, '255,226,170', '84,60,40'], frost: [.78, .05, '255,252,240', '64,86,128'], sky: [.2, -.05, '255,240,204', '84,86,146']};
  let lightCache = {};
  function lightLayer(id) {
    const w = Math.max(16, Math.round(cv.width / 4)), h = Math.max(16, Math.round(VIEW_H * S / 4)), key = w + 'x' + h;
    if (lightCache[id] && lightCache[id].key === key) return lightCache[id].c;
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    const g = c2.getContext('2d'), [sx, sy, sun, edge] = LIGHT[id], r = Math.max(w, h);
    const q = g.createRadialGradient(w * sx, h * sy, 0, w * sx, h * sy, r * .85); q.addColorStop(0, `rgba(${sun},.26)`); q.addColorStop(.45, `rgba(${sun},.08)`); q.addColorStop(1, `rgba(${sun},0)`);
    g.fillStyle = q; g.fillRect(0, 0, w, h);
    const v = g.createRadialGradient(w / 2, h * .42, Math.min(w, h) * .5, w / 2, h * .42, r * .78); v.addColorStop(0, `rgba(${edge},0)`); v.addColorStop(1, `rgba(${edge},.26)`);
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    lightCache[id] = {key, c: c2}; return c2;
  }
  function drawLight(m) {
    for (const id of new Set([m.a, m.b])) {
      const w = weightOf(m, id); if (w < .02 || !LIGHT[id]) continue;
      const d = dayAt(m.centre), a = w * (1 - d.night - d.dusk * .5); if (a < .08) continue;   // the sun's bloom goes with the sun
      ctx.globalAlpha = a; ctx.drawImage(lightLayer(id), 0, oy, cv.width, VIEW_H * S); ctx.globalAlpha = 1;
    }
  }
  // Caves are dark: Pip, crystals, seeds and star blocks carry light.
  let darkBuf = null;
  function drawCrystals() {
    for (const ch of chunks.values()) for (const k of ch.crystals) {
      const [x, y] = W2D(k.x, k.y); if (x < -40 || x > cv.width + 40) continue;
      blob(x, y + (k.up ? -9 : 9) * S, 16 * S, CRYSTAL[k.hue][1], .35);
      ctx.save(); ctx.translate(x, y); if (!k.up) ctx.scale(1, -1);
      ctx.drawImage(crystalSprite(k.hue), -12 * S, -21 * S, 24 * S, 22 * S); ctx.restore();
    }
  }
  function drawDarkness(m) {
    const w = weightOf(m, 'caves'); if (w < .02) return;
    if (!darkBuf || darkBuf.width !== cv.width || darkBuf.height !== cv.height) { darkBuf = document.createElement('canvas'); darkBuf.width = cv.width; darkBuf.height = cv.height; }
    const g = darkBuf.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = `rgba(4,5,14,${(.88 * w).toFixed(3)})`; g.fillRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => { const q = g.createRadialGradient(x, y, 0, x, y, r); q.addColorStop(0, `rgba(0,0,0,${a})`); q.addColorStop(.55, `rgba(0,0,0,${a * .7})`); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); };
    const [px, py] = W2D(pl.x + 6, pl.y + pl.h * .4); hole(px, py, (big ? 92 : 78) * S * (1 + .03 * Math.sin(frameNo * .12)));
    for (const ch of chunks.values()) { for (const k of ch.crystals) { const [x, y] = W2D(k.x, k.y + (k.up ? -8 : 8)); if (x > -60 && x < cv.width + 60) hole(x, y, 34 * S, .85); }
      for (const sd of ch.seeds) if (!sd.got) { const [x, y] = W2D(sd.x, sd.y); if (x > -20 && x < cv.width + 20) hole(x, y, 13 * S, .9); } }
    for (const it of items) { const [x, y] = W2D(it.x + 6, it.y + 6); hole(x, y, 26 * S); }
    for (const p of parts) if (p.glow) { const [x, y] = W2D(p.x, p.y); hole(x, y, 9 * S, .7 * Math.min(1, p.life / 14)); }
    for (const k of prints) { const age = frameNo - k.at; if (k.m === 'moss' && age >= 0 && age < PRINT_LIFE.moss) { const [x, y] = W2D(k.x, k.y); hole(x, y, 12 * S, .7 * (1 - age / PRINT_LIFE.moss)); } }
    ctx.drawImage(darkBuf, 0, 0);
    // Creature eyes glint in the dark.
    for (const e of enemies) { if (e.state === 'dead' || e.state === 'squash') continue; const [x, y] = W2D(e.x + 7, e.y + 5); if (x < -20 || x > cv.width + 20) continue; ctx.fillStyle = `rgba(255,240,170,${(.8 * w).toFixed(2)})`; for (const d of [-2.4, 2.4]) { ctx.beginPath(); ctx.arc(x + d * S, y, .9 * S, 0, 7); ctx.fill(); } }
  }
  function drawTiles() {
    const cd = camDev(), n = Math.round(TS * S), t0 = Math.floor(cam / TS) - 1, t1 = t0 + Math.ceil(viewW / TS) + 2;
    const c0 = Math.floor(t0 / CW), c1 = Math.floor(t1 / CW);
    chunk(c1 + 1);   // the next chunk exists before this one is painted, so their edges meet
    for (let ci = Math.max(0, c0); ci <= c1; ci++) { const ch = chunk(ci); if (ch) { const art = chunkArt(ch, n); ctx.drawImage(art.c, ox + (ci * CW - 1) * n - cd, oy + art.y0 * n); } }
    for (const ch of chunks.values()) if (ch.art && (ch.ci < c0 - 1 || ch.ci > c1 + 1)) ch.art = null;   // off screen: let it go
    for (let tx = t0; tx <= t1; tx++) for (let ty = 0; ty < ROWS; ty++) {
      let id = tileAt(tx, ty); if (!id || (tx >= 0 && STATIC.has(id))) continue;
      if (replay && id === USED && (usedAt.get(tx + ',' + ty) ?? -1) > frameNo) id = BLOCK;
      const b = bumps.find(q => q.tx === tx && q.ty === ty), lift = b ? Math.sin(b.t / 10 * Math.PI) * 4 * S : 0;
      const ch = chunks.get(Math.floor(tx / CW));
      const shake = id === CRUMBLE && crumbleFall.has(tx * 64 + ty) ? Math.sin(frameNo * 1.9 + tx) * .9 * S : 0;
      ctx.drawImage(tileCanvas(id, tileAt(tx, ty - 1) === EMPTY, ch ? ch.biome : 'meadow', hash(seed ^ 0xb21, tx * 16 + ty) % 3), ox + tx * n - cd + shake, oy + ty * n - lift);
      if (id === BLOCK) { const a = .25 + .25 * Math.sin(frameNo * .08 + tx); ctx.fillStyle = `rgba(255,255,230,${a.toFixed(3)})`; ctx.fillRect(ox + tx * n - cd + n * .12, oy + ty * n + n * .1 - lift, n * .76, n * .08); }
    }
  }
  const W2D = (x, y) => [ox + x * S - camDev(), oy + y * S];
  // Ferries and lifts, dressed for their biome. Lifts show their rails.
  let drawT = null;   // fractional tick time while drawing between ticks
  function drawMovers() {
    for (const ch of chunks.values()) for (const m of ch.movers) {
      const [mx, my] = moverAt(m, drawT ?? frameNo), [x, y] = W2D(mx, my), s = S, w = m.w * s, b = biomeAt(m.x);
      if (x > cv.width + 40 || x + w + m.ax * s < -40) continue;
      ctx.save();
      if (m.kind === 'lift') {
        const [, top] = W2D(0, m.y + m.ay - 30), [, bot] = W2D(0, m.y + 16);
        ctx.strokeStyle = 'rgba(70,56,40,.5)'; ctx.lineWidth = 1.4 * s;
        for (const dx of [3, m.w - 3]) { ctx.beginPath(); ctx.moveTo(x + dx * s, top); ctx.lineTo(x + dx * s, bot); ctx.stroke(); }
        ctx.fillStyle = '#7d6a55'; ctx.fillRect(x - 2 * s, top - 3 * s, w + 4 * s, 3 * s);
        ctx.fillStyle = '#c9b48f'; for (const dx of [3, m.w - 3]) { ctx.beginPath(); ctx.arc(x + dx * s, top - 1.5 * s, 2.6 * s, 0, 7); ctx.fill(); }
      }
      if (b === 'sky') {
        ctx.fillStyle = '#ffffff'; for (const [dx, dy, r] of [[6, 3, 6], [16, 1, 7.5], [26, 3, 6]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(178,190,232,.8)'; ctx.fillRect(x + 2 * s, y + 6 * s, w - 4 * s, 2 * s);
        ctx.fillStyle = '#ffd36a'; ctx.fillRect(x + 4 * s, y + 7.5 * s, w - 8 * s, 1.2 * s);
      } else {
        const [hi, lo, edge] = {meadow: ['#d9a66a', '#9b6a3c', '#5b3a20'], frost: ['#f2fbff', '#9fd2ef', '#5a8fb5'], caves: ['#d2b8ff', '#7b52c8', '#3c2470']}[b];
        const g = ctx.createLinearGradient(0, y, 0, y + 7 * s); g.addColorStop(0, hi); g.addColorStop(1, lo);
        ctx.fillStyle = edge; ctx.beginPath(); ctx.roundRect(x, y, w, 7 * s, 2 * s); ctx.fill();
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x + .7 * s, y + .7 * s, w - 1.4 * s, 5.4 * s, 1.6 * s); ctx.fill();
        ctx.strokeStyle = edge; ctx.lineWidth = .7 * s; ctx.globalAlpha = .6;
        for (let k = 8; k < m.w; k += 8) { ctx.beginPath(); ctx.moveTo(x + k * s, y + 1 * s); ctx.lineTo(x + k * s, y + 6 * s); ctx.stroke(); }
        ctx.globalAlpha = 1;
        if (b === 'caves') { const gl = ctx.createRadialGradient(x + w / 2, y + 3 * s, 0, x + w / 2, y + 3 * s, 26 * s); gl.addColorStop(0, 'rgba(190,150,255,.35)'); gl.addColorStop(1, 'rgba(190,150,255,0)'); ctx.fillStyle = gl; ctx.fillRect(x - 20 * s, y - 24 * s, w + 40 * s, 50 * s); }
        if (m.kind === 'ferry' && b === 'meadow') {   // a leaf sail
          ctx.fillStyle = '#6fbf4f'; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.quadraticCurveTo(x + w / 2 + 11 * s, y - 9 * s, x + w / 2 + 1 * s, y - 19 * s); ctx.quadraticCurveTo(x + w / 2 - 4 * s, y - 9 * s, x + w / 2, y); ctx.fill();
          ctx.strokeStyle = '#3f8d4a'; ctx.lineWidth = .8 * s; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2 + 1 * s, y - 18 * s); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  function drawSeeds() {
    for (const ch of chunks.values()) for (const s of ch.seeds) {
      if (s.got && !(replay && s.gotAt > frameNo)) continue;
      const [x, y] = W2D(s.x, s.y + Math.sin(frameNo * .06 + s.x * .1) * 1.5);
      if (x < -20 || x > cv.width + 20) continue;
      star(x, y, 5.2 * S, frameNo * .03 + s.x);
    }
  }
  function star(x, y, r, rot) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, 'rgba(255,226,120,.45)'); g.addColorStop(1, 'rgba(255,226,120,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = '#fff3c4'; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * .45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.fill(); ctx.fillStyle = '#f2b532'; ctx.beginPath(); ctx.arc(0, 0, r * .36, 0, 7); ctx.fill(); ctx.restore();
  }
  function drawEnemy(e) {
    const [x, y] = W2D(e.x, e.y), s = S, w = e.w * s, h = e.h * s, step = Math.sin(e.t * .25), flip = e.vx > 0 && e.kind !== 'flier', L = flip ? -1 : 1;
    ctx.save(); ctx.translate(x + w / 2, y + h);
    if (e.ground && e.state !== 'dead' && e.kind !== 'pod') { ctx.fillStyle = 'rgba(30,20,10,.22)'; ctx.beginPath(); ctx.ellipse(0, -.2 * s, 7.5 * s, 1.5 * s, 0, 0, 7); ctx.fill(); }
    if (e.state === 'dead') { ctx.rotate(Math.PI); ctx.translate(0, h); }
    if (flip) ctx.scale(-1, 1);
    // Painted shading: lit from the upper left of the world whichever way a creature faces.
    const ball = (cx, cy, rx, ry, cols) => {
      const q = ctx.createRadialGradient(cx - rx * .38 * L, cy - ry * .45, rx * .08, cx, cy, Math.max(rx, ry) * 1.05);
      cols.forEach((c, i) => q.addColorStop(i / (cols.length - 1), c)); ctx.fillStyle = q; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    };
    const rim = (cx, cy, rx, ry, col) => { ctx.strokeStyle = col; ctx.lineWidth = .9 * s; ctx.beginPath(); ctx.ellipse(cx, cy, rx - .6 * s, ry - .6 * s, 0, L > 0 ? -.6 : Math.PI - 1.2, L > 0 ? 1.2 : Math.PI + .6); ctx.stroke(); };
    const eye = (ex, ey, k = 1) => {
      ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(ex, ey, 2 * s * k, 2.4 * s * k, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2018'; ctx.beginPath(); ctx.arc(ex - .6 * s * k, ey + .3 * s * k, 1.15 * s * k, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - .95 * s * k, ey - .25 * s * k, .45 * s * k, 0, 7); ctx.fill();
    };
    const blush = (bx, by) => { ctx.fillStyle = 'rgba(255,128,128,.32)'; ctx.beginPath(); ctx.ellipse(bx, by, 1.6 * s, .9 * s, 0, 0, 7); ctx.fill(); };
    if (e.state === 'squash') { ball(0, -2 * s, 8 * s, 2.6 * s, ['#b98a58', '#8a5e38', '#5e3e24']); ctx.restore(); return; }
    if (e.kind === 'pod') {             // a spiky seed pod, spinning as it flies
      ctx.translate(0, -5 * s); ctx.rotate(-e.t * .18);
      ctx.fillStyle = '#6b4424'; ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, rr = (k % 2 ? 3.6 : 6.4) * s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill();
      ball(0, 0, 3.6 * s, 3.6 * s, ['#f6dca6', '#c99a62', '#8a5e34']);
      ctx.restore(); return;
    }
    if (e.kind === 'walker') {          // Mossbud: a round seed with a sprouting leaf
      for (const sd of [-1, 1]) ball(sd * 4 * s + step * sd * 1.5 * s, -1.3 * s, 3 * s, 1.7 * s, ['#7d5a40', '#5b4030', '#3a281c']);
      ball(0, -7 * s, 7.5 * s, 6.6 * s, ['#e0b27a', '#a8743f', '#6a4426']);
      ctx.strokeStyle = 'rgba(86,52,26,.32)'; ctx.lineWidth = .7 * s;
      for (const dx of [-3.6, 0, 3.6]) { ctx.beginPath(); ctx.moveTo(dx * s, -12.6 * s); ctx.quadraticCurveTo(dx * 1.35 * s, -7 * s, dx * s, -1.4 * s); ctx.stroke(); }
      rim(0, -7 * s, 7.5 * s, 6.6 * s, 'rgba(255,214,150,.55)');
      const lf = ctx.createLinearGradient(0, -16 * s, 0, -13 * s); lf.addColorStop(0, '#b6ee7a'); lf.addColorStop(1, '#4f9a3a');
      ctx.fillStyle = lf; ctx.beginPath(); ctx.ellipse(1.5 * s, -14.6 * s, 3.6 * s, 1.7 * s, -.6 + step * .1, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(40,90,30,.6)'; ctx.lineWidth = .4 * s; ctx.beginPath(); ctx.moveTo(-.6 * s, -13.2 * s); ctx.lineTo(3.6 * s, -16 * s); ctx.stroke();
      eye(-3 * s, -8 * s); eye(1.8 * s, -8 * s); blush(-4.8 * s, -5.2 * s); blush(3.6 * s, -5.2 * s);
    } else if (e.kind === 'snail') {    // Shellback snail: retreats into a kickable shell
      const shell = () => {
        ball(1 * s, -7 * s, 6.8 * s, 6.8 * s, ['#ffe0a6', '#e3934c', '#9a4c24']);
        for (const [col, off, lw] of [['rgba(120,56,24,.75)', 0, 1.1], ['rgba(255,226,170,.45)', -.5, .5]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw * s; ctx.beginPath(); for (let a = 0; a < 12; a += .3) { const rr = 6 * s * (1 - a / 13); ctx.lineTo((1 + off) * s + Math.cos(a) * rr, (-7 + off) * s + Math.sin(a) * rr); } ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-1.6 * L * s, -10.8 * s, 2.2 * s, 1 * s, -.5 * L, 0, 7); ctx.fill();
      };
      if (e.state === 'walk') {
        const body = ctx.createLinearGradient(0, -5 * s, 0, 0); body.addColorStop(0, '#d2f4e2'); body.addColorStop(1, '#7fb99c');
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-3 * s, -2.2 * s, 7.5 * s, 2.4 * s, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-7.5 * s, -5 * s, 2.3 * s, 3.5 * s, -.3, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = .5 * s; ctx.beginPath(); ctx.moveTo(-9 * s, -3.6 * s); ctx.quadraticCurveTo(-4 * s, -4.8 * s, 3 * s, -3.4 * s); ctx.stroke();
        ctx.strokeStyle = '#7fb39a'; ctx.lineWidth = .9 * s; ctx.beginPath(); ctx.moveTo(-8 * s, -8 * s); ctx.lineTo(-9.5 * s, -11.5 * s); ctx.stroke();
        ctx.fillStyle = '#7fb39a'; ctx.beginPath(); ctx.arc(-9.5 * s, -11.6 * s, .7 * s, 0, 7); ctx.fill();
        eye(-8 * s, -5.5 * s);
      }
      shell();
    } else if (e.kind === 'hopper') {   // Puddlehop: a round frog that leaps toward you
      const crouch = e.ground ? 1 : .8;
      for (const sd of [-1, 1]) ball(sd * 5.5 * s, -1.4 * s, 3.2 * s, 1.6 * s, ['#5fb878', '#3f8d58', '#2a6a40']);
      ball(0, -6 * s * crouch, 7.5 * s, 6 * s * crouch, ['#a6eab4', '#55ad6e', '#2c744a']);
      ctx.fillStyle = 'rgba(30,90,50,.35)'; for (const [sx, sy, r] of [[2.5, -9, 1.3], [4.6, -6.5, .9], [.6, -11, .8]]) { ctx.beginPath(); ctx.arc(sx * s, sy * s * crouch, r * s, 0, 7); ctx.fill(); }
      ball(-1 * s, -3.8 * s, 4.6 * s, 2.9 * s, ['#fbffe6', '#d8f2b4', '#b3dc8e']);
      rim(0, -6 * s * crouch, 7.5 * s, 6 * s * crouch, 'rgba(230,255,200,.5)');
      eye(-3.5 * s, -11 * s * crouch); eye(2.5 * s, -11 * s * crouch);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-3 * L * s, -8.8 * s * crouch, 1.8 * s, .8 * s, -.4 * L, 0, 7); ctx.fill();
    } else {                             // Puffwing: a fluffy flier
      const flap = Math.sin(e.t * .3) * .8;
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.translate(sd * 5 * s, -8 * s); ctx.rotate(sd * flap);
        const wg = ctx.createLinearGradient(0, -2 * s, 0, 2.2 * s); wg.addColorStop(0, '#ffe3ee'); wg.addColorStop(1, '#e48fb4');
        ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(sd * 4 * s, 0, 4.6 * s, 2.3 * s, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(190,90,130,.4)'; ctx.lineWidth = .4 * s; for (const k of [1.5, 3.5]) { ctx.beginPath(); ctx.moveTo(sd * k * s, -1.2 * s); ctx.lineTo(sd * (k + 1.5) * s, 1.5 * s); ctx.stroke(); }
        ctx.restore();
      }
      ctx.fillStyle = '#f9e4ee'; for (let k = 0; k < 10; k++) { const a = k * .628; ctx.beginPath(); ctx.arc(Math.cos(a) * 6 * s, -7 * s + Math.sin(a) * 6 * s, 1.5 * s, 0, 7); ctx.fill(); }
      ball(0, -7 * s, 6.5 * s, 6.5 * s, ['#ffffff', '#fdeef5', '#eab9d0']);
      const bk = ctx.createLinearGradient(-9.5 * s, 0, -6.5 * s, 0); bk.addColorStop(0, '#e68a24'); bk.addColorStop(1, '#ffc066');
      ctx.fillStyle = bk; ctx.beginPath(); ctx.moveTo(-6.5 * s, -7.2 * s); ctx.lineTo(-9.8 * s, -6 * s); ctx.lineTo(-6.5 * s, -4.8 * s); ctx.fill();
      eye(-3 * s, -8.5 * s); blush(-2.4 * s, -5.4 * s);
    }
    ctx.restore();
  }
  function drawThoughts(arcs, at) {
    if (!arcs) return;
    // Kept quiet: a soft chosen path and only the closest alternatives, faint.
    const fade = Math.max(.3, 1 - (frameNo - at) / 40), lw = Math.max(1, S * .34);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) for (const a of arcs) {
      if ((pass === 1) !== a.chosen || (!a.chosen && a.rank > .2)) continue;
      const dead = a.death >= 0;
      const al = (a.chosen ? .5 : dead ? .1 + .12 * (1 - a.rank) : .05 + .1 * (1 - a.rank)) * fade;
      const path = () => { ctx.beginPath(); a.pts.forEach(([x, y], i) => { const [sx, sy] = W2D(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); };
      // A dark under-stroke keeps the lines readable over the bright painting.
      path(); ctx.strokeStyle = `rgba(24,36,44,${(a.chosen ? .3 : .12) * al})`; ctx.lineWidth = (a.chosen ? lw * 1.8 : lw) + lw; ctx.stroke();
      path(); ctx.strokeStyle = a.chosen ? `rgba(255,226,130,${al})` : dead ? `rgba(255,112,96,${al})` : `rgba(255,255,255,${al})`;
      ctx.lineWidth = a.chosen ? lw * 1.8 : lw; ctx.stroke();
      if (dead) { const [ex, ey] = W2D(...a.pts[a.pts.length - 1]), r = S * 1.6; ctx.beginPath(); ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r); ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r); ctx.stroke(); }
    }
    ctx.restore();
  }
  function drawMarks() {
    if (!sheet.complete || !sheet.naturalWidth) return;
    const sc = 30 / 295 * S;
    for (const k of marks) {
      const [x, y] = W2D(k.x + P.w / 2, k.y + P.h + 1);
      if (x < -60 || x > cv.width + 60) continue;
      ctx.save(); ctx.globalAlpha = .2 + .06 * Math.sin(frameNo * .05 + k.at); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.drawImage(sheet, 19 * FRAME_W, 0, FRAME_W, FRAME_H, -122, -300, FRAME_W, FRAME_H); ctx.restore();
    }
  }
  function drawWary() {
    if (!wary || human || dead) return;
    const [x, y] = W2D(pl.x + P.w / 2 + 6, pl.y - 12), r = 4.2 * S, a = Math.min(1, wary / 10);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0582f'; ctx.font = `700 ${r * 1.5}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', x, y + r * .08); ctx.restore();
  }
  /* Running and standing, Pip's legs are drawn rather than taken from the
     painted frames: those were cut-outs, and stepped faster than the screen
     refreshes they flickered instead of striding. One continuous phase, from
     the distance run, drives both legs half a cycle apart: a boot plants and
     sweeps back under the hip, the heel rolls up, the leg swings through with
     the knee forward and reaches for the next step; the body dips at mid-stance
     and rises between steps. The painted body (and the air, landing and skid
     poses) stay as painted. Sprite pixels, feet at the origin. */
  const STRIDE = 18;   // world px per full cycle (two steps), small Pip
  const stride = () => STRIDE * (shownBig() ? 4 / 3 : 1);
  let torso = null;
  function torsoSprite() {   // frame 0 above the hips, clear of its cut-out legs
    if (torso) return torso;
    const c2 = document.createElement('canvas'); c2.width = FRAME_W; c2.height = 252;
    const g = c2.getContext('2d');
    g.beginPath(); g.rect(0, 0, FRAME_W, 212); g.ellipse(100, 223, 54, 25, 0, 0, Math.PI * 2); g.clip();
    g.drawImage(sheet, 0, 0, FRAME_W, 252, 0, 0, FRAME_W, 252);
    return (torso = c2);
  }
  const LEG = {thigh: 19, shin: 18, ankle: 19, hip: -55};
  // A running stride, not a walk: a short contact (under a third of the cycle
  // at speed), then the heel kicks up high behind, the knee drives through
  // under the body and the boot reaches forward for the next contact. Swing
  // keyframes from toe-off to contact: x (× stride), y (× lift), boot angle.
  const SWING = [[-.8, 0, .5], [-.95, -1.25, 1.3], [-.1, -1.2, .45], [.8, -.55, -.3], [.55, 0, -.15]];
  function footAt(u, A, lift, D) {
    if (u < D) { const p = u / D; return [A * (.55 - 1.35 * p), 0, p < .15 ? -.15 * (1 - p / .15) : p > .7 ? .5 * (p - .7) / .3 : 0]; }
    const q = (u - D) / (1 - D) * (SWING.length - 1), i = Math.min(SWING.length - 2, Math.floor(q)), f = q - i, K = n => SWING[clamp(0, n, SWING.length - 1)];
    const cr = c => { const p0 = K(i - 1)[c], p1 = K(i)[c], p2 = K(i + 1)[c], p3 = K(i + 2)[c]; return .5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f); };
    return [A * cr(0), lift * cr(1), cr(2)];
  }
  function drawLeg(hx, hy, [fx, fy, rot], far) {
    const a = LEG.thigh, b = LEG.shin, ax = hx + fx - Math.max(0, rot) * 6, ay = fy - LEG.ankle - Math.max(0, rot) * 9;   // fx is from the hip
    let dx = ax - hx, dy = ay - hy, d = Math.hypot(dx, dy);
    if (d > a + b - .5) { const k = (a + b - .5) / d; dx *= k; dy *= k; d = a + b - .5; }
    const base = Math.atan2(dy, dx), bend = Math.acos(clamp(-1, (a * a + d * d - b * b) / (2 * a * d), 1));
    const kx = hx + a * Math.cos(base - bend), ky = hy + a * Math.sin(base - bend), ex = hx + dx, ey = hy + dy;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = far ? '#c8a58c' : '#efd0b4'; ctx.lineWidth = 23; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = far ? 'rgba(255,236,220,.18)' : 'rgba(255,248,238,.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hx - 5, hy); ctx.lineTo(kx - 5, ky - 1); ctx.lineTo(ex - 5, ey - 1); ctx.stroke();
    ctx.strokeStyle = far ? 'rgba(60,30,30,.25)' : 'rgba(150,96,80,.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx + 7, hy + 2); ctx.lineTo(kx + 7, ky + 2); ctx.lineTo(ex + 7, ey); ctx.stroke();
    // The boot: a big rounded toe, a dark sole, a gloss on the toe cap.
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(rot); ctx.scale(1.25, 1.25);
    const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, far ? '#b0612a' : '#e3903f'); g.addColorStop(.55, far ? '#7a380e' : '#bf5e1a'); g.addColorStop(1, far ? '#512304' : '#7a3508');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-11, -9); ctx.quadraticCurveTo(-17, 2, -12, 10); ctx.lineTo(22, 10); ctx.quadraticCurveTo(33, 10, 31, 1);
    ctx.quadraticCurveTo(28, -9, 11, -8); ctx.quadraticCurveTo(5, -12, -2, -12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = far ? '#3d1904' : '#5a2706'; ctx.beginPath(); ctx.roundRect(-13, 7.2, 45, 4.2, 2); ctx.fill();
    ctx.fillStyle = far ? 'rgba(255,190,130,.22)' : 'rgba(255,206,150,.62)'; ctx.beginPath(); ctx.ellipse(17, -3, 9, 3.4, -.18, 0, 7); ctx.fill();
    ctx.fillStyle = far ? 'rgba(255,220,180,.1)' : 'rgba(255,226,190,.35)'; ctx.beginPath(); ctx.ellipse(-5, -9.5, 7, 2.2, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawRunner(phase, k) {
    // k: 0 standing .. 1 full speed. The legs are on the ground half the time
    // when walking, under a third at a run, so at speed there is a moment with
    // both feet off the ground: the body rises then, and sinks at mid-stance.
    const A = 3 + 19 * k, lift = 3 + 11 * k, D = .5 - .2 * k, uf = phase % 1, ub = (phase + .5) % 1;
    const front = footAt(uf, A, lift, D), back = footAt(ub, A, lift, D), L = (LEG.thigh + LEG.shin) * .97;
    const plant = uf < D ? front : ub < D ? back : null, p = uf < D ? uf / D : ub < D ? ub / D : -1;
    let bob;
    if (plant) bob = Math.max((2 + 3 * k) * Math.sin(Math.PI * p), -LEG.hip - LEG.ankle - Math.sqrt(Math.max(0, L * L - plant[0] * plant[0])));
    else bob = -(1 + 4 * k) * Math.sin(Math.PI * ((phase % .5) - D) / (.5 - D));
    const sway = .035 * k * Math.sin(2 * Math.PI * phase);   // the shoulders turn a little with the stride
    drawLeg(-30, LEG.hip + 1 + bob, back, true);
    ctx.save(); ctx.translate(-24, -60 + bob); ctx.rotate(sway); ctx.drawImage(torsoSprite(), -98, -240); ctx.restore();
    drawLeg(-18, LEG.hip + bob, front, false);
  }
  function drawPip() {
    if (inv && !dead && Math.floor(inv / 4) % 2) return;
    const [x, y] = W2D(pl.x + P.w / 2, pl.y + pl.h + 1);
    let f;
    if (dead) f = 18;
    else if (!pl.ground) f = pl.vy < -2.5 ? 17 : pl.vy < 1.2 ? 18 : 19;
    else if (skidding) f = 21;                       // braced crouch reads as a skid
    else if (frameNo - landedAt < 5) f = 20;
    else f = -1;                                     // standing or running: drawn legs
    const sc = pipVisual() / 295 * S, sx = 1 - .13 * sq, sy = 1 + .15 * sq;
    // Lean into speed on the ground, brace against a skid.
    const lean = dead ? 0 : pl.ground ? (skidding ? -.12 : .11 * Math.min(1, Math.abs(pl.vx) / P.max)) : .04;
    ctx.save(); ctx.translate(x, y);
    if (!dead && pl.ground) { ctx.fillStyle = 'rgba(40,30,20,.22)'; ctx.beginPath(); ctx.ellipse(0, -S * .4, 8 * S * (shownBig() ? 1.25 : 1), 1.8 * S, 0, 0, 7); ctx.fill(); }
    if (dead) ctx.rotate(Math.min(Math.PI, dead * .08));
    ctx.scale(facing, 1); ctx.rotate(lean); ctx.scale(sx * sc, sy * sc);
    if (sheet.complete && sheet.naturalWidth) {
      if (f < 0) drawRunner(anim / stride(), clamp(0, Math.abs(pl.vx) / 1.2, 1));
      else ctx.drawImage(sheet, f * FRAME_W, 0, FRAME_W, FRAME_H, -122, -300, FRAME_W, FRAME_H);
    }
    else { ctx.fillStyle = '#4fae9a'; ctx.beginPath(); ctx.arc(0, -200, 90, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#f2c9a0'; ctx.fillRect(-55, -200, 110, 190); }
    ctx.restore();
  }
  // The ghost is the same painted Pip, see-through, drawn from its recorded pose.
  function drawGhost() {
    if (!ghost || !ghost.frames.length) return;
    const fin = ghost.frames[ghost.frames.length - 1], done = frameNo > ghost.frames.length;
    if (done) {   // where the ghost's run ended: a little flag
      const [x, y] = W2D(fin.x + 6, fin.y + fin.h);
      if (x < -40 || x > cv.width + 40) return;
      ctx.save(); ctx.globalAlpha = .75; ctx.strokeStyle = '#fffbea'; ctx.lineWidth = Math.max(1.5, S * .5);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 30 * S); ctx.stroke();
      ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.moveTo(x, y - 30 * S); ctx.lineTo(x + 13 * S, y - 26 * S); ctx.lineTo(x, y - 22 * S); ctx.fill();
      ctx.font = `700 ${Math.max(11, 5.5 * S)}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fffbea'; ctx.fillText(`${ghost.m} m`, x, y - 33 * S);
      ctx.restore(); return;
    }
    const g1 = ghostAt(frameNo); if (!g1) return;
    const g0 = drawT !== null && ghostAt(frameNo - 1), k = drawT !== null ? drawT - frameNo + 1 : 1;
    const g = g0 && Math.abs(g1.x - g0.x) < 48 ? {...g1, x: g0.x + (g1.x - g0.x) * k, y: g0.y + (g1.y - g0.y) * k} : g1;
    const live = {pl, facing, anim, landedAt, dead, inv, sq, skidding, big, growing};
    pl = {...pl, x: g.x, y: g.y, w: g.w, h: g.h, vx: g.vx, vy: g.vy, ground: g.ground};
    ({facing, anim, landedAt, dead, inv, sq, skidding, big, growing} = g);
    const [x, y] = W2D(pl.x + 6, pl.y - 6);
    ctx.save(); ctx.globalAlpha = .4;
    if (x > cv.width - 6) {   // ahead and off screen: a marker on the edge
      ctx.globalAlpha = .85; ctx.fillStyle = '#9fd8ff'; ctx.font = `700 ${Math.max(12, 6 * S)}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'right';
      ctx.fillText(`ghost +${Math.round((g.x - live.pl.x) / TS)} m ›`, cv.width - 8, Math.max(oy + 60 * S, y));
    } else {
      ctx.filter = 'saturate(.35) brightness(1.3)'; drawPip(); ctx.filter = 'none';
      ctx.globalAlpha = .7; ctx.fillStyle = '#e6f6ff'; ctx.font = `600 ${Math.max(10, 4.6 * S)}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(ghost.label === 'best' ? 'your best' : 'ghost', x, y - (pipVisual() - 14) * S);
    }
    ctx.restore();
    ({pl, facing, anim, landedAt, dead, inv, sq, skidding, big, growing} = live);
  }
  function drawItems() {
    for (const it of items) {
      const [x, y] = W2D(it.x + 6, it.y + 12), s = S, glow = ctx.createRadialGradient(x, y - 6 * s, 0, x, y - 6 * s, 14 * s);
      glow.addColorStop(0, 'rgba(255,224,110,.5)'); glow.addColorStop(1, 'rgba(255,224,110,0)'); ctx.fillStyle = glow; ctx.fillRect(x - 14 * s, y - 20 * s, 28 * s, 28 * s);
      ctx.fillStyle = '#ffcf3e'; ctx.beginPath(); ctx.ellipse(x, y - 4 * s, 5 * s, 4.2 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3b8'; ctx.beginPath(); ctx.ellipse(x - 1.6 * s, y - 5.4 * s, 1.6 * s, 1.1 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#5cc44f'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * 3 * s, y - 10 * s, 3.2 * s, 1.6 * s, sd * -.5 + Math.sin(it.t * .2) * .1, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#2f8a3a'; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(x, y - 7.5 * s); ctx.lineTo(x, y - 10 * s); ctx.stroke();
    }
  }
  // A soft round of colour, painted once per colour and stretched: puffs, glows.
  const blobs = new Map();
  function blob(x, y, r, col, a) {
    let b = blobs.get(col);
    if (!b) {
      b = document.createElement('canvas'); b.width = b.height = 32;
      const g = b.getContext('2d'), q = g.createRadialGradient(16, 16, 0, 16, 16, 16), rgb = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)).join(',');
      q.addColorStop(0, `rgba(${rgb},1)`); q.addColorStop(.45, `rgba(${rgb},.55)`); q.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = q; g.fillRect(0, 0, 32, 32);
      blobs.set(col, b);
    }
    ctx.globalAlpha = a; ctx.drawImage(b, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  function drawParts() {
    for (const p of parts) {
      const [x, y] = W2D(p.x, p.y), a = Math.min(1, p.life / 14);
      if (p.seed) { star(x, y, 5 * S * a, frameNo * .2); continue; }
      if (p.soft) { blob(x, y, p.r * S * (1.2 + (1 - p.life / p.l0) * 1.4), p.col, .85 * a); continue; }
      if (p.glow) blob(x, y, p.r * S * 5, p.col, .6 * a);
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      if (p.leaf) { ctx.save(); ctx.translate(x, y); ctx.rotate(p.life * p.spin * .25); ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.7 * S, p.r * .7 * S, 0, 0, 7); ctx.fill(); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(x, y, p.r * S, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  // Footprints pressed into snow and cloud; in the caves, moss that glows where Pip stepped.
  const PRINT_LIFE = {snow: 900, cloud: 260, moss: 300};
  function drawPrints() {
    const t = drawT ?? frameNo;
    for (const k of prints) {
      const age = t - k.at, f = 1 - age / PRINT_LIFE[k.m]; if (age < 0 || f <= 0) continue;
      const [x, y] = W2D(k.x, k.y); if (x < -20 || x > cv.width + 20) continue;
      if (k.m === 'moss') { blob(x, y, 7 * S, '#8ff7de', .8 * f * f); continue; }
      ctx.fillStyle = k.m === 'snow' ? `rgba(84,118,168,${(.38 * f).toFixed(3)})` : `rgba(150,140,206,${(.3 * f).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y + .9 * S, 2.3 * S, .75 * S, 0, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${(.5 * f).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(x + .4 * S, y + 1.7 * S, 2 * S, .4 * S, 0, 0, 7); ctx.fill();
    }
  }
  // Grass at the front of the painted turf sways in the breeze and parts
  // around Pip and the creatures; where Pip lands it flattens for a moment.
  const GRASS = {meadow: ['#4f9a3a', '#6fbf4f', '#94d35e', '#b7e77e'], caves: ['#1f8a74', '#38c2a4', '#7ef0d4', '#2fb79c']};
  function drawGrass() {
    const t = drawT ?? frameNo, x0 = cam - TS, x1 = cam + viewW + TS, push = [];
    if (!dead) push.push([pl.x + 6, pl.y + pl.h, 1, t - landedAt]);
    for (const e of enemies) if (e.ground && e.state !== 'dead' && e.kind !== 'flier') push.push([e.x + 7, e.y + e.h, .6, 99]);
    for (const ch of chunks.values()) {
      const cols = GRASS[ch.biome]; if (!cols || !ch.tops || !ch.art) continue;
      for (const [tx, ty] of ch.tops) {
        if (tx * TS > x1 || tx * TS + TS < x0) continue;
        const Y = ty * TS + 1.3;
        for (let i = 0; i < 3; i++) {
          const h = hash(seed ^ 0x6a5, tx * 4 + i); if (h % 3 === 0) continue;
          const bx = tx * TS + 1.5 + i * 5.2 + (h >>> 12) % 40 / 10, bh = (ch.biome === 'caves' ? 1.8 : 2.4) + (h >>> 3) % 6 * .55;
          let a = Math.sin(t * .045 + bx * .09) * .2 + Math.sin(t * .13 + bx * .31) * .06;
          for (const [mx, my, k, since] of push) {
            const dx = bx - mx; if (Math.abs(my - Y) > 7 || Math.abs(dx) > 14) continue;
            a += Math.sign(dx || 1) * (1 - Math.abs(dx) / 14) * (1.05 + (since >= 0 && since < 24 ? (1 - since / 24) * .9 : 0)) * k;
          }
          a = clamp(-1.35, a, 1.35);
          const [sx, sy] = W2D(bx, Y), L = bh * S, w = .5 * S, cx = sx + Math.sin(a * .45) * L * .55, cy = sy - Math.cos(a * .45) * L * .55;
          ctx.fillStyle = cols[(h >>> 7) % 4]; ctx.beginPath(); ctx.moveTo(sx - w, sy);
          ctx.quadraticCurveTo(cx - w * .3, cy, sx + Math.sin(a) * L, sy - Math.cos(a) * L); ctx.quadraticCurveTo(cx + w * .3, cy, sx + w, sy); ctx.fill();
        }
      }
    }
  }
  // Leaves drift down from the painted oaks and snow sifts from the pines;
  // a shower of them comes down when Pip runs past a trunk.
  const rustle = new Map();
  function drawLeaves() {
    const t = drawT ?? frameNo;
    for (const ch of chunks.values()) {
      if (!ch.art || !ch.props) continue;
      ch.props.forEach((p, i) => {
        if (p.kind !== 'oak' && p.kind !== 'pine') return;
        const [, , sw, sh, H] = PROP[p.kind], w = H * sw / sh, cx = p.x * TS + 8 + ((p.hv >>> 5) % 7 - 3), top = p.s * TS + 3 - H, snow = p.kind === 'pine';
        const [sx] = W2D(cx, 0); if (sx < -w * S || sx > cv.width + w * S) return;
        const key = ch.ci * 64 + i, last = rustle.get(key);
        if (!dead && Math.abs(pl.x + 6 - cx) < 20 && pl.y + pl.h > top + H * .4 && (last === undefined || t - last > 240 || t < last)) {
          rustle.set(key, t);
          if (!replay && typeof PipAudio !== 'undefined') PipAudio.fx('rustle', {snow});
        }
        const since = rustle.has(key) ? t - rustle.get(key) : -1;
        for (let j = 0; j < (since >= 0 && since < 170 ? 10 : 3); j++) {
          const burst = j >= 3, P = 460 + j * 70, off = hash(p.hv, j) % P, ph = burst ? (since - (j - 3) * 9) / 150 : ((t + off) % P) / P;
          if (ph < 0 || ph > 1) continue;
          const hq = hash(p.hv ^ (burst ? rustle.get(key) : Math.floor((t + off) / P)), j);
          const x0 = cx + ((hq % 1000) / 1000 - .5) * w * (snow ? .6 : .7), y0 = top + H * (.12 + (hq >>> 10) % 100 / 100 * (snow ? .6 : .38));
          const [lx, ly] = W2D(x0 + Math.sin(ph * 7 + j) * (snow ? 2 : 6) + ph * (snow ? 3 : 12), y0 + ph * (p.s * TS - y0)), al = Math.min(1, ph * 10, (1 - ph) * 6);
          if (snow) { blob(lx, ly, 1.5 * S, '#ffffff', .85 * al); continue; }
          ctx.save(); ctx.globalAlpha = al; ctx.translate(lx, ly); ctx.rotate(Math.sin(ph * 11 + j) * 1.3);
          ctx.fillStyle = ['#8fbf4a', '#b9c84a', '#d9a03a', '#6faa3c'][hq % 4]; ctx.beginPath(); ctx.ellipse(0, 0, 1.9 * S, .8 * S, 0, 0, 7); ctx.fill(); ctx.restore();
        }
      });
    }
  }
  function drawHud() {
    const W = cv.width, u = Math.max(12, 9 * S), pad = u * .9;
    ctx.save(); ctx.font = `600 ${u}px system-ui,-apple-system,sans-serif`; ctx.textBaseline = 'middle';
    const y = oy + pad + u * .6;
    star(pad + u * .6, y, u * .55, 0);
    ctx.fillStyle = 'rgba(30,40,40,.55)'; ctx.fillText(String(seeds), pad + u * 1.55 + 1, y + 1); ctx.fillStyle = '#fffbea'; ctx.fillText(String(seeds), pad + u * 1.55, y);
    {
      const when = new Date(day + 'T12:00:00Z').toLocaleDateString(undefined, {month: 'short', day: 'numeric', timeZone: 'UTC'});
      const lines = [[worldMode === 'friend' ? 'Racing a shared run' : worldMode === 'daily' ? `Today’s world · ${when}` : 'Random world', '#ffe9a8']];
      if (ghost) {
        const who = ghost.label === 'best' ? 'your best' : 'the ghost', m = Math.floor(maxX / TS), g = ghostAt(frameNo);
        if (frameNo > ghost.frames.length) lines.push(m > ghost.m ? [`Beat ${who}: ${ghost.m} m`, '#b8f5b0'] : [`${who[0].toUpperCase() + who.slice(1)} reached ${ghost.m} m`, '#cfe9ff']);
        else if (g) { const d = m - g.m; lines.push(d > 0 ? [`▲ ${d} m ahead of ${who}`, '#b8f5b0'] : d < 0 ? [`▼ ${-d} m behind ${who}`, '#ffc9b8'] : [`Level with ${who}`, '#fffbea']); }
      } else if (worldMode === 'daily' && human) lines.push(['Your best today becomes a ghost', '#fffbea']);
      ctx.font = `600 ${u * .72}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'left';
      lines.forEach(([t, c], i) => { const yy = y + u * (1.25 + i * 1.05); ctx.fillStyle = 'rgba(30,40,40,.5)'; ctx.fillText(t, pad + 1, yy + 1); ctx.fillStyle = c; ctx.fillText(t, pad, yy); });
      ctx.font = `600 ${u}px system-ui,-apple-system,sans-serif`;
    }
    const dist = Math.floor(maxX / TS) + ' m';
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(30,40,40,.55)'; ctx.fillText(dist, W - pad + 1, y + 1); ctx.fillStyle = '#fffbea'; ctx.fillText(dist, W - pad, y);
    ctx.textAlign = 'center';
    if (replay) {
      const bandH = VIEW_H * S, bar = bandH * .07;
      ctx.fillStyle = 'rgba(12,20,24,.42)'; ctx.fillRect(0, oy, W, bar); ctx.fillRect(0, oy + bandH - bar, W, bar);
    }
    if (!portrait) {
      const span = REGION * CW * TS, region = Math.floor(pl.x / span), next = BIOMES[regionBiome(region + 1)].mark, m2 = Math.max(0, Math.round(((region + 1) * span - pl.x) / TS));
      ctx.font = `600 ${u * .72}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'right';
      const line = `${next} · ${m2} m ›`, yy = y + u * (marks.length && !human ? 2.35 : 1.25);
      ctx.fillStyle = 'rgba(30,40,40,.5)'; ctx.fillText(line, W - pad + 1, yy + 1); ctx.fillStyle = '#ffe9a8'; ctx.fillText(line, W - pad, yy);
      ctx.font = `600 ${u}px system-ui,-apple-system,sans-serif`;
    }
    if (!human && marks.length) {
      ctx.font = `500 ${u * .7}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'right';
      const note = `remembers ${marks.length} ${marks.length === 1 ? 'spot' : 'spots'}${risk > .45 ? ' · careful' : ''}`;
      ctx.fillStyle = 'rgba(30,40,40,.5)'; ctx.fillText(note, W - pad + 1, y + u * 1.25 + 1); ctx.fillStyle = '#fffbea'; ctx.fillText(note, W - pad, y + u * 1.25);
      ctx.font = `600 ${u}px system-ui,-apple-system,sans-serif`;
    }
    ctx.textAlign = 'center';
    const coarse = usingTouch || matchMedia('(pointer:coarse)').matches;
    drawDirectorHud(); ctx.textAlign = 'center'; ctx.font = `600 ${u}px system-ui,-apple-system,sans-serif`;
    const msg = toast && performance.now() < toast.until ? toast.text : replay ? `Replay · ${replay.kind}` : !human ? (tool ? (coarse ? 'Tap just ahead of Pip to place · tap the tool again to cancel' : 'Click just ahead of Pip to place · Esc to cancel')
      : coarse ? 'Challenge Pip with a tool below · or tap the stage to play' : 'Challenge Pip: pick a tool (1 2 3) · or ← → Space to play')
      : performance.now() < hintUntil ? (usingTouch ? 'Hold right to run · tap jump, hold to jump higher' : '← → run · Space to jump, hold for higher') : '';
    if (msg) {
      ctx.font = `500 ${u * .82}px system-ui,-apple-system,sans-serif`;
      // Near the bottom of the stage: the host page's control bar sits at the top.
      // Centred in the space right of the director's toolbar when it is showing.
      const land = cv.clientHeight <= cv.clientWidth, bar = !human && !replay ? toolbar() : null, acts = land ? actions() : [];
      const left = bar && land ? (bar[2].x + bar[2].w + 120) * dpr : 0, right = acts.length ? acts[acts.length - 1].x * dpr - u * .6 : W;
      let tw = ctx.measureText(msg).width + u * 1.6;
      const room = portrait ? W - u * 1.4 : (right - left) - u;
      if (tw > room) { const k = Math.max(.6, room / tw); ctx.font = `500 ${u * .82 * k}px system-ui,-apple-system,sans-serif`; tw = ctx.measureText(msg).width + u * 1.6 * k; }
      const mid = portrait ? W / 2 : left ? Math.max(left + tw / 2, (left + right) / 2) : Math.min(W / 2, right - tw / 2), bx = mid - tw / 2;
      const by = portrait ? (human ? rows().tools + 4 : rows().hint) * dpr - u * .65 : oy + VIEW_H * S - u * 2.4;
      ctx.fillStyle = 'rgba(28,52,60,.55)'; ctx.beginPath(); ctx.roundRect(bx, by, tw, u * 1.3, u * .65); ctx.fill();
      ctx.fillStyle = '#fffbea'; ctx.fillText(msg, mid, by + u * .66);
    }
    for (const b of actions()) {
      const d = dpr;
      ctx.fillStyle = b.id === 'share' ? 'rgba(255,236,170,.92)' : 'rgba(255,250,238,.82)'; ctx.beginPath(); ctx.roundRect(b.x * d, b.y * d, b.w * d, b.h * d, b.h * d / 2); ctx.fill();
      ctx.lineWidth = Math.max(1.5, d); ctx.strokeStyle = 'rgba(28,52,60,.3)'; ctx.stroke();
      ctx.fillStyle = '#23404a'; ctx.font = `600 ${Math.round(b.h * .38) * d}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.label, (b.x + b.w / 2) * d, (b.y + b.h / 2) * d + d);
    }
    ctx.restore();
    if (usingTouch && human) {
      const z = zones();
      for (const [k, glyph] of [['l', '◀'], ['r', '▶'], ['j', '⤒']]) {
        const [x, yy, rad] = z[k];
        ctx.fillStyle = touch[k] ? 'rgba(255,250,235,.45)' : 'rgba(255,250,235,.22)'; ctx.beginPath(); ctx.arc(x * dpr, yy * dpr, rad * dpr, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(40,60,60,.6)'; ctx.font = `${rad * dpr * .8}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, x * dpr, yy * dpr + 1);
      }
    }
  }
  // The portrait console: a panel under the stage, and the chapter's journey
  // strip: where Pip is between the last landmark and the next, and the ghost.
  function drawConsole() {
    if (!portrait) return;
    const y0 = Math.round(consoleY * dpr), W = cv.width, H = cv.height, accent = {meadow: '#9be06a', frost: '#bfe4ff', sky: '#e7dcff', caves: '#a98bf5'}[biomeAt(pl.x)];
    const g = ctx.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#22343d'); g.addColorStop(1, '#152127');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
    ctx.globalAlpha = .75; ctx.fillStyle = accent; ctx.fillRect(0, y0, W, Math.max(2, dpr * 1.5)); ctx.globalAlpha = 1;
    const d = dpr, yc = rows().strip, span = REGION * CW * TS, r = Math.floor(pl.x / span), f = clamp(0, pl.x / span - r, 1);
    const left = 14 * d, right = W - 46 * d, ty = (yc + 34) * d, at = q => left + (right - left) * q;
    ctx.textBaseline = 'middle'; ctx.font = `600 ${12 * d}px system-ui,-apple-system,sans-serif`;
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe9a8'; ctx.fillText(`Chapter ${r + 1} · ${BIOMES[regionBiome(r)].name}`, left, (yc + 5) * d);
    ctx.textAlign = 'right'; ctx.fillStyle = '#d9ecf0'; ctx.fillText(`${BIOMES[regionBiome(r + 1)].mark} · ${Math.max(0, Math.round(((r + 1) * span - pl.x) / TS))} m`, right, (yc + 5) * d);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.roundRect(left, ty - 2.5 * d, right - left, 5 * d, 2.5 * d); ctx.fill();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.roundRect(left, ty - 2.5 * d, Math.max(5 * d, (right - left) * f), 5 * d, 2.5 * d); ctx.fill();
    const gp = ghostAt(Math.min(frameNo, ghost ? ghost.frames.length : 0));
    if (gp) { const q = gp.x / span - r; if (q >= -.02) { ctx.globalAlpha = .85; ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(at(clamp(0, q, 1)), ty, 4.5 * d, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
    if (sheet.complete && sheet.naturalWidth) ctx.drawImage(sheet, 0, 0, FRAME_W, FRAME_H, at(f) - 7.5 * d, ty - 17 * d, 15 * d, 18.75 * d);
    else { ctx.fillStyle = '#3f8a6a'; ctx.beginPath(); ctx.arc(at(f), ty, 6 * d, 0, 7); ctx.fill(); }
    ctx.translate(right + 24 * d, ty + 9 * d); landmarkArt(regionBiome(r + 1), .17 * d, frameNo);
    ctx.restore();
    // Spare room (tall phones, nobody on the thumb pad): the chapter so far.
    const free = rows().hint + 26, Hc = cv.clientHeight;
    if (Hc - free < 64 || (human && usingTouch)) return;
    seen = seen || new Set(store.get('pip-run:seen') || []);
    const best = worldMode === 'daily' ? [bestToday ? `${bestToday} m` : '—', 'your best today'] : ghost ? [`${ghost.m} m`, worldMode === 'friend' ? 'their run' : 'ghost'] : [`${Math.floor(maxX / TS)} m`, 'this run'];
    const cells = [[`★ ${seeds - journey.seeds0}`, 'seeds this chapter'], [clock(Math.max(0, frameNo - journey.start) / RATE), 'in this chapter'], [`${seen.size} / ${Object.keys(FINDS).length}`, 'found'], best];
    const cy = (free + Math.min(Hc - 12, free + 90)) / 2, cw = (cv.clientWidth - 24) / cells.length;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    cells.forEach(([v, label], i) => {
      const x = (12 + cw * (i + .5)) * d;
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.roundRect(x - (cw / 2 - 4) * d, (cy - 26) * d, (cw - 8) * d, 52 * d, 10 * d); ctx.fill();
      ctx.fillStyle = '#fffbea'; ctx.font = `700 ${16 * d}px system-ui,-apple-system,sans-serif`; ctx.fillText(v, x, (cy - 7) * d);
      ctx.fillStyle = '#9fb8bf'; ctx.font = `500 ${10 * d}px system-ui,-apple-system,sans-serif`; ctx.fillText(label, x, (cy + 13) * d);
    });
    ctx.restore();
  }
  // Tool icons, drawn at any size (screen or world).
  function toolIcon(id, x, y, size, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
    if (id === 'creature') {
      const s = size / 16;
      ctx.fillStyle = '#5b4030'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 4 * s, 6.5 * s, 3 * s, 1.6 * s, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#9a6c44'; ctx.beginPath(); ctx.ellipse(0, 1 * s, 7 * s, 6 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6fbf4f'; ctx.beginPath(); ctx.ellipse(1.5 * s, -6 * s, 3.2 * s, 1.5 * s, -.6, 0, 7); ctx.fill();
      for (const ex of [-2.6, 2]) { ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(ex * s, 0, 1.9 * s, 2.3 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#2b2018'; ctx.beginPath(); ctx.arc((ex - .5) * s, .3 * s, 1 * s, 0, 7); ctx.fill(); }
    } else {
      const img = tileCanvas(id === 'spring' ? SPRING : BRICK, false);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
  }
  function drawDirectorWorld() {
    if (human || replay) return;
    if (tool && hover) {
      const [tx, ty] = hover, ok = !why(tool, tx, ty) && charges > 0, [x, y] = W2D(tx * TS, ty * TS), n = TS * S;
      ctx.save(); ctx.strokeStyle = ok ? 'rgba(140,240,150,.9)' : 'rgba(255,120,100,.9)'; ctx.lineWidth = Math.max(2, S * .5);
      ctx.setLineDash([S * 1.5, S]); ctx.strokeRect(x + 1, y + 1, n - 2, n - 2); ctx.restore();
      toolIcon(tool, x + n / 2, y + n / 2, n * .9, .55);
    }
    for (const q of notes) {
      const [x, y] = W2D(q.x, q.y - q.t * .25), a = Math.min(1, (110 - q.t) / 25), u = Math.max(12, 7 * S);
      ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${u}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(20,30,36,.65)'; ctx.fillText(q.text, x + 1.5, y + 1.5); ctx.fillStyle = q.col; ctx.fillText(q.text, x, y); ctx.restore();
    }
  }
  function drawDirectorHud() {
    if (human || replay) return;
    const bar = toolbar(), d = dpr;
    for (const b of bar) {
      const on = tool === b.id, cx = (b.x + b.w / 2) * d, cy = (b.y + b.h / 2) * d, r = b.w / 2 * d;
      ctx.fillStyle = on ? 'rgba(255,236,170,.95)' : 'rgba(255,250,238,.82)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.lineWidth = Math.max(2, r * .09); ctx.strokeStyle = on ? '#e0951a' : 'rgba(28,52,60,.35)'; ctx.stroke();
      toolIcon(b.id, cx, cy, r * 1.05, charges > 0 ? 1 : .4);
      ctx.fillStyle = 'rgba(28,52,60,.7)'; ctx.font = `600 ${r * .42}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(TOOLS.indexOf(TOOLS.find(t => t.id === b.id)) + 1, cx + r * .72, cy - r * .72);
    }
    const last = bar[bar.length - 1], x0 = (last.x + last.w + 14) * d, cy = (last.y + last.h / 2) * d, u = last.h * d;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < charges ? '#ffd36a' : 'rgba(255,250,238,.35)'; ctx.beginPath(); ctx.arc(x0 + i * u * .32, cy - u * .16, u * .11, 0, 7); ctx.fill(); }
    if (charges < 3) { ctx.strokeStyle = 'rgba(255,211,106,.9)'; ctx.lineWidth = u * .05; ctx.beginPath(); ctx.arc(x0 + charges * u * .32, cy - u * .16, u * .11, -Math.PI / 2, -Math.PI / 2 + chargeT / 360 * Math.PI * 2); ctx.stroke(); }
    ctx.font = `700 ${u * .3}px system-ui,-apple-system,sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(20,30,36,.6)'; ctx.fillText(`Director ${dirScore}`, x0 - u * .1 + 1, cy + u * .2 + 1); ctx.fillStyle = '#fffbea'; ctx.fillText(`Director ${dirScore}`, x0 - u * .1, cy + u * .2);
  }
  function scene(arcs, at) {
    const m = biomeMix();
    drawBackground(); drawDestination(); drawTiles(); drawPrints(); drawGrass(); drawLeaves(); drawMovers(); drawCrystals(); drawSeeds(); drawMarks();
    drawItems();
    for (const e of enemies) drawEnemy(e);
    drawGhost(); drawPip(); drawParts(); drawWeather(m); drawFore(m); drawDusk(m); drawLight(m); drawDarkness(m);
    if (!human || replay) drawThoughts(arcs, at);
    drawWary(); drawDirectorWorld();
  }
  // The camera eases in on Pip during tense moments and replays. The scene is
  // drawn unscaled to a buffer and composited, so tiles never show seams.
  let zoom = 1, buf = null;
  function composite(drawScene) {
    if (zoom < 1.003) { view = {zoom: 1, cx: 0, fy: 0}; ctx = main; main.setTransform(1, 0, 0, 1, 0, 0); drawScene(); return; }
    if (!buf || buf.width !== cv.width || buf.height !== cv.height) { buf = document.createElement('canvas'); buf.width = cv.width; buf.height = cv.height; }
    ctx = buf.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); drawScene();
    const [fx, fy] = W2D(pl.x + 6, pl.y + 4), cx = cv.width * .38 + (fx - cv.width * .38) * .5;
    view = {zoom, cx, fy};
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.drawImage(buf, cx - cx * zoom, fy - fy * zoom, cv.width * zoom, cv.height * zoom);
    ctx = main;
  }
  function render() {
    zoom += ((replay ? 1.16 : arrival && arrival.phase === 'cheer' ? 1.1 : 1 + .09 * tension) - zoom) * .08;
    if (replay) {
      const snap = replay.frames[Math.min(replay.frames.length - 1, Math.floor(replay.i))];
      const live = {pl, facing, anim, landedAt, dead, inv, cam, enemies, parts, bumps, frameNo, sq, skidding, big, growing, items};
      ({pl, facing, anim, landedAt, dead, inv, cam, enemies, parts, bumps, frameNo, sq, skidding, big, growing, items} = snap);
      composite(() => scene(snap.arcs, snap.at));
      ctx.setTransform(1, 0, 0, 1, 0, 0); drawConsole(); drawHud();
      ({pl, facing, anim, landedAt, dead, inv, cam, enemies, parts, bumps, frameNo, sq, skidding, big, growing, items} = live);
      return;
    }
    // Draw between the last two ticks; a jump of more than a few tiles is a
    // respawn or a restart, shown as is.
    const k = clamp(0, acc, 1), lerp = (a, b) => Math.abs(b - a) > 48 ? b : a + (b - a) * k;
    const live = {pl, cam}, ex = enemies.map(e => [e.x, e.y]);
    pl = {...pl, x: lerp(prev.x, pl.x), y: lerp(prev.y, pl.y)}; cam = lerp(prev.cam, cam); drawT = frameNo - 1 + k;
    for (const e of enemies) if (e.px !== undefined) { e.x = lerp(e.px, e.x); e.y = lerp(e.py, e.y); }
    composite(() => scene(plan && plan.arcs, plan ? plan.at : 0));
    ({pl, cam} = live); enemies.forEach((e, i) => { [e.x, e.y] = ex[i]; }); drawT = null;
    ctx.setTransform(1, 0, 0, 1, 0, 0); drawConsole(); drawTitle(); drawCard(); drawChapter(); drawHud();
  }

  /* ---------------- loop ---------------- */
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, visible = !document.hidden, raf = 0, last = 0, acc = 0;
  // The simulation runs at 46 ticks a second (a calmer clock than 60); the
  // renderer interpolates between ticks, so motion stays smooth at any rate.
  const RATE = 46;
  function frame(now) {
    raf = 0;
    if (!playing || !visible) return;
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    if (replay) {
      if (human) replay = null;
      else { replay.i += dt * 60 * .5; if (replay.i >= replay.frames.length) replay = null; }
    } else acc += dt * RATE * (1 - .45 * tension);
    let n = 0;
    while (!replay && acc >= 1 && n < 6) { tick(); acc -= 1; n++; }
    if (acc > 1) acc = 1;
    if (typeof PipAudio !== 'undefined') {
      const m = biomeMix(), biomes = {}; biomes[m.a] = 1 - m.w; biomes[m.b] = (biomes[m.b] || 0) + m.w;
      const d = dayAt(pl.x);
      PipAudio.update({biomes, biome: m.w > .5 ? m.b : m.a, tension, wind: biomeAt(pl.x) === 'sky' ? windAt(pl.x) : 0, night: d.night + d.dusk * .5, dt});
    }
    render(); raf = requestAnimationFrame(frame);
  }
  const hush = () => { if (typeof PipAudio !== 'undefined') PipAudio.pause(!playing || !visible); };
  function setPlaying(on) {
    playing = Boolean(on); last = 0; hush();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (playing && visible) raf = requestAnimationFrame(frame); else render();
  }
  addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'pip:motion') setPlaying(e.data.playing); });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; last = 0; hush(); if (visible && playing && !raf) raf = requestAnimationFrame(frame); });
  addEventListener('resize', () => { layout(); render(); });
  sheet.onload = backdrop.onload = propsImg.onload = mtnImg.onload = () => { if (!playing) render(); };
  addEventListener('hashchange', start);
  addEventListener('pagehide', saveBest);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveBest(); });
  layout(); start();
  if (playing) raf = requestAnimationFrame(frame);
  // Test hook: lets the smoke test drive the simulation without a browser clock.
  window.__pipRun = {tick, reset, state: () => ({pl, enemies, seeds, maxX, dead, human, cam, viewW}), GAP, layout, tileAt: (x, y) => tileAt(x, y),
    art: ci => { const ch = chunk(ci); return ch && {art: chunkArt(ch, Math.round(TS * S)), biome: ch.biome}; }, render: () => render(), fx: () => ({parts: parts.length, prints: prints.length, rustled: rustle.size}), dayAt,
    scores: () => { const th = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash' && Math.abs(e.x - pl.x) < 260); return OPTIONS.map(o => [o.dir, o.wait, o.hold, Math.round(simulate(o, th).score)]); },
    actions: () => actions(),
    tile: (x, y, v) => setTile(x, y, v),
    rollout: i => { const th = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash' && Math.abs(e.x - pl.x) < 260); const r = simulate(OPTIONS[i], th); return {o: OPTIONS[i], score: r.score, death: r.death, pts: r.pts}; },
    journey: () => ({chapters, arrival: !!arrival, chapter: chapter && {...chapter}}), stats: () => stats, biomeAt: x => biomeAt(x), GAPS, features: () => [...chunks.values()].flatMap(ch => ch.features), wonder: r => regionWonder(r),
    debug: () => ({tension, risk, marks: marks.length, replay: !!replay, zoom, big, items: items.length}),
    director: {arm: t => { tool = t; }, refill: () => { charges = 3; }, place: (tx, ty) => place(tx, ty), grow, info: () => ({tool, charges, dirScore, notes: notes.map(n => n.text)})},
    ghost: {encode: () => encodeRun(run), decode: decodeRun, race: code => { const r = decodeRun(code), live = seed; ghost = r && buildGhost(r, 'friend'); reset(live); return ghost; }, at: f => ghostAt(f), run: () => run}};
})();
