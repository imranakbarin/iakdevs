/* Small, seeded rural encounters share the road's distance and ground projection. */
const RoadRural=(()=>{
 const barns=new Map();
 function sites(j,ix){
  const camera=j*42,out=[];
  for(let k=Math.max(0,Math.floor((camera-220-90)/1400));k<=Math.floor((camera+1100-220)/1400);k++){
   const s=220+k*1400,d=s-camera,side=k%2?1:-1;
   if(ix===3&&side<0)continue;
   // Keep a whole pasture clear of river crossings, including its far fence.
   if(Array.from({length:3},(_,n)=>380+(Math.floor((s-380)/1150)+n-1)*1150).some(r=>r>=380&&s+85>=r&&s-15<=r+130))continue;
   if(d+85>34&&d<1000)out.push({k,d,side,variant:k%3});
  }return out;
 }
 function encounters(j,ix){
  const out=[];for(const site of sites(j,ix)){
   const add=(part,offset,lane,n=0)=>{const d=site.d+offset,z=36/d-.025;if(d>34&&z>0&&z<1.05)out.push({...site,rural:true,part,n,lane:lane*site.side,distance:d,z});};
   add('barn',58,3.05);add('hay',46,2.65);add('trough',23,2.8);add('chicken',40,2.25);add('chicken',43,2.38,1);
   if(site.variant===2)for(let n=0;n<4;n++)add('orchard',18+n*17,3.65,n);
   else if(site.variant===0)add('scarecrow',34,3.7);
   for(let n=0;n<3;n++)add('animal',12+n*13,1.98+n*.3,n);
   for(let n=0;n<7;n++)add('fence',n*12,1.55,n);
  }return out;
 }
 function fields(c,P,w,h,j,ix){
  for(const site of sites(j,ix)){
   const point=(d,lane)=>{const z=36/Math.max(8,d)-.025;return [P.rx(z)+P.hw(z)*lane*site.side,P.yy(z)];};
   const a=point(site.d,1.5),b=point(site.d+84,1.5),q=point(site.d+84,4.05),d=point(site.d,4.05);
   c.fillStyle=ix===1?'#b59a60':ix===3?'#99aa72':'#8a9e62';c.beginPath();[a,b,q,d].forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();
   c.save();c.clip();c.strokeStyle=ix===1?'#978454':'rgba(213,211,140,.5)';c.lineWidth=1;
   for(let n=0;n<8;n++){const x=point(site.d,3.3+n*.09),y=point(site.d+84,3.3+n*.09);c.beginPath();c.moveTo(...x);c.lineTo(...y);c.stroke();}c.restore();
  }
 }
 function barn(ix,variant){
  const key=ix+':'+variant;if(barns.has(key))return barns.get(key);
  const tile=document.createElement('canvas');tile.width=280;tile.height=230;const c=tile.getContext('2d');c.translate(140,214);
  const red=ix===1?'#aa8056':variant===1?'#7f8f80':'#a65f46';
  c.fillStyle='rgba(33,46,27,.22)';c.beginPath();c.ellipse(8,1,100,12,0,0,Math.PI*2);c.fill();
  // Three visible walls/roof planes, a silo, slatted doors and a shaded foundation.
  c.fillStyle='#b2b2a0';c.beginPath();c.roundRect(53,-138,34,137,15);c.fill();c.fillStyle='#6b807b';c.beginPath();c.ellipse(70,-134,17,10,0,Math.PI,Math.PI*2);c.fill();
  c.strokeStyle='#858e7b';c.lineWidth=1.5;for(let y=-115;y<-8;y+=17){c.beginPath();c.moveTo(54,y);c.lineTo(86,y);c.stroke();}
  c.fillStyle=red;c.fillRect(-66,-76,111,72);c.fillStyle='#715744';c.beginPath();c.moveTo(45,-76);c.lineTo(92,-58);c.lineTo(92,-3);c.lineTo(45,-4);c.closePath();c.fill();
  c.fillStyle='#c48e61';c.beginPath();c.moveTo(-66,-76);c.lineTo(-12,-119);c.lineTo(45,-76);c.closePath();c.fill();
  c.fillStyle='#466363';c.beginPath();c.moveTo(-79,-75);c.lineTo(-12,-132);c.lineTo(56,-77);c.lineTo(45,-70);c.lineTo(-12,-117);c.closePath();c.fill();
  c.fillStyle='#304f54';c.beginPath();c.moveTo(-12,-132);c.lineTo(39,-114);c.lineTo(102,-60);c.lineTo(56,-77);c.closePath();c.fill();
  c.strokeStyle='rgba(239,210,164,.3)';c.lineWidth=1;for(let x=-60;x<44;x+=9){c.beginPath();c.moveTo(x,-74);c.lineTo(x,-7);c.stroke();}
  c.fillStyle='#4e443b';c.fillRect(-37,-52,49,48);c.strokeStyle='#dfcfab';c.lineWidth=3;c.strokeRect(-37,-52,49,48);c.beginPath();c.moveTo(-37,-52);c.lineTo(12,-4);c.moveTo(12,-52);c.lineTo(-37,-4);c.stroke();
  c.fillStyle='#ead4a0';c.fillRect(-24,-98,22,13);c.strokeStyle='#635848';c.lineWidth=2;c.strokeRect(-24,-98,22,13);
  c.fillStyle='#a09a76';c.fillRect(-68,-4,163,5);
  c.fillStyle='#e5d8ad';c.fillRect(-58,-65,89,13);c.fillStyle='#655e42';c.textAlign='center';c.font='bold 8px Georgia';c.fillText(ix===1?'DESERT RANCH':variant===1?'DAIRY FARM':variant===2?'ORCHARD':'MEADOW FARM',-13,-55);
  barns.set(key,tile);return tile;
 }
 function animal(c,x,y,s,kind,n,t){
  c.save();c.translate(x,y);c.scale(s*(n%2?-1:1),s);
  c.fillStyle='rgba(32,47,27,.25)';c.beginPath();c.ellipse(0,1,24,4,0,0,Math.PI*2);c.fill();
  const cow=kind==='cow',coat=cow?'#e7dccc':n===1?'#a48b6b':'#eee3ca';
  c.strokeStyle=cow?'#655b4b':'#897a60';c.lineWidth=cow?4:2.2;
  for(const xx of [-15,-8,9,16]){c.beginPath();c.moveTo(xx,-14);c.lineTo(xx+Math.sin(t*.5+n+xx)*.65,-2);c.stroke();c.strokeStyle='#5d5947';c.lineWidth=2;c.beginPath();c.moveTo(xx-2,-1);c.lineTo(xx+2,-1);c.stroke();c.strokeStyle=cow?'#655b4b':'#897a60';c.lineWidth=cow?4:2.2;}
  const g=c.createLinearGradient(0,-28,0,-10);g.addColorStop(0,coat);g.addColorStop(1,cow?'#b6ac91':'#bbad90');c.fillStyle=g;c.beginPath();c.ellipse(0,-20,cow?24:20,cow?11:9,0,0,Math.PI*2);c.fill();
  if(cow){c.fillStyle='#625f54';for(const [a,b,r]of [[-12,-22,7],[9,-17,6]]){c.beginPath();c.ellipse(a,b,r,r*.75,.4,0,Math.PI*2);c.fill();}}
  // Hooves remain planted; only the grazing neck, ears and tail move.
  c.save();c.translate(16,-20);c.rotate(.55+.2*Math.sin(t*.65+n));c.fillStyle=coat;c.beginPath();c.ellipse(8,-3,13,5,.3,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(17,0,7,5,0,0,Math.PI*2);c.fill();
  for(const side of [-1,1]){c.beginPath();c.ellipse(10,-6,6,2.3,side*.55,0,Math.PI*2);c.fill();}
  if(!cow){c.strokeStyle='#87795e';c.lineWidth=1.5;for(const xx of [10,15]){c.beginPath();c.moveTo(xx,-5);c.quadraticCurveTo(xx-2,-15,xx-6,-15);c.stroke();}c.fillStyle='#99896d';c.beginPath();c.moveTo(15,4);c.lineTo(19,10);c.lineTo(21,3);c.fill();}
  c.fillStyle='#333e32';c.beginPath();c.arc(18,-2,1,0,Math.PI*2);c.fill();c.restore();
  c.strokeStyle=coat;c.lineWidth=2;c.beginPath();c.moveTo(-20,-21);c.quadraticCurveTo(-28,-22+Math.sin(t*1.5+n)*3,-26,-16);c.stroke();c.restore();
 }
 function draw(c,P,w,h,event,ix,t){
  const {z,lane,part,n,variant}=event,x=P.rx(z)+P.hw(z)*lane,y=P.yy(z),s=P.hw(z)/160;
  if(x<-P.hw(z)||x>w+P.hw(z))return;
  if(part==='animal'){animal(c,x,y,P.hw(z)/250,variant===1?'cow':'goat',n,t);return;}
  if(part==='barn'){c.drawImage(barn(ix,variant),x-140*s,y-214*s,280*s,230*s);return;}
  c.save();c.translate(x,y);c.scale(s,s);
  if(part==='chicken'){
   c.scale(.55,.55);c.fillStyle='rgba(31,46,25,.2)';c.beginPath();c.ellipse(0,0,11,3,0,0,Math.PI*2);c.fill();c.strokeStyle='#b19058';c.lineWidth=1.5;for(const x of [-3,3]){c.beginPath();c.moveTo(x,-5);c.lineTo(x,0);c.stroke();}
   c.fillStyle=n?'#b58f5d':'#ede0bf';c.beginPath();c.ellipse(0,-10,10,7,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(-8,-10);c.lineTo(-15,-21);c.lineTo(-14,-7);c.fill();
   const peck=Math.sin(t*1.4+n)*3;c.beginPath();c.arc(9,-11+peck,4,0,Math.PI*2);c.fill();c.fillStyle='#b15b42';c.beginPath();c.arc(9,-16+peck,2,0,Math.PI*2);c.fill();c.fillStyle='#c7a15e';c.beginPath();c.moveTo(12,-11+peck);c.lineTo(17,-9+peck);c.lineTo(12,-8+peck);c.fill();
  }else if(part==='orchard'){
   c.fillStyle='rgba(31,47,26,.21)';c.beginPath();c.ellipse(0,1,24,5,0,0,Math.PI*2);c.fill();c.fillStyle='#8c7652';c.fillRect(-3,-36,6,36);
   for(let i=0;i<6;i++){const a=i*Math.PI/3,xx=Math.cos(a)*12,yy=-39+Math.sin(a)*9;c.fillStyle=i%2?'#668452':'#87a05e';c.beginPath();c.ellipse(xx,yy,15,12,0,0,Math.PI*2);c.fill();c.fillStyle='#cb8952';c.beginPath();c.arc(xx+3,yy+3,2,0,Math.PI*2);c.fill();}
  }else if(part==='scarecrow'){
   c.strokeStyle='#8b7958';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(0,-45);c.moveTo(-17,-29);c.lineTo(17,-29);c.stroke();c.fillStyle='#c59267';c.beginPath();c.moveTo(-8,-32);c.lineTo(8,-32);c.lineTo(12,-13);c.lineTo(-10,-13);c.fill();c.fillStyle='#d8bc7b';c.beginPath();c.arc(0,-39,5,0,Math.PI*2);c.fill();c.fillRect(-10,-45,20,3);c.fillRect(-5,-51,10,7);
  }else if(part==='fence'){
   c.fillStyle='rgba(35,48,28,.22)';c.beginPath();c.ellipse(2,1,6,2,0,0,Math.PI*2);c.fill();
   c.fillStyle='#8e7e5d';c.fillRect(-2,-23,4,23);c.fillStyle='#d7c79c';c.fillRect(-2,-24,4,3);
   if(n<6){const farZ=36/(event.distance+12)-.025,ex=(P.rx(farZ)+P.hw(farZ)*lane-x)/s,ey=(P.yy(farZ)-y)/s,ratio=P.hw(farZ)/P.hw(z);c.strokeStyle='#a29471';c.lineWidth=2;for(const height of [9,18]){c.beginPath();c.moveTo(0,-height);c.lineTo(ex,ey-height*ratio);c.stroke();}}
  }else if(part==='hay'){
   for(let n=0;n<3;n++){const xx=(n-1)*18,yy=n===1?-18:0;const g=c.createLinearGradient(xx-10,yy-21,xx+10,yy);g.addColorStop(0,'#dec68a');g.addColorStop(1,'#a88c50');c.fillStyle=g;c.beginPath();c.ellipse(xx,yy-10,12,10,0,0,Math.PI*2);c.fill();c.strokeStyle='#b69a5e';c.lineWidth=1;c.beginPath();c.ellipse(xx-3,yy-10,6,7,0,0,Math.PI*2);c.stroke();}
  }else {c.fillStyle='#737e6c';c.beginPath();c.roundRect(-25,-9,50,10,3);c.fill();c.fillStyle='#73a3a0';c.beginPath();c.ellipse(0,-8,22,3,0,0,Math.PI*2);c.fill();c.strokeStyle='rgba(222,235,204,.6)';c.lineWidth=.6;c.beginPath();c.ellipse(Math.sin(t)*3,-8,8+Math.sin(t*.6),1.5,0,0,Math.PI*2);c.stroke();}
  c.restore();
 }
 function birds(c,w,h,ix,t){
  c.save();const count=ix===1?3:5;
  for(let n=0;n<count;n++){
   const phase=(t*.017+.45+n*.04+ix*.11)%1.4,x=w*(phase-.2),y=h*(.19+n*.012)+Math.sin(t*.32+n)*h*.018,size=Math.min(w,h)*(.007+n*.0004);
   const wing=Math.sin(t*(ix===1?1.3:3.3)+n*.6);c.strokeStyle=ix===3?'#eae9d5':'#4c6460';c.lineWidth=Math.max(.65,size*.2);c.lineCap='round';c.beginPath();c.moveTo(x-size,y-wing*size*.6);c.quadraticCurveTo(x-size*.45,y-size*.2,x,y);c.quadraticCurveTo(x+size*.45,y-size*.2,x+size,y-wing*size*.6);c.stroke();
  }c.restore();
 }
 return {encounters,fields,draw,birds};
})();
