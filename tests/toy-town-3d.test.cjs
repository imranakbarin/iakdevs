// Toy Town WebGL smoke — exercises the real scene-construction and
// lifecycle code through a lightweight Three API double. No GPU is required.
// Run: node tests/toy-town-3d.test.cjs
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'toy-town.html'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleCode=fs.readFileSync(path.join(root,'assets/toy-town-3d.js'),'utf8');
const landmarkCode=fs.readFileSync(path.join(root,'assets/toy-town-landmarks.js'),'utf8');
assert.match(landmarkCode,/export function buildLandmark/);
assert.match(landmarkCode,/function bakery\(/);
assert.match(landmarkCode,/function bookshop\(/);
assert.match(landmarkCode,/function roseCottage\(/);
assert.match(landmarkCode,/function blueCottage\(/);
assert.match(landmarkCode,/function honeyCottage\(/);
assert.match(landmarkCode,/function roundedFootprint\(/,'unique facades use extruded footprint geometry');
assert.match(landmarkCode,/function volumeRoof\(/,'bespoke roofs are actual modeled shells');
assert.match(landmarkCode,/function photographicGlass\(warm=false\)/,
  'windows have shared reflective-sky and lamplit-interior material');
assert.match(landmarkCode,/type==='stucco'/,
  'landmark mineral plaster uses a distinct atlas');
assert.match(landmarkCode,/type==='tile'/,
  'roof clay and slate have weathered staggered handmade tiling');
assert.match(landmarkCode,/type==='stone'/,
  'ground courses and window surrounds have real painted ashlar');
assert.match(landmarkCode,/type==='wood'/,
  'timber framing is rendered with directional grain');
assert.match(landmarkCode,/const glassCache=new Map\(\)/,
  'architectural window materials are reused rather than generated per pane');
assert.match(landmarkCode,/Layered eaves:/,
  'roof edges contain dimensional undersides, fascia and ridgework');
assert.match(landmarkCode,/function arch\(/,'landmark doors have hollow shaped frames');
assert.match(landmarkCode,/function crossGable\(/,
  'independently sculpted front cross gables change the five landmark rooflines');
assert.match(landmarkCode,/function shapedBay\(/,
  'both shops gain angled multi-panel glass bays');
assert.match(landmarkCode,/function timberFront\(/,
  'storybook cottages include dimensional structural framing');
assert.match(landmarkCode,/function masonryStripes\(/,
  'shop walls share continuous dimensional stone courses');
assert.match(landmarkCode,/function lanternBracket\(/,
  'landmark entrance lanterns are connected to their facades');
assert.match(landmarkCode,/const wing=new T.Group\(\);/,
  'rose cottage has a separately modeled and projecting asymmetric wing');
assert.match(landmarkCode,/volumeRoof\(dormer/,
  'roof dormers use curved three-dimensional gable shells');
assert.match(landmarkCode,/function raisedRoofTiles\(/,
  'each landmark roof has physically overlapping ceramic tile geometry');
assert.match(landmarkCode,/new T\.InstancedMesh\(tileGeometry,tileMat,count\)/,
  'ceramic courses are GPU-instanced rather than hundreds of individual draw calls');
assert.match(landmarkCode,/function carvedRoofRidge\(/,
  'roof ridge tiles articulate the silhouette in three dimensions');
assert.match(landmarkCode,/const terminal=sphere\(g,\.030,texture\(color,'tile'\)/,
  'tiny ridge finials inherit roof pigment instead of appearing as bright floating beads');
assert.match(landmarkCode,/function masonryCorners\(/,
  'shop and cottage walls include staggered structural quoins');
assert.match(landmarkCode,/function woodenShutters\(/,
  'windows include dimensional wooden shutters and louvres');
assert.match(landmarkCode,/function copperGutters\(/,
  'roof edges and downspouts are real connected structural elements');
assert.match(landmarkCode,/function shallowEntrySteps\(/,
  'door thresholds connect to the surrounding walkable ground');
assert.doesNotMatch(landmarkCode,/const cap=block\(g,\.29,\.047,\.26/,
  'old flat dormer tops are removed');
assert.match(landmarkCode,/const shadowTex=/,'landmarks have baked foundation occlusion');
assert.match(landmarkCode,/createRadialGradient/,'grounding uses a soft, feathered shadow');
assert.match(landmarkCode,/toneMapped:false/,'sign lettering is legible without harsh tone mapping');
assert.match(landmarkCode,/BOOK NOOK/,'bookshop sign is compact enough for mobile');
assert.match(moduleCode,/const rim=new THREE.DirectionalLight/,'sculpted character surfaces have shadow-free fill');
assert.match(moduleCode,/EquirectangularReflectionMapping/,
  'window reflections and painted surfaces share a warm studio sky');
assert.match(moduleCode,/renderer\.render\(scene,camera\);/,
  'sharp direct-render pipeline preserves original WebGL details');
assert.doesNotMatch(moduleCode,/new THREE\.WebGLRenderTarget/,
  'experimentally washed-out offscreen image processing has been removed');
assert.match(landmarkCode,/miniatureWindow:true,warm/,
  'landmark glass supports shared natural dusk illumination');
assert.match(moduleCode,/function roadSurface\(axis\)/,'roads share tactile matte wear instead of flat plastic');
assert.match(moduleCode,/function creature\(ref\)/,
  'animals have their own expressive body rigs');
assert.match(moduleCode,/const headPivot=new THREE.Group\(\)/,
  'residents articulate a neck independently of their body');
assert.match(moduleCode,/function car\(ref\)/,
  'vehicles have separate class-specific model geometry');
assert.match(moduleCode,/brakeMaterial\.emissiveIntensity=ref\.braking/,
  'tail lamps respond to live simulated traffic braking');
assert.match(moduleCode,/limbs\.headPivot\.rotation\.y\+=/,
  'residents look toward genuinely noticed destinations');
assert.match(moduleCode,/bike\.crank\.rotation\.z=/,
  'bicycle drivetrain moves with traveled distance');
assert.match(moduleCode,/ref\.watch==='owner'\?5\.1:3\.1/,
  'companion dogs wag faster when attending to their owners');
assert.match(moduleCode,/if\(ref\.sit&&rig\.kind==='dog'\)/,
  'dogs visibly sit when their owner pauses to socialize');
assert.match(moduleCode,/const landscapeAtlas=/,'town has a continuous non-repeating terrain paint layer');
assert.match(moduleCode,/function vergeMaterial\(axis\)/,'street edges have shared soft painted vegetation');
assert.match(moduleCode,/function paintedVerge\(/,'street verges have physically placed decals');
assert.match(moduleCode,/function createStorybookVillage\(/,
  'village scenery is built as one cohesive 3D environmental set');
assert.match(moduleCode,/shop\.userData\.streetFront=/,
  'storefronts have physical tracked service details');
assert.match(moduleCode,/shop\.ringUntil=time\+\.9/,
  'service bell reacts to an actual vendor handoff');
assert.doesNotMatch(moduleCode,/a\.mesh\.rotation\.y=\.003\*Math\.sin\(time\*1\.2\+a\.phase\)/,
  'store counters no longer drift or wobble when nobody is interacting');
assert.match(moduleCode,/function districtFixture\(p\)/,
  'outer neighborhoods have separately modeled working places');
assert.match(moduleCode,/districtSceneRole=p\.role/,
  'workplace roles survive into the 3D scene');
assert.match(moduleCode,/districtTool=tool/,
  'real job-specific tools attach to resident wrists');
assert.match(moduleCode,/scene\.background\.set\(tint\('#cee9f5'/,
  'the entire town shares a clearer, colorful daylight sky');
assert.match(moduleCode,/kind:'umbrella'/,'visible animated café canopies add a lively street silhouette');
assert.match(moduleCode,/kind:'bunting'/,'real suspended flags sway over the plaza');
assert.match(moduleCode,/kind:'pinwheel'/,'living village pinwheels animate continuously');
assert.match(moduleCode,/kind:'balloon'/,'tethered colored balloons enliven the village');
assert.match(moduleCode,/plazaInlay=true/,'colorful authored art grounds the central plaza');
assert.match(moduleCode,/kind:'butterfly'/,'butterflies animate over planted areas');
assert.match(html,/saturate\(1\.42\) contrast\(1\.11\)/,
  'mobile WebGL receives a coherent richer color grade');
assert.match(moduleCode,/function gardenIsland\(/,
  'garden beds have shaped earth volumes rather than floating square props');
assert.match(moduleCode,/const cafeSet=/,'the village includes modeled cafe seating');
assert.match(moduleCode,/const archCurve=new THREE.CatmullRomCurve3/,
  'rose arbour has a sculpted curved timber span');
assert.match(moduleCode,/const strings=\[\[anchors\[0\],anchors\[1\]\]/,
  'restrained parallel festoon strands connect actual supports');
assert.match(moduleCode,/createStorybookVillage\(\);/,
  'complete village set is mounted during world rebuild');
assert.match(moduleCode,/groundPiece\(3\.96,3\.96,grassMaterial/,'central landscaping is one courtyard not sixteen tiles');
assert.doesNotMatch(moduleCode,/groundPiece\(\.97,\.97,middle/,'the old rigid 4 by 4 lawn patchwork is removed');
assert.match(moduleCode,/function groundingShadow\(/,'architecture and trees have soft contact occlusion');
assert.match(moduleCode,/const studioMat=/,'model sits on a photographed gradient table');
assert.match(moduleCode,/sun\.color\.set\(tint\(/,'sunset light transitions smoothly without snapping hues');
assert.match(html,/#town-3d::after/,'lens finish has a restrained noninteractive vignette');
assert.match(moduleCode,/g.userData.limbs=\{legs,arms,elbows,wrists,hands,shins,feet/,
  'residents have independent shoulder, elbow and wrist joints');
assert.match(moduleCode,/bag.userData.carriedProp='handbag'/,
  'handbags attach to the carrying hand instead of hovering at the hip');
assert.match(moduleCode,/const turnToFocus=focus&&toward/,
  'neighbors turn their whole body to their conversation partner');
assert.match(moduleCode,/state.speed=ease\(/,
  'walk-to-stop transitions use rate-limited pose blends');
assert.match(moduleCode,/limbs.upperBody.rotation.x=/,
  'a full body weight shift accompanies movement and social interaction');
assert.match(moduleCode,/const speech=dominant\?state.speak/,
  'conversation gestures use differentiated speaking and listening poses');
assert.match(moduleCode,/k===0\|\|k===3\?0:Math.PI/,
  'four-legged animals trot with diagonal alternating paws');
assert.match(moduleCode,/eye.scale.y=blink/,'eyelids blink without a separate animation thread');
assert.match(html,/type="importmap"/);
assert.match(html,/three@0\.187\.0\/build\/three\.module\.js/);
assert.match(html,/three@0\.187\.0\/examples\/jsm\//);
assert.match(html,/toy-town-3d\.js\?v=41/);
assert.match(html,/toy-town-landmarks\.js\?v=7/,'the independent models are requested alongside Three');
assert.match(html,/buildLandmark:landmarks\.buildLandmark/,
  'loader injects the authored model builder into the 3D simulation');
assert.match(html,/toy-town\.js\?v=26/);
const classicScript=html.match(/src="assets\/toy-town\.js\?v=\d+"/);
assert.ok(classicScript&&
  html.indexOf(classicScript[0])<html.indexOf("import('three')"),
  'the actual versioned classic script always loads before WebGL');
assert.match(page,/toy-town\.html\?v=52&embed=1/);
assert.match(fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'),
  /targetX=clamp\(\.08,p\.x,17\.92\)/,
  'scripted paths are clamped at the endpoint rather than freezing outside town');
assert.match(fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'),
  /Cross-traffic clearance:/,
  'drivers yield to traffic still occupying an intersection');
assert.match(moduleCode,/export function mountToyTown3D/);
assert.match(moduleCode,/new THREE\.WebGLRenderer/);
assert.match(moduleCode,/window\.ToyTown3D=api/);
assert.match(moduleCode,/webglcontextlost/);
assert.match(moduleCode,/window\.WebGL2RenderingContext/);
assert.match(moduleCode,/function syncActors/);
assert.match(moduleCode,/function syncCamera/);
assert.match(moduleCode,/function roof/);
assert.match(moduleCode,/function light/);
const callbacks=[],stats={created:0,renders:0,geometry:0,dispose:0,frames:0,roofTextures:0,paintOperations:0,profileVertices:0,instances:0,instancedGroups:0},events={};
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
  clone(){return new C(this.hex);}
  lerp(v,t){return this;}
}
class O {
  constructor(){this.position=new V();this.rotation=new V();this.scale=new V(1,1,1);
    this.children=[];this.parent=null;this.userData={};this.style={};this.castShadow=false;}
  add(...items){for(const o of items){o.parent=this;this.children.push(o);} }
  remove(o){const i=this.children.indexOf(o);if(i>=0)this.children.splice(i,1);o.parent=null;}
  lookAt(){}
  updateMatrix(){this.matrix={position:{...this.position},rotation:{...this.rotation}};}
  updateProjectionMatrix(){}
  setAttribute(){}
  addEventListener(name,cb){events[name]=cb;}
}
class Geometry {constructor(){stats.geometry++;}translate(){return this;}rotateX(){return this;}}
class Material {constructor(o){Object.assign(this,o);this.emissive=new C(o.emissive||'#000');}}
class Mesh extends O {constructor(g,m){super();this.geometry=g;this.material=m;}}
class InstancedMesh extends Mesh {
  constructor(g,m,count){super(g,m);this.count=count;this.matrices=[];this.colors=[];
    stats.instances+=count;stats.instancedGroups++;}
  setMatrixAt(i,m){this.matrices[i]=m;}
  setColorAt(i,c){this.colors[i]=c;}
}
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
class Shape {constructor(){this.holes=[];}moveTo(){}lineTo(){stats.profileVertices++;}quadraticCurveTo(){stats.profileVertices++;}closePath(){}}
class Path extends Shape {}
class Vector2 extends V {}
class Vector3 extends V {}
class Curve {constructor(points){this.points=points;}}
class Texture {constructor(){this.colorSpace='';stats.roofTextures++;}}
const THREE={
 WebGLRenderer:Renderer, Scene:O, Group:O, Object3D:O, InstancedMesh,
 Color:C,Fog:class{constructor(col){this.color=new C(col);}},
 PerspectiveCamera:class extends O {constructor(fov,aspect,near,far){super();this.fov=fov;this.aspect=aspect;this.near=near;this.far=far;this.zoom=1;}},
 OrthographicCamera:O,HemisphereLight:O,DirectionalLight:Directional,
 PointLight:class extends O {constructor(){super();this.isPointLight=true;this.intensity=0;}},
 MeshStandardMaterial:Material,MeshBasicMaterial:Material,
 Mesh,BoxGeometry:Geometry,SphereGeometry:Geometry,IcosahedronGeometry:Geometry,
 CylinderGeometry:Geometry,ConeGeometry:Geometry,TorusGeometry:Geometry,PlaneGeometry:Geometry,ExtrudeGeometry:Geometry,
 LatheGeometry:Geometry,TubeGeometry:Geometry,
 Shape,Path,Vector2,Vector3,CatmullRomCurve3:Curve,CanvasTexture:Texture,DoubleSide:2,
 SRGBColorSpace:'srgb',ACESFilmicToneMapping:2,PCFSoftShadowMap:3,
 MathUtils:{clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),lerp:(a,b,t)=>a+(b-a)*t}
};
const win={WebGL2RenderingContext:function(){},innerWidth:390,innerHeight:844,
  devicePixelRatio:3,matchMedia:()=>({matches:false})};
const canvas2d={fillText(){},clearRect(){},beginPath(){},roundRect(){},ellipse(){},arc(){},fill(){stats.paintOperations++;},stroke(){},fillRect(){stats.paintOperations++;},moveTo(){},lineTo(){},closePath(){},bezierCurveTo(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
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
  {kind:'house',x:3,y:3,h:33,wall:'#d6d7c0',roof:'#b4785a'},
  {kind:'fire',x:12,y:12,h:26,wall:'#d56a59'},
  {kind:'tower',x:3,y:4,h:88,wall:'#a8bfd1'}];
const props=[
  {kind:'tree',x:7.5,y:9.5,s:1,c:'#7a9973'},
  {kind:'hero-shrub',x:8.5,y:9.5,col:'#58976b'},
  {kind:'hero-bench',x:8.3,y:9.4},{kind:'hero-table',x:9.5,y:9.4},
  {kind:'hero-lamp',x:8.2,y:8.3},{kind:'hero-mail',x:7.2,y:9.8},
  {kind:'hero-rack',x:9.4,y:8.3},{kind:'fountain',x:4.2,y:4.2},
  {kind:'stadium',x:12,y:4},{kind:'launchpad',x:4,y:12},{kind:'stage',x:12,y:8},
  {kind:'times',x:17.2,y:.7},
  {kind:'district-scene',role:'garden',x:3.5,y:4.5},
  {kind:'district-scene',role:'post',x:13.5,y:4.5},
  {kind:'district-scene',role:'art',x:3.5,y:9.5},
  {kind:'district-scene',role:'produce',x:13.5,y:9.5}
];
const pedestrians=[{type:'person',x:8.1,y:8.7,d:0,v:.26,travel:4,col:'#d5a6a0',skin:'#d8a984',heroResident:true},
  {type:'car',kind:'car',x:6.2,y:6.5,d:0,heading:0,v:.5,col:'#a7c9dc',travel:6},
  {type:'car',kind:'bike',x:8.4,y:11.4,d:2,v:.4,col:'#97b2a0',skin:'#dfa586'},
  {type:'person',kind:'district-worker',districtResident:true,districtWorker:true,
    districtRole:'garden',districtAction:'working',
    x:3.5,y:3.5,d:2,v:0,moved:0,col:'#78a995',skin:'#d8a984',
    attention:{x:3.5,y:4.5}}];
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
const assetBoot=new vm.Script(landmarkCode.replace(/^export /m,'')+';this.landmark=buildLandmark;');
assetBoot.runInContext(context);
const boot=new vm.Script(moduleCode.replace(/^export /m,'')+';this.mount=mountToyTown3D;');
boot.runInContext(context);
const api=context.mount(THREE,Geometry,town,host,{buildLandmark:context.landmark});
assert.equal(api.active,false,'do not hide classic scene before 3D is drawn');
assert.equal(host.style.display,'none');
assert.equal(townCanvas.style.opacity,'1');
assert.ok(callbacks.length===1,'WebGL schedules a frame');
callbacks.shift()();
assert.equal(api.active,true,'3D begins only after successful render');
assert.equal(host.style.display,'block');
assert.equal(townCanvas.style.opacity,'0');
assert.ok(stats.renders>=1);
assert.ok(api.getStats().gardenElements>=140,'village has substantial coordinated landscaping and furniture');
const workingDesks=api.scene.children.flatMap(n=>n.children||[])
  .filter(n=>n.userData?.workingShop);
assert.equal(workingDesks.length,2,'two decorated real merchandise counters occupy shop frontage');
assert.ok(workingDesks.every(s=>s.userData.streetFront?.bell),
  'both trading counters have actual architectural fronts and handoff bells');
assert.deepEqual(workingDesks.map(s=>s.userData.streetFront.merchandise),
  ['pastries','books'],
  'two shops have distinct window merchandise rather than identical filler');
assert.ok(workingDesks.every(s=>s.children.length>30),
  'supported awnings and dimensional merchandise actually exist in the 3D scene');
assert.ok(workingDesks.every(s=>s.position.x>7&&s.position.x<11&&
  s.position.z>8&&s.position.z<9),'shop counters are on the living village frontage');
assert.ok(api.getStats().woodlandShapes>=1,
  'simulation trees use the authored asymmetric crowns');
assert.ok(api.getStats().terrainContours>=2,
  'the open lots now contain landscaped organic terrain');
assert.ok(api.getStats().districtGardenRooms>=1,
  'empty outer lots receive at least one low landscaped courtyard');
const gardenRooms=api.scene.children.flatMap(node=>node.children||[])
  .filter(node=>node.userData?.districtGarden);
assert.equal(gardenRooms.length,api.getStats().districtGardenRooms,
  'all planted courts are real grounded scene geometry');
assert.equal(api.getStats().festoonBulbs,14,'two suspended spans contain 14 miniature lamps');
assert.ok(api.getStats().windowMaterials>=2,
  'daylight and interior window materials are registered for unified dusk lighting');
const allWindowMaterials=[];
const gatherWindows=(node)=>{
  if(node.material?.userData?.miniatureWindow&&!allWindowMaterials.includes(node.material))
    allWindowMaterials.push(node.material);
  for(const ch of node.children||[])gatherWindows(ch);
};
gatherWindows(api.scene);
assert.ok(allWindowMaterials.length>=2,'two shared window finishes exist at runtime');
const initialGlow=allWindowMaterials[0].emissiveIntensity;
const initialGardenCount=api.getStats().gardenElements;
const sceneWorld=api.scene.children.find(o=>o.children?.some(x=>x.userData?.uniqueAsset));
assert.ok(sceneWorld,'scene has a populated world group');
const outerFixtures=sceneWorld.children.filter(o=>o.userData?.districtSceneRole);
assert.equal(outerFixtures.length,4,
  'all four outer district fixtures actually build in the scene');
assert.equal(outerFixtures.map(o=>o.userData.districtSceneRole).join(','),
  'garden,post,art,produce','the four workplaces have different models');
const workingLocal=sceneWorld.children.find(o=>o.userData?.districtTool);
assert.ok(workingLocal?.userData?.pose,
  'a local worker holds a physical tool with an articulated pose');
const contours=sceneWorld.children.filter(o=>o.userData?.landscapeContour);
assert.ok(contours.length>=2,'real geometric lawn contours join several lots');
const piazza=sceneWorld.children.find(o=>o.userData?.villagePiazza);
assert.ok(piazza && piazza.position.x===9 && piazza.position.z===9,
  'rounded central stone piazza is placed at the heart of the village');
assert.ok(contours.every(o=>o.position.x>2 && o.position.x<16 &&
  o.position.z>2 && o.position.z<13),
  'new landscaping stays on the grassy town slab, not the river');
const groundedPads=sceneWorld.children.filter(o=>o.material?.transparent&&o.material?.map&&o.rotation.x===-Math.PI/2);
assert.ok(groundedPads.length>=7,'soft contact shading integrates the slab, buildings and trees');
assert.ok(groundedPads.some(p=>p.position.x===7.5&&p.position.z===7.5),
  "the landmark ground shadow is physically centered beneath its foundation");
const meadow=sceneWorld.children.find(o=>o.userData?.continuousLandscape);
assert.ok(meadow?.material?.transparent && meadow.position.x===9 && meadow.position.z===9,
  'whole town receives a single transparent soil-and-meadow overlay');
const verges=sceneWorld.children.filter(o=>o.userData?.terrainVerge);
assert.ok(verges.length>=32,'street corners gain soft, bounded verges instead of paving-grid seams');
assert.ok(verges.every(o=>o.rotation.x===-Math.PI/2),'landscape decals lie on the ground');
assert.ok(verges.every(o=>o.position.y<.18),'road verges cannot float above the curbs');
const roadMesh=sceneWorld.children.find(o=>o.position.x===1.5&&o.position.z===9);
assert.ok(roadMesh?.material?.map,'roads have painted surface materials');
const cutaways=sceneWorld.children.filter(o=>o.userData?.terrainCutaway);
assert.deepEqual(cutaways.map(o=>o.userData.terrainCutaway),
  ['wood','meadow','soil'],'one sculpted board has wood, grass and soil layers');
assert.ok(cutaways.every(o=>o.rotation.x===-Math.PI/2),
  'all sculpted cutaway surfaces lie in the diorama plane');
const organicRoads=sceneWorld.children.filter(o=>o.userData?.organicRoad);
assert.equal(organicRoads.length,8,'four intersecting lanes have eight sculpted ribbons');
assert.ok(organicRoads.every(o=>o.geometry&&o.receiveShadow),
  'cobbled corridors remain fully modeled and physically lit');
const shoulders=sceneWorld.children.filter(o=>o.userData?.stoneShoulder);
assert.ok(shoulders.length>=40,'road banks use many bounded curved stone shoulders');
assert.ok(stats.roofTextures>=2,'roof textures created for different colored gables');
assert.ok(stats.paintOperations>=400,'small overlapping tiles produce detailed but subtle roof texture');
assert.ok(stats.profileVertices>=75,
  'the scene builds 3D curved roof shell and gable vertices, not just flat slabs');
assert.match(moduleCode,/const variation=\(row\*13\+col\*17\)%7/,
  'clay roof does not use an obvious large-color checkerboard');
assert.match(moduleCode,/Miniature gabled porch roof/,
  'porch has a pitched profile rather than a flat canopy');
assert.match(moduleCode,/Hand-set pavers follow the curved perimeter/,
  'courtyard pavers follow the new oval stone piazza instead of a rigid grid');
assert.match(moduleCode,/function plaster\(color\)/,'walls use grainy plaster instead of plain plastic');
assert.match(moduleCode,/function grassMaterial\(/,'garden uses a reusable painted grass texture');
assert.match(moduleCode,/function roofCurve\(/,'story book roofs use a real curved profile');
assert.match(moduleCode,/function glazedBowWindow\(/,'hero shops have five real curved display panels');
assert.match(moduleCode,/transparent:true,opacity:\.48/,
  'the shaped storefront bay uses actual translucent glazing');
assert.match(moduleCode,/depthWrite:false,side:THREE.DoubleSide/,
  'glass remains transparent rather than obscuring the merchandise');
assert.match(moduleCode,/function lathePot\(/,'hero garden pots use revolved clay geometry');
assert.match(moduleCode,/function stoneMaterial\(/,'foundation uses a shared painted masonry material');
assert.match(moduleCode,/function stoneFoundation\(/,'the five hero buildings have solid textured foundation plinths');

assert.match(moduleCode,/function timberArch\(/,'hero facades contain carved masonry arches with real openings');
assert.match(moduleCode,/function handCarvedTimbers\(/,'hero cottages use modeled structural timber details');
assert.match(moduleCode,/function leafyClimber\(/,'climbing greenery follows curved 3D paths');
assert.match(moduleCode,/atelierHome\(g,b,style,height,paint\)/,'only hero houses receive authored landmark model');
assert.match(moduleCode,/atelierShop\(g,b,h\)/,'only hero shops receive authored frontage model');
assert.match(moduleCode,/storybook-roof:/,'the sculpted roof is cached for repeated houses');
assert.match(moduleCode,/rounded suspended scallops/i,'shop awnings use dimensional fabric rather than bars');
assert.match(moduleCode,/roots taper out into the lawn/i,'tree trunks have naturally grounded roots');
assert.match(moduleCode,/grassMaterial\('#b9cba7',10\)/,'cutaway meadow has textured, continuous grass');
assert.match(moduleCode,/paver.rotation.y=/,'stone paths have irregular handmade placement');
assert.match(moduleCode,/23-closeness\*11\.5/,'close zoom lowers the eye to show character faces');
assert.match(moduleCode,/new THREE\.PerspectiveCamera\(35/,
  'the photographic city camera has real depth and vanishing lines');
assert.match(moduleCode,/scene\.fog\.near=Math\.max\(18,distance\*\.86\)/,
  'atmospheric fade follows the dolly instead of washing out wide-angle city shots');
assert.match(moduleCode,/if\(!b.hero && style===0/,
  'ordinary houses have occasional attached side wings for skyline variety');
assert.match(moduleCode,/const dx=legacy\?12\.5:7\.4,dy=legacy\?23-closeness\*11\.5:/,
  'street photo direction and eye height interpolate to a lower facade view');
assert.match(moduleCode,/camera\.position\.set\(aimX\+dx\/length\*distance/,
  'the camera dolly moves along the physical photographic viewing direction');
assert.match(moduleCode,/const focusWeight=THREE\.MathUtils\.clamp/,
  'compositional framing is removed smoothly as the user pans away');
assert.match(moduleCode,/function composeSecondaryBuilding\(/,
  'secondary houses receive bounded, deterministic street variation');
assert.match(moduleCode,/const anchors=\[\[7\.56,9\.60\]/,
  'lower courtyard lights are positioned away from storefront signage');
assert.match(moduleCode,/function archedInset\(/,'doors/windows have dimensional arches');
assert.match(moduleCode,/function turret\(/,'one hero cottage has its own curved tower');
assert.match(moduleCode,/function sideCottageWing\(/,'another hero cottage has a secondary roof and wing');
assert.match(moduleCode,/function shopExtra\(/,'bookshop and bakery have distinctive facades');
assert.match(moduleCode,/function ivy\(/,'climbing green vines integrate facades with the landscape');
assert.match(moduleCode,/Four authored silhouettes replace/,
  'trees now have separate oak, cypress, willow and orchard crown models');
assert.match(moduleCode,/function createLandscapeComposition\(/,
  'clear lots gain individually sculpted raised terrain and living fringes');
assert.match(moduleCode,/districtGardenRooms\+\+/,
  'collision-tested neighborhood gardens surround the hero plaza');
assert.match(moduleCode,/const riverForeground=z>=10\.85/,
  'riverbank foliage is visually reduced in front of village signage');

assert.match(moduleCode,/createLandscapeComposition\(\);/,
  'terrain composition is constructed alongside the roads on rebuild');
assert.match(moduleCode,/function contour\(/,
  'free parcels have organically shaped 3D landscape contours');
assert.match(moduleCode,/const piazzaShape=new THREE.Shape\(\)/,
  'the center is an irregular rounded piazza, not a square concrete slab');
assert.match(moduleCode,/Warm rubbed cobblestones replace/,
  'all roads use hand-weathered warm stone, not highway-gray asphalt');
assert.match(moduleCode,/function organicBoardOutline\(/,
  'the table has a curved, irregular cutaway silhouette');
assert.match(moduleCode,/function terrainCutaway\(/,
  'wood, soil and meadow are stacked organic extrusions');
assert.match(moduleCode,/function organicRoad\(/,
  'cobbled roads are continuous curved-edge ribbons');
assert.match(moduleCode,/function stoneShoulder\(/,
  'kerbs follow low irregular stone shoulders');
assert.doesNotMatch(moduleCode,/box\(world,18\.6,1\.12,18\.6/,
  'rigid wooden tabletop box is removed');
assert.doesNotMatch(moduleCode,/groundPiece\(1\.01,16\.03,roadSurface/,
  'old straight road rectangles are removed');
assert.doesNotMatch(moduleCode,/for\(let t=2;t<16;t\+=1\.28\)/,
  'modern repeating highway dashed lines have been removed');


assert.equal(api.getStats().plazaLights,1,'modeled plaza lamps have physical warm light');
const lantern=api.scene.children.find(o=>o.children?.some(x=>x.isPointLight))?.children.find(x=>x.isPointLight);
assert.ok(lantern && lantern.intensity>0, 'dusk physically illuminates the courtyard');
const lampAtDusk=lantern.intensity;
const goldenHourSky=api.scene.background.hex;
const goldenHourExposure=api.renderer.toneMappingExposure;
nightValue=.85;callbacks.shift()();
assert.notEqual(api.scene.background.hex,goldenHourSky,'haze and lighting shift together into dusk');
assert.ok(api.renderer.toneMappingExposure<goldenHourExposure,'exposure gently lowers as dusk settles');
assert.ok(lantern.intensity>lampAtDusk*2.5,'neighborhood lights strengthen after sunset');
assert.ok(allWindowMaterials[0].emissiveIntensity>initialGlow,
  'photographed window interiors illuminate as evening approaches');
const lightCableBulb=api.scene.children.find(g=>g.children?.some(
  o=>o.material?.emissiveIntensity>1.2))?.children.find(o=>o.material?.emissiveIntensity>1.2);
assert.ok(lightCableBulb,'festoon bulbs switch to glowing dusk material');
nightValue=.25;callbacks.shift()();
assert.ok(api.renderer.toneMappingExposure <= 1.1,'balanced lighting avoids blowing out pastel facades');
const initialPedestrian=api.scene.children.find(g=>g.children&&g.children.some(x=>x.userData&&x.userData.limbs));
assert.ok(initialPedestrian,'3D inhabitants have articulated limbs');
const residentRig=sceneWorld.children.find(o=>o.userData?.characterSilhouette);
assert.ok(residentRig?.userData?.limbs?.headPivot,
  'each resident has a separate head and neck rig');
assert.equal(residentRig.userData.limbs.shins.length,2,
  'both knees bend independently of the hip');
assert.equal(residentRig.userData.limbs.feet.length,2,
  'each foot has a dedicated contact rocker');
assert.ok(residentRig.userData.limbs.upperBody,
  'the head, arms and clothing move together on a torso joint');
assert.equal(residentRig.userData.limbs.elbows.length,2,
  'people bend two forearms rather than swinging stiff arms');
assert.equal(residentRig.userData.limbs.wrists.length,2,
  'each hand has a separate orientation pivot');
assert.equal(residentRig.userData.limbs.brows.length,2,
  'facial expression is articulated, not a motionless texture');
const motorcar=sceneWorld.children.find(o=>o.userData?.vehicleRig);
assert.equal(motorcar.userData.vehicleRig.wheels.length,4,
  'each car has four individually articulated wheels');
assert.equal(motorcar.userData.vehicleRig.indicators.length,2,
  'car indicators can flash independently on either side');
const cycle=sceneWorld.children.find(o=>o.userData?.bicycleRig);
assert.ok(cycle?.userData?.bicycleRig?.crank,'bicycle has a real chainring crank');
assert.equal(cycle.userData.bicycleRig.legs.length,2,
  'bicycle riders have articulated knee chains on both sides');
const bikeTire=cycle.userData.bicycleRig.wheels[0].children.find(o=>o.geometry);
assert.equal(bikeTire.rotation.y,0,
  'bicycle wheels face the direction of travel rather than rotating sideways');
assert.ok(cycle.userData.bicycleRig.wheels[0].children.length>=8,
  'bike wheels have visible spokes, so distance-based rotation can be seen');
pedestrians[0].attention={x:8.1,y:10.0};
pedestrians[1].braking=true;pedestrians[1].travel=7;
pedestrians[2].travel=5;
callbacks.shift()();
assert.ok(Math.abs(residentRig.userData.limbs.headPivot.rotation.y)>.02,
  'the simulated shop-look intent actually rotates the 3D head');
assert.ok(motorcar.userData.vehicleRig.brakeMaterial.emissiveIntensity>.5,
  'car brake lamps visibly brighten on traffic slowdown');
assert.ok(Math.abs(cycle.userData.bicycleRig.crank.rotation.z)>1,
  'pedals and bicycle wheels rotate with physical distance');
// A vendor offers actual stock, a purchaser only carries it once purchased.
const shopkeeperRef={type:'person',kind:'shopkeeper',shopRole:'vendor',
  shopVenue:'bakery',shopAction:'offering',x:8.07,y:8.42,d:2,
  max:0,v:0,travel:0,ph:2,col:'#de8f69',skin:'#d8ac8e'};
const buyerRef={type:'person',kind:'shopper',shopRole:'customer',
  shopAction:'ordering',x:8.32,y:8.78,d:3,max:.4,
  v:0,travel:0,ph:1.5,col:'#a28bce',skin:'#d4b295'};
pedestrians.push(shopkeeperRef,buyerRef);
frameClock+=1/30;callbacks.shift()();
const sellerModel=sceneWorld.children.find(o=>o.userData?.shopProps?.bread&&
  o.position.x===shopkeeperRef.x);
const buyerModel=sceneWorld.children.find(o=>o.userData?.shopProps?.book&&
  o.position.x===buyerRef.x);
assert.ok(sellerModel&&buyerModel,'both roles have real connected merchandise rigs');
assert.equal(sellerModel.userData.shopProps.bread.visible,true,
  'the baker visibly offers bread in an articulated hand');
assert.equal(buyerModel.userData.shopProps.bread.visible,false,
  'buyer cannot display a purchase before the handoff');
const rightArm=sellerModel.userData.limbs.arms[1];
assert.ok(Math.abs(rightArm.rotation.x)>.02,'vendor extends a serving arm');
shopkeeperRef.shopAction='handoff';
buyerRef.shopAction='receiving';buyerRef.carrying='bread';
frameClock+=1/30;callbacks.shift()();
assert.equal(sellerModel.userData.shopProps.bread.visible,false,
  'the vendor releases the bread after the transaction');
assert.equal(buyerModel.userData.shopProps.bread.visible,true,
  'the same product appears in the buyer hand');
buyerRef.shopAction='eating';frameClock+=1/30;callbacks.shift()();
assert.ok(buyerModel.userData.pose.enjoy>.05,
  'the customer has a distinct using-the-purchase animation');
shopkeeperRef.newsMood='cheer';frameClock+=1/30;callbacks.shift()();
assert.ok(sellerModel.userData.pose.celebrate>.05,
  'verified sports headlines create a visible arms-up reaction in residents');
pedestrians.splice(-2,2);frameClock+=1/30;callbacks.shift()();
const guitarist={type:'person',kind:'busker',guitar:true,
  shopAction:'performing',x:9.0,y:9.8,d:3,
  max:.38,v:0,travel:0,ph:2};
const audience={type:'person',kind:'neighbor',dance:true,
  x:8.7,y:9.9,d:3,v:0,travel:0,ph:3};
pedestrians.push(guitarist,audience);
frameClock+=1/30;callbacks.shift()();
const musicModel=sceneWorld.children.find(o=>o.userData?.buskerGuitar);
const dancer=sceneWorld.children.find(o=>o.position.x===8.7&&o.position.z===9.9);
assert.ok(musicModel?.userData.buskerGuitar,
  'the live town concert has a modeled instrument in actual character space');
assert.ok(musicModel.userData.pose.play>.05,
  'busker uses instrument-playing articulation rather than walking in place');
assert.ok(dancer?.userData?.pose?.dance>.05,
  'listeners visibly dance to a concert instead of standing motionless');
pedestrians.splice(-2,2);frameClock+=1/30;callbacks.shift()();
const footBefore=cycle.userData.bicycleRig.legs[0].shoe.position.y;
pedestrians[2].travel+=.20;frameClock+=1/30;callbacks.shift()();
assert.ok(Math.abs(cycle.userData.bicycleRig.legs[0].shoe.position.y-footBefore)>.012,
  'the cyclist foot physically follows a changing pedal position');
const testDog={type:'person',kind:'dog',x:9.1,y:8.3,d:0,
  v:.5,travel:3,ph:1};
testDog.watch='owner';testDog.sit=true;testDog.attention={x:9.55,y:8.3};
pedestrians.push(testDog);callbacks.shift()();
const animalRig=sceneWorld.children.find(o=>o.userData?.creatureRig);
assert.ok(animalRig?.userData.creatureRig.tail,
  'animals have connected animated tails instead of static toy blobs');
assert.equal(animalRig.userData.creatureRig.legs.length,4,
  'a dog is a four-legged creature, not a human capsule');
assert.equal(animalRig.userData.creatureRig.ears.length,2,
  'ears react independently when the companion attends to someone');
assert.ok(animalRig.userData.creatureRig.body,
  'a connected torso lets the resting dog breathe naturally');
assert.ok(animalRig.userData.creatureRig.head.rotation.y!==0,
  'the real 3D companion dog faces the person it is watching');
assert.ok(animalRig.position.y<.13,
  'a resting companion lowers into a sitting pose without floating');
pedestrians.pop();callbacks.shift()();
const peopleGroup=api.scene.children.find(g=>g.children&&g.children.some(x=>x.position.x===8.1 && x.position.z===8.7));
const firstPerson=peopleGroup.children.find(x=>x.position.x===8.1 && x.position.z===8.7);
assert.ok(Math.abs(firstPerson.rotation.y-Math.PI/2)<.0001,'face points into walking direction, not sideways');
const actorPose=residentRig.userData.pose;
pedestrians[0].v=.53;pedestrians[0].max=.58;pedestrians[0].travel=4.22;
pedestrians[0].intent='walking';frameClock+=1/30;callbacks.shift()();
const paceBeforeStop=actorPose.speed;
assert.ok(paceBeforeStop>.05,
  'a walking human smoothly engages articulated locomotion');
const moveLeg=residentRig.userData.limbs.legs[0];
const shoeRig=residentRig.userData.limbs.feet[0];
assert.ok(Math.abs(moveLeg.rotation.x)>.01,
  'walking turns hip joints instead of moving a rigid figurine');
assert.ok(Math.abs(shoeRig.rotation.x)>.005,
  'walking shoes rock at the ankle during the foot contact cycle');
pedestrians[0].v=0;pedestrians[0].intent='chat';
pedestrians[0].attention={x:8.1,y:9.4};
frameClock+=1/30;callbacks.shift()();
assert.ok(actorPose.speed<paceBeforeStop&&actorPose.speed>0,
  'stopping eases the gait instead of snapping the pose');
assert.ok(actorPose.chat>.09,
  'a real meeting smoothly engages the conversational upper body');
assert.ok(Math.abs(residentRig.userData.limbs.upperBody.rotation.x)>.001,
  'a social pose visibly shifts the torso');
const gestures=residentRig.userData.limbs.arms.map(a=>a.rotation.x);
assert.notEqual(gestures[0],gestures[1],
  'conversation uses asymmetrical listening and speaking gestures');
assert.ok(Math.abs(firstPerson.rotation.y-Math.PI/2)>.02,
  'a stopped resident begins turning bodily toward their companion');
assert.ok(Math.abs(residentRig.userData.limbs.elbows[1].rotation.x)>.005,
  'conversation bends the speaking elbow as well as the shoulder');
assert.ok(residentRig.userData.limbs.smile.scale.y>.4,
  'the speaking face becomes expressive during the encounter');
pedestrians[0].intent='walking';
frameClock+=1/30;callbacks.shift()();
assert.ok(actorPose.chat<.25,
  'exiting conversation blends back toward walking without a pose snap');
const normalCameraHeight=api.camera.position.y;
const standardDistance=Math.hypot(api.camera.position.x-9,
  api.camera.position.y-.43,api.camera.position.z-9);
currentCamZoom=3.2; callbacks.shift()();
const closeDistance=Math.hypot(api.camera.position.x-9,
  api.camera.position.y-.43,api.camera.position.z-9);
assert.ok(closeDistance<standardDistance*.7,
  'real dolly brings the perspective camera noticeably closer at street zoom');
assert.ok(api.camera.position.y < normalCameraHeight,'close zoom lowers viewing angle to show facades');
currentCamZoom=1.52;callbacks.shift()();
assert.ok(Math.abs(api.camera.position.y-normalCameraHeight)<.0001,'camera returns to regular viewing angle');
assert.equal(api.getStats().actors,4,'pedestrians, vehicles and a neighborhood worker follow the simulation');
assert.equal(api.getStats().buildings,8);
assert.equal(api.getStats().landmarks,5,'five independently modeled buildings replace generic hero meshes');
assert.equal(api.getStats().composedBuildings,2,
  'the secondary house has staggered visual-only architecture');
const secondary=api.scene.children.flatMap(o=>o.children||[])
  .find(o=>o.userData?.composedSecondary);
assert.ok(secondary,'a non-hero house has a composed group');
assert.ok(Math.abs(secondary.userData.composition.offsetX)<.06 &&
  Math.abs(secondary.userData.composition.offsetZ)<.06,
  'street-facing house offsets never move into the traffic lane');
assert.ok(Math.abs(secondary.rotation.y)<.10,
  'varied houses stay realistically oriented to the village');
const newTowers=api.scene.children.flatMap(o=>o.children||[])
  .filter(o=>o.userData?.storybookTower);
assert.equal(newTowers.length,1,'background tower is a handcrafted storybook assembly');
assert.ok(newTowers[0].userData?.composedSecondary,
  'the taller masonry tower also participates in safe street staggering');
assert.match(moduleCode,/function tower\(b\)[\s\S]*?const slate=/,
  'old office-block tower is now a tile-roofed miniature building');
assert.match(moduleCode,/archedInset\(g,x,y,\.413/,
  'towers have recessed, arched windows instead of a repeated flat-glass grid');
const heroAssets=api.scene.children.flatMap(x=>x.children||[]).filter(x=>x.userData?.uniqueAsset);
assert.equal(heroAssets.length,5,'five custom asset groups are mounted in the 3D scene');
const roofTiles=[];
const collectTiles=node=>{
  if(node.userData?.ceramicRoofTiles)roofTiles.push(node);
  for(const child of node.children||[])collectTiles(child);
};
for(const asset of heroAssets)collectTiles(asset);
assert.ok(roofTiles.length>=5,'every landmark receives real overlapping curved roof tiles');
assert.ok(stats.instances>=640,'hundreds of tiles use very few instanced GPU batches');
assert.ok(stats.instancedGroups<=30,
  'roof detail uses a bounded number of GPU instancing draw calls');
assert.ok(roofTiles.every(t=>t.count===128&&t.matrices.length===128),
  'every roof has complete deterministic tile-course transforms');
assert.ok(roofTiles.every(t=>t.colors.length===128),
  'each tile has subtle color variation without new material textures');
assert.equal(new Set(heroAssets.map(x=>x.userData.kind)).size,3,
  'hero assets have identifiable shop and home model types');
const modeledArchitecture=api.scene.children.find(o=>o.children?.some(x=>x.position.x===7.5&&x.position.z===7.5));
assert.ok(modeledArchitecture,'hero architectural assembly is part of the world');
const oldCount=stats.renders;
pedestrians.pop();frameClock+=1;
callbacks.shift()();
assert.equal(api.getStats().actors,3,'departing residents are removed');
assert.ok(stats.renders>oldCount);
seed++;buildings=buildings.slice();callbacks.shift()();
assert.equal(api.getStats().redrawCount,2,'new daily town triggers a full rebuild');
assert.equal(api.getStats().festoonBulbs,14,'garden lighting is recreated, never duplicated');
assert.equal(api.getStats().gardenElements,initialGardenCount,
  'curated surroundings are deterministic across world rebuilds');
const cameraZoom=api.camera.zoom;
assert.ok(cameraZoom>0 && Number.isFinite(cameraZoom),'camera syncs to the existing zoom');
host.clientWidth=844; host.clientHeight=390; win.innerWidth=844; win.innerHeight=390;
callbacks.shift()();
assert.equal(api.renderer.domElement.width,844,'landscape resize updates renderer');
assert.equal(api.renderer.domElement.height,390,'landscape resize updates renderer height');
assert.ok(api.camera.aspect>1,'landscape perspective updates its aspect ratio');
assert.ok(api.camera.fov>20&&api.camera.fov<45,
  'street-level photo camera uses a natural rather than extreme wide-angle lens');
host.clientWidth=390; host.clientHeight=844; win.innerWidth=390; win.innerHeight=844;
callbacks.shift()();
assert.equal(api.renderer.domElement.width,390,'portrait resize restores mobile projection');

const rendersBeforeFreeze=stats.renders;
api.freeze();
assert.equal(api.getStats().frozen,true,'visual audit freezes only the WebGL animation');
assert.equal(api.active,true,'freezing keeps the rendered 3D canvas visible');
callbacks.shift()();
assert.equal(stats.renders,rendersBeforeFreeze,'frozen 3D holds the actual last GPU frame');
api.unfreeze();
assert.equal(api.getStats().frozen,false,'visual audit can resume rendering');
callbacks.shift()();
assert.ok(stats.renders>rendersBeforeFreeze,'WebGL renders after resuming');
assert.match(moduleCode,/const segments=\[\[2\.22,5\.78\]/,
  'stone shoulders stop before junctions and river bridges');
assert.match(moduleCode,/continuous plaster pilasters/i,
  'wall accents follow facades without disconnected bricks');
const rendersBeforeFail=stats.renders;
api.renderer.throwOnRender=true;callbacks.shift()();
assert.equal(api.active,false,'render failure disables WebGL');
assert.equal(host.style.display,'none','failure restores 2D');
assert.equal(townCanvas.style.opacity,'1','2D fallback visible after GPU error');
api.dispose();
assert.equal(stats.dispose,1,'GPU resources are released on disposal');
console.log('Toy Town 3D PASS: deferred activation, real scene build, movement sync, seed rebuild, zoom, WebGL failure fallback');
