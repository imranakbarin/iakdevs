/* Creature minds: deterministic walk/rest episodes for live-art animals.
   Every answer is a pure function of (key, time), so paused redraws stay
   pixel-identical and evicted chunks rebuild exactly. Each episode the creature
   rests at waypoint k (with an idle action), then walks to waypoint k+1. */
const CreatureMind = (() => {
  const ease = u => (1 - Math.cos(Math.PI * u)) / 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const step = (a, b, v) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

  // Waypoints alternate between the two halves of the range more often than not,
  // so walks are mostly purposeful crossings with the occasional short shuffle.
  function waypoint(o, j) {
    const r = mulberry32(hash(o.key, j)), lo = o.lo, hi = o.hi;
    const side = (j + (r() < .3 ? 1 : 0)) & 1;
    let x = lo + (hi - lo) * (side ? .45 + r() * .55 : r() * .55);
    // Rest spots keep clear of tree trunks; walking past them is fine.
    if (o.avoid && o.avoid.length) {
      for (let tries = 0; tries < 5 && o.avoid.some(a => Math.abs(a - x) < (o.clear || 60)); tries++)
        x = lo + (hi - lo) * r();
    }
    return x;
  }

  // o: {key, lo, hi, speed (units/s), stride (units per gait cycle), period (s),
  //     offset (episodes), avoid: [x], clear}
  function wander(o, t) {
    const P = o.period, u = t / P + (o.offset || 0), k = Math.floor(u), f = (u - k) * P;
    const a = waypoint(o, k), b = waypoint(o, k + 1), prev = waypoint(o, k - 1);
    const d = Math.abs(b - a), walkT = Math.min(P * .78, d / o.speed + .5), restT = P - walkT;
    const idle = mulberry32(hash(o.key ^ 0x1d1e, k))();
    if (f < restT || d < 1) {
      // Settle into the idle action, then come out of it before setting off.
      const env = Math.min(step(.5, 1.6, f), step(restT - .25, restT - 1.3, f));
      return {x: a, dir: a >= prev ? 1 : -1, m: 0, ph: 0, resting: true, env, idle, episode: k};
    }
    const w = (f - restT) / walkT, s = ease(w);
    return {x: a + (b - a) * s, dir: b >= a ? 1 : -1, m: Math.sin(Math.PI * w),
      ph: d * s / o.stride * Math.PI * 2, resting: false, env: 0, idle, episode: k};
  }

  // Perch-to-perch flight for birds and butterflies. The spots are toured in a
  // fixed shuffled cycle, so consecutive perches always differ and the answer
  // stays O(1) in time. o: {key, spots: [[x,y]], speed, period, lift}
  function flight(o, t) {
    const n = o.spots.length, r0 = mulberry32(o.key), order = o.spots.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r0() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const P = o.period, u = t / P + r0(), k = Math.floor(u), f = (u - k) * P;
    const spot = j => o.spots[order[((j % n) + n) % n]];
    const a = spot(k), b = spot(k + 1), prev = spot(k - 1);
    const dx = b[0] - a[0], dist = Math.hypot(dx, b[1] - a[1]);
    // Perch time varies per visit; flight time follows the distance covered.
    const flyT = Math.min(P * .6, dist / o.speed + .4);
    const restT = (P - flyT) * (.55 + mulberry32(hash(o.key, k))() * .45), takeoff = P - flyT;
    if (f < takeoff || n < 2) {
      const env = Math.min(step(.3, 1, f), step(takeoff - .1, takeoff - .8, f));
      // Hops a little along the branch between longer flights.
      const shuffle = f > restT ? (f - restT) / Math.max(.01, takeoff - restT) : 0;
      return {x: a[0] + Math.sin(shuffle * Math.PI) * 6 * Math.sign(dx || 1), y: a[1],
        dir: a[0] >= prev[0] ? 1 : -1, flying: false, env, w: 0, visit: k};
    }
    const w = (f - takeoff) / flyT, s = ease(w), lift = (o.lift || 30) + dist * .16;
    return {x: a[0] + dx * s, y: a[1] + (b[1] - a[1]) * s - Math.sin(Math.PI * w) * lift,
      dir: dx >= 0 ? 1 : -1, flying: true, env: 0, w, visit: k};
  }

  // Distance actually covered by an oscillation x = osc(v, L), for leg phase.
  function oscDistance(v, L) {
    const half = Math.floor(v / L), pos = L / 2 * (1 - Math.cos((v - half * L) / L * Math.PI));
    return half * L + pos;
  }

  // 1 when something is within `near`, fading to 0 by `far`.
  const proximity = (dist, near, far) => 1 - step(near, far, dist);

  return {wander, flight, oscDistance, proximity, step};
})();
