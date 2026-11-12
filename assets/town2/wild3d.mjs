// New Toy Town: the builders for the living nature: pets, hens, dolphins and whales, the gardens, the hen yard, the dwarfs' islet and cave,
// wild flowers and butterflies. Everything static is drawn into one bag (one mesh); animals are one small mesh each, built facing +z.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Bag, U} from './build.mjs';
import {along} from './graph.mjs';
import {ISLAND, POND, NODES, heightAt, shore, rand, BUILDINGS, PIER} from './def.mjs';
import {PLOTS, BLOOM, inGarden, freeSpot} from './garden.mjs';
import {ISLET, ground} from './wildlife.mjs';
import {limb, limbMesh, limbMaterial} from './limbs.mjs';

const TAU = Math.PI * 2;
const coneCache = new Map();
const cone2 = (b, r, h, colour, o = {}) => { const key = r + ':' + h + ':' + (o.seg || 8); if (!coneCache.has(key)) { const g = new THREE.ConeGeometry(r, h, o.seg || 8).toNonIndexed(); g.deleteAttribute('uv'); coneCache.set(key, g); } return b.add(coneCache.get(key), colour, o); };   // a cone turned about its own centre (pointing +y, then rotated)
const polyCache = new Map();
// low-poly buds and mounds: an octahedron (8 triangles) or a flattened icosahedron (20) instead of a smooth sphere (48 and up): faceted like the rocks, and far cheaper
const poly = (b, kind, r, colour, o = {}) => { const key = kind + r; if (!polyCache.has(key)) { const g = (kind === 'oct' ? new THREE.OctahedronGeometry(r, 0) : new THREE.IcosahedronGeometry(r, 0)).toNonIndexed(); g.deleteAttribute('uv'); polyCache.set(key, g); } return b.add(polyCache.get(key), colour, o); };
// an animal with limbs: its own material (its own gait), the mesh kept on the group for `setGait`
const finishL = (b, scale) => { const m = limbMesh(b, limbMaterial()); m.castShadow = false; const g = new THREE.Group(); g.add(m); g.scale.setScalar(scale); g.userData.limbMesh = m; return g; };
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
    for (const sx of [-1, 1]) for (const z of [-.075, .08]) { const off = (z > 0 ? sx < 0 : sx > 0) ? 0 : Math.PI; limb(b, 1, [sx * .04, .115, z], off, .8, .022, () => { b.cyl(.019, .016, .1, c, {x: sx * .04, z, seg: 6}); b.sph(.022, l, {x: sx * .04, y: .006, z: z + .008, sz: 1.3, seg: 6}); }); }
    limb(b, 3, [0, .2, .11], 0, .22, 0, () => {
      b.sph(.06, c, {y: .23, z: .13, seg: 10}); b.sph(.034, l, {y: .215, z: .185, sz: 1.2, seg: 8}); b.sph(.014, '#222', {y: .226, z: .22, seg: 6});
      for (const sx of [-1, 1]) { b.sph(.011, '#111', {x: sx * .03, y: .245, z: .17, seg: 5}); b.sph(.028, d, {x: sx * .052, y: .235, z: .115, sx: .45, sy: 1.15, sz: .8, rz: sx * .35, seg: 6}); }
      b.cyl(.018, .018, .02, '#d94a3a', {y: .195, z: .1, seg: 8});   // a red collar
    });
    limb(b, 4, [0, .19, -.12], 0, .6, 0, () => cone2(b, .016, .1, c, {y: .2, z: -.13, rx: -1.0, seg: 5}));
    return finishL(b, 1.4);
  }
  const [c, l] = CAT[coat] || CAT.ginger;   // cat
  b.sph(.058, c, {y: .1, sx: .85, sy: .85, sz: 1.7}); b.sph(.045, l, {y: .085, z: .05, sx: .85, sy: .7, sz: 1.2});
  for (const sx of [-1, 1]) for (const z of [-.055, .06]) { const off = (z > 0 ? sx < 0 : sx > 0) ? 0 : Math.PI; limb(b, 1, [sx * .03, .08, z], off, .75, .014, () => { b.cyl(.013, .012, .07, c, {x: sx * .03, z, seg: 6}); b.sph(.014, l, {x: sx * .03, y: .005, z: z + .006, sz: 1.3, seg: 5}); }); }
  limb(b, 3, [0, .13, .08], 0, .18, 0, () => {
    b.sph(.046, c, {y: .15, z: .1, seg: 10}); b.sph(.022, l, {y: .14, z: .138, sx: 1.1, seg: 6}); b.sph(.008, '#e88', {y: .146, z: .157, seg: 5});
    for (const sx of [-1, 1]) { cone2(b, .017, .04, c, {x: sx * .026, y: .2, z: .09, seg: 4}); b.sph(.01, '#7fdc6a', {x: sx * .02, y: .16, z: .138, seg: 5}); }
  });
  limb(b, 4, [0, .1, -.1], 0, .5, 0, () => b.tube([[0, .1, -.1], [0, .13, -.17], [0, .2, -.19], [0, .26, -.15]], .011, c));
  if (coat === 'tabby') for (const z of [-.04, .0, .04]) b.box(.11, .01, .012, '#5d4630', {y: .152, z, r: .003});
  if (coat === 'ginger' || coat === 'grey') b.sph(.02, '#ffffff', {y: .06, z: .12, sx: 1.2, seg: 5});
  return finishL(b, 1.35);
}

