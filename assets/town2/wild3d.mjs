// New Toy Town: the builders for the living nature: pets, hens, dolphins and whales, the gardens, the hen yard, the dwarfs' islet and cave,
// wild flowers and butterflies. Everything static is drawn into one bag (one mesh); animals are one small mesh each, built facing +z.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Bag, U} from './build.mjs';
import {along} from './graph.mjs';
import {ISLAND, POND, NODES, heightAt, shore, rand, BUILDINGS, PIER} from './def.mjs';
import {PLOTS, BLOOM, inGarden} from './garden.mjs';
import {ISLET, ground} from './wildlife.mjs';

const TAU = Math.PI * 2;
const coneCache = new Map();
const cone2 = (b, r, h, colour, o = {}) => { const key = r + ':' + h + ':' + (o.seg || 8); if (!coneCache.has(key)) { const g = new THREE.ConeGeometry(r, h, o.seg || 8).toNonIndexed(); g.deleteAttribute('uv'); coneCache.set(key, g); } return b.add(coneCache.get(key), colour, o); };   // a cone turned about its own centre (pointing +y, then rotated)
const polyCache = new Map();
// low-poly buds and mounds: an octahedron (8 triangles) or a flattened icosahedron (20) instead of a smooth sphere (48 and up): faceted like the rocks, and far cheaper
const poly = (b, kind, r, colour, o = {}) => { const key = kind + r; if (!polyCache.has(key)) { const g = (kind === 'oct' ? new THREE.OctahedronGeometry(r, 0) : new THREE.IcosahedronGeometry(r, 0)).toNonIndexed(); g.deleteAttribute('uv'); polyCache.set(key, g); } return b.add(polyCache.get(key), colour, o); };
const finish = (b, material, scale) => { const m = b.mesh(material); m.castShadow = false; const g = new THREE.Group(); g.add(m); g.scale.setScalar(scale); return g; };

/* ---------------- pets ---------------- */
const DOG = {brown: ['#a8723f', '#d9b98a', '#6d4524'], spotted: ['#fff6e6', '#ffffff', '#b5742f'], grey: ['#8e98a3', '#d5dbe0', '#5d6670']};
const CAT = {ginger: ['#e08a3c', '#f6d9b0'], grey: ['#8d96a0', '#dfe4e8'], tabby: ['#9a7650', '#d8c4a2'], black: ['#33363d', '#8a8f98']};
export function buildPet(kind, coat, material) {
  const b = new Bag();
  if (kind === 'dog') {
    const [c, l, d] = DOG[coat] || DOG.brown;
    b.sph(.075, c, {y: .15, sx: .92, sy: .86, sz: 1.55}); b.sph(.058, l, {y: .125, z: .06, sx: .9, sy: .7, sz: 1.2});
    if (coat === 'spotted') { b.sph(.05, d, {x: .045, y: .185, z: -.02, sx: .5, sy: .45, sz: .7}); b.sph(.045, d, {x: -.04, y: .17, z: .08, sx: .5, sy: .45, sz: .6}); }
    for (const sx of [-1, 1]) for (const z of [-.075, .08]) { b.cyl(.019, .016, .1, c, {x: sx * .04, z, seg: 6}); b.sph(.022, l, {x: sx * .04, y: .006, z: z + .008, sz: 1.3, seg: 6}); }
    b.sph(.06, c, {y: .23, z: .13, seg: 10}); b.sph(.034, l, {y: .215, z: .185, sz: 1.2, seg: 8}); b.sph(.014, '#222', {y: .226, z: .22, seg: 6});
    for (const sx of [-1, 1]) { b.sph(.011, '#111', {x: sx * .03, y: .245, z: .17, seg: 5}); b.sph(.028, d, {x: sx * .052, y: .235, z: .115, sx: .45, sy: 1.15, sz: .8, rz: sx * .35, seg: 6}); }
    cone2(b, .016, .1, c, {y: .2, z: -.13, rx: -1.0, seg: 5});
    b.cyl(.018, .018, .02, '#d94a3a', {y: .195, z: .1, seg: 8});   // a red collar
    return finish(b, material, 1.4);
  }
  const [c, l] = CAT[coat] || CAT.ginger;   // cat
  b.sph(.058, c, {y: .1, sx: .85, sy: .85, sz: 1.7}); b.sph(.045, l, {y: .085, z: .05, sx: .85, sy: .7, sz: 1.2});
  for (const sx of [-1, 1]) for (const z of [-.055, .06]) b.cyl(.013, .012, .07, c, {x: sx * .03, z, seg: 6});
  b.sph(.046, c, {y: .15, z: .1, seg: 10}); b.sph(.022, l, {y: .14, z: .138, sx: 1.1, seg: 6}); b.sph(.008, '#e88', {y: .146, z: .157, seg: 5});
  for (const sx of [-1, 1]) { cone2(b, .017, .04, c, {x: sx * .026, y: .2, z: .09, seg: 4}); b.sph(.01, '#7fdc6a', {x: sx * .02, y: .16, z: .138, seg: 5}); }
  b.tube([[0, .1, -.1], [0, .13, -.17], [0, .2, -.19], [0, .26, -.15]], .011, c);
  if (coat === 'tabby') for (const z of [-.04, .0, .04]) b.box(.11, .01, .012, '#5d4630', {y: .152, z, r: .003});
  if (coat === 'ginger' || coat === 'grey') b.sph(.02, '#ffffff', {y: .06, z: .12, sx: 1.2, seg: 5});
  return finish(b, material, 1.35);
}

