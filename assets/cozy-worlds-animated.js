window.CozyWorlds=(()=>{let active=null;function mount(host){active?.dispose();const holder=document.createElement('div');holder.style.cssText='position:absolute;inset:0';const root=holder.attachShadow({mode:'open'});root.innerHTML="<style>\n  :host {\n    --bg:#0f1219;\n    --panel:rgba(18,22,31,.82);\n    --line:rgba(255,231,200,.18);\n    --text:#f5e5cb;\n    --muted:#cdbca2;\n  }\n  * { box-sizing:border-box; }\n  :host { position:absolute; inset:0; display:block; overflow:hidden; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }\n\n  #app { position:fixed; inset:0; background:radial-gradient(circle at 50% 18%, rgba(255,200,120,.08), transparent 42%), var(--bg); }\n  .scene { position:absolute; inset:0; overflow:hidden; }\n  .scene img { position:absolute; inset:0; width:100%; height:100%; user-select:none; -webkit-user-drag:none; pointer-events:none; }\n  canvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }\n  .title {\n    position:absolute; left:max(14px, env(safe-area-inset-left)); top:max(12px, env(safe-area-inset-top)); z-index:4;\n    padding:10px 14px; border-radius:14px; background:rgba(10,12,18,.50); border:1px solid rgba(255,255,255,.06); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);\n  }\n  .title h1 { margin:0; font:italic 700 clamp(18px, 2.7vw, 28px)/1.1 Georgia, serif; letter-spacing:.2px; }\n  .title p { margin:4px 0 0; font-size:12px; color:var(--muted); }\n  .controls {\n    position:absolute; left:50%; bottom:calc(12px + env(safe-area-inset-bottom)); transform:translateX(-50%);\n    z-index:5; display:flex; gap:8px; flex-wrap:wrap; justify-content:center; align-items:center;\n    width:min(100% - 16px, 920px); padding:8px; border-radius:20px; background:var(--panel); border:1px solid var(--line);\n    backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); box-shadow:0 12px 32px rgba(0,0,0,.30);\n  }\n  button {\n    appearance:none; border:1px solid rgba(255,226,190,.18); background:rgba(255,255,255,.05); color:var(--text);\n    border-radius:999px; padding:10px 14px; font:600 12px/1 system-ui,sans-serif; letter-spacing:.15px; cursor:pointer;\n    min-height:38px; transition:.22s ease background,.22s ease border-color,.22s ease transform;\n  }\n  button:hover { background:rgba(255,255,255,.09); }\n  button:active { transform:scale(.98); }\n  button[data-on=\"true\"] { background:rgba(255,210,140,.12); border-color:rgba(255,220,175,.35); }\n  .hint { position:absolute; right:max(14px, env(safe-area-inset-right)); top:max(12px, env(safe-area-inset-top)); z-index:4; padding:10px 12px; font-size:12px; color:var(--muted); background:rgba(10,12,18,.45); border:1px solid rgba(255,255,255,.06); border-radius:14px; backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); max-width:min(320px, 45vw); }\n  @media (max-width: 780px) {\n    .title p, .hint { display:none; }\n    .controls { width:calc(100% - 12px); gap:6px; padding:6px; bottom:calc(10px + env(safe-area-inset-bottom)); }\n    button { padding:10px 12px; font-size:11px; min-height:36px; }\n  }\n</style><div id=\"app\"><div class=\"scene\" id=\"scene\"><img id=\"art\" alt=\"Cozy Worlds 2.0\"><canvas id=\"fx-rain\"></canvas><canvas id=\"fx-light\"></canvas><canvas id=\"fx-cat\"></canvas><canvas id=\"fx-steam\"></canvas></div><div class=\"controls\" id=\"controls\"><button id=\"viewBtn\">Whole image</button><button id=\"lampBtn\">Lamp: warm</button><button id=\"rainBtn\">Rain: on</button><button id=\"audioBtn\">Rain ambience</button><button id=\"motionBtn\">Motion: on</button></div></div>";host.replaceChildren(holder);const logic=(()=>{
  const ART_W = 1448, ART_H = 1086;
  const scene = root.getElementById('scene');
  const art = root.getElementById('art');
  const rainCv = root.getElementById('fx-rain');
  const lightCv = root.getElementById('fx-light');
  const catCv = root.getElementById('fx-cat');
  const steamCv = root.getElementById('fx-steam');
  const viewBtn = root.getElementById('viewBtn');
  const lampBtn = root.getElementById('lampBtn');
  const rainBtn = root.getElementById('rainBtn');
  const audioBtn = root.getElementById('audioBtn');
  const motionBtn = root.getElementById('motionBtn');

  const isPortraitPhone = () => window.innerWidth < 820 && window.innerHeight > window.innerWidth;
  let fillScreen = isPortraitPhone();
  let motionOn = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raining = true;
  let audioOn = false;
  let lampTarget = 1;
  let lampLevel = 1;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let imgRect = { x:0, y:0, w:ART_W, h:ART_H, scale:1 };
  let catEarTwitchUntil = 0;
  let nextEarTwitchAt = 4.5 + Math.random()*5.5;

  const rainPanes = [
    [[1002,34],[1090,34],[1090,203],[1002,210]],
    [[1105,34],[1197,34],[1197,203],[1105,203]],
    [[1212,34],[1288,34],[1288,203],[1212,203]],
    [[1002,220],[1090,220],[1090,406],[1002,406]],
    [[1105,220],[1197,220],[1197,406],[1105,406]],
    [[1212,220],[1288,220],[1288,406],[1212,406]],
    [[1002,424],[1090,424],[1090,538],[1002,538]],
    [[1105,424],[1197,424],[1197,538],[1105,538]],
    [[1212,424],[1288,424],[1288,538],[1212,538]]
  ];
  const paneBounds = rainPanes.map(p => {
    const xs = p.map(v => v[0]), ys = p.map(v => v[1]);
    return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) };
  });

  const rainDrops = Array.from({length:150}, () => {
    const pane = Math.floor(Math.random()*rainPanes.length);
    const b = paneBounds[pane];
    return { pane, x:b.minX + Math.random()*(b.maxX-b.minX), y:b.minY + Math.random()*(b.maxY-b.minY), speed:70+Math.random()*150, len:8+Math.random()*18, alpha:.10+Math.random()*.20 };
  });
  const beads = Array.from({length:70}, () => {
    const pane = Math.floor(Math.random()*rainPanes.length);
    const b = paneBounds[pane];
    return { pane, x:b.minX + Math.random()*(b.maxX-b.minX), y:b.minY + Math.random()*(b.maxY-b.minY), r:0.8 + Math.random()*1.8, speed:7+Math.random()*18, alpha:.06+Math.random()*.14, trail:3+Math.random()*18 };
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = scene.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(rect.width*dpr));
    cv.height = Math.max(1, Math.round(rect.height*dpr));
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return ctx;
  }

  function computeLayout() {
    const rect = scene.getBoundingClientRect();
    const scale = fillScreen ? Math.max(rect.width/ART_W, rect.height/ART_H) : Math.min(rect.width/ART_W, rect.height/ART_H);
    const focusX = fillScreen ? .72 : .5;
    const focusY = .5;
    const w = ART_W * scale;
    const h = ART_H * scale;
    const x = (rect.width - w) * focusX;
    const y = (rect.height - h) * focusY;
    imgRect = { x, y, w, h, scale };
    art.style.objectFit = fillScreen ? 'cover' : 'contain';
    art.style.objectPosition = (fillScreen ? '72%' : '50%') + ' 50%';
    viewBtn.textContent = fillScreen ? 'Whole image' : 'Fill screen';
    viewBtn.dataset.on = String(!fillScreen);
  }

  function toScreen(x,y) { return [imgRect.x + x*imgRect.scale, imgRect.y + y*imgRect.scale]; }
  function scaleVal(v) { return v*imgRect.scale; }
  function clear(ctx, cv) { ctx.clearRect(0,0,cv.width,cv.height); }
  function polygon(ctx, pts) { pts.forEach((p,i)=>{ const [sx,sy]=toScreen(p[0],p[1]); if(i===0) ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy); }); ctx.closePath(); }

  function updateButtons() {
    lampBtn.textContent = lampTarget > .5 ? 'Lamp: warm' : 'Lamp: low';
    lampBtn.dataset.on = String(lampTarget > .5);
    rainBtn.textContent = raining ? 'Rain: on' : 'Rain: off';
    rainBtn.dataset.on = String(raining);
    audioBtn.dataset.on = String(audioOn);
    audioBtn.textContent = audioOn ? 'Rain ambience: on' : 'Rain ambience';
    motionBtn.textContent = motionOn ? 'Motion: on' : 'Motion: off';
    motionBtn.dataset.on = String(motionOn);
  }

  function drawRain(dt) {
    const ctx = ensureCanvas(rainCv); clear(ctx, rainCv); if(!raining) return;
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
        ctx.lineWidth = Math.max(.55, .95*imgRect.scale);
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
    // glass sheen
    ctx.save();
    const sheen = ctx.createLinearGradient(imgRect.x + imgRect.w*.68, imgRect.y, imgRect.x + imgRect.w*.92, imgRect.y+imgRect.h*.55);
    sheen.addColorStop(0,'rgba(200,220,245,.02)'); sheen.addColorStop(.45,'rgba(210,230,255,.06)'); sheen.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; ctx.fillRect(imgRect.x+imgRect.w*.67, imgRect.y+imgRect.h*.02, imgRect.w*.27, imgRect.h*.50);
    ctx.restore();
  }

  function drawLighting(t) {
    const ctx = ensureCanvas(lightCv); clear(ctx, lightCv);
    // gentle global lamp illumination
    lampLevel += (lampTarget - lampLevel) * .06;
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
      const glowA = c.type==='lamp' ? (.08 + lampLevel*.14) : (.10 + flutter*.11);
      const g = ctx.createRadialGradient(x,y,0,x,y,glowR);
      g.addColorStop(0, `rgba(255,240,186,${(glowA*1.20).toFixed(3)})`);
      g.addColorStop(.18, `rgba(255,196,96,${(glowA*.78).toFixed(3)})`);
      g.addColorStop(.58, `rgba(255,146,56,${(glowA*.26).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,138,54,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x,y,glowR,0,Math.PI*2); ctx.fill();

      if(c.type !== 'lamp') {
        const sway = Math.sin(t*.010 + i*2.8) * scaleVal(2.2);
        const flameH = scaleVal(c.size * (1.05 + flutter*.12));
        ctx.fillStyle = `rgba(255,248,226,${(.46 + flutter*.30).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, y + scaleVal(3.8));
        ctx.quadraticCurveTo(x - scaleVal(4.6) + sway, y - scaleVal(1.6), x + sway*.34, y - flameH);
        ctx.quadraticCurveTo(x + scaleVal(4.9) + sway, y - scaleVal(1.5), x, y + scaleVal(3.8));
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,184,78,${(.24 + flutter*.18).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, y + scaleVal(4.2));
        ctx.quadraticCurveTo(x - scaleVal(2.4) + sway*.65, y + scaleVal(.8), x + sway*.16, y - flameH*.62);
        ctx.quadraticCurveTo(x + scaleVal(2.6) + sway*.65, y + scaleVal(.8), x, y + scaleVal(4.2));
        ctx.closePath(); ctx.fill();
      }
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
    const ctx = ensureCanvas(catCv); clear(ctx, catCv);
    if(!art.complete) return;
    const breath = .5 + .5*Math.sin(t*.0018);
    const chestScaleX = 1 + (.006 + breath*.012);
    const chestScaleY = 1 + (.003 + breath*.007);
    const chestClip = [863, 632, 210, 88, -.08];
    const [cx,cy] = toScreen(chestClip[0], chestClip[1]);
    ctx.save();
    ctx.translate(cx,cy); ctx.rotate(chestClip[4]); ctx.beginPath(); ctx.ellipse(0,0,scaleVal(chestClip[2]/2), scaleVal(chestClip[3]/2), 0, 0, Math.PI*2); ctx.clip();
    ctx.scale(chestScaleX, chestScaleY); ctx.translate(-(imgRect.x + 863*imgRect.scale), -(imgRect.y + 632*imgRect.scale));
    ctx.drawImage(art, imgRect.x, imgRect.y, imgRect.w, imgRect.h); ctx.restore();

    if(elapsed > nextEarTwitchAt) { catEarTwitchUntil = elapsed + .35; nextEarTwitchAt = elapsed + 4.8 + Math.random()*6.5; }
    if(elapsed < catEarTwitchUntil) {
      const earProg = (catEarTwitchUntil - elapsed)/.35;
      const twitch = Math.sin((1-earProg) * Math.PI * 3.4) * .14 * earProg;
      const sx = 908, sy = 524, sw = 82, sh = 72;
      const ax = 946, ay = 551;
      const [dx,dy] = toScreen(sx,sy);
      const [dax,day] = toScreen(ax,ay);
      ctx.save();
      ctx.beginPath();
      const pts = [[919,545],[938,505],[980,536],[951,563]];
      polygon(ctx,pts); ctx.clip();
      ctx.translate(dax,day); ctx.rotate(twitch); ctx.translate(-dax,-day);
      ctx.drawImage(art, sx, sy, sw, sh, imgRect.x + sx*imgRect.scale, imgRect.y + sy*imgRect.scale, sw*imgRect.scale, sh*imgRect.scale);
      ctx.restore();
    }
  }

  function drawSteam(dt) {
    const ctx = ensureCanvas(steamCv); clear(ctx, steamCv);
    ctx.save(); ctx.globalCompositeOperation='screen';
    const sourceX = 467, sourceY = 556;
    for(const p of steam) {
      p.age = (p.age + dt*p.speed) % 1;
      const a = p.age;
      const px = sourceX + p.drift*.22 + Math.sin(a*6.2 + p.phase) * (3.0 + a*9.0);
      const py = sourceY - a*128 + Math.sin(a*4.4 + p.phase) * 2.2;
      const [sx,sy] = toScreen(px,py);
      const radius = scaleVal(p.size + a*9.5);
      const alpha = .11 * Math.sin(Math.PI*a);
      const g = ctx.createRadialGradient(sx,sy,0,sx,sy,radius);
      g.addColorStop(0, `rgba(248,246,241,${(alpha*.95).toFixed(3)})`);
      g.addColorStop(.45, `rgba(248,246,241,${(alpha*.28).toFixed(3)})`);
      g.addColorStop(1, 'rgba(248,246,241,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx,sy,radius,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function renderOnce() {
    drawRain(0); drawLighting(elapsed*1000); drawCat(elapsed*1000); drawSteam(0);
  }

  function tick(ts) {
    raf = 0;
    const dt = Math.min(.050, Math.max(0, (ts - (last || ts))/1000));
    last = ts;
    elapsed += dt;
    if(motionOn) {
      drawRain(dt); drawLighting(elapsed*1000); drawCat(elapsed*1000); drawSteam(dt);
      raf = requestAnimationFrame(tick);
    } else {
      renderOnce();
    }
    renderAudio();
  }

  function restart() {
    if(raf) cancelAnimationFrame(raf); raf = 0; last = 0;
    renderOnce();
    if(motionOn) raf = requestAnimationFrame(tick);
  }

  viewBtn.onclick = () => { fillScreen = !fillScreen; computeLayout(); restart(); };
  lampBtn.onclick = () => { lampTarget = lampTarget > .5 ? .36 : 1; updateButtons(); restart(); };
  rainBtn.onclick = () => { raining = !raining; updateButtons(); restart(); };
  motionBtn.onclick = () => { motionOn = !motionOn; updateButtons(); restart(); };
  audioBtn.onclick = async () => { if(!audio) initAudio(); audioOn = !audioOn; updateButtons(); renderAudio(); };

  scene.addEventListener('pointerdown', (e) => {
    const rect = scene.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const lamp = toScreen(1016,319);
    const dx = px - lamp[0], dy = py - lamp[1];
    if((dx*dx)/(scaleVal(86)**2) + (dy*dy)/(scaleVal(86)**2) < 1) {
      lampTarget = lampTarget > .5 ? .36 : 1; updateButtons(); restart();
    }
  });

  window.addEventListener('resize', () => { computeLayout(); restart(); });
  document.addEventListener('visibilitychange', () => { if(document.hidden) { if(raf) cancelAnimationFrame(raf); raf=0; } else restart(); });

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
    const target = audioOn ? .055 : 0;
    const now = audio.ctx.currentTime;
    audio.rainGain.gain.cancelScheduledValues(now);
    audio.rainGain.gain.linearRampToValueAtTime(target, now + .35);
    audio.dropGain.gain.cancelScheduledValues(now);
    audio.dropGain.gain.linearRampToValueAtTime(audioOn ? .30 : 0, now + .35);
    if(audioOn && !audio._started) { audio._started = true; audio.drip(); }
    if(!audioOn) audio._started = false;
  }

  art.onload = () => { computeLayout(); updateButtons(); restart(); };
  if(art.complete) { computeLayout(); updateButtons(); restart(); }

})();const handle={dispose(){holder.remove();if(active===handle)active=null;},pause(){},resume(){}};active=handle;return handle;}return {mount,dispose(){active?.dispose()},pause(){active?.pause()},resume(){active?.resume()}}})();