/* ---------------- hens ---------------- */
const HEN = {brown: ['#b5742f', '#d89a55', '#7d4a1d'], white: ['#fffaf0', '#ffffff', '#e4d9c0'], speckled: ['#8a7a68', '#b4a590', '#5a4d40'], gold: ['#e0b040', '#f2d680', '#b8862a'], red: ['#a83a22', '#d86a38', '#2d6a4a']};
export function buildHen(kind, coat, material) {
  const b = new Bag(), [c, l, d] = HEN[coat] || HEN.brown, big = kind === 'rooster', s = big ? 2.4 : 1.9, up = big ? .02 : 0;
  b.sph(.058, c, {y: .1, sx: .9, sy: .92, sz: 1.2}); b.sph(.046, l, {y: .1, z: .042, seg: 8});
  for (const sx of [-1, 1]) b.sph(.04, d, {x: sx * .05, y: .11, z: -.012, sx: .35, sy: .75, sz: 1.15, seg: 6});
  limb(b, 3, [0, .13, .045], 0, .42, 0, () => {   // the head: it nods as the hen walks and dips right down to peck
    b.sph(.03, c, {y: .185 + up, z: .07, seg: 8}); b.sph(.011, '#d92b2b', {y: .22 + up, z: .068, sx: .6, sy: 1.4, seg: 5});
    cone2(b, .011, .035, '#f2a33a', {y: .18 + up, z: .1, rx: Math.PI / 2, seg: 5}); b.sph(.009, '#d92b2b', {y: .16 + up, z: .088, seg: 4}); b.sph(.006, '#111', {x: .02, y: .19 + up, z: .082, seg: 4}); b.sph(.006, '#111', {x: -.02, y: .19 + up, z: .082, seg: 4});
  });
  limb(b, 4, [0, .13, -.07], 0, .14, 0, () => {
    if (big) { [[-.25, '#2d6a4a'], [0, '#d94a2b'], [.25, '#f2a33a']].forEach(([a, k]) => cone2(b, .02, .13, k, {y: .18, z: -.09, rx: -.9, rz: a, seg: 5})); }
    else cone2(b, .03, .08, d, {y: .14, z: -.07, rx: -.8, seg: 5});
  });
  if (coat === 'speckled') for (let k = 0; k < 6; k++) b.sph(.009, '#ffffff', {x: (rand(k + 3) - .5) * .09, y: .11 + rand(k + 5) * .05, z: (rand(k + 7) - .5) * .08, seg: 4});
  for (const sx of [-1, 1]) limb(b, 1, [sx * .022, .065, 0], sx < 0 ? 0 : Math.PI, .95, .016, () => { b.cyl(.009, .008, .06, '#f2a33a', {x: sx * .022, z: 0, seg: 5}); b.box(.03, .008, .035, '#f2a33a', {x: sx * .022, y: .0, z: .012}); });
  return finishL(b, s);
}
export function buildChick(material) {
  const b = new Bag(); b.sph(.03, '#ffe066', {y: .05, seg: 8});
  limb(b, 3, [0, .07, .02], 0, .4, 0, () => { b.sph(.02, '#ffe066', {y: .085, z: .025, seg: 8}); cone2(b, .007, .016, '#f2a33a', {y: .085, z: .045, rx: Math.PI / 2, seg: 4}); b.sph(.005, '#111', {x: .012, y: .09, z: .038, seg: 4}); b.sph(.005, '#111', {x: -.012, y: .09, z: .038, seg: 4}); });
  for (const sx of [-1, 1]) limb(b, 1, [sx * .012, .03, 0], sx < 0 ? 0 : Math.PI, 1.1, .01, () => b.cyl(.004, .004, .03, '#f2a33a', {x: sx * .012, seg: 4}));
  return finishL(b, 1.7);
}

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
  const mesh = new THREE.InstancedMesh(geo, mat, max), pal = BLOOM[season].wild.map(c => new THREE.Color(c)), gr = ground(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
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

const gapOf = (a, g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g)));
const SNOW = '#f2f7fa';
// A ring of box hedge (or of a given radius) with an opening of half-width `half` radians facing `gap`.
function hedgeRing(b, p, rad, gap, half, winter, h = .24, step = .3) {
  const n = Math.round(rad * TAU / step);
  for (let k = 0; k < n; k++) { const a = k / n * TAU; if (gapOf(a, gap) < half) continue; const x = p.x + Math.cos(a) * rad, z = p.z + Math.sin(a) * rad; b.box(step + .03, h, .2, winter ? (k % 2 ? '#e8f0ea' : '#7da58c') : k % 2 ? 'leaf' : 'leafLight', {x, y: heightAt(x, z), z, ry: -a + Math.PI / 2, r: .06, sway: .15}); }
}
// A wooden post-and-rail fence round a plot, open towards `gap`.
function fenceRing(b, p, rad, gap, half, y0) {
  const n = Math.round(rad * TAU / .34);
  for (let k = 0; k < n; k++) { const a = k / n * TAU; if (gapOf(a, gap) < half) continue; const x = p.x + Math.cos(a) * rad, z = p.z + Math.sin(a) * rad, y = heightAt(x, z); b.cyl(.016, .02, .3, 'wood', {x, y, z, seg: 5}); const a2 = (k + 1) / n * TAU; if (gapOf(a2, gap) >= half) for (const hy of [.12, .23]) { const x2 = p.x + Math.cos(a2) * rad, z2 = p.z + Math.sin(a2) * rad; b.box(.34, .018, .018, '#a3744a', {x: (x + x2) / 2, y: y + hy, z: (z + z2) / 2, ry: -(a + a2) / 2 + Math.PI / 2}); } }
}
const lawn = (b, p, y0, winter, colour = '#79bf58', rr = 1) => b.cyl(p.r * rr, p.r * rr + .02, .03, winter ? '#e8eef0' : colour, {x: p.x, y: y0, z: p.z, seg: 30});

