/* Cozy Worlds — direct, responsive canvas; no nested animated iframe. */
window.CozyWorlds = (() => {
  const ART_W = 1448, ART_H = 1086;
  let active = null;

  const panes = [
    [[1041,13],[1150,13],[1150,140],[1035,149]],
    [[1040,171],[1150,159],[1150,260],[1040,271]],
    [[1202,12],[1277,12],[1277,114],[1202,124]],
    [[1309,13],[1340,13],[1340,113],[1309,117]],
    [[1202,141],[1278,136],[1278,284],[1202,284]],
    [[1309,139],[1340,139],[1340,288],[1309,288]],
    [[1202,309],[1278,309],[1278,469],[1202,469]],
    [[1309,310],[1339,310],[1339,471],[1309,471]]
  ];
  const lights = [
    {x:119,y:145,rad:51,type:'candle'},
    {x:119,y:405,rad:55,type:'candle'},
    {x:338,y:563,rad:66,type:'candle'},
    {x:1409,y:87,rad:63,type:'candle'},
    {x:1412,y:707,rad:59,type:'candle'},
    {x:616,y:245,rad:38,type:'candle'},
    {x:458,y:213,rad:30,type:'candle'},
    {x:1006,y:320,rad:110,type:'lamp'}
  ];
  function mount(host) {
    active?.dispose();
    let running = true, raining = true, playing = true, raf = 0, last = 0, elapsed = 0;
    let loaded = false;
    let observer;
    const stage = document.createElement('section');
    stage.className = 'cozy-direct-stage';
    stage.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;overflow:hidden;background:#10121a;padding:60px 8px 72px;box-sizing:border-box;';
    const frame = document.createElement('div');
    frame.className = 'cozy-direct-picture';
    frame.style.cssText='width:100%;max-width:1260px;max-height:100%;aspect-ratio:1448/1086;position:relative;flex:none;overflow:hidden;box-shadow:0 18px 48px #0008;border-radius:7px;';
    const img = document.createElement('img');
    img.alt = 'Candlelit reading nook with books, rainy window, teal armchair and sleeping cat';
    img.style.cssText='width:100%;height:100%;object-fit:contain;display:block;';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    const status=document.createElement('div');
    status.setAttribute('role','status');
    status.textContent='Loading illustrated scene…';
    status.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:#f0d8ae;font:13px system-ui;text-shadow:0 1px 6px #000;background:#10121aca;border-radius:14px;padding:9px 14px;white-space:nowrap;';
    const ctrl=document.createElement('div');
    ctrl.style.cssText='display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;min-height:32px;z-index:3;';
    function pill(label){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='font:12px system-ui;color:#f4e3c5;background:#262733d9;border:1px solid #9d836a;border-radius:999px;padding:9px 14px;cursor:pointer;';return b;}
    const rainBtn=pill('Rain: on'),motionBtn=pill('Motion: on');
    ctrl.append(rainBtn,motionBtn);
    frame.append(img,canvas,status);stage.append(frame,ctrl);host.replaceChildren(stage);
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx){status.textContent='Animation unavailable in this browser';return {dispose(){stage.remove();}};}
    const drops=Array.from({length:128},()=>{
      const which=Math.floor(Math.random()*panes.length),poly=panes[which],xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
      return {pane:which,x:Math.min(...xs)+Math.random()*(Math.max(...xs)-Math.min(...xs)),y:Math.min(...ys)+Math.random()*(Math.max(...ys)-Math.min(...ys)),speed:125+Math.random()*135,length:7+Math.random()*12,alpha:.14+Math.random()*.2};
    });
    const steam=Array.from({length:22},(_,i)=>({age:i/22,seed:Math.random()*6.3,dx:(Math.random()-.5)*5,pace:.18+Math.random()*.07}));
    function layout(){
      if(!running)return;
      const controlsHeight=ctrl.getBoundingClientRect().height||36;
      const availableWidth=Math.max(100,stage.clientWidth-16),availableHeight=Math.max(110,stage.clientHeight-60-72-controlsHeight-12);
      const width=Math.max(100,Math.min(availableWidth,1260,availableHeight*(ART_W/ART_H)));
      frame.style.width=width+'px';
      const dpr=Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.35:1.7);
      canvas.width=Math.max(1,Math.round(width*dpr));
      canvas.height=Math.max(1,Math.round(width*ART_H/ART_W*dpr));
      ctx.setTransform(canvas.width/ART_W,0,0,canvas.height/ART_H,0,0);
      renderOnce();
    }
    function polygon(poly){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
    function drawRain(dt){
      if(!raining)return;
      for(const p of drops){
        const poly=panes[p.pane],ys=poly.map(q=>q[1]),xs=poly.map(q=>q[0]);
        p.y += p.speed*dt;
        if(p.y>Math.max(...ys)) {p.y=Math.min(...ys);p.x=Math.min(...xs)+Math.random()*(Math.max(...xs)-Math.min(...xs));}
        ctx.save();polygon(poly);ctx.clip();
        ctx.strokeStyle='rgba(207,231,250,'+p.alpha.toFixed(3)+')';ctx.lineWidth=1.15;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-1.8,p.y+p.length);ctx.stroke();ctx.restore();
      }
    }
    function drawSteam(dt){
      ctx.save();ctx.globalCompositeOperation='screen';
      for(const p of steam){
        p.age=(p.age+dt*p.pace)%1;
        const a=p.age,x=459+p.dx+Math.sin(p.seed+a*5.6)*(2+a*8),y=503-a*98,r=2.6+a*7;
        const op=.12*Math.sin(Math.PI*a);
        const g=ctx.createRadialGradient(x,y,.1,x,y,r);
        g.addColorStop(0,'rgba(248,245,240,'+op.toFixed(3)+')');
        g.addColorStop(.55,'rgba(247,244,241,'+(op*.28).toFixed(3)+')');
        g.addColorStop(1,'rgba(247,244,241,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    function drawFlicker(time){
      const t=time/1000;
      for(let i=0;i<lights.length;i++){
        const l=lights[i],slow=Math.sin(t*(l.type==='lamp'?2.4:7.4)+i*1.8),fast=Math.sin(t*18.1+i*.91);
        const bright=Math.max(.14,Math.min(1,.56+.31*slow+.13*fast));
        const x=l.x,y=l.y,r=l.rad*(.84+bright*.18);
        // Darken the printed static wick as brightness falls; then render moving flame and glow.
        if(l.type!=='lamp'){
          const shade=ctx.createRadialGradient(x,y,0,x,y,13);
          shade.addColorStop(0,'rgba(35,20,9,'+(.34*(1-bright)).toFixed(3)+')');shade.addColorStop(1,'rgba(35,20,9,0)');
          ctx.fillStyle=shade;ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fill();
        }
        ctx.save();ctx.globalCompositeOperation='screen';
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,'rgba(255,244,183,'+((l.type==='lamp'?.5:.62)*bright).toFixed(3)+')');
        g.addColorStop(.24,'rgba(255,185,81,'+(.42*bright).toFixed(3)+')');
        g.addColorStop(1,'rgba(255,154,61,0)');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
        if(l.type!=='lamp'){
          const sway=Math.sin(t*9.4+i*1.65)*2.5,height=l.rad<40?9:14;
          ctx.fillStyle='rgba(255,249,209,'+(.3+.62*bright).toFixed(3)+')';
          ctx.beginPath();ctx.moveTo(x,y+4);
          ctx.quadraticCurveTo(x-5+sway,y-2,x+sway*.5,y-height*(.7+.25*bright));
          ctx.quadraticCurveTo(x+5+sway,y-2,x,y+4);ctx.fill();
        }
        ctx.restore();
      }
    }
    function drawCat(time){
      if(!img.complete||!img.naturalWidth||!img.naturalHeight)return;
      const b=.5+.5*Math.sin(time*.0027),cx=843,cy=559,inflate=.003+b*.014;
      ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,112,47,-.10,0,Math.PI*2);ctx.clip();
      ctx.globalAlpha=.55+.4*b;ctx.translate(cx,cy);ctx.scale(1+inflate,1+inflate*.65);ctx.translate(-cx,-cy);
      ctx.drawImage(img,717,475,255,154,717,475,255,154);ctx.restore();
    }
    function renderOnce(){
      ctx.clearRect(0,0,ART_W,ART_H);if(!loaded)return;
      if(playing){drawRain(0);drawSteam(0);} drawFlicker(elapsed*1000);drawCat(elapsed*1000);
    }
    function tick(ts){
      raf=0;if(!running||!playing||document.hidden)return;
      raf=requestAnimationFrame(tick);
      const dt=Math.min(.07,Math.max(0,(ts-(last||ts))/1000));last=ts;elapsed+=dt;
      try{ctx.clearRect(0,0,ART_W,ART_H);drawRain(dt);drawSteam(dt);drawFlicker(elapsed*1000);drawCat(elapsed*1000);}catch(e){console.warn('Cozy animation frame:',e);}
    }
    function restart(){cancelAnimationFrame(raf);raf=0;last=0;if(running&&playing&&!document.hidden&&loaded)raf=requestAnimationFrame(tick);else renderOnce();}
    rainBtn.onclick=()=>{raining=!raining;rainBtn.textContent=raining?'Rain: on':'Rain: off';renderOnce();};
    motionBtn.onclick=()=>{playing=!playing;motionBtn.textContent=playing?'Motion: on':'Motion: off';restart();};
    const visibility=()=>restart();document.addEventListener('visibilitychange',visibility);
    window.addEventListener('pageshow',visibility);
    window.addEventListener('resize',layout);
    if('ResizeObserver' in window){observer=new ResizeObserver(layout);observer.observe(stage);}
    const fail=(message)=>{status.textContent=message;status.hidden=false;};
    img.onload=()=>{if(!running)return;loaded=true;status.hidden=true;layout();restart();};
    img.onerror=()=>fail('The reading nook artwork could not load');
    if(window.__COZY_TEST_ART__){img.src=window.__COZY_TEST_ART__;}
    else {
      fetch('assets/cozy-reading-nook.html?v=6', {cache:'force-cache'})
        .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.text();})
        .then(html=>{if(!running)return;const m=html.match(/<img\b[^>]*\bsrc=["'](data:image\/(?:png|jpeg|webp);base64,[^"']+)["']/i);if(!m)throw Error('Illustration missing');img.src=m[1];})
        .catch(e=>{if(running)fail('Unable to load illustration — reload this page');console.warn('Cozy art:',e);});
    }
    layout();
    const handle={
      dispose(){running=false;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener('resize',layout);window.removeEventListener('pageshow',visibility);document.removeEventListener('visibilitychange',visibility);stage.remove();img.src='';if(active===handle)active=null;},
      pause(){playing=false;motionBtn.textContent='Motion: off';restart();},
      resume(){playing=true;motionBtn.textContent='Motion: on';restart();}
    };
    active=handle;
    return handle;
  }
  return {mount,dispose(){active?.dispose();},pause(){active?.pause();},resume(){active?.resume();}};
})();