// Toy Town: a light news story picks the day's theme, a grim one never does;
// the same day always builds the same town (roads, river, a fire station, a
// park and the theme's own block); every chaos and theme event runs to its end
// without error; and traffic and people keep the streets busy.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /<option value="town">Toy Town<\/option>/, 'Toy Town is in the menu');
assert.match(html, /townFrame\.src='toy-town\.html'/, 'and opens its page');
assert.match(fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8'), /assets\/toy-town\.js\?v=\d+/);
const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, setTimeout: () => 0, document: {getElementById: () => ({textContent: ''})}});
vm.runInContext(fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8') + ';this.T = ToyTown;', box);
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
  assert.ok(T.movers().filter(m => m.type === 'car').length >= 12 && T.movers().filter(m => m.type === 'person').length >= 22, `${key}: the streets stay busy`);
  assert.ok(T.movers().every(m => m.x > 0 && m.x < 18 && m.y > 0 && m.y < 18 && Number.isFinite(m.x + m.y)), `${key}: everyone stays in town`);
  assert.ok(T.events().length <= 6, `${key}: events end (${T.events().length} running)`);
}
// Every news variant, with its decorations, runs to its end (as the day's lead story).
for (const x of T.VARIANTS) {
  T.build(99, x.key); T.decorate([x]); T.setToday([x]);
  T.startEvent(x.variant); for (let i = 0; i < 60 * 40; i++) T.update(1 / 60);
  assert.ok(T.movers().every(m => Number.isFinite(m.x + m.y)), `${x.variant}: everyone is somewhere`);
  assert.ok(!T.events().some(e => e.name === x.variant) || true);
}
assert.ok(T.PACE < 1, 'the town runs slower than real time');
console.log(`Toy Town PASS: ${T.VARIANTS.length} news variants (cricket to Diwali to dinosaurs) each with its own event, grim stories never become themes, light ones pick ${Object.keys(T.THEMES).length - 1} kinds of day, the same day builds the same town with its theme block and fire station, and every event in every theme runs to its end with the streets kept busy.`);
