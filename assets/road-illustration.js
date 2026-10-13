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
 function carImage(){
  const im=image('car');if(!im)return null;
  if(!carContact){
   const source=document.createElement('canvas');source.width=im.naturalWidth;source.height=im.naturalHeight;const q=source.getContext('2d');q.drawImage(im,0,0);const data=q.getImageData(0,0,source.width,source.height).data;
   let left=source.width,right=0,top=source.height,bottom=0;
   for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(data[(y*source.width+x)*4+3]>48){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   carContact=document.createElement('canvas');carContact.width=right-left+1;carContact.height=bottom-top+1;carContact.getContext('2d').drawImage(source,left,top,carContact.width,carContact.height,0,0,carContact.width,carContact.height);
  }
  return carContact;
 }
 function car(c,x,y,size,turn){
  if(!carImage())return false;
  const width=size*135,height=width*carContact.height/carContact.width;
  const pose=turn&&typeof turn==='object'?turn:{shear:0,pitch:1};
  // Contact patches live on the road plane. They never rotate with the upper body.
  c.save();c.translate(x,y);
  const belly=c.createRadialGradient(0,-width*.065,width*.08,0,-width*.065,width*.46);
  belly.addColorStop(0,'rgba(7,19,22,.5)');belly.addColorStop(.65,'rgba(7,19,22,.23)');belly.addColorStop(1,'rgba(7,19,22,0)');
  c.save();c.scale(1,.28);c.fillStyle=belly;c.fillRect(-width*.5,-width*.55,width,width*1.1);c.restore();
  c.fillStyle='rgba(8,18,20,.65)';
  for(const side of [-1,1]){c.beginPath();c.ellipse(side*width*.375,-.1,width*.068,Math.max(.65,width*.012),0,0,Math.PI*2);c.fill();}
  // Shear turns the roof toward the road's tangent while keeping both rear tyres planted.
  c.transform(1,0,pose.shear||0,pose.pitch||1,0,0);
  c.drawImage(RoadWeather.paintedCar(carContact),-width/2,-height+Math.sin(journey*7)*width*.0015,width,height);
  c.strokeStyle='rgba(204,216,197,.42)';c.lineWidth=.65;const spin=(typeof journey==='undefined'?0:journey*42/.27);
  for(const side of [-1,1])for(let k=0;k<3;k++){const a=spin+k*Math.PI/3,r=width*.024,cx=side*width*.375,cy=-width*.06;c.beginPath();c.moveTo(cx-Math.cos(a)*r*.4,cy-Math.sin(a)*r);c.lineTo(cx+Math.cos(a)*r*.4,cy+Math.sin(a)*r);c.stroke();}c.restore();return true;
 }
 function carGround(c,P,z,lane,width,w,h){
  const rear={x:P.rx(z)+P.hw(z)*lane,y:P.yy(z)},d=36/(z+.025),frontZ=Math.max(.01,36/(d+3.8)-.025);
  const front={x:P.rx(frontZ)+P.hw(frontZ)*lane,y:P.yy(frontZ)},ratio=P.hw(frontZ)/P.hw(z);
  // Project all four corners of the undercarriage through the road, not a screen-space ellipse.
  c.save();c.fillStyle='rgba(12,26,29,.22)';c.beginPath();c.moveTo(rear.x-width*.37,rear.y);c.lineTo(front.x-width*.32*ratio,front.y);c.lineTo(front.x+width*.32*ratio,front.y);c.lineTo(rear.x+width*.37,rear.y);c.closePath();c.fill();c.restore();
  const pitch=Math.max(.77,Math.min(1,1-Math.max(0,h/w-1)*.18)),height=width*.877*pitch;
  const shear=Math.max(-.2,Math.min(.2,(rear.x-front.x)/Math.max(1,height)));
  return {x:rear.x,y:rear.y,shear,pitch,front,frontZ};
 }
 function car3d(c,P,z,lane,options={}){
  const sprite=carImage();if(!sprite)return false;const hero=options.luggage!==false,front=Boolean(options.front),color=options.color||'#c95740';
  const distance=36/(z+.025),roadHalf=3.5;
  const point=(x,d,height=0)=>{if(typeof cv!=='undefined'&&cv.width/cv.height<.85){x*=.88;height*=.88;d*=.88;}const depth=36/(distance+d*.84)-.025,scale=P.hw(depth)/roadHalf;return {x:P.rx(depth)+P.hw(depth)*lane+x*scale,y:P.yy(depth)-height*scale,scale};};
  const face=(points,colors)=>{const pts=points.map(p=>point(...p)),g=c.createLinearGradient(pts[0].x,pts[0].y,pts[2].x,pts[2].y);g.addColorStop(0,RoadWeather.lit(colors[0]));g.addColorStop(.45,hero||colors[1].startsWith('#4')||colors[1].startsWith('#5')?RoadWeather.lit(colors[1]):RoadWeather.lit(color));g.addColorStop(1,RoadWeather.lit(colors[2]));c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=g;c.fill();RoadWeather.reflect(c,pts,['#89b8b2','#283f48','#263f49'].includes(colors[0]));c.strokeStyle='rgba(81,45,33,.65)';c.lineWidth=.65;c.stroke();};
  const line=(a,b,color,width=.8)=>{const p=point(...a),q=point(...b);c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();};
  // Four wheel contacts share the ground projection. The body is lifted in world height.
  for(const d of [3.45,.48])for(const side of [-1,1]){
   const p=point(side*.8,d),r=p.scale*.27;c.fillStyle='rgba(8,18,20,.55)';c.beginPath();c.ellipse(p.x,p.y,Math.max(1,p.scale*.12),Math.max(.55,p.scale*.035),0,0,Math.PI*2);c.fill();
   c.fillStyle='#17282a';c.beginPath();c.ellipse(p.x,p.y-r,Math.max(1,p.scale*.105),r,0,0,Math.PI*2);c.fill();c.strokeStyle='#6a7871';c.lineWidth=.6;c.beginPath();c.ellipse(p.x,p.y-r,p.scale*.045,r*.5,0,0,Math.PI*2);c.stroke();for(let spoke=0;spoke<3;spoke++){const angle=(typeof journey==='undefined'?0:journey*42/.27)+spoke*Math.PI/3;c.beginPath();c.moveTo(p.x-Math.cos(angle)*p.scale*.035,p.y-r-Math.sin(angle)*r*.45);c.lineTo(p.x+Math.cos(angle)*p.scale*.035,p.y-r+Math.sin(angle)*r*.45);c.stroke();}
  }
  face([[-.77,0,.32],[-.77,4.05,.36],[-.73,4.05,.89],[-.73,0,.92]],['#8d302c','#b24a3b','#e68a6a']);
  face([[.77,0,.32],[.77,4.05,.36],[.73,4.05,.89],[.73,0,.92]],['#792c29','#ad4337','#d66a53']);
  // Bonnet, windscreen, curved roof, rear glass and boot each have their own plane.
  face([[-.73,3,.91],[.73,3,.91],[.66,4.05,.85],[-.66,4.05,.85]],['#d86b53','#f2a184','#ac4437']);
  face([[-.61,2.9,1.38],[.61,2.9,1.38],[.73,3.23,.91],[-.73,3.23,.91]],['#89b8b2','#416b75','#203e48']);
  face([[-.58,1.42,1.48],[.58,1.42,1.48],[.61,2.9,1.38],[-.61,2.9,1.38]],['#ed9a7d','#bf5141','#f0b39a']);
  face([[-.7,.82,.94],[.7,.82,.94],[.58,1.42,1.48],[-.58,1.42,1.48]],['#283f48','#527b7d','#a8c7b7']);
  face([[-.73,0,.92],[.73,0,.92],[.7,.82,.94],[-.7,.82,.94]],['#bd4a3b','#e88869','#9d392f']);
  for(const side of [-1,1])face([[side*.7,.82,.94],[side*.58,1.42,1.48],[side*.61,2.9,1.38],[side*.73,3.23,.91]],['#263f49','#4b7880','#bdd0bd']);
  // The painted rear panel preserves the red vintage car's chrome and tail-light detail.
  const a=point(-.78,0,1.0),b=point(.78,0,.33);if(hero){const painted=RoadWeather.paintedCar(sprite);c.drawImage(painted,0,painted.height*.46,painted.width,painted.height*.45,a.x,a.y,b.x-a.x,b.y-a.y);}
  else {c.fillStyle=color;c.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);c.fillStyle=front?'#f0e6bb':'#b96552';const lampY=a.y+(b.y-a.y)*.35;for(const side of [-1,1]){const px=(a.x+b.x)/2+side*(b.x-a.x)*.31;c.beginPath();c.roundRect(px-(b.x-a.x)*.09,lampY,(b.x-a.x)*.18,Math.max(1,(b.y-a.y)*.13),1);c.fill();}c.fillStyle='#365054';c.fillRect((a.x+b.x)/2-(b.x-a.x)*.18,a.y+(b.y-a.y)*.46,(b.x-a.x)*.36,Math.max(1,(b.y-a.y)*.14));}
  // A dimensional luggage case follows the roof, including its side wall and leather straps.
  if(hero){face([[-.43,1.6,1.68],[.43,1.6,1.68],[.43,2.46,1.61],[-.43,2.46,1.61]],['#d0ae7b','#ae8353','#e0c18b']);
  face([[-.43,1.6,1.48],[.43,1.6,1.48],[.43,1.6,1.68],[-.43,1.6,1.68]],['#795d41','#b08a5a','#ceac74']);
  for(const x of [-.25,.25])line([x,1.6,1.69],[x,2.46,1.62],'#75593e',1.1);}
  line([-.71,.04,.37],[.71,.04,.37],'#d9d9b9',1.5);line([-.54,1.46,1.49],[.54,1.46,1.49],'#f1d19a',.8);
  return true;
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
   if(z<=0||z>1.03||onRiver(z,j,ix))continue;
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
 function trainViaduct(c,x,y,s,t){
  c.save();c.translate(x,y);c.scale(s,s);
  // Both banks carry the approach track all the way to the tunnel mouths.
  c.fillStyle='#637e62';c.beginPath();c.moveTo(-176,11);c.lineTo(-176,-36);c.lineTo(-112,-36);c.lineTo(-98,11);c.closePath();c.fill();
  c.beginPath();c.moveTo(98,11);c.lineTo(112,-36);c.lineTo(176,-36);c.lineTo(176,11);c.closePath();c.fill();
  // One solid spandrel wall; openings stay entirely beneath the uninterrupted deck.
  c.fillStyle='#748778';c.beginPath();c.rect(-112,-28,224,38);
  for(let k=0;k<7;k++){const xx=-112+k*32;c.moveTo(xx+6,10);c.lineTo(xx+6,-12);c.quadraticCurveTo(xx+16,-33,xx+26,-12);c.lineTo(xx+26,10);c.closePath();}
  c.fill('evenodd');
  c.fillStyle='#657867';for(let k=0;k<=7;k++)c.fillRect(-115+k*32,7,6,5);
  c.fillStyle='#829584';c.fillRect(-114,-36,228,8);c.fillStyle='#a0ad90';c.fillRect(-114,-36,228,2);
  c.fillStyle='#5f6f60';for(let a=-146;a<=146;a+=7)c.fillRect(a,-38,3,2);
  c.strokeStyle='#c3c7a6';c.lineWidth=1.2;c.beginPath();c.moveTo(-148,-38);c.lineTo(148,-38);c.stroke();
  // The entire train is offscreen behind a tunnel before its distance wraps.
  const lead=-230+((t*11)%460+460)%460;
  c.save();c.beginPath();c.rect(-148,-76,296,38);c.clip();
  for(let k=3;k>=0;k--){const xx=lead-k*24;
   if(k){c.strokeStyle='#405347';c.lineWidth=1;c.beginPath();c.moveTo(xx+20,-43);c.lineTo(xx+24,-43);c.stroke();}
   c.fillStyle=k?'#af8863':'#55766f';c.beginPath();c.roundRect(xx,-57,21,15,2);c.fill();c.fillStyle='#486157';c.fillRect(xx-1,-58,23,2);
   c.fillStyle='#e1d9ae';c.fillRect(xx+3,-54,5,5);c.fillRect(xx+12,-54,5,5);
   if(!k){c.fillStyle='#cfb77c';c.fillRect(xx+19,-48,2,3);c.fillStyle='#385248';c.fillRect(xx+17,-61,3,4);}
   for(const wheel of [4,17]){c.fillStyle='#34483c';c.beginPath();c.arc(xx+wheel,-40,2,0,Math.PI*2);c.fill();const angle=t*11/2;c.strokeStyle='#a0ac8d';c.lineWidth=.5;c.beginPath();c.moveTo(xx+wheel-Math.cos(angle)*1.5,-40-Math.sin(angle)*1.5);c.lineTo(xx+wheel+Math.cos(angle)*1.5,-40+Math.sin(angle)*1.5);c.stroke();}
  }c.restore();
  // Foreground banks conceal the clipped entry and exit, rather than exposing a cut.
  for(const side of [-1,1]){c.save();c.scale(side,1);c.fillStyle='#557452';c.beginPath();c.moveTo(145,12);c.lineTo(145,-62);c.quadraticCurveTo(157,-81,177,-62);c.lineTo(193,12);c.closePath();c.fill();c.strokeStyle='#809271';c.lineWidth=2;c.beginPath();c.moveTo(145,-38);c.lineTo(145,-56);c.quadraticCurveTo(151,-66,158,-56);c.stroke();c.restore();}
  c.restore();
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
   if(ix===0)trainViaduct(c,w*.11+Math.sin(j*.02)*w*.012,horizon+h*.011,Math.min(w,h)*.0018,t);
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
   list.push({i:k,z,side:ix===3?1:k%2?1:-1,landmark:true,variant:k%3});
  }return list;
 }
 function life(c,P,w,h,j,ix,t){
  if(ix===0||ix===1){
   // A single distant balloon drifts with the breeze; the basket hangs below its envelope.
   const x=w*(.2+.045*Math.sin(t*.035+ix)),y=h*(.15+.008*Math.sin(t*.13)),s=Math.min(w,h)*.0012;
   c.save();c.translate(x,y);c.scale(s,s);const fabric=c.createLinearGradient(-20,-32,22,24);fabric.addColorStop(0,'#e7c895');fabric.addColorStop(.5,ix===1?'#b9654e':'#829b8b');fabric.addColorStop(1,'#586e66');c.fillStyle=fabric;
   c.beginPath();c.moveTo(-6,22);c.bezierCurveTo(-13,13,-28,-4,-25,-20);c.bezierCurveTo(-22,-47,23,-46,26,-20);c.bezierCurveTo(29,-4,13,14,6,22);c.closePath();c.fill();
   c.strokeStyle='rgba(243,223,183,.6)';c.lineWidth=1;for(let k=-1;k<=1;k++){c.beginPath();c.moveTo(k*5,21);c.bezierCurveTo(k*12,0,k*18,-25,k*8,-39);c.stroke();}
   c.strokeStyle='#677264';c.beginPath();c.moveTo(-6,22);c.lineTo(-4,32);c.moveTo(6,22);c.lineTo(4,32);c.stroke();c.fillStyle='#907657';c.fillRect(-5,31,10,7);c.restore();
  }
  if(ix===0||ix===2){
   const camera=j*42,k=Math.floor((camera+260)/1600),d=520+k*1600-camera,z=36/d-.025;
   if(d>45&&z>.045&&z<.72&&!onRiver(z,j,ix))for(let n=0;n<2;n++){
    const s=P.hw(z)/160,x=P.rx(z)-P.hw(z)*(2.8+n*.33),y=P.yy(z)+n*s*4;
    c.save();c.translate(x,y);c.scale(s,s);c.fillStyle='rgba(39,59,35,.22)';c.beginPath();c.ellipse(0,1,17,3,0,0,Math.PI*2);c.fill();
    c.fillStyle=n?'#9b8d66':'#987754';c.beginPath();c.ellipse(0,-16,15,7,0,0,Math.PI*2);c.fill();c.strokeStyle='#665d43';c.lineWidth=2;
    for(const xx of [-11,-5,6,11]){c.beginPath();c.moveTo(xx,-13);c.lineTo(xx+(xx%2?2:-1),0);c.stroke();}
    c.save();c.translate(12,-16);c.rotate(.2+Math.sin(t*.35+n)*.13);c.fillStyle='#a38b64';c.beginPath();c.moveTo(-3,2);c.lineTo(2,-17);c.lineTo(9,-21);c.lineTo(14,-17);c.lineTo(7,-13);c.lineTo(3,4);c.closePath();c.fill();c.beginPath();c.ellipse(8,-25,2,6,-.45,0,Math.PI*2);c.fill();c.fillStyle='#364c3d';c.beginPath();c.arc(10,-18,.8,0,Math.PI*2);c.fill();c.restore();c.restore();
   }
  }
 }
 function routeFeatures(j,ix){
  const camera=j*42,features=[];
  for(let k=Math.floor((camera-510)/1150);k<=Math.floor((camera-510)/1150)+2;k++){
   if(k<0)continue;const distance=380+k*1150-camera,type=k%4===2?'gateway':'bridge',z=36/Math.max(8,distance)-.025;
   if((type==='bridge'?distance+130:distance)>8&&z>0&&z<4.5)features.push({i:k,z,distance,structure:true,type});
  }return features;
 }
 function onRiver(z,j,ix){return routeFeatures(j,ix).some(f=>f.type==='bridge'&&z>=Math.max(0,36/(f.distance+130)-.025)&&z<=f.z);}
 function riverCrossing(c,P,w,h,j,ix,t){
  const f=routeFeatures(j,ix).find(f=>f.type==='bridge');if(!f)return;
  const near=Math.min(1.1,f.z),far=Math.max(0,36/(f.distance+130)-.025),yn=P.yy(near),yf=P.yy(far);
  c.save();c.beginPath();c.moveTo(0,yf);c.bezierCurveTo(w*.3,yf-h*.012,w*.65,yf+h*.01,w,yf);c.lineTo(w,yn);c.bezierCurveTo(w*.6,yn-h*.018,w*.25,yn+h*.015,0,yn);c.closePath();
  const water=c.createLinearGradient(0,yf,0,yn);water.addColorStop(0,ix===3?'#69b0b7':'#5b9392');water.addColorStop(1,'#397d85');c.fillStyle=water;c.fill();c.clip();
  for(let k=0;k<19;k++){const y=yf+(yn-yf)*(k+.5)/19;c.strokeStyle=k%2?'rgba(199,230,212,.36)':'rgba(31,91,104,.17)';c.lineWidth=.8+near;c.beginPath();for(let x=-20;x<=w+20;x+=20){const yy=y+Math.sin(x*.019+t*.7+k)*Math.max(1,(yn-yf)*.025);x===-20?c.moveTo(x,yy):c.lineTo(x,yy);}c.stroke();}c.restore();
 }
 function structure(c,P,w,h,f,ix){
  const {rx,hw,yy}=P;
  if(f.type==='bridge'){
   const from=Math.max(0,36/(f.distance+130)-.025),to=Math.min(1.15,f.z);
   for(const side of [-1,1]){
    // Edge masonry and railing posts use the same world-distance projection as the deck.
    c.strokeStyle=ix===2?'#7c6951':ix===4?'#698b89':'#b7baa4';c.lineWidth=Math.max(1,hw(to)*.027);c.beginPath();
    for(let k=0;k<=24;k++){const z=from+(to-from)*k/24;c.lineTo(rx(z)+side*hw(z)*1.12,yy(z)-h*.055*z);}c.stroke();
    c.strokeStyle=ix===2?'#544e3f':'#697c76';c.lineWidth=Math.max(1,hw(to)*.018);c.beginPath();
    for(let k=0;k<=24;k++){const z=from+(to-from)*k/24;c.lineTo(rx(z)+side*hw(z)*1.13,yy(z)-h*.025*z);}c.stroke();
    for(let k=0;k<=10;k++){const distance=f.distance+k*13,z=36/distance-.025;if(z<=0||z>1.15)continue;const x=rx(z)+side*hw(z)*1.12,y=yy(z);c.strokeStyle=ix===2?'#726448':'#899b8e';c.lineWidth=Math.max(1,hw(z)*.03);c.beginPath();c.moveTo(x,y+hw(z)*.035);c.lineTo(x,y-h*.06*z);c.stroke();}
   }
  }else{
   const z=f.z,x=rx(z),y=yy(z),width=hw(z)*1.35,height=Math.min(h*.33*z,width*1.65);
   // A road-sized stone arch has an actual opening. The shared road continues through it.
   c.save();c.translate(x,y);const outer=c.createLinearGradient(-width,-height,width,0);outer.addColorStop(0,'#c69a73');outer.addColorStop(.45,'#ad805b');outer.addColorStop(1,'#735b48');c.fillStyle=outer;
   c.beginPath();c.moveTo(-width,0);c.lineTo(-width,-height*.51);c.bezierCurveTo(-width,-height*1.22,width,-height*1.22,width,-height*.51);c.lineTo(width,0);c.closePath();
   c.moveTo(-width*.78,0);c.lineTo(width*.78,0);c.lineTo(width*.78,-height*.5);c.bezierCurveTo(width*.78,-height*.95,-width*.78,-height*.95,-width*.78,-height*.5);c.closePath();c.fill('evenodd');
   c.strokeStyle='rgba(76,59,43,.37)';c.lineWidth=Math.max(.6,z*2);
   for(let k=0;k<11;k++){const a=Math.PI+k/10*Math.PI;c.beginPath();c.moveTo(Math.cos(a)*width,-height*.5+Math.sin(a)*height*.55);c.lineTo(Math.cos(a)*width*.79,-height*.5+Math.sin(a)*height*.36);c.stroke();}
   for(const side of [-1,1])for(let k=0;k<5;k++){const yy=-k*height*.1;c.beginPath();c.moveTo(side*width*.8,yy);c.lineTo(side*width,yy);c.stroke();}
   c.fillStyle='rgba(35,44,32,.19)';for(const side of [-1,1]){c.beginPath();c.ellipse(side*width*.9,0,width*.16,Math.max(1,z*6),0,0,Math.PI*2);c.fill();}c.restore();
  }
 }
 function overlook(c,x,y,s,ix){
  c.save();c.translate(x,y);c.scale(s,s);
  const deck=c.createLinearGradient(0,-20,0,10);deck.addColorStop(0,'#bab598');deck.addColorStop(1,'#7e8b73');c.fillStyle=deck;c.beginPath();c.moveTo(-155,0);c.lineTo(-127,-27);c.lineTo(128,-27);c.lineTo(160,0);c.lineTo(148,9);c.lineTo(-145,9);c.closePath();c.fill();
  c.strokeStyle='#68786b';c.lineWidth=3;for(let k=0;k<9;k++){const xx=-126+k*31;c.beginPath();c.moveTo(xx,-24);c.lineTo(xx,-56);c.stroke();}c.beginPath();c.moveTo(-128,-55);c.lineTo(127,-55);c.moveTo(-128,-38);c.lineTo(127,-38);c.stroke();
  // A bench, binocular telescope and trail marker give the stop a purpose.
  c.fillStyle='#896b4a';c.fillRect(-87,-25,68,7);c.fillRect(-85,-42,63,8);c.fillRect(-80,-18,5,18);c.fillRect(-31,-18,5,18);
  c.strokeStyle='#718c8a';c.lineWidth=7;c.beginPath();c.moveTo(69,-20);c.lineTo(69,-53);c.stroke();c.lineWidth=12;c.beginPath();c.moveTo(60,-57);c.lineTo(87,-64);c.stroke();c.strokeStyle='#d5dcbb';c.lineWidth=2;c.stroke();
  c.fillStyle='#657d62';c.fillRect(-139,-94,48,32);c.fillStyle='#e5d9b0';c.font='bold 8px Georgia';c.textAlign='center';c.fillText('OVERLOOK',-115,-78);c.fillRect(-118,-64,5,40);c.restore();
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
 return {prop,mountains,car,carGround,car3d,landscape,verge,landmark,encounters,foundation,landmarkMotion,scenery,routeFeatures,riverCrossing,structure,overlook,onRiver,life,trainViaduct};
})();
