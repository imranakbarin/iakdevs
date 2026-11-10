// New Toy Town: the road graph. Pure maths (no THREE, no DOM).
//  - every road (the inner ring, the eight spokes, the outer ring road) is a sampled polyline between two nodes; together they form one connected network;
//  - walkers get door-to-door routes along the pavements (shortest path over the graph);
//  - vehicles drive on lanes: each two-way road has a lane each way (keeping left), the inner ring one lane clockwise. A vehicle plans a route as a
//    list of lanes (shortest way by Dijkstra) which `routeLine` turns into one smooth line to follow;
//  - the railway is a closed loop (`loop`) round the whole town.
import {SQUARE, ROADS, NODES, ROAD, BUILDINGS, LAMPS, trackPts, doorOf} from './def.mjs';
import {curve, STEP} from './curve.mjs';

export {curve};
// A polyline with running length, and helpers to walk along it.
export function line(pts, closed = false) {
  const at = [0]; for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = closed ? at[at.length - 1] + Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) : at[at.length - 1];
  return {pts, at, length, closed};
}
// Position and heading (tx, tz) at distance s along a line.
export function along(L, s) {
  const n = L.pts.length;
  if (L.closed) s = ((s % L.length) + L.length) % L.length; else s = Math.min(L.length, Math.max(0, s));
  let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (L.at[mid] <= s) lo = mid; else hi = mid - 1; }
  const a = L.pts[lo], b = L.pts[lo + 1 < n ? lo + 1 : (L.closed ? 0 : lo)], seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = Math.min(1, (s - L.at[lo]) / seg);
  let tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
  if (a === b) { const p = L.pts[Math.max(0, lo - 1)]; const d = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1; tx = (a[0] - p[0]) / d; tz = (a[1] - p[1]) / d; }
  return {x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx, tz};
}
// The left-hand side of a heading, seen from above with z running south (heading east, left is north).
export const leftOf = (tx, tz) => [tz, -tx];

