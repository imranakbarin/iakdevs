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
const zenCanopy=[];
function zenPrepareCanopy(iw,ih){
 if(zenCanopy.length)return;
 for(let j=0;j<12;j++){
  const x=iw*(.73+(j%4)*.065),y=ih*(.025+Math.floor(j/4)*.13),rw=iw*.115,rh=ih*.16;
  const tile=document.createElement('canvas');tile.width=Math.ceil(rw);tile.height=Math.ceil(rh);const q=tile.getContext('2d');
  q.drawImage(zenPhoto,x,y,rw,rh,0,0,rw,rh);q.globalCompositeOperation='destination-in';
  const mask=q.createRadialGradient(rw/2,rh/2,0,rw/2,rh/2,Math.max(rw,rh)*.49);
  mask.addColorStop(0,'rgba(0,0,0,1)');mask.addColorStop(.55,'rgba(0,0,0,.95)');mask.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=mask;q.fillRect(0,0,rw,rh);
  zenCanopy.push({tile,x,y,rw,rh});
 }
}
function zenAir(c,iw,ih,t){
 // Wide, soft beams slowly drift with the canopy. The photographic materials stay visible.
 c.save();c.globalCompositeOperation='screen';
 for(let j=0;j<3;j++){
  c.save();c.translate(-iw*.09, -ih*.18);c.rotate(-.38+j*.14);
  const beam=c.createLinearGradient(-iw*.14,0,iw*.14,0);
  beam.addColorStop(0,'rgba(255,233,177,0)');beam.addColorStop(.5,`rgba(255,232,171,${.035+.008*Math.sin(t*.11+j)})`);beam.addColorStop(1,'rgba(255,233,177,0)');
  c.fillStyle=beam;c.fillRect(-iw*.14,0,iw*.28,ih*1.7);c.restore();
 }
 c.restore();
 // Dappled shade shifts almost imperceptibly across the edge of the sand.
 c.save();c.beginPath();c.arc(iw*.4036,ih*.488,ih*.406,0,Math.PI*2);c.clip();
 for(let j=0;j<11;j++){
  const x=iw*(.52+(j%4)*.07)+Math.sin(t*.19+j)*13,y=ih*(.07+Math.floor(j/4)*.09)+Math.cos(t*.14+j)*9;
  const shade=c.createRadialGradient(x,y,0,x,y,ih*.1);shade.addColorStop(0,'rgba(43,53,31,.047)');shade.addColorStop(1,'rgba(43,53,31,0)');
  c.fillStyle=shade;c.fillRect(x-ih*.1,y-ih*.1,ih*.2,ih*.2);
 }
 c.restore();
 // Sparse sunlit motes: subdued highlights, with no flicker or large particle field.
 c.save();for(let j=0;j<15;j++){
  const u=(t/(48+j*1.7)+j*.618)%1,x=iw*(.12+u*.72)+Math.sin(t*.12+j)*13,y=ih*(.17+(j*.137)% .68)+Math.cos(t*.1+j)*16;
  c.globalAlpha=.13+.13*Math.sin(Math.PI*u);c.fillStyle='#fff4d2';c.beginPath();c.arc(x,y,.8+(j%3)*.35,0,Math.PI*2);c.fill();
 }c.restore();
}
// Overhead view: gravity drives descent, a breeze adds small lateral drift.
function zenLeafState(j,t,iw,ih){
 const duration=25+j*4,cycle=Math.floor(t/duration+j*.27),phase=(t/duration+j*.27)%1;
 const u=Math.min(1,phase/.74),fall=(u-(1-Math.exp(-4*u))/4)/(1-(1-Math.exp(-4))/4);
 const variation=Math.sin(cycle*17.3+j*2.8);
 const x=iw*(.73+j*.056-.055*fall)+Math.sin(u*4.2+j+variation)*iw*.012*Math.sin(Math.PI*u);
 const y=ih*(.065+(j%2)*.045+fall*(.59+j*.035));
 const height=1-fall,size=ih*(.035+j*.003)*(1+height*.28);
 const tilt=.76+Math.sin(u*8+j)*.18*height,angle=-.4+j*.67+Math.sin(u*5.7+j)*.5*height;
 const fade=phase<.05?phase/.05:phase>.92?(1-phase)/.08:1;
 return {x,y,size,height,tilt,angle,alpha:Math.max(0,fade),landed:u===1};
}
function zenFallingLeaves(c,iw,ih,t){
 if(!zenLeaf.complete||!zenLeaf.naturalWidth)return;
 for(let j=0;j<4;j++){
  const p=zenLeafState(j,t,iw,ih);
  // The shadow approaches the leaf, sharpens, and darkens as it settles.
  c.save();c.translate(p.x+p.size*(.04+p.height*.4),p.y+p.size*(.05+p.height*.5));c.rotate(p.angle);c.scale(1,p.tilt);c.globalAlpha=p.alpha*(.12+(1-p.height)*.13);c.filter=`brightness(0) blur(${1+p.height*5}px)`;c.drawImage(zenLeaf,-p.size/2,-p.size/2,p.size,p.size);c.restore();
  c.save();c.translate(p.x,p.y);c.rotate(p.angle);c.scale(1,p.tilt);c.globalAlpha=p.alpha;c.drawImage(zenLeaf,-p.size/2,-p.size/2,p.size,p.size);c.restore();
 }
}
function zenFrame(dt){
 if(!zenReady)zenReset();
 if(playing&&zenPhoto.complete&&zenPhoto.naturalWidth){zenClock+=dt;const previous=zenDistance;zenDistance=Math.min(zenLength,zenDistance+dt*22*speed/40);zenCarve(previous,zenDistance);}
 const c=ctx,w=cv.width,h=cv.height;c.setTransform(1,0,0,1,0,0);c.fillStyle='#25251f';c.fillRect(0,0,w,h);
 if(!zenPhoto.complete||!zenPhoto.naturalWidth){c.fillStyle='#ddd4c2';c.font='18px system-ui';c.textAlign='center';c.fillText('Settling into the garden…',w/2,h/2);return;}
 const iw=zenPhoto.naturalWidth,ih=zenPhoto.naturalHeight,s=Math.min(w/iw,h/ih),ox=(w-iw*s)/2,oy=(h-ih*s)/2;
 c.save();c.translate(ox,oy);c.scale(s,s);c.drawImage(zenPhoto,0,0);
 // Feathered foliage patches sway with a shared breeze and individual branch lag.
 const t=zenClock;
 zenPrepareCanopy(iw,ih);
 zenCanopy.forEach(({tile,x,y,rw,rh},j)=>{const wind=Math.sin(t*.47)+.32*Math.sin(t*.91+j*.35);c.save();c.translate(x+rw/2+wind*1.6,y+rh/2+Math.sin(t*.39+j*.6)*1.7);c.rotate(wind*.003);c.drawImage(tile,-rw/2,-rh/2,rw,rh);c.restore();});
 const cx=iw*.4036,cy=ih*.488,r=ih*.408;
 c.save();c.beginPath();c.arc(cx,cy,r-2,0,Math.PI*2);c.clip();c.drawImage(zenTrace,cx-r,cy-r,r*2,r*2);c.restore();
 const p=zenPoint(zenDistance),x=cx+(p.x-550)/550*r,y=cy+(p.y-550)/550*r,br=ih*.013;
 // The ball sits in the sand: ambient contact shadow and a longer soft sun shadow.
 c.save();c.translate(x,y);c.fillStyle='rgba(28,24,18,.24)';c.filter='blur(4px)';c.beginPath();c.ellipse(br*.55,br*.7,br*1.18,br*.73,.5,0,Math.PI*2);c.fill();c.filter='none';
 c.fillStyle='rgba(42,33,22,.42)';c.beginPath();c.ellipse(1,br*.5,br*.83,br*.47,0,0,Math.PI*2);c.fill();
 c.beginPath();c.arc(0,-br*.3,br,0,Math.PI*2);c.clip();
 const steel=c.createLinearGradient(-br,-br*1.3,br,br*.7);
 [[0,'#f9faf6'],[.17,'#d7ddd8'],[.33,'#7f8987'],[.43,'#293b38'],[.5,'#d4d6c9'],[.64,'#f0e7d3'],[.86,'#777b76'],[1,'#28312f']].forEach(([v,col])=>steel.addColorStop(v,col));c.fillStyle=steel;c.fillRect(-br,-br*1.3,br*2,br*2);
 const shine=c.createRadialGradient(-br*.37,-br*.78,0,0,-br*.3,br*1.2);shine.addColorStop(0,'rgba(255,255,255,.95)');shine.addColorStop(.25,'rgba(255,255,255,.15)');shine.addColorStop(.7,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(12,22,20,.5)');c.fillStyle=shine;c.fillRect(-br,-br*1.3,br*2,br*2);
 c.restore();
 // A fallen leaf stirs independently of the canopy, without ever entering the tray.
 const lx=iw*.84,ly=ih*.75,lw=iw*.09,lh=ih*.11;
 c.save();c.beginPath();c.ellipse(lx,ly,lw*.48,lh*.48,0,0,Math.PI*2);c.clip();c.translate(lx,ly);c.rotate(Math.sin(t*.7)*.015);c.drawImage(zenPhoto,lx-lw/2-3,ly-lh/2-3,lw+6,lh+6,-lw/2-3,-lh/2-3,lw+6,lh+6);c.restore();
 zenAir(c,iw,ih,t);
 zenFallingLeaves(c,iw,ih,t);
 c.restore();
 // A completed pattern is held, then gently dissolved before a new continuous drawing.
 if(zenDistance>=zenLength&&playing){zenCycle+=dt;if(zenCycle>8){c.save();c.globalAlpha=Math.min(1,(zenCycle-8)/6);c.drawImage(zenPhoto,ox,oy,iw*s,ih*s);c.restore();if(zenCycle>=14)zenReset();}}
}