/* ---------------- hens ---------------- */
const HEN = {brown: ['#b5742f', '#d89a55', '#7d4a1d'], white: ['#fffaf0', '#ffffff', '#e4d9c0'], speckled: ['#8a7a68', '#b4a590', '#5a4d40'], gold: ['#e0b040', '#f2d680', '#b8862a'], red: ['#a83a22', '#d86a38', '#2d6a4a']};
export function buildHen(kind, coat, material) {
  const b = new Bag(), [c, l, d] = HEN[coat] || HEN.brown, big = kind === 'rooster', s = big ? 1.6 : 1.25;
  b.sph(.058, c, {y: .1, sx: .9, sy: .92, sz: 1.2}); b.sph(.046, l, {y: .1, z: .042, seg: 8});
  for (const sx of [-1, 1]) b.sph(.04, d, {x: sx * .05, y: .11, z: -.012, sx: .35, sy: .75, sz: 1.15, seg: 6});
  b.sph(.03, c, {y: .185 + (big ? .02 : 0), z: .07, seg: 8}); b.sph(.011, '#d92b2b', {y: .22 + (big ? .02 : 0), z: .068, sx: .6, sy: 1.4, seg: 5});
  cone2(b, .011, .035, '#f2a33a', {y: .18 + (big ? .02 : 0), z: .1, rx: Math.PI / 2, seg: 5}); b.sph(.009, '#d92b2b', {y: .16 + (big ? .02 : 0), z: .088, seg: 4}); b.sph(.006, '#111', {x: .02, y: .19 + (big ? .02 : 0), z: .082, seg: 4}); b.sph(.006, '#111', {x: -.02, y: .19 + (big ? .02 : 0), z: .082, seg: 4});
  if (big) { [[-.25, '#2d6a4a'], [0, '#d94a2b'], [.25, '#f2a33a']].forEach(([a, k]) => cone2(b, .02, .13, k, {y: .18, z: -.09, rx: -.9, rz: a, seg: 5})); }
  else cone2(b, .03, .08, d, {y: .14, z: -.07, rx: -.8, seg: 5});
  if (coat === 'speckled') for (let k = 0; k < 6; k++) b.sph(.009, '#ffffff', {x: (rand(k + 3) - .5) * .09, y: .11 + rand(k + 5) * .05, z: (rand(k + 7) - .5) * .08, seg: 4});
  for (const sx of [-1, 1]) b.cyl(.006, .006, .055, '#f2a33a', {x: sx * .02, z: .0, seg: 4});
  return finish(b, material, s);
}
export function buildChick(material) { const b = new Bag(); b.sph(.03, '#ffe066', {y: .04, seg: 8}); b.sph(.02, '#ffe066', {y: .075, z: .025, seg: 8}); cone2(b, .007, .016, '#f2a33a', {y: .075, z: .045, rx: Math.PI / 2, seg: 4}); return finish(b, material, 1); }

/* ---------------- sea creatures ---------------- */
export function buildDolphin(material) {
  const b = new Bag(), g1 = '#7b9db9', g2 = '#9fbdd2', wh = '#eef6fa';
  b.sph(.17, g1, {sx: .9, sy: .85, sz: 3.1}); b.sph(.15, wh, {y: -.05, sx: .85, sy: .6, sz: 2.8}); b.sph(.1, g2, {y: .035, z: .4, sx: .95, sz: 1.2});
  cone2(b, .05, .28, g1, {y: -.01, z: .66, rx: Math.PI / 2, seg: 8}); b.sph(.065, g1, {z: -.52, y: .0, sx: .7, sy: .9, sz: 2});
  cone2(b, .075, .24, g1, {y: .2, z: -.02, rx: -.55, seg: 6});
  for (const sx of [-1, 1]) { cone2(b, .05, .22, g1, {x: sx * .16, y: -.07, z: .16, rz: -sx * 1.25, rx: .15, seg: 5}); b.sph(.1, g1, {x: sx * .1, y: -.01, z: -.76, sy: .12, sz: .55, sx: 1.25, ry: -sx * .45}); b.sph(.016, '#111', {x: sx * .12, y: .04, z: .32, seg: 5}); }
  return finish(b, material, 1);
}
export function buildWhale(material) {
  const b = new Bag(), g1 = '#34495e', g2 = '#4b6378', wh = '#dbe6ec';
  b.sph(.55, g1, {sx: .9, sy: .82, sz: 3.2}); b.sph(.5, wh, {y: -.16, sx: .86, sy: .55, sz: 2.9}); b.sph(.32, g2, {y: .1, z: 1.0, sx: 1, sz: 1.2});
  b.sph(.14, g2, {y: .42, z: -.5, sz: 1.7, sx: .8}); for (let k = 0; k < 7; k++) b.sph(.045, '#cfd8dc', {x: (rand(k + 21) - .5) * .5, y: .08 + rand(k + 22) * .25, z: 1.1 + rand(k + 23) * .5, seg: 5});
  b.sph(.3, g1, {z: -1.55, sx: .7, sy: .8, sz: 1.9});
  for (const sx of [-1, 1]) { cone2(b, .11, .95, g1, {x: sx * .52, y: -.3, z: .55, rz: -sx * 1.15, rx: .35, seg: 6}); b.sph(.45, g1, {x: sx * .42, y: .0, z: -2.1, sy: .12, sz: .6, sx: 1.2, ry: -sx * .38}); b.sph(.03, '#111', {x: sx * .42, y: .12, z: .95, seg: 5}); }
  return finish(b, material, 1);
}

