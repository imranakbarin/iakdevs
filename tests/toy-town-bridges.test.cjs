'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'../assets/toy-town-3d.js'),'utf8');
const profile=s.slice(s.indexOf('  const ARCH='),s.indexOf('  function bridgeAt('));
const contacts=s.slice(s.indexOf('  function archHeight('),s.indexOf('  // Raised pavements'));
const ctx={LINES:[1,6,11,16]};vm.createContext(ctx);vm.runInContext(profile+contacts+';this.p={ARCH,archTop,archHeight,archSlope,bridgeContact};',ctx);
const p=ctx.p,A=p.ARCH;
assert.ok(A.H<.4,'bridge crest is lower than the old .54-unit hump');
for(const end of [-A.L,A.L]){
 assert.ok(Math.abs(p.archTop(end)-A.y0)<1e-8,'bridge deck meets the asphalt');
 assert.ok(Math.abs(p.archSlope(6.5,14+end))<1e-8,'approach meets road with zero slope');
}
let maxSlope=0,maxPitchStep=0,prev;
for(let z=12.2;z<15.8;z+=.005){
 const u=z-14,h=.00001;
 if(Math.abs(u)<A.L-.001){
  const numeric=(p.archTop(u+h)-p.archTop(u-h))/(2*h);
  assert.ok(Math.abs(numeric-p.archSlope(6.5,z))<1e-5,'pitch derivative matches the rendered deck');
 }
 maxSlope=Math.max(maxSlope,Math.abs(p.archSlope(6.5,z)));
 for(const half of [.08,.11,.174]){
  const q=p.bridgeContact(6.5,z,-Math.PI/2,half),reverse=p.bridgeContact(6.5,z,Math.PI/2,half);
  assert.ok(Math.abs(q.height-reverse.height)<1e-9,'opposite traffic shares deck height');
  assert.ok(Math.abs(q.pitch+reverse.pitch)<1e-9,'opposite traffic pitches in opposite directions');
  assert.ok(Math.abs(q.front-(q.height+Math.tan(q.pitch)*half))<1e-8,'front axle meets sampled deck');
  assert.ok(Math.abs(q.rear-(q.height-Math.tan(q.pitch)*half))<1e-8,'rear axle meets sampled deck');
  if(half===.174){if(prev!==undefined)maxPitchStep=Math.max(maxPitchStep,Math.abs(q.pitch-prev));prev=q.pitch;}
 }
}
assert.ok(maxSlope<.5&&maxPitchStep<.008,'bus pitch changes continuously at approaches and crest');
assert.equal(p.archHeight(4,14),0,'no bridge lift between bridge lanes');
for(const z of [-.12,0,.12]){
 const underside=Math.min(p.archTop(z)-A.T,A.yb+(A.y0+A.H-A.T-A.yb)*Math.sqrt(1-(z/A.a)**2));
 assert.ok(underside>.48,'central rowing channel retains head clearance');
}
vm.runInContext(s.slice(s.indexOf('  function settleHumanPose('),s.indexOf('  function syncActors('))+';this.settle=settleHumanPose;',ctx);
const joint=()=>({rotation:{x:0,y:0,z:0}}),limbs={arms:[joint(),joint()],elbows:[joint(),joint()],wrists:[joint(),joint()],upperBody:joint()},state={};
ctx.settle(limbs,state,1/30);limbs.arms[1].rotation.x=-2;ctx.settle(limbs,state,1/30);
assert.ok(limbs.arms[1].rotation.x<0&&limbs.arms[1].rotation.x>-1,'an abrupt gesture target does not snap the arm');
const before=limbs.arms[1].rotation.x;limbs.arms[1].rotation.x=0;ctx.settle(limbs,state,1/30);
assert.ok(limbs.arms[1].rotation.x>before&&limbs.arms[1].rotation.x<0,'releasing a gesture settles toward rest without overshoot');
console.log('Toy Town BRIDGES PASS: lower deck, flat joins, derivative agreement, axle contact, opposite traffic and boat clearance');
