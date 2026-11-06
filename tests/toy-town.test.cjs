// Toy Town: a light news story picks the day's theme, a grim one never does;
// the same day always builds the same town (roads, river, a fire station, a
// park and the theme's own block); every chaos and theme event runs to its end
// without error; and traffic and people keep the streets busy.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// The simulation uses Math.random; a fixed seed keeps the traffic and people checks reproducible (TT_SEED overrides it to hunt for flakes).
function seedScenarioRandom() { let a = (+process.env.TT_SEED || 20261104) >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
seedScenarioRandom();
const dioramaSource = fs.readFileSync(path.join(root, 'assets/toy-town-diorama.js'), 'utf8');
assert.match(dioramaSource, /function building\(/, 'new architectural renderer exists');
assert.match(dioramaSource, /function tree\(/, 'new organic tree renderer exists');
assert.match(dioramaSource, /function gable\(/, 'real pitched roof renderer exists');
assert.match(dioramaSource, /function glazing\(/, 'framed glazing renderer exists');
assert.match(html, /<option value="town">Toy Town<\/option>/, 'Toy Town is in the menu');
assert.match(html, /return 'toy-town\.html\?v=96&embed=1'\+keep\+\(bar\.hidden\?'&clean=1':''\);/, 'and opens its current embedded page');
assert.match(html, /townFrame\.src=townSrc\(\);/, 'with this page\'s weather and fps settings passed through');
assert.match(fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8'), /assets\/toy-town\.js\?v=\d+/);
const box = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, setTimeout: () => 0, document: {getElementById: () => ({textContent: ''})}});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8')) + ';this.T = ToyTown;', box);
const T = box.T;

// The news filter.
assert.equal(T.themeFromNews(['A storm kills 12 people in the north', 'SpaceX launches a rocket to the Moon']).key, 'space', 'a light story is used, a grim one skipped');
assert.equal(T.themeFromNews(['Rocket attack on a city kills five']), null, 'a grim story never becomes a theme, whatever else it mentions');
assert.equal(T.themeFromNews(['The national football team wins the cup']).key, 'sports');
assert.equal(T.themeFromNews(['Voters elect a new president in a run-off']).key, 'election');
assert.equal(T.themeFromNews(['Thousands celebrate Diwali across the country']).key, 'festival');
assert.equal(T.themeFromNews(['A new species of frog is described']).key, 'animals');
assert.equal(T.themeFromNews(['The council met on Tuesday']) .variant, 'vote', 'broader words now map a civic headline');
assert.equal(T.themeFromNews(['Something odd happened somewhere']), null, 'nothing matching: the date chooses');
assert.equal(T.stageFor('Something odd happened somewhere').variant, 'newsie', 'every light headline still gets a scene: the newspaper seller');
assert.equal(T.themeFromNews(['Explosion at a fireworks festival injures dozens']), null);

// The specific kind of story picks its variant, so the town matches the news.
const v = t => (T.themeFromNews([t]) || {}).variant;
assert.equal(v('India win the second Test after a dramatic final wicket in cricket'), 'cricket');
assert.equal(v('Millions celebrate Diwali with lamps and fireworks'), 'diwali');
assert.equal(v('Palaeontologists describe a new dinosaur from a fossil found in Patagonia'), 'dino');
assert.equal(v('Artemis crew completes a lunar flyby'), 'moon');
assert.equal(v('The Monaco Grand Prix is won from pole position'), 'race');
assert.equal(v('A pod of whales is seen in the harbour'), 'whale');
const three = T.newsThemes(['Explosion kills four in a factory', 'A new smartphone goes on sale', 'Halloween parades fill the streets', 'The marathon record is broken', 'Another phone story']);
assert.equal(JSON.stringify(three.map(x => x.variant)), JSON.stringify(['phone', 'halloween', 'marathon']), 'up to three light stories, one per theme, grim ones skipped');
assert.ok(T.VARIANTS.every(x => T.VARIANT_EVENTS().includes(x.variant)), 'every variant has its own event');
// Local midnight can differ from UTC midnight; the date key must use local calendar fields.
class LateEveningDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-11-01T00:30:00Z'])); }
  getFullYear() { return 2026; } getMonth() { return 9; } getDate() { return 31; }
}
const lateBox = vm.createContext({...box, Date: LateEveningDate});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8')) + ';this.T = ToyTown;', lateBox);
assert.equal(lateBox.T.dateKey(), '2026-10-31', 'late local evening remains on the local date');

// The story's own name goes on the banners; a long story becomes a headline.
assert.equal(T.nameOf('India win the second Test against England by an innings'), 'India');
assert.equal(T.nameOf('Thousands celebrate the New Year in Sydney Harbour'), 'New Year', 'the first of equally long names: HAPPY NEW YEAR!');
assert.equal(T.nameOf('The Artemis III crew completes a lunar flyby'), 'Artemis III');
assert.equal(T.nameOf('A new smartphone goes on sale'), '');
assert.ok(T.headline('In tennis, the Toy Open final is won in five sets, while the crowd sings and the rain holds off for once in a long while').length <= 72, 'long stories are shortened');

// The same day builds the same town; every theme gets its block.
const layout = () => T.buildings().map(b => b.kind + b.x + ',' + b.y).join('|');
T.build(12345, 'space'); const a = layout(); T.build(12345, 'space');
assert.equal(layout(), a, 'the same seed builds the same town');
T.build(2468,'weather');
const condensedSkyline=T.buildings().filter(b=>b.kind==='tower');
assert.ok(condensedSkyline.length>=3 && condensedSkyline.length<=6,
  'the background skyline has three to six distinct spires, not a packed tower grid');
const assembledLots=new Set(T.buildings().map(b=>b.x+','+b.y));
assert.equal(assembledLots.size,T.buildings().length,
  'clustered districts have no overlapping occupied lots');
assert.ok(T.buildings().every(b=>b.x>=2 && b.x<=15 && b.y>=2 && b.y<=15),
  'the composed town never puts permanent buildings on road or water lanes');

for (const [key, kind] of Object.entries({space: 'launchpad', sports: 'stadium', election: 'stage', animals: 'zoo', market: 'market', science: 'lab'})) {
  T.build(777, key);
  assert.ok(T.props().some(p => p.kind === kind), `${key}: the town has its ${kind}`);
  assert.ok(T.buildings().some(b => b.kind === 'fire'), `${key}: there is a fire station`);
}
// Every event runs to its end, in every theme, with the streets kept busy.
for (const key of Object.keys(T.THEMES)) {
  T.build(4242, key);
  for (const name of ['hydrant', 'cart', 'dog', 'balloons', 'cat', 'pigeons', 'banana', 'ufo', 'icecream', 'duck', 'jam', 'chickens', key]) T.startEvent(name);
  for (let i = 0; i < 60 * 30; i++) T.update(1 / 60);
  assert.ok(T.movers().filter(m => m.kind === 'car' || m.kind === 'bus' || m.kind === 'taxi').length >= 7 && T.movers().filter(m => m.kind === 'bike').length >= 4 && T.movers().filter(m => m.type === 'person').length >= 14, `${key}: cars, cyclists and walkers keep the streets alive`);
  assert.ok(T.movers().every(m => m.x > 0 && m.x < 18 && m.y > 0 && m.y < 18 && Number.isFinite(m.x + m.y)), `${key}: everyone stays in town`);
  assert.ok(T.events().length <= 6, `${key}: events end (${T.events().length} running)`);
}
// Every news variant, with its decorations, runs to its end (as the day's lead story).
for (const x of T.VARIANTS) {
  T.build(99, x.key); T.decorate([x]); T.setToday([x]);
  const started = T.startEvent(x.variant);
  assert.ok(started, `${x.variant}: the event starts`);
  for (let i = 0; i < 60 * 40; i++) T.update(1 / 60);
  assert.ok(T.movers().every(m => Number.isFinite(m.x + m.y)), `${x.variant}: everyone is somewhere`);
  assert.ok(!T.events().includes(started), `${x.variant}: the original event finishes`);
}
assert.ok(T.PACE < 1, 'the town runs slower than real time');
// The Toy Town Times stands at the town corner, clear of houses; neighbours chat and a plane tows the headline.
{ const lead = {...T.VARIANTS.find(v => v.variant === 'cricket'), story: 'India win the second Test', name: 'India'};
  T.build(2024, 'sports'); T.decorate([lead]); T.setToday([lead]);
  const board = T.props().find(p => p.kind === 'times');
  assert.ok(board && board.x > 16.5 && board.y < 1.5 && !T.buildings().some(b => b.x + 1 > board.x - .5 && b.y < board.y + 1), 'the billboard stands in the right-hand corner, clear of the houses');
  assert.ok(T.props().filter(p => p.kind === 'kiosk').length >= 1 && T.props().some(p => p.kind === 'bunting'), 'kiosks on the corners, bunting on a match day');
  const chat = T.startEvent('chat'), plane = T.startEvent('skybanner');
  assert.ok(chat && plane && /India|Test/.test(plane.towed), 'a plane tows the headline');
  for (let i = 0; i < 60 * 40; i++) T.update(1 / 60);
  assert.ok(T.TALK.sports.some(l => l.includes('{N}')), 'some lines name the story'); }
// Travel distance rather than elapsed time drives footsteps and spinning wheels.
T.build(777, 'weather');
const walkers = T.movers().filter(m => m.type === 'person' && !m.kind);
const cyclist = T.movers().find(m => m.kind === 'bike'), walker = walkers[0];
walker.v = 0; walker.max = 0; cyclist.v = 0; cyclist.max = 0;
// Explicit pause is required: theme events may legally assign a route
// even to a pedestrian with max=0. Test standing, not event scheduling.
walker.stopUntil=T.debug().clock+3;
cyclist.stopUntil=T.debug().clock+3;
const parkedDistance = [walker.travel, cyclist.travel];
for (let i = 0; i < 120; i++) T.update(1 / 60);
assert.equal(walker.travel, parkedDistance[0], 'a standing walker does not advance animation distance');
assert.equal(cyclist.travel, parkedDistance[1], 'a stopped bicycle does not pedal');
walker.max = .6; cyclist.max = .65;
walker.stopUntil=0;cyclist.stopUntil=0;
for (let i = 0; i < 60 * 25; i++) T.update(1 / 60);
assert.ok(walker.travel > parkedDistance[0], 'walking advances the stride clock');
assert.ok(cyclist.travel > parkedDistance[1], 'cycling advances the pedal clock');
 
// Real movement contract: untraveled actors never play a walk cycle.
assert.ok(walker.moved>=0&&cyclist.moved>=0,
  'the movement engine exposes actual distance advanced this tick');
// Different sides of the road must be navigable without phantom head-on braking.
const physicsCars=T.movers().filter(m=>m.type==='car'&&m.kind!=='bike');
const east=physicsCars[0],west=physicsCars[1];
Object.assign(east,{x:3.0,y:1.5,d:0,lane:.2,v:1.0,max:1.0,path:null,stopUntil:0});
Object.assign(west,{x:4.6,y:1.5,d:1,lane:.2,v:1.0,max:1.0,path:null,stopUntil:0});
const startEast=east.x,startWest=west.x;
for(let i=0;i<50;i++)T.update(1/60);
assert.ok(east.x>startEast+.15&&west.x<startWest-.15,
  'opposite-direction traffic has separate physical lanes and can pass');
// A follower must preserve body clearance rather than cutting through a car.
Object.assign(east,{x:3,y:1.5,d:0,lane:.2,v:1.0,max:1.1,path:null,stopUntil:0});
Object.assign(west,{x:3.95,y:1.5,d:0,lane:.2,v:0,max:0,path:null,stopUntil:0});
for(let i=0;i<75;i++){
  T.update(1/60);
  assert.ok(west.x-east.x>=.55,
    'same-lane car bodies never overlap even when the leader is stopped');
}
assert.ok(east.v<.1,'a blocked follower comes to a real stop');
// Perception: a free walker pauses at a nearby shop and actually looks at it.
T.build(52045,'market');
const curious=T.movers().find(m=>m.type==='person'&&!m.kind);
const storefront=T.buildings().find(b=>b.kind==='shop');
assert.ok(curious&&storefront,'behavior test has a walker and a destination');
curious.x=storefront.x+.5;curious.y=storefront.y+1.38;
curious.d=0;curious.max=.53;curious.stopUntil=0;curious.path=null;
curious.nextNotice=0;curious.observeUntil=0;
T.update(1/60);
assert.equal(curious.intent,'browse','nearby storefront triggers a purposeful stop');
assert.ok(curious.attention&&Math.abs(curious.attention.x-storefront.x-.5)<.01,
  'shop browsing has a real look-at destination');
assert.equal(curious.v,0,'a browsing pedestrian stops their footsteps');
for(let i=0;i<60*5;i++)T.update(1/60);
assert.notEqual(curious.intent,'browse','a pause is temporary; walkers resume their journeys');
// A following driver brakes for a stationary vehicle without phasing through it.
const drivers=T.movers().filter(m=>m.type==='car'&&m.kind!=='bike');
const following=drivers[0],leading=drivers[1];
assert.ok(following&&leading,'reactive traffic test has at least two vehicles');
Object.assign(following,{x:3,y:1.5,d:0,lane:.20,v:.7,max:1.3,path:null});
Object.assign(leading,{x:3.31,y:1.5,d:0,lane:.20,v:0,max:1.1,path:null});
T.update(1/60);
assert.equal(following.braking,true,
  'a moving vehicle exposes a brake-light intention when closing on traffic');

// Cars at a road end drive to the last junction and turn left or right; they turn round only when both sides are blocked.
{
  T.build(61001,'market');
  const cars=T.movers().filter(m=>m.type==='car'&&m.kind!=='bike');
  const park=cars.slice(1);park.forEach((c,i)=>Object.assign(c,{x:3+i*.5,y:16.5,d:0,v:0,max:0,stopUntil:1e9,path:null}));
  const lone=cars[0];let side=0,round=0;
  for(let trial=0;trial<16;trial++){
    Object.assign(lone,{x:15.6,y:6.5,d:0,v:.8,max:1,lane:.16,path:null,stopUntil:0,patienceUntil:0,turnSignal:null});
    let turnedTo=null;
    for(let i=0;i<60*16&&turnedTo===null;i++){   // a red light may hold it first
      T.update(1/60);
      if(lone.d!==0)turnedTo=lone.d;
    }
    if(turnedTo===2||turnedTo===3)side++;else if(turnedTo===1)round++;
    assert.ok(lone.x<=16.56,'a car never drives past the last junction');
  }
  assert.ok(side>=13&&round<=2,'at the end of the road cars turn left or right, not back the way they came ('+side+' side, '+round+' round)');
}
// A car stops for a walker standing in the carriageway; a walker waits rather than step into a car.
{
  T.build(61002,'market');
  const cars=T.movers().filter(m=>m.type==='car'&&m.kind!=='bike'),walkers=T.movers().filter(m=>m.type==='person'&&!m.kind&&!m.path);
  cars.slice(2).forEach((c,i)=>Object.assign(c,{x:3+i*.5,y:16.5,d:0,v:0,max:0,stopUntil:1e9,path:null}));
  const car=cars[0],stopped=cars[1],w=walkers[0],w2=walkers[1];
  Object.assign(stopped,{x:15,y:16.5,d:0,v:0,max:0,stopUntil:1e9,path:null});
  Object.assign(w,{x:3.9,y:1.5,d:0,lane:0,v:0,max:0,stopUntil:1e9,path:null,heroResident:false});
  Object.assign(car,{x:2.6,y:1.5,d:0,v:1,max:1.2,lane:.16,path:null,stopUntil:0,patienceUntil:0});
  for(let i=0;i<60*3;i++){T.update(1/60);if(car.d!==0)break;}
  assert.ok(car.x<w.x-.15,'a car does not drive through a walker standing in its lane ('+car.x.toFixed(2)+' vs '+w.x+')');
  Object.assign(stopped,{x:5,y:6.5,d:0,v:0,max:0,lane:.16,stopUntil:1e9,path:null});
  Object.assign(w2,{x:4.4,y:6.66,d:0,lane:0,v:0,max:.5,stopUntil:0,observeUntil:0,nextDawdle:1e9,nextNotice:1e9,path:null,heroResident:false,carGoUntil:0,carWaitSince:undefined});
  for(let i=0;i<60*2;i++)T.update(1/60);
  assert.ok(w2.x<4.84,'a walker waits at a stopped car instead of stepping into its body ('+w2.x.toFixed(2)+')');
}

// Scripted walkers wait at the kerb for the walk signal before stepping into a street at a junction.
{
  T.build(61003,'market');
  const cars=T.movers().filter(m=>m.type==='car');cars.forEach((c,i)=>Object.assign(c,{x:2+i*.4,y:16.5,d:0,v:0,max:0,stopUntil:1e9,path:null}));
  const w=T.movers().find(m=>m.type==='person'&&!m.kind&&!m.heroResident&&!m.shopRole);
  const phase=()=>{const c=T.debug().clock%20;return c;};
  let guard=0;while(!(phase()>1&&phase()<3)&&guard++<4000)T.update(1/60);   // the x streets have green
  for(let ms=T.movers(),i=ms.length-1;i>=0;i--)if(ms[i]!==w&&ms[i].type==='person'&&ms[i].path&&Math.hypot(ms[i].x-6.93,ms[i].y-6.5)<3)ms.splice(i,1);   // an event's walkers (a dog walk, a jogger) must not cross at the same moment
  Object.assign(w,{x:7.05,y:6.0,d:2,lane:0,path:[{x:7.05,y:7.0,speed:.5,dry:true}],busy:true,max:.5,v:0,stopUntil:0,observeUntil:0,nextDawdle:1e9,nextNotice:1e9,sigWaitSince:undefined,sigGoUntil:0});
  const keep=()=>{ if(!w.path||!w.path[0]||w.path[0].x!==7.05)w.path=[{x:7.05,y:7.0,speed:.5,dry:true}]; };   // a random rally or fair may recruit this walker: put the errand back
  for(let i=0;i<60*4;i++){keep();T.update(1/60);}
  assert.ok(w.y<6.5-.37+.02,'a walker waits at the kerb while the street in front of them has green ('+w.y.toFixed(2)+')');
  guard=0;while(!(phase()>11&&phase()<12.5)&&guard++<4000)T.update(1/60);   // now the crossing is theirs
  for(let ms=T.movers(),i=ms.length-1;i>=0;i--)if(ms[i]!==w&&Math.hypot(ms[i].x-7.05,ms[i].y-6.8)<3)ms.splice(i,1);   // traffic respawns while the light cycles; this test is about the signal, not about a car in the way
  let maxY=w.y;for(let i=0;i<60*4;i++){keep();T.update(1/60);maxY=Math.max(maxY,w.y);}
  assert.ok(maxY>6.9,'and crosses once the signal lets them ('+maxY.toFixed(2)+')');
}
// A siren clears the road: traffic ahead of the fire truck pulls over and stops, oncoming traffic eases to the kerb, and both go on after it has passed.
{
  T.build(61004,'market');
  const cars=T.movers().filter(m=>m.type==='car'&&m.kind!=='bike'&&m.kind!=='bus');
  cars.slice(3).forEach((c,i)=>Object.assign(c,{x:2+i*.4,y:16.5,d:0,v:0,max:0,stopUntil:1e9,path:null}));
  const [truck,ahead,oncoming]=cars;
  Object.assign(truck,{kind:'fire',siren:true,x:1.6,y:1.5,d:0,v:1.6,max:1.8,lane:0,path:[{x:15,y:1.5,speed:1.6}],stopUntil:0});
  Object.assign(ahead,{x:3.0,y:1.5,d:0,v:.9,max:1,lane:.16,baseLane:.16,path:null,stopUntil:0,patienceUntil:0});
  Object.assign(oncoming,{x:5.2,y:1.5,d:1,v:.9,max:1,lane:.16,baseLane:.16,path:null,stopUntil:0,patienceUntil:0});
  let sawStop=false,maxLaneA=0,maxLaneO=0;
  for(let i=0;i<60*6;i++){
    T.update(1/60);
    if(ahead.v<.1&&Math.abs(ahead.x-truck.x)<2.2&&truck.x<ahead.x)sawStop=true;
    maxLaneA=Math.max(maxLaneA,ahead.lane);maxLaneO=Math.max(maxLaneO,oncoming.lane);
    assert.ok(!(Math.abs(truck.x-ahead.x)<.2&&Math.abs(truck.y-ahead.y)<.2),'the truck never drives through the car it is clearing');
  }
  assert.ok(sawStop,'a car ahead of the siren pulls in and stops');
  assert.ok(maxLaneA>.2&&maxLaneO>.2,'traffic eases over to the kerb as the siren comes by');
  truck.siren=false;truck.path=null;truck.stopUntil=1e9;
  for(let i=0;i<60*8;i++)T.update(1/60);
  assert.ok(Math.abs(ahead.lane-.16)<.02||ahead.lane<.25,'and the lane is taken back afterwards');
}
// The bus runs a long closed route: every stop, both ring roads and both bridges; residents come away from shops with paper bags.
{
  T.build(61005,'market');
  const stops=new Set(),rows=new Set(),cols=new Set();let bagged=0;
  for(let i=0;i<60*600;i++){
    T.update(1/60);
    if(i%20)continue;
    for(const b of T.movers().filter(m=>m.kind==='bus')){
      if(b.atStop!==undefined)stops.add(b.atStop);
      for(const l of [1.5,6.5,11.5,16.5]){if(Math.abs(b.y-l)<.06)rows.add(l);if(Math.abs(b.x-l)<.06)cols.add(l);}
    }
    bagged=Math.max(bagged,T.movers().filter(m=>m.shopBag>=0).length);
  }
  assert.ok(stops.size>=6,'the bus calls at most of its eight stops ('+[...stops]+')');
  assert.ok(rows.has(1.5)&&rows.has(16.5)&&rows.has(6.5)&&rows.has(11.5),'it runs along the north, south and both middle streets ('+[...rows]+')');
  assert.ok(T.debug().whims.shop>=1&&bagged>=1,'residents go shopping and carry a bag for a while ('+T.debug().whims.shop+' trips)');
}

// The town knows today's light headlines (for the crier and the billboards) and never stages serious ones.
{
  T.setNews([{title:'A giant panda cub is born at the city zoo',source:'BBC News',tone:'light'},{title:'Team wins the cup final after dramatic penalties',source:'BBC Sport'},{title:'Missiles hit the capital as the war enters a new week',source:'DW'}]);
  const N=T.news();
  assert.equal(N.light.length,2,'two light headlines are kept for the town');
  assert.equal(N.heavy,1,'the serious one is counted, not staged');
  assert.ok(N.light.every(i=>i.title&&i.emoji&&i.source),'each has text, a topic emoji and its source');
  assert.equal(N.light[0].emoji,'🐼','a panda story gets the panda');
  assert.equal(N.light[1].emoji,'⚽','and a cup final the ball');
  assert.ok(N.version>=1,'the version changes with every feed');
}
// Outer neighborhoods are services with meaningful safe routes, not scenery.
T.build(60624,'market');
assert.equal(T.debug().districts.count,4,
  'four outer quadrants each have an active local service');
assert.equal(T.debug().districts.areas.map(a=>a.role).join(','),
  'garden,post,art,produce','each district has its own recognizable job');
const localWorkers=T.movers().filter(m=>m.districtResident);
assert.equal(localWorkers.length,8,
  'four workers and four visitors populate the outlying neighborhoods');
assert.equal(T.props().filter(p=>p.kind==='district-scene').length,4,
  'each outer district has a physical work destination');
let throughHomes=0,travelled=0;
for(let i=0;i<60*72;i++){
  T.update(1/60);
  if(i%60)continue;
  for(const m of localWorkers){
    travelled=Math.max(travelled,m.travel||0);
    if(T.buildings().some(b=>Math.abs(m.x-b.x-.5)<.30&&
      Math.abs(m.y-b.y-.5)<.30))throughHomes++;
  }
}
assert.equal(throughHomes,0,'district residents never walk through houses');
assert.ok(travelled>4,'residents visibly walk between distinct destinations');
assert.ok(T.debug().districts.visits>=5,
  'local visitors repeatedly reach real workplaces');
assert.ok(T.debug().districts.tasks>=8,
  'local workers perform repeat tasks only after arriving');
assert.ok(T.debug().districts.meetings>=1,
  'visitors greet people in actual nearby positions');

// Persistent life should continue without an event, new button or teleport.
// The two locals make independent visits, converge to chat, then separate.
T.build(46112,'weather');
const neighbors=T.movers().filter(m=>m.communityResident);
const companion=T.movers().find(m=>m.companionDog);
assert.equal(neighbors.length,2,'two persistent neighbors live in the plaza');
assert.ok(companion&&companion.kind==='dog','a dog accompanies one of the locals');
assert.equal(T.debug().communityEncounters,0,'new-day routines reset correctly');
let furthestDog=0,met=false;
for(let i=0;i<60*77;i++){
  T.update(1/60);
  const gap=Math.hypot(companion.x-neighbors[1].x,companion.y-neighbors[1].y);
  furthestDog=Math.max(furthestDog,gap);
  if(neighbors.every(m=>m.intent==='chat')){
    met=true;
    assert.ok(Math.hypot(neighbors[0].x-neighbors[1].x,
      neighbors[0].y-neighbors[1].y)<.90,
      'the pair meets in physical space, rather than telepathically');
    assert.ok(neighbors.every(m=>m.attention),'conversation establishes eye contact');
  }
}
assert.ok(T.debug().communityVisits>=2,'residents independently visit real destinations');
assert.ok(T.debug().communityEncounters>=1&&met,'neighbors meet and talk in the square');
assert.ok(furthestDog<2.2,'dog stays near its owner throughout the neighborhood routine');
T.build(827741530,'market');
let joinedOnApproach=false;
for(let i=0;i<60*69;i++){
  T.update(1/60);
  if(T.debug().communityEncounters>0){joinedOnApproach=true;break;}
}
assert.ok(joinedOnApproach,
  'neighbors can recognize a friend during the approach instead of missing the exact meeting waypoint');
assert.ok(T.movers().every(m=>Number.isFinite(m.x+m.y)&&m.x>0&&m.y>0&&
  m.x<18&&m.y<18),'coordinated motion respects the town bounds');



// The new service threshold is an actual stationary knock, followed by a
// connected counter approach—not a teleport or a decorative hand wave.
T.build(60624,'market');
const knockCustomers=T.movers().filter(m=>m.shopRole==='customer');
let knockSamples=0,knockSlides=0,counterApproaches=0,
  counterArrivals=0,goodsDepartures=0;
for(let i=0;i<60*42;i++){
  T.update(1/60);
  for(const m of knockCustomers){
    if(m.shopPhase==='knocking'){
      knockSamples++;
      if(m.moved>.00015)knockSlides++;
      assert.ok(m.attention,'knocking occurs facing a real shopkeeper');
    }
    if(m.shopPhase==='approachingCounter')counterApproaches++;
    if(m.shopPhase==='ordering')counterArrivals++;
    if(m.shopPhase==='leaving'&&m.carrying)goodsDepartures++;
  }
}
assert.ok(knockSamples>40,'shoppers really pause at the shop threshold');
assert.equal(knockSlides,0,'a paused customer never walks on the spot');
assert.ok(counterApproaches>20&&counterArrivals>20,
  'shoppers approach a separate counter after knocking');
assert.ok(goodsDepartures>20,'goods leave in customer hands after service');

// The main plaza is now a working community economy: shoppers travel to
// counters, physically receive items, then walk away to use their purchases.
T.build(60624,'market');
const stallWorkers=T.movers().filter(m=>m.shopRole==='vendor');
const marketCustomers=T.movers().filter(m=>m.shopRole==='customer');
assert.equal(stallWorkers.length,2,'a baker and bookseller staff the real storefronts');
assert.equal(marketCustomers.length,3,'three independent shoppers form a small active market');
assert.ok(stallWorkers.every(m=>m.max===0&&m.x>7&&m.x<11&&m.y>8&&m.y<9),
  'shopkeepers remain grounded at their own storefront counters');
assert.ok(stallWorkers.every((m,i)=>Math.abs(m.x-(8.5+i))<.001&&Math.abs(m.y-8.12)<.001),
  'sellers stand behind the two facade-attached service windows');
const squareBench=T.props().find(p=>p.kind==='hero-bench');
assert.ok(squareBench&&Math.hypot(squareBench.x-7.38,squareBench.y-9.8)<.001,
  'simulation seating matches the west-edge bench');
const marketMetrics={peakHolding:0,peakService:0,furthestTravel:0};
for(let i=0;i<60*80;i++){
  T.update(1/60);
  marketMetrics.peakHolding=Math.max(marketMetrics.peakHolding,
    marketCustomers.filter(m=>m.carrying).length);
  marketMetrics.peakService=Math.max(marketMetrics.peakService,
    stallWorkers.filter(m=>m.shopAction==='serving').length);
  marketMetrics.furthestTravel=Math.max(marketMetrics.furthestTravel,
    ...marketCustomers.map(m=>m.travel||0));
  for(const buyer of marketCustomers)if(buyer.shopPhase==='receiving'){
    const worker=stallWorkers.find(w=>w.shopVenue===buyer.shopAt);
    assert.ok(worker&&Math.hypot(buyer.x-worker.x,buyer.y-worker.y)<.65,
      'a purchase occurs only face-to-face at the intended real storefront');
  }
}
assert.ok(T.debug().streetShopVisits>=8,'residents genuinely revisit shops');
assert.ok(T.debug().streetTransactions>=6,
  'bread and books actually exchange hands repeatedly');
assert.ok(marketMetrics.peakHolding>=1,'the purchaser physically holds the merchandise');
assert.ok(marketMetrics.peakService>=1,'staff perform distinct serving actions');
assert.ok(marketMetrics.furthestTravel>2,'visitors physically travel around the village');
const mood=T.newsThemes(['A football championship victory celebrated by fans'])[0];
assert.ok(T.reactToNews(mood),'a sourced matching headline triggers a town reaction');
assert.equal(T.debug().trade.mood,'cheer','the public story produces a specific social mood');
assert.ok(stallWorkers.some(m=>m.waveUntil>T.debug().clock),
  'clerks visibly greet the moment instead of leaving a headline unconnected');
assert.equal(T.debug().newsReactions,1,'news reactions are counted separately from fiction events');
assert.ok(T.debug().streetPerformances>=1,
  'the town hosts recurring physical concerts rather than silent decoration');
for(let i=0;i<60*9;i++)T.update(1/60);
assert.equal(T.debug().trade.mood,null,'news reactions expire instead of looping indefinitely');

// Canvas smoke: rich buildings, human poses and all event types must draw without errors.
// The same camera frame reuses its static ground buffer until the world changes.
const strokes = {groundDraws: 0, buffers: 0, screenBlits: 0, detailPaths: 0, gradients: 0};
const fakeContext = isGround => new Proxy({}, {get(_, key) {
  if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => {strokes.gradients++; return {addColorStop() {}};};
  if (key === 'beginPath') return () => {strokes.detailPaths++;};
  if (key === 'measureText') return txt => ({width: String(txt).length * 5});
  if (key === 'clearRect') return () => { if (isGround) strokes.groundDraws++; };
  if (key === 'drawImage') return () => { if (!isGround) strokes.screenBlits++; };
  return () => {};
}});
const fakeCanvas = isGround => ({width: 0, height: 0, style: {}, getContext: () => fakeContext(isGround)});
const sceneCanvas = fakeCanvas(false);
// Native mobile touch events are the primary Safari gesture path; desktop PointerEvents
// must not swallow or duplicate them.
const touchHandlers = {}, hostHandlers = {}, fallbackButtons = {};
let captured = 0, defaultBlocked = 0, singlePokes = 0;
const touchCanvas = {
  style: {}, getContext: () => fakeContext(false),
  getBoundingClientRect: () => ({left: 0, top: 0}),
  addEventListener: (name, handler) => {touchHandlers[name] = handler;},
  setPointerCapture: () => {captured++;}
};
const touchDoc = {getElementById: id => id === 'town' ? touchCanvas :
  ({textContent: '', style: {}, addEventListener:(name, handler) => {fallbackButtons[id] = handler;}}),
  createElement: () => fakeCanvas(true)};
const touchCtx = vm.createContext({
  document:touchDoc, window:{}, location:{origin:'https://example.test',hash:'#new'},
  innerWidth:390,innerHeight:844,devicePixelRatio:2,
  Math,Object,Array,JSON,Date,String,Number,RegExp,
  requestAnimationFrame:()=>0,setTimeout:()=>0,
  addEventListener:(name,handler)=>{(hostHandlers[name] ||= []).push(handler);}
});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'))+';this.T=ToyTown;', touchCtx);
const phone = touchCtx.T;
phone.layout(); phone.build(2026,'weather');
touchHandlers.pointerdown({pointerType:'touch',pointerId:7,clientX:100,clientY:200});
assert.equal(captured,0,'iPhone taps do not call pointer capture');
const point=(x,y)=>({clientX:x,clientY:y});
const ev=touches=>({touches,changedTouches:touches,preventDefault(){defaultBlocked++}});
touchHandlers.touchstart(ev([point(90,200)]));
touchHandlers.touchstart(ev([point(90,200),point(190,200)]));
const initialZoom=phone.debug().cam.z;
touchHandlers.touchmove(ev([point(90,200),point(260,200)]));
assert.ok(phone.debug().cam.z>initialZoom*1.5,'native iOS pinch enlarges the city');
const beforeRelease=phone.events().length;
touchHandlers.touchend(ev([]));
assert.equal(phone.events().length,beforeRelease,'pinch release is not a tap');
touchHandlers.touchstart(ev([point(120,270)]));
touchHandlers.touchend({touches:[],changedTouches:[point(120,270)],preventDefault(){defaultBlocked++}});
assert.ok(phone.events().length>beforeRelease,'single-finger tap still works');
assert.ok(defaultBlocked>=4,'touch gestures suppress browser scrolling');
const zoomBeforeButton=phone.debug().cam.z;
hostHandlers.message.forEach(fn=>fn({origin:'https://example.test',data:{type:'town:zoom',factor:1.4}}));
for(let k=0;k<90;k++)phone.update(1/60);
assert.ok(phone.debug().cam.z>zoomBeforeButton,'zoom button on main page reaches iframe');
const beforeForeign=phone.debug().cam.tz;
hostHandlers.message.forEach(fn=>fn({origin:'https://untrusted.test',data:{type:'town:zoom',factor:.5}}));
assert.equal(phone.debug().cam.tz,beforeForeign,'foreign frame message ignored');
hostHandlers.message.forEach(fn=>fn({origin:'https://example.test',data:{type:'town:fit'}}));
for(let k=0;k<90;k++)phone.update(1/60);
assert.ok(phone.fitView()<.8,'Fit fits the whole city on a narrow phone');
assert.ok(Math.abs(phone.debug().cam.z-phone.fitView())<.02,'parent Fit uses mobile fit scale');
assert.ok(fallbackButtons['zoom-in']&&fallbackButtons['zoom-out']&&fallbackButtons['zoom-reset'],
 'standalone fallback zoom controls remain wired');


const sceneDoc = {
  getElementById: id => id === 'town' ? sceneCanvas : {textContent: '', style: {}},
  createElement: tag => { assert.equal(tag, 'canvas'); strokes.buffers++; return fakeCanvas(true); }
};
const drawBox = vm.createContext({Math, Object, Array, JSON, Date, String, Number, RegExp, document: sceneDoc, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, setTimeout: () => 0});
vm.runInContext((dioramaSource + '\n' + fs.readFileSync(path.join(root, 'assets/toy-town.js'), 'utf8')) + ';this.T = ToyTown;', drawBox);
const scene = drawBox.T;
scene.layout(); scene.build(2026, 'sports'); scene.decorate([scene.VARIANTS.find(v => v.variant === 'cricket')]);
scene.render(); scene.render();
assert.ok(strokes.detailPaths > 100, 'miniature buildings use layered projected outlines');
assert.ok(strokes.gradients > 40, 'glazing, soft shadows and foliage use tonal shading');
assert.equal(strokes.buffers, 1, 'only one backing canvas is allocated');
assert.equal(strokes.groundDraws, 1, 'static ground is not redrawn each idle frame');
assert.equal(strokes.screenBlits, 2, 'cached ground is blitted each frame');
scene.build(2027, 'festival'); scene.decorate([scene.VARIANTS.find(v => v.variant === 'halloween')]);
scene.render();
assert.equal(strokes.groundDraws, 2, 'new town invalidates static ground');
for (const key of Object.keys(scene.THEMES)) { scene.build(4242, key); scene.render(); }
assert.ok(strokes.screenBlits >= 12, 'all themed scenes complete a render pass');
scene.pinchTo(3.2, 640, 360, {x: 9, y: 9});
const previousPaths = strokes.detailPaths;
scene.render();
assert.ok(strokes.detailPaths > previousPaths, 'diorama geometry draws at close zoom');
scene.pinchTo(.55, 640, 360, {x: 9, y: 9});
scene.render();

// Hero neighborhood remains central and landscaped on every seed, while the
// surrounding plots still respond to the day's theme.
const hero = scene.hero();
assert.ok(hero && hero.xa === 7 && hero.ya === 7 && hero.type === 'hero', 'hero neighborhood stays central');
const heroBuildings = scene.buildings().filter(b => b.hero);
assert.equal(heroBuildings.length, 5, 'hero block has five individually placed buildings');
assert.equal(heroBuildings.filter(b => b.kind === 'shop').length, 2, 'hero block includes two small shops');
assert.equal(heroBuildings.filter(b => b.kind === 'house').length, 3, 'hero block includes three homes');
const heroProps = scene.props().filter(p => p.kind.startsWith('hero-'));
for (const k of ['hero-bench','hero-table','hero-lamp','hero-mail','hero-rack','hero-shrub'])
  assert.ok(heroProps.some(p => p.kind === k), k + ' furniture is present');
assert.ok(heroProps.every(p => p.x >= hero.xa && p.x < hero.xb + 1 &&
  p.y >= hero.ya && p.y < hero.yb + 1), 'each decorative object sits within the central block');
const locals = scene.movers().filter(m => m.heroResident);
assert.equal(locals.length, 3, 'three neighbors follow local neighborhood routes');
for (let k = 0; k < 60 * 75; k++) scene.update(1 / 60);
assert.ok(locals.every(m => m.x > hero.xa && m.x < hero.xb + 1 &&
  m.y > hero.ya && m.y < hero.yb + 2.3 && Number.isFinite(m.x + m.y)),
  'residents stay on the neighborhood paths and marked crossing');
assert.ok(locals.every(m => m.heroIndex >= 2), 'residents reach multiple real destinations');
assert.ok(locals.some(m => m.heroStops.some(p => p.cross)), 'a resident has a marked riverside crossing');
// A car approaches the crosswalk while a resident is already crossing:
const crossingWalker = locals[0];
const crossingCar = scene.movers().find(m => m.type === 'car' && m.kind === 'car');
assert.ok(crossingCar, 'ordinary traffic is present for crossing test');
crossingWalker.x = hero.xa + 1.5; crossingWalker.y = hero.yb + 1.1;
crossingWalker.crossing = true; crossingWalker.stopUntil = 0;
crossingWalker.path = [{x:hero.xa + 1.5, y:hero.yb + 1.85, speed:.18}];
crossingCar.x = hero.xa + .5; crossingCar.y = hero.yb + 1.5;
crossingCar.d = 0; crossingCar.v = .8; crossingCar.max = 1.3;
scene.update(.10);
assert.ok(crossingCar.v < .8, 'driver slows for a pedestrian on the zebra crossing');
crossingWalker.crossing = false; crossingWalker.path = null; crossingWalker.stopUntil = scene.debug().clock + 1;

assert.ok(locals.some(m => m.heroStops.some(p => p.sit)), 'benches are activity destinations');
scene.render();
const oldHero = scene.hero();
scene.build(654321, 'market');
assert.equal(scene.hero().type, 'hero', 'a different news theme retains the hero neighborhood');
assert.equal(scene.buildings().filter(b => b.hero).length, heroBuildings.length,
  'theme changes retain the same neighborhood architecture');
assert.ok(oldHero !== scene.hero(), 'a new town creates fresh block references');

// Camera zoom is bounded, preserves a focal world point, and can reset to fit.
scene.resetView();
for (let i = 0; i < 90; i++) scene.update(1 / 60);
const beforeZoom = scene.screenWorld(800, 300), oldZoom = scene.debug().cam.z;
scene.zoomAt(1.7, 800, 300);
for (let i = 0; i < 90; i++) scene.update(1 / 60);
assert.ok(scene.debug().cam.z > oldZoom * 1.65, 'zoom in gets closer');
const afterZoom = scene.screenWorld(800, 300);
assert.ok(Math.hypot(beforeZoom.x - afterZoom.x, beforeZoom.y - afterZoom.y) < .02,
  'wheel zoom keeps the same world point beneath the cursor');
scene.zoomAt(.2, 800, 300);
for (let i = 0; i < 90; i++) scene.update(1 / 60);
assert.ok(scene.debug().cam.z < .7, 'zoom out sees more of the town');
scene.pinchTo(100, 640, 360, {x: 9, y: 9});
assert.ok(scene.debug().cam.z <= 3.25, 'pinch maximum is clamped');
scene.pinchTo(.01, 640, 360, {x: 9, y: 9});
assert.ok(scene.debug().cam.z >= .42, 'pinch minimum is clamped');
scene.resetView();
for (let i = 0; i < 90; i++) scene.update(1 / 60);
assert.ok(Math.abs(scene.debug().cam.z - 1) < .02, 'Fit restores starting zoom');
assert.ok(Math.abs(scene.debug().cam.x - 9) < .02 && Math.abs(scene.debug().cam.y - 9) < .02,
  'Fit recentres the whole town');
scene.setPlaying(false); scene.zoomAt(1.25); // controls still work while paused
assert.ok(scene.debug().cam.z > 1.2, 'zoom controls work while paused');
scene.setPlaying(true);

// Neighborhood encounters use nearby shops, rather than placing floating scenes.
scene.build(12457, 'weather');
const walkersWithAccessories = scene.movers().filter(m => m.type === 'person' && !m.kind)
  .filter(m => m.hat || m.bag || m.scarf);
assert.ok(walkersWithAccessories.length >= 1, 'neighbors have varied outfits');
const shop = scene.buildings().find(b => b.kind === 'shop');
const neighbor = scene.movers().find(m => m.type === 'person' && !m.kind);
assert.ok(shop && neighbor, 'shop and neighbor exist');
neighbor.x = shop.x + .5; neighbor.y = shop.y + .5;
assert.ok(scene.streetMoment(), 'a nearby person can stop to greet a shop');
assert.equal(scene.debug().streetMoments, 1, 'shop encounter increments the town moment counter');
scene.render();
const townPage = fs.readFileSync(path.join(root, 'toy-town.html'), 'utf8');
for (const id of ['zoom-in', 'zoom-out', 'zoom-reset']) {
  assert.match(townPage, new RegExp('id="' + id + '"[^>]*aria-label="[^"]+"'), id + ' is accessible');
}
assert.match(townPage, /toy-town\.js\?v=49/, 'diorama engine is loaded');
assert.match(townPage, /toy-town-news\.js\?v=2/, 'sourced news loads before the simulation');
assert.match(townPage, /HEADLINES/, 'real reporting has a dedicated source panel');
assert.match(townPage, /AROUND TOWN · FICTION/, 'fiction and real news are explicitly separated');
assert.ok(townPage.indexOf('toy-town-news.js')<townPage.indexOf('toy-town.js'),
  'the news client is initialized before the town engine');
assert.match(townPage, /toy-town-diorama\.js\?v=1/, 'diorama is loaded before the engine');
assert.match(townPage, /id="town-3d"/, 'WebGL mounts into its own overlay');
assert.match(townPage, /pointer-events:none/, 'WebGL overlay allows iPhone touch gestures through to original canvas');
assert.match(townPage, /WebGL2RenderingContext/, '3D is only attempted on supported browsers');
assert.match(townPage, /classic/, 'original 2D scene remains selectable with classic URL option');
assert.match(townPage, /three@0\.187\.0/, '3D package is pinned to a reproducible version');
assert.match(townPage, /\.catch\(error => console\.warn/, '3D dependency failure falls back to the original renderer');
assert.match(fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'),
  /window\.ToyTown3D\?\.active/, 'classic simulation skips redundant Canvas rendering only when WebGL is active');

assert.ok(townPage.indexOf('toy-town-diorama.js') < townPage.indexOf('toy-town.js'),
  'material renderer loads before the world engine');
assert.match(fs.readFileSync(path.join(root,'assets/toy-town.js'),'utf8'),
  /cam.z = cam.tz = innerWidth < 700 \? 1\.52 : 1\.72/,
  'opening view frames the village more closely');

assert.match(html, /id="town-zoom"/, 'zoom controls live outside the iframe');
assert.match(html, /id="town-fit"/, 'mobile has a fit-the-city button');
assert.match(html, /town:zoom/, 'outer buttons message the city');
assert.match(townPage, /embedded/, 'embedded page hides duplicate controls');


// Residents should face the next pavement leg before stepping sideways.
T.build(72044,'weather');
const cornerWalker=T.movers().find(m=>m.type==='person'&&!m.kind&&!m.heroResident&&!m.shopRole);
assert.ok(cornerWalker,'the town provides a free walker to test turning');
Object.assign(cornerWalker,{x:3,y:6.5,lane:0,d:0,path:[{x:3,y:7.7,speed:.5,dry:true}],
  busy:true,max:.5,v:0,moved:0,travel:0,stopUntil:0,intent:'destination'});
const pivotAt={x:cornerWalker.x,y:cornerWalker.y,travel:cornerWalker.travel};
T.update(1/60);
assert.equal(cornerWalker.d,2,'a southbound pavement leg selects the correct facing');
assert.ok(!(cornerWalker.turnPauseUntil>T.debug().clock),'an ordinary 90-degree corner is taken on the move, no pause');
for(let i=0;i<30;i++)T.update(1/60);
assert.ok(cornerWalker.y>pivotAt.y+.1,'the walker is already walking round the corner');
assert.ok(cornerWalker.travel>pivotAt.travel,'and the gait runs while turning');
assert.ok(Math.abs(cornerWalker.walkFacing)<.15,'the drawn heading has swung round to the new direction');
// Turning right round is the one case that stops: the walker pivots on the spot first.
Object.assign(cornerWalker,{x:3,y:6.5,lane:0,d:0,walkFacing:Math.PI/2,path:[{x:2,y:6.5,speed:.5,dry:true}],
  busy:true,max:.5,v:0,moved:0,travel:0,stopUntil:0,intent:'destination',turnPauseUntil:0});
const reverseAt={x:cornerWalker.x,travel:cornerWalker.travel};
T.update(1/60);
assert.ok(cornerWalker.turnPauseUntil>T.debug().clock,'turning right round pauses to pivot');
for(let i=0;i<10;i++)T.update(1/60);
assert.equal(cornerWalker.x,reverseAt.x,'the pivot does not slide the walker');
assert.equal(cornerWalker.travel,reverseAt.travel,'a pivot does not advance the footstep animation');
for(let i=0;i<60;i++)T.update(1/60);
assert.ok(cornerWalker.x<reverseAt.x,'the walker sets off after the pivot');

// Diagonal legs should have a matching 3D facing, not a sideways shuffle.
T.build(72144,'weather');
const diagonalWalker=T.movers().find(m=>m.type==='person'&&!m.kind&&!m.heroResident&&!m.shopRole);
Object.assign(diagonalWalker,{x:3,y:6.5,d:0,lane:0,busy:true,v:0,moved:0,travel:0,
  path:[{x:4,y:7.5,speed:.5,dry:true}],stopUntil:0,intent:'destination'});
for(let i=0;i<40;i++)T.update(1/60);
assert.ok(Math.abs(diagonalWalker.walkFacing-Math.PI/4)<.05,
  'diagonal route heading settles on the actual displacement vector');
assert.ok(diagonalWalker.x>3.1&&diagonalWalker.y>6.6,'the diagonal walker moves along it, not sideways first');

// Brief sidewalk chats should happen at a real meeting distance, not across a road.
T.build(72530,'weather');
const socialCandidates=T.movers().filter(m=>m.type==='person'&&!m.kind&&!m.heroResident&&!m.shopRole&&!m.routine);
assert.ok(socialCandidates.length>=2,'the town has two free walkers');
for(const m of socialCandidates)m.greetNext=Number.POSITIVE_INFINITY;
const [palA,palB]=socialCandidates;
for(const [i,m] of [palA,palB].entries())Object.assign(m,{
  x:3+i*.36,y:6.5,d:0,lane:.43,v:.5,max:.5,path:null,busy:false,
  stopUntil:0,sit:false,whim:null,whimUntil:0,routine:null,greetNext:0,
  nextNotice:Number.POSITIVE_INFINITY,nextDawdle:Number.POSITIVE_INFINITY,intent:'walking'});
T.update(1/60);
assert.ok(palA.briefChatUntil>T.debug().clock&&palB.briefChatUntil>T.debug().clock,
  'nearby walkers on the same pavement stop for a real chat');
assert.equal(palA.intent,'chat');assert.equal(palB.intent,'chat');
const chatDistance=[palA.travel,palB.travel];
for(let i=0;i<60;i++)T.update(1/60);
assert.equal(palA.travel,chatDistance[0],'a stopped talker does not walk in place');
assert.equal(palB.travel,chatDistance[1],'both talkers keep stationary foot contact');
for(let i=0;i<220;i++)T.update(1/60);
assert.equal(palA.briefChatUntil,0,'the conversation ends without a frozen resident');
assert.equal(palB.briefChatUntil,0,'both walkers are released');

// Same road centre is NOT the same pavement: no chat across the carriageway.
T.build(72531,'weather');
const acrossRoad=T.movers().filter(m=>m.type==='person'&&!m.kind&&!m.heroResident&&!m.shopRole&&!m.routine);
for(const m of acrossRoad)m.greetNext=Number.POSITIVE_INFINITY;
const [leftWalker,rightWalker]=acrossRoad;
for(const [i,m] of [leftWalker,rightWalker].entries())Object.assign(m,{
  x:3+i*.1,y:6.5,d:0,lane:i===0?-.43:.43,v:.5,max:.5,
  path:null,busy:false,stopUntil:0,sit:false,whim:null,whimUntil:0,routine:null,
  greetNext:0,nextDawdle:Number.POSITIVE_INFINITY,nextNotice:Number.POSITIVE_INFINITY});
T.update(1/60);
assert.ok(!leftWalker.briefChatUntil&&!rightWalker.briefChatUntil,
  'walkers on opposite pavements do not talk across moving cars');

// A calm town: gentle moments run to their end, and traffic waits at red lights instead of piling into the crossings.
// Isolate this stochastic traffic fixture from random draws made by earlier
// scenario tests (e.g. the number of trips to a repositioned shop). Keep the
// existing default seed, TT_SEED override, duration and collision threshold.
seedScenarioRandom();
T.build(31337, 'weather'); T.setToday([]);
for (const name of T.CALM) T.startEvent(name);
let clashes = 0, samples = 0;
for (let i = 0; i < 60 * 120; i++) {
  T.update(1 / 60);
  if (i % 30) continue;
  const cars = T.movers().filter(m => m.type === 'car' && !m.path);
  for (const a of cars) for (const b of cars) if (a !== b && (a.d < 2) !== (b.d < 2) && Math.hypot(a.x - b.x, a.y - b.y) < .3) clashes++;
  samples++;
}
// Random traffic: typically 0-3% of samples, with an occasional tail (CI once landed exactly on 5%), so the limit is 10%: a real pile-up is far higher.
assert.ok(clashes / samples < .10, `cross traffic rarely meets in a crossing (${clashes} near misses in ${samples} samples)`);
assert.ok(T.events().length <= 6, 'the gentle moments end too');
// The simulation is slow, but daylight/night cycle still lasts five real minutes.
const dayCycle = 300 * T.PACE, phase = T.debug().clock % dayCycle;
T.update((dayCycle / 2 - phase + dayCycle) % dayCycle);
assert.ok(T.debug().night > .99, 'night halfway through the real-time cycle');
T.update(dayCycle / 2);
assert.ok(T.debug().night < .01, 'daylight returns after a five-minute cycle');

// Follow-up 16: every light headline gets a scene, on a rotation; vehicles never re-turn every frame; runners wear sports kit.
{
  const heads=['Geothermal Utilities Power Wave of US Affordable Housing with 40% Energy Savings','Wales scraps controversial Uganda tree-planting scheme',"'We have our own fair playing field': 1Xtra launches first ever UK rap chart",'England secure group top spot with Ireland win','Elon Musk appears to signal the end of the road for Cybertruck','PM tells firms to publish salaries in job adverts ahead of new law',"Zambia's civil service overhaul raises questions",'What went right this week: the good news that matters','APOD: 2026 November 6 – A Farewell to Swift'];
  const want=['green','trees','music','football','cars','jobs','vote','goodnews','comet'];
  heads.forEach((h,i)=>assert.equal(T.stageFor(h).variant,want[i],'headline maps to its scene: '+h));
  assert.equal(T.stageFor('Something odd happened somewhere').fallback,true,'an unmatched headline still gets the newspaper seller');
  T.build(52045,'market');T.setNews(heads.map(title=>({title,source:'Test',tone:'light'})));
  assert.equal(T.programme().length,heads.slice(0,6).length,'one staged scene per light headline (max six)');
  for(const v of ['jobs','trees','green','gallery','health','food','school','goodnews','cars','jogger','dogwalk','wedding'])
    assert.ok(T.VARIANT_EVENTS().includes(v)||T.CALM.includes(v),'scene exists: '+v);
  const seen=new Set();
  for(let i=0;i<60*400;i++){T.update(1/60);for(const e of T.events())if(!seen.has(e)){seen.add(e);}}
  const names=[...seen].map(e=>e.name);
  for(const p of T.programme())assert.ok(names.includes(p.variant),'the rotation staged '+p.variant);
  assert.ok(new Set(names).size>=10,'plenty of different scenes in a few minutes ('+new Set(names).size+')');
  const run=T.startEvent('marathon');assert.ok(run);
  const kit=T.movers().filter(m=>m.kind==='runner');assert.ok(kit.length>=7&&kit.every(m=>m.sports&&!m.hat&&!m.bag&&m.trousers),'marathon runners wear running kit');
  assert.ok(new Set(kit.map(m=>m.col)).size>=4,'in different colours');
  const staged=T.stageHeadline(heads[3]);assert.ok(staged&&staged.name==='football','the crier reading a headline stages that headline');
}
{
  // A vehicle that has just turned at a junction centre must not turn again on the next frame (the flicker at road ends and junctions).
  T.build(52045,'market');
  const last=new Map();let flips=0,frames=0;
  for(let i=0;i<60*240;i++){T.update(1/60);for(const m of T.movers()){if(m.type!=='car'||m.path)continue;const p=last.get(m);if(p&&p.d!==m.d){if(p.turnedAt===i-1||p.turnedAt===i-2)flips++;p.turnedAt=i;}last.set(m,{d:m.d,turnedAt:(p&&p.d!==m.d)?i:(p?p.turnedAt:-9)});frames++;}}
  assert.equal(flips,0,'no vehicle turns again on the frame after turning ('+flips+')');
}
console.log(`Toy Town PASS: ${T.VARIANTS.length} news variants (cricket to Diwali to dinosaurs) each with its own event, grim stories never become themes, light ones pick ${Object.keys(T.THEMES).length - 1} kinds of day, the same day builds the same town with its theme block and fire station, and every event in every theme runs to its end with the streets kept busy.`);
