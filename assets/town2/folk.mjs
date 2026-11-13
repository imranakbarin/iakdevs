// New Toy Town: who the residents ARE (pure data, no THREE): age, build, skin, face and hair for each of the cast (FOLK), a made-up identity for anyone not listed, their dimensions,
// and which wear (mild, rain, winter) the weather calls for. The costumes for each role are in people.mjs; an identity never changes with the outfit.
export const SKIN = {fair: '#f7d6b8', light: '#f1c9a0', tan: '#dca97a', olive: '#c99669', brown: '#9c6a46', deep: '#6e4630'};
export const HAIR = {black: '#2a2523', darkbrown: '#4a3426', brown: '#6b4a32', chestnut: '#8a5436', auburn: '#9a4a2a', ginger: '#c8662c', blond: '#e1bd62', strawberry: '#d9a066', grey: '#a8adb2', white: '#ecebe6', silver: '#c9ced3'};

// age: child | teen | adult | elder; sex: m | f (for the body shape only); build: slim | average | stocky | round; tall: height factor.
const h = (style, color, o = {}) => ({style, color: HAIR[color] || color, ...o});
export const FOLK = {
  crumb: {age: 'adult', sex: 'm', build: 'round', tall: .98, skin: 'light', hair: h('bald', 'white'), brow: 'bushy', nose: 'big', eyeColour: '#4c78a8', mouth: 'grin', beard: 'walrus', beardColour: HAIR.white, role: 'baker'},
  pott: {age: 'adult', sex: 'f', build: 'average', skin: 'fair', hair: h('bun', 'chestnut'), brow: 'arched', nose: 'button', eyeColour: '#5b8c5a', mouth: 'smile', freckles: true, role: 'cafe'},
  bell: {age: 'adult', sex: 'm', build: 'stocky', tall: 1.08, skin: 'tan', hair: h('crop', 'black'), brow: 'stern', nose: 'wide', eyeColour: '#4a3426', mouth: 'neutral', beard: 'stache', role: 'police'},
  pip: {age: 'teen', sex: 'm', build: 'slim', skin: 'light', hair: h('quiff', 'ginger'), brow: 'arched', nose: 'upturned', eyeColour: '#4c8a6e', mouth: 'grin', freckles: true, role: 'post'},
  tilly: {age: 'adult', sex: 'f', build: 'slim', tall: .94, skin: 'brown', hair: h('curly', 'black'), brow: 'arched', nose: 'button', eyeColour: '#3a2a20', mouth: 'smile', eyes: 'happy', role: 'toyshop'},
  embers: {age: 'adult', sex: 'f', build: 'stocky', tall: 1.06, skin: 'olive', hair: h('ponytail', 'auburn', {ribbon: '#2a2523'}), brow: 'thick', nose: 'wide', eyeColour: '#5a4a3a', mouth: 'smirk', role: 'fire'},
  moss: {age: 'elder', sex: 'f', build: 'round', tall: .93, skin: 'fair', hair: h('bun', 'white'), brow: 'thin', nose: 'pointy', eyeColour: '#6a8fa8', mouth: 'smile', glasses: 'gold', role: 'granny'},
  sprocket: {age: 'adult', sex: 'm', build: 'stocky', skin: 'light', hair: h('tufts', 'grey'), brow: 'bushy', nose: 'big', eyeColour: '#5a7a8a', mouth: 'smile', beard: 'sideburns', beardColour: HAIR.grey, role: 'miller'},
  hay: {age: 'elder', sex: 'm', build: 'stocky', tall: 1.04, skin: 'tan', hair: h('tufts', 'white'), brow: 'bushy', nose: 'long', eyeColour: '#5b7fa0', mouth: 'smile', beard: 'full', beardColour: HAIR.white, role: 'farmer'},
  chalk: {age: 'adult', sex: 'f', build: 'slim', tall: 1.02, skin: 'light', hair: h('bun', 'brown'), brow: 'thin', nose: 'pointy', eyeColour: '#5a4a3a', mouth: 'smile', glasses: 'dark', role: 'teacher'},
  sparky: {age: 'adult', sex: 'm', build: 'average', skin: 'deep', hair: h('crop', 'black'), brow: 'thick', nose: 'wide', eyeColour: '#2a1f1a', mouth: 'grin', role: 'mechanic'},
  salt: {age: 'elder', sex: 'm', build: 'round', tall: 1.0, skin: 'tan', hair: h('tufts', 'white'), brow: 'bushy', nose: 'big', eyeColour: '#4c78a8', mouth: 'smile', beard: 'full', beardColour: HAIR.white, role: 'captain'},
  wick: {age: 'adult', sex: 'm', build: 'slim', tall: 1.12, skin: 'fair', hair: h('side', 'darkbrown'), brow: 'worried', nose: 'long', eyeColour: '#6a8a5a', mouth: 'smile', jaw: .9, role: 'lamplighter'},
  dot: {age: 'child', sex: 'f', build: 'average', skin: 'light', hair: h('pigtails', 'blond', {ribbon: '#d9506a'}), brow: 'arched', nose: 'button', eyeColour: '#4c8ab0', mouth: 'open', freckles: true, role: 'schoolgirl'},
  dash: {age: 'child', sex: 'm', build: 'average', skin: 'olive', hair: h('crop', 'darkbrown'), brow: 'arched', nose: 'upturned', eyeColour: '#4a3426', mouth: 'grin', role: 'schoolboy'},
  ada: {age: 'teen', sex: 'f', build: 'slim', skin: 'deep', hair: h('afro', 'black'), brow: 'arched', nose: 'button', eyeColour: '#2a1f1a', mouth: 'smile', eyes: 'happy', role: 'lampgirl'},
  lew: {age: 'teen', sex: 'm', build: 'slim', skin: 'brown', hair: h('crop', 'brown'), brow: 'flat', nose: 'upturned', eyeColour: '#4a3426', mouth: 'smirk', freckles: true, role: 'lampboy'},
  ivy: {age: 'adult', sex: 'f', build: 'average', skin: 'tan', hair: h('long', 'auburn'), brow: 'arched', nose: 'button', eyeColour: '#4c8a6e', mouth: 'smile', freckles: true, role: 'gardener'},
  rudy: {age: 'teen', sex: 'm', build: 'average', skin: 'fair', hair: h('side', 'blond'), brow: 'arched', nose: 'upturned', eyeColour: '#4c78a8', mouth: 'grin', freckles: true, eyes: 'sleepy', role: 'paperboy'},
  nell: {age: 'adult', sex: 'f', build: 'average', skin: 'brown', hair: h('bob', 'black'), brow: 'thin', nose: 'button', eyeColour: '#3a2a20', mouth: 'smile', role: 'nurse'},
  otto: {age: 'adult', sex: 'm', build: 'stocky', tall: 1.04, skin: 'light', hair: h('crop', 'grey'), brow: 'thick', nose: 'long', eyeColour: '#5a7a8a', mouth: 'neutral', beard: 'stache', beardColour: HAIR.grey, glasses: 'gold', role: 'stationmaster'},
  bea: {age: 'adult', sex: 'f', build: 'round', skin: 'olive', hair: h('curly', 'ginger'), brow: 'arched', nose: 'wide', eyeColour: '#5a8a6a', mouth: 'grin', role: 'bandleader'},
  finn: {age: 'adult', sex: 'm', build: 'average', tall: 1.03, skin: 'tan', hair: h('crop', 'chestnut'), brow: 'flat', nose: 'long', eyeColour: '#4c78a8', mouth: 'smirk', beard: 'goatee', role: 'fisherman'},
  june: {age: 'adult', sex: 'f', build: 'round', tall: .97, skin: 'fair', hair: h('curly', 'strawberry'), brow: 'arched', nose: 'upturned', eyeColour: '#6a8fa8', mouth: 'smile', freckles: true, role: 'visitor'},
  gill: {age: 'adult', sex: 'f', build: 'stocky', skin: 'olive', hair: h('bun', 'darkbrown'), brow: 'thick', nose: 'wide', eyeColour: '#4a3426', mouth: 'open', role: 'fishmonger'},
  apple: {age: 'adult', sex: 'm', build: 'round', skin: 'brown', hair: h('bald', 'black', {tuft: true}), brow: 'arched', nose: 'big', eyeColour: '#3a2a20', mouth: 'grin', beard: 'stache', role: 'grocer'},
  mint: {age: 'adult', sex: 'm', build: 'slim', tall: 1.05, skin: 'light', hair: h('side', 'silver'), brow: 'thin', nose: 'pointy', eyeColour: '#5a8aa8', mouth: 'smile', glasses: 'gold', role: 'doctor'},
  ted: {age: 'adult', sex: 'm', build: 'stocky', skin: 'tan', hair: h('crop', 'ginger'), brow: 'thick', nose: 'button', eyeColour: '#5a7a4a', mouth: 'grin', beard: 'sideburns', freckles: true, role: 'driver'}
};
// anyone not listed (a newcomer in a saved town, a visitor) gets a face made from their id, so they too are somebody
const hash = s => { let n = 7; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; };
export function identityOf(def) {
  if (FOLK[def.id]) return FOLK[def.id];
  const n = hash(def.id), pick = (a, k) => a[(n >> k) % a.length];
  return {age: def.small ? 'child' : 'adult', sex: n & 1 ? 'f' : 'm', build: pick(['slim', 'average', 'stocky', 'round'], 3), skin: pick(Object.keys(SKIN), 5), hair: h(pick(['crop', 'side', 'bun', 'curly', 'long', 'bob', 'ponytail'], 7), pick(Object.keys(HAIR), 9)), brow: pick(['arched', 'flat', 'thick', 'thin'], 11), nose: pick(['button', 'wide', 'upturned', 'long'], 13), eyeColour: pick(['#4c78a8', '#5a4a3a', '#4c8a6e', '#6a8fa8'], 15), mouth: pick(['smile', 'grin', 'smirk', 'neutral'], 17), freckles: !!((n >> 19) & 1), glasses: ((n >> 20) & 7) === 0 ? 'dark' : undefined, role: 'visitor'};
}

