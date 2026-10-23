/* Cozy Worlds: calm scenes, optional guidance, and locally saved preferences.
   The restored PR39 nook drawing remains the basis of its animation. */
window.CozyWorlds = (() => {
  const ART_W = 1448, ART_H = 1086;
  const THEMES = [
    {id:'rain', name:'Rainy reading nook', note:'Warm pages. Rain on glass.', kind:'nook', asset:'nook', filter:'none', rain:true, lamp:1, sound:'rain', focus:.78},
    {id:'candle', name:'Candlelit stillness', note:'Low light. A slower evening.', kind:'nook', asset:'nook', filter:'brightness(.78) saturate(.82) sepia(.09)', rain:false, lamp:.55, sound:'brown', focus:.65},
    {id:'moon', name:'Moonlit reading', note:'Blue shadows. A quiet room.', kind:'nook', asset:'nook', filter:'brightness(.68) saturate(.60) hue-rotate(12deg)', rain:false, lamp:.32, sound:'brown', focus:.78},
    {id:'tea', name:'Misty tea garden', note:'Morning light. Room to breathe.', kind:'tea', asset:'tea', filter:'none', rain:false, lamp:1, sound:'brown', focus:.54, cup:[1065,657]},
    {id:'cabin', name:'Lakeside dusk', note:'Still water. Nowhere to hurry.', kind:'cabin', asset:'cabin', filter:'none', rain:false, lamp:1, sound:'brown', focus:.55, cup:[520,763]}
  ];
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
  let active = null;
  function mount(host, options = {}) {
    active?.dispose();
    const lifetime = new AbortController();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('cozy-calm-v1') || '{}') || {}; } catch (_) {}
    let theme = THEMES.find(t => t.id === saved.theme) || THEMES[0];
    let running=true, loaded=false, playing=!reduced.matches && saved.motion !== false && options.initialPlaying !== false;
    let raining=theme.rain, lampLevel=theme.lamp, rainStrength=.65;
    let fillScreen=typeof saved.fill === 'boolean' ? saved.fill : innerWidth<700 && innerHeight>innerWidth;
    let raf=0, last=0, elapsed=0, requestId=0;
    let audio=null, audioOn=false, audioPending=false, sound=theme.sound;
    let volume=Number.isFinite(saved.volume) ? Math.min(1,Math.max(0,saved.volume)) : .35;
    let breathing=false, breathStart=0, breathElapsed=0;
    let sessionRemaining=0, sessionDeadline=0, sessionRunning=false, sessionFinished=false;
    let immersed=false;
    const holder=document.createElement('div'); holder.style.cssText='position:absolute;inset:0';
    const root=holder.attachShadow({mode:'open'});
    root.innerHTML=`<style>
      :host{position:absolute;inset:0;display:block;color:#f2e9d8;font:13px/1.5 system-ui,-apple-system,sans-serif;--muted:#c2bda9;--accent:#d5dfc2;--line:#e5ddc327}
      *{box-sizing:border-box} [hidden]{display:none!important}
      .stage,.frame{position:absolute;inset:0;overflow:hidden;background:#101513}
      .art,.effects{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      .art{object-fit:contain;display:block}.effects{touch-action:auto}
      .caption{position:absolute;left:max(24px,env(safe-area-inset-left));bottom:28px;max-width:calc(100% - 140px);text-shadow:0 2px 12px #000}
      .eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin:0 0 5px}
      h2{font:400 clamp(22px,3vw,34px)/1.15 Georgia,serif;margin:0 0 6px} .caption p:last-child{margin:0;color:#eee4d1;font-size:12px}
      button,select,input{font:inherit} button,select{color:inherit;border:1px solid var(--line);background:#ffffff09;border-radius:10px;min-height:42px;padding:9px 12px;cursor:pointer}
      button:hover,select:hover{background:#ffffff12} button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
      button[aria-pressed=true]{background:#d5dfc222;border-color:#d5dfc277} select option{color:#f2e9d8;background:#202922}
      .launcher{position:absolute;right:max(20px,env(safe-area-inset-right));bottom:24px;z-index:5;background:#1c2925ed;border-color:#e4dfc74d;border-radius:30px;padding:11px 18px;backdrop-filter:blur(14px)}
      .panel{position:absolute;z-index:6;right:max(20px,env(safe-area-inset-right));bottom:80px;width:min(400px,calc(100% - 32px));max-height:calc(100% - 170px);overflow:auto;overscroll-behavior:contain;background:#17231ff5;border:1px solid var(--line);border-radius:22px;box-shadow:0 18px 70px #0006;padding:20px;backdrop-filter:blur(22px);scrollbar-width:thin;color-scheme:dark}
      .panel-head{display:flex;justify-content:space-between;gap:10px;align-items:start}.panel h3{font:400 23px Georgia,serif;margin:2px 0 4px}.panel-head p{font-size:12px;color:var(--muted);margin:0 0 15px}.close{padding:4px 12px;min-height:36px;font-size:19px}
      .themes{display:grid;grid-template-columns:1fr 1fr;gap:9px}.theme{text-align:left;padding:0;overflow:hidden;position:relative;border-radius:12px}.theme img{display:block;width:100%;height:76px;object-fit:cover}.theme span{display:block;padding:8px;font-size:11px;line-height:1.3}.theme[aria-pressed=true]:after{content:'✓';position:absolute;top:6px;right:7px;border-radius:50%;background:#e3e9d1;color:#20392c;width:21px;height:21px;text-align:center}
      .section{border-top:1px solid var(--line);margin-top:17px;padding-top:15px}.label{display:block;color:var(--muted);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin:0 0 9px}.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.row>*{flex:1}.row label{flex:1 1 100%;display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:12px;gap:10px;margin-top:7px}.row input{width:65%;accent-color:var(--accent)}
      .timer-readout{font:400 28px Georgia,serif;font-variant-numeric:tabular-nums;margin:8px 0}.timer-hint{font-size:11px;color:var(--muted);margin:6px 0 0}
      .status{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90%;border-radius:14px;background:#15221fef;padding:12px 18px;text-align:center}
      .breath{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:180px;text-align:center;pointer-events:none;color:#fff7e8;text-shadow:0 2px 10px #000}
      .orb{width:110px;height:110px;border-radius:50%;margin:0 auto 24px;background:radial-gradient(circle,#f2edcf12,#e7ebcb04);border:1px solid #eee7cd7a;box-shadow:0 0 45px #dde4bb14;transform:scale(var(--breath-scale,1))}
      .breath strong{font:400 23px Georgia,serif;display:block}.breath small{font-size:11px}.breath.static .orb{transform:none;box-shadow:none}
      .session-chip{position:absolute;left:24px;top:90px;padding:7px 12px;background:#16251ec9;border:1px solid var(--line);border-radius:20px;font-size:12px;font-variant-numeric:tabular-nums}
      .stage.immersed .caption,.stage.immersed .panel{display:none}.stage.immersed .launcher{opacity:.65}.stage.immersed .launcher:focus-visible,.stage.immersed .launcher:hover{opacity:1}
      @media(max-width:600px){.caption{left:18px;bottom:26px;max-width:calc(100% - 145px)}h2{font-size:23px}.caption p:last-child{display:none}.launcher{right:14px;bottom:22px;padding:11px 14px}.panel{right:12px;bottom:80px;width:calc(100% - 24px);max-height:calc(100% - 165px);padding:17px}.session-chip{top:85px;left:16px}.breath{top:44%}}
      @media(max-height:500px){.panel{max-height:calc(100% - 100px);bottom:70px}.caption{bottom:18px}.launcher{bottom:16px}.session-chip{top:80px}.breath{top:45%}.orb{width:65px;height:65px;margin-bottom:15px}}
      @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
    </style>
    <section class="stage" aria-label="Cozy Worlds calming scenes">
      <div class="frame"><img class="art" alt=""><canvas class="effects" aria-hidden="true"></canvas></div>
      <div class="caption"><p class="eyebrow">A little space to slow down</p><h2 id="scene-name"></h2><p id="scene-note"></p></div>
      <div class="breath" hidden><div class="orb"></div><strong id="breath-cue">Breathe in</strong><small>In for 4 · out for 6 · follow comfortably</small></div>
      <div class="session-chip" hidden></div><div class="status" role="status" hidden></div>
      <button class="launcher" aria-expanded="false" aria-controls="calm-panel">Unwind ☷</button>
      <aside class="panel" id="calm-panel" aria-label="Unwind settings" hidden>
        <div class="panel-head"><div><p class="eyebrow">Make yourself at home</p><h3>A quieter moment</h3><p>Choose a world. Set your own pace.</p></div><button class="close" aria-label="Close unwind settings">×</button></div>
        <div class="label">Your surroundings</div><div class="themes"></div>
        <div class="section"><span class="label">Settle in</span><div class="row"><button id="view"></button><button id="motion"></button></div>
          <div class="row" style="margin-top:8px"><button id="rain"></button><button id="lamp"></button></div>
          <div class="row" id="rain-intensity"><label>Rain intensity<input id="intensity" aria-label="Rain intensity" type="range" min="20" max="100" value="65"></label></div>
        </div>
        <div class="section"><span class="label">Optional sound</span><div class="row"><select id="sound" aria-label="Ambient sound"><option value="rain">Soft rain</option><option value="brown">Deep hush</option></select><button id="audio" aria-pressed="false">Sound off</button></div><div class="row"><label>Volume<input id="volume" aria-label="Sound volume" type="range" min="0" max="100" value="35"></label></div><p class="timer-hint">Soft generated ambience. Starts only when you choose.</p></div>
        <div class="section"><span class="label">A gentle rhythm</span><div class="row"><button id="breathing" aria-pressed="false">Breathing guide</button><button id="immerse">Hide interface</button></div><p class="timer-hint">An optional 4-second inhale and 6-second exhale.</p></div>
        <div class="section"><span class="label">Time for yourself</span><div class="row"><select id="duration" aria-label="Session length"><option value="5">5 minutes</option><option value="10" selected>10 minutes</option><option value="20">20 minutes</option><option value="30">30 minutes</option></select><button id="timer-start">Start session</button></div><div id="timer-output" class="timer-readout" role="timer" aria-label="Session time remaining">10:00</div><div class="row"><button id="timer-reset">Reset timer</button></div><p class="timer-hint">A quiet finish, with a gentle sound fade. No alarm.</p></div>
      </aside>
    </section>`;
    host.replaceChildren(holder);
    const $=s=>root.querySelector(s);
    const stage=$('.stage'), frame=$('.frame'), img=$('.art'), canvas=$('canvas'), status=$('.status');
    const panel=$('.panel'), launcher=$('.launcher'), ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx){status.hidden=false;status.textContent='This browser cannot display the scene animation.';return {dispose(){holder.remove();}};}
    const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:lifetime.signal});
    function persist(){try{localStorage.setItem('cozy-calm-v1',JSON.stringify({theme:theme.id,fill:fillScreen,motion:playing,volume}));}catch(_){}}
    function pressed(el,state){el.setAttribute('aria-pressed',String(state));}
    for(const t of THEMES){
      const b=document.createElement('button');b.className='theme';b.dataset.theme=t.id;
      b.innerHTML=`<img src="assets/cozy-${t.asset}-thumb.webp" alt="" loading="lazy"><span>${t.name}</span>`;
      b.querySelector('img').style.filter=t.filter; pressed(b,t.id===theme.id);
      on(b,'click',()=>setTheme(t));$('.themes').append(b);
    }
    const drops=Array.from({length:128},()=>{
      const pane=Math.floor(Math.random()*panes.length),poly=panes[pane],xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
      return {pane,x:Math.min(...xs)+Math.random()*(Math.max(...xs)-Math.min(...xs)),y:Math.min(...ys)+Math.random()*(Math.max(...ys)-Math.min(...ys)),speed:125+Math.random()*135,length:7+Math.random()*12,alpha:.14+Math.random()*.2};
    });
    const steam=Array.from({length:22},(_,i)=>({age:i/22,seed:Math.random()*6.3,dx:(Math.random()-.5)*5,pace:.18+Math.random()*.07}));
    function layout(){
      if(!running)return;
      const w=Math.max(1,frame.clientWidth),h=Math.max(1,frame.clientHeight),dpr=Math.min(devicePixelRatio||1,w<700?1.35:1.7);
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      const scale=(fillScreen?Math.max:Math.min)(w/ART_W,h/ART_H);
      ctx.setTransform(scale*dpr,0,0,scale*dpr,(w-ART_W*scale)*(fillScreen?theme.focus:.5)*dpr,(h-ART_H*scale)*.5*dpr);
      img.style.objectFit=fillScreen?'cover':'contain'; img.style.objectPosition=`${fillScreen?theme.focus*100:50}% 50%`;
      $('#view').textContent=fillScreen?'Whole image':'Fill screen';pressed($('#view'),fillScreen);
      renderOnce();
    }
    function clearCanvas(){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore();
    }
    function polygon(poly){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
    function drawRain(dt){
      if(!raining || theme.kind !== 'nook')return;
      for(const p of drops){
        const poly=panes[p.pane],ys=poly.map(q=>q[1]),xs=poly.map(q=>q[0]);
        p.y += p.speed*dt*rainStrength;
        if(p.y>Math.max(...ys)) {p.y=Math.min(...ys);p.x=Math.min(...xs)+Math.random()*(Math.max(...xs)-Math.min(...xs));}
        ctx.save();polygon(poly);ctx.clip();
        ctx.strokeStyle='rgba(207,231,250,'+(p.alpha*rainStrength).toFixed(3)+')';ctx.lineWidth=1.15;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-1.8,p.y+p.length);ctx.stroke();ctx.restore();
      }
    }
    function drawSteam(dt){
      ctx.save();ctx.globalCompositeOperation='screen';
      for(const p of steam){
        p.age=(p.age+dt*p.pace)%1;
        const a=p.age,x=(theme.cup?.[0] || 459)+p.dx+Math.sin(p.seed+a*5.6)*(2+a*8),y=(theme.cup?.[1] || 503)-a*98,r=2.6+a*7;
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
      if(theme.kind !== 'nook')return;
      for(let i=0;i<lights.length;i++){
        const l=lights[i],slow=Math.sin(t*(l.type==='lamp'?2.4:7.4)+i*1.8),fast=Math.sin(t*18.1+i*.91);
        const bright=Math.max(.14,Math.min(1,.56+.19*slow+.09*fast)) * (l.type==='lamp' ? lampLevel : 1);
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
      if(theme.kind !== 'nook'||!img.complete||!img.naturalWidth||!img.naturalHeight)return;
      const b=.5+.5*Math.sin(time*.0027),cx=843,cy=559,inflate=.003+b*.014;
      ctx.save();ctx.beginPath();ctx.ellipse(cx,cy,112,47,-.10,0,Math.PI*2);ctx.clip();
      ctx.globalAlpha=.55+.4*b;ctx.translate(cx,cy);ctx.scale(1+inflate,1+inflate*.65);ctx.translate(-cx,-cy);
      ctx.drawImage(img,717,475,255,154,717,475,255,154);ctx.restore();
    }
    function renderOnce(){
      clearCanvas();if(!loaded)return;
      drawRain(0);drawSteam(0);drawFlicker(elapsed*1000);drawCat(elapsed*1000);
    }
    function tick(ts){
      raf=0;if(!running||!playing||document.hidden||!loaded)return;
      const dt=Math.min(.07,Math.max(0,(ts-(last||ts))/1000));last=ts;elapsed+=dt;
      clearCanvas();drawRain(dt);drawSteam(dt);drawFlicker(elapsed*1000);drawCat(elapsed*1000);
      raf=requestAnimationFrame(tick);
    }
    function restart(){cancelAnimationFrame(raf);raf=0;last=0;renderOnce();if(running&&playing&&!document.hidden&&loaded)raf=requestAnimationFrame(tick);}
    function update(){
      $('#scene-name').textContent=theme.name;$('#scene-note').textContent=theme.note;
      root.querySelectorAll('[data-theme]').forEach(b=>pressed(b,b.dataset.theme===theme.id));
      $('#motion').textContent=playing?'Motion on':'Motion off';pressed($('#motion'),playing);
      $('#rain').hidden=$('#lamp').hidden=$('#rain-intensity').hidden=theme.kind!=='nook';
      $('#rain').textContent=raining?'Rain on':'Rain off';pressed($('#rain'),raining);
      $('#lamp').textContent=lampLevel>.7?'Lamp warm':'Lamp low';pressed($('#lamp'),lampLevel>.7);
      $('#audio').textContent=audioOn?'Sound on':'Sound off';pressed($('#audio'),audioOn);
      $('#sound').value=sound;$('#volume').value=Math.round(volume*100);
      $('#breathing').textContent=breathing?'Stop breathing guide':'Breathing guide';pressed($('#breathing'),breathing);
      $('.breath').hidden=!breathing;$('.breath').classList.toggle('static',reduced.matches||!playing);
    }
    async function setTheme(next){
      const token=++requestId;
      status.hidden=false;status.textContent='Opening your quiet place…';
      const candidate=new Image();candidate.src=`assets/cozy-${next.asset}.webp`;
      try{
        await candidate.decode();
        if(!running||token!==requestId)return;
        theme=next;raining=theme.rain;lampLevel=theme.lamp;sound=theme.sound;
        loaded=false;img.src=candidate.src;img.alt=theme.name+' — '+theme.note;
        await img.decode();if(!running||token!==requestId)return;
        loaded=true;img.style.filter=canvas.style.filter=theme.filter;status.hidden=true;
        stage.dataset.theme=theme.id;update();layout();restart();persist();applyAudio();
      }catch(error){
        if(!running||token!==requestId)return;
        status.hidden=false;status.textContent='This scene could not load. Choose another theme or refresh.';
      }
    }
    function showPanel(open){panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open)immersed=false;setImmersion();}
    function setImmersion(){stage.classList.toggle('immersed',immersed);document.body.classList.toggle('cozy-immersed',immersed);launcher.textContent=immersed?'Show controls':'Unwind ☷';updateTimer();}
    on(launcher,'click',()=>{if(immersed){immersed=false;setImmersion();return;}showPanel(panel.hidden);});
    on($('.close'),'click',()=>{showPanel(false);launcher.focus();});
    on($('#immerse'),'click',()=>{showPanel(false);immersed=true;setImmersion();launcher.focus();});
    on(document,'keydown',e=>{if(e.key==='Escape'){if(immersed){immersed=false;setImmersion();}else if(!panel.hidden){showPanel(false);launcher.focus();}}});
    on($('#view'),'click',()=>{fillScreen=!fillScreen;layout();persist();});
    on($('#motion'),'click',()=>setPlaying(!playing));
    function setPlaying(value){
      if(breathing){breathElapsed=breathSeconds();breathStart=performance.now();}
      playing=value;update();restart();persist();options.onMotionChange?.(playing);
    }
    on($('#rain'),'click',()=>{raining=!raining;update();renderOnce();});
    on($('#lamp'),'click',()=>{lampLevel=lampLevel>.7?.35:1;update();renderOnce();});
    on($('#intensity'),'input',e=>{rainStrength=Number(e.target.value)/100;renderOnce();});
    on($('#volume'),'input',e=>{volume=Number(e.target.value)/100;persist();applyAudio();});
    on($('#sound'),'change',e=>{sound=e.target.value;applyAudio();});
    on($('#audio'),'click',async()=>{
      if(audioPending)return;audioPending=true;
      try{
        if(!audio)initAudio();if(!audio)throw Error('Web Audio unavailable');
        if(audio.ctx.state==='suspended')await audio.ctx.resume();
        if(!running)return;
        audioOn=!audioOn;applyAudio();update();
      }catch(_){audioOn=false;update();$('#audio').textContent='Audio unavailable';}
      finally{audioPending=false;}
    });
    function initAudio(){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const context=new AC(),buffer=context.createBuffer(1,context.sampleRate*5,context.sampleRate),data=buffer.getChannelData(0);
      // Stationary filtered noise: no startling droplets or sharp transients.
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const src=context.createBufferSource();src.buffer=buffer;src.loop=true;
      const hp=context.createBiquadFilter();hp.type='highpass';
      const lp=context.createBiquadFilter();lp.type='lowpass';
      const gain=context.createGain();gain.gain.value=0;
      src.connect(hp);hp.connect(lp);lp.connect(gain);gain.connect(context.destination);src.start();
      audio={ctx:context,src,hp,lp,gain};
    }
    function applyAudio(fade=1.5){
      if(!audio)return;const now=audio.ctx.currentTime;
      audio.hp.frequency.setTargetAtTime(sound==='rain'?380:35,now,.6);
      audio.lp.frequency.setTargetAtTime(sound==='rain'?4200:350,now,.6);
      const gain=audio.gain.gain;
      gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);
      gain.linearRampToValueAtTime(audioOn?volume*(sound==='rain'?.14:.45):0,now+fade);
    }
    function breathSeconds(){return breathElapsed+(playing&&!document.hidden?(performance.now()-breathStart)/1000:0);}
    on($('#breathing'),'click',()=>{breathing=!breathing;breathElapsed=0;breathStart=performance.now();update();updateGuidance();showPanel(false);});
    function updateGuidance(){
      if(!breathing)return;
      const phase=breathSeconds()%10,inhale=phase<4;
      $('#breath-cue').textContent=inhale?'Breathe in':'Breathe out';
      const ease=(1-Math.cos(Math.PI*(inhale?phase/4:1-(phase-4)/6)))/2;
      $('.orb').style.setProperty('--breath-scale',String(.88+ease*.35));
    }
    function remaining(){return sessionRunning?Math.max(0,(sessionDeadline-Date.now())/1000):sessionRemaining;}
    function clock(seconds){const n=Math.ceil(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
    function updateTimer(){
      const left=remaining();
      if(sessionRunning&&left<=0){
        sessionRunning=false;sessionRemaining=0;sessionFinished=true;breathing=false;audioOn=false;applyAudio(10);
        setPlaying(false);update();status.textContent='Your quiet moment is complete. Take your time.';status.hidden=false;
      }
      $('#timer-output').textContent=sessionFinished?'A moment well spent':clock(sessionRunning||sessionRemaining?left:Number($('#duration').value)*60);
      $('#timer-start').textContent=sessionRunning?'Pause session':sessionRemaining?'Resume session':'Start session';
      $('#duration').disabled=sessionRunning||sessionRemaining>0;
      $('.session-chip').hidden=(!sessionRunning&&!sessionRemaining)||immersed;
      $('.session-chip').textContent=(sessionRunning?'Quiet time · ':'Paused · ')+clock(left);
    }
    on($('#timer-start'),'click',()=>{
      if(sessionRunning){sessionRemaining=remaining();sessionRunning=false;}
      else{sessionRemaining=sessionRemaining||Number($('#duration').value)*60;sessionDeadline=Date.now()+sessionRemaining*1000;sessionRunning=true;sessionFinished=false;status.hidden=true;}
      updateTimer();
    });
    on($('#timer-reset'),'click',()=>{sessionRunning=false;sessionRemaining=0;sessionFinished=false;status.hidden=true;updateTimer();});
    on($('#duration'),'change',updateTimer);
    const guideTimer=setInterval(()=>{if(!running||document.hidden)return;if(breathing&&playing)updateGuidance();if(sessionRunning)updateTimer();},100);
    on(window,'resize',layout);
    on(window,'pageshow',restart);
    function visibility(){
      if(document.hidden){if(breathing&&playing){breathElapsed+=(performance.now()-breathStart)/1000;}cancelAnimationFrame(raf);raf=0;audio?.ctx.suspend().catch(()=>{});}
      else{breathStart=performance.now();updateTimer();if(audioOn)audio?.ctx.resume().catch(()=>{});restart();}
    }
    on(document,'visibilitychange',visibility);
    on(reduced,'change',()=>{if(reduced.matches)setPlaying(false);update();});
    const observer=new ResizeObserver(layout);observer.observe(stage);
    const handle={
      dispose(){
        if(!running)return;running=false;requestId++;cancelAnimationFrame(raf);clearInterval(guideTimer);observer.disconnect();lifetime.abort();
        document.body.classList.remove('cozy-immersed');
        if(audio){try{audio.src.stop();}catch(_){}audio.ctx.close().catch(()=>{});audio=null;}
        holder.remove();if(active===handle)active=null;
      },pause(){setPlaying(false);},resume(){setPlaying(true);}
    };
    active=handle;update();layout();setTheme(theme);options.onMotionChange?.(playing);
    return handle;
  }
  return {mount,dispose(){active?.dispose();},pause(){active?.pause();},resume(){active?.resume();}};
})();
