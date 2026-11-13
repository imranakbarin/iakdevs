// Toy Town: four explorable cutaway rooms. Each room is a separate, small Three.js scene.
// The town keeps running in the background; no new gameplay state or second renderer.
import * as THREE from 'three';
import {Bag} from './build.mjs';
import {CAST} from './def.mjs';
import {buildPerson} from './people.mjs';
import {planRoom} from './roomlife.mjs';

export const ROOMS = Object.freeze({
  bakery: {title: 'The Bakery', subtitle: 'Bread, flour and a warm oven', people: ['crumb', 'moss']},
  cafe: {title: 'The Teapot Café', subtitle: 'Tea, conversation and fresh cakes', people: ['pott', 'june']},
  school: {title: 'The School', subtitle: 'Lessons, stories and tiny discoveries', people: ['chalk', 'dot']},
  station: {title: 'The Railway Station', subtitle: 'Tickets, trunks and the next train', people: ['otto', 'rudy']}
});
export const roomIds = Object.keys(ROOMS);
export function supportsInterior(id) { return Object.hasOwn(ROOMS, id); }

const C = {
  plaster:'#f3e9d5', wall:'#e5d4b5', plasterBlue:'#d9e8e3', rose:'#d8aea4',
  wood:'#947258', mahogany:'#795948', floor:'#c4a17a', trim:'#fff6e5',
  slate:'#637783', glass:'#a1c6ca', ink:'#434e52', brass:'#dfb76a', ember:'#f6ad62'
};
const mat = () => new THREE.MeshLambertMaterial({vertexColors:true});
const brick = (b,x,y,z,w,d='#ba8162') => b.box(w,.065,.08,d,{x,y,z});
function vessel(b,x,y,z,c='#fff4d8') {
  b.cyl(.11,.085,.19,c,{x,y,z,seg:12});
  b.torus(.045,.015,C.brass,{x:x+.12,y:y+.13,z,ry:Math.PI/2,seg:10});
  b.sph(.048,C.trim,{x,y:y+.2,z,seg:8});
}
function loaf(b,x,y,z,c='#c98248') {
  b.sph(.16,c,{x,y,z,sx:1.35,sy:.52,sz:.75,seg:12});
  for(let k=-1;k<=1;k++) b.box(.015,.013,.11,'#fae3a4',{x:x+k*.075,y:y+.075,z,rz:.22});
}
function cup(b,x,y,z) {
  b.cyl(.067,.05,.105,C.trim,{x,y,z,seg:10});
  b.torus(.044,.014,C.trim,{x:x+.066,y:y+.055,z,ry:Math.PI/2});
  b.cyl(.09,.09,.015,C.brass,{x,y:y-.015,z,seg:12});
}
function plant(b,x,z) {
  b.cyl(.21,.16,.22,'#b98067',{x,y:.13,z,seg:11});
  b.sph(.25,'#79a687',{x,y:.43,z,sy:.75,seg:10});
  b.sph(.16,'#528d70',{x:x+.12,y:.62,z:z-.06,seg:10});
}
function roomShell(b,id) {
  const cream=id==='school'?'#e9e3cb':id==='station'?'#dedcce':id==='cafe'?'#f2ddd2':C.plaster;
  b.box(6.35,.22,4.9,'#8c7161',{y:-.24,r:.09});
  b.box(6.12,.12,4.68,C.floor,{y:-.06,r:.045});
  // Timber floor with separate narrow planks. A small rug anchors the interior.
  for(let i=0;i<14;i++) b.box(6.03,.012,.01,'#a98765',{y:.056,z:-2.2+i*.335});
  b.box(6.2,2.85,.16,cream,{y:.035,z:-2.39,r:.03});
  b.box(.17,2.83,4.73,cream,{x:-3.07,y:.04,z:0,r:.03});
  b.box(.15,2.83,1.38,cream,{x:3.07,y:.04,z:-1.75,r:.03});
  b.box(6.15,.14,.19,C.wood,{y:.03,z:-2.25});
  b.box(.18,.14,4.6,C.wood,{x:-2.91,y:.03});
  b.box(6.2,.15,.2,C.trim,{y:2.73,z:-2.38});
  b.box(.2,.15,4.65,C.trim,{x:-3.02,y:2.73});
  // Daylight windows frame the back wall, each with a sill and small shutters.
  for(const x of [-1.7,1.5]) {
    b.box(.96,1.18,.032,C.trim,{x,y:1.02,z:-2.277});
    b.box(.77,.93,.035,C.glass,{x,y:1.12,z:-2.24});
    b.box(.035,.96,.046,C.trim,{x,y:1.12,z:-2.19});
    b.box(.83,.032,.046,C.trim,{x,y:1.6,z:-2.19});
    b.box(1.05,.075,.21,C.wood,{x,y:1.0,z:-2.17});
    for(const s of [-1,1]) b.box(.18,.93,.06,C.rose,{x:x+s*.55,y:1.12,z:-2.16});
  }
  b.box(1.7,.025,1.18,'#dfc4a4',{x:.15,y:.07,z:.7});
  b.box(1.55,.01,1.0,'#ecdfc5',{x:.15,y:.095,z:.7});
  for(const x of [-2.55,2.53]) for(const z of [-2.0,1.8]) b.box(.11,2.85,.11,C.wood,{x,y:0,z,r:.02});
}
function wallBoard(b,x,y,z,color='#586b62') {
  b.box(1.38,.8,.08,C.wood,{x,y,z});
  b.box(1.25,.66,.084,color,{x,y:y+.075,z:z+.03});
}
function bakery(b) {
  b.box(1.9,1.7,.98,'#cfb394',{x:-1.83,y:.12,z:-1.72,r:.12});
  b.box(1.33,1.22,.13,C.trim,{x:-1.82,y:.48,z:-1.13});
  b.box(.96,.72,.16,'#47362e',{x:-1.82,y:.52,z:-1.03,r:.2});
  b.box(.83,.06,.08,'#f2a75c',{x:-1.82,y:.6,z:-.93});
  for(let i=0;i<3;i++) brick(b,-2.5+i*.7,1.86,-1.18,.58,'#dfad82');
  b.box(3.55,.73,.76,'#ad8266',{x:.65,y:.12,z:.68,r:.06});
  b.box(3.65,.09,.9,C.trim,{x:.65,y:.84,z:.68,r:.035});
  // The display case is populated by actual pantry supply in the living-room layer.
  b.box(1.25,1.7,.4,C.wood,{x:2.31,y:.08,z:-1.58});
  for(let k=0;k<3;k++)b.box(1.2,.07,.48,C.trim,{x:2.3,y:.41+k*.55,z:-1.42});
  for(let i=0;i<3;i++){b.box(.29,.42,.26,'#e0c3a0',{x:1.98+i*.4,y:.09,z:1.78});b.box(.19,.12,.18,'#fff2dd',{x:1.98+i*.4,y:.52,z:1.78});}
  vessel(b,1.65,1.02,.85);
  plant(b,-2.52,1.55);
}
function cafe(b) {
  b.box(2.18,.85,.82,'#ac816a',{x:1.66,y:.11,z:-1.3,r:.07});
  b.box(2.3,.08,.92,'#f1e1c5',{x:1.66,y:.95,z:-1.3});
  b.box(.36,.48,.4,C.brass,{x:1.15,y:1.04,z:-1.4});
  vessel(b,1.88,1.08,-1.34);
  for(let k=0;k<4;k++)cup(b,.95+k*.34,1.07,-.96);
  wallBoard(b,-.24,1.71,-2.24,'#4c6356');
  for(let k=0;k<3;k++){b.box(.74,.065,.31,'#977052',{x:-2.46,y:.75+k*.46,z:-1.4});for(let v=0;v<2;v++)loaf(b,-2.7+v*.38,.84+k*.46,-1.38,'#d99b77');}
  for(let k=0;k<2;k++) {
    const x=-1.7+k*2.05, z=.72+k*.38;
    b.cyl(.058,.062,.75,C.wood,{x,y:.06,z});
    b.cyl(.58,.58,.065,'#f4e5c9',{x,y:.78,z,seg:18});
    // Guests' teacups appear only while the simulation places residents inside.
    for(let s of [-1,1]){b.box(.37,.10,.34,'#9a7358',{x:x+s*.82,y:.3,z});b.box(.08,.53,.32,C.wood,{x:x+s*1.01,y:.38,z});}
  }
  plant(b,-2.57,1.7);
  for(let i=0;i<5;i++)b.sph(.065,i%2?'#f5d6a0':'#ffefdb',{x:-2.4+i*1.08,y:2.6,z:1.2,seg:10});
}
function school(b) {
  wallBoard(b,.2,1.61,-2.24,'#405d59');
  b.box(.8,.12,.1,C.trim,{x:-.36,y:1.46,z:-2.14});
  b.box(.7,.035,.18,'#f8e4bb',{x:-2.31,y:1.22,z:-2.2});
  b.cyl(.27,.27,.06,'#a4c2b3',{x:2.34,y:1.52,z:-1.8,seg:16});
  b.torus(.31,.02,C.wood,{x:2.34,y:1.56,z:-1.8,rx:Math.PI/2});
  for(let k=0;k<4;k++){const x=-1.5+(k%2)*2.14,z=-.7+Math.floor(k/2)*1.52;
    b.box(1.18,.08,.61,'#c7a078',{x,y:.6,z,r:.035});
    for(let j=0;j<2;j++)b.box(.045,.5,.05,'#94735f',{x:x+(j? .47:-.47),y:.11,z:z+.2});
    b.box(.68,.032,.26,k%3?'#e3e8d2':'#d9b3a5',{x:x-.08,y:.69,z});
    b.box(.21,.024,.19,'#fff7e5',{x:x+.31,y:.7,z:z+.13});
    b.box(.73,.07,.3,'#a77e5d',{x,y:.32,z:z+.65});
  }
  b.box(.72,.66,.76,C.wood,{x:2.37,y:.09,z:.62});
  for(let i=0;i<7;i++)b.box(.025,.03,.46,i%2?'#e2a95c':'#729e93',{x:2.14+i*.07,y:.77,z:.62,rz:.15});
  plant(b,-2.45,1.84);
}
function station(b) {
  b.box(2.24,.96,.78,'#97755e',{x:1.64,y:.08,z:-1.55});
  b.box(2.3,.07,.84,'#f0dfb8',{x:1.64,y:1.06,z:-1.55});
  b.box(1.46,.65,.08,'#65797d',{x:1.58,y:1.36,z:-2.25});
  for(let k=0;k<5;k++)b.box(1.16,.03,.045,k%2?'#f5dab3':'#d4c5a4',{x:1.58,y:1.5+k*.13,z:-2.16});
  b.box(1.1,.6,.07,'#e5d6b7',{x:-1.95,y:1.8,z:-2.23});
  b.cyl(.26,.26,.05,C.trim,{x:-1.96,y:2.16,z:-2.18,rx:Math.PI/2,seg:18});
  b.cyl(.012,.012,.2,C.ink,{x:-1.96,y:2.2,z:-2.13,rx:Math.PI/2,seg:6});
  for(let k=0;k<3;k++) {
    const x=-1.9+k*1.42;
    b.box(.96,.1,.34,C.wood,{x,y:.42,z:.58});
    b.box(.09,.8,.33,'#97775d',{x:x-.43,y:.08,z:.58});
    b.box(.09,.8,.33,'#97775d',{x:x+.43,y:.08,z:.58});
    b.box(.95,.5,.11,C.wood,{x,y:.43,z:.94});
  }
  for(let k=0;k<4;k++){
    b.box(.44,.36,.33,['#a36d53','#7a8d91','#ae965e','#967c82'][k],{x:-2.43+k*.58,y:.09,z:1.65,r:.04});
    b.box(.25,.035,.035,C.brass,{x:-2.43+k*.58,y:.49,z:1.65});
  }
  b.box(.3,.18,.92,'#ba9e74',{x:2.6,y:.07,z:1.15});
  b.cyl(.1,.1,.7,C.wood,{x:2.47,y:.2,z:1.14,seg:10});
}
const BUILD = {bakery,cafe,school,station};

