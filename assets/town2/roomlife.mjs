// Town interiors react to REAL simulation data. Pure, deterministic and safe to test in Node.
// No fictitious sales, customers, classes or train arrivals are generated for the rooms.
export const ROOM_STAFF = Object.freeze({bakery:'crumb',cafe:'pott',school:'chalk',station:'otto'});
export const ROOM_IDS = Object.keys(ROOM_STAFF);
const bounded = (v,lo,hi) => Math.min(hi,Math.max(lo,Number.isFinite(+v)?+v:0));
const daylight = hour => hour >= 6.5 && hour < 19;
const daytime = (hour,a,b) => hour >= a && hour < b;

export function planRoom(id, world = {}) {
  if (!Object.hasOwn(ROOM_STAFF,id)) return null;
  const hour = bounded(world.hour ?? 12,0,24), rain = bounded(world.rain ?? 0,0,1);
  const residents = Array.isArray(world.residents)?world.residents:[];
  const here = residents.filter(r=>r && r.at === id && r.state === 'inside');
  const staffHere = here.some(r=>r.id===ROOM_STAFF[id]);
  const visitorHere = here.some(r=>r.id!==ROOM_STAFF[id]);
  const visitors = here.filter(r=>r.id!==ROOM_STAFF[id]).length;
  const stock = world.pantry || {};
  const eggs = bounded(stock.eggs,0,999), milk = bounded(stock.milk,0,999);
  const trainHere = id==='station' && world.trainAt === 'central';
  const lesson = id==='school' && bounded(world.weekday ?? 0,0,6)<5 && daytime(hour,8,16);
  const oven = id==='bakery' && daytime(hour,5.5,18.5) && (eggs>0 || milk>0);
  // Shelf pastries are a decorative indicator of a stocked pantry, never presented as an item count.
  const bread = id==='bakery' ? Math.min(9,Math.floor((eggs+milk)/3)) : 0;
  const tea = id==='cafe' && visitors>0 && daytime(hour,7,20);
  const board = id==='station' && trainHere;
  const isDay = daylight(hour);
  const hue = !isDay?'#817b86':rain>.4?'#a7b6b9':'#d7dfd5';
  const status = id==='bakery'
    ? (oven ? 'Oven warm · '+Math.floor(eggs)+' eggs, '+Math.floor(milk)+' milk in the pantry':'Oven resting · '+Math.floor(eggs)+' eggs, '+Math.floor(milk)+' milk in the pantry')
    : id==='cafe' ? (visitors>0? visitors+' resident'+(visitors===1?'':'s')+' having tea':'The tables are quiet')
    : id==='school' ? (lesson?'School day · classroom in session':'Classroom closed for lessons')
    : trainHere ? 'Train standing at the central platform' : 'Waiting for the next train';
  return {
    id,status,staffHere,visitorHere,visitors,oven,bread,tea,lesson,board,trainHere,
    weatherRain:rain,night:!isDay,sky:hue,
    ambient:isDay?(rain>.4?1.24:1.65):.92,
    lamp:!isDay?1.9:rain>.4?1.25:.7
  };
}
