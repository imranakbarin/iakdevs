/* Cozy Worlds — self-contained, lazy WebGL miniature, cleanly disposable. */
window.CozyWorlds=(()=>{
 let active=null;
 async function mount(host){
  if(active)active.dispose();
  const life={dead:false};life.dispose=()=>{life.dead=true;if(active===life)active=null;};active=life;
  let THREE;
  try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');}
  catch(e){if(!life.dead)host.innerHTML='<p class="cozy-error">Cozy Worlds needs WebGL and an internet connection for its 3D engine. Please try again online.</p>';life.dispose();return;}
  if(life.dead)return;
  const root=document.createElement('div');root.className='cozy-stage';
  root.innerHTML='<div class="cozy-hud"><span class="cozy-name">COZY WORLDS <small>Rainy Reading Nook</small></span><div class="cozy-actions"><button data-action="stir" title="Stir floating flecks">✦ Stir</button><button data-action="lamp" title="Toggle lamp brightness">☼ Lamp</button><button data-action="rain" title="Cycle rain intensity">☂ Rain</button><button data-action="pause" title="Pause animations">Ⅱ Pause</button><button data-action="focus" title="Hide controls">⛶ Focus</button></div></div><div class="cozy-tip">Drag gently to explore · Double-tap to recenter</div>';
  host.replaceChildren(root);
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  let renderer,scene,camera,raf=0,running=!reduced,frameTime=0,rafTime=0,lit=true,rainLevel=1,stir=0,dragging=false,px=0,py=0,targetX=0,targetY=0,lookX=0,lookY=0,viewW=0,viewH=0;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});}
  catch(e){root.innerHTML='<p class="cozy-error">This browser cannot start the WebGL reading nook. The other experiences remain available.</p>';life.dispose();return;}
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;
  root.prepend(renderer.domElement);renderer.setClearColor(0x171d29);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x1b2735);
  camera=new THREE.PerspectiveCamera(37,1,.1,70);camera.position.set(5,3.25,8.8);camera.lookAt(0,1.65,0);
  const wood=new THREE.MeshStandardMaterial({color:0x493124,roughness:.91});
  const darkWood=new THREE.MeshStandardMaterial({color:0x271e20,roughness:.9});
  const trim=new THREE.MeshStandardMaterial({color:0xab7b4b,roughness:.64,metalness:.13});
  const wall=new THREE.MeshStandardMaterial({color:0x65534e,roughness:1});
  const teal=new THREE.MeshStandardMaterial({color:0x186c68,roughness:.97});
  const tealLight=new THREE.MeshStandardMaterial({color:0x337c76,roughness:.98});
  const tealDeep=new THREE.MeshStandardMaterial({color:0x124846,roughness:.98});
  const linen=new THREE.MeshStandardMaterial({color:0xe5d5b3,roughness:1,side:THREE.DoubleSide});
  const ginger=new THREE.MeshStandardMaterial({color:0xc77b3d,roughness:.96});
  const cream=new THREE.MeshStandardMaterial({color:0xf1cf9a,roughness:1});
  const gold=new THREE.MeshStandardMaterial({color:0xe4ba68,roughness:.52,metalness:.45});
  const ceramic=new THREE.MeshStandardMaterial({color:0xc9a6a0,roughness:.48});
  const cloth=new THREE.MeshStandardMaterial({color:0x8b6773,roughness:1,side:THREE.DoubleSide});
  const glass=new THREE.MeshBasicMaterial({color:0x41536a,transparent:true,opacity:.42,depthWrite:false});
  const stitch=new THREE.MeshStandardMaterial({color:0x8db1a4,roughness:1});
  const copper=new THREE.MeshStandardMaterial({color:0x5e3529,roughness:.77});
  const shadow=new THREE.MeshBasicMaterial({color:0x171411,transparent:true,opacity:.18,depthWrite:false});
  const warm=new THREE.PointLight(0xffba68,38,7,2);warm.position.set(-1.45,3.25,1.3);scene.add(warm);
  scene.add(new THREE.HemisphereLight(0xc4d7e8,0x493126,2.15));
  const fill=new THREE.DirectionalLight(0xffe1b2,2.1);fill.position.set(5,7,6);scene.add(fill);
  const box=(w,h,d,m,x,y,z,parent=scene)=>{const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);parent.add(a);return a;};
  const sph=(rx,ry,rz,m,x,y,z,parent=scene)=>{const a=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),m);a.scale.set(rx,ry,rz);a.position.set(x,y,z);parent.add(a);return a;};
  const cyl=(r1,r2,h,m,x,y,z,parent=scene)=>{const a=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,20),m);a.position.set(x,y,z);parent.add(a);return a;};
  const line=(coords,m,r=.018,parent=scene)=>{const curve=new THREE.CatmullRomCurve3(coords.map(v=>new THREE.Vector3(...v)));const obj=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,coords.length*8),r,6,false),m);parent.add(obj);return obj;};
  // A shallow architectural room, not a painted backdrop.
  box(5.6,.22,4.4,wood,0,-.13,0);box(5.6,4.25,.15,wall,0,2.03,-2.15);
  box(.16,4.2,4.4,darkWood,-2.8,2,0);box(.16,4.2,4.4,darkWood,2.8,2,0);
  box(5.8,.20,.25,trim,0,4.13,-2.08);box(5.8,.14,.24,trim,0,.14,-2.08);
  for(let i=0;i<9;i++)box(5.55,.012,.016,i%2?trim:darkWood,0,.5+i*.41,-2.04);
  for(let i=0;i<13;i++)box(.025,.025,4.2,trim,-2.5+i*.42,.02,0);
  // Recessed evening window and rain behind the furniture.
  box(2.02,2.7,.09,darkWood,.25,2.67,-2.02);
  const sky=new THREE.MeshBasicMaterial({color:0x263f5c});
  box(1.76,2.44,.015,sky,.25,2.68,-1.95);
  for(let i=0;i<18;i++){const x=-.58+i*.1;const h=.22+(i*13%9)*.083;box(.075,h,.015,new THREE.MeshBasicMaterial({color:0x273245}),x,1.52+h/2,-1.90);}
  for(let i=0;i<25;i++){const x=-.55+(i*37%17)*.1;const y=1.7+(i*23%19)*.12;sph(.017,.018,.005,i%4?gold:cream,x,y,-1.86);}
  box(.075,2.55,.12,trim,-.64,2.67,-1.88);box(.075,2.55,.12,trim,1.15,2.67,-1.88);
  box(1.9,.075,.13,trim,.25,3.9,-1.87);box(1.9,.075,.13,trim,.25,1.43,-1.87);
  box(.07,2.4,.08,trim,.25,2.67,-1.84);box(1.8,.07,.08,trim,.25,2.67,-1.84);
  // Draped curtains: gently scalloped cloth rather than hard flat panels.
  const curtains=[];
  for(const sign of [-1,1]){
   const shape=new THREE.PlaneGeometry(.7,2.55,12,18);
   const pos=shape.attributes.position;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.09*Math.sin(x*16)+.035*Math.cos(y*8));pos.setX(i,x+.09*Math.sin((y+1.28)*1.4)*sign);}
   shape.computeVertexNormals();
   const c=new THREE.Mesh(shape,cloth);c.position.set(.25+sign*1.19,2.65,-1.77);scene.add(c);curtains.push(c);
  }
  // Towering bookshelves at both sides; individually pitched book spines.
  let random=417;const rnd=()=>{random=(random*1664525+1013904223)>>>0;return random/4294967296;};
  const bookM=[0x853f42,0x4e6e63,0xbd8b52,0x354966,0x9e7072,0x675e7b,0xb3a084,0x415656].map(v=>new THREE.MeshStandardMaterial({color:v,roughness:.9}));
  for(const side of [-1,1]){
    const center=side*2.11;box(1.07,3.85,.48,wood,center,2.08,-1.66);
    for(let shelf=0;shelf<5;shelf++){
      let x=center-.45;
      const y=.51+shelf*.73;
      box(1.06,.09,.57,trim,center,y,-1.37);
      for(let j=0;j<10;j++){
        const bw=.075+rnd()*.028,bh=.39+rnd()*.22;
        const b=box(bw,bh,.30+ rnd()*.07,bookM[(rnd()*bookM.length)|0],x+bw/2,y+.048+bh/2,-1.36);
        b.rotation.z=(rnd()-.5)*.09;x+=bw+.012;
      }
    }
  }
  // Upholstered chair: layered lobes, piped cushioning and button tufting.
  const chair=new THREE.Group();chair.position.set(-.27,0,.36);scene.add(chair);
  for(const sx of [-1,1]){box(.12,.87,.13,darkWood,sx*.73,.48,.32,chair);box(.12,.87,.13,darkWood,sx*.73,.48,-.39,chair);}
  sph(.83,.25,.72,tealDeep,0,.91,0,chair);sph(.77,.21,.62,tealLight,0,1.10,.03,chair);
  const back=sph(.9,1.05,.25,teal,0,2.05,-.49,chair);back.rotation.x=-.13;
  sph(.63,.78,.22,tealLight,0,2.12,-.24,chair);
  for(const sx of [-1,1]){
   const arm=sph(.22,.53,.68,teal,sx*.8,1.36,.05,chair);arm.rotation.z=-sx*.09;
   sph(.21,.16,.46,tealLight,sx*.83,1.77,.08,chair);
  }
  for(const y of [1.65,2.14,2.65])for(const x of [-.37,0,.37]){const z=-.24 + .22*Math.sqrt(Math.max(0,1-(x/.9)**2-((y-2.05)/1.05)**2));sph(.03,.03,.018,tealDeep,x,y,z+.01,chair);}
  for(const sx of [-1,1]){
   line([[sx*.69,1.77,.15],[sx*.72,1.48,.43],[sx*.66,1.08,.46]],stitch,.009,chair);
   for(let j=0;j<7;j++)sph(.012,.012,.009,stitch,sx*.70,1.20+j*.075,.49,chair);
  }
  line([[-.61,2.55,-.08],[-.64,2.12,.04],[-.52,1.58,.03]],stitch,.014,chair);
  line([[.61,2.55,-.08],[.64,2.12,.04],[.52,1.58,.03]],stitch,.014,chair);
  line([[-.64,1.12,.46],[0,1.12,.66],[.66,1.13,.45]],trim,.013,chair);
  // Cream blanket flowing down one side of the seat.
  const folds=new THREE.PlaneGeometry(.86,1.31,20,30),p=folds.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,.11*Math.sin(x*12+y*2)+.035*Math.sin(y*18));}
  folds.computeVertexNormals();const blanket=new THREE.Mesh(folds,linen);blanket.position.set(.48,.88,.71);blanket.rotation.set(-.22,.06,.25);chair.add(blanket);
  line([[.12,.32,.80],[.41,.29,.85],[.72,.43,.83],[.82,.84,.68]],cream,.014,chair);
  // Curled ginger cat, with a tiny breathing motion.
  const cat=new THREE.Group();cat.position.set(-.29,1.32,.49);chair.add(cat);
  sph(.38,.19,.29,ginger,0,0,0,cat);sph(.18,.16,.17,ginger,-.28,.065,.13,cat);
  for(const s of [-1,1]){
    const ear=new THREE.Mesh(new THREE.ConeGeometry(.085,.17,4),ginger);
    ear.position.set(-.37+s*.12,.24,.12);ear.rotation.z=s*.17;cat.add(ear);
    sph(.025,.012,.014,darkWood,-.31+s*.085,.088,.292,cat);
  }
  line([[.25,.07,-.01],[.48,.04,.15],[.51,.13,.3],[.38,.17,.34]],ginger,.069,cat);
  for(let i=0;i<4;i++)line([[-.18+i*.11,.18,-.16],[-.2+i*.11,.2,.13]],cream,.008,cat);
  // A few warm picture frames and miniature curios make the back wall feel lived-in.
  for(const [x,y,w,h] of [[-1.24,3.56,.43,.52],[1.43,3.55,.38,.42]]){
   box(w,h,.09,trim,x,y,-1.98);box(w-.085,h-.085,.095,copper,x,y,-1.91);
   box(w*.48,h*.22,.01,bookM[0],x,y-.055,-1.85);
   sph(.052,.052,.014,gold,x+.09,y+.10,-1.84);
  }
  for(const side of [-1,1]){
   const x=side*2.12;sph(.13,.17,.13,ceramic,x,3.62,-1.34);
   cyl(.07,.06,.13,gold,x,3.81,-1.34);
  }
  // Amber floor lamp with gathered shade.
  cyl(.23,.29,.06,wood,-1.92,.12,.7);cyl(.028,.035,2.65,trim,-1.92,1.44,.7);
  const shade=new THREE.Mesh(new THREE.CylinderGeometry(.2,.48,.52,32,1,true),new THREE.MeshStandardMaterial({color:0xd7a17c,emissive:0xe59d50,emissiveIntensity:.38,roughness:.8,side:THREE.DoubleSide}));
  shade.position.set(-1.92,2.85,.7);scene.add(shade);
  sph(.17,.10,.17,new THREE.MeshBasicMaterial({color:0xffd294}),-1.92,2.65,.7);
  // Side table, cup, books and curling steam.
  cyl(.54,.54,.075,wood,1.62,.99,1.26);
  cyl(.038,.04,.97,trim,1.62,.49,1.26);
  cyl(.31,.38,.065,wood,1.62,.07,1.26);
  for(let i=0;i<3;i++){const b=box(.51,.10,.36,bookM[(i*2+1)%bookM.length],1.36,.99+.105+i*.105,1.1);b.rotation.y=.1+i*.1;}
  cyl(.14,.12,.27,ceramic,1.88,1.21,1.46);
  cyl(.126,.126,.006,darkWood,1.88,1.349,1.46);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.095,.025,7,16,Math.PI*1.65),ceramic);handle.position.set(2.035,1.23,1.46);scene.add(handle);
  const coaster=cyl(.20,.20,.018,trim,1.88,1.042,1.46);
  const steam=[];
  for(let i=0;i<3;i++){const pts=[];for(let j=0;j<10;j++)pts.push([1.82+i*.055+.035*Math.sin(j*.65+i),1.38+j*.067,1.45]);const s=line(pts,new THREE.MeshBasicMaterial({color:0xf8e8c9,transparent:true,opacity:.16,depthWrite:false}),.008);steam.push(s);}
  // Small patterned rug grounds the chair.
  const rug=new THREE.Mesh(new THREE.CylinderGeometry(1.42,1.42,.016,72),new THREE.MeshStandardMaterial({color:0x775a50,roughness:1}));rug.scale.z=.73;rug.position.set(-.15,.026,.33);scene.add(rug);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(1.24,.02,6,80),trim);rim.rotation.x=Math.PI/2;rim.scale.y=.72;rim.position.set(-.15,.047,.33);scene.add(rim);
  // Book-like shell in the foreground; its open front keeps the interior readable.
  box(5.85,.16,.28,darkWood,0,-.03,2.16);
  box(.21,4.18,.35,wood,-2.83,2.05,.42);box(.21,4.18,.35,wood,2.83,2.05,.42);
  box(5.85,.15,.34,trim,0,4.18,-.08);
  for(let i=0;i<5;i++)box(5.8,.011,.04,cream,0,-.09+i*.028,2.31);
  // Flecks and rain are genuinely behind or in front of furniture in 3D.
  const flecks=[];const fleckGeo=new THREE.TetrahedronGeometry(.021,0);
  for(let i=0;i<(innerWidth<700?65:125);i++){const mat=new THREE.MeshBasicMaterial({color:i%4?0xd2bd91:0xffecc3,transparent:true,opacity:.32+rnd()*.4,depthWrite:false});const a=new THREE.Mesh(fleckGeo,mat);const data={x:(rnd()-.5)*5,y:.3+rnd()*3.6,z:(rnd()-.5)*3.7,s:.11+rnd()*.14,phase:rnd()*6.28};a.position.set(data.x,data.y,data.z);scene.add(a);flecks.push({a,...data});}
  const drops=[];const dropMat=new THREE.MeshBasicMaterial({color:0xbcd4e4,transparent:true,opacity:.45,depthWrite:false});
  for(let i=0;i<72;i++){const a=box(.006,.05+rnd()*.12,.003,dropMat,-.59+rnd()*1.67,1.50+rnd()*2.25,-1.84);drops.push({a,fall:.35+rnd()*.75});}
  function size(){const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);if(w===viewW&&h===viewH)return;viewW=w;viewH=h;renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<700?1.35:1.8));renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?48:37;camera.position.set(w<h?4.55:5, w<h?3.05:3.25,w<h?12.5:8.8);camera.updateProjectionMatrix();}
  const ro=new ResizeObserver(size);ro.observe(root);size();
  function tick(t){
   raf=0;if(life.dead||document.hidden)return;
   const dt=Math.min(.05,Math.max(0,(t-(rafTime||t))/1000));rafTime=t;
   if(running){
    frameTime+=dt;stir=Math.max(0,stir-dt*.38);
    cat.scale.y=1+.025*Math.sin(frameTime*2.2);
    curtains.forEach((c,i)=>c.rotation.y=Math.sin(frameTime*.41+i)*.012);
    steam.forEach((s,i)=>{s.position.x=Math.sin(frameTime*.65+i)*.025;s.material.opacity=.10+.045*Math.sin(frameTime*.9+i);});
    for(const o of flecks){o.y+=dt*(o.s+stir*.72);if(o.y>4)o.y=.18;o.a.position.set(o.x+.08*Math.sin(frameTime*.47+o.phase)+stir*.19*Math.sin(o.y*3+o.phase),o.y,o.z);o.a.rotation.y+=dt*.4;}
    for(const o of drops){o.a.visible=rainLevel>0;o.a.position.y-=dt*(1.8+rainLevel*.75)*o.fall;if(o.a.position.y<1.5)o.a.position.y=3.86;}
   }
   lookX+=(targetX-lookX)*Math.min(1,dt*3.5);lookY+=(targetY-lookY)*Math.min(1,dt*3.5);
   camera.lookAt(lookX,1.7+lookY,0);
   renderer.render(scene,camera);
   if(running||Math.abs(targetX-lookX)>.001||Math.abs(targetY-lookY)>.001)raf=requestAnimationFrame(tick);
  }
  const wake=()=>{if(!raf&&!life.dead&&!document.hidden){rafTime=0;raf=requestAnimationFrame(tick);}};
  function down(e){dragging=true;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);}
  function move(e){if(!dragging)return;targetX=Math.max(-.48,Math.min(.48,targetX-(e.clientX-px)*.0024));targetY=Math.max(-.28,Math.min(.28,targetY+(e.clientY-py)*.0018));px=e.clientX;py=e.clientY;wake();}
  function up(){dragging=false;}
  const surface=renderer.domElement;
  surface.addEventListener('pointerdown',down);surface.addEventListener('pointermove',move);surface.addEventListener('pointerup',up);surface.addEventListener('pointercancel',up);
  surface.addEventListener('dblclick',()=>{targetX=targetY=0;wake();});
  const actions=e=>{const btn=e.target.closest('[data-action]');if(!btn)return;
   switch(btn.dataset.action){
    case 'stir':stir=1.1;running=true;root.querySelector('[data-action="pause"]').textContent='Ⅱ Pause';break;
    case 'lamp':lit=!lit;warm.intensity=lit?38:2;shade.material.emissiveIntensity=lit?.38:.03;break;
    case 'rain':rainLevel=(rainLevel+1)%3;dropMat.opacity=[0,.35,.58][rainLevel];btn.textContent=['☂ Dry','☂ Rain','☂ Downpour'][rainLevel];break;
    case 'pause':running=!running;btn.textContent=running?'Ⅱ Pause':'▶ Play';break;
    case 'focus':root.classList.toggle('cozy-focus');break;
   }wake();
  };
  root.addEventListener('click',actions);
  const vis=()=>{if(!document.hidden)wake();else {cancelAnimationFrame(raf);raf=0;}};
  const lost=e=>{e.preventDefault();running=false;cancelAnimationFrame(raf);raf=0;root.classList.add('cozy-context-lost');root.querySelector('.cozy-tip').textContent='Graphics interrupted. Attempting to restore the miniature…';};
  surface.addEventListener('webglcontextlost',lost,false);
  const restored=()=>{root.classList.remove('cozy-context-lost');root.querySelector('.cozy-tip').textContent='Drag gently to explore · Double-tap to recenter';running=!reduced;wake();};
  surface.addEventListener('webglcontextrestored',restored,false);
  document.addEventListener('visibilitychange',vis);
  life.pause=()=>{running=false;root.querySelector('[data-action="pause"]').textContent='▶ Play';cancelAnimationFrame(raf);raf=0;};
  life.resume=()=>{running=true;root.querySelector('[data-action="pause"]').textContent='Ⅱ Pause';wake();};
  life.dispose=()=>{
   if(life.dead)return;life.dead=true;cancelAnimationFrame(raf);ro.disconnect();document.removeEventListener('visibilitychange',vis);root.removeEventListener('click',actions);
   surface.removeEventListener('pointerdown',down);surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerup',up);surface.removeEventListener('pointercancel',up);
   surface.removeEventListener('webglcontextlost',lost);surface.removeEventListener('webglcontextrestored',restored);
   const geometries=new Set(),materials=new Set();
   scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
   geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();root.remove();if(active===life)active=null;
  };
  wake();
 }
 return{mount,dispose(){if(active)active.dispose();active=null;},pause(){active?.pause?.();},resume(){active?.resume?.();}};
})();
