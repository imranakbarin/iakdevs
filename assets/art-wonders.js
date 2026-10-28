/* Wonders for the live art styles. The endless landscape is cut into long
 * stretches (about a minute and a half of drifting); most hold one rare sight,
 * seeded and never the same twice in a row: a migrating flock, kites on the
 * wind, or a passing shower that leaves a rainbow; fireflies when the theme is
 * dark; petals in Japan, rising lanterns in China and papel picado garlands in
 * Mexico. Each is drawn in the style's own ink and palette (Warli in white
 * line). Everything is a pure function of seed, stretch and scene time, so a
 * paused redraw is unchanged. A quiet line under the style's name says what
 * is passing. */
const ArtWonders = (() => {
  const SPAN = 3600, COMMON = ['flock', 'kites', 'shower'];
  const EXTRA = {japan: ['petals'], china: ['lanterns'], mexico: ['banners']};
  const NAMES = {flock: 'A flock passes over', kites: 'Kites on the wind', shower: 'A passing shower, then a rainbow', fireflies: 'Fireflies in the dark',
    petals: 'Petals on the wind', lanterns: 'Lanterns rising', banners: 'Papel picado for a fiesta'};
  const RAINBOW = ['#E63B2E', '#F28C28', '#F7B32B', '#2E933C', '#2B59C3'];
  function pickRaw(style, i) {
    const r = mulberry32(hash(seed ^ 0x77d, i));
    if (i < 1 || r() < .3) return null;
    const list = COMMON.concat(EXTRA[style] || [], isDark() ? ['fireflies'] : []);
    return list[Math.floor(r() * list.length)];
  }
  // Compared with the previous stretch's final choice (which may itself have
  // moved on), so no two neighbours ever match.
  const memo = new Map();
  function wonderAt(style, i) {
    const key = style + ':' + seed + ':' + isDark() + ':' + i;
    if (memo.has(key)) return memo.get(key);
    let w = pickRaw(style, i);
    if (w && w === (i > 1 ? wonderAt(style, i - 1) : null)) { const list = COMMON.concat(EXTRA[style] || []); w = list[(list.indexOf(w) + 1) % list.length]; }
    if (memo.size > 4000) memo.clear();
    memo.set(key, w); return w;
  }
  const ink = () => T.mark || T.ink, white = style => style === 'warli';   // mark stays visible in dark themes
  const fill = (style, k) => style === 'gond' ? GOND_PAIRS[k % GOND_PAIRS.length][k % 2] : style === 'kangra' || style === 'japan' || style === 'china' ? null : BRIGHT[k % BRIGHT.length];
  const edgeFade = (x, a) => Math.max(0, Math.min(1, (x - a) / 500, (a + SPAN - x) / 500));

  function bird(c, style, x, y, s, flap, k) {
    const w = 11 * s, lift = (4 + flap * 5) * s;
    c.beginPath(); c.moveTo(x - w, y - lift); c.quadraticCurveTo(x - w * .45, y - lift * .2, x, y); c.quadraticCurveTo(x + w * .45, y - lift * .2, x + w, y - lift);
    c.strokeStyle = ink(); c.lineWidth = 1.6 * s; c.stroke();
    const f = fill(style, k);
    if (f && !white(style)) { c.fillStyle = f; c.beginPath(); c.ellipse(x, y + .6 * s, 4.2 * s, 2.3 * s, 0, 0, TAU); c.fill(); c.lineWidth = .8 * s; c.stroke(); }
  }
  function kite(c, style, x, y, s, k, t) {
    const a = Math.sin(t * .9 + k) * .25, f = white(style) ? null : fill(style, k + 2) || ['#c8553d', '#2a6f97', '#d9a441'][k % 3];
    c.save(); c.translate(x, y); c.rotate(a);
    c.beginPath(); c.moveTo(0, -24 * s); c.lineTo(17 * s, 0); c.lineTo(0, 30 * s); c.lineTo(-17 * s, 0); c.closePath();
    if (f) { c.fillStyle = f; c.fill(); }
    c.strokeStyle = ink(); c.lineWidth = 1.5 * s; c.stroke();
    c.beginPath(); c.moveTo(0, -24 * s); c.lineTo(0, 30 * s); c.moveTo(-17 * s, 0); c.lineTo(17 * s, 0); c.lineWidth = .9 * s; c.stroke();
    if (style === 'gond' && f) { c.fillStyle = T.light; for (let d = 0; d < 6; d++) { c.beginPath(); c.arc(((d % 3) - 1) * 6 * s, (d < 3 ? -8 : 10) * s, 1.3 * s, 0, TAU); c.fill(); } }
    c.beginPath(); c.moveTo(0, 30 * s);
    for (let j = 1; j <= 5; j++) c.lineTo(Math.sin(t * 2.4 + j + k) * 7 * s, 30 * s + j * 13 * s);
    c.lineWidth = 1 * s; c.stroke();
    for (let j = 1; j <= 4; j++) { const bx = Math.sin(t * 2.4 + j + k) * 7 * s, by = 30 * s + j * 13 * s; c.beginPath(); c.moveTo(bx - 4 * s, by - 3 * s); c.lineTo(bx + 4 * s, by + 3 * s); c.moveTo(bx + 4 * s, by - 3 * s); c.lineTo(bx - 4 * s, by + 3 * s); c.stroke(); }
    c.restore();
  }
  function cloud(c, style, x, y, s) {
    c.beginPath(); c.moveTo(x - 170 * s, y + 20 * s);
    for (let j = 0; j <= 6; j++) { const cx = x - 150 * s + j * 50 * s; c.arc(cx, y + 4 * s, (26 + (j % 3) * 9) * s, Math.PI, 0); }
    c.lineTo(x + 170 * s, y + 20 * s); c.closePath();
    c.fillStyle = white(style) ? 'rgba(248,239,226,.18)' : T.light; c.fill(); c.strokeStyle = ink(); c.lineWidth = 1.8 * s; c.stroke();
  }

  function draw(style, c, xa, xb, t) {
    const top = typeof topY === 'number' ? topY : 0;
    for (let i = Math.floor(xa / SPAN); i <= Math.floor(xb / SPAN); i++) {
      const w = wonderAt(style, i); if (!w) continue;
      const a0 = i * SPAN, r = mulberry32(hash(seed ^ 0x77e, i));
      c.save();
      if (w === 'flock') {
        const n = 7 + Math.floor(r() * 5), lead = a0 + 300 + ((t * 70 + r() * 3000) % (SPAN - 600)), y = top + 45 + r() * 40 + Math.sin(t * .3) * 10;
        for (let k = 0; k < n; k++) {
          const row = Math.ceil(k / 2), side = k % 2 ? -1 : 1, x = lead - row * 40, yy = y + side * row * 18;
          c.globalAlpha = edgeFade(x, a0); if (c.globalAlpha > 0) bird(c, style, x, yy, 1.7, Math.sin(t * 5 + k * .7), k);
        }
      } else if (w === 'kites') {
        for (let k = 0; k < 5; k++) {
          const x = a0 + 480 + k * 620 + r() * 120, y = top + 110 + r() * 90 + Math.sin(t * .8 + k) * 12;
          c.globalAlpha = edgeFade(x, a0); if (c.globalAlpha <= 0) continue;
          c.strokeStyle = ink(); c.lineWidth = .7; c.globalAlpha *= .55; c.beginPath(); c.moveTo(x, y + 30); c.quadraticCurveTo(x - 40, y + 160, x - 70, top + 360); c.stroke();
          c.globalAlpha = edgeFade(x, a0); kite(c, style, x, y, 1.1, k, t);
        }
      } else if (w === 'shower') {
        const cx = a0 + 500 + (t * 26 % (SPAN - 1000)), cy = top + 70, bow = a0 + SPAN * .55;
        // The rainbow follows the shower: it shows once the cloud has passed it.
        const after = Math.max(0, Math.min(1, (cx - bow - 250) / 400));
        if (after > 0) {
          // Small, high and translucent: the anim layer sits over the landscape,
          // so a big bow would pass in front of trees instead of behind them.
          const by = top + 330;
          c.globalAlpha = .5 * after * edgeFade(bow, a0); c.lineWidth = 7;
          RAINBOW.forEach((col, j) => { c.strokeStyle = white(style) ? 'rgba(248,239,226,.75)' : col; c.beginPath(); c.arc(bow, by, 230 - j * 7, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); });
          c.strokeStyle = ink(); c.lineWidth = 1; for (const rr of [234, 198]) { c.beginPath(); c.arc(bow, by, rr, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); }
        }
        c.globalAlpha = edgeFade(cx, a0);
        if (c.globalAlpha > 0) {
          c.strokeStyle = white(style) ? T.ink : style === 'gond' || style === 'madhubani' || style === 'mexico' ? WATER[0] : ink(); c.lineWidth = 1.3;
          for (let k = 0; k < 44; k++) { const x = cx - 150 + (k * 37) % 300, y = cy + 30 + ((t * 230 + k * 61) % 300); c.globalAlpha = edgeFade(cx, a0) * .6 * Math.min(1, (330 - (y - cy)) / 80); c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5, y + 13); c.stroke(); }
          c.globalAlpha = edgeFade(cx, a0); cloud(c, style, cx, cy, 1);
        }
      } else if (w === 'fireflies') {
        for (let k = 0; k < 36; k++) {
          const x = a0 + 200 + r() * (SPAN - 400) + Math.sin(t * .4 + k) * 14, y = top + 300 + r() * 160 + Math.cos(t * .35 + k * 1.3) * 10;
          const glow = Math.pow(.5 + .5 * Math.sin(t * 1.6 + k * 2.1), 3);
          c.globalAlpha = edgeFade(x, a0) * (.2 + .8 * glow); c.fillStyle = '#fff1a8'; c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill();
          c.globalAlpha *= .35; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill();
        }
      } else if (w === 'petals') {
        for (let k = 0; k < 110; k++) {
          const x = a0 + ((k * 211 + t * 30) % SPAN), y = top + ((k * 53 + t * (30 + k % 5 * 6)) % 520), rot = t * (1 + k % 3) + k;
          c.globalAlpha = edgeFade(x, a0) * .9; c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, .45 + .4 * Math.abs(Math.sin(rot)));
          c.fillStyle = '#f2b8c6'; c.beginPath(); c.ellipse(0, 0, 5, 3, 0, 0, TAU); c.fill(); c.strokeStyle = ink(); c.lineWidth = .5; c.stroke(); c.restore();
        }
      } else if (w === 'lanterns') {
        for (let k = 0; k < 18; k++) {
          const x = a0 + 300 + ((k * 191) % (SPAN - 600)) + Math.sin(t * .3 + k) * 10, rise = (t * 14 + k * 47) % 520, y = top + 470 - rise;
          c.globalAlpha = edgeFade(x, a0) * Math.min(1, rise / 60, (520 - rise) / 90); if (c.globalAlpha <= 0) continue;
          c.fillStyle = 'rgba(255,190,90,.3)'; c.beginPath(); c.arc(x, y, 16, 0, TAU); c.fill();
          c.fillStyle = '#d9472b'; c.beginPath(); c.ellipse(x, y, 7, 9, 0, 0, TAU); c.fill(); c.strokeStyle = ink(); c.lineWidth = 1; c.stroke();
          c.fillStyle = '#f2c14e'; c.fillRect(x - 3.5, y + 8, 7, 3); c.fillRect(x - 3.5, y - 11, 7, 2.5);
        }
      } else if (w === 'banners') {
        for (let g = 0; g < 3; g++) {
          const x1 = a0 + 400 + g * 1100, x2 = x1 + 720, y1 = top + 70 + g * 8, sag = 46;
          c.globalAlpha = Math.min(edgeFade(x1, a0), edgeFade(x2, a0)); if (c.globalAlpha <= 0) continue;
          c.strokeStyle = ink(); c.lineWidth = 1.1; c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, y1 + sag * 2, x2, y1); c.stroke();
          for (let k = 1; k < 18; k++) {
            const u = k / 18, x = x1 + (x2 - x1) * u, y = y1 + 4 * sag * u * (1 - u), sway = Math.sin(t * 1.8 + k + g) * .12;
            c.save(); c.translate(x, y); c.rotate(sway); c.fillStyle = BRIGHT[(k + g * 3) % BRIGHT.length];
            c.beginPath(); c.moveTo(-13, 0); c.lineTo(13, 0); c.lineTo(13, 24); for (let z = 0; z < 5; z++) c.lineTo(13 - (z + .5) * 5.2, z % 2 ? 24 : 19); c.lineTo(-13, 24); c.closePath(); c.fill();
            c.fillStyle = T.light; c.globalAlpha *= .9; for (const [dx, dy] of [[-6, 7], [0, 12], [6, 7]]) { c.beginPath(); c.arc(dx, dy, 2.2, 0, TAU); c.fill(); }
            c.restore();
          }
        }
      }
      c.restore();
    }
  }
  // The caption line under the style's name.
  let line = null, shown = '', until = 0;
  function caption(style, xa, xb, t) {
    const i = Math.floor((xa + xb) / 2 / SPAN), w = wonderAt(style, i), name = w ? NAMES[w] : '';
    if (!line) { const cap = document.getElementById('art-caption'); if (!cap) return; line = document.createElement('span'); line.id = 'art-moment'; line.style.cssText = 'display:block;font:italic 12px/1.5 Georgia,serif;opacity:0;transition:opacity 1.2s;margin-top:3px'; cap.append(line); }
    if (name && name !== shown) { shown = name; line.textContent = name; line.style.opacity = '.85'; until = t + 9; }
    else if (!name) shown = '';
    if (t > until && line.style.opacity !== '0') line.style.opacity = '0';
  }
  function install() {
    // Painted artworks and other modes do not run the live layer: hide the line there.
    setInterval(() => { if (line && (typeof artPresentation !== 'undefined' && artPresentation !== 'live' || typeof modeBtn !== 'undefined' && modeBtn.value !== 'art')) { line.style.opacity = '0'; shown = ''; } }, 1000);
    for (const [key, st] of Object.entries(STYLES)) {
      const base = st.anim;
      st.anim = function (c, xa, xb, t) { if (base) base.call(this, c, xa, xb, t); draw(key, c, xa, xb, t); caption(key, xa, xb, t); };
    }
  }
  // Where a stretch's wonder is at time t (world x), for tests and tools.
  function where(style, i, t) {
    const w = wonderAt(style, i), a0 = i * SPAN, r = mulberry32(hash(seed ^ 0x77e, i));
    if (w === 'flock') { r(); return a0 + 300 + ((t * 70 + r() * 3000) % (SPAN - 600)) - 60; }
    if (w === 'shower') return a0 + 500 + (t * 26 % (SPAN - 1000));
    return a0 + (w === 'kites' ? 480 + 620 : w === 'banners' ? 400 + 360 : SPAN / 2);
  }
  return {install, wonderAt, where, SPAN};
})();
