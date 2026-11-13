// New Toy Town: the animals. Each is ONE bone-skinned mesh (rig.mjs) built with real anatomy: a horse has a poll, muzzle, crest of mane, a barrel chest and four legs of two bones each
// (knee/hock and hoof) and a harness that connects collar, traces, shafts and reins; cows, sheep, dogs and cats have their own heads, ears and tails; hens, chicks and ducks have beaks,
// wings and feet. Everything faces +z with +x to its left and stands on y = 0. Poses (walk, trot, graze, sniff, sit, scratch, peck...) are in pose.mjs.
import * as THREE from 'three';
import {Bag} from './build.mjs';
import {Rig, boneTag, rigMesh} from './rig.mjs';
import {quadSkeleton, BIRD} from './pose.mjs';
import {ell, rod} from './shapes.mjs';
import {mix, dark, light} from './faces.mjs';
import {PALETTE as P} from './def.mjs';

const pc = c => P[c] || c;
function start(sk) { const rig = new Rig(sk.names, sk.parents), b = new Bag(); return {rig, b, on: (bone, fn) => boneTag(b, rig.index[bone], fn)}; }
function finish(rig, b, kind, sp, scale, extra = {}, shadow = false) { const mesh = rigMesh(b, rig, {shadow}); const g = new THREE.Group(); g.add(mesh); g.scale.setScalar(scale); g.userData = {rig, kind, sp, mesh, scale, ...extra}; return g; }
const LR = [[1, 'L'], [-1, 'R']];
// a leg of two bones: upper from the hip/shoulder to the knee/hock, lower from there down to the hoof or paw
function leg(c, nm, pts, r, hoof) {
  const {b, on} = c, [h, k, f] = pts;   // hip, knee, foot
  on(nm + 'u', () => { rod(b, h, k, r[0], r[1], c.col, 7); ell(b, k[0], k[1], k[2], r[1] * 1.1, r[1] * 1.1, r[1] * 1.1, c.col, 7); });
  on(nm + 'l', () => { rod(b, k, f, r[1] * .95, r[2], c.low || c.col, 7); if (hoof) hoof(f); });
}

