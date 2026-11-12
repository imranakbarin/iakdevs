// New Toy Town: the builders. Everything static is drawn into a "bag" of coloured geometry that becomes one mesh
// (vertex colours, one material), so the whole town costs a handful of draw calls. Moving parts (clock hands, the
// spinning top, the windmill's sails, residents, vehicles, clouds) are returned as their own small meshes.
// Shapes are fat and rounded on purpose: toy-box buildings, nothing sharp.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PALETTE as P, ISLAND, SQUARE, ROAD, ROADS, OUTER, LOOP, BUILDINGS, LAMPS, TREES, BUS_LINES, STATIONS, PADDOCK, POND, PIER, HILL, BUILD_SCALE, CARGO_COLOURS, heightAt, shore, rand, doorOf, building, loopPt} from './def.mjs';
import {along, leftOf} from './graph.mjs';
import {inGarden} from './garden.mjs';

// Seasons recolour the foliage and the grass (and nothing else) when the town is built.
const SEASONAL = {}, SEASON_COLOURS = {
  summer: {},
  spring: {leaf: '#4fbf70', leafLight: '#f6bdd2', blossom: '#e98fb0', grass: '#9ad96e', grassDark: '#82c862'},
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
    const c = col(colour), n = g.attributes.position.count, a = new Float32Array(n * 3), P = g.attributes.position, N = g.attributes.normal, base = this.top.elements[13];
    for (let i = 0; i < n; i++) {   // baked shading: walls and undersides are a little darker down at the ground, where light is blocked (no cost at run time)
      let k = 1; if (!o.glow && !o.flat && N) { const ny = N.getY(i), h = P.getY(i) - base; if (ny < .7) k = .8 + .2 * Math.min(1, Math.max(0, h / .55)); if (ny < -.35) k *= .9; }
      a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(n).fill(o.sway || 0), 1)); (o.glow ? this.glowParts : this.parts).push(g); return this;
  }
  // a rounded box standing on y (its base at o.y unless o.centre)
  box(w, h, d, colour, o = {}) {
    const y = (o.y || 0) + (o.centre ? 0 : h / 2);
    if (Math.max(w, h, d) < .3 || Math.min(w, h, d) < .09) return this.add(prim(`boxf:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)), colour, {...o, y});   // small pieces: plain cuboids (12 triangles), their rounding would not show
    const r = Math.min(o.r ?? .06, w / 2 - .001, h / 2 - .001, d / 2 - .001), seg = Math.max(w, h, d) > .7 ? 2 : 1; return this.add(prim(`box:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, seg, r)), colour, {...o, y});
  }
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
  mesh(material) { for (const p of this.parts) if (!p.attributes.sway) p.setAttribute('sway', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count), 1)); const g = mergeGeometries(this.parts, false); g.computeBoundingSphere(); const m = new THREE.Mesh(g, material); this.parts = []; return m; }
}
const WARM = '#ffcf70';
const cone2h = (b, r, h, colour, o = {}) => b.cone(r, h, colour, {...o, seg: 6});
const cone2c = (b, r, h, colour, o = {}) => { const g = new THREE.ConeGeometry(r, h, o.seg || 6).toNonIndexed(); g.deleteAttribute('uv'); return b.add(g, colour, o); };
// Shared shader inputs: time, the wind, and how much of each effect the current picture quality allows (see quality.mjs).
export const U = {time: {value: 0}, wind: {value: new THREE.Vector2(.8, .3)}, sway: {value: 1}, waves: {value: 1}, foam: {value: 1}};
// Foliage leans and flutters in the wind: a per-vertex `sway` weight (0 for everything that stands still) moves the vertex along the wind.
const WIND_VERT = 'float ph = uTime * 1.7 + position.x * .8 + position.z * .6; vec2 wd = uWind * (.6 + .4 * sin(ph)) + vec2(-uWind.y, uWind.x) * .25 * sin(ph * 1.7 + 1.3); transformed.xz += wd * sway * uSway * .035;';
export function windify(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time; sh.uniforms.uWind = U.wind; sh.uniforms.uSway = U.sway;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float sway; uniform float uTime, uSway; uniform vec2 uWind;').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ ' + WIND_VERT + ' }');
  };
  mat.customProgramCacheKey = () => 'toywind1'; return mat;
}
// The sea: slow swells that darken and lighten the water, little glints, and (on the shallows) foam along the shore and a pulsing ring further out.
const SHORE_GLSL = `float shoreAt(vec2 p) { float a = atan(p.y, p.x); return length(p / vec2(${ISLAND.rx.toFixed(2)}, ${ISLAND.rz.toFixed(2)})) + .028 * sin(a * 5. + .6) + .018 * sin(a * 9. - 1.1); }`;
const WAVE_FRAG = `float w1 = sin(vW.x * 1.3 + uTime * .7 + sin(vW.y * .9 + uTime * .3) * 1.5), w2 = sin(vW.y * 1.7 - uTime * .9 + sin(vW.x * 1.1) * 1.2);
  float glint = smoothstep(.86, 1., sin(vW.x * 1.7 + vW.y * 1.3 + uTime * 1.1) * sin(vW.x * 1.3 - vW.y * 2.1 - uTime * .9));
  diffuseColor.rgb *= 1. + uWaves * .06 * w1 * w2; diffuseColor.rgb += uWaves * glint * .06;`;
const FOAM_FRAG = `float sh = shoreAt(vW), ang = atan(vW.y, vW.x), edge = .952 + .012 * sin(uTime * .9 + ang * 6.) + .006 * sin(uTime * 1.7 + ang * 13.);
  float f1 = smoothstep(edge + .012, edge - .012, sh) * smoothstep(.895, .915, sh) * .85, f2 = (1. - smoothstep(0., .008, abs(sh - (.985 + .02 * sin(uTime * .8))))) * .45;
  float foam = clamp(f1 + f2 * (1. - f1), 0., 1.) * uFoam; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.), foam * .9); diffuseColor.a = max(diffuseColor.a, foam * .85);`;