// ORCHARD: rows of fruit trees in a fenced paddock, blossom in spring, apples in summer, russet in autumn, bare and frosted in winter, and a picnic blanket in the shade.
function orchardGarden(b, p, season, R, gap, y0, cs) {
  const winter = season === 'winter', r = p.r; lawn(b, p, y0, winter, '#82c45e'); fenceRing(b, p, r * .98, gap, .4, y0);
  const crown = {spring: ['#f7c3d8', '#ffffff', '#fbd0e0'], summer: ['#4f9a47', '#5fae52', '#3f8a40'], autumn: ['#e8b83a', '#d9822b', '#b5551f'], winter: ['#9fb4a8']}[season];
  const spots = []; for (let row = -2; row <= 2; row++) for (let col = -2; col <= 2; col++) { const x = p.x + col * r * .42 + (row % 2) * r * .2, z = p.z + row * r * .38; if (Math.hypot(x - p.x, z - p.z) < r * .8 && !(Math.abs(row) <= 0 && Math.abs(col) <= 0)) spots.push([x, z]); }
  spots.forEach(([x, z], k) => {
    const y = heightAt(x, z), sc = .8 + R(k + 10) * .35; b.cyl(.035 * sc, .05 * sc, .36 * sc, 'brown', {x, y, z, seg: 6});
    if (winter) { for (let t = 0; t < 4; t++) { const a = t / 4 * TAU + k; cone2(b, .02, .26 * sc, 'brown', {x: x + Math.cos(a) * .08, y: y + .4 * sc, z: z + Math.sin(a) * .08, rx: Math.sin(a) * .7, rz: -Math.cos(a) * .7, seg: 4}); } poly(b, 'ico', .13 * sc, SNOW, {x, y: y + .62 * sc, z, sy: .5}); return; }
    for (let t = 0; t < 3; t++) poly(b, 'ico', (.27 - t * .03) * sc, crown[(k + t) % crown.length], {x: x + (t - 1) * .08, y: y + (.5 + t * .1) * sc, z: z + (t % 2 ? .06 : -.05), sy: .85, sway: .5});
    if (season === 'summer') for (let f = 0; f < 4; f++) { const a = R(k * 4 + f) * TAU; b.sph(.035, f % 3 ? '#e2473b' : '#f2c14e', {x: x + Math.cos(a) * .2 * sc, y: y + (.42 + R(k + f) * .2) * sc, z: z + Math.sin(a) * .2 * sc, seg: 5}); }
    if (season === 'autumn') for (let f = 0; f < 3; f++) { const a = R(k * 3 + f) * TAU; b.sph(.03, '#d9822b', {x: x + Math.cos(a) * .28, y: y + .02, z: z + Math.sin(a) * .28, seg: 4}); }
  });
  // a picnic blanket and basket in the middle
  const my = heightAt(p.x, p.z) + .03; for (let u = 0; u < 4; u++) for (let v = 0; v < 3; v++) b.box(.13, .012, .13, (u + v) % 2 ? '#ffffff' : '#d9453b', {x: p.x - .2 + u * .13, y: my, z: p.z - .13 + v * .13});
  b.box(.1, .07, .07, '#a3744a', {x: p.x + .12, y: my + .01, z: p.z, r: .01}); b.tube([[p.x + .08, my + .08, p.z], [p.x + .12, my + .16, p.z], [p.x + .16, my + .08, p.z]], .007, '#7a5230');
  for (let k = 0; k < 3; k++) b.sph(.03, ['#e2473b', '#f2c14e', '#7fc45a'][k], {x: p.x - .1 + k * .08, y: my + .035, z: p.z + .17, seg: 5});
}

