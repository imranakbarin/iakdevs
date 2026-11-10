// New Toy Town: the builders. Everything static is drawn into a "bag" of coloured geometry that becomes one mesh
// (vertex colours, one material), so the whole town costs a handful of draw calls. Moving parts (clock hands, the
// spinning top, the windmill's sails, residents, vehicles, clouds) are returned as their own small meshes.
// Shapes are fat and rounded on purpose: toy-box buildings, nothing sharp.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PALETTE as P, ISLAND, SQUARE, ROAD, SPOKES, BUILDINGS, TREES, BUS_STOPS, TRACK, PADDOCK, POND, JETTY, heightAt, shore, rand, doorOf} from './def.mjs';
import {along, leftOf} from './graph.mjs';

// Seasons recolour the foliage and the grass (and nothing else) when the town is built.
const SEASONAL = {}, SEASON_COLOURS = {
  summer: {},
  spring: {leaf: '#4fbf70', leafLight: '#f4b3cc', grass: '#9ad96e', grassDark: '#82c862'},
  autumn: {leaf: '#d9822b', leafLight: '#e8b83a', grass: '#b9c45c', grassDark: '#a5b04e'},
  winter: {leaf: '#3d7a5a', leafLight: '#e4eef5', grass: '#eef4f8', grassDark: '#d6e4ee'}
};
export function setSeason(name) { for (const k in SEASONAL) delete SEASONAL[k]; Object.assign(SEASONAL, SEASON_COLOURS[name] || {}); }
const TAU = Math.PI * 2, col = c => new THREE.Color(SEASONAL[c] || P[c] || c);
const lighten = (c, k) => '#' + col(c).lerp(new THREE.Color('#ffffff'), k).getHexString(), darken = (c, k) => '#' + col(c).lerp(new THREE.Color('#1c2430'), k).getHexString();

/* ---------------- the bag ---------------- */
const cache = new Map();
function prim(key, make) { if (!cache.has(key)) { let g = make(); if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); cache.set(key, g); } return cache.get(key); }
export class Bag {
  constructor() { this.parts = []; this.glowParts = []; this.stack = [new THREE.Matrix4()]; }
  get top() { return this.stack[this.stack.length - 1]; }
  // enter a local frame: position, turn about y, uniform scale
  push(x = 0, y = 0, z = 0, ry = 0, s = 1) { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s)); this.stack.push(this.top.clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, colour, o = {}) {
    const g = geo.clone(), m = new THREE.Matrix4().compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new THREE.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    g.applyMatrix4(this.top.clone().multiply(m));
    const c = col(colour), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); (o.glow ? this.glowParts : this.parts).push(g); return this;
  }
  // a rounded box standing on y (its base at o.y unless o.centre)
  box(w, h, d, colour, o = {}) { const r = Math.min(o.r ?? .06, w / 2 - .001, h / 2 - .001, d / 2 - .001); const seg = Math.max(w, h, d) > .7 ? 2 : 1; return this.add(prim(`box:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, seg, r)), colour, {...o, y: (o.y || 0) + (o.centre ? 0 : h / 2)}); }
  cyl(rt, rb, h, colour, o = {}) { return this.add(prim(`cyl:${rt}:${rb}:${h}:${o.seg || 20}`, () => new THREE.CylinderGeometry(rt, rb, h, o.seg || 20)), colour, {...o, y: (o.y || 0) + (o.centre ? 0 : h / 2)}); }
  sph(r, colour, o = {}) { const seg = o.seg || (r < .12 ? 8 : r < .3 ? 12 : 18); return this.add(prim(`sph:${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(5, Math.round(seg * .7)))), colour, o); }
  dome(r, colour, o = {}) { return this.add(prim(`dome:${r}`, () => new THREE.SphereGeometry(r, 22, 10, 0, TAU, 0, Math.PI / 2)), colour, o); }
  cone(r, h, colour, o = {}) { return this.add(prim(`cone:${r}:${h}:${o.seg || 20}`, () => new THREE.ConeGeometry(r, h, o.seg || 20)), colour, {...o, y: (o.y || 0) + h / 2}); }
  torus(r, t, colour, o = {}) { return this.add(prim(`tor:${r}:${t}:${o.arc || TAU}`, () => new THREE.TorusGeometry(r, t, 10, 28, o.arc || TAU)), colour, o); }
  // a chunky gable roof: ridge along x, w wide (x), h high, d deep (z), with soft edges
  gable(w, h, d, colour, o = {}) {
    return this.add(prim(`gable:${w}:${h}:${d}`, () => { const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {depth: w, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 3, curveSegments: 4}); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2); return g; }), colour, o);
  }
  tube(points, r, colour, o = {}) { const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))); let g = new THREE.TubeGeometry(curve, 24, r, 10, false); g = g.toNonIndexed(); g.deleteAttribute('uv'); return this.add(g, colour, o); }
  // the lit panes and lanterns, gathered apart so they can be switched on at dusk
  glowMesh(material) { if (!this.glowParts.length) return null; const g = mergeGeometries(this.glowParts, false); g.computeBoundingSphere(); this.glowParts = []; return new THREE.Mesh(g, material); }
  mesh(material) { const g = mergeGeometries(this.parts, false); g.computeBoundingSphere(); const m = new THREE.Mesh(g, material); this.parts = []; return m; }
}
const WARM = '#ffcf70';
export const toyMaterial = () => new THREE.MeshLambertMaterial({vertexColors: true});

/* ---------------- common pieces ---------------- */
// A front door with a rounded top, a white frame, a knob and a step. The doorway stands at local (x, 0, z) facing +z.
function door(b, x, z, colour, w = .36, h = .62) {
  b.box(w + .1, h + .06, .06, 'white', {x, z: z - .012, r: .05});
  b.cyl(w / 2 + .05, w / 2 + .05, .06, 'white', {x, y: h + .03, z: z - .012, rx: Math.PI / 2, centre: true});
  b.box(w, h, .07, colour, {x, z, r: .04}); b.cyl(w / 2, w / 2, .07, colour, {x, y: h, z, rx: Math.PI / 2, centre: true});
  b.sph(.03, 'gold', {x: x + w * .28, y: h * .5, z: z + .04}); b.box(w + .22, .06, .2, 'stone', {x, z: z + .1, r: .025});
}
// A window: white frame, sky pane, glazing bars, a sill; optional shutters and a flower box.
function win(b, x, y, z, w = .34, h = .36, o = {}) {
  b.box(w + .08, h + .08, .05, 'white', {x, y: y - h / 2 - .04, z: z - .01, r: .03});
  b.box(w, h, .05, o.pane || '#bfe6f7', {x, y: y - h / 2, z: z + .006, r: .02});
  b.box(.03, h, .05, 'white', {x, y: y - h / 2, z: z + .014, r: .01}); b.box(w, .03, .05, 'white', {x, y: y - .015, z: z + .014, r: .01});
  b.box(w * .86, h * .86, .02, WARM, {x, y: y - h / 2 + h * .07, z: z + .043, r: .01, glow: true});
  b.box(w + .14, .045, .1, 'white', {x, y: y - h / 2 - .075, z: z + .03, r: .02});
  if (o.shutters) for (const s of [-1, 1]) b.box(.11, h + .04, .035, o.shutters, {x: x + s * (w / 2 + .1), y: y - h / 2 - .02, z: z + .004, r: .02});
  if (o.flowers) { b.box(w + .1, .08, .1, 'wood', {x, y: y - h / 2 - .15, z: z + .07, r: .03}); for (let k = 0; k < 4; k++) b.sph(.045, ['red', 'yellow', 'pink', 'white'][(k + (o.flowers | 0)) % 4], {x: x - w / 2 + .05 + k * (w / 3 - .01), y: y - h / 2 - .05, z: z + .08, seg: 8}); }
}
function roundWin(b, x, y, z, r = .17) { b.cyl(r * .85, r * .85, .02, WARM, {x, y, z: z + .042, rx: Math.PI / 2, centre: true, glow: true}); b.cyl(r + .045, r + .045, .05, 'white', {x, y, z: z - .008, rx: Math.PI / 2, centre: true}); b.cyl(r, r, .05, '#bfe6f7', {x, y, z: z + .008, rx: Math.PI / 2, centre: true}); b.box(.028, r * 2, .05, 'white', {x, y: y - r, z: z + .016, r: .01}); b.box(r * 2, .028, .05, 'white', {x, y: y - .014, z: z + .016, r: .01}); }
// A striped awning sloping out over a shopfront.
function awning(b, x, y, z, w, d, a, c) { const n = Math.max(4, Math.round(w / .16)); for (let k = 0; k < n; k++) b.box(w / n + .004, .05, d, k % 2 ? a : c, {x: x - w / 2 + (k + .5) * w / n, y, z: z + d / 2 - .02, rx: .32, r: .02}); for (let k = 0; k < n; k++) b.sph(w / n / 2, k % 2 ? a : c, {x: x - w / 2 + (k + .5) * w / n, y: y - d * .3 - .01, z: z + d - .04, sy: .55, sz: .3, seg: 8}); }
function chimney(b, x, y, z, colour = 'red', lean = .09) { b.box(.2, .42, .2, colour, {x, y, z, rz: lean, r: .04}); b.box(.26, .07, .26, 'cream', {x: x - lean * .42, y: y + .4, z, rz: lean, r: .03}); b.cyl(.06, .07, .1, 'slate', {x: x - lean * .5, y: y + .46, z, rz: lean}); }
function smoke(b, x, y, z) { [[0, 0, .09], [.07, .16, .12], [-.03, .36, .15], [.09, .58, .17]].forEach(([dx, dy, r]) => b.sph(r, 'white', {x: x + dx, y: y + dy, z, seg: 10})); }
function tub(b, x, z, flower = 'red') { b.cyl(.085, .065, .11, 'orange', {x, z, seg: 12}); b.sph(.075, 'leaf', {x, y: .14, z, seg: 8}); b.sph(.04, flower, {x: x + .03, y: .2, z: z + .02, seg: 8}); b.sph(.035, 'yellow', {x: x - .04, y: .19, z: z - .02, seg: 8}); }
function picket(b, x0, z0, x1, z1) { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / .13)); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; b.box(.07, .26, .035, 'white', {x, z, ry: Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, r: .015}); b.cone(.04, .06, 'white', {x, y: .25, z, seg: 4}); } const a = Math.atan2(x1 - x0, z1 - z0); b.box(.03, .035, Math.hypot(x1 - x0, z1 - z0), 'white', {x: (x0 + x1) / 2, y: .14, z: (z0 + z1) / 2, ry: a, r: .01}); }
function lamp(b, x, z) { b.cyl(.07, .09, .1, 'slate', {x, z, seg: 10}); b.cyl(.028, .035, 1.0, 'slate', {x, y: .08, z, seg: 8}); b.box(.16, .2, .16, '#fff4c4', {x, y: 1.06, z, r: .04}); b.sph(.13, WARM, {x, y: 1.16, z, seg: 8, glow: true}); b.cone(.15, .12, 'slate', {x, y: 1.26, z, seg: 4, ry: Math.PI / 4}); b.sph(.03, 'gold', {x, y: 1.4, z, seg: 8}); }
function bench(b, x, z, ry) { b.push(x, 0, z, ry); for (const s of [-1, 1]) { b.box(.05, .2, .26, 'slate', {x: s * .3, r: .02}); } for (let k = 0; k < 3; k++) b.box(.72, .035, .07, 'wood', {y: .2, z: -.09 + k * .09, r: .015}); for (let k = 0; k < 2; k++) b.box(.72, .07, .03, 'wood', {y: .3 + k * .1, z: -.15, r: .012}); b.pop(); }
function pillarBox(b, x, z) { b.cyl(.13, .14, .08, 'black', {x, z, seg: 14}); b.cyl(.12, .12, .44, 'red', {x, y: .07, z, seg: 14}); b.cyl(.14, .14, .04, 'red', {x, y: .5, z, seg: 14}); b.dome(.13, 'red', {x, y: .53, z, sy: .55}); b.box(.12, .025, .02, 'black', {x, y: .4, z: z + .115, r: .008}); b.box(.09, .08, .015, 'white', {x, y: .24, z: z + .118, r: .008}); }

