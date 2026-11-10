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

export const ISLAND = {rx: 19.4, rz: 15.9, sea: -.12};
export const SQUARE = {x: 0, z: 0, ring: 2.4, green: 1.55};
export const ROAD = {width: .95, lane: .22, pave: .66, paveWidth: .3};
export const OUTER = {rx: 11.6, rz: 8.4};     // the outer ring road (an ellipse)
export const LOOP = {rx: 16.0, rz: 13.4};     // the railway, a loop round the whole town
export const BUILD_SCALE = .8;                // houses and buildings are drawn at this scale (people, vehicles and trees follow)

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
  const hill = 1.1 * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / 3.4);
  return (.14 + Math.max(0, roll * .7 + .22) * away + hill) * land - (1 - land) * .55;
}
export const HILL = {x: 0, z: -10.3};

// ---- Roads. An inner ring (one way, clockwise seen from above) round the square, eight spokes out to an outer ring road (an
// ellipse), and the railway loop outside everything. Angles run from east towards south. Every road is an edge between two
// nodes: 'in0'..'in7' on the inner ring and 'out0'..'out7' on the outer ring, so the whole thing is one connected network.
const TAU = Math.PI * 2, A8 = k => k * TAU / 8;
export const ringPt = a => [SQUARE.x + Math.cos(a) * SQUARE.ring, SQUARE.z + Math.sin(a) * SQUARE.ring];
export const outerPt = a => [Math.cos(a) * OUTER.rx, Math.sin(a) * OUTER.rz];
export const loopPt = a => [Math.cos(a) * LOOP.rx, Math.sin(a) * LOOP.rz];
export const SPOKE_NAMES = ['High Street', 'Harbour Road', 'Station Road', 'School Road', 'Cottage Lane', 'Farm Road', 'Windmill Lane', 'Pond Road'];
export const NODES = {};
export const ROADS = [];
for (let k = 0; k < 8; k++) { NODES['in' + k] = ringPt(A8(k)); NODES['out' + k] = outerPt(A8(k)); }
for (let k = 0; k < 8; k++) {
  const a = A8(k), p0 = NODES['in' + k], p1 = NODES['out' + k], mx = (p0[0] + p1[0]) / 2, mz = (p0[1] + p1[1]) / 2, len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const bow = k % 2 ? (k % 4 === 1 ? .2 : -.2) : 0, nx = -(p1[1] - p0[1]) / len, nz = (p1[0] - p0[0]) / len;   // the diagonal streets bow a little
  ROADS.push({id: 'spoke' + k, kind: 'spoke', name: SPOKE_NAMES[k], a: 'in' + k, b: 'out' + k, points: [p0, [mx + nx * bow, mz + nz * bow], p1]});
}
for (let k = 0; k < 8; k++) {
  const n = (k + 1) % 8, ap = [], op = [];
  for (let m = 0; m <= 6; m++) ap.push(ringPt(A8(k) + (TAU / 8) * m / 6));
  for (let m = 0; m <= 8; m++) op.push(outerPt(A8(k) + (TAU / 8) * m / 8));
  ROADS.push({id: 'ring' + k, kind: 'ring', name: 'the Square', a: 'in' + k, b: 'in' + n, oneway: true, points: ap});
  ROADS.push({id: 'outer' + k, kind: 'outer', name: 'Ring Road', a: 'out' + k, b: 'out' + n, points: op});
}

// A road's centre line, sampled, with running length: used to place houses and lamps along streets.
const roadLines = {};
export function roadLine(id) {
  if (!roadLines[id]) { const r = ROADS.find(x => x.id === id), pts = curve(r.points), at = [0]; for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); roadLines[id] = {pts, at}; }
  return roadLines[id];
}
export function onRoad(id, s) {
  const {pts, at} = roadLine(id); s = Math.max(0, Math.min(at[at.length - 1], s)); let i = 0; while (i < at.length - 2 && at[i + 1] < s) i++;
  const a = pts[i], b = pts[i + 1], f = (s - at[i]) / ((at[i + 1] - at[i]) || 1), d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return {x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / d, tz: (b[1] - a[1]) / d};
}
export const roadLength = id => { const at = roadLine(id).at; return at[at.length - 1]; };
export const allRoadPoints = () => ROADS.flatMap(r => roadLine(r.id).pts);

