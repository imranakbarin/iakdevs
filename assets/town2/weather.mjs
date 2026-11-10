// New Toy Town: the weather. Pure (no THREE, no DOM). Spells of clear, cloud and rain follow one another; `rain` (0..1) eases in and out.
import {rand} from './def.mjs';

const SPELLS = [['clear', 110, 220, 0, .15], ['cloudy', 40, 80, 0, .75], ['rain', 70, 130, 1, 1], ['cloudy', 30, 60, 0, .6], ['clear', 120, 240, 0, .1], ['drizzle', 50, 90, .4, .9]];
export function createWeather(seed = 7) {
  let n = 0, idx = -1, left = 0, forced = null;
  const w = {kind: 'clear', rain: 0, cloud: .15, wet: 0, spells: 0};   // `wet`: how soaked the ground is (puddles): fills in the rain, dries slowly after
  const next = () => { idx = (idx + 1) % SPELLS.length; const [kind, a, b, rain, cloud] = SPELLS[idx]; w.kind = kind; w.target = rain; w.cloudTarget = cloud; left = a + (b - a) * rand(seed * 53 + (n++)); w.spells++; };
  next();
  w.update = dt => {
    left -= dt; if (left <= 0) { if (forced) forced = null; next(); }
    const k = Math.min(1, dt / 7); w.rain += (w.target - w.rain) * k; w.cloud += (w.cloudTarget - w.cloud) * k;
    w.wet = Math.max(0, Math.min(1, w.wet + (w.rain > .15 ? w.rain * dt / 14 : -dt / 45)));
  };
  // make it rain (or a given kind) for a while, then carry on with the sequence
  w.force = (kind, seconds = 60) => { const s = SPELLS.find(x => x[0] === kind) || SPELLS[0]; forced = kind; w.kind = kind; w.target = s[3]; w.cloudTarget = s[4]; left = seconds; };
  return w;
}
