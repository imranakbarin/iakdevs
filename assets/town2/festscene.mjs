// New Toy Town: the Lantern Festival in the scene (see festival.mjs): paper lanterns along the shore by the harbour, lantern boats drifting out from the pier,
// and fireworks over the sea. Everything is a glowing instanced mesh, off unless it is Saturday evening.
import * as THREE from 'three';
import {PIER, ISLAND, heightAt} from './def.mjs';
import {festivalAt, FEST, BOATS, lanternBoat, firework, SPARKS, burstIndex, BURSTS} from './festival.mjs';

const WARM = ['#ff8a5c', '#ffd23f', '#ff9ad2', '#ffb347'];
export function createFestival({scene}) {
  const mat = () => new THREE.MeshBasicMaterial({color: '#ffffff', fog: false}), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  // lanterns strung along the beach and the pier approach
  // a row of paper lanterns on low stakes along the sand, either side of the pier
  const SHORE = []; for (let i = 0; i < 26; i++) { const a = (-.33 + i / 25 * .66) * 1, ang = a, r = .93; const x = Math.cos(ang) * ISLAND.rx * r, z = Math.sin(ang) * ISLAND.rz * r + 2.3; if (Math.abs(z - PIER.z) < 1.4) continue; SHORE.push([x, z, .55 + (i % 3) * .06]); }
  const lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(.085, 8, 6).scale(1, 1.25, 1), mat(), SHORE.length), stakes = new THREE.InstancedMesh(new THREE.CylinderGeometry(.012, .012, .55, 5), new THREE.MeshBasicMaterial({color: '#6b5a4a'}), SHORE.length); lanterns.frustumCulled = false; stakes.frustumCulled = false;
  SHORE.forEach(([x, z, y], i) => { const gy = heightAt(x, z); lanterns.setMatrixAt(i, m4.compose(p.set(x, gy + y, z), q, sc.set(1, 1, 1))); stakes.setMatrixAt(i, m4.compose(p.set(x, gy + y / 2, z), q, sc.set(1, y / .55, 1))); lanterns.setColorAt(i, c.set(WARM[i % 4])); }); lanterns.visible = stakes.visible = false; scene.add(lanterns, stakes);
  const boats = new THREE.InstancedMesh(new THREE.CylinderGeometry(.075, .07, .09, 10), mat(), BOATS); boats.frustumCulled = false; for (let i = 0; i < BOATS; i++) boats.setColorAt(i, c.set(WARM[i % 4])); boats.visible = false; scene.add(boats);
  const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mat(), SPARKS + 1); sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
  let bang = -1;
  function update(dt, time, ctx) {
    const f = festivalAt(ctx.weekday, ctx.hour);
    lanterns.visible = stakes.visible = !!f; boats.visible = !!f && f.phase !== 'gather'; sparks.visible = !!f && f.phase === 'fireworks';
    if (!f) { bang = -1; return; }
    
    if (boats.visible) { const secs = (ctx.hour - FEST.boats) * 20; for (let i = 0; i < BOATS; i++) { const b = lanternBoat(i, secs), s = Math.max(.001, b.alpha); boats.setMatrixAt(i, m4.compose(p.set(b.x, ISLAND.sea + .06 + Math.sin(time * 1.6 + i) * .012, b.z), q, sc.set(s, s, s))); } boats.instanceMatrix.needsUpdate = true; }
    if (sparks.visible) {
      const secs = (ctx.hour - FEST.fireworks) * 20, k = Math.min(BURSTS - 1, Math.max(0, burstIndex(secs))), fw = firework(secs, k); let n = 0;
      for (const s of fw.sparks) { sparks.setMatrixAt(n, m4.compose(p.set(s.x, s.y, s.z), q, sc.set(s.s, s.s, s.s))); sparks.setColorAt(n, c.set(s.c)); n++; }
      for (; n < SPARKS + 1; n++) sparks.setMatrixAt(n, m4.compose(p.set(0, -50, 0), q, sc.set(.001, .001, .001)));
      sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true; bang = secs >= 0 ? burstIndex(secs) : -1;
    } else bang = -1;
  }
  return {update, bang: () => bang, active: ctx => !!festivalAt(ctx.weekday, ctx.hour), lanterns, boats, sparks};
}
