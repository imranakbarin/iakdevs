// New Toy Town: small stories. Pure data and a mapper, no THREE and no DOM.
// A story sends a few residents on errands (door to door, like every walk) in some hours and weather, with a caption.
//   days: 'week' (Monday to Friday) or 'weekend' only; season: only in that season; hours [from, to) on the day clock; wet: 'dry' (only fine weather), 'wet' (only in rain) or omitted (any);
//   relaxed: only half the cast need to be free;  go: [resident, [[place, secondsToStay], ...]]; fire: also send out the fire engine.
import {LIFE_STORIES} from './lives.mjs';
export const STORIES = [
  {id: 'milkround',  title: 'Farmer Hay brings the milk to the bakery and the café', hours: [6.5, 10], go: [['hay', [['bakery', 14], ['cafe', 14]]]]},
  {id: 'postround',  title: 'Mr Pott does the post round', hours: [8, 15], go: [['pott', [['c3', 6], ['c4', 6], ['c5', 6], ['post', 12]]]]},
  {id: 'schoolrun',  title: 'Dot, Dash and Pip run to school', days: 'week', hours: [7.2, 9], go: [['dot', [['school', 40]]], ['dash', [['school', 40]]], ['pip', [['school', 30]]]]},
  {id: 'sportsday',  title: 'Sports day at the school', days: 'week', hours: [10, 15], wet: 'dry', go: [['chalk', [['school', 40]]], ['bell', [['school', 30]]], ['dot', [['school', 40]]], ['dash', [['school', 40]]]]},
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
  {id: 'playtime',   title: 'Playtime at the school', days: 'week', hours: [15, 17], wet: 'dry', go: [['dot', [['school', 40]]], ['dash', [['school', 40]]], ['pip', [['school', 35]]]]},
  {id: 'rainycafe',  title: 'Everyone shelters in the café', hours: [8, 19], wet: 'wet', go: [['moss', [['cafe', 40]]], ['crumb', [['cafe', 40]]], ['pott', [['cafe', 35]]]]},
  {id: 'harbourtrip', title: 'A train trip to see the boat', hours: [8, 15], wet: 'dry', go: [['chalk', [['platform:central', 0, 'ride:harbour'], ['hut', 25], ['platform:harbour', 0, 'ride:central']]], ['dot', [['platform:central', 0, 'ride:harbour'], ['hut', 25], ['platform:harbour', 0, 'ride:central']]], ['dash', [['platform:central', 0, 'ride:harbour'], ['hut', 25], ['platform:harbour', 0, 'ride:central']]]]},
  {id: 'milltrip', title: 'A day out at Windmill Halt', hours: [8, 15], wet: 'dry', go: [['moss', [['platform:central', 0, 'ride:mill'], ['mill', 25], ['platform:mill', 0, 'ride:central']]], ['tilly', [['platform:central', 0, 'ride:mill'], ['mill', 25], ['platform:mill', 0, 'ride:central']]]]},
  {id: 'schooltrip', title: 'The school takes the train', days: 'week', hours: [8, 14], wet: 'dry', go: [['chalk', [['platform:central', 0, 'ride:school'], ['platform:school', 12, null], ['platform:school', 0, 'ride:central']]], ['pip', [['platform:central', 0, 'ride:school'], ['platform:school', 12, null], ['platform:school', 0, 'ride:central']]]]},
  {id: 'harvestfair', relaxed: true, title: 'Harvest fair at the farm', season: 'autumn', days: 'weekend', hours: [10, 16], wet: 'dry', go: [['hay', [['farm', 40]]], ['sprocket', [['farm', 35]]], ['crumb', [['farm', 35]]]]},
  {id: 'blossompicnic', relaxed: true, title: 'A blossom picnic on Windmill Hill', season: 'spring', days: 'weekend', hours: [11, 16], wet: 'dry', go: [['bea', [['mill', 40]]], ['june', [['mill', 40]]], ['dot', [['mill', 35]]]]},
  {id: 'beachday', relaxed: true, title: 'A day by the harbour', season: 'summer', days: 'weekend', hours: [10, 17], wet: 'dry', go: [['salt', [['hut', 40]]], ['finn', [['hut', 40]]], ['dot', [['hut', 35]]]]},
  {id: 'snowday', relaxed: true, title: 'Snow day: cocoa at the café', season: 'winter', days: 'weekend', hours: [10, 16], go: [['dot', [['cafe', 40]]], ['dash', [['cafe', 40]]], ['pott', [['cafe', 35]]]]},
  {id: 'sundaylunch', relaxed: true, title: 'Sunday lunch at the café', days: 'weekend', hours: [12, 14.5], go: [['moss', [['cafe', 45]]], ['pott', [['cafe', 45]]]]},
  {id: 'skating', relaxed: true, title: 'Skating on the frozen pond', season: 'winter', hours: [10, 16], go: [['dot', [['police', 40]]], ['dash', [['police', 40]]], ['pip', [['police', 30]]]]},
  {id: 'boatrace', relaxed: true, title: 'The summer boat race at the harbour', season: 'summer', days: 'weekend', hours: [11, 16], wet: 'dry', go: [['salt', [['hut', 40]]], ['finn', [['hut', 40]]], ['sparky', [['hut', 35]]]]},
  {id: 'leafpiles', relaxed: true, title: 'Jumping in the leaf piles', season: 'autumn', hours: [10, 16], wet: 'dry', go: [['dot', [['bakery', 30]]], ['dash', [['bakery', 30]]]]},
  {id: 'puddlejump', relaxed: true, title: 'Splashing in the spring floods', season: 'spring', hours: [10, 16], go: [['dot', [['mill', 30]]], ['dash', [['mill', 30]]], ['ivy', [['mill', 25]]]]},
  {id: 'concert', relaxed: true, effect: ['evening', 'concert'], title: 'The Saturday band concert', days: 'weekend', hours: [17, 20], go: [['bea', [['toys', 40]]], ['tilly', [['toys', 40]]], ['moss', [['toys', 40]]]]},
  {id: 'filmnight', relaxed: true, effect: ['evening', 'film'], title: 'Film night at the café', days: 'weekend', hours: [17, 20], go: [['pott', [['cafe', 45]]], ['june', [['cafe', 45]]], ['dot', [['cafe', 40]]]]},
  {id: 'harbourlights', relaxed: true, effect: ['harbour', 'lights'], title: 'Strings of lights on the pier: a night walk', hours: [17.5, 20], go: [['salt', [['hut', 35]]], ['finn', [['hut', 35]]]]},
  {id: 'boatwatch', relaxed: true, effect: ['harbour', 'bench'], title: 'Watching the boats from the new bench', hours: [10, 17], go: [['moss', [['hut', 40]]], ['salt', [['hut', 40]]]]},
  {id: 'tinker',     title: 'Sparky shows off a new gadget', hours: [9, 17], go: [['sparky', [['toys', 20], ['cafe', 15]]], ['pip', [['garage', 25]]]]},
  {id: 'snowman',   title: 'Building a snowman at the school', season: 'winter', hours: [10, 16], go: [['dot', [['school', 40]]], ['dash', [['school', 40]]], ['pip', [['school', 30]]]]},
  {id: 'applepick', title: 'Apple picking at the farm', season: 'autumn', hours: [10, 16], wet: 'dry', go: [['hay', [['farm', 35]]], ['dot', [['farm', 35]]], ['dash', [['farm', 35]]]]},
  {id: 'blossomtea', title: 'Blossom tea at the café', season: 'spring', hours: [10, 17], wet: 'dry', go: [['moss', [['cafe', 40]]], ['pott', [['cafe', 40]]]]},
  {id: 'paddle',    title: 'A paddle at the harbour', season: 'summer', hours: [11, 17], wet: 'dry', go: [['salt', [['hut', 35]]], ['dot', [['hut', 35]]], ['dash', [['hut', 35]]]]},
  // only staged by the news
  {id: 'market',     title: 'A busy market morning', hours: [8, 16], news: true, go: [['hay', [['bakery', 12], ['toys', 10]]], ['tilly', [['bakery', 15]]], ['crumb', [['farm', 20]]]]},
  {id: 'party',      title: 'A good-news party at the café', hours: [9, 18], news: true, go: [['crumb', [['cafe', 40]]], ['pott', [['cafe', 40]]], ['moss', [['cafe', 40]]], ['bell', [['cafe', 30]]], ['pip', [['cafe', 30]]]]},
  // the animals, the gardens and the dwarfs
  {id: 'dogbiscuit', title: 'Granny Moss buys a bone-shaped biscuit for Biscuit', hours: [9, 15], go: [['moss', [['bakery', 14]]]]},
  {id: 'pepperplay', relaxed: true, title: 'Dot takes Pepper to the toy shop for a squeaky toy', hours: [15, 18], wet: 'dry', go: [['dot', [['toys', 25]]]]},
  {id: 'henfeed', relaxed: true, title: 'Dot and Dash help Farmer Hay feed the hens', days: 'weekend', hours: [8, 11], wet: 'dry', go: [['hay', [['farm', 30]]], ['dot', [['farm', 30]]], ['dash', [['farm', 30]]]]},
  {id: 'dolphinwatch', relaxed: true, title: 'Dolphins! The children run to the harbour to see them leap', hours: [10, 17], wet: 'dry', go: [['dot', [['hut', 35]]], ['dash', [['hut', 35]]], ['june', [['hut', 30]]]]},
  {id: 'whalewatch', relaxed: true, season: 'summer', title: 'A whale has been spotted far out: everyone gathers on the beach', days: 'weekend', hours: [10, 16], wet: 'dry', go: [['bea', [['hut', 40]]], ['sparky', [['hut', 40]]], ['june', [['hut', 35]]]]},
  {id: 'dwarflights', relaxed: true, title: 'Granny Moss and Mrs Pott watch for lights on Dwarf Rock', hours: [18, 21], wet: 'dry', go: [['moss', [['hut', 40]]], ['pott', [['hut', 40]]]]},
  {id: 'gardentour', relaxed: true, title: "Ivy shows Auntie June and Mrs Pott round her garden", hours: [10, 15], wet: 'dry', go: [['june', [['c9', 35]]], ['pott', [['c9', 35]]], ['ivy', [['c9', 35]]]]},
].concat(LIFE_STORIES);

// Which story a headline calls up: keywords first, then its category. Rain and fire are staged too.
export function newsStory(title = '', category = '') {
  const t = (title + ' ').toLowerCase();
  if (/\b(rain|storm|flood|weather|monsoon|hurricane)/.test(t)) return {story: 'rainycafe', weather: 'rain'};
  if (/\b(fire|blaze|wildfire|burn)/.test(t)) return {story: 'firedrill'};
  if (/\b(train|rail|tram|metro|bus|transport)/.test(t)) return {story: 'milltrip'};
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
