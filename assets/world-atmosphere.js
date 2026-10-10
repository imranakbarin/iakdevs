/* Small illustrated leaves respond to the same breeze in every artwork. */
let worldLeafStyle='',worldLeafPool;
function worldAtmosphere(c,dt){
 const style=document.getElementById('sty').value;
 if(style!==worldLeafStyle){worldLeafStyle=style;worldLeafPool=SceneMotion.particles(9,97);}
 worldLeafPool.update(dt);
 const palettes={gond:['#db7940','#759855','#bcab4b'],warli:['#f3e8c8','#ddc69d'],madhubani:['#bc5443','#749053','#d6ad50'],kangra:['#b9be8e','#ccaa85'],japan:['#e8b9ae','#e0c1a8'],china:['#73836a','#a6ad8d'],mexico:['#e5ac4b','#da6b44','#68a492']};
 const colors=palettes[style]||palettes.gond,w=cv.clientWidth,h=cv.clientHeight;
 c.save();c.setTransform(DPR,0,0,DPR,0,0);
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
