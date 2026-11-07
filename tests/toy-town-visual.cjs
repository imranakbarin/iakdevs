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
      {name:'mobile-3d-close',w:390,h:844,classic:false,zoom:1.7,touchCheck:true},
      {name:'mobile-landscape',w:844,h:390,classic:false,zoom:1,mobile:true,mobileCheck:true},
      {name:'mobile-reduced-motion',w:390,h:844,classic:false,zoom:1.5,reduced:true,mobileCheck:true},
      {name:'reading-interaction',w:1100,h:820,classic:false,zoom:3.25,reader:true},
      {name:'desktop-3d-close',w:1280,h:820,classic:false,zoom:1.8},
      {name:'desktop-open-square',w:1280,h:900,classic:false,zoom:3.1,square:true},
      {name:'market-place',w:1100,h:820,classic:false,zoom:3.25,place:'market'},
      {name:'park-playground',w:1100,h:820,classic:false,zoom:3.25,place:'park'},
      {name:'bridge-crossing',w:1100,h:820,classic:false,zoom:3.2,bridge:true},
      {name:'station-waterfront',w:1280,h:900,classic:false,zoom:2.7,waterfront:true},
      {name:'rain-mobile',w:390,h:844,classic:false,zoom:1.9,weather:'rain'},
      {name:'desktop-social-life',w:1080,h:760,classic:false,zoom:2.05,social:true},
      {name:'desktop-3d-wide',w:1280,h:820,classic:false,zoom:.65},
      {name:'mobile-classic-reference',w:390,h:844,classic:true,zoom:1.7}
    ];
    const records=[];
    for(const job of jobs){
      const context=await browser.newContext({viewport:{width:job.w,height:job.h},deviceScaleFactor:1,
        isMobile:!!job.mobile||job.w<500,hasTouch:!!job.mobile||job.w<500,reducedMotion:job.reduced?'reduce':'no-preference',
        ...(job.weather?{recordVideo:{dir:out,size:{width:job.w,height:job.h}}}:{})});
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
      await page.goto('http://127.0.0.1:'+port+'/toy-town.html?visual=1'+(job.classic?'&classic=1':'')+'&weather='+(job.weather||'clear'),
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
      if(job.touchCheck||job.mobileCheck){
        const before=await page.evaluate(()=>ToyTown.debug().cam.tz),button=await page.locator('#zoom-in').boundingBox();
        if(!button)throw Error('Mobile zoom control missing');
        await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);
        await page.waitForFunction(z=>ToyTown.debug().cam.tz>z+.005,before,{timeout:15000});
        const ui=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,
          clipped:[...document.querySelectorAll('#zoom-controls button')].map(e=>e.getBoundingClientRect()).filter(r=>r.width>0).some(r=>r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1),
          reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}));
        if(ui.overflow||ui.clipped||!!job.reduced!==ui.reduced)throw Error('Mobile controls/layout mismatch: '+JSON.stringify(ui));
        console.log('TOUCH_LAYOUT '+job.name+' '+JSON.stringify(ui));
        await page.evaluate(z=>ToyTown.pinchTo(z,innerWidth/2,innerHeight/2,{x:9,y:9}),before);
        beforeFrame=await page.evaluate(()=>ToyTown3D.getStats().frames);
      }
      if(job.reader){await page.evaluate(()=>{
        const ref=ToyTown.movers().find(m=>m.shopRole==='customer');if(!ref)throw Error('Reader fixture missing');
        const now=ToyTown.debug().clock;
        Object.assign(ref,{x:9,y:9.65,lane:0,d:2,v:0,path:null,heading:undefined,attention:{x:9,y:10.4},
          intent:'reading',newsMood:'',cheerUntil:0,waveUntil:0,dance:false,
          shopPhase:'enjoying',shopAction:'reading',carrying:'book',shopNext:now+999,stopUntil:now+999,ph:(2.5-(now*.96)%6.8)/.53});
        ToyTown3D.stepPoses(2);ToyTown.pinchTo(3.25,innerWidth/2,innerHeight/2,{x:9,y:9.65});
      });beforeFrame=await page.evaluate(()=>ToyTown3D.getStats().frames);}
      if(job.bridge){await page.evaluate(()=>{
        const car=ToyTown.movers().find(m=>m.type==='car'&&m.kind==='bus')||ToyTown.movers().find(m=>m.type==='car');
        if(!car)throw Error('Bridge vehicle fixture missing');
        Object.assign(car,{x:6.5,y:13.48,d:2,lane:.2,v:.4,path:null,heading:undefined,hopUntil:0});
        ToyTown.pinchTo(3.2,innerWidth/2,innerHeight/2,{x:6.5,y:14});
      });
      beforeFrame=await page.evaluate(()=>ToyTown3D.getStats().frames);
      await page.waitForFunction(()=>{let found=false;ToyTown3D.scene.traverse(o=>{if(o.userData?.bridgeContact&&Math.abs(o.position.z-13.48)<.03&&Math.abs(o.position.x-6.3)<.03)found=true;});return found;},null,{timeout:45000,polling:100});}

      if(job.waterfront)await page.evaluate(()=>ToyTown.pinchTo(2.7,innerWidth/2,innerHeight/2,{x:9,y:16.2}));
      if(job.square)await page.evaluate(()=>ToyTown.pinchTo(3.1,innerWidth/2,innerHeight/2,{x:9,y:9.35}));
      if(job.place){
        await page.evaluate(place=>{
          const q=place==='park'?ToyTown3D.lifeStats().at.play:null;
          const p=place==='market'?ToyTown.props().find(p=>p.kind==='district-scene'&&p.role==='produce'):null;
          if(!q&&!p)throw Error('Requested public place missing: '+place);
          ToyTown.pinchTo(3.25,innerWidth/2,innerHeight/2,{x:q?q[0]:p.x,y:q?q[1]:p.y});
        },job.place);
      }
      if(job.weather){
        await page.waitForFunction(()=>ToyTown3D.weather().kind==='rain',null,{timeout:20000});
        const rain=await page.evaluate(()=>{
          ToyTown3D.stepWeather(4);
          let drops=null;ToyTown3D.scene.traverse(o=>{if(o.userData?.kind==='rain'&&o.userData.lengths)drops=o;});
          if(!drops)throw Error('Detailed rain stream missing');
          const before=Array.from(drops.geometry.attributes.position.array);ToyTown3D.stepWeather(.15);
          const moved=before.some((v,i)=>Math.abs(v-drops.geometry.attributes.position.array[i])>.01);
          return {opacity:drops.material.opacity,moved,count:drops.userData.lengths.length,min:Math.min(...drops.userData.lengths),max:Math.max(...drops.userData.lengths),
            varied:new Set([...drops.userData.lengths].map(v=>v.toFixed(3))).size,depthWrite:drops.material.depthWrite};
        });
        if(rain.varied<20||rain.min<.04||rain.max>.15||rain.depthWrite||rain.opacity<.31||!rain.moved)
          throw Error('Rain must be short, varied and not write an opaque depth layer: '+JSON.stringify(rain));
        console.log('RAIN_GPU '+JSON.stringify(rain));
        await page.evaluate(()=>{for(let i=0;i<60;i++)ToyTown.update(1/60);});
        await page.waitForTimeout(1800);
      }
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
        // Finish on a real knock at the threshold, rather than a random
        // static frame after all the accelerated simulated shop visits.
        const staged=await page.evaluate(()=>{
          for(let i=0;i<60*14;i++){
            ToyTown.update(1/60);
            const who=ToyTown.movers().find(m=>m.shopRole==='customer'&&
              m.shopPhase==='knocking');
            if(who)return {shop:who.shopAt,x:who.x,y:who.y,
              action:who.shopAction,moved:who.moved};
          }
          return null;
        });
        if(!staged||staged.action!=='knocking'||staged.moved>.00015)
          throw Error('Could not stage a physically stationary door knock: '+
            JSON.stringify(staged));
        console.log('SHOP_THRESHOLD_KNOCK '+JSON.stringify(staged));
        beforeFrame=await page.evaluate(()=>
          window.ToyTown3D?.getStats?.().frames||0);
      }
      if(job.square){
        const square=await page.evaluate(()=>{
          let civic=null,fronts=[];
          ToyTown3D.scene.traverse(o=>{
            if(o.userData?.citySquare)civic=o;
            if(o.userData?.workingShop)fronts.push(o);
          });
          const fixtures=civic?.children.filter(o=>o.userData?.squareFixture)||[];
          return {fixtures:fixtures.map(o=>({kind:o.userData.squareFixture,x:o.position.x,z:o.position.z})),
            attached:fronts.filter(o=>o.userData.facadeAttached&&o.position.z===8.25).length,
            lamps:ToyTown3D.getStats().plazaLights};
        });
        if(square.attached!==2||square.lamps!==2||square.fixtures.length!==7)
          throw Error('Civic layout missing in the real render: '+JSON.stringify(square));
        if(square.fixtures.some(o=>[8.5,9.5].some(x=>Math.abs(x-o.x)<.3)))
          throw Error('Civic furniture obstructs a shop walking aisle');
        console.log('OPEN_SQUARE_GPU '+JSON.stringify(square));
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
          let windowOpened=false,knockPosed=false;
          window.ToyTown3D?.scene?.traverse(o=>{
            if(o.userData?.streetFront?.openAmount>.025)windowOpened=true;
            if(o.userData?.pose?.knock>.025)knockPosed=true;
          });
          return windowOpened&&knockPosed;
        },null,{timeout:30000,polling:100});
        console.log('SHOP_KNOCK_GPU PASS: physically open serving hatch and posed visitor');
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
      if(!job.mobileCheck)await page.addStyleTag({content:'#card,#ticker,#hint,#zoom-controls{display:none!important}'});
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
        renderInfo:window.ToyTown3D?.renderInfo?.()||null,
        cam:ToyTown.debug().cam
      }));
      if(!job.classic&&!data.active)throw Error('3D vanished before screenshot: '+job.name);
      if(!job.classic&&!data.stats?.frozen)throw Error('3D did not freeze the captured frame');
      if(job.reader){const r=await page.evaluate(()=>{
        let reader=null;ToyTown3D.scene.traverse(o=>{if(o.userData?.shopProps?.book&&Math.abs(o.position.x-9)<.01&&Math.abs(o.position.z-9.65)<.01)reader=o;});
        if(!reader)throw Error('Rendered reader missing');
        const L=reader.userData.limbs,book=reader.userData.shopProps.book;
        const p=L.hands[0].getWorldPosition(L.hands[0].position.clone());book.worldToLocal(p);
        const gap=Math.hypot(Math.max(0,Math.abs(p.x)-.061),Math.max(0,Math.abs(p.y)-.0785),Math.max(0,Math.abs(p.z)-.028));
        return {gap,curls:L.hands.map(h=>h.userData.handRig.curl),look:L.headPivot.rotation.x,
          face:L.faceSurface.material.userData.faceExpression,attached:book.parent===L.hands[1],visible:book.visible};
      });if(r.gap>.065||r.curls.some(c=>c<.6)||r.look<.18||r.face!=='read'||!r.attached||!r.visible)throw Error('Two-handed reader pose failed: '+JSON.stringify(r));console.log('READING_GPU '+JSON.stringify(r));}
      if(job.name==='desktop-3d-wide'){const species=await page.evaluate(()=>{const s=new Set();ToyTown3D.scene.traverse(o=>{if(o.userData?.treeSpecies)s.add(o.userData.treeSpecies);});return [...s];});if(species.length<4)throw Error('Too few distinct tree species: '+JSON.stringify(species));console.log('TREE_SPECIES '+JSON.stringify(species));}
      if(job.bridge){
        const q=await page.evaluate(()=>{
          let vehicle=null,hands=0;ToyTown3D.scene.traverse(o=>{if(o.userData?.handRig)hands++;
            if(o.userData?.vehicleRig&&Math.abs(o.position.z-13.48)<.03&&Math.abs(o.position.x-6.3)<.03)vehicle=o;});
          if(!vehicle)throw Error('Staged bridge vehicle not rendered');
          const c=vehicle.userData.bridgeContact;
          return {contact:c,pitch:vehicle.rotation.z,height:vehicle.position.y-.192,signals:ToyTown3D.signalStats(),hands};
        });
        if(q.pitch<=0||Math.abs(q.height-q.contact.height)>1e-6||Math.abs(q.pitch-q.contact.pitch)>1e-6||q.signals.poles!==24||q.signals.heads!==48||q.hands<20)
          throw Error('Bridge/signal/hand GPU scene mismatch: '+JSON.stringify(q));
        console.log('BRIDGE_CONTACT_GPU '+JSON.stringify(q));
      }
      if(job.place==='park'){const overlap=await page.evaluate(()=>{const p=ToyTown3D.lifeStats().at.play;return ToyTown3D.contours().filter(([x,z])=>Math.hypot(x-p[0],z-p[1])<1.3);});if(overlap.length)throw Error('Garden contours overlap playground: '+JSON.stringify(overlap));}
      if(!job.classic){const b=await page.evaluate(()=>window.ToyTown3D?.batchStats?.()||null);if(!b||b.off||b.merged<50||b.removed<500)throw Error('static batching did not merge the town: '+JSON.stringify(b)+' '+job.name);}
      if(job.name==='desktop-3d-wide'){const roofs=await page.evaluate(()=>{const styles=new Set();ToyTown3D.scene.traverse(o=>{if(o.userData?.roofStyle)styles.add(o.userData.roofStyle);});return [...styles];});if(!roofs.includes('gable')||!roofs.includes('terrace'))throw Error('Roof silhouettes missing: '+JSON.stringify(roofs));console.log('ROOF_STYLES '+JSON.stringify(roofs));}
      if(!job.classic){const black=await page.evaluate(()=>window.ToyTown3D?.vertexColorAudit?.()||0);if(black)throw Error(black+' meshes read vertex colours from a geometry that has none (they draw black): '+job.name);}
      const record={name:job.name,bytes:image.length,...data,errors};
      records.push(record);
      console.log('VISUAL_AUDIT '+JSON.stringify(record));
      if(job.name==='mobile-3d-close'){
        // Image can be recovered without binary artifact download permissions.
        console.log('TOY_CITY_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_JPEG_END');
      }else if(job.square){
        console.log('TOY_CITY_SQUARE_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_SQUARE_JPEG_END');
      }else if(job.name==='desktop-3d-wide'){
        console.log('TOY_CITY_WIDE_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_WIDE_JPEG_END');
      }else if(job.name==='desktop-social-life'){
        console.log('TOY_CITY_SOCIAL_JPEG_BEGIN '+image.toString('base64')+' TOY_CITY_SOCIAL_JPEG_END');
      }
      const video=job.weather?page.video():null;
      await context.close();
      if(video)await fs.rename(await video.path(),path.join(out,job.name+'.webm'));
    }
    await fs.writeFile(path.join(out,'audit.json'),JSON.stringify(records,null,2));
  } finally {
    if(browser) await browser.close();
    server.kill();
  }
}
main().catch(err=>{console.error('Visual audit failed:',err.stack||err);process.exitCode=1});
