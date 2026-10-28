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
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const TS = 16, ROWS = 15, CW = 24, VIEW_H = ROWS * TS;
  // Logical pixels per 1/60 s frame.
  const P = {acc: .1, airAcc: .075, skid: .27, fric: .15, max: 2.25, jump: 6.6, jumpRun: .24,
    gHold: .36, g: .92, maxFall: 6.2, coyote: 6, buffer: 7, w: 12, h: 20};
  const EPS = 1e-3;
  const EMPTY = 0, EARTH = 1, BRICK = 2, BLOCK = 3, USED = 4, PIPE_L = 5, STONE = 6, PIPE_R = 7;

  const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return h >>> 0; };
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const toward = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /* ---------------- physics ---------------- */
  let tileAt = () => EMPTY;
  const solid = (tx, ty) => tileAt(tx, ty) !== EMPTY;
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
  // One frame of player physics. Shared verbatim by the player and the planner.
  function stepBody(b, inp) {
    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    if (dir === 0) b.vx = toward(b.vx, 0, b.ground ? P.fric : P.fric * .35);
    else b.vx = toward(b.vx, dir * P.max, b.ground ? (b.vx * dir < 0 ? P.skid : P.acc) : P.airAcc);
    const pressed = inp.j && !b.jprev; b.jprev = inp.j;
    b.buf = pressed ? P.buffer : Math.max(0, b.buf - 1);
    b.coyote = b.ground ? P.coyote : Math.max(0, b.coyote - 1);
    let jumped = false;
    if (b.buf > 0 && b.coyote > 0) {
      b.vy = -(P.jump + Math.abs(b.vx) * P.jumpRun); b.buf = 0; b.coyote = 0; b.jumping = true; b.ground = false; jumped = true;
    }
    if (!inp.j || b.vy >= 0) b.jumping = false;
    b.vy = Math.min(P.maxFall, b.vy + (b.jumping ? P.gHold : P.g));
    moveX(b);
    const was = b.ground, bump = moveY(b);
    return {jumped, bump, landed: b.ground && !was};
  }
  // How far a full-speed, full-hold jump carries Pip before landing dh tiles higher.
  function reach(dh) {
    const b = {x: 0, y: 0, vx: P.max, vy: 0, w: P.w, h: P.h, ground: true, jprev: false, buf: 0, coyote: P.coyote, jumping: false};
    const saved = tileAt; tileAt = () => EMPTY;
    let best = 0;
    for (let f = 0; f < 120; f++) {
      stepBody(b, {r: true, j: true}); b.ground = false; b.coyote = 0;
      if (b.vy > 0 && b.y >= -dh * TS) { best = b.x; break; }
    }
    tileAt = saved; return best;
  }
  const GAP = {};
  for (let dh = -4; dh <= 2; dh++) GAP[dh] = Math.max(0, Math.floor((reach(dh) * .8 - 14) / TS));

  /* ---------------- world ---------------- */
  let seed = 1, chunks = new Map(), gen = {ci: -1, h: 3};
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

  function generate() {
    const ci = ++gen.ci, r = rng(hash(seed, ci)), d = Math.min(1, ci / 16);
    const t = new Uint8Array(CW * ROWS), ch = {ci, t, spawns: [], seeds: [], safe: new Set(), spawned: false};
    const set = (c, row, v) => { if (c >= 0 && c < CW && row >= 0 && row < ROWS) t[row * CW + c] = v; };
    const col = (c, h) => { for (let k = 0; k < h; k++) set(c, ROWS - 1 - k, EARTH); };
    const surface = h => (ROWS - h) * TS;
    const wx = c => (ci * CW + c) * TS;
    let c = 0, h = gen.h;
    const flat = n => { n = Math.min(n, CW - c); for (let i = 0; i < n; i++) { col(c, h); if (i > 0 && i < n - 1) ch.safe.add(c); c++; } return n; };
    const seedRow = (c0, n, row) => { for (let i = 0; i < n; i++) ch.seeds.push({x: wx(c0 + i) + 8, y: row * TS + 8, got: false}); };
    const enemy = (kind, c0, hh) => ch.spawns.push({kind, x: wx(c0) + 1, y: surface(hh) - 14});
    const kinds = () => { const k = r(); return d > .5 && k < .2 ? 'flier' : d > .3 && k < .4 ? 'hopper' : d > .15 && k < .65 ? 'snail' : 'walker'; };
    if (ci === 0) {
      flat(CW); seedRow(14, 3, ROWS - h - 3);
      gen.h = h; chunks.set(ci, ch); prune(); return;
    }
    while (c < CW) {
      const room = CW - c, k = r();
      if (room < 5) { flat(room); break; }
      if (k < .24) {                                   // open run, maybe a creature and a block row
        const c0 = c, n = flat(4 + (r() * 5 | 0));
        if (n >= 4 && r() < .4 + .3 * d) { const kd = kinds(); kd === 'flier' ? ch.spawns.push({kind: kd, x: wx(c0 + 2), y: surface(h) - 56}) : enemy(kd, c0 + 1 + (r() * (n - 2) | 0), h); }
        if (n >= 4 && r() < .45) {
          const row = ROWS - h - 4, len = 1 + (r() * Math.min(4, n - 1) | 0), s0 = c0 + 1;
          for (let i = 0; i < len; i++) set(s0 + i, row, r() < .45 ? BLOCK : BRICK);
          if (r() < .5) seedRow(s0, len, row - 2);
        } else if (r() < .35) seedRow(c0 + 1, Math.min(3, n - 1), ROWS - h - 2);
      } else if (k < .46) {                            // gap, sized from the jump physics
        const dh = [-2, -1, 0, 0, 1][r() * 5 | 0], h2 = clamp(2, h + dh, 7), max = GAP[h2 - h] || 0;
        if (max < 1 || room < 4 + max) { flat(2); continue; }
        const w = 1 + (r() * Math.min(max, 1 + Math.round(d * 2)) | 0);
        if (w > room - 3) { flat(room); break; }
        const mid = c + w / 2;
        for (let i = 0; i < 3; i++) ch.seeds.push({x: wx(0) + (mid + i - 1) * TS, y: surface(Math.max(h, h2)) - 30 - (i === 1 ? 14 : 4), got: false});
        c += w; h = h2; flat(2 + (r() * 2 | 0));
      } else if (k < .6) {                             // a step up or down
        h = clamp(2, h + [-2, -1, 1, 2][r() * 4 | 0], 7); flat(2 + (r() * 3 | 0));
      } else if (k < .72) {                            // a pipe
        if (room < 7) { flat(room); continue; }
        flat(2); const ph = 2 + (r() < .35 + .3 * d ? 1 : 0);
        for (let p = 0; p < 2; p++) { col(c + p, h); for (let q = 0; q < ph; q++) set(c + p, ROWS - 1 - h - q, p ? PIPE_R : PIPE_L); }
        ch.seeds.push({x: wx(c) + 16, y: surface(h + ph) - 22, got: false});
        c += 2; flat(2);
      } else if (k < .84) {                            // a stone pyramid
        const n = 3 + (r() < .5 ? 1 : 0);
        if (room < n * 2 + 3 || h + n > 10) { flat(2); continue; }
        flat(1);
        for (let i = 0; i < n; i++) { col(c, h); for (let s = 0; s <= i; s++) set(c, ROWS - 1 - h - s, STONE); c++; }
        for (let i = n - 1; i >= 0; i--) { col(c, h); for (let s = 0; s <= i; s++) set(c, ROWS - 1 - h - s, STONE); c++; }
        flat(1);
      } else {                                         // a block tier with seeds on top
        if (room < 7) { flat(room); continue; }
        const c0 = c; flat(6);
        const row = ROWS - h - 4;
        for (let i = 1; i <= 4; i++) set(c0 + i, row, i === 2 ? BLOCK : BRICK);
        if (r() < .6) { set(c0 + 2, row - 4, BLOCK); seedRow(c0 + 1, 4, row - 1); }
        if (r() < .5 + .3 * d) enemy(kinds() === 'flier' ? 'walker' : kinds(), c0 + 4, h);
      }
    }
    gen.h = h; chunks.set(ci, ch); prune();
  }
  function prune() { for (const k of chunks.keys()) if (k < gen.ci - 6) chunks.delete(k); }

  /* ---------------- actors ---------------- */
  let pl, enemies, parts, seeds, cam, cp, maxX, dead, inv, landedAt, anim, facing, frameNo;
  function reset(newSeed) {
    seed = newSeed; chunks = new Map(); gen = {ci: -1, h: 3};
    chunk(0);
    pl = {x: 40, y: (ROWS - 3) * TS - P.h, vx: 0, vy: 0, w: P.w, h: P.h, ground: false, jprev: false, buf: 0, coyote: 0, jumping: false};
    enemies = []; parts = []; seeds = 0; cam = 0; cp = {x: 40, y: pl.y}; maxX = 40; dead = 0; inv = 0; landedAt = -99; anim = 0; facing = 1; frameNo = 0;
    plan = null;
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
    if (e.kind === 'flier') { e.x += e.vx; e.y = e.baseY + Math.sin(e.t * .045) * 20; return e.x > cam - 64; }
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
    if (e.kind === 'flier') return [e.x + e.vx * f, e.baseY + Math.sin((e.t + f) * .045) * 20];
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
    const col = Math.floor(ahead / TS);
    if (!solid(col, feet)) return true;
    for (let ty = Math.floor(b.y / TS); ty <= Math.floor((b.y + b.h - 1) / TS); ty++) if (solid(col, ty)) return true;
    for (const e of threats) { const [ex, ey] = predict(e, f); if (ex > b.x - 4 && ex - b.x < 44 + b.vx * 6 && Math.abs(ey - b.y) < 40) return true; }
    return false;
  }
  function policy(o, f, b, st, threats, tf) {
    const own = o.dir === 1 ? (o.hold ? o.wait + o.hold + 2 : 0) : o.wait;
    if (f < own) return o.dir === 1 ? {r: true, l: false, j: f >= o.wait && f < o.wait + o.hold}
      : {r: false, l: o.dir < 0, j: f < o.hold};
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
  function simulate(o, threats) {
    const b = {...pl}, stomped = new Set(), got = new Set(), st = {auto: 0};
    let bonus = 0, sumX = 0;
    for (let f = 0; f < 96; f++) {
      stepBody(b, policy(o, f, b, st, threats, f));
      if (b.x < cam) { b.x = cam; b.vx = Math.max(0, b.vx); }
      sumX += b.x;
      if (b.y > VIEW_H) return -1e6 + f * 100;
      for (const e of threats) {
        if (stomped.has(e)) continue;
        const [ex, ey] = predict(e, f), m = 0;
        if (b.x < ex + e.w + m && b.x + b.w > ex - m && b.y < ey + e.h + m && b.y + b.h > ey - m) {
          if (e.state === 'shell') continue;
          if (b.vy > 0 && b.y + b.h - ey < 9) { stomped.add(e); b.vy = -4.4; bonus += 35; }
          else return -1e6 + f * 100;
        }
      }
      for (const s of seedsNear) if (!got.has(s) && Math.abs(s.x - b.x - 6) < 11 && Math.abs(s.y - b.y - 10) < 14) { got.add(s); bonus += 25; }
    }
    // Average position rewards moving now: otherwise "wait, then go" ties with
    // "go" on every replan and Pip procrastinates forever.
    return b.x - pl.x + (sumX / 96 - pl.x) + bonus + (b.ground ? 8 : 0) - o.hold * .15;
  }
  let seedsNear = [];
  function think() {
    const threats = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash' && Math.abs(e.x - pl.x) < 260);
    seedsNear = [];
    for (const ch of chunks.values()) for (const s of ch.seeds) if (!s.got && s.x > pl.x - 16 && s.x < pl.x + 200) seedsNear.push(s);
    let best = OPTIONS[0], bs = -Infinity;
    for (const o of OPTIONS) { const s = simulate(o, threats); if (s > bs) { bs = s; best = o; } }
    plan = {...best, f: 0, st: {auto: 0}};
  }
  function demoInput() {
    // Commit to a plan's own moves before reconsidering; replanning mid-plan
    // re-chose "jump in 5 frames" every 5 frames and the jump never came.
    const own = plan ? (plan.dir === 1 ? (plan.hold ? plan.wait + plan.hold + 2 : 0) : plan.wait) : 0;
    if (!plan || (pl.ground && plan.f >= Math.max(5, own)) || plan.f >= Math.max(22, own + 8)) think();
    const live = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash');
    return policy(plan, plan.f++, pl, plan.st, live, 0);
  }

  /* ---------------- input ---------------- */
  const keys = new Set(), touch = {l: false, r: false, j: false};
  let human = false, idleSince = 0, usingTouch = false, hintUntil = 0;
  const takeOver = () => { if (!human) { human = true; hintUntil = performance.now() + 6000; } idleSince = performance.now(); };
  addEventListener('keydown', e => {
    const k = e.code;
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
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { takeOver(); return; } usingTouch = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY}); readTouches(pointers); takeOver(); });
  cv.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) { pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY}); readTouches(pointers); } });
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
  function die() { if (dead || inv) return; dead = 1; pl.vy = -5.2; pl.vx = 0; puff(pl.x + 6, pl.y + 10, '#fff4dc', 7); }
  function tick() {
    frameNo++;
    if (dead) {
      dead++; pl.vy = Math.min(6, pl.vy + .3); pl.y += pl.vy;
      if (dead > 75) { pl.x = cp.x; pl.y = cp.y - 4; pl.vx = pl.vy = 0; dead = 0; inv = 110; cam = Math.min(cam, Math.max(0, cp.x - viewW * .3)); plan = null; enemies = enemies.filter(e => Math.abs(e.x - cp.x) > 90 || e.kind === 'flier'); }
      return;
    }
    const inp = human ? humanInput() : demoInput();
    if (!human && (keys.size || pointers.size)) takeOver();
    const ev = stepBody(pl, inp);
    if (pl.x < cam) { pl.x = cam; pl.vx = Math.max(0, pl.vx); }
    if (inp.r && !inp.l) facing = 1; else if (inp.l && !inp.r) facing = -1;
    anim += Math.abs(pl.vx);
    if (ev.jumped) puff(pl.x + 6, pl.y + P.h, '#f3e2c0', 4);
    if (ev.landed) { landedAt = frameNo; puff(pl.x + 6, pl.y + P.h, '#efdcb7', 5); }
    if (pl.ground && Math.abs(pl.vx) > 1.4 && (inp.l && pl.vx > 0 || inp.r && pl.vx < 0) && frameNo % 4 === 0) puff(pl.x + 6, pl.y + P.h, '#efdcb7', 2);
    if (ev.bump) bump(ev.bump[0], ev.bump[1]);
    if (pl.y > VIEW_H + 24) { dead = 30; pl.vy = 0; }
    if (inv) inv--;
    // A safe, grounded spot becomes the next respawn point.
    if (pl.ground) {
      const tx = Math.floor((pl.x + 6) / TS), ch = chunks.get(Math.floor(tx / CW));
      if (ch && ch.safe.has(tx - ch.ci * CW) && pl.x > cp.x + 64 && !enemies.some(e => Math.abs(e.x - pl.x) < 80)) cp = {x: pl.x, y: pl.y};
    }
    maxX = Math.max(maxX, pl.x);
    cam = Math.max(cam, pl.x - viewW * .38);
    spawnUpTo(cam + viewW + 48);
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
      } else die();
    }
    for (const ch of chunks.values()) for (const s of ch.seeds)
      if (!s.got && Math.abs(s.x - pl.x - 6) < 11 && Math.abs(s.y - pl.y - 10) < 14) { s.got = true; seeds++; sparkle(s.x, s.y); }
    parts = parts.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.star ? 0 : .08; p.vx *= .96; return --p.life > 0; });
    for (const b of bumps) b.t++;
    bumps = bumps.filter(b => b.t < 10);
  }
  let bumps = [];
  function bump(tx, ty) {
    const id = tileAt(tx, ty);
    if (id === BLOCK) { setTile(tx, ty, USED); seeds++; parts.push({x: tx * TS + 8, y: ty * TS - 4, vx: 0, vy: -3, life: 26, col: '#ffe08a', r: 3, star: true, seed: true}); sparkle(tx * TS + 8, ty * TS - 8); }
    if (id === BLOCK || id === BRICK || id === USED) bumps.push({tx, ty, t: 0});
    if (id === BRICK) puff(tx * TS + 8, ty * TS, '#e9b28a', 4, -1);
    // Creatures standing on a bumped block are knocked off, as on any good stage.
    for (const e of enemies) if (e.state === 'walk' && e.ground && Math.abs(e.x + 7 - (tx * TS + 8)) < 14 && Math.abs(e.y + e.h - ty * TS) < 3) { e.state = 'dead'; e.vy = -4; e.vx = 0; }
  }

  /* ---------------- rendering ---------------- */
  const sheet = new Image(), backdrop = new Image();
  sheet.src = 'assets/pip-full-run-22.webp'; backdrop.src = 'assets/mushroom-cinematic-kingdom.webp';
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
  function tileCanvas(id, top) {
    const key = id + ':' + (top ? 1 : 0);
    if (tileCache.has(key)) return tileCache.get(key);
    const n = Math.round(TS * S), c2 = document.createElement('canvas'); c2.width = c2.height = n;
    const g = c2.getContext('2d'); g.scale(n / TS, n / TS);
    const rr = (x, y, w, h, r, col) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = col; g.fill(); };
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

  function drawBackground() {
    const W = cv.width, H = cv.height;
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#8fcdf2'); sky.addColorStop(.6, '#d8eef0'); sky.addColorStop(1, '#f4e6c8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const bandH = VIEW_H * S, far = farLayer();
    if (far) {
      // The painted kingdom far away, softened once; mirrored tiles keep it seamless.
      const w = far.width, off = (cam * S * .12) % (2 * w);
      for (let x = -off - 2 * w, i = 0; x < W + w; x += w, i++) {
        ctx.save(); ctx.translate(x + (i % 2 ? w : 0), oy - bandH * .02); ctx.scale(i % 2 ? -1 : 1, 1); ctx.drawImage(far, 0, 0); ctx.restore();
      }
    }
    // Ground continues below the stage in tall layouts.
    ctx.fillStyle = '#8a5a3b'; ctx.fillRect(0, oy + bandH, W, H - oy - bandH);
  }
  function drawTiles() {
    const cd = camDev(), n = Math.round(TS * S), t0 = Math.floor(cam / TS) - 1, t1 = t0 + Math.ceil(viewW / TS) + 2;
    for (let tx = t0; tx <= t1; tx++) for (let ty = 0; ty < ROWS; ty++) {
      const id = tileAt(tx, ty); if (!id) continue;
      const b = bumps.find(q => q.tx === tx && q.ty === ty), lift = b ? Math.sin(b.t / 10 * Math.PI) * 4 * S : 0;
      ctx.drawImage(tileCanvas(id, tileAt(tx, ty - 1) === EMPTY), ox + tx * n - cd, oy + ty * n - lift);
      if (id === BLOCK) { const a = .25 + .25 * Math.sin(frameNo * .08 + tx); ctx.fillStyle = `rgba(255,255,230,${a.toFixed(3)})`; ctx.fillRect(ox + tx * n - cd + n * .12, oy + ty * n + n * .1 - lift, n * .76, n * .08); }
    }
  }
  const W2D = (x, y) => [ox + x * S - camDev(), oy + y * S];
  function drawSeeds() {
    for (const ch of chunks.values()) for (const s of ch.seeds) {
      if (s.got) continue;
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
  function drawPip() {
    if (inv && !dead && Math.floor(inv / 4) % 2) return;
    const [x, y] = W2D(pl.x + P.w / 2, pl.y + P.h + 1);
    let f;
    if (dead) f = 18;
    else if (!pl.ground) f = pl.vy < -2 ? 17 : pl.vy < 1.5 ? 18 : 19;
    else if (frameNo - landedAt < 5) f = 20;
    else if (Math.abs(pl.vx) < .12) f = 0;
    else f = Math.floor(anim / 1.15) % 16;
    const sc = 30 / 295 * S;
    ctx.save(); ctx.translate(x, y);
    if (dead) { ctx.rotate(Math.min(Math.PI, dead * .08)); }
    ctx.scale(facing * sc, sc);
    ctx.fillStyle = 'rgba(40,30,20,.22)';
    if (!dead && pl.ground) { ctx.beginPath(); ctx.ellipse(0, -2, 70, 14, 0, 0, 7); ctx.fill(); }
    if (sheet.complete && sheet.naturalWidth) ctx.drawImage(sheet, f * 244, 0, 244, 305, -122, -300, 244, 305);
    else { ctx.fillStyle = '#4fae9a'; ctx.beginPath(); ctx.arc(0, -200, 90, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#f2c9a0'; ctx.fillRect(-55, -200, 110, 190); }
    ctx.restore();
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
    const dist = Math.floor(maxX / TS) + ' m';
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(30,40,40,.55)'; ctx.fillText(dist, W - pad + 1, y + 1); ctx.fillStyle = '#fffbea'; ctx.fillText(dist, W - pad, y);
    ctx.textAlign = 'center';
    const msg = !human ? (usingTouch || matchMedia('(pointer:coarse)').matches ? 'Demo · tap to play' : 'Demo · press ← → and Space to play')
      : performance.now() < hintUntil ? (usingTouch ? 'Hold right to run · tap jump, hold to jump higher' : '← → run · Space to jump, hold for higher') : '';
    if (msg) {
      ctx.font = `500 ${u * .82}px system-ui,-apple-system,sans-serif`;
      // Near the bottom of the stage: the host page's control bar sits at the top.
      const tw = ctx.measureText(msg).width + u * 1.6, bx = W / 2 - tw / 2, by = oy + VIEW_H * S - u * 2.4;
      ctx.fillStyle = 'rgba(28,52,60,.55)'; ctx.beginPath(); ctx.roundRect(bx, by, tw, u * 1.3, u * .65); ctx.fill();
      ctx.fillStyle = '#fffbea'; ctx.fillText(msg, W / 2, by + u * .66);
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
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground(); drawTiles(); drawSeeds();
    for (const e of enemies) drawEnemy(e);
    drawPip(); drawParts(); drawHud();
  }

  /* ---------------- loop ---------------- */
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, visible = !document.hidden, raf = 0, last = 0, acc = 0;
  function frame(now) {
    raf = 0;
    if (!playing || !visible) return;
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now; acc += dt;
    let n = 0;
    while (acc >= 1 / 60 && n < 6) { tick(); acc -= 1 / 60; n++; }
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
  layout(); reset((Math.random() * 1e9) | 0); render();
  if (playing) raf = requestAnimationFrame(frame);
  // Test hook: lets the smoke test drive the simulation without a browser clock.
  window.__pipRun = {tick, reset, state: () => ({pl, enemies, seeds, maxX, dead, human, cam, viewW}), GAP, layout, tileAt: (x, y) => tileAt(x, y),
    scores: () => { const th = enemies.filter(e => e.state !== 'dead' && e.state !== 'squash' && Math.abs(e.x - pl.x) < 260); return OPTIONS.map(o => [o.dir, o.wait, o.hold, Math.round(simulate(o, th))]); }};
})();
