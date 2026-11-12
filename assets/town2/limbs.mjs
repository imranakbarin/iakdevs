// New Toy Town: limbs that move. A person or an animal is still ONE merged mesh (one draw call); its legs, arms, head and tail carry a per-vertex pivot and a kind, and a
// little vertex shader swings them about the pivot from the walker's gait (see gait.mjs). Kinds: 1 swing about the hip or shoulder, 3 head (nods, bobs), 4 tail (wags),
// 6 head thrust (a hen's head bobs forward and back), 7 wheel (spins about its axle).
import * as THREE from 'three';

// Run `fn` (which adds pieces to the bag) and mark everything it added as one limb: pivot [x,y,z] in the mesh's own coordinates, kind, phase offset, amplitude, lift.
export function limb(b, kind, pivot, off, amp, lift, fn) {
  const from = b.parts.length; fn();
  for (let k = from; k < b.parts.length; k++) {
    const g = b.parts[k], n = g.attributes.position.count, l = new Float32Array(n * 4), m = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { l.set([pivot[0], pivot[1], pivot[2], kind], i * 4); m.set([off, amp, lift], i * 3); }
    g.setAttribute('limb', new THREE.BufferAttribute(l, 4)); g.setAttribute('motion', new THREE.BufferAttribute(m, 3));
  }
}
// The mesh for a bag with limbs: the parts that are not limbs stand still (kind 0). Each walker gets its own material (its own gait uniform) but all share one program.
export function limbMesh(b, material) {
  for (const p of b.parts) if (!p.attributes.limb) { const n = p.attributes.position.count; p.setAttribute('limb', new THREE.BufferAttribute(new Float32Array(n * 4), 4)); p.setAttribute('motion', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); }
  return b.mesh(material);
}
const GLSL_COMMON = `attribute vec4 limb; attribute vec3 motion; uniform vec4 uGait;
float limbAngle() { float t = limb.w; if (t < .5) return 0.; float w = uGait.y, ph = uGait.x + motion.x;
  if (t < 1.5) return sin(ph) * motion.y * w;
  if (t < 3.5) return uGait.z * motion.y + sin(2. * uGait.x + motion.x) * motion.y * .3 * w;
  if (t < 4.5) return sin(uGait.w + motion.x) * motion.y * (.3 + .7 * w);
  if (t > 6.5) return uGait.x * motion.y;
  return 0.; }
vec3 limbShift() { float t = limb.w; if (t < .5) return vec3(0.); float w = uGait.y, ph = uGait.x + motion.x;
  if (t < 1.5) return vec3(0., max(0., -cos(ph)) * motion.z * w, 0.);
  if (t > 5.5 && t < 6.5) return vec3(0., 0., sin(ph) * motion.y * w);
  return vec3(0.); }
vec3 limbRot(vec3 v, float a) { float c = cos(a), s = sin(a); return limb.w > 3.5 && limb.w < 4.5 ? vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z) : vec3(v.x, c * v.y - s * v.z, s * v.y + c * v.z); }`;
export function limbMaterial() {
  const m = new THREE.MeshLambertMaterial({vertexColors: true}); m.userData.gait = {value: new THREE.Vector4(0, 0, 0, 0)};
  m.onBeforeCompile = sh => {
    sh.uniforms.uGait = m.userData.gait;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL_COMMON)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nif (limb.w > .5 && limb.w < 5.5 || limb.w > 6.5) objectNormal = limbRot(objectNormal, limbAngle());')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (limb.w > .5) { vec3 q = limbRot(transformed - limb.xyz, limbAngle()); transformed = limb.xyz + q + limbShift(); }');
  };
  m.customProgramCacheKey = () => 'toylimb1'; return m;
}
// Write a walker's gait (from gait.mjs) into its mesh's material. `pitch` nods the head down (a hen pecking, a horse grazing).
export function setGait(mesh, g, pitch = 0) { const u = mesh.material.userData.gait.value; u.set(g.phase, g.amp, pitch, g.wag); }