/* ---------------- landmarks (local origin on the ground, front is +z) ---------------- */
const BUILD = {
  clockTower(b, def, anim) {
    b.cyl(1.25, 1.3, .14, 'stone', {seg: 28}); b.cyl(1.05, 1.1, .12, 'kerb', {y: .14, seg: 28});
    for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; b.sph(.085, 'leaf', {x: Math.cos(a) * 1.13, y: .3, z: Math.sin(a) * 1.13, seg: 8}); b.sph(.06, ['red', 'yellow', 'pink', 'white', 'purple', 'orange'][k % 6], {x: Math.cos(a + .08) * 1.13, y: .38, z: Math.sin(a + .08) * 1.13, seg: 8}); }
    b.box(1.02, 1.5, 1.02, 'cream', {y: .22, r: .1}); b.box(1.14, .14, 1.14, 'red', {y: 1.68, r: .05}); b.box(.92, .9, .92, 'yellow', {y: 1.8, r: .1}); b.box(1.1, .12, 1.1, 'red', {y: 2.66, r: .05});
    b.box(1.3, 1.16, 1.3, 'sky', {y: 2.76, r: .14});
    for (let k = 0; k < 4; k++) { b.push(0, 3.34, 0, k * Math.PI / 2); b.cyl(.5, .5, .06, 'gold', {z: .66, rx: Math.PI / 2, centre: true, seg: 28}); b.cyl(.44, .44, .07, 'white', {z: .67, rx: Math.PI / 2, centre: true, seg: 28}); for (let m = 0; m < 12; m++) { const a = m / 12 * TAU; b.box(m % 3 ? .025 : .04, m % 3 ? .05 : .09, .02, 'black', {x: Math.sin(a) * .36, y: Math.cos(a) * .36 - (m % 3 ? .025 : .045), z: .705, rz: -a, r: .005}); } b.sph(.04, 'red', {z: .72, seg: 8}); b.pop(); }
    b.cone(1.12, 1.05, 'red', {y: 3.92, seg: 4, ry: Math.PI / 4}); b.box(1.5, .1, 1.5, 'cream', {y: 3.88, r: .04}); b.sph(.13, 'gold', {y: 5.02, seg: 12}); b.cyl(.015, .015, .34, 'gold', {y: 5.08, seg: 6}); b.cone(.09, .2, 'gold', {y: 5.4, rz: -Math.PI / 2, x: .1, seg: 4});
    door(b, 0, .53, 'red', .4, .66); for (const s of [-1, 1]) { b.push(0, 0, 0, s * Math.PI / 2); win(b, 0, 1.28, .52, .3, .4, {shutters: 'red'}); b.pop(); } b.push(0, 0, 0, Math.PI); win(b, 0, 1.28, .52, .3, .4, {shutters: 'red'}); b.pop();
    for (let k = 0; k < 4; k++) { b.push(0, 0, 0, k * Math.PI / 2); roundWin(b, 0, 2.26, .47, .16); b.pop(); }
    anim.clock = {y: 3.34};
  },
  bandstand(b) {
    b.cyl(1.3, 1.36, .12, 'red', {seg: 8}); b.cyl(1.22, 1.22, .16, 'cream', {y: .12, seg: 8}); b.cyl(1.16, 1.16, .03, 'wood', {y: .28, seg: 8});
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + TAU / 16, x = Math.cos(a) * 1.08, z = Math.sin(a) * 1.08; b.cyl(.05, .055, 1.25, 'white', {x, y: .28, z, seg: 10}); b.sph(.07, 'gold', {x, y: 1.5, z, seg: 8}); if (k !== 1) { const a2 = (k + 1) / 8 * TAU + TAU / 16, x2 = Math.cos(a2) * 1.08, z2 = Math.sin(a2) * 1.08; b.box(.03, .04, Math.hypot(x2 - x, z2 - z), 'white', {x: (x + x2) / 2, y: .66, z: (z + z2) / 2, ry: Math.atan2(x2 - x, z2 - z), r: .01}); for (let m = 1; m < 4; m++) b.cyl(.016, .016, .36, 'white', {x: x + (x2 - x) * m / 4, y: .3, z: z + (z2 - z) * m / 4, seg: 6}); } }
    b.cyl(1.42, 1.42, .08, 'white', {y: 1.52, seg: 8}); b.cone(1.5, .72, 'red', {y: 1.58, seg: 8}); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.sph(.11, k % 2 ? 'yellow' : 'white', {x: Math.cos(a) * 1.44, y: 1.5, z: Math.sin(a) * 1.44, seg: 8}); }
    b.sph(.14, 'gold', {y: 2.36, seg: 10}); b.cone(.07, .3, 'gold', {y: 2.44, seg: 8});
    const a = TAU / 16 * 3; for (let k = 0; k < 2; k++) b.box(.55, .1 - k * .0, .22, 'stone', {x: Math.cos(a) * (1.45 + k * .2), y: .1 - k * .09, z: Math.sin(a) * (1.45 + k * .2), ry: -a + Math.PI / 2, r: .03});
    // a drum and a tuba left on the stand
    b.cyl(.2, .2, .2, 'red', {x: -.3, y: .31, z: .1, seg: 16}); b.cyl(.21, .21, .03, 'white', {x: -.3, y: .5, z: .1, seg: 16}); b.cone(.2, .34, 'gold', {x: .35, y: .5, z: -.15, rx: Math.PI, seg: 14}); b.cyl(.04, .04, .3, 'gold', {x: .35, y: .31, z: -.15, seg: 8});
  },
  teapotCafe(b) {
    b.cyl(.9, .98, .14, 'red', {seg: 28});
    b.sph(1.18, 'yellow', {y: 1.12, sy: .88, seg: 28});
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + .22, v = k % 2 ? .38 : -.2, r = 1.18 * Math.cos(v); if (Math.abs(Math.sin(a)) > .8 && Math.cos(a) > -.2 && v < 0 && Math.sin(a) > 0) continue; b.sph(.13, 'white', {x: Math.cos(a) * r * 1.0, y: 1.12 + Math.sin(v) * 1.18 * .88, z: Math.sin(a) * r, sx: 1, sy: 1, sz: 1, seg: 10, s: 1}); }
    b.torus(.6, .07, 'red', {y: 2.08, rx: Math.PI / 2}); b.sph(.62, 'red', {y: 2.08, sy: .4, seg: 20}); b.sph(.15, 'gold', {y: 2.42, seg: 12});
    b.tube([[1.0, .95, 0], [1.42, 1.1, 0], [1.6, 1.55, 0], [1.86, 1.86, 0]], .2, 'yellow'); b.torus(.2, .05, 'red', {x: 1.88, y: 1.88, rz: -.75, ry: Math.PI / 2});
    b.torus(.52, .12, 'yellow', {x: -1.18, y: 1.18, arc: Math.PI * 1.15, rz: Math.PI * .92});
    b.cyl(.36, .36, .5, 'yellow', {y: .1, z: 1.0, seg: 16, sx: 1.25});   // porch
    door(b, 0, 1.24, 'red', .4, .64); awning(b, 0, .98, 1.2, 1.0, .42, 'red', 'white');
    b.push(0, 0, 0, .62); roundWin(b, 0, 1.0, 1.17, .2); b.pop(); b.push(0, 0, 0, -.62); roundWin(b, 0, 1.0, 1.17, .2); b.pop();
    // tables with parasols outside
    for (const [x, z, c] of [[-1.35, 1.75, 'red'], [1.3, 1.85, 'blue']]) { b.cyl(.26, .26, .04, 'white', {x, y: .3, z, seg: 16}); b.cyl(.03, .05, .3, 'slate', {x, z, seg: 8}); b.cyl(.018, .018, .75, 'wood', {x, y: .3, z, seg: 6}); b.cone(.46, .22, c, {x, y: 1.0, z, seg: 8}); b.cone(.46, .22, 'white', {x, y: 1.0, z, seg: 8, ry: TAU / 16, s: .995}); for (const s of [-1, 1]) { b.cyl(.09, .09, .18, 'wood', {x: x + s * .4, z, seg: 10}); } b.cyl(.05, .04, .07, 'white', {x: x + .08, y: .34, z, seg: 8}); }
  },
  toyShop(b, def, anim) {
    b.box(2.0, 1.25, 1.5, 'blue', {r: .12}); b.box(2.14, .14, 1.64, 'cream', {y: 1.22, r: .06}); b.box(2.04, .1, 1.54, 'red', {y: 1.34, r: .04});
    b.box(1.02, .62, .08, 'white', {x: -.36, y: .3, z: .74, r: .05}); b.box(.92, .52, .09, '#bfe6f7', {x: -.36, y: .35, z: .75, r: .03}); b.box(.03, .52, .1, 'white', {x: -.36, y: .35, z: .76}); b.box(1.12, .06, .16, 'white', {x: -.36, y: .26, z: .78, r: .02});
    [['red', -.66, .1], ['yellow', -.42, .13], ['green', -.2, .1], ['purple', -.54, .1]].forEach(([c, x, s], i) => i < 3 ? b.box(s * 1.6, s * 1.6, s * 1.2, c, {x, y: .37 + (i === 3 ? .16 : 0), z: .7, r: .02}) : b.sph(.09, c, {x, y: .62, z: .7, seg: 10}));
    b.sph(.1, 'orange', {x: -.08, y: .47, z: .7, seg: 10}); b.cone(.08, .18, 'teal', {x: -.3, y: .56, z: .7, seg: 10});
    door(b, .62, .76, 'red', .38, .64); awning(b, 0, 1.0, .75, 1.9, .46, 'yellow', 'white');
    for (const s of [-1, 1]) { b.push(0, 0, 0, s * Math.PI / 2); win(b, 0, .95, .99, .4, .42, {shutters: 'yellow'}); b.pop(); }
    // alphabet blocks on the roof and a bunch of balloons by the door
    [['red', -.66, 0, .36, .1], ['yellow', -.3, .02, .36, -.2], ['green', -.5, .36, .32, .5]].forEach(([c, x, y, s, r]) => { b.box(s, s, s, c, {x, y: 1.44 + y, z: -.25, ry: r, r: .04}); b.box(s * .5, s * .5, .02, 'white', {x: x + Math.sin(r) * s * .5, y: 1.44 + y + s * .25, z: -.25 + Math.cos(r) * s * .5, ry: r, r: .01}); });
    [['red', 0, 0], ['yellow', .16, .12], ['sky', -.13, .16], ['pink', .05, .3]].forEach(([c, dx, dy]) => { b.sph(.13, c, {x: 1.12 + dx, y: 1.0 + dy, z: .92, sy: 1.15, seg: 12}); b.cyl(.006, .006, .7 + dy, 'white', {x: 1.12 + dx * .5, y: .3, z: .92, rz: -dx * .5, seg: 4}); });
    b.cyl(.07, .09, .3, 'wood', {x: 1.12, z: .92, seg: 8});
    anim.top = {x: .45, y: 1.44, z: -.1};
  },
  bakery(b) {
    b.box(1.9, .92, 1.45, 'cream', {r: .12}); b.cyl(.74, .74, 1.86, 'crust', {y: .98, rz: Math.PI / 2, sx: .62, centre: true, seg: 26});
    for (let k = 0; k < 4; k++) b.box(.07, .06, 1.2, lighten('crust', .45), {x: -.62 + k * .41, y: 1.38 - Math.abs(k - 1.5) * .0, z: 0, ry: .5, r: .03});
    for (const s of [-1, 1]) b.sph(.74, 'crust', {x: s * .93, y: .98, sx: .25, sy: .62, seg: 20});
    chimney(b, .55, 1.25, -.35, 'red', -.08); smoke(b, .6, 1.85, -.35);
    b.box(.9, .56, .08, 'white', {x: -.4, y: .28, z: .72, r: .05}); b.box(.8, .46, .09, '#bfe6f7', {x: -.4, y: .33, z: .73, r: .03}); b.box(.94, .05, .16, 'wood', {x: -.4, y: .3, z: .74, r: .02});
    for (let k = 0; k < 3; k++) b.sph(.085, 'crust', {x: -.66 + k * .2, y: .41, z: .7, sy: .7, seg: 10}); b.cyl(.04, .04, .34, lighten('crust', .2), {x: -.2, y: .52, z: .7, rz: .5, centre: true, seg: 8}); b.cyl(.04, .04, .34, lighten('crust', .2), {x: -.12, y: .52, z: .7, rz: .62, centre: true, seg: 8});
    door(b, .52, .74, 'brown', .38, .62); awning(b, 0, .94, .72, 1.8, .44, 'orange', 'white');
    b.cyl(.02, .02, .4, 'slate', {x: .98, y: 1.0, z: .5, rx: Math.PI / 2, centre: true, seg: 6}); b.torus(.13, .04, 'gold', {x: .98, y: .82, z: .68}); b.torus(.07, .035, 'gold', {x: .98, y: .86, z: .68});
    for (const s of [-1, 1]) { b.push(0, 0, 0, s * Math.PI / 2); win(b, 0, .72, .955, .36, .36, {flowers: 1}); b.pop(); }
    tub(b, -1.0, .95, 'red'); tub(b, 1.05, .95, 'pink');
  },
  postOffice(b) {
    b.box(1.75, 1.2, 1.4, 'red', {r: .11}); b.box(1.9, .12, 1.55, 'cream', {y: 1.18, r: .05}); b.gable(1.5, .42, 1.2, 'slate', {y: 1.3, sx: 1});
    b.box(.86, .52, .05, 'white', {x: -.32, y: .56, z: .71, r: .03}); b.box(.03, .5, .06, 'red', {x: -.52, y: .575, z: .716, rz: -1.02, r: .01}); b.box(.03, .5, .06, 'red', {x: -.12, y: .575, z: .716, rz: 1.02, r: .01});
    b.box(.9, .05, .08, 'gold', {x: -.32, y: .5, z: .72, r: .02});
    door(b, .5, .71, 'blue', .38, .62); win(b, -.32, .46, .7, .5, .3);
    for (const s of [-1, 1]) { b.push(0, 0, 0, s * Math.PI / 2); win(b, 0, .86, .875, .36, .4, {shutters: 'cream'}); b.pop(); }
    b.cyl(.02, .02, .8, 'slate', {x: .6, y: 1.3, z: 0, seg: 6}); b.box(.34, .2, .02, 'yellow', {x: .78, y: 1.88, z: 0, r: .01}); b.sph(.035, 'gold', {x: .6, y: 2.12, seg: 8});
    pillarBox(b, 1.15, 1.0); tub(b, -1.05, .9, 'yellow');
  },
  fireStation(b) {
    b.box(2.1, 1.15, 1.5, 'red', {r: .11}); b.box(2.24, .13, 1.64, 'cream', {y: 1.13, r: .05});
    for (const x of [-.52, .42]) { b.box(.78, .86, .07, 'white', {x, z: .74, r: .05}); b.cyl(.39, .39, .07, 'white', {x, y: .86, z: .74, rx: Math.PI / 2, centre: true}); for (let k = 0; k < 3; k++) b.box(.7, .02, .08, 'stone', {x, y: .2 + k * .2, z: .75}); b.box(.3, .16, .08, '#bfe6f7', {x, y: .74, z: .752, r: .03}); }
    b.box(.6, 2.3, .6, 'cream', {x: -1.2, z: -.3, r: .08}); b.box(.72, .1, .72, 'red', {x: -1.2, y: 1.7, z: -.3, r: .04});
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.cyl(.04, .04, .5, 'white', {x: -1.2 + sx * .24, y: 2.3, z: -.3 + sz * .24, seg: 8});
    b.cone(.52, .5, 'red', {x: -1.2, y: 2.8, z: -.3, seg: 4, ry: Math.PI / 4}); b.sph(.07, 'gold', {x: -1.2, y: 3.3, z: -.3, seg: 8});
    b.cone(.17, .24, 'gold', {x: -1.2, y: 2.4, z: -.3, seg: 14}); b.sph(.05, 'gold', {x: -1.2, y: 2.4, z: -.3, seg: 8});
    roundWin(b, -1.2, 1.2, .01, .15); win(b, -1.2, .7, .01, .26, .34);
    // ladder and hose reel on the side wall
    b.push(1.07, 0, .1, Math.PI / 2); for (const s of [-1, 1]) b.box(.035, 1.0, .035, 'yellow', {x: s * .13, y: .08, z: .02, rx: -.06, r: .01}); for (let k = 0; k < 6; k++) b.box(.26, .03, .03, 'yellow', {y: .18 + k * .16, z: .03, r: .01}); b.cyl(.2, .2, .08, 'yellow', {x: -.5, y: .55, z: .03, rx: Math.PI / 2, centre: true, seg: 16}); b.cyl(.1, .1, .1, 'red', {x: -.5, y: .55, z: .04, rx: Math.PI / 2, centre: true, seg: 12}); b.pop();
    b.cyl(.09, .1, .34, 'red', {x: -1.25, z: .95, seg: 10}); b.dome(.09, 'red', {x: -1.25, y: .34, z: .95}); for (const s of [-1, 1]) b.cyl(.035, .035, .08, 'gold', {x: -1.25 + s * .1, y: .2, z: .95, rz: Math.PI / 2, centre: true, seg: 8});   // hydrant
  },
  policeBox(b) {   // a fat round lookout kiosk: teal drum, white band, domed cap, a blue lamp
    b.cyl(.5, .52, .1, 'stone', {seg: 20}); b.cyl(.4, .44, 1.1, 'teal', {y: .08, seg: 20}); b.cyl(.45, .45, .1, 'white', {y: .72, seg: 20});
    b.dome(.5, darken('blue', .3), {y: 1.16, sy: .8, seg: 20}); b.cyl(.06, .07, .12, 'white', {y: 1.52, seg: 10}); b.sph(.08, 'red', {y: 1.7, seg: 10});
    for (let k = 0; k < 3; k++) { b.push(0, 0, 0, k * Math.PI * 2 / 3 + .4); b.box(.22, .24, .03, '#bfe6f7', {y: .84, z: .43, r: .02}); b.pop(); }
    b.push(0, 0, 0, 0); door(b, 0, .46, 'cream', .22, .52); b.pop();
  },
  mushroomCottage(b) {
    b.cyl(.6, .72, 1.0, 'cream', {seg: 24}); b.cyl(.72, .78, .1, 'stone', {seg: 24});
    b.dome(1.28, 'red', {y: .92, sy: .78}); b.cyl(1.26, 1.2, .1, 'cream', {y: .86, seg: 28});
    [[0, .62, 1.0], [.9, .5, .78], [-.95, .52, .7], [.55, 1.02, .3], [-.5, 1.05, .25], [.0, .78, -1.0], [1.0, .7, -.4], [-1.0, .72, -.35], [.1, 1.24, -.35]].forEach(([x, y, z], i) => { const n = new THREE.Vector3(x, (y) * 1.3, z).normalize(); b.sph(.2 - (i % 3) * .035, 'white', {x: n.x * 1.26, y: .92 + n.y * 1.26 * .78, z: n.z * 1.26, sy: .45, rx: Math.atan2(n.z, n.y) * .8, rz: -Math.atan2(n.x, n.y) * .8, seg: 10}); });
    door(b, 0, .66, 'green', .36, .6); b.push(0, 0, 0, .75); roundWin(b, 0, .58, .64, .15); b.pop(); b.push(0, 0, 0, -.75); roundWin(b, 0, .58, .64, .15); b.pop();
    b.box(.2, .7, .2, 'cream', {x: .62, y: 1.25, z: -.3, rz: -.14, r: .05}); b.box(.26, .07, .26, 'red', {x: .71, y: 1.92, z: -.3, rz: -.14, r: .03}); smoke(b, .74, 2.08, -.3);
    for (let k = 0; k < 3; k++) b.cyl(.14, .15, .04, 'stone', {x: (k % 2 ? .1 : -.08), z: .98 + k * .3, seg: 10});
    tub(b, -.55, .85, 'purple'); tub(b, .58, .88, 'yellow'); lampSmall(b, -.5, 1.5);
  },
  cottage(b, def) {
    const wall = def.colour || 'cream', roof = def.roof || 'red';
    b.box(1.5, .1, 1.3, 'stone', {r: .03}); b.box(1.4, .86, 1.2, wall, {y: .06, r: .13});
    b.gable(1.72, .82, 1.56, roof, {y: .9}); b.box(1.78, .06, .12, lighten(roof, .25), {y: 1.7, r: .03});
    chimney(b, .46, 1.22, -.2, 'red', .1); smoke(b, .4, 1.8, -.2);
    door(b, 0, .6, roof, .34, .58); win(b, -.42, .72, .6, .27, .32, {shutters: roof, flowers: 1}); win(b, .42, .72, .6, .27, .32, {shutters: roof, flowers: 2});
    roundWin(b, 0, 1.3, .79, .13);
    for (const s of [-1, 1]) { b.push(0, 0, 0, s * Math.PI / 2); win(b, 0, .7, .7, .27, .32, {shutters: roof}); b.pop(); }
    b.push(0, 0, 0, Math.PI); win(b, -.36, .72, .6, .27, .32, {shutters: roof, flowers: 3}); win(b, .36, .72, .6, .27, .32, {shutters: roof}); roundWin(b, 0, 1.3, .79, .13); b.pop();
    picket(b, -.95, 1.15, -.24, 1.15); picket(b, .24, 1.15, .95, 1.15); picket(b, -.95, 1.15, -.95, .5); picket(b, .95, 1.15, .95, .5);
    for (let k = 0; k < 2; k++) b.cyl(.13, .14, .035, 'stone', {x: (k ? .05 : -.04), z: .82 + k * .22, seg: 10});
    tub(b, -.62, .85, 'red'); tub(b, .62, .85, 'yellow');
    b.cyl(.02, .02, .34, 'wood', {x: .42, z: 1.3, seg: 6}); b.box(.16, .11, .1, 'red', {x: .42, y: .32, z: 1.3, r: .03});
  },
  station(b, def, anim) {
    b.box(2.3, 1.0, 1.3, 'cream', {r: .1}); b.box(2.46, .12, 1.46, 'teal', {y: .98, r: .05}); b.gable(2.2, .5, 1.3, 'red', {y: 1.1});
    b.box(.6, 1.7, .6, 'cream', {x: -.78, z: -.1, r: .08}); b.cone(.46, .5, 'teal', {x: -.78, y: 1.72, z: -.1, seg: 4, ry: Math.PI / 4}); b.sph(.07, 'gold', {x: -.78, y: 2.28, z: -.1, seg: 8});
    b.cyl(.2, .2, .05, 'gold', {x: -.78, y: 1.2, z: .22, rx: Math.PI / 2, centre: true, seg: 22}); b.cyl(.17, .17, .055, 'white', {x: -.78, y: 1.2, z: .225, rx: Math.PI / 2, centre: true, seg: 22}); b.box(.02, .13, .02, 'black', {x: -.78, y: 1.2, z: .26}); b.box(.1, .02, .02, 'black', {x: -.73, y: 1.2, z: .26});
    for (const x of [-.2, .3]) { b.box(.34, .46, .06, 'white', {x, y: .34, z: .67, r: .04}); b.box(.26, .38, .07, '#bfe6f7', {x, y: .38, z: .675, r: .03}); }
    door(b, .85, .66, 'red', .38, .64); b.box(2.2, .06, .5, 'blue', {y: .9, z: .85, r: .02});
    for (let k = 0; k < 9; k++) b.box(.246, .05, .52, k % 2 ? 'white' : 'red', {x: -1.0 + k * .25, y: .9, z: .9, rx: .28, r: .015});
    for (const x of [-.9, .9]) b.cyl(.045, .05, .9, 'white', {x, z: 1.1, seg: 8});
    b.box(1.0, .22, .04, 'white', {x: .35, y: .75, z: .686, r: .02}); b.box(.9, .15, .045, 'blue', {x: .35, y: .78, z: .69, r: .015});
    bench(b, -.5, 1.28, 0); b.cyl(.14, .14, .5, 'slate', {x: 1.15, z: 1.2, seg: 12}); b.cyl(.14, .14, .06, 'red', {x: 1.15, y: .5, z: 1.2, seg: 12});
  },
  school(b) {
    b.box(2.4, .95, 1.35, 'red', {r: .1}); b.box(2.54, .1, 1.5, 'cream', {y: .93, r: .05}); b.gable(2.2, .5, 1.3, 'slate', {y: 1.03});
    b.box(.9, 1.2, .5, 'red', {z: .74, r: .09}); b.box(1.0, .1, .6, 'cream', {y: 1.18, z: .74, r: .04});
    b.cyl(.15, .15, .05, 'white', {y: .98, z: 1.0, rx: Math.PI / 2, centre: true, seg: 20}); b.box(.02, .1, .02, 'black', {y: .98, z: 1.03}); b.box(.07, .02, .02, 'black', {x: .03, y: .98, z: 1.03});
    b.box(.3, .36, .3, 'cream', {y: 1.28, z: .74, r: .06}); b.cone(.26, .34, 'red', {y: 1.62, z: .74, seg: 4, ry: Math.PI / 4}); b.sph(.06, 'gold', {y: 1.98, z: .74, seg: 8});
    door(b, 0, .99, 'blue', .4, .66);
    for (const x of [-.95, -.55, .55, .95]) win(b, x, .78, .68, .26, .34, {shutters: 'yellow'});
    // playground: a slide, a seesaw and a sand pit with a little fence
    b.push(1.9, 0, .2); b.box(.4, .5, .34, 'yellow', {z: -.3, r: .04}); b.box(.26, .06, .8, 'red', {y: .22, z: .3, rx: .5, r: .02}); b.box(.4, .04, .36, 'yellow', {y: .5, z: -.3, r: .02}); b.box(.1, .18, .1, 'wood', {x: -.9}); b.box(.12, .05, .9, 'blue', {x: -.9, y: .2, rx: .15, r: .02}); b.cyl(.28, .3, .04, 'sand', {x: -.1, z: 1.0, seg: 18}); b.pop();
    for (const dx of [-.5, .5]) lampSmall(b, dx, 1.3);
  },
  barn(b) {
    b.box(1.9, .95, 1.5, 'red', {r: .1}); b.box(.06, .95, 1.5, 'white', {x: -.95, r: .02}); b.box(.06, .95, 1.5, 'white', {x: .95, r: .02});
    b.gable(2.0, .78, 1.7, 'brown', {y: .92}); b.box(2.1, .05, .12, 'cream', {y: 1.68, r: .02});
    b.box(.9, .75, .07, 'cream', {z: .76, r: .04}); for (const s of [-1, 1]) { b.box(.4, .72, .08, 'white', {x: s * .22, z: .765, r: .03}); b.box(.034, .74, .09, 'red', {x: s * .22, z: .765, rz: .0}); } b.box(.034, .74, .09, 'red', {z: .77});
    b.box(.9, .06, .09, 'red', {x: 0, y: .38, z: .78, rz: .0}); b.sph(.05, 'gold', {y: 1.0, z: .78, seg: 8}); roundWin(b, 0, 1.28, .84, .14);
    b.cyl(.34, .34, 1.5, 'cream', {x: 1.45, z: -.2, seg: 20}); b.dome(.34, 'slate', {x: 1.45, y: 1.5, z: -.2}); b.cyl(.36, .36, .04, 'red', {x: 1.45, y: .3, z: -.2, seg: 20}); b.cyl(.36, .36, .04, 'red', {x: 1.45, y: .8, z: -.2, seg: 20});
    for (let k = 0; k < 4; k++) b.cyl(.2, .2, .26, 'yellow', {x: -.3 + k * .0, y: .02, z: 1.35, rz: Math.PI / 2, ry: 0, centre: false, seg: 14, sx: 1, sz: 1}); b.cyl(.2, .2, .26, 'gold', {x: .6, z: 1.2, seg: 14}); b.cyl(.2, .2, .26, 'gold', {x: .6, y: .26, z: 1.2, seg: 14});
    tub(b, -1.1, 1.0, 'yellow');
  },
  garage(b) {
    b.box(2.0, .9, 1.4, 'sky', {r: .1}); b.box(2.14, .12, 1.54, 'white', {y: .88, r: .05}); b.box(2.0, .08, 1.4, 'red', {y: 1.0, r: .03});
    for (const x of [-.5, .5]) { b.box(.82, .62, .08, 'white', {x, z: .72, r: .05}); for (let k = 0; k < 4; k++) b.box(.74, .03, .09, 'stone', {x, y: .12 + k * .14, z: .73}); }
    door(b, 0, .0, 'white', .01, .01); b.box(1.9, .24, .06, 'red', {y: .98, z: .74, r: .03}); b.box(1.7, .16, .07, 'white', {y: 1.02, z: .76, r: .03});
    for (let k = 0; k < 6; k++) b.box(.2, .12, .075, k % 2 ? 'black' : 'white', {x: -.85 + k * .34, y: 1.04, z: .78, r: .01});
    // petrol pumps, a sign and a stack of tyres
    for (const x of [-.4, .4]) { b.box(.24, .55, .22, 'red', {x, z: 1.45, r: .05}); b.box(.2, .13, .02, 'cream', {x, y: .38, z: 1.57, r: .01}); b.cyl(.02, .02, .3, 'black', {x: x + .14, y: .25, z: 1.5, seg: 6}); b.sph(.05, 'gold', {x, y: .58, z: 1.45, seg: 8}); }
    b.box(1.5, .05, .7, 'red', {y: 1.22, z: 1.45, r: .02}); for (const x of [-.7, .7]) b.cyl(.03, .03, 1.2, 'white', {x, z: 1.7, seg: 8});
    for (let k = 0; k < 3; k++) b.torus(.1, .045, 'black', {x: 1.25, y: .06 + k * .09, z: .3, rx: Math.PI / 2});
    b.cyl(.02, .02, .8, 'slate', {x: -1.2, z: 1.2, seg: 6}); b.box(.34, .22, .03, 'yellow', {x: -1.2, y: .9, z: 1.2, r: .02}); b.sph(.05, 'red', {x: -1.2, y: .9, z: 1.22, seg: 8});
  },
  harbourHut(b) {
    b.box(1.5, .8, 1.15, 'blue', {r: .1}); for (let k = 0; k < 4; k++) b.box(1.52, .02, 1.17, 'white', {y: .15 + k * .17});
    b.gable(1.6, .5, 1.3, 'white', {y: .78}); b.box(1.7, .07, .09, 'red', {y: 1.25, r: .02});
    door(b, -.35, .58, 'red', .36, .62); roundWin(b, .3, .55, .6, .17); b.push(0, 0, 0, Math.PI / 2); roundWin(b, 0, .5, .78, .15); b.pop();
    b.cyl(.025, .025, 1.5, 'wood', {x: .75, z: .75, seg: 6}); b.box(.4, .26, .02, 'red', {x: .96, y: 1.34, z: .75}); b.box(.4, .09, .025, 'white', {x: .96, y: 1.34, z: .75});
    b.cyl(.13, .14, .3, 'wood', {x: .55, z: .9, seg: 12}); b.torus(.12, .035, 'white', {x: -1.0, y: .5, z: .6}); b.torus(.12, .035, 'red', {x: -1.0, y: .5, z: .61, s: .72});
    for (let k = 0; k < 3; k++) b.box(.34, .22, .24, 'wood', {x: -.95, y: k * .2, z: .95 + (k % 2) * .06, ry: k * .4, r: .03});
    tub(b, 1.0, .75, 'white');
  },
  windmill(b, def, anim) {
    b.cyl(.92, .98, .12, 'stone', {seg: 24}); b.cyl(.5, .84, 2.1, 'white', {y: .1, seg: 24}); b.torus(.74, .05, 'red', {y: .78, rx: Math.PI / 2}); b.cyl(.86, .86, .05, 'wood', {y: 1.0, seg: 24});
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; b.cyl(.016, .016, .22, 'white', {x: Math.cos(a) * .83, y: 1.04, z: Math.sin(a) * .83, seg: 6}); } b.torus(.83, .02, 'white', {y: 1.27, rx: Math.PI / 2});
    b.cyl(.56, .52, .16, 'red', {y: 2.18, seg: 24}); b.dome(.56, 'red', {y: 2.32, sy: .9}); b.sph(.07, 'gold', {y: 2.86, seg: 8});
    b.cyl(.09, .09, .46, 'slate', {y: 2.18, z: .5, rx: Math.PI / 2, centre: true, seg: 10});
    door(b, 0, .83, 'green', .34, .58); roundWin(b, 0, 1.62, .62, .13); b.push(0, 0, 0, Math.PI * .6); roundWin(b, 0, 1.3, .68, .12); b.pop(); b.push(0, 0, 0, -Math.PI * .6); roundWin(b, 0, .62, .8, .12); b.pop();
    for (const [x, z] of [[-.95, .9], [-1.25, .55]]) { b.cyl(.2, .22, .3, 'cream', {x, z, seg: 12}); b.sph(.21, 'cream', {x, y: .3, z, sy: .5, seg: 10}); }   // flour sacks
    anim.sails = {y: 2.18, z: .76};
  }
};
function lampSmall(b, x, z) { b.cyl(.02, .025, .5, 'slate', {x, z, seg: 6}); b.box(.1, .13, .1, '#fff4c4', {x, y: .5, z, r: .03}); b.sph(.09, WARM, {x, y: .56, z, seg: 8, glow: true}); b.cone(.1, .08, 'slate', {x, y: .63, z, seg: 4, ry: Math.PI / 4}); }

