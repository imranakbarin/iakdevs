/* Toy Town 3D — real WebGL miniature diorama.
 * Reads the existing ToyTown simulation; it never owns traffic, date, news,
 * pan/zoom gestures, or lifecycle. The classic Canvas remains the fallback.
 * THREE and RoundedBoxGeometry are passed in by the module loader. */
export function mountToyTown3D(THREE, RoundedBoxGeometry, town, host, options = {}) {
  if (!town || !host || !window.WebGL2RenderingContext) return null;
  const desktop = () => window.innerWidth >= 700;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, desktop() ? 1.8 : 1.4));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d6edf4');
  scene.fog = new THREE.Fog('#d6edf4', 25, 65);
  const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 120);
  const hemisphere = new THREE.HemisphereLight('#fff8e4', '#8298ac', 2.15);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff1d3', 3.25);
  sun.position.set(-11, 27, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(desktop() ? 1024 : 512, desktop() ? 1024 : 512);
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 70;
  sun.shadow.bias = -.00035;
  sun.shadow.normalBias = .028;
  sun.shadow.radius = 3;
  sun.target.position.set(9,0,9);
  scene.add(sun,sun.target);
  const materialCache = new Map(), geometryCache = new Map();
  const world = new THREE.Group(); scene.add(world);
  const actors = new Map();
  let worldSeed = null, worldBuildings = null, worldPropCount = 0;
  let stopped = false, raf = 0, frames = 0, redrawCount = 0, lastSize = '', lastFrameAt = 0;
  const TAU = Math.PI * 2, LINES = [1,6,11,16];
  const rgb = (c) => new THREE.Color(c);
  const mat = (hex, rough = .82, emissive = null) => {
    const key = String(hex) + ':' + rough + ':' + (emissive || '');
    if (!materialCache.has(key)) {
      materialCache.set(key, new THREE.MeshStandardMaterial({
        color: hex, roughness: rough, metalness: 0.025,
        ...(emissive ? {emissive, emissiveIntensity: .45} : {})
      }));
    }
    return materialCache.get(key);
  };
  const shades = ['#f7e0c3','#d1e7dc','#efd3be','#c7dce7','#eddcbb'];
  const geo = (kind, ...dims) => {
    const key = kind + ':' + dims.join(':');
    if (!geometryCache.has(key)) {
      let shape;
      if (kind === 'round') shape = new RoundedBoxGeometry(dims[0],dims[1],dims[2],2,Math.min(dims[0],dims[1],dims[2])*.14);
      else if (kind === 'box') shape = new THREE.BoxGeometry(...dims);
      else if (kind === 'sphere') shape = new THREE.SphereGeometry(dims[0],12,9);
      else if (kind === 'ball') shape = new THREE.IcosahedronGeometry(dims[0],1);
      else if (kind === 'cylinder') shape = new THREE.CylinderGeometry(...dims,10);
      else if (kind === 'torus') shape = new THREE.TorusGeometry(...dims,7,12);
      else if (kind === 'plane') shape = new THREE.PlaneGeometry(...dims);
      geometryCache.set(key,shape);
    }
    return geometryCache.get(key);
  };
  const object = (parent, geometry, material, x=0,y=0,z=0, cast=true) => {
    const o = new THREE.Mesh(geometry,material);
    o.position.set(x,y,z); o.castShadow=cast; o.receiveShadow=true; parent.add(o); return o;
  };
  const box = (p,w,h,d,col,x=0,y=0,z=0,rounded=true) =>
    object(p,geo(rounded?'round':'box',w,h,d),typeof col === 'string'?mat(col):col,x,y,z);
  const ball = (p,r,col,x=0,y=0,z=0) => object(p,geo('sphere',r),typeof col==='string'?mat(col):col,x,y,z);
  const cylinder = (p,rt,rb,h,col,x=0,y=0,z=0) =>
    object(p,geo('cylinder',rt,rb,h),typeof col==='string'?mat(col):col,x,y,z);
  const groundPiece = (w,d,col,x,z,y=.025) => {
    const o=box(world,w,.065,d,col,x,y,z);
    o.castShadow=false; return o;
  };
  const rng = (i, j=0) => {
    let x = Math.imul((i|0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((j|0)+0x632be5ab, 0xc2b2ae35);
    x = Math.imul(x ^ (x>>>15),0x27d4eb2d); return (x>>>0)/4294967296;
  };
  const fabric = (parent, x,y,z,color,w=.46,d=.22) => {
    const canopy=box(parent,w,.055,d,color,x,y,z);
    canopy.rotation.x=-.16;
    for(let n=0;n<6;n++){
      const stripe=box(parent,w/13,.053,d,'#fff4da',x-w*.37+n*w*.145,y+.016,z);
      stripe.rotation.x=-.16;
    }
  };
  function sign(parent, label, x,y,z,w, ink='#575049',paper='#fff0d0'){
    const cvs=document.createElement('canvas');cvs.width=256;cvs.height=96;
    const cx=cvs.getContext('2d');cx.fillStyle=paper;
    cx.beginPath();cx.roundRect(3,4,250,88,16);cx.fill();
    cx.strokeStyle='#b9a584';cx.lineWidth=5;cx.stroke();
    cx.fillStyle=ink;cx.textAlign='center';cx.textBaseline='middle';
    cx.font='bold 33px Georgia,serif';cx.fillText(label,128,49,238);
    const tx=new THREE.CanvasTexture(cvs);tx.colorSpace=THREE.SRGBColorSpace;
    const mesh=object(parent,geo('plane',w,w*96/256),new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide}),x,y,z,false);
    mesh.userData.ownedTexture=tx;
    return mesh;
  }
  function pane(parent,x,y,z,w,h,nightColor='#ffd99a',side=false){
    const group=new THREE.Group();group.position.set(x,y,z);
    if(side)group.rotation.y=Math.PI/2;
    parent.add(group);
    box(group,w+.055,h+.065,.038,'#fff4db');
    const pane=box(group,w,h,.043,mat('#a9dce2',.19,'#80582f'),0,0,.028);
    pane.userData.windowGlass=true; pane.userData.nightColor=nightColor;
    box(group,.012,h+.014,.05,'#f6f3dd',0,0,.055);
    box(group,w+.012,.012,.05,'#f6f3dd',0,0,.055);
    box(group,w+.095,.032,.078,'#d9c0a2',0,-h/2-.029,.042);
    return pane;
  }
  function roof(g,color,top,edge=.44){
    const dark=mat(color,.91);
    const tan=Math.atan2(.35,.49);
    // Two actual sloping roof meshes with a visible ridge. Not painted polygons.
    for(const side of [-1,1]){
      const slab=box(g,.66,.078,1.04,dark,side*.255,top+.20,0);
      slab.rotation.z=-side*tan;
      for(let row=0;row<4;row++){
        const t=(row+.5)/4;
        const x=side*(.07+t*.38), y=top+.35*(1-t)+.045;
        const ridge=box(g,.025,.022,.96,mat(side<0?'#fff2d4':'#ddae99'),x,y,0);
        ridge.rotation.z=-side*tan;
      }
    }
    box(g,.095,.09,1.06,mat('#f7e5cf'),0,top+.375,0);
    // Gable triangle occupies the opening under the two roof planes.
    const shape=new THREE.Shape();shape.moveTo(-.46,0);shape.lineTo(.46,0);shape.lineTo(0,.37);shape.closePath();
    const key='gable';let geometry=geometryCache.get(key);
    if(!geometry){
      geometry=new THREE.ExtrudeGeometry(shape,{depth:.77,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:1,steps:1});
      geometry.translate(0,0,-.385);geometryCache.set(key,geometry);
    }
    object(g,geometry,mat('#ebcfb2'),0,top-.035,0);
  }
  function planter(g,x,z,variant=0){
    box(g,.15,.15,.15,'#c98f75',x,.13,z);
    for(let k=0;k<3;k++){
      const xx=x+(k-1)*.043;
      const green=ball(g,.083,k%2?'#5b9776':'#8dbd7a',xx,.26,z);
      green.scale.set(1,.8,1);
      const bloom=ball(g,.024,k%2?'#e8a5a4':'#ffebc9',xx,.32,z+.04);
    }
  }
  function home(b){
    const g=new THREE.Group();g.position.set(b.x+.5,0,b.y+.5);world.add(g);
    const height=Math.min(1.4,Math.max(.88,b.h/30));
    const tint=b.wall||shades[(b.x+b.y)%shades.length];
    box(g,.79,.09,.8,'#cbb59a',0,.045,0);
    box(g,.76,height,.76,tint,0,.10+height/2,0);
    const cap=.1+height;
    roof(g,b.roof||'#ba7355',cap);
    // Front porch and steps physically touch the entry.
    box(g,.32,.085,.25,'#dbc6a9',.21,.09,.51);
    box(g,.21,.39,.055,'#94684f',.21,.295,.41);
    box(g,.25,.42,.028,'#f4e3cc',.21,.315,.444);
    box(g,.175,.34,.035,'#99714e',.21,.28,.467);
    ball(g,.016,'#e9ca7d',.27,.32,.489);
    pane(g,-.20,.65,.405,.21,.25);
    pane(g,.415,.65,-.11,.23,.24,'#ffd99a',true);
    const sill=box(g,.25,.025,.07,'#bb9776',-.20,.493,.46);
    for(let j=0;j<3;j++)ball(g,.028,j===1?'#e99d9e':'#f6dfbc',-.27+j*.07,.52,.46);
    box(g,.12,.34,.12,'#b27966',-.21,cap+.15,-.12);
    box(g,.15,.06,.15,'#eac4a0',-.21,cap+.36,-.12);
    if(b.hero){
      planter(g,-.29,.46);planter(g,.38,.31);
      // picket hedge on one side of the entry with no roof penetration
      for(let k=0;k<4;k++)ball(g,.10,'#7ba780',-.37,.20,-.24+k*.16);
    }
  }
  function shop(b){
    const g=new THREE.Group();g.position.set(b.x+.5,0,b.y+.5);world.add(g);
    const h=Math.max(1.08,b.h/33), color=b.wall||'#e6d7bd';
    box(g,.84,.11,.87,'#c2b09c',0,.055,0);
    box(g,.79,h,.79,color,0,.11+h/2,0);
    roof(g,b.awning||'#9c6d60',h+.11);
    for(const x of [-.225,.225])pane(g,x,.50,.411,.29,.48);
    pane(g,.42,.70,-.14,.24,.32,'#ffd0a2',true);
    box(g,.19,.57,.055,'#8e715e',.03,.40,.417);
    box(g,.16,.43,.038,'#f6ead7',.03,.38,.448);
    ball(g,.016,'#eecb7c',.084,.37,.470);
    fabric(g,0,.89,.56,b.awning||'#bc6e63',.90,.31);
    sign(g,b.name||'CAFE',0,h+.03,.448,.66,b.awning||'#7b5442');
    planter(g,-.39,.50);planter(g,.37,.53);
    // Storefront merch stays behind glass; no floating signs.
    if(b.name==='BAKERY'){
      for(let i=0;i<3;i++)ball(g,.058,'#c69459',-.31+i*.11,.30,.46);
    }else if(b.name==='BOOKS'){
      for(let i=0;i<4;i++)box(g,.048,.11,.035,['#d68d88','#79a3a6','#e6be81','#947ca6'][i],
        -.34+i*.09,.29,.464);
    }
  }
  function tower(b){
    const x=b.x+.5,z=b.y+.5,h=Math.min(2.65,Math.max(1.0,b.h/45));
    box(world,.77,h,.76,b.wall||'#bbcad7',x,h/2,z);
    box(world,.84,.10,.83,'#dbe3e0',x,h+.04,z);
    for(let row=0;row<Math.max(2,Math.floor(h/.33));row++)
      for(const i of [-.22,0,.22]) {
        const pane=box(world,.105,.18,.032,mat('#b5d7e6',.25,'#617e85'),
          x+i,.3+row*.33,z+.39);
        pane.userData.windowGlass=true;
      }
    box(world,.27,.22,.30,'#cbd2d4',x+.2,h+.20,z-.17);
  }
  function fireStation(b){
    const x=b.x+.5,z=b.y+.5,h=.88;
    box(world,.90,h,.79,'#d06a5b',x,.45,z);
    box(world,1,.12,.91,'#f6e4d2',x,.92,z);
    box(world,.65,.49,.07,'#6a6870',x,.32,z+.41);
    sign(world,'FIRE',x,.85,z+.46,.55,'#9b4339');
  }
  function tree(p,i){
    const x=p.x,z=p.y,sc=p.s||1;
    const g=new THREE.Group();g.position.set(x,0,z);world.add(g);g.scale.setScalar(sc);
    const trunk=cylinder(g,.055,.075,.51,'#83694f',0,.30,0);
    trunk.rotation.z=(rng(i,27)-.5)*.10;
    for(let k=0;k<5;k++){
      const a=k*TAU/5+.3,rad=k===4?0:.22;
      const col=['#7eb593','#a0c99d','#6ba28b','#c5d9a3','#8dbfa1'][k];
      const puff=ball(g,k===4?.27:.25,col,Math.cos(a)*rad,.79+(k%2)*.11,Math.sin(a)*rad);
      puff.scale.set(1.05,.94,1.05);
    }
  }
  function littleFlowers(x,z,i){
    for(let n=0;n<3;n++){
      const a=rng(i,n+5)*TAU,r=.09+.15*rng(i,10+n);
      const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;
      cylinder(world,.009,.01,.075,'#61976c',px,.074,pz);
      ball(world,.029,n%2?'#f1e7bb':'#e3a1a7',px,.12,pz);
    }
  }
  function bench(p){
    const x=p.x,z=p.y;
    for(let k of [-.17,.17]){
      box(world,.045,.17,.055,'#6b786e',x+k,.10,z-.10);
      box(world,.045,.17,.055,'#6b786e',x+k,.10,z+.10);
    }
    box(world,.45,.045,.29,'#b77f5c',x,.20,z);
    box(world,.45,.20,.045,'#c7956d',x,.33,z-.125);
    for(let j of [-.10,.10])box(world,.43,.016,.022,'#f0cda4',x,.34+j*.52,z-.100);
  }
  function lamp(p){
    cylinder(world,.027,.040,.92,'#5c7274',p.x,.48,p.y);
    cylinder(world,.08,.065,.08,'#455e64',p.x,.92,p.y);
    const orb=ball(world,.096,mat('#fff1cf',.34,'#ffdb9a'),p.x,1.01,p.y);
    orb.userData.lamp=true;
    cylinder(world,.115,.11,.055,'#526d6d',p.x,1.12,p.y);
  }
  function smallProps(p,i){
    const k=p.kind;
    if(k==='tree')tree(p,i);
    else if(k==='hero-shrub') {
      box(world,.22,.16,.22,'#c5a080',p.x,.09,p.y);
      ball(world,.18,p.col||'#79a27c',p.x,.26,p.y);
    }
    else if(k==='hero-bench'||k==='bench')bench(p);
    else if(k==='hero-lamp')lamp(p);
    else if(k==='hero-table') {
      cylinder(world,.022,.026,.32,'#8f785c',p.x,.20,p.y);
      cylinder(world,.25,.25,.055,'#d0a579',p.x,.38,p.y);
      ball(world,.048,'#fff4d8',p.x,.43,p.y);
    }
    else if(k==='hero-mail'){
      cylinder(world,.03,.03,.28,'#617d81',p.x,.16,p.y);
      box(world,.20,.20,.17,'#7799ac',p.x,.39,p.y);
      box(world,.13,.015,.02,'#f3e4cc',p.x,.40,p.y+.10);
    }
    else if(k==='hero-rack'){
      for(let n=0;n<3;n++){
        const h=object(world,geo('torus',.13,.017),mat('#8a9899'),p.x+(n-1)*.16,.19,p.y);
        h.rotation.y=Math.PI/2;
      }
    }
    else if(k==='fountain'){
      cylinder(world,.50,.55,.19,'#e6d9bc',p.x,.11,p.y);
      cylinder(world,.43,.43,.04,'#75b9cb',p.x,.225,p.y);
      cylinder(world,.07,.11,.35,'#eddfc7',p.x,.35,p.y);
      const w=ball(world,.13,mat('#d6f4f2',.15,'#7197a8'),p.x,.52,p.y);
      w.scale.set(.9,1.3,.9);
    }
    else if(k==='stadium'){
      cylinder(world,1.42,1.55,.28,'#d5c5b0',p.x,.15,p.y);
      cylinder(world,1.12,1.15,.035,'#6fae83',p.x,.32,p.y);
      const rings=object(world,geo('torus',1.32,.065),mat('#f5e5d0'),p.x,.34,p.y);
      rings.rotation.x=Math.PI/2;
    }
    else if(k==='launchpad'){
      cylinder(world,.75,.82,.16,'#ddc9b3',p.x,.09,p.y);
      const r=cylinder(world,.115,.15,1.55,'#f1e5d4',p.x,.87,p.y);
      cylinder(world,.02,.13,.32,'#c85f57',p.x,1.81,p.y);
      for(const t of [-1,1])box(world,.075,.25,.19,'#d66d58',p.x+t*.18,.25,p.y);
    }
    else if(k==='stage'||k==='lab'||k==='market'||k==='zoo') {
      box(world,2.1,.24,1.7,'#d2bfa7',p.x,.12,p.y);
      for(const off of [-.7,.7])cylinder(world,.055,.055,.85,'#9d8268',p.x+off,.58,p.y-.65);
      box(world,1.75,.08,1.5,'#f1e2c7',p.x,1.05,p.y);
    }
    else if(k==='flowers')littleFlowers(p.x,p.y,i);
    else if(k==='times'){
      // Newsstand stays legible and anchored to the outskirts.
      box(world,.7,.08,.18,'#eddcc1',p.x,.82,p.y);
      box(world,.63,.55,.07,'#fff8e7',p.x,1.13,p.y);
      cylinder(world,.035,.045,.82,'#697677',p.x-.26,.42,p.y);
      cylinder(world,.035,.045,.82,'#697677',p.x+.26,.42,p.y);
      sign(world,'TOWN TIMES',p.x,1.16,p.y+.05,.6);
    }
  }
  function createGround(){
    box(world,18.6,1.12,18.6,'#907457',9,-.60,9);
    box(world,18.35,.20,18.35,'#b6c9a1',9,.025,9);
    // Water sits below streets; bridges cross at the existing four lanes.
    groundPiece(18.02,1.97,'#70b9c7',9,14,.105);
    const isRoad = v=>LINES.includes(v);
    for(const n of LINES){
      groundPiece(1.01,16.03,'#68777e',n+.5,9,.132);
      groundPiece(16.03,1.01,'#68777e',9,n+.5,.143);
      for(let t=2;t<16;t+=1.28){
        groundPiece(.035,.36,'#f3e8d6',n+.5,t+.5,.183);
        groundPiece(.36,.035,'#f3e8d6',t+.5,n+.5,.190);
      }
      // River bridges have pale stone shoulders, anchored to the same lanes.
      groundPiece(1.12,2.05,'#a99f8c',n+.5,14,.17);
      groundPiece(.92,2.06,'#78868a',n+.5,14,.22);
      for(const side of [-.52,.52]){
        box(world,.052,.22,2.08,'#d8d1bf',n+.5+side,.29,14);
      }
    }
    // The central hero has physically raised pavements, stone squares and grass.
    for(let yy=7;yy<=10;yy++)for(let xx=7;xx<=10;xx++){
      const middle=xx>7&&xx<10&&yy>7&&yy<10;
      groundPiece(.97,.97,middle?'#e9d9ba':'#96b99c',xx+.5,yy+.5,.179);
      if(middle)for(let p=0;p<3;p++){
        groundPiece(.01,.9,'#d5c7b1',xx+.18+p*.29,yy+.5,.221);
        groundPiece(.9,.012,'#d5c7b1',xx+.5,yy+.19+p*.3,.222);
      }
    }
    // Four grounded zebra stripes on the actual southern road.
    for(let i=0;i<4;i++)groundPiece(.088,.71,'#f8eedb',8.20+i*.17,11.5,.240);
    // Riverside edge, small paths; never grow trees out of water.
    for(let i=1;i<17;i++){
      if(!isRoad(i)) {
        groundPiece(.85,.15,'#e1d3b7',i+.5,12.90,.17);
        littleFlowers(i+.35,12.63,i*17);
      }
    }
    // Decorative tiny lawns in free lots use deterministic coordinates.
    for(let yy=2;yy<12;yy++)for(let xx=2;xx<16;xx++){
      if(isRoad(xx)||isRoad(yy)||xx>=7&&xx<=10&&yy>=7&&yy<=10)continue;
      const r=rng(xx,yy);
      if(r<.18)littleFlowers(xx+.22,yy+.36,xx*47+yy);
      else if(r>.91){
        const stone=ball(world,.095,'#cdbda4',xx+.19,.08,yy+.72);
        stone.scale.set(1.2,.34,.9);
      }
    }
  }
  function rebuild(){
    while(world.children.length)world.remove(world.children[0]);
    for(const [ref,obj] of actors){obj.group.parent?.remove(obj.group);}
    actors.clear();
    createGround();
    for(const b of town.buildings()){
      if(b.kind==='house')home(b);
      else if(b.kind==='shop')shop(b);
      else if(b.kind==='tower')tower(b);
      else if(b.kind==='fire')fireStation(b);
      else if(b.kind==='site'){
        box(world,1.55,.42,1.5,'#dac9ac',b.x+.5,.24,b.y+.5);
        box(world,.4,.55,.43,'#bda78b',b.x+.7,.75,b.y+.6);
      }
    }
    const ps=town.props();
    for(let i=0;i<ps.length;i++)smallProps(ps[i],i);
    worldSeed=town.debug().seed;worldBuildings=town.buildings();
    worldPropCount=ps.length;
    redrawCount++;
  }
  function person(ref){
    const g=new THREE.Group();
    const skin=ref.skin||'#dbab86',coat=ref.col||'#d6a3a0';
    // Rounded head and tapered torso read as a small character at close zoom.
    const torso=ball(g,.095,coat,0,.26,0);
    torso.scale.set(.92,1.2,.74);
    const neck=cylinder(g,.031,.032,.055,skin,0,.374,0);
    ball(g,.071,skin,0,.442,0);
    const hair=ball(g,.076,ref.hair||'#5b4639',0,.485,-.008);
    hair.scale.set(1,.55,1);
    for(const sx of [-1,1]){
      ball(g,.012,'#3d4341',sx*.027,.454,.066);
    }
    const legs=[],arms=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.041,.178,0);
      cylinder(leg,.024,.026,.15,'#60717b',0,-.074,0);
      box(leg,.062,.035,.102,'#5a524b',0,-.154,.027);
      g.add(leg);legs.push(leg);
      const arm=new THREE.Group();arm.position.set(side*.097,.327,0);
      cylinder(arm,.021,.022,.132,coat,0,-.076,0);
      ball(arm,.027,skin,0,-.15,0);g.add(arm);arms.push(arm);
    }
    if(ref.hat){
      const cap=ball(g,.076,ref.hat==='beanie'?'#b18cbd':'#588f9e',0,.505,0);
      cap.scale.set(1,.56,1);
    }
    if(ref.bag)box(g,.06,.15,.12,'#ae8966',-.106,.24,-.038);
    g.userData.limbs={legs,arms};
    g.scale.setScalar(ref.heroResident?1.1:1);
    return g;
  }
  function car(ref){
    const g=new THREE.Group(), col=ref.col||'#a0bfc7';
    const bus=ref.kind==='bus';
    const len=bus?.70:.47;
    box(g,len,.18,.33,col,0,.22,0);
    box(g,bus?.57:.27,bus?.22:.16,.31,mat('#a8d8df',.25,'#4b6975'),-.03,bus?.38:.36,0);
    if(!bus)box(g,.25,.065,.33,col,-.035,.47,0);
    for(const xx of [-len*.32,len*.32])for(const zz of [-.187,.187]){
      const wheel=cylinder(g,.068,.068,.038,'#404950',xx,.16,zz);
      wheel.rotation.x=Math.PI/2;
      const hub=cylinder(g,.036,.036,.043,'#bec7c9',xx,.16,zz);
      hub.rotation.x=Math.PI/2;
    }
    for(const z of [-.113,.113]){
      ball(g,.025,mat('#fff6ca',.3,'#f8df9d'),len*.49,.27,z);
      ball(g,.020,'#d76f68',-len*.49,.27,z);
    }
    return g;
  }
  function bicycle(ref){
    const g=new THREE.Group();
    for(const x of [-.16,.16]){
      const tire=object(g,geo('torus',.105,.018),mat('#4e5d5c'),x,.15,0);
      tire.rotation.y=Math.PI/2;
    }
    const frame=box(g,.28,.028,.04,ref.col||'#7cb2ad',0,.23,0);
    frame.rotation.z=.18;
    const torso=ball(g,.078,ref.col||'#b88d86',-.018,.47,0);torso.scale.set(.75,1.3,.7);
    ball(g,.063,ref.skin||'#d6ae87',-.04,.63,0);
    return g;
  }
  function actor(ref){
    const g=ref.kind==='bike'?bicycle(ref):ref.type==='car'?car(ref):person(ref);
    g.position.set(ref.x,0.16,ref.y);
    world.add(g);
    actors.set(ref,{group:g,kind:ref.kind==='bike'?'bike':ref.type==='car'?'car':'person'});
  }
  function syncActors(){
    const live=new Set(town.movers());
    for(const [ref,item] of actors)if(!live.has(ref)){
      item.group.parent?.remove(item.group);actors.delete(ref);
    }
    for(const ref of live) {
      if(!actors.has(ref))actor(ref);
      const item=actors.get(ref),g=item.group;
      const lane=ref.lane||0;
      const d=ref.d||0;
      const off=(d===0||d===1)?{x:0,z:lane}:{x:lane,z:0};
      const path=!!ref.path;
      const desiredX=ref.x+(path?0:off.x),desiredZ=ref.y+(path?0:off.z);
      g.position.set(desiredX,ref.sit&&item.kind==='person'?.11:.16,desiredZ);
      const a=Number.isFinite(ref.heading)?-ref.heading:[0,Math.PI,-Math.PI/2,Math.PI/2][d];
      g.rotation.y=a;
      const limbs=g.userData.limbs;
      if(limbs){
        const moving=!!ref.v&&ref.v>.035&&!ref.sit&&(!ref.stopUntil||town.debug().clock>=ref.stopUntil);
        const step=moving?Math.sin((ref.travel||0)*17+(ref.ph||0))*.44:0;
        limbs.legs[0].rotation.x=step;limbs.legs[1].rotation.x=-step;
        limbs.arms[0].rotation.x=-step*.85;limbs.arms[1].rotation.x=step*.85;
        if(ref.waveUntil&&town.debug().clock<ref.waveUntil)limbs.arms[1].rotation.z=-1.6;
        else limbs.arms[1].rotation.z=0;
        g.position.y+=moving?Math.abs(Math.sin((ref.travel||0)*17))*.012:0;
      }
    }
  }
  function light(time){
    const dark=THREE.MathUtils.clamp(time,0,1);
    hemisphere.intensity=2.05-dark*.85;
    sun.intensity=3.05-dark*1.65;
    sun.color.set(dark>.5?'#f9c59f':'#fff0d7');
    scene.background.set(dark>.52?'#a3b9ce':'#d6edf4');
    scene.fog.color.copy(scene.background);
    for(const p of materialCache.values()){
      if(p.emissive && p.emissive.r>.03) p.emissiveIntensity=.14+dark*1.25;
    }
  }
  function resize(){
    const w=Math.max(1,host.clientWidth||window.innerWidth);
    const h=Math.max(1,host.clientHeight||window.innerHeight);
    const sz=w+'x'+h;
    if(sz===lastSize)return;
    lastSize=sz;renderer.setSize(w,h,false);
    const a=w/h;
    camera.left=-14*a;camera.right=14*a;
    camera.top=14;camera.bottom=-14;
    camera.updateProjectionMatrix();
  }
  function syncCamera(){
    const state=town.debug(),v=state.cam;
    const aspect=renderer.domElement.width/Math.max(1,renderer.domElement.height);
    const fit=Math.min(1,Math.max(.30,aspect*28/27));
    const t=THREE.MathUtils.clamp((v.z-(town.fitView?.()||.475))/.52,0,1);
    const scaled=v.z*(desktop()?1.5:1.58);
    camera.zoom=THREE.MathUtils.lerp(fit,scaled,t);
    camera.position.set(v.x+18,23,v.y+18);
    camera.lookAt(v.x,.25,v.y);
    camera.updateProjectionMatrix();
  }
  function frame(timestamp){
    if(stopped)return;
    raf=requestAnimationFrame(frame);
    if(!town.buildings().length)return; // keep the 2D town visible until 3D is actually ready
    // Keep the new, heavier 3D geometry at a sustainable rate on phones.
    // Original town state still updates at its normal cadence.
    if(Number.isFinite(timestamp) && frames > 0) {
      const interval = reducedMotion ? 70 : desktop() ? 15 : 30;
      if(timestamp-lastFrameAt < interval)return;
    }
    if(Number.isFinite(timestamp))lastFrameAt=timestamp;
    try {
      resize();
      const state=town.debug();
      if(worldBuildings!==town.buildings()||worldSeed!==state.seed)rebuild();
      syncActors();syncCamera();light(state.night||0);
      renderer.render(scene,camera); frames++;
      if(!api.active) {
        api.active=true;window.ToyTown3D.active=true;
        host.style.display='block';document.getElementById('town').style.opacity='0';
      }
    }catch(error){
      console.warn('Toy Town 3D render failed; restoring classic canvas',error);
      api.stop();
    }
  }
  const lost=e=>{
    e.preventDefault();stopped=true;window.ToyTown3D.active=false;
    host.style.display='none';document.getElementById('town').style.opacity='1';
    cancelAnimationFrame(raf);
  };
  renderer.domElement.addEventListener('webglcontextlost',lost,false);
  const restored=()=>{stopped=false;worldSeed=null;worldBuildings=null;api.active=false;frame();};
  renderer.domElement.addEventListener('webglcontextrestored',restored,false);
  const api={
    active:false,renderer,scene,camera,
    getStats:()=>({frames,redrawCount,actors:actors.size,buildings:town.buildings().length,webgl:true}),
    stop(){stopped=true;cancelAnimationFrame(raf);this.active=false;window.ToyTown3D.active=false;
      host.style.display='none';document.getElementById('town').style.opacity='1';},
    dispose(){this.stop();renderer.dispose();}
  };
  window.ToyTown3D=api;
  renderer.domElement.addEventListener('dblclick',()=>{},false);
  raf=requestAnimationFrame(frame);
  return api;
}
