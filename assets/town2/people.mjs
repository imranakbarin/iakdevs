// New Toy Town: the residents. Every resident has an IDENTITY (age, build, skin, face, hair: FOLK) and a ROLE costume (what they wear for their job), and each costume has
// three WEARS (mild, rain, winter). The identity never changes with the outfit: the same head, hair and body shape are built every time, only the clothes differ.
// One resident is one merged, bone-skinned mesh (rig.mjs; poses in pose.mjs). Facing +z, +x is the figure's left. Sizes: an adult is about .56 tall.
import * as THREE from 'three';
import {Bag} from './build.mjs';
import {Rig, boneTag, rigMesh} from './rig.mjs';
import {BIPED} from './pose.mjs';
import {PALETTE as P} from './def.mjs';
import {buildFace, HATS, mix, dark, light} from './faces.mjs';
import {SKIN, FOLK, identityOf, dimsOf, wearFor} from './folk.mjs';
import {ell, rod, DETAIL} from './shapes.mjs';

const pc = c => P[c] || c, TAU = Math.PI * 2;

/* ---------------- building blocks ---------------- */
const SPEC = () => ({top: '#c9d3dd', sleeves: 'long', bottom: '#4b5a70', legs: 'long', shoe: {kind: 'shoe', color: '#4a3a30'}, coat: null, hat: null, hairMode: 'full', acc: [], scarf: null, mitts: null, apronish: null, jacketBelt: null, hands: 'skin'});

// the base: the torso, arms, legs, hands and shoes in the spec's colours
function dressBody(c, S) {
  const {b, D, I} = c, skin = SKIN[I.skin] || I.skin, ink = S.coat ? S.coat.color : S.top, puff = S.puff || 1, bw = D.bw, on = c.on;
  const sleeveCol = S.coat ? S.coat.color : S.top, longSleeve = S.sleeves === 'long' || S.coat, ucol = S.sleeves === 'none' && !S.coat ? skin : sleeveCol;
  // pelvis, waist and chest
  on('pelvis', () => { ell(b, 0, D.legLen + .004, 0, D.hw * 1.3, .036, D.depth * .95, S.bottom, 10); });
  on('chest', () => {
    const cd = D.depth * puff, womanWaist = I.sex === 'f' ? .92 : 1;
    ell(b, 0, D.legLen + D.tor * .28, 0, D.hw * 1.2 * puff * womanWaist, D.tor * .27, cd * .92, ink, 11);
    if (D.belly) ell(b, 0, D.legLen + D.tor * .3, cd * .4, D.hw * 1.12 * (1 + D.belly * .12), D.tor * .24, cd * .86, ink, 10);
    ell(b, 0, D.legLen + D.tor * .64, -D.stoop * .01, D.sw * 1.02 * puff, D.tor * .4, cd * 1.04, ink, 12);
    if (I.sex === 'f' && I.age !== 'child') for (const s of [-1, 1]) ell(b, s * D.sw * .38, D.legLen + D.tor * .66, cd * .72, D.sw * .34, D.tor * .17, cd * .5, ink, 8);
    b.sph(D.sw * .36 * puff, skin, {y: D.shY + .002, z: .0, sx: 1, sy: .5, seg: 9});   // neck base
    ell(b, 0, D.shY - .006, 0, D.sw * 1.08, .022 * puff, cd * .95, ink, 10);   // shoulder yoke
  });
  // arms: sleeves over the upper arm, forearm bare when sleeves are short or rolled
  for (const s of [1, -1]) {
    const X = s * (D.sw + .008), sh = D.shY - .012, el = D.shY - D.ua, wr = D.wristY, nm = s > 0 ? 'L' : 'R', rs = .021 * puff * Math.min(1.15, bw);
    on('arm' + nm + 'u', () => { b.sph(rs * 1.08, ucol, {x: X, y: sh, seg: 9}); rod(b, [X, sh, 0], [X, el, 0], rs * 1.05, rs * .92, ucol, 8); b.sph(rs * .95, S.sleeves === 'none' && !S.coat ? skin : sleeveCol, {x: X, y: el, seg: 8}); });
    on('arm' + nm + 'l', () => {
      const fc = longSleeve && S.sleeves !== 'rolled' ? sleeveCol : skin; rod(b, [X, el, 0], [X, wr + .008, 0], rs * .92, rs * .78, fc, 8);
      if (S.sleeves === 'rolled' && !S.coat) b.torus(rs * .9, rs * .18, sleeveCol, {x: X, y: el - .012, rx: Math.PI / 2, seg: 6});
      if (longSleeve && S.cuff) b.cyl(rs * .88, rs * .88, .012, S.cuff, {x: X, y: wr + .01, seg: 8});
      if (S.mitts) { b.sph(.027 * puff, S.mitts, {x: X, y: wr - .012, z: .004, sy: 1.1, seg: 9}); b.sph(.014, S.mitts, {x: X - s * .02, y: wr - .006, z: .014, seg: 6}); }
      else { b.sph(.0215, skin, {x: X, y: wr - .012, z: .002, sy: 1.15, seg: 9}); b.sph(.0105, skin, {x: X - s * .017, y: wr - .007, z: .012, seg: 6}); }
    });
  }
  if (S.legs === 'skirt') on('coat', () => { const L = D.legLen * .46; b.cyl(D.hw * 1.25, D.hw * 2.3, L, S.bottom, {y: D.legLen + D.tor * .1 - L, seg: 12}); });
  // legs
  for (const s of [1, -1]) {
    const X = s * D.hw, nm = s > 0 ? 'L' : 'R', K = D.kneeY, An = D.ankleY, tr = .031 * Math.min(1.2, bw), sc = S.shoe;
    const longLegs = S.legs === 'long' || S.legs === 'dungarees', bare = S.legs === 'shorts' || S.legs === 'skirt';
    on('leg' + nm + 'u', () => { rod(b, [X, D.legLen - .006, 0], [X * .97, K, 0], tr, tr * .82, longLegs ? S.bottom : (S.legs === 'skirt' ? mix(skin, S.sock || '#ffffff', S.sock ? .6 : 0) : skin), 8); if (S.legs === 'shorts') rod(b, [X, D.legLen - .006, 0], [X * .985, K + D.legLen * .1, 0], tr * 1.06, tr * .95, S.bottom, 8); b.sph(tr * .84, longLegs ? S.bottom : skin, {x: X * .97, y: K, seg: 8}); });
    on('leg' + nm + 'l', () => {
      rod(b, [X * .97, K, 0], [X * .93, An + .006, 0], tr * .8, tr * .62, longLegs ? S.bottom : (S.sock ? S.sock : skin), 8);
      if (sc.kind === 'boot' || sc.kind === 'wellie') { const top = sc.kind === 'wellie' ? K + .01 : An + D.legLen * .26; rod(b, [X * .95, top, 0], [X * .93, An - .002, 0], tr * .78, tr * .68, sc.color, 8); b.torus(tr * .8, tr * .1, light(sc.color, .15), {x: X * .95, y: top, rx: Math.PI / 2, seg: 6}); }
    });
    on('foot' + nm, () => {
      const len = sc.kind === 'wellie' ? 1.15 : 1;
      ell(b, X * .93, An * .55, .016 * len, .022 * Math.min(1.2, bw), An * .78, .044 * len, sc.color, 9);
      if (sc.kind === 'shoe' && sc.lace) b.box(.016, .004, .02, sc.lace, {x: X * .93, y: An * .85, z: .035, r: 0});
    });
  }
}