// Spouts and splashes: a pool of small white drops, instanced. `set(i, x, y, z, s)` places one, `show(n)` shows the first n.
export function buildDrops(max = 48) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshLambertMaterial({color: '#ffffff', transparent: true, opacity: .88, depthWrite: false}), max), m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  mesh.frustumCulled = false; mesh.count = 0;
  mesh.userData.set = (i, x, y, z, s) => mesh.setMatrixAt(i, m.compose(p.set(x, y, z), q, sc.set(s, s, s)));
  mesh.userData.show = n => { mesh.count = Math.min(max, n); mesh.instanceMatrix.needsUpdate = true; mesh.visible = n > 0; };
  return mesh;
}

/* ---------------- butterflies ---------------- */
export function buildButterflies(n = 14) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .07, 0, .05, .06, 0, -.045, 0, 0, 0, -.06, 0, -.045, -.07, 0, .05], 3)); g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({color: '#ffffff', side: THREE.DoubleSide}), mesh = new THREE.InstancedMesh(g, mat, n), c = new THREE.Color();
  const cols = ['#f7c93e', '#ffffff', '#f59ac1', '#f28b3c', '#9a7fe0', '#6fcdea']; for (let i = 0; i < n; i++) mesh.setColorAt(i, c.set(cols[i % cols.length]));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  mesh.frustumCulled = false;
  // x, y, z, heading and the flap phase (the wings fold up and down)
  mesh.userData.set = (i, x, y, z, hd, ph) => { const f = .35 + Math.abs(Math.sin(ph)) * .75; mesh.setMatrixAt(i, m.compose(p.set(x, y, z), q.setFromEuler(e.set(0, hd, 0)), sc.set(f, 1 + (1 - f) * .2, 1))); };
  mesh.userData.show = k => { mesh.count = Math.min(n, k | 0); mesh.instanceMatrix.needsUpdate = true; mesh.visible = mesh.count > 0; };
  return mesh;
}

/* ---------------- wild flowers: one instanced mesh of little heads sprinkled over the grass between the garden and the shore ---------------- */
export function buildMeadow(season, max = 800) {
  const geo = new THREE.OctahedronGeometry(.045, 0).scale(1, .75, 1).translate(0, .08, 0), mat = new THREE.MeshLambertMaterial({color: '#ffffff'});
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time; sh.uniforms.uWind = U.wind; sh.uniforms.uSway = U.sway;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uSway; uniform vec2 uWind;').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float ph = uTime * 2.3 + instanceMatrix[3].x * 1.4 + instanceMatrix[3].z * 1.2; transformed.xz += (uWind * (.6 + .4 * sin(ph)) * (.4 + uSway)) * position.y * .7; }');
  };
  mat.customProgramCacheKey = () => 'toymeadow1';
  const mesh = new THREE.InstancedMesh(geo, mat, max), pal = BLOOM[season].meadow.map(c => new THREE.Color(c)), gr = ground(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  let n = 0;
  for (let k = 0; n < max && k < max * 14; k++) {
    // clustered in drifts: pick a drift centre, then a point near it
    const d = Math.floor(rand(k * 3 + 1) * 90), a = rand(d * 5 + 2) * TAU, r = .45 + rand(d * 5 + 3) * .36, [cx, cz] = [Math.cos(a) * ISLAND.rx * r, Math.sin(a) * ISLAND.rz * r];
    const x = cx + (rand(k * 3 + 4) - .5) * 2.4, z = cz + (rand(k * 3 + 5) - .5) * 2.0, sh = shore(x, z);
    if (sh < .5 || sh > .84 || !gr.free(x, z) || inGarden(x, z, .3) || BUILDINGS.some(b => Math.hypot(b.x - x, b.z - z) < b.w * .5 + .7)) continue;
    const s = .7 + rand(k * 3 + 6) * .6; mesh.setMatrixAt(n, m.compose(p.set(x, heightAt(x, z), z), q.setFromEuler(e.set(0, rand(k) * TAU, 0)), sc.set(s, s * (.8 + rand(k + 9) * .6), s)));
    mesh.setColorAt(n, c.copy(pal[Math.floor(rand(k * 3 + 7) * pal.length)]).offsetHSL(0, 0, (rand(k + 11) - .5) * .06)); n++;
  }
  mesh.userData.total = n; mesh.count = n; mesh.frustumCulled = false; mesh.userData.show = k => { mesh.count = Math.min(n, Math.max(0, k | 0)); mesh.visible = mesh.count > 0; };
  return mesh;
}

