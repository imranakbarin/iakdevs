/* Zen garden seasons. The air of the garden turns through the year while you
 * watch: blossom drifting in spring, butterflies and warm motes in summer,
 * maple leaves in autumn that settle on the sand until the ball or the rake
 * sweeps them off, and snow in winter. A crane glides over in autumn and
 * winter, its shadow crossing the sand. It opens in the season of the calendar
 * month and moves on every two and a half minutes of garden time (a paused
 * garden holds still), and a short line names each season as it arrives. An
 * overlay only: the painted gardens and the sand trace are untouched. Reads
 * the garden's own globals (zenPoint, zenDistance, zenLength, zenGarden,
 * zenHintUntil, SceneMotion). */
const ZenSeasons = (() => {
  const NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const LINES = ['Spring · blossom drifts over the garden', 'Summer · butterflies in the warm light', 'Autumn · leaves settle on the sand', 'Winter · snow falls on the garden'];
  const LEN = 150, FADE = 24, TAU = Math.PI * 2;
  const calendar = (d = new Date()) => [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][d.getMonth()];
  let first = calendar(), seed = 0x5ea5;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const smooth = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  function at(t) {
    const u = Math.max(0, t) / LEN, i = Math.floor(u), s = (first + i) % 4;
    return {i, s, next: (s + 1) % 4, mix: smooth(((u - i) * LEN - (LEN - FADE)) / FADE)};
  }
  function weight(t, k) { const a = at(t); return (a.s === k ? 1 - a.mix : 0) + (a.next === k ? a.mix : 0); }
  const night = () => typeof zenGarden !== 'undefined' && zenGarden === 'moon';
  const wind = () => typeof SceneMotion !== 'undefined' ? SceneMotion.wind : 0;

  /* ---- falling things: blossom, summer motes, leaves, snow ---- */
  const KINDS = [
    {n: 26, vy: .06, gap: .45, cols: ['#ec8fa8', '#f3abbd', '#dc7593', '#f7c4d1']},
    {n: 18, vy: 0, gap: .7, cols: ['#fff3c0', '#fde9a0']},
    {n: 22, vy: .06, gap: .5, cols: ['#d4602c', '#c23f26', '#e39a35', '#b8562a']},
    {n: 120, vy: .034, gap: .06, cols: ['#ffffff']}
  ];
  const pools = KINDS.map((K, k) => Array.from({length: K.n}, (_, j) => ({k, j, live: false, wait: j * K.gap + rnd() * 2})));
  const leaves = [];   // settled on the sand, in sand coordinates (0..1100, centre 550)
  function spawn(p, K, L) {
    p.live = true; p.x = .03 + rnd() * .94; p.y = p.k === 1 ? .2 + rnd() * .7 : -.04 - rnd() * .1; p.vx = 0; p.vy = K.vy * (.75 + rnd() * .5);
    p.ang = rnd() * TAU; p.spin = (rnd() - .5) * (p.k === 2 ? 2.4 : 1); p.size = .7 + rnd() * .6; p.col = K.cols[(rnd() * K.cols.length) | 0];
    p.ground = .22 + rnd() * .76; p.rest = 0; p.age = 0; p.life = 9 + rnd() * 7; p.ph = rnd() * TAU; p.sand = false;
    if (p.k === 2 && rnd() < .6) {   // most leaves come down over the sand
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * L.r * .8;
      p.x = (L.cx + Math.cos(a) * r) / L.w; p.ground = (L.cy + Math.sin(a) * r) / L.h;
    }
  }
  const toSand = (L, X, Y) => { const inner = L.r * .885; return {x: 550 + (X - L.cx) / inner * 550, y: 550 + (Y - L.cy) / inner * 550}; };
  const toScreen = (L, x, y) => { const inner = L.r * .885; return [L.cx + (x - 550) / 550 * inner, L.cy + (y - 550) / 550 * inner]; };
  function land(p, L) {
    const s = toSand(L, p.x * L.w, p.y * L.h);
    p.sand = Math.hypot(s.x - 550, s.y - 550) < 500; p.rest = 1e-6;
    if (p.k === 2 && p.sand) {   // a leaf on the sand stays there
      if (leaves.length >= 24) leaves.shift();
      leaves.push({x: s.x, y: s.y, ang: p.ang, size: p.size, col: p.col, age: 0, out: 0, dx: 0, dy: 0});
      p.live = false; p.wait = .5 + rnd() * 2.5;
    }
  }
  // Leaves within r of a sand point (the ball, the rake) slide off and fade.
  let lastL = null, warm = false;
  function sweep(x, y, r) {
    let n = 0;
    if (lastL) for (const f of flies) if (f.sit > 0) { const q = toSand(lastL, f.x * lastL.w, f.y * lastL.h); if (Math.hypot(q.x - x, q.y - y) < r * 2) lift(f); }
    for (const f of leaves) {
      if (f.out) continue;
      const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
      if (d < r) { f.out = 1e-6; f.dx = dx / (d || 1) * 170; f.dy = dy / (d || 1) * 170; n++; }
    }
    return n;
  }
  function updateFalling(dt, t, L) {
    for (const pool of pools) {
      const k = pool[0].k, K = KINDS[k], want = Math.round(K.n * weight(t, k));
      for (const p of pool) {
        if (!p.live) { if (p.j >= want || (p.wait -= dt) > 0) continue; spawn(p, K, L); }
        p.age += dt;
        if (k === 1) {   // motes drift up through the light, then fade
          p.x += (Math.sin(t * .3 + p.ph) * .004 + wind() * .003) * dt; p.y -= .006 * dt;
          if (p.age > p.life) { p.live = false; p.wait = rnd() * 3; }
          continue;
        }
        if (p.rest > 0) { p.rest += dt; if (p.rest > (k === 3 ? (p.sand ? 7 : 2.5) : 4)) { p.live = false; p.wait = rnd() * (k === 3 ? 1 : 3); } continue; }
        const sway = k === 2 ? Math.sin(p.age * 1.7 + p.ph) * .03 : k === 3 ? Math.sin(p.age * 1.1 + p.ph) * .008 : Math.sin(p.age + p.ph) * .012;
        p.vx += (wind() * .012 + sway - p.vx) * Math.min(1, dt * 2);
        p.x += p.vx * dt; p.y = Math.min(p.ground, p.y + p.vy * dt); p.ang += p.spin * dt;
        if (p.y >= p.ground) land(p, L);
      }
    }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const f = leaves[i]; f.age += dt;
      if (f.out) { f.out += dt; f.x += f.dx * dt; f.y += f.dy * dt; f.dx *= Math.exp(-dt * 3); f.dy *= Math.exp(-dt * 3); f.ang += dt * 3; }
      if (f.out > .9 || f.age > 110) leaves.splice(i, 1);
    }
    if (typeof zenPoint === 'function' && typeof zenLength === 'number' && zenLength > 0) { const b = zenPoint(zenDistance); sweep(b.x, b.y, 38); }
  }
  function leafShape(c, s) {
    c.beginPath();
    for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? s * .42 : s * (j === 0 ? 1.05 : .9); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath();
  }
  function drawLeaf(c, x, y, ang, s, col, alpha, flat) {
    c.save(); c.translate(x, y); c.rotate(ang); if (!flat) c.scale(1, .35 + .6 * Math.abs(Math.cos(ang * 1.3)));
    c.globalAlpha = alpha; leafShape(c, s); c.fillStyle = col; c.fill();
    c.strokeStyle = 'rgba(80,38,18,.45)'; c.lineWidth = .6; c.stroke();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, s * 1.4); c.stroke(); c.restore();
  }
  function drawPetal(c, x, y, ang, s, col, alpha) {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(1, .2 + .7 * Math.abs(Math.cos(ang))); c.globalAlpha = alpha; c.fillStyle = col;
    c.beginPath(); c.moveTo(-s, 0); c.bezierCurveTo(-s, -s, s * .55, -s * .6, s, 0); c.bezierCurveTo(s * .4, s * .85, -s * .6, s * .7, -s, 0); c.fill();
    c.strokeStyle = 'rgba(140,60,85,.5)'; c.lineWidth = .6; c.stroke(); c.restore();
  }
  function drawFalling(c, L) {
    const unit = Math.max(.8, Math.min(1.4, L.r / 260));
    c.save();
    // Snow first, as one path per alpha step so a full winter stays cheap.
    const flakes = pools[3].filter(p => p.live);
    if (flakes.length) {
      c.fillStyle = 'rgba(70,84,110,.22)'; c.beginPath();   // a faint shade keeps flakes visible over pale sand
      for (const p of flakes) { const x = p.x * L.w + 1, y = p.y * L.h + 1, r = 2.2 * p.size * unit; c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); }
      c.fill();
      c.fillStyle = '#fff';
      for (const band of [[0, .45], [.45, .8], [.8, 1.01]]) {
        c.globalAlpha = .9 * (band[0] + band[1]) / 2 + .1; c.beginPath();
        for (const p of flakes) {
          const a = p.rest > 0 ? 1 - smooth((p.rest - (p.sand ? 4 : 1.2)) / (p.sand ? 3 : 1.3)) : Math.min(1, (p.y + .04) * 10);
          if (a < band[0] || a >= band[1] || a <= 0) continue;
          const x = p.x * L.w, y = p.y * L.h, r = (p.rest > 0 ? 1.7 : 2.4) * p.size * unit;
          c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
        }
        c.fill();
      }
    }
    for (const p of pools[1]) {
      if (!p.live) continue;
      const a = Math.sin(Math.PI * Math.min(1, p.age / p.life)) * .7, x = p.x * L.w, y = p.y * L.h;
      c.globalAlpha = a * .22; c.fillStyle = p.col; c.beginPath(); c.arc(x, y, 7 * unit, 0, TAU); c.fill();
      c.globalAlpha = a; c.beginPath(); c.arc(x, y, 2.1 * unit, 0, TAU); c.fill();
    }
    for (const k of [0, 2]) for (const p of pools[k]) {
      if (!p.live) continue;
      const fade = p.rest > 0 ? 1 - smooth((p.rest - 2) / 2) : Math.min(1, (p.y + .04) * 10);
      if (fade <= 0) continue;
      const x = p.x * L.w, y = p.y * L.h, s = (k === 2 ? 10 : 7.5) * p.size * unit, lift = p.rest > 0 ? 0 : Math.max(0, p.ground - p.y) * L.h * .12;
      if (lift) { c.globalAlpha = fade * .14; c.fillStyle = '#4a3f2c'; c.beginPath(); c.ellipse(x + lift, y + lift, s * .8, s * .35, 0, 0, TAU); c.fill(); }
      (k === 2 ? drawLeaf : drawPetal)(c, x, y, p.ang, s, p.col, fade * .92, false);
    }
    c.restore();
  }

  /* ---- visitors: butterflies (spring, summer) and a crane (autumn, winter) ---- */
  const WINGS = [['#f2a93b', '#5a3a1a'], ['#f4e27a', '#6b5a2a'], ['#a9c9ec', '#3d4f6a']];
  const flies = [];
  let crane = null, nextCrane = 25;
  function butterflies(dt, t, L) {
    const want = night() ? 0 : Math.round(2 * Math.min(1, weight(t, 1) + .5 * weight(t, 0)));
    while (flies.length < want) flies.push({x: rnd() < .5 ? -.05 : 1.05, y: .2 + rnd() * .6, tx: .3 + rnd() * .4, ty: .3 + rnd() * .4, vx: 0, vy: 0, sit: 0, hold: 3 + rnd() * 4, ph: rnd() * TAU, col: WINGS[(rnd() * WINGS.length) | 0], leaving: false});
    if (flies.length > want) for (const f of flies) if (!f.leaving && flies.filter(g => !g.leaving).length > want) { f.leaving = true; f.sit = 0; f.tx = f.x < .5 ? -.1 : 1.1; f.ty = f.y - .2; }
    const b = typeof zenPoint === 'function' && typeof zenLength === 'number' && zenLength > 0 ? zenPoint(zenDistance) : null, ball = b && toScreen(L, b.x, b.y);
    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i];
      if (f.sit > 0) {
        f.sit -= dt;
        // A butterfly on the sand notices the ball rolling up and lifts off.
        if (ball && Math.hypot(ball[0] - f.x * L.w, ball[1] - f.y * L.h) < L.r * .16) lift(f);
        else if (f.sit <= 0) lift(f);
        continue;
      }
      f.hold -= dt;
      const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
      f.vx += (dx / (d || 1) * .07 + Math.sin(t * 2.1 + f.ph) * .05 - f.vx) * Math.min(1, dt * 2.5);
      f.vy += (dy / (d || 1) * .07 + Math.cos(t * 2.7 + f.ph) * .06 - f.vy) * Math.min(1, dt * 2.5);
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.leaving && (f.x < -.08 || f.x > 1.08)) { flies.splice(i, 1); continue; }
      if (f.leaving) continue;
      if (d < .02 && f.landing) { f.sit = 3 + rnd() * 4; f.landing = false; f.vx = f.vy = 0; }
      else if (d < .02 || f.hold <= 0) {   // half the time it heads for a spot on the sand to settle
        f.landing = rnd() < .5;
        if (f.landing) { const a = rnd() * TAU, rr = L.r * (.3 + rnd() * .55); f.tx = (L.cx + Math.cos(a) * rr) / L.w; f.ty = (L.cy + Math.sin(a) * rr) / L.h; f.hold = 6; }
        else { f.tx = .1 + rnd() * .8; f.ty = .1 + rnd() * .8; f.hold = 3 + rnd() * 4; }
      }
    }
  }
  function drawButterfly(c, f, t, L) {
    const s = Math.max(1.2, L.r / 150), x = f.x * L.w, y = f.y * L.h, open = f.sit > 0 ? .55 + .45 * Math.sin(t * 1.3 + f.ph) : Math.abs(Math.cos(t * 14 + f.ph));
    c.save(); c.translate(x, y); c.rotate(Math.atan2(f.vy, f.vx) * (f.sit > 0 ? 0 : .3)); c.scale(s, s);
    if (f.sit > 0) { c.globalAlpha = .18; c.fillStyle = '#3d3424'; c.beginPath(); c.ellipse(2, 3, 6 * open + 2, 2, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
    for (const side of [-1, 1]) {
      c.save(); c.scale(side * (.15 + .85 * open), 1);
      c.fillStyle = f.col[0]; c.strokeStyle = f.col[1]; c.lineWidth = .7;
      c.beginPath(); c.ellipse(4.2, -2.6, 4.4, 3.4, -.5, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(3.2, 2.4, 3, 2.3, .5, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = f.col[1]; c.beginPath(); c.arc(6.2, -4, .8, 0, TAU); c.fill();
      c.restore();
    }
    c.fillStyle = f.col[1]; c.beginPath(); c.ellipse(0, 0, .9, 4, 0, 0, TAU); c.fill();
    c.strokeStyle = f.col[1]; c.lineWidth = .4; c.beginPath(); c.moveTo(0, -4); c.lineTo(-1.6, -7); c.moveTo(0, -4); c.lineTo(1.6, -7); c.stroke();
    c.restore();
  }
  function craneStep(dt, t, L) {
    if (!crane && dt) {
      const w = weight(t, 2) + weight(t, 3);
      if (w > .5 && (nextCrane -= dt) <= 0) { const dir = rnd() < .5 ? 1 : -1; crane = {u: 0, dir, y0: .08 + rnd() * .12, y1: .16 + rnd() * .14, dur: 13 + rnd() * 4}; nextCrane = 70 + rnd() * 50; }
    }
    if (crane) { crane.u += dt / crane.dur; if (crane.u > 1) crane = null; }
  }
  function drawCrane(c, t, L) {
    if (!crane) return;
    const u = crane.u, s = Math.max(.9, L.r / 200), x = crane.dir > 0 ? -60 + u * (L.w + 120) : L.w + 60 - u * (L.w + 120), y = (crane.y0 + (crane.y1 - crane.y0) * u) * L.h;
    const beat = Math.sin(t * 4.2), flap = (Math.sin(t * .6) > -.2 ? beat : .15);   // slow beats with long glides
    // Its shadow passes over the garden well below it.
    for (const [sx, sy, col, a] of [[x + 40 * s, y + L.h * .34, '#2b2a1e', .16], [x, y, null, 1]]) {
      c.save(); c.translate(sx, sy); c.scale(crane.dir * s, s); c.globalAlpha = a;
      const body = col || '#f6f3ea', ink = col || '#262626';
      c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 13, 3.6, 0, 0, TAU); c.fill();
      c.strokeStyle = ink; c.lineWidth = 1.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(11, -1); c.quadraticCurveTo(20, -3, 27, -2); c.stroke();   // neck
      if (!col) { c.fillStyle = '#c8392b'; c.beginPath(); c.arc(26, -2.6, 1.3, 0, TAU); c.fill(); }
      c.beginPath(); c.moveTo(27, -2); c.lineTo(32, -1.4); c.stroke();
      c.beginPath(); c.moveTo(-12, 1); c.lineTo(-26, 2.5); c.stroke();   // legs trailing
      for (const side of [-1, 1]) {
        c.fillStyle = body; c.beginPath(); c.moveTo(-3, 0); c.quadraticCurveTo(2, side * 14 * (.4 + .6 * Math.abs(flap)), -4, side * 26 * (.35 + .65 * Math.abs(flap))); c.quadraticCurveTo(-10, side * 12, -9, 0); c.closePath(); c.fill();
        if (!col) { c.fillStyle = '#262626'; c.beginPath(); c.moveTo(-4, side * 26 * (.35 + .65 * Math.abs(flap))); c.lineTo(-8.5, side * 17 * (.35 + .65 * Math.abs(flap))); c.lineTo(-6, side * 13 * (.35 + .65 * Math.abs(flap))); c.closePath(); c.fill(); }
      }
      c.restore();
    }
  }
  function lift(f) { f.sit = 0; f.landing = false; f.tx = .1 + rnd() * .8; f.ty = .05 + rnd() * .4; f.hold = 3 + rnd() * 3; }
  // A tap (screen coordinates) near a settled butterfly sends it up.
  function scare(x, y) {
    let hit = false;
    if (lastL) for (const f of flies) if (f.sit > 0 && Math.hypot(f.x * lastL.w - x, f.y * lastL.h - y) < 50) { lift(f); hit = true; }
    return hit;
  }

  /* ---- light and the season's line ---- */
  const TINT = ['255,222,232', '255,240,190', '255,190,110', '226,236,250'], TINT_A = [.04, .05, .05, .14];
  let lastI = -1, line = null;
  function label(c, L, t) {
    const a = at(t), hint = typeof zenHintUntil === 'number' && typeof SceneMotion !== 'undefined' && SceneMotion.time <= zenHintUntil;
    if (a.i !== lastI && t > 1.5 && !hint) { line = {text: LINES[a.s], from: t}; lastI = a.i; }
    if (!line || hint) return;
    const age = t - line.from, alpha = Math.min(1, age / 1.2, (6.5 - age) / 1.2);
    if (alpha <= 0) { if (age > 6.5) line = null; return; }
    const y = L.cy + L.r * 1.04;
    c.save(); c.globalAlpha = alpha; c.font = '500 14px system-ui,-apple-system,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(line.text).width + 28; c.fillStyle = 'rgba(28,52,44,.72)'; c.beginPath(); c.roundRect(L.cx - w / 2, y - 15, w, 30, 15); c.fill();
    c.fillStyle = '#f4ead0'; c.fillText(line.text, L.cx, y); c.restore();
  }
  // Drawn on the sand, under the ball: the settled leaves.
  function under(c, L, t, dt) {
    lastL = L;
    if (dt) updateFalling(dt, t, L);
    if (!warm) { warm = true; for (let k = 0; k < 180; k++) updateFalling(1 / 15, t - 12 + k / 15, L); }   // the garden opens mid-season, not empty
    const unit = Math.max(.8, Math.min(1.4, L.r / 260)), snow = weight(t, 3);
    if (snow > .01) {   // a dusting of snow on the sand
      const inner = L.r * .885, g = c.createRadialGradient(L.cx - inner * .2, L.cy - inner * .25, inner * .1, L.cx, L.cy, inner);
      g.addColorStop(0, `rgba(250,252,255,${.3 * snow})`); g.addColorStop(1, `rgba(236,242,250,${.18 * snow})`);
      c.save(); c.fillStyle = g; c.beginPath(); c.arc(L.cx, L.cy, inner, 0, TAU); c.fill(); c.restore();
    }
    for (const f of leaves) {
      const [x, y] = toScreen(L, f.x, f.y), a = (f.out ? 1 - f.out / .9 : 1) * (1 - smooth((f.age - 90) / 20));
      c.save(); c.globalAlpha = a * .18; c.fillStyle = '#4a3f2c'; c.beginPath(); c.ellipse(x + 2, y + 2, 9 * f.size * unit, 4.5 * f.size * unit, f.ang, 0, TAU); c.fill(); c.restore();
      drawLeaf(c, x, y, f.ang, 10 * f.size * unit, f.col, a * .95, true);
    }
  }
  // Drawn over the garden: what falls, the visitors, the light and the line.
  function over(c, L, t, dt) {
    if (dt) { butterflies(dt, t, L); craneStep(dt, t, L); }
    drawFalling(c, L);
    for (const f of flies) drawButterfly(c, f, t, L);
    drawCrane(c, t, L);
    c.save();
    const cold = weight(t, 3);
    if (cold > .01) {   // frost gathers towards the edges in winter
      const g = c.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * .35, L.w / 2, L.h / 2, Math.hypot(L.w, L.h) * .55);
      g.addColorStop(0, 'rgba(240,246,255,0)'); g.addColorStop(1, `rgba(240,246,255,${.34 * cold * (night() ? .5 : 1)})`);
      c.fillStyle = g; c.fillRect(0, 0, L.w, L.h);
    }
    for (let k = 0; k < 4; k++) { const w = weight(t, k); if (w < .01) continue; c.globalAlpha = w; c.fillStyle = `rgba(${TINT[k]},${TINT_A[k] * (night() ? .5 : 1)})`; c.fillRect(0, 0, L.w, L.h); }
    c.restore();
    label(c, L, t);
  }
  return {
    under, over, sweep, scare, at, weight, calendar,
    name: (t = typeof SceneMotion !== 'undefined' ? SceneMotion.time : 0) => NAMES[at(t).s],
    NAMES, LEN,
    leaves: () => leaves.map(f => ({...f})), falling: k => pools[k].filter(p => p.live).length, flies: () => flies.map(f => ({...f})), crane: () => crane && {...crane},
    // Start the cycle on season k (tools and tests), clearing the air and the sand.
    startAt: k => { first = ((k % 4) + 4) % 4; lastI = -1; line = null; warm = false; leaves.length = 0; flies.length = 0; crane = null; for (const pool of pools) for (const p of pool) { p.live = false; p.wait = p.j * KINDS[p.k].gap; } }
  };
})();