// a coat / jacket: a shell over the torso with skirts that swing, an optional open front, collar, buttons, belt
function jacket(c, o) {
  const {b, D} = c, on = c.on, p = o.puff || 1, cd = D.depth * p * 1.06, len = {hip: .14, thigh: .32, knee: .5}[o.len || 'hip'], col = o.color;
  on('chest', () => {
    ell(b, 0, D.legLen + D.tor * .3, 0, D.hw * 1.28 * p, D.tor * .3, cd * .98, col, 11); ell(b, 0, D.legLen + D.tor * .64, 0, D.sw * 1.08 * p, D.tor * .4, cd * 1.08, col, 12);
    if (o.collar) for (const s of [-1, 1]) b.box(D.sw * .34, .012, D.depth * .45, o.collar, {x: s * D.sw * .26, y: D.shY - .014, z: D.depth * 1.0, rz: -s * .35, r: 0});
    if (o.open) b.box(D.sw * .3, D.tor * .4, .006, o.open, {y: D.legLen + D.tor * .5, z: cd * 1.075, r: 0});
    if (o.buttons) for (let k = 0; k < (o.nButtons || 4); k++) b.sph(.0085, o.buttons, {x: o.offset ? D.sw * .2 : 0, y: D.legLen + D.tor * (.78 - k * (.5 / (o.nButtons || 4))), z: cd * 1.07, seg: 5});
  });
  on('pelvis', () => { if (o.belt) { b.cyl(D.hw * 1.36 * p, D.hw * 1.38 * p, .022, o.belt, {y: D.legLen + D.tor * .12, z: 0, seg: 12, sy: 1}); if (o.buckle) b.box(.02, .018, .008, o.buckle, {y: D.legLen + D.tor * .12, z: D.depth * 1.05, r: 0}); } });
  if (len > .02) on('coat', () => { const L = D.legLen * len, top = D.legLen + D.tor * .12; b.cyl(D.hw * 1.32 * p, D.hw * 1.5 * p * (1 + len * .5), L, col, {y: top - L, z: -.002, seg: 12}); if (o.trim) b.torus(D.hw * 1.5 * p * (1 + len * .5), .007, o.trim, {y: top - L, rx: Math.PI / 2, seg: 5}); });
}
const apron = (c, o) => {
  const {b, D} = c, on = c.on, cd = D.depth * (o.puff || 1) * 1.1, w = D.sw * 1.45, len = o.len || .42;
  on('chest', () => { b.box(w * .75, D.tor * .55, .012, o.color, {y: D.legLen + D.tor * .5, z: cd * 1.02, r: 0}); for (const s of [-1, 1]) rod(b, [s * w * .3, D.legLen + D.tor * .78, cd * .9], [s * D.sw * .34, D.shY + .002, 0], .005, .005, o.strap || o.color, 4); if (o.pocket) b.box(w * .35, D.tor * .17, .008, dark(o.color, .1), {y: D.legLen + D.tor * .4, z: cd * 1.05, r: 0}); });
  on('coat', () => { const L = D.legLen * len; b.box(D.hw * 3.0, L, .012, o.color, {y: D.legLen + D.tor * .1 - L, z: cd * .95, r: 0}); if (o.frill) b.box(D.hw * 3.0, .012, .016, light(o.color, .3), {y: D.legLen + D.tor * .1 - L, z: cd * .96, r: 0}); if (o.pocket) b.box(D.hw * 1.2, L * .3, .008, dark(o.color, .1), {y: D.legLen + D.tor * .1 - L * .5, z: cd * .98, r: 0}); });
  on('pelvis', () => { b.cyl(D.hw * 1.33, D.hw * 1.33, .016, o.color, {y: D.legLen + D.tor * .1, seg: 12}); b.sph(.014, o.color, {x: 0, y: D.legLen + D.tor * .1, z: -D.depth, sx: 1.6, seg: 6}); });
};
const dungarees = (c, o) => {
  const {b, D} = c, on = c.on, cd = D.depth * 1.1;
  on('chest', () => { b.box(D.sw * 1.1, D.tor * .5, .012, o.color, {y: D.legLen + D.tor * .43, z: cd * 1.0, r: 0}); for (const s of [-1, 1]) { rod(b, [s * D.sw * .38, D.legLen + D.tor * .68, cd * .96], [s * D.sw * .46, D.shY - .006, 0], .007, .007, o.color, 4); b.sph(.008, o.button || 'gold', {x: s * D.sw * .38, y: D.legLen + D.tor * .67, z: cd * 1.04, seg: 5}); } b.box(D.sw * .5, D.tor * .17, .008, dark(o.color, .12), {y: D.legLen + D.tor * .52, z: cd * 1.05, r: 0}); });
};
const scarf = (c, col, col2 = null) => { const {b, D} = c, on = c.on; on('chest', () => { b.torus(D.sw * .43, .018, col, {y: D.shY + .008, rx: Math.PI / 2, seg: 8}); b.box(.032, D.tor * .34, .012, col, {x: D.sw * .14, y: D.shY - D.tor * .3, z: D.depth * 1.08, rz: .06, r: 0}); if (col2) b.box(.033, .012, .014, col2, {x: D.sw * .14, y: D.shY - D.tor * .4, z: D.depth * 1.09, r: 0}); }); };
const backpack = (c, col, trim = '#f2f2f2') => { const {b, D} = c, on = c.on; on('chest', () => { b.box(D.sw * 1.15, D.tor * .56, .05, col, {y: D.legLen + D.tor * .55, z: -D.depth * 1.5, r: .015}); b.box(D.sw * .85, D.tor * .22, .03, dark(col, .12), {y: D.legLen + D.tor * .45, z: -D.depth * 1.95, r: .01}); b.box(D.sw * 1.0, .012, .054, trim, {y: D.legLen + D.tor * .73, z: -D.depth * 1.5, r: 0}); for (const s of [-1, 1]) rod(b, [s * D.sw * .45, D.shY - .004, -D.depth * .5], [s * D.sw * .45, D.legLen + D.tor * .35, -D.depth * 1.3], .006, .006, dark(col, .2), 4); }); };
const satchel = (c, col, papers = false) => { const {b, D} = c, on = c.on; on('chest', () => { rod(b, [D.sw * .7, D.shY - .01, 0], [-D.sw * .6, D.legLen + D.tor * .1, D.depth * .2], .006, .006, dark(col, .25), 4); }); on('pelvis', () => { b.box(.09, .075, .04, col, {x: -D.hw * 1.6, y: D.legLen - .035, z: .0, r: .008}); b.box(.092, .02, .042, dark(col, .15), {x: -D.hw * 1.6, y: D.legLen + .005, z: .0, r: .004}); if (papers) { b.cyl(.012, .012, .09, '#f4f0e4', {x: -D.hw * 1.6 + .01, y: D.legLen + .02, z: .0, rz: 1.1, seg: 6}); b.cyl(.012, .012, .09, '#e8e2d2', {x: -D.hw * 1.6 - .01, y: D.legLen + .02, z: .0, rz: 1.0, seg: 6}); } }); };
const pole = (c) => { const {b, D} = c; c.on('armRl', () => { b.cyl(.009, .009, .9, '#6b4a2f', {x: D.xR, y: D.wristY - .02, z: .0, seg: 6}); b.box(.05, .012, .05, '#3a3d44', {x: D.xR, y: D.wristY + .86, r: 0}); b.box(.035, .045, .035, '#fff0b0', {x: D.xR, y: D.wristY + .9, r: .004}); b.cone(.034, .03, '#3a3d44', {x: D.xR, y: D.wristY + .92, seg: 4}); }); };
const handbag = (c, col) => { const {b, D} = c; c.on('armRl', () => { b.box(.06, .048, .022, col, {x: D.xR - .01, y: D.wristY - .06, z: .004, r: .006}); b.torus(.022, .004, dark(col, .3), {x: D.xR - .01, y: D.wristY - .028, ry: Math.PI / 2, seg: 5}); }); };
const basket = (c, goods, tone = '#b88a50') => { const {b, D} = c; c.on('armRl', () => { b.cyl(.04, .032, .035, tone, {x: D.xR - .005, y: D.wristY - .075, z: .012, seg: 10}); b.torus(.038, .004, tone, {x: D.xR - .005, y: D.wristY - .04, z: .012, rx: Math.PI / 2, seg: 6}); b.torus(.036, .004, dark(tone, .2), {x: D.xR - .005, y: D.wristY - .014, z: .012, ry: Math.PI / 2, arc: Math.PI, rz: .0, seg: 6}); for (let k = 0; k < goods.n; k++) b.sph(.016, goods.colour[k % goods.colour.length], {x: D.xR - .005 + Math.cos(k * 2.1) * .02, y: D.wristY - .045 + (k % 2) * .008, z: .012 + Math.sin(k * 2.1) * .02, seg: 6}); }); };
const badge = (c, col, y = .66, x = .028) => { const {b, D} = c; c.on('chest', () => { b.cyl(.012, .012, .006, col, {x, y: D.legLen + D.tor * y, z: D.depth * 1.12, rx: Math.PI / 2, seg: 8}); }); };
const stripes = (c, col, ys) => { const {b, D} = c; c.on('chest', () => { for (const y of ys) b.cyl(D.sw * 1.08, D.sw * 1.08, .009, col, {y: D.legLen + D.tor * y, scale: 1, sz: D.depth / D.sw * 1.1, seg: 14}); }); };
const glove = (c, col) => { const {b, D} = c; for (const [nm, X] of [['armLl', D.xL], ['armRl', D.xR]]) c.on(nm, () => { b.sph(.026, col, {x: X, y: D.wristY - .012, z: .003, sy: 1.1, seg: 8}); b.cyl(.021, .021, .02, col, {x: X, y: D.wristY + .012, seg: 8}); }); };
const flour = (c, n = 8) => { const {b, D} = c; c.on('chest', () => { for (let k = 0; k < n; k++) b.sph(.007 + (k % 3) * .002, '#ffffff', {x: ((k * 37) % 11 - 5) * D.sw * .13, y: D.legLen + D.tor * (.3 + (k % 5) * .1), z: D.depth * 1.1, sz: .4, seg: 4}); }); };
const stetho = (c) => { const {b, D} = c; c.on('chest', () => { b.torus(D.sw * .45, .005, '#2f3033', {y: D.shY - D.tor * .28, z: D.depth * .8, rx: -.1, seg: 6, arc: Math.PI * 1.3, rz: Math.PI * 1.1}); b.sph(.014, '#9aa0a6', {x: .03, y: D.legLen + D.tor * .5, z: D.depth * 1.12, seg: 6}); }); };
const belt = (c, col, buckle) => { const {b, D} = c; c.on('pelvis', () => { b.cyl(D.hw * 1.34, D.hw * 1.36, .02, col, {y: D.legLen + D.tor * .1, seg: 12}); if (buckle) b.box(.02, .017, .008, buckle, {y: D.legLen + D.tor * .1, z: D.depth * 1.05, r: 0}); }); };
const holster = (c) => { const {b, D} = c; c.on('pelvis', () => { b.box(.02, .075, .016, '#1c1c1f', {x: D.hw * 1.5, y: D.legLen - .03, z: .0, r: .004}); b.cyl(.008, .008, .09, '#d8d2c0', {x: -D.hw * 1.5, y: D.legLen - .035, z: .0, seg: 5}); }); };
const shoulderPads = (c, col, trim) => { const {b, D} = c; c.on('chest', () => { for (const s of [-1, 1]) { b.box(.034, .008, .03, trim, {x: s * (D.sw + .004), y: D.shY + .012, z: 0, rz: -s * .15, r: 0}); b.sph(.007, col, {x: s * (D.sw + .004), y: D.shY + .018, seg: 4}); } }); };

