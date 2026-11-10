'use strict';
// These suites have independent processes and read-only fixtures. Run them
// together so rendering work need not wait for their combined serial runtime.
const {spawn}=require('node:child_process');
const path=require('node:path');
const suites=['toy-town','toy-town-3d','toy-town-news','toy-town-lens','toy-town-extras','toy-town-rain','toy-town-bridges','toy-town-country','toy-town-new'];
Promise.all(suites.map(name=>new Promise(resolve=>{
  const p=spawn(process.execPath,[path.join(__dirname,'../tests',name+'.test.cjs')],{stdio:'inherit'});
  p.on('error',e=>{console.error(name+': '+e.message);resolve({name,ok:false});});
  p.on('exit',(code,signal)=>resolve({name,ok:code===0&&!signal}));
}))).then(results=>{
  for(const r of results)console.log((r.ok?'PASS ':'FAIL ')+r.name);
  process.exitCode=results.every(r=>r.ok)?0:1;
});
