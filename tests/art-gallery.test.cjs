// The living gallery: paintings open by default (a live-style link still opens
// live), the light follows the clock with weights that always sum to one, the
// frame hangs only on larger screens, and the module wraps LivingArt.draw.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /assets\/art-gallery\.js\?v=\d+/, 'the module loads');
assert.match(html, /ArtGallery\.install\(\)/, 'and is installed');
const pres = html.match(/let artPresentation=([^;]+);/)[1];
const open = hash => vm.runInNewContext(pres, {location: {hash}});
assert.equal(open(''), 'painted', 'a visit without a link opens the paintings');
assert.equal(open('#today'), 'painted');
assert.equal(open('#painting-kangra-3'), 'painted');
assert.equal(open('#gond-12'), 'live', 'a link to a live style still opens it live');

let drawn = 0;
const sandbox = {Math, Object, JSON, Date, localStorage: {getItem: () => null, setItem() {}}, addEventListener() {}, document: {getElementById: () => null},
  LivingArt: {collection: {gond: {file: 'x.webp'}}, draw() { drawn++; return true; }}, cv: {clientWidth: 1366, clientHeight: 800}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/art-gallery.js'), 'utf8') + ';this.ArtGallery = ArtGallery;', sandbox);
const G = sandbox.ArtGallery;
for (let h = 0; h < 24; h += .25) { const L = G.light(h), sum = Object.values(L).reduce((a, b) => a + b, 0); assert.ok(Math.abs(sum - 1) < 1e-9, `light sums to one at ${h}h`); }
const top = h => { const L = G.light(h); return Object.keys(L).reduce((a, b) => L[a] >= L[b] ? a : b); };
assert.deepEqual([2, 6, 12, 17.5, 19.8, 23].map(top), ['night', 'dawn', 'day', 'golden', 'dusk', 'night'], 'the day turns through its lights');
const R = G.layout(1366, 800);
assert.ok(R.framed && R.x > 0 && R.y >= 86 && R.x + R.w < 1366 && R.y + R.h < 800, 'framed on a large screen, clear of the bar');
sandbox.cv.clientWidth = 390; assert.equal(G.layout(780, 1688).framed, false, 'full bleed on a phone');
const base = sandbox.LivingArt.draw; G.install(); assert.notEqual(sandbox.LivingArt.draw, base, 'it wraps the painting draw');
console.log('Art gallery PASS: paintings by default (live links stay live), five lights through the day summing to one, framed only on large screens and clear of the bar, LivingArt.draw wrapped.');
