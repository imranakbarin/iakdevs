/* Shared, bounded fixed-step motion for every experience. No rendering dependency. */
const SceneMotion=(()=>{
 const step=1/60,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 let remainder=0,time=0,wind=0,windV=0,dirty=true,renderEMA=0,samples=0,slow=0,resolution=1;
 const lane={x:.52,v:0,target:.52};
 function spring(body,target,dt,frequency=3.5){
  // Exact critically damped spring: stable even when a frame arrives late.
  const offset=body.x-target,j=body.v+frequency*offset,e=Math.exp(-frequency*dt);
  body.x=target+(offset+j*dt)*e;body.v=(body.v-frequency*j*dt)*e;return body.x;
 }
 function advance(elapsed,active){
  if(!active){remainder=0;return 0;}
  remainder+=clamp(elapsed,0,.1);let delta=0;
  while(remainder+1e-9>=step){
   remainder-=step;delta+=step;time+=step;
   const target=.55*Math.sin(time*.19)+.27*Math.sin(time*.43+1.8)+.18*Math.sin(time*.077+2.1);
   const b={x:wind,v:windV};spring(b,target,step,1.1);wind=b.x;windV=b.v;
   spring(lane,lane.target,step,2.8);
  }
  return delta;
 }
 function particles(count,seed=31){
  let s=seed>>>0;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  const items=Array.from({length:count},(_,i)=>({x:random(),y:-.1-random()*.65,vx:0,vy:.018+random()*.018,angle:random()*6.28,spin:(random()-.5)*.9,size:.7+random()*.6,kind:i%4,ground:.77+random()*.2,rest:0,delay:i*1.1,alpha:1}));
  function reset(p){p.x=.1+random()*.84;p.y=-.07;p.vx=0;p.vy=.018+random()*.018;p.rest=0;p.delay=1+random()*4;p.ground=.77+random()*.2;}
  return {items,update(dt,breeze=wind){
   if(dt<=0)return;
   for(const p of items){
    if(p.delay>0){p.delay-=dt;continue;}
    if(p.y>=p.ground){p.rest+=dt;p.alpha=clamp(1-(p.rest-3)/3,0,1);if(p.rest>6)reset(p);continue;}
    p.vx+=(breeze*.014-p.vx)*Math.min(1,dt*1.8);
    p.vy+=(.065-p.vy)*Math.min(1,dt*.7);
    p.x+=p.vx*dt;p.y=Math.min(p.ground,p.y+p.vy*dt);
    p.angle+=(p.spin+breeze*.3)*dt;p.alpha=Math.min(1,(p.y+.07)*12);
   }
  }};
 }
 return {
  advance,spring,particles,lane,clamp,
  get time(){return time;},get wind(){return wind;},get resolution(){return resolution;},get renderMs(){return renderEMA;},
  invalidate(){dirty=true;},consumeDirty(){const d=dirty;dirty=false;return d;},
  resetLane(){lane.x=lane.target=.52;lane.v=0;},
  report(ms,budget=21){
   renderEMA=samples?renderEMA*.94+ms*.06:ms;samples++;
   // Only reduce resolution after sustained load, never from a single tile build.
   slow=ms>budget?slow+1:Math.max(0,slow-1);
   if(slow>75&&resolution>.85){resolution=Math.max(.85,resolution-.1);slow=0;dirty=true;return true;}
   return false;
  }
 };
})();
