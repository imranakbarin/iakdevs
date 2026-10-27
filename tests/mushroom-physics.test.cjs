/* Deterministic physics regression: node tests/mushroom-physics.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'assets/mushroom-physics.js'),'utf8');
new vm.Script(src);
const sandbox={window:{}};
vm.runInNewContext(src,sandbox);
const engine=sandbox.window.MushroomPhysics;
assert.ok(engine&&typeof engine.create==='function');
assert.equal(engine.types.length,10);
const kinds=new Set(),objects=new Set();
for(let i=-10;i<40;i++){
 const f=engine.feature(i);
 assert.equal(f.index,i);
 assert.ok(Number.isFinite(f.x)&&f.width>0&&f.height>0);
 kinds.add(f.kind);objects.add(f.type);
 if(f.type==='ravine'){
   assert.ok(f.left<f.right);
   assert.ok(engine.isGap((f.left+f.right)/2));
   assert.ok(!engine.isGap(f.left-20));
 }
}
assert.equal(kinds.size,10,'all ten stunt types have chapter plans');
assert.ok(objects.size>=9,'varied hurdle families');
assert.ok(engine.range(0,2000).length>=2);
function simulate(fps,seconds){
 const physics=engine.create();
 const snapshots=[],steps=Math.round(seconds*fps);
 let lastX=0,maxLift=0,midair=0,slides=0;
 for(let n=0;n<steps;n++){
   const p=physics.update(1/fps);
   assert.ok(p.x>=lastX,'world progress never goes backward');
   assert.ok(p.lift>=0&&Number.isFinite(p.spin)&&p.squash>0&&Number.isFinite(p.vy));
   if(!p.onGround){midair++;maxLift=Math.max(maxLift,p.lift);}
   if(p.action==='slide'){slides++;assert.ok(p.squash<=1);}
   lastX=p.x;
   if(n%(fps*5|0)===0)snapshots.push([p.x,p.lift]);
 }
 return {final:physics.state(),snapshots,maxLift,midair,slides};
}
const sixty=simulate(60,240);
const thirty=simulate(30,240);
const high=simulate(144,240);
for(const item of [sixty,thirty,high]){
 const s=item.final.stats;
 assert.equal(s.collisions,0,'no hurdle collision during autoplay');
 assert.equal(s.falls,0,'no falls through real chasms');
 assert.ok(s.jumps>=35,'frequent physical jumps');
 assert.ok(s.landings>=35,'repeated successful landings');
 assert.ok(s.bounces>=3,'mushroom springs use physical collision');
 assert.ok(s.slides>=3&&s.dashes>=3,'duck and dash events');
 assert.ok(s.cleared>=40,'hurdles are cleared');
 assert.ok(item.midair>200&&item.maxLift>90,'vertical gravity and airtime observed');
 assert.ok(item.slides>10,'crouch animation is active');
}
assert.ok(Math.abs(sixty.final.x-thirty.final.x)<2,'30/60fps world position stable');
assert.ok(Math.abs(sixty.final.x-high.final.x)<2,'60/144fps world position stable');
for(const [a,b] of [[sixty,thirty],[sixty,high]]){
 assert.ok(Math.abs(a.final.stats.bounces-b.final.stats.bounces)<=1,'bounce counts stable');
 assert.ok(Math.abs(a.final.stats.jumps-b.final.stats.jumps)<=1,'jump counts stable');
}
const paused=engine.create();
assert.equal(paused.update(0).x,0);
assert.equal(paused.update(-.2).x,0);
assert.ok(paused.update(1/60).x>0);
paused.reset();assert.equal(paused.state().x,0);
console.log('Mushroom physics PASS: 10 stunt families, real 2D gravity, 3 frame rates, 240 sec autoplay per rate, spring contacts, clearance, gap safety, reset.');
