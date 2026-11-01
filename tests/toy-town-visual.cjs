/* Visual regression for Toy Town WebGL. Uses real Chromium + a localhost server.
 * This script runs in CI with Playwright. Saves actual 3D and 2D screenshots,
 * checks page errors, and publishes a compact mobile visual in job logs. */
'use strict';
const {chromium} = require('playwright');
const {spawn} = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

const port = 8765;
const out = path.join(__dirname,'../visual-artifacts');
async function ready() {
  for(let n=0;n<60;n++){
    try {await new Promise((resolve,reject)=>{
      http.get('http://127.0.0.1:'+port+'/toy-town.html',r=>{
        r.resume();r.statusCode===200?resolve():reject(new Error('HTTP '+r.statusCode));
      }).on('error',reject);
    });return;}catch(e){await new Promise(r=>setTimeout(r,250));}
  }
  throw Error('Local site did not start');
}
async function main(){
  await fs.mkdir(out,{recursive:true});
  const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:path.join(__dirname,'..'),stdio:'ignore'});
  let browser;
  try {
    await ready();
    browser=await chromium.launch({headless:true,args:[
      '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle',
      '--use-angle=swiftshader','--disable-dev-shm-usage'
    ]});
    const jobs=[
      {name:'mobile-3d-close',w:390,h:844,classic:false,zoom:1.7},
      {name:'desktop-3d-close',w:1280,h:820,classic:false,zoom:1.8},
      {name:'mobile-direct-diagnostic',w:390,h:844,classic:false,zoom:1.7,query:'direct=1'},
      {name:'mobile-noenv-diagnostic',w:390,h:844,classic:false,zoom:1.7,query:'noenv=1'},
      {name:'mobile-classic-reference',w:390,h:844,classic:true,zoom:1.7}
    ];
    const records=[];
    for(const job of jobs){
      const context=await browser.newContext({viewport:{width:job.w,height:job.h},deviceScaleFactor:1,
        isMobile:job.w<500,hasTouch:job.w<500});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',err=>errors.push('pageerror:'+err.message));
      page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text().slice(0,250));});
      await page.goto('http://127.0.0.1:'+port+'/toy-town.html?visual=1'+(job.classic?'&classic=1':job.query?'&'+job.query:''),
        {waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>typeof ToyTown!=='undefined'&&ToyTown.buildings().length>0,
        {timeout:50000});
      if(!job.classic){
        try {
          await page.waitForFunction(()=>Boolean(window.ToyTown3D?.active),{timeout:50000});
        } catch(e) {
          const diagnostics=await page.evaluate(()=>({
            webgl2:Boolean(document.createElement('canvas').getContext('webgl2')),
            state:window.ToyTown3D?.getStats?.()||null,
            scripts:[...document.scripts].map(x=>x.src||x.type)
          }));
          throw Error('Real 3D never activated '+JSON.stringify(diagnostics)+'; '+errors.join(' | '));
        }
      }
      // A snapshot must show exactly the *target* close-up, not whichever
      // fraction of the easing animation a slow software GPU happened to reach.
      // Pause the world before requesting zoom: ToyTown.zoomAt then snaps its
      // camera to the target, while the real WebGL render loop stays alive.
      const beforeFrame=await page.evaluate(()=>window.ToyTown3D?.getStats?.().frames||0);
      await page.evaluate(f=>{
        ToyTown.setPlaying(false);
        ToyTown.zoomAt(f);
      },job.zoom);
      const actualZoom=await page.evaluate(()=>{
        const {z,tz}=ToyTown.debug().cam;
        return {z,tz};
      });
      if(Math.abs(actualZoom.z-actualZoom.tz)>.001)
        throw Error('Closeup camera did not reach its target: '+JSON.stringify(actualZoom));
      if(!job.classic){
        await page.waitForFunction(n=>window.ToyTown3D?.getStats?.().frames>n,
          beforeFrame,{timeout:45000,polling:100});
      }
      await page.addStyleTag({content:'#card,#ticker,#hint,#zoom-controls{display:none!important}'});
      await page.waitForTimeout(150);
      // A moving WebGL canvas may never satisfy Playwright's stability check.
      // Freeze an actual rendered GPU frame; don't switch to the old 2D fallback.
      await page.evaluate(()=>window.ToyTown3D?.freeze?.());
      await page.waitForTimeout(100);
      const image=await page.screenshot({type:'jpeg',quality:58,timeout:90000,
        animations:'disabled'});
      await fs.writeFile(path.join(out,job.name+'.jpg'),image);
      const data=await page.evaluate(()=>({
        active:Boolean(window.ToyTown3D?.active),
        stats:window.ToyTown3D?.getStats?.()||null,
        cam:ToyTown.debug().cam
      }));
      if(!job.classic&&!data.active)throw Error('3D vanished before screenshot: '+job.name);
      if(!job.classic&&!data.stats?.frozen)throw Error('3D did not freeze the captured frame');
      const record={name:job.name,bytes:image.length,...data,errors};
      records.push(record);
      console.log('VISUAL_AUDIT '+JSON.stringify(record));
      if(job.name==='mobile-3d-close'){
        // Image can be recovered without binary artifact download permissions.
        console.log('TOY_CITY_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_JPEG_END');
      }else if(job.name==='mobile-direct-diagnostic'){
        console.log('TOY_CITY_DIRECT_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_DIRECT_JPEG_END');
      }else if(job.name==='mobile-noenv-diagnostic'){
        console.log('TOY_CITY_NOENV_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_NOENV_JPEG_END');
      }
      await context.close();
    }
    await fs.writeFile(path.join(out,'audit.json'),JSON.stringify(records,null,2));
  } finally {
    if(browser) await browser.close();
    server.kill();
  }
}
main().catch(err=>{console.error('Visual audit failed:',err.stack||err);process.exitCode=1});
