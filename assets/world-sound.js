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
 * changes nothing; Cozy Worlds, Mushroom Island and Pip Run keep their own. */
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
    master = gain(0); master.connect(comp); comp.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    // Looping beds, all silent until a scene asks for them.
    const bed = (type, f, q) => {
      const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = gain(0, master);
      s.buffer = noise; s.loop = true; flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      s.connect(flt); flt.connect(g); s.start(0, rnd() * 1.5); return {g, flt};
    };
    beds = {
      road: bed('lowpass', 700, .5), wind: bed('bandpass', 650, .6), rain: bed('highpass', 2600, .4), waves: bed('lowpass', 550, .5),
      city: bed('lowpass', 260, .6), sand: bed('bandpass', 2800, .8), fountain: bed('bandpass', 1150, 1.4), river: bed('bandpass', 850, .7),
      breeze: bed('bandpass', 420, .5), insects: bed('bandpass', 5200, 6)
    };
    // The engine: two low saws through a soft filter.
    const flt = ac.createBiquadFilter(), g = gain(0, master); flt.type = 'lowpass'; flt.frequency.value = 260; flt.connect(g);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = o2.type = 'sawtooth';
    o1.frequency.value = 50; o2.frequency.value = 75; o1.connect(flt); o2.connect(flt); o1.start(); o2.start();
    eng = {g, flt, o1, o2, boost: 0};
    beds.engine = {g, flt};
    return true;
  }
  function gain(v, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function tone(freq, {t = ac.currentTime, type = 'sine', a = .005, d = .2, peak = .05, slide = 0} = {}) {
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
  const bell = (f, t, peak = .03, d = 1.2) => { tone(f, {t, d, peak}); tone(f * 2.76, {t, d: d * .4, peak: peak * .2}); tone(f * 5.4, {t, d: d * .15, peak: peak * .06}); };
  const chirps = (t, peak = .012) => { const f = 2600 + rnd() * 1500; for (let i = 0, n = 2 + (rnd() * 3 | 0); i < n; i++) tone(f * (1 + rnd() * .1), {t: t + i * .09, d: .06, peak, slide: 1.25}); };
  const crickets = t => { for (let i = 0; i < 3; i++) tone(4300 + rnd() * 200, {t: t + i * .06, d: .03, peak: .006}); };
  const set = (param, v, t, k = .4) => param.setTargetAtTime(v, t, k);

  /* ---------------- road trip ---------------- */
  const passing = new Map();
  function road(L, dt, t) {
    const a = roadAtmosphere.current || {}, p = roadPlaceTransition.current || [], s = playing && !drag ? clamp(0, speed / 40, 3) : 0;
    eng.boost += ((tripCue === 'Overtaking' ? 1 : 0) - eng.boost) * Math.min(1, dt * 2);
    const f = 32 + 20 * Math.min(s, 2) + 12 * eng.boost;
    set(eng.o1.frequency, f, t, .3); set(eng.o2.frequency, f * 1.5, t, .3); set(eng.flt.frequency, 200 + 90 * s + 120 * eng.boost, t, .3);
    L.engine = (s > 0 ? .035 + .02 * Math.min(s, 2) : .015) + .02 * eng.boost;
    const muffle = a.snow || 0, gust = .75 + .25 * Math.sin(t * .31) * Math.sin(t * .13 + 1);
    L.road = .06 * Math.min(s, 2) * (1 - .45 * muffle); set(beds.road.flt.frequency, 450 + 380 * Math.min(s, 2) - 250 * muffle, t);
    L.wind = (.02 + .03 * Math.min(s, 2) + .05 * (p[0] || 0) + .04 * (p[1] || 0) + .03 * (p[3] || 0)) * gust;
    set(beds.wind.flt.frequency, 600 + 500 * (p[1] || 0) - 150 * muffle, t);
    L.rain = .14 * (a.rain || 0);
    L.waves = .2 * (p[3] || 0) * (.55 + .45 * Math.sin(t * 2 * Math.PI * .09));
    L.city = .1 * (p[4] || 0);
    const dayish = clamp(0, 1 - (a.night || 0) - .8 * (a.rain || 0), 1);
    if (chance(22 * (a.rain || 0), dt)) tone(2000 + rnd() * 2600, {t, d: .02, peak: .01});
    if (chance(1.2 * (a.night || 0) * (1 - (p[4] || 0)), dt)) crickets(t);
    if (chance(.35 * ((p[2] || 0) + .4 * (p[0] || 0)) * dayish, dt)) chirps(t);
    if (chance(.05 * (p[3] || 0) * dayish, dt)) tone(1500, {t, a: .05, d: .5, peak: .012, slide: .7});        // a gull
    if (chance(.025 * (p[0] || 0) * dayish, dt)) tone(2600, {t, a: .04, d: .7, peak: .01, slide: .68});       // a hawk overhead
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
  let zenPrev = null, zenV = 0, ripples = 0;
  function zen(L, dt, t) {
    const d = typeof zenDistance === 'number' ? zenDistance : 0, v = zenPrev === null || d < zenPrev ? 0 : (d - zenPrev) / Math.max(dt, 1e-3);
    zenPrev = d; zenV += (v - zenV) * Math.min(1, dt * 3);
    L.sand = .09 * clamp(0, zenV / 34, 1.6);
    set(beds.sand.flt.frequency, 2400 + 600 * clamp(0, zenV / 34, 1.5), t);
    L.fountain = .045 * (.8 + .2 * Math.sin(t * 7.3) * Math.sin(t * 3.1));
    const g = typeof zenGarden === 'string' ? zenGarden : 'moss';
    L.breeze = g === 'autumn' ? .04 : .022;
    if (g === 'moss' && chance(.18, dt)) chirps(t, .01);
    if (g === 'autumn' && chance(.12, dt)) hiss({t, f: 3200, q: .6, a: .15, d: .5, peak: .02});       // leaves stirring
    if (g === 'moon') { if (chance(1.4, dt)) crickets(t); if (chance(.15, dt)) tone(130 + rnd() * 30, {t, type: 'triangle', a: .02, d: .18, peak: .02, slide: .8}); }
    if (chance(1 / 28, dt)) for (let i = 0; i < 4; i++) bell(hz(84 + [0, 2, 4, 7, 9][rnd() * 5 | 0]), t + i * .14 + rnd() * .05, .01, 1.3);
    if (chance(1 / 75, dt)) { tone(220, {t, a: .02, d: 6, peak: .03}); tone(220 * 2.71, {t, a: .02, d: 3, peak: .008}); }   // singing bowl
    const n = typeof zenRipples === 'object' ? zenRipples.length : 0;
    if (n > ripples) { hiss({t, type: 'lowpass', f: 1600, f2: 300, d: .25, peak: .06}); tone(520, {t: t + .05, d: .12, peak: .02, slide: .5}); }
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
  function voice(kind, f, t, len) {
    if (kind === 'flute') {   // breathy, with a slow vibrato
      const o = ac.createOscillator(), lfo = ac.createOscillator(), depth = gain(f * .006), g = gain(0, master);
      lfo.frequency.value = 5; lfo.connect(depth); depth.connect(o.frequency); o.frequency.value = f; o.connect(g);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.03, t + .14); g.gain.setTargetAtTime(.0001, t + len, .18);
      o.start(t); lfo.start(t); o.stop(t + len + 1); lfo.stop(t + len + 1);
      hiss({t, f: f * 2, q: 5, a: .1, d: len, peak: .004});
    } else if (kind === 'koto' || kind === 'zheng') {   // plucked, with a little bend into the note
      const o = ac.createOscillator(), g = gain(0, master); o.type = 'triangle';
      o.frequency.setValueAtTime(f * (kind === 'koto' ? 1.02 : .97), t); o.frequency.exponentialRampToValueAtTime(f, t + .06);
      o.connect(g); env(g, t, .004, .045, kind === 'koto' ? .9 : 1.3); o.start(t); o.stop(t + 1.5);
      tone(f * 2, {t, d: .25, peak: .01});
    } else {   // guitar-like: a bright pluck that darkens
      const o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = gain(0, master); o.type = 'sawtooth'; o.frequency.value = f;
      flt.type = 'lowpass'; flt.frequency.setValueAtTime(3200, t); flt.frequency.exponentialRampToValueAtTime(500, t + .4);
      o.connect(flt); flt.connect(g); env(g, t, .004, .035, 1.1); o.start(t); o.stop(t + 1.3);
    }
  }
  function art(L, dt, t) {
    const style = document.getElementById('sty').value, cfg = ART[style] || ART.gond, gust = .7 + .3 * Math.sin(t * .23);
    L.river = cfg.river; L.breeze = cfg.breeze * gust; L.insects = cfg.insects * (.6 + .4 * Math.sin(t * 9));
    if (chance(cfg.birds * .5, dt)) chirps(t, .01);
    // A short phrase every so often, never a constant tune.
    if (!nextPhrase) nextPhrase = t + 6;
    if (t >= nextPhrase) {
      const n = cfg.scale.length, notes = 3 + (rnd() * 4 | 0), step = cfg.voice === 'flute' ? .7 : .38;
      for (let i = 0; i < notes; i++) {
        deg = clamp(0, deg + [-2, -1, -1, 1, 1, 2][rnd() * 6 | 0], 2 * n - 1);
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
  return {install, toggle, on: () => on, state: () => ac ? ac.state : 'idle'};
})();