export function waterify(mat, foam) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time; sh.uniforms.uWaves = U.waves; sh.uniforms.uFoam = U.foam;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vW; uniform float uTime, uWaves, uFoam;\n' + SHORE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\n{ ' + WAVE_FRAG + (foam ? FOAM_FRAG : '') + ' }');
  };
  mat.customProgramCacheKey = () => foam ? 'toyfoam1' : 'toywave1'; return mat;
}
export const toyMaterial = () => windify(new THREE.MeshLambertMaterial({vertexColors: true}));

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
  market(b) {   // three stalls in a row on a cobbled patch: counters, posts and striped awnings (the goods and sellers come on market days)
    b.box(3.5, .05, 1.5, 'stone', {y: 0, r: .02, z: .05});
    [['red', 'white'], ['blue', 'white'], ['yellow', 'white']].forEach(([c1, c2], i) => {
      const x = (i - 1) * 1.12;
      b.box(.98, .4, .46, 'wood', {x, y: .05, z: .12, r: .03}); b.box(1.02, .04, .52, 'cream', {x, y: .45, z: .12, r: .015});
      for (const sx of [-.46, .46]) b.cyl(.03, .03, 1.0, 'wood', {x: x + sx, y: .05, z: -.14, seg: 6});
      for (let k = 0; k < 4; k++) b.box(.26, .05, .8, k % 2 ? c2 : c1, {x: x - .39 + k * .26, y: 1.0, z: .08, rx: .3, r: .015});
      b.box(1.0, .03, .06, c1, {x, y: .96, z: .5, r: .01});
    });
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
    // a proper red barn: white corner boards, a gambrel roof, big braced doors, a hayloft with a hoist, a cupola with a weathervane, a lean-to, two silos and a stack of hay
    b.box(1.9, .95, 1.5, 'red', {r: .1}); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(.07, .95, .07, 'white', {x: sx * .93, z: sz * .73, r: .015});
    b.box(1.94, .06, 1.54, 'white', {y: .9, r: .02});
    b.gable(2.0, .5, 1.75, '#7a4a30', {y: .92}); b.gable(2.0, .46, 1.0, '#8a5a3c', {y: 1.38}); b.box(2.08, .05, .1, 'cream', {y: 1.83, r: .02});
    b.box(.9, .75, .07, 'cream', {z: .76, r: .04}); for (const s_ of [-1, 1]) { b.box(.4, .72, .08, 'white', {x: s_ * .22, z: .765, r: .03}); b.box(.034, .74, .09, 'red', {x: s_ * .22, z: .765}); for (const a of [.7, -.7]) b.box(.03, .84, .09, 'red', {x: s_ * .22, y: .36, z: .77, rz: a, centre: true}); } b.box(.034, .74, .09, 'red', {z: .77});
    b.box(.5, .36, .06, 'cream', {y: 1.0, z: .6, r: .03}); b.box(.36, .26, .08, 'wood', {y: 1.04, z: .63, r: .02}); b.box(.03, .3, .09, 'white', {y: 1.02, z: .64}); b.box(.4, .03, .09, 'white', {y: 1.16, z: .64});   // the hayloft door
    b.box(.05, .05, .42, 'wood', {y: 1.52, z: .8}); b.cyl(.025, .025, .22, 'slate', {y: 1.3, z: .98, seg: 6}); b.sph(.03, 'gold', {y: 1.3, z: .98, seg: 6});   // the hoist
    b.box(.2, .17, .2, 'cream', {y: 1.84, r: .03}); b.cone(.17, .17, 'red', {y: 2.0, seg: 4, ry: Math.PI / 4}); b.cyl(.01, .01, .24, 'black', {y: 2.15, seg: 4}); b.box(.2, .05, .02, 'black', {y: 2.3, z: 0}); b.cone(.04, .08, 'black', {x: .12, y: 2.31, rz: -Math.PI / 2, seg: 4});   // the cupola and weathervane
    b.push(-1.25, 0, -.2); b.box(.6, .5, 1.1, '#b5442f', {r: .06}); b.box(.7, .05, 1.2, '#7a4a30', {y: .52, rz: .18, r: .02}); b.box(.3, .3, .05, 'wood', {y: .0, z: .56}); b.pop();   // a lean-to shed on the side
    b.cyl(.34, .34, 1.9, '#d8d4c8', {x: 1.45, z: -.2, seg: 20}); b.dome(.34, 'slate', {x: 1.45, y: 1.9, z: -.2}); b.sph(.04, 'gold', {x: 1.45, y: 2.26, z: -.2, seg: 6}); for (const y of [.35, .8, 1.25, 1.7]) b.cyl(.36, .36, .04, 'slate', {x: 1.45, y, z: -.2, seg: 20});
    b.cyl(.012, .012, 1.6, 'slate', {x: 1.45, y: .2, z: .15, seg: 4}); for (let k = 0; k < 8; k++) b.box(.16, .015, .015, 'slate', {x: 1.45, y: .3 + k * .2, z: .15});   // a ladder up the silo
    b.cyl(.24, .24, 1.2, '#cfcabb', {x: 1.2, z: -.75, seg: 16}); b.dome(.24, 'slate', {x: 1.2, y: 1.2, z: -.75}); for (const y of [.4, .9]) b.cyl(.26, .26, .03, 'slate', {x: 1.2, y, z: -.75, seg: 16});
    // hay bales: a stack by the door, and a round bale
    for (let k = 0; k < 3; k++) b.box(.34, .2, .22, '#e0b84a', {x: -.5 + k * .36, y: 0, z: 1.2, r: .03, ry: .05 * k});   for (let k = 0; k < 2; k++) b.box(.34, .2, .22, '#e8c458', {x: -.32 + k * .36, y: .2, z: 1.2, r: .03});   b.box(.34, .2, .22, '#e0b84a', {x: -.14, y: .4, z: 1.2, r: .03});
    b.cyl(.2, .2, .26, '#d9a83a', {x: .7, y: 0, z: 1.25, seg: 14, rz: Math.PI / 2, centre: false}); b.cyl(.2, .2, .26, '#e0b84a', {x: 1.05, z: 1.12, seg: 14});
    // a trough, churns by the door and a wheelbarrow
    b.box(.5, .12, .16, 'wood', {x: -1.3, y: 0, z: 1.1, r: .02}); b.box(.44, .03, .12, '#6fcdea', {x: -1.3, y: .11, z: 1.1}); for (const x of [.25, .38]) { b.cyl(.045, .045, .12, 'white', {x, y: 0, z: .92, seg: 8}); b.cyl(.046, .046, .02, 'blue', {x, y: .12, z: .92, seg: 8}); }
    b.push(1.0, 0, .98, -.5); b.box(.2, .06, .3, 'wood', {y: .09, r: .01}); for (const sx of [-1, 1]) b.box(.02, .02, .3, 'wood', {x: sx * .09, y: .1, z: -.28}); b.cyl(.05, .05, .03, 'black', {y: .05, z: .17, rz: Math.PI / 2, centre: true, seg: 8}); b.pop();
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
// A coarse grid over some points, so "how far is the nearest road" is cheap to ask.
function pointGrid(pts, cell = 1.2) {
  const m = new Map(); for (const p of pts) { const k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell); if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  return {near(x, z, r) { let d = Infinity; const c = Math.ceil(r / cell), cx = Math.floor(x / cell), cz = Math.floor(z / cell); for (let i = -c; i <= c; i++) for (let j = -c; j <= c; j++) { const a = m.get((cx + i) + ',' + (cz + j)); if (a) for (const p of a) d = Math.min(d, Math.hypot(p[0] - x, p[1] - z)); } return d; }};
}
const hash2 = (x, z) => { const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return (hash2(xi, zi) * (1 - u) + hash2(xi + 1, zi) * u) * (1 - v) + (hash2(xi, zi + 1) * (1 - u) + hash2(xi + 1, zi + 1) * u) * v; }
function roadGrid(graph) { return pointGrid([...graph.edges.flatMap(e => e.line.pts), ...graph.loop.pts]); }
function terrain(graph) {
  const W = 46, D = 38, nx = 138, nz = 114, g = new THREE.PlaneGeometry(W, D, nx, nz); g.rotateX(-Math.PI / 2); const roads = roadGrid(graph);
  const pos = g.attributes.position, c = new Float32Array(pos.count * 3), grass = col('grass'), dark = col('grassDark'), sand = col('sand'), deep = new THREE.Color('#e9d49a'), hill = new THREE.Color('#a9dd7a'), soil = new THREE.Color('#b99a68'), patch = grass.clone().lerp(new THREE.Color('#d6df72'), .55), t = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z), s = shore(x, z); pos.setY(i, h);
    const n = .5 + .5 * Math.sin(x * 1.7 + Math.sin(z * 1.3) * 1.4) * Math.cos(z * 1.9 - x * .6);
    t.copy(grass).lerp(dark, n * .55); if (h > .7) t.lerp(hill, Math.min(1, (h - .7) * .8));
    if (s < .9) {   // the lawn: big soft patches of lighter and darker grass and some dry yellowish ones, and bare soil just outside the pavements
      const v = vnoise(x * .45, z * .45) * .6 + vnoise(x * 1.6, z * 1.6) * .4; t.offsetHSL(0, 0, (v - .5) * .09);
      const dry = Math.max(0, vnoise(x * .3 + 9, z * .3 - 4) - .6) / .4; t.lerp(patch, dry * .35);
      const d = roads.near(x, z, 1.6); if (d < 1.5) t.lerp(soil, (1 - Math.min(1, Math.max(0, (d - .88) / .5))) * .55 * (1 - Math.min(1, Math.max(0, (s - .8) / .1))));
    }
    if (s > .9) t.lerp(sand, Math.min(1, (s - .9) / .035)); if (s > .97) t.lerp(deep, Math.min(1, (s - .97) / .05));
    c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({vertexColors: true})); m.receiveShadow = true; return m;
}
// Tufts of grass scattered over the lawns: one instanced mesh that sways in the wind. `show(n)` shows the first n (the picture quality decides how many).
export function buildTufts(graph, max = 2400) {
  const blade = (rot, lean) => new THREE.ConeGeometry(.022, .11, 4).translate(0, .055, 0).rotateZ(lean).rotateY(rot), geo = mergeGeometries([blade(0, .12), blade(2.1, -.1), blade(4.2, .16)].map(g => g.toNonIndexed()), false);
  const mat = new THREE.MeshLambertMaterial({color: '#ffffff'});
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time; sh.uniforms.uWind = U.wind; sh.uniforms.uSway = U.sway;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime, uSway; uniform vec2 uWind;').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float ph = uTime * 2.1 + instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 1.1; transformed.xz += (uWind * (.6 + .4 * sin(ph)) * (.4 + uSway)) * position.y * .9; }');
  };
  mat.customProgramCacheKey = () => 'toytuft1';
  const mesh = new THREE.InstancedMesh(geo, mat, max), roads = roadGrid(graph), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color(), light = col('grass'), dark = col('grassDark');
  const loopGrid = pointGrid(graph.loop.pts); let n = 0;
  for (let k = 0; n < max && k < max * 6; k++) {
    const x = (rand(k * 5 + 11) - .5) * 40, z = (rand(k * 5 + 12) - .5) * 33;
    if (shore(x, z) > .84 || roads.near(x, z, 1.3) < 1.05 || loopGrid.near(x, z, 1.8) < 1.5 || Math.hypot(x - POND.x, z - POND.z) < POND.r + .9 || (x > PADDOCK.x0 - .4 && x < PADDOCK.x1 + .4 && z > PADDOCK.z0 - .4 && z < PADDOCK.z1 + .4) || (x > PIER.x0 - 1 && Math.abs(z - PIER.z) < 1.2)) continue;
    if (BUILDINGS.some(b => Math.hypot(b.x - x, b.z - z) < b.w * .5 + .55)) continue;
    const s = .8 + rand(k * 5 + 13) * .5; mesh.setMatrixAt(n, m.compose(v.set(x, heightAt(x, z) - .01, z), q.setFromEuler(e.set(0, rand(k * 5 + 14) * TAU, 0)), sc.set(s, s * (.8 + rand(k * 5 + 15) * .5), s)));
    mesh.setColorAt(n, c.copy(light).lerp(dark, rand(k * 5 + 16) * .6).offsetHSL(0, 0, -.02 + rand(k * 5 + 17) * .07)); n++;
  }
  mesh.userData.total = n; mesh.count = n; mesh.frustumCulled = false; mesh.userData.show = k => { mesh.count = Math.min(n, Math.max(0, k | 0)); mesh.visible = mesh.count > 0; }; return mesh;
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
  disc(parts, SQUARE.x, SQUARE.z, 0, 6.1, '#f1e2c2', .012, 64);
  for (let k = 0; k < 5; k++) disc(parts, SQUARE.x, SQUARE.z, 3.25 + k * .55, 3.3 + k * .55, '#e3d0a8', .016, 64);
  disc(parts, SQUARE.x, SQUARE.z, R - w, R + w, 'road', .03, 64); disc(parts, SQUARE.x, SQUARE.z, R - w - .1, R - w, 'kerb', .045, 64); disc(parts, SQUARE.x, SQUARE.z, R + w, R + w + .1, 'kerb', .045, 64);
  disc(parts, SQUARE.x, SQUARE.z, 0, R - w - .1, 'grass', .04, 48);
  const dash = (L, s0, s1) => { for (let s = s0; s + .3 < s1; s += .7) ribbon(parts, L, -.025, .025, 'white', .038, s, s + .32, .16); };
  const m = w + .12;   // where a road's own markings start and stop, clear of the junction at each end
  for (const e of graph.edges) {
    const L = e.line;
    if (e.kind === 'ring') { dash(L, .15, L.length - .15); continue; }
    ribbon(parts, L, -w, w, 'road', .028, 0, L.length);
    const a = e.kind === 'spoke' ? m : 1.0, b = L.length - (e.kind === 'spoke' ? m : 1.0);
    ribbon(parts, L, w, w + .1, 'kerb', .044, a, b); ribbon(parts, L, -w - .1, -w, 'kerb', .044, a, b);
    ribbon(parts, L, ROAD.pave - .15, ROAD.pave + .17, '#ead9b8', .02, a + .3, b - .3); ribbon(parts, L, -ROAD.pave - .17, -ROAD.pave + .15, '#ead9b8', .02, a + .3, b - .3);
    dash(L, a + .4, b - .4);
    if (e.kind === 'spoke') {   // a zebra crossing where the street meets the square
      const z0 = along(L, m + .75), [lx, lz] = leftOf(z0.tx, z0.tz); for (let k = -2; k <= 2; k++) { const cx = z0.x + lx * k * .17, cz = z0.z + lz * k * .17, y = heightAt(cx, cz) + .037, hw = .055, hl = .2, pts = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([a2, b2]) => [cx + lx * a2 + z0.tx * b2, y, cz + lz * a2 + z0.tz * b2]); const c = col('white'), pos = [], colr = [], nor = []; for (const v of [pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]) { pos.push(...v); colr.push(c.r, c.g, c.b); nor.push(0, 1, 0); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); parts.push(g); }
    }
  }
  // a round patch where each spoke meets the outer ring, so the junction has no seams
  for (const n of Object.values(graph.nodes)) if (n.id.startsWith('out')) disc(parts, n.p[0], n.p[1], 0, w + .02, 'road', .0285, 20);
}
function tree(b, kind, seed) {
  const r = k => rand(seed * 13 + k);
  if (kind === 'bush') { for (let k = 0; k < 3; k++) b.sph(.3 - k * .04, k % 2 ? 'leaf' : 'leafLight', {x: (r(k) - .5) * .4, y: .2 + k * .05, z: (r(k + 5) - .5) * .4, sy: .8, seg: 10, sway: .3}); for (let k = 0; k < 4; k++) b.sph(.05, ['pink', 'white', 'yellow', 'red'][k], {x: (r(k + 9) - .5) * .5, y: .38 + r(k) * .1, z: (r(k + 12) - .5) * .5, seg: 6}); return; }
  if (kind === 'pine') { b.cyl(.07, .1, .4, 'brown', {seg: 7}); const snow = SEASONAL.leafLight === '#e4eef5'; [[.5, .5, .55], [.4, 1.0, .52], [.3, 1.45, .46], [.2, 1.8, .4]].forEach(([rr, y, h], k) => { b.cone(rr, h, k % 2 ? '#2f7d4f' : '#3a8c58', {y, seg: 9, sway: .5 + k * .15}); if (snow) b.cone(rr * .72, h * .55, '#ffffff', {y: y + h * .42, seg: 9, sway: .5}); }); return; }
  if (kind === 'birch') { b.cyl(.05, .07, 1.0, '#f1ece0', {seg: 7}); for (let k = 0; k < 5; k++) b.box(.1, .025, .1, '#3a3a3a', {y: .2 + k * .17, r: .01, ry: k}); [[.34, .95, 0, 0], [.3, 1.25, .16, .08], [.28, 1.2, -.18, -.06], [.24, 1.55, .0, .04]].forEach(([rr, y, dx, dz], k) => b.sph(rr, k % 2 ? 'leafLight' : lighten('leaf', .12), {x: dx, y, z: dz, sy: 1.1, seg: 12, sway: .5 + k * .15})); return; }
  if (kind === 'tall') { b.cyl(.08, .11, .5, 'brown', {seg: 8}); [[.42, .62, 'leaf', .4], [.34, 1.08, SEASONAL.blossom ? lighten('leaf', .14) : 'leafLight', .7], [.24, 1.46, 'leaf', 1]].forEach(([s, y, c, w]) => b.sph(s, c, {y, sy: 1.15, seg: 12, sway: w})); return; }
  b.cyl(.1, .14, .62, 'brown', {seg: 8}); const deep = SEASONAL.blossom ? 'blossom' : 'leaf';   // (in spring the whole crown is blossom, not pink with a green cap)
  b.sph(.62, 'leafLight', {y: 1.0, seg: 18, sway: .6}); b.sph(.45, deep, {x: .34, y: .84, z: .12, seg: 16, sway: .5}); b.sph(.42, lighten('leafLight', .12), {x: -.3, y: 1.1, z: -.1, seg: 16, sway: .8}); b.sph(.36, deep, {x: .05, y: 1.4, z: .1, seg: 14, sway: 1});
  if (kind === 'apple') for (let k = 0; k < 9; k++) { const a = r(k) * TAU, v = r(k + 20) * 1.1 - .2; b.sph(.065, 'red', {x: Math.cos(a) * Math.cos(v) * .6, y: 1.0 + Math.sin(v) * .6, z: Math.sin(a) * Math.cos(v) * .6, seg: 8}); }
}
function scenery(bag, graph) {
  const onGround = (x, z, f, ry = 0, s = 1) => { bag.push(x, heightAt(x, z), z, ry, s); f(bag); bag.pop(); };
  const nearRoad = (x, z) => { let d = Infinity; for (const e of graph.edges) for (const p of e.line.pts) d = Math.min(d, Math.hypot(p[0] - x, p[1] - z)); return d; };
  const loopPts = graph.loop.pts.filter((_, k) => k % 6 === 0);
  const nearBuilding = (x, z) => Math.min(...BUILDINGS.map(b => Math.hypot(b.x - x, b.z - z) - b.w * .5 + .8), loopPts.some(p => Math.hypot(p[0] - x, p[1] - z) < 1.3) ? 0 : 9, x > PADDOCK.x0 - .8 && x < PADDOCK.x1 + .8 && z > PADDOCK.z0 - .8 && z < PADDOCK.z1 + .8 ? 0 : 9, Math.hypot((x - POND.x) / 1.4, z - POND.z) < 2 ? 0 : 9, x > PIER.x0 - 1.5 && Math.abs(z - PIER.z) < 1.2 ? 0 : 9);
  TREES.forEach(([x, z, kind, s], i) => { if (nearRoad(x, z) > .9 && nearBuilding(x, z) > 1.5 && !inGarden(x, z, .25)) onGround(x, z, b => tree(b, kind, i + 1), rand(i) * TAU, s * .9); });
  // lamp posts and benches round the square, bunting strung between the lamps
  const lamps = []; for (let k = 0; k < 8; k++) { const a = (k + .5) / 8 * TAU, x = Math.cos(a) * 3.35, z = Math.sin(a) * 3.35; if (k % 2 === 0) continue; lamps.push([x, z]); }
  for (let k = 0; k < 8; k++) lamps[k] = [LAMPS[k].x, LAMPS[k].z];   // the bunting hangs between the eight lamps round the square
  for (const l of LAMPS) onGround(l.x, l.z, b => lamp(b, 0, 0));   // every lamp post: round the square and along each street
  const flags = ['red', 'yellow', 'sky', 'pink', 'green', 'orange', 'purple', 'white'];
  for (let k = 0; k < 8; k++) { const [x0, z0] = lamps[k], [x1, z1] = lamps[(k + 1) % 8], n = 9, ry = Math.atan2(x1 - x0, z1 - z0); for (let m = 1; m < n; m++) { const f = m / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f, y = 1.08 - Math.sin(f * Math.PI) * .22; bag.cone(.075, .14, flags[(m + k) % 8], {x, y: y - .14, z, ry: ry + Math.PI / 2, rx: Math.PI, sz: .25, seg: 3}); } bag.tube([[x0, 1.1, z0], [(x0 + x1) / 2, .86, (z0 + z1) / 2], [x1, 1.1, z1]], .008, 'white'); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + Math.PI / 4, x = Math.cos(a) * 1.52, z = Math.sin(a) * 1.52; onGround(x, z, b => bench(b, 0, 0, -a + Math.PI / 2)); }
  // a signpost on the green, a pillar box, tubs by the crossings
  onGround(1.25, .45, b => { b.cyl(.03, .04, .95, 'white', {seg: 8}); [['red', .3, 0], ['blue', .52, 1.6], ['yellow', .72, 3.2], ['green', .5, 4.7]].forEach(([c, y, a]) => { b.push(0, y, 0, a); b.box(.42, .1, .03, c, {x: .24, r: .02}); b.cone(.07, .1, c, {x: .47, y: .0, rz: -Math.PI / 2, seg: 4}); b.pop(); }); b.sph(.05, 'gold', {y: .98, seg: 8}); });
  // hedges and flowers along the lanes, wild flowers in the meadows
  for (const e of graph.edges) if (e.kind === 'spoke') for (let s = 1.6; s < e.line.length - 1.0; s += .7) for (const side of [-1, 1]) {
    const q = along(e.line, s), [lx, lz] = leftOf(q.tx, q.tz), x = q.x + lx * side * 1.18, z = q.z + lz * side * 1.18;
    if (nearBuilding(x, z) < 1.2 || Math.hypot(x, z) < 6.3 || shore(x, z) > .88) continue;
    const k = Math.round(s * 7 + side * 3); bag.sph(.28, k % 3 ? 'leaf' : 'leafLight', {x, y: heightAt(x, z) + .14, z, sx: 1.5, sy: .85, seg: 7}); if (k % 4 === 0) bag.sph(.05, ['pink', 'white', 'yellow'][k % 3], {x: x + .05, y: heightAt(x, z) + .34, z, seg: 6});
  }
  for (let k = 0; k < 480; k++) { const x = (rand(k * 3 + 1) - .5) * 39, z = (rand(k * 3 + 2) - .5) * 32; if (shore(x, z) > .88 || nearRoad(x, z) < 1.0 || nearBuilding(x, z) < 1.2 || Math.hypot(x, z) < 6.2) continue; const y = heightAt(x, z); bag.sph(.045, ['white', 'yellow', 'pink', 'red', 'purple'][k % 5], {x, y: y + .08, z, seg: 6}); bag.cyl(.008, .008, .08, 'leaf', {x, y, z, seg: 4}); }
  // bus stop signs, on the pavement by the doorstep of each stop
  for (const id of new Set(Object.values(BUS_LINES).flat())) { const d0 = graph.doors[id], d = graph.attach(d0.x, d0.z), e = graph.edge(d.edge), q = along(e.line, d.s), [lx, lz] = leftOf(q.tx, q.tz), side = e.kind === 'ring' ? 1 : d.side, x = q.x + lx * side * (ROAD.pave + .3), z = q.z + lz * side * (ROAD.pave + .3); onGround(x, z, b => { b.cyl(.02, .025, .78, 'slate', {seg: 6}); b.cyl(.13, .13, .03, 'red', {y: .78, rx: Math.PI / 2, seg: 16}); b.cyl(.09, .09, .035, 'white', {y: .795, rx: Math.PI / 2, seg: 16, centre: false}); }, Math.atan2(q.tx, q.tz)); }
}

