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

// The voices of the new life: hens clucking in the yard, a dog barking, a cat mewing, dolphins chirping as they leap, the whale's song as she blows,
// the dwarfs' chime as they come out and the tink of their picks. Pure: `s` is what is happening ({zoom 0..1, hens, dogRun, cats, leap, spout, dwarfs}), `t` the timers
// (newWildTimers()), and the result is a list of [cue, volume]. The ones on the ground are only heard when the camera is close.
export const newWildTimers = () => ({hen: 2, dog: 9, cat: 16, tink: 3, leap: false, spout: false, dwarfs: 0});
export function wildDue(s, t, dt, rnd = Math.random) {
  const out = [], near = clamp01(s.zoom ?? .5);
  if ((t.hen -= dt) <= 0) { t.hen = 3 + rnd() * 6; if (s.hens && near > .3) out.push(['cluck', .4 + .6 * near]); }
  if ((t.dog -= dt) <= 0) { t.dog = 14 + rnd() * 20; if (s.dogRun && near > .45) out.push(['bark', .4 + .6 * near]); }
  if ((t.cat -= dt) <= 0) { t.cat = 25 + rnd() * 35; if (s.cats && near > .55) out.push(['meow', .4 + .6 * near]); }
  if (s.leap && !t.leap) out.push(['dolphin', .45 + .55 * near]); t.leap = !!s.leap;
  if (s.spout && !t.spout) out.push(['whale', .5 + .3 * near]); t.spout = !!s.spout;
  if ((s.dwarfs || 0) > t.dwarfs) out.push(['dwarf', .7]); t.dwarfs = s.dwarfs || 0;
  if ((t.tink -= dt) <= 0) { t.tink = 2.5 + rnd() * 3.5; if (s.dwarfs && near > .3) out.push(['tink', .4 + .5 * near]); }
  return out;
}

export function createSound(opts = {}) {
  const AC = opts.AudioContext || (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null), rnd = opts.random || Math.random;
  const me = {enabled: false, supported: !!AC, started: 0};
  const wildTimers = newWildTimers(); let ctx = null, master = null, gains = {}, noise = null, nextChirp = 1, nextCricket = 1, lastHour = null, wasMoving = false, lastAt = null;

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
  me.stationBell = () => { const t = ctx.currentTime; for (let i = 0; i < 4; i++) { tone(1175, t + i * .42, .38, .05); tone(880, t + i * .42 + .2, .3, .035); } };   // ding-dong as the train pulls in
  me.cluck = (v = 1) => { const t = ctx.currentTime, f = 480 + rnd() * 120, n = 2 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) tone(f * (1 - i * .04), t + i * .075, .06, .035 * v, {type: 'square', to: f * .7}); };
  me.bark = (v = 1) => { const t = ctx.currentTime; for (let i = 0; i < 2; i++) tone(320, t + i * .22, .13, .06 * v, {type: 'sawtooth', to: 170}); };
  me.meow = (v = 1) => { const t = ctx.currentTime; tone(620, t, .22, .035 * v, {to: 1020}); tone(1020, t + .22, .3, .03 * v, {to: 640}); };
  me.dolphin = (v = 1) => { const t = ctx.currentTime; for (let i = 0; i < 3; i++) tone(1800 + i * 150, t + i * .1, .09, .03 * v, {to: 3200}); };
  me.whale = (v = 1) => { const t = ctx.currentTime; tone(120, t, 3.6, .06 * v, {to: 70}); tone(180, t + .3, 3, .03 * v, {to: 105}); };
  me.dwarf = (v = 1) => { const t = ctx.currentTime; [988, 784, 659].forEach((f, i) => tone(f, t + i * .16, .7, .035 * v, {type: 'triangle'})); };
  me.tink = (v = 1) => { const t = ctx.currentTime; tone(2200, t, .08, .03 * v, {type: 'triangle'}); tone(3100, t + .11, .06, .02 * v, {type: 'triangle'}); };
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
    if (s.wild) for (const [name, v] of wildDue(s.wild, wildTimers, dt, rnd)) me[name](v);
    if (s.trainMoving && !wasMoving) me.whistle(); wasMoving = !!s.trainMoving;
    if (s.trainAt && !lastAt) me.stationBell(); lastAt = s.trainAt || null;
  };
  return me;
}