// ---- Buildings. `ry` turns the front (local +z, where the door is) to face that way; `door` is how far in front of the centre the doorstep is
// (already scaled by BUILD_SCALE); `w` is the footprint width. The landmarks round the square are placed by hand; everything else is set out
// by a small layout solver: each building names the streets it would like to stand on, and takes the first spot along them (on the left, +1,
// or right, -1, of the way the street runs out from the square) where it fits: clear of the other buildings, every road, the railway, the
// pond and the paddock, facing its street, with its doorstep on the pavement.
const S = BUILD_SCALE, STEPOUT = .9;
const WIDTH = {cottage: 2.0, mushroomCottage: 3.0, school: 3.5, station: 3.6, barn: 3.1, garage: 2.5, fireStation: 3.0, postOffice: 2.4, policeBox: 1.3, harbourHut: 2.0, windmill: 2.4, teapotCafe: 2.8, toyShop: 2.5, bakery: 2.8, bandstand: 3.0, market: 3.4, clockTower: 2.4};
const DOOR = {cottage: .85, mushroomCottage: .95, school: 1.25, station: 1.25, barn: 1.1, garage: 1.0, fireStation: 1.05, postOffice: .95, policeBox: .6, harbourHut: .95, windmill: .95, teapotCafe: 1.25, toyShop: 1.05, bakery: 1.0, bandstand: 0, market: 1.1, clockTower: 0};
export const POND = {x: 3.7, z: -6.4, r: 1.0};
export const PADDOCK = {x0: -6.0, z0: -7.2, x1: -3.8, z1: -5.2};
const make = (id, type, name, x, z, ry, extra = {}) => ({id, type, name, x, z, ry, door: DOOR[type] * S, w: WIDTH[type] * S, scale: S, ...extra});
const wedge = (deg, id, type, name, extra = {}) => { const a = deg * Math.PI / 180, r = 5.0, x = Math.cos(a) * r, z = Math.sin(a) * r; return make(id, type, name, x, z, Math.atan2(-x, -z), extra); };
const cot = (colour, roof) => ({colour, roof});
const LOOP_PTS = Array.from({length: 240}, (_, i) => loopPt(i / 240 * TAU));

