/* Illustrated garden: cached scenery and sand; only moving layers redraw. */
const zenTrace=document.getElementById('zen-sand');zenTrace.width=zenTrace.height=1100;
const zc=zenTrace.getContext('2d');
let zenClock=0,zenDistance=0,zenPath=[],zenLength=0,zenReady=false,zenPattern='spiral',zenCycle=0;
function zenBuildPath(pattern){
 const raw=[];const randomTerms=Array.from({length:4},(_,j)=>({fx:1+Math.floor(Math.random()*7),fy:1+Math.floor(Math.random()*7),px:Math.random()*Math.PI*2,py:Math.random()*Math.PI*2,a:1/(1+j*1.5)}));const turns=pattern==='spiral'?12:pattern==='petals'?9:7;
 for(let i=0;i<=4800;i++){
  const u=i/4800,a=u*Math.PI*2*turns;
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
 for(const [width,color,dx,dy] of [[6,'rgba(255,246,215,.5)',0,0],[3.8,'rgba(113,86,54,.30)',-.5,-.5],[1.7,'rgba(160,127,81,.4)',0,0],[.8,'rgba(255,248,222,.7)',1.6,1.6]]){
  zc.beginPath();pts.forEach((p,i)=>i?zc.lineTo(p.x+dx,p.y+dy):zc.moveTo(p.x+dx,p.y+dy));zc.strokeStyle=color;zc.lineWidth=width;zc.stroke();
 }
}

const zenGardens={
 moss:{asset:'koi',smokePoint:[.923,.82,.928,.842],sand:'#ecdbb8',rim:['#a7623d','#bb7750','#975637'],ink:'#344735',petals:['#e8b3a5','#f1c7b7','#d99283'],smoke:'#efe2bf'},
 autumn:{asset:'autumn',smokePoint:[.923,.82,.927,.856],sand:'#ead3a5',rim:['#975139','#ad6341','#bd7c4c'],ink:'#4c4930',petals:['#d47436','#c65432','#e7a447'],smoke:'#f6ddad'},
 moon:{asset:'moon',smokePoint:[.921,.817,.892,.829],sand:'#c4c8b9',rim:['#6f827c','#84958b','#586d67'],ink:'#203e42',petals:['#dfd4d0','#c9c9d8','#ece7d7'],smoke:'#c8dbd7'}
};
let zenGarden='moss',zenAtmosphere=true,zenStaticKey='',zenStatic=null,zenMask=null,zenWater=null;
let zenSandImage;
const zenImages=new Map(),zenPetals=SceneMotion.particles(18,143),zenRipples=[];
const zenDrive={x:34,v:0},zenBranch={x:0,v:0};
function zenSetGarden(key){if(!zenGardens[key])return;zenGarden=key;zenStaticKey='';SceneMotion.invalidate();}
function zenReset(){
 zenPattern=document.getElementById('zen-pattern')?.value||'spiral';zenBuildPath(zenPattern);
 zc.clearRect(0,0,1100,1100);zenTrace.style.opacity='1';zenDistance=0;zenCycle=0;zenReady=true;zenDrive.x=0;zenDrive.v=0;
 SceneMotion.invalidate();
}
function zenComposition(w,h){
 const portrait=w/h<1;
 return {w,h,portrait,cx:w*(portrait?.5:.475),cy:h*(portrait?.525:.525),r:Math.min(w*(portrait?.44:.32),h*.36)};
}
function zenGetImage(portrait){
 const name=zenGardens[zenGarden].asset+'-'+(portrait?'portrait':'wide');
 if(!zenImages.has(name)){
  const im=new Image();im.onload=()=>{zenStaticKey='';if(typeof wakeScene==='function')wakeScene();};im.onerror=()=>{SceneMotion.invalidate();};im.src='assets/garden-'+name+'.webp';zenImages.set(name,im);
 }
 return zenImages.get(name);
}
function zenRand(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function zenStaticScene(L){
 const key=[zenGarden,L.w,L.h,DPR].join(':'),im=zenGetImage(L.portrait);
 if(!zenSandImage){zenSandImage=new Image();zenSandImage.onload=()=>{zenStaticKey='';if(typeof wakeScene==='function')wakeScene();};zenSandImage.src='assets/garden-sand.webp';}
 if(!im.complete||!im.naturalWidth||!zenSandImage.complete||!zenSandImage.naturalWidth)return null;
 if(zenStaticKey===key)return zenStatic;
 const tile=document.getElementById('zen-backdrop');tile.width=cv.width;tile.height=cv.height;
 const c=tile.getContext('2d');c.scale(DPR,DPR);c.drawImage(im,0,0,L.w,L.h);
 const r=L.r,cx=L.cx,cy=L.cy;
 c.fillStyle='rgba(28,45,30,.2)';c.beginPath();c.ellipse(cx+2,cy+r*.035,r*.99,r*.975,0,0,Math.PI*2);c.fill();
 c.save();if(zenGarden==='moon')c.filter='brightness(.78) saturate(.65)';
 c.drawImage(zenSandImage,cx-r*1.05,cy-r*1.05,r*2.1,r*2.1);c.restore();
 // A low-resolution water mask lets fish swim beneath the painted lily pads.
 const mw=Math.min(720,Math.round(L.w)),mh=Math.round(mw*L.h/L.w),mask=document.createElement('canvas');mask.width=mw;mask.height=mh;
 const m=mask.getContext('2d');m.drawImage(im,0,0,mw,mh);const pixels=m.getImageData(0,0,mw,mh),data=pixels.data;
 for(let i=0;i<data.length;i+=4){const R=data[i],G=data[i+1],B=data[i+2],x=(i/4)%mw/mw,y=Math.floor(i/4/mw)/mh;const region=L.portrait?(y>.76||x>.8):(x>.77||y>.8);data[i+3]=region&&B>R*1.03&&G>R*1.05&&B>G*.69?255:0;}
 m.putImageData(pixels,0,0);zenMask=mask;
 zenWater=document.createElement('canvas');zenWater.width=mw;zenWater.height=mh;
 const inner=L.r*.885;Object.assign(zenTrace.style,{width:inner*2+'px',height:inner*2+'px',left:L.cx-inner+'px',top:L.cy-inner+'px'});
 zenStatic=tile;zenStaticKey=key;return tile;
}
function zenDrawKoi(c,x,y,size,angle,t,j){
 c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);
 c.fillStyle='rgba(15,50,49,.2)';c.beginPath();c.ellipse(2,3,19,7,0,0,Math.PI*2);c.fill();
 const wag=Math.sin(t*2.7+j)*5;
 c.fillStyle=j%2?'#c97243':'#f3e6bf';c.strokeStyle='#284c43';c.lineWidth=.75;
 c.beginPath();c.moveTo(-13,0);c.quadraticCurveTo(-21,-4+wag,-27,-7+wag);c.quadraticCurveTo(-23,1+wag,-27,7+wag);c.quadraticCurveTo(-20,4+wag,-13,0);c.fill();c.stroke();
 c.fillStyle='rgba(230,224,179,.7)';for(const sign of [-1,1]){c.beginPath();c.moveTo(1,sign*4);c.quadraticCurveTo(-4,sign*15,-8,sign*6);c.closePath();c.fill();}
 c.fillStyle='#efe7c9';c.beginPath();c.moveTo(18,0);c.bezierCurveTo(13,-10,-8,-10,-16,0);c.bezierCurveTo(-8,10,13,10,18,0);c.fill();c.stroke();
 c.save();c.clip();c.fillStyle=j%2?'#b25536':'#d27b41';c.beginPath();c.ellipse(5,-2,6,5,.4,0,Math.PI*2);c.ellipse(-8,2,4,6,-.3,0,Math.PI*2);c.fill();c.restore();
 c.fillStyle='#253d35';c.beginPath();c.arc(13,-2.8,1,0,Math.PI*2);c.arc(13,2.8,1,0,Math.PI*2);c.fill();c.restore();
}
function zenPond(c,L,t){
 if(!zenWater||!zenMask)return;
 const q=zenWater.getContext('2d');q.setTransform(zenWater.width/L.w,0,0,zenWater.height/L.h,0,0);q.clearRect(0,0,L.w,L.h);
 for(let j=0;j<4;j++){
  const a=t*(.075+j*.008)+j*1.7;
  const cx=L.portrait?.59:(j<2?.925:.74),cy=L.portrait?.89:(j<2?.53:.89),rx=L.portrait?.22:(j<2?.03:.1),ry=L.portrait?.041:(j<2?.18:.036);
  const x=(cx+Math.cos(a)*rx)*L.w,y=(cy+Math.sin(a)*ry)*L.h,angle=Math.atan2(Math.cos(a)*ry*L.h,-Math.sin(a)*rx*L.w);
  zenDrawKoi(q,x,y,Math.min(L.w,L.h)/750*(.7+j*.12),angle,t,j);
 }
 q.strokeStyle=zenGarden==='moon'?'rgba(201,226,212,.2)':'rgba(240,242,196,.27)';q.lineWidth=.8;
 for(let j=0;j<12;j++){
  const age=(t*.13+j*.31)%1,x=L.w*(L.portrait?.3+(j%5)*.13:.84+(j%3)*.05),y=L.h*(L.portrait?.81+(j%4)*.046:.25+(j%6)*.12);
  q.globalAlpha=Math.sin(age*Math.PI)*.6;q.beginPath();q.ellipse(x,y,6+age*21,2+age*7,0,0,Math.PI*2);q.stroke();
 }
 for(const p of zenRipples){const age=t-p.born;if(age>3)continue;q.globalAlpha=(1-age/3)*.6;q.beginPath();q.ellipse(p.x*L.w,p.y*L.h,5+age*22,2+age*12,0,0,Math.PI*2);q.stroke();}
 q.globalAlpha=1;q.setTransform(1,0,0,1,0,0);q.globalCompositeOperation='destination-in';q.drawImage(zenMask,0,0);q.globalCompositeOperation='source-over';
 c.drawImage(zenWater,0,0,L.w,L.h);
}
function zenRippleAt(x,y){zenRipples.push({x:x/cv.clientWidth,y:y/cv.clientHeight,born:SceneMotion.time});if(zenRipples.length>12)zenRipples.shift();}
function zenFoliage(c,L,t,dt){
 SceneMotion.spring(zenBranch,SceneMotion.wind,dt,1.6);
 // A few foreground bamboo shoots bend from their base; the artwork stays still.
 c.save();c.translate(L.w*(L.portrait?.03:.025),L.h*.94);c.rotate(zenBranch.x*.015);
 const unit=Math.min(L.w,L.h)/850;
 c.scale(unit,unit);c.strokeStyle=zenGarden==='moon'?'#244b46':'#375b38';c.lineCap='round';
 for(let j=0;j<3;j++){
  c.lineWidth=5-j;c.beginPath();c.moveTo(j*21,12);c.quadraticCurveTo(j*20-12,-85,j*11+8,-200+j*23);c.stroke();
  for(let k=0;k<5;k++)for(let side of [-1,1]){
   const x=j*15,y=-40-k*29+j*9,len=28+(k%3)*8;
   c.save();c.translate(x,y);c.rotate(side*.65+zenBranch.x*.018*(k+1));c.fillStyle=(j+k)%2?(zenGarden==='moon'?'#42786b':'#5a803e'):(zenGarden==='moon'?'#365f58':'#78964e');
   c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(side*len*.6,-13,side*len,-16);c.quadraticCurveTo(side*len*.75,2,0,0);c.fill();c.lineWidth=.65;c.stroke();c.restore();
  }
 }
 c.restore();
}
function zenAtmosphereLayer(c,L,t,dt){
 const g=zenGardens[zenGarden];zenPetals.update(dt);
 for(const p of zenPetals.items){
  if(p.delay>0||p.alpha<=0)continue;
  const size=(L.portrait?4:6)*p.size,x=p.x*L.w,y=p.y*L.h;
  c.save();c.translate(x,y);c.rotate(p.angle);c.scale(1,.6+.32*Math.abs(Math.cos(p.angle)));c.globalAlpha=p.alpha*.85;c.fillStyle=g.petals[p.kind%3];c.strokeStyle='rgba(69,66,42,.4)';c.lineWidth=.6;
  c.beginPath();c.moveTo(-size,0);c.bezierCurveTo(-size,-size,size*.55,-size*.6,size,0);c.bezierCurveTo(size*.4,size*.85,-size*.6,size*.7,-size,0);c.fill();c.stroke();c.restore();
 }
 zenFoliage(c,L,t,dt);
 // Two soft translucent ribbons, no per-frame blur/filter passes.
 const x=L.w*g.smokePoint[L.portrait?2:0],y=L.h*g.smokePoint[L.portrait?3:1],height=Math.min(L.h*.23,L.w*.36);
 c.save();c.lineCap='round';const smoke=c.createLinearGradient(0,y-height,0,y);smoke.addColorStop(0,'rgba(231,235,211,0)');smoke.addColorStop(.45,'rgba(231,235,211,.09)');smoke.addColorStop(1,'rgba(231,235,211,.19)');c.strokeStyle=smoke;
 for(let ribbon=0;ribbon<3;ribbon++){
  c.globalAlpha=1-ribbon*.2;c.lineWidth=1.5+ribbon*2;c.beginPath();c.moveTo(x,y);
  for(let i=1;i<=32;i++){const u=i/32;c.lineTo(x+Math.sin(t*.45-u*8+ribbon*.5)*u*u*height*.13+SceneMotion.wind*u*height*.1,y-u*height);}
  c.stroke();
 }c.restore();
 // Warm lantern breathing and a handful of moonlit fireflies.
 if(zenGarden==='moon')for(let j=0;j<6;j++){
  const x=L.w*(.08+(j%3)*.025)+Math.sin(t*.25+j)*7,y=L.h*(.63+(j%4)*.045)+Math.cos(t*.2+j)*8;
  c.globalAlpha=.15+.35*Math.pow(.5+.5*Math.sin(t*.5+j),3);c.fillStyle='#edda86';c.beginPath();c.arc(x,y,1.5,0,Math.PI*2);c.fill();
 }
 c.globalAlpha=1;
}
// Small software-shaded sphere: cached normals, garden environment and no full-screen effects.
const zenSteel=document.createElement('canvas');zenSteel.width=zenSteel.height=64;
const zenSteelCtx=zenSteel.getContext('2d'),zenSteelPixels=zenSteelCtx.createImageData(64,64);
const zenSteelNormals=Array.from({length:64*64},(_,i)=>{
 const x=((i%64)+.5-32)/31,y=(Math.floor(i/64)+.5-32)/31,r=x*x+y*y;
 if(r>1)return null;
 const z=Math.sqrt(1-r),rx=2*x*z,ry=2*y*z;
 const light=Math.max(0,-x*.43-y*.57+z*.7);
 return {u:128+rx*122,v:96+ry*90,alpha:Math.round(255*Math.min(1,(1-Math.sqrt(r))*31)),
  base:.34+.66*(.68+.32*Math.tanh(-ry*8)),sky:Math.max(0,-ry)*.7,
  shine:(.42+.58*Math.pow(1-z,3))*30+Math.pow(light,95)*225+Math.pow(light,18)*34,
  finish:Math.sin(x*37+y*12),finishB:Math.cos(x*37+y*12)};
});
let zenSteelEnv=null,zenSteelKey='',zenSteelStamp=-1,zenSteelLastDistance=-1;
function zenShadeSteel(L,p){
 if(zenSteelKey!==zenStaticKey){
  const env=document.createElement('canvas');env.width=256;env.height=192;
  const ec=env.getContext('2d'),soft=document.createElement('canvas');soft.width=32;soft.height=24;
  soft.getContext('2d').drawImage(zenStatic,0,0,32,24);ec.drawImage(soft,0,0,256,192);
  zenSteelEnv=ec.getImageData(0,0,256,192).data;zenSteelKey=zenStaticKey;zenSteelStamp=-1;
 }
 const stamp=Math.floor(zenClock*24);
 if(stamp===zenSteelStamp)return;
 zenSteelStamp=stamp;zenSteelLastDistance=zenDistance;
 const data=zenSteelPixels.data,phase=zenDistance/23,px=(p.x-550)/550*12,py=(p.y-550)/550*9;
 const rollA=.012*Math.cos(phase),rollB=.012*Math.sin(phase);
 for(let i=0;i<zenSteelNormals.length;i++){
  const n=zenSteelNormals[i],o=i*4;if(!n){data[o+3]=0;continue;}
  const u=Math.max(0,Math.min(255,(n.u+px)|0)),v=Math.max(0,Math.min(191,(n.v+py)|0));
  const e=(v*256+u)*4,finish=1+n.finish*rollA+n.finishB*rollB;
  for(let k=0;k<3;k++)data[o+k]=((zenSteelEnv[e+k]*.34+110)*n.base+n.sky*(k===2?65:52))*finish+n.shine;
  data[o+3]=n.alpha;
 }
 zenSteelCtx.putImageData(zenSteelPixels,0,0);
}
function zenBall(c,L){
 const inner=L.r*.885,p=zenPoint(zenDistance),x=L.cx+(p.x-550)/550*inner,y=L.cy+(p.y-550)/550*inner;
 const br=Math.max(7.5,inner*.045),cy=y-br*.28;
 c.save();
 // Broad soft cast shadow plus a tight contact shadow anchor the weight in the sand.
 c.translate(x+br*.38,y+br*.35);c.scale(1,.58);
 const shadow=c.createRadialGradient(0,0,br*.1,0,0,br*1.65);
 shadow.addColorStop(0,'rgba(37,29,18,.46)');shadow.addColorStop(.43,'rgba(48,36,22,.24)');shadow.addColorStop(1,'rgba(48,36,22,0)');
 c.fillStyle=shadow;c.fillRect(-br*1.7,-br*1.7,br*3.4,br*3.4);c.restore();
 c.fillStyle='rgba(48,35,20,.36)';c.beginPath();c.ellipse(x,y+br*.48,br*.62,br*.24,0,0,Math.PI*2);c.fill();
 zenShadeSteel(L,p);c.drawImage(zenSteel,x-br,cy-br,br*2,br*2);
 // Crisp reflected sky on the rim, kept small enough to read as metal rather than glow.
 c.strokeStyle='rgba(241,249,255,.64)';c.lineWidth=Math.max(.55,br*.045);
 c.beginPath();c.arc(x,cy,br*.975,Math.PI*1.03,Math.PI*1.74);c.stroke();
}

function zenFrame(dt){
 if(!zenReady)zenReset();zenClock=SceneMotion.time;
 const c=ctx,w=cv.clientWidth,h=cv.clientHeight,L=zenComposition(w,h),background=zenStaticScene(L);
 c.setTransform(1,0,0,1,0,0);
 if(!background){c.fillStyle='#294939';c.fillRect(0,0,cv.width,cv.height);c.setTransform(DPR,0,0,DPR,0,0);c.fillStyle='#efe3c2';c.font='18px Georgia';c.textAlign='center';c.fillText('Opening the garden…',w/2,h/2);return;}
 if(playing){SceneMotion.spring(zenDrive,34*speed/40,dt,2.5);const previous=zenDistance;zenDistance=Math.min(zenLength,zenDistance+dt*zenDrive.x);zenCarve(previous,zenDistance);if(zenDistance>=zenLength){zenCycle+=dt;if(zenCycle>=14)zenReset();}}
 c.clearRect(0,0,cv.width,cv.height);c.setTransform(DPR,0,0,DPR,0,0);
 if(zenCycle>8)zenTrace.style.opacity=String(1-Math.min(1,(zenCycle-8)/6));
 zenBall(c,L);
 if(zenAtmosphere){zenPond(c,L,zenClock);zenAtmosphereLayer(c,L,zenClock,dt);}
}