/* ---------------- role costumes ---------------- */
// Each returns a spec for a MILD day; `wear()` below turns it into the rain and winter versions. c.def.coat is kept as the main garment colour (the mystery clues name it).
const ROLE = {
  baker(c, S) { S.top = '#f4f0e6'; S.sleeves = 'rolled'; S.bottom = '#7e8da6'; S.shoe = {kind: 'shoe', color: '#d9d2c0'}; S.hat = {kind: 'chef'}; S.hairMode = 'hat'; S.acc.push(() => apron(c, {color: '#fffdf8', frill: true, pocket: true, len: .5}), () => flour(c)); S.warm = '#fffdf8'; },
  cafe(c, S) { S.top = mix(pc(c.def.coat), '#ffffff', .15); S.sleeves = 'rolled'; S.bottom = '#3d4252'; S.shoe = {kind: 'shoe', color: '#2f2f35'}; S.acc.push(() => apron(c, {color: '#6e4c3a', strap: '#6e4c3a', frill: false, len: .36, pocket: true}), () => { const {b, D} = c; c.on('armLl', () => { b.box(.03, .04, .005, '#fffdf8', {x: D.xL, y: D.wristY + .01, z: .02, r: 0}); }); }); },
  police(c, S) { S.top = '#26344f'; S.coat = null; S.sleeves = 'long'; S.bottom = '#26344f'; S.shoe = {kind: 'boot', color: '#17171a'}; S.hat = {kind: 'police'}; S.hairMode = 'hat'; S.cuff = '#d8d2c0'; S.acc.push(() => jacket(c, {color: '#26344f', len: 'hip', collar: '#1c2a42', buttons: '#d8b04a', nButtons: 5, belt: '#f3f3ee', buckle: '#d8b04a', trim: null}), () => badge(c, '#d8b04a', .78, -.032), () => holster(c), () => shoulderPads(c, '#d8b04a', '#1c2a42'), () => { const {b, D} = c; c.on('chest', () => { b.torus(D.sw * .45, .0035, '#d8b04a', {y: D.shY - D.tor * .2, z: D.depth * .85, rx: -.2, seg: 5, arc: Math.PI * 1.1, rz: Math.PI * 1.45}); }); }); },
  post(c, S) { S.top = pc('red'); S.coat = {color: pc('red')}; S.bottom = '#2c3548'; S.shoe = {kind: 'shoe', color: '#2a2a2e'}; S.hat = {kind: 'cap', col: pc('red')}; S.hairMode = 'hat'; S.cuff = '#f2f2f2'; S.acc.push(() => jacket(c, {color: pc('red'), len: 'hip', collar: '#b84a3e', buttons: '#f4e9c0', belt: '#2c2f3a', buckle: '#d8b04a'}), () => satchel(c, '#7a5a3a', true), () => badge(c, '#f4e9c0', .8)); },
  toyshop(c, S) { S.top = pc('purple'); S.coat = {color: pc('purple')}; S.bottom = '#f0d9a8'; S.legs = 'skirt'; S.sock = '#f4f0e6'; S.shoe = {kind: 'shoe', color: '#d9506a'}; S.acc.push(() => jacket(c, {color: pc('purple'), len: 'hip', open: '#fff4dc', buttons: '#f4e9c0', nButtons: 3}), () => apron(c, {color: '#f9d98a', len: .4, pocket: true, frill: true}), () => { const {b, D} = c; c.on('armLl', () => { b.sph(.026, '#b8794a', {x: D.xL + .004, y: D.wristY - .045, z: .028, seg: 8}); b.sph(.018, '#b8794a', {x: D.xL + .004, y: D.wristY - .022, z: .028, seg: 8}); for (const s of [-1, 1]) b.sph(.009, '#b8794a', {x: D.xL + .004 + s * .011, y: D.wristY - .012, z: .028, seg: 5}); b.box(.03, .006, .006, '#d9506a', {x: D.xL + .004, y: D.wristY - .033, z: .042, r: 0}); }); }); S.warm = pc('purple'); },
  fire(c, S) { S.top = '#26262b'; S.coat = {color: pc('orange')}; S.bottom = '#26262b'; S.shoe = {kind: 'boot', color: '#17171a'}; S.hat = {kind: 'fire'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('orange'), len: 'thigh', collar: '#26262b', buttons: '#26262b', puff: 1.06}), () => stripes(c, '#f6ee9a', [.24, .52]), () => glove(c, '#26262b'), () => { const {b, D} = c; c.on('coat', () => { b.torus(D.hw * 1.75, .008, '#f6ee9a', {y: D.legLen * .72, rx: Math.PI / 2, seg: 5}); }); }); },
  granny(c, S) { S.top = pc('green'); S.coat = {color: pc('green')}; S.bottom = '#5a4a62'; S.legs = 'skirt'; S.sock = '#e6dfd0'; S.shoe = {kind: 'shoe', color: '#4a3a34'}; S.hat = {kind: 'bonnet'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('green'), len: 'thigh', open: '#f3ecd9', buttons: '#f3ecd9', nButtons: 3}), () => handbag(c, '#8a5a3a'), () => { const {b, D} = c; c.on('chest', () => { b.torus(D.sw * .85, .02, '#d8c8a0', {y: D.shY - .02, z: -.005, rx: Math.PI / 2 - .2, seg: 8}); }); }); },
  miller(c, S) { S.top = pc('teal'); S.sleeves = 'rolled'; S.bottom = '#8a7a66'; S.shoe = {kind: 'boot', color: '#4a3a30'}; S.hat = {kind: 'flat', col: '#d9d2c0'}; S.hairMode = 'hat'; S.acc.push(() => apron(c, {color: '#e8e0cc', len: .5, pocket: true}), () => flour(c, 12)); },
  farmer(c, S) { S.top = mix(pc('brown'), '#b8483f', .35); S.sleeves = 'rolled'; S.bottom = '#4a6a96'; S.legs = 'dungarees'; S.shoe = {kind: 'boot', color: '#4a3326'}; S.hat = {kind: 'straw'}; S.hairMode = 'hat'; S.acc.push(() => dungarees(c, {color: '#4a6a96'}), () => { const {b, D} = c; c.on('chest', () => { b.cyl(.005, .005, .09, '#e5c46e', {x: .02, y: D.legLen + D.tor * .45, z: D.depth * 1.12, rx: .3, seg: 4}); }); }); S.warm = '#4a6a96'; },
  teacher(c, S) { S.top = pc('sky'); S.coat = {color: pc('sky')}; S.bottom = '#4a4660'; S.legs = 'skirt'; S.sock = '#3a3848'; S.shoe = {kind: 'shoe', color: '#3a2a2a'}; S.acc.push(() => jacket(c, {color: pc('sky'), len: 'hip', open: '#fff9ef', buttons: '#f4e9c0', nButtons: 3}), () => { const {b, D} = c; c.on('armLl', () => { b.box(.05, .012, .068, '#b8483f', {x: D.xL + .004, y: D.wristY - .022, z: .036, rx: .1, r: .002}); b.box(.048, .012, .066, '#fff9ef', {x: D.xL + .004, y: D.wristY - .01, z: .036, rx: .1, r: .002}); }); }); },
  mechanic(c, S) { S.top = pc('orange'); S.coat = {color: pc('orange')}; S.bottom = pc('orange'); S.shoe = {kind: 'boot', color: '#2f2f35'}; S.hat = {kind: 'cap', col: '#3a4a64'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('orange'), len: 'hip', buttons: '#c0c0c0', nButtons: 5, belt: '#4a3a30', buckle: '#c0c0c0'}), () => { const {b, D} = c; c.on('chest', () => { b.box(.034, .04, .01, '#c84a3a', {x: D.sw * .45, y: D.legLen + D.tor * .55, z: D.depth * 1.13, rz: .2, r: 0}); b.cyl(.006, .006, .09, '#9aa0a6', {x: -D.sw * .3, y: D.legLen + D.tor * .55, z: D.depth * 1.14, rz: .35, seg: 5}); }); }, () => { const {b, D} = c; c.on('chest', () => { b.box(.04, .02, .008, '#2a2a2e', {x: -D.sw * .5, y: D.legLen + D.tor * .2, z: D.depth * 1.1, r: 0}); }); }); },
  captain(c, S) { S.top = '#f4f0e6'; S.coat = {color: pc('blue')}; S.bottom = '#2c3548'; S.shoe = {kind: 'boot', color: '#2a2a2e'}; S.hat = {kind: 'peaked', col: '#f4f0e6', band: '#2c3548'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('blue'), len: 'thigh', buttons: '#d8b04a', nButtons: 6, collar: dark(pc('blue'), .2), open: '#f4f0e6', puff: 1.04}), () => stripes(c, '#d8b04a', []), () => { const {b, D} = c; c.on('armRl', () => { b.cyl(.008, .008, .05, '#6b4a2f', {x: D.xR + .002, y: D.wristY + .0, z: .05, rx: Math.PI / 2, seg: 5}); b.sph(.013, '#6b4a2f', {x: D.xR + .002, y: D.wristY + .02, z: .078, seg: 6}); }); }); },
  lamplighter(c, S) { S.top = pc('teal'); S.coat = {color: pc('teal')}; S.bottom = '#3a3d48'; S.shoe = {kind: 'boot', color: '#2f2a28'}; S.hat = {kind: 'flat', col: '#3a3d48'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('teal'), len: 'knee', buttons: '#caa24a', nButtons: 5, collar: dark(pc('teal'), .2)}), () => pole(c)); },
  schoolgirl(c, S) { S.top = '#fff9ef'; S.coat = null; S.bottom = pc('yellow'); S.legs = 'skirt'; S.sock = '#f4f0e6'; S.shoe = {kind: 'shoe', color: '#4a2a2a'}; S.hat = {kind: 'beanie', col: '#d65f50'}; S.hairMode = 'hat'; S.acc.push(() => { const {b, D} = c; c.on('chest', () => { b.box(D.sw * 1.2, D.tor * .46, .012, pc('yellow'), {y: D.legLen + D.tor * .48, z: D.depth * 1.05, r: 0}); for (const s of [-1, 1]) rod(b, [s * D.sw * .4, D.legLen + D.tor * .7, D.depth * .98], [s * D.sw * .46, D.shY - .004, 0], .007, .007, pc('yellow'), 4); b.box(.02, .035, .008, '#d65f50', {y: D.shY - D.tor * .18, z: D.depth * 1.08, r: 0}); }); }, () => backpack(c, '#d65f50')); S.warm = '#d65f50'; },
  schoolboy(c, S) { S.top = '#fff9ef'; S.coat = {color: pc('sky')}; S.bottom = '#6a6e78'; S.legs = 'shorts'; S.sock = '#f4f0e6'; S.shoe = {kind: 'shoe', color: '#2a2a2e'}; S.hat = {kind: 'beanie', col: '#d65f50'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('sky'), len: 'hip', open: '#fff9ef', buttons: '#f4e9c0', nButtons: 3}), () => { const {b, D} = c; c.on('chest', () => { b.box(.018, D.tor * .3, .006, '#b8483f', {y: D.legLen + D.tor * .6, z: D.depth * 1.12, r: 0}); }); }, () => backpack(c, '#3a6a9a')); },
  lampgirl(c, S) { S.top = pc('pink'); S.coat = {color: pc('pink')}; S.bottom = '#5a5a78'; S.legs = 'skirt'; S.sock = '#5a5a78'; S.shoe = {kind: 'boot', color: '#4a3a3a'}; S.hat = {kind: 'bow', col: '#d9506a'}; S.hairMode = 'full'; S.acc.push(() => jacket(c, {color: pc('pink'), len: 'thigh', buttons: '#f4e9c0', nButtons: 4, collar: light(pc('pink'), .3)}), () => scarf(c, '#f4e9c0'), () => pole(c)); },
  lampboy(c, S) { S.top = pc('brown'); S.coat = {color: pc('brown')}; S.bottom = '#3a3d48'; S.shoe = {kind: 'boot', color: '#2f2a28'}; S.hat = {kind: 'cap', col: '#3a3d48'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('brown'), len: 'hip', buttons: '#caa24a', nButtons: 4}), () => pole(c)); },
  gardener(c, S) { S.top = '#f4f0e6'; S.sleeves = 'short'; S.bottom = pc('green'); S.legs = 'dungarees'; S.shoe = {kind: 'wellie', color: '#4a7a4a'}; S.hat = {kind: 'sun'}; S.hairMode = 'hat'; S.acc.push(() => dungarees(c, {color: pc('green'), button: '#f4e9c0'}), () => glove(c, '#d9c07a'), () => { const {b, D} = c; c.on('armLl', () => { b.cyl(.021, .017, .04, '#4a8aa8', {x: D.xL + .006, y: D.wristY - .06, z: .018, seg: 8}); rod(b, [D.xL + .006, D.wristY - .045, .018], [D.xL + .006, D.wristY - .018, .052], .005, .005, '#4a8aa8', 4); b.cyl(.004, .004, .045, '#4a8aa8', {x: D.xL + .006, y: D.wristY - .05, z: .036, rx: 1.0, seg: 4}); }); }); S.warm = pc('green'); },
  paperboy(c, S) { S.top = pc('orange'); S.coat = null; S.sleeves = 'short'; S.bottom = '#6a6a78'; S.legs = 'shorts'; S.sock = '#f4f0e6'; S.shoe = {kind: 'shoe', color: '#d8d2c0', lace: '#d65f50'}; S.hat = {kind: 'flat', col: '#5a4a3a'}; S.hairMode = 'hat'; S.acc.push(() => satchel(c, '#8a6a46', true), () => stripes(c, '#f4f0e6', [.5])); },
  nurse(c, S) { S.top = '#fffdf8'; S.coat = {color: '#fffdf8'}; S.bottom = '#fffdf8'; S.legs = 'skirt'; S.sock = '#f4f0e6'; S.shoe = {kind: 'shoe', color: '#f0f0ee'}; S.hat = {kind: 'nurse'}; S.hairMode = 'full'; S.acc.push(() => jacket(c, {color: '#fffdf8', len: 'knee', buttons: '#7ab0d0', nButtons: 4, collar: '#e6f1f6', belt: '#7ab0d0'}), () => { const {b, D} = c; c.on('chest', () => { b.cyl(.011, .011, .006, '#c8372b', {x: .03, y: D.legLen + D.tor * .78, z: D.depth * 1.13, rx: Math.PI / 2, seg: 8}); b.box(.003, .014, .007, '#fff', {x: .03, y: D.legLen + D.tor * .78, z: D.depth * 1.135, r: 0}); b.box(.014, .003, .007, '#fff', {x: .03, y: D.legLen + D.tor * .78, z: D.depth * 1.135, r: 0}); }); }, () => { const {b, D} = c; c.on('chest', () => { b.box(D.sw * 2.3, D.tor * .4, .01, '#4f86a8', {y: D.shY - D.tor * .24, z: -D.depth * 1.0, r: 0}); }); }); },
  stationmaster(c, S) { S.top = '#f4f0e6'; S.coat = {color: pc('blue')}; S.bottom = '#3a4254'; S.shoe = {kind: 'boot', color: '#1c1c1f'}; S.hat = {kind: 'peaked', col: pc('blue'), band: '#b3262a'}; S.hairMode = 'hat'; S.cuff = '#d8b04a'; S.acc.push(() => jacket(c, {color: pc('blue'), len: 'thigh', open: '#f4f0e6', buttons: '#d8b04a', nButtons: 6, collar: dark(pc('blue'), .2), belt: '#2a2a2e', buckle: '#d8b04a'}), () => { const {b, D} = c; c.on('chest', () => { b.torus(.022, .003, '#d8b04a', {x: .04, y: D.legLen + D.tor * .52, z: D.depth * 1.14, seg: 5, arc: Math.PI * 1.5}); b.sph(.011, '#d8b04a', {x: .04, y: D.legLen + D.tor * .45, z: D.depth * 1.14, sz: .4, seg: 6}); b.cyl(.003, .003, .06, '#d8b04a', {x: .02, y: D.legLen + D.tor * .55, z: D.depth * 1.14, rz: -.8, seg: 4}); }); }, () => badge(c, '#d8b04a', .8, -.03), () => scarf(c, '#b3262a')); },
  bandleader(c, S) { S.top = pc('yellow'); S.coat = {color: pc('yellow')}; S.bottom = '#3a3d70'; S.shoe = {kind: 'boot', color: '#2a2a2e'}; S.hat = {kind: 'shako', col: '#b3262a'}; S.hairMode = 'hat'; S.cuff = '#b3262a'; S.acc.push(() => jacket(c, {color: pc('yellow'), len: 'hip', buttons: '#b3262a', nButtons: 6, collar: '#b3262a', belt: '#b3262a'}), () => shoulderPads(c, '#d8b04a', '#d8b04a'), () => stripes(c, '#b3262a', [.58, .72]), () => { const {b, D} = c; c.on('armRl', () => { b.cyl(.004, .004, .14, '#f4f0e6', {x: D.xR, y: D.wristY + .02, z: .05, rx: 1.15, seg: 5}); }); }); },
  fisherman(c, S) { S.top = '#4a4f5e'; S.coat = {color: pc('sky')}; S.bottom = '#6a6a50'; S.shoe = {kind: 'wellie', color: '#4a5a40'}; S.hat = {kind: 'beanie', col: '#2c4a73', pom: '#2c4a73'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('sky'), len: 'thigh', buttons: '#e8e0cc', nButtons: 4, collar: dark(pc('sky'), .2), puff: 1.05}), () => { const {b, D} = c; c.on('pelvis', () => { b.box(.07, .05, .03, '#6a5a3a', {x: D.hw * 1.7, y: D.legLen - .02, z: 0, r: .004}); }); }); S.warm = pc('sky'); },
  visitor(c, S) { S.top = pc(c.def.coat); S.coat = {color: pc(c.def.coat)}; S.bottom = '#6a5a70'; S.legs = 'skirt'; S.sock = '#5a4a52'; S.shoe = {kind: 'shoe', color: '#5a3a3a'}; S.hat = null; S.hairMode = 'full'; S.acc.push(() => jacket(c, {color: pc(c.def.coat), len: 'thigh', open: '#f4e9d0', buttons: '#f4e9c0', nButtons: 4}), () => handbag(c, '#a86a4a'), () => scarf(c, '#f4e9c0')); },
  fishmonger(c, S) { S.top = '#f4f0e6'; S.sleeves = 'rolled'; S.bottom = '#4a5a4a'; S.shoe = {kind: 'wellie', color: '#e8c43a'}; S.hat = null; S.hairMode = 'full'; S.acc.push(() => apron(c, {color: pc('teal'), len: .55, pocket: true}), () => basket(c, {n: 4, colour: ['#9fbdd2', '#7b9db9', '#c9d8e0']}, '#8a6a46')); },
  grocer(c, S) { S.top = '#f4f0e6'; S.sleeves = 'rolled'; S.bottom = '#5a5a4a'; S.shoe = {kind: 'shoe', color: '#4a3a30'}; S.hat = {kind: 'cap', col: pc('green')}; S.hairMode = 'hat'; S.acc.push(() => apron(c, {color: pc('green'), len: .5, pocket: true, frill: false}), () => basket(c, {n: 6, colour: ['#d65f50', '#8abf5a', '#e8c43a']}, '#b88a50')); },
  doctor(c, S) { S.top = '#4a6a8a'; S.coat = {color: '#fffdf8'}; S.bottom = '#3a4254'; S.shoe = {kind: 'shoe', color: '#2a2a2e'}; S.hat = {kind: 'flat', col: '#7a8088'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: '#fffdf8', len: 'knee', open: '#4a6a8a', buttons: '#c0c0c0', nButtons: 3, collar: '#eef3f6'}), () => stetho(c), () => { const {b, D} = c; c.on('armLl', () => { b.box(.062, .042, .03, '#3a2a22', {x: D.xL + .004, y: D.wristY - .05, z: .008, r: .005}); b.torus(.02, .004, '#6b4a2f', {x: D.xL + .004, y: D.wristY - .022, ry: Math.PI / 2, seg: 5}); }); }); },
  driver(c, S) { S.top = pc('red'); S.coat = {color: pc('red')}; S.bottom = '#3e4b63'; S.shoe = {kind: 'boot', color: '#2a2a2e'}; S.hat = {kind: 'cap', col: '#2c3548'}; S.hairMode = 'hat'; S.acc.push(() => jacket(c, {color: pc('red'), len: 'hip', buttons: '#d8b04a', nButtons: 4, belt: '#2c3548', buckle: '#d8b04a'}), () => scarf(c, '#f4f0e6', '#2c3548'), () => { const {b, D} = c; c.on('head', () => { b.torus(D.hr * .95, D.hr * .1, '#2f2f35', {y: D.hy + D.hr * .62, z: D.hr * .15, rx: Math.PI / 2, seg: 6}); for (const s of [-1, 1]) b.cyl(D.hr * .3, D.hr * .3, D.hr * .2, '#9fd0e0', {x: s * D.hr * .38, y: D.hy + D.hr * .78, z: D.hr * .5, rx: Math.PI / 2 - .4, seg: 8}); }); }); }
};
export const ROLES = Object.keys(ROLE);