/* ---------------- the gardens ---------------- */
const flower = (b, x, y, z, colour, h = .16, r = .035, o = {}) => { b.cyl(.006, .008, h, 'leaf', {x, y, z, seg: 4, sway: .9}); poly(b, 'oct', r * 1.15, colour, {x, y: y + h, z, sy: .8, sway: .9}); if (o.petals) for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; poly(b, 'oct', r * .7, colour, {x: x + Math.cos(a) * r * 1.2, y: y + h, z: z + Math.sin(a) * r * 1.2, sy: .5, sway: .9}); } };
const bush = (b, x, y, z, r, colour = 'leaf') => poly(b, 'ico', r * 1.1, colour, {x, y: y + r * .6, z, sy: .8, sway: .5});
const ring = (b, p, y0, r, gapAt, colour = 'stone') => { const n = Math.round(r * TAU / .2); for (let k = 0; k < n; k++) { const a = k / n * TAU; if (Math.abs(Math.atan2(Math.sin(a - gapAt), Math.cos(a - gapAt))) < .3) continue; const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; b.box(.11 + (k % 3) * .02, .06, .08, k % 3 ? colour : '#cbbfa8', {x, y: heightAt(x, z), z, ry: a + k, r: .01}); } };
export function buildGardens(season, material) {
  const b = new Bag(), glass = [], bloom = BLOOM[season], winter = season === 'winter', S = winter ? .5 : 1;
  for (const p of PLOTS) {
    const y = heightAt(p.x, p.z) + .01, r = p.r, R = k => rand(p.seed * 17 + k), pick = (cs, k) => cs[Math.floor(R(k) * cs.length)], cs = bloom[p.kind] || bloom.meadow;
    const gap = Math.atan2(-p.z, -p.x);   // the opening of the border faces the middle of the town
    if (p.kind !== 'coop') {
      b.cyl(r, r + .03, .035, winter ? '#ece8e0' : '#6e4c32', {x: p.x, y, z: p.z, seg: 28}); ring(b, p, y, r, gap);
      if (p.kind !== 'greenhouse' && p.kind !== 'allotment') for (let k = 0, m = Math.round(r * r * 15); k < m; k++) { const a = R(k + 200) * TAU, rr = Math.sqrt(R(k + 300)) * r * .93; poly(b, 'ico', .09 + R(k + 400) * .05, winter ? (k % 2 ? '#dfe9ee' : '#9fb4a8') : k % 3 ? 'leaf' : 'leafLight', {x: p.x + Math.cos(a) * rr, y: y + .035, z: p.z + Math.sin(a) * rr, sy: .6, sway: .4}); }
    }
    if (p.kind === 'roses') {
      for (let k = 0; k < 11; k++) { const a = k / 11 * TAU + .3, rr = r * (k % 2 ? .38 : .68), x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr; bush(b, x, y, z, .17 * S + .05); if (!winter) for (let f = 0; f < 6; f++) poly(b, 'oct', .042, pick(cs, k * 4 + f), {x: x + (R(k + f) - .5) * .22, y: y + .2 + R(k * 3 + f) * .1, z: z + (R(k + f + 9) - .5) * .22, sway: .6}); }
      for (const sx of [-1, 1]) { b.cyl(.02, .02, .55, 'white', {x: p.x + sx * .33, y, z: p.z, seg: 6}); } b.tube([[p.x - .33, y + .55, p.z], [p.x - .16, y + .72, p.z], [p.x + .16, y + .72, p.z], [p.x + .33, y + .55, p.z]], .018, 'white');
      if (!winter) for (let k = 0; k < 7; k++) b.sph(.03, pick(cs, k + 40), {x: p.x + (k - 3) * .1, y: y + .7 + Math.abs(k - 3) * -.03 + .02, z: p.z + (R(k) - .5) * .05, seg: 6});
    } else if (p.kind === 'tulips') {
      for (let row = -4; row <= 4; row++) for (let k = -6; k <= 6; k++) { const x = p.x + k * .14, z = p.z + row * .14; if (Math.hypot(x - p.x, z - p.z) > r * .86) continue; if (winter) { b.sph(.03, 'white', {x, y: y + .03, z, sy: .6, seg: 5}); continue; } b.cyl(.006, .008, .13, 'leaf', {x, y, z, seg: 4, sway: .9}); cone2(b, .04, .07, cs[(row + 4) % cs.length], {x, y: y + .17, z, rx: Math.PI, seg: 6, sway: .9}); }
    } else if (p.kind === 'lavender') {
      for (let row = -4; row <= 4; row++) for (let k = -6; k <= 6; k++) { const x = p.x + k * .13, z = p.z + row * .16 + Math.sin(k * .5) * .05; if (Math.hypot(x - p.x, z - p.z) > r * .86) continue; bush(b, x, y, z, .075 + R(row * 9 + k + 20) * .02, winter ? '#9fb4a8' : 'leaf'); if (!winter) cone2(b, .035, .18, pick(cs, row * 9 + k + 60), {x, y: y + .2, z, seg: 5, sway: .9}); }
    } else if (p.kind === 'sunflowers') {
      for (let k = 0; k < 15; k++) { const a = k * 2.4 + R(1), rr = Math.sqrt((k + .5) / 15) * r * .8, x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, h = (.38 + R(k + 5) * .18) * S; b.cyl(.012, .018, h, 'leaf', {x, y, z, seg: 5, sway: .8}); b.cyl(.075 * S + .02, .075 * S + .02, .02, winter ? '#d8e4f2' : pick(cs, k), {x, y: y + h, z, rx: .5, seg: 12, sway: 1}); b.sph(.045 * S + .01, '#6b4423', {x, y: y + h + .01, z: z + .012, seg: 8, sway: 1}); }
    } else if (p.kind === 'allotment') {
      for (const dz of [-.42, .0, .42]) { const z0 = p.z + dz; b.box(r * 1.2, .09, .3, '#8a5a3c', {x: p.x - r * .05, y, z: z0, r: .02}); b.box(r * 1.15, .03, .24, '#4a3324', {x: p.x - r * .05, y: y + .09, z: z0}); for (let k = 0; k < 5; k++) { const x = p.x - r * .5 + k * r * .23; if (winter) b.sph(.05, 'white', {x, y: y + .11, z: z0, sy: .5, seg: 6}); else if ((k + dz * 3) % 2 > .5) bush(b, x, y + .08, z0, .075, k % 2 ? 'lime' : 'leaf'); else cone2(b, .03, .1, 'leaf', {x, y: y + .17, z: z0, seg: 5, sway: .6}); } }
      b.cyl(.012, .012, .5, 'wood', {x: p.x + r * .6, y, z: p.z, seg: 5}); b.box(.3, .02, .02, 'wood', {x: p.x + r * .6, y: y + .36, z: p.z}); b.sph(.05, '#e8d29a', {x: p.x + r * .6, y: y + .52, z: p.z, seg: 8}); cone2(b, .075, .08, '#8a5a3c', {x: p.x + r * .6, y: y + .6, z: p.z, seg: 8});
      if (season === 'autumn') for (let k = 0; k < 4; k++) b.sph(.07, '#f28b3c', {x: p.x - r * .5 + k * .3, y: y + .12, z: p.z + .62, sy: .8, seg: 8});
    } else if (p.kind === 'herbs') {
      for (let ring_ = 0; ring_ < 3; ring_++) for (let k = 0; k < 4 + ring_ * 3; k++) { const a = k / (4 + ring_ * 3) * TAU + ring_, rr = (.25 + ring_ * .25) * r * 1.1, x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr; bush(b, x, y + ring_ * .025, z, .06 + (2 - ring_) * .015, ['leaf', 'lime', 'leafLight'][(k + ring_) % 3]); if (!winter && k % 3 === 0) b.sph(.018, pick(cs, k + ring_ * 5), {x, y: y + .13 + ring_ * .03, z, seg: 5}); }
      b.cyl(.04, .05, .1, 'stone', {x: p.x, y, z: p.z, seg: 10}); b.cyl(.08, .08, .02, 'stone', {x: p.x, y: y + .1, z: p.z, seg: 12});
    } else if (p.kind === 'meadow') {
      for (let k = 0; k < 60; k++) { const a = R(k) * TAU, rr = Math.sqrt(R(k + 30)) * r * .88; if (winter) { if (k % 3 === 0) b.sph(.03, 'white', {x: p.x + Math.cos(a) * rr, y: y + .03, z: p.z + Math.sin(a) * rr, sy: .6, seg: 5}); continue; } flower(b, p.x + Math.cos(a) * rr, y, p.z + Math.sin(a) * rr, pick(cs, k + 70), .1 + R(k + 50) * .12, .028 + R(k + 60) * .012, {petals: k % 4 === 0}); }
      for (const [dx, dz] of [[-.35, -.25], [-.18, -.3]]) { b.box(.17, .12, .17, 'white', {x: p.x + dx, y, z: p.z + dz, r: .02}); b.box(.17, .1, .17, 'white', {x: p.x + dx, y: y + .12, z: p.z + dz, r: .02}); b.box(.19, .03, .19, 'gold', {x: p.x + dx, y: y + .22, z: p.z + dz, r: .01}); b.box(.05, .03, .02, 'black', {x: p.x + dx, y: y + .06, z: p.z + dz + .09}); }
    } else if (p.kind === 'greenhouse') {
      const w = r * 1.05, d = r * .85, h = .42, hh = .28;
      b.box(w, .06, d, 'stone', {x: p.x, y, z: p.z, r: .015});
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(.035, h + .02, .035, 'white', {x: p.x + sx * w / 2, y, z: p.z + sz * d / 2, r: .008});
      for (const sx of [-1, 1]) b.box(.03, .03, d, 'white', {x: p.x + sx * w / 2, y: y + h, z: p.z, r: .008});
      for (let k = 0; k < 6; k++) { const x = p.x - w * .38 + k * w * .15; bush(b, x, y + .05, p.z - d * .22, .07, 'leaf'); if (!winter && k % 2) b.sph(.03, ['#e2473b', '#f7c93e'][k % 4 ? 0 : 1], {x, y: y + .17, z: p.z - d * .22, seg: 5}); bush(b, x, y + .05, p.z + d * .22, .06, 'lime'); }
      b.box(.45, .05, .12, '#8a5a3c', {x: p.x, y: y + .07, z: p.z + d * .05, r: .01});
      // the panes: pale blue glass, drawn apart so it can be see-through
      glass.push({x: p.x, y: y + .06, z: p.z, w, d, h: h - .06, hh});
    } else if (p.kind === 'coop') {
      const hx = p.x, hz = p.z - r * .5, fy = heightAt(hx, hz);
      b.cyl(r, r + .05, .02, winter ? '#e9e4da' : '#c9b27a', {x: p.x, y: y - .005, z: p.z, seg: 28});   // trodden straw
      b.box(.62, .34, .5, '#c8473b', {x: hx, y: fy + .16, z: hz, r: .03}); b.gable(.56, .2, .66, '#8a5a3c', {x: hx, y: fy + .5, z: hz, ry: 0}); b.box(.2, .24, .02, '#3a2a20', {x: hx, y: fy + .14, z: hz + .26}); b.box(.1, .03, .2, 'wood', {x: hx, y: fy + .02, z: hz + .36, rx: -.35});
      b.box(.2, .18, .2, 'wood', {x: hx + .45, y: fy + .06, z: hz, r: .02}); b.box(.22, .02, .22, '#8a5a3c', {x: hx + .45, y: fy + .25, z: hz, r: .005});
      const n = Math.round(r * TAU / .16); for (let k = 0; k < n; k++) { const a = k / n * TAU; if (Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) < .28) continue; const x = p.x + Math.cos(a) * r * .97, z = p.z + Math.sin(a) * r * .97; b.cyl(.014, .018, .26, 'wood', {x, y: heightAt(x, z), z, seg: 5}); }
      b.torus(r * .97, .011, 'wood', {x: p.x, y: y + .1, z: p.z, rx: Math.PI / 2, arc: TAU}); b.torus(r * .97, .011, 'wood', {x: p.x, y: y + .2, z: p.z, rx: Math.PI / 2, arc: TAU});
      b.cyl(.09, .075, .03, '#a8a8a8', {x: p.x - r * .4, y, z: p.z + r * .3, seg: 10}); for (let k = 0; k < 4; k++) b.sph(.022, '#fffaf0', {x: hx + .45 + (k % 2) * .03, y: fy + .15, z: hz + .02 * k, sy: 1.2, seg: 5});
    }
    if (winter && p.kind !== 'coop') for (let k = 0; k < 5; k++) b.sph(.12, '#ffffff', {x: p.x + (R(k + 80) - .5) * r, y: y + .02, z: p.z + (R(k + 90) - .5) * r, sy: .22, seg: 7});   // snow drifts in the beds
  }
  const g = new THREE.Group(), mesh = b.mesh(material); mesh.castShadow = false; mesh.receiveShadow = true; g.add(mesh);
  if (glass.length) {
    const geos = []; for (const q of glass) {
      const wall = new THREE.BoxGeometry(q.w, q.h, q.d).translate(q.x, q.y + q.h / 2, q.z), sh = new THREE.Shape(); sh.moveTo(-q.d / 2, 0); sh.lineTo(q.d / 2, 0); sh.lineTo(0, q.hh); sh.closePath();
      const roof = new THREE.ExtrudeGeometry(sh, {depth: q.w, bevelEnabled: false}); roof.translate(0, 0, -q.w / 2); roof.rotateY(Math.PI / 2); roof.translate(q.x, q.y + q.h, q.z); geos.push(wall.toNonIndexed(), roof.toNonIndexed());
    }
    const gm = new THREE.Mesh(mergeGeometries(geos, false), new THREE.MeshLambertMaterial({color: '#cfeef6', transparent: true, opacity: .34, depthWrite: false, side: THREE.DoubleSide})); gm.renderOrder = 2; g.add(gm);
  }
  return g;
}

