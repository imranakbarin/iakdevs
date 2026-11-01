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
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dce9e1');
  scene.fog = new THREE.Fog('#dce9e1', 24, 62);
  const camera = new THREE.OrthographicCamera(-15, 15, 15, -15, .1, 120);
  const hemisphere = new THREE.HemisphereLight('#fff5df', '#8b9f9c', 1.08);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffe3b9', 2.42);
  // A single large, raking key connects roofs, trees, streets and residents.
  sun.position.set(-17, 22, 13);
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
  // One shadow-free cool fill catches window frames and sculpted character
  // shoulders; the warm key stays dominant (no extra shadow map cost).
  const rim=new THREE.DirectionalLight('#c0dedb',.32);
  rim.position.set(19,13,-9);
  rim.castShadow=false;
  scene.add(rim);

  // A painted studio reflection card gives glazed surfaces and roof pigments
  // one shared environment. This is generated locally: no remote textures,
  // high-memory HDR files or additional requests on the user's phone.
  if(THREE.EquirectangularReflectionMapping!==undefined){
    const c=document.createElement('canvas');c.width=512;c.height=256;
    const p=c.getContext('2d');
    const sky=p.createLinearGradient(0,0,0,256);
    sky.addColorStop(0,'#d8e5e4');
    sky.addColorStop(.38,'#eaf1e9');
    sky.addColorStop(.56,'#f3e5c8');
    sky.addColorStop(1,'#acb8a1');
    p.fillStyle=sky;p.fillRect(0,0,512,256);
    const softboxes=[
      [44,28,152,58,'rgba(255,252,230,.69)'],
      [335,35,115,75,'rgba(255,251,225,.54)'],
      [251,100,29,80,'rgba(255,243,216,.24)']
    ];
    for(const [x,y,w,h,col] of softboxes){
      p.fillStyle=col;p.fillRect(x,y,w,h);
    }
    const reflection=new THREE.CanvasTexture(c);
    reflection.colorSpace=THREE.SRGBColorSpace;
    reflection.mapping=THREE.EquirectangularReflectionMapping;
    scene.environment=reflection;
    scene.environmentIntensity=.22;
  }
  // Direct WebGL won the mobile A/B audit: retain its crisp roof tiles,
  // storefront signage and full shadow contrast. No blurry extra pass.
  const materialCache = new Map(), geometryCache = new Map(), paintedRoofCache = new Map(), stuccoCache = new Map();
  // Studio-grade warm pastel cohesion across the different news-generated
  // building colors. Keep the recognizable roof hue but avoid plastic neon.
  const tint = (hex, toward='#fff0d9', ratio=.24) => {
    const norm=v=>/^#[0-9a-f]{6}$/i.test(v)?v:'#cba58b';
    const a=norm(hex),b=norm(toward);
    const channel=i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-ratio)+parseInt(b.slice(i,i+2),16)*ratio);
    return '#'+[1,3,5].map(i=>channel(i).toString(16).padStart(2,'0')).join('');
  };
  const contactMaterial = new THREE.MeshBasicMaterial({
    color:'#304746',transparent:true,opacity:.17,depthWrite:false
  });
  const world = new THREE.Group(); scene.add(world);
  const actors = new Map(), ambient = [], plazaLights = [], festoonBulbs = [];
  const windowMaterials=new Set();
  let gardenElements = 0, woodlandShapes = 0, terrainContours = 0, composedBuildings = 0;
  let worldSeed = null, worldBuildings = null, worldPropCount = 0, sceneTime = 0, landmarkCount = 0;
  let stopped = false, frozen = false, raf = 0, frames = 0, redrawCount = 0, lastSize = '', lastFrameAt = 0;
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
  const roofMaterial = color => {
    const pigment=tint(color,'#dcaf90',.12);
    if(paintedRoofCache.has(pigment))return paintedRoofCache.get(pigment);
    const cv=document.createElement('canvas'); cv.width=256;cv.height=256;
    const c=cv.getContext('2d');
    c.fillStyle=pigment;c.fillRect(0,0,256,256);
    const dark=tint(pigment,'#77584e',.13),light=tint(pigment,'#f1d4b2',.10);
    // Fine, warm clay tiles. Previously 34×29 highly contrasting squares
    // read as a checkerboard at close zoom, not as miniature roof shingles.
    // Vary the tile tone only subtly; the staggered overlap supplies depth.
    for(let row=0;row<15;row++)for(let col=-1;col<13;col++){
      const x=col*23+(row%2)*11.5,y=row*18;
      const variation=(row*13+col*17)%7;
      c.fillStyle=variation<2?light:variation===6?dark:pigment;
      c.beginPath();c.roundRect(x+.5,y+.5,22.5,18.5,[2.5,2.5,6,6]);c.fill();
      c.strokeStyle='rgba(91,58,48,.20)';c.lineWidth=1.1;c.stroke();
      c.fillStyle='rgba(255,246,222,.13)';
      c.fillRect(x+3,y+2.5,16,1.2);
      c.strokeStyle='rgba(86,59,48,.10)';c.lineWidth=.8;
      c.beginPath();c.moveTo(x+3,y+16);c.lineTo(x+19,y+16);c.stroke();
    }
    const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshStandardMaterial({map:tx,color:'#ffffff',roughness:.94,metalness:0});
    paintedRoofCache.set(pigment,m);
    return m;
  };
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
    o.position.set(x,y,z);
    const p=geometry.parameters||{};
    // Hundreds of tiny flower/window meshes casting real-time shadows
    // overload mobile GPUs. Preserve architectural and tree shadows.
    const substantial=(p.width>=.27&&p.height>=.12&&p.depth>=.18)||(p.radius>=.18);
    // Tiny windows, leaves, shingles and trim should NEVER create their own
    // realtime shadow pass. Desktop software WebGL became unresponsive when
    // thousands of these meshes cast shadows in addition to full buildings.
    o.castShadow=!!cast&&substantial;
    o.receiveShadow=substantial;
    parent.add(o); return o;
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
  // Draped fabric canopy with a soft scalloped front valance. It stays
  // physically attached to the storefront and needs no new animation loop.
  const fabric = (parent, x,y,z,color,w=.46,d=.22) => {
    const canopy=box(parent,w,.043,d,color,x,y,z);
    canopy.rotation.x=-.13;
    for(let n=0;n<8;n++){
      const col=n%2?'#faeed7':color;
      const xx=x-w/2+(n+.5)*w/8;
      const stripe=box(parent,w/8-.004,.043,d,col,xx,y+.018,z);
      stripe.rotation.x=-.13;
      // Rounded suspended scallops are beneath the free edge rather than
      // painted squares hanging in mid-air.
      const scallop=ball(parent,w/16,col,xx,y-.047,z+d*.48);
      scallop.scale.set(1.07,.46,.55);
    }
    // Trim along the canopy edge reads as one continuous stitched seam.
    box(parent,w,.014,.035,'#f5e2c4',x,y-.050,z+d*.51);
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
  // Shared, inexpensive painted-grass surfaces add depth without spawning
  // hundreds of tiny meshes or shadow draw calls on mobile.
  const grassMaterialCache = new Map();
  function grassMaterial(color='#b4c9a4',repeat=1){
    const key=color+':'+repeat;
    if(grassMaterialCache.has(key))return grassMaterialCache.get(key);
    const cv=document.createElement('canvas'); cv.width=256;cv.height=256;
    const ctx=cv.getContext('2d');
    const pale=tint(color,'#f4e7bd',.18);
    // Broad transparent pigments unify adjacent lots before fine grass grain.
    const wash=ctx.createLinearGradient(0,0,256,256);
    wash.addColorStop(0,tint(pale,'#ecdec0',.12));
    wash.addColorStop(.58,pale);
    wash.addColorStop(1,tint(pale,'#829e8e',.12));
    ctx.fillStyle=wash;ctx.fillRect(0,0,256,256);
    for(let n=0;n<42;n++){
      const x=rng(n,918)*256,y=rng(n,721)*256,r=12+rng(n,119)*31;
      ctx.fillStyle=n%3===0?'rgba(250,234,195,.092)':'rgba(67,102,77,.052)';
      ctx.beginPath();ctx.ellipse(x,y,r,r*(.35+rng(n,228)*.4),rng(n,282)*TAU,0,TAU);
      ctx.fill();
    }
    for(let n=0;n<670;n++){
      const x=rng(n,72)*256,y=rng(n,293)*256,sz=.45+rng(n,125)*1.7;
      ctx.fillStyle=n%9===0?'rgba(249,239,201,.64)':
        n%3===0?'rgba(91,131,95,.13)':'rgba(92,137,110,.075)';
      ctx.beginPath();
      ctx.ellipse(x,y,sz,sz*.42,(rng(n,46)-.5)*1.2,0,TAU);
      ctx.fill();
    }
    // A handful of pin-sized ground blossoms is baked into the surface.
    for(let n=0;n<27;n++){
      const x=rng(n,661)*256,y=rng(n,789)*256;
      ctx.fillStyle=n%4===0?'#e9c9b5':'#f7ebd0';
      ctx.beginPath();ctx.arc(x,y,1.05,0,TAU);ctx.fill();
    }
    const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
    if(repeat>1 && tex.repeat?.set) {
      tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
      tex.repeat.set(repeat,repeat);
    }
    const material=new THREE.MeshStandardMaterial({
      map:tex,roughness:1,metalness:0,color:'#ffffff'
    });
    grassMaterialCache.set(key,material);
    return material;
  }


  // One ground language for the entire diorama: worn, matte road pigment,
  // a softly lit photography table and transparent contact-occlusion decals.
  // These are baked CanvasTextures (no expensive per-object shadow maps).
  const roadSurfaces=new Map();
  function roadSurface(axis){
    if(roadSurfaces.has(axis))return roadSurfaces.get(axis);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const p=canvas.getContext('2d');
    // Warm rubbed cobblestones replace the previous uniform highway gray.
    // Cars continue using the same road mesh and simulation coordinates.
    p.fillStyle='#a9ab9a';p.fillRect(0,0,256,256);
    for(let row=0;row<15;row++)for(let col=-1;col<10;col++){
      const x=col*29+(row%2)*14.5,y=row*18.5;
      const tintIndex=Math.floor(rng(row*27+col,811)*5);
      p.fillStyle=['rgba(222,217,188,.10)','rgba(100,108,97,.09)',
        'rgba(244,229,198,.085)','rgba(135,132,112,.07)',
        'rgba(203,196,168,.08)'][tintIndex];
      p.beginPath();p.roundRect(x+1,y+1,27.2,17.4,3);p.fill();
      p.strokeStyle='rgba(84,101,88,.115)';p.lineWidth=.8;p.stroke();
    }
    for(let i=0;i<850;i++){
      const x=rng(i,115)*256,y=rng(i,774)*256,r=.35+rng(i,231)*1.35;
      p.fillStyle=i%5===0?'rgba(238,231,204,.12)':'rgba(55,76,75,.065)';
      p.beginPath();p.ellipse(x,y,r,r*.68,rng(i,572)*TAU,0,TAU);p.fill();
    }
    for(let i=0;i<22;i++){
      const x=rng(i,329)*256,y=rng(i,655)*256,r=5+rng(i,859)*16;
      p.fillStyle=i%2?'rgba(223,212,184,.046)':'rgba(42,62,61,.045)';
      p.beginPath();p.ellipse(x,y,r,r*.48,rng(i,778)*TAU,0,TAU);p.fill();
    }
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;
    if(map.repeat?.set)map.repeat.set(axis==='east-west'?12:1,axis==='north-south'?12:1);
    const surface=new THREE.MeshStandardMaterial({map,color:'#ffffff',roughness:1,metalness:0});
    roadSurfaces.set(axis,surface);return surface;
  }
  const studioMat=(()=>{
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const p=canvas.getContext('2d');
    const wash=p.createRadialGradient(124,118,10,128,128,183);
    wash.addColorStop(0,'#e9eadb');
    wash.addColorStop(.62,'#dce5db');
    wash.addColorStop(1,'#bbccc8');
    p.fillStyle=wash;p.fillRect(0,0,256,256);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({map,roughness:1,metalness:0});
  })();
  const groundingTexture=(()=>{
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
    const p=canvas.getContext('2d');
    const feather=p.createRadialGradient(64,64,6,64,64,63);
    feather.addColorStop(0,'rgba(37,51,44,.62)');
    feather.addColorStop(.31,'rgba(40,57,50,.37)');
    feather.addColorStop(.68,'rgba(50,61,53,.10)');
    feather.addColorStop(1,'rgba(50,61,53,0)');
    p.fillStyle=feather;p.fillRect(0,0,128,128);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    return map;
  })();
  const groundingMaterial=new THREE.MeshBasicMaterial({
    map:groundingTexture,transparent:true,opacity:.72,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1
  });
  function groundingShadow(x,z,w,d,y=.165){
    const pad=object(world,geo('plane',1,1),groundingMaterial,x,y,z,false);
    pad.rotation.x=-Math.PI/2;
    pad.scale.set(w,d,1);
    pad.receiveShadow=false;
    return pad;
  }


  // A single non-repeating landscape paint layer over the whole miniature:
  // translucent broad meadow washes, soil undertones and fine grass flecks.
  // Roads, paving and the water remain separate geometry above this surface.
  const landscapeAtlas=(()=>{
    const c=document.createElement('canvas');c.width=768;c.height=768;
    const p=c.getContext('2d');p.clearRect(0,0,768,768);
    for(let i=0;i<108;i++){
      const x=rng(i,1001)*768,y=rng(i,1002)*768;
      const radius=26+rng(i,1003)*105;
      p.fillStyle=i%5===0?'rgba(227,191,142,.09)':
        i%3===0?'rgba(238,225,178,.14)':'rgba(65,115,86,.072)';
      p.beginPath();
      p.ellipse(x,y,radius,radius*(.30+rng(i,1004)*.45),
        rng(i,1005)*TAU,0,TAU);p.fill();
    }
    // Fine grass flecks share one ground plane, never thousands of meshes.
    for(let i=0;i<3300;i++){
      const x=rng(i,1006)*768,y=rng(i,1007)*768;
      const r=.45+rng(i,1008)*1.45;
      p.fillStyle=i%7===0?'rgba(255,246,217,.40)':
        i%3===0?'rgba(103,131,93,.22)':'rgba(62,99,79,.115)';
      p.beginPath();p.ellipse(x,y,r,r*.38,rng(i,1009)*TAU,0,TAU);p.fill();
    }
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({map:tex,transparent:true,
      opacity:.86,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  })();
  const vergeMaterials=new Map();
  function vergeMaterial(axis){
    if(vergeMaterials.has(axis))return vergeMaterials.get(axis);
    // Alpha falls to zero at the outside edges, letting grass softly nibble
    // into the asphalt without blocking cars, markings or the raised kerb.
    const c=document.createElement('canvas');c.width=128;c.height=256;
    const p=c.getContext('2d');
    const fade=axis==='north-south'?
      p.createLinearGradient(0,0,128,0):
      p.createLinearGradient(0,0,0,256);
    fade.addColorStop(0,'rgba(110,140,99,0)');
    fade.addColorStop(.22,'rgba(101,137,92,.16)');
    fade.addColorStop(.49,'rgba(93,127,83,.52)');
    fade.addColorStop(.78,'rgba(106,133,92,.17)');
    fade.addColorStop(1,'rgba(110,140,99,0)');
    p.fillStyle=fade;p.fillRect(0,0,128,256);
    for(let i=0;i<95;i++){
      const x=rng(i,1121)*128,y=rng(i,1122)*256;
      p.fillStyle=i%4===0?'rgba(232,214,158,.18)':'rgba(60,105,69,.14)';
      p.beginPath();p.ellipse(x,y,1.4+rng(i,1123)*3.8,
        1.2+rng(i,1124)*5.4,rng(i,1125)*TAU,0,TAU);p.fill();
    }
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,
      opacity:.89,depthWrite:false,side:THREE.DoubleSide});
    vergeMaterials.set(axis,m);return m;
  }
  function paintedVerge(x,z,width,depth,axis,y=.171){
    const mesh=object(world,geo('plane',1,1),vergeMaterial(axis),x,y,z,false);
    mesh.rotation.x=-Math.PI/2;mesh.scale.set(width,depth,1);
    mesh.receiveShadow=false;mesh.userData.terrainVerge=axis;
    return mesh;
  }

  // Storybook roof surfaces are modeled as curved, bevelled volumes rather
  // than rotated rectangular slabs. Two shared geometries cover every house,
  // so richer silhouettes do not multiply the mobile mesh budget.
  function roofCurve(t){
    return .37-.35*Math.pow(t,.86)+.037*Math.sin(Math.PI*t);
  }
  function roof(g,color,top,edge=.44){
    const clay=roofMaterial(color);
    for(const side of [-1,1]){
      const key='storybook-roof:'+side;
      let geometry=geometryCache.get(key);
      if(!geometry){
        const shape=new THREE.Shape();
        shape.moveTo(0,roofCurve(0));
        for(let i=1;i<=12;i++){
          const t=i/12;
          shape.lineTo(side*.52*t,roofCurve(t));
        }
        for(let i=12;i>=0;i--){
          const t=i/12;
          shape.lineTo(side*.52*t,roofCurve(t)-.067);
        }
        shape.closePath();
        geometry=new THREE.ExtrudeGeometry(shape,{
          depth:1.04,bevelEnabled:true,bevelSize:.014,
          bevelThickness:.014,bevelSegments:2,curveSegments:12,steps:1
        });
        geometry.translate(0,0,-.52);
        geometryCache.set(key,geometry);
      }
      object(g,geometry,clay,0,top,0);
      // Continuous cream-painted eave beneath each slightly upturned edge.
      box(g,.060,.050,1.085,mat(tint(color,'#fff2da',.34)),
        side*.51,top+.003,0);
    }
    box(g,.077,.075,1.095,mat(tint(color,'#f2ddbe',.40)),0,top+.375,0);
    // Hand-shaped curved gable fills the whole roof end: no daylight gaps
    // between the canopy and facade when the camera lowers at close zoom.
    const key='storybook-gable';
    let gable=geometryCache.get(key);
    if(!gable){
      const face=new THREE.Shape();
      face.moveTo(-.455,-.04);face.lineTo(.455,-.04);
      face.lineTo(.455,roofCurve(1)-.037);
      for(let i=11;i>=0;i--){
        const t=i/12;face.lineTo(.455*t,roofCurve(t)-.037);
      }
      for(let i=1;i<=12;i++){
        const t=i/12;face.lineTo(-.455*t,roofCurve(t)-.037);
      }
      face.closePath();
      gable=new THREE.ExtrudeGeometry(face,{
        depth:.77,bevelEnabled:true,bevelSize:.015,bevelThickness:.012,
        bevelSegments:2,steps:1
      });
      gable.translate(0,0,-.385);geometryCache.set(key,gable);
    }
    object(g,gable,mat('#ebcfb2'),0,top-.022,0);
    // Timbers close the front roof edge, adding depth without tiny shadows.
    for(const side of [-1,1]){
      const beam=box(g,.024,.043,.05,'#f7ecd8',side*.34,
        top+roofCurve(.65)-.036,.423);
      beam.rotation.z=-side*.45;
    }
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

  // Small-scale plaster: not a blank pastel cube. A light speckled finish
  // and soft edges let the houses read as hand-crafted resin miniatures.
  function plaster(color) {
    const pigment=tint(color,'#fff1de',.10);
    if(stuccoCache.has(pigment))return stuccoCache.get(pigment);
    const cv=document.createElement('canvas');cv.width=128;cv.height=128;
    const c=cv.getContext('2d');
    c.fillStyle=pigment;c.fillRect(0,0,128,128);
    for(let k=0;k<260;k++){
      const x=rng(k+1,197)*128,y=rng(k+7,381)*128;
      c.fillStyle=k%3?'rgba(116,88,73,.055)':'rgba(255,252,238,.20)';
      c.fillRect(x,y,.6+rng(k,19)*1.3,.6+rng(k,21)*1.3);
    }
    const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map:tx,roughness:.96,metalness:0});
    stuccoCache.set(pigment,material);return material;
  }
  function wallTrim(g,h,wood){
    // Architectural cornice, plinth and corner quoins all follow the walls.
    box(g,.85,.05,.85,'#f8e7d0',0,h+.075,0);
    box(g,.81,.067,.82,'#e1c9ae',0,.125,0);
    for(const x of [-.358,.358]) {
      // Continuous plaster pilasters, not floating Lego-like corner blocks.
      box(g,.033,h*.66,.031,wood,x,.27+h*.34,.400);
      box(g,.033,.050,.055,'#f2e6d6',x,.23,.405);
    }
  }
  function archedInset(g,x,y,z,w,h,wood,glass=false) {
    // Beveled stone arch in actual wall space: timber/glass behind masonry.
    const shape=new THREE.Shape();
    shape.moveTo(-w/2,-h/2);
    shape.lineTo(w/2,-h/2);
    shape.lineTo(w/2,h*.14);
    for(let i=0;i<=12;i++){
      const angle=Math.PI*i/12;
      shape.lineTo(Math.cos(angle)*w/2,h*.14+Math.sin(angle)*w*.46);
    }
    shape.lineTo(-w/2,-h/2);shape.closePath();
    const gkey='arch:'+w+':'+h;
    let arch=geometryCache.get(gkey);
    if(!arch) {
      arch=new THREE.ExtrudeGeometry(shape,{depth:.028,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:2,steps:1});
      geometryCache.set(gkey,arch);
    }
    const surround=object(g,arch,mat('#f7e6ce'),x,y,z-.013);
    // The carved stone surrounds an inset glass or timber panel.
    const panel=box(g,w*.77,h*.84,.034,glass?mat('#9ecac6',.24,'#665b3b'):wood,
      x,y-h*.075,z+.030);
    if(glass){
      box(g,w*.035,h*.66,.038,'#f7edd8',x,y-h*.08,z+.06);
      box(g,w*.75,.018,.040,'#f7edd8',x,y-h*.09,z+.06);
    }else ball(g,.014,'#e9cb87',x+w*.22,y-h*.19,z+.068);
    return surround;
  }
  function windowBox(g,x,y,z) {
    box(g,.33,.105,.145,'#b47b60',x,y,z);
    for(let i=-3;i<=3;i++){
      const xx=x+i*.040;
      const leaf=ball(g,.047,i%2?'#6b9b78':'#94be8c',xx,y+.093,z-.025+(i%3)*.022);
      leaf.scale.set(.85,1.04,.76);
      if(i%2===0)ball(g,.024,i%3?'#efb2b0':'#f6ebc9',xx,y+.145,z);
    }
  }
  function ivy(g,seed,sideX) {
    // Climbing stems trained onto walls rather than floating bushes.
    const green=['#71987a','#85a97c','#a7bc82'];
    for(let i=0;i<7;i++){
      const y=.29+i*.15,xx=sideX+Math.sin(i*.9+seed)*.028;
      const leaf=ball(g,.046,green[(seed+i)%3],xx,y,.421);
      leaf.scale.set(1.55,.74,.55);
      if(i%3===0){
        const flower=ball(g,.020,i%2?'#e9a8a8':'#f9e2ad',xx+.031,y+.037,.447);
      }
    }
  }
  function lowTerrace(g,style) {
    // Open the corner as a welcoming porch, not four isolated boxes.
    for(let i=0;i<3;i++){
      const x=-.35+i*.12;
      box(g,.105,.048,.14,'#d2c1a4',x,.11,.54+i*.026);
    }
    if(style===1) {
      // Tiny timber balcony integrated into the second-level facade.
      box(g,.42,.065,.24,'#d5bda0',-.14,1.02,.53);
      for(let j=0;j<5;j++){
        box(g,.022,.17,.029,'#f7ecd9',-.34+j*.10,1.125,.63);
      }
      box(g,.48,.037,.042,'#ead9bc',-.14,1.22,.64);
    }
    if(style===2) {
      // Greenhouse bay with genuinely glazed panels and a garden trellis.
      box(g,.31,.39,.28,plaster('#c9d9cd'),-.19,.38,.52);
      pane(g,-.19,.44,.685,.22,.26);
      box(g,.37,.065,.34,mat('#6b9985'),-.19,.61,.53);
      for(let k=0;k<3;k++) {
        cylinder(g,.011,.013,.28,'#658c79',-.34+k*.13,.33,.705);
      }
    }
  }


  function turret(g,wall,roofPigment,height=1.35) {
    // The tower lives beside the front corner, not in the main roof:
    // its complete cylindrical wall is visible and reaches the ground.
    const x=.34,z=.28,cy=.18+height/2;
    const tower=cylinder(g,.20,.245,height,plaster(wall),x,cy,z);
    tower.castShadow=true;
    cylinder(g,.25,.25,.047,'#f0dfc7',x,.19+height,z);
    const cone=object(g,geo('cylinder',0,.285,.39),roofMaterial(roofPigment),
      x,.42+height,z);
    cone.castShadow=true;
    // The turret window faces the plaza and has real architectural trim.
    box(g,.178,.245,.044,'#f7e9d3',x,.66+height*.32,z+.197);
    box(g,.132,.185,.048,mat('#9bbfc4',.30,'#8a5d3a'),
      x,.66+height*.32,z+.230);
    box(g,.014,.18,.052,'#fff5e0',x,.66+height*.32,z+.262);
    ball(g,.034,'#bd9e76',x,.66+height,z);
  }
  function sideCottageWing(g,wall,roofPigment){
    const wing=new THREE.Group();
    wing.position.set(.28,0,-.17);
    wing.scale.set(.60,.79,.72);
    g.add(wing);
    box(wing,.74,.81,.72,plaster(wall),0,.52,0);
    roof(wing,roofPigment,.97);
    pane(wing,.17,.55,.38,.22,.32);
    box(wing,.11,.13,.12,'#bd8e75',-.18,1.22,-.16);
  }
  function shopExtra(g,b,h) {
    if(!b.hero)return;
    const bakery=b.name==='BAKERY';
    const accent=bakery?'#bd7b64':'#598c85';
    if(bakery){
      // Bakery chimney, terracotta flower trough and hanging pastry sign.
      box(g,.14,.47,.15,'#aa806a',-.23,h+.33,-.10);
      box(g,.18,.055,.19,'#e6b89b',-.23,h+.56,-.10);
      windowBox(g,-.20,.14,.57);
    }else{
      // The bookshop has its own two-sided wooden display and overhang.
      box(g,.28,.36,.27,'#ebd7b8',.15,.38,.51);
      pane(g,.15,.44,.664,.20,.25);
      box(g,.37,.045,.33,accent,.15,.61,.52);
      box(g,.35,.034,.08,'#c3a687',.15,.17,.68);
    }
    // Hanging oval sign has depth and a real metal mount.
    const mount=box(g,.14,.022,.025,'#6b716a',-.32,h*.79,.475);
    box(g,.025,.12,.025,'#6b716a',-.42,h*.72,.475);
    const tag=ball(g,.10,'#f8ead1',-.42,h*.64,.48);
    tag.scale.set(.75,.86,.20);
    ball(g,.042,accent,-.42,h*.64,.513).scale.set(.82,.82,.35);
  }

  /* -------- Authored miniature landmark kit (central five buildings only) --------
   * Shared curved geometry makes these actual miniature architectural pieces,
   * not dozens of screen-aligned rectangles. Hero-only keeps GPU cost bounded.
   */
  const stoneMaterials=new Map();
  function stoneMaterial(color='#cfb69d') {
    if(stoneMaterials.has(color))return stoneMaterials.get(color);
    const c=document.createElement('canvas');c.width=256;c.height=128;
    const p=c.getContext('2d'),mortar=tint(color,'#fff0dc',.31);
    p.fillStyle=mortar;p.fillRect(0,0,256,128);
    for(let row=0;row<5;row++){
      for(let n=-1;n<9;n++){
        const offset=row%2?17:0, x=n*34+offset;
        const noise=rng(n+15,row+19),y=row*27;
        p.fillStyle=tint(color,noise<.34?'#eed8bc':'#a99a84',.08+noise*.2);
        p.beginPath();
        p.roundRect(x+2,y+2,31,23,3+noise*4);
        p.fill();
        p.strokeStyle='rgba(118,94,74,.17)';p.lineWidth=.7;p.stroke();
        p.fillStyle='rgba(255,250,236,.17)';
        p.fillRect(x+5,y+4,18,1);
      }
    }
    const texture=new THREE.CanvasTexture(c);
    texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map:texture,roughness:.98,metalness:0});
    stoneMaterials.set(color,material);
    return material;
  }
  function stoneFoundation(g,theme='#c5ad93'){
    // Stone masonry is a textured lower wall surface, not a scatter of
    // individual cubes. The five hero buildings share the geometry budget.
    box(g,.792,.245,.793,stoneMaterial(theme),0,.225,0);
    box(g,.827,.039,.824,'#f4e1c9',0,.36,0);
    box(g,.837,.051,.836,'#d7bda0',0,.095,0);
  }
  function lathePot(g,x,z,foliage='#6e9c77',accent='#e5a5aa',s=1){
    const key='atelier-terracotta-pot';
    let geometry=geometryCache.get(key);
    if(!geometry){
      const profile=[
        [0,0],[.074,0],[.085,.013],[.079,.043],
        [.103,.128],[.109,.137],[.101,.151],[.084,.155]
      ].map(([r,y])=>new THREE.Vector2(r,y));
      geometry=new THREE.LatheGeometry(profile,10);
      geometryCache.set(key,geometry);
    }
    const pot=object(g,geometry,mat('#cb9274'),x,.065,z);
    pot.scale.setScalar(s);
    for(let k=0;k<3;k++){
      const f=ball(g,.09*s,foliage,x+(k-1)*.064*s,.23*s,z+(k%2)*.042*s);
      f.scale.set(.77,1.1,.83);
      ball(g,.027*s,accent,x+(k-1)*.067*s,.28*s,z+.047*s);
    }
  }
  function timberArch(g,x,y,z,w=.31,h=.58) {
    // Deep sculpted limestone surround, wooden curved inset and stone step.
    const key='atelier-arched-frame:'+w+':'+h;
    let frame=geometryCache.get(key);
    if(!frame){
      const outer=new THREE.Shape();
      outer.moveTo(-w*.62,-h*.52);outer.lineTo(w*.62,-h*.52);
      outer.lineTo(w*.62,h*.12);
      for(let i=0;i<=16;i++){
        const t=i*Math.PI/16;
        outer.lineTo(Math.cos(t)*w*.62,h*.12+Math.sin(t)*w*.56);
      }
      outer.closePath();
      const cut=new THREE.Path();
      cut.moveTo(-w*.46,-h*.50);cut.lineTo(w*.46,-h*.50);
      cut.lineTo(w*.46,h*.12);
      for(let i=0;i<=16;i++){
        const t=i*Math.PI/16;
        cut.lineTo(Math.cos(t)*w*.46,h*.12+Math.sin(t)*w*.44);
      }
      cut.closePath();
      outer.holes.push(cut);
      frame=new THREE.ExtrudeGeometry(outer,{
        depth:.059,bevelEnabled:true,bevelSize:.013,bevelThickness:.009,
        bevelSegments:2,curveSegments:12,steps:1
      });
      geometryCache.set(key,frame);
    }
    object(g,frame,mat('#f8ead5'),x,y,z);
    const inner=box(g,w*.88,h*.76,.04,'#966a53',x,y-h*.07,z+.034);
    inner.castShadow=false;
    // Curved lintel and threshold make the physical entry readable at close zoom.
    box(g,w*1.14,.036,.22,'#d8c2a4',x,y-h*.52,z+.095);
    for(let p=0;p<3;p++){
      const edge=box(g,.018,h*.50,.017,'#bb8d6b',
        x+(p-1)*w*.27,y-h*.14,z+.063);
      edge.castShadow=false;
    }
    ball(g,.018,'#f3d392',x+w*.33,y-h*.16,z+.073);
  }
  function glazedBowWindow(g,x,y,z,style='bakery'){
    // Three window panels follow the face of a projecting rounded bay.
    // A modelled canopy caps the bay, with stone base under the glazing.
    const width=.52,depth=.23;
    const plinth=box(g,width+.05,.14,depth+.06,'#dcc8ac',x,y-.25,z+depth*.34);
    plinth.castShadow=false;
    // Transparent pale glazing; the old opaque teal material read as an
    // unexplained painted wall in real Safari-sized screenshots.
    const glass=new THREE.MeshStandardMaterial({
      color:style==='bakery'?'#d6e5d9':'#bcd9d5',
      roughness:.17,metalness:.09,transparent:true,opacity:.48,
      depthWrite:false,side:THREE.DoubleSide
    });
    for(let i=0;i<5;i++){
      const angle=(-.82+i*.41),px=x+Math.sin(angle)*width*.42;
      const pz=z+Math.cos(angle)*depth;
      const panel=box(g,.142,.35,.015,glass,px,y,pz);
      panel.castShadow=false;
      panel.receiveShadow=false;
      panel.rotation.y=angle;
      const post=box(g,.017,.385,.032,'#f6e9d1',
        px-.071,y,pz+.013);
      post.rotation.y=angle;
      const lintel=box(g,.145,.021,.039,'#faefda',px,y+.19,pz+.018);
      lintel.rotation.y=angle;
      // One restrained strip of glass reflection follows each pane's angle.
      const shine=box(g,.014,.21,.009,mat('#eaf5e8'),px+.023,y+.035,pz+.017);
      shine.rotation.y=angle;
      shine.castShadow=false;
    }
    // Curved glazed bay hood, cast as one small rounded volume.
    const hood=box(g,.59,.079,.36,style==='bakery'?'#bf765e':'#6b9789',
      x,y+.25,z+.08);
    hood.castShadow=true;
    hood.rotation.x=-.06;
    for(let i=-2;i<=2;i++){
      const x0=x+i*.093;
      if(style==='bakery'){
        const roll=ball(g,.040,'#d7a46d',x0,y-.17,z+.23);
        roll.scale.set(1.2,.48,.9);
      }else{
        box(g,.042,.15,.055,
          ['#a66f7d','#6e9d91','#d8af6d','#8c83a8','#b68465'][i+2],
          x0,y-.12,z+.246);
      }
    }
  }
  function handCarvedTimbers(g,upper=.89,accent='#927c65'){
    // Half-timbered cottages: structural diagonals across the cream plaster,
    // held slightly proud of the facade rather than floating beside it.
    for(const side of [-1,1]){
      const x=side*.31;
      box(g,.035,upper*.77,.045,accent,x,upper*.46,.427);
      const diagonal=box(g,.032,.47,.046,accent,x-side*.092,upper*.42,.427);
      diagonal.rotation.z=side*.51;
    }
    box(g,.69,.031,.054,'#e6cfae',0,upper*.76,.431);
    box(g,.69,.023,.052,accent,0,upper*.29,.433);
  }
  function leafyClimber(g,x,seed){
    // A gently curved winding stem plus sculpted ivy leaflets. Three meshes
    // for the main stem; leaves share material and geometry cache.
    const pts=[];
    for(let i=0;i<=9;i++){
      const y=.16+i*.104;
      pts.push(new THREE.Vector3(x+.045*Math.sin(i*.85+seed),y,.427));
    }
    const curve=new THREE.CatmullRomCurve3(pts);
    const stem=object(g,new THREE.TubeGeometry(curve,20,.009,4,false),
      mat('#5e8668'));
    stem.castShadow=false;
    for(let i=1;i<=8;i++){
      const p=pts[i],leaf=ball(g,.045,i%3?'#729f77':'#a0b98b',
        p.x+(i%2?.03:-.03),p.y,.444);
      leaf.scale.set(1.28,.53,.38);
      leaf.rotation.z=(i%2?-.48:.48);
      if(i%3===0)ball(g,.018,'#e8b6ad',p.x+.02,p.y+.028,.472);
    }
  }
  function atelierHome(g,b,style,height,paint) {
    if(!b.hero)return;
    const accent=style===0?'#92775b':style===1?'#788c86':'#b38a71';
    handCarvedTimbers(g,height,accent);
    // Sculpted arch replaces the stack of flat rectangular doors.
    timberArch(g,.21,.36,.454,.24,.50);
    // Window alcove, small roof trim and hand-built hanging flower trough.
    box(g,.305,.03,.074,'#f9ebd6',-.20,.814,.444);
    windowBox(g,-.20,.52,.505);
    if(style===0)leafyClimber(g,-.37,b.x+b.y);
    else if(style===1){
      for(let k=-1;k<=1;k++){
        box(g,.013,.12,.026,'#f8e7d1',k*.068,height*.76,.448);
      }
      box(g,.28,.020,.045,accent,0,height*.83,.448);
    }else{
      // A warm curved porch lantern and a little built-in seat.
      ball(g,.042,mat('#f8e8bd',.35,'#f5c578'),-.31,.83,.458);
      box(g,.24,.052,.16,'#d8bd9d',-.26,.17,.61);
    }
    lathePot(g,-.37,.55,'#6f9c7b','#eeb4b1',.83);
  }
  function atelierShop(g,b,h) {
    if(!b.hero)return;
    const bakery=b.name==='BAKERY',theme=bakery?'#c28d72':'#739b8b';
    // Proper projecting bay display makes shops distinct from the cottages.
    glazedBowWindow(g,bakery?-.18:.16,.55,.424,bakery?'bakery':'books');
    // Arch around a real inset shop door; books or pastries stay behind glass.
    timberArch(g,bakery?.20:-.18,.37,.476,.18,.52);
    // Shaped cornice plus a shallow signboard cap above the curved awning.
    box(g,.78,.055,.15,'#f5e4c8',0,h-.11,.51);
    for(const x of [-.36,.36]){
      const corbel=box(g,.09,.16,.12,'#ead4bc',x,h-.19,.51);
      corbel.rotation.z=x>0?-.11:.11;
    }
    // Hand-thrown terracotta pots rather than boxy entrance planters.
    lathePot(g,-.37,.65,bakery?'#78a07a':'#719c86','#e8b4b6',.82);
    lathePot(g,.38,.63,'#80a48b','#e5d2aa',.91);
    if(!bakery)leafyClimber(g,.35,b.x+b.y);
  }

  function home(b){
    const g=new THREE.Group();g.position.set(b.x+.5,0,b.y+.5);world.add(g);
    const style=b.hero?(b.x<=7?0:b.y<10?1:2):(Math.abs(b.x*17+b.y*11)%3);
    const height=Math.min(1.56,Math.max(.98,b.h/30))*(style===1?1.08:1);
    const paint=tint(b.wall||shades[(b.x+b.y)%shades.length]);
    box(g,.79,.09,.8,'#cbb59a',0,.045,0);
    box(g,.76,height,.76,b.hero?plaster(paint):mat(paint),0,.10+height/2,0);
    if(b.hero)stoneFoundation(g,tint(paint,'#b89b80',.23));
    if(b.hero)wallTrim(g,.10+height,style===1?'#ebd6c0':'#e3c6ad');
    const cap=.1+height;
    roof(g,b.roof||'#ba7355',cap);
    // The secondary streets need varied rooflines too: selected cottages
    // get a genuine intersecting lean-to wing, while remaining within their
    // own lots and keeping the moving traffic clearance unchanged.
    if(!b.hero && style===0 && (Math.round(b.x*7+b.y*13)%3)!==1){
      const annex=new THREE.Group();
      annex.position.set(-.245,0,-.14);
      annex.scale.set(.42,.73,.56);
      g.add(annex);
      box(annex,.74,.91,.77,mat(tint(paint,'#f6e8cf',.12)),0,.51,0);
      roof(annex,tint(b.roof||'#ba7355','#ca9376',.22),.99);
      box(annex,.20,.35,.045,'#9fbec0',0,.43,.414);
      box(annex,.27,.025,.070,'#f1dfc7',0,.242,.448);
    }
    // Each hero house gets a distinct architectural silhouette rather than
    // three copies of the same rectangular cottage.
    if(b.hero&&style===0)sideCottageWing(g,paint,b.roof||'#ba7355');
    if(b.hero&&style===2)turret(g,paint,b.roof||'#ba7355',height+.39);
    // A pitched dormer and deep eave give the cottage a recognizable roof
    // silhouette when viewed from the street.
    box(g,.20,.20,.17,'#f1dfc8',-.14,cap+.24,.295);
    box(g,.28,.045,.24,roofMaterial(b.roof||'#ba7355'),-.14,cap+.36,.30).rotation.z=-.12;
    box(g,.13,.12,.024,'#91bbc0',-.14,cap+.245,.393);
    box(g,.15,.015,.035,'#f8eddb',-.14,cap+.17,.411);
    // Layered architecture shared across all cottage variants.
    if(b.hero) {
      lowTerrace(g,style);
      ivy(g,b.x+b.y,style===1?.33:-.34);
    }
    // Front porch and steps physically touch the entry.
    box(g,.32,.085,.25,'#dbc6a9',.21,.09,.51);
    archedInset(g,.21,.31,.417,.19,.40,'#987055');
    box(g,.21,.39,.055,'#94684f',.21,.295,.41);
    box(g,.25,.42,.028,'#f4e3cc',.21,.315,.444);
    box(g,.175,.34,.035,'#99714e',.21,.28,.467);
    ball(g,.016,'#e9ca7d',.27,.32,.489);
    pane(g,-.20,.65,.405,.21,.25);
    if(b.hero)windowBox(g,-.20,.50,.488);
    if(style===1) {
      archedInset(g,-.19,height-.25,.414,.22,.32,'#b78a6b',true);
    }
    pane(g,.415,.65,-.11,.23,.24,'#ffd99a',true);
    const sill=box(g,.25,.025,.07,'#bb9776',-.20,.493,.46);
    for(let j=0;j<3;j++)ball(g,.028,j===1?'#e99d9e':'#f6dfbc',-.27+j*.07,.52,.46);
    // Window shutters, visible depth and a proper little porch roof.
    for(const dx of [-.325,-.065]){
      const shutter=box(g,.056,.27,.048,'#6c9a91',dx,.65,.445);
      shutter.castShadow=false;
    }
    // Miniature gabled porch roof with a central ridge and two sloping leaves.
    // The old single flat block read as an oversized floating canopy.
    for(const side of [-1,1]){
      const leaf=box(g,.31,.045,.39,roofMaterial(b.roof||'#ba7355'),
        .20+side*.14,.745,.56);
      leaf.rotation.z=-side*.26;
    }
    box(g,.045,.037,.42,'#f4e5d2',.20,.824,.56);
    for(const px of [.018,.382]){
      cylinder(g,.025,.030,.47,'#f8e9d2',px,.412,.695);
      box(g,.052,.065,.065,'#e6ceb3',px,.667,.695);
    }
    box(g,.12,.34,.12,'#b27966',-.21,cap+.15,-.12);
    box(g,.15,.06,.15,'#eac4a0',-.21,cap+.36,-.12);
    // Handmade plaster corner and roofline details keep buildings from
    // reading as exact clones of one little cube.
    if(style===0){
      const loft=ball(g,.10,'#f1dec3',.12,cap+.20,.39);
      loft.scale.set(.95,.88,.43);
      pane(g,.12,cap+.20,.44,.11,.14);
    } else if(style===2) {
      for(const x of [-.29,.04,.34]) {
        box(g,.020,.14,.023,'#f6ecd9',x,.90,.429);
      }
      box(g,.70,.030,.048,'#f1e0cc',0,.98,.426);
    }
    if(b.hero){
      atelierHome(g,b,style,height,paint);
      planter(g,-.29,.46);planter(g,.38,.31);
      // picket hedge on one side of the entry with no roof penetration
      for(let k=0;k<4;k++)ball(g,.10,'#7ba780',-.37,.20,-.24+k*.16);
    }
    return g;
  }
  function shop(b){
    const g=new THREE.Group();g.position.set(b.x+.5,0,b.y+.5);world.add(g);
    const h=Math.max(1.08,b.h/33), color=tint(b.wall||'#e6d7bd');
    box(g,.84,.11,.87,'#c2b09c',0,.055,0);
    box(g,.79,h,.79,b.hero?plaster(color):mat(color),0,.11+h/2,0);
    if(b.hero)stoneFoundation(g,tint(color,'#bba98d',.19));
    if(b.hero){
      wallTrim(g,h+.11,'#f2dfc5');
      for(const wx of [-.355,.355]) ivy(g,b.x*7+b.y,wx);
    }
    roof(g,b.awning||'#9c6d60',h+.11);
    for(const x of [-.225,.225])pane(g,x,.50,.411,.29,.48);
    pane(g,.42,.70,-.14,.24,.32,'#ffd0a2',true);
    box(g,.19,.57,.055,'#8e715e',.03,.40,.417);
    box(g,.16,.43,.038,'#f6ead7',.03,.38,.448);
    ball(g,.016,'#eecb7c',.084,.37,.470);
    fabric(g,0,.89,.56,b.awning||'#bc6e63',.90,.31);
    // Timber threshold and sash frames give the storefront visual weight.
    box(g,.80,.085,.19,'#d5bda1',0,.13,.505);
    for(const wx of [-.36,-.09,.18,.36])box(g,.016,.45,.045,'#fff3d8',wx,.50,.45);
    sign(g,b.name||'CAFE',0,h+.03,.448,.66,b.awning||'#7b5442');
    // Historic shopcornice with projecting wooden signage on a short bracket.
    box(g,.88,.053,.065,'#f6e4cb',0,h+.17,.41);
    box(g,.85,.038,.07,'#9f846b',0,.86,.46);
    for(const sx of [-.35,.35]){
      box(g,.026,.36,.07,'#ead4b3',sx,.50,.458);
    }
    planter(g,-.39,.50);planter(g,.37,.53);
    shopExtra(g,b,h);
    atelierShop(g,b,h);
    // Storefront merch stays behind glass; no floating signs.
    if(b.name==='BAKERY'){
      for(let i=0;i<3;i++)ball(g,.058,'#c69459',-.31+i*.11,.30,.46);
    }else if(b.name==='BOOKS'){
      for(let i=0;i<4;i++)box(g,.048,.11,.035,['#d68d88','#79a3a6','#e6be81','#947ca6'][i],
        -.34+i*.09,.29,.464);
    }
    return g;
  }

  // Art-directed 3D-only massing: stable, small shifts away from traffic
  // create distinct street silhouettes while preserving all 2D coordinates.
  function composeSecondaryBuilding(b,group){
    if(!group || b.hero || !['house','shop','tower'].includes(b.kind))return group;
    const seed=(b.x*101+b.y*271+(b.h|0)*17)>>>0;
    const nearestRoad=p=>LINES.reduce((best,n)=>
      Math.abs(n+.5-p)<Math.abs(best-p)?n+.5:best,LINES[0]+.5);
    const x=b.x+.5,z=b.y+.5;
    const ox=Math.sign(x-nearestRoad(x))*(.035+.018*rng(seed,91));
    const oz=Math.sign(z-nearestRoad(z))*(.035+.018*rng(seed,92));
    const yaw=(rng(seed,93)-.5)*.19;
    const width=.91+.08*rng(seed,98);
    const height=.87+.19*rng(seed,94);
    group.position.set(x+ox,0,z+oz);
    group.rotation.y=yaw;
    group.scale.set(width,height,width);
    group.userData.composedSecondary=true;
    group.userData.composition={offsetX:ox,offsetZ:oz,yaw,width,height,originalX:x,originalZ:z};
    composedBuildings++;
    return group;
  }
  // The surrounding skyline belongs to the same handmade village as the
  // five landmarks, not a row of anonymous modern office cuboids.
  // Towers remain on the identical simulator parcel, with distinctive
  // rooftops, believable windows and a warm limestone base.
  function tower(b){
    const g=new THREE.Group();
    g.position.set(b.x+.5,0,b.y+.5);
    world.add(g);
    const variant=Math.abs(b.x*19+b.y*7)%3;
    const h=Math.min(2.38,Math.max(1.34,b.h/57));
    const paint=tint(b.wall||'#c6d7d0','#f1dfca',.30);
    const slate=['#67877f','#ad7960','#7796a0'][variant];
    box(g,.84,.13,.83,'#d2bda1',0,.105,0);
    box(g,.77,h,.75,plaster(paint),0,.185+h/2,0);
    for(const y of [.26,h*.48+.18,h+.14])
      box(g,.80,.052,.795,'#f1dfc6',0,y,0);
    for(const x of [-.345,.345]){
      box(g,.037,h*.83,.050,'#e4cfb3',x,h*.54+.15,.399);
      box(g,.065,.08,.075,'#f8ecd8',x,h+.17,.415);
    }
    const floors=Math.min(5,Math.max(2,Math.floor(h/.34)));
    for(let row=0;row<floors;row++){
      const y=.43+row*(h-.26)/floors;
      for(const x of [-.205,.205]){
        archedInset(g,x,y,.413,.21,.25,'#799d9b',true);
        box(g,.245,.024,.09,'#edd9b9',x,y-.149,.46);
        // Sun-lit shutters, tiny but physically proud of the stone wall.
        for(const side of [-1,1])box(g,.041,.26,.028,
          variant===1?'#a67e70':'#8ca39d',x+side*.135,y,.443);
      }
    }
    // A gable-front attic with non-repeating roof tile surfaces.
    roof(g,slate,h+.185);
    const dormer=box(g,.22,.18,.20,'#f2dfc6',-.17,h+.42,.345);
    dormer.castShadow=false;
    box(g,.13,.12,.028,'#90b4b1',-.17,h+.44,.462);
    const dormerCap=box(g,.30,.046,.26,roofMaterial(slate),-.17,h+.55,.355);
    dormerCap.rotation.z=-.12;
    // Only a few blocks grow a chapel-like bell tower or a clock cupola.
    // They are designed parts of the roof, not extra identical houses.
    if(variant===0){
      const turret=new THREE.Group();turret.position.set(.26,0,-.18);g.add(turret);
      cylinder(turret,.135,.15,.54,'#e3d6bf',0,h+.47,0);
      cylinder(turret,.177,.177,.047,'#f1e7d3',0,h+.75,0);
      const spire=object(turret,new THREE.ConeGeometry(.21,.39,10),
        roofMaterial('#769588'),0,h+.96,0);
      spire.castShadow=false;
    }else if(variant===1){
      const dial=cylinder(g,.12,.12,.025,'#f2e8d1',.18,h+.40,.455);
      dial.rotation.x=Math.PI/2;dial.castShadow=false;
      box(g,.015,.10,.016,'#745b4a',.18,h+.41,.477);
      const hand=box(g,.078,.015,.015,'#745b4a',.205,h+.43,.478);
      hand.rotation.z=.30;
    }else{
      for(const x of [-.27,.27]){
        cylinder(g,.037,.044,.39,'#f2e0cb',x,h+.36,.35);
        ball(g,.064,'#e7c4ac',x,h+.58,.35);
      }
    }
    const door=box(g,.22,.39,.072,'#97755e',0,.40,.421);
    door.castShadow=false;
    box(g,.29,.046,.16,'#e9d2b5',0,.225,.493);
    // Secondary buildings use exactly the same safe parcel-staggering rules.
    composeSecondaryBuilding(b,g);
    g.userData.storybookTower=true;
    return g;
  }
  function fireStation(b){
    const x=b.x+.5,z=b.y+.5,h=.88;
    box(world,.90,h,.79,'#d06a5b',x,.45,z);
    box(world,1,.12,.91,'#f6e4d2',x,.92,z);
    box(world,.65,.49,.07,'#6a6870',x,.32,z+.41);
    sign(world,'FIRE',x,.85,z+.46,.55,'#9b4339');
  }
  // Four authored silhouettes replace the previous repeating broccoli crowns.
  // The geometry stays inexpensive: wide, interlocking ellipsoids with exposed
  // branching and planted, shadowed root flares; no leaf particle systems.
  function tree(p,i){
    const x=p.x,z=p.y,sc=p.s||1;
    const g=new THREE.Group();g.position.set(x,0,z);world.add(g);g.scale.setScalar(sc);
    g.userData.woodlandSilhouette=true;
    const family=i%13===0?'cypress':i%13===6?'willow':i%11===0?'orchard':'oak';
    const mist=THREE.MathUtils.clamp((9-z)/17,0,.28);
    const foliage=(color)=>mat(tint(color,'#d4dbc4',mist));
    groundingShadow(x,z,1.15*sc,1.04*sc,.166);
    const height=family==='cypress'?.69:family==='willow'?.70:.66;
    const trunk=cylinder(g,.044,.080,height,'#826b54',0,height*.51,0);
    trunk.rotation.z=(rng(i,27)-.5)*.13;
    // Roots taper out into the lawn rather than meeting it as a cut cylinder.
    for(let n=0;n<4;n++){
      const a=(n+.2)*TAU/4+(rng(i,29)-.5)*.2;
      const root=ball(g,.086,'#8d7458',
        Math.cos(a)*.083,.063,Math.sin(a)*.079);
      root.scale.set(1.31,.28,.68);root.rotation.y=a;
      root.castShadow=false;
    }
    if(family==='cypress'){
      // Slender Tuscan spires are tapered through four overlapping ellipsoids.
      for(let k=0;k<4;k++){
        const radius=.27-k*.051;
        const leaf=object(g,geo('sphere',radius),foliage(
          ['#4d846e','#628f78','#74a186','#8cb39a'][k]),0,
          .66+k*.165,0,false);
        leaf.scale.set(.67,.83,.72);
      }
      woodlandShapes++;
      return;
    }
    const shade=family==='orchard'?'#8b9f80':family==='willow'?'#679981':'#5a8978';
    // Dark undercanopy creates a continuous shaded mass; five unequal outer
    // lobes build a leaf silhouette instead of many equally sized balls.
    const under=object(g,geo('sphere',.38),foliage(shade),
      .025,.84,-.016,false);
    under.scale.set(1.18,.49,1.04);
    const branching=[[-.19,.73,-.02,.46],[.19,.72,.02,-.46],[0,.77,.15,.14]];
    for(const [bx,by,bz,twist] of branching){
      const stem=cylinder(g,.018,.032,.43,'#806b54',bx*.49,by,bz*.55);
      stem.rotation.z=twist;stem.castShadow=false;
    }
    const isWeeping=family==='willow';
    const lobes=isWeeping?[
      [-.25,.86,-.03,.34,.32,.32], [.17,.99,-.11,.40,.27,.35],
      [.06,.79,.20,.38,.26,.32],[-.05,1.12,.01,.31,.26,.30]
    ]:[
      [-.28,.92,-.06,.36,.29,.34],[.23,.97,-.13,.39,.31,.31],
      [.10,.90,.25,.38,.29,.37],[-.10,1.15,.03,.34,.28,.33],
      [.01,.84,-.30,.28,.25,.29]
    ];
    for(let k=0;k<lobes.length;k++){
      const [xx,yy,zz,rx,ry,rz]=lobes[k];
      const col=family==='orchard'?
        ['#b9c69b','#d8c6b5','#e4c6bf','#c5bea4','#d5b5ae'][k%5]:
        isWeeping?['#719c87','#8caf94','#9dbfa2','#78a88c'][k%4]:
        ['#79a58c','#96b79a','#a3c29d','#87ac93','#6f9d87'][k%5];
      const leaf=object(g,geo('sphere',.40),foliage(col),xx,yy,zz,false);
      leaf.scale.set(rx/.4,ry/.4,rz/.4);
      leaf.rotation.y=(rng(i,k+52)-.5)*.55;
    }
    if(isWeeping){
      // Cascading willow fronds soften the repeated round-crown profile.
      for(let k=0;k<8;k++){
        const a=k*TAU/8+.17,rad=.29+(k%3)*.037;
        const frond=object(g,geo('sphere',.20),
          foliage(k%2?'#80ab8e':'#a2be9f'),
          Math.cos(a)*rad,.67+(k%2)*.10,Math.sin(a)*rad,false);
        frond.scale.set(.33,1.14,.30);
        frond.rotation.z=Math.cos(a)*.19;
      }
    }else if(family==='orchard'){
      // Subtle petals live inside the crown, not hovering in a ring.
      for(let k=0;k<8;k++){
        const a=k*2.4,rad=.18+.11*rng(i,k+69);
        const petal=ball(g,.034,k%2?'#f0d9cf':'#ecd4cb',
          Math.cos(a)*rad,1.05+(rng(i,k+47)-.5)*.25,
          Math.sin(a)*rad+.11);
        petal.scale.set(1.25,.50,.90);petal.castShadow=false;
      }
    }
    woodlandShapes++;
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
    // Only the two permanent plaza lanterns emit real warm point light.
    // No point-light shadow maps: soft, battery-friendly dusk lighting.
    const glow=new THREE.PointLight('#ffd19a',0,3.4,2);
    glow.position.set(p.x,1.03,p.y); glow.castShadow=false;
    world.add(glow);plazaLights.push(glow);
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
    else if(k==='duck') {
      // The 2D simulation already supplies accurate water coordinates.
      const duck=new THREE.Group();duck.position.set(p.x,.21,p.y);world.add(duck);
      const body=ball(duck,.11,'#f9d767',0,0,0);body.scale.set(1.25,.70,.93);
      ball(duck,.065,'#fff0ad',.095,.07,0);
      box(duck,.065,.025,.055,'#ed9d61',.16,.055,.02);
      ambient.push({kind:'duck',mesh:duck,ref:p,phase:i*.65});
    }
    else if(k==='times'){
      // Newsstand stays legible and anchored to the outskirts.
      box(world,.7,.08,.18,'#eddcc1',p.x,.82,p.y);
      box(world,.63,.55,.07,'#fff8e7',p.x,1.13,p.y);
      cylinder(world,.035,.045,.82,'#697677',p.x-.26,.42,p.y);
      cylinder(world,.035,.045,.82,'#697677',p.x+.26,.42,p.y);
      sign(world,'TOWN TIMES',p.x,1.16,p.y+.05,.6);
    }
  }

  // CURATED VILLAGE SET — every piece uses the original town coordinates.
  // We decorate the clear garden margins, not the plaza residents' routes:
  // x=8.43/9.49 are the two shop-to-bench walking corridors and x=8.5
  // is the zebra crossing. Landscaping stays either side of those paths.
  function createStorybookVillage(){
    const gardenColors=['#5f9278','#84ad84','#a1bd93','#6a9e87','#c0cc97'];
    const petalColors=['#f4c6c2','#f6e5b0','#cfb7ce','#fff0d6','#dcaab0'];
    const clay=mat('#c49372'),sandstone=mat('#e3d2b7'),wood=mat('#9b795e');
    const seed=town.debug().seed|0;
    const flower=(x,z,kind=0,size=1)=>{
      const stem=cylinder(world,.009*size,.012*size,.13*size,
        '#709b71',x,.275+.058*size,z);stem.castShadow=false;
      const head=ball(world,.037*size,petalColors[kind%petalColors.length],
        x,.342+.11*size,z);
      head.scale.set(1.0,.52,1.05);
      if(kind%4===0){
        const core=ball(world,.013*size,'#edce7f',x,.360+.11*size,z);
        core.castShadow=false;
      }
      gardenElements+=2;
    };
    const thicket=(x,z,spread=.2,seedNo=0)=>{
      const palette=gardenColors;
      for(let k=0;k<5;k++){
        const a=(k*2.4+seedNo*.31);
        const xx=x+Math.cos(a)*spread*(.33+.45*rng(k+seedNo,81));
        const zz=z+Math.sin(a)*spread*(.33+.45*rng(k+seedNo,93));
        const shrub=ball(world,.105+(k%3)*.021,
          palette[(k+seedNo)%palette.length],xx,.29+(k%2)*.029,zz);
        shrub.scale.set(1.35,.53,.95);
        shrub.castShadow=false;
        if(k%2===0)flower(xx+.036,zz+.028,(k+seedNo)%5,.71);
      }
      gardenElements+=5;
    };
    function gardenIsland(x,z,rx,rz,paletteIndex=0){
      // Actual rounded, shallow extruded earth — not floating foliage
      // or a box paved into the lawn. Its profile differs per location.
      const outline=new THREE.Shape(),N=20;
      for(let i=0;i<=N;i++){
        const a=i*TAU/N,undulate=1+.08*Math.sin(a*3+paletteIndex);
        const px=Math.cos(a)*rx*undulate,pz=Math.sin(a)*rz*undulate;
        if(i===0)outline.moveTo(px,pz);else outline.lineTo(px,pz);
      }
      outline.closePath();
      const bed=object(world,new THREE.ExtrudeGeometry(outline,{
        depth:.038,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,
        bevelSegments:1,steps:1,curveSegments:8
      }),mat(paletteIndex%2?'#8e8c69':'#8b9872'),x,.219,z,false);
      bed.rotation.x=-Math.PI/2;
      bed.receiveShadow=true;
      // Pebble edge follows the soil contour in tiny warm set stones.
      const edging=9;
      for(let k=0;k<edging;k++){
        const a=k*TAU/edging,rr=1+.06*Math.sin(a*3+paletteIndex);
        const pebble=ball(world,.047,k%3?'#d1bea1':'#dfd1b7',
          x+Math.cos(a)*(rx+.028)*rr,.255,
          z+Math.sin(a)*(rz+.028)*rr);
        pebble.scale.set(1.2,.24,.85);pebble.castShadow=false;
      }
      thicket(x,z,Math.min(rx,rz)*1.45,paletteIndex);
      gardenElements+=10;
    }
    // Repeat only in the *perimeter*, leaving the bakery, bookshop,
    // door thresholds, table, bench and pedestrian corridors untouched.
    const beds=[
      [7.19,8.38,.27,.37,2],[7.19,10.37,.28,.31,3],
      [10.80,9.53,.28,.34,1],[10.78,7.73,.25,.28,4],
      [7.83,8.15,.16,.22,0],[9.95,8.13,.17,.20,2],
      [7.85,10.54,.18,.23,4],[9.90,10.59,.18,.23,1],
      [8.03,9.77,.13,.21,3],[9.97,9.65,.13,.20,1]
    ];
    for(const [x,z,rx,rz,variant] of beds)gardenIsland(x,z,rx,rz,variant);
    // Smaller lawn islands soften the outer borough blocks as well, without
    // landing inside any home, river, street, or procedural event building.
    const buildings=town.buildings(),props=town.props();
    const obstacles=[...buildings.map(b=>[b.x+.5,b.y+.5,.78]),
      ...props.filter(p=>p.kind==='tree').map(p=>[p.x,p.y,.42])];
    for(let by of [3.2,4.7,8.1,9.8,12.4,15.2]){
      for(let bx of [2.4,4.8,8.2,9.8,12.5,15.3]){
        if(bx>=7&&bx<=11&&by>=7&&by<=11)continue;
        if(by>=12.8&&by<=15.0)continue;
        if(LINES.some(line=>Math.abs(bx-(line+.5))<.72||
            Math.abs(by-(line+.5))<.72))continue;
        if(obstacles.some(([ox,oz,r])=>Math.hypot(ox-bx,oz-by)<r+.22))continue;
        gardenIsland(bx,by,.24,.29,Math.abs(Math.floor(bx*7+by))%5);
      }
    }
    // Hand-set flagstones curve toward the courtyard. Keep both original
    // clear walking lanes; the narrow small stones occupy their margins.
    const stones=[
      [8.14,8.74,.22,.16],[8.10,9.13,.23,.16],[8.10,9.53,.21,.15],
      [9.88,8.71,.22,.17],[9.90,9.08,.24,.16],[9.88,9.46,.22,.16],
      [8.78,10.34,.23,.17],[9.16,10.51,.23,.17],[9.52,10.73,.23,.16]
    ];
    for(let i=0;i<stones.length;i++){
      const [x,z,w,d]=stones[i],r=rng(i+seed,749);
      const slab=ball(world,.5,i%3?'#e4d4b8':'#f0e0c6',x,.221,z);
      slab.scale.set(w*1.1,.043,d*1.1);slab.castShadow=false;
      slab.rotation.y=(r-.5)*.20;
    }
    gardenElements+=stones.length;

    // Two authentic cafe tables beside the shops, not at the scripted
    // customers' destinations. Tiny stools, ceramic cups and planted barrels.
    const cafeSet=(x,z,turn=0)=>{
      const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=turn;
      g.scale.setScalar(.83);world.add(g);
      const pedestal=cylinder(g,.023,.04,.37,wood,0,.40,0);
      const tabletop=cylinder(g,.26,.26,.05,'#d0a681',0,.605,0);
      const edge=cylinder(g,.271,.271,.024,'#f1dbbb',0,.58,0);
      for(const dx of [-.34,.34]){
        cylinder(g,.022,.025,.31,wood,dx,.315,0);
        const seat=cylinder(g,.14,.14,.043,'#b88466',dx,.48,0);
        seat.castShadow=false;
      }
      const cup=cylinder(g,.041,.036,.052,'#fff4df',-.07,.66,.055);
      const saucer=cylinder(g,.067,.067,.012,'#e7d1b8',-.07,.635,.055);
      ball(g,.028,'#e7bd9c',.095,.65,-.04).scale.set(1,.56,1);
      gardenElements+=9;
    };
    cafeSet(7.74,8.75,.25);
    cafeSet(10.25,9.95,-.50);

    // An original rose-covered arbour welcomes walkers from the south.
    // Its opening aligns with the plaza, not any vehicle lane.
    const arch=new THREE.Group();
    arch.position.set(8.52,0,10.66);world.add(arch);
    for(const dx of [-.41,.41]){
      const post=cylinder(arch,.047,.057,1.18,'#9a7860',dx,.78,0);
      box(arch,.17,.13,.19,sandstone,dx,.244,0);
      box(arch,.11,.10,.13,'#f0dec5',dx,1.405,0);
      for(let k=0;k<4;k++){
        const a=k*1.7+dx,yy=.73+k*.15;
        const foliage=ball(arch,.083,k%2?'#7da481':'#628e78',
          dx+(dx<0?.03:-.03)+Math.sin(a)*.045,yy,.035);
        foliage.scale.set(1.05,.60,.69);foliage.castShadow=false;
        if(k%2===0){
          const rose=ball(arch,.037,k%4?'#e9b4bb':'#f2d4b7',
            dx+(dx<0?.04:-.04),yy+.06,.098);
          rose.castShadow=false;
        }
      }
    }
    // Curved timber arch: geometry is one actual connected 3D beam.
    const points=[];
    for(let k=0;k<=16;k++){
      const a=Math.PI-k*Math.PI/16;
      points.push(new THREE.Vector3(Math.cos(a)*.42,1.19+Math.sin(a)*.39,0));
    }
    const archCurve=new THREE.CatmullRomCurve3(points);
    object(arch,new THREE.TubeGeometry(archCurve,32,.051,6,false),wood,0,0,0,false);
    for(let k=1;k<15;k++){
      const a=Math.PI-k*Math.PI/16;
      if(k%2)continue;
      const leaf=ball(arch,.09,k%4?'#7fa989':'#90b38e',
        Math.cos(a)*.42,1.2+Math.sin(a)*.39,.01);
      leaf.scale.set(.9,.7,.8);leaf.castShadow=false;
      if(k%4===0)ball(arch,.038,'#e9b2ba',
        Math.cos(a)*.42,1.25+Math.sin(a)*.39,.087);
    }
    gardenElements+=32;

    // Physically suspended festoons between four slim timber poles.
    // Warm individual bulbs brighten at sunset without extra point lights.
    const anchors=[[7.56,9.60],[10.42,9.60],[7.58,10.58],[10.39,10.58]];
    for(const [x,z] of anchors){
      const pole=cylinder(world,.024,.037,1.27,'#947b62',x,.83,z);
      const foot=cylinder(world,.074,.084,.082,'#d5c2a5',x,.24,z);
      pole.castShadow=false;foot.castShadow=false;
    }
    const candle=new THREE.MeshStandardMaterial({
      color:'#ffebbd',emissive:'#ffc67f',emissiveIntensity:.36,
      roughness:.38,metalness:0
    });
    const strings=[[anchors[0],anchors[1]],[anchors[2],anchors[3]]];
    for(let k=0;k<strings.length;k++){
      const [a,b]=strings[k],x0=a[0],z0=a[1],x1=b[0],z1=b[1];
      const points=[];
      for(let j=0;j<=12;j++){
        const t=j/12;
        points.push(new THREE.Vector3(x0+(x1-x0)*t,
          1.43-.14*Math.sin(t*Math.PI),z0+(z1-z0)*t));
      }
      const curve=new THREE.CatmullRomCurve3(points);
      const wire=object(world,new THREE.TubeGeometry(curve,20,.008,3,false),
        mat('#665b51'),0,0,0,false);
      wire.castShadow=false;
      for(let i=1;i<8;i++){
        const t=i/8;
        const x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;
        const y=1.43-.14*Math.sin(t*Math.PI);
        const bulb=ball(world,.033,candle,x,y-.042,z);
        bulb.castShadow=false;
        festoonBulbs.push(bulb);
      }
    }
    gardenElements+=30;
  }

  // Painted landscape composition: irregular planted contours and natural
  // hedgerow ribbons are fitted into *clear lots*, not onto streets, buildings,
  // theme events, or scripted walking destinations. This is a visual-only
  // terrain layer; the simulation's 18x18 road graph stays untouched.
  function createLandscapeComposition(){
    const occupied=[
      ...town.buildings().map(b=>[b.x+.5,b.y+.5,b.kind==='site'?1.34:.81]),
      ...town.props().filter(p=>!['flowers','duck'].includes(p.kind))
        .map(p=>[p.x,p.y,p.kind==='tree'?.46:.61])
    ];
    const roadClear=(x,z,margin=.81)=>
      !LINES.some(n=>Math.abs(x-(n+.5))<margin||
        Math.abs(z-(n+.5))<margin);
    const clear=(x,z,r)=>
      x>=2.18&&x<=15.82&&z>=2.18&&z<=12.56&&
      roadClear(x,z,.81+r*.25)&&
      !(x>6.9&&x<11.2&&z>6.9&&z<11.2)&&
      occupied.every(([ox,oz,size])=>Math.hypot(x-ox,z-oz)>size+r);
    const leafMat=[
      grassMaterial('#a1bb96'),grassMaterial('#aec6a3'),
      grassMaterial('#b6c7a0'),grassMaterial('#91b39a')
    ];
    const raisedEarth=[
      mat('#8fa68d'),mat('#95a98e'),mat('#9daf90'),mat('#91aa94')
    ];
    // Create one low, rounded natural contour from a wavy closed outline.
    // The shallow bevel visibly connects the upper turf to the flat lawn.
    function contour(x,z,rx,rz,variant){
      const shape=new THREE.Shape();
      for(let i=0;i<=24;i++){
        const a=i*TAU/24;
        const bend=1+.085*Math.sin(a*3+variant*1.8)+
          .055*Math.cos(a*5-variant);
        const px=rx*Math.cos(a)*bend,pz=rz*Math.sin(a)*bend;
        if(i===0)shape.moveTo(px,pz);else shape.lineTo(px,pz);
      }
      shape.closePath();
      const turf=object(world,new THREE.ExtrudeGeometry(shape,{
        depth:.055,steps:1,bevelEnabled:true,bevelSize:.028,
        bevelThickness:.014,bevelSegments:2
      }),raisedEarth[variant%4],x,.155,z,false);
      turf.rotation.x=-Math.PI/2;turf.receiveShadow=true;
      turf.userData.landscapeContour=true;
      // Two very flat foliage pillows blend the top into the turf; exposed
      // soil remains visible at the outer scalloped boundary.
      for(let i=0;i<2;i++){
        const leaf=object(world,geo('sphere',.45),
          leafMat[(i+variant)%4],x+(i?rx*.24:-rx*.22),
          .205,z+(i?rz*.17:-rz*.21),false);
        leaf.scale.set(rx*.70,.067,rz*.66);
      }
      for(let i=0;i<4;i++){
        const a=i*TAU/4+.24,rr=.58+.14*rng(i,variant+91);
        const xx=x+Math.cos(a)*rx*rr,zz=z+Math.sin(a)*rz*rr;
        const grass=object(world,geo('sphere',.14),
          mat(i%2?'#779d7f':'#8cae88'),xx,.264,zz,false);
        grass.scale.set(.84,.39,.73);
        if((i+variant)%3===0){
          const flower=ball(world,.024,'#e8cfb9',xx,.319,zz);
          flower.scale.set(1.2,.65,.9);flower.castShadow=false;
        }
      }
      terrainContours++;
    }
    // Open neighborhood sites become small flowing gardens rather than
    // isolated square parcels. Constrain size so road shoulders stay clear.
    const blocks=[
      [2,2],[7,2],[12,2],[2,7],[12,7],[2,12],[7,12],[12,12]
    ];
    for(let bi=0;bi<blocks.length;bi++){
      const [bx,bz]=blocks[bi];
      const choices=[
        [bx+.88,bz+.85],[bx+2.04,bz+1.04],[bx+3.02,bz+2.78],
        [bx+1.04,bz+2.86],[bx+2.78,bz+1.98],[bx+2.09,bz+3.02]
      ];
      let placed=0;
      for(let k=0;k<choices.length;k++){
        if(placed>=3)break;
        const [x,z]=choices[(k+bi)%choices.length];
        const rx=.35+.13*rng(bi,k+3),rz=.40+.12*rng(bi+15,k+3);
        if(!clear(x,z,Math.max(rx,rz)+.10))continue;
        contour(x,z,rx,rz,(bi+k)%4);
        placed++;
      }
    }
    // Meandering garden-edge hedges are intentionally broken into small
    // separate runs; the road itself remains the original straight,
    // predictable simulation lane. Irregular greenery hides hard curb seams.
    const fringes=[
      [2.25,5.08,4.93,5.08],[7.30,5.08,10.78,5.08],
      [12.25,5.08,15.78,5.08],[2.25,10.92,5.09,10.92],
      [12.25,10.92,15.78,10.92],[2.25,12.48,5.08,12.48]
    ];
    for(let j=0;j<fringes.length;j++){
      const [ax,az,bx,bz]=fringes[j],samples=9;
      let segment=0;
      for(let k=0;k<samples;k++){
        const t=k/(samples-1),x=ax+(bx-ax)*t;
        const z=az+(bz-az)*t+.08*Math.sin(t*TAU+j);
        if(!clear(x,z,.22))continue;
        const hedge=object(world,geo('sphere',.22),
          mat((j+k)%3===0?'#83aa89':'#70977f'),x,.236,z,false);
        hedge.scale.set(.95,.38,.58);
        segment++;
      }
      if(segment>1)terrainContours++;
    }
  }

  function createGround(){
    // A generous matte studio table under the actual miniature slab.
    // Soft ambient contrast makes the scene read like a photographed model.
    const backdrop=box(world,110,.07,110,studioMat,9,-1.25,9);
    backdrop.castShadow=false;
    // A feathered shadow between the wood slab and studio table completes the
    // real-world tabletop scale; this stays outside the town's active streets.
    groundingShadow(9,9,23.5,23.5,-1.205);
    box(world,18.6,1.12,18.6,'#9b8069',9,-.60,9);
    // A single soft landscape wash bridges the individual lots without
    // removing their real raised foundations or affecting the 2D fallback.
    box(world,18.35,.20,18.35,grassMaterial('#b9cba7',10),9,.025,9);
    const meadow=object(world,geo('plane',18.35,18.35),landscapeAtlas,9,.129,9,false);
    meadow.rotation.x=-Math.PI/2;meadow.receiveShadow=false;
    meadow.userData.continuousLandscape=true;
    // Water sits below streets; bridges cross at the existing four lanes.
    groundPiece(18.02,1.97,'#8dbfc0',9,14,.105);
    const isRoad = v=>LINES.includes(v);
    for(const n of LINES){
      groundPiece(1.01,16.03,roadSurface('north-south'),n+.5,9,.132);
      groundPiece(16.03,1.01,roadSurface('east-west'),9,n+.5,.143);
      // No repeated bright highway centre dashes. Cobble seams and garden
      // verges now give the lanes scale; keep a few discreet travel cues far
      // from the village square for vehicle readability on mobile.
      for(let t of [3.1,4.9,13.0,15.1]){
        groundPiece(.024,.20,'#c6c3af',n+.5,t+.5,.181);
        groundPiece(.20,.024,'#c6c3af',t+.5,n+.5,.188);
      }
      // Curbs are individual block-front segments, not giant floating strips
      // cutting across every junction and bridge.
      const segments=[[2.22,5.78],[7.22,10.78],[12.22,12.75],[15.25,15.78]];
      for(const [a,b] of segments) {
        const length=b-a;
        // Landscape frays into each kerb in four short, carefully bounded
        // sections, never through intersections or across river bridges.
        if(length>.75)for(const side of [-1,1]) {
          paintedVerge(n+(side<0?-.17:1.17),(a+b)/2,
            .40,length,'north-south');
          paintedVerge((a+b)/2,n+(side<0?-.17:1.17),
            length,.40,'east-west');
        }
        for(const edge of [-.068,1.068]) {
          groundPiece(.054,length,'#bfb5a1',n+edge,(a+b)/2,.185);
          groundPiece(length,.054,'#bfb5a1',(a+b)/2,n+edge,.185);
        }
      }
      // River bridges have pale stone shoulders, anchored to the same lanes.
      groundPiece(1.12,2.05,'#a99f8c',n+.5,14,.17);
      groundPiece(.92,2.06,'#78868a',n+.5,14,.22);
      for(const side of [-.52,.52]){
        box(world,.052,.22,2.08,'#d8d1bf',n+.5+side,.29,14);
      }
    }
    // The hero neighborhood is one continuous garden, not sixteen lawns
    // boxed into independent tiles with dark grid joints between them.
    groundPiece(3.96,3.96,grassMaterial('#a6c49f'),9,9,.179);
    // A continuous, softly scalloped village green replaces the boxy central
    // paving slab. The heart is a rounded stone piazza with irregular lawn
    // pockets; the same pedestrian routes remain visible and unobstructed.
    const piazzaShape=new THREE.Shape();
    for(let i=0;i<=32;i++){
      const a=i*TAU/32,organic=1+.055*Math.sin(3*a+.3)+
        .035*Math.sin(7*a-1.1);
      const px=Math.cos(a)*1.14*organic,pz=Math.sin(a)*1.09*organic;
      if(i===0)piazzaShape.moveTo(px,pz);else piazzaShape.lineTo(px,pz);
    }
    piazzaShape.closePath();
    const piazza=object(world,new THREE.ExtrudeGeometry(piazzaShape,{
      depth:.038,bevelEnabled:true,bevelSize:.028,bevelThickness:.009,
      bevelSegments:2,steps:1
    }),mat('#e5d9bd'),9,.185,9,false);
    piazza.rotation.x=-Math.PI/2;
    piazza.userData.villagePiazza=true;
    // Hand-set pavers follow the curved perimeter, not a square grid.
    const stone=['#ede1c9','#e6d7ba','#e9ddc7','#e2d4bb'];
    for(let row=0;row<7;row++)for(let col=0;col<7;col++){
      const px=8.06+col*.305+(row%2)*.065;
      const pz=8.07+row*.307;
      const dx=px-9,dz=pz-9;
      if((dx*dx)/(1.08*1.08)+(dz*dz)/(1.02*1.02)>.91)continue;
      const jitter=(rng(col*19+row,434)-.5)*.065;
      const paver=groundPiece(.251+rng(col,row)*.037,
        .251+rng(row,col)*.038,stone[(row*3+col)%4],
        px+jitter,pz-jitter*.7,.235);
      // Slight handmade irregularity removes the machine-perfect grid.
      paver.rotation.y=(rng(col*37+row,row*17+col)-.5)*.13;
    }
    // Hand-set garden ribbons transition the little courtyard into the grass,
    // instead of floating as a paved square cut out of a flat sheet.
    for(let row=0;row<4;row++) {
      for(let col=0;col<4;col++){
        const x=7.27+col*1.0,z=7.22+row*.98;
        if((row===1||row===2)&&(col===1||col===2))continue;
        for(let n=0;n<3;n++){
          const seed=row*29+col*17+n*7;
          const px=x+.15+rng(seed,32)*.52,pz=z+.13+rng(seed,41)*.50;
          const bloom=ball(world,.07,seed%2?'#87aa87':'#a3bf91',px,.24,pz);
          bloom.scale.set(1.35,.58,1.24);
          if(n===1)ball(world,.025,'#f3c6bf',px,.29,pz+.018);
        }
      }
    }
    // A low, warm stone border defines the central neighborhood as one
    // landscaped courtyard; it leaves walkways open for arriving residents.
    const edging=mat('#e4d4b7');
    for(let n=0;n<4;n++) {
      for(const z of [7.05,10.94]) {
        if(n!==1&&n!==2)box(world,.78,.095,.072,edging,7.5+n,.23,z);
      }
      for(const x of [7.05,10.94]) {
        if(n!==1&&n!==2)box(world,.072,.095,.78,edging,x,.23,7.5+n);
      }
    }
    // Dappled garden beds stay below doors and away from the moving pavement.
    for(const [x,z] of [[7.23,8.52],[10.73,8.82],[7.31,10.45],[10.65,10.42]]) {
      box(world,.36,.09,.28,'#bba27d',x,.22,z);
      for(let j=0;j<5;j++) {
        const xx=x-.12+j*.06;
        ball(world,.073,j%2?'#649d7b':'#8aba91',xx,.31,z);
        if(j%2===0)ball(world,.027,j===0?'#edb4b3':'#fff0c8',xx,.39,z);
      }
    }
    // Four grounded zebra stripes on the actual southern road.
    for(let i=0;i<4;i++)groundPiece(.088,.71,'#f8eedb',8.20+i*.17,11.5,.240);
    // Translucent moving ripples: actual water-height meshes tied to the river.
    for(let i=0;i<15;i++) {
      const x=1.5+i*1.01, z=13.45+(i%3)*.35;
      if(LINES.some(line=>Math.abs(line+.5-x)<.65))continue;
      const ring=object(world,geo('torus',.18+(i%3)*.05,.012),
        mat('#e4f4df',.32),x,.160,z,false);
      ring.rotation.x=-Math.PI/2;
      ring.material.transparent=true;
      ring.material.opacity=.53;
      ambient.push({kind:'water',mesh:ring,phase:i*.85,x,z});
    }
    // Riverside edge, small paths; never grow trees out of water.
    // A continuous shoreline uses the same translucent verge pigment as
    // street lawns; the bank is interrupted precisely at each bridge.
    for(let i=1;i<17;i++){
      if(!isRoad(i)) {
        groundPiece(.85,.15,'#e1d3b7',i+.5,12.90,.17);
        paintedVerge(i+.5,12.98,.84,.24,'east-west',.174);
        littleFlowers(i+.35,12.63,i*17);
      }
    }
    // City benches and planted corners are integrated with the paved streets:
    // small seasonal flower beds, low stone troughs and soft ground cover.
    for(const [x,z] of [[7.2,7.4],[10.76,9.65],[8.08,10.74],[10.8,10.84]]) {
      box(world,.40,.082,.28,'#c8b59b',x,.18,z);
      for(let n=0;n<6;n++){
        const xx=x-.15+n*.059,yy=.25+(n%3)*.014;
        ball(world,.060,n%2?'#76a88a':'#92bd91',xx,yy,z);
        if(n%2===0)ball(world,.024,n%4?'#e5a6ad':'#f6e9c6',xx,yy+.07,z);
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
    ambient.length = 0; plazaLights.length = 0; festoonBulbs.length = 0;
    windowMaterials.clear();
    gardenElements = 0; woodlandShapes = 0; terrainContours = 0; composedBuildings = 0; landmarkCount = 0;
    while(world.children.length)world.remove(world.children[0]);
    for(const [ref,obj] of actors){obj.group.parent?.remove(obj.group);}
    actors.clear();
    createGround();
    createLandscapeComposition();
    for(const b of town.buildings()){
      // All structures share the same ground-contact light: five bespoke
      // landmarks should not seem pasted onto brighter pavement than houses.
      groundingShadow(b.x+.5,b.y+.5,b.kind==='site'?2.25:1.48,
        b.kind==='site'?2.12:1.44,b.hero?.235:.166);
      // The five central landmarks are *entire independent models*.
      // Avoid drawing the generic body, roof, porch or old atelier overlays
      // behind them; an authored asset replaces that complete building.
      if(b.hero && typeof options.buildLandmark==='function') {
        try {
          const unique=options.buildLandmark(THREE,RoundedBoxGeometry,b);
          if(unique) {
            unique.userData.landmark=true;
            world.add(unique);
            landmarkCount++;
            continue;
          }
        } catch(error) {
          console.warn('Hero landmark model failed; using classic geometry',error);
        }
      }
      if(b.kind==='house')composeSecondaryBuilding(b,home(b));
      else if(b.kind==='shop')composeSecondaryBuilding(b,shop(b));
      else if(b.kind==='tower')tower(b);
      else if(b.kind==='fire')fireStation(b);
      else if(b.kind==='site'){
        box(world,1.55,.42,1.5,'#dac9ac',b.x+.5,.24,b.y+.5);
        box(world,.4,.55,.43,'#bda78b',b.x+.7,.75,b.y+.6);
      }
    }
    const ps=town.props();
    for(let i=0;i<ps.length;i++)smallProps(ps[i],i);
    createStorybookVillage();
    // Landmark panes are pooled across the five models. Update material
    // intensity only, not every individual window mesh, on each frame.
    const visit=node=>{
      if(node.material?.userData?.miniatureWindow)
        windowMaterials.add(node.material);
      for(const child of node.children||[])visit(child);
    };
    visit(world);
    worldSeed=town.debug().seed;worldBuildings=town.buildings();
    worldPropCount=ps.length;
    redrawCount++;
  }
  function person(ref){
    const g=new THREE.Group();
    const skin=ref.skin||'#dbab86',coat=ref.col||'#d6a3a0';
    // Rounded head and tapered torso read as a small character at close zoom.
    const torso=ball(g,.088,coat,0,.26,0);
    torso.scale.set(.92,1.2,.74);
    // Sculpted layered clothing: the coat reads as a garment, not a capsule.
    const hem=ball(g,.075,coat,0,.207,0);
    hem.scale.set(1.16,.48,.87);
    for(const sx of [-1,1]){
      const shoulder=ball(g,.049,coat,sx*.082,.323,0);
      shoulder.scale.set(.90,.84,.86);
      box(g,.014,.125,.017,'#f8e7d5',sx*.034,.253,.079);
    }
    box(g,.032,.099,.023,'#f6e5ce',0,.319,.080);
    const neck=cylinder(g,.031,.032,.055,skin,0,.374,0);
    const head=ball(g,.095,skin,0,.457,0);
    head.scale.set(1,1.045,.95);
    const hairTone=ref.hair||'#5b4639';
    const hair=ball(g,.099,hairTone,0,.515,-.014);
    hair.scale.set(1,.46,1);
    // Distinct asymmetric hair silhouettes. No detached floating hair tufts.
    const hairStyle=(Math.round((ref.x||0)*11+(ref.y||0)*7))%3;
    if(!ref.hat){
      if(hairStyle===0){
        for(const side of [-1,1]){
          const lock=ball(g,.043,hairTone,side*.073,.465,-.029);
          lock.scale.set(.64,1.22,.83);
        }
      } else if(hairStyle===1) {
        const fringe=ball(g,.056,hairTone,-.023,.501,.059);
        fringe.scale.set(1.32,.35,.69);
      } else {
        for(let k=0;k<3;k++){
          const curl=ball(g,.031,hairTone,(k-1)*.055,.535,.016);
          curl.scale.set(.98,.72,.96);
        }
      }
    }
    // Eyes and a soft nose sit on the forward (+Z) face of the head,
    // not on a screen-aligned sprite; rotation follows actual walking.
    const eyelids=[];
    for(const sx of [-1,1]){
      const eye=ball(g,.019,'#fff8ef',sx*.032,.455,.086);
      ball(g,.009,'#354449',sx*.032,.457,.102);
      eyelids.push(eye);
      ball(g,.015,'#df978b',sx*.069,.417,.074);
      ball(g,.024,skin,sx*.097,.439,.005);
    }
    ball(g,.017,skin,0,.425,.100);
    const smile=object(g,geo('torus',.024,.004),mat('#925f5c'),0,.404,.094);
    smile.scale.set(1,.40,.26);
    // Layers of clothing create a tiny character instead of a colored capsule.
    box(g,.072,.075,.040,'#fff1da',0,.324,.071);
    box(g,.023,.038,.031,'#d3a082',0,.304,.091);
    for(const sx of [-1,1]){
      box(g,.014,.029,.022,'#f7e0c4',sx*.034,.305,.087);
    }
    const legs=[],arms=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.041,.178,0);
      cylinder(leg,.024,.026,.15,'#60717b',0,-.074,0);
      box(leg,.062,.035,.102,'#5a524b',0,-.154,.027);
      g.add(leg);legs.push(leg);
      const arm=new THREE.Group();arm.position.set(side*.097,.327,0);
      cylinder(arm,.024,.026,.132,coat,0,-.076,0);
      ball(arm,.025,'#f3e1ce',0,-.123,0);
      ball(arm,.027,skin,0,-.154,0);g.add(arm);arms.push(arm);
    }
    if(ref.hat){
      const cap=ball(g,.099,ref.hat==='beanie'?'#b18cbd':'#588f9e',0,.534,0);
      cap.scale.set(1,.57,1);
      if(ref.hat==='cap')box(g,.095,.017,.063,'#588f9e',0,.487,.089);
    }
    if(ref.bag)box(g,.06,.15,.12,'#ae8966',-.106,.24,-.038);
    g.userData.limbs={legs,arms,eyelids};
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
  function creature(ref) {
    const g=new THREE.Group(), kind=ref.kind;
    if(kind==='ghost'){
      const body=ball(g,.16,'#f5efe3',0,.22,0);
      body.scale.set(.8,1.42,.8);
      for(const x of [-.055,.055])ball(g,.016,'#465263',x,.29,.124);
      return g;
    }
    if(kind==='penguin'){
      const torso=ball(g,.125,'#45515a',0,.22,0);
      torso.scale.set(.82,1.55,.83);
      const bib=ball(g,.092,'#f7eee1',0,.19,.075);bib.scale.set(.8,1.4,.42);
      for(const x of [-.04,.04])ball(g,.012,'#252e38',x,.35,.097);
      box(g,.09,.025,.065,'#e3a461',0,.30,.135);
      return g;
    }
    if(kind==='hen'){
      const body=ball(g,.12,'#fff7eb',0,.17,0);body.scale.set(1.25,.90,1);
      ball(g,.075,'#fff3dd',.11,.23,0);
      const comb=ball(g,.035,'#d76a64',.11,.31,0);
      box(g,.075,.025,.045,'#dfa05d',.17,.22,0);
      return g;
    }
    if(kind==='dino'){
      const body=ball(g,.32,'#8fba8c',0,.38,0);body.scale.set(1.3,.8,.82);
      cylinder(g,.14,.12,.50,'#8fba8c',.28,.70,0);
      ball(g,.16,'#93c69f',.30,.92,.0);
      for(let j=0;j<4;j++)ball(g,.065,'#6e9f79',-.2+j*.13,.63,0);
      for(const x of [-.21,.20])cylinder(g,.065,.06,.32,'#729e80',x,.17,0);
      ball(g,.018,'#3d4e4a',.40,.96,.12);
      return g;
    }
    // Dogs and llamas are quadrupeds, not human avatars.
    const llama=kind==='llama',fur=llama?'#efe2cb':'#b88d68';
    const body=ball(g,llama?.19:.17,fur,0,llama?.31:.22,0);
    body.scale.set(1.4,.75,.82);
    for(const x of [-.17,.17])for(const z of [-.09,.09])
      cylinder(g,.030,.038,llama?.30:.18,fur,x,llama?.17:.10,z);
    if(llama)cylinder(g,.075,.085,.52,fur,.21,.62,0);
    const head=ball(g,llama?.10:.12,fur,.25,llama?.86:.33,0);
    head.scale.set(1.12,.87,.95);
    for(const z of [-.07,.07]){
      const ear=ball(g,.046,fur,.23,llama?1.01:.45,z);
      ear.scale.set(.58,1.5,.65);
    }
    const nose=ball(g,.045,'#765a4c',llama?.36:.37,llama?.84:.30,0);
    for(const z of [-.075,.075])ball(g,.013,'#322d29',llama?.31:.32,llama?.92:.38,z);
    return g;
  }
  function actor(ref){
    const animal=['dog','hen','penguin','llama','dino','ghost'].includes(ref.kind);
    const g=ref.kind==='bike'?bicycle(ref):ref.type==='car'?car(ref):animal?creature(ref):person(ref);
    g.position.set(ref.x,0,ref.y);
    const kind=ref.kind==='bike'?'bike':ref.type==='car'?'car':animal?'animal':'person';
    // Feathered miniature contact pads hold feet and tyres to the terrain
    // even under overcast lighting and at close zoom.
    const pad=object(g,geo('sphere',.11),contactMaterial,0,
      kind==='car'?.101:kind==='bike'?.057:kind==='animal'?.042:.012,0,false);
    const spread=kind==='car'?[3.05,.065,1.75]:
      kind==='bike'?[1.9,.06,1.1]:kind==='animal'?[1.35,.05,1.05]:[.85,.045,.60];
    pad.scale.set(...spread);
    world.add(g);
    actors.set(ref,{group:g,kind});
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
      // Ground-contact calibration: wheels touch the road instead of floating.
      const baseY=item.kind==='car'?.078:item.kind==='bike'?.11:
        item.kind==='animal'?.13:ref.sit?.10:.16;
      g.position.set(desiredX,baseY,desiredZ);
      const a=Number.isFinite(ref.heading)?-ref.heading:[0,Math.PI,-Math.PI/2,Math.PI/2][d];
      // Cars, bicycles and quadrupeds point along local +X; only sculpted
      // residents have local +Z faces. Keep both aligned with actual travel.
      g.rotation.y=a+(item.kind==='person'?Math.PI/2:0);
      const limbs=g.userData.limbs;
      if(limbs){
        const moving=!!ref.v&&ref.v>.035&&!ref.sit&&(!ref.stopUntil||town.debug().clock>=ref.stopUntil);
        const step=moving?Math.sin((ref.travel||0)*17+(ref.ph||0))*.44:0;
        limbs.legs[0].rotation.x=ref.sit?-1.18:step;
        limbs.legs[1].rotation.x=ref.sit?-1.18:-step;
        limbs.arms[0].rotation.x=ref.sit?.22:-step*.85;
        limbs.arms[1].rotation.x=ref.sit?.22:step*.85;
        if(ref.waveUntil&&town.debug().clock<ref.waveUntil)limbs.arms[1].rotation.z=-1.6;
        else limbs.arms[1].rotation.z=0;
        // Slight offset blinks make residents feel alive even when standing.
        // The head, eyes and clothes remain modeled in one coherent rig.
        const blink=(sceneTime*.0016+(ref.x||0)*.31+(ref.y||0)*.19)%6.8;
        for(const eye of limbs.eyelids||[])eye.scale.y=blink<.18?.16:1;
        g.position.y+=moving?Math.abs(Math.sin((ref.travel||0)*17))*.012:0;
      }
      if(item.kind==='animal' && !reducedMotion) {
        g.position.y+=Math.abs(Math.sin((ref.travel||0)*13))*Math.min(.016,(ref.v||0)*.035);
      }
    }
  }
  function animateAmbient(time){
    if(reducedMotion)return;
    for(const a of ambient){
      if(a.kind==='duck'){
        a.mesh.position.set(a.ref.x,.21+Math.sin(time*1.75+a.phase)*.025,a.ref.y);
        a.mesh.rotation.y=Math.sin(time*.58+a.phase)*.22;
      } else if(a.kind==='water'){
        const pulse=.88+.16*Math.sin(time*1.1+a.phase);
        a.mesh.scale.set(pulse,pulse,pulse);
        a.mesh.position.y=.159+.004*Math.sin(time*.85+a.phase);
      }
    }
  }
  function light(time){
    const dark=THREE.MathUtils.clamp(time,0,1);
    // Continuous color-temperature progression (no dusk hue snapping).
    // Daylight, shadow fill, haze and lanterns now belong to one exposure.
    const dusk=dark*dark*(3-2*dark);
    hemisphere.intensity=1.08-dark*.36;
    sun.intensity=2.42-dark*1.72;
    rim.intensity=.32+dark*.06;
    sun.color.set(tint('#ffe3b9','#efad8a',dusk));
    rim.color.set(tint('#c0dedb','#a8b6cb',dusk));
    for(const lantern of plazaLights)lantern.intensity=dark*7.2;
    for(const bulb of festoonBulbs)bulb.material.emissiveIntensity=.32+dark*1.65;
    for(const pane of windowMaterials){
      pane.emissiveIntensity=(pane.userData?.warm?.12:.04)+
        dark*(pane.userData?.warm?1.02:.66);
    }
    scene.background.set(tint('#dce9e1','#a6b5c5',dusk));
    scene.fog.color.copy(scene.background);
    renderer.toneMappingExposure=1.02-dark*.11;
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
    // At close-up, lower the virtual eye to show windows, porch geometry and
    // faces; a gentle interpolation preserves the calm overview perspective.
    const closeness=THREE.MathUtils.clamp((v.z-1.0)/2.7,0,1);
    // Bring the eye down as we approach: rooftops remain visible, but
    // shop glazing, porches and characters occupy more of the composition.
    // More architectural eye-level at zoom: the previous high camera showed
    // mostly roofs and hid the ornate shopfronts and modeled character faces.
    // At close zoom, frame the landmark shopfronts. Panning away removes
    // the added focus automatically; user gestures still own the camera.
    const focusWeight=THREE.MathUtils.clamp((v.z-.90)/.90,0,1)*
      THREE.MathUtils.clamp(1-Math.hypot(v.x-9,v.y-9)/2.9,0,1);
    const aimX=v.x-focusWeight*.09,aimZ=v.y-focusWeight*.42;
    if(window.location?.search?.includes('legacycam=1')){
      camera.position.set(v.x+12.5,23-closeness*11.5,v.y+22);
      camera.lookAt(v.x,.30,v.y);
    }else{
      camera.position.set(aimX+7.4,20.4-closeness*9.4,aimZ+24.0);
      camera.lookAt(aimX,.43,aimZ);
    }
    camera.updateProjectionMatrix();
  }
  function frame(timestamp){
    if(stopped || frozen)return;
    raf=requestAnimationFrame(frame);
    if(!town.buildings().length)return; // keep the 2D town visible until 3D is actually ready
    // Keep the new, heavier 3D geometry at a sustainable rate on phones.
    // Original town state still updates at its normal cadence.
    if(Number.isFinite(timestamp) && frames > 0) {
      const interval = reducedMotion ? 70 : desktop() ? 15 : 30;
      if(timestamp-lastFrameAt < interval)return;
    }
    if(Number.isFinite(timestamp)){lastFrameAt=timestamp;sceneTime=timestamp;}
    try {
      resize();
      const state=town.debug();
      if(worldBuildings!==town.buildings()||worldSeed!==state.seed)rebuild();
      syncActors();syncCamera();light(state.night||0);
      animateAmbient(state.clock||0);
      renderer.render(scene,camera);
      frames++;
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
    getStats:()=>({frames,redrawCount,actors:actors.size,ambient:ambient.length,plazaLights:plazaLights.length,festoonBulbs:festoonBulbs.length,gardenElements,woodlandShapes,terrainContours,composedBuildings,landmarks:landmarkCount,windowMaterials:windowMaterials.size,photographicLens:false,buildings:town.buildings().length,webgl:true,frozen}),
    // A stable actual GPU-rendered frame for visual regression screenshots.
    // Unlike stop(), freeze does not switch to the Canvas fallback.
    freeze(){frozen=true;cancelAnimationFrame(raf);},
    unfreeze(){if(!stopped&&frozen){frozen=false;raf=requestAnimationFrame(frame);}},
    stop(){stopped=true;cancelAnimationFrame(raf);this.active=false;window.ToyTown3D.active=false;
      host.style.display='none';document.getElementById('town').style.opacity='1';},
    dispose(){this.stop();scene.environment?.dispose?.();renderer.dispose();}
  };
  window.ToyTown3D=api;
  renderer.domElement.addEventListener('dblclick',()=>{},false);
  raf=requestAnimationFrame(frame);
  return api;
}
