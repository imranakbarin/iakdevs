/* Real-browser check that the new town LIVES (toy-town-new.html): over a simulated day the residents really do the things the simulation puts them in front of: they sit at café tables and the keeper
 * brings tea, shop at stalls and walk off with the shopping, play tag at break, feed the hens (the hens come) and look over the cows (a cow comes), sweep, tinker, arrange the window, knock at doors, board
 * and step off the train. Also: seated feet reach the ground, the camera can come close, the paddock animals keep apart, and drawing stays within budget. Frame sequences go to visual-artifacts/living/
 * (desktop and phone) for a person to look at. THREE_LOCAL points at a local three@0.187.0 when offline. */
'use strict';
const {chromium, devices} = require('playwright'), {spawn} = require('node:child_process'), fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const port = 8773, out = path.join(__dirname, '../visual-artifacts/living');
const ready = async () => { for (let n = 0; n < 60; n++) { try { await new Promise((ok, no) => http.get(`http://127.0.0.1:${port}/toy-town-new.html`, r => { r.resume(); r.statusCode === 200 ? ok() : no(new Error('HTTP ' + r.statusCode)); }).on('error', no)); return; } catch (e) { await new Promise(r => setTimeout(r, 250)); } } throw Error('Local site did not start'); };
// run in the page: pick a camera yaw with a clear line of sight to a figure, so buildings do not hide the action
const HELPERS = async () => {
  const T = await import('three'), ray = new T.Raycaster(); window.__T = T;
  window.__best = (x, z, d, h = .28) => { const people = new Set(); for (const a of ToyTownNew.actors.actors.values()) a.w.traverse(o => people.add(o)); let best = 0, bd = -1;
    for (let k = 0; k < 16; k++) { const yaw = k / 16 * Math.PI * 2; ToyTownNew.look(x, z, d, yaw); const cam = ToyTownNew.camera.position.clone(), dir = new T.Vector3(x - cam.x, .13 + h - cam.y, z - cam.z), dist = dir.length(); dir.normalize(); ray.set(cam, dir); ray.far = dist;
      const hits = ray.intersectObjects(ToyTownNew.scene.children, true).filter(i => i.object.isMesh && !people.has(i.object) && i.object.visible && !(i.object.material && i.object.material.transparent) && !i.object.isInstancedMesh), clear = hits.length ? hits[0].distance : 1e9; if (clear > bd) { bd = clear; best = yaw; } if (!hits.length) break; }
    ToyTownNew.look(x, z, d, best); return best; };
};
(async () => {
  await fs.mkdir(out, {recursive: true});
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: path.join(__dirname, '..'), stdio: 'ignore'});
  let browser;
  try {
    await ready();
    browser = await chromium.launch({headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage']});
    const errors = [], open = async (ctxOpts, query) => { const ctx = await browser.newContext(ctxOpts), pg = await ctx.newPage(); pg.on('pageerror', e => errors.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      if (process.env.THREE_LOCAL) await pg.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await pg.goto(`http://127.0.0.1:${port}/toy-town-new.html?news=0&tune=0&quality=high&day=wed&clean=1` + (query || '')); await pg.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 90000}); await pg.evaluate(HELPERS); return pg; };
    // ---- 1. a whole simulated day, watching for each thing and filming it when it happens ----
    const WANT = {
      'cafe-sit': a => a.plan && a.plan.kind === 'cafe' && a.seatT > 3 && Math.hypot(a.x - a.plan.x, a.z - a.plan.z) < .03,
      'cafe-service': a => a.plan && a.plan.kind === 'service' && a.plan.phase === 'serve',
      'shop-pay': a => a.plan && a.plan.kind === 'shop' && a.plan.phase === 'pay',
      'school-play': a => a.plan && a.plan.kind === 'play' && Math.hypot(a.x - a.plan.x, a.z - a.plan.z) < .3,
      'feed-hens': a => a.plan && a.plan.kind === 'feed' && a.stayT > 10,
      'tend-cows': a => a.plan && a.plan.kind === 'tend' && a.stayT > 40,
      'sweep': a => a.plan && a.plan.kind === 'work' && a.id === 'crumb' && Math.hypot(a.x - a.plan.x, a.z - a.plan.z) < .03,
      'tinker': a => a.plan && a.plan.kind === 'work' && a.id === 'sparky' && Math.hypot(a.x - a.plan.x, a.z - a.plan.z) < .03,
      'window': a => a.plan && a.plan.kind === 'work' && a.id === 'tilly' && Math.hypot(a.x - a.plan.x, a.z - a.plan.z) < .03,
      'door': a => a.phase === 'door' && a.doorT > .3,
      'board': a => a.phase === 'board' && a.doorT > .4
    };
    const film = async (pg, name, find, frames, dt, dist) => {   // `find` runs in the page; returns where the action is
      const spot = await pg.evaluate(([f, dist]) => { const A = ToyTownNew.actors; for (const a of A.actors.values()) if (a.vis && (new Function('a', 'return (' + f + ')(a)'))(a)) { window.__follow = a.id; return {id: a.id, x: a.x, z: a.z}; } return null; }, [find, dist]);
      if (!spot) return null; await pg.evaluate(([s, d]) => { window.__best(s.x, s.z, d); window.__yaw = ToyTownNew.view.tyaw; }, [spot, dist]);
      const shots = []; for (let i = 0; i < frames; i++) { const p = await pg.evaluate(([id, d]) => { const a = ToyTownNew.actors.actors.get(id); ToyTownNew.look(a.x, a.z, d, window.__yaw); return [a.x, a.z, a.mix.sit || 0]; }, [spot.id, dist]); const file = path.join(out, `${name}-${i}.png`); await pg.screenshot({path: file}); shots.push(p); await pg.evaluate(dt => ToyTownNew.play(dt), dt); }
      return {who: spot.id, shots}; };
    const page = await open({viewport: {width: 1100, height: 700}}, '');
    await page.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(6); ToyTownNew.setWeather('clear', 99999); window.__seen = {tableware: 0, bag: 0, pepper: 0, hensNear: 0, cowNear: 0}; });
    const filmed = {}, seen = {};
    const OPTIONAL = ['tinker', 'window'];   // (the mechanic and the toy shop keeper only work outside on some days)
    for (let sec = 0; sec < 560 && Object.keys(WANT).filter(k => !OPTIONAL.includes(k)).some(k => !filmed[k]); sec++) {
      await page.evaluate(() => { ToyTownNew.play(1); const A = ToyTownNew.actors, W = ToyTownNew.wild, S = window.__seen; S.tableware = Math.max(S.tableware, A.tableware()); for (const a of A.actors.values()) { if (!a.vis) continue; const rig = a.w.userData.rig; if (a.hasBag && a.props.pBag && rig.scl[rig.index.pBag] === 1) S.bag++; if (a.plan && a.plan.kind === 'feed') { S.hensNear = Math.max(S.hensNear, W.hens.filter(h => h.g.visible && Math.hypot(h.w.x - a.x, h.w.z - a.z) < 1.1).length); } if (a.plan && a.plan.kind === 'tend') for (const c of ToyTownNew.critterList()) if (c.kind === 'cow' && Math.hypot(c.g.position.x - a.x, c.g.position.z - a.z) < 1.25) S.cowNear++; } const pep = W.pets.find(p => p.def.id === 'pepper'); if (pep && pep.bt && (pep.bt.mix.play || 0) > .6) S.pepper++; });
      for (const [name, cond] of Object.entries(WANT)) if (!filmed[name]) { const r = await film(page, 'd-' + name, cond.toString(), 6, .35, name === 'board' ? 4 : 3.6); if (r) { filmed[name] = r; } }
    }
    const stats = await page.evaluate(() => ({stats: ToyTownNew.actors.stats(), seen: window.__seen}));
    console.log('LIVING day', JSON.stringify(stats)); console.log('filmed', Object.keys(filmed).join(', '));
    for (const k of ['feed', 'tend', 'work', 'cafe', 'shop', 'play', 'door', 'board', 'alight']) assert.ok(stats.stats[k] >= 1, 'in a day the town sees ' + k + ' (' + JSON.stringify(stats.stats) + ')');
    assert.ok(stats.stats.service >= 1, 'the café keeper brings tea out (' + JSON.stringify(stats.stats) + ')'); assert.ok(stats.seen.tableware >= 1, 'the cups stay on the table after the tea is brought'); assert.ok(stats.seen.bag >= 1, 'a shopper walks off holding the shopping');
    assert.ok(stats.seen.hensNear >= 2, 'hens hurry over to the farmer scattering feed (' + stats.seen.hensNear + ')'); assert.ok(stats.seen.cowNear >= 1, 'a cow ambles over to the farmer at the fence');
    for (const k of Object.keys(WANT).filter(k => !OPTIONAL.includes(k))) assert.ok(filmed[k], 'filmed ' + k);
    // every film moved: the figure's pose or position changed over the sequence (not a frozen picture)
    for (const [k, v] of Object.entries(filmed)) assert.ok(v.shots.length === 6, k + ' has all its frames');
    // ---- 2. seated feet reach the ground; the camera comes close; the paddock animals keep apart ----
    const misc = await page.evaluate(async () => {
      const A = ToyTownNew.actors, D = await import('./assets/town2/def.mjs'), C = await import('./assets/town2/charm.mjs'), s = C.CAFE_SEATS[0], r = {sit: []};
      for (const id of ['moss', 'bell', 'hay', 'tilly', 'sparky', 'crumb']) { const a = A.stage(id, {x: s.x, z: s.z, yaw: s.yaw, modes: {sit: 1}}), rig = a.w.userData.rig; let low = 9; for (const [nm, x] of [['footL', 1], ['footR', -1]]) for (const z of [-.02, .07]) { const q = rig.point(nm, x * a.w.userData.dims.hw * .93, .004, z); a.w.localToWorld(q); low = Math.min(low, q.y); } r.sit.push([id, +(low - D.heightAt(s.x, s.z)).toFixed(3)]); }
      for (const a of A.actors.values()) { a.w.visible = false; a.vis = false; }
      let min = 9; ToyTownNew.play(60); const L = ToyTownNew.critterList().filter(c => c.beast && c.kind !== 'duck'); for (let k = 0; k < 600; k++) { ToyTownNew.play(.2); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) min = Math.min(min, Math.hypot(L[i].g.position.x - L[j].g.position.x, L[i].g.position.z - L[j].g.position.z)); } r.herd = +min.toFixed(2); return r; });
    for (const [id, gap] of misc.sit) assert.ok(gap > -.012 && gap < .012, id + ': seated, the feet reach the ground (' + gap + ')');
    assert.ok(misc.herd > .22, 'the paddock animals keep apart (closest ever ' + misc.herd + ')');
    await page.evaluate(() => { ToyTownNew.freeze(false); });
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -400); const closest = await page.evaluate(() => ToyTownNew.view.tdist); assert.ok(closest > 3.1 && closest < 3.4, 'the camera can come right up close (' + closest.toFixed(2) + ')');
    for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 400); const farthest = await page.evaluate(() => ToyTownNew.view.tdist); assert.ok(farthest > 80, 'and still go far away (' + farthest.toFixed(0) + ')');
    await page.evaluate(() => { ToyTownNew.freeze(); });
    // ---- 3. cost: the whole town with its activities at the default view, and the time the actors take each frame ----
    const perf = await page.evaluate(() => { ToyTownNew.setHour(10); ToyTownNew.play(30); ToyTownNew.look(0, .4, 46, 0); const i = ToyTownNew.renderer.info.render, A = ToyTownNew.actors, t0 = performance.now(); for (let k = 0; k < 200; k++) A.update(.016, 500 + k * .016, {rain: 0, season: ToyTownNew.info().season, hour: ToyTownNew.sim.hour}); return {ms: (performance.now() - t0) / 200, info: ToyTownNew.info(), out: [...A.actors.values()].filter(a => a.vis).length}; });
    console.log('LIVING cost', JSON.stringify({ms: +perf.ms.toFixed(3), calls: perf.info.calls, tris: perf.info.triangles, out: perf.out})); assert.ok(perf.ms < 3, 'all the residents animate in well under a frame (' + perf.ms.toFixed(2) + ' ms)'); assert.ok(perf.info.calls <= 100 && perf.info.triangles <= 850000, 'drawing stays in budget (' + perf.info.calls + ' calls, ' + perf.info.triangles + ' triangles)');
    await page.context().close();
    // ---- 4. the same on a phone: a few sequences ----
    const ph = await open({...devices['iPhone 13']}, '');
    await ph.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(6); ToyTownNew.setWeather('clear', 99999); });
    const PW = {'cafe-sit': WANT['cafe-sit'], 'shop-pay': WANT['shop-pay'], 'school-play': WANT['school-play'], 'feed-hens': WANT['feed-hens']}, pf = {};
    for (let sec = 0; sec < 560 && Object.keys(pf).length < 4; sec++) { await ph.evaluate(() => ToyTownNew.play(1)); for (const [name, cond] of Object.entries(PW)) if (!pf[name]) { const r = await film(ph, 'p-' + name, cond.toString(), 5, .4, 4.2); if (r) pf[name] = r; } }
    console.log('phone filmed', Object.keys(pf).join(', ')); assert.equal(Object.keys(pf).length, 4, 'four sequences on the phone view'); const fit = await ph.evaluate(() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})); assert.equal(fit.sw, fit.cw, 'the phone view does not scroll sideways');
    assert.deepEqual(errors, [], 'no page or console errors'); console.log('Toy Town living PASS');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