/* ---------------- the horse (and the cart it pulls) ---------------- */
// o: {coat, mane, cart (a harness, a cart and two wheels), z (where the body's middle is)}
export function buildHorse(o = {}) {
  const sk = quadSkeleton(o.cart ? ['wheelL', 'wheelR'] : []), c = start(sk), {rig, b, on} = c, Z0 = o.z ?? 0, Z = z => z + Z0;
  const coat = o.coat || '#8a5230', mane = o.mane || '#2a1c14', sock = o.sock ?? '#f4efe6', hoofC = '#2b2420', muz = mix(coat, '#1c1512', .5), under = light(coat, .08), leather = '#6e4426', brass = '#d8b04a';
  c.col = coat;
  // pivots
  rig.at('body', 0, .3, Z(0)).at('neck', 0, .37, Z(.2)).at('head', 0, .565, Z(.37)).at('jaw', 0, .43, Z(.46)).at('earL', .03, .6, Z(.36)).at('earR', -.03, .6, Z(.36)).at('tail1', 0, .38, Z(-.27)).at('tail2', 0, .31, Z(-.34));
  for (const [s, L] of LR) rig.at('f' + L + 'u', s * .078, .3, Z(.2)).at('f' + L + 'l', s * .078, .155, Z(.2)).at('h' + L + 'u', s * .082, .3, Z(-.17)).at('h' + L + 'l', s * .082, .13, Z(-.2));
  if (o.cart) rig.at('wheelL', .23, .14, -.56).at('wheelR', -.23, .14, -.56);
  // body
  ell(b, 0, .325, Z(0), .118, .108, .27, coat, 14); ell(b, 0, .315, Z(.17), .115, .125, .14, coat, 12); ell(b, 0, .33, Z(-.16), .122, .118, .125, coat, 12); ell(b, 0, .27, Z(.02), .092, .05, .21, under, 10); ell(b, 0, .425, Z(.14), .05, .03, .09, coat, 8);
  for (const [s] of LR) { ell(b, s * .09, .33, Z(.17), .035, .09, .075, coat, 8); ell(b, s * .1, .32, Z(-.19), .035, .09, .08, coat, 8); }   // shoulder and haunch muscle
  // neck, crest and mane
  on('neck', () => {
    rod(b, [0, .35, Z(.15)], [0, .55, Z(.35)], .09, .052, coat, 10); ell(b, 0, .5, Z(.28), .04, .075, .1, coat, 8, {rx: -.5});
    for (let k = 0; k < 9; k++) { const t = k / 8; ell(b, 0, .6 - .17 * t + .012, Z(.35 - .2 * t), .015, .035, .026, mane, 6, {rx: -.4}); }
    if (o.cart) { b.torus(.098, .03, '#a84a2a', {y: .385, z: Z(.2), rx: -.8, seg: 8}); b.torus(.09, .012, light('#a84a2a', .15), {y: .385, z: Z(.2) + .015, rx: -.8, seg: 8}); for (const [s] of LR) { rod(b, [s * .1, .45, Z(.19)], [s * .108, .33, Z(.2)], .006, .006, brass, 5); b.sph(.014, brass, {x: s * .11, y: .335, z: Z(.2), seg: 6}); b.sph(.011, brass, {x: s * .1, y: .455, z: Z(.19), seg: 6}); } }
  });
  // head: skull, cheek, muzzle with nostrils, eye, forelock, blaze; ears and the jaw are their own bones
  on('head', () => {
    rod(b, [0, .565, Z(.37)], [0, .445, Z(.5)], .068, .05, coat, 9); for (const [s] of LR) ell(b, s * .038, .5, Z(.43), .03, .045, .05, coat, 7);
    ell(b, 0, .412, Z(.528), .05, .042, .056, muz, 9); for (const [s] of LR) { b.sph(.008, '#1c1512', {x: s * .02, y: .405, z: Z(.572), seg: 5}); b.sph(.017, '#16110e', {x: s * .056, y: .545, z: Z(.425), seg: 6}); b.sph(.005, '#ffffff', {x: s * .06, y: .553, z: Z(.436), seg: 4}); }
    ell(b, 0, .545, Z(.468), .011, .011, .062, o.blaze === false ? coat : '#f4efe6', 7, {rx: .75}); ell(b, 0, .6, Z(.4), .028, .028, .035, mane, 6); ell(b, 0, .62, Z(.38), .014, .045, .02, mane, 6, {rx: -.3});
    if (o.cart) { b.torus(.04, .007, leather, {y: .425, z: Z(.51), rx: Math.PI / 2 - .5, seg: 7}); for (const [s] of LR) { rod(b, [s * .047, .424, Z(.51)], [s * .052, .56, Z(.4)], .004, .004, leather, 4); ell(b, s * .062, .545, Z(.43), .005, .02, .022, '#1c1512', 6); b.torus(.011, .003, brass, {x: s * .047, y: .418, z: Z(.52), ry: Math.PI / 2, seg: 5}); } rod(b, [-.05, .565, Z(.39)], [.05, .565, Z(.39)], .004, .004, leather, 4);
      for (const [s] of LR) rod(b, [s * .047, .418, Z(.52)], [s * .06, .55, Z(.375)], .003, .003, '#e8e0c8', 4); }   // the reins' first run, bit to poll
  });
  on('jaw', () => ell(b, 0, .392, Z(.505), .03, .018, .05, muz, 7));
  for (const [s, L] of LR) on('ear' + L, () => b.cone(.02, .075, coat, {x: s * .032, y: .6, z: Z(.36), rz: -s * .18, rx: -.1, seg: 6}));
  // legs: shoulder, forearm, knee, cannon, fetlock feathers and hoof; hind: thigh, stifle, gaskin, hock, cannon
  const hoofAt = (x, z) => f => { b.cyl(.03, .036, .042, hoofC, {x, y: 0, z, seg: 9}); if (sock) ell(b, x, .06, z, .033, .045, .038, sock, 7); else ell(b, x, .06, z, .03, .04, .034, coat, 7); };
  for (const [s, L] of LR) {
    const xf = s * .078, zf = Z(.2), xh = s * .082, zh = Z(-.17);
    on('f' + L + 'u', () => { ell(b, xf, .27, zf, .045, .06, .06, coat, 8); }); leg({b, on, col: coat, low: coat}, 'f' + L, [[xf, .3, zf], [xf, .155, zf], [xf, .06, zf]], [.05, .034, .025], hoofAt(xf, zf));
    on('h' + L + 'u', () => { rod(b, [xh, .31, zh], [xh, .225, zh + .05], .07, .05, coat, 9); rod(b, [xh, .225, zh + .05], [xh, .13, Z(-.2)], .045, .032, coat, 8); ell(b, xh, .13, Z(-.2) - .004, .032, .032, .036, coat, 7); });
    on('h' + L + 'l', () => { rod(b, [xh, .13, Z(-.2)], [xh, .06, Z(-.185)], .026, .022, coat, 7); hoofAt(xh, Z(-.185))(); });
  }
  on('tail1', () => rod(b, [0, .385, Z(-.265)], [0, .31, Z(-.34)], .03, .022, coat, 7));
  on('tail2', () => { ell(b, 0, .22, Z(-.36), .04, .11, .04, mane, 8, {rx: -.12}); for (const s of [-1, 0, 1]) ell(b, s * .028, .13, Z(-.385), .022, .09, .026, mane, 6, {rx: -.15, rz: s * .08}); });
  if (o.cart) horseHarnessAndCart(c, Z, leather, brass);
  const g = finish(rig, b, 'horse', 'horse', o.scale ?? 1.1, {cart: !!o.cart, wheel: .14, legLen: .3}, true);
  return g;
}
function horseHarnessAndCart(c, Z, leather, brass) {
  const {b, on} = c, wood = '#a3744a', woodD = '#7a5230', cartCol = '#8a5a3c';
  // pad, terrets, belly band, crupper, traces, shafts: every strap has both ends fixed to something
  on('body', () => {
    b.box(.17, .03, .13, leather, {y: .425, z: Z(.02), r: .01}); for (const [s] of LR) b.torus(.017, .004, brass, {x: s * .045, y: .47, z: Z(.02), ry: Math.PI / 2, seg: 6});
    b.torus(.126, .007, leather, {y: .3, z: Z(.05), sx: .93, seg: 8}); rod(b, [0, .44, Z(.0)], [0, .405, Z(-.265)], .005, .005, leather, 4);   // belly band and crupper
    for (const [s] of LR) { rod(b, [s * .11, .335, Z(.2)], [s * .128, .32, Z(.03)], .005, .005, leather, 4); rod(b, [s * .128, .32, Z(.03)], [s * .15, .3, -.24], .011, .011, wood, 6); b.sph(.011, brass, {x: s * .128, y: .32, z: Z(.03), seg: 6}); }   // trace and shaft
    // reins: terret to the seat
    for (const [s] of LR) { rod(b, [s * .09, .44, Z(.2)], [s * .045, .47, Z(.02)], .0035, .0035, '#e8e0c8', 4); rod(b, [s * .045, .47, Z(.02)], [s * .04, .43, -.15], .0035, .0035, '#e8e0c8', 4); rod(b, [s * .04, .43, -.15], [s * .03, .42, -.3], .0035, .0035, '#e8e0c8', 4); }
    // the cart: bed, boards, seat, axle, lamp and goods
    b.box(.4, .045, .62, wood, {y: .225, z: -.53, r: .012}); for (const [s] of LR) { b.box(.025, .125, .62, cartCol, {x: s * .2, y: .27, z: -.53, r: .008}); rod(b, [s * .15, .27, -.24], [s * .17, .22, -.78], .011, .011, woodD, 6); }
    b.box(.4, .125, .025, cartCol, {y: .27, z: -.84, r: .008}); b.box(.4, .1, .025, cartCol, {y: .26, z: -.225, r: .008}); rod(b, [-.28, .14, -.56], [.28, .14, -.56], .014, .014, '#3a3d44', 6);
    b.box(.3, .035, .12, woodD, {y: .36, z: -.3, r: .01}); b.box(.3, .1, .025, woodD, {y: .4, z: -.37, r: .008}); b.box(.3, .09, .1, '#b8483f', {y: .395, z: -.31, r: .02}); b.box(.3, .02, .1, '#e0c070', {y: .46, z: -.35, r: .006});
    for (const [x, z] of [[-.08, -.6], [.08, -.6], [-.08, -.74], [.08, -.74]]) { b.cyl(.045, .05, .13, '#f4f0e8', {x, y: .25, z, seg: 9}); b.cyl(.047, .047, .02, '#4a8aa8', {x, y: .38, z, seg: 9}); b.torus(.047, .006, '#c0c0c0', {x, y: .3, z, rx: Math.PI / 2, seg: 8}); }
    b.box(.2, .1, .16, '#e0b84a', {y: .25, z: -.43, r: .02}); b.box(.2, .02, .16, '#c89a2a', {y: .31, z: -.43, r: .005}); for (let k = 0; k < 4; k++) b.sph(.022, k % 2 ? '#f8f0e0' : '#ead8b8', {x: -.07 + k * .045, y: .335, z: -.43, sy: 1.2, seg: 6});
    b.box(.026, .045, .026, '#3a3d44', {x: .17, y: .365, z: -.25, r: .004}); b.sph(.012, '#fff0b0', {x: .17, y: .365, z: -.25, seg: 6});
  });
  for (const [s, L] of LR) on('wheel' + L, () => {
    const x = s * .23, y = .14, z = -.56; b.torus(.138, .015, '#3a3d44', {x, y, z, ry: Math.PI / 2, seg: 14}); b.torus(.128, .012, woodD, {x, y, z, ry: Math.PI / 2, seg: 14});
    for (let k = 0; k < 4; k++) b.box(.018, .26, .018, wood, {x, y, z, rx: k * Math.PI / 4, centre: true, r: 0}); b.cyl(.034, .034, .06, '#3a3d44', {x, y, z, rz: Math.PI / 2, centre: true, seg: 9}); b.cyl(.014, .014, .08, '#9a9ea6', {x, y, z, rz: Math.PI / 2, centre: true, seg: 6});
  });
}

