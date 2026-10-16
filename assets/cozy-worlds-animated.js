/* Cozy Worlds: responsive fixed 2D scene with corrected ambient overlays. */
window.CozyWorlds=(()=>{
let active=null;
function mount(host){
 if(active)active.dispose();
 const outer=document.createElement('div');
 outer.style.cssText='position:absolute;inset:0;overflow:hidden;background:#0c0e14';
 const frame=document.createElement('iframe');
 frame.src='assets/cozy-reading-nook.html?v=2';
 frame.title='Cozy Worlds — animated illustrated reading nook';
 frame.loading='eager';
 frame.style.cssText='display:block;width:100%;height:100%;border:0;background:#0c0e14';
 outer.append(frame);host.replaceChildren(outer);
 let alive=true,raf=0,paused=false,cleanup=()=>{};
 function initialize(){
  if(!alive)return;
  let d,w;
  try{d=frame.contentDocument;w=frame.contentWindow;if(!d||!w)return;}catch{return;}
  const scene=d.querySelector('.scene'),img=scene?.querySelector('img');
  if(!scene||!img)return;
  // Preserve the original embedded painting, but replace its incorrect effects layer.
  const style=d.createElement('style');
  style.textContent='body{min-height:100dvh!important;display:flex!important;align-items:center!important;justify-content:center!important}main{padding-top:40px!important;padding-bottom:56px!important;width:min(100vw,1380px)!important}.scene{aspect-ratio:4/3!important;max-height:calc(100dvh - 130px);margin-inline:auto}.scene img{width:100%!important;height:100%!important;object-fit:contain!important}#weather,.warmth{display:none!important}@media(max-width:700px){main{padding:8px!important;width:100vw!important}.scene{max-height:calc(100dvh - 105px);border-radius:0!important}h1{position:relative!important;font-size:17px!important;margin:3px 12px 8px!important}.controls{padding:8px 12px!important}}';
  d.head.append(style);
  const old=d.querySelector('#weather');
  const oldMotion=d.querySelector('#motion');
  if(oldMotion&&oldMotion.getAttribute('aria-pressed')!=='false')oldMotion.click();
  const fx=d.createElement('canvas');
  fx.setAttribute('aria-hidden','true');
  fx.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
  scene.append(fx);
  const c=fx.getContext('2d');
  let rain=true,motion=!w.matchMedia('(prefers-reduced-motion:reduce)').matches,last=0;
  const drops=Array.from({length:88},()=>({x:.735+Math.random()*.19,y:.02+Math.random()*.48,v:.13+Math.random()*.15,a:.1+Math.random()*.13}));
  const steam=Array.from({length:19},()=>({age:Math.random(),seed:Math.random()*6.283}));
  const lights=[
   [.085,.143,22,'c'],[.084,.410,20,'c'],[.239,.55,22,'c'],
   [.974,.117,22,'c'],[.978,.697,24,'c'],[.441,.232,17,'c'],
   [.518,.233,16,'c'],[.716,.32,52,'l']
  ];
  function resize(){let rect=fx.getBoundingClientRect(),r=Math.min(w.devicePixelRatio||1,1.6);fx.width=Math.max(1,Math.round(rect.width*r));fx.height=Math.max(1,Math.round(rect.height*r));c.setTransform(r,0,0,r,0,0);}
  function draw(t){
   raf=0;if(!alive||paused||d.hidden||!motion)return;
   const width=fx.clientWidth,height=fx.clientHeight,dt=Math.min(.05,Math.max(0,(t-(last||t))/1000));last=t;
   c.clearRect(0,0,width,height);
   if(rain){
    c.save();c.beginPath();
    // Rain only inside the clear glass, not over shelves, curtains or the room.
    c.rect(width*.735,height*.025,width*.076,height*.445);
    c.rect(width*.825,height*.025,width*.074,height*.445);
    c.rect(width*.906,height*.025,width*.034,height*.445);
    c.clip();
    for(const p of drops){p.y+=p.v*dt;if(p.y>.47){p.y=.025;p.x=.735+Math.random()*.203;}
     c.strokeStyle='rgba(210,230,246,'+p.a+')';c.lineWidth=.75;
     c.beginPath();c.moveTo(p.x*width,p.y*height);c.lineTo(p.x*width-1.7,p.y*height+7);c.stroke();}
    c.restore();
   }
   // One fine drifting steam plume, originating above the cup rim.
   const bx=width*.328,by=height*.478;
   c.save();c.globalCompositeOperation='screen';
   for(const p of steam){p.age=(p.age+dt*.26)%1;const a=p.age,r=2.4+a*7;
    const x=bx+Math.sin(a*6+p.seed)* (2+a*8),y=by-a*height*.11;
    const op=.09*Math.sin(a*Math.PI);
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(248,246,240,'+op+')');g.addColorStop(1,'rgba(248,246,240,0)');
    c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
   c.restore();
   // Gentle but visible natural candle flutter and warm fixture halos.
   for(let i=0;i<lights.length;i++){
    const [px,py,size,type]=lights[i],x=px*width,y=py*height;
    const pulse=.9+.065*Math.sin(t*.007+i*1.7)+.035*Math.sin(t*.017+i*2.3),g=c.createRadialGradient(x,y,0,x,y,size*pulse);
    g.addColorStop(0,'rgba(255,232,155,'+(type==='l'?.30:.36)+')');g.addColorStop(.28,'rgba(255,182,78,.14)');g.addColorStop(1,'rgba(255,165,65,0)');
    c.fillStyle=g;c.beginPath();c.arc(x,y,size*pulse,0,Math.PI*2);c.fill();
   }
   // Breathing is a very faint lighting change over the cat's flank.
   const breath=.5+.5*Math.sin(t*.002),cx=width*.63,cy=height*.556;
   const g=c.createRadialGradient(cx,cy,8,cx,cy,65+breath*3);
   g.addColorStop(0,'rgba(255,204,139,'+(.045+breath*.025)+')');g.addColorStop(1,'rgba(255,204,139,0)');
   c.fillStyle=g;c.save();c.translate(cx,cy);c.scale(1.5,.52);c.translate(-cx,-cy);c.beginPath();c.arc(cx,cy,68,0,Math.PI*2);c.fill();c.restore();
   raf=w.requestAnimationFrame(draw);
  }
  function restart(){if(raf)w.cancelAnimationFrame(raf);raf=0;last=0;if(!paused&&motion)raf=w.requestAnimationFrame(draw);}
  const rainButton=d.querySelector('#rain');
  if(rainButton){rainButton.onclick=()=>{rain=!rain;rainButton.textContent=rain?'Rain on':'Rain off';rainButton.setAttribute('aria-pressed',String(rain));};}
  if(oldMotion){oldMotion.textContent=motion?'Animation on':'Animation off';oldMotion.setAttribute('aria-pressed',String(motion));oldMotion.onclick=()=>{motion=!motion;oldMotion.textContent=motion?'Animation on':'Animation off';oldMotion.setAttribute('aria-pressed',String(motion));restart();};}
  const observer=new w.ResizeObserver(()=>{resize();restart();});
  observer.observe(scene);resize();restart();
  const visibility=()=>restart();d.addEventListener('visibilitychange',visibility);
  cleanup=()=>{if(raf)w.cancelAnimationFrame(raf);observer.disconnect();d.removeEventListener('visibilitychange',visibility);fx.remove();style.remove();};
  active.pause=()=>{paused=true;restart();};
  active.resume=()=>{paused=false;restart();};
 }
 frame.addEventListener('load',initialize);
 active={dispose(){alive=false;cleanup();frame.remove();outer.remove();if(active===this)active=null;},pause(){},resume(){}};
}
return {mount,dispose(){active?.dispose();},pause(){active?.pause();},resume(){active?.resume();}};
})();