// New Toy Town: the walking cycle, as plain numbers (no THREE). A walker's legs are driven by the DISTANCE it has covered, not by the clock, so feet never skate:
// slow down and the strides shorten, stop and the legs settle. `k` is radians of cycle per world unit (2 pi / the length of one full stride).
const clamp = (a, v, b) => Math.max(a, Math.min(b, v));
export const newGait = () => ({phase: 0, walk: 0, amp: 0, speed: 0, px: null, pz: null, wag: 0});
// Advance a gait to the walker's new position. `vref` is the speed at which the stride is at its normal length; faster steps are a little longer (up to 1.5x), slower a little shorter.
export function stepGait(g, dt, x, z, o = {}) {
  let d = 0; if (g.px !== null) d = Math.min(o.max ?? .3, Math.hypot(x - g.px, z - g.pz)); g.px = x; g.pz = z;
  const v = dt > 1e-6 ? d / dt : 0; g.speed += (v - g.speed) * Math.min(1, dt * 8);
  const target = g.speed > (o.v0 ?? .05) ? 1 : 0; g.walk += (target - g.walk) * Math.min(1, dt * (o.ease ?? 10));
  g.phase = (g.phase + d * (o.k ?? 18)) % (Math.PI * 200); g.amp = g.walk * clamp(.65, g.speed / (o.vref ?? .5), 1.5);
  g.wag += dt * (3 + 9 * g.walk);   // (tails wag faster on the move)
  return g;
}