// The signal for each station stands just before the platform, on the far side of the track (so it faces the driver): its post is part of the railway,
// its lamp (red while the train is standing at or coming into the station, green otherwise) is one instanced mesh.
export function signalSpot(graph, st) {
  const p = loopPt(st.t), s0 = graph.loopS(p[0], p[1]), q = along(graph.loop, s0 - 1.9);
  return {x: q.x + q.tz * .62, z: q.z - q.tx * .62, ry: Math.atan2(q.tx, q.tz)};
}
export function buildSignals(graph) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({color: '#ffffff', fog: false}), STATIONS.length), m = new THREE.Matrix4(), c = new THREE.Color();
  STATIONS.forEach((st, i) => { const q = signalSpot(graph, st); mesh.setMatrixAt(i, m.makeTranslation(q.x, heightAt(q.x, q.z) + .82, q.z)); mesh.setColorAt(i, c.set('#46d36a')); });
  mesh.frustumCulled = false; mesh.userData.set = (i, red) => { mesh.setColorAt(i, c.set(red ? '#ff4a3d' : '#46d36a')); mesh.instanceColor.needsUpdate = true; };
  return mesh;
}
// The railway loop: ballast, sleepers and two rails all the way round the town, with a platform, shelter and sign at each station.
function railway(bag, graph) {
  const loop = graph.loop, parts = bag.parts, L = loop.length;
  ribbon(parts, loop, -.46, .46, '#d6caa6', .022, 0, L, .3);
  for (let s = 0; s < L - .2; s += .36) ribbon(parts, loop, -.34, .34, '#8a5a3c', .032, s, s + .13, .13);
  for (const o of [-.19, .19]) { ribbon(parts, loop, o - .035, o + .035, '#4a525e', .05, 0, L, .25); ribbon(parts, loop, o - .012, o + .012, '#aab4c0', .058, 0, L, .25); }
  const colours = ['red', 'blue', 'green', 'yellow'];
  for (const st of STATIONS) { const q = signalSpot(graph, st); bag.push(q.x, heightAt(q.x, q.z), q.z, q.ry); bag.cyl(.032, .04, .72, 'slate', {seg: 8}); bag.box(.13, .2, .1, 'black', {y: .66, r: .03}); bag.box(.05, .05, .06, 'white', {y: .54, z: .0, r: .01}); bag.pop(); }
  STATIONS.forEach((st, i) => {
    const p = loopPt(st.t), s0 = graph.loopS(p[0], p[1]), q = along(loop, s0), x = q.x, z = q.z, y = heightAt(x, z), ry = Math.atan2(q.tx, q.tz), c = colours[i % 4];
    bag.push(x, y, z, ry);   // local +z runs along the track the way the train goes, local +x is outwards, -x towards the town
    bag.box(.85, .17, 3.6, 'stone', {x: -.95, r: .03}); bag.box(.14, .02, 3.6, 'yellow', {x: -.62, y: .17}); bag.box(.6, .02, 3.5, '#efe0be', {x: -1.05, y: .17});
    for (const dz of [-1.5, 1.5]) { bag.cyl(.03, .035, .95, 'slate', {x: -1.2, y: .17, z: dz, seg: 6}); }
    bag.box(.7, .06, 3.4, c, {x: -1.2, y: 1.1, r: .025}); bag.box(.5, .04, 3.3, lighten(c, .25), {x: -1.2, y: 1.15, r: .02});   // a little shelter roof
    bag.box(.3, .2, 1.1, 'wood', {x: -1.35, y: .17, z: .1, r: .03}); bag.box(.34, .05, 1.2, 'wood', {x: -1.35, y: .4, z: .1, r: .02});   // a bench
    bag.cyl(.025, .03, 1.2, 'slate', {x: -.75, y: .17, z: 1.85, seg: 6}); bag.box(.06, .42, .7, c, {x: -.75, y: 1.0, z: 1.85, r: .02}); bag.box(.07, .3, .55, 'white', {x: -.75, y: 1.06, z: 1.85, r: .02});   // the station sign
    bag.pop();
  });
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
// The harbour pier: a wooden pier from the hut out to sea. It rises over the railway on a little trestle so the train runs underneath.
function pier(bag) {
  const {x0, x1, z, bridge: br} = PIER, deckY = x => { const d = Math.abs(x - br.x), k = Math.max(0, Math.min(1, (br.half + 1.3 - d) / 1.3)); return .22 + (br.h - .22) * k * k * (3 - 2 * k); };
  const n = Math.round((x1 - x0) / .2);
  for (let k = 0; k < n; k++) { const x = x0 + (k + .5) * .2; bag.box(.2, .04, .56, k % 2 ? '#b98a58' : '#c89a64', {x, y: deckY(x), z, r: .01}); for (const dz of [-.28, .28]) bag.box(.2, .03, .03, 'white', {x, y: deckY(x) + .2, z: z + dz}); }
  for (let x = x0 + .2; x < x1; x += 1.0) for (const dz of [-.22, .22]) { const g = heightAt(x, z + dz), base = Math.min(g, -.12), top = deckY(x); bag.cyl(.045, .05, top - base, 'wood', {x, y: base, z: z + dz, seg: 6}); }
  for (const dx of [-br.half, br.half]) for (const dz of [-.22, .22]) { const base = heightAt(br.x + dx, z + dz); bag.cyl(.06, .07, deckY(br.x + dx) - base, 'wood', {x: br.x + dx, y: base, z: z + dz, seg: 6}); }
  bag.cyl(.07, .08, .1, 'red', {x: x1 - .05, y: deckY(x1) + .02, z: z + .2, seg: 10}); bag.cyl(.02, .02, .55, 'slate', {x: x1 - .05, y: deckY(x1) + .1, z: z - .3, seg: 6}); bag.box(.14, .12, .14, '#fff4c4', {x: x1 - .05, y: deckY(x1) + .66, z: z - .3, r: .03});
}

/* ---------------- the whole static town ---------------- */

// The farmyard round Hay Farm: a vegetable field behind the house with rows of crops and a scarecrow, a well, a haystack, a mailbox and crates of apples.
function farmYard(b) {
  b.box(2.3, .04, 1.0, '#6b4a30', {z: -1.9, r: .01});
  for (let row = 0; row < 5; row++) { const z = -1.55 - row * .17; b.box(2.2, .05, .06, '#5a3d28', {z, y: .04, r: .01});
    for (let k = 0; k < 9; k++) { const x = -.95 + k * .24 + (row % 2) * .08; if (row < 2) b.sph(.065, k % 2 ? 'leaf' : 'leafLight', {x, y: .09, z, sy: .8, seg: 7, sway: .3}); else if (row < 4) { b.cyl(.012, .016, .1, '#e87a2b', {x, y: .04, z, seg: 5}); cone2h(b, .05, .12, 'leaf', {x, y: .1, z}); } else { b.cyl(.012, .016, .3, 'leaf', {x, y: .04, z, seg: 5, sway: .8}); b.cone(.03, .1, '#e8c458', {x, y: .34, z, seg: 5, sway: .8}); } } }
  for (const dx of [-1.2, 1.2]) for (let k = 0; k < 6; k++) b.cyl(.014, .018, .28, 'wood', {x: dx, z: -1.45 - k * .19, seg: 5});
  for (let k = 0; k < 7; k++) b.cyl(.014, .018, .28, 'wood', {x: -1.2 + k * .4, z: -2.45, seg: 5});
  b.box(2.4, .03, .03, 'wood', {y: .14, z: -2.45}); b.box(2.4, .03, .03, 'wood', {y: .22, z: -2.45});
  b.cyl(.014, .014, .62, 'wood', {x: .6, y: .04, z: -1.9, seg: 5}); b.box(.5, .03, .03, 'wood', {x: .6, y: .45, z: -1.9}); b.sph(.07, '#e8d29a', {x: .6, y: .7, z: -1.9, seg: 8}); cone2h(b, .1, .1, '#8a5a3c', {x: .6, y: .8, z: -1.9}); b.box(.3, .22, .02, '#b5442f', {x: .6, y: .34, z: -1.9, r: .005});   // the scarecrow
  b.cyl(.26, .3, .32, '#bdb4a2', {x: 1.5, z: .1, seg: 14}); b.cyl(.2, .2, .02, '#3d6f8f', {x: 1.5, y: .32, z: .1, seg: 14}); for (const sz of [-1, 1]) b.cyl(.015, .015, .5, 'wood', {x: 1.5, y: .32, z: .1 + sz * .24, seg: 5}); b.gable(.62, .2, .6, '#7a4a30', {x: 1.5, y: .8, z: .1, ry: Math.PI / 2}); b.cyl(.01, .01, .3, 'slate', {x: 1.5, y: .56, z: .1, seg: 4, rz: Math.PI / 2}); b.cyl(.05, .04, .08, 'wood', {x: 1.5, y: .46, z: .1, seg: 8});   // the well
  cone2h(b, .32, .5, '#d9b94a', {x: -1.6, y: 0, z: -.9}); b.cyl(.03, .03, .1, 'wood', {x: -1.6, y: .5, z: -.9, seg: 4});   // a haystack
  b.cyl(.015, .015, .5, 'wood', {x: .95, z: 1.25, seg: 5}); b.box(.2, .13, .3, '#d94a3a', {x: .95, y: .5, z: 1.25, r: .04}); b.box(.1, .03, .02, 'white', {x: .95, y: .6, z: 1.38});   // the mailbox
  for (let k = 0; k < 3; k++) { b.box(.26, .12, .2, 'wood', {x: -1.4 + k * .3, y: 0, z: .75, r: .01}); for (let m = 0; m < 3; m++) b.sph(.045, 'red', {x: -1.46 + k * .3 + m * .06, y: .13, z: .75, seg: 6}); }
}
export function buildTown(graph, season = 'summer') {
  setSeason(season);
  const bag = new Bag(), anim = {}, material = toyMaterial();
  roads(bag, graph); scenery(bag, graph); railway(bag, graph); paddock(bag); pond(bag); pier(bag);
  for (const def of BUILDINGS) { const local = {}; bag.push(def.x, heightAt(def.x, def.z), def.z, def.ry, def.scale || 1); BUILD[def.type](bag, def, local); if (def.id === 'farm') farmYard(bag); bag.pop(); for (const k in local) anim[k] = {...local[k], def}; }
  const town = bag.mesh(material); town.castShadow = true; town.receiveShadow = true;
  const glow = bag.glowMesh(new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false})); glow.visible = false; glow.renderOrder = 2;
  const ground = terrain(graph);
  // shallows: a band of lighter water that fades out from the coast, so the island does not sit on a flat plane
  const shallows = (() => {
    const A = 96, R = [0.0, .88, 1.0, 1.12, 1.35], alpha = [0, .6, .45, .22, 0], pos = [], colr = [], idx = [];
    const radiusFor = (a, target) => { let lo = .3, hi = 2.2; for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (shore(Math.cos(a) * ISLAND.rx * m, Math.sin(a) * ISLAND.rz * m) < target) lo = m; else hi = m; } return (lo + hi) / 2; };
    for (let i = 0; i <= A; i++) { const a = i / A * TAU; for (let j = 1; j < R.length; j++) { const m = radiusFor(a, R[j] + (j === 1 ? .0 : 0)); pos.push(Math.cos(a) * ISLAND.rx * m, 0, Math.sin(a) * ISLAND.rz * m); colr.push(1, 1, 1, alpha[j]); } }
    const n = R.length - 1; for (let i = 0; i < A; i++) for (let j = 0; j < n - 1; j++) { const a = i * n + j, b2 = a + 1, c = a + n, d = c + 1; idx.push(a, c, b2, b2, c, d); }   // (wound so it faces up)
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 4)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({length: pos.length / 3}, () => [0, 1, 0]).flat(), 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, waterify(new THREE.MeshLambertMaterial({vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, color: '#9fe6e6'}), true)); m.position.y = ISLAND.sea + .02; m.renderOrder = 1; return m;
  })();
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(240, 240).rotateX(-Math.PI / 2), waterify(new THREE.MeshLambertMaterial({color: P.sea}), false)); sea.position.y = ISLAND.sea;
  // moving parts
  const place = (mesh, a, x = 0, y = 0, z = 0) => { const d = a.def, m = new THREE.Matrix4().compose(new THREE.Vector3(d.x, heightAt(d.x, d.z), d.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, d.ry, 0)), new THREE.Vector3(d.scale || 1, d.scale || 1, d.scale || 1)); const g = new THREE.Group(); g.applyMatrix4(m); const inner = new THREE.Group(); inner.position.set(x, y, z); inner.add(mesh); g.add(inner); mesh.castShadow = true; return {group: g, inner}; };
  const moving = {};
  { const b = new Bag(); b.cone(.34, .5, 'red', {rx: Math.PI, y: .0, seg: 20}); b.cyl(.34, .34, .1, 'yellow', {y: .5, seg: 20}); b.dome(.34, 'blue', {y: .6, sy: .5}); b.torus(.34, .03, 'white', {y: .55, rx: Math.PI / 2}); b.cyl(.03, .03, .32, 'gold', {y: .72, seg: 8}); b.sph(.06, 'gold', {y: 1.06, seg: 8}); const m = b.mesh(material); m.rotation.z = .16; moving.top = place(m, anim.top, anim.top.x, anim.top.y, anim.top.z); }
  { const b = new Bag(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.box(.07, 1.25, .04, 'wood', {x: Math.sin(a) * .0, y: 0, rz: -a, r: .015, centre: false}); } const g2 = new Bag(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, m4 = new THREE.Matrix4().makeRotationZ(a); g2.stack.push(m4); g2.box(.07, 1.3, .04, 'wood', {y: .08, r: .015}); g2.box(.36, .95, .025, 'cream', {x: .2, y: .38, r: .02}); for (let r2 = 0; r2 < 5; r2++) g2.box(.36, .02, .035, 'wood', {x: .2, y: .42 + r2 * .2}); g2.stack.pop(); } g2.cyl(.13, .13, .1, 'red', {rx: Math.PI / 2, centre: true, seg: 12}); const m = g2.mesh(material); moving.sails = place(m, anim.sails, 0, anim.sails.y, anim.sails.z); }
  { const mk = (len, w) => { const b = new Bag(); for (let k = 0; k < 4; k++) { b.push(0, 0, 0, k * Math.PI / 2); b.box(w, len, .02, 'black', {z: .715, r: .008}); b.pop(); } return b.mesh(material); }; moving.minute = place(mk(.36, .04), anim.clock, 0, anim.clock.y, 0); moving.hour = place(mk(.24, .055), anim.clock, 0, anim.clock.y, 0); }
  // one lantern glow per lamp post, as a single instanced mesh: the lamplighter switches them on and off one by one (scale 0 is off)
  const lampGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshBasicMaterial({color: WARM, transparent: true, opacity: .95, depthWrite: false, fog: false}), LAMPS.length);
  lampGlow.frustumCulled = false; lampGlow.renderOrder = 2; lampGlow.userData.set = (i, scale) => { const l = LAMPS[i], m = new THREE.Matrix4().compose(new THREE.Vector3(l.x, heightAt(l.x, l.z) + 1.16, l.z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale)); lampGlow.setMatrixAt(i, m); lampGlow.instanceMatrix.needsUpdate = true; };
  for (let i = 0; i < LAMPS.length; i++) lampGlow.userData.set(i, 0);
  return {town, glow, lampGlow, ground, sea, shallows, moving, material};
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
  if (def.lamplighter) { b.cyl(.012, .012, .8, 'wood', {x: .18, y: .02, z: .03, rz: -.08, seg: 6}); b.cyl(.025, .02, .05, 'slate', {x: .21, y: .79, z: .03, seg: 6}); b.sph(.03, 'gold', {x: .21, y: .86, z: .03, seg: 6}); }   // his long lighting pole
  const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(def.small ? .8 : 1.06); g.visible = false; return g;
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
  else if (def.kind === 'horsecart') {
    // a farm cart with a sturdy brown horse: the horse in front (+z), the cart behind, shafts between them
    const brown = '#8a5a3c', dark = '#3a2a20';
    b.sph(.15, brown, {y: .33, z: .62, sx: .95, sy: .85, sz: 1.9, seg: 12}); b.sph(.12, brown, {y: .35, z: .86, seg: 10});
    b.cyl(.065, .085, .26, brown, {y: .4, z: .98, rx: -.75, seg: 8}); b.sph(.075, brown, {y: .6, z: 1.08, sz: 1.35, seg: 10}); b.sph(.05, '#d9b98a', {y: .56, z: 1.17, sz: 1.2, seg: 8}); b.sph(.012, 'black', {x: .035, y: .63, z: 1.12, seg: 4}); b.sph(.012, 'black', {x: -.035, y: .63, z: 1.12, seg: 4});
    for (const sx of [-1, 1]) { b.cone(.02, .06, brown, {x: sx * .035, y: .7, z: 1.03, seg: 4}); for (const z of [.48, .76]) { b.cyl(.026, .02, .27, brown, {x: sx * .085, y: .0, z, seg: 6}); b.cyl(.03, .03, .03, dark, {x: sx * .085, y: .0, z, seg: 6}); } }
    b.box(.04, .22, .1, dark, {y: .52, z: .96, rx: -.7}); cone2c(b, .035, .13, dark, {y: .38, z: .33, rx: .9}); b.cyl(.1, .1, .05, '#b5532f', {y: .44, z: .84, rx: Math.PI / 2 - .2, seg: 12});   // mane, tail and the red collar
    for (const sx of [-1, 1]) b.box(.012, .012, .68, '#7a5230', {x: sx * .1, y: .34, z: .1, rx: .12});   // the shafts
    b.box(.34, .06, .56, '#a3744a', {y: .22, z: -.18, r: .02}); for (const sx of [-1, 1]) b.box(.03, .14, .56, '#8a5a3c', {x: sx * .18, y: .28, z: -.18, r: .01}); b.box(.34, .14, .03, '#8a5a3c', {y: .28, z: -.46, r: .01}); b.box(.34, .12, .03, '#8a5a3c', {y: .28, z: .1, r: .01});
    for (const sx of [-1, 1]) { b.cyl(.14, .14, .04, '#7a5230', {x: sx * .2, y: .14, z: -.2, rz: Math.PI / 2, centre: true, seg: 14}); for (let k = 0; k < 3; k++) b.box(.02, .26, .02, '#a3744a', {x: sx * .225, y: .14, z: -.2, rx: k * Math.PI / 3, centre: true}); b.cyl(.03, .03, .05, 'slate', {x: sx * .2, y: .14, z: -.2, rz: Math.PI / 2, centre: true, seg: 8}); }
    b.box(.26, .05, .13, '#6b4423', {y: .4, z: .02}); b.box(.26, .1, .03, '#6b4423', {y: .44, z: .06});   // the driver's seat
    for (const [x, z] of [[-.07, -.34], [.07, -.34], [-.07, -.2], [.07, -.2]]) { b.cyl(.045, .045, .13, 'white', {x, y: .25, z, seg: 8}); b.cyl(.046, .046, .02, 'blue', {x, y: .38, z, seg: 8}); }
    b.box(.2, .12, .16, '#e0b84a', {y: .25, z: -.04, r: .02});
  }
  else if (def.kind === 'pickup') {
    // a 1950s pick-up: rounded cab, long open bed, big fenders, chrome grille and round lamps; two tones
    b.box(.34, .13, .72, c, {y: .1, r: .05}); b.sph(.1, c, {x: .17, y: .16, z: .2, sx: .3, sy: .9, sz: 1.5, seg: 8}); b.sph(.1, c, {x: -.17, y: .16, z: .2, sx: .3, sy: .9, sz: 1.5, seg: 8}); b.sph(.1, c, {x: .17, y: .16, z: -.2, sx: .3, sy: .9, sz: 1.5, seg: 8}); b.sph(.1, c, {x: -.17, y: .16, z: -.2, sx: .3, sy: .9, sz: 1.5, seg: 8});
    b.box(.3, .2, .24, 'cream', {y: .22, z: .1, r: .06}); b.box(.31, .09, .2, '#bfe6f7', {y: .28, z: .1, r: .03}); b.box(.26, .1, .02, '#bfe6f7', {y: .27, z: .22, r: .01});
    b.box(.34, .13, .3, c, {y: .1, z: .38, r: .05}); b.box(.26, .08, .03, '#c8c8c8', {y: .13, z: .54}); b.box(.2, .04, .02, '#c8c8c8', {y: .18, z: .535});
    for (const sx of [-1, 1]) { b.sph(.03, '#fff8d8', {x: sx * .12, y: .21, z: .53, seg: 8}); b.box(.03, .14, .46, '#8a5a3c', {x: sx * .165, y: .16, z: -.26, r: .01}); } b.box(.3, .03, .46, '#a3744a', {y: .13, z: -.26}); b.box(.3, .12, .03, '#8a5a3c', {y: .16, z: -.5});
    for (const k of [-.05, .05]) b.cyl(.04, .04, .11, 'white', {x: k, y: .17, z: -.2, seg: 8}); b.box(.2, .1, .18, '#e0b84a', {y: .16, z: -.38, r: .02});
    wheels([-.17, .17], [-.24, .24], .085); for (const s of [-1, 1]) b.sph(.025, '#d94a3a', {x: s * .13, y: .15, z: -.5, seg: 6});
  }
  else { // a 1950s saloon: swept fenders over cream whitewall tyres, a rounded cabin, little tail fins, chrome bumpers and big round lamps
    b.box(.34, .12, .66, c, {y: .1, r: .05}); for (const x of [-.17, .17]) for (const z of [-.2, .2]) b.sph(.095, c, {x, y: .15, z, sx: .35, sy: .95, sz: 1.6, seg: 8});
    b.sph(.17, 'cream', {y: .27, z: -.03, sx: 1.0, sy: .62, sz: 1.35, seg: 12}); b.box(.27, .075, .24, '#bfe6f7', {y: .27, z: -.03, r: .03}); b.box(.22, .075, .3, '#bfe6f7', {y: .27, z: -.03, r: .03});
    for (const s of [-1, 1]) { b.box(.04, .09, .13, c, {x: s * .155, y: .27, z: -.31, rz: s * .15, r: .01}); b.sph(.032, '#fff8d8', {x: s * .11, y: .15, z: .335, seg: 8}); b.sph(.018, 'black', {x: s * .11, y: .15, z: .36, seg: 6}); b.sph(.022, 'red', {x: s * .12, y: .17, z: -.33, seg: 6}); }
    b.box(.3, .035, .03, '#d8d8d8', {y: .08, z: .34, r: .012}); b.box(.3, .035, .03, '#d8d8d8', {y: .08, z: -.34, r: .012}); b.box(.2, .04, .02, '#d8d8d8', {y: .14, z: .335});
    if (def.id === 'taxi' || def.id === 'taxi2') { b.box(.14, .06, .08, 'white', {y: .4, z: -.04, r: .02}); for (let k = 0; k < 5; k++) for (const s of [-1, 1]) b.box(.01, .03, .06, k % 2 ? 'black' : 'white', {x: s * .175, y: .15, z: -.24 + k * .12}); }
    wheels([-.17, .17], [-.2, .2], .08); }
  const m = b.mesh(material); m.castShadow = true; if (def.kind === 'horsecart') m.position.z = -.33; const g = new THREE.Group(); g.add(m); g.scale.setScalar(1.05); return g;   // (the cart's origin is the middle of horse and cart together)
}
/* ---------------- more moving things: train, boat, farm animals, ducks ---------------- */
// The little train: an engine with a funnel and two coaches, facing +z, length about 1.9.
// The train: an engine and three coaches, each its own small mesh so they can follow the curve of the loop. Each car's origin is its middle and its front is +z.
export function buildTrain(material) {
  const car = f => { const b = new Bag(); f(b); const m = b.mesh(material); m.castShadow = true; const g = new THREE.Group(); g.add(m); g.scale.setScalar(.95); return g; };
  const engine = car(b => {
    b.push(0, 0, -.42);
    b.box(.4, .3, .62, 'red', {y: .08, z: .5, r: .08}); b.cyl(.2, .2, .55, 'red', {y: .14, z: .55, rx: Math.PI / 2, centre: false, seg: 18}); b.box(.42, .34, .3, 'red', {y: .1, z: .1, r: .06}); b.box(.46, .04, .34, 'yellow', {y: .44, z: .1, r: .02});
    b.cyl(.06, .08, .22, 'black', {y: .36, z: .78, seg: 10}); b.cyl(.1, .06, .05, 'gold', {y: .58, z: .78, seg: 10}); b.sph(.075, 'gold', {y: .46, z: .6, seg: 8});
    for (const s of [-1, 1]) { for (const z of [.0, .3, .72]) { b.cyl(.09, .09, .06, 'black', {x: s * .2, y: .09, z, rz: Math.PI / 2, centre: true, seg: 14}); b.cyl(.045, .045, .065, 'cream', {x: s * .2, y: .09, z, rz: Math.PI / 2, centre: true, seg: 10}); } b.box(.025, .03, .8, 'slate', {x: s * .2, y: .09, z: .35, r: .01}); }
    b.sph(.05, '#fff4c4', {y: .24, z: .83, seg: 8}); b.box(.2, .03, .03, 'white', {y: .13, z: .84, r: .01});
    b.pop();
  });
  const coach = c => car(b => { const z = 0; b.box(.44, .32, .8, c, {y: .1, z, r: .08}); b.box(.46, .05, .82, 'cream', {y: .42, z, r: .02}); for (const s of [-1, 1]) for (const k of [-1, 0, 1]) b.box(.02, .13, .17, '#bfe6f7', {x: s * .222, y: .27, z: z + k * .24, r: .01}); for (const s of [-1, 1]) for (const zz of [-.28, .28]) { b.cyl(.08, .08, .05, 'black', {x: s * .21, y: .08, z: z + zz, rz: Math.PI / 2, centre: true, seg: 12}); } b.box(.2, .06, .1, 'slate', {y: .22, z: z + .42, r: .02}); });
  const wagon = car(b => {   // an open goods wagon: a flat bed with low wooden sides, so the cargo in it shows
    b.box(.46, .08, .86, 'slate', {y: .1, r: .02}); b.box(.44, .05, .84, '#8a5a3c', {y: .17, r: .01});
    for (const s of [-1, 1]) { b.box(.03, .14, .86, '#b07a4a', {x: s * .22, y: .2, r: .01}); }
    for (const z of [-.43, .43]) b.box(.46, .14, .03, '#b07a4a', {y: .2, z, r: .01});
    for (const s of [-1, 1]) for (const zz of [-.28, .28]) b.cyl(.08, .08, .05, 'black', {x: s * .21, y: .08, z: zz, rz: Math.PI / 2, centre: true, seg: 12});
  });
  return [engine, coach('yellow'), coach('blue'), wagon];
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
  const b = new Bag(); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + .4, x = Math.cos(a) * (25 + rand(k * 5 + 1) * 5), z = Math.sin(a) * (20.5 + rand(k * 5 + 2) * 4), s = .5 + rand(k * 5 + 3) * .35; b.push(x, rand(k * 5 + 4) * 1.4, z, 0, s); [[0, 0, 0, 1.1], [1.0, -.1, .1, .8], [-1.0, -.12, -.1, .85], [.4, .35, 0, .75], [-.45, .3, .15, .7]].forEach(([dx, dy, dz, r]) => b.sph(r, 'white', {x: dx, y: dy, z: dz, sy: .7, seg: 12})); b.pop(); }
  const m = b.mesh(new THREE.MeshLambertMaterial({vertexColors: true, transparent: true, opacity: .96})); m.position.y = 1.6; return m;
}
// Puddles: flat shiny ovals on the roads, pavements and verges. `userData.set(wet)` grows them as the ground gets wet and shrinks them as it dries (each has its own point at which it appears).
export function buildPuddles(graph) {
  const N = 52, total = graph.edges.reduce((n, e) => n + e.line.length, 0), spots = [];
  for (let k = 0; k < N; k++) {
    let t = rand(k * 7 + 1) * total, e = graph.edges[0]; for (const ed of graph.edges) { if (t < ed.line.length) { e = ed; break; } t -= ed.line.length; }
    const q = along(e.line, t), [lx, lz] = leftOf(q.tx, q.tz), lat = (rand(k * 7 + 2) - .5) * (rand(k * 7 + 3) < .65 ? .7 : 2.2), x = q.x + lx * lat, z = q.z + lz * lat;
    if (BUILDINGS.some(b => Math.hypot(b.x - x, b.z - z) < 1.05) || shore(x, z) > .85) continue;
    spots.push({x, z, a: Math.atan2(q.tx, q.tz), w: .22 + rand(k * 7 + 4) * .3, d: .13 + rand(k * 7 + 5) * .17, thr: .04 + rand(k * 7 + 6) * .55});
  }
  const geo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshLambertMaterial({color: '#a9d3ea', emissive: '#1b3347', transparent: true, opacity: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  let last = -1;
  mesh.userData.set = wet => {
    if (Math.abs(wet - last) < .01) return; last = wet; mesh.visible = wet > .04 && spots.length > 0;
    spots.forEach((p, i) => { const f = Math.max(0, Math.min(1, (wet - p.thr) / .3)); q.setFromAxisAngle(up, p.a); pos.set(p.x, heightAt(p.x, p.z) + .05, p.z); sc.set(Math.max(.001, p.w * f), 1, Math.max(.001, p.d * f)); m.compose(pos, q, sc); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}
// Cargo (mail sacks, milk churns, loaves, parcels) as one instanced mesh of little crates: the sim says where each is, `set(i, x, y, z, kind)` puts one there and
// `show(n)` shows the first n. Passengers are one instanced mesh of heads (`set(i, x, y, z, colour)`) seen through the coach windows.
export function buildCargo(max = 48) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.15, .12, .15), new THREE.MeshLambertMaterial({color: '#ffffff'}), max), m = new THREE.Matrix4(), c = new THREE.Color();
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.count = 0;
  mesh.userData.set = (i, x, y, z, kind, ry = 0) => { m.makeRotationY(ry).setPosition(x, y, z); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(CARGO_COLOURS[kind] || '#ffffff')); };
  mesh.userData.show = n => { mesh.count = Math.min(max, n); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  return mesh;
}
export function buildPassengers(max = 16) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshLambertMaterial({color: '#ffffff'}), max), m = new THREE.Matrix4(), c = new THREE.Color();
  mesh.frustumCulled = false; mesh.count = 0;
  mesh.userData.set = (i, x, y, z, colour) => { m.makeTranslation(x, y, z); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(P[colour] || colour || '#f4c9a0')); };
  mesh.userData.show = n => { mesh.count = Math.min(max, n); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  return mesh;
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
// A sky that shades from the horizon (the colour of the haze, so the sea melts into it) up to a deeper blue, with a warm glow round the sun when it is low.
export function buildSkyDome() {
  const u = {uBottom: {value: new THREE.Color('#bfe9fb')}, uTop: {value: new THREE.Color('#6fb8ee')}, uSun: {value: new THREE.Vector3(0, 1, 0)}, uGlow: {value: 0}, uGlowColor: {value: new THREE.Color('#ffb070')}};
  const m = new THREE.ShaderMaterial({uniforms: u, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'varying vec3 vDir; uniform vec3 uBottom, uTop, uSun, uGlowColor; uniform float uGlow; void main() { vec3 d = normalize(vDir); float h = clamp(d.y * 1.6, 0., 1.); vec3 c = mix(uBottom, uTop, pow(h, .7)); float s = max(dot(d, normalize(uSun)), 0.); c += uGlowColor * uGlow * (pow(s, 6.) * .35 + pow(s, 40.) * .5); gl_FragColor = vec4(c, 1.); }'});
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), m); mesh.renderOrder = -10; mesh.frustumCulled = false; mesh.userData.u = u; return mesh;
}
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
// a soft round dot, so petals, snow and fireflies are round and not square pixels
let dotTex = null;
function softDot() {
  if (dotTex || typeof document === 'undefined') return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  dotTex = new THREE.CanvasTexture(c); return dotTex;
}
export function buildFall(season = 'summer') {
  const cfg = FALL[season] || FALL.summer, N = 320, X = 38, Z = 28, Y = 12, pos = new Float32Array(N * 3), seeds = Array.from({length: N}, (_, k) => [(rand(k * 4 + 1) - .5) * X, rand(k * 4 + 2) * Y, (rand(k * 4 + 3) - .5) * Z, rand(k * 4 + 4) * TAU]);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({color: cfg.colour, size: cfg.size, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false, map: softDot(), alphaTest: .02});
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false;
  pts.userData.update = (time, amount, wind) => {
    const n = Math.floor(N * amount); geo.setDrawRange(0, n); pts.visible = n > 2; if (!pts.visible) return;
    mat.opacity = cfg.op * (cfg.fall ? 1 : .55 + .35 * Math.sin(time * 2.1));   // fireflies pulse
    for (let k = 0; k < n; k++) {
      const [x, y0, z, ph] = seeds[k], y = cfg.fall ? Y - ((y0 + time * cfg.fall) % Y) : .35 + y0 / Y * 1.7 + Math.sin(time * .7 + ph) * .2;
      pos[k * 3] = x + Math.sin(time * .8 + ph) * cfg.sway + (wind ? wind.x * 1.2 * (1 - y / Y * .5) : 0); pos[k * 3 + 1] = y; pos[k * 3 + 2] = z + Math.cos(time * .6 + ph) * cfg.sway + (wind ? wind.z * 1.2 * (1 - y / Y * .5) : 0);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
export {doorOf};

// Market day: the goods on the counters and the sellers behind them. One small mesh, shown only while the market is open.
export function buildMarketGoods(def, material) {
  const b = new Bag(); b.push(def.x, heightAt(def.x, def.z), def.z, def.ry, def.scale || 1);
  const stalls = [{x: -1.12, coat: 'red', goods: ['milk', 'milk', 'milk']}, {x: 0, coat: 'blue', goods: ['fish', 'fish', 'bread', 'fish', 'bread']}, {x: 1.12, coat: 'green', goods: ['apple', 'apple', 'apple', 'apple', 'apple']}];
  for (const st of stalls) {
    st.goods.forEach((g, k) => { const gx = st.x - .34 + k * (.68 / Math.max(1, st.goods.length - 1)), c = g === 'milk' ? 'white' : g === 'bread' ? 'crust' : g === 'fish' ? '#8fb8d0' : 'red';
      if (g === 'milk') b.cyl(.07, .08, .2, c, {x: gx, y: .49, z: .1, seg: 8}); else if (g === 'fish') { b.sph(.07, c, {x: gx, y: .52, z: .1, sx: 1.9, sy: .7, seg: 8}); b.cone(.05, .1, c, {x: gx + .15, y: .52, z: .1, rz: -Math.PI / 2, seg: 6}); } else if (g === 'bread') b.sph(.09, c, {x: gx, y: .56, z: .1, sx: 1.3, sy: .7, seg: 8}); else b.sph(.06, c, {x: gx, y: .54, z: .12, seg: 8}); });
  }
  for (let i = 0; i < 11; i++) { const t = i / 10; b.sph(.05, ['red', 'yellow', 'sky', 'pink', 'green'][i % 5], {x: -1.75 + t * 3.5, y: 1.35 - Math.sin(t * Math.PI) * -.08 - .1, z: .62, seg: 6}); }
  b.pop(); const m = b.mesh(material); m.castShadow = true; m.visible = false; return m;
}

// A fishing rod for the fishermen: held out over the water, a thin line down to a red float. Hidden until they stand on the pier.
export function buildRod() {
  // A proper fishing rod: a pole from the hand out over the water, a long line down to a red float, a ring of ripples round it and a little bucket of fish.
  const g = new THREE.Group(), mat = c => new THREE.MeshBasicMaterial({color: c}), Y = new THREE.Vector3(0, 1, 0);
  const seg = (a, b, r, c) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 5), mat(c)); m.position.copy(A).add(B).multiplyScalar(.5); m.quaternion.setFromUnitVectors(Y, d.normalize()); return m; };
  const tip = [0, .66, .62], hand = [0, .26, .12], bobAt = [0, -.34, .86];
  const pole = seg(hand, tip, .02, '#8a5a3c'), line = seg(tip, bobAt, .006, '#ffffff'), bob = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), mat('#e2473b'));
  bob.position.set(...bobAt); const ring = new THREE.Mesh(new THREE.RingGeometry(.05, .065, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: .8, depthWrite: false})); ring.position.set(bobAt[0], bobAt[1] + .02, bobAt[2]);
  const bucket = new THREE.Group(); bucket.position.set(.22, -.0, .02); bucket.add(new THREE.Mesh(new THREE.CylinderGeometry(.055, .045, .09, 10), mat('#7c8a96')), (() => { const f = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), mat('#7fb5d6')); f.position.set(0, .06, 0); return f; })());
  g.add(pole, line, bob, ring, bucket); g.visible = false; g.userData = {bob, line, ring, bobAt, tipAt: tip}; return g;
}

