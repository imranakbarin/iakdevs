// New Toy Town: what to say about a thing that was tapped. Pure (no THREE, no DOM): takes the sim and returns {title, lines}.
import {BUILDINGS, CAST, building} from './def.mjs';
import {STORIES} from './stories.mjs';

const nameOf = id => (BUILDINGS.find(b => b.id === id) || {}).name || id;
const upper = s => s.charAt(0).toUpperCase() + s.slice(1);
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];

export function describeResident(sim, r) {
  const lines = [];
  if (r.state === 'walking') {
    const err = r.stay !== null && r.stay !== undefined;
    lines.push((err ? 'Off on an errand to ' : 'On the way to ') + nameOf(r.target));
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
  const d = v.def, lines = [];
  if (v.state === 'returning') lines.push('Heading back to ' + nameOf(d.home));
  else if (d.onCall && v.call > 0) lines.push('Out on a call');
  else if (v.v < .05) lines.push(d.stops && v.wait > 0 ? 'Waiting at a stop' : 'Stopped for a moment');
  else lines.push(d.stops ? 'On its round of the stops' : 'On the road');
  lines.push('Keeps in ' + nameOf(d.home));
  return {title: upper(d.name), lines};
}

const ANIMALS = {cow: ['A cow', 'Chewing grass in the paddock'], sheep: ['A sheep', 'Wandering the paddock'], duck: ['A duck', 'Paddling on the pond']};
export const describeAnimal = kind => ({title: ANIMALS[kind][0], lines: [ANIMALS[kind][1]]});
export const describeTrain = sim => ({title: 'The little train', lines: [sim.train.wait > 0 ? 'Resting while the passengers hop on and off' : 'Chugging along the track', 'Runs between the platform and the buffers']});
export const buildingAt = id => building(id);