// HEDGE MAZE: three rings of hedge with their gaps on opposite sides and a fountain in the middle.
function mazeGarden(b, p, season, R, gap, y0, cs) {
  const winter = season === 'winter', r = p.r; lawn(b, p, y0, winter, '#8ccd66');
  const my = heightAt(p.x, p.z) + .02;
  hedgeRing(b, p, r * .97, gap, .3, winter, .3); hedgeRing(b, p, r * .7, gap + Math.PI, .3, winter, .3); hedgeRing(b, p, r * .44, gap, .3, winter, .3);
  // the paths: pale gravel between the rings
  for (const [ra, rb] of [[r * .8, r * .93], [r * .53, r * .64], [r * .12, r * .38]]) { const n = 26; for (let k = 0; k < n; k++) { const a = k / n * TAU, a2 = (k + 1) / n * TAU; for (const rr of [(ra + rb) / 2]) { const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr; b.box(rb - ra, .012, .5 * rr * TAU / n * 1.02, winter ? '#dfe5e8' : '#e9d9b0', {x, y: heightAt(x, z) + .03, z, ry: -a}); } } }
  // the fountain in the heart of it
  b.cyl(.2, .22, .07, 'stone', {x: p.x, y: my, z: p.z, seg: 14}); b.cyl(.16, .16, .02, winter ? '#dff1f7' : '#6fcdea', {x: p.x, y: my + .07, z: p.z, seg: 14}); b.cyl(.025, .035, .22, 'stone', {x: p.x, y: my + .07, z: p.z, seg: 8}); b.cyl(.08, .04, .03, 'stone', {x: p.x, y: my + .27, z: p.z, seg: 10});
  if (!winter) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.sph(.012, '#bfe9f6', {x: p.x + Math.cos(a) * .07, y: my + .27 + (k % 2) * .03, z: p.z + Math.sin(a) * .07, seg: 4}); }
  // two clipped topiary cones at the entrance
  for (const sd of [-1, 1]) { const a = gap + sd * .42, x = p.x + Math.cos(a) * r * .97, z = p.z + Math.sin(a) * r * .97; cone2(b, .1, .36, winter ? '#9fb4a8' : 'leaf', {x, y: heightAt(x, z) + .22, z, seg: 8}); b.cyl(.09, .09, .06, 'stone', {x, y: heightAt(x, z), z, seg: 8}); }
}

// WATER GARDEN: a pond with lily pads, reeds round it, stepping stones across, a bench and a weeping willow.
function waterGarden(b, p, season, R, gap, y0, cs) {
  const winter = season === 'winter', r = p.r; lawn(b, p, y0, winter, '#7dbf5c');
  const px = p.x - r * .08, pz = p.z + r * .04, pr = r * .56, wy = y0 + .035;
  b.cyl(pr * 1.12, pr * 1.14, .05, '#a9a39a', {x: px, y: y0, z: pz, seg: 26, sx: 1.2});   // the stone kerb
  b.cyl(pr, pr, .03, winter ? '#dbeef5' : '#5fc0e0', {x: px, y: y0 + .03, z: pz, seg: 26, sx: 1.2});   // the water (a flattened disc)
  const kerb = 18; for (let k = 0; k < kerb; k++) { const a = k / kerb * TAU; b.box(.16, .06, .1, k % 2 ? '#c2bbb0' : '#b0a99e', {x: px + Math.cos(a) * pr * 1.25, y: y0 + .01, z: pz + Math.sin(a) * pr * 1.07, ry: -a, r: .01}); }
  if (!winter) { for (let k = 0; k < 9; k++) { const a = R(k + 3) * TAU, d = Math.sqrt(R(k + 9)) * pr * .8, x = px + Math.cos(a) * d * 1.15, z = pz + Math.sin(a) * d; b.cyl(.07 + R(k) * .03, .07, .012, '#4f9a47', {x, y: wy + .005, z, seg: 8}); if (k % 3 === 0) poly(b, 'oct', .035, cs[k % cs.length], {x, y: wy + .035, z}); } }
  else for (let k = 0; k < 4; k++) b.sph(.18, '#ffffff', {x: px + (R(k) - .5) * pr, y: wy, z: pz + (R(k + 4) - .5) * pr * .7, sy: .1, seg: 8});
  // reeds and cattails round the far side
  for (let k = 0; k < 16; k++) { const a = gap + Math.PI + (R(k + 20) - .5) * 3.2, rr = pr * (1.1 + R(k + 30) * .25), x = px + Math.cos(a) * rr * 1.15, z = pz + Math.sin(a) * rr, y = heightAt(x, z), h = .28 + R(k) * .16; b.cyl(.006, .009, h, winter ? '#b9a57a' : '#6fa646', {x, y, z, seg: 4, sway: .9}); if (k % 3 === 0) b.cyl(.014, .014, .07, '#7a4a2a', {x, y: y + h - .02, z, seg: 5, sway: .9}); }
  // stepping stones across the lawn to the water and a bench
  for (let k = 0; k < 5; k++) { const x = p.x + Math.cos(gap) * (r * .95 - k * r * .2), z = p.z + Math.sin(gap) * (r * .95 - k * r * .2) + (k % 2 ? .06 : -.06); b.cyl(.09, .1, .03, '#b8b2a8', {x, y: heightAt(x, z) + .02, z, seg: 7}); }
  const bx = p.x + Math.cos(gap + 2.2) * r * .78, bz = p.z + Math.sin(gap + 2.2) * r * .78; b.push(bx, heightAt(bx, bz), bz, -(gap + 2.2) + Math.PI / 2); b.box(.4, .04, .14, 'wood', {y: .16, r: .01}); b.box(.4, .14, .03, 'wood', {y: .2, z: -.06, r: .01}); for (const sx of [-.16, .16]) b.box(.03, .16, .12, 'slate', {x: sx}); b.pop();
  // a weeping willow
  const wx = p.x + Math.cos(gap + Math.PI * .8) * r * .72, wz = p.z + Math.sin(gap + Math.PI * .8) * r * .72, wy0 = heightAt(wx, wz); b.cyl(.05, .07, .5, 'brown', {x: wx, y: wy0, z: wz, seg: 6});
  poly(b, 'ico', .3, winter ? '#9fb4a8' : '#8fb85a', {x: wx, y: wy0 + .66, z: wz, sy: .7, sway: .6}); if (!winter) for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; b.tube([[wx + Math.cos(a) * .22, wy0 + .7, wz + Math.sin(a) * .22], [wx + Math.cos(a) * .32, wy0 + .48, wz + Math.sin(a) * .32], [wx + Math.cos(a) * .34, wy0 + .26, wz + Math.sin(a) * .34]], .012, '#7fa84e'); }
}

