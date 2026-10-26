/* Mushroom Island v2 — original hand-painted 2.5D diorama renderer.
 * Side-view composition, beveled geometry, dimensional lighting, expressive Pip.
 * Optional visual module: the original animation remains a working fallback.
 * All elements are procedural Canvas 2D; no external textures, sprites or IP.
 */
const MushroomIslandV2 = (() => {
  'use strict';
  const TAU = Math.PI * 2, PI = Math.PI, CELL = 760;
  const clamp=(a,b,v)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>{t=clamp(0,1,t);return t*t*(3-2*t);};
  const palettes=[
    {top:'#a6df78',grass:'#61b66a',cliff:'#c19470',dark:'#7b647d',rim:'#fff1ae',flora:'#ef79a7'},
    {top:'#9fdc8c',grass:'#5fbd96',cliff:'#b9988a',dark:'#7b6599',rim:'#fbe3a7',flora:'#f4aa66'},
    {top:'#afdc76',grass:'#67b58c',cliff:'#cd987c',dark:'#806b8d',rim:'#ffeaa8',flora:'#d886bb'},
    {top:'#9ed8a1',grass:'#6fba91',cliff:'#ba9878',dark:'#806986',rim:'#e9f6b4',flora:'#f49088'}
  ];
  const caps=[
    ['#ffb88c','#f27287','#a4467d'],
    ['#ffc57e','#ec80a3','#a85b9b'],
    ['#d8b2ee','#a982d8','#6864b4'],
    ['#f7af9f','#dc749c','#9867a8']
  ];
  let c,W,H,cam,time,distance,ground,segment,gap,rand,hash,pose;
  const sx=x=>x-cam;
  const visible=(x,p=150)=>x>=cam-p&&x<=cam+W+p;
  const colorGradient=(x,y,x2,y2,stops)=>{
    const g=c.createLinearGradient(x,y,x2,y2);
    for(const [t,v] of stops)g.addColorStop(t,v);
    return g;
  };
  function oval(x,y,w,h,fill,rotation=0){
    c.beginPath();c.ellipse(x,y,Math.max(.1,w),Math.max(.1,h),rotation,0,TAU);
    c.fillStyle=fill;c.fill();
  }
  function edge(x,y,r,fill,stroke,lw=2){
    c.beginPath();c.arc(x,y,Math.max(.1,r),0,TAU);c.fillStyle=fill;c.fill();
    if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
  }
  function stroke(points,color,w=2){
    c.beginPath();c.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);
    c.strokeStyle=color;c.lineWidth=w;c.stroke();
  }
  function rounded(x,y,w,h,r,fill,outline){
    if(w<=0||h<=0)return;
    c.beginPath();c.roundRect(x,y,w,h,Math.min(r,w/2,h/2));
    c.fillStyle=fill;c.fill();
    if(outline){c.strokeStyle=outline;c.lineWidth=2;c.stroke();}
  }
  function softGlow(x,y,r,tint){
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,tint);g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  }
  function star(x,y,r,fill,twist=0){
    c.save();c.translate(x,y);c.rotate(twist);
    c.beginPath();
    for(let i=0;i<10;i++){
      const a=i*PI/5-PI/2,rr=i%2?r*.49:r;
      if(i===0)c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
      else c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
    }
    c.closePath();c.fillStyle=fill;c.fill();
    c.strokeStyle='rgba(161,121,92,.45)';c.lineWidth=1.5;c.stroke();
    c.restore();
  }
  function cloud(x,y,s,alpha=1){
    c.save();c.translate(x,y);c.scale(s,s);c.globalAlpha*=alpha;
    oval(6,13,83,19,'rgba(58,127,156,.13)');
    oval(-42,2,42,23,'#f3fff4');
    oval(7,-10,59,35,'#f6fff5');
    oval(57,2,40,24,'#fbfff7');
    oval(8,15,87,15,'#eef5e9');
    oval(-9,-23,34,17,'rgba(255,255,255,.78)');
    c.restore();
  }
  function mountain(x,y,w,h,near=false){
    const back=near?'#80baac':'#a3d2b6',light=near?'#b0ddbd':'#c6e8c7';
    c.beginPath();c.moveTo(x-w*.52,y+10);
    c.bezierCurveTo(x-w*.48,y-h*.58,x-w*.20,y-h*.99,x-w*.04,y-h);
    c.bezierCurveTo(x+w*.2,y-h*1.03,x+w*.45,y-h*.52,x+w*.55,y+10);
    c.closePath();
    c.fillStyle=colorGradient(x,y-h,x+w*.4,y,[[0,light],[.65,back],[1,near?'#6da493':'#8fc2ac']]);
    c.fill();
    c.beginPath();c.moveTo(x-w*.22,y-h*.73);c.quadraticCurveTo(x-w*.07,y-h*.92,x+w*.12,y-h*.78);
    c.strokeStyle='rgba(245,253,219,.36)';c.lineWidth=8;c.stroke();
    oval(x-w*.3,y-14,w*.22,8,'rgba(255,249,204,.13)');
  }
  function tower(x,y,s,variant){
    // Toy-book castle, never a replica of a recognizable commercial castle.
    c.save();c.translate(x,y);c.scale(s,s);
    const body=colorGradient(-25,-135,75,10,[[0,'#f1c8ad'],[.5,'#ce9eaf'],[1,'#9d8cac']]);
    rounded(-67,-102,134,105,22,body,'#9f829e');
    for(let i=-1;i<=1;i++){
      const tx=i*51,hh=i===0?154:117;
      rounded(tx-21,-hh,42,hh+2,13,
        colorGradient(tx-21,-120,tx+21,0,[[0,'#f8dbb9'],[.55,'#cca5b4'],[1,'#a28ba6']]),
        '#ac91a4');
      cap(tx,-hh+3,49,34,variant?'#ed8ca4':'#f4a078','#a975a6');
      oval(tx,-hh-2,18,4,'rgba(255,242,211,.48)');
      rounded(tx-9,-hh+39,18,31,8,'#718ba7','#fff0ca');
    }
    rounded(-22,-45,44,49,21,'#7d83a4','#f4d9b8');
    c.restore();
  }
  function cap(x,y,w,h,top,base){
    c.save();c.translate(x,y);
    // Deep underside establishes 3D volume without changing the 2D silhouette.
    oval(1,1,w*.54,11,'#a35d7e');
    oval(0,-2,w*.54,8,'#fff0d3');
    c.beginPath();c.moveTo(-w*.55,-3);
    c.bezierCurveTo(-w*.60,-h*.66,-w*.33,-h,w*.04,-h);
    c.bezierCurveTo(w*.36,-h,w*.65,-h*.54,w*.55,-3);
    c.closePath();
    c.fillStyle=colorGradient(-w*.18,-h,w*.37,1,
      [[0,top],[.48,base],[1,'#a04f88']]);
    c.fill();c.strokeStyle='rgba(104,73,112,.45)';c.lineWidth=2;c.stroke();
    c.save();c.clip();
    oval(-w*.22,-h*.68,w*.135,h*.15,'rgba(255,250,219,.94)',-.22);
    oval(w*.19,-h*.5,w*.12,h*.13,'rgba(255,248,219,.91)',.28);
    oval(w*.04,-h*.83,w*.075,h*.063,'rgba(255,255,244,.78)');
    c.beginPath();c.ellipse(-w*.17,-h*.8,w*.28,h*.11,-.22,PI,TAU);
    c.strokeStyle='rgba(255,255,234,.29)';c.lineWidth=9;c.stroke();
    c.restore();c.restore();
  }
  function mushroom(x,y,s,tint=0,wind=0){
    c.save();c.translate(x,y);c.scale(s,s);
    oval(0,3,49,9,'rgba(49,74,67,.24)');
    const bend=wind*Math.sin(time*.8+x*.009);
    c.beginPath();c.moveTo(-15,0);
    c.bezierCurveTo(-24,-25,-12,-58,-15+bend,-99);
    c.quadraticCurveTo(bend,-115,17+bend,-98);
    c.bezierCurveTo(8+bend,-57,22,-28,17,0);
    c.closePath();
    c.fillStyle=colorGradient(-19,-53,23,-53,
      [[0,'#c4a2a4'],[.27,'#fff1d4'],[.66,'#f9e7ce'],[1,'#c79fa3']]);
    c.fill();c.strokeStyle='#a78498';c.lineWidth=2.2;c.stroke();
    oval(-6,-24,4,11,'rgba(255,255,249,.34)');
    const arr=caps[((tint%caps.length)+caps.length)%caps.length];
    cap(bend,-101,130,78,arr[0],arr[1]);
    c.restore();
  }
  function sky(){
    c.fillStyle=colorGradient(0,0,0,H,
      [[0,'#7cc3df'],[.4,'#a6dfdc'],[.68,'#e3f3ce'],[1,'#fff2d2']]);
    c.fillRect(0,0,W,H);
    const sunX=W*.75,sunY=H*.18;
    softGlow(sunX,sunY,180,'rgba(255,242,176,.53)');
    edge(sunX,sunY,47,colorGradient(sunX,sunY-50,sunX,sunY+50,
      [[0,'#fffce0'],[1,'#ffdc8e']]));
    softGlow(sunX,sunY,75,'rgba(255,255,232,.23)');
    // Clouds and hills at distinct parallax velocities.
    const spacing=380,p=cam*.11;
    for(let j=Math.floor(p/spacing)-2;j<=Math.ceil((p+W)/spacing)+2;j++){
      const x=j*spacing-p+rand(j,13)*92;
      if(x<-190||x>W+200)continue;
      cloud(x,H*.18+rand(j,4)*75,.67+rand(j,11)*.5,.9);
    }
    for(let layer=0;layer<2;layer++){
      const f=layer===0?.17:.31,step=layer===0?360:288,p=cam*f;
      for(let j=Math.floor((p-240)/step)-1;j<=Math.ceil((p+W+240)/step);j++){
        const x=j*step-p+rand(j,layer+22)*90;
        if(x<-300||x>W+300)continue;
        mountain(x,H*(layer===0?.62:.71),step*.9,
          H*(layer===0?.22:.23)+rand(j,layer+26)*37,layer===1);
      }
    }
    // Castle comes and goes with scenery, not a looped decoration on every chunk.
    const p2=cam*.27,castStep=CELL*4;
    for(let j=Math.floor((p2-200)/castStep)-1;j<=Math.ceil((p2+W+200)/castStep);j++){
      const x=j*castStep-p2+920;
      if(x<-200||x>W+200)continue;
      tower(x,H*.7,.55,j%2);
    }
  }
  function distantMushrooms(){
    const f=.55,step=385,p=cam*f;
    for(let j=Math.floor((p-160)/step)-1;j<=Math.ceil((p+W+160)/step);j++){
      const x=j*step-p+rand(j,61)*70;
      if(x<-170||x>W+170)continue;
      const y=H*.72+Math.sin(j*1.79)*10;
      mushroom(x,y,.67+rand(j,40)*.25,hash(j+99)%4,2);
      if(((j%4)+4)%4===2)pipe(x+132,y+1,.49);
      oval(x+40,y+1,36,8,'rgba(84,149,106,.17)');
    }
  }
  function water(){
    const y=H*.755;
    c.fillStyle=colorGradient(0,y,0,H,[[0,'#7eddd2'],[.4,'#4abac8'],[1,'#317eae']]);
    c.fillRect(0,y,W,H-y);
    // Real horizon refraction under platforms.
    rounded(0,y-2,W,9,2,'rgba(235,255,230,.28)');
    for(let row=0;row<5;row++){
      const yy=y+18+row*27;
      const drift=(cam*.19+time*12*(row%2?1:-1))%79;
      for(let j=-2;j<W/79+3;j++){
        const x=j*79-drift+(row%2)*37;
        c.beginPath();c.moveTo(x,yy);
        c.quadraticCurveTo(x+10,yy-3-Math.sin(time*.8+j)*2,x+25,yy);
        c.strokeStyle=row%2?'rgba(241,255,228,.28)':'rgba(244,255,234,.47)';
        c.lineWidth=row<2?2.8:1.7;c.stroke();
      }
    }
  }
  function land(a,b,variant){
    if(b-a<1)return;
    const col=palettes[((variant%4)+4)%4];
    const left=a-cam,right=b-cam,y0=ground(a),y1=ground(b);
    // Solid rounded-looking cross-section with a carved rock face.
    c.beginPath();c.moveTo(left,y0);
    for(let x=a+9;x<b;x+=9)c.lineTo(x-cam,ground(x));
    c.lineTo(right,y1);c.lineTo(right,H+75);c.lineTo(left,H+75);c.closePath();
    c.fillStyle=colorGradient(0,H*.68,0,H,[[0,col.cliff],[.2,'#9f7892'],[1,col.dark]]);
    c.fill();
    c.save();c.clip();
    // Soft dimensional face planes follow the geology and not screen position.
    for(let row=0;row<8;row++){
      const y=H*.76+row*26;
      for(let wx=Math.floor(a/58)*58;wx<b+60;wx+=58){
        const xx=wx-cam+((row%2)*24),r=rand((wx/58)|0,row+77);
        oval(xx,y+r*9,14+r*16,4+r*2,
          row%3===0?'rgba(255,213,156,.17)':'rgba(79,56,109,.12)',-.13);
      }
    }
    c.restore();
    // Turf is a raised beveled band rather than one flat line.
    c.beginPath();c.moveTo(left,y0+10);
    for(let x=a+8;x<b;x+=8)c.lineTo(x-cam,ground(x)+10);
    c.lineTo(right,y1+10);c.strokeStyle='#417e6c';c.lineWidth=14;c.stroke();
    c.beginPath();c.moveTo(left,y0+2);
    for(let x=a+8;x<b;x+=8)c.lineTo(x-cam,ground(x)+2);
    c.lineTo(right,y1+2);c.strokeStyle=col.grass;c.lineWidth=18;c.stroke();
    c.beginPath();c.moveTo(left,y0-6);
    for(let x=a+8;x<b;x+=8)c.lineTo(x-cam,ground(x)-6);
    c.lineTo(right,y1-6);c.strokeStyle=col.top;c.lineWidth=7;c.stroke();
    c.beginPath();c.moveTo(left,y0-11);
    for(let x=a+8;x<b;x+=8)c.lineTo(x-cam,ground(x)-11);
    c.lineTo(right,y1-11);c.strokeStyle='rgba(255,253,190,.63)';c.lineWidth=2;c.stroke();
    // Cross-section cuts for a real gap rather than a continuous decorative stroke.
    if(segment(Math.floor(a/CELL)).kind==='leap'&&b-a<500){
      for(const x of [a,b]){
        const nearby=(x%CELL+CELL)%CELL;
        if(Math.abs(nearby-345)<1||Math.abs(nearby-457)<1){
          const xx=sx(x),yy=ground(x);
          rounded(xx-6,yy,12,42,5,'#9b7c91');
          oval(xx,yy+8,3,4,'#ffecbd');
        }
      }
    }
  }
  function flower(x,y,scale=1,tint=0){
    c.save();c.translate(x,y);c.scale(scale,scale);
    oval(0,0,18,4,'rgba(53,104,83,.18)');
    c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-4,-22,2,-44);
    c.strokeStyle='#387b70';c.lineWidth=3;c.stroke();
    oval(-8,-17,13,5,'#67b876',-.7);oval(8,-29,11,5,'#73c985',.7);
    c.save();c.translate(2,-46);c.rotate(Math.sin(time*.8+x*.009)*.11);
    for(let i=0;i<6;i++){
      const a=i*TAU/6;oval(Math.cos(a)*11,Math.sin(a)*11,7,11,
        tint?'#ffba75':'#ffa0b5',a);
    }
    edge(0,0,7,'#ffdb77','#cf9460',1);
    edge(-2,-2,2,'rgba(255,255,236,.91)');
    c.restore();c.restore();
  }
  function grass(x,y,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);
    for(let k=-2;k<=2;k++){
      c.beginPath();c.moveTo(0,2);
      c.quadraticCurveTo(k*4,-15,k*10,-20-(k%2)*7);
      c.strokeStyle=k%2?'#56ae75':'#80ca84';c.lineWidth=3;c.stroke();
    }
    c.restore();
  }
  function pipe(x,y,s=1){
    // Glazed coral-violet pipe, with a wide beveled top and darker right wall.
    c.save();c.translate(x,y);c.scale(s,s);
    oval(0,1,42,10,'rgba(51,70,78,.22)');
    const body=colorGradient(-33,-75,39,-75,
      [[0,'#cf96bf'],[.26,'#f4b5c4'],[.56,'#cf83af'],[1,'#825d9a']]);
    rounded(-35,-89,70,88,12,body,'#845d92');
    rounded(17,-89,12,88,5,'rgba(92,64,128,.25)');
    rounded(-43,-105,86,26,12,
      colorGradient(-43,-90,43,-90,[[0,'#eaaec7'],[.45,'#f7c8c3'],[1,'#a56da9']]),'#946b9b');
    oval(0,-97,34,7,'#7a5889');oval(-5,-101,23,3,'rgba(255,231,226,.4)');
    rounded(-20,-70,7,46,3,'rgba(255,244,226,.28)');
    c.restore();
  }
  function block(x,y,kind=0){
    c.save();c.translate(x,y);
    oval(5,11,30,9,'rgba(59,76,96,.09)');
    rounded(-25,-25,53,51,11,'#876782','#674d78');
    rounded(-26,-30,50,49,10,
      colorGradient(-25,-30,26,26,
       kind?[[0,'#fbe0b1'],[.5,'#edb77c'],[1,'#b78d9f']]:
            [[0,'#f6cda7'],[.48,'#e6a489'],[1,'#a87b95']]),
      '#9e7087');
    rounded(-18,-23,33,8,4,'rgba(255,251,218,.34)');
    for(let a=0;a<4;a++){
      const xx=a%2===0?-16:14,yy=a<2?-15:11;
      oval(xx,yy,2,2,'rgba(129,87,98,.52)');
    }
    if(kind)star(-1,-1,8,'#fff1b6');
    else stroke([[-15,0],[14,0]],'rgba(143,95,115,.31)',2);
    c.restore();
  }
  function bridge(x,y,w=170){
    // A sturdy scalloped bridge appears over the water but never replaces solid terrain.
    c.save();c.translate(x,y);
    oval(0,10,w*.47,10,'rgba(78,113,132,.18)');
    for(let j=0;j<7;j++){
      const px=-w*.5+j*w/6;
      rounded(px-4,-6,8,21,3,'#a97b7e');
      oval(px,-7,6,4,'#f4ce9d');
    }
    c.beginPath();c.moveTo(-w*.56,-7);
    c.quadraticCurveTo(0,19,w*.56,-7);
    c.strokeStyle='#b97c78';c.lineWidth=11;c.stroke();
    c.beginPath();c.moveTo(-w*.56,-11);
    c.quadraticCurveTo(0,13,w*.56,-11);
    c.strokeStyle='#f2c69c';c.lineWidth=6;c.stroke();
    c.restore();
  }
  function waterfall(x,y){
    c.save();c.translate(x,y);
    const w=70;
    softGlow(0,60,80,'rgba(210,255,235,.3)');
    c.beginPath();c.moveTo(-w*.5,-10);c.bezierCurveTo(-w*.43,18,-w*.3,70,-w*.5,135);
    c.lineTo(w*.5,135);c.bezierCurveTo(w*.28,58,w*.42,17,w*.5,-10);c.closePath();
    c.fillStyle=colorGradient(-w/2,10,w/2,10,
      [[0,'rgba(200,255,240,.28)'],[.2,'rgba(232,255,247,.86)'],
       [.58,'rgba(111,215,218,.64)'],[1,'rgba(221,255,239,.55)']]);
    c.fill();
    for(let k=0;k<5;k++){
      const dx=(k-2)*13+Math.sin(time*2+k)*3;
      stroke([[dx,-7],[dx-3,60],[dx+3,119]],'rgba(255,255,255,.53)',2);
    }
    oval(0,129,55,8,'rgba(241,255,248,.65)');
    c.restore();
  }
  function themedProp(i,a,kind){
    const offset=a+(kind==='bounce'?380:420),x=sx(offset),y=ground(offset),variant=hash(i+201)%4;
    if(!visible(offset,160))return;
    if(kind==='bounce'){
      mushroom(x,y,.77,variant,1.2);
      softGlow(x,y-132,62,'rgba(255,247,182,.40)');
    }else if(kind==='slide'){
      // Raised log bridge: character ducks beneath at the stunt apex.
      c.save();c.translate(x,y);
      rounded(-68,-119,136,22,11,
        colorGradient(-65,-119,55,-97,[[0,'#e7bd98'],[.57,'#b58483'],[1,'#956a86']]),'#906c7a');
      oval(-63,-106,11,15,'#f6d59b');oval(63,-106,11,15,'#f6d59b');
      oval(-40,-110,7,2,'rgba(255,255,234,.42)');
      c.restore();
    }else if(kind==='wallkick'){
      // The wall is just ahead of the runner during the stunt, not centered on it.
      rounded(x+34,y-185,36,185,13,
        colorGradient(x+34,y-90,x+70,y-90,[[0,'#e1c1c1'],[.52,'#bd9cb6'],[1,'#8e779e']]),
        '#987995');
      for(let j=0;j<5;j++)oval(x+52,y-31-j*28,4,4,'#fbecc6');
    }else if(kind==='vault'){
      mushroom(x,y,.52,variant,1);
    }else if(kind==='glide'){
      waterfall(x+105,y-7);
    }else if(kind==='leap'){
      // A waterfall hangs safely below the rim of the actual chasm.
      waterfall(x-11,y+37);
    }else if(kind==='dash'){
      bridge(x,y+3,158);
    }else if(kind==='spin'||kind==='twirl'){
      for(let j=0;j<2;j++)block(x+(j-.5)*61,y-167-(j%2)*24,j);
    }else if(kind==='cartwheel'){
      for(let j=0;j<3;j++)block(x+(j-1)*63,y-173, j===1?1:0);
    }
  }
  function scenery(){
    water();
    const first=Math.floor(cam/CELL)-1,last=Math.ceil((cam+W)/CELL)+1;
    for(let i=first;i<=last;i++){
      const a=i*CELL,b=a+CELL,kind=segment(i).kind;
      if(b<cam-140||a>cam+W+140)continue;
      const variant=hash(i+98)%4;
      if(kind==='leap'){
        land(a,a+345,variant);
        land(a+457,b,variant);
        // The isolated gap is real geometry; no flowers/objects cross into it.
      }else land(a,b,variant);
      for(let j=0;j<5;j++){
        const wx=a+73+j*147+rand(i*7+j,71)*19;
        if(!visible(wx,80)||gap(i,wx))continue;
        const x=sx(wx),y=ground(wx);
        if(j===1||rand(i*7+j,54)>.59){
          mushroom(x,y,.25+rand(i*7+j,67)*.16,variant+j,1);
        }else if(j===3)flower(x,y,.67,variant%2);
        else grass(x,y,.9);
      }
      // Only special props own the center lane, preventing scene clutter.
      themedProp(i,a,kind);
      if(kind!=='dash'&&kind!=='slide'){
        for(let j=0;j<4;j++){
          const wx=a+247+j*76;
          if(!visible(wx,28)||gap(i,wx))continue;
          const yy=ground(wx)-119-Math.sin(j*PI/3)*35;
          const x=sx(wx),bob=Math.sin(time*1.5+i+j)*3;
          softGlow(x,yy+bob,22,'rgba(255,236,151,.21)');
          star(x,yy+bob,10,'#ffdf87',time*.24+j*.4);
        }
      }
    }
  }
  function scarf(t){
    // Trail changes with speed and stunt, staying attached to the neck.
    const flutter=Math.sin(time*13+t)*4;
    c.beginPath();c.moveTo(-12,-73);
    c.quadraticCurveTo(-28,-75+flutter,-48,-88+flutter*.4);
    c.quadraticCurveTo(-35,-65+flutter,-18,-64);c.closePath();
    c.fillStyle='#f1947e';c.fill();
    c.strokeStyle='#d26f76';c.lineWidth=1.3;c.stroke();
  }
  function pip(x,y){
    const airborne=pose.lift>7,run=pose.kind==='run'||pose.kind==='dash';
    const frame=time*16.4,cadence=Math.sin(frame),bounce=run?Math.abs(cadence)*2.8:0;
    const squat=pose.squash,spin=pose.spin,lean=pose.lean;
    const sh=ground(distance)+5;
    // Ambient-occlusion / contact shadow is the anchor for every stunt.
    oval(x+2,sh,airborne?13:26,airborne?3:5,
      airborne?'rgba(42,71,82,.16)':'rgba(40,74,74,.32)');
    if(airborne){
      softGlow(x,sh,30,'rgba(245,255,214,.08)');
    }
    c.save();
    c.translate(x,y-bounce);
    c.translate(0,-51*squat);c.rotate(spin+lean);
    c.translate(0,51*squat);c.scale(1,squat);
    c.lineCap='round';c.lineJoin='round';
    // Stylized little adventurer, no mustache, trademark insignia or red plumber outfit.
    // Tiny satchel behind the body adds a readable asymmetrical 2.5D silhouette.
    c.save();c.translate(-20,-54);c.rotate(-.1+Math.sin(time*5)*.07);
    rounded(-10,-9,32,33,11,
      colorGradient(-12,0,22,0,[[0,'#bd996e'],[.6,'#e7bf88'],[1,'#987a72']]),'#937675');
    rounded(-10,1,32,9,4,'rgba(123,89,101,.25)');
    c.restore();
    // Rear leg, swung from hip and covered by the jacket later.
    const leg=run?cadence*.75:.12;
    for(const side of[-1,1]){
      c.save();c.translate(side*12,-24);
      c.rotate(side*(airborne?-.46:leg));
      const g=colorGradient(-9,0,11,0,[[0,'#5b608d'],[.6,'#8d85bb'],[1,'#515b85']]);
      rounded(side*0-7,-3,14,27,7,g,'#5c6089');
      oval(side*5+2,23,14,8,
        colorGradient(-11,16,13,25,[[0,'#f1ba7e'],[.6,'#d47d68'],[1,'#af5f79']]),-.09);
      oval(side*9,20,7,2,'rgba(255,241,194,.64)');
      c.restore();
    }
    scarf(spin);
    c.save();c.translate(0,-63);c.rotate(lean*.3);
    // Rounded coat volume (two opposing gradient directions).
    oval(0,8,23,28,colorGradient(-22,-1,24,28,
      [[0,'#594d91'],[.24,'#8177c3'],[.72,'#a89de0'],[1,'#655a9b']]));
    oval(-9,9,10,22,'rgba(58,61,123,.26)');
    rounded(-13,-8,29,31,10,
      colorGradient(-15,-7,17,19,[[0,'#4bbaa6'],[.5,'#8cd8ba'],[1,'#3f9b99']]),
      '#488b99');
    oval(-4,0,2.4,2.5,'#fff0bc');oval(-4,12,2.4,2.5,'#fff0bc');
    for(const side of[-1,1]){
      c.save();c.translate(side*19,-2);
      c.rotate(side*(airborne?-.72:Math.sin(frame+side)*.39));
      stroke([[0,-7],[side*7,13]],'#5e699e',10);
      oval(side*9,14,7,7,
        colorGradient(side*2,9,side*14,18,[[0,'#fff0cf'],[1,'#d5ab9a']]));
      c.restore();
    }
    // Oversized face with bright cheek forms and visible side-to-side volume.
    oval(0,-29,25,25,
      colorGradient(-23,-47,21,-5,
        [[0,'#f5c69c'],[.55,'#ffe4b7'],[1,'#dfad9b']]));
    oval(19,-28,6,11,'#eeb99f');
    oval(-19,-28,6,11,'#f0ba9b');
    const blink=(time%5.2)>5.04;
    if(blink){
      stroke([[-11,-29],[-4,-29]],'#60526f',2);
      stroke([[4,-29],[11,-29]],'#60526f',2);
    }else{
      oval(-7,-31,3.2,5,'#554d67');
      oval(9,-30,3.2,5,'#554d67');
      oval(-8,-33,1.3,1.7,'#fffdfa');oval(8,-32,1.3,1.7,'#fffdfa');
    }
    oval(-17,-20,4.7,2.5,'rgba(240,138,137,.61)');
    oval(17,-20,4.7,2.5,'rgba(240,138,137,.57)');
    c.beginPath();c.arc(2,-23,5,.10,PI-.22);
    c.strokeStyle='#a86379';c.lineWidth=1.8;c.stroke();
    // Large sculpted leaf cap with a softly lit underside.
    oval(0,-48,35,10,'#caead3');
    c.beginPath();c.moveTo(-34,-48);
    c.bezierCurveTo(-44,-73,-24,-103,1,-105);
    c.bezierCurveTo(33,-107,47,-75,34,-48);c.closePath();
    c.fillStyle=colorGradient(-38,-95,39,-46,
      [[0,'#a2e0ba'],[.31,'#5ec6ad'],[.71,'#409e9b'],[1,'#327987']]);
    c.fill();c.strokeStyle='#3b8385';c.lineWidth=2.5;c.stroke();
    oval(-17,-78,8,10,'rgba(243,255,232,.98)',-.2);
    oval(15,-69,11,9,'rgba(248,255,236,.96)',.21);
    oval(2,-94,6.5,4.5,'rgba(242,255,233,.88)');
    c.beginPath();c.ellipse(-7,-83,19,9,-.4,PI,TAU);
    c.strokeStyle='rgba(246,255,236,.36)';c.lineWidth=6;c.stroke();
    c.restore();
    if(pose.glide){
      // Cream glider becomes an overhead umbrella; folds flat at the landing.
      c.save();c.translate(0,-117);
      c.rotate(Math.sin(time*.9)*.035);
      stroke([[-53,0],[53,0]],'#8f849d',3);
      c.beginPath();c.moveTo(-74,0);
      c.quadraticCurveTo(0,-55,74,0);
      c.quadraticCurveTo(0,8,-74,0);c.closePath();
      c.fillStyle=colorGradient(0,-47,0,9,[[0,'#fff3ca'],[.7,'#edcdb6'],[1,'#b9b1c8']]);
      c.fill();c.strokeStyle='#a597ab';c.lineWidth=2;c.stroke();
      c.restore();
    }
    c.restore();
    // Deterministic dust and stunt sparkles: no particle allocations.
    const foot=ground(distance)-2,phase=distance/31;
    if(run){
      for(let j=0;j<3;j++){
        const trail=12+j*19,xx=x-trail;
        oval(xx,foot-3-j*4+Math.sin(phase+j)*3,7-j*1.3,2.7-j*.6,
          'rgba(253,249,204,'+(.3-j*.08)+')');
      }
    }else if(airborne){
      for(let j=0;j<3;j++){
        const th=time*1.2+j*TAU/3;
        const dx=Math.cos(th)*(31+j*9),dy=Math.sin(th)*(19+j*13);
        star(x+dx,y-53+dy,4+j,'rgba(255,241,162,.7)',th);
      }
    }
  }
  function nearPlane(){
    // Soft painted leaves never cover Pip or hide the jump's destination.
    const drift=cam*1.13,space=340;
    c.save();c.globalAlpha=.31;
    for(let j=Math.floor(drift/space)-1;j<=Math.ceil((drift+W)/space);j++){
      const x=j*space-drift+rand(j,88)*68,yy=H+16;
      if(x<-100||x>W+100)continue;
      for(let k=-1;k<=1;k++){
        c.beginPath();c.moveTo(x,yy);
        c.quadraticCurveTo(x+k*18,yy-30,x+k*28,yy-73+rand(k+j,89)*10);
        c.strokeStyle='#2d8283';c.lineWidth=5;c.stroke();
      }
    }
    c.restore();
    const vignette=c.createRadialGradient(W*.52,H*.38,Math.min(W,H)*.3,
      W*.52,H*.38,Math.max(W,H)*.86);
    vignette.addColorStop(0,'rgba(50,77,85,0)');
    vignette.addColorStop(1,'rgba(42,83,106,.16)');
    c.fillStyle=vignette;c.fillRect(0,0,W,H);
  }
  function paint(ctx,opt){
    c=ctx;W=opt.W;H=opt.H;cam=opt.cam;time=opt.time;distance=opt.distance;
    ground=opt.ground;segment=opt.segment;gap=opt.gap;
    rand=opt.rand;hash=opt.hash;pose=opt.pose;
    c.save();
    if(window.MushroomKingdom){
      window.MushroomKingdom.paint(c,{W,H,cam,time});
    }else{
      // All original v2 scenery remains the graceful fallback.
      sky();
      distantMushrooms();
    }
    scenery();
    pip(distance-cam,ground(distance)-pose.lift);
    nearPlane();
    c.restore();
  }
  return {paint,version:'2.5d-diorama-v2'};
})();
window.MushroomIslandV2 = MushroomIslandV2;
