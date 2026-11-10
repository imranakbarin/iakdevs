/* Real-browser check of the new storybook town (toy-town-new.html): it must start, draw within its budget,
 * have people out and vehicles moving, raise no page errors, and leave screenshots in visual-artifacts/. */
'use strict';
const {chromium} = require('playwright'), {spawn} = require('node:child_process'), fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const port = 8771, out = path.join(__dirname, '../visual-artifacts');
const ready = async () => { for (let n = 0; n < 60; n++) { try { await new Promise((ok, no) => http.get(`http://127.0.0.1:${port}/toy-town-new.html`, r => { r.resume(); r.statusCode === 200 ? ok() : no(new Error('HTTP ' + r.statusCode)); }).on('error', no)); return; } catch (e) { await new Promise(r => setTimeout(r, 250)); } } throw Error('Local site did not start'); };
const mp0Tier = async (browser, port, errors) => { const {devices} = require('playwright'), ctx = await browser.newContext({...devices['iPhone 13']}), pg = await ctx.newPage(); pg.on('pageerror', e => errors.push('phone tier: ' + e.message));
  if (process.env.THREE_LOCAL) await pg.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
  await pg.goto(`http://127.0.0.1:${port}/toy-town-new.html?news=0&tune=0`); await pg.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000}); const t = await pg.evaluate(() => ToyTownNew.tier()); await ctx.close(); return t; };
