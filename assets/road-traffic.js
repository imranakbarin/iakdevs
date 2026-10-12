/* Sparse road-distance traffic. One update per simulation frame; rendering only reads snapshots. */
const RoadTraffic=(()=>{
 const heroOffset=36/(.88+.025),step=1/60;
 let randomSeed=(Math.random()*4294967296)>>>0,bag=[];
 const lengths={hatchback:3.6,sedan:4.3,suv:4.6,pickup:5.3,van:5.6,truck:8.8};
 const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
 function appearance(){if(!bag.length){bag=['hatchback','sedan','suv','pickup','van','truck'];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}const model=bag.pop(),colors=['#b66045','#d5c9a1','#5b8a83','#678294','#859464','#b89761','#8d7390'];return {model,length:lengths[model],pace:.61+random()*.15,col:colors[Math.floor(random()*colors.length)]};}
 let cars=[],clock=0,lastCamera=0,enabledBefore=null,nextLead=0,nextOncoming=18,id=0;
 let state='follow',transition=0,fromLane=.52,lane=.52,factor=1;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
 function reset(camera=0,seedValue=(Math.random()*4294967296)>>>0){randomSeed=seedValue>>>0;bag=[];cars=[];clock=0;lastCamera=camera;enabledBefore=null;nextLead=0;nextOncoming=18;state='follow';transition=0;fromLane=lane=.52;factor=1;}
 function enter(next){state=next;transition=0;fromLane=lane;}
 function crossingAhead(hero,end){
  for(let k=Math.max(0,Math.floor((hero-560)/1150));k<=Math.floor(end/1150)+1;k++){
   const start=380+k*1150;if(hero<start+180&&end>start-30)return true;
  }return false;
 }
 function tick(dt,camera,cruise,enabled){
  clock+=dt;transition+=dt;
  if(enabled!==enabledBefore){
   cars=[];nextLead=clock;nextOncoming=clock+18;enabledBefore=enabled;
   if(Math.abs(lane-.52)>.001)enter('inbound');else state='follow';
  }
  const hero=camera+heroOffset;
  if(enabled){
   if(clock>=nextLead&&!cars.some(c=>!c.front)){
    cars.push({id:++id,s:hero+240,v:cruise*.68,lane:.52,front:false,...appearance()});nextLead=clock+38;
   }
   if(clock>=nextOncoming&&!cars.some(c=>c.front)){
    cars.push({id:++id,s:camera+950,v:-cruise*.82,lane:-.52,front:true,...appearance()});nextOncoming=clock+25;
   }
  }
  for(const car of cars){car.v=car.front?-cruise*(.77+(car.pace-.61)*.6):cruise*car.pace;car.s+=car.v*dt;}
  cars=cars.filter(c=>c.s-camera>8);
  const lead=cars.find(c=>!c.front),gap=lead?lead.s-hero:Infinity;
  const relative=lead?Math.max(4,cruise-lead.v):4,passTime=(Math.max(0,gap)+22+(lead?.length||0))/relative+3.6;
  const arriving=cars.filter(c=>c.front).map(c=>(c.s-hero)/(cruise-Math.min(0,c.v)));
  // Include the next scheduled vehicle, so a pass cannot start just before it spawns.
  arriving.push(Math.max(0,nextOncoming-clock)+(950-heroOffset)/(cruise*1.9));
  const clear=arriving.every(t=>t>passTime+4)&&!crossingAhead(hero,hero+cruise*(passTime+3));
  if(state==='follow'&&enabled&&lead&&gap<=95&&gap>18&&clear)enter('outbound');
  if(state==='outbound'){
   lane=.52+(-.52-.52)*ease(transition/1.8);
   if(transition>=1.8){lane=-.52;enter('passing');}
  }else if(state==='passing'){
   lane=-.52;if(!lead||gap<-18-(lead?.length||0))enter('inbound');
  }else if(state==='inbound'){
   lane=fromLane+(.52-fromLane)*ease(transition/1.8);
   if(transition>=1.8){lane=.52;state='follow';}
  }else lane=.52;
  // Following changes the player's speed, never teleports or clamps the lead vehicle.
  const waiting=(state==='follow'||state==='inbound')&&lead&&gap>0;
  const target=state==='outbound'&&lead?clamp((lead.v+Math.max(0,(gap-18)/Math.max(.2,1.8-transition)))/cruise,.4,1):waiting?clamp((lead.v+Math.max(-10,(gap-45)*.8))/cruise,.4,1):1;
  factor+=(target-factor)*(1-Math.exp(-dt*3));
 }
 function advance(dt,camera,cruise,enabled){
  cruise=Math.max(8,cruise);
  if(camera<lastCamera-1)reset(camera);
  if(dt<=0){if(enabledBefore===null||enabled!==enabledBefore)tick(0,camera,cruise,enabled);lastCamera=camera;return snapshot(camera);}
  const count=Math.max(1,Math.round(dt/step)),delta=dt/count,start=lastCamera;
  for(let k=0;k<count;k++)tick(delta,start+(camera-start)*(k+1)/count,cruise,enabled);
  lastCamera=camera;return snapshot(camera);
 }
 function snapshot(camera){
  const visible=cars.map(c=>({...c,distance:c.s-camera,z:36/(c.s-camera)-.025})).filter(c=>c.distance>8&&c.z>0&&c.z<4.5);
  return {cars:visible,lane,pass:clamp((.52-lane)/1.04,0,1),state,factor,clock};
 }
 return {advance,snapshot,reset,get factor(){return factor;}};
})();
