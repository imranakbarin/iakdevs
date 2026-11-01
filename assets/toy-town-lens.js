/* Toy Town lens — the "photographed miniature" finish.
 * A real model photographed with a shallow lens: a sharp band through the
 * middle of the town, foreground and background melting into soft blur where
 * lamps and lit windows bloom into round bokeh; ambient occlusion seats every
 * house, tree and figure on the ground (desktop); a gentle filmic grade with
 * warm highlights, cool shadows, vignette and fine grain replaces the old
 * CSS saturate/contrast filter.
 * createLens(THREE, addons, renderer, scene, camera, {mobile}) → {render, setSize, setDusk, stats}
 * addons = {EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, GTAOPass?} */
export function createLens(THREE, addons, renderer, scene, camera, opts = {}) {
  const {EffectComposer, RenderPass, ShaderPass, UnrealBloomPass, OutputPass, GTAOPass} = addons;
  const mobile = !!opts.mobile;
  const off = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('lensoff') || '').split(',');   // debugging: ?lensoff=ao,bloom,tilt,grade
  // A software rasteriser (SwiftShader/llvmpipe in CI, or a GPU-less machine)
  // cannot afford contact shadows or multisampling: keep tilt-shift and grade only.
  const software = (() => { try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|software/i.test(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''); } catch (e) { return false; } })();
  const size = new THREE.Vector2(); renderer.getSize(size);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {type: THREE.HalfFloatType, samples: mobile || software ? 0 : 4});
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  // Contact shadows: corners, eaves, roots and feet. Desktop only, and dropped
  // automatically if the machine cannot hold the frame rate.
  let ao = null;
  if (!mobile && !software && GTAOPass && !off.includes('ao')) {
    try {
      ao = new GTAOPass(scene, camera, size.x, size.y);
      ao.updateGtaoMaterial({radius: .55, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12});
      ao.blendIntensity = .85;
      composer.addPass(ao);
    } catch (e) { ao = null; }
  }

  // A single overflowing specular pixel (half-float Inf/NaN) would smear into a
  // milky haze through the bloom mip chain; clamp and clean before it.
  composer.addPass(new ShaderPass({
    uniforms: {tDiffuse: {value: null}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); bvec3 bad = bvec3(c.r != c.r || c.r > 6e4, c.g != c.g || c.g > 6e4, c.b != c.b || c.b > 6e4);
        if (any(bad)) c.rgb = vec3(0.0); gl_FragColor = vec4(min(c.rgb, vec3(6.0)), 1.0); }`
  }));
  // Lamps, windows and festoon bulbs glow; sunlit walls do not.
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), .3, .55, 1.8);
  if (!off.includes('bloom')) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Tilt-shift: separable blur that grows with distance from a horizontal
  // focus band; bright pixels are weighted up so lights open into bokeh discs.
  const tiltShader = {
    uniforms: {tDiffuse: {value: null}, delta: {value: new THREE.Vector2()}, focus: {value: .5}, band: {value: .14}, amount: {value: 9}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 delta; uniform float focus, band, amount; varying vec2 vUv;
      void main(){
        float d = max(0.0, abs(vUv.y - focus) - band) / max(0.05, 0.5 - band);
        float r = clamp(d, 0.0, 1.0); r = r * r * amount;
        if (r < 0.35) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
        vec4 sum = vec4(0.0); float wsum = 0.0;
        for (int i = -6; i <= 6; i++) {
          float t = float(i) / 6.0;
          vec4 c = texture2D(tDiffuse, vUv + delta * t * r);
          float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          float w = 1.0 + smoothstep(0.88, 1.0, l) * 6.0 * min(1.0, r / 4.0);
          sum += c * w; wsum += w;
        }
        gl_FragColor = sum / wsum;
      }`
  };
  const tiltH = new ShaderPass(tiltShader), tiltV = new ShaderPass(tiltShader);
  if (!off.includes('tilt')) { composer.addPass(tiltH); composer.addPass(tiltV); }

  // Filmic grade in display space.
  const grade = new ShaderPass({
    uniforms: {tDiffuse: {value: null}, sat: {value: 1.34}, contrast: {value: .34}, warmth: {value: .55}, vig: {value: .55}, grain: {value: .018}, time: {value: 0}, res: {value: new THREE.Vector2(1, 1)}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float sat, contrast, warmth, vig, grain, time; uniform vec2 res; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, c * vec3(0.9, 0.99, 1.07), (1.0 - smoothstep(0.0, 0.45, l)) * warmth);
        c = mix(c, c * vec3(1.07, 1.0, 0.9), smoothstep(0.45, 1.0, l) * warmth);
        c = mix(vec3(l), c, sat);
        c = clamp(c, 0.0, 1.0); c = mix(c, c * c * (3.0 - 2.0 * c), contrast);
        vec2 q = vUv - 0.5; q.x *= res.x / res.y; c *= 1.0 - dot(q, q) * vig * 0.6;
        c += (hash(vUv * res + fract(time) * 31.0) - 0.5) * grain;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  if (!off.includes('grade')) composer.addPass(grade);

  let slow = 0, frames = 0;
  const api = {
    composer, bloom, ao, tiltH, tiltV, grade,
    setSize(w, h) {
      composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
      const pw = w * renderer.getPixelRatio(), ph = h * renderer.getPixelRatio();
      tiltH.uniforms.delta.value.set(1 / pw, 0); tiltV.uniforms.delta.value.set(0, 1 / ph);
      grade.uniforms.res.value.set(pw, ph);
      const blur = (mobile ? 6 : 10) * renderer.getPixelRatio();
      tiltH.uniforms.amount.value = tiltV.uniforms.amount.value = blur;
    },
    // dark: 0 day → 1 night. Lights glow more as the light goes.
    setDusk(dark) {
      // By day the sun's glints on the river would bloom into a milky haze, so the glow only switches on as the lamps do.
      bloom.enabled = dark > .12; bloom.threshold = 1.5 - dark * .6; bloom.strength = dark * .85; bloom.radius = .55 + dark * .2;
      grade.uniforms.warmth.value = .5 + dark * .2;
    },
    // Focus band follows the zoom: close-ups get a shallow, photographic band.
    setFocus(closeness) {
      const band = .2 - closeness * .1;
      tiltH.uniforms.band.value = tiltV.uniforms.band.value = band;
      tiltH.uniforms.focus.value = tiltV.uniforms.focus.value = .5;
    },
    render(dtMs) {
      grade.uniforms.time.value = (grade.uniforms.time.value + .37) % 1000;
      composer.render();
      // Drop the costliest pass on a struggling desktop GPU rather than stutter.
      if (ao && Number.isFinite(dtMs) && ++frames > 30) { slow = dtMs > 34 ? slow + 1 : Math.max(0, slow - 1); if (slow > 45) { ao.enabled = false; } }
    },
    stats: () => ({software, ao: !!(ao && ao.enabled), bloom: bloom.enabled, tiltShift: true, grade: true, mobile})
  };
  api.setSize(size.x, size.y); api.setDusk(0); api.setFocus(0);
  return api;
}