// Hedges along the outer side of the ring road (broken wherever a street, a building or a garden comes up to it) and reeds, rocks and sea thrift along the beaches.
export function buildBorders(graph, season, material) {
  const b = new Bag(), gr = ground(), junctions = Object.keys(NODES).filter(k => k.startsWith('out')).map(k => NODES[k]);
  const hedgeOk = (x, z) => BUILDINGS.every(q => Math.hypot(q.x - x, q.z - z) > q.w * .5 + .55) && !inGarden(x, z, .35);
  for (const e of graph.edges) if (e.kind === 'outer') {
    for (let s = .7; s < e.line.length - .7; s += .5) {
      const q = along(e.line, s), nx = q.tz, nz = -q.tx, o = 1.3, a = [q.x + nx * o, q.z + nz * o], c = [q.x - nx * o, q.z - nz * o], out = shore(a[0], a[1]) > shore(c[0], c[1]) ? a : c;
      if (junctions.some(j => Math.hypot(j[0] - out[0], j[1] - out[1]) < 1.9) || !hedgeOk(out[0], out[1]) || shore(out[0], out[1]) > .82) continue;
      const k = Math.round(s * 5), y = heightAt(out[0], out[1]);
      b.sph(.22, k % 3 ? 'leaf' : 'leafLight', {x: out[0], y: y + .14, z: out[1], sx: 1.5, sy: .85, ry: Math.atan2(-q.tz, q.tx), seg: 8, sway: .3});
      if (season !== 'winter' && k % 4 === 0) b.sph(.045, ['pink', 'white', 'yellow', 'red'][(k >> 2) % 4], {x: out[0] + .05, y: y + .3, z: out[1], seg: 5, sway: .5});
      if (season === 'winter') b.sph(.15, '#ffffff', {x: out[0], y: y + .25, z: out[1], sx: 1.3, sy: .32, ry: Math.atan2(-q.tz, q.tx), seg: 7});
    }
  }
  // the shore: rocks, reeds, driftwood and tufts of sea thrift
  for (let k = 0; k < 150; k++) {
    const a = rand(k * 3 + 1) * TAU, m = .9 + rand(k * 3 + 2) * .07, x = Math.cos(a) * ISLAND.rx * m, z = Math.sin(a) * ISLAND.rz * m, sh = shore(x, z);
    if (sh < .88 || sh > .985 || (x > PIER.x0 - 1.3 && Math.abs(z - PIER.z) < 2.6) || BUILDINGS.some(q => Math.hypot(q.x - x, q.z - z) < q.w * .5 + .9)) continue;
    const y = heightAt(x, z), t = k % 6;
    if (t < 2) { b.sph(.1 + rand(k) * .1, ['#9aa0a6', '#b4b0a8', '#8c9298'][k % 3], {x, y: y + .02, z, sx: 1.3, sy: .6, ry: rand(k + 4) * TAU, seg: 7}); if (t === 0) b.sph(.06, '#c7c1b3', {x: x + .13, y: y + .01, z: z + .05, sy: .6, seg: 6}); }
    else if (t < 4) { for (let r2 = 0; r2 < 5; r2++) { const dx = (rand(k + r2 * 3) - .5) * .2, dz = (rand(k + r2 * 3 + 1) - .5) * .2, h = .28 + rand(k + r2) * .2; b.cyl(.008, .012, h, season === 'autumn' ? '#c9a24e' : '#7fae5a', {x: x + dx, y, z: z + dz, rz: dx * 1.2, seg: 4, sway: 1}); if (r2 % 2 === 0) b.cyl(.016, .016, .07, '#8a5a3c', {x: x + dx, y: y + h - .02, z: z + dz, seg: 5, sway: 1}); } }
    else if (t === 4) b.box(.34, .035, .05, '#c9ab7c', {x, y: y + .03, z, ry: rand(k) * TAU, rz: .03});
    else if (season !== 'winter') for (let r2 = 0; r2 < 4; r2++) { b.sph(.035, 'pink', {x: x + (rand(k + r2) - .5) * .18, y: y + .06, z: z + (rand(k + r2 + 5) - .5) * .18, sy: .7, seg: 5}); }
  }
  // two weeping willows by the pond
  for (const [dx, dz, ry] of [[-1.5, .75, 0], [1.6, -.75, 2]]) {
    const x = POND.x + dx * 1.2, z = POND.z + dz * 1.2, y = heightAt(x, z);
    b.cyl(.08, .13, .6, 'brown', {x, y, z, seg: 7}); b.sph(.5, season === 'autumn' ? '#d9c55a' : '#7fc06a', {x, y: y + .9, z, sy: .75, seg: 12, sway: .6});
    for (let t = 0; t < 12; t++) { const a = t / 12 * TAU + ry; b.cone(.05, .55, season === 'autumn' ? '#c9a23b' : '#6fb25c', {x: x + Math.cos(a) * .46, y: y + .3, z: z + Math.sin(a) * .46, rx: Math.PI, seg: 4, sway: 1}); }
  }
  const mesh = b.mesh(material); mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
}

