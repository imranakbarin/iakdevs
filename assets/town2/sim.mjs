// New Toy Town: the simulation. Pure logic (no THREE, no DOM): who is where, and when.
//  - Residents live behind a door and do their round door to door along the pavements; they are only ever out of
//    doors while walking, and they appear and disappear exactly on a doorstep.
//  - Vehicles follow the one closed tour of the road network, keep a gap from the one in front, wait for anyone
//    crossing in front of them, and the bus pulls up at its stops.
import {CAST, VEHICLES, BUS_STOPS, BUILDINGS, TRACK, DAY, rand, doorOf, building} from './def.mjs';
import {buildGraph, along, nearest} from './graph.mjs';

export function createSim(seed = 7) {
  const graph = buildGraph(), tour = graph.tour;
  let clock = 0, n = 0;
  const rnd = () => rand(seed * 977 + (n++));
  const residents = CAST.map((def, i) => ({id: def.id, def, state: 'inside', at: def.home, step: 0, until: 1.5 + i * 3.2, route: null, s: 0, x: graph.doors[def.home].x, z: graph.doors[def.home].z, tx: 0, tz: 1,
    speed: (def.small ? .66 : .52) * (.92 + rand(seed + i * 31) * .2), target: null, outings: 0}));
  const stops = BUS_STOPS.map(b => ({...b, s: nearest(tour, b.x, b.z).s}));
  // A vehicle's home point on the tour: the place on the lanes nearest its garage door. It leaves and returns there only.
  const vehicles = VEHICLES.map((def, i) => { const d = doorOf(building(def.home)), s0 = nearest(tour, d.x, d.z).s;
    return {id: def.id, def, home: s0, s: s0, v: 0, wait: 0, lastStop: null, x: 0, z: 0, tx: 1, tz: 0, stopsMade: 0, state: 'parked', laps: 0, trips: 0, call: 0, travelled: 0}; });
  const hourOf = t => (6 + t / DAY * 24) % 24;
  const inWindow = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;
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
  let hour = hourOf(0);

  function stepResident(r, dt) {
    if (r.state === 'inside') {
      const asleep = !inWindow(hour, r.def.wake ?? 6.5, r.def.sleep ?? 20.5);
      if (asleep) { if (r.at === r.def.home) { r.step = 0; r.until = Math.max(r.until, clock + .5); return; } }   // at home for the night
      if (clock < r.until && !asleep) return;   // (after hours nobody lingers: straight home)
      const round = r.def.round; let [target] = asleep ? [r.def.home] : round[r.step];   // after hours everybody heads home

      if (target === r.at && !asleep) { r.step = (r.step + 1) % round.length; [target] = round[r.step]; if (target === r.at) { r.until = clock + 5; return; } }
      const route = graph.walk(r.at, target); if (!route) { r.until = clock + 5; return; }
      r.route = route; r.s = 0; r.target = target; r.state = 'walking'; r.outings++;
      const p = along(route, 0); r.x = p.x; r.z = p.z; r.tx = p.tx; r.tz = p.tz;
      return;
    }
    r.s = Math.min(r.route.length, r.s + r.speed * dt);
    const p = along(r.route, r.s); r.x = p.x; r.z = p.z; r.tx = p.tx; r.tz = p.tz;
    if (r.s >= r.route.length) {   // on the doorstep: in they go
      const round = r.def.round, stay = round[r.step][1];
      r.state = 'inside'; r.at = r.target; r.target = null; r.route = null; r.until = clock + stay * (.8 + rnd() * .4); if (r.at === round[r.step][0]) r.step = (r.step + 1) % round.length;
    }
  }
  const clearAt = (s0, gap) => vehicles.every(o => o.state === 'parked' || Math.min(ahead(s0, o.s), ahead(o.s, s0)) > gap);
  function stepVehicle(v, dt) {
    const def = v.def;
    if (v.state === 'parked') {
      const due = def.onCall ? v.call > 0 : inWindow(hour, def.from, def.to);
      if (due && clearAt(v.home, 2.6)) { v.state = 'driving'; v.s = v.home; v.v = 0; v.wait = 0; v.lastStop = null; v.travelled = 0; place(v); }
      return;
    }
    if (def.onCall && v.state === 'driving' && v.travelled > 30) v.call = 0;   // the call-out is over after a good run round the town
    if (v.state === 'driving' && (def.onCall ? v.call <= 0 && v.travelled > 8 : !inWindow(hour, def.from, def.to))) v.state = 'returning';
    if (v.wait > 0) { v.wait -= dt; v.v = 0; return; }
    let want = def.speed * (v.state === 'returning' ? 1.4 : 1);   // heading home after the day's work, a little brisker
    for (const o of vehicles) if (o !== v && o.state !== 'parked') { const gap = ahead(v.s, o.s); if (gap < 2.2) want = Math.min(want, Math.max(0, (gap - 1.0) / 1.2) * def.speed); }   // keep a gap
    for (const r of residents) if (r.state === 'walking') {   // somebody in the road just ahead: wait for them
      const dx = r.x - v.x, dz = r.z - v.z, f = dx * v.tx + dz * v.tz, side = Math.abs(dx * v.tz - dz * v.tx);
      if (f > .1 && f < .95 && side < .3) want = 0;
    }
    if (def.stops && v.state === 'driving') for (const st of stops) { const gap = ahead(v.s, st.s); if (gap < .12 && v.lastStop !== st.id) { v.wait = 4; v.lastStop = st.id; v.stopsMade++; want = 0; } else if (gap < 1.2 && v.lastStop !== st.id) want = Math.min(want, .25 + gap * .5); }
    if (v.state === 'returning') {   // off duty: into the next depot along the road (a garage, the barn, the post office, the fire station)
      const gap = ahead(v.s, v.home); if (gap < .45) want = Math.min(want, .3);   // only ever into its own garage
      if (gap < .1 || gap > tour.length - .1) { v.state = 'parked'; v.v = 0; v.trips++; if (def.onCall) v.call = 0; v.parkedAt = v.s; return; }
    }
    v.v += Math.max(-2.4 * dt, Math.min(1.1 * dt, want - v.v));
    const step = Math.max(0, v.v) * dt; v.s = (v.s + step) % tour.length; v.travelled += step; place(v);
  }
  function update(dt) {
    dt = Math.min(dt, .1); clock += dt; hour = hourOf(clock);
    for (const r of residents) stepResident(r, dt);
    for (const v of vehicles) stepVehicle(v, dt);
    stepTrain(dt);
  }
  return {graph, residents, vehicles, stops, train, update, get clock() { return clock; }, get hour() { return hour; }, setHour(h) { clock = ((h - 6 + 24) % 24) / 24 * DAY; hour = hourOf(clock); }, dispatchFire() { const f = vehicles.find(v => v.id === 'fire'); if (f) f.call = 1; }, doorIds: BUILDINGS.filter(b => b.door).map(b => b.id)};
}