/* ---------------- dimensions ---------------- */
const AGE = {child: {H: .4, leg: .385, tor: .27, neck: .04, hr: .064, sw: .05, hw: .029}, teen: {H: .48, leg: .43, tor: .28, neck: .035, hr: .064, sw: .06, hw: .034}, adult: {H: .56, leg: .44, tor: .28, neck: .034, hr: .066, sw: .074, hw: .041}, elder: {H: .54, leg: .42, tor: .28, neck: .03, hr: .066, sw: .072, hw: .04}};
const BUILD = {slim: .88, average: 1, stocky: 1.13, round: 1.2};
export function dimsOf(I) {
  const a = AGE[I.age], H = a.H * (I.tall || 1), bw = BUILD[I.build] || 1, f = I.sex === 'f';
  const D = {H, bw, legLen: H * a.leg, tor: H * a.tor, hr: a.hr, sw: a.sw * bw * (f ? .93 : 1), hw: a.hw * bw * (f ? 1.06 : 1), depth: .05 * bw * (I.age === 'child' ? .9 : 1), belly: I.build === 'round' ? 1 : I.build === 'stocky' ? .4 : 0, stoop: I.age === 'elder' ? .1 : 0};
  D.shY = D.legLen + D.tor; D.neck = H * a.neck; D.hy = D.shY + D.neck + D.hr * .78; D.ua = D.tor * .62; D.fa = D.tor * .56; D.wristY = D.shY - D.ua - D.fa; D.kneeY = D.legLen * .5; D.ankleY = H * .06; D.xR = -(D.sw + .008); D.xL = D.sw + .008;
  D.top = D.hy + D.hr * 1.04; return D;
}


export const wearFor = (season, rain) => season === 'winter' ? 'winter' : rain > .25 ? 'rain' : 'base';
export const WEARS = ['base', 'rain', 'winter'];
export const ROLE_NAMES = ['baker', 'cafe', 'police', 'post', 'toyshop', 'fire', 'granny', 'miller', 'farmer', 'teacher', 'mechanic', 'captain', 'lamplighter', 'schoolgirl', 'schoolboy', 'lampgirl', 'lampboy', 'gardener', 'paperboy', 'nurse', 'stationmaster', 'bandleader', 'fisherman', 'visitor', 'fishmonger', 'grocer', 'doctor', 'driver'];
