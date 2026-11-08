/* Toy Town 3D — real WebGL miniature diorama.
 * Reads the existing ToyTown simulation; it never owns traffic, date, news,
 * pan/zoom gestures, or lifecycle. The classic Canvas remains the fallback.
 * THREE and RoundedBoxGeometry are passed in by the module loader. */
export function mountToyTown3D(THREE, RoundedBoxGeometry, town, host, options = {}) {
  if (!town || !host || !window.WebGL2RenderingContext) return null;
  // Touch phones keep the same geometry/shadow budget after rotating.
  const touchDevice=!!window.matchMedia?.('(pointer: coarse)').matches;
  const desktop = () => window.innerWidth >= 700 && !(touchDevice && Math.min(window.innerWidth,window.innerHeight)<700);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance'});
  // Sharp on every screen: render at up to 2x the CSS pixels (a 3x iPhone at
  // 1.4x was upscaled and looked blurred). If a device cannot hold the frame
  // rate, the ratio steps down a notch at a time (see adaptSharpness).
  let pixelRatio=Math.min(window.devicePixelRatio || 1, desktop()?2:1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;   // redrawn every few frames (see frame): the shadow pass costs as much as a second view of the town
  renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft was removed in r18x; PCF + radius gives the soft edge
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cee9f5');
  scene.fog = new THREE.Fog('#cee9f5', 24, 62);
  // A physical perspective lens instead of an orthographic drawing camera.
  // FOV is fixed; dolly distance preserves the existing 2D zoom scale,
  // while the foreground genuinely grows relative to the distant roofs.
  const camera = new THREE.PerspectiveCamera(35, 1, .08, 600);
  const hemisphere = new THREE.HemisphereLight('#fff1dc', '#6f8580', .86);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffd7a4', 2.6);
  // A single large, raking key connects roofs, trees, streets and residents.
  sun.position.set(-18, 16, 12);   // late afternoon: longer, warmer shadows
  sun.castShadow = true;
  sun.shadow.mapSize.set(desktop() ? 1024 : 512, desktop() ? 1024 : 512);
  sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
  sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 70;
  sun.shadow.bias = -.00035;
  sun.shadow.normalBias = .028;
  sun.shadow.radius = 3;
  sun.target.position.set(9,0,9);
  scene.add(sun,sun.target);
  // One shadow-free cool fill catches window frames and sculpted character
  // shoulders; the warm key stays dominant (no extra shadow map cost).
  const rim=new THREE.DirectionalLight('#c0dedb',.39);
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
  const tint = (hex, toward='#fff0d9', ratio=.16) => {
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
  // Seasons follow the calendar (?season=spring|summer|autumn|winter previews one): they tint the foliage, the grass tufts and the flowers.
  const SEASONS={
    spring:{leaf:'#f3b5cb',k:.3,tufts:['#86bb6c','#98c97a','#7fb364','#a6d184'],flowers:['#f6c9d6','#ffffff','#fff0b3','#f3a6c4'],rate:.45},
    summer:{leaf:'#6fae5a',k:.06,tufts:['#7fae6e','#8fba76','#6f9f64','#9bc27f'],flowers:['#f6c9d6','#fff0b3','#ffffff','#f3b6a2','#cdb8ee'],rate:.3},
    autumn:{leaf:['#d9873a','#c9602e','#e0b14a'],k:.42,tufts:['#b7a24f','#a8914a','#c2a95c','#9aa65e'],flowers:['#e8a24c','#d9783c','#f1cf6a'],rate:.16},
    winter:{leaf:'#e4edf2',k:.38,tufts:['#a4b8a5','#b3c3b2','#c6d2c8','#98ad9a'],flowers:['#ffffff','#dbe8f2'],rate:.06}};
  const SEASON_NAME=(()=>{const m=/[?&]season=(spring|summer|autumn|winter)\b/.exec(typeof location!=='undefined'?location.search||'':'');if(m)return m[1];
    const mo=new Date().getMonth();return mo>=2&&mo<=4?'spring':mo>=5&&mo<=7?'summer':mo>=8&&mo<=10?'autumn':'winter';})();
  const SEASON=SEASONS[SEASON_NAME];
  const seasonLeaf=i=>Array.isArray(SEASON.leaf)?SEASON.leaf[Math.abs(i)%SEASON.leaf.length]:SEASON.leaf;
  // The performance guard: when frames stay slow even at the lowest render scale, the finest ground detail and the small extras are switched off (?lite forces it).
  let lite=typeof location!=='undefined'&&/[?&]lite\b/.test(location.search||'');
  let gardenElements = 0, woodlandShapes = 0, terrainContours = 0, composedBuildings = 0, districtGardenRooms = 0;
  const COUNTRY_IDS=['town','india','japan','italy','netherlands','usa'];
  let country=COUNTRY_IDS.includes(options.country||window.ToyTownCountry?.id)?(options.country||window.ToyTownCountry.id):'town';
  let countryBuildings=0;
  let worldSeed = null, worldBuildings = null, worldPropCount = 0, sceneTime = 0, landmarkCount = 0;
  let lens = null;
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
  // Phones draw every shape at a fraction of the triangles: a head is ~15 px across there, so a 24x18 sphere is pure cost.
  const LOWPOLY = !desktop();
  const geo = (kind, ...dims) => {
    const key = kind + ':' + dims.join(':');
    if (!geometryCache.has(key)) {
      let shape;
      if (kind === 'round') shape = new RoundedBoxGeometry(dims[0],dims[1],dims[2],2,Math.min(dims[0],dims[1],dims[2])*.14);
      else if (kind === 'box') shape = new THREE.BoxGeometry(...dims);
      else if (kind === 'sphere') shape = LOWPOLY ? new THREE.SphereGeometry(dims[0],12,8) : new THREE.SphereGeometry(dims[0],16,12);
      else if (kind === 'ball') shape = new THREE.IcosahedronGeometry(dims[0],1);
      else if (kind === 'cylinder') shape = new THREE.CylinderGeometry(...dims,14);
      else if (kind === 'torus') shape = new THREE.TorusGeometry(...dims,7,12);
      else if (kind === 'plane') shape = new THREE.PlaneGeometry(...dims);
      else if (kind === 'clump') shape = clumpGeometry(dims[0], dims[1]);
      else if (kind === 'soft') shape = new RoundedBoxGeometry(dims[0],dims[1],dims[2],LOWPOLY?1:4,dims[3]);
      else if (kind === 'smooth') shape = LOWPOLY ? new THREE.SphereGeometry(dims[0],14,10) : new THREE.SphereGeometry(dims[0],24,18);
      else if (kind === 'capsule') shape = LOWPOLY ? new THREE.CapsuleGeometry(dims[0],dims[1],3,10) : new THREE.CapsuleGeometry(dims[0],dims[1],6,16);
      else if (kind === 'hairshell') shape = LOWPOLY ? new THREE.SphereGeometry(dims[0],14,8,0,Math.PI*2,0,Math.PI*.56) : new THREE.SphereGeometry(dims[0],24,14,0,Math.PI*2,0,Math.PI*.56);
      geometryCache.set(key,shape);
    }
    return geometryCache.get(key);
  };
  // Foliage like model-railway flock: a lumpy cluster of small leaf balls with
  // baked shading (darker underside and crevices, sunlit tips) instead of a
  // smooth sphere. Four seeded variants are shared by every tree.
  function clumpGeometry(radius, variant) {
    const g = new THREE.IcosahedronGeometry(radius, LOWPOLY?2:3), pos = g.attributes?.position, n = new THREE.Vector3();
    if (!pos) return g;   // headless test doubles carry no vertex data
    const lumps = Array.from({length: 11}, (_, k) => new THREE.Vector3(Math.sin(k * 2.4 + variant) * Math.cos(k * 1.3), Math.cos(k * 1.7 + variant * .7), Math.sin(k * 1.3) * Math.sin(k * 2.4 + variant)).normalize());
    const colors = new Float32Array(pos.count * 3), soft = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      n.fromBufferAttribute(pos, i).normalize();
      soft[i * 3] = n.x; soft[i * 3 + 1] = n.y * 1.08; soft[i * 3 + 2] = n.z;
      let bump = 0; for (const l of lumps) bump = Math.max(bump, Math.pow(Math.max(0, n.dot(l)), 7));
      const fine = Math.sin(n.x * 23 + variant) * Math.sin(n.y * 19) * Math.sin(n.z * 21 + variant * 2) * .5 + .5;
      const d = .9 + bump * .12 + fine * .035;
      pos.setXYZ(i, n.x * radius * d, n.y * radius * d * .92, n.z * radius * d);
      const shade = THREE.MathUtils.clamp(.62 + n.y * .2 + bump * .22 + fine * .1, .42, 1.12);
      colors[i * 3] = shade * .97; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade * .9;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    // Shade it like a soft ball (normals follow the sphere, not the lumpy facets): rounded, never faceted.
    const nrm = g.attributes.normal; for (let i = 0; i < pos.count; i++) nrm.setXYZ(i, (nrm.getX(i) * .25 + soft[i * 3] * .75), (nrm.getY(i) * .25 + soft[i * 3 + 1] * .75), (nrm.getZ(i) * .25 + soft[i * 3 + 2] * .75));
    nrm.needsUpdate = true;
    return g;
  }
  const leafGrain = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const p = c.getContext('2d');
    p.fillStyle = '#808080'; p.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) { const v = 60 + Math.floor(Math.random() * 150); p.fillStyle = `rgb(${v},${v},${v})`; p.beginPath(); p.ellipse(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.2, .8 + Math.random() * 1.4, Math.random() * 3, 0, 6.3); p.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat?.set(3, 3); return t;
  })();
  const leafCache = new Map();
  const leafMat = hex => {
    if (!leafCache.has(hex)) leafCache.set(hex, new THREE.MeshStandardMaterial({color: hex, vertexColors: true, roughness: .9, metalness: 0, bumpMap: leafGrain, bumpScale: 1.6}));
    return leafCache.get(hex);
  };
  /* ---- KayKit (CC0, Kay Lousberg): professionally modelled buildings, cars,
     trees and street props from assets/kaykit/kaykit-town.glb. Every model is a
     root named after it; clones share geometry and the single atlas texture. */
  const kit=(()=>{
    const root=options.kitScene;if(!root||!THREE.Box3)return null;
    const models=new Map();
    for(const node of root.children){
      const box3=new THREE.Box3().setFromObject(node),size=new THREE.Vector3(),centre=new THREE.Vector3();
      box3.getSize(size);box3.getCenter(centre);
      node.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
        // Softer, friendlier: matt, and lifted toward a warm cream so nothing reads as harsh saturated plastic.
        const ms=Array.isArray(o.material)?o.material:[o.material];
        for(const m of ms){if(m&&!m.userData.softened){m.userData.softened=true;m.roughness=1;m.metalness=0;if(m.emissive){m.emissive.set('#ffe9d6');m.emissiveIntensity=.17;}}}}});
      models.set(node.name,{node,size,min:box3.min.clone(),centre});
    }
    return models.size?models:null;
  })();
  // Recoloured copies of a kit material (its atlas texture hue-rotated by hand, because Safari has no canvas filter), shared
  // per hue so the static batching still merges them: the town's buildings are not all the same salmon.
  const hueCache=new Map();
  function hueVariant(material,hue){
    if(!hue||!material||!material.map||!material.map.image||typeof document==='undefined')return material;
    const key=material.uuid+':'+hue;if(hueCache.has(key))return hueCache.get(key);
    let out=material;
    try{
      const img=material.map.image,w=img.width||img.naturalWidth,h=img.height||img.naturalHeight;
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(img,0,0,w,h);
      const data=x.getImageData(0,0,w,h),px=data.data,a=hue*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
      const m=[.213+cs*.787-sn*.213,.715-cs*.715-sn*.715,.072-cs*.072+sn*.928,.213-cs*.213+sn*.143,.715+cs*.285+sn*.14,.072-cs*.072-sn*.283,.213-cs*.213-sn*.787,.715-cs*.715+sn*.715,.072+cs*.928+sn*.072];
      for(let i=0;i<px.length;i+=4){
        const r=px[i],g=px[i+1],b=px[i+2];
        let nr=m[0]*r+m[1]*g+m[2]*b,ng=m[3]*r+m[4]*g+m[5]*b,nb=m[6]*r+m[7]*g+m[8]*b;
        const l=.3*nr+.59*ng+.11*nb;   // a little softer than the original
        px[i]=Math.max(0,Math.min(255,l+(nr-l)*.82));px[i+1]=Math.max(0,Math.min(255,l+(ng-l)*.82));px[i+2]=Math.max(0,Math.min(255,l+(nb-l)*.82));
      }
      x.putImageData(data,0,0);
      const tex=new THREE.CanvasTexture(c);const src=material.map;
      tex.flipY=src.flipY;tex.colorSpace=src.colorSpace;tex.wrapS=src.wrapS;tex.wrapT=src.wrapT;tex.anisotropy=src.anisotropy;tex.magFilter=src.magFilter;tex.minFilter=src.minFilter;
      out=material.clone();out.map=tex;out.userData={...material.userData};
    }catch(e){out=material;}
    hueCache.set(key,out);return out;
  }
  // Place a clone so its footprint fits `fit` (world units) and its base sits at `y`.
  function kitPlace(parent,name,x,y,z,{fit=null,scale=null,rotY=0,height=null,pivot=false,squash=1,hue=0}={}){
    const m=kit&&kit.get(name);if(!m)return null;
    const s=scale??(height?height/m.size.y:fit/Math.max(m.size.x,m.size.z));
    const holder=new THREE.Group(),clone=m.node.clone(true);
    const sy=s*squash;clone.position.set(pivot?0:-m.centre.x*s,-m.min.y*sy,pivot?0:-m.centre.z*s);clone.scale.set(s,sy,s);   // pivot: keep the model's own origin (a lamp post's foot)
    if(hue)clone.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(q=>hueVariant(q,hue)):hueVariant(o.material,hue);});
    holder.add(clone);holder.position.set(x,y,z);holder.rotation.y=rotY;parent.add(holder);
    holder.userData.kit=name;holder.userData.size={x:m.size.x*s,y:m.size.y*sy,z:m.size.z*s};
    return holder;
  }
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
  // Name boards: painted plates with a coloured face, a double border, studs, ornaments and a carved-looking serif lettering; known
  // shops get their own colours (warm terracotta for the bakery, deep green and gold for the books, a market-stall yellow...).
  const BOARDS={
    'BAKERY':{bg:['#dc875f','#b4603c'],edge:'#f6e0bd',ink:'#fff4e0',deco:'wheat'},
    'BOOK NOOK':{bg:['#3f7d72','#2a5a52'],edge:'#e0bf6a',ink:'#fbeeb8',deco:'book'},
    'MARKET':{bg:['#f2c05a','#dd9a35'],edge:'#8a4b22',ink:'#5b2c10',deco:'stripes'},
    'FIRE':{bg:['#c85044','#9c352c'],edge:'#f0c36a',ink:'#fff0d0'},
    'POST':{bg:['#4f83b4','#35618e'],edge:'#f3e2b3',ink:'#ffffff'},
    'GARDEN':{bg:['#6aa56a','#4a8350'],edge:'#f3e2b3',ink:'#fffbe8'},
    'BUS':{bg:['#3b8d96','#2a6d77'],edge:'#f3e2b3',ink:'#ffffff'},
    'TOWN TIMES':{bg:['#f5ecd2','#e4d5b1'],edge:'#5a4b36',ink:'#3a2e22'},
    'TOY TOWN':{bg:['#2f7766','#215a4d'],edge:'#e4c66a',ink:'#fff3c9',deco:'stars'},
    'BUILDING SITE':{bg:['#f4c542','#e0a800'],edge:'#2b2b2b',ink:'#2b2b2b',deco:'hazard'}
  };
  function boardTexture(label,ink,paper){
    const st=BOARDS[label]||{bg:[paper,paper],ink,edge:ink};
    const cvs=document.createElement('canvas');cvs.width=512;cvs.height=192;
    const cx=cvs.getContext('2d'),known=!!BOARDS[label];
    cx.fillStyle=known?'#f3eddf':paper;
    cx.beginPath();cx.roundRect(8,16,496,160,12);cx.fill();
    cx.strokeStyle=known?tint(st.bg[1],'#5c6254',.5):ink;cx.lineWidth=3;cx.stroke();
    cx.textAlign='center';cx.textBaseline='middle';
    cx.font=`600 ${label.length>12?42:label.length>8?50:60}px Nunito,system-ui,sans-serif`;
    cx.fillStyle=known?tint(st.bg[1],'#263b35',.65):ink;
    cx.fillText(label,256,98,452);

    const tx=new THREE.CanvasTexture(cvs);tx.colorSpace=THREE.SRGBColorSpace;return tx;
  }
  function sign(parent, label, x,y,z,w, ink='#575049',paper='#fff0d0'){
    const tx=boardTexture(label,ink,paper);
    const mesh=object(parent,geo('plane',w,w*192/512),new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide}),x,y,z,false);
    box(mesh,w+.012,w*192/512+.012,.018,'#927d61',0,0,-.013,false);
    mesh.userData.ownedTexture=tx;
    return mesh;
  }
  // A painted arrow board for a signpost: points along +x (dir 1) or -x (dir -1).
  function arrowBoard(parent,label,x,y,z,w,dir,col){
    const cvs=document.createElement('canvas');cvs.width=512;cvs.height=160;const cx=cvs.getContext('2d');
    cx.save();if(dir<0){cx.translate(512,0);cx.scale(-1,1);}
    cx.fillStyle='rgba(40,30,20,.2)';cx.beginPath();cx.moveTo(14,26);cx.lineTo(380,26);cx.lineTo(500,84);cx.lineTo(380,142);cx.lineTo(14,142);cx.closePath();cx.fill();
    cx.fillStyle=col;cx.strokeStyle='#fbf0d6';cx.lineWidth=9;cx.beginPath();cx.moveTo(8,18);cx.lineTo(374,18);cx.lineTo(496,76);cx.lineTo(374,134);cx.lineTo(8,134);cx.closePath();cx.fill();cx.stroke();
    cx.restore();
    cx.textAlign='center';cx.textBaseline='middle';cx.font='italic 700 62px Georgia,serif';cx.fillStyle='#fffaf0';cx.fillText(label,dir>0?212:300,80,320);
    const tx=new THREE.CanvasTexture(cvs);tx.colorSpace=THREE.SRGBColorSpace;
    const m=object(parent,geo('plane',w,w*160/512),new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide}),x,y,z,false);m.userData.ownedTexture=tx;return m;
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
    // Living meadow green rather than a chalky mint: the photographed-miniature
    // grade needs real colour in the lawns to read as flock grass.
    const pale=tint(tint(color,'#5d9850',.38),'#f4e7bd',.06);
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
    // Relief and wetness: stones stand proud of their joints; the joints and
    // a few puddles hold water, so they turn glossy and catch the sky and lamps.
    const relief=document.createElement('canvas');relief.width=relief.height=256;
    const q=relief.getContext('2d');q.fillStyle='#202020';q.fillRect(0,0,256,256);
    const wet=document.createElement('canvas');wet.width=wet.height=256;
    const w=wet.getContext('2d');w.fillStyle='#4a4a4a';w.fillRect(0,0,256,256);
    for(let row=0;row<15;row++)for(let col=-1;col<10;col++){
      const x=col*29+(row%2)*14.5,y=row*18.5,g=q.createRadialGradient(x+14,y+8,2,x+14,y+9,16);
      g.addColorStop(0,'#f0f0f0');g.addColorStop(1,'#8a8a8a');
      q.fillStyle=g;q.beginPath();q.roundRect(x+2,y+2,25,14.5,5);q.fill();
      const dry=150+Math.floor(rng(row*31+col,903)*60);
      w.fillStyle=`rgb(${dry},${dry},${dry})`;w.beginPath();w.roundRect(x+2.5,y+2.5,24,13.5,5);w.fill();
    }
    for(let i=0;i<5;i++){
      const x=rng(i,461)*256,y=rng(i,977)*256,r=14+rng(i,233)*22,g=w.createRadialGradient(x,y,1,x,y,r);
      g.addColorStop(0,'rgba(18,18,18,.95)');g.addColorStop(.7,'rgba(30,30,30,.6)');g.addColorStop(1,'rgba(30,30,30,0)');
      w.fillStyle=g;w.beginPath();w.ellipse(x,y,r,r*.6,rng(i,51)*TAU,0,TAU);w.fill();
    }
    const tex=c=>{const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(map.repeat)t.repeat?.copy(map.repeat);return t;};
    const surface=new THREE.MeshStandardMaterial({map,color:'#c9c6b8',roughness:1,metalness:0,
      bumpMap:tex(relief),bumpScale:2.2,roughnessMap:tex(wet),envMapIntensity:3.2});
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
  // Six position-seeded species vary crown shape, bark and seasonal colour.
  // The geometry stays inexpensive: wide, interlocking ellipsoids with exposed
  // branching and planted, shadowed root flares; no leaf particle systems.
  function tree(p,i){
    if(Math.hypot(p.x-CINEMA.x,p.y-CINEMA.z)<1.7)return;   // the open-air cinema has this corner
    if(p.y>17&&Math.abs(p.x-RAIL.stationX)<2.7)return;          // the railway station
    if(p.x>17&&Math.abs(p.y-9.55)<1.3)return;                   // the windmill
    if(p.x<1.2&&p.y>2&&p.y<6.1)return;                        // the sheep pasture
    const x=p.x,z=p.y;
    // Keep the foreground riverbank open so the miniature village can be
    // read through the trees. The side orchards still frame the lens.
    const riverForeground=z>=10.85&&z<=13.15;
    const seed=Math.abs(Math.round(x*19+z*31));
    const sc=(p.s||1)*(riverForeground?.69:z<7?.94:.90)*(.86+rng(seed,41)*.17);
    const g=new THREE.Group();g.position.set(x,0,z);world.add(g);g.scale.setScalar(sc);
    g.userData.woodlandSilhouette=true;
    const family=['oak','birch','cypress','willow','orchard','acacia'][seed%6];
    g.userData.treeSpecies=family;
    const mist=THREE.MathUtils.clamp((9-z)/17,0,.28);
    const plantedHue=p.c?tint(p.c,'#839d89',.76):'#86a58b';
    const foliage=(color)=>leafMat(tint(tint(tint(tint(color,plantedHue,.13),'#d4dbc4',mist),'#3f7a45',.22),seasonLeaf(i),SEASON.k*(family==='cypress'?.18:family==='willow'?.42:.85)));
    groundingShadow(x,z,1.15*sc,1.04*sc,.166);
    const height=family==='birch'?.85:family==='acacia'?.79:family==='cypress'?.69:.66;
    const bark=family==='birch'?'#c9cbbb':family==='willow'?'#7d8067':'#826b54';
    const trunk=cylinder(g,family==='birch'?.030:.040,family==='birch'?.042:.070,height,bark,0,height*.51,0);
    if(family==='birch')for(let n=0;n<5;n++)box(g,.04,.012,.010,'#7b806f',(n%2-.5)*.009,.24+n*.11,.035,false);
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
        const leaf=object(g,geo('clump',radius,k%4),foliage(
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
    const under=object(g,geo('clump',.38,i%4),foliage(shade),
      .025,.84,-.016,false);
    under.scale.set(family==='birch'?.65:1.0,family==='acacia'?.24:.40,family==='birch'?.6:.9);
    if(family==='acacia')under.position.y=1.02;
    const branching=[[-.19,.73,-.02,.46],[.19,.72,.02,-.46],[0,.77,.15,.14]];
    for(const [bx,by,bz,twist] of branching){
      const stem=cylinder(g,.018,.032,.43,'#806b54',bx*.49,by,bz*.55);
      stem.rotation.z=twist;stem.castShadow=false;
    }
    const isWeeping=family==='willow';
    const lobes=family==='birch'?[[-.13,.96,-.03,.19,.25,.17],[.13,1.11,.02,.19,.26,.18],[-.03,1.30,-.03,.17,.22,.16],[.03,.88,.17,.17,.21,.16]]:
      family==='acacia'?[[-.26,1.04,-.05,.36,.13,.28],[.24,1.10,-.09,.37,.14,.27],[.01,1.15,.15,.40,.12,.31]]:
      family==='orchard'?[[-.20,.85,-.02,.25,.23,.24],[.18,.89,-.12,.27,.24,.24],[.06,1.06,.12,.27,.23,.24],[-.10,.83,.22,.22,.22,.22]]:isWeeping?[
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
      const leaf=object(g,geo('clump',.40,(i+k)%4),foliage(col),xx,yy,zz,false);
      leaf.scale.set(rx/.4,ry/.4,rz/.4);
      leaf.rotation.y=(rng(i,k+52)-.5)*.55;
    }
    if(isWeeping){
      // Cascading willow fronds soften the repeated round-crown profile.
      for(let k=0;k<8;k++){
        const a=k*TAU/8+.17,rad=.29+(k%3)*.037;
        const frond=object(g,geo('clump',.20,k%4),   // a clump carries the vertex colours the foliage material reads; a plain sphere draws black
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
  function plantedBed(parent,x,z,rx,rz,variant=0,y=.22){
    const bed=new THREE.Group();bed.position.set(x,y,z);parent.add(bed);
    bed.userData.plantedBed=true;
    const soil=cylinder(bed,1,1,.015,'#a18c6c',0,0,0);soil.scale.set(rx,1,rz);soil.castShadow=false;
    for(let k=0;k<7;k++){
      const a=k*2.4+variant,r=k===0?0:.55;
      const xx=Math.cos(a)*rx*r,zz=Math.sin(a)*rz*r,h=.065+(k%3)*.018;
      cylinder(bed,.004,.005,h,'#668463',xx,h/2,zz).castShadow=false;
      const leaf=ball(bed,.026,'#7b9b6f',xx+.012,.027,zz);leaf.scale.set(1.4,.24,.65);leaf.castShadow=false;
      const bloom=ball(bed,.029,['#e9caa9','#e7b9bd','#f0e6c6'][variant%3],xx,h,zz);bloom.scale.set(1,.45,1);bloom.castShadow=false;
      ball(bed,.010,'#c6a45f',xx,h+.014,zz).castShadow=false;
    }
    return bed;
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
    if(kit&&kitPlace(world,'bench',p.x,.17,p.y,{fit:.46}))return;
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
  // Distinct service fixtures occupy simulator-approved free lots.
  // An outer district no longer consists of background buildings alone.
  function districtFixture(p){
    const g=new THREE.Group();g.position.set(p.x,.20,p.y);
    g.userData.districtSceneRole=p.role;world.add(g);
    const wood='#ac8665',cream='#f5e3c1';
    if(p.role==='garden'){
      box(g,.69,.16,.56,wood,0,.095,0);
      box(g,.59,.05,.48,'#795e4b',0,.202,0);
      for(let k=0;k<9;k++){
        const x=(k%3-1)*.17,z=(Math.floor(k/3)-1)*.15;
        cylinder(g,.01,.011,.17,'#689777',x,.31,z).castShadow=false;
        const head=ball(g,.064,['#e98f8d','#f1c77e','#a5a6d6'][k%3],x,.4,z);
        head.scale.set(.96,.58,.86);head.castShadow=false;
      }
      for(const x of [-.23,.23])cylinder(g,.019,.022,.44,wood,x,.345,-.31);
      sign(g,'GARDEN',0,.55,-.31,.34);
    }else if(p.role==='post'){
      for(const x of [-.33,.33])cylinder(g,.029,.032,.88,wood,x,.62,-.24);
      box(g,.84,.085,.54,'#e18a6b',0,1.07,-.10);
      box(g,.74,.16,.39,'#719fa2',0,.51,0);
      box(g,.80,.055,.43,cream,0,.62,0);
      for(let k=0;k<4;k++){
        const x=(k-1.5)*.17;
        box(g,.14,.13+(k%2)*.08,.17,k%2?'#f0c991':'#d2aa78',
          x,.72+(k%2)*.04,-.04);
        box(g,.018,.01,.17,'#fff0d0',x,.797+(k%2)*.080,-.04);
      }
      sign(g,'POST',0,.89,.19,.40);
    }else if(p.role==='art'){
      for(const side of [-1,1]){
        const leg=cylinder(g,.025,.027,.92,wood,side*.21,.54,-.12);
        leg.rotation.z=side*.20;
      }
      const board=box(g,.72,.68,.048,'#fff0da',0,.85,.047);
      board.rotation.x=-.11;
      box(g,.56,.13,.056,'#80b7bf',0,1.03,.105);
      box(g,.55,.11,.057,'#e4a681',0,.64,.105);
      for(let k=0;k<6;k++){
        const paint=ball(g,.088,['#db8e86','#ebc682','#86aa9a'][k%3],
          (k%3-1)*.17,.87-(k>2?.1:0),.157);
        paint.scale.set(1.18,.68,.22);paint.castShadow=false;
      }
      box(g,.72,.045,.16,wood,0,.49,.21);
    }else{
      produceStall(g,0,0);

    }
  }
  function produceStall(parent,x,z){
    const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);g.userData.marketStall=true;
    const wood='#9b7857',cream='#eee4ce',sage='#708d75';
    for(const dx of [-.28,.28])for(const dz of [-.12,.12])box(g,.025,.20,.025,wood,dx,.10,dz);
    box(g,.67,.035,.34,wood,0,.22,0);
    for(let bin=0;bin<3;bin++){
      const bx=(bin-1)*.205;
      box(g,.19,.025,.25,'#b5986d',bx,.255,0);
      for(const dz of [-.115,.115])box(g,.19,.07,.014,wood,bx,.285,dz);
      for(const dx of [-.09,.09])box(g,.014,.07,.23,wood,bx+dx,.285,0);
      for(let i=0;i<6;i++){
        const px=bx+(i%2-.5)*.065,pz=(Math.floor(i/2)-1)*.066;
        const fruit=ball(g,.031,['#bd5f48','#d9b35e','#83a269'][bin],px,.302,pz);
        fruit.scale.set(1,bin===2?.8:1,1);fruit.castShadow=false;
        cylinder(g,.0025,.003,.016,'#657b51',px,.339,pz).castShadow=false;
      }
    }
    for(const dx of [-.32,.32])cylinder(g,.012,.016,.62,wood,dx,.34,-.16);
    fabric(g,0,.655,-.025,sage,.78,.45);
    sign(g,'MARKET',0,.49,-.14,.32,'#344b3d',cream);
    // A closed spare crate under the counter makes the silhouette readable.
    box(g,.18,.12,.20,'#b89b70',-.19,.064,0);
  }
  function playingField(p){
    const g=new THREE.Group();g.position.set(p.x,0,p.y);world.add(g);g.userData.playingField=true;
    cylinder(g,1.42,1.44,.025,'#d0c6ad',0,.124,0);
    cylinder(g,1.36,1.36,.009,'#8aae7d',0,.141,0);
    const cv=document.createElement('canvas');cv.width=512;cv.height=512;const c=cv.getContext('2d');
    c.clearRect(0,0,512,512);c.strokeStyle='#eeeadd';c.lineWidth=4;c.strokeRect(42,76,428,360);
    c.beginPath();c.moveTo(256,76);c.lineTo(256,436);c.stroke();c.beginPath();c.arc(256,256,50,0,TAU);c.stroke();
    c.strokeRect(42,175,65,160);c.strokeRect(405,175,65,160);
    const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
    const pitch=object(g,geo('plane',2.25,1.8),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),0,.148,0,false);pitch.rotation.x=-Math.PI/2;
    for(const side of [-1,1]){
      for(const z of [-.25,.25])cylinder(g,.01,.01,.25,'#ede7d6',side*1.03,.27,z);
      cylinder(g,.01,.01,.52,'#ede7d6',side*1.03,.395,0).rotation.x=Math.PI/2;
      for(let k=-2;k<=2;k++){
        cylinder(g,.002,.002,.23,'#d5d6c4',side*1.16,.26,k*.1).castShadow=false;
        const tie=cylinder(g,.002,.002,.15,'#d5d6c4',side*1.10,.38,k*.1);tie.rotation.z=Math.PI/2;tie.castShadow=false;
      }
    }
  }
  function publicVenue(p){
    const g=new THREE.Group();g.position.set(p.x,.17,p.y);world.add(g);g.userData.publicPlace=p.kind;
    box(g,2.0,.025,1.5,'#ded4bd',0,.012,0,false);
    if(p.kind==='market'){produceStall(g,-.48,0);produceStall(g,.48,0);}
    else if(p.kind==='stage'){
      box(g,1.55,.025,1.0,'#a58c69',0,.025,0);
      for(const x of [-.7,.7]){box(g,.14,.24,.14,'#565d59',x,.16,-.3);cylinder(g,.012,.012,.65,'#746b5a',x,.35,-.48);}
      fabric(g,0,.7,-.15,'#a88b78',1.62,.85);
      sign(g,'MUSIC',0,.53,-.48,.43);
    }else if(p.kind==='lab'){
      box(g,1.0,.48,.72,'#d6e1d9',0,.25,-.12);
      for(const x of [-.31,0,.31])pane(g,x,.32,.254,.20,.19);
      box(g,1.12,.04,.82,'#77928a',0,.51,-.12);
      for(let i=0;i<3;i++){const solar=box(g,.24,.012,.32,'#4f7184',(i-1)*.30,.55,-.12,false);solar.rotation.x=.2;}
      sign(g,'SCIENCE',0,.43,.281,.55);
    }else{
      for(const x of [-.8,.8])for(let i=0;i<7;i++)box(g,.018,.22,.022,'#a08b6e',x,.11,-.6+i*.2);
      for(const z of [-.6,.6])for(let i=0;i<9;i++)box(g,.022,.22,.018,'#a08b6e',-.8+i*.2,.11,z);
      for(const x of [-.42,.42]){cylinder(g,.025,.035,.35,'#8e7859',x,.18,-.2);ball(g,.24,'#819b70',x,.45,-.2).scale.set(1,.75,1);}
      sign(g,'WILDLIFE',0,.29,.61,.52);
    }
  }
  function smallProps(p,i){
    const k=p.kind;
    if((k==='tree'||k==='flowers'||k==='hero-shrub')&&p.x>7&&p.x<11&&p.y>7.9&&p.y<11)return;   // the city centre is paved
    if(k.startsWith('hero-'))return;   // cityCentre owns the square's furniture; do not stack legacy props
    if(k==='tree')tree(p,i);
    else if(k==='district-scene')districtFixture(p);
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
      // A slim jet that arches into the pool in six thin falling streams (it was an egg).
      const jetMat=mat('#cdeff6',.12,'#7fb6c8');
      cylinder(world,.016,.03,.3,jetMat,p.x,.5,p.y,false);
      ball(world,.034,jetMat,p.x,.66,p.y,false);
      for(let a=0;a<6;a++){
        const ang=a*Math.PI/3+.3,rr=.2;
        for(let k=1;k<=3;k++){const u=k/3,r=.04+rr*u,y=.62-.35*u*u+.05*u;ball(world,.017-.003*k,jetMat,p.x+Math.cos(ang)*r,y,p.y+Math.sin(ang)*r,false);}
      }
      const ring=object(world,geo('torus',.3,.008),mat('#eaf9fb',.4),p.x,.235,p.y,false);ring.rotation.x=Math.PI/2;
    }
    else if(k==='stadium')playingField(p);
    else if(k==='launchpad'){
      cylinder(world,.75,.82,.16,'#ddc9b3',p.x,.09,p.y);
      const r=cylinder(world,.115,.15,1.55,'#f1e5d4',p.x,.87,p.y);
      cylinder(world,.02,.13,.32,'#c85f57',p.x,1.81,p.y);
      for(const t of [-1,1])box(world,.075,.25,.19,'#d66d58',p.x+t*.18,.25,p.y);
    }
    else if(k==='stage'||k==='lab'||k==='market'||k==='zoo')publicVenue(p);
    else if(k==='flowers')littleFlowers(p.x,p.y,i);
    else if(k==='duck') {
      // The 2D simulation already supplies accurate water coordinates. Small, rounded river ducks in three plumages
      // (yellow, mallard with a green head and white collar, white) with a neck, an upturned tail, a bill and eyes.
      const duck=new THREE.Group();duck.position.set(p.x,.21,p.y);duck.scale.setScalar(.4+(i%3)*.03);world.add(duck);
      const kindOfDuck=i%3,bodyCol=['#f9d767','#b49272','#fffaf0'][kindOfDuck],headCol=['#fbe083','#2f8a63','#fffaf0'][kindOfDuck];
      const wingCol=['#e9c76b','#8d6e52','#f0e8d8'][kindOfDuck];
      const body=ball(duck,.11,bodyCol,0,0,0);body.scale.set(1.3,.72,.95);
      const tail=ball(duck,.05,wingCol,-.145,.05,0);tail.scale.set(1.2,.7,.8);tail.rotation.z=.5;
      ball(duck,.062,bodyCol,.075,.045,0).scale.set(1,1.1,.9);            // chest and neck
      ball(duck,.058,headCol,.108,.125,0);                                  // head
      if(kindOfDuck===1)box(duck,.012,.03,.1,'#fffaf0',.082,.08,0,false);  // the mallard's white collar
      box(duck,.055,.02,.045,'#f2a03d',.17,.112,0,false);                  // bill
      for(const side of [-1,1])ball(duck,.011,'#2b2b2b',.13,.14,side*.038).castShadow=false;
      const wings=[];
      for(const side of [-1,1]){
        const wing=new THREE.Group();wing.position.set(-.028,.034,side*.078);
        const plumage=ball(wing,.069,wingCol,-.025,0,side*.013);
        plumage.scale.set(1.05,.45,.65);duck.add(wing);wings.push(wing);
      }
      duck.userData.duckWings=wings;
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
      plantedBed(world,x,z,spread*.95,spread*.8,seedNo%3,.245);
      gardenElements+=8;
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
      bed.rotation.x=-Math.PI/2;bed.userData.gardenIsland=true;
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
    // Smaller lawn islands soften the outer borough blocks as well, without
    // landing inside any home, river, street, or procedural event building.
    const buildings=town.buildings(),props=town.props();
    const playground=freeSpots().find(s=>s.clear>.6);
    const obstacles=[...(playground?[[playground.x,playground.z,1.15]]:[]),...buildings.map(b=>b.kind==='site'?[b.x+1,b.y+1,2.0]:[b.x+.5,b.y+.5,.78]),
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
    // One compact cafe corner, with furniture scaled relative to a resident.
    const cafeSet=(x,z)=>{
      const g=new THREE.Group();g.position.set(x,CENTRE_TOP,z);world.add(g);
      g.userData.squareFixture='cafe';
      cylinder(g,.018,.035,.27,wood,0,.135,0);
      cylinder(g,.18,.18,.032,'#b38c65',0,.286,0);
      for(const dx of [-.27,.27]){
        for(const dz of [-.06,.06])cylinder(g,.012,.015,.18,wood,dx,.09,dz);
        box(g,.15,.025,.15,'#b38c65',dx,.19,0);
        box(g,.15,.13,.018,'#b38c65',dx,.26,-.07);
      }
      cylinder(g,.025,.022,.032,'#f6eee0',.07,.32,.04);
      const umbrella=new THREE.Group();g.add(umbrella);
      cylinder(umbrella,.012,.017,.72,wood,0,.36,0);
      object(umbrella,new THREE.ConeGeometry(.32,.11,12),mat('#e9d9b9',.9),0,.755,0,false);
      ambient.push({kind:'umbrella',mesh:umbrella,phase:0});
      gardenElements+=12;
    };
    cafeSet(7.77,8.72);
    // (The pinwheels and tethered balloons that crowded the square are retired.)
    cityCentre();
    gardenElements+=86;
  }
  /* One open civic square. A single furniture layer, restrained paving,
     clear north/south walking corridors and flush shopfronts replace the
     former medallion, duplicate lamps, oversized tables and kiosk roofs. */
  function cityCentre(){
    const cc=new THREE.Group();world.add(cc);cc.userData.citySquare=true;
    const stone=mat('#eadfc9',.94),edge=mat('#cfbfa5',.95),cream=mat('#f1e7d4',.9);
    const wood=mat('#947153'),iron=mat('#514a3e',.7);
    const slab=(x0,x1,z0,z1,material,top,h)=>{
      const o=box(cc,x1-x0,h,z1-z0,material,(x0+x1)/2,top-h/2,(z0+z1)/2,false);
      o.castShadow=false;o.receiveShadow=true;return o;
    };
    slab(7.04,10,8.04,10.96,stone,CENTRE_TOP,.06);
    slab(10,10.96,9,10,stone,CENTRE_TOP,.06);
    // A quiet stone soldier course, not multiple coloured ornamental borders.
    for(const [x0,x1,z0,z1] of [[7.04,7.10,8.04,10.96],[7.04,10,10.90,10.96]])
      slab(x0,x1,z0,z1,edge,CENTRE_TOP+.001,.012);
    // Low elongated planting along the margins, never on a shop approach.
    for(const [x,z,w,d] of [[7.28,8.72,.23,.95],[7.55,10.75,.78,.22],[10.65,9.88,.48,.17]]){
      const g=new THREE.Group();g.position.set(x,CENTRE_TOP,z);cc.add(g);g.userData.squareFixture='planter';
      box(g,w,.072,d,cream,0,.036,0);box(g,w-.035,.009,d-.035,'#786f52',0,.076,0,false);
      const along=w>d,count=along?5:6;
      for(let k=0;k<count;k++){
        const t=(k/(count-1)-.5)*(along?w-.09:d-.09),px=along?t:0,pz=along?0:t;
        const sh=ball(g,.064,k%2?'#8aa477':'#78956d',px,.125,pz);sh.scale.set(1,.7,1);sh.castShadow=false;
        if(k%3===1){const fl=ball(g,.018,'#e7b9a5',px+.025,.16,pz+.012);fl.castShadow=false;}
      }
    }
    // One bench against the west edge; its simulation seat is in this same place.
    {const g=new THREE.Group();g.position.set(7.38,CENTRE_TOP,9.80);g.rotation.y=Math.PI/2;cc.add(g);g.userData.squareFixture='bench';
      for(const x of [-.21,.21])for(const z of [-.07,.07])box(g,.018,.17,.022,iron,x,.085,z);
      for(let i=0;i<3;i++)box(g,.52,.025,.047,wood,0,.18,(i-1)*.052);
      for(let i=0;i<2;i++)box(g,.52,.045,.023,wood,0,.245+i*.055,-.074);
      for(const x of [-.21,.21])box(g,.018,.23,.025,iron,x,.16,-.08);
    }
    // Two slim, single lanterns. Each has one warm source, at human scale.
    for(const [x,z] of [[7.25,8.22],[9.88,10.72]]){
      const g=new THREE.Group();g.position.set(x,CENTRE_TOP,z);cc.add(g);g.userData.squareFixture='lantern';
      cylinder(g,.035,.045,.035,iron,0,.018,0);cylinder(g,.012,.021,.56,iron,0,.30,0);
      const glass=box(g,.062,.09,.062,new THREE.MeshStandardMaterial({color:'#fff0d3',emissive:'#ffca88',emissiveIntensity:.32,roughness:.4}),0,.61,0,false);
      cylinder(g,.055,.055,.017,iron,0,.557,0);object(g,new THREE.ConeGeometry(.065,.047,8),iron,0,.68,0,false);
      for(const dx of [-.034,.034])for(const dz of [-.034,.034])box(g,.006,.106,.006,iron,dx,.61,dz,false);
      festoonBulbs.push(glass);
      const glow=new THREE.PointLight('#ffd19a',0,1.7,2);glow.position.set(x,CENTRE_TOP+.61,z);glow.castShadow=false;world.add(glow);plazaLights.push(glow);
    }
    // One low basin, with a grounded continuous jet instead of hovering droplets.
    {const g=new THREE.Group();g.position.set(9,CENTRE_TOP,10.48);cc.add(g);g.userData.squareFixture='fountain';
      cylinder(g,.29,.31,.07,cream,0,.035,0);
      cylinder(g,.257,.257,.014,new THREE.MeshStandardMaterial({color:'#8cbec5',roughness:.27,metalness:.05}),0,.071,0);
      const rim=object(g,geo('torus',.283,.018),cream,0,.077,0,false);rim.rotation.x=Math.PI/2;
      cylinder(g,.035,.06,.035,stone,0,.09,0);
      const stream=new THREE.Group();stream.position.y=.107;g.add(stream);
      const jet=cylinder(stream,.012,.021,.20,mat('#c5e2df',.25),0,.10,0);jet.castShadow=false;
      const tip=ball(stream,.018,'#c5e2df',0,.204,0);tip.scale.set(.7,1,.7);tip.castShadow=false;
      for(let k=0;k<2;k++){const ring=object(g,geo('torus',.12+k*.065,.004),mat('#d9efeb',.5),0,.081,0,false);ring.rotation.x=Math.PI/2;
        ambient.push({kind:'sea',mesh:ring,phase:k*1.7,y0:.081});}
      ambient.push({kind:'squareJet',mesh:stream});
    }
    gardenElements+=42;
  }
  function paintVillageLife(){
    // Faint staggered sandstone joints. This is a flat surface, not an extra
    // raised floor: feet and all furniture share CENTRE_TOP.
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=768;
    const pen=canvas.getContext('2d');pen.clearRect(0,0,768,768);
    pen.strokeStyle='rgba(139,119,90,.17)';pen.lineWidth=1;
    for(let row=0;row<12;row++){
      const y=row*64;pen.beginPath();pen.moveTo(0,y);pen.lineTo(768,y);pen.stroke();
      for(let x=(row%2)*64;x<768;x+=128){pen.beginPath();pen.moveTo(x,y);pen.lineTo(x,y+64);pen.stroke();}
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide});
    const tile=object(world,geo('plane',2.96,2.92),material,8.52,CENTRE_TOP+.0015,9.5,false);
    tile.rotation.x=-Math.PI/2;tile.userData.plazaInlay=true;tile.userData.villagePiazza=true;
    const wing=object(world,geo('plane',.96,1),material,10.48,CENTRE_TOP+.0015,9.5,false);wing.rotation.x=-Math.PI/2;
  }

  // Painted landscape composition: irregular planted contours and natural
  // hedgerow ribbons are fitted into *clear lots*, not onto streets, buildings,
  // theme events, or scripted walking destinations. This is a visual-only
  // terrain layer; the simulation's 18x18 road graph stays untouched.
  function createLandscapeComposition(){
    // Reserve the same play site before the static gardens are batched.
    const playground=freeSpots().find(s=>s.clear>.6);
    const occupied=[
      ...(playground?[[playground.x,playground.z,1.15]]:[]),
      ...town.buildings().map(b=>b.kind==='site'?[b.x+1,b.y+1,2.35]:[b.x+.5,b.y+.5,.81]),
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
      // Low soil and individual stems make these read as flower beds.
      plantedBed(world,x,z,rx*.8,rz*.8,variant%3,.225);
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

    // Five district pockets form small natural gardens between staggered
    // houses. Candidate centers are collision-tested against real generated
    // buildings, trees, stage props, roads and the hero plaza. The resulting
    // composition adapts to each day's thematic blocks without floating pots
    // or fences across the moving traffic.
    const rooms=[[3.9,3.9],[8.9,3.9],[13.9,3.9],[3.9,8.9],[13.9,8.9]];
    const offsets=[[0,0],[.58,.38],[-.58,-.40],[.55,-.58],[-.55,.57],
      [0,.80],[.80,0]];
    for(let district=0;district<rooms.length;district++){
      const [cx,cz]=rooms[district];
      let chosen=null;
      for(const [dx,dz] of offsets){
        if(clear(cx+dx,cz+dz,.39)){
          chosen=[cx+dx,cz+dz];break;
        }
      }
      if(!chosen)continue;
      const [x,z]=chosen,seed=district+town.debug().seed%97;
      const terrace=object(world,geo('sphere',.53),
        mat(district%2?'#a9b895':'#abbda0'),x,.183,z,false);
      terrace.scale.set(1,.095,.78);
      terrace.userData.districtGarden=true;
      const ring=object(world,geo('torus',.36,.027),
        mat('#d9cab0'),x,.215,z,false);
      ring.rotation.x=-Math.PI/2;
      ring.scale.set(1,.82,1);
      plantedBed(world,x,z,.29,.24,district%3,.228);
      districtGardenRooms++;
    }
  }


  // Naturalistic cutaway base and gently wandering road edges. Physics and
  // navigation continue to use the original perfectly straight road centers.
  // Only the physical visible outer shoulders are irregular.
  function organicBoardOutline(inset=0){
    const half=10.4-inset,corner=1.72+inset*.12;
    const shape=new THREE.Shape();
    const corners=[
      [half-corner,half-corner,0],
      [-half+corner,half-corner,Math.PI/2],
      [-half+corner,-half+corner,Math.PI],
      [half-corner,-half+corner,Math.PI*1.5]
    ];
    // Traverse counter-clockwise around four gently weathered corners.
    let started=false;
    for(const [cx,cz,start] of corners){
      for(let k=0;k<=10;k++){
        const angle=start+k*Math.PI/20;
        const jitter=.055*Math.sin(5*angle+1.1)+.024*Math.sin(13*angle);
        const radius=corner+jitter;
        const x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius;
        if(!started){shape.moveTo(x,-z);started=true;}
        else shape.lineTo(x,-z);
      }
    }
    shape.closePath();
    return shape;
  }
  function terrainCutaway(){
    // A single sculpted piece makes wood, soil and meadow follow one outline,
    // with exposed earthy depth rather than four machined vertical walls.
    const wood=object(world,new THREE.ExtrudeGeometry(organicBoardOutline(),{
      depth:1.10,bevelEnabled:true,bevelThickness:.038,bevelSize:.047,
      bevelSegments:2,steps:1
    }),mat('#9a816d'),9,-1.12,9,false);
    wood.rotation.x=-Math.PI/2;wood.receiveShadow=true;
    wood.userData.terrainCutaway='wood';
    const earth=object(world,new THREE.ExtrudeGeometry(organicBoardOutline(.07),{
      depth:.21,bevelEnabled:true,bevelThickness:.020,bevelSize:.025,
      bevelSegments:2,steps:1
    }),grassMaterial('#b9cba7',10),9,-.10,9,false);
    earth.rotation.x=-Math.PI/2;earth.receiveShadow=true;
    earth.userData.terrainCutaway='meadow';
    // A narrow stratified sediment seam just below the lawn provides a
    // delicate hand-built cutaway rather than a heavy square board outline.
    const seam=object(world,new THREE.ExtrudeGeometry(organicBoardOutline(.045),{
      depth:.047,bevelEnabled:false,steps:1
    }),mat('#bdad8a'),9,-.099,9,false);
    seam.rotation.x=-Math.PI/2;seam.receiveShadow=false;
    seam.userData.terrainCutaway='soil';
  }
  function organicRoad(n,axis){
    // A minimum 1.02m clear width stays beneath traffic lanes. The material
    // follows the same old centerline, no vehicle steering changes at all.
    const shape=new THREE.Shape();
    const count=48,pts=[];
    for(let i=0;i<=count;i++){
      const t=i/count,along=-8.015+t*16.03;
      const wobble=.025*Math.sin(t*TAU*2+n*.7)+
        .018*Math.sin(t*TAU*6+n*.41);
      const width=.554+wobble;
      pts.push([along,width]);
    }
    const local=(at,edge)=>{
      const [along,width]=pts[at],side=width*edge;
      return axis==='north-south'?[side,-along]:[along,side];
    };
    for(let i=0;i<=count;i++){
      const [x,y]=local(i,-1);if(i===0)shape.moveTo(x,y);
      else shape.lineTo(x,y);
    }
    for(let i=count;i>=0;i--){
      const [x,y]=local(i,1);shape.lineTo(x,y);
    }
    shape.closePath();
    const mesh=object(world,new THREE.ExtrudeGeometry(shape,{
      depth:.045,bevelEnabled:false,steps:1
    }),roadSurface(axis),axis==='north-south'?n+.5:9,
       axis==='north-south'?.134:.146,
       axis==='north-south'?9:n+.5,false);
    mesh.rotation.x=-Math.PI/2;mesh.receiveShadow=true;
    mesh.userData.organicRoad=axis;
    return mesh;
  }
  function stoneShoulder(n,a,b,axis,side){
    // No long straight curb wall: a low, irregular soil-and-stone verge
    // integrated with the painted grass and clear of every intersection.
    const length=b-a;
    const count=Math.max(8,Math.ceil(length*9));
    const shape=new THREE.Shape();
    const vertices=[];
    for(let i=0;i<=count;i++){
      const t=i/count,along=a+(b-a)*t;
      const bend=.027*Math.sin(t*TAU*1.5+n)+.018*Math.sin(t*TAU*4.4);
      vertices.push([along,side*(.55+bend),side*(.68+bend)]);
    }
    const at=(v,outside)=>{
      const p=v,across=outside?p[2]:p[1];
      return axis==='north-south'?[n+.5+across,-p[0]]:
        [p[0],-(n+.5+across)];
    };
    vertices.forEach((v,i)=>{const [x,y]=at(v,false);if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);});
    for(let i=vertices.length-1;i>=0;i--){const [x,y]=at(vertices[i],true);shape.lineTo(x,y);}
    shape.closePath();
    const mesh=object(world,new THREE.ExtrudeGeometry(shape,{depth:.014,
      bevelEnabled:false,steps:1}),mat('#c8b99d'),0,.150,0,false);
    mesh.rotation.x=-Math.PI/2;mesh.receiveShadow=false;
    mesh.userData.stoneShoulder=axis;
  }

  /* ---- Traffic lights. The simulation already holds cars at red and releases them on green (town.lightPhase); these are
     the real signals: four poles at every junction with a head facing each approach, lit from that same phase. Poles and
     heads are static and merge with the town; only the six shared lamp materials change. ---- */
  const signal={mats:null};
  function createSignals(){
    const mk=(hex)=>new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:.1,roughness:.4});
    signal.mats={x:{r:mk('#e2463a'),a:mk('#f4b73a'),g:mk('#4fbf72')},y:{r:mk('#e2463a'),a:mk('#f4b73a'),g:mk('#4fbf72')}};
    signal.poles=0;signal.heads=0;
    const first=LINES[0],last=LINES[LINES.length-1],e=.45,dark=mat('#3e4847',.7),pole=mat('#64706a',.8);
    for(const jx of LINES)for(const jz of LINES){
      if((jx===first||jx===last)&&(jz===first||jz===last))continue;
      const cx=jx+.5,cz=jz+.5;
      // Two shared corner masts retain all four approach-facing signals.
      for(const side of [-1,1]){
        const g=new THREE.Group();g.position.set(cx+side*e,GROUND.pave,cz+side*e);world.add(g);
        g.userData.signalMast=true;signal.poles++;
        object(g,geo('cylinder',.008,.011,.43),pole,0,.215,0,false);
        for(const [axis,fx,fz] of [['x',-side,0],['y',0,-side]]){
          const head=new THREE.Group();head.position.set(fx*.025,.455,fz*.025);head.rotation.y=Math.atan2(fx,fz);g.add(head);
          head.userData.signalApproach=axis;signal.heads++;
          object(head,geo('box',.049,.125,.036),dark,0,0,0,false);
          [['r',.039],['a',0],['g',-.039]].forEach(([c,y])=>object(head,geo('sphere',.013),signal.mats[axis][c],0,y,.022,false));
          const ped=new THREE.Group();ped.position.set(fx*.018,.29,fz*.018);ped.rotation.y=head.rotation.y;g.add(ped);
          object(ped,geo('box',.034,.061,.028),dark,0,0,0,false);
          [['r',.016],['g',-.016]].forEach(([c,y])=>object(ped,geo('sphere',.009),signal.mats[axis][c],0,y,.017,false));
        }
      }
    }
  }
  function updateSignals(dark){
    if(!signal.mats)return;
    const ph=town.lightPhase?.();
    for(const axis of ['x','y']){
      const state=!ph?'g':ph.green===axis?(ph.amber?'a':'g'):'r',m=signal.mats[axis];
      for(const c of ['r','a','g'])m[c].emissiveIntensity=(state===c?1.6+dark*1.4:.06);
    }
  }
  const SEA_Y=-.42;
  let lighthouse=null;
  /* ---- The town sits in a sea instead of on an empty table: a striped lighthouse on a rocky islet off the north-west
     corner (its beam turns at night), two more islets with a tree, sailboats circling slowly, buoys and ripples. ---- */
  function seaAndLighthouse(){
    lighthouse=null;
    // A foam collar that follows the slab's own rounded outline, a little wider than the wood.
    if(!geometryCache.has('foam'))geometryCache.set('foam',new THREE.ShapeGeometry(organicBoardOutline(-.55)));
    const foamMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.42,depthWrite:false});
    const foam=object(world,geometryCache.get('foam'),foamMat,9,SEA_Y+.012,9,false);
    foam.rotation.x=-Math.PI/2;foam.castShadow=false;foam.receiveShadow=false;
    const rock=leafMat('#a39889'),cap=leafMat('#84b26f');
    const islet=(x,z,r,k)=>{
      const base=object(world,geo('clump',r,k%4),rock,x,SEA_Y+r*.12,z);base.scale.set(1.25,.62,1.1);
      const top=object(world,geo('clump',r*.62,(k+1)%4),cap,x+r*.05,SEA_Y+r*.5,z);top.scale.set(1.1,.45,1);
      return {x,z,top:SEA_Y+r*.62};
    };
    // the lighthouse
    const L=islet(-2.7,-2.5,1.35,0),g=new THREE.Group();g.position.set(L.x,L.top,L.z);world.add(g);
    const H=2.9,r0=.42,r1=.27,bands=5;
    for(let i=0;i<bands;i++){
      const rb=r0+(r1-r0)*i/bands,rt=r0+(r1-r0)*(i+1)/bands;
      cylinder(g,rt,rb,H/bands,i%2?'#f4efe6':'#d9503f',0,H/bands*(i+.5),0);
    }
    cylinder(g,.36,.36,.05,'#4d5660',0,H+.02,0);                                  // gallery
    const rail=object(g,geo('torus',.34,.012),mat('#3f4750'),0,H+.1,0,false);rail.rotation.x=Math.PI/2;
    box(g,.12,.2,.03,'#5b4636',0,.14,r0*.98);                                   // door
    for(const wy of [1.1,1.9])box(g,.07,.12,.03,'#2f3a40',0,wy,(r0+(r1-r0)*wy/H)*.98,false);
    const lampMat=new THREE.MeshStandardMaterial({color:'#ffe8a8',emissive:'#ffcf6a',emissiveIntensity:.4,roughness:.3});
    const lamp=object(g,geo('cylinder',.17,.17,.3),lampMat,0,H+.28,0,false);
    cylinder(g,0,.26,.24,'#d9503f',0,H+.55,0);ball(g,.04,'#f0d27a',0,H+.7,0);
    const beamMat=new THREE.MeshBasicMaterial({color:'#fff1b8',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    const beam=new THREE.Group();beam.position.set(0,H+.28,0);g.add(beam);
    for(const sd of [-1,1]){const c=object(beam,geo('cylinder',.03,.42,3.4),beamMat,sd*1.75,0,0,false);c.rotation.z=Math.PI/2;c.castShadow=false;}
    lighthouse={beam,lampMat,beamMat,foamMat};
    // two more islets, each with a tree
    for(const [x,z,r,k] of [[-15.3,12.8,.9,2],[35.9,5.2,.8,3]]){const I=islet(x,z,r,k);tree({x:I.x,y:I.z,s:.6},k*7+1);}
    islet(15.6,22.6,.55,1);islet(-1.5,20.5,.45,2);
    // buoys, ripples and sailboats (animated, so the ambient pass moves them)
    for(let i=0;i<5;i++){
      const a=rng(i,901)*TAU,d=13.2+rng(i,902)*7,x=9+Math.cos(a)*d,z=9+Math.sin(a)*d;
      if(Math.abs(x-9)<10.6&&Math.abs(z-9)<10.6)continue;
      const b=new THREE.Group();b.position.set(x,SEA_Y,z);world.add(b);
      ball(b,.07,'#e2463a',0,.04,0);cylinder(b,.012,.012,.16,'#4a4f56',0,.14,0);ball(b,.02,'#ffd23f',0,.24,0);
      ambient.push({kind:'sea',mesh:b,phase:i*1.1,y0:SEA_Y,bob:true});
    }
    for(let i=0;i<9;i++){
      const a=rng(i,911)*TAU,d=12.6+rng(i,912)*9,x=9+Math.cos(a)*d,z=9+Math.sin(a)*d;
      if(Math.abs(x-9)<10.6&&Math.abs(z-9)<10.6)continue;
      const ring=object(world,geo('torus',.34+rng(i,913)*.3,.012),mat('#eaf7f4',.6),x,SEA_Y+.016,z,false);ring.rotation.x=Math.PI/2;
      ambient.push({kind:'sea',mesh:ring,phase:i*.85,y0:SEA_Y+.016});
    }
    const sailMat=new THREE.MeshStandardMaterial({color:'#fff7ec',roughness:.85,side:THREE.DoubleSide});
    if(!geometryCache.has('sail')){const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(.3,0);sh.lineTo(0,.46);geometryCache.set('sail',new THREE.ShapeGeometry(sh));}
    for(const [R,speed,ph,col] of [[35.2,.018,0,'#e2463a'],[38.6,-.015,2.4,'#3f8fd6']]){
      const boat=new THREE.Group();world.add(boat);
      object(boat,geo('soft',.5,.1,.2,.05),mat('#f4f0e6',.7),0,.05,0);box(boat,.3,.02,.2,col,.02,.11,0,false);
      cylinder(boat,.01,.012,.62,'#8a6d4e',0,.4,0);
      const sail=object(boat,geometryCache.get('sail'),sailMat,-.15,.16,.0,false);sail.castShadow=false;
      ambient.push({kind:'sail',mesh:boat,phase:ph,R,speed});
    }
  }
  // River bridges have pale stone shoulders, anchored to the same lanes.
  // A humpback stone arch: the deck curves up from the road at each bank, and the river runs through the opening
  // underneath, so the rowing boat and the ducks can pass under it. ARCH.y0 is the asphalt top.
  const ARCH={y0:.172,L:1.3,H:.38,T:.055,a:.92,yb:.1,W:1.34};
  const archTop=u=>ARCH.y0+ARCH.H*Math.cos(Math.min(1,Math.abs(u)/ARCH.L)*Math.PI/2)**2;
  function bridgeAt(n){
    const A=ARCH,N=32,apex=A.y0+A.H-A.T,mk=(key,build,depth)=>{
      if(!geometryCache.has(key)){const g=new THREE.ExtrudeGeometry(build(),{depth,bevelEnabled:false,curveSegments:14});geometryCache.set(key,g);}
      return geometryCache.get(key);};
    const band=(off0,off1)=>()=>{const sh=new THREE.Shape();sh.moveTo(-A.L,archTop(-A.L)+off0);
      for(let i=1;i<=N;i++){const u=-A.L+2*A.L*i/N;sh.lineTo(u,archTop(u)+off0);}
      for(let i=N;i>=0;i--){const u=-A.L+2*A.L*i/N;sh.lineTo(u,archTop(u)+off1);}return sh;};
    const body=()=>{const sh=new THREE.Shape();sh.moveTo(-A.L,A.yb);sh.lineTo(-A.L,archTop(-A.L));
      for(let i=1;i<=N;i++){const u=-A.L+2*A.L*i/N;sh.lineTo(u,archTop(u));}
      sh.lineTo(A.L,A.yb);sh.lineTo(A.a,A.yb);
      // The opening never crosses the thinner deck on the flatter shoulders.
      for(let i=1;i<=N;i++){const u=A.a-2*A.a*i/N;sh.lineTo(u,Math.min(archTop(u)-A.T,A.yb+(apex-A.yb)*Math.sqrt(Math.max(0,1-(u/A.a)**2))));}
      sh.lineTo(-A.L,A.yb);return sh;};
    // Extrusion runs along local z; turning the mesh a quarter turn lays the depth along world x and the profile along world z.
    const put=(geometry,material,cx,depth)=>{const m=object(world,geometry,material,cx+depth/2,0,14);m.rotation.y=-Math.PI/2;m.userData.bridgePart=true;return m;};
    put(mk('bridge:body',body,A.W),mat('#b4a98f',.9),n+.5,A.W);
    put(mk('bridge:deck',band(0,.012),1.1),mat('#78868a',.92),n+.5,1.1).castShadow=false;
    for(const side of [-1,1])put(mk('bridge:rail',band(.0,.105),.035),mat('#d8d1bf',.9),n+.5+side*.62-.0,.035);
  }
  // KayKit road tiles on the street grid: straights, a zebra crossing by the
  // plaza, T-splits on the outer edges, corners at the four outer corners and
  // full junctions inside. Tiles are 2x2 in the kit, scaled to the 1x1 lane.
  // Base orientations (measured): straight and crossing run along Z; the
  // T-split branches to +X; the corner joins +X and +Z.
  function kitRoads(){
    const lane=v=>LINES.includes(v),first=LINES[0],last=LINES[LINES.length-1];
    // Pavements: raised pale slabs with a kerb down both sides of every street,
    // wrapping the closed sides and corners of junctions. The carriageway is
    // narrowed to fit; walkers' lanes (0.40–0.47 off centre) fall on them.
    const P=.13,slabs=[],kerbs=[];
    const strip=(x,z,w,d,kx,kz,kw,kd)=>{slabs.push([x,z,w,d]);kerbs.push([kx,kz,kw,kd]);};
    for(let y=1;y<=16;y++)for(let x=1;x<=16;x++){
      const v=lane(x),h=lane(y);if(!v&&!h)continue;
      if(v&&!h&&(y===13||y===14))continue;                     // the river: bridges here
      let name='road_straight',rot=v?0:Math.PI/2;
      if(v&&h){
        const W=x>first,E=x<last,N=y>first,S=y<last,open=[W,E,N,S].filter(Boolean).length;
        if(open===4)name='road_junction',rot=0;
        else if(open===3){name='road_tsplit';rot=!W?0:!E?Math.PI:!N?-Math.PI/2:Math.PI/2;}
        else{name='road_corner';rot=E&&S?0:W&&S?-Math.PI/2:E&&N?Math.PI/2:Math.PI;}
      }else if(x===8&&y===11){name='road_straight_crossing';rot=Math.PI/2;}
      const t=kitPlace(world,name,x+.5,.135,y+.5,{scale:.5,rotY:rot});
      if(t)t.traverse(o=>{if(o.isMesh)o.castShadow=false;});
      const cx=x+.5,cz=y+.5,e=.5-P/2;
      if(v&&h){
        const W=x>first,E=x<last,N=y>first,S=y<last;
        for(const sx of [-1,1])for(const sz of [-1,1])slabs.push([cx+sx*e,cz+sz*e,P,P]);   // the four corners
        if(!W)strip(cx-e,cz,P,1,cx-.5+P,cz,.02,1);if(!E)strip(cx+e,cz,P,1,cx+.5-P,cz,.02,1);
        if(!N)strip(cx,cz-e,1,P,cx,cz-.5+P,1,.02);if(!S)strip(cx,cz+e,1,P,cx,cz+.5-P,1,.02);
      }else{
        if(t)t.scale.x=1-2*P;   // the asphalt is the carriageway only (tiles run along their local Z)
        if(v)for(const sd of [-1,1])strip(cx+sd*e,cz,P,1,cx+sd*(.5-P),cz,.02,1);
        else for(const sd of [-1,1])strip(cx,cz+sd*e,1,P,cx,cz+sd*(.5-P),1,.02);
      }
    }
    const instanced=(list,h,y,color)=>{
      if(!list.length||!THREE.InstancedMesh||!THREE.Object3D)return;
      const mesh=new THREE.InstancedMesh(geo('box',1,1,1),mat(color,.9),list.length),dummy=new THREE.Object3D();
      list.forEach(([x,z,w,d],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;mesh.userData.pavements=list.length;world.add(mesh);
    };
    instanced(slabs,.05,.2,'#d9d3c6');
    instanced(kerbs,.065,.2,'#b7b0a1');
  }
  function createGround(){
    // A generous matte studio table under the actual miniature slab.
    // Soft ambient contrast makes the scene read like a photographed model.
    // The town stands in a calm sea (see seaAndLighthouse): the sea level cuts the wooden base about a third of the way up.
    const backdrop=box(world,400,.07,400,mat('#7dbcc4',.5),9,SEA_Y-.035,9);
    backdrop.castShadow=false;
    terrainCutaway();
    // One continuous painted meadow rests over the sculpted board. Its
    // geometry is shared with the rounded earth outline, not a square slab.
    const meadow=object(world,geo('plane',18.35,18.35),landscapeAtlas,9,.129,9,false);
    meadow.rotation.x=-Math.PI/2;meadow.receiveShadow=false;
    meadow.userData.continuousLandscape=true;
    // Water sits below streets; bridges cross at the existing four lanes.
    groundPiece(18.02,1.97,'#8dbfc0',9,14,.105);
    const isRoad = v=>LINES.includes(v);
    if(kit&&kit.get('road_straight'))kitRoads();
    for(const n of LINES){
      // The bridges stay hand-built either way; with the kit, its road tiles replace the rest.
      if(kit&&kit.get('road_straight')){bridgeAt(n);continue;}
      organicRoad(n,'north-south');
      organicRoad(n,'east-west');
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
        for(const side of [-1,1]){
          stoneShoulder(n,a,b,'north-south',side);
          stoneShoulder(n,a,b,'east-west',side);
        }
      }
      bridgeAt(n);
    }
    // The hero neighbourhood is the paved city centre (cityCentre): no grass slab, scattered blooms, pavers or garden beds here any more.
    // Only a low, warm stone border runs round the block; it leaves the walkways open for arriving residents.
    const edging=mat('#e8d6b4');
    for(let n=0;n<4;n++) {
      for(const z of [7.05,10.94]) {
        if(n!==1&&n!==2)box(world,.78,.095,.072,edging,7.5+n,.23,z);
      }
      for(const x of [7.05,10.94]) {
        if(n!==1&&n!==2)box(world,.072,.095,.78,edging,x,.23,7.5+n);
      }
    }
    // Four grounded zebra stripes on the actual southern road.
    if(!(kit&&kit.get('road_straight')))for(let i=0;i<4;i++)groundPiece(.088,.71,'#f8eedb',8.20+i*.17,11.5,.240);
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
        const path=groundPiece(.98,.23,'#dfd2b9',i+.5,12.90,.17);path.userData.riverPath=true;
        paintedVerge(i+.5,12.98,.84,.24,'east-west',.174);
        littleFlowers(i+.35,12.63,i*17);
      }
    }
    for(const x of [4.35,9.05,14.4]){
      const bench=new THREE.Group();bench.position.set(x,.17,12.48);world.add(bench);bench.userData.riverBench=true;
      for(const dx of [-.17,.17])box(bench,.025,.13,.16,'#657268',dx,.065,0);
      for(const z of [-.06,0,.06])box(bench,.44,.022,.042,'#ad8f6b',0,.145,z);
      box(bench,.44,.12,.025,'#ad8f6b',0,.23,-.085);
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
  // The two village shops are inhabited places, not static signage.
  // A shallow service counter, real merchandise and warm tabletop lamps
  // occupy their frontage margins. Hero residents still have clear walking
  // corridors at x=8.5 and x=9.5; nothing is placed on a traffic lane.
  function createWorkingShops(){
    const workplaces=[
      {kind:'bakery',x:8.50,z:8.25,color:'#d69072',trim:'#f8dcab'},
      {kind:'bookshop',x:9.50,z:8.25,color:'#478d89',trim:'#d7e5c7'}
    ];
    for(const place of workplaces){
      const shop=new THREE.Group();
      shop.position.set(place.x,.176,place.z);
      shop.userData.workingShop=place.kind;shop.userData.facadeAttached=true;world.add(shop);
      const base=box(shop,.54,.315,.26,place.color,0,.168,0);
      const top=box(shop,.61,.045,.30,'#f2ddbd',0,.347,0);
      for(const side of [-1,1]){
        box(shop,.046,.30,.29,'#f4e4c7',side*.265,.169,0);
        // A standing rib gives the tiny display readable edges at mobile scale.
        box(shop,.031,.23,.016,place.trim,side*.22,.186,.143);
      }
      box(shop,.40,.056,.021,place.trim,0,.22,.143);
      if(place.kind==='bakery'){
        // Loaves nest in an actual countertop basket. Shallow scored crusts
        // are part of the goods, not painted dots on the roof behind them.
        const basket=box(shop,.36,.048,.20,'#ab875f',0,.405,-.010);
        for(let i=0;i<4;i++){
          const loaf=ball(shop,.069,i%2?'#e6a761':'#d68e55',
            (i-1.5)*.084,.465,(i%2?-.034:.034));
          loaf.scale.set(.65,.49,1.0);
          box(shop,.022,.008,.048,'#f8ddab',
            (i-1.5)*.084,.497,(i%2?-.034:.034));
        }
        // A low warm lamp keeps the bread counter readable after dusk.
        const light=ball(shop,.038,mat('#ffe5a4',.5,'#e9b974'),
          -.235,.435,-.098);light.castShadow=false;
      }else{
        // A visibly different silhouette: book covers standing on a
        // slanted rack, with a dedicated little bookmark pile.
        for(let i=0;i<5;i++){
          const book=box(shop,.062,.148,.105,
            ['#f1c47d','#ad8cac','#c87774','#e3d1ab','#6da8a0'][i],
            (i-2)*.087,.475,-.022);
          book.rotation.z=(i%2?.13:-.11);
          box(shop,.045,.008,.082,'#f9ebd8',(i-2)*.087,.540,-.020);
        }
        box(shop,.15,.027,.11,'#edcd91',.137,.405,.067);
        box(shop,.14,.020,.11,'#ad897b',.132,.430,.067);
      }
      // A shallow awning attaches to the building face; no kiosk legs or
      // roof freestanding on the square. Its back meets the facade at z=8.0.
      const awningColor=place.kind==='bakery'?'#b67c65':'#708e76';
      fabric(shop,0,.73,-.08,awningColor,.76,.36);
      box(shop,.78,.025,.025,'#947153',0,.756,-.253);
      // Glazed display cabinetry behind the counter, with layered
      // merchandise that remains readable under the photographic lens.
      box(shop,.58,.24,.142,'#886b59',0,.57,-.205);
      const displayGlass=box(shop,.523,.213,.029,
        new THREE.MeshStandardMaterial({
          color:'#c6e4dc',transparent:true,opacity:.38,depthWrite:false,
          roughness:.15,metalness:.06
        }),0,.565,-.122);
      displayGlass.castShadow=false;
      box(shop,.59,.035,.18,'#f3dcbb',0,.70,-.204);
      box(shop,.59,.027,.18,'#c9aa83',0,.51,-.204);
      box(shop,.59,.024,.18,'#c9aa83',0,.64,-.204);
      if(place.kind==='bakery'){
        for(let row=0;row<2;row++)for(let k=0;k<4;k++){
          const x=(k-1.5)*.11,y=.53+row*.10;
          const loaf=ball(shop,.068,
            k%2?'#d38b52':'#e5b071',x,y,-.129);
          loaf.scale.set(.70,.44,.44);
          loaf.castShadow=false;
        }
        const oven=box(shop,.13,.08,.027,'#745b50',.162,.65,-.113);
        oven.castShadow=false;
        box(shop,.10,.045,.029,'#eab77c',.162,.65,-.092);
      }else{
        const covers=['#c87873','#e5be75','#609f93','#9d8cba','#dba78f'];
        for(let row=0;row<2;row++)for(let k=0;k<5;k++){
          const x=(k-2)*.096,y=.53+row*.10;
          const book=box(shop,.075,.104,.031,covers[(k+row*2)%5],
            x,y,-.113);
          book.rotation.z=(k%2?.045:-.035);
          book.castShadow=false;
          box(shop,.056,.009,.034,'#f7e9d5',x,y+.032,-.088);
        }
      }
      // A cast-metal service bell stays still until a genuine handoff.
      // No perpetual wobble to fake activity when the shop is empty.
      const bell=new THREE.Group();
      bell.position.set(place.kind==='bakery'?-.22:.22,.402,.082);
      shop.add(bell);
      cylinder(bell,.044,.054,.032,'#c7a66a',0,.017,0);
      ball(bell,.018,'#f3d894',0,.046,0).castShadow=false;
      const lampMaterial=new THREE.MeshStandardMaterial({
        color:'#fff1d4',emissive:'#f6bc79',emissiveIntensity:.20,
        roughness:.42
      });
      const lantern=ball(shop,.026,lampMaterial,-.296,.69,.07);
      lantern.castShadow=false;
      const smallSign=sign(shop,place.kind==='bakery'?'FRESH':'OPEN',
        0,.247,.148,.19,'#574a42','#f8eed8');
      // Two true hinged glazed serving leaves. Both pivot from the
      // outer jamb so the counter stays physically unobstructed when open.
      // This is a street-service window, NOT an imaginary doorway through
      // the back wall or a prop that rotates without a customer.
      const shutters=[];
      const glazing=new THREE.MeshStandardMaterial({
        color:'#b8d9ce',transparent:true,opacity:.52,depthWrite:false,
        roughness:.16,metalness:.06,side:THREE.DoubleSide
      });
      for(const side of [-1,1]){
        const hinge=new THREE.Group();
        // Pivot at the actual front edge of the serving hatch. From the
        // regular phone camera this now visibly clears the customer access.
        hinge.position.set(side*.255,.578,.169);shop.add(hinge);
        const sx=-side*.128;
        const pane=box(hinge,.247,.21,.018,glazing,sx,0,0);
        pane.castShadow=false;
        for(const yy of [-.112,.112])
          box(hinge,.266,.022,.036,'#d6ae86',sx,yy,.008);
        box(hinge,.022,.24,.039,'#b48a69',sx+side*.113,0,.012);
        box(hinge,.022,.24,.039,'#b48a69',sx-side*.113,0,.012);
        box(hinge,.024,.20,.038,'#e2c6a2',sx,0,.015);
        ball(hinge,.018,'#f0d5a4',sx-side*.075,-.047,.040)
          .castShadow=false;
        shutters.push({hinge,side});
      }
      shop.userData.streetFront={
        bell,lantern,lampMaterial,shutters,openAmount:0,openTarget:0,
        ringUntil:0,previousHandoff:false,serviceCount:0,hasCustomers:false,
        lastTime:null,merchandise:place.kind==='bakery'?'pastries':'books'
      };
      // Visible from street side; miniature sign shares stall's coordinate
      // system and never floats independently of the desk.
      ambient.push({kind:'marketCounter',mesh:shop,phase:place.kind==='bakery'?0:1.3});
    }
  }
  // Cast-iron lanterns along every street, at the outer edge of the pavement,
  // mid-block (clear of crossings and the river bridges). At dusk the glass
  // glows, the lens blooms it, and a warm pool spreads over the wet cobbles.
  const lanternPools=[];
  const lanternGlass=new THREE.MeshStandardMaterial({color:'#fff3d6',roughness:.3,metalness:0,emissive:'#ffb45e',emissiveIntensity:.1});
  const poolTexture=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const p=c.getContext('2d');
    const g=p.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,196,120,1)');g.addColorStop(.45,'rgba(255,170,90,.42)');g.addColorStop(1,'rgba(255,160,80,0)');
    p.fillStyle=g;p.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
  function streetLanterns(){
    lanternPools.length=0;lanterns.length=0;
    const iron='#33403f';
    let n=0;
    for(const l of LINES)for(const mid of [3.5,9.5,13.5])for(const along of [true,false]){
      if(!along&&mid===13.5)continue;                      // north-south streets cross the river here
      const side=(n++%2?1:-1)*.47,x=along?mid:l+.5+side,z=along?l+.5+side:mid;
      if(kit&&kit.get('streetlight')){
        // The arm reaches over the road; a glowing lamp sits under its tip.
        const dx=along?0:-Math.sign(side),dz=along?-Math.sign(side):0,light=kitPlace(world,'streetlight',x,.17,z,{height:1.02,pivot:true,rotY:Math.atan2(dz,-dx)});   // its arm points along local -X
        const lm=new THREE.MeshStandardMaterial({color:'#fff3d6',roughness:.3,metalness:0,emissive:'#ffb45e',emissiveIntensity:.1});
        const tip=light.userData.size.x*.85,head=box(light,.07,.03,.07,lm,-tip,.95,0,false);head.castShadow=false;
        const pool=new THREE.Mesh(geo('plane',2,2),new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
        pool.rotation.x=-Math.PI/2;pool.position.set(x+dx*tip,.205,z+dz*tip);world.add(pool);lanternPools.push(pool);
        lanterns.push({mat:lm,pool,x,z,along,line:l,lit:false,k:0});
        continue;
      }
      const g=new THREE.Group();g.position.set(x,.17,z);world.add(g);
      cylinder(g,.022,.034,.82,iron,0,.41,0);
      cylinder(g,.05,.05,.04,iron,0,.04,0);
      const lm=new THREE.MeshStandardMaterial({color:'#fff3d6',roughness:.3,metalness:0,emissive:'#ffb45e',emissiveIntensity:.1});
      const head=box(g,.11,.13,.11,lm,0,.89,0,false);head.castShadow=false;
      cylinder(g,.0,.095,.07,iron,0,.99,0);
      box(g,.13,.02,.13,iron,0,.83,0,false);
      const pool=new THREE.Mesh(geo('plane',2,2),new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
      pool.rotation.x=-Math.PI/2;pool.position.set(x,.205,z);world.add(pool);lanternPools.push(pool);
      lanterns.push({mat:lm,pool,x,z,along,line:l,lit:false,k:0});
    }
  }
  /* ---- The open-air cinema: Wikipedia's Picture of the Day on a screen in the
     back-left corner (only sky behind it), deckchairs in front, a projector
     beam after dusk. The picture is fetched once a day; without it the screen
     shows a painted test card. Credited on the screen's own caption plate. */
  const CINEMA={x:.62,z:.7};
  let cinemaScreen=null,cinemaBeam=null,cinemaViewers=[],potdTexture=null,potdRequested='';
  function captionTexture(text){
    const c=document.createElement('canvas');c.width=512;c.height=64;const p=c.getContext('2d');
    p.fillStyle='#2f3742';p.fillRect(0,0,512,64);p.fillStyle='#fff6e4';p.textAlign='center';p.textBaseline='middle';
    p.font='600 26px Nunito, system-ui, sans-serif';p.fillText(text,256,33);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  function testCard(){
    const c=document.createElement('canvas');c.width=256;c.height=150;const p=c.getContext('2d');
    const g=p.createLinearGradient(0,0,256,150);g.addColorStop(0,'#8fd3c9');g.addColorStop(1,'#c9a6e8');p.fillStyle=g;p.fillRect(0,0,256,150);
    p.fillStyle='rgba(255,250,240,.9)';p.font='600 20px Nunito, system-ui';p.textAlign='center';p.fillText('Tonight: cartoons',128,82);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  function loadPictureOfTheDay(){
    const day=new Date(),key=day.toISOString().slice(0,10);
    if(potdRequested===key||typeof fetch!=='function'||!THREE.TextureLoader)return;potdRequested=key;
    const [y,m,d]=[day.getUTCFullYear(),String(day.getUTCMonth()+1).padStart(2,'0'),String(day.getUTCDate()).padStart(2,'0')];
    fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`).then(r=>r.json()).then(data=>{
      onThisDay=lightHistory(data?.onthisday);
      const src=data?.image?.thumbnail?.source;if(!src)return;
      const loader=new THREE.TextureLoader();loader.setCrossOrigin?.('anonymous');
      loader.load(src,tx=>{tx.colorSpace=THREE.SRGBColorSpace;potdTexture=tx;applyPicture();});
    }).catch(()=>{});
  }
  function applyPicture(){
    if(!cinemaScreen||!potdTexture)return;
    const img=potdTexture.image,aspect=img&&img.width?img.width/img.height:1.6,screen=2.1/1.25;
    // Cover-fit the picture to the screen's shape.
    potdTexture.repeat?.set(aspect>screen?screen/aspect:1,aspect>screen?1:aspect/screen);
    potdTexture.offset?.set(aspect>screen?(1-screen/aspect)/2:0,aspect>screen?0:(1-aspect/screen)/2);
    cinemaScreen.material.map=potdTexture;cinemaScreen.material.needsUpdate=true;
  }
  function openAirCinema(){
    const g=new THREE.Group();g.position.set(CINEMA.x,.17,CINEMA.z);g.rotation.y=.42;g.userData.cinema=true;world.add(g);
    const iron='#39424b';
    for(const x of [-1.12,1.12])cylinder(g,.035,.045,1.95,iron,x,.97,0);
    box(g,2.34,1.42,.07,'#2c333c',0,1.27,-.02,false);
    cinemaScreen=object(g,geo('plane',2.1,1.25),new THREE.MeshBasicMaterial({map:testCard(),color:new THREE.Color('#e8e8e8')}),0,1.27,.02,false);
    const plate=object(g,geo('plane',1.3,.16),new THREE.MeshBasicMaterial({map:captionTexture('Picture of the Day · Wikimedia Commons')}),0,.47,.03,false);plate.castShadow=false;
    cinemaViewers=[];
    [[-.55,1.05],[.05,1.2],[.62,1.02]].forEach(([x,z],i)=>{
      const chair=new THREE.Group();chair.position.set(x,0,z);g.add(chair);
      box(chair,.3,.03,.26,['#e2463a','#3f78c9','#ffb020'][i],0,.16,0,false);
      box(chair,.3,.26,.03,['#e2463a','#3f78c9','#ffb020'][i],0,.3,.13,false).rotation.x=-.25;
      for(const k of [-.13,.13])cylinder(chair,.012,.012,.16,'#7a5235',k,.08,0);
      const viewer=new THREE.Group();viewer.position.set(0,.18,.03);chair.add(viewer);
      box(viewer,.17,.22,.13,['#9cc7ef','#f4b6d2','#a8d8a0'][i],0,.12,0);
      ball(viewer,.075,'#6b4a2b',0,.3,0);
      viewer.visible=false;cinemaViewers.push(viewer);
    });
    cinemaBeam=new THREE.Mesh(geo('plane',1,1),new THREE.MeshBasicMaterial({color:'#fff4d6',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    cinemaBeam.scale.set(2.1,2.4,1);cinemaBeam.rotation.x=-Math.PI/2+.42;cinemaBeam.position.set(0,1.05,1.2);g.add(cinemaBeam);
    box(g,.18,.14,.22,'#3b3f4a',0,.62,2.3,false);   // the projector on its stand
    cylinder(g,.02,.02,.55,iron,0,.28,2.3);
    loadPictureOfTheDay();applyPicture();
  }
  /* ---- After dusk: fireflies over the lawns and an occasional shooting star. */
  let fireflies=null,fireflySeeds=[],shootingStar=null,nextShoot=0;
  let clouds=[];
  function skyClouds(){
    clouds=[];if(!kit)return;
    [[2,7.5,3,1.1,'cloud_big'],[11,8.3,-1,.8,'cloud_small'],[16,7.2,5,1,'cloud_big'],[6,8.8,-4,.7,'cloud_small']].forEach(([x,y,z,s,name],i)=>{
      const c=kitPlace(world,name,x,y,z,{scale:s*.9});if(c){c.traverse(o=>{if(o.isMesh)o.castShadow=false;});clouds.push({c,x,speed:.05+i*.012});}});
  }
  function nightSky(){
    skyClouds();
    fireflies=null;shootingStar=null;fireflySeeds=[];
    if(!THREE.Points||!THREE.BufferGeometry||!THREE.BufferAttribute)return;
    const spots=[];for(let k=0;k<44;k++)spots.push([1+rng(k,301)*16,1+rng(k,407)*16]);
    fireflySeeds=spots.filter(([x,z])=>!LINES.some(l=>Math.abs(x-l-.5)<.7||Math.abs(z-l-.5)<.7)&&!(z>12.9&&z<15.1));
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(fireflySeeds.length*3),3));
    const dot=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const p=c.getContext('2d');const g=p.createRadialGradient(16,16,0,16,16,16);
      g.addColorStop(0,'rgba(255,255,220,1)');g.addColorStop(.35,'rgba(220,255,140,.7)');g.addColorStop(1,'rgba(200,255,120,0)');p.fillStyle=g;p.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);})();
    fireflies=new THREE.Points(geometry,new THREE.PointsMaterial({map:dot,size:.26,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:'#f4ffb0'}));
    world.add(fireflies);
    shootingStar=new THREE.Mesh(geo('plane',1,1),new THREE.MeshBasicMaterial({color:'#fffbe8',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));
    shootingStar.scale.set(2.4,.035,1);world.add(shootingStar);
  }
  function nightLife(dark,time){
    updateSignals(dark);
    if(lighthouse){lighthouse.beam.rotation.y=time*.3;lighthouse.beamMat.opacity=Math.max(0,dark-.12)*.14;lighthouse.lampMat.emissiveIntensity=.4+dark*3.2;lighthouse.foamMat.opacity=.42-dark*.28;}
    for(const k of clouds)k.c.position.x=((k.x+time*k.speed*(k.speedScale||1)+6)%30)-6;   // a slow drift, wrapping round (faster in wind)
    if(cinemaBeam){cinemaBeam.material.opacity=Math.max(0,dark-.2)*.16;for(const v of cinemaViewers)v.visible=dark>.3;
      if(cinemaScreen)cinemaScreen.material.color.set(dark>.3?'#ffffff':'#d8d8d8');}
    if(fireflies){
      fireflies.material.opacity=Math.max(0,dark-.35)*1.4;
      const pos=fireflies.geometry.attributes.position;
      for(let i=0;i<fireflySeeds.length;i++){const [x,z]=fireflySeeds[i],t=time*.35+i*1.7;
        pos.setXYZ(i,x+Math.sin(t)*.35,.45+Math.sin(t*2.1)*.18+(Math.sin(time*1.6+i*2.3)>0?0:-5),z+Math.cos(t*1.3)*.35);}
      pos.needsUpdate=true;
    }
    if(shootingStar){
      if(dark>.6&&time>nextShoot){shootingStar.userData={t:0,x:2+rng(Math.floor(time),71)*10,z:-3};nextShoot=time+22+rng(Math.floor(time),73)*20;}
      const u=shootingStar.userData;
      if(u&&u.t!==undefined&&u.t<1.4){u.t+=1/40;shootingStar.position.set(u.x+u.t*7,9-u.t*2.2,u.z+u.t*1.5);shootingStar.rotation.set(0,-.2,-.3);shootingStar.material.opacity=Math.sin(Math.min(1,u.t/1.4)*Math.PI);}
      else shootingStar.material.opacity=0;
    }
  }
  /* ---- Tap a resident: they stop for a moment and say something about the day.
     Fiction only, in the town's own voice: real reporting stays in the sourced headline panel. */
  let bubble=null,crierBubble=null;   // the crier has a bubble of its own, so chatter never replaces the headline
  const CHATTER=['Lovely evening for it.','Have you seen the picture at the cinema?','Just popping to the bakery.','Mind the ducks!','The lanterns look lovely tonight.','Is it Tuesday already?','I love this little town.','Off to the book shop!'];
  function chatLine(){
    const state=town.debug(),lines=(town.TALK&&town.TALK[state.theme])||[];
    const pool=lines.map(l=>l.replace(/\{N\}/g,'everyone')).concat(CHATTER);
    return pool[Math.floor(Math.random()*pool.length)];
  }
  // The nearest resident or vehicle under a tap, by its projected position on screen.
  function actorAt(clientX,clientY,kinds,reach){
    const r=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3();let best=null,bestD=reach;
    for(const [ref,item] of actors){
      if(!kinds.includes(item.kind)||(item.kind==='person'&&ref.kind&&ref.kind!=='neighbor'))continue;
      v.copy(item.group.position);v.y+=item.kind==='person'?.45:.2;v.project(camera);if(v.z>1)continue;
      const d=Math.hypot(r.left+(v.x+1)/2*r.width-clientX,r.top+(1-v.y)/2*r.height-clientY);
      if(d<bestD){best={ref,item};bestD=d;}
    }
    return best;
  }
  // Where a tap meets the ground (y = street level), in town coordinates.
  function groundAt(clientX,clientY){
    if(!THREE.Raycaster||!THREE.Plane)return null;
    const r=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster(),hit=new THREE.Vector3();
    ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height*2-1)),camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.17),hit)?{x:hit.x,z:hit.z}:null;
  }
  const HONKS=['Beep beep!','Toot toot!','Parp!','Morning!'];
  const HELLOS={house:['Hello down there!','Lovely day, isn\'t it?','Tea\'s on!','Just watering the plants.'],
    shop:['We\'re open, come in!','Fresh today!','Two for one!'],fire:['All quiet at the station.','Ready when you are!'],
    tower:['What a view from up here!','I can see the river!'],other:['Hello!','Who\'s there?']};
  // A tap always does something you can see in 3D: a resident waves and hops and
  // says hello; a car honks and bounces; a building lights up and someone calls
  // out; open ground gets a little surprise right where you tapped, and the
  // people nearby turn to look and cheer.
  function tap(clientX,clientY){
    if(!THREE.Vector3)return false;
    const now=town.debug().clock||0,pick=list=>list[Math.floor(Math.random()*list.length)];
    const person=actorAt(clientX,clientY,['person'],46);
    if(person){const ref=person.ref;ref.stopUntil=now+3.2;ref.hopUntil=now+.9;ref.waveUntil=now+2.4;ref.cheerUntil=now+1.1;
      const mood=moodOf(ref);showBubble(person.item.group,`${mood[0]} ${nameOf(ref)} is feeling ${mood[1]}. ${chatLine()}`,4800);sound('chime');taps.people++;return true;}
    if(trainHit(clientX,clientY)){taps.vehicles++;return true;}
    if(touch2(clientX,clientY)){taps.ground++;return true;}
    const car=actorAt(clientX,clientY,['car','bike'],40);
    if(car){car.ref.hopUntil=now+.7;showBubble(car.item.group,car.item.kind==='bike'?'Ring ring!':pick(HONKS),2200);sound(car.item.kind==='bike'?'bell':'honk');taps.vehicles++;return true;}
    const spot=groundAt(clientX,clientY);if(!spot)return false;
    // The river (but not a bridge): crumbs, and the ducks paddle over.
    if(spot.z>12.95&&spot.z<15.05&&!LINES.some(l=>Math.abs(spot.x-(l+.5))<.62)&&town.feedDucks){
      town.feedDucks(spot.x,spot.z);crumbsAt(spot.x,spot.z);sound('quack');taps.ducks=(taps.ducks||0)+1;return true;}
    if(scatterBirds(spot.x,spot.z,1.1)){taps.ground++;return true;}
    const b=town.buildings().find(b=>Math.abs(b.x+.5-spot.x)<.62&&Math.abs(b.y+.5-spot.z)<.62);
    if(b){buildingHello(b,pick(HELLOS[b.kind]||HELLOS.other));sound('chime');taps.buildings++;return true;}
    surprise(spot.x,spot.z);taps.ground++;return true;
  }
  const taps={people:0,vehicles:0,buildings:0,ground:0};
  const sound=name=>{try{window.ToyTownSound?.cue(name);}catch(e){}};
  // Crumbs tossed on the water: a little scatter that sinks in.
  function crumbsAt(x,z){
    const parts=[];
    for(let k=0;k<14;k++){const c=box(world,.025,.012,.02,'#e7c38b',x,.45,z,false);c.castShadow=false;c.userData.v=[(Math.random()-.5)*.9,.6+Math.random()*.6,(Math.random()-.5)*.9];parts.push(c);}
    effects.push({t:0,life:5,parts,tick(e,dt){for(const c of parts){const v=c.userData.v;if(c.position.y>.17){v[1]-=dt*3;c.position.x+=v[0]*dt;c.position.y=Math.max(.17,c.position.y+v[1]*dt);c.position.z+=v[2]*dt;}else c.position.y=.17-Math.min(.05,(e.t-1.5)*.02);}}});
  }
  /* ---- Press and hold a resident to follow them: the camera keeps them in view
     and a small card says who they are and what they are up to. */
  const NAMES=['Maya','Leo','Ada','Omar','Priya','Sam','Iris','Kenji','Lena','Ravi','Zoe','Tomas','Nia','Felix','Aisha','Hugo','Mei','Arjun','Rosa','Theo'];
  const nameOf=ref=>NAMES[Math.abs(Math.round((ref.ph||0)*1000))%NAMES.length];
  // A mood that fits the hour and the weather, steady for each resident.
  function moodOf(ref){
    const n=town.debug().night||0,pick=a=>a[Math.abs(Math.round((ref.ph||0)*7))%a.length];
    if(n>.6)return pick([['😴','sleepy'],['🌙','dreamy'],['🦉','wide awake']]);
    if(weatherKind==='rain'||weatherKind==='storm')return pick([['☔','damp but cheerful'],['🌧️','splashy'],['🧥','wrapped up warm']]);
    if(weatherKind==='snow')return pick([['⛄','snowed in'],['🧣','toasty']]);
    if(ref.kid)return ['🎈','bouncy'];
    if(ref.routine==='work'||ref.briefcase)return ['💼','busy'];
    return pick([['😊','cheerful'],['🙂','content'],['😄','chatty'],['🤔','thoughtful'],['😎','relaxed']]);
  }
  function roleOf(ref){
    if(ref.shopRole==='vendor')return ref.shopVenue==='bakery'?'baker':'bookseller';
    if(ref.districtWorker)return {garden:'gardener',post:'postie',art:'painter'}[ref.districtRole]||'greengrocer';
    const kinds={chef:'chef',sweeper:'street sweeper',busker:'musician',newsie:'newspaper seller',farmer:'farmer',keeper:'zookeeper',robot:'robot',shopper:'shopper',neighbor:'neighbour'};
    if(kinds[ref.kind])return kinds[ref.kind];
    if(ref.kid)return 'schoolchild';if(ref.routine==='work'||ref.briefcase)return 'commuter';
    return ref.heroResident?'neighbour':'resident';
  }
  function doingOf(ref){
    const a={knocking:'knocking at the counter',ordering:'ordering',receiving:'being served',handoff:'being served',eating:'having lunch',reading:'reading',performing:'playing the guitar',serving:'serving a customer',offering:'serving a customer'}[ref.shopAction];
    if(a)return a;if(ref.shopAction==='visiting'&&ref.shopAt)return `on the way to the ${ref.shopAt==='bakery'?'bakery':'bookshop'}`;
    if(ref.whim)return {bench:'resting on a bench',fountain:'at the fountain',park:'wandering in the park',chat:'having a chat',gather:'watching something'}[ref.whim]||'out and about';
    if(ref.jogUntil)return 'out for a jog';
    if(ref.carrying)return 'heading off with '+({bread:'fresh bread',book:'a new book'}[ref.carrying]||ref.carrying);
    if(ref.intent==='chat'||ref.intent==='greeting')return 'chatting';
    const r={home:'walking home',work:'off to work',school:'off to school',lunch:'going for lunch'}[ref.routine];if(r)return r;
    if(ref.sit)return 'sitting down';if(ref.dance)return 'dancing';
    return (ref.v||0)>.05?(ref.gait==='brisk'?'striding along':ref.gait==='skip'?'skipping along':'strolling'):'taking a moment';
  }
  let followCard=null,followNext=0;
  function hold(clientX,clientY){
    const person=actorAt(clientX,clientY,['person'],46);if(!person||!town.follow)return false;
    town.follow(person.ref);sound('chime');taps.follows=(taps.follows||0)+1;
    ensureFollowCard();followNext=0;return true;
  }
  function ensureFollowCard(){
    if(typeof document!=='undefined'&&!followCard){
      followCard=document.createElement('div');followCard.className='follow-card';
      followCard.style.cssText='position:fixed;left:14px;bottom:calc(52px + env(safe-area-inset-bottom,0px));z-index:4;display:flex;gap:10px;align-items:center;max-width:min(280px,calc(100vw - 28px));padding:6px 8px 6px 12px;border-radius:14px;background:rgba(255,253,245,.7);box-shadow:0 2px 10px rgba(30,50,70,.08);font:400 12px/1.35 Nunito,system-ui,sans-serif;color:#3d4552';
      const text=document.createElement('div');text.className='follow-text';
      const stop=document.createElement('button');stop.type='button';stop.textContent='✕';stop.setAttribute('aria-label','Stop following');
      stop.style.cssText='border:0;border-radius:9px;width:28px;height:28px;background:rgba(45,52,64,.08);color:#2d3440;font:600 14px Nunito,system-ui;cursor:pointer';
      stop.onclick=()=>town.follow(null);
      followCard.append(text,stop);document.body.appendChild(followCard);
    }
  }
  /* ---- Moments: when something worth watching starts, one chip offers to
     show it. Nothing moves until "Watch" is tapped (the owner dislikes camera
     moves they did not ask for). Watching glides close and follows to the end
     — the follow card narrates — then returns to where the view was. */
  let momentChip=null,offered=null,watching=null,momentCooldown=0,lastSeen=new WeakMap(),seenEvents=new WeakSet(),momentScan=0;
  const momentStats={offered:0,watched:0};
  const EVENT_MOMENTS={jogger:['🏃','A jogger is doing laps'],dogwalk:['🐕','A dog is walking its owner'],wedding:['💒','A wedding in the park'],school:['🎒','A school trip is crossing town'],gallery:['🖼️','A gallery opening in the park'],trees:['🌳','Tree planting in the park'],green:['🌱','Green Energy Day in the park'],health:['🩺','Wellness morning in the park'],jobs:['💼','A jobs fair at the market'],goodnews:['🌟','Good news: confetti!'],cars:['🚗','An electric car show'],food:['🍕','A food fair'],band:['🎺','The marching band is out'],busker:['🎸','A street musician is playing'],kite:['🪁','Kite flying in the park'],balloon:['🎈','A balloon is drifting away'],
    picnic:['🧺','A picnic in the park'],painter:['🎨','A painter has set up an easel'],hotair:['🎈','A hot air balloon is going over'],icecream:['🍦','The ice cream van is here'],duck:['🦆','The giant rubber duck!']};
  function offerMoment(m){
    const now=clockMs();
    if(typeof document==='undefined'||document.visibilityState==='hidden'||offered||watching||(town.following&&town.following())||now<momentCooldown)return;
    offered=Object.assign(m,{offeredAt:now});momentStats.offered++;
    if(!momentChip){
      momentChip=document.createElement('div');momentChip.className='moment-chip';momentChip.setAttribute('role','status');
      momentChip.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:calc(40px + env(safe-area-inset-bottom,0px));z-index:4;display:flex;gap:8px;align-items:center;max-width:calc(100vw - 28px);padding:3px 4px 3px 11px;border-radius:999px;background:rgba(255,253,245,.66);box-shadow:none;font:400 12px/1.3 Nunito,system-ui,sans-serif;color:#4a5260;transition:opacity .4s';
      const text=document.createElement('span');text.className='moment-text';
      const go=document.createElement('button');go.type='button';go.textContent='Watch';
      go.style.cssText='border:1px solid rgba(63,102,106,.3);border-radius:999px;padding:3px 10px;background:transparent;color:#3f666a;font:500 11.5px Nunito,system-ui;cursor:pointer';
      go.onclick=()=>{if(offered)watchMoment(offered);};
      momentChip.append(text,go);document.body.appendChild(momentChip);
    }
    momentChip.firstChild.textContent=`${m.emoji} ${m.text}`;momentChip.style.display='flex';momentChip.style.opacity='1';
  }
  function hideChip(){if(momentChip){momentChip.style.opacity='0';setTimeout(()=>{if(!offered&&momentChip)momentChip.style.display='none';},400);}offered=null;momentCooldown=clockMs()+30000;}
  function watchMoment(m){
    hideChip();momentStats.watched++;
    watching=Object.assign(m,{started:clockMs(),home:town.view?town.view():null});
    if(m.ref&&town.follow){town.follow(m.ref,3);ensureFollowCard();followNext=0;}
    else if(town.viewTo){const p=m.at();town.viewTo(p.x,p.z,2.9);watching.lastSet=town.view();}
    // A voluntary camera tour should not interrupt the quiet town with a chime.
  }
  function endWatch(restore){
    const w=watching;watching=null;if(!w)return;
    if(town.follow)town.follow(null);
    if(restore&&w.home&&town.viewTo)town.viewTo(w.home.x,w.home.y,w.home.z);
  }
  function updateMoments(){
    const now=clockMs();
    if(offered&&now-offered.offeredAt>5500)hideChip();
    if(watching){
      const w=watching,elapsed=(now-w.started)/1000;
      if(w.ref){
        const gone=!town.movers().includes(w.ref);
        if(gone||w.done?.(w,elapsed)||elapsed>w.max){endWatch(true);return;}
        if(!town.following())  {watching=null;return;}                 // the viewer dragged away: they are in charge now
      }else{
        const v=town.view();if(w.lastSet&&Math.hypot(v.x-w.lastSet.x,v.y-w.lastSet.y)>.05){watching=null;return;}
        if(elapsed>w.max||w.done?.(w,elapsed)){endWatch(true);return;}
        const p=w.at();watching.lastSet=town.viewTo(p.x,p.z);
      }
      return;
    }
    if(now<momentScan)return;momentScan=now+400;
    for(const ref of town.movers()){
      const prev=lastSeen.get(ref);
      const key=`${ref.shopAction}|${ref.routine}|${ref.guitar?'g':''}`;
      if(prev!==undefined&&prev!==key){
        if(ref.shopRole==='customer'&&ref.shopAction==='visiting')
          offerMoment({emoji:ref.shopAt==='bakery'?'🥖':'📚',text:`${nameOf(ref)} is off to buy ${ref.shopAt==='bakery'?'bread':'a book'}`,ref,max:45,
            done:(w,t)=>{if(ref.shopAction==='carrying'){w.carryAt=w.carryAt||t;return t-w.carryAt>5;}return false;}});
        else if(ref.shopAction==='performing'&&!/performing/.test(prev))offerMoment({emoji:'🎸',text:'A street concert is starting',ref,max:20,done:()=>ref.shopAction!=='performing'});
      }
      if(prev===undefined&&ref.routine==='school')offerMoment({emoji:'🎒',text:`${nameOf(ref)} is off to school`,ref,max:40});
      if(prev===undefined&&ref.routine==='home')offerMoment({emoji:'🏠',text:`${nameOf(ref)} is walking home`,ref,max:45});
      lastSeen.set(ref,key);
    }
    for(const e of town.events?.()||[]){
      if(seenEvents.has(e))continue;seenEvents.add(e);
      const look=EVENT_MOMENTS[e.name];if(!look)continue;
      const who=e.follow&&town.movers().includes(e.follow)?e.follow:null;
      offerMoment(who?{emoji:look[0],text:look[1],ref:who,max:Math.min(30,e.dur||20)}:{emoji:look[0],text:look[1],at:()=>({x:e.x,z:e.y}),max:Math.min(24,e.dur||16),done:()=>!town.events().includes(e)});
    }
  }
  /* ---- Weather from ToyTownWeather (Open-Meteo near you, or ?weather=):
     rain streaks and umbrellas, drifting snow with a white dusting, fog,
     storm flashes, and the sun dimmed under cloud. */
  let weatherKind='clear',precip=null,dusting=null,flashUntil=0,nextFlash=0,sunK=1,grayK=0,grayCol='#9aa3ab';
  const leavingPrecip=[],rainRoofs=[];let rainSplashes=[],splashClock=0;
  const RAIN_OPACITY=.32;
  function rainSurface(x,z){
    let h=groundLevel(x,z);
    for(const r of rainRoofs)if(Math.abs(x-r.x)<r.rx&&Math.abs(z-r.z)<r.rz)h=Math.max(h,r.top);
    return h;
  }
  function rainImpact(x,z,y){
    if(y>.3||splashClock>0)return;const q=rainSplashes.find(q=>q.age>.32);if(!q)return;
    q.age=0;q.m.position.set(x,y+.004,z);q.m.visible=true;splashClock=.055;
  }
  const weatherState=()=>(typeof window!=='undefined'&&window.ToyTownWeather?.state)||{kind:'clear'};
  const SUN_UNDER={clear:1,cloud:.72,fog:.7,rain:.55,snow:.8,storm:.42};
  function setupPrecip(kind){
    if(precip){precip.parent?.remove(precip);precip=null;}
    if(dusting){dusting.parent?.remove(dusting);dusting=null;}
    for(const q of rainSplashes){q.m.parent?.remove(q.m);q.m.geometry.dispose?.();q.m.material.dispose?.();}rainSplashes=[];
    if(!THREE.BufferGeometry||!THREE.BufferAttribute)return;
    if(kind==='rain'||kind==='storm'){
      const n=lite?160:420,pos=new Float32Array(n*6),colors=new Float32Array(n*6),lengths=new Float32Array(n),speeds=new Float32Array(n);
      for(let i=0;i<n;i++){
        const x=Math.random()*20-1,y=.25+Math.random()*6.7,z=Math.random()*20-1,len=.045+Math.random()*.095;
        lengths[i]=len;speeds[i]=4.5+Math.random()*3.0;pos.set([x,y,z,x-.012,y+len,z],i*6);
        const v=.72+Math.random()*.20;colors.set([v,v+.04,v+.06,v*.63,v*.67,v*.72],i*6);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
      precip=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#b9cbd1',vertexColors:true,transparent:true,opacity:RAIN_OPACITY,depthWrite:false}));
      precip.userData={kind:'rain',lengths,speeds};world.add(precip);
      for(let i=0;i<24;i++){
        const m=new THREE.Mesh(new THREE.TorusGeometry(.018,.0016,4,12),new THREE.MeshBasicMaterial({color:'#c9d9d8',transparent:true,opacity:0,depthWrite:false}));
        m.rotation.x=-Math.PI/2;m.visible=false;world.add(m);rainSplashes.push({m,age:1});
      }
    }else if(kind==='snow'){
      const n=650,pos=new Float32Array(n*3);
      for(let i=0;i<n;i++)pos.set([Math.random()*20-1,Math.random()*7,Math.random()*20-1],i*3);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      precip=new THREE.Points(g,new THREE.PointsMaterial({color:'#ffffff',size:.11,transparent:true,opacity:.92}));
      precip.userData.kind='snow';world.add(precip);
      dusting=new THREE.Mesh(geo('plane',18.4,18.4),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.22,depthWrite:false}));
      dusting.rotation.x=-Math.PI/2;dusting.position.set(9,.2,9);world.add(dusting);
    }
  }
  function umbrellaFor(group,ref){
    const limbs=group.userData.limbs;if(!limbs)return null;
    const u=new THREE.Group();u.position.set(.06,.62,0);limbs.upperBody.add(u);
    cylinder(u,.006,.006,.3,'#4a4f5a',0,-.08,0);
    const canopy=object(u,geo('hairshell',.155),mat(['#e2463a','#3f78c9','#ffb020','#5aa469','#c97fc0'][Math.abs(Math.round((ref.ph||0)*10))%5],.7),0,.07,0,false);
    canopy.scale.y=.55;group.userData.umbrella=u;return u;
  }
  function updateWeather(dt){
    const w=weatherState(),kind=w.kind||'clear';
    // The weather eases in and out: the sun dims and the sky greys gradually, and rain / snow fade rather than snap.
    {const tSun=SUN_UNDER[kind]??1,tGray=tSun<.9?(kind==='storm'?.6:.42):0;sunK+=(tSun-sunK)*.005;grayK+=(tGray-grayK)*.005;if(tGray>0)grayCol=kind==='snow'?'#dfe4ea':'#9aa3ab';}
    if(kind!==weatherKind||(!precip&&(kind==='rain'||kind==='storm'||kind==='snow'))){
      weatherKind=kind;if(precip){precip.userData.leaving=true;leavingPrecip.push(precip);precip=null;}setupPrecip(kind);}
    for(let i=leavingPrecip.length-1;i>=0;i--){const q=leavingPrecip[i];q.userData.fade=(q.userData.fade??1)-dt*.35;if(q.userData.fade<=0){q.parent?.remove(q);q.geometry.dispose?.();q.material.dispose?.();leavingPrecip.splice(i,1);continue;}
      q.material.opacity=(q.userData.kind==='rain'?RAIN_OPACITY:.92)*q.userData.fade;
      const a=q.geometry.attributes.position.array,fall=q.userData.kind==='rain'?7.5*dt:.55*dt;for(let j=1;j<a.length;j+=(q.userData.kind==='rain'?6:3)){a[j]-=fall;if(q.userData.kind==='rain')a[j+3]-=fall;}q.geometry.attributes.position.needsUpdate=true;}
    if(precip&&precip.material){precip.userData.fade=Math.min(1,(precip.userData.fade??0)+dt*.3);precip.material.opacity=(precip.userData.kind==='rain'?RAIN_OPACITY:.92)*precip.userData.fade;}
    const wet=kind==='rain'||kind==='storm';
    for(const [ref,item] of actors){
      if(item.kind!=='person')continue;
      let u=item.group.userData.umbrella;
      if(wet&&!u&&!ref.shopRole&&!ref.guitar)u=umbrellaFor(item.group,ref);
      if(u)u.visible=wet;
    }
    if(precip){
      const pos=precip.geometry.attributes.position,a=pos.array,isRain=precip.userData.kind==='rain',step=isRain?6:3;
      const drift=(w.windy?.35:.09)*dt;
      for(let i=0;i<a.length;i+=step){
        const k=i/step,fall=isRain?precip.userData.speeds[k]*dt:.55*dt;
        a[i+1]-=fall;a[i]+=drift;
        if(isRain){a[i+3]=a[i]-.012;a[i+4]=a[i+1]+precip.userData.lengths[k];a[i+5]=a[i+2];}
        else a[i]+=Math.sin(sceneClock*.8+i)*.004;
        const surface=isRain?rainSurface(a[i],a[i+2]):.18;
        if(a[i+1]<surface){
          if(isRain)rainImpact(a[i],a[i+2],surface);
          const x=Math.random()*20-1,z=Math.random()*20-1;a[i]=x;a[i+1]=5.5+Math.random()*1.5;a[i+2]=z;
          if(isRain){a[i+3]=x-.012;a[i+4]=a[i+1]+precip.userData.lengths[k];a[i+5]=z;}
        }
      }
      pos.needsUpdate=true;
    }
    splashClock=Math.max(0,splashClock-dt);
    for(const q of rainSplashes){q.age+=dt;const u=q.age/.32;q.m.visible=wet&&u<1;q.m.scale.setScalar(.5+u*1.8);q.m.material.opacity=u<1?(1-u)*.22:0;}
    if(kind==='storm'){const now=clockMs();if(now>nextFlash){flashUntil=now+260;nextFlash=now+10000+Math.random()*14000;sound('rumble');}}
    for(const k of clouds)k.speedScale=w.windy?3:1;
  }
  function updateFollowCard(){
    if(!followCard)return;
    const ref=town.following&&town.following();
    if(!ref){followCard.style.display='none';return;}
    followCard.style.display='flex';
    const now=clockMs();if(now<followNext)return;followNext=now+450;
    followCard.firstChild.innerHTML='';
    const b=document.createElement('b');b.textContent=nameOf(ref);
    followCard.firstChild.append(b,document.createTextNode(` · ${roleOf(ref)}`),document.createElement('br'),document.createTextNode(doingOf(ref)));
  }
  function tapResident(clientX,clientY){return tap(clientX,clientY);}   // older name, kept for callers
  /* ---- Tap effects: short-lived scene pieces driven by the town clock. */
  let effects=[];
  const tapLight=new THREE.PointLight('#ffd59a',0,2.6,2);tapLight.castShadow=false;scene.add(tapLight);
  function buildingHello(b,text){
    const anchor=new THREE.Object3D();anchor.position.set(b.x+.5,1.35,b.y+.5);world.add(anchor);
    // One porch light, created with the scene, is moved to the tapped house: adding a
    // new light at tap time would make every material recompile and the town hitch.
    tapLight.position.set(b.x+.5,.62,b.y+1.08);
    showBubble(anchor,text,3400);
    effects.push({t:0,life:3.4,parts:[anchor],tick(e){tapLight.intensity=e.t<1.2?Math.sin(e.t/1.2*Math.PI)*3.5:0;}});
  }
  function surprise(x,z){
    while(effects.length>=6){const old=effects.shift();for(const p of old.parts)p.parent?.remove(p);}   // a flurry of taps never piles up
    const now=town.debug().clock||0;
    // Everyone close by turns to look, and the nearest few cheer.
    const near=[...actors].filter(([ref,item])=>item.kind==='person'&&Math.hypot(ref.x-x,ref.y-z)<2.4).sort((a,b)=>Math.hypot(a[0].x-x,a[0].y-z)-Math.hypot(b[0].x-x,b[0].y-z));
    near.forEach(([ref],i)=>{ref.lookAt={x,y:z};ref.lookUntil=now+3.2;if(i<4){ref.cheerUntil=now+2.4;}});
    town.gather?.(x,z);   // and the nearest walkers come over to see
    const kind=['balloons','birds','confetti'][Math.floor(Math.random()*3)],parts=[];
    sound(kind==='birds'?'chirp':'pop');
    if(kind==='balloons'){
      for(let k=0;k<5;k++){const g=new THREE.Group();g.position.set(x+(Math.random()-.5)*.4,.3,z+(Math.random()-.5)*.4);
        const ballMesh=ball(g,.085,['#e2463a','#ffd23f','#3f8fd6','#ff8fd0','#5aa469'][k],0,.22,0);ballMesh.scale.y=1.18;
        cylinder(g,.003,.003,.2,'#5b5b5b',0,.08,0);world.add(g);parts.push(g);g.userData.v=[(Math.random()-.5)*.12,.45+Math.random()*.25,(Math.random()-.5)*.12];}
      effects.push({t:0,life:9,parts,tick(e,dt){for(const g of parts){g.position.x+=g.userData.v[0]*dt;g.position.y+=g.userData.v[1]*dt;g.position.z+=g.userData.v[2]*dt;g.rotation.z=Math.sin(e.t*2+g.position.x)*.15;}}});
    }else if(kind==='birds'){
      for(let k=0;k<7;k++){const g=new THREE.Group();g.position.set(x+(Math.random()-.5)*.6,.2,z+(Math.random()-.5)*.6);
        const body=ball(g,.04,'#8b8f9a',0,0,0);body.scale.set(1.5,.8,.8);
        const wings=[box(g,.012,.01,.1,'#9aa0aa',0,.02,.06,false),box(g,.012,.01,.1,'#9aa0aa',0,.02,-.06,false)];
        g.userData={wings,a:Math.random()*TAU,ph:Math.random()*6};world.add(g);parts.push(g);}
      effects.push({t:0,life:6,parts,tick(e,dt){for(const g of parts){const u=g.userData;g.position.x+=Math.cos(u.a)*dt*.9;g.position.z+=Math.sin(u.a)*dt*.9;g.position.y+=dt*(.5+e.t*.25);g.rotation.y=-u.a;
        const f=Math.sin(e.t*22+u.ph)*.9;u.wings[0].rotation.x=f;u.wings[1].rotation.x=-f;}}});
    }else{
      const cols=['#e2463a','#ffd23f','#3f8fd6','#ff8fd0','#5aa469','#ffffff'];
      for(let k=0;k<26;k++){const m=box(world,.045,.006,.03,cols[k%cols.length],x,.3,z,false);m.castShadow=false;
        m.userData.v=[(Math.random()-.5)*1.4,1.4+Math.random()*1.2,(Math.random()-.5)*1.4];m.userData.spin=Math.random()*8;parts.push(m);}
      effects.push({t:0,life:4,parts,tick(e,dt){for(const m of parts){const v=m.userData.v;v[1]-=dt*2.6;m.position.x+=v[0]*dt;m.position.z+=v[2]*dt;
        m.position.y=Math.max(.19,m.position.y+v[1]*dt);if(m.position.y<=.19){v[0]*=.9;v[2]*=.9;}m.rotation.x+=m.userData.spin*dt;m.rotation.z+=m.userData.spin*.7*dt;}}});
    }
    if(Math.random()<.6&&near[0])showBubble(actors.get(near[0][0]).group,['Ooh, look!','Wow!','How lovely!','Did you see that?'][Math.floor(Math.random()*4)],2600);
  }
  function updateEffects(dt){
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.t+=dt;e.tick(e,dt);
      if(e.t>e.life){for(const p of e.parts)p.parent?.remove(p);effects.splice(i,1);}}
  }
  function showCrierBubble(group,text,ms,credit){
    if(typeof document==='undefined')return;
    if(!crierBubble){crierBubble=document.createElement('div');crierBubble.className='resident-bubble';
      crierBubble.style.cssText='position:absolute;transform:translate(-50%,-100%);width:max-content;max-width:min(230px,66vw);padding:4px 10px;border-radius:12px;background:rgba(255,249,232,.82);border:1px solid rgba(226,178,79,.32);color:#4a5260;font:400 11.5px/1.3 Nunito,system-ui,sans-serif;box-shadow:0 2px 8px rgba(30,50,70,.08);pointer-events:none;transition:opacity .4s;z-index:4;opacity:0';
      host.appendChild(crierBubble);}
    crierBubble.textContent=text;
    if(credit){const c=document.createElement('div');c.textContent=credit;c.style.cssText='font:400 9.5px/1.2 Nunito,system-ui;color:#9a8a60;margin-top:2px';crierBubble.appendChild(c);}
    crierBubble.userData={item:{group},until:clockMs()+ms};crierBubble.style.opacity='1';
  }
  function showBubble(group,text,ms,credit){
    if(typeof document==='undefined')return;
    if(!bubble){bubble=document.createElement('div');bubble.className='resident-bubble';
      bubble.style.cssText='position:absolute;transform:translate(-50%,-100%);width:max-content;max-width:min(300px,80vw);padding:6px 12px;border-radius:16px;background:#fffdf7;color:#3d4552;font:500 13px/1.3 Nunito,system-ui,sans-serif;box-shadow:0 4px 14px rgba(30,50,70,.2);text-align:center;pointer-events:none;transition:opacity .3s;z-index:3';
      host.appendChild(bubble);}
    bubble.textContent=text;
    if(credit){const c=document.createElement('div');c.textContent=credit;c.style.cssText='font:500 10px/1.2 Nunito,system-ui;color:#8a8f99;margin-top:2px';bubble.appendChild(c);}
    bubble.userData={item:{group},until:clockMs()+ms};bubble.style.opacity='1';
  }
  /* ---- A visitor from "on this day": a brass time pod drops into a lawn, someone
     in period clothes steps out, says the year and what happened (a gentle
     Wikipedia "on this day" entry; grim ones are filtered with the town's own
     GRIM list), waves, and the pod lifts away. Real history, credited. */
  let onThisDay=[],timeVisit=null,nextVisit=40;
  const grim=text=>(town.GRIM||[]).some(w=>w.endsWith('*')?new RegExp('\\b'+w.slice(0,-1),'i').test(text):new RegExp('\\b'+w+'\\b','i').test(text));
  function lightHistory(list){
    return (list||[]).map(o=>({year:o.year,text:String(o.text||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim()}))
      .filter(o=>o.year&&o.text.length>12&&!grim(o.text)).slice(0,8);
  }
  function shortHistory(text){
    const first=text.split(/[;:(]/)[0].replace(/\.$/,'');
    return first.length>96?first.slice(0,94).replace(/\s\S*$/,'')+'…':first;
  }
  function timePod(){
    const g=new THREE.Group();
    const brass=new THREE.MeshStandardMaterial({color:'#d9a54a',roughness:.35,metalness:.6});
    const body=object(g,geo('sphere',.26),brass,0,.34,0);body.scale.set(1,1.08,1);
    const glow=new THREE.MeshStandardMaterial({color:'#fff1c8',emissive:'#ffcf7a',emissiveIntensity:.2,roughness:.3});
    const port=object(g,geo('sphere',.11),glow,0,.36,.2,false);port.scale.set(1,1,.35);
    for(let k=0;k<3;k++){const a=k*TAU/3,leg=cylinder(g,.012,.016,.2,'#7a5530',Math.cos(a)*.17,.08,Math.sin(a)*.17);leg.rotation.z=Math.cos(a)*.35;leg.rotation.x=-Math.sin(a)*.35;}
    ball(g,.035,'#ffd23f',0,.64,0);
    g.scale.setScalar(1.35);g.userData.glow=glow;return g;
  }
  function visitor(era){
    const g=new THREE.Group(),coat=era<1900?'#6b4a2b':era<1970?'#6f6a8f':'#d9603e';
    box(g,.13,.2,.09,coat,0,.2,0);
    for(const x of [-.035,.035])cylinder(g,.018,.02,.11,'#3b3f4a',x,.055,0);
    ball(g,.065,'#f1c9a5',0,.36,0);
    cylinder(g,.09,.09,.012,'#2d3440',0,.42,0);cylinder(g,.05,.055,.1,'#2d3440',0,.48,0);   // top hat
    const arm=box(g,.03,.13,.03,coat,.085,.25,0,false);g.userData.arm=arm;
    g.scale.setScalar(1.3);return g;
  }
  function startVisit(){
    const o=onThisDay[Math.floor(Math.random()*onThisDay.length)];
    // A clear patch of lawn: away from every building, the big plaza fixtures and the cinema.
    const big=new Set(['stage','lab','market','zoo','stadium','launchpad','fountain','kiosk','times','tree']);
    const lawns=[];for(const bx of [2.5,3.5,4.5,7.5,8.5,9.5,12.5,13.5,14.5])for(const bz of [2.5,3.5,4.5,7.5,8.5,9.5])lawns.push([bx,bz]);
    let clear=lawns.filter(([x,z])=>Math.hypot(x-CINEMA.x,z-CINEMA.z)>2&&Math.hypot(x-9,z-9)>2.4&&   // never the busy central plaza

      !town.buildings().some(b=>Math.abs(b.x+.5-x)<1.05&&Math.abs(b.y+.5-z)<1.05)&&
      !town.props().some(p=>big.has(p.kind)&&Math.hypot(p.x-x,p.y-z)<(p.kind==='tree'?.7:1.8)));
    if(!clear.length)clear=[[8.5,12.2]];
    const [x,z]=clear[Math.floor(Math.random()*clear.length)],pod=timePod(),who=visitor(o.year);
    pod.position.set(x,6,z);who.position.set(x+.32,.17,z+.22);who.visible=false;world.add(pod,who);
    timeVisit={o,pod,who,t:0,x,z,said:0};
    offerMoment({emoji:'⏳',text:`A visitor from ${o.year} is landing`,at:()=>({x,z}),max:26,done:()=>!timeVisit});
  }
  function updateVisit(dt){
    if(!timeVisit){if(onThisDay.length&&sceneClock>nextVisit){startVisit();nextVisit=sceneClock+150+Math.random()*90;}return;}
    const v=timeVisit;v.t+=dt;
    if(v.t<2.2)v.pod.position.y=.17+Math.max(0,6*(1-v.t/2.2)**2);                          // drops in
    v.pod.userData.glow.emissiveIntensity=v.t<2.4?.2+v.t*.6:Math.max(.2,1.6-(v.t-2.4)*.1);
    if(v.t>3)v.who.visible=v.t<22;
    if(v.t>4&&v.said===0){v.said=1;showBubble(v.who,`Greetings from ${v.o.year}!`,3600);}
    if(v.t>8&&v.said===1){v.said=2;showBubble(v.who,`On this day in ${v.o.year}: ${shortHistory(v.o.text)}.`,9000,'On this day · Wikipedia');}
    if(v.t>18&&v.said===2){v.said=3;showBubble(v.who,'Lovely town. Must dash!',3200);}
    if(v.who.userData.arm)v.who.userData.arm.rotation.z=v.t>17&&v.t<21?-2.4+Math.sin(v.t*9)*.4:0;   // waves goodbye
    if(v.t>23)v.pod.position.y+=dt*(v.t-23)*4;                                                       // lifts away
    if(v.t>27){world.remove(v.pod,v.who);timeVisit=null;}
  }
  /* ---- The morning paper round: at dawn (and once soon after opening) a paper
     carrier cycles an east-west street and tosses a rolled paper onto each
     doorstep that faces it; the papers lie there until mid-morning. */
  let round=null,papers=[],nextRound=18,wasNight=false;
  function rider(){
    const g=new THREE.Group(),wheel=geo('torus',.07,.012);
    for(const x of [-.11,.11]){const w=object(g,wheel,mat('#2d3440'),x,.08,0,false);g.userData.wheels=(g.userData.wheels||[]).concat(w);}
    const bar=box(g,.24,.02,.02,'#d0543a',0,.13,0,false);bar.rotation.z=.1;
    box(g,.1,.16,.08,'#5aa469',-.02,.28,0);ball(g,.055,'#d8a77c',-.01,.41,0);
    const cap=ball(g,.058,'#3f78c9',-.01,.43,0);cap.scale.y=.5;
    box(g,.08,.07,.1,'#c79a5a',-.1,.24,.06,false);                                                    // the satchel
    g.scale.setScalar(1.45);return g;   // a touch larger than life so the round reads at normal zoom
  }
  function paperRoll(){const g=new THREE.Group();const r=cylinder(g,.022,.022,.13,'#f4efe2',0,0,0);r.rotation.z=Math.PI/2;
    cylinder(g,.024,.024,.02,'#d0543a',0,0,0).rotation.z=Math.PI/2;g.scale.setScalar(1.7);return g;}
  function startRound(){
    nextRound=Infinity;wasNight=false;
    // The street with the most front doors on it gets the round.
    const facing=l=>town.buildings().filter(b=>(b.kind==='house'||b.kind==='shop')&&b.y+1===l);
    const line=LINES.slice(1,3).sort((a,b)=>facing(b).length-facing(a).length||Math.random()-.5)[0];
    const doors=facing(line).map(b=>({x:b.x+.5,z:b.y+.98,done:false}));
    const g=rider();g.position.set(1.4,.17,line+.5+.28);world.add(g);
    round={g,line,doors,flying:[],x:1.4};
    offerMoment({emoji:'📰',text:'The paper round has started',at:()=>({x:round?round.x:9,z:line+.8}),max:30,done:()=>!round});
  }
  function updateRound(dt,dark){
    if(dark>.5)wasNight=true;
    if(!round&&((wasNight&&dark<.15)||sceneClock>nextRound))startRound();
    for(let i=papers.length-1;i>=0;i--)if(sceneClock>papers[i].until){world.remove(papers[i].g);papers.splice(i,1);}
    if(!round)return;
    const r=round;r.x+=dt*.55;r.g.position.x=r.x;r.g.position.y=.17+Math.abs(Math.sin(r.x*9))*.006;
    for(const w of r.g.userData.wheels||[])w.rotation.z-=dt*8;
    for(const d of r.doors)if(!d.done&&Math.abs(d.x-r.x)<.25){d.done=true;const p=paperRoll();p.position.copy(r.g.position);world.add(p);r.flying.push({p,from:r.g.position.clone(),to:d,t:0});}
    for(let i=r.flying.length-1;i>=0;i--){const f=r.flying[i];f.t=Math.min(1,f.t+dt*1.6);
      f.p.position.set(f.from.x+(f.to.x-f.from.x)*f.t,.3+Math.sin(f.t*Math.PI)*.45,f.from.z+(f.to.z-f.from.z)*f.t);f.p.rotation.y+=dt*9;
      if(f.t>=1){f.p.position.y=.2;f.p.rotation.y=.4;papers.push({g:f.p,until:sceneClock+120});r.flying.splice(i,1);}}
    if(r.x>16.6&&!r.flying.length){world.remove(r.g);round=null;}
  }
  let sceneClock=0,lastClockAt=null;
  function placeBubble(){for(const b of [bubble,crierBubble])placeOne(b);}
  function placeOne(bubble){
    if(!bubble||!bubble.userData)return;
    const {item,until}=bubble.userData;
    if(clockMs()>until||!item.group.parent||item.group.visible===false){bubble.style.opacity='0';return;}
    const v=new THREE.Vector3().copy(item.group.position);v.y+=.62;v.project(camera);
    const r=renderer.domElement.getBoundingClientRect();
    const half=(bubble.offsetWidth||120)/2+8;   // keep the whole bubble on screen
    bubble.style.left=THREE.MathUtils.clamp((v.x+1)/2*r.width,half,r.width-half)+'px';bubble.style.top=Math.max((bubble.offsetHeight||28)+8,(1-v.y)/2*r.height)+'px';
  }
  // The five plaza buildings in KayKit style. Plain-fronted models sit behind
  // the bakery and bookshop counters (their striped awnings, cabinets, bells
  // and hinged serving windows are separate shop-front pieces and unchanged).
  const BUILDING_HUES=[0,30,95,200,0,18];   // degrees: salmon, butter, sage, sky, salmon, peach
  const CENTRE_SQUASH=.6,TOWER_SQUASH=.74;   // the apartment towers are lower too: nothing in town dwarfs the square
  function kitLandmark(b){
    if(!kit||!['shop','house'].includes(b.kind))return false;
    const shop=b.kind==='shop',name=shop?(b.name==='BAKERY'?'building_D':'building_B'):['building_C','building_F','building_A'][Math.abs(b.x*3+b.y)%3];
    const placed=kitPlace(world,name,b.x+.5,.17,b.y+.5,{fit:.98,squash:CENTRE_SQUASH});   // the city-centre buildings are low: they must not tower over the square
    if(!placed)return false;
    placed.userData.landmark=true;placed.userData.uniqueAsset=true;
    rainRoofs.push({x:b.x+.5,z:b.y+.5,rx:placed.userData.size.x/2,rz:placed.userData.size.z/2,top:.17+placed.userData.size.y});
    if(!shop)porchLamp(placed,b);
    if(shop){const z=placed.userData.size.z/2+.012;sign(placed,b.name==='BAKERY'?'BAKERY':'BOOK NOOK',0,placed.userData.size.y*.8,z,.36,'#4a3f37','#fff3dc');}
    return true;
  }
  function kitBuilding(b){
    if(!kit||!['house','shop','tower'].includes(b.kind))return false;
    const pickFrom={house:['building_A','building_C','building_B'],shop:['building_B','building_D','building_F'],tower:['building_H','building_G','building_E']}[b.kind];
    const name=pickFrom[Math.abs(Math.round(b.x*7+b.y*13+(worldSeed||0)))%pickFrom.length];
    // Fronts face the street that runs past the block (south, toward the camera, like the town's own houses).
    const placed=kitPlace(world,name,b.x+.5,.17,b.y+.5,{fit:b.kind==='tower'?1.02:.98,rotY:0,squash:b.kind==='tower'?TOWER_SQUASH:1,hue:BUILDING_HUES[Math.abs(Math.round(b.x*5+b.y*11+(worldSeed||0)))%BUILDING_HUES.length]});
    if(!placed)return false;
    placed.userData.buildingKind=b.kind;composedBuildings++;
    const roofTop=finishRoof(placed,b);
    rainRoofs.push({x:b.x+.5,z:b.y+.5,rx:placed.userData.size.x/2,rz:placed.userData.size.z/2,top:.17+roofTop});
    if(b.kind==='house')porchLamp(placed,b);
    return true;
  }
  function finishRoof(placed,b){
    const size=placed.userData.size,key=Math.abs(b.x*7+b.y*13);
    const top=size.y;
    const g=new THREE.Group();placed.add(g);g.position.y=top-.025;
    if(b.kind==='house'&&key%3!==0){
      const color=['#a97761','#82918c','#ad8d67'][key%3];
      roof(g,color,0);g.scale.set(size.x*.99,.56,size.z*.99);
      if(key%2)g.rotation.y=Math.PI;
      placed.userData.roofStyle='gable';
      const chimney=box(placed,.09,.20,.10,'#b7a48c',size.x*.22,top+.13,-size.z*.19);
      box(chimney,.115,.035,.125,'#e1d5be',0,.1,0);
      return top+.25;
    }
    if(b.kind==='tower'||b.kind==='house'){
      box(g,size.x*.60,.12,size.z*.55,'#a99b83',0,.06,-size.z*.12);
      box(g,size.x*.66,.025,size.z*.6,'#788e89',0,.13,-size.z*.12);
      placed.userData.roofStyle='terrace';
      return top+.15;
    }
    // Low, differently coloured roof caps give shops a calm horizontal edge.
    box(g,size.x*1.025,.035,size.z*1.025,['#86968a','#b29a7e','#9a8679'][key%3],0,.02,0);
    placed.userData.roofStyle='flat';return top+.04;
  }
  const porchLamps=[];
  function porchLamp(placed,b){
    const glass=new THREE.MeshStandardMaterial({color:'#fff0d0',emissive:'#ffc46e',emissiveIntensity:.05,roughness:.3});
    const z=placed.userData.size.z/2+.02;
    box(placed,.05,.02,.04,'#3b3f4a',0,.42,z-.01,false);
    const lamp=box(placed,.04,.05,.04,glass,0,.385,z,false);lamp.castShadow=false;
    porchLamps.push({b,glass});
  }
  /* ---- Static batching. The town is ~6,000 small meshes; every one is a draw call. Everything that never moves
     (buildings, trees, roads, props) is merged, per material and per coarse map cell (so off-screen parts are still
     culled), into a few hundred meshes. Anything that animates (the registered ambient pieces, clouds, cinema viewers),
     everything translucent and everything invisible stays as it was. ?nobatch switches it off. ---- */
  const batch={geos:[],removed:0,merged:0,off:typeof location!=='undefined'&&/[?&]nobatch\b/.test(location.search||''),candidates:[]};
  const CELLS=3;
  function batchStatic(end){
    for(const g of batch.geos)g.dispose?.();
    batch.geos=[];batch.removed=0;batch.merged=0;batch.candidates=[];
    if(!THREE.Matrix4||!THREE.Matrix3||!THREE.BufferGeometry||!THREE.BufferAttribute||!world.updateMatrixWorld)return;
    const skip=new Set(),mark=o=>o?.traverse?.(n=>skip.add(n));
    for(const a of ambient)mark(a.mesh);   // animated pieces, and the working shopfronts (kept whole: the visual test checks their parts)
    for(const k of clouds)mark(k.c);
    for(const v of cinemaViewers)mark(v);
    mark(site.slew);mark(site.trolley);mark(site.cable);mark(site.hook);mark(site.load);mark(site.mixer);
    mark(cinemaBeam);mark(cinemaScreen);mark(shootingStar);mark(fireflies);
    world.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(world.matrixWorld).invert(),buckets=new Map(),plainBefore=THREE.Object3D.prototype.onBeforeRender;
    const walk=o=>{
      if(!o.visible||skip.has(o)||o.userData?.noBatch||o.userData?.limbs)return;   // hidden, animated, or a person rig
      if(o.isMesh&&!o.isInstancedMesh&&!o.isSkinnedMesh&&!o.isPoints&&!o.isLine){
        const m=o.material,g=o.geometry,at=g?.attributes;
        if(m&&!Array.isArray(m)&&((!m.transparent&&m.depthWrite!==false)||m===groundingMaterial)&&!o.renderOrder&&o.frustumCulled!==false&&o.onBeforeRender===plainBefore&&
           at?.position&&at.normal&&!at.position.isInterleavedBufferAttribute&&!at.normal.isInterleavedBufferAttribute&&!o.userData?.noBatch){
          if(!m.vertexColors||at.color){
            const mw=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
            const cx=Math.floor(mw.elements[12]/6),cz=Math.floor(mw.elements[14]/6);
            const sig=Object.keys(at).sort().map(k=>k+at[k].itemSize+(at[k].isInterleavedBufferAttribute?'i':'')).join(',');
            const key=m.uuid+'|'+cx+','+cz+'|'+sig+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0);
            let b=buckets.get(key);if(!b){b={material:m,cast:o.castShadow,receive:o.receiveShadow,list:[],names:Object.keys(at).filter(k=>!at[k].isInterleavedBufferAttribute)};buckets.set(key,b);}
            b.list.push({o,mw});
          }
        }
      }
      for(const c of o.children)walk(c);
    };
    for(const r of world.children.slice(0,end))walk(r);
    batch.candidates=[...buckets.values()].flatMap(b=>b.list.map(e=>e.o));
    if(batch.off)return;
    const nm=new THREE.Matrix3(),v=new THREE.Vector3();
    for(const b of buckets.values()){
      if(b.list.length<2)continue;   // a lone mesh gains nothing
      let nv=0,ni=0;
      for(const {o} of b.list){nv+=o.geometry.attributes.position.count;ni+=o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count;}
      const out={};for(const n of b.names){const a=b.list[0].o.geometry.attributes[n];out[n]=new Float32Array(nv*a.itemSize);}
      const idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);
      let vo=0,io=0;
      for(const {o,mw} of b.list){
        const g=o.geometry,pos=g.attributes.position,count=pos.count,flip=mw.determinant()<0;
        nm.getNormalMatrix(mw);
        for(const n of b.names){
          const a=g.attributes[n],sz=a.itemSize,src=a.array,dst=out[n];
          if(n==='position'){for(let i=0;i<count;i++){v.set(src[i*3],src[i*3+1],src[i*3+2]).applyMatrix4(mw);dst[(vo+i)*3]=v.x;dst[(vo+i)*3+1]=v.y;dst[(vo+i)*3+2]=v.z;}}
          else if(n==='normal'){for(let i=0;i<count;i++){v.set(src[i*3],src[i*3+1],src[i*3+2]).applyMatrix3(nm).normalize();dst[(vo+i)*3]=v.x;dst[(vo+i)*3+1]=v.y;dst[(vo+i)*3+2]=v.z;}}
          else for(let i=0;i<count*sz;i++)dst[vo*sz+i]=src[i];
        }
        const ix=g.index;
        if(ix){const ia=ix.array;for(let i=0;i<ix.count;i+=3){if(flip){idx[io++]=ia[i]+vo;idx[io++]=ia[i+2]+vo;idx[io++]=ia[i+1]+vo;}else{idx[io++]=ia[i]+vo;idx[io++]=ia[i+1]+vo;idx[io++]=ia[i+2]+vo;}}}
        else for(let i=0;i<count;i+=3){if(flip){idx[io++]=i+vo;idx[io++]=i+2+vo;idx[io++]=i+1+vo;}else{idx[io++]=i+vo;idx[io++]=i+1+vo;idx[io++]=i+2+vo;}}
        vo+=count;
      }
      const mg=new THREE.BufferGeometry();
      for(const n of b.names)mg.setAttribute(n,new THREE.BufferAttribute(out[n],b.list[0].o.geometry.attributes[n].itemSize));
      mg.setIndex(new THREE.BufferAttribute(idx,1));mg.computeBoundingSphere();
      const mesh=new THREE.Mesh(mg,b.material);mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;mesh.matrixAutoUpdate=false;mesh.userData.staticBatch=true;
      for(const {o} of b.list)o.parent?.remove(o);
      world.add(mesh);batch.geos.push(mg);batch.removed+=b.list.length;batch.merged++;
    }
  }
  // These are selected street traditions, not a claim that one style defines
  // an entire country. Each model replaces a building inside its existing lot.
  let countryPlace=null,countryLot=null;
  const COUNTRY_PLACES={india:['Stepwell','drawing water'],japan:['Shrine garden','bowing at the gate'],italy:['Bell tower piazza','having a coffee'],netherlands:['Windmill','watching the sails'],usa:['Town hall court','shooting hoops']};
  function countryLandmark(b){
    const g=new THREE.Group();g.position.set(b.x+.5,.17,b.y+.5);world.add(g);
    g.userData={countryBuilding:country,buildingKind:b.kind,landmark:true,countryLandmark:COUNTRY_PLACES[country][0],roofTop:1.65,noBatch:true};
    const cream='#eadbbd',wood='#795c44',stone='#c8b69b';
    box(g,.94,.06,.94,stone,0,.03,0,false);
    let rotor=null,bell=null,ballMesh=null;
    if(country==='india'){
      // A raised, contained stepwell: the steps descend to actual water.
      box(g,.86,.30,.80,'#ca9d75',0,.17,0,false);
      box(g,.42,.025,.36,'#79b7b3',0,.335,0,false);
      for(const side of [-1,1])for(let i=0;i<3;i++){
        box(g,.085,.045,.66,'#e9caa2',side*(.27+i*.075),.36+i*.045,0,false);
        box(g,.48,.045,.075,'#e9caa2',0,.36+i*.045,side*(.23+i*.075),false);
      }
      for(const x of [-.34,.34])cylinder(g,.025,.032,.55,cream,x,.57,-.31);
      box(g,.84,.06,.28,cream,0,.85,-.31,false);
      const dome=ball(g,.20,'#b36e50',0,.91,-.31);dome.scale.y=.55;
      sign(g,'STEPWELL',0,.73,-.15,.42);
    }else if(country==='japan'){
      // Torii at the entrance, with a compact shrine behind a stone garden.
      box(g,.43,.46,.39,'#e4d4b5',0,.31,-.21,false);
      const rg=new THREE.Group();g.add(rg);roof(rg,'#505a5c',.55);rg.scale.set(.55,.65,.5);rg.position.set(0,.18,-.21);
      box(g,.15,.29,.022,wood,0,.23,.00,false);
      for(const x of [-.35,.35])cylinder(g,.025,.034,.69,'#b7503b',x,.40,.28);
      box(g,.88,.045,.095,'#b7503b',0,.77,.28,false);box(g,.76,.035,.07,'#b7503b',0,.62,.28,false);
      for(const x of [-.32,.31]){const rock=ball(g,.085,'#88958b',x,.10,-.20);rock.scale.set(.8,.65,1.2);}
      for(let i=0;i<4;i++)box(g,.14,.015,.08,'#abb4a3',0,.075,.13+i*.085,false);
    }else if(country==='italy'){
      box(g,.37,1.22,.36,'#d2b183',-.17,.68,-.17,false);
      for(const x of [-.28,-.06])box(g,.11,.23,.025,'#686452',x,1.17,.025,false);
      for(const x of [-.34,.0])box(g,.045,.32,.41,cream,x,1.17,-.17,false);
      box(g,.46,.055,.46,cream,-.17,1.38,-.17,false);
      const roofG=new THREE.Group();g.add(roofG);roof(roofG,'#b97451',0);roofG.position.set(-.17,1.39,-.17);roofG.scale.set(.45,.48,.45);
      bell=cylinder(g,.045,.075,.10,'#bd9255',-.17,1.20,.04);bell.rotation.x=.2;
      cylinder(g,.16,.16,.035,'#bd9468',.20,.32,.26);cylinder(g,.025,.025,.25,wood,.20,.18,.26);
      for(const x of [.00,.39]){box(g,.13,.025,.13,wood,x,.18,.27,false);box(g,.025,.14,.025,wood,x,.10,.27,false);}
      sign(g,'PIAZZA',.20,.11,.45,.36);
    }else if(country==='netherlands'){
      cylinder(g,.19,.31,1.07,'#af8562',0,.60,-.11);
      const cap=object(g,new THREE.ConeGeometry(.29,.33,12),mat('#667573'),0,1.26,-.11);
      box(g,.15,.30,.025,'#576962',0,.23,.21,false);
      rotor=new THREE.Group();rotor.position.set(0,1.04,.23);rotor.scale.setScalar(.78);g.add(rotor);
      cylinder(rotor,.06,.06,.10,wood,0,0,0).rotation.x=Math.PI/2;
      for(let i=0;i<4;i++){
        const sail=new THREE.Group();sail.rotation.z=i*Math.PI/2;rotor.add(sail);
        box(sail,.026,.66,.03,wood,0,.30,0,false);
        for(let n=0;n<5;n++)box(sail,.16,.026,.024,cream,.055,.17+n*.09,.015,false);
      }
      for(const x of [-.34,.34])for(let z=0;z<3;z++){cylinder(g,.008,.008,.11,'#6c8d63',x,.12,-.32+z*.18);ball(g,.035,['#df8d7d','#e7b75d','#e7d8b7'][z],x,.18,-.32+z*.18);}
    }else{
      box(g,.73,.65,.37,'#c9b59a',0,.40,-.23,false);
      for(const x of [-.28,-.10,.10,.28])cylinder(g,.025,.028,.43,cream,x,.40,-.015);
      box(g,.83,.065,.45,cream,0,.75,-.23,false);
      const clock=ball(g,.10,'#f5e7c8',0,.62,-.025);clock.scale.z=.15;
      box(g,.014,.06,.021,wood,0,.64,.00,false);box(g,.05,.014,.021,wood,.02,.62,.00,false);
      sign(g,'TOWN HALL',0,.81,.015,.48);
      box(g,.77,.014,.36,'#839f92',0,.074,.28,false);
      box(g,.018,.69,.018,'#536967',-.30,.42,.27,false);
      box(g,.27,.17,.025,'#eee8d8',-.30,.76,.29,false);
      const hoop=object(g,geo('torus',.075,.009),mat('#bd7958'),-.30,.68,.38);hoop.rotation.x=Math.PI/2;
      ballMesh=ball(g,.043,'#d19155',.22,.35,.40);
    }
    const visitors=[];
    for(let i=0;i<2;i++){
      const p=person({col:i?'#b995a9':'#779d9b',skin:i?'#c5916e':'#e2b18d',ph:2+i,x:b.x,y:b.y});p.scale.setScalar(.48);g.add(p);
      p.userData.countryVisitor=true;
      const hand=p.userData.limbs.hands[1];
      if(country==='italy'){const cup=cylinder(hand,.030,.026,.045,'#f0e6ce',0,-.045,.025);cup.userData.countryProp='coffee';}
      if(country==='india'){const jug=ball(hand,.046,'#b77f56',0,-.063,.025);jug.scale.y=1.25;jug.userData.countryProp='water jug';}
      visitors.push(p);
    }
    countryPlace={g,rotor,bell,ballMesh,visitors,x:b.x+.5,z:b.y+.5,time:0,activity:COUNTRY_PLACES[country][1]};
    rainRoofs.push({x:b.x+.5,z:b.y+.5,rx:.47,rz:.47,top:country==='india'?.17+.50:1.82});
    countryBuildings++;composedBuildings++;return true;
  }
  function updateCountryPlace(time){
    const p=countryPlace;if(!p)return;p.time=time;
    if(p.rotor)p.rotor.rotation.z=reducedMotion?0:time*.35;
    if(p.bell)p.bell.rotation.x=reducedMotion?0:Math.sin(time*2)*.28;
    for(let i=0;i<p.visitors.length;i++){
      const person=p.visitors[i],phase=(time+i*7)%18;
      const travel=phase<4?phase/4:phase<12?1:1-(phase-12)/6;
      person.position.set(-.32+.54*travel,.07,.50+i*.11);
      person.rotation.y=phase<4?Math.PI/2:phase<12?Math.PI:-Math.PI/2;
      const L=person.userData.limbs,moving=phase<4||phase>=12;
      for(let k=0;k<2;k++){L.legs[k].rotation.x=moving&&!reducedMotion?Math.sin(travel*16+k*Math.PI)*.55:0;L.shins[k].rotation.x=moving?Math.max(0,-Math.sin(travel*16+k*Math.PI))*.6:0;L.arms[k].rotation.x=moving?-.25*L.legs[k].rotation.x:-.6;}
      L.headPivot.rotation.x=!moving&&country==='japan'?.30:0;
      if(!moving&&country==='italy'){L.arms[1].rotation.x=-1.4;L.elbows[1].rotation.x=-.6;}
      if(!moving&&country==='india')L.upperBody.rotation.x=.25;else L.upperBody.rotation.x=0;
      if(!moving&&country==='netherlands')L.headPivot.rotation.x=-.25;
      if(!moving&&country==='usa'){L.arms[1].rotation.x=-2.1;L.elbows[1].rotation.x=-.45;}
      person.userData.countryAction=moving?'walking':p.activity;
    }
    if(p.ballMesh){const t=(time%3)/3;p.ballMesh.position.set(.22-.52*t,.35+t*.33+Math.sin(t*Math.PI)*.55,.40);}
  }

  function countryBuilding(b){
    if(b===countryLot)return countryLandmark(b);
    if(b.kind==='site')return false;
    const styles={
      india:{walls:['#d9a184','#e0b69a','#cd907b'],roof:'#b56e51',trim:'#f5dfb9',wood:'#85533e'},
      japan:{walls:['#e8dcc2','#dfd1b7','#d1b99b'],roof:'#505b60',trim:'#d5c3a1',wood:'#694e3c'},
      italy:{walls:['#e8c38c','#e5b3a0','#ead9b0'],roof:'#b96f4c',trim:'#eee0c4',wood:'#6b8470'},
      netherlands:{walls:['#9d6555','#b57e62','#bba186'],roof:'#645c56',trim:'#f0e5cc',wood:'#4f6462'},
      usa:{walls:['#b87964','#c8ac85','#d2dcd2'],roof:'#66747a',trim:'#f4eada',wood:'#4d6667'}
    },s=styles[country];if(!s)return false;
    const key=Math.abs(Math.round(b.x*7+b.y*11)),g=new THREE.Group();
    g.position.set(b.x+.5,.17,b.y+.5);world.add(g);
    g.userData.countryBuilding=country;g.userData.buildingKind=b.kind;g.userData.landmark=!!b.hero;
    const floors=b.hero?1:b.kind==='tower'?3:country==='netherlands'?2:1+key%2;
    const h=b.hero?.68:.38+floors*.40,w=country==='netherlands'?.76:.88,d=.82;
    const wall=s.walls[key%s.walls.length];
    box(g,w+.06,.075,d+.06,s.trim,0,.037,0,false);
    box(g,w,h,d,wall,0,h/2+.06,0,false);
    let top=h+.06;
    const opening=(x,y,arched=false)=>{
      const glass=box(g,.16,.22,.018,'#506d72',x,y,d/2+.013,false);glass.userData.countryWindow=true;
      if(arched){
        let ag=geometryCache.get('country:arch');
        if(!ag){const sh=new THREE.Shape(),hole=new THREE.Path();
          sh.moveTo(-.105,-.13);sh.lineTo(.105,-.13);sh.lineTo(.105,.035);sh.absarc(0,.035,.105,0,Math.PI,false);sh.closePath();
          hole.moveTo(-.078,-.104);hole.lineTo(-.078,.035);hole.absarc(0,.035,.078,Math.PI,0,true);hole.lineTo(.078,-.104);hole.closePath();sh.holes.push(hole);
          ag=new THREE.ExtrudeGeometry(sh,{depth:.024,bevelEnabled:false,steps:1,curveSegments:10});geometryCache.set('country:arch',ag);}
        object(g,ag,mat(s.trim),x,y,d/2+.026,false);
      }else{
        for(const side of [-1,1])box(g,.026,.265,.035,s.trim,x+side*.095,y,d/2+.025,false);
        for(const side of [-1,1])box(g,.215,.025,.035,s.trim,x,y+side*.122,d/2+.025,false);
      }
      box(g,.015,.23,.025,s.trim,x,y,d/2+.036,false);
      box(g,.17,.015,.025,s.trim,x,y+.012,d/2+.036,false);
      if(country==='italy')for(const side of [-1,1])box(g,.065,.235,.029,s.wood,x+side*.142,y,d/2+.025,false);
    };
    for(let row=0;row<floors;row++)for(const x of [-w*.26,w*.26])opening(x,.37+row*.40,country==='india'||country==='italy');
    // Side windows make the buildings readable from every camera angle.
    for(const side of [-1,1])for(let row=0;row<floors;row++){
      box(g,.021,.22,.18,s.wood,side*(w/2+.012),.37+row*.4,.04,false);
      box(g,.032,.024,.205,s.trim,side*(w/2+.02),.27+row*.4,.04,false);
    }
    box(g,b.kind==='fire'?.59:.16,.30,.030,b.kind==='fire'?'#aa5548':s.wood,0,.22,d/2+.022,false);
    box(g,.24,.045,.12,s.trim,0,.022,d/2+.04,false);
    const gable=(height,color=s.roof,rotate=false)=>{
      const rg=new THREE.Group();g.add(rg);rg.position.y=top;
      // A solid extruded triangular roof volume, shared across matching sizes.
      const k='country:gable:'+w+':'+height;let geom=geometryCache.get(k);
      if(!geom){const sh=new THREE.Shape();sh.moveTo(-w/2-.06,0);sh.lineTo(0,height);sh.lineTo(w/2+.06,0);sh.closePath();
        geom=new THREE.ExtrudeGeometry(sh,{depth:d+.12,bevelEnabled:false,steps:1});geom.translate(0,0,-d/2-.06);geometryCache.set(k,geom);}
      object(rg,geom,roofMaterial(color),0,0,0);if(rotate)rg.rotation.y=Math.PI/2;
      return rg;
    };
    if(country==='india'){
      // Flat terraces, chajja sunshades, pierced balcony rails and chhatris.
      box(g,w+.12,.075,d+.12,s.trim,0,top,0,false);
      for(const side of [-1,1])box(g,.045,.13,d+.04,s.trim,side*(w/2+.015),top+.07,0,false);
      box(g,w,.10,.04,s.trim,0,top+.05,-d/2,false);
      box(g,w*.82,.04,.16,s.trim,0,.52,d/2+.07,false);
      for(let i=0;i<7;i++)box(g,.027,.11,.028,s.trim,(i-3)*w*.11,.59,d/2+.13,false);
      if(b.hero||key%2===0){
        const pavilion=new THREE.Group();pavilion.position.set(0,top+.08,0);g.add(pavilion);pavilion.userData.countryFeature='chhatri';
        for(const x of [-.18,.18])for(const z of [-.18,.18])cylinder(pavilion,.018,.022,.25,s.trim,x,.14,z);
        box(pavilion,.46,.045,.46,s.trim,0,.275,0,false);
        const dome=ball(pavilion,.215,s.roof,0,.30,0);dome.scale.y=.65;
        cylinder(pavilion,.012,.025,.075,s.trim,0,.455,0);top+=.57;
      }else top+=.17;
    }else if(country==='japan'){
      const r=gable(.30);r.userData.countryFeature='machiya-roof';
      for(const side of [-1,1])box(g,.065,h+.06,.055,s.wood,side*(w/2-.035),h/2+.06,d/2+.03,false);
      box(g,w+.08,.055,.08,s.wood,0,top-.025,d/2+.025,false);
      const eave=box(g,w+.16,.055,.30,s.roof,0,.53,d/2+.08,false);eave.rotation.x=.11;
      for(let i=-4;i<=4;i++)box(g,.013,.26,.022,s.wood,i*.078,.32,d/2+.045,false);
      box(g,.055,.075,d+.16,s.roof,0,top+.30,0,false);top+=.35;
    }else if(country==='italy'){
      const r=gable(.27);r.userData.countryFeature='terracotta-roof';
      box(g,.10,.24,.12,s.trim,-.22,top+.18,-.17,false);
      box(g,.14,.035,.16,s.roof,-.22,top+.31,-.17,false);
      box(g,w+.05,.055,.06,s.trim,0,top-.05,d/2+.025,false);
      if(floors>1){box(g,.68,.05,.17,s.trim,0,.59,d/2+.07,false);for(let i=-3;i<=3;i++)box(g,.014,.15,.015,s.wood,i*.095,.68,d/2+.14,false);box(g,.66,.018,.018,s.wood,0,.75,d/2+.14,false);}
      top+=.35;
    }else if(country==='netherlands'){
      gable(.36);const facade=new THREE.Group();g.add(facade);facade.userData.countryFeature='stepped-gable';
      for(let i=0;i<4;i++){
        const sw=w*(1-i*.21);box(facade,sw,.11,.07,wall,0,top+i*.10,d/2+.008,false);
        box(facade,sw+.025,.027,.09,s.trim,0,top+.058+i*.10,d/2+.02,false);
      }
      box(g,.12,.15,.025,s.wood,0,top+.14,d/2+.06,false);
      box(g,.24,.04,.17,s.trim,0,.07,d/2+.06,false);top+=.40;
    }else{
      // Alternate porch cottages and compact brownstone cornices.
      if(key%2||b.hero){const r=gable(.28);r.userData.countryFeature='porch';
        box(g,w*.84,.06,.24,s.trim,0,.045,d/2+.08,false);
        for(const side of [-1,1])box(g,.038,.37,.038,s.trim,side*w*.36,.26,d/2+.16,false);
        box(g,w*.9,.06,.27,s.roof,0,.46,d/2+.09,false);top+=.30;
      }else{box(g,w+.10,.08,d+.08,s.trim,0,top,0,false);box(g,w+.04,.065,d+.03,s.roof,0,top+.06,0,false);g.userData.countryFeature='brownstone';top+=.10;}
    }
    g.userData.roofStyle=country;g.userData.roofTop=top;g.userData.size={x:w,y:h,z:d};
    if(b.kind==='shop'||b.kind==='fire')sign(g,b.kind==='fire'?'FIRE':b.name==='BAKERY'?'BAKERY':'BOOK NOOK',0,.58,d/2+.055,.48,s.wood,s.trim);
    if(b.kind==='house')porchLamp(g,b);
    rainRoofs.push({x:b.x+.5,z:b.y+.5,rx:w/2+.065,rz:d/2+.065,top:.17+top});
    countryBuildings++;composedBuildings++;return true;
  }

  // The historic island remains the simulation centre; six new neighbourhoods
  // share its scene, clock and camera, with trips along connected arterial roads.
  const CITY_BOUNDS={minX:-12,maxX:32,minY:-12,maxY:20};
  const METRO_DISTRICTS=[
    {name:'Garden quarter',x:-7,z:3,type:'garden'},
    {name:'Arts & market',x:-7,z:14,type:'market'},
    {name:'University',x:3,z:-7,type:'campus'},
    {name:'Civic quarter',x:14,z:-7,type:'civic'},
    {name:'Downtown',x:25,z:3,type:'downtown'},
    {name:'Harbour',x:25,z:14,type:'harbour'}
  ];
  const metro={buildings:[],vehicles:[],walkers:[],bridges:[],time:0};
  const metroFacades=new Map();
  function metroFacade(col,index,rows){
    const key=col+':'+index+':'+rows;if(metroFacades.has(key))return metroFacades.get(key);
    const c=document.createElement('canvas');c.width=128;c.height=256;const p=c.getContext('2d');
    p.fillStyle=col;p.fillRect(0,0,128,256);
    for(let row=0;row<rows;row++)for(let k=0;k<3;k++){
      const y=row*256/rows+7,wh=256/rows*.65;
      p.fillStyle='#e9ddc1';p.fillRect(12+k*37,y,22,wh+6);
      p.fillStyle=(row*3+k+index)%7===0?'#ebca8c':'#657f86';p.fillRect(15+k*37,y+3,16,wh);
      p.fillStyle='rgba(228,240,227,.28)';p.fillRect(16+k*37,y+4,6,wh-2);
    }
    const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshStandardMaterial({map:tx,roughness:.88});metroFacades.set(key,m);return m;
  }
  const metroRole=(type,index)=>type==='campus'?['library','lecture hall','observatory'][index%3]:type==='civic'?['council hall','museum','post office'][index%3]:type==='harbour'?'warehouse':type==='market'?['cafe','gallery','bakery'][index%3]:type==='garden'?'porch house':'office';
  function metroPlaque(g,text,x,y,z,w){
    const plaque=sign(g,text,x,y,z,w*.68,'#435c57','#e5ddc7');plaque.scale.y=.60;plaque.userData.metroPlaque=true;return plaque;
  }
  function metroSignature(g,w,d,h,role,col){
    if(!['library','museum','cafe'].includes(role))return false;
    g.userData.metroSignature=role;
    const mass=(width,height,depth,x,y,z,c=col)=>{const m=box(g,width,height,depth,c,x,y,z,false);m.userData.metroMass=role;return m;};
    if(role==='library'){
      // Low reading wings flank a tall glazed central book hall.
      for(const side of [-1,1]){
        mass(w*.28,h*.58,d,side*w*.36,h*.29,0);
        box(g,w*.30,.045,d+.03,'#d9ceb3',side*w*.36,h*.58,0,false);
        box(g,w*.20,h*.34,.025,'#7eaaa8',side*w*.36,h*.31,d/2+.015,false);
        for(let k=0;k<3;k++)box(g,.012,h*.34,.03,'#dbd4bc',side*w*.36+(k-1)*w*.067,h*.31,d/2+.035,false);
      }
      mass(w*.43,h,d*.84,0,h/2,-d*.05);
      box(g,w*.35,h*.78,.025,'#739f9e',0,h*.52,d*.38,false);
      for(let k=0;k<4;k++)box(g,.014,h*.78,.03,'#ddd2b7',(-1.5+k)*w*.085,h*.52,d*.40,false);
      for(let k=0;k<3;k++)box(g,w*.35,.018,.04,'#d3c6a8',0,h*(.25+k*.25),d*.41,false);
      box(g,w*.49,.055,d*.93,'#d9ceb3',0,h+.025,-d*.05,false);
    }else if(role==='museum'){
      // Single-storey stone gallery with a broad, supported colonnaded porch.
      mass(w,h*.78,d,0,h*.39,0,'#c9b89a');
      mass(w*.47,h*.20,d*.67,0,h*.88,-d*.08,'#d9cbb0');
      for(const x of [-.36,-.12,.12,.36])cylinder(g,.025,.035,h*.70,'#e5dac0',x*w,h*.35,d/2+.08);
      box(g,w*1.02,.06,.24,'#e1d4b7',0,h*.73,d/2+.045,false);
      for(const side of [-1,1])box(g,w*.20,h*.35,.025,'#6f8d88',side*w*.28,h*.35,d/2+.015,false);
      box(g,w*.55,.04,d*.76,'#a8977c',0,h+.015,-d*.08,false);
    }else{
      // A compact corner cafe has wraparound glazing and a sheltering roof.
      mass(w,h,d,0,h/2,0);
      box(g,w*.84,h*.58,.025,'#80aaa2',0,h*.43,d/2+.018,false);
      box(g,.025,h*.58,d*.66,'#80aaa2',-w/2-.018,h*.43,d*.05,false);
      for(const x of [-.28,0,.28])box(g,.022,h*.61,.045,'#e8d8b6',x*w,h*.43,d/2+.04,false);
      const r=new THREE.Group();g.add(r);r.position.y=h+.03;r.scale.set(w*1.04,.30,d*1.04);roof(r,country==='japan'?'#566663':'#ad7e5e',0);
      box(g,w*1.04,.04,.27,'#78988a',0,h*.80,d/2+.09,false);
    }
    return true;
  }
  function metroIdentity(g,w,d,h,index,type){
    const cream='#e6d8bd',stone='#c3ad8e',wood='#786650';
    g.userData.metroRole=metroRole(type,index);
    const role=g.userData.metroRole;
    if(['library','museum','cafe'].includes(role)){
      box(g,.15,.27,.035,'#6a796b',0,.15,role==='library'?d*.41+.02:d/2+.04,false);
      metroPlaque(g,role.toUpperCase(),0,role==='library'?h*.82:role==='museum'?h*.73:h*.80,role==='library'?d*.41+.02:role==='museum'?d/2+.17:d/2+.23,w*.80);
    }else if(type==='campus'||type==='civic'){
      const porch=new THREE.Group();g.add(porch);porch.position.z=d/2+.055;
      for(const x of [-w*.32,0,w*.32])cylinder(porch,.025,.032,.44,cream,x,.26,.07);
      box(porch,w*.90,.055,.25,cream,0,.51,.07,false);
      box(porch,.25,.33,.025,wood,0,.22,-.03,false);
      for(let i=0;i<3;i++)box(porch,w*.87,.025,.06,stone,0,.04-i*.012,.18+i*.055,false);
      if(index%3===0){
        const tower=box(g,.30,.53,.30,stone,0,h+.29,0,false);
        const dial=ball(g,.095,'#efe6d2',0,h+.39,.163);dial.scale.z=.12;
        box(g,.012,.07,.02,wood,0,h+.41,.18,false);box(g,.06,.012,.02,wood,.025,h+.39,.18,false);
      }else if(index%3===1){
        const canopy=box(g,w*.8,.07,d*.66,'#819e9d',0,h+.13,0,false);canopy.rotation.z=.12;
      }else if(type==='campus'){
        const dome=ball(g,.30,'#829d9d',0,h+.13,0);dome.scale.y=.70;
        box(g,.035,.21,.10,'#566c6a',0,h+.35,.12,false);
      }
      metroPlaque(porch,g.userData.metroRole.toUpperCase(),0,.60,.12,w*.78);
    }else if(type==='harbour'){
      box(g,w*.76,.40,.03,'#617c7c',0,.23,d/2+.02,false);
      for(let i=0;i<5;i++)box(g,w*.75,.012,.034,'#a5b1a4',0,.07+i*.075,d/2+.04,false);
      box(g,w*.92,.045,.28,stone,0,.035,d/2+.08,false);
      box(g,w+.12,.045,.34,'#748681',0,.55,d/2+.05,false);
      for(const x of [-.28,.26])box(g,.15,.15,.15,'#b5966d',x,.10,d/2+.14,false);
      metroPlaque(g,'WAREHOUSE',0,.62,d/2+.07,w*.70);
    }else if(type==='market'){
      box(g,w*.64,.28,.04,'#7ba2a2',0,.22,d/2+.04,false);
      metroPlaque(g,g.userData.metroRole.toUpperCase(),0,.56,d/2+.10,w*.72);
    }else if(type==='garden'){
      for(const x of [-w*.35,w*.35])box(g,.028,.35,.028,cream,x,.22,d/2+.16,false);
      box(g,w*.83,.045,.31,'#a8a28b',0,.40,d/2+.08,false);
      box(g,.20,.30,.03,wood,0,.19,d/2+.02,false);
    }else if(index%3===0){
      const wing=box(g,w*.30,h*.82,d*.9,'#7f9a9a',w*.54,h*.41,0,false);g.userData.metroRole='stepped office';
    }
  }
  // Public-space details stay inside the reserved, unbuilt corner plot.
  function metroPocket(D){
    const g=new THREE.Group();g.position.set(D.x-2.8,.18,D.z+2.8);g.userData.metroPocket=D.type;world.add(g);
    box(g,1.18,.025,1.18,'#d7cbb1',0,0,0,false);
    const planter=(x,z)=>{box(g,.24,.13,.22,'#b08468',x,.08,z,false);box(g,.20,.02,.18,'#695e48',x,.15,z,false);for(let k=0;k<3;k++)ball(g,.065,['#8eaa78','#e5b276','#bca1be'][k],x+(k-1)*.055,.20,z);};
    planter(-.43,-.43);planter(.43,-.43);
    const bench=(x,z)=>{box(g,.40,.04,.14,'#9b805d',x,.17,z,false);box(g,.40,.15,.025,'#9b805d',x,.25,z-.075,false);for(const dx of [-.14,.14])box(g,.025,.16,.10,'#687b72',x+dx,.08,z,false);};
    if(D.type==='garden'){
      for(let k=0;k<3;k++){box(g,.85,.10,.18,'#a78e6d',0,.07,-.22+k*.25,false);for(let j=0;j<5;j++){const x=-.33+j*.16,z=-.22+k*.25;cylinder(g,.008,.008,.13,'#7f986c',x,.17,z);ball(g,.045,k%2?'#d5a16f':'#b5a2bf',x,.25,z);}}
      metroPlaque(g,'COMMUNITY GARDEN',0,.42,.52,.75);
    }else if(D.type==='civic'){
      cylinder(g,.27,.30,.10,'#b9ad91',0,.07,0);cylinder(g,.23,.23,.015,'#88b6b3',0,.13,0);cylinder(g,.045,.07,.33,'#d2c4a5',0,.27,0);ball(g,.09,'#c6b99d',0,.47,0);bench(0,.43);
    }else if(D.type==='harbour'){
      for(let k=0;k<3;k++){box(g,.26,.20,.28,['#7d9d9a','#b17f66','#c4ac78'][k],-.31+k*.30,.13,0,false);for(let j=0;j<3;j++)box(g,.015,.17,.29,'#d4c4a4',-.40+k*.30+j*.07,.14,0,false);}
      metroPlaque(g,'DOCK SUPPLIES',0,.43,.42,.78);
    }else{
      // Pergola over the existing cafe; the posts frame rather than hide patrons.
      for(const x of [-.52,.52])for(const z of [-.48,.48])box(g,.025,.74,.025,'#9c8868',x,.37,z,false);
      for(let k=0;k<5;k++)box(g,1.13,.035,.055,'#b8a27c',0,.76,-.48+k*.24,false);
      if(D.type==='campus'){box(g,.35,.36,.10,'#85775f',0,.20,-.48,false);for(let k=0;k<4;k++)box(g,.05,.12,.035,['#aa8173','#8eaaa2','#c8ad79','#9b92aa'][k],-.12+k*.08,.23,-.42,false);}
    }
  }
  function metroFacadeDetails(g,w,d,h,index,type){
    // Repeated detail uses shared geometries/materials and remains static-batchable.
    for(const side of [-1,1]){
      cylinder(g,.012,.012,h,'#8c9687',side*(w/2-.025),h/2,d/2+.025);
      if(type!=='harbour'&&index%2===0){
        box(g,.30,.07,.12,'#ad876e',side*w*.27,h*.66,d/2+.065,false);
        for(let k=0;k<3;k++)ball(g,.045,['#91a67a','#d3a3a0','#d4b77b'][(index+k)%3],side*w*.27+(k-1)*.075,h*.66+.06,d/2+.085);
      }
    }
    if(type==='market'){
      const colour=['#9baba3','#c5a47d','#b09393'][index%3];
      box(g,.20,.26,.035,colour,-w*.32,.20,d/2+.04,false);
      for(let k=0;k<3;k++)box(g,.065,.055,.05,['#d7b379','#b38c77','#c9bea0'][k],-.10+k*.10,.17,d/2+.07,false);
      box(g,.24,.035,.17,'#8d775a',w*.32,.11,d/2+.12,false);
    }
    if(type==='downtown'){
      box(g,w*.75,.045,.14,'#a2b4ad',0,h*.45,d/2+.04,false);
      for(let k=0;k<4;k++)box(g,.018,.14,.02,'#d5cbb3',(-.3+k*.2)*w,h*.45+.08,d/2+.10,false);
    }
    if(type==='harbour'){cylinder(g,.035,.035,.21,'#788d87',w*.32,h+.17,-d*.30);box(g,.14,.035,.14,'#aeae95',w*.32,h+.29,-d*.30,false);}
  }
  function createMetroStreetLife(){
    metro.life=[];metro.deliveries=0;
    for(const district of [1,2,4]){
      const D=METRO_DISTRICTS[district],x=D.x-2.8,z=D.z+2.8;
      cylinder(world,.28,.28,.045,'#af936c',x,.38,z);cylinder(world,.025,.025,.30,'#796851',x,.21,z);
      for(const dx of [-.38,.38]){
        box(world,.15,.025,.15,'#9b8466',x+dx,.23,z,false);
        const p=person({col:dx<0?'#9b8dba':'#c6957b',ph:district,x,y:z});p.scale.setScalar(.50);metro.actorGroup.add(p);sitPose(p,0);p.position.set(x+dx,.21,z);p.rotation.y=dx<0?Math.PI/2:-Math.PI/2;
        const cup=cylinder(p.userData.limbs.hands[1],.024,.024,.04,'#eee5ce',0,-.045,.02);
        metro.life.push({g:p,type:'cafe',district});
      }
      const courier=person({col:'#87a7a0',ph:district+1,x:D.x,y:D.z});courier.scale.setScalar(.50);metro.actorGroup.add(courier);
      const parcel=box(courier.userData.limbs.hands[1],.10,.10,.09,'#b89066',0,-.07,.03,false);
      metro.life.push({g:courier,parcel,type:'delivery',district,x:D.x,z:D.z});
    }
    for(const district of [0,3]){
      const D=METRO_DISTRICTS[district],p=person({col:district===0?'#8ba47b':'#a391af',ph:district,x:D.x,y:D.z});
      p.scale.setScalar(.50);metro.actorGroup.add(p);
      const a={g:p,type:district===0?'gardener':'reader',district,x:D.x-2.8,z:D.z+2.8};
      if(district===0){
        const hand=p.userData.limbs.hands[1];
        cylinder(hand,.07,.06,.10,'#8ea9a2',0,-.07,.04);
        const spout=box(hand,.12,.025,.025,'#8ea9a2',-.09,-.06,.04,false);spout.rotation.z=-.30;
        a.water=box(hand,.012,.15,.012,'#a3ceca',-.16,-.15,.04,false);a.water.rotation.z=-.25;
      }else{
        sitPose(p,0);p.position.set(a.x,.26,a.z+.43);p.rotation.y=Math.PI;
        const book=box(p.userData.limbs.hands[1],.17,.025,.12,'#b89a78',-.05,-.05,.04,false);
        box(book,.15,.008,.105,'#ede2c5',0,.017,0,false);
      }
      metro.life.push(a);
    }
    const crane=new THREE.Group();crane.position.set(30.3,.17,17.5);metro.actorGroup.add(crane);
    box(world,1.3,.12,.90,'#b8aa8d',30.3,.10,17.5,false);
    for(const side of [-1,1])cylinder(world,.055,.065,.75,'#8d7c64',30.3+side*.42,-.25,17.5);
    box(crane,.20,1.4,.20,'#ac9264',0,.70,0,false);
    const boom=new THREE.Group();boom.position.y=1.45;crane.add(boom);
    box(boom,1.55,.09,.10,'#bd9d5f',.44,0,0,false);
    const cable=cylinder(boom,.008,.008,.70,'#5a6663',1.12,-.39,0);
    const load=box(boom,.18,.18,.18,'#ae8f65',1.12,-.81,0,false);
    metro.crane={boom,cable,load};
    const worker=person({col:'#cbab69',ph:8,x:30,y:17});worker.scale.setScalar(.50);metro.actorGroup.add(worker);
    const parcel=box(worker.userData.limbs.hands[1],.12,.10,.10,'#b6966c',0,-.07,.04,false);
    metro.life.push({g:worker,parcel,type:'dock',x:29.65,z:17.5,district:5});
  }
  function updateMetroStreetLife(time){
    metro.deliveries=Math.floor(time/24)*4;
    for(const a of metro.life){
      const L=a.g.userData.limbs;
      if(a.type==='gardener'){
        const phase=time%20,walk=phase<6||phase>=14;
        const u=phase<6?phase/6:phase<14?1:(20-phase)/6;
        a.g.position.set(a.x+.50,.20,a.z-.12+u*.32);a.g.rotation.y=walk?(phase<6?0:Math.PI):-Math.PI/2;
        for(let k=0;k<2;k++)L.legs[k].rotation.x=walk&&!reducedMotion?Math.sin(u*10+k*Math.PI)*.35:0;
        L.arms[1].rotation.x=walk?-.4:-.9;L.elbows[1].rotation.x=-.6;
        a.water.visible=!walk;a.water.scale.y=.8+Math.sin(time*8)*.15;a.action=walk?'walk':'water';
      }else if(a.type==='reader'){
        L.arms[1].rotation.x=-1.0;L.elbows[1].rotation.x=-.9;
        L.arms[0].rotation.x=-.8;L.elbows[0].rotation.x=-.8;
        L.headPivot.rotation.x=.20+Math.sin(time*.35)*.025;a.action='read';
      }else if(a.type==='cafe'){
        L.arms[1].rotation.x=-1.1-Math.max(0,Math.sin(time*.55+a.district))*.35;L.elbows[1].rotation.x=-.6;L.headPivot.rotation.x=Math.sin(time*.45+a.district)*.05;
      }else{
        const t=(time%24)/24,travel=t<.4?t/.4:t<.6?1:(1-t)/.4;
        a.g.position.set(a.x+(a.type==='dock'?.60:-2.8+travel*1.45),.20,a.z+(a.type==='dock'?0:-.65));
        if(a.type==='dock')a.g.position.x=a.x+travel*.65;
        a.g.rotation.y=t<.6?Math.PI/2:-Math.PI/2;a.parcel.visible=t<.5||t>.9;
        for(let k=0;k<2;k++)L.legs[k].rotation.x=t<.4||t>.6?Math.sin(travel*18+k*Math.PI)*.40:0;
        L.arms[1].rotation.x=-.8;L.elbows[1].rotation.x=-.5;
      }
    }
    if(metro.crane){const lift=(Math.sin(time*.45)+1)/2;metro.crane.boom.rotation.y=Math.sin(time*.12)*.35;metro.crane.load.position.y=-.81+lift*.45;metro.crane.cable.scale.y=1-lift*.60;metro.crane.cable.position.y=-.39+lift*.22;}
  }

  function metroBuilding(x,z,h,w,d,index,type){
    const role=metroRole(type,index);
    if(role==='museum')h=Math.min(.95,h*.65);
    if(role==='cafe')h=Math.max(.50,Math.min(.72,h*.65));
    const palettes={town:['#ceaa90','#c7bc9d','#8caaa3'],india:['#cc957b','#dcad8f','#c69d80'],japan:['#dfcfb1','#c2b79f','#b5c3b1'],italy:['#deb78a','#e3c8a0','#d5a797'],netherlands:['#a77761','#b38c71','#c9b599'],usa:['#ac806b','#b4b8ad','#c4a78b']};
    const col=palettes[country][(index+Math.floor(index/4))%3],g=new THREE.Group();g.position.set(x,.16,z);world.add(g);
    g.userData.metroBuilding={district:type,height:h,width:w,depth:d,country};metro.buildings.push(g);
    const signature=metroSignature(g,w,d,h,role,col);
    if(!signature){
      box(g,w,h,d,col,0,h/2,0,false);
      const facade=metroFacade(col,index%3,type==='downtown'?8:type==='campus'||type==='civic'?4:2);
      for(const side of [-1,1]){
        const f=object(g,geo('plane',1,1),facade,0,h/2,side*(d/2+.005),false);f.scale.set(w,h,1);if(side<0)f.rotation.y=Math.PI;
        const s=object(g,geo('plane',1,1),facade,side*(w/2+.005),h/2,0,false);s.scale.set(d,h,1);s.rotation.y=side*Math.PI/2;
      }
      box(g,w+.08,.075,d+.08,'#e1d5bd',0,h+.035,0,false);
      const pitched=!(type==='campus'&&index%3===2)&&type!=='downtown'&&type!=='harbour'&&country!=='india'&&(index%3!==0||country==='japan');
      if(pitched){const r=new THREE.Group();g.add(r);r.position.y=h+.065;r.scale.set(w*.92,.45,d*.92);roof(r,country==='italy'?'#b6724e':country==='japan'?'#525e60':'#7e8175',0);}
      else{box(g,w*.53,.16,d*.52,'#7b8c88',0,h+.12,-d*.09,false);if(type==='downtown')box(g,w*.30,.25,d*.29,'#9cb3b3',0,h+.30,0,false);}
      if(country==='netherlands'&&type!=='downtown')for(let i=0;i<3;i++)box(g,w*(1-i*.25),.09,.06,'#e3d7bd',0,h+.10+i*.09,d/2+.02,false);
      if(type==='market'){
        for(let k=0;k<4;k++)box(g,w/4,.04,.27,k%2?'#efe0bb':['#759a8b','#ac7e68','#9298ae'][index%3],-w*.375+k*w/4,.43,d/2+.10,false);
      }
    }
    metroIdentity(g,w,d,h,index,type);
    if(!signature)metroFacadeDetails(g,w,d,h,index,type);
    if(type==='harbour'&&index%2===0){
      for(let k=0;k<3;k++){const light=box(g,w*.65,.035,.12,'#9db7b1',0,h+.22,(k-1)*d*.22,false);light.rotation.x=-.16;}
    }else if(type==='garden'&&index%2===1){
      box(g,.12,.27,.14,'#a68c75',w*.25,h+.23,-d*.22,false);
    }else if(type==='downtown'&&index%2===0){
      box(g,w*.72,.04,d*.30,'#668f8c',0,h+.47,0,false);
      for(let k=0;k<3;k++)box(g,.012,.012,d*.30,'#b5c6ba',(-.24+k*.24)*w,h+.495,0,false);
    }

    if(role==='library'){
      for(const side of [-1,1])rainRoofs.push({x:x+side*w*.36,z,rx:w*.15,rz:d/2+.03,top:.16+h*.58+.03});
      rainRoofs.push({x,z:z-d*.05,rx:w*.25,rz:d*.47,top:.16+h+.055});
    }else if(role==='museum'){
      rainRoofs.push({x,z,rx:w/2,rz:d/2,top:.16+h*.78});
      rainRoofs.push({x,z:z-d*.08,rx:w*.28,rz:d*.38,top:.16+h+.035});
      rainRoofs.push({x,z:z+d/2+.045,rx:w*.51,rz:.12,top:.16+h*.73+.03});
    }else rainRoofs.push({x,z,rx:w/2+.06,rz:d/2+.06,top:.16+h+(type==='campus'||type==='civic'?.60:type==='downtown'?.55:.40)});
  }
  function metroLink(ax,az,bx,bz,raised=false){
    const g=new THREE.Group();world.add(g);const length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az);
    const height=t=>.174+(raised?Math.sin(Math.PI*t)**2*1.45:0);
    for(let i=0;i<24;i++){
      const t=(i+.5)/24,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
      const q=box(g,raised?.92:1.50,.075,length/24+.012,'#a7a99d',x,height(t)-.0375,z,false);const slope=(height(Math.min(1,t+.001))-height(Math.max(0,t-.001)))/(length*.002);
      q.rotation.order='YXZ';q.rotation.y=angle;q.rotation.x=-Math.atan(slope);q.scale.z=Math.sqrt(1+slope*slope);
      for(const side of [-1,1]){
        const rx=x+Math.cos(angle)*side*(raised?.49:.80),rz=z-Math.sin(angle)*side*(raised?.49:.80);
        const rail=box(g,.025,.04,length/24+.02,'#e2d6bb',rx,height(t)+.13,rz,false);rail.rotation.order='YXZ';rail.rotation.y=angle;rail.rotation.x=-Math.atan(slope);rail.scale.z=Math.sqrt(1+slope*slope);
      }
    }
    if(raised){
      const p=person({col:'#a88caa',ph:1,x:ax,y:az});p.scale.setScalar(.48);metro.actorGroup.add(p);
      metro.bridges.push({g:p,ax,az,bx,bz,height,length});
    }
  }
  // A shared two-way street spine follows the actual centre roads and links.
  // Arc-length sampling keeps lane distance continuous through rounded turns.
  function transitPath(lane){
    const raw=[[-7,17.2],[-7,14],[-7,3],[-7,-1.12],[-1.12,-7],[3,-7],[14,-7],[18.12,-7],[25,-1.12],[25,3],[25,14],[25,17.2]],centre=[];
    const add=(x,z)=>centre.push({x,z});add(...raw[0]);
    for(let i=1;i<raw.length-1;i++){
      const a=raw[i-1],b=raw[i],c=raw[i+1],la=Math.hypot(b[0]-a[0],b[1]-a[1]),lb=Math.hypot(c[0]-b[0],c[1]-b[1]),cut=Math.min(.6,la*.25,lb*.25);
      const p=[b[0]-(b[0]-a[0])/la*cut,b[1]-(b[1]-a[1])/la*cut],q=[b[0]+(c[0]-b[0])/lb*cut,b[1]+(c[1]-b[1])/lb*cut];
      add(...p);for(let k=1;k<=8;k++){const t=k/8,u=1-t;add(u*u*p[0]+2*u*t*b[0]+t*t*q[0],u*u*p[1]+2*u*t*b[1]+t*t*q[1]);}
    }
    add(...raw[raw.length-1]);
    const left=[],right=[];
    for(let i=0;i<centre.length;i++){
      const a=centre[Math.max(0,i-1)],b=centre[Math.min(centre.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z),nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;
      left.push({x:centre[i].x+nx*lane,z:centre[i].z+nz*lane});right.push({x:centre[i].x-nx*lane,z:centre[i].z-nz*lane});
    }
    const points=left.slice(),end=centre[centre.length-1],prev=centre[centre.length-2],len=Math.hypot(end.x-prev.x,end.z-prev.z),tx=(end.x-prev.x)/len,tz=(end.z-prev.z)/len;
    for(let k=1;k<=12;k++){const a=k*Math.PI/12;points.push({x:end.x-tz*lane*Math.cos(a)+tx*lane*Math.sin(a),z:end.z+tx*lane*Math.cos(a)+tz*lane*Math.sin(a)});}
    points.push(...right.slice(0,-1).reverse());
    const start=centre[0],next=centre[1],sl=Math.hypot(next.x-start.x,next.z-start.z),sx=(next.x-start.x)/sl,sz=(next.z-start.z)/sl;
    for(let k=1;k<=12;k++){const a=k*Math.PI/12;points.push({x:start.x+sz*lane*Math.cos(a)-sx*lane*Math.sin(a),z:start.z-sx*lane*Math.cos(a)-sz*lane*Math.sin(a)});}
    points.push(points[0]);const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
    return {points,lengths,length:lengths[lengths.length-1],forwardCount:left.length};
  }
  function transitPoint(path,distance){
    const s=((distance%path.length)+path.length)%path.length;let lo=0,hi=path.lengths.length-1;
    while(hi-lo>1){const m=(lo+hi)>>1;if(path.lengths[m]<=s)lo=m;else hi=m;}
    const a=path.points[lo],b=path.points[hi],t=(s-path.lengths[lo])/(path.lengths[hi]-path.lengths[lo]||1);
    return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,angle:-Math.atan2(b.z-a.z,b.x-a.x)};
  }
  function initTransit(){
    metro.road=transitPath(.23);metro.foot=transitPath(.65);metro.arrivals=0;metro.boardings=0;metro.alightings=0;metro.simTime=0;
    metro.stops=METRO_DISTRICTS.map((D,district)=>{
      let nearest=0,best=Infinity;for(let i=0;i<metro.road.forwardCount;i++){const p=metro.road.points[i],q=Math.hypot(D.x-p.x,D.z-p.z);if(q<best){best=q;nearest=i;}}
      const p=transitPoint(metro.road,metro.road.lengths[nearest]),dx=Math.cos(-p.angle),dz=Math.sin(-p.angle);
      return {district,s:metro.road.lengths[nearest],x:D.x-dz*.67,z:D.z+dx*.67,nx:-dz,nz:dx,dx,dz};
    }).sort((a,b)=>a.s-b.s);
    metro.vehicles.forEach((v,i)=>{v.s=i*metro.road.length/metro.vehicles.length;v.wait=0;v.arrivals=0;v.passengers=[];v.next=metro.stops.findIndex(s=>s.s>v.s);if(v.next<0)v.next=0;v.bus=i%4===0;});
    metro.commuters=metro.walkers.filter((_,i)=>i%3===0);
    metro.commuters.forEach((v,i)=>{v.stop=metro.stops.findIndex(s=>s.district===i);v.state='waiting';v.until=0;v.bus=null;});
    for(const stop of metro.stops){
      const g=new THREE.Group();g.position.set(stop.x,.18,stop.z);g.rotation.y=Math.atan2(stop.dx,stop.dz);world.add(g);
      box(g,.30,.025,.70,'#d8cfb8',0,0,0,false);
      for(const z of [-.27,.27])box(g,.025,.38,.025,'#6c8680',-.10,.20,z,false);
      box(g,.40,.035,.76,'#739b93',0,.41,0,false);
      box(g,.16,.025,.43,'#a38563',.02,.17,0,false);
      sign(g,'BUS',.0,.37,.35,.20);
    }
    for(const end of [[-7,17.2],[25,17.2]])cylinder(world,.65,.65,.022,'#919c98',end[0],.168,end[1]);
  }
  function resetTransit(){
    metro.simTime=0;metro.arrivals=0;metro.boardings=0;metro.alightings=0;
    metro.vehicles.forEach((v,i)=>{v.s=i*metro.road.length/metro.vehicles.length;v.wait=0;v.arrivals=0;v.passengers=[];v.next=metro.stops.findIndex(s=>s.s>v.s);if(v.next<0)v.next=0;});
    metro.commuters.forEach((v,i)=>{v.stop=metro.stops.findIndex(s=>s.district===i);v.state='waiting';v.until=0;v.bus=null;});
  }
  function advanceTransit(time){
    if(time<metro.simTime)resetTransit();
    while(metro.simTime<time-1e-8){
      const dt=Math.min(.1,time-metro.simTime),positions=metro.vehicles.map(v=>v.s);metro.simTime+=dt;
      for(let i=0;i<metro.vehicles.length;i++){
        const v=metro.vehicles[i];v.wait=Math.max(0,v.wait-dt);if(v.wait>0)continue;
        const gap=(positions[(i+1)%positions.length]-positions[i]+metro.road.length)%metro.road.length;
        let step=Math.min((v.bus?.49:.58)*dt,Math.max(0,gap-3.2));
        const stop=metro.stops[v.next],distance=(stop.s-v.s+metro.road.length)%metro.road.length;
        if(distance<=step+1e-7){
          step=distance;v.arrivals++;metro.arrivals++;v.current=stop.district;v.next=(v.next+1)%metro.stops.length;
          if(v.bus){
            v.wait=4;
            for(const p of v.passengers){p.state='alighting';p.stop=metro.stops.indexOf(stop);p.until=metro.simTime+2;p.bus=null;metro.alightings++;}
            v.passengers=[];
            const p=metro.commuters.find(p=>p.stop===metro.stops.indexOf(stop)&&p.state==='waiting');
            if(p){p.state='boarding';p.until=metro.simTime+1.4;p.bus=i;v.passengers.push(p);metro.boardings++;}
          }
        }
        v.s=(v.s+step)%metro.road.length;
      }
      for(const p of metro.commuters){
        if(p.state==='boarding'&&metro.simTime>=p.until)p.state='aboard';
        if(p.state==='alighting'&&metro.simTime>=p.until){p.state='strolling';p.until=metro.simTime+12;}
        if(p.state==='strolling'&&metro.simTime>=p.until)p.state='waiting';
      }
    }
    for(const v of metro.vehicles){const p=transitPoint(metro.road,v.s);v.g.position.set(p.x,.192,p.z);v.g.rotation.y=p.angle;const rig=v.g.userData.vehicleRig;if(rig)for(const w of rig.wheels)w.rotation.z=-v.s*15;}
    for(const p of metro.commuters){
      const stop=metro.stops[p.stop];p.g.visible=p.state!=='aboard';
      const queue=metro.commuters.filter(q=>q.stop===p.stop&&q.state==='waiting').indexOf(p);
      const boarding=p.state==='boarding'?1-Math.max(0,p.until-metro.simTime)/1.4:0;
      const stroll=p.state==='strolling'?Math.sin((12-(p.until-metro.simTime))/12*Math.PI)*1.05:0;
      p.g.position.set(stop.x-stop.nx*boarding*.32+stop.dx*(stroll+Math.max(0,queue)*.22),.20,stop.z-stop.nz*boarding*.32+stop.dz*(stroll+Math.max(0,queue)*.22));p.g.rotation.y=Math.atan2(-stop.nx,-stop.nz);
      const L=p.g.userData.limbs;for(let k=0;k<2;k++)L.legs[k].rotation.x=(boarding||stroll)&&!reducedMotion?Math.sin(metro.simTime*4+k*Math.PI)*.4:0;
    }
  }

  function createMetropolis(){
    metro.buildings=[];metro.vehicles=[];metro.walkers=[];metro.bridges=[];metro.actorGroup=new THREE.Group();metro.actorGroup.userData.noBatch=true;world.add(metro.actorGroup);
    for(let district=0;district<METRO_DISTRICTS.length;district++){
      const D=METRO_DISTRICTS[district],x=D.x,z=D.z;
      const slab=box(world,10,.50,10,'#a38e75',x,-.15,z,false);slab.userData.metroDistrict=D.name;
      box(world,9.92,.065,9.92,D.type==='garden'?'#adc097':'#b5b99d',x,.13,z,false);
      const road=(w,d,rx,rz)=>box(world,w,.035,d,'#919c98',rx,.157,rz,false);
      for(const side of [-1,1]){road(.82,9.0,x+side*4.12,z);road(9.0,.82,x,z+side*4.12);}
      road(.86,8.2,x,z);road(8.2,.86,x,z);
      for(const side of [-1,1]){box(world,.23,.025,8.2,'#d4ccb8',x+side*.65,.17,z,false);box(world,8.2,.025,.23,'#d4ccb8',x,.17,z+side*.65,false);}
      for(let a=0;a<4;a++)for(let b=0;b<4;b++){
        const dx=[-2.8,-1.35,1.35,2.8][a],dz=[-2.8,-1.35,1.35,2.8][b],i=district*16+a*4+b;
        if(a===0&&b===3){metroPocket(D);continue;}
        const h=D.type==='downtown'?1.9+((a*7+b*3)%7)*.47:D.type==='campus'?1.15+(i%3)*.24:D.type==='civic'?1.25+(i%4)*.31:D.type==='harbour'?.65+(i%3)*.20:.70+(i%4)*.18;
        const baseSize=D.type==='downtown'?1.10:D.type==='campus'?1.16:1.02;
        const size=baseSize-[0,.16,.06,.23][(a+b*3)%4],depth=baseSize-[.12,0,.19,.06][(a*3+b)%4];
        const height=h*(.82+((a*3+b*5)%4)*.085);
        box(world,size+.17,.045,depth+.17,'#cfc8b3',x+dx,.17,z+dz,false);
        metroBuilding(x+dx,z+dz,height,size,depth,i,D.type);
      }
      // A continuous inner pavement keeps walkers clear of traffic and plots.
      for(const side of [-1,1]){box(world,.24,.025,7.36,'#d4ccb8',x+side*3.56,.17,z,false);box(world,7.36,.025,.24,'#d4ccb8',x,.17,z+side*3.56,false);}
      const districtPlaque=metroPlaque(world,D.name.toUpperCase(),x,.34,z+4.70,1.55);
      box(world,1.12,.12,.10,'#aa987b',x,.22,z+4.69,false);
      // These vehicles join the shared interdistrict street spine below.
      for(let i=0;i<4;i++){
        const g=car({kind:i===0?'bus':'car',col:['#d4bd83','#80a5af','#b88e7f','#a7b5a4'][i],ph:i});metro.actorGroup.add(g);
        metro.vehicles.push({g,x,z,offset:i*8.24,district});
      }
      for(let i=0;i<3;i++){
        const g=person({col:['#bb9687','#82a6a1','#b0a1bb'][i],ph:district*3+i,x,y:z});g.scale.setScalar(.50);metro.actorGroup.add(g);
        metro.walkers.push({g,x,z,offset:i*10.1,district});
      }
    }
    // Link the outer quarters to each other and the old island. Core links
    // arch over its railway; the existing traffic simulation is undisturbed.
    metroLink(-7,7.12,-7,9.88);metroLink(7.12,-7,9.88,-7);metroLink(25,7.12,25,9.88);
    metroLink(-7,-1.12,-1.12,-7);metroLink(18.12,-7,25,-1.12);
    metroLink(-3,6.5,1.5,6.5,true);metroLink(6.5,-3,6.5,1.5,true);metroLink(16.5,6.5,21,6.5,true);
    initTransit();createMetroStreetLife();
    // Harbour piers and moored craft give the eastern district a shoreline.
    for(let i=0;i<3;i++){
      box(world,1.9,.10,.18,'#ac9572',30.65,.09,11.5+i*2.0,false);
      const hull=box(world,.70,.18,.27,['#a97d66','#e1c893','#86a9a7'][i],30.8,SEA_Y+.04,12+i*2,false);hull.userData.metroBoat=true;
      box(world,.26,.19,.20,'#e8e0c9',30.75,SEA_Y+.20,12+i*2,false);
    }
  }
  function metroLoop(distance,r){
    const corner=.45,line=2*(r-corner),arc=corner*Math.PI/2,quarter=line+arc;
    const s=((distance%(quarter*4))+quarter*4)%(quarter*4),k=Math.floor(s/quarter),u=s-k*quarter;
    let x,z,angle;
    if(u<line){x=-r+corner+u;z=-r;angle=0;}
    else{const theta=-Math.PI/2+(u-line)/corner;x=r-corner+corner*Math.cos(theta);z=-r+corner+corner*Math.sin(theta);angle=-Math.atan2(Math.cos(theta),-Math.sin(theta));}
    const c=Math.cos(k*Math.PI/2),q=Math.sin(k*Math.PI/2);return {x:x*c-z*q,z:x*q+z*c,angle:angle-k*Math.PI/2};
  }
  function updateMetropolis(time){
    metro.time=time;
    advanceTransit(time);updateMetroStreetLife(time);
    for(const v of metro.walkers){if(metro.commuters.includes(v))continue;if(metro.walkers.indexOf(v)%3===2){const p=transitPoint(metro.foot,time*.19+v.offset*4+v.district*metro.foot.length/6);v.g.position.set(p.x,.20,p.z);v.g.rotation.y=p.angle+Math.PI/2;const L=v.g.userData.limbs;for(let k=0;k<2;k++)L.legs[k].rotation.x=reducedMotion?0:Math.sin(time*3+k*Math.PI)*.4;continue;}const t=(time+v.offset)%54;const distance=(Math.floor((time+v.offset)/54)*45+Math.min(t,45))*.21+v.offset,p=metroLoop(distance,3.56);v.g.position.set(v.x+p.x,.20,v.z+p.z);v.g.rotation.y=p.angle+Math.PI/2;const L=v.g.userData.limbs;for(let i=0;i<2;i++)L.legs[i].rotation.x=t<45&&!reducedMotion?Math.sin(distance*16+i*Math.PI)*.45:0;}
    for(const v of metro.bridges){const t=(Math.sin(time*.07)+1)/2;for(let k=0;k<2;k++)v.g.userData.limbs.legs[k].rotation.x=reducedMotion?0:Math.sin(t*v.length*14+k*Math.PI)*.45;v.g.position.set(v.ax+(v.bx-v.ax)*t,v.height(t)+.035,v.az+(v.bz-v.az)*t);v.g.rotation.y=Math.atan2(v.bx-v.ax,v.bz-v.az)+(Math.cos(time*.07)<0?Math.PI:0);}
  }

  function rebuild(){
    site.built=false;site.workers=[];timeVisit=null;round=null;papers=[];effects=[];porchLamps.length=0;precip=null;dusting=null;weatherKind='';
    ambient.length = 0; plazaLights.length = 0; festoonBulbs.length = 0;rainRoofs.length=0;rainSplashes=[];
    windowMaterials.clear();
    countryBuildings=0;countryPlace=null;countryLot=country==='town'?null:town.buildings().filter(b=>b.hero&&b.kind==='house').sort((a,b)=>b.y-a.y||b.x-a.x)[0];
    gardenElements = 0; woodlandShapes = 0; terrainContours = 0; composedBuildings = 0; districtGardenRooms = 0; landmarkCount = 0;
    while(world.children.length)world.remove(world.children[0]);
    for(const [ref,obj] of actors){obj.group.parent?.remove(obj.group);}
    actors.clear();
    createGround();
    createLandscapeComposition();
    for(const b of town.buildings()){
      // All structures share the same ground-contact light: five bespoke
      // landmarks should not seem pasted onto brighter pavement than houses.
      if(b.kind!=='site')groundingShadow(b.x+.5,b.y+.5,1.48,1.44,b.hero?.235:.166);
      // The five central landmarks are *entire independent models*.
      // Avoid drawing the generic body, roof, porch or old atelier overlays
      // behind them; an authored asset replaces that complete building.
      if(country!=='town'&&countryBuilding(b)){if(b.hero)landmarkCount++;continue;}
      if(b.hero&&kitLandmark(b)){landmarkCount++;continue;}
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
      if(kitBuilding(b))continue;
      if(b.kind==='house')composeSecondaryBuilding(b,home(b));
      else if(b.kind==='shop')composeSecondaryBuilding(b,shop(b));
      else if(b.kind==='tower')tower(b);
      else if(b.kind==='fire')fireStation(b);
      else if(b.kind==='site')buildingSite(b);
    }
    const ps=town.props();
    for(let i=0;i<ps.length;i++)smallProps(ps[i],i);
    streetLanterns();
    seaAndLighthouse();   // (the open-air cinema screen that stood here is retired)
    createSignals();
    nightSky();
    createStorybookVillage();
    paintVillageLife();
    createWorkingShops();
    createMetropolis();
    for(const v of [...metro.vehicles,...metro.walkers,...metro.bridges])v.g.userData.noBatch=true;
    batchStatic(world.children.length);
    rail.train=null;life.built=false;more.built=false;live2.built=false;bus3.built=false;news7.built=false;sky4.built=false;fest.built=false;fest.ev=null;leavingPrecip.length=0;createRailway();createFarm();createLife();createMore();createStage2();createStage3();createNewsroom();createStage4();createStage5();
    // Landmark panes are pooled across the five models. Update material
    // intensity only, not every individual window mesh, on each frame.
    const visit=node=>{
      if(node.material?.userData?.miniatureWindow)
        windowMaterials.add(node.material);
      for(const child of node.children||[])visit(child);
    };
    visit(world);
    worldSeed=town.debug().seed;worldBuildings=town.buildings();
    worldPropCount=ps.length;notes6.g=null;notes6.pool=[];
    redrawCount++;
  }
  // Smooth, chunky residents in the KayKit spirit: a rounded body, a big soft
  // head with dot eyes and rosy cheeks, a proper hair cap, rounded limbs and
  // shoes. The joint chain (legs → shins → ankles, arms → elbows → wrists,
  // headPivot, upperBody) is unchanged, so every walk, wave and shop action
  // still drives it.
  const smoothBall=(p,r,col,x=0,y=0,z=0)=>object(p,geo('smooth',r),typeof col==='string'?mat(col,.7):col,x,y,z);
  const limb=(p,r,len,col,x=0,y=0,z=0)=>THREE.CapsuleGeometry?
    object(p,geo('capsule',r,len),typeof col==='string'?mat(col,.72):col,x,y,z):cylinder(p,r,r,len+r*2,col,x,y,z);
  const CUTE=.6,HEAD_BIG=.90;
  const SHOP_BAG_COLOURS=['#e9c46a','#e76f51','#8ab17d','#6fa8dc','#d4a5c9','#f4a261'];
  // Shared transparent expression plates replace many tiny facial draw calls.
  // Nose, head, hair and joint rig remain physical; controls choose atlas frames.
  const faceFrames=new Map();
  function faceFrame(expression='neutral',direction=0){
    const key=expression+':'+direction;if(faceFrames.has(key))return faceFrames.get(key);
    const cv=document.createElement('canvas');cv.width=128;cv.height=96;const c=cv.getContext('2d');
    c.clearRect(0,0,128,96);
    c.fillStyle='rgba(208,141,130,.28)';for(const x of [14,114]){c.beginPath();c.ellipse(x,74,9,5,0,0,TAU);c.fill();}
    for(const [x,side] of [[35,-1],[93,1]]){
      if(expression==='blink'){
        c.strokeStyle='#49443c';c.lineWidth=3;c.beginPath();c.moveTo(x-8,44);c.bezierCurveTo(x-3,48,x+3,48,x+8,44);c.stroke();
      }else{
        c.fillStyle='#eee8dc';c.beginPath();c.ellipse(x,44,10,13,0,0,TAU);c.fill();
        c.fillStyle='#34342f';c.beginPath();c.ellipse(x+direction*2,expression==='read'?47:44,6.4,9,0,0,TAU);c.fill();
        c.fillStyle='#fff9eb';c.beginPath();c.ellipse(x+direction*2-2,40,1.5,2,0,0,TAU);c.fill();
      }
      const raised=expression==='happy'?4:expression==='listen'&&side<0?5:0;
      c.strokeStyle='#5d4b3d';c.lineWidth=2.5;c.beginPath();c.moveTo(x-10,19-raised);c.bezierCurveTo(x-3,15-raised,x+3,15-raised,x+10,18-raised);c.stroke();
    }
    c.strokeStyle='#8f5a56';c.lineWidth=2.5;
    if(expression==='talk'||expression==='happy'||expression==='eat'){
      c.fillStyle='#825951';c.beginPath();c.ellipse(64,84,expression==='happy'?10:7,expression==='talk'?7:4,0,0,TAU);c.fill();
      c.fillStyle='#d5a09a';c.beginPath();c.ellipse(64,87,4,1.5,0,0,TAU);c.fill();
    }else{c.beginPath();c.moveTo(53,81);c.bezierCurveTo(59,89,69,89,75,81);c.stroke();}
    const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;tx.userData={expression,direction};
    const m=new THREE.MeshStandardMaterial({map:tx,transparent:true,alphaTest:.04,depthWrite:false,roughness:.9});
    m.userData={faceExpression:expression,direction};faceFrames.set(key,m);return m;
  }
  function person(ref){
    const g=new THREE.Group();
    const skin=ref.skin||'#dbab86',coat=ref.col||'#d6a3a0',trousers=ref.trousers||'#5e6f7c',sport=ref.kind==='runner',shoes=sport?'#f4f4f4':'#4f4741';
    // One rounded body, slightly pear-shaped, with a soft collar.
    const torso=object(g,geo('soft',.178,.19,.115,.035),mat(coat,.88),0,.272,0);
    torso.userData.humanShirt=true;
    // Shoulders and a tapered waist change the silhouette, not just its colour.
    torso.scale.set(1.02,.98,.92);
    const hem=box(g,.147,.040,.104,coat,0,.190,0);hem.userData.humanWaist=true;
    box(g,.142,.037,.095,trousers,0,.173,0);
    box(g,.009,.13,.008,tint(coat,'#ffffff',.2),0,.27,.060,false);
    const collar=smoothBall(g,.036,tint(coat,'#ffffff',.2),0,.365,.008);collar.scale.set(1.4,.28,1.05);
    const neck=cylinder(g,.03,.032,.04,skin,0,.37,0);
    const headPivot=new THREE.Group();headPivot.position.y=.405;g.add(headPivot);
    const face=new THREE.Group();face.position.y=-.405;headPivot.add(face);
    const head=smoothBall(face,.09,skin,0,.462,0);head.scale.set(.97,1.04,.94);
    g.userData.referenceHuman={headRadius:.09,shoulderWidth:.192};
    for(const side of [-1,1]){const ear=smoothBall(face,.017,skin,side*.087,.455,-.002);ear.scale.set(.58,1,.72);}
    const HAIRS=['#2b2a33','#49362d','#6b4a32','#8a6a3f','#c29a52','#d9b46a','#8c3b2a','#a5a5aa','#3a3040'];
    const hairTone=ref.kind||ref.hat==='beanie'?(ref.hair||'#5b4639'):HAIRS[Math.abs(Math.floor((ref.ph||0)*13+(ref.x||0)*5))%HAIRS.length];
    // A hair cap that wraps the crown and the back of the head; three styles.
    const hairStyle=(Math.round((ref.x||0)*11+(ref.y||0)*7))%3;
    if(!ref.hat){
      const capHair=object(face,geo('hairshell',.095),mat(hairTone,.8),0,.468,-.01);
      capHair.rotation.x=-.32;
      if(hairStyle===0){const bob=smoothBall(face,.066,hairTone,0,.43,-.055);bob.scale.set(1.45,1.05,.9);}       // a bob
      else if(hairStyle===1){const bun=smoothBall(face,.036,hairTone,0,.555,-.045);}                               // a bun
      else{const fringe=smoothBall(face,.052,hairTone,.02,.519,.045);fringe.scale.set(1.35,.42,.7);}               // a side fringe
    }
    // Lightweight joint controls keep eyelids, gaze and mouth state explicit.
    // A shared expression plate renders them together in one draw call.
    const eyelids=[];
    for(const sx of [-1,1]){
      const eye=new THREE.Group();eye.position.set(sx*.029,.468,.082);
      eye.userData.pupil=new THREE.Group();eyelids.push(eye);
    }
    smoothBall(face,.011,tint(skin,'#c98d6f',.16),0,.450,.087);
    const smile=new THREE.Group();smile.scale.set(1,.42,.3);
    const mouth=new THREE.Group();mouth.visible=false;
    const brows=[new THREE.Group(),new THREE.Group()];
    const faceSurface=object(face,geo('plane',.13,.09),faceFrame(),0,.464,.086,false);
    faceSurface.userData.faceSurface=true;
    const legs=[],arms=[],elbows=[],wrists=[],hands=[],shins=[],feet=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*.04,.178,0);
      limb(leg,.029,.045,trousers,0,-.045,0);
      const shin=new THREE.Group();shin.position.set(0,-.096,0);
      limb(shin,.025,.04,sport?skin:trousers,0,-.038,0);   // runners wear shorts: bare shins
      const ankle=new THREE.Group();ankle.position.set(0,-.1,.024);
      const shoe=smoothBall(ankle,.036,shoes,0,0,.01);shoe.scale.set(.95,.62,1.45);
      if(sport){const sock=cylinder(ankle,.026,.028,.035,'#ffffff',0,.03,-.01);sock.castShadow=false;}
      shin.add(ankle);
      leg.add(shin);g.add(leg);legs.push(leg);shins.push(shin);
      feet.push(ankle);
      const arm=new THREE.Group();arm.position.set(side*.096,.322,0);
      limb(arm,.025,.04,coat,0,-.041,0);
      const elbow=new THREE.Group();elbow.position.y=-.084;
      limb(elbow,.022,.036,coat,0,-.038,0);
      const wrist=new THREE.Group();wrist.position.y=-.079;
      const palm=box(wrist,.034,.034,.021,skin,0,-.014,.003);
      palm.userData.handPalm=true;
      // Three scalloped fingertips share one cached mesh per hand.
      let fingerGeo=geometryCache.get('hand:fingers');
      if(!fingerGeo){
        const sh=new THREE.Shape();sh.moveTo(-.016,0);sh.lineTo(-.016,-.015);
        for(let f=0;f<3;f++){const x=-.016+f*.0107;sh.quadraticCurveTo(x+.0053,-.030,x+.0107,-.015);}
        sh.lineTo(.016,0);sh.closePath();
        fingerGeo=new THREE.ExtrudeGeometry(sh,{depth:.010,bevelEnabled:true,bevelSize:.0015,bevelThickness:.0015,bevelSegments:1,steps:1});
        fingerGeo.translate(0,0,-.005);geometryCache.set('hand:fingers',fingerGeo);
      }
      const finger=new THREE.Group();finger.position.set(0,-.027,.003);wrist.add(finger);
      object(finger,fingerGeo,mat(skin,.7),0,0,0,false);
      const fingers=[finger];
      const thumb=new THREE.Group();thumb.position.set(-side*.021,-.010,.004);wrist.add(thumb);
      const tip=box(thumb,.012,.023,.013,skin,0,-.006,.002);tip.rotation.z=-side*.42;tip.castShadow=false;
      wrist.userData.handRig={fingers,thumb,digits:3,curl:0};
      elbow.add(wrist);arm.add(elbow);g.add(arm);
      arms.push(arm);elbows.push(elbow);wrists.push(wrist);hands.push(wrist);
    }
    if(sport){   // running kit: a bib with a stripe on the chest and back, a sweatband and wristbands
      const bibCol=tint(coat,'#ffffff',.78);
      box(g,.1,.095,.012,'#ffffff',0,.27,.088,false);box(g,.1,.022,.014,'#d0343a',0,.292,.089,false);box(g,.04,.03,.014,'#2b2f36',0,.255,.09,false);
      box(g,.1,.095,.012,'#ffffff',0,.27,-.088,false);
      const band=object(face,geo('torus',.099,.012),mat(coat===('#ffffff')?'#d0343a':tint(coat,'#ffffff',.2),.8),0,.505,0);band.rotation.x=Math.PI/2;band.scale.z=1.3;
      for(const w of wrists)cylinder(w,.027,.027,.022,'#ffffff',0,-.0,0).castShadow=false;
    }
    if(ref.backpack){const pack=box(g,.13,.15,.07,ref.backpack,0,.27,-.085);pack.castShadow=false;box(g,.1,.04,.02,tint(ref.backpack,'#ffffff',.3),0,.23,-.122,false);}
    if(ref.briefcase){const brief=new THREE.Group();brief.position.set(0,-.08,0);hands[0].add(brief);box(brief,.13,.095,.04,'#5b4636',0,-.03,0);
      const handle=object(brief,geo('torus',.022,.006),mat('#3d2f25'),0,.025,0);handle.scale.set(1,.8,.5);}
    if(!ref.kind&&!ref.shopRole&&!ref.heroResident&&!ref.routine){
      // A paper shopping bag in the right hand: only drawn once the resident has been to a shop (ref.shopBag = colour index).
      const sb=box(hands[1],.085,.115,.055,'#e9c46a',0,-.075,0);sb.visible=false;sb.castShadow=false;g.userData.shopBag=sb;
    }
    if(ref.bag&&ref.kind!=='farmer'&&ref.kind!=='keeper'){
      // This handbag is actually gripped and follows the left wrist.
      const bag=new THREE.Group();bag.position.set(-.003,-.072,-.023);
      hands[0].add(bag);bag.userData.carriedProp='handbag';
      box(bag,.105,.105,.063,'#ae8966',0,0,0);
      const handle=object(bag,geo('torus',.032,.007),mat('#806548'),0,.052,0);
      handle.scale.set(1,1,.42);
    }
    if(ref.hat){
      const cap=object(g,geo('hairshell',.098),mat(ref.hat==='beanie'?'#b18cbd':'#588f9e',.8),0,.48,0);
      if(ref.hat==='beanie')smoothBall(g,.028,'#efe6f4',0,.565,0);
      else{const brim=object(g,geo('cylinder',.075,.075,.012),mat('#588f9e',.8),0,.5,.075);brim.scale.z=.7;}
    }
    // Specific silhouettes communicate a role before the visitor even moves.
    // No billboard labels: their tools and clothing are physical geometry.
    if(ref.kind==='chef'){
      cylinder(g,.075,.078,.088,'#fff5e9',0,.568,0);
      const puff=ball(g,.096,'#fff9f1',0,.620,0);puff.scale.set(1,.56,1);
      box(g,.13,.13,.026,'#fff2e4',0,.269,.078);
    }else if(ref.kind==='sweeper'){
      // The broom stays gripped as the arm arcs, not nailed to world space.
      const shaft=cylinder(hands[1],.010,.012,.29,'#947455',0,-.160,.018);
      shaft.rotation.z=-.09;
      box(hands[1],.135,.055,.048,'#b5a182',.018,-.304,.018);
      box(g,.17,.021,.04,'#5e786d',0,.23,.078);
    }else if(ref.kind==='farmer'||ref.kind==='keeper'){
      const brim=cylinder(g,.115,.115,.025,'#c7b38b',0,.555,0);
      cylinder(g,.080,.085,.095,'#ab906d',0,.600,0);
      const basket=box(hands[0],.13,.095,.11,'#b6956b',0,-.068,.011);
      basket.castShadow=false;
      basket.userData.carriedProp='basket';
      const handle=object(hands[0],geo('torus',.052,.008),
        mat('#a17d4d'),0,-.024,.011);
      handle.scale.z=.58;
    }else if(ref.kind==='robot'){
      const visor=box(face,.1,.034,.014,'#7faeb5',0,.462,.1);
      box(g,.135,.021,.034,'#627c87',0,.305,.090);
      cylinder(face,.012,.012,.077,'#aebec1',0,.580,0);
      const beacon=ball(face,.029,'#f1ca8c',0,.631,0);beacon.castShadow=false;
    }else if(ref.kind==='newsie'){
      const satchel=box(g,.092,.130,.078,'#a88367',-.129,.228,.057);
      box(g,.103,.022,.031,'#f9e8d0',-.129,.285,.099);
    }else if(ref.kind==='busker'){
      // Physical body and a narrow neck: a musician holds an instrument,
      // rather than swaying empty-handed to an invisible soundtrack.
      const guitar=new THREE.Group();g.add(guitar);
      ball(guitar,.12,'#b4774f',0,.250,.114).scale.set(1.0,1.2,.46);
      ball(guitar,.071,'#d7a16b',-.020,.330,.117).scale.set(1,.94,.53);
      const neck=cylinder(guitar,.016,.019,.253,'#725342',.076,.393,.124);
      neck.rotation.z=-.48;
      const saddle=box(guitar,.090,.022,.027,'#685143',.001,.238,.173);
      const bridge=ball(guitar,.036,'#5b453c',0,.280,.163);
      bridge.scale.set(.9,.85,.24);
      const strap=box(guitar,.012,.26,.016,'#e9ca96',-.097,.323,.024);
      strap.rotation.z=.28;
      g.userData.buskerGuitar=guitar;
    }
    if(ref.shopRole==='vendor'){
      // Vendors are visibly different from idle residents. Color-coded
      // aprons and a baker's soft cap make each trade legible from a glance.
      box(g,.149,.194,.031,ref.shopVenue==='bakery'?'#fff1d9':'#e9e2c4',
        0,.262,.086);
      if(ref.shopVenue==='bakery'){
        const bakerHat=cylinder(g,.078,.081,.074,'#fff5e2',0,.549,0);
        const crown=ball(g,.082,'#fff9eb',0,.594,0);
        crown.scale.set(1,.47,1);
      }else{
        // Bookshop keeper wears a short dark waistcoat and pen.
        box(g,.029,.088,.019,'#53655c',-.039,.269,.105);
      }
    }
    if(ref.districtWorker){
      // Real hand-held tools, with task-specific motions after arriving.
      const tool=new THREE.Group();tool.position.set(0,-.072,.027);
      hands[1].add(tool);
      if(ref.districtRole==='garden'){
        const can=ball(tool,.071,'#79a9a2',0,-.016,0);
        can.scale.set(1.22,.76,.8);
        const spout=cylinder(tool,.012,.016,.15,'#6b9891',.075,.012,.004);
        spout.rotation.z=-1.13;
        const loop=object(tool,geo('torus',.05,.009),mat('#a5c9b6'),
          -.045,.006,0);loop.scale.z=.56;
      }else if(ref.districtRole==='post'){
        box(tool,.145,.11,.14,'#d5a675',0,-.016,0);
        box(tool,.018,.12,.145,'#f6e6c7',0,-.01,0);
      }else if(ref.districtRole==='art'){
        const brush=cylinder(tool,.009,.011,.26,'#9d725a',0,-.12,0);
        brush.rotation.z=-.31;
        ball(tool,.023,'#5f9d9a',.037,-.243,.008).scale.set(.7,1.55,.65);
      }else{
        box(tool,.156,.073,.16,'#bc966b',0,-.042,0);
        const handle=object(tool,geo('torus',.071,.009),mat('#93745a'),
          0,.009,0);handle.scale.set(1,1,.54);
        for(let i=0;i<3;i++)ball(tool,.039,
          ['#e3a567','#da7e78','#c3c46e'][i],
          (i-1)*.047,.011,.014).castShadow=false;
      }
      g.userData.districtTool=tool;
    }
    const shopProps={};
    if(ref.shopRole){
      // Objects belong to the right wrist and follow the complete joint
      // chain; the customer receives them only at physical service time.
      const bread=new THREE.Group();bread.position.set(0,-.081,.043);
      hands[1].add(bread);
      const roll=ball(bread,.069,'#e3a263',0,0,0);
      roll.scale.set(1.17,.61,.79);
      for(let i=-1;i<=1;i++){
        const score=box(bread,.009,.011,.049,'#f9d59a',i*.031,.039,0);
        score.rotation.z=.18;
      }
      bread.userData.heldProduct='bread';bread.visible=false;
      const book=new THREE.Group();book.position.set(0,-.082,.053);
      hands[1].add(book);
      box(book,.122,.157,.026,'#538c86',0,0,0);
      box(book,.101,.139,.025,'#f6e5bf',0,0,.018);
      box(book,.086,.105,.008,'#f7c678',0,.009,.039);
      book.rotation.x=-.11;
      book.userData.heldProduct='book';book.visible=false;
      shopProps.bread=bread;shopProps.book=book;
    }
    // One upper-body pivot carries torso, neck, hair, clothes and arms.
    // Hip and ankle anchors stay in the ground-space leg rig. In particular,
    // hats and eyes cannot detach when the resident leans to greet somebody.
    const upperBody=new THREE.Group();
    for(const part of [...g.children]){
      if(legs.includes(part))continue;
      g.remove(part);upperBody.add(part);
    }
    g.add(upperBody);
    g.userData.limbs={legs,arms,elbows,wrists,hands,shins,feet,
      eyelids,headPivot,upperBody,smile,brows,mouth,faceSurface};
    if(ref.kid)g.scale.setScalar(.76);   // children are smaller
    g.userData.shopProps=shopProps;
    g.userData.pose={speed:0,sit:0,chat:0,speak:0,greet:0,observe:0,
      knock:0,order:0,depart:0,
      serve:0,enjoy:0,receive:0,celebrate:0,play:0,dance:0,work:0,
      lastClock:null,turned:false};
    // Lightweight deterministic silhouette variation: coat, satchel or vest,
    // plus narrow waist and different hats already supplied by simulation.
    if(ref.bag){
      const strap=box(upperBody,.018,.21,.018,'#81684f',-.055,.29,.083);
      strap.rotation.z=-.28;
    }
    if(ref.scarf){
      const scarf=object(upperBody,geo('torus',.062,.014),mat('#e8bd9e'),0,.37,0,false);
      scarf.rotation.x=Math.PI/2;
      box(upperBody,.036,.12,.018,'#e8bd9e',-.041,.310,.081);
    }
    g.userData.characterSilhouette=true;
    // Deterministic build and height variation, never a random change
    // between frames. Hero residents remain slightly larger at close zoom.
    const scale=ref.shopRole==='vendor'?1.19:
      ref.shopRole==='customer'?1.13:ref.districtResident?1.15:
      ref.heroResident?1.10:1;
    const characterPhase=ref.ph||0;
    // Chibi proportions: a little smaller overall (so people sit comfortably beside the small toy cars) with a big round head.
    // Slimmer and a little taller than the chibi build, with a small head: adults read as people, not as toys.
    g.scale.set(CUTE*scale*(.9+.045*Math.sin(characterPhase*1.3)),
      CUTE*scale*(1.04+.07*Math.cos(characterPhase*.9)),
      CUTE*scale*(.88+.045*Math.sin(characterPhase+1)));
    headPivot.scale.setScalar(HEAD_BIG);
    return g;
  }
  /* ---- The ring railway. A little round-faced steam train loops the town on a
     track just inside the board's edge, stops at the station on the front edge
     (platform, clock tower, benches, passengers who board and get off), and
     dives through a grassy hill with a tunnel at the back. ---- */
  const RAIL={x0:.27,x1:17.73,y0:-.62,y1:18.62,ra:.89,gauge:.2,top:.17,stationX:9,hillX:9};
  const rail={mode:'pass',freight:null,freightEvery:3,laps:0,t:0,pts:[],cum:[],len:0,built:false,s:null,v:0,state:'run',dwell:0,away:0,train:null,puffs:[],puffAt:0,pax:[],signal:null,clock:null,doors:0,toots:0,stops:0,laps:0,lastS:0,paxNext:0};
  function railPath(){
    if(rail.built)return;
    const {x0,x1,y0,y1,ra}=RAIL,pts=[];
    const arc=(cx,cy,a0,a1)=>{for(let k=0;k<=10;k++){const a=a0+(a1-a0)*k/10;pts.push([cx+ra*Math.cos(a),cy+ra*Math.sin(a)]);}};
    arc(x1,y0+ra,-Math.PI/2,0);arc(x1,y1-ra,0,Math.PI/2);arc(x0,y1-ra,Math.PI/2,Math.PI);arc(x0,y0+ra,Math.PI,Math.PI*1.5);
    rail.pts=pts;rail.cum=[0];
    for(let i=1;i<=pts.length;i++){const a=pts[i-1],b=pts[i%pts.length];rail.cum.push(rail.cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
    rail.len=rail.cum[pts.length];
    // Arc length of the station stop on the south run (heading west).
    rail.stationS=rail.cum[22]-(RAIL.stationX-x0);
    rail.built=true;
  }
  function railAt(s){
    const {pts,cum,len}=rail;s=((s%len)+len)%len;
    let i=0;while(i<pts.length-1&&cum[i+1]<=s)i++;
    const a=pts[i],b=pts[(i+1)%pts.length],seg=cum[i+1]-cum[i]||1,t=(s-cum[i])/seg;
    const dx=(b[0]-a[0])/seg,dz=(b[1]-a[1])/seg;
    return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,dx,dz};
  }
  const flatShape=(w,h,r)=>{const s=new THREE.Shape();s.moveTo(-w,0);s.lineTo(-w,h);s.absarc(0,h,w,Math.PI,0,true);s.lineTo(w,0);s.closePath();return s;};
  function createRailway(){
    railPath();
    const g=new THREE.Group();world.add(g);
    const top=RAIL.top,N=rail.pts.length;
    // Ballast, sleepers and two rails, instanced along the loop.
    const segs=[];for(let i=0;i<N;i++){const a=rail.pts[i],b=rail.pts[(i+1)%N];segs.push({x:(a[0]+b[0])/2,z:(a[1]+b[1])/2,len:Math.hypot(b[0]-a[0],b[1]-a[1]),ang:-Math.atan2(b[1]-a[1],b[0]-a[0])});}
    const inst=(geom,material,list)=>{const m=new THREE.InstancedMesh(geom,material,list.length),o=new THREE.Object3D();
      list.forEach((e,k)=>{o.position.set(e.x,e.y,e.z);o.rotation.set(0,e.ang,0);o.scale.set(e.sx||1,1,e.sz||1);o.updateMatrix();m.setMatrixAt(k,o.matrix);});
      m.instanceMatrix.needsUpdate=true;m.receiveShadow=true;g.add(m);return m;};
    inst(new THREE.BoxGeometry(1,.035,.34),mat('#d9cdbb',.95),segs.map(e=>({x:e.x,y:top+.004,z:e.z,ang:e.ang,sx:e.len+.03})));
    const sleepers=[];for(let s=0;s<rail.len;s+=.13){const p=railAt(s);sleepers.push({x:p.x,y:top+.024,z:p.z,ang:-Math.atan2(p.dz,p.dx)});}
    inst(new THREE.BoxGeometry(.04,.02,.3),mat('#a98366',.9),sleepers);
    for(const side of [-1,1])inst(new THREE.BoxGeometry(1,.026,.016),mat('#9aa3ab',.45),segs.map(e=>({x:e.x+Math.sin(e.ang)*side*RAIL.gauge/2,y:top+.045,z:e.z+Math.cos(e.ang)*side*RAIL.gauge/2,ang:e.ang,sx:e.len+.02})));
    // The grassy hill with a tunnel on the back run.
    const hillW=.62,hillH=.86,hillL=2.6;
    const hs=new THREE.Shape();hs.moveTo(-hillW,0);hs.absellipse(0,0,hillW,hillH,Math.PI,0,true);hs.closePath();
    const hill=object(g,new THREE.ExtrudeGeometry(hs,{depth:hillL,bevelEnabled:false,curveSegments:20}),mat('#a9cf92',1),RAIL.hillX-hillL/2,top-.01,RAIL.y0,true);hill.rotation.y=Math.PI/2;hill.userData.railHill=true;
    for(const [dx,s] of [[-.4,.9],[.35,1.1],[.75,.7]]){const t=ball(g,.2*s,mat('#7fb27c',.9),RAIL.hillX+dx,top+hillH*.82+.04,RAIL.y0+(dx>0?.08:-.1));t.scale.set(1,.9,1);}
    for(const sd of [-1,1]){
      const frame=new THREE.Mesh(new THREE.ShapeGeometry(flatShape(.29,.45)),new THREE.MeshStandardMaterial({color:'#d4c8b4',roughness:.9}));
      const hole=new THREE.Mesh(new THREE.ShapeGeometry(flatShape(.21,.43)),new THREE.MeshBasicMaterial({color:'#2d2a35'}));
      for(const [m,off,dy] of [[frame,.006,top-.005],[hole,.011,top-.005]]){m.position.set(RAIL.hillX+sd*(hillL/2+off),dy,RAIL.y0);m.rotation.y=sd*Math.PI/2;g.add(m);}
    }
    g.userData.civicStation=true;
    // Station: platform, hall, clock tower, canopy, lamps, benches.
    const cx=RAIL.stationX,py=top,platTop=py+.08;
    box(g,3.9,.08,.46,'#efe3cd',cx,py+.04,18.19).castShadow=false;
    box(g,3.9,.012,.035,'#f6d56a',cx,platTop+.003,18.40).castShadow=false;
    for(const sd of [-1,1])box(g,.38,.05,.46,'#e5d8c0',cx+sd*2.12,py+.025,18.19);      // gentle steps down at each end
    const hallZ=17.58;
    box(g,1.9,.52,.56,'#f7e8d0',cx,py+.26,hallZ);
    const rs=new THREE.Shape();rs.moveTo(-.4,0);rs.lineTo(.4,0);rs.lineTo(0,.28);rs.closePath();
    const roof=object(g,new THREE.ExtrudeGeometry(rs,{depth:2.08,bevelEnabled:false}),mat('#e4897b',.85),cx-1.04,py+.52,hallZ);roof.rotation.y=Math.PI/2;
    box(g,.44,1.02,.44,'#fbf0dc',cx,py+.51,hallZ);
    const cone=object(g,new THREE.ConeGeometry(.36,.36,4),mat('#e4897b',.85),cx,py+1.2,hallZ);cone.rotation.y=Math.PI/4;
    ball(g,.035,mat('#e8c15a',.4),cx,py+1.42,hallZ);
    // Clock face on the south side, hands tied to the town's own hour.
    const face=object(g,geo('cylinder',.14,.14,.02),mat('#fffdf6',.5),cx,py+.86,hallZ+.23,false);face.rotation.x=Math.PI/2;
    const rim=object(g,geo('torus',.14,.015),mat('#d7a24a',.5),cx,py+.86,hallZ+.232,false);
    const hPivot=new THREE.Group(),mPivot=new THREE.Group();hPivot.position.set(cx,py+.86,hallZ+.245);mPivot.position.set(cx,py+.86,hallZ+.249);g.add(hPivot,mPivot);
    box(hPivot,.016,.08,.008,'#4a4540',0,.04,0,false);box(mPivot,.01,.115,.008,'#4a4540',0,.057,0,false);rail.clock={hPivot,mPivot};
    // Hall door and glowing windows facing the platform.
    const mkPane=()=>{const m=new THREE.MeshStandardMaterial({color:'#a9d3d8',roughness:.22,emissive:'#ffd48a',emissiveIntensity:.1});m.userData={miniatureWindow:true,warm:true};windowMaterials.add(m);return m;};
    const pane=mkPane();
    box(g,.22,.3,.02,'#a97b5c',cx,py+.15,hallZ+.29);ball(g,.11,mat('#a97b5c',.8),cx,py+.3,hallZ+.285).scale.set(1,.9,.2);
    for(const sd of [-1,1])for(const k of [-.35,.35]){
      box(g,.2,.24,.02,pane,cx+k*1.1*sd+(k>0?0:0),py+.3,hallZ+.292);
    }
    // Sign and canopy over the platform.
    for(const px of [-1,0,1])cylinder(g,.015,.015,.7,'#f6efe2',cx+px,platTop+.35,18.24);
    box(g,2.3,.04,.36,'#86c9bd',cx,platTop+.71,18.08);
    box(g,2.34,.055,.035,'#e8ddc5',cx,platTop+.685,18.27);
    box(g,3.6,.025,.27,'#d9cdb6',cx,py+.015,17.12);
    for(const side of [-1,1])plantedBed(g,cx+side*1.5,17.12,.17,.095,side+1,py+.035);
    sign(g,'TOY TOWN',cx,platTop+.93,18.2,.8).rotation.x=-.2;
    // Platform furniture.
    for(const bx of [-.9,.9]){
      box(g,.34,.03,.1,'#c68c63',cx+bx,platTop+.14,18.1);box(g,.34,.1,.025,'#c68c63',cx+bx,platTop+.22,18.04);
      for(const lx of [-.14,.14])box(g,.02,.13,.08,'#7a8187',cx+bx+lx,platTop+.065,18.1);
    }
    box(g,.2,.1,.14,'#c9a078',cx+1.3,platTop+.05,18.12);box(g,.14,.08,.12,'#9bc2a2',cx+1.42,platTop+.04,18.2);
    box(g,.12,.14,.12,'#8aa7c9',cx-1.3,platTop+.07,18.08);
    for(const lx of [-1.86,1.86]){
      cylinder(g,.014,.016,.58,'#5c646b',cx+lx,platTop+.29,18.34);
      object(g,geo('sphere',.045),lanternGlass,cx+lx,platTop+.62,18.34,false);
    }
    // Signal: red while the train stands in the station, green otherwise.
    const sx=RAIL.stationX+3.1;
    cylinder(g,.012,.012,.5,'#5c646b',sx,top+.25,18.38);
    const red=new THREE.MeshStandardMaterial({color:'#ff6b5e',emissive:'#ff3b2e',emissiveIntensity:.1,roughness:.4}),grn=new THREE.MeshStandardMaterial({color:'#7fe39a',emissive:'#33d36b',emissiveIntensity:.9,roughness:.4});
    box(g,.07,.15,.05,'#454d55',sx,top+.52,18.38);ball(g,.022,red,sx,top+.56,18.41);ball(g,.022,grn,sx,top+.49,18.41);
    rail.signal={red,grn};
    // Waiting passengers (they board and get off for real).
    rail.pax=[];rail.doorMeshes=[];
    const cols=['#e58f8f','#7fb3d9','#f2c36b','#9ccf9a','#c39be0','#f0a574'],skins=['#f1c9a5','#d8a77c','#a8754f','#7a4e33'];
    for(let i=0;i<6;i++){
      const p=person({col:cols[i],skin:skins[i%4],hair:i%2?'#49362d':'#333947',ph:i*1.7+.4,x:i,y:i*2,hat:i===3?'cap':null,bag:i%2===0});
      p.scale.setScalar(.93*CUTE);p.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);g.add(p);
      const spot={x:cx-1.5+i*.6+(i%2)*.1,z:18.3+(i%3)*.03};
      rail.pax.push({g:p,spot,state:i<4?'wait':'inside',x:i<4?spot.x:cx,z:i<4?spot.z:17.9,until:i<4?0:3+i*5,door:0,tx:0,tz:0,ph:i});
      p.position.set(rail.pax[i].x,platTop,rail.pax[i].z);p.visible=i<4;
    }
    // The train: a red locomotive with a face and three pastel carriages.
    const train=new THREE.Group();g.add(train);
    const units=[],gap=.05,lengths=[.62,.5,.5,.5];let off=0;
    const carCols=['#8ec9ef','#f7d56a','#f2a99b'];
    const wheelRig=[];
    const wheel=(parent,x,r,z)=>{const a=new THREE.Group();a.position.set(x,r,z);parent.add(a);const t=cylinder(a,r,r,.035,'#4a4f58');t.rotation.x=Math.PI/2;const h=cylinder(a,r*.5,r*.5,.04,'#f3d37a');h.rotation.x=Math.PI/2;box(a,r*1.1,.014,.045,'#f3d37a',0,0,0,false);wheelRig.push({a,r});};
    for(let u=0;u<lengths.length;u++){
      const L=lengths[u],ug=new THREE.Group(),front=u===0;off+=L/2;
      const lg=new THREE.Group();ug.add(lg);
      object(lg,geo('soft',L,.05,.26,.02),mat('#4f5560',.7),0,top+.06,0);
      if(front){
        // boiler, cab, chimney, face
        const boiler=object(lg,geo('cylinder',.115,.115,.4),mat('#e8645a',.55),.08,top+.2,0);boiler.rotation.z=Math.PI/2;
        const band=object(lg,geo('cylinder',.118,.118,.05),mat('#fbe8b6',.6),.0,top+.2,0,false);band.rotation.z=Math.PI/2;
        const plate=object(lg,geo('cylinder',.12,.12,.02),mat('#fbe8b6',.5),.285,top+.2,0,false);plate.rotation.z=Math.PI/2;
        box(lg,.2,.27,.27,'#fbe8b6',-.19,top+.255,0);
        box(lg,.25,.03,.31,'#e8645a',-.19,top+.41,0);
        const cab=mkPane();
        for(const sd of [-1,1])box(lg,.09,.1,.012,cab,-.19,top+.27,sd*.137);
        const stack=object(lg,geo('cylinder',.045,.03,.14),mat('#3d444e',.6),.2,top+.4,0);
        object(lg,geo('cylinder',.06,.045,.04),mat('#3d444e',.6),.2,top+.485,0);
        ball(lg,.045,mat('#e8c15a',.35),.06,top+.32,0).scale.set(1,.8,1);
        // face on the smokebox
        for(const sd of [-1,1]){ball(lg,.033,mat('#ffffff',.3),.30,top+.235,sd*.045);ball(lg,.017,mat('#2d3640',.4),.318,top+.235,sd*.045);}
        const smile=object(lg,new THREE.TorusGeometry(.04,.008,6,14,Math.PI),mat('#a8453d',.5),.3,top+.17,0,false);smile.rotation.y=Math.PI/2;smile.rotation.z=Math.PI;
        for(const sd of [-1,1])ball(lg,.018,mat('#ff9a8f',.5),.29,top+.2,sd*.085).scale.set(.3,.7,1);
        rail.lamp=new THREE.MeshStandardMaterial({color:'#fff6d6',emissive:'#ffd98a',emissiveIntensity:.15,roughness:.3});
        object(lg,geo('sphere',.03),rail.lamp,.31,top+.29,0,false);
        // cow-catcher
        const cc=box(lg,.07,.07,.26,'#f2a99b',.34,top+.07,0);
        for(const x of [-.19,.02,.19])for(const z of [-1,1])wheel(lg,x,x===-.19?.085:.06,z*.13);
      }else{
        const col=carCols[(u-1)%3];
        box(lg,L-.02,.27,.3,col,0,top+.21,0);
        box(lg,L+.02,.04,.33,'#fff7e6',0,top+.36,0);
        const roof2=object(lg,geo('capsule',.1,L-.2),mat(tint(col,'#ffffff',.35),.6),0,top+.42,0,true);roof2.rotation.z=Math.PI/2;roof2.scale.set(1,1.1,1.45);
        const win=mkPane();
        for(const sd of [-1,1]){
          for(let k=0;k<3;k++)box(lg,.1,.11,.012,win,-.15+k*.15,top+.25,sd*.153);
          const door=box(lg,.08,.2,.012,tint(col,'#ffffff',.5),0,top+.19,sd*.156);rail.doorMeshes.push(door);
        }
        for(const x of [-.17,.17])for(const z of [-1,1])wheel(lg,x,.045,z*.13);
        for(const x of [-L/2-.0])box(lg,.05,.025,.03,'#3d444e',x,top+.1,0,false);
      }
      units.push({g:ug,len:L,off:off,front});off+=L/2+gap;
      train.add(ug);
    }
    rail.train={g:train,units,total:off-gap,wheels:wheelRig};
    // A goods train that runs every few laps: green locomotive, coal, logs, a tanker, a box car and a caboose.
    const fr=new THREE.Group();g.add(fr);fr.visible=false;
    const funits=[],fwheels=[];let foff=0;
    const fkinds=[['loco',.62],['coal',.46],['logs',.46],['tank',.46],['box',.46],['caboose',.42]];
    const fwheel=(parent,x,r,z)=>{const a=new THREE.Group();a.position.set(x,r,z);parent.add(a);const t=cylinder(a,r,r,.035,'#3a3f46');t.rotation.x=Math.PI/2;const h=cylinder(a,r*.5,r*.5,.04,'#d8c27a');h.rotation.x=Math.PI/2;box(a,r*1.1,.014,.045,'#d8c27a',0,0,0,false);fwheels.push({a,r});};
    for(const [kind,L] of fkinds){
      const ug=new THREE.Group(),lg=new THREE.Group();ug.add(lg);foff+=L/2;
      object(lg,geo('soft',L,.05,.26,.02),mat('#4f5560',.7),0,top+.06,0);
      if(kind==='loco'){
        const boiler=object(lg,geo('cylinder',.115,.115,.4),mat('#4f9a6a',.55),.08,top+.2,0);boiler.rotation.z=Math.PI/2;
        box(lg,.2,.27,.27,'#f6e8c4',-.19,top+.255,0);box(lg,.25,.03,.31,'#3f7a52',-.19,top+.41,0);
        object(lg,geo('cylinder',.045,.03,.14),mat('#2f353d',.6),.2,top+.4,0);object(lg,geo('cylinder',.06,.045,.04),mat('#2f353d',.6),.2,top+.485,0);
        for(const sd of [-1,1]){ball(lg,.033,mat('#ffffff',.3),.30,top+.235,sd*.045);ball(lg,.017,mat('#2d3640',.4),.318,top+.235,sd*.045);}
        box(lg,.07,.07,.26,'#f5c04b',.34,top+.07,0);
        for(const x of [-.19,.02,.19])for(const z of [-1,1])fwheel(lg,x,x===-.19?.085:.06,z*.13);
      }else{
        for(const x of [-.14,.14])for(const z of [-1,1])fwheel(lg,x,.045,z*.13);
        if(kind==='coal'){box(lg,L-.04,.14,.3,'#a35f46',0,top+.17,0);for(let k=0;k<7;k++)ball(lg,.05,mat('#2f3338',.9),-.14+k*.047,top+.27+(k%2)*.02,((k%3)-1)*.07).castShadow=false;}
        else if(kind==='logs'){box(lg,L-.04,.04,.3,'#8a6d4e',0,top+.1,0);for(let k=0;k<6;k++){const lgm=cylinder(lg,.045,.045,.28,'#b5865c',-.12+(k%3)*.12,top+.16+Math.floor(k/3)*.08,0);lgm.rotation.x=Math.PI/2;}for(const x of [-.17,.17])box(lg,.014,.13,.015,'#8a6d4e',x,top+.17,.15,false),box(lg,.014,.13,.015,'#8a6d4e',x,top+.17,-.15,false);}
        else if(kind==='tank'){const t=cylinder(lg,.12,.12,L-.06,'#6aa7d6',0,top+.2,0);t.rotation.z=Math.PI/2;box(lg,.05,.03,.05,'#2f353d',0,top+.34,0);}
        else if(kind==='box'){box(lg,L-.04,.24,.3,'#d2655a',0,top+.2,0);box(lg,.12,.18,.012,'#8d3f37',0,top+.2,.157);box(lg,.12,.18,.012,'#8d3f37',0,top+.2,-.157);box(lg,L-.02,.03,.32,'#f2e6c9',0,top+.33,0);}
        else{box(lg,L-.04,.22,.3,'#b4423a',0,top+.19,0);box(lg,.2,.1,.2,'#f2e6c9',0,top+.36,0);const win=mkPane();for(const sd of [-1,1])box(lg,.08,.06,.012,win,0,top+.36,sd*.103);}
      }
      funits.push({g:ug,len:L,off:foff,front:kind==='loco'});foff+=L/2+gap;fr.add(ug);
    }
    rail.freight={g:fr,units:funits,total:foff-gap,wheels:fwheels};
    rail.freight.lamp=null;
    // Smoke puffs.
    rail.puffs=[];for(let i=0;i<9;i++){const m=new THREE.Mesh(geo('sphere',.04),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false}));m.visible=false;g.add(m);rail.puffs.push({m,t:9,life:1});}
    // Restore the train to where it was (or just before the station on a fresh start).
    if(rail.s===null)rail.s=rail.stationS+rail.train.total/2-14;
    placeTrain();
  }
  const activeTrain=()=>rail.mode==='freight'&&rail.freight?rail.freight:rail.train;
  function placeTrain(){
    const tr=activeTrain();if(!tr)return;
    if(rail.train)rail.train.g.visible=tr===rail.train;if(rail.freight)rail.freight.g.visible=tr===rail.freight;
    const top=RAIL.top;
    for(const u of tr.units){
      const p=railAt(rail.s-u.off);
      u.g.position.set(p.x,0,p.z);u.g.rotation.y=-Math.atan2(p.dz,p.dx);
    }
  }
  const TRAIN={cruise:1.25,accel:.5,brake:.55,dwell:10};
  function updateTrain(dt,dark){
    const tr=activeTrain();if(!tr||dt<=0)return;
    rail.t+=dt;
    const target=rail.stationS+rail.train.total/2;
    // Where is the stop line ahead of the front of the train?
    const dist=(((target-rail.s)%rail.len)+rail.len)%rail.len;
    if(rail.state==='run'){
      let want=TRAIN.cruise;
      if(rail.mode==='freight')want=TRAIN.cruise*.72;      // the goods train rumbles straight through
      else{
        if(rail.away<=0||dist<rail.len-6)want=Math.min(want,Math.sqrt(2*TRAIN.brake*Math.max(0,dist-.01))+.04);
        if(rail.away>0)want=TRAIN.cruise;
      }
      rail.v+=Math.sign(want-rail.v)*Math.min(Math.abs(want-rail.v),(want>rail.v?TRAIN.accel:TRAIN.brake*1.4)*dt);
      const step=rail.v*dt;rail.s+=step;
      if(rail.away>0)rail.away-=step;
      else if(rail.mode==='pass'&&dist<.02&&rail.v<.12){rail.state='dwell';rail.v=0;rail.dwell=TRAIN.dwell;rail.stops++;rail.doorsAt=1.2;rail.s=target-0.0;sound('bell');}
    }else{
      rail.dwell-=dt;
      if(rail.dwell<=0){rail.state='run';rail.away=rail.len*.6;rail.toots++;sound('toot');tootPuffs();}
    }
    // Every few laps the goods train takes over, swapped inside the tunnel where nobody can see.
    {const sT=rail.len-(RAIL.x1-RAIL.hillX),rel=(((rail.s-tr.total/2-sT)%rail.len)+rail.len)%rail.len;
     if(rail.state==='run'&&rail.v>.2&&rel<rail.v*dt*1.01+.001&&rail.t-(rail.swapT||-9)>8){
       rail.swapT=rail.t;rail.laps++;const want=rail.freightEvery>0&&rail.laps%rail.freightEvery===0?'freight':'pass';
       if(want!==rail.mode){rail.mode=want;rail.away=0;}}}
    placeTrain();
    // Spin the wheels with the distance travelled.
    const moved=rail.s-rail.lastS;rail.lastS=rail.s;
    for(const w of tr.wheels)w.a.rotation.z=(w.a.rotation.z-moved/w.r)%TAU;
    // Doors open while the train stands.
    const open=rail.state==='dwell'&&rail.dwell<TRAIN.dwell-.6&&rail.dwell>1.2?1:0;
    rail.doors+=(open-rail.doors)*Math.min(1,dt*4);
    for(const d of rail.doorMeshes)d.position.x=rail.doors*.1;
    // Signal, headlamp, clock hands.
    const stopped=rail.state==='dwell';
    rail.signal.red.emissiveIntensity=stopped||dist<2.2&&rail.away<=0?1.6:.1;rail.signal.grn.emissiveIntensity=stopped||dist<2.2&&rail.away<=0?.1:1;
    rail.lamp.emissiveIntensity=.15+dark*3.2;
    const hour=town.debug().hour||0;
    rail.clock.hPivot.rotation.z=-(hour%12)/12*TAU;rail.clock.mPivot.rotation.z=-(hour%1)*TAU;
    // Smoke.
    rail.puffAt-=dt;
    if(rail.puffAt<=0){rail.puffAt=rail.state==='dwell'?.7:Math.max(.2,.42-rail.v*.1);emitPuff(1);}
    for(const p of rail.puffs){
      if(p.t>=p.life){p.m.visible=false;continue;}
      p.t+=dt;const k=p.t/p.life;p.m.position.y+=dt*(.16+.1*(1-k));p.m.position.x+=dt*p.vx;p.m.position.z+=dt*p.vz;
      p.m.scale.setScalar(.7+k*2.1);p.m.material.opacity=.85*(1-k)*(1-k);
    }
    updatePassengers(dt,dark);
  }
  function emitPuff(n){
    const loco=activeTrain().units[0].g,th=loco.rotation.y,v={x:loco.position.x+.2*Math.cos(th),y:RAIL.top+.52,z:loco.position.z-.2*Math.sin(th)};
    for(let k=0;k<n;k++){const p=rail.puffs.find(q=>q.t>=q.life);if(!p)return;
      p.t=0;p.life=1.7+Math.random()*.7;p.vx=-.04+(Math.random()-.5)*.04;p.vz=(Math.random()-.5)*.05;p.m.position.set(v.x,v.y,v.z);p.m.visible=true;}
  }
  function tootPuffs(){for(let i=0;i<4;i++)emitPuff(1);}
  // Passengers: wait on the platform, step on when the doors open, step off at the next stop.
  function updatePassengers(dt,dark){
    const tr=rail.train,platTop=RAIL.top+.08,open=rail.doors>.6,cx=RAIL.stationX;
    const doorX=i=>tr.units[1+(i%3)].g.position.x+(i%2?.12:-.12);
    if(open&&rail.paxStop!==rail.stops){
      rail.paxStop=rail.stops;
      const waiting=rail.pax.filter(p=>p.state==='wait'),riding=rail.pax.filter(p=>p.state==='aboard');
      waiting.slice(0,2).forEach((p,k)=>{p.boardAt=rail.t+.8+k*1.3;});
      riding.forEach((p,k)=>{p.alightAt=rail.t+.4+k*1.1;});
    }
    for(let i=0;i<rail.pax.length;i++){
      const p=rail.pax[i],g=p.g;p.ph+=dt*6;let moving=false;
      const walkTo=(tx,tz,speed=.3)=>{const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);if(d<.02)return true;const s=Math.min(d,speed*dt);p.x+=dx/d*s;p.z+=dz/d*s;g.rotation.y=Math.atan2(dx,dz);moving=true;return false;};
      if(p.state==='wait'){
        if(walkTo(p.spot.x,p.spot.z)){moving=false;g.rotation.y=Math.PI+Math.sin(rail.t*.4+i)*.6;}
        if(p.boardAt&&rail.t>p.boardAt&&open){p.boardAt=0;p.state='board';}
      }else if(p.state==='board'){
        if(walkTo(doorX(i),18.47,.4)){p.state='aboard';g.visible=false;}
      }else if(p.state==='aboard'){
        if(p.alightAt&&rail.t>p.alightAt&&open){p.alightAt=0;p.x=doorX(i);p.z=18.47;g.visible=true;p.state='alight';}
      }else if(p.state==='alight'){
        if(walkTo(cx+(i-3)*.35,17.98,.3)){p.state='inside';g.visible=false;p.until=rail.t+9+Math.random()*14;}
      }else if(p.state==='inside'){
        if(rail.t>p.until){p.x=cx+(i-3)*.35;p.z=17.98;g.visible=true;p.state='out';}
      }else if(p.state==='out'){
        if(walkTo(p.spot.x,p.spot.z,.28))p.state='wait';
      }
      if(g.visible){
        const L=g.userData.limbs,a=moving?Math.sin(p.ph*1.5)*.55:0;
        if(L){L.legs?.forEach((l,k)=>{l.rotation.x=(k?1:-1)*a;});L.arms?.forEach((l,k)=>{l.rotation.x=(k?-1:1)*a*.7;});}
        g.position.set(p.x,platTop+(moving?Math.abs(Math.sin(p.ph*1.5))*.012:0),p.z);
      }
    }
  }
  // Tap the train (or its smoke): toot, a puff, everyone waves.
  function trainHit(clientX,clientY){
    const tr=rail.train;if(!tr)return false;
    const r=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3();
    for(const u of tr.units){
      v.copy(u.g.position);v.y=RAIL.top+.25;v.project(camera);if(v.z>1)continue;
      if(Math.hypot(r.left+(v.x+1)/2*r.width-clientX,r.top+(1-v.y)/2*r.height-clientY)<44){
        rail.toots++;sound('toot');tootPuffs();
        showBubble(u.g,['Choo choo!','Toot toot!','All aboard!'][rail.toots%3],2200);return true;}
    }
    return false;
  }

  /* ---- Out by the railway: a windmill on the east edge and a small pasture of sheep on the west. ---- */
  const farm={sails:null,sheep:[],pen:{x0:.25,x1:.85,z0:2.2,z1:5.8}};
  function createFarm(){
    const g=new THREE.Group();world.add(g);
    const wx=17.62,wz=9.55,base=.17;g.scale.setScalar(1);
    const body=object(g,geo('cylinder',.17,.25,.78),mat('#f6ecd9',.9),wx,base+.39,wz);
    object(g,geo('cylinder',.19,.19,.04),mat('#d98b6b',.8),wx,base+.79,wz);
    const cap=object(g,new THREE.ConeGeometry(.2,.26,16),mat('#d98b6b',.8),wx,base+.93,wz);
    box(g,.1,.17,.02,'#a97b5c',wx,base+.1,wz+.22);
    for(const k of [-1,1])box(g,.07,.08,.02,'#a9d3d8',wx+k*.1,base+.5,wz+.19);
    // The sails face the front (south, toward the camera) so the turning is plain to see.
    const hub=new THREE.Group();hub.position.set(wx,base+.7,wz+.24);g.add(hub);
    ball(hub,.04,mat('#7c5b45',.7),0,0,0);
    for(let k=0;k<4;k++){const arm=new THREE.Group();arm.rotation.z=k*Math.PI/2;hub.add(arm);
      box(arm,.02,.4,.014,'#8b6a52',0,.2,0,false);box(arm,.13,.27,.01,'#fff7e6',.075,.25,.0,false);}
    farm.sails=hub;
    for(const [bx,bz] of [[17.55,8.55],[17.5,10.6]]){const bale=object(g,geo('cylinder',.08,.08,.14),mat('#e6c978',.95),bx,base+.08,bz);bale.rotation.x=Math.PI/2;}
    // Pasture on the west edge: low fence, a trough, a few woolly sheep.
    const {x0,x1,z0,z1}=farm.pen;
    for(let z=z0;z<=z1+.01;z+=.26)for(const x of [x0-.02,x1+.02])cylinder(g,.012,.012,.14,'#b98f66',x,base+.07,z).castShadow=false;
    for(let x=x0;x<=x1;x+=.26)for(const z of [z0,z1])cylinder(g,.012,.012,.14,'#b98f66',x,base+.07,z).castShadow=false;
    box(g,.02,.03,x1-x0,'#b98f66',x0-.02,base+.1,(z0+z1)/2).rotation.y=Math.PI/2;
    box(g,.02,.03,x1-x0,'#b98f66',x1+.02,base+.1,(z0+z1)/2).rotation.y=Math.PI/2;
    box(g,.18,.05,.08,'#9a7b5e',(x0+x1)/2,base+.03,z1-.18);
    farm.sheep=[];
    for(let i=0;i<4;i++){
      const sg=new THREE.Group();g.add(sg);
      const wool=mat('#fffaf0',.95);
      ball(sg,.07,wool,0,.12,0).scale.set(1.25,.95,1);ball(sg,.05,wool,.06,.15,.02);ball(sg,.05,wool,-.06,.15,-.02);
      const head=new THREE.Group();head.position.set(.11,.13,0);sg.add(head);
      ball(head,.036,mat('#4a4650',.7),.02,0,0).scale.set(1.2,1,.9);
      ball(head,.014,mat('#4a4650',.7),-.005,.03,.035);ball(head,.014,mat('#4a4650',.7),-.005,.03,-.035);
      for(const [lx,lz] of [[.05,.03],[.05,-.03],[-.05,.03],[-.05,-.03]])cylinder(sg,.008,.008,.07,'#4a4650',lx,.04,lz).castShadow=false;
      const sheep={g:sg,head,x:x0+.12+(x1-x0-.24)*((i*.37)%1),z:z0+.3+(z1-z0-.6)*((i*.61)%1),tx:0,tz:0,wait:i*1.3,ph:i};
      sheep.tx=sheep.x;sheep.tz=sheep.z;sg.position.set(sheep.x,base,sheep.z);farm.sheep.push(sheep);
    }
  }
  function updateFarm(dt){
    if(farm.sails)farm.sails.rotation.z-=dt*((.9+(weatherKind==='storm'?1.8:weatherKind==='rain'?.6:0))*(1+(farm.boost>0?4:0))*(windNow()?1.5:1));
    const {x0,x1,z0,z1}=farm.pen;
    for(const s of farm.sheep){
      s.ph+=dt;s.wait-=dt;
      const dx=s.tx-s.x,dz=s.tz-s.z,d=Math.hypot(dx,dz);
      if(d>.02){const v=Math.min(d,.09*dt);s.x+=dx/d*v;s.z+=dz/d*v;s.g.rotation.y=-Math.atan2(dz,dx);s.head.rotation.z=0;s.g.position.set(s.x,.17+Math.abs(Math.sin(s.ph*7))*.006,s.z);}
      else{s.head.rotation.z=s.wait>0&&Math.sin(s.ph*.7)>-.2?-.55:0;   // grazing
        if(s.wait<=0){s.tx=x0+.1+Math.random()*(x1-x0-.2);s.tz=z0+.2+Math.random()*(z1-z0-.4);s.wait=3+Math.random()*6;}}
    }
  }

  /* ---- The building site: a hoarded plot with a half-built house (slab, brick
     walls with window gaps, scaffolding, rafters), a tower crane whose jib swings
     and whose hook lifts a load, a cement mixer, bricks, sand, cones, a sign and
     hard-hatted workers who really work. ---- */
  const site={crane:null,jib:null,hook:null,load:null,mixer:null,workers:[],t:0,built:false};
  function buildingSite(b){
    const cx=b.x+1,cz=b.y+1,base=.17,g=new THREE.Group();world.add(g);
    const S=3.25;
    // Packed-earth pad with tyre tracks, a kerb of sandbags and the hoarding.
    box(g,S,.03,S,'#d9c39d',cx,base+.005,cz,false).receiveShadow=true;
    for(const k of [-.55,.55])box(g,.07,.012,S*.78,'#c3ab81',cx+k,base+.025,cz+.1,false);
    const fence=(x0,z0,x1,z1,gap)=>{
      const n=Math.max(2,Math.round(Math.hypot(x1-x0,z1-z0)/.42));
      for(let i=0;i<n;i++){
        const t0=i/n,t1=(i+1)/n;if(gap&&t0>gap[0]&&t1<gap[1])continue;
        const mx=(x0+(x1-x0)*(t0+t1)/2),mz=(z0+(z1-z0)*(t0+t1)/2),len=Math.hypot(x1-x0,z1-z0)/n,ang=-Math.atan2(z1-z0,x1-x0);
        const panel=box(g,len*.96,.19,.022,i%2?'#f5c04b':'#f7d36d',mx,base+.13,mz);panel.rotation.y=ang;panel.castShadow=false;
        const stripe=box(g,len*.96,.035,.026,'#d66a3a',mx,base+.2,mz,false);stripe.rotation.y=ang;
        const post=box(g,.03,.24,.03,'#9a7b5b',mx-Math.cos(ang)*len/2,base+.14,mz+Math.sin(ang)*len/2,false);post.castShadow=false;
      }
    };
    const h=S/2;
    fence(cx-h,cz-h,cx+h,cz-h);fence(cx-h,cz-h,cx-h,cz+h);fence(cx+h,cz-h,cx+h,cz+h);fence(cx-h,cz+h,cx+h,cz+h,[.38,.62]);
    // Gate posts and the sign.
    for(const gx of [cx-.2,cx+.2])box(g,.04,.3,.04,'#8a6d4e',gx,base+.17,cz+h,false);
    sign(g,'BUILDING SITE',cx,base+.43,cz+h+.02,.62);
    // The half-built house: slab, brick walls with window gaps, scaffold, rafters.
    const hx=cx-.55,hz=cz+.05;
    box(g,1.2,.07,.95,'#b9b6ae',hx,base+.05,hz);
    const brick=mat('#c8745f',.95),brickB=mat('#d98b72',.95);
    const wall=(w,d,x,z,lenFull)=>{
      const wallMesh=box(g,w,.3,d,brick,x,base+.25,z);
      for(let r=0;r<3;r++)box(g,w*(r===2?.55:1),.012,d*1.04,brickB,x-(r===2?w*.22:0),base+.15+r*.1,z,false);
    };
    wall(1.2,.07,hx,hz-.45);wall(.07,.95,hx-.58,hz);wall(.07,.62,hx+.58,hz-.15);
    wall(.45,.07,hx-.37,hz+.45);wall(.45,.07,hx+.37,hz+.45);   // front wall with a door gap
    box(g,.4,.04,.07,'#b9b6ae',hx,base+.1,hz+.45,false);
    // Scaffolding on the front: poles, ledgers and planks.
    for(const px of [-.62,-.2,.2,.62])cylinder(g,.012,.012,.78,'#c7ccd1',hx+px,base+.43,hz+.62).castShadow=false;
    for(const y of [.28,.5,.7])box(g,1.3,.014,.012,'#c7ccd1',hx,base+y,hz+.62,false);
    box(g,1.3,.025,.14,'#c99a64',hx,base+.5,hz+.55,false);box(g,1.3,.025,.14,'#c99a64',hx,base+.7,hz+.55,false);
    for(const px of [-.5,0,.5])box(g,.012,.4,.012,'#c7ccd1',hx+px,base+.5,hz+.62,false).rotation.z=px?.5*Math.sign(px):0;
    // Roof frame: a few rafters against the sky.
    for(let k=-2;k<=2;k++){const r=box(g,.025,.025,.72,'#d2a56e',hx+k*.26,base+.58,hz-.15,false);r.rotation.x=.0;}
    box(g,1.25,.025,.025,'#d2a56e',hx,base+.7,hz-.15,false);
    // Tower crane: lattice mast, slewing jib, counterweight, cab, hook and a swinging load.
    const kx=cx+1.05,kz=cz-.95,yellow=mat('#f2b632',.6),dark=mat('#4a4a4a',.7);
    box(g,.2,.06,.2,'#8d8d8d',kx,base+.04,kz);
    for(const [dx,dz] of [[-.07,-.07],[.07,-.07],[-.07,.07],[.07,.07]])box(g,.018,1.9,.018,yellow,kx+dx,base+.99,kz+dz,false);
    for(let k=0;k<9;k++){const y=base+.14+k*.2;box(g,.15,.012,.012,yellow,kx,y,kz-.07,false);box(g,.15,.012,.012,yellow,kx,y,kz+.07,false);box(g,.012,.012,.15,yellow,kx-.07,y,kz,false);box(g,.012,.012,.15,yellow,kx+.07,y,kz,false);}
    const slew=new THREE.Group();slew.position.set(kx,base+1.95,kz);g.add(slew);
    box(slew,.14,.12,.14,'#e8a62b',0,0,0);box(slew,.1,.1,.12,'#9cc4d4',.08,.03,0);
    box(slew,2.1,.035,.035,yellow,.85,.09,0,false);box(slew,.55,.035,.035,yellow,-.35,.09,0,false);
    for(let k=0;k<7;k++)box(slew,.012,.09,.012,yellow,-.05+k*.28,.05,0,false);
    box(slew,.2,.11,.1,'#6d6d6d',-.58,.03,0);
    const trolley=new THREE.Group();slew.add(trolley);trolley.position.set(1.2,.07,0);
    box(trolley,.05,.03,.05,dark,0,0,0,false);
    const cable=cylinder(trolley,.004,.004,1,'#3a3a3a',0,-.5,0);cable.castShadow=false;
    const hook=new THREE.Group();trolley.add(hook);
    box(hook,.06,.05,.05,'#d94b3a',0,0,0);
    const load=box(hook,.16,.1,.12,'#a97b5c',0,-.09,0);box(hook,.16,.012,.12,'#c99a64',0,-.14,0,false);
    site.slew=slew;site.trolley=trolley;site.cable=cable;site.hook=hook;site.load=load;site.kx=kx;site.kz=kz;
    // Cement mixer, brick pile, sand heap, pipes, cones, wheelbarrow.
    const mix=new THREE.Group();mix.position.set(cx+.75,base+.05,cz+.65);g.add(mix);
    const drum=cylinder(mix,.1,.07,.2,'#e8664d',0,.12,0);drum.rotation.z=.9;site.mixer=drum;
    box(mix,.04,.1,.2,'#555',0,.04,0,false);
    for(let r=0;r<3;r++)for(let c=0;c<4;c++)box(g,.07,.03,.035,brick,cx-1.2+c*.075,base+.035+r*.032,cz-.55-(r%2)*.01,false);
    const sand=ball(g,.2,mat('#e3cf9c',1),cx-1.0,base+.02,cz+.78);sand.scale.set(1,.5,.9);
    for(let k=0;k<5;k++)cylinder(g,.016,.016,.3,'#9aa3aa',cx+.75,base+.04+(k>2?.032:0),cz-.45+k*.034-(k>2?.1:0)).rotation.z=Math.PI/2;
    for(const [px,pz] of [[cx-.1,cz+h-.15],[cx+.1,cz+h-.15],[cx+h-.15,cz+.2],[cx-h+.2,cz-.9],[cx+.2,cz-.7],[cx-.95,cz+.4]]){
      cylinder(g,.012,.034,.09,'#ff7a2e',px,base+.065,pz).castShadow=false;box(g,.07,.01,.07,'#ff7a2e',px,base+.02,pz,false);
    }
    const barrow=new THREE.Group();barrow.position.set(cx-.15,base,cz+.55);barrow.rotation.y=.4;g.add(barrow);
    box(barrow,.14,.05,.1,'#7e8a95',0,.065,0);cylinder(barrow,.03,.03,.02,'#333',.09,.035,0).rotation.x=Math.PI/2;
    // Workers with yellow hard hats: one hammers, one carries bricks, one looks at the plans.
    site.workers=[];
    const spots=[{x:hx-.25,z:hz+.38,job:'hammer',face:-Math.PI/2*0+Math.PI},{x:hx+.3,z:hz+.35,job:'carry',a:[cx-1.15,cz-.4],b:[hx+.3,hz+.35]},{x:cx+.35,z:cz+.35,job:'plans',face:Math.PI*.7}];
    spots.forEach((sp,i)=>{
      const p=person({col:['#f08a4b','#6fb0d9','#f2d06b'][i],skin:['#d8a77c','#f1c9a5','#a8754f'][i],hair:'#333947',ph:i*2.3+1,x:i+9,y:i*3});
      p.scale.setScalar(.9*CUTE);g.add(p);
      const hat=ball(p.userData.limbs.headPivot,.118,mat('#ffd23f',.5),0,.07,0);hat.scale.set(1,.62,1);hat.position.y=.08+.0;
      ball(p.userData.limbs.headPivot,.03,mat('#ffd23f',.5),0,.14,0);
      const w={g:p,sp,x:sp.x,z:sp.z,ph:i*1.7,carry:false,job:sp.job,leg:0};p.position.set(w.x,base,w.z);p.rotation.y=sp.face||0;site.workers.push(w);
    });
    site.built=true;site.t=0;
  }
  function updateSite(dt){
    if(!site.built)return;
    site.t+=dt;const t=site.t;
    // Crane: the jib slowly swings, the trolley runs out and in, the load goes up and down.
    site.slew.rotation.y=Math.sin(t*(site.swing>0?.5:.12))*1.1+.5;
    const reach=.9+Math.sin(t*.21)*.35;site.trolley.position.x=reach;
    const drop=.55+Math.sin(t*.33)*.3;site.hook.position.y=-drop;site.cable.scale.y=drop;site.cable.position.y=-drop/2;
    site.load.rotation.y=Math.sin(t*.9)*.15;site.hook.rotation.z=Math.sin(t*.6)*.05;
    if(site.mixer)site.mixer.rotation.y+=dt*2.2;
    for(const w of site.workers){
      w.ph+=dt*6;const L=w.g.userData.limbs;let walking=false;
      if(w.job==='hammer'){
        const swing=Math.sin(w.ph*1.4);
        if(L){L.arms[1].rotation.x=-1.2+swing*.7;L.arms[0].rotation.x=-.5;L.elbows?.forEach(e=>{e.rotation.x=-.6;});}
      }else if(w.job==='carry'){
        w.leg=(w.leg||0)+dt*.12;const k=(Math.sin(w.leg*Math.PI*2)+1)/2,A=w.sp.a,B=w.sp.b;
        const nx=A[0]+(B[0]-A[0])*k,nz=A[1]+(B[1]-A[1])*k;walking=Math.hypot(nx-w.x,nz-w.z)>.0007;
        if(walking)w.g.rotation.y=Math.atan2(nx-w.x,nz-w.z);w.x=nx;w.z=nz;
        if(L){const a=walking?Math.sin(w.ph*1.5)*.55:0;L.legs?.forEach((l,j)=>{l.rotation.x=(j?1:-1)*a;});L.arms?.forEach(a2=>{a2.rotation.x=-.9;});}
      }else if(L){
        L.headPivot.rotation.x=-.25+Math.sin(w.ph*.15)*.1;L.arms[1].rotation.x=-.9;L.elbows?.forEach(e=>{e.rotation.x=-.9;});
      }
      w.g.position.set(w.x,.17+(walking?Math.abs(Math.sin(w.ph*1.5))*.01:0),w.z);
    }
  }

  /* ---- Extra life: a rowing boat on the river with a fisher on the bank, a playground with
     children, pigeon flocks that peck and scatter, and a kite flyer. Purely visual layer on free
     lawn (never on buildings or trees); the simulation is untouched. ---- */
  const life={t:0,built:false,boat:null,fisher:null,play:null,kite:null,birds:[],flock:{x:9,z:9.9},scatters:0,fish:0,catches:0};
  const ANIMAL_SCALE={dog:.5,hen:.62,penguin:.6,llama:.62,dino:.8,ghost:.7};
  function freeSpots(){
    const bs=town.buildings(),ps=town.props().filter(p=>!['flowers','duck','crane'].includes(p.kind));
    const cands=[];for(const bx of [2,7,12])for(const by of [2,7]) for(const [ox,oy] of [[1,1],[3,1],[1,3],[3,3],[2,2]])cands.push([bx+ox,by+oy]);
    const score=c=>{let m=9;for(const b of bs)m=Math.min(m,Math.hypot(b.x+(b.kind==='site'?1:.5)-c[0],b.y+(b.kind==='site'?1:.5)-c[1])-(b.kind==='site'?2:.75));
      for(const p of ps)m=Math.min(m,Math.hypot(p.x-c[0],p.y-c[1])-({stadium:1.65,stage:1.4,market:1.4,lab:1.2,zoo:1.4,launchpad:1.0}[p.kind]||.5));
      if(c[0]>6.7&&c[0]<11.3&&c[1]>6.7&&c[1]<11.3)m=-9;return m;};
    return cands.map(c=>({x:c[0],z:c[1],clear:score(c)})).sort((a,b)=>b.clear-a.clear);   // river row excluded: only lawns north of it
  }
  const sitPose=(p,y=-.05)=>{const L=p.userData.limbs;if(L){L.legs.forEach(l=>{l.rotation.x=-1.35;});}p.position.y+=y;};
  const kidOf=(i,col)=>{const p=person({col,skin:['#f1c9a5','#d8a77c','#a8754f','#7a4e33'][i%4],hair:i%2?'#49362d':'#333947',ph:i*1.9+.3,x:i+3,y:i*5});
    p.scale.setScalar(CUTE*.8);p.userData.limbs.headPivot.scale.setScalar(HEAD_BIG*1.08);return p;};
  function pointAlong(mesh,ax,ay,az,bx,by,bz){
    const dx=bx-ax,dy=by-ay,dz=bz-az,len=Math.hypot(dx,dy,dz)||.001;
    mesh.position.set((ax+bx)/2,(ay+by)/2,(az+bz)/2);mesh.rotation.order='YXZ';
    mesh.rotation.set(Math.atan2(Math.hypot(dx,dz),dy),Math.atan2(dx,dz),0);mesh.scale.y=len;
  }
  function createLife(){
    const g=new THREE.Group();world.add(g);life.built=true;life.t=0;life.birds=[];life.fish=0;
    const base=.17;
    // --- a rowing boat between the bridges, and a fisher on the north bank
    const boat=new THREE.Group();g.add(boat);boat.scale.setScalar(.82);   // small enough to row under the arches
    const hull=object(boat,geo('soft',.58,.1,.24,.05),mat('#f2a99b',.7),0,.2,0);
    box(boat,.5,.02,.19,'#fff0d8',0,.255,0,false);
    box(boat,.06,.07,.2,'#fff7e6',-.06,.27,0);   // thwart
    object(boat,geo('soft',.1,.1,.14,.04),mat('#f2a99b',.7),.3,.22,0);   // bow
    const oars=[];for(const s of [-1,1]){const o=new THREE.Group();o.position.set(.04,.3,s*.13);boat.add(o);cylinder(o,.007,.007,.34,'#c99a64',0,0,s*.17).rotation.x=Math.PI/2;box(o,.07,.012,.05,'#e7c28a',0,0,s*.34,false);oars.push({o,s});}
    const rower=kidOf(1,'#7fb3d9');rower.scale.setScalar(CUTE*.95);boat.add(rower);rower.position.set(-.04,.24,0);rower.rotation.y=-Math.PI/2*0+Math.PI/2;sitPose(rower,-.03);
    const guest=kidOf(2,'#f2c36b');guest.scale.setScalar(CUTE*.95);boat.add(guest);guest.position.set(-.22,.24,0);guest.rotation.y=Math.PI/2*-1+Math.PI;sitPose(guest,-.03);
    life.boat={g:boat,rower,guest,oars,x:7.5,dir:1,turn:0,z:14.0,hull};
    // fisher
    const fz=12.74,fx=(freeSpots().length?3.6:3.6);
    const f=person({col:'#e58f8f',skin:'#d8a77c',hair:'#333947',ph:4.2,x:3,y:9,hat:'cap'});f.scale.setScalar(CUTE*.95);g.add(f);f.position.set(fx,base,fz);f.rotation.y=0;sitPose(f,-.04);
    const rod=cylinder(g,.006,.006,.55,'#8a6d4e',fx+.08,base+.37,fz+.28);rod.rotation.x=.9;
    const line=cylinder(g,.002,.002,1,'#e8e8e8',fx,base+.2,fz+.5);
    const bob=ball(g,.016,mat('#ff5b4d',.5),fx+.08,.2,fz+.62);
    const fish=ball(g,.03,mat('#ffb04a',.5),fx+.1,-1,fz+.6);fish.scale.set(1.6,.8,.7);
    life.fisher={p:f,rod,line,bob,fish,x:fx,z:fz,next:6,cast:0,bite:-1};
    // --- playground and kite on the two freest lawns
    const spots=freeSpots().filter(s=>s.clear>.6);
    const P=spots[0];
    if(P){
      const px=P.x,pz=P.z,sand=object(g,geo('cylinder',1,1,.02),mat('#ddd5c0',1),px,base+.012,pz,false);sand.scale.set(.95,1,.95);
      const kerb=object(g,new THREE.TorusGeometry(.95,.016,6,28),mat('#caa77d',.9),px,base+.03,pz,false);kerb.rotation.x=Math.PI/2;
      // swing set
      const sw=new THREE.Group();sw.position.set(px-.35,base,pz-.3);g.add(sw);
      for(const s of [-1,1]){cylinder(sw,.026,.029,.62,'#a38460',s*.28,.3,-.08).rotation.x=.25;cylinder(sw,.026,.029,.62,'#a38460',s*.28,.3,.08).rotation.x=-.25;}
      cylinder(sw,.027,.027,.6,'#a38460',0,.58,0).rotation.z=Math.PI/2;
      const swings=[];for(const s of [-.12,.12]){const pv=new THREE.Group();pv.position.set(s,.58,0);sw.add(pv);for(const dx of [-.045,.045])cylinder(pv,.005,.005,.3,'#5d6661',dx,-.15,0);box(pv,.125,.022,.105,'#6f8c79',0,-.3,0);
        const kid=kidOf(swings.length+3,['#c39be0','#9ccf9a'][swings.length]);pv.add(kid);kid.position.set(0,-.34,0);sitPose(kid,.08);kid.rotation.y=Math.PI/2*0;swings.push({pv,kid});}
      // seesaw
      const ss=new THREE.Group();ss.position.set(px+.3,base+.07,pz+.5);g.add(ss);
      object(ss,new THREE.ConeGeometry(.09,.14,3),mat('#8e9b85'),0,-.01,0,false);const plank=new THREE.Group();plank.position.y=.05;ss.add(plank);box(plank,.7,.032,.12,'#a18a65',0,0,0);
      for(const dx of [-.27,.27]){box(plank,.13,.022,.15,'#718c77',dx,.027,0);cylinder(plank,.009,.009,.08,'#6b7466',dx,.07,-.04);}
      const ks=[];for(const s of [-1,1]){const k=kidOf(s>0?5:6,s>0?'#f08a4b':'#6fb0d9');plank.add(k);k.position.set(s*.27,.02,0);k.rotation.y=s>0?-Math.PI/2:Math.PI/2;sitPose(k,-.04);ks.push(k);}
      // slide
      const sl=new THREE.Group();sl.position.set(px+.45,base,pz-.45);sl.rotation.y=-.6;g.add(sl);
      box(sl,.2,.03,.2,'#f5c04b',0,.34,0);for(const dx of [-.09,.09])for(const dz of [-.09,.09])cylinder(sl,.01,.01,.34,'#e8664d',dx,.17,dz);
      const ramp=box(sl,.17,.025,.5,'#829ba1',0,.17,.35);ramp.rotation.x=.62;
      for(let k=0;k<5;k++)box(sl,.12,.012,.016,'#e8664d',0,.04+k*.07,-.115,false);
      for(const dx of [-.105,.105]){
        const rail=cylinder(sl,.009,.009,1,'#b58c61');pointAlong(rail,dx,.42,.10,dx,.09,.60);
        cylinder(sl,.012,.012,.38,'#a38460',dx,.19,-.15);
      }
      const sk=kidOf(7,'#e58f8f');sl.add(sk);
      life.play={swings,ks,plank,sl,sk,x:px,z:pz};
    }
    const K=spots.find(s=>!P||Math.hypot(s.x-P.x,s.z-P.z)>3);
    if(K){
      const kid=kidOf(8,'#f2d06b');g.add(kid);kid.position.set(K.x,base,K.z);
      const kite=new THREE.Group();g.add(kite);
      const dia=box(kite,.26,.26,.012,'#ff6f91',0,0,0,false);dia.rotation.z=Math.PI/4;box(kite,.012,.36,.016,'#fff0d8',0,0,.01,false);box(kite,.36,.012,.016,'#fff0d8',0,0,.01,false);
      const tail=[];for(let i=0;i<5;i++){const t=box(kite,.05,.03,.012,['#f5c04b','#6fb0d9','#9ccf9a'][i%3],0,-.22-i*.09,0,false);tail.push(t);}
      const string=cylinder(g,.0025,.0025,1,'#f4f0e6',K.x,1,K.z);
      life.kite={kid,kite,tail,string,x:K.x,z:K.z};
    }
    // --- pigeons around the piazza apron (or the freest lawn)
    const fl=spots.length>2?spots[Math.min(2,spots.length-1)]:{x:9,z:10.3};life.flock={x:fl.x,z:fl.z};
    for(let i=0;i<7;i++){
      const b=new THREE.Group();g.add(b);const grey=['#9aa3ad','#b3b9c0','#868e99'][i%3];
      const body=ball(b,.04,mat(grey,.8),0,.05,0);body.scale.set(1.5,1,1);ball(b,.026,mat('#7d8791',.7),.06,.075,0);
      box(b,.03,.012,.016,'#e0a560',.09,.07,0,false);
      const wings=[];for(const s of [-1,1]){const w=new THREE.Group();w.position.set(0,.06,s*.03);b.add(w);box(w,.05,.008,.06,mat(grey,.8),-.02,0,s*.03,false);wings.push({w,s});}
      const bird={g:b,wings,x:life.flock.x+(i%4-1.5)*.35,z:life.flock.z+(Math.floor(i/4)-.5)*.4,y:0,state:'peck',t:i*.7,from:null,to:null,dur:1,peck:0};
      b.position.set(bird.x,base,bird.z);life.birds.push(bird);
    }
  }
  function scatterBirds(x,z,r){
    let n=0;for(const b of life.birds)if(b.state==='peck'&&Math.hypot(b.x-x,b.z-z)<r){
      const a=Math.random()*TAU,d=1.4+Math.random()*1.6;
      b.state='fly';b.t=0;b.dur=1.2+Math.random()*.8;b.from={x:b.x,z:b.z};b.to={x:life.flock.x+Math.cos(a)*d,z:life.flock.z+Math.sin(a)*d};n++;}
    if(n){life.scatters++;sound('chirp');}return n;
  }
  function updateLife(dt){
    if(!life.built)return;
    life.t+=dt;const t=life.t,base=.17;
    // boat
    const B=life.boat;
    if(B){
      const speed=.32;
      if(B.turn>0){B.turn-=dt;B.g.rotation.y+=Math.PI/2*dt*(B.dir>0?-1:1)*0+(Math.PI/2.4)*dt*B.spin;if(B.turn<=0){B.g.rotation.y=B.dir>0?0:Math.PI;}}
      else{B.x+=B.dir*speed*dt;if(B.x>14.2&&B.dir>0||B.x<3.8&&B.dir<0){B.dir*=-1;B.turn=2.4;B.spin=1;}}
      const bob=Math.sin(t*1.7)*.008;B.g.position.set(B.x,bob,B.z+Math.sin(t*.4)*.12);
      const stroke=Math.sin(t*2.2);
      for(const {o,s} of B.oars)o.rotation.y=stroke*.45*s*-1;
      const L=B.rower.userData.limbs;if(L){L.arms.forEach(a=>{a.rotation.x=-.9+stroke*.35;});}
      const G=B.guest.userData.limbs;if(G){G.arms[1].rotation.z=-1.9+Math.sin(t*5)*.4;G.arms[1].rotation.x=0;}
    }
    // fisher
    const F=life.fisher;
    if(F){
      F.bob.position.y=.2+Math.sin(t*2.1)*.004;
      pointAlong(F.line,F.x+.08,.17+.34,F.z+.28+.2,F.x+.08,.2,F.z+.62);
      if(t>F.next&&F.bite<0){F.bite=0;F.next=t+14+Math.random()*10;}
      if(F.bite>=0){F.bite+=dt;const k=F.bite;
        F.rod.rotation.x=.9-Math.sin(Math.min(k,1.2)*Math.PI/1.2)*.5;F.bob.position.y=.2-Math.max(0,Math.sin(k*9))*.025;
        if(k>1.2){const u=Math.min(1,(k-1.2)/1.1);F.fish.position.set(F.x+.1,.2+Math.sin(u*Math.PI)*.45,F.z+.6-u*.4);F.fish.rotation.z=u*Math.PI*2;
          if(k>1.25&&!F.said){F.said=true;life.catches++;showBubble(F.p,['Got one!','A big one!','Look at that!'][life.catches%3],2200);}
          if(u>=1){F.bite=-1;F.said=false;F.fish.position.y=-1;F.rod.rotation.x=.9;}}
      }
    }
    // playground
    const P=life.play;
    if(P){
      if(P.cheer>0)P.cheer-=dt;const amp=P.cheer>0?1.1:.7;P.swings.forEach((s,i)=>{s.pv.rotation.x=Math.sin(t*(P.cheer>0?2.6:1.7)+i*1.3)*amp;});
      P.plank.rotation.z=Math.sin(t*1.3)*.22;
      // slide kid: climb the ladder, slide down, walk round again (14 s loop)
      const u=(t%14)/14,k=P.sk;
      if(u<.45){const v=u/.45;k.position.set(-.05,.04+v*.3,-.12);k.rotation.y=Math.PI;}
      else if(u<.62){const v=(u-.45)/.17;k.position.set(0,.36-v*.2,.05+v*.5);k.rotation.y=0;sitPose(k,0);}
      else{const v=(u-.62)/.38;k.position.set(.25-.25*(1-v)*0-v*.3+.0,0,.55-v*.7);k.rotation.y=v<.5?Math.PI:Math.PI;}
      const L=k.userData.limbs;if(L&&!(u>=.45&&u<.62))L.legs.forEach((l,j)=>{l.rotation.x=(j?1:-1)*Math.sin(t*8)*.5;});
    }
    // kite
    const K=life.kite;
    if(K){
      const lp=K.loop>0?(K.loop-=dt,Math.sin(t*5)*.6):0,kx=K.x+1.1+Math.sin(t*.5)*.25+lp,ky=1.45+Math.sin(t*.7)*.15+Math.abs(lp)*.5+(windNow()?.35:0),kz=K.z-.9+Math.cos(t*.4)*.2;
      K.kite.position.set(kx,ky,kz);K.kite.rotation.z=Math.sin(t*.8)*.25;K.kite.rotation.y=.5;
      K.tail.forEach((s,i)=>{s.position.x=Math.sin(t*2-i*.7)*.04*(i+1)*.5;});
      pointAlong(K.string,K.x+.05,base+.28,K.z-.04,kx,ky-.1,kz);
      const L=K.kid.userData.limbs;if(L){L.arms[1].rotation.x=-2.4;L.arms[1].rotation.z=-.1;}
      K.kid.rotation.y=Math.atan2(kx-K.x,kz-K.z);
    }
    // pigeons: peck, and scatter when anyone comes close
    const movers=town.movers();
    for(const b of life.birds){
      if(b.state==='peck'){
        b.t+=dt;b.g.rotation.y=Math.sin(b.t*.3+b.x)*2;const dip=Math.max(0,Math.sin(b.t*3.2+b.x*5));b.g.children[1].position.y=.075-dip*.04;
        b.g.position.set(b.x,base,b.z);
        for(const m of movers){if((m.type==='person'||m.kind==='bike')&&Math.hypot(m.x-b.x,m.y-b.z)<.5&&(m.v||0)>.15){scatterBirds(b.x,b.z,.9);break;}}
      }else{
        b.t+=dt;const u=Math.min(1,b.t/b.dur);b.x=b.from.x+(b.to.x-b.from.x)*u;b.z=b.from.z+(b.to.z-b.from.z)*u;
        b.g.position.set(b.x,base+Math.sin(u*Math.PI)*.55,b.z);b.g.rotation.y=Math.atan2(b.to.x-b.from.x,b.to.z-b.from.z)-Math.PI/2;
        const fl=Math.sin(b.t*34);for(const w of b.wings)w.w.rotation.x=fl*.9*w.s;
        if(u>=1){b.state='peck';b.t=0;for(const w of b.wings)w.w.rotation.x=0;}
      }
    }
  }

  /* ---- Six more kinds of life: a lamplighter who lights the street lamps one by one at dusk, a little
     parade with confetti, seagulls over the river, a market-day crowd at the stalls, and fireworks
     after dark. (The goods train is part of the railway.) Pooled meshes, no extra lights. ---- */
  const more={t:0,built:false,phase:'day',sawDay:false,lamp:null,parade:null,nextParade:40,paradesRun:0,gulls:[],crowd:[],fw:[],nextFw:6,bursts:0,tour:[],lit:0};
  const lanterns=[];
  const paradeColors=['#e2463a','#ffd23f','#3f8fd6','#ff8fd0','#5aa469','#ffffff'];
  function confettiAt(x,y,z,n=22){
    const parts=[];
    for(let k=0;k<n;k++){const m=box(world,.045,.006,.03,paradeColors[k%paradeColors.length],x,y,z,false);m.castShadow=false;
      m.userData.v=[(Math.random()-.5)*1.1,.9+Math.random()*1.0,(Math.random()-.5)*1.1];m.userData.spin=Math.random()*8;parts.push(m);}
    effects.push({t:0,life:3.6,parts,tick(e,dt){for(const m of parts){const v=m.userData.v;v[1]-=dt*2.2;m.position.x+=v[0]*dt;m.position.z+=v[2]*dt;
      m.position.y=Math.max(.19,m.position.y+v[1]*dt);if(m.position.y<=.19){v[0]*=.9;v[2]*=.9;}m.rotation.x+=m.userData.spin*dt;m.rotation.z+=m.userData.spin*.7*dt;}}});
  }
  function walkAnim(p,moving,ph){const L=p.userData.limbs;if(!L)return;const a=moving?Math.sin(ph*1.5)*.55:0;L.legs.forEach((l,k)=>{l.rotation.x=(k?1:-1)*a;});if(moving)L.arms.forEach((l,k)=>{l.rotation.x=(k?-1:1)*a*.7;});}
  /* ---- Fireworks. A rocket climbs with a trail of sparks, then bursts into a few hundred particles that slow with air
     drag, fall under gravity, twinkle and fade: round peonies, drooping golden willows and flat rings. All particles live in
     one additive Points object (the simulation also runs without one, for the headless tests). A brief glow marks each burst. ---- */
  const fwSys={n:1400,pts:null,pos:null,col:null,vel:null,base:null,age:null,life:null,kind:null,trail:null,cursor:0,active:0,rockets:[],flashes:[],queue:[],bursts:{peony:0,willow:0,ring:0}};
  const FW_COLOURS=['#ff4f5e','#ffd23f','#58c7ff','#7dff8a','#ffffff','#ff9f43','#c77dff'];
  const fwRgb=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
  function fwInit(g){
    const n=fwSys.n;fwSys.pos=new Float32Array(n*3);fwSys.col=new Float32Array(n*3);fwSys.vel=new Float32Array(n*3);fwSys.base=new Float32Array(n*3);
    fwSys.age=new Float32Array(n).fill(9);fwSys.life=new Float32Array(n).fill(0);fwSys.kind=new Uint8Array(n);fwSys.trail=new Float32Array(n);
    fwSys.cursor=0;fwSys.active=0;fwSys.rockets=[];fwSys.flashes=[];fwSys.queue=[];fwSys.pts=null;
    for(let i=0;i<n;i++)fwSys.pos[i*3+1]=-50;
    if(THREE.Points&&THREE.BufferGeometry&&THREE.BufferAttribute&&typeof document!=='undefined'){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(fwSys.pos,3));geometry.setAttribute('color',new THREE.BufferAttribute(fwSys.col,3));
      const c=document.createElement('canvas');c.width=c.height=64;const p=c.getContext('2d'),gr=p.createRadialGradient(32,32,0,32,32,32);
      gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.75)');gr.addColorStop(.6,'rgba(255,255,255,.18)');gr.addColorStop(1,'rgba(255,255,255,0)');p.fillStyle=gr;p.fillRect(0,0,64,64);
      const pts=new THREE.Points(geometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(c),size:.26,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));
      pts.frustumCulled=false;g.add(pts);fwSys.pts=pts;
    }
    // soft flashes, one per burst in flight
    for(let k=0;k<3;k++){
      const m=new THREE.Mesh(geo('sphere',.5),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
      m.frustumCulled=false;m.visible=false;g.add(m);fwSys.flashes.push({m,t:9,x:0,y:0,z:0,col:'#ffffff'});
    }
  }
  function fwEmit(x,y,z,vx,vy,vz,life,rgb,kind,trail=0){
    const S=fwSys,n=S.n;
    for(let k=0;k<n;k++){
      const i=(S.cursor+k)%n;
      if(S.age[i]<S.life[i])continue;
      S.cursor=(i+1)%n;S.age[i]=0;S.life[i]=life;S.kind[i]=kind;S.trail[i]=trail;
      S.pos[i*3]=x;S.pos[i*3+1]=y;S.pos[i*3+2]=z;S.vel[i*3]=vx;S.vel[i*3+1]=vy;S.vel[i*3+2]=vz;
      S.base[i*3]=rgb[0];S.base[i*3+1]=rgb[1];S.base[i*3+2]=rgb[2];S.active++;return i;
    }
    return -1;
  }
  function fwBurst(x,y,z,pattern,colHex){
    const S=fwSys,main=fwRgb(colHex),white=[1,1,1],gold=[1,.78,.4];
    S.bursts[pattern]++;
    if(pattern==='willow'){
      for(let i=0;i<105;i++){const a=Math.random()*TAU,u=Math.random()*2-1,r=Math.sqrt(1-u*u),sp=1.25+Math.random()*.5;
        fwEmit(x,y,z,Math.cos(a)*r*sp,u*sp*.85,Math.sin(a)*r*sp,1.9+Math.random()*.5,Math.random()<.85?gold:white,3,.55);}
    }else if(pattern==='ring'){
      const nx=Math.random()*2-1,ny=Math.random()*2-1,nz=Math.random()*2-1,nl=Math.hypot(nx,ny,nz)||1;
      let ux=-ny,uy=nx,uz=0;const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;
      const vx=(ny/nl)*uz-(nz/nl)*uy,vy=(nz/nl)*ux-(nx/nl)*uz,vz=(nx/nl)*uy-(ny/nl)*ux;
      for(let i=0;i<84;i++){const a=i/84*TAU,sp=2.05+Math.random()*.1,c=Math.cos(a),sn=Math.sin(a);
        fwEmit(x,y,z,(ux*c+vx*sn)*sp,(uy*c+vy*sn)*sp,(uz*c+vz*sn)*sp,1.5+Math.random()*.3,i%2?main:white,0,.12);}
    }else{
      const second=fwRgb(FW_COLOURS[Math.floor(Math.random()*FW_COLOURS.length)]);
      for(let i=0;i<165;i++){const a=Math.random()*TAU,u=Math.random()*2-1,r=Math.sqrt(1-u*u),sp=1.95+Math.random()*.5;
        fwEmit(x,y,z,Math.cos(a)*r*sp,u*sp,Math.sin(a)*r*sp,1.6+Math.random()*.6,Math.random()<.22?second:Math.random()<.12?white:main,0,.14);}
    }
    // the bright flash of the burst
    const f=fwSys.flashes.find(q=>q.t>=.3)||fwSys.flashes[0];f.t=0;f.x=x;f.y=y;f.z=z;f.m.material.color.set?.(colHex);f.m.position.set(x,y,z);f.m.visible=true;
    sound('firework');
  }
  function fwLaunch(x,z){
    const colHex=FW_COLOURS[Math.floor(Math.random()*FW_COLOURS.length)],r=Math.random();
    fwSys.rockets.push({x,y:.3,z,vy:3.4+Math.random()*.5,vx:(Math.random()-.5)*.1,vz:(Math.random()-.5)*.1,peak:3.3+Math.random()*1.3,col:colHex,pattern:r<.2?'ring':r<.5?'willow':'peony'});
    sound('whistle');
  }
  function fwStep(dt,t){
    const S=fwSys;
    for(const q of S.queue.slice()){q.at-=dt;if(q.at<=0){S.queue.splice(S.queue.indexOf(q),1);fwLaunch(q.x,q.z);}}
    for(const R of S.rockets.slice()){
      R.vy-=1.5*dt;R.x+=R.vx*dt;R.y+=R.vy*dt;R.z+=R.vz*dt;
      for(let k=0;k<3;k++)fwEmit(R.x,R.y,R.z,(Math.random()-.5)*.14,-.18-Math.random()*.2,(Math.random()-.5)*.14,.35+Math.random()*.35,Math.random()<.5?[1,.72,.35]:[1,.55,.2],1);
      fwEmit(R.x,R.y,R.z,0,0,0,.07,[1,.95,.85],2);
      if(R.vy<.5||R.y>=R.peak){S.rockets.splice(S.rockets.indexOf(R),1);fwBurst(R.x,R.y,R.z,R.pattern,R.col);more.bursts++;}
    }
    const col=S.col,pos=S.pos,vel=S.vel,base=S.base;
    for(let i=0;i<S.n;i++){
      if(S.age[i]>=S.life[i]){if(S.life[i]>0){S.life[i]=0;S.age[i]=9;pos[i*3+1]=-50;col[i*3]=col[i*3+1]=col[i*3+2]=0;S.active--;}continue;}
      const k=S.kind[i];S.age[i]+=dt;
      if(S.age[i]>=S.life[i]){S.life[i]=0;S.age[i]=9;pos[i*3+1]=-50;col[i*3]=col[i*3+1]=col[i*3+2]=0;S.active--;continue;}
      const u=S.age[i]/S.life[i];
      if(k!==2){
        const drag=Math.exp(-(k===0?1.15:k===3?1.5:2.4)*dt);vel[i*3]*=drag;vel[i*3+1]=vel[i*3+1]*drag-(k===3?1.25:k===0?.78:.2)*dt;vel[i*3+2]*=drag;
        pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt;
        if((k===0||k===3)&&S.trail[i]>0&&Math.random()<S.trail[i]*dt*18&&u<.8)fwEmit(pos[i*3],pos[i*3+1],pos[i*3+2],vel[i*3]*.08,vel[i*3+1]*.08,vel[i*3+2]*.08,.26+Math.random()*.1,[base[i*3]*.8,base[i*3+1]*.7,base[i*3+2]*.6],1);
      }
      let b=Math.pow(1-u,k===1?1.1:1.5);
      if((k===0||k===3)&&u>.5)b*=.55+.45*Math.sin(t*41+i*1.9);   // twinkle as they die
      if(k===0&&u<.12)b*=1.5;                                   // a hot start
      col[i*3]=base[i*3]*b;col[i*3+1]=base[i*3+1]*b;col[i*3+2]=base[i*3+2]*b;
    }
    for(const f of S.flashes){if(f.t>=.3){f.m.visible=false;continue;}f.t+=dt;const q=f.t/.3;f.m.material.opacity=.2*(1-q)*(1-q);f.m.scale.setScalar(.7+q*1.5);}   // a soft local glow: it used to be a 3-unit white sphere that flashed the whole phone screen
    if(S.pts){S.pts.geometry.attributes.position.needsUpdate=true;S.pts.geometry.attributes.color.needsUpdate=true;}
  }
  function createMore(){
    const g=new THREE.Group();world.add(g);more.built=true;more.t=0;more.gulls=[];more.crowd=[];more.fw=[];fwSys.pts=null;more.parade=null;more.lamp=null;
    const base=.17;
    // --- the lamplighter (hidden until dusk) and the order he visits the lamps in
    const p=person({col:'#7a6a9a',skin:'#d8a77c',hair:'#333947',ph:7.7,x:5,y:5,hat:'cap'});p.scale.setScalar(CUTE*1.05);g.add(p);p.visible=false;p.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);
    const pole=new THREE.Group();p.add(pole);pole.position.set(.1,.3,.1);cylinder(pole,.008,.008,.95,'#8a6d4e',0,.4,0);const flame=ball(pole,.03,mat('#ffb45e',.4,'#ffb45e'),0,.9,0);
    more.lamp={p,pole,flame,x:1.4,z:.6,i:0,wait:0,ph:0,route:[],moving:false,done:false};
    const rest=lanterns.slice(),tour=[];let cx=1.4,cz=.6;
    while(rest.length){let bi=0,bd=1e9;rest.forEach((l,i)=>{const d=Math.abs(l.x-cx)+Math.abs(l.z-cz)+(l.along===tour[tour.length-1]?.along?0:.4);if(d<bd){bd=d;bi=i;}});const l=rest.splice(bi,1)[0];tour.push(l);cx=l.x;cz=l.z;}
    more.tour=tour;
    // --- seagulls: lazy circles over the river, now and then perching on a bridge rail
    for(let i=0;i<4;i++){
      const b=new THREE.Group();g.add(b);
      const body=ball(b,.045,mat('#fbfbf8',.8),0,0,0);body.scale.set(1.6,.9,.9);ball(b,.028,mat('#fbfbf8',.8),.07,.03,0);box(b,.03,.012,.016,'#f2a23a',.11,.025,0,false);
      box(b,.05,.012,.02,'#9aa3ad',-.08,.0,0,false);
      const wings=[];for(const s of [-1,1]){const w=new THREE.Group();w.position.set(0,.02,s*.035);b.add(w);box(w,.05,.008,.13,mat('#eef0f2',.8),0,0,s*.065,false);box(w,.04,.009,.04,'#5b636d',0,0,s*.14,false);wings.push({w,s});}
      b.scale.setScalar(.62);   // gulls are small birds, smaller than the people
      more.gulls.push({g:b,wings,ph:i*1.57,rx:5.5+i*.8,rz:1.0+i*.12,cx:9+(i%2?-1.5:1.5),perch:null,perchT:0,x:0,z:0,state:'fly'});
    }
    // --- the market-day crowd: shoppers browsing the stalls
    const stalls=town.props().filter(q=>q.kind==='district-scene').slice(0,4);
    stalls.forEach((st,si)=>{for(let k=0;k<2;k++){
      const sh=person({col:['#e58f8f','#7fb3d9','#f2c36b','#9ccf9a','#c39be0','#f0a574','#f08a4b','#6fb0d9'][(si*2+k)%8],skin:['#f1c9a5','#d8a77c','#a8754f','#7a4e33'][(si+k)%4],hair:k?'#49362d':'#333947',ph:si*2.3+k*1.1+.5,x:si+k,y:si*3+k,bag:k===1});
      sh.scale.setScalar(CUTE);sh.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);g.add(sh);
      const hx=st.x+(k?.4:-.4),hz=st.y+.62;sh.position.set(hx,base,hz);sh.rotation.y=Math.PI;
      more.crowd.push({p:sh,x:hx,z:hz,ph:si+k,phase:k*2.1});}});
    fwInit(g);   // fireworks: rockets, bursts, trails (see the fireworks block above createMore)
  }
  function lampRoute(from,to){
    const pts=[],H=l=>l.along;let cur={x:from.x,z:from.z};
    const hA=from.along,hB=to.along;
    if(hA!==undefined&&hB!==undefined&&hA===hB&&from.line===to.line)pts.push([to.x,to.z]);
    else if(hA!==undefined&&hB!==undefined&&hA!==hB){pts.push(hA?[to.x,from.z]:[from.x,to.z]);pts.push([to.x,to.z]);}
    else{   // two different roads running the same way: go round by the nearest crossing street
      let best=1.5,bd=1e9;for(const l of LINES){const v=l+.5,d=Math.abs(from.x-v)+Math.abs(to.x-v);if(d<bd){bd=d;best=v;}}
      if(hA){pts.push([best,from.z],[best,to.z],[to.x,to.z]);}else{pts.push([from.x,best],[to.x,best],[to.x,to.z]);}
    }
    return pts;
  }
  function startParade(){
    if(more.parade)return false;
    const g=new THREE.Group();world.add(g);const base=.17,z=1.5+.43;
    const members=[];
    const mk=(i,col,role)=>{const q=person({col,skin:['#f1c9a5','#d8a77c','#a8754f','#7a4e33'][i%4],hair:i%2?'#49362d':'#333947',ph:i*1.7+.2,x:i+2,y:i*4,hat:role==='band'?'cap':null});if(wetNow())umbrellaFor(q,{ph:i});
      q.scale.setScalar(CUTE*(role==='kid'?.8:1));q.userData.limbs.headPivot.scale.setScalar(HEAD_BIG*(role==='kid'?1.08:1));g.add(q);return q;};
    const leader=mk(1,'#e2463a','band');const flag=new THREE.Group();leader.add(flag);flag.position.set(.12,.2,.08);cylinder(flag,.008,.008,.85,'#8a6d4e',0,.42,0);const cloth=box(flag,.28,.17,.01,'#ffd23f',.15,.72,0,false);
    members.push({q:leader,off:0,role:'flag',cloth});
    const drummer=mk(2,'#3f8fd6','band');const drum=cylinder(drummer,.1,.1,.1,'#e58f8f',0,.22,.16);drum.rotation.x=Math.PI/2*0;members.push({q:drummer,off:-.55,role:'drum'});
    const horn=mk(3,'#5aa469','band');const hornM=cylinder(horn,.02,.045,.2,'#e8c15a',.1,.4,.14);hornM.rotation.x=1.2;members.push({q:horn,off:-1.1,role:'horn'});
    for(let k=0;k<2;k++){const kid=mk(4+k,['#ff8fd0','#ffd23f'][k],'kid');const bal=ball(kid,.1,mat(['#e2463a','#3f8fd6'][k],.4),.1,.85,0);cylinder(kid,.003,.003,.45,'#5b5b5b',.1,.62,0);members.push({q:kid,off:-1.65-k*.5,role:'kid',bal,k});}
    // the float
    const fl=new THREE.Group();g.add(fl);box(fl,.7,.08,.3,'#f2a99b',0,.1,0);const wheels=[];for(const x of [-.25,.25])for(const zz of [-1,1]){const w=new THREE.Group();w.position.set(x,.05,zz*.16);fl.add(w);const t=cylinder(w,.05,.05,.03,'#4f5560');t.rotation.x=Math.PI/2;wheels.push(w);}
    for(const x of [-.3,.3])cylinder(fl,.012,.012,.42,'#8a6d4e',x,.32,0);const arch=new THREE.Mesh(new THREE.TorusGeometry(.3,.025,6,18,Math.PI),mat('#9ccf9a',.8));arch.position.set(0,.5,0);fl.add(arch);
    for(let k=0;k<7;k++)ball(fl,.04,mat(paradeColors[k%6],.6),-.28+k*.093,.52+Math.sin(k/6*Math.PI)*.22,0);
    const waver=mk(7,'#c39be0','kid');fl.add(waver);waver.position.set(0,.14,0);waver.userData.limbs.legs.forEach(l=>{l.rotation.x=-1.3;});waver.position.y=.1;
    members.push({q:waver,off:-3.0,role:'float',fl,wheels});members[members.length-1].q=waver;
    more.parade={g,members,fl,x:.9,z,done:false,confettiAt:2,t0:more.t};
    members.forEach(m=>{(m.role==='float'?m.fl:m.q).position.set(more.parade.x+m.off,m.role==='float'?base:base,z);});
    sound('chime');more.paradesRun++;
    return true;
  }
  function burstFirework(x,y,z){
    const r=Math.random();fwBurst(x,y,z,r<.2?'ring':r<.5?'willow':'peony',FW_COLOURS[more.bursts++%FW_COLOURS.length]);return true;
  }
  function updateMore(dt,dark){
    if(!more.built)return;
    more.t+=dt;const t=more.t,base=.17;
    // lamps: the lamplighter walks the town at dusk; on arrival each lamp comes on; at dawn they all go out
    if(dark<.05)more.sawDay=true;
    if(more.phase==='day'&&dark>.12){
      if(!more.sawDay||!more.lamp){more.phase='night';for(const l of lanterns)l.lit=true;}
      else{more.phase='lighting';const L=more.lamp,f=more.tour[0];L.i=0;L.x=f.along?1.6:f.x;L.z=f.along?f.z:1.6;L.target={x:L.x,z:L.z,along:f.along,line:f.line,lit:true};L.route=[];L.moving=false;L.done=false;L.p.visible=true;L.wait=0;}
    }
    if(more.phase!=='day'&&dark<.07){more.phase='day';for(const l of lanterns)l.lit=false;if(more.lamp)more.lamp.p.visible=false;}
    if(more.phase==='lighting'){
      const L=more.lamp;L.ph+=dt*6;
      if(L.wait>0){L.wait-=dt;L.pole.rotation.x=-Math.min(1,(1-L.wait/.7))*1.1;if(L.wait<=.4&&L.target&&!L.target.lit){L.target.lit=true;more.lit++;}if(L.wait<=0){L.pole.rotation.x=0;}walkAnim(L.p,false,L.ph);}
      else if(L.route.length){
        const [tx,tz]=L.route[0],dx=tx-L.x,dz=tz-L.z,d=Math.hypot(dx,dz);
        if(d<.03)L.route.shift();else{const s=Math.min(d,2.4*dt);L.x+=dx/d*s;L.z+=dz/d*s;L.p.rotation.y=Math.atan2(dx,dz);walkAnim(L.p,true,L.ph);}
        L.pole.rotation.x=0;
      }else if(L.target&&!L.target.lit){L.wait=.7;}
      else if(L.i<more.tour.length){const next=more.tour[L.i++];L.route=lampRoute(L.target||{x:L.x,z:L.z,along:undefined,line:undefined},next);L.target=next;if(!L.route.length)L.route=[[next.x,next.z]];}
      else{more.phase='night';L.p.visible=false;}
      L.p.position.set(L.x,base+(L.route.length?Math.abs(Math.sin(L.ph*1.5))*.01:0),L.z);
    }
    for(const l of lanterns){
      l.k+=((l.lit&&dark>.12?1:0)-l.k)*Math.min(1,dt*3);
      l.mat.emissiveIntensity=.1+dark*4.2*l.k;l.pool.material.opacity=Math.min(1,Math.max(0,dark-.12)*1.3)*l.k;
    }
    // parade
    if(!more.parade&&t>more.nextParade&&dark<.4&&weatherKind!=='storm')startParade();
    const P=more.parade;
    if(P){
      const speed=.5;P.x+=speed*dt;
      for(const m of P.members){
        const x=P.x+m.off,ph=t*7+m.off*3;
        if(m.role==='float'){m.fl.position.set(x,base,P.z-.02);m.wheels.forEach(w=>{w.rotation.z-=speed*dt/.05;});const L=m.q.userData.limbs;if(L){L.arms[1].rotation.z=-1.8+Math.sin(t*5)*.4;}}
        else{m.q.position.set(x,base+Math.abs(Math.sin(ph*1.5))*.012,P.z);m.q.rotation.y=Math.PI/2;walkAnim(m.q,true,ph);
          const L=m.q.userData.limbs;if(m.role==='drum'&&L){L.arms[0].rotation.x=-.9+Math.sin(t*9)*.5;L.arms[1].rotation.x=-.9-Math.sin(t*9)*.5;}
          if(m.role==='horn'&&L){L.arms[1].rotation.x=-1.7;L.arms[0].rotation.x=-1.2;}
          if(m.role==='flag'){m.cloth.rotation.y=Math.sin(t*4)*.3;if(L)L.arms[1].rotation.x=-.6;}
          if(m.role==='kid'&&L){m.bal.position.y=.85+Math.sin(t*2+m.k)*.03;L.arms[1].rotation.x=-2.4;}}
      }
      if(t>P.t0+P.confettiAt){P.confettiAt+=5.5;confettiAt(P.x-.4,.6,P.z-.2);sound('pop');}
      if(P.x+P.members[P.members.length-1].off>17.4){P.g.parent?.remove(P.g);more.parade=null;more.nextParade=t+110+Math.random()*60;}
    }
    // gulls
    for(const gl of more.gulls){
      gl.ph+=dt*(gl.panic>0?1.4:.35);
      if(gl.state==='fly'){
        gl.x=gl.cx+Math.cos(gl.ph)*gl.rx;gl.z=14.0+Math.sin(gl.ph*1.3)*gl.rz;const y=1.05+Math.sin(gl.ph*2)*.15;
        gl.g.position.set(gl.x,y,gl.z);gl.g.rotation.y=-Math.atan2(-Math.sin(gl.ph)*gl.rx,Math.cos(gl.ph*1.3)*gl.rz*1.3)+Math.PI;
        gl.g.rotation.z=Math.sin(gl.ph*2)*.2;
        const flap=Math.sin(t*(Math.sin(gl.ph*3)>.3?14:3)+gl.ph*9)*.5;for(const w of gl.wings)w.w.rotation.x=flap*w.s;
        gl.perchT-=dt;if(gl.perchT<=0&&(wetNow()||Math.random()<.002)){gl.state='perch';gl.perchT=6+Math.random()*5;{const bx=[1.5,6.5,11.5,16.5].reduce((a,v)=>Math.abs(v-gl.x)<Math.abs(a-gl.x)?v:a,1.5);gl.g.position.set(bx+(gl.ph>0?.62:-.62),.66,13.1);}gl.g.rotation.z=0;for(const w of gl.wings)w.w.rotation.x=.1*w.s*-1;sound('chirp');}
      }else{gl.perchT-=dt;if(gl.perchT<=0&&!wetNow()){gl.state='fly';gl.perchT=12+Math.random()*10;}}
    }
    // market crowd: browse, turn, and reach for something
    for(const c of more.crowd){
      const L=c.p.userData.limbs;if(!L)continue;const u=Math.sin(t*.6+c.phase*2);
      c.p.rotation.y=Math.PI+Math.sin(t*.35+c.phase)*.35;L.headPivot.rotation.x=u>.4?.3:0;
      L.arms[1].rotation.x=u>.7?-1.1:-.1;
    }
    // fireworks after dark: now and then a salvo of two to four rockets, a moment apart
    if(dark>.6&&t>more.nextFw){more.nextFw=t+10+Math.random()*10;const n=2+Math.floor(Math.random()*3);for(let i=0;i<n;i++)fwSys.queue.push({at:i*(.8+Math.random()*1.2),x:3.5+Math.random()*11,z:2.5+Math.random()*11});}
    fwStep(dt,t);
  }

  /* ---- Stage 2: life that follows the weather and the clock, and more to touch. ---- */
  const wetNow=()=>weatherKind==='rain'||weatherKind==='storm';
  const live2={t:0,built:false,puddles:[],snowman:null,snowK:0,watch:null,cats:[],boards:[],boost:0,taps:0,hits:{}};
  function createStage2(){
    const g=new THREE.Group();world.add(g);live2.built=true;live2.t=0;live2.puddles=[];live2.cats=[];live2.boards=[];live2.snowK=0;live2.snowman=null;live2.watch=null;
    const base=.17;
    // --- puddles with ripples, only while it rains
    const spots=[[3.5,1.95],[9.5,1.95],[13.5,6.95],[4.5,6.05],[9.5,11.95],[14.5,11.05],[6.05,3.5],[11.05,9.5],[16.05,4.5],[1.95,9.5]];
    for(const [x,z] of spots){
      const m=new THREE.MeshStandardMaterial({color:'#9ec4d8',roughness:.12,metalness:.1,transparent:true,opacity:.62});
      const puddle=new THREE.Mesh(geo('cylinder',1,1,.006),m);puddle.position.set(x,base+.045,z);puddle.scale.set(.2+((x*7+z*3)%5)*.03,1,.13+((x*3+z*7)%4)*.025);puddle.visible=false;g.add(puddle);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.05,.004,5,16),new THREE.MeshBasicMaterial({color:'#e8f6ff',transparent:true,opacity:.7,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.set(x,base+.055,z);ring.visible=false;g.add(ring);
      live2.puddles.push({puddle,ring,ph:Math.random()*6});
    }
    // --- a snowman that appears in snow and melts when it clears
    const sm=new THREE.Group();g.add(sm);const snow=mat('#fbfdff',.9);
    ball(sm,.12,snow,0,.12,0);ball(sm,.09,snow,0,.28,0);ball(sm,.07,snow,0,.4,0);
    for(const s of [-1,1])ball(sm,.01,mat('#2d3640',.5),.055,.42,s*.03);
    cylinder(sm,.003,.012,.07,'#ff8a3d',.09,.4,0).rotation.z=-Math.PI/2;
    cylinder(sm,.05,.05,.015,'#33404a',0,.465,0);cylinder(sm,.035,.035,.06,'#33404a',0,.5,0);box(sm,.12,.025,.12,'#e2463a',0,.335,0,false);
    const sp=life.play?{x:life.play.x+.55,z:life.play.z+1.05}:{x:9.6,z:7.7};sm.position.set(sp.x,base,sp.z);sm.scale.setScalar(0.001);sm.visible=false;live2.snowman=sm;
    // --- the night watchman, with a lantern, strolling round the central block's pavement
    const w=person({col:'#4a5a7a',skin:'#d8a77c',hair:'#333947',ph:9.1,x:3,y:5,hat:'cap'});w.scale.setScalar(CUTE*1.05);w.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);g.add(w);w.visible=false;
    const lan=new THREE.Group();w.add(lan);lan.position.set(.13,.2,.1);cylinder(lan,.004,.004,.1,'#333',0,.05,0);
    const glass=new THREE.MeshStandardMaterial({color:'#fff3d6',roughness:.3,emissive:'#ffb45e',emissiveIntensity:2.4});box(lan,.05,.06,.05,glass,0,0,0,false);
    live2.watch={p:w,glass,u:0,route:[[6.93,6.93],[11.07,6.93],[11.07,11.07],[6.93,11.07]],ph:0};
    // --- cats on the pavement edge at night
    const catSpots=[[7.0,6.2,1.2],[11.0,10.8,-2.0]];
    catSpots.forEach(([x,z,face],i)=>{
      const c=new THREE.Group();g.add(c);const fur=mat(i?'#d9a76a':'#4a4f5a',.9);
      const body=ball(c,.07,fur,0,.07,0);body.scale.set(1.5,.9,.9);const head=ball(c,.05,fur,.1,.12,0);
      for(const s of [-1,1]){const ear=object(c,new THREE.ConeGeometry(.018,.04,6),fur,.105,.17,s*.03,false);ear.rotation.z=-.1;
        ball(c,.01,mat('#ffe27a',.3,'#ffe27a'),.145,.13,s*.022).castShadow=false;}
      const tail=new THREE.Group();tail.position.set(-.1,.08,0);c.add(tail);const t=cylinder(tail,.012,.008,.14,i?'#c18f55':'#3b3f48',-.05,.06,0);t.rotation.z=.9;
      c.position.set(x,base+.01,z);c.rotation.y=face;c.visible=false;live2.cats.push({g:c,tail,head,ph:i*2.3,x,z});
    });
    // --- shop boards: OPEN by day, CLOSED at night
    for(const b of town.buildings())if(b.kind==='shop'&&live2.boards.length<10){
      const bd=new THREE.Group();bd.position.set(b.x+.16,base,b.y+.97);bd.rotation.y=-.2;g.add(bd);
      for(const s of [-1,1])box(bd,.012,.17,.012,'#8a6d4e',s*.05,.085,0,false).rotation.x=s*.18;
      const open=sign(bd,'OPEN',0,.15,.02,.15),shut=sign(bd,'CLOSED',0,.15,.02,.15);shut.visible=false;
      live2.boards.push({open,shut});
    }
  }
  function updateStage2(dt,dark){
    if(!live2.built)return;live2.t+=dt;const t=live2.t,wet=wetNow(),storm=weatherKind==='storm',base=.17;
    // weather: who stays home
    const K=life.kite;if(K){const vis=!wet&&dark<.6;K.kid.visible=vis;K.kite.visible=vis;K.string.visible=vis;}
    const P=life.play;if(P){const vis=!wet&&dark<.7&&weatherKind!=='snow';P.swings.forEach(s=>{s.kid.visible=vis;});P.ks.forEach(k=>{k.visible=vis;});P.sk.visible=vis;}
    const F=life.fisher;if(F){const vis=!wet&&dark<.8;F.p.visible=vis;F.rod.visible=vis;F.line.visible=vis;F.bob.visible=vis;}
    if(life.boat)life.boat.g.visible=!storm&&dark<.9;
    // puddles
    for(const p of live2.puddles){p.puddle.visible=wet;p.ring.visible=wet;if(wet){const u=((t*.9+p.ph)%1);p.ring.scale.setScalar(.4+u*2.2);p.ring.material.opacity=.7*(1-u);}}
    // snowman
    const want=weatherKind==='snow'?1:0;live2.snowK+=(want-live2.snowK)*Math.min(1,dt*(want?.5:.15));
    const sm=live2.snowman;if(sm){sm.visible=live2.snowK>.02;sm.scale.setScalar(Math.max(.001,live2.snowK));}
    // night watchman
    const W=live2.watch;if(W){
      const on=dark>.35;W.p.visible=on;
      if(on){const r=W.route,n=r.length;W.u=(W.u+dt*.28)%n;const i=Math.floor(W.u),f=W.u-i,a=r[i],b=r[(i+1)%n];
        const x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;W.ph+=dt*6;W.p.position.set(x,base+Math.abs(Math.sin(W.ph*1.5))*.008,z);W.p.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);walkAnim(W.p,true,W.ph);W.glass.emissiveIntensity=1.6+dark*1.4;}
    }
    // cats
    for(const c of live2.cats){const on=dark>.3&&!wet;c.g.visible=on;if(on){c.ph+=dt;c.tail.rotation.y=Math.sin(c.ph*1.6)*.5;c.head.position.y=.12+(Math.sin(c.ph*.4)>.85?.01:0);}}
    // shop boards
    const closed=dark>.55;for(const b of live2.boards){b.open.visible=!closed;b.shut.visible=closed;}
    // touch effects decay
    farm.boost=Math.max(0,(farm.boost||0)-dt);site.swing=Math.max(0,(site.swing||0)-dt);
    if(life.boat&&life.boat.wave>0){life.boat.wave-=dt;const G=life.boat.guest.userData.limbs;if(G)G.arms[0].rotation.z=1.8+Math.sin(t*9)*.5;}
    for(const s of farm.sheep)if(s.hop>0){s.hop-=dt;s.g.position.y=base+Math.abs(Math.sin((.6-s.hop)*9))*.06;}
    for(const gl of more.gulls)if(gl.panic>0)gl.panic-=dt;
  }
  // Tapping the things around the town (hit-tested in screen space).
  function screenDist(x,y,z,clientX,clientY){
    const r=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector3(x,y,z);v.project(camera);if(v.z>1)return 1e9;
    return Math.hypot(r.left+(v.x+1)/2*r.width-clientX,r.top+(1-v.y)/2*r.height-clientY);
  }
  function touch2(clientX,clientY){
    if(!live2.built||!THREE.Vector3)return false;
    const hit=(x,y,z,r=38)=>screenDist(x,y,z,clientX,clientY)<r,say=(grp,txt)=>showBubble(grp,txt,2200);
    for(const gl of more.gulls)if(gl.g.visible!==false&&hit(gl.g.position.x,gl.g.position.y,gl.g.position.z,34)){
      gl.panic=2.5;if(gl.state==='perch'){gl.state='fly';gl.perchT=14;}gl.ph+=.8;sound('chirp');say(gl.g,['Squawk!','Kree!','Mine!'][(live2.taps++)%3]);live2.hits.gull=(live2.hits.gull||0)+1;return true;}
    if(hit(17.62,.65,9.8,46)){farm.boost=4;sound('chime');live2.hits.windmill=(live2.hits.windmill||0)+1;return true;}
    if(rail.clock&&hit(RAIL.stationX,.95,17.6,52)){sound('bell');say(rail.clock.hPivot,'Ding dong!');tootPuffs();live2.hits.station=(live2.hits.station||0)+1;return true;}
    for(const s of farm.sheep)if(hit(s.x,.3,s.z,34)){s.hop=.6;say(s.g,['Baa!','Baaa!','Meh!'][(live2.taps++)%3]);sound('pop');live2.hits.sheep=(live2.hits.sheep||0)+1;return true;}
    const B=life.boat;if(B&&B.g.visible&&hit(B.g.position.x,.35,B.g.position.z,40)){B.wave=2.5;say(B.rower,'Ahoy!');sound('chime');live2.hits.boat=(live2.hits.boat||0)+1;return true;}
    const K=life.kite;if(K&&K.kid.visible&&(hit(K.x,.35,K.z,38)||hit(K.kite.position.x,K.kite.position.y,K.kite.position.z,44))){K.loop=3;say(K.kid,'Wheee!');sound('chime');live2.hits.kite=(live2.hits.kite||0)+1;return true;}
    const P=life.play;if(P&&P.sk.visible&&hit(P.x,.3,P.z,60)){P.cheer=3;say(P.swings[0].kid,'Higher! Higher!');sound('chime');live2.hits.playground=(live2.hits.playground||0)+1;return true;}
    if(site.built&&hit(site.kx,1.1,site.kz,60)){site.swing=4;if(site.workers[0])say(site.workers[0].g,'Watch the load!');sound('honk');live2.hits.crane=(live2.hits.crane||0)+1;return true;}
    for(const c of live2.cats)if(c.g.visible&&hit(c.x,.2,c.z,34)){say(c.g,'Meow.');sound('chirp');live2.hits.cat=(live2.hits.cat||0)+1;return true;}
    return false;
  }

  /* ---- Stage 3: a bus line with stops and boarding, scenes at the shopfronts, and a richer ground. ---- */
  const bus3={ground:[],built:false,people:[],stops:[],handled:new Set(),boarded:0,alighted:0,steam:[],t:0,tufts:0,flowers:0,patches:0,boards:0};
  const SHOP_BOARD={BAKERY:'FRESH BREAD',BOOKS:'NEW BOOKS',PIZZA:'HOT SLICES',TOYS:'TOYS!',CAFE:'COFFEE',SWEETS:'SWEETS',PETS:'PETS'};
  function createStage3(){
    const g=new THREE.Group();world.add(g);bus3.built=true;bus3.ground=[];bus3.people=[];bus3.stops=[];bus3.handled=new Set();bus3.steam=[];bus3.t=0;
    const base=.17,stops=town.BUS_STOPS||[];
    // --- bus shelters and the people waiting in them
    const cols=['#e58f8f','#7fb3d9','#f2c36b','#9ccf9a','#c39be0','#f0a574','#f08a4b','#6fb0d9'];
    stops.forEach((s,si)=>{
      const south=s.d===0,z=s.y+(south?.54:-.54),sh=new THREE.Group();sh.position.set(s.x,base,z);g.add(sh);
      const back=south?.1:-.1;
      for(const px of [-.24,.24])cylinder(sh,.011,.011,.52,'#5c6b73',px,.26,back,false);
      box(sh,.62,.025,.26,'#7fc4b8',0,.53,0);for(let k=0;k<5;k++)ball(sh,.025,mat(k%2?'#ffffff':'#7fc4b8',.8),-.24+k*.12,.52,south?-.12:.12).scale.set(1,.7,.6);
      box(sh,.58,.38,.012,mat('#cfe7ee',.2),0,.3,back*1.2);
      box(sh,.3,.022,.07,'#c68c63',0,.1,back*.6);
      cylinder(sh,.008,.008,.62,'#5c6b73',.38,.31,0);sign(sh,'BUS',.38,.6,0,.2);
      bus3.stops.push({s,sh,x:s.x,z});
      for(let k=0;k<2;k++){
        const i=si*2+k,p=person({col:cols[i%8],skin:['#f1c9a5','#d8a77c','#a8754f','#7a4e33'][i%4],hair:i%2?'#49362d':'#333947',ph:i*1.3+.7,x:i,y:i*3,bag:k===1});
        p.scale.setScalar(CUTE);p.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);g.add(p);
        const wx=s.x-.12+k*.24,wz=z+(south?.0:.0);p.position.set(wx,base,wz);p.rotation.y=south?0:Math.PI;
        bus3.people.push({g:p,state:'wait',stop:si,x:wx,z:wz,tx:wx,tz:wz,ph:i,t:0,face:south?0:Math.PI});
      }
    });
    // --- the shopfronts: chalkboards, steam from the bakery, a book trolley
    for(const b of town.buildings())if(b.kind==='shop'&&SHOP_BOARD[b.name]&&bus3.boards<8){
      bus3.boards++;const bd=new THREE.Group();bd.position.set(b.x+.84,base,b.y+.98);bd.rotation.y=.2;g.add(bd);
      for(const s of [-1,1])box(bd,.012,.2,.012,'#8a6d4e',s*.07,.1,0,false).rotation.x=s*.16;
      box(bd,.2,.17,.012,'#2f3a3f',0,.12,.02,false);sign(bd,SHOP_BOARD[b.name],0,.13,.032,.19);
      if(['BAKERY','PIZZA','CAFE'].includes(b.name))for(let k=0;k<4;k++){const m=new THREE.Mesh(geo('sphere',.04),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false}));g.add(m);bus3.steam.push({m,x:b.x+.75,z:b.y+.35,ph:k*.25});}
      if(b.name==='BOOKS'){const tr=new THREE.Group();tr.position.set(b.x+.5,base,b.y+1.04);g.add(tr);box(tr,.2,.04,.1,'#9a7b5b',0,.07,0);
        for(let k=0;k<5;k++)box(tr,.034,.07+(k%2)*.02,.07,['#e58f8f','#7fb3d9','#f2c36b','#9ccf9a','#c39be0'][k],-.08+k*.04,.14,0,false);
        for(const x of [-.07,.07]){const w=cylinder(tr,.025,.025,.012,'#333',x,.03,.056);w.rotation.x=Math.PI/2;}}
    }
    // --- a richer ground: grass tufts, flower clusters and a few soft patches on the lawns
    const bs=town.buildings(),ps=town.props().filter(p=>!['flowers','duck','crane'].includes(p.kind)),LN=LINES.map(l=>l+.5);
    const ok=(x,z,m=0)=>{
      if(LN.some(v=>Math.abs(x-v)<.68+m||Math.abs(z-v)<.68+m))return false;
      if(z>12.85-m&&z<15.15+m)return false;
      if(x>6.7&&x<11.3&&z>6.7&&z<11.3)return false;
      for(const b of bs)if(Math.hypot(b.x+(b.kind==='site'?1:.5)-x,b.y+(b.kind==='site'?1:.5)-z)<(b.kind==='site'?2.2:.85)+m)return false;
      for(const p of ps)if(Math.hypot(p.x-x,p.y-z)<.6+m)return false;
      if(z>17-m&&Math.abs(x-RAIL.stationX)<2.9)return false;
      if(x>17-m&&Math.abs(z-9.55)<1.4)return false;
      if(x<1.1+m&&z>1.9&&z<6.1)return false;
      if(life.play&&Math.hypot(life.play.x-x,life.play.z-z)<1.3+m)return false;
      return x>.45&&x<17.55&&z>.45&&z<17.55;
    };
    const spots=[];for(let k=0;spots.length<320&&k<3000;k++){const x=.45+rng(k+(worldSeed||0)%89,301)*17.1,z=.45+rng(k+(worldSeed||0)%89,302)*17.1;if(ok(x,z))spots.push([x,z,k]);}
    const inst=(geom,material,list)=>{const m=new THREE.InstancedMesh(geom,material,list.length),o=new THREE.Object3D();
      list.forEach((e,i)=>{o.position.set(e.x,e.y,e.z);o.rotation.set(0,e.r||0,0);o.scale.set(e.sx||1,e.sy||1,e.sz||1);o.updateMatrix();m.setMatrixAt(i,o.matrix);if(e.c&&m.setColorAt)m.setColorAt(i,new THREE.Color(e.c));});
      m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;g.add(m);bus3.ground.push(m);m.visible=!lite;return m;};
    const greens=SEASON.tufts,tuft=[],fl=[],peb=[];
    for(const [x,z,k] of spots){
      for(let j=0;j<3;j++)tuft.push({x:x+(rng(k,310+j)-.5)*.1,y:base+.032,z:z+(rng(k,320+j)-.5)*.1,r:rng(k,330+j)*6,sy:.8+rng(k,340+j)*.7,c:greens[(k+j)%4]});
      if(rng(k,350)<SEASON.rate)fl.push({x:x+(rng(k,351)-.5)*.2,y:base+.07,z:z+(rng(k,352)-.5)*.2,c:SEASON.flowers[k%SEASON.flowers.length],sx:1,sy:.9,sz:1});
      if(rng(k,360)<.12)peb.push({x:x+.08,y:base+.012,z:z-.06,sx:1.3,sy:.5,sz:1,c:'#d7ccb8'});
    }
    bus3.tufts=tuft.length;bus3.flowers=fl.length;
    if(tuft.length)inst(new THREE.ConeGeometry(.02,.07,5),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}),tuft).castShadow=false;
    if(fl.length)inst(geo('sphere',.024),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8}),fl);
    if(peb.length)inst(geo('sphere',.03),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}),peb);
    const patches=[];for(let k=0;patches.length<26&&k<900;k++){const x=.8+rng(k+(worldSeed||0)%83,371)*16.4,z=.8+rng(k+(worldSeed||0)%83,372)*16.4;if(!ok(x,z,.55))continue;
      patches.push({x,y:base+.004+patches.length*.0004,z,sx:.4+rng(k,373)*.55,sz:.35+rng(k,374)*.5,r:rng(k,375)*3,c:k%2?'#9cc57f':'#7ea96b'});}
    // --- the strips between the ring roads and the railway were bare lawn: allotment plots with crop rows, an orchard,
    //     flower beds, hay bales and a low hedge along the pavement (south and north; the station and tunnel stay clear)
    {
      const soil=[],crops=[],trunks=[],crowns=[],fruit=[],hay=[],hedge=[],blooms=[];
      const cropCols=['#6fae5a','#8bbf5c','#5f9d56','#a3c964'],fruitCols=['#e2543f','#f3b13a','#d9686a'];
      const strips=[{z0:17.42,z1:18.18,skip:[8.9,3.1],hedgeZ:17.3,tag:1},{z0:-.28,z1:.66,skip:[9,2.4],hedgeZ:.82,tag:2},
        {vert:true,z0:-.22,z1:.5,skip:[3.95,2.5],tag:3},{vert:true,z0:17.5,z1:18.22,skip:[9.2,2.4],tag:4}];   // the last two run north-south inside the west and east rails (the railway loop is at -0.62 and 18.62)
      const free=(x,z)=>!ps.some(q=>Math.hypot(q.x-x,q.y-z)<.42)&&!bs.some(q=>Math.hypot(q.x+.5-x,q.y+.5-z)<.9);
      for(const st of strips){
        for(let x=st.vert?1.5:1.05,k=0;x<(st.vert?16.6:17);x+=.5,k++){
          const key=k*7+st.tag*131+(worldSeed||0)%53;
          if(Math.abs(x-st.skip[0])<st.skip[1])continue;
          const cc=st.z0+(st.z1-st.z0)*(.25+rng(key,401)*.5),sx=x+(rng(key,402)-.5)*.1,t=rng(key,403);
          const px=st.vert?cc:sx,z=st.vert?sx:cc;   // position across/along the strip
          if(!free(px,z))continue;
          const cx=px;
          if(t<.5){   // an allotment plot: dark soil with three rows of crops
            soil.push({x:cx,y:base+.012,z,r:0,sx:.46,sy:.026,sz:.34,c:'#8c6b4d'});
            for(let row=-1;row<=1;row++)for(let c=-1;c<=1;c++)crops.push({x:cx+c*.13,y:base+.045,z:z+row*.1,sx:1,sy:.8+rng(key+row*3+c,404)*.5,sz:1,c:cropCols[(key+row+c+9)%4]});
          }else if(t<.72){   // an orchard tree with a little fruit
            trunks.push({x:cx,y:base+.09,z,sx:1,sy:1,sz:1,c:'#8a6a4c'});
            crowns.push({x:cx,y:base+.24,z,sx:1.05+rng(key,405)*.3,sy:.95,sz:1.05,c:['#78b45e','#6aa956','#8cc064'][k%3]});
            for(let f=0;f<4;f++){const a=f*1.57+rng(key,406+f)*1.2;fruit.push({x:cx+Math.cos(a)*.11,y:base+.22+rng(key,410+f)*.07,z:z+Math.sin(a)*.11,c:fruitCols[(k+f)%3]});}
          }else if(t<.92){   // a flower bed
            soil.push({x:cx,y:base+.012,z,r:0,sx:.4,sy:.026,sz:.24,c:'#7a5c40'});
            for(let f=0;f<7;f++)blooms.push({x:cx+(f%4-1.5)*.095,y:base+.06,z:z+(f<4?-.05:.06),sx:1,sy:.9,sz:1,c:SEASON.flowers[(k+f)%SEASON.flowers.length]});
          }else hay.push({x:cx,y:base+.055,z,sx:1,sy:1,sz:1,c:'#e3c47a'});
        }
        if(!st.vert)for(let x=1.15;x<17;x+=.5){if(Math.abs(x-st.skip[0])<st.skip[1])continue;hedge.push({x,y:base+.05,z:st.hedgeZ,sx:.5,sy:.1,sz:.07,c:'#5e9a52'});}
      }
      const boxGeo=geo('box',1,1,1);
      if(soil.length)inst(boxGeo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}),soil).castShadow=false;
      if(crops.length)inst(geo('sphere',.03),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9}),crops).castShadow=false;
      if(trunks.length)inst(geo('cylinder',.018,.026,.18),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95}),trunks);
      if(crowns.length)inst(geo('sphere',.1),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.85}),crowns);
      if(fruit.length)inst(geo('sphere',.016),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.7}),fruit).castShadow=false;
      if(hay.length)inst(geo('cylinder',.075,.075,.11),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1}),hay);
      if(hedge.length)inst(boxGeo,new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95}),hedge).castShadow=false;
      if(blooms.length)inst(geo('sphere',.022),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8}),blooms).castShadow=false;
      bus3.strips={soil:soil.length,crops:crops.length,trees:crowns.length,beds:blooms.length/7,hay:hay.length,hedge:hedge.length};
    }
    bus3.patches=patches.length;
    if(patches.length){const pm=inst(geo('cylinder',1,1,.004),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,transparent:true,opacity:.5,depthWrite:false}),patches);pm.castShadow=false;pm.receiveShadow=true;}
  }
  function updateStage3(dt,dark){
    if(!bus3.built)return;bus3.t+=dt;const t=bus3.t,base=.17,clk=town.debug().clock||0;
    // steam rises from the bakery chimney
    for(const s of bus3.steam){const u=(t*.45+s.ph)%1;s.m.position.set(s.x+Math.sin(u*5+s.ph*9)*.03,1.0+u*.42,s.z);s.m.scale.setScalar(.6+u*1.8);s.m.material.opacity=.7*(1-u)*(dark>.7?.6:1);}
    // a bus pulling up at a stop: someone steps on, someone steps off
    const stopsList=town.BUS_STOPS||[];
    for(const m of town.movers())if(m.kind==='bus'&&m.atStop!==undefined&&(m.stopUntil||0)>clk){
      const key=m.atStop+':'+(m.stops||0);if(bus3.handled.has(key))continue;bus3.handled.add(key);if(bus3.handled.size>200)bus3.handled.clear();
      const si=stopsList.findIndex(s=>s.id===m.atStop);if(si<0||!bus3.stops[si])continue;
      const S=bus3.stops[si],door={x:m.x,z:m.y+(S.s.d===0?.2+.14:-.2-.14)};
      const waiting=bus3.people.find(p=>p.state==='wait'&&p.stop===si),rider=bus3.people.find(p=>p.state==='aboard');
      if(waiting){waiting.state='board';waiting.tx=door.x;waiting.tz=door.z;waiting.doorAt=t;}
      if(rider){rider.state='alight';rider.stop=si;rider.x=door.x;rider.z=door.z;rider.g.visible=true;rider.tx=S.x+(rider.ph%2?.12:-.12);rider.tz=S.z;rider.alightAt=t+1.2;rider.g.visible=false;}
    }
    for(const p of bus3.people){
      p.ph+=dt*6;let moving=false;const L=p.g.userData.limbs;
      const go=(tx,tz,sp)=>{const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);if(d<.02)return true;const st=Math.min(d,sp*dt);p.x+=dx/d*st;p.z+=dz/d*st;p.g.rotation.y=Math.atan2(dx,dz);moving=true;return false;};
      if(p.state==='board'){if(go(p.tx,p.tz,.45)){p.state='aboard';p.g.visible=false;bus3.boarded++;}}
      else if(p.state==='alight'){if(!p.g.visible&&t>=p.alightAt){p.g.visible=true;}if(p.g.visible&&go(p.tx,p.tz,.4)){p.state='wait';p.g.rotation.y=p.face;bus3.alighted++;}}
      if(L&&p.g.visible){const a=moving?Math.sin(p.ph*1.5)*.55:0;L.legs.forEach((l,k)=>{l.rotation.x=(k?1:-1)*a;});L.arms.forEach((l,k)=>{l.rotation.x=(k?-1:1)*a*.7;});}
      if(p.g.visible)p.g.position.set(p.x,base+(moving?Math.abs(Math.sin(p.ph*1.5))*.01:0),p.z);
    }
  }

  /* ---- Stage 7: the news in town. Every light headline the town knows (town.news(): serious ones are never staged) is
     read out by a town crier on the plaza, who rings a bell while a small crowd gathers and reacts to the topic, and is
     painted on the Town Times billboard and on the crier's chalkboard. A kids' football game fills a lawn. ---- */
  const news7={built:false,t:0,ver:-1,idx:0,nextRead:9,boards:[],crier:null,listeners:[],reading:null,ball:null,kicks:0,reads:0,bubbleAt:0,football:null};
  function wrapLines(ctx,text,maxW,maxLines){
    const words=String(text).split(/\s+/),lines=[];let cur='';
    for(const w of words){const t=cur?cur+' '+w:w;if(ctx.measureText(t).width>maxW&&cur){lines.push(cur);cur=w;}else cur=t;}
    if(cur)lines.push(cur);
    if(lines.length>maxLines){lines.length=maxLines;lines[maxLines-1]=lines[maxLines-1].replace(/\s*\S*$/,'')+'…';}
    return lines;
  }
  function paintNewsBoard(b,item){
    const c=b.ctx,W=b.cv.width,H=b.cv.height;if(!c||!c.fillRect)return;
    c.fillStyle='#fff8e7';c.fillRect(0,0,W,H);
    c.fillStyle='#dba295';c.fillRect(0,0,W,Math.round(H*.17));
    c.fillStyle='#fffaf0';c.font='500 '+Math.round(H*.1)+'px Nunito,system-ui,sans-serif';c.textBaseline='middle';c.fillText('TOWN TIMES',W*.05,H*.085);
    if(item){
      c.fillStyle='#4a5260';c.font='500 '+Math.round(H*.105)+'px Nunito,system-ui,sans-serif';c.textBaseline='top';
      const lines=wrapLines(c,item.title,W*.9,4);lines.forEach((l,i)=>c.fillText(l,W*.05,H*.23+i*H*.14));
      c.fillStyle='#9a9fa8';c.font='400 '+Math.round(H*.07)+'px Nunito,system-ui,sans-serif';c.fillText((item.emoji||'')+'  '+(item.source||''),W*.05,H*.9);
    }else{
      c.fillStyle='#8a8f99';c.font='600 '+Math.round(H*.1)+'px Nunito,system-ui,sans-serif';c.textBaseline='top';c.fillText('A quiet news day.',W*.05,H*.35);
    }
    if(b.tex)b.tex.needsUpdate=true;
  }
  function newsBoard(w,h,x,y,z,ry,res){
    if(typeof document==='undefined'||!THREE.CanvasTexture)return null;
    const cv=document.createElement('canvas');cv.width=res[0];cv.height=res[1];const ctx=cv.getContext&&cv.getContext('2d');
    const tex=new THREE.CanvasTexture(cv);if(THREE.SRGBColorSpace)tex.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(geo('plane',w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));
    mesh.position.set(x,y,z);mesh.rotation.y=ry;mesh.castShadow=false;world.add(mesh);
    const b={cv,ctx,tex,mesh};paintNewsBoard(b,null);news7.boards.push(b);ambient.push({kind:'newsboard',mesh});return b;
  }
  const grownUp=(i,col)=>{const p=person({col,skin:['#f1c9a5','#d8a77c','#a8754f','#7a4e33'][i%4],hair:['#49362d','#333947','#7a5a3a','#222'][i%4],ph:i*1.7+.4,x:i+9,y:i*3,hat:i%3===0?'cap':null,bag:i%2===1});
    p.scale.setScalar(CUTE);p.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);p.visible=false;return p;};
  function createNewsroom(){
    news7.built=true;news7.t=0;news7.ver=-1;news7.idx=0;news7.nextRead=9;news7.boards=[];news7.listeners=[];news7.reading=null;news7.ball=null;news7.football=null;news7.kicks=0;news7.reads=0;
    const g=new THREE.Group();world.add(g);const base=.17;
    // the Town Times stand shows today's headlines
    const times=town.props().find(p=>p.kind==='times');
    if(times)news7.stand=newsBoard(.6,.46,times.x,1.13,times.y+.044,0,[512,392]);
    // the town crier on a crate at the west edge of the plaza, with a chalkboard
    const C={x:10.65,z:9.42};
    const crate=box(g,.19,.045,.19,'#ac9270',C.x,CENTRE_TOP+.0225,C.z);
    const crier=person({col:'#b5473c',skin:'#d8a77c',hair:'#4a3a2f',ph:2.1,x:5,y:7,hat:'cap'});crier.scale.setScalar(CUTE);crier.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);
    g.add(crier);crier.position.set(C.x,CENTRE_TOP+.045,C.z);crier.rotation.y=-Math.PI/2;
    const hand=crier.userData.limbs.hands?.[1];
    if(hand){const bell=cylinder(hand,.004,.03,.06,'#e6b94a',0,-.07,0);bell.castShadow=false;}
    cylinder(g,.009,.012,.35,'#8a6d4e',C.x-.12,CENTRE_TOP+.175,C.z-.22);
    cylinder(g,.009,.012,.35,'#8a6d4e',C.x+.18,CENTRE_TOP+.175,C.z-.22);
    const chalk=newsBoard(.32,.22,C.x+.03,CENTRE_TOP+.37,C.z-.22,0,[480,330]);
    news7.crier={g:crier,C,chalk,crate,ring:0,hand};
    // listeners: they walk in from the plaza and stand round the crier
    const cols=['#7fb3d9','#f2c36b','#9ccf9a','#c39be0','#f0a574','#e58f8f'];
    const n=lite?2:3;
    for(let i=0;i<n;i++){
      const p=grownUp(i,cols[i%6]);g.add(p);
      // Distinct seats in a shallow arc; no additional crowd walks through
      // the shop service points, cafe, bench or main x=8.5/9.5 aisles.
      const home={x:9.82+i*.12,z:9.14+i*.24},spot={x:10.15+(i%2)*.10,z:9.17+i*.25};
      news7.listeners.push({p,home,spot,x:home.x,z:home.z,state:'away',ph:i*1.3,face:Math.atan2(C.x-spot.x,C.z-spot.z)});
    }
    // football on a free lawn
    const lawns=freeSpots().filter(q=>q.clear>.7);
    const P=life.play,K=life.kite;
    const F=lawns.find(q=>(!P||Math.hypot(q.x-P.x,q.z-P.z)>2.4)&&(!K||Math.hypot(q.x-K.x,q.z-K.z)>2.4));
    if(F&&!lite){
      const a=kidOf(10,'#e8664d'),b=kidOf(11,'#5fa0d6'),ball=ball0(g);
      g.add(a);g.add(b);
      news7.football={a,b,ball,x:F.x,z:F.z,t:0,next:1.2,from:0,cheer:0,goalAt:11};
      // two little goal posts
      for(const sd of [-1,1]){const gp=new THREE.Group();gp.position.set(F.x+sd*1.05,base,F.z);g.add(gp);
        cylinder(gp,.01,.01,.22,'#f4efe2',0,.11,-.14);cylinder(gp,.01,.01,.22,'#f4efe2',0,.11,.14);cylinder(gp,.01,.01,.3,'#f4efe2',0,.22,0).rotation.x=Math.PI/2;}
    }
  }
  function ball0(g){const b=new THREE.Group();g.add(b);ball(b,.04,'#fffaf0',0,0,0);const sp=ball(b,.018,'#3a3f4a',.032,.012,0);sp.castShadow=false;return b;}
  const limbSwing=(p,a)=>{const L=p.userData.limbs;if(!L)return;L.legs.forEach((l,k)=>{l.rotation.x=(k?1:-1)*a;});L.arms.forEach((l,k)=>{l.rotation.x=(k?-1:1)*a*.7;});};
  function updateNewsroom(dt,dark){
    if(!news7.built)return;news7.t+=dt;const t=news7.t,N=town.news?town.news():{light:[],version:0};
    const items=N.light||[];
    // a new feed: repaint, and read the lead story soon
    if(N.version!==news7.ver){news7.ver=N.version;news7.idx=0;if(items.length)news7.nextRead=Math.min(news7.nextRead,t+3);}
    // the boards cycle through the headlines
    if(items.length&&t>=(news7.boardAt||0)){
      news7.boardAt=t+9;const it=news7.reading?news7.reading.item:items[news7.idx%items.length];
      for(const b of news7.boards)paintNewsBoard(b,it);
    }else if(!items.length&&!news7.boardBlank){news7.boardBlank=true;for(const b of news7.boards)paintNewsBoard(b,null);}
    if(items.length)news7.boardBlank=false;
    const C=news7.crier;
    if(C){C.g.visible=items.length>0;C.crate.visible=items.length>0;if(C.chalk)C.chalk.mesh.visible=items.length>0;}
    // start a reading
    if(C&&items.length&&!news7.reading&&t>=news7.nextRead&&dark<.9){
      const item=items[news7.idx%items.length];news7.idx++;news7.reads++;
      news7.reading={item,t:0,cheer:/⚽|🎭|🏆|🗳️/.test(item.emoji)};
      try{town.stageHeadline&&town.stageHeadline(item.full||item.title);}catch(e){}   // the town acts out the headline the crier is reading
      news7.nextRead=t+75+Math.random()*25;
      for(const b of news7.boards)paintNewsBoard(b,item);news7.boardAt=t+9;
      news7.listeners.forEach((q,i)=>{q.state='in';q.p.visible=true;q.delay=i*.35;});
    }
    const R=news7.reading;
    if(R){
      R.t+=dt;
      if(R.t>2.4&&!R.said){R.said=true;showCrierBubble(C.g,R.item.emoji+' '+(R.item.title.length>64?R.item.title.slice(0,62).replace(/\s\S*$/,'')+'…':R.item.title),6500,R.item.source?'Town crier · '+R.item.source:'Town crier');}
      if(R.t>11.5&&!R.leaving){R.leaving=true;news7.listeners.forEach(q=>{q.state='out';});}
      if(R.t>15){news7.reading=null;for(const q of news7.listeners){q.p.visible=false;q.state='away';q.x=q.home.x;q.z=q.home.z;}}
    }
    // the crier: rings the bell, then gestures while reading
    if(C&&C.g.visible){
      const L=C.g.userData.limbs;
      if(L){
        const ringing=R&&R.t<2.6;
        L.arms[1].rotation.x=ringing?-2.2+Math.sin(t*16)*.4:R?(-.6+Math.sin(t*2.2)*.25):0;
        L.arms[1].rotation.z=ringing?-.2:0;
        L.arms[0].rotation.x=R&&R.t>2.6?-.4+Math.sin(t*1.7)*.15:0;
        if(L.headPivot)L.headPivot.rotation.x=R?-.08:0;
      }
      C.g.position.y=CENTRE_TOP+.045+(R&&R.t<2.6?Math.abs(Math.sin(t*16))*.006:0);
    }
    // listeners walk in, stand round the crier and react to the topic
    for(const q of news7.listeners){
      if(q.state==='away')continue;
      if(q.state==='in'&&(q.delay-=dt)>0)continue;
      const tx=q.state==='out'?q.home.x:q.spot.x,tz=q.state==='out'?q.home.z:q.spot.z,dx=tx-q.x,dz=tz-q.z,d=Math.hypot(dx,dz);
      let walking=false;
      if(d>.03){const st=Math.min(d,.55*dt);q.x+=dx/d*st;q.z+=dz/d*st;q.p.rotation.y=Math.atan2(dx,dz);walking=true;}
      else if(q.state==='in'){q.p.rotation.y=q.face;}
      q.ph+=dt*6;limbSwing(q.p,walking?Math.sin(q.ph*1.5)*.55:0);
      const L=q.p.userData.limbs;
      if(!walking&&R&&R.t>2.6&&L){
        if(R.cheer){const u=Math.max(0,Math.sin(t*5+q.ph));L.arms[1].rotation.x=-2.5*u;L.arms[0].rotation.x=-2.2*u*.8;}
        else if(L.headPivot)L.headPivot.rotation.x=-.18+Math.sin(t*1.5+q.ph)*.05;
      }
      q.p.position.set(q.x,CENTRE_TOP+(walking?Math.abs(Math.sin(q.ph*1.5))*.008:0),q.z);
    }
    // the football game
    const F=news7.football;
    if(F){
      const vis=dark<.7&&!(weatherKind==='rain'||weatherKind==='storm'||weatherKind==='snow');
      F.a.visible=F.b.visible=F.ball.visible=vis;
      if(vis){
        F.t+=dt;
        const ax=F.x-.7,bx=F.x+.7,base=.17;
        if(F.t>=F.next){F.next=F.t+2.1+Math.random()*.8;F.from^=1;news7.kicks++;F.kickT=0;if(F.t>F.goalAt){F.goalAt=F.t+12+Math.random()*8;F.cheer=1.6;}}
        F.kickT=(F.kickT||0)+dt;const u=Math.min(1,F.kickT/1.5),dir=F.from?-1:1;   // from 0: a kicks to b
        const sx=F.from?bx:ax,ex=F.from?ax:bx;
        F.ball.position.set(sx+(ex-sx)*u,base+.04+Math.sin(u*Math.PI)*.22,F.z+Math.sin(u*Math.PI)*.12*dir);
        F.ball.rotation.z=-u*9*dir;
        F.a.position.set(ax,base,F.z);F.b.position.set(bx,base,F.z);
        F.a.rotation.y=Math.PI/2;F.b.rotation.y=-Math.PI/2;
        F.cheer=Math.max(0,F.cheer-dt);
        for(const [k,kid] of [[0,F.a],[1,F.b]]){
          const kicker=(F.from===k),L=kid.userData.limbs;if(!L)continue;
          const swing=kicker&&F.kickT<.35?Math.sin(F.kickT/.35*Math.PI)*1.1:Math.sin(t*3+k)*.12;
          L.legs[0].rotation.x=swing;L.legs[1].rotation.x=-swing*.4;
          if(F.cheer>0){L.arms.forEach(a=>{a.rotation.x=-2.5;});kid.position.y=base+Math.abs(Math.sin(t*9+k))*.035;}
          else L.arms.forEach((a,i)=>{a.rotation.x=Math.sin(t*3+i)*.15;});
        }
      }
    }
  }

  /* ---- Stage 4: a livelier sky. A rainbow after the rain, wind that blows leaves across the town and lifts the
     kite, a banner plane towing the day's theme, and bird flocks at dawn and dusk. ---- */
  const sky4={built:false,t:0,rainbow:null,rainbowT:0,wasWet:false,leaves:[],plane:null,nextPlane:35,planes:0,flocks:[],nextFlock:25,flocksRun:0,leavesBlown:0,windOverride:null,rainbows:0};
  const windNow=()=>sky4.windOverride!==null?sky4.windOverride:!!(typeof window!=='undefined'&&window.ToyTownWeather?.state?.windy)||weatherKind==='storm';
  function createStage4(){
    const g=new THREE.Group();world.add(g);sky4.g=g;sky4.built=true;sky4.t=0;sky4.leaves=[];sky4.flocks=[];sky4.plane=null;sky4.rainbowT=0;
    // rainbow: seven bands of an arch standing behind the town
    const arch=new THREE.Group();arch.position.set(9,-.4,-5.5);g.add(arch);
    const bands=['#ff5a5a','#ff9f43','#ffe14d','#6fd36f','#4fb3ff','#5b6bff','#a96bff'];
    bands.forEach((c,i)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(8.2+i*.2,.11,5,48,Math.PI),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0,depthWrite:false,fog:false}));arch.add(m);});
    arch.visible=false;sky4.rainbow=arch;
    // leaves that blow in the wind
    const lc=['#8fbf62','#b7c94f','#e0a13a','#d0743c','#7fae6e'];
    for(let i=0;i<30;i++){const m=new THREE.Mesh(geo('sphere',.03),new THREE.MeshBasicMaterial({color:lc[i%5]}));m.scale.set(1.6,.18,1);m.visible=false;g.add(m);sky4.leaves.push({m,x:0,y:.6,z:0,vx:1,vz:.5,ph:i*.9,on:false});}
    // the banner plane
    const pl=new THREE.Group();g.add(pl);
    const hull=object(pl,geo('soft',.34,.1,.1,.04),mat('#f2c36b',.7),0,0,0,false);
    box(pl,.1,.012,.42,'#ff7a6b',.02,.03,0,false);box(pl,.06,.07,.012,'#ff7a6b',-.17,.07,0,false);box(pl,.05,.012,.18,'#ff7a6b',-.17,.02,0,false);
    ball(pl,.045,mat('#fffaf0',.4),.12,.06,0).scale.set(1,.8,.9);cylinder(pl,.02,.02,.012,'#333',.19,0,0).rotation.z=Math.PI/2;
    const prop=box(pl,.01,.12,.014,'#333',.2,0,0,false);
    const bc=document.createElement('canvas');bc.width=512;bc.height=96;
    const tex=new THREE.CanvasTexture(bc);if(tex)tex.colorSpace=THREE.SRGBColorSpace;
    const banner=new THREE.Mesh(geo('plane',1.7,.32),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));banner.position.set(-1.15,-.02,0);pl.add(banner);
    box(pl,.9,.004,.004,'#333',-.55,.0,0,false);
    pl.visible=false;sky4.plane={g:pl,prop,banner,tex,canvas:bc,x:0,z:0,dir:1,y:3.4};
  }
  function bannerText(){
    let th=null;try{th=town.debug().theme;}catch(e){}
    const title=(th&&typeof th==='object'&&th.title)||(typeof th==='string'&&town.THEMES?.[th]?.title)||'TOY TOWN',em=(th&&typeof th==='object'&&th.emoji)||'';
    return (em?em+' ':'')+title;
  }
  function paintBanner(P){
    const c=P.canvas.getContext('2d');c.fillStyle='#fff6dc';c.beginPath();if(c.roundRect)c.roundRect(4,6,504,84,22);else c.rect(4,6,504,84);c.fill();
    c.strokeStyle='#e0a13a';c.lineWidth=6;c.stroke();c.fillStyle='#d0543a';c.textAlign='center';c.textBaseline='middle';c.font='700 46px Nunito, system-ui, sans-serif';c.fillText(bannerText(),256,50,470);
    if(P.tex)P.tex.needsUpdate=true;
  }
  function startBanner(){const P=sky4.plane;if(!P||P.g.visible)return false;paintBanner(P);P.dir=Math.random()<.5?1:-1;P.x=P.dir>0?-7:25;P.z=3+Math.random()*10;P.g.visible=true;sky4.planes++;return true;}
  function startFlock(){
    const g=sky4.g;if(!g||sky4.flocks.length>=2)return false;
    const grp=new THREE.Group();g.add(grp);const dir=Math.random()<.5?1:-1,birds=[];
    for(let i=0;i<7;i++){const b=new THREE.Group();grp.add(b);ball(b,.035,mat('#4a4f5a',.8),0,0,0).scale.set(1.5,.8,.8);
      const ws=[];for(const s of [-1,1]){const w=new THREE.Group();w.position.set(0,.01,s*.03);b.add(w);box(w,.05,.008,.09,mat('#5a6070',.8),0,0,s*.05,false);ws.push({w,s});}
      const k=Math.ceil(i/2)*(i%2?1:-1);b.position.set(-Math.abs(k)*.22*dir,0,k*.26);birds.push({b,ws,k});}
    grp.position.set(dir>0?-6:24,2.6+Math.random()*.8,2+Math.random()*12);
    sky4.flocks.push({grp,birds,dir,x:grp.position.x,t:0});sky4.flocksRun++;sound('chirp');return true;
  }
  function updateStage4(dt,dark){
    if(!sky4.built)return;sky4.t+=dt;const t=sky4.t,wet=weatherKind==='rain'||weatherKind==='storm',wind=windNow();
    // rainbow after rain
    if(sky4.wasWet&&!wet&&dark<.45&&weatherKind!=='snow'){sky4.rainbowT=75;sky4.rainbows++;}
    sky4.wasWet=wet;
    const R=sky4.rainbow;if(R){
      if(sky4.rainbowT>0)sky4.rainbowT-=dt;const u=sky4.rainbowT;const k=u>0?Math.min(1,(75-u)/8,u/14):0;
      R.visible=k>.01;R.children.forEach(m=>{m.material.opacity=.42*k;});}
    // leaves in the wind
    for(const L of sky4.leaves){
      if(wind&&!L.on&&Math.random()<dt*.9){L.on=true;L.x=-1+Math.random()*4;L.z=.5+Math.random()*17;L.y=.4+Math.random()*1.0;L.vx=1.1+Math.random()*1.2;L.vz=.2+Math.random()*.8;L.m.visible=true;sky4.leavesBlown++;}
      if(L.on){L.x+=L.vx*dt;L.z+=L.vz*dt;L.ph+=dt*4;L.y=Math.max(.2,L.y+Math.sin(L.ph*.7)*dt*.5-dt*.03);L.m.position.set(L.x,L.y,L.z);L.m.rotation.set(L.ph,L.ph*.6,L.ph*1.3);
        if(L.x>19.5){L.on=false;L.m.visible=false;}}
      else if(!wind&&L.m.visible)L.m.visible=false;
    }
    // the banner plane crosses on fine days
    const P=sky4.plane;if(P){
      if(!P.g.visible&&t>sky4.nextPlane&&dark<.4&&!wet&&weatherKind!=='fog'){startBanner();sky4.nextPlane=t+150+Math.random()*90;}
      if(P.g.visible){P.x+=P.dir*2.3*dt;P.g.position.set(P.x,P.y+Math.sin(t*1.3)*.08,P.z);P.g.rotation.y=P.dir>0?0:Math.PI;P.prop.rotation.x+=dt*40;P.banner.rotation.x=Math.sin(t*3)*.05;
        if(P.x>26||P.x<-9)P.g.visible=false;}
    }
    // bird flocks at dawn and dusk
    if(t>sky4.nextFlock&&dark>.05&&dark<.55&&!wet){startFlock();sky4.nextFlock=t+80+Math.random()*60;}
    for(let i=sky4.flocks.length-1;i>=0;i--){const F=sky4.flocks[i];F.t+=dt;F.x+=F.dir*1.5*dt;F.grp.position.x=F.x;F.grp.rotation.y=F.dir>0?0:Math.PI;
      for(const b of F.birds){const f=Math.sin(F.t*14+b.k)*.8;for(const w of b.ws)w.w.rotation.x=f*w.s;b.b.position.y=Math.sin(F.t*2+b.k)*.05;}
      if(F.x>26||F.x<-9){F.grp.parent?.remove(F.grp);sky4.flocks.splice(i,1);}}
  }

  /* ---- Stage 5: festival days and street events. A festival (lantern / harvest / spring) is picked at random for
     the day (or with ?festival=); street events (a wedding procession, a street-food cart with a queue, a juggler with an
     audience) pop up at random through the day. All visual, pooled and pavement-friendly. ---- */
  const fest={built:false,kind:'none',t:0,lanternMats:[],dragon:null,dragonOn:0,dragonNext:20,maypole:null,ev:null,nextEv:45,events:0,log:[],decor:0,g:null,leafs:[]};
  function festivalKind(){
    const q=typeof location!=='undefined'?new URLSearchParams(location.search).get('festival'):null;
    if(q&&['none','lantern','harvest','spring'].includes(q))return q;
    let key='';try{key=town.dateKey?.()||'';}catch(e){}let h=7;for(const ch of key)h=(h*31+ch.charCodeAt(0))>>>0;const r=(h%100)/100;
    return r<.4?'none':r<.6?'lantern':r<.8?'harvest':'spring';
  }
  const FEST_NAME={lantern:'Lantern Festival',harvest:'Harvest Fair',spring:'Spring Flower Day'};
  function announce(text){try{const el=document.getElementById('tick');if(el)el.textContent=text;}catch(e){}}
  function createStage5(){
    const g=new THREE.Group();world.add(g);fest.g=g;fest.built=true;fest.t=0;fest.lanternMats=[];fest.dragon=null;fest.maypole=null;fest.ev=null;fest.decor=0;fest.leafs=[];
    fest.kind=festivalKind();const base=.17;
    if(fest.kind==='lantern'){
      // paper lanterns strung over the two middle streets, glowing at dusk
      const cols=['#e2463a','#f08a4b','#f5c04b','#e2463a','#ff8fb0'];
      for(const rz of [6.5,11.5]){
        const n=15,pts=[];
        for(let i=0;i<n;i++){const x=2.0+i*(13.9/(n-1)),y=.92-Math.sin(i/(n-1)*Math.PI)*.1;pts.push([x,y]);
          const m=new THREE.MeshStandardMaterial({color:cols[i%5],emissive:cols[i%5],emissiveIntensity:.3,roughness:.6});fest.lanternMats.push(m);
          const l=object(g,geo('sphere',.05),m,x,y-.05,rz,false);l.scale.set(.85,1.15,.85);box(g,.03,.012,.03,'#8a6d4e',x,y+.005,rz,false);fest.decor++;}
        for(let i=0;i<n-1;i++){const a=pts[i],b=pts[i+1],r=cylinder(g,.004,.004,1,'#6b5a48',(a[0]+b[0])/2,(a[1]+b[1])/2,rz);r.castShadow=false;pointAlong(r,a[0],a[1],rz,b[0],b[1],rz);}
      }
      // the dragon: a long red-and-gold dragon that dances round the central block in the evening
      const dr=new THREE.Group();g.add(dr);const segs=[];
      const head=new THREE.Group();dr.add(head);const hm=object(head,geo('soft',.2,.13,.15,.05),mat('#d6392c',.6),0,.2,0);
      for(const s of [-1,1]){ball(head,.02,mat('#fff6d0',.3),.1,.25,s*.05);ball(head,.01,mat('#222',.4),.115,.25,s*.05);const horn=object(head,new THREE.ConeGeometry(.015,.07,5),mat('#f5c04b',.5),.0,.31,s*.05,false);horn.rotation.z=-.3;}
      box(head,.06,.03,.12,'#f5c04b',.12,.17,0,false);
      segs.push({m:head,head:true});
      for(let i=0;i<9;i++){const s=object(dr,geo('sphere',.085),mat(i%2?'#f5c04b':'#d6392c',.6),0,.2,0);s.scale.set(1.1,.9,1);segs.push({m:s});}
      const tail=object(dr,new THREE.ConeGeometry(.05,.2,6),mat('#d6392c',.6),0,.2,0);tail.rotation.z=Math.PI/2;segs.push({m:tail});
      dr.visible=false;fest.dragon={g:dr,segs,u:0};
    }else if(fest.kind==='harvest'){
      const sp=(typeof freeSpots==='function'?freeSpots():[]).filter(s=>s.clear>.35).slice(0,12);
      sp.forEach((s,i)=>{
        const x=s.x+(i%3-1)*.35,z=s.z+(i%2?.3:-.3);
        if(i%3===0){for(let k=0;k<3;k++){const p=ball(g,.07,mat(['#f08a2b','#e2742a','#f5a03a'][k],.7),x+k*.13-.1,base+.06,z+(k%2)*.08);p.scale.set(1.15,.85,1.15);cylinder(g,.008,.008,.04,'#5a7a3a',x+k*.13-.1,base+.13,z+(k%2)*.08);}fest.decor+=3;}
        else if(i%3===1){const b=cylinder(g,.1,.1,.17,'#e6c978',x,base+.1,z);b.rotation.x=Math.PI/2;b.scale.z=1;cylinder(g,.1,.1,.17,'#dcb85c',x+.2,base+.1,z+.02).rotation.x=Math.PI/2;fest.decor+=2;}
        else{for(let k=0;k<3;k++){cylinder(g,.012,.012,.26,'#9fbf4f',x+k*.06,base+.13,z);ball(g,.025,mat('#f5d04a',.6),x+k*.06,base+.28,z).scale.set(.7,1.5,.7);}fest.decor+=3;}
      });
      const sc=new THREE.Group();const q=sp[sp.length-1];sc.position.set(q?q.x+.4:9.6,base,q?q.z:7.4);g.add(sc);
      cylinder(sc,.012,.012,.5,'#8a6d4e',0,.25,0);cylinder(sc,.012,.012,.34,'#8a6d4e',0,.42,0).rotation.z=Math.PI/2;ball(sc,.05,mat('#e6c978',.9),0,.55,0);cylinder(sc,.06,.06,.015,'#7a5a3a',0,.6,0);cylinder(sc,.035,.04,.05,'#7a5a3a',0,.63,0);box(sc,.22,.1,.03,'#c9743a',0,.35,0,false);fest.decor+=4;
    }else if(fest.kind==='spring'){
      for(const l of lanterns){   // flower garlands round the street-lamp posts
        for(let k=0;k<7;k++){const a=k/7*TAU;ball(g,.022,mat(['#ff9fbf','#ffe27a','#ffffff','#c9a6ff','#ff9f8a'][k%5],.7),l.x+Math.cos(a)*.045,base+.55+(k%2)*.05,l.z+Math.sin(a)*.045).castShadow=false;fest.decor++;}
      }
      const sp=(typeof freeSpots==='function'?freeSpots():[]).filter(s=>s.clear>.9);
      const P=sp[Math.min(2,sp.length-1)];
      if(P){const mp=new THREE.Group();mp.position.set(P.x,base,P.z);g.add(mp);cylinder(mp,.02,.025,.95,'#c99a64',0,.47,0);ball(mp,.04,mat('#ffe27a',.5),0,.97,0);
        const rib=[],dan=[];const rc=['#ff7a9a','#7fc4ff','#ffd23f','#9ccf6a','#c39be0','#ff9a4a'];
        for(let k=0;k<6;k++){const r=cylinder(mp,.004,.004,1,rc[k],0,.5,0);r.castShadow=false;rib.push(r);
          const q=person({col:rc[k],skin:['#f1c9a5','#d8a77c','#a8754f'][k%3],hair:k%2?'#49362d':'#333947',ph:k*1.3+3,x:k,y:k*2});q.scale.setScalar(CUTE*.9);q.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);mp.add(q);dan.push(q);}
        fest.maypole={g:mp,rib,dan};fest.decor+=8;}
    }
    if(fest.kind!=='none')announce('Today is the '+FEST_NAME[fest.kind]+'!');
  }
  function eventSpot(minClear=.5){const sp=(typeof freeSpots==='function'?freeSpots():[]).filter(s=>s.clear>minClear);return sp.length?sp[Math.floor(Math.random()*Math.min(5,sp.length))]:{x:14.2,z:8.8};}
  function startEvent(kind){
    if(!fest.built||fest.ev)return false;const g=new THREE.Group();fest.g.add(g);const base=.17,E={kind,g,t:0,dur:80,parts:[]};
    const mk=(i,col,sc=1)=>{const q=person({col,skin:['#f1c9a5','#d8a77c','#a8754f','#7a4e33'][i%4],hair:i%2?'#49362d':'#333947',ph:i*1.9+5.5,x:i+1,y:i*3,hat:null});q.scale.setScalar(CUTE*sc);q.userData.limbs.headPivot.scale.setScalar(HEAD_BIG);g.add(q);return q;};
    if(kind==='wedding'){
      E.dur=75;const z=16.07;E.z=z;E.x=.9;
      const bride=mk(1,'#ffffff'),groom=mk(2,'#2f3a4a');const veil=ball(bride.userData.limbs.headPivot,.115,mat('#ffffff',.6),0,.07,-.02);veil.scale.set(1.1,.6,1.1);
      // Side by side, in pairs, not in single file: the couple first, then three pairs of guests.
      E.walkers=[{q:bride,off:0,dz:-.04},{q:groom,off:.02,dz:.04}];
      for(let i=0;i<6;i++)E.walkers.push({q:mk(3+i,['#f2a99b','#9ccf9a','#7fb3d9','#f2c36b','#c39be0','#f0a574'][i],i<2?.8:1),off:-.75-Math.floor(i/2)*.5-(i%2)*.06,dz:i%2?.04:-.04});
      const cart=new THREE.Group();g.add(cart);box(cart,.5,.07,.26,'#fff6e8',0,.09,0);for(const x of [-.18,.18])for(const s of [-1,1]){const w=cylinder(cart,.045,.045,.025,'#4f5560',x,.045,s*.14);w.rotation.x=Math.PI/2;}
      box(cart,.34,.2,.02,'#fff6e8',0,.22,-.12);for(let k=0;k<6;k++)ball(cart,.035,mat(['#ff9fbf','#ffffff','#ffe27a'][k%3],.7),-.2+k*.08,.17,.06);sign(cart,'JUST MARRIED',0,.33,.0,.34);
      E.cart=cart;E.walkers.push({q:null,off:-2.5,cart:true});E.nextConf=1;
      announce('A wedding procession is marching through town!');
    }else if(kind==='cart'){
      E.dur=85;const s=eventSpot(.35);E.x=s.x;E.z=s.z;
      const cart=new THREE.Group();cart.position.set(s.x,base,s.z);g.add(cart);const names=['NOODLES','TACOS','CREPES','DUMPLINGS'],name=names[Math.floor(Math.random()*4)];
      box(cart,.5,.16,.28,'#e8664d',0,.18,0);box(cart,.54,.03,.32,'#f5e6c8',0,.28,0);for(const x of [-.2,.2])for(const sd of [-1,1]){const w=cylinder(cart,.05,.05,.025,'#4f5560',x,.05,sd*.15);w.rotation.x=Math.PI/2;}
      for(const x of [-.23,.23])cylinder(cart,.01,.01,.34,'#8a6d4e',x,.45,-.1);const aw=box(cart,.6,.03,.36,'#f2c36b',0,.62,-.04);aw.rotation.x=.12;for(let k=0;k<6;k++)ball(cart,.03,mat(k%2?'#ffffff':'#e2463a',.8),-.25+k*.1,.6,.13).scale.set(1,.7,.6);
      sign(cart,name,0,.74,-.02,.42);E.steam=[];for(let k=0;k<3;k++){const m=new THREE.Mesh(geo('sphere',.035),new THREE.MeshBasicMaterial({color:'#fff',transparent:true,opacity:0,depthWrite:false}));cart.add(m);E.steam.push({m,ph:k*.33});}
      const cook=mk(7,'#ffffff');cook.position.set(s.x,base,s.z-.34);cook.rotation.y=Math.PI;E.cook=cook;
      E.queue=[];for(let i=0;i<3;i++){const q=mk(8+i,['#9ccf9a','#c39be0','#f0a574'][i],i===1?.85:1);q.position.set(s.x+.45+i*.32,base,s.z+.28);q.rotation.y=-Math.PI/2*0+Math.PI*1.5;E.queue.push({q,i,x:s.x+.45+i*.32,z:s.z+.28,leave:0});}
      E.nextServe=3;announce('A street-food cart is open: '+name+'!');
    }else{
      E.dur=70;const s=eventSpot(.4);E.x=s.x;E.z=s.z;
      const j=mk(6,'#e2463a');j.position.set(s.x,base,s.z);E.j=j;E.balls=[0,1,2].map(i=>{const b=ball(g,.03,mat(['#ffd23f','#ff6f91','#6fd0ff'][i],.4),s.x,.6,s.z);b.castShadow=false;return b;});
      sign(g,'THE GREAT JUGGLER',s.x,base+.9,s.z-.35,.5);
      E.aud=[];for(let i=0;i<4;i++){const a=mk(10+i,['#7fb3d9','#f2c36b','#9ccf9a','#c39be0'][i]);const ang=Math.PI*.3+i*.7;a.position.set(s.x+Math.cos(ang)*.62,base,s.z+Math.sin(ang)*.62);a.rotation.y=Math.atan2(s.x-a.position.x,s.z-a.position.z);E.aud.push(a);}
      announce('A juggler is performing in the park!');
    }
    fest.ev=E;fest.events++;fest.log.push(kind);sound('chime');return true;
  }
  function updateStage5(dt,dark){
    if(!fest.built)return;fest.t+=dt;const t=fest.t,base=.17,wet=weatherKind==='rain'||weatherKind==='storm';
    for(const m of fest.lanternMats)m.emissiveIntensity=.3+dark*2.4;
    // dragon dance in the evenings of a lantern festival
    const D=fest.dragon;if(D){
      if(!fest.dragonOn&&t>fest.dragonNext&&dark>.2&&dark<.95&&!wet){fest.dragonOn=60;D.u=0;D.g.visible=true;announce('The dragon dance begins in the square!');sound('chime');}
      if(fest.dragonOn>0){fest.dragonOn-=dt;D.u+=dt*.5;const r=[[6.93,6.93],[11.07,6.93],[11.07,11.07],[6.93,11.07]],n=4;
        D.segs.forEach((s,i)=>{const u=((D.u-i*.14)%n+n)%n,k=Math.floor(u),f=u-k,a=r[k],b=r[(k+1)%n],x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;
          s.m.position.set(x,base+.06+Math.abs(Math.sin(t*5+i*.7))*.05,z);s.m.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1])-Math.PI/2;});
        if(fest.dragonOn<=0){D.g.visible=false;fest.dragonNext=t+110+Math.random()*60;}}
    }
    // maypole dancers
    const M=fest.maypole;if(M){M.dan.forEach((q,i)=>{const a=t*.7+i/6*TAU,r=.4;q.position.set(Math.cos(a)*r,0,Math.sin(a)*r);q.rotation.y=-a;walkAnim(q,true,t*6+i);});
      M.rib.forEach((r,i)=>{const a=t*.7+i/6*TAU;pointAlong(r,0,.95,0,Math.cos(a)*.4,.34,Math.sin(a)*.4);});}
    // street events
    if(!fest.ev&&t>fest.nextEv&&dark<.7&&weatherKind!=='storm'){startEvent(['wedding','cart','juggler'][Math.floor(Math.random()*3)]);}
    const E=fest.ev;if(E){
      E.t+=dt;
      if(E.kind==='wedding'){E.x+=.45*dt;
        for(const w of E.walkers){const x=E.x+w.off;if(w.cart){E.cart.position.set(x,base,E.z-.03);}else{w.q.position.set(x,GROUND.pave+GROUND.foot+Math.abs(Math.sin(t*9+w.off*3))*.01,E.z+(w.dz||0));w.q.rotation.y=Math.PI/2;walkAnim(w.q,true,t*6+w.off*5);}}
        if(E.t>E.nextConf){E.nextConf+=4;confettiAt(E.x-.5,.6,E.z);sound('pop');}
        if(E.x+E.walkers[E.walkers.length-1].off>17.4)E.t=E.dur;
      }else if(E.kind==='cart'){
        for(const s of E.steam){const u=(t*.5+s.ph)%1;s.m.position.set(.1,.72+u*.3,0);s.m.scale.setScalar(.6+u*1.5);s.m.material.opacity=.6*(1-u);}
        const Lc=E.cook.userData.limbs;if(Lc){Lc.arms[1].rotation.x=-.9+Math.sin(t*6)*.4;}
        if(E.t>E.nextServe){E.nextServe+=5;const front=E.queue.find(q=>q.i===0&&!q.leave);if(front){front.leave=1;sound('pop');}}
        for(const q of E.queue){const L=q.q.userData.limbs;
          if(q.leave){q.q.rotation.y=Math.PI*.5;q.x+=.35*dt;q.z+=.2*dt;walkAnim(q.q,true,t*6+q.i*3);q.leave+=dt;if(q.leave>6){q.leave=0;q.i=3;q.x=E.x+.45+3*.32;q.z=E.z+.28;}}
          else{const tx=E.x+.45+q.i*.32;if(Math.abs(q.x-tx)>.01){q.x+=Math.sign(tx-q.x)*Math.min(Math.abs(tx-q.x),.3*dt);walkAnim(q.q,true,t*6+q.i);q.q.rotation.y=-Math.PI/2*(Math.sign(tx-q.x)||1)*-1+Math.PI;}else{walkAnim(q.q,false,0);q.q.rotation.y=Math.PI*1.5;
            if(q.i>0&&L)L.arms[1].rotation.x=0;}}
          q.q.position.set(q.x,base,q.z);
          // those that have walked off fade away at a distance, re-joining at the back
          q.q.visible=!(q.leave>3.5);}
        // advance the queue after a serve
        const ids=E.queue.filter(q=>!q.leave).map(q=>q.i).sort((a,b)=>a-b);ids.forEach((v,k)=>{const q=E.queue.find(o=>!o.leave&&o.i===v);if(q&&q.i>k)q.i=k;});
      }else{
        E.balls.forEach((b,i)=>{const a=t*4.2+i*2.09;b.position.set(E.x+Math.sin(a)*.14,base+.42+Math.abs(Math.cos(a))*.3,E.z+.03);});
        const L=E.j.userData.limbs;if(L){L.arms[0].rotation.x=-1.6+Math.sin(t*8.4)*.4;L.arms[1].rotation.x=-1.6-Math.sin(t*8.4)*.4;L.elbows.forEach(e=>{e.rotation.x=-.5;});}
        E.aud.forEach((a,i)=>{const Q=a.userData.limbs;if(Q){const c=Math.sin(t*9+i)*.4;Q.arms[0].rotation.x=-1.2+c;Q.arms[1].rotation.x=-1.2-c;Q.elbows.forEach(e=>{e.rotation.x=-.8;});}});
      }
      if(E.t>=E.dur){E.g.parent?.remove(E.g);fest.ev=null;fest.nextEv=t+100+Math.random()*80;}
    }
  }

  // The vehicles are small designed machines rather than stacked colored
  // cubes. Each axle has its own spinning rig, and taillights react to
  // braking. No point lights or heavyweight physics are allocated per car.
  function car(ref){
    // Small, round and friendly: every vehicle is a soft pastel toy with big
    // headlight eyes, not a boxy model. Footprints stay inside the simulation's
    // collision boxes (car .57 long, bus .81), so stopped cars never overlap.
    const g=new THREE.Group(),kind=ref.kind||'car';
    const bus=kind==='bus',fire=kind==='fire',cream=kind==='icecream',police=kind==='police',taxi=kind==='taxi',racer=kind==='racer';
    const L=bus?.70:fire?.60:racer?.46:.44,Wd=bus?.27:.25,H=bus?.15:.12;
    const base=taxi?'#f6d56a':police?'#8fb2e8':fire?'#ea6f62':cream?'#ffd3e6':bus?'#7fb8e6':(ref.col||'#a0bfc7');
    const body=tint(base,'#ffffff',.14),soft=(w,h,d,r,col,x,y,z)=>object(g,geo('soft',w,h,d,r),typeof col==='string'?mat(col,.7):col,x,y,z);
    soft(L,H,Wd,.055,body,0,.04+H/2,0);
    // Glass cabin, rounded roof cap, pillars implied by a lighter frame.
    const glass=mat('#cfe7ee',.22,'#7b9b98');
    const cabL=bus?L*.84:L*.50,cabH=bus?.13:.105,cabY=.04+H+cabH/2-.012;
    soft(cabL,cabH,Wd*.88,.045,glass,bus?0:-L*.07,cabY,0);
    soft(cabL+.01,.03,Wd*.9,.02,body,bus?0:-L*.07,cabY+cabH/2+.006,0);
    if(bus)for(const zz of [-1,1])for(let k=0;k<4;k++)soft(.012,.13,.012,.005,body,-L*.31+k*L*.21,cabY,zz*Wd*.45);
    else for(const zz of [-1,1])soft(.012,cabH*.95,.012,.005,body,-L*.07+cabL*.1,cabY,zz*Wd*.44);
    // Wheels: four spinning axles.
    const wheels=[],r=bus?.058:.052;
    for(const xx of [-L*.30,L*.32])for(const zz of [-1,1]){
      const axle=new THREE.Group();axle.position.set(xx,r,zz*(Wd/2-.003));g.add(axle);
      const tire=cylinder(axle,r,r,.04,'#4f5560');tire.rotation.x=Math.PI/2;
      const hub=cylinder(axle,r*.5,r*.5,.044,'#f4ecdc');hub.rotation.x=Math.PI/2;
      wheels.push(axle);
    }
    // Headlight "eyes".
    for(const zz of [-1,1]){
      ball(g,.032,mat('#fffaf0',.3),L/2-.012,.04+H*.62,zz*Wd*.28);
      ball(g,.016,mat('#34404a',.4),L/2+.012,.04+H*.62,zz*Wd*.28);
    }
    const brakeMaterial=new THREE.MeshStandardMaterial({color:'#e8837a',emissive:'#ed4938',emissiveIntensity:.075,roughness:.4});
    const indicators=[];
    for(const side of [-1,1]){
      soft(.02,.036,.05,.01,brakeMaterial,-L/2+.002,.04+H*.55,side*Wd*.28);
      const m=new THREE.MeshStandardMaterial({color:'#f2c27c',emissive:'#f5a34b',emissiveIntensity:.025,roughness:.45});
      const lamp=soft(.018,.022,.03,.008,m,-L/2+.002,.04+H*.86,side*Wd*.38);
      indicators.push({lamp,side});
    }
    // Pastel bumpers give the front a smile.
    soft(.022,.028,Wd*.62,.012,'#fdf4e3',L/2-.004,.04+H*.16,0);
    soft(.022,.028,Wd*.62,.012,'#fdf4e3',-L/2+.004,.04+H*.16,0);
    const roofY=cabY+cabH/2+.02;
    if(taxi){soft(.12,.04,.07,.016,'#fffaf0',-L*.07,roofY+.014,0);soft(.06,.014,.07,.006,'#3b3b3b',-L*.07,roofY+.016,0);}
    else if(police){
      soft(.02,.03,Wd*.84,.01,'#ffffff',-L*.02,.04+H*.5,0);
      soft(.03,.034,.05,.012,'#ff6b6b',-L*.07,roofY+.014,-.05);soft(.03,.034,.05,.012,'#6b9bff',-L*.07,roofY+.014,.05);
    }else if(fire){
      soft(.34,.014,.05,.006,'#fff3d8',-.06,roofY+.02,-.04);soft(.34,.014,.05,.006,'#fff3d8',-.06,roofY+.02,.04);
      for(let k=0;k<5;k++)soft(.012,.016,.11,.004,'#fff3d8',-.2+k*.07,roofY+.02,0);
      soft(.04,.03,.06,.012,'#ff5b4d',L*.28,roofY+.014,0);
    }else if(cream){
      const cone=cylinder(g,.002,.045,.1,'#f2c987',-L*.07,roofY+.07,0);
      ball(g,.052,mat('#fff6fb',.6),-L*.07,roofY+.135,0);
      ball(g,.03,mat('#ff6f91',.5),-L*.07,roofY+.19,0);
    }else if(bus){
      soft(.1,.022,.2,.01,'#fff3d8',L*.18,roofY+.01,0);
    }else if(racer){
      soft(.02,.003,Wd*.84,.002,'#fffaf0',0,.04+H+.002,0);
    }
    g.userData.vehicleRig={wheels,brakeMaterial,indicators,axleHalf:L*.31*VEHICLE_SCALE};
    g.userData.vehicleClass=kind;
    // Tiny toy vehicles: the whole machine is drawn at VEHICLE_SCALE (the simulation's bodies are sized to match).
    const outer=new THREE.Group();
    g.scale.setScalar(VEHICLE_SCALE);outer.add(g);
    outer.userData=g.userData;
    return outer;
  }
  // Cyclists are small and round: the whole bicycle is scaled well below the toy cars, with fat tyres, a pastel frame and a big-headed rider.
  const BIKE_SCALE=.42;
  const VEHICLE_SCALE=.8;
  function bicycle(ref){
    const inner=bicycleParts(ref),outer=new THREE.Group();
    inner.scale.setScalar(BIKE_SCALE);outer.add(inner);
    outer.userData=inner.userData;return outer;
  }
  function bicycleParts(ref){
    const g=new THREE.Group(),col=ref.col||'#7cb2ad';
    const wheels=[];
    for(const x of [-.19,.19]){
      const spin=new THREE.Group();spin.position.set(x,.169,0);g.add(spin);
      const tire=object(spin,geo('torus',.113,.03),mat('#465357'),0,0,0);
      // The frame runs along local X; wheel circles MUST lie in XY.
      // Turning a torus by 90° made the bicycle wheels edge-on/flat.
      for(let k=0;k<6;k++){
        const spoke=cylinder(spin,.0035,.0035,.190,'#d2d8d0');
        spoke.rotation.z=k*Math.PI/6;
        spoke.castShadow=false;
      }
      const hub=ball(spin,.024,'#d2d8d0',0,0,0);hub.castShadow=false;
      wheels.push(spin);
    }
    // Triangle-frame tubes connecting realistic physical points.
    const rod=(x1,y1,x2,y2,color=col,thickness=.014)=>{
      const midX=(x1+x2)/2,midY=(y1+y2)/2;
      const length=Math.hypot(x2-x1,y2-y1);
      const tube=cylinder(g,thickness,thickness,length,color,midX,midY,0);
      tube.rotation.z=-Math.atan2(x2-x1,y2-y1);tube.castShadow=false;
    };
    rod(-.19,.169,-.055,.302);rod(.19,.169,-.055,.302);
    rod(-.055,.302,.04,.169);rod(-.19,.169,.04,.169);
    rod(.04,.169,-.055,.302);rod(.19,.169,.128,.36,'#697f81');
    rod(-.055,.302,-.11,.352,'#626a6a');
    box(g,.115,.028,.070,'#5c6669',-.117,.361,0);
    box(g,.024,.019,.25,'#72858a',.129,.375,0);
    const crank=new THREE.Group();crank.position.set(.038,.172,0);g.add(crank);
    for(const sx of [-1,1]){
      const pedal=box(crank,.065,.020,.042,'#59676c',0,sx*.068,sx*.051);
      pedal.castShadow=false;
    }
    const torso=ball(g,.077,ref.col||'#b88d86',-.055,.481,0);
    torso.scale.set(.8,1.23,.74);
    ball(g,.098,ref.skin||'#d6ae87',-.047,.655,0);
    const helmet=ball(g,.106,'#f08a7a',-.045,.725,0);
    helmet.scale.set(1,.5,1);helmet.castShadow=false;
    for(const e of [-1,1])ball(g,.014,'#2d3640',.045,.665,e*.05).castShadow=false;   // eyes
    // Jointed rider legs follow the actual crank/pedal orbit, rather than
    // two decorative tubes permanently stuck to the bicycle frame.
    const legs=[];
    for(const side of [-1,1]){
      const z=side*.055;
      const thigh=cylinder(g,.024,.025,.16,'#526a72',-.05,.34,z);
      const shin=cylinder(g,.019,.023,.16,'#586c76',.012,.245,z);
      const shoe=box(g,.078,.025,.044,'#5d5550',.038,.12,z);
      legs.push({side,z,thigh,shin,shoe});
    }
    const grip=mat('#636b68');
    for(const side of [-1,1]){
      const hand=ball(g,.021,ref.skin||'#d6ae87',.139,.379,side*.09);
      const arm=cylinder(g,.018,.019,.145,ref.col||'#b88d86',.047,.428,side*.068);
      arm.rotation.z=-.48;
    }
    g.userData.bicycleRig={wheels,crank,legs};
    g.userData.vehicleClass='bike';
    return g;
  }
  function creature(ref){
    const g=new THREE.Group(),kind=ref.kind;
    const rig={kind,legs:[],wings:[],ears:[],tail:null,head:null,
      body:null,bodyScale:1,pace:0,lastClock:null};
    if(kind==='ghost'){
      const core=ball(g,.18,'#faf1e4',0,.25,0);core.scale.set(.82,1.4,.88);
      const cloak=ball(g,.17,'#f3e9df',0,.16,0);cloak.scale.set(.99,.47,1);
      for(const z of [-.085,.085])ball(g,.016,'#465263',.137,.30,z);
      g.userData.creatureRig=rig;return g;
    }
    if(kind==='penguin'){
      const torso=ball(g,.155,'#43545c',0,.255,0);
      torso.scale.set(.72,1.23,.88);
      const bib=ball(g,.126,'#f7eee1',.091,.245,0);bib.scale.set(.38,1.22,.88);
      const head=ball(g,.116,'#45535d',0,.45,0);
      for(const z of [-.057,.057])ball(g,.014,'#252e38',.094,.472,z);
      const beak=box(g,.095,.038,.066,'#e3a461',.142,.419,0);
      for(const z of [-.095,.095]){
        const flipper=new THREE.Group();flipper.position.set(0,.333,z);g.add(flipper);
        const wing=ball(flipper,.107,'#52656e',0,-.053,z>0?.025:-.025);
        wing.scale.set(.35,1.1,.51);rig.wings.push(flipper);
        box(g,.115,.031,.075,'#e4a662',.065,.115,z);
      }
      rig.head=head;g.userData.creatureRig=rig;return g;
    }
    if(kind==='hen'){
      const breast=ball(g,.145,'#f7eee0',0,.205,0);
      breast.scale.set(1.22,.81,.91);
      const neck=ball(g,.074,'#fff4e0',.133,.266,0);
      const head=ball(g,.072,'#fff7e9',.175,.312,0);
      const crest=ball(g,.032,'#d76a64',.16,.384,0);crest.scale.set(1,.95,.52);
      const beak=box(g,.067,.023,.045,'#dfa05d',.245,.307,0);
      for(const z of [-.105,.105]){
        const wingGroup=new THREE.Group();wingGroup.position.set(-.015,.238,z);g.add(wingGroup);
        const wing=ball(wingGroup,.092,'#ead9bc',-.015,-.015,0);
        wing.scale.set(1.22,.52,.56);rig.wings.push(wingGroup);
        const leg=cylinder(g,.010,.013,.083,'#d4a16d',.065,.091,z*.52);
        leg.castShadow=false;
        ball(g,.012,'#2d3031',.223,.336,z*.27);
      }
      for(let k=0;k<3;k++)ball(g,.055,'#eddec8',-.16-k*.017,
        .225+k*.035,(k-1)*.053);
      rig.head=head;g.userData.creatureRig=rig;return g;
    }
    if(kind==='dino'){
      const body=ball(g,.32,'#83b494',0,.38,0);body.scale.set(1.3,.78,.81);
      const neck=new THREE.Group();neck.position.set(.24,.56,0);g.add(neck);
      cylinder(neck,.13,.13,.38,'#8ab99b',0,.10,0);
      const head=ball(neck,.16,'#9cc7a0',.02,.35,0);
      for(const z of [-.125,.125])ball(neck,.018,'#364a43',.118,.39,z);
      rig.head=neck;
      for(let k=0;k<5;k++){
        const plate=ball(g,.075,'#64947c',-.22+k*.14,.607,0);
        plate.scale.set(.7,1.17,.75);
      }
      const tail=new THREE.Group();tail.position.set(-.29,.36,0);g.add(tail);
      const tip=ball(tail,.25,'#80ad8d',-.21,-.025,0);tip.scale.set(1.20,.36,.49);
      rig.tail=tail;
      for(const x of [-.21,.20]){
        const leg=new THREE.Group();leg.position.set(x,.24,0);g.add(leg);
        cylinder(leg,.055,.065,.24,'#729e80',0,-.12,0);rig.legs.push(leg);
      }
      g.userData.creatureRig=rig;return g;
    }
    // Quadrupeds have a connected head, moving tail and a real four-leg gait.
    const llama=kind==='llama',fur=llama?'#e8dec9':'#ad8866';
    const body=ball(g,llama?.20:.175,fur,0,llama?.37:.265,0);
    body.scale.set(1.40,.79,.87);
    rig.body=body;rig.bodyScale=.79;
    for(const x of [-.16,.16])for(const z of [-.095,.095]){
      const leg=new THREE.Group();leg.position.set(x,llama?.28:.21,z);g.add(leg);
      const size=llama?.27:.17;
      cylinder(leg,.032,.040,size,fur,0,-size*.46,0);
      const paw=ball(leg,.036,llama?'#b7a991':'#806c57',
        .035,-size*.9,.01);paw.scale.set(1.27,.42,.78);
      rig.legs.push(leg);
    }
    const neck=new THREE.Group();neck.position.set(.22,llama?.49:.35,0);g.add(neck);
    if(llama)cylinder(neck,.071,.086,.36,fur,0,.11,0);
    const face=ball(neck,llama?.106:.115,fur,.04,llama?.31:.01,0);
    face.scale.set(1.15,.90,.96);
    const y=llama?.42:.115;
    const muzzle=ball(neck,.062,llama?'#e3d5bf':'#c9aa8a',.138,y-.025,0);
    muzzle.scale.set(1.15,.65,.85);
    for(const side of [-1,1]){
      const ear=ball(neck,.045,fur,.012,y+.105,side*.08);
      ear.scale.set(.61,1.40,.60);rig.ears.push(ear);
      ball(neck,.013,'#332f2c',.125,y+.006,side*.083);
    }
    const tail=new THREE.Group();tail.position.set(-.225,llama?.40:.32,0);g.add(tail);
    const tuft=ball(tail,llama?.077:.065,fur,-.065,.032,0);
    tuft.scale.set(1.25,.66,.75);rig.tail=tail;rig.head=neck;
    g.userData.creatureRig=rig;return g;
  }
  function actor(ref){
    const animal=['dog','hen','penguin','llama','dino','ghost'].includes(ref.kind);
    const g=ref.kind==='bike'?bicycle(ref):ref.type==='car'?car(ref):animal?creature(ref):person(ref);
    if(animal)g.scale.setScalar((ANIMAL_SCALE[ref.kind]||.6)*CUTE/.8);   // animals match the small residents (the dog was as tall as a person)
    g.position.set(ref.x,0,ref.y);
    const kind=ref.kind==='bike'?'bike':ref.type==='car'?'car':animal?'animal':'person';
    // Feathered miniature contact pads hold feet and tyres to the terrain
    // even under overcast lighting and at close zoom.
    const pad=object(g,geo('sphere',.11),contactMaterial,0,
      kind==='car'?.101:kind==='bike'?.057:kind==='animal'?.042:.012,0,false);
    const spread=kind==='car'?[2.45,.065,1.4]:
      kind==='bike'?[1.55,.06,.9]:kind==='animal'?[1.35,.05,1.05]:[.85,.045,.60];
    pad.scale.set(...spread);
    world.add(g);
    actors.set(ref,{group:g,kind});
  }
  // The bridge decks stand above the road: anything crossing rises onto the deck (a smooth ramp at each end).
  // How high the arched deck stands above the road at (x,z): 0 off the bridge.
  function archHeight(x,z){
    const u=z-14;if(Math.abs(u)>=ARCH.L||!LINES.some(l=>Math.abs(x-(l+.5))<.66))return 0;
    return archTop(u)-ARCH.y0;
  }
  function archSlope(x,z){   // dy/dz of the deck
    const u=z-14;if(Math.abs(u)>=ARCH.L||!LINES.some(l=>Math.abs(x-(l+.5))<.66))return 0;
    return -ARCH.H*Math.PI/(2*ARCH.L)*Math.sin(Math.PI*u/ARCH.L);
  }
  function bridgeContact(x,z,facing,half){
    const dx=Math.cos(facing)*half,dz=-Math.sin(facing)*half;
    const front=archHeight(x+dx,z+dz),rear=archHeight(x-dx,z-dz);
    return {front,rear,height:(front+rear)/2,pitch:Math.atan2(front-rear,half*2)};
  }
  // Raised pavements and the asphalt sit above the meadow, so a resident's feet follow whatever is under them.
  const GROUND={lawn:.13,road:.172,pave:.225,foot:.034};
  const smooth01=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
  function streetLevel(d){
    if(d>=.56)return GROUND.lawn;
    if(d<.34)return GROUND.road;
    return d<.5?GROUND.road+(GROUND.pave-GROUND.road)*smooth01(.34,.38,d):GROUND.pave+(GROUND.lawn-GROUND.pave)*smooth01(.5,.56,d);
  }
  // The paved city centre (see cityCentre) is a flat square at CENTRE_TOP; people stand on it, not in the lawn under it.
  const CENTRE_TOP=.18;
  function centreAmount(x,z){
    const r=(x0,x1,z0,z1)=>smooth01(0,.07,Math.min(x-x0,x1-x,z-z0,z1-z));
    return Math.max(r(7.04,10.0,8.04,10.96),r(9.9,10.96,9.0,10.0));
  }
  function groundLevel(x,z){
    let dx=9,dz=9;for(const l of LINES){dx=Math.min(dx,Math.abs(x-(l+.5)));dz=Math.min(dz,Math.abs(z-(l+.5)));}
    return Math.max(streetLevel(dx),streetLevel(dz),GROUND.lawn+(CENTRE_TOP-GROUND.lawn)*centreAmount(x,z));
  }
  // Each resident walks in a style of their own: stride rate and swing, arm swing, bounce and lean, and a few habits.
  function walkStyle(ref){
    const id=ref.ph||0,rr=n=>{const x=Math.sin(id*12.9898+n*78.233)*43758.5453;return x-Math.floor(x);};
    return {freq:.82+rr(1)*.4,amp:.78+rr(2)*.48,arm:.5+rr(3)*.95,bounce:.45+rr(4)*1.15,lean:(rr(5)-.4)*.07,
      phone:rr(6)<.42,period:55+rr(7)*70,off:rr(8)*100,pockets:rr(9)<.22,stretch:rr(10)<.3,period2:80+rr(11)*90,off2:rr(12)*100};
  }
  function settleHumanPose(limbs,state,dt){
    if(!state.jointRotations){
      state.jointRotations=[...limbs.arms,...limbs.elbows,...limbs.wrists,limbs.upperBody].map(j=>({j,x:j.rotation.x,y:j.rotation.y,z:j.rotation.z}));return;
    }
    for(const p of state.jointRotations)for(const axis of ['x','y','z']){
      const k=1-Math.exp(-(limbs.elbows.includes(p.j)?28:16)*dt);
      p[axis]+=(p.j.rotation[axis]-p[axis])*k;p.j.rotation[axis]=p[axis];
    }
  }
  function syncActors(poseDt=null){
    const live=new Set(town.movers());
    for(const [ref,item] of actors)if(!live.has(ref)){
      item.group.parent?.remove(item.group);actors.delete(ref);
    }
    for(const ref of live) {
      if(!actors.has(ref))actor(ref);
      const item=actors.get(ref),g=item.group;
      const lane=ref.lane||0,d=ref.d||0,path=!!ref.path;
      const off=ref.type==='car'?
        (d<2?{x:0,z:(d===0?1:-1)*lane}:
          {x:(d===2?-1:1)*lane,z:0}):
        (d<2?{x:0,z:lane}:{x:-lane,z:0});
      const desiredX=ref.x+(path?0:off.x),desiredZ=ref.y+(path?0:off.z);
      // Ground-contact calibration: wheels touch the road instead of floating.
      // Wheels and feet rest on the surface under them: the asphalt top is .172, a pavement .225, the meadow .13.
      const arch=archHeight(desiredX,desiredZ);
      const vehicleFacing=Number.isFinite(ref.heading)?-ref.heading:[0,Math.PI,-Math.PI/2,Math.PI/2][d];
      const contact=(item.kind==='car'||item.kind==='bike')?bridgeContact(desiredX,desiredZ,vehicleFacing,g.userData.vehicleRig?.axleHalf||.19*BIKE_SCALE):null;
      if(contact)g.userData.bridgeContact=contact;
      const rest=item.kind==='car'?.192+contact.height:item.kind==='bike'?.162+contact.height:
        item.kind==='animal'?.13+arch:ref.sit?.10+arch:
        Math.max(groundLevel(desiredX,desiredZ),arch>0?ARCH.y0+arch:0)+GROUND.foot;
      if(item.kind==='person'&&ref.tossAt&&ref.tossAt!==item.tossSeen){item.tossSeen=ref.tossAt;crumbsAt(ref.x,ref.y<14?13.25:14.75);sound('pop');}
      {const jit=item.kind==='person'&&!ref.sit&&path&&!ref.shopRole?(((ref.ph||0)*7.31)%1-.5)*.08:0;   // each walker keeps a slightly different line on the pavement
       g.position.set(desiredX+(d<2?0:jit),rest,desiredZ+(d<2?jit:0));}
      {const now=town.debug().clock||0;if(ref.hopUntil&&now<ref.hopUntil)g.position.y+=Math.abs(Math.sin((ref.hopUntil-now)*(item.kind==='car'?16:11)))*(item.kind==='car'?.045:.11);}
      const a=Number.isFinite(ref.heading)?-ref.heading:[0,Math.PI,-Math.PI/2,Math.PI/2][d];
      // Cars, bicycles and quadrupeds point along local +X; only sculpted
      // residents have local +Z faces. Keep both aligned with actual travel.
      const travelFacing=a+(item.kind==='person'?Math.PI/2:0);
      if(item.kind!=='person'){g.rotation.y=travelFacing;
        // On the arch a car or bike tips up the slope and down the other side (it points along local +X).
        if(item.kind==='car'||item.kind==='bike'){g.rotation.order='YXZ';g.rotation.z=contact.pitch;}}
      const limbs=g.userData.limbs;
      const shopBag=g.userData.shopBag;
      if(shopBag){
        const on=ref.shopBag>=0;
        if(shopBag.visible!==on)shopBag.visible=on;
        if(on&&shopBag.userData.bagColour!==ref.shopBag){shopBag.material=mat(SHOP_BAG_COLOURS[ref.shopBag%SHOP_BAG_COLOURS.length],.85);shopBag.userData.bagColour=ref.shopBag;}
      }
      if(limbs){
        // Distance owns the footstep clock. Time only smooths transitions and
        // breathing, so a stopped person never runs in place or foot-slides.
        const state=g.userData.pose,worldTime=town.debug().clock,S=state.style||(state.style=walkStyle(ref));
        const dt=poseDt??(state.lastClock===null?1/30:
          THREE.MathUtils.clamp(worldTime-state.lastClock,1/120,.09));
        state.lastClock=worldTime;
        const ease=(value,target,rate)=>value+(target-value)*
          (1-Math.exp(-rate*dt));
        // When a person actually stops to speak, rotate their whole stance
        // toward their companion. Continuous angular motion avoids snap turns
        // and leaves independent head tracking free for small eye movements.
        const focus=ref.attention;
        const toward=focus?Math.hypot(focus.x-ref.x,focus.y-ref.y):0;
        const social=(ref.intent==='chat'||ref.intent==='greeting'||
          ref.intent==='browse'||ref.intent==='visiting'||
          !!ref.shopRole||!!ref.districtResident);
        const turnToFocus=focus&&toward>.11&&social&&(ref.v||0)<.055;
        // Use the actual direction of a scripted pavement leg, including
        // diagonal approaches to benches, counters and neighboring residents.
        // The simulation pauses for large pivots, so this does not slide feet.
        const pathFacing=ref.path&&Number.isFinite(ref.walkFacing)?
          ref.walkFacing:travelFacing;
        const desiredFacing=turnToFocus?
          Math.atan2(focus.x-ref.x,focus.y-ref.y):pathFacing;
        if(!state.turned){g.rotation.y=pathFacing;state.turned=true;}
        const facingError=Math.atan2(Math.sin(desiredFacing-g.rotation.y),
          Math.cos(desiredFacing-g.rotation.y));
        g.rotation.y+=THREE.MathUtils.clamp(facingError,-3.8*dt,3.8*dt);
        const moving=(ref.moved===undefined?ref.v>.032:ref.moved>.00015)&&
          !ref.sit&&(!ref.stopUntil||worldTime>=ref.stopUntil);
        state.speed=ease(state.speed,moving&&!reducedMotion?
          THREE.MathUtils.clamp(ref.v/(ref.max||.55),0,1):0,11.0);
        state.sit=ease(state.sit,ref.sit?1:0,5.2);
        state.chat=ease(state.chat,ref.intent==='chat'&&!reducedMotion?1:0,4.4);
        const speaking=Math.max(0,Math.sin(worldTime*1.35+(ref.ph||0)));
        state.speak=ease(state.speak,state.chat*speaking,3.8);
        state.greet=ease(state.greet,!reducedMotion&&ref.waveUntil&&
          worldTime<ref.waveUntil?1:0,6);
        state.observe=ease(state.observe,!reducedMotion&&
          (ref.intent==='browse'||ref.intent==='visiting')&&
          toward>.11&&(ref.v||0)<.05?1:0,3);
        state.serve=ease(state.serve,!reducedMotion&&
          (ref.shopAction==='offering'||ref.shopAction==='serving')?1:0,6.0);
        state.receive=ease(state.receive,!reducedMotion&&
          (ref.shopAction==='receiving'||ref.shopAction==='handoff')?1:0,7.0);
        state.knock=ease(state.knock,!reducedMotion&&
          ref.shopRole==='customer'&&ref.shopAction==='knocking'?1:0,12);
        state.order=ease(state.order,!reducedMotion&&
          ref.shopRole==='customer'&&ref.shopAction==='ordering'?1:0,8);
        state.depart=ease(state.depart,!reducedMotion&&
          ref.shopRole==='customer'&&ref.shopAction==='carrying'?1:0,5);
        state.enjoy=ease(state.enjoy,!reducedMotion&&
          (ref.shopAction==='reading'||ref.shopAction==='eating')?1:0,5.5);
        state.work=ease(state.work,!reducedMotion&&ref.districtWorker&&
          ref.districtAction==='working'?1:0,5);
        const celebration=ref.newsMood==='cheer'||ref.newsMood==='celebrate'||(ref.cheerUntil&&worldTime<ref.cheerUntil);
        state.celebrate=ease(state.celebrate,!reducedMotion&&celebration?1:0,5);
        const playing=ref.guitar&&ref.shopAction==='performing';
        state.play=ease(state.play,!reducedMotion&&playing?1:0,6);
        state.dance=ease(state.dance,!reducedMotion&&ref.dance?1:0,5);
        const goods=g.userData.shopProps;
        if(goods){
          const vendorProduct=ref.shopRole==='vendor'?
            (ref.shopVenue==='bakery'?'bread':'book'):null;
          const available=ref.carrying||
            (ref.shopAction==='handoff'?null:vendorProduct);
          if(goods.bread)goods.bread.visible=available==='bread';
          if(goods.book)goods.book.visible=available==='book';
        }
        const stridePhase=(ref.travel||0)*17*S.freq+(ref.ph||0);
        const stride=Math.sin(stridePhase);
        // Strongest motion happens in swing; each foot rocks toward the
        // street at contact rather than following a rigid pendulum.
        for(let k=0;k<2;k++){
          const phase=k===0?stride:-stride;
          const swing=phase*state.speed;
          const recover=Math.max(0,-phase)*state.speed;
          limbs.legs[k].rotation.x=-1.16*state.sit+
            (1-state.sit)*swing*(ref.gait==='brisk'?.8:.74)*S.amp+
            state.dance*.19*Math.sin(worldTime*4.2+k*Math.PI);
          limbs.shins[k].rotation.x=state.sit*.75+
            (1-state.sit)*recover*.94;
          // An ankle counter-rotates the hip/knee chain: the support sole
          // stays level while the free foot rolls through toe-off.
          limbs.feet[k].rotation.x=(1-state.sit)*(-limbs.legs[k].rotation.x-limbs.shins[k].rotation.x+
            Math.max(0,phase)*.16*state.speed-recover*.12);
          // A very small independent hip rise prevents both toes from
          // scraping the ground during the recovery half of the cycle.
          limbs.legs[k].position.y=.178+
            Math.max(0,-phase)*state.speed*.017;
        }
        // Conversation has separate listening and speaking arm postures:
        // wrists turn outward, elbows flex, and a greeting unfolds smoothly.
        // The bag and basket remain physically attached to the left palm.
        for(let k=0;k<2;k++){
          const swing=k===0?stride:-stride;
          const dominant=k===1;
          const speech=dominant?state.speak:state.chat*.17;
          const inspect=dominant?state.observe:0;
          const wave=dominant?state.greet:0;
          const carrying=(k===0&&(ref.bag||ref.kind==='farmer'||
            ref.kind==='keeper'))||(k===1&&ref.shopBag>=0);
          const trading=dominant?state.serve:state.serve*.18;
          const receiving=dominant?state.receive:state.receive*.12;
          const reading=ref.carrying==='book';
          const using=dominant||reading?state.enjoy:state.enjoy*.60;
          limbs.arms[k].rotation.x=state.sit*.20-
            swing*state.speed*(carrying?.18:ref.gait==='brisk'?.62:.52)*S.arm-
            state.chat*(dominant?.25:.07)-speech*.30-inspect*.22-wave*.52-
            trading*.72-receiving*.56-using*1.18-
            (dominant?state.knock*1.28+state.order*.92:state.order*.13)-
            (dominant?state.depart*.53:0)-
            state.celebrate*(dominant?1.85:1.35)-
            state.dance*.66-
            (dominant?state.work*.66:state.work*.14)-
            (dominant?state.play*.62:state.play*.39);
          limbs.arms[k].rotation.z=(k===0?1:-1)*
            (.07+.10*state.chat+.06*state.observe+state.enjoy*(reading?.50:.20))-
            wave*.89;
          limbs.elbows[k].rotation.x=
            -.56*speech-.46*inspect-.84*wave-
            trading*.50-receiving*.80-using*.70-
            (dominant?state.knock*.76+state.order*.58:state.order*.1)-
            (dominant?state.depart*.28:0)-
            state.celebrate*.47-state.dance*.58-state.play*.65-
            (dominant?state.work*.55:0)+
            (carrying?.20:0)+state.sit*.15;
          limbs.wrists[k].rotation.x=
            -.14*speech-.30*inspect-.25*wave;
          limbs.wrists[k].rotation.z=(dominant?-1:1)*
            (.08*state.chat+.11*state.observe)+
            wave*.24*Math.sin(worldTime*5.4+(ref.ph||0))+
            (dominant?state.work*.25*Math.sin(worldTime*3.1+(ref.ph||0)):0)+
            (dominant?state.knock*.23*Math.sin(worldTime*14.5):0);
        }
        for(let k=0;k<2;k++){
          const hand=limbs.hands[k].userData.handRig;if(!hand)continue;
          const held=k===0?(ref.bag||ref.briefcase||ref.kind==='farmer'||ref.kind==='keeper'||(ref.carrying==='book'&&state.enjoy>.1)):
            (ref.carrying||ref.shopBag>=0||ref.shopRole==='vendor'||ref.guitar);
          const target=held?.82:Math.min(.4,.16+state.speed*.14+state.knock*.24);
          hand.curl=ease(hand.curl,target,10);
          hand.fingers.forEach((f,i)=>{f.rotation.x=-hand.curl*(1+i*.08);f.rotation.z=(i-1)*state.speak*.10;});
          hand.thumb.rotation.z=(k?1:-1)*(.18+hand.curl*.45);
          limbs.wrists[k].rotation.y=(k?1:-1)*(state.speak*.22+state.greet*.17-state.receive*.12+state.enjoy*.15);
        }
        // The whole torso shifts weight, leans into greetings and settles
        // naturally after walking. Small limits preserve miniature balance.
        const lean=state.speed*(.043+S.lean);
        const beat=Math.sin(stridePhase*2);
        limbs.upperBody.rotation.x=lean+
          state.serve*.080+state.receive*.12+state.enjoy*.045+
          state.work*.060+state.knock*.065+state.order*.046+
          state.chat*.036*Math.sin(worldTime*1.5+(ref.ph||0));
        limbs.upperBody.rotation.z=.020*state.speed*stride+
          .024*state.chat*(Math.floor(ref.ph||0)%2?1:-1)+
          state.play*.065*Math.sin(worldTime*7)+
          state.dance*.12*Math.sin(worldTime*4.2+(ref.ph||0));
        limbs.upperBody.position.x=.008*state.chat*(1-state.speak)*(Math.floor(ref.ph||0)%2?1:-1);
        limbs.upperBody.position.y=.006*Math.sin(worldTime*2.0+(ref.ph||0))+
          Math.abs(beat)*state.speed*(ref.gait==='skip'?.045:.018)*S.bounce+
          state.celebrate*.038*Math.abs(Math.sin(worldTime*5.4+(ref.ph||0)))+
          state.dance*.017*Math.abs(Math.sin(worldTime*4.2+(ref.ph||0)));
        // A head turn follows an actual attention target; a chat creates
        // a subtle listening nod rather than repetitive random swivels.
        const glancing=ref.glanceUntil&&worldTime<ref.glanceUntil;
        const target=ref.attention||(glancing?ref.glanceAt:null)||(ref.lookUntil&&worldTime<ref.lookUntil?ref.lookAt:null);
        let yaw=0;
        if(target){
          const dx=target.x-ref.x,dz=target.y-ref.y;
          const angle=Math.atan2(dx,dz);
          yaw=THREE.MathUtils.clamp(Math.atan2(
            Math.sin(angle-g.rotation.y),Math.cos(angle-g.rotation.y)),-.64,.64);
        }
        if(!target&&!reducedMotion){const idle=Math.sin(worldTime*.37+(ref.ph||0)*2.3);if(Math.abs(idle)>.82)yaw=Math.sign(idle)*.42;}   // a look about now and then
        limbs.headPivot.rotation.y+=(yaw-limbs.headPivot.rotation.y)*
          (1-Math.exp(-6.5*dt));
        limbs.headPivot.rotation.x=(.025*state.speak+.055*state.chat*(1-state.speak))*Math.sin(worldTime*1.6+(ref.ph||0))+state.enjoy*(ref.carrying==='book'?.24:.07);
        limbs.headPivot.rotation.z=(1-state.chat)*.021*
          Math.sin(worldTime*.95+(ref.ph||0));
        // A mouth and eyebrows that answer the conversation, instead of
        // faces that stay frozen while the arms perform gestures.
        limbs.smile.scale.y=.40+.30*state.chat+.22*state.speak+
          .16*state.celebrate+.12*state.play;
        for(let k=0;k<2;k++)
          limbs.brows[k].rotation.z=(k===0?1:-1)*
            (.12+.15*state.speak+.10*state.observe);
        const chew=ref.carrying==='bread'?state.enjoy*(.45+.35*Math.sin(worldTime*5)):0;
        limbs.mouth.visible=state.speak>.08||state.celebrate>.15||chew>.1;
        limbs.mouth.scale.y=.15+state.speak*.65+state.celebrate*.45+chew*.25;
        const blink=(worldTime*.96+(ref.ph||0)*.53)%6.8;
        for(const eye of limbs.eyelids||[]){
          eye.scale.y=blink<.12?.16:1;
          if(eye.userData.pupil){eye.userData.pupil.position.x=yaw*.004;eye.userData.pupil.position.y=-state.enjoy*.003;}
        }
        const expression=blink<.12?'blink':state.celebrate>.15?'happy':state.speak>.08?'talk':
          state.enjoy>.2?(ref.carrying==='book'?'read':'eat'):state.chat>.15?'listen':'neutral';
        limbs.faceSurface.material=faceFrame(expression,yaw>.25?1:yaw<-.25?-1:0);
        // Body and shoes share one small bounce, which vanishes smoothly
        // at a stop without changing the actual world-space position.
        g.position.y+=Math.max(0,Math.sin(stridePhase*2))*
          state.speed*.009*S.bounce;
        // Habits: some residents check a phone now and then, some walk with hands in pockets, some stretch.
        if(!ref.kind&&!ref.shopRole&&state.chat+state.speak+state.greet+state.serve<.2){
          const walking=state.speed>.12;
          if(S.phone&&walking&&((worldTime+S.off)%S.period)<5.5){
            limbs.headPivot.rotation.x=.5;limbs.arms[1].rotation.x=-1.55;limbs.arms[1].rotation.z=-.15;limbs.elbows[1].rotation.x=-1.3;
          }else if(S.pockets&&walking&&!ref.bag){
            for(let k=0;k<2;k++){limbs.arms[k].rotation.x=.22;limbs.arms[k].rotation.z=(k?-1:1)*.2;limbs.elbows[k].rotation.x=-.35;}
          }else if(S.stretch&&((worldTime+S.off2)%S.period2)<1.6){
            const u=Math.sin(((worldTime+S.off2)%S.period2)/1.6*Math.PI);
            for(let k=0;k<2;k++){limbs.arms[k].rotation.x=-2.5*u;limbs.arms[k].rotation.z=(k?-1:1)*.25*u;}
            limbs.headPivot.rotation.x=-.2*u;
          }
        }
        settleHumanPose(limbs,state,dt);
        // Lift the rig by the support sole's analytic height. Motion stays
        // distance-driven; knees and toes no longer sink through the pavement.
        if(state.sit<.05){
          let sole=Infinity;
          for(let k=0;k<2;k++){
            const a=limbs.legs[k].rotation.x,b=limbs.shins[k].rotation.x;
            const y=limbs.legs[k].position.y-.096*Math.cos(a)-.100*Math.cos(a+b)-.024*Math.sin(a+b)-.022;
            sole=Math.min(sole,y);
          }
          g.position.y-=sole*g.scale.y;g.userData.supportSole=0;
        }
      }
      if(item.kind==='car'||item.kind==='bike'){
        const rig=g.userData.vehicleRig;
        if(rig){
          for(const wheel of rig.wheels)wheel.rotation.z=-(ref.travel||0)*15;   // smaller wheels turn faster for the same ground speed
          rig.brakeMaterial.emissiveIntensity=ref.braking?.90:.075;
          for(const {lamp,side} of rig.indicators){
            const flashes=ref.turnSignal&&(ref.turnUntil||0)>town.debug().clock &&
              Math.floor(town.debug().clock*3.4)%2===0;
            const direction=ref.turnSignal==='left'?1:-1;
            lamp.material.emissiveIntensity=flashes&&direction===side?1.9:.025;
          }
        }
        const bike=g.userData.bicycleRig;
        if(bike){
          const angle=(ref.travel||0)*15;
          for(const wheel of bike.wheels)wheel.rotation.z=-(ref.travel||0)*8.85;
          bike.crank.rotation.z=angle;
          // Solve the tiny rider's two knee chains against rotating pedals.
          // Shoes, knees and ankles move in contact with their bicycle.
          const link=(part,ax,ay,bx,by,z,rest)=>{
            part.position.set((ax+bx)*.5,(ay+by)*.5,z);
            part.rotation.z=-Math.atan2(bx-ax,by-ay);
            part.scale.y=Math.hypot(bx-ax,by-ay)/rest;
          };
          for(const leg of bike.legs){
            const phase=angle+(leg.side>0?0:Math.PI);
            const footX=.038-.068*Math.sin(phase);
            const footY=.172+.068*Math.cos(phase);
            const hx=-.067,hy=.385,dx=footX-hx,dy=footY-hy;
            const span=Math.hypot(dx,dy),bend=Math.sqrt(Math.max(0,.16*.16-span*span/4));
            const kneeX=(hx+footX)*.5-dy/span*bend;
            const kneeY=(hy+footY)*.5+dx/span*bend;
            link(leg.thigh,hx,hy,kneeX,kneeY,leg.z,.16);
            link(leg.shin,kneeX,kneeY,footX,footY,leg.z,.16);
            leg.shoe.position.set(footX+.015,footY+.020,leg.z);
            leg.shoe.rotation.z=.10*Math.sin(phase);
          }
        }
      }
      if(item.kind==='animal' && !reducedMotion){
        const rig=g.userData.creatureRig;
        const phase=(ref.travel||0)*12+(ref.ph||0);
        if(rig){
          const t=town.debug().clock;
          const dt=rig.lastClock===null?1/30:THREE.MathUtils.clamp(
            t-rig.lastClock,1/120,.09);
          rig.lastClock=t;
          const goal=ref.sit?0:Math.min(1,(ref.v||0)*2.2);
          rig.pace+=(goal-rig.pace)*(1-Math.exp(-7.4*dt));
          const motion=reducedMotion?0:rig.pace;
          for(let k=0;k<rig.legs.length;k++){
            // Alternating *diagonal* pairs make a proper quadruped trot,
            // while tiny stance pauses imply contact instead of paddling.
            const offset=(rig.legs.length===4?
              (k===0||k===3?0:Math.PI):(k%2?Math.PI:0));
            const foot=Math.sin(phase+offset);
            rig.legs[k].rotation.z=foot*motion*.29;
          }
          for(let k=0;k<rig.wings.length;k++)
            rig.wings[k].rotation.x=(k%2?-1:1)*Math.sin(phase)*motion*.30;
          if(rig.body)rig.body.scale.y=rig.bodyScale*(
            1+.013*Math.sin(t*2.6+(ref.ph||0))+
            .024*motion*Math.abs(Math.sin(phase*2)));
          if(rig.ears.length){
            for(let k=0;k<rig.ears.length;k++)
              rig.ears[k].rotation.x=.05*Math.sin(t*1.7+(ref.ph||0)+k)+
                (ref.watch==='owner'?.16:.03);
          }
          if(rig.tail)rig.tail.rotation.y=Math.sin(
            town.debug().clock*(ref.watch==='owner'?5.1:3.1)+(ref.ph||0))*
            (ref.sit?.38:.25);
          if(rig.head?.rotation){
            const target=ref.attention;
            const dx=target?target.x-ref.x:0,dz=target?target.y-ref.y:0;
            const desired=target?THREE.MathUtils.clamp(
              Math.atan2(dx,dz)-g.rotation.y,-.52,.52):0;
            rig.head.rotation.y+=(desired-rig.head.rotation.y)*.19;
            rig.head.rotation.z=Math.sin(town.debug().clock*1.8+(ref.ph||0))*.045;
          }
          // Sitting lowers the hips while paws remain visually anchored.
          if(ref.sit&&rig.kind==='dog'){
            g.position.y-=.035;
            for(const leg of rig.legs)leg.rotation.z*=.30;
          }
        }
        g.position.y+=Math.abs(Math.sin(phase))*Math.min(.013,(ref.v||0)*.025);
      }
    }
  }
  function animateAmbient(time){
    for(const a of ambient){
      // Reduced motion still updates meaningful shop-window state;
      // only decorative motion is skipped.
      if(reducedMotion&&a.kind!=='marketCounter')continue;
      if(a.kind==='duck'){
        a.mesh.position.set(a.ref.x,.21+Math.sin(time*1.75+a.phase)*.025,a.ref.y);
        a.mesh.rotation.y=(a.ref.vx<0?Math.PI:0)+Math.sin(time*.58+a.phase)*.14;
        for(let k=0;k<(a.mesh.userData.duckWings||[]).length;k++){
          a.mesh.userData.duckWings[k].rotation.x=
            (k===0?1:-1)*Math.sin(time*2.7+a.phase)*.22;
        }
      } else if(a.kind==='water'){
        const pulse=.88+.16*Math.sin(time*1.1+a.phase);
        a.mesh.scale.set(pulse,pulse,pulse);
        a.mesh.position.y=.159+.004*Math.sin(time*.85+a.phase);
      } else if(a.kind==='squareJet'){
        a.mesh.scale.y=.985+.015*Math.sin(time*2.2);
      } else if(a.kind==='sea'){
        const pulse=.9+.12*Math.sin(time*1.0+a.phase);
        if(a.bob)a.mesh.position.y=a.y0+.012*Math.sin(time*1.4+a.phase);
        else{a.mesh.scale.set(pulse,pulse,pulse);}
      } else if(a.kind==='sail'){
        const t=time*a.speed+a.phase,dir=a.speed<0?-1:1;
        a.mesh.position.set(9+Math.cos(t)*a.R,SEA_Y+.004*Math.sin(time*1.3+a.phase),9+Math.sin(t)*a.R*.94);
        a.mesh.rotation.y=Math.atan2(-Math.cos(t)*dir,-Math.sin(t)*dir);
        a.mesh.rotation.z=.04*Math.sin(time*.9+a.phase);
      } else if(a.kind==='umbrella'){
        a.mesh.rotation.y=.055*Math.sin(time*.28+a.phase);
      } else if(a.kind==='bunting'){
        a.mesh.rotation.x=.11*Math.sin(time*1.5+a.phase);
      } else if(a.kind==='pinwheel'){
        a.mesh.rotation.z=time*.85+a.phase;
      } else if(a.kind==='balloon'){
        a.mesh.rotation.z=.065*Math.sin(time*.95+a.phase);
        a.mesh.rotation.x=.065*Math.cos(time*.72+a.phase);
      } else if(a.kind==='marketCounter'){
        const shop=a.mesh.userData.streetFront;
        const kind=a.mesh.userData.workingShop;
        const seller=town.movers().find(m=>m.shopRole==='vendor'&&m.shopVenue===kind);
        const handing=seller?.shopAction==='handoff';
        const waiting=town.movers().some(m=>m.shopRole==='customer'&&
          m.shopAt===kind&&
          ['knocking','approachingCounter','ordering','receiving'].includes(m.shopPhase));
        const shoppers=town.movers().some(m=>m.shopRole==='customer'&&
          m.shopAt===kind&&
          ['ordering','receiving'].includes(m.shopPhase));
        if(handing&&!shop.previousHandoff){
          shop.ringUntil=time+.9;shop.serviceCount++;
        }
        shop.previousHandoff=!!handing;
        shop.hasCustomers=shoppers;
        shop.openTarget=waiting?1:0;
        // Animate against simulation clock, not render frame count; no
        // sudden door jump on fast phones and no idle perpetual motion.
        const dt=shop.lastTime===null?1/30:
          THREE.MathUtils.clamp(time-shop.lastTime,1/120,.12);
        shop.lastTime=time;
        shop.openAmount=reducedMotion?shop.openTarget:
          shop.openAmount+(shop.openTarget-shop.openAmount)*
          (1-Math.exp(-8*dt));
        for(const {hinge,side} of shop.shutters)
          hinge.rotation.y=side*shop.openAmount*1.02;
        // The glass-fronted cabinet is illuminated when occupied;
        // the bell rings exactly when the simulation completes service.
        shop.lampMaterial.emissiveIntensity+=
          ((shoppers?.75:.19)-shop.lampMaterial.emissiveIntensity)*.15;
        shop.bell.rotation.z=time<shop.ringUntil?
          .34*Math.sin((shop.ringUntil-time)*26)*
          Math.min(1,(shop.ringUntil-time)*2.3):0;
      } else if(a.kind==='butterfly'){
        a.mesh.position.set(a.x+.13*Math.cos(time*.65+a.phase),
          .72+.085*Math.sin(time*1.1+a.phase),
          a.z+.11*Math.sin(time*.47+a.phase));
        a.mesh.rotation.y=time*.37+a.phase;
        const flutter=Math.sin(time*12+a.phase)*.72;
        a.wings[0].rotation.y=flutter;
        a.wings[1].rotation.y=-flutter;
      }
    }
  }
  function light(time){
    const dark=THREE.MathUtils.clamp(time,0,1);
    // Continuous color-temperature progression (no dusk hue snapping).
    // Daylight, shadow fill, haze and lanterns now belong to one exposure.
    const dusk=dark*dark*(3-2*dark);
    // Real night: past dusk the light turns cool and dim (moonlight), the sky goes deep blue and the exposure drops, so the
    // lit windows, lamps and signals carry the scene instead of a daylight scene with a bluer tint.
    const deep=THREE.MathUtils.clamp((dark-.3)/.6,0,1),night=deep*deep*(3-2*deep);
    hemisphere.intensity=.86-dark*.2-night*.4;
    hemisphere.color?.set?.(tint('#fff1dc','#7f9ee0',night));hemisphere.groundColor?.set?.(tint('#6f8580','#1b2846',night));
    sun.intensity=2.6-dark*1.9-night*.3;
    rim.intensity=.39+dark*.06;
    sun.color.set(tint(tint('#ffd7a4','#ee9c70',dusk),'#8fa9ee',night*.92));
    rim.color.set(tint(tint('#c0dedb','#a8b6cb',dusk),'#6f8bd0',night));
    for(const lantern of plazaLights)lantern.intensity=dark*7.2;
    {const under=sunK;sun.intensity*=under;hemisphere.intensity*=.82+under*.18;
     {const left=flashUntil-clockMs();if(left>0)hemisphere.intensity+=.9*Math.min(1,left/260);}}   // a brief fading brightening, not a white-out
    for(const p of porchLamps)p.glass.emissiveIntensity=p.b.home&&dark>.25?2.4:.05;   // lights on once someone is home
    lanternGlass.emissiveIntensity=.1+dark*4.2;
    for(const bulb of festoonBulbs)bulb.material.emissiveIntensity=.32+dark*1.65;
    for(const pane of windowMaterials){
      pane.emissiveIntensity=(pane.userData?.warm?.12:.04)+
        dark*(pane.userData?.warm?1.02:.66);
    }
    {const sky=tint('#cee9f5','#91a9c5',dusk);   // an overcast sky under rain, storm, fog or snow, eased in and out
     const nightSkyCol=tint(sky,'#0b1630',night*.97);
     scene.background.set(grayK>.01?tint(nightSkyCol,tint(grayCol,'#1a2338',night),grayK):nightSkyCol);}
    scene.fog.color.copy(scene.background);
    renderer.toneMappingExposure=.98-dark*.12-night*.14;
    lens?.setDusk(dark);
    for(const p of materialCache.values()){
      if(p.emissive && p.emissive.r>.03) p.emissiveIntensity=.14+dark*1.25;
    }
  }
  function resize(){
    const w=Math.max(1,host.clientWidth||window.innerWidth);
    const h=Math.max(1,host.clientHeight||window.innerHeight);
    const sz=w+'x'+h;
    if(sz===lastSize)return;
    lastSize=sz;renderer.setSize(w,h,false);lens?.setSize(w,h);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
  }
  function syncCamera(){
    const state=town.debug(),v=state.cam;
    const aspect=renderer.domElement.width/Math.max(1,renderer.domElement.height);
    const fit=Math.min(1,Math.max(.30,aspect*28/27))*(desktop()?.70:.50);
    const t=THREE.MathUtils.clamp((v.z-(town.fitView?.()||.475))/.52,0,1);
    const scaled=v.z*(desktop()?1.5:1.58);
    const equivalentOrthoZoom=THREE.MathUtils.lerp(fit,scaled,t);
    camera.zoom=1; // actual field-of-view is held constant during the dolly
    // At close-up, lower the virtual eye to show windows, porch geometry and
    // faces; a gentle interpolation preserves the calm overview perspective.
    const closeness=THREE.MathUtils.clamp((v.z-1.0)/2.7,0,1);
    lens?.setFocus(THREE.MathUtils.clamp((v.z-.6)/1.6,0,1));
    // Bring the eye down as we approach: rooftops remain visible, but
    // shop glazing, porches and characters occupy more of the composition.
    // More architectural eye-level at zoom: the previous high camera showed
    // mostly roofs and hid the ornate shopfronts and modeled character faces.
    // At close zoom, frame the landmark shopfronts. Panning away removes
    // the added focus automatically; user gestures still own the camera.
    const focusWeight=THREE.MathUtils.clamp((v.z-.90)/.90,0,1)*
      THREE.MathUtils.clamp(1-Math.hypot(v.x-9,v.y-9)/2.9,0,1);
    const aimX=v.x-focusWeight*.09,aimZ=v.y-focusWeight*.42;
    const legacy=window.location?.search?.includes('legacycam=1');
    const dx=legacy?12.5:7.4,dy=legacy?23-closeness*11.5:
      20.4-closeness*9.4,dz=legacy?22:24;
    // The view orbits the town: the whole horizontal offset turns by the sim's yaw (0 = the original front view).
    const yaw=v.yaw||0,cyaw=Math.cos(yaw),syaw=Math.sin(yaw),dxr=dx*cyaw-dz*syaw,dzr=dx*syaw+dz*cyaw;
    const length=Math.hypot(dxr,dy,dzr);
    // Match the old orthographic camera's visible height *at the center*
    // and preserve the entire tabletop at Fit. Moving the optical center
    // closer creates genuine foreground/background size separation.
    // A long dolly for Fit minimizes wide-angle edge distortion.
    const verticalSpan=28/Math.max(.08,equivalentOrthoZoom);
    const distance=verticalSpan/(2*Math.tan(camera.fov*Math.PI/360));
    const targetY=legacy?.30:.43;
    camera.position.set(aimX+dxr/length*distance,
      targetY+dy/length*distance,
      aimZ+dzr/length*distance);
    camera.lookAt(aimX,targetY,aimZ);
    // Fog in the old orthographic shot assumed an eye always ~30 units
    // away. A real perspective dolly ranges from ~9 to ~50 units. Fixed
    // fog distances washed the entire overview into pale gray. Keep the
    // diorama clear at its focus depth, allowing haze only beyond it.
    scene.fog.near=Math.max(18,distance*.86);
    scene.fog.far=Math.max(90,distance*3.2);   // only the farthest edge softens; no haze over the town
    if(weatherKind==='fog'){scene.fog.near=distance*.55;scene.fog.far=distance*1.6;}
    else if(weatherKind==='rain'||weatherKind==='storm'){scene.fog.far=Math.max(60,distance*2.3);}
    camera.updateProjectionMatrix();
  }
  // Keep the frame rate: if drawing a frame takes too long for a while, lower the
  // render resolution one step (2 → 1.6 → 1.3 → 1); never raise it back mid-visit.
  let slowFrames=0,sharpSamples=0,shadowTick=0;
  const clockMs=()=>globalThis.performance?.now?.()??Date.now();
  // `ms` is the CPU time of the draw call; `gap` is the real time since the previous drawn frame, which also catches a GPU that falls behind.
  function adaptSharpness(ms,gap=0){
    if(++sharpSamples<45||(pixelRatio<=1&&lite))return;
    const slow=ms>(desktop()?14:22)||(!reducedMotion&&gap>(desktop()?26:40)&&gap<250);
    slowFrames=slow?slowFrames+1:Math.max(0,slowFrames-1);
    if(slowFrames>40){slowFrames=0;sharpSamples=0;
      if(pixelRatio>1){pixelRatio=pixelRatio>1.7?1.6:pixelRatio>1.4?1.3:1;renderer.setPixelRatio(pixelRatio);lastSize='';shadowTick=0;}
      else setLite(true);}
  }
  function setLite(on){
    lite=!!on;for(const m of bus3.ground)m.visible=!lite;
    if(lite)for(const n of notes6.pool)n.visible=false;
  }
  /* ---- Stage 6: little music notes float up from the street musicians. ---- */
  const notes6={g:null,pool:[],t:0,next:0,spawned:0};
  function updateStage6(dt){
    if(lite)return;
    if(!notes6.g){notes6.g=new THREE.Group();world.add(notes6.g);
      for(let k=0;k<8;k++){const n=new THREE.Group();const head=ball(n,.02,'#33404c',0,0,0);head.scale.set(1.25,.8,.9);head.castShadow=false;box(n,.007,.075,.007,'#33404c',.018,.042,0,false);
        n.visible=false;n.userData={t:-1};notes6.g.add(n);notes6.pool.push(n);}}
    notes6.t+=dt;
    if(notes6.t>=notes6.next){
      notes6.next=notes6.t+.5+Math.random()*.5;
      for(const [ref,item] of actors){
        if(ref.kind!=='busker'||!item.group.visible)continue;
        const n=notes6.pool.find(q=>q.userData.t<0);if(!n)break;
        n.userData={t:0,x:item.group.position.x+(Math.random()-.5)*.14,z:item.group.position.z+(Math.random()-.5)*.14,ph:Math.random()*6};n.visible=true;notes6.spawned++;break;}
    }
    for(const n of notes6.pool){const u=n.userData;if(u.t<0)continue;u.t+=dt;
      if(u.t>2.4){u.t=-1;n.visible=false;continue;}
      n.position.set(u.x+Math.sin(u.t*3+u.ph)*.05,.5+u.t*.2,u.z);n.rotation.z=Math.sin(u.t*2+u.ph)*.25;
      n.scale.setScalar(Math.min(1,u.t*4)*Math.min(1,(2.4-u.t)*3));}
  }
  // ?fps shows a small readout: frames per second, draw time and render resolution.
  const fpsOn=typeof location!=='undefined'&&/[?&]fps\b/.test(location.search);
  let fpsEl=null,fpsFrames=0,fpsDraw=0,fpsSince=0;
  function fpsMeter(ms){
    if(!fpsOn||typeof document==='undefined')return;
    if(!fpsEl){fpsEl=document.createElement('div');fpsEl.style.cssText='position:fixed;right:10px;top:calc(10px + env(safe-area-inset-top,0px));z-index:9;padding:5px 9px;border-radius:9px;background:rgba(30,36,44,.78);color:#e9f5e9;font:600 12px/1.3 ui-monospace,Menlo,monospace;pointer-events:none';document.body.appendChild(fpsEl);}
    const now=clockMs();fpsFrames++;fpsDraw+=ms;if(!fpsSince)fpsSince=now;
    if(now-fpsSince>=1000){fpsEl.textContent=`${Math.round(fpsFrames*1000/(now-fpsSince))} fps · ${(fpsDraw/fpsFrames).toFixed(1)} ms · ${pixelRatio}x${lite?' · lite':''}`;fpsFrames=0;fpsDraw=0;fpsSince=now;}
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
    const gap=Number.isFinite(timestamp)&&frames>0?timestamp-lastFrameAt:0;
    if(Number.isFinite(timestamp)){lastFrameAt=timestamp;sceneTime=timestamp;}
    try {
      resize();
      const state=town.debug();
      if(worldBuildings!==town.buildings()||worldSeed!==state.seed)rebuild();
      syncActors();updateCountryPlace(state.clock||0);updateMetropolis(state.clock||0);syncCamera();light(state.night||0);nightLife(state.night||0,state.clock||0);updateFollowCard();updateMoments();updateWeather(1/45);
      // Driven by the town's own clock, so they pause with the town.
      {const now=state.clock||0;const dt=lastClockAt===null?0:THREE.MathUtils.clamp(now-lastClockAt,0,.1);lastClockAt=now;sceneClock+=dt;
       try{window.ToyTownWeather?.step?.(dt);}catch(e){}
       updateVisit(dt);updateRound(dt,state.night||0);updateEffects(dt);updateTrain(dt,state.night||0);updateFarm(dt);updateSite(dt);updateLife(dt);updateMore(dt,state.night||0);updateStage2(dt,state.night||0);updateStage3(dt,state.night||0);updateNewsroom(dt,state.night||0);updateStage4(dt,state.night||0);updateStage5(dt,state.night||0);updateStage6(dt);}
      placeBubble();
      animateAmbient(state.clock||0);
      // Shadows follow the actors a few times a second instead of every frame: every frame on desktop, every 2nd on phones, every 4th in lite mode.
      renderer.shadowMap.needsUpdate=(shadowTick++%(lite?4:desktop()?1:2))===0;
      const drawStart=clockMs();
      if(lens)lens.render(timestamp-(api.lastAt||timestamp));else renderer.render(scene,camera);
      const drawn=clockMs()-drawStart;adaptSharpness(drawn,gap);fpsMeter(drawn);
      api.lastAt=timestamp;frames++;
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
    e.preventDefault();town.setCityBounds?.(null);stopped=true;window.ToyTown3D.active=false;
    host.style.display='none';document.getElementById('town').style.opacity='1';
    cancelAnimationFrame(raf);
  };
  renderer.domElement.addEventListener('webglcontextlost',lost,false);
  const restored=()=>{stopped=false;worldSeed=null;worldBuildings=null;api.active=false;frame();};
  renderer.domElement.addEventListener('webglcontextrestored',restored,false);
  const api={
    active:false,renderer,scene,camera,
    setCountry:id=>{if(!COUNTRY_IDS.includes(id))return false;if(id===country)return true;country=id;rebuild();syncActors();return true;},
    metropolis:()=>({bounds:{...CITY_BOUNDS},districts:METRO_DISTRICTS.map(d=>({...d})),buildings:metro.buildings.length,vehicles:metro.vehicles.map(v=>({x:v.g.position.x,z:v.g.position.z,district:v.district,angle:v.g.rotation.y,bus:v.bus,distance:v.s,arrivals:v.arrivals})),life:metro.life?.map(a=>({type:a.type,district:a.district,action:a.action||a.type,x:a.g.position.x,z:a.g.position.z}))||[],deliveries:metro.deliveries,roles:[...new Set(metro.buildings.map(b=>b.userData.metroRole))],arrivals:metro.arrivals,boardings:metro.boardings,alightings:metro.alightings,passengers:metro.commuters?.map(p=>({state:p.state,stop:p.stop,bus:p.bus}))||[],stops:metro.stops?.length||0,walkers:metro.walkers.length,pedestrians:metro.walkers.map(v=>({x:v.g.position.x,z:v.g.position.z})),bridges:metro.bridges.length,time:metro.time}),
    previewMetropolis:time=>updateMetropolis(time),
    countryPlace:()=>countryPlace?({name:COUNTRY_PLACES[country][0],activity:countryPlace.activity,x:countryPlace.x,z:countryPlace.z,time:countryPlace.time,visitors:countryPlace.visitors.map(v=>({x:v.position.x,z:v.position.z,action:v.userData.countryAction})),rotor:countryPlace.rotor?.rotation.z??null}):null,
    previewCountryActivity:time=>{updateCountryPlace(time);},
    stepPoses:seconds=>{for(let t=0;t<seconds;t+=.05)syncActors(Math.min(.05,seconds-t));},
    renderInfo:()=>({calls:renderer.info?.render?.calls??null,triangles:renderer.info?.render?.triangles??null,geometries:renderer.info?.memory?.geometries??null,textures:renderer.info?.memory?.textures??null}),
    getStats:()=>({metroBuildings:metro.buildings.length,metroDistricts:METRO_DISTRICTS.length,country,countryBuildings,mobileBudget:!desktop(),frames,redrawCount,actors:actors.size,ambient:ambient.length,plazaLights:plazaLights.length,festoonBulbs:festoonBulbs.length,gardenElements,woodlandShapes,terrainContours,composedBuildings,districtGardenRooms,landmarks:landmarkCount,windowMaterials:windowMaterials.size,photographicLens:!!lens,pixelRatio,kitModels:kit?kit.size:0,cameraProjection:'perspective',lens:lens?.stats?.()||null,buildings:town.buildings().length,webgl:true,frozen}),
    // A stable actual GPU-rendered frame for visual regression screenshots.
    // Unlike stop(), freeze does not switch to the Canvas fallback.
    weather:()=>({kind:weatherKind,precip:precip?precip.userData.kind:null,umbrellas:[...actors.values()].filter(i=>i.group.userData.umbrella?.visible).length}),
    momentStats:()=>({...momentStats,offered:momentStats.offered,showing:!!offered,watching:!!watching}),watchOffered:()=>{if(offered){watchMoment(offered);return true;}return false;},
    tap,hold,tapResident,tapStats:()=>({...taps,effects:effects.length}),
    surpriseAt:(x,z,seconds=0)=>{surprise(x,z);for(let t=0;t<seconds;t+=.05)updateEffects(.05);return effects.length;},
    // Test hooks: start the visitor or the paper round now.
    startVisit:()=>{if(!onThisDay.length)onThisDay=[{year:1969,text:'Apollo 11 lands on the Moon'}];startVisit();return timeVisit;},startRound:()=>{startRound();return round;},
    stepExtras:(seconds,dark=0)=>{for(let t=0;t<seconds;t+=.05){sceneClock+=.05;updateVisit(.05);updateRound(.05,dark);updateEffects(.05);}},
    setFreight:n=>{rail.freightEvery=n;rail.mode='pass';},railMode:()=>rail.mode,
    stepTrain:(seconds,dark=0)=>{for(let t=0;t<seconds;t+=.05){updateTrain(.05,dark);updateFarm(.05);updateSite(.05);updateLife(.05);updateMore(.05,dark);updateStage2(.05,dark);updateStage3(.05,dark);updateNewsroom(.05,dark);updateStage4(.05,dark);updateStage5(.05,dark);updateStage6(.05);}},
    // Meshes whose material reads vertex colours but whose geometry has none draw pure black.
    vertexColorAudit:()=>{let bad=0;world.traverse?.(o=>{if(o.isMesh&&o.material?.vertexColors&&o.geometry?.attributes&&!o.geometry.attributes.color)bad++;});return bad;},
    batchStats:()=>({removed:batch.removed,merged:batch.merged,candidates:batch.candidates.length,off:batch.off}),staticCandidates:()=>batch.candidates,
    bridgeProfile:(x,z,facing=0,half=.12)=>bridgeContact(x,z,facing,half),
    signalStats:()=>({poles:signal.poles,heads:signal.heads,built:!!signal.mats,phase:town.lightPhase?.()||null,lit:signal.mats?['x','y'].map(a=>['r','a','g'].filter(c=>signal.mats[a][c].emissiveIntensity>1).join('')):null}),
    stage6Stats:()=>({season:SEASON_NAME,lite,ground:bus3.ground.filter(m=>m.visible).length,notes:notes6.pool.filter(n=>n.visible).length,spawned:notes6.spawned,mood:moodOf({ph:1,kid:false})}),setLite:v=>{setLite(v);return lite;},
    stage5Stats:()=>({built:fest.built,festival:fest.kind,decor:fest.decor,dragon:!!fest.dragon?.g.visible,maypole:!!fest.maypole,event:fest.ev?.kind||null,eventT:fest.ev?+fest.ev.t.toFixed(1):0,eventDur:fest.ev?.dur||0,events:fest.events,log:fest.log.slice(-6)}),
    startEvent:k=>startEvent(k),startDragon:()=>{if(fest.dragon){fest.dragonOn=60;fest.dragon.g.visible=true;return true;}return false;},
    stage4Stats:()=>({built:sky4.built,rainbow:!!sky4.rainbow?.visible,rainbows:sky4.rainbows,leaves:sky4.leaves.filter(l=>l.on).length,leavesBlown:sky4.leavesBlown,plane:!!sky4.plane?.g.visible,planes:sky4.planes,flocks:sky4.flocks.length,flocksRun:sky4.flocksRun,sunK:+sunK.toFixed(2),grayK:+grayK.toFixed(2)}),
    setWindForTest:v=>{sky4.windOverride=v;},startBanner:()=>startBanner(),startFlock:()=>startFlock(),
    newsStats:()=>({built:news7.built,boards:news7.boards.length,reads:news7.reads,reading:!!news7.reading,item:news7.reading?.item?.title||null,listeners:news7.listeners.filter(q=>q.state!=='away').length,football:!!news7.football,footballAt:news7.football?[news7.football.x,news7.football.z]:null,kicks:news7.kicks,crier:!!news7.crier}),
    stage3Stats:()=>({built:bus3.built,stops:bus3.stops.length,waiting:bus3.people.filter(p=>p.state==='wait').length,aboard:bus3.people.filter(p=>p.state==='aboard').length,boarded:bus3.boarded,alighted:bus3.alighted,boards:bus3.boards,steam:bus3.steam.length,tufts:bus3.tufts,flowers:bus3.flowers,patches:bus3.patches,strips:bus3.strips}),
    stage2Stats:()=>({built:live2.built,puddles:live2.puddles.filter(p=>p.puddle.visible).length,snow:+live2.snowK.toFixed(2),snowVisible:!!live2.snowman?.visible,watchman:!!live2.watch?.p.visible,cats:live2.cats.filter(c=>c.g.visible).length,boards:live2.boards.map(b=>b.shut.visible?'closed':'open'),hits:live2.hits,kiteVisible:life.kite?.kid.visible,playVisible:life.play?.sk.visible,fisherVisible:life.fisher?.p.visible,boatVisible:life.boat?.g.visible}),
    stepWeather:seconds=>{for(let t=0;t<seconds;t+=.05)updateWeather(Math.min(.05,seconds-t));},
    setWeatherForTest:k=>{weatherKind=k;},touch2:(x,y)=>touch2(x,y),
    moreStats:()=>({built:more.built,phase:more.phase,lit:lanterns.filter(l=>l.lit).length,lanterns:lanterns.length,parade:!!more.parade,paradesRun:more.paradesRun,gulls:more.gulls.map(x=>x.state),crowd:more.crowd.length,sparks:fwSys.active,rockets:fwSys.rockets.length,fwBursts:{...fwSys.bursts},bursts:more.bursts,lamplighter:more.lamp?.p.visible}),
    startParade:()=>startParade(),burstFirework:(x,y,z)=>burstFirework(x,y,z),launchFirework:(x,z)=>{fwLaunch(x,z);return true;},
    lifeStats:()=>({built:life.built,boatX:life.boat?.x,playground:!!life.play,at:{play:life.play&&[life.play.x,life.play.z],kite:life.kite&&[life.kite.x,life.kite.z],flock:[life.flock.x,life.flock.z],fisher:life.fisher&&[life.fisher.x,life.fisher.z]},kite:!!life.kite,birds:life.birds.map(b=>b.state),scatters:life.scatters,catches:life.catches}),
    scatterBirds:(x,z,r)=>scatterBirds(x,z,r),
    groundPoint:(cx,cy)=>groundAt(cx,cy),
    contours:()=>world.children.filter(o=>o.userData.landscapeContour||o.userData.gardenIsland).map(o=>[+o.position.x.toFixed(2),+o.position.z.toFixed(2)]),
    probe:(x,z,r)=>world.children.filter(o=>Math.hypot(o.position.x-x,o.position.z-z)<r).map(o=>[o.type,o.geometry?.type,o.geometry?.parameters?.radius,+o.position.x.toFixed(2),+o.position.y.toFixed(2),+o.position.z.toFixed(2),o.material?.color?.getHexString?.(),Object.keys(o.userData||{}).join('|')]).slice(0,40),
    siteStats:()=>({built:site.built,workers:site.workers.length,jib:site.slew?.rotation.y||0,t:site.t}),
    farmStats:()=>({sheep:farm.sheep.length,sails:!!farm.sails,spin:-(farm.sails?.rotation.z||0),at:farm.sheep.map(x=>[+x.x.toFixed(2),+x.z.toFixed(2)])}),
    railStats:()=>({len:rail.len,s:rail.s,v:rail.v,state:rail.state,stops:rail.stops,toots:rail.toots,units:rail.train?.units.length||0,pax:rail.pax.map(p=>p.state),stationS:rail.stationS,doors:rail.doors}),
    railTap:(x,y)=>trainHit(x,y),
    railSet:v=>{rail.s=v;rail.state='run';rail.away=1e3;rail.v=1;rail.lastS=v;placeTrain();return v;},railLen:()=>rail.len,
    railGo:ahead=>{rail.s=rail.stationS+rail.train.total/2-ahead;rail.state='run';rail.away=0;rail.v=Math.min(.9,Math.sqrt(2*TRAIN.brake*Math.max(0,ahead))+.04);rail.lastS=rail.s;placeTrain();return rail.s;},
    sceneExtras:()=>({visiting:!!timeVisit,riding:!!round,papers:papers.length,history:onThisDay.length}),
    freeze(){frozen=true;cancelAnimationFrame(raf);},
    unfreeze(){if(!stopped&&frozen){frozen=false;raf=requestAnimationFrame(frame);}},
    stop(){town.setCityBounds?.(null);stopped=true;cancelAnimationFrame(raf);this.active=false;window.ToyTown3D.active=false;
      host.style.display='none';document.getElementById('town').style.opacity='1';},
    dispose(){this.stop();scene.environment?.dispose?.();renderer.dispose();}
  };
  // The photographed-miniature lens (tilt-shift, bloom, AO, grade); plain WebGL if it cannot start.
  town.setCityBounds?.(CITY_BOUNDS);
  try{lens=options.createLens?options.createLens(renderer,scene,camera,{mobile:!desktop()}):null;}catch(error){console.warn('Toy Town lens unavailable; plain render',error);lens=null;}
  if(lens)host.classList.add('lens');
  window.ToyTown3D=api;
  renderer.domElement.addEventListener('dblclick',()=>{},false);
  raf=requestAnimationFrame(frame);
  return api;
}
