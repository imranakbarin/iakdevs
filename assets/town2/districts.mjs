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
// Civic and working buildings get one coherent identifying detail each.
// No repeat dressing of café/shop entrances (already handled by charm.mjs), or every cottage.
const DISTRICT_FOCAL = Object.freeze(['market','hut','station','school','barn','farm']);
function setPieces(b,d){
  const side=d.w*.5+.26;
  b.push(d.x,heightAt(d.x,d.z),d.z,d.ry);
  if(d.id==='market'){
    // Produce on one side of the stall, not a second competing awning.
    b.box(.44,.28,.36,COLOR.wood,{x:side,y:.04,z:-.24,r:.035});
    for(let j=0;j<3;j++)b.sph(.065,j===0?'#c7a06e':'#91a881',{x:side+(j-1)*.105,y:.33,z:-.22,seg:8});
  } else if(d.id==='hut'){
    b.cyl(.18,.19,.36,COLOR.wood,{x:side,y:.04,z:.1,seg:10});
  } else if(d.id==='station'){
    b.box(.34,.3,.26,'#ac8a65',{x:side,y:.04,z:-.16,r:.025});
    b.box(.36,.055,.29,COLOR.soft,{x:side,y:.365,z:-.16});
  } else if(d.id==='school'){
    planter(b,side,.2,'#ddb876');
  } else if(d.id==='barn'||d.id==='farm'){
    b.box(.34,.28,.37,'#ac8f67',{x:side,y:.04,z:-.28,r:.025});
  }
  b.pop();
}
function livingBed(season){
  const plot=PLOTS.find(p=>p.kind==='wild'||p.kind==='pavilion');if(!plot)return null;
  const b=new Bag();
  for(let i=0;i<19;i++){
    const a=i*2.39996,r=(.25+Math.sqrt(i/19)*.56)*plot.r;
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
    for(const d of BUILDINGS)if(DISTRICT_FOCAL.includes(d.id))setPieces(b,d);
    // Two restrained harbour markers keep the jetty readable, not fenced in.
    for(const zSign of [-1,1]){
      const x=PIER.x1+.42,z=PIER.z+zSign*.83;
      if(shore(x,z)>1.02){
        b.cyl(.075,.085,.27,'#b89b84',{x,y:-.08,z,seg:8});
        b.cyl(.014,.014,.2,COLOR.iron,{x,y:.18,z,seg:6});
      }
    }
  }
  if(b.parts.length){const m=b.mesh(new THREE.MeshLambertMaterial({vertexColors:true}));m.receiveShadow=true;root.add(m);}
  const meadow=lite?null:livingBed(season);if(meadow)root.add(meadow);
  // A few cartons actually appear after real deliveries; no invented inventory counts.
  const goods=new THREE.Group(),d=BUILDINGS.find(x=>x.id==='market');
  if(d&&!lite){const crate=new Bag();crate.push(d.x,heightAt(d.x,d.z),d.z,d.ry);for(let i=0;i<2;i++){
    crate.box(.26,.21,.21,'#b38b6c',{x:d.w*.5+.39+i*.17,y:.05,z:-.8,r:.02});
    crate.box(.21,.04,.17,'#e9cda1',{x:d.w*.5+.39+i*.17,y:.26,z:-.8});
  }crate.pop();goods.add(crate.mesh(new THREE.MeshLambertMaterial({vertexColors:true})));root.add(goods);}
  // Extra fine detail only comes into view when exploring a neighbourhood. At the
  // overview zoom the island reads as a clear plan: streets, gardens and landmarks.
  const closeEnough=dist=>!lite&&dist<26;
  const detail=root.children[0]&&root.children[0].isMesh?root.children[0]:null;
  return {group:root,update({flowers=0,delivered=0,marketOpen=false,dist=44}={}){
    const close=closeEnough(dist);
    if(detail)detail.visible=close;
    const f=Math.max(.14,Math.min(1.15,flowers*1.35));
    if(meadow){meadow.visible=close;if(meadow.visible&&Math.abs(f-meadow.scale.y)>.015)meadow.scale.y=f;}
    goods.visible=close&&delivered>0&&marketOpen;
  },stats(){return {meadow:!!meadow,hasDeliveries:goods.visible,decorated:!lite,detailsVisible:!!detail&&detail.visible,quietOverview:!lite&&!detail?.visible};}};
}
