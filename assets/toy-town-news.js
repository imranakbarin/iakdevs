/* News is a separate, explicitly sourced editorial surface.
 * The whimsical town ticker is NOT a reporting source. */
(function(root){
  'use strict';
  const RAW='https://raw.githubusercontent.com/imranakbarin/iakdevs/master/assets/toy-town-news.json';
  const LOCAL='assets/toy-town-news.json';
  const HOUR=3600000,MAX_FEED_AGE=6*HOUR,MAX_HEADLINE_AGE=30*HOUR;
  /* Tone: a heavy headline (war, death, disaster, crime, crisis) is kept out of the town's lead and hidden behind a
     "show serious stories" button; the town leads with, and stages, the lighter ones. Whole words, or word beginnings
     ending in '*' (so "fire" never blocks "fireworks"). */
  const HEAVY=['kill*','dead','death*','dies','died','dying','war','wars','warfare','attack*','bomb*','shoot*','shot','murder*','crash*','earthquake*','flood*','wildfire*','blaze','hostage*','terror*','massacre*','injur*','victim*','casualt*','wound*','stab*','explosion*','blast*','missile*','troops','invasion','invade*','military','ceasefire','genocide','refugee*','famine','drought','hurricane*','tornado*','storm*','outbreak*','virus','pandemic','cancer','surgery','abuse*','assault*','rape*','crime*','arrest*','jail*','prison*','sentenc*','trial','fraud','scandal*','lawsuit*','sue','sues','sanction*','conflict*','strike*','protest*','riot*','crisis','collapse*','plunge*','slump*','tumble*','fears','threat*','warns','warning','layoff*','job cuts','shortage*','recall*','toll','iran','gaza','ukraine','russia','israel','hamas','sudan','trump'];
  const esc=w=>w.replace(/[.+?^${}()|[\]\\]/g,'\\$&');
  const hit=(text,w)=>w.endsWith('*')?new RegExp('\\b'+esc(w.slice(0,-1)),'i').test(text):new RegExp('\\b'+esc(w)+'\\b','i').test(text);
  const tone=title=>HEAVY.some(w=>hit(String(title||''),w))?'heavy':'light';
  const clean=(payload,now=Date.now())=>{
    if(!payload||payload.version!==1||!Array.isArray(payload.stories))return null;
    const generated=Date.parse(payload.generated_at);
    if(!Number.isFinite(generated)||generated>now+5*60000||now-generated>MAX_FEED_AGE)return null;
    const stories=payload.stories.filter(s=>{
      if(!s||typeof s.title!=='string'||s.title.length<12||
        typeof s.url!=='string'||typeof s.source!=='string')return false;
      let url;
      try{url=new URL(s.url);}catch(_){return false;}
      const time=Date.parse(s.published_at);
      return url.protocol==='https:'&&Number.isFinite(time)&&time<=now+600000&&
        now-time<=MAX_HEADLINE_AGE;
    }).map(s=>({...s,tone:s.tone==='heavy'||s.tone==='light'?s.tone:tone(s.title)})).slice(0,9);
    // Light stories lead (newest first within each tone); heavy ones follow.
    stories.sort((a,b)=>(a.tone==='heavy')-(b.tone==='heavy'));
    return {status:stories.length>=3?'live':stories.length?'limited':'unavailable',
      stories,generated_at:payload.generated_at};
  };
  const fetchJson=async url=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('News HTTP '+response.status);
      return await response.json();
    }finally{clearTimeout(timer);}
  };
  const unavailable=()=>({status:'unavailable',stories:[],generated_at:null});
  async function load(){
    const q='?updated='+Math.floor(Date.now()/60000);
    for(const url of [RAW+q,LOCAL+q]){
      try{
        const data=clean(await fetchJson(url));
        if(data&&data.stories.length)return data;
      }catch(_){}
    }
    return unavailable();
  }
  const age=(when,now=Date.now())=>{
    const mins=Math.max(0,Math.floor((now-Date.parse(when))/60000));
    return mins<2?'just now':mins<60?mins+'m ago':
      mins<1440?Math.floor(mins/60)+'h ago':Math.floor(mins/1440)+'d ago';
  };
  function paint(feed){
    if(typeof document==='undefined')return;
    const status=document.getElementById('news-status'),
      headline=document.getElementById('news-headline'),
      list=document.getElementById('headlines');
    if(!status||!headline||!list)return;
    const all=feed&&feed.stories?feed.stories:[],lightOnes=all.filter(s=>s.tone!=='heavy'),heavyOnes=all.filter(s=>s.tone==='heavy');
    let showHeavy=false;try{showHeavy=localStorage.getItem('toy-town:serious')==='1';}catch(_){}
    const live=all.length>0;
    status.textContent=live?'HEADLINES · '+age(feed.generated_at):'HEADLINES UNAVAILABLE';
    headline.textContent=live?(lightOnes[0]||all[0]).title:
      'The town is playing its own story today. No verified headlines available.';
    list.replaceChildren();
    if(!live)return;
    const add=item=>{
      const link=document.createElement('a');
      link.className='headline-item';link.href=item.url;
      link.target='_blank';link.rel='noopener noreferrer';
      const title=document.createElement('span');title.className='headline-title';
      title.textContent=item.title;
      const meta=document.createElement('small');meta.textContent=
        item.source+' · '+age(item.published_at);
      link.append(title,meta);list.append(link);
    };
    for(const item of lightOnes)add(item);
    if(heavyOnes.length){
      const more=document.createElement('button');more.type='button';more.className='headline-more';
      more.textContent=showHeavy?'Hide serious stories':'Show '+heavyOnes.length+' serious '+(heavyOnes.length===1?'story':'stories');
      more.addEventListener('click',()=>{try{localStorage.setItem('toy-town:serious',showHeavy?'0':'1');}catch(_){}paint(feed);});
      list.append(more);
      if(showHeavy)for(const item of heavyOnes)add(item);
    }
  }
  function init(){
    if(typeof document==='undefined')return;
    const button=document.getElementById('news-toggle');
    const panel=document.getElementById('news-panel');
    if(!button||!panel)return;
    button.addEventListener('click',()=>{
      panel.hidden=!panel.hidden;
      button.setAttribute('aria-expanded',String(!panel.hidden));
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!panel.hidden){
        panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();
      }
    });
  }
  root.ToyTownNews={clean,load,age,paint,init,tone,HEAVY};
})(typeof window!=='undefined'?window:globalThis);