export function buildGraph() {
  const nodes = {}; for (const [id, p] of Object.entries(NODES)) nodes[id] = {id, p: p.slice(), edges: []};
  const edges = ROADS.map(r => ({id: r.id, kind: r.kind, name: r.name, a: r.a, b: r.b, oneway: !!r.oneway, line: line(curve(r.points))}));
  for (const e of edges) { nodes[e.a].edges.push(e.id); nodes[e.b].edges.push(e.id); }
  const edge = id => edges.find(e => e.id === id);
  // Which side of an edge the pavement is on at a point: +1 is the left of the edge's own direction.
  const pavement = (e, s, side) => { const q = along(e.line, s), [lx, lz] = leftOf(q.tx, q.tz), d = ROAD.pave * side; return [q.x + lx * d, q.z + lz * d]; };
  // The nearest point of the network to a door: {edge, s, side, dist}. Pavements round the square are always the outer side.
  function attach(x, z) {
    let best = null;
    for (const e of edges) for (let i = 0; i < e.line.pts.length; i++) {
      const p = e.line.pts[i], d = Math.hypot(p[0] - x, p[1] - z);
      if (!best || d < best.dist) { const q = along(e.line, e.line.at[i]), [lx, lz] = leftOf(q.tx, q.tz); best = {edge: e.id, s: e.line.at[i], dist: d, side: ((x - p[0]) * lx + (z - p[1]) * lz) >= 0 ? 1 : -1}; }
    }
    if (edge(best.edge).kind === 'ring') best.side = 1;   // clockwise with z south: the left of travel is the outside of the ring
    return best;
  }
  // Shortest way along the centre lines from one attachment to another: a list of {edge, from, to}.
  function centreRoute(A, B) {
    if (A.edge === B.edge) return [{edge: A.edge, from: A.s, to: B.s}];
    const eA = edge(A.edge), eB = edge(B.edge), dist = {}, prev = {}, todo = new Set(Object.keys(nodes));
    for (const id of todo) dist[id] = Infinity;
    dist[eA.a] = A.s; dist[eA.b] = eA.line.length - A.s; prev[eA.a] = prev[eA.b] = null;
    while (todo.size) {
      let u = null; for (const id of todo) if (u === null || dist[id] < dist[u]) u = id;
      todo.delete(u); if (dist[u] === Infinity) break;
      for (const eid of nodes[u].edges) { const e = edge(eid), v = e.a === u ? e.b : e.a, d = dist[u] + e.line.length; if (d < dist[v]) { dist[v] = d; prev[v] = {node: u, edge: eid}; } }
    }
    const viaA = dist[eB.a] + B.s, viaB = dist[eB.b] + (eB.line.length - B.s), endNode = viaA <= viaB ? eB.a : eB.b, legs = [];
    legs.unshift({edge: eB.id, from: endNode === eB.a ? 0 : eB.line.length, to: B.s});
    let n = endNode;
    while (prev[n]) { const e = edge(prev[n].edge), forward = e.b === n; legs.unshift({edge: e.id, from: forward ? 0 : e.line.length, to: forward ? e.line.length : 0}); n = prev[n].node; }
    legs.unshift({edge: eA.id, from: A.s, to: n === eA.a ? 0 : eA.line.length});
    return legs.filter(l => Math.abs(l.to - l.from) > 1e-6 || legs.length === 1);
  }
  // A walking route from one doorstep (or lamp) to another: a polyline along the pavements, door to door.
  const doors = {};
  for (const b of BUILDINGS) if (b.door) { const d = doorOf(b); doors[b.id] = {x: d.x, z: d.z, ...attach(d.x, d.z)}; }
  for (const l of LAMPS) doors[l.id] = {x: l.spot[0], z: l.spot[1], ...attach(l.spot[0], l.spot[1])};   // the lamplighter's stops walk like doorsteps
  function walk(fromId, toId) {
    const A = doors[fromId], B = doors[toId]; if (!A || !B) return null;
    const pts = [[A.x, A.z]], legs = centreRoute(A, B);
    legs.forEach((leg, i) => {
      const e = edge(leg.edge), side = e.kind === 'ring' ? 1 : i === 0 ? A.side : i === legs.length - 1 ? B.side : 1;
      const len = Math.abs(leg.to - leg.from), n = Math.max(1, Math.ceil(len / STEP)), dir = Math.sign(leg.to - leg.from) || 1;
      for (let k = 0; k <= n; k++) pts.push(pavement(e, leg.from + dir * len * k / n, side));
    });
    pts.push([B.x, B.z]);
    return line(pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-4));
  }

  // ---- Lanes for the vehicles. Each lane runs one way along an edge, keeping left of its own direction (the inner ring is a single lane down the middle).
  const lanes = [], laneById = {}, lanesFrom = {};
  for (const id of Object.keys(nodes)) lanesFrom[id] = [];
  for (const e of edges) for (const dir of e.oneway ? [1] : [1, -1]) {
    const src = dir === 1 ? e.line.pts : e.line.pts.slice().reverse(), off = e.oneway ? 0 : ROAD.lane, pts = src.map((p, i) => {
      const a = src[Math.max(0, i - 1)], b = src[Math.min(src.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, [lx, lz] = leftOf((b[0] - a[0]) / d, (b[1] - a[1]) / d);
      return [p[0] + lx * off, p[1] + lz * off];
    });
    const lane = {id: e.id + (dir === 1 ? '+' : '-'), edge: e.id, dir, from: dir === 1 ? e.a : e.b, to: dir === 1 ? e.b : e.a, line: line(pts), length: line(pts).length};
    lanes.push(lane); laneById[lane.id] = lane; lanesFrom[lane.from].push(lane);
  }
  const lane = id => laneById[id];
  // The lanes a vehicle can move on to from the end of one: all that leave the same node except straight back where it came from.
  const nextLanes = l => lanesFrom[l.to].filter(n => !(n.edge === l.edge && n.dir === -l.dir));
  // The shortest list of lanes from one lane to another (both included). If it is the same lane, the way back round to it.
  function laneRoute(fromId, toId) {
    const dist = {}, prev = {}, todo = new Set(lanes.map(l => l.id)), same = fromId === toId;
    for (const id of todo) dist[id] = Infinity;
    if (same) for (const n of nextLanes(laneById[fromId])) { dist[n.id] = n.length + .25; prev[n.id] = fromId; } else dist[fromId] = 0;
    while (todo.size) {
      let u = null; for (const id of todo) if (u === null || dist[id] < dist[u]) u = id;
      if (dist[u] === Infinity) break; todo.delete(u); if (u === toId) break;
      for (const n of nextLanes(laneById[u])) { const d = dist[u] + n.length + .25; if (d < dist[n.id]) { dist[n.id] = d; prev[n.id] = u; } }
    }
    if (dist[toId] === Infinity) return null;
    const path = [toId]; let cur = toId;
    while (prev[cur] !== undefined) { cur = prev[cur]; path.unshift(cur); if (cur === fromId) break; }
    return path;
  }
  // The nearest lane point to (x, z): {lane, s, dist}.
  function lanePoint(x, z) {
    let best = null;
    for (const l of lanes) for (let i = 0; i < l.line.pts.length; i++) { const p = l.line.pts[i], d = Math.hypot(p[0] - x, p[1] - z); if (!best || d < best.dist) best = {lane: l.id, s: l.line.at[i], dist: d}; }
    return best;
  }
  // One smooth line to follow for a list of lanes: their points joined and softened where one lane meets the next.
  // `bounds[i]` is where lane i starts and ends along the route.
  function routeLine(laneIds) {
    let pts = [], starts = [];
    laneIds.forEach((id, i) => { starts.push(pts.length); const src = laneById[id].line.pts; for (let k = i === 0 ? 0 : 1; k < src.length; k++) pts.push(src[k]); });
    for (let pass = 0; pass < 2; pass++) { const out = pts.map(p => p.slice()); for (let i = 3; i < pts.length - 3; i++) { let x = 0, z = 0; for (let k = -3; k <= 3; k++) { x += pts[i + k][0]; z += pts[i + k][1]; } out[i] = [x / 7, z / 7]; } pts = out; }
    const L = line(pts), bounds = laneIds.map((id, i) => ({lane: id, s0: L.at[starts[i]], s1: i + 1 < laneIds.length ? L.at[starts[i + 1]] : L.length}));
    return {line: L, bounds, lanes: laneIds.slice()};
  }

  // ---- The railway: a closed loop round the whole town.
  const loop = line(trackPts(), true);
  const loopS = (x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < loop.pts.length; i++) { const d = Math.hypot(loop.pts[i][0] - x, loop.pts[i][1] - z); if (d < bd) { bd = d; best = loop.at[i]; } } return best; };
  return {nodes, edges, edge, attach, doors, walk, lanes, lane, nextLanes, laneRoute, lanePoint, routeLine, loop, loopS};
}
// The distance along a line of its point nearest to (x, z).
export function nearest(L, x, z) { let best = 0, bd = Infinity; for (let i = 0; i < L.pts.length; i++) { const d = Math.hypot(L.pts[i][0] - x, L.pts[i][1] - z); if (d < bd) { bd = d; best = L.at[i]; } } return {s: best, dist: bd}; }
