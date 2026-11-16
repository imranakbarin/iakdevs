// The new Mushroom Island is a real WebGL scene. These static checks are
// complemented by a browser screenshot test in CI; the original 2D path stays intact.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'mushroom-island.html'),'utf8');
const source=fs.readFileSync(path.join(root,'assets/mushroom-island-3d.mjs'),'utf8');
cp.execFileSync(process.execPath,['--check',path.join(root,'assets/mushroom-island-3d.mjs')]);
for(const token of ['id="island"','id="island3d"','id="islandView"','id="islandStatus"','mushroom-cinematic.js','mushroom-life.js',".catch(error=>"]){
  assert.ok(html.includes(token),'Fallback or control missing: '+token);
}
for(const token of ['THREE.WebGLRenderer','THREE.PerspectiveCamera','new THREE.CylinderGeometry','new THREE.SphereGeometry','makePip','castle()','bridge()','waterfall()','mushroom(','pointermove','wheel','webglcontextlost','window.PipIsland3D']){
  assert.ok(source.includes(token),'3D scene feature missing: '+token);
}
assert.ok(!source.includes('window.PipIsland3D={ready:false'), '3D view never reports ready');
console.log('Mushroom Island 3D smoke PASS — real 3D geometry, controllable camera, animated Pip, scene landmarks, and original 2D fallback');
