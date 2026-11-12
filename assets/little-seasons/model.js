(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.LittleSeasons=model;})(typeof window!=='undefined'?window:this,()=>{
'use strict';
const locations={sanford:{name:'Sanford, Florida',lat:28.8029,lon:-81.2695,zone:'America/New_York'},london:{name:'London, UK',lat:51.5072,lon:-.1276,zone:'Europe/London'},tokyo:{name:'Tokyo, Japan',lat:35.6762,lon:139.6503,zone:'Asia/Tokyo'},chittoor:{name:'Chittoor, India',lat:13.2172,lon:79.1003,zone:'Asia/Kolkata'},sydney:{name:'Sydney, Australia',lat:-33.8688,lon:151.2093,zone:'Australia/Sydney'}};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function seasonAt(date,lat,zone){const m=Number(new Intl.DateTimeFormat('en',{month:'numeric',timeZone:zone}).format(date));let i=Math.floor((m%12)/3);if(lat<0)i=(i+2)%4;return ['winter','spring','summer','autumn'][i];}
function weatherKind(code){if([71,73,75,77,85,86].includes(code))return 'snow';if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(code))return 'rain';if([45,48].includes(code))return 'fog';if([2,3].includes(code))return 'cloud';return [0,1].includes(code)?'clear':'unknown';}
function description(code){const names={0:'Clear skies',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Steady drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorms',96:'Thunderstorms with hail',99:'Thunderstorms with hail'};return names[code]||'Conditions unavailable';}
function urlFor(place){const u=new URL('https://api.open-meteo.com/v1/forecast');u.search=new URLSearchParams({latitude:place.lat,longitude:place.lon,current:'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m',hourly:'temperature_2m,weather_code,is_day',daily:'sunrise,sunset',timezone:'auto',timeformat:'unixtime',forecast_days:'2'});return u.href;}
function parse(data,now=Date.now()){
 const c=data&&data.current;if(!c||!finite(c.temperature_2m)||!finite(c.time)||c.time<=0||c.time*1000>now+15*60e3)throw Error('Invalid current conditions');
 const zone=data.timezone;try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();}catch{throw Error('Invalid timezone');}if(typeof zone!=='string')throw Error('Missing timezone');
 const h=data.hourly||{},times=Array.isArray(h.time)?h.time:[];const hourly=times.map((time,i)=>({time,temp:h.temperature_2m?.[i],code:h.weather_code?.[i],day:h.is_day?.[i]})).filter(v=>finite(v.time)&&v.time*1000>=now&&finite(v.temp)).slice(0,6);
 const daily=data.daily||{};const days=(daily.time||[]).map((time,i)=>({time,rise:daily.sunrise?.[i],set:daily.sunset?.[i]}));
 return {current:c,zone,hourly,days,fetchedAt:now};
}
function freshness(data,now=Date.now()){return data&&now-data.current.time*1000<=45*60e3&&now-data.fetchedAt<=20*60e3?'fresh':'stale';}
function daylight(data,now=Date.now()){
 if(!data)return {known:false,night:false,progress:0};
 const key=t=>new Intl.DateTimeFormat('en-CA',{timeZone:data.zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
 const day=data.days.find(d=>finite(d.time)&&key(d.time*1000)===key(now));
 if(!day||!finite(day.rise)||!finite(day.set)||day.set<=day.rise)return {known:false,night:data.current.is_day===0,progress:0};
 const rise=day.rise*1000,set=day.set*1000;return {known:true,night:now<rise||now>=set,rise,set,progress:Math.max(0,Math.min(1,(now-rise)/(set-rise)))};
}
const temperature=(v,f)=>finite(v)?Math.round(f?v*9/5+32:v)+'°'+(f?'F':'C'):'—';
return {locations,finite,seasonAt,weatherKind,description,urlFor,parse,freshness,daylight,temperature};
});
