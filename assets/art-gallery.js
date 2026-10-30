/* The living gallery: World art's painted panoramas shown as an exhibition.
 * - On larger screens each painting hangs on a dark wall in a gilt frame,
 *   with a museum plaque below it (Frame can be turned off in Artworks).
 * - Depth: the painting eases with your pointer or the phone's tilt, and a
 *   near layer of motes, petals or fireflies drifts faster than the painting
 *   as it pans, so the scene reads in layers.
 * - Light follows your clock: a rosy dawn, soft shafts by day, golden hour
 *   from the right, a violet dusk, moonlight with stars and fireflies at night.
 * - Tour: every couple of minutes the gallery glides on to the next tradition
 *   (Artworks → Tour off to stay).
 * It wraps LivingArt.draw and changes nothing in the paintings themselves. */
const ArtGallery = (() => {
  const KEY = 'art-gallery', TOUR = 110;
  const NEAR = {gond: ['#f3d27a', '#e9b65a'], warli: ['#f3e6c6', '#e8d6ad'], madhubani: ['#f2b705', '#e9628e'], kangra: ['#f6c7d2', '#fff0c8'], japan: ['#f4bfcf', '#fbe1e8'], china: ['#f4f0e2', '#e6e1cf'], mexico: ['#f39a2b', '#f2c14e']};
  let opts = {frame: true, tour: true};
  try { Object.assign(opts, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch (_) {} };
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x)), smooth = x => { x = clamp(0, x, 1); return x * x * (3 - 2 * x); };
  let off = null, wall = null, wallKey = '', hourOverride = null, tourAt = null, lastKey = '', lastPan = null;
  const tilt = {x: 0, y: 0, tx: 0, ty: 0};
  const sprites = new Map();

  // Where the painting hangs: the whole canvas, or inside a frame on the wall.
  function layout(W, H) {
    const framed = opts.frame && typeof cv !== 'undefined' && cv.clientWidth >= 700 && cv.clientHeight >= 480;
    if (!framed) return {framed, x: 0, y: 0, w: W, h: H};
    const m = Math.round(Math.min(W, H) * .07), top = Math.max(Math.round(m * 1.15), Math.round(86 * W / cv.clientWidth)), bottom = Math.round(m * 1.75);   // clear of the bar
    return {framed, x: m, y: top, w: W - 2 * m, h: H - top - bottom, m};
  }
  function wallLayer(W, H, R) {
    const key = [W, H, R.x, R.y, R.w, R.h].join();
    if (wall && wallKey === key) return wall;
    wall = wall || document.createElement('canvas'); wall.width = W; wall.height = H; wallKey = key;
    const g = wall.getContext('2d');
    const bg = g.createRadialGradient(W / 2, -H * .15, H * .1, W / 2, H * .4, Math.hypot(W, H) * .75);
    bg.addColorStop(0, '#3d362e'); bg.addColorStop(.55, '#25211c'); bg.addColorStop(1, '#141210'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // A gallery light from above, falling on the frame.
    const spot = g.createRadialGradient(W / 2, R.y - R.m, 0, W / 2, R.y + R.h * .4, R.w * .7);
    spot.addColorStop(0, 'rgba(255,236,200,.16)'); spot.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = spot; g.fillRect(0, 0, W, H);
    const fw = Math.max(8, Math.round(R.m * .26));
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = fw * 2.6; g.shadowOffsetY = fw * .9;
    g.fillStyle = '#5a4428'; g.fillRect(R.x - fw, R.y - fw, R.w + fw * 2, R.h + fw * 2); g.restore();
    // Gilt moulding: a bright ridge between darker bevels, lit from the top.
    const gold = (x0, y0, x1, y1) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, '#6b5030'); q.addColorStop(.35, '#d9bb7a'); q.addColorStop(.55, '#a9844c'); q.addColorStop(1, '#4e3a20'); return q; };
    g.fillStyle = gold(0, R.y - fw, 0, R.y); g.fillRect(R.x - fw, R.y - fw, R.w + fw * 2, fw);
    g.fillStyle = gold(0, R.y + R.h + fw, 0, R.y + R.h); g.fillRect(R.x - fw, R.y + R.h, R.w + fw * 2, fw);
    g.fillStyle = gold(R.x - fw, 0, R.x, 0); g.fillRect(R.x - fw, R.y, fw, R.h);
    g.fillStyle = gold(R.x + R.w + fw, 0, R.x + R.w, 0); g.fillRect(R.x + R.w, R.y, fw, R.h);
    g.strokeStyle = 'rgba(255,240,200,.45)'; g.lineWidth = 1; g.strokeRect(R.x - fw + .5, R.y - fw + .5, R.w + fw * 2 - 1, R.h + fw * 2 - 1);
    g.strokeStyle = 'rgba(40,28,14,.8)'; g.lineWidth = 2; g.strokeRect(R.x - 1, R.y - 1, R.w + 2, R.h + 2);
    return wall;
  }
  function sprite(col, r) {
    const k = col + r; if (sprites.has(k)) return sprites.get(k);
    const s = document.createElement('canvas'); s.width = s.height = r * 4; const g = s.getContext('2d'), q = g.createRadialGradient(r * 2, r * 2, 0, r * 2, r * 2, r * 2);
    q.addColorStop(0, col); q.addColorStop(.35, col + 'cc'); q.addColorStop(1, col + '00'); g.fillStyle = q; g.fillRect(0, 0, r * 4, r * 4);
    sprites.set(k, s); return s;
  }

  /* ---- light from the clock ---- */
  function hour() { if (hourOverride !== null) return hourOverride; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  // Weights for dawn, day, golden hour, dusk and night at an hour of the day.
  function light(h = hour()) {
    const up = (a, b) => smooth((h - a) / (b - a)), w = {
      dawn: up(4.5, 6) * (1 - up(7.5, 9)), day: up(7.5, 9) * (1 - up(15.5, 17)), golden: up(15.5, 17) * (1 - up(18.5, 19.5)),
      dusk: up(18.5, 19.5) * (1 - up(20, 21)), night: 0
    };
    w.night = clamp(0, 1 - w.dawn - w.day - w.golden - w.dusk, 1);
    return w;
  }
  function paintLight(c, R, t, L, dpr) {
    c.save();
    if (L.night > .01) {   // moonlight: blue over everything, then stars in the upper sky
      c.globalCompositeOperation = 'multiply'; c.globalAlpha = L.night * .85; c.fillStyle = '#5d6ea8'; c.fillRect(R.x, R.y, R.w, R.h);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      for (let i = 0; i < 46; i++) {
        const x = R.x + ((i * 0.6180339 * 9973) % 1) * R.w, y = R.y + ((i * 0.41421 * 7919) % 1) * R.h * .3, tw = .5 + .5 * Math.sin(t * (1 + i % 5 * .3) + i);
        c.globalAlpha = L.night * (.25 + .55 * tw); c.fillStyle = '#fff8e6'; c.fillRect(x, y, dpr * (i % 7 ? 1 : 1.8), dpr * (i % 7 ? 1 : 1.8));
      }
      c.globalAlpha = 1;
    }
    const wash = (alpha, x0, x1, col) => { if (alpha < .005) return; const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, `rgba(${col},${alpha})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(R.x, R.y, R.w, R.h); };
    wash(L.dawn * .2, R.x, R.x + R.w * .8, '255,176,150');
    wash(L.golden * .24, R.x + R.w, R.x + R.w * .15, '255,168,72');
    if (L.dusk > .01) { const g = c.createLinearGradient(0, R.y, 0, R.y + R.h); g.addColorStop(0, `rgba(110,84,160,${.22 * L.dusk})`); g.addColorStop(.6, `rgba(255,140,96,${.12 * L.dusk})`); g.addColorStop(1, `rgba(60,40,80,${.15 * L.dusk})`); c.fillStyle = g; c.fillRect(R.x, R.y, R.w, R.h); }
    const shafts = L.day * .9 + L.dawn * .5 + L.golden * .6;
    if (shafts > .01) {   // soft light shafts that breathe and drift
      c.globalCompositeOperation = 'screen';
      for (let j = 0; j < 3; j++) {
        const x = R.x + R.w * (.18 + j * .27) + Math.sin(t * .05 + j * 1.7) * R.w * .04 + tilt.x * 4 * dpr, g = c.createLinearGradient(x, R.y, x + R.w * .25, R.y + R.h);
        const col = L.golden > L.day ? '255,206,140' : '255,244,214', a = shafts * (.05 + .025 * Math.sin(t * .13 + j));
        g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.35, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.beginPath(); c.moveTo(x, R.y); c.lineTo(x + R.w * .06, R.y); c.lineTo(x + R.w * .34, R.y + R.h); c.lineTo(x + R.w * .2, R.y + R.h); c.closePath(); c.fill();
      }
    }
    c.restore();
  }

  /* ---- the near layer ---- */
  const motes = Array.from({length: 28}, (_, i) => ({x: (i * .37) % 1, y: (i * .61) % 1, s: .6 + (i * .29) % .8, ph: i * 1.7, k: i % 2}));
  function near(c, R, key, t, dt, L, panDelta, dpr) {
    const cols = NEAR[key] || NEAR.gond, night = L.night > .5, wind = typeof SceneMotion !== 'undefined' ? SceneMotion.wind : 0;
    c.save(); c.beginPath(); c.rect(R.x, R.y, R.w, R.h); c.clip();
    for (const m of motes) {
      // Faster than the painting as it pans (closer to you), and with the tilt.
      m.x += (dt * (.006 + wind * .01) + Math.sin(t * .2 + m.ph) * dt * .004) - panDelta / R.w * (1.6 + m.s);
      m.y += dt * (night ? Math.sin(t * .4 + m.ph) * .01 : .012 * m.s) ;
      m.x = ((m.x % 1) + 1) % 1; if (m.y > 1.05) m.y = -.05; if (m.y < -.05) m.y = 1.05;
      const x = R.x + m.x * R.w + tilt.x * 18 * dpr * m.s, y = R.y + m.y * R.h + tilt.y * 12 * dpr * m.s, r = Math.round((night ? 2.2 : 2.6 + m.s * 2.6) * dpr);
      c.globalAlpha = night ? .35 + .65 * Math.pow(.5 + .5 * Math.sin(t * 1.4 + m.ph * 3), 3) : .22 + .3 * m.s;
      c.drawImage(sprite(night ? '#fff1a0' : cols[m.k], r), x - r * 2, y - r * 2);
    }
    c.restore();
  }

  /* ---- drawing ---- */
  function wrap() {
    const base = LivingArt.draw;
    LivingArt.draw = function (c, key, w, h, position, t, dt, seed) {
      const R = layout(w, h), dpr = typeof DPR === 'number' ? DPR : 1;
      tilt.x += (tilt.tx - tilt.x) * Math.min(1, dt * 2.5); tilt.y += (tilt.ty - tilt.y) * Math.min(1, dt * 2.5);
      if (!off) off = document.createElement('canvas');
      const pw = Math.round(R.w * 1.03), ph = Math.round(R.h * 1.03);   // a little larger, so the tilt never shows an edge
      if (off.width !== pw || off.height !== ph) { off.width = pw; off.height = ph; }
      const drew = base.call(this, off.getContext('2d'), key, pw, ph, position, t, dt, seed);
      if (!drew) return drew;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (R.framed) c.drawImage(wallLayer(w, h, R), 0, 0); else c.clearRect(0, 0, w, h);
      const dx = (pw - R.w) / 2 + tilt.x * 8 * dpr, dy = (ph - R.h) / 2 + tilt.y * 6 * dpr;
      c.drawImage(off, clamp(0, dx, pw - R.w), clamp(0, dy, ph - R.h), R.w, R.h, R.x, R.y, R.w, R.h);
      // How far the painting panned since the last frame (for the near layer's parallax).
      const im = LivingArt.collection[key] && imageFor(key), pan = im && im.naturalWidth ? panX(im, pw, ph, position, seed) : 0;
      const panDelta = lastPan === null || key !== lastKey ? 0 : pan - lastPan; lastPan = pan;
      const L = light();
      paintLight(c, R, t, L, dpr);
      near(c, R, key, t, dt, L, panDelta, dpr);
      if (R.framed) {   // a soft inner shadow where the painting meets the frame
        const s = Math.round(R.m * .12), edges = [[R.x, R.y, R.w, s, 0, 1], [R.x, R.y + R.h - s, R.w, s, 0, -1]];
        for (const [x, y, ww, hh, , dir] of edges) { const g = c.createLinearGradient(0, dir > 0 ? y : y + hh, 0, dir > 0 ? y + hh : y); g.addColorStop(0, 'rgba(20,14,6,.35)'); g.addColorStop(1, 'rgba(20,14,6,0)'); c.fillStyle = g; c.fillRect(x, y, ww, hh); }
      }
      c.restore();
      tour(key, t);
      lastKey = key;
      document.body.classList.toggle('gallery-framed', R.framed);
      return drew;
    };
  }
  const imgs = new Map();
  function imageFor(key) { if (!imgs.has(key)) { const im = new Image(); im.src = 'assets/' + LivingArt.collection[key].file; imgs.set(key, im); } return imgs.get(key); }
  // The same pan the painting uses (living-art.js), in canvas pixels.
  function panX(im, w, h, position, seed) { const height = h * (w / h < .85 ? 1.01 : 1.04), width = height * im.naturalWidth / im.naturalHeight; return (w - width) * (.5 + .46 * Math.sin(position * .0008 + (seed % 13 - 6) * .03)); }

  // The tour: after a while on one tradition, glide on to the next.
  function tour(key, t) {
    if (key !== lastKey || tourAt === null) tourAt = t;
    if (!opts.tour || typeof playing === 'undefined' || !playing || t - tourAt < TOUR) return;
    const keys = Object.keys(LivingArt.collection), next = keys[(keys.indexOf(key) + 1) % keys.length];
    tourAt = t;
    document.getElementById('sty').value = next;
    if (typeof setSeed === 'function') setSeed(seed, next);
  }

  /* ---- controls and the plaque ---- */
  const CSS = `body.gallery-framed.art-mode #art-caption{left:auto;right:calc(7vmin + 6px);bottom:calc(1.2vmin + 4px);border-radius:2px;background:#f2ebdd;border:1px solid #c9b994;box-shadow:0 6px 18px rgba(0,0,0,.45);padding:10px 16px 9px;max-width:min(420px,60vw)}
body.gallery-framed.art-mode #art-title{font-size:19px;margin-bottom:3px}body.gallery-framed.art-mode #art-medium{letter-spacing:.12em;text-transform:uppercase;font-size:9.5px;color:#6d6253}
#art-gallery-opts{display:flex;gap:6px;margin:-12px 0 20px;flex-wrap:wrap}#art-gallery-opts button{border:1px solid #75665044;border-radius:999px;min-height:40px;padding:6px 14px;background:transparent;color:#443d30;font:inherit;cursor:pointer}#art-gallery-opts button[aria-pressed=true]{background:#302f27;color:#f8eed9;border-color:#302f27}`;
  function controls() {
    const modal = document.getElementById('art-gallery'), after = document.getElementById('art-presentation'); if (!modal || !after) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    const row = document.createElement('div'); row.id = 'art-gallery-opts'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Gallery');
    for (const [k, label] of [['frame', 'Frame on the wall'], ['tour', 'Tour the traditions']]) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', String(opts[k]));
      b.addEventListener('click', () => { opts[k] = !opts[k]; b.setAttribute('aria-pressed', String(opts[k])); save(); tourAt = null; if (typeof wakeScene === 'function') wakeScene(); });
      row.append(b);
    }
    after.after(row);
  }
  function install() {
    if (typeof LivingArt === 'undefined') return;
    wrap(); controls();
    addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; tilt.tx = clamp(-1, (e.clientX / innerWidth - .5) * 2, 1); tilt.ty = clamp(-1, (e.clientY / innerHeight - .5) * 2, 1); }, {passive: true});
    addEventListener('deviceorientation', e => { if (e.gamma == null) return; tilt.tx = clamp(-1, e.gamma / 25, 1); tilt.ty = clamp(-1, (e.beta - 40) / 25, 1); }, {passive: true});
  }
  return {install, light, layout, options: () => ({...opts}), setHour: h => { hourOverride = h; }, TOUR};
})();
