// New Toy Town: a tiny skeletal rig for people and animals. A figure is still ONE merged mesh (one draw call); every vertex carries a bone index and a vertex shader skins it
// rigidly with up to MAXB bone matrices. Bones are rotated about a pivot given in the mesh's own (rest) coordinates, and a child bone follows its parent, so an upper arm,
// forearm and hand (or a horse's neck, head and ear) really chain. All angles are raw three.js Euler angles (order YXZ), in radians. Conventions used by pose.mjs:
//   +x is the figure's LEFT (it faces +z). A positive rx on a limb that hangs down swings its far end BACKWARDS (-z); on a neck or head a positive rx nods DOWN.
import * as THREE from 'three';

export const MAXB = 24;

// Run `fn` (which adds pieces to the bag) and give every piece it added (that has no bone yet) this bone index. Inner calls win, so a hand can be tagged inside an arm.
export function boneTag(b, index, fn) {
  const from = b.parts.length; fn();
  for (let k = from; k < b.parts.length; k++) {
    const g = b.parts[k]; if (g.attributes.bone) continue;
    g.setAttribute('bone', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(index), 1));
  }
}

const GLSL_ATTR = 'attribute float bone; uniform mat4 uBones[' + MAXB + '];';
export function rigMaterial(bones) {
  const m = new THREE.MeshLambertMaterial({vertexColors: true});
  m.onBeforeCompile = sh => {
    sh.uniforms.uBones = {value: bones};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL_ATTR)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = mat3(uBones[int(bone + .5)]) * objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (uBones[int(bone + .5)] * vec4(transformed, 1.)).xyz;');
  };
  m.customProgramCacheKey = () => 'toyrig1';
  return m;
}
function depthMaterial(bones) {
  const m = new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking});
  m.onBeforeCompile = sh => {
    sh.uniforms.uBones = {value: bones};
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + GLSL_ATTR).replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = (uBones[int(bone + .5)] * vec4(transformed, 1.)).xyz;');
  };
  m.customProgramCacheKey = () => 'toyrigd1';
  return m;
}

const _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _l = new THREE.Matrix4(), _p = new THREE.Matrix4();
export class Rig {
  // names: bone names (a parent always comes before its children); parents: parent name or null for each
  constructor(names, parents) {
    this.names = names; this.n = names.length; this.index = {}; names.forEach((nm, i) => { this.index[nm] = i; });
    this.parent = parents.map(p => p == null ? -1 : this.index[p]);
    this.pivot = names.map(() => [0, 0, 0]); this.rot = names.map(() => [0, 0, 0]); this.pos = names.map(() => [0, 0, 0]);
    this.mats = Array.from({length: MAXB}, () => new THREE.Matrix4()); this.world = names.map(() => new THREE.Matrix4());
  }
  at(name, x, y, z) { this.pivot[this.index[name]] = [x, y, z]; return this; }
  set(name, x = 0, y = 0, z = 0) { const r = this.rot[this.index[name]]; r[0] = x; r[1] = y; r[2] = z; return this; }
  move(name, x = 0, y = 0, z = 0) { const r = this.pos[this.index[name]]; r[0] = x; r[1] = y; r[2] = z; return this; }
  reset() { for (const r of this.rot) r[0] = r[1] = r[2] = 0; for (const r of this.pos) r[0] = r[1] = r[2] = 0; return this; }
  // matrices for the shader: parent * T(pivot + pos) * R * T(-pivot)
  update() {
    for (let i = 0; i < this.n; i++) {
      const pv = this.pivot[i], ps = this.pos[i], r = this.rot[i];
      _t.makeTranslation(pv[0] + ps[0], pv[1] + ps[1], pv[2] + ps[2]); _r.makeRotationFromEuler(_e.set(r[0], r[1], r[2], 'YXZ')); _l.makeTranslation(-pv[0], -pv[1], -pv[2]);
      const m = this.world[i].copy(_t).multiply(_r).multiply(_l); if (this.parent[i] >= 0) m.premultiply(this.world[this.parent[i]]);
      this.mats[i].copy(m);
    }
    return this;
  }
  // a point given in rest coordinates on a bone, as it is now (mesh coordinates): where a hand really is, for carried things
  point(name, x, y, z, out = new THREE.Vector3()) { return out.set(x, y, z).applyMatrix4(this.world[this.index[name]]); }
}

// The mesh for a bag whose parts are bone-tagged (untagged parts are bone 0 and follow the root bone).
export function rigMesh(b, rig, {shadow = true} = {}) {
  for (const p of b.parts) if (!p.attributes.bone) p.setAttribute('bone', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count), 1));
  const m = b.mesh(rigMaterial(rig.mats)); m.castShadow = shadow; if (shadow) m.customDepthMaterial = depthMaterial(rig.mats); m.frustumCulled = false; rig.update();
  return m;
}
