// New Toy Town: the town definition. Pure data and maths (no THREE, no DOM), shared by the simulation, the
// builders and the tests. Coordinates: x runs east, z runs south, y is up; one unit is roughly a cottage width.
// Everything about the town that is a matter of design lives here, so adding a house or a resident is a data edit.

export const PALETTE = {
  red: '#e2473b', yellow: '#f7c93e', blue: '#3f8fd6', sky: '#8fd0f2', green: '#58b368', leaf: '#3f9e58', leafLight: '#58b368', lime: '#a5d86a',
  cream: '#fff3d6', white: '#ffffff', pink: '#f59ac1', orange: '#f28b3c', purple: '#9a7fe0', teal: '#35b8ad',
  brown: '#8a5a3c', crust: '#c98a4b', wood: '#b07a4a', stone: '#d9cdb8', slate: '#5d6b7a', road: '#8f8a86', kerb: '#f4ead6',
  grass: '#8fd16a', grassDark: '#74bd58', sand: '#f3e2b0', sea: '#5cc4e8', gold: '#f2c14e', black: '#2b2f36'
};

import {curve} from './curve.mjs';

export const ISLAND = {rx: 13.8, rz: 10.4, sea: -.12};
export const SQUARE = {x: 0, z: 0, ring: 2.4, green: 1.55};
export const ROAD = {width: .95, lane: .22, pave: .66, paveWidth: .3};

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// How far inside the island a point is: <1 on land, 1 at the waterline (a gently wobbly ellipse).
export function shore(x, z) {
  const a = Math.atan2(z, x);
  return Math.hypot(x / ISLAND.rx, z / ISLAND.rz) + .028 * Math.sin(a * 5 + .6) + .018 * Math.sin(a * 9 - 1.1);
}
// Ground height. The square is flat, the countryside rolls gently, Windmill Hill rises in the north.
export function heightAt(x, z) {
  const land = smooth(1.0, .84, shore(x, z));
  const roll = .34 * Math.sin(x * .33 + 1.3) * Math.cos(z * .41 - .4) + .2 * Math.sin(x * .71 - z * .52);
  const away = smooth(4.2, 9, Math.hypot(x - SQUARE.x, z - SQUARE.z));
  const hill = 1.45 * Math.exp(-((x - 1.9) ** 2 + (z + 8.3) ** 2) / 6.5);
  return (.14 + Math.max(0, roll * .7 + .22) * away + hill) * land - (1 - land) * .55;
}

// Roads. The ring goes clockwise round the square (seen from above); each spoke leaves it at an exit angle and is a
// smooth curve through its control points, ending in a turning circle. Angles are measured from east towards south.
export const SPOKES = [
  {id: 'high', name: 'High Street', angle: 0, points: [[2.4, 0], [5.5, .25], [8.6, -.15], [11.0, .35]]},
  {id: 'station', name: 'Station Road', angle: Math.PI / 2, points: [[0, 2.4], [.3, 4.7], [1.1, 6.5], [1.3, 8.3]]},
  {id: 'cottage', name: 'Cottage Lane', angle: Math.PI, points: [[-2.4, 0], [-5.4, .2], [-8.4, -.1], [-10.8, .4]]},
  {id: 'hill', name: 'Windmill Lane', angle: Math.PI * 1.5, points: [[0, -2.4], [.35, -4.8], [.9, -6.6], [1.3, -7.5]]}
];