// All the umbrellas in one instanced mesh (white canopies tinted per instance), so a rainy crowd costs one draw call, not one each.
export function buildUmbrellas(max = 40) {
  const b = new Bag(); b.dome(.25, '#ffffff', {y: .62, z: -.03, sy: .5, seg: 14}); b.torus(.25, .012, '#ffffff', {y: .62, z: -.03, rx: Math.PI / 2}); b.cyl(.012, .012, .42, '#ffffff', {y: .3, z: -.03, seg: 6});
  const g = mergeGeometries(b.parts, false), mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({vertexColors: true}), max), m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = true;
  mesh.userData.set = (i, x, y, z, ry, colour) => { mesh.setMatrixAt(i, m.compose(v.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), sc)); mesh.setColorAt(i, c.set(PALETTE_PICK(colour))); };
  mesh.userData.show = n => { mesh.count = Math.min(max, n); mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  return mesh;
}
const PALETTE_PICK = c => P[c] || c;

// Flames over a burning building: tapering cones that flicker (instanced, tinted orange and yellow), shown only during a fire.
export function buildFlames(n = 14) {
  const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(.17, .55, 7).translate(0, .27, 0), new THREE.MeshBasicMaterial({color: '#ffffff', fog: false}), n), m = new THREE.Matrix4(), c = new THREE.Color();
  mesh.frustumCulled = false; mesh.visible = false; mesh.userData.n = n;
  mesh.userData.set = (def, y0, time) => { for (let i = 0; i < n; i++) { const a = i / n * TAU + (i % 3), r = (def.w || 1.6) * .32 * (.3 + (i % 4) * .22), f = .7 + .5 * Math.abs(Math.sin(time * 7 + i * 1.9)) + .25 * Math.sin(time * 13 + i); m.compose(new THREE.Vector3(def.x + Math.cos(a) * r, y0 + (i % 3) * .12, def.z + Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, Math.sin(time * 5 + i) * .12)), new THREE.Vector3(f, f * (.8 + (i % 3) * .25), f)); mesh.setMatrixAt(i, m); mesh.setColorAt(i, c.set(i % 3 === 0 ? '#ffd84a' : i % 3 === 1 ? '#ff9a2e' : '#ff6a2e')); } mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  return mesh;
}
// Fallen branches at some doorsteps after a storm: a few brown logs each.
export function buildDebris(max = 8) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .06, .08), new THREE.MeshLambertMaterial({color: '#7a5230'}), max * 3), m = new THREE.Matrix4(); mesh.count = 0; mesh.frustumCulled = false;
  mesh.userData.show = spots => { let k = 0; for (const p of spots) for (let j = 0; j < 3 && k < max * 3; j++) { m.compose(new THREE.Vector3(p.x + (j - 1) * .14, heightAt(p.x, p.z) + .05 + j * .035, p.z + (j % 2 ? .06 : -.05)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, .6 + j * 1.1, 0)), new THREE.Vector3(1, 1, 1)); mesh.setMatrixAt(k++, m); } mesh.count = k; mesh.instanceMatrix.needsUpdate = true; };
  return mesh;
}

