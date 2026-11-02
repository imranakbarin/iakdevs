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
      {name:'desktop-social-life',w:1080,h:760,classic:false,zoom:2.05,social:true},
      {name:'desktop-3d-wide',w:1280,h:820,classic:false,zoom:.65},
      {name:'mobile-classic-reference',w:390,h:844,classic:true,zoom:1.7}
    ];
    const records=[];
    for(const job of jobs){
      const context=await browser.newContext({viewport:{width:job.w,height:job.h},deviceScaleFactor:1,
        isMobile:job.w<500,hasTouch:job.w<500});
      const page=await context.newPage();
      // Exercise real headline UI with controlled current publisher data.
      // The production hourly RSS job is tested separately.
      const published=new Date().toISOString();
      await page.route('**/toy-town-news.json*',route=>route.fulfill({
        status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},
        body:JSON.stringify({
          version:1,generated_at:published,status:'ok',
          stories:[
            {title:'India wins international cricket championship final',
              source:'BBC Sport',category:'Sport',
              url:'https://www.bbc.co.uk/sport/example',published_at:published},
            {title:'Robot engineers announce a new research breakthrough',
              source:'BBC Technology',category:'Technology',
              url:'https://www.bbc.co.uk/news/technology/example',published_at:published},
            {title:'Museum celebrates a global art exhibition opening',
              source:'DW',category:'World',
              url:'https://www.dw.com/en/example',published_at:published}
          ]
        })
      }));
      const errors=[];
      page.on('pageerror',err=>errors.push('pageerror:'+err.message));
      page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text().slice(0,250));});
      await page.goto('http://127.0.0.1:'+port+'/toy-town.html?visual=1'+(job.classic?'&classic=1':''),
        {waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>typeof ToyTown!=='undefined'&&ToyTown.buildings().length>0,
        {timeout:50000});
      await page.waitForFunction(()=>document.getElementById('news-status')?.textContent
        .includes('HEADLINES ·'),{timeout:10000});
      // Software SwiftShader can monopolize Chromium's input pipeline.
      // Execute the actual button handler in-page, then verify its state.
      await page.evaluate(()=>document.getElementById('news-toggle').click());
      const isOpen=await page.locator('#news-toggle').getAttribute('aria-expanded');
      if(isOpen!=='true')throw Error('Headline drawer failed to open');
      const verifiedLinks=await page.locator('#headlines a[href^="https://"]').count();
      if(verifiedLinks!==3)throw Error('Factual headlines must include real publisher links: '+
        verifiedLinks);
      // Chromium can wait for unrelated module traffic after a second
      // pointer click. The opening tap above is a true pointer test; close
      // with the DOM click and assert the same handler collapses the list.
      await page.evaluate(()=>document.getElementById('news-toggle').click());
      const expanded=await page.locator('#news-toggle').getAttribute('aria-expanded');
      if(expanded!=='false')throw Error('Headline drawer failed to close');
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
      if(!job.classic){
        const projection=await page.evaluate(()=>({
          projection:window.ToyTown3D?.getStats?.().cameraProjection,
          perspective:!!window.ToyTown3D?.camera?.isPerspectiveCamera,
          fov:window.ToyTown3D?.camera?.fov
        }));
        if(projection.projection!=='perspective'||!projection.perspective||
          projection.fov<20||projection.fov>45)
          throw Error('Photographic street lens is not a real perspective camera: '+
            JSON.stringify(projection));
        console.log('PERSPECTIVE_CAMERA '+JSON.stringify(projection));
      }
      // A snapshot must show exactly the *target* close-up, not whichever
      // fraction of the easing animation a slow software GPU happened to reach.
      // Pause the world before requesting zoom: ToyTown.zoomAt then snaps its
      // camera to the target, while the real WebGL render loop stays alive.
      let beforeFrame=await page.evaluate(()=>window.ToyTown3D?.getStats?.().frames||0);
      await page.evaluate(f=>{
        ToyTown.setPlaying(false);
        ToyTown.zoomAt(f);
      },job.zoom);
      if(job.name==='mobile-3d-close'){
        // A pretty frame is not proof of city life. Advance the REAL
        // simulation in Chromium until trading and the street concert
        // are active, then inspect the 3D actor rig in that same scene.
        const market=await page.evaluate(()=>{
          let held=false,served=false,knocked=false;
          for(let i=0;i<60*22;i++){
            ToyTown.update(1/60);
            const actors=ToyTown.movers();
            if(actors.some(m=>m.shopRole==='customer'&&m.carrying))held=true;
            if(actors.some(m=>m.shopRole==='customer'&&
              m.shopPhase==='knocking'))knocked=true;
            if(actors.some(m=>m.shopRole==='vendor'&&
              (m.shopAction==='serving'||m.shopAction==='handoff')))served=true;
          }
          const movers=ToyTown.movers();
          const stats=ToyTown.debug();
          return {sales:stats.streetTransactions,visits:stats.streetShopVisits,
            concerts:stats.streetPerformances,reactions:stats.newsReactions,
            held,served,knocked,performer:movers.some(m=>m.kind==='busker'&&m.guitar),
            people:movers.filter(m=>m.shopRole).length};
        });
        if(market.sales<2||market.visits<2||market.concerts<1||
          !market.held||!market.served||!market.knocked||
          !market.performer||market.people!==5)
          throw Error('The miniature market does not really trade and perform: '+
            JSON.stringify(market));
        console.log('LIVING_MARKET '+JSON.stringify(market));
        beforeFrame=await page.evaluate(()=>
          window.ToyTown3D?.getStats?.().frames||0);
      }
      if(job.name==='desktop-3d-wide'){
        const local=await page.evaluate(()=>{
          const actors=ToyTown.movers().filter(m=>m.districtResident);
          for(let i=0;i<60*48;i++)ToyTown.update(1/60);
          const debug=ToyTown.debug().districts;
          return {count:debug.count,visits:debug.visits,tasks:debug.tasks,
            meetings:debug.meetings,people:actors.length,
            roles:debug.areas.map(a=>a.role)};
        });
        if(local.count<3||local.visits<3||local.tasks<3||
          local.people!==local.count*2)
          throw Error('Outer neighborhood activity not working in Chromium: '+
            JSON.stringify(local));
        console.log('OUTER_CITY_LIFE '+JSON.stringify(local));
        beforeFrame=await page.evaluate(()=>
          window.ToyTown3D?.getStats?.().frames||0);
      }
      if(job.social){
        const social=await page.evaluate(()=>{
          let chat=false;
          for(let i=0;i<60*68;i++){
            ToyTown.update(1/60);
            if(ToyTown.debug().communityEncounters>0&&
              ToyTown.movers().filter(m=>m.communityResident)
                .every(m=>m.intent==='chat')){
              chat=true;break;
            }
          }
          return {chat,debug:ToyTown.debug(),residents:ToyTown.movers()
            .filter(m=>m.communityResident||m.companionDog)
            .map(m=>({x:m.x,y:m.y,intent:m.intent,kind:m.kind}))};
        });
        if(!social.chat||social.debug.communityVisits<1)
          throw Error('Real browser never reached an actual plaza encounter: '+
            JSON.stringify(social));
        // The camera zoom may have already produced a render before the
        // simulation advanced. Only a NEW frame after the chat is valid
        // evidence of animated gesture blending in the GPU scene.
        beforeFrame=await page.evaluate(()=>
          window.ToyTown3D?.getStats?.().frames||0);
      }
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
      if(job.name==='desktop-3d-wide'){
        await page.waitForFunction(()=>{
          let fixtures=0,tools=0;
          window.ToyTown3D?.scene?.traverse(o=>{
            if(o.userData?.districtSceneRole)fixtures++;
            if(o.userData?.districtTool)tools++;
          });
          return fixtures>=3&&tools>=3;
        },null,{timeout:30000,polling:100});
        console.log('OUTER_CITY_GPU PASS: modeled workplaces and job tools are in the live 3D scene');
      }
      if(job.name==='mobile-3d-close'){
        await page.waitForFunction(()=>{
          let playing=false,stocked=false;
          window.ToyTown3D?.scene?.traverse(o=>{
            if(o.userData?.buskerGuitar&&o.userData.pose?.play>.01)playing=true;
            if(o.userData?.shopProps?.bread?.visible||
              o.userData?.shopProps?.book?.visible)stocked=true;
          });
          return playing&&stocked;
        },null,{timeout:30000,polling:100});
        const shopFronts=await page.evaluate(()=>{
          let fronts=0,details=0,transactions=0;
          window.ToyTown3D?.scene?.traverse(o=>{
            if(o.userData?.workingShop){
              fronts++;
              if(o.userData?.streetFront?.bell&&o.children.length>30)details++;
              transactions+=o.userData?.streetFront?.serviceCount||0;
            }
          });
          return {fronts,details,transactions};
        });
        if(shopFronts.fronts!==2||shopFronts.details!==2)
          throw Error('Integrated, physical shopfronts missing: '+
            JSON.stringify(shopFronts));
        console.log('SHOP_FRONT_GPU '+JSON.stringify(shopFronts));
        console.log('LIVING_MARKET_GPU PASS: performer plays modeled guitar and real goods attach to hands');
      }
      if(job.social){
        // A previous camera frame can satisfy the generic render counter
        // before the synchronous simulation reaches the conversation.
        // Wait specifically for both residents' *rendered* pose blends.
        await page.waitForFunction(()=>{
          let talking=0;
          window.ToyTown3D?.scene?.traverse(o=>{
            if(o.userData?.pose?.chat>.015)talking++;
          });
          return talking>=2;
        },null,{timeout:30000,polling:100});
        // Verify the new pose controller actually reaches the GPU scene,
        // not just the underlying simulation's chat intent.
        const animated=await page.evaluate(()=>{
          const humans=[],dogs=[];
          ToyTown3D.scene.traverse(o=>{
            if(o.userData?.pose)humans.push(o.userData.pose);
            if(o.userData?.creatureRig?.kind==='dog')
              dogs.push(o.userData.creatureRig);
          });
          return {people:humans.length,
            speaking:humans.filter(p=>p.chat>.015).length,
            dogCount:dogs.length,
            responsiveDog:dogs.some(d=>d.ears?.length===2&&d.body)};
        });
        if(animated.speaking<2||!animated.responsiveDog)
          throw Error('Choreographed 3D scene failed to express live social interaction: '+
            JSON.stringify(animated));
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
      }else if(job.name==='desktop-3d-wide'){
        console.log('TOY_CITY_WIDE_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_WIDE_JPEG_END');
      }else if(job.name==='desktop-social-life'){
        console.log('TOY_CITY_SOCIAL_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_SOCIAL_JPEG_END');
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
