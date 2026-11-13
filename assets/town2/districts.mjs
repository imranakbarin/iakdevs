// A small set of district-specific details, placed beside existing buildings rather than on roads.
// Static props share one merged mesh. Dynamic meadow growth and delivery displays use real simulation state.
import * as THREE from 'three';
import {Bag} from './build.mjs';
import {BUILDINGS, heightAt, shore, PIER} from './def.mjs';
import {PLOTS, clearance} from './garden.mjs';
const COLOR={wood:'#9a795d',soft:'#f4e8d1',iron:'#65757d',flower:'#cf8f98',leaf:'#6e9d77',brass:'#d8b46f'};
const TAU=Math.PI*2;
function planter(b,x,z,color=COLOR.flower){
  b.box(.21,.15,.19,'#b98871',{x,y:.03,z,r:.025});
  b.sph(.12,COLOR.leaf,{x,y:.22,z,sy:.75,seg:9});
  for(let j=0;j<3;j++)b.sph(.038,color,{x:x+Math.cos(j*TAU/3)*.075,y:.29,z:z+Math.sin(j*TAU/3)*.075,seg:7});
}
function setPieces(b,d){
  const side=d.w*.5+.27;
  b.push(d.x,heightAt(d.x,d.z),d.z,d.ry);
  // The door stays clear. Props hug the side walls, so they do not block simulated paths.
  if(d.id==='market'){
    for(const s of [-1,1]) {
      b.box(.42,.32,.38,COLOR.wood,{x:s*side,y:.04,z:-.2,r:.035});
      for(let j=0;j<5;j++)b.sph(.085,j%2?'#dca965':'#8caa71',{x:s*side+(j%3-1)*.11,y:.38+(j%2)*.04,z:-.2,seg:9});
    }
    for(const x of [-.7,0,.7])b.box(.065,.1,.5,'#9a7159',{x,y:.8,z:-.2});
    b.box(2.0,.045,.6,'#e5b38d',{y:.94,z:-.12,rx:-.2});
  } else if(d.id==='hut'){
    for(const x of [-side,side]){
      b.cyl(.20,.21,.44,COLOR.wood,{x,y:.04,z:.1,seg:12});
      b.torus(.2,.025,'#ead0a1',{x,y:.48,z:.1,rx:Math.PI/2,rs:7,ts:16});
    }
    b.box(.62,.06,.35,'#aa9073',{x:side+.27,y:.05,z:-.5});
    b.torus(.18,.032,'#deccae',{x:side+.28,y:.16,z:-.5,rs:7,ts:14});
  } else if(d.id==='station'){
    for(const s of [-1,1]){b.box(.36,.35,.26,'#ac8a65',{x:s*side,y:.035,z:-.15});b.box(.32,.07,.26,COLOR.soft,{x:s*side,y:.39,z:-.15});}
    b.box(.58,.08,.33,COLOR.wood,{x:-side-.15,y:.3,z:-.62});
    b.box(.07,.48,.33,COLOR.iron,{x:-side-.38,y:.06,z:-.62});
  } else if(d.id==='school'){
    for(const s of [-1,1]){b.cyl(.06,.06,.8,COLOR.wood,{x:s*side,y:.06,z:0,seg:7});planter(b,s*side,.2,'#e4b264');}
    for(let i=0;i<5;i++)b.box(.04,.48,.04,COLOR.wood,{x:-.45+i*.23,y:.03,z:-d.w*.41});
  } else if(d.id==='barn'||d.id==='farm'){
    for(const s of [-1,1])b.box(.35,.34,.38,'#ac8f67',{x:s*side,y:.04,z:-.28});
    b.cyl(.27,.29,.24,'#bca28b',{x:side+.22,y:.05,z:.4,seg:10});
    b.cyl(.23,.23,.03,'#608e91',{x:side+.22,y:.28,z:.4,seg:10});
  } else if(d.id==='cafe'||d.id==='bakery'||d.id==='toys'){
    for(const s of [-1,1])planter(b,s*side,-.23,d.id==='cafe'?'#e3b5b9':'#d5b36d');
    b.box(.22,.27,.075,COLOR.soft,{x:side,y:1.1,z:.27,ry:.2});
    b.box(.25,.055,.12,COLOR.brass,{x:side,y:1.12,z:.3});
  } else if(/^c\d+$/.test(d.id) && Number(d.id.slice(1))%2===0){
    for(const s of [-1,1]) {planter(b,s*side,-.21,'#f0d9a0');b.box(.33,.07,.07,COLOR.wood,{x:s*side,y:.35,z:-.25});}
  }
  b.pop();
}
function livingBed(season){
  const plot=PLOTS.find(p=>p.kind==='wild'||p.kind==='pavilion');if(!plot)return null;
  const b=new Bag();
  for(let i=0;i<38;i++){
    const a=i*2.39996,r=(.25+Math.sqrt(i/38)*.56)*plot.r;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    b.cyl(.009,.009,.31,COLOR.leaf,{x,y:.03,z,seg:5});
    b.sph(.055,season==='winter'?'#edf2ec':i%3===0?'#ebcf83':i%3===1?'#daaaae':'#f2e3bd',{x,y:.35,z,seg:8});
    b.sph(.065,'#79a57b',{x:x-.04,y:.22,z:z+.02,sy:.5,seg:8});
  }
  const m=b.mesh(new THREE.MeshLambertMaterial({vertexColors:true}));
  const g=new THREE.Group();g.position.set(plot.x,heightAt(plot.x,plot.z),plot.z);g.add(m);return g;
}
export function buildDistrictLife(season='summer',lite=false){
  const root=new THREE.Group(), b=new Bag();
  if(!lite){
    for(const d of BUILDINGS)setPieces(b,d);
    // Four little sea markers make the harbour's edge legible without obscuring the boat lane.
    for(const dx of [.25,.56])for(const zSign of [-1,1]){
      const x=PIER.x1+dx,z=PIER.z+zSign*.83;
      if(shore(x,z)>1.02){
        b.cyl(.08,.1,.29,'#d79f81',{x,y:-.08,z,seg:10});
        b.cyl(.018,.018,.25,COLOR.iron,{x,y:.2,z,seg:7});
        b.sph(.046,'#f0dfb8',{x,y:.44,z,seg:9});
      }
    }
  }
  if(b.parts.length){const m=b.mesh(new THREE.MeshLambertMaterial({vertexColors:true}));m.receiveShadow=true;root.add(m);}
  const meadow=lite?null:livingBed(season);if(meadow)root.add(meadow);
  // A few cartons actually appear after real deliveries; no invented inventory counts.
  const goods=new THREE.Group(),d=BUILDINGS.find(x=>x.id==='market');
  if(d&&!lite){const crate=new Bag();crate.push(d.x,heightAt(d.x,d.z),d.z,d.ry);for(let i=0;i<4;i++){
    crate.box(.26,.21,.21,'#b38b6c',{x:d.w*.5+.39+i*.17,y:.05,z:-.8,r:.02});
    crate.box(.21,.04,.17,'#e9cda1',{x:d.w*.5+.39+i*.17,y:.26,z:-.8});
  }crate.pop();goods.add(crate.mesh(new THREE.MeshLambertMaterial({vertexColors:true})));root.add(goods);}
  let old=-1,oldFlower=-1;
  return {group:root,update({flowers=0,delivered=0,marketOpen=false}={}){
    const f=Math.max(.14,Math.min(1.15,flowers*1.35));if(meadow&&Math.abs(f-oldFlower)>.015){meadow.scale.y=f;oldFlower=f;}
    const visible=delivered>0&&marketOpen;if(goods.visible!==visible)goods.visible=visible;old=delivered;
  },stats(){return {meadow:!!meadow,hasDeliveries:goods.visible,decorated:!lite};}};
}
