/* Authored paintings, with bounded motion drawn in the artwork's own coordinates. */
const LivingArt=(()=>{
 const collection={
  gond:{name:'Gond',country:'India',title:'The forest remembers',medium:'Pattern, rhythm & interconnected life',file:'art-gond-living.webp',color:'#284f44',chapters:['The deer grove','Tree of life','The river sings'],water:[.86,.97]},
  warli:{name:'Warli',country:'India',title:'A village in rhythm',medium:'Cream linework on earthen plaster',file:'art-warli-living.webp',color:'#9b503c',chapters:['Fields at daybreak','The tarpa circle','Homeward paths']},
  madhubani:{name:'Madhubani',country:'India',title:'Lotus, feather & fish',medium:'Double contours & intricate ornament',file:'art-madhubani-living.webp',color:'#8c463b',chapters:['The lotus pond','Peacocks in conversation','Branches of abundance'],water:[.8,.95]},
  kangra:{name:'Kangra',country:'India',title:'An afternoon in the garden',medium:'Miniature-inspired mineral colours',file:'art-kangra-living.webp',color:'#5b7254',chapters:['The shaded pavilion','A lotus afternoon','Paths through the garden'],water:[.79,.94]},
  japan:{name:'Woodblock',country:'Japan',title:'Along the quiet river',medium:'Carved contours, pigment & washi',file:'art-japan-living.webp',color:'#345961',chapters:['The riverside village','Mountain & pine','The vermilion bridge'],water:[.77,.96]},
  china:{name:'Ink landscape',country:'China',title:'Mountains beyond the mist',medium:'An unfolding ink-inspired handscroll',file:'chinese-ink-panorama.webp',color:'#5d6b5e',chapters:['The waterfall valley','Between mountain and mist','The scholar’s pavilion'],water:[.83,.98]},
  mexico:{name:'Amate inspired',country:'Mexico',title:'Under the flowering tree',medium:'Bark-paper texture & painted folk motifs',file:'mexican-amate-panorama.webp',color:'#a46b38',chapters:['Deer among the agave','The flowering canopy','The riverside town']}
 };
 const images=new Map(),patches=new Map();const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 let view=reduced?'still':'journey',detail=!reduced,lastKey='',previous=null,fade=1,frame=null;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
 function image(key){
  if(images.has(key))return images.get(key);
  const im=new Image();im.onload=()=>{if(typeof wakeScene==='function')wakeScene();};im.onerror=()=>{im.failed=true;if(typeof wakeScene==='function')wakeScene();};im.src='assets/'+collection[key].file;images.set(key,im);return im;
 }
 function dot(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
 function leaf(c,x,y,size,angle,color){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.moveTo(-size,0);c.bezierCurveTo(-size*.25,-size*.55,size*.7,-size*.6,size,0);c.bezierCurveTo(size*.45,size*.5,-size*.2,size*.6,-size,0);c.fill();c.restore();}
 function butterfly(c,x,y,s,t,key){
  c.save();c.translate(x,y);c.rotate(Math.sin(t*.6)*.15);c.scale(s,s);c.scale(.18+.82*Math.abs(Math.sin(t*3.5)),1);
  for(const side of [-1,1]){c.fillStyle=key==='mexico'?'#d48a39':'#d4c3a0';c.strokeStyle='#423e31';c.lineWidth=.7;c.beginPath();c.ellipse(side*7,-3,7,10,side*.35,0,Math.PI*2);c.fill();c.stroke();dot(c,side*9,-4,2,'#413a2b');}c.restore();
 }
 function bird(c,x,y,s,t,key){
  c.save();c.translate(x,y);c.scale(s,s);
  if(key==='gond'){
   c.strokeStyle='#251e20';c.lineWidth=1.2;c.fillStyle='#26867f';c.beginPath();c.ellipse(0,0,15,7,-.12,0,Math.PI*2);c.fill();c.stroke();
   c.fillStyle='#bb593e';c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-14,-24*Math.sin(t*2.6)-10,-22,-6);c.quadraticCurveTo(-7,3,0,0);c.fill();c.stroke();
   for(let i=0;i<7;i++)dot(c,-8+i*3,-1,1,'#e9ce7b');dot(c,12,-5,5,'#d89b44');dot(c,14,-6,1.2,'#241c20');c.beginPath();c.moveTo(16,-5);c.lineTo(23,-4);c.lineTo(17,-2);c.fill();
  }else{c.strokeStyle=key==='warli'?'#f0dfbb':key==='china'?'#4f5c52':'#2e494c';c.lineWidth=1.4;c.lineCap='round';c.beginPath();const wing=5+Math.sin(t*2.2)*5;c.moveTo(-13,-wing);c.quadraticCurveTo(-6,-wing-3,0,0);c.quadraticCurveTo(6,-wing-3,13,-wing);c.stroke();}
  c.restore();
 }
 // A feathered canopy patch is sampled once, then gently sheared around its lower anchor.
 // The unmodified painting remains beneath it; motion is tiny and settles at the boundary.
 function canopy(c,key,im,P,t){
  const regions={
   gond:[[.01,.04,.24,.43],[.39,.03,.22,.40],[.72,.04,.24,.43]],
   madhubani:[[.02,.03,.20,.40],[.39,.03,.20,.30],[.77,.03,.20,.43]],
   kangra:[[.14,.12,.14,.34],[.38,.34,.22,.22],[.76,.20,.18,.37]],
   japan:[[.05,.06,.15,.35],[.36,.26,.15,.36],[.78,.01,.21,.42]],
   china:[[.10,.20,.20,.38],[.39,.25,.17,.38],[.76,.17,.14,.38]],
   mexico:[[.01,.02,.23,.37],[.34,.02,.30,.42],[.76,.01,.23,.39]]
  };
  const list=regions[key];if(!list)return;
  const center=(P.viewport*.5-P.x)/P.width,index=Math.min(2,Math.floor(center*3)),r=list[index],cacheKey=key+':'+index;
  let tile=patches.get(cacheKey);
  if(!tile){tile=document.createElement('canvas');tile.width=384;tile.height=Math.max(64,Math.round(384*r[3]*im.naturalHeight/(r[2]*im.naturalWidth)));const g=tile.getContext('2d');g.drawImage(im,im.naturalWidth*r[0],im.naturalHeight*r[1],im.naturalWidth*r[2],im.naturalHeight*r[3],0,0,tile.width,tile.height);g.globalCompositeOperation='destination-in';const mask=g.createLinearGradient(0,0,0,tile.height);mask.addColorStop(0,'transparent');mask.addColorStop(.15,'#000');mask.addColorStop(.75,'#000');mask.addColorStop(1,'transparent');g.fillStyle=mask;g.fillRect(0,0,tile.width,tile.height);const edge=g.createLinearGradient(0,0,tile.width,0);edge.addColorStop(0,'transparent');edge.addColorStop(.2,'#000');edge.addColorStop(.8,'#000');edge.addColorStop(1,'transparent');g.fillStyle=edge;g.fillRect(0,0,tile.width,tile.height);patches.set(cacheKey,tile);}
  const x=P.x+r[0]*P.width,y=P.y+r[1]*P.height,w=r[2]*P.width,h=r[3]*P.height;if(x>w+P.viewport||x+w<0)return;
  c.save();c.translate(x+w*.5,y+h);c.transform(1,0,(Math.sin(t*.7)*.002+SceneMotion.wind*.003),1,0,0);c.drawImage(tile,-w*.5,-h,w,h);c.restore();
 }
 function motion(c,key,im,P,t,seed){
  const info=collection[key],scale=P.height/640,water=info.water;
  if(water){
   const bounds={gond:[[.60,.80],[1,.80],[1,.97],[.55,.97]],madhubani:[[0,.78],[.33,.78],[.33,.96],[0,.96]],kangra:[[.43,.79],[.65,.79],[.67,.94],[.41,.94]],japan:[[0,.86],[1,.86],[1,1],[0,1]],china:[[.70,.83],[1,.83],[1,.94],[.70,.94]]};
   c.save();c.beginPath();bounds[key].forEach(([x,y],i)=>i?c.lineTo(P.x+x*P.width,P.y+y*P.height):c.moveTo(P.x+x*P.width,P.y+y*P.height));c.closePath();c.clip();
   const top=water[0]*im.naturalHeight,bottom=water[1]*im.naturalHeight;
   for(let i=0;i<24;i++){const sy=top+(bottom-top)*i/24,sh=(bottom-top)/24+.6,depth=i/24,dx=Math.sin(t*.65+i*.71)*scale*(.4+depth*1.3);c.drawImage(im,0,sy,im.naturalWidth,sh,P.x+dx,P.y+sy/im.naturalHeight*P.height,P.width,sh/im.naturalHeight*P.height);}c.restore();
  }
  canopy(c,key,im,P,t);
  if(key==='china'){
   c.save();c.strokeStyle='rgba(249,245,229,.26)';c.lineWidth=scale*.7;c.lineCap='round';
   for(let i=0;i<14;i++){const v=(t*.23+i/14)%1,x=P.x+P.width*(.319+(i%3)*.003)+Math.sin(v*3)*scale*2,y=P.y+P.height*(.31+v*.28);c.globalAlpha=Math.sin(v*Math.PI)*.65;c.beginPath();c.moveTo(x,y);c.lineTo(x+scale*.6,y+5*scale);c.stroke();}c.restore();
  }
  if(key==='china'||key==='japan'||key==='kangra'){
   c.save();const y=P.y+P.height*(key==='china'?.70:.78),g=c.createLinearGradient(0,y-25*scale,0,y+30*scale);g.addColorStop(0,'rgba(238,233,216,0)');g.addColorStop(.5,'rgba(238,233,216,.12)');g.addColorStop(1,'rgba(238,233,216,0)');c.fillStyle=g;c.translate(Math.sin(t*.08)*15*scale,0);c.fillRect(0,y-25*scale,P.viewport,55*scale);c.restore();
  }
  // Sparse actions belong to their tradition; there is no shared decorative foreground.
  if(key==='china'||key==='japan'||key==='gond'||key==='warli')for(let i=0;i<(key==='gond'?1:3);i++){
   const phase=((t*(key==='gond'?.004:.002)+i*.065+(seed%97)/97) %1),u=.12+phase*.75;
   const x=key==='warli'?P.viewport*(.25+i*.23)+Math.sin(t*.17+i)*12*scale:P.x+P.width*u,y=P.y+P.height*(.18+i*.025)+Math.sin(t*.23+i)*5*scale;if(x<-40||x>P.viewport+40)continue;bird(c,x,y,scale*(key==='gond'?1:.48+i*.10),t+i,key);
  }
  if(key==='mexico'||key==='kangra')for(let i=0;i<3;i++){
   const x=P.viewport*(.2+i*.28)+Math.sin(t*.17+i)*20*scale,y=P.y+P.height*(.44+i*.07)+Math.sin(t*.39+i)*12*scale;butterfly(c,x,y,scale*.65,t+i,key);
  }
  if(key==='japan'||key==='kangra')for(let i=0;i<9;i++){
   const phase=(t*.023+i*.117)%1,u=.48+Math.sin(i*31+seed)*.25,x=P.x+P.width*u+Math.sin(t*.32+i)*8*scale,y=P.y+P.height*(.25+phase*.67);if(x<-20||x>P.viewport+20)continue;c.globalAlpha=Math.sin(phase*Math.PI)*.65;leaf(c,x,y,scale*(2+i%3),t*.5+i,key==='japan'?'#c7877d':'#bba276');c.globalAlpha=1;
  }
  if(key==='warli')dance(c,P,t,scale);
  if(key==='madhubani'){
   c.save();c.translate(P.x+P.width*.43,P.y+P.height*.85);c.strokeStyle='#283e34';c.lineWidth=scale*.7;for(let i=0;i<3;i++){const r=scale*(7+i*9+(t*2)%9);c.globalAlpha=(1-i/3)*.25;c.beginPath();c.ellipse(0,0,r,r*.16,0,0,Math.PI*2);c.stroke();}c.restore();
  }
 }
 function dance(c,P,t,s){
  // A small second ring of dancers, with joined hands and feet planted on an oval.
  const x=P.x+P.width*.50,y=P.y+P.height*.77;if(x<-130*s||x>P.viewport+130*s)return;
  c.save();c.translate(x,y);c.strokeStyle='#f0dfbb';c.fillStyle='#f0dfbb';c.lineWidth=s*.85;c.lineCap='round';
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,cx=Math.cos(a)*78*s,cy=Math.sin(a)*21*s,lean=Math.sin(t*1.3+i*.4)*2*s;c.save();c.translate(cx,cy);dot(c,lean,-19*s,2.5*s,'#f0dfbb');c.beginPath();c.moveTo(lean,-15*s);c.lineTo(-5*s,-8*s);c.lineTo(5*s,-8*s);c.closePath();c.fill();c.beginPath();c.moveTo(0,-8*s);c.lineTo(-5*s,-2*s);c.lineTo(5*s,-2*s);c.closePath();c.fill();c.beginPath();c.moveTo(-4*s,-1*s);c.lineTo(-6*s,3*s);c.moveTo(4*s,-1*s);c.lineTo(6*s,3*s);c.moveTo(-4*s,-12*s);c.lineTo(-10*s,-9*s+lean*.2);c.moveTo(4*s,-12*s);c.lineTo(10*s,-9*s-lean*.2);c.stroke();c.restore();}c.restore();
 }
 function draw(c,key,w,h,position,t,dt,seed){
  if(!collection[key])return false;const im=image(key);if(!im.complete||!im.naturalWidth)return false;
  if(lastKey!==key){if(frame&&frame.width===w&&frame.height===h){previous=document.createElement('canvas');previous.width=w;previous.height=h;previous.getContext('2d').drawImage(frame,0,0);}lastKey=key;fade=previous&&dt>0&&!reduced&&(view==='journey'||detail)?0:1;}
  fade=Math.min(1,fade+dt/1.8);
  const height=h*(w/h<.85?1.01:1.04),width=height*im.naturalWidth/im.naturalHeight;
  const phase=.5+.46*Math.sin(position*.0008+(seed%13-6)*.03),x=(w-width)*phase,y=(h-height)*.5;
  const P={x,y,width,height,viewport:w};c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.clearRect(0,0,w,h);c.drawImage(im,x,y,width,height);
  if(detail)motion(c,key,im,P,t,seed);
  if(previous&&fade<1){c.globalAlpha=1-smooth(fade);c.drawImage(previous,0,0);c.globalAlpha=1;}else previous=null;
  c.restore();
  if(!frame||frame.width!==w||frame.height!==h){frame=document.createElement('canvas');frame.width=w;frame.height=h;}frame.getContext('2d').drawImage(c.canvas,0,0);
  const note=document.getElementById('art-caption');if(note){const chapter=collection[key].chapters[Math.min(2,Math.floor(phase*3))];const title=document.getElementById('art-title'),label=document.getElementById('art-medium');if(title.textContent!==collection[key].title)title.textContent=collection[key].title;const text=collection[key].country+' · '+collection[key].name+' / '+chapter;if(label.textContent!==text)label.textContent=text;}
  return true;
 }
 function setup(){
  const modal=document.getElementById('art-gallery'),grid=document.getElementById('art-grid'),open=document.getElementById('art-browse'),close=document.getElementById('art-close');if(!modal)return;
  for(const [key,info]of Object.entries(collection)){
   const button=document.createElement('button');button.className='art-card';button.type='button';button.dataset.art=key;
   const img=document.createElement('img');img.src='assets/'+info.file;img.alt='';img.loading='lazy';img.decoding='async';
   const title=document.createElement('strong');title.textContent=info.country+' · '+info.name;const subtitle=document.createElement('span');subtitle.textContent=info.medium;button.append(img,title,subtitle);
   button.onclick=()=>{document.getElementById('sty').value=key;setSeed(seed,key);closeGallery();wakeScene();};grid.append(button);
  }
  function closeGallery(){modal.close();open.focus();}
  open.onclick=()=>{for(const b of grid.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.art===document.getElementById('sty').value));modal.showModal();close.focus();};close.onclick=closeGallery;
  modal.addEventListener('click',e=>{if(e.target===modal)closeGallery();});modal.addEventListener('cancel',()=>open.focus());
  const travel=document.getElementById('art-travel');travel.textContent=view==='journey'?'Journey':'Contemplate';travel.setAttribute('aria-pressed',String(view==='still'));travel.onclick=()=>{view=view==='journey'?'still':'journey';if(view==='still'&&typeof vel!=='undefined')vel=0;travel.textContent=view==='journey'?'Journey':'Contemplate';travel.setAttribute('aria-pressed',String(view==='still'));wakeScene();};
  const movement=document.getElementById('art-motion');movement.textContent=detail?'Living details on':'Living details off';movement.setAttribute('aria-pressed',String(detail));movement.onclick=()=>{detail=!detail;movement.textContent=detail?'Living details on':'Living details off';movement.setAttribute('aria-pressed',String(detail));wakeScene();};
 }
 function mode(active){document.body.classList.toggle('art-mode',active);for(const id of ['art-caption','art-browse','art-travel','art-motion']){const e=document.getElementById(id);if(e)e.hidden=!active;}}
 return {draw,setup,mode,collection,get view(){return view;},get detail(){return detail;}};
})();
