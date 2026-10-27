/* Mushroom Island life layer.
 * The painted kingdom breathes (cloud shadows, light shafts, waterfall mist,
 * lamp glow, townsfolk on the bridge, a passing flock) and Pip's run has
 * something to engage with (star seeds along each stunt arc, a fairy companion,
 * butterflies that lift off as Pip approaches, drifting petals).
 * Kept separate from mushroom-cinematic.js: render() hands one state object to
 * back/front hooks. Everything derives from the scene clock and Pip's travel,
 * so a frame is reproducible after pauses, resumes and frame drops.
 * Original motifs only; no franchise assets.
 */
window.MushroomLife = (() => {
  const TAU = Math.PI * 2, CHAPTER = 750;
  const hash = n => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); return (n ^ (n >>> 16)) >>> 0; };
  const rnd = (i, salt = 0) => hash((i | 0) ^ (salt * 7919)) / 4294967296;
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x));
  const smooth = x => { x = clamp(0, x, 1); return x * x * (3 - 2 * x); };

  // Anchors in the painted kingdom, normalised to the plate image.
  const LAMPS = [[.4742, .6031], [.5211, .6208], [.5629, .6259], [.5894, .6284], [.6135, .631],
    [.6377, .636], [.6733, .641], [.7657, .6537], [.7941, .659], [.8339, .6335]];
  const DECK = [[.4813, .6461], [.632, .6588], [.7145, .674], [.8197, .6967], [.8624, .7018]];
  const FALLS = [[.455, .5, .05], [.565, .5, .035], [.265, .64, .03], [.08, .76, .03], [.15, .79, .025], [.828, .31, .02]];
  const CAPS = [['#d8484a', '#fff3e4'], ['#4f6fd0', '#f4f1ff'], ['#9a5fc0', '#fbefff'], ['#e48a3a', '#fff2dd']];

  const at = (s, nx, ny) => [s.plate.dx + nx * s.plate.iw * s.plate.factor, s.plate.dy + ny * s.plate.ih * s.plate.factor];
  const glow = (c, x, y, r, rgb, a) => {
    if (!(r > 0) || a <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  };

  /* ---------- the kingdom behind the route ---------- */
  function cloudShadows(c, s) {
    const {iw, ih, factor} = s.plate;
    c.save(); c.globalCompositeOperation = 'multiply';
    for (let k = 0; k < 2; k++) {
      const nx = ((.15 + s.clock * .005 + k * .62) % 1.5) - .25, ny = .34 + k * .22;
      const [x, y] = at(s, nx, ny), rx = .26 * iw * factor, ry = .09 * ih * factor;
      c.save(); c.translate(x, y); c.scale(1, ry / rx);
      glow(c, 0, 0, rx, '52,74,104', .13);
      c.restore();
    }
    c.restore();
  }
  function lightShafts(c, s) {
    c.save(); c.globalCompositeOperation = 'screen';
    const ox = s.W * .78, oy = -s.H * .12;
    for (let k = 0; k < 4; k++) {
      const a = 2.05 + k * .13 + Math.sin(s.clock * .07 + k) * .025, len = s.H * 1.25, w = .035 + .012 * k;
      const breathe = .028 + .02 * (.5 + .5 * Math.sin(s.clock * .21 + k * 1.9));
      const g = c.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
      g.addColorStop(0, `rgba(255,244,205,${breathe.toFixed(3)})`); g.addColorStop(1, 'rgba(255,244,205,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(ox, oy);
      c.lineTo(ox + Math.cos(a - w) * len, oy + Math.sin(a - w) * len);
      c.lineTo(ox + Math.cos(a + w) * len, oy + Math.sin(a + w) * len); c.fill();
    }
    c.restore();
  }
  function mist(c, s) {
    const {iw, factor} = s.plate;
    c.save(); c.globalCompositeOperation = 'screen';
    FALLS.forEach(([nx, ny, nw], k) => {
      const [bx, by] = at(s, nx, ny), w = nw * iw * factor;
      if (bx < -w * 2 || bx > s.W + w * 2 || by < -w || by > s.H + w) return;
      for (let j = 0; j < 6; j++) {
        const u = (s.clock * .16 + j / 6 + k * .37) % 1;
        const x = bx + (j - 2.5) * w * .22 + Math.sin(s.clock * .35 + j * 1.7 + k) * w * .12;
        const y = by - u * w * 1.1;
        glow(c, x, y, w * (.28 + u * .55), '240,250,255', .17 * (1 - u) * smooth(u * 5));
      }
    });
    c.restore();
  }
  function lamps(c, s) {
    const f = s.plate.factor;
    c.save(); c.globalCompositeOperation = 'screen';
    LAMPS.forEach(([nx, ny], k) => {
      const [x, y] = at(s, nx, ny);
      if (x < -20 || x > s.W + 20 || y < -20 || y > s.H) return;
      const flicker = .5 + .5 * Math.sin(s.clock * (2.1 + k * .37) + k * 1.3) * Math.sin(s.clock * (.9 + k * .11));
      glow(c, x, y, 10 * f, '255,196,112', .2 + .14 * flicker);
    });
    c.restore();
  }
  // Townsfolk stroll the bridge walk, pausing to look out, then turning back.
  function deckPoint(u) {
    const seg = DECK.length - 1, p = clamp(0, u, 1) * seg, i = Math.min(seg - 1, Math.floor(p)), t = p - i;
    return [DECK[i][0] + (DECK[i + 1][0] - DECK[i][0]) * t, DECK[i][1] + (DECK[i + 1][1] - DECK[i][1]) * t];
  }
  function townsfolk(c, s) {
    const f = s.plate.factor;
    for (let k = 0; k < 5; k++) {
      const period = 34 + rnd(k, 3) * 18, v = (s.clock / period + rnd(k, 4)) % 1;
      // Out, a pause at the far end, back, a pause at home.
      const leg = v < .42 ? smooth(v / .42) : v < .5 ? 1 : v < .92 ? 1 - smooth((v - .5) / .42) : 0;
      const walking = (v < .42 || (v >= .5 && v < .92)) ? 1 : 0, dir = v < .5 ? 1 : -1;
      const lo = rnd(k, 5) * .35, hi = lo + .3 + rnd(k, 6) * .35, u = lo + (hi - lo) * leg;
      const [nx, ny] = deckPoint(u), [x, y] = at(s, nx, ny);
      if (x < -10 || x > s.W + 10) continue;
      const h = 9.5 * f * (.9 + rnd(k, 7) * .2), step = Math.sin(s.clock * 6 + k) * walking;
      const [cap, dots] = CAPS[k % CAPS.length];
      c.save(); c.translate(x, y); c.scale(dir, 1);
      c.strokeStyle = 'rgba(60,44,36,.85)'; c.lineWidth = Math.max(.8, h * .11); c.lineCap = 'round';
      c.beginPath(); c.moveTo(-h * .08, -h * .32); c.lineTo(-h * .08 + step * h * .1, 0);
      c.moveTo(h * .08, -h * .32); c.lineTo(h * .08 - step * h * .1, 0); c.stroke();
      c.fillStyle = ['#f3e6cf', '#cfe3f4', '#f6d6c4', '#e2f0d2'][k % 4];
      c.beginPath(); c.ellipse(0, -h * .5, h * .18, h * .24, 0, 0, TAU); c.fill();
      c.fillStyle = cap; c.beginPath(); c.ellipse(0, -h * .8, h * .32, h * .2, 0, Math.PI, TAU); c.fill();
      c.fillStyle = dots; c.beginPath(); c.arc(-h * .12, -h * .86, h * .05, 0, TAU); c.arc(h * .13, -h * .88, h * .045, 0, TAU); c.fill();
      c.restore();
    }
  }
  // A small flock crosses high in the sky every half minute or so.
  function flock(c, s) {
    const cycle = 31, n = Math.floor(s.clock / cycle), u = (s.clock % cycle) / 14;
    if (u > 1) return;
    const y0 = s.H * (.09 + rnd(n, 9) * .1), dir = rnd(n, 10) < .5 ? -1 : 1;
    const lead = dir < 0 ? s.W * 1.08 - u * s.W * 1.2 : -s.W * .08 + u * s.W * 1.2;
    c.save(); c.strokeStyle = 'rgba(66,78,98,.72)'; c.lineCap = 'round';
    for (let b = 0; b < 5; b++) {
      const rank = Math.ceil(b / 2) * (b % 2 ? 1 : -1);
      const x = lead - dir * Math.abs(rank) * 17, y = y0 + rank * 9 + Math.sin(s.clock * .8 + b) * 3;
      const flap = Math.sin(s.clock * 9 + b * 1.4) * 4, span = 7 + rnd(b, 11) * 2;
      c.lineWidth = 1.5; c.beginPath();
      c.moveTo(x - span, y - flap); c.quadraticCurveTo(x - span * .4, y - flap * .2 - 2, x, y);
      c.quadraticCurveTo(x + span * .4, y - flap * .2 - 2, x + span, y - flap); c.stroke();
    }
    c.restore();
  }

  /* ---------- Pip's route ---------- */
  const pipScale = s => Math.max(.49, Math.min(.90, Math.min(s.W / 540, s.H / 980) * .87));
  // Star seeds trace each stunt's arc; Pip gathers them as he passes.
  function seedsFor(j, s) {
    const kind = s.poseAt(j * CHAPTER + 372).kind, out = [];
    const us = kind === 'dash' ? [.15, .3, .45, .6, .75] : [.3, .5, .7];
    for (const u of us) {
      const wx = j * CHAPTER + 195 + 355 * u, p = s.poseAt(wx);
      const body = kind === 'slide' ? 58 : 128;
      out.push({wx, h: p.lift + body, id: j * 8 + out.length});
    }
    return out;
  }
  function seed(c, x, y, r, t, id) {
    const bob = Math.sin(t * 2.6 + id) * r * .35;
    glow(c, x, y + bob, r * 3.2, '255,224,120', .38);
    c.save(); c.translate(x, y + bob); c.rotate(t * .9 + id);
    c.fillStyle = '#fff4c6'; c.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * .42 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    c.closePath(); c.fill();
    c.fillStyle = '#f2b93b'; c.beginPath(); c.arc(0, 0, r * .36, 0, TAU); c.fill();
    c.restore();
  }
  function burst(c, x, y, r, d, id) {
    const u = d / 95, a = 1 - u;
    c.save(); c.globalCompositeOperation = 'screen';
    glow(c, x, y, r * (2 + u * 4), '255,236,160', .5 * a);
    c.strokeStyle = `rgba(255,246,206,${(.7 * a).toFixed(3)})`; c.lineWidth = 1.6;
    c.beginPath(); c.arc(x, y, r * (1 + u * 3.4), 0, TAU); c.stroke();
    for (let k = 0; k < 6; k++) {
      const ang = k * TAU / 6 + id, rr = r * (1.3 + u * 5);
      glow(c, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr - u * r * 2, r * .9, '255,250,220', .8 * a);
    }
    c.restore();
  }
  function starSeeds(c, s, front) {
    const sc = pipScale(s), gy = s.ground + 10, r = 15 * sc;
    const first = Math.floor((s.world - s.pipX) / CHAPTER) - 1, last = Math.ceil((s.world + s.W) / CHAPTER);
    for (let j = first; j <= last; j++) for (const sd of seedsFor(j, s)) {
      const x = s.pipX + sd.wx - s.world, y = gy - sd.h * sc, d = s.world - sd.wx;
      if (x < -30 || x > s.W + 30) continue;
      if (d < 0 && !front) seed(c, x, y, r, s.clock, sd.id);
      else if (d >= 0 && d < 95 && front) burst(c, s.pipX, y, r, d, sd.id);
    }
  }
  // A small glowing companion follows Pip's path a beat behind.
  function companion(c, s) {
    const sc = pipScale(s), gy = s.ground + 10;
    const trail = [];
    for (let k = 0; k < 7; k++) {
      const lagW = s.world - 60 - k * 9, p = s.poseAt(lagW), t = s.clock - k * .05;
      trail.push([s.pipX - (112 + k * 13) * sc + Math.sin(t * 1.3) * 14 * sc,
        gy - p.lift * sc - 292 * sc + Math.sin(t * 2.2) * 12 * sc + k * 3 * sc]);
    }
    c.save(); c.globalCompositeOperation = 'screen';
    for (let k = trail.length - 1; k > 0; k--) glow(c, trail[k][0], trail[k][1], 9 * sc, '190,255,236', .34 * (1 - k / trail.length));
    const [x, y] = trail[0];
    glow(c, x, y, 46 * sc, '170,255,230', .5);
    c.restore();
    const flap = Math.sin(s.clock * 22) * .5 + .5;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(226,255,250,.75)';
    for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * 11 * sc, -7 * sc, 11 * sc, (3 + 7 * flap) * sc, sd * .5, 0, TAU); c.fill(); }
    c.fillStyle = '#fbfff2'; c.beginPath(); c.arc(0, 0, 7.5 * sc, 0, TAU); c.fill();
    c.restore();
  }
  // Butterflies rest on the terrace and lift off as Pip comes near.
  function butterflies(c, s) {
    const sc = pipScale(s), gy = s.ground + 2, spacing = 520;
    const first = Math.floor((s.world - s.pipX) / spacing) - 1, last = Math.ceil((s.world + s.W) / spacing) + 1;
    for (let j = first; j <= last; j++) {
      const wx = j * spacing + 130 + rnd(j, 21) * 120, rel = wx - s.world, e = Math.max(0, 150 - rel);
      let x = s.pipX + rel + e * .62 + Math.sin(e * .03 + j) * 18, y = gy - 4 * sc - e * .62 + Math.sin(e * .07) * 8;
      if (x < -30 || x > s.W + 30 || y < s.H * .2) continue;
      const flying = e > 0, flap = flying ? Math.sin(s.clock * 24 + j) : Math.sin(s.clock * 1.4 + j) * .6;
      const col = [['#f2a23c', '#7a3d18'], ['#7cc4f0', '#24527a'], ['#f39ac0', '#7a2d55']][((j % 3) + 3) % 3];
      const sz = 12 * sc * (flying ? 1 : .9), open = .25 + .75 * (flap * .5 + .5);
      c.save(); c.translate(x, y); c.rotate(flying ? -.35 : 0);
      for (const sd of [-1, 1]) {
        c.fillStyle = col[0]; c.beginPath(); c.ellipse(sd * sz * .55 * open, -sz * .35, sz * .6 * open + .5, sz * .55, sd * .4, 0, TAU); c.fill();
        c.fillStyle = col[1]; c.beginPath(); c.ellipse(sd * sz * .45 * open, sz * .15, sz * .38 * open + .4, sz * .32, -sd * .3, 0, TAU); c.fill();
      }
      c.fillStyle = '#2e2620'; c.beginPath(); c.ellipse(0, 0, sz * .12, sz * .55, 0, 0, TAU); c.fill();
      c.restore();
    }
  }
  function petals(c, s) {
    for (let k = 0; k < 9; k++) {
      const sp = 22 + rnd(k, 31) * 18, u = ((s.clock * sp / s.H) + rnd(k, 32)) % 1;
      const x = ((rnd(k, 33) * s.W * 1.4 - u * s.W * .45 + Math.sin(s.clock * .6 + k) * 30) % (s.W * 1.2) + s.W * 1.2) % (s.W * 1.2) - s.W * .1;
      const y = -20 + u * s.H * .95;
      c.save(); c.translate(x, y); c.rotate(s.clock * (1 + rnd(k, 34)) + k);
      c.globalAlpha = .75 * smooth(u * 8) * smooth((1 - u) * 6);
      c.fillStyle = k % 3 ? '#f7b8c8' : '#fde3ea';
      c.beginPath(); c.ellipse(0, 0, 4.2, 2.1, 0, 0, TAU); c.fill();
      c.restore();
    }
  }

  return {
    back(c, s) {
      if (!s.ready || !s.plate) return;
      cloudShadows(c, s); lightShafts(c, s); mist(c, s); lamps(c, s); townsfolk(c, s); flock(c, s);
    },
    beforePip(c, s) { starSeeds(c, s, false); butterflies(c, s); },
    front(c, s) { starSeeds(c, s, true); companion(c, s); petals(c, s); }
  };
})();
