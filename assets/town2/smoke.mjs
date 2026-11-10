// New Toy Town: the engine's smoke. Pure (no THREE, no DOM): a small ring of puffs that rise, drift, swell and fade.
export function createSmoke(max = 14, ttl = 2.4, rnd = Math.random) {
  const puffs = Array.from({length: max}, () => ({age: Infinity, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0}));
  let next = 0, acc = 0;
  const me = {puffs, ttl, max,
    emit(x, y, z, vx = 0, vz = 0) { const p = puffs[next++ % max]; p.age = 0; p.x = x; p.y = y; p.z = z; p.vx = vx + (rnd() - .5) * .06; p.vy = .3 + rnd() * .12; p.vz = vz + (rnd() - .5) * .06; },
    // dt seconds; source {x, y, z, vx, vz} where the chimney is now (or null when it is not smoking); rate puffs a second
    update(dt, source, rate = 4) {
      for (const p of puffs) if (p.age < ttl) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy *= 1 - .25 * dt; }
      if (source && rate > 0) { acc += dt * rate; while (acc >= 1) { acc -= 1; me.emit(source.x, source.y, source.z, source.vx || 0, source.vz || 0); } } else acc = 0;
    },
    // size of a puff: swells quickly, then thins away to nothing
    size(p) { if (p.age >= ttl) return 0; const t = p.age / ttl; return (.035 + .09 * Math.sin(Math.min(1, t * 1.6) * Math.PI / 2)) * (1 - t * t); },
    alive() { return puffs.filter(p => p.age < ttl).length; }
  };
  return me;
}
