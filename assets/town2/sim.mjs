// New Toy Town: the simulation. Pure logic (no THREE, no DOM): who is where, and when.
//  - Residents live behind a door and do their round door to door along the pavements; they are only ever out of
//    doors while walking, and they appear and disappear exactly on a doorstep.
//  - Vehicles drive over the lane network: each plans a route (shortest lanes) to where it is going, keeps a gap from the one in front, takes a
//    lock on a junction before crossing it, waits for anyone crossing in front of it, and the bus pulls up at its stops.
//  - The train circles the railway loop, slowing for each station and standing there a while.
import {CAST, VEHICLES, BUS_LINES, STATIONS, BUILDINGS, DAY, LAMPS, FREIGHT, MARKET, DAYS, FISH, VENDORS, PIER, loopPt, rand, doorOf, building} from './def.mjs';
import {dwarfsOut} from './wildlife.mjs';
import {GOLDEN_COINS} from './angling.mjs';
import {festivalAt, FEST} from './festival.mjs';
import {newEco, newDay, stepEco, care as ecoCare, eatAt, deliver, peace as ecoPeace, summary as ecoSummary} from './ecology.mjs';
import {record as chronicleRecord, push as chroniclePush, clean as chronicleClean, chain as chronicleChain, headline as chronicleHeadline, followUp as chronicleFollow, FOLLOW} from './chronicle.mjs';
import {pick as directorPick} from './director.mjs';
import {makeDay as makeWishes, newCounters, have as wishHave, isDone as wishDone, note as noteCounter} from './quests.mjs';
import {STICKERS, scan as albumScan, clean as albumClean} from './album.mjs';
import {newHunt, start as huntStart, answer as huntAnswer, clueNow, mapOf} from './treasure.mjs';
import {upgradeOf, canBuy, cleanChest, balance as chestBalance} from './chest.mjs';
import {buildGraph, along, leftOf} from './graph.mjs';
import {makeNeeds, stepNeeds, arrive as needsArrive, meet as needsMeet, want as needsWant, moodOf} from './needs.mjs';
import {bump, friendSpot} from './memory.mjs';
import {etas} from './track.mjs';
import {edition} from './paper.mjs';
import {EVENTS, nextEventIn, pickEvent} from './events.mjs';
import {CASES, pickCase, pickHideout, cluesFor, MAX_WRONG, GAP} from './mystery.mjs';
import {clockText} from './paper.mjs';
import {questionFor, tally, labelOf, OPENS, CLOSES} from './vote.mjs';
import {AGES, YEAR_DAYS, BABY_NAMES, birthdayOf, pickCouple, canHaveBaby} from './saga.mjs';
import {createWeather} from './weather.mjs';
import {STORIES} from './stories.mjs';

