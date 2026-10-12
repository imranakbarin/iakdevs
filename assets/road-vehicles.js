/* Lightweight projected fleet: dimensions, wheel contacts and reflections follow the road. */
const RoadVehicles=(()=>{
 const models={hatchback:{length:3.6,height:1.35,width:.76},sedan:{length:4.3,height:1.32,width:.79},suv:{length:4.6,height:1.65,width:.86},pickup:{length:5.3,height:1.65,width:.88},van:{length:5.6,height:2.05,width:.9},truck:{length:8.8,height:2.65,width:1.05}};
 function draw(c,P,car){
  const m=models[car.model]||models.sedan,L=m.length,W=m.width,H=m.height,distance=car.distance,color=car.col;
  const shade=(amount)=>{const n=parseInt(color.slice(1),16);return '#'+[16,8,0].map(s=>Math.max(0,Math.min(255,((n>>s)&255)+amount)).toString(16).padStart(2,'0')).join('');};
  const point=(x,d,height=0)=>{const z=36/(distance+(car.front?L-d:d))-.025,scale=P.hw(z)/3.5;return {x:P.rx(z)+P.hw(z)*car.lane+x*scale,y:P.yy(z)-height*scale,scale};};
  const jobs=[];const depth=d=>distance+(car.front?L-d:d);
  const face=(points,colors)=>{jobs.push({depth:points.reduce((s,p)=>s+depth(p[1]),0)/points.length,paint:()=>{const ps=points.map(p=>point(...p)),g=c.createLinearGradient(ps[0].x,ps[0].y,ps[2].x,ps[2].y);g.addColorStop(0,colors[0]);g.addColorStop(.6,colors[1]);g.addColorStop(1,colors[2]);c.fillStyle=g;c.beginPath();ps.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();c.strokeStyle='rgba(28,46,47,.5)';c.lineWidth=.55;c.stroke();}});};
  const line=(a,b,color,width=1)=>{jobs.push({depth:(depth(a[1])+depth(b[1]))/2-.001,paint:()=>{const p=point(...a),q=point(...b);c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}});};
  c.save();const near=point(-W,0),far=point(W,L);c.fillStyle='rgba(9,24,28,.23)';c.beginPath();for(const p of [[-W,0],[W,0],[W,L],[-W,L]]){const q=point(...p);c.lineTo(q.x,q.y);}c.closePath();c.fill();
  const axles=car.model==='truck'?[.9,2.3,L-1]:[.65,L-.75];
  for(const d of axles)for(const side of [-1,1]){const p=point(side*W,d),r=p.scale*(car.model==='truck'?.34:.26);c.fillStyle='#203035';c.beginPath();c.ellipse(p.x,p.y-r,Math.max(1,r*.42),Math.max(1,r),0,0,Math.PI*2);c.fill();c.strokeStyle='#99a49b';c.lineWidth=.65;c.beginPath();c.ellipse(p.x,p.y-r,r*.22,r*.48,0,0,Math.PI*2);c.stroke();}
  const body=car.model==='truck'?.98:.83;
  for(const side of [-1,1])face([[side*W,0,.35],[side*W,L,.35],[side*W,L,body],[side*W,0,body]],[shade(-40),color,shade(15)]);
  face([[-W,0,body],[W,0,body],[W,L,body],[-W,L,body]],[shade(30),color,shade(-10)]);
  if(car.model==='truck'){
   const end=L-2.4;
   for(const side of [-1,1])face([[side*W,0,.8],[side*W,end,.8],[side*W,end,H],[side*W,0,H]],['#c1bda9','#d6d4bf','#a4ac9f']);
   face([[-W,0,.8],[W,0,.8],[W,0,H],[-W,0,H]],['#929e95','#c7c9b6','#e5dfc8']);
   face([[-W,0,H],[W,0,H],[W,end,H],[-W,end,H]],['#e2ddc7','#c5cbb8','#a6b5ac']);
   for(let i=1;i<5;i++)line([-W,0,.8+i*.32],[W,0,.8+i*.32],'#a6b0a0',.65);
  }
  const start=car.model==='pickup'?L*.48:car.model==='truck'?L-2.3:car.model==='van'?.35:.9;
  const end=car.model==='van'?L-.3:L-.9,roofW=W*.84,roofH=car.model==='truck'?2.05:H;
  for(const side of [-1,1])face([[side*W,start,body],[side*W,end,body],[side*roofW,end,roofH],[side*roofW,start,roofH]],[shade(-30),color,shade(20)]);
  face([[-roofW,start,roofH],[roofW,start,roofH],[roofW,end,roofH],[-roofW,end,roofH]],[shade(48),shade(18),shade(-15)]);
  face([[-W,end,body],[W,end,body],[roofW,end,roofH-.1],[-roofW,end,roofH-.1]],['#284751','#698f91','#bad0c5']);
  if(car.model!=='truck'&&car.model!=='van')face([[-W,start,body],[W,start,body],[roofW,start,roofH-.1],[-roofW,start,roofH-.1]],['#29454e','#5b8586','#a2bfb4']);
  if(car.model==='van'){
   face([[-W,start,body],[W,start,body],[roofW,start,roofH],[-roofW,start,roofH]],[shade(-18),color,shade(28)]);
   line([0,start,.86],[0,start,roofH],shade(-35),.8);
   for(const side of [-1,1])face([[side*.1,start,1.25],[side*.62,start,1.25],[side*.62,start,1.75],[side*.1,start,1.75]],['#31535b','#5b8184','#a6c0b6']);
  }
  if(car.model==='pickup'){
   face([[-W*.82,.25,.87],[W*.82,.25,.87],[W*.82,start-.2,.87],[-W*.82,start-.2,.87]],['#243c3e','#526461','#819080']);
   for(const side of [-1,1])line([side*W,.2,1.07],[side*W,start,1.07],shade(40),1.3);
  }
  // Front/rear identification is tied to vehicle heading; it never flips during a pass.
  const endFace=car.front?L:0;
  if(!(car.model==='truck'&&!car.front))face([[-W,endFace,.34],[W,endFace,.34],[W,endFace,body],[-W,endFace,body]],[shade(-20),color,shade(30)]);
  for(const side of [-1,1])line([side*W*.54,endFace,.6],[side*W*.87,endFace,.6],car.front?'#fff0bf':'#c74f3c',Math.max(1,near.scale*.1));
  line([-W*.85,endFace,.3],[W*.85,endFace,.3],'#c8d1bd',1.2);
  if(car.front)line([-W*.38,L,.44],[W*.38,L,.44],'#294149',Math.max(.8,near.scale*.11));
  else line([-.18,0,.42],[.18,0,.42],'#e5dbc0',Math.max(.8,near.scale*.07));
  line([-roofW*.8,start,roofH+.01],[roofW*.8,start,roofH+.01],'rgba(236,243,220,.6)',.8);jobs.sort((a,b)=>b.depth-a.depth);for(const job of jobs)job.paint();c.restore();
 }
 return {models,draw};
})();
