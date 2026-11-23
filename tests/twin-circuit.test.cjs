const assert = require('node:assert/strict');

(async () => {
  const {makePuzzle, turn, trace, formatTime, durationFor} =
    await import('../assets/twin-circuit/engine.mjs');

  for (let mask = 0; mask < 16; mask++) {
    assert.equal(turn(mask, 4), mask, 'four quarter-turns return to start');
    assert.equal(turn(turn(mask)), turn(mask, 2));
    assert.equal(turn(mask, -1), turn(mask, 3));
  }
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(61100), '1:02');
  assert.ok(durationFor(1) > durationFor(8));
  assert.ok(durationFor(500) >= 105000);

  let tested = 0;
  for (let level = 1; level <= 12; level++) {
    for (let seed = 1; seed <= 80; seed++) {
      const a = makePuzzle(seed, level), b = makePuzzle(seed, level);
      assert.deepEqual(a, b, 'same seed and round must yield same board');
      const {puzzle, path, solution} = a;
      const size = puzzle.size;
      assert.equal(puzzle.tiles.length, size * size);
      assert.equal(puzzle.gems.length, 2);
      assert.ok(!trace(puzzle).solved, 'no pre-solved puzzles');
      assert.equal(new Set(path).size, path.length, 'path is self avoiding');
      assert.equal(path[0], puzzle.start);
      assert.equal(path.at(-1), puzzle.end);
      assert.ok(path.length >= size, 'route should contain meaningful steps');
      for (let k = 1; k < path.length; k++) {
        const diff = Math.abs(path[k] - path[k - 1]);
        assert.ok(diff === 1 || diff === size);
        assert.ok(diff !== 1 || Math.floor(path[k] / size) === Math.floor(path[k - 1] / size));
      }
      const owned = [0, 0];
      path.forEach(index => {
        owned[puzzle.tiles[index].owner]++;
        puzzle.tiles[index].mask = solution[index];
      });
      assert.ok(owned[0] > 0 && owned[1] > 0, 'both colors required for every puzzle');
      const lit = trace(puzzle);
      assert.equal(lit.gemsLit, 2);
      assert.equal(lit.solved, true, 'canonical solution connects source, gems and sink');
      assert.equal(lit.lit.includes(puzzle.start), true);
      assert.equal(lit.lit.includes(puzzle.end), true);
      tested++;
    }
  }
  assert.equal(makePuzzle(15, 1).puzzle.size, 5);
  assert.equal(makePuzzle(15, 4).puzzle.size, 6);
  assert.equal(makePuzzle(15, 7).puzzle.size, 7);
  assert.equal(trace(null).solved, false);
  console.log('Twin Circuit: ' + tested + ' deterministic two-player puzzles verified.');
})().catch(error => { console.error(error); process.exitCode = 1; });
