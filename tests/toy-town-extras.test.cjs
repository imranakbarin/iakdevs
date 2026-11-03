// Toy Town extras: the news card minimises to a small pill (phones start
// minimised, the choice is remembered), and the 3D town carries the open-air
// Picture-of-the-Day cinema, fireflies and shooting stars after dusk, and
// tap-a-resident chat in the town's own fictional voice.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8'), view = fs.readFileSync(path.join(root, 'assets/toy-town-3d.js'), 'utf8'), sim = fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8');

// The minimise control, run against a tiny DOM.
assert.match(html, /<button id="card-min"[^>]*aria-label="Minimise news"/, 'the card has a minimise button');
const script = html.match(/<script>\n\/\/ The news card can be minimised[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
const run = (width, stored) => {
  const store = stored === undefined ? {} : {'toy-town:card-min': stored}, handlers = {};
  const el = () => ({cls: new Set(), attrs: {}, classList: {toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); }, contains(c) { return this.s.has(c); }}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(n, f) { this.on = this.on || {}; this.on[n] = f; }});
  const card = el(), btn = el(); card.classList.s = new Set(); btn.classList.s = new Set();
  vm.runInNewContext(script, {innerWidth: width, document: {getElementById: id => id === 'card' ? card : btn}, localStorage: {getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = v; }}});
  return {card, btn, store};
};
let t = run(390); assert.ok(t.card.classList.contains('min'), 'a phone starts with the card minimised');
assert.equal(t.btn.textContent, '+'); assert.equal(t.btn.attrs['aria-expanded'], 'false');
t.btn.on.click({stopPropagation() {}}); assert.ok(!t.card.classList.contains('min'), '+ opens it'); assert.equal(t.store['toy-town:card-min'], '0', 'and remembers');
t.btn.on.click({stopPropagation() {}}); assert.ok(t.card.classList.contains('min'), '− minimises it again');
t = run(1280); assert.ok(!t.card.classList.contains('min'), 'a desktop starts with the card open');
t = run(1280, '1'); assert.ok(t.card.classList.contains('min'), 'a remembered choice wins');
t.card.on.click(); assert.ok(!t.card.classList.contains('min'), 'tapping the pill opens the card');

