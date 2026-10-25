/* A shared gouache palette and material treatment for the entire Kangra world. */
const KangraWorld=(()=>{
 const C={deep:'#344d39',leaf:'#637b4d',light:'#a5aa72',earth:'#b7ad80',water:'#6f9389'};
 let pigment;
 function material(c,a,b,alpha){
  const im=ArtDepth.asset('kangraTerrain');if(!im.artReady)return;
  if(!pigment){pigment=document.createElement('canvas');pigment.width=pigment.height=512;const g=pigment.getContext('2d');for(const sx of[1,-1])for(const sy of[1,-1]){g.save();g.translate(sx<0?512:0,sy<0?512:0);g.scale(sx,sy);g.drawImage(im,0,0,256,256);g.restore();}}
  c.save();c.globalAlpha=alpha;c.globalCompositeOperation='soft-light';c.fillStyle=c.createPattern(pigment,'repeat');c.fillRect(a,120,b-a,RIVER-120);c.restore();
 }
 function line(c,col,w){c.strokeStyle=col;c.lineWidth=w;c.lineCap='round';c.stroke();}
 function surface(c,xa,xb,edge,top,bottom,salt){
  const a=Math.floor(xa/4)*4,b=Math.ceil(xb/4)*4,pts=[];
  for(let x=a;x<=b;x+=4)pts.push([x,edge(x)]);
  c.save();c.beginPath();c.moveTo(a,RIVER+1);for(const p of pts)c.lineTo(...p);c.lineTo(b,RIVER+1);c.closePath();
  const g=c.createLinearGradient(0,260,0,RIVER);g.addColorStop(0,top);g.addColorStop(1,bottom);c.fillStyle=g;c.fill();c.clip();
  material(c,a,b,salt===0x495?.8:salt===0x493?.55:.25);
  c.globalAlpha=1;c.restore();
  c.beginPath();for(let j=0;j<pts.length;j++)j?c.lineTo(...pts[j]):c.moveTo(...pts[j]);line(c,'rgba(217,212,166,.35)',.65);
 }
 function sky(c,xa,xb){
  const g=c.createLinearGradient(0,topY,0,500);g.addColorStop(0,'#a4b8b1');g.addColorStop(.55,'#d4d4b9');g.addColorStop(1,'#e9dbb4');c.fillStyle=g;c.fillRect(xa,-1500,xb-xa+4,2150);
  const mountain=x=>300-95*Math.pow(Math.abs(Math.sin(x*.0026+P[3])),1.4)-8*Math.sin(x*.013);
  surface(c,xa,xb,mountain,'#c4cbb9','#a3b09a',0x491);
  surface(c,xa,xb,x=>kRidge(x,0),'#bac39a','#869775',0x492);
  surface(c,xa,xb,x=>kRidge(x,1),'#a1ae7b','#6c8558',0x493);
  // Painted distant foliage belongs to the same hillside surface and camera.
  for(let i=Math.floor(xa/42)-1;i<xb/42+1;i++){
   const q=mulberry32(hash(seed^0x494,i)),x=i*42+q()*22,y=kRidge(x,1)+1;
   if(q()<.32)continue;ArtDepth.foliage(c,x,y,16+q()*12,17+q()*11,q,.65);
  }
 }
 function ground(c,xa,xb){
  surface(c,xa,xb,gy,'#99a777','#6d8454',0x495);
  c.save();c.beginPath();c.moveTo(xa,gy(xa));for(let x=Math.floor(xa/4)*4;x<=xb+4;x+=4)c.lineTo(x,gy(x));c.lineTo(xb+4,RIVER);c.lineTo(xa,RIVER);c.closePath();c.clip();
  for(let i=Math.floor(xa/8)-1;i<xb/8+1;i++){
   const q=mulberry32(hash(seed^0x496,i)),x=i*8+q()*6,y=gy(x)+6+q()*(RIVER-gy(x)-12);
   for(let j=0;j<3;j++){c.beginPath();c.moveTo(x+j*1.5,y+2);c.quadraticCurveTo(x+j,y-2,x-1+j*2,y-3-q()*4);line(c,q()<.5?'rgba(53,81,43,.34)':'rgba(223,210,148,.43)',.5);}
   if(q()<.23){c.beginPath();c.ellipse(x,y-4,.9,1.3,.4,0,TAU);c.fillStyle=q()<.6?'#e3d2ad':'#bc8a78';c.fill();}
  }
  c.restore();const water=c.createLinearGradient(0,RIVER,0,H);water.addColorStop(0,'#a3b2a0');water.addColorStop(.3,'#7e9e91');water.addColorStop(1,'#557d75');c.fillStyle=water;c.fillRect(xa,RIVER,xb-xa+4,H-RIVER);
  for(let i=Math.floor(xa/13)-1;i<xb/13+1;i++)for(let j=0;j<8;j++){
   const q=mulberry32(hash(seed^0x497,i*11+j)),x=i*13+q()*12,y=RIVER+3+j*8+q()*5;
   c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+5,y-1,x+6+q()*17,y);line(c,q()<.45?'rgba(231,222,183,.4)':'rgba(53,104,90,.2)',.5+q()*.7);
  }
  c.beginPath();c.moveTo(xa,RIVER);c.lineTo(xb,RIVER);line(c,'#b4b28a',1.5);
 }
 function cypress(c,x,q){
  const y=gy(x)+3,h=110+q()*50,w=14+q()*6;c.save();
  const im=ArtDepth.asset('kangraCypress');if(im.width){c.drawImage(im,296,18,435,1503,x-w,y-h,w*2,h);c.restore();return;}
  c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-2,y-h*.4,x,y-h);line(c,'#75694b',3);
  for(let j=0;j<180;j++){
   const u=q(),yy=y-8-u*h,ww=w*Math.pow(Math.sin(u*PI),.7),xx=x+(q()-.5)*ww*2;
   c.beginPath();c.ellipse(xx,yy,2+q()*3,3+q()*4,(q()-.5)*.8,0,TAU);c.fillStyle=pick(q,[C.deep,C.leaf,'#7e8c59','#526e43']);c.fill();
  }c.restore();
 }
 function cloud(c,x,y,q){
  c.save();for(let j=0;j<7;j++){const xx=x+j*13,yy=y+Math.sin(j*.7)*5,r=18+q()*10,g=c.createRadialGradient(xx,yy,0,xx,yy,r);g.addColorStop(0,'rgba(248,239,211,.3)');g.addColorStop(1,'rgba(248,239,211,0)');c.fillStyle=g;c.fillRect(xx-r,yy-r,r*2,r*2);}c.restore();
 }
 function lotus(c,x,y,q){
  for(let j=0,n=2+(q()*3|0);j<n;j++){
   const px=x+j*19+(q()-.5)*5,py=y+(q()-.5)*8;c.beginPath();c.ellipse(px,py,10,3.7,-.13,0,TAU);const g=c.createLinearGradient(px-8,py-3,px+8,py+3);g.addColorStop(0,'#9ca671');g.addColorStop(1,'#4f7658');c.fillStyle=g;c.fill();line(c,'rgba(62,93,63,.45)',.35);
   c.beginPath();c.moveTo(px-7,py);c.lineTo(px+5,py);line(c,'rgba(214,211,162,.6)',.35);
   if(q()<.7)for(let k=-2;k<=2;k++){c.save();c.translate(px,py);c.rotate(k*.32);leafPath(c,9,3);const petal=c.createLinearGradient(0,0,0,-9);petal.addColorStop(0,'#b77379');petal.addColorStop(1,'#efd0ba');c.fillStyle=petal;c.fill();line(c,'rgba(141,95,84,.3)',.3);c.restore();}
  }
 }
 function buck(c,x,q,A){
  const im=ArtDepth.asset('kangraBuck');if(!im.width)return;
  const s=.85+q()*.18,t=A?.t||0,y=gy(x)+3;
  c.save();c.translate(x,y);c.scale((A?.dir||1)*s,s);c.transform(1,0,Math.sin(t*.7)*.002,1+Math.sin(t*.9)*.003,0,0);
  c.beginPath();c.ellipse(0,0,25,2.5,0,0,TAU);c.fillStyle='rgba(44,59,32,.16)';c.fill();c.drawImage(im,90,23,1142,1182,-29,-61,59,61);c.restore();
 }
 function boat(c,x,q,t=0){
  const im=ArtDepth.asset('kangraBoat');if(!im.width)return;
  const y=RIVER+25+Math.sin(t*.8)*1.1,dir=q()<.5?-1:1;
  c.save();c.translate(x,y);c.scale(dir,1);c.beginPath();c.ellipse(0,0,47,3,0,0,TAU);c.fillStyle='rgba(38,75,64,.2)';c.fill();c.drawImage(im,37,101,1873,613,-48,-31,96,31);
  c.beginPath();c.moveTo(32,-18);c.lineTo(40+Math.sin(t*.7)*8,8);line(c,'#796543',.85);c.beginPath();c.moveTo(38+Math.sin(t*.7)*8,8);c.lineTo(43+Math.sin(t*.7)*8,9);line(c,'rgba(215,221,181,.5)',.6);c.restore();
 }
 function ducks(c,x,y,q,t){
  for(let i=0,n=2+(q()*3|0);i<n;i++){
   const v=t*.35+i*1.4+q()*6,dx=x+i*24+Math.sin(v)*16,dy=y+(q()-.5)*10+Math.sin(t*1.8+i*2),mall=q()<.6;
   c.save();c.translate(dx,dy);c.scale(sdir(Math.cos(v)),1);
   c.beginPath();c.ellipse(0,3,13,1.5,0,0,TAU);line(c,'rgba(228,221,183,.5)',.5);
   c.beginPath();c.moveTo(-11,-1);c.bezierCurveTo(-8,-8,1,-7,6,-6);c.lineTo(7,-12);c.bezierCurveTo(8,-16,12,-14,11,-11);c.lineTo(9,-6);c.bezierCurveTo(10,2,-5,3,-11,-1);c.closePath();
   const g=c.createLinearGradient(0,-10,0,3);g.addColorStop(0,mall?'#c4ad7f':'#e8dfc8');g.addColorStop(1,mall?'#786e4d':'#a7a58b');c.fillStyle=g;c.fill();line(c,'rgba(76,87,62,.4)',.35);
   for(let j=0;j<5;j++){c.beginPath();c.moveTo(-7+j*2,-3);c.quadraticCurveTo(-2+j,-6,4,-2+j*.5);line(c,'rgba(236,223,182,.45)',.35);}
   c.beginPath();c.moveTo(10,-13);c.lineTo(14,-12);line(c,'#b49458',1);c.beginPath();c.arc(9.5,-13,.35,0,TAU);c.fillStyle='#3a4232';c.fill();c.restore();
  }
 }
 function install(){
  STYLES.kangra.sky=sky;STYLES.kangra.ground=ground;
  kPal=()=>[C.deep,C.leaf,C.light,'#566442'];kCloud=cloud;kLotus=lotus;kDucks=ducks;
  const oldBuck=kBuck,oldCow=kCow,oldBoat=kBoat;
  kBuck=(c,x,q,A)=>ArtDepth.asset('kangraBuck').width?buck(c,x,q,A):oldBuck(c,x,q,A);
  kCow=(c,x,q,A)=>ArtDepth.asset('kangraBuck').width?buck(c,x,q,A):oldCow(c,x,q,A);
  kBoat=(c,x,q,t)=>ArtDepth.asset('kangraBoat').width?boat(c,x,q,t):oldBoat(c,x,q,t);
  kBush=(c,x,q)=>{const w=37+q()*24;ArtDepth.foliage(c,x,gy(x)+4,w,w*.56,q,1);};
 }
 return{install,cypress};
})();
