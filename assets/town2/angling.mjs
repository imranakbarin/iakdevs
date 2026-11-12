// New Toy Town: the fishing game you can play from the pier. Pure (no THREE, no DOM).
// Cast, wait for a bite, then a marker sweeps to and fro along a bar: press Reel while it is over the green zone. A fish that is golden needs the
// middle of the zone. `rnd` is any 0..1 generator (the page passes Math.random; the tests pass their own).
export const GOLDEN_COINS = 20;
export function newBite(rnd) { return {wait: 1.2 + rnd() * 2.6, speed: .7 + rnd() * .5, zone: .28, at: .1 + rnd() * .55, golden: rnd() < .15}; }
// Where the marker is (0..1) this many seconds after the bite.
export const markerAt = (b, t) => { const p = ((t * b.speed) % 2 + 2) % 2; return p < 1 ? p : 2 - p; };
// The result of pressing Reel at that moment: kind is 'miss', 'fish' or 'golden'.
export function reel(b, t) {
  const m = markerAt(b, t), mid = b.at + b.zone / 2, d = Math.abs(m - mid);
  if (d > b.zone / 2) return {hit: false, kind: 'miss', m};
  const perfect = d < b.zone * .22; return {hit: true, perfect, kind: b.golden && perfect ? 'golden' : 'fish', m};
}
export const message = k => k === 'golden' ? 'A GOLDEN FISH! The harbour pays ' + GOLDEN_COINS + ' coins for it.' : k === 'fish' ? 'You caught a fish! It goes to the harbour stall.' : 'It got away!';
