// New Toy Town: the simulation. Pure logic (no THREE, no DOM): who is where, and when.
//  - Residents live behind a door and do their round door to door along the pavements; they are only ever out of
//    doors while walking, and they appear and disappear exactly on a doorstep.
//  - Vehicles follow the one closed tour of the road network, keep a gap from the one in front, wait for anyone
//    crossing in front of them, and the bus pulls up at its stops.
import {CAST, VEHICLES, BUS_STOPS, BUILDINGS, TRACK, rand} from './def.mjs';
import {buildGraph, along, nearest} from './graph.mjs';

export function createSim(seed = 7) {
  const graph = buildGraph(), tour = graph.tour;
  let clock = 0, n = 0;
  const rnd = () => rand(seed * 977 + (n++));
  const residents = CAST.map((def, i) => ({id: def.id, def, state: 'inside', at: def.home, step: 0, until: 1.5 + i * 3.2, route: null, s: 0, x: graph.doors[def.home].x, z: graph.doors[def.home].z, tx: 0, tz: 1,
    speed: (def.small ? .66 : .52) * (.92 + rand(seed + i * 31) * .2), target: null, outings: 0}));
  const stops = BUS_STOPS.map(b => ({...b, s: nearest(tour, b.x, b.z).s}));
  const vehicles = VEHICLES.map((def, i) => ({id: def.id, def, s: tour.length * i / VEHICLES.length, v: def.speed, wait: 0, lastStop: null, x: 0, z: 0, tx: 1, tz: 0, stopsMade: 0}));
  // The little train shuttles along its track: in to the platform, wait, up to the far buffer, wait, and back.
  const platformZ = (TRACK.platform.z0 + TRACK.platform.z1) / 2, stopsAt = [platformZ + .55, TRACK.z0 + 1.55];
  const train = {z: stopsAt[1], v: 0, target: 0, wait: 4, trips: 0, boardedAtPlatform: 0};
  function stepTrain(dt) {
    if (train.wait > 0) { train.wait -= dt; train.v = 0; return; }
    const goal = stopsAt[train.target], d = goal - train.z, want = Math.sign(d) * Math.min(.7, Math.abs(d) * 1.1 + .06);
    train.v += Math.max(-1.2 * dt, Math.min(.8 * dt, want - train.v)); train.z += train.v * dt;
    if (Math.abs(d) < .03 && Math.abs(train.v) < .15) { train.z = goal; train.v = 0; train.wait = train.target === 0 ? 9 : 6; train.target ^= 1; train.trips++; }
  }
  const ahead = (from, to) => ((to - from) % tour.length + tour.length) % tour.length;   // distance along the tour from one point forward to another
  function place(v) { const p = along(tour, v.s); v.x = p.x; v.z = p.z; v.tx = p.tx; v.tz = p.tz; }
  vehicles.forEach(place);

  function stepResident(r, dt) {
    if (r.state === 'inside') {
      if (clock < r.until) return;
      const round = r.def.round; let [target] = round[r.step];
      if (target === r.at) { r.step = (r.step + 1) % round.length; [target] = round[r.step]; if (target === r.at) { r.until = clock + 5; return; } }
      const route = graph.walk(r.at, target); if (!route) { r.until = clock + 5; return; }
      r.route = route; r.s = 0; r.target = target; r.state = 'walking'; r.outings++;
      const p = along(route, 0); r.x = p.x; r.z = p.z; r.tx = p.tx; r.tz = p.tz;
      return;
    }
    r.s = Math.min(r.route.length, r.s + r.speed * dt);
    const p = along(r.route, r.s); r.x = p.x; r.z = p.z; r.tx = p.tx; r.tz = p.tz;
    if (r.s >= r.route.length) {   // on the doorstep: in they go
      const round = r.def.round, stay = round[r.step][1];
      r.state = 'inside'; r.at = r.target; r.target = null; r.route = null; r.until = clock + stay * (.8 + rnd() * .4); r.step = (r.step + 1) % round.length;
    }
  }
  function stepVehicle(v, dt) {
    if (v.wait > 0) { v.wait -= dt; v.v = 0; return; }
    let want = v.def.speed;
    for (const o of vehicles) if (o !== v) { const gap = ahead(v.s, o.s); if (gap < 2.2) want = Math.min(want, Math.max(0, (gap - 1.0) / 1.2) * v.def.speed); }   // keep a gap
    for (const r of residents) if (r.state === 'walking') {   // somebody in the road just ahead: wait for them
      const dx = r.x - v.x, dz = r.z - v.z, f = dx * v.tx + dz * v.tz, side = Math.abs(dx * v.tz - dz * v.tx);
      if (f > .1 && f < .95 && side < .3) want = 0;
    }
    if (v.def.stops) for (const st of stops) { const gap = ahead(v.s, st.s); if (gap < .12 && v.lastStop !== st.id) { v.wait = 4; v.lastStop = st.id; v.stopsMade++; want = 0; } else if (gap < 1.2 && v.lastStop !== st.id) want = Math.min(want, .25 + gap * .5); }
    v.v += Math.max(-2.4 * dt, Math.min(1.1 * dt, want - v.v));
    v.s = (v.s + Math.max(0, v.v) * dt) % tour.length; place(v);
  }
  function update(dt) {
    dt = Math.min(dt, .1); clock += dt;
    for (const r of residents) stepResident(r, dt);
    for (const v of vehicles) stepVehicle(v, dt);
    stepTrain(dt);
  }
  return {graph, residents, vehicles, stops, train, update, get clock() { return clock; }, doorIds: BUILDINGS.filter(b => b.door).map(b => b.id)};
}
