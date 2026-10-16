window.CozyWorlds=(()=>{let active=null;function mount(host){active?.dispose();const holder=document.createElement('div');holder.style.cssText='position:absolute;inset:0';holder.dataset.cozyBuild='v13-20261016';const root=holder.attachShadow({mode:'open'});root.innerHTML="<style>\n  :host {\n    --bg:#0f1219;\n    --panel:rgba(18,22,31,.82);\n    --line:rgba(255,231,200,.18);\n    --text:#f5e5cb;\n    --muted:#cdbca2;\n  }\n  * { box-sizing:border-box; }\n  :host { position:absolute; inset:0; display:block; overflow:hidden; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }\n\n  #app { position:fixed; inset:0; width:100vw; height:100dvh; overflow:hidden; background:var(--bg); }\n  .scene { position:absolute; inset:0; width:100%; height:100%; overflow:hidden; }\n  .scene img { position:absolute; user-select:none; -webkit-user-drag:none; pointer-events:none; }\n  .scene #backdrop {left:0;top:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%;filter:blur(36px) brightness(.52) saturate(.83);transform:scale(1.07);will-change:auto;}\n  .scene #art {max-width:none;max-height:none;object-fit:fill;}\n  canvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }\n  .title {\n    position:absolute; left:max(14px, env(safe-area-inset-left)); top:max(12px, env(safe-area-inset-top)); z-index:4;\n    padding:10px 14px; border-radius:14px; background:rgba(10,12,18,.50); border:1px solid rgba(255,255,255,.06); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);\n  }\n  .title h1 { margin:0; font:italic 700 clamp(18px, 2.7vw, 28px)/1.1 Georgia, serif; letter-spacing:.2px; }\n  .title p { margin:4px 0 0; font-size:12px; color:var(--muted); }\n  .controls {\n    position:absolute; left:50%; bottom:calc(12px + env(safe-area-inset-bottom)); transform:translateX(-50%);\n    z-index:5; display:flex; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center;\n    width:min(100% - 16px, 920px); padding:8px; border-radius:20px; background:var(--panel); border:1px solid var(--line);\n    backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); box-shadow:0 12px 32px rgba(0,0,0,.30);\n  }\n  button {\n    appearance:none; border:1px solid rgba(255,226,190,.18); background:rgba(255,255,255,.05); color:var(--text);\n    border-radius:999px; padding:10px 14px; font:600 12px/1 system-ui,sans-serif; letter-spacing:.15px; cursor:pointer;\n    min-height:38px; transition:.22s ease background,.22s ease border-color,.22s ease transform;\n  }\n  button:hover { background:rgba(255,255,255,.09); }\n  button:active { transform:scale(.98); }\n  button[data-on=\"true\"] { background:rgba(255,210,140,.12); border-color:rgba(255,220,175,.35); }\n  .hint { position:absolute; right:max(14px, env(safe-area-inset-right)); top:max(12px, env(safe-area-inset-top)); z-index:4; padding:10px 12px; font-size:12px; color:var(--muted); background:rgba(10,12,18,.45); border:1px solid rgba(255,255,255,.06); border-radius:14px; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); max-width:min(320px, 45vw); }\n  @media (max-width: 780px) {\n    .title p, .hint { display:none; }\n    .controls { width:calc(100% - 12px); gap:6px; padding:6px; bottom:calc(10px + env(safe-area-inset-bottom)); }\n    button { padding:10px 12px; font-size:11px; min-height:36px; }\n  }/* Cozy Worlds v3: a compact, discoverable controller; no full-width artwork obstruction. */\n  .controls {left:auto;right:max(12px,env(safe-area-inset-right));transform:none;width:auto;max-width:min(92vw,725px);bottom:calc(14px + env(safe-area-inset-bottom));padding:6px;gap:5px;border-radius:15px;justify-content:flex-end;}\n  .controls button {min-height:35px;padding:8px 10px;font-size:11px;white-space:nowrap;}\n  .controls #controlsToggle {background:rgba(255,223,170,.13);border-color:rgba(255,226,190,.4);font-weight:700;}\n  .controls.is-collapsed {width:auto;max-width:none;padding:5px;border-radius:100px;}\n  .controls.is-collapsed > button:not(#controlsToggle) {display:none;}\n  .controls button:focus-visible {outline:2px solid #ffe4b3;outline-offset:2px;}\n  @media(max-width:780px){\n    .controls {width:auto;max-width:calc(100% - 16px);left:auto;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));gap:4px;padding:6px;border-radius:13px;}\n    .controls button {padding:8px 9px;min-height:35px;font-size:11px;}\n  }\n  @media(max-width:540px){.controls:not(.is-collapsed){max-width:calc(100% - 14px);justify-content:center}.controls button{font-size:10px;}}\n</style><div id=\"app\"><div class=\"scene\" id=\"scene\"><img id=\"backdrop\" aria-hidden=\"true\" alt=\"\"><img id=\"art\" alt=\"Cozy Worlds 2.0\"><canvas id=\"fx-glass\"></canvas><canvas id=\"fx-rain\"></canvas><canvas id=\"fx-shade\"></canvas><canvas id=\"fx-light\"></canvas><canvas id=\"fx-cat\"></canvas><canvas id=\"fx-steam\"></canvas></div><div class=\"controls\" id=\"controls\"><button id=\"controlsToggle\" type=\"button\" aria-expanded=\"true\" aria-label=\"Collapse or expand Cozy Worlds controls\">✦ Scene</button><button id=\"viewBtn\">Whole image</button><button id=\"lampBtn\">Lamp: warm</button><button id=\"rainBtn\">Rain: on</button><button id=\"audioBtn\">Rain ambience</button><button id=\"motionBtn\">Motion: on</button></div></div>";host.replaceChildren(holder);const logic=(()=>{
  const ART_W = 1448, ART_H = 1086;
  const scene = root.getElementById('scene');
  const art = root.getElementById('art');
  const backdrop = root.getElementById('backdrop');
  const rainCv = root.getElementById('fx-rain');
  const glassCv = root.getElementById('fx-glass');
  const shadeCv = root.getElementById('fx-shade');
  const lightCv = root.getElementById('fx-light');
  const catCv = root.getElementById('fx-cat');
  const steamCv = root.getElementById('fx-steam');
  const viewBtn = root.getElementById('viewBtn');
  const lampBtn = root.getElementById('lampBtn');
  const rainBtn = root.getElementById('rainBtn');
  const audioBtn = root.getElementById('audioBtn');
  const motionBtn = root.getElementById('motionBtn');
  const controls = root.getElementById('controls');
  const controlsToggle = root.getElementById('controlsToggle');
  let controlsCollapsed = window.innerWidth <= 540;
  const lampPatch = document.createElement('canvas');
  const catPatch = document.createElement('canvas');
  const earPatch = document.createElement('canvas');

  const isPortraitPhone = () => window.innerWidth < 820 && window.innerHeight > window.innerWidth;
  let fillScreen = isPortraitPhone();
  let motionOn = true; // motion can always be paused explicitly
  let raining = true;
  let audioOn = false;
  let lampTarget = 1;
  let lampLevel = 1;
  let artworkReady = false;
  let artworkCoordsMatch = true;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let imgRect = { x:0, y:0, w:ART_W, h:ART_H, scale:1 };
  let catEarTwitchUntil = 0;
  let nextEarTwitchAt = 4.5 + Math.random()*5.5;

  // Pixel-fitted, glass-only masks for the 1448x1086 original artwork.
  // Intentionally exclude the curtains, wall, lamp, flower arrangement and books.
  // Do not expand to rectangular window bounds: interior objects occlude that glass.
  const rainPanes = [
    [[1052,15],[1152,15],[1152,138],[1052,149]],
    [[1205,10],[1285,10],[1285,124],[1205,129]],
    [[1299,10],[1323,10],[1323,122],[1299,124]],
    [[1103,165],[1151,162],[1151,242],[1103,242]],
    [[1205,153],[1285,149],[1285,278],[1205,287]],
    [[1299,147],[1324,143],[1324,285],[1299,287]],
    [[1205,305],[1284,302],[1284,360],[1205,370]],
    [[1301,308],[1323,308],[1323,443],[1301,443]]
  ];
  const paneBounds = rainPanes.map(p => {
    const xs = p.map(v => v[0]), ys = p.map(v => v[1]);
    return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
  });

  const rainDrops = Array.from({length:115}, () => {
    const pane = Math.floor(Math.random()*rainPanes.length);
    const b = paneBounds[pane];
    return { pane, x:b.minX + Math.random()*(b.maxX-b.minX), y:b.minY + Math.random()*(b.maxY-b.minY), speed:75+Math.random()*125, len:10+Math.random()*17, alpha:.21+Math.random()*.24 };
  });
  const beads = Array.from({length:70}, () => {
    const pane = Math.floor(Math.random()*rainPanes.length);
    const b = paneBounds[pane];
    return { pane, x:b.minX + Math.random()*(b.maxX-b.minX), y:b.minY + Math.random()*(b.maxY-b.minY), r:0.8 + Math.random()*1.8, speed:7+Math.random()*18, alpha:.10+Math.random()*.17, trail:3+Math.random()*18 };
  });

  const candles = [
    {x:117,y:132,size:18,glow:48,type:'candle',reflect:[{x:114,y:160,len:13,spread:7}]},
    {x:115,y:393,size:18,glow:50,type:'candle',reflect:[{x:126,y:432,len:20,spread:10}]},
    {x:341,y:555,size:26,glow:70,type:'candle',reflect:[{x:360,y:604,len:42,spread:34},{x:334,y:598,len:30,spread:24}]},
    {x:622,y:242,size:16,glow:38,type:'candle',reflect:[{x:631,y:279,len:16,spread:10}]},
    {x:1409,y:81,size:22,glow:55,type:'candle',reflect:[{x:1400,y:121,len:20,spread:10}]},
    {x:1405,y:769,size:23,glow:70,type:'candle',reflect:[{x:1390,y:812,len:34,spread:18},{x:1422,y:812,len:28,spread:16}]},
    {x:1016,y:319,size:24,glow:98,type:'lamp',reflect:[{x:1004,y:350,len:44,spread:18},{x:1040,y:353,len:20,spread:12}]}
  ];

  const steam = Array.from({length:26}, (_,i) => ({ age:i/26, speed:.12+Math.random()*.10, phase:Math.random()*Math.PI*2, drift:-8+Math.random()*16, size:2.2+Math.random()*2.5 }));

  function ensureCanvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, scene.clientWidth < 650 ? 1.5 : 2);
    const rect = scene.getBoundingClientRect();
    const nextWidth=Math.max(1,Math.round(rect.width*dpr));
    const nextHeight=Math.max(1,Math.round(rect.height*dpr));
    if(cv.width!==nextWidth)cv.width=nextWidth;
    if(cv.height!==nextHeight)cv.height=nextHeight;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return ctx;
  }

  function computeLayout() {
    // Explicitly position the source image using the SAME transform as every effect.
    // CSS object-fit inside the shadow host previously left an entire black viewport column.
    const vw = Math.max(1,window.innerWidth), vh = Math.max(1,window.innerHeight);
    scene.style.width = vw+'px'; scene.style.height = vh+'px';
    const scale = fillScreen ? Math.max(vw/ART_W, vh/ART_H) : Math.min(vw/ART_W, vh/ART_H);
    const focusX = fillScreen ? .72 : .5;
    const w = ART_W * scale, h = ART_H * scale;
    const x = (vw - w) * focusX, y = (vh - h) * .5;
    imgRect = { x, y, w, h, scale };
    art.style.inset='auto';
    art.style.left=x+'px';art.style.top=y+'px';
    art.style.width=w+'px';art.style.height=h+'px';
    art.style.objectFit='fill';
    backdrop.style.display=fillScreen?'none':'block';
    backdrop.style.objectPosition='50% 50%';
    viewBtn.textContent = fillScreen ? 'Fit whole room' : 'Immersive crop';
    viewBtn.dataset.on = String(!fillScreen);
  }

  function toScreen(x,y) { return [imgRect.x + x*imgRect.scale, imgRect.y + y*imgRect.scale]; }
  function scaleVal(v) { return v*imgRect.scale; }
  function clear(ctx, cv) { ctx.clearRect(0,0,cv.width,cv.height); }
  function polygon(ctx, pts) { pts.forEach((p,i)=>{ const [sx,sy]=toScreen(p[0],p[1]); if(i===0) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy); }); ctx.closePath(); }

  function updateButtons() {
    lampBtn.textContent = lampTarget > .5 ? 'Lamp: on' : 'Lamp: off';
    lampBtn.dataset.on = String(lampTarget > .5);
    rainBtn.textContent = raining ? 'Rain: on' : 'Rain: off';
    rainBtn.dataset.on = String(raining);
    audioBtn.dataset.on = String(audioOn);
    audioBtn.textContent = audioOn ? 'Sound: on' : 'Sound: off';
    motionBtn.textContent = motionOn ? 'Motion: on' : 'Motion: paused';
    motionBtn.dataset.on = String(motionOn);
    controls.classList.toggle('is-collapsed',controlsCollapsed);
    controlsToggle.setAttribute('aria-expanded',String(!controlsCollapsed));
    controlsToggle.textContent = controlsCollapsed ? '☰ Cozy v13' : '✕ Cozy v13';
    for(const [button,pressed] of [[lampBtn,lampTarget>.5],[rainBtn,raining],[audioBtn,audioOn],[motionBtn,motionOn],[viewBtn,!fillScreen]]) button.setAttribute('aria-pressed',String(pressed));
  }


  // Each visual effect owns one compositing layer in original artwork coordinates.
  // The source painting has baked lighting/rain: these overlays suppress, not reconstruct, those pixels.
  function drawGlass() {
    const ctx=ensureCanvas(glassCv); clear(ctx,glassCv);
    if(raining || !artworkReady || !artworkCoordsMatch)return;
    ctx.save();ctx.beginPath();
    for(const pane of rainPanes)polygon(ctx,pane);
    ctx.clip();
    ctx.filter='blur(' + Math.max(2,4.2*imgRect.scale).toFixed(1) + 'px)';
    ctx.drawImage(art,imgRect.x,imgRect.y,imgRect.w,imgRect.h);
    ctx.filter='none';
    ctx.fillStyle='rgba(25,34,43,.12)';
    ctx.fillRect(0,0,scene.clientWidth,scene.clientHeight);
    ctx.restore();
  }

  function prepareLayers(){
    if(!artworkReady)return;
    // Feathered image-derived dark patch: visibly extinguishes the bulb without a dark rectangle.
    lampPatch.width=210;lampPatch.height=175;
    const l=lampPatch.getContext('2d');l.clearRect(0,0,210,175);
    l.filter='brightness(.22) saturate(.65)';
    l.drawImage(art,922,206,210,175,0,0,210,175);l.filter='none';
    l.globalCompositeOperation='destination-in';
    const lg=l.createRadialGradient(92,90,19,92,90,105);
    lg.addColorStop(0,'rgba(255,255,255,1)');
    lg.addColorStop(.52,'rgba(255,255,255,.97)');
    lg.addColorStop(1,'rgba(255,255,255,0)');
    l.fillStyle=lg;l.fillRect(0,0,210,175);l.globalCompositeOperation='source-over';

    // The cat's chest and ear are source-image cutouts with alpha-feathered edges.
    // No straight clip seams or geometry-only hard edges remain.
    function feather(canvas,x,y,w,h,inner,outer,yscale){
      canvas.width=w;canvas.height=h;
      const c=canvas.getContext('2d');c.drawImage(art,x,y,w,h,0,0,w,h);
      c.globalCompositeOperation='destination-in';
      c.save();c.translate(w/2,h/2);c.scale(1,yscale);
      const g=c.createRadialGradient(0,0,inner,0,0,outer);
      g.addColorStop(0,'rgba(255,255,255,.95)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=g;c.fillRect(-w,-h*2,w*2,h*4);
      c.restore();c.globalCompositeOperation='source-over';
    }
    feather(catPatch,750,545,215,130,46,118,.65);
    feather(earPatch,915,493,96,100,8,57,.95);
  }
  function drawShade(){
    const ctx=ensureCanvas(shadeCv);clear(ctx,shadeCv);
    if(!artworkReady || !lampPatch.width)return;
    const [x,y]=toScreen(922,206);
    ctx.drawImage(lampPatch,x,y,scaleVal(210),scaleVal(175));
    shadeCv.style.opacity=String(Math.max(0,Math.min(1,1-lampLevel)));
  }

  function drawRain(dt) {
    const ctx = ensureCanvas(rainCv); clear(ctx, rainCv); if(!raining || !artworkReady || !artworkCoordsMatch) return;
    for(const p of rainPanes) {
      ctx.save(); ctx.beginPath(); polygon(ctx,p); ctx.clip();
      // trails
      for(const d of rainDrops) {
        if(rainPanes[d.pane] !== p) continue;
        d.y += d.speed*dt;
        const b = paneBounds[d.pane];
        if(d.y > b.maxY + 4) { d.y = b.minY - 10; d.x = b.minX + Math.random()*(b.maxX-b.minX); }
        const [sx,sy] = toScreen(d.x,d.y);
        ctx.strokeStyle = `rgba(214,232,247,${d.alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(.65, 1.25*imgRect.scale);
        ctx.beginPath();
        ctx.moveTo(sx,sy);
        ctx.lineTo(sx - 2.0*imgRect.scale, sy + d.len*imgRect.scale);
        ctx.stroke();
      }
      // beads & slow trails
      for(const bdrop of beads) {
        if(rainPanes[bdrop.pane] !== p) continue;
        bdrop.y += bdrop.speed*dt;
        const b = paneBounds[bdrop.pane];
        if(bdrop.y > b.maxY + 8) { bdrop.y = b.minY - 6; bdrop.x = b.minX + Math.random()*(b.maxX-b.minX); }
        const [sx,sy] = toScreen(bdrop.x,bdrop.y);
        const r = Math.max(.65, bdrop.r*imgRect.scale);
        const grad = ctx.createRadialGradient(sx-r*.2, sy-r*.25, 0, sx, sy, r*2.2);
        grad.addColorStop(0, `rgba(245,252,255,${(bdrop.alpha*1.1).toFixed(3)})`);
        grad.addColorStop(.36, `rgba(228,242,252,${(bdrop.alpha*.7).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(228,242,252,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx,sy,r*1.2,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(230,243,252,${(bdrop.alpha*.45).toFixed(3)})`;
        ctx.lineWidth = Math.max(.4, .65*imgRect.scale);
        ctx.beginPath(); ctx.moveTo(sx,sy+r*.8); ctx.lineTo(sx, sy+r*.8 + bdrop.trail*imgRect.scale*.18); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawLighting(t) {
    const ctx = ensureCanvas(lightCv); clear(ctx, lightCv);
    // gentle global lamp illumination
    // When Motion is paused, a lamp toggle must still produce a complete change.
    lampLevel = motionOn ? lampLevel + (lampTarget - lampLevel) * .14 : lampTarget;
    // Changing the lamp must change the painted room, not only a faint additive halo.
    // The candle layer stays luminous, so dim mode still feels like candlelight.
    const brightness = (.91 + .09 * lampLevel).toFixed(3);
    const saturation = (.96 + .04 * lampLevel).toFixed(3);
    const roomFilter = 'brightness(' + brightness + ') saturate(' + saturation + ')';
    art.style.filter = roomFilter;
    catCv.style.filter = roomFilter;
    shadeCv.style.opacity=String(Math.max(0,Math.min(1,1-lampLevel)));
    const [lx,ly] = toScreen(1016,319);
    ctx.save();
    const roomGlow = ctx.createRadialGradient(lx,ly,0,lx,ly,scaleVal(420));
    roomGlow.addColorStop(0, `rgba(255,214,130,${(.20*lampLevel).toFixed(3)})`);
    roomGlow.addColorStop(.32, `rgba(255,182,100,${(.10*lampLevel).toFixed(3)})`);
    roomGlow.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = roomGlow; ctx.beginPath(); ctx.arc(lx,ly,scaleVal(420),0,Math.PI*2); ctx.fill();

    // table / armrest bounce light from lamp
    const tableGlow = ctx.createRadialGradient(...toScreen(885,520), 0, ...toScreen(885,520), scaleVal(260));
    tableGlow.addColorStop(0, `rgba(255,208,128,${(.065*lampLevel).toFixed(3)})`);
    tableGlow.addColorStop(1,'rgba(255,208,128,0)');
    ctx.fillStyle = tableGlow; ctx.beginPath(); ctx.arc(...toScreen(885,520), scaleVal(260), 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.save(); ctx.globalCompositeOperation='screen';
    for(let i=0;i<candles.length;i++) {
      const c = candles[i];
      const slow = Math.sin(t*.0025 + i*1.32);
      const fast = Math.sin(t*.012 + i*3.1);
      const flutter = Math.max(.18, .70 + .18*slow + .11*fast);
      const [x,y] = toScreen(c.x,c.y);
      const glowR = scaleVal(c.glow*(.85 + flutter*.35) * (c.type==='lamp' ? (.68 + lampLevel*.40) : 1));
      const glowA = c.type==='lamp' ? (.006 + lampLevel*.20) : (.07 + flutter*.08);
      const g = ctx.createRadialGradient(x,y,0,x,y,glowR);
      g.addColorStop(0, `rgba(255,240,186,${(glowA*1.20).toFixed(3)})`);
      g.addColorStop(.18, `rgba(255,196,96,${(glowA*.78).toFixed(3)})`);
      g.addColorStop(.58, `rgba(255,146,56,${(glowA*.26).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,138,54,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,glowR,0,Math.PI*2); ctx.fill();

      // Flames are already painted in the image: never render second flame silhouettes.
      // reflections
      if(c.reflect) for(const r of c.reflect) {
        const [rx,ry] = toScreen(r.x,r.y);
        const ref = ctx.createRadialGradient(rx,ry,0,rx,ry,scaleVal(r.spread));
        const strength = c.type === 'lamp' ? (.08 + lampLevel*.10) : (.06 + flutter*.08);
        ref.addColorStop(0, `rgba(255,208,138,${(strength).toFixed(3)})`);
        ref.addColorStop(1, 'rgba(255,208,138,0)');
        ctx.fillStyle = ref; ctx.beginPath(); ctx.ellipse(rx,ry,scaleVal(r.spread),scaleVal(Math.max(6,r.len*.18)),0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = `rgba(255,223,190,${(strength*.55).toFixed(3)})`;
        ctx.lineWidth = Math.max(.45, scaleVal(.8));
        ctx.beginPath(); ctx.moveTo(rx, ry-scaleVal(r.len*.18)); ctx.lineTo(rx, ry+scaleVal(r.len*.65)); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCat(t) {
    const ctx=ensureCanvas(catCv);clear(ctx,catCv);
    if(!artworkReady||!catPatch.width)return;
    const breath=.5+.5*Math.sin(t*.0016);
    const [cx,cy]=toScreen(857.5,610);
    ctx.save();ctx.translate(cx,cy);
    ctx.scale(1+.013*breath,1+.010*breath);
    ctx.drawImage(catPatch,-scaleVal(107.5),-scaleVal(65),scaleVal(215),scaleVal(130));
    ctx.restore();
    if(elapsed>nextEarTwitchAt){
      catEarTwitchUntil=elapsed+.4;
      nextEarTwitchAt=elapsed+5.5+Math.random()*7;
    }
    if(elapsed<catEarTwitchUntil && earPatch.width){
      const v=(catEarTwitchUntil-elapsed)/.4;
      const angle=Math.sin((1-v)*Math.PI*2)*.045*v;
      const [ex,ey]=toScreen(963,543);
      ctx.save();ctx.translate(ex,ey);ctx.rotate(angle);
      ctx.drawImage(earPatch,-scaleVal(48),-scaleVal(50),scaleVal(96),scaleVal(100));
      ctx.restore();
    }
  }

  function drawSteam(dt) {
    const ctx=ensureCanvas(steamCv);clear(ctx,steamCv);
    if(!artworkReady)return;
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.filter='blur('+Math.max(1.2,Math.min(3.1,2.2*imgRect.scale))+'px)';
    const t=elapsed;
    // Three delicate cup wisps; the source is the lip of the cup, not the chair.
    for(let i=0;i<3;i++){
      const x=439+i*13+Math.sin(t*.42+i*2.1)*3;
      const y=497;
      const [x0,y0]=toScreen(x,y);
      const top=toScreen(x+Math.sin(t*.49+i)*18-6,y-82);
      const grad=ctx.createLinearGradient(x0,y0,x0,top[1]);
      grad.addColorStop(0,'rgba(255,248,237,0)');
      grad.addColorStop(.19,'rgba(255,248,237,.18)');
      grad.addColorStop(.65,'rgba(255,248,237,.08)');
      grad.addColorStop(1,'rgba(255,248,237,0)');
      ctx.beginPath();ctx.moveTo(x0,y0);
      const [cx1,cy1]=toScreen(x+16*Math.sin(t*.6+i),y-32);
      const [cx2,cy2]=toScreen(x-13+14*Math.sin(t*.38+i),y-68);
      ctx.bezierCurveTo(cx1,cy1,cx2,cy2,top[0],top[1]);
      ctx.strokeStyle=grad;
      ctx.lineWidth=Math.max(.9,scaleVal(2.0-i*.20));
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderOnce() {
    // Motion pause freezes the drops rather than removing the rain layer.
    drawGlass();drawShade();drawRain(0);
    drawLighting(elapsed*1000);drawCat(elapsed*1000);drawSteam(0);
  }

  function tick(ts) {
    raf = 0;
    const dt = Math.min(.050, Math.max(0, (ts - (last || ts))/1000));
    last = ts;
    elapsed += dt;
    if(motionOn){
      raf=requestAnimationFrame(tick);
      try{drawRain(dt)}catch(e){console.warn('Cozy rain:',e)}
      try{drawLighting(elapsed*1000)}catch(e){console.warn('Cozy light:',e)}
      try{drawCat(elapsed*1000)}catch(e){console.warn('Cozy cat:',e)}
      try{drawSteam(dt)}catch(e){console.warn('Cozy steam:',e)}
    }
  }

  function restart() {
    if(raf) cancelAnimationFrame(raf); raf = 0; last = 0;
    renderOnce();
    if(motionOn && !document.hidden)raf=requestAnimationFrame(tick);
  }

  controlsToggle.onclick=()=>{controlsCollapsed=!controlsCollapsed;updateButtons();};
  viewBtn.onclick = () => { fillScreen = !fillScreen; computeLayout();updateButtons();restart(); };
  lampBtn.onclick = () => { lampTarget = lampTarget > .5 ? 0 : 1; updateButtons(); restart(); };
  rainBtn.onclick = () => { raining = !raining; updateButtons(); restart(); };
  motionBtn.onclick = () => { motionOn = !motionOn; updateButtons(); restart(); };
  audioBtn.onclick = () => { try { if(!audio) initAudio(); if(!audio) { audioBtn.textContent='Audio unavailable'; return; } audioOn = !audioOn; updateButtons(); renderAudio(); } catch(e) { console.warn('Cozy audio:',e); audioOn=false; updateButtons(); audioBtn.textContent='Audio unavailable'; } };

  scene.addEventListener('pointerdown', (e) => {
    const rect = scene.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const lamp = toScreen(1016,319);
    const dx = px - lamp[0], dy = py - lamp[1];
    if((dx*dx)/(scaleVal(86)**2) + (dy*dy)/(scaleVal(86)**2) < 1) {
      lampTarget = lampTarget > .5 ? 0 : 1; updateButtons(); restart();
    }
  });

  const onResize=()=>{computeLayout();restart()};
  window.addEventListener('resize',onResize);
  const onVisibility=()=>{
    if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;if(audio&&audio.ctx.state==='running')audio.ctx.suspend()}
    else{if(audioOn&&audio&&audio.ctx.state==='suspended')audio.ctx.resume();restart()}
  };
  document.addEventListener('visibilitychange',onVisibility);

  // Optional synthetic rain ambience
  let audio = null;
  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    const ctx = new AC();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * .42;
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
    const rainGain = ctx.createGain(); rainGain.gain.value = 0;
    const hissGain = ctx.createGain(); hissGain.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if(pan) pan.pan.value = -.08;
    src.connect(hp); hp.connect(lp); lp.connect(rainGain); if(pan) rainGain.connect(pan), pan.connect(ctx.destination); else rainGain.connect(ctx.destination);
    src.start();

    // random droplets on top
    const dropGain = ctx.createGain(); dropGain.gain.value = 0; dropGain.connect(ctx.destination);
    function drip() {
      if(!audio || !audio.enabled) return;
      const now = ctx.currentTime;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(940 + Math.random()*380, now);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.004 + Math.random()*.003, now + .01); g.gain.exponentialRampToValueAtTime(.00001, now + .12);
      o.connect(g); g.connect(dropGain); o.start(now); o.stop(now + .13);
      setTimeout(drip, 220 + Math.random()*900);
    }
    audio = { ctx, src, rainGain, dropGain, enabled:false, drift:0, drip };
  }
  function renderAudio() {
    if(!audio) return;
    audio.enabled = audioOn;
    if(audioOn && audio.ctx.state === 'suspended') audio.ctx.resume();
    const target = audioOn ? .12 : 0;
    const now = audio.ctx.currentTime;
    audio.rainGain.gain.cancelScheduledValues(now);
    audio.rainGain.gain.linearRampToValueAtTime(target, now + .35);
    audio.dropGain.gain.cancelScheduledValues(now);
    audio.dropGain.gain.linearRampToValueAtTime(audioOn ? .30 : 0, now + .35);
    if(audioOn && !audio._started) { audio._started = true; audio.drip(); }
    if(!audioOn) audio._started = false;
  }

  function disposeScene() {
    if(raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    audioOn=false;
    if(audio) { audio.enabled=false; try { audio.src.stop(); } catch(e) {} audio.ctx.close(); audio=null; }
  }
  art.onload = () => {
    artworkReady = art.naturalWidth > 0 && art.naturalHeight > 0;
    artworkCoordsMatch = art.naturalWidth === ART_W && art.naturalHeight === ART_H;
    if(!artworkCoordsMatch) console.warn('Cozy artwork dimensions differ: glass effects disabled to prevent spill.',art.naturalWidth,art.naturalHeight);
    prepareLayers();backdrop.src=art.src;computeLayout(); updateButtons(); restart();
  };
  computeLayout(); updateButtons();
  if(art.complete && art.naturalWidth > 0) art.onload();
  return {dispose:disposeScene,pause(){motionOn=false;updateButtons();restart()},resume(){motionOn=true;updateButtons();restart()}};
})();const handle={dispose(){logic.dispose();holder.remove();if(active===handle)active=null;},pause(){logic.pause()},resume(){logic.resume()}};active=handle;
const artwork=root.getElementById('art');
if(window.__COZY_TEST_ART__){artwork.src=window.__COZY_TEST_ART__}
else fetch('assets/cozy-reading-nook.html?v=7',{cache:'force-cache'})
.then(r=>{if(!r.ok)throw Error('Artwork HTTP '+r.status);return r.text()})
.then(html=>{if(active!==handle)return;const m=html.match(/<img\b[^>]*\bsrc=["'](data:image\/(?:png|jpeg|webp);base64,[^"']+)["']/i);if(!m)throw Error('Artwork missing');artwork.src=m[1]})
.catch(error=>{console.warn('Cozy art:',error);const msg=document.createElement('p');msg.textContent='Unable to load the reading nook artwork; please refresh.';msg.style.cssText='position:absolute;inset:35% 8%;text-align:center;color:#ead4ad';holder.shadowRoot.append(msg)});
return handle;}return {mount,dispose(){active?.dispose()},pause(){active?.pause()},resume(){active?.resume()}}})();