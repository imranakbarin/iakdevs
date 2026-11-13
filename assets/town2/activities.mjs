// New Toy Town: what residents are DOING out of doors, decided from the simulation's own state and the clock. Pure (no THREE), so it can be tested in Node.
// The simulation keeps a resident "inside" a place for a while; this module says, for each such stay, whether the town should show them out in the open and what they do there:
// sit at a café table (the café's keeper brings the tea), shop at a market stall and carry the purchase away, play tag in the schoolyard at break with the teacher watching, feed the hens
// and look over the cows (the farmer), sweep the baker's step, arrange the toy shop's window, mend something at the garage, wave the signal flag when the train is due.
// A plan is {kind, x, z, yaw, modes (pose blend), props ({pBag, pCup, pTool}), tilt, speed (how fast they walk there), platform (stand on the platform), text}; `t` is the seconds since that stay began,
// so a plan is a pure function of the state and the time (no random looping). A plan of null means: not outside now (they are in the building, as the simulation says).
import {building, doorOf, facing, VENDORS} from './def.mjs';

const TAU = Math.PI * 2;
export const hash = s => { let n = 11; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; };
// a point `d` in front of a building's door, `side` along the pavement (to its right)
export function front(b, d, side = 0) { const [fx, fz] = facing(b), dr = doorOf(b); return {x: dr.x + fx * d + fz * side, z: dr.z + fz * d - fx * side}; }
export const faceDoor = b => b.ry + Math.PI;
const toward = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
export const BREAKS = [[9.4, 10.1], [11.5, 12.4], [14.3, 15]];   // playtime, in the town's hours
export const isBreak = hour => BREAKS.some(([a, b]) => hour >= a && hour < b);
export const STALLS = [-1.12, 0, 1.12];   // each stall's offset along the market (matches the vendors' places)
export const SHOP_T = {approach: 1.8, browse: 4.2, pay: 5.4};   // seconds into a shopper's visit
export const stallOf = r => hash(r.id + ':' + (r.outings || 0)) % STALLS.length;
export function stallSpot(m, idx, lz) { const c = Math.cos(m.ry), sn = Math.sin(m.ry), sc = m.scale || 1, lx = STALLS[idx]; return {x: m.x + (lx * c + lz * sn) * sc, z: m.z + (-lx * sn + lz * c) * sc}; }
// the point just outside a rectangle (the paddock fence) nearest to somewhere
export function outsideRect(R, pt, pad = .5) {
  const cx = Math.min(R.x1, Math.max(R.x0, pt.x)), cz = Math.min(R.z1, Math.max(R.z0, pt.z)), d = [[pt.x - R.x0 + 0, 'w'], [R.x1 - pt.x, 'e'], [pt.z - R.z0, 'n'], [R.z1 - pt.z, 's']];
  const dx = pt.x < R.x0 ? R.x0 - pt.x : pt.x > R.x1 ? pt.x - R.x1 : 0, dz = pt.z < R.z0 ? R.z0 - pt.z : pt.z > R.z1 ? pt.z - R.z1 : 0;
  if (dx >= dz) return {x: pt.x < (R.x0 + R.x1) / 2 ? R.x0 - pad : R.x1 + pad, z: cz};
  return {x: cx, z: pt.z < (R.z0 + R.z1) / 2 ? R.z0 - pad : R.z1 + pad};
}

// Each role's out-of-doors work: [period in seconds, seconds of it spent outside, where, plan]
const WORK = {
  baker: {period: 34, out: 24, spot: () => front(building('bakery'), .7, .75), face: b => b.ry + Math.PI / 2 + Math.PI, modes: {sweep: 1}, props: {pTool: 1}, tilt: {pTool: -.55}, text: 'Sweeping the step outside the bakery'},
  toyshop: {period: 30, out: 20, spot: () => front(building('toys'), .65, -.7), face: b => b.ry + Math.PI, modes: {display: 1}, props: {pTool: 1}, text: "Arranging the toy shop's window"},
  mechanic: {period: 32, out: 22, spot: () => front(building('garage'), .9, 1.0), face: b => b.ry + Math.PI * .6, modes: {tinker: 1}, props: {pTool: 1}, tilt: {pTool: .2}, text: 'Tinkering with something at the garage'}
};
const WORK_AT = {baker: 'bakery', toyshop: 'toys', mechanic: 'garage'};

