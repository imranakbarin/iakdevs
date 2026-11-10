// New Toy Town: the simulation. Pure logic (no THREE, no DOM): who is where, and when.
//  - Residents live behind a door and do their round door to door along the pavements; they are only ever out of
//    doors while walking, and they appear and disappear exactly on a doorstep.
//  - Vehicles follow the one closed tour of the road network, keep a gap from the one in front, wait for anyone
//    crossing in front of them, and the bus pulls up at its stops.
import {CAST, VEHICLES, BUS_STOPS, BUILDINGS, TRACK, DAY, LAMPS, rand, doorOf, building} from './def.mjs';
import {buildGraph, along, nearest, leftOf} from './graph.mjs';
import {createWeather} from './weather.mjs';
import {STORIES} from './stories.mjs';

export function createSim(seed = 7, opts = {}) {
  const season = opts.season || null;   // stories can be seasonal; null means all of them
  const graph = buildGraph(), tour = graph.tour;
  let clock = 0, n = 0;
  const rnd = () => rand(seed * 977 + (n++));
  const residents = CAST.map((def, i) => ({id: def.id, def, state: 'inside', at: def.home, step: 0, until: 1.5 + i * 3.2, route: null, s: 0, x: graph.doors[def.home].x, z: graph.doors[def.home].z, tx: 0, tz: 1,
    speed: (def.small ? .66 : .52) * (.92 + rand(seed + i * 31) * .2), target: null, outings: 0, errands: [], stay: null, lampJob: null, lampQueue: [], lampWait: 0, ox: 0, oz: 0, pause: 0, look: null, greetAt: 0, blocked: 0}));
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
  const weather = createWeather(seed);

  // The street lamps. Outside the lamplighter's hours they follow the clock (on by night, off by day); in them, only his rounds change them.
  const E0 = 17.2, E1 = 20.6, M0 = 4.6, M1 = 7.5, evening = h => h >= E0 && h < E1, morning = h => h >= M0 && h < M1;   // his hours: lamps up from late afternoon, out again after dawn
  const lamps = LAMPS.map(l => ({...l, on: hour < M1 || hour >= E1, lit: 0})); lamps.forEach(l => { l.lit = l.on ? 1 : 0; });
  const lampJobNow = () => evening(hour) ? 'light' : morning(hour) ? 'snuff' : null;
  const lampsToDo = job => lamps.filter(l => job === 'light' ? !l.on : l.on);
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
    const job = lampJobNow(); if (!job || !lampsToDo(job).length) return false;
    r.lampJob = job; r.lampQueue = lampsToDo(job).map(l => l.id); r.outings++; lastDepart = clock; r.stay = null; return lampLeg(r);
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
    let want = def.speed * (1 - .18 * weather.rain) * (v.state === 'returning' ? 1.4 : 1);   // heading home after the day's work, a little brisker
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
    stepTrain(dt); weather.update(dt); stepStories(); stepLamps(dt);
  }
  return {graph, residents, vehicles, stops, train, weather, season, lamps, get lampsTended() { return tended; }, story, stage, update, get clock() { return clock; }, get hour() { return hour; }, setHour(h) { clock = ((h - 6 + 24) % 24) / 24 * DAY; hour = hourOf(clock); snapLamps(); }, dispatchFire() { const f = vehicles.find(v => v.id === 'fire'); if (f) f.call = 1; }, doorIds: BUILDINGS.filter(b => b.door).map(b => b.id)};
}
