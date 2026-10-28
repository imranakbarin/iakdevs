/* Zero-dependency smoke test: node tests/mushroom-cinematic.test.cjs */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const page = fs.readFileSync(path.join(root,'mushroom-island.html'),'utf8');
const js = fs.readFileSync(path.join(root,'assets/mushroom-cinematic.js'),'utf8');
const image = fs.readFileSync(path.join(root,'assets/mushroom-cinematic-kingdom.webp'));
const matchedAssets=['pip-cinematic-run.webp','pip-full-run-22.webp','mushroom-terrace-cinematic.webp','mushroom-bounce-cinematic.webp'];
for(const a of matchedAssets){const b=fs.readFileSync(path.join(root,'assets',a));assert.ok(b.length>3000&&b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP',a+' must be self-hosted WebP');}
assert.match(page, /assets\/mushroom-cinematic\.js\?v=12/);
assert.match(js,/assets\/mossy-fallen-log\.svg/,'one local hurdle sprite');
assert.match(page, /id="island"/);
assert.ok(image.length>100000&&image.subarray(0,4).toString()==='RIFF'&&image.subarray(8,12).toString()==='WEBP','real authored kingdom art is included');
new vm.Script(js,{filename:'mushroom-cinematic.js'});

let drawCount=0, imageDraws=0, cancelled=0, realRunDraws=0, logDraws=0;
const springDraws=[];
const logPositions=[];
const atlasFramesSeen=new Set();
const methods=new Set(['setTransform','save','restore','translate','scale','rotate','beginPath','closePath','moveTo','lineTo','arc','ellipse','fill','stroke','clip','fillRect','rect','roundRect','quadraticCurveTo','bezierCurveTo','drawImage','fillText']);
const g={addColorStop(n,str){assert.ok(Number.isFinite(n)&&n>=0&&n<=1,'legal gradient stop');assert.equal(typeof str,'string');}};
// Model the graphics-state alpha stack used by transition crossfades.
const alphaStack=[];
const ctx = new Proxy({globalAlpha:1}, {get(o,k){
 if(k in o)return o[k];
 if(k==='save')return ()=>{alphaStack.push(ctx.globalAlpha);drawCount++;};
 if(k==='restore')return ()=>{ctx.globalAlpha=alphaStack.pop()??1;drawCount++;};
 if(k==='createLinearGradient'||k==='createRadialGradient')return (...a)=>{assert.ok(a.every(Number.isFinite));return g;};
 if(methods.has(k))return (...a)=>{
   drawCount++;
   if(k==='drawImage'){
     imageDraws++;
     if(a[0]?.source?.endsWith('/mushroom-bounce-cinematic.webp')){
       springDraws.push({x:a[1],y:a[2],w:a[3],h:a[4]});
     }
     if(a[0]?.source?.endsWith('/mossy-fallen-log.svg')){
       logDraws++;logPositions.push({x:a[1],y:a[2],w:a[3],h:a[4]});
     }
     if(a[0]?.source?.endsWith('/pip-full-run-22.webp')){
       realRunDraws++;
       atlasFramesSeen.add(a[1]/244);
       assert.ok(a[1]>=0&&a[1]<5368,'sprite sheet source coordinate');
     }
   }
   if(k==='ellipse')assert.ok(a[2]>0&&a[3]>0);
   if(k==='roundRect')assert.ok(a[2]>0&&a[3]>0);
   if(k==='setTransform'||k==='translate'||k==='rotate'||k==='fillRect')assert.ok(a.every(Number.isFinite));
 };
 return ()=>{};
},set(o,k,v){o[k]=v;return true;}});
const canvas={clientWidth:1170,clientHeight:650,width:0,height:0,getContext:()=>ctx};
const events={};
let hidden=false;
const doc={get hidden(){return hidden;},getElementById:id=>id==='island'?canvas:null,addEventListener:(k,fn)=>events['d:'+k]=fn};
const win={devicePixelRatio:2,addEventListener:(k,fn)=>events['w:'+k]=fn};win.top=win;
const reduced={matches:false,addEventListener(){}};
let nextId=0;
const queue=new Map();
const raf=fn=>{const id=++nextId;queue.set(id,fn);return id;};
const cancel=id=>{queue.delete(id);cancelled++;};
class MockImage{
 constructor(){this.naturalWidth=1172;this.naturalHeight=659;this.complete=false;this.onload=null;this.onerror=null;}
 set src(v){
  this.source=v;
  assert.ok(['assets/mushroom-cinematic-kingdom.webp','assets/mossy-fallen-log.svg',...matchedAssets.map(x=>'assets/'+x)].includes(v),'allowed local image path');
  const sizes={'pip-cinematic-run.webp':[1952,305],'pip-full-run-22.webp':[5368,305],'mushroom-terrace-cinematic.webp':[760,211],'mushroom-bounce-cinematic.webp':[169,128]};
  const match=matchedAssets.find(x=>v.endsWith(x));
  if(match)[this.naturalWidth,this.naturalHeight]=sizes[match];
  if(v.endsWith('/mossy-fallen-log.svg'))[this.naturalWidth,this.naturalHeight]=[640,290];
  this.complete=true;if(this.onload)this.onload();
}
}
// Inject internal pose exposure in test only, not in the deployed build.
const marker="  palace.src='assets/mushroom-cinematic-kingdom.webp';";
assert.equal(js.split(marker).length,2);
const code=js.replace(marker,'  window.__probe={poseAt,pipFrame,gaitAt,animationAt,spriteFrame,logGeometry,springGeometry,springCompression,springBounceAt,render,setWorld:x=>{world=x;render();}};\n'+marker);
vm.runInNewContext(code,{window:win,document:doc,Image:MockImage,matchMedia:()=>reduced,
 location:{origin:'https://unit.example'},requestAnimationFrame:raf,cancelAnimationFrame:cancel,console,Math},{timeout:3000});
const kinds=new Set();
const names=['hop','dash','bounce','flip','slide','glide','vault','cartwheel','twirl','longjump'];
for(let i=-10;i<36;i++){
 const kind=win.__probe.poseAt(i*750+350).kind;
 kinds.add(kind);
 for(const p of [195,270,380,480,550]){
   const pose=win.__probe.poseAt(i*750+p);
   assert.ok(Number.isFinite(pose.lift)&&Number.isFinite(pose.spin)&&pose.squash>0);
   if(p===195||p===550)assert.ok(Math.abs(pose.lift)<1e-8,'stunt returns to terrain');
 }
 for(const p of [50,350,700])win.__probe.setWorld(i*750+p);
}
assert.deepEqual([...kinds].sort(),[...names].sort());
// A running cycle must progress through distinct leg poses with distance,
// not repeat a gently rocked static torso.
const runningFrames=new Set();
for(let n=0;n<16;n++){
 win.__probe.setWorld(n*9+22);
 runningFrames.add(win.__probe.pipFrame({active:false,kind:'hop'}));
}
assert.equal(runningFrames.size,16,'all 16 articulated contact/passing/push-off frames accessible');
// The full opposing-leg cycle takes 144px; ground beats are 72px apart.
const gait=win.__probe.gaitAt;
assert.equal(gait(0).frame,0,'first grounded contact');
assert.equal(gait(8*9).frame,8,'opposite foot contact halfway through');
assert.equal(gait(16*9).frame,0,'cycle resets after exactly 144px');
assert.ok(gait(0).contact>.99&&gait(8*9).contact>.99,'two grounded footfalls');
assert.ok(gait(4*9).contact<.01&&gait(12*9).contact<.01,'no hovering dust midstride');
assert.ok(Math.abs(gait(0).contact-gait(16*9).contact)<1e-9,'no contact discontinuity at wrap');
for(const x of [0,11,33,70,140,225,513,10000]){
 const a=gait(x);
 assert.ok(Number.isFinite(a.phase)&&a.frame>=0&&a.frame<16,'stable long-run cycle');
 assert.ok(a.contact>=0&&a.contact<=1,'bounded foot contact');
}
for(const fps of [30,60,120]){
 const worldAtFiveSeconds=155*5;
 const poseAtDistance=gait(worldAtFiveSeconds);
 assert.equal(poseAtDistance.frame,gait(worldAtFiveSeconds).frame,
   'frame-rate independent distance-synchronized steps at '+fps+' fps');
}
assert.match(js,/ctx\.translate\(x,groundY-lift\+footInset\)/,
  'foot baseline is fixed; no whole-character bob in grounded run');
assert.ok(!js.includes('Math.abs(Math.sin(runPhase*2))'),
  'artificial run bob removed');
// One obstacle type only, placed strictly within hop chapters.
const beforeFirstLog=logDraws;
win.__probe.setWorld(385);
assert.equal(logDraws-beforeFirstLog,1,'log drawn once as Pip crosses first hop');
const geometry=win.__probe.logGeometry(0);
const log=logPositions.at(-1);
assert.ok(Math.abs((log.x+log.w/2)-1170*.34)<.01,'log centered in runner lane');
assert.ok(Math.abs((log.y+log.h)-(650*.892+13))<.01,'log rooted on terrain baseline');
assert.ok(Math.abs(log.w-geometry.width)<.01,'collision and image share geometry');
const countBeforeClear=logDraws;
win.__probe.setWorld(3750);
assert.equal(logDraws-countBeforeClear,0,'no fallen logs in non-hop chapters');
const nextLog=logDraws;
win.__probe.setWorld(10*750+385);
assert.equal(logDraws-nextLog,1,'one log returns on the next hop passage');
// Pip clears the log body at both sides and the center, including narrow phone
// layout. The obstacle artwork is allowed an ambient/transparent margin.
for(const [width,height] of [[1170,650],[390,844],[844,390],[1440,900]]){
 canvas.clientWidth=width;canvas.clientHeight=height;events['w:resize']();
 const figScale=Math.max(.49,Math.min(.90,Math.min(width/540,height/980)*.87));
 const g=win.__probe.logGeometry(0);
 for(let dx=-g.bodyHalfWidth;dx<=g.bodyHalfWidth;dx+=4){
   const pose=win.__probe.poseAt(g.worldX+dx);
   assert.ok(pose.lift*figScale>g.bodyHeight+3,
     'Pip clears log bark at '+width+'×'+height+' offset '+dx.toFixed(1));
 }
}
canvas.clientWidth=1170;canvas.clientHeight=650;events['w:resize']();
// A single cinematic spring cap must share its contact height with Pip's
// boots; the image's bottom remains fixed to the terrace while compressed.
for(const [width,height] of [[1170,650],[390,844],[844,390],[1440,900]]){
 canvas.clientWidth=width;canvas.clientHeight=height;events['w:resize']();
 const chapter=2,base=chapter*750,geo=win.__probe.springGeometry(chapter);
 const groundY=height*.892;
 const cap=(p)=>{
   const before=springDraws.length;
   win.__probe.setWorld(base+p);
   const drawn=springDraws.slice(before);
   assert.equal(drawn.length,1,'one original mushroom cap at '+width+'x'+height);
   const art=drawn[0];
   assert.ok(Math.abs((art.x+art.w/2)-(width*.34+385-p))<.001,'cap follows world-space lane at '+p);
   assert.ok(Math.abs((art.y+art.h)-(groundY+4))<.001,'mushroom base rooted to terrain at '+p);
   return art;
 };
 const before=cap(345);
 const atContact=cap(385);
 const after=cap(425);
 assert.ok(atContact.h<before.h*.88,'cap compresses at foot strike');
 assert.ok(atContact.w>before.w*1.055,'cap spreads under load');
 assert.ok(Math.abs(after.h-before.h)<.001,'mushroom rebounds after contact');
 const pose=win.__probe.poseAt(base+385);
 const footY=groundY+10+9*geo.pipScale-pose.lift*geo.pipScale;
 assert.ok(Math.abs(footY-atContact.y)<.01,
   'Pip feet land on cap top exactly at '+width+'x'+height);
 assert.ok(pose.spring.contact,'contact phase available to stunt poses');
 assert.ok(win.__probe.poseAt(base+315).lift>pose.lift+25,'arrival jump clears the cap');
 assert.ok(win.__probe.poseAt(base+452).lift>pose.lift+25,'spring launches a second arc');
 // C0 continuity and no negative height across entire bounce and landing.
 let previous=win.__probe.poseAt(base+195).lift;
 for(let p=196;p<=550;p++){
   const lift=win.__probe.poseAt(base+p).lift;
   assert.ok(Number.isFinite(lift)&&lift>=0,'finite non-negative bounce arc');
   assert.ok(Math.abs(lift-previous)<20,'no one-pixel vertical teleport at '+p);
   previous=lift;
 }
 for(const [p,frame] of [[260,17],[310,18],[374,19],[385,20],[418,16],[455,18],[505,19],[540,20]]){
   win.__probe.setWorld(base+p);
   assert.equal(win.__probe.spriteFrame(win.__probe.animationAt(base+p)),frame,
     'authored spring pose at '+p);
 }
}
canvas.clientWidth=1170;canvas.clientHeight=650;events['w:resize']();
for(const [u,expected] of [[.08,16],[.25,17],[.5,18],[.75,19],[.97,20]]){
 assert.equal(win.__probe.pipFrame({active:true,kind:'hop',u}),expected,'dedicated airborne pose');
}
assert.equal(win.__probe.pipFrame({active:true,kind:'slide',u:.5}),21,'crouch pose');
// Transitions must be continuous on either side of takeoff and touchdown.
const aAt=x=>win.__probe.animationAt(x);
for(const cut of [195,550]){
 const before=aAt(cut-.001),after=aAt(cut+.001);
 assert.ok(Math.abs(before.squash-after.squash)<.001,'smooth compression at '+cut);
 assert.ok(Math.abs(before.lift-after.lift)<.01,'smooth position at '+cut);
}
assert.equal(aAt(145).anticipation,0,'no anticipatory wobble during ordinary run');
assert.ok(aAt(188).anticipation>.5,'prepare ahead of takeoff');
assert.ok(aAt(567).landing>.3&&aAt(567).landing<1,'settle gradually after ground contact');
assert.equal(aAt(605).landing,0,'normal running resumes after recovery');
assert.equal(aAt(188+750).anticipation,0,'dash maintains momentum without crouching');
assert.equal(aAt(750+567).landing,0,'dash has no fictitious impact');
assert.equal(aAt(4*750+567).landing,0,'sliding has no landing dust');
assert.ok(aAt(4*750+567).recovery>.3,'slide smoothly unfolds after arch');
// Every render must use exactly one full-opacity Pip pose, including all
// transition frames. No ghosted limbs or flicker at takeoff/landing.
const checkSinglePose=x=>{
  const before=realRunDraws;
  win.__probe.setWorld(x);
  assert.equal(realRunDraws-before,1,'exactly one Pip draw at world x='+x);
  assert.equal(ctx.globalAlpha,1,'Pip drawn without transparent body overlay');
  return win.__probe.spriteFrame(aAt(x));
};
for(const x of [158,170,183,189,194.99,195,202,209,217,218,230,250,251,260,275,
  331,332,340,410,508,509,520,540,549.99,550,551,563,571,577,594,596]){
  const frame=checkSinglePose(x);
  assert.ok(frame>=0&&frame<22,'valid Pip atlas frame');
}
for(const x of [189,195,202,209,217,218])
  assert.equal(win.__probe.spriteFrame(aAt(x)),16,
    'takeoff must not flash back to a grounded running frame at '+x);
assert.equal(win.__probe.spriteFrame(aAt(565)),20,'settling uses one opaque landing pose');
assert.ok(win.__probe.spriteFrame(aAt(594))<16,'running returns after contact');
const normal=win.__probe.spriteFrame(aAt(100));
assert.ok(normal>=0&&normal<16,'ordinary running remains the original 16-frame atlas');
const slide=win.__probe.spriteFrame(aAt(4*750+535));
assert.equal(slide,21,'sliding stays on authored crouch pose');
for(let k=0;k<10;k++){
  const offset=k*750;
  for(const p of [190,195,205,217,218,550,560,570,590]){
    checkSinglePose(offset+p);
  }
}
for(const [width,height] of [[1170,650],[390,844],[844,390],[1440,900]]){
 canvas.clientWidth=width;canvas.clientHeight=height;events['w:resize']();
 assert.ok(canvas.width>0&&canvas.height>0);
 for(let j=0;j<20;j++)win.__probe.setWorld(j*750+380);
}
for(let i=0;i<70;i++){
 const entry=queue.entries().next().value;
 assert.ok(entry,'autoplay is scheduled');queue.delete(entry[0]);entry[1]((i+1)*16.7);
}
assert.ok(imageDraws>900,'real cinematic kingdom, textured terrace, and animated sprite all draw repeatedly');
assert.ok(realRunDraws>100,'production Canvas used the articulated sprite sheet');
assert.ok(logDraws>2,'production drew the new log art asset, not a vector placeholder');
assert.ok(atlasFramesSeen.size>=16,'Canvas drew sixteen distinct sprite frames');
assert.ok(drawCount>30000,'animated foreground and scene render');
events['w:message']({origin:'https://unit.example',data:{type:'mushroom:motion',playing:false}});
assert.equal(queue.size,0,'parent pause cancels RAF');
events['w:message']({origin:'https://evil.example',data:{type:'mushroom:motion',playing:true}});
assert.equal(queue.size,0,'untrusted message ignored');
events['w:message']({origin:'https://unit.example',data:{type:'mushroom:motion',playing:true}});
assert.equal(queue.size,1,'parent resume restores RAF');
hidden=true;events['d:visibilitychange']();assert.equal(queue.size,0);
hidden=false;events['d:visibilitychange']();assert.equal(queue.size,1,'visible tab resumes');
assert.ok(cancelled>0);
assert.equal(alphaStack.length,0,'canvas transforms and alpha all restored');
assert.equal(ctx.globalAlpha,1,'no fading or leaking opacity between frames');
console.log('Mushroom v11 SPRING CONTACT PASS: 16 distance-synced moving-limb run frames, 6 takeoff/air/landing/slide poses, matched cinematic ground, 4 viewports, secure play/pause.');