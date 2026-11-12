// New Toy Town: the welcome-back page. Pure. `visit` is {last: ms, streak: days in a row, day: 'YYYY-MM-DD' of the last visit}.
const dayKey = ms => new Date(ms).toISOString().slice(0, 10);
export const AWAY_MIN = 6 * 3600e3;
export function nextVisit(visit, now) {
  const v = visit && Number.isFinite(visit.last) ? visit : null, today = dayKey(now);
  if (!v) return {visit: {last: now, streak: 1, day: today}, away: 0, gift: 0, first: true};
  const gap = now - v.last, yesterday = dayKey(now - 864e5); let streak = v.streak || 1;
  if (v.day === today) return {visit: {last: now, streak, day: today}, away: gap, gift: 0, first: false};
  streak = v.day === yesterday ? streak + 1 : 1;
  return {visit: {last: now, streak, day: today}, away: gap, gift: gap >= AWAY_MIN ? Math.min(10, 1 + streak * 2) : 0, first: false};
}
export const cleanVisit = o => (o && typeof o === 'object' && Number.isFinite(o.last) && o.last > 0 && o.last < 4e12 && typeof o.day === 'string') ? {last: o.last, streak: Math.max(1, Math.min(999, o.streak | 0)), day: o.day.slice(0, 10)} : null;
export const awayText = ms => { const h = Math.round(ms / 3600e3); return h < 24 ? h + ' hours' : Math.round(h / 24) + (h < 36 ? ' day' : ' days'); };