/* ---------------- ground, roads, scenery ---------------- */
function terrain() {
  const W = 34, D = 27, nx = 136, nz = 108, g = new THREE.PlaneGeometry(W, D, nx, nz); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, c = new Float32Array(pos.count * 3), grass = col('grass'), dark = col('grassDark'), sand = col('sand'), deep = new THREE.Color('#e9d49a'), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z), s = shore(x, z); pos.setY(i, h);
    const n = .5 + .5 * Math.sin(x * 1.7 + Math.sin(z * 1.3) * 1.4) * Math.cos(z * 1.9 - x * .6);
    t.copy(grass).lerp(dark, n * .55); if (h > .7) t.lerp(new THREE.Color('#a9dd7a'), Math.min(1, (h - .7) * .8));
    if (s > .9) t.lerp(sand, Math.min(1, (s - .9) / .035)); if (s > .97) t.lerp(deep, Math.min(1, (s - .97) / .05));
    c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true})); m.receiveShadow = true; return m;
}
// A flat ribbon following a sampled line between two offsets from its centre, draped on the ground.
function ribbon(parts, L, from, to, colour, lift, s0 = 0, s1 = L.length, step = .22) {
  const c = col(colour), n = Math.max(1, Math.ceil((s1 - s0) / step)), pos = [], colr = [], nor = [];
  const at = k => { const q = along(L, s0 + (s1 - s0) * k / n), [lx, lz] = leftOf(q.tx, q.tz), y = heightAt(q.x, q.z) + lift; return [[q.x + lx * from, y, q.z + lz * from], [q.x + lx * to, y, q.z + lz * to]]; };
  let prev = at(0);
  for (let k = 1; k <= n; k++) { const cur = at(k); for (const v of [prev[0], prev[1], cur[1], prev[0], cur[1], cur[0]]) { pos.push(...v); colr.push(c.r, c.g, c.b); nor.push(0, 1, 0); } prev = cur; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  // make sure the faces look up whichever way the offsets ran
  if ((to - from) > 0) { const p = g.attributes.position.array; for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const a = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = a; } }
  parts.push(g);
}
function disc(parts, x, z, r0, r1, colour, lift, seg = 40) {
  const c = col(colour), pos = [], colr = [], nor = [];
  for (let k = 0; k < seg; k++) { const a = k / seg * TAU, a2 = (k + 1) / seg * TAU, P4 = [[r0, a], [r1, a], [r1, a2], [r0, a2]].map(([r, t]) => { const px = x + Math.cos(t) * r, pz = z + Math.sin(t) * r; return [px, heightAt(px, pz) + lift, pz]; });
    for (const v of [P4[0], P4[2], P4[1], P4[0], P4[3], P4[2]]) { pos.push(...v); colr.push(c.r, c.g, c.b); nor.push(0, 1, 0); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); parts.push(g);
}
function roads(bag, graph) {
  const w = ROAD.width / 2, parts = bag.parts, R = SQUARE.ring;
  // the square: paving out to the shopfronts, the ring road, the green in the middle
  disc(parts, SQUARE.x, SQUARE.z, 0, 5.3, '#f1e2c2', .012, 56);
  for (let k = 0; k < 4; k++) disc(parts, SQUARE.x, SQUARE.z, 3.25 + k * .5, 3.3 + k * .5, '#e3d0a8', .016, 56);
  disc(parts, SQUARE.x, SQUARE.z, R - w, R + w, 'road', .03, 64); disc(parts, SQUARE.x, SQUARE.z, R - w - .1, R - w, 'kerb', .045, 64); disc(parts, SQUARE.x, SQUARE.z, R + w, R + w + .1, 'kerb', .045, 64);
  disc(parts, SQUARE.x, SQUARE.z, 0, R - w - .1, 'grass', .04, 48);
  const dash = (L, s0, s1) => { for (let s = s0; s + .3 < s1; s += .7) ribbon(parts, L, -.025, .025, 'white', .038, s, s + .32, .16); };
  for (const e of graph.edges) {
    if (e.kind === 'ring') { dash(e.line, .15, e.line.length - .15); continue; }
    const L = e.line, start = w + .12;
    ribbon(parts, L, -w, w, 'road', .028, 0, L.length); ribbon(parts, L, w, w + .1, 'kerb', .044, start, L.length); ribbon(parts, L, -w - .1, -w, 'kerb', .044, start, L.length);
    ribbon(parts, L, ROAD.pave - .15, ROAD.pave + .17, '#ead9b8', .02, start + .3, L.length); ribbon(parts, L, -ROAD.pave - .17, -ROAD.pave + .15, '#ead9b8', .02, start + .3, L.length);
    dash(L, start + .4, L.length - .5);
    const end = along(L, L.length); disc(parts, end.x, end.z, 0, .9, 'road', .029, 28); disc(parts, end.x, end.z, .9, 1.0, 'kerb', .044, 28); disc(parts, end.x, end.z, 0, .26, 'grass', .05, 14);
    // zebra crossing where the lane meets the square
    const z0 = along(L, start + .75), [lx, lz] = leftOf(z0.tx, z0.tz); for (let k = -2; k <= 2; k++) { const cx = z0.x + lx * k * .17, cz = z0.z + lz * k * .17, y = heightAt(cx, cz) + .037, hw = .055, hl = .2, pts = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a, b2]) => [cx + lx * a + z0.tx * b2, y, cz + lz * a + z0.tz * b2]); const g = new THREE.BufferGeometry(), c = col('white'), pos = [], colr = [], nor = []; for (const v of [pts[0], pts[2], pts[1], pts[0], pts[3], pts[2]]) { pos.push(...v); colr.push(c.r, c.g, c.b); nor.push(0, 1, 0); } g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.computeVertexNormals(); parts.push(g); }
  }
}
function tree(b, kind, seed) {
  const r = k => rand(seed * 13 + k);
  if (kind === 'bush') { for (let k = 0; k < 3; k++) b.sph(.3 - k * .04, k % 2 ? 'leaf' : 'leafLight', {x: (r(k) - .5) * .4, y: .2 + k * .05, z: (r(k + 5) - .5) * .4, sy: .8, seg: 10}); for (let k = 0; k < 4; k++) b.sph(.05, ['pink', 'white', 'yellow', 'red'][k], {x: (r(k + 9) - .5) * .5, y: .38 + r(k) * .1, z: (r(k + 12) - .5) * .5, seg: 6}); return; }
  if (kind === 'tall') { b.cyl(.08, .11, .5, 'brown', {seg: 8}); [[.42, .62, 'leaf'], [.34, 1.08, 'leafLight'], [.24, 1.46, 'leaf']].forEach(([s, y, c]) => b.sph(s, c, {y, sy: 1.15, seg: 12})); return; }
  b.cyl(.1, .14, .62, 'brown', {seg: 8}); b.sph(.62, 'leafLight', {y: 1.0, seg: 18}); b.sph(.45, 'leaf', {x: .34, y: .84, z: .12, seg: 16}); b.sph(.42, lighten('leafLight', .12), {x: -.3, y: 1.1, z: -.1, seg: 16}); b.sph(.36, 'leaf', {x: .05, y: 1.4, z: .1, seg: 14});
  if (kind === 'apple') for (let k = 0; k < 9; k++) { const a = r(k) * TAU, v = r(k + 20) * 1.1 - .2; b.sph(.065, 'red', {x: Math.cos(a) * Math.cos(v) * .6, y: 1.0 + Math.sin(v) * .6, z: Math.sin(a) * Math.cos(v) * .6, seg: 8}); }
}
function scenery(bag, graph) {
  const onGround = (x, z, f, ry = 0, s = 1) => { bag.push(x, heightAt(x, z), z, ry, s); f(bag); bag.pop(); };
  const nearRoad = (x, z) => { let d = Infinity; for (const e of graph.edges) for (const p of e.line.pts) d = Math.min(d, Math.hypot(p[0] - x, p[1] - z)); return d; };
  const nearBuilding = (x, z) => Math.min(...BUILDINGS.map(b => Math.hypot(b.x - x, b.z - z)), Math.abs(x - TRACK.x) < 1.3 && z > TRACK.z0 - .8 && z < TRACK.z1 + .8 ? 0 : 9, x > PADDOCK.x0 - .8 && x < PADDOCK.x1 + .8 && z > PADDOCK.z0 - .8 && z < PADDOCK.z1 + .8 ? 0 : 9, Math.hypot((x - POND.x) / 1.4, z - POND.z) < 2 ? 0 : 9, x > JETTY.x0 - 1.5 && Math.abs(z - JETTY.z) < 1.2 ? 0 : 9);
  TREES.forEach(([x, z, kind, s], i) => { if (nearRoad(x, z) > .9 && nearBuilding(x, z) > 1.5) onGround(x, z, b => tree(b, kind, i + 1), rand(i) * TAU, s); });
  // lamp posts and benches round the square, bunting strung between the lamps
  const lamps = []; for (let k = 0; k < 8; k++) { const a = (k + .5) / 8 * TAU, x = Math.cos(a) * 3.35, z = Math.sin(a) * 3.35; if (k % 2 === 0) continue; lamps.push([x, z]); }
  for (let k = 0; k < 8; k++) { const a = (k + .5) / 8 * TAU + .35, x = Math.cos(a) * 3.3, z = Math.sin(a) * 3.3; onGround(x, z, b => lamp(b, 0, 0)); lamps[k] = [x, z]; }
  const flags = ['red', 'yellow', 'sky', 'pink', 'green', 'orange', 'purple', 'white'];
  for (let k = 0; k < 8; k++) { const [x0, z0] = lamps[k], [x1, z1] = lamps[(k + 1) % 8], n = 9, ry = Math.atan2(x1 - x0, z1 - z0); for (let m = 1; m < n; m++) { const f = m / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f, y = 1.08 - Math.sin(f * Math.PI) * .22; bag.cone(.075, .14, flags[(m + k) % 8], {x, y: y - .14, z, ry: ry + Math.PI / 2, rx: Math.PI, sz: .25, seg: 3}); } bag.tube([[x0, 1.1, z0], [(x0 + x1) / 2, .86, (z0 + z1) / 2], [x1, 1.1, z1]], .008, 'white'); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 4, x = Math.cos(a) * 1.52, z = Math.sin(a) * 1.52; onGround(x, z, b => bench(b, 0, 0, -a + Math.PI / 2)); }
  // a signpost on the green, a pillar box, tubs by the crossings
  onGround(1.25, .45, b => { b.cyl(.03, .04, .95, 'white', {seg: 8}); [['red', .3, 0], ['blue', .52, 1.6], ['yellow', .72, 3.2], ['green', .5, 4.7]].forEach(([c, y, a]) => { b.push(0, y, 0, a); b.box(.42, .1, .03, c, {x: .24, r: .02}); b.cone(.07, .1, c, {x: .47, y: .0, rz: -Math.PI / 2, seg: 4}); b.pop(); }); b.sph(.05, 'gold', {y: .98, seg: 8}); });
  // hedges and flowers along the lanes, wild flowers in the meadows
  for (const e of graph.edges) if (e.kind === 'spoke') for (let s = 1.6; s < e.line.length - .8; s += .46) for (const side of [-1, 1]) {
    const q = along(e.line, s), [lx, lz] = leftOf(q.tx, q.tz), x = q.x + lx * side * 1.18, z = q.z + lz * side * 1.18;
    if (nearBuilding(x, z) < 1.75 || Math.hypot(x, z) < 5.6 || shore(x, z) > .88) continue;
    const k = Math.round(s * 7 + side * 3); bag.sph(.24, k % 3 ? 'leaf' : 'leafLight', {x, y: heightAt(x, z) + .13, z, sx: 1.25, sy: .85, seg: 8}); if (k % 4 === 0) bag.sph(.05, ['pink', 'white', 'yellow'][k % 3], {x: x + .05, y: heightAt(x, z) + .34, z, seg: 6});
  }
  for (let k = 0; k < 420; k++) { const x = (rand(k * 3 + 1) - .5) * 27, z = (rand(k * 3 + 2) - .5) * 20; if (shore(x, z) > .88 || nearRoad(x, z) < 1.0 || nearBuilding(x, z) < 1.6 || Math.hypot(x, z) < 5.5) continue; const y = heightAt(x, z); bag.sph(.045, ['white', 'yellow', 'pink', 'red', 'purple'][k % 5], {x, y: y + .08, z, seg: 6}); bag.cyl(.008, .008, .08, 'leaf', {x, y, z, seg: 4}); }
  // bus stop signs
  for (const st of BUS_STOPS) { const d = graph.attach(st.x, st.z), e = graph.edge(d.edge), q = along(e.line, d.s), [lx, lz] = leftOf(q.tx, q.tz), side = e.kind === 'ring' ? 1 : d.side, x = q.x + lx * side * (ROAD.pave + .3), z = q.z + lz * side * (ROAD.pave + .3); onGround(x, z, b => { b.cyl(.02, .025, .78, 'slate', {seg: 6}); b.cyl(.13, .13, .03, 'red', {y: .78, rx: Math.PI / 2, seg: 16}); b.cyl(.09, .09, .035, 'white', {y: .795, rx: Math.PI / 2, seg: 16, centre: false}); }, Math.atan2(q.tx, q.tz)); }
}

