// Toy Town WebGL smoke — exercises the real scene-construction and
// lifecycle code through a lightweight Three API double. No GPU is required.
// Run: node tests/toy-town-3d.test.cjs
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'toy-town.html'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleCode=fs.readFileSync(path.join(root,'assets/toy-town-3d.js'),'utf8');
assert.match(html,/type="importmap"/);
assert.match(html,/three@0\.187\.0\/build\/three\.module\.js/);
assert.match(html,/three@0\.187\.0\/examples\/jsm\//);
assert.match(html,/toy-town-3d\.js\?v=5/);
assert.match(html,/toy-town\.js\?v=14/);
assert.ok(html.indexOf('toy-town.js?v=14')<html.indexOf("import('three')"), 'classic fallback starts first');
assert.match(page,/toy-town\.html\?v=18&embed=1/);
assert.match(moduleCode,/export function mountToyTown3D/);
assert.match(moduleCode,/new THREE\.WebGLRenderer/);
assert.match(moduleCode,/window\.ToyTown3D=api/);
assert.match(moduleCode,/webglcontextlost/);
assert.match(moduleCode,/window\.WebGL2RenderingContext/);
assert.match(moduleCode,/function syncActors/);
assert.match(moduleCode,/function syncCamera/);
assert.match(moduleCode,/function roof/);
assert.match(moduleCode,/function light/);
const callbacks=[],stats={created:0,renders:0,geometry:0,dispose:0,frames:0,roofTextures:0,paintOperations:0},events={};
class V {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  setScalar(v){this.x=v;this.y=v;this.z=v;return this;}
  copy(v){return this.set(v.x||0,v.y||0,v.z||0);}
}
class C {
  constructor(v){this.hex=v;this.r=.5;this.g=.5;this.b=.5;}
  set(v){this.hex=v;return this;}
  copy(v){this.hex=v.hex;return this;}
}
class O {
  constructor(){this.position=new V();this.rotation=new V();this.scale=new V(1,1,1);
    this.children=[];this.parent=null;this.userData={};this.style={};this.castShadow=false;}
  add(...items){for(const o of items){o.parent=this;this.children.push(o);} }
  remove(o){const i=this.children.indexOf(o);if(i>=0)this.children.splice(i,1);o.parent=null;}
  lookAt(){}
  updateProjectionMatrix(){}
  setAttribute(){}
  addEventListener(name,cb){events[name]=cb;}
}
class Geometry {constructor(){stats.geometry++;}translate(){return this;}}
class Material {constructor(o){Object.assign(this,o);this.emissive=new C(o.emissive||'#000');}}
class Mesh extends O {constructor(g,m){super();this.geometry=g;this.material=m;}}
class Directional extends O {constructor(){super();this.color=new C('white');this.shadow={
  mapSize:{set(){}},camera:{},bias:0,radius:0};this.target=new O();}}
class Renderer {
  constructor(){stats.created++;this.domElement=new O();this.domElement.style={};this.shadowMap={};
    this.domElement.width=390;this.domElement.height=844;this.throwOnRender=false;}
  setPixelRatio(v){this.pixelRatio=v;}
  setSize(w,h){this.domElement.width=w;this.domElement.height=h;}
  render(){stats.renders++;if(this.throwOnRender)throw Error('GPU render failed');}
  dispose(){stats.dispose++;}
}
class Shape {moveTo(){}lineTo(){}closePath(){}}
class Texture {constructor(){this.colorSpace='';stats.roofTextures++;}}
const THREE={
 WebGLRenderer:Renderer, Scene:O, Group:O,
 Color:C,Fog:class{constructor(col){this.color=new C(col);}},
 OrthographicCamera:O,HemisphereLight:O,DirectionalLight:Directional,
 PointLight:class extends O {constructor(){super();this.isPointLight=true;this.intensity=0;}},
 MeshStandardMaterial:Material,MeshBasicMaterial:Material,
 Mesh,BoxGeometry:Geometry,SphereGeometry:Geometry,IcosahedronGeometry:Geometry,
 CylinderGeometry:Geometry,TorusGeometry:Geometry,PlaneGeometry:Geometry,ExtrudeGeometry:Geometry,
 Shape,CanvasTexture:Texture,DoubleSide:2,
 SRGBColorSpace:'srgb',ACESFilmicToneMapping:2,PCFSoftShadowMap:3,
 MathUtils:{clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),lerp:(a,b,t)=>a+(b-a)*t}
};
const win={WebGL2RenderingContext:function(){},innerWidth:390,innerHeight:844,
  devicePixelRatio:3,matchMedia:()=>({matches:false})};
