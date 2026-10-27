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
assert.match(page, /assets\/mushroom-cinematic\.js\?v=7/);
assert.match(page, /id="island"/);
assert.ok(image.length>100000&&image.subarray(0,4).toString()==='RIFF'&&image.subarray(8,12).toString()==='WEBP','real authored kingdom art is included');
new vm.Script(js,{filename:'mushroom-cinematic.js'});

let drawCount=0, imageDraws=0, cancelled=0, realRunDraws=0;
const atlasFramesSeen=new Set();
const methods=new Set(['setTransform','save','restore','translate','scale','rotate','beginPath','closePath','moveTo','lineTo','arc','ellipse','fill','stroke','clip','fillRect','rect','roundRect','quadraticCurveTo','bezierCurveTo','drawImage','fillText']);
const g={addColorStop(n,str){assert.ok(Number.isFinite(n)&&n>=0&&n<=1,'legal gradient stop');assert.equal(typeof str,'string');}};
const ctx = new Proxy({}, {get(o,k){
 if(k in o)return o[k];
 if(k==='createLinearGradient'||k==='createRadialGradient')return (...a)=>{assert.ok(a.every(Number.isFinite));return g;};
 if(methods.has(k))return (...a)=>{
   drawCount++;
   if(k==='drawImage'){
     imageDraws++;
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
  assert.ok(['assets/mushroom-cinematic-kingdom.webp',...matchedAssets.map(x=>'assets/'+x)].includes(v),'allowed local image path');
  const sizes={'pip-cinematic-run.webp':[1952,305],'pip-full-run-22.webp':[5368,305],'mushroom-terrace-cinematic.webp':[760,211],'mushroom-bounce-cinematic.webp':[169,128]};
  const match=matchedAssets.find(x=>v.endsWith(x));
  if(match)[this.naturalWidth,this.naturalHeight]=sizes[match];
  this.complete=true;if(this.onload)this.onload();
}
}
// Inject internal pose exposure in test only, not in the deployed build.
const marker="  palace.src='assets/mushroom-cinematic-kingdom.webp';";
assert.equal(js.split(marker).length,2);
const code=js.replace(marker,'  window.__probe={poseAt,pipFrame,render,setWorld:x=>{world=x;render();}};\n'+marker);
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
 win.__probe.setWorld(n*12+22);
 runningFrames.add(win.__probe.pipFrame({active:false,kind:'hop'}));
}
assert.equal(runningFrames.size,16,'all 16 articulated contact/passing/push-off frames accessible');
for(const [u,expected] of [[.08,16],[.25,17],[.5,18],[.75,19],[.97,20]]){
 assert.equal(win.__probe.pipFrame({active:true,kind:'hop',u}),expected,'dedicated airborne pose');
}
assert.equal(win.__probe.pipFrame({active:true,kind:'slide',u:.5}),21,'crouch pose');
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
console.log('Mushroom v7 RUN PASS: 16 distance-synced moving-limb run frames, 6 takeoff/air/landing/slide poses, matched cinematic ground, 4 viewports, secure play/pause.');