const hashId = id => { let n = 5; for (const ch of String(id)) n = (n * 33 + ch.charCodeAt(0)) >>> 0; return n; };
/* ---------------- weather wear ---------------- */
// 'base' is the mild-day costume; 'rain' puts a waterproof over it (and wellies, a hood if no hat); 'winter' adds a thick coat, scarf, mittens and a woolly hat.
const RAINCOATS = ['#e8b82f', '#d65f50', '#3f78a8', '#4a9a6a', '#e8873a', '#8a6ac0', '#2fa0a0'];
function wearUp(c, S, wear) {
  if (wear === 'base') return;
  const I = c.I, D = c.D, cold = wear === 'winter', col = cold ? mix(S.coat ? S.coat.color : S.top, '#2c3548', .18) : RAINCOATS[(hashId(c.def.id)) % RAINCOATS.length], role = I.role;
  const uniformHat = S.hat && ['police', 'fire', 'peaked', 'chef', 'shako'].includes(S.hat.kind);
  const uniform = ['police', 'fire', 'stationmaster', 'post', 'driver', 'nurse', 'captain'].includes(role);
  if (!cold || !uniform) { S.acc = S.acc.filter(a => a.keep); }   // the coat covers the aprons, belts and badges (things that are tools, held props and hats stay)
  const keepProps = ['pole', 'basket', 'handbag'];
  S.coat = {color: col}; S.sleeves = 'long';
  if (!cold) {
    S.acc.push(() => jacket(c, {color: col, len: I.age === 'child' ? 'thigh' : 'knee', buttons: dark(col, .3), nButtons: 4, collar: dark(col, .15), puff: 1.04, trim: dark(col, .1)}));
    S.shoe = {kind: 'wellie', color: I.age === 'child' ? '#d65f50' : '#3f6a4a'}; if (!S.hat) { S.hat = {kind: 'hood', col}; S.hairMode = 'hood'; }
  } else {
    S.puff = 1.14; S.mitts = '#f4efe4'; S.shoe = {kind: 'boot', color: '#3a2c26'};
    S.acc.push(() => jacket(c, {color: col, len: uniform ? 'thigh' : 'thigh', buttons: dark(col, .3), nButtons: 4, collar: light(col, .25), puff: 1.14, trim: light(col, .2)}), () => scarf(c, role === 'police' ? '#7a8aa8' : role === 'fire' ? '#f6ee9a' : '#d65f50', '#f4efe4'));
    if (!uniformHat) { S.hat = {kind: 'beanie', col: S.warm || '#d65f50', pom: '#ffffff'}; S.hairMode = 'hat'; }
    if (S.legs === 'skirt') { S.legs = 'long'; S.bottom = '#3e4256'; }
    if (S.legs === 'shorts') { S.legs = 'long'; S.bottom = '#4a4e62'; }
  }
  void keepProps; void D;
}

