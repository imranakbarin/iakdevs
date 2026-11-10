// New Toy Town: the town definition. Pure data and maths (no THREE, no DOM), shared by the simulation, the
// builders and the tests. Coordinates: x runs east, z runs south, y is up; one unit is roughly a cottage width.
// Everything about the town that is a matter of design lives here, so adding a house or a resident is a data edit.

export const PALETTE = {
  red: '#e2473b', yellow: '#f7c93e', blue: '#3f8fd6', sky: '#8fd0f2', green: '#58b368', leaf: '#3f9e58', leafLight: '#58b368', lime: '#a5d86a',
  cream: '#fff3d6', white: '#ffffff', pink: '#f59ac1', orange: '#f28b3c', purple: '#9a7fe0', teal: '#35b8ad',
  brown: '#8a5a3c', crust: '#c98a4b', wood: '#b07a4a', stone: '#d9cdb8', slate: '#5d6b7a', road: '#8f8a86', kerb: '#f4ead6',
  grass: '#8fd16a', grassDark: '#74bd58', sand: '#f3e2b0', sea: '#5cc4e8', gold: '#f2c14e', black: '#2b2f36'
};

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
  {id: 'high', name: 'High Street', angle: 0, points: [[2.4, 0], [5, .6], [8, -.2], [10.3, -1.3], [11.5, .6]]},
  {id: 'station', name: 'Station Road', angle: Math.PI / 2, points: [[0, 2.4], [.5, 5], [-.4, 7.0], [1.5, 8.1]]},
  {id: 'cottage', name: 'Cottage Lane', angle: Math.PI, points: [[-2.4, 0], [-5, -.9], [-8, -.2], [-9.9, 1.5], [-9.4, 4.1]]},
  {id: 'hill', name: 'Windmill Lane', angle: Math.PI * 1.5, points: [[0, -2.4], [-.9, -4.8], [.6, -7.0], [-1.2, -8.6]]}
];

const Q = Math.PI / 4;
// Buildings. `ry` turns the building so its front (local +z, where the door is) faces that way: 0 faces south.
// `door` is how far in front of the centre the doorstep is. Landmarks have a builder of the same name in build.mjs.
// `at` places a building and turns its front towards a point on the road, so the door always faces the lane.
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const at = (id, type, name, x, z, to, door, extra = {}) => ({id, type, name, x, z, ry: face(x, z, to[0], to[1]), door, ...extra});
export const BUILDINGS = [
  {id: 'clock', type: 'clockTower', name: 'the Clock Tower', x: 0, z: 0, ry: 0, door: 0},
  {id: 'cafe', type: 'teapotCafe', name: 'the Teapot Café', x: -3.25, z: -3.25, ry: Q, door: 1.25},
  {id: 'toys', type: 'toyShop', name: 'the Toy Shop', x: 3.25, z: -3.25, ry: -Q, door: 1.05},
  {id: 'bakery', type: 'bakery', name: 'the Bakery', x: 3.3, z: 3.2, ry: -3 * Q, door: 1.0},
  {id: 'bandstand', type: 'bandstand', name: 'the Bandstand', x: -3.3, z: 3.3, ry: 3 * Q, door: 0},
  {id: 'post', type: 'postOffice', name: 'the Post Office', x: 5.7, z: -1.25, ry: 0, door: .95},
  {id: 'fire', type: 'fireStation', name: 'the Fire Station', x: 8.5, z: -2.1, ry: -.12, door: 1.05},
  {id: 'police', type: 'policeBox', name: "the Constable's Kiosk", x: 6.9, z: 1.75, ry: Math.PI, door: .6},
  {id: 'mushroom', type: 'mushroomCottage', name: 'Mushroom Cottage', x: -5.75, z: -3.05, ry: .1, door: .95},
  at('c1', 'cottage', 'Bluebell Cottage', -8.2, -2.2, [-8, -.6], .85, {colour: 'sky', roof: 'red'}),
  at('c2', 'cottage', 'Buttercup Cottage', -5.6, 1.9, [-5, -.4], .85, {colour: 'yellow', roof: 'teal'}),
  at('c3', 'cottage', 'Rose Cottage', -7.6, 1.55, [-9.6, 1.5], .85, {colour: 'pink', roof: 'purple'}),
  at('c4', 'cottage', 'Apple Cottage', -11.0, -.2, [-9.7, .4], .85, {colour: 'lime', roof: 'orange'}),
  at('c5', 'cottage', 'Daisy Cottage', -2.6, 5.9, [-.2, 5.6], .85, {colour: 'cream', roof: 'blue'}),
  at('school', 'school', 'the School', -7.0, 5.6, [-9.3, 4.2], 1.25),
  at('station', 'station', 'the Station', 3.5, 6.2, [.2, 6.3], 1.25),
  at('barn', 'barn', 'the Barn', -3.6, -7.7, [-1.4, -8.2], 1.1),
  at('farm', 'cottage', 'Hay Farm', -2.4, -5.5, [-.9, -5.0], .85, {colour: 'cream', roof: 'orange'}),
  at('garage', 'garage', 'the Garage', 9.0, 2.6, [10.5, 1.0], 1.0),
  at('hut', 'harbourHut', 'the Harbour Hut', 9.4, .6, [11.0, .6], .95),
  {id: 'mill', type: 'windmill', name: 'the Windmill', x: 2.2, z: -8.2, ry: -Math.PI / 4, door: .95}
];

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
export const BUS_STOPS = [{id: 'square', x: 2.9, z: .9}, {id: 'highEnd', x: 9.6, z: -.7}, {id: 'lane', x: -8.3, z: .2}, {id: 'hill', x: -.4, z: -6.0}, {id: 'station', x: .1, z: 6.4}];

