// Twin Circuit puzzle rules. Pure, deterministic, browser + Node compatible.
export const DIRS = [0, 1, 2, 3]; // north, east, south, west
export function turn(mask, steps = 1) {
  const n = ((steps % 4) + 4) % 4;
  return ((mask << n) | (mask >> (4 - n))) & 15;
}
export function seeded(seed) {
  let x = (Number(seed) >>> 0) || 1;
  return () => {
    x += 0x6D2B79F5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function edge(a, b, size) {
  if (b === a - size) return 0;
  if (b === a + 1 && Math.floor(a / size) === Math.floor(b / size)) return 1;
  if (b === a + size) return 2;
  if (b === a - 1 && Math.floor(a / size) === Math.floor(b / size)) return 3;
  throw new Error('Nonadjacent circuit path');
}
function nextTo(index, size) {
  const x = index % size, y = Math.floor(index / size), out = [];
  if (y > 0) out.push(index - size);
  if (x < size - 1) out.push(index + 1);
  if (y < size - 1) out.push(index + size);
  if (x > 0) out.push(index - 1);
  return out;
}
function findRoute(size, random) {
  const middle = Math.floor(size / 2), start = middle * size, end = start + size - 1;
  const minLength = size + 3, maxLength = size * 3 + 2;
  let visitedNodes = 0;
  const route = [start], visited = new Set(route);
  function visit(index) {
    if (++visitedNodes > 8000) return false;
    if (index === end) return route.length >= minLength;
    if (route.length >= maxLength) return false;
    const choices = shuffle(nextTo(index, size).filter(n => !visited.has(n)), random);
    for (const candidate of choices) {
      if (candidate === end && route.length + 1 < minLength) continue;
      visited.add(candidate); route.push(candidate);
      if (visit(candidate)) return true;
      route.pop(); visited.delete(candidate);
    }
    return false;
  }
  if (visit(start)) return route;
  // Deterministic serpentine fallback, never an unsolvable randomized board.
  const fallback = [start, start - size, start - size + 1, start - size + 2,
    start + 2, start + size + 2];
  for (let x = 3; x < size; x++) fallback.push(start + size + x);
  fallback.push(end);
  // For all sizes above 5, endpoint is adjacent to the final lower-row cell.
  return fallback;
}
export function makePuzzle(seed, round = 1) {
  const level = Math.max(1, Math.floor(Number(round) || 1));
  const size = Math.min(7, 5 + Math.floor((level - 1) / 3));
  const random = seeded((Number(seed) >>> 0) ^ Math.imul(level, 0x9E3779B1));
  const path = findRoute(size, random);
  const start = path[0], end = path[path.length - 1];
  const actual = new Map();
  for (let k = 0; k < path.length; k++) {
    let mask = 0;
    if (k > 0) mask |= 1 << edge(path[k], path[k - 1], size);
    if (k < path.length - 1) mask |= 1 << edge(path[k], path[k + 1], size);
    if (k === 0) mask |= 1 << 3; // entrance from the west edge
    if (k === path.length - 1) mask |= 1 << 1; // exit to the east edge
    actual.set(path[k], mask);
  }
  const gemIds = [path[Math.floor(path.length / 3)], path[Math.floor(path.length * 2 / 3)]];
  const filler = [5, 10, 3, 6, 12, 9, 7, 11, 13, 14];
  const solution = [];
  const tiles = Array.from({ length: size * size }, (_, index) => {
    const ideal = actual.get(index);
    const mask = ideal === undefined ? filler[Math.floor(random() * filler.length)] : ideal;
    solution[index] = ideal === undefined ? null : mask;
    let rotated = turn(mask, Math.floor(random() * 4));
    return {
      mask: rotated,
      owner: (Math.floor(index / size) + (index % size) + level) & 1,
      gem: gemIds.includes(index)
    };
  });
  const puzzle = {seed: Number(seed) >>> 0, round: level, size, start, end, gems: gemIds, tiles};
  if (trace(puzzle).solved) tiles[start].mask = turn(tiles[start].mask, 1);
  return {puzzle, solution, path};
}
export function trace(puzzle) {
  if (!puzzle || !Array.isArray(puzzle.tiles) || !Number.isInteger(puzzle.size)) {
    return {lit: [], solved: false, gemsLit: 0};
  }
  const {tiles, size, start, end} = puzzle;
  const lit = new Set();
  if (!tiles[start] || !(tiles[start].mask & 8)) return {lit: [], solved: false, gemsLit: 0};
  const queue = [start]; lit.add(start);
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head], x = index % size, y = Math.floor(index / size);
    const neighbors = [y > 0 ? index - size : -1, x < size - 1 ? index + 1 : -1,
      y < size - 1 ? index + size : -1, x > 0 ? index - 1 : -1];
    for (let d = 0; d < 4; d++) {
      const n = neighbors[d];
      if (n < 0 || !(tiles[index].mask & (1 << d)) || !(tiles[n].mask & (1 << ((d + 2) % 4))) || lit.has(n)) continue;
      lit.add(n); queue.push(n);
    }
  }
  const gemsLit = puzzle.gems.filter(g => lit.has(g)).length;
  return {
    lit: [...lit],
    gemsLit,
    solved: lit.has(end) && !!(tiles[end].mask & 2) && gemsLit === puzzle.gems.length
  };
}
export function formatTime(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
export function durationFor(round) {
  return Math.max(105, 155 - Math.floor((Math.max(1, round) - 1) / 2) * 5) * 1000;
}
