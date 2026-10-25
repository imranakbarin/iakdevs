/* Scene-scale composition and independently moving planes for live, seeded art. */
const ArtDepth=(()=>{
 const nearTiles=new Map(),orchardTiles=new Map();
 const painted={},sources={},started=new Set();
 for(const [key,file] of [['tree','mexico-flowering-tree.webp'],['deer','mexico-painted-deer.webp'],['kangraPavilion','kangra-painted-pavilion.webp'],['kangraTree','kangra-flowering-tree.webp'],['kangraTerrain','kangra-meadow.webp'],['kangraCypress','kangra-cypress.webp'],['kangraBoat','kangra-boat.webp'],['kangraBuck','kangra-buck.webp']]){
  const img=new Image();img.artReady=false;img.onload=()=>{img.artReady=true;requestAnimationFrame(()=>{resetTiles();wakeScene();});};painted[key]=img;sources[key]='assets/'+file;
 }
 function prepare(key){for(const name of key==='mexico'?['tree','deer']:key==='kangra'?['kangraPavilion','kangraTree','kangraTerrain','kangraCypress','kangraBoat','kangraBuck']:[]){if(started.has(name))continue;started.add(name);painted[name].src=sources[name];}}
 const layered=style=>['mexico','kangra','japan','china'].some(key=>STYLES[key]===style);
 function foliage(c,x,y,w,h,q,alpha=1){
  if(!painted.kangraTree.width)return;
  c.save();c.globalAlpha=alpha;c.beginPath();c.ellipse(x,y-1,w*.44,2,0,0,TAU);c.fillStyle='rgba(43,62,34,.2)';c.fill();
  c.beginPath();c.ellipse(x,y-h*.48,w*.5,h*.54,0,0,TAU);c.clip();c.drawImage(painted.kangraTree,6,9,1246,940,x-w*.5,y-h,w,h);c.restore();
 }
 // Sites share both the surface coordinates and the camera plane of their terrain.
 function treeSite(c,x,q,s,surface){
  const y=surface(x);c.save();c.translate(x,y);c.scale(s,s);c.translate(-x,-(gy(x)+3));kTree(c,x,q);c.restore();
 }
 function flatSite(x,s,surface){
  let best=x,score=Infinity;const w=83*s;
  for(let d=-180;d<=180;d+=6){const ys=[];for(let j=-4;j<=4;j++)ys.push(surface(x+d+j*w/4));const cost=Math.max(...ys)-Math.min(...ys)+Math.abs(d)*.012;if(cost<score){score=cost;best=x+d;}}
  return best;
 }
 function pavilionSite(c,x,q,s,surface){
  const w=83*s,points=[];for(let j=0;j<=12;j++){const xx=x-w+j*w/6;points.push([xx,surface(xx)+5*s]);}
  const y=Math.min(...points.map(p=>p[1]))-2*s;
  c.save();c.beginPath();c.moveTo(x-w,y);c.lineTo(x+w,y);for(let j=points.length-1;j>=0;j--)c.lineTo(...points[j]);c.closePath();
  c.fillStyle='#b5a47d';c.fill();stroke(c,'#8f8664',.65);c.beginPath();c.moveTo(x-w,y);c.lineTo(x+w,y);stroke(c,'#e0d2ac',2*s);
  c.translate(x,y);c.scale(s,s);c.translate(-x,-(gy(x)+4));kPavilion(c,x,q);c.restore();
 }
 function stroke(c,color,width){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
 function almond(c,x,y,a,l,w,color,light='#dbc786'){
  c.save();c.translate(x,y);c.rotate(a);leafPath(c,l,w);
  const g=c.createLinearGradient(-w,0,w,-l);g.addColorStop(0,shade(color,-24));g.addColorStop(.55,color);g.addColorStop(1,shade(color,22));c.fillStyle=g;c.fill();stroke(c,shade(color,-35),.65);
  c.save();c.clip();c.beginPath();c.moveTo(0,0);c.lineTo(0,-l*.94);for(let u=.15;u<.9;u+=.12){c.moveTo(0,-l*u);c.lineTo(-w*.8,-l*(u+.1));c.moveTo(0,-l*u);c.lineTo(w*.8,-l*(u+.1));}stroke(c,light,.5);c.restore();c.restore();
 }
 function crown(c,x,y,size,q,colors,bloom=false){
  for(let j=0;j<11;j++){
   const a=q()*TAU,r=Math.sqrt(q())*size,xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r*.55;
   const col=pick(q,colors);almond(c,xx,yy,(q()-.5)*2,22+q()*23,6+q()*6,col);
   if(bloom&&j%4===0)folkFlower(c,xx,yy-15,9+q()*8,q);
  }
 }
 function paintOrchard(c,x,y,s,q,bloom=true){
  c.save();c.translate(x,y);c.scale(s,s);
  const lean=(q()-.5)*35,h=230+q()*55;
  c.beginPath();c.moveTo(-12,0);c.bezierCurveTo(-20,-80,lean-15,-h*.7,lean-5,-h);c.lineTo(lean+6,-h);c.bezierCurveTo(lean-3,-h*.7,5,-70,12,0);c.closePath();
  const bark=c.createLinearGradient(-20,0,25,0);bark.addColorStop(0,'#423e2b');bark.addColorStop(.5,'#987042');bark.addColorStop(1,'#58422d');c.fillStyle=bark;c.fill();stroke(c,'#453c2b',1);
  c.beginPath();for(let j=0;j<5;j++){c.moveTo(-8+j*4,0);c.bezierCurveTo(-15+j*4,-80,lean-9+j*3,-h*.65,lean+j,-h);}stroke(c,'#c49b61',.65);
  for(let j=0;j<6;j++){
   const u=.35+j*.105,ax=lean*u,ay=-h*u,sg=j%2?1:-1,bx=ax+sg*(65+q()*55)*(1-u*.25),by=ay-28-q()*30;
   c.beginPath();c.moveTo(ax,ay+15);c.quadraticCurveTo(bx*.6,by+30,bx,by);stroke(c,'#54432d',7*(1-u)+1.5);
   for(let k=0;k<2;k++){const ex=bx+(q()-.5)*60,ey=by-10-q()*25;c.beginPath();c.moveTo(bx*.65,ay);c.quadraticCurveTo(bx,by,ex,ey);stroke(c,'#665032',1.4);crown(c,ex,ey,24+q()*10,q,['#285e48','#41784e','#658253'],bloom);}
  }
  crown(c,lean,-h,35,q,['#285e48','#41784e','#658253'],bloom);
  // Engraved bark is visible on the larger foreground trunks.
  c.beginPath();for(let j=0;j<24;j++){const u=j/24;c.moveTo(lean*u-7,-h*u);c.quadraticCurveTo(lean*u,-h*u-7,lean*u+6,-h*u-2);}stroke(c,'#dfb56c',.55);c.restore();
 }
 function orchardTree(c,x,y,s,q,bloom=true){
  if(painted.tree.width>0){c.drawImage(painted.tree,x-182*s,y-360*s,365*s,365*s);return;}
  const n=(q()*4294967296)>>>0,m=c.getTransform(),ratio=Math.max(1,Math.min(3,Math.ceil(Math.hypot(m.a,m.b)*s*2)/2)),key=[n,bloom,ratio].join(':');let tile=orchardTiles.get(key);
  if(!tile){tile=document.createElement('canvas');tile.width=Math.ceil(440*ratio);tile.height=Math.ceil(430*ratio);const g=tile.getContext('2d');g.scale(ratio,ratio);paintOrchard(g,220,410,1,mulberry32(n),bloom);orchardTiles.set(key,tile);while(orchardTiles.size>10)orchardTiles.delete(orchardTiles.keys().next().value);}
  c.drawImage(tile,x-220*s,y-410*s,440*s,430*s);
 }
 function adobe(c,x,y,s,q){
  c.save();c.translate(x,y);c.scale(s,s);const w=35+q()*22,h=25+q()*14;
  poly(c,[[-w/2,0],[-w/2,-h],[w/2,-h],[w/2,0]]);c.fillStyle=pick(q,['#d4a469','#d8b282','#ba895c']);c.fill();stroke(c,'#947a54',.6);
  poly(c,[[-w/2-4,-h],[-w/2+6,-h-14],[w/2+1,-h-12],[w/2+6,-h]]);c.fillStyle='#a16c49';c.fill();stroke(c,'#80613f',.6);
  c.fillStyle='#736c4a';c.fillRect(-4,-15,8,15);for(const sg of[-1,1]){c.fillRect(sg*w*.28-3,-h+8,6,7);c.beginPath();c.moveTo(sg*w*.28,-h+8);c.lineTo(sg*w*.28,-h+15);stroke(c,'#e6d3a4',.5);}c.restore();
 }
 function mexicoSky(c,xa,xb){
  const sky=c.createLinearGradient(0,60,0,555);sky.addColorStop(0,'#e8c58b');sky.addColorStop(.45,'#f2deaf');sky.addColorStop(1,'#a4ad83');c.fillStyle=sky;c.fillRect(xa,-800,xb-xa,1450);
  for(let i=Math.floor(xa/1200)-1;i<=xb/1200;i++){
   const x=i*1200+390,y=185;const halo=c.createRadialGradient(x,y,12,x,y,175);halo.addColorStop(0,'rgba(255,242,185,.8)');halo.addColorStop(1,'rgba(255,235,170,0)');c.fillStyle=halo;c.fillRect(x-175,y-175,350,350);
   c.beginPath();c.arc(x,y,29,0,TAU);c.fillStyle='#fff0bb';c.fill();
  }
  for(let band=0;band<3;band++){
   const spacing=430,qcol=['#c7c5af','#b5b397','#8f9b78'][band];
   for(let i=Math.floor(xa/spacing)-1;i<=Math.ceil(xb/spacing)+1;i++){
    const q=mulberry32(hash(seed+band*771,i)),x=i*spacing+q()*100,y=455+band*23,w=650+q()*180,h=150+q()*95-band*28;
    printMountain(c,x,y,w,h,q,qcol,band===0?'rgba(113,111,94,.15)':'rgba(83,105,75,.25)');
   }
  }
  for(let i=Math.floor(xa/260)-1;i<=Math.ceil(xb/260);i++){
   const q=mulberry32(hash(seed^0x411,i)),x=i*260+80,y=438+q()*25;
   for(let j=0;j<5;j++)adobe(c,x+j*23,y+Math.sin(j)*7,.48+q()*.25,q);
   for(let j=0;j<7;j++){const xx=x-30+j*31;c.beginPath();c.ellipse(xx,y+12,9+q()*6,22+q()*12,-.1,0,TAU);c.fillStyle=j%2?'#6d805a':'#85946a';c.fill();}
  }
  paperGrain(c,xa,xb);
 }
 function mexicoGround(c,xa,xb){
  const g=c.createLinearGradient(0,490,0,640);g.addColorStop(0,'#b4b780');g.addColorStop(.5,'#8d9a58');g.addColorStop(1,'#79854a');c.fillStyle=g;c.fillRect(xa,555,xb-xa,85);
  for(let i=Math.floor(xa/CW)-1;i<=xb/CW+1;i++){
   const x=i*CW+220,y=604;c.beginPath();c.ellipse(x,y,173,34,-.025,0,TAU);
   const water=c.createLinearGradient(0,y-34,0,y+34);water.addColorStop(0,'#b8cbb4');water.addColorStop(.5,'#729c91');water.addColorStop(1,'#487f78');c.fillStyle=water;c.fill();stroke(c,'#d4c58b',4);
   c.save();c.clip();
   for(let j=0;j<7;j++){
    const xx=x-130+j*43;c.beginPath();c.moveTo(xx-7,y-34);c.lineTo(xx+9,y-34);c.lineTo(xx+4,y+22);c.lineTo(xx-3,y+16);c.closePath();c.fillStyle='rgba(34,82,66,.23)';c.fill();
    c.beginPath();c.ellipse(xx,y-13,17,18,.2,0,TAU);c.fill();
   }
   const glint=c.createRadialGradient(x+35,y-10,0,x+35,y-10,95);glint.addColorStop(0,'rgba(255,230,155,.53)');glint.addColorStop(1,'rgba(255,230,155,0)');c.fillStyle=glint;c.fillRect(x-65,y-40,200,80);
   for(let j=0;j<12;j++){const yy=y-29+j*5;c.beginPath();c.moveTo(x-180,yy);c.quadraticCurveTo(x,yy-5,x+180,yy+1);stroke(c,j%2?'#c1ceb0':'#69998c',.7);}c.restore();
  }
  for(let ix=Math.floor(xa/8);ix<=xb/8;ix++){
   const q=mulberry32(hash(seed^0x72f,ix)),x=ix*8,y=558+q()*12;c.beginPath();c.moveTo(x,y+7);c.lineTo(x-2,y-4);c.moveTo(x,y+7);c.lineTo(x+3,y-6);stroke(c,q()<.5?'#516d3d':'#d0be78',.7);
  }
 }
 function deer(c,x,y,s,t,q){
  if(painted.deer.width>0){
   // Subtle breathing is anchored to the hooves; the scene remains live and pannable.
   c.save();c.translate(x,y);c.transform(1,0,Math.sin(t*.38)*.0015,1+Math.sin(t*.65)*.0015,0,0);c.drawImage(painted.deer,-66*s,-253*s,176*s,264*s);c.restore();return;
  }
  c.save();c.translate(x,y);c.scale(s,s);c.lineJoin='round';
  const body='#a86e43',edge='#624831';
  // Four jointed legs terminate on the same bank, independent of breathing.
  for(const [j,lx] of [-43,-25,27,43].entries()){
   const pts=[[lx,-76],[lx+(j%2?-5:7),-34],[lx+(j%2?0:12),-3]];poly(c,taper(pts,11,4));c.fillStyle=j%2?'#9b6841':'#be8b55';c.fill();stroke(c,edge,.9);c.beginPath();c.moveTo(pts[2][0]-3,-1);c.lineTo(pts[2][0]+5,-1);stroke(c,'#483b2e',3);
  }
  const breath=Math.sin(t*.65)*.5;
  const shape=()=>{c.beginPath();c.moveTo(-55,-64);c.bezierCurveTo(-78,-91,-48,-118+breath,4,-118+breath);c.quadraticCurveTo(29,-118,46,-102);c.lineTo(62,-155);c.bezierCurveTo(64,-176,78,-177,82,-161);c.lineTo(73,-97);c.bezierCurveTo(80,-64,38,-53,-55,-64);c.closePath();};
  shape();const wash=c.createLinearGradient(-60,-120,65,-58);wash.addColorStop(0,'#cfad72');wash.addColorStop(.4,body);wash.addColorStop(1,'#754d32');c.fillStyle=wash;c.fill();stroke(c,edge,1);
  c.save();shape();c.clip();
  for(let j=0;j<8;j++){const xx=-48+j*13;c.beginPath();c.moveTo(xx,-68);c.quadraticCurveTo(xx+18,-94,xx+3,-116);stroke(c,j%2?'#d8ba7c':'#397970',3);}
  for(let j=0;j<5;j++){const xx=-40+j*19;c.save();c.translate(xx,-88+(j%2)*8);c.rotate(j*.3);for(let k=0;k<5;k++)almond(c,0,0,k*TAU/5,10,3,j%2?'#e1c487':'#276c66');c.restore();}
  c.beginPath();for(let j=0;j<50;j++){const xx=-60+q()*132,yy=-115+q()*58;dot(c,xx,yy,.65);}c.fillStyle='#ead6a5';c.fill();c.restore();
  // A tapered head and forked antlers replace the former oval toy silhouette.
  c.beginPath();c.moveTo(66,-163);c.bezierCurveTo(77,-181,91,-174,105,-166);c.lineTo(117,-159);c.quadraticCurveTo(113,-150,97,-154);c.lineTo(77,-152);c.closePath();c.fillStyle='#b58450';c.fill();stroke(c,edge,.9);
  for(const [xx,dir] of [[72,-1],[80,1]]){c.beginPath();c.moveTo(xx,-171);c.bezierCurveTo(xx-15*dir,-197,xx+8*dir,-208,xx+3*dir,-236);stroke(c,'#714c2f',3.3);c.beginPath();c.moveTo(xx-2*dir,-192);c.lineTo(xx-17*dir,-211);c.moveTo(xx+4*dir,-208);c.lineTo(xx+21*dir,-224);stroke(c,'#9a7240',2);}
  almond(c,75,-171,-.75+Math.sin(t*.6)*.02,28,7,'#b18b59','#e3d0a2');
  c.beginPath();c.ellipse(91,-164,3.4,2,-.2,0,TAU);c.fillStyle='#302f26';c.fill();c.beginPath();c.arc(92,-165,.9,0,TAU);c.fillStyle='#fff2cc';c.fill();c.beginPath();c.moveTo(111,-159);c.lineTo(117,-159);stroke(c,'#3d352b',2.2);
  almond(c,-57,-78,-1.05+Math.sin(t*.5)*.05,24,7,'#99683e');c.restore();
 }
 function mexicoChunk(r,x0,add,z,act){
  add(2,(c,q)=>{orchardTree(c,x0+68,555,1.28,q,true);orchardTree(c,x0+570,555,.57,q,true);});
  add(3,(c)=>{
   for(const [x,w,h] of [[x0+370,100,13],[x0+68,76,10],[x0+570,42,7]]){
    c.save();c.translate(x,556);c.rotate(-.08);const shadow=c.createRadialGradient(0,0,1,0,0,w);shadow.addColorStop(0,'rgba(34,58,31,.38)');shadow.addColorStop(1,'rgba(34,58,31,0)');c.scale(1,h/w);c.fillStyle=shadow;c.fillRect(-w,-w,w*2,w*2);c.restore();
   }
  });
  act((c,t,q)=>{if(artVisible(x0+385,175))deer(c,x0+355,555,cv.clientWidth/cv.clientHeight<.85?.9:1.05,t,q);});
  for(const x of[x0+50,x0+305,x0+540]){
   add(4,(c,q)=>{const y=555;for(let j=0;j<6;j++){const a=(j-2.5)*.4;almond(c,x,y,a,35+q()*30,5+q()*5,'#49734a');}for(let j=0;j<4;j++){const xx=x-22+j*14,yy=y-35-q()*20;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);stroke(c,'#5e793e',1);folkFlower(c,xx,yy,7+q()*4,q);}});
  }
  act((c,t)=>{c.strokeStyle='rgba(240,227,176,.55)';c.lineWidth=.7;for(let j=0;j<8;j++){const x=x0+130+j*24,y=600+(j%3)*8+Math.sin(t*.6+j)*1.5;c.beginPath();c.moveTo(x-8,y);c.quadraticCurveTo(x,y-2,x+11,y);c.stroke();}});
 }
 function foregroundTile(style,key,i,k,height,worldWidth){
  const id=[key,seed,i,k.toFixed(3),height,Math.round(worldWidth)].join(':');if(nearTiles.has(id))return nearTiles.get(id);
  const tile=document.createElement('canvas');tile.width=Math.ceil(CW*k)+2;tile.height=height;const c=tile.getContext('2d');c.setTransform(k,0,0,k,-i*CW*k,-topY*k);
  // Neighbour-owned silhouettes cross cached tile boundaries without cuts.
  for(let owner=i-1;owner<=i+1;owner++){
   const q=mulberry32(hash(seed^0x921,owner)),x=owner*CW+36,small=worldWidth<400?.65:1;
   if(key==='mexico'){
    c.save();c.translate(x,665);c.scale(small,small);for(let j=0;j<8;j++)almond(c,0,0,-1.1+j*.32,88+q()*75,15+q()*12,j%2?'#275e54':'#396d58');for(let j=0;j<4;j++)folkFlower(c,25+j*16,-30-j*10,11+q()*5,q);c.restore();
   }else if(key==='japan'){
    jpBank(c,x,651,190*small,40,q);jpTree(c,x-35,645,.9*small,q,false);
   }else if(key==='china'){
    inkMass(c,x,669,175*small,75*small,q,'#65785f',.55);inkPine(c,x-22,628,.85*small,q);
   }else if(key==='kangra'){
    c.save();c.translate(x,661);c.scale(small,small);foliage(c,0,0,110,66,q);for(let j=0;j<9;j++){const xx=(q()-.5)*100,yy=-30-q()*50;c.beginPath();c.moveTo(xx*.3,0);c.quadraticCurveTo(xx*.5,yy*.65,xx,yy);stroke(c,j%2?'#7e8b53':'#526f43',1+q());if(j%3===0)kLotus(c,xx,yy+12,q);}c.restore();
   }else if(key==='madhubani'){
    for(let j=0;j<5;j++){const xx=x+(j-2)*17;mbLeaf(c,xx,663,(j-2)*.27,65+q()*35,17,'#287353');}mbLotus(c,x,630,39,'#b44149','#dcb94a');
   }else if(key==='gond'){
    c.save();c.translate(x,665);c.scale(small,small);for(let j=0;j<6;j++)leaf(c,0,0,-PI+(j+.5)*PI/6,80+q()*50,16,1,j%2?'#2f8c6d':'#3a657e','#dcb751');flower(c,-18,-38,23,'#d57839','#d9b741');c.restore();
   }else if(key==='warli'){
    c.save();c.translate(x,659);c.scale(small,small);wl(c,1.1);for(let j=0;j<7;j++){const ex=(j-3)*13,ey=-40-q()*44;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(ex*.5,-30,ex,ey);c.stroke();for(let n=0;n<5;n++){const yy=ey+n*5;c.beginPath();c.moveTo(ex,yy);c.lineTo(ex-5,yy-4);c.moveTo(ex,yy);c.lineTo(ex+5,yy-4);c.stroke();}}c.restore();
   }
  }
  nearTiles.set(id,tile);while(nearTiles.size>Math.max(4,Math.ceil(worldWidth/CW)+2))nearTiles.delete(nearTiles.keys().next().value);return tile;
 }
 function near(c,style,key,cam,vw,k,height){
  const nearCam=cam*1.16,a=Math.floor(nearCam/CW),b=Math.floor((nearCam+vw)/CW);
  c.setTransform(1,0,0,1,0,0);for(let i=a;i<=b;i++)c.drawImage(foregroundTile(style,key,i,k,height,vw),Math.round((i*CW-nearCam)*k),0);
 }
 function light(c,style,cam,vw,k,height){
  if(style!==STYLES.kangra)return;
  c.save();c.setTransform(k,0,0,k,-cam*k,-topY*k);c.globalCompositeOperation='multiply';c.fillStyle=style.tintGrad(c,cam,cam+vw);c.fillRect(cam,topY,vw,height/k);c.globalCompositeOperation='source-over';
  const n=dayW(cam+vw/2).n;if(n>.05){c.fillStyle='#fff3ce';for(let i=Math.floor(cam/31);i<=(cam+vw)/31;i++){const q=mulberry32(hash(seed^0x261,i));c.globalAlpha=n*(.4+q()*.5);c.beginPath();c.arc(i*31+q()*16,topY+8+q()*57,.5+q()*.6,0,TAU);c.fill();}}
  c.restore();
 }
 function atmosphere(c,style,cam,vw,k,height,t){
  if(!layered(style))return;
  const mexican=style===STYLES.mexico,kangra=style===STYLES.kangra,night=kangra?dayW(cam+vw/2).n:0;
  c.save();c.setTransform(k,0,0,k,0,-topY*k);
  // Light shafts move with the distant landscape, while suspended motes drift independently.
  if(mexican||kangra){
   const spacing=520,phase=cam*.58;
   for(let i=Math.floor(phase/spacing)-1;i<=(phase+vw)/spacing+1;i++){
    const q=mulberry32(hash(seed^0xa83,i)),x=i*spacing-phase+q()*80;
    c.save();c.globalAlpha=(1-night)*(kangra?.035:.19);c.beginPath();c.moveTo(x,topY-40);c.lineTo(x+32,topY-40);c.lineTo(x+260,580);c.lineTo(x+90,580);c.closePath();
    const beam=c.createLinearGradient(0,topY,0,580);beam.addColorStop(0,'rgba(255,241,183,0)');beam.addColorStop(.25,'rgba(255,241,183,.85)');beam.addColorStop(1,'rgba(255,241,183,0)');c.fillStyle=beam;c.fill();c.restore();
   }
   const haze=c.createLinearGradient(0,360,0,520);haze.addColorStop(0,'rgba(248,223,170,0)');haze.addColorStop(.6,'rgba(248,223,170,.13)');haze.addColorStop(1,'rgba(248,223,170,0)');c.globalAlpha=1-night;c.fillStyle=haze;c.fillRect(0,360,vw,160);
   c.globalAlpha=1;
   for(let i=Math.floor(cam/29)-1;i<=(cam+vw)/29+1;i++){
    const q=mulberry32(hash(seed^0x1b7,i)),x=i*29-cam+Math.sin(t*.12+q()*TAU)*13,y=260+q()*290+Math.sin(t*.2+i)*9;
    c.globalAlpha=(.22+.5*q())*(.5+.5*Math.sin(t*.55+i)**2);c.fillStyle=night>.5?'#e8edab':'#fff2bf';c.beginPath();c.ellipse(x,y,.8+q()*.8,1.2+q(),q()*PI,0,TAU);c.fill();
   }
  }
  c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;
  const w=vw*k,h=height,edge=c.createRadialGradient(w*.52,h*.42,Math.min(w,h)*.24,w*.52,h*.42,Math.max(w,h)*.77);edge.addColorStop(0,'rgba(17,39,31,0)');edge.addColorStop(1,'rgba(17,39,31,.28)');c.fillStyle=edge;c.fillRect(0,0,w,h);c.restore();
 }
 function install(){
  const nativeTree=kTree,nativePavilion=kPavilion;
  kTree=function(c,x,q,force){
   if(force==='cypress')return KangraWorld.cypress(c,x,q);
   if(!painted.kangraTree.width)return nativeTree(c,x,q,force);
   if(q()<.28)return KangraWorld.cypress(c,x,q);
   const h=150+q()*55,y=gy(x)+4,flip=q()<.5?-1:1;
   c.save();c.translate(x,y-1);c.scale(flip,1);
   c.beginPath();c.ellipse(0,0,h*.13,3,0,0,TAU);c.fillStyle='rgba(26,50,26,.22)';c.fill();
   c.drawImage(painted.kangraTree,6,9,1246,1238,-h*.5,-h,h,h);
   c.beginPath();for(let j=-3;j<=3;j++){c.moveTo(j*4,1);c.lineTo(j*4-2,-2);c.lineTo(j*4+1,0);}stroke(c,'#688b46',.7);c.restore();
  };
  kPavilion=function(c,x,q){
   if(!painted.kangraPavilion.width)return nativePavilion(c,x,q);
   const y=gy(x)+4;
   c.save();c.translate(x,y);c.scale(1,.13);const shade=c.createRadialGradient(0,0,1,0,0,90);shade.addColorStop(0,'rgba(25,47,30,.3)');shade.addColorStop(1,'rgba(25,47,30,0)');c.fillStyle=shade;c.fillRect(-90,-90,180,180);c.restore();
   c.drawImage(painted.kangraPavilion,34,18,1186,1206,x-85,y-180,170,180);
  };
  STYLES.mexico.sky=mexicoSky;STYLES.mexico.ground=mexicoGround;STYLES.mexico.chunk=mexicoChunk;STYLES.mexico.focus=360;
  STYLES.kangra.focus=330;STYLES.gond.focus=300;STYLES.madhubani.focus=180;STYLES.warli.focus=300;STYLES.japan.focus=300;STYLES.china.focus=220;
  const gond=STYLES.gond.chunk;STYLES.gond.chunk=function(r,x0,add,z,act){gond.call(this,r,x0,add,z,act);if(((x0/CW)%3+3)%3===0)act((c,t,q)=>{const x=x0+305;if(!artVisible(x,210))return;c.translate(x,gy(x));c.scale(1.3,1.3);c.translate(-x,-gy(x));peacock(c,x,q,{dir:1,t,ph:0,m:0,k:2});});};
  const madhubani=STYLES.madhubani.chunk;STYLES.madhubani.chunk=function(r,x0,add,z,act){madhubani.call(this,r,x0,add,z,act);const type=((Math.round(x0/CW)+(seed%4))%4+4)%4;if(type===3)add(2,function*(c,q){const x=x0+300;c.translate(x,gy(x));c.scale(1.08,1.08);c.translate(-x,-gy(x));yield* mbTree(c,x,q);});};
  const warli=STYLES.warli.chunk;STYLES.warli.chunk=function(r,x0,add,z,act){warli.call(this,r,x0,add,z,act);add(1,(c,q)=>{for(let j=0;j<2;j++){const x=x0+50+j*495;c.save();c.translate(x,425+j%2*8);c.scale(.65,.65);c.translate(-x,-gy(x));wHut(c,x,q);c.restore();}wl(c,.8);c.beginPath();c.moveTo(x0+20,438);c.quadraticCurveTo(x0+300,460,x0+580,438);c.stroke();});};
  const kangra=STYLES.kangra.chunk;STYLES.kangra.chunk=function(r,x0,add,z,act){kangra.call(this,r,x0,add,z,act);const section=this.zones[((Math.round(x0/CW)+2)%5+5)%5];if(section==='palace'||section==='lake'){add(4,(c,q)=>{
 const x=x0+330,y=550;c.beginPath();c.ellipse(x,y,105,23,0,0,TAU);c.fillStyle='#c3b891';c.fill();stroke(c,'#756f4d',1.2);
 c.beginPath();c.ellipse(x,y-1,95,18,0,0,TAU);const water=c.createLinearGradient(0,y-18,0,y+18);water.addColorStop(0,'#b1c8bc');water.addColorStop(1,'#5a988e');c.fillStyle=water;c.fill();
 for(let j=0;j<5;j++){c.beginPath();c.ellipse(x,y,20+j*15,3+j*2,0,0,TAU);stroke(c,'rgba(238,231,193,.5)',.6);}
 c.beginPath();c.moveTo(x,gy(x)+9);c.lineTo(x,523);stroke(c,'#d9cfa9',9);for(let j=0;j<4;j++){c.beginPath();c.moveTo(x-17,512+j*3);c.lineTo(x+17,512+j*3);stroke(c,'#a79b76',.8);}
 for(const sg of[-1,1]){kLotus(c,x+sg*70,y,q);for(let j=0;j<4;j++)kBush(c,x+sg*(120+j*14),q);}
 });act((c,t)=>{const x=x0+330,y=548;c.beginPath();c.moveTo(x-12,y);c.quadraticCurveTo(x-15,526+Math.sin(t)*1.5,x,522);c.quadraticCurveTo(x+15,526-Math.sin(t)*1.5,x+12,y);stroke(c,'rgba(218,239,221,.7)',.9);});}
 add(2,(c,q)=>treeSite(c,x0+90,q,1.05,gy));};
 }
 return {install,prepare,layered,near,light,atmosphere,treeSite,pavilionSite,flatSite,foliage,asset:key=>painted[key],reset(){nearTiles.clear();orchardTiles.clear();}};
})();
