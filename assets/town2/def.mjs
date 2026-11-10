// New Toy Town: the town definition. Pure data and maths (no THREE, no DOM), shared by the simulation, the
// builders and the tests. Coordinates: x runs east, z runs south, y is up; one unit is roughly a cottage width.
// Everything about the town that is a matter of design lives here, so adding a house or a resident is a data edit.

export const PALETTE = {
  red: '#e2473b', yellow: '#f7c93e', blue: '#3f8fd6', sky: '#8fd0f2', green: '#58b368', leaf: '#3f9e58', lime: '#a5d86a',
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
  {id: 'high', name: 'High Street', angle: 0, points: [[2.4, 0], [5, .6], [8, -.2], [10.6, -1.6]]},
  {id: 'station', name: 'Station Road', angle: Math.PI / 2, points: [[0, 2.4], [.5, 5], [-.4, 7.4]]},
  {id: 'cottage', name: 'Cottage Lane', angle: Math.PI, points: [[-2.4, 0], [-5, -.9], [-8, -.2], [-10.6, 1.2]]},
  {id: 'hill', name: 'Windmill Lane', angle: Math.PI * 1.5, points: [[0, -2.4], [-.9, -4.8], [.6, -7.0]]}
];

// Buildings. `ry` turns the building so its front (local +z, where the door is) faces that way: 0 faces south.
// `door` is how far in front of the centre the doorstep is. Landmarks have a builder of the same name in build.mjs.
const Q = Math.PI / 4;
export const BUILDINGS = [
  {id: 'clock', type: 'clockTower', name: 'the Clock Tower', x: 0, z: 0, ry: 0, door: 0},
  {id: 'cafe', type: 'teapotCafe', name: 'the Teapot Café', x: -3.25, z: -3.25, ry: Q, door: 1.25},
  {id: 'toys', type: 'toyShop', name: 'the Toy Shop', x: 3.25, z: -3.25, ry: -Q, door: 1.05},
  {id: 'bakery', type: 'bakery', name: 'the Bakery', x: 3.3, z: 3.2, ry: -3 * Q, door: 1.0},
  {id: 'bandstand', type: 'bandstand', name: 'the Bandstand', x: -3.3, z: 3.3, ry: 3 * Q, door: 0},
  {id: 'post', type: 'postOffice', name: 'the Post Office', x: 5.7, z: -1.25, ry: 0, door: .95},
  {id: 'fire', type: 'fireStation', name: 'the Fire Station', x: 8.5, z: -2.1, ry: -.12, door: 1.05},
  {id: 'police', type: 'policeBox', name: 'the Police Box', x: 6.9, z: 1.75, ry: Math.PI, door: .6},
  {id: 'mushroom', type: 'mushroomCottage', name: 'Mushroom Cottage', x: -5.75, z: -3.05, ry: .1, door: .95},
  {id: 'c1', type: 'cottage', name: 'Bluebell Cottage', x: -8.2, z: -2.2, ry: -.08, door: .85, colour: 'sky', roof: 'red'},
  {id: 'c2', type: 'cottage', name: 'Buttercup Cottage', x: -6.3, z: 1.25, ry: Math.PI + .1, door: .85, colour: 'yellow', roof: 'teal'},
  {id: 'c3', type: 'cottage', name: 'Rose Cottage', x: -8.9, z: 1.9, ry: Math.PI - .12, door: .85, colour: 'pink', roof: 'purple'},
  {id: 'c4', type: 'cottage', name: 'Apple Cottage', x: -10.5, z: -.85, ry: .45, door: .85, colour: 'lime', roof: 'orange'},
  {id: 'mill', type: 'windmill', name: 'the Windmill', x: 1.9, z: -8.3, ry: -Math.PI / 4, door: .95}
];

// The cast. Each lives behind one door and has a round of places to go; `stay` is seconds spent at each.
export const CAST = [
  {id: 'crumb', name: 'Mr Crumb the baker', home: 'c2', coat: 'cream', hat: 'chef', round: [['bakery', 70], ['cafe', 18], ['bakery', 55], ['c2', 40]]},
  {id: 'pott', name: 'Mrs Pott', home: 'c1', coat: 'pink', hat: 'bun', round: [['cafe', 80], ['bakery', 14], ['cafe', 60], ['c1', 45]]},
  {id: 'bell', name: 'Constable Bell', home: 'c3', coat: 'blue', hat: 'helmet', round: [['police', 30], ['toys', 8], ['post', 8], ['cafe', 12], ['police', 25], ['c3', 40]]},
  {id: 'pip', name: 'Postie Pip', home: 'c4', coat: 'red', hat: 'cap', round: [['post', 25], ['mushroom', 6], ['c1', 6], ['c3', 6], ['c2', 6], ['mill', 6], ['post', 20], ['c4', 45]]},
  {id: 'tilly', name: 'Tilly from the toy shop', home: 'c1', coat: 'purple', hat: 'bow', round: [['toys', 85], ['cafe', 16], ['toys', 50], ['c1', 40]]},
  {id: 'embers', name: 'Chief Embers', home: 'c3', coat: 'orange', hat: 'fire', round: [['fire', 75], ['bakery', 12], ['fire', 60], ['c3', 40]]},
  {id: 'moss', name: 'Granny Moss', home: 'mushroom', coat: 'green', hat: 'bonnet', round: [['cafe', 30], ['bakery', 12], ['post', 10], ['mushroom', 60]]},
  {id: 'sprocket', name: 'Mr Sprocket the miller', home: 'mill', coat: 'teal', hat: 'flat', round: [['bakery', 15], ['cafe', 20], ['mill', 80]]},
  {id: 'dot', name: 'Dot', home: 'c4', coat: 'yellow', hat: 'bobble', small: true, round: [['toys', 25], ['cafe', 14], ['c2', 10], ['c4', 35]]},
  {id: 'dash', name: 'Dash', home: 'c2', coat: 'sky', hat: 'bobble', small: true, round: [['toys', 20], ['mushroom', 12], ['bakery', 10], ['c2', 35]]}
];

// Vehicles drive one closed tour of the whole road network (see graph.mjs) at their own pace.
export const VEHICLES = [
  {id: 'bus', kind: 'bus', name: 'the Toy Town bus', colour: 'red', speed: .85, stops: true},
  {id: 'taxi', kind: 'car', name: 'the taxi', colour: 'yellow', speed: 1.1},
  {id: 'van', kind: 'van', name: 'the post van', colour: 'red', speed: .95}
];
// Where the bus pulls up (it waits a few seconds at each).
export const BUS_STOPS = [{id: 'square', x: 2.9, z: .9}, {id: 'highEnd', x: 9.6, z: -.7}, {id: 'lane', x: -8.3, z: .2}, {id: 'hill', x: -.3, z: -6.0}, {id: 'station', x: .1, z: 6.4}];

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
