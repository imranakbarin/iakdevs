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
assert.match(sim, /window\.ToyTown3D\.tapResident\?\.\(e\.clientX, e\.clientY\)\) return;/, 'a tap on a resident chats instead of starting a surprise');
console.log('Toy Town EXTRAS PASS: news card minimises to a pill (phones first, remembered), Picture-of-the-Day cinema, fireflies and shooting stars, tap-a-resident chat.');
