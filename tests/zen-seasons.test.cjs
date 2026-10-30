// Zen garden seasons: open in the calendar's season, turn in order, autumn
// leaves settle on the sand and the ball or the rake sweeps them away, winter
// snows, butterflies visit by day in spring and summer, a crane in autumn and
// winter, each season is named, and a paused garden holds still. Runs the
// module against stubs of the garden globals it reads.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), garden = fs.readFileSync(path.join(root, 'assets/zen-garden.js'), 'utf8');
assert.match(html, /assets\/zen-garden\.js\?v=\d+"><\/script>\s*<script src="assets\/zen-seasons\.js\?v=\d+">/, 'the module loads after the garden');
for (const hook of ['ZenSeasons.under(', 'ZenSeasons.over(', 'ZenSeasons.sweep(', 'ZenSeasons.scare(']) assert.ok(garden.includes(hook), 'the garden calls ' + hook);

const texts = [];
const ctx = new Proxy({}, {get: (o, k) => k in o ? o[k] : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({addColorStop() {}}) : k === 'measureText' ? () => ({width: 120}) : k === 'fillText' ? t => texts.push(t) : () => {}, set: (o, k, v) => { o[k] = v; return true; }});
const sandbox = {Math, Object, Array, Date, SceneMotion: {wind: 0, time: 0}, zenGarden: 'moss', zenHintUntil: 0, zenLength: 0, zenDistance: 0, zenPoint: () => ({x: 550, y: 550})};
const box = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/zen-seasons.js'), 'utf8') + ';this.ZenSeasons = ZenSeasons;', box);
const Z = sandbox.ZenSeasons, L = {w: 1366, h: 800, portrait: false, cx: 649, cy: 420, r: 288};
let t = 0;
const run = (secs, dt = 1 / 30) => { for (let i = 0; i < secs / dt; i++) { t += dt; sandbox.SceneMotion.time = t; Z.under(ctx, L, t, dt); Z.over(ctx, L, t, dt); } };

// The calendar picks the opening season (northern year) and they turn in order.
assert.deepEqual([0, 3, 6, 9].map(m => Z.calendar(new Date(2026, m, 15))), [3, 0, 1, 2], 'Jan winter, Apr spring, Jul summer, Oct autumn');
Z.startAt(2);
const order = [0, 1, 2, 3, 4].map(i => Z.at(i * Z.LEN + 10).s);
assert.deepEqual(order, [2, 3, 0, 1, 2], 'autumn, winter, spring, summer, autumn');
for (let x = 0; x < 4 * Z.LEN; x += 7.3) { const sum = [0, 1, 2, 3].reduce((a, k) => a + Z.weight(x, k), 0); assert.ok(Math.abs(sum - 1) < 1e-9, `the seasons blend to one at ${x}`); }
assert.ok(Z.weight(Z.LEN - 1, 3) > .9 && Z.weight(Z.LEN - 30, 3) === 0, 'the next season fades in over the last moments of the one before');

// Autumn: leaves come down, most of them onto the sand, and stay there.
run(40);
const settled = Z.leaves().length;
assert.ok(settled >= 6, `leaves settle on the sand (${settled})`);
assert.ok(Z.leaves().every(f => Math.hypot(f.x - 550, f.y - 550) < 500), 'only inside the sand bed');
assert.ok(texts.some(s => /^Autumn · /.test(s)), 'the season is named');
// A paused garden holds still.
const still = JSON.stringify(Z.leaves());
for (let i = 0; i < 30; i++) { Z.under(ctx, L, t, 0); Z.over(ctx, L, t, 0); }
assert.equal(JSON.stringify(Z.leaves()), still, 'nothing moves while paused');
// The rake sweeps the leaves it passes; the rest stay.
const f0 = Z.leaves()[0], near = Z.leaves().filter(f => Math.hypot(f.x - f0.x, f.y - f0.y) < 36).length;
assert.equal(Z.sweep(f0.x, f0.y, 36), near, 'the rake catches the leaves under it');
run(1.2);
assert.ok(!Z.leaves().some(f => f.x === f0.x && f.y === f0.y), 'and they are gone a moment later');
// So does the ball as it rolls.
const f1 = Z.leaves().find(f => !f.out);
sandbox.zenLength = 1000; sandbox.zenPoint = () => ({x: f1.x, y: f1.y});
run(1.2);
assert.ok(!Z.leaves().some(f => Math.hypot(f.x - f1.x, f.y - f1.y) < 1), 'the ball sweeps its path clear');
sandbox.zenLength = 0;

// A crane passes over in autumn and winter.
let crane = false;
for (let i = 0; i < 160 && !crane; i++) { run(1); crane = !!Z.crane(); }
assert.ok(crane, 'a crane glides over within a few minutes');

// Winter snows and the leaves stop falling.
Z.startAt(3); t = 0; texts.length = 0;
run(20);
const flakes = Z.falling(3);
assert.ok(flakes > 60, `snow falls (${flakes} flakes)`);
assert.equal(Z.falling(2), 0, 'no new leaves in winter');
assert.ok(texts.some(s => /^Winter · /.test(s)));

// Butterflies by day in summer; they leave the moonlit garden.
Z.startAt(1); t = 0;
run(20);
assert.equal(Z.flies().length, 2, 'two butterflies in summer');
let sat = false;
for (let i = 0; i < 120 && !sat; i++) { run(1); sat = Z.flies().some(f => f.sit > 0); }
assert.ok(sat, 'a butterfly settles on the sand');
const b = Z.flies().find(f => f.sit > 0);
assert.ok(Z.scare(b.x * L.w, b.y * L.h), 'a tap beside it is noticed');
assert.ok(!Z.flies().some(f => f.sit > 0 && f.x === b.x && f.y === b.y), 'and it lifts off');
sandbox.zenGarden = 'moon';
run(30);
assert.equal(Z.flies().length, 0, 'no butterflies at night');
sandbox.zenGarden = 'moss';

console.log(`Zen seasons PASS: opens in the calendar's season and turns in order with smooth blends; ${settled} autumn leaves settled, swept by rake and ball; a crane; ${flakes} flakes in winter; butterflies settle, notice a tap, and stay out of the moonlit garden; paused holds still.`);
