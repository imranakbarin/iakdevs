/* Ambience for the painterly live-art styles (Kangra, Japan, China, Mexico):
   slow mist veils, cloud shadows drifting over the land and sun glints on open
   water. Everything is world-space and clock-driven, so it is continuous across
   chunk seams and a paused redraw is unchanged. The folk styles (Gond, Warli,
   Madhubani) keep their flat paper look on purpose. */
const ArtAmbience = (() => {
  function blob(c, x, y, rx, ry, rgb, a) {
    c.save(); c.translate(x, y); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = g; c.fillRect(-rx, -rx, 2 * rx, 2 * rx); c.restore();
  }
  // Cell i owns one drifting feature; cells tile the world, so nothing pops at seams.
  function each(xa, xb, cell, drift, salt, fn) {
    for (let i = Math.floor((xa - drift) / cell) - 1; i <= Math.ceil((xb - drift) / cell) + 1; i++)
      fn(i * cell + drift, mulberry32(hash(seed ^ salt, i)));
  }
  const mist = (c, xa, xb, t, y, rgb, a, speed = 5) =>
    each(xa, xb, 420, t * speed, 0xa3b + y, (x, r) => blob(c, x + r() * 210, y + r() * 26, 190 + r() * 150, 20 + r() * 16, rgb, a * (.6 + r() * .4)));
  function shadows(c, xa, xb, t, y0, y1) {
    c.save(); c.globalCompositeOperation = 'multiply';
    each(xa, xb, 780, t * 9, 0x5d0, (x, r) => blob(c, x + r() * 380, y0 + r() * (y1 - y0), 240 + r() * 120, 42 + r() * 20, '64,80,100', .11));
    c.restore();
  }
  function sparkle(c, xa, xb, t, y0, y1, a) {
    c.save(); c.strokeStyle = '#fffaf0'; c.lineWidth = 1.1;
    for (let i = Math.floor(xa / 23); i <= xb / 23; i++) {
      const r = mulberry32(hash(seed ^ 0x5e1, i)), x = i * 23 + r() * 23, y = y0 + r() * (y1 - y0);
      const s = Math.sin(t * (1.1 + r()) + r() * TAU);
      if (s < .55) continue;
      c.globalAlpha = (s - .55) * a * 2.2;
      c.beginPath(); c.moveTo(x - 4 - (y - y0) * .02, y); c.lineTo(x + 4 + (y - y0) * .02, y); c.stroke();
    }
    c.restore();
  }
  const scenes = {
    japan(c, xa, xb, t) { shadows(c, xa, xb, t, 330, 450); mist(c, xa, xb, t, 452, '246,238,214', .34); sparkle(c, xa, xb, t, 500, 632, .5); },
    china(c, xa, xb, t) { mist(c, xa, xb, t, 418, '238,232,216', .4, 3.5); mist(c, xa, xb, t, 470, '242,238,226', .45, 6); },
    kangra(c, xa, xb, t) { shadows(c, xa, xb, t, 470, 560); mist(c, xa, xb, t, 432, '233,226,200', .24); },
    mexico(c, xa, xb, t) { shadows(c, xa, xb, t, 390, 520); mist(c, xa, xb, t, 470, '255,240,206', .16, 4); }
  };
  function install() {
    for (const [key, draw] of Object.entries(scenes)) {
      const st = STYLES[key], base = st.anim;
      st.anim = function (c, xa, xb, t) { if (base) base.call(this, c, xa, xb, t); draw(c, xa, xb, t); };
    }
  }
  return {install};
})();
