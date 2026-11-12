(()=>{'use strict';
const M=window.LittleSeasons,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const state={place:M.locations.sanford,data:null,mode:'live',status:'loading',failed:false,fahrenheit:false,season:'spring',temperature:8,weather:'clear',night:false,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,phase:0,house:null,fetchStart:-99,treeStart:-99,pondStart:-99};
let requestId=0,controller=null,last=0,frameId=0,walkTime=0,walkDistance=0;
const set=(id,attr,v)=>$(id).setAttribute(attr,String(v));
function el(name,attrs,parent){const e=document.createElementNS(NS,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent.appendChild(e);return e;}
function text(id,value){$(id).textContent=value;}
function time(value,zone=state.data?.zone||state.place.zone){return new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}).format(new Date(value));}
function say(message){text('scene-story',message);}
const icons={clear:'☀',cloud:'☁',rain:'☂',snow:'❄',fog:'≋',unknown:'—'};
const stars=Array.from({length:36},(_,i)=>el('circle',{cx:30+i*79%540,cy:90+i*43%220,r:.8+i%3*.4,fill:'#fff2c8',opacity:0},$('stars')));
const foliage=Array.from({length:23},(_,i)=>{const a=i*2.39996,r=18+Math.sqrt(i/23)*68;return el('circle',{cx:275+Math.cos(a)*r,cy:278+Math.sin(a)*r*.8,r:7+i%4*2,fill:'#648b76'},$('leaves'));});
const blossoms=Array.from({length:22},(_,i)=>el('circle',{cx:207+i*37%130,cy:211+i*53%125,r:2.7+i%3,fill:i%2?'#f4dbd7':'#eed1c1'},$('blossoms')));
const flowers=Array.from({length:24},(_,i)=>{const g=el('g',{transform:`translate(${20+i*73%565} ${402+i*37%43})`},$('flowers'));el('path',{d:'M0 0v-7',stroke:'#527357','stroke-width':1.6},g);el('circle',{cx:0,cy:-9,r:2.5,fill:i%3?'#eddaa3':'#eab8b0'},g);return g;});
const birds=Array.from({length:4},()=>el('path',{d:'M0 0q6-7 12 0q6-7 12 0',stroke:'#436b5f','stroke-width':2,fill:'none'},$('wildlife')));
const drops=Array.from({length:65},()=>el('path',{d:'M0 0l-3 10',stroke:'#edf5e7','stroke-width':1.2,opacity:.5},$('weather')));
const flakes=Array.from({length:40},(_,i)=>el('circle',{r:1.4+i%3*.6,fill:'#fff9e8'},$('weather')));
const fireflies=Array.from({length:18},(_,i)=>el('circle',{r:1.4+i%3*.3,fill:'#fff0a3',opacity:0},$('tiny-fireflies')));
const petals=Array.from({length:24},(_,i)=>el('ellipse',{rx:2+i%3,ry:3.5+i%2,fill:'#f2cfcd'},$('spring-petals')));
const fallingLeaves=Array.from({length:22},(_,i)=>el('ellipse',{rx:2.5+i%3,ry:5+i%2,fill:['#ce8e4d','#deb967','#b67d56'][i%3]},$('autumn-leaves')));
const butterflies=Array.from({length:4},(_,i)=>{const g=el('g',{},$('tiny-butterflies'));el('path',{d:'M0 0q-11-12-9-2q4 6 9 2q8-15 10-4q-1 8-10 4Z',fill:i%2?'#efd49c':'#e7ad91',stroke:'#889373','stroke-width':1},g);return g;});
const rings=Array.from({length:5},()=>el('ellipse',{cx:440,cy:438,rx:0,ry:0,stroke:'#eff7da','stroke-width':1.6,fill:'none',opacity:0},$('touch-effects')));
const crumbs=Array.from({length:8},(_,i)=>el('circle',{cx:430+i*5,cy:436+i%3*3,r:1.8,fill:'#f7deb0',opacity:0},$('touch-effects')));
for(let i=0;i<60;i++){const a=i*Math.PI/30;el('path',{d:`M${300+Math.sin(a)*279} ${300-Math.cos(a)*279}L${300+Math.sin(a)*(i%5?276:271)} ${300-Math.cos(a)*(i%5?276:271)}`,stroke:'#527360','stroke-width':i%5?1:2,opacity:.45},$('dial-ticks'));}
const palettes={spring:{sky:['#ecedce','#b9d9c5'],grass:'#a3be8b',leaf:['#98bb8f','#b8cc99','#88ab7e','#bdcd9c'],word:'BLOSSOM'},summer:{sky:['#f3edce','#a5d2c5'],grass:'#8db47a',leaf:['#65945f','#82aa6a','#5d8957','#a4ba78'],word:'SUNLIT'},autumn:{sky:['#efe2bd','#c9ccaa'],grass:'#b6ac7c',leaf:['#cc995c','#b77c52','#dbb276','#c28d5f'],word:'GOLDEN'},winter:{sky:['#e5edef','#aec8d1'],grass:'#dbe4d8',leaf:['#b1c1ad','#b1c1ad','#b1c1ad','#b1c1ad'],word:'STILL'}};
function syncWorld(){
 if(state.mode==='live'&&state.data){state.temperature=state.data.current.temperature_2m;state.season=M.seasonAt(new Date(),state.place.lat,state.data.zone);state.weather=M.weatherKind(state.data.current.weather_code);state.night=M.daylight(state.data).night;}
 const p=palettes[state.season],winter=state.season==='winter',spring=state.season==='spring';
 $('background').setAttribute('fill','url(#sky)');const stops=$('sky').querySelectorAll('stop');stops[0].setAttribute('stop-color',state.night?'#9dbdc0':p.sky[0]);stops[1].setAttribute('stop-color',state.night?'#628e9a':p.sky[1]);
 set('meadow-base','fill',p.grass);set('canopy','opacity',winter?0:1);$('canopy').querySelectorAll('ellipse,circle').forEach((e,i)=>e.setAttribute('fill',p.leaf[i%4]));foliage.forEach((e,i)=>{e.style.display=winter?'none':'';e.setAttribute('fill',p.leaf[i%4]);});
 blossoms.forEach(e=>e.style.display=spring?'':'none');flowers.forEach(e=>e.setAttribute('opacity',winter?.08:1));set('tree-highlights','opacity',winter?0:.5);
 // Snow depends on conditions, not merely the calendar season.
 const frozen=state.temperature<=0,snowy=state.weather==='snow';$('snowbank').firstElementChild.setAttribute('opacity',snowy?.78:0);$('pond').querySelector('ellipse').setAttribute('fill',frozen?'#d7e5df':'#96c3ad');set('pond-detail','opacity',frozen?.45:1);set('floating-ducks','opacity',frozen?0:1);
 set('night-shade','opacity',state.night?.28:0);set('sun','opacity',state.night?(state.weather==='clear'?.8:.2):state.weather==='cloud'?.35:state.weather==='rain'?.2:1);$('sun').querySelector('circle').setAttribute('fill',state.night?'#f4e9ba':'#e9cb7a');$('sun').querySelector('g').setAttribute('opacity',state.night?0:1);set('sun-aura','opacity',state.night?.12:.65);set('fog','opacity',state.weather==='fog'?.42:0);set('clouds','opacity',state.weather==='clear'?.5:.95);
 document.body.dataset.night=state.night;set('scene-labels','fill',state.night?'#e3e7ce':'#496e59');text('temp',state.mode==='live'&&!state.data?'—°':M.temperature(state.temperature,state.fahrenheit));text('state',state.mode==='live'&&!state.data?(state.status==='loading'?'CONNECTING TO WEATHER':'WEATHER UNAVAILABLE'):`${state.mode==='preview'?'PREVIEW · ':''}${state.season.toUpperCase()} · ${state.night?'NIGHT':state.weather.toUpperCase()}`);
 text('slider-value',M.temperature(state.temperature,state.fahrenheit));$('temperature').value=state.temperature;text('day-night',state.night?'Try daytime':'Try night');$('preview-weather').value=state.weather==='cloud'||state.weather==='unknown'?'clear':state.weather;
 document.querySelectorAll('[data-season]').forEach(b=>b.setAttribute('aria-pressed',String(state.mode==='preview'&&state.season===b.dataset.season)));
 text('scene-mode',state.mode==='preview'?'YOUR IMAGINATION':state.status==='fresh'?'FOLLOWING THE WEATHER':state.status==='loading'?'CONNECTING TO WEATHER':'WEATHER UNAVAILABLE');
}
function renderData(){
 const d=state.data,now=Date.now(),fresh=d&&M.freshness(d,now)==='fresh';state.status=state.mode==='preview'?'preview':state.failed?'offline':!d?(controller?'loading':'offline'):fresh?'fresh':'stale';
 document.body.dataset.status=state.status;text('data-badge',{preview:'IMAGINED WEATHER · PREVIEW',fresh:'LIVE WEATHER · MODEL ESTIMATE',stale:'OLDER WEATHER · NOT LIVE',offline:'WEATHER UNAVAILABLE',loading:'CONNECTING'}[state.status]);
 text('scene-place',state.place.name.toUpperCase());text('unit',state.fahrenheit?'°F / °C':'°C / °F');$('unit').setAttribute('aria-label',`Switch temperature to ${state.fahrenheit?'Celsius':'Fahrenheit'}`);
 const zone=d?.zone||state.place.zone;text('scene-clock',time(now,zone));text('local-date',new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'short',day:'numeric'}).format(now)+' · '+time(now,zone));
 text('condition',state.mode==='preview'?`Imagined ${state.season}`:d?M.description(d.current.weather_code):state.status==='loading'?'Finding your weather…':'Weather unavailable');
 const preview=state.mode==='preview';text('feels',!preview&&d?M.temperature(d.current.apparent_temperature,state.fahrenheit):'—');text('wind',!preview&&M.finite(d?.current.wind_speed_10m)?Math.round(d.current.wind_speed_10m)+' km/h':'—');text('humidity',!preview&&M.finite(d?.current.relative_humidity_2m)?Math.round(d.current.relative_humidity_2m)+'%':'—');
 const day=M.daylight(d,now);text('sunrise',day.known?time(day.rise):'—');text('sunset',day.known?time(day.set):'—');$('daylight-progress').style.width=(day.progress*100)+'%';text('daylight-caption',preview?'Sunrise and sunset above are real; this scene is a preview.':day.known?(day.night?'The little world is under its evening sky.':'Daylight follows the local sun.'):'Daylight data is unavailable.');
 const forecast=$('forecast');forecast.replaceChildren();if(preview||!d?.hourly.length){const p=document.createElement('p');p.textContent=preview?'Return to live weather to see the forecast.':'Hourly forecast unavailable.';forecast.append(p);}else for(const h of d.hourly.filter(h=>h.time*1000>=now)){
  const item=document.createElement('article'),stamp=document.createElement('time'),icon=document.createElement('span'),value=document.createElement('b');stamp.dateTime=new Date(h.time*1000).toISOString();stamp.textContent=time(h.time*1000).replace(':00','');icon.className='weather-icon';icon.textContent=h.day===0&&M.weatherKind(h.code)==='clear'?'☾':icons[M.weatherKind(h.code)];icon.setAttribute('aria-label',M.description(h.code));value.textContent=M.temperature(h.temp,state.fahrenheit);item.append(stamp,icon,value);forecast.append(item);
 }
 text('data-status',preview?'Preview only — no simulated values are presented as live.':d?`${state.failed?'Refresh failed · ':fresh?'':'Older data · '}Conditions ${time(d.current.time*1000)} · fetched ${time(d.fetchedAt)}${fresh?'':' · refresh needed'}`:controller?'Fetching current conditions…':'Could not load weather. Refresh or try a season preview.');
 syncWorld();
}
async function refresh(){
 const id=++requestId;controller?.abort();controller=new AbortController();const current=controller,place=state.place;state.failed=false;$('refresh').disabled=true;renderData();const timeout=setTimeout(()=>current.abort(),12000);
 try{const response=await fetch(M.urlFor(place),{signal:current.signal});if(!response.ok)throw Error('Weather unavailable');const data=M.parse(await response.json());if(id!==requestId)return;state.data=data;state.failed=false;}
 catch(error){if(id!==requestId)return;state.failed=true;}
 finally{clearTimeout(timeout);if(id===requestId){controller=null;$('refresh').disabled=false;renderData();}}
}
function enterPreview(){const first=state.mode!=='preview';state.mode='preview';state.failed=false;if(first&&!state.data){state.season='spring';state.temperature=8;state.weather='clear';state.night=false;}}
function action(name){
 if(name==='house'){state.house=!(state.house===null?state.night:state.house);say(state.house?'A warm light in the window. Someone’s home.':'Lights out. The cottage settles down.');}
 if(name==='tree'){state.treeStart=state.phase;say(state.season==='winter'?'A small shiver runs through the bare branches.':'A little breeze, a little shower of leaves.');}
 if(name==='pond'){state.pondStart=state.phase;say(state.temperature<=0?'The pond is frozen. The ducks are keeping warm.':'A few crumbs, and the ducks paddle over.');}
 if(name==='dog'&&state.phase-state.fetchStart>=fetchDuration){state.fetchStart=state.phase;say('One throw. One very happy dog.');}
 if(state.paused){draw(state.phase);say('Motion is paused. Resume motion to watch the little world respond.');}
}
document.querySelectorAll('[data-action]').forEach(e=>{e.addEventListener('click',()=>action(e.dataset.action));if(e.namespaceURI===NS)e.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action(e.dataset.action);}});});
document.querySelectorAll('[data-season]').forEach(b=>b.addEventListener('click',()=>{enterPreview();state.season=b.dataset.season;state.temperature={spring:14,summer:27,autumn:12,winter:-4}[state.season];state.weather=state.season==='winter'?'snow':'clear';renderData();say(`${state.season[0].toUpperCase()+state.season.slice(1)} in your little world. This is a preview.`);}));
$('temperature').addEventListener('input',e=>{enterPreview();state.temperature=Number(e.target.value);renderData();});$('preview-weather').addEventListener('change',e=>{enterPreview();state.weather=e.target.value;renderData();});$('day-night').addEventListener('click',()=>{enterPreview();state.night=!state.night;state.house=null;renderData();});
$('live').addEventListener('click',()=>{state.mode='live';state.house=null;renderData();refresh();say('Back to the world outside.');});$('refresh').addEventListener('click',refresh);$('unit').addEventListener('click',()=>{state.fahrenheit=!state.fahrenheit;renderData();});
$('location').addEventListener('change',e=>{state.place=M.locations[e.target.value];state.data=null;state.mode='live';state.house=null;refresh();});
$('locate').addEventListener('click',()=>{
 if(!navigator.geolocation){say('Location isn’t available. Choose a city from the list.');return;}$('locate').disabled=true;say('Your browser will ask to use your location for weather.');
 navigator.geolocation.getCurrentPosition(pos=>{state.place={name:'Your location',lat:pos.coords.latitude,lon:pos.coords.longitude,zone:Intl.DateTimeFormat().resolvedOptions().timeZone};state.data=null;state.mode='live';state.house=null;let option=$('location').querySelector('[value="local"]');if(!option){option=document.createElement('option');option.value='local';option.textContent='Your location';$('location').append(option);}M.locations.local=state.place;$('location').value='local';$('locate').disabled=false;refresh();say('The world now follows your location.');},()=>{$('locate').disabled=false;say('Location unavailable. You can still choose a city.');},{timeout:10000,maximumAge:300000});
});
function syncPause(){text('play',state.paused?'Resume motion':'Pause motion');$('play').setAttribute('aria-pressed',String(!state.paused));}
$('play').addEventListener('click',()=>{state.paused=!state.paused;syncPause();});
const fetchDuration = 4.8;