/* ---------------- farm animals ---------------- */
const BODYCOW = {holstein: ['#f6f3ec', '#34302d'], brown: ['#f3ece0', '#8a5a3a'], dark: ['#4a403a', '#f3ece0']};
export function buildCow(coat = 'holstein') {
  const [wh, pt] = BODYCOW[coat] || BODYCOW.holstein, sk = quadSkeleton(), c = start(sk), {rig, b, on} = c, pink = '#f0b4b4', hoofC = '#2b2420'; c.col = wh;
  rig.at('body', 0, .2, 0).at('neck', 0, .26, .17).at('head', 0, .26, .27).at('jaw', 0, .22, .33).at('earL', .06, .29, .29).at('earR', -.06, .29, .29).at('tail1', 0, .27, -.2).at('tail2', 0, .15, -.22);
  for (const [s, L] of LR) rig.at('f' + L + 'u', s * .07, .19, .12).at('f' + L + 'l', s * .07, .095, .12).at('h' + L + 'u', s * .07, .19, -.13).at('h' + L + 'l', s * .07, .1, -.15);
  ell(b, 0, .205, 0, .102, .105, .2, wh, 14); ell(b, 0, .22, .12, .1, .115, .1, wh, 11); ell(b, 0, .215, -.13, .1, .105, .09, wh, 11); ell(b, 0, .15, .0, .09, .07, .18, mix(wh, '#e8d4c8', .3), 9);
  const patch = (x, y, z, rx, ry, rz) => ell(b, x, y, z, rx, ry, rz, pt, 8);
  if (coat === 'dark') { patch(0, .31, -.02, .06, .01, .1); } else { patch(.098, .22, .04, .014, .06, .08); patch(-.098, .24, -.06, .014, .055, .07); patch(0, .312, .08, .05, .012, .07); patch(.09, .25, -.13, .02, .05, .045); patch(-.09, .2, .13, .02, .05, .05); }
  ell(b, 0, .105, -.12, .045, .03, .05, pink, 8); for (const [dx, dz] of [[-.02, -.1], [.02, -.1], [-.02, -.14], [.02, -.14]]) b.cyl(.007, .006, .03, pink, {x: dx, y: .06, z: dz, seg: 5});
  on('neck', () => { rod(b, [0, .25, .13], [0, .26, .26], .075, .055, wh, 9); ell(b, 0, .2, .2, .04, .06, .08, mix(wh, pt, .2), 8); });
  on('head', () => {
    ell(b, 0, .255, .31, .058, .062, .068, wh, 11); ell(b, 0, .215, .375, .047, .038, .042, pink, 9); for (const [s] of LR) { b.sph(.008, '#7a4a4a', {x: s * .02, y: .212, z: .412, seg: 5}); b.sph(.011, '#1c1512', {x: s * .05, y: .275, z: .335, seg: 6}); b.cone(.011, .05, '#f4eed8', {x: s * .04, y: .315, z: .285, rz: -s * .7, seg: 6}); }
    ell(b, 0, .295, .3, .03, .02, .03, coat === 'dark' ? wh : pt, 7); if (coat === 'holstein') ell(b, .02, .27, .31, .035, .035, .02, pt, 6);
  });
  on('jaw', () => ell(b, 0, .195, .36, .032, .018, .04, pink, 7));
  for (const [s, L] of LR) on('ear' + L, () => { ell(b, s * .085, .288, .29, .042, .013, .022, wh, 7, {rz: -s * .15}); ell(b, s * .085, .286, .295, .03, .008, .014, pink, 6, {rz: -s * .15}); });
  for (const [s, L] of LR) {
    const xf = s * .07, zf = .12, xh = s * .07, zh = -.13, hf = (x, z) => () => { b.cyl(.021, .024, .028, hoofC, {x, y: 0, z, seg: 7}); };
    on('f' + L + 'u', () => ell(b, xf, .16, zf, .035, .05, .045, wh, 7)); leg({b, on, col: wh}, 'f' + L, [[xf, .19, zf], [xf, .095, zf], [xf, .028, zf]], [.032, .024, .018], hf(xf, zf));
    on('h' + L + 'u', () => { rod(b, [xh, .2, zh], [xh, .12, zh + .03], .042, .03, wh, 8); rod(b, [xh, .12, zh + .03], [xh, .1, zh - .025], .03, .024, wh, 7); });
    on('h' + L + 'l', () => { rod(b, [xh, .1, zh - .025], [xh, .028, zh - .015], .022, .017, wh, 7); hf(xh, zh - .015)(); });
  }
  on('tail1', () => rod(b, [0, .27, -.2], [0, .15, -.225], .01, .008, wh, 5)); on('tail2', () => { rod(b, [0, .15, -.225], [0, .1, -.225], .008, .006, wh, 5); ell(b, 0, .075, -.225, .014, .04, .014, pt === '#34302d' ? '#34302d' : pt, 6); });
  return finish(rig, b, 'cow', 'cow', 1.5, {legLen: .19});
}
export function buildSheep(k = 0) {
  const wool = ['#f7f4ee', '#efe8d6', '#e6e3dc'][k % 3], face = ['#4a4440', '#c8a888', '#3a3634'][k % 3], sk = quadSkeleton(), c = start(sk), {rig, b, on} = c, legc = dark(face, .05); c.col = legc;
  rig.at('body', 0, .17, 0).at('neck', 0, .2, .11).at('head', 0, .215, .17).at('jaw', 0, .2, .21).at('earL', .03, .235, .17).at('earR', -.03, .235, .17).at('tail1', 0, .19, -.14).at('tail2', 0, .17, -.17);
  for (const [s, L] of LR) rig.at('f' + L + 'u', s * .045, .12, .08).at('f' + L + 'l', s * .045, .062, .08).at('h' + L + 'u', s * .045, .12, -.08).at('h' + L + 'l', s * .045, .065, -.09);
  ell(b, 0, .185, 0, .09, .09, .14, wool, 12); for (let n = 0; n < 16; n++) { const a = n / 16 * Math.PI * 2, y = .185 + Math.sin(a * 2 + k) * .02; b.sph(.05, n % 3 ? wool : light(wool, .1), {x: Math.cos(a) * .075, y: y + Math.sin(a) * .05, z: Math.sin(a * 1.5 + n) * .12, seg: 8}); }
  for (let n = 0; n < 5; n++) b.sph(.045, wool, {x: (n - 2) * .03, y: .25, z: .05 + (n % 2) * .05, seg: 7}); ell(b, 0, .2, .15, .07, .07, .06, wool, 8);
  on('neck', () => rod(b, [0, .19, .09], [0, .215, .15], .045, .035, wool, 7));
  on('head', () => { ell(b, 0, .215, .19, .035, .042, .052, face, 9); ell(b, 0, .2, .235, .025, .025, .03, face, 7); ell(b, 0, .245, .17, .04, .03, .035, wool, 7); b.sph(.007, '#1c1512', {x: .02, y: .225, z: .215, seg: 4}); b.sph(.007, '#1c1512', {x: -.02, y: .225, z: .215, seg: 4}); b.sph(.007, '#4a2a2a', {y: .195, z: .262, seg: 4}); });
  on('jaw', () => ell(b, 0, .19, .225, .02, .01, .03, face, 6));
  for (const [s, L] of LR) on('ear' + L, () => ell(b, s * .045, .232, .17, .035, .012, .018, face, 6, {rz: -s * .25}));
  for (const [s, L] of LR) {
    const xf = s * .045, zf = .08, xh = s * .045, zh = -.08, hf = (x, z) => () => { b.cyl(.011, .013, .015, '#2a2624', {x, y: 0, z, seg: 6}); };
    leg({b, on, col: legc}, 'f' + L, [[xf, .13, zf], [xf, .062, zf], [xf, .015, zf]], [.017, .014, .011], hf(xf, zf));
    on('h' + L + 'u', () => { rod(b, [xh, .13, zh], [xh, .075, zh - .005], .024, .017, wool, 7); b.sph(.014, legc, {x: xh, y: .07, z: zh - .005, seg: 6}); }); on('h' + L + 'l', () => { rod(b, [xh, .07, zh - .01], [xh, .015, zh], .012, .011, legc, 6); hf(xh, zh)(); });
  }
  on('tail1', () => ell(b, 0, .185, -.155, .02, .03, .03, wool, 6)); on('tail2', () => {});
  return finish(rig, b, 'sheep', 'sheep', 1.35, {legLen: .13});
}

