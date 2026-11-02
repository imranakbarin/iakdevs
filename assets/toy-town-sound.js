/* Toy Town sound — small, gentle and off until asked for.
 * Everything is synthesised with WebAudio (no sound files): a soft two-note
 * honk, a bicycle bell, a quack, bird chirps, a balloon pop, a hello chime,
 * and a quiet birdsong bed by day that turns to the odd cricket at night.
 * A 🔈 button beside the zoom controls switches it on; the choice is
 * remembered on this device. Browsers only allow audio after a tap, so a
 * remembered "on" starts at the first touch of the page. */
(function (root) {
  'use strict';
  const KEY = 'toy-town:sound';
  let ctx = null, master = null, on = false, bedTimer = 0;
  const stored = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  function start() {
    if (ctx) { ctx.resume?.(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = .22;
    // A gentle low-pass keeps every cue soft-edged.
    const soften = ctx.createBiquadFilter(); soften.type = 'lowpass'; soften.frequency.value = 4200;
    master.connect(soften); soften.connect(ctx.destination);
    return true;
  }
  function tone(type, f0, f1, dur, vol = .5, at = 0) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol, freq, at = 0) {
    const t = ctx.currentTime + at, len = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const CUES = {
    honk: () => { tone('triangle', 392, 392, .16, .35); tone('triangle', 330, 330, .2, .35, .18); },
    bell: () => { tone('sine', 2093, 2093, .7, .3); tone('sine', 3136, 3136, .45, .12); tone('sine', 2093, 2093, .5, .22, .16); },
    quack: () => { tone('sawtooth', 560, 330, .11, .16); tone('sawtooth', 520, 300, .12, .14, .16); },
    chirp: () => { for (let k = 0; k < 3; k++) tone('sine', 2600 + Math.random() * 900, 3500 + Math.random() * 600, .07, .14, k * .1); },
    pop: () => { noise(.06, .9, 1800); tone('sine', 520, 160, .08, .2); },
    chime: () => { tone('sine', 880, 880, .35, .18); tone('sine', 1318.5, 1318.5, .4, .14, .09); },
    rumble: () => { noise(1.6, .5, 90); tone('sine', 55, 40, 1.4, .25); }
  };
  // A sparse birdsong bed by day; the odd soft cricket at night.
  function bed() {
    if (!on || !ctx) return;
    const night = (root.ToyTown?.debug?.().night || 0) > .5;
    if (night) { for (let k = 0; k < 4; k++) tone('sine', 4200, 4200, .03, .035, k * .06); }
    else if (Math.random() < .7) CUES.chirp();
    bedTimer = setTimeout(bed, 3000 + Math.random() * 5000);
  }
  function set(v, store) {
    on = !!v && start();
    if (store) try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    clearTimeout(bedTimer); if (on) bedTimer = setTimeout(bed, 1500);
    const b = typeof document !== 'undefined' && document.getElementById('sound-toggle');
    if (b) { b.textContent = on ? '🔈' : '🔇'; b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Sound off' : 'Sound on'; b.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on'); }
  }
  function cue(name) { if (on && ctx && CUES[name]) { ctx.resume?.(); CUES[name](); } }
  function init() {
    if (typeof document === 'undefined') return;
    const b = document.getElementById('sound-toggle'); if (!b) return;
    b.addEventListener('click', () => set(!on, true));
    set(false, false);
    if (stored()) addEventListener('pointerdown', () => { if (!on) set(true, false); }, {once: true});   // a remembered "on" starts with the first touch
  }
  root.ToyTownSound = {cue, set, init, get on() { return on; }, CUES: Object.keys(CUES)};
  if (typeof document !== 'undefined') (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init());
})(typeof window !== 'undefined' ? window : globalThis);
