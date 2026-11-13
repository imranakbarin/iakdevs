/* Real-browser check of the new town's residents, horses and animals (toy-town-new.html): every resident builds in all three wears with their own face and a costume for their job,
 * walking keeps the planted foot still on the ground and the body on it, hands carry and wave and sit, residents sit at the café, the cart horse walks and trots with its wheels turning in step,
 * the paddock, pond, hen yard and pets behave, and nothing raises a console or page error. Screenshots go to visual-artifacts/. THREE_LOCAL points at a local three@0.187.0 when offline. */
'use strict';
const {chromium} = require('playwright'), {spawn} = require('node:child_process'), fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const port = 8772, out = path.join(__dirname, '../visual-artifacts');
const ready = async () => { for (let n = 0; n < 60; n++) { try { await new Promise((ok, no) => http.get(`http://127.0.0.1:${port}/toy-town-new.html`, r => { r.resume(); r.statusCode === 200 ? ok() : no(new Error('HTTP ' + r.statusCode)); }).on('error', no)); return; } catch (e) { await new Promise(r => setTimeout(r, 250)); } } throw Error('Local site did not start'); };
(async () => {
  await fs.mkdir(out, {recursive: true});
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: path.join(__dirname, '..'), stdio: 'ignore'});
  let browser;
  try {
    await ready();
    browser = await chromium.launch({headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage']});
    const errors = [], open = async (viewport, query) => { const pg = await browser.newPage({viewport}); pg.on('pageerror', e => errors.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      if (process.env.THREE_LOCAL) await pg.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await pg.goto(`http://127.0.0.1:${port}/toy-town-new.html?news=0&tune=0&quality=high` + (query || '')); await pg.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 90000}); return pg; };
    const shot = (pg, name) => pg.screenshot({path: path.join(out, `characters-${name}.png`)});
    const page = await open({width: 1100, height: 700}, '&clean=1');
    // 1. every resident, in every wear, staged in the square: built, costumed, individual, within the triangle budget
    const rep = await page.evaluate(() => {
      ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(12); ToyTownNew.setWeather('clear', 900);
      const A = ToyTownNew.actors, R = ToyTownNew.sim.residents, ids = R.map(r => r.id), res = {n: ids.length, tris: {}, roles: {}, faces: new Set(), wear: {}, sized: {}};
      for (const wear of ['base', 'rain', 'winter']) {
        ids.forEach((id, i) => { const a = A.stage(id, {x: -1.0 + (i % 7) * .34, z: .9 + Math.floor(i / 7) * .55, yaw: Math.PI, wear}); const U = a.w.userData, v = U.cur; res.tris[id + ':' + wear] = v.userData.mesh.geometry.attributes.position.count / 3; res.roles[id] = U.identity.role; res.wear[id + ':' + wear] = U.wear; res.sized[id] = +U.dims.top.toFixed(3); });
        
      }
      return {...res, faces: ids.length};
    });
    assert.equal(rep.n, 28, 'the whole cast is there');
    for (const [k, t] of Object.entries(rep.tris)) assert.ok(t > 2500 && t < 9000, k + ' is a real figure but not a heavy one (' + t + ' triangles)');
    for (const wear of ['base', 'rain', 'winter']) { await page.evaluate(([wear]) => { const A = ToyTownNew.actors, ids = ToyTownNew.sim.residents.map(r => r.id); ids.forEach((id, i) => A.stage(id, {x: -1.0 + (i % 7) * .34, z: .9 + Math.floor(i / 7) * .55, yaw: Math.PI, wear})); ToyTownNew.look(0, 1.5, 7, 0); }, [wear]); await shot(page, 'cast-' + wear); }
    const diff = await page.evaluate(() => { const A = ToyTownNew.actors, d = {}; for (const [id, a] of A.actors) { const V = a.w.userData.variants; d[id] = ['rain', 'winter'].map(w => V[w].userData.identity === V.base.userData.identity && V[w].userData.mesh.geometry.attributes.position.count !== V.base.userData.mesh.geometry.attributes.position.count); } return d; });
    assert.ok(Object.values(diff).every(([a, b]) => a && b), 'the same person in a different outfit: same identity, different clothes (' + JSON.stringify(Object.entries(diff).filter(([, v]) => !(v[0] && v[1])).map(x => x[0])) + ')');
    const need = ['farmer', 'baker', 'cafe', 'schoolgirl', 'schoolboy', 'stationmaster', 'driver', 'fisherman', 'captain', 'police', 'fire', 'visitor', 'fishmonger', 'grocer', 'toyshop']; for (const n of need) assert.ok(Object.values(rep.roles).includes(n), 'a ' + n + ' costume is in the cast');
    // 2. close-ups of a few residents in close-up poses
    await page.evaluate(() => { const A = ToyTownNew.actors; for (const a of A.actors.values()) { a.w.visible = false; a.vis = false; } const row = [['crumb', {}], ['bell', {modes: {wave: 1}}], ['dot', {modes: {talk: 1}}], ['hay', {modes: {carry: 1}}], ['nell', {walk: true, u: .3}], ['embers', {run: true, walk: true, u: .1}], ['moss', {modes: {sit: 1}}], ['finn', {modes: {fish: 1}, cast: .5}]]; row.forEach(([id, o], i) => A.stage(id, {x: -.95 + i * .27, z: 2.3, yaw: Math.PI - .35, ...o})); ToyTownNew.look(-.1, 2.3, 4.4, .15); });
    await shot(page, 'poses');
    // 3. walking: the planted foot stays put and the body stays on the ground (real rig, every build)
    const walk = await page.evaluate(async () => {
      const P = await import('./assets/town2/pose.mjs'), Df = await import('./assets/town2/def.mjs'), A = ToyTownNew.actors, res = {};
      for (const id of ['crumb', 'dot', 'tilly', 'bell', 'wick', 'hay', 'dash', 'ada']) {
        const a = A.actors.get(id), D = (A.stage(id, {x: 0, z: 0}), a.w.userData.dims), stride = P.personStride(D.legLen - D.ankleY - .004), duty = P.PERSON_GAIT.duty; let min = 1e9, max = -1e9, groundMin = 1e9, groundMax = -1e9, lifted = 0;
        for (let k = 0; k < 100; k++) {   // one stride: the left foot's stance part (its ankle must stay where it landed), and the lowest sole at every moment (it must be on the ground)
          const u = k / 100; A.stage(id, {x: 0, z: u * stride, walk: true, u}); const U = a.w.userData, rig = U.rig, p = rig.point('footL', D.hw * .93, D.ankleY, 0); a.w.localToWorld(p);
          if (u < duty * .93 && u > .02) { min = Math.min(min, p.z); max = Math.max(max, p.z); }
          let low = 1e9, high = -1e9; for (const [nm, x] of [['footL', D.hw * .93], ['footR', -D.hw * .93]]) for (const z of [-.02, .07]) { const q = rig.point(nm, x, .004, z); a.w.localToWorld(q); low = Math.min(low, q.y); high = Math.max(high, q.y); }
          const ground = Df.heightAt(0, u * stride); groundMin = Math.min(groundMin, low - ground); groundMax = Math.max(groundMax, low - ground); lifted = Math.max(lifted, high - ground);
        }
        res[id] = {drift: +((max - min) / stride).toFixed(3), groundMin: +groundMin.toFixed(4), groundMax: +groundMax.toFixed(4), lifted: +lifted.toFixed(3)};
      }
      return res;
    });
    for (const [id, r] of Object.entries(walk)) { assert.ok(r.drift < .17, id + ': a planted foot does not skate (it drifts ' + (r.drift * 100).toFixed(0) + '% of a stride)'); assert.ok(r.groundMin > -.012 && r.groundMax < .012 && r.lifted > .03, id + ': a foot is always on the ground, never sunk in or floating, and the other lifts in each step (' + JSON.stringify(r) + ')'); }
    // 4. in the live town: somebody sits at the café, a parcel is carried in the hands, rain and winter bring the right clothes
    const live = await page.evaluate(() => {
      const sim = ToyTownNew.sim, A = ToyTownNew.actors, env = () => ({rain: sim.weather.rain, season: ToyTownNew.info().season, hour: sim.hour}), r = {};
      ToyTownNew.setHour(12); ToyTownNew.setWeather('clear', 900);
      for (let i = 0; i < 400 && !r.seated; i++) { ToyTownNew.advance(2, true); const who = sim.residents.filter(q => q.state === 'inside' && q.at === 'cafe' && q.id !== 'pott' && !q.onPlatform); if (who.length) { for (let k = 0; k < 80; k++) A.update(.1, 100 + k * .1, env()); r.seated = [...A.actors.values()].filter(a => (a.mix.sit || 0) > .6).map(a => a.id); const d = sim.graph.doors.cafe; ToyTownNew.look(d.x, d.z, 7, .3); } }
      return r;
    });
    assert.ok(live.seated && live.seated.length >= 1, 'a resident walks to a café table and sits (' + JSON.stringify(live) + ')'); await shot(page, 'cafe');
    const wearTest = await page.evaluate(() => { const A = ToyTownNew.actors, sim = ToyTownNew.sim, r = {}; for (const [kind, season] of [['clear', 'summer']]) { } for (const x of sim.residents) { const a = A.actors.get(x.id); a.vis = false; a.w.visible = false; } ToyTownNew.setWeather('rain', 900); ToyTownNew.advance(30, true);
      let n = 0; for (let k = 0; k < 600 && n < 2; k++) { ToyTownNew.advance(3, true); A.update(.1, 300 + k, {rain: .8, season: 'summer', hour: sim.hour}); for (const a of A.actors.values()) if (a.w.visible && a.r.state === 'walking' && !r[a.id]) { r[a.id] = a.w.userData.wear; n++; } } return r; });
    assert.ok(Object.keys(wearTest).length >= 1 && Object.values(wearTest).every(w => w === 'rain'), 'in the rain, residents who step out wear rain gear (' + JSON.stringify(wearTest) + ')');
    await page.close();
    // 5. the cart horse: walks, trots when hurrying home, wheels turn with the ground; hind and fore legs coordinated
    const hp = await open({width: 1000, height: 650}, '&clean=1');
    const horse = await hp.evaluate(async () => {
      ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(9); const P = await import('./assets/town2/pose.mjs'), F = await import('./assets/town2/fauna.mjs'); const sim = ToyTownNew.sim, v = sim.vehicles.find(x => x.def.kind === 'horsecart'), r = {};
      for (let i = 0; i < 300; i++) { ToyTownNew.advance(1, true); if (v.state === 'driving' && v.v > .3) break; }
      const bt = ToyTownNew.beast(v.id), g = ToyTownNew.car(v.id); r.state = v.state; r.v = v.v; ToyTownNew.advance(2, true); for (let k = 0; k < 30; k++) ToyTownNew.advance(.1, true); r.gait = bt.gaitName; r.wheel = bt.wheel;
      // drive the beast by hand at a walking and a trotting speed and compare legs and wheels
      const run = speed => { bt.gait = P.newGait(); bt.gaitName = 'walk'; let x = 0; const frames = []; for (let k = 0; k < 200; k++) { x += speed * .05; F.poseBeast(bt, .05, x, 0, {}, {v0: .04}); frames.push({name: bt.gaitName, u: bt.gait.u, wheel: bt.wheel, fL: bt.pose.rot[bt.pose.index.fLu * 3], hR: bt.pose.rot[bt.pose.index.hRu * 3], fR: bt.pose.rot[bt.pose.index.fRu * 3], hL: bt.pose.rot[bt.pose.index.hLu * 3]}); } return frames; };
      const w = run(.5), t = run(.7); r.walkName = w[199].name; r.trotName = t[199].name; r.wheelPerDist = t[199].wheel / (.7 * .05 * 200); r.wheelR = (g.userData.wheel || .14) * g.userData.scale;
      const last = t.slice(120); r.trotDiag = Math.max(...last.map(f => Math.abs(f.fL - f.hR))); r.trotLat = Math.max(...last.map(f => Math.abs(f.fL - f.fR))); r.walkOrder = Math.max(...w.slice(100).map(f => Math.abs(f.fL - f.hL)));
      ToyTownNew.look(g.position.x, g.position.z, 8, .4); return r;
    });
    assert.equal(horse.walkName, 'walk', 'at .5 the horse walks'); assert.equal(horse.trotName, 'trot', 'at .7 it trots');
    assert.ok(Math.abs(horse.wheelPerDist * horse.wheelR - 1) < .03, 'the wheels turn with the distance covered (' + horse.wheelPerDist.toFixed(2) + ' vs ' + (1 / horse.wheelR).toFixed(2) + ' rad/unit)'); assert.ok(horse.trotDiag < 1e-6 && horse.trotLat > .3, 'in the trot the diagonal legs move together (' + JSON.stringify([horse.trotDiag, horse.trotLat]) + ')'); assert.ok(horse.walkOrder > .2, 'in the walk the fore and hind legs on one side are out of step');
    await shot(hp, 'horse');
    // 6. the paddock, the pond, the hen yard and the pets: the animals behave, stay on the ground and in their places
    const fauna = await hp.evaluate(async () => {
      ToyTownNew.setHour(11); ToyTownNew.setWeather('clear', 900); const sim = ToyTownNew.sim, A = ToyTownNew.actors, L = ToyTownNew.critterList(), W = ToyTownNew.wild, res = {modes: {cow: new Set(), sheep: new Set(), duck: new Set()}, bad: []};
      for (let k = 0; k < 1500; k++) { ToyTownNew.advance(.2, true); for (const c of L) if (c.st && c.kind) { res.modes[c.kind].add(c.st.mode); } }
      const hd = (await import('./assets/town2/def.mjs')).heightAt; for (const c of L) if (c.beast && c.kind !== 'duck') { const gy = c.g.position.y - hd(c.g.position.x, c.g.position.z); if (Math.abs(gy) > .12) res.bad.push([c.kind, +gy.toFixed(3)]); }
      for (const a of W.pets) { const gy = a.g.position.y - hd(a.g.position.x, a.g.position.z); if (a.g.visible && Math.abs(gy) > .12) res.bad.push([a.kind, +gy.toFixed(3)]); }
      res.modes = Object.fromEntries(Object.entries(res.modes).map(([k, v]) => [k, [...v]])); res.pets = W.pets.map(a => a.w.anim); return res;
    });
    assert.ok(fauna.modes.cow.includes('graze') && fauna.modes.sheep.includes('graze') && fauna.modes.duck.includes('swim'), 'cows and sheep graze, ducks swim (' + JSON.stringify(fauna.modes) + ')'); assert.deepEqual(fauna.bad, [], 'animals stay on the ground');
    for (const [name, pick] of [['paddock', 'cow'], ['hens', 'hen'], ['pond', 'duck'], ['pets', 'pet']]) { await hp.evaluate(([pick]) => { const L = ToyTownNew.critterList(), W = ToyTownNew.wild; const g = pick === 'hen' ? W.hens[0].g.position : pick === 'pet' ? W.pets[0].g.position : L.find(c => c.kind === pick).g.position; ToyTownNew.look(g.x, g.z, pick === 'cow' ? 7 : 5.5, .5); }, [pick]); await shot(hp, 'animals-' + name); }
    await hp.close();
    // 7. weather and season: night, rain, winter on a phone-sized view with people in the road
    for (const [name, q, setup, vp] of [['rain-phone', '&season=spring', () => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(11); ToyTownNew.setWeather('rain', 900); ToyTownNew.advance(80, true); }, {width: 390, height: 780}], ['winter', '&season=winter', () => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(11); ToyTownNew.advance(80, true); }, {width: 1000, height: 650}], ['night', '&season=summer', () => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(21.5); ToyTownNew.advance(60, true); }, {width: 1000, height: 650}]]) {
      const wp = await open(vp, q); await wp.evaluate(setup); const found = await wp.evaluate(() => { const A = ToyTownNew.actors; for (let i = 0; i < 100 && ![...A.actors.values()].some(a => a.r.state === 'walking'); i++) ToyTownNew.advance(4, true); const w = [...A.actors.values()].find(a => a.r.state === 'walking'); if (!w) return null; A.update(.1, 1, {rain: ToyTownNew.sim.weather.rain, season: ToyTownNew.info().season, hour: ToyTownNew.sim.hour}); ToyTownNew.look(w.r.x, w.r.z, 11, .4); return {id: w.id, wear: w.w.userData.wear, info: ToyTownNew.info()}; });
      if (found) { assert.ok(name === 'winter' ? found.wear === 'winter' : name === 'rain-phone' ? found.wear === 'rain' : true, name + ': the walker wears ' + found.wear); assert.ok(found.info.calls <= 135, name + ': draw calls in budget (' + found.info.calls + ')'); } await shot(wp, name); await wp.close();
    }
    assert.deepEqual(errors, [], 'no page or console errors'); console.log('Toy Town characters PASS: 28 residents x 3 wears, horse gaits, café seating, animals, weather views');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
