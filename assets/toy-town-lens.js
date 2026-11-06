/* Toy Town lens — light finishing, sharp everywhere.
 * No depth blur and no ambient-occlusion pass (the owner found the blur
 * unwanted and the town slower with it). By day the scene renders straight to
 * the canvas — no extra full-screen passes at all; colour is graded by a cheap
 * CSS filter on the canvas. Only after dusk, when lamps, windows and festoon
 * bulbs are lit, does a composer add a half-resolution glow (bloom).
 * createLens(THREE, addons, renderer, scene, camera, {mobile}) → {render, setSize, setDusk, setFocus, stats}
 * addons = {EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass} */
export function createLens(THREE, addons, renderer, scene, camera, opts = {}) {
  const {EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass} = addons;
  const mobile = !!opts.mobile;
  const off = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('lensoff') || '').split(',');   // debugging: ?lensoff=bloom
  // A software rasteriser (SwiftShader/llvmpipe in CI, or a GPU-less machine) skips multisampling.
  const software = (() => { try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|software/i.test(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''); } catch (e) { return false; } })();
  const size = new THREE.Vector2(); renderer.getSize(size);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: mobile || software ? 0 : 4});
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  // A single overflowing specular pixel (half-float Inf/NaN) would smear into a
  // milky haze through the bloom mip chain; clamp and clean before it.
  composer.addPass(new ShaderPass({
    uniforms: {tDiffuse: {value: null}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); bvec3 bad = bvec3(c.r != c.r || c.r > 6e4, c.g != c.g || c.g > 6e4, c.b != c.b || c.b > 6e4);
        if (any(bad)) c.rgb = vec3(0.0); gl_FragColor = vec4(min(c.rgb, vec3(6.0)), 1.0); }`
  }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), .3, .55, 1.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let glowing = false;
  const api = {
    composer, bloom,
    setSize(w, h) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); },
    // dark: 0 day → 1 night. The glow (and the composer) only runs once the lamps are on.
    setDusk(dark) {
      glowing = dark > .12 && !off.includes('bloom');
      bloom.enabled = glowing; bloom.threshold = 1.7 - dark * .3; bloom.strength = dark * .38; bloom.radius = .55 + dark * .2;
    },
    setFocus() {},   // kept for the 3D view's API; there is no focus blur any more
    render() { if (glowing) composer.render(); else renderer.render(scene, camera); },
    stats: () => ({software, ao: false, bloom: glowing, tiltShift: false, composer: glowing, mobile})
  };
  api.setSize(size.x, size.y); api.setDusk(0);
  return api;
}
