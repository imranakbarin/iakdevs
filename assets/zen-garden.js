/* A persistent, distance-driven sand trace. No moving photograph or looping video. */
const zenPhoto=new Image();zenPhoto.src='assets/zen-garden-hd.jpg';
const zenLeaf=new Image();zenLeaf.src='assets/zen-maple-leaf.png';
const zenTrace=document.createElement('canvas');zenTrace.width=zenTrace.height=2200;
const zc=zenTrace.getContext('2d');zc.scale(2,2);
let zenClock=0,zenDistance=0,zenPath=[],zenLength=0,zenReady=false,zenPattern='spiral',zenCycle=0;
function zenBuildPath(pattern){
 const raw=[];const randomTerms=Array.from({length:4},(_,j)=>({fx:1+Math.floor(Math.random()*7),fy:1+Math.floor(Math.random()*7),px:Math.random()*Math.PI*2,py:Math.random()*Math.PI*2,a:1/(1+j*1.5)}));const turns=pattern==='spiral'?12:pattern==='petals'?9:7;
 for(let i=0;i<=16000;i++){
  const u=i/16000,a=u*Math.PI*2*turns;
  if(pattern==='random'){
   let x=0,y=0;for(const f of randomTerms){x+=Math.sin(u*Math.PI*2*f.fx+f.px)*f.a;y+=Math.cos(u*Math.PI*2*f.fy+f.py)*f.a;}
   raw.push({x:550+x*250,y:550+y*250});continue;
  }
  let r;
  if(pattern==='spiral')r=.08+.82*(.5-.5*Math.cos(u*Math.PI*2));
  else if(pattern==='petals')r=.18+.70*(.5+.5*Math.cos(a*5/9));
  else r=.12+.76*(.5+.5*Math.sin(a*3/7));
  raw.push({x:550+Math.cos(a)*r*510,y:550+Math.sin(a)*r*510});
 }
 if(pattern==='random'){const max=Math.max(...raw.map(p=>Math.hypot(p.x-550,p.y-550)));for(const p of raw){p.x=550+(p.x-550)*460/max;p.y=550+(p.y-550)*460/max;}}
 zenPath=[{...raw[0],d:0}];let d=0;
 for(let i=1;i<raw.length;i++){d+=Math.hypot(raw[i].x-raw[i-1].x,raw[i].y-raw[i-1].y);zenPath.push({...raw[i],d});}
 zenLength=d;
}
function zenPoint(d){
 d=Math.max(0,Math.min(zenLength,d));let lo=0,hi=zenPath.length-1;
 while(lo+1<hi){const m=(lo+hi)>>1;if(zenPath[m].d<d)lo=m;else hi=m;}
 const a=zenPath[lo],b=zenPath[hi],f=(d-a.d)/(b.d-a.d||1);
 return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};
}
function zenCarve(from,to){
 if(to<=from)return;
 const pts=[zenPoint(from)];for(let d=from+1.6;d<to;d+=1.6)pts.push(zenPoint(d));pts.push(zenPoint(to));
 zc.lineCap='butt';zc.lineJoin='round';
 // Low sand ridges surround a recessed trough; illumination comes from upper left.
 for(const [width,color,dx,dy] of [[8.4,'rgba(243,232,206,.34)',0,0],[6.2,'rgba(111,88,57,.35)',-.65,-.8],[3.8,'rgba(162,139,103,.31)',0,0],[1.2,'rgba(255,246,222,.48)',1.8,2]]){
  zc.beginPath();pts.forEach((p,i)=>i?zc.lineTo(p.x+dx,p.y+dy):zc.moveTo(p.x+dx,p.y+dy));zc.strokeStyle=color;zc.lineWidth=width;zc.stroke();
 }
}
function zenReset(){
 zenBuildPath(document.getElementById('zen-pattern')?.value||zenPattern);zc.clearRect(0,0,1100,1100);
 zenDistance=0;zenCycle=0;zenReady=true;
}

