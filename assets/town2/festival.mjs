// New Toy Town: the Lantern Festival, every Saturday evening. Pure (no THREE, no DOM).
// 18:30 the town gathers at the harbour with lanterns, 19:30 paper lantern boats are set afloat from the pier, 21:00 fireworks burst over the sea, 22:00 it ends.
// The dwarfs come out for it. Lantern boats are drifting points; a firework is a ring of sparks that blooms, hangs and falls.
import {PIER} from './def.mjs';

export const FEST = {weekday: 5, from: 18.5, boats: 19.5, fireworks: 21, to: 22, name: 'the Lantern Festival'};
// null, or {phase: 'gather' | 'boats' | 'fireworks', u: 0..1 through the evening}.
export function festivalAt(weekday, hour) {
  if (weekday !== FEST.weekday || hour < FEST.from || hour >= FEST.to) return null;
  return {phase: hour < FEST.boats ? 'gather' : hour < FEST.fireworks ? 'boats' : 'fireworks', u: (hour - FEST.from) / (FEST.to - FEST.from)};
}
export const BOATS = 12;
// Lantern boat i, `secs` after the boats are set afloat: out from the pier in a fan, slowly, each fading as it goes far.
export function lanternBoat(i, secs) {
  const fan = (i / (BOATS - 1) - .5) * 1.9, speed = .3 + (i % 4) * .05, d = Math.max(0, secs * speed - (i % 3) * .5 + 1), a = fan + Math.sin(secs * .3 + i) * .04;
  return {x: PIER.x1 + 1.2 + Math.cos(a) * d, z: PIER.z + 1 + Math.sin(a) * d * .9, alpha: d < .8 ? d / .8 : Math.min(1, Math.max(0, 1 - (d - 16) / 5)), live: d > 0 && d < 21};
}
// Fireworks: burst k begins 4 seconds after the one before (game seconds, 20 to the hour), over the sea off the pier. Returns the sparks of burst k at `secs` into the display.
export const SPARKS = 18, BURSTS = 5, GAP = 4, LIFE = 3.2;
const PALETTE = ['#ff5a5a', '#ffd23f', '#6fcdea', '#ff9ad2', '#9be564'];
export function firework(secs, k) {
  const t = secs - k * GAP; if (t < 0 || t > LIFE) return {live: false, sparks: []};
  const ox = PIER.x1 + 5 + (k % 3) * 3 - 3, oz = PIER.z + 3 + ((k * 7) % 5) - 2, oy = 8 + (k % 2) * 1.5, col = PALETTE[k % PALETTE.length], sparks = [];
  if (t < .5) { sparks.push({x: ox, y: .5 + (oy - .5) * (t / .5), z: oz, s: .06, c: '#ffffff'}); return {live: true, sparks, rising: true}; }   // the rocket going up
  const u = t - .5, r = 5.2 * (1 - Math.exp(-3.2 * u)), fall = .55 * u * u, fade = Math.max(0, 1 - u / (LIFE - .5));
  for (let j = 0; j < SPARKS; j++) { const a = j / SPARKS * Math.PI * 2, ring = j % 2 ? .75 : 1, ph = (j * 2.4) % 3.14, x = Math.cos(a) * Math.sin(ph + .6) * r * ring, y = Math.cos(ph + .6) * r * ring, z = Math.sin(a) * Math.sin(ph + .6) * r * ring; sparks.push({x: ox + x, y: oy + y - fall, z: oz + z, s: .17 * (.4 + fade), c: col}); }
  return {live: true, sparks, rising: false, fade};
}
// Which burst is the newest one just begun (for a bang): -1 before the display.
export const burstIndex = secs => secs < 0 ? -1 : Math.min(BURSTS - 1, Math.floor(secs / GAP));
