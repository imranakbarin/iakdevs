// Toy Town lens: sharp everywhere and light. There is no depth blur and no
// ambient-occlusion pass; by day the scene renders straight to the canvas with
// no extra full-screen passes, and only after dusk does a composer add the
// lamp glow. The page wires it in with a ?nolens escape hatch, and the 3D view
// falls back to a plain render if the lens cannot start.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8'), view = fs.readFileSync(path.join(root, 'assets/toy-town-3d.js'), 'utf8');
const lensSrc = fs.readFileSync(path.join(root, 'assets/toy-town-lens.js'), 'utf8');
assert.match(html, /toy-town-lens\.js\?v=\d+/, 'the page loads the lens');
assert.match(html, /has\('nolens'\)/, 'and can be opened without it');
assert.doesNotMatch(html, /GTAOPass/, 'no ambient-occlusion module is downloaded');
assert.doesNotMatch(lensSrc, /new GTAOPass|tiltH|focus band|delta \* t \* r/, 'no depth blur or AO remains in the lens');
assert.match(view, /options\.createLens\?options\.createLens\(renderer,scene,camera/, 'the 3D view asks for the lens');
assert.match(view, /if\(lens\)lens\.render\(.*\);else renderer\.render\(scene,camera\)/, 'and renders plainly without one');

(async () => {
  const {createLens} = await import(path.join(root, 'assets/toy-town-lens.js'));
  const passes = [];
  class Pass { constructor(o) { this.uniforms = o && o.uniforms; this.enabled = true; } }
  class V2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
  let composed = 0, direct = 0;
  const addons = {
    EffectComposer: class { addPass(p) { passes.push(p); } setPixelRatio() {} setSize() {} render() { composed++; } },
    RenderPass: class extends Pass { constructor() { super(); this.kind = 'render'; } },
    ShaderPass: class extends Pass { constructor(s) { super(s); this.kind = 'clean'; } },
    UnrealBloomPass: class extends Pass { constructor() { super(); this.kind = 'bloom'; } },
    OutputPass: class extends Pass { constructor() { super(); this.kind = 'output'; } }
  };
  const THREE = {Vector2: V2, WebGLRenderTarget: class {}, HalfFloatType: 1};
  const renderer = {getSize: v => v.set(1280, 820), getPixelRatio: () => 2, render: () => { direct++; }};
  const lens = createLens(THREE, addons, renderer, {}, {}, {mobile: false});
  assert.equal(passes.map(p => p.kind).join(' '), 'render clean bloom output', 'dusk pipeline: scene → clean → glow → tone map');
  lens.setDusk(0); lens.render(); lens.render();
  assert.equal(direct, 2, 'by day the scene renders straight to the canvas'); assert.equal(composed, 0, 'with no composer passes');
  lens.setDusk(.8); lens.render();
  assert.equal(composed, 1, 'after dusk the glow pass runs'); assert.ok(lens.bloom.enabled && lens.bloom.strength > .3);
  assert.equal(lens.stats().tiltShift, false); assert.equal(lens.stats().ao, false);
  console.log('Toy Town LENS PASS: no blur, no AO; direct render by day, composer only for the dusk glow; plain-render fallback wired.');
})().catch(e => { console.error(e); process.exit(1); });
