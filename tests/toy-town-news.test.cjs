'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {parseRss,chooseStories,refresh,safeUrl}=require('../scripts/refresh-toy-town-news.cjs');
const now=Date.parse('2026-11-01T18:00:00Z');
const feed={source:'BBC Sport',category:'Sport',url:'https://feeds.bbci.co.uk/sport/rss.xml'};
const xml='<?xml version="1.0"?><rss version="2.0"><channel>'+
  '<item><title>India &amp; England final preview</title>'+
  '<link>https://www.bbc.co.uk/sport/example</link>'+
  '<pubDate>Sun, 01 Nov 2026 17:30:00 GMT</pubDate></item>'+
  '<item><title>Ancient story should never reappear</title>'+
  '<link>https://www.bbc.co.uk/sport/old</link>'+
  '<pubDate>Sun, 25 Oct 2026 00:00:00 GMT</pubDate></item>'+
  '</channel></rss>';
assert.equal(parseRss(xml,feed,now).length,1,'only recent attributed headlines survive');
assert.equal(parseRss(xml,feed,now)[0].title,'India & England final preview');
assert.equal(safeUrl('javascript:alert(1)'),'','unsafe story destination excluded');
assert.throws(()=>parseRss('<html>not rss</html>',feed,now));
const same=[
  {title:'A sporting achievement today',source:'BBC Sport',category:'Sport',published_at:new Date(now-5000).toISOString(),url:'https://www.bbc.co.uk/sport/s'},
  {title:'World headline from a publisher',source:'DW',category:'World',published_at:new Date(now-2000).toISOString(),url:'https://www.dw.com/en/word'},
  {title:'Business update in the economy',source:'BBC Business',category:'Business',published_at:new Date(now-3000).toISOString(),url:'https://bbc.co.uk/business'},
  {title:'Technology discovery announced',source:'BBC Technology',category:'Technology',published_at:new Date(now-1000).toISOString(),url:'https://bbc.co.uk/technology'}
];
assert.equal(chooseStories([...same,...same]).length,4,'dedupe headlines');
assert.equal(new Set(chooseStories(same).map(i=>i.category)).size,4,'news spans four topics');
assert.equal(chooseStories([
  {...same[1],category:'World',published_at:new Date(now-1000).toISOString()},
  {...same[1],source:'BBC Technology',category:'Technology'}
])[0].category,'Technology',
'cross-posted headlines retain their more useful specialist topic');
// Tone: heavy stories never lead and are capped; light ones are staged.
{
  const T=globalThis.ToyTownNews;
  assert.equal(T.tone('Missiles hit the capital as the war enters a new week'),'heavy');
  assert.equal(T.tone('Firework display lights up the harbour for the festival'),'light','fireworks are not fire');
  assert.equal(T.tone('A giant panda cub is born at the zoo'),'light');
  const mk=(t,i)=>({title:t,source:'BBC News',category:'World',published_at:new Date(now-i*1000).toISOString(),url:'https://www.bbc.co.uk/x'+i,tone:T.tone(t)});
  const heavy=['Troops killed in border attack','Bomb blast injures dozens in market','Court jails fraud ringleader after trial','Storm leaves thousands without power'].map((t,i)=>mk(t,i));
  const light=['Panda cub makes its first public appearance','Team wins the cup final in a thriller','Scientists discover a new species of frog'].map((t,i)=>mk(t,i+10));
  const picked=chooseStories([...heavy,...light]);
  assert.ok(picked.slice(0,3).every(i=>i.tone==='light'),'light stories lead');
  assert.ok(picked.filter(i=>i.tone==='heavy').length<=2,'at most two heavy stories');
  const code=fs.readFileSync(path.join(__dirname,'../assets/toy-town-news.js'),'utf8');
  const ctx=vm.createContext({Date,URL,setTimeout,clearTimeout});vm.runInContext(code,ctx);
  const cleaned=ctx.ToyTownNews.clean({version:1,generated_at:new Date(now).toISOString(),stories:[...heavy.slice(0,2),...light].map(i=>({...i,tone:undefined}))},now);
  assert.equal(cleaned.stories[0].tone,'light','the browser puts a light story first even from an older payload without tone');
  assert.equal(cleaned.stories[cleaned.stories.length-1].tone,'heavy','and heavy ones follow');
}
(async()=>{
  const mixed=await refresh({now,feeds:[feed,{source:'Broken Feed',category:'World',url:'https://example.com'}],
    fetcher:async url=>{if(url.includes('example'))throw Error('down');return xml;}});
  assert.equal(mixed.payload.stories.length,1,'one failed publisher does not erase successful feed');
  assert.equal(mixed.payload.status,'partial','reduced coverage is disclosed');
  assert.equal(mixed.payload.successful_sources.length,1,'source provenance retained');
  const code=fs.readFileSync(path.join(__dirname,'../assets/toy-town-news.js'),'utf8');
  const ctx=vm.createContext({Date,URL,setTimeout,clearTimeout});
  vm.runInContext(code,ctx);
  const clean=ctx.ToyTownNews.clean;
  const good=clean({version:1,generated_at:new Date(now).toISOString(),stories:same},now);
  assert.equal(good.stories.length,4,'valid headlines available to the browser');
  const stale=clean({version:1,generated_at:new Date(now-9*3600000).toISOString(),stories:same},now);
  assert.equal(stale,null,'old cache is never labeled fresh news');
  const suspicious=clean({version:1,generated_at:new Date(now).toISOString(),
    stories:[{...same[0],url:'javascript:alert(1)'}]},now);
  assert.equal(suspicious.stories.length,0,'client rejects javascript links');
  console.log('Toy Town NEWS PASS: RSS parsing, timestamps, publisher failures, coverage, dedupe, stale cache and link safety');
})().catch(e=>{console.error(e);process.exitCode=1;});
