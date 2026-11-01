// Toy Town: a light news story picks the day's theme, a grim one never does;
// the same day always builds the same town (roads, river, a fire station, a
// park and the theme's own block); every chaos and theme event runs to its end
// without error; and traffic and people keep the streets busy.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dioramaSource = fs.readFileSync(path.join(root, 'assets/toy-town-diorama.js'), 'utf8');
assert.match(dioramaSource, /function building\(/, 'new architectural renderer exists');
assert.match(dioramaSource, /function tree\(/, 'new organic tree renderer exists');
assert.match(dioramaSource, /function gable\(/, 'real pitched roof renderer exists');
assert.match(dioramaSource, /function glazing\(/, 'framed glazing renderer exists');
assert.match(html, /<option value="town">Toy Town<\/option>/, 'Toy Town is in the menu');
assert.match(html, /townFrame\.src='toy-town\.html\?v=25&embed=1'/, 'and opens its current embedded page');
assert.match(fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8'), /assets\/toy-town\.js\?v=\d+/);
const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, setTimeout: () => 0, document: {getElementById: () => ({textContent: ''})}});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8')) + ';this.T = ToyTown;', box);
const T = box.T;

// The news filter.
assert.equal(T.themeFromNews(['A storm kills 12 people in the north', 'SpaceX launches a rocket to the Moon']).key, 'space', 'a light story is used, a grim one skipped');
assert.equal(T.themeFromNews(['Rocket attack on a city kills five']), null, 'a grim story never becomes a theme, whatever else it mentions');
assert.equal(T.themeFromNews(['The national football team wins the cup']).key, 'sports');
assert.equal(T.themeFromNews(['Voters elect a new president in a run-off']).key, 'election');
assert.equal(T.themeFromNews(['Thousands celebrate Diwali across the country']).key, 'festival');
assert.equal(T.themeFromNews(['A new species of frog is described']).key, 'animals');
assert.equal(T.themeFromNews(['The paintings were restored']), null, 'nothing matching: the date chooses');
assert.equal(T.themeFromNews(['Explosion at a fireworks festival injures dozens']), null);

// The specific kind of story picks its variant, so the town matches the news.
const v = t => (T.themeFromNews([t]) || {}).variant;
assert.equal(v('India win the second Test after a dramatic final wicket in cricket'), 'cricket');
assert.equal(v('Millions celebrate Diwali with lamps and fireworks'), 'diwali');
assert.equal(v('Palaeontologists describe a new dinosaur from a fossil found in Patagonia'), 'dino');
assert.equal(v('Artemis crew completes a lunar flyby'), 'moon');
assert.equal(v('The Monaco Grand Prix is won from pole position'), 'race');
assert.equal(v('A pod of whales is seen in the harbour'), 'whale');
const three = T.newsThemes(['Explosion kills four in a factory', 'A new smartphone goes on sale', 'Halloween parades fill the streets', 'The marathon record is broken', 'Another phone story']);
assert.equal(JSON.stringify(three.map(x => x.variant)), JSON.stringify(['phone', 'halloween', 'marathon']), 'up to three light stories, one per theme, grim ones skipped');
assert.ok(T.VARIANTS.every(x => T.VARIANT_EVENTS().includes(x.variant)), 'every variant has its own event');
// Local midnight can differ from UTC midnight; the date key must use local calendar fields.
class LateEveningDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-11-01T00:30:00Z'])); }
  getFullYear() { return 2026; } getMonth() { return 9; } getDate() { return 31; }
}
const lateBox = vm.createContext({...box, Date: LateEveningDate});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8')) + ';this.T = ToyTown;', lateBox);
assert.equal(lateBox.T.dateKey(), '2026-10-31', 'late local evening remains on the local date');

// The story's own name goes on the banners; a long story becomes a headline.
assert.equal(T.nameOf('India win the second Test against England by an innings'), 'India');
assert.equal(T.nameOf('Thousands celebrate the New Year in Sydney Harbour'), 'New Year', 'the first of equally long names: HAPPY NEW YEAR!');
assert.equal(T.nameOf('The Artemis III crew completes a lunar flyby'), 'Artemis III');
assert.equal(T.nameOf('A new smartphone goes on sale'), '');
assert.ok(T.headline('In tennis, the Toy Open final is won in five sets, while the crowd sings and the rain holds off for once in a long while').length <= 72, 'long stories are shortened');

// The same day builds the same town; every theme gets its block.
const layout = () => T.buildings().map(b => b.kind + b.x + ',' + b.y).join('|');
T.build(12345, 'space'); const a = layout(); T.build(12345, 'space');
assert.equal(layout(), a, 'the same seed builds the same town');
for (const [key, kind] of Object.entries({space: 'launchpad', sports: 'stadium', election: 'stage', animals: 'zoo', market: 'market', science: 'lab'})) {
  T.build(777, key);
  assert.ok(T.props().some(p => p.kind === kind), `${key}: the town has its ${kind}`);
  assert.ok(T.buildings().some(b => b.kind === 'fire'), `${key}: there is a fire station`);
}
// Every event runs to its end, in every theme, with the streets kept busy.
for (const key of Object.keys(T.THEMES)) {
  T.build(4242, key);
  for (const name of ['hydrant', 'cart', 'dog', 'balloons', 'cat', 'pigeons', 'banana', 'ufo', 'icecream', 'duck', 'jam', 'chickens', key]) T.startEvent(name);
  for (let i = 0; i < 60 * 30; i++) T.update(1 / 60);
  assert.ok(T.movers().filter(m => m.kind === 'car' || m.kind === 'bus' || m.kind === 'taxi').length >= 7 && T.movers().filter(m => m.kind === 'bike').length >= 4 && T.movers().filter(m => m.type === 'person').length >= 14, `${key}: cars, cyclists and walkers keep the streets alive`);
  assert.ok(T.movers().every(m => m.x > 0 && m.x < 18 && m.y > 0 && m.y < 18 && Number.isFinite(m.x + m.y)), `${key}: everyone stays in town`);
  assert.ok(T.events().length <= 6, `${key}: events end (${T.events().length} running)`);
}
// Every news variant, with its decorations, runs to its end (as the day's lead story).
for (const x of T.VARIANTS) {
  T.build(99, x.key); T.decorate([x]); T.setToday([x]);
  const started = T.startEvent(x.variant);
  assert.ok(started, `${x.variant}: the event starts`);
  for (let i = 0; i < 60 * 40; i++) T.update(1 / 60);
  assert.ok(T.movers().every(m => Number.isFinite(m.x + m.y)), `${x.variant}: everyone is somewhere`);
  assert.ok(!T.events().includes(started), `${x.variant}: the original event finishes`);
}
assert.ok(T.PACE < 1, 'the town runs slower than real time');
// The Toy Town Times stands at the town corner, clear of houses; neighbours chat and a plane tows the headline.
{ const lead = {...T.VARIANTS.find(v => v.variant === 'cricket'), story: 'India win the second Test', name: 'India'};
  T.build(2024, 'sports'); T.decorate([lead]); T.setToday([lead]);
  const board = T.props().find(p => p.kind === 'times');
  assert.ok(board && board.x > 16.5 && board.y < 1.5 && !T.buildings().some(b => b.x + 1 > board.x - .5 && b.y < board.y + 1), 'the billboard stands in the right-hand corner, clear of the houses');
  assert.ok(T.props().filter(p => p.kind === 'kiosk').length >= 1 && T.props().some(p => p.kind === 'bunting'), 'kiosks on the corners, bunting on a match day');
  const chat = T.startEvent('chat'), plane = T.startEvent('skybanner');
  assert.ok(chat && plane && /India|Test/.test(plane.towed), 'a plane tows the headline');
  for (let i = 0; i < 60 * 40; i++) T.update(1 / 60);
  assert.ok(T.TALK.sports.some(l => l.includes('{N}')), 'some lines name the story'); }
// Travel distance rather than elapsed time drives footsteps and spinning wheels.
T.build(777, 'weather');
const walkers = T.movers().filter(m => m.type === 'person' && !m.kind);
const cyclist = T.movers().find(m => m.kind === 'bike'), walker = walkers[0];
walker.v = 0; walker.max = 0; cyclist.v = 0; cyclist.max = 0;
const parkedDistance = [walker.travel, cyclist.travel];
for (let i = 0; i < 120; i++) T.update(1 / 60);
assert.equal(walker.travel, parkedDistance[0], 'a standing walker does not advance animation distance');
assert.equal(cyclist.travel, parkedDistance[1], 'a stopped bicycle does not pedal');
walker.max = .6; cyclist.max = .65;
for (let i = 0; i < 60 * 25; i++) T.update(1 / 60);
assert.ok(walker.travel > parkedDistance[0], 'walking advances the stride clock');
assert.ok(cyclist.travel > parkedDistance[1], 'cycling advances the pedal clock');

// Canvas smoke: rich buildings, human poses and all event types must draw without errors.
// The same camera frame reuses its static ground buffer until the world changes.
const strokes = {groundDraws: 0, buffers: 0, screenBlits: 0, detailPaths: 0, gradients: 0};
const fakeContext = isGround => new Proxy({}, {get(_, key) {
  if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => {strokes.gradients++; return {addColorStop() {}};};
  if (key === 'beginPath') return () => {strokes.detailPaths++;};
  if (key === 'measureText') return txt => ({width: String(txt).length * 5});
  if (key === 'clearRect') return () => { if (isGround) strokes.groundDraws++; };
  if (key === 'drawImage') return () => { if (!isGround) strokes.screenBlits++; };
  return () => {};
}});
const fakeCanvas = isGround => ({width: 0, height: 0, style: {}, getContext: () => fakeContext(isGround)});
const sceneCanvas = fakeCanvas(false);
// Native mobile touch events are the primary Safari gesture path; desktop PointerEvents
// must not swallow or duplicate them.
const touchHandlers = {}, hostHandlers = {}, fallbackButtons = {};
let captured = 0, defaultBlocked = 0, singlePokes = 0;
const touchCanvas = {
  style: {}, getContext: () => fakeContext(false),
  getBoundingClientRect: () => ({left: 0, top: 0}),
  addEventListener: (name, handler) => {touchHandlers[name] = handler;},
  setPointerCapture: () => {captured++;}
};
const touchDoc = {getElementById: id => id === 'town' ? touchCanvas :
  ({textContent: '', style: {}, addEventListener:(name, handler) => {fallbackButtons[id] = handler;}}),
  createElement: () => fakeCanvas(true)};
const touchCtx = vm.createContext({
  document:touchDoc, window:{}, location:{origin:'https://example.test',hash:'#new'},
  innerWidth:390,innerHeight:844,devicePixelRatio:2,
  Math,Object,Array,JSON,Date,String,Number,RegExp,
  requestAnimationFrame:()=>0,setTimeout:()=>0,
  addEventListener:(name,handler)=>{(hostHandlers[name] ||= []).push(handler);}
});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'))+';this.T=ToyTown;', touchCtx);
const phone = touchCtx.T;
phone.layout(); phone.build(2026,'weather');
touchHandlers.pointerdown({pointerType:'touch',pointerId:7,clientX:100,clientY:200});
assert.equal(captured,0,'iPhone taps do not call pointer capture');
const point=(x,y)=>({clientX:x,clientY:y});
const ev=touches=>({touches,changedTouches:touches,preventDefault(){defaultBlocked++}});
touchHandlers.touchstart(ev([point(90,200)]));
touchHandlers.touchstart(ev([point(90,200),point(190,200)]));
const initialZoom=phone.debug().cam.z;
touchHandlers.touchmove(ev([point(90,200),point(260,200)]));
assert.ok(phone.debug().cam.z>initialZoom*1.5,'native iOS pinch enlarges the city');
const beforeRelease=phone.events().length;
touchHandlers.touchend(ev([]));
assert.equal(phone.events().length,beforeRelease,'pinch release is not a tap');
touchHandlers.touchstart(ev([point(120,270)]));
touchHandlers.touchend({touches:[],changedTouches:[point(120,270)],preventDefault(){defaultBlocked++}});
assert.ok(phone.events().length>beforeRelease,'single-finger tap still works');
assert.ok(defaultBlocked>=4,'touch gestures suppress browser scrolling');
const zoomBeforeButton=phone.debug().cam.z;
hostHandlers.message.forEach(fn=>fn({origin:'https://example.test',data:{type:'town:zoom',factor:1.4}}));
for(let k=0;k<90;k++)phone.update(1/60);
assert.ok(phone.debug().cam.z>zoomBeforeButton,'zoom button on main page reaches iframe');
const beforeForeign=phone.debug().cam.tz;
hostHandlers.message.forEach(fn=>fn({origin:'https://untrusted.test',data:{type:'town:zoom',factor:.5}}));
assert.equal(phone.debug().cam.tz,beforeForeign,'foreign frame message ignored');
hostHandlers.message.forEach(fn=>fn({origin:'https://example.test',data:{type:'town:fit'}}));
for(let k=0;k<90;k++)phone.update(1/60);
assert.ok(phone.fitView()<.8,'Fit fits the whole city on a narrow phone');
assert.ok(Math.abs(phone.debug().cam.z-phone.fitView())<.02,'parent Fit uses mobile fit scale');
assert.ok(fallbackButtons['zoom-in']&&fallbackButtons['zoom-out']&&fallbackButtons['zoom-reset'],
 'standalone fallback zoom controls remain wired');


const sceneDoc = {
  getElementById: id => id === 'town' ? sceneCanvas : {textContent: '', style: {}},
  createElement: tag => { assert.equal(tag, 'canvas'); strokes.buffers++; return fakeCanvas(true); }
};
const drawBox = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, document: sceneDoc, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, setTimeout: () => 0});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8')) + ';this.T = ToyTown;', drawBox);
const scene = drawBox.T;
scene.layout(); scene.build(2026, 'sports'); scene.decorate([scene.VARIANTS.find(v => v.variant === 'cricket')]);
scene.render(); scene.render();
assert.ok(strokes.detailPaths > 100, 'miniature buildings use layered projected outlines');
assert.ok(strokes.gradients > 40, 'glazing, soft shadows and foliage use tonal shading');
assert.equal(strokes.buffers, 1, 'only one backing canvas is allocated');
assert.equal(strokes.groundDraws, 1, 'static ground is not redrawn each idle frame');
assert.equal(strokes.screenBlits, 2, 'cached ground is blitted each frame');
scene.build(2027, 'festival'); scene.decorate([scene.VARIANTS.find(v => v.variant === 'halloween')]);
scene.render();
assert.equal(strokes.groundDraws, 2, 'new town invalidates static ground');
for (const key of Object.keys(scene.THEMES)) { scene.build(4242, key); scene.render(); }
assert.ok(strokes.screenBlits >= 12, 'all themed scenes complete a render pass');
scene.pinchTo(3.2, 640, 360, {x: 9, y: 9});
const previousPaths = strokes.detailPaths;
scene.render();
assert.ok(strokes.detailPaths > previousPaths, 'diorama geometry draws at close zoom');
scene.pinchTo(.55, 640, 360, {x: 9, y: 9});
scene.render();

