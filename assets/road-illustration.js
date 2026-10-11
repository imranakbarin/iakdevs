/* Painted scenery stays separate from the simulated road, traffic and camera. */
const RoadIllustration=(()=>{
 const images=new Map(),sprites=new Map();
 function image(name){if(!images.has(name)){const im=new Image();im.onload=()=>{sprites.clear();if(typeof wakeScene==='function')wakeScene();};im.src='assets/road-painted-'+name+'.webp';images.set(name,im);}const im=images.get(name);return im.complete&&im.naturalWidth?im:null;}
 function prop(kind,night,snow){
  const im=image('props');if(!im)return null;
  const key=kind+':'+night+':'+snow;if(sprites.has(key))return sprites.get(key);
  const boxes=[[0,0,.49,.55],[.49,0,.51,.55],[0,.59,.50,.41],[.51,.55,.49,.45]],b=boxes[kind];
  const tile=document.createElement('canvas');tile.width=320;tile.height=400;const c=tile.getContext('2d');
  const sw=im.naturalWidth*b[2],sh=im.naturalHeight*b[3],scale=Math.min(310/sw,390/sh),dw=sw*scale,dh=sh*scale;
  if(night)c.filter='brightness(.48) saturate(.65)';else if(snow)c.filter='saturate(.5) brightness(1.13)';
  c.drawImage(im,im.naturalWidth*b[0],im.naturalHeight*b[1],sw,sh,160-dw/2,398-dh,dw,dh);sprites.set(key,tile);return tile;
 }
 function mountains(c,w,h,horizon,j,ix,night){
  const im=image('mountains');if(!im||ix===1||ix===4)return false;
  const width=Math.max(w*1.12,h*1.05),height=Math.min(width/3,h*.40),shift=Math.sin(j*.012)*width*.035;
  c.save();if(night)c.globalAlpha=.45;c.drawImage(im,(w-width)/2+shift,horizon-height,width,height+2);c.restore();return true;
 }
 function car(c,x,y,size,turn){
  const im=image('car');if(!im)return false;
  const width=size*135,height=width*im.naturalHeight/im.naturalWidth;
  c.save();c.translate(x,y);c.rotate(turn);
  const sh=c.createRadialGradient(0,0,2,0,0,width*.56);sh.addColorStop(0,'rgba(10,21,24,.65)');sh.addColorStop(1,'rgba(10,21,24,0)');c.save();c.scale(1,.22);c.fillStyle=sh;c.fillRect(-width*.6,-width*.6,width*1.2,width*1.2);c.restore();
  c.drawImage(im,-width/2,-height*.95,width,height);c.restore();return true;
 }
 return {prop,mountains,car};
})();