// ROSE PAVILION: an eight-post gazebo with a red cone roof and a bench inside, rose beds round it, a rose arch at the gate, a hedge border.
function pavilionGarden(b, p, season, R, gap, y0, cs) {
  const winter = season === 'winter', r = p.r, ca = Math.cos(gap), sa = Math.sin(gap); lawn(b, p, y0, winter, '#79bf58'); hedgeRing(b, p, r * .97, gap, .36, winter, .2);
  const my = heightAt(p.x, p.z) + .03; b.cyl(.42, .45, .05, '#cbbfa8', {x: p.x, y: my - .02, z: p.z, seg: 8});   // the floor
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .39, x = p.x + Math.cos(a) * .38, z = p.z + Math.sin(a) * .38; b.cyl(.018, .02, .55, 'white', {x, y: my, z, seg: 6}); if (!winter) for (let f = 0; f < 3; f++) poly(b, 'oct', .03, cs[(k + f) % cs.length], {x: x + (R(k * 3 + f) - .5) * .05, y: my + .12 + f * .15, z: z + (R(k + f) - .5) * .05, sway: .5}); }
  cone2(b, .52, .26, winter ? SNOW : '#d9453b', {x: p.x, y: my + .68, z: p.z, seg: 8}); b.cyl(.05, .05, .04, 'gold', {x: p.x, y: my + .82, z: p.z, seg: 6}); b.cyl(.44, .44, .03, 'white', {x: p.x, y: my + .53, z: p.z, seg: 8});
  b.box(.3, .04, .1, 'wood', {x: p.x, y: my + .14, z: p.z + .06, r: .01});
  // rose beds in a ring, a pair of colours, with a gravel path round
  const n = 8; for (let k = 0; k < n; k++) { const a = k / n * TAU, x = p.x + Math.cos(a) * r * .68, z = p.z + Math.sin(a) * r * .68, y = heightAt(x, z) + .02; b.cyl(.2, .22, .05, winter ? '#ece8e0' : '#5d4030', {x, y: y - .01, z, seg: 10});
    if (winter) { poly(b, 'ico', .1, '#9fb4a8', {x, y: y + .08, z, sy: .5}); continue; }
    poly(b, 'ico', .13, 'leaf', {x, y: y + .1, z, sy: .8, sway: .4}); for (let f = 0; f < 4; f++) poly(b, 'oct', .045, cs[(k + f) % cs.length], {x: x + (R(k * 5 + f) - .5) * .22, y: y + .16 + R(k + f) * .08, z: z + (R(k * 7 + f) - .5) * .22, sway: .5}); }
  for (let k = 0; k < 28; k++) { const a = k / 28 * TAU, x = p.x + Math.cos(a) * r * .5, z = p.z + Math.sin(a) * r * .5; b.box(.16, .012, .13, winter ? '#dfe5e8' : '#e9d9b0', {x, y: heightAt(x, z) + .03, z, ry: -a}); }
  // the rose arch at the gate
  const gx = p.x + ca * r * .97, gz = p.z + sa * r * .97, gy = heightAt(gx, gz); for (const sd of [-1, 1]) b.cyl(.02, .02, .5, 'white', {x: gx - sa * sd * .22, y: gy, z: gz + ca * sd * .22, seg: 5});
  b.tube([[gx + sa * .22, gy + .5, gz - ca * .22], [gx + sa * .1, gy + .64, gz - ca * .1], [gx - sa * .1, gy + .64, gz + ca * .1], [gx - sa * .22, gy + .5, gz + ca * .22]], .016, 'white'); if (!winter) for (let f = 0; f < 6; f++) poly(b, 'oct', .03, cs[f % cs.length], {x: gx + sa * (.2 - f * .08), y: gy + .55 + (f % 2) * .08, z: gz - ca * (.2 - f * .08)});
}