// Hero neighborhood remains central and landscaped on every seed, while the
// surrounding plots still respond to the day's theme.
const hero = scene.hero();
assert.ok(hero && hero.xa === 7 && hero.ya === 7 && hero.type === 'hero', 'hero neighborhood stays central');
const heroBuildings = scene.buildings().filter(b => b.hero);
assert.equal(heroBuildings.length, 5, 'hero block has five individually placed buildings');
assert.equal(heroBuildings.filter(b => b.kind === 'shop').length, 2, 'hero block includes two small shops');
assert.equal(heroBuildings.filter(b => b.kind === 'house').length, 3, 'hero block includes three homes');
const heroProps = scene.props().filter(p => p.kind.startsWith('hero-'));
for (const k of ['hero-bench','hero-table','hero-lamp','hero-mail','hero-rack','hero-shrub'])
  assert.ok(heroProps.some(p => p.kind === k), k + ' furniture is present');
assert.ok(heroProps.every(p => p.x >= hero.xa && p.x < hero.xb + 1 &&
  p.y >= hero.ya && p.y < hero.yb + 1), 'each decorative object sits within the central block');
const locals = scene.movers().filter(m => m.heroResident);
assert.equal(locals.length, 3, 'three neighbors follow local neighborhood routes');
for (let k = 0; k < 60 * 75; k++) scene.update(1 / 60);
assert.ok(locals.every(m => m.x > hero.xa && m.x < hero.xb + 1 &&
  m.y > hero.ya && m.y < hero.yb + 2.3 && Number.isFinite(m.x + m.y)),
  'residents stay on the neighborhood paths and marked crossing');