// The 3D additions.
assert.match(view, /function openAirCinema\(\)/); assert.match(view, /featured\/\$\{y\}\/\$\{m\}\/\$\{d\}/, 'the cinema fetches the Picture of the Day');
assert.match(view, /Picture of the Day · Wikimedia Commons/, 'and credits it on the screen');
assert.match(view, /if\(Math\.hypot\(p\.x-CINEMA\.x,p\.y-CINEMA\.z\)<1\.7\)return;/, 'no tree grows through the screen');
assert.match(view, /function nightLife\(dark,time\)/); assert.match(view, /new THREE\.Points\(/, 'fireflies');
assert.match(view, /Fiction only, in the town's own voice/, 'resident chat never quotes the sourced headlines');
assert.match(sim, /window\.ToyTown3D\.tap\?\.\(e\.clientX, e\.clientY\)\) return;/, 'a tap on a resident chats instead of starting a surprise');
// The "on this day" visitor and the morning paper round.
assert.match(view, /onThisDay=lightHistory\(data\?\.onthisday\)/, 'the visitor reads the same daily Wikipedia feed as the cinema');
assert.match(view, /!grim\(o\.text\)/, 'grim history is filtered with the town GRIM list');
assert.match(view, /'On this day · Wikipedia'/, 'and the history is credited');
assert.match(view, /Math\.hypot\(x-9,z-9\)>2\.4/, 'the pod never lands in the busy central plaza');
assert.match(view, /b\.y\+1===l/, 'papers go only to doors that face the street being ridden');
assert.match(view, /wasNight&&dark<\.15/, 'the round rides at dawn');
// The history filter itself, extracted and run.
const grimSrc = view.match(/const grim=text=>[^\n]*\n/)[0], lightSrc = view.match(/function lightHistory\(list\)\{[\s\S]*?\n  \}/)[0];
const ctx = {town: {GRIM: ['kill*', 'war', 'bomb*']}}; vm.runInNewContext(grimSrc.replace('const grim', 'this.grim') + lightSrc + ';this.lightHistory=lightHistory;', ctx);
const kept = ctx.lightHistory([{year: 1969, text: '<b>Apollo 11</b> lands on the Moon.'}, {year: 1945, text: 'A bomb is dropped on a city.'}, {year: 1914, text: 'The war begins in earnest.'}, {year: 2001, text: 'short'}]);
assert.equal(JSON.stringify(kept), JSON.stringify([{year: 1969, text: 'Apollo 11 lands on the Moon.'}]), 'only gentle, real-length history is kept, tags stripped');
// Taps hit-test the real 3D scene, and every tap does something visible.
assert.match(view, /function tap\(clientX,clientY\)/); assert.match(view, /function groundAt\(clientX,clientY\)/, 'ground taps use a real ray onto the street plane');
assert.match(view, /actorAt\(clientX,clientY,\['car','bike'\],40\)/, 'cars and bikes can be tapped');
assert.match(view, /buildingHello\(b,/, 'buildings answer a tap');
assert.match(view, /\['balloons','birds','confetti'\]/, 'open ground gets a surprise');
assert.match(view, /while\(effects\.length>=6\)/, 'a flurry of taps never piles up effects');
assert.match(view, /const tapLight=new THREE\.PointLight/, 'one porch light is made with the scene, never added at tap time (no shader recompile hitch)');
// Livelier residents.
const town = fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8');
assert.match(town, /const PACE = \.82,/, 'the town moves at a livelier pace');
assert.match(town, /gait = g < \.2 \? 'brisk' : g < \.3 \? 'skip' : 'stroll'/, 'residents have their own walk');
assert.match(town, /function passingGreetings\(\)/, 'passing neighbours glance and wave');
// KayKit CC0 models: one GLB with named roots, licences alongside, loaded before the scene builds, with a fallback.
const glb = fs.readFileSync(path.join(root, 'assets/kaykit/kaykit-town.glb'));
assert.equal(glb.toString('ascii', 0, 4), 'glTF', 'the kit is a binary glTF');
const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
const names = new Set(json.nodes.map(n => n.name));
for (const n of ['building_A', 'building_H', 'car_sedan', 'car_taxi', 'streetlight', 'bench', 'tree_single_A', 'trees_B_medium', 'cloud_big']) assert.ok(names.has(n), 'the kit carries ' + n);
assert.ok(glb.length < 1.5e6, 'and stays small for phones (' + (glb.length / 1e6).toFixed(2) + ' MB)');
for (const f of ['LICENSE-city-builder-bits.txt', 'LICENSE-medieval-hexagon.txt']) assert.match(fs.readFileSync(path.join(root, 'assets/kaykit', f), 'utf8'), /CC0/, f + ' is CC0');
assert.match(html, /GLTFLoader\(\)\.load\('assets\/kaykit\/kaykit-town\.glb/, 'the page loads the kit');
assert.match(html, /has\('nokit'\)/, 'and can be opened without it');
assert.match(view, /if\(kitBuilding\(b\)\)continue;/, 'houses, shops and towers use KayKit buildings when the kit is there');
assert.match(view, /function kitPlace\(/); assert.match(view, /geo\('capsule',r,len\)/, 'residents have smooth rounded limbs');
for (const n of ['road_straight', 'road_junction', 'road_tsplit', 'road_corner', 'road_straight_crossing']) assert.ok(names.has(n), 'the kit carries ' + n);
assert.match(view, /function kitRoads\(\)/); assert.match(view, /if\(v&&!h&&\(y===13\|\|y===14\)\)continue;/, 'road tiles leave the river to the bridges');
assert.match(view, /if\(b\.hero&&kitLandmark\(b\)\)/, 'the plaza buildings use KayKit models too');
assert.match(view, /'BOOK NOOK'/, 'and keep their signs');
// A day in the life: run the real simulation through a whole day.
{
  const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, Set, Map, setTimeout: () => 0, document: {getElementById: () => ({textContent: '', style: {}})}});
  vm.runInContext(town + ';this.T=ToyTown;', box); const T = box.T; T.build(20261102, 'market');
  const seen = new Set(); let most = 0, lit = 0;
  for (let i = 0; i < 20 * 300 * 1.1; i++) { T.update(1 / 20); const d = T.debug(); if (d.daypart) seen.add(d.daypart);
    const ms = T.movers(); most = Math.max(most, ms.filter(m => m.routine).length);
    if (ms.some(m => m.kid && m.backpack)) seen.add('children'); if (ms.some(m => m.briefcase)) seen.add('commuters'); if (ms.some(m => m.routine === 'lunch' && m.shopAction === 'eating')) seen.add('eating');
    if (d.daypart === 'evening') lit = Math.max(lit, T.buildings().filter(b => b.kind === 'house' && b.home && b.homeAt).length); }
  for (const k of ['morning', 'lunch', 'evening', 'children', 'commuters', 'eating']) assert.ok(seen.has(k), 'a day has ' + k);
  assert.ok(lit >= 2, `people get home in the evening (${lit} houses)`); assert.ok(most <= 8, 'a lively street, never a crowd');
}
assert.match(view, /p\.glass\.emissiveIntensity=p\.b\.home&&dark>\.25/, 'porch lamps light once someone is home after dusk');
assert.match(view, /\[\?&\]fps\\b/, '?fps shows a frame-rate readout');
// Following a resident and feeding the ducks, in the real simulation.
{
  const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, Set, Map, setTimeout: () => 0, document: {getElementById: () => ({textContent: '', style: {}})}});
  vm.runInContext(town + ';this.T=ToyTown;', box); const T = box.T; T.build(20261102, 'market');
  const who = T.movers().find(m => m.type === 'person' && !m.kind);
  assert.equal(T.follow(who), who, 'a resident can be followed');
  for (let i = 0; i < 40; i++) T.update(1 / 20);
  const cam = T.debug().cam; assert.ok(Math.hypot(cam.x - who.x, cam.y - who.y) < 1.2, 'the camera keeps them in view');
  T.follow(null); assert.equal(T.following(), null, 'and lets go');
  const ducks = T.props().filter(p => p.kind === 'duck'), before = ducks.map(d => Math.hypot(d.x - 9, d.y - 14));
  T.feedDucks(9, 14); for (let i = 0; i < 160; i++) T.update(1 / 20);
  const after = ducks.map(d => Math.hypot(d.x - 9, d.y - 14));
  assert.ok(after.every((d, i) => d <= before[i] + .01) && after.some((d, i) => d < before[i] - .5), 'crumbs on the river draw the ducks over');
  assert.ok(ducks.every(d => d.y >= 13.1 && d.y <= 14.9), 'and the ducks stay on the water');
}
assert.match(view, /function hold\(clientX,clientY\)/, 'press and hold follows a resident');
assert.match(view, /function roleOf\(ref\)/); assert.match(view, /function doingOf\(ref\)/, 'the follow card says who they are and what they are doing');
assert.match(sim, /armHold\(down, e\.clientX, e\.clientY\)/); assert.match(sim, /armHold\(touchStart, t\.clientX, t\.clientY\)/, 'holds work with mouse and touch');
const soundSrc = fs.readFileSync(path.join(root, 'assets/toy-town-sound.js'), 'utf8');
assert.match(html, /id="sound-toggle"/); assert.match(html, /toy-town-sound\.js\?v=\d+/, 'a sound toggle sits with the zoom controls');
assert.match(soundSrc, /set\(false, false\);/, 'sound starts off');
for (const c of ['honk', 'bell', 'quack', 'chirp', 'pop', 'chime']) assert.match(soundSrc, new RegExp(c + ': \\(\\) =>'), c + ' is synthesised');
assert.doesNotMatch(soundSrc, /\.(mp3|ogg|wav)/, 'no sound files to download');
// Nobody stays stuck, and walkers do things of their own: several layouts, six town-minutes each.
for (const seed of [20261102, 7, 42]) {
  const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, Set, Map, setTimeout: () => 0, document: {getElementById: () => ({textContent: '', style: {}})}});
  vm.runInContext(town + ';this.T=ToyTown;', box); const T = box.T; T.build(seed, 'market');
  const last = new Map(), still = new Map(); let worst = 0, overlaps = 0, overlapSample = '', merged = new Map();
  // The 3D toy vehicles' real footprints (half length x half width, see car() in toy-town-3d.js): stopped cars must never merge.
  const HALF = {car: [.22, .125], taxi: [.22, .125], police: [.22, .125], racer: [.23, .125], bus: [.35, .135], fire: [.30, .125], icecream: [.22, .125]};
  const spot = m => { const l = m.lane || 0, o = m.path ? [0, 0] : m.d < 2 ? [0, (m.d === 0 ? 1 : -1) * l] : [(m.d === 2 ? -1 : 1) * l, 0]; return [m.x + o[0], m.y + o[1]]; };
  for (let i = 0; i < 20 * 360; i++) { T.update(1 / 20); if (i % 20) continue; const clock = T.debug().clock;
    const cars = T.movers().filter(m => m.type === 'car' && HALF[m.kind]), live = new Set();
    for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) { const A = cars[a], B = cars[b], pa = spot(A), pb = spot(B), ha = HALF[A.kind], hb = HALF[B.kind];
      const ax = A.d < 2 ? [ha[0], ha[1]] : [ha[1], ha[0]], bx = B.d < 2 ? [hb[0], hb[1]] : [hb[1], hb[0]];
      if (Math.abs(pa[0] - pb[0]) < ax[0] + bx[0] && Math.abs(pa[1] - pb[1]) < ax[1] + bx[1]) { const key = a + '/' + b; live.add(key); const n = (merged.get(key) || 0) + 1; merged.set(key, n); overlaps = Math.max(overlaps, n);
        overlapSample ||= `${A.kind}/${B.kind} at ${pa.map(v => v.toFixed(2))} v ${pb.map(v => v.toFixed(2))} clock ${clock | 0}`; } }
    for (const k of [...merged.keys()]) if (!live.has(k)) merged.delete(k);
    for (const m of T.movers()) { const p = last.get(m), meant = (m.stopUntil && clock < m.stopUntil) || m.sit || m.max === 0 || m.shopRole || m.path;
      const n = p && !meant && Math.hypot(m.x - p.x, m.y - p.y) < .01 ? (still.get(m) || 0) + 1 : 0; still.set(m, n); worst = Math.max(worst, n); last.set(m, {x: m.x, y: m.y}); } }
  assert.ok(overlaps <= 15, `layout ${seed}: no two vehicles stay merged (the longest overlap lasted ${overlaps} s; first: ${overlapSample})`);
  assert.ok(worst <= 30, `layout ${seed}: no car, bike or walker is stuck for long (longest ${worst} s; a red light plus a short queue is fine, the old deadlocks lasted the whole run)`);
  const w = T.debug().whims, kinds = Object.entries(w).filter(([k, v]) => v > 0).length;
  assert.ok(kinds >= 4, `layout ${seed}: walkers follow varied whims (${JSON.stringify(w)})`);
  const g = T.gather(9, 9.5); assert.ok(g >= 0);
}
assert.match(sim, /if\(pushing&&\(o\.d<2\)!==\(m\.d<2\)\)continue;/, 'a car out of patience can edge past crossing traffic (and separateCars eases touching stopped cars apart afterwards)');
// Moments: offered, never automatic; Watch follows and narrates.
assert.match(view, /function offerMoment\(m\)/); assert.match(view, /go\.onclick=\(\)=>\{if\(offered\)watchMoment\(offered\);\}/, 'the camera moves only when Watch is tapped');
assert.match(view, /town\.follow\(m\.ref,3\);ensureFollowCard\(\)/, 'watching follows close with the narrating card');
// Weather: WMO codes map to the town's kinds; only a coarse time-zone city is used.
const wsrc = fs.readFileSync(path.join(root, 'assets/toy-town-weather.js'), 'utf8');
const wbox = vm.createContext({Math, Object, JSON, Promise, setTimeout: () => 0, clearTimeout: () => 0, location: {search: '?weather=snow'}, URLSearchParams, Intl, document: {getElementById: () => null}});
vm.runInContext(wsrc + ';this.W=ToyTownWeather;', wbox);
const d = wbox.W.describe;
assert.equal(d(0).kind, 'clear'); assert.equal(d(3).kind, 'cloud'); assert.equal(d(45).kind, 'fog'); assert.equal(d(63).kind, 'rain'); assert.equal(d(81).kind, 'rain'); assert.equal(d(73).kind, 'snow'); assert.equal(d(95).kind, 'storm'); assert.ok(d(2, 50).windy);
assert.doesNotMatch(wsrc, /geolocation/, 'no location prompt: only the time-zone city');
assert.match(wsrc, /api\.open-meteo\.com/); assert.match(html, /<span id="weather"><\/span>/);
assert.match(view, /function updateWeather\(dt\)/); assert.match(view, /function umbrellaFor\(group,ref\)/, 'rain brings out umbrellas');
// Pavements, and walkers keep to them.
assert.match(view, /instanced\(slabs,\.05,\.2,'#d9d3c6'\)/, 'raised pavements line every street');
assert.match(view, /if\(t\)t\.scale\.x=1-2\*P;/, 'the asphalt is narrowed to the carriageway');
assert.match(sim, /function walk\(x, y, tx, ty, speed\)/); assert.match(sim, /m\.path = walkFrom\(m, x, y, \.45\)/, 'routes for people follow the pavements');
{
  const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, Set, Map, setTimeout: () => 0, document: {getElementById: () => ({textContent: '', style: {}})}});
  vm.runInContext(town + ';this.T=ToyTown;', box); const T = box.T; T.build(42, 'market');
  let centre = 0, samples = 0; const L = [1, 6, 11, 16];
  for (let i = 0; i < 20 * 240; i++) { T.update(1 / 20); if (i % 40) continue;
    for (const m of T.movers()) { if (m.type !== 'person' || !m.path || m.shopRole || m.heroResident || m.communityResident || m.kind) continue; samples++;
      // Walking *along* a centre line (crossing a street at a junction is fine).
      const alongV = (m.d === 2 || m.d === 3) && L.some(l => Math.abs(m.x - l - .5) < .2), alongH = m.d < 2 && L.some(l => Math.abs(m.y - l - .5) < .2); if (alongV || alongH) centre++; } }
  assert.ok(samples > 50 && centre / samples < .05, `walkers on a route keep off the centre line (${centre}/${samples})`);
}
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /keep=\['weather','fps'\]/, 'the main page passes ?weather= and ?fps into the embedded town');
// The ring railway, the cuter vehicles and the softer city (code-level checks; the behaviour is exercised in toy-town-3d.test.cjs).
assert.match(view, /function createRailway\(\)/); assert.match(view, /'TOY TOWN',cx,/, 'the station carries its name');
assert.match(view, /function updatePassengers\(dt,dark\)/); assert.match(view, /if\(trainHit\(clientX,clientY\)\)/, 'tapping the train toots');
assert.match(soundSrc, /toot: \(\) =>/, 'the whistle is synthesised too');
assert.match(view, /function createFarm\(\)/, 'a windmill and a pasture of sheep out by the railway');
assert.match(view, /geo\('soft',/, 'vehicles are built from soft rounded boxes, not KayKit blocks');
assert.doesNotMatch(view.slice(view.indexOf('  function car(ref){'), view.indexOf('  function car(ref){') + 600), /car_sedan/, 'the old boxy car models are gone');
assert.match(view, /m\.roughness=1;m\.metalness=0/, 'kit buildings are matt and lifted toward cream');
assert.match(sim, /PAN = \.6/, 'the view can be dragged out to the railway and station');
assert.match(sim, /function separateCars\(dt\)/, 'stopped cars whose bodies touch ease apart');
assert.match(view, /function buildingSite\(b\)/); assert.match(view, /'BUILDING SITE'/, 'the building site says what it is: hoarding, a half-built house, scaffolding, a crane, workers in hard hats');
assert.match(view, /function updateSite\(dt\)/, 'the crane swings and the workers work');
assert.doesNotMatch(html, /sepia\(|nograde/, 'the cinematic filter is gone');
assert.doesNotMatch(html, /#town-3d[^{]*\{[^}]*blur\(/, 'and nothing blurs');
assert.match(view, /const d = \.9 \+ bump \* \.12/, 'tree canopies are smooth and round, not lumpy');
assert.match(view, /const BIKE_SCALE=\.52;/, 'bicycles are scaled well below the toy cars');
assert.match(view, /const CUTE=\.8,HEAD_BIG=1\.22;/, 'residents are smaller with a big round head');
assert.match(view, /function createLife\(\)/); assert.match(view, /function scatterBirds\(x,z,r\)/, 'pigeons peck and scatter');
assert.match(view, /if\(scatterBirds\(spot\.x,spot\.z,1\.1\)\)/, 'a tap on open ground can startle them');
assert.match(view, /const ANIMAL_SCALE=\{dog:\.5/, 'animals are scaled to match the small residents (the dog was huge)');
assert.match(view, /function createMore\(\)/); assert.match(view, /function updateMore\(dt,dark\)/); assert.match(view, /function startParade\(\)/, 'a lamplighter, a parade, seagulls, a market crowd and fireworks');
assert.match(view, /const fkinds=\[\['loco',\.62\]/, 'a goods train with coal, logs, a tanker, a box car and a caboose takes turns with the passenger train');
assert.match(soundSrc, /firework: \(\) =>/, 'fireworks have a synthesised bang');
// Ducks stay on open water: never on a bridge deck, even when chasing crumbs or startled by walkers.
{
  const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, Set, Map, setTimeout: () => 0, document: {getElementById: () => ({textContent: '', style: {}})}});
  vm.runInContext(town + ';this.T=ToyTown;', box); const T = box.T; T.build(555, 'market');
  const ducks = T.props().filter(p => p.kind === 'duck'), onBridge = x => [1, 6, 11, 16].some(l => Math.abs(x - (l + .5)) < .7);
  assert.ok(ducks.length >= 3 && ducks.every(d => !onBridge(d.x)), 'no duck starts on a bridge');
  let bad = 0; for (let i = 0; i < 20 * 400; i++) { T.update(1 / 20); if (i === 600) T.feedDucks(8.5, 14); if (i === 1500) T.feedDucks(1.5, 14); for (const d of ducks) if (onBridge(d.x)) bad++; }
  assert.equal(bad, 0, 'ducks never float on a bridge (they turn round at the deck)');
}
assert.match(view, /farm\.sails\.rotation\.z-=dt\*\(\.9/, 'the windmill sails face the front and turn at a clearly visible speed');
// Nobody walks on the river: events, gatherings, whims and errands all keep to land and bridges.
for (const seed of [555, 42]) {
  const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, Set, Map, setTimeout: () => 0, document: {getElementById: () => ({textContent: '', style: {}})}});
  vm.runInContext(town + ';this.T=ToyTown;', box); const T = box.T; T.build(seed, 'market');
  let wet = 0, where = '';
  for (let i = 0; i < 20 * 420; i++) { T.update(1 / 20); if (i % 10) continue;
    for (const m of T.movers()) if (m.type === 'person' && m.y > 13.1 && m.y < 14.9 && Math.min(...[1, 6, 11, 16].map(l => Math.abs(m.x - (l + .5)))) > .62) { wet++; where ||= `${m.x.toFixed(2)},${m.y.toFixed(2)} d${m.d}`; } }
  assert.equal(wet, 0, `layout ${seed}: nobody walks on the water (first at ${where})`);
}
assert.match(view, /b\.scale\.setScalar\(\.62\)/, 'seagulls are small');
assert.match(view, /groundPiece\(1\.34,2\.05/, 'bridges are wide enough for the pavement lanes');
console.log('Toy Town EXTRAS PASS: nobody walks on the river, small seagulls, wider bridges; a lamplighter, parades with confetti, a goods train, seagulls, a market-day crowd and fireworks; a rowing boat, a fisher, a playground with children, scattering pigeons and a kite flyer, animals in proportion; small cute cyclists and chibi residents; a readable building site and a warm cinematic grade; a ring railway with a station and a little steam train; small soft pastel vehicles that never stay merged; a softer city; pavements and walkers on them; nobody stays stuck (3 layouts); varied whims; Moments on request; local weather; follow a resident, feed the ducks, gentle opt-in sound; a day in the life (commuters, children, lunch, home at dusk); KayKit CC0 kit (named, small, licensed, with fallback; roads and plaza too); taps on residents, cars, buildings and open ground; livelier gaits and greetings; news card minimises to a pill (phones first, remembered), Picture-of-the-Day cinema, fireflies and shooting stars, tap-a-resident chat, the on-this-day visitor (gentle history only, credited) and the dawn paper round.');
