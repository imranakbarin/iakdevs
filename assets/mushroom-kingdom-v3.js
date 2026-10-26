/* Mushroom Kingdom v3 — a panoramic, original fantasy archipelago.
 * This is the distant living environment behind the playable-looking
 * 2.5D runner lane, never a static screenshot or Nintendo level.
 *
 * Terrain, architecture and water are all drawn in a coherent local
 * coordinate system. Every building rests on an island terrace;
 * bridges connect the actual adjacent terraces.
 */
const MushroomKingdom = (() => {
'use strict';
const PI=Math.PI,TWO=PI*2;
let c,W,H,cam,time;
const f=(n)=>{let a=(n^0x9e3779b9)|0;a=Math.imul(a^(a>>>16),0x85ebca6b);a=Math.imul(a^(a>>>13),0xc2b2ae35);return((a^(a>>>16))>>>0)/4294967296;};
const gr=(x,y,x2,y2,stops)=>{const g=c.createLinearGradient(x,y,x2,y2);for(const [p,v] of stops)g.addColorStop(p,v);return g;};
function disk(x,y,rx,ry,fill){if(rx<=0||ry<=0)return;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TWO);c.fillStyle=fill;c.fill();}
function beam(x,y,w,h,rad,fill,stroke){
 if(w<=0||h<=0)return;
 c.beginPath();c.roundRect(x,y,w,h,Math.min(rad,w/2,h/2));
 c.fillStyle=fill;c.fill();
 if(stroke){c.strokeStyle=stroke;c.lineWidth=1.3;c.stroke();}
}
function bloom(x,y,r,inner){
 const g=c.createRadialGradient(x,y,0,x,y,r);
 g.addColorStop(0,inner);g.addColorStop(1,'rgba(255,255,255,0)');
 c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
}
function line(x1,y1,x2,y2,color,width=1){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function star(x,y,s,a=1){
 c.save();c.translate(x,y);c.globalAlpha*=a;c.rotate(time*.17+x*.001);
 c.beginPath();
 for(let i=0;i<8;i++){const th=i*PI/4,rr=i%2?s*.28:s;
   if(!i)c.moveTo(Math.cos(th)*rr,Math.sin(th)*rr);
   else c.lineTo(Math.cos(th)*rr,Math.sin(th)*rr);
 }
 c.closePath();c.fillStyle='#fff7bc';c.fill();c.restore();
}
function tuft(x,y,s=1,alpha=1){
 c.save();c.translate(x,y);c.scale(s,s);c.globalAlpha*=alpha;
 for(let j=-2;j<=2;j++){
  c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(j*6,-12,j*9,-22-(j%2)*6);
  c.strokeStyle=j%2?'#4d9b81':'#77be8f';c.lineWidth=3;c.stroke();
 }
 c.restore();
}
function cap(x,y,w,h,tint=0){
 const arr=[['#ffe0ae','#e88194','#a64d81'],['#ffcab8','#e86691','#9c4d8b'],['#f2bfdc','#ae75c9','#7560af'],['#ffdfb0','#e6a07a','#af668c']][((tint%4)+4)%4];
 disk(x,y,w*.53,Math.max(2,w*.07),'#e9c7ba');
 disk(x,y+3,w*.52,Math.max(1,w*.038),'#99596f');
 c.beginPath();c.moveTo(x-w*.56,y);
 c.bezierCurveTo(x-w*.53,y-h*.72,x-w*.28,y-h,x,y-h);
 c.bezierCurveTo(x+w*.39,y-h,x+w*.59,y-h*.52,x+w*.56,y);
 c.closePath();
 c.fillStyle=gr(x-w*.42,y-h,x+w*.6,y,[[0,arr[0]],[.39,arr[1]],[1,arr[2]]]);
 c.fill();c.strokeStyle='rgba(108,63,95,.30)';c.lineWidth=1.6;c.stroke();
 c.save();c.clip();
 for(let j=0;j<5;j++){
  const xx=x+Math.sin(j*2.61)*w*.34,yy=y-h*(.25+.11*(j%3));
  disk(xx,yy,w*(.067+(j%2)*.03),h*.08,'rgba(255,250,231,.89)');
 }
 c.beginPath();c.moveTo(x-w*.4,y-h*.34);c.quadraticCurveTo(x-w*.30,y-h*.94,x+w*.1,y-h*.87);
 c.strokeStyle='rgba(255,255,237,.20)';c.lineWidth=Math.max(2,h*.12);c.stroke();
 c.restore();
}
function mushroomHome(x,y,s,tint=0,lights=true){
 c.save();c.translate(x,y);c.scale(s,s);
 disk(0,3,42,7,'rgba(35,74,64,.18)');
 const stem=gr(-33,-30,37,-30,[[0,'#b99da8'],[.24,'#f5dac4'],[.63,'#fff2db'],[1,'#b28a9f']]);
 c.beginPath();c.moveTo(-25,0);c.bezierCurveTo(-30,-33,-14,-70,-17,-95);
 c.quadraticCurveTo(0,-112,18,-95);
 c.bezierCurveTo(11,-54,27,-25,24,0);c.closePath();
 c.fillStyle=stem;c.fill();c.strokeStyle='rgba(126,94,112,.47)';c.lineWidth=2;c.stroke();
 // Windows are recessed with a warm emissive center.
 const win=lights?'#ffdf89':'#9ba9bf';
 beam(-13,-66,11,17,5,'#755878');beam(-11,-64,7,13,3,win);
 beam(9,-66,11,17,5,'#755878');beam(11,-64,7,13,3,win);
 beam(-12,-32,25,32,12,'#99727f','#fff3da');
 beam(-8,-27,17,27,9,'#75566a');
 disk(1,-13,2.8,3.8,'#e7bc7d');
 if(lights){bloom(-7,-56,18,'rgba(255,219,120,.17)');bloom(15,-56,18,'rgba(255,213,100,.15)');}
 cap(0,-93,112,62,tint);
 c.restore();
}
function pillar(x,y,h,shade=0){
 beam(x-21,y-h,42,h+4,12,gr(x-21,y-h,x+21,y,[[0,'#e2c1be'],[.35,'#ffe8cf'],[.68,'#cfa5b2'],[1,'#97758e']]),'#ac879e');
 for(let j=0;j<5;j++)line(x-14,y-h+14+j*22,x-1,y-h+18+j*22,'rgba(255,249,223,.30)',1.2);
}
function bridge(x1,y1,x2,y2,fade=1){
 // Connect actual terrain deck endpoints; no floating bridge modules.
 c.save();c.globalAlpha*=fade;
 c.beginPath();c.moveTo(x1,y1);c.quadraticCurveTo((x1+x2)/2,(y1+y2)/2+21,x2,y2);
 c.strokeStyle='#7f6e89';c.lineWidth=9;c.stroke();
 c.beginPath();c.moveTo(x1,y1-3);c.quadraticCurveTo((x1+x2)/2,(y1+y2)/2+17,x2,y2-3);
 c.strokeStyle='#dfb68e';c.lineWidth=5;c.stroke();
 for(let t=0;t<=1;t+=.13){
   const x=x1+(x2-x1)*t;
   const y=y1+(y2-y1)*t+38*t*(1-t);
   line(x,y,x,y-18,'#a97b74',3);
   disk(x,y-18,3,3,'#ffe3aa');
 }
 c.beginPath();c.moveTo(x1,y1-19);c.quadraticCurveTo((x1+x2)/2,(y1+y2)/2+1,x2,y2-19);
 c.strokeStyle='#b48779';c.lineWidth=2;c.stroke();
 c.restore();
}
function rockIsland(x,y,w,h,paint=0,alpha=1){
 c.save();c.globalAlpha*=alpha;
 const face=paint===2?['#dab6af','#806e91']:paint===1?['#b7c5c1','#728d9c']:['#c4b1b9','#797891'];
 // Plateau with anchored, weighty cliff profile.
 c.beginPath();c.moveTo(x-w*.52,y);
 c.quadraticCurveTo(x-w*.40,y-h*.06,x-w*.17,y-5);
 c.lineTo(x+w*.38,y-6);c.quadraticCurveTo(x+w*.59,y-3,x+w*.53,y+7);
 c.lineTo(x+w*.37,y+h*.53);c.lineTo(x+w*.14,y+h*.82);
 c.lineTo(x-w*.02,y+h);c.lineTo(x-w*.20,y+h*.75);c.lineTo(x-w*.38,y+h*.37);
 c.closePath();
 c.fillStyle=gr(x-w*.5,y,x+w*.5,y+h*.8,[[0,face[0]],[.57,'#a08a9d'],[1,face[1]]]);
 c.fill();
 c.save();c.clip();
 c.beginPath();c.moveTo(x-w*.37,y+14);
 c.quadraticCurveTo(x-w*.18,y+h*.25,x-w*.11,y+h*.6);
 c.lineTo(x-w*.24,y+h*.71);
 c.strokeStyle='rgba(247,225,190,.24)';c.lineWidth=w*.13;c.stroke();
 for(let j=0;j<10;j++){
   const r=f(j+Math.round(x)),xx=x+(r-.5)*w*.72,yy=y+(j%4)*h*.16+15;
   disk(xx,yy,Math.max(1,w*.035),Math.max(1,h*.035),
    'rgba(255,231,214,'+(.10+(j%3)*.045)+')');
 }
 c.restore();
 // Rich top soil forms the visual foundation for every planted structure.
 c.beginPath();c.moveTo(x-w*.54,y-2);
 c.quadraticCurveTo(x-w*.2,y-19,x+w*.07,y-9);
 c.quadraticCurveTo(x+w*.35,y-12,x+w*.56,y-1);
 c.strokeStyle='#487e6b';c.lineWidth=14;c.stroke();
 c.beginPath();c.moveTo(x-w*.54,y-8);
 c.quadraticCurveTo(x-w*.2,y-25,x+w*.07,y-15);
 c.quadraticCurveTo(x+w*.35,y-18,x+w*.56,y-7);
 c.strokeStyle=paint===1?'#98cfad':'#77bf8d';c.lineWidth=10;c.stroke();
 c.beginPath();c.moveTo(x-w*.54,y-14);
 c.quadraticCurveTo(x-w*.2,y-31,x+w*.07,y-21);
 c.quadraticCurveTo(x+w*.35,y-24,x+w*.56,y-13);
 c.strokeStyle='rgba(253,248,190,.50)';c.lineWidth=2;c.stroke();
 for(let j=0;j<7;j++)tuft(x-w*.43+j*w*.145,y-10-(j%2)*3,.35,alpha);
 c.restore();
}
function waterfall(x,y,w=38,length=160,alpha=1){
 // Source is at the cliff-top or platform edge; flow continues down into the lagoon.
 c.save();c.globalAlpha*=alpha;
 const sway=Math.sin(time*.7+x*.012)*2.7;
 c.beginPath();c.moveTo(x-w/2,y);c.bezierCurveTo(x-w*.53+sway,y+30,x-w*.42-sway,y+length*.73,x-w*.63,y+length);
 c.lineTo(x+w*.61,y+length);
 c.bezierCurveTo(x+w*.44+sway,y+length*.70,x+w*.48-sway,y+30,x+w/2,y);
 c.closePath();
 c.fillStyle=gr(x-w*.5,y,x+w*.5,y+length*.8,[[0,'rgba(243,255,246,.91)'],[.39,'rgba(185,240,234,.80)'],[1,'rgba(101,187,212,.36)']]);
 c.fill();
 for(let k=-2;k<=2;k++){
    const dx=k*w*.155+Math.sin(time*.8+k+x*.008)*2.5;
    line(x+dx,y+5,x+dx+Math.sin(k+time)*4,y+length*.77,
      'rgba(255,255,255,.45)',Math.max(1,w*.04));
 }
 const foamY=y+length;
 disk(x,foamY,w*.86,w*.13,'rgba(237,255,247,.46)');
 c.restore();
}
function balloon(x,y,size,tint){
 c.save();c.translate(x,y);
 const bob=Math.sin(time*.48+x*.012)*3;
 line(0,bob+13,0,bob+size*1.6,'rgba(100,129,125,.56)',1.4);
 disk(0,bob,size,size*1.1,
    tint?'#f1b5c4':'#fff3d3');
 disk(-size*.26,bob-size*.27,size*.24,size*.37,'rgba(255,255,255,.30)');
 c.restore();
}
function cliffVillage(x,y,s,id){
 c.save();c.translate(x,y);c.scale(s,s);
 rockIsland(0,0,390,125,id%3,1);
 // The houses and fences sit on the *same* upper surface.
 for(let k=0;k<5;k++){
   const hx=-157+k*70,hy=-5-Math.sin(k*1.75)*7;
   mushroomHome(hx,hy,.38+(k%3)*.07,(id+k)%4,id%3!==2);
 }
 for(let k=0;k<4;k++){
   const tx=-141+k*90;
   line(tx,-6,tx,-25,'#967a73',3);
   disk(tx,-27,3,4,'#ffdc93');
 }
 c.restore();
}
function flagship(x,y,s,variant=0){
 c.save();c.translate(x,y);c.scale(s,s);
 // Main inhabited plateau. It grows vertically into a cathedral-sized mushroom.
 rockIsland(0,0,560,256,2,.97);
 for(let k=0;k<3;k++){
    const bx=-151+k*154;
    mushroomHome(bx,-13,.57,k+variant,true);
 }
 // Rooted colonnades support the fantasy palace.
 for(let j=-2;j<=2;j++)pillar(j*55,-9,122,variant);
 beam(-174,-140,348,57,23,
   gr(-160,-160,170,-99,[[0,'#d5aeb8'],[.5,'#ffe4ca'],[1,'#9f8ba7']]),'#ad879b');
 for(let j=-3;j<=3;j++){
   const px=j*44;
   disk(px,-87,5,4,'#ffdeab');
 }
 // Main palace mushroom dome crowns the colonnade and is fully attached.
 pillar(0,-137,105);
 cap(0,-226,363,170,variant%2?1:0);
 // Secondary little spires sit on terrace ledges.
 for(const side of[-1,1]){
    pillar(side*184,-12,127);
    cap(side*184,-138,105,63,2);
 }
 beam(-38,-123,76,55,25,'#8a7895','#f9e5c6');
 beam(-29,-117,58,49,20,'#5e7899');
 for(let j=-2;j<=2;j++){
   const xx=j*46;
   beam(xx-11,-163,22,37,9,'#7b6787','#fff1d4');
   beam(xx-7,-160,14,30,7,'#ffe5a2');
   bloom(xx,-146,31,'rgba(255,219,132,.17)');
 }
 // Cascade starts exactly from the island's outer lip.
 waterfall(-205,4,34,214,.95);
 waterfall(224,4,30,165,.84);
 for(let j=0;j<4;j++){
   const xx=-220+j*146;
   tuft(xx,-12,.9);
 }
 c.restore();
}
function cloud(x,y,size=1){
 c.save();c.translate(x,y);c.scale(size,size);
 disk(0,7,75,16,'rgba(124,183,187,.15)');
 disk(-40,-1,48,23,'#f9fff4');
 disk(3,-15,66,35,'#fffefa');
 disk(59,-1,40,25,'#fcfff7');
 disk(6,15,89,17,'#ebf4ec');
 disk(-18,-28,32,17,'rgba(255,255,255,.68)');
 c.restore();
}
function sky(){
 c.fillStyle=gr(0,0,0,H,[[0,'#73bafa'],[.28,'#9ad1f7'],[.63,'#d9eafa'],[1,'#fff2d4']]);
 c.fillRect(0,0,W,H);
 const sunX=W*.71,sunY=H*.16;
 bloom(sunX,sunY,180,'rgba(255,240,174,.44)');
 disk(sunX,sunY,42,42,'#fff4c6');
 for(let j=-2;j<Math.ceil(W/330)+3;j++){
   const p=cam*.095,idx=j+Math.floor(p/330);
   const x=idx*330-p+f(idx+443)*94;
   if(x<-160||x>W+170)continue;
   cloud(x,H*.14+f(idx+219)*H*.16,.54+f(idx+83)*.58);
 }
}
function farIslands(){
 const p=cam*.15,step=560;
 for(let j=Math.floor((p-200)/step)-1;j<=Math.ceil((p+W+200)/step);j++){
   const x=j*step-p+f(j+84)*130,y=H*.30+f(j+56)*H*.12;
   if(x<-220||x>W+220)continue;
   c.save();c.globalAlpha=.48;
   rockIsland(x,y,90+f(j+3)*85,76+f(j+9)*93,1,.96);
   mushroomHome(x-12,y-8,.29,j%4,false);
   waterfall(x+25,y+4,12,85,.50);
   c.restore();
 }
}
function panorama(){
 // An ongoing chain of coherent elevated settlements, not isolated stickers.
 // Different scroll factors keep depth convincing without changing runner geometry.
 const world=cam*.27,span=1520;
 for(let i=Math.floor((world-640)/span)-1;i<=Math.ceil((world+W+640)/span);i++){
   const base=i*span-world+span*.46,y=H*.60+Math.sin(i*1.72)*H*.023;
   if(base<-720||base>W+720)continue;
   const factor=.77+f(i+40)*.15;
   flagship(base,y,factor,i);
   const lx=base-365*factor,rx=base+369*factor;
   const ly=y+H*.04,ry=y+H*.035;
   cliffVillage(lx-50,ly,.54*factor,i+1);
   cliffVillage(rx+65,ry,.51*factor,i+3);
   // Terraces are physically connected by curved wooden spans.
   bridge(lx-50+112*factor,ly-10,base-218*factor,y-12,.82);
   bridge(base+233*factor,y-12,rx+65-111*factor,ry-10,.82);
   for(let k=0;k<8;k++){
     const bx=base-300*factor+k*82*factor,by=y-125-f(k+i*9)*100;
     if(!Number.isFinite(bx))continue;
     if(k%4===0)balloon(bx,by,7,k%2);
     else if(k%3===1)star(bx,by,3,.6);
   }
 }
}
function nearTown(){
 // Smaller mushroom dwellings on lower terraces; strong parallax makes
 // the panorama feel like a vast city as the runner continues forward.
 const p=cam*.50,span=620;
 for(let i=Math.floor((p-280)/span)-1;i<=Math.ceil((p+W+280)/span);i++){
   const x=i*span-p+120+f(i+141)*90,y=H*.705+Math.sin(i*1.8)*9;
   if(x<-320||x>W+320)continue;
   c.save();c.globalAlpha=.91;
   rockIsland(x,y,344,93,0,.94);
   for(let j=0;j<3;j++){
      const xx=x-105+j*95;
      mushroomHome(xx,y-9,.45+(j%2)*.09,i+j,true);
   }
   for(let j=0;j<6;j++)tuft(x-129+j*49,y-9,.46,.9);
   waterfall(x+135,y+9,18,100,.73);
   c.restore();
 }
}
function airborneNature(){
 // Small ambient firefly specks replace looping sticker effects.
 for(let i=0;i<22;i++){
   const step=164,base=i*step,shift=cam*.33;
   const index=Math.floor(shift/(22*step));
   for(let turn=index-1;turn<=index+2;turn++){
     const sx=base+turn*22*step-shift;
     if(sx<-10||sx>W+10)continue;
     const yy=H*(.3+f(i+31)*.37)+Math.sin(time*.56+i)*9;
     const bright=.18+.35*(.5+.5*Math.sin(time*.93+i*2.71));
     if(i%6===0)bloom(sx,yy,18,'rgba(255,244,172,'+bright.toFixed(3)+')');
     disk(sx,yy,1.2,1.2,'rgba(255,252,219,'+bright.toFixed(3)+')');
   }
 }
}
function paint(ctx,opts){
 c=ctx;W=opts.W;H=opts.H;cam=opts.cam;time=opts.time;
 c.save();
 sky();
 farIslands();
 // Large coherent inhabited islands sit behind the lower settlements.
 panorama();
 nearTown();
 airborneNature();
 c.restore();
}
return {paint,version:'grand-mushroom-kingdom-v3'};
})();
window.MushroomKingdom=MushroomKingdom;