function railway(bag) {
  const {x, z0, z1, platform: pf} = TRACK, y = k => heightAt(x, k) + 0;
  const along = (z) => heightAt(x, z);
  const n = Math.round((z1 - z0) / .16);
  for (let k = 0; k <= n; k++) { const z = z0 + (z1 - z0) * k / n; bag.box(.62, .045, .08, 'wood', {x, y: along(z) + .02, z, r: .012}); }
  for (const dx of [-.17, .17]) { const steps = 24; for (let k = 0; k < steps; k++) { const za = z0 + (z1 - z0) * k / steps, zb = z0 + (z1 - z0) * (k + 1) / steps; bag.box(.05, .05, zb - za + .01, 'slate', {x: x + dx, y: Math.max(along(za), along(zb)) + .065, z: (za + zb) / 2, r: .01}); } }
  for (const dz of [z0 - .1, z1 + .1]) { bag.box(.5, .2, .1, 'red', {x, y: along(dz) + .02, z: dz, r: .04}); bag.box(.54, .05, .12, 'yellow', {x, y: along(dz) + .2, z: dz, r: .02}); }   // buffers
  for (let zz = pf.z0; zz < pf.z1; zz += .3) bag.box(.5, .02, .31, zz % .6 < .3 ? '#e3d0a8' : '#efe0be', {x: pf.x, y: heightAt(pf.x, zz) + .17, z: zz + .15});
  bag.box(.52, .17, pf.z1 - pf.z0, 'stone', {x: pf.x, y: heightAt(pf.x, (pf.z0 + pf.z1) / 2), z: (pf.z0 + pf.z1) / 2, r: .02});
  bag.box(.52, .04, pf.z1 - pf.z0, 'yellow', {x: pf.x + .24, y: heightAt(pf.x, (pf.z0 + pf.z1) / 2) + .165, z: (pf.z0 + pf.z1) / 2});
  for (const zz of [pf.z0 + .3, pf.z1 - .3]) { bag.cyl(.025, .03, .9, 'slate', {x: pf.x - .1, y: heightAt(pf.x, zz) + .17, z: zz, seg: 6}); bag.box(.3, .26, .05, 'blue', {x: pf.x - .1, y: heightAt(pf.x, zz) + .9, z: zz, r: .02}); }
  bag.box(.34, .05, 1.2, 'red', {x: pf.x - .2, y: heightAt(pf.x, (pf.z0 + pf.z1) / 2) + .95, z: (pf.z0 + pf.z1) / 2, r: .02});
  for (const zz of [pf.z0 + .4, pf.z1 - .4]) bag.cyl(.025, .025, .78, 'white', {x: pf.x - .2, y: heightAt(pf.x, zz) + .17, z: zz, seg: 6});
}
function paddock(bag) {
  const {x0, z0, x1, z1} = PADDOCK, fence = (xa, za, xb, zb) => { const n = Math.max(2, Math.round(Math.hypot(xb - xa, zb - za) / .32)); for (let k = 0; k <= n; k++) { const xx = xa + (xb - xa) * k / n, zz = za + (zb - za) * k / n; bag.cyl(.025, .03, .34, 'wood', {x: xx, y: heightAt(xx, zz), z: zz, seg: 6}); } const a = Math.atan2(xb - xa, zb - za), L = Math.hypot(xb - xa, zb - za), mx = (xa + xb) / 2, mz = (za + zb) / 2, my = heightAt(mx, mz); for (const h of [.14, .27]) bag.box(.025, .03, L, 'wood', {x: mx, y: my + h, z: mz, ry: a, r: .01}); };
  fence(x0, z0, x1, z0); fence(x1, z0, x1, z1); fence(x1, z1, x0, z1); fence(x0, z1, x0, z0);
  bag.box(.5, .1, .3, 'sand', {x: (x0 + x1) / 2, y: heightAt((x0 + x1) / 2, z1), z: z1 + .1, r: .04}); // a gate mat
  for (let k = 0; k < 14; k++) { const x = x0 + .25 + rand(k + 77) * (x1 - x0 - .5), z = z0 + .25 + rand(k + 91) * (z1 - z0 - .5); bag.sph(.04, ['white', 'yellow'][k % 2], {x, y: heightAt(x, z) + .06, z, seg: 6}); }
  bag.box(.6, .22, .22, 'wood', {x: x0 + .5, y: heightAt(x0 + .5, z0 + .5), z: z0 + .5, r: .05}); bag.box(.5, .12, .16, 'gold', {x: x0 + .5, y: heightAt(x0 + .5, z0 + .5) + .21, z: z0 + .5, r: .04});   // a trough and some hay
}
function pond(bag) {
  const {x, z, r} = POND, y = heightAt(x, z);
  bag.cyl(r + .2, r + .24, .05, 'stone', {x, y: y - .01, z, seg: 28, sx: 1.25}); bag.cyl(r, r, .07, '#6fcdea', {x, y: y + .0, z, seg: 28, sx: 1.25});
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + .3, px = x + Math.cos(a) * (r * 1.25 + .3), pz = z + Math.sin(a) * (r + .3); bag.sph(.2, k % 2 ? 'leaf' : 'leafLight', {x: px, y: heightAt(px, pz) + .1, z: pz, sy: .7, seg: 8}); bag.cyl(.014, .014, .5, 'leaf', {x: px + .15, y: heightAt(px, pz), z: pz, seg: 4}); bag.cyl(.055, .055, .16, 'brown', {x: px + .15, y: heightAt(px, pz) + .5, z: pz, seg: 6}); }
  for (let k = 0; k < 4; k++) bag.cyl(.14, .14, .015, 'lime', {x: x - .5 + k * .35, y: y + .075, z: z + (k % 2 ? .25 : -.2), seg: 12});
  for (let k = 0; k < 4; k++) bag.sph(.05, 'pink', {x: x - .5 + k * .35, y: y + .1, z: z + (k % 2 ? .25 : -.2), seg: 6});
}
function jetty(bag) {
  const {x0, x1, z} = JETTY, n = Math.round((x1 - x0) / .2);
  for (let k = 0; k < n; k++) bag.box(.2, .04, .5, k % 2 ? '#b98a58' : '#c89a64', {x: x0 + (k + .5) * .2, y: .2, z, r: .01});
  for (const k of [0, Math.round(n / 3), Math.round(2 * n / 3), n]) for (const dz of [-.22, .22]) bag.cyl(.04, .04, .55, 'wood', {x: x0 + k * .2, y: -.1, z: z + dz, seg: 6});
  for (const dz of [-.26, .26]) bag.box((x1 - x0), .03, .03, 'white', {x: (x0 + x1) / 2, y: .42, z: z + dz});
  bag.cyl(.07, .08, .1, 'red', {x: x1 - .05, y: .22, z: z + .2, seg: 10}); bag.cyl(.02, .02, .55, 'slate', {x: x1 - .05, y: .3, z: z - .3, seg: 6}); bag.box(.14, .12, .14, '#fff4c4', {x: x1 - .05, y: .86, z: z - .3, r: .03});
}

