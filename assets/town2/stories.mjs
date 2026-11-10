// New Toy Town: small stories. Pure data and a mapper, no THREE and no DOM.
// A story sends a few residents on errands (door to door, like every walk) in some hours and weather, with a caption.
//   hours [from, to) on the day clock; wet: 'dry' (only fine weather), 'wet' (only in rain) or omitted (any);
//   go: [resident, [[place, secondsToStay], ...]]; fire: also send out the fire engine.
export const STORIES = [
  {id: 'milkround',  title: 'Farmer Hay brings the milk to the bakery and the café', hours: [6.5, 10], go: [['hay', [['bakery', 14], ['cafe', 14]]]]},
  {id: 'postround',  title: 'Mr Pott does the post round', hours: [8, 15], go: [['pott', [['c3', 6], ['c4', 6], ['c5', 6], ['post', 12]]]]},
  {id: 'schoolrun',  title: 'Dot, Dash and Pip run to school', hours: [7.2, 9], go: [['dot', [['school', 40]]], ['dash', [['school', 40]]], ['pip', [['school', 30]]]]},
  {id: 'sportsday',  title: 'Sports day at the school', hours: [10, 15], wet: 'dry', go: [['chalk', [['school', 40]]], ['bell', [['school', 30]]], ['dot', [['school', 40]]], ['dash', [['school', 40]]]]},
  {id: 'bookclub',   title: 'Book club at the café', hours: [14, 18], go: [['moss', [['cafe', 40]]], ['chalk', [['cafe', 40]]], ['crumb', [['cafe', 30]]]]},
  {id: 'teatwo',     title: 'Tea for two', hours: [10, 12.5], go: [['crumb', [['cafe', 30]]], ['moss', [['cafe', 30]]]]},
  {id: 'boatrepair', title: 'Sparky mends the boat at the harbour', hours: [9, 16], wet: 'dry', go: [['sparky', [['hut', 30], ['garage', 12]]]]},
  {id: 'shopping',   title: 'Captain Salt goes shopping', hours: [9, 17], go: [['salt', [['bakery', 10], ['toys', 12], ['cafe', 14]]]]},
  {id: 'cakeday',    title: "Mr Crumb takes a cake to Mr Pott's", hours: [9, 17], go: [['crumb', [['c1', 25]]]]},
  {id: 'beat',       title: 'Constable Bell walks the beat', hours: [8, 19], go: [['bell', [['school', 8], ['bakery', 8], ['post', 8], ['toys', 8]]]]},
  {id: 'toycrowd',   title: 'The toy shop is full of children', hours: [11, 17], go: [['dot', [['toys', 30]]], ['dash', [['toys', 30]]], ['tilly', [['toys', 25]]]]},
  {id: 'windmill',   title: 'A visit to the windmill', hours: [10, 16], wet: 'dry', go: [['dot', [['mill', 35]]], ['dash', [['mill', 35]]], ['pip', [['mill', 25]]]]},
  {id: 'station',    title: 'Meeting the little train', hours: [9, 18], go: [['moss', [['station', 35]]], ['tilly', [['station', 30]]]]},
  {id: 'farmvisit',  title: 'Dot and Dash visit the farm', hours: [11, 16], wet: 'dry', go: [['dot', [['farm', 35]]], ['dash', [['farm', 35]]]]},
  {id: 'firedrill',  title: 'Fire drill: the engine goes out', hours: [10, 17], fire: true, go: [['embers', [['fire', 25]]]]},
  {id: 'tillyshop',  title: 'Tilly does the shopping', hours: [9, 18], go: [['tilly', [['bakery', 10], ['toys', 12], ['post', 8]]]]},
  {id: 'stroll',     title: 'An evening stroll to the café', hours: [17, 20], wet: 'dry', go: [['pip', [['cafe', 30]]], ['tilly', [['cafe', 30]]]]},
  {id: 'playtime',   title: 'Playtime at the school', hours: [15, 17], wet: 'dry', go: [['dot', [['school', 40]]], ['dash', [['school', 40]]], ['pip', [['school', 35]]]]},
  {id: 'rainycafe',  title: 'Everyone shelters in the café', hours: [8, 19], wet: 'wet', go: [['moss', [['cafe', 40]]], ['crumb', [['cafe', 40]]], ['pott', [['cafe', 35]]]]},
  {id: 'harbourtrip', title: 'A trip to see the boat', hours: [10, 15], wet: 'dry', go: [['chalk', [['hut', 30]]], ['dot', [['hut', 30]]], ['dash', [['hut', 30]]]]},
  {id: 'tinker',     title: 'Sparky shows off a new gadget', hours: [9, 17], go: [['sparky', [['toys', 20], ['cafe', 15]]], ['pip', [['garage', 25]]]]},
  // only staged by the news
  {id: 'market',     title: 'A busy market morning', hours: [8, 16], news: true, go: [['hay', [['bakery', 12], ['toys', 10]]], ['tilly', [['bakery', 15]]], ['crumb', [['farm', 20]]]]},
  {id: 'party',      title: 'A good-news party at the café', hours: [9, 18], news: true, go: [['crumb', [['cafe', 40]]], ['pott', [['cafe', 40]]], ['moss', [['cafe', 40]]], ['bell', [['cafe', 30]]], ['pip', [['cafe', 30]]]]}
];

// Which story a headline calls up: keywords first, then its category. Rain and fire are staged too.
export function newsStory(title = '', category = '') {
  const t = (title + ' ').toLowerCase();
  if (/\b(rain|storm|flood|weather|monsoon|hurricane)/.test(t)) return {story: 'rainycafe', weather: 'rain'};
  if (/\b(fire|blaze|wildfire|burn)/.test(t)) return {story: 'firedrill'};
  if (/\b(train|rail|tram|metro|bus|transport)/.test(t)) return {story: 'station'};
  if (/\b(boat|ship|sea|ocean|fish|whale|marine|coast)/.test(t)) return {story: 'harbourtrip'};
  if (/\b(farm|crop|food|milk|bread|bake|harvest)/.test(t)) return {story: 'milkround'};
  if (/\b(school|student|child|teacher|education|university)/.test(t)) return {story: 'sportsday'};
  const c = category.toLowerCase();
  if (c.includes('sport')) return {story: 'sportsday'};
  if (c.includes('culture')) return {story: 'bookclub'};
  if (c.includes('science') || c.includes('space')) return {story: 'windmill'};
  if (c.includes('tech')) return {story: 'tinker'};
  if (c.includes('business')) return {story: 'market'};
  if (c.includes('world')) return {story: 'station'};
  if (c.includes('good')) return {story: 'party'};
  return {story: 'teatwo'};
}