assert.ok(locals.every(m => m.heroIndex >= 2), 'residents reach multiple real destinations');
assert.ok(locals.some(m => m.heroStops.some(p => p.cross)), 'a resident has a marked riverside crossing');
// A car approaches the crosswalk while a resident is already crossing:
const crossingWalker = locals[0];
const crossingCar = scene.movers().find(m => m.type === 'car' && m.kind === 'car');
assert.ok(crossingCar, 'ordinary traffic is present for crossing test');
crossingWalker.x = hero.xa + 1.5; crossingWalker.y = hero.yb + 1.1;
crossingWalker.crossing = true; crossingWalker.stopUntil = 0;
crossingWalker.path = [{x:hero.xa + 1.5, y:hero.yb + 1.85, speed:.18}];
crossingCar.x = hero.xa + .5; crossingCar.y = hero.yb + 1.5;
crossingCar.d = 0; crossingCar.v = .8; crossingCar.max = 1.3;
scene.update(.10);
assert.ok(crossingCar.v < .8, 'driver slows for a pedestrian on the zebra crossing');
crossingWalker.crossing = false; crossingWalker.path = null; crossingWalker.stopUntil = scene.debug().clock + 1;

assert.ok(locals.some(m => m.heroStops.some(p => p.sit)), 'benches are activity destinations');
scene.render();
const oldHero = scene.hero();
scene.build(654321, 'market');
assert.equal(scene.hero().type, 'hero', 'a different news theme retains the hero neighborhood');
assert.equal(scene.buildings().filter(b => b.hero).length, heroBuildings.length,
  'theme changes retain the same neighborhood architecture');