/* ---------------- the whole static town ---------------- */
export function buildTown(graph, season = 'summer') {
  setSeason(season);
  const bag = new Bag(), anim = {}, material = toyMaterial();
  roads(bag, graph); scenery(bag, graph); railway(bag); paddock(bag); pond(bag); jetty(bag);
  for (const def of BUILDINGS) { const local = {}; bag.push(def.x, heightAt(def.x, def.z), def.z, def.ry); BUILD[def.type](bag, def, local); bag.pop(); for (const k in local) anim[k] = {...local[k], def}; }
  const town = bag.mesh(material); town.castShadow = true; town.receiveShadow = true;
  const glow = bag.glowMesh(new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false})); glow.visible = false; glow.renderOrder = 2;
  const ground = terrain();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({color: P.sea})); sea.position.y = ISLAND.sea;
  // moving parts
  const place = (mesh, a, x = 0, y = 0, z = 0) => { const d = a.def, m = new THREE.Matrix4().compose(new THREE.Vector3(d.x, heightAt(d.x, d.z), d.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, d.ry, 0)), new THREE.Vector3(1, 1, 1)); const g = new THREE.Group(); g.applyMatrix4(m); const inner = new THREE.Group(); inner.position.set(x, y, z); inner.add(mesh); g.add(inner); mesh.castShadow = true; return {group: g, inner}; };
  const moving = {};
  { const b = new Bag(); b.cone(.34, .5, 'red', {rx: Math.PI, y: .0, seg: 20}); b.cyl(.34, .34, .1, 'yellow', {y: .5, seg: 20}); b.dome(.34, 'blue', {y: .6, sy: .5}); b.torus(.34, .03, 'white', {y: .55, rx: Math.PI / 2}); b.cyl(.03, .03, .32, 'gold', {y: .72, seg: 8}); b.sph(.06, 'gold', {y: 1.06, seg: 8}); const m = b.mesh(material); m.rotation.z = .16; moving.top = place(m, anim.top, anim.top.x, anim.top.y, anim.top.z); }
  { const b = new Bag(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.box(.07, 1.25, .04, 'wood', {x: Math.sin(a) * .0, y: 0, rz: -a, r: .015, centre: false}); } const g2 = new Bag(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, m4 = new THREE.Matrix4().makeRotationZ(a); g2.stack.push(m4); g2.box(.07, 1.3, .04, 'wood', {y: .08, r: .015}); g2.box(.36, .95, .025, 'cream', {x: .2, y: .38, r: .02}); for (let r2 = 0; r2 < 5; r2++) g2.box(.36, .02, .035, 'wood', {x: .2, y: .42 + r2 * .2}); g2.stack.pop(); } g2.cyl(.13, .13, .1, 'red', {rx: Math.PI / 2, centre: true, seg: 12}); const m = g2.mesh(material); moving.sails = place(m, anim.sails, 0, anim.sails.y, anim.sails.z); }
  { const mk = (len, w) => { const b = new Bag(); for (let k = 0; k < 4; k++) { b.push(0, 0, 0, k * Math.PI / 2); b.box(w, len, .02, 'black', {z: .715, r: .008}); b.pop(); } return b.mesh(material); }; moving.minute = place(mk(.36, .04), anim.clock, 0, anim.clock.y, 0); moving.hour = place(mk(.24, .055), anim.clock, 0, anim.clock.y, 0); }
  return {town, glow, ground, sea, moving, material};
}

