// New Toy Town: the story director. Pure. Given the stories that could start now, it chooses by the state of the land and the town: a story with `needs` only
// happens when the land has earned it (and is then three times as likely); yesterday's follow-up gets a head start; the rest are picked as before, the least told first.
export function weightOf(s, ctx) {
  const follow = ctx.followUp === s.id;
  if (s.needs && !follow && !s.needs(ctx.eco)) return 0;
  let w = (ctx.count[s.id] || 0) === ctx.least ? 1 : .35;
  if (s.needs) w *= 3;
  if (s.star && !(ctx.count[s.id])) w *= 4;   // a resident's own story, not told yet, is a little more likely: everybody gets their turn
  if (follow) w += 8;
  return w;
}
export function pick(ok, ctx, rnd) {
  const ws = ok.map(s => weightOf(s, ctx)), total = ws.reduce((a, b) => a + b, 0); if (total <= 0) return null;
  let x = rnd() * total; for (let i = 0; i < ok.length; i++) { x -= ws[i]; if (x <= 0) return ok[i]; } return ok[ok.length - 1];
}
