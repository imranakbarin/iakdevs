// New Toy Town: the builders. Everything static is drawn into a "bag" of coloured geometry that becomes one mesh
// (vertex colours, one material), so the whole town costs a handful of draw calls. Moving parts (clock hands, the
// spinning top, the windmill's sails, residents, vehicles, clouds) are returned as their own small meshes.
// Shapes are fat and rounded on purpose: toy-box buildings, nothing sharp.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PALETTE as P, ISLAND, SQUARE, ROAD, SPOKES, BUILDINGS, TREES, BUS_STOPS, heightAt, shore, rand, doorOf} from './def.mjs';
import {along, leftOf} from './graph.mjs';

const TAU = Math.PI * 2, col = c => new THREE.Color(P[c] || c);
const lighten = (c, k) => '#' + col(c).lerp(new THREE.Color('#ffffff'), k).getHexString(), darken = (c, k) => '#' + col(c).lerp(new THREE.Color('#1c2430'), k).getHexString();

/* ---------------- the bag ---------------- */
const cache = new Map();
function prim(key, make) { if (!cache.has(key)) { let g = make(); if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); cache.set(key, g); } return cache.get(key); }
export class Bag {
  constructor() { this.parts = []; this.stack = [new THREE.Matrix4()]; }
  get top() { return this.stack[this.stack.length - 1]; }
  // enter a local frame: position, turn about y, uniform scale
  push(x = 0, y = 0, z = 0, ry = 0, s = 1) { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s)); this.stack.push(this.top.clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  add(geo, colour, o = {}) {
    const g = geo.clone(), m = new THREE.Matrix4().compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new THREE.Vector3(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    g.applyMatrix4(this.top.clone().multiply(m));
    const c = col(colour), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.parts.push(g); return this;
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
  mesh(material) { const g = mergeGeometries(this.parts, false); g.computeBoundingSphere(); const m = new THREE.Mesh(g, material); this.parts = []; return m; }
}
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
  b.box(w + .14, .045, .1, 'white', {x, y: y - h / 2 - .075, z: z + .03, r: .02});
  if (o.shutters) for (const s of [-1, 1]) b.box(.11, h + .04, .035, o.shutters, {x: x + s * (w / 2 + .1), y: y - h / 2 - .02, z: z + .004, r: .02});
  if (o.flowers) { b.box(w + .1, .08, .1, 'wood', {x, y: y - h / 2 - .15, z: z + .07, r: .03}); for (let k = 0; k < 4; k++) b.sph(.045, ['red', 'yellow', 'pink', 'white'][(k + (o.flowers | 0)) % 4], {x: x - w / 2 + .05 + k * (w / 3 - .01), y: y - h / 2 - .05, z: z + .08, seg: 8}); }
}
function roundWin(b, x, y, z, r = .17) { b.cyl(r + .045, r + .045, .05, 'white', {x, y, z: z - .008, rx: Math.PI / 2, centre: true}); b.cyl(r, r, .05, '#bfe6f7', {x, y, z: z + .008, rx: Math.PI / 2, centre: true}); b.box(.028, r * 2, .05, 'white', {x, y: y - r, z: z + .016, r: .01}); b.box(r * 2, .028, .05, 'white', {x, y: y - .014, z: z + .016, r: .01}); }
// A striped awning sloping out over a shopfront.
function awning(b, x, y, z, w, d, a, c) { const n = Math.max(4, Math.round(w / .16)); for (let k = 0; k < n; k++) b.box(w / n + .004, .05, d, k % 2 ? a : c, {x: x - w / 2 + (k + .5) * w / n, y, z: z + d / 2 - .02, rx: .32, r: .02}); for (let k = 0; k < n; k++) b.sph(w / n / 2, k % 2 ? a : c, {x: x - w / 2 + (k + .5) * w / n, y: y - d * .3 - .01, z: z + d - .04, sy: .55, sz: .3, seg: 8}); }
function chimney(b, x, y, z, colour = 'red', lean = .09) { b.box(.2, .42, .2, colour, {x, y, z, rz: lean, r: .04}); b.box(.26, .07, .26, 'cream', {x: x - lean * .42, y: y + .4, z, rz: lean, r: .03}); b.cyl(.06, .07, .1, 'slate', {x: x - lean * .5, y: y + .46, z, rz: lean}); }
function smoke(b, x, y, z) { [[0, 0, .09], [.07, .16, .12], [-.03, .36, .15], [.09, .58, .17]].forEach(([dx, dy, r]) => b.sph(r, 'white', {x: x + dx, y: y + dy, z, seg: 10})); }
function tub(b, x, z, flower = 'red') { b.cyl(.085, .065, .11, 'orange', {x, z, seg: 12}); b.sph(.075, 'leaf', {x, y: .14, z, seg: 8}); b.sph(.04, flower, {x: x + .03, y: .2, z: z + .02, seg: 8}); b.sph(.035, 'yellow', {x: x - .04, y: .19, z: z - .02, seg: 8}); }
function picket(b, x0, z0, x1, z1) { const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / .13)); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n; b.box(.07, .26, .035, 'white', {x, z, ry: Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, r: .015}); b.cone(.04, .06, 'white', {x, y: .25, z, seg: 4}); } const a = Math.atan2(x1 - x0, z1 - z0); b.box(.03, .035, Math.hypot(x1 - x0, z1 - z0), 'white', {x: (x0 + x1) / 2, y: .14, z: (z0 + z1) / 2, ry: a, r: .01}); }
function lamp(b, x, z) { b.cyl(.07, .09, .1, 'slate', {x, z, seg: 10}); b.cyl(.028, .035, 1.0, 'slate', {x, y: .08, z, seg: 8}); b.box(.16, .2, .16, '#fff4c4', {x, y: 1.06, z, r: .04}); b.cone(.15, .12, 'slate', {x, y: 1.26, z, seg: 4, ry: Math.PI / 4}); b.sph(.03, 'gold', {x, y: 1.4, z, seg: 8}); }
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
  policeBox(b) {
    b.box(.86, .1, .86, 'stone', {r: .03}); b.box(.72, 1.25, .72, 'blue', {y: .08, r: .05}); for (let k = 0; k < 3; k++) b.box(.82 - k * .14, .09, .82 - k * .14, 'blue', {y: 1.3 + k * .08, r: .03});
    b.cyl(.06, .07, .12, 'white', {y: 1.54, seg: 10}); b.sph(.075, 'sky', {y: 1.7, seg: 10});
    for (let k = 0; k < 4; k++) { b.push(0, 0, 0, k * Math.PI / 2); b.box(.56, .1, .02, 'white', {y: 1.14, z: .362, r: .01}); for (const s of [-1, 1]) { b.box(.2, .22, .02, '#bfe6f7', {x: s * .14, y: .86, z: .362, r: .015}); for (let m = 0; m < 2; m++) b.box(.2, .24, .015, darken('blue', .18), {x: s * .14, y: .26 + m * .28, z: .36, r: .015}); } b.pop(); }
    b.sph(.025, 'gold', {x: .05, y: .6, z: .38, seg: 8});
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
function lampSmall(b, x, z) { b.cyl(.02, .025, .5, 'slate', {x, z, seg: 6}); b.box(.1, .13, .1, '#fff4c4', {x, y: .5, z, r: .03}); b.cone(.1, .08, 'slate', {x, y: .63, z, seg: 4, ry: Math.PI / 4}); }

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
  if (kind === 'bush') { for (let k = 0; k < 3; k++) b.sph(.3 - k * .04, k % 2 ? 'leaf' : 'green', {x: (r(k) - .5) * .4, y: .2 + k * .05, z: (r(k + 5) - .5) * .4, sy: .8, seg: 10}); for (let k = 0; k < 4; k++) b.sph(.05, ['pink', 'white', 'yellow', 'red'][k], {x: (r(k + 9) - .5) * .5, y: .38 + r(k) * .1, z: (r(k + 12) - .5) * .5, seg: 6}); return; }
  if (kind === 'tall') { b.cyl(.08, .11, .5, 'brown', {seg: 8}); [[.42, .62, 'leaf'], [.34, 1.08, 'green'], [.24, 1.46, 'leaf']].forEach(([s, y, c]) => b.sph(s, c, {y, sy: 1.15, seg: 12})); return; }
  b.cyl(.1, .14, .62, 'brown', {seg: 8}); b.sph(.62, 'green', {y: 1.0, seg: 18}); b.sph(.45, 'leaf', {x: .34, y: .84, z: .12, seg: 16}); b.sph(.42, lighten('green', .12), {x: -.3, y: 1.1, z: -.1, seg: 16}); b.sph(.36, 'leaf', {x: .05, y: 1.4, z: .1, seg: 14});
  if (kind === 'apple') for (let k = 0; k < 9; k++) { const a = r(k) * TAU, v = r(k + 20) * 1.1 - .2; b.sph(.065, 'red', {x: Math.cos(a) * Math.cos(v) * .6, y: 1.0 + Math.sin(v) * .6, z: Math.sin(a) * Math.cos(v) * .6, seg: 8}); }
}
function scenery(bag, graph) {
  const onGround = (x, z, f, ry = 0, s = 1) => { bag.push(x, heightAt(x, z), z, ry, s); f(bag); bag.pop(); };
  const nearRoad = (x, z) => { let d = Infinity; for (const e of graph.edges) for (const p of e.line.pts) d = Math.min(d, Math.hypot(p[0] - x, p[1] - z)); return d; };
  const nearBuilding = (x, z) => Math.min(...BUILDINGS.map(b => Math.hypot(b.x - x, b.z - z)));
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
    const k = Math.round(s * 7 + side * 3); bag.sph(.24, k % 3 ? 'leaf' : 'green', {x, y: heightAt(x, z) + .13, z, sx: 1.25, sy: .85, seg: 8}); if (k % 4 === 0) bag.sph(.05, ['pink', 'white', 'yellow'][k % 3], {x: x + .05, y: heightAt(x, z) + .34, z, seg: 6});
  }
  for (let k = 0; k < 420; k++) { const x = (rand(k * 3 + 1) - .5) * 27, z = (rand(k * 3 + 2) - .5) * 20; if (shore(x, z) > .88 || nearRoad(x, z) < 1.0 || nearBuilding(x, z) < 1.6 || Math.hypot(x, z) < 5.5) continue; const y = heightAt(x, z); bag.sph(.045, ['white', 'yellow', 'pink', 'red', 'purple'][k % 5], {x, y: y + .08, z, seg: 6}); bag.cyl(.008, .008, .08, 'leaf', {x, y, z, seg: 4}); }
  // bus stop signs
  for (const st of BUS_STOPS) { const d = graph.attach(st.x, st.z), e = graph.edge(d.edge), q = along(e.line, d.s), [lx, lz] = leftOf(q.tx, q.tz), side = e.kind === 'ring' ? 1 : d.side, x = q.x + lx * side * (ROAD.pave + .3), z = q.z + lz * side * (ROAD.pave + .3); onGround(x, z, b => { b.cyl(.02, .025, .78, 'slate', {seg: 6}); b.cyl(.13, .13, .03, 'red', {y: .78, rx: Math.PI / 2, seg: 16}); b.cyl(.09, .09, .035, 'white', {y: .795, rx: Math.PI / 2, seg: 16, centre: false}); }, Math.atan2(q.tx, q.tz)); }
}

