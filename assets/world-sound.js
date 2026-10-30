/* Soundscapes for World art, Road trip and Zen garden. Everything is
 * synthesized with WebAudio (no audio files) and follows what is on screen:
 * - Road trip: an engine that follows the speed and pulls harder when
 *   overtaking, road and wind noise, rain, night crickets, waves on the
 *   coast, birds in the forest, a far horn in the city, and a whoosh as an
 *   oncoming car passes.
 * - Zen garden: sand hissing under the steel ball (it follows the ball's
 *   speed), the bamboo fountain, koi splashes where you tap, and now and then
 *   a wind chime or a singing bowl; crickets and frogs by moonlight.
 * - World art: river and wind beds and birds, and every so often a short
 *   phrase in a voice suited to the tradition on screen.
 * Off by default (♪ in the bar, or M). It reads the page's own state and
 * changes nothing; Cozy Worlds, Mushroom Island and Pip Run keep their own.
 * Kept soft on purpose: everything passes a gentle high shelf and lowpass and
 * a small room, attacks are never instant, chimes ring in whole-number
 * partials, plucks are filtered strings and birds sit below 3 kHz. */
const WorldSound = (() => {
  let on = false, ac = null, master, noise, beds = null, eng = null, raf = 0, last = 0, idle = 0;
  try { on = localStorage.getItem('world-sound') === 'on'; } catch (_) {}
  const rnd = Math.random, clamp = (a, x, b) => Math.max(a, Math.min(b, x)), hz = m => 440 * 2 ** ((m - 69) / 12);
  const quiet = p => { if (p && p.catch) p.catch(() => {}); };
  const chance = (rate, dt) => rnd() < rate * dt;

  function boot() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master = gain(0); soften(master, comp); comp.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    // Looping beds, all silent until a scene asks for them.
    const bed = (type, f, q) => {
      const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = gain(0, master);
      s.buffer = noise; s.loop = true; flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      s.connect(flt); flt.connect(g); s.start(0, rnd() * 1.5); return {g, flt};
    };
    beds = {
      road: bed('lowpass', 700, .5), wind: bed('bandpass', 650, .6), rain: bed('bandpass', 1500, .5), waves: bed('lowpass', 550, .5),
      city: bed('lowpass', 260, .6), sand: bed('bandpass', 1100, .7), fountain: bed('bandpass', 1000, 1.2), river: bed('bandpass', 850, .7),
      breeze: bed('bandpass', 420, .5), insects: bed('bandpass', 3000, 2)
    };
    // The engine: two low saws through a soft filter.
    const flt = ac.createBiquadFilter(), g = gain(0, master); flt.type = 'lowpass'; flt.frequency.value = 260; flt.Q.value = .5; flt.connect(g);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = o2.type = 'sawtooth';
    o1.frequency.value = 50; o2.frequency.value = 75; o1.connect(flt); o2.connect(flt); o1.start(); o2.start();
    eng = {g, flt, o1, o2, boost: 0};
    beds.engine = {g, flt};
    return true;
  }
  function gain(v, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  // The softening chain: take the edge off the top (a high shelf, then a gentle
  // lowpass) and send a little to a small, dark room so notes bloom instead of click.
  function soften(from, to) {
    const shelf = ac.createBiquadFilter(), low = ac.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 2600; shelf.gain.value = -7;
    low.type = 'lowpass'; low.frequency.value = 5200; low.Q.value = .5;
    from.connect(shelf); shelf.connect(low); low.connect(to);
    const rate = ac.sampleRate, n = Math.floor(rate * 2.2), ir = ac.createBuffer(2, n, rate), k = Math.exp(-2 * Math.PI * 2200 / rate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let y = 0; for (let i = 0; i < n; i++) { y = y * k + (rnd() * 2 - 1) * (1 - k); d[i] = y * (1 - i / n) ** 3; } }
    const room = ac.createConvolver(); room.buffer = ir;
    low.connect(room); room.connect(gain(.3, to));
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function tone(freq, {t = ac.currentTime, type = 'sine', a = .012, d = .2, peak = .05, slide = 0} = {}) {
    const o = ac.createOscillator(), g = gain(0, master);
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + a + d);
    o.connect(g); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + .05);
  }
  function hiss({t = ac.currentTime, type = 'bandpass', f = 1200, f2 = 0, q = 1, a = .01, d = .2, peak = .05} = {}) {
    const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = gain(0, master);
    s.buffer = noise; flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, t);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    s.connect(flt); flt.connect(g); env(g, t, a, peak, d); s.start(t, rnd() * 1.5); s.stop(t + a + d + .05);
  }
  // A soft chime: whole-number partials (the old 2.76× and 5.4× ones rang glassy and sharp).
  const bell = (f, t, peak = .03, d = 1.2) => { tone(f, {t, a: .01, d, peak}); tone(f * 2, {t, a: .01, d: d * .45, peak: peak * .12}); tone(f * 3, {t, a: .01, d: d * .2, peak: peak * .03}); };
  const chirps = (t, peak = .006) => { const f = 1900 + rnd() * 900; for (let i = 0, n = 2 + (rnd() * 3 | 0); i < n; i++) tone(f * (1 + rnd() * .08), {t: t + i * .1, a: .015, d: .07, peak, slide: 1.18}); };
  const crickets = t => { for (let i = 0; i < 3; i++) tone(3700 + rnd() * 150, {t: t + i * .07, a: .008, d: .03, peak: .003}); };
  const set = (param, v, t, k = .4) => param.setTargetAtTime(v, t, k);

  /* ---------------- road trip ---------------- */
  const passing = new Map();
  function road(L, dt, t) {
    const a = roadAtmosphere.current || {}, p = roadPlaceTransition.current || [], s = playing && !drag ? clamp(0, speed / 40, 3) : 0;
    eng.boost += ((tripCue === 'Overtaking' ? 1 : 0) - eng.boost) * Math.min(1, dt * 2);
    const f = 32 + 20 * Math.min(s, 2) + 12 * eng.boost;
    set(eng.o1.frequency, f, t, .3); set(eng.o2.frequency, f * 1.5, t, .3); set(eng.flt.frequency, 200 + 90 * s + 120 * eng.boost, t, .3);
    L.engine = (s > 0 ? .028 + .016 * Math.min(s, 2) : .012) + .016 * eng.boost;
    const muffle = a.snow || 0, gust = .75 + .25 * Math.sin(t * .31) * Math.sin(t * .13 + 1);
    L.road = .06 * Math.min(s, 2) * (1 - .45 * muffle); set(beds.road.flt.frequency, 450 + 380 * Math.min(s, 2) - 250 * muffle, t);
    L.wind = (.02 + .03 * Math.min(s, 2) + .05 * (p[0] || 0) + .04 * (p[1] || 0) + .03 * (p[3] || 0)) * gust;
    set(beds.wind.flt.frequency, 600 + 500 * (p[1] || 0) - 150 * muffle, t);
    L.rain = .1 * (a.rain || 0);
    L.waves = .2 * (p[3] || 0) * (.55 + .45 * Math.sin(t * 2 * Math.PI * .09));
    L.city = .1 * (p[4] || 0);
    const dayish = clamp(0, 1 - (a.night || 0) - .8 * (a.rain || 0), 1);
    if (chance(9 * (a.rain || 0), dt)) hiss({t, type: 'lowpass', f: 1400 + rnd() * 800, a: .004, d: .04, peak: .012});   // drops on the roof, soft

    if (chance(1.2 * (a.night || 0) * (1 - (p[4] || 0)), dt)) crickets(t);
    if (chance(.35 * ((p[2] || 0) + .4 * (p[0] || 0)) * dayish, dt)) chirps(t);
    if (chance(.05 * (p[3] || 0) * dayish, dt)) tone(1250, {t, a: .06, d: .5, peak: .008, slide: .72});        // a gull
    if (chance(.025 * (p[0] || 0) * dayish, dt)) tone(1700, {t, a: .06, d: .7, peak: .006, slide: .7});       // a hawk overhead
    if (chance(.02 * (p[4] || 0), dt)) { tone(392, {t, type: 'triangle', a: .02, d: .25, peak: .008}); tone(494, {t: t + .02, type: 'triangle', a: .02, d: .25, peak: .006}); }
    // An oncoming car passing the touring car.
    const snap = RoadTraffic.snapshot(journey * 42);
    for (const c of snap.cars) if (c.front) {
      const before = passing.get(c.id);
      if (before !== undefined && before > 48 && c.distance <= 48) hiss({t, f: 1400, f2: 380, q: .9, a: .08, d: .55, peak: .07});
      passing.set(c.id, c.distance);
    }
    if (passing.size > 20) passing.clear();
  }

  /* ---------------- zen garden ---------------- */
  let zenPrev = null, zenV = 0, ripples = 0, rakePrev = null, rakeV = 0;
  function zen(L, dt, t) {
    const d = typeof zenDistance === 'number' ? zenDistance : 0, v = zenPrev === null || d < zenPrev ? 0 : (d - zenPrev) / Math.max(dt, 1e-3);
    zenPrev = d; zenV += (v - zenV) * Math.min(1, dt * 3);
    // Raking by hand hisses too.
    const r = typeof zenRakeLen === 'number' ? zenRakeLen : 0, rv = rakePrev === null || r < rakePrev ? 0 : (r - rakePrev) / Math.max(dt, 1e-3);
    rakePrev = r; rakeV += (rv - rakeV) * Math.min(1, dt * 6);
    L.sand = .06 * clamp(0, zenV / 34, 1.6) + .05 * clamp(0, rakeV / 300, 1.5);
    set(beds.sand.flt.frequency, 900 + 300 * clamp(0, zenV / 34, 1.5), t);
    L.fountain = .035 * (.8 + .2 * Math.sin(t * 1.3) * Math.sin(t * .7));
    const g = typeof zenGarden === 'string' ? zenGarden : 'moss';
    L.breeze = g === 'autumn' ? .04 : .022;
    if (g === 'moss' && chance(.12, dt)) chirps(t, .005);
    if (g === 'autumn' && chance(.12, dt)) hiss({t, f: 1800, q: .6, a: .2, d: .6, peak: .014});       // leaves stirring
    if (g === 'moon') { if (chance(.6, dt)) crickets(t); if (chance(.15, dt)) tone(130 + rnd() * 30, {t, a: .03, d: .2, peak: .018, slide: .8}); }
    if (chance(1 / 28, dt)) for (let i = 0; i < 4; i++) bell(hz(72 + [0, 2, 4, 7, 9][rnd() * 5 | 0]), t + i * .22 + rnd() * .06, .01, 1.8);   // a wind chime
    if (chance(1 / 75, dt)) { tone(220, {t, a: .02, d: 6, peak: .03}); tone(220 * 2.71, {t, a: .02, d: 3, peak: .008}); }   // singing bowl
    const n = typeof zenRipples === 'object' ? zenRipples.length : 0;
    if (n > ripples) { hiss({t, type: 'lowpass', f: 1200, f2: 300, d: .3, peak: .045}); tone(440, {t: t + .05, d: .16, peak: .014, slide: .55}); }
    ripples = n;
  }

  /* ---------------- world art ---------------- */
  const ART = {
    gond: {river: .05, breeze: .02, birds: .3, insects: .012, voice: 'flute', root: 62, scale: [0, 2, 4, 7, 9]},
    warli: {river: .03, breeze: .03, birds: .25, insects: .008, voice: 'flute', root: 62, scale: [0, 2, 4, 7, 9]},
    madhubani: {river: .045, breeze: .02, birds: .3, insects: .006, voice: 'flute', root: 64, scale: [0, 2, 4, 7, 9]},
    kangra: {river: .06, breeze: .025, birds: .22, insects: .004, voice: 'flute', root: 60, scale: [0, 2, 4, 7, 9]},
    japan: {river: .05, breeze: .035, birds: .15, insects: 0, voice: 'koto', root: 64, scale: [0, 1, 5, 7, 8]},
    china: {river: .055, breeze: .03, birds: .18, insects: 0, voice: 'zheng', root: 62, scale: [0, 2, 4, 7, 9]},
    mexico: {river: .02, breeze: .03, birds: .4, insects: .018, voice: 'guitar', root: 57, scale: [0, 2, 4, 5, 7, 9, 11]}
  };
  let nextPhrase = 0, deg = 4;
  // A plucked string, filtered: the brightness falls away after the attack the way a real string's does.
  function pluck(f, t, {bend = 1, decay = 1.1, bright = 3, peak = .03} = {}) {
    const o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = gain(0, master);
    o.type = 'triangle'; o.frequency.setValueAtTime(f * bend, t); if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f, t + .09);
    flt.type = 'lowpass'; flt.Q.value = .3; flt.frequency.setValueAtTime(Math.min(2600, f * bright), t); flt.frequency.exponentialRampToValueAtTime(Math.max(220, f * 1.1), t + .4);
    o.connect(flt); flt.connect(g); env(g, t, .012, peak, decay); o.start(t); o.stop(t + decay + .1);
  }
  function voice(kind, f, t, len) {
    if (kind === 'flute') {   // breathy, with a slow vibrato
      const o = ac.createOscillator(), lfo = ac.createOscillator(), depth = gain(f * .006), g = gain(0, master);
      lfo.frequency.value = 5; lfo.connect(depth); depth.connect(o.frequency); o.frequency.value = f; o.connect(g);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.024, t + .18); g.gain.setTargetAtTime(.0001, t + len, .22);
      o.start(t); lfo.start(t); o.stop(t + len + 1.2); lfo.stop(t + len + 1.2);
      hiss({t, f: f * 1.5, q: 4, a: .12, d: len, peak: .0018});
    } else if (kind === 'koto') pluck(f, t, {bend: 1.01, decay: 1.1, bright: 3, peak: .028});   // a little bend into the note
    else if (kind === 'zheng') pluck(f, t, {bend: .985, decay: 1.5, bright: 2.6, peak: .028});
    else pluck(f, t, {decay: 1.2, bright: 3.5, peak: .026});   // a nylon guitar, warm rather than bright
  }
  function art(L, dt, t) {
    const style = document.getElementById('sty').value, cfg = ART[style] || ART.gond, gust = .7 + .3 * Math.sin(t * .23);
    L.river = cfg.river; L.breeze = cfg.breeze * gust; L.insects = cfg.insects * .45 * (.7 + .3 * Math.sin(t * 1.7));
    if (chance(cfg.birds * .4, dt)) chirps(t, .005);
    // A short phrase every so often, never a constant tune.
    if (!nextPhrase) nextPhrase = t + 6;
    if (t >= nextPhrase) {
      const n = cfg.scale.length, notes = 3 + (rnd() * 4 | 0), step = cfg.voice === 'flute' ? .7 : .38;
      for (let i = 0; i < notes; i++) {
        deg = clamp(0, deg + [-2, -1, -1, 1, 1, 2][rnd() * 6 | 0], n + (n >> 1));   // about an octave and a half: no shrill top notes
        voice(cfg.voice, hz(cfg.root + 12 * Math.floor(deg / n) + cfg.scale[deg % n]), t + .05 + i * step * (.85 + rnd() * .3), step * (i === notes - 1 ? 1.8 : .9));
      }
      nextPhrase = t + 14 + rnd() * 14;
    }
  }

  /* ---------------- loop ---------------- */
  const SCENES = {road, zen, art};
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0; last = now;
    if (!ac) return;
    const mode = typeof modeBtn !== 'undefined' ? modeBtn.value : '', scene = SCENES[mode];
    const live = on && scene && (typeof playing === 'undefined' || playing) && !document.hidden;
    const t = ac.currentTime;
    if (!live) {
      master.gain.setTargetAtTime(0, t, .15);
      if ((idle += dt) > 1 && ac.state === 'running') quiet(ac.suspend());
      return;
    }
    idle = 0;
    if (ac.state !== 'running') { quiet(ac.resume()); return; }
    master.gain.setTargetAtTime(.9, t, .3);
    const L = {};
    scene(L, dt, t);
    for (const [k, b] of Object.entries(beds)) set(b.g.gain, L[k] || 0, t, .5);
  }
  function label() { return innerWidth < 600 ? (on ? '♪ On' : '♪ Off') : on ? '♪ Sound on' : '♪ Sound off'; }
  function sync() {
    const b = document.getElementById('sound');
    if (b) { b.textContent = label(); b.setAttribute('aria-pressed', String(on)); }
  }
  function toggle() {
    on = !on;
    try { localStorage.setItem('world-sound', on ? 'on' : 'off'); } catch (_) {}
    if (on && boot() && ac.state !== 'running') quiet(ac.resume());
    sync();
  }
  function install() {
    sync();
    const b = document.getElementById('sound');
    if (b) b.addEventListener('click', toggle);
    addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && SCENES[modeBtn.value] && !(e.target && e.target.closest && e.target.closest('input,select,textarea'))) toggle(); });
    addEventListener('resize', sync);
    // Sound left on last time starts with the first tap or key (browsers require one).
    const unlock = () => { if (on && boot() && ac.state !== 'running') quiet(ac.resume()); };
    for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, unlock, {passive: true});
    if (!raf) raf = requestAnimationFrame(loop);
  }
  // One-off sounds: the horn plays even with the soundscape off (a tap asked for it); the arrival chime only with it on.
  function cue(kind) {
    if (kind !== 'honk' && !on) return;
    if (!boot()) return;
    quiet(ac.resume());
    const t = ac.currentTime + .02;
    if (kind === 'honk') {
      const out = gain(1); out.connect(ac.destination);
      for (const [at, len] of [[0, .16], [.22, .32]]) for (const f of [392, 494]) {
        const o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = gain(0, out);
        o.type = 'sawtooth'; o.frequency.value = f; flt.type = 'lowpass'; flt.frequency.value = 1100; flt.Q.value = .5; o.connect(flt); flt.connect(g);
        g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(.06, t + at + .02); g.gain.setValueAtTime(.06, t + at + len - .04); g.gain.exponentialRampToValueAtTime(.0001, t + at + len);
        o.start(t + at); o.stop(t + at + len + .05);
      }
    } else if (kind === 'chime') [67, 71, 74].forEach((m, i) => bell(hz(m), t + i * .2, .028, 1.8));
  }
  return {install, toggle, cue, on: () => on, state: () => ac ? ac.state : 'idle'};
})();
