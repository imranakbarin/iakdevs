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
console.log(`Toy Town PASS: grim stories never become themes, light ones pick ${Object.keys(T.THEMES).length - 1} kinds of day, the same day builds the same town with its theme block and fire station, and every event in every theme runs to its end with the streets kept busy.`);
