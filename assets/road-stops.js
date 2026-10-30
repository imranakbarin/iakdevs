/* Road trip stops and the horn. A tap on the road while a roadside stop is
 * coming up (a café, a campsite, an overlook…) pulls the car over: it brakes
 * smoothly to a halt with the stop just ahead, the hazards blink, the drive's
 * clock and the place cycle wait, and a card names where you are. A tap (or
 * fourteen seconds) drives on. Each stop visited is kept on this device (five
 * landscapes × three kinds). A tap on the car sounds the horn. Reads the
 * road's own globals (journey, speed, tripDrive, roadProjection, places,
 * RoadIllustration, SceneMotion, cv, DPR, modeBtn, playing). */
const RoadStops = (() => {
  const NAMES = [['Alpine café', 'Scenic campsite', 'Valley overlook'], ['Desert rest stop', 'Windmill', 'Canyon overlook'], ['Woodland lodge', 'Forest campsite', 'Forest overlook'], ['Lighthouse', 'Coastal café', 'Ocean overlook'], ['Corner café', 'Farm market', 'City overlook']];
  const KEY = 'road-trip:stops', AHEAD = 70, BRAKE = 140, WAIT = 14;
  const total = NAMES.length * 3;
  let stop = null, theme = 0, honkAt = -10, hint = null, card = null;
  const now = () => typeof SceneMotion !== 'undefined' ? SceneMotion.time : 0;
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x));
  const seen = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return new Set(Array.isArray(v) ? v : []); } catch (_) { return new Set(); } };
  function keep(name) { const s = seen(); if (s.has(name)) return false; s.add(name); try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch (_) {} return true; }

  // Where the car can park for a stop so that the stop is drawn beside the road
  // (the road leaves out stops over rivers, on ground that does not suit them and
  // off the edge of the screen); null when no parking spot shows it.
  function parkFor(e, ix) {
    const w = cv.width, h = cv.height, horizon = h * (w / h < .85 ? .40 : .44);
    for (const ahead of [AHEAD, 92, 118, 150]) {
      const j = (e.s - ahead) / 42, z = 36 / ahead - .025, P = roadProjection(j, w, h, horizon);
      if (RoadIllustration.onRiver(z, j, ix) || roadObjectTheme('landmark:' + seed + ':' + e.i, z) !== ix) continue;
      if (roadDryGround(P, z, e.side, w, h) * roadThemeFit(P, z, ix, w, h) < .6) continue;
      const sc = P.hw(z) / 350 * .92, x = P.rx(z) + e.side * (P.hw(z) * 1.38 + 180 * sc);
      if (x - 220 * sc < 0 || x + 220 * sc > w) continue;
      return ahead;
    }
    return null;
  }
  // The next stop the car can still brake for and see, with its road position.
  function reachable(camera, ix = theme) {
    if (RoadTraffic.snapshot(camera).state !== 'follow') return null;   // not in the middle of overtaking
    const list = RoadIllustration.encounters(camera / 42, ix).map(e => ({...e, s: camera + 36 / (e.z + .025)})).filter(e => e.s - camera > AHEAD + 40 && e.s - camera < 520).sort((a, b) => a.s - b.s);
    for (const e of list) { const ahead = parkFor(e, ix); if (ahead) return {...e, ahead}; }
    return null;
  }
  // The share of the usual cruise to drive at (the drive multiplies by it).
  function cruise(camera) {
    if (!stop) return 1;
    const d = stop.s - stop.ahead - camera;
    if (stop.phase === 'brake') {
      if (d < 6 && tripDrive.x < .08) { stop.phase = 'parked'; stop.at = now(); show(); }
      return d <= .5 ? .002 : clamp(.05, Math.sqrt(d / BRAKE), 1);
    }
    if (stop.phase === 'parked') { if (now() - stop.at > WAIT) go(); else return .002; }
    return 1;
  }
  // How fast the trip is moving compared with its usual cruise: the place cycle and the leg clock wait while parked.
  function pace() { if (stop && stop.phase === 'parked') return 0; const usual = typeof speed === 'number' ? speed / 40 : 1; return usual > 0 ? clamp(0, tripDrive.x / usual, 1) : 0; }
  function pullOver() {
    const camera = journey * 42, e = reachable(camera);
    if (!e) return false;
    stop = {s: e.s, ahead: e.ahead, name: NAMES[theme][e.variant], place: places[theme].name, variant: e.variant, phase: 'brake', at: 0, fresh: false};
    hideHint();
    return true;
  }
  function go() { if (!stop) return; stop = null; hideCard(); }

  /* ---- what the person sees ---- */
  const pill = 'position:fixed;left:50%;transform:translate(-50%,-8px);z-index:6;pointer-events:none;opacity:0;transition:opacity .6s,transform .6s;box-sizing:border-box;font:500 13px/1.35 system-ui,-apple-system,sans-serif;';
  function el(id, css) { let e = document.getElementById(id); if (!e) { e = document.createElement('div'); e.id = id; e.setAttribute('role', 'status'); e.style.cssText = css; document.body.append(e); } return e; }
  function showHint(text) {
    hint = el('road-stop-hint', pill + 'top:calc(76px + env(safe-area-inset-top,0px));padding:8px 15px;border-radius:999px;background:rgba(28,44,40,.78);color:#f4ead0;white-space:nowrap');
    if (hint.textContent !== text) hint.textContent = text;
    hint.style.opacity = '1'; hint.style.transform = 'translate(-50%,0)';
  }
  function hideHint() { if (hint) { hint.style.opacity = '0'; hint.style.transform = 'translate(-50%,-8px)'; } }
  function show() {
    stop.fresh = keep(stop.name);
    const n = seen().size;
    card = el('road-stop-card', pill + 'top:calc(76px + env(safe-area-inset-top,0px));width:min(320px,calc(100vw - 32px));padding:13px 18px 12px;border-radius:6px;background:#fbf4e3;color:#3b2a1c;box-shadow:0 10px 30px #0004;border:1px solid #e3d3b0');
    card.innerHTML = `<div style="font:700 10px/1 system-ui;letter-spacing:.14em;color:#9a7b4f">PULLED OVER · ${stop.place.toUpperCase()}</div>
      <div style="font:600 22px/1.15 Georgia,serif;margin:6px 0 4px">${stop.name}</div>
      <div>${stop.fresh ? 'A new stop for your trip log' : 'You have stopped here before'} · ${n} of ${total} stops</div>
      <div style="margin-top:6px;font-size:11.5px;color:#8a6f4c">Tap the road to drive on</div>`;
    requestAnimationFrame(() => { card.style.opacity = '1'; card.style.transform = 'translate(-50%,0)'; });
  }
  function hideCard() { if (card) { card.style.opacity = '0'; card.style.transform = 'translate(-50%,-8px)'; } }

  // Called once per road frame (after the road is drawn) with the dominant place.
  function frame(c, w, h, dominant) {
    theme = dominant;
    // Offer the next stop until one has been visited, then only stops not visited yet.
    const e = !stop && playing ? reachable(journey * 42) : null, name = e && NAMES[theme][e.variant], visited = seen();
    if (e && (!visited.size || !visited.has(name))) showHint(`${name} ahead · tap the road to pull over`); else hideHint();
    const hero = heroAt(w, h);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    if (stop && stop.phase === 'parked' && Math.sin(now() * 9.4) > 0) {   // hazards
      for (const side of [-1, 1]) {
        const x = hero.x + side * hero.width * .35, y = hero.y - hero.width * .27, r = Math.max(3, hero.width * .09), g = c.createRadialGradient(x, y, 0, x, y, r * 2.4);
        g.addColorStop(0, 'rgba(255,190,70,.95)'); g.addColorStop(.4, 'rgba(255,160,40,.35)'); g.addColorStop(1, 'rgba(255,160,40,0)');
        c.fillStyle = g; c.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      }
    }
    const age = now() - honkAt;
    if (age >= 0 && age < .9) {   // the horn: rings off the front of the car
      c.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const u = age / .9 - k * .18; if (u <= 0 || u >= 1) continue;
        c.globalAlpha = (1 - u) * .8; c.strokeStyle = '#fff6dc'; c.lineWidth = Math.max(1.5, hero.width * .012);
        c.beginPath(); c.arc(hero.x, hero.y - hero.width * .5, hero.width * (.22 + u * .5), -Math.PI * .8, -Math.PI * .2); c.stroke();
      }
    }
    c.restore();
  }
  function heroAt(w, h) {
    const horizon = h * (w / h < .85 ? .40 : .44), P = roadProjection(journey, w, h, horizon), z = .88, lane = SceneMotion.lane.x;
    return {x: P.rx(z) + P.hw(z) * lane, y: P.yy(z), width: P.hw(z) * .44};
  }
  function honk() { honkAt = now(); if (typeof WorldSound !== 'undefined' && WorldSound.cue) WorldSound.cue('honk'); }
  // A tap on the road: the car sounds the horn, a parked car drives on, otherwise it pulls over if it can.
  function tap(x, y) {
    const w = cv.width, h = cv.height, hero = heroAt(w, h), px = x * DPR, py = y * DPR;
    if (Math.hypot(px - hero.x, py - (hero.y - hero.width * .3)) < Math.max(hero.width * .45, 40 * DPR)) { honk(); return 'honk'; }
    if (stop) { go(); return 'go'; }
    return pullOver() ? 'stop' : null;
  }
  function install() {
    if (typeof cv === 'undefined') return;
    let down = null;
    cv.addEventListener('pointerdown', e => { if (modeBtn.value === 'road') down = {x: e.clientX, y: e.clientY, t: performance.now()}; });
    cv.addEventListener('pointerup', e => {
      if (modeBtn.value !== 'road' || !down) return;
      const quick = performance.now() - down.t < 400 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12;
      down = null; if (quick && playing) { tap(e.clientX, e.clientY); if (typeof wakeScene === 'function') wakeScene(); }
    });
    addEventListener('keydown', e => { if (modeBtn.value === 'road' && (e.key === 'h' || e.key === 'H') && !e.repeat && !/input|select|textarea/i.test(e.target.tagName)) honk(); });
    // Leaving the road mid-stop: drive on next time, and hide what was showing.
    setInterval(() => { if (typeof modeBtn !== 'undefined' && modeBtn.value !== 'road') { if (stop) go(); hideHint(); } }, 1000);
  }
  return {install, cruise, pace, frame, tap, honk, pullOver, go, reachable, state: () => stop && {...stop}, stops: () => seen().size, total, NAMES};
})();
