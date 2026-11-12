// New Toy Town: weather you can believe in. Rain (long streaks at different depths, slanted by the wind, with splash rings on the ground and in the puddles),
// puddles (soft irregular patches that mirror the sky), snow (big soft flakes that swirl) and leaves and petals (flat quads that tumble). All of them are drawn
// in a box that follows the camera, so they cost the same however big the town is. `update(time, amount, wind)` is called every frame.
import * as THREE from 'three';
import {heightAt, shore, BUILDINGS, rand} from './def.mjs';
import {along, leftOf} from './graph.mjs';

const TAU = Math.PI * 2;
let softTex = null, puddleTex = null;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function soft() {
  if (softTex || typeof document === 'undefined') return softTex;
  const c = canvas(32, 32), g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return softTex = new THREE.CanvasTexture(c);
}
// a puddle: an irregular blob with a soft edge, a lighter middle (sky showing) and a darker rim (wet ground)
function puddleMap() {
  if (puddleTex || typeof document === 'undefined') return puddleTex;
  const c = canvas(128, 128), g = c.getContext('2d'); g.translate(64, 64);
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, r = 24 + rand(k + 91) * 14, x = Math.cos(a) * 14 * rand(k + 5), y = Math.sin(a) * 10 * rand(k + 7); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.7, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  return puddleTex = new THREE.CanvasTexture(c);
}

/* ---- rain: 1700 streaks in two depths, slanted with the wind ---- */
export function buildRain() {
  const N = 1700, X = 44, Z = 34, Y = 18, pos = new Float32Array(N * 6), seeds = Array.from({length: N}, (_, k) => ({x: (rand(k * 5 + 1) - .5) * X, y: rand(k * 5 + 2) * Y, z: (rand(k * 5 + 3) - .5) * Z, v: 17 + rand(k * 5 + 4) * 9, l: .35 + rand(k * 5 + 5) * .55}));
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({color: '#cfe4f3', transparent: true, opacity: 0, depthWrite: false, fog: false}), lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.visible = false;
  lines.userData.update = (time, amount, wind = {x: .6, z: .2}) => {
    const n = Math.floor(N * amount); geo.setDrawRange(0, n * 2); mat.opacity = Math.min(.5, .12 + amount * .42); lines.visible = n > 8; if (!lines.visible) return;
    const sx = (wind.x || 0) * .22, sz = (wind.z || 0) * .22;
    for (let k = 0; k < n; k++) { const s = seeds[k], y = Y - ((s.y + time * s.v) % Y), x = s.x + (Y - y) * sx, z = s.z + (Y - y) * sz; pos.set([x, y, z, x - sx * s.l, y + s.l, z - sz * s.l], k * 6); }
    geo.attributes.position.needsUpdate = true;
  };
  return lines;
}

