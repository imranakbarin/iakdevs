// Toy Town Magic Pass: restrained signs of life, not another layer of noisy widgets.
// Decorative only: no new simulation state, click targets, overlapping vehicles or timers.
import * as THREE from 'three';
import {Bag} from './build.mjs';
import {BUILDINGS, PIER, heightAt, shore} from './def.mjs';

const TAU = Math.PI * 2;
const BLOOMS = {
  spring: ['#f3b5c0', '#faf0df', '#e8bb68'],
  summer: ['#e8ad99', '#f4dd8a', '#f7e9d5'],
  autumn: ['#d79a69', '#e9bd75', '#f3dfb3'],
  winter: ['#d7e4dc', '#a7bfa7', '#e8efe8']
};
const nearAnother = (b, x, z) => BUILDINGS.some(other => other !== b && Math.hypot(other.x - x, other.z - z) < other.w * .5 + .32);

// Tiny terracotta planters make cottage entrances legible, and don't obstruct the street or the doors.
function plant(bag, x, z, blooms, seed, season) {
  bag.push(x, heightAt(x, z) + .025, z);
  bag.cyl(.075, .09, .14, '#bc8068', {y: .01, seg: 10});
  bag.cyl(.092, .092, .018, '#dfaa85', {y: .13, seg: 10});
  bag.sph(.088, '#568c62', {y: .17, sy: .57, seg: 8});
  for (let k = 0; k < 3; k++) {
    const a = seed * 1.9 + k * TAU / 3, px = Math.cos(a) * .06, pz = Math.sin(a) * .06;
    bag.cyl(.009, .011, .14, '#668e62', {x: px, y: .16, z: pz, seg: 5});
    bag.sph(.032, season === 'winter' ? '#aab9aa' : blooms[(seed + k) % blooms.length], {x: px, y: .28 + (k % 2) * .025, z: pz, seg: 7});
  }
  bag.pop();
}

// The café now has a little place for a conversation, rather than an unoccupied shopfront.
export const CAFE_SEATS = [];   // where a resident can sit: one bench either side of each table, facing it (read by actors.mjs)
function cafeTable(bag, x, z, facing, blooms) {
  for (const side of [-1, 1]) { const lx = side * .47; CAFE_SEATS.push({x: x + lx * Math.cos(facing), z: z - lx * Math.sin(facing), yaw: Math.atan2(-side * Math.cos(facing), side * Math.sin(facing)), table: [x, z]}); }
  bag.push(x, heightAt(x, z) + .02, z, facing);
  bag.cyl(.022, .022, .3, '#8b755f', {y: .025, seg: 7});
  bag.cyl(.25, .25, .035, '#f0dfbd', {y: .32, seg: 18});
  bag.cyl(.036, .032, .055, '#f8f1df', {x: -.05, y: .355, z: .03, seg: 9});
  bag.sph(.023, blooms[0], {x: .11, y: .375, z: -.025, seg: 8});
  for (const side of [-1, 1]) {
    bag.box(.2, .045, .19, '#ae8462', {x: side * .47, y: .16, r: .02});
    bag.box(.045, .24, .16, '#c09b75', {x: side * .61, y: .16, r: .02});
    for (const dz of [-.07, .07]) bag.box(.023, .16, .023, '#8f7059', {x: side * .48, y: .03, z: dz});
  }
  bag.pop();
}

function makeShadows() {
  // A soft oval under each building visually anchors it to the land without a new light pass.
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return new THREE.Group();
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
  grad.addColorStop(0, 'rgba(30,48,39,.22)');
  grad.addColorStop(.6, 'rgba(30,48,39,.12)');
  grad.addColorStop(1, 'rgba(30,48,39,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false});
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, BUILDINGS.length);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  BUILDINGS.forEach((b, i) => {
    q.setFromAxisAngle(up, b.ry);
    p.set(b.x, heightAt(b.x, b.z) + .056, b.z);
    s.set(b.w * 1.5, 1, Math.max(.58, b.w * .85));
    m.compose(p, q, s); mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false; mesh.renderOrder = 1;
  return mesh;
}

export function buildTownCharm(material, season = 'summer', lite = false) {
  CAFE_SEATS.length = 0;
  const root = new THREE.Group();
  if (lite) return root;
  const bag = new Bag(), blooms = BLOOMS[season] || BLOOMS.summer;
  for (let i = 0; i < BUILDINGS.length; i++) {
    const h = BUILDINGS[i];
    // The taller landmarks already have extensive decoration. Keep footpaths clear.
    if (!h.door || (i % 3 !== 0 && !['bakery', 'cafe', 'post', 'toys'].includes(h.id))) continue;
    for (const side of [-1, 1]) {
      const x = h.x + Math.sin(h.ry) * (h.door + .02) + Math.cos(h.ry) * side * Math.max(.29, Math.min(.47, h.w * .3));
      const z = h.z + Math.cos(h.ry) * (h.door + .02) - Math.sin(h.ry) * side * Math.max(.29, Math.min(.47, h.w * .3));
      if (shore(x, z) > .88 || nearAnother(h, x, z)) continue;
      plant(bag, x, z, blooms, i * 3 + side + 3, season);
    }
  }
  const cafe = BUILDINGS.find(b => b.id === 'cafe');
  if (cafe) {
    for (const side of [-1, 1]) {
      const x = cafe.x + Math.sin(cafe.ry) * (cafe.door + .76) + Math.cos(cafe.ry) * side * .82;
      const z = cafe.z + Math.cos(cafe.ry) * (cafe.door + .76) - Math.sin(cafe.ry) * side * .82;
      if (shore(x, z) < .88 && !nearAnother(cafe, x, z)) cafeTable(bag, x, z, cafe.ry, blooms);
    }
  }
  // A few purposeful fishing supplies at the jetty, placed on the actual deck.
  const x = PIER.x1 - .38, z = PIER.z, y = .23;
  bag.push(x, y, z);
  bag.box(.23, .13, .18, '#ac8464', {z: .12, r: .018});
  bag.box(.18, .09, .16, '#d2b28c', {x: -.28, z: -.13, r: .018});
  bag.cyl(.09, .09, .12, '#9a7659', {x: -.1, z: -.15, seg: 10});
  bag.torus(.105, .017, '#d7c6a2', {x: -.1, y: .16, z: -.15, rx: Math.PI / 2});
  bag.pop();
  const detail = bag.mesh(material);
  detail.receiveShadow = true; detail.castShadow = false;
  root.add(detail, makeShadows());
  return root;
}