// Streets. A spoke is a curve, so buildings are placed by how far along it (s, from the ring) and which side of it:
// +1 is the left of the way out from the square, -1 the right. The front door always faces the street and its step lands
// on the pavement (STEPOUT from the middle of the road), so everybody steps straight from a doorstep onto the pavement.
const spokeLines = {};
function spokeLine(id) {
  if (!spokeLines[id]) { const pts = curve(SPOKES.find(s => s.id === id).points), at = [0]; for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); spokeLines[id] = {pts, at}; }
  return spokeLines[id];
}
export function onSpoke(id, s) {
  const {pts, at} = spokeLine(id); s = Math.max(0, Math.min(at[at.length - 1], s)); let i = 0; while (i < at.length - 2 && at[i + 1] < s) i++;
  const a = pts[i], b = pts[i + 1], f = (s - at[i]) / ((at[i + 1] - at[i]) || 1), d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return {x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / d, tz: (b[1] - a[1]) / d};
}
export const spokeLength = id => { const at = spokeLine(id).at; return at[at.length - 1]; };
const STEPOUT = .9;
const street = (id, type, name, spoke, s, side, door, extra = {}) => {
  const p = onSpoke(spoke, s), nx = p.tz, nz = -p.tx, off = side * (door + STEPOUT);   // (nx, nz): the left of the way out
  const ry = Math.round(Math.atan2(-side * nx, -side * nz) / (Math.PI / 2)) * Math.PI / 2;   // squared to the grid: houses face the street, never at odd angles
  return {id, type, name, x: p.x + nx * off, z: p.z + nz * off, ry, door, street: spoke, s, side, ...extra};
};

const Q = Math.PI / 4;
// Buildings. `ry` turns the building so its front (local +z, where the door is) faces that way: 0 faces south.
// `door` is how far in front of the centre the doorstep is. Landmarks have a builder of the same name in build.mjs.
// `at` places a building and turns its front towards a point on the road, so the door always faces the lane.
export const BUILDINGS = [
  {id: 'clock', type: 'clockTower', name: 'the Clock Tower', x: 0, z: 0, ry: 0, door: 0},
  // the four corners of the square face its middle
  {id: 'cafe', type: 'teapotCafe', name: 'the Teapot Café', x: -3.25, z: -3.25, ry: Q, door: 1.25},
  {id: 'toys', type: 'toyShop', name: 'the Toy Shop', x: 3.25, z: -3.25, ry: -Q, door: 1.05},
  {id: 'bakery', type: 'bakery', name: 'the Bakery', x: 3.3, z: 3.2, ry: -3 * Q, door: 1.0},
  {id: 'bandstand', type: 'bandstand', name: 'the Bandstand', x: -3.3, z: 3.3, ry: 3 * Q, door: 0},
  // High Street, east: services on the left (north), the garage and kiosk on the right, the harbour at the end
  street('post', 'postOffice', 'the Post Office', 'high', 3.3, 1, .95),
  street('fire', 'fireStation', 'the Fire Station', 'high', 6.4, 1, 1.05),
  street('hut', 'harbourHut', 'the Harbour Hut', 'high', 8.6, 1, .95),
  street('police', 'policeBox', "the Constable's Kiosk", 'high', 3.3, -1, .6),
  street('garage', 'garage', 'the Garage', 'high', 6.4, -1, 1.0),
  // Cottage Lane, west: the lane's houses, facing each other across it
  street('mushroom', 'mushroomCottage', 'Mushroom Cottage', 'cottage', 3.6, -1, .95),
  street('c1', 'cottage', 'Bluebell Cottage', 'cottage', 6.4, -1, .85, {colour: 'sky', roof: 'red'}),
  street('c4', 'cottage', 'Apple Cottage', 'cottage', 8.5, -1, .85, {colour: 'lime', roof: 'orange'}),
  street('c3', 'cottage', 'Rose Cottage', 'cottage', 3.3, 1, .85, {colour: 'pink', roof: 'purple'}),
  street('c2', 'cottage', 'Buttercup Cottage', 'cottage', 5.9, 1, .85, {colour: 'yellow', roof: 'teal'}),
  street('c6', 'cottage', 'Lantern Cottage', 'cottage', 8.5, 1, .85, {colour: 'orange', roof: 'teal'}),
  // Station Road, south: the station on the right, a cottage and the school on the left
  street('station', 'station', 'the Station', 'station', 4.5, 1, 1.25),
  street('c5', 'cottage', 'Daisy Cottage', 'station', 3.0, -1, .85, {colour: 'cream', roof: 'blue'}),
  street('school', 'school', 'the School', 'station', 5.9, -1, 1.25),
  // Windmill Lane, north: the farm and barn on the left, the windmill at the top of the hill
  street('farm', 'cottage', 'Hay Farm', 'hill', 3.1, 1, .85, {colour: 'cream', roof: 'orange'}),
  street('barn', 'barn', 'the Barn', 'hill', 5.7, 1, 1.1),
  street('mill', 'windmill', 'the Windmill', 'hill', 5.4, -1, .95)
];