export const BUILDINGS = [
  {id: 'clock', type: 'clockTower', name: 'the Clock Tower', x: 0, z: 0, ry: 0, door: 0, w: 2.4, scale: S},
  // round the square, between the spokes, all facing the clock
  wedge(22.5, 'bakery', 'bakery', 'the Bakery'), wedge(67.5, 'post', 'postOffice', 'the Post Office'), wedge(112.5, 'bandstand', 'bandstand', 'the Bandstand'), wedge(157.5, 'cafe', 'teapotCafe', 'the Teapot Café'),
  wedge(202.5, 'toys', 'toyShop', 'the Toy Shop'), wedge(292.5, 'police', 'policeBox', "the Constable's Kiosk")
];
{
  const roadPts = allRoadPoints(), R = id => ROADS.find(r => r.id === id), spokes = k => 'spoke' + k, outer = k => 'outer' + k;
  const fits = (x, z, w, ownRoad) => {
    const r = w * .5;
    if (shore(x, z) > .82 || Math.hypot(x - POND.x, z - POND.z) < POND.r + r + .5) return false;
    if (x > PADDOCK.x0 - r - .4 && x < PADDOCK.x1 + r + .4 && z > PADDOCK.z0 - r - .4 && z < PADDOCK.z1 + r + .4) return false;
    if (BUILDINGS.some(b => Math.hypot(b.x - x, b.z - z) < (b.w + w) * .5 * .92 + .12)) return false;
    if (roadPts.some(p => Math.hypot(p[0] - x, p[1] - z) < r * .84 + .6)) return false;
    return !LOOP_PTS.some(p => Math.hypot(p[0] - x, p[1] - z) < r + .95);
  };
  // prefs: [[roadId, side], ...] in order of liking; `from` is how far out along the road to start looking
  const put = (id, type, name, prefs, extra = {}, from) => {
    for (const [roadId, side, start] of prefs) {
      const len = roadLength(roadId), kind = R(roadId).kind, lo = start ?? from ?? (kind === 'spoke' ? 3.0 : 1.8), hi = len - (kind === 'spoke' ? 1.0 : 1.8);
      for (let s = lo; s <= hi; s += .3) {
        const p = onRoad(roadId, s), nx = p.tz, nz = -p.tx, off = side * (DOOR[type] * S + STEPOUT), x = p.x + nx * off, z = p.z + nz * off, w = WIDTH[type] * S;
        if (fits(x, z, w, roadId)) { BUILDINGS.push(make(id, type, name, x, z, Math.atan2(-side * nx, -side * nz), {street: roadId, s, side, ...extra})); return true; }
      }
    }
    return false;
  };
  const E = 0, SE = 1, SO = 2, SW = 3, W = 4, NW = 5, N = 6, NE = 7;
  const both = (road, a = 1) => [[road, a], [road, -a]];
  // the big ones first, where they belong
  put('station', 'station', 'the Station', [[outer(SO), 1, 1.8], [outer(SO), 1, 1.8]]);
  put('hut', 'harbourHut', 'the Harbour Hut', [[outer(E), 1], [outer(SE), 1]]);
  put('mill', 'windmill', 'the Windmill', [[outer(N), 1, 2.4]]);
  put('fire', 'fireStation', 'the Fire Station', [[spokes(E), 1], [spokes(E), -1]]);
  put('garage', 'garage', 'the Garage', [[spokes(E), -1], [spokes(E), 1]]);
  put('school', 'school', 'the School', [[spokes(SW), 1], [spokes(SW), -1], [outer(SW), -1]]);
  put('barn', 'barn', 'the Barn', [...both(spokes(N)), [outer(NW), -1]]);
  put('farm', 'cottage', 'Hay Farm', [...both(spokes(NW), -1), [outer(NW), -1]], cot('cream', 'orange'));
  put('market', 'market', 'the Market', [...both(spokes(SO)), ...both(spokes(SE)), ...both(spokes(NE)), ...both(spokes(SW)), ...both(spokes(W)), ...both(outer(SO)), ...both(outer(SE))], {}, 2.6);
  put('mushroom', 'mushroomCottage', 'Mushroom Cottage', [...both(spokes(W), -1), ...both(spokes(W), 1)]);
  // the cottages, each looking along the streets near the place it belongs
  const houses = [
    ['c1', 'Bluebell Cottage', 'sky', 'red', [...both(spokes(W), 1), ...both(spokes(W), -1)]], ['c2', 'Buttercup Cottage', 'yellow', 'teal', [...both(spokes(W), 1), ...both(spokes(W), -1), ...both(spokes(SW), -1)]],
    ['c3', 'Rose Cottage', 'pink', 'purple', [...both(spokes(W), 1), ...both(spokes(SW), -1), [outer(W), -1]]], ['c4', 'Apple Cottage', 'lime', 'orange', [...both(spokes(W), -1), ...both(spokes(NW), 1)]],
    ['c5', 'Daisy Cottage', 'cream', 'blue', [...both(spokes(NW), 1), [outer(NW), -1], [outer(NW), 1], [outer(N), -1], ...both(spokes(N), -1), ...both(spokes(NE), -1)]], ['c6', 'Lantern Cottage', 'orange', 'teal', [[outer(W), 1], [outer(SW), 1], ...both(spokes(W), 1)]],
    ['c8', 'Poppy Cottage', 'pink', 'blue', [...both(spokes(E), -1), [outer(NE), -1], [outer(E), -1]]], ['c9', 'Primrose Cottage', 'yellow', 'red', [...both(spokes(SE), 1), [outer(SE), 1], [outer(SE), -1]]],
    ['c10', 'Clover Cottage', 'sky', 'orange', [...both(spokes(SE), -1), [outer(SE), -1], [outer(E), -1]]], ['c11', 'Marigold Cottage', 'lime', 'purple', [...both(spokes(SO), -1), [outer(SO), -1], [outer(SO), 1]]],
    ['c12', 'Foxglove Cottage', 'cream', 'teal', [...both(spokes(SO), 1), [outer(SO), -1]]], ['c13', 'Heather Cottage', 'orange', 'blue', [[outer(SW), 1], ...both(spokes(SW), -1), [outer(W), 1]]],
    ['c14', 'Violet Cottage', 'sky', 'purple', [[outer(NW), 1], [outer(W), -1], ...both(spokes(NW), -1)]], ['c15', 'Willow Cottage', 'lime', 'red', [...both(spokes(NE), 1), [outer(NE), 1], [outer(N), -1]]]
  ];
  for (const [id, name, colour, roof, prefs] of houses) put(id, 'cottage', name, prefs, cot(colour, roof));
}
{ const mill = BUILDINGS.find(b => b.id === 'mill'); if (mill) { HILL.x = mill.x; HILL.z = mill.z + .4; } }   // Windmill Hill rises under the windmill

