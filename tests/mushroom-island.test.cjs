/* Run: node tests/mushroom-island.test.cjs (Node 18+, no dependencies). */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'mushroom-island.html'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const art=fs.readFileSync(path.join(root,'assets/mushroom-island-v2.js'),'utf8');
const match=page.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'standalone animation script found');
new vm.Script(match[1]);
new vm.Script(art);
assert.match(page,/assets\/mushroom-island-v2\.js\?v=1/,'diorama script loaded');
for(const m of index.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
assert.match(index,/<option value="mushroom">Mushroom Island<\/option>/);
assert.match(index,/requestedMushroom/);
assert.match(index,/mushroomMotion\(mushroom&&playing\)/);
assert.match(index,/mushroomFrame\.addEventListener\('load'/);
assert.match(index,/#mushroom-island/);

const gradients={addColorStop(t,fill){assert.ok(t>=0&&t<=1,'valid gradient stop');assert.equal(typeof fill,'string','gradient color required');assert.ok(fill.length>0);}};
let calls=0;
const ctx=new Proxy({},{
  get(target,key){
    if(key==='createLinearGradient'||key==='createRadialGradient')return (...args)=>{
      for(const n of args)assert.ok(Number.isFinite(n),'finite gradient coordinates');
      return gradients;
    };
    if(key==='ellipse')return (...args)=>{assert.ok(Number.isFinite(args[0])&&Number.isFinite(args[1]));assert.ok(args[2]>0&&args[3]>0);calls++;};
    if(key==='roundRect')return (...args)=>{assert.ok(args[2]>0&&args[3]>0);calls++;};
    return ()=>{calls++;};
  },
  set(target,key,value){target[key]=value;return true;}
});
const canvas={clientWidth:1170,clientHeight:650,width:0,height:0,getContext:()=>ctx};
const events={};
const doc={
  hidden:false,
  getElementById:id=>id==='island'?canvas:null,
  addEventListener:(key,fn)=>events['doc:'+key]=fn
};
const win={
  devicePixelRatio:2,
  addEventListener:(key,fn)=>events['win:'+key]=fn
};
let frameId=0;
const pending=new Map();
const requestAnimationFrame=fn=>{const id=++frameId;pending.set(id,fn);return id;};
const cancelAnimationFrame=id=>pending.delete(id);
const sandbox={
  window:win,document:doc,matchMedia:()=>({matches:false}),
  location:{origin:'https://test.example'},
  requestAnimationFrame,cancelAnimationFrame,Math,console
};
// Execute the authored 2.5D renderer as well as the original fallback.
vm.runInNewContext(art,sandbox,{timeout:2000});
assert.equal(win.MushroomIslandV2.version,'2.5d-diorama-v2');
// Expose the internal pure choreography ONLY within the test run.
const source=match[1].replace(
  '  resize();\n  setPlaying(!paused);',
  '  window.__probe={act,segment,ground,drawAt:x=>{distance=x;paint();}};\n  resize();\n  setPlaying(!paused);'
);
assert.notEqual(source,match[1],'test probe injected');
vm.runInNewContext(source,sandbox,{timeout:2000});
const kinds=new Set();
for(let i=-2;i<28;i++){
  kinds.add(win.__probe.segment(i).kind);
  for(const p of [190,380,570]){
    const pose=win.__probe.act(i*760+p);
    assert.ok(Number.isFinite(pose.lift));
    assert.ok(Number.isFinite(pose.spin));
    assert.ok(pose.squash>0);
    if(p===190||p===570)assert.ok(Math.abs(pose.lift)<1e-7,'grounded transition '+i);
  }
}
assert.equal(kinds.size,10,'all ten stunts occur');
// Sample complete diorama renders at every stunt type, not just a running frame.
for(let i=0;i<14;i++)for(const p of [0,190,270,380,500,570,750]){
  win.__probe.drawAt(i*760+p);
}
assert.ok(calls>1000,'v2 diorama scene actually rendered');
assert.ok(Math.abs(win.__probe.act(760+380).lift-132)<1e-6,'bounce reaches mushroom cap contact');
function tick(now){
  const next=pending.entries().next().value;
  assert.ok(next,'frame is scheduled');
  pending.delete(next[0]);next[1](now);
}
for(let i=0;i<90;i++)tick((i+1)*16.67);
assert.ok(calls>1000,'desktop canvas actually drew');
canvas.clientWidth=390;canvas.clientHeight=844;
events['win:resize']();
assert.ok(canvas.width>0&&canvas.height>0);
for(let i=0;i<30;i++)tick(2000+i*16.67);
events['win:message']({origin:'https://test.example',data:{type:'mushroom:motion',playing:false}});
assert.equal(pending.size,0,'pause cancels loop');
events['win:message']({origin:'https://bad.example',data:{type:'mushroom:motion',playing:true}});
assert.equal(pending.size,0,'cross-origin messages ignored');
events['win:message']({origin:'https://test.example',data:{type:'mushroom:motion',playing:true}});
assert.equal(pending.size,1,'resume schedules animation');
console.log('Mushroom Island v2 PASS: both scripts parse, all 10 stunts, 98 staged diorama renders, desktop + portrait animation, pause/resume, origin guard.');