// Each environment is a separate photographic scene. The tray is independently
// composed so portrait screens retain the whole garden rather than letterboxing.
const zenGardens={
 moss:{src:'assets/zen-moss.jpg',tip:[.847,.685],light:'#e9eac7'},
 autumn:{src:'assets/zen-autumn.jpg',tip:[.918,.754],light:'#ffe1a4'},
 moon:{src:'assets/zen-moon.jpg',tip:[.927,.674],light:'#c7d9f0'}
};
let zenGarden='moss',zenAtmosphere=true;
const zenGardenTiles=new Map();
function zenSetGarden(key){
 if(!zenGardens[key])return;
 zenGarden=key;const garden=zenGardens[key];
 if(!garden.image){garden.image=new Image();garden.image.src=garden.src;}
}
function zenComposition(w,h,iw=1536,ih=1024){
 const portrait=w/h<1,scale=Math.max(w/iw,h/ih);
 return {w,h,portrait,scale,bx:(w-iw*scale)/2,by:(h-ih*scale)/2,
 cx:w*(portrait?.5:.43),cy:h*(portrait?.52:.53),r:Math.min(w*(portrait?.46:.35),h*.38)};
}
function zenCorner(photo,key,sx,sy,sw,sh,anchor='right-bottom'){
 if(zenGardenTiles.has(key))return zenGardenTiles.get(key);
 const tile=document.createElement('canvas');tile.width=Math.round(sw);tile.height=Math.round(sh);
 const q=tile.getContext('2d');q.drawImage(photo,sx,sy,sw,sh,0,0,sw,sh);
 q.globalCompositeOperation='destination-in';
 const mask=q.createLinearGradient(0,0,sw,0);mask.addColorStop(0,anchor.includes('left')?'#000':'transparent');mask.addColorStop(anchor.includes('left')?.7:.3,'#000');mask.addColorStop(1,anchor.includes('left')?'transparent':'#000');q.fillStyle=mask;q.fillRect(0,0,sw,sh);
 const vertical=q.createLinearGradient(0,0,0,sh);vertical.addColorStop(0,anchor.includes('top')?'#000':'transparent');vertical.addColorStop(anchor.includes('top')?.7:.25,'#000');vertical.addColorStop(1,anchor.includes('top')?'transparent':'#000');q.fillStyle=vertical;q.fillRect(0,0,sw,sh);
 zenGardenTiles.set(key,tile);return tile;
}
function zenScene(c,L,garden,t){
 const im=garden.image,iw=im.naturalWidth,ih=im.naturalHeight;
 c.drawImage(im,L.bx,L.by,iw*L.scale,ih*L.scale);
 let tip={x:L.bx+garden.tip[0]*iw*L.scale,y:L.by+garden.tip[1]*ih*L.scale};
 if(L.portrait){
  // Preserve edge props at their natural aspect ratio on narrow screens.
  const sw=iw*.28,sh=ih*.44,tw=L.w*.52,th=tw*sh/sw;
  const tile=zenCorner(im,zenGarden+'-incense',iw*.72,ih*.56,sw,sh);
  const x=L.w-tw,y=L.h-th;
  c.drawImage(tile,x,y,tw,th);
  tip={x:x+(garden.tip[0]-.72)/.28*tw,y:y+(garden.tip[1]-.56)/.44*th};
  const foliage=zenCorner(im,zenGarden+'-foliage',iw*.68,0,iw*.32,ih*.43,'right-top');
  const fw=L.w*.65,fh=fw*(ih*.43)/(iw*.32);
  c.save();c.translate(L.w,0);c.rotate(zenAtmosphere?Math.sin(t*.37)*.0015:0);c.drawImage(foliage,-fw,0,fw,fh);c.restore();
  // The moonlit candle remains visible below the tray on phones.
  if(zenGarden==='moon'){
   const candle=zenCorner(im,'moon-candle',0,ih*.54,iw*.26,ih*.46,'left-bottom');
   const cw=L.w*.48,ch=cw*(ih*.46)/(iw*.26);c.drawImage(candle,0,L.h-ch,cw,ch);
  }
 }
 if(zenAtmosphere&&!L.portrait){
  // Feathered photographic foliage, tiny branch motion rather than moving scenery.
  const sway=Math.sin(t*.37)*.0015;
  c.save();c.translate(L.w,L.portrait?L.h*.06:0);c.rotate(sway);
  const foliage=zenCorner(im,zenGarden+'-sway',iw*.72,0,iw*.28,ih*.36,'right-top');
  const fw=L.portrait?L.w*.52:iw*.28*L.scale,fh=fw*(ih*.36)/(iw*.28);
  c.drawImage(foliage,-fw,0,fw,fh);c.restore();
 }
 return tip;
}
function zenDrawBall(c,x,y,br){
 // The ball sits in the sand: ambient contact shadow and a longer soft sun shadow.
 c.save();c.translate(x,y);c.fillStyle='rgba(28,24,18,.24)';c.filter='blur(4px)';c.beginPath();c.ellipse(br*.55,br*.7,br*1.18,br*.73,.5,0,Math.PI*2);c.fill();c.filter='none';
 c.fillStyle='rgba(42,33,22,.42)';c.beginPath();c.ellipse(1,br*.5,br*.83,br*.47,0,0,Math.PI*2);c.fill();
 c.beginPath();c.arc(0,-br*.3,br,0,Math.PI*2);c.clip();
 const steel=c.createLinearGradient(-br,-br*1.3,br,br*.7);
 [[0,'#f9faf6'],[.17,'#d7ddd8'],[.33,'#7f8987'],[.43,'#293b38'],[.5,'#d4d6c9'],[.64,'#f0e7d3'],[.86,'#777b76'],[1,'#28312f']].forEach(([v,col])=>steel.addColorStop(v,col));c.fillStyle=steel;c.fillRect(-br,-br*1.3,br*2,br*2);
 const shine=c.createRadialGradient(-br*.37,-br*.78,0,0,-br*.3,br*1.2);shine.addColorStop(0,'rgba(255,255,255,.95)');shine.addColorStop(.25,'rgba(255,255,255,.15)');shine.addColorStop(.7,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(12,22,20,.5)');c.fillStyle=shine;c.fillRect(-br,-br*1.3,br*2,br*2);
 c.restore();

}
function zenTrayBase(){
 const key=zenGarden==='moon'?'tray-moon':'tray-day';
 if(zenGardenTiles.has(key))return zenGardenTiles.get(key);
 const tile=document.createElement('canvas');tile.width=tile.height=1024;
 const q=tile.getContext('2d'),r=480,cx=512,cy=512,iw=zenPhoto.naturalWidth,ih=zenPhoto.naturalHeight,sr=ih*.466;
 q.save();q.fillStyle='rgba(8,12,8,.32)';q.filter='blur(11px)';q.beginPath();q.ellipse(cx+r*.018,cy+r*.035,r*1.01,r*.985,0,0,Math.PI*2);q.fill();q.restore();
 q.save();q.beginPath();q.arc(cx,cy,r,0,Math.PI*2);q.clip();if(zenGarden==='moon')q.filter='brightness(.68) saturate(.58)';
 q.drawImage(zenPhoto,iw*.4036-sr,ih*.488-sr,sr*2,sr*2,cx-r,cy-r,r*2,r*2);q.restore();
 zenGardenTiles.set(key,tile);return tile;
}
function zenTray(c,L,t){
 const inner=L.r*.408/.466,extent=L.r*1024/480;
 // Cache the photographic tray, its lighting and soft contact shadow.
 c.drawImage(zenTrayBase(),L.cx-extent/2,L.cy-extent/2,extent,extent);
 c.save();c.beginPath();c.arc(L.cx,L.cy,L.r,0,Math.PI*2);c.clip();
 c.save();c.beginPath();c.arc(L.cx,L.cy,inner-1,0,Math.PI*2);c.clip();
 c.globalAlpha=zenCycle>8?1-Math.min(1,(zenCycle-8)/6):1;
 c.drawImage(zenTrace,L.cx-inner,L.cy-inner,inner*2,inner*2);c.restore();
 if(zenAtmosphere){
  for(let j=0;j<7;j++){
   const x=L.cx+inner*(.24+(j%3)*.27)+Math.sin(t*.15+j)*inner*.02,y=L.cy-inner*(.8-Math.floor(j/3)*.25);
   const shade=c.createRadialGradient(x,y,0,x,y,inner*.24);shade.addColorStop(0,'rgba(30,42,25,.055)');shade.addColorStop(1,'transparent');c.fillStyle=shade;c.fillRect(x-inner*.24,y-inner*.24,inner*.48,inner*.48);
  }
 }
 c.restore();
 const p=zenPoint(zenDistance),x=L.cx+(p.x-550)/550*inner,y=L.cy+(p.y-550)/550*inner,br=inner*.032;
 zenDrawBall(c,x,y,br);
}
function zenSmoke(c,tip,L,t){
 const height=Math.min(L.h*.32,L.w*.35),wind=Math.sin(t*.12)*.12;
 c.save();c.lineCap='round';c.lineJoin='round';
 // Three continuous ribbons share a breeze and spread as they rise. Each is
 // one stroke, keeping the atmosphere light enough for mobile rendering.
 for(let j=0;j<3;j++){
  c.beginPath();c.moveTo(tip.x,tip.y);
  for(let i=1;i<=44;i++){
   const u=i/44,age=t*.22-u*4.5,spread=u*u;
   c.lineTo(tip.x+height*(wind*u+spread*.15*Math.sin(age+j*.9)+spread*.07*Math.sin(age*1.7+j)),tip.y-height*u);
  }
  const fade=c.createLinearGradient(0,tip.y-height,0,tip.y);
  fade.addColorStop(0,'rgba(222,230,224,0)');fade.addColorStop(.4,`rgba(222,230,224,${.075-j*.012})`);fade.addColorStop(1,`rgba(222,230,224,${.19-j*.04})`);
  c.strokeStyle=fade;c.lineWidth=1.2+j*1.6;c.filter=`blur(${.6+j*.8}px)`;c.stroke();
 }
 c.restore();
}
function zenLight(c,L,t){
 c.save();c.globalCompositeOperation='screen';
 for(let j=0;j<2;j++){
  c.save();c.translate(-L.w*.08,-L.h*.15);c.rotate(-.35+j*.13);
  const beam=c.createLinearGradient(-L.w*.1,0,L.w*.1,0);beam.addColorStop(0,'transparent');beam.addColorStop(.5,zenGarden==='moon'?'rgba(153,192,230,.025)':`rgba(255,236,191,${.027+.006*Math.sin(t*.1+j)})`);beam.addColorStop(1,'transparent');c.fillStyle=beam;c.fillRect(-L.w*.1,0,L.w*.2,L.h*1.6);c.restore();
 }
 c.restore();
 if(zenGarden==='moon'){
  const glow=c.createRadialGradient(L.w*.065,L.h*.78,0,L.w*.065,L.h*.78,L.w*.2);glow.addColorStop(0,`rgba(255,166,62,${.034+.006*Math.sin(t*1.7)})`);glow.addColorStop(1,'transparent');c.fillStyle=glow;c.fillRect(0,L.h*.5,L.w*.3,L.h*.5);
 }else{
  c.save();c.fillStyle='#fff2cf';for(let j=0;j<8;j++){const u=(t/(70+j*3)+j*.618)%1;c.globalAlpha=.14*Math.sin(Math.PI*u);c.beginPath();c.arc(L.w*(.08+u*.82),L.h*(.12+(j*.137)% .78)+Math.sin(t*.12+j)*8,.7+(j%2)*.4,0,Math.PI*2);c.fill();}c.restore();
 }
}
function zenLeafState(j,t,iw,ih){
 const duration=25+j*4,cycle=Math.floor(t/duration+j*.27),phase=(t/duration+j*.27)%1;
 const u=Math.min(1,phase/.74),fall=(u-(1-Math.exp(-4*u))/4)/(1-(1-Math.exp(-4))/4);
 const variation=Math.sin(cycle*17.3+j*2.8);
 const x=iw*(.83+j*.037-.075*fall)+Math.sin(u*4.2+j+variation)*iw*.012*Math.sin(Math.PI*u);
 const y=ih*(.065+(j%2)*.045+fall*(.59+j*.035));
 const height=1-fall,size=Math.min(iw,ih)*(.035+j*.003)*(1+height*.28);
 const tilt=.76+Math.sin(u*8+j)*.18*height,angle=-.4+j*.67+Math.sin(u*5.7+j)*.5*height;
 const fade=phase<.05?phase/.05:phase>.92?(1-phase)/.08:1;
 return {x,y,size,height,tilt,angle,alpha:Math.max(0,fade),landed:u===1};
}
function zenFallingLeaves(c,iw,ih,t){
 if(!zenLeaf.complete||!zenLeaf.naturalWidth)return;
 for(let j=0;j<3;j++){
  const p=zenLeafState(j,t,iw,ih);
  // The shadow approaches the leaf, sharpens, and darkens as it settles.
  c.save();c.translate(p.x+p.size*(.04+p.height*.4),p.y+p.size*(.05+p.height*.5));c.rotate(p.angle);c.scale(1,p.tilt);c.globalAlpha=p.alpha*(.12+(1-p.height)*.13);c.filter=`brightness(0) blur(${1+p.height*5}px)`;c.drawImage(zenLeaf,-p.size/2,-p.size/2,p.size,p.size);c.restore();
  c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.scale(1,p.tilt);c.globalAlpha=p.alpha;c.drawImage(zenLeaf,-p.size/2,-p.size/2,p.size,p.size);c.restore();
 }
}

function zenFrame(dt){
 if(!zenReady)zenReset();
 if(!zenGardens[zenGarden].image)zenSetGarden(zenGarden);
 const garden=zenGardens[zenGarden],ready=zenPhoto.complete&&zenPhoto.naturalWidth&&garden.image.complete&&garden.image.naturalWidth;
 if(playing&&ready){zenClock+=dt;const previous=zenDistance;zenDistance=Math.min(zenLength,zenDistance+dt*22*speed/40);zenCarve(previous,zenDistance);if(zenDistance>=zenLength){zenCycle+=dt;if(zenCycle>=14)zenReset();}}
 const c=ctx,w=cv.clientWidth,h=cv.clientHeight;c.setTransform(DPR,0,0,DPR,0,0);c.fillStyle='#25251f';c.fillRect(0,0,w,h);
 if(!ready){c.fillStyle='#ddd4c2';c.font='18px system-ui';c.textAlign='center';c.fillText('Settling into the garden…',w/2,h/2);return;}
 const L=zenComposition(w,h,garden.image.naturalWidth,garden.image.naturalHeight),t=zenClock;
 const tip=zenScene(c,L,garden,t);zenTray(c,L,t);
 if(zenAtmosphere){zenLight(c,L,t);zenSmoke(c,tip,L,t);if(zenGarden==='autumn')zenFallingLeaves(c,w,h,t);}
}
