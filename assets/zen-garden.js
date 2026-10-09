/* A persistent, distance-driven sand trace. No moving photograph or looping video. */
const zenPhoto=new Image();zenPhoto.src='assets/zen-garden.jpg';
const zenTrace=document.createElement('canvas');zenTrace.width=zenTrace.height=1100;
const zc=zenTrace.getContext('2d');
let zenClock=0,zenDistance=0,zenPath=[],zenLength=0,zenReady=false,zenPattern='spiral',zenCycle=0;
function zenBuildPath(pattern){
 const raw=[];const turns=pattern==='spiral'?12:pattern==='petals'?9:7;
 for(let i=0;i<=16000;i++){
  const u=i/16000,a=u*Math.PI*2*turns;
  let r;
  if(pattern==='spiral')r=.08+.82*(.5-.5*Math.cos(u*Math.PI*2));
  else if(pattern==='petals')r=.18+.70*(.5+.5*Math.cos(a*5/9));
  else r=.12+.76*(.5+.5*Math.sin(a*3/7));
  raw.push({x:550+Math.cos(a)*r*510,y:550+Math.sin(a)*r*510});
 }
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
 zc.lineCap=zc.lineJoin='round';
 // Sand pushed to the edges, a shaded trough, then a narrow lit lip.
 for(const [width,color,dx,dy] of [[9,'rgba(112,89,58,.15)',1.6,2],[7,'rgba(255,250,224,.72)',-1.2,-1.6],[5.6,'rgba(117,94,64,.42)',0,0],[2.2,'rgba(151,127,91,.28)',.3,.8]]){
  zc.beginPath();pts.forEach((p,i)=>i?zc.lineTo(p.x+dx,p.y+dy):zc.moveTo(p.x+dx,p.y+dy));zc.strokeStyle=color;zc.lineWidth=width;zc.stroke();
 }
}
function zenReset(){
 zenBuildPath(document.getElementById('zen-pattern')?.value||zenPattern);zc.clearRect(0,0,1100,1100);
 zenDistance=0;zenClock=0;zenCycle=0;zenReady=true;
 // Start with a few existing turns, so the texture and purpose are visible immediately.
 const initial=Math.min(zenLength*.15,1800);zenCarve(0,initial);zenDistance=initial;
}
function zenFrame(dt){
 if(!zenReady)zenReset();
 if(playing){zenClock+=dt;const previous=zenDistance;zenDistance=Math.min(zenLength,zenDistance+dt*22*speed/40);zenCarve(previous,zenDistance);}
 const c=ctx,w=cv.width,h=cv.height;c.setTransform(1,0,0,1,0,0);c.fillStyle='#25251f';c.fillRect(0,0,w,h);
 if(!zenPhoto.complete||!zenPhoto.naturalWidth){c.fillStyle='#ddd4c2';c.font='18px system-ui';c.textAlign='center';c.fillText('Settling into the garden…',w/2,h/2);return;}
 const iw=zenPhoto.naturalWidth,ih=zenPhoto.naturalHeight,s=Math.min(w/iw,h/ih),ox=(w-iw*s)/2,oy=(h-ih*s)/2;
 c.save();c.translate(ox,oy);c.scale(s,s);c.drawImage(zenPhoto,0,0);
 // Subtle canopy movement: small individual regions, feathered into the original photo.
 const t=zenClock;
 for(let j=0;j<8;j++){
  const x=iw*(.775+(j%3)*.048),y=ih*(.12+Math.floor(j/3)*.092),rw=iw*.075,rh=ih*.105;
  c.save();c.beginPath();c.ellipse(x+rw/2,y+rh/2,rw*.42,rh*.42,0,0,Math.PI*2);c.clip();
  c.translate(Math.sin(t*.65+j*.8)*1.4,Math.cos(t*.53+j)*.8);c.drawImage(zenPhoto,x-3,y-3,rw+6,rh+6,x-3,y-3,rw+6,rh+6);c.restore();
 }
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
 c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=.6;for(let j=0;j<7;j++){c.beginPath();c.ellipse(Math.sin(zenDistance/br+j)*br*.5,-br*.3,br*.65,br*.94,zenDistance/br*.02,0,Math.PI*2);c.stroke();}c.restore();
 // A fallen leaf stirs independently of the canopy, without ever entering the tray.
 const lx=iw*.84,ly=ih*.75,lw=iw*.09,lh=ih*.11;
 c.save();c.beginPath();c.ellipse(lx,ly,lw*.48,lh*.48,0,0,Math.PI*2);c.clip();c.translate(lx,ly);c.rotate(Math.sin(t*.7)*.015);c.drawImage(zenPhoto,lx-lw/2-3,ly-lh/2-3,lw+6,lh+6,-lw/2-3,-lh/2-3,lw+6,lh+6);c.restore();
 c.restore();
 // A completed pattern is held, then gently dissolved before a new continuous drawing.
 if(zenDistance>=zenLength&&playing){zenCycle+=dt;if(zenCycle>8){c.save();c.globalAlpha=Math.min(1,(zenCycle-8)/6);c.drawImage(zenPhoto,ox,oy,iw*s,ih*s);c.restore();if(zenCycle>=14)zenReset();}}
}
