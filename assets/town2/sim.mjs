// New Toy Town: the simulation. Pure logic (no THREE, no DOM): who is where, and when.
//  - Residents live behind a door and do their round door to door along the pavements; they are only ever out of
//    doors while walking, and they appear and disappear exactly on a doorstep.
//  - Vehicles drive over the lane network: each plans a route (shortest lanes) to where it is going, keeps a gap from the one in front, takes a
//    lock on a junction before crossing it, waits for anyone crossing in front of it, and the bus pulls up at its stops.
//  - The train circles the railway loop, slowing for each station and standing there a while.
import {CAST, VEHICLES, BUS_LINES, STATIONS, BUILDINGS, DAY, LAMPS, loopPt, rand, doorOf, building} from './def.mjs';
import {buildGraph, along, leftOf} from './graph.mjs';
import {createWeather} from './weather.mjs';
import {STORIES} from './stories.mjs';

export function createSim(seed = 7, opts = {}) {
  const season = opts.season || null;   // stories can be seasonal; null means all of them
  const graph = buildGraph();
  let clock = 0, n = 0;
  const rnd = () => rand(seed * 977 + (n++));
  const residents = CAST.map((def, i) => ({id: def.id, def, state: 'inside', at: def.home, step: 0, until: 1.5 + i * 3.2, route: null, s: 0, x: graph.doors[def.home].x, z: graph.doors[def.home].z, tx: 0, tz: 1,
    speed: (def.small ? .66 : .52) * (.92 + rand(seed + i * 31) * .2), target: null, outings: 0, errands: [], stay: null, lampJob: null, lampQueue: [], lampWait: 0, ox: 0, oz: 0, pause: 0, look: null, greetAt: 0, blocked: 0}));
  // Every building with a door has a place on the lanes beside it (the lane and how far along it): where a vehicle stops to call there.
  const spots = {}; const spotOf = id => spots[id] || (spots[id] = (() => { const d = doorOf(building(id)), p = graph.lanePoint(d.x, d.z); return {id, lane: p.lane, s: p.s}; })());
  const stops = [...new Set(Object.values(BUS_LINES).flat())].map(id => ({id, ...spotOf(id)}));
  const vehicles = VEHICLES.map(def => ({id: def.id, def, home: spotOf(def.home), state: 'parked', route: null, s: 0, stopAt: 0, target: null, v: 0, wait: 0, x: 0, z: 0, tx: 1, tz: 0, planIdx: 0, lastId: null, stopsMade: 0, trips: 0, call: 0, travelled: 0, held: null, stuck: 0, ghost: 0}));
  const homeXY = v => { const p = along(graph.lane(v.home.lane).line, v.home.s); return {x: p.x, z: p.z}; };
  const hourOf = t => (6 + t / DAY * 24) % 24;
  const inWindow = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;
  // The train: round the railway loop (clockwise), slowing into each station and standing there; the cars follow the head at a fixed spacing.
  const loop = graph.loop, stationStops = STATIONS.map(st => { const p = loopPt(st.t); return {...st, s: graph.loopS(p[0], p[1])}; }).sort((a, b) => a.s - b.s);
  const CRUISE = 1.25, STOP_AT = 1.5;   // the head stops this far past the platform's middle, so the cars stand along the platform
  const train = {s: stationStops[0].s + STOP_AT - 6, v: 0, wait: 3, next: 0, laps: 0, stopsMade: 0, length: loop.length, stations: stationStops, cars: 4, gap: .95, at: null};
  const toStop = i => ((stationStops[i].s + STOP_AT - train.s) % loop.length + loop.length) % loop.length;
  { let best = 0, bd = Infinity; for (let i = 0; i < stationStops.length; i++) { const d = toStop(i); if (d < bd) { bd = d; best = i; } } train.next = best; }
  function stepTrain(dt) {
    if (train.wait > 0) { train.wait -= dt; train.v = 0; return; }
    const d = toStop(train.next), want = Math.min(CRUISE, Math.sqrt(2 * .7 * Math.max(0, d - .05)) + .05);
    train.v += Math.max(-1.1 * dt, Math.min(.45 * dt, want - train.v));
    const before = train.s; train.s += train.v * dt; if (train.s >= loop.length) { train.s -= loop.length; train.laps++; }
    const arrived = ((stationStops[train.next].s + STOP_AT - train.s) % loop.length + loop.length) % loop.length;
    if (d < .06 || (d < .4 && arrived > loop.length / 2)) { train.s = stationStops[train.next].s + STOP_AT; if (train.s >= loop.length) train.s -= loop.length; train.v = 0; train.wait = 7 + rnd() * 3; train.at = stationStops[train.next].id; train.next = (train.next + 1) % stationStops.length; train.stopsMade++; }
    else if (d > 1) train.at = null;
  }
  const ahead = (from, to, L) => ((to - from) % L + L) % L;
  function place(v) { const p = along(v.route.line, v.s); v.x = p.x; v.z = p.z; v.tx = p.tx; v.tz = p.tz; }
  let hour = hourOf(0);
  const weather = createWeather(seed);

  // The street lamps. Outside the lamplighter's hours they follow the clock (on by night, off by day); in them, only his rounds change them.
  const E0 = 17.2, E1 = 20.6, M0 = 4.0, M1 = 7.5, evening = h => h >= E0 && h < E1, morning = h => h >= M0 && h < M1;   // his hours: lamps up from late afternoon, out again after dawn
  const lamps = LAMPS.map(l => ({...l, on: hour < M1 || hour >= E1, lit: 0})); lamps.forEach(l => { l.lit = l.on ? 1 : 0; });
  const lampJobNow = () => evening(hour) ? 'light' : morning(hour) ? 'snuff' : null;
  const lampsToDo = (job, zone) => lamps.filter(l => l.zone === zone && (job === 'light' ? !l.on : l.on));
  function snapLamps() {   // after a jump in time: a lamplighter part-way through his round
    const N = lamps.length;
    lamps.forEach((l, i) => { l.on = evening(hour) ? (hour - E0) / (E1 - E0) > i / N : morning(hour) ? (hour - M0) / (M1 - M0) < i / N : !(hour >= M1 && hour < E0); l.lit = l.on ? 1 : 0; });
    for (const r of residents) if (r.def.lamplighter) { r.lampJob = null; r.lampQueue = []; r.lampWait = 0; }
  }
  function stepLamps(dt) {
    if (hour >= E1 || hour < M0) lamps.forEach(l => { l.on = true; }); else if (hour >= M1 && hour < E0) lamps.forEach(l => { l.on = false; });
    for (const l of lamps) l.lit += ((l.on ? 1 : 0) - l.lit) * Math.min(1, dt * 3);
  }
  // Mr Wick's rounds: the nearest lamp that still needs tending, then the next nearest, and home.
  function lampLeg(r) {
    while (r.lampQueue.length) {
      const here = r.at; let best = null, bl = Infinity;
      for (const id of r.lampQueue) { const w = graph.walk(here, id); if (w && w.length < bl) { bl = w.length; best = id; } }
      if (!best) break; r.lampQueue = r.lampQueue.filter(id => id !== best);
      const l = lamps.find(x => x.id === best); if (!(r.lampJob === 'light' ? !l.on : l.on)) continue;   // somebody got there first, or the clock did
      return depart(r, best);
    }
    r.lampJob = null; r.stay = 40; return depart(r, r.def.home);   // the round is done: home
  }
  function depart(r, target) {
    const route = graph.walk(r.at, target); if (!route) return false;
    r.route = route; r.s = 0; r.target = target; r.state = 'walking'; r.ox = r.oz = 0; r.pause = 0; r.look = null; r.blocked = 0;
    const p = along(route, 0); r.x = p.x; r.z = p.z; r.tx = p.tx; r.tz = p.tz; return true;
  }
  function startLampRound(r) {
    const job = lampJobNow(); if (!job || !lampsToDo(job, r.def.zone).length) return false;
    r.lampJob = job; r.lampQueue = lampsToDo(job, r.def.zone).map(l => l.id); r.outings++; lastDepart = clock; r.stay = null; return lampLeg(r);
  }
  let tended = 0;
  function tendLamp(r) {   // arrived at a lamp: a moment to reach up and light or snuff it
    const l = lamps.find(x => x.id === r.target); r.at = r.target; r.target = null; r.route = null; r.lampWait = .55; r.pause = .55; r.look = {x: l.x, z: l.z, def: {name: 'the lamp'}};
    l.on = r.lampJob === 'light'; tended++;
  }
  let lastDepart = -1e9;
  function stepResident(r, dt) {
    if (r.lampWait > 0) { r.lampWait -= dt; r.pause = Math.max(0, r.lampWait); if (r.lampWait <= 0) { r.look = null; lampLeg(r); } return; }
    if (r.state === 'inside') {
      const asleep = !inWindow(hour, r.def.wake ?? 6.5, r.def.sleep ?? 20.5);
      if (asleep) { if (r.at === r.def.home) { r.step = 0; r.until = Math.max(r.until, clock + .5); return; } }   // at home for the night
      if (r.def.lamplighter && !asleep && startLampRound(r)) return;   // lamp-lighting time comes before everything else
      if (clock < r.until && !asleep) return;   // (after hours nobody lingers: straight home)
      if (!asleep && (clock < lastDepart + 2.2 || residents.reduce((n, o) => n + (o.state === 'walking'), 0) >= 7)) { r.until = clock + 1.2 + rnd() * 1.5; return; }   // people come out one by one, never all at once
      const round = r.def.round; let [target] = asleep ? [r.def.home] : round[r.step];   // after hours everybody heads home
      r.stay = null;
      while (!asleep && r.errands.length) {   // an errand from a story comes first
        const [place, stay] = r.errands.shift(); if (place === r.at) { r.until = clock + stay; return; }
        target = place; r.stay = stay; break;
      }

      if (target === r.at && !asleep && r.stay === null) { r.step = (r.step + 1) % round.length; [target] = round[r.step]; if (target === r.at) { r.until = clock + 5; return; } }
      const route = graph.walk(r.at, target); if (!route) { r.until = clock + 5; return; }
      r.route = route; r.s = 0; r.target = target; r.state = 'walking'; r.outings++; r.ox = r.oz = 0; r.pause = 0; r.look = null; r.blocked = 0; lastDepart = clock;
      const p = along(route, 0); r.x = p.x; r.z = p.z; r.tx = p.tx; r.tz = p.tz;
      return;
    }
    // Manners on the pavement: keep to your own side, wait behind whoever is slower in front, and stop for a word with anyone you meet.
    if (r.pause > 0) r.pause -= dt;
    else {
      let k = 1;
      if (!r.lampJob) for (const o of residents) if (o !== r && o.state === 'walking') {   // (the lamplighter on his round has no time for either)
        const dx = o.x - r.x, dz = o.z - r.z, f = dx * r.tx + dz * r.tz, lat = Math.abs(dx * r.tz - dz * r.tx), dot = o.tx * r.tx + o.tz * r.tz;
        if (dot > .3 && f > 0 && f < .42 && lat < .22) k = Math.min(k, Math.max(0, (f - .2) / .22));   // somebody just ahead, going my way
        else if (dot < -.5 && f > 0 && f < .5 && lat < .3 && clock > r.greetAt && clock > o.greetAt && !o.pause) { r.pause = o.pause = .9 + rnd() * .5; r.greetAt = o.greetAt = clock + 45; r.look = o; o.look = r; k = 0; }   // meeting head on: a hello
      }
      if (k < .05) { r.blocked += dt; if (r.blocked > 5) k = 1; } else r.blocked = 0;   // (and never stuck for long)
      r.s = Math.min(r.route.length, r.s + r.speed * (r.lampJob ? 2.4 : 1) * (1 + .15 * weather.rain) * k * dt);   // a quicker step in the rain
    }
    const p = along(r.route, r.s), ramp = Math.min(1, r.s / .45, (r.route.length - r.s) / .45), [lx, lz] = leftOf(p.tx, p.tz), e = Math.min(1, dt * 4);
    r.ox += (lx * .1 * ramp - r.ox) * e; r.oz += (lz * .1 * ramp - r.oz) * e;   // a hand's width to the left of the pavement's middle, nothing at the doors
    r.x = p.x + r.ox; r.z = p.z + r.oz; r.tx = p.tx; r.tz = p.tz;
    if (r.s >= r.route.length) {   // on the doorstep: in they go
      r.x = p.x; r.z = p.z;
      if (r.target && r.target.startsWith('lamp')) { tendLamp(r); return; }
      const round = r.def.round, stay = r.stay ?? round[r.step][1];
      r.state = 'inside'; r.at = r.target; r.target = null; r.route = null; r.until = clock + stay * (.8 + rnd() * .4); if (r.stay === null && r.at === round[r.step][0]) r.step = (r.step + 1) % round.length; r.stay = null;
    }
  }
  // ---- Vehicles
  const holders = new Map(), JUNCTION = .8, active = () => vehicles.filter(o => o.state !== 'parked');
  const houses = BUILDINGS.filter(b => b.door && /^c\d/.test(b.id)).map(b => b.id), places = BUILDINGS.filter(b => b.door).map(b => b.id);
  const pick = list => list[Math.floor(rnd() * list.length)];
  // Where this vehicle goes next, as a spot on the lanes plus how long to stand there.
  function nextTarget(v) {
    const d = v.def;
    if (v.state === 'returning') return {...v.home, dwell: 0, park: true};
    let id;
    switch (d.plan) {
      case 'line': { const line = BUS_LINES[d.line]; id = line[v.planIdx % line.length]; v.planIdx++; return {...spotOf(id), id, dwell: 4}; }
      case 'round': id = d.targets[v.planIdx++ % d.targets.length]; return {...spotOf(id), id, dwell: 3};
      case 'stops': do id = pick(d.targets); while (id === v.lastId && d.targets.length > 1); return {...spotOf(id), id, dwell: 12};
      case 'wander': do id = pick(d.targets); while (id === v.lastId && d.targets.length > 1); return {...spotOf(id), id, dwell: 6};
      case 'call': do id = pick(houses); while (id === v.lastId); return {...spotOf(id), id, dwell: 12};
      default: do id = pick(places); while (id === v.lastId); return {...spotOf(id), id, dwell: 3 + rnd() * 3};   // taxi
    }
  }
  // Plan the route from a place on a lane to a target; false if there is none.
  function planLeg(v, lane, s, target) {
    const ids = target.lane === lane && target.s > s + .3 ? [lane] : graph.laneRoute(lane, target.lane); if (!ids) return false;
    const r = graph.routeLine(ids); v.route = r; v.s = s; v.target = target; v.stopAt = r.bounds[r.bounds.length - 1].s0 + target.s; return true;
  }
  const laneAt = v => { const b = v.route.bounds; let i = b.length - 1; while (i > 0 && v.s < b[i].s0) i--; return {lane: b[i].lane, s: Math.max(0, v.s - b[i].s0)}; };
  const exitClear = (v, i) => { const b = v.route.bounds[i], p = along(v.route.line, Math.min(v.route.line.length, b.s0 + 1.0)); return vehicles.every(o => o === v || o.state === 'parked' || Math.hypot(o.x - p.x, o.z - p.z) > .55); };
  const clearHome = v => { const h = homeXY(v); return vehicles.every(o => o === v || o.state === 'parked' || Math.hypot(o.x - h.x, o.z - h.z) > 1.5); };
  function stepVehicle(v, dt) {
    const def = v.def;
    if (v.state === 'parked') {
      const due = def.onCall ? v.call > 0 : inWindow(hour, def.from, def.to);
      if (!due || !clearHome(v)) return;
      const t = nextTarget(v);   // the first leg is planned from the garage
      if (!planLeg(v, v.home.lane, v.home.s, t)) return;
      v.state = 'driving'; v.v = 0; v.wait = 0; v.travelled = 0; v.lastId = t.id || null; v.held = null; v.stuck = 0; v.ghost = 0; place(v); return;
    }
    if (def.onCall && v.state === 'driving' && v.travelled > 30) v.call = 0;   // the call-out is over after a good run round the town
    if (v.state === 'driving' && (def.onCall ? v.call <= 0 && v.travelled > 8 : !inWindow(hour, def.from, def.to))) {   // off duty: back to the garage (even from a stop)
      const here = laneAt(v); if (planLeg(v, here.lane, here.s, nextTarget({...v, state: 'returning'}))) { v.state = 'returning'; v.s = here.s; v.wait = 0; }
    }
    if (v.wait > 0) { v.wait -= dt; v.v = 0; return; }
    let want = def.speed * (1 - .18 * weather.rain) * (v.state === 'returning' ? 1.3 : 1);   // heading home after the day's work, a little brisker
    // keep a gap from whoever is just ahead and going my way (or across my path)
    for (const o of vehicles) if (o !== v && o.state !== 'parked') {
      const dx = o.x - v.x, dz = o.z - v.z, f = dx * v.tx + dz * v.tz, lat = Math.abs(dx * v.tz - dz * v.tx), dot = o.tx * v.tx + o.tz * v.tz;
      if (f > 0 && f < 2.2 && lat < .34 && dot > -.2) want = Math.min(want, Math.max(0, (f - .62) / 1.2) * def.speed);
    }
    for (const r of residents) if (r.state === 'walking') {   // somebody in the road just ahead: wait for them
      const dx = r.x - v.x, dz = r.z - v.z, f = dx * v.tx + dz * v.tz, side = Math.abs(dx * v.tz - dz * v.tx);
      if (f > .1 && f < .95 && side < .3) want = 0;
    }
    // a junction ahead: take its lock before going in (and only if there is room beyond it), else stop short
    const b = v.route.bounds;
    if (v.held && v.s > v.held.s0 + JUNCTION) { if (holders.get(v.held.node) === v) holders.delete(v.held.node); v.held = null; }
    if (!v.held) for (let i = 1; i < b.length; i++) if (v.s < b[i].s0 + JUNCTION) {
      const entry = b[i].s0 - JUNCTION, node = graph.lane(b[i - 1].lane).to;
      if (v.s > entry - .7 && v.ghost <= 0) {
        if (!holders.get(node) && exitClear(v, i)) { holders.set(node, v); v.held = {node, s0: b[i].s0}; }
        else want = Math.min(want, Math.max(0, entry - v.s - .08) * 1.6);
      }
      break;
    }
    want = Math.min(want, Math.max(.0, v.stopAt - v.s) * 1.3 + .05);   // ease in to the place to stop
    v.v += Math.max(-2.4 * dt, Math.min(1.1 * dt, want - v.v));
    const step = Math.max(0, v.v) * dt; v.s = Math.min(v.stopAt, v.s + step); v.travelled += step; place(v);
    // stuck for a long time? stop being polite for a few seconds so nobody blocks the town for ever
    if (v.v < .03 && v.stopAt - v.s > .1) { v.stuck += dt; if (v.stuck > 20) { v.ghost = 6; v.stuck = 0; } } else v.stuck = 0;
    if (v.ghost > 0) v.ghost -= dt;
    if (v.stopAt - v.s < .05 && v.v < .35) {   // arrived
      const t = v.target; v.v = 0;
      if (t.park) { v.state = 'parked'; v.trips++; v.route = null; if (def.onCall) v.call = 0; if (v.held && holders.get(v.held.node) === v) holders.delete(v.held.node); v.held = null; return; }
      v.wait = t.dwell; v.stopsMade++; v.lastId = t.id || v.lastId;
      const here = laneAt(v), nt = nextTarget(v); if (!planLeg(v, here.lane, here.s, nt)) { v.wait = 5; return; }
    }
  }
  function releaseLocks() { for (const [node, o] of holders) if (o.state === 'parked' || !o.held || o.held.node !== node) holders.delete(node); }

  // Small stories: every so often, if the cast and the hour and the weather allow, one of them sends a few residents on errands.
  const story = {current: null, last: {}, count: {}, nextAt: 20, pending: null, log: []};
  const awake = r => r.state === 'inside' && inWindow(hour, r.def.wake ?? 6.5, (r.def.sleep ?? 20.5) - .5) && r.errands.length === 0;
  const resident = id => residents.find(r => r.id === id);
  const fits = (s, forced) => (!s.season || !season || s.season === season) && (forced || inWindow(hour, s.hours[0], s.hours[1])) && (s.wet === 'wet' ? weather.rain > .4 : s.wet === 'dry' ? weather.rain < .3 : true) && (forced ? s.go.filter(([who]) => awake(resident(who))).length >= Math.ceil(s.go.length / 2) : s.go.every(([who]) => awake(resident(who))));   // the news will do with half the cast
  function startStory(s, headline) {
    story.current = {id: s.id, title: s.title, headline: headline || null, start: clock, end: clock + 40}; story.last[s.id] = clock; story.count[s.id] = (story.count[s.id] || 0) + 1; story.log.push(s.id);
    s.go.forEach(([who, trips], i) => { const r = resident(who); if (!awake(r)) return; r.errands = trips.map(t => [...t]); r.until = Math.min(r.until, clock + 1 + i * 2.5); });
    if (s.fire) { const f = vehicles.find(v => v.id === 'fire'); if (f) f.call = 1; }
  }
  function stepStories() {
    if (story.current && clock > story.current.end) story.current = null;
    if (story.current || clock < story.nextAt) return;
    story.nextAt = clock + 6 + rnd() * 10;
    if (story.pending) {   // staged by the news: wait for the cast to be up and about
      const s = STORIES.find(x => x.id === story.pending.id);
      if (s && fits(s, true)) { startStory(s, story.pending.headline); story.pending = null; }
      else if (clock > story.pending.until) story.pending = null;
      return;
    }
    const ok = STORIES.filter(s => !s.news && clock - (story.last[s.id] ?? -1e9) > 180 && fits(s));
    if (ok.length) { const least = Math.min(...ok.map(x => story.count[x.id] || 0)), pool = ok.filter(x => (story.count[x.id] || 0) === least); startStory(pool[Math.floor(rnd() * pool.length)]); }   // favour the ones seen least
  }
  function stage(id, headline) { story.pending = {id, headline, until: clock + 150}; story.nextAt = Math.min(story.nextAt, clock + 1); }
  function update(dt) {
    dt = Math.min(dt, .1); clock += dt; hour = hourOf(clock);
    for (const r of residents) stepResident(r, dt);
    for (const v of vehicles) stepVehicle(v, dt);
    releaseLocks(); stepTrain(dt); weather.update(dt); stepStories(); stepLamps(dt);
  }
  return {graph, residents, vehicles, stops, train, weather, season, lamps, get lampsTended() { return tended; }, story, stage, update, get clock() { return clock; }, get hour() { return hour; }, setHour(h) { clock = ((h - 6 + 24) % 24) / 24 * DAY; hour = hourOf(clock); snapLamps(); }, dispatchFire() { const f = vehicles.find(v => v.id === 'fire'); if (f) f.call = 1; }, doorIds: BUILDINGS.filter(b => b.door).map(b => b.id)};
}
