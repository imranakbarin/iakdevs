/* Mushroom Island physics v6.
 * Deterministic fixed-step auto-run physics. No input required, no randomness in
 * dynamics, no scene asset dependencies. Obstacles and choreography share the
 * same world-space coordinates with the renderer.
 */
(function(root){
  'use strict';
  const TAU=Math.PI*2, STEP=1/120, CHAPTER=750, SPEED=155, GRAVITY=760;
  const types=['hop','dash','bounce','flip','slide','glide','vault','cartwheel','twirl','longjump'];
  const plans={
    hop:{type:'fallen-log',at:365,width:70,height:33,trigger:195,impulse:565},
    dash:{type:'speed-gate',at:392,width:144,height:95,trigger:210,impulse:0},
    bounce:{type:'spring-mushroom',at:380,width:76,height:85,trigger:222,impulse:440},
    flip:{type:'mossy-stump',at:398,width:64,height:52,trigger:195,impulse:665},
    slide:{type:'low-arch',at:390,width:162,height:92,trigger:205,impulse:0},
    glide:{type:'wind-arch',at:423,width:116,height:108,trigger:205,impulse:590},
    vault:{type:'round-boulder',at:389,width:68,height:65,trigger:207,impulse:655},
    cartwheel:{type:'stepping-stones',at:396,width:82,height:47,trigger:194,impulse:655},
    twirl:{type:'lantern-flower',at:384,width:60,height:51,trigger:204,impulse:650},
    longjump:{type:'ravine',at:422,width:150,height:160,trigger:200,impulse:748,left:345,right:495}
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  function chapterAt(x){return Math.floor(x/CHAPTER);}
  function kindAt(index){return types[((index%types.length)+types.length)%types.length];}
  function feature(index){
    const kind=kindAt(index),o=plans[kind],start=index*CHAPTER;
    return {index,kind,type:o.type,x:start+o.at,width:o.width,height:o.height,
      left:o.left===undefined?null:start+o.left,
      right:o.right===undefined?null:start+o.right};
  }
  function range(a,b){
    const result=[];
    for(let i=chapterAt(a)-1;i<=chapterAt(b)+1;i++){
      const item=feature(i);
      if(item.x+item.width*.5>=a-100&&item.x-item.width*.5<=b+100)result.push(item);
    }
    return result;
  }
  function isGap(x){
    const i=chapterAt(x),kind=kindAt(i);
    if(kind!=='longjump')return false;
    const p=x-i*CHAPTER;
    return p>=plans.longjump.left&&p<=plans.longjump.right;
  }
  function create(){
    let x=0,y=0,vy=0,onGround=true,elapsed=0,landPulse=0,active='run';
    let startAt=0,spin=0,angleStart=0,actionIndex=-Infinity,steps=0;
    let lastEvent=null,acc=0,clearedIndex=-Infinity,hitIndex=-Infinity;
    const stats={jumps:0,landings:0,bounces:0,slides:0,dashes:0,cleared:0,collisions:0,falls:0};
    const events=[];
    function emit(type,index){lastEvent={type,index,x};events.push(lastEvent);if(events.length>20)events.shift();}
    function jump(kind,impulse,i){
      active=kind;actionIndex=i;startAt=x;elapsed=0;angleStart=0;
      vy=-impulse;y=Math.min(y,-.001);onGround=false;
      stats.jumps++;emit('takeoff',i);
    }
    function beginAction(i){
      const kind=kindAt(i),conf=plans[kind];
      actionIndex=i;active=kind;startAt=x;elapsed=0;
      if(conf.impulse)jump(kind,conf.impulse,i);
      else{
        if(kind==='dash')stats.dashes++;
        if(kind==='slide')stats.slides++;
        emit(kind,i);
      }
    }
    function step(){
      const previousX=x,previousY=y;
      const ci=chapterAt(x),local=x-ci*CHAPTER;
      // Dash adds a brief satisfying horizontal burst without changing
      // obstacle placement or detaching the runner from the physical ground.
      const dash=active==='dash'&&ci===actionIndex
        ?1+.28*Math.sin(Math.PI*clamp((local-215)/340,0,1))**2 : 1;
      x+=SPEED*STEP*dash;
      steps++;elapsed+=STEP;landPulse=Math.max(0,landPulse-STEP*5.3);
      const nextI=chapterAt(x),before=previousX-nextI*CHAPTER,after=x-nextI*CHAPTER;
      const plan=plans[kindAt(nextI)];
      if(actionIndex!==nextI&&before<plan.trigger&&after>=plan.trigger&&onGround){
        beginAction(nextI);
      }
      const glide=active==='glide'&&vy>0;
      const gravity=glide?330:GRAVITY;
      if(!onGround){
        const oldVy=vy;
        vy+=gravity*STEP;
        y+=oldVy*STEP+.5*gravity*STEP*STEP;
        if(active==='bounce'){
          const idx=actionIndex,pad=feature(idx);
          if(x>=pad.x-pad.width*.52&&x<=pad.x+pad.width*.52 &&
             oldVy>=0&&previousY<=-pad.height&&y>=-pad.height){
            y=-pad.height;vy=-680;elapsed=0;stats.bounces++;emit('spring',idx);
          }
        }
        if(y>=0){
          if(isGap(x)){
            // The automatic stunt should always clear the ravine. Record the
            // failure so a regression test detects any unsafe timing.
            stats.falls++;
          }else{
            y=0;vy=0;onGround=true;landPulse=1;stats.landings++;
            emit('landing',actionIndex);
          }
        }
      }
      // If a previous airborne action landed, recover to a natural run after
      // the landing compression instead of abruptly changing frame.
      if(onGround&&active!=='run'){
        const origin=actionIndex*CHAPTER;
        const finish=x-origin;
        if(finish>560&&active!=='slide'&&active!=='dash')active='run';
        if((active==='slide'||active==='dash')&&finish>585)active='run';
      }
      // A scripted autonomous runner never strikes a collision obstacle.
      // Only the center overlap is checked; the cap's surface is a spring.
      const terrain=feature(chapterAt(x));
      const solid=['fallen-log','mossy-stump','round-boulder','stepping-stones','lantern-flower'].includes(terrain.type);
      const overlap=Math.abs(x-terrain.x)<terrain.width*.30;
      if(solid&&overlap&&y>-(terrain.height+13)&&hitIndex!==terrain.index){
        hitIndex=terrain.index;stats.collisions++;emit('collision',terrain.index);
      }
      // Register only one clear per obstacle: real space and fixed-step time.
      const clearX=terrain.x+terrain.width*.40;
      if(terrain.index!==clearedIndex&&previousX<clearX&&x>=clearX){
        clearedIndex=terrain.index;stats.cleared++;emit('cleared',terrain.index);
      }
    }
    function update(dt){
      if(!Number.isFinite(dt)||dt<=0)return snapshot();
      acc+=Math.min(dt,.1);
      // Keep a bounded fixed-step accumulator; not dependent on frame-rate.
      let runs=0;
      while(acc>=STEP&&runs<16){step();acc-=STEP;runs++;}
      return snapshot();
    }
    function snapshot(){
      const ci=chapterAt(x),kind=active==='run'?kindAt(ci):active;
      const local=x-ci*CHAPTER,p=clamp((local-195)/365,0,1);
      const stepPhase=x/19;
      const rotational=['flip','twirl','cartwheel'].includes(active);
      const spin=rotational&&!onGround?TAU*smooth(Math.min(1,elapsed/Math.max(.2,2*plans[active].impulse/GRAVITY)))*(active==='cartwheel'?-1:1):0;
      const slid=active==='slide'?Math.sin(Math.PI*clamp((local-245)/260,0,1))**2:0;
      const lean=(active==='dash'?.21:active==='longjump'?.12:active==='vault'?.10:0)*Math.sin(Math.PI*p);
      const squash=Math.max(.49,1-.48*slid-.20*landPulse);
      return {x,kind,action:active,active:active!=='run',chapter:ci,
        lift:Math.max(0,-y),height:y,vy,onGround,
        spin,lean,squash,glide:active==='glide'&&!onGround,landing:landPulse,
        cadence:stepPhase,obstacle:feature(ci),event:lastEvent};
    }
    function state(){return {x,y,vy,onGround,action:active,steps,stats:{...stats},lastEvent,events:[...events]};}
    function reset(){x=0;y=0;vy=0;onGround=true;elapsed=0;landPulse=0;active='run';actionIndex=-Infinity;acc=0;steps=0;lastEvent=null;clearedIndex=-Infinity;hitIndex=-Infinity;events.length=0;for(const k in stats)stats[k]=0;}
    return {update,snapshot,state,reset};
  }
  root.MushroomPhysics={create,feature,range,isGap,kindAt,CHAPTER,SPEED,GRAVITY,STEP,types};
})(window);
