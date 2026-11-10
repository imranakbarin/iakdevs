// New Toy Town: sound. Everything is synthesised with Web Audio (no files) and only starts when the visitor turns it on.
// `soundPlan` and `chimeDue` are pure and tested in Node; `createSound` builds the audio graph and is tested against a fake AudioContext.

const clamp01 = v => Math.max(0, Math.min(1, v));

// What the town should sound like right now. state: {dark 0..1, rain 0..1, season, snow, zoom 0..1 (1 = close)}.
export function soundPlan(s) {
  const day = 1 - s.dark, rain = clamp01(s.rain), winter = s.season === 'winter', calm = 1 - rain;
  return {
    wind: .05 + .05 * rain + (winter ? .04 : 0),
    waves: .06 + .02 * rain,
    rain: winter ? 0 : rain * (.45 + .15 * clamp01(s.zoom ?? .5)),
    birds: day * calm * (winter ? .12 : s.season === 'spring' ? 1 : .7),   // chirps per second at most ~0.9
    crickets: s.dark > .6 && rain < .3 && !winter ? (s.dark - .6) / .4 * (1 - rain / .3) : 0
  };
}

// Strikes of the clock tower bell when the hour turns (7:00 to 21:00 only, never in the small hours).
export function chimeDue(prev, now) {
  const a = Math.floor(prev), b = Math.floor(now); if (a === b) return 0;
  const h = b % 24; if (h < 7 || h > 21) return 0;
  return ((h + 11) % 12) + 1;
}

export function createSound(opts = {}) {
  const AC = opts.AudioContext || (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null), rnd = opts.random || Math.random;
  const me = {enabled: false, supported: !!AC, started: 0};
  let ctx = null, master = null, gains = {}, noise = null, nextChirp = 1, nextCricket = 1, lastHour = null, wasMoving = false;

  function noiseBuffer() { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1; return b; }
  function bed(type, freq, q, lfoRate) {   // a looped noise through a filter into its own gain; an LFO makes it breathe
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(master); src.start();
    if (lfoRate) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = .35; l.connect(lg); lg.connect(g.gain); l.start(); }
    return g;
  }
  function init() {
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); noise = noiseBuffer();
    gains = {wind: bed('lowpass', 520, .7, .13), waves: bed('lowpass', 230, .5, .09), rain: bed('highpass', 1500, .4, 0)};
    me.started++;
  }
  // a little tone with an attack and a decay, optionally sliding in pitch
  function tone(freq, t, dur, peak, o = {}) {
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.linearRampToValueAtTime(o.to, t + dur * .8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + Math.min(.02, dur / 4)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(master); osc.start(t); osc.stop(t + dur + .05); return osc;
  }
  me.chirp = () => { const t = ctx.currentTime, f = 2400 + rnd() * 1800, n = 2 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) tone(f * (1 + i * .04), t + i * .09, .07, .03, {to: f * (1.25 + rnd() * .2)}); };
  me.cricket = () => { const t = ctx.currentTime; for (let i = 0; i < 4; i++) tone(4300, t + i * .06, .035, .012, {type: 'triangle'}); };
  me.bell = n => { const t0 = ctx.currentTime; for (let i = 0; i < Math.min(12, n); i++) { const t = t0 + i * .9; for (const [m, p] of [[1, .09], [2.76, .04], [5.4, .02]]) tone(523 * m, t, 2.2 / m ** .3, p); } };
  me.whistle = () => { const t = ctx.currentTime; tone(660, t, .32, .05, {to: 700}); tone(880, t + .36, .5, .05, {to: 860}); };
  me.blip = () => { if (!me.enabled) return; const t = ctx.currentTime; tone(880, t, .09, .04, {to: 1320}); };

  me.toggle = on => {
    on = on === undefined ? !me.enabled : !!on; if (on === me.enabled || !AC) return me.enabled;
    if (on) { if (!ctx) init(); if (ctx.resume) ctx.resume(); master.gain.setTargetAtTime(.8, ctx.currentTime, .3); }
    else if (ctx) { master.gain.setTargetAtTime(0, ctx.currentTime, .15); }
    me.enabled = on; return on;
  };
  me.pause = hidden => { if (!ctx) return; if (hidden && ctx.suspend) ctx.suspend(); else if (!hidden && me.enabled && ctx.resume) ctx.resume(); };
  // call every frame with the town's state and the time passed
  me.update = (s, dt) => {
    if (!me.enabled || !ctx) return; const plan = soundPlan(s), t = ctx.currentTime;
    gains.wind.gain.setTargetAtTime(plan.wind, t, .5); gains.waves.gain.setTargetAtTime(plan.waves, t, .5); gains.rain.gain.setTargetAtTime(plan.rain, t, .6);
    if ((nextChirp -= dt) <= 0) { nextChirp = plan.birds > .02 ? (.8 + rnd() * 2.4) / plan.birds : 2; if (plan.birds > .02) me.chirp(); }
    if ((nextCricket -= dt) <= 0) { nextCricket = plan.crickets > .02 ? (.35 + rnd() * .5) / plan.crickets : 2; if (plan.crickets > .02) me.cricket(); }
    if (lastHour !== null) { const n = chimeDue(lastHour, s.hour); if (n) me.bell(n); } lastHour = s.hour;
    if (s.trainMoving && !wasMoving) me.whistle(); wasMoving = !!s.trainMoving;
  };
  return me;
}
