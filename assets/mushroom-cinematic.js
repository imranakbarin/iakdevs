/* Mushroom Island v5 — matched cinematic foreground + runner artwork.
 * Clean rewrite: one authored high-detail kingdom plate plus separate
 * parallax atmosphere, sculpted runner terrace and deterministic stunt animation.
 * Original character; no official franchise sprites/audio, no external APIs.
 */
(() => {
  'use strict';
  const canvas = document.getElementById('island');
  const ctx = canvas.getContext('2d', {alpha:false});
  const palace = new Image();
  const renderedPip = new Image(), texturedLedge = new Image(), bounceCap = new Image();
  // 16 true opposing-stride poses plus six separate jump/landing/crouch poses.
  const runningPip = new Image();
  // One original, light-matched scenic obstacle. No new obstacle engine.
  const fallenLog = new Image();
  const PIP_FRAME_W=244, PIP_FRAME_H=305, PIP_FRAMES=8, RUN_FRAMES=16, RUN_TOTAL=22, RUN_STRIDE_PX=9;
  const TAU=Math.PI*2, PI=Math.PI, SPEED=155, CHAPTER=750;
  const stunts=['hop','dash','bounce','flip','slide','glide','vault','cartwheel','twirl','longjump'];
  const minmax=(a,x,b)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{x=minmax(0,x,1);return x*x*(3-2*x);};
  const hash=n=>{n=Math.imul(n^0x9e3779b9,0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return (n^(n>>>16))>>>0;};
  const random=(id,salt=0)=>hash((id|0)^(salt*13997))/4294967296;
  const lerp=(a,b,t)=>a+(b-a)*t;
  let W=900,H=600,dpr=1,clock=0,world=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf=0,previous=0,visible=!document.hidden,embedded=window.top!==window;
  let loadState='loading',loadError=null;
  let reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const info={};
  const colors=[['#ee8488','#a45c93'],['#f6b16c','#b26795'],['#ed98bb','#a56eb0'],['#ebb474','#b3768a']];

  const gradient=(x,y,x2,y2,stops)=>{
    const g=ctx.createLinearGradient(x,y,x2,y2);
    for(const [at,col] of stops)g.addColorStop(at,col);
    return g;
  };
  const oval=(x,y,rx,ry,col)=>{
    if(!(rx>0&&ry>0))return;
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);
    ctx.fillStyle=col;ctx.fill();
  };
  const line=(x1,y1,x2,y2,col,thick=1)=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
    ctx.lineWidth=thick;ctx.strokeStyle=col;ctx.stroke();
  };
  const rounded=(x,y,w,h,r,col)=>{
    if(w<=0||h<=0)return;
    ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2));ctx.fillStyle=col;ctx.fill();
  };
  const bloom=(x,y,r,col)=>{
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,col);g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);
  };

  function resize(){
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    dpr=Math.min(window.devicePixelRatio||1,2,Math.sqrt(2700000/(w*h)));
    W=w;H=h;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    render();
  }
  function background(){
    if(loadState!=='ready'){
      ctx.fillStyle=gradient(0,0,0,H,[[0,'#79bce9'],[.54,'#c7e8d5'],[1,'#5ea6bd']]);
      ctx.fillRect(0,0,W,H);
      if(loadError){
        ctx.font=`${Math.max(12,Math.min(W/36,19))}px system-ui`;
        ctx.textAlign='center';ctx.fillStyle='#294f65';
        ctx.fillText('The island scenery could not load',W*.5,H*.43);
      }
      return;
    }
    // The kingdom is a detailed painted world. Slow filmic camera movement
    // keeps the entire scene dimensional without obvious infinitely repeating tiles.
    const iw=palace.naturalWidth,ih=palace.naturalHeight;
    const overscan=1.06+Math.sin(clock*.075)*.009;
    const factor=Math.max(W/iw,H/ih)*overscan;
    const drawW=iw*factor,drawH=ih*factor;
    const travelX=Math.max(0,drawW-W),travelY=Math.max(0,drawH-H);
    const pan=.48+.40*Math.sin(clock*.045);
    const dx=-travelX*pan,dy=-travelY*(.34+.1*Math.sin(clock*.03));
    info.plate={dx,dy,factor,iw,ih};
    ctx.drawImage(palace,dx,dy,drawW,drawH);
    // Sky sunlight and atmospheric veil warm the scene without a heavy filter.
    const sun=ctx.createRadialGradient(W*.65,H*.16,0,W*.65,H*.16,H*.7);
    sun.addColorStop(0,'rgba(255,245,184,.10)');sun.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=sun;ctx.fillRect(0,0,W,H);
  }
  function waterMotion(){
    if(loadState!=='ready')return;
    // Local scene coordinates map soft animated water glints onto visible falls.
    // Effects are intentionally understated: the authored painting stays dominant.
    const {dx,dy,factor,iw,ih}=info.plate;
    const falls=[
      [.259,.48,.018,.23], [.485,.40,.030,.27],
      [.568,.69,.015,.20], [.818,.67,.014,.23]
    ];
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let k=0;k<falls.length;k++){
      const [bx,by,bw,bh]=falls[k];
      const xx=dx+bx*iw*factor, yy=dy+by*ih*factor;
      const ww=bw*iw*factor,hh=bh*ih*factor;
      if(xx+ww<0||xx>W||yy+hh<0||yy>H)continue;
      ctx.save();ctx.beginPath();ctx.rect(xx,yy,ww,hh);ctx.clip();
      for(let n=0;n<5;n++){
        const x=xx+ww*(n+.5)/5 +Math.sin(clock*1.8+n*2+k)*ww*.035;
        const y=yy+((clock*35+n*hh*.26)%(hh+40))-20;
        ctx.strokeStyle='rgba(231,252,252,.08)';ctx.lineWidth=Math.max(1,ww*.07);
        ctx.beginPath();ctx.moveTo(x,y-36);ctx.lineTo(x-2,y+10);ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  function skyLife(){
    // Tiny living elements follow different camera speeds; no random frame noise.
    const spacing=225;
    for(let j=0;j<Math.ceil(W/spacing)+3;j++){
      const i=j+Math.floor(clock*.075);
      const x=(i*spacing-clock*17)%(W+spacing*2)-spacing;
      const y=H*(.10+.22*random(i,88))+Math.sin(clock*.9+i)*8;
      const alpha=.17+random(i,31)*.4;
      ctx.save();ctx.globalAlpha=alpha;
      ctx.strokeStyle='#f7fff2';ctx.lineWidth=1.1+random(i,12);
      ctx.beginPath();ctx.moveTo(x-7,y);
      ctx.quadraticCurveTo(x-2,y-4,x+2,y);
      ctx.quadraticCurveTo(x+8,y-5,x+14,y);ctx.stroke();
      ctx.restore();
    }
    // Glowing drifting seeds appear near the village edges.
    for(let i=0;i<19;i++){
      const x=random(i,100)*W+Math.sin(clock*(.28+.02*i)+i)*23;
      const y=H*(.24+random(i,121)*.52)+Math.cos(clock*.48+i)*11;
      const a=.10+.23*(.5+.5*Math.sin(clock*1.3+i*3));
      oval(x,y,1.2,1.2,`rgba(255,246,186,${a.toFixed(3)})`);
    }
  }
  // Everything from here belongs to a separate foreground depth plane.
  // The runner moves to the right through these rooted objects while the
  // extremely detailed kingdom remains readable behind the route.
  const ground=()=>H*.892;
  function ledge(){
    const y=ground(),depth=Math.max(32,H-y);
    ctx.beginPath();ctx.moveTo(0,y+7);
    for(let x=0;x<=W+20;x+=16){
      const wobble=Math.sin(x*.013+world*.0007)*1.7+Math.sin(x*.045+world*.003)*2.1;
      ctx.lineTo(x,y+wobble);
    }
    ctx.lineTo(W,H+30);ctx.lineTo(0,H+30);ctx.closePath();
    ctx.fillStyle=gradient(0,y,0,H,[[0,'#947a72'],[.25,'#78677a'],[1,'#504c64']]);
    ctx.fill();
    // Rounded, sunlit moss lip with long continuous paths and no tile seams.
    for(const [offset,width,col] of [[11,23,'#365f51'],[3,17,'#59a87a'],[-5,12,'#85c58d'],[-10,4,'#d0e9a2']]){
      ctx.beginPath();ctx.moveTo(0,y+offset);
      for(let x=0;x<=W+20;x+=12){
        ctx.lineTo(x,y+offset+Math.sin(x*.013+world*.0007)*1.7+Math.sin(x*.045+world*.003)*2.1);
      }
      ctx.strokeStyle=col;ctx.lineWidth=width;ctx.stroke();
    }
    // Rounded stone volume makes the narrow front cliff feel tactile.
    // Fine rock plane texture, deterministic in world-space.
    for(let j=0;j<Math.ceil(W/82)+2;j++){
      const id=j+Math.floor(world/82),x=id*82-world-20;
      if(x<0||x>W)continue;
      const y0=y+26+random(id,42)*(depth-27);
      const w=7+random(id,38)*31;
      oval(x,y0,w,1.8+random(id,12)*3,'rgba(255,219,173,.17)');
      if(j%3===0)oval(x+22,y0+18,8,2,'rgba(41,52,79,.15)');
    }
  }
  function flowers(){
    const y=ground();
    for(let j=0;j<Math.ceil(W/130)+3;j++){
      const index=j+Math.floor((world-W*.35)/130),wx=index*130+random(index,10)*40;
      const x=wx-world+W*.35;
      if(x<-25||x>W+25||Math.abs(x-W*.34)<42)continue;
      const f=.36+random(index,1)*.30;
      ctx.save();ctx.translate(x,y-10);ctx.scale(f,f);
      const lean=Math.sin(clock*.93+index)*.09;
      ctx.rotate(lean);
      line(0,3,-2,-20,'#397f63',2.8);
      oval(-7,-12,9,3.5,'#69a56e');
      oval(7,-17,7,3,'#80c382');
      const petals=index%4===0?5:index%4===1?6:0;
      if(petals){
        const col=index%2===0?'#faf9dc':'#c9b7f3';
        for(let k=0;k<petals;k++){
          const a=k*TAU/petals;
          oval(Math.cos(a)*8,-23+Math.sin(a)*8,6,7.5,col);
        }
        oval(0,-23,4.7,4.7,'#f3c36b');
      }else{
        for(let k=0;k<3;k++){
          const dx=(k-1)*13;
          oval(dx,-5-k*7,6,14,k%2?'#2e7862':'#5baf76');
        }
      }
      ctx.restore();
    }
  }
  function softMushroom(x,y,scale=1,type=0){
    const pair=colors[type%colors.length];
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    oval(0,4,37,6,'rgba(24,54,43,.23)');
    ctx.beginPath();ctx.moveTo(-14,1);ctx.bezierCurveTo(-15,-30,-10,-53,-14,-83);
    ctx.quadraticCurveTo(-1,-91,13,-82);ctx.bezierCurveTo(9,-44,17,-22,15,1);ctx.closePath();
    ctx.fillStyle=gradient(-18,-52,19,-52,[[0,'#b99a9e'],[.38,'#ffead3'],[.65,'#f5dabb'],[1,'#a98997']]);ctx.fill();
    ctx.beginPath();ctx.ellipse(0,-83,53,9,0,0,TAU);ctx.fillStyle='#f1d4b9';ctx.fill();
    ctx.beginPath();ctx.moveTo(-55,-84);ctx.bezierCurveTo(-52,-130,-26,-158,0,-157);
    ctx.bezierCurveTo(31,-158,55,-127,55,-84);ctx.closePath();
    ctx.fillStyle=gradient(-35,-157,51,-79,[[0,'#ffd6b6'],[.42,pair[0]],[1,pair[1]]]);ctx.fill();
    oval(-24,-128,10,7,'rgba(255,247,231,.96)');
    oval(15,-132,10,8,'rgba(255,247,231,.90)');
    oval(26,-104,7,6,'rgba(255,247,231,.93)');
    ctx.restore();
  }
  function setPieces(){
    const idx=Math.floor(world/CHAPTER),lane=world%CHAPTER;
    const viewX=W*.34;
    // A couple of oversized mushroom monuments drift by, not a dense row of props.
    for(let j=idx-1;j<=idx+2;j++){
      const kind=stunts[((j%stunts.length)+stunts.length)%stunts.length];
      const start=j*CHAPTER;
      const x=viewX+(start+390-world);
      if(x<-170||x>W+170)continue;
      if(kind==='bounce')softMushroom(x,ground()-9,.86,j);
      else if(kind==='vault')softMushroom(x,ground()-6,.47,j);
      else if(kind==='glide'){
        // A soft celebratory arch with upright foundations.
        const y=ground();
        ctx.save();ctx.globalAlpha=.9;
        rounded(x-110,y-86,12,84,5,'#ad8c83');
        rounded(x+103,y-86,12,84,5,'#ad8c83');
        ctx.beginPath();ctx.moveTo(x-106,y-82);ctx.quadraticCurveTo(x,y-172,x+109,y-82);
        ctx.strokeStyle='#e2b98d';ctx.lineWidth=12;ctx.stroke();ctx.restore();
      }
    }
  }
  // The same image geometry is shared by the mushroom renderer and Pip's
  // contact path. This prevents the "bounce" from happening in empty air.
  function springGeometry(chapter){
    const propScale=Math.max(.46,Math.min(.86,Math.min(W/590,H/1030)*.91));
    const pipScale=Math.max(.49,Math.min(.90,Math.min(W/540,H/980)*.87));
    const height=133*propScale/.72;
    const width=height*((bounceCap.naturalWidth||169)/(bounceCap.naturalHeight||128));
    const compression=.15;
    const contactLift=(height+6+9*pipScale)/pipScale;
    return {chapter,worldX:chapter*CHAPTER+385,height,width,pipScale,
      compression,contactLift,springDepth:height*compression/pipScale};
  }
  function springCompression(p){
    if(p<367||p>410)return 0;
    return p<=385?smooth((p-367)/18):1-smooth((p-385)/25);
  }
  function springBounceAt(p,chapter){
    const g=springGeometry(chapter);
    const points=[
      [195,0],[269,g.contactLift+30],[315,g.contactLift+68],
      [357,g.contactLift+20],[385,g.contactLift-g.springDepth],
      [401,g.contactLift+14],[452,g.contactLift+100],
      [478,g.contactLift+98],[498,g.contactLift+65],[550,0]
    ];
    if(p<=195||p>=550)return {lift:0,compression:0,contact:false};
    let lift=0;
    for(let i=1;i<points.length;i++){
      if(p<=points[i][0]){
        const [x0,y0]=points[i-1],[x1,y1]=points[i];
        lift=y0+(y1-y0)*smooth((p-x0)/(x1-x0));
        break;
      }
    }
    // The soft cap is an actual landing surface in this authored sequence.
    // Clamp Pip's boot height against its compressed top throughout the
    // center section, not just at a single central frame, so no feet pass
    // through the mushroom between animation frames.
    const compression=springCompression(p);
    const capHalfWidth=g.width*(1+.075*compression)*.35;
    if(Math.abs(p-385)<=capHalfWidth)
      lift=Math.max(lift,g.contactLift-g.springDepth*compression);
    return {lift,compression,contact:p>=378&&p<=399};
  }
  function poseAt(x){
    const chapter=Math.floor(x/CHAPTER),kind=stunts[((chapter%stunts.length)+stunts.length)%stunts.length];
    const p=x-chapter*CHAPTER;
    const u=minmax(0,(p-195)/355,1),active=p>=195&&p<=550;
    const wave=Math.sin(PI*u),ease=smooth(u);
    let lift=0,spin=0,squash=1,lean=0,glide=false,spring=null;
    if(active){
      if(kind==='hop')lift=65*wave;
      if(kind==='dash')lean=.23*wave;
      if(kind==='bounce'){spring=springBounceAt(p,chapter);lift=spring.lift;}
      if(kind==='flip'){lift=116*wave;spin=TAU*ease;}
      if(kind==='slide')squash=1-.47*wave*wave;
      if(kind==='glide'){lift=138*wave;glide=true;}
      if(kind==='vault')lift=85*wave;
      if(kind==='cartwheel'){lift=76*wave;spin=-TAU*ease;}
      if(kind==='twirl'){lift=103*wave;spin=TAU*ease;}
      if(kind==='longjump'){lift=124*wave;lean=.17*wave;}
    }
    return {kind,active,u,lift,spin,squash,lean,glide,spring};
  }
  // Timing envelopes are derived only from travel distance, so the transition
  // looks identical after frame drops, tab resumes, and on different screens.
  function animationAt(x){
    const base=poseAt(x),p=x-Math.floor(x/CHAPTER)*CHAPTER;
    const anticipation=base.kind!=='dash'&&p>=160&&p<218
      ?(p<195?smooth((p-160)/35):1-smooth((p-195)/23)):0;
    // Contact compression begins only when the feet have returned near ground.
    const recovery=base.kind!=='dash'&&p>=542&&p<595
      ?(p<550?smooth((p-542)/8):1-smooth((p-550)/45)):0;
    // Sliding unfolds without a fictional landing impulse or dust burst.
    const landing=base.kind==='slide'?0:recovery;
    return {...base,anticipation,recovery,landing,
      squash:base.squash*(1-.04*anticipation-.055*landing-
        (base.kind==='slide'?.02*recovery:0))};
  }
  function pip(x,y,pose){
    const s=minmax(.73,H/690,1.13);
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    oval(3,4,pose.lift?17:28,pose.lift?3:5,pose.lift?'rgba(23,51,47,.17)':'rgba(23,51,47,.30)');
    const stride=clock*16.1,leg=Math.sin(stride)*.73;
    ctx.translate(0,-pose.lift-Math.abs(Math.sin(stride))*(pose.active?0:2.5));
    ctx.translate(0,-51*pose.squash);ctx.rotate(pose.spin+pose.lean);
    ctx.translate(0,51*pose.squash);ctx.scale(1,pose.squash);
    ctx.lineCap='round';ctx.lineJoin='round';
    // Satchel and fluttering scarf, behind the torso.
    rounded(-29,-83,35,38,11,gradient(-29,-82,7,-47,[[0,'#b98c72'],[.45,'#e9b994'],[1,'#8e7776']]));
    line(-22,-68,-14,-35,'#8b6e7a',4);
    ctx.beginPath();ctx.moveTo(-9,-80);ctx.quadraticCurveTo(-32,-78,-50,-87+Math.sin(clock*11)*6);
    ctx.quadraticCurveTo(-33,-65,-9,-67);ctx.closePath();ctx.fillStyle='#de9079';ctx.fill();
    // Legs visibly cycle independently. Small landing fold reduces mechanical look.
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*12,-25);
      ctx.rotate(side*(pose.lift>10?-.40:leg));
      rounded(-7,-1,15,29,6,gradient(-10,0,10,25,[[0,'#656b99'],[.7,'#837cac'],[1,'#494e78']]));
      oval(side*3+4,27,15,8,gradient(-13,20,17,31,[[0,'#edb080'],[.55,'#d28d72'],[1,'#ac6477']]));
      oval(side*7+5,24,7,2.4,'rgba(253,238,207,.62)');
      ctx.restore();
    }
    // Body modeled with broad lighting, bright vest and soft specular regions.
    oval(0,-58,22,29,gradient(-23,-85,23,-30,[[0,'#5e5191'],[.38,'#9988ca'],[1,'#65598b']]));
    rounded(-15,-78,30,33,10,gradient(-16,-75,17,-50,[[0,'#419b92'],[.5,'#81d5b6'],[1,'#3a9d9b']]));
    oval(-1,-68,2.7,2.7,'#fff0c0');oval(-1,-57,2.7,2.7,'#fff0c0');
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*21,-74);
      ctx.rotate(side*(pose.lift>10?-.6:Math.sin(stride+side)*.42));
      line(0,0,side*7,22,'#6865a0',11);oval(side*7,22,6,7,'#f8dfb9');
      ctx.restore();
    }
    oval(0,-99,25,26,gradient(-25,-121,24,-73,[[0,'#f3c5a6'],[.55,'#ffe5bc'],[1,'#e4b39f']]));
    oval(18,-98,6,11,'#ecc09b');
    oval(-18,-98,6,11,'#edbf9f');
    const blink=clock%4.1>3.96;
    if(blink){line(-10,-102,-3,-102,'#524b67',2);line(6,-102,13,-102,'#524b67',2);}
    else {oval(-8,-104,3,5,'#564a68');oval(10,-103,3,5,'#564a68');oval(-9,-106,1,1,'white');oval(9,-105,1,1,'white');}
    oval(-17,-93,4,2,'rgba(238,135,138,.54)');oval(17,-93,4,2,'rgba(238,135,138,.55)');
    ctx.beginPath();ctx.arc(1,-94,5,.2,PI-.15);ctx.strokeStyle='#aa7385';ctx.lineWidth=1.7;ctx.stroke();
    // Unique leaf cap, not a commercial character's outfit.
    oval(0,-119,35,8,'#d2eaca');
    ctx.beginPath();ctx.moveTo(-35,-119);ctx.bezierCurveTo(-44,-151,-18,-180,2,-181);
    ctx.bezierCurveTo(33,-180,48,-147,35,-119);ctx.closePath();
    ctx.fillStyle=gradient(-35,-180,38,-121,[[0,'#b1e7ba'],[.42,'#56bfae'],[1,'#337e91']]);ctx.fill();
    oval(-15,-154,8.5,10,'#eaffdc');oval(17,-145,10,8,'#f5ffe5');oval(1,-170,6,4,'#f5ffe7');
    if(pose.glide){
      line(-7,-188,1,-230,'#9b869d',2);
      ctx.beginPath();ctx.moveTo(-84,-224);ctx.quadraticCurveTo(0,-276,84,-224);
      ctx.quadraticCurveTo(0,-202,-84,-224);ctx.closePath();
      ctx.fillStyle=gradient(0,-263,0,-206,[[0,'#ffe8bd'],[1,'#d0b2bd']]);ctx.fill();
      ctx.strokeStyle='#ab8999';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.restore();
    // Dust trails and happy stunt glints are temporally deterministic.
    if(!pose.active){
      for(let i=0;i<3;i++){
        oval(x-s*(20+i*13),y-2-i*4,6-i,2.8-i*.4,`rgba(255,245,196,${.35-i*.085})`);
      }
    }else if(pose.lift>30){
      for(let i=0;i<3;i++){
        const th=clock*1.4+i*TAU/3;
        oval(x+Math.sin(th)*s*48,y-pose.lift*s-s*(89+Math.cos(th)*20),2.7,2.7,'rgba(255,242,166,.75)');
      }
    }
  }
  function cinematicTerrace(){
    if(!texturedLedge.complete||!texturedLedge.naturalWidth){ledge();flowers();return;}
    // A photographed, sunlit earthen terrace from the same cinematic artwork.
    // This deliberately replaces the old flat gray rock + cartoon green stripe.
    const scale=Math.max(.78,Math.min(1.23,H/910));
    const width=texturedLedge.naturalWidth*scale;
    const height=texturedLedge.naturalHeight*scale;
    const top=ground()-95*scale;
    const drift=world*1.02;
    const phase=((drift%width)+width)%width;
    ctx.save();
    for(let x=-width-phase;x<W+width;x+=width)
      ctx.drawImage(texturedLedge,x,top,width,height);
    // A subtle warm bounce at the horizon gives the textured ground the
    // same afternoon lighting direction as the kingdom architecture.
    const g=ctx.createLinearGradient(0,ground()-35,0,H);
    g.addColorStop(0,'rgba(255,222,157,0)');
    g.addColorStop(.5,'rgba(218,157,89,.025)');
    g.addColorStop(1,'rgba(44,62,63,.10)');
    ctx.fillStyle=g;ctx.fillRect(0,ground()-36,W,H-ground()+40);
    ctx.restore();
  }
  function cinematicSetPieces(){
    const first=Math.floor((world-W*.4)/CHAPTER)-1;
    const last=Math.ceil((world+W*.7)/CHAPTER)+1;
    const figureScale=Math.max(.46,Math.min(.86,Math.min(W/590,H/1030)*.91));
    for(let i=first;i<=last;i++){
      const kind=stunts[((i%stunts.length)+stunts.length)%stunts.length];
      if(kind!=='bounce'&&kind!=='vault')continue;
      const x=W*.34 +i*CHAPTER+385-world;
      if(x<-150||x>W+150)continue;
      if(bounceCap.complete&&bounceCap.naturalWidth){
        // One reused cinematic mushroom image: the cap compresses at the
        // precise world coordinate where Pip's boots touch it, then rebounds.
        const g=kind==='bounce'?springGeometry(i):null;
        const contact=g?springCompression(world-i*CHAPTER):0;
        const h=g?g.height*(1-g.compression*contact):86*figureScale/.72;
        const w=g?g.width*(1+.075*contact):
          h*(bounceCap.naturalWidth/bounceCap.naturalHeight);
        ctx.save();ctx.globalAlpha=.95;
        ctx.drawImage(bounceCap,x-w*.5,ground()-h+4,w,h);
        ctx.restore();
      }else softMushroom(x,ground()-8,kind==='bounce'?.70:.45,i);
    }
  }
  // The single log belongs to the hop chapter only. Its physical silhouette
  // and drawing share one deterministic size and x-coordinate.
  function logGeometry(chapter){
    const scale=minmax(.68,Math.min(W/780,H/850),1.03);
    return {chapter,worldX:chapter*CHAPTER+385,
      scale,width:118*scale,height:53.5*scale,
      bodyHeight:28*scale,bodyHalfWidth:47*scale};
  }
  function cinematicLog(){
    // Only authored hop passages receive this specific fallen trunk, spaced
    // ten chapters apart. All other actions and scenery remain untouched.
    if(!fallenLog.complete||fallenLog.naturalWidth!==640)return;
    const first=Math.floor((world-W*.4-130)/CHAPTER)-1;
    const last=Math.ceil((world+W*.7+130)/CHAPTER)+1;
    for(let i=first;i<=last;i++){
      if(stunts[((i%stunts.length)+stunts.length)%stunts.length]!=='hop')continue;
      const log=logGeometry(i);
      const sx=W*.34+log.worldX-world;
      if(sx<-log.width||sx>W+log.width)continue;
      ctx.drawImage(fallenLog,sx-log.width/2,ground()+13-log.height,
        log.width,log.height);
    }
  }
  // One complete 16-pose cycle spans 144 world pixels. The planted boot
  // stays on a fixed ground baseline; visual cadence comes from the authored
  // opposing-leg poses rather than translating the entire figure up and down.
  // The two soft footfalls are eight frames apart.
  function gaitAt(x,step=RUN_STRIDE_PX){
    const phase=((x/step)%RUN_FRAMES+RUN_FRAMES)%RUN_FRAMES;
    const frame=Math.floor(phase);
    const strikeDistance=Math.min(
      Math.abs(phase),Math.abs(phase-8),Math.abs(phase-RUN_FRAMES));
    const contact=smooth(1-strikeDistance/1.55);
    return {phase,frame,contact,foot:frame<8?'front':'back'};
  }
  function pipFrame(pose){
    if(!pose.active||pose.kind==='dash'){
      return gaitAt(world,pose.kind==='dash'?RUN_STRIDE_PX*.8:RUN_STRIDE_PX).frame;
    }
    // Distinct authored silhouettes, not the entire picture spinning in midair.
    if(pose.kind==='slide')return 21;
    if(pose.kind==='bounce'){
      const p=195+pose.u*355;
      if(p<269)return 17;
      if(p<357)return 18;
      if(p<382)return 19;
      if(p<401)return 20;
      if(p<432)return 16;
      if(p<480)return 18;
      if(p<525)return 19;
      return 20;
    }
    if(pose.u<.16)return 16;   // anticipation and push-off
    if(pose.u<.38)return 17;   // rising
    if(pose.u<.64)return 18;   // legs tucked at apex
    if(pose.u<.88)return 19;   // reach for terrain
    return 20;                 // contact / landing
  }
  // Exactly one opaque authored pose is drawn per frame. The former v8
  // crossfade briefly brought running legs back *after* takeoff and painted
  // two overlapping translucent full-body sprites, which visibly flickered.
  // Use time/ground easing for softness instead of body-image transparency.
  function spriteFrame(pose){
    const run=gaitAt(world,pose.kind==='dash'?RUN_STRIDE_PX*.8:RUN_STRIDE_PX).frame;
    if(!pose.active){
      if((pose.recovery||0)>.5)return pose.kind==='slide'?21:20;
      if((pose.anticipation||0)>.72)return pose.kind==='slide'?21:16;
      return run;
    }
    return pose.kind==='dash'?run:pipFrame(pose);
  }
  function cinematicPip(x,y,pose){
    if(!renderedPip.complete||!renderedPip.naturalWidth){pip(x,y,pose);return;}
    // At each aspect ratio Pip matches the apparent scale of the near cliff.
    const s=Math.max(.49,Math.min(.90,Math.min(W/540,H/980)*.87));
    const groundY=y;
    ctx.save();
    // Shadow broadens and fades continuously as Pip rises. No sudden pop
    // at an arbitrary jump-height threshold.
    const airtime=minmax(0,pose.lift/145,1);
    const shadowOpacity=(.37-.22*airtime).toFixed(3);
    const shadow=ctx.createRadialGradient(x+7,groundY+5,2,x+7,groundY+5,(43+15*airtime)*s);
    shadow.addColorStop(0,`rgba(43,38,32,${shadowOpacity})`);
    shadow.addColorStop(1,'rgba(55,49,42,0)');
    ctx.fillStyle=shadow;ctx.fillRect(x-70*s,groundY-21*s,140*s,53*s);
    const newSheet=runningPip.complete&&runningPip.naturalWidth===PIP_FRAME_W*RUN_TOTAL;
    // Lock the sprite's heel line to the same ground height throughout the
    // 16 run frames. Former time-driven bob was lifting planted shoes off the
    // terrain and causing visible vertical jitter.
    const lift=pose.lift*s;
    const footInset=newSheet?9*s:0;
    ctx.translate(x,groundY-lift+footInset);
    ctx.translate(0,-143*s);
    // Limit pitch to a small authored pose transition. No full-body waving.
    ctx.rotate(pose.active?Math.max(-.09,Math.min(.09,pose.lean)):0);
    ctx.translate(0,143*s);
    ctx.scale(1,pose.squash);
    const frame=newSheet?spriteFrame(pose):Math.floor(Math.abs(world)/RUN_STRIDE_PX)%PIP_FRAMES;
    const sheet=newSheet?runningPip:renderedPip;
    // Draw one full-opacity sprite. Never overlay two partially transparent
    // Pip images: limb silhouettes, hair and outlines otherwise shimmer.
    ctx.drawImage(sheet,frame*PIP_FRAME_W,0,PIP_FRAME_W,PIP_FRAME_H,
      -PIP_FRAME_W*s*.5,-PIP_FRAME_H*s,PIP_FRAME_W*s,PIP_FRAME_H*s);
    if(pose.glide){
      // Warm, dimensionally shaded silk glider, tucked behind its hero.
      const gl=ctx.createLinearGradient(-58*s,-291*s,66*s,-233*s);
      gl.addColorStop(0,'#ffe8ad');gl.addColorStop(.54,'#f6cdab');gl.addColorStop(1,'#b887a1');
      ctx.beginPath();ctx.moveTo(-83*s,-257*s);
      ctx.quadraticCurveTo(0,-320*s,83*s,-257*s);
      ctx.quadraticCurveTo(0,-245*s,-83*s,-257*s);
      ctx.closePath();ctx.fillStyle=gl;ctx.fill();
      ctx.strokeStyle='rgba(119,99,116,.54)';ctx.lineWidth=1.8*s;ctx.stroke();
    }
    ctx.restore();
    // Two quiet, sunlit dust flecks follow real foot contact after a jump;
    // no bursty particles, outlines, or new mismatched vector obstacles.
    const contact=pose.landing||0;
    if(contact>.01){
      for(const side of [-1,1]){
        const a=(contact*.19).toFixed(3);
        oval(x+side*(14+13*(1-contact))*s,groundY-(6+6*(1-contact))*s,
          (4+3*(1-contact))*s,(1.6+contact)*s,
          `rgba(248,228,192,${a})`);
      }
    }
    // A soft contact fleck appears only as alternating feet meet the ground;
    // perpetual dust clouds made the character look like it was gliding.
    if(!pose.active && !(pose.anticipation>.02) && !(pose.recovery>.02)){
      const strike=gaitAt(world).contact;
      if(strike>.015){
        const a=(.095*strike).toFixed(3);
        oval(x-17*s,groundY-5*s,5.5*s,1.8*s,
          `rgba(251,228,184,${a})`);
      }
    }
  }
  function render(){
    if(!ctx||!canvas.width)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    background();waterMotion();skyLife();
    cinematicTerrace();cinematicSetPieces();cinematicLog();
    const characterX=W*.34;
    cinematicPip(characterX,ground()+10,animationAt(world));
    // Soft corner falloff integrates the photographically rich kingdom plate
    // and the sculpted foreground land without masking readable detail.
    const v=ctx.createRadialGradient(W*.5,H*.48,Math.min(W,H)*.32,W*.5,H*.48,Math.max(W,H)*.89);
    v.addColorStop(0,'rgba(22,64,64,0)');v.addColorStop(1,'rgba(34,53,75,.17)');
    ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
  }
  function frame(now){
    raf=0;
    if(!playing||!visible)return;
    const dt=previous?minmax(0,(now-previous)/1000,.04):0;
    previous=now;clock+=dt;world+=SPEED*dt;
    render();raf=requestAnimationFrame(frame);
  }
  function updateMotion(next){
    playing=Boolean(next)&&!reduced.matches;
    previous=0;
    if(raf){cancelAnimationFrame(raf);raf=0;}
    if(playing&&visible)raf=requestAnimationFrame(frame);
    else render();
  }
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||!e.data||e.data.type!=='mushroom:motion')return;
    embedded=true;updateMotion(e.data.playing);
  });
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    visible=!document.hidden;previous=0;
    if(visible){if(playing&&!raf)raf=requestAnimationFrame(frame);}else if(raf){cancelAnimationFrame(raf);raf=0;}
  });
  window.addEventListener('keydown',e=>{
    if(!embedded&&(e.code==='Space'||e.key===' ')){
      e.preventDefault();updateMotion(!playing);
    }
  });
  reduced.addEventListener?.('change',e=>{
    if(e.matches)updateMotion(false);
  });
  palace.onload=()=>{loadState='ready';render();};
  palace.onerror=()=>{loadState='error';loadError=true;render();};
  palace.src='assets/mushroom-cinematic-kingdom.webp';
  for(const picture of [renderedPip,texturedLedge,bounceCap]){
    picture.onload=()=>render();picture.onerror=()=>render();
  }
  renderedPip.src='assets/pip-cinematic-run.webp';
  runningPip.onload=()=>render();runningPip.onerror=()=>render();
  runningPip.src='assets/pip-full-run-22.webp';
  texturedLedge.src='assets/mushroom-terrace-cinematic.webp';
  bounceCap.src='assets/mushroom-bounce-cinematic.webp';
  fallenLog.onload=()=>render();fallenLog.onerror=()=>render();
  fallenLog.src='assets/mossy-fallen-log.svg';

  resize();if(playing)raf=requestAnimationFrame(frame);
  // Minimal test-only hooks may be injected by the smoke harness; production
  // does not expose animation controls or debugging objects to app users.
})();