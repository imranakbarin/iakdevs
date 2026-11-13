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
    { const h = await page.evaluate(() => { ToyTownNew.setHour(15.5); ToyTownNew.advance(.05); const m = ToyTownNew.moving; return {hour: ToyTownNew.sim.hour, min: m.minute.inner.rotation.z, hr: m.hour.inner.rotation.z, smin: m.stMinute.inner.rotation.z, shr: m.stHour.inner.rotation.z}; });
      const tm = (-h.min / (Math.PI * 2) + 1) % 1, th = (-h.hr / (Math.PI * 2) * 12 + 12) % 12; assert.ok(Math.abs(tm - (h.hour % 1)) < .02 && Math.abs(th - (h.hour % 12)) < .1 && h.smin === h.min && h.shr === h.hr, 'the tower clock and the station clock show the town hour (' + JSON.stringify(h) + ')'); }
    { const r = await page.evaluate(async () => { ToyTownNew.setHour(10.5); for (let i = 0; i < 60 && !ToyTownNew.sim.story.current; i++) ToyTownNew.advance(5, true); ToyTownNew.advance(8, true); const el = document.getElementById('story'); if (!ToyTownNew.sim.story.current || ToyTownNew.sim.story.current.id === 'incident') return {none: true}; ToyTownNew.select(null); el.click(); return {sel: ToyTownNew.selected(), on: el.classList.contains('on')}; });
      assert.ok(r.none || (r.sel && r.sel.id), 'tapping the story banner takes you to it (' + JSON.stringify(r) + ')'); }
    { const g = await page.evaluate(() => { document.getElementById('goal').click(); const w = document.getElementById('paper').innerText; const a = document.querySelectorAll('#paper .tabs button'); return {w, tabs: [...a].map(x => x.textContent), goal: document.getElementById('goal').textContent, tip: document.getElementById('guideTip').textContent}; });
      assert.ok(/Wishes/.test(g.w) && g.tabs.includes('Album') && /\d\/3/.test(g.goal) && typeof g.tip === 'string', 'the wishes page, the album tab, the goal pill and the guide are there (' + JSON.stringify(g).slice(0, 300) + ')'); await page.evaluate(() => document.querySelector('#paper .tabs button').click()); await page.evaluate(() => document.querySelector('.pclose') && document.querySelector('.pclose').click()); }
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
    const dusk = await page.evaluate(() => ToyTownNew.info()); assert.ok(dusk.lampsLit > 4 && dusk.lampsLit < 32 && dusk.calls <= 135, 'at dusk the lamps are being lit one by one (' + JSON.stringify(dusk) + ')');
    await page.evaluate(() => { ToyTownNew.setWeather('clear', 5); ToyTownNew.setHour(12); ToyTownNew.look(0, .4, 46, 0); });
    // tap to inspect: a real click on a walking resident selects them, a click on a building selects it
    await page.evaluate(() => { ToyTownNew.setHour(11); for (let i = 0; i < 80 && !ToyTownNew.sim.residents.some(r => r.state === 'walking' && !r.def.lamplighter); i++) ToyTownNew.advance(5, true); });   // (a jump in time leaves people waiting on old timers: let somebody come out)
    const walker = await page.evaluate(() => { const r = ToyTownNew.sim.residents.find(r => r.state === 'walking' && !r.def.lamplighter); if (!r) return null; ToyTownNew.look(r.x, r.z, 13, .3); return {id: r.id, p: ToyTownNew.project(r.x, r.z, .35)}; });
    assert.ok(walker, 'somebody is walking at 11:00');
    await page.mouse.click(walker.p[0] + 5, walker.p[1] + 3); await page.evaluate(() => ToyTownNew.advance(.05));
    const picked = await page.evaluate(() => ({sel: ToyTownNew.selected(), card: document.getElementById('card').innerText})); await shot('tap');
    const hl = await page.evaluate(() => ToyTownNew.highlight()); assert.ok(hl.mode === 'pin' && hl.pin && !hl.ring, 'a tap shows the small pin, not the ring on the ground (' + JSON.stringify(hl) + ')');
    assert.ok(picked.sel && picked.sel.kind === 'resident' && picked.sel.id === walker.id && /On the way|errand|Stopping to say hello|chat/.test(picked.card), 'tapping a resident shows who and where (' + JSON.stringify(picked) + ')');
    await page.evaluate(() => { const d = ToyTownNew.sim.graph.doors.cafe; ToyTownNew.select(null); ToyTownNew.look(d.x, d.z, 12, .2); });
    await page.mouse.click(...(await page.evaluate(() => { const d = ToyTownNew.sim.graph.doors.cafe; return ToyTownNew.project(d.x, d.z, .5); })));
    assert.equal(await page.evaluate(() => ToyTownNew.selected() && ToyTownNew.selected().id), 'cafe', 'tapping a building selects it');
    await page.evaluate(() => { ToyTownNew.select(null); ToyTownNew.look(0, .4, 46, 0); });
    // the train has work: it carries mail, milk and bread (and people), the work board says so, and a parcel can be sent by tapping
    await page.evaluate(() => { ToyTownNew.setWeather('clear', 5); ToyTownNew.setHour(9); });
    const load = await page.evaluate(() => { let seen = null; for (let i = 0; i < 120 && !seen; i++) { ToyTownNew.advance(4, true); if (ToyTownNew.sim.cargo.some(c => c.state === 'train') || ToyTownNew.sim.riders.length) seen = {cargo: ToyTownNew.sim.cargo.filter(c => c.state === 'train').length, riders: ToyTownNew.sim.riders.length}; }
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
    // the journal: a resident's card has a Journal button that opens their day
    await page.evaluate(() => { document.documentElement.classList.remove('ui-off'); ToyTownNew.setHour(15); ToyTownNew.advance(60); ToyTownNew.select({kind: 'resident', id: 'finn'}); ToyTownNew.advance(.1); });
    await page.click('#journalBtn'); await page.waitForTimeout(200); const jtext = await page.evaluate(() => ToyTownNew.paperText()); assert.match(jtext, /Finn the fisherman's day/, 'the journal opens for the selected resident (' + jtext.slice(0, 80) + ')'); await shot('journal');
    await page.evaluate(() => { ToyTownNew.closePaper(); ToyTownNew.select(null); document.documentElement.classList.add('ui-off'); });
    // seasons: each page load is a season; and the sound button starts audio without errors
    const seasonInfo = {};
    for (const name of ['winter', 'autumn']) { const sp = await browser.newPage({viewport: {width: 1100, height: 700}}); sp.on('pageerror', e => errors.push(name + ': ' + e.message));
      if (process.env.THREE_LOCAL) await sp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await sp.goto(`http://127.0.0.1:${port}/toy-town-new.html?clean=1&season=${name}&news=0`); await sp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      await sp.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.setHour(12); ToyTownNew.advance(20); ToyTownNew.look(0, .4, 40, 0); }); await sp.screenshot({path: path.join(out, `new-town-${name}.png`)}); seasonInfo[name] = await sp.evaluate(() => ToyTownNew.info());
      if (name === 'winter') { await sp.setViewportSize({width: 420, height: 800}); await sp.evaluate(() => document.documentElement.classList.remove('ui-off')); await sp.click('#snd'); await sp.waitForTimeout(400);
        seasonInfo.sound = await sp.evaluate(() => ({on: ToyTownNew.sound.enabled, started: ToyTownNew.sound.started, pressed: document.getElementById('snd').getAttribute('aria-pressed')})); }
      await sp.close(); }
    assert.ok(seasonInfo.winter.season === 'winter' && seasonInfo.autumn.season === 'autumn' && seasonInfo.winter.calls <= 135 && seasonInfo.autumn.calls <= 135, 'the seasons draw within budget (' + JSON.stringify(seasonInfo) + ')');
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
        for (const s of ['#chip', '#stack', '#snd', '#set', '#paperBtn', '#photoBtn', '#paper', '#panel', '#card', '#send', '#journalBtn', '#hint']) { const e = document.querySelector(s); if (vis(e)) { const r = e.getBoundingClientRect(); o[s] = [r.left, r.top, r.right, r.bottom]; } }
        const small = []; for (const e of document.querySelectorAll('#snd, #set, #paperBtn, #photoBtn, #card button, #panel button, #paper button, #seasons a')) { const r = e.getBoundingClientRect(); if (r.width && (r.width < 30 || r.height < 30 || (e.id && r.width < 44))) small.push(e.id || e.textContent.trim() || e.tagName); }
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
      await mp.evaluate(() => { ToyTownNew.select(null); document.getElementById('panel').classList.remove('on'); });
      await mp.touchscreen.tap(...(await mp.evaluate(() => { const r = document.getElementById('paperBtn').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }))); await mp.waitForTimeout(500);
      const pap = await mp.evaluate(() => { const o = {}; for (const s of ['#chip', '#stack', '#snd', '#set', '#paperBtn', '#photoBtn', '#paper']) { const b = document.querySelector(s).getBoundingClientRect(); o[s] = [b.left, b.top, b.right, b.bottom]; } return {rects: o, text: ToyTownNew.paperText(), on: document.getElementById('paper').classList.contains('on'), btnW: document.getElementById('paperBtn').getBoundingClientRect().width}; });
      assert.ok(pap.on && /The Toy Town Times/.test(pap.text) && /Weather:/.test(pap.text), 'a finger opens the town paper (' + pap.text.slice(0, 80) + ')'); assert.ok(pap.btnW >= 44, 'the paper button is finger-sized');
      { const nm = Object.keys(pap.rects), cl = []; for (let i = 0; i < nm.length; i++) for (let j = i + 1; j < nm.length; j++) { const a = pap.rects[nm[i]], b = pap.rects[nm[j]]; if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) cl.push(nm[i] + ' x ' + nm[j]); } assert.deepEqual(cl, [], 'the paper clears the other buttons on a phone: ' + JSON.stringify(pap.rects)); }
      await shot2(mp, 'phone-paper'); await mp.evaluate(() => ToyTownNew.closePaper());
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
    // fishing: a fisherman stands at the end of the pier with a rod out, and the sellers are at their stalls on a Sunday
    { const fp = await browser.newPage({viewport: {width: 900, height: 600}}); fp.on('pageerror', e => errors.push('fishing: ' + e.message));
      if (process.env.THREE_LOCAL) await fp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await fp.goto(`http://127.0.0.1:${port}/toy-town-new.html?day=sun&news=0&quality=low`); await fp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      const fish = await fp.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(9); const S = ToyTownNew.sim; const fin = S.residents.find(x => x.id === 'finn'); fin.errands = [['pier', 200]]; fin.until = 0; fin.state === 'inside' && (fin.at = fin.def.home); let who = null; for (let i = 0; i < 500 && !who; i++) { ToyTownNew.advance(2, true); const r = S.residents.find(x => x.at === 'pier' && x.state === 'inside'); if (r) who = r.id; } const d = S.graph.doors.pier; ToyTownNew.look(d.x - 1, d.z, 6, 1.2); ToyTownNew.advance(.2); return {who, rods: ToyTownNew.rodsOut(), caught: S.fishing.caught}; });
      // the fishing game: the card of somebody on the pier offers it; cast, wait for a bite, reel in, and the panel says how it went
      await fp.evaluate(id => { ToyTownNew.select({kind: 'resident', id}); ToyTownNew.freeze(false); }, fish.who); await fp.waitForSelector('#fishBtn:not([hidden])', {timeout: 10000}); await fp.click('#fishBtn'); await fp.waitForSelector('#fishGo'); await fp.click('#fishGo');
      await fp.waitForFunction(() => { const b = document.getElementById('fishGo'); return b && /Reel in/.test(b.textContent); }, null, {timeout: 20000}); await shot2(fp, 'fishing-game'); await fp.click('#fishGo');
      const played = await fp.evaluate(() => ({text: document.getElementById('paper').textContent, phase: ToyTownNew.fishGame.phase})); assert.ok(played.phase === 'done' && /(got away|caught)/.test(played.text), 'the fishing game plays through (' + JSON.stringify(played) + ')');
      assert.equal(await fp.evaluate(() => document.querySelectorAll('#paper .pclose').length), 1, 'the panel has a close button'); await fp.click('#paper .pclose'); assert.equal(await fp.evaluate(() => document.getElementById('paper').classList.contains('on')), false, 'which closes it');
      await shot2(fp, 'fisherman'); await fp.close(); assert.ok(fish.who && fish.rods >= 1, 'a fisherman stands on the pier with a rod out (' + JSON.stringify(fish) + ')'); }
    // nature: hens in their yard, dogs with their owners, a garden belt, dolphins and whales, and the dwarfs' islet with its lantern at dusk
    { const np = await browser.newPage({viewport: {width: 1000, height: 650}}); np.on('pageerror', e => errors.push('nature: ' + e.message));
      if (process.env.THREE_LOCAL) await np.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await np.goto(`http://127.0.0.1:${port}/toy-town-new.html?season=summer&news=0&quality=high&tune=0`); await np.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      const nat = await np.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(10.5); ToyTownNew.advance(70, true); const W = ToyTownNew.wild, S = ToyTownNew.sim, ctx = {hour: 10.5, day: 0, rain: 0, night: 0, dist: 30};
        for (let i = 0; i < 40; i++) W.update(.1, i * .1, ctx); const c = ToyTownNew.coop;
        const hens = W.hens.filter(a => a.g.visible).length, inYard = W.hens.every(a => Math.hypot(a.w.x - a.yard.cx, a.w.z - a.yard.cz) < a.yard.r + .05), dogs = W.pets.filter(a => a.kind === 'dog').map(a => { const o = S.residents.find(r => r.id === a.def.owner), g = ToyTownNew.scene.children.length && null; return {id: a.def.id, owner: a.def.owner, d: Math.hypot(a.w.x - o.x, a.w.z - o.z), ownerState: o.state}; });
        // a leap: dolphins in the air at a known moment, and the pod stays in the sea
        const dol = W.pick.filter(a => a.kind === 'dolphin'); W.update(0, 12.5 * 4 + .8, ctx); const leaping = dol.some(a => a.g.position.y > .5), inSea = dol.every(a => Math.hypot(a.g.position.x / 19.4, a.g.position.z / 15.9) > 1.1);
        // dusk: the dwarfs are out, the cave glows, a lantern is lit
        W.forceDwarfs(3, .32); ToyTownNew.setHour(19.4); W.update(0, 50, {hour: 19.4, day: 1, rain: 0, night: .8, dist: 30}); const dw = W.dwarfs.filter(a => a.g.visible).length, glow = W.islet.userData.glow && W.islet.userData.glow.material.opacity, cave = W.islet.userData.innerMat.opacity;
        W.forceDwarfs(0); ToyTownNew.setHour(10.5); W.update(0, 51, ctx);
        return {hens, inYard, dogs, leaping, inSea, dw, glow, cave, plots: ToyTownNew.plots, calls: ToyTownNew.renderer.info.render.calls, dayDwarfs: W.dwarfs.filter(a => a.g.visible).length}; });
      assert.ok(nat.hens === 10 && nat.inYard, 'six hens and four chicks scratch about inside their yards (' + JSON.stringify([nat.hens, nat.inYard]) + ')'); assert.ok(nat.dogs.length === 3 && nat.dogs.every(d => d.d < 9), 'the dogs are never far from their owners (' + JSON.stringify(nat.dogs) + ')');
      assert.ok(nat.leaping && nat.inSea, 'the dolphins leap and stay out at sea'); assert.ok(nat.dw === 3 && nat.glow > .5 && nat.cave > .3, 'at dusk the dwarfs are out and the cave glows (' + JSON.stringify([nat.dw, nat.glow, nat.cave]) + ')'); assert.equal(nat.dayDwarfs, 0, 'they stay in the cave by day'); assert.ok(nat.plots >= 7 && nat.plots <= 9, 'a few big gardens (' + nat.plots + ' plots including the hen yard)');
      // the nature page lists the dwarf watch, the pets and the gardens; every new voice plays without an error
      const natPage = await np.evaluate(() => { ToyTownNew.openPaper('nature'); const t = ToyTownNew.paperText(); ToyTownNew.closePaper(); const S = ToyTownNew.sound; S.toggle(true); let err = null; try { for (let i = 0; i < 40; i++) S.update({wild: {zoom: .9, hens: true, dogRun: true, cats: true, leap: i % 4 < 2, spout: i % 10 < 4, dwarfs: i % 6 < 3 ? 2 : 0}, dark: 0, rain: 0, season: 'summer', hour: 12}, .6); } catch (e) { err = String(e); } return {t, err, on: S.enabled}; });
      assert.ok(/Dwarf watch/.test(natPage.t) && /Biscuit/.test(natPage.t) && /Gardens/.test(natPage.t), 'the nature page opens (' + natPage.t.slice(0, 120) + ')'); assert.ok(!natPage.err, 'the new voices play without error (' + natPage.err + ')');
      // tap a hen: the card names her
      const card = await np.evaluate(() => { const i = ToyTownNew.critterList().findIndex(c => c.wild && c.describe().title.includes('Rex')); ToyTownNew.select({kind: 'animal', id: i}); return document.getElementById('card').textContent; }); assert.match(card, /Rex the rooster/, 'the card names the rooster (' + card + ')');
      await np.evaluate(() => { ToyTownNew.select(null); const c = ToyTownNew.coop; ToyTownNew.look(c.x, c.z + .2, 6.5, .2); }); await shot2(np, 'hens');
      await np.evaluate(() => ToyTownNew.look(0, .4, 52, 0)); await shot2(np, 'gardens');
      await np.evaluate(() => { const W = ToyTownNew.wild; W.forceDwarfs(3, .32); ToyTownNew.setHour(19.4); W.update(0, 50, {hour: 19.4, day: 1, rain: 0, night: .8, dist: 30}); ToyTownNew.look(17.2, 20.4, 7, 0); }); await shot2(np, 'dwarf-rock');
      await np.evaluate(() => { const W = ToyTownNew.wild; W.forceDwarfs(0); ToyTownNew.setHour(13); W.update(0, 12.5 * 4 + .8, {hour: 13, day: 0, rain: 0, night: 0, dist: 30}); const d = W.pick.find(a => a.kind === 'dolphin'); ToyTownNew.look(d.g.position.x, d.g.position.z, 9, .2); }); await shot2(np, 'dolphins');
      // the boat: tap it, take it out, steer by tapping the sea, and bring it back
      const sail = await np.evaluate(async () => { ToyTownNew.freeze(false); ToyTownNew.setHour(11); const i = ToyTownNew.critterList().findIndex(c => c.boat); ToyTownNew.select({kind: 'animal', id: i}); await new Promise(r => setTimeout(r, 400)); const btn = document.getElementById('sailBtn'), shown = !btn.hidden; btn.click(); const b0 = {x: ToyTownNew.sail.boat().x, z: ToyTownNew.sail.boat().z}; ToyTownNew.sail.tapSea(b0.x + 7, b0.z + 5);
        let moved = 0; for (let k = 0; k < 120 && moved < 4; k++) { await new Promise(r => setTimeout(r, 250)); const b = ToyTownNew.sail.boat(); moved = Math.hypot(b.x - b0.x, b.z - b0.z); } const panel = document.getElementById('paper').textContent; return {shown, moved, panel, trips: ToyTownNew.sail.sim().trips, view: [ToyTownNew.view.tx, ToyTownNew.view.tz]}; });
      assert.ok(sail.shown && sail.moved >= 4 && /At the helm/.test(sail.panel) && sail.trips === 1, 'the boat can be taken out and steered (' + JSON.stringify(sail) + ')'); await shot2(np, 'sailing'); await np.click('#sailBack'); assert.equal(await np.evaluate(() => ToyTownNew.sail.boat()), null, 'and brought back');
      // the chest: with coins in it the tab offers upgrades, buying one puts it in the town
      const chest = await np.evaluate(async () => { ToyTownNew.sim.sea.bonus += 100; ToyTownNew.openPaper('chest'); await new Promise(r => setTimeout(r, 200)); const buyBtn = document.querySelector('#paper button[data-id="bunting"]'), before = ToyTownNew.chest.upg() && ToyTownNew.chest.upg().group.children.length; buyBtn.click(); await new Promise(r => setTimeout(r, 600)); const after = ToyTownNew.chest.upg().group.children.length; return {text: document.getElementById('paper').textContent.slice(0, 200), before, after, state: ToyTownNew.chest.state()}; });
      assert.ok(/Coins in the chest/.test(chest.text) && chest.after > chest.before && chest.state.bought.includes('bunting') && chest.state.spent === 15, 'a chest upgrade can be bought and appears (' + JSON.stringify(chest) + ')'); await np.evaluate(() => ToyTownNew.closePaper());
      await np.close(); }
    // a TV browser (recognised by its user agent) gets lite mode: lowest tier, no shadows, a smaller render size, a lighter scene
    { const tctx = await browser.newContext({userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5) AppleWebKit/537.36 (KHTML, like Gecko) 69.0.3497.106.1/5.5 TV Safari/537.36', viewport: {width: 1920, height: 1080}}), tp = await tctx.newPage(); tp.on('pageerror', e => errors.push('tv: ' + e.message));
      if (process.env.THREE_LOCAL) await tp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await tp.goto(`http://127.0.0.1:${port}/toy-town-new.html?news=0`); await tp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      const tv = await tp.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.setHour(11); ToyTownNew.advance(5); const i = ToyTownNew.renderer.info.render; return {lite: ToyTownNew.lite, tier: ToyTownNew.tier(), pr: ToyTownNew.renderer.getPixelRatio(), shadows: ToyTownNew.renderer.shadowMap.enabled, calls: i.calls, tris: i.triangles}; });
      assert.ok(tv.lite && tv.tier === 'low' && !tv.shadows && tv.pr <= .7 && tv.calls <= 60 && tv.tris < 400000, 'a TV gets the light version (' + JSON.stringify(tv) + ')'); await tctx.close();
      const off = await browser.newPage({viewport: {width: 900, height: 600}}); if (process.env.THREE_LOCAL) await off.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'})); await off.goto(`http://127.0.0.1:${port}/toy-town-new.html?news=0&lite=0`); await off.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000}); assert.equal(await off.evaluate(() => ToyTownNew.lite), false, 'a desktop browser is not lite'); await off.close(); }
    // the Lantern Festival: on a Saturday evening the shore is hung with lanterns, paper boats drift out and fireworks burst; by day none of it shows
    { const lp = await browser.newPage({viewport: {width: 1000, height: 650}}); lp.on('pageerror', e => errors.push('festival: ' + e.message));
      if (process.env.THREE_LOCAL) await lp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await lp.goto(`http://127.0.0.1:${port}/toy-town-new.html?day=sat&news=0&quality=medium&tune=0`); await lp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      const fe = await lp.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); const F = ToyTownNew.fest, vis = () => [F.lanterns.visible, F.boats.visible, F.sparks.visible]; ToyTownNew.setHour(12); const day = vis(); ToyTownNew.setHour(18.8); ToyTownNew.advance(1); const gather = vis(); ToyTownNew.setHour(20.2); ToyTownNew.advance(1); const boats = vis(); ToyTownNew.setHour(21.12); ToyTownNew.advance(1); const fw = vis(); const p = ToyTownNew.sim.graph.doors.pier; ToyTownNew.look(p.x + 3, p.z + 2, 26, .3); return {day, gather, boats, fw, on: !!ToyTownNew.festival()}; });
      assert.deepEqual(fe.day, [false, false, false], 'nothing by day'); assert.deepEqual(fe.gather, [true, false, false], 'lanterns first'); assert.deepEqual(fe.boats, [true, true, false], 'then the boats'); assert.deepEqual(fe.fw, [true, true, true], 'then the fireworks'); assert.ok(fe.on, 'the sim knows it is on'); await shot2(lp, 'festival'); await lp.close(); }
    // emergencies, the town hall, the case book and photo mode
    { const ep = await browser.newPage({viewport: {width: 1000, height: 650}}); ep.on('pageerror', e => errors.push('events: ' + e.message));
      if (process.env.THREE_LOCAL) await ep.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
      await ep.goto(`http://127.0.0.1:${port}/toy-town-new.html?news=0&day=sat&season=winter&quality=low&fresh=1`); await ep.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000});
      const fx = await ep.evaluate(() => { ToyTownNew.freeze(); ToyTownNew.sim.setEvents(false); ToyTownNew.setHour(11); ToyTownNew.advance(10); const out = {winter: ToyTownNew.fxState().decor}; ToyTownNew.sim.trigger('fire'); ToyTownNew.advance(3); out.fire = ToyTownNew.fxState().flames; const inc = ToyTownNew.sim.incident; const d = ToyTownNew.sim.graph.doors[inc.target]; ToyTownNew.look(d.x, d.z, 9, .4); ToyTownNew.advance(.2); return out; });
      await shot2(ep, 'fire'); const fx2 = await ep.evaluate(() => { ToyTownNew.advance(90); const o = {after: ToyTownNew.fxState().flames}; ToyTownNew.sim.trigger('storm'); ToyTownNew.advance(10); const f = ToyTownNew.fxState(); o.debris = f.debris; o.flood = ToyTownNew.sim.incident.flood === true; return o; });
      assert.ok(fx.winter >= 1 && fx.fire === true && fx2.after === false && fx2.debris >= 3 && fx2.flood === true, 'winter ice, a fire with flames that go out, a storm with branches and a rising sea (' + JSON.stringify({fx, fx2}) + ')');
      const ui = await ep.evaluate(() => { ToyTownNew.sim.setEvents(false); document.documentElement.classList.remove('ui-off'); const out = {}; for (const m of ['hall', 'case', 'today']) { ToyTownNew.openPaper(m); out[m] = ToyTownNew.paperText(); } return out; });
      assert.match(ui.hall, /The town hall/); assert.match(ui.case, /The case book/); assert.match(ui.today, /The Toy Town Times/);
      await ep.evaluate(() => ToyTownNew.closePaper());
      await ep.click('#photoBtn'); await ep.waitForSelector('#paper img.shot', {timeout: 5000}); const cap = await ep.evaluate(() => ({img: document.querySelector('#paper img.shot').src.slice(0, 22), text: ToyTownNew.paperText()})); assert.equal(cap.img, 'data:image/jpeg;base64', 'the photo button shows a picture'); assert.match(cap.text, /Postcard.*Polaroid.*Plain/s, 'with frames to choose from');
      const ph = {}; for (const st of ['plain', 'postcard', 'polaroid']) ph[st] = await ep.evaluate(st => ToyTownNew.photo({style: st, caption: 'A fine day in Toy Town'}), st);
      assert.ok(ph.plain.w === ph.plain.rawW && ph.plain.h === ph.plain.rawH, 'a plain photo is the picture itself'); assert.ok(ph.postcard.h > ph.plain.h && ph.polaroid.h > ph.postcard.h && ph.polaroid.w > ph.plain.w, 'frames add a border and a caption strip (' + JSON.stringify([ph.plain.h, ph.postcard.h, ph.polaroid.h]) + ')');
      assert.ok(ph.polaroid.dark > 40 && ph.postcard.dark > 40, 'the caption is drawn (' + ph.postcard.dark + ' dark pixels)'); assert.ok(ph.postcard.url.startsWith('data:image/jpeg;base64,/9j/') && ph.postcard.len > 20000, 'it is a real JPEG (' + ph.postcard.len + ' chars)'); await ep.close(); }
    // picture quality: high has the grass tufts, wind and glow; low has none of them; ?debug=1 shows a readout; the phone starts in the middle
    { const tiers = {}; for (const [name, query] of [['low', 'quality=low&debug=1'], ['high', 'quality=high&debug=1']]) { const qp = await browser.newPage({viewport: {width: 900, height: 600}}); qp.on('pageerror', e => errors.push(name + ' quality: ' + e.message));
        if (process.env.THREE_LOCAL) await qp.route('https://cdn.jsdelivr.net/npm/three@0.187.0/**', r => r.fulfill({path: path.join(process.env.THREE_LOCAL, r.request().url().split('three@0.187.0/')[1]), contentType: 'text/javascript'}));
        await qp.goto(`http://127.0.0.1:${port}/toy-town-new.html?${query}&news=0`); await qp.waitForFunction(() => !!window.ToyTownNew, null, {timeout: 60000}); await qp.waitForTimeout(1500);
        tiers[name] = await qp.evaluate(() => ({tier: ToyTownNew.tier(), tufts: ToyTownNew.tufts.count, sway: ToyTownNew.U.sway.value, waves: ToyTownNew.U.waves.value, time: ToyTownNew.U.time.value, dbg: (document.getElementById('dbg') || {}).textContent || '', locked: ToyTownNew.gov.locked, calls: ToyTownNew.renderer.info.render.calls}));
        if (name === 'high') await shot2(qp, 'quality-high'); await qp.close(); }
      assert.ok(tiers.low.tier === 'low' && tiers.low.tufts === 0 && tiers.low.sway === 0 && tiers.low.waves === 0, 'the low tier has no tufts, wind or waves (' + JSON.stringify(tiers.low) + ')');
      assert.ok(tiers.high.tier === 'high' && tiers.high.tufts > 500 && tiers.high.sway > .9 && tiers.high.waves === 1, 'the high tier has them (' + JSON.stringify(tiers.high) + ')'); assert.ok(tiers.high.time > 0, 'the shader clock runs');
      assert.match(tiers.high.dbg, /fps .* calls .* tris .* ratio .* high/, 'the debug readout says what the picture costs'); assert.ok(tiers.low.locked && tiers.high.locked, 'a requested tier is not overridden'); assert.ok(tiers.high.calls <= 135 && tiers.low.calls <= tiers.high.calls + 2, 'draw calls stay in budget (' + tiers.low.calls + ' low, ' + tiers.high.calls + ' high)');
      assert.equal(await mp0Tier(browser, port, errors), 'medium', 'a phone starts in the middle tier'); }
    console.log('NEW TOWN night', JSON.stringify(night), 'rain', JSON.stringify(wet));
    assert.ok(night.glow && night.calls <= 135 && night.sky !== 'bfe9fb', 'at night the windows glow and the sky is dark (' + night.calls + ' calls)');
    assert.ok(wet.rain > .5 && wet.calls <= 135 && wet.triangles <= 850000, 'in the rain it still draws within budget (' + wet.calls + ' calls, rain ' + wet.rain + ')');
    console.log('NEW TOWN', JSON.stringify(info));
    assert.deepEqual(errors, [], 'no page errors');
    assert.ok(info.calls > 5 && info.calls <= 100, 'the whole town draws in a handful of calls (' + info.calls + ')');
    assert.ok(info.triangles > 100000 && info.triangles <= 850000, 'and within its triangle budget (' + info.triangles + ')');
    assert.ok(info.residentsOut >= 1, 'residents are out and about');
    assert.ok(after.some((s, i) => s !== before[i]), 'vehicles are moving');
    console.log('Toy Town NEW visual PASS: ' + info.calls + ' draw calls, ' + info.triangles + ' triangles, ' + info.residentsOut + ' residents out');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
