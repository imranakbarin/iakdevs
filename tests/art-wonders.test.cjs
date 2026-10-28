// World art wonders: seeded per stretch, never the same twice in a row, each
// kind drawn without error, and a pure function of time (a paused redraw is
// identical). Runs against stubs of the page globals the module reads.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /assets\/art-wonders\.js\?v=\d+/, 'the module loads');
assert.match(html, /ArtWonders\.install\(\)/, 'and is installed');

let log = [];
const ctx = new Proxy({}, {get: (o, k) => k in o ? o[k] : (...a) => { log.push(k + a.map(v => typeof v === 'number' ? v.toFixed(2) : '').join(',')); }, set: (o, k, v) => { o[k] = v; log.push(k + '=' + v); return true; }});
const caption = {append(e) { this.child = e; }};
const sandbox = {
  Math, Object, Array, String, Number, setInterval: () => 0,
  document: {getElementById: id => id === 'art-caption' ? caption : null, createElement: () => ({style: {}, textContent: ''})}
};
const ctxVm = vm.createContext(sandbox);
// Helpers copied from the page (index.html), plus a style table.
const pick = name => { const m = html.match(new RegExp('function ' + name + '\\([^]*?\\n')); assert.ok(m, name); return m[0]; };
vm.runInContext(pick('mulberry32') + pick('hash') + `
  var seed = 7, TAU = Math.PI * 2, topY = 0, dark = false, isDark = () => dark;
  var T = {ink: '#1b120c', mark: '#1b120c', light: '#fff8e8'};
  var GOND_PAIRS = [['#416e5b','#e6b34b'],['#af563c','#e4ac53']], BRIGHT = ['#F7B32B','#E63B2E','#12A4B6'], WATER = ['#2B59C3','#12A4B6'];
  var STYLES = {gond: {}, warli: {}, madhubani: {}, kangra: {}, japan: {}, china: {}, mexico: {}};
`, ctxVm);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/art-wonders.js'), 'utf8'), ctxVm);
const W = vm.runInContext('ArtWonders', ctxVm), STYLES = vm.runInContext('STYLES', ctxVm);
W.install();

const kinds = {}, expected = {gond: ['flock', 'kites', 'shower'], japan: ['petals'], china: ['lanterns'], mexico: ['banners']};
for (const style of Object.keys(STYLES)) {
  let some = 0;
  for (let i = 1; i < 400; i++) {
    const w = W.wonderAt(style, i);
    if (w) { some++; (kinds[style] = kinds[style] || new Set()).add(w); assert.notEqual(w, W.wonderAt(style, i - 1), `${style}: the same wonder twice in a row at ${i}`); }
  }
  assert.ok(some > 200 && some < 340, `${style}: most stretches hold a wonder (${some} of 399)`);
}
for (const [style, list] of Object.entries(expected)) for (const k of list) assert.ok(kinds[style].has(k), `${style} never shows ${k}`);
vm.runInContext('dark = true', ctxVm);
assert.ok(Array.from({length: 300}, (_, i) => W.wonderAt('gond', i + 1)).includes('fireflies'), 'fireflies come out in the dark theme');

// Every kind draws, at many times, in every style; and the same time draws the same picture.
for (const style of Object.keys(STYLES)) for (let i = 1; i < 60; i++) {
  if (!W.wonderAt(style, i)) continue;
  for (const t of [0, 13.7, 80, 401.2]) {
    const xa = W.where(style, i, t) - 600, xb = xa + 1200;
    log = []; STYLES[style].anim(ctx, xa, xb, t); const a = log.join('|');
    log = []; STYLES[style].anim(ctx, xa, xb, t); const b = log.join('|');
    assert.ok(a.length > 40, `${style} ${W.wonderAt(style, i)} drew something at t=${t}`);
    assert.equal(a, b, `${style} ${W.wonderAt(style, i)}: same time, same picture`);
  }
}
assert.ok(caption.child && caption.child.textContent, 'a caption names what is passing');
console.log(`Art wonders PASS: 7 styles, seeded stretches never repeat back to back, ${Object.values(kinds).reduce((a, s) => a + s.size, 0)} style/kind pairs seen, every kind draws deterministically at 4 times, captions shown.`);