export function createSim(seed = 7, opts = {}) {
  const season = opts.season || null;   // stories can be seasonal; null means all of them
  const graph = buildGraph();
  let clock = 0, n = 0;
  const rnd = () => rand(seed * 977 + (n++));
  const sagaLog = [], babies = [];
  // the week: the day of the week moves on every 480 s (Monday is 0); on Saturday and Sunday some people have a different round (no school)
  let weekday = ((opts.weekday ?? 0) % 7 + 7) % 7, dayIdx = 0; const startDay = weekday;
  const roundOf = r => (weekday >= 5 && r.def.weekend) || r.def.round;
  const residents = CAST.map((def, i) => ({id: def.id, def, state: 'inside', at: def.home, step: 0, until: 1.5 + (i % 13) * 4.2, route: null, s: 0, x: graph.doors[def.home].x, z: graph.doors[def.home].z, tx: 0, tz: 1,
    speed: (def.small ? .66 : .52) * (.92 + rand(seed + i * 31) * .2), target: null, outings: 0, errands: [], stay: null, lampJob: null, lampQueue: [], lampWait: 0, act: null, hurry: false, onPlatform: false, rideTo: null, rideFrom: null, carrying: null, ox: 0, oz: 0, pause: 0, look: null, greetAt: 0, blocked: 0, needs: makeNeeds((k => () => rand(seed * 131 + i * 17 + k++))(0)), mood: {score: 1, label: 'cheerful', why: null}, friends: {}, visits: {}, journal: [], age: AGES[def.id] ?? 30, spouse: null, kids: 0, marriedDay: -1}));
  // Every building with a door has a place on the lanes beside it (the lane and how far along it): where a vehicle stops to call there.
  const spots = {}; const spotOf = id => spots[id] || (spots[id] = (() => { const d = doorOf(building(id)), p = graph.lanePoint(d.x, d.z); return {id, lane: p.lane, s: p.s}; })());
  const stops = [...new Set(Object.values(BUS_LINES).flat())].map(id => ({id, ...spotOf(id)}));
  const vehicles = VEHICLES.map(def => ({id: def.id, def, home: spotOf(def.home), state: 'parked', route: null, s: 0, stopAt: 0, target: null, v: 0, wait: 0, x: 0, z: 0, tx: 1, tz: 0, planIdx: 0, lastId: null, stopsMade: 0, trips: 0, call: 0, travelled: 0, held: null, stuck: 0, ghost: 0}));
  const homeXY = v => { const p = along(graph.lane(v.home.lane).line, v.home.s); return {x: p.x, z: p.z}; };
  // a saved saga from an earlier visit: ages, marriages and babies carry over
  if (opts.saga) { const sv = opts.saga; for (const r of residents) { if (sv.ages && sv.ages[r.id] > r.age) r.age = sv.ages[r.id]; } for (const [a, b] of sv.marriages || []) { const ra = residents.find(r => r.id === a), rb = residents.find(r => r.id === b); if (ra && rb && !ra.spouse && !rb.spouse) { ra.spouse = b; rb.spouse = a; ra.marriedDay = rb.marriedDay = -5; } } for (const b of sv.babies || []) { babies.push(b); for (const id of b.parents || []) { const r = residents.find(x => x.id === id); if (r) r.kids++; } } }
  const hourOf = t => (6 + t / DAY * 24) % 24;
  const inWindow = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;
  // The train: round the railway loop (clockwise), slowing into each station and standing there; the cars follow the head at a fixed spacing.
  const loop = graph.loop, stationStops = STATIONS.map(st => { const p = loopPt(st.t); return {...st, s: graph.loopS(p[0], p[1])}; }).sort((a, b) => a.s - b.s);
  const CRUISE = 1.6, STOP_AT = 1.5;   // the head stops this far past the platform's middle, so the cars stand along the platform
  const train = {s: stationStops[0].s + STOP_AT - 6, v: 0, wait: 3, next: 0, laps: 0, stopsMade: 0, length: loop.length, stations: stationStops, cars: 4, gap: .95, at: null, ridden: 0, wagon: 6, seats: 10};
  const riders = [];
  const toStop = i => ((stationStops[i].s + STOP_AT - train.s) % loop.length + loop.length) % loop.length;
  { let best = 0, bd = Infinity; for (let i = 0; i < stationStops.length; i++) { const d = toStop(i); if (d < bd) { bd = d; best = i; } } train.next = best; }
  function stepTrain(dt) {
    if (train.wait > 0) { train.wait -= dt; train.v = 0; return; }
    const d = toStop(train.next), want = Math.min(CRUISE, Math.sqrt(2 * .7 * Math.max(0, d - .05)) + .05);
    train.v += Math.max(-1.1 * dt, Math.min(.45 * dt, want - train.v));
    const before = train.s; train.s += train.v * dt; if (train.s >= loop.length) { train.s -= loop.length; train.laps++; }
    const arrived = ((stationStops[train.next].s + STOP_AT - train.s) % loop.length + loop.length) % loop.length;
    if (d < .06 || (d < .4 && arrived > loop.length / 2)) { train.s = stationStops[train.next].s + STOP_AT; if (train.s >= loop.length) train.s -= loop.length; train.v = 0; train.wait = 5 + rnd() * 3; train.at = stationStops[train.next].id; const here = stationStops[train.next].id; train.next = (train.next + 1) % stationStops.length; train.stopsMade++; trainStop(here); }
    else if (d > 1) train.at = null;
  }
  // the signal before each station: red while the train stands there or is coming in, green otherwise
  const signalFor = id => { const i = stationStops.findIndex(x => x.id === id); return train.at === id || (train.next === i && toStop(i) < 2.4) ? 'red' : 'green'; };
  // when the train will be at each station, in seconds from now (a guess from its speed and how long it stands at each stop)
  function timetable() {
    const stops = stationStops.map((st, i) => ({id: st.id, ahead: train.at === st.id ? 0 : toStop(i)})), e = etas(train, stops);
    return stationStops.map(st => ({id: st.id, name: st.name, eta: e[st.id], hour: (hour + e[st.id] / 20) % 24}));
  }
  // keep the riders where the train is
  function carryRiders() { riders.forEach((r, i) => { const q = along(loop, train.s - train.gap * (1 + (i % 2))); r.x = q.x; r.z = q.z; }); }
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
    for (const r of residents) if (r.def.lamplighter) { r.lampJob = null; r.lampQueue = []; r.lampWait = 0; r.state = 'inside'; r.at = r.def.home; r.route = null; r.target = null; r.pause = 0; r.look = null; r.stay = null; r.until = clock; }   // (he was somewhere on his round: he goes back indoors and starts afresh, so nobody is left walking on no route)
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
  const needsStats = {eat: 0, company: 0, friend: 0};
  // a resident's journal: what they did, with the hour (the last 40 are kept)
  function note(r, text) { const j = r.journal; if (j.length && j[j.length - 1].text === text) return; j.push({h: hour, text}); if (j.length > 40) j.shift(); }
  const nameOfB = id => (building(id) || {}).name || id;
  const homes = new Set(CAST.map(c => c.home)), isPublic = id => !!id && !homes.has(id) && !id.startsWith('platform:') && !id.startsWith('lamp') && !!building(id) && building(id).door > 0;
  // arriving somewhere public: a visit to count, and a nod to whoever else is there (people who keep meeting become friends)
  function remember(r) {
    if (!isPublic(r.at)) return; bump(r.visits, r.at); note(r, 'Went to ' + nameOfB(r.at));
    for (const o of residents) if (o !== r && o.state === 'inside' && o.at === r.at && isPublic(o.at)) { const before = r.friends[o.id] || 0; bump(r.friends, o.id, .5); bump(o.friends, r.id, .5); if (before < 2 && (r.friends[o.id] || 0) >= 2) { note(r, 'Became friends with ' + o.def.name); note(o, 'Became friends with ' + r.def.name); } }
  }
  let lastDepart = -1e9;
  function stepResident(r, dt) {
    if (r.state === 'riding') return;   // on the train
    if (r.lampWait > 0) { r.lampWait -= dt; r.pause = Math.max(0, r.lampWait); if (r.lampWait <= 0) { r.look = null; lampLeg(r); } return; }
    if (r.state === 'inside') {
      const working = r.carrying || r.errands.some(e => e[2] && /^(pickup|station|deliver|respond|vend|fish)/.test(e[2]));   // a job in hand keeps you up a little late
      const asleep = !inWindow(hour, r.def.wake ?? 6.5, ((r.def.sleep ?? 20.5) + (working ? 1.5 : 0) + (festivalAt(weekday, hour) ? 2.5 : 0)) % 24);   // (everybody stays up for the Lantern Festival)
      if (asleep && (r.errands.length || r.carrying)) dropWork(r);
      if (asleep) { if (r.at === r.def.home) { r.step = 0; r.until = Math.max(r.until, clock + .5); return; } }   // at home for the night
      if (r.def.lamplighter && !asleep && startLampRound(r)) return;   // lamp-lighting time comes before everything else
      if (clock < r.until && !asleep && !(r.needs.hunger > .9 && !r.def.lamplighter && !r.onPlatform && !r.errands.length)) return;   // (after hours nobody lingers: straight home; and nobody sits starving)
      if (!asleep && (clock < lastDepart + (working ? .6 : 2.2) || (!working && residents.reduce((n, o) => n + (o.state === 'walking'), 0) >= 7))) { r.until = clock + 1.2 + rnd() * 1.5; return; }   // people come out one by one, never all at once (but a job in hand is not held back by the crowd)
      const round = roundOf(r); let [target] = asleep ? [r.def.home] : round[r.step];   // after hours everybody heads home
      r.stay = null; r.act = null;
      if (!asleep && !r.errands.length && !r.def.lamplighter && clock >= r.needs.tryAt) {   // a need that has become urgent sends them out: a bite to eat, a chat
        const w = needsWant(r.needs); r.needs.tryAt = clock + 25;
        const pal = w === 'company' ? friendSpot(r.friends, residents.map(o => ({id: o.id, at: o.at, inside: o.state === 'inside', asleep: !inWindow(hour, o.def.wake ?? 6.5, (o.def.sleep ?? 20.5) - .5)})), isPublic, r.at) : null;
        if (pal) { r.errands.push([pal.place, 16, null]); needsStats.company++; needsStats.friend++; }
        else if (w) { const spots = w === 'eat' ? ['bakery', 'cafe'] : ['cafe']; if (market.open) spots.push('market'); let best = null, bl = Infinity; for (const id of spots) { const wk = graph.walk(r.at, id); const len = id === r.at ? 0 : wk ? wk.length : Infinity; if (len < bl) { bl = len; best = id; } } if (best) { r.errands.push([best, w === 'eat' ? 9 : 16, null]); needsStats[w]++; } }
      }
      while (!asleep && r.errands.length) {   // an errand from a story or a job comes first: [place, seconds to stay, what to do there]
        const [place, stay, act] = r.errands.shift(); if (place === r.at) { { const hb = r.needs.hunger; needsArrive(r.needs, r.at, r.def.home); if (hb > .5 && r.needs.hunger < hb * .5) note(r, 'Had something to eat at ' + nameOfB(r.at)); } remember(r); if (act) doAct(r, act); r.until = Math.max(r.until, clock + stay); return; }
        target = place; r.stay = stay; r.act = act || null; break;
      }

      if (target === r.at && !asleep && r.stay === null) { r.step = (r.step + 1) % round.length; [target] = round[r.step]; if (target === r.at) { r.until = clock + 5; return; } }
      if (r.stay === null && !asleep && round[r.step][0] === target) r.act = round[r.step][2] || null;   // a round entry can carry an action too (a ride)
      const route = graph.walk(r.at, target); if (!route) { r.until = clock + 5; return; }
      r.route = route; r.s = 0; r.target = target; r.state = 'walking'; r.outings++; r.ox = r.oz = 0; r.pause = 0; r.look = null; r.blocked = 0; lastDepart = clock; r.onPlatform = false; r.rideTo = null; r.hurry = !!(r.carrying || (r.act && /^(pickup|station|deliver|respond|vend)/.test(r.act)));   // somebody with a delivery in hand hurries
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
        else if (dot < -.5 && f > 0 && f < .5 && lat < .3 && clock > r.greetAt && clock > o.greetAt && !o.pause) { needsMeet(r.needs); needsMeet(o.needs); bump(r.friends, o.id); bump(o.friends, r.id); r.pause = o.pause = .9 + rnd() * .5; r.greetAt = o.greetAt = clock + 45; r.look = o; o.look = r; k = 0; }   // meeting head on: a hello
      }
      if (k < .05) { r.blocked += dt; if (r.blocked > 5) k = 1; } else r.blocked = 0;   // (and never stuck for long)
      r.s = Math.min(r.route.length, r.s + r.speed * (r.lampJob ? 2.4 : r.hurry ? 1.8 : 1) * (1 + .15 * weather.rain) * k * dt);   // a quicker step in the rain
    }
    const p = along(r.route, r.s), ramp = Math.min(1, r.s / .45, (r.route.length - r.s) / .45), [lx, lz] = leftOf(p.tx, p.tz), e = Math.min(1, dt * 4);
    r.ox += (lx * .1 * ramp - r.ox) * e; r.oz += (lz * .1 * ramp - r.oz) * e;   // a hand's width to the left of the pavement's middle, nothing at the doors
    r.x = p.x + r.ox; r.z = p.z + r.oz; r.tx = p.tx; r.tz = p.tz;
    if (r.s >= r.route.length) {   // on the doorstep: in they go
      r.x = p.x; r.z = p.z;
      if (r.target && r.target.startsWith('lamp')) { tendLamp(r); return; }
      const round = roundOf(r), stay = r.stay ?? round[r.step][1], act = r.act; r.act = null;
      r.state = 'inside'; r.at = r.target; r.target = null; r.route = null; r.until = clock + stay * (.8 + rnd() * .4); if (r.stay === null && r.at === round[r.step][0]) r.step = (r.step + 1) % round.length; r.stay = null;
      r.onPlatform = r.at.startsWith('platform:') || r.at === 'market' || r.at === 'pier'; if (r.at === 'market') { market.visits++; if (market.open && fishing.stock > 0 && !VENDORS.includes(r.id)) { fishing.stock--; fishing.sold++; fishing.coins += FISH.price; } } { const hb0 = r.needs.hunger; needsArrive(r.needs, r.at, r.def.home); if ((r.at === 'bakery' || r.at === 'cafe') && hb0 > .35) { const m = eatAt(eco, r.at); if (m.swap) { r.needs.hunger = Math.max(r.needs.hunger, hb0 * .45); note(r, r.at === 'bakery' ? 'The bakery had no ' + m.lacks + ' today: just a plain roll' : 'The café had no ' + m.lacks + ' for the cocoa today'); } else if (hb0 > .5) note(r, r.at === 'bakery' ? 'Had a fresh bake from the farm eggs at the bakery' : 'Had a treat at the café'); } } remember(r); if (act) doAct(r, act);
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
      case 'call': if (v.callTarget) { id = v.callTarget; v.callTarget = null; return {...spotOf(id), id, dwell: 40}; } do id = pick(houses); while (id === v.lastId); return {...spotOf(id), id, dwell: 12};
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
      if (f > 0 && f < 2.8 && lat < .34 && dot > -.2) { const gap = .62 + (o.def.kind === 'horsecart' || def.kind === 'horsecart' ? .6 : 0); want = Math.min(want, Math.max(0, (f - gap) / 1.2) * def.speed); }
    }
    for (const r of residents) if (r.state === 'walking') {   // somebody in the road just ahead: wait for them
      const dx = r.x - v.x, dz = r.z - v.z, f = dx * v.tx + dz * v.tz, side = Math.abs(dx * v.tz - dz * v.tx);
      if (f > .1 && f < .95 && side < .3) want = 0;
    }
    // a junction ahead: take its lock before going in (and only if there is room beyond it), else stop short
    const b = v.route.bounds;
    if (v.held && v.s > v.held.s0 + JUNCTION) { if (holders.get(v.held.node) === v) holders.delete(v.held.node); v.held = null; }
    if (v.held) for (let i = 1; i < b.length; i++) if (v.s < b[i].s0 + JUNCTION) {   // (a short street: the next junction is already close, so let go of the last one and take the next)
      if (graph.lane(b[i - 1].lane).to !== v.held.node && v.s > b[i].s0 - JUNCTION - .7) { if (holders.get(v.held.node) === v) holders.delete(v.held.node); v.held = null; } break;
    }
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

  // ---- Freight and passengers. Things that need moving are 'cargo': picked up by a resident (who walks it to a platform and sets it down), carried by the train to the
  // station nearest where it is going, and taken on from there by another resident. Residents also ride the train between stations on outings (errands with 'ride:<station>').
  const cargo = [], freightLog = [], stats = {made: 0, delivered: 0, cancelled: 0, parcels: 0};
  let cargoN = 0, freightAt = 25, tplIdx = 0, busy = 1; const stationCache = {};
  const stationOf = id => stationCache[id] || (stationCache[id] = STATIONS.map(st => ({id: st.id, d: graph.walk(id, 'platform:' + st.id).length})).sort((a, b) => a.d - b.d)[0].id);
  const idleFor = ids => { for (const id of ids || residents.map(r => r.id)) { const r = resident(id); if (r && r.state === 'inside' && !r.onPlatform && !r.def.lamplighter && !r.carrying && inWindow(hour, r.def.wake ?? 6.5, (r.def.sleep ?? 20.5) - .5) && r.errands.length === 0) return r; } return null; };
  // the idle resident closest (by walking) to a place
  const idleNear = spot => { let best = null, bd = 1e9; for (const r of residents) { if (!idleFor([r.id])) continue; const w = graph.walk(r.at, spot); if (w && w.length < bd) { bd = w.length; best = r; } } return best; };
  function finish(c, how) { const k = cargo.indexOf(c); if (k >= 0) cargo.splice(k, 1); freightLog.unshift({id: c.id, kind: c.kind, label: c.label, from: c.from, to: c.to, how, at: clock}); if (freightLog.length > 12) freightLog.pop(); }
  function doAct(r, act) {
    const [kind, arg] = act.split(':'), here = r.at.replace('platform:', '');
    if (kind === 'ride') { r.rideFrom = here; r.rideTo = arg; r.until = clock + 160; return; }   // wait on the platform for the train (and give up after a while)
    if (kind === 'respond') { note(r, 'Helped with the ' + (incident ? ({fire: 'fire', lostchild: 'search', storm: 'storm clear-up'})[incident.type] : 'emergency')); if (incident && incident.debris) { const k = incident.debris.indexOf(here); if (k >= 0) incident.debris.splice(k, 1); } return; }
    const c = cargo.find(x => x.id === +arg); if (!c) return;
    if (kind === 'pickup' && (c.state === 'ready' || c.state === 'station')) { c.state = 'carried'; c.holder = r.id; c.at = null; r.carrying = c.id; }
    else if (kind === 'station' && c.holder === r.id) { c.state = 'station'; c.at = here; c.holder = null; r.carrying = null; c.since = clock; if (train.at === here && train.wait > .8) loadCargo(here); }
    else if (kind === 'deliver' && c.holder === r.id) { r.carrying = null; stats.delivered++; note(r, 'Delivered ' + c.label + ' to ' + nameOfB(c.to)); if (c.kind === 'fish') { fishing.sold += c.qty || 1; fishing.coins += (c.qty || 1) * FISH.price; } finish(c, 'delivered'); }
  }
  // somebody going to bed with work in their hands: the job is called off
  function dropWork(r) {
    r.errands = []; r.rideTo = null;
    for (const c of cargo.slice()) { if (c.holder === r.id) { stats.cancelled++; finish(c, 'called off'); } else if (c.dropper === r.id && c.state === 'station') { c.dispatched = false; c.dropper = null; } }   // (somebody else will collect it)
    r.carrying = null;
  }
  function newCargo(kind, label, from, to, picker, drop) {
    const direct = stationOf(from) === stationOf(to) || graph.walk(from, to).length < 12,   // (next door: just walk it over)
       c = {id: ++cargoN, kind, label, from, to, originStation: stationOf(from), destStation: stationOf(to), state: 'ready', holder: picker.id, at: null, drop, born: clock, direct, dispatched: false};
    cargo.push(c); stats.made++;
    picker.errands = direct ? [[from, 2, 'pickup:' + c.id], [to, 4, 'deliver:' + c.id]] : [[from, 2, 'pickup:' + c.id], ['platform:' + c.originStation, 2, 'station:' + c.id]];
    picker.until = Math.min(picker.until, clock + .5); return c;
  }
  function spawnCargo() {
    for (let tries = 0; tries < FREIGHT.length; tries++) {
      const t = FREIGHT[tplIdx++ % FREIGHT.length]; if (!inWindow(hour, t.hours[0], t.hours[1]) || (t.fish && fishing.stock < 1)) continue;
      const from = pick(t.from), to = pick(t.to.filter(x => x !== from && stationOf(x) !== stationOf(from))); if (!to) continue;
      const near = idleNear(from), usual = idleFor(t.pick), picker = usual && near && graph.walk(usual.at, from).length <= graph.walk(near.at, from).length + 8 ? usual : near; if (!picker) continue;   // the usual person if free and not much further away, else whoever is nearest
      const qty = t.fish ? Math.min(FISH.perBasket, fishing.stock) : 0; if (qty) fishing.stock -= qty; const c = newCargo(t.kind, qty ? (qty === 1 ? 'a fresh fish' : qty + ' fresh fish') : t.label, from, to, picker, t.drop); if (qty) c.qty = qty; return;
    }
  }
  // A parcel sent by the owner: from one building to another, by whoever is free (the train if the two are served by different stations).
  function sendParcel(from, to) {
    if (!building(from) || !building(to) || !building(from).door || !building(to).door || from === to) return {ok: false, reason: 'Pick two different buildings with doors.'};
    if (cargo.length >= 14) return {ok: false, reason: 'Too many jobs on already: wait for a few to finish.'};
    const home = residents.filter(r => r.def.home === from).map(r => r.id), others = residents.map(r => ({id: r.id, d: graph.walk(r.at, from) ? graph.walk(r.at, from).length : 1e9})).sort((a, b) => a.d - b.d).map(r => r.id);
    const picker = idleFor([...home, ...others]); if (!picker) return {ok: false, reason: 'Nobody is free to carry it right now (it is night, or everyone is busy). Try again in a moment.'};
    const c = newCargo('parcel', 'a parcel', from, to, picker, null); stats.parcels++; qnote('parcel'); return {ok: true, cargo: c, carrier: picker.def.name};
  }
  function stepFreight() {
    if (clock >= freightAt) { freightAt = clock + (12 + rnd() * 14) / busy; if (cargo.length < (busy > 1 ? 12 : 9)) spawnCargo(); }
    for (const c of cargo) if (c.state === 'station' && c.at === c.destStation && !c.dispatched && !c.direct && hour > 5 && hour < 19.2) {   // arrived: somebody collects it
      const d = idleNear('platform:' + c.destStation); if (!d) continue;
      c.dispatched = true; c.dropper = d.id; d.errands = [['platform:' + c.destStation, 1.5, 'pickup:' + c.id], [c.to, 4, 'deliver:' + c.id]]; d.until = Math.min(d.until, clock + .5);
    }
    for (const c of cargo.slice()) if (clock - c.born > 900) { stats.cancelled++; const h = c.holder && resident(c.holder); if (h) h.carrying = null; finish(c, 'lost'); }
  }
  // the train has stopped at a station: people get off, cargo comes off, new cargo and people get on
  function trainStop(id) {
    for (const r of riders.slice()) if (r.rideTo === id) {
      riders.splice(riders.indexOf(r), 1); const d = graph.doors['platform:' + id];
      r.state = 'inside'; r.at = 'platform:' + id; r.x = d.x; r.z = d.z; r.onPlatform = true; r.rideTo = null; r.until = clock + .8; train.ridden++; note(r, 'Arrived by train at ' + ((STATIONS.find(x => x.id === id) || {}).name || id));
    }
    for (const c of cargo) if (c.state === 'train' && c.destStation === id) { c.state = 'station'; c.at = id; c.since = clock; }
    loadCargo(id); boardAt(id);
  }
  // goods waiting at a station go into the wagon (also when they are put down while the train is standing there)
  function loadCargo(id) {
    let wagon = cargo.filter(c => c.state === 'train').length;
    for (const c of cargo) if (c.state === 'station' && c.at === id && c.destStation !== id && wagon < train.wagon) { c.state = 'train'; c.at = null; wagon++; }
  }
  // anybody waiting on that platform steps aboard (also when they arrive while the train is standing there)
  function boardAt(id) { for (const r of residents) if (r.state === 'inside' && r.onPlatform && r.rideTo && r.at === 'platform:' + id && r.rideTo !== id && riders.length < train.seats) { r.state = 'riding'; r.onPlatform = false; riders.push(r); } }

  // Fishing: whoever stands at the end of the pier catches a fish every so often (fewer in rain); the fish wait at the hut until somebody carries a basket to town, and the town pays for them.
  const eco = newEco(); let ecoCatches = 0; { const sw = {spring: .55, summer: .7, autumn: .55, winter: .25}[season]; if (sw) { eco.meadow = sw; eco.flowers = sw * ({spring: .9, summer: 1, autumn: .4, winter: 0}[season] ?? 1); } }   // (the land starts the way the season finds it)
  const fishing = {stock: 0, caught: 0, sold: 0, coins: 0, player: 0, golden: 0, bonus: 0};   // (player: caught by the visitor in the fishing game; bonus: coins from golden fish, kept apart from the sales)
  // Fishing is a job, not a chance: Finn goes out to the end of the pier in the morning and Captain Salt in the afternoon (not in heavy rain or an emergency), so by day somebody is always fishing.
  const SHIFTS = [['finn', 7, 14], ['salt', 11, 17.5]];
  // The visitor's catch from the fishing game goes to the harbour stall like anybody's; a golden fish is worth a bonus.
  function angle(kind) { if (kind !== 'fish' && kind !== 'golden') return false; qnote('fish'); fishing.stock++; fishing.caught++; ecoCatches++; eco.today.caught++; fishing.player++; if (kind === 'golden') { fishing.golden++; fishing.bonus += GOLDEN_COINS; sagaLog.push({day: dayIdx, type: 'fish', text: 'A golden fish was caught off the pier'}); } return true; }
  // The sea log: what the visitor has seen from the boat. Each event (a leap, a spout, a landing) counts once; the first landing of a day brings a gem worth ten coins.
  const sea = {trips: 0, dolphins: 0, whales: 0, islet: 0, dwarfs: 0, bonus: 0, keys: new Set(), landedDays: new Set()};
  function sailEvent(ev) {
    if (sea.keys.has(ev.key)) return null; sea.keys.add(ev.key); let text = null;
    if (ev.kind === 'dolphin') { sea.dolphins++; text = 'A dolphin leaps right beside the boat!'; }
    else if (ev.kind === 'whale') { sea.whales++; text = 'The whale blows a great spout of water!'; }
    else if (ev.kind === 'islet') { sea.islet++; if (hunt.active) { const hr = huntTap('islet'); if (hr.ok && hr.kind === 'done') ev.hunt = hr; } if (ev.met) { sea.dwarfs++; text = 'You land on Dwarf Rock, and the dwarfs look up from their lanterns!'; } else text = 'You land on Dwarf Rock. It is quiet; the dwarfs come out at dusk.'; if (!sea.landedDays.has(dayIdx)) { sea.landedDays.add(dayIdx); sea.bonus += 10; text += ' You find a gem worth 10 coins.'; sagaLog.push({day: dayIdx, type: 'sea', text: 'The visitor sailed to Dwarf Rock and found a gem'}); } }
    return text && ev.hunt ? text + ' The treasure map is complete: ' + ev.hunt.reward + ' coins for the chest!' : text;
  }
  // The town chest: every coin the town earns this visit (fish sold, golden fish, the dwarfs' gems, gems from the sea) plus what earlier visits left; what is bought is kept.
  const chest = cleanChest(opts.saga && opts.saga.chest), chestBase = chest.earned;
  // the daily wishes, the sticker album and the seasons the visitor has seen
  const wishSeed = opts.wishSeed ?? 0, know = residents.map(r => r.id), sv0 = opts.saga || {}, seasonsSeen = new Set(sv0.seasons || []);
  const quest = {day: wishSeed, list: makeWishes(wishSeed, know), counters: newCounters(), done: [], coins: 0, total: sv0.wishesTotal || 0};
  if (sv0.quest && sv0.quest.day === wishSeed) { quest.counters = {...newCounters(), ...sv0.quest.counters}; quest.done = sv0.quest.done.slice(); }
  const album = albumClean(sv0.album); let albumAt = 0, festSeen = 0;
  const qnote = (kind, id) => { if (kind === 'season') { seasonsSeen.add(id); return; } noteCounter(quest.counters, kind, id); };
  const wishState = () => quest.list.map(w => ({...w, have: wishHave(w, quest.counters), done: quest.done.includes(w.id)}));
  function stepQuests() {
    for (const w of quest.list) if (!quest.done.includes(w.id) && wishDone(w, quest.counters)) { quest.done.push(w.id); quest.coins += w.reward; quest.total++; const nm = (residents.find(r => r.id === w.who) || {def: {name: 'A neighbour'}}).def.name; sagaLog.push({day: dayIdx, type: 'wish', text: nm + ' thanks you: ' + w.text}); announce(nm + ' thanks you! +' + w.reward + ' coins in the chest'); }
  }
  const albumSnapshot = () => ({sea, wild, fishing, hunt, chest, eco: {flowers: eco.flowers, honeyDays: chronicle.some(r => r.honey >= 1.2) || eco.today.honey >= 1.2 ? 1 : 0}, festival: festSeen, marriages: residents.filter(r => r.spouse).length, babies: babies.length, mystery: mystery.solved, votes: Object.keys(effects).length, wishes: quest.total, friends: snap().friends || 0, seasons: seasonsSeen.size});
  function stepAlbum() { if (clock < albumAt) return; albumAt = clock + 2; if (festivalAt(weekday, hour) && !festSeen) festSeen = 1; for (const st of albumScan(album, albumSnapshot())) { album.push(st.id); sagaLog.push({day: dayIdx, type: 'sticker', text: 'New sticker: ' + st.name}); announce('New sticker: ' + st.name + '!'); } }
  const hunt = newHunt();
  const chestState = () => ({earned: chestBase + fishing.coins + fishing.bonus + wild.gemCoins + sea.bonus + hunt.coins + quest.coins, spent: chest.spent, bought: chest.bought});
  function care(kind) { const r = ecoCare(eco, kind); if (r.ok) { if (kind === 'flowers') qnote('plant'); else if (kind === 'hens') qnote('feed'); else if (kind === 'rest' && eco.rest) qnote('rest'); sagaLog.push({day: dayIdx, type: 'care', text: r.text}); announce(r.text + '!'); } return r; }
  function buy(id) {
    const st = chestState(), c = canBuy(st, id); if (!c.ok) return c; const u = upgradeOf(id); chest.spent += u.cost; chest.bought.push(id);
    sagaLog.push({day: dayIdx, type: 'chest', text: 'The town bought ' + u.name.toLowerCase()}); announce('The town bought ' + u.name.toLowerCase() + '!');
    let n = 0; for (const r of residents) if (r.state === 'inside' && n < 3) { note(r, 'Went to see ' + u.name.toLowerCase()); n++; }
    return {ok: true, upgrade: u};
  }
  // The dwarfs' treasure map: start it, tap the buildings the riddles name, and sail to Dwarf Rock for the last one.
  function huntBegin() { if (!huntStart(hunt)) return false; sagaLog.push({day: dayIdx, type: 'hunt', text: 'The dwarfs gave out ' + mapOf(hunt.map).name.toLowerCase()}); return true; }
  function huntTap(where) {
    const r = huntAnswer(hunt, where); if (r.kind === 'done') { sagaLog.push({day: dayIdx, type: 'hunt', text: 'The treasure map was solved: ' + r.reward + ' coins for the chest'}); announce('The dwarfs\' treasure! ' + r.reward + ' coins for the town chest.'); }
    return r;
  }
  // The land: the stocks move with the weather; the horse cart and the pick-up hand the farm's eggs and milk and the hive's honey to the bakery, the café and the market.
  function stepEcology(dt) {
    stepEco(eco, dt, {season: season || 'summer', rain: weather.rain, cats: 4, catches: ecoCatches, hive: chest.bought.includes('beehive')}); ecoCatches = 0;
    for (const v of vehicles) if ((v.def.kind === 'horsecart' || v.def.kind === 'pickup') && v.wait > 0 && v.target && v.target.id) { const key = v.target.id + ':' + v.stopsMade; if (v.lastDeliv !== key) { v.lastDeliv = key; const r = deliver(eco, v.target.id); if (r && (r.eggs + r.milk + r.honey) > .5) ecoLog.push({day: dayIdx, kind: 'delivery', place: v.target.id, ...r, by: v.def.id}); } }
  }
  const ecoLog = [];
  function stepFishers() {
    for (const [id, from, to] of SHIFTS) {
      const r = resident(id); if (!r) continue; const on = hour >= from && hour < to && weather.rain < .6 && !incident && eco.sea > .3 && !eco.rest;
      if (r.state === 'inside' && r.at === 'pier' && !on && r.errands.length === 0) r.until = Math.min(r.until, clock + .5);   // the shift is over: home to the hut
      if (on && r.state === 'inside' && r.at !== 'pier' && !r.onPlatform && !r.carrying && !r.lampJob && r.errands.length === 0 && r.target === null) { r.errands.unshift(['pier', Math.max(30, Math.min(110, (to - hour) * 20)), 'fish']); r.until = Math.min(r.until, clock + .5); }
    }
  }
  function stepFishing(dt) {
    for (const r of residents) if (r.state === 'inside' && r.at === 'pier') { r.fishAcc = (r.fishAcc || 0) + dt; if (r.fishAcc >= FISH.every) { r.fishAcc = 0; if (rnd() < .85 - weather.rain * .4) { fishing.stock++; fishing.caught++; ecoCatches++; eco.today.caught++; r.caught = (r.caught || 0) + 1; note(r, 'Caught a fish'); } } }
  }
  // Market day: every third day the stalls are open from 9 to 15, and people drop by (standing at the stalls) all through it.
  const market = {open: false, visits: 0, opens: 0, next: 0};
  const shoppersNow = () => residents.filter(r => !VENDORS.includes(r.id) && (r.at === 'market' || r.target === 'market')).length;
  function stepMarket() {
    const d = Math.floor(clock / DAY); if (d !== dayIdx) { if (d > dayIdx) { closeDay(dayIdx); days[d] = snap(); } dayIdx = d; stepSaga(d); weekday = (startDay + d) % 7; for (const r of residents) r.step = 0; }
    const base = MARKET.days[weekday], cfg = base && {...base, to: base.to + (effects.market === 'longer' ? 2 : 0)}, want = !!cfg && hour >= cfg.from && hour < cfg.to; market.cfg = cfg || null;
    if (want && !market.open) { market.open = true; market.opens++; market.next = clock + 4; for (const id of VENDORS) { const v = resident(id); if (v && v.state !== 'riding' && !v.onPlatform && !v.carrying) { v.errands.unshift(['market', Math.max(10, (cfg.to - hour) * 20), 'vend']); v.until = Math.min(v.until, clock + .5 + VENDORS.indexOf(id)); } }
      if (!story.current) story.current = {id: 'marketday', title: cfg.name + ': the stalls are open until ' + cfg.to + ':00', headline: null, start: clock, end: clock + 30}; }
    else if (!want && market.open) { market.open = false; for (const r of residents) if (r.at === 'market' && r.state === 'inside') r.until = Math.min(r.until, clock + 1 + rnd() * 3); }
    if (market.open && clock >= market.next) {
      market.next = clock + cfg.gap[0] + rnd() * (cfg.gap[1] - cfg.gap[0]);
      if (shoppersNow() < cfg.cap) { const r = idleNear('market'); if (r) { r.errands = [['market', 12 + rnd() * 16]]; r.until = Math.min(r.until, clock + .5); } }
    }
  }
  // Emergencies: one at a time, about one a day, by daylight: a fire (the engine goes, the fire chief, the mechanic, the constable and the nurse hurry there and some neighbours watch), a lost child (the constable and three helpers search the town), a storm (rain, a rising sea, branches down at some doorsteps that a crew clears).
  let incident = null, nextEventAt = 120 + (opts.eventGap ?? 0), eventsOn = opts.events !== false, lastEvent = null; const incidentLog = [];
  const nameFor = id => (building(id) || {}).name || id;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const announce = text => { story.current = {id: 'incident', title: text, headline: null, start: clock, end: clock + 28}; };
  const send = (id, errands) => { const r = resident(id); if (!r || r.state === 'riding' || r.def.lamplighter && false) return false; r.errands = errands.map(e => [...e]); r.until = Math.min(r.until, clock + .3); return true; };
  function startIncident(type) {
    const E = EVENTS[type]; incident = {type, start: clock, until: clock + E.dur}; lastEvent = type;
    if (type === 'fire') {
      const t = E.targets[Math.floor(rnd() * E.targets.length)]; incident.target = t; const f = vehicles.find(v => v.id === 'fire'); if (f) { f.callTarget = t; f.call = 1; }
      for (const id of E.responders) send(id, [[t, 45, 'respond']]); send(E.police, [[t, 40, 'respond']]); send(E.nurse, [[t, 40, 'respond']]);
      let w = 0; for (const o of residents) { if (w >= E.watchers) break; if (idleFor([o.id]) && !o.def.lamplighter && !E.responders.includes(o.id) && o.id !== E.police && o.id !== E.nurse && o.at !== t) { send(o.id, [[t, 25]]); w++; } }
      announce(E.start(nameFor(t)));
    } else if (type === 'lostchild') {
      const c = E.children.map(resident).find(r => r && idleFor([r.id])) || resident(E.children[0]); const places = shuffle(E.places.filter(p => p !== c.at)), hide = places[Math.min(places.length - 1, Math.floor(rnd() * 6))];
      incident.child = c.id; incident.hide = hide; send(c.id, [[hide, 400]]);
      const order = places.filter(p => p !== hide); order.splice(Math.floor(rnd() * 6), 0, hide); const helpers = [E.searcher, ...residents.filter(o => o.id !== c.id && o.id !== E.searcher && !o.def.lamplighter && idleFor([o.id])).slice(0, E.helpers).map(o => o.id)];
      incident.helpers = helpers; helpers.forEach((id, i) => send(id, order.slice(i * 2, i * 2 + 2).map(p => [p, 16, 'respond'])));
      announce(E.start(c.def.name.split(' ')[0]));
    } else {
      incident.debris = shuffle(E.debris).slice(0, 4); weather.force('rain', E.rain); incident.flood = true;
      const crew = E.crew.filter(id => idleFor([id])); (crew.length ? crew : E.crew).forEach((id, i) => send(id, incident.debris.filter((_, k) => k % Math.max(1, crew.length || 1) === i % Math.max(1, crew.length || 1)).map(p => [p, 14, 'respond'])));
      announce(E.start());
    }
    incidentLog.push({type, at: clock, day: dayIdx, title: type === 'fire' ? 'Fire at ' + nameFor(incident.target) : type === 'lostchild' ? resident(incident.child).def.name.split(' ')[0] + ' went missing' : 'A storm'});
  }
  function endIncident() {
    const E = EVENTS[incident.type]; let text;
    if (incident.type === 'fire') { text = E.end(nameFor(incident.target)); const f = vehicles.find(v => v.id === 'fire'); if (f) f.call = 0; }
    else if (incident.type === 'lostchild') { const c = resident(incident.child), r = c; c.errands = []; c.until = Math.min(c.until, clock + .5); text = E.end(c.def.name.split(' ')[0], nameFor(incident.hide)); r.needs.lonely = 0; note(c, 'Was found safe at ' + nameFor(incident.hide)); }
    else text = E.end();
    announce(text); incident = null; nextEventAt = clock + nextEventIn(rnd);
  }
  function stepIncidents() {
    if (!incident) { if (eventsOn && clock >= nextEventAt && !story.pending) { const t = pickEvent(rnd, hour, weather.rain, lastEvent); if (t) startIncident(t); else nextEventAt = clock + 30; } return; }
    if (incident.type === 'lostchild') { const c = resident(incident.child), found = c.state === 'inside' && c.at === incident.hide && incident.helpers.some(id => { const o = resident(id); return o.state === 'inside' && o.at === incident.hide; }); if (found || clock >= incident.until) endIncident(); return; }
    if (incident.type === 'storm' && incident.debris.length === 0 && clock > incident.start + 60) return endIncident();
    if (clock >= incident.until) endIncident();
  }
  // Elections: from 10:00 to 18:00 on every third day the town votes; you can cast one vote (worth three). The winner stays: `effects` says what the town has chosen.
  const effects = {...(opts.saga && opts.saga.effects || {})}, asked = Object.keys(effects); const election = {open: false, q: null, you: null, last: null};
  function stepVote() {
    const q = questionFor(dayIdx, asked);
    if (!election.open && q && hour >= OPENS && hour < CLOSES && !election.done?.[dayIdx]) { election.open = true; election.q = q; election.you = null; announce('The town is voting: ' + q.text); }
    else if (election.open && (hour >= CLOSES || !q || q.id !== election.q.id)) {
      const t = tally(election.q, residents.map(r => ({id: r.id, mood: r.mood.score})), election.you); effects[election.q.id] = t.winner; asked.push(election.q.id);
      election.last = {q: election.q, winner: t.winner, counts: t.counts, day: dayIdx}; sagaLog.push({day: dayIdx, type: 'vote', text: 'The town chose: ' + labelOf(election.q, t.winner) + ' (' + Object.values(t.counts).join(' to ') + ')'}); announce('The town has chosen: ' + labelOf(election.q, t.winner));
      (election.done ||= {})[dayIdx] = true; election.open = false;
    }
  }
  // Mysteries: after the first day, at midday, something goes missing; the thief goes to the place and on to a hideout, clues come out over two minutes, and you can accuse somebody.
  const mystery = {active: null, solved: 0, failed: 0, nextAt: opts.mysteryAt ?? DAY + 6 * 20};
  // The dwarfs of Dwarf Rock come out on some evenings; whoever is at the harbour then looks out to sea and sees their lanterns (once an evening).
  let festStaged = -1; const GEM_COINS = 10, wild = {sightings: 0, seen: new Set(), out: null, log: [], gems: 0, gemsFound: 0, gemCoins: 0, wasOut: null};   // (after an evening the lanterns were seen, the dwarfs leave a gem on the harbour beach; the next person at the harbour finds it)
  function stepWild() {
    if (festivalAt(weekday, hour) && festStaged !== dayIdx && !story.current && !story.pending) { festStaged = dayIdx; stage('lanternfest', null); }   // (the festival is always staged on Saturday evening)
    const out = wild.out = dwarfsOut(dayIdx, hour);
    if (wild.wasOut !== null && !out) { if (wild.seen.has(wild.wasOut)) { wild.gems++; sagaLog.push({day: dayIdx, type: 'dwarf', text: 'The dwarfs left a gem on the harbour beach'}); } wild.wasOut = null; }
    if (out) wild.wasOut = out.day;
    if (wild.gems > 0 && hour >= 7 && hour < 20) { const f = residents.find(r => r.state === 'inside' && r.at === 'hut'); if (f) { wild.gems--; wild.gemsFound++; wild.gemCoins += GEM_COINS; note(f, 'Found a shining gem on the beach: the dwarfs left it'); sagaLog.push({day: dayIdx, type: 'dwarf', text: f.def.name + ' found the dwarfs\' gem (worth ' + GEM_COINS + ' coins)'}); } }
    if (!out || wild.seen.has(out.day)) return;
    const who = residents.find(r => (r.state === 'inside' && (r.at === 'pier' || r.at === 'hut')) || (r.state === 'walking' && r.x > PIER.x0 - 2 && Math.abs(r.z - PIER.z) < 2.5));
    if (!who) return;
    wild.seen.add(out.day); wild.sightings++; note(who, 'Saw lantern lights out on Dwarf Rock'); wild.log.push({day: dayIdx, who: who.id});
    sagaLog.push({day: dayIdx, type: 'dwarf', text: who.def.name + ' saw lanterns on Dwarf Rock'});
  }
  function stepMystery() {
    const m = mystery.active;
    if (!m || m.over) { if (opts.mysteries !== false && clock >= mystery.nextAt && hour >= 12 && hour < 16 && !incident) startMystery(); return; }   // (a finished case stays on the case book until the next one starts)
    if (clock - m.start > DAY * 1.1) { m.over = true; m.result = 'cold'; mystery.failed++; m.feedback = 'The trail went cold: ' + resident(m.culprit).def.name + ' got away with ' + m.c.item + '.'; sagaLog.push({day: dayIdx, type: 'case', text: 'Mystery unsolved: the trail went cold'}); mystery.nextAt = clock + GAP; return; }
    while (m.released < m.clues.length && clock - m.start >= m.clues[m.released].at) { const c = m.clues[m.released++]; m.shown.push({at: clock, text: c.text.includes('{other}') ? c.text : c.text}); }
  }
  function startMystery() {
    const c = pickCase(0, rnd), place = nameFor(c.place), culprit = residents.filter(r => !r.def.lamplighter && r.age >= 12 && r.state !== 'riding' && r.at !== c.place).sort((a, b) => rnd() - .5)[0]; if (!culprit) return;
    const hide = pickHideout(c.place, rnd); culprit.errands = [[c.place, 10], [hide, 70]]; culprit.until = Math.min(culprit.until, clock + .3);
    const others = residents.filter(r => r !== culprit && r.journal.some(e => e.text === 'Went to ' + place && Math.abs(e.h - hour) < 3)).map(r => ({name: r.def.name, time: clockText(r.journal.filter(e => e.text === 'Went to ' + place).pop().h)}));
    mystery.active = {c, place: c.place, hideout: hide, culprit: culprit.id, start: clock, clues: cluesFor({coat: culprit.def.coat, hat: culprit.def.hat}, place, nameFor(hide), others), released: 0, shown: [], wrong: [], feedback: '', over: false, result: null};
    announce('Mystery! ' + c.title);
  }
  function accuse(id) {
    const m = mystery.active; if (!m || m.over || m.wrong.includes(id) || !residents.some(r => r.id === id)) return null; const who = resident(id), culprit = resident(m.culprit);
    if (id === m.culprit) { m.over = true; m.result = 'solved'; mystery.solved++; m.feedback = who.def.name + ' did it! Case closed.'; announce('Case closed! ' + who.def.name + ' took ' + m.c.item); sagaLog.push({day: dayIdx, type: 'case', text: 'Mystery solved: ' + who.def.name + ' took ' + m.c.item}); mystery.nextAt = clock + GAP; return 'solved'; }
    m.wrong.push(id); const last = who.journal.length ? who.journal[who.journal.length - 1] : null; m.feedback = who.def.name + ' has an alibi' + (last ? ': at ' + clockText(last.h) + ' they were busy (' + last.text.toLowerCase() + ').' : '.');
    if (m.wrong.length >= MAX_WRONG) { m.over = true; m.result = 'failed'; mystery.failed++; m.feedback += ' It was ' + culprit.def.name + ' all along!'; sagaLog.push({day: dayIdx, type: 'case', text: 'Mystery unsolved: ' + culprit.def.name + ' got away with ' + m.c.item}); mystery.nextAt = clock + GAP; return 'failed'; } return 'wrong';
  }
  // The long story: birthdays on their day of the "year", weddings between close friends (held at the café), babies for married couples.
  let weddingPlan = null, lastWedding = -9;
  const first = r => r.def.name.replace(/^(Mr|Mrs|Miss|Dr|Granny|Auntie|Captain|Constable|Chief|Nurse|Postie|Farmer)\s+/, '').split(' ')[0];
  function stepSaga(d) {
    for (const r of residents) if (d > 0 && birthdayOf(r.id) === d % YEAR_DAYS) { r.age++; note(r, 'Had a birthday: now ' + r.age); sagaLog.push({day: d, type: 'birthday', text: first(r) + ' turns ' + r.age}); }
    for (const r of residents) if (r.spouse && r.id < r.spouse) { const o = residents.find(x => x.id === r.spouse); if (canHaveBaby(r.kids, babies.length, d - r.marriedDay) && rnd() < .6) { const name = BABY_NAMES[babies.length % BABY_NAMES.length]; babies.push({name, parents: [r.id, o.id]}); r.kids++; o.kids++; note(r, 'Welcomed baby ' + name); note(o, 'Welcomed baby ' + name); sagaLog.push({day: d, type: 'baby', text: 'Baby ' + name + ' was born to ' + first(r) + ' and ' + first(o)}); } }
    if (!weddingPlan && d >= 2 && d - lastWedding >= 3) { const c = pickCouple(residents.map(r => ({id: r.id, age: r.age, spouse: r.spouse, friends: r.friends, lamplighter: !!r.def.lamplighter})), 3); if (c) weddingPlan = {a: c.a, b: c.b, day: d}; }
  }
  function stepWedding() {
    if (!weddingPlan || hour < 11 || hour > 15 || incident) return; const a = resident(weddingPlan.a), b = resident(weddingPlan.b); if (!a || !b || a.spouse || b.spouse || a.state === 'riding' || b.state === 'riding') { weddingPlan = null; return; }
    a.spouse = b.id; b.spouse = a.id; a.marriedDay = b.marriedDay = dayIdx; lastWedding = dayIdx; const guests = [...new Set([...Object.entries(a.friends), ...Object.entries(b.friends)].sort((x, y) => y[1] - x[1]).map(e => e[0]))].filter(id => id !== a.id && id !== b.id).slice(0, 4);
    for (const id of [a.id, b.id, ...guests]) { const r = resident(id); if (r && !r.def.lamplighter) { r.errands = [['cafe', 45]]; r.until = Math.min(r.until, clock + .4); note(r, id === a.id || id === b.id ? 'Got married to ' + first(id === a.id ? b : a) : 'Went to the wedding of ' + first(a) + ' and ' + first(b)); } }
    sagaLog.push({day: dayIdx, type: 'wedding', text: first(a) + ' and ' + first(b) + ' got married'}); announce('Wedding bells! ' + a.def.name + ' and ' + b.def.name + ' are getting married at the café'); weddingPlan = null;
  }
  // Small stories: every so often, if the cast and the hour and the weather allow, one of them sends a few residents on errands.
  const story = {current: null, last: {}, count: {}, nextAt: 20, pending: null, log: [], causes: []};
  // the chronicle: each finished day is written down (what the land did, what the town told) and gives tomorrow's story a head start
  const chronicle = chronicleClean(opts.saga && opts.saga.chronicle); let followUp = chronicle.length ? chronicleFollow(chronicle[chronicle.length - 1]) : null;
  const liveRecord = () => chronicleRecord(dayIdx, season || 'summer', eco.today, {stories: story.log.slice((days[dayIdx] || days[0] || {stories: 0}).stories || 0), peace: ecoPeace(eco, moodNow()), deliveries: ecoLog.length});
  function closeDay(d) { const rec = liveRecord(); rec.day = d; chronicle.splice(0, chronicle.length, ...chroniclePush(chronicle, rec)); followUp = chronicleFollow(rec); eco.today = newDay(); quest.day = wishSeed + d + 1; quest.list = makeWishes(quest.day, know); quest.counters = newCounters(); quest.done = []; }
  const awake = r => r.state === 'inside' && !r.onPlatform && inWindow(hour, r.def.wake ?? 6.5, (r.def.sleep ?? 20.5) - .5 + (festivalAt(weekday, hour) ? 2.5 : 0)) && r.errands.length === 0;
  const resident = id => residents.find(r => r.id === id);
  const fits = (s, forced) => (s.weekday === undefined || s.weekday === weekday) && (!s.effect || effects[s.effect[0]] === s.effect[1]) && (!s.season || !season || s.season === season) && (!s.days || (s.days === 'weekend') === (weekday >= 5)) && (forced || inWindow(hour, s.hours[0], s.hours[1])) && (s.wet === 'wet' ? weather.rain > .4 : s.wet === 'dry' ? weather.rain < .3 : true) && (forced || s.relaxed ? s.go.filter(([who]) => awake(resident(who))).length >= Math.ceil(s.go.length / 2) : s.go.every(([who]) => awake(resident(who))));   // the news will do with half the cast
  function startStory(s, headline) {
    story.current = {id: s.id, title: s.title, headline: headline || null, start: clock, end: clock + 40}; story.last[s.id] = clock; story.count[s.id] = (story.count[s.id] || 0) + 1; story.log.push(s.id);
    s.go.forEach(([who, trips], i) => { const r = resident(who); if (!(awake(r) || (s.festival && r.state !== 'riding' && !r.carrying && !r.def.lamplighter))) return; note(r, (s.star === who ? 'Their story: ' : 'Part of: ') + s.title); r.errands = trips.map(t => s.festival ? [t[0], t[1], 'fish'] : [...t]); r.until = Math.min(r.until, clock + 1 + i * 2.5); });
    if (s.fire) { const f = vehicles.find(v => v.id === 'fire'); if (f) f.call = 1; }
  }
  function stepStories() {
    if (story.current && clock > story.current.end) story.current = null;
    if (story.current || clock < story.nextAt) return;
    story.nextAt = clock + 6 + rnd() * 10;
    if (story.pending) {   // staged by the news: wait for the cast to be up and about
      const s = STORIES.find(x => x.id === story.pending.id);
      if (s && (fits(s, true) || (s.festival && festivalAt(weekday, hour)))) { startStory(s, story.pending.headline); story.pending = null; }   // (the festival goes ahead whoever is busy)
      else if (clock > story.pending.until) story.pending = null;
      return;
    }
    let ok = STORIES.filter(s => !s.news && clock - (story.last[s.id] ?? -1e9) > 180 && fits(s));
    if (weekday >= 5 && rnd() < .7) { const we = ok.filter(s => s.days === 'weekend'); if (we.length) ok = we; }   // the weekend's own stories come first
    if (followUp && !ok.some(x => x.id === followUp)) { const f = STORIES.find(x => x.id === followUp); if (f && fits(f)) ok.push(f); }
    if (ok.length) { const least = Math.min(...ok.map(x => story.count[x.id] || 0)), s = directorPick(ok, {eco, followUp, count: story.count, least}, rnd); if (s) { story.causes.push({id: s.id, day: dayIdx, needed: !!s.needs, held: s.needs ? !!s.needs(eco) : true, followed: followUp === s.id}); if (followUp === s.id) followUp = null; startStory(s); } }   // the land's own stories first, then the ones seen least
  }
  function stage(id, headline) { story.pending = {id, headline, until: clock + 150}; story.nextAt = Math.min(story.nextAt, clock + 1); }
  function update(dt) {
    dt = Math.min(dt, .1); clock += dt; hour = hourOf(clock); if (weather.rain > .3) rainSeconds += dt;
    for (const r of residents) {   // needs and moods
      const asleep = !inWindow(hour, r.def.wake ?? 6.5, (r.def.sleep ?? 20.5)), alone = r.state === 'walking' || (r.state === 'inside' && r.at === r.def.home);
      stepNeeds(r.needs, dt, {asleep, alone}); r.mood = moodOf(r.needs, weather.rain, r.state === 'inside');
      if (asleep && r.at === r.def.home && r.state === 'inside') r.needs.lonely = Math.min(r.needs.lonely, .5);
    }
    for (const r of residents) stepResident(r, dt);
    for (const v of vehicles) stepVehicle(v, dt);
    releaseLocks(); stepTrain(dt); if (train.wait > .8 && train.at) boardAt(train.at); carryRiders(); stepFreight(); stepEcology(dt); stepQuests(); stepAlbum(); stepFishers(); stepFishing(dt); stepMarket(); stepIncidents(); stepWild(); stepWedding(); stepVote(); stepMystery(); weather.update(dt); stepStories(); stepLamps(dt);
  }
  // The day's ledger: a snapshot of the counters at the start of every day, so the paper can say what happened between two of them.
  let rainSeconds = 0; const days = [];
  const pairsAt2 = () => { let n = 0; for (const r of residents) for (const k in r.friends) if (r.friends[k] >= 2 && r.id < k) n++; return n; };
  const moodNow = () => residents.reduce((a, r) => a + r.mood.score, 0) / residents.length;
  const snap = () => ({delivered: stats.delivered, ridden: train.ridden, fishCaught: fishing.caught, fishSold: fishing.sold, coins: fishing.coins, marketVisits: market.visits, rain: rainSeconds, friends: pairsAt2(), stories: story.log.length, incidents: incidentLog.length, saga: sagaLog.length, dwarfSeen: wild.sightings, gemsFound: wild.gemsFound, mood: moodNow()});
  days.push(snap());
  // the paper: 'today' so far, or 'yesterday' (null on the first day)
  function paper(which = 'today') {
    const d = dayIdx; if (which === 'yesterday' && d < 1) return null;
    const start = which === 'today' ? days[d] || days[0] : days[d - 1], end = which === 'today' ? snap() : days[d], name = DAYS[which === 'today' ? weekday : (weekday + 6) % 7], nextDay = which === 'today' ? (weekday + 1) % 7 : weekday;
    const titles = [...new Set(story.log.slice(start.stories, end.stories).map(id => (STORIES.find(x => x.id === id) || {}).title).filter(Boolean))], mk = MARKET.days[which === 'today' ? weekday : (weekday + 6) % 7];
    const tm = MARKET.days[nextDay], e = edition({dayName: name, start, end, titles, marketName: mk && mk.name, tomorrow: {dayName: DAYS[nextDay], market: tm && tm.name, weekend: nextDay >= 5, festival: nextDay === FEST.weekday}, festival: (which === 'today' ? weekday : (weekday + 6) % 7) === FEST.weekday}); e.which = which; const rec = which === 'today' ? liveRecord() : chronicle.find(r => r.day === dayIdx - 1); if (rec) { e.chain = chronicleChain(rec); e.chainHeadline = chronicleHeadline(rec, chronicle.find(r => r.day === rec.day - 1)); } if (which === 'today' && followUp) e.chainNext = FOLLOW[followUp]; else if (which === 'yesterday') { const fu = rec && chronicleFollow(rec); if (fu) e.chainNext = FOLLOW[fu]; } return e;
  }
  return {care, note: qnote, wishes: wishState, quest, album, stickers: () => STICKERS.map(st => ({...st, found: album.includes(st.id)})), chronicle, get followUp() { return followUp; }, chronicleNow: liveRecord, eco, ecoLog, ecoSummary: () => ecoSummary(eco), get peace() { return ecoPeace(eco, moodNow()); }, get festival() { return festivalAt(weekday, hour); }, hunt, huntBegin, huntTap, huntClue: () => clueNow(hunt), angle, sea, sailEvent, buy, chest, chestState, get chestCoins() { return chestBalance(chestState()); }, wild, get day() { return dayIdx; }, paper, days, graph, residents, vehicles, stops, train, weather, season, lamps, market, fishing, effects, election, mystery, accuse, castVote(id) { if (!election.open || election.you || !election.q.options.some(o => o.id === id)) return false; election.you = id; return true; }, sagaLog, babies, sagaState() { return {chest: chestState(), chronicle: chronicle.slice(), album: album.slice(), seasons: [...seasonsSeen], wishesTotal: quest.total, quest: {day: quest.day, done: quest.done.slice(), counters: quest.counters}, effects, ages: Object.fromEntries(residents.map(r => [r.id, r.age])), marriages: residents.filter(r => r.spouse && r.id < r.spouse).map(r => [r.id, r.spouse]), babies}; }, cargo, get incident() { return incident; }, incidentLog, trigger(type) { if (!incident) startIncident(type); return incident; }, setEvents(on) { eventsOn = !!on; }, riders, freightLog, freightStats: stats, sendParcel, stationOf, signalFor, timetable, get weekday() { return weekday; }, get dayName() { return DAYS[weekday]; }, needsStats, get townMood() { return residents.reduce((a, r) => a + r.mood.score, 0) / residents.length; }, setBusy(k) { busy = Math.max(.2, Math.min(3, +k || 1)); }, get busy() { return busy; }, get lampsTended() { return tended; }, story, stage, update, get clock() { return clock; }, get hour() { return hour; }, setHour(h) { clock = ((h - 6 + 24) % 24) / 24 * DAY; hour = hourOf(clock); snapLamps(); }, dispatchFire() { const f = vehicles.find(v => v.id === 'fire'); if (f) f.call = 1; }, doorIds: BUILDINGS.filter(b => b.door).map(b => b.id)};
}