// Railway: one short straight track beside the station with a platform; the little train shuttles along it.
export const TRACK = {x: 5.35, z0: 3.4, z1: 7.7, platform: {x: 4.55, z0: 5.0, z1: 7.2}};
export const PADDOCK = {x0: -7.2, z0: -7.0, x1: -5.0, z1: -4.9};
export const POND = {x: 6.2, z: -5.5, r: 1.25};
export const JETTY = {x0: 12.0, x1: 13.7, z: .55};
export const GREEN = {x: 0, z: 0, r: 1.5};

// Scenery that is not a building: tree clusters [x, z, kind, scale], kinds 'round' | 'tall' | 'apple' | 'bush'.
export const TREES = [
  [-1.6, -5.4, 'round', 1.1], [2.5, -5.6, 'tall', 1], [4.4, -6.6, 'round', 1.2], [-3.6, -6.9, 'apple', 1], [-5.6, -6.2, 'round', 1.3], [6.9, -5.2, 'tall', 1.1],
  [9.9, -4.6, 'round', 1.1], [11.3, 1.1, 'apple', 1], [9.3, 2.9, 'round', 1.2], [7.3, 4.6, 'tall', 1], [5.1, 5.4, 'round', 1.3], [2.6, 7.4, 'apple', 1.1],
  [-2.6, 6.6, 'round', 1.2], [-5.1, 5.1, 'tall', 1.1], [-7.6, 5.4, 'round', 1.1], [-10.4, 3.9, 'apple', 1], [-11.6, -2.9, 'round', 1.2], [-9.1, -4.9, 'tall', 1],
  [-7.1, -5.3, 'round', 1], [-3.1, 8.2, 'tall', 1.1], [4.3, 8.0, 'round', 1], [-12.0, .6, 'tall', .9], [12.2, -1.9, 'round', 1], [-1.9, -8.6, 'round', 1], [5.6, -8.1, 'apple', .9],
  [-4.4, 2.5, 'bush', 1], [4.5, 1.6, 'bush', 1], [-2.2, -4.2, 'bush', .9], [2.1, 4.4, 'bush', 1], [7.9, 1.4, 'bush', .9], [-9.6, -2.4, 'bush', 1], [-4.2, -.1, 'bush', .8], [1.4, -4.6, 'bush', .9]
];

// Small deterministic random numbers (0..1) from a seed, for anything that should look hand-placed but stay stable.
export function rand(seed) { let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export const facing = b => [Math.sin(b.ry), Math.cos(b.ry)];
export const doorOf = b => { const [dx, dz] = facing(b); return {x: b.x + dx * b.door, z: b.z + dz * b.door}; };
export const building = id => BUILDINGS.find(b => b.id === id);
