/* Richer live paintings. Each tradition's endless landscape gains what its
 * real paintings fill the frame with, drawn in its own idiom:
 * - Gond: a patterned sun (or moon) with leaf rays, dash-filled clouds and
 *   flocks of dotted birds in the sky.
 * - Warli: the ray-circled sun and moon, V-stroke birds, a range of dotted
 *   triangle hills and little huts along the fields.
 * - Kangra: soft clouds and birds in its sky (its own painted hills, trees
 *   and shrubs are left as they are).
 * - Japan: gold kasumi mist bands drifting across sky and hills, cranes.
 * - China: pale distant peaks in ink wash, mist bands and skeins of geese.
 * - Mexico: amate-style patterned birds across the sky.
 * Everything is added to each chunk as ordinary static layers, so it is
 * painted once into the cached tiles (no per-frame cost), seeded from the
 * world seed and chunk, and scrolls with the landscape (far layers of the
 * layered styles move with their slower parallax plane). */
const ArtRicher = (() => {
  const ink = () => T.mark || T.ink, dark = () => !!T.dark;
  const R = x0 => mulberry32(hash(seed ^ 0x51c3, Math.round(x0)));

  /* ---- shared motifs ---- */
  function bean(c, x, y, w, h) {   // a cloud: three lobes on a flat base
    c.beginPath(); c.moveTo(x - w / 2, y + h * .3);
    c.bezierCurveTo(x - w / 2, y - h * .4, x - w * .2, y - h * .55, x - w * .08, y - h * .2);
    c.bezierCurveTo(x, y - h * .8, x + w * .3, y - h * .8, x + w * .28, y - h * .15);
    c.bezierCurveTo(x + w * .5, y - h * .3, x + w * .55, y + h * .3, x + w * .4, y + h * .3);
    c.closePath();
  }
  function vbirds(c, x, y, n, s, col, r) {
    c.strokeStyle = col; c.lineWidth = 1.4 * s; c.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const bx = x + (r() - .5) * 140, by = y + (r() - .5) * 50, w = (6 + r() * 5) * s, lift = w * (.35 + r() * .3);
      c.beginPath(); c.moveTo(bx - w, by - lift); c.quadraticCurveTo(bx - w * .4, by - lift * .2, bx, by); c.quadraticCurveTo(bx + w * .4, by - lift * .2, bx + w, by - lift); c.stroke();
    }
  }

  /* ---- Gond ---- */
  function gondSun(c, x, y, r) {
    const night = dark();
    c.save(); c.translate(x, y); c.strokeStyle = ink(); c.lineWidth = 1.6;
    if (!night) for (let i = 0; i < 16; i++) {   // leaf rays, alternating colours
      c.save(); c.rotate(i / 16 * TAU); c.beginPath(); c.moveTo(r * 1.08, 0); c.quadraticCurveTo(r * 1.45, -r * .18, r * 1.78, 0); c.quadraticCurveTo(r * 1.45, r * .18, r * 1.08, 0);
      c.fillStyle = i % 2 ? '#c9553d' : '#e6b34b'; c.fill(); c.stroke(); c.restore();
    }
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fillStyle = night ? '#efe6c8' : '#eea53a'; c.fill(); c.stroke();
    c.beginPath(); c.arc(0, 0, r * .72, 0, TAU); c.fillStyle = night ? '#e2d6b0' : '#f2c35a'; c.fill(); c.stroke();
    c.fillStyle = ink(); c.beginPath(); for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; dot(c, Math.cos(a) * r * .86, Math.sin(a) * r * .86, 1.5); } c.fill();
    c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; dot(c, Math.cos(a) * r * .5, Math.sin(a) * r * .5, 1.2); } dot(c, 0, 0, r * .16); c.fill();
    if (night) { c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(r * .55, -r * .2, r * .9, 0, TAU); c.fill(); }
    c.restore();
  }
  function gondCloud(c, x, y, w, r) {
    c.save(); bean(c, x, y, w, w * .42); c.fillStyle = dark() ? 'rgba(255,248,232,.10)' : '#ece3cc'; c.fill();
    c.save(); c.clip(); c.strokeStyle = ink(); c.globalAlpha = .4; c.lineWidth = 1; c.beginPath();   // rows of dashes, Gond's own texture
    for (let yy = y - w * .4; yy < y + w * .2; yy += 7) for (let xx = x - w / 2 + ((yy / 7) % 2) * 5; xx < x + w / 2; xx += 11) { c.moveTo(xx, yy); c.lineTo(xx + 5, yy); }
    c.stroke(); c.restore();
    bean(c, x, y, w, w * .42); c.strokeStyle = ink(); c.lineWidth = 1.8; c.stroke(); c.restore();
  }
  function gondBird(c, x, y, s, k) {
    const [a, b] = GOND_PAIRS[k % GOND_PAIRS.length];
    c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = ink(); c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(0, 0, 13, 6, -.1, 0, TAU); c.fillStyle = a; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-2, -2); c.quadraticCurveTo(-8, -20, -20, -15); c.quadraticCurveTo(-10, -6, -2, -2); c.fillStyle = b; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-12, 0); c.lineTo(-22, -5); c.lineTo(-21, 5); c.closePath(); c.fillStyle = b; c.fill(); c.stroke();
    c.fillStyle = T.light; c.beginPath(); for (let i = 0; i < 5; i++) dot(c, -7 + i * 3.4, .5, 1); c.fill();
    c.beginPath(); c.arc(12, -3, 3.4, 0, TAU); c.fillStyle = a; c.fill(); c.stroke(); c.fillStyle = '#e6b34b'; c.beginPath(); c.moveTo(15, -3); c.lineTo(20, -2); c.lineTo(15, -1); c.fill();
    c.restore();
  }
  function gond(x0, add, r) {
    if (r() < .5) { const x = x0 + 120 + r() * 360, y = topY + 80 + r() * 40, rad = 34 + r() * 10; add(1, c => gondSun(c, x, y, rad)); }
    for (let k = 0, n = 2 + (r() < .5); k < n; k++) { const x = x0 + 40 + k * 190 + r() * 120, y = topY + 50 + r() * 130, w = 110 + r() * 90; add(1, c => gondCloud(c, x, y, w, r)); }
    if (r() < .7) {
      const x = x0 + 100 + r() * 400, y = topY + 150 + r() * 70, n = 3 + (r() * 3 | 0), k0 = r() * 6 | 0, dir = r() < .5 ? 1 : -1;
      add(1, c => { for (let k = 0; k < n; k++) { const row = Math.ceil(k / 2), side = k % 2 ? -1 : 1; c.save(); c.translate(x - dir * row * 52, y + side * row * 26); c.scale(dir, 1); gondBird(c, 0, 0, 1.6, k0 + k); c.restore(); } });
    }
  }

  /* ---- Warli ---- */
  function warliSun(c, x, y, rad, moon) {
    c.save(); c.strokeStyle = ink(); c.fillStyle = ink(); c.lineWidth = 2;
    if (moon) { c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill(); c.fillStyle = T.bg; c.beginPath(); c.arc(x + rad * .45, y - rad * .15, rad * .9, 0, TAU); c.fill(); }
    else {
      c.beginPath(); c.arc(x, y, rad, 0, TAU); c.stroke(); c.beginPath(); c.arc(x, y, rad * .55, 0, TAU); c.stroke();
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * rad * 1.25, y + Math.sin(a) * rad * 1.25); c.lineTo(x + Math.cos(a) * rad * (i % 2 ? 1.6 : 1.85), y + Math.sin(a) * rad * (i % 2 ? 1.6 : 1.85)); c.stroke(); }
      c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; dot(c, x + Math.cos(a) * rad * .78, y + Math.sin(a) * rad * .78, 1.6); } c.fill();
    }
    c.restore();
  }
  function warliHill(c, x, base, w, h) {
    c.save(); c.strokeStyle = ink(); c.fillStyle = ink(); c.lineWidth = 1.6; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x, base - h); c.lineTo(x + w / 2, base); c.stroke();
    c.beginPath(); for (let yy = base - h + 12; yy < base - 3; yy += 8) { const half = (yy - (base - h)) / h * w / 2; for (let xx = x - half + 5; xx < x + half - 3; xx += 8) dot(c, xx, yy, 1.1); } c.fill();
    c.restore();
  }
  function warliHut(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = ink(); c.fillStyle = ink(); c.lineWidth = 1.6; c.lineJoin = 'round';
    c.beginPath(); c.rect(-16, -20, 32, 20); c.stroke();
    c.beginPath(); c.moveTo(-22, -19); c.lineTo(0, -38); c.lineTo(22, -19); c.closePath(); c.stroke();
    c.beginPath(); for (let i = -14; i <= 14; i += 7) { c.moveTo(i, -22); c.lineTo(i * .55, -33); } c.lineWidth = 1; c.stroke();
    c.beginPath(); c.rect(-4, -12, 8, 12); c.fill();
    c.restore();
  }
  function warli(x0, add, r) {
    if (r() < .45) { const x = x0 + 100 + r() * 400, y = topY + 60 + r() * 35, moon = dark() || r() < .3, rad = 24 + r() * 8; add(1, c => warliSun(c, x, y, rad, moon)); }
    { const x = x0 + r() * 600, y = topY + 60 + r() * 100, n = 4 + (r() * 5 | 0); add(1, c => vbirds(c, x, y, n, 1.7, ink(), mulberry32(Math.round(x)))); }
    const hills = 2 + (r() * 3 | 0);
    for (let k = 0; k < hills; k++) { const x = x0 + 40 + r() * 520, w = 70 + r() * 70, h = 45 + r() * 55; add(1, c => warliHill(c, x, gy(x) - 2, w, h)); }
    if (r() < .5) { const x = x0 + 80 + r() * 440, s = .85 + r() * .3; add(3, c => warliHut(c, x, gy(x) + 2, s)); }
  }

  /* ---- Kangra ---- */
  const kRange = (x, off, amp) => topY + 250 + off - amp * (.55 + .45 * Math.sin(x * .007 + off) * Math.sin(x * .0031 + 1.3));
  function kangra(x0, add, r) {
    // (No distant range here: drawn over the far hills, it cut their trees off at the roots.)
    if (r() < .75) {   // a soft cloud: drawn once, blurred into one shape, so no puff or ring shows
      const x = x0 + 80 + r() * 440, y = topY + 50 + r() * 70, w = 170 + r() * 90, q = mulberry32(Math.round(x));
      const lobes = Array.from({length: 7}, (_, k) => [(k / 6 - .5) * w * .8, -Math.sin(k / 6 * Math.PI) * w * .1 + (q() - .5) * 6, w * (.1 + q() * .06)]);
      add(-1, c => {
        const m = c.getTransform(), k = Math.hypot(m.a, m.b) || 1, cw = Math.ceil(w * 1.3 * k), ch = Math.ceil(w * .55 * k);
        const off = document.createElement('canvas'); off.width = cw; off.height = ch;
        const g = off.getContext('2d'), night = !!T.night;
        g.filter = `blur(${Math.max(2, w * .035 * k)}px)`; g.translate(cw / 2, ch * .62); g.scale(k, k);
        g.fillStyle = night ? 'rgba(176,188,206,.75)' : 'rgba(252,249,240,.85)';
        g.beginPath(); for (const [dx, dy, rr] of lobes) { g.moveTo(dx + rr, dy); g.arc(dx, dy, rr, 0, TAU); } g.ellipse(0, w * .04, w * .42, w * .07, 0, 0, TAU); g.fill();
        c.drawImage(off, x - cw / 2 / k, y - ch * .62 / k, cw / k, ch / k);
      });
    }
    if (r() < .6) { const x = x0 + r() * 600, y = topY + 80 + r() * 60, n = 3 + (r() * 4 | 0); add(1, c => vbirds(c, x, y, n, .8, 'rgba(59,42,28,.7)', mulberry32(Math.round(x)))); }
  }

  /* ---- Japan ---- */
  function kasumi(c, x, y, w, h) {   // a gold mist band with rounded ends and a scalloped edge
    c.save(); c.beginPath(); c.moveTo(x - w / 2 + h / 2, y - h / 2);
    for (let k = 0; k < 6; k++) { const a = x - w / 2 + h / 2 + k * (w - h) / 6; c.quadraticCurveTo(a + (w - h) / 12, y - h * .85, a + (w - h) / 6, y - h / 2); }
    c.arc(x + w / 2 - h / 2, y, h / 2, -Math.PI / 2, Math.PI / 2); c.lineTo(x - w / 2 + h / 2, y + h / 2); c.arc(x - w / 2 + h / 2, y, h / 2, Math.PI / 2, Math.PI * 1.5);
    c.closePath(); c.fillStyle = 'rgba(236,211,150,.78)'; c.fill(); c.strokeStyle = 'rgba(176,136,62,.75)'; c.lineWidth = 1.1; c.stroke(); c.restore();
  }
  function crane(c, x, y, s, dir) {
    c.save(); c.translate(x, y); c.scale(dir * s, s); c.lineCap = 'round';
    c.fillStyle = '#f8f3e6'; c.strokeStyle = '#2a494c'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, 14, 4, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(12, -1); c.quadraticCurveTo(22, -4, 30, -3); c.stroke();
    c.fillStyle = '#c8392b'; c.beginPath(); c.arc(29, -3.8, 1.6, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-12, 1); c.lineTo(-28, 4); c.stroke();
    for (const side of [-1, 1]) { c.fillStyle = '#f8f3e6'; c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(2, side * 14, -4, side * 26); c.quadraticCurveTo(-11, side * 12, -10, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#2a494c'; c.beginPath(); c.moveTo(-4, side * 26); c.lineTo(-8.5, side * 17); c.lineTo(-6, side * 13); c.closePath(); c.fill(); }
    c.restore();
  }
  function japan(x0, add, r) {
    { const x = x0 + r() * 600, y = topY + 140 + r() * 60, w = 220 + r() * 160; add(0, c => kasumi(c, x, y, w, 22)); }
    if (r() < .7) { const x = x0 + r() * 600, y = gy(x0 + 300) - 120 - r() * 50, w = 200 + r() * 200; add(1, c => kasumi(c, x, y, w, 18)); }
    if (r() < .45) {
      const x = x0 + 150 + r() * 300, y = topY + 60 + r() * 60, dir = r() < .5 ? 1 : -1, n = 1 + (r() * 3 | 0);
      add(1, c => { for (let k = 0; k < n; k++) crane(c, x - dir * k * 46, y + k * 14, .8 - k * .1, dir); });
    }
  }

  /* ---- China ---- */
  function china(x0, add, r) {
    add(0, c => {   // pale far peaks in ink wash
      const q = mulberry32(Math.round(x0) ^ 31);
      for (let k = 0; k < 3; k++) {
        const x = x0 + q() * 600, base = gy(x) - 90, h = 120 + q() * 110, w = 90 + q() * 80;
        const g = c.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, 'rgba(120,134,124,.42)'); g.addColorStop(1, 'rgba(160,172,160,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - w, base); c.bezierCurveTo(x - w * .5, base - h * .5, x - w * .15, base - h, x, base - h); c.bezierCurveTo(x + w * .2, base - h * .95, x + w * .45, base - h * .4, x + w, base); c.closePath(); c.fill();
      }
    });
    if (r() < .8) { const y = gy(x0 + 300) - 70 - r() * 60; add(1, c => { const g = c.createLinearGradient(0, y - 22, 0, y + 22); g.addColorStop(0, 'rgba(248,244,233,0)'); g.addColorStop(.5, 'rgba(248,244,233,.75)'); g.addColorStop(1, 'rgba(248,244,233,0)'); c.fillStyle = g; c.fillRect(x0 - 20, y - 22, 640, 44); }); }
    if (r() < .5) {   // a skein of geese
      const x = x0 + 150 + r() * 300, y = topY + 40 + r() * 70, n = 5 + (r() * 4 | 0);
      add(1, c => { c.strokeStyle = 'rgba(52,68,61,.75)'; c.lineWidth = 1.2; c.lineCap = 'round'; for (let k = 0; k < n; k++) { const row = Math.ceil(k / 2), side = k % 2 ? -1 : 1, bx = x - row * 20, by = y + side * row * 9; c.beginPath(); c.moveTo(bx - 6, by - 3); c.quadraticCurveTo(bx - 2, by - 1, bx, by); c.quadraticCurveTo(bx + 2, by - 1, bx + 6, by - 3); c.stroke(); } });
    }
  }

  /* ---- Mexico ---- */
  function mexico(x0, add, r) {
    for (let k = 0, n = r() < .6 ? 2 : 1; k < n; k++) {
      const x = x0 + 80 + r() * 440, y = topY + 30 + r() * 90, s = 1.2 + r() * .5, dir = r() < .5 ? 1 : -1, cols = [BRIGHT[r() * BRIGHT.length | 0], BRIGHT[r() * BRIGHT.length | 0]];
      add(6, c => {
        c.save(); c.translate(x, y); c.scale(dir * s, s); c.strokeStyle = ink(); c.lineWidth = 1.2;
        c.beginPath(); c.ellipse(0, 0, 15, 7, -.15, 0, TAU); c.fillStyle = cols[0]; c.fill(); c.stroke();
        for (const [a, l] of [[-.9, 22], [-.5, 26]]) { c.save(); c.rotate(a); c.beginPath(); c.ellipse(-l * .5, 0, l * .5, 6, 0, 0, TAU); c.fillStyle = cols[1]; c.fill(); c.stroke(); c.restore(); }
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(-30, -8); c.lineTo(-27, 2); c.lineTo(-31, 9); c.closePath(); c.fillStyle = cols[1]; c.fill(); c.stroke();
        c.fillStyle = T.light; c.beginPath(); for (let i = 0; i < 6; i++) dot(c, -8 + i * 3.2, 1, 1.1); c.fill();
        c.beginPath(); c.arc(14, -4, 4.5, 0, TAU); c.fillStyle = cols[0]; c.fill(); c.stroke(); c.fillStyle = '#f2c14e'; c.beginPath(); c.moveTo(18, -4); c.lineTo(24, -2); c.lineTo(18, -1); c.fill();
        c.restore();
      });
    }
  }

  const EXTRA = {gond, warli, kangra, japan, china, mexico};
  function install() {
    for (const [key, more] of Object.entries(EXTRA)) {
      const st = STYLES[key]; if (!st || !st.chunk) continue;
      const base = st.chunk;
      st.chunk = function (r, x0, add, z, act) { base.call(this, r, x0, add, z, act); more(x0, add, R(x0)); };
    }
    // Anything built before this ran is rebuilt with the new layers.
    try { OC.clear(); tiles.clear(); jobs.clear(); farTiles.clear(); } catch (_) {}
  }
  return {install, styles: Object.keys(EXTRA)};
})();