function footfall(distance, stride, offset, lift, weight) {
 const phase = (distance / stride + offset) % 1;
 const stance = .62;
 if (phase < stance) return { x: (stance / 2 - phase) * stride * weight, lift: 0 };
 const swing = (phase - stance) / (1 - stance);
 return {
  x: (swing - .5) * stance * stride * weight,
  lift: Math.sin(swing * Math.PI) * lift * weight,
 };
}

function poseLeg(id, hip, hipY, foot, ankleY, kneeBend, boot) {
 const x = hip + foot.x;
 const y = ankleY - foot.lift;
 set(id, 'd', `M${hip} ${hipY}Q${(x + hip) / 2 + kneeBend} ${(y + hipY) / 2} ${x} ${y}`);
 if (boot) set(boot, 'transform', `translate(${foot.x} ${-foot.lift})`);
}

function ease(t) {
 const n = Math.max(0, Math.min(1, t));
 return n * n * (3 - 2 * n);
}

function drawFigurines(p) {
 const age = p - state.fetchStart;
 const fetching = age >= 0 && age < fetchDuration;
 const angle = walkTime * .235;
 const direction = Math.sin(angle) >= 0 ? 1 : -1;
 const walkSpeed = 55 * .235 * Math.abs(Math.sin(angle));
 const personX = 175 - 55 * Math.cos(angle);
 const dogHome = personX + 45;
 const personY = 453;
 const dogY = 453;
 const personFacing = fetching ? 1 : direction;
 const strideWeight = fetching ? 0 : Math.min(1, walkSpeed / 5);
 const bob = .85 * strideWeight * Math.cos(walkDistance * Math.PI / 5.2);
 const throwMotion = fetching && age < .8 ? Math.sin(age / .8 * Math.PI) : 0;
 const armAngle = (personFacing < 0 ? 83 : 0)
  + Math.sin(walkDistance * Math.PI / 10.4) * 5 * strideWeight - 52 * throwMotion;

 set('person', 'transform', `translate(${personX} ${personY}) scale(${personFacing} 1)`);
 set('person-upper', 'transform', `translate(0 ${bob})`);
 set('person-arm', 'transform', `rotate(${armAngle} -4 -40)`);
 set('person-shadow', 'cx', personX);
 poseLeg('person-leg-far', -4, -26 + bob, footfall(walkDistance, 20.8, .5, 4.8, strideWeight), -4, 1.2, 'person-boot-far');
 poseLeg('person-leg-near', 3, -26 + bob, footfall(walkDistance, 20.8, 0, 4.8, strideWeight), -4, 1.2, 'person-boot-near');

 const run = fetching ? (age < 2.25 ? ease((age - .25) / 2) : 1 - ease((age - 2.55) / 2.25)) : 0;
 const runLength = Math.min(75, 294 - dogHome);
 const dogX = dogHome + run * runLength;
 const pickup = ease((age - 2.25) / .13);
 const turn = ease((age - 2.38) / .17);
 const dogFacing = fetching ? 1 - 2 * turn : direction;
 const dogTravel = fetching ? (age < 2.45 ? run : 2 - run) * runLength : walkDistance;
 const dogWeight = fetching ? (age < .25 ? 0 : Math.min(1, Math.abs(Math.sin((age - .25) * Math.PI / 2.25)) * 2)) : strideWeight;
 const dogBob = -Math.abs(Math.sin(dogTravel * Math.PI / 13)) * 1.8 * dogWeight;
 set('dog', 'transform', `translate(${dogX} ${dogY}) scale(${dogFacing} 1)`);
 set('dog-body', 'transform', `translate(0 ${dogBob})`);
 set('dog-tail', 'transform', `rotate(${Math.sin(p * (fetching ? 13 : 7)) * 18} -18 -19)`);
 set('dog-shadow', 'cx', dogX);
 poseLeg('dog-hind-far', -12, -16 + dogBob, footfall(dogTravel, 13, 0, 3.2, dogWeight), -2, 1.2);
 poseLeg('dog-fore-far', 9, -16 + dogBob, footfall(dogTravel, 13, .5, 3.2, dogWeight), -2, -1.2);
 poseLeg('dog-hind-near', -11, -15 + dogBob, footfall(dogTravel, 13, .5, 3.2, dogWeight), -2, 1.2);
 poseLeg('dog-fore-near', 12, -15 + dogBob, footfall(dogTravel, 13, 0, 3.2, dogWeight), -2, -1.2);

 const arm = armAngle * Math.PI / 180;
 const handX = personX + personFacing * (-4 + 17 * Math.cos(arm) - 10 * Math.sin(arm));
 const handY = personY - 40 + bob + 17 * Math.sin(arm) + 10 * Math.cos(arm);
 const collarX = dogX + 15 * dogFacing;
 const collarY = dogY - 19 + dogBob;
 set('dog-leash', 'd', `M${handX} ${handY}Q${(handX + collarX) / 2} ${Math.max(handY, collarY) + 8} ${collarX} ${collarY}`);
 set('dog-leash', 'opacity', fetching ? 0 : 1);
 set('walker-hit', 'x', personX - 18);
 set('walker-hit', 'width', Math.max(106, dogX - personX + 51));

 set('fetch-ball', 'opacity', fetching ? 1 : 0);
 if (fetching) {
  const flight = Math.min(1, age / 1.15);
  const landingX = dogHome + runLength + 28;
  const carrying = age >= 2.25;
  const muzzleX = dogX + 28 * dogFacing;
  set('fetch-ball', 'cx', carrying ? muzzleX : handX + (landingX - handX) * flight);
  set('fetch-ball', 'cy', carrying
   ? dogY - 4 + (-18 + dogBob) * pickup
   : handY + (dogY - 4 - handY) * flight - 38 * Math.sin(Math.PI * flight));
 }
}

