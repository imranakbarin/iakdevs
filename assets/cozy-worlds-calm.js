/* A living illustration with one small dock. Scene, sound, and pause only. */
window.CozyWorlds=(()=>{
  const SCENES=[
    {id:'nook',name:'Reading nook',focus:.74,sound:'rain'},
    {id:'tea',name:'Tea garden',focus:.68,sound:'hush'},
    {id:'cabin',name:'Lakeside cabin',focus:.55,sound:'hush'}
  ];
  const icons={
    worlds:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 5 11 7-11 7Z"/>',
    mute:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="m16 9 6 6m0-6-6 6"/>',
    sound:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    down:'<path d="m7 10 5 5 5-5"/>'
  };
  const svg=name=>`<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  let active=null;
  function mount(host,options={}){
    active?.dispose();
    const lifetime=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let saved={};try{saved=JSON.parse(localStorage.getItem('cozy-simple-v2')||'null')||{};if(!saved.scene){const old=JSON.parse(localStorage.getItem('cozy-calm-v1')||'null');saved.scene=old?.theme;}}catch(_){}
    let scene=SCENES.find(s=>s.id===saved.scene)||SCENES[0];
    // A pause belongs to this visit, not every future visit. Reduced motion still wins.
    let playing=!reduced.matches,running=true,current=null,raf=0,last=0,elapsed=0,loadId=0,menu=null,idleTimer=0,retireTimer=0;
    let audio=null,audioOn=false,audioPending=false;
    const holder=document.createElement('div');holder.style.cssText='position:absolute;inset:0';
    const root=holder.attachShadow({mode:'open'});
    root.innerHTML=`<style>
      :host{position:absolute;inset:0;display:block;color:#f3eddf;font:12px/1.4 system-ui,-apple-system,sans-serif}
      *{box-sizing:border-box}[hidden]{display:none!important}
      .stage,.picture,.art,canvas{position:absolute;inset:0;width:100%;height:100%}
      .stage{overflow:hidden;background:#131814}.picture{opacity:0;transition:opacity .8s ease;pointer-events:none}.picture.visible{opacity:1}
      .art{display:block;object-fit:cover;user-select:none;-webkit-user-drag:none}canvas{pointer-events:none}
      .dock{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:3;display:flex;align-items:center;gap:2px;padding:4px 6px;max-width:calc(100% - 24px);border:1px solid #e6e0ca24;border-radius:28px;background:#17201dd4;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);transition:opacity .7s ease}
      .dock.soft{opacity:.35}.dock:hover,.dock:focus-within,.dock.open{opacity:1}
      button{appearance:none;border:0;background:transparent;color:inherit;font:500 12px/1.3 system-ui,-apple-system,sans-serif;cursor:pointer;min-height:44px;padding:0 12px;border-radius:22px;display:flex;align-items:center;justify-content:center;gap:9px;white-space:nowrap}
      button:hover{background:#ffffff0c}button:focus-visible{outline:2px solid #e0e7ca;outline-offset:1px}
      svg{display:block;width:19px;height:19px}.icon{width:44px;padding:11px}.scene-button{min-width:136px;padding:0 9px}.scene-button svg{width:14px;height:14px;opacity:.7}
      .menu{position:absolute;bottom:calc(100% + 10px);left:0;right:0;border:1px solid #e6e0ca24;border-radius:17px;padding:5px;background:#19231ff5;box-shadow:0 10px 30px #0003;backdrop-filter:blur(16px)}
      .menu button{justify-content:space-between;text-align:left;width:100%;border-radius:12px;padding:0 14px;font-weight:400}.menu button[aria-current=true]{background:#f3eddf0d;color:#e7edcf}.menu button[aria-current=true]:after{content:'•';font-size:16px}
      .status{position:absolute;bottom:90px;left:50%;transform:translateX(-50%);max-width:calc(100% - 40px);padding:8px 14px;border-radius:14px;background:#17201de8;font-size:12px;text-align:center}
      @media(max-width:400px){.scene-button{min-width:126px}.dock{bottom:max(14px,env(safe-area-inset-bottom))}}
      @media(prefers-reduced-motion:reduce){.picture,.dock{transition:none}.dock.soft{opacity:.7}}
    </style><section class="stage" aria-label="Cozy Worlds">
      <nav class="dock" aria-label="Scene controls">
        <div class="menu" id="world-menu" aria-label="Other experiences" hidden></div>
        <div class="menu" id="scene-menu" aria-label="Choose a scene" hidden></div>
        <button class="icon" id="worlds" aria-label="Other experiences" aria-expanded="false" aria-controls="world-menu">${svg('worlds')}</button>
        <button class="scene-button" id="scene" aria-label="Choose a scene" aria-expanded="false" aria-controls="scene-menu"><span></span>${svg('down')}</button>
        <button class="icon" id="audio" aria-label="Turn sound on" aria-pressed="false">${svg('mute')}</button>
        <button class="icon" id="motion" aria-label="Pause animation">${svg('pause')}</button>
      </nav><div class="status" role="status" hidden></div>
    </section>`;
    host.replaceChildren(holder);
    const $=s=>root.querySelector(s),stage=$('.stage'),dock=$('.dock'),status=$('.status');
    const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:lifetime.signal});
    function persist(){try{localStorage.setItem('cozy-simple-v2',JSON.stringify({scene:scene.id}));}catch(_){}}
    function wake(){dock.classList.remove('soft');clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(!menu)dock.classList.add('soft');},4500);}
    function closeMenus(focus=false){const was=menu;menu=null;$('#world-menu').hidden=$('#scene-menu').hidden=true;$('#worlds').setAttribute('aria-expanded','false');$('#scene').setAttribute('aria-expanded','false');dock.classList.remove('open');if(focus&&was)$(was==='scene'?'#scene':'#worlds').focus();wake();}
    function toggleMenu(next){const show=menu!==next;closeMenus();if(show){menu=next;$(next==='scene'?'#scene-menu':'#world-menu').hidden=false;$(next==='scene'?'#scene':'#worlds').setAttribute('aria-expanded','true');dock.classList.add('open');}}
    for(const s of SCENES){const b=document.createElement('button');b.type='button';b.textContent=s.name;b.dataset.scene=s.id;on(b,'click',()=>{closeMenus(true);choose(s);});$('#scene-menu').append(b);}
    for(const [id,name] of [['art','World art'],['road','Road trip'],['zen','Zen garden']]){const b=document.createElement('button');b.type='button';b.textContent=name;on(b,'click',()=>{closeMenus();options.onExperienceChange?.(id);});$('#world-menu').append(b);}
    function update(){
      $('#scene span').textContent=scene.name;$('#scene').setAttribute('aria-label',`Choose a scene: ${scene.name}`);
      root.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scene===scene.id)));
      $('#motion').innerHTML=svg(playing?'pause':'play');$('#motion').setAttribute('aria-label',playing?'Pause animation':'Play animation');
      $('#audio').innerHTML=svg(audioOn?'sound':'mute');$('#audio').setAttribute('aria-label',audioOn?'Turn sound off':'Turn sound on');$('#audio').setAttribute('aria-pressed',String(audioOn));
      stage.dataset.motion=playing?'playing':'paused';stage.dataset.scene=scene.id;
    }
    function clear(c){const ctx=c.ctx;ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.cv.width,c.cv.height);ctx.restore();}
    function render(){if(!current)return;clear(current);current.engine.draw(current.ctx,elapsed);}
    function layout(){
      if(!running||!current)return;
      const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
      const dpr=Math.min(devicePixelRatio||1,w<700?1.3:1.6),scale=Math.max(w/1448,h/1086),cv=current.cv;
      cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
      current.ctx.setTransform(scale*dpr,0,0,scale*dpr,(w-1448*scale)*scene.focus*dpr,(h-1086*scale)*.5*dpr);
      render();
    }
    function tick(ts){
      raf=0;if(!running||!playing||document.hidden||!current)return;
      elapsed+=Math.min(.05,Math.max(0,(ts-(last||ts))/1000));last=ts;render();raf=requestAnimationFrame(tick);
    }
    function restart(){cancelAnimationFrame(raf);raf=0;last=0;if(!running)return;render();if(playing&&!document.hidden&&current)raf=requestAnimationFrame(tick);}
    function setPlaying(on){playing=Boolean(on);update();restart();options.onMotionChange?.(playing);wake();}
    async function choose(next){
      const id=++loadId;const candidate=new Image();candidate.src=`assets/cozy-${next.id}.webp`;
      if(!current){status.textContent='Opening…';status.hidden=false;}
      try{
        await candidate.decode();if(!running||id!==loadId)return;
        const engine=window.CozySceneMotion.create(candidate,next.id);
        const layer=document.createElement('div');layer.className='picture';candidate.className='art';candidate.alt=next.name;candidate.style.objectPosition=`${next.focus*100}% 50%`;
        const cv=document.createElement('canvas');cv.setAttribute('aria-hidden','true');layer.append(candidate,cv);const ctx=cv.getContext('2d',{alpha:true});if(!ctx){engine.dispose();throw Error('Canvas unavailable');}
        clearTimeout(retireTimer);for(const l of stage.querySelectorAll('.picture'))if(l!==current?.layer)l.remove();
        const previous=current;current={layer,cv,ctx,engine};scene=next;elapsed=0;stage.insertBefore(layer,dock);layout();
        layer.getBoundingClientRect();layer.classList.add('visible');
        if(previous){previous.engine.dispose();previous.layer.classList.remove('visible');retireTimer=setTimeout(()=>previous.layer.remove(),850);}
        status.hidden=true;update();persist();applyAudio();restart();
      }catch(error){if(!running||id!==loadId)return;status.textContent='The scene could not load. Please choose a scene again.';status.hidden=false;}
    }
    on($('#scene'),'click',()=>toggleMenu('scene'));on($('#worlds'),'click',()=>toggleMenu('world'));
    on($('#motion'),'click',()=>setPlaying(!playing));
    on(stage,'pointermove',wake);on(stage,'pointerdown',e=>{wake();if(!dock.contains(e.target))closeMenus();});
    on(document,'keydown',e=>{if(e.key==='Escape')closeMenus(true);});
    function initAudio(){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error('Audio unavailable');
      const ctx=new AC(),buffer=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      const src=ctx.createBufferSource();src.buffer=buffer;src.loop=true;const hp=ctx.createBiquadFilter();hp.type='highpass';const lp=ctx.createBiquadFilter();lp.type='lowpass';const gain=ctx.createGain();gain.gain.value=0;
      src.connect(hp);hp.connect(lp);lp.connect(gain);gain.connect(ctx.destination);src.start();audio={ctx,src,hp,lp,gain};
    }
    function applyAudio(){if(!audio)return;const now=audio.ctx.currentTime,rain=scene.sound==='rain';audio.hp.frequency.setTargetAtTime(rain?380:35,now,.6);audio.lp.frequency.setTargetAtTime(rain?4200:350,now,.6);const gain=audio.gain.gain;if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);else{gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);}gain.linearRampToValueAtTime(audioOn?(rain?.045:.14):0,now+1.1);}
    on($('#audio'),'click',async()=>{
      if(audioPending)return;audioPending=true;
      try{if(!audio)initAudio();if(audio.ctx.state==='suspended')await audio.ctx.resume();if(!running)return;audioOn=!audioOn;applyAudio();update();}
      catch(_){audioOn=false;update();status.textContent='Sound is unavailable in this browser.';status.hidden=false;}
      finally{audioPending=false;}
    });
    on(window,'resize',layout);
    on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0;audio?.ctx.suspend().catch(()=>{});}else{if(audioOn)audio?.ctx.resume().catch(()=>{});restart();wake();}});
    on(reduced,'change',()=>{if(reduced.matches)setPlaying(false);});
    const observer=new ResizeObserver(layout);observer.observe(stage);
    const handle={
      pause(){setPlaying(false);},resume(){setPlaying(true);},
      dispose(){if(!running)return;running=false;loadId++;cancelAnimationFrame(raf);clearTimeout(idleTimer);clearTimeout(retireTimer);lifetime.abort();observer.disconnect();current?.engine.dispose();if(audio){try{audio.src.stop();}catch(_){}audio.ctx.close().catch(()=>{});audio=null;}holder.remove();if(active===handle)active=null;}
    };
    active=handle;update();choose(scene);wake();options.onMotionChange?.(playing);return handle;
  }
  return {mount,dispose(){active?.dispose();},pause(){active?.pause();},resume(){active?.resume();}};
})();
