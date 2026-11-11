/* Soak test for the new town's simulation: many simulated days on several seeds, weekdays and seasons, checking every
 * day that nothing is stuck, nothing is NaN, nothing grows without bound and every part of the town keeps working.
 * Usage: node scripts/soak-town2.cjs [days=30] [seeds=3]   (it prints one line per run and exits 1 on the first problem) */
'use strict';
const path = require('node:path'), {pathToFileURL} = require('node:url');
const days = +process.argv[2] || 30, runs = +process.argv[3] || 3, DT = .05;
(async () => {
  const S = await import(pathToFileURL(path.join(__dirname, '../assets/town2/sim.mjs')).href), def = await import(pathToFileURL(path.join(__dirname, '../assets/town2/def.mjs')).href);
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'], problems = [];
  const fail = (msg, ctx) => { problems.push(msg + ' ' + JSON.stringify(ctx || {})); };
  for (let k = 0; k < runs; k++) {
    const seed = [7, 3, 11, 5, 9][k % 5], season = SEASONS[k % 4], weekday = (k * 2) % 7, sim = S.createSim(seed, {season, weekday}), t0 = Date.now(); const dayMs = []; let tDay = Date.now(), lastDeliv = 0, lastRides = 0, lastLaps = 0; const stillSince = {}, maxes = {cargo: 0, stock: 0, journal: 0, log: 0, riders: 0, walkers: 0, sagaLog: 0};
    for (let d = 0; d < days; d++) {
      for (let i = 0; i < 20 * def.DAY; i++) {
        sim.update(DT);
        if (i % 40) continue;   // every two seconds of simulation
        let walkers = 0;
        for (const r of sim.residents) {
          if (!Number.isFinite(r.x) || !Number.isFinite(r.z)) fail('NaN position', {id: r.id, day: d});
          if (r.state === 'walking') { walkers++; if (!r.route && !(r.lampWait > 0)) fail('walking with no route', {id: r.id, day: d});
            const key = Math.round(r.x * 20) + ',' + Math.round(r.z * 20); if (stillSince[r.id] && stillSince[r.id].key === key) { if (sim.clock - stillSince[r.id].t > 120 && !(r.pause > 0) && !(r.lampWait > 0)) fail('stuck walking for 120 s', {id: r.id, day: d, at: key}); } else stillSince[r.id] = {key, t: sim.clock}; } else delete stillSince[r.id];
          if (r.state === 'inside' && !r.at) fail('inside nowhere', {id: r.id, day: d});
          if (r.state === 'riding' && !sim.riders.includes(r)) fail('riding but not on the train', {id: r.id, day: d});
          for (const n of ['hunger', 'tired', 'lonely']) if (!(r.needs[n] >= 0 && r.needs[n] <= 1)) fail('need out of range', {id: r.id, n, v: r.needs[n]});
          if (r.journal.length > 40) fail('journal too long', {id: r.id, n: r.journal.length}); maxes.journal = Math.max(maxes.journal, r.journal.length);
          if (r.errands.length > 8) fail('too many errands', {id: r.id, n: r.errands.length});
          if (!(r.age >= 0 && r.age < 130)) fail('age out of range', {id: r.id, age: r.age}); if (r.kids > 2) fail('too many kids', {id: r.id});
        }
        for (const v of sim.vehicles) if (!Number.isFinite(v.x) || !Number.isFinite(v.z)) fail('NaN vehicle', {id: v.id, day: d});
        if (!Number.isFinite(sim.train.s)) fail('NaN train', {day: d});
        if (sim.cargo.length > 14) fail('too much cargo', {n: sim.cargo.length, day: d}); if (sim.riders.length > sim.train.seats) fail('too many riders', {day: d});
        if (sim.fishing.stock > 40) fail('fish piling up', {stock: sim.fishing.stock, day: d}); if (sim.fishing.stock < 0) fail('negative fish', {day: d});
        for (const k2 of ['cargo', 'stock', 'riders']) { /* tracked below */ }
        maxes.cargo = Math.max(maxes.cargo, sim.cargo.length); maxes.stock = Math.max(maxes.stock, sim.fishing.stock); maxes.riders = Math.max(maxes.riders, sim.riders.length); maxes.walkers = Math.max(maxes.walkers, walkers); maxes.log = Math.max(maxes.log, sim.freightLog.length);
      }
      { const m = sim.mystery.active; if (m && !m.over && d % 3 !== 2) sim.accuse(d % 2 ? m.culprit : sim.residents.find(r => r.id !== m.culprit && !m.wrong.includes(r.id)).id); if (sim.election.open) sim.castVote(sim.election.q.options[d % 2].id); }
      dayMs.push(Date.now() - tDay); tDay = Date.now();
      const st = sim.freightStats, dayDeliv = st.delivered - lastDeliv, dayRides = sim.train.ridden - lastRides, dayLaps = sim.train.laps - lastLaps; lastDeliv = st.delivered; lastRides = sim.train.ridden; lastLaps = sim.train.laps;
      if (d >= 1 && dayLaps < 3) fail('the train is not running', {day: d, laps: dayLaps}); if (d >= 1 && dayDeliv < 1 && sim.weather.rain < .5) fail('nothing delivered all day', {day: d});
      if (sim.days.length !== d + 2 && sim.days.length !== d + 1) fail('ledger out of step', {days: sim.days.length, d});
      if (sim.freightLog.length > 12) fail('freight log not capped', {n: sim.freightLog.length}); maxes.sagaLog = Math.max(maxes.sagaLog, sim.sagaLog.length);
      const p = sim.paper('today'); if (!p || !p.items.length || !p.headline) fail('empty paper', {day: d}); const y = d ? sim.paper('yesterday') : null; if (d && (!y || !y.items.length)) fail('empty yesterday paper', {day: d});
    }
    const first = dayMs.slice(0, 5).reduce((a, b) => a + b, 0) / 5, last = dayMs.slice(-5).reduce((a, b) => a + b, 0) / 5;
    if (last > first * 2.5 + 200) fail('the simulation slows down over time', {firstMsPerDay: Math.round(first), lastMsPerDay: Math.round(last)});
    const married = sim.residents.filter(r => r.spouse).length / 2, summary = {seed, season, weekday, days, seconds: ((Date.now() - t0) / 1000).toFixed(1), delivered: sim.freightStats.delivered, cancelled: sim.freightStats.cancelled, fishSold: sim.fishing.sold, coins: sim.fishing.coins, rides: sim.train.ridden, laps: sim.train.laps, incidents: sim.incidentLog.length, married, babies: sim.babies.length, votes: Object.keys(sim.effects).length, cases: sim.mystery.solved + sim.mystery.failed, storiesTold: sim.story.log.length, sagaLog: sim.sagaLog.length, maxes, msPerDay: [Math.round(first), Math.round(last)]};
    console.log('SOAK ' + JSON.stringify(summary));
  }
  if (problems.length) { const uniq = [...new Set(problems.map(p => p.replace(/"day":\d+/, '"day":N').replace(/"id":"\w+"/, '"id":X')))]; console.error('SOAK FOUND ' + problems.length + ' problems (' + uniq.length + ' kinds):\n' + uniq.slice(0, 30).join('\n')); process.exit(1); }
  console.log('SOAK PASS: ' + runs + ' runs of ' + days + ' days');
})().catch(e => { console.error(e); process.exit(1); });