/* ---------------- residents and vehicles ---------------- */
const SKIN = ['#f6cfa6', '#e0a878', '#b9804f', '#8c5a3a'];
export function buildResident(def, i, material) {
  const b = new Bag(), coat = def.coat, skin = SKIN[i % 4];
  b.cyl(.085, .115, .2, coat, {y: .045, seg: 12}); b.sph(.115, coat, {y: .06, sy: .5, seg: 12}); b.sph(.09, coat, {y: .25, sy: .7, seg: 12});
  for (const s of [-1, 1]) { b.sph(.045, '#3a3f4a', {x: s * .05, y: .03, z: .03, sy: .6, sz: 1.3, seg: 8}); b.sph(.04, coat, {x: s * .115, y: .19, sy: 1.5, seg: 8}); b.sph(.03, skin, {x: s * .12, y: .12, seg: 8}); }
  b.sph(.1, skin, {y: .385, seg: 14}); for (const s of [-1, 1]) { b.sph(.014, 'black', {x: s * .036, y: .4, z: .09, seg: 6}); b.sph(.02, '#f4a0a0', {x: s * .06, y: .365, z: .078, sz: .4, seg: 6}); } b.sph(.014, darken(skin, .15), {y: .378, z: .1, seg: 6});
  const H = {
    chef() { b.cyl(.085, .08, .1, 'white', {y: .45, seg: 12}); b.sph(.105, 'white', {y: .58, sy: .7, seg: 12}); },
    bun() { b.sph(.105, '#7a4a2a', {y: .4, z: -.015, sy: .95, seg: 12}); b.sph(.05, '#7a4a2a', {y: .5, z: -.03, seg: 8}); },
    helmet() { b.dome(.105, 'blue', {y: .41, sy: 1.25}); b.cyl(.118, .118, .02, 'blue', {y: .41, seg: 14}); b.sph(.022, 'gold', {y: .47, z: .1, seg: 6}); b.sph(.02, 'blue', {y: .55, seg: 6}); },
    cap() { b.dome(.103, 'red', {y: .42, sy: .8}); b.box(.14, .02, .1, 'red', {y: .42, z: .1, r: .01}); },
    bow() { b.sph(.105, '#e8b45a', {y: .4, z: -.015, seg: 12}); for (const s of [-1, 1]) b.sph(.04, 'pink', {x: s * .045, y: .5, sz: .5, seg: 8}); b.sph(.02, 'red', {y: .5, seg: 6}); },
    fire() { b.dome(.108, 'yellow', {y: .41, sy: 1.1}); b.cyl(.13, .13, .02, 'yellow', {y: .41, z: -.02, seg: 14}); b.box(.05, .06, .02, 'red', {y: .44, z: .1, r: .01}); },
    bonnet() { b.sph(.11, 'white', {y: .4, z: -.02, seg: 12}); b.torus(.1, .018, 'white', {y: .4, z: .02}); b.sph(.025, 'pink', {y: .5, z: .0, seg: 6}); },
    flat() { b.dome(.108, 'brown', {y: .43, sy: .5}); b.box(.15, .018, .09, 'brown', {y: .43, z: .09, r: .008}); },
    bobble() { b.dome(.104, coat === 'yellow' ? 'red' : 'yellow', {y: .41, sy: 1.05}); b.torus(.1, .02, 'white', {y: .42, rx: Math.PI / 2}); b.sph(.035, 'white', {y: .54, seg: 8}); }
  };
  (H[def.hat] || H.cap)();
  const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(def.small ? .95 : 1.25); g.visible = false; return g;
}
export function buildVehicle(def, material) {
  const b = new Bag(), c = def.colour, wheels = (xs, zs, r = .085) => { for (const x of xs) for (const z of zs) { b.cyl(r, r, .07, 'black', {x, y: r, z, rz: Math.PI / 2, centre: true, seg: 14}); b.cyl(r * .5, r * .5, .075, 'cream', {x, y: r, z, rz: Math.PI / 2, centre: true, seg: 10}); } };
  const face = (y, z, w) => { for (const s of [-1, 1]) { b.sph(.045, '#fff8d8', {x: s * w, y, z, seg: 10}); b.sph(.02, 'black', {x: s * w, y: y + .005, z: z + .035, seg: 6}); } b.box(w * 1.3, .03, .03, 'white', {y: y - .075, z: z + .005, r: .012}); };
  if (def.kind === 'bus') { b.box(.4, .34, 1.0, c, {y: .1, r: .08}); b.box(.42, .06, 1.02, 'cream', {y: .42, r: .03}); b.box(.405, .15, .86, '#bfe6f7', {y: .25, z: -.02, r: .03}); for (let k = 0; k < 5; k++) b.box(.41, .15, .03, c, {y: .25, z: -.42 + k * .2, r: .01}); b.box(.3, .13, .02, '#bfe6f7', {y: .26, z: .495, r: .02}); b.box(.22, .05, .02, 'cream', {y: .385, z: .5, r: .01}); wheels([-.19, .19], [-.32, .32], .09); face(.16, .5, .12); }
  else if (def.kind === 'van') { b.box(.36, .3, .5, c, {y: .09, z: -.12, r: .07}); b.box(.34, .22, .26, c, {y: .09, z: .25, r: .07}); b.box(.3, .1, .02, '#bfe6f7', {y: .2, z: .375, r: .02}); for (const s of [-1, 1]) { b.box(.02, .14, .24, 'white', {x: s * .182, y: .2, z: -.12, r: .01}); b.box(.022, .012, .14, 'red', {x: s * .184, y: .27, z: -.12, rx: .5}); b.box(.022, .012, .14, 'red', {x: s * .184, y: .27, z: -.12, rx: -.5}); } wheels([-.17, .17], [-.24, .24], .08); face(.14, .375, .1); }
  else if (def.kind === 'float') { b.box(.34, .2, .62, c, {y: .09, r: .07}); b.box(.3, .26, .22, c, {y: .09, z: .22, r: .06}); b.box(.26, .1, .02, '#bfe6f7', {y: .28, z: .335, r: .01}); b.box(.36, .03, .66, 'blue', {y: .29, r: .01});
    for (const x of [-.09, .09]) for (const z of [-.1, -.28]) { b.cyl(.045, .045, .12, 'white', {x, y: .32, z, seg: 8}); b.cyl(.046, .046, .02, 'blue', {x, y: .42, z, seg: 8}); } wheels([-.17, .17], [-.2, .2], .07); face(.13, .335, .08); }
  else if (def.kind === 'tractor') { b.box(.3, .22, .5, c, {y: .15, z: .1, r: .06}); b.box(.24, .26, .22, c, {y: .3, z: -.1, r: .05}); b.box(.26, .03, .26, 'yellow', {y: .58, z: -.1, r: .01}); for (const x of [-.11, .11]) b.cyl(.012, .012, .26, 'yellow', {x, y: .33, z: -.2, seg: 4}); b.cyl(.035, .04, .26, 'black', {x: .0, y: .4, z: .3, seg: 8}); b.box(.2, .17, .24, 'yellow', {y: .22, z: -.32, r: .04});
    for (const x of [-.19, .19]) { b.cyl(.15, .15, .1, 'black', {x, y: .15, z: -.18, rz: Math.PI / 2, centre: true, seg: 16}); b.cyl(.075, .075, .105, 'yellow', {x, y: .15, z: -.18, rz: Math.PI / 2, centre: true, seg: 10}); b.cyl(.09, .09, .08, 'black', {x, y: .09, z: .26, rz: Math.PI / 2, centre: true, seg: 12}); } face(.17, .36, .08); }
  else if (def.kind === 'icecream') { b.box(.34, .3, .6, c, {y: .09, r: .07}); b.box(.36, .05, .62, 'white', {y: .38, r: .02}); b.box(.2, .13, .02, '#bfe6f7', {x: .0, y: .22, z: .3, r: .01}); b.box(.02, .14, .26, 'white', {x: .172, y: .22, z: -.05, r: .01}); b.box(.03, .035, .26, 'red', {x: .175, y: .31, z: -.05, rz: .0});
    b.cone(.09, .2, 'crust', {y: .52, z: -.1, rx: Math.PI, seg: 10}); b.sph(.085, 'pink', {y: .5, z: -.1, seg: 10}); b.sph(.07, 'white', {y: .58, z: -.1, seg: 10}); b.sph(.03, 'red', {y: .66, z: -.1, seg: 6}); wheels([-.16, .16], [-.2, .2], .075); face(.14, .3, .08); }
  else if (def.kind === 'fire') { b.box(.38, .26, .8, c, {y: .1, r: .07}); b.box(.34, .22, .24, c, {y: .1, z: .3, r: .06}); b.box(.3, .1, .02, '#bfe6f7', {y: .26, z: .425, r: .01}); b.box(.3, .03, .5, 'white', {y: .37, z: -.1, r: .01});
    for (const x of [-.09, .09]) b.box(.03, .04, .6, 'yellow', {x, y: .42, z: -.1, rz: 0}); for (let k = 0; k < 6; k++) b.box(.2, .02, .022, 'yellow', {y: .43, z: -.38 + k * .1}); b.sph(.045, 'gold', {y: .4, z: .38, seg: 8}); b.box(.18, .05, .09, 'blue', {y: .38, z: .22, r: .02}); wheels([-.18, .18], [-.28, .28], .08); face(.14, .425, .1); }
  else { b.box(.36, .17, .62, c, {y: .09, r: .07}); b.box(.3, .15, .3, c, {y: .24, z: -.04, r: .06}); b.box(.31, .09, .26, '#bfe6f7', {y: .27, z: -.04, r: .03}); b.box(.26, .09, .31, '#bfe6f7', {y: .27, z: -.04, r: .03}); if (def.id === 'taxi') { b.box(.14, .06, .08, 'white', {y: .39, z: -.04, r: .02}); for (let k = 0; k < 5; k++) for (const s of [-1, 1]) b.box(.01, .035, .06, k % 2 ? 'black' : 'white', {x: s * .181, y: .16, z: -.24 + k * .12}); } wheels([-.17, .17], [-.2, .2], .08); face(.15, .31, .1); for (const s of [-1, 1]) b.sph(.03, 'red', {x: s * .11, y: .17, z: -.31, seg: 8}); }
  const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(1.25); return g;
}
/* ---------------- more moving things: train, boat, farm animals, ducks ---------------- */
// The little train: an engine with a funnel and two coaches, facing +z, length about 1.9.
export function buildTrain(material) {
  const b = new Bag();
  b.box(.4, .3, .62, 'red', {y: .08, z: .5, r: .08}); b.cyl(.2, .2, .55, 'red', {y: .14, z: .55, rx: Math.PI / 2, centre: false, seg: 18}); b.box(.42, .34, .3, 'red', {y: .1, z: .1, r: .06}); b.box(.46, .04, .34, 'yellow', {y: .44, z: .1, r: .02});
  b.cyl(.06, .08, .22, 'black', {y: .36, z: .78, seg: 10}); b.cyl(.1, .06, .05, 'gold', {y: .58, z: .78, seg: 10}); b.sph(.075, 'gold', {y: .46, z: .6, seg: 8});
  for (const s of [-1, 1]) { for (const z of [.0, .3, .72]) { b.cyl(.09, .09, .06, 'black', {x: s * .2, y: .09, z, rz: Math.PI / 2, centre: true, seg: 14}); b.cyl(.045, .045, .065, 'cream', {x: s * .2, y: .09, z, rz: Math.PI / 2, centre: true, seg: 10}); } b.box(.025, .03, .8, 'slate', {x: s * .2, y: .09, z: .35, r: .01}); }
  b.sph(.05, '#fff4c4', {y: .24, z: .83, seg: 8}); b.box(.2, .03, .03, 'white', {y: .13, z: .84, r: .01});
  const coach = (z, c) => { b.box(.44, .32, .8, c, {y: .1, z, r: .08}); b.box(.46, .05, .82, 'cream', {y: .42, z, r: .02}); for (const s of [-1, 1]) for (const k of [-1, 0, 1]) b.box(.02, .13, .17, '#bfe6f7', {x: s * .222, y: .27, z: z + k * .24, r: .01}); for (const s of [-1, 1]) for (const zz of [-.28, .28]) { b.cyl(.08, .08, .05, 'black', {x: s * .21, y: .08, z: z + zz, rz: Math.PI / 2, centre: true, seg: 12}); } b.box(.2, .06, .1, 'slate', {y: .22, z: z + .42, r: .02}); };
  coach(-.4, 'yellow'); coach(-1.3, 'blue');
  const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(1.15); return g;
}
export function buildBoat(material) {
  const b = new Bag();
  b.box(.5, .2, 1.05, 'red', {y: -.05, r: .1}); b.box(.54, .05, 1.08, 'white', {y: .14, r: .02}); b.cone(.26, .4, 'red', {y: -.05, z: .62, rx: Math.PI / 2 * 0 + 0, seg: 4, ry: Math.PI / 4, sx: .8, sy: .01});
  b.box(.32, .26, .34, 'white', {y: .18, z: -.12, r: .05}); b.box(.26, .1, .02, '#bfe6f7', {y: .3, z: .06, r: .01}); b.box(.36, .04, .38, 'blue', {y: .43, z: -.12, r: .02});
  b.cyl(.02, .02, .8, 'wood', {y: .18, z: .3, seg: 6}); b.box(.3, .4, .02, 'white', {x: .0, y: .55, z: .3, r: .01}); b.sph(.035, 'gold', {y: .98, z: .3, seg: 6});
  const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(1.1); return g;
}
export function buildAnimal(kind, material) {
  const b = new Bag();
  if (kind === 'cow') { b.sph(.17, 'white', {y: .27, sx: 1.15, sz: 1.75, seg: 12}); for (const [x, z, r] of [[.1, .06, .09], [-.08, -.12, .08]]) b.sph(r, '#4a3f3a', {x, y: .3, z, sx: 1.2, sz: 1.2, seg: 8}); b.sph(.1, 'white', {y: .33, z: .3, seg: 10}); b.sph(.055, '#f0a9a9', {y: .3, z: .38, sx: 1.1, seg: 8}); for (const s of [-1, 1]) { b.sph(.02, 'black', {x: s * .05, y: .37, z: .37, seg: 5}); b.cone(.02, .07, 'cream', {x: s * .08, y: .4, z: .28, seg: 5}); for (const z of [-.18, .16]) b.cyl(.022, .026, .17, 'white', {x: s * .09, z, seg: 6}); } b.cyl(.01, .01, .13, 'white', {y: .28, z: -.32, rx: .5, seg: 4}); }
  else if (kind === 'sheep') { b.sph(.16, 'cream', {y: .22, sx: 1.05, sz: 1.35, seg: 10}); for (let k = 0; k < 6; k++) b.sph(.08, 'white', {x: Math.cos(k) * .09, y: .3 + (k % 2) * .03, z: Math.sin(k) * .13, seg: 8}); b.sph(.07, '#4a4a4a', {y: .27, z: .22, seg: 8}); for (const s of [-1, 1]) { b.sph(.015, 'white', {x: s * .03, y: .3, z: .27, seg: 5}); for (const z of [-.1, .1]) b.cyl(.016, .018, .12, '#4a4a4a', {x: s * .07, z, seg: 5}); } }
  else { b.sph(.09, 'yellow', {y: .12, sx: 1, sz: 1.3, seg: 10}); b.sph(.055, 'yellow', {y: .22, z: .1, seg: 8}); b.cone(.025, .05, 'orange', {y: .21, z: .17, rx: Math.PI / 2, seg: 5}); b.sph(.012, 'black', {x: .03, y: .24, z: .13, seg: 4}); b.sph(.012, 'black', {x: -.03, y: .24, z: .13, seg: 4}); b.sph(.05, 'gold', {y: .14, z: -.1, sy: .6, sz: 1.2, seg: 8}); }
  const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(kind === 'duck' ? 1.2 : 1.25); return g;
}
export function buildClouds() {
  // a few small puffy clouds low over the sea, beyond the shore, so they never sit between the camera and the town
  const b = new Bag(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + .4, x = Math.cos(a) * (19 + rand(k * 5 + 1) * 5), z = Math.sin(a) * (16 + rand(k * 5 + 2) * 4), s = .5 + rand(k * 5 + 3) * .35; b.push(x, rand(k * 5 + 4) * 1.4, z, 0, s); [[0, 0, 0, 1.1], [1.0, -.1, .1, .8], [-1.0, -.12, -.1, .85], [.4, .35, 0, .75], [-.45, .3, .15, .7]].forEach(([dx, dy, dz, r]) => b.sph(r, 'white', {x: dx, y: dy, z: dz, sy: .7, seg: 12})); b.pop(); }
  const m = b.mesh(new THREE.MeshLambertMaterial({vertexColors: true, transparent: true, opacity: .96})); m.position.y = 1.6; return m;
}
// An umbrella to hold over a resident's head (shown only in the rain).
export function buildUmbrella(material, colour = 'red') {
  const b = new Bag(); b.cyl(.012, .012, .42, 'slate', {y: .3, z: -.03, seg: 6}); b.dome(.25, colour, {y: .62, z: -.03, sy: .5, seg: 14}); b.torus(.25, .012, 'white', {y: .62, z: -.03, rx: Math.PI / 2}); b.sph(.022, 'gold', {y: .75, z: -.03, seg: 6});
  const m = b.mesh(material); m.castShadow = true; m.visible = false; return m;
}
// Rain: streaks that fall through a box around the view; `update` moves them, `amount` (0..1) thins them out.
export function buildRain() {
  const N = 700, X = 40, Z = 30, Y = 16, pos = new Float32Array(N * 6), seeds = Array.from({length: N}, (_, k) => [(rand(k * 3 + 1) - .5) * X, rand(k * 3 + 2) * Y, (rand(k * 3 + 3) - .5) * Z]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({color: '#dff2ff', transparent: true, opacity: 0, depthWrite: false, fog: false});
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.visible = false;
  lines.userData.update = (time, amount) => {
    const n = Math.floor(N * amount); geo.setDrawRange(0, n * 2); mat.opacity = Math.min(.55, amount * .7); lines.visible = n > 4; if (!lines.visible) return;
    for (let k = 0; k < n; k++) { const [x, y0, z] = seeds[k], y = Y - ((y0 + time * 14) % Y); pos.set([x, y, z, x - .05, y + .5, z + .03], k * 6); }
    geo.attributes.position.needsUpdate = true;
  };
  return lines;
}
// Stars and a little moon on a far dome that follows the camera: two draw calls, shown only at night.
export function buildSky() {
  const g = new THREE.Group(), n = 150, pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) { const a = rand(k * 3 + 1) * TAU, e = .15 + rand(k * 3 + 2) * 1.1, r = 120; pos[k * 3] = Math.cos(a) * Math.cos(e) * r; pos[k * 3 + 1] = Math.sin(e) * r; pos[k * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({color: '#fff8e0', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false}));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 14, 10), new THREE.MeshBasicMaterial({color: '#fdf5d0', transparent: true, opacity: 0, fog: false, depthWrite: false}));
  moon.position.set(-60, 75, -70); g.add(stars, moon); g.userData = {stars, moon}; g.visible = false; g.frustumCulled = false; stars.frustumCulled = false; return g;
}
// Things that drift through the air with the season: petals (spring), fireflies (summer nights), leaves (autumn), snow (winter).
// `update(time, amount)` moves them round the view; `amount` (0..1) thins them out.
const FALL = {
  spring: {colour: '#ffc6dc', size: 4.5, fall: .9, sway: .8, op: .9},
  summer: {colour: '#ffe27a', size: 3.4, fall: 0, sway: .35, op: .9},
  autumn: {colour: '#e58a2c', size: 5, fall: 1.1, sway: 1.1, op: .95},
  winter: {colour: '#ffffff', size: 4, fall: 1.6, sway: .35, op: .95}
};
export function buildFall(season = 'summer') {
  const cfg = FALL[season] || FALL.summer, N = 320, X = 38, Z = 28, Y = 12, pos = new Float32Array(N * 3), seeds = Array.from({length: N}, (_, k) => [(rand(k * 4 + 1) - .5) * X, rand(k * 4 + 2) * Y, (rand(k * 4 + 3) - .5) * Z, rand(k * 4 + 4) * TAU]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({color: cfg.colour, size: cfg.size, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false});
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false;
  pts.userData.update = (time, amount) => {
    const n = Math.floor(N * amount); geo.setDrawRange(0, n); pts.visible = n > 2; if (!pts.visible) return;
    mat.opacity = cfg.op * (cfg.fall ? 1 : .55 + .35 * Math.sin(time * 2.1));   // fireflies pulse
    for (let k = 0; k < n; k++) {
      const [x, y0, z, ph] = seeds[k], y = cfg.fall ? Y - ((y0 + time * cfg.fall) % Y) : .35 + y0 / Y * 1.7 + Math.sin(time * .7 + ph) * .2;
      pos[k * 3] = x + Math.sin(time * .8 + ph) * cfg.sway; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z + Math.cos(time * .6 + ph) * cfg.sway;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
export {doorOf};
