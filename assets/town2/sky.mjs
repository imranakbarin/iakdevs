// New Toy Town: the sky. Pure (no THREE, no DOM): what the light, sky and sea look like at an hour of the day, in rain or not.
// Colours are '#rrggbb' strings; main.mjs hands them to the lights and the background.

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
const lerp = (a, b, t) => a + (b - a) * t, clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// hour, sky, hemisphere sky, hemisphere ground, hemisphere strength, sun colour, sun strength, sea
const K = [
  [0,    '#16233f', '#5b6fb0', '#2b3a5c', .72, '#9db4ff', .35, '#2a5f86'],
  [4.8,  '#16233f', '#5b6fb0', '#2b3a5c', .72, '#9db4ff', .35, '#2a5f86'],
  [6.2,  '#f7b79a', '#ffd9c0', '#b89a8a', 1.0, '#ffc890', 1.0, '#6fb2c8'],
  [8.2,  '#bfe9fb', '#ffffff', '#b8d8a0', 1.55, '#fff4dc', 2.1, '#5cc4e8'],
  [16.4, '#bfe9fb', '#ffffff', '#b8d8a0', 1.55, '#fff4dc', 2.1, '#5cc4e8'],
  [18.4, '#f4a67e', '#ffd0b0', '#b89a8a', 1.0, '#ffb070', 1.1, '#6fa7c0'],
  [19.9, '#2a3358', '#7a86c0', '#3a4468', .8, '#9db4ff', .4, '#2f6a90'],
  [21.4, '#16233f', '#5b6fb0', '#2b3a5c', .72, '#9db4ff', .35, '#2a5f86'],
  [24,   '#16233f', '#5b6fb0', '#2b3a5c', .72, '#9db4ff', .35, '#2a5f86']
];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
// Northern-hemisphere seasons by calendar month (Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn).
export const seasonOf = (date = new Date()) => { const m = date.getMonth(); return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'autumn'; };
// How a season tints the day: sky colour and how much, the sun's strength and height.
const TINT = {spring: ['#c8f0f2', .18, 1, 1], summer: ['#bfe9fb', 0, 1, 1], autumn: ['#f1d9a8', .22, .95, .9], winter: ['#d4e2ee', .3, .82, .72]};

export function skyAt(hour, rain = 0, season = 'summer') {
  const h = ((hour % 24) + 24) % 24; let i = 0; while (i < K.length - 2 && h >= K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], t = clamp01((h - a[0]) / (b[0] - a[0]));
  const dark = h < 12 ? 1 - smooth(5.2, 7.0, h) : smooth(18.2, 20.2, h);
  const grey = mix('#8e99a6', '#3a4150', dark), r = clamp01(rain);
  const [tint, tk, sunK, lowK] = TINT[season] || TINT.summer, day = 1 - dark;
  const sky = mix(mix(mix(a[1], b[1], t), tint, tk * day), grey, r * .8);
  const dayAngle = clamp01((h - 6) / 13) * Math.PI, sunPos = [Math.cos(dayAngle) * 18 - 4, Math.sin(dayAngle) * 22 + 3, 10], moonPos = [-12, 20, 8];
  const pos = sunPos.map((v, k) => lerp(v, moonPos[k], dark));
  return {
    hour: h, dark, sky, fog: sky, sea: mix(mix(a[7], b[7], t), '#6f8794', r * .5),
    hemiSky: mix(a[2], b[2], t), hemiGround: mix(a[3], b[3], t), hemiI: lerp(a[4], b[4], t) * (1 - .12 * r),
    sunColor: mix(a[5], b[5], t), sunI: lerp(a[6], b[6], t) * (1 - .6 * r) * (1 - (1 - sunK) * day), sunPos: [pos[0], pos[1] * (1 - (1 - lowK) * day), pos[2]], season,
    glow: Math.max(clamp01((dark - .15) / .5), r * .3),   // windows and lanterns: lit from dusk to dawn, and a little in heavy rain
    stars: clamp01((dark - .6) / .4) * (1 - r), night: dark
  };
}