function draw(p){
 const wind=state.mode==='live'&&M.finite(state.data?.current.wind_speed_10m)?Math.min(2.5,.3+state.data.current.wind_speed_10m/15):.8;
 const light=state.house===null?state.night:state.house;set('windowLight','opacity',light?.96:.1);set('lantern-glow','opacity',light?.85:0);set('chimney-smoke','opacity',state.temperature<15?.65:.15);set('chimney-smoke','transform',`translate(${Math.sin(p*.7)*3} ${-p*2%9})`);
 set('sun','transform',`translate(445 155)`);set('clouds','transform',`translate(${Math.sin(p*.045)*36} 8)`);set('mill-blades','transform',`rotate(${p*12*wind})`);
 const shakeAge=p-state.treeStart,shake=shakeAge<2?Math.sin(shakeAge*23)*(1-shakeAge/2)*4:Math.sin(p*1.4)*wind*.8;
 for(const id of ['canopy','leaves','blossoms'])set(id,'transform',`rotate(${shake} 275 390)`);
 drawFigurines(p);
 const pondAge = p - state.pondStart;
 const feeding = (state.temperature > 0 ? 1 : 0) * ease(pondAge / 2.2) * (1 - ease((pondAge - 3.2) / 2.2));
 const drift = Math.sin(p * .28) * 20;
 set('floating-ducks', 'transform', `translate(${440 + drift * (1 - feeding) + 18 * feeding} ${436 + Math.sin(p * 1.5) * .7})`);
 rings.forEach((e,i)=>{const a=(pondAge-i*.3);const visible=a>=0&&a<2.7&&state.temperature>0;e.setAttribute('rx',Math.max(0,a*21));e.setAttribute('ry',Math.max(0,a*4));e.setAttribute('opacity',visible?Math.max(0,.7-a*.25):0);});crumbs.forEach((e,i)=>e.setAttribute('opacity',pondAge>=0&&pondAge<4&&state.temperature>0?Math.max(0,1-pondAge/4-i*.02):0));
 set('water-shimmer','transform',`translate(${Math.sin(p)*4} 0)`);set('bunny','transform',`translate(${74+Math.sin(p*.14)*8} ${419-Math.max(0,Math.sin(p*1.7))*(p%18<3?5:0)})`);
 stars.forEach((e,i)=>e.setAttribute('opacity',state.night&&state.weather==='clear'?.4+Math.sin(p+i)**2*.45:0));birds.forEach((e,i)=>{e.setAttribute('opacity',state.night?.1:state.weather==='rain'?.2:.8);e.setAttribute('transform',`translate(${(p*(10+i*2)+i*147)%760-80} ${166+i*21+Math.sin(p*2+i)*3}) scale(.65)`);});
 drops.forEach((e,i)=>{e.style.display=state.weather==='rain'?'':'none';e.setAttribute('transform',`translate(${(i*83+p*(25+wind*15))%650-25} ${(i*71+p*170)%620-10})`);});flakes.forEach((e,i)=>{e.style.display=state.weather==='snow'?'':'none';e.setAttribute('cx',(i*79+Math.sin(p+i)*10+p*4)%620);e.setAttribute('cy',(i*61+p*(13+i%4*3))%620-10);});
 [petals,fallingLeaves].forEach((arr,j)=>arr.forEach((e,i)=>{const active=j?state.season==='autumn':state.season==='spring';e.style.display=active?'':'none';const burst=shakeAge<3?shakeAge*30:0;const x=190+(i*41+p*(7+wind*3))%185,y=215+(i*39+p*(8+i%3*3)+burst)%190;e.setAttribute('cx',x+Math.sin(p+i)*8);e.setAttribute('cy',y);e.setAttribute('opacity',.3+Math.sin(i+p)**2*.4);e.setAttribute('transform',`rotate(${p*35+i*31} ${x} ${y})`);}));
 butterflies.forEach((e,i)=>{e.style.display=state.night||state.weather==='rain'||state.season==='winter'?'none':'';e.setAttribute('transform',`translate(${60+i*126+Math.sin(p*.7+i)*20} ${353+i%2*32+Math.cos(p*.9+i)*14}) scale(${.8+Math.sin(p*9+i)*.16} .8)`);});
 fireflies.forEach((e,i)=>{e.setAttribute('opacity',state.night&&state.season!=='winter'&&state.weather!=='rain'?Math.max(0,Math.sin(p*1.5+i*2.3))*.8:0);e.setAttribute('cx',35+i*61%525+Math.sin(p*.8+i)*7);e.setAttribute('cy',310+i*59%130+Math.cos(p*.8+i)*7);});
}
function frame(ms) {
 const dt = last ? Math.min((ms - last) / 1000, .05) : 0;
 last = ms;
 if (!state.paused) {
  state.phase += dt;
  if (state.phase - state.fetchStart >= fetchDuration) {
   const before = Math.cos(walkTime * .235);
   walkTime += dt;
   walkDistance += 55 * Math.abs(before - Math.cos(walkTime * .235));
  }
 }
 draw(state.phase);
 frameId = requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frameId);}else{last=0;frameId=requestAnimationFrame(frame);renderData();if(!state.data||M.freshness(state.data)==='stale')refresh();}});
setInterval(()=>{if(!document.hidden)refresh();},600000);setInterval(()=>{if(!document.hidden)renderData();},60000);
syncPause();refresh();frameId=requestAnimationFrame(frame);
})();
