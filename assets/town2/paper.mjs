// New Toy Town: the town paper. Pure. Turns two snapshots of the day's counters (start, end) into a small newspaper, and a resident's journal into lines.
export const clockText = h => { const m = Math.round(((h % 24) + 24) % 24 * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
// d: {dayName, start, end (snapshots), titles (stories told), marketName, tomorrow: {dayName, market, weekend}}
export function edition(d) {
  const a = d.start, b = d.end, diff = k => Math.max(0, (b[k] || 0) - (a[k] || 0)), items = [];
  const fish = diff('fishCaught'), sold = diff('fishSold'), coins = diff('coins'), delivered = diff('delivered'), rides = diff('ridden'), visits = diff('marketVisits'), rainMin = Math.round(diff('rain') / 20 * 60);
  const rain = rainMin < 20 ? 'Dry all day' : rainMin < 240 ? 'Some rain (' + Math.round(rainMin / 60 * 10) / 10 + ' hours)' : 'A wet day (' + Math.round(rainMin / 60) + ' hours of rain)';
  items.push('Weather: ' + rain + '.');
  if (fish || sold) items.push('The harbour: ' + plural(fish, 'fish') + ' caught, ' + sold + ' sold in town for ' + plural(coins, 'coin') + '.');
  if (delivered || rides) items.push('Goods and travel: ' + plural(delivered, 'delivery', 'deliveries') + ', ' + plural(rides, 'train journey', 'train journeys') + '.');
  if (visits) items.push((d.marketName || 'The market') + ': ' + plural(visits, 'visit') + ' to the stalls.');
  if (d.titles && d.titles.length) items.push('Stories: ' + d.titles.slice(0, 4).join('; ') + (d.titles.length > 4 ? '; and ' + (d.titles.length - 4) + ' more' : '') + '.');
  if (d.incidents && d.incidents.length) items.push('Emergencies: ' + d.incidents.join('; ') + '.');
  if (d.family && d.family.length) items.push('Town news: ' + d.family.slice(0, 4).join('; ') + (d.family.length > 4 ? '; and ' + (d.family.length - 4) + ' more' : '') + '.');
  if (diff('dwarfSeen') || diff('gemsFound')) items.push('Nature notes: ' + [diff('dwarfSeen') ? 'lantern lights were seen out on Dwarf Rock' : '', diff('gemsFound') ? 'a gem left by the dwarfs was found on the harbour beach' : ''].filter(Boolean).join('; ') + '.');
  const fr = diff('friends'); if (fr) items.push('New friendships: ' + plural(fr, 'pair') + ' of neighbours became friends.');
  items.push('The mood of the town: ' + (b.mood > .8 ? 'cheerful' : b.mood > .62 ? 'content' : 'grumpy') + '.');
  if (d.festival) items.push('The Lantern Festival: lanterns along the shore, paper boats afloat from 19:30 and fireworks at 21:00.');
  if (d.tomorrow) items.push('Tomorrow, ' + d.tomorrow.dayName + ': ' + (d.tomorrow.market ? d.tomorrow.market + ' at 9; ' : '') + (d.tomorrow.festival ? 'the Lantern Festival at 18:30; ' : '') + (d.tomorrow.weekend ? 'no school.' : 'school as usual.'));
  let headline = 'A quiet day in Toy Town';
  if (d.family && d.family.some(t => /married|born/.test(t))) headline = d.family.find(t => /married|born/.test(t)); else if (coins >= 8) headline = 'Fish fever: ' + plural(coins, 'coin') + ' earned at the harbour'; else if (visits >= 6) headline = 'Crowds at the market'; else if (d.titles && d.titles.length) headline = d.titles[0]; else if (delivered >= 6) headline = 'The little train had a busy day';
  return {title: 'The Toy Town Times', date: d.dayName, headline, items};
}
// a resident's day: [{h, text}] in order, the last `n`
export const journalLines = (journal, n = 12) => (journal || []).slice(-n).map(e => clockText(e.h) + '  ' + e.text);

// The nature page: what the dwarfs have been up to, the pets and hens, the gardens. d: {wild: {out, sightings, gems, gemsFound, gemCoins, log: [{day, who}]}, nameOf(id), pets: [{name, blurb}], plots: {kind: count}}
export function natureReport(d) {
  const w = d.wild, dwarfs = [w.out ? 'Lanterns are moving on Dwarf Rock right now.' : 'No lights on Dwarf Rock at the moment.', 'Evenings the lanterns were seen: ' + w.sightings + '.', 'Gems found on the harbour beach: ' + w.gemsFound + (w.gemCoins ? ' (worth ' + w.gemCoins + ' coins)' : '') + '.'];
  if (w.gems) dwarfs.push('A gem is waiting on the beach to be picked up.');
  for (const l of (w.log || []).slice(-4).reverse()) dwarfs.push('Day ' + (l.day + 1) + ': ' + d.nameOf(l.who) + ' saw the lanterns.');
  const kinds = Object.entries(d.plots || {}).map(([k, n]) => n + ' ' + ({orchard: 'orchard', maze: 'hedge maze', water: 'water garden', pavilion: 'rose pavilion', wild: 'wildflower field with beehives', allotment: 'allotment', greenhouse: 'greenhouse', coop: 'hen yard'}[k] || k) + (n > 1 ? 's' : ''));
  const sea = d.sea ? [d.sea.trips ? 'Trips in the harbour boat: ' + d.sea.trips + '.' : 'You have not taken the harbour boat out yet: tap it at the pier.', 'Dolphins seen leaping: ' + d.sea.dolphins + '. Whale spouts seen: ' + d.sea.whales + '.', 'Landings on Dwarf Rock: ' + d.sea.islet + (d.sea.dwarfs ? ' (met the dwarfs ' + d.sea.dwarfs + ' time' + (d.sea.dwarfs > 1 ? 's' : '') + ')' : '') + '.'] : [];
  return [{title: 'Dwarf watch', lines: dwarfs}, ...(sea.length ? [{title: 'Sea log', lines: sea}] : []), {title: 'Pets and hens', lines: (d.pets || []).map(p => p.name + ': ' + p.blurb)}, {title: 'Gardens', lines: [kinds.join(', ') + '.']}];
}