/* ---------------- dogs and cats ---------------- */
const DOGS = {
  brown: {c: '#b07a45', l: '#d9b98a', d: '#7a5028', ear: 'floppy', tail: 'otter', head: 1, name: 'retriever'},
  spotted: {c: '#fbf7ee', l: '#ffffff', d: '#2f2b28', ear: 'floppy', tail: 'thin', head: 1.25, name: 'dalmatian', spots: true, scale: .82},
  grey: {c: '#8e98a3', l: '#d5dbe0', d: '#59616a', ear: 'fold', tail: 'up', head: 1, name: 'schnauzer', beard: true}
};
export function buildDog(coat = 'brown') {
  const S = DOGS[coat] || DOGS.brown, sk = quadSkeleton(), c = start(sk), {rig, b, on} = c, hs = S.head; c.col = S.c;
  rig.at('body', 0, .115, 0).at('neck', 0, .14, .1).at('head', 0, .185, .14).at('jaw', 0, .165, .18).at('earL', .034, .215, .15).at('earR', -.034, .215, .15).at('tail1', 0, .14, -.11).at('tail2', 0, .17, -.15);
  for (const [s, L] of LR) rig.at('f' + L + 'u', s * .032, .11, .072).at('f' + L + 'l', s * .032, .058, .072).at('h' + L + 'u', s * .036, .115, -.078).at('h' + L + 'l', s * .04, .072, -.088);
  ell(b, 0, .115, 0, .048, .052, .1, S.c, 11); ell(b, 0, .12, .075, .05, .058, .06, S.c, 10); ell(b, 0, .115, -.075, .05, .054, .056, S.c, 10); ell(b, 0, .09, .01, .04, .035, .09, S.l, 8);
  if (S.spots) for (const [x, y, z, r] of [[.045, .13, .02, .02], [-.045, .14, -.05, .022], [.03, .165, -.07, .018], [-.04, .12, .06, .016], [.047, .1, -.08, .02], [0, .168, .02, .016]]) ell(b, x, y, z, r * (Math.abs(x) > .03 ? .4 : 1), r, r, S.d, 6);
  on('neck', () => { rod(b, [0, .13, .08], [0, .185, .135], .038, .03, S.c, 8); b.torus(.033, .007, '#d94a3a', {y: .158, z: .105, rx: -1.0, seg: 8}); b.sph(.007, '#d8b04a', {y: .13, z: .13, seg: 5}); });
  on('head', () => {
    ell(b, 0, .19, .165, .04 * hs, .038 * hs, .042 * hs, S.c, 10); ell(b, 0, .17, .215, .023 * (S.beard ? 1.1 : 1), .02, .036, S.l, 8); b.sph(.011, '#17110f', {y: .18, z: .252, seg: 6});
    for (const [s] of LR) { b.sph(.0095 * hs, '#17110f', {x: s * .02 * hs, y: .207, z: .192, seg: 5}); b.sph(.003, '#fff', {x: s * .02 * hs + .002, y: .21, z: .198, seg: 4}); if (coat === 'grey') ell(b, s * .018, .222, .195, .014, .006, .012, S.l, 5, {rz: -s * .3}); }
    if (S.beard) { ell(b, 0, .145, .225, .02, .02, .025, S.l, 6); ell(b, 0, .155, .205, .028, .014, .02, S.l, 6); }
  });
  on('jaw', () => { ell(b, 0, .152, .2, .016, .009, .03, S.l, 6); b.sph(.007, '#e8707a', {y: .15, z: .215, sy: .5, seg: 5}); });
  for (const [s, L] of LR) on('ear' + L, () => { if (S.ear === 'floppy') ell(b, s * .043 * hs, .195, .148, .009, .035, .022, S.d, 6, {rz: -s * .15}); else b.cone(.017, .045, S.d, {x: s * .03, y: .222, z: .152, rx: .5, rz: -s * .2, seg: 4}); });
  for (const [s, L] of LR) {
    const xf = s * .032, zf = .072, xh = s * .036, zh = -.078, paw = (x, z) => () => ell(b, x, .011, z + .007, .014, .011, .021, S.l, 7);
    on('f' + L + 'u', () => ell(b, xf, .095, zf, .02, .035, .026, S.c, 7)); leg({b, on, col: S.c}, 'f' + L, [[xf, .11, zf], [xf, .058, zf], [xf, .014, zf]], [.018, .014, .011], paw(xf, zf));
    on('h' + L + 'u', () => { ell(b, xh, .105, zh, .027, .045, .04, S.c, 8); rod(b, [xh, .105, zh], [xh * 1.1, .072, zh - .012], .024, .017, S.c, 7); }); on('h' + L + 'l', () => { rod(b, [xh * 1.1, .072, zh - .012], [xh, .014, zh + .004], .015, .011, S.l, 6); paw(xh, zh + .004)(); });
  }
  on('tail1', () => rod(b, [0, .14, -.105], [0, .155, -.16], .017, .012, S.c, 6)); on('tail2', () => { rod(b, [0, .155, -.16], S.tail === 'up' ? [0, .2, -.165] : [0, .19, -.195], .012, S.tail === 'otter' ? .008 : .004, S.tail === 'otter' ? S.c : S.l, 6); if (S.tail === 'otter') b.sph(.009, S.l, {y: .192, z: -.197, seg: 5}); });
  return finish(rig, b, 'dog', 'dog', (S.scale || 1) * 1.5, {legLen: .115, breed: S.name});
}
const CATS = {ginger: {c: '#e08a3c', l: '#f6d9b0', st: '#b8601f', eye: '#7fc060'}, grey: {c: '#8d96a0', l: '#e9edf0', st: '#6c747d', eye: '#e8c850'}, tabby: {c: '#9a7650', l: '#d8c4a2', st: '#5d4630', eye: '#9ad070'}, black: {c: '#2c2e35', l: '#f4efe6', st: '#2c2e35', eye: '#d8e860'}};
export function buildCat(coat = 'ginger') {
  const S = CATS[coat] || CATS.ginger, sk = quadSkeleton(), c = start(sk), {rig, b, on} = c; c.col = S.c;
  rig.at('body', 0, .075, 0).at('neck', 0, .095, .065).at('head', 0, .118, .09).at('jaw', 0, .105, .125).at('earL', .022, .15, .105).at('earR', -.022, .15, .105).at('tail1', 0, .09, -.08).at('tail2', 0, .12, -.125);
  for (const [s, L] of LR) rig.at('f' + L + 'u', s * .021, .075, .05).at('f' + L + 'l', s * .021, .04, .05).at('h' + L + 'u', s * .027, .075, -.052).at('h' + L + 'l', s * .028, .045, -.06);
  ell(b, 0, .075, 0, .034, .038, .075, S.c, 10); ell(b, 0, .078, .055, .035, .04, .04, S.c, 9); ell(b, 0, .08, -.052, .038, .043, .045, S.c, 9); ell(b, 0, .058, .02, .028, .022, .06, S.l, 7);
  if (coat !== 'black') for (let k = 0; k < 5; k++) b.box(.07, .006, .01, S.st, {y: .112 - Math.abs(k - 2) * .004, z: -.04 + k * .02, r: 0});   // stripes across the back
  if (coat === 'tabby' || coat === 'ginger') for (const [s] of LR) for (let k = 0; k < 3; k++) b.box(.004, .02, .008, S.st, {x: s * .036, y: .08, z: -.02 + k * .03, r: 0});
  on('neck', () => rod(b, [0, .09, .055], [0, .112, .085], .027, .022, S.c, 7));
  on('head', () => {
    ell(b, 0, .12, .115, .033, .03, .03, S.c, 9); for (const [s] of LR) ell(b, s * .022, .108, .125, .018, .014, .016, S.l, 6); ell(b, 0, .106, .142, .014, .011, .012, S.l, 7); b.sph(.006, '#e88e98', {y: .112, z: .152, seg: 5});
    for (const [s] of LR) { ell(b, s * .0165, .127, .14, .0075, .009, .004, S.eye, 6); ell(b, s * .0165, .127, .144, .0022, .007, .002, '#111', 4); for (let k = 0; k < 3; k++) rod(b, [s * .018, .108 + k * .003, .148], [s * .06, .105 + (k - 1) * .012, .14], .0012, .0008, '#f8f8f8', 3); }
    if (coat === 'grey' || coat === 'black') ell(b, 0, .112, .125, .016, .016, .01, S.l, 6);
  });
  on('jaw', () => ell(b, 0, .098, .13, .011, .006, .018, S.l, 5));
  for (const [s, L] of LR) on('ear' + L, () => { b.cone(.014, .035, S.c, {x: s * .022, y: .15, z: .105, rz: -s * .18, seg: 4}); b.cone(.008, .024, '#e8a0a8', {x: s * .022, y: .15, z: .112, rz: -s * .18, seg: 4}); });
  for (const [s, L] of LR) {
    const xf = s * .021, zf = .05, xh = s * .027, zh = -.052, paw = (x, z, w) => () => ell(b, x, .007, z + .005, .011, .008, .016, w ? S.l : S.l, 6);
    leg({b, on, col: S.c, low: coat === 'black' ? S.c : S.l}, 'f' + L, [[xf, .078, zf], [xf, .04, zf], [xf, .01, zf]], [.012, .01, .009], paw(xf, zf, 1));
    on('h' + L + 'u', () => { ell(b, xh, .068, zh, .02, .034, .034, S.c, 7); rod(b, [xh, .07, zh], [xh * 1.05, .045, zh - .012], .016, .011, S.c, 6); }); on('h' + L + 'l', () => { rod(b, [xh * 1.05, .045, zh - .012], [xh, .01, zh + .004], .01, .009, coat === 'black' ? S.c : S.l, 5); paw(xh, zh + .004, 1)(); });
  }
  on('tail1', () => rod(b, [0, .09, -.078], [0, .13, -.12], .012, .01, S.c, 6)); on('tail2', () => { rod(b, [0, .13, -.12], [0, .2, -.13], .01, .009, S.c, 6); rod(b, [0, .2, -.13], [0, .245, -.1], .009, .008, coat === 'black' ? S.c : S.st, 6); });
  return finish(rig, b, 'cat', 'cat', 1.5, {legLen: .08, breed: coat});
}

