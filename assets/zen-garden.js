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
 for(const [width,color,dx,dy] of [[11,'rgba(255,246,215,.50)',1.6,1.6],[7,'rgba(94,67,39,.42)',-.8,-.8],[3.5,'rgba(103,77,44,.36)',0,0],[1.4,'rgba(255,249,224,.85)',3,3]]){
  zc.beginPath();pts.forEach((p,i)=>i?zc.lineTo(p.x+dx,p.y+dy):zc.moveTo(p.x+dx,p.y+dy));zc.strokeStyle=color;zc.lineWidth=width;zc.stroke();
 }
}

const zenGardens={
 moss:{asset:'koi',springPoint:[.923,.82,.928,.842],sand:'#ecdbb8',rim:['#a7623d','#bb7750','#975637'],ink:'#344735',petals:['#e8b3a5','#f1c7b7','#d99283'],smoke:'#efe2bf'},
 autumn:{asset:'autumn',springPoint:[.923,.82,.927,.856],sand:'#ead3a5',rim:['#975139','#ad6341','#bd7c4c'],ink:'#4c4930',petals:['#d47436','#c65432','#e7a447'],smoke:'#f6ddad'},
 moon:{asset:'moon',springPoint:[.921,.817,.892,.829],sand:'#c4c8b9',rim:['#6f827c','#84958b','#586d67'],ink:'#203e42',petals:['#dfd4d0','#c9c9d8','#ece7d7'],smoke:'#c8dbd7'}
};
let zenGarden='moss',zenAtmosphere=true,zenStaticKey='',zenStatic=null,zenMask=null,zenWater=null;
let zenSandImage;
const zenImages=new Map(),zenPetals=SceneMotion.particles(22,143),zenRipples=[];
zenPetals.items.forEach((p,i)=>{p.y=.08-(i%6)*.045;p.delay=i*.8;});
const zenDrive={x:34,v:0},zenBranch={x:0,v:0};
function zenSetGarden(key){if(!zenGardens[key])return;zenGarden=key;zenStaticKey='';SceneMotion.invalidate();}
function zenReset(){
 zenPattern=document.getElementById('zen-pattern')?.value||'spiral';zenBuildPath(zenPattern);
 zc.clearRect(0,0,1100,1100);zenTrace.style.opacity='1';zenDistance=0;zenCycle=0;zenRollQ=[0,0,0,1];zenRollIndex=0;zenRollRadius=0;zenSteelStamp=-1;zenSteelLastDistance=-1;zenReady=true;zenDrive.x=0;zenDrive.v=0;
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
// The spring occupies the old incense island, with its entire silhouette covered.
function zenSpringComposition(L){
 const a=zenGardens[zenGarden].springPoint,k=L.portrait?2:0;
 const rx=Math.min(L.w*(L.portrait?.115:.087),L.h*.115),ry=L.h*(L.portrait?.066:.082);
 return {x:Math.min(L.w*a[k],L.w-rx*.8),y:L.h*(a[k+1]+.055),rx,ry,waterX:rx*.73,waterY:ry*.59};
}
function zenSpringBed(c,L){
 const P=zenSpringComposition(L),rnd=zenRand(683),moon=zenGarden==='moon';
 c.save();c.translate(P.x,P.y);
 // A complete opaque granite island replaces the painted vessel, including its lid.
 const rock=c.createLinearGradient(-P.rx,-P.ry,P.rx,P.ry);rock.addColorStop(0,moon?'#87978c':'#a0a487');rock.addColorStop(.5,moon?'#465e58':'#6b735a');rock.addColorStop(1,moon?'#293f3d':'#414c3c');
 c.fillStyle=rock;c.beginPath();c.ellipse(0,0,P.rx,P.ry,0,0,Math.PI*2);c.fill();
 c.save();c.clip();for(let i=0;i<1100;i++){c.globalAlpha=.08+rnd()*.17;c.fillStyle=i%2?'#e5dbb3':'#213c32';c.fillRect((rnd()*2-1)*P.rx,(rnd()*2-1)*P.ry,.6+rnd()*2.2,.5+rnd()*1.3);}c.restore();
 const water=c.createLinearGradient(0,-P.waterY,0,P.waterY);water.addColorStop(0,moon?'#142e36':'#173e3d');water.addColorStop(.58,moon?'#34696c':'#357e76');water.addColorStop(1,moon?'#73a3a2':'#88b7a3');
 c.fillStyle=water;c.beginPath();c.ellipse(0,0,P.waterX,P.waterY,0,0,Math.PI*2);c.fill();
 c.lineWidth=Math.max(1.5,P.rx*.043);c.strokeStyle='#263d32';c.stroke();
 for(let j=0;j<16;j++){
  const a=j/16*Math.PI*2,x=Math.cos(a)*P.rx*.85,y=Math.sin(a)*P.ry*.8,r=P.rx*(.12+rnd()*.035);
  const light=c.createLinearGradient(x-r,y-r,x+r,y+r);light.addColorStop(0,moon?'#a4b1a0':'#c3bb97');light.addColorStop(.45,moon?'#708579':'#8c9475');light.addColorStop(1,moon?'#3f5952':'#485d42');
  c.fillStyle=light;c.strokeStyle='rgba(29,49,36,.45)';c.lineWidth=.8;c.beginPath();
  for(let k=0;k<8;k++){const ang=k/8*Math.PI*2,rr=r*(.78+rnd()*.23),px=x+Math.cos(ang)*rr,py=y+Math.sin(ang)*rr*.8;k?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fill();c.stroke();
  c.save();c.clip();for(let k=0;k<90;k++){c.fillStyle=k%3?'rgba(225,213,168,.16)':'rgba(20,43,34,.22)';c.fillRect(x+(rnd()*2-1)*r,y+(rnd()*2-1)*r,1+rnd()*2,.6+rnd());}c.restore();
  c.strokeStyle='rgba(222,223,178,.25)';c.beginPath();c.moveTo(x-r*.4,y-r*.2);c.lineTo(x+r*.2,y-r*.4);c.stroke();
 }
 // Small moss tufts and fern fronds soften the exposed stones and irregular bank.
 for(let j=0;j<60;j++){
  const a=rnd()*Math.PI*2,x=Math.cos(a)*P.rx*(.78+rnd()*.17),y=Math.sin(a)*P.ry*(.8+rnd()*.16);
  c.fillStyle=moon?(j%2?'#597c65':'#344c42'):(j%2?'#809541':'#405d31');
  c.beginPath();c.ellipse(x,y,1+rnd()*3,1+rnd()*2,a,0,Math.PI*2);c.fill();
 }
 for(let j=0;j<7;j++){
  const a=2+j*.22,x=Math.cos(a)*P.rx*.96,y=Math.sin(a)*P.ry*.94;
  c.save();c.translate(x,y);c.rotate(-.8+j*.17);c.strokeStyle=moon?'#648b6f':'#829c44';c.lineWidth=.7;
  c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-3,-12,3,-26);c.stroke();
  for(let k=0;k<5;k++)for(let side of [-1,1]){const yy=-k*4,len=6-k*.65;c.fillStyle=k%2?(moon?'#648b6f':'#9bb356'):(moon?'#405d4e':'#577334');c.beginPath();c.moveTo(0,yy);c.quadraticCurveTo(side*len*.7,yy-5,side*len,yy-5);c.quadraticCurveTo(side*len,yy,0,yy);c.fill();}
  c.restore();
 }
 c.restore();
}
function zenSpringWater(c,L,t){
 const P=zenSpringComposition(L);
 c.save();c.translate(P.x,P.y);c.beginPath();c.ellipse(0,0,P.waterX-1,P.waterY-1,0,0,Math.PI*2);c.clip();
 // Broad reflected canopy bands drift slowly; small rings expand from the warm source.
 c.lineCap='round';
 for(let j=0;j<6;j++){
  const y=(j/5-.5)*P.waterY*1.8+Math.sin(t*.35+j)*P.waterY*.05;
  c.strokeStyle=j%2?'rgba(175,218,185,.18)':'rgba(17,48,49,.22)';c.lineWidth=.8+j%2*.6;
  c.beginPath();c.moveTo(-P.waterX,y);c.bezierCurveTo(-P.waterX*.4,y+Math.sin(t*.4+j)*4,P.waterX*.3,y-3,P.waterX,y+2);c.stroke();
 }
 for(let j=0;j<4;j++){
  const phase=(t*.12+j*.25)%1;c.globalAlpha=Math.sin(phase*Math.PI)*.48;c.lineWidth=.8;c.strokeStyle=zenGarden==='moon'?'#b5dfda':'#d2edcc';c.beginPath();c.ellipse(-P.waterX*.18,P.waterY*.03,P.waterX*(.06+phase*.82),P.waterY*(.04+phase*.7),0,0,Math.PI*2);c.stroke();
 }
 c.restore();
}
function zenSpringSteam(c,L,t){
 const P=zenSpringComposition(L),height=Math.min(L.h*.22,L.w*.34),cool=zenGarden==='moon';
 c.save();c.lineCap='round';
 // Translucent volume rises from several points across the water, then widens and fades.
 // The moving phase travels upward, rather than oscillating a fixed incense ribbon.
 for(let j=0;j<5;j++){
  const x=P.x+P.waterX*(j/4-.5),y=P.y-P.waterY*.08,phase=t*.22+j*1.27;
  const steam=c.createLinearGradient(0,y-height,0,y);steam.addColorStop(0,'rgba(220,238,231,0)');steam.addColorStop(.3,cool?'rgba(207,230,237,.045)':'rgba(246,244,217,.065)');steam.addColorStop(.73,cool?'rgba(221,236,238,.1)':'rgba(249,248,229,.14)');steam.addColorStop(1,'rgba(238,243,224,0)');
  c.strokeStyle=steam;c.globalAlpha=.7+.2*Math.sin(phase);c.lineWidth=P.waterX*(.16+j%2*.09);
  c.beginPath();c.moveTo(x,y);
  for(let i=1;i<=24;i++){const u=i/24;c.lineTo(x+Math.sin(phase-u*5)*height*u*.13+SceneMotion.wind*u*u*height*.22,y-u*height);}
  c.stroke();
 }c.restore();
}
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
 // Light falls across a recessed sand bed; the inner lip occludes the upper edge.
 c.save();c.beginPath();c.arc(cx,cy,r*.885,0,Math.PI*2);c.clip();
 const bed=c.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
 bed.addColorStop(0,'rgba(36,28,19,.28)');bed.addColorStop(.22,'rgba(71,50,25,.06)');bed.addColorStop(.58,'rgba(255,245,211,.10)');bed.addColorStop(1,'rgba(88,61,26,.16)');
 c.fillStyle=bed;c.fillRect(cx-r,cy-r,r*2,r*2);
 const lip=c.createRadialGradient(cx+r*.025,cy+r*.035,r*.78,cx,cy,r*.89);
 lip.addColorStop(0,'rgba(36,26,14,0)');lip.addColorStop(.77,'rgba(36,26,14,.06)');lip.addColorStop(1,'rgba(36,26,14,.40)');
 c.fillStyle=lip;c.fillRect(cx-r,cy-r,r*2,r*2);c.restore();
 zenSpringBed(c,L);
 // A low-resolution water mask lets fish swim beneath the painted lily pads.
 const mw=Math.min(720,Math.round(L.w)),mh=Math.round(mw*L.h/L.w),mask=document.createElement('canvas');mask.width=mw;mask.height=mh;
 const m=mask.getContext('2d');m.drawImage(tile,0,0,mw,mh);const pixels=m.getImageData(0,0,mw,mh),data=pixels.data;
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
   c.save();c.translate(x,y);c.rotate(side*.65+zenBranch.x*.024*(k+1)+Math.sin(t*.72+j*.9+k*.35)*.025);c.fillStyle=(j+k)%2?(zenGarden==='moon'?'#42786b':'#5a803e'):(zenGarden==='moon'?'#365f58':'#78964e');
   c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(side*len*.6,-13,side*len,-16);c.quadraticCurveTo(side*len*.75,2,0,0);c.fill();c.lineWidth=.65;c.stroke();c.restore();
  }
 }
 c.restore();
}
function zenSpringFerns(c,L,t){
 const P=zenSpringComposition(L),scale=Math.min(L.w,L.h)/660;
 c.save();c.translate(P.x-P.rx*.89,P.y+P.ry*.3);c.scale(scale,scale);
 for(let j=0;j<3;j++){
  c.save();c.rotate(-.7+j*.37+zenBranch.x*.04+Math.sin(t*.6+j)*.022);
  c.strokeStyle=zenGarden==='moon'?'#638c70':'#799744';c.lineWidth=.9;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-5,-24,5,-49+j*5);c.stroke();
  for(let k=0;k<8;k++)for(let side of [-1,1]){
   const y=-k*5,len=11-k*.95;c.fillStyle=k%2?(zenGarden==='moon'?'#567e67':'#8fae51'):(zenGarden==='moon'?'#355747':'#4c7135');
   c.beginPath();c.moveTo(0,y);c.quadraticCurveTo(side*len*.6,y-7,side*len,y-6);c.quadraticCurveTo(side*len*.7,y+1,0,y);c.fill();
  }c.restore();
 }c.restore();
}
function zenAtmosphereLayer(c,L,t,dt){
 const g=zenGardens[zenGarden];zenPetals.update(dt);
 // Sun shafts breathe slowly with the canopy; moonlight stays cool and restrained.
 c.save();
 for(let j=0;j<3;j++){
  const drift=Math.sin(t*.075+j*.8)*L.w*.025,x=L.w*(.13+j*.18)+drift;
  const ray=c.createLinearGradient(x,0,x+L.w*.34,L.h);
  const warmth=zenGarden==='moon'?'188,216,224':'255,231,166';
  ray.addColorStop(0,'rgba('+warmth+',0)');ray.addColorStop(.32,'rgba('+warmth+','+(.026+.012*Math.sin(t*.12+j))+')');ray.addColorStop(1,'rgba('+warmth+',0)');
  c.fillStyle=ray;c.beginPath();c.moveTo(x,0);c.lineTo(x+L.w*.055,0);c.lineTo(x+L.w*.5,L.h);c.lineTo(x+L.w*.29,L.h);c.closePath();c.fill();
 }
 c.restore();
 for(const p of zenPetals.items){
  if(p.delay>0||p.alpha<=0)continue;
  const size=(L.portrait?4:6)*p.size,x=p.x*L.w,y=p.y*L.h;
  const altitude=Math.max(0,p.ground-p.y),shadowOffset=altitude*L.h*.13;
  c.save();c.beginPath();c.arc(L.cx,L.cy,L.r*.87,0,Math.PI*2);c.clip();
  c.globalAlpha=p.alpha*(.07+.16*(1-altitude));c.fillStyle='#6b624b';c.beginPath();c.ellipse(x+shadowOffset,y+shadowOffset,size*(.7+altitude),size*.35,p.angle,0,Math.PI*2);c.fill();c.restore();
  c.save();c.translate(x+Math.sin(p.angle*1.4)*size*.5,y);c.rotate(p.angle*.55);c.scale(1,.18+.72*Math.abs(Math.cos(p.angle)));c.globalAlpha=p.alpha*.85;c.fillStyle=g.petals[p.kind%3];c.strokeStyle='rgba(69,66,42,.4)';c.lineWidth=.6;
  c.beginPath();c.moveTo(-size,0);c.bezierCurveTo(-size,-size,size*.55,-size*.6,size,0);c.bezierCurveTo(size*.4,size*.85,-size*.6,size*.7,-size,0);c.fill();c.stroke();c.beginPath();c.moveTo(-size*.75,0);c.lineTo(size*.8,0);c.stroke();c.restore();
 }
 zenFoliage(c,L,t,dt);
 zenSpringFerns(c,L,t);
 zenSpringSteam(c,L,t);
 // Warm lantern breathing and a handful of moonlit fireflies.
 if(zenGarden==='moon')for(let j=0;j<6;j++){
  const x=L.w*(.08+(j%3)*.025)+Math.sin(t*.25+j)*7,y=L.h*(.63+(j%4)*.045)+Math.cos(t*.2+j)*8;
  c.globalAlpha=.15+.35*Math.pow(.5+.5*Math.sin(t*.5+j),3);c.fillStyle='#edda86';c.beginPath();c.arc(x,y,1.5,0,Math.PI*2);c.fill();
 }
 c.globalAlpha=1;
}
// Local 3D renderer: ray/sphere normals, reflected world directions and quaternion rolling.
// Only a 96px sprite is shaded; the garden remains in its inexpensive cached layers.
const zenSteel=document.createElement('canvas');zenSteel.width=zenSteel.height=96;
const zenSteelCtx=zenSteel.getContext('2d'),zenSteelPixels=zenSteelCtx.createImageData(96,96);
const zenSteelNormals=Array.from({length:96*96},(_,i)=>{
 const x=((i%96)+.5-48)/47.5,y=(Math.floor(i/96)+.5-48)/47.5,r=x*x+y*y;
 if(r>1)return null;
 const z=Math.sqrt(1-r),wx=x,wy=y*.572-z*.82,wz=-y*.82+z*.572;
 // Reflect the view ray around the actual sphere normal in a world with Z pointing up.
 const rx=2*z*wx,ry=2*z*wy+.82,rz=2*z*wz-.572;
 const light=Math.max(0,x*-.38+y*-.55+z*.744);
 return {x,y,z,rx,ry,rz,alpha:Math.round(255*Math.min(1,(1-Math.sqrt(r))*47.5)),
  fresnel:.56+.44*Math.pow(1-z,5),spec:Math.pow(light,110)*105+Math.pow(light,20)*13};
});
let zenSteelKey='',zenSteelStamp=-1,zenSteelLastDistance=-1,zenSteelColors=null,zenSteelSurface=zenSteel;
let zenRollQ=[0,0,0,1],zenRollIndex=0,zenRollRadius=0,zenRenderQ=[0,0,0,1];
function zenRollMultiply(a,b){
 const [x,y,z,w]=a,[X,Y,Z,W]=b;
 return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];
}
function zenRollStep(q,a,b,radius){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<1e-10)return q;
 const angle=length/radius,si=Math.sin(angle*.5)/length;
 const next=zenRollMultiply([dy*si,-dx*si,0,Math.cos(angle*.5)],q),norm=Math.hypot(...next);
 return next.map(v=>v/norm);
}
function zenRollingOrientation(distance,radius){
 // Integrate at fixed arc-length samples, so orientation does not depend on refresh rate.
 const step=2,index=Math.floor(distance/step);
 if(index<zenRollIndex||Math.abs(radius-zenRollRadius)>.001){zenRollQ=[0,0,0,1];zenRollIndex=0;zenRollRadius=radius;}
 while(zenRollIndex<index){const d=zenRollIndex*step;zenRollQ=zenRollStep(zenRollQ,zenPoint(d),zenPoint(d+step),radius);zenRollIndex++;}
 zenRenderQ=zenRollStep(zenRollQ,zenPoint(index*step),zenPoint(distance),radius);return zenRenderQ;
}
function zenChromeEnvironment(n,garden){
 const moon=garden==='moon',autumn=garden==='autumn',z=n.rz;
 let col;
 if(z>.02){
  const sky=Math.min(1,z*1.7);col=[154+sky*78,177+sky*61,193+sky*51];
  // Broad soft canopy silhouettes in the world, rather than a picture pasted onto the ball.
  const canopy=Math.pow(Math.max(0,1-z*3.5),2)*(.35+.65*Math.pow(.5+.5*Math.sin(n.rx*7+n.ry*4),3));
  col=col.map((v,k)=>v*(1-canopy*.66)+[61,76,64][k]*canopy*.66);
 }else{
  const earth=Math.min(1,-z*2.4);col=[72+earth*72,92+earth*69,96+earth*55];
  const band=Math.exp(-Math.pow((z+.04)*13,2))*.48;
  col=col.map((v,k)=>v*(1-band)+[43,51,48][k]*band);
 }
 const horizon=Math.exp(-Math.pow((z-.08)*5.5,2))*.82;
 col=col.map((v,k)=>v*(1-horizon)+[25,35,32][k]*horizon);
 // A large rectangular skylight reflected in the curved upper hemisphere.
 const area=Math.exp(-Math.pow((n.rx+.34)*5.5,4)-Math.pow((n.rz-.72)*4,4))*.55;
 col=col.map((v,k)=>v*(1-area)+[250,253,255][k]*area);
 if(autumn)col=col.map((v,k)=>v+[9,2,-6][k]);
 if(moon)col=col.map((v,k)=>v*.78+[0,7,17][k]);
 return col;
}
function zenShadeSteel(L,p,radius){
 if(zenSteelKey!==zenGarden){zenSteelColors=zenSteelNormals.map(n=>n?zenChromeEnvironment(n,zenGarden):null);zenSteelKey=zenGarden;zenSteelStamp=-1;}
 const stamp=Math.floor(zenClock*30);
 if(stamp===zenSteelStamp)return;
 zenSteelStamp=stamp;zenSteelLastDistance=zenDistance;
 const orientation=zenRollingOrientation(zenDistance,radius);
 const gpu=typeof ZenSteelGPU!=='undefined'?ZenSteelGPU.render(orientation,zenSteelColors,zenSteelNormals,zenGarden):null;
 if(gpu){zenSteelSurface=gpu;if(cv.dataset)cv.dataset.ballRenderer='webgl-3d';return;}
 zenSteelSurface=zenSteel;if(cv.dataset)cv.dataset.ballRenderer='software-3d';
 const [qx,qy,qz,qw]=orientation,data=zenSteelPixels.data;
 for(let i=0;i<zenSteelNormals.length;i++){
  const n=zenSteelNormals[i],o=i*4;if(!n){data[o+3]=0;continue;}
  // Inverse quaternion maps world-space normals into the rotating steel surface.
  const nx=n.x,ny=n.y*.572-n.z*.82,nz=-n.y*.82+n.z*.572;
  const tx=2*(-qy*nz+qz*ny),ty=2*(-qz*nx+qx*nz),tz=2*(-qx*ny+qy*nx);
  const x=nx+qw*tx-qy*tz+qz*ty,y=ny+qw*ty-qz*tx+qx*tz,z=nz+qw*tz-qx*ty+qy*tx;
  // Polished machining arcs and one faint finish variation make rotation visible.
  // Reflections remain world-locked: spinning the highlight would be physically incorrect.
  const brushed=Math.sin(y*40+x*6)*.011;
  const arc=Math.max(0,1-Math.abs((y-.26)*43))**2*.12;
  const witness=Math.max(0,1-((x-.48)**2+(y+.33)**2+(z-.81)**2)*95)**3*.24;
  const finish=1+brushed-arc-witness,col=zenSteelColors[i];
  for(let k=0;k<3;k++)data[o+k]=Math.min(255,(col[k]*finish*(.84+n.fresnel*.16))+n.spec);
  data[o+3]=n.alpha;
 }
 zenSteelCtx.putImageData(zenSteelPixels,0,0);
}
function zenBall(c,L){
 const inner=L.r*.885,p=zenPoint(zenDistance),x=L.cx+(p.x-550)/550*inner,y=L.cy+(p.y-550)/550*inner;
 const br=Math.max(10,inner*.078),cy=y-br*.52;
 c.save();
 // Broad soft cast shadow plus a tight contact shadow anchor the weight in the sand.
 c.translate(x+br*.38,y+br*.35);c.scale(1,.58);
 const shadow=c.createRadialGradient(0,0,br*.1,0,0,br*1.65);
 shadow.addColorStop(0,'rgba(37,29,18,.46)');shadow.addColorStop(.43,'rgba(48,36,22,.24)');shadow.addColorStop(1,'rgba(48,36,22,0)');
 c.fillStyle=shadow;c.fillRect(-br*1.7,-br*1.7,br*3.4,br*3.4);c.restore();
 c.fillStyle='rgba(48,35,20,.36)';c.beginPath();c.ellipse(x,y+br*.48,br*.62,br*.24,0,0,Math.PI*2);c.fill();
 zenShadeSteel(L,p,br/inner*550);c.drawImage(zenSteelSurface,x-br,cy-br,br*2,br*2);
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
 if(zenAtmosphere){zenPond(c,L,zenClock);zenSpringWater(c,L,zenClock);zenAtmosphereLayer(c,L,zenClock,dt);}
}
