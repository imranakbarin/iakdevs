// Richer live paintings: each enriched tradition's chunks gain extra static
// layers (sky, distant ranges, villages, foreground), the same chunk always
// gets the same additions, the base grammar's own layers are untouched, and
// every addition draws without error in light and dark themes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /assets\/art-richer\.js\?v=\d+/, 'the module loads');
assert.match(html, /ArtRicher\.install\(\)[\s\S]*?ArtWonders\.install\(\)/, 'installed with the other art layers');
const grab = name => html.match(new RegExp('function ' + name + '\\([^]*?\\n'))[0];
const ctx = new Proxy({}, {get: (o, k) => k in o ? o[k] : k === 'getTransform' ? () => ({a: 1.5, b: 0}) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({addColorStop() {}}) : () => {}, set: (o, k, v) => { o[k] = v; return true; }});
const box = vm.createContext({Math, Object, Array, Map, String, Number, document: {createElement: () => ({getContext: () => ctx})}});
vm.runInContext(grab('mulberry32') + grab('hash') + `
  var seed = 11, TAU = Math.PI * 2, topY = 60, T = {ink: '#111', mark: '#111', light: '#fff', bg: '#eee'};
  var GOND_PAIRS = [['#416e5b', '#e6b34b'], ['#af563c', '#e4ac53']], BRIGHT = ['#F7B32B', '#E63B2E', '#12A4B6'];
  var gy = x => 500 + 10 * Math.sin(x * .01), dot = (c, x, y, r) => {};
  var OC = new Map(), tiles = new Map(), jobs = new Map(), farTiles = new Map();
  var STYLES = {}; for (const k of ['gond', 'warli', 'madhubani', 'kangra', 'japan', 'china', 'mexico']) STYLES[k] = {chunk(r, x0, add) { add(2, () => {}); add(5, () => {}); }};
`, box);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/art-richer.js'), 'utf8') + ';this.ArtRicher = ArtRicher;', box);
const AR = box.ArtRicher, STYLES = vm.runInContext('STYLES', box);
AR.install();
const layersOf = (key, x0) => { const out = []; STYLES[key].chunk(() => .5, x0, (layer, fn) => out.push([layer, fn])); return out; };
let total = 0;
for (const key of AR.styles) {
  let extra = 0;
  for (let i = 0; i < 40; i++) {
    const a = layersOf(key, i * 600), b = layersOf(key, i * 600);
    assert.deepEqual(a.map(l => l[0]), b.map(l => l[0]), `${key}: chunk ${i} always gets the same layers`);
    assert.deepEqual(a.slice(0, 2).map(l => l[0]), [2, 5], `${key}: the grammar's own layers come first, unchanged`);
    extra += a.length - 2;
    for (const dark of [false, true]) { vm.runInContext(`T.dark = ${dark}`, box); for (const [, fn] of a.slice(2)) fn(ctx, () => .5); }
  }
  assert.ok(extra >= 40, `${key}: about one addition per chunk or more (${extra} in 40)`);
  total += extra;
}
assert.equal(layersOf('madhubani', 0).length, 2, 'Madhubani, already dense, is left as it was');
console.log(`Art richer PASS: ${AR.styles.length} traditions enriched (${total} additions over 40 chunks each), seeded per chunk, base layers untouched, all draw in light and dark.`);
