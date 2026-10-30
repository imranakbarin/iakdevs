/* Pip Run sound. Everything is synthesized in the browser with WebAudio, so
 * there are no audio files:
 * - effects follow game events (footsteps that know the ground, jumps,
 *   landings, seeds that climb a scale as you chain them, springs, stomps);
 * - each biome has a quiet ambience bed with occasional details: birds in the
 *   meadow, ice tinkles on the ridge, wind chimes in the sky, drips in caves;
 *   after sunset the birds give way to crickets and now and then an owl;
 * - an optional, sparse score: a pad and a slow melody in each biome's own
 *   key and voice, a little fuller when the planner is tense.
 * Off by default, and browsers only allow sound after a tap or key anyway.
 * Kept soft on purpose: a gentle high shelf, lowpass and small room on the
 * master, no instant attacks, chimes in whole-number partials and an octave
 * lower than they were, birds and crickets below 4 kHz.
 * Sound is not part of the simulation, so plain randomness is fine here. */
const PipAudio = (() => {
  const MODES = ['off', 'fx', 'music'], LABELS = ['♪ Sound off', '♪ Sound on', '♪ Sound + music'];
  let mode = 0, ac = null, master, fxBus, ambBus, musBus, noise, amb = null, paused = false;
  try { mode = Math.max(0, MODES.indexOf(localStorage.getItem('pip-run:sound'))); } catch (_) {}
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x)), rnd = Math.random, hz = m => 440 * 2 ** ((m - 69) / 12);
  const quiet = p => { if (p && p.catch) p.catch(() => {}); };

  function boot() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master = gain(0); soften(master, comp); comp.connect(ac.destination);
    fxBus = gain(.8, master); ambBus = gain(0, master); musBus = gain(0, master);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    buildAmbience();
    return true;
  }
  function gain(v, to) { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  // Take the edge off the top (a high shelf, then a gentle lowpass) and send a
  // little to a small, dark room so chimes and plucks bloom instead of click.
  function soften(from, to) {
    const shelf = ac.createBiquadFilter(), low = ac.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 2600; shelf.gain.value = -7;
    low.type = 'lowpass'; low.frequency.value = 5600; low.Q.value = .5;
    from.connect(shelf); shelf.connect(low); low.connect(to);
    const rate = ac.sampleRate, n = Math.floor(rate * 1.8), ir = ac.createBuffer(2, n, rate), k = Math.exp(-2 * Math.PI * 2400 / rate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let y = 0; for (let i = 0; i < n; i++) { y = y * k + (rnd() * 2 - 1) * (1 - k); d[i] = y * (1 - i / n) ** 3; } }
    const room = ac.createConvolver(); room.buffer = ir;
    low.connect(room); room.connect(gain(.22, to));
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
  }
  function tone(freq, {t = ac.currentTime, type = 'sine', a = .01, d = .2, peak = .1, slide = 0, to = fxBus} = {}) {
    const o = ac.createOscillator(), g = gain(0, to);
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + a + d);
    o.connect(g); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + .05);
  }
  function hiss({t = ac.currentTime, type = 'bandpass', f = 1200, f2 = 0, q = 1, a = .003, d = .06, peak = .1, to = fxBus} = {}) {
    const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = gain(0, to);
    s.buffer = noise; flt.type = type; flt.Q.value = q; flt.frequency.setValueAtTime(f, t);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    s.connect(flt); flt.connect(g); env(g, t, a, peak, d); s.start(t, rnd() * 1.5); s.stop(t + a + d + .05);
  }
  // A soft chime in whole-number partials (2.76× and 5.4× rang glassy and sharp).
  function bell(f, t, peak = .06, d = .9, to = fxBus) {
    tone(f, {t, a: .008, d, peak, to}); tone(f * 2, {t, a: .008, d: d * .45, peak: peak * .14, to}); tone(f * 3, {t, a: .008, d: d * .2, peak: peak * .035, to});
  }
  const arp = (notes, base, gap, peak, t) => notes.forEach((n, i) => bell(base * 2 ** (n / 12), t + i * gap, peak, .6));
  // A gull's cry: a falling, wavering call.
  function gull(t, peak, to = fxBus) { tone(1250 + rnd() * 200, {t, a: .03, d: .24, peak: peak * .8, slide: .65, to}); tone(1100 + rnd() * 150, {t: t + .28, a: .03, d: .18, peak: peak * .55, slide: .72, to}); }
  // A filtered oscillator: horns and hums.
  function brass(f, {t, type = 'sawtooth', cut = 700, a = .06, d = .5, peak = .05, slide = 0, to = fxBus}) {
    const o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = gain(0, to);
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + a + d);
    flt.type = 'lowpass'; flt.frequency.value = cut; flt.Q.value = .8;
    o.connect(flt); flt.connect(g); env(g, t, a, peak, d); o.start(t); o.stop(t + a + d + .05);
  }
  // Each landmark's arrival scene has its own sound, timed to what is drawn
  // (the scene runs about 3.75 s).
  const SCENES = {
    meadow(t) {   // the gate: caps bounce, warm light fills the doorway, petals fly
      [0, .75, 1.5].forEach((dt, i) => tone(150 - i * 10, {t: t + .1 + dt, type: 'triangle', a: .01, d: .22, peak: .05 * (1 - i * .3), slide: 1.6}));
      [0, 4, 7, 11].forEach(n => tone(hz(65 + n), {t: t + .2, type: 'triangle', a: .5, d: 2.2, peak: .012}));
      for (let i = 0; i < 14; i++) hiss({t: t + .25 + i * .09 + rnd() * .05, f: 2200 + rnd() * 1200, q: 1.2, d: .09, peak: .007});
      for (let i = 0; i < 6; i++) bell(hz(72 + [0, 2, 4, 7, 9, 12][rnd() * 6 | 0]), t + .4 + i * .22 + rnd() * .06, .014, .9);
    },
    frost(t) {    // the spire: light climbs it, it flares, glints burst out
      tone(330, {t: t + .1, a: 1.9, d: .6, peak: .016, slide: 2.4}); tone(495, {t: t + .1, a: 1.9, d: .6, peak: .007, slide: 2.4});
      hiss({t: t + .1, f: 1200, f2: 3600, q: 2, a: 1.9, d: .3, peak: .01});
      bell(hz(79), t + 2.3, .045, 1.8); bell(hz(86), t + 2.32, .025, 1.5);
      for (let i = 0; i < 10; i++) bell(hz(84 + [0, 3, 7, 10, 12, 15][rnd() * 6 | 0]), t + 2.45 + i * .08 + rnd() * .04, .01, .6);
    },
    sky(t) {      // the harbour: a horn, then the airship's propeller fading off
      brass(147, {t: t + .15, d: .5, peak: .05}); brass(185, {t: t + .15, d: .5, peak: .03});
      brass(147, {t: t + .85, d: .9, peak: .05}); brass(220, {t: t + .85, d: .9, peak: .025});
      const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = gain(0, fxBus), lfo = ac.createOscillator(), depth = gain(.012, g.gain);
      s.buffer = noise; s.loop = true; flt.type = 'bandpass'; flt.frequency.setValueAtTime(240, t + .3); flt.frequency.exponentialRampToValueAtTime(420, t + 3.6); flt.Q.value = 1.5;
      lfo.type = 'square'; lfo.frequency.setValueAtTime(14, t + .3); lfo.frequency.exponentialRampToValueAtTime(22, t + 3.6); lfo.connect(depth);
      s.connect(flt); flt.connect(g); env(g, t + .3, .6, .03, 3); s.start(t + .3); s.stop(t + 4); lfo.start(t + .3); lfo.stop(t + 4);
    },
    coast(t) {    // the lighthouse: its foghorn, the lamp's chime, the gulls taking off
      brass(98, {t: t + .1, a: .15, d: 1.5, peak: .05, cut: 420}); brass(147, {t: t + .1, a: .15, d: 1.5, peak: .02, cut: 420});
      bell(hz(76), t + .45, .03, 1.6); bell(hz(83), t + .5, .02, 1.3);
      for (let i = 0; i < 4; i++) gull(t + .55 + i * .28 + rnd() * .08, .022);
      hiss({t: t + .2, type: 'lowpass', f: 600, f2: 1400, a: .8, d: 1.6, peak: .03});
    },
    caves(t) {    // the heart: a low hum that swells as its rings pulse out
      tone(55, {t, a: 1.2, d: 2.4, peak: .05}); tone(82.4, {t, a: 1.2, d: 2.4, peak: .025}); tone(110, {t: t + .4, type: 'triangle', a: 1, d: 2, peak: .012});
      [0, .7, 1.4].forEach((dt, i) => { tone(hz(69 - i * 5), {t: t + .05 + dt, a: .02, d: 1.1, peak: .03, slide: .7}); bell(hz(69 + [0, 3, 7][i]), t + .05 + dt, .02, 1.4); });
    }
  };

  /* ---------------- effects ---------------- */
  const SEED = [0, 2, 4, 7, 9, 12, 14, 16];
  const FX = {
    step({surface, v = 1}, t) {
      const k = .5 + .5 * v;
      if (surface === 'grass') hiss({t, type: 'lowpass', f: 900, d: .035, peak: .045 * k});
      else if (surface === 'snow') { for (let i = 0; i < 3; i++) hiss({t: t + i * .012, f: 1100 + rnd() * 900, q: 2.5, d: .018, peak: .03 * k}); hiss({t, type: 'lowpass', f: 500, d: .04, peak: .02 * k}); }
      else if (surface === 'moss') { hiss({t, type: 'lowpass', f: 450, d: .05, peak: .035 * k}); tone(hz(72 + [0, 4, 7, 11][rnd() * 4 | 0]), {t: t + .01, d: .25, peak: .004 * k}); }
      else if (surface === 'ice') { hiss({t, f: 2200, q: 1.5, d: .025, peak: .03 * k}); tone(1300 + rnd() * 300, {t, d: .03, peak: .004 * k}); }
      else if (surface === 'cloud') hiss({t, type: 'lowpass', f: 350, d: .05, peak: .04 * k});
      else if (surface === 'sand') { hiss({t, f: 1500 + rnd() * 500, q: 1.2, d: .045, peak: .022 * k}); hiss({t, type: 'lowpass', f: 420, d: .05, peak: .028 * k}); }
      else if (surface === 'crystal') { tone(hz(72 + [0, 3, 5, 7, 10][rnd() * 5 | 0]), {t, d: .1, peak: .007 * k}); hiss({t, f: 2400, q: 1.5, d: .02, peak: .01 * k}); }
      else if (surface === 'wood') { tone(170 + rnd() * 30, {t, type: 'triangle', d: .03, peak: .035 * k}); hiss({t, f: 900, q: 2, d: .03, peak: .025 * k}); }
      else hiss({t, f: 1500, q: 1.5, d: .03, peak: .035 * k});
    },
    jump(o, t) { tone(240, {t, d: .13, peak: .05, slide: 1.9}); hiss({t, f: 1300, d: .05, peak: .015}); },
    land({impact = 3}, t) { const k = clamp(0, impact / 6, 1); hiss({t, type: 'lowpass', f: 380 + 320 * k, d: .06 + .06 * k, peak: .04 + .09 * k}); },
    seed({streak = 0}, t) { bell(523 * 2 ** (SEED[streak % SEED.length] / 12), t, .035, .45); },
    bump(o, t) { tone(230, {t, type: 'triangle', d: .06, peak: .09, slide: .7}); hiss({t, f: 700, q: 4, d: .04, peak: .05}); },
    smash(o, t) { hiss({t, type: 'lowpass', f: 1100, f2: 300, d: .25, peak: .12}); tone(120, {t, d: .15, peak: .08, slide: .5}); },
    sprout(o, t) { arp([0, 4, 7, 12], 440, .08, .04, t); },
    grow(o, t) { arp([0, 4, 7, 12, 16], 392, .07, .04, t); },
    shrink(o, t) { arp([12, 7, 4, 0], 392, .07, .032, t); },
    stomp({chain = 1}, t) {   // a thump and a squish, a boing, and a chime that climbs with a chain of stomps
      tone(95, {t, d: .1, peak: .12, slide: .6}); hiss({t, type: 'lowpass', f: 900, f2: 250, d: .09, peak: .07});
      tone(260, {t: t + .01, type: 'triangle', d: .16, peak: .07, slide: 2.3});
      bell(440 * 2 ** (SEED[Math.min(chain, 8) - 1] / 12), t + .04, .035, .45);
    },
    spring(o, t) { tone(200, {t, d: .32, peak: .09, slide: 3.2}); tone(300, {t, type: 'triangle', d: .22, peak: .03, slide: 2.4}); },
    tumble(o, t) { tone(520, {t, d: .6, peak: .04, slide: .4}); },
    crumble(o, t) { hiss({t, f: 500, f2: 180, q: 2, d: .2, peak: .07}); tone(140 + rnd() * 40, {t, type: 'triangle', d: .05, peak: .03}); },
    talk({n = 12}, t) {   // Pip's voice: a soft, low murmur, a syllable for every few letters
      const k = Math.max(2, Math.min(6, Math.round(n / 6))), base = 400 + rnd() * 60;
      for (let i = 0; i < k; i++) tone(base * 2 ** (([0, 2, 4, 5, 7][rnd() * 5 | 0] - 2) / 12), {t: t + i * .09, a: .015, d: .06, peak: .011, slide: rnd() < .5 ? 1.06 : .95});
    },
    splash(o, t) { hiss({t, type: 'lowpass', f: 1800, f2: 300, d: .5, peak: .08}); for (let i = 0; i < 4; i++) tone(420 + rnd() * 380, {t: t + .08 + i * .07, d: .07, peak: .009, slide: 1.5}); },
    spit(o, t) { hiss({t, f: 1600, q: 1.2, d: .06, peak: .03}); tone(420, {t, d: .05, peak: .018, slide: .6}); },
    arrive({mark}, t) {
      if (SCENES[mark]) { SCENES[mark](t); arp([0, 4, 7, 12], 392, .13, .03, t + (mark === 'frost' ? 2.3 : .05)); }   // the scene leads, the fanfare answers
      else { arp([0, 4, 7, 12, 16], 392, .14, .045, t); [0, 4, 7].forEach(n => tone(hz(60 + n), {t: t + .55, a: .3, d: 1.6, peak: .018})); }
    },
    find(o, t) { bell(523, t, .035, .8); bell(784, t + .14, .035, 1); },
    place(o, t) { tone(500, {t, d: .07, peak: .04, slide: 1.3}); },
    refuse(o, t) { tone(190, {t, d: .14, peak: .045, slide: .8}); },
    gotcha(o, t) { arp([0, 7, 12], 523, .08, .035, t); },
    ui(o, t) { tone(660, {t, a: .008, d: .06, peak: .03}); },
    rustle({snow}, t) { for (let i = 0; i < 5; i++) hiss({t: t + i * .05 + rnd() * .03, f: snow ? 2600 : 1800 + rnd() * 900, q: 1, d: .08, peak: snow ? .009 : .014}); }
  };
  function fx(name, o) {
    if (!ac || !mode || paused || ac.state !== 'running' || !FX[name]) return;
    FX[name](o || {}, ac.currentTime);
  }

  /* ---------------- ambience ---------------- */
  const LEVEL = {meadow: .14, frost: .07, sky: .09, caves: .2, coast: .16};
  let spellBeds = null;
  // A spell of weather, now and then: thunder far off in a squall, chimes of
  // light in a sunbreak, drops echoing in the caves.
  const SPELLS = {
    squall: [.05, t => { hiss({t, type: 'lowpass', f: 160, f2: 60, a: .3, d: 2.4, peak: .07, to: ambBus}); tone(48, {t, a: .4, d: 2, peak: .03, to: ambBus}); }],
    sunbreak: [.3, t => { for (let i = 0; i < 4; i++) bell(hz(79 + [0, 4, 7, 11, 12][rnd() * 5 | 0]), t + i * .12, .009, 1.4, ambBus); }],
    drip: [.9, t => { const f = 800 + rnd() * 600; tone(f, {t, a: .006, d: .08, peak: .018, slide: .55, to: ambBus}); tone(f * .98, {t: t + .32, a: .006, d: .08, peak: .007, slide: .55, to: ambBus}); }],
    shower: [.4, t => hiss({t, type: 'lowpass', f: 2200 + rnd() * 900, d: .04, peak: .008, to: ambBus})]
  };
  function buildAmbience() {
    const bed = (type, f, q) => {
      const s = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = gain(0, ambBus);
      s.buffer = noise; s.loop = true; flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      s.connect(flt); flt.connect(g); s.start(); return {g, flt};
    };
    amb = {meadow: bed('lowpass', 380, .5), frost: bed('bandpass', 900, .7), sky: bed('bandpass', 600, .4), caves: bed('lowpass', 180, .7), coast: bed('lowpass', 520, .6)};
    spellBeds = {rain: bed('bandpass', 1500, .5), gust: bed('bandpass', 520, 1.1)};   // weather: rain on everything, wind that howls
    for (const f of [55, 82.4]) { const o = ac.createOscillator(), g = gain(.05, amb.caves.g); o.frequency.value = f; o.connect(g); o.start(); }
  }
  // Occasional details, at a rate per second, scaled by how present the biome is.
  const DETAIL = {
    meadow: [.18, t => { const f = 1900 + rnd() * 900; for (let i = 0, n = 2 + (rnd() * 3 | 0); i < n; i++) tone(f * (1 + rnd() * .08), {t: t + i * .1, a: .015, d: .07, peak: .008, slide: 1.18, to: ambBus}); }],
    frost: [.15, t => bell(hz(84 + [0, 2, 3, 7, 9][rnd() * 5 | 0]), t, .01, 1, ambBus)],
    sky: [.1, t => { for (let i = 0; i < 3; i++) bell(hz(76 + [0, 2, 4, 7, 9][rnd() * 5 | 0]), t + i * .2 + rnd() * .06, .012, 1.5, ambBus); }],
    coast: [.12, t => gull(t, .01, ambBus)],
    caves: [.25, t => { const f = 700 + rnd() * 500; tone(f, {t, a: .006, d: .1, peak: .022, slide: .5, to: ambBus}); tone(f, {t: t + .28, a: .006, d: .1, peak: .008, slide: .5, to: ambBus}); }]
  };

  // After sunset, outdoors: crickets, and now and then an owl.
  const NIGHT = [
    [.4, t => { const f = 3600 + rnd() * 300; for (let i = 0; i < 3; i++) tone(f, {t: t + i * .065, a: .008, d: .03, peak: .003, to: ambBus}); }],
    [.035, t => { tone(380, {t, a: .06, d: .32, peak: .012, slide: .9, to: ambBus}); tone(360, {t: t + .45, a: .06, d: .45, peak: .01, slide: .88, to: ambBus}); }]
  ];

  /* ---------------- score ---------------- */
  const KEYS = {
    meadow: {root: 60, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], voice: 'pluck'},
    frost: {root: 62, scale: [0, 2, 3, 7, 9], chords: [[0, 3, 7], [5, 9, 12], [3, 7, 10], [7, 10, 14]], voice: 'bell'},
    sky: {root: 65, scale: [0, 2, 4, 6, 9], chords: [[0, 4, 7], [2, 6, 9], [0, 4, 7], [7, 11, 14]], voice: 'flute'},
    caves: {root: 57, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], voice: 'mallet'},
    coast: {root: 64, scale: [0, 2, 4, 7, 9], chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], voice: 'pluck'}
  };
  const STEP = 60 / 76 / 2;   // eighth notes at 76 bpm
  let nextStep = 0, step = 0, deg = 7, key = 'meadow';
  function voice(kind, f, t) {
    if (kind === 'pluck') {   // a filtered string: bright for a moment, then warm
      const o = ac.createOscillator(), flt = ac.createBiquadFilter(), g = gain(0, musBus);
      o.type = 'triangle'; o.frequency.value = f; flt.type = 'lowpass'; flt.Q.value = .3;
      flt.frequency.setValueAtTime(Math.min(2400, f * 3), t); flt.frequency.exponentialRampToValueAtTime(Math.max(220, f * 1.1), t + .35);
      o.connect(flt); flt.connect(g); env(g, t, .012, .045, .8); o.start(t); o.stop(t + .9);
    }
    else if (kind === 'bell') bell(f, t, .03, 1.3, musBus);
    else if (kind === 'flute') { tone(f, {t, a: .1, d: .55, peak: .03, to: musBus}); hiss({t, f: f * 1.5, q: 4, a: .06, d: .2, peak: .003, to: musBus}); }
    else { tone(f, {t, a: .01, d: .4, peak: .045, to: musBus}); tone(f * 2, {t, a: .01, d: .08, peak: .006, to: musBus}); }   // a soft mallet
  }
  function pad(K, chord, t, tension) {
    const dur = 16 * STEP, flt = ac.createBiquadFilter(), g = gain(0, musBus);
    flt.type = 'lowpass'; flt.frequency.value = 700 + 900 * tension; flt.connect(g);
    for (const n of chord) { const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(K.root - 12 + n); o.connect(flt); o.start(t); o.stop(t + dur + 1.6); }
    env(g, t, 1.4, .03, dur);
  }
  function score(s, t) {
    if (nextStep < t) nextStep = t + .1;
    while (nextStep < t + .3) {
      const bar = Math.floor(step / 8), beat = step % 8, K0 = KEYS[key];
      if (beat === 0 && bar % 2 === 0) { key = KEYS[s.biome] ? s.biome : key; pad(KEYS[key], KEYS[key].chords[(bar / 2) % 4], nextStep, s.tension); }
      const K = KEYS[key] || K0, rest = bar % 8 >= 6;   // two quiet bars in every eight
      if (!rest && rnd() < (beat % 4 === 0 ? .6 : .3) + .25 * s.tension) {
        deg = clamp(0, deg + [-2, -1, -1, 1, 1, 2, 0][rnd() * 7 | 0], 9);   // under two octaves: no shrill top notes
        const n = K.scale.length;
        voice(K.voice, hz(K.root + 12 * Math.floor(deg / n) + K.scale[deg % n]), nextStep);
      }
      nextStep += STEP; step++;
    }
  }

  // Once per drawn frame: s = {biomes: {meadow: weight, ...}, biome, tension, wind, night, dt}.
  function update(s) {
    if (!ac || !mode || paused || ac.state !== 'running') return;
    const t = ac.currentTime;
    ambBus.gain.setTargetAtTime(1, t, .5);
    musBus.gain.setTargetAtTime(mode === 2 ? .5 * (1 + .4 * s.tension) : 0, t, .5);
    const swell = .5 + .5 * Math.sin(t * .55) * Math.sin(t * .23 + 1);   // waves rolling in and drawing back
    for (const k of Object.keys(amb)) amb[k].g.gain.setTargetAtTime((s.biomes[k] || 0) * LEVEL[k] * (k === 'sky' ? .6 + .6 * Math.abs(s.wind) : k === 'coast' ? .35 + .65 * swell : 1), t, k === 'coast' ? .4 : .6);
    amb.frost.flt.frequency.setTargetAtTime(900 + 500 * Math.sin(t * .4), t, .3);
    amb.sky.flt.frequency.setTargetAtTime(500 + 400 * Math.abs(s.wind), t, .3);
    amb.coast.flt.frequency.setTargetAtTime(380 + 700 * swell, t, .4);
    const sp = s.spell || {}, w = sp.w || 0, wet = sp.kind === 'shower' ? .2 : sp.kind === 'squall' ? .3 : 0;
    spellBeds.rain.g.gain.setTargetAtTime(wet * w, t, .8);
    spellBeds.gust.g.gain.setTargetAtTime((sp.kind === 'blizzard' ? .22 : sp.kind === 'squall' ? .08 : 0) * w, t, .8);
    spellBeds.gust.flt.frequency.setTargetAtTime(420 + 380 * (.5 + .5 * Math.sin(t * .7) * Math.sin(t * .31)), t, .3);
    if (SPELLS[sp.kind] && rnd() < SPELLS[sp.kind][0] * s.dt * w) SPELLS[sp.kind][1](t + .02);
    const night = s.night || 0, outdoors = 1 - (s.biomes.caves || 0);
    for (const [k, [rate, play]] of Object.entries(DETAIL)) if (rnd() < rate * s.dt * (s.biomes[k] || 0) * (k === 'meadow' ? 1 - night : 1)) play(t + .02);
    for (const [rate, play] of NIGHT) if (rnd() < rate * s.dt * night * outdoors) play(t + .02);
    if (mode === 2) score(s, t);
  }
  function apply() {
    if (!ac) return;
    const t = ac.currentTime;
    master.gain.setTargetAtTime(mode ? .9 : 0, t, .05);
    if (mode === 2) nextStep = 0;
    if (mode && !paused && ac.state !== 'running') quiet(ac.resume());
  }
  // A tap on the sound button cycles off → effects and ambience → with music.
  function cycle() {
    mode = (mode + 1) % 3;
    try { localStorage.setItem('pip-run:sound', MODES[mode]); } catch (_) {}
    if (mode) boot();
    apply(); fx('ui');
    return mode;
  }
  // The first tap or key of a visit, when sound was left on last time.
  function unlock() { if (mode && boot()) apply(); }
  function pause(on) {
    paused = on;
    if (!ac) return;
    if (on) quiet(ac.suspend()); else if (mode) { quiet(ac.resume()); nextStep = 0; }
  }
  return {fx, update, cycle, unlock, pause, label: () => LABELS[mode], mode: () => mode, state: () => ac ? ac.state : 'idle'};
})();