/* ---------------- the whole static town ---------------- */
export function buildTown(graph) {
  const bag = new Bag(), anim = {}, material = toyMaterial();
  roads(bag, graph); scenery(bag, graph);
  for (const def of BUILDINGS) { const local = {}; bag.push(def.x, heightAt(def.x, def.z), def.z, def.ry); BUILD[def.type](bag, def, local); bag.pop(); for (const k in local) anim[k] = {...local[k], def}; }
  const town = bag.mesh(material); town.castShadow = true; town.receiveShadow = true;
  const ground = terrain();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({color: P.sea})); sea.position.y = ISLAND.sea;
  // moving parts
  const place = (mesh, a, x = 0, y = 0, z = 0) => { const d = a.def, m = new THREE.Matrix4().compose(new THREE.Vector3(d.x, heightAt(d.x, d.z), d.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, d.ry, 0)), new THREE.Vector3(1, 1, 1)); const g = new THREE.Group(); g.applyMatrix4(m); const inner = new THREE.Group(); inner.position.set(x, y, z); inner.add(mesh); g.add(inner); mesh.castShadow = true; return {group: g, inner}; };
  const moving = {};
  { const b = new Bag(); b.cone(.34, .5, 'red', {rx: Math.PI, y: .0, seg: 20}); b.cyl(.34, .34, .1, 'yellow', {y: .5, seg: 20}); b.dome(.34, 'blue', {y: .6, sy: .5}); b.torus(.34, .03, 'white', {y: .55, rx: Math.PI / 2}); b.cyl(.03, .03, .32, 'gold', {y: .72, seg: 8}); b.sph(.06, 'gold', {y: 1.06, seg: 8}); const m = b.mesh(material); m.rotation.z = .16; moving.top = place(m, anim.top, anim.top.x, anim.top.y, anim.top.z); }
  { const b = new Bag(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.box(.07, 1.25, .04, 'wood', {x: Math.sin(a) * .0, y: 0, rz: -a, r: .015, centre: false}); } const g2 = new Bag(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, m4 = new THREE.Matrix4().makeRotationZ(a); g2.stack.push(m4); g2.box(.07, 1.3, .04, 'wood', {y: .08, r: .015}); g2.box(.36, .95, .025, 'cream', {x: .2, y: .38, r: .02}); for (let r2 = 0; r2 < 5; r2++) g2.box(.36, .02, .035, 'wood', {x: .2, y: .42 + r2 * .2}); g2.stack.pop(); } g2.cyl(.13, .13, .1, 'red', {rx: Math.PI / 2, centre: true, seg: 12}); const m = g2.mesh(material); moving.sails = place(m, anim.sails, 0, anim.sails.y, anim.sails.z); }
  { const mk = (len, w) => { const b = new Bag(); for (let k = 0; k < 4; k++) { b.push(0, 0, 0, k * Math.PI / 2); b.box(w, len, .02, 'black', {z: .715, r: .008}); b.pop(); } return b.mesh(material); }; moving.minute = place(mk(.36, .04), anim.clock, 0, anim.clock.y, 0); moving.hour = place(mk(.24, .055), anim.clock, 0, anim.clock.y, 0); }
  return {town, ground, sea, moving, material};
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
  else { b.box(.36, .17, .62, c, {y: .09, r: .07}); b.box(.3, .15, .3, c, {y: .24, z: -.04, r: .06}); b.box(.31, .09, .26, '#bfe6f7', {y: .27, z: -.04, r: .03}); b.box(.26, .09, .31, '#bfe6f7', {y: .27, z: -.04, r: .03}); if (def.id === 'taxi') { b.box(.14, .06, .08, 'white', {y: .39, z: -.04, r: .02}); for (let k = 0; k < 5; k++) for (const s of [-1, 1]) b.box(.01, .035, .06, k % 2 ? 'black' : 'white', {x: s * .181, y: .16, z: -.24 + k * .12}); } wheels([-.17, .17], [-.2, .2], .08); face(.15, .31, .1); for (const s of [-1, 1]) b.sph(.03, 'red', {x: s * .11, y: .17, z: -.31, seg: 8}); }
  const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(1.25); return g;
}
export function buildClouds() {
  // a few small puffy clouds low over the sea, beyond the shore, so they never sit between the camera and the town
  const b = new Bag(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + .4, x = Math.cos(a) * (19 + rand(k * 5 + 1) * 5), z = Math.sin(a) * (16 + rand(k * 5 + 2) * 4), s = .5 + rand(k * 5 + 3) * .35; b.push(x, rand(k * 5 + 4) * 1.4, z, 0, s); [[0, 0, 0, 1.1], [1.0, -.1, .1, .8], [-1.0, -.12, -.1, .85], [.4, .35, 0, .75], [-.45, .3, .15, .7]].forEach(([dx, dy, dz, r]) => b.sph(r, 'white', {x: dx, y: dy, z: dz, sy: .7, seg: 12})); b.pop(); }
  const m = b.mesh(new THREE.MeshLambertMaterial({vertexColors: true, transparent: true, opacity: .96})); m.position.y = 1.6; return m;
}
export {doorOf};
