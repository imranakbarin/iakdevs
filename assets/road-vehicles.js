/* Vehicle meshes share the road projection: d=0 is the rear, d=length the nose. */
const RoadVehicles=(()=>{
 const fleetNames=['hatchback','sedan','suv','pickup','van','truck'],fleetSprites=new Map();let fleetImage=null;
 // Alpha-component bounds measured from the atlas; unequal painted silhouettes keep every tyre.
 const fleetBoxes=[[11,86,338,245],[356,108,359,220],[724,77,352,258],[11,437,373,258],[384,407,335,284],[729,386,342,314],[19,774,336,252],[369,805,350,218],[732,768,341,264],[12,1132,364,241],[424,1104,301,267],[763,1081,313,290]];
 const models={hatchback:{length:3.6,height:1.42,width:.79},sedan:{length:4.3,height:1.36,width:.81},suv:{length:4.6,height:1.68,width:.89},pickup:{length:5.3,height:1.67,width:.91},van:{length:5.6,height:2.05,width:.93},truck:{length:8.8,height:2.65,width:1.05}};
 function painted(c,P,car){
  if(!fleetImage){fleetImage=new Image();fleetImage.onload=()=>{fleetSprites.clear();if(typeof wakeScene==='function')wakeScene();};fleetImage.src='assets/road-fleet-painted.webp';}
  if(!fleetImage.complete||!fleetImage.naturalWidth)return false;
  const model=models[car.model]?car.model:'sedan',m=models[model],index=fleetNames.indexOf(model)+(car.front?0:6),key=index+':'+car.col;
  let sprite=fleetSprites.get(key);
  if(!sprite){const box=fleetBoxes[index];sprite=document.createElement('canvas');sprite.width=320;sprite.height=Math.round(320*box[3]/box[2]);const g=sprite.getContext('2d');g.drawImage(fleetImage,...box,0,0,sprite.width,sprite.height);g.globalCompositeOperation='source-atop';g.globalAlpha=.10;g.fillStyle=car.col||'#638582';g.fillRect(0,0,sprite.width,sprite.height);g.globalAlpha=1;g.globalCompositeOperation='source-over';fleetSprites.set(key,sprite);if(fleetSprites.size>24)fleetSprites.delete(fleetSprites.keys().next().value);}
  const z=36/car.distance-.025,farZ=36/(car.distance+m.length)-.025,scale=P.hw(z)/3.5,width=scale*m.width*2*1.13,height=width*sprite.height/sprite.width,x=P.rx(z)+P.hw(z)*car.lane,y=P.yy(z);
  const farX=P.rx(farZ)+P.hw(farZ)*car.lane,lean=Math.max(-.11,Math.min(.11,(farX-x)/Math.max(1,height)*.32));
  c.save();c.fillStyle='rgba(9,21,24,.25)';c.beginPath();c.ellipse(x,y,width*.48,Math.max(.5,width*.055),0,0,Math.PI*2);c.fill();c.fillStyle='rgba(8,17,19,.32)';c.beginPath();c.ellipse(x-width*.34,y,width*.08,Math.max(.4,width*.02),0,0,Math.PI*2);c.ellipse(x+width*.34,y,width*.08,Math.max(.4,width*.02),0,0,Math.PI*2);c.fill();
  c.translate(x,y);c.transform(1,0,-lean,1,0,0);if(car.lane<0)c.scale(-1,1);c.drawImage(RoadWeather.paintedCar(sprite),-width*.5,-height,width,height);c.restore();return true;
 }
 function draw(c,P,car){
  if(painted(c,P,car))return;
  const kind=models[car.model]?car.model:'sedan',m=models[kind],L=m.length,W=m.width,H=m.height,color=car.col||'#638582';
  const tint=n=>{const v=parseInt(color.slice(1),16);return '#'+[16,8,0].map(s=>Math.max(0,Math.min(255,((v>>s)&255)+n)).toString(16).padStart(2,'0')).join('');};
  const depth=d=>car.distance+(car.front?L-d:d);
  const point=(x,d,height=0)=>{const z=36/depth(d)-.025,scale=P.hw(z)/3.5,bob=height>.3?.008*Math.sin((car.s||0)*2.1):0;return {x:P.rx(z)+P.hw(z)*car.lane+x*scale,y:P.yy(z)-(height+bob)*scale,scale};};
  const jobs=[],nearScale=point(0,car.front?L:0).scale,stroke=Math.max(.35,Math.min(1.1,nearScale*.022));
  function face(ps,colors,glass=false,bias=0){jobs.push({depth:ps.reduce((v,p)=>v+depth(p[1]),0)/ps.length+bias,paint(){
   const q=ps.map(p=>point(...p)),g=c.createLinearGradient(q[0].x,q[0].y,q[2].x,q[2].y);g.addColorStop(0,RoadWeather.lit(colors[0]));g.addColorStop(.55,RoadWeather.lit(colors[1]));g.addColorStop(1,RoadWeather.lit(colors[2]));
   c.beginPath();q.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=g;c.fill();if(ps.length===4)RoadWeather.reflect(c,q,glass);
   c.strokeStyle=glass?'#273b40':'rgba(26,38,38,.36)';c.lineWidth=stroke;c.stroke();
  }});}
  function line(a,b,col,width=1,bias=-.025){jobs.push({depth:(depth(a[1])+depth(b[1]))/2+bias,paint(){const p=point(...a),q=point(...b);c.strokeStyle=col;c.lineWidth=Math.max(.35,nearScale*.025*width);c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}});}
  const paint=[tint(-30),color,tint(22)],top=[tint(38),tint(14),tint(-8)],glass=['#24414c','#476d79','#b2c8c2'];c.save();
  const footprint=[[-W-.08,0],[W+.08,0],[W+.08,L],[-W-.08,L]].map(p=>point(...p));c.fillStyle='rgba(9,21,24,.19)';c.beginPath();footprint.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();
  const R=kind==='truck'?.35:kind==='suv'||kind==='pickup'?.31:.28,axles=kind==='truck'?[.9,2.25,L-.95]:[.67,L-.76];
  for(const axle of axles)for(const side of [-1,1]){const p=point(side*(W+.03),axle),r=p.scale*R;c.fillStyle='rgba(8,17,19,.4)';c.beginPath();c.ellipse(p.x,p.y,r*.65,Math.max(.45,r*.11),0,0,Math.PI*2);c.fill();jobs.push({depth:depth(axle)-.035,paint(){
   c.fillStyle='#182329';c.beginPath();c.ellipse(p.x,p.y-r,Math.max(.6,r*.43),r,0,Math.PI*2);c.fill();c.fillStyle='#8b9a9c';c.beginPath();c.ellipse(p.x,p.y-r,r*.25,r*.59,0,0,Math.PI*2);c.fill();
   c.strokeStyle='#35474d';c.lineWidth=Math.max(.35,r*.07);const angle=(car.s||0)/R;for(let k=0;k<5;k++){const a=angle+k*Math.PI*2/5;c.beginPath();c.moveTo(p.x,p.y-r);c.lineTo(p.x+Math.cos(a)*r*.22,p.y-r+Math.sin(a)*r*.53);c.stroke();}
  }});}
  const body=kind==='truck'?.94:kind==='van'?.97:kind==='suv'||kind==='pickup'?.99:.82,nose=kind==='truck'?.86:kind==='van'?.82:body-.13;
  // Side skins include open wheel arches rather than rectangular panels over tyres.
  for(const side of [-1,1]){const outline=[[side*W,0,body],[side*W,L,nose],[side*W,L,.36]];for(const a of axles.slice().reverse()){outline.push([side*W,a+R+.07,.36]);for(let k=0;k<=12;k++){const theta=k/12*Math.PI;outline.push([side*W,a+Math.cos(theta)*(R+.07),.32+Math.sin(theta)*(R+.08)]);}}outline.push([side*W,0,.36]);face(outline,paint);line([side*(W+.005),.12,.42],[side*(W+.005),L-.12,.42],tint(-30),1);}
  if(kind==='truck'){
   const boxEnd=L-2.6,boxW=W*.99;
   for(const side of [-1,1])face([[side*boxW,0,.88],[side*boxW,boxEnd,.88],[side*boxW,boxEnd,H],[side*boxW,0,H]],['#9aaca9','#d9ded7','#bdcbc6']);
   face([[-boxW,0,.88],[boxW,0,.88],[boxW,0,H],[-boxW,0,H]],['#9eaca9','#d3d9d2','#bbc8c2']);face([[-boxW,boxEnd,.88],[boxW,boxEnd,.88],[boxW,boxEnd,H],[-boxW,boxEnd,H]],['#9caaa6','#cbd4cd','#e3e7dc']);face([[-boxW,0,H],[boxW,0,H],[boxW,boxEnd,H],[-boxW,boxEnd,H]],['#e2e7de','#c7d5d0','#a9bcb8']);
   for(const side of [-1,1])line([side*boxW,0,H-.10],[side*boxW,boxEnd,H-.10],'#b4c4bd',1);line([0,0,1],[0,0,H-.08],'#7d918a',1.2);for(const side of [-1,1])line([side*.16,0,1.12],[side*.16,0,2.25],'#98aaa3',.9);
   const rear=L-2.25,front=L-.32,roofW=W*.89,roof=2.10;
   for(const side of [-1,1]){face([[side*W,rear,body],[side*W,L,.86],[side*roofW,front,roof],[side*roofW,rear,roof]],paint);face([[side*(W+.01),rear+.17,1.18],[side*(W+.01),L-.55,1.18],[side*roofW,front-.1,roof-.14],[side*roofW,rear+.17,roof-.14]],glass,true,-.02);line([side*W,L-.65,1.02],[side*W,L-.65,.96],tint(42),1.5);}
   face([[-roofW,rear,roof],[roofW,rear,roof],[roofW,front,roof],[-roofW,front,roof]],top);face([[-W,L,1.10],[W,L,1.10],[roofW,front,roof-.15],[-roofW,front,roof-.15]],glass,true,-.01);face([[-W,L,.38],[W,L,.38],[W,L,1.08],[-W,L,1.08]],paint,false,-.02);
  }else{
   const van=kind==='van',suv=kind==='suv',pickup=kind==='pickup',hatch=kind==='hatchback';
   const rearBase=pickup?L*.47:van?.16:hatch||suv?.20:.65,rearRoof=pickup?rearBase+.08:van?.27:hatch||suv?.52:1.18;
   const frontBase=van?L-.38:L-.95,frontRoof=van?L-.78:pickup?L-1.58:L-1.53,roofW=W*(van?.92:suv?.88:.82);
   for(const side of [-1,1]){
    face([[side*W,rearBase,body],[side*W,frontBase,body],[side*roofW,frontRoof,H],[side*roofW,rearRoof,H]],paint);
    const middle=(rearRoof+frontRoof)*.5;
    face([[side*(W+.008),rearBase+.16,body+.06],[side*(W+.008),middle-.09,body+.06],[side*roofW,middle-.09,H-.10],[side*roofW,rearRoof+.13,H-.10]],glass,true,-.02);face([[side*(W+.008),middle+.10,body+.06],[side*(W+.008),frontBase-.12,body+.06],[side*roofW,frontRoof-.12,H-.10],[side*roofW,middle+.10,H-.10]],glass,true,-.02);
    line([side*(W+.01),middle,.45],[side*(W+.01),middle,body+.02],tint(-20),.7);line([side*(W+.015),middle+.2,body-.08],[side*(W+.015),middle+.44,body-.08],tint(50),1.2);
    face([[side*W,frontBase-.05,body],[side*(W+.14),frontBase-.11,body+.08],[side*(W+.14),frontBase-.11,body+.17],[side*W,frontBase-.05,body+.15]],['#263b40',tint(-12),tint(12)],false,-.04);
   }
   face([[-roofW,rearRoof,H],[roofW,rearRoof,H],[roofW,frontRoof,H],[-roofW,frontRoof,H]],top);face([[-W*.92,frontBase,body+.03],[W*.92,frontBase,body+.03],[roofW*.92,frontRoof,H-.08],[-roofW*.92,frontRoof,H-.08]],glass,true,-.025);
   if(van){face([[-W,rearBase,.82],[W,rearBase,.82],[roofW,rearRoof,H],[-roofW,rearRoof,H]],paint);for(const side of [-1,1])face([[side*.08,rearBase,1.18],[side*.68,rearBase,1.18],[side*.66,rearRoof,H-.18],[side*.08,rearRoof,H-.18]],glass,true,-.035);line([0,rearBase,.48],[0,rearRoof,H-.06],tint(-35),1);}else face([[-W*.92,rearBase,body+.03],[W*.92,rearBase,body+.03],[roofW*.92,rearRoof,H-.08],[-roofW*.92,rearRoof,H-.08]],glass,true,-.025);
   face([[-W,frontBase,body],[W,frontBase,body],[W*.94,L,nose],[-W*.94,L,nose]],top);
   if(pickup){face([[-W*.82,.15,.76],[W*.82,.15,.76],[W*.82,rearBase-.12,.76],[-W*.82,rearBase-.12,.76]],['#293c3f','#435c5d','#6f827d']);for(const side of [-1,1]){face([[side*W,0,body],[side*W,rearBase,body],[side*W,rearBase,1.13],[side*W,0,1.13]],paint);line([side*W,0,1.14],[side*W,rearBase,1.14],tint(45),1.5);}}else face([[-W,0,body-.04],[W,0,body-.04],[W,rearBase,body],[-W,rearBase,body]],top);
   face([[-W,0,.36],[W,0,.36],[W,0,body-.04],[-W,0,body-.04]],paint);face([[-W*.94,L,.36],[W*.94,L,.36],[W*.94,L,nose],[-W*.94,L,nose]],paint);if(suv)for(const side of [-1,1])line([side*roofW,rearRoof,H+.02],[side*roofW,frontRoof,H+.02],'#788d8b',1.8);
  }
  // Front/rear details stay attached to the corresponding body plane.
  for(const front of [false,true]){const d=front?L:0,h=kind==='truck'?.70:body*.72;
   for(const side of [-1,1])face([[side*W*.53,d,h-.07],[side*W*.87,d,h-.07],[side*W*.87,d,h+.08],[side*W*.53,d,h+.08]],front?['#b3c5be','#f1eed5','#fff7dd']:['#822e2d','#c25143','#e68257'],false,-.065);
   face([[-.22,d,.41],[.22,d,.41],[.22,d,.53],[-.22,d,.53]],['#b5bab0','#e2dfcb','#ccd2c4'],false,-.07);line([-W*.86,d,.33],[W*.86,d,.33],'#35494c',2.8,-.07);
   if(front){face([[-W*.39,d,.57],[W*.39,d,.57],[W*.34,d,.70],[-W*.34,d,.70]],['#1c2b31','#2d4147','#4a5e63'],false,-.07);line([-W*.30,d,.62],[W*.30,d,.62],'#b1bfbd',1,-.08);}
  }
  jobs.sort((a,b)=>b.depth-a.depth);for(const job of jobs)job.paint();c.restore();
 }
 return {models,draw};
})();