// Open spots on the lawns (clear of roads, rails, buildings, the pond, the paddock and the pier), the same way the grass tufts are placed.
function findSpots(graph, count, maxR, salt) {
  const roads = roadGrid(graph), loopGrid = pointGrid(graph.loop.pts), out = [];
  for (let k = 0; out.length < count && k < 4000; k++) {
    const x = (rand(k * 7 + salt) - .5) * 2 * maxR, z = (rand(k * 7 + salt + 1) - .5) * 2 * maxR * .8;
    if (shore(x, z) > .8 || roads.near(x, z, 1.8) < 1.5 || loopGrid.near(x, z, 2.2) < 2 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 1.2 || (x > PADDOCK.x0 - 1 && x < PADDOCK.x1 + 1 && z > PADDOCK.z0 - 1 && z < PADDOCK.z1 + 1) || (x > PIER.x0 - 2 && Math.abs(z - PIER.z) < 2)) continue;
    if (inGarden(x, z, .6) || BUILDINGS.some(b => Math.hypot(b.x - x, b.z - z) < b.w * .5 + 1.1) || out.some(p => Math.hypot(p.x - x, p.z - z) < 1.4)) continue;
    out.push({x, z});
  }
  return out;
}
// What each season adds to the map: ice on the pond (winter), a flooded meadow (spring), leaf piles (autumn), beach umbrellas by the harbour (summer).
export function buildSeasonDecor(season, graph, material) {
  const g = new THREE.Group(), b = new Bag();
  if (season === 'winter') { const ice = new THREE.Mesh(new THREE.CircleGeometry(POND.r * 1.02, 28).rotateX(-Math.PI / 2).scale(1.25, 1, 1), new THREE.MeshLambertMaterial({color: '#e3f5ff', transparent: true, opacity: .93})); ice.position.set(POND.x, heightAt(POND.x, POND.z) + .095, POND.z); ice.renderOrder = 1; g.add(ice); }
  if (season === 'spring') { const sp = findSpots(graph, 1, 12, 91)[0] || {x: -8, z: 7}, f = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2).scale(1.4, 1, 1), new THREE.MeshLambertMaterial({color: '#6fc6ea', transparent: true, opacity: .7})); f.position.set(sp.x, heightAt(sp.x, sp.z) + .035, sp.z); f.renderOrder = 1; g.add(f); g.userData.flood = sp; }
  if (season === 'autumn') for (const p of findSpots(graph, 8, 11, 33)) { const y = heightAt(p.x, p.z); b.push(p.x, y, p.z, rand(p.x * 9) * TAU); b.sph(.34, '#d9822b', {y: .08, sy: .45, seg: 9}); b.sph(.26, '#e8b83a', {x: .12, y: .12, z: .06, sy: .5, seg: 8}); b.sph(.2, '#b5551f', {x: -.14, y: .1, z: -.05, sy: .5, seg: 8}); b.pop(); }
  if (season === 'summer') { const hut = BUILDINGS.find(x => x.id === 'hut'); if (hut) for (let i = 0; i < 3; i++) { const x = hut.x - .6 + i * .9, z = hut.z + 1.9 + (i % 2) * .5, y = heightAt(x, z); if (shore(x, z) > .97) continue; b.push(x, y, z, 0); b.cyl(.015, .015, .75, 'white', {seg: 6}); b.cone(.38, .22, ['red', 'blue', 'yellow'][i], {y: .62, seg: 12}); b.box(.4, .02, .22, ['pink', 'sky', 'orange'][i], {x: .45, z: .1, y: .0, ry: .3}); b.pop(); } }
  if (b.parts.length) { const m = b.mesh(material); m.castShadow = true; g.add(m); }
  return g;
}

