/* Real-browser check of the new storybook town (toy-town-new.html): it must start, draw within its budget,
 * have people out and vehicles moving, raise no page errors, and leave screenshots in visual-artifacts/. */
'use strict';
const {chromium} = require('playwright'), {spawn} = require('node:child_process'), fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const port = 8771, out = path.join(__dirname, '../visual-artifacts');
const ready = async () => { for (let n = 0; n < 60; n++) { try { await new Promise((ok, no) => http.get(`http://127.0.0.1:${port}/toy-town-new.html`, r => { r.resume(); r.statusCode === 200 ? ok() : no(new Error('HTTP ' + r.statusCode)); }).on('error', no)); return; } catch (e) { await new Promise(r => setTimeout(r, 250)); } } throw Error('Local site did not start'); };
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
    const views = [['wide', 0, .4, 30, 0], ['square', 0, .3, 12, .5], ['high-street', 7.2, -.6, 11, .2], ['cottage-lane', -7.6, -.4, 12, -.3], ['windmill', 1.2, -7.4, 9, .7], ['behind', 0, .4, 30, 2.4]];
    for (const [name, x, z, d, yaw] of views) { await page.evaluate(([x, z, d, y]) => ToyTownNew.look(x, z, d, y), [x, z, d, yaw]); await page.screenshot({path: path.join(out, `new-town-${name}.png`)}); }
    await page.evaluate(() => ToyTownNew.look(0, .4, 30, 0));
    const info = await page.evaluate(() => ToyTownNew.info());
    const before = await page.evaluate(() => ToyTownNew.sim.vehicles.map(v => v.s)); await page.evaluate(() => ToyTownNew.advance(5)); const after = await page.evaluate(() => ToyTownNew.sim.vehicles.map(v => v.s));
    // night: lit windows (one more draw call), a dark sky; then rain with umbrellas up. Both must stay inside the budgets.
    const shot = async name => page.screenshot({path: path.join(out, `new-town-${name}.png`)});
    await page.evaluate(() => { ToyTownNew.setHour(23); ToyTownNew.look(0, .4, 26, 0); }); await shot('night');
    const night = await page.evaluate(() => ({...ToyTownNew.info(), glow: ToyTownNew.scene.children.some(o => o.isMesh && o.material.isMeshBasicMaterial && o.material.opacity > .9 && o.visible), sky: ToyTownNew.scene.background.getHexString()}));
    await page.evaluate(() => { ToyTownNew.setHour(11); ToyTownNew.setWeather('rain', 600); ToyTownNew.advance(40); ToyTownNew.look(0, .4, 18, 0); }); await shot('rain');
    const wet = await page.evaluate(() => ToyTownNew.info());
    await page.evaluate(() => { ToyTownNew.setWeather('clear', 5); ToyTownNew.setHour(12); ToyTownNew.look(0, .4, 30, 0); });
    console.log('NEW TOWN night', JSON.stringify(night), 'rain', JSON.stringify(wet));
    assert.ok(night.glow && night.calls <= 80 && night.sky !== 'bfe9fb', 'at night the windows glow and the sky is dark (' + night.calls + ' calls)');
    assert.ok(wet.rain > .5 && wet.calls <= 80 && wet.triangles <= 800000, 'in the rain it still draws within budget (' + wet.calls + ' calls, rain ' + wet.rain + ')');
    console.log('NEW TOWN', JSON.stringify(info));
    assert.deepEqual(errors, [], 'no page errors');
    assert.ok(info.calls > 5 && info.calls <= 80, 'the whole town draws in a handful of calls (' + info.calls + ')');
    assert.ok(info.triangles > 100000 && info.triangles <= 800000, 'and within its triangle budget (' + info.triangles + ')');
    assert.ok(info.residentsOut >= 1, 'residents are out and about');
    assert.ok(after.some((s, i) => s !== before[i]), 'vehicles are moving');
    console.log('Toy Town NEW visual PASS: ' + info.calls + ' draw calls, ' + info.triangles + ' triangles, ' + info.residentsOut + ' residents out');
  } finally { if (browser) await browser.close(); server.kill(); }
})().catch(e => { console.error(e); process.exit(1); });