function resident(defId,x,z,yaw,scale=1.85) {
  const def=CAST.find(q=>q.id===defId); if(!def)return null;
  const g=buildPerson(def,'base');
  g.position.set(x,.08,z);g.rotation.y=yaw;g.scale.multiplyScalar(scale);g.visible=true;
  return g;
}
// A handful of meaningful scene props live in their own tiny meshes.
// They change only in response to simulation snapshots, not randomly generated stories.
function liveProp(fn) {
  const b=new Bag();fn(b);
  const m=b.mesh(mat());m.castShadow=false;m.receiveShadow=false;return m;
}
function liveDetails(id) {
  const g=new THREE.Group(), parts={};
  if(id==='bakery'){
    parts.ember=liveProp(b=>b.box(.76,.57,.07,'#e8a063',{x:-1.82,y:.55,z:-.925,r:.08}));
    // Three trays share their geometry: up to nine loaves for only three draw calls.
    parts.stock=[];
    for(let tray=0;tray<3;tray++){
      const p=liveProp(b=>{for(let j=0;j<3;j++){
        const i=tray*3+j;
        const x=i<6?-.5+i*.43:1.92+(i-6)*.38, y=i<6?.97:.48+(i-6)*.55;
        const z=i<6?.52+(i%2)*.25:-1.34;
        loaf(b,x,y,z);
      }});p.visible=false;parts.stock.push(p);g.add(p);
    }
    g.add(parts.ember);
  } else if(id==='cafe'){
    parts.tea=liveProp(b=>{cup(b,-1.89,.86,.84);cup(b,-1.55,.86,.66);cup(b,.18,.86,1.28);cup(b,.52,.86,1.11);});
    parts.tea.visible=false;g.add(parts.tea);
  } else if(id==='school'){
    parts.lesson=liveProp(b=>{
      for(let i=0;i<6;i++)b.box(.23,.025,.017,'#e8e5cf',{x:-.48+i*.21,y:1.76+Math.sin(i)*.13,z:-2.14,rz:.09});
      b.box(.5,.024,.018,'#e8e5cf',{x:.12,y:1.56,z:-2.14});
    });
    parts.lesson.visible=false;g.add(parts.lesson);
  } else if(id==='station'){
    parts.arrival=liveProp(b=>{
      b.box(.73,.18,.036,'#d5c49c',{x:1.55,y:1.88,z:-2.16,r:.015});
      b.sph(.08,'#76a589',{x:2.03,y:1.91,z:-2.08,seg:10});
    });
    parts.arrival.visible=false;g.add(parts.arrival);
  }
  return {group:g,parts};
}
function makeRoom(id) {
  const s=new THREE.Scene();
  s.background=new THREE.Color('#d4c4a9');
  const ambient=new THREE.HemisphereLight('#fff8e6','#93877c',1.6),sun=new THREE.DirectionalLight('#fff0db',2.1);
  sun.position.set(-5,9,8);s.add(ambient,sun);
  const b=new Bag();roomShell(b,id);BUILD[id](b);
  const mesh=b.mesh(mat());mesh.receiveShadow=true;s.add(mesh);
  const accents=new THREE.Group(), live=liveDetails(id);
  const who=ROOMS[id].people;
  const actorA=resident(who[0],id==='bakery'?-.12:id==='station'?1.4:-1.7,id==='school'?-1.75:id==='station'?-1.05:-.95,0);
  const actorB=resident(who[1],id==='cafe'?.45:1.1,id==='school'?.6:1.2,Math.PI*.82,id==='school'?1.5:1.72);
  if(actorA)accents.add(actorA);if(actorB)accents.add(actorB);
  s.add(accents,live.group);
  const glow=new THREE.PointLight('#ffbe79',.9,6,2);glow.position.set(id==='bakery'?-1.8:1.6,1.2,-1.35);s.add(glow);
  return {id,scene:s,actorA,actorB,glow,ambient,sun,live,age:0,plan:null};
}
export function createInteriorGallery() {
  const cache=new Map();let active=null;
  return {
    open(id){if(!supportsInterior(id))return false;if(!cache.has(id))cache.set(id,makeRoom(id));active=cache.get(id);return true;},
    close(){active=null;}, get id(){return active?.id||null;},
    get scene(){return active?.scene||null;},
    update(dt,world={}){
      if(!active)return;
      const state=planRoom(active.id,world);active.plan=state;
      active.age+=Math.min(.05,Math.max(0,dt));
      const t=active.age,{parts}=active.live;
      active.scene.background.set(state.sky);
      active.ambient.intensity=state.ambient;active.glow.intensity=state.lamp;
      active.sun.intensity=state.night?0.25:state.weatherRain>.4?1.15:2.05;
      if(parts.ember)parts.ember.visible=state.oven;
      if(parts.stock)parts.stock.forEach((m,i)=>m.visible=i<state.bread);
      if(parts.tea)parts.tea.visible=state.tea;
      if(parts.lesson)parts.lesson.visible=state.lesson;
      if(parts.arrival)parts.arrival.visible=state.board;
      // Interior figures represent the same residents in the world, not permanent duplicates.
      if(active.actorA)active.actorA.visible=state.staffHere;
      if(active.actorB)active.actorB.visible=state.visitorHere;
      const poses=[active.actorA,active.actorB];
      poses.forEach((g,i)=>{
        if(!g||!g.visible)return;
        const rig=g.userData.rig;rig.reset();
        const a=t*(i?1.6:2.3)+i*1.8;
        rig.set('head',.05+Math.sin(a*.45)*.06,Math.sin(a*.34)*.09,0);
        rig.set('armRu',-.28-.15*Math.sin(a),0,-.08);
        rig.set('armRl',-.30+.1*Math.cos(a),0,0);
        rig.set('armLu',-.18+.10*Math.cos(a*.5),0,.08);
        if(active.id==='school'&&state.lesson&&i===0)rig.set('armRu',-1.18+.2*Math.sin(a),0,-.3);
        if(active.id==='station'&&state.board&&i===0)rig.set('armRu',-1.0+.1*Math.sin(a),0,-.2);
        if(active.id==='bakery'&&state.oven&&i===0)rig.set('chest',.12+.07*Math.sin(a),0,0);
        if(active.id==='cafe'&&state.tea&&i===0)rig.set('armLu',-.8+.1*Math.sin(a),0,.1);
        rig.update();
      });
      active.scene.userData.deliveries=world.delivered||0;
      active.scene.userData.marketOpen=!!world.marketOpen;
    },
    stats(){return {id:active?.id||null,hasScene:!!active,actorCount:active?[active.actorA,active.actorB].filter(Boolean).length:0,
      status:active?.plan?.status||'',staffVisible:!!active?.actorA?.visible,visitorVisible:!!active?.actorB?.visible,
      props:active?.plan?{oven:active.plan.oven,bread:active.plan.bread,tea:active.plan.tea,lesson:active.plan.lesson,arrival:active.plan.board}:null};}
  };
}
