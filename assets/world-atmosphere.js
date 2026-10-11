/* Small illustrated leaves respond to the same breeze in every artwork. */
let worldLeafStyle='',worldLeafPool;
const worldFronds=new Map();
function worldForeground(c,style,w,h){
 const natural=style==='china'||style==='japan'||style==='kangra',warli=style==='warli';
 const unit=Math.min(w,h)/640,spacing=340*unit,offset=camX*S*1.16;
 c.save();
 for(let i=Math.floor(offset/spacing)-1;i<=(offset+w)/spacing;i++){
  const key=style+':'+seed+':'+i;
  let tile=worldFronds.get(key);
  if(!tile){
   tile=document.createElement('canvas');tile.width=360;tile.height=230;
   const g=tile.getContext('2d'),q=mulberry32(hash(seed,i+981));
   if(warli){
    g.strokeStyle='#f3dfb9';g.lineWidth=1.1;
    for(let k=0;k<10;k++){const x=k*36,y=185;g.beginPath();g.moveTo(x,y);g.lineTo(x+18,y-28);g.lineTo(x+36,y);g.moveTo(x+18,y-28);g.lineTo(x+18,y+12);g.stroke();g.beginPath();g.arc(x+18,y-36,3,0,Math.PI*2);g.stroke();}
   }else{
    for(let stem=0;stem<8;stem++){
     const x=q()*360,ht=40+q()*145,lean=(q()-.5)*75;
     g.strokeStyle=natural?'#465a44':'#547247';g.lineWidth=natural?1.3:2.2;g.beginPath();g.moveTo(x,230);g.bezierCurveTo(x+lean*.2,210-ht*.2,x+lean,230-ht*.8,x+lean,230-ht);g.stroke();
     for(let k=0;k<6;k++)for(let side of [-1,1]){
      const y=222-k*ht/7,xx=x+lean*k/7,len=15+q()*27;
      g.fillStyle=natural?['#547052','#81936a','#365347'][k%3]:['#277b66','#b27343','#87a452'][k%3];
      g.beginPath();g.moveTo(xx,y);g.quadraticCurveTo(xx+side*len*.4,y-18,xx+side*len,y-13);g.quadraticCurveTo(xx+side*len*.7,y+4,xx,y);g.fill();
      if(!natural){g.strokeStyle='#eee0b2';g.lineWidth=.6;g.beginPath();g.moveTo(xx,y);g.lineTo(xx+side*len*.8,y-10);g.stroke();}
     }
     if(style==='japan'){
      g.fillStyle='#dc9f9a';for(let k=0;k<5;k++){g.beginPath();g.ellipse(x+lean+Math.cos(k*1.26)*6,230-ht+Math.sin(k*1.26)*6,5,3,k*1.26,0,Math.PI*2);g.fill();}
     }else if(!natural){
      const colors=['#db6b41','#e5b54f','#7c558c','#32979b'];g.save();g.translate(x+lean,230-ht);
      for(let k=0;k<9;k++){g.rotate(Math.PI*2/9);g.fillStyle=colors[stem%4];g.beginPath();g.ellipse(0,-11,5,12,0,0,Math.PI*2);g.fill();g.strokeStyle='#623f36';g.lineWidth=.7;g.stroke();}
      g.fillStyle='#f0ce74';g.beginPath();g.arc(0,0,5,0,Math.PI*2);g.fill();g.restore();
     }
    }
   }
   worldFronds.set(key,tile);if(worldFronds.size>18)worldFronds.delete(worldFronds.keys().next().value);
  }
  const x=i*spacing-offset,scale=warli?.40:natural?.64:.55;
  c.save();c.translate(x,h+8);c.transform(1,0,Math.sin(SceneMotion.time*.6+i)*.006+SceneMotion.wind*.012,1,0,0);
  c.globalAlpha=warli?.52:.8;c.drawImage(tile,0,-230*unit*scale,360*unit*scale,230*unit*scale);c.restore();
 }
 c.restore();
}
function worldAtmosphere(c,dt){
 const style=document.getElementById('sty').value;
 if(style!==worldLeafStyle){worldLeafStyle=style;worldLeafPool=SceneMotion.particles(9,97);}
 worldLeafPool.update(dt);
 const palettes={gond:['#db7940','#759855','#bcab4b'],warli:['#f3e8c8','#ddc69d'],madhubani:['#bc5443','#749053','#d6ad50'],kangra:['#b9be8e','#ccaa85'],japan:['#e8b9ae','#e0c1a8'],china:['#73836a','#a6ad8d'],mexico:['#e5ac4b','#da6b44','#68a492']};
 const colors=palettes[style]||palettes.gond,w=cv.clientWidth,h=cv.clientHeight;
 c.save();c.setTransform(DPR,0,0,DPR,0,0);
 worldForeground(c,style,w,h);
 if(style==='china'||style==='japan'||style==='kangra'){
  // Low moving river mist separates distant ink washes from near foliage.
  const y=h*.73+Math.sin(SceneMotion.time*.09)*h*.018,g=c.createLinearGradient(0,y-h*.04,0,y+h*.05);
  g.addColorStop(0,'rgba(243,235,214,0)');g.addColorStop(.5,'rgba(243,235,214,.11)');g.addColorStop(1,'rgba(243,235,214,0)');c.fillStyle=g;c.fillRect(0,y-h*.04,w,h*.09);
 }
 if(style==='mexico')for(let j=0;j<4;j++){
  const t=SceneMotion.time,x=w*(.18+j*.22)+Math.sin(t*.15+j)*w*.035,y=h*(.23+(j%2)*.23)+Math.sin(t*.8+j)*10;
  c.save();c.translate(x,y);c.rotate(Math.sin(t*.3+j)*.15);c.scale(.35+.65*Math.abs(Math.cos(t*3+j)),1);
  c.fillStyle=j%2?'#d88530':'#2c98a0';c.strokeStyle='#473b38';c.lineWidth=1;for(let side of [-1,1]){c.beginPath();c.ellipse(side*7,-3,7,10,side*.4,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#e9c873';c.beginPath();c.arc(side*8,-5,2,0,Math.PI*2);c.fill();}c.restore();
 }
 for(const p of worldLeafPool.items){
  if(p.delay>0||p.alpha<=0)continue;
  const size=(style==='japan'?5:7)*p.size;
  c.save();c.translate(p.x*w,p.y*h);c.rotate(p.angle);c.scale(1,.65+.28*Math.abs(Math.cos(p.angle)));
  c.globalAlpha=p.alpha*.72;c.fillStyle=colors[p.kind%colors.length];c.strokeStyle=style==='warli'?'#d6c7a2':'rgba(37,54,37,.55)';c.lineWidth=.7;
  c.beginPath();c.moveTo(-size,0);c.bezierCurveTo(-size*.1,-size*.7,size*.6,-size*.65,size,0);c.bezierCurveTo(size*.3,size*.65,-size*.2,size*.5,-size,0);c.fill();c.stroke();
  c.beginPath();c.moveTo(-size,0);c.lineTo(size*.8,0);c.stroke();c.restore();
 }
 c.restore();
}