/* ---- splash rings on the ground (and in the puddles) where the drops land ---- */
export function buildSplashes(puddleSpots = [], max = 110) {
  const mesh = new THREE.InstancedMesh(new THREE.RingGeometry(.05, .075, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#e8f3fb', transparent: true, opacity: .75, depthWrite: false, fog: false}), max), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  mesh.frustumCulled = false; mesh.visible = false; const life = 0.55, slots = Array.from({length: max}, (_, i) => ({x: 0, z: 0, t: -rand(i + 1) * life, seed: i}));
  mesh.userData.update = (time, amount, cx, cz, dt) => {
    const n = Math.floor(max * amount); mesh.count = n; mesh.visible = n > 4; if (!mesh.visible) return;
    for (let i = 0; i < n; i++) { const o = slots[i]; o.t += dt; if (o.t > life || o.t < 0 && o.t < -life) { o.seed += max; o.t = 0; const r1 = rand(o.seed * 3 + 1), r2 = rand(o.seed * 3 + 2), r3 = rand(o.seed * 3 + 3);
        if (puddleSpots.length && r3 < .45) { const sp = puddleSpots[Math.floor(rand(o.seed + 7) * puddleSpots.length)]; o.x = sp.x + (r1 - .5) * sp.w; o.z = sp.z + (r2 - .5) * sp.d; } else { o.x = cx + (r1 - .5) * 26; o.z = cz + (r2 - .5) * 18; } }
      const k = Math.max(0, o.t) / life, sc = o.t < 0 ? .001 : .6 + k * 2.4 * (1 - k * .3); mesh.setMatrixAt(i, m.compose(p.set(o.x, heightAt(o.x, o.z) + .07, o.z), q, s.set(sc, 1, sc))); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

/* ---- puddles: soft irregular patches along the roads that mirror the sky, filling in the rain and drying slowly after ---- */
export function buildPuddles(graph) {
  const N = 60, total = graph.edges.reduce((n, e) => n + e.line.length, 0), spots = [];
  for (let k = 0; k < N; k++) {
    let t = rand(k * 7 + 1) * total, e = graph.edges[0]; for (const ed of graph.edges) { if (t < ed.line.length) { e = ed; break; } t -= ed.line.length; }
    const q = along(e.line, t), [lx, lz] = leftOf(q.tx, q.tz), lat = (rand(k * 7 + 2) - .5) * (rand(k * 7 + 3) < .65 ? .7 : 2.2), x = q.x + lx * lat, z = q.z + lz * lat;
    if (BUILDINGS.some(b => Math.hypot(b.x - x, b.z - z) < 1.05) || shore(x, z) > .85) continue;
    spots.push({x, z, a: Math.atan2(q.tx, q.tz) + (rand(k * 7 + 8) - .5) * .8, w: .3 + rand(k * 7 + 4) * .4, d: .2 + rand(k * 7 + 5) * .25, thr: .04 + rand(k * 7 + 6) * .55});
  }
  const mat = new THREE.MeshBasicMaterial({color: '#8fa9b8', map: puddleMap(), transparent: true, opacity: .9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true});
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), mat, spots.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false; let last = -1;
  mesh.userData.spots = spots;
  mesh.userData.set = wet => {
    if (Math.abs(wet - last) < .01) return; last = wet; mesh.visible = wet > .04 && spots.length > 0;
    spots.forEach((p, i) => { const f = Math.max(0, Math.min(1, (wet - p.thr) / .3)); q.setFromAxisAngle(up, p.a); pos.set(p.x, heightAt(p.x, p.z) + .045, p.z); sc.set(Math.max(.001, p.w * f), 1, Math.max(.001, p.d * f)); m.compose(pos, q, sc); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true;
  };
  mesh.userData.tint = (sky, wet) => { mat.color.set(sky).lerp(new THREE.Color('#566d7c'), .35); mat.opacity = .55 + .35 * Math.min(1, wet * 1.4); };   // the puddle takes the colour of the sky above it
  return mesh;
}

/* ---- snow: soft flakes of three sizes that swirl as they fall ---- */
function snow() {
  const N = 1500, X = 40, Z = 30, Y = 14, pos = new Float32Array(N * 3), size = new Float32Array(N), seeds = Array.from({length: N}, (_, k) => [(rand(k * 4 + 1) - .5) * X, rand(k * 4 + 2) * Y, (rand(k * 4 + 3) - .5) * Z, rand(k * 4 + 4) * TAU, .6 + rand(k + 77) * .8]);
  for (let k = 0; k < N; k++) size[k] = k % 3 === 0 ? 13 : k % 3 === 1 ? 8 : 5;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {map: {value: soft()}, opacity: {value: 0}, px: {value: 1}},
    vertexShader: 'attribute float size; uniform float px; void main(){ gl_PointSize = size * px; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float opacity; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(1.0, 1.0, 1.0, t.a * opacity); }'});
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false;
  pts.userData.update = (time, amount, wind = {x: .3, z: .1}) => {
    const n = Math.floor(N * amount); geo.setDrawRange(0, n); pts.visible = n > 3; if (!pts.visible) return; mat.uniforms.opacity.value = .92; mat.uniforms.px.value = Math.min(2, (window.devicePixelRatio || 1));
    for (let k = 0; k < n; k++) { const s = seeds[k], fall = 1.1 + s[4] * .9, y = Y - ((s[1] + time * fall) % Y), a = time * (.5 + s[4] * .4) + s[3]; pos.set([s[0] + Math.sin(a) * .5 + (Y - y) * (wind.x || 0) * .06, y, s[2] + Math.cos(a * .8) * .4 + (Y - y) * (wind.z || 0) * .06], k * 3); }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

/* ---- leaves (autumn) and petals (spring): flat quads that tumble as they fall ---- */
function leaves(season) {
  const N = season === 'spring' ? 150 : 220, X = 34, Z = 26, Y = 12, autumn = season === 'autumn', cols = autumn ? ['#e58a2c', '#d9532b', '#e8b83a', '#b5551f', '#c98a2b'] : ['#ffc6dc', '#ffffff', '#f7a8c8', '#ffd9e8'];
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(autumn ? .3 : .13, autumn ? .22 : .1), new THREE.MeshBasicMaterial({color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: .95, depthWrite: false, fog: false}), N), c = new THREE.Color();
  for (let k = 0; k < N; k++) mesh.setColorAt(k, c.set(cols[k % cols.length]));
  const seeds = Array.from({length: N}, (_, k) => [(rand(k * 4 + 1) - .5) * X, rand(k * 4 + 2) * Y, (rand(k * 4 + 3) - .5) * Z, rand(k * 4 + 4) * TAU, .5 + rand(k + 31)]), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  mesh.frustumCulled = false; mesh.visible = false;
  mesh.userData.update = (time, amount, wind = {x: .5, z: .2}) => {
    const n = Math.floor(N * amount); mesh.count = n; mesh.visible = n > 2; if (!mesh.visible) return;
    for (let k = 0; k < n; k++) { const o = seeds[k], fall = (autumn ? .75 : .55) * (.6 + o[4] * .6), y = Y - ((o[1] + time * fall) % Y), a = time * (1.1 + o[4]) + o[3], drift = (Y - y) * .35;
      p.set(o[0] + Math.sin(a * .7) * .9 + (wind.x || 0) * drift, y, o[2] + Math.cos(a * .6) * .7 + (wind.z || 0) * drift); e.set(Math.sin(a * 1.3) * 1.1 + 1.2, a * 1.5, Math.cos(a) * .9); q.setFromEuler(e); mesh.setMatrixAt(k, m.compose(p, q, s)); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}
// whatever falls in this season (null in summer, where the fireflies of build.mjs stay)
export function buildFallingThings(season) { return season === 'winter' ? snow() : season === 'autumn' || season === 'spring' ? leaves(season) : null; }
