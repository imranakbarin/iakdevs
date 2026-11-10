// New Toy Town: what to say about a thing that was tapped. Pure (no THREE, no DOM): takes the sim and returns {title, lines}.
import {BUILDINGS, CAST, STATIONS, building} from './def.mjs';
import {STORIES} from './stories.mjs';

const nameOf = id => (BUILDINGS.find(b => b.id === id) || {}).name || id;
const upper = s => s.charAt(0).toUpperCase() + s.slice(1);
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

export function describeResident(sim, r) {
  const lines = [];
  if (r.state === 'walking') {
    const err = r.stay !== null && r.stay !== undefined;
    if (r.def.lamplighter && r.lampJob) lines.push(r.lampJob === 'light' ? 'Lighting the street lamps' : 'Putting out the street lamps');
    else lines.push(r.pause > 0 && r.look ? 'Stopping to say hello to ' + r.look.def.name : (err ? 'Off on an errand to ' : 'On the way to ') + nameOf(r.target));
    const st = sim.story.current && STORIES.find(s => s.id === sim.story.current.id);
    if (st && st.go.some(([who]) => who === r.id)) lines.push('Part of today\'s story: ' + st.title);
  } else lines.push('Indoors at ' + nameOf(r.at));
  lines.push('Lives at ' + nameOf(r.def.home));
  return {title: r.def.name, lines};
}

export function describeBuilding(sim, b) {
  const inside = sim.residents.filter(r => r.state === 'inside' && r.at === b.id).map(r => r.def.name);
  const lives = CAST.filter(c => c.home === b.id).map(c => c.name);
  const lines = [];
  if (b.door > 0) lines.push(inside.length ? 'Inside now: ' + list(inside) : 'Nobody in right now');
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
export const describeTrain = sim => { const st = sim.train.at && STATIONS.find(x => x.id === sim.train.at), next = sim.train.stations[sim.train.next]; return {title: 'The little train', lines: [st ? 'Standing at ' + st.name + ' while the passengers hop on and off' : 'Chugging round the town on the railway loop', next ? 'Next stop: ' + next.name : 'Runs all the way round the town']}; };
export const buildingAt = id => building(id);
