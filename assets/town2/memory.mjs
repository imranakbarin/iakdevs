// New Toy Town: what residents remember. Pure. Who they have met (a count per person) and where they go (a count per place).
export const bump = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
export const top = (m, n = 1, min = 1) => Object.entries(m).filter(([, v]) => v >= min).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([k]) => k);
export const bond = c => c >= 5 ? 'close friend' : c >= 2 ? 'friend' : c >= 1 ? 'acquaintance' : null;
// a friend (two meetings or more) who is at a public place right now: go and join them. others: [{id, at, inside, asleep}]
export function friendSpot(friends, others, isPublic, here) {
  let best = null, bc = 1;
  for (const o of others) { const c = friends[o.id] || 0; if (c > bc && o.inside && !o.asleep && isPublic(o.at) && o.at !== here) { best = o; bc = c; } }
  return best ? {id: best.id, place: best.at} : null;
}
