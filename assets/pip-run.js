/* Pip Run — a small original platformer.
 * - Fixed 60 Hz physics with sub-pixel motion: acceleration, skids, variable
 *   jump height (hold to jump higher), coyote time and jump buffering.
 * - A seeded, endless tile world built from a chunk grammar whose gaps are
 *   sized from the same physics, so every stretch can be cleared.
 * - Creatures are tiny rule sets: a walker that turns at walls, a snail that
 *   turns at ledges and retreats into a kickable shell, a hopper and a flier.
 * - When nobody plays, a demo player takes over. It presses the same buttons
 *   a person would and plans each move by simulating the real physics ahead.
 * Original characters and art; no franchise assets, audio or tracking.
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
  const EMPTY = 0, EARTH = 1, BRICK = 2, BLOCK = 3, USED = 4, PIPE_L = 5, STONE = 6, PIPE_R = 7, SPRING = 8, CEIL = 9, CRUMBLE = 10, SPITTER = 11;

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
  const REGION = 6;                                   // chunks per region (~144 m)
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
  function setTile(tx, ty, v) { const ci = Math.floor(tx / CW), ch = chunks.get(ci); if (ch) ch.t[ty * CW + tx - ci * CW] = v; }

  const PIECES = [
    {id: 'run', w: 24, from: 1}, {id: 'gap', w: 22, from: 1}, {id: 'step', w: 14, from: 1}, {id: 'tier', w: 16, from: 1},
    {id: 'pipe', w: 12, from: 1, not: ['sky']}, {id: 'pyramid', w: 12, from: 1, not: ['caves']},
    {id: 'pad', w: 12, from: 1, only: ['sky']}, {id: 'isles', w: 10, from: 1, only: ['sky']},
    {id: 'ferry', w: 3, from: 2, feature: true}, {id: 'stairs', w: 2.5, from: 2, feature: true}, {id: 'crumble', w: 3, from: 3, feature: true},
    {id: 'spitter', w: 2.5, from: 5, feature: true}, {id: 'lift', w: 2.5, from: 4, feature: true, not: ['sky', 'caves']}
  ];
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
    const flat = n => { n = Math.min(n, CW - c); for (let i = 0; i < n; i++) { col(c, h); if (i > 0 && i < n - 1) ch.safe.add(c); c++; } return n; };
    const seedRow = (c0, n, row) => { for (let i = 0; i < n; i++) ch.seeds.push({x: wx(c0 + i) + 8, y: row * TS + 8, got: false}); };
    const enemy = (kind, c0, hh) => ch.spawns.push({kind, x: wx(c0) + 1, y: surface(hh) - 14});
    const kinds = () => { const k = r(); return d > .5 && k < .2 ? 'flier' : d > .3 && k < .4 ? 'hopper' : d > .15 && k < .65 ? 'snail' : 'walker'; };
    if (ci === 0) {
      flat(CW); seedRow(14, 3, ROWS - h - 3);
      gen.h = h; chunks.set(ci, ch); prune(); return;
    }
    const feature = (id, c0) => ch.features.push({id, x: wx(c0)});
    // One piece of route. Returns false when it did not fit (a short run
    // is laid instead), so the bag only remembers pieces that were placed.
    function piece(id, room) {
      switch (id) {
        case 'run': {                                  // open run, maybe a creature and a block row
          const c0 = c, n = flat(4 + (r() * 5 | 0));
          if (n >= 4 && r() < .4 + .3 * d) { const kd = kinds(); kd === 'flier' ? ch.spawns.push({kind: kd, x: wx(c0 + 2), y: surface(h) - 56}) : enemy(kd, c0 + 1 + (r() * (n - 2) | 0), h); }
          if (n >= 4 && r() < .45) {
            const row = ROWS - h - 4, len = 1 + (r() * Math.min(4, n - 1) | 0), s0 = c0 + 1;
            for (let i = 0; i < len; i++) set(s0 + i, row, r() < .45 ? BLOCK : BRICK);
            if (r() < .5) seedRow(s0, len, row - 2);
          } else if (r() < .35) seedRow(c0 + 1, Math.min(3, n - 1), ROWS - h - 2);
          return true;
        }
        case 'gap': {                                  // sized from the jump physics
          const dh = [-2, -1, 0, 0, 1][r() * 5 | 0], h2 = H(h + dh), max = GAP[h2 - h] || 0;
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
          const h2 = H(h + [-1, 0, 1][r() * 3 | 0]), max = GAP[h2 - h] || 0;
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
          if (room < n * (pit + 1) + pit + 4 || h + n + 1 > 10) break;
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
    while (c < CW) {
      const room = CW - c;
      if (room < 5) { flat(room); break; }
      let sum = 0;
      const wts = bag.map(q => { const w = q.w * (q.feature ? .6 + .8 * d : 1) * .3 ** gen.recent.filter(id => id === q.id).length; sum += w; return w; });
      let k = r() * sum, i = 0;
      while (i < bag.length - 1 && k > wts[i]) k -= wts[i++];
      if (piece(bag[i].id, room)) { gen.recent.push(bag[i].id); if (gen.recent.length > 6) gen.recent.shift(); }
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
    enemies = []; parts = []; seeds = 0; cam = 0; cp = {x: 40, y: pl.y}; maxX = 40; dead = 0; inv = 0; landedAt = -99; anim = 0; facing = 1; frameNo = 0;
    big = false; growing = 0; items = []; if (typeof stats !== 'undefined') stats = {bumps: 0, sprouts: 0};
    if (typeof charges !== 'undefined') { tool = null; charges = 3; chargeT = 0; dirScore = 0; notes = []; placed = []; }
    title = null; lastRegion = -1;
    plan = null; marks = []; risk = .25; tension = 0; wary = 0; stompTimes = []; history = []; moment = null; replay = null; lastReplay = -1e9; usedAt = new Map();
    simW = Math.round(viewW); run = {seed, w: simW, inputs: [], events: [], human: 0, m: 0};
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
  function updateEnemy(e) {
    e.t++;
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
    // Wait for open sky before leaping, unless the ground ends right underfoot:
    // jumping under a block row bonks Pip's head and drops him short of the gap.
    if (b.ground && st.auto <= 0 && danger(b, threats, tf) && (headroom(b) || !solid(Math.floor((b.x + b.w + 3) / TS), Math.floor((b.y + b.h + 2) / TS)))) st.auto = 15;
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
    const end = (score, death) => { pts.push([b.x + 6, b.y + 10]); return {score, death, pts}; };
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
  function demoInput() {
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
  function toolbar() {
    const W = cv.clientWidth, H = cv.clientHeight, top = oy / dpr, bandH = VIEW_H * S / dpr;
    const size = Math.round(Math.max(40, Math.min(56, bandH * .1))), gap = Math.round(size * .25);
    const y = H > W ? top + bandH + size * .35 : top + bandH - size - 12;
    return TOOLS.map((t, i) => ({...t, x: 12 + i * (size + gap), y, w: size, h: size}));
  }
  // Share and restart sit at the opposite end of the toolbar's row. Hidden while
  // someone plays by touch: that corner is the jump button then.
  function actions() {
    if (replay || (human && usingTouch)) return [];
    // In portrait the row is too narrow for both, so they go on a row below.
    const bar = toolbar(), h = Math.round(bar[0].h * .72), W = cv.clientWidth, y = cv.clientHeight <= W ? bar[0].y + (bar[0].h - h) / 2 : bar[0].y + bar[0].h + 12;
    main.font = `600 ${Math.round(h * .38)}px system-ui,-apple-system,sans-serif`;
    let x = W - 12;
    return [['share', '⤴ Share run'], ['restart', ghost ? '↺ Race again' : '↺ Restart']].map(([id, label]) => {
      const w = Math.round(main.measureText(label).width + h * .9); x -= w; const b = {id, label, x, y, w, h}; x -= 8; return b;
    });
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
    if (reason) { note(reason, tx * TS + 8, ty * TS, '#ffd9cf'); return; }
    if (charges < 1) { note('Recharging…', tx * TS + 8, ty * TS, '#ffd9cf'); return; }
    const before = imagine(), undo = applyPlacement(tool, tx, ty), after = imagine();
    // Unfair is either certain doom or a trap: no surviving future gets past a
    // spot that some future could get past before.
    const past = r => r.arcs.some(a => a.death < 0 && a.pts[a.pts.length - 1][0] > tx * TS + 20);
    if (after.arcs[after.best].death >= 0) { undo(); note('Too cruel — Pip couldn’t survive that', tx * TS + 8, ty * TS, '#ff9f8f'); return; }
    if (past(before) && !past(after)) { undo(); note('Too cruel — that would trap Pip', tx * TS + 8, ty * TS, '#ff9f8f'); return; }
    charges--;
    logEvent({f: frameNo + 1, k: tool[0], x: tx, y: ty});   // it is in the world from the next tick on
    placed.push({kind: tool, tx, ty, x: tx * TS + 8, frame: frameNo});
    const rerouted = after.best !== before.best, cost = Math.max(0, before.arcs[before.best].score - after.arcs[after.best].score);
    const pts = rerouted ? Math.round(20 + Math.min(80, cost * .5)) : 5;
    dirScore += pts; note(rerouted ? `Pip reroutes +${pts}` : `Pip shrugs it off +${pts}`, tx * TS + 8, ty * TS);
    sparkle(tx * TS + 8, ty * TS + 8); plan = null;   // replan now: the thought lines visibly change
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
    if (p) { placed.splice(placed.indexOf(p), 1); dirScore += 150; note('Gotcha! +150', pl.x + 6, pl.y - 6, '#ffd36a'); }
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
    if (tool) { place(...cellAt(e.clientX, e.clientY)); return true; }
    return false;
  }

  /* ---------------- input ---------------- */
  const keys = new Set(), touch = {l: false, r: false, j: false};
  let human = false, idleSince = 0, usingTouch = false, hintUntil = 0;
  const takeOver = () => { if (!human) { human = true; hintUntil = performance.now() + 6000; } idleSince = performance.now(); };
  addEventListener('keydown', e => {
    const k = e.code;
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
    const W = cv.clientWidth, H = cv.clientHeight, s = Math.min(W, H) * .16, y = H - s * .9;
    return {l: [s * .85, y, s * .55], r: [s * 2.05, y, s * .55], j: [W - s * .95, y, s * .65]};
  };
  function readTouches(list) {
    touch.l = touch.r = touch.j = false;
    const z = zones();
    for (const p of list.values()) {
      for (const k of ['l', 'r', 'j']) { const [x, y, rad] = z[k]; if (Math.hypot(p.x - x, p.y - y) < rad * 1.5) touch[k] = true; }
      if (!touch.l && !touch.r && !touch.j) { if (p.x > cv.clientWidth * .5) touch.j = true; }
    }
  }
  const pointers = new Map();
  cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') usingTouch = true; const a = actions().find(b => e.offsetX >= b.x && e.offsetX <= b.x + b.w && e.offsetY >= b.y && e.offsetY <= b.y + b.h); if (a) { (a.id === 'share' ? shareRun : restart)(); return; } if (!human && directorPointer(e)) return; if (e.pointerType === 'mouse') { takeOver(); return; } usingTouch = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY}); readTouches(pointers); takeOver(); });
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
    if (big) { seeds += 5; sparkle(pl.x + 6, pl.y); return; }
    big = true; growing = 36; pl.y -= 9; pl.h = P.h + 9; pl.w = P.w + 2; sparkle(pl.x + 6, pl.y + 8);
  }
  function shrink() { big = false; growing = 36; pl.y += 9; pl.h = P.h; pl.w = P.w; inv = 110; puff(pl.x + 6, pl.y + 10, '#fff4dc', 7); }
  function die() {
    if (dead || inv) return;
    if (big) { shrink(); return; }     // a big Pip takes one hit and shrinks instead of tumbling
    gotcha(); remember(); dead = 1; pl.vy = -5.2; pl.vx = 0; puff(pl.x + 6, pl.y + 10, '#fff4dc', 7); }
  // A tumble leaves a mark the planner steers around, and makes Pip warier for a while.
  function remember() { marks.push({x: pl.x, y: Math.min(pl.y, VIEW_H - P.h), at: frameNo}); risk = Math.min(1, risk + .35); }
  const liveInput = () => human ? humanInput() : demoInput();
  function tick(src = liveInput) {
    if (replay) replay = null;   // only headless callers tick during a replay; the live loop pauses
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
    const ev = stepBody(pl, inp);
    crumbleTick();
    if (pl.x < cam) { pl.x = cam; pl.vx = Math.max(0, pl.vx); }
    if (inp.r && !inp.l) facing = 1; else if (inp.l && !inp.r) facing = -1;
    anim += Math.abs(pl.vx);
    sq *= .78;
    skidding = pl.ground && Math.abs(pl.vx) > 1 && (inp.l && pl.vx > 0 || inp.r && pl.vx < 0);
    if (ev.jumped) { sq = 1; puff(pl.x + 6, pl.y + pl.h, '#f3e2c0', 4); }
    if (ev.landed) { sq = -1; landedAt = frameNo; puff(pl.x + 6, pl.y + pl.h, '#efdcb7', 5); }
    if (pl.ground && Math.abs(pl.vx) > 1.4 && (inp.l && pl.vx > 0 || inp.r && pl.vx < 0) && frameNo % 4 === 0) puff(pl.x + 6, pl.y + pl.h, '#efdcb7', 2);
    if (ev.bump) bump(ev.bump[0], ev.bump[1]);
    if (pl.y > VIEW_H + 24) { if (!dead) { gotcha(); remember(); } dead = 30; pl.vy = 0; if (big) { big = false; pl.h = P.h; pl.w = P.w; } }
    if (inv) inv--;
    if (growing) growing--;
    if (ev.sprung) { sq = 1; bumps.push({tx: ev.sprung[0], ty: ev.sprung[1], t: 0}); puff(pl.x + 6, pl.y + pl.h, '#fff4dc', 5); assist(ev.sprung); }
    items = items.filter(updateItem);
    // A safe, grounded spot becomes the next respawn point.
    if (pl.ground) {
      const tx = Math.floor((pl.x + 6) / TS), ch = chunks.get(Math.floor(tx / CW));
      if (ch && ch.safe.has(tx - ch.ci * CW) && pl.x > cp.x + 64 && !enemies.some(e => Math.abs(e.x - pl.x) < 80)) cp = {x: pl.x, y: pl.y};
    }
    maxX = Math.max(maxX, pl.x);
    if (!ghostSim && run.inputs.length < RUN_MAX) { run.m = Math.floor(maxX / TS); if (frameNo % 300 === 0) saveBest(); }
    const region = Math.floor(pl.x / (REGION * CW * TS));
    if (region !== lastRegion) { lastRegion = region; title = {id: regionBiome(region), t: 0}; }
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
        e.state = 'slide'; e.vx = pl.x + 6 < e.x + 7 ? 3.6 : -3.6; inv = Math.max(inv, 12);
        if (stomp) pl.vy = -4.4;
      } else if (stomp) {
        if (e.kind === 'snail') { e.state = 'shell'; e.vx = 0; e.h = 12; e.y += 2; }
        else if (e.kind === 'flier') { e.state = 'dead'; e.vy = 0; e.vx = 0; }
        else { e.state = 'squash'; e.t = 0; }
        pl.vy = inp.j ? -6.4 : -4.4; pl.jumping = inp.j; puff(e.x + 7, e.y + 4, '#fff4dc', 6);
        stompTimes = stompTimes.filter(t => frameNo - t < 100); stompTimes.push(frameNo); if (stompTimes.length >= 2) noteMoment('stomp chain');
      } else die();
    }
    for (const ch of chunks.values()) for (const s of ch.seeds)
      if (!s.got && Math.abs(s.x - pl.x - 6) < 11 && Math.abs(s.y - pl.y - 10) < 14) { s.got = true; s.gotAt = frameNo; seeds++; sparkle(s.x, s.y); }
    parts = parts.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.star ? 0 : .08; p.vx *= .96; return --p.life > 0; });
    for (const b of bumps) b.t++;
    bumps = bumps.filter(b => b.t < 10);
  }
  let bumps = [];
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
        p.fired = frameNo; puff(px - 2, p.ty * TS + 8, '#e8d6a0', 3);
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
  function saveBest() {
    if (ghostSim || !run || worldMode !== 'daily' || seed !== dailySeed(day) || run.human < 300) return;
    const b = store.get('pip-run:best');
    if (!b || b.day !== day || run.m > b.m) store.set('pip-run:best', {day, m: run.m, code: encodeRun(run)});
  }
  function bestGhost() {
    const b = store.get('pip-run:best'), r = b && b.day === day && decodeRun(b.code);
    return r && r.seed === dailySeed(day) ? buildGhost(r, 'best') : null;
  }
  function start() {
    const h = (location.hash || '').slice(1), shared = h.startsWith('r=') ? decodeRun(h.slice(2)) : null;
    day = today(); ghost = null; toast = null;
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
  function layout() {
    const W = cv.clientWidth, H = cv.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // At least 16 tiles across (14 in portrait, where the stage sits above the touch pad).
    const k = Math.min(H / VIEW_H, W / ((H > W ? 14 : 16) * TS));
    const tsd = Math.max(8, Math.round(TS * k * dpr));
    S = tsd / TS; viewW = cv.width / S;
    const bandH = VIEW_H * S;
    oy = Math.round(H > W ? (cv.height - bandH) * .32 : (cv.height - bandH) / 2); ox = 0;
    tileCache = new Map(); farCache = null;
  }
  function tileCanvas(id, top, biome = 'meadow', under = false) {
    const themed = biome !== 'meadow' && (id === EARTH || id === BRICK || id === STONE || id === CEIL);
    const key = id + ':' + (top ? 1 : 0) + (themed ? ':' + biome + (under ? 'u' : '') : id === CRUMBLE ? ':' + biome : '');
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
    if (id === SPITTER) {                        // Podspitter: a bulb that spits seed pods to the left
      g.fillStyle = '#3f8d4a'; for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(8 + sd * 5, 14.4, 4.6, 1.8, sd * .3, 0, 7); g.fill(); }
      const q = g.createRadialGradient(9, 6, 1, 8, 8, 8); q.addColorStop(0, '#d7f58a'); q.addColorStop(1, '#5aa83c');
      g.fillStyle = q; g.beginPath(); g.ellipse(8.5, 8.5, 6.6, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#2f5f2a'; g.beginPath(); g.ellipse(2.8, 8.5, 2.6, 2.2, 0, 0, 7); g.fill();
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(8, 6, 1.6, 0, 7); g.fill(); g.fillStyle = '#2b2018'; g.beginPath(); g.arc(7.5, 6.2, .8, 0, 7); g.fill();
      g.fillStyle = '#e8484f'; g.beginPath(); g.ellipse(9.5, 2.2, 2, 1.3, .4, 0, 7); g.fill();
      tileCache.set(key, c2); return c2;
    }
    if (themed) {
      if (biome === 'frost') {
        if (id === EARTH || id === STONE) {
          g.fillStyle = grad(id === STONE ? '#e2ebf4' : '#c3d4e6', id === STONE ? '#b9c9db' : '#94abc6'); g.fillRect(0, 0, 16, 16);
          specks('rgba(110,135,165,.45)', [[4, 10, 1], [12, 6, .9], [9, 13, 1.2]]);
          if (id === STONE) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = .8; g.strokeRect(1, 1, 14, 14); }
          if (top) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 16, 4); g.beginPath(); for (let x = 0; x <= 16; x += 4) g.arc(x + 2, 4, 2.2, 0, Math.PI); g.fill(); g.fillStyle = '#dff0ff'; g.fillRect(0, 0, 16, 1); }
        } else {
          const q = g.createLinearGradient(0, 0, 16, 16); q.addColorStop(0, '#d8f4ff'); q.addColorStop(1, '#7cc8ef');
          rr(0, 0, 16, 16, 2, '#5aa6d1'); rr(.8, .8, 14.4, 14.4, 1.6, q);
          g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(3, 11); g.lineTo(8, 4); g.moveTo(7, 13); g.lineTo(12, 6); g.stroke();
        }
      } else if (biome === 'sky') {
        if (id === EARTH || id === STONE) {
          g.fillStyle = grad('#ddd6f3', '#bdb3e2'); g.fillRect(0, 0, 16, 16);
          specks('rgba(255,214,120,.6)', [[4, 9, .8], [11, 12, .7], [13, 5, .6]]);
          if (under) { g.fillStyle = '#a99fd6'; g.fillRect(0, 11, 16, 5); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); for (let x = 0; x <= 16; x += 5) g.arc(x + 2, 15, 2.4, Math.PI, 0); g.fill(); }
          if (top) { g.fillStyle = '#ffffff'; g.fillRect(0, 2, 16, 4); g.beginPath(); for (let x = -1; x <= 17; x += 5) g.arc(x + 2, 3, 3.1, Math.PI, 0); g.fill(); g.fillStyle = '#dce8ff'; g.fillRect(0, 5.5, 16, 1.2); }
        } else {
          rr(0, 0, 16, 16, 1.5, '#e3a64f'); g.fillStyle = '#f7d08a'; g.fillRect(.5, .5, 15, 2);
          g.fillStyle = '#b97a2c'; g.fillRect(0, 7.5, 16, 1); g.fillRect(7.5, 0, 1, 8); g.fillRect(3.5, 8, 1, 8); g.fillRect(11.5, 8, 1, 8);
        }
      } else {                                   // caves
        if (id === EARTH || id === STONE || id === CEIL) {
          g.fillStyle = grad(id === CEIL ? '#262138' : '#3b3550', id === CEIL ? '#1c182b' : '#2a253b'); g.fillRect(0, 0, 16, 16);
          specks('rgba(90,80,125,.6)', [[3, 5, 1.1], [11, 9, 1.3], [7, 13, .9]]);
          if (id === CEIL && under) { g.fillStyle = '#1c182b'; g.beginPath(); g.moveTo(1, 16); g.lineTo(4, 16); g.lineTo(2.5, 16); g.fill(); g.clearRect(0, 13, 16, 3); g.fillStyle = '#211c33'; for (const [x, w, l] of [[1, 5, 3], [8, 4, 2.6], [12, 3, 2]]) { g.beginPath(); g.moveTo(x, 13); g.lineTo(x + w, 13); g.lineTo(x + w / 2, 13 + l); g.fill(); } }
          if (top && id !== CEIL) { g.fillStyle = '#2fb79c'; g.fillRect(0, 0, 16, 3); g.fillStyle = '#6ff5d6'; for (const x of [2, 7, 12]) { g.beginPath(); g.arc(x, 1.4, .9, 0, 7); g.fill(); } }
        } else {
          const q = g.createLinearGradient(0, 0, 16, 16); q.addColorStop(0, '#a77bf0'); q.addColorStop(1, '#4b2f86');
          rr(0, 0, 16, 16, 2, '#33205e'); rr(.8, .8, 14.4, 14.4, 1.6, q);
          g.fillStyle = 'rgba(220,200,255,.7)'; g.beginPath(); g.moveTo(3, 3); g.lineTo(8, 3); g.lineTo(5, 9); g.fill();
        }
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
    } else if (id === BRICK || id === USED) {
      rr(0, 0, 16, 16, 1.5, id === BRICK ? '#c9693f' : '#9d7a5c');
      g.fillStyle = id === BRICK ? '#e08a5c' : '#b8957a'; g.fillRect(.5, .5, 15, 2);
      if (id === BRICK) { g.fillStyle = '#8d4428'; g.fillRect(0, 7.5, 16, 1); g.fillRect(7.5, 0, 1, 8); g.fillRect(3.5, 8, 1, 8); g.fillRect(11.5, 8, 1, 8); }
      else { g.fillStyle = '#7c5d45'; for (const [x, y] of [[3, 3], [13, 3], [3, 13], [13, 13]]) { g.beginPath(); g.arc(x, y, .9, 0, 7); g.fill(); } }
    } else if (id === BLOCK) {
      const gd = g.createLinearGradient(0, 0, 16, 16); gd.addColorStop(0, '#ffd66a'); gd.addColorStop(1, '#e09a2c');
      rr(0, 0, 16, 16, 2.5, '#9a5a1c'); rr(.8, .8, 14.4, 14.4, 2, gd);
      g.fillStyle = '#fff6cf'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 2.4 : 5.4; g.lineTo(8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r); }
      g.fill(); g.fillStyle = '#9a5a1c'; for (const [x, y] of [[2.6, 2.6], [13.4, 2.6], [2.6, 13.4], [13.4, 13.4]]) { g.beginPath(); g.arc(x, y, .8, 0, 7); g.fill(); }
    } else if (id === SPRING) {
      g.fillStyle = '#3b4a5c'; g.fillRect(2, 13, 12, 3);
      g.strokeStyle = '#c4ccd6'; g.lineWidth = 1.6; g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(3, 12.5 - k * 2.4); g.lineTo(13, 11.3 - k * 2.4); } g.stroke();
      rr(1, 2, 14, 4, 2, '#e8483f'); g.fillStyle = '#ff8a7a'; g.fillRect(3, 2.6, 10, 1.2);
    } else if (id === STONE) {
      rr(0, 0, 16, 16, 1.2, '#8f8a80'); rr(1, 1, 14, 14, 1, '#b9b2a4');
      g.fillStyle = '#d9d2c2'; g.fillRect(1, 1, 14, 2); g.fillStyle = '#958e81'; g.fillRect(1, 13, 14, 2);
    } else if (id === PIPE_L || id === PIPE_R) {
      const left = id === PIPE_L, pg = g.createLinearGradient(left ? 2 : -14, 0, left ? 30 : 14, 0);
      pg.addColorStop(0, '#2f8f6e'); pg.addColorStop(.35, '#7fe0b4'); pg.addColorStop(.6, '#3fae86'); pg.addColorStop(1, '#1f6b52');
      g.fillStyle = pg; g.fillRect(left ? 2 : 0, 0, 14, 16);
      g.fillStyle = '#1b5a45'; g.fillRect(left ? 2 : 14, 0, 1.2, 16);
      if (top) { g.fillStyle = pg; g.fillRect(left ? 0 : 0, 0, 16, 7); g.fillStyle = '#1b5a45'; g.fillRect(0, 6.5, 16, 1); if (left) g.fillRect(0, 0, 1.2, 7.5); else g.fillRect(14.8, 0, 1.2, 7.5); }
    }
    tileCache.set(key, c2); return c2;
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
    const haze = g.createLinearGradient(0, 0, 0, h); haze.addColorStop(0, 'rgba(226,242,248,.32)'); haze.addColorStop(.7, 'rgba(238,240,228,.5)'); haze.addColorStop(1, 'rgba(244,236,214,.62)');
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
  function biomeBackground(id) {
    const W = cv.width, H = cv.height, bandH = VIEW_H * S, fill = (stops) => { const q = ctx.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => q.addColorStop(o, c)); ctx.fillStyle = q; ctx.fillRect(0, 0, W, H); };
    if (id === 'meadow') {
      fill([[0, '#8fcdf2'], [.6, '#d8eef0'], [1, '#f4e6c8']]);
      const far = farLayer();
      if (far) {
        // The painted kingdom far away, softened once; mirrored tiles keep it seamless.
        const w = far.width, off = (cam * S * .12) % (2 * w);
        for (let x = -off - 2 * w, i = 0; x < W + w; x += w, i++) {
          ctx.save(); ctx.translate(x + (i % 2 ? w : 0), oy - bandH * .02); ctx.scale(i % 2 ? -1 : 1, 1); ctx.drawImage(far, 0, 0); ctx.restore();
        }
      }
      ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, oy + bandH, W, H - oy - bandH);
    } else if (id === 'frost') {
      fill([[0, '#9cc3e6'], [.55, '#e3eef8'], [1, '#f6fbff']]);
      const g = ctx.createRadialGradient(W * .78, oy + bandH * .18, 0, W * .78, oy + bandH * .18, bandH * .5); g.addColorStop(0, 'rgba(255,252,236,.85)'); g.addColorStop(1, 'rgba(255,252,236,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ridge(.1, .5, 46, '#e9f0f8', 1.3, true); ridge(.2, .64, 38, '#c9d9eb', 2.7, true); ridge(.34, .78, 24, '#a7bfdb', 4.1, true);
      ctx.fillStyle = '#94abc6'; ctx.fillRect(0, oy + bandH, W, H - oy - bandH);
    } else if (id === 'sky') {
      fill([[0, '#5fb0f0'], [.6, '#bfe3ff'], [1, '#eef8ff']]);
      // Distant islands drift slowly; a sea of clouds rolls below.
      for (let i = Math.floor(cam * .2 / 260) - 1, n = 0; n < Math.ceil(W / S / 260) + 3; i++, n++) {
        const x = (i * 260 - cam * .2 + (hash(seed ^ 0x51, i) % 90)) * S, y = oy + bandH * (.2 + (hash(seed ^ 0x52, i) % 26) / 100), w = (12 + hash(seed, i) % 12) * S;
        ctx.save(); ctx.globalAlpha = .55;
        ctx.fillStyle = '#a99fd6'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x - w * .3, y + w * .9); ctx.lineTo(x + w * .2, y + w * .6); ctx.lineTo(x + w, y); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x, y, w * 1.05, w * .16, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#6f9a7a'; for (const dx of [-.45, -.15, .3]) { ctx.beginPath(); ctx.moveTo(x + dx * w - w * .1, y - w * .05); ctx.lineTo(x + dx * w, y - w * .42); ctx.lineTo(x + dx * w + w * .1, y - w * .05); ctx.fill(); }
        ctx.restore();
      }
      for (const [par, base, a] of [[.25, .8, .7], [.42, .9, .85], [.6, .98, 1]]) {
        ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W + 12; x += 12) { const wx = x / S + cam * par + frameNo * .08; ctx.lineTo(x, oy + bandH * base - (Math.abs(Math.sin(wx * .045)) * 12 + Math.sin(wx * .011) * 6) * S); }
        ctx.lineTo(W, H); ctx.fill();
      }
    } else {
      fill([[0, '#0c0a18'], [.5, '#171329'], [1, '#221c35']]);
      ridge(.18, .14, 22, '#1a1529', 5.2, true, true); ridge(.18, .86, 20, '#1d1830', 6.1, true);
      for (let i = 0; i < 26; i++) {   // far crystals twinkle
        const x = ((i * 131.7 - cam * .15 * S / S * S) % (W + 40) + W + 40) % (W + 40) - 20, y = oy + bandH * (.25 + (i * 37 % 50) / 100), a = .25 + .25 * Math.sin(frameNo * .04 + i);
        ctx.fillStyle = ['rgba(95,242,216,', 'rgba(180,139,255,', 'rgba(255,143,208,'][i % 3] + a.toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, (1 + i % 3 * .5) * S * .5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#1d1830'; ctx.fillRect(0, oy + bandH, W, H - oy - bandH);
    }
  }
  function drawBackground() {
    const m = biomeMix();
    biomeBackground(m.a);
    if (m.w > 0) { ctx.save(); ctx.globalAlpha = m.w; biomeBackground(m.b); ctx.restore(); }
    drawWonder();
    drawLandmark(m);
  }
  /* ---------------- wonders ----------------
     Most regions hold one rare sight in the sky, seeded and never the same
     twice in a row: a sky whale, lanterns, balloons, a meteor shower, aurora. */
  const WONDERS = {meadow: ['whale', 'lanterns', 'balloons', 'meteors'], frost: ['aurora', 'meteors', 'whale'], sky: ['whale', 'balloons', 'lanterns'], caves: []};
  function regionWonder(r) {
    const raw = q => { const list = WONDERS[regionBiome(q)]; return q < 1 || !list.length || hash(seed ^ 0x40d, q) % 10 < 3 ? null : list[hash(seed ^ 0x40e, q) % list.length]; };
    const w = raw(r);
    if (!w || w !== raw(r - 1)) return w;
    const list = WONDERS[regionBiome(r)]; return list[(list.indexOf(w) + 1) % list.length];
  }
  function drawWonder() {
    const span = REGION * CW * TS, centre = cam + viewW / 2, region = Math.floor(centre / span), id = regionWonder(region);
    if (!id) return;
    const prog = centre / span - region, a = clamp(0, Math.min(prog / .12, (1 - prog) / .12), 1);
    if (a <= 0) return;
    const W = cv.width, bandH = VIEW_H * S, t = frameNo, s = S;
    ctx.save(); ctx.globalAlpha = a;
    if (id === 'whale') {
      const L = 120 * s, x = W + L - ((t * .45 * s) % (W + L * 2.4)), y = oy + bandH * .2 + Math.sin(t * .008) * 5 * s;
      ctx.fillStyle = 'rgba(143,176,216,.82)'; ctx.beginPath();
      ctx.moveTo(x - L * .5, y); ctx.bezierCurveTo(x - L * .5, y - L * .22, x + L * .25, y - L * .2, x + L * .42, y - L * .03);
      ctx.lineTo(x + L * .62, y - L * .14); ctx.lineTo(x + L * .56, y); ctx.lineTo(x + L * .64, y + L * .12); ctx.lineTo(x + L * .42, y + L * .03);
      ctx.bezierCurveTo(x + L * .2, y + L * .17, x - L * .45, y + L * .2, x - L * .5, y); ctx.fill();
      ctx.fillStyle = 'rgba(226,236,248,.9)'; ctx.beginPath(); ctx.ellipse(x - L * .12, y + L * .1, L * .32, L * .07, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(120,150,190,.6)'; ctx.lineWidth = 1.2 * s; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x - L * (.38 - k * .07), y + L * .08); ctx.lineTo(x - L * (.32 - k * .07), y + L * .15); ctx.stroke(); }
      ctx.fillStyle = 'rgba(120,150,195,.85)'; ctx.beginPath(); ctx.ellipse(x - L * .08, y + L * .13, L * .12, L * .035, .5, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b3550'; ctx.beginPath(); ctx.arc(x - L * .36, y - L * .02, 1.8 * s, 0, 7); ctx.fill();
      const sp = (t % 420) / 420;
      if (sp < .3) { ctx.fillStyle = `rgba(255,255,255,${.7 * (1 - sp / .3)})`; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x - L * .3 + (k - 2) * 4 * s * sp * 4, y - L * .2 - sp * 50 * s - Math.abs(k - 2) * 3 * s, (2.5 + sp * 6) * s, 0, 7); ctx.fill(); } }
    } else if (id === 'lanterns') {
      for (let i = 0; i < 28; i++) {
        const rise = (t * .22 * s + i * 61 * s) % (bandH * 1.25), y = oy + bandH * 1.05 - rise, x = ((i * 137.5 * s - cam * s * .2) % (W + 40) + W + 40) % (W + 40) - 20 + Math.sin(t * .02 + i) * 6 * s;
        const r = (3 + i % 3) * s, fade = Math.min(1, rise / (bandH * .2), (bandH * 1.25 - rise) / (bandH * .25));
        ctx.globalAlpha = a * fade;
        const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 3); gl.addColorStop(0, 'rgba(255,190,90,.55)'); gl.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = gl; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
        ctx.fillStyle = '#ff9f45'; ctx.beginPath(); ctx.roundRect(x - r * .7, y - r, r * 1.4, r * 2, r * .5); ctx.fill(); ctx.fillStyle = '#ffe08a'; ctx.fillRect(x - r * .35, y - r * .5, r * .7, r);
      }
    } else if (id === 'balloons') {
      const cols = [['#ff7a6b', '#ffe3a3'], ['#7fc8ff', '#ffffff'], ['#b98cf2', '#ffd36a'], ['#6fd59b', '#fff2c4'], ['#ffb347', '#e8484f']];
      for (let i = 0; i < 5; i++) {
        const k = (.6 + (i % 3) * .25) * s, x = ((i * W / 5 + t * .14 * s - cam * s * .08 * (1 + i % 3)) % (W + 200 * s) + W + 200 * s) % (W + 200 * s) - 100 * s, y = oy + bandH * (.12 + (i % 3) * .09) + Math.sin(t * .01 + i) * 6 * s;
        const [c1, c2] = cols[i];
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, y, 11 * k, 13 * k, 0, 0, 7); ctx.clip();
        for (let j = -3; j <= 3; j++) { ctx.fillStyle = j % 2 ? c1 : c2; ctx.fillRect(x + j * 3.2 * k - 1.6 * k, y - 14 * k, 3.2 * k, 28 * k); }
        ctx.restore();
        ctx.strokeStyle = 'rgba(90,70,50,.7)'; ctx.lineWidth = .7 * k; ctx.beginPath(); ctx.moveTo(x - 7 * k, y + 9 * k); ctx.lineTo(x - 3 * k, y + 19 * k); ctx.moveTo(x + 7 * k, y + 9 * k); ctx.lineTo(x + 3 * k, y + 19 * k); ctx.stroke();
        ctx.fillStyle = '#8a5a3b'; ctx.fillRect(x - 3.5 * k, y + 19 * k, 7 * k, 5 * k);
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
    if (seen.has(id) || card) return;
    seen.add(id); store.set('pip-run:seen', [...seen]); card = {id, t: 0};
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
  function landmarkArt(id, s, t) {
    const L = (x, y) => [x * s, -y * s];
    if (id === 'meadow') {           // Mushroom Gate
      for (const sd of [-1, 1]) {
        ctx.fillStyle = '#efe2c8'; ctx.beginPath(); ctx.roundRect(...L(sd * 34 - 7, 70), 14 * s, 70 * s, 5 * s); ctx.fill();
        ctx.fillStyle = '#e0523f'; ctx.beginPath(); ctx.ellipse(...L(sd * 34, 72), 30 * s, 18 * s, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff4e4'; for (const [dx, dy] of [[-12, 80], [4, 84], [14, 76]]) { ctx.beginPath(); ctx.arc(...L(sd * 34 + dx, dy), 3.4 * s, 0, 7); ctx.fill(); }
      }
      ctx.strokeStyle = '#5aa857'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(...L(-30, 60)); ctx.quadraticCurveTo(...L(0, 96), ...L(30, 60)); ctx.stroke();
      ctx.fillStyle = `rgba(255,214,110,${.6 + .3 * Math.sin(t * .1)})`; ctx.beginPath(); ctx.arc(...L(0, 84), 4 * s, 0, 7); ctx.fill();
    } else if (id === 'frost') {     // Frost Spire
      const g = ctx.createLinearGradient(...L(-20, 0), ...L(20, 140)); g.addColorStop(0, '#9fd2f5'); g.addColorStop(1, '#f2fbff'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(...L(-18, 0)); ctx.lineTo(...L(-10, 110)); ctx.lineTo(...L(0, 150)); ctx.lineTo(...L(10, 110)); ctx.lineTo(...L(18, 0)); ctx.fill();
      ctx.fillStyle = '#c4e6fb'; for (const [x, h] of [[-26, 60], [26, 72], [-38, 34], [38, 40]]) { ctx.beginPath(); ctx.moveTo(...L(x - 7, 0)); ctx.lineTo(...L(x, h)); ctx.lineTo(...L(x + 7, 0)); ctx.fill(); }
      ctx.fillStyle = `rgba(255,255,255,${.5 + .5 * Math.sin(t * .07)})`; ctx.beginPath(); ctx.arc(...L(-3, 120), 2.6 * s, 0, 7); ctx.fill();
    } else if (id === 'sky') {       // Sky Harbor: a floating island with a docked airship
      const bob = Math.sin(t * .03) * 3;
      ctx.fillStyle = '#b3a9de'; ctx.beginPath(); ctx.moveTo(...L(-50, 30 + bob)); ctx.quadraticCurveTo(...L(0, -30 + bob), ...L(50, 30 + bob)); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(...L(0, 30 + bob), 52 * s, 8 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f0a85a'; ctx.beginPath(); ctx.ellipse(...L(10, 92 + bob), 34 * s, 14 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a5a3b'; ctx.fillRect(...L(-6, 74 + bob), 30 * s, 8 * s);
      ctx.strokeStyle = '#6b4a34'; ctx.lineWidth = 1.2 * s; ctx.beginPath(); ctx.moveTo(...L(-4, 78 + bob)); ctx.lineTo(...L(-8, 66 + bob)); ctx.moveTo(...L(22, 78 + bob)); ctx.lineTo(...L(26, 66 + bob)); ctx.stroke();
      ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.moveTo(...L(-20, 96 + bob)); ctx.lineTo(...L(-34, 84 + bob)); ctx.lineTo(...L(-20, 84 + bob)); ctx.fill();
    } else {                          // Crystal Heart
      const pulse = .55 + .35 * Math.sin(t * .06), g = ctx.createRadialGradient(...L(0, 60), 0, ...L(0, 60), 70 * s);
      g.addColorStop(0, `rgba(200,150,255,${pulse})`); g.addColorStop(1, 'rgba(200,150,255,0)'); ctx.fillStyle = g; ctx.fillRect(...L(-70, 130), 140 * s, 140 * s);
      ctx.fillStyle = '#b48bff'; ctx.beginPath(); ctx.moveTo(...L(0, 120)); ctx.lineTo(...L(22, 60)); ctx.lineTo(...L(0, 0)); ctx.lineTo(...L(-22, 60)); ctx.fill();
      ctx.fillStyle = '#e6d6ff'; ctx.beginPath(); ctx.moveTo(...L(0, 120)); ctx.lineTo(...L(8, 60)); ctx.lineTo(...L(0, 0)); ctx.fill();
      ctx.fillStyle = '#5ff2d8'; for (const [x, h] of [[-30, 36], [30, 44], [-44, 22], [44, 26]]) { ctx.beginPath(); ctx.moveTo(...L(x - 6, 0)); ctx.lineTo(...L(x, h)); ctx.lineTo(...L(x + 6, 0)); ctx.fill(); }
    }
  }
  function drawLandmark(m) {
    const span = REGION * CW * TS, lx = (m.region + 1) * span, dist = lx - m.centre;
    if (dist > span * .92 || dist < -260) return;
    const near = 1 - Math.max(0, dist) / span, x = (viewW * .66 + dist * .1) * S, y = oy + VIEW_H * S * .8;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .9 * Math.min(1, (span * .92 - dist) / 300) * Math.min(1, (dist + 260) / 200);
    landmarkArt(regionBiome(m.region + 1), (.45 + .65 * near) * S, frameNo);
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
  // Caves are dark: Pip, crystals, seeds and star blocks carry light.
  let darkBuf = null;
  function drawCrystals() {
    for (const ch of chunks.values()) for (const k of ch.crystals) {
      const [x, y] = W2D(k.x, k.y); if (x < -40 || x > cv.width + 40) continue;
      const col = ['#5ff2d8', '#b48bff', '#ff8fd0'][k.hue], dir = k.up ? -1 : 1;
      for (const [dx, h, w] of [[-4, 12, 3], [0, 18, 3.6], [5, 10, 2.8]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + (dx - w) * S, y); ctx.lineTo(x + dx * S, y + dir * h * S); ctx.lineTo(x + (dx + w) * S, y); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(x + dx * S, y); ctx.lineTo(x + dx * S, y + dir * h * S); ctx.lineTo(x + (dx + w * .6) * S, y); ctx.fill();
      }
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
    ctx.drawImage(darkBuf, 0, 0);
    // Creature eyes glint in the dark.
    for (const e of enemies) { if (e.state === 'dead' || e.state === 'squash') continue; const [x, y] = W2D(e.x + 7, e.y + 5); if (x < -20 || x > cv.width + 20) continue; ctx.fillStyle = `rgba(255,240,170,${(.8 * w).toFixed(2)})`; for (const d of [-2.4, 2.4]) { ctx.beginPath(); ctx.arc(x + d * S, y, .9 * S, 0, 7); ctx.fill(); } }
  }
  function drawTiles() {
    const cd = camDev(), n = Math.round(TS * S), t0 = Math.floor(cam / TS) - 1, t1 = t0 + Math.ceil(viewW / TS) + 2;
    for (let tx = t0; tx <= t1; tx++) for (let ty = 0; ty < ROWS; ty++) {
      let id = tileAt(tx, ty); if (!id) continue;
      if (replay && id === USED && (usedAt.get(tx + ',' + ty) ?? -1) > frameNo) id = BLOCK;
      const b = bumps.find(q => q.tx === tx && q.ty === ty), lift = b ? Math.sin(b.t / 10 * Math.PI) * 4 * S : 0;
      const ch = chunks.get(Math.floor(tx / CW));
      const shake = id === CRUMBLE && crumbleFall.has(tx * 64 + ty) ? Math.sin(frameNo * 1.9 + tx) * .9 * S : 0;
      ctx.drawImage(tileCanvas(id, tileAt(tx, ty - 1) === EMPTY, ch ? ch.biome : 'meadow', tileAt(tx, ty + 1) === EMPTY), ox + tx * n - cd + shake, oy + ty * n - lift);
      if (id === BLOCK) { const a = .25 + .25 * Math.sin(frameNo * .08 + tx); ctx.fillStyle = `rgba(255,255,230,${a.toFixed(3)})`; ctx.fillRect(ox + tx * n - cd + n * .12, oy + ty * n + n * .1 - lift, n * .76, n * .08); }
    }
  }
  const W2D = (x, y) => [ox + x * S - camDev(), oy + y * S];
  // Ferries and lifts, dressed for their biome. Lifts show their rails.
  function drawMovers() {
    for (const ch of chunks.values()) for (const m of ch.movers) {
      const [mx, my] = moverAt(m, frameNo), [x, y] = W2D(mx, my), s = S, w = m.w * s, b = biomeAt(m.x);
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
    const [x, y] = W2D(e.x, e.y), s = S, w = e.w * s, h = e.h * s, step = Math.sin(e.t * .25);
    ctx.save(); ctx.translate(x + w / 2, y + h);
    if (e.state === 'dead') { ctx.rotate(Math.PI); ctx.translate(0, h); }
    if (e.vx > 0 && e.kind !== 'flier') ctx.scale(-1, 1);
    const eye = (ex, ey) => { ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.ellipse(ex, ey, 2 * s, 2.4 * s, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#2b2018'; ctx.beginPath(); ctx.arc(ex - .6 * s, ey + .3 * s, 1.1 * s, 0, 7); ctx.fill(); };
    if (e.state === 'squash') { ctx.fillStyle = '#7b5a3a'; ctx.beginPath(); ctx.ellipse(0, -2 * s, 8 * s, 2.5 * s, 0, 0, 7); ctx.fill(); ctx.restore(); return; }
    if (e.kind === 'pod') {             // a spiky seed pod, spinning as it flies
      ctx.translate(0, -5 * s); ctx.rotate(-e.t * .18);
      ctx.fillStyle = '#7a4f2a'; ctx.beginPath(); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, rr = (k % 2 ? 3.6 : 6.4) * s; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill();
      ctx.fillStyle = '#c99a62'; ctx.beginPath(); ctx.arc(0, 0, 3.4 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#f2d39a'; ctx.beginPath(); ctx.arc(-1 * s, -1 * s, 1.2 * s, 0, 7); ctx.fill();
      ctx.restore(); return;
    }
    if (e.kind === 'walker') {          // Mossbud: a round seed with a sprouting leaf
      ctx.fillStyle = '#5b4030'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 4 * s + step * sd * 1.5 * s, -1.2 * s, 3 * s, 1.6 * s, 0, 0, 7); ctx.fill(); }
      const g = ctx.createRadialGradient(-2 * s, -10 * s, 1, 0, -7 * s, 9 * s); g.addColorStop(0, '#b98a58'); g.addColorStop(1, '#7a5233');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -7 * s, 7.5 * s, 6.5 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6fbf4f'; ctx.beginPath(); ctx.ellipse(1.5 * s, -14.5 * s, 3.4 * s, 1.6 * s, -.6 + step * .1, 0, 7); ctx.fill();
      eye(-3 * s, -8 * s); eye(1.8 * s, -8 * s);
    } else if (e.kind === 'snail') {    // Shellback snail: retreats into a kickable shell
      const shell = () => { const g = ctx.createRadialGradient(1 * s, -9 * s, 1, 1 * s, -7 * s, 8 * s); g.addColorStop(0, '#f2c27a'); g.addColorStop(1, '#c0703c'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1 * s, -7 * s, 6.8 * s, 0, 7); ctx.fill();
        ctx.strokeStyle = '#8a4a26'; ctx.lineWidth = 1.1 * s; ctx.beginPath(); for (let a = 0; a < 12; a += .3) { const rr = 6 * s * (1 - a / 13); ctx.lineTo(1 * s + Math.cos(a) * rr, -7 * s + Math.sin(a) * rr); } ctx.stroke(); };
      if (e.state === 'walk') {
        ctx.fillStyle = '#9fd0b8'; ctx.beginPath(); ctx.ellipse(-3 * s, -2.2 * s, 7.5 * s, 2.4 * s, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-7.5 * s, -5 * s, 2.3 * s, 3.5 * s, -.3, 0, 7); ctx.fill();
        ctx.strokeStyle = '#7fb39a'; ctx.lineWidth = .9 * s; ctx.beginPath(); ctx.moveTo(-8 * s, -8 * s); ctx.lineTo(-9.5 * s, -11.5 * s); ctx.stroke();
        eye(-8 * s, -5.5 * s);
      }
      shell();
    } else if (e.kind === 'hopper') {   // Puddlehop: a round frog that leaps toward you
      const crouch = e.ground ? 1 : .8;
      ctx.fillStyle = '#4fa86a'; ctx.beginPath(); ctx.ellipse(0, -6 * s * crouch, 7.5 * s, 6 * s * crouch, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#bfe9a8'; ctx.beginPath(); ctx.ellipse(-1 * s, -4 * s, 4.5 * s, 3 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3f8d58'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 5.5 * s, -1.4 * s, 3 * s, 1.5 * s, 0, 0, 7); ctx.fill(); }
      eye(-3.5 * s, -11 * s * crouch); eye(2.5 * s, -11 * s * crouch);
    } else {                             // Puffwing: a fluffy flier
      const flap = Math.sin(e.t * .3) * .8;
      ctx.fillStyle = '#fbeff5'; ctx.beginPath(); ctx.arc(0, -7 * s, 6.5 * s, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2b8cf'; for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * 5 * s, -8 * s); ctx.rotate(sd * flap); ctx.beginPath(); ctx.ellipse(sd * 4 * s, 0, 4.5 * s, 2.2 * s, 0, 0, 7); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = '#f4a640'; ctx.beginPath(); ctx.moveTo(-6.5 * s, -7 * s); ctx.lineTo(-9.5 * s, -6 * s); ctx.lineTo(-6.5 * s, -5 * s); ctx.fill();
      eye(-3 * s, -8.5 * s);
    }
    ctx.restore();
  }
  function drawThoughts(arcs, at) {
    if (!arcs) return;
    const fade = Math.max(.4, 1 - (frameNo - at) / 45), lw = Math.max(1.2, S * .42);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) for (const a of arcs) {
      if ((pass === 1) !== a.chosen) continue;
      const dead = a.death >= 0;
      const al = (a.chosen ? .95 : dead ? .22 + .3 * (1 - a.rank) : .08 + .26 * (1 - a.rank)) * fade;
      const path = () => { ctx.beginPath(); a.pts.forEach(([x, y], i) => { const [sx, sy] = W2D(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); };
      // A dark under-stroke keeps the lines readable over the bright painting.
      path(); ctx.strokeStyle = `rgba(24,36,44,${(a.chosen ? .55 : .22) * al})`; ctx.lineWidth = (a.chosen ? lw * 2.4 : lw) + lw * 1.4; ctx.stroke();
      path(); ctx.strokeStyle = a.chosen ? `rgba(255,226,130,${al})` : dead ? `rgba(255,112,96,${al})` : `rgba(255,255,255,${al})`;
      ctx.lineWidth = a.chosen ? lw * 2.4 : lw; ctx.stroke();
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
  function drawPip() {
    if (inv && !dead && Math.floor(inv / 4) % 2) return;
    const [x, y] = W2D(pl.x + P.w / 2, pl.y + pl.h + 1);
    let f;
    if (dead) f = 18;
    else if (!pl.ground) f = pl.vy < -2.5 ? 17 : pl.vy < 1.2 ? 18 : 19;
    else if (skidding) f = 21;                       // braced crouch reads as a skid
    else if (frameNo - landedAt < 5) f = 20;
    else if (Math.abs(pl.vx) < .12) f = 0;
    else f = Math.floor(anim / (shownBig() ? 1.5 : 1.15)) % 16;
    const sc = pipVisual() / 295 * S, sx = 1 - .13 * sq, sy = 1 + .15 * sq;
    // Lean into speed on the ground, brace against a skid.
    const lean = dead ? 0 : pl.ground ? (skidding ? -.12 : .06 * Math.min(1, Math.abs(pl.vx) / P.max)) : .04;
    ctx.save(); ctx.translate(x, y);
    if (!dead && pl.ground) { ctx.fillStyle = 'rgba(40,30,20,.22)'; ctx.beginPath(); ctx.ellipse(0, -S * .4, 8 * S * (shownBig() ? 1.25 : 1), 1.8 * S, 0, 0, 7); ctx.fill(); }
    if (dead) ctx.rotate(Math.min(Math.PI, dead * .08));
    ctx.scale(facing, 1); ctx.rotate(lean); ctx.scale(sx * sc, sy * sc);
    if (sheet.complete && sheet.naturalWidth) ctx.drawImage(sheet, f * FRAME_W, 0, FRAME_W, FRAME_H, -122, -300, FRAME_W, FRAME_H);
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
    const g = ghostAt(frameNo); if (!g) return;
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
  function drawParts() {
    for (const p of parts) {
      const [x, y] = W2D(p.x, p.y), a = Math.min(1, p.life / 14);
      if (p.seed) { star(x, y, 5 * S * a, frameNo * .2); continue; }
      ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, p.r * S, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    {
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
      const tw = ctx.measureText(msg).width + u * 1.6, mid = left ? Math.max(left + tw / 2, (left + right) / 2) : Math.min(W / 2, right - tw / 2), bx = mid - tw / 2, by = oy + VIEW_H * S - u * 2.4;
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
    drawBackground(); drawTiles(); drawMovers(); drawCrystals(); drawSeeds(); drawMarks();
    drawItems();
    for (const e of enemies) drawEnemy(e);
    drawGhost(); drawPip(); drawParts(); drawWeather(m); drawDarkness(m);
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
    zoom += ((replay ? 1.16 : 1 + .09 * tension) - zoom) * .08;
    if (replay) {
      const snap = replay.frames[Math.min(replay.frames.length - 1, Math.floor(replay.i))];
      const live = {pl, facing, anim, landedAt, dead, inv, cam, enemies, parts, bumps, frameNo, sq, skidding, big, growing, items};
      ({pl, facing, anim, landedAt, dead, inv, cam, enemies, parts, bumps, frameNo, sq, skidding, big, growing, items} = snap);
      composite(() => scene(snap.arcs, snap.at));
      ctx.setTransform(1, 0, 0, 1, 0, 0); drawHud();
      ({pl, facing, anim, landedAt, dead, inv, cam, enemies, parts, bumps, frameNo, sq, skidding, big, growing, items} = live);
      return;
    }
    composite(() => scene(plan && plan.arcs, plan ? plan.at : 0));
    ctx.setTransform(1, 0, 0, 1, 0, 0); drawTitle(); drawCard(); drawHud();
  }

  /* ---------------- loop ---------------- */
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, visible = !document.hidden, raf = 0, last = 0, acc = 0;
  function frame(now) {
    raf = 0;
    if (!playing || !visible) return;
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    if (replay) {
      if (human) replay = null;
      else { replay.i += dt * 60 * .5; if (replay.i >= replay.frames.length) replay = null; }
    } else acc += dt * (1 - .45 * tension);
    let n = 0;
    while (!replay && acc >= 1 / 60 && n < 6) { tick(); acc -= 1 / 60; n++; }
    render(); raf = requestAnimationFrame(frame);
  }
  function setPlaying(on) {
    playing = Boolean(on); last = 0;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (playing && visible) raf = requestAnimationFrame(frame); else render();
  }
  addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'pip:motion') setPlaying(e.data.playing); });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; last = 0; if (visible && playing && !raf) raf = requestAnimationFrame(frame); });
  addEventListener('resize', () => { layout(); render(); });
  sheet.onload = backdrop.onload = () => { if (!playing) render(); };
  addEventListener('hashchange', start);
  addEventListener('pagehide', saveBest);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveBest(); });
  layout(); start();
  if (playing) raf = requestAnimationFrame(frame);
  // Test hook: lets the smoke test drive the simulation without a browser clock.
  window.__pipRun = {tick, reset, state: () => ({pl, enemies, seeds, maxX, dead, human, cam, viewW}), GAP, layout, tileAt: (x, y) => tileAt(x, y),
    scores: () => { const th = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash' && Math.abs(e.x - pl.x) < 260); return OPTIONS.map(o => [o.dir, o.wait, o.hold, Math.round(simulate(o, th).score)]); },
    stats: () => stats, biomeAt: x => biomeAt(x), GAPS, features: () => [...chunks.values()].flatMap(ch => ch.features), wonder: r => regionWonder(r),
    debug: () => ({tension, risk, marks: marks.length, replay: !!replay, zoom, big, items: items.length}),
    director: {arm: t => { tool = t; }, refill: () => { charges = 3; }, place: (tx, ty) => place(tx, ty), grow, info: () => ({tool, charges, dirScore, notes: notes.map(n => n.text)})},
    ghost: {encode: () => encodeRun(run), decode: decodeRun, race: code => { const r = decodeRun(code), live = seed; ghost = r && buildGhost(r, 'friend'); reset(live); return ghost; }, at: f => ghostAt(f), run: () => run}};
})();