// WILDFLOWER FIELD: no fence, drifts of flowers, a winding path of stones and three beehives where the bees live.
function wildGarden(b, p, season, R, gap, y0, cs) {
  const winter = season === 'winter', r = p.r; lawn(b, p, y0, winter, '#86c85f', .96);
  for (let k = 0, m = Math.round(r * r * 22); k < m; k++) { const a = R(k + 200) * TAU, rr = Math.sqrt(R(k + 300)) * r * .9, x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr, y = heightAt(x, z), c = cs[Math.floor(R(k + 400) * cs.length)];
    if (winter) { if (k % 3 === 0) cone2(b, .02, .14 + R(k) * .08, '#b9a57a', {x, y: y + .08, z, seg: 4, sway: .9}); continue; }
    if (k % 4 === 0) cone2(b, .02, .16 + R(k + 5) * .1, '#7fb55a', {x, y: y + .09, z, seg: 4, sway: .9}); else flower(b, x, y, z, c, .1 + R(k + 7) * .16, .03 + R(k + 8) * .02); }
  // the path of flat stones, winding from the gate to the hives
  for (let k = 0; k < 9; k++) { const t = k / 8, a = gap + Math.sin(t * 4) * .5, d = r * (.95 - t * .8), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d; b.cyl(.1 + (k % 2) * .02, .11, .03, '#c0b9ae', {x, y: heightAt(x, z) + .025, z, seg: 7}); }
  // three beehives on little stands, with a few bees about them
  for (let h = 0; h < 3; h++) { const a = gap + Math.PI + (h - 1) * .75, x = p.x + Math.cos(a) * r * .62, z = p.z + Math.sin(a) * r * .62, y = heightAt(x, z); b.push(x, y, z, -a + Math.PI / 2);
    for (const sx of [-.07, .07]) b.cyl(.012, .012, .1, 'wood', {x: sx, seg: 4}); b.box(.2, .04, .16, 'wood', {y: .1}); b.box(.18, .1, .14, winter ? '#e8e2d0' : '#f7e9a8', {y: .14, r: .01}); b.box(.19, .03, .15, winter ? SNOW : '#d9a441', {y: .245, r: .005}); b.box(.06, .02, .01, '#3a2a20', {y: .17, z: .075}); b.pop(); }
}

// ALLOTMENT: raised beds in rows of vegetables, a shed with a water butt, a scarecrow, a wheelbarrow, a compost heap and a fence.
function allotmentGarden(b, p, season, R, gap, y0, cs) {
  const winter = season === 'winter', r = p.r, ca = Math.cos(gap), sa = Math.sin(gap), at = (u, v) => [p.x + u * ca - v * sa, p.z + u * sa + v * ca]; lawn(b, p, y0, winter, '#84c45e'); fenceRing(b, p, r * .98, gap, .36, y0);
  const crops = {spring: [['#7fc45a', 'cabbage'], ['#a5d86a', 'leaf'], ['#7fc45a', 'leaf']], summer: [['#e2473b', 'tomato'], ['#4f9a47', 'bean'], ['#f28b3c', 'carrot']], autumn: [['#f28b3c', 'pumpkin'], ['#7a9a3c', 'cabbage'], ['#d9822b', 'pumpkin']]}[season] || [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) { const [bx, bz] = at(-r * .2 + col * r * .62 - r * .18, (row - 1) * r * .46), y = heightAt(bx, bz); b.push(bx, y, bz, -gap); b.box(r * .5, .09, .28, '#a3744a', {r: .01}); b.box(r * .46, .03, .24, winter ? SNOW : '#4a3324', {y: .09}); b.pop();
    if (winter) continue; const [col1, kind] = crops[(row + col) % crops.length]; for (let k = 0; k < 4; k++) { const [x, z] = at(-r * .2 + col * r * .62 - r * .18 - r * .17 + k * r * .113, (row - 1) * r * .46), yy = y + .11; if (kind === 'tomato') { b.cyl(.006, .006, .26, 'wood', {x, y: yy, z, seg: 4}); for (let t = 0; t < 3; t++) b.sph(.028, col1, {x: x + .02, y: yy + .08 + t * .06, z, seg: 5}); } else if (kind === 'bean') { b.cyl(.006, .006, .3, 'wood', {x, y: yy, z, seg: 4}); poly(b, 'ico', .06, col1, {x, y: yy + .2, z, sy: 1.6, sway: .5}); } else if (kind === 'carrot') { for (let t = 0; t < 3; t++) cone2(b, .015, .1, '#6fb04a', {x: x + (t - 1) * .025, y: yy + .06, z, seg: 4, sway: .6}); } else if (kind === 'pumpkin') b.sph(.065, col1, {x, y: yy + .05, z, sy: .75, seg: 8}); else poly(b, 'ico', .075, col1, {x, y: yy + .06, z, sy: .8}); } }
  // shed, butt, scarecrow, barrow, compost
  const [sx, sz] = at(r * .62, -r * .45), sy = heightAt(sx, sz); b.push(sx, sy, sz, -gap + Math.PI * .15); b.box(.4, .3, .3, '#a3744a', {y: 0, r: .01}); b.gable(.34, .16, .38, winter ? SNOW : '#8a5a3c', {y: .3}); b.box(.1, .2, .02, '#3a2a20', {y: 0, z: .16}); b.pop();
  const [wx, wz] = at(r * .62, -r * .1); b.cyl(.06, .06, .14, '#3f7fc0', {x: wx, y: heightAt(wx, wz), z: wz, seg: 8});
  const [cx, cz] = at(r * .5, r * .5), cy = heightAt(cx, cz); b.cyl(.012, .012, .5, 'wood', {x: cx, y: cy, z: cz, seg: 5}); b.box(.3, .02, .02, 'wood', {x: cx, y: cy + .36, z: cz, ry: -gap}); b.sph(.05, '#e8d29a', {x: cx, y: cy + .52, z: cz, seg: 8}); cone2(b, .075, .08, '#8a5a3c', {x: cx, y: cy + .6, z: cz, seg: 8}); b.box(.12, .14, .02, '#6f7fb0', {x: cx, y: cy + .22, z: cz, ry: -gap});
  const [bx2, bz2] = at(-r * .75, r * .4), by = heightAt(bx2, bz2); b.push(bx2, by, bz2, -gap + .5); b.box(.12, .05, .2, '#c8473b', {y: .08}); b.cyl(.04, .04, .02, 'black', {y: .04, z: .12, rz: Math.PI / 2, centre: true, seg: 8}); b.pop();
  const [hx, hz] = at(-r * .55, -r * .6); b.sph(.12, winter ? '#9fb4a8' : '#6a8a3a', {x: hx, y: heightAt(hx, hz) + .04, z: hz, sy: .5, seg: 8});
}

