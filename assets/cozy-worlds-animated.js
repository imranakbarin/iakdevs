/* Cozy Worlds: object-aligned 2D animation layers, fixed camera. */
window.CozyWorlds=(()=>{
let active=null;
function mount(host){
 if(active)active.dispose();
 const outer=document.createElement('div');
 outer.style.cssText='position:absolute;inset:0;overflow:hidden;background:#0c0e14';
 const frame=document.createElement('iframe');
 frame.src='assets/cozy-reading-nook.html?v=5';
 frame.title='Cozy Worlds — animated illustrated reading nook';
 frame.loading='eager';
 frame.style.cssText='display:block;width:100%;height:100%;border:0;background:#0c0e14';
 outer.append(frame);host.replaceChildren(outer);
 let alive=true,paused=false,disposeFrame=()=>{},pauseFrame=()=>{},resumeFrame=()=>{};
 const state={dispose(){alive=false;disposeFrame();frame.remove();outer.remove();if(active===state)active=null;},pause(){paused=true;pauseFrame();},resume(){paused=false;resumeFrame();}};
 active=state;
 frame.addEventListener('load',()=>{
  if(!alive)return;
  let d,w;try{d=frame.contentDocument;w=frame.contentWindow;}catch{return;}
  if(!d||!w)return;
  const scene=d.querySelector('.scene'),img=scene?.querySelector('img');
  if(!scene||!img)return;
  const style=d.createElement('style');
  style.textContent='body{min-height:100dvh!important;display:flex!important;align-items:center!important;justify-content:center!important}main{padding-top:40px!important;padding-bottom:55px!important;width:min(100vw,1380px)!important}.scene{aspect-ratio:4/3!important;width:min(100%,calc(133.333dvh - 160px))!important;height:auto!important;max-height:none!important;margin-inline:auto;isolation:isolate}.scene img{width:100%!important;height:100%!important;object-fit:contain!important}#weather,.warmth{display:none!important}@media(max-width:700px){main{padding:6px!important;width:100vw!important}.scene{border-radius:0!important}h1{position:relative!important;font-size:16px!important;margin:3px 10px 7px!important}.controls{padding:7px 10px!important}}';
  d.head.append(style);
  const oldMotion=d.querySelector('#motion');
  if(oldMotion?.getAttribute('aria-pressed')==='true')oldMotion.click();
  const layers={};
  for(const [name,z] of [['rain',2],['cat',3],['steam',4],['flame',5]]){
   const cv=d.createElement('canvas');
   cv.setAttribute('aria-hidden','true');cv.dataset.fxLayer=name;
   cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+z;
   scene.append(cv);layers[name]={cv,c:cv.getContext('2d')};
  }
  const W=1448,H=1086;
  // This experience is deliberately animated; visible Play/Pause controls remain available.
  // Do not silently freeze its rain when iOS requests reduced motion.
  let raining=true,animate=true,raf=0,last=0,elapsed=0,lastCat=0;
  const parentWindow=window,parentDocument=document;
  // Each polygon is entirely inside one glass pane of the source artwork.
  const panes=[
   [[1038,7],[1151,7],[1151,135],[1030,151]],
   [[1034,173],[1152,156],[1152,254],[1034,275]],
   [[1198,7],[1281,7],[1281,116],[1198,125]],
   [[1306,7],[1346,7],[1346,116],[1306,118]],
   [[1199,139],[1282,135],[1282,289],[1199,290]],
   [[1305,137],[1344,137],[1344,290],[1305,290]],
   [[1199,308],[1282,308],[1282,472],[1199,472]],
   [[1306,309],[1343,309],[1343,473],[1306,473]]
  ];
  function poly(ctx,points){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}
  const rand=(a,b)=>a+Math.random()*(b-a);
  const drops=Array.from({length:104},()=>{
   const pane=Math.floor(Math.random()*panes.length),p=panes[pane];
   const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);
   return {pane,x:rand(Math.min(...xs),Math.max(...xs)),y:rand(Math.min(...ys),Math.max(...ys)),speed:rand(135,230),len:rand(10,21),alpha:rand(.17,.31)};
  });
  // Candle/lantern wick locations in actual image pixels, not guessed viewport percentages.
  const lights=[
   {x:119,y:132,r:54,type:'candle'}, {x:114,y:400,r:59,type:'candle'},
   {x:338,y:563,r:70,type:'candle'}, {x:1407,y:82,r:51,type:'candle'},
   {x:1405,y:694,r:61,type:'candle'}, {x:616,y:238,r:32,type:'lantern'},
   {x:457,y:212,r:28,type:'lantern'}, {x:1002,y:319,r:105,type:'lamp'}
  ];
  const steam=Array.from({length:20},(_,i)=>({age:(i+.5)/20,phase:rand(0,6.28),offset:rand(-2,2),speed:rand(.16,.22)}));
  function virtual(layer){
   const cv=layer.cv,c=layer.c;
   c.setTransform(cv.width/W,0,0,cv.height/H,0,0);
   c.clearRect(0,0,W,H);
   return c;
  }
  function resize(){
   const r=scene.getBoundingClientRect(),ratio=Math.min(w.devicePixelRatio||1,w.innerWidth<700?1.25:1.6);
   for(const l of Object.values(layers)){
    l.cv.width=Math.max(1,Math.round(r.width*ratio));
    l.cv.height=Math.max(1,Math.round(r.height*ratio));
   }
  }
  function rainFrame(dt){
   const c=virtual(layers.rain);if(!raining)return;
   for(const drop of drops){
    const pane=panes[drop.pane],ys=pane.map(p=>p[1]),xs=pane.map(p=>p[0]);
    drop.y+=dt*drop.speed;
    if(drop.y>Math.max(...ys)){drop.y=Math.min(...ys);drop.x=rand(Math.min(...xs),Math.max(...xs));}
    c.save();poly(c,pane);c.clip();
    c.strokeStyle='rgba(210,232,249,'+drop.alpha+')';c.lineWidth=1.1;c.beginPath();
    c.moveTo(drop.x,drop.y);c.lineTo(drop.x-2.3,drop.y+drop.len);c.stroke();c.restore();
   }
  }
  function steamFrame(dt){
   const c=virtual(layers.steam);c.save();c.globalCompositeOperation='screen';
   for(const p of steam){
    p.age=(p.age+dt*p.speed)%1;
    const a=p.age,spread=3+a*15;
    const x=464+p.offset+Math.sin(a*5+p.phase)*spread*.45;
    const y=503-a*104,radius=3+a*7,opacity=.115*Math.sin(Math.PI*a);
    const g=c.createRadialGradient(x,y,.2,x,y,radius);
    g.addColorStop(0,'rgba(245,241,237,'+opacity.toFixed(4)+')');
    g.addColorStop(.45,'rgba(245,241,237,'+(opacity*.35).toFixed(4)+')');
    g.addColorStop(1,'rgba(245,241,237,0)');
    c.fillStyle=g;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();
   }
   c.restore();
  }
  function flameFrame(t){
   const c=virtual(layers.flame),s=t*.001;
   for(let i=0;i<lights.length;i++){
    const l=lights[i],slow=Math.sin(s*(l.type==='lamp'?3.4:7.1)+i*1.67),fast=Math.sin(s*19+i*2.2);
    const strength=Math.max(.12,Math.min(1,.62+.25*slow+.13*fast));
    if(l.type!=='lamp'){
     const shade=c.createRadialGradient(l.x,l.y,0,l.x,l.y,10);
     shade.addColorStop(0,'rgba(39,21,8,'+(.38*(1-strength)).toFixed(4)+')');
     shade.addColorStop(1,'rgba(39,21,8,0)');
     c.fillStyle=shade;c.beginPath();c.arc(l.x,l.y,10,0,Math.PI*2);c.fill();
    }
    c.save();c.globalCompositeOperation='screen';
    const r=l.r*(.81+strength*.2),g=c.createRadialGradient(l.x,l.y,0,l.x,l.y,r);
    g.addColorStop(0,'rgba(255,242,180,'+((l.type==='lamp'?.48:.58)*strength).toFixed(4)+')');
    g.addColorStop(.21,'rgba(255,191,92,'+(.35*strength).toFixed(4)+')');
    g.addColorStop(.65,'rgba(255,151,53,'+(.11*strength).toFixed(4)+')');
    g.addColorStop(1,'rgba(255,140,40,0)');
    c.fillStyle=g;c.beginPath();c.arc(l.x,l.y,r,0,Math.PI*2);c.fill();
    if(l.type!=='lamp'){
     const sway=Math.sin(s*10+i*1.8)*2.2,flameH=l.type==='lantern'?9:15;
     c.fillStyle='rgba(255,247,211,'+(.32+.58*strength).toFixed(4)+')';
     c.beginPath();c.moveTo(l.x,l.y+5);
     c.quadraticCurveTo(l.x-5+sway,l.y-2,l.x+sway*.5,l.y-flameH);
     c.quadraticCurveTo(l.x+5+sway,l.y-2,l.x,l.y+5);c.fill();
    }
    c.restore();
   }
  }
  function catFrame(t){
   const c=virtual(layers.cat);if(!img.complete||!img.naturalWidth||!img.naturalHeight)return;
   const breathe=.5+.5*Math.sin(t*.0025),cx=838,cy=557,inflate=.004+breathe*.022;
   c.save();c.beginPath();c.ellipse(cx,cy,115,51,-.10,0,Math.PI*2);c.clip();
   c.globalAlpha=.67+.28*breathe;c.translate(cx,cy);c.scale(1+inflate,1+inflate*.62);
   c.translate(-cx,-cy);c.drawImage(img,717,480,250,142,717,480,250,142);c.restore();
  }
  // Keep the animation alive even if a decorative layer fails on Safari.
  let failedLayer=null;
  function safeDraw(name,fn){
   try{fn();}catch(error){if(failedLayer!==name){failedLayer=name;console.warn('Cozy animation layer unavailable:',name,error);}}
  }
  function render(ts){
   raf=0;
   if(!alive||paused||parentDocument.hidden||!animate)return;
   // Schedule first: one canvas/image exception must never freeze the rain.
   raf=parentWindow.requestAnimationFrame(render);
   const dt=Math.min(.065,Math.max(0,(ts-(last||ts))/1000));
   last=ts;elapsed+=dt;
   safeDraw('rain',()=>rainFrame(dt));
   safeDraw('steam',()=>steamFrame(dt));
   safeDraw('flame',()=>flameFrame(elapsed*1000));
   if(ts-lastCat>85){lastCat=ts;safeDraw('cat',()=>catFrame(elapsed*1000));}
  }
  function still(){
   // Do not paint a frozen set of synthetic raindrops when paused.
   virtual(layers.rain);virtual(layers.steam);
   safeDraw('flame',()=>flameFrame(elapsed*1000));
   safeDraw('cat',()=>catFrame(elapsed*1000));
  }
  function restart(){
   if(raf)parentWindow.cancelAnimationFrame(raf);
   raf=0;last=0;
   if(alive&&!paused&&!parentDocument.hidden&&animate)raf=parentWindow.requestAnimationFrame(render);
   else still();
  }
  const rainButton=d.querySelector('#rain');
  if(rainButton){rainButton.onclick=()=>{raining=!raining;rainButton.textContent=raining?'Rain on':'Rain off';rainButton.setAttribute('aria-pressed',String(raining));if(!animate)still();};}
  if(oldMotion){oldMotion.textContent=animate?'Animation on':'Animation off';oldMotion.setAttribute('aria-pressed',String(animate));oldMotion.onclick=()=>{animate=!animate;oldMotion.textContent=animate?'Animation on':'Animation off';oldMotion.setAttribute('aria-pressed',String(animate));restart();};}
  const ro=new parentWindow.ResizeObserver(()=>{resize();restart();});ro.observe(scene);resize();restart();
  const visibility=()=>restart();parentDocument.addEventListener('visibilitychange',visibility);parentWindow.addEventListener('pageshow',visibility);
  disposeFrame=()=>{if(raf)parentWindow.cancelAnimationFrame(raf);ro.disconnect();parentDocument.removeEventListener('visibilitychange',visibility);parentWindow.removeEventListener('pageshow',visibility);Object.values(layers).forEach(({cv})=>cv.remove());style.remove();};
  pauseFrame=()=>{if(raf)parentWindow.cancelAnimationFrame(raf);raf=0;still();};
  resumeFrame=()=>restart();
 });
}
return {mount,dispose(){active?.dispose();},pause(){active?.pause();},resume(){active?.resume();}};
})();