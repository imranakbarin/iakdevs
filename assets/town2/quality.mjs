// New Toy Town: picture quality tiers and the governor that picks one from measured frame time. Pure (no THREE, no DOM).
// Features cost the GPU, so they go first when the town runs slowly; the render resolution comes next (that is main.mjs's business).
export const TIERS = ['low', 'medium', 'high'];
export const PROFILE = {
  low:    {waves: 0, foam: 0, sway: 0,  tufts: 0,    glow: 0, grade: 0},
  medium: {waves: 1, foam: 1, sway: .6, tufts: 900,  glow: 1, grade: 0},
  high:   {waves: 1, foam: 1, sway: 1,  tufts: 2200, glow: 1, grade: 1}
};
export const isTier = t => TIERS.includes(t);
// where to start: what the visitor asked for, else a phone starts in the middle and everything else high
export function startTier({forced, phone}) { return isTier(forced) ? forced : phone ? 'medium' : 'high'; }
// The governor takes a frame-time sample (average seconds a frame over about two seconds) and says 'down', 'up' or null.
//   Two slow samples in a row: down. Five fast ones in a row: up, but if going up is followed by a slow spell soon after, that tier is capped.
export function createGovernor(start, o = {}) {
  const slowAt = o.slowAt ?? .045, fastAt = o.fastAt ?? .02, needDown = o.needDown ?? 2, needUp = o.needUp ?? 5;
  const g = {tier: start, cap: 'high', slowN: 0, fastN: 0, sinceUp: Infinity, sinceDown: Infinity, locked: !!o.locked,
    step(avg, canUp = true) {
      if (g.locked) return null; g.sinceUp++; if (++g.sinceDown > 60) g.cap = 'high';   // (a cap is forgotten after a couple of minutes without a drop)
      if (avg > slowAt) { g.fastN = 0; if (++g.slowN >= needDown) { g.slowN = 0; const i = TIERS.indexOf(g.tier); if (i > 0) { if (g.sinceUp < 12) g.cap = TIERS[i - 1]; g.tier = TIERS[i - 1]; g.sinceDown = 0; return 'down'; } } }
      else if (avg < fastAt && canUp) { g.slowN = 0; if (++g.fastN >= needUp) { g.fastN = 0; const i = TIERS.indexOf(g.tier); if (i + 1 <= TIERS.indexOf(g.cap)) { g.tier = TIERS[i + 1]; g.sinceUp = 0; return 'up'; } } }
      else { g.slowN = 0; g.fastN = 0; }
      return null;
    }};
  return g;
}
