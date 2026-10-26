/* Presence: calm, local responses to the viewer in live art. No new controls.
   - Attention: a resting mouse pointer (or a finger held still) is noticed by
     nearby creatures. Their own clock eases to a stop, they look up and turn
     toward you, then carry on from where they were once you leave.
   - Lean in: while you attend, the scroll eases down; it resumes afterwards.
   - Tap: water ripples, fish/ducks/hens scatter and drift back, a perched bird
     takes off for another tree.
   Every response fades within a few seconds. Inputs are recorded on the scene
   clock, so a paused redraw is still pixel-identical. Reduced motion disables it. */
const ArtPresence = (() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const taps = [], clocks = new Map(), shifts = new Map();
  let client = null, active = -1e9, hold = null, down = null, holdTimer = 0, tapId = 0;
  let lastT = null, sx = 0, sy = 0, lvl = 0;

  const live = () => !reduce.matches && modeBtn.value === 'art' && artPresentation === 'live';
  function world(cx, cy) {
    const r = cv.getBoundingClientRect();
    return [camX + (cx - r.left) / S, topY + (cy - r.top) / S];
  }

  // Smoothed once per scene-clock tick; repeated reads within a frame agree.
  function sample(t) {
    if (lastT === t) return;
    const dt = lastT === null ? 0 : Math.max(0, Math.min(.25, t - lastT));
    lastT = t;
    const on = live() && client && (hold || performance.now() - active < 3500);
    if (client) {
      const [x, y] = world(client.x, client.y);
      if (lvl < .01) { sx = x; sy = y; }
      else { const k = 1 - Math.exp(-dt * 6); sx += (x - sx) * k; sy += (y - sy) * k; }
    }
    lvl += ((on ? 1 : 0) - lvl) * (1 - Math.exp(-dt * (on ? 2.2 : 1.1)));
  }
  const level = t => (sample(t), lvl);

  // Attention at a ground-level point: horizontal proximity within a band.
  function near(x, y, t, inner = 110, outer = 300) {
    sample(t);
    if (lvl < .01 || Math.abs(sy - y) > 160) return 0;
    return lvl * CreatureMind.proximity(Math.abs(sx - x), inner, outer);
  }

  // A creature's own clock slows while it is watched and never jumps back.
  function clock(key, t, rate) {
    let c = clocks.get(key);
    if (!c) { if (clocks.size > 240) clocks.clear(); c = {t, lag: 0}; clocks.set(key, c); }
    if (t > c.t) { c.lag += Math.min(.25, t - c.t) * (1 - rate); c.t = t; }
    return t - c.lag;
  }
  const lag = key => clocks.get(key)?.lag || 0;

  // Wander state on the creature's own clock, plus how strongly it notices you.
  function creature(mind, t, y) {
    const before = CreatureMind.wander(mind, t - lag(mind.key));
    const notice = near(before.x, y ?? gy(before.x) - 50, t);
    const s = CreatureMind.wander(mind, clock(mind.key, t, 1 - notice));
    s.notice = notice;
    if (notice > .3 && (s.resting || notice > .6)) s.dir = sx > s.x ? 1 : -1;
    return s;
  }

  // Tapped things scatter away and drift back; continuous from zero at the tap.
  function push(x, y, t, reach = 170) {
    let p = 0;
    for (const tp of taps) {
      const a = t - tp.t;
      if (a < 0 || a > 6) continue;
      const d = Math.hypot(x - tp.x, (y - tp.y) * 1.4);
      if (d > reach) continue;
      p += Math.sign(x - tp.x || 1) * (1 - Math.exp(-a * 7)) * Math.exp(-a / 1.4) * (1 - d / reach) * 60;
    }
    return p;
  }

  // Perch tours with a per-creature time shift: a tap close to a perched bird
  // (or, for shy creatures, a close pointer) moves its next take-off to now.
  function perch(o, t, {reach = 90, shy = 0} = {}) {
    let s = shifts.get(o.key);
    if (!s) { if (shifts.size > 240) shifts.clear(); s = {shift: 0, seen: tapId, cool: -1e9}; shifts.set(o.key, s); }
    for (const tp of taps) {
      if (tp.id <= s.seen || tp.t > t) continue;
      s.seen = tp.id;
      const b = CreatureMind.flight(o, tp.t + s.shift);
      if (!b.flying && Math.hypot(b.x - tp.x, b.y - tp.y) < reach) s.shift += b.takeoffIn;
    }
    let b = CreatureMind.flight(o, t + s.shift);
    if (shy && !b.flying && t - s.cool > 4) {
      sample(t);
      if (lvl > .5 && Math.hypot(b.x - sx, b.y - sy) < shy) {
        s.shift += b.takeoffIn; s.cool = t; b = CreatureMind.flight(o, t + s.shift);
      }
    }
    return b;
  }

  function ripples(c, t, waterY) {
    for (const tp of taps) {
      const a = t - tp.t;
      if (a < 0 || a > 2.4 || tp.y < waterY + 3) continue;
      for (let k = 0; k < 2; k++) {
        const u = a - k * .35;
        if (u <= 0) continue;
        const r = 6 + u * 34;
        c.globalAlpha = Math.max(0, .55 * (1 - u / 2));
        c.beginPath(); c.ellipse(tp.x, tp.y, r, r * .32, 0, 0, TAU);
        c.strokeStyle = T.light || '#fff'; c.lineWidth = 1.3; c.stroke();
      }
    }
    c.globalAlpha = 1;
  }

  function install() {
    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse' && !e.buttons) { client = {x: e.clientX, y: e.clientY}; active = performance.now(); }
      else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { clearTimeout(holdTimer); hold = null; }
    }, {passive: true});
    cv.addEventListener('pointerleave', () => { if (!hold) active = -1e9; }, {passive: true});
    cv.addEventListener('pointerdown', e => {
      down = {x: e.clientX, y: e.clientY, at: performance.now()};
      // A finger held still is the touch equivalent of a resting pointer.
      if (e.pointerType !== 'mouse') holdTimer = setTimeout(() => {
        if (down) { hold = down; client = {x: down.x, y: down.y}; wakeScene(); }
      }, 380);
    }, {passive: true});
    cv.addEventListener('pointerup', e => {
      clearTimeout(holdTimer);
      if (down && !hold && live() && performance.now() - down.at < 350 &&
          Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) {
        const [x, y] = world(down.x, down.y);
        taps.push({x, y, t: SceneMotion.time, id: ++tapId});
        if (taps.length > 8) taps.shift();
        wakeScene();
      }
      if (hold) active = performance.now();
      hold = null; down = null;
    }, {passive: true});
    cv.addEventListener('pointercancel', () => { clearTimeout(holdTimer); hold = null; down = null; }, {passive: true});

    // Water acknowledges a tap with a ripple, drawn under the creatures.
    const water = {gond: RIVER, warli: RIVER, madhubani: RIVER, kangra: RIVER, japan: 480, china: 492};
    for (const [key, y] of Object.entries(water)) {
      const st = STYLES[key], base = st.anim;
      st.anim = function (c, xa, xb, t) { if (base) base.call(this, c, xa, xb, t); ripples(c, t, y); };
    }
    // Small swimmers and hens scatter from a tap and turn away while they flee.
    const now = () => SceneMotion.time;
    const away = (p, dir) => Math.abs(p) > 4 ? Math.sign(p) : dir;
    const f0 = fish, w0 = wFish, m0 = mbFish, h0 = wHen, d0 = kDucks;
    fish = (c, x, y, dir, s, q) => { const p = push(x, y, now()); f0(c, x + p, y, away(p, dir), s, q); };
    wFish = (c, x, y, dir) => { const p = push(x, y, now()); w0(c, x + p, y, away(p, dir)); };
    mbFish = (c, x, y, dir, s, q) => { const p = push(x, y, now()); m0(c, x + p, y, away(p, dir), s, q); };
    wHen = (c, x, q, t, k) => h0(c, x + push(x, gy(x) - 10, t, 120), q, t, k);
    kDucks = (c, x, y, q, t) => d0(c, x + push(x, y, t), y, q, t);
  }

  return {install, level, near, creature, lag, push, perch};
})();
