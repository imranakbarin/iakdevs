// New Toy Town: the road graph. Pure maths (no THREE, no DOM).
//  - the ring round the square and the four spokes are sampled into polylines (edges) joined at nodes;
//  - walkers get door-to-door routes along the pavements (shortest path over the graph);
//  - vehicles get one closed tour of the whole network that never crosses itself, so keeping a gap along the tour
//    is all the collision avoidance they need: clockwise round the ring, and at each exit out along the spoke on
//    the left, round the turning circle and back on the other side.
import {SQUARE, SPOKES, ROAD, BUILDINGS, doorOf} from './def.mjs';

const STEP = .22;
// A smooth curve through control points (centripetal Catmull-Rom, sampled about every STEP units).
export function curve(points) {
  const P = [points[0], ...points, points[points.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / STEP));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(points[points.length - 1].slice());
  return out;
}
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
  const R = SQUARE.ring, exits = SPOKES.slice().sort((a, b) => a.angle - b.angle);
  const nodes = {}, edges = [];
  const ringPoint = a => [SQUARE.x + Math.cos(a) * R, SQUARE.z + Math.sin(a) * R];
  exits.forEach(s => { nodes['ring:' + s.id] = {id: 'ring:' + s.id, p: ringPoint(s.angle)}; nodes['end:' + s.id] = {id: 'end:' + s.id, p: s.points[s.points.length - 1].slice()}; });
  // ring arcs, each from one exit clockwise to the next
  exits.forEach((s, i) => {
    const t = exits[(i + 1) % exits.length], a0 = s.angle, a1 = t.angle > a0 ? t.angle : t.angle + Math.PI * 2, n = Math.ceil((a1 - a0) * R / STEP), pts = [];
    for (let k = 0; k <= n; k++) pts.push(ringPoint(a0 + (a1 - a0) * k / n));
    edges.push({id: 'arc:' + s.id, kind: 'ring', a: 'ring:' + s.id, b: 'ring:' + t.id, line: line(pts)});
  });
  exits.forEach(s => edges.push({id: 'spoke:' + s.id, kind: 'spoke', spoke: s.id, a: 'ring:' + s.id, b: 'end:' + s.id, line: line(curve(s.points))}));
  for (const n of Object.values(nodes)) n.edges = edges.filter(e => e.a === n.id || e.b === n.id).map(e => e.id);
  const edge = id => edges.find(e => e.id === id);
  // Which side of an edge the pavement is on at a point: +1 is the left of the edge's own direction.
  const pavement = (e, s, side) => { const q = along(e.line, s), [lx, lz] = leftOf(q.tx, q.tz), d = ROAD.pave * side; return [q.x + lx * d, q.z + lz * d]; };
  // The nearest point of the network to a door: {edge, s, side, dist}. Ring pavements are always the outer side.
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
      todo.delete(u);
      for (const eid of nodes[u].edges) { const e = edge(eid), v = e.a === u ? e.b : e.a, d = dist[u] + e.line.length; if (d < dist[v]) { dist[v] = d; prev[v] = {node: u, edge: eid}; } }
    }
    const viaA = dist[eB.a] + B.s, viaB = dist[eB.b] + (eB.line.length - B.s), endNode = viaA <= viaB ? eB.a : eB.b, legs = [];
    legs.unshift({edge: eB.id, from: endNode === eB.a ? 0 : eB.line.length, to: B.s});
    let n = endNode;
    while (prev[n]) { const e = edge(prev[n].edge), forward = e.b === n; legs.unshift({edge: e.id, from: forward ? 0 : e.line.length, to: forward ? e.line.length : 0}); n = prev[n].node; }
    legs.unshift({edge: eA.id, from: A.s, to: n === eA.a ? 0 : eA.line.length});
    return legs.filter(l => Math.abs(l.to - l.from) > 1e-6 || legs.length === 1);
  }
  // A walking route from one building's door to another's: a polyline along the pavements, door to door.
  const doors = {};
  for (const b of BUILDINGS) if (b.door) { const d = doorOf(b); doors[b.id] = {x: d.x, z: d.z, ...attach(d.x, d.z)}; }
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
  // The vehicles' tour: one closed line that covers every lane exactly once.
  function tour() {
    const lane = ROAD.lane, delta = Math.asin(lane / R), pts = [];
    exits.forEach((s, i) => {
      const prevExit = exits[(i + exits.length - 1) % exits.length], a0 = prevExit.angle + delta, a1 = (s.angle > prevExit.angle ? s.angle : s.angle + Math.PI * 2) - delta;
      const n = Math.max(2, Math.ceil((a1 - a0) * R / STEP));
      for (let k = 0; k <= n; k++) pts.push(ringPoint(a0 + (a1 - a0) * k / n));                       // round the ring to this exit
      const L = edge('spoke:' + s.id).line, m = Math.ceil(L.length / STEP);
      for (let k = 1; k <= m; k++) { const q = along(L, L.length * k / m), [lx, lz] = leftOf(q.tx, q.tz); pts.push([q.x + lx * lane, q.z + lz * lane]); }   // out, keeping left
      const e = along(L, L.length), [lx, lz] = leftOf(e.tx, e.tz);
      for (let k = 1; k < 10; k++) { const f = Math.PI * k / 10; pts.push([e.x + (lx * Math.cos(f) + e.tx * Math.sin(f)) * lane * 1.6, e.z + (lz * Math.cos(f) + e.tz * Math.sin(f)) * lane * 1.6]); }   // the turning circle
      for (let k = m; k >= 1; k--) { const q = along(L, L.length * k / m), [qx, qz] = leftOf(q.tx, q.tz); pts.push([q.x - qx * lane, q.z - qz * lane]); }       // and back on the other side
    });
    // one pass of corner-cutting softens the joins between ring and spokes
    const soft = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; soft.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
    return line(soft, true);
  }
  return {nodes, edges, edge, attach, doors, walk, tour: tour(), exits};
}
// The distance along a line of its point nearest to (x, z).
export function nearest(L, x, z) { let best = 0, bd = Infinity; for (let i = 0; i < L.pts.length; i++) { const d = Math.hypot(L.pts[i][0] - x, L.pts[i][1] - z); if (d < bd) { bd = d; best = L.at[i]; } } return {s: best, dist: bd}; }
