// Today: every card's progress comes from what its experience keeps on this
// device, and the totals it quotes match the experiences (Pip Run's sights and
// journey book live in its own frame, so they are mirrored and checked here).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const pip = read('assets/pip-run.js');
const finds = vm.runInNewContext('(' + pip.match(/const FINDS = (\{[\s\S]*?\n  \});/)[1] + ')'), book = vm.runInNewContext(pip.match(/const BOOK = (\[[^\]]*\]);/)[1]);

const store = {};
const sandbox = {
  Math, Object, Array, JSON, Date, String, Number, location: {hash: '#gond-1'},
  localStorage: {getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }}
};
vm.createContext(sandbox);
for (const f of ['assets/art-wonders.js', 'assets/zen-seasons.js', 'assets/road-stops.js']) vm.runInContext(read(f), sandbox);
vm.runInContext('var STYLES = {gond: {}, warli: {}, madhubani: {}, kangra: {}, japan: {}, china: {}, mexico: {}};' + read('assets/home.js') + ';this.Home = Home;', sandbox);
const H = sandbox.Home, card = mode => H.cards().find(c => c.mode === mode).progress.join(' | ');
assert.equal(H.PIP_FINDS, Object.keys(finds).length, 'Today quotes Pip Run’s number of sights');
assert.equal(H.PIP_BOOK, book.length, 'and its journey book');

// A fresh device: invitations, not counts.
assert.match(card('pip'), /^Today’s world is waiting for your run \| 15 sights to find along the way$/);
assert.match(card('art'), /collect the wonders/);
assert.match(card('road'), /^Collect postcards from 20 towns$/);
assert.match(card('zen'), /^(Spring|Summer|Autumn|Winter) in the garden today$/);
assert.equal(card('cozy'), 'Calm rooms to rest in');

// After some play: what was done.
const day = new Date().toISOString().slice(0, 10);
Object.assign(store, {
  'pip-run:best': JSON.stringify({day, m: 812}), 'pip-run:seen': JSON.stringify(['ferry', 'lift', 'whale']), 'pip-run:book': JSON.stringify({meadow: {}, frost: {}}),
  'art-wonders:seen': JSON.stringify({gond: ['kites'], japan: ['petals', 'flock']}), 'road-trip:stamps': JSON.stringify(['Pinecrest', 'Dustwater']), 'road-trip:stops': JSON.stringify(['Valley overlook']),
  'zen-rake-hint': '1', 'cozy-simple-v2': JSON.stringify({scene: 'tea'})
});
assert.equal(card('pip'), 'Your best today: 812 m | 3 of 15 sights found · 2 of 5 landmarks in the journey book');
assert.equal(card('art'), '3 of 31 wonders seen');
assert.equal(card('road'), '2 of 20 postcards collected | 1 of 15 roadside stops visited');
assert.match(card('zen'), /in the garden today \| You have raked the sand$/);
assert.equal(card('cozy'), 'Last time: the tea garden');
// Yesterday's best is not today's, and damaged records read as nothing.
store['pip-run:best'] = JSON.stringify({day: '2000-01-01', m: 9000}); store['road-trip:stops'] = '{bad';
assert.match(card('pip'), /^Today’s world is waiting/);
assert.equal(card('road'), '2 of 20 postcards collected');
console.log(`Today PASS: ${H.PIP_FINDS} sights and ${H.PIP_BOOK} landmarks match Pip Run; every card reads its own progress (best today, finds, book, wonders, postcards, stops, season, raking, last room), tolerating old and damaged records.`);
