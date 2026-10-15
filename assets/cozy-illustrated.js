/* Cozy Worlds — handcrafted layered illustration. No remote renderer or primitive 3D objects. */
window.CozyWorlds=(()=>{
let current=null;
function mount(host){
 if(current)current.dispose();
 const root=document.createElement('div');root.className='nook-world';
 const bookColors=['#b55e58','#b68c61','#637f77','#4c6678','#c19586','#6b677e','#d4ab6c','#865a67'];
 let seed=19;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const bookcase=(x)=>{let out='<g transform="translate('+x+' 0)"><rect x="0" y="78" width="163" height="434" rx="5" fill="url(#wood)"/><rect x="10" y="86" width="143" height="414" fill="#332a2d"/>';
 for(let row=0;row<5;row++){const top=101+row*78;let xx=16;
  while(xx<140){let w=7+rnd()*10,h=46+rnd()*20;const color=bookColors[Math.floor(rnd()*bookColors.length)];out+='<g transform="rotate('+((rnd()-.5)*9).toFixed(1)+' '+(xx+w/2).toFixed(1)+' '+(top+64)+')"><rect x="'+xx.toFixed(1)+'" y="'+(top+64-h).toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="1.5" fill="'+color+'" stroke="#211e25" stroke-width=".8"/><path d="M'+(xx+2)+' '+(top+68-h)+'v'+(h-13)+'" stroke="#fff1c5" opacity=".29"/><path d="M'+(xx+2)+' '+(top+57)+'h'+(w-4)+'" stroke="#dfc89d" opacity=".75"/></g>';xx+=w+2;}
  out+='<path d="M9 '+(top+67)+'h145v11H9z" fill="url(#shelf)"/><path d="M10 '+(top+78)+'h143" stroke="#120e13" stroke-width="3" opacity=".5"/>';
 }
 return out+'</g>';};
 const rain=Array.from({length:85},()=>{const x=305+rnd()*350,y=75+rnd()*365,l=7+rnd()*22;return '<line x1="'+x.toFixed(1)+'" y1="'+y.toFixed(1)+'" x2="'+(x-6).toFixed(1)+'" y2="'+(y+l).toFixed(1)+'" stroke="#c6dcea" stroke-width="'+(.7+rnd()*.7).toFixed(1)+'" opacity="'+(.2+rnd()*.35).toFixed(2)+'"/>';}).join('');
 const flecks=Array.from({length:35},(_,i)=>'<circle class="nook-fleck" cx="'+(165+rnd()*620).toFixed(1)+'" cy="'+(90+rnd()*520).toFixed(1)+'" r="'+(.8+rnd()*2).toFixed(1)+'" fill="'+(i%3?'#f7d8a5':'#fef6e2')+'" opacity="'+(.15+rnd()*.52).toFixed(2)+'" style="animation-delay:-'+(rnd()*12).toFixed(1)+'s"/>').join('');
 root.innerHTML=`<svg class="nook-illustration" viewBox="0 0 960 720" role="img" aria-label="Warm illustrated reading nook with a teal armchair, curled orange cat, rain outside the window, glowing lamp, and overflowing bookshelves" preserveAspectRatio="xMidYMid meet">
 <defs>
 <linearGradient id="room" x2=".15" y2="1"><stop stop-color="#4a414d"/><stop offset=".65" stop-color="#6e5351"/><stop offset="1" stop-color="#41363c"/></linearGradient>
 <linearGradient id="floor" x2="0" y2="1"><stop stop-color="#75554b"/><stop offset="1" stop-color="#261e27"/></linearGradient>
 <linearGradient id="wood"><stop stop-color="#4d332f"/><stop offset=".36" stop-color="#8f6548"/><stop offset=".58" stop-color="#654332"/><stop offset="1" stop-color="#2e2227"/></linearGradient>
 <linearGradient id="shelf" x2="0" y2="1"><stop stop-color="#b18561"/><stop offset=".38" stop-color="#6c4b39"/><stop offset="1" stop-color="#302327"/></linearGradient>
 <linearGradient id="night" x2=".5" y2="1"><stop stop-color="#243b59"/><stop offset=".8" stop-color="#536a81"/><stop offset="1" stop-color="#b78786"/></linearGradient>
 <radialGradient id="lamplight"><stop stop-color="#ffe1a1" stop-opacity=".66"/><stop offset=".35" stop-color="#f5b36f" stop-opacity=".22"/><stop offset="1" stop-color="#efaa62" stop-opacity="0"/></radialGradient>
 <linearGradient id="chair" x2="1" y2=".8"><stop stop-color="#174c52"/><stop offset=".25" stop-color="#33797a"/><stop offset=".53" stop-color="#3b8f87"/><stop offset=".82" stop-color="#226466"/><stop offset="1" stop-color="#143f46"/></linearGradient>
 <linearGradient id="seat" x2="0" y2="1"><stop stop-color="#5a9c92"/><stop offset=".55" stop-color="#2c7572"/><stop offset="1" stop-color="#19464c"/></linearGradient>
 <linearGradient id="catfur" x2=".7" y2="1"><stop stop-color="#edb26d"/><stop offset=".56" stop-color="#cb783e"/><stop offset="1" stop-color="#874a36"/></linearGradient>
 <linearGradient id="blanket" x2="0" y2="1"><stop stop-color="#fff2d9"/><stop offset=".6" stop-color="#e6d1ae"/><stop offset="1" stop-color="#a68c82"/></linearGradient>
 <linearGradient id="shade" x2="0" y2="1"><stop stop-color="#9c6270"/><stop offset=".4" stop-color="#edaf9d"/><stop offset="1" stop-color="#9d6470"/></linearGradient>
 <radialGradient id="vignette"><stop offset=".48" stop-color="#070913" stop-opacity="0"/><stop offset="1" stop-color="#080b13" stop-opacity=".72"/></radialGradient>
 <filter id="shadow"><feGaussianBlur stdDeviation="20"/></filter>
 <filter id="glow"><feGaussianBlur stdDeviation="9"/></filter>
 <clipPath id="windowclip"><rect x="308" y="89" width="340" height="351" rx="4"/></clipPath>
 <pattern id="wallpaper" width="33" height="53" patternUnits="userSpaceOnUse"><path d="M16 0Q-5 26 16 53Q37 26 16 0Z" fill="none" stroke="#e4bca1" stroke-opacity=".11" stroke-width=".9"/><circle cx="16" cy="27" r="1.4" fill="#e1b89a" opacity=".13"/></pattern>
 <pattern id="upholstery" width="17" height="14" patternUnits="userSpaceOnUse"><path d="M0 0L17 14M17 0L0 14" stroke="#fff9de" opacity=".06" stroke-width=".65"/></pattern>
 </defs>
 <rect width="960" height="720" fill="#191f2d"/>
 <g class="nook-parallax-room" data-depth="0.20"><path d="M75 52H885V617H75Z" fill="url(#room)"/><path d="M75 52H885V617H75Z" fill="url(#wallpaper)"/>
 <path d="M74 541H887V650H74Z" fill="url(#floor)"/><path d="M75 536H886" stroke="#c59871" stroke-width="12"/><path d="M75 545H886" stroke="#3d2b31" stroke-width="5"/>
 <path d="M80 549L478 528L880 549M80 592L480 549L880 592M80 644L480 565L880 644" stroke="#b68d69" stroke-opacity=".12" stroke-width="2" fill="none"/>
 <rect x="292" y="75" width="370" height="381" rx="8" fill="#201e28" stroke="#b88a63" stroke-width="13"/>
 <rect x="308" y="89" width="340" height="351" fill="url(#night)"/>
 <g clip-path="url(#windowclip)"><g fill="#283447" opacity=".75"><path d="M302 370h47v-90h28v90h20V248h27v122h35V286h27v84h36V266h27v104h30v-87h44v160H302z"/></g>
 <g fill="#f5c997" opacity=".65">${Array.from({length:52},()=>'<rect x="'+(326+rnd()*297).toFixed(1)+'" y="'+(300+rnd()*100).toFixed(1)+'" width="2.4" height="3.5"/>').join('')}</g>
 <g class="nook-rain">${rain}</g>
 <path d="M477 84v369M302 256h353" stroke="#b69b83" stroke-width="14"/><path d="M477 84v369M302 256h353" stroke="#53454a" stroke-width="5"/>
 </g>
 <path d="M281 74q48 18 58 79l-24 299q-27-60-36-139l-11-192Z" fill="#a1717c"/><path d="M281 80q29 75 25 353" fill="none" stroke="#e8adab" stroke-width="11" opacity=".45"/>
 <path d="M670 75q-52 30-58 81l25 288q34-69 39-138l13-185Z" fill="#a1717c"/><path d="M674 80q-37 89-31 346" fill="none" stroke="#e9b8ad" stroke-width="12" opacity=".42"/>
 <path d="M277 83q38 52 34 154M667 84q-30 78-25 148" stroke="#d6aa9f" fill="none" stroke-width="3" opacity=".55"/>
 ${bookcase(106)}${bookcase(692)}
 <ellipse cx="478" cy="573" rx="260" ry="58" fill="#100d16" opacity=".54" filter="url(#shadow)"/>
 <path d="M247 569q229-94 438-4l21 72q-249 64-488-1z" fill="#84665e" stroke="#d2a17c" stroke-width="7"/>
 <path d="M252 570q224-76 420-3M246 629q230 43 451-2" fill="none" stroke="#f1d0a5" stroke-opacity=".35" stroke-width="3"/>
 </g>
 <g class="nook-parallax-front" data-depth="0.50">
 <ellipse cx="466" cy="526" rx="177" ry="31" fill="#201a21" opacity=".55" filter="url(#shadow)"/>
 <path d="M345 460l-18 113q8 12 24 6l32-100M563 462l31 113q-7 12-24 5l-44-101" fill="#372a2b" stroke="#aa8362" stroke-width="6"/>
 <path d="M316 303q-20-108 90-136q71-25 134 4q79 39 65 135l-14 157q-116 60-264 2Z" fill="#163e46" stroke="#0d333d" stroke-width="14"/>
 <path d="M330 304q-12-93 80-119q68-25 124 5q68 31 58 111l-8 143q-114 45-248 0Z" fill="url(#chair)" stroke="#679f8f" stroke-width="4"/>
 <path d="M330 304q-12-93 80-119q68-25 124 5q68 31 58 111l-8 143q-114 45-248 0Z" fill="url(#upholstery)"/>
 <path d="M374 206Q332 294 385 417M542 207Q581 294 538 427" fill="none" stroke="#143d45" stroke-width="7" opacity=".5"/>
 <g fill="#24565a" stroke="#a4c0a5" stroke-width="1.7">${[[401,244],[463,237],[524,248],[379,304],[440,295],[502,302],[552,314],[397,367],[464,360],[526,369]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="5"/>').join('')}</g>
 <path d="M367 274q68 18 162 0M355 338q99 22 207 0" fill="none" stroke="#16454c" stroke-opacity=".5" stroke-width="3"/>
 <path d="M338 428q-12-42 27-60q103-24 194 0q40 14 33 62l-8 74q-118 51-253 0Z" fill="url(#seat)" stroke="#16474b" stroke-width="9"/>
 <path d="M354 438q95-29 220 2" stroke="#7ea99a" stroke-width="5" opacity=".65" fill="none"/>
 <path d="M316 345q-50-5-58 48l5 106q10 46 56 34l51-19q22-19 0-55l-10-79q-9-31-44-35Z" fill="url(#chair)" stroke="#143f47" stroke-width="11"/>
 <path d="M604 344q45 2 55 49l-6 109q-10 40-52 29l-39-21q-21-17-1-55l5-75q9-36 38-36Z" fill="url(#chair)" stroke="#143f47" stroke-width="11"/>
 <path d="M266 388q38-20 79-1M566 390q38-22 79-3" stroke="#81b6a2" stroke-opacity=".7" stroke-width="5" fill="none"/>
 <path d="M526 383Q544 431 575 479q23 43 11 106q-17 20-45-5l-38-54q-14-53-11-84q-26-22-14-55Z" fill="url(#blanket)" stroke="#f9e4c9" stroke-width="4"/>
 <path d="M498 417q38 59 53 98q12 46 15 62M522 393q24 72 38 86M519 510q27 12 49 35" fill="none" stroke="#b99c8a" stroke-width="5" opacity=".55"/>
 <path d="M489 403q-8 30 13 39l50 4q-19-36-30-53Z" fill="#fff3df"/>
 <g data-depth="0.25"><g class="nook-cat">
 <path d="M365 421q-26-54 35-77q86-29 132 19q27 29-2 61q-44 35-112 23q-36 4-53-26Z" fill="url(#catfur)" stroke="#915132" stroke-width="5"/>
 <path d="M423 365q-10 14-13 30M450 357q-15 17-17 34M483 357q-12 17-16 35" stroke="#9a4e31" opacity=".44" stroke-width="8" fill="none"/>
 <path d="M357 392q-22-30-3-52l12-31l20 20q34-11 48 22q10 32-23 54q-34 20-54-13Z" fill="url(#catfur)" stroke="#995436" stroke-width="4"/>
 <path d="M359 341l8-32l21 28M402 335l24-19l-1 32" fill="#c77a4c" stroke="#914f3c" stroke-width="4"/>
 <path d="M370 334l-2-14l10 14M409 336l11-10l-2 15" fill="#dba18b"/>
 <path d="M364 373q9 9 19 0M401 373q9 9 18-2" fill="none" stroke="#59372e" stroke-width="3" stroke-linecap="round"/>
 <path d="M389 381l8 1l-4 5z" fill="#9c5b56"/>
 <path d="M392 386q-4 5-11 4M393 386q4 5 11 3" fill="none" stroke="#6b4036" stroke-width="2"/>
 <path d="M423 425q48 4 75-16q34-23 51 7q12 21-17 29q-18 3-26-9" fill="none" stroke="#b36b3d" stroke-width="21" stroke-linecap="round"/>
 <path d="M365 386l-25-5M366 393l-26 4M410 390l27-4M407 395l25 7" stroke="#f6d4a1" stroke-opacity=".68" fill="none" stroke-width="1.6"/>
 </g></g>
 <g class="nook-table" data-depth="0.35"><ellipse cx="733" cy="510" rx="102" ry="23" fill="#211b20" opacity=".53" filter="url(#shadow)"/>
 <path d="M691 476l-17 91h12l29-91M781 472l32 95h12l-20-96" fill="#52382d"/><ellipse cx="750" cy="478" rx="101" ry="34" fill="url(#wood)" stroke="#b88859" stroke-width="6"/>
 <path d="M693 455q25-20 57 0l-8 13h-58Z" fill="#8f4c4b" stroke="#eac794" stroke-width="3"/><path d="M698 443q25-18 57 0l-6 15h-57Z" fill="#4c6874" stroke="#e6be87" stroke-width="2"/><path d="M707 430q26-16 53 0l-5 14h-52Z" fill="#c09068" stroke="#ead2a6" stroke-width="2"/>
 <ellipse cx="792" cy="437" rx="28" ry="9" fill="#d2a18b"/><path d="M765 394h52l-4 44q-24 19-46 0Z" fill="#d0a9a0" stroke="#f4dbb6" stroke-width="3"/><ellipse cx="790" cy="395" rx="26" ry="8" fill="#f5d9bc"/><ellipse cx="790" cy="396" rx="19" ry="5" fill="#73534e"/><path d="M816 401q24-4 19 15q-4 17-23 9" fill="none" stroke="#d6a799" stroke-width="8"/>
 <g class="nook-steam" stroke="#fff4d8" stroke-opacity=".6" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M779 383q-11-15 1-27t0-24"/><path d="M795 383q12-16 1-28t1-28"/><path d="M805 379q8-11 0-21t1-18"/></g></g>
 <g class="nook-lamp" data-depth="0.38"><ellipse cx="230" cy="552" rx="35" ry="9" fill="#301f24"/><path d="M224 543l4-237" stroke="#b99267" stroke-width="9"/><path d="M207 304h40l40 83q-62 24-116 0Z" fill="url(#shade)" stroke="#f8d1a8" stroke-width="5"/><path d="M211 307q-23 40-28 80M242 307q26 39 33 82" stroke="#fff5cb" stroke-opacity=".24" stroke-width="4" fill="none"/><ellipse cx="228" cy="385" rx="51" ry="12" fill="#ffc78f" opacity=".56"/><ellipse cx="230" cy="302" rx="22" ry="6" fill="#8b6270"/><ellipse class="nook-lamp-aura" cx="229" cy="394" rx="220" ry="226" fill="url(#lamplight)"/></g>
 </g>
 <g class="nook-sparkles" data-depth="1.10">${flecks}</g>
 <g data-depth="0.98"><path d="M68 46h824v613H68z" fill="none" stroke="#231c22" stroke-width="21"/><path d="M78 55h805v597H78z" fill="none" stroke="#b38d62" stroke-opacity=".8" stroke-width="4"/>
 <path d="M66 658q401 30 826 0l-21 30H87Z" fill="#a37c58"/><path d="M87 688h784" stroke="#f5d9ac" stroke-width="6"/></g><rect width="960" height="720" fill="url(#vignette)" pointer-events="none"/>
 </svg>
 <div class="nook-overlay">
 <div class="nook-eyebrow">THE LITTLE WORLDS COLLECTION <span>001 / RAINY READING NOOK</span></div>
 <div class="nook-bottom"><div><strong>Somewhere, a story is waiting.</strong><span>A quiet evening, one more chapter.</span></div>
 <div class="nook-buttons"><button data-a="lamp" aria-pressed="true">✺ Warm light</button><button data-a="rain" aria-pressed="true">☔ Rain</button><button data-a="stir">✦ Glimmer</button><button data-a="motion" aria-pressed="${!matchMedia('(prefers-reduced-motion:reduce)').matches}">Ⅱ Motion</button></div></div></div>`;
 const css=document.createElement('style');css.textContent=`
 .nook-world{position:absolute;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 43%,#5e4851,#1b1e2b 76%);color:#f6e5cd;font-family:Georgia,serif;isolation:isolate}
 .nook-illustration{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 18px 50px #050810a0);transform:scale(1);transform-origin:center}
 .nook-overlay{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:clamp(15px,3vw,30px);box-sizing:border-box}
 .nook-eyebrow{font:600 10px/1.5 system-ui;letter-spacing:.22em;color:#f2d8b0;display:flex;justify-content:space-between;text-shadow:0 2px 10px #111}
 .nook-eyebrow span{opacity:.75}.nook-bottom{display:flex;align-items:end;justify-content:space-between;gap:18px}.nook-bottom strong{display:block;font:italic clamp(19px,2.5vw,29px)/1.3 Georgia,serif;text-shadow:0 2px 14px #120e19}.nook-bottom span{display:block;font:12px/1.7 system-ui;color:#efd8bc}
 .nook-buttons{pointer-events:auto;display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.nook-buttons button{color:#fbe6c5;background:#211e29cf;border:1px solid #dbb99177;border-radius:99px;font:12px/1.2 system-ui;padding:11px 13px;backdrop-filter:blur(8px)}.nook-buttons button:hover{background:#624b4e}.nook-buttons button[aria-pressed=false]{opacity:.55}
 .nook-rain line{animation:nook-rain .85s linear infinite}.nook-rain line:nth-child(3n){animation-delay:-.43s}.nook-rain line:nth-child(5n){animation-duration:1.13s}
 .nook-cat{animation:nook-breathe 3.5s ease-in-out infinite;transform-origin:440px 419px}.nook-steam{animation:nook-steam 4s ease-in-out infinite;transform-origin:791px 385px}.nook-fleck{animation:nook-fleck 9s ease-in-out infinite}.nook-lamp-aura{mix-blend-mode:screen;pointer-events:none}.nook-world.nook-dark .nook-lamp-aura{opacity:0}.nook-world.nook-dry .nook-rain{display:none}.nook-world.nook-still .nook-rain line,.nook-world.nook-still .nook-cat,.nook-world.nook-still .nook-steam,.nook-world.nook-still .nook-fleck{animation-play-state:paused}
 @keyframes nook-breathe{50%{transform:translateY(-2px) scale(1.005)}}@keyframes nook-steam{50%{transform:translate(5px,-7px);opacity:.38}}@keyframes nook-fleck{50%{transform:translate(8px,-14px);opacity:.13}}@keyframes nook-rain{to{transform:translate(-12px,35px);opacity:0}}
 @media(max-width:720px){.nook-world{background:#201f2b}.nook-illustration{transform:scale(1.22)}.nook-overlay{padding:14px}.nook-eyebrow{font-size:8px;letter-spacing:.1em}.nook-bottom{flex-direction:column;align-items:start}.nook-bottom strong{font-size:19px}.nook-buttons{justify-content:start}.nook-buttons button{font-size:11px;padding:9px 10px}}
 @media(prefers-reduced-motion:reduce){.nook-rain line,.nook-cat,.nook-steam,.nook-fleck{animation:none!important}.nook-illustration{transition:none}}
 `;
 root.append(css);host.replaceChildren(root);
 let x=0,y=0,down=false,startX=0,startY=0,motion=!matchMedia('(prefers-reduced-motion:reduce)').matches,disposable=false;
 if(!motion)root.classList.add('nook-still');
 const svg=root.querySelector('svg');
 // Parallax runs on SVG groups, not the whole image: spatially separated
 // foreground and background planes keep the miniature framed.
 const planes=[...svg.querySelectorAll('[data-depth]')].map(el=>({el,depth:Number(el.dataset.depth)}));
 let shownX=0,shownY=0,raf=0,alive=true;
 const renderDepth=()=>{raf=0;if(!alive||document.hidden)return;
  shownX+=(x-shownX)*.14;shownY+=(y-shownY)*.14;
  for(const {el,depth} of planes)el.setAttribute('transform','translate('+(shownX*depth).toFixed(2)+' '+(shownY*depth).toFixed(2)+')');
  if(Math.abs(shownX-x)>.04||Math.abs(shownY-y)>.04)raf=requestAnimationFrame(renderDepth);
 };
 const wake=()=>{if(!raf&&alive&&!document.hidden)raf=requestAnimationFrame(renderDepth);};
 const pointerDown=e=>{down=true;startX=e.clientX;startY=e.clientY;svg.setPointerCapture(e.pointerId);};
 const pointerMove=e=>{if(!down)return;x=Math.max(-18,Math.min(18,x+(e.clientX-startX)*.10));y=Math.max(-12,Math.min(12,y+(e.clientY-startY)*.08));startX=e.clientX;startY=e.clientY;wake();};
 const pointerUp=()=>{down=false;};
 const reset=()=>{x=y=0;wake();};
 const onClick=e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
  if(a==='lamp'){root.classList.toggle('nook-dark');b.setAttribute('aria-pressed',String(!root.classList.contains('nook-dark')));}
  if(a==='rain'){root.classList.toggle('nook-dry');b.setAttribute('aria-pressed',String(!root.classList.contains('nook-dry')));}
  if(a==='motion'){motion=!motion;root.classList.toggle('nook-still',!motion);b.setAttribute('aria-pressed',String(motion));b.textContent=motion?'Ⅱ Motion':'▶ Motion';}
  if(a==='stir'){if(!motion||document.hidden)return;root.querySelectorAll('.nook-fleck').forEach((el,i)=>{el.animate([{opacity:.9,transform:'translateY(0px)'},{opacity:.3,transform:'translateY(-'+(8+i%5*8)+'px)'}],{duration:900+i%5*180,easing:'ease-out'});});}
 };
 const visibility=()=>{root.classList.toggle('nook-still',document.hidden||!motion);if(!document.hidden)wake();};
 svg.addEventListener('pointerdown',pointerDown);svg.addEventListener('pointermove',pointerMove);svg.addEventListener('pointerup',pointerUp);svg.addEventListener('pointercancel',pointerUp);svg.addEventListener('dblclick',reset);root.addEventListener('click',onClick);document.addEventListener('visibilitychange',visibility);
 current={pause(){root.classList.add('nook-still');},resume(){if(motion)root.classList.remove('nook-still');},dispose(){if(disposable)return;disposable=true;alive=false;cancelAnimationFrame(raf);svg.removeEventListener('pointerdown',pointerDown);svg.removeEventListener('pointermove',pointerMove);svg.removeEventListener('pointerup',pointerUp);svg.removeEventListener('pointercancel',pointerUp);svg.removeEventListener('dblclick',reset);root.removeEventListener('click',onClick);document.removeEventListener('visibilitychange',visibility);root.remove();current=null;}};
}
return{mount,dispose(){current?.dispose();},pause(){current?.pause();},resume(){current?.resume();}};
})();