/* ---------------- the dwarfs' islet ---------------- */
export function buildDwarf(i, material) {
  const b = new Bag(), hats = ['#d94a3a', '#3f9e58', '#3f8fd6'], coats = ['#8a5a3c', '#5d6b7a', '#a35c2c'], hat = hats[i % 3], beard = ['#ececec', '#c98a4b', '#8a5a3c'][i % 3];
  cone2(b, .06, .11, coats[i % 3], {y: .09, seg: 8}); b.sph(.05, '#f0c8a0', {y: .205, seg: 8}); b.sph(.012, '#f0a08a', {y: .2, z: .048, seg: 5}); cone2(b, .045, .1, beard, {y: .165, z: .02, rx: Math.PI, seg: 7});
  cone2(b, .055, .14, hat, {y: .3, seg: 8}); b.torus(.054, .008, hat, {y: .245, rx: Math.PI / 2});
  for (const sx of [-1, 1]) { b.cyl(.015, .015, .05, '#3a2a20', {x: sx * .025, seg: 5}); b.sph(.012, '#111', {x: sx * .02, y: .22, z: .043, seg: 4}); }
  if (i === 0) { b.cyl(.006, .006, .16, '#8a5a3c', {x: .07, y: .05, rz: .4, seg: 4}); b.box(.1, .02, .02, '#6b747d', {x: .1, y: .2, r: .004, rz: .4}); }
  else { b.cyl(.004, .004, .1, '#444', {x: .07, y: .09, seg: 4}); b.box(.035, .045, .035, '#7a5c2e', {x: .07, y: .04, r: .004}); }
  return finish(b, material, 1.2);
}
export function buildIslet(material) {
  const b = new Bag(), gl = new Bag(), face = ISLET.face, y0 = ISLAND.sea;
  b.push(ISLET.x, y0, ISLET.z, face, ISLET.s); gl.push(ISLET.x, y0, ISLET.z, face, ISLET.s);
  // sand and shallows round the foot, then the rocks heaped up behind (the cave mouth looks along +z)
  b.cyl(2.1, 2.3, .16, '#e9d49a', {y: -.1, seg: 26, sx: 1.05, sz: .95});
  // the rock heaped round and above the cave: pillars either side of the mouth, a lintel over it, and a dark hollow behind
  const rocks = [[0, 0, -.7, 1.2, 1.15], [-.85, 0, -.3, .75, .75], [.85, 0, -.3, .75, .7], [-.3, .5, -.85, .8, .8], [.45, .85, -.85, .55, .5], [-.7, .8, -.6, .45, .42], [0, 1.3, -.9, .45, .42], [1.4, 0, .1, .5, .42], [-1.4, 0, .05, .48, .38]];
  rocks.forEach(([x, y, z, r, h], k) => b.sph(r, ['#8d8a86', '#a59b8e', '#7c7771', '#b0a99c'][k % 4], {x, y: y + h * .2, z, sy: h / r, seg: 9, sx: 1 + (k % 3) * .06}));
  for (const sx of [-1, 1]) { b.sph(.36, sx < 0 ? '#9a928a' : '#8a837c', {x: sx * .82, y: .28, z: .5, sy: 1.35, seg: 9}); b.sph(.26, '#aaa196', {x: sx * .9, y: .12, z: .85, sy: .8, seg: 8}); b.sph(.3, '#7f7a73', {x: sx * .6, y: .95, z: .35, seg: 8}); }
  b.sph(.4, '#a09789', {x: 0, y: 1.12, z: .38, sx: 1.45, sy: .62, seg: 10}); b.sph(.34, '#8f8a82', {x: .1, y: 1.3, z: .15, sx: 1.4, sy: .8, seg: 9});
  b.sph(.75, '#0c0a10', {x: 0, y: .42, z: -.1, sx: 1.0, sy: .95, sz: .9, seg: 12}); b.cyl(.52, .52, .02, '#17131c', {y: .0, z: .62, seg: 12, sx: 1});
  for (let k = 0; k < 14; k++) b.sph(.12 + rand(k) * .12, ['#9aa0a6', '#868d93', '#b0b1ab'][k % 3], {x: (rand(k * 3 + 1) - .5) * 3.4, y: .0, z: -.5 + (rand(k * 3 + 2) - .3) * 2.2, sy: .55, seg: 6});
  b.sph(.4, '#5e8a4c', {x: -.4, y: 1.3, z: -.85, sy: .5, seg: 8}); b.sph(.3, '#6a9a56', {x: .3, y: 1.5, z: -.9, sy: .5, seg: 8}); b.sph(.22, '#7aa95f', {x: .85, y: 1.1, z: -.5, sy: .5, seg: 7});
  // timber frame in the mouth and a step
  for (const sx of [-1, 1]) b.cyl(.04, .04, .78, '#7a5230', {x: sx * .5, y: .0, z: .8, seg: 6}); b.box(1.1, .06, .07, '#7a5230', {y: .78, z: .8, r: .01});
  b.box(1.2, .06, .6, '#a4a9ad', {y: -.02, z: 1.0, r: .02}); b.box(1.0, .05, .5, '#b2b3ae', {y: .03, z: 1.1, r: .02});
  // a lantern post, a mine cart of gems, a sign, crystals and glowing mushrooms
  b.cyl(.02, .025, .55, '#444', {x: .72, y: .0, z: 1.1, seg: 5}); b.box(.1, .13, .1, '#222', {x: .72, y: .55, z: 1.1, r: .01}); gl.sph(.07, '#ffd27a', {x: .72, y: .62, z: 1.1, seg: 8, glow: true});
  b.box(.34, .12, .22, '#6b5a4a', {x: -.78, y: .02, z: 1.18, r: .02}); for (const [dx, c] of [[-.1, '#6fa8ff'], [0, '#c58bff'], [.1, '#7fe3c8']]) cone2(b, .035, .09, c, {x: -.78 + dx, y: .2, z: 1.18, seg: 4});
  for (const sx of [-1, 1]) b.cyl(.04, .04, .02, '#333', {x: -.78 + sx * .1, y: .0, z: 1.3, rx: Math.PI / 2, seg: 8}); b.box(1.0, .015, .02, '#555', {x: -.78, y: -.01, z: 1.3}); b.box(1.0, .015, .02, '#555', {x: -.78, y: -.01, z: 1.07});
  b.cyl(.015, .015, .4, '#7a5230', {x: -1.05, y: .0, z: .8, seg: 5}); b.box(.34, .16, .03, '#a3744a', {x: -1.05, y: .34, z: .8, ry: .2, r: .005});
  for (const [x, z, s, c] of [[.55, 1.4, 1, '#6fa8ff'], [.62, 1.3, .7, '#c58bff'], [-1.0, 1.0, .8, '#7fe3c8'], [1.1, .85, .6, '#c58bff']]) { cone2(b, .04 * s, .15 * s, '#d9e7f5', {x, y: .08 * s, z, seg: 4}); gl.cone(.03 * s, .12 * s, c, {x: x + .03, y: 0, z: z + .02, seg: 4, glow: true}); }
  for (const [x, z, s] of [[-.5, 1.35, 1], [-.35, 1.45, .7], [.95, 1.2, .8], [1.4, .5, .6]]) { b.cyl(.012 * s, .014 * s, .07 * s, '#f6efe1', {x, y: 0, z, seg: 5}); gl.sph(.045 * s, '#ff9ad2', {x, y: .08 * s, z, sy: .6, seg: 7, glow: true}); }
  // the dwarfs' rowing boat, drawn up on the sand
  b.push(1.55, -.04, 1.55, .7); b.box(.34, .08, .78, '#c8473b', {y: .03, r: .03}); b.box(.3, .02, .7, '#e9d49a', {y: .1}); cone2(b, .12, .2, '#c8473b', {y: .06, z: .46, rx: Math.PI / 2, seg: 6}); b.pop();
  b.pop(); gl.pop();
  const g = new THREE.Group(), rock = b.mesh(material); rock.castShadow = false; rock.receiveShadow = true; g.add(rock);
  const glow = gl.glowMesh(new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false})); if (glow) { glow.position.set(0, 0, 0); glow.renderOrder = 2; g.add(glow); }
  // the warm light deep in the cave: a soft disc that flickers at night
  const inner = new THREE.Mesh(new THREE.CircleGeometry(.5, 20), new THREE.MeshBasicMaterial({color: '#ffb14a', transparent: true, opacity: 0, depthWrite: false, fog: false})); inner.scale.set(.9, 1.0, 1); g.userData.inner = inner;
  g.userData.glow = glow; g.userData.innerMat = inner.material;
  // place the cave light in the islet's frame
  const fx = Math.sin(face), fz = Math.cos(face); inner.position.set(ISLET.x + fx * .7 * ISLET.s, y0 + .5 * ISLET.s, ISLET.z + fz * .7 * ISLET.s); inner.scale.multiplyScalar(ISLET.s); inner.rotation.y = face; g.add(inner);
  // the whole islet group is already in world coordinates (the bag was pushed to the islet's position), so the group stays at the origin
  return g;
}
