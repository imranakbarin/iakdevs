/* Painted scenery stays separate from the simulated road, traffic and camera. */
const RoadIllustration=(()=>{
 const images=new Map(),sprites=new Map();
 function image(name){if(!images.has(name)){const im=new Image();im.onload=()=>{sprites.clear();if(typeof wakeScene==='function')wakeScene();};im.src='assets/road-painted-'+name+'.webp';images.set(name,im);}const im=images.get(name);return im.complete&&im.naturalWidth?im:null;}
 function prop(kind,night,snow){
  const im=image('props');if(!im)return null;
  const key=kind+':'+night+':'+snow;if(sprites.has(key))return sprites.get(key);
  // Leave a transparent gutter between each object: no neighbouring roof or root fragments.
  const boxes=[[0,0,.485,.545],[.49,0,.51,.545],[0,.61,.50,.39],[.53,.565,.47,.435]],b=boxes[kind];
  const tile=document.createElement('canvas');tile.width=320;tile.height=400;const c=tile.getContext('2d');
  const source=document.createElement('canvas');source.width=Math.round(im.naturalWidth*b[2]);source.height=Math.round(im.naturalHeight*b[3]);
  const sc=source.getContext('2d');sc.drawImage(im,im.naturalWidth*b[0],im.naturalHeight*b[1],source.width,source.height,0,0,source.width,source.height);
  // Trim alpha gutters once. The final opaque root/foundation now lands exactly at y=398.
  const data=sc.getImageData(0,0,source.width,source.height).data;let left=source.width,right=0,top=source.height,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(data[(y*source.width+x)*4+3]>48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const sw=Math.max(1,right-left+1),sh=Math.max(1,bottom-top+1),scale=Math.min(310/sw,390/sh),dw=sw*scale,dh=sh*scale;
  if(night)c.filter='brightness(.48) saturate(.65)';else if(snow)c.filter='saturate(.5) brightness(1.13)';
  c.drawImage(source,left,top,sw,sh,160-dw/2,398-dh,dw,dh);sprites.set(key,tile);return tile;
 }
 function mountains(c,w,h,horizon,j,ix,night){
  const im=image('mountains');if(!im||ix===1||ix===3||ix===4)return false;
  const width=Math.max(w*1.32,h*1.12),height=Math.min(width/3,h*.40),shift=Math.sin(j*.045)*width*.065;
  c.save();if(night)c.globalAlpha=.45;c.drawImage(im,(w-width)/2+shift,horizon-height,width,height+2);c.restore();return true;
 }
 let carContact=null;
 function car(c,x,y,size,turn){
  const im=image('car');if(!im)return false;
  if(!carContact){
   const source=document.createElement('canvas');source.width=im.naturalWidth;source.height=im.naturalHeight;const q=source.getContext('2d');q.drawImage(im,0,0);const data=q.getImageData(0,0,source.width,source.height).data;
   let left=source.width,right=0,top=source.height,bottom=0;
   for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(data[(y*source.width+x)*4+3]>48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   carContact=document.createElement('canvas');carContact.width=right-left+1;carContact.height=bottom-top+1;carContact.getContext('2d').drawImage(source,left,top,carContact.width,carContact.height,0,0,carContact.width,carContact.height);
  }
  const width=size*135,height=width*carContact.height/carContact.width;
  c.save();c.translate(x,y);c.rotate(turn);
  const sh=c.createRadialGradient(0,0,2,0,0,width*.56);sh.addColorStop(0,'rgba(10,21,24,.65)');sh.addColorStop(1,'rgba(10,21,24,0)');c.save();c.scale(1,.22);c.fillStyle=sh;c.fillRect(-width*.6,-width*.6,width*1.2,width*1.2);c.restore();
  c.drawImage(carContact,-width/2,-height,width,height);c.restore();return true;
 }
 function landscape(c,w,h,horizon,j,ix){
  // Distant architecture belongs to the horizon, rather than rows of towers beside the tyres.
  if(ix===4){
   for(let layer=0;layer<2;layer++)for(let i=0;i<27;i++){
    const q=mulberry32(418+i*71+layer*113),bw=w*(.014+q()*.034),bh=h*(.016+q()*.085)*(1+layer*.2);
    const x=((i*w/23-j*w*(.0007+layer*.0005))%(w*1.2)+w*1.2)%(w*1.2)-w*.1;
    c.fillStyle=layer?'#809d9c':'#adc0ba';c.fillRect(x,horizon-bh,bw,bh);
    c.fillStyle=layer?'#b5c8bc':'#ccd6c8';c.fillRect(x,horizon-bh,bw*.18,bh);
    if(layer){c.fillStyle='#526e74';for(let y=horizon-bh+6;y<horizon-5;y+=8)for(let xx=x+5;xx<x+bw-3;xx+=7)c.fillRect(xx,y,2,3);}
   }
  }
  if(ix===1){
   for(let i=0;i<7;i++){
    const q=mulberry32(431+i*61),x=i*w/5-j*w*.0013,bw=w*(.12+q()*.12),bh=h*(.04+q()*.09),y=horizon+h*.008;
    c.beginPath();c.moveTo(x-bw*.65,y);c.lineTo(x-bw*.24,y-bh*.8);c.lineTo(x-bw*.19,y-bh);c.lineTo(x+bw*.2,y-bh*.94);c.lineTo(x+bw*.27,y-bh*.75);c.lineTo(x+bw*.65,y);c.closePath();
    const wash=c.createLinearGradient(x-bw*.3,y-bh,x+bw*.3,y);wash.addColorStop(0,'#c88060');wash.addColorStop(.55,'#bf7157');wash.addColorStop(1,'#d59a75');c.fillStyle=wash;c.fill();
    c.strokeStyle='rgba(238,184,128,.42)';c.lineWidth=1;for(let k=1;k<6;k++){c.beginPath();c.moveTo(x-bw*.2,y-bh+k*bh*.13);c.lineTo(x+bw*.2,y-bh+k*bh*.13);c.stroke();}
   }
  }
  if(ix===3){
   c.fillStyle='#6d9b8e';c.beginPath();c.moveTo(w*.38,horizon);c.bezierCurveTo(w*.56,horizon-h*.05,w*.64,horizon-h*.17,w*.81,horizon-h*.12);c.bezierCurveTo(w*.91,horizon-h*.09,w*.98,horizon-h*.03,w,horizon);c.closePath();c.fill();
   c.fillStyle='#9ab6a0';c.beginPath();c.moveTo(w*.38,horizon);c.bezierCurveTo(w*.6,horizon-h*.04,w*.65,horizon-h*.14,w*.81,horizon-h*.12);c.bezierCurveTo(w*.7,horizon-h*.03,w*.7,horizon,w*.38,horizon);c.fill();
  }
 }
 function verge(c,rx,hw,yy,w,h,j,ix){
  // Bounded, seeded ground details; positions advance in road distance with irregular spacing.
  for(let side of [-1,1])for(let i=0;i<64;i++){
   const q=mulberry32(732+i*67+side*311),d=33+((i*21.8+q()*18-j*42)%1400+1400)%1400,z=36/d-.025;
   if(z<=0||z>1.03)continue;
   const x=rx(z)+side*hw(z)*(1.28+q()*6),y=yy(z),s=z*Math.min(w,h)*.026;
   if(x<-s||x>w+s||ix===3&&x<rx(z)-hw(z)*1.55+s||((ix===0||ix===2)&&side>0&&Math.abs((x-rx(z))/hw(z)-4.4)<.5))continue;
   c.fillStyle=ix===1?'#ac7754':ix===3?'#abaf77':ix===4?'#657e6f':'#466744';
   c.beginPath();c.ellipse(x+s*.15,y+s*.04,s*.7,s*.19,0,0,Math.PI*2);c.fill();
   if(ix===1||i%4===0){
    const g=c.createLinearGradient(x-s,y-s,x+s,y);g.addColorStop(0,ix===1?'#d9b38a':'#9caa89');g.addColorStop(1,ix===1?'#9d755b':'#526c61');c.fillStyle=g;
    c.beginPath();c.moveTo(x-s*.55,y);c.lineTo(x-s*.4,y-s*.38);c.lineTo(x+s*.1,y-s*.52);c.lineTo(x+s*.6,y-s*.17);c.lineTo(x+s*.5,y);c.closePath();c.fill();
   }else{
    for(let k=0;k<5;k++){c.fillStyle=k%2?'#7c965c':'#597c51';c.beginPath();c.ellipse(x+(q()-.5)*s,y-q()*s*.22,s*(.13+q()*.13),s*.1,-q(),0,Math.PI*2);c.fill();}
    if(i%7===0){c.fillStyle=i%2?'#e6c797':'#b8b4d4';c.beginPath();c.arc(x,y-s*.18,Math.max(.7,s*.06),0,Math.PI*2);c.fill();}
   }
  }
 }
 const landmarkCache=new Map();
 function landmark(ix,variant){
  const key=ix+':'+variant;if(landmarkCache.has(key))return landmarkCache.get(key);
  const tile=document.createElement('canvas');tile.width=440;tile.height=340;
  const c=tile.getContext('2d');c.translate(220,320);c.lineJoin='round';
  const line=(color,width,points)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();};
  const shape=(color,points)=>{c.fillStyle=color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();};
  const pane=(x,y,w=24,h=29)=>{c.fillStyle='#344f58';c.fillRect(x,y,w,h);c.fillStyle='#91beb8';c.fillRect(x+2,y+2,w-4,h-4);line('#e6d7a9',2,[[x+w/2,y],[x+w/2,y+h]]);line('#e6d7a9',2,[[x,y+h/2],[x+w,y+h/2]]);};
  const pot=(x,y)=>{c.fillStyle='#95593e';c.fillRect(x-7,y-11,14,11);for(let k=0;k<5;k++){c.fillStyle=k%2?'#7f9854':'#426942';c.beginPath();c.ellipse(x+(k-2)*4,y-13-k%2*3,6,4,k,0,Math.PI*2);c.fill();}c.fillStyle='#ecc396';c.beginPath();c.arc(x+3,y-17,2,0,Math.PI*2);c.fill();};
  const cottage=(label)=>{
   shape('#c6b48d',[[-112,0],[-112,-99],[68,-99],[103,-76],[103,0]]);shape('#857f65',[[68,-99],[103,-76],[103,0],[68,0]]);
   shape('#8d5140',[[-125,-96],[-29,-167],[80,-96]]);shape('#684c40',[[-29,-167],[72,-144],[115,-75],[80,-96]]);
   for(let i=0;i<7;i++)line('#c07e57',1,[[-113+i*12,-98-i*8],[66-i*11,-98-i*8]]);
   for(let y=-90;y<-5;y+=12)line('rgba(86,64,44,.28)',1,[[-110,y],[68,y]]);
   for(const x of [-91,32])pane(x,-79);c.fillStyle='#694f3c';c.fillRect(-30,-68,38,68);pane(-25,-63,27,21);c.fillStyle='#d8bd78';c.beginPath();c.arc(0,-28,2,0,Math.PI*2);c.fill();
   c.fillStyle='#d8c19a';c.fillRect(-115,-113,190,19);c.fillStyle='#524c3d';c.font='bold 12px Georgia';c.textAlign='center';c.fillText(label,-20,-99);
   shape('#8e8d73',[[-41,0],[23,0],[32,7],[-49,7]]);pot(-88,0);pot(55,0);
  };
  if((ix===0||ix===2)&&variant===1){
   // A campsite has a visibly grounded tent, stacked logs and a picnic table.
   shape('#aab688',[[-128,0],[-46,-113],[45,0]]);shape('#6d8466',[[-46,-113],[50,-92],[127,0],[45,0]]);shape('#314f46',[[-92,-4],[-47,-92],[0,-4]]);shape('#d8bb78',[[-95,-4],[-47,-92],[-35,-4]]);
   line('#c3bda0',2,[[-47,-113],[-146,0]]);line('#c3bda0',2,[[50,-92],[145,0]]);
   shape('#927254',[[49,-33],[150,-33],[155,-24],[45,-24]]);line('#5c5544',6,[[60,-25],[54,0]]);line('#5c5544',6,[[139,-25],[147,0]]);
   for(let k=0;k<4;k++){c.fillStyle='#795b42';c.beginPath();c.roundRect(-21+k*11,-15-k%2*5,35,9,4);c.fill();c.fillStyle='#bca279';c.beginPath();c.arc(-15+k*11,-10-k%2*5,3,0,Math.PI*2);c.fill();}
  }else if(ix===1&&variant===1){
   shape('#bda17b',[[-23,0],[-13,-165],[18,-165],[30,0]]);for(let y=-155;y<-4;y+=16)line('#8b785c',2,[[-19,y],[24,y]]);
   c.fillStyle='#485c5a';c.beginPath();c.ellipse(0,-180,25,25,0,0,Math.PI*2);c.fill();line('#c4b788',3,[[-21,-180],[22,-180]]);line('#c4b788',3,[[0,-203],[0,-157]]);
   shape('#827353',[[39,0],[39,-39],[101,-39],[101,0]]);c.fillStyle='#b5aaa1';c.beginPath();c.ellipse(70,-39,31,8,0,0,Math.PI*2);c.fill();
  }else if(ix===3&&variant===0){
   shape('#e0dcc4',[[-40,0],[-23,-195],[23,-195],[40,0]]);for(const y of [-155,-80])shape('#b3654d',[[-28-y*.05,y],[28+y*.05,y],[30+y*.05,y+28],[-30-y*.05,y+28]]);
   c.fillStyle='#485e60';c.fillRect(-27,-226,54,31);pane(-17,-221,34,23);shape('#665d50',[[-34,-226],[0,-251],[34,-226]]);c.fillStyle='#68786c';c.fillRect(-39,-197,78,5);line('#66766a',2,[[-38,-204],[38,-204]]);
   c.fillStyle='#45615d';c.beginPath();c.roundRect(-10,-30,20,30,7);c.fill();pot(46,0);pot(-48,0);
  }else if(ix===4&&variant===1){
   c.fillStyle='#94734e';c.fillRect(-130,-31,245,9);for(const x of [-116,103])c.fillRect(x,-25,6,25);
   for(let j=0;j<3;j++){c.fillStyle=['#b7634d','#798e55','#d6b47b'][j];c.fillRect(-118+j*77,-53,66,21);for(let k=0;k<13;k++){c.fillStyle=k%2?'#e6b86c':'#779552';c.beginPath();c.arc(-111+j*77+(k%7)*8,-45-Math.floor(k/7)*7,3.5,0,Math.PI*2);c.fill();}}
   line('#635e46',4,[[-128,0],[-128,-118],[116,-118],[116,0]]);
   for(let k=0;k<10;k++)shape(k%2?'#ecd7ad':'#b7664c',[[-146+k*28,-118],[-118+k*28,-118],[-101+k*28,-91],[-129+k*28,-91]]);
   c.fillStyle='#e2caa5';c.fillRect(-67,-138,123,19);c.fillStyle='#4a5948';c.font='bold 12px Georgia';c.textAlign='center';c.fillText('FARM MARKET',-6,-124);pot(-150,0);pot(145,0);
  }else{
   cottage(ix===0?'ALPINE CAFÉ':ix===1?'DESERT REST STOP':ix===2?'WOODLAND LODGE':ix===3?'COASTAL CAFÉ':'CORNER CAFÉ');
   if(ix===1){c.fillStyle='#b7664b';c.beginPath();c.roundRect(125,-71,31,67,4);c.fill();pane(129,-64,23,19);line('#3e4b44',4,[[157,-60],[167,-44],[164,-14],[155,-19]]);}
   if(ix===4){for(let j=0;j<8;j++)shape(j%2?'#dfd0ac':'#608778',[[-117+j*24,-54],[-93+j*24,-54],[-92+j*24,-35],[-122+j*24,-35]]);}
  }
  // Cached pigment texture keeps large flat surfaces from reading as plastic.
  const rnd=mulberry32(932+ix*31+variant);c.globalCompositeOperation='source-atop';for(let k=0;k<1700;k++){c.fillStyle=k%2?'rgba(237,225,180,.09)':'rgba(42,57,46,.09)';c.fillRect((rnd()-.5)*400,-rnd()*300,1+rnd()*2,.7+rnd());}c.globalCompositeOperation='source-over';
  landmarkCache.set(key,tile);return tile;
 }
 function scenery(c,P,w,h,horizon,j,ix,t){
  const {rx,hw,yy}=P;
  if(ix===0||ix===2){
   // A winding stream is embedded in the same ground projection as the verge.
   const bank=(offset,width,color)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<=50;i++){const z=i/50;c.lineTo(rx(z)+hw(z)*(offset+Math.sin(z*7+j*.025)*.15-width),yy(z));}for(let i=50;i>=0;i--){const z=i/50;c.lineTo(rx(z)+hw(z)*(offset+Math.sin(z*7+j*.025)*.15+width),yy(z));}c.closePath();c.fill();};
   bank(4.4,.35,ix===0?'#a7b49b':'#88a68c');bank(4.4,.24,'#609ca0');
   c.save();c.strokeStyle='rgba(216,236,212,.52)';
   for(let i=0;i<22;i++){const d=35+((i*62-j*42)%1350+1350)%1350,z=36/d-.025;if(z<=0||z>1)continue;const x=rx(z)+hw(z)*(4.4+Math.sin(z*7+j*.025)*.15);c.lineWidth=Math.max(.6,z*1.2);c.beginPath();c.moveTo(x-hw(z)*.12,yy(z)+Math.sin(t*1.2+i));c.lineTo(x+hw(z)*.1,yy(z));c.stroke();}c.restore();
   // A low stone viaduct sits across the far valley, with its supports embedded in earth.
   if(ix===0){const x=w*.11+Math.sin(j*.02)*w*.012,y=horizon+h*.011,s=Math.min(w,h)*.0018;c.save();c.translate(x,y);c.scale(s,s);
    c.fillStyle='#738b7b';c.fillRect(-100,-35,206,9);
    for(let k=0;k<7;k++){const xx=-100+k*29;c.fillStyle='#718978';c.fillRect(xx,-27,7,32);c.beginPath();c.moveTo(xx+6,-22);c.quadraticCurveTo(xx+16,-41,xx+29,-22);c.lineWidth=5;c.strokeStyle='#718978';c.stroke();}
    c.strokeStyle='#b7c6a5';c.lineWidth=2;c.beginPath();c.moveTo(-101,-35);c.lineTo(107,-35);c.stroke();c.restore();}
  }
  if(ix===3){
   // Two sailboats remain in the sea; their shadows and wakes stay on the water.
   for(let k=0;k<2;k++){const y=horizon+h*(.1+k*.1),s=Math.min(w,h)*(.00042+k*.00022),z=(y-horizon)/(h-horizon),shore=rx(z)-hw(z)*1.55,x=Math.min(w*(.14+k*.12)+Math.sin(j*.03+k)*w*.025,shore-48*s-8);if(x<45*s)continue;
    c.save();c.translate(x,y+Math.sin(t*.65+k)*s*2);c.scale(s,s);c.strokeStyle='rgba(239,248,225,.4)';c.lineWidth=1.4;for(let a=0;a<3;a++){c.beginPath();c.moveTo(-40-a*7,6+a*4);c.quadraticCurveTo(0,9+a*4,45+a*12,6+a*4);c.stroke();}
    c.fillStyle='#6e7970';c.beginPath();c.moveTo(-33,0);c.lineTo(35,0);c.lineTo(22,10);c.lineTo(-19,10);c.closePath();c.fill();c.strokeStyle='#6a7469';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(0,-75);c.stroke();c.fillStyle='#f0e4bc';c.beginPath();c.moveTo(-2,-72);c.lineTo(-30,-5);c.lineTo(-2,-5);c.closePath();c.fill();c.fillStyle='#ddd5b5';c.beginPath();c.moveTo(4,-63);c.quadraticCurveTo(25,-31,30,-8);c.lineTo(4,-8);c.closePath();c.fill();c.restore();
   }
  }
  // Field boundaries use projected curves instead of flat horizontal wallpaper.
  if(ix===1||ix===4){
   for(let side of [-1,1])for(let k=0;k<6;k++){
    c.strokeStyle=ix===1?'rgba(140,87,47,.15)':'rgba(78,104,69,.23)';c.lineWidth=1.5;c.beginPath();
    for(let i=0;i<=40;i++){const z=i/40;c.lineTo(rx(z)+side*hw(z)*(1.6+k*.57),yy(z));}c.stroke();
   }
  }
 }
 function encounters(j,ix){
  const camera=j*42,list=[];
  for(let k=Math.floor(camera/260);k<=Math.floor(camera/260)+6;k++){
   const rnd=mulberry32(7291+k*97+ix*431),distance=k*260+120+rnd()*90-camera,z=36/distance-.025;
   if(distance<=34||z<=0||z>1.03)continue;
   list.push({i:k,z,side:ix===3?1:k%2?1:-1,landmark:true,variant:k%2});
  }return list;
 }
 function foundation(c,x,y,s,ix,width=130){
  c.save();c.translate(x,y);c.scale(s,s);
  c.fillStyle=ix===1?'#ba875b':ix===3?'#c5b98c':'#81916d';c.beginPath();c.ellipse(0,2,width,20,0,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(20,39,31,.24)';c.beginPath();c.ellipse(8,0,width*.85,8,0,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(18,31,24,.3)';c.beginPath();c.ellipse(0,-.8,width*.55,2.8,0,0,Math.PI*2);c.fill();c.restore();
 }
 function landmarkMotion(c,x,y,s,ix,variant,t){
  c.save();c.translate(x,y);c.scale(s,s);
  if(ix===1&&variant===1){c.save();c.translate(0,-180);c.rotate(t*.52);for(let k=0;k<8;k++){c.rotate(Math.PI/4);c.fillStyle=k%2?'#c6b98b':'#93a39a';c.beginPath();c.moveTo(5,-3);c.lineTo(29,-6);c.lineTo(23,4);c.lineTo(5,3);c.closePath();c.fill();}c.fillStyle='#344e4c';c.beginPath();c.arc(0,0,4,0,Math.PI*2);c.fill();c.restore();}
  if((ix===0||ix===2)&&variant===1){for(let k=0;k<3;k++){const u=(t*.12+k/3)%1;c.strokeStyle='rgba(225,221,193,'+((1-u)*.15)+')';c.lineWidth=3+u*6;c.beginPath();c.moveTo(8,-14-u*62);c.quadraticCurveTo(19+Math.sin(t+k)*6,-24-u*62,6+Math.sin(t*.6+k)*8,-39-u*62);c.stroke();}}
  c.restore();
 }
 return {prop,mountains,car,landscape,verge,landmark,encounters,foundation,landmarkMotion,scenery};
})();