assert.ok(oldHero !== scene.hero(), 'a new town creates fresh block references');

// Camera zoom is bounded, preserves a focal world point, and can reset to fit.
scene.resetView();
for (let i = 0; i < 90; i++) scene.update(1 / 60);
const beforeZoom = scene.screenWorld(800, 300), oldZoom = scene.debug().cam.z;
scene.zoomAt(1.7, 800, 300);
for (let i = 0; i < 90; i++) scene.update(1 / 60);
assert.ok(scene.debug().cam.z > oldZoom * 1.65, 'zoom in gets closer');
const afterZoom = scene.screenWorld(800, 300);
assert.ok(Math.hypot(beforeZoom.x - afterZoom.x, beforeZoom.y - afterZoom.y) < .02,
  'wheel zoom keeps the same world point beneath the cursor');
scene.zoomAt(.2, 800, 300);
for (let i = 0; i < 90; i++) scene.update(1 / 60);
assert.ok(scene.debug().cam.z < .7, 'zoom out sees more of the town');
scene.pinchTo(100, 640, 360, {x: 9, y: 9});
assert.ok(scene.debug().cam.z <= 3.25, 'pinch maximum is clamped');
scene.pinchTo(.01, 640, 360, {x: 9, y: 9});
assert.ok(scene.debug().cam.z >= .42, 'pinch minimum is clamped');
scene.resetView();
for (let i = 0; i < 90; i++) scene.update(1 / 60);
assert.ok(Math.abs(scene.debug().cam.z - 1) < .02, 'Fit restores starting zoom');
assert.ok(Math.abs(scene.debug().cam.x - 9) < .02 && Math.abs(scene.debug().cam.y - 9) < .02,
  'Fit recentres the whole town');