const canvas2d={fillText(){},beginPath(){},roundRect(){},fill(){stats.paintOperations++;},stroke(){},fillRect(){stats.paintOperations++;},moveTo(){},lineTo(){},createLinearGradient:()=>({addColorStop(){}})};
const townCanvas={style:{opacity:'1'}};
const host={style:{display:'none'},clientWidth:390,clientHeight:844,
  appendChild(o){this.child=o;}};
const document={createElement:()=>({width:0,height:0,getContext:()=>canvas2d}),
  getElementById:id=>id==='town'?townCanvas:null};
let buildings=[
  {kind:'house',x:7,y:7,h:34,hero:true,wall:'#eddfc3',roof:'#a46d50'},
  {kind:'house',x:10,y:8,h:34,hero:true,wall:'#cbdcdb',roof:'#678d9c'},
  {kind:'house',x:10,y:10,h:36,hero:true,wall:'#eadfc5',roof:'#be8165'},
  {kind:'shop',x:8,y:7,h:40,hero:true,wall:'#decdbd',awning:'#b56e5e',name:'BAKERY'},
  {kind:'shop',x:9,y:7,h:38,hero:true,wall:'#bcd7d1',awning:'#547c79',name:'BOOKS'},
  {kind:'tower',x:3,y:3,h:85,wall:'#a3b6ca'},
  {kind:'fire',x:12,y:12,h:26,wall:'#d56a59'}];
const props=[
  {kind:'tree',x:7.5,y:9.5,s:1,c:'#7a9973'},
  {kind:'hero-shrub',x:8.5,y:9.5,col:'#58976b'},
  {kind:'hero-bench',x:8.3,y:9.4},{kind:'hero-table',x:9.5,y:9.4},
  {kind:'hero-lamp',x:8.2,y:8.3},{kind:'hero-mail',x:7.2,y:9.8},
  {kind:'hero-rack',x:9.4,y:8.3},{kind:'fountain',x:4.2,y:4.2},
  {kind:'stadium',x:12,y:4},{kind:'launchpad',x:4,y:12},{kind:'stage',x:12,y:8},
  {kind:'times',x:17.2,y:.7}
];
const pedestrians=[{type:'person',x:8.1,y:8.7,d:0,v:.26,travel:4,col:'#d5a6a0',skin:'#d8a984',heroResident:true},
  {type:'car',kind:'car',x:6.2,y:6.5,d:0,heading:0,v:.5,col:'#a7c9dc',travel:6},
  {type:'car',kind:'bike',x:8.4,y:11.4,d:2,v:.4,col:'#97b2a0',skin:'#dfa586'}];
let seed=20261031,frameClock=6,currentCamZoom=1.52,nightValue=.25;
const town={
 buildings:()=>buildings,props:()=>props,movers:()=>pedestrians,
 fitView:()=>.475,debug:()=>({seed,night:nightValue,clock:frameClock,
  cam:{x:9,y:9,z:currentCamZoom,tx:9,ty:9,tz:currentCamZoom}})
};
const context={THREE,window:win,document,console,
  requestAnimationFrame:cb=>{callbacks.push(cb);return callbacks.length;},
  cancelAnimationFrame:()=>{}};
vm.createContext(context);
const boot=new vm.Script(moduleCode.replace(/^export /m,'')+';this.mount=mountToyTown3D;');
boot.runInContext(context);
const api=context.mount(THREE,Geometry,town,host);
assert.equal(api.active,false,'do not hide classic scene before 3D is drawn');
assert.equal(host.style.display,'none');
assert.equal(townCanvas.style.opacity,'1');
assert.ok(callbacks.length===1,'WebGL schedules a frame');
callbacks.shift()();
assert.equal(api.active,true,'3D begins only after successful render');
assert.equal(host.style.display,'block');
assert.equal(townCanvas.style.opacity,'0');
assert.ok(stats.renders>=1);
assert.ok(stats.roofTextures>=2,'roof textures created for different colored gables');
assert.ok(stats.paintOperations>=400,'small overlapping tiles produce detailed but subtle roof texture');
assert.match(moduleCode,/const variation=\(row\*13\+col\*17\)%7/,
  'clay roof does not use an obvious large-color checkerboard');
assert.match(moduleCode,/Miniature gabled porch roof/,
  'porch has a pitched profile rather than a flat canopy');
