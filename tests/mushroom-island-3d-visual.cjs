'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright'),{spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs/promises'),http=require('node:http');
const root=path.resolve(__dirname,'..'),port=8789,out=path.join(root,'visual-artifacts');
async function ready(){for(let n=0;n<60;n++){try{await new Promise((ok,no)=>http.get('http://127.0.0.1:'+port+'/mushroom-island.html',r=>{r.resume();r.statusCode===200?ok():no(Error('HTTP '+r.statusCode));}).on('error',no));return;}catch{await new Promise(r=>setTimeout(r,250));}}throw Error('local server unavailable');}
const localThree=p=>p.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**',r=>r.fulfill({path:path.join(root,'node_modules/three',r.request().url().split('three@0.187.0/')[1]),contentType:'text/javascript'}));
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
 try{
  await ready();browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
  const errs=[],page=await browser.newPage({viewport:{width:1100,height:720}});
  page.on('pageerror',e=>errs.push(e.message));await localThree(page);
  await page.goto('http://127.0.0.1:'+port+'/mushroom-island.html');
  await page.waitForFunction(()=>window.PipIsland3D?.ready,null,{timeout:60000});
  const initial=await page.evaluate(()=>PipIsland3D.stats());
  assert.ok(initial.mode==='3d'&&initial.meshes>100&&initial.renderCalls>40,'actual WebGL world '+JSON.stringify(initial));
  await page.screenshot({path:path.join(out,'pip-island-desktop-3d.png')});
  assert.ok(initial.meshes>=310&&initial.renderCalls<550,'V2 should add richly layered geometry without an unbounded draw-call budget '+JSON.stringify(initial));
  // Every snapshot below is from the actual WebGL canvas, never an inspiration image.
  for(const [landmark,shot] of [['Pip Castle','pip-island-castle-3d.png'],['The Teahouse','pip-island-village-3d.png'],['The Willow Bridge','pip-island-bridge-3d.png'],['Moonwater Falls','pip-island-waterfall-3d.png'],['Pip','pip-island-pip-3d.png']]){
    await page.evaluate(()=>PipIsland3D.reset());
    assert.ok(await page.evaluate(name=>PipIsland3D.focus(name),landmark),'missing landmark '+landmark);
    await page.screenshot({path:path.join(out,shot)});
  }
  await page.evaluate(()=>PipIsland3D.reset());
  const rect=await page.locator('#island3d').boundingBox();
  await page.mouse.move(rect.x+rect.width*.4,rect.y+rect.height*.5);await page.mouse.down();
  await page.mouse.move(rect.x+rect.width*.6,rect.y+rect.height*.5,{steps:6});await page.mouse.up();
  const orbit=await page.evaluate(()=>PipIsland3D.stats());
  assert.ok(Math.abs(orbit.azimuth-initial.azimuth)>.1,'drag orbits camera');
  await page.mouse.wheel(0,380);
  assert.ok((await page.evaluate(()=>PipIsland3D.stats())).distance>orbit.distance,'wheel zooms');
  await page.click('#islandView');assert.equal(await page.evaluate(()=>PipIsland3D.mode()),'2d','original 2D remains available');
  await page.click('#islandView');assert.equal(await page.evaluate(()=>PipIsland3D.mode()),'3d');
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  phone.on('pageerror',e=>errs.push('phone '+e.message));await localThree(phone);
  await phone.goto('http://127.0.0.1:'+port+'/mushroom-island.html');
  await phone.waitForFunction(()=>window.PipIsland3D?.ready,null,{timeout:60000});
  const mobile=await phone.evaluate(()=>PipIsland3D.stats());
  assert.ok(mobile.distance>=40,'portrait starts at island-wide zoom '+JSON.stringify(mobile));
  assert.ok(mobile.renderCalls<550,'phone should stay under a measured draw-call budget '+JSON.stringify(mobile));
  await phone.screenshot({path:path.join(out,'pip-island-phone-3d.png')});
  await phone.evaluate(()=>PipIsland3D.focus('The Teahouse'));
  await phone.screenshot({path:path.join(out,'pip-island-phone-village-3d.png')});
  const reduced=await browser.newPage({viewport:{width:500,height:800},reducedMotion:'reduce'});
  await localThree(reduced);await reduced.goto('http://127.0.0.1:'+port+'/mushroom-island.html');
  await reduced.waitForFunction(()=>window.PipIsland3D?.ready,null,{timeout:60000});
  const still=await reduced.evaluate(()=>PipIsland3D.stats().position);await reduced.waitForTimeout(350);
  assert.deepEqual(await reduced.evaluate(()=>PipIsland3D.stats().position),still,'reduced-motion Pip stays still');
  const backup=await browser.newPage();await backup.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**',r=>r.abort());
  await backup.goto('http://127.0.0.1:'+port+'/mushroom-island.html');
  await backup.waitForTimeout(900);
  const f=await backup.evaluate(()=>({a:getComputedStyle(document.getElementById('island')).display,b:getComputedStyle(document.getElementById('island3d')).display,c:document.getElementById('islandView').hidden}));
  assert.ok(f.a==='block'&&f.b==='none'&&f.c,'no WebGL must preserve 2D '+JSON.stringify(f));
  assert.deepEqual(errs,[],'page errors '+errs.join('; '));
  console.log('Pip 3D WebGL PASS',JSON.stringify({initial,mobile}));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
