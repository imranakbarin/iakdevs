// Smoke test for the Mushroom Island life layer: every draw call receives
// finite geometry across chapters, viewports and times, with no exceptions.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'mushroom-island.html'), 'utf8');
assert.match(page, /assets\/mushroom-life\.js\?v=\d+[\s\S]*assets\/mushroom-cinematic\.js/, 'life layer loads before the cinematic renderer');
const window = {};
new Function('window', fs.readFileSync(path.join(root, 'assets/mushroom-life.js'), 'utf8'))(window);
const life = window.MushroomLife;
let calls = 0;
const grad = {addColorStop(n, c) { assert.ok(n >= 0 && n <= 1); assert.equal(typeof c, 'string'); }};
const ctx = new Proxy({}, {get(_, k) {
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { assert.ok(a.every(Number.isFinite), k); return grad; };
  if (['save', 'restore', 'beginPath', 'closePath', 'fill', 'stroke'].includes(k)) return () => {};
  return (...a) => { calls++; assert.ok(a.every(v => typeof v !== 'number' || Number.isFinite(v)), k + ' finite'); if (k === 'ellipse' || k === 'arc') assert.ok(a[2] >= 0 && (k === 'arc' || a[3] >= 0), k + ' radii'); };
}, set() { return true; }});
const kinds = ['hop', 'dash', 'bounce', 'flip', 'slide', 'glide', 'vault', 'cartwheel', 'twirl', 'longjump'];
const poseAt = x => { const j = Math.floor(x / 750), p = x - j * 750, u = Math.max(0, Math.min(1, (p - 195) / 355)); return {kind: kinds[((j % 10) + 10) % 10], lift: p >= 195 && p <= 550 ? 100 * Math.sin(Math.PI * u) : 0}; };
for (const [W, H] of [[1363, 936], [390, 844], [844, 390]]) for (let i = 0; i < 160; i++) {
  const clock = i * .37, world = i * 61;
  const state = {W, H, clock, world, plate: {dx: -120, dy: -40, factor: 1.3, iw: 1172, ih: 659}, ground: H * .892, pipX: W * .34, poseAt, ready: true};
  life.back(ctx, state); life.beforePip(ctx, state); life.front(ctx, state);
}
assert.ok(calls > 1000, 'layers actually draw');
console.log('Mushroom life PASS: kingdom ambience, star seeds, companion, butterflies and petals draw finite geometry in 3 viewports.');
