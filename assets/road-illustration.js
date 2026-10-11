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
  const sw=im.naturalWidth*b[2],sh=im.naturalHeight*b[3],scale=Math.min(310/sw,390/sh),dw=sw*scale,dh=sh*scale;
  if(night)c.filter='brightness(.48) saturate(.65)';else if(snow)c.filter='saturate(.5) brightness(1.13)';
  c.drawImage(im,im.naturalWidth*b[0],im.naturalHeight*b[1],sw,sh,160-dw/2,398-dh,dw,dh);sprites.set(key,tile);return tile;
 }
 function mountains(c,w,h,horizon,j,ix,night){
  const im=image('mountains');if(!im||ix===1||ix===3||ix===4)return false;
  const width=Math.max(w*1.32,h*1.12),height=Math.min(width/3,h*.40),shift=Math.sin(j*.045)*width*.065;
  c.save();if(night)c.globalAlpha=.45;c.drawImage(im,(w-width)/2+shift,horizon-height,width,height+2);c.restore();return true;
 }
 function car(c,x,y,size,turn){
  const im=image('car');if(!im)return false;
  const width=size*135,height=width*im.naturalHeight/im.naturalWidth;
  c.save();c.translate(x,y);c.rotate(turn);
  const sh=c.createRadialGradient(0,0,2,0,0,width*.56);sh.addColorStop(0,'rgba(10,21,24,.65)');sh.addColorStop(1,'rgba(10,21,24,0)');c.save();c.scale(1,.22);c.fillStyle=sh;c.fillRect(-width*.6,-width*.6,width*1.2,width*1.2);c.restore();
  c.drawImage(im,-width/2,-height*.95,width,height);c.restore();return true;
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
   if(x<-s||x>w+s||ix===3&&x<rx(z)-hw(z)*1.55+s)continue;
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
 return {prop,mountains,car,landscape,verge};
})();
