'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/toy-town-3d.js'),'utf8');
const block=source.slice(source.indexOf("  let weatherKind='clear'"),source.indexOf('  function updateFollowCard()'));
class V{set(x,y,z){Object.assign(this,{x,y,z});}setScalar(k){this.set(k,k,k);}}
class G{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}dispose(){this.disposed=true;}}
class M{constructor(o){Object.assign(this,o);}dispose(){this.disposed=true;}}
class Mesh{constructor(geometry,material){Object.assign(this,{geometry,material,userData:{},position:new V(),rotation:{},scale:new V()});}}
const world={children:[],add(o){this.children.push(o);o.parent=this;},remove(o){this.children=this.children.filter(c=>c!==o);}};
const state={kind:'rain'};
const ctx={THREE:{BufferGeometry:G,BufferAttribute:class{constructor(array){this.array=array;}},LineSegments:Mesh,LineBasicMaterial:M,
 Mesh,MeshBasicMaterial:M,TorusGeometry:G},world,lite:false,window:{ToyTownWeather:{state}},actors:new Map(),clouds:[],groundLevel:()=>.18,
 sceneClock:0,clockMs:()=>0,sound(){},geo:()=>new G(),mat:()=>new M({}),cylinder(){},object(){}};
vm.createContext(ctx);vm.runInContext(block+';this.api={updateWeather,get:()=>precip,old:()=>leavingPrecip,roofs:rainRoofs};',ctx);
ctx.api.updateWeather(.016);let rain=ctx.api.get();
assert.equal(rain.userData.lengths.length,420);
assert.ok(Math.min(...rain.userData.lengths)>=.045&&Math.max(...rain.userData.lengths)<.141);
assert.ok(new Set([...rain.userData.lengths].map(v=>v.toFixed(3))).size>50);
const lengths=Array.from(rain.userData.lengths),positions=rain.geometry.attributes.position.array;
for(let i=0;i<10;i++)ctx.api.updateWeather(.016);
for(let i=0;i<lengths.length;i++)assert.ok(Math.abs(positions[i*6+4]-positions[i*6+1]-lengths[i])<.000002,'a moving drop never stretches');
ctx.api.roofs.push({x:5.5,z:5.5,rx:.49,rz:.49,top:1.2});
positions.set([5.5,1.21,5.5,5.488,1.21+lengths[0],5.5],0);
ctx.api.updateWeather(.04);assert.ok(positions[1]>5,'a drop hitting the real roof bounds respawns above the town');
state.kind='clear';ctx.api.updateWeather(.1);
assert.equal(ctx.api.get(),null);assert.equal(ctx.api.old().length,1);
const before=positions[4]-positions[1];ctx.api.updateWeather(.1);
assert.ok(Math.abs((positions[4]-positions[1])-before)<.000002,'fading drops move both endpoints together');
for(let i=0;i<40;i++)ctx.api.updateWeather(.1);
assert.equal(ctx.api.old().length,0);assert.ok(rain.geometry.disposed&&rain.material.disposed,'finished streams release their resources');
console.log('Toy Town RAIN PASS: varied short streaks, stable lengths, roof contact, fade and resource cleanup');