assert.match(moduleCode,/Separate warm, irregular limestone pavers/,
  'courtyard pavers replace the rigid grid');
assert.match(moduleCode,/function plaster\(color\)/,'walls use grainy plaster instead of plain plastic');
assert.match(moduleCode,/function archedInset\(/,'doors/windows have dimensional arches');
assert.match(moduleCode,/function turret\(/,'one hero cottage has its own curved tower');
assert.match(moduleCode,/function sideCottageWing\(/,'another hero cottage has a secondary roof and wing');
assert.match(moduleCode,/function shopExtra\(/,'bookshop and bakery have distinctive facades');
assert.match(moduleCode,/function ivy\(/,'climbing green vines integrate facades with the landscape');
assert.match(moduleCode,/One continuous asymmetric crown/,'sculpted tree shapes remain active');


assert.equal(api.getStats().plazaLights,1,'modeled plaza lamps have physical warm light');
const lantern=api.scene.children.find(o=>o.children?.some(x=>x.isPointLight))?.children.find(x=>x.isPointLight);
assert.ok(lantern && lantern.intensity>0, 'dusk physically illuminates the courtyard');
const lampAtDusk=lantern.intensity;nightValue=.85;callbacks.shift()();
assert.ok(lantern.intensity>lampAtDusk*2.5,'neighborhood lights strengthen after sunset');
nightValue=.25;callbacks.shift()();
assert.ok(api.renderer.toneMappingExposure <= 1.1,'balanced lighting avoids blowing out pastel facades');
const initialPedestrian=api.scene.children.find(g=>g.children&&g.children.some(x=>x.userData&&x.userData.limbs));
assert.ok(initialPedestrian,'3D inhabitants have articulated limbs');
const peopleGroup=api.scene.children.find(g=>g.children&&g.children.some(x=>x.position.x===8.1 && x.position.z===8.7));
const firstPerson=peopleGroup.children.find(x=>x.position.x===8.1 && x.position.z===8.7);
assert.ok(Math.abs(firstPerson.rotation.y-Math.PI/2)<.0001,'face points into walking direction, not sideways');
const normalCameraHeight=api.camera.position.y;
currentCamZoom=3.2; callbacks.shift()();
assert.ok(api.camera.position.y < normalCameraHeight,'close zoom lowers viewing angle to show facades');
currentCamZoom=1.52;callbacks.shift()();
assert.ok(Math.abs(api.camera.position.y-normalCameraHeight)<.0001,'camera returns to regular viewing angle');
assert.equal(api.getStats().actors,3,'pedestrians and vehicles follow the existing simulation');
assert.equal(api.getStats().buildings,7);
const modeledArchitecture=api.scene.children.find(o=>o.children?.some(x=>x.position.x===7.5&&x.position.z===7.5));
assert.ok(modeledArchitecture,'hero architectural assembly is part of the world');
const oldCount=stats.renders;
pedestrians.pop();frameClock+=1;
callbacks.shift()();
assert.equal(api.getStats().actors,2,'departing vehicles are removed');
assert.ok(stats.renders>oldCount);
seed++;buildings=buildings.slice();callbacks.shift()();
assert.equal(api.getStats().redrawCount,2,'new daily town triggers a full rebuild');
const cameraZoom=api.camera.zoom;
assert.ok(cameraZoom>0 && Number.isFinite(cameraZoom),'camera syncs to the existing zoom');
host.clientWidth=844; host.clientHeight=390; win.innerWidth=844; win.innerHeight=390;
callbacks.shift()();
assert.equal(api.renderer.domElement.width,844,'landscape resize updates renderer');
assert.equal(api.renderer.domElement.height,390,'landscape resize updates renderer height');
assert.ok(api.camera.right>api.camera.top,'landscape retains the full 3D field of view');
host.clientWidth=390; host.clientHeight=844; win.innerWidth=390; win.innerHeight=844;
callbacks.shift()();
assert.equal(api.renderer.domElement.width,390,'portrait resize restores mobile projection');

const rendersBeforeFail=stats.renders;
api.renderer.throwOnRender=true;callbacks.shift()();
assert.equal(api.active,false,'render failure disables WebGL');
assert.equal(host.style.display,'none','failure restores 2D');
assert.equal(townCanvas.style.opacity,'1','2D fallback visible after GPU error');
api.dispose();
assert.equal(stats.dispose,1,'GPU resources are released on disposal');
console.log('Toy Town 3D PASS: deferred activation, real scene build, movement sync, seed rebuild, zoom, WebGL failure fallback');