// Lamp posts: eight round the square (with the bunting) and one every couple of units along each street, on alternate sides, never in front of a door.
// `spot` is the place on the pavement beside each one where the lamplighter stands to tend it.
export const LAMPS = (() => {
  const out = [];
  for (let k = 0; k < 8; k++) { const a = (k + .5) / 8 * Math.PI * 2; out.push({x: Math.cos(a) * 3.3, z: Math.sin(a) * 3.3, spot: [Math.cos(a) * (SQUARE.ring + ROAD.pave), Math.sin(a) * (SQUARE.ring + ROAD.pave)], where: 'the square'}); }
  for (const sp of SPOKES) {
    const len = spokeLength(sp.id); let side = 1;
    for (let s = 2.5; s < len - .5; s += 2.1) {
      const p = onSpoke(sp.id, s), nx = p.tz, nz = -p.tx, at = sd => [p.x + nx * sd * .86, p.z + nz * sd * .86];
      const free = sd => { const [x, z] = at(sd); return BUILDINGS.every(b => Math.hypot(b.x - x, b.z - z) > 1.1 && Math.hypot(b.x + Math.sin(b.ry) * b.door - x, b.z + Math.cos(b.ry) * b.door - z) > .9); }, pick = free(side) ? side : free(-side) ? -side : 0;
      if (pick) { const [x, z] = at(pick); out.push({x, z, spot: [p.x + nx * pick * ROAD.pave, p.z + nz * pick * ROAD.pave], where: sp.name}); }
      side = -side;
    }
  }
  return out.map((l, i) => ({id: 'lamp' + i, ...l}));
})();

