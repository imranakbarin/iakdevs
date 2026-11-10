// New Toy Town: everyone has stories. Each resident has a job (shown on their card) and at least one story of their own, which the town tells now and then.
// A life story is an ordinary story (see stories.mjs) with `star`: the one it is about, and it needs only part of its cast to be free.
export const JOBS = {
  crumb: 'Baker at the Bakery', pott: 'Keeps the Teapot Café', bell: 'Constable on the beat', pip: 'Postman', tilly: 'Keeps the toy shop', embers: 'Fire chief',
  moss: 'Retired: tea, gossip and train trips', sprocket: 'Miller at the windmill', hay: 'Farmer', chalk: 'Teacher at the school', sparky: 'Mechanic at the garage',
  salt: 'Sea captain, now a fisherman', wick: 'Lamplighter', ada: 'Lamplighter (apprentice)', lew: 'Lamplighter (apprentice)', dot: 'Schoolgirl', dash: 'Schoolboy',
  ivy: 'Gardener', rudy: 'Paper boy', nell: 'Nurse', otto: 'Stationmaster', bea: 'Bandleader', finn: 'Fisherman', june: 'Makes cakes and gives advice', ted: 'Train driver',
  gill: 'Fishmonger', apple: 'Greengrocer', mint: 'Doctor'
};
// [star, id, title, hours, days, go]   (days: 'week', 'weekend' or null for any)
const L = [
  ['crumb', 'newrecipe', 'Mr Crumb tries a new recipe and asks the café to taste it', [8, 12], null, [['crumb', [['cafe', 20]]], ['pott', [['bakery', 12]]]]],
  ['crumb', 'ovenfire', 'Mr Crumb has burnt the loaves: Chief Embers comes to look', [7, 11], null, [['embers', [['bakery', 18]]], ['crumb', [['bakery', 20]]]]],
  ['pott', 'teaparty', 'Mrs Pott holds a tea party for her friends', [14, 17], null, [['pott', [['cafe', 40]]], ['moss', [['cafe', 40]]], ['june', [['cafe', 40]]]]],
  ['bell', 'lostcap', 'Constable Bell loses his helmet and everyone helps look', [9, 15], null, [['bell', [['toys', 10], ['bakery', 10], ['post', 10], ['police', 15]]]]],
  ['pip', 'lettersort', 'Postie Pip sorts a sack of letters with Rudy', [8, 11], null, [['pip', [['post', 25]]], ['rudy', [['post', 25]]]]],
  ['tilly', 'newtoy', 'Tilly unpacks a new toy and the children come running', [10, 15], 'week', [['tilly', [['toys', 30]]], ['dot', [['toys', 20]]], ['dash', [['toys', 20]]]]],
  ['embers', 'hosepolish', 'Chief Embers polishes the fire engine for the show', [9, 14], null, [['embers', [['fire', 35]]], ['sparky', [['fire', 20]]]]],
  ['moss', 'oldphotos', 'Granny Moss shows old photographs of the town at the café', [10, 16], null, [['moss', [['cafe', 40]]], ['bell', [['cafe', 20]]]]],
  ['sprocket', 'flourday', 'Mr Sprocket grinds a big batch of flour and brings it to the bakery', [8, 12], null, [['sprocket', [['mill', 15], ['bakery', 15]]], ['crumb', [['bakery', 20]]]]],
  ['hay', 'lambs', 'Farmer Hay shows the new lambs to the children', [10, 15], 'weekend', [['hay', [['farm', 40]]], ['dot', [['farm', 30]]], ['dash', [['farm', 30]]]]],
  ['chalk', 'nature', 'Miss Chalk takes her class on a nature walk', [9, 13], 'week', [['chalk', [['school', 10], ['mill', 25], ['school', 10]]], ['dot', [['mill', 25]]], ['dash', [['mill', 25]]]]],
  ['sparky', 'gadget', 'Sparky builds a clockwork duck at the garage', [9, 16], null, [['sparky', [['garage', 40]]], ['pip', [['garage', 15]]]]],
  ['salt', 'bigcatch', 'Captain Salt tells the tale of the one that got away', [14, 18], null, [['salt', [['cafe', 40]]], ['finn', [['cafe', 25]]], ['moss', [['cafe', 25]]]]],
  ['wick', 'lampclean', 'Mr Wick cleans the lamp at the clock tower', [10, 15], null, [['wick', [['cafe', 12], ['c6', 20]]]]],
  ['ada', 'lampgirl', 'Ada practises with the lighting pole', [11, 16], null, [['ada', [['bakery', 12], ['c9', 20]]]]],
  ['lew', 'lampboy', 'Lew races Ada to the first lamp', [11, 16], null, [['lew', [['post', 12], ['c15', 20]]], ['ada', [['post', 12]]]]],
  ['dot', 'spelling', 'Dot has her spelling test and is nervous', [8, 10], 'week', [['dot', [['school', 40]]], ['chalk', [['school', 40]]]]],
  ['dash', 'kite', 'Dash flies a kite with Dot on Windmill Hill', [11, 16], 'weekend', [['dash', [['mill', 40]]], ['dot', [['mill', 40]]]]],
  ['ivy', 'newflowers', 'Ivy plants new flowers round the clock tower', [9, 14], null, [['ivy', [['cafe', 10], ['farm', 20]]]]],
  ['rudy', 'papers', 'Rudy delivers an extra edition of the paper', [7, 10], null, [['rudy', [['post', 12], ['c1', 5], ['c3', 5], ['c12', 5]]]]],
  ['nell', 'checkup', 'Nurse Nell visits Granny Moss for a check-up', [10, 15], null, [['nell', [['mushroom', 25]]], ['moss', [['mushroom', 25]]]]],
  ['otto', 'timetable', 'Otto repaints the station timetable board', [9, 15], null, [['otto', [['station', 40]]], ['ted', [['station', 25]]]]],
  ['bea', 'rehearsal', 'Bea rehearses the band for the next concert', [14, 18], null, [['bea', [['toys', 15], ['cafe', 30]]], ['tilly', [['cafe', 30]]]]],
  ['finn', 'fishsupper', 'Finn brings his best catch to the café for tonight', [11, 15], null, [['finn', [['hut', 15], ['cafe', 20]]], ['pott', [['cafe', 20]]]]],
  ['june', 'cakebake', 'Auntie June bakes a cake for the whole street', [9, 14], null, [['june', [['bakery', 12], ['c1', 20]]], ['pott', [['c1', 20]]]]],
  ['ted', 'whistle', 'Ted polishes the engine and tries the whistle', [8, 15], null, [['ted', [['station', 40]]], ['otto', [['station', 20]]]]],
  ['gill', 'fishstall', 'Mrs Gill sets up the fish stall by the harbour', [8, 13], null, [['gill', [['hut', 25], ['cafe', 15]]], ['finn', [['hut', 25]]]]],
  ['apple', 'orchard', 'Mr Apple picks the first apples with Farmer Hay', [9, 15], null, [['apple', [['farm', 30]]], ['hay', [['farm', 30]]]]],
  ['mint', 'housecall', 'Dr Mint goes on a round of house calls', [9, 16], null, [['mint', [['c1', 8], ['c4', 8], ['c9', 8], ['mushroom', 10]]]]],
  ['mint', 'lollipops', 'Dr Mint gives out lollipops at the school', [10, 14], 'week', [['mint', [['school', 20]]], ['dot', [['school', 20]]], ['dash', [['school', 20]]]]]
];
export const LIFE_STORIES = L.map(([star, id, title, hours, days, go]) => ({id: 'life-' + id, star, title, hours, ...(days ? {days} : {}), relaxed: true, go}));