// What the town has voted for: a fountain or flower beds on a lawn near the centre, lights along the pier or a bench by the harbour.
export function buildTownEffects(effects, graph, material) {
  const g = new THREE.Group(), b = new Bag();
  if (effects.green) { const p = findSpots(graph, 1, 8, 57)[0] || {x: -3, z: 7}, y = heightAt(p.x, p.z);
    if (effects.green === 'fountain') { b.push(p.x, y, p.z, 0); b.cyl(.62, .68, .16, 'stone', {seg: 20}); b.cyl(.5, .5, .06, '#6fcdea', {y: .14, seg: 20}); b.cyl(.09, .12, .5, 'stone', {y: .14, seg: 10}); b.cyl(.3, .08, .06, 'stone', {y: .6, seg: 14}); b.sph(.09, '#cfeeff', {y: .8, seg: 8}); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; b.sph(.035, '#cfeeff', {x: Math.cos(a) * .24, y: .5, z: Math.sin(a) * .24, seg: 6}); } b.pop(); }
    else for (let k = 0; k < 14; k++) { const a = k * 2.4, r = .15 + (k % 5) * .17; b.sph(.09, ['red', 'yellow', 'pink', 'white', 'purple', 'orange'][k % 6], {x: p.x + Math.cos(a) * r, y: heightAt(p.x, p.z) + .1 + (k % 3) * .03, z: p.z + Math.sin(a) * r * .8, seg: 7}); b.cyl(.015, .015, .12, 'leaf', {x: p.x + Math.cos(a) * r, y: heightAt(p.x, p.z), z: p.z + Math.sin(a) * r * .8, seg: 4}); } }
  if (effects.harbour === 'bench') { const x = PIER.x0 - .7, z = PIER.z + 1.0, y = heightAt(x, z); b.push(x, y, z, Math.PI / 2); b.box(.7, .06, .24, 'wood', {y: .26, r: .02}); b.box(.7, .26, .05, 'wood', {y: .3, z: -.1, r: .02}); for (const sx of [-.28, .28]) b.box(.05, .26, .2, 'slate', {x: sx, r: .01}); b.pop(); }
  if (b.parts.length) { const m = b.mesh(material); m.castShadow = true; g.add(m); }
  if (effects.harbour === 'lights') { const n = 14, mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({color: '#ffe08a', fog: false}), n * 2), m = new THREE.Matrix4(); let k = 0; for (let i = 0; i < n; i++) for (const dz of [-.28, .28]) { const x = PIER.x0 + (i + .5) * (PIER.x1 - PIER.x0) / n, y = .22 + .27 + Math.sin(i * .9) * .03; m.makeTranslation(x, y, PIER.z + dz); mesh.setMatrixAt(k++, m); } mesh.frustumCulled = false; g.add(mesh); }
  return g;
}
