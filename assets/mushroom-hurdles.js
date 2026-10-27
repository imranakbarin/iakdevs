/* Cinematic hurdle dressing for the physical Mushroom Island runner.
 * One shared world-space obstacle source. All objects touch the same path
 * and borrow the warm, rounded materials of the kingdom artwork.
 */
(function(root){
'use strict';
const PI=Math.PI,TAU=PI*2;
function paint(ctx,o){
 const {W,H,world,clock,ground,physics,bounceCap}=o;
 const center=W*.34,gy=ground()+10;
 const near=physics.range(world-center-140,world+W-center+160);
 function xOf(f){return center+f.x-world;}
 function grad(x,y,x2,y2,colors){const g=ctx.createLinearGradient(x,y,x2,y2);
   colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;}
 function oval(x,y,w,h,fill){ctx.beginPath();ctx.ellipse(x,y,Math.max(.5,w),Math.max(.5,h),0,0,TAU);
   ctx.fillStyle=fill;ctx.fill();}
 function round(x,y,w,h,r,col){ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(r,w/2,h/2));ctx.fillStyle=col;ctx.fill();}
 function glow(x,y,r,a){const g=ctx.createRadialGradient(x,y,0,x,y,r);
   g.addColorStop(0,'rgba(255,220,135,'+a+')');g.addColorStop(1,'rgba(255,245,190,0)');
   ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 function rock(x,y,w,h,variation=0){
   ctx.save();ctx.translate(x,y);
   oval(2,3,w*.64,6,'rgba(43,51,43,.25)');
   ctx.beginPath();ctx.moveTo(-w*.53,0);
   ctx.bezierCurveTo(-w*.54,-h*.58,-w*.19,-h,0,-h);
   ctx.bezierCurveTo(w*.25,-h*1.08,w*.58,-h*.52,w*.52,0);ctx.closePath();
   // Three light-matched material families, including negative chunks.
   if(variation%3===0)ctx.fillStyle=grad(-w*.6,-h,w*.5,0,['#f5dbb6','#c5a084','#87738a']);
   else if(variation%3===1)ctx.fillStyle=grad(-w*.6,-h,w*.5,0,['#e4d0c3','#b9a6ac','#8d769a']);
   else ctx.fillStyle=grad(-w*.6,-h,w*.5,0,['#edc79d','#c28c83','#8c768d']);
   ctx.fill();ctx.strokeStyle='rgba(107,88,99,.37)';ctx.lineWidth=1.5;ctx.stroke();
   ctx.save();ctx.clip();
   for(let i=0;i<7;i++){
     const px=(Math.sin(variation*11+i*4)*.4)*w,py=-h*(.14+i*.10);
     oval(px,py,Math.max(1,w*.045),Math.max(1,h*.023),'rgba(255,247,226,.26)');
   }
   ctx.restore();
   ctx.beginPath();ctx.moveTo(-w*.44,-h*.20);
   ctx.quadraticCurveTo(-w*.22,-h*.34,w*.11,-h*.25);
   ctx.strokeStyle='rgba(255,233,175,.43)';ctx.lineWidth=4;ctx.stroke();
   ctx.restore();
 }
 function log(x,y,w,h){
   ctx.save();ctx.translate(x,y);
   oval(0,3,w*.56,7,'rgba(47,58,52,.27)');
   round(-w/2,-h,w,h,9,grad(-w/2,-h,w/2,1,['#f5c997','#bb8f84','#926d79']));
   oval(-w/2+7,-h*.48,8,h*.42,'#e8b38d');
   oval(-w/2+8,-h*.48,4,h*.22,'#b77a73');
   for(let j=0;j<3;j++){
     ctx.beginPath();ctx.moveTo(-w*.25+j*w*.23,-h+4);
     ctx.quadraticCurveTo(-w*.18+j*w*.2,-h*.55,-w*.27+j*w*.23,-4);
     ctx.strokeStyle='rgba(255,230,185,.35)';ctx.lineWidth=2;ctx.stroke();
   }
   // Moss pads around the base root it in the terrain.
   for(const dir of[-1,1])oval(dir*w*.40,0,w*.15,5,'#648f6e');
   ctx.restore();
 }
 function canopy(x,y,w,h){
   ctx.save();ctx.translate(x,y);
   const edgeX=w*.42;
   for(const dir of[-1,1]){
     round(dir*edgeX-7,-h*.95,15,h*.95,7,grad(dir*edgeX-7,-h,dir*edgeX+7,0,
       ['#f2d6b0','#b4878b','#967889']));
     oval(dir*edgeX,1,17,5,'rgba(61,82,55,.2)');
   }
   ctx.beginPath();ctx.moveTo(-edgeX,-h*.98);
   ctx.quadraticCurveTo(0,-h*1.48,edgeX,-h*.98);
   ctx.strokeStyle='#99788e';ctx.lineWidth=15;ctx.stroke();
   ctx.beginPath();ctx.moveTo(-edgeX,-h*1.01);
   ctx.quadraticCurveTo(0,-h*1.51,edgeX,-h*1.01);
   ctx.strokeStyle='#f2ca9e';ctx.lineWidth=8;ctx.stroke();
   for(let j=-2;j<=2;j++){
     const px=j*w*.15,py=-h*(1.13+.18*(1-Math.abs(j)/2));
     oval(px,py,7,9,j%2?'#89b98c':'#c7d7a0');
   }
   ctx.restore();
 }
 function spring(x,y,height,baseImage){
   const width=height*1.25;
   if(baseImage&&baseImage.complete&&baseImage.naturalWidth){
     const realWidth=height*baseImage.naturalWidth/baseImage.naturalHeight;
     ctx.drawImage(baseImage,x-realWidth/2,y-height,realWidth,height);
   }else{
     rock(x,y,width,height,1);
     oval(x,y-height+12,width*.43,12,'#e891a4');
   }
   glow(x,y-height+8,26,.16+.04*Math.sin(clock*3));
 }
 function gate(x,y,w,h){
   ctx.save();ctx.translate(x,y);
   // A portal of sunlit flowering vines, not a sharp rectangular barrier.
   ctx.beginPath();ctx.moveTo(-w*.48,-4);ctx.bezierCurveTo(-w*.47,-h*.76,-w*.30,-h,0,-h);
   ctx.bezierCurveTo(w*.30,-h,w*.47,-h*.76,w*.48,-4);
   ctx.lineWidth=12;ctx.strokeStyle='#b98b89';ctx.stroke();
   ctx.beginPath();ctx.moveTo(-w*.48,-7);ctx.bezierCurveTo(-w*.46,-h*.81,-w*.28,-h*.99,0,-h*.99);
   ctx.bezierCurveTo(w*.28,-h*.99,w*.46,-h*.81,w*.48,-7);
   ctx.lineWidth=5;ctx.strokeStyle='#e8c9a2';ctx.stroke();
   for(let j=0;j<7;j++){
     const px=(j-3)*w*.133;
     const py=-h*.82-Math.sin((j+1)/8*PI)*h*.18;
     oval(px,py,5,8,j%2?'#edb2ae':'#f8dcac');
   }
   ctx.restore();
 }
 function flower(x,y,h){
   ctx.save();ctx.translate(x,y);
   ctx.beginPath();ctx.moveTo(0,-2);
   ctx.quadraticCurveTo(-6,-h*.50,3,-h);
   ctx.strokeStyle='#507c65';ctx.lineWidth=6;ctx.stroke();
   oval(-10,-h*.37,16,7,'#7dba85');
   oval(12,-h*.61,14,7,'#8fc58c');
   const head=-h+Math.sin(clock*.8+x)*2;
   for(let j=0;j<5;j++){
     const a=j*TAU/5;
     oval(Math.cos(a)*14,head+Math.sin(a)*14,8,12,'#f3b3b2');
   }
   oval(0,head,9,9,'#ffdc8b');
   glow(0,head,28,.15);
   ctx.restore();
 }
 for(const f of near){
   const x=xOf(f);
   if(x<-200||x>W+200)continue;
   if(f.type==='fallen-log')log(x,gy,f.width,32);
   else if(f.type==='mossy-stump')rock(x,gy,f.width,50,f.index);
   else if(f.type==='round-boulder')rock(x,gy,f.width,64,f.index);
   else if(f.type==='stepping-stones'){
     for(let k=0;k<3;k++)rock(x+(k-1)*26,gy,25,25+k*6,k+f.index);
   }else if(f.type==='lantern-flower')flower(x,gy,51);
   else if(f.type==='spring-mushroom')spring(x,gy,85,bounceCap);
   else if(f.type==='low-arch')canopy(x,gy,f.width,92);
   else if(f.type==='wind-arch')gate(x,gy,124,125);
   else if(f.type==='speed-gate'){
     gate(x,gy,116,184);
     for(let j=0;j<4;j++){
       const sx=x-74-j*27;glow(sx,gy-28-j*6,12,.11);
     }
   }else if(f.type==='ravine'){
      // Both ends are rooted at the same ledge lip and visually frame the gap.
      const lx=center+f.left-world,rx=center+f.right-world;
      rock(lx-12,gy+5,44,41,f.index);
      rock(rx+14,gy+5,43,43,f.index+1);
   }
 }
}
root.MushroomHurdles={paint};
})(window);