// The cast. Each lives behind one door and has a round of places to go; `stay` is seconds spent at each.
// `wake`/`sleep` are the hours they are about; before and after they are indoors (the defaults are 6.5 and 20.5).
export const CAST = [
  {id: 'crumb', wake: 5.5, sleep: 18.5, name: 'Mr Crumb the baker', home: 'c2', coat: 'cream', hat: 'chef', round: [['bakery', 70], ['cafe', 18], ['bakery', 55], ['c2', 40]]},
  {id: 'pott', wake: 7.5, sleep: 20, name: 'Mrs Pott', home: 'c1', coat: 'pink', hat: 'bun', round: [['cafe', 80], ['bakery', 14], ['cafe', 60], ['c1', 45]]},
  {id: 'bell', wake: 6.5, sleep: 21, name: 'Constable Bell', home: 'c3', coat: 'blue', hat: 'helmet', round: [['police', 30], ['toys', 8], ['post', 8], ['cafe', 12], ['garage', 8], ['police', 25], ['c3', 40]]},
  {id: 'pip', wake: 6.5, sleep: 18.5, name: 'Postie Pip', home: 'c4', coat: 'red', hat: 'cap', round: [['post', 25], ['mushroom', 6], ['c1', 6], ['c3', 6], ['c2', 6], ['school', 6], ['mill', 6], ['post', 20], ['c4', 45]]},
  {id: 'tilly', wake: 8, sleep: 19.5, name: 'Tilly from the toy shop', home: 'c5', coat: 'purple', hat: 'bow', round: [['toys', 85], ['cafe', 16], ['toys', 50], ['c5', 40]]},
  {id: 'embers', wake: 6.5, sleep: 20, name: 'Chief Embers', home: 'c3', coat: 'orange', hat: 'fire', round: [['fire', 75], ['bakery', 12], ['fire', 60], ['c3', 40]]},
  {id: 'moss', wake: 7.5, sleep: 19.5, name: 'Granny Moss', home: 'mushroom', coat: 'green', hat: 'bonnet', round: [['cafe', 30], ['bakery', 12], ['post', 10], ['station', 14], ['mushroom', 60]]},
  {id: 'sprocket', wake: 6, sleep: 19, name: 'Mr Sprocket the miller', home: 'mill', coat: 'teal', hat: 'flat', round: [['bakery', 15], ['cafe', 20], ['barn', 14], ['mill', 80]]},
  {id: 'hay', wake: 5.5, sleep: 19, name: 'Farmer Hay', home: 'farm', coat: 'brown', hat: 'flat', round: [['barn', 70], ['bakery', 10], ['barn', 50], ['cafe', 12], ['farm', 45]]},
  {id: 'chalk', wake: 7, sleep: 19.5, name: 'Miss Chalk the teacher', home: 'c5', coat: 'sky', hat: 'bun', round: [['school', 95], ['cafe', 16], ['school', 55], ['c5', 40]]},
  {id: 'sparky', wake: 7.5, sleep: 19.5, name: 'Sparky the mechanic', home: 'c4', coat: 'orange', hat: 'cap', round: [['garage', 80], ['cafe', 14], ['garage', 55], ['c4', 40]]},
  {id: 'salt', wake: 6, sleep: 20, name: 'Captain Salt', home: 'hut', coat: 'blue', hat: 'flat', round: [['hut', 60], ['bakery', 12], ['hut', 50], ['station', 10], ['hut', 40]]},
  {id: 'wick', wake: 4.6, sleep: 21.4, name: 'Mr Wick the lamplighter', home: 'c6', coat: 'teal', hat: 'flat', lamplighter: true, round: [['c6', 60], ['cafe', 20], ['c6', 60], ['bakery', 10]]},
  {id: 'dot', wake: 7.5, sleep: 18, name: 'Dot', home: 'c4', coat: 'yellow', hat: 'bobble', small: true, round: [['school', 60], ['toys', 25], ['cafe', 14], ['c2', 10], ['c4', 35]]},
  {id: 'dash', wake: 7.5, sleep: 18, name: 'Dash', home: 'c2', coat: 'sky', hat: 'bobble', small: true, round: [['school', 55], ['toys', 20], ['mushroom', 12], ['bakery', 10], ['c2', 35]]}
];

// Vehicles drive one closed tour of the whole road network (see graph.mjs) at their own pace.
export const DAY = 480;   // seconds of simulation per day: 06:00 is the start of the morning, so a day is 8 minutes (a walk takes about an hour)
// Each vehicle lives in a building (its garage), leaves it at `from` o'clock and drives the tour until `to`, then goes back in.
export const VEHICLES = [
  {id: 'bus', kind: 'bus', name: 'the Toy Town bus', colour: 'red', speed: .85, stops: true, home: 'garage', from: 6.5, to: 21.5},
  {id: 'taxi', kind: 'car', name: 'the taxi', colour: 'yellow', speed: 1.1, home: 'garage', from: 6, to: 23},
  {id: 'van', kind: 'van', name: 'the post van', colour: 'red', speed: .95, home: 'post', from: 8, to: 16},
  {id: 'milk', kind: 'float', name: 'the milk float', colour: 'white', speed: .7, home: 'barn', from: 5.5, to: 10.5},
  {id: 'tractor', kind: 'tractor', name: 'the tractor', colour: 'green', speed: .55, home: 'barn', from: 9.5, to: 17},
  {id: 'icecream', kind: 'icecream', name: 'the ice-cream van', colour: 'pink', speed: .8, home: 'garage', from: 13, to: 18.5},
  {id: 'fire', kind: 'fire', name: 'the fire engine', colour: 'red', speed: 1.35, home: 'fire', from: -1, to: -1, onCall: true}
];
// Where the bus pulls up (it waits a few seconds at each).
export const BUS_STOPS = [{id: 'square', x: 2.9, z: .9}, {id: 'highEnd', x: 9.6, z: 0}, {id: 'lane', x: -8.3, z: .1}, {id: 'hill', x: .6, z: -5.6}, {id: 'station', x: .9, z: 6.2}];

