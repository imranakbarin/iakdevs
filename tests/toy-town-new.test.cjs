// New Toy Town (assets/town2): the town definition, the road graph and the simulation, checked without a browser.
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const root = path.join(__dirname, '..'), mod = f => import('file://' + path.join(root, 'assets/town2', f));
(async () => {
  const def = await mod('def.mjs'), G = await mod('graph.mjs'), S = await mod('sim.mjs');
  // the definition is self-consistent
  const ids = new Set(def.BUILDINGS.map(b => b.id)); assert.equal(ids.size, def.BUILDINGS.length, 'building ids are unique');
  for (const c of def.CAST) { assert.ok(ids.has(c.home), c.id + ' has a real home'); for (const [where, stay] of c.round) { assert.ok(ids.has(where) && def.building(where).door > 0, c.id + ' only visits places with a door (' + where + ')'); assert.ok(stay > 0); } }
  for (const b of def.BUILDINGS) assert.ok(def.shore(b.x, b.z) < .9 && def.heightAt(b.x, b.z) > 0, b.id + ' stands on dry land');
  assert.ok(Math.abs(def.heightAt(0, 0) - def.heightAt(1.5, 1.5)) < .02, 'the square is flat');
  assert.ok(def.heightAt(1.9, -8.3) > def.heightAt(0, 0) + 1, 'Windmill Hill is a hill');
  assert.ok(def.heightAt(14.5, 0) < def.ISLAND.sea, 'beyond the shore the ground is under the sea');

  // the graph: a ring of four arcs and four spokes, everything connected
  const g = G.buildGraph();
  assert.equal(Object.keys(g.nodes).length, 8); assert.equal(g.edges.length, 8);
  for (const e of g.edges) for (const p of e.line.pts) assert.ok(def.shore(p[0], p[1]) < .93, 'every road is on land (' + e.id + ')');
  const doorIds = def.BUILDINGS.filter(b => b.door).map(b => b.id);
  for (const b of doorIds) { const d = g.doors[b]; assert.ok(d.dist < 2.6, b + ' is near a road (' + d.dist.toFixed(2) + ')'); }
  // no building stands on a road, and no two buildings overlap
  for (const b of def.BUILDINGS) if (b.id !== 'clock') for (const e of g.edges) for (const p of e.line.pts) assert.ok(Math.hypot(p[0] - b.x, p[1] - b.z) > .95, b.id + ' is clear of ' + e.id);
  for (const a of def.BUILDINGS) for (const b of def.BUILDINGS) if (a.id < b.id) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1.9, a.id + ' and ' + b.id + ' do not overlap');
  // door-to-door walks: start and end on the doorsteps, stay on the pavements, never jump
  let walks = 0;
  for (const a of doorIds) for (const b of doorIds) if (a !== b) {
    const L = g.walk(a, b); walks++;
    assert.ok(L && L.length > .5, 'a walk exists from ' + a + ' to ' + b);
    const A = g.doors[a], B = g.doors[b], first = L.pts[0], last = L.pts[L.pts.length - 1];
    assert.ok(Math.hypot(first[0] - A.x, first[1] - A.z) < 1e-6 && Math.hypot(last[0] - B.x, last[1] - B.z) < 1e-6, 'it runs doorstep to doorstep');
    for (let i = 1; i < L.pts.length - 1; i++) {
      const p = L.pts[i]; let dmin = Infinity; for (const e of g.edges) for (const q of e.line.pts) dmin = Math.min(dmin, Math.hypot(p[0] - q[0], p[1] - q[1]));
      assert.ok(dmin < def.ROAD.pave + .2, 'the walk keeps to the pavement (' + a + '→' + b + ', ' + dmin.toFixed(2) + ')');
    }
  }
  assert.ok(walks >= 100);
  // the vehicles' tour: closed, on the roads, and it never comes near itself except where it is continuous
  const T = g.tour; assert.ok(T.closed && T.length > 60, 'the tour covers the network (' + T.length.toFixed(1) + ')');
  let closest = Infinity;
  for (let i = 0; i < T.pts.length; i += 2) for (let j = i + 2; j < T.pts.length; j += 2) {
    const sep = Math.min(Math.abs(T.at[i] - T.at[j]), T.length - Math.abs(T.at[i] - T.at[j])); if (sep < 1.2) continue;
    closest = Math.min(closest, Math.hypot(T.pts[i][0] - T.pts[j][0], T.pts[i][1] - T.pts[j][1]));
  }
  assert.ok(closest > .3, 'the lanes of the tour never touch (' + closest.toFixed(2) + ')');

  // the simulation: residents appear and vanish only on doorsteps, nobody jumps, vehicles keep apart, the bus stops
  const sim = S.createSim(7), doors = Object.values(sim.graph.doors), atDoor = (x, z) => doors.some(d => Math.hypot(d.x - x, d.z - z) < .08);
  let prev = null, outings = 0, minGap = Infinity, out = 0, samples = 0, nightOut = 0, nightSamples = 0, dayOut = 0, daySamples = 0, popped = 0;
  const wasParked = new Map(sim.vehicles.map(v => [v.id, v.state === 'parked'])), seen = {};
  for (let i = 0; i < 20 * 1000; i++) {
    sim.update(1 / 20);
    const h = sim.hour, night = h >= 23.5 || h < 5;
    const cur = sim.residents.map(r => ({state: r.state, x: r.x, z: r.z}));
    if (prev) cur.forEach((r, k) => {
      const q = prev[k];
      if (r.state === 'walking' && q.state === 'inside') { outings++; assert.ok(atDoor(r.x, r.z), sim.residents[k].id + ' steps out on a doorstep'); }
      if (r.state === 'inside' && q.state === 'walking') assert.ok(atDoor(r.x, r.z), sim.residents[k].id + ' goes in on a doorstep');
      if (r.state === 'walking' && q.state === 'walking') assert.ok(Math.hypot(r.x - q.x, r.z - q.z) < .08, 'nobody jumps');
      if (r.state === 'walking') assert.ok(def.shore(r.x, r.z) < .95, 'walkers stay on land');
    });
    prev = cur; const walking = cur.filter(r => r.state === 'walking').length; out += walking; samples++;
    if (night) { nightOut += walking; nightSamples++; } else { dayOut += walking; daySamples++; }
    const active = sim.vehicles.filter(v => v.state !== 'parked');
    for (const v of sim.vehicles) {   // vehicles come out of and go back into their garage, nowhere else
      const was = wasParked.get(v.id), now = v.state === 'parked';
      if (was !== now) { const home = def.doorOf(def.building(v.def.home)); if (Math.hypot(v.x - home.x, v.z - home.z) > 2.1) popped++; seen[v.id] = (seen[v.id] || 0) + 1; wasParked.set(v.id, now); }
      if (v.state !== 'parked') { const o = v.def; const inside = o.onCall || v.state === 'returning' || (o.from <= o.to ? h >= o.from - .3 && h < o.to : true); assert.ok(inside, v.id + ' is only out in its hours, or on its way home (' + h.toFixed(1) + ')'); if (v.state === 'returning') { v.returningFor = (v.returningFor || 0) + 1; assert.ok(v.returningFor < 20 * 150, v.id + ' gets home within a couple of minutes'); } else v.returningFor = 0; }
    }
    for (const a of active) for (const b of active) if (a.id < b.id) {
      const d = Math.hypot(a.x - b.x, a.z - b.z), fwd = Math.min(((b.s - a.s) % T.length + T.length) % T.length, ((a.s - b.s) % T.length + T.length) % T.length);
      minGap = Math.min(minGap, fwd);
      if (d < .7) assert.ok(d > .36, 'two vehicles never touch, even on opposite sides of a turning circle (' + d.toFixed(2) + ')');
    }
  }
  assert.ok(outings >= 50, 'the cast keeps coming and going (' + outings + ' outings in two days)');
  assert.ok(sim.residents.every(r => r.outings >= 3), 'everybody goes out');
  assert.ok(out / samples > 1.5 && out / samples < 9, 'a few people are out at any moment (' + (out / samples).toFixed(1) + ')');
  assert.ok(nightSamples > 100 && daySamples > 100, 'the run covers day and night');
  assert.ok(nightOut / nightSamples < .12 * dayOut / daySamples, 'nobody is about at night (' + (nightOut / nightSamples).toFixed(2) + ' vs ' + (dayOut / daySamples).toFixed(2) + ')');
  assert.equal(popped, 0, 'vehicles only ever leave and enter by their garage');
  assert.ok(Object.keys(seen).length >= 5, 'the milk float, tractor, ice-cream van, bus and taxi all took their turn (' + Object.keys(seen).join(',') + ')');
  assert.ok(minGap > .8, 'vehicles keep a gap along the road (' + minGap.toFixed(2) + ')');
  assert.ok(sim.vehicles.find(v => v.id === 'bus').stopsMade >= 8, 'the bus serves its stops');
  // small stories and the weather
  const St = await mod('stories.mjs'), W = await mod('weather.mjs');
  const ran = Object.keys(sim.story.count); assert.ok(ran.length >= 8, 'small stories happen, and vary (' + ran.length + ' kinds: ' + ran.join(',') + ')');
  for (const s of St.STORIES) for (const [who, trips] of s.go) { assert.ok(def.CAST.some(c => c.id === who), s.id + ': ' + who + ' is in the cast'); for (const [place] of trips) assert.ok(def.building(place).door > 0, s.id + ': ' + place + ' has a door'); }
  assert.equal(new Set(St.STORIES.map(s => s.id)).size, St.STORIES.length, 'story ids are unique'); assert.ok(St.STORIES.length >= 20);
  assert.equal(St.newsStory('Football club wins cup', 'Sport').story, 'sportsday'); assert.equal(St.newsStory('Heavy rain hits the coast', 'World').weather, 'rain'); assert.equal(St.newsStory('Novel wins prize', 'Culture').story, 'bookclub');
  { const s2 = S.createSim(3); s2.setHour(10); for (let i = 0; i < 20 * 5; i++) s2.update(.05); s2.stage('sportsday', 'Football club wins cup'); let seen = null; for (let i = 0; i < 20 * 90; i++) { s2.update(.05); if (s2.story.current && s2.story.current.headline) seen = s2.story.current; }
    assert.ok(seen && seen.id === 'sportsday', 'a headline can stage its story'); assert.ok(s2.residents.some(r => r.def.id === 'chalk' && r.outings > 0), 'and the cast go out for it'); }
  { const w = W.createWeather(7); let wet = 0, dry = 0, maxRain = 0; for (let i = 0; i < 20 * 3000; i++) { w.update(.05); if (w.rain > .5) wet++; else if (w.rain < .1) dry++; maxRain = Math.max(maxRain, w.rain); assert.ok(w.rain >= 0 && w.rain <= 1.0001); }
    assert.ok(wet > 20 * 150 && dry > 20 * 600 && maxRain > .9, 'it rains for a while and is dry for longer (' + wet / 20 + ' s wet, ' + dry / 20 + ' s dry)'); }
  const Sky = await mod('sky.mjs'), noon = Sky.skyAt(12, 0), mid = Sky.skyAt(0, 0), wetNoon = Sky.skyAt(12, 1);
  assert.ok(noon.glow < .05 && mid.glow > .95 && mid.stars > .95 && noon.stars < .05, 'windows are lit and stars are out at night only');
  assert.ok(noon.sunI > 2 && mid.sunI < .5 && wetNoon.sunI < noon.sunI * .6 && wetNoon.sky !== noon.sky, 'night is dim, rain dulls the day');
  assert.ok(Sky.skyAt(6.2, 0).sky !== noon.sky && Sky.skyAt(18.4, 0).sky !== noon.sky, 'dawn and dusk have their own colours');
  sim.setHour(12); sim.dispatchFire(); for (let i = 0; i < 20 * 120; i++) sim.update(1 / 20);
  assert.ok(sim.vehicles.find(v => v.id === 'fire').trips >= 1, 'the fire engine goes out when called and comes back to the station');
  assert.ok(sim.vehicles.every(v => v.s >= 0 && v.s < T.length));
  assert.ok(sim.train.trips >= 8, 'the little train shuttles between the platform and the buffers (' + sim.train.trips + ' trips)');
  assert.ok(sim.train.z > def.TRACK.z0 && sim.train.z < def.TRACK.z1, 'and stays on its track');
  for (const b of def.BUILDINGS) assert.ok(Math.abs(b.x - def.TRACK.x) > 1.0 || b.z < def.TRACK.z0 - 1 || b.z > def.TRACK.z1 + 1, b.id + ' is clear of the railway');
  // the page and its modules exist and the old town redirects to it on request
  for (const f of ['def.mjs', 'graph.mjs', 'sim.mjs', 'build.mjs', 'main.mjs']) assert.ok(fs.existsSync(path.join(root, 'assets/town2', f)), f + ' exists');
  const page = fs.readFileSync(path.join(root, 'toy-town-new.html'), 'utf8'); assert.match(page, /assets\/town2\/main\.mjs/);
  assert.match(fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8'), /town=new/, 'toy-town.html?town=new opens the new town');
  console.log('Toy Town NEW PASS: definition, road graph (' + walks + ' door-to-door walks), tour (' + T.length.toFixed(0) + ' units, lanes ' + closest.toFixed(2) + ' apart), cast (' + outings + ' outings) and vehicles');
})().catch(e => { console.error(e); process.exit(1); });
