'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(require('node:path').join(__dirname,'../assets/toy-town-country.js'),'utf8');
function setup(search='',stored='town',fail=false){
  const storage=new Map([['toy-town:country',stored]]),calls=[],events={},select={value:'',addEventListener:(k,f)=>events[k]=f},status={textContent:''};
  const win={ToyTown3D:{active:true,setCountry:id=>{calls.push(id);return !fail;}}};
  const doc={documentElement:{dataset:{}},getElementById:id=>id==='country-select'?select:status};
  const loc={search,href:'https://example.test/toy-town.html'+search};let lastUrl='';
  vm.runInNewContext(code,{window:win,document:doc,location:loc,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},URLSearchParams,URL,history:{replaceState:(a,b,u)=>lastUrl=String(u)}});
  return {api:win.ToyTownCountry,select,status,storage,calls,events,doc,url:()=>lastUrl};
}
const s=setup('?country=japan&embed=1','italy');assert.equal(s.api.id,'japan');assert.equal(s.select.value,'japan');
const b={kind:'house',x:3,y:4,wall:'#fff',roof:'#fff'};const themed=s.api.building(b);assert.equal(themed.country,'japan');assert.equal(b.wall,'#fff','styling never changes simulation objects');
assert.equal(s.api.set('india'),true);assert.equal(s.select.value,'india');assert.equal(s.storage.get('toy-town:country'),'india');assert.equal(s.doc.documentElement.dataset.country,'india');assert.match(s.url(),/country=india/);assert.match(s.url(),/embed=1/);
assert.equal(s.api.set('bad'),false);assert.equal(s.api.id,'india');
s.select.value='netherlands';s.events.change();assert.equal(s.api.id,'netherlands');assert.match(s.status.textContent,/canal/);
assert.equal(s.api.set('town'),true);assert.equal(s.api.building(b),b);assert.doesNotMatch(s.url(),/country=/);
const f=setup('','usa',true);assert.equal(f.api.set('italy'),false);assert.equal(f.api.id,'usa','failed scene replacement retains current selection');
assert.equal(setup('?country=invalid','italy').api.id,'italy');assert.equal(setup('','invalid').api.id,'town');
for(const id of ['india','japan','italy','netherlands','usa'])assert.equal(setup('?country='+id).api.id,id);
console.log('Toy Town country PASS: selection, persistence, URL, invalid inputs, scene failure and immutable fallback styling');