// ctx: {market (the market building), platform(id) -> {x, z, tx, tz}, farm: {hens: {x, z}, cows: {x, z}, fence: {x, z, yaw}}, trainAt (station id or null), seat: {x, z, yaw, partner, seatT}}
export function planFor(r, role, env, ctx, t = 0) {
  const fair = env.rain < .3, inside = r.state === 'inside';
  if (!inside) return null;
  // shoppers at the market stalls (the vendors have their own stalls, see actors.mjs)
  if (r.at === 'market' && r.onPlatform && env.marketOpen && !VENDORS.includes(r.id) && ctx.market) {
    const idx = stallOf(r), p = stallSpot(ctx.market, idx, .72), face = ctx.market.ry + Math.PI, ph = t < SHOP_T.approach ? 'approach' : t < SHOP_T.browse ? 'browse' : t < SHOP_T.pay ? 'pay' : 'done';
    const modes = ph === 'browse' ? {browse: 1} : ph === 'pay' ? {receive: 1} : ph === 'done' ? {basket: 1} : {};
    return {kind: 'shop', stall: idx, phase: ph, x: p.x, z: p.z, yaw: face, modes, props: ph === 'done' ? {pBag: 1} : {}, speed: .5, platform: false, text: ph === 'done' ? 'Heading off with shopping from the ' + ['fish', 'greengrocer', 'farm'][idx] + ' stall' : 'Shopping at the ' + ['fish', 'greengrocer', 'farm'][idx] + ' stall'};
  }
  // school break: the children play tag in the yard and the teacher watches over them
  if (r.at === 'school' && fair && isBreak(env.hour) && ctx.school) {
    const b = building('school'), c = front(b, 1.7, 0);
    if (role === 'schoolgirl' || role === 'schoolboy') { const w = 1.55, a = w * t + (role === 'schoolgirl' ? 0 : Math.PI), R = .62; return {kind: 'play', x: c.x + Math.cos(a) * R, z: c.z + Math.sin(a) * R, yaw: Math.atan2(-Math.sin(a) * 1, Math.cos(a)), modes: Math.sin(t * .6 + (role === 'schoolgirl' ? 0 : 2)) > .35 ? {cheer: 1} : {}, props: {}, speed: 1.4, fast: true, text: 'Playing tag in the schoolyard'}; }
    if (role === 'teacher') { const p = front(b, .95, .35); return {kind: 'watch', x: p.x, z: p.z, yaw: toward(p, c), modes: Math.sin(t * .5) > .6 ? {cheer: 1} : {guard: 1}, props: {}, speed: .6, text: 'Watching over playtime'}; }
  }
  // the farmer's morning round: scatter feed for the hens, then lean on the paddock fence to look over the cows
  if (role === 'farmer' && (r.at === 'barn' || r.at === 'farm') && ctx.farm) {
    const F = ctx.farm;
    if (t < 26) { const p = F.hens; return {kind: 'feed', x: p.x, z: p.z, yaw: Math.atan2(F.hensFace.x, F.hensFace.z), modes: {scatter: 1, basket: .6}, props: {pBag: 1}, speed: .6, feeder: {x: p.x, z: p.z}, text: 'Scattering feed for the hens'}; }
    return {kind: 'tend', x: F.fence.x, z: F.fence.z, yaw: F.fence.yaw, modes: {tend: 1}, props: {}, speed: .6, visitor: {x: F.fence.x, z: F.fence.z}, text: 'Looking over the cows'};
  }
  // work on the doorstep, a few seconds out of each half minute
  const W = WORK[role];
  if (W && WORK_AT[role] === r.at && ctx.buildings !== false && fair) {
    const cyc = t % W.period; if (cyc > W.out) return null;
    const b = building(r.at), p = W.spot(); return {kind: 'work', x: p.x, z: p.z, yaw: W.face(b), modes: W.modes, props: W.props, tilt: W.tilt || {}, speed: .6, text: W.text};
  }
  // the stationmaster on the platform: the flag goes up when the train is due or standing
  if (role === 'stationmaster' && r.at === 'station' && ctx.platform) {
    const pf = ctx.platform('central'); if (!pf) return null; const out = Math.hypot(pf.x, pf.z) || 1, n = {x: pf.x / out, z: pf.z / out};
    const x = pf.x + pf.tx * -.85, z = pf.z + pf.tz * -.85, trainHere = ctx.trainAt === 'central';
    return {kind: 'platform', x, z, yaw: Math.atan2(n.x, n.z), platform: true, modes: trainHere ? {flag: 1} : {wait: 1}, props: trainHere ? {pTool: 1} : {}, speed: .6, text: trainHere ? 'Signalling the train with the flag' : 'Watching for the train'};
  }
  return null;
}
// the café keeper: when a customer has been sitting a few seconds she brings out a tray and sets the cups on the table, then goes back in. `seat` is the customer's seat and seatT how long they have sat.
export const SERVICE = {wait: 3, out: 5.2, serve: 8.2, back: 10.4};
export function servicePlan(r, ctx, seat, seatT) {
  const cafe = building('cafe'), door = doorOf(cafe); if (!seat || seatT < SERVICE.wait || seatT > SERVICE.back) return null;
  // she stands on the café side of the table, between the table and the door
  const tx = seat.table[0], tz = seat.table[1], [fx, fz] = facing(cafe), s = {x: tx - fx * .46, z: tz - fz * .46};
  const ph = seatT < SERVICE.out ? 'out' : seatT < SERVICE.serve ? 'serve' : 'back';
  const p = ph === 'back' ? {x: door.x + fx * .3, z: door.z + fz * .3} : s;
  return {kind: 'service', phase: ph, x: p.x, z: p.z, yaw: ph === 'back' ? faceDoor(cafe) : cafe.ry, modes: ph === 'serve' ? {serve: 1} : {serve: .8}, props: {pTool: 1}, speed: 1.0, served: seatT >= SERVICE.serve, text: 'Bringing tea out to the tables'};
}
export const SERVED_AT = SERVICE.serve;
