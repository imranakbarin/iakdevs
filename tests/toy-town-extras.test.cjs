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
console.log('Toy Town EXTRAS PASS: KayKit CC0 kit (named, small, licensed, with fallback); taps on residents, cars, buildings and open ground; livelier gaits and greetings; news card minimises to a pill (phones first, remembered), Picture-of-the-Day cinema, fireflies and shooting stars, tap-a-resident chat, the on-this-day visitor (gentle history only, credited) and the dawn paper round.');