scene.setPlaying(false); scene.zoomAt(1.25); // controls still work while paused
assert.ok(scene.debug().cam.z > 1.2, 'zoom controls work while paused');
scene.setPlaying(true);

// Neighborhood encounters use nearby shops, rather than placing floating scenes.
scene.build(12457, 'weather');
const walkersWithAccessories = scene.movers().filter(m => m.type === 'person' && !m.kind)
  .filter(m => m.hat || m.bag || m.scarf);
assert.ok(walkersWithAccessories.length >= 1, 'neighbors have varied outfits');
const shop = scene.buildings().find(b => b.kind === 'shop');
const neighbor = scene.movers().find(m => m.type === 'person' && !m.kind);
assert.ok(shop && neighbor, 'shop and neighbor exist');
neighbor.x = shop.x + .5; neighbor.y = shop.y + .5;
assert.ok(scene.streetMoment(), 'a nearby person can stop to greet a shop');
assert.equal(scene.debug().streetMoments, 1, 'shop encounter increments the town moment counter');
scene.render();
const townPage = fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8');
for (const id of ['zoom-in', 'zoom-out', 'zoom-reset']) {
  assert.match(townPage, new RegExp('id="' + id + '"[^>]*aria-label="[^"]+"'), id + ' is accessible');
}
assert.match(townPage, /toy-town\.js\?v=14/, 'diorama engine is loaded');
assert.match(townPage, /toy-town-diorama\.js\?v=1/, 'diorama is loaded before the engine');
assert.match(townPage, /id="town-3d"/, 'WebGL mounts into its own overlay');
assert.match(townPage, /pointer-events:none/, 'WebGL overlay allows iPhone touch gestures through to original canvas');
assert.match(townPage, /WebGL2RenderingContext/, '3D is only attempted on supported browsers');
assert.match(townPage, /classic/, 'original 2D scene remains selectable with classic URL option');
assert.match(townPage, /three@0\.187\.0/, '3D package is pinned to a reproducible version');
assert.match(townPage, /\.catch\(error => console\.warn/, '3D dependency failure falls back to the original renderer');
assert.match(fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'),
  /window\.ToyTown3D\?\.active/, 'classic simulation skips redundant Canvas rendering only when WebGL is active');

assert.ok(townPage.indexOf('toy-town-diorama.js') < townPage.indexOf('toy-town.js'),
  'material renderer loads before the world engine');
assert.match(fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'),
  /cam.z = cam.tz = innerWidth < 700 \? 1\.52 : 1\.72/,
  'opening view frames the village more closely');

assert.match(html, /id="town-zoom"/, 'zoom controls live outside the iframe');
assert.match(html, /id="town-fit"/, 'mobile has a fit-the-city button');
assert.match(html, /town:zoom/, 'outer buttons message the city');
assert.match(townPage, /embedded/, 'embedded page hides duplicate controls');


// A calm town: gentle moments run to their end, and traffic waits at red lights instead of piling into the crossings.
T.build(31337, 'weather'); T.setToday([]);
for (const name of T.CALM) T.startEvent(name);
let clashes = 0, samples = 0;
for (let i = 0; i < 60 * 120; i++) {
  T.update(1 / 60);
  if (i % 30) continue;
  const cars = T.movers().filter(m => m.type === 'car' && !m.path);
  for (const a of cars) for (const b of cars) if (a !== b && (a.d < 2) !== (b.d < 2) && Math.hypot(a.x - b.x, a.y - b.y) < .3) clashes++;
  samples++;
}
assert.ok(clashes / samples < .05, `cross traffic rarely meets in a crossing (${clashes} near misses in ${samples} samples)`);
assert.ok(T.events().length <= 6, 'the gentle moments end too');
// The simulation is slow, but daylight/night cycle still lasts five real minutes.
const dayCycle = 300 * T.PACE, phase = T.debug().clock % dayCycle;
T.update((dayCycle / 2 - phase + dayCycle) % dayCycle);
assert.ok(T.debug().night > .99, 'night halfway through the real-time cycle');
T.update(dayCycle / 2);
assert.ok(T.debug().night < .01, 'daylight returns after a five-minute cycle');
console.log(`Toy Town PASS: ${T.VARIANTS.length} news variants (cricket to Diwali to dinosaurs) each with its own event, grim stories never become themes, light ones pick ${Object.keys(T.THEMES).length - 1} kinds of day, the same day builds the same town with its theme block and fire station, and every event in every theme runs to its end with the streets kept busy.`);
