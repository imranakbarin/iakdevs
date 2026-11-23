/* Pip's Mushroom Island — an original, explorable THREE.js miniature.
 * Independent of the existing illustrated canvas. If WebGL/CDN is unavailable,
 * mushroom-island.html keeps the original 2D animation intact.
 * No physics or Pip Run logic is modified by this renderer.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';

const canvas = document.getElementById('island3d');
const oldCanvas = document.getElementById('island');
const toggle = document.getElementById('islandView');
const hint = document.getElementById('islandHint');
const status = document.getElementById('islandStatus');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const isPhone = () => Math.min(innerWidth, innerHeight) < 700;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias: !isPhone(), alpha: false, powerPreference: 'default'});
} catch (error) {
  throw new Error('Mushroom Island 3D requires WebGL; the original 2D world remains available: ' + error.message);
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
renderer.shadowMap.enabled = !isPhone();
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c3e2e2');
scene.fog = new THREE.Fog('#c3e2e2', 34, 75);
const camera = new THREE.PerspectiveCamera(38, 1, .12, 150);
const ambient = new THREE.HemisphereLight('#fff2da', '#75908a', 2.0);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff0d3', 2.8);
sun.position.set(-11, 21, 13); sun.castShadow = !isPhone();
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {left:-13,right:13,top:13,bottom:-13,near:1,far:48});
sun.shadow.bias=-.0005; sun.shadow.normalBias=.035;
scene.add(sun);

const colors = {
  grass:'#93ba86', grassEdge:'#6e9679', soil:'#ac8875', rock:'#807c84',
  sea:'#81bfc4', path:'#e9d8bc', trunk:'#94735e', leaf:'#638e78',
  cream:'#f4e4cf', mint:'#71b3a4', flower:'#d987a7',
  cocoa:'#584c62', lavender:'#9988bf', gold:'#f2d096'
};
const material=(color,roughness=.86)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0});
const mat=Object.fromEntries(Object.entries(colors).map(([k,v])=>[k,material(v)]));
const waterMat=new THREE.MeshStandardMaterial({color:'#88d8df',transparent:true,opacity:.67,roughness:.34,metalness:.08,depthWrite:false,side:THREE.DoubleSide});
const sphere=new THREE.SphereGeometry(1,16,12);
const box=new THREE.BoxGeometry(1,1,1);
const cylinder=new THREE.CylinderGeometry(1,1,1,16);
const cone=new THREE.ConeGeometry(1,1,16);
const root=new THREE.Group();scene.add(root);
let meshes=0;
function add(g,geometry,m,x=0,y=0,z=0,sx=1,sy=1,sz=1) {
  const o=new THREE.Mesh(geometry,m);
  o.position.set(x,y,z);o.scale.set(sx,sy,sz);
  o.castShadow=true;o.receiveShadow=true;g.add(o);meshes++;
  return o;
}
const ball=(g,m,x,y,z,sx,sy=sx,sz=sx)=>add(g,sphere,m,x,y,z,sx,sy,sz);
const block=(g,m,x,y,z,sx,sy,sz)=>add(g,box,m,x,y,z,sx,sy,sz);
const column=(g,m,x,y,z,r,height,rTop=r)=>add(g,new THREE.CylinderGeometry(rTop,r,height,12),m,x,y,z);
const cap=(g,m,x,y,z,r,h)=>add(g,new THREE.ConeGeometry(r,h,18),m,x,y,z);
function groupAt(x,y,z){const g=new THREE.Group();g.position.set(x,y,z);root.add(g);return g;}
function hash(n){let v=Math.imul((n|0)^0x9e3779b9,0x85ebca6b);v^=v>>>13;return (Math.imul(v,0xc2b2ae35)>>>0)/4294967295;}
function label(g,title,desc){g.userData.poi={title,desc};}
function ground(x,z){return .15+ .03*Math.sin(x*.62)*Math.cos(z*.7);}
function onGround(x,z){return ground(x,z);}
function makeIsland(){
  // A real layered 3D cliff with a roughly elliptical coast, not a flat backdrop.
  const cliff=new THREE.CylinderGeometry(9,7.8,2,96,1);
  const pos=cliff.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),a=Math.atan2(z,x);
    const edge=1+.028*Math.sin(a*7)+.018*Math.sin(a*13+1.3);
    pos.setXYZ(i,x*edge,pos.getY(i),z*edge*.72);
  }
  cliff.computeVertexNormals();
  const m=add(root,cliff,[mat.rock,mat.grass,mat.soil],0,-.87,0);
  m.castShadow=true;
  // A thin grassy bevel sits inside the cliff rim; avoid a separately floating terrain sheet.
  const disk=add(root,new THREE.CircleGeometry(8.94,96),mat.grass,0,.147,0,1,.719,1);
  disk.rotation.x=-Math.PI/2;disk.castShadow=false;
  disk.material=paintedGrass();
  const sea=add(scene,new THREE.PlaneGeometry(170,170),material('#87c9d2',.32),0,-1.94,0);
  sea.rotation.x=-Math.PI/2;sea.castShadow=false;sea.receiveShadow=false;
  const foam=add(root,new THREE.TorusGeometry(9.01,.048,6,96),waterMat,0,-1.79,0);
  foam.rotation.x=Math.PI/2;foam.scale.y=.72;foam.castShadow=false;
  return sea;
}
const sea=makeIsland();

// A clearly defined walking circuit makes Pip's motion understandable from any angle.
const circuit=new THREE.Group();root.add(circuit);
function pathArc(){
  const pts=[];for(let i=0;i<=120;i++){const a=i/120*Math.PI*2;const x=7.15*Math.cos(a),z=4.2*Math.sin(a);pts.push(new THREE.Vector3(x,ground(x,z)+.037,z));}
  const path=new THREE.CatmullRomCurve3(pts,true,'centripetal');
  const mesh=add(circuit,new THREE.TubeGeometry(path,180,.27,5,true),mat.path);
  mesh.castShadow=false;mesh.receiveShadow=false;
  // Paired stones reinforce the curve without a noisy decorative border.
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2,x=7.15*Math.cos(a),z=4.2*Math.sin(a);
    const stone=block(circuit,i%3===0?mat.cream:mat.path,x,ground(x,z)+.054,z,.31,.022,.29);
    stone.rotation.y=-a;stone.castShadow=false;
  }
}
pathArc();

// Castle on its own stone terrace: one strong silhouette above the smaller village.
function castle(){
  const g=groupAt(-3.15,ground(-3.15,-1.4),-1.4);
  column(g,mat.rock,0,.12,0,2.1,.24);
  block(g,mat.cream,0,.96,0,2.85,1.58,1.75);
  const trim=material('#d8b6bb');
  block(g,trim,0,1.7,0,3.06,.15,1.94);
  for(const tx of [-1.55,1.55]){
    column(g,mat.cream,tx,1.15,.15,.49,2.25);
    cap(g,material(tx<0?'#a98ab3':'#db9caa'),tx,2.64,.15,.66,1.18);
    column(g,mat.gold,tx,2.10,.57,.12,.24);
  }
  const door=material('#76617f');
  block(g,door,0,.52,.91,.58,1.00,.09);
  ball(g,door,0,1.04,.92,.29,.29,.05);
  for(const x of [-.76,.76]){
    block(g,material('#7da9b5'),x,1.19,.9,.28,.44,.06);
    block(g,mat.cream,x,1.19,.96,.037,.46,.04);
  }
  for(let i=-3;i<=3;i++)block(g,mat.cream,i*.39,1.87,.02,.25,.33,.35);
  // A pitched shingle roof pulls the flat original façade into a storybook silhouette.
  const roof=add(g,new THREE.ConeGeometry(1.76,.84,4,1),material('#b48fa7'),0,2.26,0,1.12,1,.72);
  roof.rotation.y=Math.PI/4;
  const steps=block(g,mat.path,0,.18,1.22,1.65,.16,.78);
  steps.castShadow=false;
  label(g,'Pip Castle','The hilltop castle overlooks the island and its winding paths.');
}
castle();

// Real mushroom houses with curved caps, doors, glowing windows, and little spots.
const mushroomTints=['#e7899b','#ddab80','#b79bc9','#ea9f91'];
function mushroom(x,z,size,i){
  const g=groupAt(x,ground(x,z),z);
  const cream=mat.cream,capM=material(mushroomTints[i%4]);
  const foundation=column(g,material('#e6d6c5'),0,.055,0,.72*size,.11*size);
  foundation.castShadow=false;
  column(g,cream,0,.7*size,0,.58*size,1.4*size,.47*size);
  const dome=new THREE.SphereGeometry(1,24,16,0,Math.PI*2,0,Math.PI/2);
  add(g,dome,capM,0,1.4*size,0,1.12*size,.86*size,1.02*size);
  const edge=column(g,material('#efdfc9'),0,1.41*size,0,1.14*size,.11*size);
  edge.castShadow=false;
  // Warm under-cap gills give the roof a real rim and cast a soft shadow.
  const gills=add(g,new THREE.TorusGeometry(1.01*size,.045*size,6,36),material('#d4a5a3'),0,1.36*size,0,1,1,.91);
  gills.rotation.x=Math.PI/2;gills.castShadow=false;
  block(g,material('#73657c'),0,.53*size,.47*size,.42*size,.82*size,.10*size);
  const arch=add(g,new THREE.TorusGeometry(.218*size,.037*size,6,20,Math.PI),material('#c79b87'),0,.95*size,.528*size);
  arch.castShadow=false;
  block(g,material('#c9ad91'),0,.13*size,.80*size,.66*size,.095*size,.5*size);
  ball(g,mat.gold,.12*size,.54*size,.53*size,.038*size);
  for(const side of [-1,1]){
    ball(g,material('#f9f1d8'),side*.4*size,.92*size,.34*size,.18*size,.2*size,.08*size);
    block(g,material('#a6c6c2'),side*.4*size,.91*size,.415*size,.035*size,.31*size,.04*size);
  }
  for(let k=0;k<5;k++){
    const a=k*2.399+1,rr=(k%2?.56:.74)*size,px=Math.cos(a)*rr,pz=Math.sin(a)*rr;
    const y=1.4*size+.86*size*Math.sqrt(Math.max(.08,1-(rr/(1.12*size))**2))+.02;
    ball(g,mat.cream,px,y,pz,.11*size,.04*size,.1*size);
  }
  label(g,['Rosecap Cottage','The Teahouse','Little Library','The Baker’s Mushroom'][i%4],
    'A warm mushroom home among the flower paths.');
  return g;
}
mushroom(2.4,-2.2,1.04,0);
mushroom(4.35,-.5,.88,1);
mushroom(2.4,1.9,.94,2);
mushroom(4.52,2.45,.73,3);

// A wooded grove is a quiet cluster, not random vegetation across the whole island.
function tree(x,z,s,leaf=mat.leaf){
  const g=groupAt(x,ground(x,z),z);
  column(g,mat.trunk,0,.58*s,0,.17*s,1.14*s,.13*s);
  // Slightly varied canopy clusters keep a natural silhouette, not a single blob.
  ball(g,leaf,0,1.41*s,0,.64*s,.79*s,.62*s);
  ball(g,leaf,-.33*s,1.16*s,.12*s,.39*s,.42*s,.38*s);
  ball(g,leaf,.3*s,1.25*s,-.06*s,.37*s,.49*s,.38*s);
  return g;
}
tree(-5.6,2.3,1.1);tree(-4.6,3.75,.77);tree(-2.2,4.0,.85);
tree(.1,-3.65,.72);tree(.55,3.7,.68);
const rose=material('#b66e91'),mint=material('#83b59a'),stone=material('#b5a59b');
function flower(x,z,i){
  const g=groupAt(x,ground(x,z),z);column(g,mat.leaf,0,.18,0,.025,.34,.02);
  for(let k=0;k<5;k++){const a=2*Math.PI*k/5;ball(g,i%3?mat.cream:rose,Math.cos(a)*.12,.39,Math.sin(a)*.12,.105,.063,.105);}
  ball(g,mat.gold,0,.4,0,.085,.07,.085);
}
for(let i=0;i<22;i++){const angle=i*2.399,rad=.35+Math.sqrt(i/22)*1.75;
  flower(-.62+Math.cos(angle)*rad,1.65+Math.sin(angle)*rad,i);
}
// Bridge crosses a visible shallow winding stream and connects the two halves.
function bridge(){
  const streamPoints=[[-.3,-4],[-.7,-2.0],[-.55,.0],[-.9,1.8],[-1.7,4.5]];
  const curve=new THREE.CatmullRomCurve3(streamPoints.map(([x,z])=>new THREE.Vector3(x,.20,z)));
  const water=add(root,new THREE.TubeGeometry(curve,36,.28,8,false),waterMat);
  water.castShadow=false;
  const g=groupAt(-.67,.12,.55),wood=material('#a98170'),rail=material('#d6b899');
  for(let i=0;i<12;i++){
    const z=-1.3+i*.235,arch=.27*(1-(z/1.55)**2);
    block(g,wood,0,.22+arch,z,1.55,.12,.205);
  }
  for(const x of [-.78,.78]){
    for(const z of [-1.16,-.45,.32,1.04]) column(g,rail,x,.56,z,.055,.74);
    block(g,rail,x,1.0,0,.095,.10,2.6);
  }
  label(g,'The Willow Bridge','Cross the painted stream and discover the castle gardens.');
}
bridge();
function waterfall(){
  const g=groupAt(8.3,.09,0);
  ball(g,mat.rock,-.15,-.34,0,.74,.85,.8);
  const fall=add(g,new THREE.PlaneGeometry(.75,1.52),waterMat,.13,-.63,.47);
  fall.material.side=THREE.DoubleSide;fall.castShadow=false;
  for(let i=0;i<4;i++)ball(g,material('#dfefea'),.14+(i-2)*.17,-1.35,.55,.18,.065,.17);
  label(g,'Moonwater Falls','A tiny waterfall pours from the island into the sea.');
}
waterfall();

// Scattered low rock clusters and small lanterns mark destinations without noise.
for(let i=0;i<18;i++){
  const a=i*2.4,r=5.05+hash(i+47)*1.1,x=r*Math.cos(a),z=.71*r*Math.sin(a);
  if(x>1.6&&x<5&&z>-2.7&&z<2.8)continue;
  ball(root,i%3?stone:mat.rock,x,ground(x,z)+.12,z,.15+hash(i)*.14,.13,.17);
}
function lamp(x,z){
  const g=groupAt(x,ground(x,z),z);
  column(g,mat.trunk,0,.45,0,.055,.92);
  block(g,mat.gold,0,.97,0,.24,.28,.24);
  const glow=material('#fff1bc');glow.emissive=new THREE.Color('#ffe0a8');glow.emissiveIntensity=.3;
  ball(g,glow,0,1.01,0,.13);
}
[[-1.5,-3.2],[1.4,-3.1],[-4.0,1.4],[1.4,2.9]].forEach(([x,z])=>lamp(x,z));

// Pip is modeled in true 3D, preserving the original leaf cap, purple coat,
// mint waistcoat, little satchel, big friendly face and coral boots.
function makePip(){
  const actor=new THREE.Group();root.add(actor);
  const outfit=material('#8d7cc3'),sweater=material('#68bda9'),skin=material('#ffdfbd'),
        boot=material('#c98377'),hair=material('#604e70'),hat=material('#4ca89c'),eyes=material('#5c5169');
  const torso=new THREE.Group();actor.add(torso);
  ball(torso,outfit,0,.95,0,.3,.40,.23);
  block(torso,sweater,0,1.0,.19,.37,.48,.08);
  for(const y of [.91,1.09])ball(torso,mat.cream,-.04,y,.245,.028);
  const satchel=block(torso,material('#c59f80'),-.38,.8,-.09,.24,.32,.28);
  satchel.rotation.z=.1;
  // Head is a distinct rotating assembly; pupils and cheeks remain attached.
  const head=new THREE.Group();head.position.y=1.62;torso.add(head);
  ball(head,skin,0,0,0,.39,.36,.32);
  for(const s of [-1,1]){
    ball(head,skin,s*.35,-.07,0,.085,.15,.11);
    ball(head,eyes,s*.15,.025,.31,.047,.071,.028);
    ball(head,mat.cream,s*.165,.048,.337,.016,.022,.01);
    ball(head,material('#e99b9e'),s*.26,-.14,.26,.085,.045,.02);
  }
  ball(head,skin,0,-.09,.34,.07,.066,.07);
  const mouth=add(head,new THREE.TorusGeometry(.095,.014,5,16,Math.PI),material('#a76d7b'),0,-.15,.315);
  mouth.rotation.z=Math.PI;
  column(head,material('#e9dfc5'),0,.31,0,.51,.08);
  const crown=add(head,new THREE.SphereGeometry(.51,20,12,0,Math.PI*2,0,Math.PI/2),hat,0,.30,0,1,.9,1);
  for(const [x,z] of [[-.2,.23],[.2,-.19],[0,0]])ball(head,mat.cream,x,.7-Math.hypot(x,z)*.22,z,.08,.023,.08);
  const limbs={};
  for(const s of [-1,1]){
    const arm=new THREE.Group();arm.position.set(s*.32,1.18,0);actor.add(arm);
    ball(arm,outfit,s*.12,-.16,0,.13,.26,.13);
    ball(arm,skin,s*.15,-.38,.02,.11,.12,.11);
    const leg=new THREE.Group();leg.position.set(s*.17,.67,0);actor.add(leg);
    ball(leg,outfit,0,-.22,0,.13,.28,.13);
    ball(leg,boot,.01,-.49,.09,.18,.11,.27);
    limbs[s<0?'leftArm':'rightArm']=arm;limbs[s<0?'leftLeg':'rightLeg']=leg;
  }
  actor.userData.poi={title:'Pip',desc:'The little explorer follows the island trail. Watch the footfalls and turn the camera to meet him.'};
  const scarf=material('#e6b4a8');ball(torso,scarf,0,1.3,.07,.29,.10,.25);
  const tail=block(torso,scarf,-.18,1.12,.21,.14,.25,.06);tail.rotation.z=-.14;
  const shadow=add(actor,new THREE.CircleGeometry(.34,20),new THREE.MeshBasicMaterial({color:'#4b665b',transparent:true,opacity:.20,depthWrite:false}),0,.012,0);
  shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;shadow.receiveShadow=false;
  actor.scale.setScalar(1.19);
  return {actor,torso,head,limbs};
}

// V2 art direction: quiet but richly modeled layers, not a scattered-prop pass.
// The entire island stays one composition. Repeated objects are instanced and
// the canvas grass texture is deterministic for reproducible visual QA.
function paintedGrass(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const q=c.getContext('2d');q.fillStyle='#f8f4de';q.fillRect(0,0,512,512);
  for(let i=0;i<390;i++){
    const x=hash(i+301)*512,y=hash(i+1271)*512,r=1+hash(i+423)*5;
    q.fillStyle=i%5===0?'rgba(72,101,67,.12)':i%3===0?'rgba(230,210,151,.12)':'rgba(93,117,81,.065)';
    q.beginPath();q.ellipse(x,y,r,r*.28,hash(i+712)*6.28,0,Math.PI*2);q.fill();
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const m=mat.grass.clone();m.map=t;m.roughness=.98;return m;
}
const finishing={waves:[],leaves:[],crest:null};
function band(y0,y1,color){
  const N=96,positions=[],norm=(r,a)=>{const scallop=1+.028*Math.sin(a*7)+.018*Math.sin(a*13+1.3);
    return [r*Math.cos(a)*scallop,r*Math.sin(a)*scallop*.72];};
  for(let i=0;i<N;i++){
    const a=i/N*Math.PI*2,b=(i+1)/N*Math.PI*2;
    const ra=9-(.13-y0)*.6+.035,rb=9-(.13-y1)*.6+.035;
    const p=norm(ra,a),q=norm(ra,b),r=norm(rb,a),s=norm(rb,b);
    positions.push(p[0],y0,p[1],r[0],y1,r[1],q[0],y0,q[1],
      q[0],y0,q[1],r[0],y1,r[1],s[0],y1,s[1]);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
  const m=add(root,geo,new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));m.castShadow=false;return m;
}
function instanceBoxes(g,m,poses){
  const inst=new THREE.InstancedMesh(box,m,poses.length),obj=new THREE.Object3D();
  poses.forEach(([x,y,z,sx,sy,sz,rz=0],i)=>{
    obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);obj.rotation.set(0,rz,0);
    obj.updateMatrix();inst.setMatrixAt(i,obj.matrix);
  });
  inst.instanceMatrix.needsUpdate=true;inst.receiveShadow=true;inst.castShadow=false;
  g.add(inst);meshes++;return inst;
}
function trimIsland(){
  band(-.20,-.31,'#ad9487');band(-.78,-.88,'#a08c86');
  band(-1.29,-1.36,'#927d83');
  const shore=material('#e9debf'),rock=material('#ad9890');
  // One island-scale rim of understated grass above the rock strata.
  const rim=add(root,new THREE.TorusGeometry(8.82,.095,7,96),material('#759e7c'),0,.126,0,1,1,.72);
  rim.rotation.x=Math.PI/2;rim.castShadow=false;
  // The sea reads as a shallow coast, not an infinite flat blue rectangle.
  for(const radius of [9.38,10.04,10.85]){
    const ring=add(scene,new THREE.TorusGeometry(radius,.024,4,96),
      new THREE.MeshBasicMaterial({color:'#f6f7de',transparent:true,opacity:radius>10?.12:.20,depthWrite:false}),0,-1.903,0);
    ring.rotation.x=Math.PI/2;ring.scale.y=.72;ring.castShadow=false;finishing.waves.push(ring);
  }
  // Every shoreline stone belongs to one of three clusters, away from the trail.
  for(const [cx,cz,rot] of [[-7.6,1.6,.1],[7.85,-.7,-.3],[3.0,-5.9,.2]]){
    for(let j=0;j<5;j++){
      const x=cx+(j-2)*.22,z=cz+Math.sin(j*2.2+rot)*.18;
      const b=ball(root,j%3===0?rock:mat.rock,x,ground(x,z)+.11,z,.23+j*.013,.12+(j%3)*.04,.21);
      b.rotation.y=rot+j*.27;
    }
  }
  // Original castle remains the landmark; architecture now has real depth,
  // arched doors, window framing, lintels and a coherent violet shingle roof.
  const castleGroup=root.children.find(g=>g.userData.poi?.title==='Pip Castle');
  if(castleGroup){
    const g=castleGroup,wood=material('#80637e'),warm=material('#ebc993'),ivory=material('#eedfce');
    const tower=material('#bca0b6');
    for(let k=0;k<4;k++){
      const y=.37+k*.31;
      block(g,material(k%2?'#e2d5ca':'#f6e9d9'),-1.45,y,0,.08,.035,1.8);
      block(g,material(k%2?'#e2d5ca':'#f6e9d9'),1.45,y,0,.08,.035,1.8);
    }
    const arch=add(g,new THREE.TorusGeometry(.31,.065,8,24,Math.PI),ivory,0,1.04,1.012);arch.castShadow=false;
    for(const z of [1.035,1.045]){
      for(const x of [-.15,.15])block(g,wood,x,.55,z,.045,.77,.025);
    }
    ball(g,warm,.20,.55,1.08,.055,.055,.055);
    for(const x of [-.76,.76]){
      block(g,ivory,x,1.19,.97,.37,.065,.09);
      block(g,ivory,x,1.19,.97,.055,.50,.09);
      ball(g,warm,x,1.19,1.025,.04,.04,.022);
    }
    for(const x of [-1.55,1.55]){
      for(let k=0;k<6;k++){
        const a=k*Math.PI/3;
        block(g,tower,x+Math.cos(a)*.48,1.65,.15+Math.sin(a)*.48,.21,.11,.19);
      }
      const ring=add(g,new THREE.TorusGeometry(.47,.045,5,28),ivory,x,2.12,.15);
      ring.rotation.x=Math.PI/2;ring.castShadow=false;
    }
    // Entrance staircase steps gently down toward the bridge.
    for(let k=0;k<3;k++){
      const p=block(g,ivory,0,.16-k*.041,1.36+k*.24,1.45+k*.25,.10, .42);
      p.castShadow=false;
    }
    const flag=add(g,new THREE.ConeGeometry(.13,.3,5),material('#d7a7ac'),0,3.0,0);
    flag.castShadow=false;
  }
  // Tiny townhouse details are coherent across all four mushrooms.
  for(const g of root.children.filter(n=>/Cottage|Teahouse|Library|Mushroom/.test(n.userData.poi?.title||''))){
    const size=g.userData.poi.title==='Rosecap Cottage'?1.04:g.userData.poi.title==='The Teahouse'?.88:g.userData.poi.title==='Little Library'?.94:.73;
    const wood=material('#bf9786'),paint=material('#e6c8af'),lit=material('#f5e2b7');
    for(const side of [-1,1]){
      const sx=side*.39*size;
      const win=block(g,lit,sx,.95*size,.44*size,.34*size,.31*size,.035*size);win.castShadow=false;
      block(g,wood,sx,.95*size,.466*size,.04*size,.33*size,.035*size);
      block(g,wood,sx,.95*size,.47*size,.37*size,.035*size,.03*size);
      block(g,paint,sx,.72*size,.52*size,.45*size,.09*size,.15*size);
    }
    const welcome=ball(g,mat.gold,0,.07*size,.99*size,.35*size,.03*size,.22*size);
    welcome.castShadow=false;
    // One small leaf-like canopy flourish per home; not a field of floating props.
    const leaf=ball(g,material('#79a487'),.74*size,.33*size,.13*size,.24*size,.19*size,.26*size);
    leaf.rotation.z=.3;
  }
  // Connect destinations with stone stepping terraces instead of isolated scenery.
  const paving=[];
  for(const [x0,z0,dx,dz,count] of [[-2.65,.05,.18,.10,10],[1.15,-2.2,.13,.04,7],[1.5,1.23,.13,.09,7]]){
    for(let k=0;k<count;k++){
      const x=x0+k*dx,z=z0+k*dz;
      paving.push([x,ground(x,z)+.064,z,.32,.046,.22,(k%2)*.09]);
    }
  }
  instanceBoxes(root,mat.path,paving);
  // Stone banks define the stream without duplicating the bridge geometry.
  const bank=material('#b8a391');
  for(const [x,z,s] of [[-.47,-2.9,.7],[-1.04,-2.3,.8],[-1.12,1.7,.76],[-1.5,2.65,.95]]){
    ball(root,bank,x,ground(x,z)+.1,z,.25*s,.11*s,.45*s);
  }
  // Add root-shadowed wooded layers at the edges rather than everywhere.
  const canopy=material('#92b4a0'),dark=material('#658574');
  for(const [x,z,scale] of [[-6.15,2.0,.87],[-5.6,3.75,.68],[-2.8,4.25,.56]]){
    const g=groupAt(x,ground(x,z),z);
    column(g,mat.trunk,0,.5*scale,0,.13*scale,1*scale);
    ball(g,dark,0,1.25*scale,0,.58*scale,.63*scale,.53*scale);
    ball(g,canopy,-.27*scale,1.42*scale,.10*scale,.38*scale,.38*scale,.39*scale);
    ball(g,mat.leaf,.32*scale,1.12*scale,-.08*scale,.36*scale,.40*scale,.37*scale);
  }
  // Moonwater waterfall gets two narrow translucent streams and foam at impact.
  const falls=root.children.find(g=>g.userData.poi?.title==='Moonwater Falls');
  if(falls){
    const pale=material('#c9e5e0');
    for(const [x,z] of [[-.09,.53],[.20,.55]]){
      const fall=block(falls,waterMat,x,-.64,z,.13,1.3,.035);
      fall.castShadow=false;fall.receiveShadow=false;
      ball(falls,pale,x,-1.30,z,.16,.08,.18);
    }
  }
}
function animateArt(t){
  // Low-amplitude water rhythm. Never spins the island or creates fake weather.
  for(let i=0;i<finishing.waves.length;i++){
    finishing.waves[i].material.opacity=.12+.035*(1+Math.sin(t*.52+i*2.1));
  }
}
trimIsland();

const pip=makePip();
let angle=.65,clock=0,view='3d',alive=!reduced.matches,raf=0,last=0;
let azimuth=.58,elevation=.60,distance=isPhone()?43:25;
const target=new THREE.Vector3(0,.22,0);
function placeCamera(){
  const c=Math.cos(elevation),s=Math.sin(elevation);
  camera.position.set(target.x+distance*c*Math.sin(azimuth),target.y+distance*s,target.z+distance*c*Math.cos(azimuth));
  camera.lookAt(target);
}
function resize(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,isPhone()?1.35:1.7));
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.fov=h>w?48:38;camera.updateProjectionMatrix();
  placeCamera();
}
function update(dt){
  if(!alive)return;
  clock+=dt;angle+=dt*.29;
  const x=7.15*Math.cos(angle),z=4.2*Math.sin(angle);
  pip.actor.position.set(x,ground(x,z)-.045, z);
  pip.actor.rotation.y=Math.atan2(-7.15*Math.sin(angle),4.2*Math.cos(angle));
  const gait=Math.sin(clock*10.6);
  pip.limbs.leftLeg.rotation.x=.6*gait;
  pip.limbs.rightLeg.rotation.x=-.6*gait;
  pip.limbs.leftArm.rotation.x=-.47*gait;
  pip.limbs.rightArm.rotation.x=.47*gait;
  pip.torso.position.y=Math.abs(gait)*.018;
  pip.head.rotation.z=Math.sin(clock*2)*.045;
  // Gentle natural lighting, not a flashing full day/night cycle.
  const warmth=.5+.5*Math.sin(clock*.08);
  sun.intensity=2.3+.35*warmth;
  sea.material.color.setHSL(.52,.27,.67+.008*Math.sin(clock*.28));
  animateArt(clock);
}
function render(){placeCamera();renderer.render(scene,camera);}
function frame(now){
  raf=0;if(document.hidden||view!=='3d')return;
  const dt=last?Math.min(.055,(now-last)/1000):0;last=now;
  update(dt);render();if(alive)raf=requestAnimationFrame(frame);
}
function begin(){if(raf)cancelAnimationFrame(raf);raf=0;last=0;if(view==='3d'){render();if(alive&&!document.hidden)raf=requestAnimationFrame(frame);}}
function oldMotion(on){window.postMessage({type:'mushroom:motion',playing:on,source:'island3d'},location.origin);}
function choose(next){
  view=next;const three=next==='3d';
  canvas.style.display=three?'block':'none';
  oldCanvas.style.display=three?'none':'block';
  if(toggle){toggle.textContent=three?'2D art':'3D world';toggle.setAttribute('aria-label',three?'Switch to original painted 2D island':'Switch to explorable 3D island');}
  hint.hidden=!three;status.hidden=true;
  oldMotion(!three&&alive);
  if(three)resize();
  begin();
}
const pointers=new Map();
let pinch=null,dragged=false,startX=0,startY=0;
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){dragged=false;startX=e.clientX;startY=e.clientY;}
  pinch=null;
});
canvas.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){
    const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
    if(Math.hypot(e.clientX-startX,e.clientY-startY)>7)dragged=true;
    azimuth-=dx*.0055;
    elevation=THREE.MathUtils.clamp(elevation+dy*.004,-.02,1.20);
  }else if(pointers.size===2){
    const [a,b]=[...pointers.values()];
    const d=Math.hypot(a.x-b.x,a.y-b.y);
    if(pinch!==null)distance=THREE.MathUtils.clamp(distance*pinch/Math.max(1,d),12,58);
    pinch=d;dragged=true;
  }
  if(!alive)render();
});
function inspect(e){
  const r=canvas.getBoundingClientRect(),x=((e.clientX-r.left)/r.width)*2-1,y=-((e.clientY-r.top)/r.height)*2+1;
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),camera);
  const hits=ray.intersectObjects(root.children,true);
  for(const h of hits){let o=h.object;while(o&&o!==root){if(o.userData.poi){
    status.textContent=o.userData.poi.title+' — '+o.userData.poi.desc;
    status.hidden=false;return;
  }o=o.parent;}}
  status.hidden=true;
}
canvas.addEventListener('pointerup',e=>{if(!dragged&&pointers.size===1)inspect(e);pointers.delete(e.pointerId);pinch=null;});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);pinch=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance*(e.deltaY>0?1.08:.92),12,58);if(!alive)render();},{passive:false});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();choose('2d');toggle.hidden=true;},{passive:false});
toggle?.addEventListener('click',()=>choose(view==='3d'?'2d':'3d'));
window.addEventListener('resize',()=>{if(view==='3d'){resize();render();}},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)begin();else {if(raf)cancelAnimationFrame(raf);raf=0;}});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.data?.type!=='mushroom:motion'||e.data.source==='island3d')return;
  alive=Boolean(e.data.playing)&&!reduced.matches;begin();
});
reduced.addEventListener?.('change',()=>{alive=!reduced.matches;begin();oldMotion(view==='2d'&&alive);});
window.PipIsland3D={
  ready:true,
  mode:()=>view,
  choose,
  stats:()=>({meshes,mode:view,position:[...pip.actor.position.toArray()],distance,azimuth,elevation,renderCalls:renderer.info.render.calls}),
  focus(name){const g=root.children.find(o=>o.userData.poi?.title===name);if(g){target.copy(g.position);distance=THREE.MathUtils.clamp(distance,12,40);render();return true;}return false;},
  reset(){target.set(0,.22,0);azimuth=.58;elevation=.60;distance=isPhone()?43:25;render();}
};
// The original animation boots before this module. Pause it only after a 3D frame succeeds.
resize();
pip.actor.position.set(7.15*Math.cos(angle),ground(7.15*Math.cos(angle),4.2*Math.sin(angle))-.045,4.2*Math.sin(angle));
render();
toggle.hidden=false;
choose('3d');