export function buildGardens(season, material) {
  const b = new Bag(), glass = [], bloom = BLOOM[season], winter = season === 'winter', S = winter ? .5 : 1;
  for (const p of PLOTS) {
    const y = heightAt(p.x, p.z) + .01, r = p.r, R = k => rand(p.seed * 17 + k), pick = (cs, k) => cs[Math.floor(R(k) * cs.length)], cs = bloom[p.kind] || bloom.wild;
    const gap = Math.atan2(-p.z, -p.x);   // the opening of the border faces the middle of the town
    const builders = {orchard: orchardGarden, maze: mazeGarden, water: waterGarden, pavilion: pavilionGarden, wild: wildGarden, allotment: allotmentGarden};
    if (builders[p.kind]) builders[p.kind](b, p, season, R, gap, y, cs);
    else if (p.kind === 'greenhouse') {
      b.cyl(r, r + .03, .035, winter ? '#ece8e0' : '#b9ad96', {x: p.x, y, z: p.z, seg: 28}); ring(b, p, y, r, gap);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + .3, x = p.x + Math.cos(a) * r * .8, z = p.z + Math.sin(a) * r * .8; b.cyl(.06, .05, .08, '#c8604a', {x, y: heightAt(x, z), z, seg: 7}); if (!winter) poly(b, 'ico', .06, k % 2 ? 'leaf' : 'lime', {x, y: heightAt(x, z) + .12, z, sy: .8}); }
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

/* ---------------- what the town has bought (see chest.mjs) ---------------- */
export function buildUpgrades(bought, material) {
  const g = new THREE.Group(), b = new Bag(), gl = new Bag(), out = {group: g, boat2: null, beam: null, lamp: null};
  if (bought.includes('bunting')) {
    const cols = ['red', 'yellow', 'sky', 'pink', 'green', 'orange'];
    for (const dz of [-.34, .34]) { const pts = []; for (let i = 0; i <= 10; i++) { const f = i / 10, x = PIER.x0 + .4 + f * (PIER.x1 - PIER.x0 - .8); pts.push([x, .82 - Math.sin(f * Math.PI * 4) * .04 - .0, PIER.z + dz]); } b.tube(pts, .008, 'white'); pts.forEach((p, i) => { if (i % 1 === 0 && i < pts.length) cone2(b, .06, .12, cols[(i + (dz > 0 ? 3 : 0)) % cols.length], {x: p[0], y: p[1] - .08, z: p[2], rx: Math.PI, sz: .3, seg: 3}); }); }
    for (let i = 0; i <= 4; i++) for (const dz of [-.34, .34]) b.cyl(.015, .02, .8, 'white', {x: PIER.x0 + .4 + i * (PIER.x1 - PIER.x0 - .8) / 4, y: .24, z: PIER.z + dz, seg: 5});
  }
  if (bought.includes('pierlights')) {
    const n = 12; for (let i = 0; i < n; i++) for (const dz of [-.4, .4]) { const x = PIER.x0 + (i + .5) * (PIER.x1 - PIER.x0) / n; b.cyl(.012, .015, .3, 'slate', {x, y: .24, z: PIER.z + dz, seg: 5}); gl.sph(.045, '#ffe08a', {x, y: .58, z: PIER.z + dz, seg: 6, glow: true}); }
  }
  if (bought.includes('fountain')) {
    const p = freeSpot(1.1);
    if (p) { const y = heightAt(p.x, p.z), x = p.x, z = p.z; b.cyl(1.0, 1.04, .03, '#8fd16a', {x, y, z, seg: 24});
      b.cyl(.58, .64, .17, 'stone', {x, y: y + .02, z, seg: 20}); b.cyl(.46, .46, .05, '#6fcdea', {x, y: y + .16, z, seg: 20}); b.cyl(.09, .12, .5, 'stone', {x, y: y + .16, z, seg: 10}); b.cyl(.28, .08, .06, 'stone', {x, y: y + .62, z, seg: 14}); b.sph(.08, '#cfeeff', {x, y: y + .84, z, seg: 8});
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.sph(.032, '#cfeeff', {x: x + Math.cos(a) * .22, y: y + .54, z: z + Math.sin(a) * .22, seg: 6}); }
      for (const a of [Math.PI * .25, Math.PI * 1.25]) { const bx = x + Math.cos(a) * .95, bz = z + Math.sin(a) * .95; b.push(bx, heightAt(bx, bz), bz, -a + Math.PI / 2); b.box(.5, .05, .18, 'wood', {y: .2, r: .01}); b.box(.5, .2, .04, 'wood', {y: .24, z: -.08, r: .01}); for (const sx of [-.2, .2]) b.box(.04, .2, .14, 'slate', {x: sx}); b.pop(); } }
  }
  if (bought.includes('secondboat')) { const bt = buildBoat2(material); bt.position.set(PIER.x1 + .1, -.02, PIER.z - 1.3); bt.rotation.y = Math.PI / 2 + .12; out.boat2 = bt; g.add(bt); }
  if (bought.includes('lighthouse')) {
    const f = ISLET.face, y0 = ISLAND.sea; b.push(ISLET.x, y0, ISLET.z, f, ISLET.s); gl.push(ISLET.x, y0, ISLET.z, f, ISLET.s);
    const x = -.25, z = -.75, top = 1.55; b.cyl(.32, .4, .26, '#8d8a86', {x, y: top - .2, z, seg: 12});   // a stone footing on the rocks
    for (let k = 0; k < 5; k++) b.cyl(.27 - k * .02, .3 - k * .02, .32, k % 2 ? 'red' : 'white', {x, y: top + k * .32, z, seg: 14});
    b.cyl(.34, .34, .05, 'slate', {x, y: top + 1.6, z, seg: 14}); b.cyl(.2, .2, .26, '#bfe6f7', {x, y: top + 1.65, z, seg: 12}); cone2(b, .3, .26, 'red', {x, y: top + 1.98, z, seg: 12}); b.sph(.05, 'gold', {x, y: top + 2.14, z, seg: 6});
    gl.sph(.16, '#fff2b0', {x, y: top + 1.78, z, seg: 8, glow: true}); b.pop(); gl.pop();
    // the beam: two soft wedges that turn round the lamp (world frame)
    const beam = new THREE.Group(), wedge = new THREE.Mesh(new THREE.ConeGeometry(1.1, 9, 16, 1, true).rotateZ(-Math.PI / 2).translate(4.6, 0, 0), new THREE.MeshBasicMaterial({color: '#fff2b0', transparent: true, opacity: .0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false}));
    beam.add(wedge); const w2 = wedge.clone(); w2.rotation.y = Math.PI; beam.add(w2); const lx = ISLET.x + (x * Math.cos(f) + z * Math.sin(f)) * ISLET.s, lz = ISLET.z + (-x * Math.sin(f) + z * Math.cos(f)) * ISLET.s; beam.position.set(lx, y0 + (top + 1.78) * ISLET.s, lz); beam.visible = false; out.beam = beam; g.add(beam); out.lampMat = wedge.material;
  }
  if (b.parts.length) { const m = b.mesh(material); m.castShadow = false; g.add(m); }
  const glow = gl.glowMesh(new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: 1, depthWrite: false, fog: false})); if (glow) { glow.renderOrder = 2; g.add(glow); out.glow = glow; }
  return out;
}
function buildBoat2(material) { const b = new Bag(); b.box(.46, .18, .95, 'blue', {y: -.05, r: .1}); b.box(.5, .05, .98, 'white', {y: .12, r: .02}); b.box(.3, .24, .3, 'yellow', {y: .16, z: -.1, r: .04}); b.box(.34, .04, .34, 'red', {y: .38, z: -.1, r: .02}); b.cyl(.02, .02, .7, 'wood', {y: .16, z: .25, seg: 6}); b.box(.26, .34, .02, 'cream', {y: .5, z: .25, r: .01}); const m = b.mesh(material); const g = new THREE.Group(); g.add(m); g.scale.setScalar(1.05); return g; }