const shot2 = (pg, name) => pg.screenshot({path: path.join(out, `new-town-${name}.png`)});
(async () => {
  await fs.mkdir(out, {recursive: true});
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: path.join(__dirname, '..'), stdio: 'ignore'});
  let browser;
  try {
    await ready();
    browser = await chromium.launch({headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage']});
    const page = await browser.newPage({viewport: {width: 1100, height: 700}}), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (process.env.THREE_LOCAL) await page.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
    await page.goto(`http://127.0.0.1:${port}/toy-town-new.html?clean=1`);
    await page.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
    await page.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.advance(45); });
    const views = [['wide', 0, .4, 46, 0], ['square', 0, .3, 14, .5], ['high-street', 7.4, -.6, 13, .2], ['cottage-lane', -7.6, -.4, 13, -.3], ['station', -1, 11.5, 11, 0], ['windmill', 2.6, -9.2, 10, .7], ['harbour', 15, 2.3, 12, .6], ['behind', 0, .4, 46, 2.4]];
    for (const [name, x, z, d, yaw] of views) { await page.evaluate(([x, z, d, y]) => ToyTownNew.look(x, z, d, y), [x, z, d, yaw]); await page.screenshot({path: path.join(out, `new-town-${name}.png`)}); }
    await page.evaluate(() => ToyTownNew.look(0, .4, 46, 0));
    const info = await page.evaluate(() => ToyTownNew.info());
    const before = await page.evaluate(() => ToyTownNew.sim.vehicles.map(v => v.s)); await page.evaluate(() => ToyTownNew.advance(5)); const after = await page.evaluate(() => ToyTownNew.sim.vehicles.map(v => v.s));
    // night: lit windows (one more draw call), a dark sky; then rain with umbrellas up. Both must stay inside the budgets.
    const shot = async name => page.screenshot({path: path.join(out, `new-town-${name}.png`)});
    await page.evaluate(() => { ToyTownNew.setHour(23); ToyTownNew.look(0, .4, 34, 0); }); await shot('night');
    const night = await page.evaluate(() => ({...ToyTownNew.info(), glow: ToyTownNew.scene.children.some(o => o.isMesh && o.material.isMeshBasicMaterial && o.material.opacity > .9 && o.visible), sky: ToyTownNew.scene.background.getHexString()}));
    await page.evaluate(() => { ToyTownNew.setHour(11); ToyTownNew.setWeather('rain', 600); ToyTownNew.advance(40); ToyTownNew.look(0, .4, 18, 0); }); await shot('rain');
    const wet = await page.evaluate(() => ToyTownNew.info());
    assert.ok(wet.wet > .3, 'the ground is wet in the rain (' + wet.wet + ')');
    await page.evaluate(() => { ToyTownNew.setWeather('clear', 5); ToyTownNew.setHour(19); ToyTownNew.advance(3); ToyTownNew.look(0, .4, 30, .3); }); await shot('dusk');   // the lamplighter is part-way round: some lanterns lit, some not
    const dusk = await page.evaluate(() => ToyTownNew.info()); assert.ok(dusk.lampsLit > 4 && dusk.lampsLit < 32 && dusk.calls <= 120, 'at dusk the lamps are being lit one by one (' + JSON.stringify(dusk) + ')');
    await page.evaluate(() => { ToyTownNew.setWeather('clear', 5); ToyTownNew.setHour(12); ToyTownNew.look(0, .4, 46, 0); });
    // tap to inspect: a real click on a walking resident selects them, a click on a building selects it
    await page.evaluate(() => { ToyTownNew.setHour(11); for (let i = 0; i < 80 && !ToyTownNew.sim.residents.some(r => r.state === 'walking' && !r.def.lamplighter); i++) ToyTownNew.advance(5); });   // (a jump in time leaves people waiting on old timers: let somebody come out)
    const walker = await page.evaluate(() => { const r = ToyTownNew.sim.residents.find(r => r.state === 'walking' && !r.def.lamplighter); if (!r) return null; ToyTownNew.look(r.x, r.z, 13, .3); return {id: r.id, p: ToyTownNew.project(r.x, r.z, .35)}; });
    assert.ok(walker, 'somebody is walking at 11:00');
    await page.mouse.click(walker.p[0] + 5, walker.p[1] + 3); await page.evaluate(() => ToyTownNew.advance(.05));
    const picked = await page.evaluate(() => ({sel: ToyTownNew.selected(), card: document.getElementById('card').innerText})); await shot('tap');
    const hl = await page.evaluate(() => ToyTownNew.highlight()); assert.ok(hl.mode === 'pin' && hl.pin && !hl.ring, 'a tap shows the small pin, not the ring on the ground (' + JSON.stringify(hl) + ')');
    assert.ok(picked.sel && picked.sel.kind === 'resident' && picked.sel.id === walker.id && /On the way|errand/.test(picked.card), 'tapping a resident shows who and where (' + JSON.stringify(picked) + ')');
    await page.evaluate(() => { const d = ToyTownNew.sim.graph.doors.cafe; ToyTownNew.select(null); ToyTownNew.look(d.x, d.z, 12, .2); });
    await page.mouse.click(...(await page.evaluate(() => { const d = ToyTownNew.sim.graph.doors.cafe; return ToyTownNew.project(d.x, d.z, .5); })));
    assert.equal(await page.evaluate(() => ToyTownNew.selected() && ToyTownNew.selected().id), 'cafe', 'tapping a building selects it');
    await page.evaluate(() => { ToyTownNew.select(null); ToyTownNew.look(0, .4, 46, 0); });
    // the train has work: it carries mail, milk and bread (and people), the work board says so, and a parcel can be sent by tapping
    await page.evaluate(() => { ToyTownNew.setWeather('clear', 5); ToyTownNew.setHour(9); });
    const load = await page.evaluate(() => { let seen = null; for (let i = 0; i < 120 && !seen; i++) { ToyTownNew.advance(4); if (ToyTownNew.sim.cargo.some(c => c.state === 'train') || ToyTownNew.sim.riders.length) seen = {cargo: ToyTownNew.sim.cargo.filter(c => c.state === 'train').length, riders: ToyTownNew.sim.riders.length}; }
      if (seen) { const p = ToyTownNew.trainPos(); ToyTownNew.look(p.x, p.z, 11, .5); } return seen; });
    assert.ok(load, 'within a few minutes the train carries goods or people'); await shot('train-work');
    await page.evaluate(() => ToyTownNew.advance(240)); const work = await page.evaluate(() => ({...ToyTownNew.info(), board: ToyTownNew.jobsText()}));
    assert.ok(work.delivered >= 1 && /Work board/.test(work.board), 'goods get delivered and the work board shows it (' + JSON.stringify(work) + ')');
    await page.evaluate(() => { ToyTownNew.setHour(8); ToyTownNew.advance(5); const a = ToyTownNew.sim.graph.doors.cafe, b = ToyTownNew.sim.graph.doors.bakery; ToyTownNew.look((a.x + b.x) / 2, (a.z + b.z) / 2, 16, .2); ToyTownNew.select({kind: 'building', id: 'cafe'}); });
    await page.evaluate(() => document.documentElement.classList.remove('ui-off')); await page.click('#send'); await page.mouse.click(...(await page.evaluate(() => { const d = ToyTownNew.sim.graph.doors.bakery; return ToyTownNew.project(d.x, d.z, .5); }))); await page.waitForFunction(() => /parcel/.test(document.getElementById('toast').textContent), null, {timeout: 5000}).catch(() => {});
    const sent = await page.evaluate(() => ({toast: document.getElementById('toast').textContent, parcels: ToyTownNew.sim.cargo.filter(c => c.kind === 'parcel').length, stats: ToyTownNew.sim.freightStats})); await shot('parcel');
    assert.ok(/takes a parcel/.test(sent.toast) && sent.parcels === 1, 'tapping send then a building sends a parcel (' + JSON.stringify(sent) + ')');
    await page.evaluate(() => ToyTownNew.advance(1)); const trackNow = await page.evaluate(() => ToyTownNew.trackText()), tstate = await page.evaluate(() => JSON.stringify([ToyTownNew.trackState(), ToyTownNew.sim.clock, ToyTownNew.sim.cargo.map(c => [c.id, c.kind, c.state])])); assert.match(trackNow, /Your parcel, .* to .*/, 'the tracker names the parcel (' + JSON.stringify({trackNow, tstate}) + ')');
    await page.evaluate(() => { document.documentElement.classList.add('ui-off'); ToyTownNew.select(null); ToyTownNew.setHour(12); ToyTownNew.look(0, .4, 46, 0); });
    // seasons: each page load is a season; and the sound button starts audio without errors
    const seasonInfo = {};
    for (const name of ['winter', 'autumn']) { const sp = await browser.newPage({viewport: {width: 1100, height: 700}}); sp.on('pageerror', e => errors.push(name + ': ' + e.message));
      if (process.env.THREE_LOCAL) await sp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await sp.goto(`http://127.0.0.1:${port}/toy-town-new.html?clean=1&season=${name}&news=0`); await sp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      await sp.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.setHour(12); ToyTownNew.advance(20); ToyTownNew.look(0, .4, 40, 0); }); await sp.screenshot({path: path.join(out, `new-town-${name}.png`)}); seasonInfo[name] = await sp.evaluate(() => ToyTownNew.info());
      if (name === 'winter') { await sp.setViewportSize({width: 420, height: 800}); await sp.evaluate(() => document.documentElement.classList.remove('ui-off')); await sp.click('#snd'); await sp.waitForTimeout(400);
        seasonInfo.sound = await sp.evaluate(() => ({on: ToyTownNew.sound.enabled, started: ToyTownNew.sound.started, pressed: document.getElementById('snd').getAttribute('aria-pressed')})); }
      await sp.close(); }
    assert.ok(seasonInfo.winter.season === 'winter' && seasonInfo.autumn.season === 'autumn' && seasonInfo.winter.calls <= 120 && seasonInfo.autumn.calls <= 120, 'the seasons draw within budget (' + JSON.stringify(seasonInfo) + ')');
    assert.ok(seasonInfo.sound.on && seasonInfo.sound.started === 1 && seasonInfo.sound.pressed === 'true', 'the sound button turns sound on (' + JSON.stringify(seasonInfo.sound) + ')');
    // phone (emulated, not a real device): touch input, no horizontal scroll, nothing overlapping, finger-sized buttons, the settings panel, a parcel sent by finger
    { const {devices} = require('playwright'), ctx = await browser.newContext({...devices['iPhone 13']}), mp = await ctx.newPage(); mp.on('pageerror', e => errors.push('phone: ' + e.message));
      if (process.env.THREE_LOCAL) await mp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await mp.goto(`http://127.0.0.1:${port}/toy-town-new.html?news=0`); await mp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      await mp.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.setHour(10); ToyTownNew.advance(30); const a = ToyTownNew.sim.graph.doors.cafe, b = ToyTownNew.sim.graph.doors.bakery; ToyTownNew.look((a.x + b.x) / 2, (a.z + b.z) / 2, 27, .2); });
      const proj = id => mp.evaluate(id => { const d = ToyTownNew.sim.graph.doors[id]; return ToyTownNew.project(d.x, d.z, .5); }, id);
      for (const id of ['cafe', 'bakery']) { const [px, py] = await proj(id); assert.ok(px > 0 && px < 390 && py > 0 && py < 664, id + ' is on the phone screen (' + px + ',' + py + ')'); }
      await mp.touchscreen.tap(...(await proj('cafe'))); await mp.waitForFunction(() => !!ToyTownNew.selected(), null, {timeout: 3000}); await mp.waitForTimeout(400);
      if (!(await mp.evaluate(() => { const o = ToyTownNew.selected(); return o && o.kind === 'building' && o.id === 'cafe'; }))) await mp.evaluate(() => ToyTownNew.select({kind: 'building', id: 'cafe'}));   // (a walker may stand in front of the door and take the tap: the next steps are the ones under test)
      await mp.touchscreen.tap(...(await mp.evaluate(() => { const r = document.getElementById('set').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }))); await mp.waitForTimeout(400);
      const geo = await mp.evaluate(() => { const o = {}, vis = e => e && getComputedStyle(e).display !== 'none' && +getComputedStyle(e).opacity > .5;
        for (const s of ['#chip', '#stack', '#snd', '#set', '#panel', '#card', '#send', '#hint']) { const e = document.querySelector(s); if (vis(e)) { const r = e.getBoundingClientRect(); o[s] = [r.left, r.top, r.right, r.bottom]; } }
        const small = []; for (const e of document.querySelectorAll('#snd, #set, #card button, #panel button, #seasons a')) { const r = e.getBoundingClientRect(); if (r.width && (r.width < 30 || r.height < 30 || (e.id && r.width < 44))) small.push(e.id || e.textContent.trim() || e.tagName); }
        return {rects: o, small, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, coarse: matchMedia('(pointer:coarse)').matches}; });
      const names = Object.keys(geo.rects), clash = []; for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = geo.rects[names[i]], b = geo.rects[names[j]]; if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1 && !((names[i] === '#card' && names[j] === '#send') || (names[i] === '#panel' && names[j] === '#stack'))) clash.push(names[i] + ' x ' + names[j]); }
      await shot2(mp, 'phone'); assert.ok(geo.coarse, 'the phone emulation is a coarse pointer'); assert.ok(geo.scrollW <= geo.innerW, 'no sideways scroll on a phone (' + geo.scrollW + ' > ' + geo.innerW + ')'); assert.deepEqual(clash, [], 'nothing overlaps on a phone: ' + JSON.stringify(geo.rects)); assert.deepEqual(geo.small, [], 'every button is finger-sized');
      assert.ok(await mp.evaluate(() => document.getElementById('panel').classList.contains('on')), 'a finger opens the settings');
      await mp.touchscreen.tap(...(await mp.evaluate(() => { const b = document.querySelector('#panel [data-key=speed] [data-v="4"]').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }))); await mp.waitForTimeout(300);
      assert.equal(await mp.evaluate(() => ToyTownNew.settings.speed), 4, 'and picks a faster day');
      await mp.evaluate(() => document.getElementById('panel').classList.remove('on')); await mp.waitForTimeout(300);
      for (const [dx, dy] of [[0, 0], [0, 14], [-10, 8], [12, -6], [0, 26], [-22, 0], [22, 10]]) {
        await mp.touchscreen.tap(...(await mp.evaluate(() => { const b = document.getElementById('send').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }))); await mp.waitForTimeout(200);
        const [bx, by] = await proj('bakery'); await mp.touchscreen.tap(bx + dx, by + dy); await mp.waitForTimeout(300);
        if (await mp.evaluate(() => /takes a parcel/.test(document.getElementById('toast').textContent))) break;
        await mp.evaluate(() => ToyTownNew.select({kind: 'building', id: 'cafe'})); }
      const phoneSent = await mp.evaluate(() => ({toast: document.getElementById('toast').textContent, parcels: ToyTownNew.sim.cargo.filter(c => c.kind === 'parcel').length}));
      assert.ok(/takes a parcel/.test(phoneSent.toast) && phoneSent.parcels === 1, 'a parcel can be sent with a finger (' + JSON.stringify(phoneSent) + ')');
      await mp.evaluate(() => ToyTownNew.advance(1)); const trk = await mp.evaluate(() => { const r = e => { const b = document.querySelector(e).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return {text: ToyTownNew.trackText(), stack: r('#stack'), snd: r('#snd'), set: r('#set')}; });
      assert.match(trk.text, /Your parcel, .* to .*: .*[\u25CF\u25CB]/, 'the phone shows where the parcel is (' + trk.text + ')'); assert.ok(trk.stack[2] <= trk.snd[0] + 1, 'and the tracker stays clear of the buttons (' + JSON.stringify(trk) + ')');
      // speed under a throttled CPU (software GL, so this says little about a real phone): it must keep going and settle its resolution
      const cdp = await ctx.newCDPSession(mp); await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4}); await mp.evaluate(() => { ToyTownNew.settings.speed = 1; ToyTownNew.settings.speed = 1; ToyTownNew.freeze(false); });
      const fps = await mp.evaluate(() => new Promise(ok => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 3000) ok(n / 3); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
      const pr = await mp.evaluate(() => ToyTownNew.renderer.getPixelRatio()); console.log('PHONE (emulated, 4x slower CPU):', fps.toFixed(1), 'fps, pixel ratio', pr); assert.ok(fps > 1, 'it keeps running when slow (' + fps.toFixed(1) + ' fps)');
      await ctx.close(); }
    // the week: on a Sunday the big market is open at noon and the work board says the day; a Monday has none
    { const wk = {}; for (const [name, day] of [['sun', 'sun'], ['mon', 'mon']]) { const wp = await browser.newPage({viewport: {width: 900, height: 600}}); wp.on('pageerror', e => errors.push(name + ' day: ' + e.message));
        if (process.env.THREE_LOCAL) await wp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
        await wp.goto(`http://127.0.0.1:${port}/toy-town-new.html?day=${day}&news=0&season=spring&quality=low`); await wp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
        await wp.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.setHour(9.2); ToyTownNew.advance(80); const m = ToyTownNew.sim.graph.doors.market; ToyTownNew.look(m.x, m.z, 12, .3); });
        wk[name] = await wp.evaluate(() => ({day: ToyTownNew.sim.dayName, open: ToyTownNew.sim.market.open, visits: ToyTownNew.sim.market.visits, board: ToyTownNew.jobsText(), stations: ToyTownNew.sim.train.stations.length})); if (name === 'sun') await shot2(wp, 'sunday-market'); await wp.close(); }
      assert.ok(wk.sun.day === 'Sunday' && wk.sun.open && wk.sun.visits >= 1 && /Sun/.test(wk.sun.board), 'on Sunday the market is open and busy (' + JSON.stringify(wk.sun) + ')'); assert.ok(wk.mon.day === 'Monday' && !wk.mon.open, 'on Monday it is shut'); assert.equal(wk.sun.stations, 6, 'the train serves six stations'); }
    // picture quality: high has the grass tufts, wind and glow; low has none of them; ?debug=1 shows a readout; the phone starts in the middle
    { const tiers = {}; for (const [name, query] of [['low', 'quality=low&debug=1'], ['high', 'quality=high&debug=1']]) { const qp = await browser.newPage({viewport: {width: 900, height: 600}}); qp.on('pageerror', e => errors.push(name + ' quality: ' + e.message));
        if (process.env.THREE_LOCAL) await qp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
        await qp.goto(`http://127.0.0.1:${port}/toy-town-new.html?${query}&news=0`); await qp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000}); await qp.waitForTimeout(1500);
        tiers[name] = await qp.evaluate(() => ({tier: ToyTownNew.tier(), tufts: ToyTownNew.tufts.count, sway: ToyTownNew.U.sway.value, waves: ToyTownNew.U.waves.value, time: ToyTownNew.U.time.value, dbg: (document.getElementById('dbg') || {}).textContent || '', locked: ToyTownNew.gov.locked, calls: ToyTownNew.renderer.info.render.calls}));
        if (name === 'high') await shot2(qp, 'quality-high'); await qp.close(); }
      assert.ok(tiers.low.tier === 'low' && tiers.low.tufts === 0 && tiers.low.sway === 0 && tiers.low.waves === 0, 'the low tier has no tufts, wind or waves (' + JSON.stringify(tiers.low) + ')');
      assert.ok(tiers.high.tier === 'high' && tiers.high.tufts > 500 && tiers.high.sway > .9 && tiers.high.waves === 1, 'the high tier has them (' + JSON.stringify(tiers.high) + ')'); assert.ok(tiers.high.time > 0, 'the shader clock runs');
      assert.match(tiers.high.dbg, /fps .* calls .* tris .* ratio .* high/, 'the debug readout says what the picture costs'); assert.ok(tiers.low.locked && tiers.high.locked, 'a requested tier is not overridden'); assert.ok(tiers.high.calls <= 120 && tiers.low.calls <= tiers.high.calls + 2, 'draw calls stay in budget (' + tiers.low.calls + ' low, ' + tiers.high.calls + ' high)');
      assert.equal(await mp0Tier(browser, port, errors), 'medium', 'a phone starts in the middle tier'); }
    console.log('NEW TOWN night', JSON.stringify(night), 'rain', JSON.stringify(wet));
    assert.ok(night.glow && night.calls <= 120 && night.sky !== 'bfe9fb', 'at night the windows glow and the sky is dark (' + night.calls + ' calls)');
    assert.ok(wet.rain > .5 && wet.calls <= 120 && wet.triangles <= 800000, 'in the rain it still draws within budget (' + wet.calls + ' calls, rain ' + wet.rain + ')');
    console.log('NEW TOWN', JSON.stringify(info));
    assert.deepEqual(errors, [], 'no page errors');
    assert.ok(info.calls > 5 && info.calls <= 80, 'the whole town draws in a handful of calls (' + info.calls + ')');
    assert.ok(info.triangles > 100000 && info.triangles <= 800000, 'and within its triangle budget (' + info.triangles + ')');
    assert.ok(info.residentsOut >= 1, 'residents are out and about');
    assert.ok(after.some((s, i) => s !== before[i]), 'vehicles are moving');
    console.log('Toy Town NEW visual PASS: ' + info.calls + ' draw calls, ' + info.triangles + ' triangles, ' + info.residentsOut + ' residents out');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
