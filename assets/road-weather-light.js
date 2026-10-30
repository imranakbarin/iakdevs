/* Bounded precipitation layers and live environment reflections (from the previous frame). No pixel readback. */
const RoadWeather=(()=>{
 const env=document.createElement('canvas'),finish=document.createElement('canvas');env.width=256;env.height=128;
 let atmosphere={sun:1,rain:0,snow:0,night:0,sunset:0,fog:0},time=0;
 let n=713;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 const cloud=document.createElement('canvas');cloud.width=512;cloud.height=192;const cg=cloud.getContext('2d');for(let i=0;i<45;i++){const x=random()*512,y=random()*130,r=35+random()*90,g=cg.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(158,171,178,.55)');g.addColorStop(1,'rgba(158,171,178,0)');cg.fillStyle=g;cg.fillRect(x-r,y-r,r*2,r*2);}
 const particles=Array.from({length:110},()=>({x:random(),y:random(),depth:random(),speed:.7+random()*.6,phase:random()*6.28}));
 // The reflections come from the previous frame, copied by snap() before the next one starts
 // drawing: copying the frame still being drawn made the GPU finish it mid-frame (~20 ms).
 let source=null;
 function capture(c,w,h,a,t){atmosphere=a;time=t;source={canvas:c.canvas,w,h};}
 function snap(){if(!source)return;const g=env.getContext('2d');g.clearRect(0,0,256,128);g.drawImage(source.canvas,0,0,source.w,source.h*.75,0,0,256,128);}
 function lit(hex){if(!hex.startsWith('#')||hex.length!==7)return hex;const v=parseInt(hex.slice(1),16),dark=1-atmosphere.night*.58-atmosphere.rain*.13-atmosphere.fog*.07;return '#'+[16,8,0].map((s,i)=>Math.max(0,Math.min(255,Math.round(((v>>s)&255)*dark+[18,3,-9][i]*atmosphere.sunset+[0,3,9][i]*atmosphere.rain))).toString(16).padStart(2,'0')).join('');}
 function reflect(c,points,glass=false){
  const p=points[0],q=points[1],r=points[3];if(!glass&&Math.abs(q.y-p.y)>Math.abs(q.x-p.x)*.3)return;c.save();c.clip();c.globalAlpha=(glass?.32:.09+atmosphere.rain*.08)*(1-atmosphere.night*.65);c.globalCompositeOperation=glass?'source-over':'soft-light';c.transform((q.x-p.x)/256,(q.y-p.y)/256,(r.x-p.x)/128,(r.y-p.y)/128,p.x,p.y);c.translate(256,0);c.scale(-1,1);c.drawImage(env,0,0);c.restore();
 }
 function paintedCar(sprite){
  const w=Math.min(320,sprite.width),h=Math.round(w*sprite.height/sprite.width);if(finish.width!==w||finish.height!==h){finish.width=w;finish.height=h;}
  const g=finish.getContext('2d');g.clearRect(0,0,w,h);g.drawImage(sprite,0,0,w,h);g.save();g.globalCompositeOperation='source-atop';
  g.fillStyle='#142b3c';g.globalAlpha=atmosphere.night*.52+atmosphere.rain*.13;g.fillRect(0,0,w,h);
  g.fillStyle='#e7ad68';g.globalAlpha=atmosphere.sunset*.13;g.fillRect(0,0,w,h);
  g.globalAlpha=.13+atmosphere.rain*.10;g.globalCompositeOperation='soft-light';g.translate(w,0);g.scale(-1,1);g.drawImage(env,0,h*.18,w,h*.66);g.restore();
  g.save();g.beginPath();g.moveTo(w*.18,h*.27);g.lineTo(w*.77,h*.27);g.lineTo(w*.84,h*.48);g.lineTo(w*.13,h*.48);g.closePath();g.clip();g.globalCompositeOperation='source-atop';g.globalAlpha=.31*(1-atmosphere.night*.65);g.translate(w,0);g.scale(-1,1);g.drawImage(env,w*.13,h*.27,w*.71,h*.23);if(atmosphere.rain>.1){g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='screen';g.globalAlpha=atmosphere.rain*.27;g.strokeStyle='#eaf0e5';g.lineWidth=.65;for(let i=0;i<11;i++){const x=w*(.22+(i*.071)% .55),y=h*(.28+((i*.137+time*.025)%1)*.18);g.beginPath();g.ellipse(x,y,Math.max(.5,w*.002),Math.max(.8,h*.003),0,0,Math.PI*2);g.stroke();}}g.restore();
  g.save();g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.drawImage(sprite,0,0,w,h);g.restore();
  return finish;
 }
 function precipitation(c,w,h,P,j,t,a,wind){
  c.save();c.lineCap='round';
  if(a.rain>.001){
   for(const p of particles){const d=p.depth,progress=((p.y+t*(.38+d*.7)*p.speed)%1.3)-.16,y=progress*h;
    const x=p.x*w+Math.sin(t*.32+p.phase)*w*.018+wind*d*22,velocity=5+d*17,lean=(wind*.35-.16)*velocity+(x-w*.5)/w*d*4;
    c.globalAlpha=a.rain*(.1+d*.25);c.strokeStyle=d>.7?'#dbe9e9':'#a9bdc7';c.lineWidth=(.45+d*.6)*Math.min(2,w/600+1);c.beginPath();c.moveTo(x,y);c.lineTo(x+lean,y+velocity);c.stroke();
   }
   // Impacts stay on the projected road surface and expand before fading.
   for(let i=0;i<18;i++){const p=particles[i],distance=38+((i*71+p.x*70-j*42)%1200+1200)%1200,z=36/distance-.025;if(z<.08||z>.96)continue;const phase=(t*(.65+p.speed*.4)+p.y)%1,x=P.rx(z)+P.hw(z)*(p.x-.5)*1.7,y=P.yy(z),r=(1+phase*6)*z;
    c.globalAlpha=a.rain*(1-phase)*.32;c.strokeStyle='#d1e1df';c.lineWidth=.6;c.beginPath();c.ellipse(x,y,r*1.7,Math.max(.25,r*.28),0,0,Math.PI*2);c.stroke();
   }
  }
  if(a.snow>.001){
   for(let i=0;i<78;i++){const p=particles[i],d=p.depth,y=(((p.y+t*(.025+d*.065)*p.speed)%1.25)-.13)*h,x=p.x*w+Math.sin(t*(.26+d*.17)+p.phase)*(8+d*19)+Math.sin(t*.07)*wind*13;
    const radius=.6+d*d*2.5;c.globalAlpha=a.snow*(.23+d*.48);c.fillStyle='#eff4ed';c.beginPath();c.ellipse(x,y,radius,radius*(.65+.25*Math.sin(t*.4+p.phase)),p.phase+t*.1,0,Math.PI*2);c.fill();
    if(d>.95){c.globalAlpha=a.snow*.1;c.beginPath();c.arc(x,y,radius*2,0,Math.PI*2);c.fill();}
   }
  }
  c.restore();
 }
 function lamps(c,P,car){
  const strength=atmosphere.night*.7+atmosphere.rain*.1;if(strength<.01)return;
  const width=car.hero?P.hw(car.z)*.44:RoadVehicles.width(P,car),x=P.rx(car.z)+P.hw(car.z)*car.lane,y=P.yy(car.z),rgb=car.front?'255,239,185':'236,87,55';
  c.save();c.globalCompositeOperation='screen';for(const side of [-1,1]){const px=x+side*width*.35,py=y-width*(car.front?.37:.27),r=Math.max(2,width*.14),g=c.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba('+rgb+','+strength+')');g.addColorStop(.35,'rgba('+rgb+','+strength*.3+')');g.addColorStop(1,'rgba('+rgb+',0)');c.fillStyle=g;c.fillRect(px-r,py-r,r*2,r*2);
   if(atmosphere.rain>.1){const reflection=c.createLinearGradient(px,y,px,y+width*.8);reflection.addColorStop(0,'rgba('+rgb+','+strength*atmosphere.rain*.22+')');reflection.addColorStop(1,'rgba('+rgb+',0)');c.fillStyle=reflection;c.beginPath();c.moveTo(px-width*.025,y);c.lineTo(px+width*.025,y);c.lineTo(px+width*.07,y+width*.8);c.lineTo(px-width*.07,y+width*.8);c.closePath();c.fill();}
  }if(atmosphere.rain>.15){c.globalCompositeOperation='source-over';for(const side of [-1,1])for(let i=0;i<5;i++){const phase=(time*(1.1+i*.07)+i*.21)%1;c.globalAlpha=atmosphere.rain*(1-phase)*.12;c.fillStyle='#c8dbdf';c.beginPath();c.ellipse(x+side*width*(.38+phase*.08),y+phase*width*.32,Math.max(.5,width*phase*.025),Math.max(.5,width*phase*.013),0,0,Math.PI*2);c.fill();}}c.restore();
 }
 function beams(c,P,z,lane){
  if(atmosphere.night<.01)return;c.save();c.globalCompositeOperation='screen';
  for(let band=-4;band<=4;band++){
   const gradient=c.createLinearGradient(0,P.yy(z-.06),0,P.yy(.22));gradient.addColorStop(0,'rgba(245,226,177,'+(atmosphere.night*.11*Math.exp(-band*band/7))+')');gradient.addColorStop(1,'rgba(245,226,177,0)');c.fillStyle=gradient;c.beginPath();
   for(let side of [-1,1])for(let i=0;i<=24;i++){const u=side===-1?i/24:1-i/24,depth=z-.06-u*(z-.28),spread=.10+u*.42,offset=lane+(band+side*.5)*spread/4;c.lineTo(P.rx(depth)+P.hw(depth)*offset,P.yy(depth));}c.closePath();c.fill();
  }c.restore();
 }
 function clouds(c,w,h,a,t){const strength=Math.min(1,a.rain*.82+a.snow*.65+a.fog*.25);if(strength<.001)return;c.save();c.globalAlpha=strength*(1-a.night*.4);const width=w*1.25,x=-(t*3%width);for(let k=-1;k<2;k++)c.drawImage(cloud,x+k*width,-h*.025,width,h*.32);c.restore();}
 return {capture,snap,lit,reflect,paintedCar,precipitation,lamps,beams,clouds};
})();