// Railway: one short straight track beside the station with a platform; the little train shuttles along it.
export const TRACK = {x: 5.15, z0: 3.4, z1: 7.7, platform: {x: 4.35, z0: 5.0, z1: 7.2}};
export const PADDOCK = {x0: -5.6, z0: -7.6, x1: -3.2, z1: -5.5};
export const POND = {x: 6.2, z: -5.5, r: 1.25};
export const JETTY = {x0: 12.0, x1: 13.7, z: .55};
export const GREEN = {x: 0, z: 0, r: 1.5};

// Scenery that is not a building: tree clusters [x, z, kind, scale], kinds 'round' | 'tall' | 'apple' | 'bush'.
export const TREES = (() => {
  const out = [], roadPts = SPOKES.flatMap(sp => curve(sp.points)), kinds = ['round', 'tall', 'apple', 'round'];
  // is there room for something of radius r at (x, z)? clear of buildings, roads, the ring, the pond, the paddock, the railway and the jetty
  const room = (x, z, r) => shore(x, z) < .83 && BUILDINGS.every(b => Math.hypot(b.x - x, b.z - z) > r + 1.35) && roadPts.every(p => Math.hypot(p[0] - x, p[1] - z) > r + .85)
    && Math.hypot(x, z) > SQUARE.ring + r + 1.0 && Math.hypot(x - POND.x, z - POND.z) > POND.r + r + .4 && !(x > PADDOCK.x0 - r - .5 && x < PADDOCK.x1 + r + .5 && z > PADDOCK.z0 - r - .5 && z < PADDOCK.z1 + r + .5)
    && !(Math.abs(x - TRACK.x) < r + 1.2 && z > TRACK.z0 - 1 && z < TRACK.z1 + 1) && !(x > JETTY.x0 - 2 && Math.abs(z - JETTY.z) < 2.5) && out.every(t => Math.hypot(t[0] - x, t[1] - z) > (t[3] + r) * .72);
  const add = (x, z, kind, sc) => { if (room(x, z, sc * .6)) out.push([+x.toFixed(2), +z.toFixed(2), kind, sc]); };
  for (let k = 0; k < 44; k++) { const a = k / 44 * Math.PI * 2 + rand(k + 400) * .1, r = .74 + rand(k + 500) * .05; add(Math.cos(a) * ISLAND.rx * r, Math.sin(a) * ISLAND.rz * r, kinds[k % 4], .95 + rand(k + 600) * .3); }   // a belt of trees just inside the shore
  const grove = (cx, cz, n, seed) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + rand(seed + k) * 1.2, r = .5 + rand(seed + 30 + k) * 1.3; add(cx + Math.cos(a) * r, cz + Math.sin(a) * r, kinds[(k + seed) % 4], .9 + rand(seed + 60 + k) * .35); } };
  grove(8.6, -5.3, 6, 1); grove(-9.4, -5.4, 6, 11); grove(-7.4, 6.4, 6, 21); grove(9.8, 5.2, 5, 31); grove(5.3, -8.0, 4, 41); grove(-3.3, 9.0, 3, 51); grove(-12.0, 1.8, 3, 61);   // a grove in each corner of the island
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) add(7.2 + i * 1.45, 4.5 + j * 1.5, 'apple', .85);   // an orchard in rows
  for (const [x, z] of [[4.45, 1.65], [-4.4, -.35], [-4.5, 2.5], [4.2, -.9], [-2.2, -4.5], [1.7, -4.4], [2.2, 4.3], [-2.0, 4.2]]) if (room(x, z, .4)) out.push([x, z, 'bush', .9]);   // low bushes by the ring road
  return out;
})();

// Small deterministic random numbers (0..1) from a seed, for anything that should look hand-placed but stay stable.
export function rand(seed) { let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export const facing = b => [Math.sin(b.ry), Math.cos(b.ry)];
export const doorOf = b => { const [dx, dz] = facing(b); return {x: b.x + dx * b.door, z: b.z + dz * b.door}; };
export const building = id => BUILDINGS.find(b => b.id === id);
