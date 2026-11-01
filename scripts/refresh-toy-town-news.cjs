/* Hourly, key-free, attributed news for static Toy Town.
 * Publishers' RSS is read server-side by GitHub Actions; browsers never
 * scrape RSS, use a CORS proxy, or hold credentials. */
'use strict';
const https=require('node:https');
const fs=require('node:fs/promises');
const path=require('node:path');
const FEEDS=[
  {source:'BBC News',category:'World',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
  {source:'BBC Technology',category:'Technology',url:'https://feeds.bbci.co.uk/news/technology/rss.xml'},
  {source:'BBC Business',category:'Business',url:'https://feeds.bbci.co.uk/news/business/rss.xml'},
  {source:'BBC Sport',category:'Sport',url:'https://feeds.bbci.co.uk/sport/rss.xml'},
  {source:'DW',category:'World',url:'https://rss.dw.com/xml/rss-en-world'},
  {source:'Ars Technica',category:'Technology',url:'https://feeds.arstechnica.com/arstechnica/index'}
];
const MAX_ARTICLE_AGE_MS=30*60*60*1000;
const decode=s=>String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi,'$1')
  .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>{
    const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):parseInt(code,10);
    return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';
  }).replace(/&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip);/gi,(_,n)=>({
    amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'—',ndash:'–',hellip:'…'
  })[n.toLowerCase()]||' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const value=(chunk,tag)=>{
  const match=chunk.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return match?decode(match[1]):'';
};
const safeUrl=u=>{
  try{
    const v=new URL(u);
    return v.protocol==='https:'&&
      !/^(localhost|127\.|10\.|192\.168\.|172\.)/.test(v.hostname) ?
        v.href:'';
  }catch(_){return '';}
};
function parseRss(xml,feed,now=Date.now()){
  if(!/<(?:rss|rdf:RDF)\b/i.test(xml)||!/<item[\s>]/i.test(xml))
    throw Error('Not an RSS feed: '+feed.source);
  const items=[];
  for(const match of xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)){
    const chunk=match[0],title=value(chunk,'title'),url=safeUrl(value(chunk,'link'));
    const raw=value(chunk,'pubDate')||value(chunk,'dc:date');
    const time=Date.parse(raw);
    if(title.length<12||title.length>240||!url||
      !Number.isFinite(time)||time>now+15*60*1000||
      now-time>MAX_ARTICLE_AGE_MS)continue;
    items.push({title,url,source:feed.source,category:feed.category,
      published_at:new Date(time).toISOString()});
  }
  return items;
}
function chooseStories(all,limit=9){
  // Dedupe across RSS sections while retaining a specialized category
  // (technology, business, sport) when that title also appears in World.
  const byTitle=new Map();
  for(const item of [...all].sort((a,b)=>
    Date.parse(b.published_at)-Date.parse(a.published_at))){
    const key=item.title.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,90);
    const current=byTitle.get(key);
    if(!current||(current.category==='World'&&item.category!=='World'))
      byTitle.set(key,item);
  }
  const valid=[...byTitle.values()].sort((a,b)=>
    Date.parse(b.published_at)-Date.parse(a.published_at));
  const picked=[],categories=['World','Technology','Business','Sport'];
  const used=new Set();
  // Breadth and source diversity beat a feed full of near-identical sports
  // stories, but publication time determines order within each section.
  for(let round=0;round<3&&picked.length<limit;round++){
    for(const category of categories){
      if(picked.length>=limit)break;
      const pool=valid.filter(item=>item.category===category&&!picked.includes(item));
      const article=pool.find(item=>!used.has(item.source))||pool[0];
      if(article){picked.push(article);used.add(article.source);}
    }
  }
  for(const article of valid){
    if(picked.length>=limit)break;
    if(!picked.includes(article))picked.push(article);
  }
  return picked.slice(0,limit);
}
function get(url,redirects=2){
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{headers:{
      'User-Agent':'ToyTownNewsBot/1.0 (github.com/imranakbarin/iakdevs; public RSS)',
      'Accept':'application/rss+xml, application/xml, text/xml;q=0.8',
    },timeout:9000},res=>{
      if([301,302,307,308].includes(res.statusCode)&&redirects>0){
        res.resume();const destination=new URL(res.headers.location||'',url).href;
        if(!destination.startsWith('https://'))return reject(Error('Unsafe redirect'));
        get(destination,redirects-1).then(resolve,reject);return;
      }
      if(res.statusCode!==200){res.resume();reject(Error('HTTP '+res.statusCode));return;}
      const chunks=[];let bytes=0;
      res.on('data',chunk=>{
        bytes+=chunk.length;
        if(bytes>950000){request.destroy(Error('Feed too large'));return;}
        chunks.push(chunk);
      });
      res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error',reject);
    });
    request.on('timeout',()=>request.destroy(Error('RSS request timed out')));
    request.on('error',reject);
  });
}
async function refresh({feeds=FEEDS,fetcher=get,now=Date.now()}={}){
  const results=await Promise.all(feeds.map(async feed=>{
    try{return {feed,items:parseRss(await fetcher(feed.url),feed,now),ok:true};}
    catch(e){return {feed,items:[],ok:false,error:String(e.message||e)};}
  }));
  const successful=results.filter(r=>r.ok);
  const stories=chooseStories(results.flatMap(r=>r.items));
  const payload={
    version:1,generated_at:new Date(now).toISOString(),
    status:stories.length>=3?'ok':stories.length?'partial':'unavailable',
    successful_sources:successful.map(r=>r.feed.source),
    stories
  };
  return {payload,results};
}
if(require.main===module){
  (async()=>{
    const {payload,results}=await refresh();
    const file=path.resolve(__dirname,'../assets/toy-town-news.json');
    // Publishing a failed refresh must not falsely refresh existing articles:
    // leave their original generated_at untouched and let the client age out.
    if(payload.stories.length){
      await fs.writeFile(file,JSON.stringify(payload,null,2)+'\n');
    }else{
      try{await fs.access(file);}
      catch(_){await fs.writeFile(file,JSON.stringify(payload,null,2)+'\n');}
    }
    process.stdout.write(JSON.stringify({
      status:payload.status,stories:payload.stories.length,
      sources:results.map(r=>({name:r.feed.source,ok:r.ok,items:r.items.length,error:r.error}))
    })+'\n');
    if(!payload.stories.length)process.exitCode=1;
  })().catch(e=>{console.error(e);process.exitCode=1;});
}
module.exports={FEEDS,MAX_ARTICLE_AGE_MS,decode,parseRss,chooseStories,refresh,safeUrl};