/* ---------------- the figure ---------------- */
export {wearFor, dimsOf, identityOf, FOLK};
// c.def: the cast entry. Returns a group holding the one skinned mesh; group.userData: {rig, dims, wear, identity}.
export function buildPerson(def, wear = 'base') {
  const I = identityOf(def), D = dimsOf(I), b = new Bag(), rig = new Rig(BIPED.names, BIPED.parents);
  const c = {b, I, D, def, rig, wear, hairMode: 'full', on: (bone, fn) => boneTag(b, rig.index[bone], fn)};
  const S = SPEC(); S.acc = []; (ROLE[I.role] || ROLE.visitor)(c, S); S.acc.forEach(a => { a.keep = false; });
  // props that are tools, not clothes, survive the rain jacket: mark them
  S.acc.forEach(a => { const t = a.toString(); a.keep = /pole\(c\)|basket\(c|handbag\(c|satchel\(c|backpack\(c|armLl|armRl/.test(t) && !/jacket\(c/.test(t) && !/apron\(c/.test(t); });
  wearUp(c, S, wear);
  if (DETAIL.lite) S.acc = S.acc.filter(a => a.keep);   // (the light version keeps tools in the hand, a pole or a basket, and drops the fine trim)
  c.hairMode = S.hat ? (S.hairMode === 'full' ? 'hat' : S.hairMode) : S.hairMode;
  // pivots (rest coordinates)
  rig.at('pelvis', 0, D.legLen, 0).at('chest', 0, D.legLen + D.tor * .2, 0).at('head', 0, D.shY + D.neck * .35, 0).at('coat', 0, D.legLen + D.tor * .1, 0);
  rig.at('armLu', D.xL, D.shY - .012, 0).at('armLl', D.xL, D.shY - D.ua, 0).at('armRu', D.xR, D.shY - .012, 0).at('armRl', D.xR, D.shY - D.ua, 0);
  rig.at('legLu', D.hw, D.legLen - .004, 0).at('legLl', D.hw * .97, D.kneeY, 0).at('footL', D.hw * .93, D.ankleY, 0).at('legRu', -D.hw, D.legLen - .004, 0).at('legRl', -D.hw * .97, D.kneeY, 0).at('footR', -D.hw * .93, D.ankleY, 0);
  dressBody(c, S);
  for (const a of S.acc) a();
  if (S.scarf) scarf(c, S.scarf);
  c.on('head', () => { buildFace(c); if (S.hat) { const fn = HATS[S.hat.kind]; if (fn) fn(c, S.hat.col, S.hat.band || S.hat.pom); } });
  const mesh = rigMesh(b, rig); const g = new THREE.Group(); g.add(mesh);
  g.userData = {rig, dims: D, wear, identity: I, spec: S, mesh, role: I.role}; g.visible = false; return g;
}