// Lamp posts: eight round the square (with the bunting) and one every couple of units along each spoke and the outer ring, on alternate sides,
// never in front of a door. `spot` is the place on the pavement beside each one where the lamplighter stands to tend it.
export const LAMPS = (() => {
  const out = [];
  for (let k = 0; k < 8; k++) { const a = (k + .25) / 8 * TAU; out.push({x: Math.cos(a) * 3.2, z: Math.sin(a) * 3.2, spot: [Math.cos(a) * (SQUARE.ring + ROAD.pave), Math.sin(a) * (SQUARE.ring + ROAD.pave)], where: 'the square'}); }
  for (const r of ROADS) {
    if (r.kind === 'ring') continue; const len = roadLength(r.id); let side = 1;
    for (let s = 2.6; s < len - .8; s += 2.3) {
      const p = onRoad(r.id, s), nx = p.tz, nz = -p.tx, at = sd => [p.x + nx * sd * .86, p.z + nz * sd * .86];
      const free = sd => { const [x, z] = at(sd); return BUILDINGS.every(b => Math.hypot(b.x - x, b.z - z) > b.w * .5 + .6 && Math.hypot(b.x + Math.sin(b.ry) * b.door - x, b.z + Math.cos(b.ry) * b.door - z) > .8); }, pick = free(side) ? side : free(-side) ? -side : 0;
      if (pick) { const [x, z] = at(pick); out.push({x, z, spot: [p.x + nx * pick * ROAD.pave, p.z + nz * pick * ROAD.pave], where: r.name}); }
      side = -side;
    }
  }
  return out.map((l, i) => ({id: 'lamp' + i, zone: Math.floor((((Math.atan2(l.z, l.x)) % TAU) + TAU) % TAU / (TAU / 3)), ...l}));   // each lamplighter looks after a third of the town
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
  {id: 'moss', wake: 7.5, sleep: 19.5, name: 'Granny Moss', home: 'mushroom', coat: 'green', hat: 'bonnet', round: [['cafe', 30], ['bakery', 12], ['post', 10], ['station', 14], ['platform:central', 0, 'ride:harbour'], ['hut', 14], ['platform:harbour', 0, 'ride:central'], ['mushroom', 60]]},
  {id: 'sprocket', wake: 6, sleep: 19, name: 'Mr Sprocket the miller', home: 'mill', coat: 'teal', hat: 'flat', round: [['bakery', 15], ['cafe', 20], ['barn', 14], ['mill', 80]]},
  {id: 'hay', wake: 5.5, sleep: 19, name: 'Farmer Hay', home: 'farm', coat: 'brown', hat: 'flat', round: [['barn', 70], ['bakery', 10], ['barn', 50], ['cafe', 12], ['farm', 45]]},
  {id: 'chalk', wake: 7, sleep: 19.5, name: 'Miss Chalk the teacher', home: 'c5', coat: 'sky', hat: 'bun', round: [['school', 95], ['cafe', 16], ['school', 55], ['c5', 40]]},
  {id: 'sparky', wake: 7.5, sleep: 19.5, name: 'Sparky the mechanic', home: 'c4', coat: 'orange', hat: 'cap', round: [['garage', 80], ['cafe', 14], ['garage', 55], ['c4', 40]]},
  {id: 'salt', wake: 6, sleep: 20, name: 'Captain Salt', home: 'hut', coat: 'blue', hat: 'flat', round: [['hut', 60], ['platform:harbour', 0, 'ride:central'], ['bakery', 12], ['station', 10], ['platform:central', 0, 'ride:harbour'], ['hut', 50], ['hut', 40]]},
  {id: 'wick', wake: 4.0, sleep: 21.4, name: 'Mr Wick the lamplighter', home: 'c6', coat: 'teal', hat: 'flat', lamplighter: true, zone: 0, round: [['c6', 60], ['cafe', 20], ['c6', 60], ['bakery', 10]]},
  {id: 'dot', wake: 7.5, sleep: 18, name: 'Dot', home: 'c4', coat: 'yellow', hat: 'bobble', small: true, round: [['school', 60], ['toys', 25], ['cafe', 14], ['c2', 10], ['c4', 35]]},
  {id: 'dash', wake: 7.5, sleep: 18, name: 'Dash', home: 'c2', coat: 'sky', hat: 'bobble', small: true, round: [['school', 55], ['toys', 20], ['mushroom', 12], ['bakery', 10], ['c2', 35]]},
  {id: 'ada', wake: 4.0, sleep: 21.4, name: 'Ada the lamp-girl', home: 'c9', coat: 'pink', hat: 'bow', lamplighter: true, zone: 1, round: [['c9', 60], ['bakery', 14], ['c9', 60], ['cafe', 10]]},
  {id: 'lew', wake: 4.0, sleep: 21.4, name: 'Lew the lamp-boy', home: 'c15', coat: 'brown', hat: 'cap', lamplighter: true, zone: 2, round: [['c15', 60], ['post', 12], ['c15', 60], ['cafe', 10]]},
  {id: 'ivy', wake: 6.5, sleep: 19.5, name: 'Ivy the gardener', home: 'c9', coat: 'green', hat: 'flat', round: [['platform:central', 0, 'ride:mill'], ['mill', 20], ['platform:mill', 0, 'ride:central'], ['cafe', 18], ['farm', 14], ['bakery', 10], ['c9', 50]]},
  {id: 'rudy', wake: 6.5, sleep: 18.5, name: 'Rudy the paper boy', home: 'c10', coat: 'orange', hat: 'cap', round: [['post', 20], ['c1', 5], ['c3', 5], ['c12', 5], ['c13', 5], ['c15', 5], ['c10', 45]]},
  {id: 'nell', wake: 7, sleep: 19.5, name: 'Nurse Nell', home: 'c11', coat: 'white', hat: 'bonnet', round: [['school', 22], ['cafe', 18], ['c4', 10], ['c11', 50]]},
  {id: 'otto', wake: 6, sleep: 19.5, name: 'Otto the stationmaster', home: 'c12', coat: 'blue', hat: 'cap', round: [['station', 90], ['cafe', 14], ['station', 60], ['c12', 40]]},
  {id: 'bea', wake: 8, sleep: 20, name: 'Bea the bandleader', home: 'c13', coat: 'yellow', hat: 'bow', round: [['toys', 20], ['cafe', 20], ['bakery', 12], ['c13', 50]]},
  {id: 'finn', wake: 6, sleep: 20, name: 'Finn the fisherman', home: 'c14', coat: 'sky', hat: 'flat', round: [['hut', 60], ['platform:harbour', 0, 'ride:school'], ['school', 12], ['platform:school', 0, 'ride:harbour'], ['bakery', 10], ['hut', 50], ['c14', 45]]},
  {id: 'june', wake: 8, sleep: 20, name: 'Auntie June', home: 'c15', coat: 'purple', hat: 'bun', round: [['bakery', 14], ['cafe', 30], ['post', 10], ['c15', 60]]},
  {id: 'ted', wake: 6, sleep: 20, name: 'Ted the train driver', home: 'c8', coat: 'red', hat: 'cap', round: [['station', 100], ['cafe', 16], ['station', 70], ['c8', 40]]}
];

// Vehicles drive over the lane network (see graph.mjs): each one has a plan for where to go next and a garage (a building) it leaves and returns to.
export const DAY = 480;   // seconds of simulation per day: 06:00 is the start of the morning, so a day is 8 minutes (a walk takes about an hour)
//   plan 'line': the bus goes round its stops in order, waiting at each; 'taxi': to a random doorstep and on; 'round': to each of `targets` in turn;
//   'stops': to a random one of `targets`, and waits a while; 'wander': slowly between random targets; 'call': when called out, to a random house and back.
export const VEHICLES = [
  {id: 'bus', kind: 'bus', name: 'the Toy Town bus', colour: 'red', speed: .9, plan: 'line', line: 'a', home: 'garage', from: 6.5, to: 21.5},
  {id: 'bus2', kind: 'bus', name: 'the Harbour bus', colour: 'blue', speed: .9, plan: 'line', line: 'b', home: 'garage', from: 7, to: 21},
  {id: 'taxi', kind: 'car', name: 'the taxi', colour: 'yellow', speed: 1.15, plan: 'taxi', home: 'garage', from: 6, to: 23},
  {id: 'taxi2', kind: 'car', name: 'the green taxi', colour: 'teal', speed: 1.05, plan: 'taxi', home: 'garage', from: 9, to: 22},
  {id: 'van', kind: 'van', name: 'the post van', colour: 'red', speed: 1.0, plan: 'round', targets: ['c1', 'c3', 'c5', 'c9', 'c12', 'c13', 'c8', 'c15'], home: 'post', from: 8, to: 16},
  {id: 'milk', kind: 'float', name: 'the milk float', colour: 'white', speed: .7, plan: 'round', targets: ['c2', 'c4', 'c6', 'c10', 'c11', 'c14'], home: 'barn', from: 5.5, to: 10.5},
  {id: 'tractor', kind: 'tractor', name: 'the tractor', colour: 'green', speed: .55, plan: 'wander', targets: ['farm', 'barn', 'mill', 'c14', 'hut', 'school'], home: 'barn', from: 9.5, to: 17},
  {id: 'icecream', kind: 'icecream', name: 'the ice-cream van', colour: 'pink', speed: .8, plan: 'stops', targets: ['cafe', 'post', 'toys', 'school', 'hut', 'station'], home: 'garage', from: 13, to: 18.5},
  {id: 'fire', kind: 'fire', name: 'the fire engine', colour: 'red', speed: 1.35, plan: 'call', home: 'fire', from: -1, to: -1, onCall: true}
];
// Freight: things that need moving across town, made automatically by day. Each is picked up at `from` by one of `pick` (who walks it to the platform of the
// nearest station), carried by the train to the station nearest `to`, and taken on from there by one of `drop`. `to` is only chosen when it is served by another station.
// Market day: every third day (counting from the first morning) the stalls open from 9 until 15.
export const MARKET = {every: 3, from: 9, to: 15};
export const FREIGHT = [
  {kind: 'mail', label: 'a mail sack', from: ['post'], to: ['c1', 'c3', 'c5', 'c9', 'c11', 'c13', 'school', 'hut', 'mill', 'farm', 'c14'], pick: ['pip'], drop: ['rudy', 'otto', 'finn', 'ivy', 'ted'], hours: [6.5, 11.5]},
  {kind: 'milk', label: 'milk churns', from: ['barn'], to: ['bakery', 'cafe', 'hut', 'school', 'toys', 'station', 'market'], pick: ['hay'], drop: ['ivy', 'finn', 'nell', 'bea', 'otto'], hours: [6, 11]},
  {kind: 'bread', label: 'a basket of loaves', from: ['bakery'], to: ['hut', 'school', 'mill', 'farm', 'c1', 'c9', 'c13', 'c14', 'market'], pick: ['crumb', 'june'], drop: ['otto', 'finn', 'ivy', 'rudy', 'nell', 'ted'], hours: [6.5, 11.5]}
];
export const CARGO_COLOURS = {mail: '#efe6cc', milk: '#ffffff', bread: '#d99a55', parcel: '#f2c14e'};
// The bus lines: each stops (waits a few seconds) at the doorstep of these buildings, one after another, round and round.
export const BUS_LINES = {a: ['cafe', 'fire', 'hut', 'station', 'school', 'c1', 'farm', 'mill'], b: ['mill', 'farm', 'c1', 'school', 'station', 'hut', 'fire', 'cafe']};

// Railway: a loop round the whole town. The train goes clockwise and stops at each station; `t` is the angle round the loop.
export const trackPts = (n = 480) => Array.from({length: n}, (_, i) => loopPt(i / n * TAU));
export const STATIONS = [
  {id: 'central', name: 'Central Station', t: null, building: 'station'},   // beside the station building
  {id: 'harbour', name: 'Harbour Halt', t: .55},
  {id: 'mill', name: 'Mill Halt', t: TAU * .75 + .3},
  {id: 'school', name: 'School Halt', t: TAU * .5 + .5}
];
{ const b = BUILDINGS.find(x => x.id === 'station'); STATIONS[0].t = (Math.atan2(b.z / LOOP.rz, b.x / LOOP.rx) + TAU) % TAU; }
// The harbour pier starts behind the harbour hut, crosses the railway on a little trestle and runs out into the sea.
export const PIER = (() => { const hut = BUILDINGS.find(b => b.id === 'hut'), x0 = hut ? hut.x + 1.0 : 14.3, z = hut ? hut.z + .1 : 1.9; let x1 = x0 + 2; while (shore(x1, z) < 1.0) x1 += .2; return {x0, x1: x1 + .6, z, bridge: {x: LOOP.rx, half: 1.5, h: .8}}; })();
export const GREEN = {x: 0, z: 0, r: 1.5};

// Scenery that is not a building: tree clusters [x, z, kind, scale], kinds 'round' | 'tall' | 'apple' | 'bush'.
export const TREES = (() => {
  const out = [], roadPts = allRoadPoints(), loop = trackPts(200), kinds = ['round', 'tall', 'apple', 'round'];
  // is there room for something of radius r at (x, z)? clear of buildings, roads, the railway, the pond, the paddock and the pier
  const room = (x, z, r) => shore(x, z) < .84 && BUILDINGS.every(b => Math.hypot(b.x - x, b.z - z) > r + b.w * .5 + .5) && roadPts.every(p => Math.hypot(p[0] - x, p[1] - z) > r + .85)
    && loop.every(p => Math.hypot(p[0] - x, p[1] - z) > r + 1.0) && Math.hypot(x, z) > SQUARE.ring + r + 1.0 && Math.hypot(x - POND.x, z - POND.z) > POND.r + r + .5
    && !(x > PADDOCK.x0 - r - .5 && x < PADDOCK.x1 + r + .5 && z > PADDOCK.z0 - r - .5 && z < PADDOCK.z1 + r + .5) && !(x > PIER.x0 - 1 && Math.abs(z - PIER.z) < 1.5) && out.every(t => Math.hypot(t[0] - x, t[1] - z) > (t[3] + r) * .72);
  const add = (x, z, kind, sc) => { if (room(x, z, sc * .5)) out.push([+x.toFixed(2), +z.toFixed(2), kind, sc]); };
  for (let k = 0; k < 70; k++) { const a = k / 70 * TAU + rand(k + 400) * .08, r = .72 + rand(k + 500) * .06; add(Math.cos(a) * ISLAND.rx * r, Math.sin(a) * ISLAND.rz * r, kinds[k % 4], .85 + rand(k + 600) * .3); }   // a belt of trees just inside the shore
  const grove = (cx, cz, n, seed) => { for (let k = 0; k < n; k++) { const a = k / n * TAU + rand(seed + k) * 1.2, r = .5 + rand(seed + 30 + k) * 1.4; add(cx + Math.cos(a) * r, cz + Math.sin(a) * r, kinds[(k + seed) % 4], .8 + rand(seed + 60 + k) * .3); } };
  for (let k = 0; k < 8; k++) { const a = A8(k) + TAU / 16; grove(Math.cos(a) * 7.4, Math.sin(a) * 5.6, 4, k * 11 + 3); }   // a grove in each sector, out in the blocks between the streets
  for (let k = 0; k < 8; k++) { const a = A8(k) + TAU / 16; grove(Math.cos(a) * 9.8, Math.sin(a) * 7.6, 3, k * 13 + 7); }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) add(5.2 + i * 1.3, 3.9 + j * 1.3, 'apple', .8);   // an orchard in rows
  for (let k = 0; k < 8; k++) { const a = (k + .75) / 8 * TAU, x = Math.cos(a) * 3.9, z = Math.sin(a) * 3.9; if (room(x, z, .3)) out.push([+x.toFixed(2), +z.toFixed(2), 'bush', .85]); }   // low bushes by the square
  return out;
})();

// Small deterministic random numbers (0..1) from a seed, for anything that should look hand-placed but stay stable.
export function rand(seed) { let t = (seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export const facing = b => [Math.sin(b.ry), Math.cos(b.ry)];
export const doorOf = b => { const [dx, dz] = facing(b); return {x: b.x + dx * b.door, z: b.z + dz * b.door}; };
export const building = id => BUILDINGS.find(b => b.id === id);