/* ---------------- birds ---------------- */
const HEN = {brown: ['#b5742f', '#d89a55', '#7d4a1d'], white: ['#fffaf0', '#ffffff', '#e4d9c0'], speckled: ['#8a7a68', '#b4a590', '#5a4d40'], gold: ['#e0b040', '#f2d680', '#b8862a'], red: ['#a83a22', '#d86a38', '#2d6a4a']};
const bird = () => start({names: BIRD.names, parents: BIRD.parents});
// a bird's feet: a shank and three toes
function foot(b, x, shank, col, z = 0, toe = .03) { rod(b, [x, shank, z], [x, .008, z + .004], .0075, .0065, col, 5); for (const a of [-.45, 0, .45]) rod(b, [x, .006, z + .004], [x + Math.sin(a) * toe, .003, z + .004 + Math.cos(a) * toe], .0045, .003, col, 4); }
export function buildHen(kind = 'hen', coat = 'brown') {
  const [cc, lc, dc] = HEN[coat] || HEN.brown, big = kind === 'rooster', c = bird(), {rig, b, on} = c, leg = '#e8b040';
  rig.at('body', 0, .09, 0).at('neck', 0, .11, .04).at('head', 0, .175, .065).at('wingL', .045, .105, .0).at('wingR', -.045, .105, .0).at('tail', 0, .1, -.06).at('legL', .022, .07, 0).at('legR', -.022, .07, 0);
  ell(b, 0, .09, 0, .05, .055, .068, cc, 11, {rx: -.15}); ell(b, 0, .085, .035, .043, .05, .045, lc, 9); ell(b, 0, .06, .0, .04, .035, .055, mix(cc, '#ffffff', .25), 7);
  if (coat === 'speckled') for (let k = 0; k < 8; k++) b.sph(.008, '#ffffff', {x: (((k * 37) % 9) - 4) * .01, y: .1 + (k % 3) * .02, z: -.03 + (k % 4) * .02, seg: 4});
  on('neck', () => rod(b, [0, .105, .035], [0, .17, .065], .027, .02, big ? lc : cc, 7));
  on('head', () => { ell(b, 0, .185, .075, .024, .026, .03, cc, 8); b.cone(.01, .035, '#f2a33a', {y: .18, z: .108, rx: Math.PI / 2, seg: 5}); for (const [s] of LR) { b.sph(.005, '#111', {x: s * .02, y: .192, z: .085, seg: 4}); b.sph(.008, '#d92b2b', {x: s * .01, y: .158, z: .1, sy: 1.5, seg: 4}); }
    for (let k = 0; k < (big ? 4 : 3); k++) ell(b, 0, .208 + (k === 1 || k === 2 ? .006 : 0), .06 + k * .012, .005, big ? .015 : .01, .01, '#d92b2b', 5); });
  for (const [s, L] of LR) on('wing' + L, () => ell(b, s * .052, .09, -.005, .012, .04, .058, dc, 8, {rz: -s * .12, rx: -.1}));
  on('tail', () => { if (big) [[-.5, '#2d6a4a'], [-.25, '#d94a2b'], [0, '#2d6a4a'], [.25, '#d94a2b'], [.5, '#f2a33a']].forEach(([a, k]) => ell(b, a * .04, .15, -.1 - Math.abs(a) * .02, .008, .06, .018, k, 6, {rx: -.35, rz: a * .5})); else { ell(b, 0, .125, -.075, .02, .045, .024, dc, 7, {rx: -.7}); ell(b, 0, .13, -.085, .012, .045, .02, cc, 6, {rx: -.9}); } });
  for (const [s, L] of LR) on('leg' + L, () => { ell(b, s * .024, .075, 0, .017, .026, .03, lc, 6); foot(b, s * .022, .06, leg, 0, big ? .04 : .033); });
  return finish(rig, b, kind, kind, big ? 2.3 : 1.9, {legLen: .07});
}
export function buildChick() {
  const c = bird(), {rig, b, on} = c, y = '#ffe066';
  rig.at('body', 0, .05, 0).at('neck', 0, .06, .015).at('head', 0, .082, .025).at('wingL', .026, .055, 0).at('wingR', -.026, .055, 0).at('tail', 0, .055, -.03).at('legL', .012, .03, 0).at('legR', -.012, .03, 0);
  ell(b, 0, .05, 0, .03, .03, .034, y, 8); on('neck', () => b.sph(.012, y, {y: .068, z: .018, seg: 6}));
  on('head', () => { b.sph(.02, y, {y: .085, z: .026, seg: 8}); b.cone(.006, .016, '#f2a33a', {y: .084, z: .048, rx: Math.PI / 2, seg: 4}); for (const [s] of LR) b.sph(.004, '#111', {x: s * .012, y: .09, z: .038, seg: 4}); });
  for (const [s, L] of LR) on('wing' + L, () => ell(b, s * .03, .052, 0, .007, .018, .026, '#f2d450', 5)); on('tail', () => ell(b, 0, .06, -.034, .008, .012, .014, y, 5));
  for (const [s, L] of LR) on('leg' + L, () => foot(b, s * .012, .03, '#f2a33a', 0, .016));
  return finish(rig, b, 'chick', 'chick', 1.7, {legLen: .03});
}
export function buildDuck(drake = true) {
  const c = bird(), {rig, b, on} = c, body = drake ? '#b2b0aa' : '#9a7a50', chest = drake ? '#7a4a30' : '#a88a60', headC = drake ? '#2f6a4a' : '#8a6a44', bill = drake ? '#e8c43a' : '#d89a3a', orange = '#f08a2a';
  rig.at('body', 0, .065, 0).at('neck', 0, .09, .05).at('head', 0, .133, .07).at('wingL', .036, .08, 0).at('wingR', -.036, .08, 0).at('tail', 0, .085, -.07).at('legL', .02, .04, 0).at('legR', -.02, .04, 0);
  ell(b, 0, .065, 0, .042, .038, .075, body, 11); ell(b, 0, .07, .045, .04, .04, .04, chest, 9); ell(b, 0, .04, 0, .036, .02, .06, light(body, .25), 7); ell(b, 0, .075, -.06, .036, .03, .035, drake ? '#2a2a2a' : body, 8);
  on('neck', () => { rod(b, [0, .085, .045], [0, .13, .068], .02, .016, headC, 7); if (drake) b.torus(.017, .004, '#ffffff', {y: .105, z: .055, rx: -1.2, seg: 7}); });
  on('head', () => { ell(b, 0, .14, .078, .021, .021, .026, headC, 8); ell(b, 0, .134, .112, .014, .007, .024, bill, 7); for (const [s] of LR) b.sph(.004, '#111', {x: s * .016, y: .146, z: .086, seg: 4}); });
  for (const [s, L] of LR) on('wing' + L, () => { ell(b, s * .043, .08, -.005, .01, .03, .06, drake ? '#8f8d88' : '#8a6a44', 7, {rz: -s * .1}); ell(b, s * .046, .075, -.03, .004, .012, .022, '#3a6aa8', 5); });
  on('tail', () => b.cone(.016, .04, drake ? '#2a2a2a' : body, {y: .09, z: -.095, rx: -1.0, seg: 5}));
  for (const [s, L] of LR) on('leg' + L, () => { rod(b, [s * .02, .045, .0], [s * .02, .008, .004], .006, .005, orange, 4); ell(b, s * .02, .004, .022, .017, .003, .027, orange, 5); });
  return finish(rig, b, 'duck', 'duck', 1.2, {legLen: .045, swims: true});
}
