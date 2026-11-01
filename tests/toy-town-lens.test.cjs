// Toy Town lens: the photographed-miniature finish. The pipeline renders the
// scene, cleans overflowing pixels before the glow, blooms only after dusk,
// blurs into a tilt-shift away from a focus band that tightens on close-ups,
// grades the result, and on phones skips ambient occlusion. The page wires it
// in with a ?nolens escape hatch, and the 3D view falls back to a plain render
// if the lens cannot start.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8'), view = fs.readFileSync(path.join(root, 'assets/toy-town-3d.js'), 'utf8');
assert.match(html, /toy-town-lens\.js\?v=\d+/, 'the page loads the lens');
assert.match(html, /has\('nolens'\)/, 'and can be opened without it');
assert.match(html, /#town-3d\.lens canvas\{filter:none\}/, 'the old CSS colour filter steps aside for the lens grade');
assert.match(view, /options\.createLens\?options\.createLens\(renderer,scene,camera/, 'the 3D view asks for the lens');
assert.match(view, /if\(lens\)lens\.render\(.*\);else renderer\.render\(scene,camera\)/, 'and renders plainly without one');
assert.match(view, /catch\(error\)\{console\.warn\('Toy Town lens unavailable/, 'a lens failure never takes the town down');

(async () => {
  const {createLens} = await import(path.join(root, 'assets/toy-town-lens.js'));
  const passes = [];
  class Pass { constructor(o) { this.o = o; this.uniforms = o && o.uniforms; this.enabled = true; } }
  class V2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
  const addons = {
    EffectComposer: class { constructor() {} addPass(p) { passes.push(p); } setPixelRatio() {} setSize() {} render() { this.rendered = (this.rendered || 0) + 1; } },
    RenderPass: class extends Pass { constructor() { super(); this.kind = 'render'; } },
    ShaderPass: class extends Pass { constructor(s) { super(s); this.kind = 'shader'; this.uniforms = s.uniforms; } },
    UnrealBloomPass: class extends Pass { constructor() { super(); this.kind = 'bloom'; } },
    OutputPass: class extends Pass { constructor() { super(); this.kind = 'output'; } },
    GTAOPass: class extends Pass { constructor() { super(); this.kind = 'ao'; } updateGtaoMaterial(o) { this.ao = o; } }
  };
  const THREE = {Vector2: V2, WebGLRenderTarget: class {}, HalfFloatType: 1};
  const renderer = {getSize: v => v.set(1280, 820), getPixelRatio: () => 2};
  const lens = createLens(THREE, addons, renderer, {}, {}, {mobile: false});
  const kinds = passes.map(p => p.kind === 'shader' ? (p.uniforms.focus ? 'tilt' : p.uniforms.sat ? 'grade' : 'clean') : p.kind);
  assert.equal(kinds.join(' '), 'render ao clean bloom output tilt tilt grade', 'scene → contact shadows → clean → glow → tone map → tilt-shift → grade');
  lens.setDusk(0); assert.equal(lens.bloom.enabled, false, 'no glow by day (the river glints would haze)');
  lens.setDusk(.8); assert.ok(lens.bloom.enabled && lens.bloom.strength > .5, 'lamps glow after dusk');
  lens.setFocus(0); const wide = lens.tiltH.uniforms.band.value; lens.setFocus(1);
  assert.ok(lens.tiltH.uniforms.band.value < wide, 'close-ups get a shallower focus band');
  lens.setSize(390, 844); assert.equal(lens.tiltV.uniforms.delta.value.y, 1 / (844 * 2), 'blur steps are one device pixel');
  lens.render(16); assert.equal(lens.composer.rendered, 1);
  passes.length = 0; createLens(THREE, addons, renderer, {}, {}, {mobile: true});
  assert.ok(!passes.some(p => p.kind === 'ao'), 'phones skip ambient occlusion');
  passes.length = 0; const sw = createLens(THREE, addons, Object.assign({}, renderer, {getContext: () => ({getExtension: () => ({UNMASKED_RENDERER_WEBGL: 1}), getParameter: () => 'ANGLE (Google, SwiftShader Device)'})}), {}, {}, {mobile: false});
  assert.ok(sw.stats().software && !passes.some(p => p.kind === 'ao'), 'a software rasteriser skips ambient occlusion too');
  console.log('Toy Town LENS PASS: render → AO → clean → bloom (dusk only) → output → tilt-shift → grade; focus band follows zoom; phones and software GL skip AO; plain-render fallback wired.');
})().catch(e => { console.error(e); process.exit(1); });
