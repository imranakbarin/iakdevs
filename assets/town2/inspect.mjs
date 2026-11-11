// New Toy Town: what to say about a thing that was tapped. Pure (no THREE, no DOM): takes the sim and returns {title, lines}.
import {BUILDINGS, CAST, STATIONS, DAY, DAYS, MARKET, VENDORS, building} from './def.mjs';
import {STORIES} from './stories.mjs';
import {top, bond} from './memory.mjs';
import {stageOf} from './track.mjs';
export const clockText = h => { const m = Math.round(((h % 24) + 24) % 24 * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

const nameOf = id => (BUILDINGS.find(b => b.id === id) || {}).name || id;
const upper = s => s.charAt(0).toUpperCase() + s.slice(1);
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

const stationName = (sim, id) => ((sim.train.stations || []).find(x => x.id === id) || {}).name || id;
export function describeResident(sim, r) {
  const lines = [], load = r.carrying && sim.cargo.find(c => c.id === r.carrying);
  if (r.state === 'riding') { lines.push('Riding the train to ' + stationName(sim, r.rideTo)); lines.push('Lives at ' + nameOf(r.def.home)); return {title: r.def.name, lines}; }
  if (r.onPlatform && r.rideTo) { lines.push('Waiting on the platform for the train to ' + stationName(sim, r.rideTo)); lines.push('Lives at ' + nameOf(r.def.home)); return {title: r.def.name, lines}; }
  if (r.state === 'walking') {
    const err = r.stay !== null && r.stay !== undefined;
    if (r.def.lamplighter && r.lampJob) lines.push(r.lampJob === 'light' ? 'Lighting the street lamps' : 'Putting out the street lamps');
    else lines.push(r.pause > 0 && r.look ? 'Stopping to say hello to ' + r.look.def.name : (err ? 'Off on an errand to ' : 'On the way to ') + nameOf(r.target));
    const st = sim.story.current && STORIES.find(s => s.id === sim.story.current.id);
    if (st && st.go.some(([who]) => who === r.id)) lines.push('Part of today\'s story: ' + st.title);
  } else lines.push(r.at === 'market' ? (VENDORS.includes(r.id) && sim.market.open ? 'Selling at the market' : 'Browsing the stalls at the market') : r.onPlatform ? 'On the platform at ' + stationName(sim, r.at.replace('platform:', '')) : 'Indoors at ' + nameOf(r.at));
  if (load) lines.splice(1, 0, 'Carrying ' + load.label + ' to ' + nameOf(load.to));
  if (r.mood) lines.splice(Math.min(lines.length, load ? 2 : 1), 0, 'Feeling ' + r.mood.label + (r.mood.why ? ': ' + r.mood.why : ''));
  if (r.def.job) lines.push('Job: ' + r.def.job + (r.age ? ', age ' + r.age : ''));
  if (r.spouse) { const sp = sim.residents.find(x => x.id === r.spouse); if (sp) lines.push('Married to ' + sp.def.name + (r.kids ? ', ' + (r.kids === 1 ? 'one child' : r.kids + ' children') : '')); }
  if (r.caught) lines.push('Has caught ' + r.caught + ' fish so far');
  if (r.at === 'pier' && r.state === 'inside') lines.splice(0, 1, 'Fishing from the end of the pier');
  { const mine = STORIES.filter(x => x.star === r.id); if (mine.length) { const told = mine.filter(x => (sim.story.count[x.id] || 0) > 0).length, cur = sim.story.current && mine.find(x => x.id === sim.story.current.id); lines.push((cur ? 'Their story right now: ' + cur.title : 'Stories told: ' + told + ' of ' + mine.length)); } }
  if (r.friends) { const fr = top(r.friends, 2, 2).map(id => { const o = sim.residents.find(x => x.id === id); return o ? o.def.name + ' (' + bond(r.friends[id]) + ')' : null; }).filter(Boolean); if (fr.length) lines.push('Friends with ' + fr.join(' and ')); }
  if (r.visits) { const fav = top(r.visits, 1, 2)[0]; if (fav && nameOf(fav)) lines.push('Often at ' + nameOf(fav)); }
  lines.push('Lives at ' + nameOf(r.def.home));
  return {title: r.def.name, lines};
}

export function describeBuilding(sim, b) {
  const inside = sim.residents.filter(r => r.state === 'inside' && r.at === b.id).map(r => r.def.name);
  const lives = CAST.filter(c => c.home === b.id).map(c => c.name);
  const lines = [];
  if (b.id === 'station') { const tt = sim.timetable().sort((a, c) => a.eta - c.eta); lines.push('Timetable: ' + tt.map(t => (t.name.replace(' Station', '').replace(' Halt', '')) + ' ' + (t.eta < 1 ? 'now' : clockText(t.hour))).join(' · ')); }
  if (b.id === 'market') { const m = sim.market; lines.push(m.open ? m.cfg.name + '! Open until ' + m.cfg.to + ':00, ' + m.visits + ' visits so far' : 'Open on ' + Object.keys(MARKET.days).map(k => DAYS[k] + 's (' + MARKET.days[k].from + ' to ' + MARKET.days[k].to + ')').join(' and ')); }
  if (b.door > 0 && b.id !== 'market') lines.push(inside.length ? 'Inside now: ' + list(inside) : 'Nobody in right now');
  if (lives.length) lines.push('Home of ' + list(lives));
  const garaged = sim.vehicles.filter(v => v.def.home === b.id && v.state === 'parked').map(v => v.def.name);
  if (garaged.length) lines.push('In the garage: ' + list(garaged));
  if (!lines.length) lines.push('Everybody is welcome here');
  return {title: upper(b.name), lines};
}

export function describeVehicle(sim, v) {
  const d = v.def, lines = [], PLAN = {line: 'On its round of the bus stops', round: 'Going round the houses', taxi: 'Looking for a fare', wander: 'Pottering about the town', stops: 'Calling at the shops and the square', call: 'Out on a call'};
  if (v.state === 'returning') lines.push('Heading back to ' + nameOf(d.home));
  else if (d.onCall && v.call > 0) lines.push('Out on a call');
  else if (v.wait > 0) lines.push(v.target && v.target.id ? 'Waiting at ' + nameOf(v.target.id) : 'Stopped for a moment');
  else if (v.v < .05) lines.push('Stopped for a moment');
  else lines.push(PLAN[d.plan] || 'On the road');
  if (v.target && v.target.id && !v.wait && v.state !== 'returning') lines.push('Heading for ' + nameOf(v.target.id));
  lines.push('Keeps in ' + nameOf(d.home));
  return {title: upper(d.name), lines};
}

const ANIMALS = {cow: ['A cow', 'Chewing grass in the paddock'], sheep: ['A sheep', 'Wandering the paddock'], duck: ['A duck', 'Paddling on the pond']};
export const describeAnimal = kind => ({title: ANIMALS[kind][0], lines: [ANIMALS[kind][1]]});
export const describeTrain = sim => {
  const st = sim.train.at && (sim.train.stations || []).find(x => x.id === sim.train.at), next = sim.train.stations[sim.train.next], n = k => sim.cargo.filter(c => c.state === 'train' && c.kind === k).length;
  const load = [['mail', 'mail sack'], ['milk', 'milk churn'], ['bread', 'basket of loaves'], ['parcel', 'parcel']].map(([k, w]) => n(k) ? n(k) + ' ' + w + (n(k) > 1 && k !== 'bread' ? 's' : '') : null).filter(Boolean);
  return {title: 'The little train', lines: [st ? 'Standing at ' + st.name + ' while the passengers hop on and off' : 'Chugging round the town on the railway loop', 'Carrying ' + (sim.riders.length ? sim.riders.length + ' passenger' + (sim.riders.length > 1 ? 's' : '') : 'no passengers') + (load.length ? ' and ' + load.join(', ') : ''), next ? 'Next stop: ' + next.name + (() => { const t = sim.timetable().find(x => x.id === next.id); return t && t.eta >= 1 ? ' at ' + clockText(t.hour) : ''; })() : 'Runs all the way round the town']};
};
export const buildingAt = id => building(id);
