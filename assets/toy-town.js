/* Toy Town: a busy little isometric town where something silly is always
 * happening. A new town is laid out every day (seeded by the date), and the
 * day's theme comes from the news: a light story from Wikipedia's "In the
 * news" (sport, space, elections, festivals, awards, tech, animals, markets,
 * science) turns into a rocket launch, a big match, a rally, fireworks…
 * Stories about deaths, wars, attacks or disasters are never used; without a
 * usable story (or offline) the date picks the theme. Cars and people move on
 * the streets and chaos events overlap: runaway carts, burst hydrants, cats
 * on roofs and the fire truck that comes for them, escaping balloons,
 * pigeons, banana peels, a UFO now and then. The camera stays still until dragged, a ticker reports the action,
 * and a tap anywhere pokes the town. */
const ToyTown = (() => {
  const cv = document.getElementById('town'), ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  const N = 18, TW = 32, TH = 16, LINES = [1, 6, 11, 16];
  const isRoad = i => LINES.includes(i);
  const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return h >>> 0; };
  const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;
  const dateKey = (d = new Date()) => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const today = () => dateKey(), narrow = () => typeof innerWidth === 'number' && innerWidth < 700;
  let rnd = Math.random, seed = 0, day = '', theme = null, newsLine = '', today_ = [], nextHeadline = 12, headIx = 0;
  let W = 0, H = 0, dpr = 1, S = 1, cam = {x: N / 2, y: N / 2, z: 1, tx: N / 2, ty: N / 2, tz: 1, yaw: 0, tyaw: 0}, base = 1;
  let grid = [], buildings = [], props = [], movers = [], events = [], parts = [], bubbles = [], ground = null, sprites = new Map();
  const MIN_ZOOM = .42, MAX_ZOOM = 3.25, PAN = .6;   // how near the board edge the view may be dragged (the station and railway sit out there)
  let zoomAnchor = null, nextStreetMoment = 16, streetMoments = 0, fitZoom = 1;
  const PACE = .82, CARS = 7, BIKES = 4, PEOPLE = 14, LIGHT = 10;   // a calm town: few cars, a handful of cyclists, people taking their time   // the whole town runs at 60% speed: easier to follow, calmer to watch
  let separated = 0;
  let clock = 0, playing = true, last = 0, nextEvent = 2, director = null, directorUntil = 0;
  let community = null, communityEncounters = 0, communityVisits = 0;
  let streetTrade=null,streetTransactions=0,streetShopVisits=0,newsReactions=0;
  let nextPerformance=13,streetPerformances=0;
  let districts=[],districtVisits=0,districtMeetings=0,districtTasks=0;
  const STREETS = ['Maple St', 'Elm Ave', 'Pickle Lane', 'Gumdrop Rd', 'Button Way', 'Teapot St', 'Biscuit Ave', 'Puddle Lane'];
  const streetOf = (x, y) => STREETS[(isRoad(Math.floor(x)) ? LINES.indexOf(Math.floor(x)) : 4 + Math.max(0, LINES.indexOf(Math.floor(y)))) % STREETS.length];

  /* ---------------- themes from the news ---------------- */
  const THEMES = {
    sports: {title: 'Big Match Day', emoji: '⚽', words: ['football', 'soccer', 'cup', 'olympic', 'cricket', 'tennis', 'league', 'championship', 'grand prix', 'marathon', 'medal', 'world series', 'tournament', 'formula one', 'rugby', 'golf', 'final']},
    space: {title: 'Rocket Launch Day', emoji: '🚀', words: ['space', 'rocket', 'nasa', 'isro', 'esa', 'spacex', 'moon', 'mars', 'satellite', 'astronaut', 'orbit', 'lunar', 'telescope', 'asteroid', 'comet', 'spacecraft']},
    election: {title: 'Election Fever', emoji: '🗳️', words: ['election', 'elected', 'vote', 'votes', 'referendum', 'prime minister', 'president', 'parliament', 'campaign', 'sworn in', 'inaugurat']},
    festival: {title: 'Festival Night', emoji: '🎆', words: ['festival', 'celebrat', 'diwali', 'christmas', 'halloween', 'new year', 'carnival', 'eid', 'holi', 'anniversary', 'lantern']},
    awards: {title: 'Red Carpet Day', emoji: '🎬', words: ['award', 'prize', 'nobel', 'oscar', 'grammy', 'emmy', 'booker', 'film', 'album', 'concert', 'singer', 'box office']},
    tech: {title: 'Robot Rush', emoji: '🤖', words: ['artificial intelligence', 'robot', 'technology', 'software', 'chip', 'computer', 'smartphone', 'internet', 'quantum', 'ai']},
    animals: {title: 'Zoo Escape', emoji: '🐘', words: ['zoo', 'panda', 'whale', 'species', 'wildlife', 'elephant', 'dinosaur', 'fossil', 'penguin']},
    market: {title: 'Market Mania', emoji: '💸', words: ['economy', 'stock', 'market', 'inflation', 'trade', 'budget', 'gdp', 'currency', 'bitcoin', 'interest rate']},
    science: {title: 'Mad Science Day', emoji: '🧪', words: ['scientist', 'discover', 'research', 'physics', 'chemistry', 'experiment', 'genome']},
    weather: {title: 'Wild Weather', emoji: '🌧️', words: []}   // only ever picked by date, never from a story
  };
  // A story that mentions any of these is never turned into a toy.
  // Whole words, and word beginnings ending in '*' (so "fire" never blocks "fireworks").
  const GRIM = ['kill*', 'dead', 'death*', 'dies', 'died', 'dying', 'war', 'wars', 'warfare', 'attack*', 'bomb*', 'shoot*', 'shot', 'murder*', 'crash*', 'earthquake*', 'flood*', 'wildfire*', 'blaze', 'hostage*', 'terror*', 'massacre*', 'injur*', 'victim*', 'famine*', 'disaster*', 'missile*', 'airstrike*', 'genocide*', 'explosion*', 'exploded', 'blast', 'casualt*', 'storm*', 'hurricane*', 'cyclone*', 'typhoon*', 'epidemic*', 'outbreak*', 'invasion*', 'invade*', 'military', 'troops', 'conflict*', 'arrest*', 'sentenc*', 'resign*', 'scandal*', 'protest*', 'riot*', 'coup', 'drown*', 'collapse*', 'missing', 'refugee*', 'abuse*', 'trial', 'prison*', 'jail*', 'suicide*', 'sank', 'sinking', 'fire', 'fires', 'burned', 'shelling', 'hamas', 'gaza', 'ukraine', 'violence', 'violent', 'stabb*', 'gunman', 'hijack*'];
  const esc = w => w.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const has = (text, w) => w.endsWith('*') ? new RegExp('\\b' + esc(w.slice(0, -1)), 'i').test(text) : new RegExp('\\b' + esc(w) + '\\b', 'i').test(text);
  // Picks a theme from a list of story texts; returns {key, story} or null.
  // The specific kind of story picks a variant of its theme, so the town matches
  // the news: a cricket story gets cricket, Diwali gets lamps, a fossil a dinosaur.
  // Order matters: the specific ones come before their theme's catch-all.
  const VARIANTS = [
    ['sports', 'cricket', ['cricket', 'test match', 'wicket', 'ipl', 't20'], 'Cricket Day', '🏏'],
    ['sports', 'tennis', ['tennis', 'wimbledon', 'grand slam'], 'Tennis Day', '🎾'],
    ['sports', 'race', ['formula one', 'grand prix', 'f1', 'motorsport', 'nascar'], 'Grand Prix Day', '🏎️'],
    ['sports', 'marathon', ['marathon', 'cycling', 'tour de france', 'athletics'], 'Marathon Day', '🏃'],
    ['sports', 'medals', ['olympic', 'paralympic', 'medal', 'world championships'], 'Medal Day', '🥇'],
    ['sports', 'football', ['football', 'soccer', 'cup', 'league', 'fifa'], 'Big Match Day', '⚽'],
    ['sports', 'match', ['championship', 'tournament', 'final', 'rugby', 'golf', 'basketball', 'baseball', 'hockey', 'world series'], 'Big Match Day', '🏆'],
    ['space', 'moon', ['moon', 'lunar', 'artemis', 'chandrayaan'], 'Moonshot Day', '🌕'],
    ['space', 'mars', ['mars', 'martian', 'rover'], 'Mars Day', '🔴'],
    ['space', 'comet', ['comet', 'asteroid', 'meteor', 'eclipse', 'telescope'], 'Sky Show', '☄️'],
    ['space', 'launch', ['space', 'rocket', 'nasa', 'isro', 'esa', 'spacex', 'satellite', 'astronaut', 'orbit', 'spacecraft'], 'Rocket Launch Day', '🚀'],
    ['election', 'vote', ['election', 'elected', 'vote', 'votes', 'referendum', 'prime minister', 'president', 'parliament', 'campaign', 'sworn in', 'inaugurat'], 'Election Fever', '🗳️'],
    ['festival', 'diwali', ['diwali', 'deepavali'], 'Diwali Lights', '🪔'],
    ['festival', 'christmas', ['christmas', 'santa'], 'Christmas in Toy Town', '🎄'],
    ['festival', 'halloween', ['halloween'], 'Spooky Day', '🎃'],
    ['festival', 'newyear', ['new year', 'hogmanay'], 'New Year Countdown', '🎉'],
    ['festival', 'holi', ['holi'], 'Holi Colours', '🌈'],
    ['festival', 'eid', ['eid', 'ramadan'], 'Eid Lanterns', '🏮'],
    ['festival', 'fest', ['festival', 'celebrat', 'carnival', 'anniversary', 'lantern', 'parade'], 'Festival Night', '🎆'],
    ['awards', 'music', ['music', 'album', 'concert', 'singer', 'grammy', 'song'], 'Concert Night', '🎵'],
    ['awards', 'nobel', ['nobel'], 'Prize Day', '🏅'],
    ['awards', 'film', ['film', 'movie', 'oscar', 'award', 'prize', 'emmy', 'box office', 'booker'], 'Red Carpet Day', '🎬'],
    ['tech', 'phone', ['smartphone', 'iphone', 'phone'], 'Phone Frenzy', '📱'],
    ['tech', 'robots', ['artificial intelligence', 'robot', 'ai', 'chatbot'], 'Robot Rush', '🤖'],
    ['tech', 'drones', ['technology', 'software', 'chip', 'computer', 'internet', 'quantum', 'drone'], 'Drone Delivery Day', '📦'],
    ['animals', 'panda', ['panda'], 'Panda Visit', '🐼'],
    ['animals', 'whale', ['whale', 'dolphin'], 'Whale Watch', '🐋'],
    ['animals', 'dino', ['dinosaur', 'fossil'], 'Dino Day', '🦕'],
    ['animals', 'penguin', ['penguin'], 'Penguin Parade', '🐧'],
    ['animals', 'zoo', ['zoo', 'species', 'wildlife', 'elephant'], 'Zoo Escape', '🐘'],
    ['market', 'coins', ['bitcoin', 'crypto', 'gold price'], 'Coin Rain', '🪙'],
    ['market', 'stocks', ['economy', 'stock', 'market', 'inflation', 'trade', 'budget', 'gdp', 'currency', 'interest rate'], 'Market Mania', '💸'],
    ['science', 'lab', ['scientist', 'discover', 'research', 'physics', 'chemistry', 'experiment', 'genome'], 'Mad Science Day', '🧪'],
    ['weather', 'rain', [], 'Wild Weather', '🌧️'], ['weather', 'snow', [], 'Snow Day', '❄️'], ['weather', 'wind', [], 'Windy Day', '🌬️']
  ].map(([key, variant, words, title, emoji]) => ({key, variant, words, title, emoji}));
  // Up to three light stories, each a different theme; the first leads the day.
  function newsThemes(stories, max = 3) {
    const out = [];
    for (const story of stories) {
      if (out.length >= max || GRIM.some(w => has(story, w))) continue;
      const v = VARIANTS.find(v => v.words.some(w => has(story, w.length <= 3 ? w : w + '*')));   // "whale" finds "whales"; short ones (ai, eid) only whole
      if (v && !out.some(o => o.key === v.key)) out.push({...v, story, name: nameOf(story)});
    }
    return out;
  }
  // The name a story is about (a team, a festival, a mission…): its longest run of capitalised words.
  const STOP = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'After', 'Its', 'His', 'Her', 'Their', 'This', 'That', 'With', 'For', 'From', 'By', 'Of', 'And', 'As', 'To', 'Over', 'Under', 'More', 'Most', 'Several', 'Thousands', 'Millions', 'Hundreds']);
  function nameOf(story) {
    let best = [], cur = [];
    for (const raw of String(story).split(/\s+/)) { const w = raw.replace(/[^A-Za-z0-9'’-]/g, ''); if (/^[A-Z][A-Za-z0-9'’-]+$/.test(w) && !STOP.has(w)) cur.push(w); else { if (cur.length > best.length) best = cur; cur = []; } if (/[.,;:]$/.test(raw)) { if (cur.length > best.length) best = cur; cur = []; } }
    if (cur.length > best.length) best = cur;
    if (best.length === 1 && ['New', 'First', 'Second', 'Third', 'Last', 'Two', 'Three'].includes(best[0])) return '';   // a lone "New" is not a name
    return best.slice(0, 3).join(' ');
  }
  // A story shortened to a headline the town can shout.
  const headline = story => { const t = String(story).split(/[;:]|, (?:and|while|after|as) /)[0]; return t.length > 70 ? t.slice(0, t.lastIndexOf(' ', 68)) + '…' : t; };
  function themeFromNews(stories) { return newsThemes(stories, 1)[0] || null; }
  // What the town knows about today's news, for the 3D town to stage: the light headlines (shortened for the town crier
  // and the Town Times billboard) with a topic emoji, and how many serious ones were left out. Heavy stories are never
  // staged. Every light headline gets a topic: the theme variant if one matches, else a broader subject.
  const TOPICS = [
    ['⚽', ['football', 'soccer', 'cricket', 'tennis', 'rugby', 'golf', 'olympic', 'cup', 'league', 'match', 'win', 'wins', 'beat', 'beats', 'champion*', 'team', 'surrey', 'celtic']],
    ['🚀', ['space', 'rocket', 'nasa', 'moon', 'mars', 'satellite', 'astronaut', 'engine', 'orbit', 'launch*']],
    ['🤖', ['ai', 'robot', 'tech', 'software', 'chip', 'computer', 'app', 'phone', 'internet', 'digital']],
    ['💼', ['firms', 'business', 'company', 'companies', 'jobs', 'job', 'salar*', 'economy', 'market', 'shares', 'profit', 'pay', 'trade', 'bank', 'price*']],
    ['🗳️', ['election', 'vote', 'mayor', 'minister', 'president', 'parliament', 'law', 'council', 'government', 'pope']],
    ['🎭', ['film', 'music', 'album', 'concert', 'art', 'museum', 'theatre', 'book', 'show', 'festival', 'star', 'award', 'prize']],
    ['🔬', ['scientist*', 'discover*', 'research*', 'study', 'species', 'fossil', 'climate', 'energy', 'solar', 'wind', 'health', 'medical', 'cure', 'vaccine']],
    ['🌍', ['world', 'global', 'international', 'summit', 'trip', 'visit', 'peace', 'talks', 'deal']]
  ];
  function topicOf(title) {
    const v = VARIANTS.find(v => v.words.some(w => has(title, w.length <= 3 ? w : w + '*')));
    if (v) return {emoji: v.emoji, label: v.title};
    const t = TOPICS.find(([, words]) => words.some(w => has(title, w.endsWith('*') || w.length <= 3 ? w : w + '*')));
    return {emoji: t ? t[0] : '📰', label: 'In the news'};
  }
  let newsFeed = {light: [], heavy: 0, version: 0};
  function setNews(stories) {
    const T = typeof window !== 'undefined' ? window.ToyTownNews : null;
    const heavy = s => (s.tone || (T && T.tone ? T.tone(s.title) : GRIM.some(w => has(s.title, w)) ? 'heavy' : 'light')) === 'heavy';
    const light = (stories || []).filter(s => !heavy(s)).slice(0, 6).map(s => ({title: s.title.length <= 96 ? s.title : headline(s.title), full: s.title, source: s.source || '', ...topicOf(s.title)}));
    newsFeed = {light, heavy: (stories || []).filter(heavy).length, version: newsFeed.version + 1};
  }
  // News is now a separate publisher-attributed, freshness-checked feed.
  // No Wikimedia one-shot feed, endless localStorage cache, or fabricated
  // breaking-news events when RSS updates fail.

  /* ---------------- the town ---------------- */
  const PASTEL = ['#f6a6a0', '#f7c873', '#a8d8a0', '#9cc7ef', '#c9a6e8', '#f4b6d2', '#ffe08a', '#8fd3c9'];
  const ROOFS = ['#d9533e', '#3f78c9', '#7a4fb3', '#2f9e7a', '#e08a2b'];
  const tile = (x, y) => grid[y] && grid[y][x];
  function build(seedValue, themeKey) {
    seed = seedValue; rnd = mulberry32(seed);
    const r = rnd;
    grid = Array.from({length: N}, (_, y) => Array.from({length: N}, (_, x) => {
      const road = (isRoad(x) && y >= 1 && y <= 16) || (isRoad(y) && x >= 1 && x <= 16);
      const water = (y === 13 || y === 14);
      return {kind: road ? (water ? 'bridge' : 'road') : water ? 'water' : (x === 0 || y === 0 || x === N - 1 || y === N - 1) ? 'edge' : 'lot', block: null};
    }));
    buildings = []; props = []; movers = []; events = []; parts = []; bubbles = [];
    community=null;communityEncounters=0;communityVisits=0;
    streetTrade=null;streetTransactions=0;streetShopVisits=0;newsReactions=0;
    nextPerformance=13;streetPerformances=0;
    districts=[];districtVisits=0;districtMeetings=0;districtTasks=0;
    nextStreetMoment = 16; streetMoments = 0;
    const blocks = [];
    for (const [ya, yb] of [[2, 5], [7, 10], [12, 15]]) for (const [xa, xb] of [[2, 5], [7, 10], [12, 15]]) blocks.push({xa, xb, ya, yb, river: ya === 12});
    // The centre remains a handcrafted neighborhood on every date; everything
    // around it is still shuffled by theme and seed.
    const hero = blocks.find(b => b.xa === 7 && b.ya === 7);
    const land = blocks.filter(b => !b.river && b !== hero), order = land.map(b => b).sort(() => r() - .5);
    const special = {sports: 'stadium', space: 'launchpad', election: 'stage', festival: 'stage', awards: 'stage', tech: 'lab', animals: 'zoo', market: 'market', science: 'lab', weather: 'park'}[themeKey] || 'park';
    const kinds = [special, 'fire', special === 'park' ? 'towers' : 'park', 'houses', r() < .5 ? 'construction' : 'houses'];
    order.forEach((b, i) => { b.type = kinds[i] || 'houses'; });
    hero.type = 'hero';
    for (const b of blocks.filter(b => b.river)) b.type = 'riverside';
    for (const b of blocks) fill(b, r);
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (tile(x, y).kind === 'edge' && r() < .55) props.push({kind: 'tree', x: x + .5, y: y + .5, s: .8 + r() * .4, c: r() < .5 ? '#5cb85c' : '#7cc65a'});
    for (let k = 0; k < CARS; k++) spawnCar(r, k === 0 ? 'bus' : undefined);   // one bus is always on the line
    for (let k = 0; k < BIKES; k++) spawnBike(r);
    for (let k = 0; k < PEOPLE; k++) spawnPerson(r);
    spawnHeroResidents(hero, r);
    spawnNeighborhoodLife(hero, r);
    spawnStreetTrade(hero, r);
    spawnDistrictLife(blocks,r);
    for (const b of buildings) if (b.kind === 'house' && r() < .75) props.push({kind: 'flowers', x: b.x + .5, y: b.y + .88, c: [PASTEL[r() * 8 | 0], PASTEL[r() * 8 | 0]]});
    for (let k = 0; k < 5; k++) props.push({kind: 'duck', x: clearOfBridges(1 + r() * 16), y: 13.2 + r() * 1.6, vx: (r() - .5) * .3, ph: r() * 6});
    sprites.clear(); ground = null;
    theme = themeKey; town.blocks = blocks;
  }
  const town = {blocks: []};
  function addBuilding(b) { buildings.push(b); tile(b.x, b.y).used = true; }
  function fillHero(b, r) {
    const {xa: x, ya: y} = b;
    const site = (ix, iy, kind, details) => {
      const bx = x + ix, by = y + iy;
      addBuilding({x: bx, y: by, kind, hero: true, ...details});
    };
    // Only five carefully placed buildings: two corner shops and three homes.
    // Their frontages face the path; the central two-by-two block is open.
    site(1, 0, 'shop', {h: 40, wall: '#f0d8bd', awning: '#bf6657', name: 'BAKERY'});
    site(2, 0, 'shop', {h: 38, wall: '#c6dfd3', awning: '#427c78', name: 'BOOKS'});
    site(0, 0, 'house', {h: 34, wall: '#dfbba4', roof: '#a55a49'});
    site(3, 1, 'house', {h: 34, wall: '#c4d7e7', roof: '#638db2'});
    site(3, 3, 'house', {h: 36, wall: '#eedbb9', roof: '#b47742'});
    for (let yy = y; yy <= b.yb; yy++) for (let xx = x; xx <= b.xb; xx++) {
      const cell = tile(xx, yy);
      cell.kind = (xx >= x + 1 && xx <= x + 2 && yy >= y + 1 && yy <= y + 2)
        ? 'plaza' : cell.used ? 'lot' : 'park';
    }
    b.hero = true;
    // Furniture occupies free tiles and is placed directly on the lawn/terrace.
    props.push(
      {kind:'hero-bench', x:x + 1.43, y:y + 2.52},
      {kind:'hero-table', x:x + 2.49, y:y + 2.55, flower:true},
      {kind:'hero-lamp', x:x + .65, y:y + 1.65},
      {kind:'hero-lamp', x:x + 3.31, y:y + 2.65},
      {kind:'hero-mail', x:x + .77, y:y + 3.35},
      {kind:'hero-rack', x:x + 2.54, y:y + 1.4},
      {kind:'hero-shrub', x:x + .44, y:y + 2.24, col:'#497e50'},
      {kind:'hero-shrub', x:x + 3.35, y:y + .45, col:'#568e66'},
      {kind:'hero-shrub', x:x + 2.62, y:y + 3.4, col:'#6d9a63'},
      {kind:'tree', x:x + .55, y:y + 2.55, s:.78, c:'#508f69'}
    );
    return b;
  }
  function fill(b, r) {
    if (b.type === 'hero') { fillHero(b, r); return; }
    const tiles = []; for (let y = b.ya; y <= b.yb; y++) for (let x = b.xa; x <= b.xb; x++) { tile(x, y).block = b; tiles.push([x, y]); }
    const edge = ([x, y]) => x === b.xa || x === b.xb || y === b.ya || y === b.yb;
    const pastel = () => PASTEL[r() * PASTEL.length | 0], roof = () => ROOFS[r() * ROOFS.length | 0];
    // Village composition: houses and tall buildings grow in coherent small
    // clusters instead of filling every edge cell with another repeating roof.
    // All lots, traffic lanes, landmarks and event positions remain unchanged.
    if (b.type === 'houses') {
      const frontageNorth = r() < .5;
      for (const [x, y] of tiles) {
        const primary = frontageNorth ? (y === b.ya || y === b.yb) :
          (x === b.xa || x === b.xb);
        const clustered = edge([x, y]) &&
          (primary ? r() < .72 : r() < .39) &&
          !(x === b.xa+1 && y === b.ya);
        if (clustered) addBuilding({x,y,kind:'house',
          h:29+r()*9,wall:pastel(),roof:roof()});
        else {
          tile(x,y).kind='park';
          if (r()<.66) props.push({kind:'tree',x:x+.5,y:y+.5,
            s:.70+r()*.33,c:r()<.5?'#6b9c70':'#88b289'});
          else if(r()<.36)props.push({kind:'flowers',x:x+.5,y:y+.5,
            c:['#e0c8ae','#d6e3b6']});
        }
      }
    }
    else if (b.type === 'shops') for (const [x, y] of tiles) { if (edge([x, y])) addBuilding({x, y, kind: 'shop', h: 32 + r() * 11, wall: pastel(), awning: roof(), name: ['BAKERY', 'PIZZA', 'TOYS', 'BOOKS', 'CAFE', 'SWEETS', 'PETS'][r() * 7 | 0]}); else tile(x, y).kind = 'plaza'; }
    else if (b.type === 'towers') {
      // Three or four varied spires form a readable district skyline;
      // the remaining parcels become garden clearings.
      const sites=[[0,0],[3,0],[0,3],[3,3],[1,2],[2,1]];
      const selected=sites.filter((_,i)=>i<3||r()<.28);
      for(const [x,y] of tiles){
        const landmark=selected.some(([dx,dy])=>x===b.xa+dx&&y===b.ya+dy);
        if(landmark)addBuilding({x,y,kind:'tower',
          h:56+r()*60,wall:['#9fc4e8','#b9d2e6','#a8b8d8','#c8d6e0'][r()*4|0],roof:'#6b7c93'});
        else {
          tile(x,y).kind='park';
          if(r()<.53)props.push({kind:'tree',x:x+.5,y:y+.5,
            s:.74+r()*.39,c:'#85a994'});
        }
      }
    }
    else if (b.type === 'fire') { for (const [x, y] of tiles) { if (x === b.xa && y === b.yb) addBuilding({x, y, kind: 'fire', h: 26, wall: '#e2463a', roof: '#a8281f'}); else if (edge([x, y]) && r() < .38) addBuilding({x, y, kind: 'house', h: 29 + r() * 8, wall: pastel(), roof: roof()}); else tile(x, y).kind = 'plaza'; } b.station = {x: b.xa + .5, y: b.yb + .5}; }
    else if (b.type === 'construction') { for (const [x, y] of tiles) tile(x, y).kind = 'dirt'; addBuilding({x: b.xa + 1, y: b.ya + 1, kind: 'site', h: 20, wall: '#d8c79a', roof: '#c9a85a'}); props.push({kind: 'crane', x: b.xa + 2.5, y: b.ya + 2.5}); }
    else if (b.type === 'riverside') for (const [x, y] of tiles) { if (tile(x, y).kind === 'water') continue; if (r() < .35) props.push({kind: 'tree', x: x + .5, y: y + .5, s: .7 + r() * .3, c: '#5cb85c'}); else if (r() < .2) props.push({kind: 'bench', x: x + .5, y: y + .5}); }
    else {   // park and the theme blocks keep open ground
      for (const [x, y] of tiles) tile(x, y).kind = b.type === 'park' || b.type === 'zoo' ? 'park' : 'plaza';
      if (b.type === 'park') { for (const [x, y] of tiles) if (edge([x, y]) && r() < .5) props.push({kind: 'tree', x: x + .5, y: y + .5, s: .8 + r() * .5, c: r() < .5 ? '#4fae5a' : '#7cc65a'}); props.push({kind: 'fountain', x: b.xa + 2, y: b.ya + 2}); }
      else props.push({kind: b.type, x: b.xa + 2, y: b.ya + 2});
      if (b.type === 'zoo') for (let k = 0; k < 4; k++) props.push({kind: 'animal', a: ['elephant', 'giraffe', 'penguin', 'penguin'][k], x: b.xa + .8 + r() * 2.4, y: b.ya + .8 + r() * 2.4, tx: 0, ty: 0, t: 0});
    }
  }

  /* ---------------- moving things ---------------- */
  // Movers travel along the road lines; ax is the axis they move on ('x' or 'y').
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function randomRoadPoint(r) { const along = r() < .5, line = LINES[r() * 4 | 0] + .5, t = 1.5 + r() * 14.5; return along ? {x: t, y: line, d: r() < .5 ? 0 : 1} : {x: line, y: t, d: r() < .5 ? 2 : 3}; }
  const directionAngle = d => [0, Math.PI, Math.PI / 2, -Math.PI / 2][d] || 0;
  // The bus line: the bus pulls up for a few seconds at each stop on the two middle streets, one stop per direction
  // (eastbound lane on the south side, westbound on the north). The 3D town draws the shelters and the passengers.
  const BUS_STOPS = [];
  for (const y of [6.5, 11.5]) for (const x of [4.6, 12.6]) { BUS_STOPS.push({id: BUS_STOPS.length, x, y, d: 0}); BUS_STOPS.push({id: BUS_STOPS.length, x, y, d: 1}); }
  // The bus runs a long closed route, not a random wander: along both middle streets in both directions, round the
  // north and south ring roads and across the bridges. ROUTE_OUT lists the heading taken at each junction visited, in
  // order (junction = [column, row] on the 4x4 street grid; headings 0 east, 1 west, 2 south, 3 north).
  const ROUTE_NODES = [[0,1],[1,1],[2,1],[3,1],[3,2],[2,2],[1,2],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[3,1],[2,1],[1,1],[0,1],[0,2],[1,2],[2,2],[3,2],[3,3],[2,3],[1,3],[0,3],[0,2]];
  const ROUTE_OUT = [0,0,0,2,1,1,1,3,3,0,0,0,2,1,1,1,2,0,0,0,2,1,1,1,3,3];
  function busRouteOut(m, col, row) {
    const n = ROUTE_NODES.length, at = i => ROUTE_NODES[i % n][0] === col && ROUTE_NODES[i % n][1] === row;
    const arrive = i => ROUTE_OUT[(i + n - 1) % n];
    let start = m.rIdx || 0, hit = -1;
    for (let k = 0; k < n && hit < 0; k++) if (at(start + k) && arrive(start + k) === m.d) hit = (start + k) % n;   // the next visit of this junction, arriving this way
    if (hit < 0) for (let k = 0; k < n && hit < 0; k++) if (at(start + k) && ROUTE_OUT[(start + k) % n] !== (m.d ^ 1)) hit = (start + k) % n;   // joined the route from elsewhere
    if (hit < 0) return -1;
    m.rIdx = (hit + 1) % n;
    return ROUTE_OUT[hit];
  }
  function busStopping(m) {
    if (m.kind !== 'bus' || m.path || clock < (m.stopCool || 0)) return;
    for (const s of BUS_STOPS) if (s.d === m.d && Math.abs(m.y - s.y) < .05 && Math.abs(m.x - s.x) < .07) {
      m.stopUntil = clock + 4.5; m.stopCool = clock + 20; m.atStop = s.id; m.v = 0; m.stops = (m.stops || 0) + 1; return;
    }
  }
  // Ducks paddle on the open water between the bridges, never across a bridge deck.
  const BRIDGE_HALF = .72;
  const onBridge = x => LINES.some(l => Math.abs(x - (l + .5)) < BRIDGE_HALF);
  function clearOfBridges(x) { for (const l of LINES) if (Math.abs(x - (l + .5)) < BRIDGE_HALF) return l + .5 + (x < l + .5 ? -1 : 1) * (BRIDGE_HALF + .05); return x; }
  function spawnCar(r = Math.random, kind) {
    const p = randomRoadPoint(r), k = kind || (r() < .12 ? 'bus' : r() < .15 ? 'taxi' : 'car');
    const m = {type: 'car', kind: k, x: p.x, y: p.y, d: p.d, heading: directionAngle(p.d), v: 0, travel: 0, moved:0, max: k === 'bus' ? .9 : 1.2 + r() * .5, col: k === 'taxi' ? '#f6c541' : k === 'bus' ? '#3f8fd6' : PASTEL[r() * PASTEL.length | 0], wait: 0, lane: .16};
    findSafeSpawn(m,r);
    movers.push(m); return m;
  }
  function spawnPerson(r = Math.random, opts = {}) {
    const p = randomRoadPoint(r);
    // Everyone has their own walk: most stroll, some stride briskly, a few skip along.
    const g = r(), gait = g < .2 ? 'brisk' : g < .3 ? 'skip' : 'stroll';
    const m = Object.assign({type: 'person', x: p.x, y: p.y, d: p.d, v: 0, travel: 0, gait, max: gait === 'brisk' ? .64 + r() * .14 : gait === 'skip' ? .72 : .4 + r() * .22, col: PASTEL[r() * PASTEL.length | 0], skin: ['#f1c9a5', '#d8a77c', '#a8754f', '#7a4e33'][r() * 4 | 0],
      hat: r() < .23 ? (r() < .5 ? 'cap' : 'beanie') : null,
      bag: r() < .25, scarf: r() < .24, hair: r() < .5 ? '#49362d' : '#333947',
      lane: (r() < .5 ? 1 : -1) * (.4 + r() * .07), ph: r() * 6, wait: 0,
      intent:'walking', nextNotice:clock+7+r()*10, observeUntil:0,
      attention:null,moved:0}, opts);
    movers.push(m); return m;
  }
  // These neighbors stay within open paths; the bakery, bookshop, bench and
  // terrace are actual destinations. No teleporting, clipping through roofs,
  // or randomly jittering between points.
  function spawnHeroResidents(b, r) {
    const {xa:x, ya:y} = b;
    const routes = [
      [{x:x+1.49,y:y+1.18,dwell:3,wave:true},{x:x+1.49,y:y+1.96,dwell:1.2},
       {x:x+1.42,y:y+2.53,dwell:4.4,sit:true},{x:x+1.48,y:y+1.87,dwell:1}],
      [{x:x+2.48,y:y+1.2,dwell:3,wave:true},{x:x+2.46,y:y+1.85,dwell:1},
       {x:x+2.49,y:y+2.62,dwell:3.8},{x:x+2.39,y:y+1.7,dwell:1}],
      [{x:x+1.43,y:y+2.52,dwell:4,sit:true},{x:x+1.64,y:y+1.88,dwell:1.4},
       {x:x+1.5,y:y+3.72,dwell:.8},
       {x:x+1.5,y:y+5.2,dwell:1.4,cross:true},  // reach the riverside across the marked road
       {x:x+1.5,y:y+3.72,dwell:1.2,cross:true},
       {x:x+2.42,y:y+1.82,dwell:2,wave:true},{x:x+2.48,y:y+2.58,dwell:3.5}]
    ];
    const origins = [[x+1.48,y+1.88],[x+2.45,y+1.83],[x+2.41,y+2.63]];
    for (let i = 0; i < routes.length; i++) {
      const m = spawnPerson(r, {x:origins[i][0], y:origins[i][1], d:i===1?2:3,
        lane:0, max:.26 + r() * .07, heroResident:true, heroStops:routes[i],
        heroIndex:i, stopUntil:clock + .2 + i * 1.3});
      m.v = 0;
    }
  }
  function updateHeroResident(m) {
    if (!m.heroResident || m.path && m.path.length || clock < (m.stopUntil || 0)) return;
    const dest = m.heroStops[m.heroIndex % m.heroStops.length];
    // Wait until the crossing is clear before the pedestrian leaves the curb.
    // Cars arriving afterwards yield while the crossing remains occupied.
    const b = town.blocks.find(q => q.hero);
    const crossX = b.xa + 1.5, crossY = b.yb + 1.5;
    if (dest.cross && movers.some(o => o.type === 'car' && o.d < 2 &&
      Math.abs(o.y - crossY) < .25 && Math.abs(o.x - crossX) < 1.1)) {
      m.v = 0; m.stopUntil = clock + .35; return;
    }
    m.heroIndex++;
    m.sit = false; m.crossing = !!dest.cross;
    m.intent=dest.cross?'crossing':'destination';m.attention={x:dest.x,y:dest.y};
    m.path = [{x:dest.x,y:dest.y,speed:m.max,then:walker=>{
      walker.v = 0; walker.crossing = false;
      walker.stopUntil = clock + dest.dwell;
      walker.intent=dest.sit?'rest':dest.wave?'greeting':'waiting';
      walker.sit = !!dest.sit;
      if (dest.wave) walker.waveUntil = clock + Math.min(dest.dwell, 1.4);
    }}];
  }

  // Small, persistent social ecology in the real central square. Not another
  // timed chaos event: this routine carries on while news themes change.
  // It uses the free 2x2 plaza, avoiding storefront walls and the busy roads.
  function spawnNeighborhoodLife(hero,r){
    const x=hero.xa,y=hero.ya;
    const residents=[
      spawnPerson(r,{kind:'neighbor',x:x+1.70,y:y+2.12,d:3,lane:0,max:.28,
        communityResident:true,ph:r()*6,stopUntil:clock+2.4}),
      spawnPerson(r,{kind:'neighbor',x:x+2.35,y:y+2.10,d:3,lane:0,max:.31,
        communityResident:true,ph:r()*6,stopUntil:clock+5.8})
    ];
    for(const m of residents){m.intent='strolling';m.busy=false;}
    const dog=spawnPerson(r,{kind:'dog',x:x+2.11,y:y+2.36,d:3,
      lane:0,max:.39,ph:r()*6,companionDog:true});
    dog.attention={x:residents[1].x,y:residents[1].y};
    community={
      residents,dog,nextMeeting:clock+12+r()*4,
      meetingUntil:0,meetingCount:0,
      destinations:[
        {name:'bakery',x:x+1.49,y:y+1.66},
        {name:'books',x:x+2.49,y:y+1.67},
        {name:'garden',x:x+1.82,y:y+2.16},
        {name:'terrace',x:x+2.24,y:y+2.17}
      ]
    };
    residents.forEach((m,i)=>{
      m.communityDestination=i===0?'bakery':'terrace';
      m.communityNext=clock+4+i*3;
    });
  }
  function nearbyCompanionPoint(owner,dog){
    // Follow the back quarter of the owner's walking vector, not an arbitrary
    // global waypoint that would send the dog through a shopfront.
    const vx=owner.x-dog.x,vy=owner.y-dog.y;
    const dist=Math.hypot(vx,vy)||1;
    return {x:owner.x-vx/dist*.20,y:owner.y-vy/dist*.20};
  }
  function updateNeighborhoodLife(dt){
    const life=community;if(!life)return;
    const [a,b]=life.residents;
    if(!movers.includes(a)||!movers.includes(b))return;
    if(life.meetingUntil>clock){
      for(const m of life.residents){
        m.v=0;m.stopUntil=Math.max(m.stopUntil||0,life.meetingUntil);
        m.intent='chat';m.attention={x:m===a?b.x:a.x,y:m===a?b.y:a.y};
      }
    }else{
      if(life.meetingUntil){
        for(const m of life.residents){
          m.stopUntil=0;m.intent='strolling';m.attention=null;
          m.communityNext=clock+2+(m===b?1.5:0);
        }
        life.meetingUntil=0;
      }
      // Both arrive at a socially credible meeting point on the walkway.
      if(clock>=life.nextMeeting&&!life.meetingUntil){
        const close=Math.hypot(a.x-b.x,a.y-b.y)<.86;
        if(close){
          // A real neighbor recognizes their friend along the approach.
          // Stop at the place they actually meet, instead of robotically
          // finishing two exact waypoints before acknowledging each other.
          for(const m of life.residents)m.path=null;
          life.meetingUntil=clock+3.3;
          life.nextMeeting=clock+25;
          life.meetingCount++;communityEncounters++;
          for(const m of life.residents){
            m.stopUntil=life.meetingUntil;m.v=0;
            m.waveUntil=clock+.9;m.intent='chat';
            m.attention={x:m===a?b.x:a.x,y:m===a?b.y:a.y};
          }
        }else if(!a.path&&!b.path){
          // A shared safe plaza rendezvous. No intersection crossing and no
          // snapping positions; the two neighbors converge normally.
          for(const [i,m] of life.residents.entries()){
            m.communityNext=clock+8;
            m.path=[{x:life.destinations[i+2].x,
              y:life.destinations[i+2].y,speed:m.max}];
            m.intent='meeting';m.attention={
              x:life.destinations[i+2].x,y:life.destinations[i+2].y};
          }
        }
      }
      if(clock<life.nextMeeting-3){
        for(const [i,m] of life.residents.entries()){
          if(m.path||clock<(m.stopUntil||0)||clock<(m.communityNext||0))continue;
          const candidates=life.destinations.filter(p=>
            p.name!==(m.communityDestination||'') &&
            life.residents.every(other=>other===m||
              Math.hypot(p.x-other.x,p.y-other.y)>.37));
          if(!candidates.length)continue;
          // Choose a real place with low current occupancy, not the next
          // element in a synchronized loop. Phase makes visits staggered.
          const chosen=candidates[(life.meetingCount+i+
            Math.floor(clock/13))%candidates.length];
          m.communityDestination=chosen.name;
          m.intent='visiting';m.attention={x:chosen.x,y:chosen.y};
          m.path=[{x:chosen.x,y:chosen.y,speed:m.max,then:walker=>{
            walker.v=0;walker.intent='visiting';
            walker.stopUntil=clock+2.3+(i*.7);
            walker.communityNext=walker.stopUntil+1.8;
            communityVisits++;
          }}];
        }
      }
    }
    const dog=life.dog,owner=b;
    if(!movers.includes(dog))return;
    const gap=Math.hypot(owner.x-dog.x,owner.y-dog.y);
    const ownerStill=(owner.v||0)<.05&&!owner.path;
    dog.intent=ownerStill?'rest':'following';
    dog.attention={x:owner.x,y:owner.y};
    dog.watch=ownerStill?'owner':'walk';
    dog.sit=ownerStill&&gap<.43;
    if(ownerStill&&gap<.43){
      dog.v=0;dog.path=null;dog.stopUntil=clock+.13;
    }else if(gap>.34&&clock>=(dog.nextFollow||0)){
      const to=nearbyCompanionPoint(owner,dog);
      dog.path=[{x:to.x,y:to.y,speed:.34}];
      dog.nextFollow=clock+.45;
    }
  }
  /* --------- living market: physical service, not a rotating tableau --------
   * Two clerks remain at the shop frontage and serve actual arriving
   * customers. Goods appear in a hand only AFTER reaching the counter.
   * Shoppers walk to the bakery or bookshop, receive a purchase, then
   * actually walk to a cafe/reading spot before returning for another visit.
   * Every transition is driven by distance and timed dwell, not teleport.
   */
  function spawnStreetTrade(hero,r){
    const x=hero.xa,y=hero.ya;
    const places=[
      {kind:'bakery',product:'bread',vendor:{x:x+1.07,y:y+1.42},
        serve:{x:x+1.32,y:y+1.78},rest:{x:x+1.17,y:y+2.31}},
      {kind:'bookshop',product:'book',vendor:{x:x+2.93,y:y+1.42},
        serve:{x:x+2.68,y:y+1.78},rest:{x:x+2.78,y:y+2.34}}
    ];
    const stalls=places.map((place,i)=>{
      const clerk=spawnPerson(r,{kind:'shopkeeper',shopRole:'vendor',
        shopVenue:place.kind,x:place.vendor.x,y:place.vendor.y,
        d:2,lane:0,max:0,v:0,col:i?'#508f8a':'#de8f69',
        hat:i?'cap':null,bag:false,scarf:false,
        stopUntil:1e8,shopAction:'offering',
        attention:{...place.serve}});
      return {...place,clerk,customer:null,serveUntil:0};
    });
    const startingPoints=[
      [x+1.21,y+2.56],[x+2.83,y+2.52],[x+2.08,y+2.38]
    ];
    const customers=startingPoints.map(([px,py],i)=>{
      const shopper=spawnPerson(r,{kind:'shopper',shopRole:'customer',
        x:px,y:py,d:3,lane:0,max:.36+r()*.10,v:0,bag:false,
        col:['#db7d99','#e2b46d','#7da6bd'][i],
        shopAction:'looking',shopPhase:'ready',shopOrder:i,
        nextShop:clock+i*.85,stopUntil:clock+i*.85});
      shopper.shopHome=i%2;
      return shopper;
    });
    streetTrade={stalls,customers,latestSale:null,newsMood:null,
      reactionUntil:0};
  }
  function updateStreetTrade(){
    const trade=streetTrade;
    if(!trade)return;
    for(const stall of trade.stalls){
      const seller=stall.clerk;
      if(!movers.includes(seller))continue;
      // A seller never drifts away from the counter while distracted by
      // a theme event, nor performs a stationary walk cycle.
      seller.v=0;
      seller.shopAction=stall.customer?.shopPhase==='receiving'?
        'handoff':stall.customer?'serving':'offering';
      seller.attention=stall.customer?
        {x:stall.customer.x,y:stall.customer.y}:{...stall.serve};
    }
    for(const shopper of trade.customers){
      if(!movers.includes(shopper))continue;
      if(shopper.shopPhase==='ready'&&clock>=(shopper.nextShop||0)){
        const preferred=trade.stalls[shopper.shopOrder%2];
        const available=[preferred,...trade.stalls].find(s=>!s.customer);
        if(!available){shopper.nextShop=clock+.55;continue;}
        available.customer=shopper;
        shopper.shopAt=available.kind;
        shopper.shopOrder++;
        shopper.shopPhase='approaching';
        shopper.shopAction='visiting';
        shopper.attention={...available.vendor};
        // Approach a real frontage threshold before reaching over the
        // counter: this makes a visible arrival, knock and handoff sequence.
        // Both stops remain on the existing paved shop-customer route.
        const threshold={x:available.serve.x,y:available.serve.y+.38};
        shopper.path=[{...threshold,speed:shopper.max,then:o=>{
          o.shopPhase='knocking';o.shopAction='knocking';
          o.stopUntil=clock+.72;o.shopNext=clock+.72;
          o.v=0;o.moved=0;o.attention={...available.vendor};
        }}];
      }else if(shopper.shopPhase==='knocking'&&clock>=(shopper.shopNext||0)){
        const stall=trade.stalls.find(s=>s.customer===shopper);
        if(!stall)continue;
        shopper.shopPhase='approachingCounter';
        shopper.shopAction='visiting';
        shopper.stopUntil=0;
        shopper.path=[{x:stall.serve.x,y:stall.serve.y,speed:shopper.max,
          then:o=>{
            o.shopPhase='ordering';o.shopAction='ordering';
            o.stopUntil=clock+1.25;o.shopNext=clock+1.25;
            o.v=0;o.attention={...stall.vendor};
            streetShopVisits++;
          }}];
      }else if(shopper.shopPhase==='ordering'&&clock>=(shopper.shopNext||0)){
        const stall=trade.stalls.find(s=>s.customer===shopper);
        if(!stall)continue;
        // The hand-off can only occur after the customer physically reaches
        // the service point and faces the right clerk.
        const gap=Math.hypot(shopper.x-stall.serve.x,shopper.y-stall.serve.y);
        if(gap>.13)continue;
        shopper.carrying=stall.product;
        shopper.shopPhase='receiving';shopper.shopAction='receiving';
        shopper.stopUntil=clock+.95;shopper.shopNext=clock+.95;
        stall.serveUntil=clock+.95;
        stall.clerk.shopAction='serving';
        shopper.attention={...stall.vendor};
        streetTransactions++;
        trade.latestSale={shop:stall.kind,product:stall.product,at:clock};
      }else if(shopper.shopPhase==='receiving'&&clock>=(shopper.shopNext||0)){
        const stall=trade.stalls.find(s=>s.customer===shopper);
        if(!stall)continue;
        stall.customer=null;
        shopper.shopPhase='leaving';shopper.shopAction='carrying';
        shopper.stopUntil=0;shopper.attention={...stall.rest};
        shopper.path=[{x:stall.rest.x,y:stall.rest.y,speed:shopper.max,
          then:o=>{
            o.shopPhase='enjoying';
            o.shopAction=o.carrying==='book'?'reading':'eating';
            o.shopNext=clock+3.5+(o.shopHome*.6);
            o.stopUntil=o.shopNext;
            o.attention={x:stall.rest.x+.3,y:stall.rest.y+.24};
          }}];
      }else if(shopper.shopPhase==='enjoying'&&clock>=(shopper.shopNext||0)){
        shopper.carrying=null;
        shopper.shopAction='looking';shopper.shopPhase='ready';
        shopper.nextShop=clock+1.2+(shopper.shopHome*.6);
        shopper.stopUntil=shopper.nextShop;
        shopper.attention=null;
      }
    }
    if(trade.reactionUntil&&clock>=trade.reactionUntil){
      trade.reactionUntil=0;
      trade.newsMood=null;
      for(const m of [...trade.customers,...trade.stalls.map(s=>s.clerk)])
        m.newsMood=null;
    }
  }
  function reactToNews(variant){
    if(!streetTrade||!variant||!variant.story)return false;
    const mood=variant.key==='sports'?'cheer':
      variant.key==='festival'||variant.key==='awards'?'celebrate':
      variant.key==='space'||variant.key==='science'||variant.key==='tech'?'curious':
      variant.key==='market'?'trade':'observe';
    streetTrade.newsMood=mood;
    streetTrade.reactionUntil=clock+7;
    // Cultural and sporting stories bring a neighborhood performance
    // forward; the factual headline stays in the attributed news panel.
    if(mood==='celebrate'||mood==='cheer')
      nextPerformance=Math.min(nextPerformance,clock+4);
    for(const area of districts)for(const m of area.participants){
      m.newsMood=mood;
      if(mood==='cheer'||mood==='celebrate')m.waveUntil=clock+1.6;
    }
    for(const [i,m] of [...streetTrade.customers,...streetTrade.stalls.map(s=>s.clerk)].entries()){
      m.newsMood=mood;
      // The existing 3D gesture rig responds to an observable news
      // pulse without disturbing current service or customer paths.
      if(mood==='cheer'||mood==='celebrate')
        m.waveUntil=clock+1.8+(i%3)*.35;
      else if(mood==='curious')m.attention={x:9,y:8.8};
    }
    newsReactions++;
    return true;
  }
  /* Four outer quadrants can host their own little working neighborhoods.
   * A visitor takes an unobstructed graph of free lot cells to a service;
   * a worker genuinely walks a short local round and returns to the job.
   * Never invent a path through a structure or a road just to fill space.
   */
  const DISTRICT_ROLES=['garden','post','art','produce'];
  const DISTRICT_STEPS=[[1,0],[-1,0],[0,1],[0,-1]];
  const districtKey=(x,y)=>x+','+y;
  function districtRoute(area,from,to){
    const start=districtKey(from.x,from.y),goal=districtKey(to.x,to.y);
    if(start===goal)return [];
    const nodes=new Map(area.cells.map(c=>[districtKey(c.x,c.y),c]));
    const previous=new Map([[start,null]]),queue=[start];
    for(let i=0;i<queue.length&&!previous.has(goal);i++){
      const node=nodes.get(queue[i]);if(!node)continue;
      for(const [dx,dy] of DISTRICT_STEPS){
        const key=districtKey(node.x+dx,node.y+dy);
        if(nodes.has(key)&&!previous.has(key)){
          previous.set(key,queue[i]);queue.push(key);
        }
      }
    }
    if(!previous.has(goal))return [];
    const out=[];for(let at=goal;at!==start;at=previous.get(at)){
      const node=nodes.get(at);out.push({x:node.x+.5,y:node.y+.5});
    }
    return out.reverse();
  }
  function spawnDistrictLife(blocks,r){
    const outer=blocks.filter(b=>b.ya<12&&b.xa!==7)
      .sort((a,b)=>a.ya-b.ya||a.xa-b.xa);
    const adjacent=(node,pool)=>DISTRICT_STEPS.map(([dx,dy])=>pool.find(c=>
      c.x===node.x+dx&&c.y===node.y+dy)).filter(Boolean);
    for(const [i,b] of outer.entries()){
      const candidates=[];
      for(let y=b.ya;y<=b.yb;y++)for(let x=b.xa;x<=b.xb;x++){
        const cell=tile(x,y);
        if(!cell||cell.used||cell.kind==='water'||cell.kind==='road')continue;
        // Giant theme props sit in the center of some squares; do not
        // route residents through a stage, crane, stadium or fountain.
        if(props.some(p=>['fountain','market','stage','lab','zoo',
          'launchpad','stadium','crane'].includes(p.kind)&&
          Math.hypot(p.x-x-.5,p.y-y-.5)<1.28))continue;
        candidates.push({x,y});
      }
      // Prefer two different service-front spaces. On dense procedural
      // layouts, accept one frontage plus a connected second clear tile.
      const sites=candidates.filter(c=>adjacent(c,candidates).length>=1)
        .sort((a,b)=>{
          const degree=adjacent(b,candidates).length-
            adjacent(a,candidates).length;
          return degree||Math.hypot(a.x-b.xa-1.5,a.y-b.ya-1.5)-
            Math.hypot(b.x-b.xa-1.5,b.y-b.ya-1.5);
        });
      let chosen=null;
      for(const site of sites){
        const cells=candidates.filter(c=>c!==site);
        const front=adjacent(site,cells);
        if(!front.length)continue;
        const probe={cells};
        const work=front[0];
        const remaining=cells.filter(c=>c!==work&&districtRoute(probe,work,c).length);
        const visit=front[1]||remaining.sort((a,b)=>
          Math.hypot(a.x-site.x,a.y-site.y)-
          Math.hypot(b.x-site.x,b.y-site.y))[0];
        if(!visit||visit===work)continue;
        const far=cells.filter(c=>c!==visit&&c!==work&&
          districtRoute(probe,visit,c).length)
          .sort((a,b)=>Math.hypot(b.x-visit.x,b.y-visit.y)-
            Math.hypot(a.x-visit.x,a.y-visit.y))[0];
        if(!far)continue;
        chosen={site,cells,work,visit,far};break;
      }
      if(!chosen)continue;
      const {site,cells,work,visit,far}=chosen;
      const role=DISTRICT_ROLES[i],area={
        role,x:site.x+.5,y:site.y+.5,block:{xa:b.xa,ya:b.ya},
        cells,workerStop:work,visitorStop:visit,far,
        arrivals:0,interactions:0
      };
      // Replace only foliage along the exact walking corridor or service.
      // Buildings and special-theme pieces are never displaced.
      const walkToVisit=districtRoute(area,far,visit);
      const walkToWork=districtRoute(area,work,
        cells.find(c=>c!==work&&
          Math.abs(c.x-work.x)+Math.abs(c.y-work.y)===1)||work);
      const reserved=[site,work,visit,far,
        ...walkToVisit.map(p=>({x:Math.round(p.x-.5),y:Math.round(p.y-.5)})),
        ...walkToWork.map(p=>({x:Math.round(p.x-.5),y:Math.round(p.y-.5)}))];
      for(let j=props.length-1;j>=0;j--){
        const p=props[j];
        if(['tree','flowers','bench'].includes(p.kind)&&reserved.some(c=>
          Math.hypot(p.x-c.x-.5,p.y-c.y-.5)<.33))props.splice(j,1);
      }
      props.push({kind:'district-scene',role,x:area.x,y:area.y});
      const colors=['#78a995','#d79d70','#a38abf','#ce8276'];
      const worker=spawnPerson(r,{
        kind:'district-worker',districtResident:true,districtWorker:true,
        districtRole:role,x:work.x+.5,y:work.y+.5,d:2,lane:0,max:.27,
        col:colors[i],bag:false,hat:null,stopUntil:clock+2+i*.7,
        districtAction:'working',intent:'visiting',
        attention:{x:area.x,y:area.y}});
      const visitor=spawnPerson(r,{
        kind:'district-visitor',districtResident:true,districtWorker:false,
        districtRole:role,x:far.x+.5,y:far.y+.5,d:1,lane:0,
        max:.32+r()*.06,col:['#d88a82','#8aadc0','#e0ad74','#8aaf8b'][i],
        bag:role==='post',stopUntil:clock+2.5+i*1.9,
        districtAction:'strolling',intent:'destination',
        attention:{x:area.x,y:area.y}});
      worker.districtPlace=area;visitor.districtPlace=area;
      worker.districtAtWork=true;visitor.districtAtWork=false;
      area.worker=worker;area.visitor=visitor;
      area.participants=[worker,visitor];districts.push(area);
    }
  }
  function updateDistrictLife(){
    for(const area of districts){
      const {worker,visitor}=area;
      if(!movers.includes(worker)||!movers.includes(visitor))continue;
      for(const m of area.participants){
        if(m.path?.length||clock<(m.stopUntil||0))continue;
        const isWorker=m===worker;
        // The worker steps to the adjoining free lot, then returns
        // to work; the visitor travels from home to the service and back.
        const dest=isWorker?
          (m.districtAtWork?
            (area.cells.find(c=>c!==area.workerStop&&
              Math.abs(c.x-area.workerStop.x)+
              Math.abs(c.y-area.workerStop.y)===1)||area.workerStop):
            area.workerStop):
          (m.districtAtWork?area.far:area.visitorStop);
        const origin={x:Math.round(m.x-.5),y:Math.round(m.y-.5)};
        const path=districtRoute(area,origin,dest);
        if(!path.length){
          m.districtAction=isWorker?'working':'strolling';
          m.v=0;m.stopUntil=clock+3;continue;
        }
        m.path=path.map((p,i)=>({...p,speed:m.max,
          ...(i===path.length-1?{then:o=>{
            o.v=0;o.districtAtWork=!o.districtAtWork;
            if(isWorker){
              o.districtAction=o.districtAtWork?'working':'checking';
              o.intent='visiting';o.stopUntil=clock+
                (o.districtAtWork?7:2.5);
              o.attention={x:area.x,y:area.y};
              if(o.districtAtWork)districtTasks++;
            }else{
              const arrived=o.districtAtWork;
              o.districtAction=arrived?'greeting':'strolling';
              o.intent=arrived?'chat':'destination';
              o.stopUntil=clock+(arrived?4.3:2.7);
              o.attention=arrived?
                {x:worker.x,y:worker.y}:{x:area.x,y:area.y};
              if(arrived){
                o.waveUntil=clock+1.5;
                worker.waveUntil=clock+.9;
                districtVisits++;area.arrivals++;
                if(Math.hypot(worker.x-o.x,worker.y-o.y)<1.65){
                  districtMeetings++;area.interactions++;
                }
              }
            }
          }}:{})
        }));
        m.intent='destination';
        m.districtAction=isWorker?'checking':'strolling';
        m.attention={x:dest.x+.5,y:dest.y+.5};
      }
    }
  }
  function spawnBike(r = Math.random) {
    const p = randomRoadPoint(r), m = {type: 'car', kind: 'bike', x: p.x, y: p.y, d: p.d, heading: directionAngle(p.d), v: 0, travel: 0, moved:0, max: .55 + r() * .15, col: PASTEL[r() * PASTEL.length | 0], skin: ['#f1c9a5', '#d8a77c', '#a8754f', '#7a4e33'][r() * 4 | 0], wait: 0, lane: .31, ph: r() * 6};
    findSafeSpawn(m,r);
    movers.push(m); return m;
  }
  // Traffic lights: the two directions take turns, with a short amber in between.
  const lightPhase = () => { const u = clock % (LIGHT * 2); return {green: u < LIGHT ? 'x' : 'y', amber: u % LIGHT > LIGHT - 2}; };
  // Is m held at the next crossing? Movers along x wait while y has green, and the other way round.
  function heldAtLight(m, stopAt, inner = .3) {
    const L = lightPhase(), axis = m.d < 2 ? 'x' : 'y', pos = m.d < 2 ? m.x : m.y, sign = m.d === 0 || m.d === 2 ? 1 : -1;
    if (L.green === axis && !L.amber) return false;
    for (const l of LINES) { const dist = (l + .5 - pos) * sign; if (dist > stopAt - inner && dist < stopAt + .35) return true; }
    return false;
  }
  // Both renderers and the traffic planner use one actual occupied lane.
  // Positive x and positive y have opposite right-hand transverse offsets.
  function laneOffset(m) {
    const lane=m.lane||0;
    if(m.type!=='car')return m.d<2?[0,lane]:[-lane,0];
    return m.d<2?[0,(m.d===0?1:-1)*lane]:
      [(m.d===2?-1:1)*lane,0];
  }
  function vehiclePoint(m,x=m.x,y=m.y){
    const [ox,oy]=m.path?[0,0]:laneOffset(m);
    return {x:x+ox,y:y+oy};
  }
  // Oriented rectangular clearance: oncoming traffic in the opposite
  // half of the road must not cause phantom brakes, but same-lane followers
  // and crossing traffic must not occupy the same body footprint.
  function bodyExtent(m,ux,uy){
    const d=DIRS[m.d],along=Math.abs(d[0]*ux+d[1]*uy);
    const across=Math.abs(d[0]*uy-d[1]*ux);
    const length=m.kind==='bus'?.325:m.kind==='bike'?.19:.23;
    const width=m.kind==='bike'?.085:.14;
    return {front:length*along+width*across,
      side:length*across+width*along};
  }
  function vehicleClearance(m,o,ux,uy){
    const a=bodyExtent(m,ux,uy),b=bodyExtent(o,ux,uy);
    return {front:a.front+b.front+.027,side:a.side+b.side+.018};
  }
  // The drawn size of each vehicle (half length, half width): what must never overlap on screen.
  const BODY_HALF = {bus: [.28, .108], fire: [.24, .10], bike: [.14, .05]};   // drawn half length / half width
  function tightExtent(m,ux,uy){
    const h=BODY_HALF[m.kind]||[.18,.10],d=DIRS[m.d],along=Math.abs(d[0]*ux+d[1]*uy),across=Math.abs(d[0]*uy-d[1]*ux);
    return {front:h[0]*along+h[1]*across,side:h[0]*across+h[1]*along};
  }
  function tightGap(m,o,ux,uy){
    const a=tightExtent(m,ux,uy),b=tightExtent(o,ux,uy);
    return {front:a.front+b.front+.012,side:a.side+b.side+.012};
  }
  // A walker standing in the carriageway (the lanes, not the pavement): cars stop for them.
  function personInRoad(o){
    if(o.sit||o.shopRole||o.inside||o.hidden)return false;
    const off=v=>LINES.reduce((a,l)=>Math.min(a,Math.abs(l+.5-v)),9);
    const p=vehiclePoint(o),ox=off(p.x),oy=off(p.y);
    // on a street's carriageway (within .33 of an axis), not on a bridge deck
    return (ox<.33&&p.y>1.2&&p.y<16.8&&!(p.y>12.9&&p.y<15.1))||(oy<.33&&p.x>1.2&&p.x<16.8);
  }
  // Swept forward clearance is imposed *before* moving each car. A red
  // light alone is not collision detection, especially after scripted paths.
  function safeVehicleTravel(m,ux,uy,request){
    if(request<=0)return 0;
    const here=vehiclePoint(m);
    let allowed=request;
    // Two cars that end up nose to flank in a junction each see the other "in
    // front" and would wait forever. One that has run out of patience may edge
    // out past crossing traffic; it never closes on traffic going its own way.
    const pushing=clock<(m.patienceUntil||0);
    for(const o of movers){
      if(o===m)continue;
      if(o.type==='person'){   // a walker in the carriageway ahead stops the car, whatever its light says
        if(!personInRoad(o))continue;
        const op=vehiclePoint(o),rx=op.x-here.x,ry=op.y-here.y,front=rx*ux+ry*uy,side=Math.abs(rx*uy-ry*ux);
        const hw=tightExtent(m,uy,ux).front,hl=tightExtent(m,ux,uy).front;
        if(front>0&&side<hw+.07&&front<request+hl+.2)allowed=Math.min(allowed,Math.max(0,front-hl-.07));
        continue;
      }
      if(o.type!=='car')continue;
      const other=vehiclePoint(o);
      const rx=other.x-here.x,ry=other.y-here.y;
      const front=rx*ux+ry*uy,side=Math.abs(rx*uy-ry*ux);
      // Two vehicles on the very same spot (after a U-turn or a spawn) would
      // each see the other "in front" forever: the earlier one goes first.
      if(Math.abs(front)<.06&&side<.12&&movers.indexOf(o)>movers.indexOf(m))continue;
      // A car that has run out of patience may edge out past crossing traffic, but never through its drawn body.
      const crossing=pushing&&(o.d<2)!==(m.d<2);
      const gap=crossing?tightGap(m,o,ux,uy):vehicleClearance(m,o,ux,uy);
      if(front>-.02&&side<gap.side&&front<request+gap.front+.20){
        allowed=Math.min(allowed,Math.max(0,front-gap.front));
      }
    }
    return Math.max(0,allowed);
  }
  function findSafeSpawn(m,r){
    const isolated=()=>{
      const p=vehiclePoint(m);
      return movers.every(o=>{
        if(o.type!=='car')return true;
        const q=vehiclePoint(o);
        const a=bodyExtent(m,1,0),b=bodyExtent(o,1,0);
        const c=bodyExtent(m,0,1),d=bodyExtent(o,0,1);
        return Math.abs(p.x-q.x)>a.front+b.front+.09||
          Math.abs(p.y-q.y)>c.front+d.front+.09;
      });
    };
    for(let tries=0;tries<80&&!isolated();tries++){
      const p=randomRoadPoint(r);
      m.x=p.x;m.y=p.y;m.d=p.d;m.heading=directionAngle(p.d);
    }
  }
  // A walker does not step into a vehicle's drawn body: they wait a moment at the kerb (the car, for its part, stops
  // short of anyone in the carriageway). After a few seconds they go on regardless, so nobody waits for ever.
  function walkerBlocked(m,nx,ny){
    if(m.type!=='person'||(m.kind&&m.kind!=='chef'&&m.kind!=='farmer'&&m.kind!=='keeper')||m.heroResident||m.shopRole)return false;
    if(clock<(m.carGoUntil||0))return false;
    const p=vehiclePoint(m,nx,ny),c=vehiclePoint(m);
    for(const o of movers){
      if(o.type!=='car'||o.kind==='icecream'||o.lift)continue;
      const q=vehiclePoint(o),hx=tightExtent(o,1,0).front+.02,hy=tightExtent(o,0,1).front+.02;
      if(Math.abs(c.x-q.x)<hx&&Math.abs(c.y-q.y)<hy)continue;   // already beside/inside it: let them leave
      if(Math.abs(p.x-q.x)<hx&&Math.abs(p.y-q.y)<hy){
        if(m.carWaitSince===undefined)m.carWaitSince=clock;
        if(clock-m.carWaitSince>4){m.carGoUntil=clock+3;m.carWaitSince=undefined;return false;}
        return true;
      }
    }
    m.carWaitSince=undefined;return false;
  }
  // Scripted walkers (errands, routines, events) wait at the kerb for the walk signal like everyone else: stepping off
  // the pavement into a street at a junction needs the light to be green for the other direction. They give up after
  // a full light cycle, and cars stop for them anyway.
  function walkerMustWait(m,nx,ny){
    if((m.kind&&m.kind!=='chef'&&m.kind!=='farmer'&&m.kind!=='keeper')||m.heroResident||m.shopRole)return false;
    if(clock<(m.sigGoUntil||0))return false;
    const L=lightPhase(),nearJunction=v=>LINES.some(l=>Math.abs(v-(l+.5))<.75);
    let hold=false;
    for(const l of LINES){
      const c=l+.5;
      // a street whose traffic runs along x (centre line y=c): entered from the pavement, near a junction
      if(Math.abs(m.y-c)>=.37&&Math.abs(ny-c)<.37&&nearJunction(nx)&&(L.green==='x'||L.amber))hold=true;
      if(Math.abs(m.x-c)>=.37&&Math.abs(nx-c)<.37&&nearJunction(ny)&&!(ny>12.9&&ny<15.1)&&(L.green==='y'||L.amber))hold=true;
    }
    if(!hold){m.sigWaitSince=undefined;return false;}
    if(m.sigWaitSince===undefined)m.sigWaitSince=clock;
    if(clock-m.sigWaitSince>(m.routine?4:14)){m.sigGoUntil=clock+4;   // commuters and children on a routine are in more of a hurry
     m.sigWaitSince=undefined;return false;}
    return true;
  }
  // A siren (the fire truck on a call) clears the road: traffic on its street near it eases over to the kerb, and cars in
  // front of it, going the same way, pull in and stop until it has passed (never inside a junction: they clear it first).
  function emergencyNear(m){
    let hit=null;
    for(const o of movers){
      if(o===m||!o.siren||!o.path)continue;
      const horiz=m.d<2,perp=horiz?Math.abs(o.y-m.y):Math.abs(o.x-m.x),along=horiz?o.x-m.x:o.y-m.y;
      if(perp>.9||Math.abs(along)>2.6)continue;
      const sign=m.d===0||m.d===2?1:-1,ahead=along*sign<0&&o.d===m.d&&Math.abs(along)<2.2&&(o.v||0)>.25;   // the truck is behind this car, same way, moving
      hit=hit||{};hit.near=true;if(ahead)hit.stop=true;
    }
    return hit;
  }
  function atNode(m) { return LINES.some(l => Math.abs((m.d < 2 ? m.x : m.y) - (l + .5)) < .02); }
  // Would car m, pointing along direction nd from where it is now, sit clear of every other car?
  function laneFree(m,nd){
    const me={...m,d:nd},p=vehiclePoint(me),a=bodyExtent(me,1,0),c=bodyExtent(me,0,1);
    return movers.every(o=>{
      if(o===m||o.type!=='car')return true;
      const q=vehiclePoint(o),b=bodyExtent(o,1,0),d=bodyExtent(o,0,1);
      return Math.abs(p.x-q.x)>a.front+b.front+.03||Math.abs(p.y-q.y)>c.front+d.front+.03;
    });
  }
  // The last junction centre on a street's closed end: the car has nowhere to go straight on.
  function atRoadEnd(m){
    if(m.d===0)return m.x>=16.5-.004;
    if(m.d===1)return m.x<=1.5+.004;
    if(m.d===2)return m.y>=16.5-.004;
    return m.y<=1.5+.004;
  }
  function step(m, dt) {
    // Never dead-end inside the last junction: turn at the road-end apron
    // before another lane can trap the vehicle against the tabletop edge.
    if(m.type==='car'&&!m.path&&atRoadEnd(m)){
      // The car has reached the centre of the last junction: turn left or right into the cross street. Only when
      // both are blocked does it turn round (into the opposite lane, and only if that is clear), otherwise it waits.
      const sides=m.d<2?[2,3]:[0,1];
      const open=sides.filter(i=>{
        const nx=Math.round(m.x-.5+DIRS[i][0]),ny=Math.round(m.y-.5+DIRS[i][1]),t=tile(nx,ny);
        return t&&(t.kind==='road'||t.kind==='bridge')&&laneFree(m,i);
      });
      let nd=open.length?open[Math.random()*open.length|0]:laneFree(m,m.d^1)?m.d^1:-1;
      if(m.kind==='bus'&&m.rIdx!==undefined){const want=ROUTE_OUT[(m.rIdx+ROUTE_OUT.length-1)%ROUTE_OUT.length];if(open.includes(want))nd=want;}
      if(nd<0){m.v=0;m.braking=true;return;}
      if(nd!==(m.d^1)){const cross=DIRS[m.d][0]*DIRS[nd][1]-DIRS[m.d][1]*DIRS[nd][0];m.turnSignal=cross>0?'left':'right';m.turnUntil=clock+1.1;}
      else m.v=0;
      m.d=nd;
    }
    // Explicit displacement, not requested speed, powers character gaits.
    m.moved=0;
    // An attention pause has a finite lifetime even when another activity
    // starts before the next ordinary walking step (for example, a town
    // event assigning a route or waiting for an intersection).
    if(m.intent==='browse'&&clock>=(m.observeUntil||0)){
      m.intent='walking';m.attention=null;m.observeUntil=0;
    }
    if (m.kind === 'bus') busStopping(m);
    if (m.stopUntil && clock < m.stopUntil) { m.v = 0; return; }
    if (m.path) return stepPath(m, dt);
    if(m.communityResident&&m.intent==='chat'&&clock<(m.stopUntil||0)){
      m.v=0;return;
    }
    // A walker left off the street grid beside the river (after a gathering, say) would stroll straight on, over the water:
    // send them back to the nearest pavement first.
    if(m.type==='person'&&!m.kind&&!m.path&&!m.heroResident&&!m.shopRole&&!(m.stopUntil&&clock<m.stopUntil)&&m.y>12.8&&m.y<15.2&&!LINES.some(l=>Math.abs((m.d<2?m.y:m.x)-(l+.5))<.6)){endWhim(m);return;}
    // Free pedestrians have local awareness, not a global scripted parade.
    // They notice nearby storefronts, pause briefly, then resume their route.
    // They never teleport or step into the shop/road center to do so.
    if(m.type==='person'&&!m.kind&&!m.heroResident){
      if(clock<(m.observeUntil||0)){m.v=0;return;}
      // Now and then a walker dawdles for a moment (a look round, a stretch, a breath) away from the junctions.
      if(m.nextDawdle===undefined)m.nextDawdle=clock+6+Math.random()*20;
      if(m.max>.05&&clock>=m.nextDawdle){
        m.nextDawdle=clock+9+Math.random()*26;
        const atJunction=LINES.some(l=>Math.abs((m.d<2?m.x:m.y)-(l+.5))<.75);
        if(!atJunction&&Math.random()<.55){m.observeUntil=clock+.7+Math.random()*1.6;m.attention=null;m.glanceAt={x:m.x+(Math.random()-.5)*3,y:m.y+(Math.random()-.5)*3};m.glanceUntil=m.observeUntil;m.v=0;return;}
      }

      if(clock>=(m.nextNotice||0)&&m.max>.05){
        m.nextNotice=clock+13+Math.random()*9;
        const nearby=buildings.filter(b=>b.kind==='shop')
          .map(b=>({x:b.x+.5,y:b.y+.5,d:Math.hypot(b.x+.5-m.x,b.y+.5-m.y)}))
          .filter(b=>b.d>.58&&b.d<1.70)
          .sort((a,b)=>a.d-b.d)[0];
        const atJunction=LINES.some(l=>Math.abs(m.x-(l+.5))<.36&&
          Math.abs(m.y-(l+.5))<.36);
        if(nearby&&!atJunction){
          m.intent='browse';m.attention={x:nearby.x,y:nearby.y};
          m.observeUntil=clock+1.7+Math.random()*1.5;m.v=0;return;
        }
      }
    }
    const [dx, dy] = DIRS[m.d];
    let want = m.max;
    let em=null;
    if(m.type==='car'){
      if(m.baseLane===undefined)m.baseLane=m.lane;
      em=emergencyNear(m);
      const target=em?(m.kind==='bike'?.335:.22):m.baseLane;
      m.lane+=clamp(-dt*.5,target-m.lane,dt*.5);
    }
    // No two walkers keep the same pace: each one's speed drifts slowly up and down.
    if (m.type === 'person' && !m.kind && !m.heroResident && m.max > .05) want *= .88 + .24 * Math.sin(clock * (.28 + ((m.ph || 0) % 1) * .3) + (m.ph || 0) * 1.7);
    // Weather and place change how fast people and cars go: walkers hurry in the rain, cars ease off in rain, snow and fog,
    // and everyone drives slowly past the plaza.
    const wx = typeof ToyTownWeather !== 'undefined' && ToyTownWeather.state ? ToyTownWeather.state.kind : 'clear';
    const wet = wx === 'rain' || wx === 'storm';
    if (m.type === 'person' && !m.kind && wet) want *= 1.18;
    if (m.type === 'car') {
      if (wet) want *= .86; else if (wx === 'snow' || wx === 'fog') want *= .8;
      if (Math.abs(m.x - 9) < 3.1 && Math.abs(m.y - 9) < 3.1) want *= .78;
    }
    const patient = clock < (m.patienceUntil || 0);   // out of patience: stop yielding (never stop avoiding a collision)
    if (m.type === 'car') {   // keep a gap to whatever is ahead in the lane, and stop for red lights
      for (const o of movers) if (!patient && o !== m && o.type === 'car' && o.d === m.d) {
        const p=vehiclePoint(m),q=vehiclePoint(o);
        const ahead=(q.x-p.x)*dx+(q.y-p.y)*dy;
        const side=Math.abs((q.x-p.x)*dy-(q.y-p.y)*dx);
        if (ahead > 0 && ahead < 1.55 && side < vehicleClearance(m,o,dx,dy).side){
          // Begin braking before reaching the vehicle ahead, scaled by
          // the space available. Avoid the abrupt 0.6m emergency stop.
          const safe=Math.max(0,ahead-.42);
          const approach=Math.sqrt(2*.9*safe);
          want=Math.min(want,Math.max(0,Math.min(m.max,o.v+approach)));
          if(ahead<.50)want=Math.min(want,o.v*.55);
        }
      }
      // Speed planning for the next intersection. Anticipate the red/amber
      // phase from up to 2.3m, but never assume an upcoming green is safe.
      const axis=m.d<2?'x':'y';
      const pos=axis==='x'?m.x:m.y,sign=m.d===0||m.d===2?1:-1;
      const phase=lightPhase();
      // The stop line leaves the whole body short of the crosswalk (a longer vehicle stops further back).
      const stopD=.57+(BODY_HALF[m.kind]||[.18])[0];
      if(phase.green!==axis||phase.amber){
        const crossings=LINES.map(l=>(l+.5-pos)*sign)
          .filter(d=>d>0&&d<2.35);
        if(crossings.length){
          const distance=Math.min(...crossings);
          // A vehicle that already crossed the stop line MUST finish
          // clearing the junction after a signal changes. Stopping in the
          // middle causes a persistent cross-traffic deadlock.
          if(distance>stopD+.08){
            const room=Math.max(0,distance-stopD-.08);
            want=Math.min(want,Math.sqrt(2*.92*room));
          }
        }
      }
      if (em) {
        const pos = m.d < 2 ? m.x : m.y;
        if (em.stop && !LINES.some(l => Math.abs(pos - (l + .5)) < .62)) { want = 0; m.yieldUntil = clock + .6; } else want *= .6;
      }
      if (heldAtLight(m, stopD, .12)) want = 0;   // already over the line: finish clearing the junction, don't stop on the crosswalk
      // Cross-traffic clearance: a green signal does not authorize entering
      // a junction still occupied by vehicles from the previous phase.
      // Brake *before* the central conflict area and resume once it clears.
      // No car is teleported or repositioned and event routes stay intact.
      const fixed=axis==='x'?m.y:m.x;
      for(const line of LINES){
        const crossing=line+.5;
        const approach=(crossing-pos)*sign;
        if(approach<=-.15||approach>=1.75)continue;
        const occupied=!patient&&movers.some(o=>{
          if(o===m||o.type!=='car'||o.path||(o.d<2)===(m.d<2))
            return false;
          const otherFixed=axis==='x'?o.x:o.y;
          const otherAlong=axis==='x'?o.y:o.x;
          return Math.abs(otherFixed-crossing)<.18&&
            Math.abs(otherAlong-fixed)<.65;
        });
        if(occupied){
          // Reserve the full vehicle footprint outside the conflict box,
          // not just its center point. This leaves room for the occupant
          // of the crossing to leave without side-by-side gridlock.
          const clearance=Math.max(0,approach-.75);
          want=Math.min(want,Math.sqrt(2*.79*clearance));
        }
      }
      const hb = town.blocks.find(b => b.hero);
      if (hb && m.d < 2 && Math.abs(m.y - (hb.yb + 1.5)) < .27 &&
        movers.some(w => w.heroResident && w.crossing &&
          Math.abs(w.x - (hb.xa + 1.5)) < .7 &&
          w.y > hb.yb + .3 && w.y < hb.yb + 2)) {
        const remaining = (hb.xa + 1.5 - m.x) * dx;
        if (remaining > .15 && remaining < 2) want = 0;
      }
      for (const e of events) if (e.blocks && Math.hypot(e.x - m.x, e.y - m.y) < 1.1) want = 0;
    } else if (!m.kind || m.kind === 'chef' || m.kind === 'farmer' || m.kind === 'keeper') {   // walkers wait at the crossing and keep a little room
      if (heldAtLight(m, .62)) want = 0;
      for (const o of movers) if (o !== m && o.type === 'person' && o.d === m.d) { const ahead = (o.x - m.x) * dx + (o.y - m.y) * dy, side = Math.abs((o.x - m.x) * dy) + Math.abs((o.y - m.y) * dx); if (ahead > 0 && ahead < .3 && side < .1) want = Math.min(want, o.v * .8); }
    }
    if(m.type==='person'&&!m.path&&m.max>.05){
      // Personal space: a pedestrian naturally eases behind another walker.
      for(const o of movers)if(!patient&&o!==m&&o.type==='person'&&!o.path){
        const ahead=(o.x-m.x)*dx+(o.y-m.y)*dy;
        const lateral=Math.abs((o.x-m.x)*dy-(o.y-m.y)*dx);
        if(ahead>.03&&ahead<.40&&lateral<.16)
          want=Math.min(want,ahead<.20?0:Math.max(0,o.v*.75));
      }
    }
    if(m.type==='car'){
      m.braking=want<m.max*.43&&m.v>.06;
      if(clock>=(m.turnUntil||0))m.turnSignal=null;
    }
    m.v += (want - m.v) * Math.min(1, dt * (m.type==='car'?2.1:3));
    const before = m.d < 2 ? m.x : m.y;
    const requested=Math.max(0,m.v*dt);
    const advance=m.type==='car'?
      safeVehicleTravel(m,dx,dy,requested):requested;
    if(m.type==='car'&&advance<requested-.00001){
      m.braking=true;m.v=Math.min(m.v,advance/Math.max(dt,.00001));
    }
    let adv=advance;
    if(m.type==='person'&&adv>0&&walkerBlocked(m,m.x+dx*adv,m.y+dy*adv)){adv=0;m.v=0;}
    if(m.type==='car'&&!m.path){   // never run past the last junction centre: turn there
      const toEnd=m.d===0?16.5-m.x:m.d===1?m.x-1.5:m.d===2?16.5-m.y:m.y-1.5;
      if(toEnd>=0&&adv>toEnd)adv=toEnd;
    }
    m.x += dx*adv;m.y += dy*adv;
    m.moved=adv;
    m.travel=(m.travel||0)+advance; // only real displacement drives footsteps and wheels
    const now = m.d < 2 ? m.x : m.y;
    for (const l of LINES) {   // crossing an intersection centre: maybe turn
      const c = l + .5;
      if ((before - c) * (now - c) <= 0 && before !== now) {
        const opts = DIRS.map((_, i) => i).filter(i => i !== (m.d ^ 1)).filter(i => { const nx = Math.round((m.d < 2 ? c : m.x) - .5 + DIRS[i][0]), ny = Math.round((m.d < 2 ? m.y : c) - .5 + DIRS[i][1]); const t = tile(nx, ny); return t && (t.kind === 'road' || t.kind === 'bridge'); });
        let routed = -1;
        if (m.kind === 'bus' && !m.path) {   // the bus follows its route
          const near = v => LINES.reduce((a, l, i) => Math.abs(l + .5 - v) < Math.abs(LINES[a] + .5 - v) ? i : a, 0);
          const col = m.d < 2 ? LINES.indexOf(l) : near(m.x), row = m.d < 2 ? near(m.y) : LINES.indexOf(l), out = busRouteOut(m, col, row);
          if (out >= 0 && opts.includes(out)) routed = out;
        }
        if (routed >= 0 || (opts.length && (Math.random() < (m.kind === 'bus' ? .75 : .45) || !opts.includes(m.d)))) { const nd = routed >= 0 ? routed : opts[Math.random() * opts.length | 0]; if (nd !== m.d &&
          (m.type!=='car'||laneFree(m,nd))) {
          const cross=DIRS[m.d][0]*DIRS[nd][1]-DIRS[m.d][1]*DIRS[nd][0];
          if(m.type==='car'){m.turnSignal=cross>0?'left':'right';m.turnUntil=clock+1.1;}
          if (m.d < 2) m.x = c; else m.y = c; m.d = nd;
        } }
      }
    }
    if (m.x < 1.4 || m.x > 16.6 || m.y < 1.4 || m.y > 16.6) { m.d ^= 1; m.x = clamp(1.45, m.x, 16.55); m.y = clamp(1.45, m.y, 16.55); }
  }
  // Scripted movement (an event's chase, a fire truck's run): straight to each point in turn.
  // Ease the rendered vehicle toward its actual lane direction during turns.
  function easeHeading(m, dt) {
    if (m.type !== 'car') return;
    const target = directionAngle(m.d);
    const from = Number.isFinite(m.heading) ? m.heading : target;
    const delta = Math.atan2(Math.sin(target - from), Math.cos(target - from));
    m.heading = from + clamp(-dt * 5, delta, dt * 5);
  }
  function stepPath(m, dt) {
    const p = m.path[0]; if (!p) { m.path = null; return; }
    // Every walking leg (events, gatherings, errands) keeps out of the river: round by a bridge, never over the water.
    if (m.type === 'person' && !p.dry) {
      p.dry = true; const fix = dryRoute([{x: p.x, y: p.y, speed: p.speed}], m.x, m.y), last = fix[fix.length - 1];
      p.x = last.x; p.y = last.y;
      if (fix.length > 1) { m.path.splice(0, 0, ...fix.slice(0, -1).map(q => ({x: q.x, y: q.y, speed: p.speed || m.max, dry: true}))); return; }
    }
    // Scripted event paths sometimes target coordinates beyond the tabletop.
    // Clip *waypoints* before stepping, so the walker/vehicle can actually
    // reach its destination instead of getting stuck against a hard border.
    const targetX=clamp(.08,p.x,17.92),targetY=clamp(.08,p.y,17.92);
    const dx = targetX - m.x, dy = targetY - m.y;
    const dist = Math.hypot(dx, dy), sp = Math.max(0,(p.speed || m.max) * dt);
    if(dist<.00001){
      m.v=0;m.path.shift();if(p.then)p.then(m);return;
    }
    const ux=dx/dist,uy=dy/dist;
    const nextDir=Math.abs(dx)>Math.abs(dy)?(dx>0?0:1):(dy>0?2:3);
    if(m.type==='person'){
      // A route segment can be diagonal. Store its REAL travel direction
      // for the 3D body rather than showing a north-facing person sliding
      // northeast. Rotate in place before a large path bend.
      const facing=Math.atan2(ux,uy);
      const previous=Number.isFinite(m.walkFacing)?m.walkFacing:
        [Math.PI/2,-Math.PI/2,0,Math.PI][m.d];
      const angle=Math.abs(Math.atan2(Math.sin(facing-previous),
        Math.cos(facing-previous)));
      if(m.turnPauseUntil&&clock<m.turnPauseUntil){
        m.v=0;m.moved=0;return;
      }
      // Only a sharp turn (about 100 degrees or more: turning right round) stops for a moment; ordinary corners are
      // taken on the move, the drawn heading swinging round over a fraction of a second.
      if(angle>1.75&&dist>.18){
        m.d=nextDir;m.walkFacing=facing;
        m.turnPauseUntil=clock+Math.min(.85,.14+angle/3.8);
        m.v=0;m.moved=0;return;
      }
      m.turnPauseUntil=0;
      const swing=Math.atan2(Math.sin(facing-previous),Math.cos(facing-previous));
      m.walkFacing=Math.abs(swing)<.02?facing:previous+clamp(-dt*9,swing,dt*9);
    }
    m.d=nextDir;
    if(m.type==='person'){
      const step=Math.min(dist,sp),nx=m.x+ux*step,ny=m.y+uy*step;
      if(walkerMustWait(m,nx,ny)||walkerBlocked(m,nx,ny)){m.v=0;m.moved=0;return;}
    }
    const requested=Math.min(dist,sp);
    const advance=m.type==='car'?
      safeVehicleTravel(m,ux,uy,requested):requested;
    m.moved=advance;
    m.v=advance/Math.max(dt,.00001);
    m.travel=(m.travel||0)+advance;
    if(m.type==='car')m.braking=advance<requested-.00001;
    if(dist<=advance+.00001){
      m.x=targetX;m.y=targetY;m.path.shift();if(p.then)p.then(m);
    }else{
      m.x+=ux*advance;m.y+=uy*advance;keepDry(m);
    }
  }
  // A walking route that keeps to the pavements: along the near pavement to the
  // first corner, along the street (crossing side roads at their junctions),
  // round the corner onto the destination street's pavement, then the last step.
  const PAVE = .43;
  function walk(x, y, tx, ty, speed) {
    const near = v => LINES.reduce((a, l) => Math.abs(l + .5 - v) < Math.abs(a - v) ? l + .5 : a, LINES[0] + .5);
    const lx = near(x), ly = near(y), gx = near(tx), gy = near(ty);
    const sx = x >= lx ? PAVE : -PAVE, sy = y >= ly ? PAVE : -PAVE, ex = tx >= gx ? PAVE : -PAVE, ey = ty >= gy ? PAVE : -PAVE;
    return dryRoute([{x: lx + sx, y: ly + sy, speed}, {x: gx + ex, y: ly + sy, speed}, {x: gx + ex, y: gy + ey, speed}, {x: tx, y: ty, speed}], x, y);
  }
  // Nobody walks on the river: a leg that would cross the water away from a bridge goes round by the nearest bridge,
  // and a target that falls in the water is moved to the bank.
  const inRiver = y => y > 13.04 && y < 14.96, onBridgeX = x => LINES.some(l => Math.abs(x - (l + .5)) < .6);
  // The last safety net: a walker caught in the water off a bridge deck steps back to the bank.
  function keepDry(m) { if (m.type === 'person' && inRiver(m.y) && !onBridgeX(m.x)) m.y = m.y < 14 ? 13.0 : 15.0; }
  function dryRoute(pts, x, y) {
    const out = []; let px = x, py = y;
    for (const p of pts) {
      let tx = p.x, ty = p.y;
      if (inRiver(ty) && !onBridgeX(tx)) ty = ty < 14 ? 12.95 : 15.05;
      // Does the straight leg touch the water anywhere off a bridge deck?
      let wet = false; for (let k = 1; k <= 14 && !wet; k++) { const f = k / 15, sx = px + (tx - px) * f, sy = py + (ty - py) * f; if (inRiver(sy) && !onBridgeX(sx)) wet = true; }
      const startOnDeck = inRiver(py) && onBridgeX(px);
      if (wet && startOnDeck) {   // leaving a bridge: walk along it to the bank first, then on to the target
        const southBank = ty >= 14 || (ty === py && py >= 14);
        out.push({x: px, y: southBank ? 15.05 : 12.95, speed: p.speed});
        py = southBank ? 15.05 : 12.95;
      } else if (wet) {
        const targetOnDeck = inRiver(ty) && onBridgeX(tx), mx = targetOnDeck ? tx : (px + tx) / 2;
        const bx = LINES.reduce((a, l) => Math.abs(l + .5 - mx) < Math.abs(a - mx) ? l + .5 : a, LINES[0] + .5), lane = (mx >= bx ? 1 : -1) * .3;
        const fromNorth = py < 14, nearBank = fromNorth ? 12.95 : 15.05, farBank = fromNorth ? 15.05 : 12.95;
        out.push({x: bx + lane, y: nearBank, speed: p.speed});
        if (!targetOnDeck && ((fromNorth && ty >= 14.96) || (!fromNorth && ty <= 13.04))) out.push({x: bx + lane, y: farBank, speed: p.speed});
      }
      out.push(Object.assign({}, p, {x: tx, y: ty})); px = tx; py = ty;
    }
    return out;
  }
  // A walker already on the street starts from where they are drawn (their pavement), so nothing jumps.
  function walkFrom(m, tx, ty, speed) {
    if (!m.path) { const [ox, oy] = laneOffset(m); m.x += ox; m.y += oy; }
    return walk(m.x, m.y, tx, ty, speed);
  }
  // A route along the streets from (x,y) to (tx,ty): along the current line, then the other axis.
  function route(x, y, tx, ty, speed) {
    const near = v => LINES.reduce((a, l) => Math.abs(l + .5 - v) < Math.abs(a - v) ? l + .5 : a, LINES[0] + .5);
    const lx = near(x), ly = near(y), gx = near(tx), gyy = near(ty);
    return [{x: lx, y: ly, speed}, {x: gx, y: ly, speed}, {x: gx, y: gyy, speed}, {x: tx, y: ty, speed}];
  }

  /* ---------------- chaos ---------------- */
  function say(who, text, secs = 2) { bubbles.push({who, text, until: clock + secs}); }
  function tick(text) { const el = document.getElementById('tick'); if (el) el.textContent = text; }
  function feature(e, secs = 7) { if (e.quiet) return; if (!director || clock > directorUntil) { director = e; directorUntil = clock + secs; } }
  function burst(x, y, z, n, col, opt = {}) { for (let i = 0; i < n; i++) parts.push({x, y, z, vx: (Math.random() - .5) * (opt.spread || 1.4), vy: (Math.random() - .5) * (opt.spread || 1.4), vz: (opt.up || 40) + Math.random() * (opt.up || 40), g: opt.g ?? 90, life: opt.life || 1.4, t: 0, col: Array.isArray(col) ? col[Math.random() * col.length | 0] : col, r: opt.r || 1.6, star: opt.star}); }
  const buildingOn = pred => { const list = buildings.filter(pred); return list[Math.random() * list.length | 0]; };
  const peopleNear = (x, y, d) => movers.filter(m => m.type === 'person' && Math.hypot(m.x - x, m.y - y) < d);
  const EVENTS = {
    hydrant(x, y) {
      const p = randomRoadPoint(Math.random); x = x ?? p.x + .42; y = y ?? p.y + .42;
      tick(`A fire hydrant bursts on ${streetOf(x, y)} — free shower for everyone!`);
      return {x, y, dur: 9, update(e, dt) { if (Math.random() < dt * 30) burst(e.x, e.y, 2, 2, ['#7fd3ff', '#bfe9ff'], {up: 60, spread: .5, life: 1.1, r: 1.4}); if (e.t > .5 && !e.said) { e.said = 1; for (const m of peopleNear(e.x, e.y, 2.5).slice(0, 3)) { m.stopUntil = clock + 4; say(m, ['WHEEE!', 'SPLASH!', 'My hair!', 'Refreshing!'][Math.random() * 4 | 0]); } } }};
    },
    cart(x, y) {
      const a = randomRoadPoint(Math.random), b = randomRoadPoint(Math.random);
      const cart = spawnPerson(Math.random, {kind: 'cart', max: 1.6, lane: .1}), chaser = spawnPerson(Math.random, {max: 1.25});
      cart.x = x ?? a.x; cart.y = y ?? a.y; chaser.x = cart.x - .9; chaser.y = cart.y;
      cart.path = walk(cart.x, cart.y, b.x, b.y, 1.6); chaser.path = walk(chaser.x, chaser.y, b.x, b.y, 1.25);
      say(chaser, 'COME BACK!', 3); tick(`Runaway shopping cart speeding down ${streetOf(cart.x, cart.y)}!`);
      return {x: cart.x, y: cart.y, dur: 12, follow: cart, end() { remove(cart); chaser.path = null; say(chaser, 'Phew…'); }};
    },
    dog(x, y) {
      const a = randomRoadPoint(Math.random), b = randomRoadPoint(Math.random);
      const dog = spawnPerson(Math.random, {kind: 'dog', max: 1.4, lane: .3}), chef = spawnPerson(Math.random, {kind: 'chef', max: 1.1, col: '#ffffff'});
      dog.x = x ?? a.x; dog.y = y ?? a.y; chef.x = dog.x - 1; chef.y = dog.y;
      dog.path = walk(dog.x, dog.y, b.x, b.y, 1.4); chef.path = walk(chef.x, chef.y, b.x, b.y, 1.05);
      say(chef, 'MY SAUSAGES!', 3); say(dog, 'woof!', 1.5); tick('A dog has stolen the butcher\'s sausages. The chase is on!');
      return {x: dog.x, y: dog.y, dur: 12, follow: dog, end() { remove(dog); chef.path = null; say(chef, 'Next time…'); }};
    },
    balloons(x, y) {
      const kid = movers.find(m => m.type === 'person' && !m.kind) || spawnPerson();
      kid.stopUntil = clock + 5; say(kid, 'MY BALLOONS!', 3); tick('A bunch of balloons escapes over the rooftops!');
      const b = Array.from({length: 6}, (_, i) => ({x: kid.x, y: kid.y, z: 18, col: ['#ff5d5d', '#ffd23f', '#5dd3ff', '#9b7dff', '#5dff9b', '#ff8fd0'][i], ph: i}));
      return {x: kid.x, y: kid.y, dur: 10, balloons: b, update(e, dt) { for (const q of e.balloons) { q.z += dt * (14 + q.ph * 2); q.x += dt * (.15 + Math.sin(clock + q.ph) * .1); } }};
    },
    cat(x, y) {
      const b = buildingOn(b => b.kind === 'house' || b.kind === 'shop'), st = town.blocks.find(k => k.station);
      if (!b || !st) return null;
      tick(`A cat is stuck on the roof at ${streetOf(b.x + .5, b.y + 1.6)}! Fire truck on the way!`);
      const truck = spawnCar(Math.random, 'fire'); truck.col = '#e2463a'; truck.x = st.station.x; truck.y = st.station.y; truck.max = 1.8;
      truck.path = route(st.station.x, st.station.y, b.x + .5, b.y + 1.5, 1.8).concat([{x: b.x + .5, y: b.y + 1.5, speed: .01, then: m => { m.ladder = 1; m.stopUntil = clock + 3; say(m, 'Hold on, kitty!'); }}]);
      truck.siren = true;
      return {x: b.x + .5, y: b.y + .5, dur: 16, cat: {b, z: b.h + 6}, follow: truck, update(e, dt) { if (truck.ladder && !e.saved) { e.saved = 1; setTimeout(() => {}, 0); e.cat.jumpAt = clock + 2.2; } if (e.cat.jumpAt && clock > e.cat.jumpAt && !e.cat.down) { e.cat.down = 1; say({x: e.x, y: e.y + 1, z: 10}, 'MEOW. (I was fine.)', 2.5); tick('The cat jumped down by itself. Firefighters embarrassed.'); } }, end() { truck.path = route(truck.x, truck.y, st.station.x, st.station.y, 1.4); truck.ladder = 0; truck.siren = false; truck.home = true; }};
    },
    pigeons(x, y) {
      const p = randomRoadPoint(Math.random); x = x ?? p.x; y = y ?? p.y;
      tick(`Pigeons have taken over ${streetOf(x, y)}. They want bread.`);
      const flock = Array.from({length: 12}, () => ({x: x + (Math.random() - .5) * 6, y: y - 5 + Math.random() * 2, z: 80, tx: x + (Math.random() - .5) * 1.4, ty: y + (Math.random() - .5) * 1.4}));
      for (const m of peopleNear(x, y, 2).slice(0, 2)) say(m, ['Shoo!', 'Not my sandwich!'][Math.random() * 2 | 0]);
      return {x, y, dur: 11, flock, update(e, dt) { const leave = e.t > e.dur - 2.5; for (const f of e.flock) { const tz = leave ? 120 : 0; f.x += ((leave ? f.tx + 4 : f.tx) - f.x) * dt * 1.2; f.y += ((leave ? f.ty - 4 : f.ty) - f.y) * dt * 1.2; f.z += (tz - f.z) * dt * 1.5; } }};
    },
    banana(x, y) {
      const m = movers.find(o => o.type === 'person' && !o.kind && (x === undefined || Math.hypot(o.x - x, o.y - y) < 4)) || spawnPerson();
      m.stopUntil = clock + 3; m.slip = clock; say(m, 'WHOA!', 1.5); tick(`Banana peel strikes again on ${streetOf(m.x, m.y)}.`);
      burst(m.x, m.y, 14, 6, '#ffd23f', {up: 30, star: 1, life: 1.2});
      return {x: m.x, y: m.y, dur: 4};
    },
    ufo(x, y) {
      const victim = movers.find(m => m.type === 'car' && !m.path && !m.kind.startsWith('fire')) || movers[0];
      tick('A UFO is borrowing a car. Witnesses say it "looked curious".');
      return {x: victim.x, y: victim.y, dur: 12, blocks: true, ufo: {z: 140}, victim, update(e, dt) { const v = e.victim; e.x = v.x; e.y = v.y; if (e.t < 3) e.ufo.z = 140 - e.t * 15; else if (e.t < 7) { v.lift = (v.lift || 0) + dt * 18; v.stopUntil = clock + 1; } else if (e.t < 9) { v.lift = Math.max(0, v.lift - dt * 40); v.stopUntil = clock + 1; } else { e.ufo.z += dt * 120; if (!e.said) { e.said = 1; say(v, 'HONK?!', 2); } } }, end() { e => 0; this.victim.lift = 0; }};
    },
    icecream() {
      const truck = spawnCar(Math.random, 'icecream'); truck.col = '#ffd6e8'; truck.max = .8;
      tick('♪ The ice cream van is here! ♪ Everyone drops everything.');
      return {x: truck.x, y: truck.y, dur: 12, follow: truck, update(e, dt) { if (e.t > 2 && !e.stopped) { e.stopped = 1; truck.stopUntil = clock + 8; say(truck, '♪ ding ding ♪', 3); for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 3)) { m.path = [{x: truck.x + (Math.random() - .5) * .8, y: truck.y + (Math.random() - .5) * .8, speed: .5, then: q => say(q, ['Vanilla!', 'Two scoops!', 'Sprinkles!'][Math.random() * 3 | 0], 1.5)}]; } } }};
    },
    duck() {
      tick('A GIANT rubber duck has appeared in the river. Nobody knows why.');
      return {x: -1, y: 13.9, dur: 16, bigduck: true, update(e, dt) { e.x += dt * 1.3; }};
    },
    jam() {
      const line = LINES[Math.random() * 4 | 0] + .5, cars = Array.from({length: 5}, (_, i) => { const c = spawnCar(); c.d = 0; c.x = 3 + i * .65; c.y = line; c.v = 0; return c; });
      cars[cars.length - 1].stopUntil = clock + 6; say(cars[cars.length - 1], 'Stalled… sorry!', 3);
      tick(`Traffic jam on ${streetOf(5, line)}. Somebody is honking a tune.`);
      return {x: 5, y: line, dur: 9};
    },
    chickens(x, y) {
      const p = randomRoadPoint(Math.random); x = x ?? p.x; y = y ?? p.y;
      const farmer = spawnPerson(Math.random, {kind: 'farmer', col: '#7aa35a', max: .9}); farmer.x = x - 1; farmer.y = y;
      const hens = Array.from({length: 6}, () => { const h = spawnPerson(Math.random, {kind: 'hen', max: .9, lane: (Math.random() - .5) * .8}); h.x = x + (Math.random() - .5); h.y = y + (Math.random() - .5); return h; });
      say(farmer, 'Get back here, girls!', 3); tick(`Escaped chickens on ${streetOf(x, y)}! Cars are being very patient.`);
      return {x, y, dur: 12, blocks: true, follow: hens[0], end() { for (const h of hens) remove(h); }};
    }
  };
  // Theme events: what the day's news turns into.
  const THEME_EVENTS = {
    space(e0) {
      const pad = props.find(p => p.kind === 'launchpad'); if (!pad) return null;
      tick('T-minus 10… the Toy Town rocket is about to launch from the park!');
      for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 6)) m.path = [{x: pad.x + (Math.random() - .5) * 3, y: pad.y + 2.2 + Math.random() * .8, speed: .9, then: q => { q.stopUntil = clock + 9; }}];
      return {x: pad.x, y: pad.y, dur: 16, rocket: pad, update(e, dt) { const c = Math.ceil(5 - e.t); if (e.t < 5 && c !== e.c) { e.c = c; say({x: pad.x, y: pad.y, z: 60}, String(c) + '…', .9); } if (e.t >= 5) { pad.launched = (pad.launched || 0) + dt * (30 + (e.t - 5) * 60); burst(pad.x, pad.y, pad.launched, 3, ['#ffffff', '#ffd23f', '#ff8a3d'], {up: -10, spread: .6, life: 1.2, g: 0, r: 3}); if (!e.said) { e.said = 1; say({x: pad.x - 1, y: pad.y + 2, z: 12}, 'OOOOOH!', 2.5); tick('LIFTOFF! The rocket is on its way to the Moon (or the next town).'); } } }, end() { pad.launched = 0; }};
    },
    sports() {
      const st = props.find(p => p.kind === 'stadium'); if (!st) return null;
      tick('Kick-off at Toy Town Stadium! The crowd goes wild.');
      return {x: st.x, y: st.y, dur: 14, match: st, update(e, dt) { st.ball = st.ball || {x: 0, y: 0, vx: 1, vy: .6}; st.ball.x += st.ball.vx * dt; st.ball.y += st.ball.vy * dt; if (Math.abs(st.ball.x) > 1.1) { st.ball.vx *= -1; if (Math.random() < .5) { say({x: st.x, y: st.y, z: 40}, 'GOOOAL!', 2); burst(st.x, st.y, 20, 20, ['#ff5d5d', '#ffd23f', '#5dd3ff'], {up: 70}); tick('GOAL! Toy Town United score again!'); } } if (Math.abs(st.ball.y) > .8) st.ball.vy *= -1; }};
    },
    election() {
      const stage = props.find(p => p.kind === 'stage'); if (!stage) return null;
      tick('Rally at the town square: candidates promise free bouncy castles for all.');
      for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 7)) { m.sign = ['VOTE!', 'YES!', 'NO!', 'BOUNCY!', 'MAYBE'][Math.random() * 5 | 0]; m.path = [{x: stage.x + (Math.random() - .5) * 3, y: stage.y + 1 + Math.random(), speed: .9, then: q => { q.stopUntil = clock + 8; }}]; }
      return {x: stage.x, y: stage.y, dur: 14, update(e) { if (e.t > 3 && !e.s) { e.s = 1; say({x: stage.x, y: stage.y, z: 34}, 'Free bouncy castles for all!', 3); } if (e.t > 7 && !e.s2) { e.s2 = 1; say({x: stage.x - 1, y: stage.y + 2, z: 14}, 'HOORAY!', 2); } }, end() { for (const m of movers) m.sign = null; }};
    },
    festival() {
      const stage = props.find(p => p.kind === 'stage') || {x: 9, y: 9};
      tick('Festival time! Fireworks over Toy Town.');
      return {x: stage.x, y: stage.y, dur: 14, update(e, dt) { if (Math.random() < dt * 1.6) { const x = stage.x + (Math.random() - .5) * 8, y = stage.y + (Math.random() - .5) * 8; burst(x, y, 140 + Math.random() * 60, 30, [['#ff5d5d', '#ffd23f'], ['#5dd3ff', '#ffffff'], ['#9b7dff', '#ff8fd0']][Math.random() * 3 | 0], {up: 0, spread: 2.2, g: 20, life: 1.6, r: 1.8}); } }};
    },
    awards() {
      const stage = props.find(p => p.kind === 'stage') || {x: 9, y: 9};
      tick('Red carpet tonight: a famous llama is expected at the premiere.');
      const star = spawnPerson(Math.random, {kind: 'llama', max: .5}); star.path = walk(star.x, star.y, stage.x, stage.y + 1.5, .7);
      return {x: stage.x, y: stage.y, dur: 14, follow: star, update(e, dt) { if (Math.random() < dt * 4) burst(stage.x + (Math.random() - .5) * 2, stage.y + 1.5, 12, 1, '#ffffff', {up: 10, life: .3, r: 2.5, g: 0}); if (e.t > 6 && !e.s) { e.s = 1; say(star, '*poses*', 2.5); } }, end() { remove(star); }};
    },
    tech() {
      tick('The delivery drones are out. Parcels are landing… mostly on the right roofs.');
      const drones = Array.from({length: 5}, () => ({x: Math.random() * 16 + 1, y: Math.random() * 16 + 1, tx: Math.random() * 16 + 1, ty: Math.random() * 16 + 1, z: 70, box: true}));
      for (let k = 0; k < 3; k++) spawnPerson(Math.random, {kind: 'robot', col: '#c0c8d4', max: .5});
      return {x: 9, y: 9, dur: 14, drones, update(e, dt) { for (const d of e.drones) { d.x += (d.tx - d.x) * dt * .4; d.y += (d.ty - d.y) * dt * .4; if (d.box && Math.hypot(d.tx - d.x, d.ty - d.y) < .3) { d.box = false; burst(d.x, d.y, 60, 1, '#c79a5a', {up: 0, spread: 0, g: 120, life: .6, r: 3}); say({x: d.x, y: d.y, z: 20}, ['THUNK', 'Delivered!', 'Oops'][Math.random() * 3 | 0], 1.2); } } }};
    },
    animals() {
      const zoo = props.find(p => p.kind === 'zoo'); if (!zoo) return null;
      const a = props.find(p => p.kind === 'animal' && !p.out) || props.find(p => p.kind === 'animal');
      a.out = true; const b = randomRoadPoint(Math.random); a.tx = b.x; a.ty = b.y;
      tick(`An ${a.a === 'elephant' ? 'elephant' : a.a} has left the zoo to see the town.`);
      const keeper = spawnPerson(Math.random, {kind: 'keeper', col: '#c9a25a', max: .8}); keeper.x = zoo.x; keeper.y = zoo.y + 2; keeper.path = walk(keeper.x, keeper.y, b.x, b.y, .8);
      say(keeper, 'Not again!', 2.5);
      return {x: a.x, y: a.y, dur: 15, animal: a, update(e, dt) { a.x += (a.tx - a.x) * dt * .25; a.y += (a.ty - a.y) * dt * .25; e.x = a.x; e.y = a.y; }, end() { a.out = false; a.tx = zoo.x; a.ty = zoo.y; a.x = zoo.x + (Math.random() - .5) * 2; a.y = zoo.y + (Math.random() - .5) * 2; }};
    },
    market() {
      const mk = props.find(p => p.kind === 'market') || {x: 9, y: 9};
      tick('Market Mania! Prices of rubber chickens hit an all-time high.');
      return {x: mk.x, y: mk.y, dur: 12, update(e, dt) { if (Math.random() < dt * 6) burst(mk.x + (Math.random() - .5) * 2, mk.y + (Math.random() - .5) * 2, 30, 1, '#7fd36b', {up: 40, spread: 1.6, g: 40, life: 2, r: 2.4}); if (e.t > 2 && !e.s) { e.s = 1; say({x: mk.x, y: mk.y, z: 30}, 'BUY! SELL! BUY!', 2.5); } }};
    },
    science() {
      const lab = props.find(p => p.kind === 'lab') || {x: 9, y: 9};
      tick('Something at the lab went "boing". Scientists say it was on purpose.');
      return {x: lab.x, y: lab.y, dur: 9, update(e) { if (e.t > 2 && !e.s) { e.s = 1; burst(lab.x, lab.y, 30, 40, ['#b6ff6b', '#ff6bd5', '#6be0ff'], {up: 80, spread: 2}); say({x: lab.x, y: lab.y, z: 50}, 'EUREKA!!', 2.5); } }};
    },
    weather() {
      tick('Rain on Toy Town! Umbrellas pop open everywhere.');
      return {x: 9, y: 9, dur: 16, rain: true};
    }
  };
  function remove(m) { const i = movers.indexOf(m); if (i >= 0) movers.splice(i, 1); }
  function startEvent(name, x, y) {
    const make = VARIANT_EVENTS[name] || THEME_EVENTS[name] || EVENTS[name]; if (!make) return null;
    if ((VARIANT_EVENTS[name] || THEME_EVENTS[name]) && events.some(e => e.name === name)) return null;   // one launch (or match, or parade) at a time
    const e = make(x, y); if (!e) return null;
    const news = today_.find(v => v.variant === name);
    if (news) {   // the story's own name on a banner over the scene, and on the fans' signs
      const N_ = (news.name || '').toUpperCase(), BAN = {sports: N_ ? `GO ${N_}!` : 'GO TEAM!', space: N_ ? `${N_} 🚀` : 'TO THE STARS!', election: N_ ? `${N_}: VOTE!` : 'VOTE!', festival: N_ ? `HAPPY ${N_}!` : 'HAPPY DAY!', awards: N_ ? `★ ${N_} ★` : '★ BRAVO ★', tech: N_ ? `${N_} ✨` : 'THE FUTURE!', animals: N_ ? `WELCOME, ${N_}!` : 'HELLO, ANIMALS!', market: N_ ? `${N_} ↑↓` : 'BUY! SELL!', science: N_ ? `${N_} 🧪` : 'EUREKA!'};
      e.banner = BAN[news.key] || news.title.toUpperCase();
      if (news.name) for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 4)) { m.sign = news.name.split(' ')[0].toUpperCase().slice(0, 10); setTimeout(() => { m.sign = null; }, 20000); }
      if (Math.random() < .5) tick('The village is reacting to a recent headline. The scene is fictional.');
    }
    e.name = name; e.t = 0; events.push(e); feature(e, name in VARIANT_EVENTS || name in THEME_EVENTS ? 11 : 7); return e;
  }
  function randomEvent(x, y) {
    const names = CALM;
    // The day's theme comes round often; the town's everyday chaos fills the rest.
    // The day's news comes round often (the lead story most); everyday chaos fills the rest.
    const news = today_.length ? (Math.random() < .55 ? today_[0] : today_[Math.random() * today_.length | 0]).variant : theme;
    const free = names.filter(n => !events.some(e => e.name === n));
    const pick = Math.random() < .35 && !events.some(e => e.name === news) ? news : free[Math.random() * free.length | 0];
    return startEvent(pick, x, y);
  }


  /* ---------------- more everyday chaos ---------------- */
  // A walking procession along one street: a band, runners, penguins, little ghosts…
  function procession(kind, n, speed, opts = {}) {
    const line = LINES[1 + (Math.random() * 2 | 0)] + .5, along = Math.random() < .5, from = 1.6, to = 16.4;
    const walkers = Array.from({length: n}, (_, i) => {
      const w = spawnPerson(Math.random, Object.assign({kind, max: speed, lane: (i % 2 ? .25 : -.25)}, opts));
      const start = from - i * .45; w.x = along ? start : line + (i % 2 ? .2 : -.2); w.y = along ? line + (i % 2 ? .2 : -.2) : start;
      w.path = [{x: along ? to : w.x, y: along ? w.y : to, speed}]; return w;
    });
    return {walkers, x: along ? 9 : line, y: along ? line : 9};
  }
  Object.assign(EVENTS, {
    band() {
      const p = procession('band', 7, .55);
      tick('The Toy Town Marching Band is out, playing the one song it knows.');
      return {x: p.x, y: p.y, dur: 26, blocks: true, follow: p.walkers[0], notes: p.walkers, end() { for (const w of p.walkers) remove(w); }};
    },
    hotair() {
      tick('A hot air balloon drifts over town. Someone in the basket is waving.');
      return {x: 2, y: 9, dur: 30, sky: {kind: 'hotair', x: -2, y: 4, z: 150, vx: .5, vy: .25}, update(e, dt) { e.sky.x += e.sky.vx * dt; e.sky.y += e.sky.vy * dt; e.x = e.sky.x; e.y = e.sky.y; if (e.t > 6 && !e.s) { e.s = 1; say({x: e.sky.x, y: e.sky.y, z: e.sky.z + 30}, 'Hello down there!', 2.5); } }};
    },
    busker() {
      // A real arrival from the garden arch. No musician materializes on
      // the road, and listeners walk to the performance before dancing.
      const hb=town.blocks.find(b=>b.hero);
      if(!hb)return null;
      // The same event can be chosen by the ordinary town director or
      // the regular concert schedule. Count it at creation, exactly once.
      streetPerformances++;
      const x=hb.xa+1.84,y=hb.ya+2.83;
      const musician=spawnPerson(Math.random,{
        kind:'busker',x:hb.xa+1.05,y:hb.ya+3.68,
        lane:0,d:3,max:.38,col:'#d18b83',bag:false,hat:'beanie',
        guitar:true,shopAction:'arriving'});
      musician.path=[{x,y,speed:.38,then:q=>{
        q.v=0;q.shopAction='performing';q.stopUntil=clock+18;
        say(q,'♪',1.6);
      }}];
      const listeners=movers.filter(o=>o.heroResident).slice(0,2);
      for(let i=0;i<listeners.length;i++){
        const audience=listeners[i],at={x:x+(i?-.34:.37),y:y+.24};
        audience.path=[{...at,speed:audience.max,then:q=>{
          q.dance=true;q.intent='concert';q.attention={x,y};
          q.stopUntil=clock+14;
        }}];
        audience.sit=false;audience.stopUntil=0;
      }
      tick('A little live concert is gathering in the village square.');
      return {x,y,dur:24,streetConcert:true,notes:[musician],
        update(e){e.x=musician.x;e.y=musician.y;},
        end(){
          musician.guitar=false;remove(musician);
          for(const listener of listeners){
            listener.dance=false;listener.intent='walking';
            listener.attention=null;listener.stopUntil=clock+.5;
          }
        }};
    },
    hat() {
      const m = movers.find(o => o.type === 'person' && !o.kind && !o.path) || spawnPerson();
      const hat = {x: m.x, y: m.y, z: 16};
      m.path = [{x: m.x + 3, y: m.y, speed: .9}, {x: m.x + 4, y: m.y + 1, speed: .9}]; say(m, 'MY HAT!', 2.5);
      tick(`A gust of wind steals a hat on ${streetOf(m.x, m.y)}.`);
      return {x: m.x, y: m.y, dur: 9, hat, update(e, dt) { hat.x += dt * .55; hat.y += Math.sin(clock * 2) * dt * .2; hat.z = 14 + Math.abs(Math.sin(clock * 3)) * 18; e.x = hat.x; e.y = hat.y; }};
    },
    pothole() {
      const car = movers.find(o => o.type === 'car' && !o.path && o.kind === 'car') || spawnCar();
      tick(`Pothole on ${streetOf(car.x, car.y)} claims another hubcap. BOING!`);
      say(car, 'BOING!', 1.5);
      return {x: car.x, y: car.y, dur: 3, follow: car, update(e) { car.lift = Math.max(0, Math.sin(e.t * 6) * 10 * (1 - e.t / 3)); }, end() { car.lift = 0; }};
    }
  });

  /* ---------------- gentle moments ---------------- */
  const parkSpot = () => { const t = []; for (let y = 2; y < 16; y++) for (let x = 2; x < 16; x++) if (tile(x, y).kind === 'park' || tile(x, y).kind === 'plaza') t.push([x + .5, y + .5]); return t[Math.random() * t.length | 0] || [9, 9]; };
  const walker = () => movers.find(o => o.type === 'person' && !o.kind && !o.path && !o.busy) || spawnPerson();
  function sendTo(m, x, y, then) { m.busy = true; m.path = walkFrom(m, x, y, .45).concat([{x, y, speed: .4, then}]); }
  Object.assign(EVENTS, {
    kite() {
      const [x, y] = parkSpot(), kid = walker(); sendTo(kid, x, y, q => { q.stopUntil = clock + 30; });
      tick('Kite weather in the park. Someone is very proud of theirs.');
      return {x, y, dur: 34, kite: {kid, ph: Math.random() * 6}, end() { kid.busy = false; }};
    },
    picnic() {
      const [x, y] = parkSpot(), mat = {kind: 'picnic', x, y}; props.push(mat);
      const pals = [walker(), walker()]; pals.forEach((m, i) => sendTo(m, x + (i ? .3 : -.3), y + .1, q => { q.stopUntil = clock + 30; q.sit = true; }));
      tick('A picnic in the park: sandwiches, lemonade and a very interested pigeon.');
      return {x, y, dur: 36, end() { props.splice(props.indexOf(mat), 1); for (const m of pals) { m.sit = false; m.busy = false; } }};
    },
    gardener() {
      const b = buildingOn(b => b.kind === 'house') || buildings[0], m = walker(), x = b.x + .5, y = b.y + 1.05;
      sendTo(m, x, y, q => { q.stopUntil = clock + 16; q.can = true; });
      tick(`Someone on ${streetOf(x, y + .5)} is watering the window boxes.`);
      return {x, y, dur: 26, update(e, dt) { if (m.can && Math.random() < dt * 12) burst(x + .15, y, 6, 1, '#9fd8ff', {up: 4, spread: .2, g: 60, life: .5, r: 1.1}); }, end() { m.can = false; m.busy = false; props.push({kind: 'flowers', x, y: y - .17, c: [PASTEL[Math.random() * 8 | 0], '#ffd23f']}); }};
    },
    painter() {
      const [x, y] = parkSpot(), m = walker(), easel = {kind: 'easel', x: x + .25, y, t: 0}; props.push(easel);
      sendTo(m, x, y, q => { q.stopUntil = clock + 30; q.brush = true; });
      tick('A painter has set up an easel. Today\'s subject: the duck pond.');
      return {x, y, dur: 34, update(e, dt) { if (m.brush) easel.t += dt; }, end() { props.splice(props.indexOf(easel), 1); m.brush = false; m.busy = false; }};
    },
    reading() {
      const benches = props.filter(p => p.kind === 'bench'); const bench = benches[Math.random() * benches.length | 0];
      const [x, y] = bench ? [bench.x, bench.y] : parkSpot(), m = walker();
      sendTo(m, x, y, q => { q.stopUntil = clock + 26; q.sit = true; q.book = true; });
      tick('A quiet read by the river.');
      return {x, y, dur: 30, end() { m.sit = false; m.book = false; m.busy = false; }};
    },
    butterflies() {
      const [x, y] = parkSpot();
      tick('Butterflies over the flower beds.');
      return {x, y, dur: 24, flies: Array.from({length: 5}, (_, i) => ({ph: i * 1.3, c: ['#ffd23f', '#ff8fd0', '#9cc7ef', '#ffffff', '#f7c873'][i]}))};
    },
    catnap() {
      const b = buildingOn(b => b.kind === 'house' || b.kind === 'shop');
      if (!b) return null;
      tick('A cat is napping in the sun on a warm roof. Do not disturb.');
      return {x: b.x + .5, y: b.y + .5, dur: 26, nap: {b, z: b.h + 6}};
    },
    balloon() {
      const kid = walker(); say(kid, 'Bye bye, balloon!', 2.5); tick('One red balloon drifts away over the rooftops.');
      const q = [{x: kid.x, y: kid.y, z: 18, col: '#ff5d5d', ph: 0}];
      return {x: kid.x, y: kid.y, dur: 16, balloons: q, update(e, dt) { for (const b of e.balloons) { b.z += dt * 9; b.x += dt * (.1 + Math.sin(clock + b.ph) * .06); } }};
    },
    sweeper() {
      const m = spawnPerson(Math.random, {kind: 'sweeper', col: '#e98a3a', max: .2});
      tick('The street sweeper is doing the morning round.');
      return {x: m.x, y: m.y, dur: 30, follow: m, end() { remove(m); }};
    }
  });
  const TALK = {
    sports: ['Did you see {N} play?', 'What a match!', 'I knew {N} would do it!', 'Best game all year.', 'Tickets for the next one?'],
    space: ['{N} is on the news again!', 'Imagine going up there.', 'I\'ll watch the launch tonight.', 'My kid wants to be an astronaut now.'],
    election: ['Have you voted yet?', 'Long queue at the school!', 'Results tonight.', 'Did you see {N} on TV?'],
    festival: ['Happy {N}!', 'The lights look lovely.', 'Come round for sweets later!', 'Same to you!'],
    awards: ['Did you see {N}?', 'What a speech!', 'I loved it.', 'Well deserved.'],
    tech: ['Have you tried the new {N}?', 'My phone is smarter than me.', 'Robots! Whatever next.'],
    animals: ['Did you hear about the {N}?', 'Taking the kids to see it.', 'So cute!'],
    market: ['Prices again!', 'Did you see {N} today?', 'Buy low, sell high, they say.'],
    science: ['They found {N}!', 'Science is amazing.', 'I read it in the Times.'],
    weather: ['Chilly today.', 'Did you bring an umbrella?', 'Lovely day for a walk.']
  };
  // Two neighbours stop on the pavement and talk about the day's story.
  EVENTS.chat = () => {
    const v = today_[Math.random() * today_.length | 0], lines = TALK[v ? v.key : 'weather'] || TALK.weather, name = v && v.name ? v.name : {sports: 'the team', space: 'the rocket', election: 'the candidate', festival: 'everyone', awards: 'the winner', tech: 'gadget', animals: 'animals', market: 'the market', science: 'something new'}[v && v.key] || 'it';
    const a = walker(); if (!a) return null; const b = spawnPerson(Math.random, {lane: a.lane}); b.x = a.x + (a.d < 2 ? .35 : 0); b.y = a.y + (a.d < 2 ? 0 : .35); b.d = a.d ^ 1;
    a.stopUntil = b.stopUntil = clock + 14; a.busy = b.busy = true;
    const said = lines.map(l => l.replace('{N}', name)).sort(() => Math.random() - .5).slice(0, 3);
    return {x: a.x, y: a.y, dur: 15, quiet: true, update(e) { const k = Math.floor(e.t / 4); if (k < said.length && k !== e.k) { e.k = k; say(k % 2 ? b : a, said[k], 3.4); } }, end() { a.busy = false; remove(b); }};
  };
  // A small plane tows the headline across the sky.
  EVENTS.skybanner = () => {
    const v = today_.find(x => x.story); if (!v) return EVENTS.hotair();
    const text = `${v.emoji} ${headline(v.story).slice(0, 46)}${headline(v.story).length > 46 ? '…' : ''}`;
    return {x: 9, y: 9, dur: 34, quiet: true, sky: sky('plane', -6, 3, 230, 1.0, .15), towed: text, update(e, dt) { e.sky.x += e.sky.vx * dt; e.sky.y += e.sky.vy * dt; }};
  };
  EVENTS.newsie = () => {
    if (!today_.some(v => v.story)) return EVENTS.balloon();
    const kid = spawnPerson(Math.random, {kind: 'newsie', col: '#3f78c9', max: .45}), stories = today_.filter(v => v.story);
    tick('The newspaper seller is out with today\'s Toy Town Times.');
    return {x: kid.x, y: kid.y, dur: 30, follow: kid, quiet: true, update(e, dt) { if ((e.next = (e.next || 1) - dt) <= 0) { e.next = 7; const v = stories[(e.k = (e.k || 0) + 1) % stories.length]; say(kid, `Extra! ${headline(v.story).slice(0, 44)}${headline(v.story).length > 44 ? '…' : ''}`, 5); } }, end() { remove(kid); }};
  };
  // What the town does on its own when the news is quiet: gentle things, mostly.
  const CALM = ['newsie', 'chat', 'chat', 'skybanner', 'kite', 'picnic', 'gardener', 'painter', 'reading', 'butterflies', 'catnap', 'balloon', 'sweeper', 'icecream', 'busker', 'hotair', 'pigeons', 'band', 'duck'];

  /* ---------------- the news, toy-sized ---------------- */
  const sky = (kind, x, y, z, vx = 0, vy = 0) => ({kind, x, y, z, vx, vy});
  const VARIANT_EVENTS = {
    cricket() {
      const st = props.find(p => p.kind === 'stadium');
      const from = st || {x: 9, y: 9}, b = randomRoadPoint(Math.random);
      tick('SIX! The ball has left the stadium. A dog is on the case.');
      say({x: from.x, y: from.y, z: 40}, 'SIIIX!', 2);
      const ball = {x: from.x, y: from.y, z: 10, t: 0};
      return {x: from.x, y: from.y, dur: 12, ball, update(e, dt) { ball.t = Math.min(1, ball.t + dt / 3); ball.x = lerp(from.x, b.x, ball.t); ball.y = lerp(from.y, b.y, ball.t); ball.z = 10 + Math.sin(ball.t * Math.PI) * 120; e.x = ball.x; e.y = ball.y; if (ball.t >= 1 && !e.dog) { e.dog = spawnPerson(Math.random, {kind: 'dog', max: 1}); e.dog.path = walk(e.dog.x, e.dog.y, b.x, b.y, 1); say(e.dog, 'woof!', 1.5); } }, end() { if (this.dog) remove(this.dog); }};
    },
    football() { return THEME_EVENTS.sports() || EVENTS.band(); },
    match() { return THEME_EVENTS.sports() || EVENTS.band(); },
    tennis() {
      const st = props.find(p => p.kind === 'stadium') || {x: 9, y: 9};
      tick('Match point at the Toy Town Open. The crowd holds its breath.');
      return {x: st.x, y: st.y, dur: 14, rally: st, update(e, dt) { st.ball = st.ball || {x: -1, y: 0, vx: 1.2, vy: .3}; st.ball.x += st.ball.vx * dt; st.ball.y += st.ball.vy * dt; if (Math.abs(st.ball.x) > 1.2) { st.ball.vx *= -1; e.hits = (e.hits || 0) + 1; if (e.hits % 3 === 0) say({x: st.x, y: st.y, z: 34}, ['15-love!', 'OUT!', 'It was IN!', 'Deuce!', 'Game, set, match!'][e.hits / 3 % 5 | 0], 1.6); } if (Math.abs(st.ball.y) > .6) st.ball.vy *= -1; }};
    },
    race() {
      const lap = [[6.5, 6.5], [11.5, 6.5], [11.5, 11.5], [6.5, 11.5]], cols = ['#e2463a', '#3f78c9', '#2f9e7a', '#f6c541'];
      const racers = cols.map((col, i) => { const c = spawnCar(Math.random, 'racer'); c.col = col; c.num = i + 1; c.x = 6.5 - i * .5; c.y = 6.5; const pts = []; for (let k = 0; k < 3; k++) for (const [x, y] of lap.slice(1).concat([lap[0]])) pts.push({x, y, speed: 2.4 + i * .15 + Math.random() * .2}); c.path = pts; return c; });
      tick('Toy Town Grand Prix! Three laps round the middle block. VROOM!');
      return {x: 9, y: 6.5, dur: 22, blocks: true, follow: racers[3], update(e) { if (e.t > 3 && !e.s) { e.s = 1; say(racers[3], 'VROOOOM!', 1.5); } }, end() { say({x: 6.5, y: 6.5, z: 20}, `#${racers.reduce((a, c) => c.path && c.path.length < (a.path ? a.path.length : 99) ? c : a).num} wins!`, 2.5); for (const r of racers) remove(r); }};
    },
    marathon() {
      const p = procession('runner', 9, .9);
      for (const m of peopleNear(p.x, p.y, 6).slice(0, 3)) say(m, ['Go go go!', 'You can do it!', 'Nearly there!'][Math.random() * 3 | 0], 2);
      tick('The Toy Town Marathon is running through the middle of town!');
      return {x: p.x, y: p.y, dur: 24, blocks: true, follow: p.walkers[0], end() { for (const w of p.walkers) remove(w); }};
    },
    medals() {
      const pod = props.find(p => p.kind === 'podium') || {x: 9, y: 9};
      tick('Medal ceremony on the podium! The anthem is being hummed, slightly off-key.');
      return {x: pod.x, y: pod.y, dur: 12, update(e, dt) { if (e.t > 1 && !e.s) { e.s = 1; pod.winners = true; say({x: pod.x, y: pod.y, z: 30}, 'GOLD!', 2.5); burst(pod.x, pod.y, 40, 30, ['#ffd23f', '#ffffff', '#c0c8d4', '#c98b4e'], {up: 60, spread: 1.8}); } }, end() { pod.winners = false; }};
    },
    moon() { const e = THEME_EVENTS.space() || {x: 9, y: 9, dur: 10}; tick('Rocket to the Moon! (It has packed sandwiches.)'); return e; },
    mars() {
      const rover = props.find(p => p.kind === 'rover');
      tick('The Toy Town Mars rover is testing its wheels in the park. Slowly.');
      if (rover) { say({x: rover.x, y: rover.y, z: 16}, 'beep… boop… sample collected', 3); return {x: rover.x, y: rover.y, dur: 10, follow: rover}; }
      return THEME_EVENTS.space();
    },
    comet() {
      tick('A comet streaks across the sky! Everybody makes a wish.');
      for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 5)) { m.stopUntil = clock + 5; say(m, ['LOOK!', 'Make a wish!', 'Wooow'][Math.random() * 3 | 0], 2.2); }
      return {x: 9, y: 9, dur: 9, sky: sky('comet', -6, 2, 220, 3.4, .8), update(e, dt) { e.sky.x += e.sky.vx * dt; e.sky.y += e.sky.vy * dt; burst(e.sky.x, e.sky.y, e.sky.z, 2, ['#ffffff', '#bfe9ff', '#ffe59a'], {up: 0, spread: .2, g: 0, life: 1.2, r: 2}); }};
    },
    launch() { return THEME_EVENTS.space(); },
    vote() {
      const r = Math.random();
      if (r < .5) return THEME_EVENTS.election();
      const b = buildingOn(b => b.kind === 'shop' || b.kind === 'fire') || buildings[0];
      tick('Polling day: a queue around the block, and everyone wants an "I voted" sticker.');
      const q = movers.filter(m => m.type === 'person' && !m.kind).slice(0, 6);
      q.forEach((m, i) => { m.path = [{x: b.x + .5 + i * .25, y: b.y + 1.45, speed: .8, then: o => { o.stopUntil = clock + 6 + i; } }]; });
      return {x: b.x + .5, y: b.y + 1.4, dur: 14, update(e) { if (e.t > 9 && !e.s) { e.s = 1; for (const m of q.slice(0, 3)) say(m, 'I voted!', 2); } }};
    },
    diwali() {
      const pz = props.find(p => p.kind === 'rangoli') || {x: 9, y: 9};
      tick('Happy Diwali, Toy Town! Lamps glow along every street and lanterns rise.');
      const lanterns = Array.from({length: 14}, (_, i) => ({x: pz.x + (Math.random() - .5) * 3, y: pz.y + (Math.random() - .5) * 3, z: 10, v: 10 + Math.random() * 10, ph: i}));
      return {x: pz.x, y: pz.y, dur: 18, lanterns, update(e, dt) { for (const l of e.lanterns) { l.z += l.v * dt; l.x += Math.sin(clock + l.ph) * dt * .1; } if (Math.random() < dt * 1.2) burst(pz.x + (Math.random() - .5) * 8, pz.y + (Math.random() - .5) * 8, 150, 26, [['#ffd23f', '#ff8a3d'], ['#ff5d9e', '#ffd23f'], ['#5dd3ff', '#ffffff']][Math.random() * 3 | 0], {up: 0, spread: 2, g: 20, life: 1.6, r: 1.8}); }};
    },
    christmas() {
      tick('Ho ho ho! A sleigh was spotted over Toy Town. It is snowing.');
      return {x: 9, y: 9, dur: 22, snow: true, sky: sky('sleigh', -4, 4, 170, 1.3, .2), update(e, dt) { e.sky.x += e.sky.vx * dt; e.sky.y += e.sky.vy * dt; if (e.t > 4 && !e.s) { e.s = 1; say({x: e.sky.x, y: e.sky.y, z: e.sky.z + 20}, 'Ho ho ho!', 2.5); } }};
    },
    halloween() {
      const p = procession('ghost', 6, .5);
      tick('Trick or treat! Little ghosts are knocking on every door.');
      const bats = Array.from({length: 10}, () => ({x: 9 + (Math.random() - .5) * 8, y: 9 + (Math.random() - .5) * 8, z: 70 + Math.random() * 40, ph: Math.random() * 6}));
      return {x: p.x, y: p.y, dur: 22, follow: p.walkers[0], bats, update(e, dt) { for (const b of e.bats) { b.x += Math.cos(clock * 2 + b.ph) * dt; b.y += Math.sin(clock * 1.7 + b.ph) * dt; } if (e.t > 3 && !e.s) { e.s = 1; say(p.walkers[0], 'Trick or treat!', 2.5); } }, end() { for (const w of p.walkers) remove(w); }};
    },
    newyear() {
      tick('Countdown in the square! 10… 9… everyone is a bit early.');
      return {x: 9, y: 9, dur: 16, update(e, dt) { const c = Math.ceil(5 - e.t); if (e.t < 5 && c !== e.c) { e.c = c; say({x: 9, y: 9, z: 60}, c + '!', .9); } if (e.t >= 5) { if (!e.s) { e.s = 1; say({x: 9, y: 9, z: 60}, 'HAPPY NEW YEAR!', 3); } if (Math.random() < dt * 2.5) burst(9 + (Math.random() - .5) * 10, 9 + (Math.random() - .5) * 10, 150 + Math.random() * 50, 30, PASTEL, {up: 0, spread: 2.2, g: 20, life: 1.6, r: 1.8}); if (Math.random() < dt * 8) burst(9 + (Math.random() - .5) * 6, 9 + (Math.random() - .5) * 6, 60, 4, PASTEL, {up: 10, spread: 1, g: 25, life: 2.5, r: 1.6}); } }};
    },
    holi() {
      tick('Happy Holi! Clouds of colour everywhere, and nobody stays clean.');
      const cols = ['#ff5d9e', '#ffd23f', '#5dd36b', '#5d9eff', '#b05dff', '#ff8a3d'];
      return {x: 9, y: 9, dur: 18, update(e, dt) { if (Math.random() < dt * 3) { const m = movers.filter(o => o.type === 'person')[Math.random() * movers.length | 0]; if (m) { const c = cols[Math.random() * cols.length | 0]; burst(m.x, m.y, 12, 14, c, {up: 25, spread: 1.4, g: 10, life: 1.8, r: 4.5}); m.col = c; if (Math.random() < .3) say(m, ['Happy Holi!', 'Gotcha!', 'My shirt!'][Math.random() * 3 | 0], 1.5); } } }};
    },
    eid() {
      tick('Eid Mubarak! Lanterns glow and the sweet shop gives everyone a treat.');
      const shop = buildingOn(b => b.kind === 'shop') || {x: 9, y: 9};
      for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 5)) m.path = [{x: shop.x + .5 + (Math.random() - .5), y: shop.y + 1.4 + Math.random() * .4, speed: .8, then: q => { q.stopUntil = clock + 5; say(q, ['Eid Mubarak!', 'Sweets!', 'Thank you!'][Math.random() * 3 | 0], 2); }}];
      return {x: shop.x + .5, y: shop.y + 1.2, dur: 16, glow: true};
    },
    fest() { return THEME_EVENTS.festival(); },
    music() {
      const stage = props.find(p => p.kind === 'stage') || {x: 9, y: 9};
      tick('Concert night! The band on the stage only knows three chords and that is plenty.');
      for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 8)) m.path = [{x: stage.x + (Math.random() - .5) * 3, y: stage.y + 1.2 + Math.random(), speed: .9, then: q => { q.stopUntil = clock + 12; q.dance = true; }}];
      return {x: stage.x, y: stage.y, dur: 18, notes: [{x: stage.x, y: stage.y, type: 'spot'}], end() { for (const m of movers) m.dance = false; }};
    },
    nobel() {
      const pod = props.find(p => p.kind === 'podium') || {x: 9, y: 9};
      tick('A Toy Town professor wins a big prize. She thanks her cat.');
      return {x: pod.x, y: pod.y, dur: 10, update(e) { if (e.t > 1 && !e.s) { e.s = 1; pod.winners = true; say({x: pod.x, y: pod.y, z: 30}, 'Congratulations, Professor!', 2.5); burst(pod.x, pod.y, 40, 20, ['#ffd23f', '#ffffff'], {up: 50}); } }, end() { pod.winners = false; }};
    },
    film() { return THEME_EVENTS.awards(); },
    phone() {
      tick('New phones are out. Everyone is looking down. Everyone is bumping into everyone.');
      const zs = movers.filter(m => m.type === 'person' && !m.kind).slice(0, 10); for (const m of zs) m.phone = true;
      return {x: 9, y: 9, dur: 16, update(e, dt) { for (const a of zs) for (const b of zs) if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < .25 && !(a.bumped > clock)) { a.bumped = b.bumped = clock + 3; a.stopUntil = clock + 1; say(a, ['Oops!', 'Sorry!', 'Hey!'][Math.random() * 3 | 0], 1.2); } }, end() { for (const m of zs) m.phone = false; }};
    },
    robots() { for (let k = 0; k < 4; k++) spawnPerson(Math.random, {kind: 'robot', col: '#c0c8d4', max: .45}); const e = THEME_EVENTS.tech(); tick('The robots are out! They say BEEP BOOP and hold the door for everyone.'); return e; },
    drones() { return THEME_EVENTS.tech(); },
    panda() {
      const park = props.find(p => p.kind === 'fountain' || p.kind === 'zoo') || {x: 9, y: 9};
      const panda = {kind: 'panda', x: park.x + .8, y: park.y + .6}; props.push(panda);
      for (const m of movers.filter(m => m.type === 'person' && !m.kind).slice(0, 6)) m.path = [{x: panda.x + (Math.random() - .5) * 2, y: panda.y + 1 + Math.random() * .5, speed: .8, then: q => { q.stopUntil = clock + 8; say(q, ['Awww!', 'So fluffy!', 'Look at it eat!'][Math.random() * 3 | 0], 2); }}];
      tick('A panda is visiting the park. It is eating bamboo and ignoring everyone.');
      return {x: panda.x, y: panda.y, dur: 16, end() { props.splice(props.indexOf(panda), 1); }};
    },
    whale() {
      tick('There is a WHALE in the river. Toy Town has questions.');
      return {x: -1, y: 13.9, dur: 22, whale: true, update(e, dt) { e.x += dt * .9; if (Math.random() < dt * .8) burst(e.x + .2, 13.9, 14, 18, ['#bfe9ff', '#ffffff'], {up: 70, spread: .4, life: 1.2, r: 1.6}); if (e.t > 4 && !e.s) { e.s = 1; say({x: e.x, y: 13.9, z: 30}, 'PFFFSHHH', 2); } }};
    },
    dino() {
      const d = spawnPerson(Math.random, {kind: 'dino', max: .5, lane: 0}); const b = randomRoadPoint(Math.random); d.path = route(d.x, d.y, b.x, b.y, .5);
      say(d, 'RAWR! (it wants a selfie)', 2.5); tick(`A friendly dinosaur is strolling down ${streetOf(d.x, d.y)}. Traffic has stopped to stare.`);
      return {x: d.x, y: d.y, dur: 24, blocks: true, follow: d, end() { remove(d); }};
    },
    penguin() {
      const p = procession('penguin', 8, .35);
      tick('Penguin parade! Traffic waits while they waddle across town.');
      return {x: p.x, y: p.y, dur: 30, blocks: true, follow: p.walkers[0], end() { for (const w of p.walkers) remove(w); }};
    },
    zoo() { return THEME_EVENTS.animals() || EVENTS.chickens(); },
    coins() {
      const t = buildings.filter(b => b.kind === 'tower').sort((a, b) => b.h - a.h)[0] || buildings[0];
      tick('Coins are raining from the bank tower! Toy Town economists are thrilled.');
      for (const m of peopleNear(t.x, t.y, 4).slice(0, 3)) say(m, 'Mine!', 1.5);
      return {x: t.x + .5, y: t.y + .5, dur: 12, update(e, dt) { if (Math.random() < dt * 10) burst(t.x + .5 + (Math.random() - .5) * 2.5, t.y + .5 + (Math.random() - .5) * 2.5, t.h + 20, 1, '#ffd23f', {up: 10, spread: .3, g: 120, life: 1.8, r: 2.2}); }};
    },
    stocks() { return THEME_EVENTS.market(); },
    lab() { return THEME_EVENTS.science(); },
    rain() { return THEME_EVENTS.weather(); },
    snow() { tick('Snow day! Everyone is building snowmen instead of working.'); return {x: 9, y: 9, dur: 22, snow: true}; },
    wind() { const e = EVENTS.hat(); tick('Windy day in Toy Town! Hats, leaves and one umbrella are flying.'); e.leaves = true; return e; }
  };
  // Decorations for the day's news (lamps for Diwali, pumpkins for Halloween, a podium for medals…).
  let decorN = 0;
  const TV_DAYS = ['sports', 'space', 'election', 'awards', 'festival'];
  function decorate(list) {
    ground = null; // Decorations can change the tree shadows on the ground layer.
    const has = v => list.some(x => x.variant === v), plaza = () => { const t = []; for (let y = 2; y < 16; y++) for (let x = 2; x < 16; x++) if (tile(x, y).kind === 'plaza' && !tile(x, y).used && !tile(x, y).decor) t.push([x, y]); const pick = t[(t.length * (.5 + (decorN++ % 3) * .21)) % (t.length || 1) | 0] || [9, 9]; if (tile(...pick)) tile(...pick).decor = true; return pick; };   // each decoration its own tile
    if (has('diwali')) { for (const l of LINES) for (let t = 1.6; t < 16.5; t += 1.25) { props.push({kind: 'diya', x: l + .95, y: t, ph: t}); props.push({kind: 'diya', x: t, y: l + .95, ph: t + 1}); } const [x, y] = plaza(); props.push({kind: 'rangoli', x: x + .5, y: y + .5}); }
    if (has('christmas')) { const [x, y] = plaza(); props.push({kind: 'xtree', x: x + .5, y: y + .5}); }
    if (has('halloween')) for (const b of buildings) if (b.kind === 'house' && Math.random() < .7) props.push({kind: 'pumpkin', x: b.x + .5, y: b.y + .95});
    if (has('eid') || has('fest')) for (const l of LINES) for (const m of LINES) props.push({kind: 'lantern', x: l + .9, y: m + .9, ph: l * 3 + m});
    if (has('medals') || has('nobel')) { const [x, y] = plaza(); props.push({kind: 'podium', x: x + .5, y: y + .5}); }
    if (has('mars')) { const pk = props.find(p => p.kind === 'fountain' || p.kind === 'launchpad') || {x: 9, y: 9}; props.push({kind: 'rover', x: pk.x + 1, y: pk.y + 1, tx: pk.x, ty: pk.y, t: 0}); }
    if (has('moon') || has('eid')) props.push({kind: 'skymoon', crescent: has('eid')});
    if (has('mars')) props.push({kind: 'skymars'});
    if (has('phone')) { const t = buildings.filter(b => b.kind === 'tower').sort((a, b) => b.h - a.h)[0]; if (t) props.push({kind: 'billboard', x: t.x + .5, y: t.y + .5, z: t.h}); }
    if (has('marathon')) props.push({kind: 'finish', x: 16, y: LINES[1] + .5});
    // The Toy Town Times stands on the grass at the town's right-hand corner: only sky behind it, so it hides no houses.
    { const bx = 17.25, by = .75; for (let k = props.length - 1; k >= 0; k--) if (props[k].kind === 'tree' && Math.hypot(props[k].x - bx, props[k].y - by) < 2) props.splice(k, 1); props.push({kind: 'times', x: bx, y: by, z: 0}); }
    // Newspaper kiosks on two corners, bunting over the streets on big days.
    { const spots = []; for (let y = 2; y < 16; y++) for (let x = 2; x < 16; x++) { const t = tile(x, y); if (!t.used && !t.decor && (t.kind === 'plaza' || t.kind === 'park') && DIRS.some(([dx, dy]) => (tile(x + dx, y + dy) || {}).kind === 'road')) spots.push([x, y]); }
      for (const [x, y] of [spots[0], spots[(spots.length / 2) | 0]].filter(Boolean)) { tile(x, y).decor = true; const [dx, dy] = DIRS.find(([dx, dy]) => (tile(x + dx, y + dy) || {}).kind === 'road'); props.push({kind: 'kiosk', x: x + .5 + dx * .28, y: y + .5 + dy * .28}); } }   // on a free corner by the pavement
    const flags = {sports: ['#d9533e', '#ffffff', '#3f78c9'], festival: ['#ffb020', '#e2463a', '#ff8fd0', '#ffd23f'], election: ['#d9533e', '#ffffff', '#3f78c9'], awards: ['#ffd23f', '#2d3440']}[list[0] && list[0].key];
    if (flags) for (const l of LINES.slice(1, 3)) for (let t = 2.5; t < 16; t += 2.5) { props.push({kind: 'bunting', x: l + .5, y: t, along: 'x', cols: flags}); props.push({kind: 'bunting', x: t, y: l + .5, along: 'y', cols: flags}); }
    if (has('cricket') || has('tennis')) { const st = props.find(p => p.kind === 'stadium'); if (st) st.sport = has('cricket') ? 'cricket' : 'tennis'; }
  }

  // Occasional unhurried encounters in front of the shops.
  function streetMoment() {
    const shops = buildings.filter(b => b.kind === 'shop');
    const people = movers.filter(m => m.type === 'person' && !m.kind && !m.busy &&
      !m.heroResident && !m.path && (!m.stopUntil || clock >= m.stopUntil));
    const near = [];
    for (const m of people) for (const shop of shops) {
      const distance = Math.hypot(m.x - shop.x - .5, m.y - shop.y - .5);
      if (distance < 2.3) near.push({m, shop, distance});
    }
    if (!near.length) return false;
    near.sort((a, b) => a.distance - b.distance);
    const {m, shop} = near[Math.floor(Math.random() * Math.min(5, near.length))];
    m.stopUntil = clock + 2.2; m.v = 0; m.waveUntil = clock + 1.6;
    say(m, {BAKERY: 'Smells lovely!', BOOKS: 'New books!', CAFE: 'Morning coffee?',
      PIZZA: 'Pizza tonight?', TOYS: 'Look at that!', SWEETS: 'A little treat?',
      PETS: 'Hello, pups!'}[shop.name] || 'Lovely day!', 2.1);
    const friend = people.find(o => o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 1.15);
    if (friend) { friend.stopUntil = clock + 1.5; friend.v = 0; friend.waveUntil = clock + 1.5; say(friend, 'Hello!', 1.5); }
    streetMoments++;
    return true;
  }

  /* ---------------- drawing ---------------- */
  // Iso projection: grid (x, y) and height z (px at scale 1) to screen pixels.
  const P = (x, y, z = 0) => [W / 2 + ((x - cam.x) - (y - cam.y)) * TW * S, H / 2 + ((x - cam.x) + (y - cam.y)) * TH * S - z * S];
  function diamond(c, x, y, w = 1, d = 1) { const a = P(x, y), b = P(x + w, y), e = P(x + w, y + d), f = P(x, y + d); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...e); c.lineTo(...f); c.closePath(); }
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => clamp(0, Math.round(v * k), 255); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  // A box centred on (cx, cy) with half sizes hx, hy, from z0 up h.
  // Soft, clay-like boxes: each face is a gradient, every face is also stroked in its own
  // colour with round joins (rounding the corners), and the top edges catch a soft highlight.
  function box(c, cx, cy, hx, hy, z0, h, col, top) {
    const A = (x, y, z) => P(cx + x, cy + y, z0 + z), r = Math.max(1, Math.min(3 * S, (hx + hy) * 10 * S, h * S * .35));
    const face = (pts, g) => { c.beginPath(); c.moveTo(...pts[0]); for (const q of pts.slice(1)) c.lineTo(...q); c.closePath(); c.fillStyle = g; c.fill(); c.strokeStyle = g; c.stroke(); };
    c.save(); c.lineJoin = 'round'; c.lineWidth = r;
    const L = [A(-hx, hy, 0), A(hx, hy, 0), A(hx, hy, h), A(-hx, hy, h)], R = [A(hx, -hy, 0), A(hx, hy, 0), A(hx, hy, h), A(hx, -hy, h)], T = [A(-hx, -hy, h), A(hx, -hy, h), A(hx, hy, h), A(-hx, hy, h)];
    let g = c.createLinearGradient(0, L[3][1], 0, L[0][1]); g.addColorStop(0, shade(col, .97)); g.addColorStop(1, shade(col, .8)); face(L, g);
    g = c.createLinearGradient(0, R[3][1], 0, R[1][1]); g.addColorStop(0, shade(col, .8)); g.addColorStop(1, shade(col, .64)); face(R, g);
    if (top) face(T, top); else { g = c.createLinearGradient(T[0][0], T[0][1], T[2][0], T[2][1]); g.addColorStop(0, shade(col, 1.18)); g.addColorStop(1, shade(col, 1.03)); face(T, g); }
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = r * .55; c.beginPath(); c.moveTo(...T[3]); c.lineTo(...T[2]); c.lineTo(...T[1]); c.stroke();
    c.restore();
  }
  // A soft pool of shade on the ground, a little towards the bottom right (the light is up-left).
  function softShadow(c, x, y, rx, a = .22) {
    const [sx, sy] = P(x + .12, y + .12), g = c.createRadialGradient(sx, sy, 0, sx, sy, rx * TW * S);
    g.addColorStop(0, `rgba(40,60,40,${a})`); g.addColorStop(1, 'rgba(40,60,40,0)'); c.save(); c.translate(sx, sy); c.scale(1, .5); c.translate(-sx, -sy); c.fillStyle = g; c.beginPath(); c.arc(sx, sy, rx * TW * S, 0, TAU); c.fill(); c.restore();
  }
  const GROUND = {lot: '#a7c892', edge: '#9ac490', park: '#8fc3a0', plaza: '#e2d6be', dirt: '#d1b697', road: '#69747a', bridge: '#927960', water: '#74b9cf'};
  function drawGround(c) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = tile(x, y); diamond(c, x, y); c.fillStyle = c.strokeStyle = GROUND[t.kind]; c.lineWidth = 1; c.fill(); c.stroke();
      if (t.kind === 'park' || t.kind === 'edge' || t.kind === 'lot') {
        // Deterministic tiny clumps remain physically attached to the ground (and stay cached).
        const h = hash(x * 31 + y, 0x52b), u = .18 + ((h & 255) / 255) * .55, v = .17 + (((h >>> 8) & 255) / 255) * .58;
        const [gx, gy] = P(x + u, y + v);
        c.strokeStyle = 'rgba(54,120,54,.2)'; c.lineWidth = Math.max(.6, .8 * S);
        c.beginPath(); c.moveTo(gx - 2 * S, gy); c.lineTo(gx - 1 * S, gy - 2.5 * S);
        c.moveTo(gx, gy); c.lineTo(gx + .5 * S, gy - 2.1 * S);
        c.moveTo(gx + 1.5 * S, gy); c.lineTo(gx + 2.4 * S, gy - 1.6 * S); c.stroke();
      }
      // A small-scale tactile surface: inset paving, short curb seams and a
      // clear pedestrian crossing. These sit in the static layer under actors.
      const hb = town.blocks.find(b => b.hero);
      if (hb && x >= hb.xa && x <= hb.xb && y >= hb.ya && y <= hb.yb && t.kind !== 'water') {
        const central = x >= hb.xa+1 && x <= hb.xa+2 && y >= hb.ya+1 && y <= hb.ya+2;
        if (central) {
          diamond(c,x+.07,y+.07,.86,.86); c.fillStyle='#efe3ca'; c.fill();
          c.strokeStyle='rgba(255,255,255,.4)'; c.lineWidth=Math.max(.6,S*.65);
          c.stroke();
          for(let k=1;k<=2;k++) { c.beginPath();
            c.moveTo(...P(x+.07+k*.86/3,y+.07));
            c.lineTo(...P(x+.07+k*.86/3,y+.93)); c.stroke(); }
        } else if (t.kind==='park' || t.kind==='lot') {
          const edgePath = x===hb.xa+1 || x===hb.xa+2 || y===hb.ya+1 || y===hb.ya+2;
          if(edgePath){diamond(c,x+.18,y+.18,.64,.64);c.fillStyle='rgba(229,216,183,.32)';c.fill();}
        }
      }
      if (hb && y===hb.yb+1 && x===hb.xa+1) {
        // Crossing stripes are painted on the street, not hovering above it.
        for(let k=0;k<4;k++){diamond(c,x+.28+k*.12,y+.12,.07,.75);
          c.fillStyle='rgba(255,250,231,.72)';c.fill();}
      }
      if (t.kind === 'lot' || t.kind === 'park') {
        // Tiny moss, ground daisies and path stones become visible as the
        // camera approaches: seeded per tile to avoid flicker.
        const h1 = hash(x * 41 + y * 17, 0x791);
        for (let i=0;i<3;i++) {
          const u = .13 + ((h1 >>> (i*5)) & 31) / 42;
          const v = .15 + ((h1 >>> (i*7+1)) & 31) / 42;
          const p=P(x+u,y+v), r=(i===1?1.2:.8)*S;
          c.fillStyle = i===1?'rgba(252,238,199,.76)':'rgba(74,132,95,.33)';
          c.beginPath();c.arc(p[0],p[1],r,0,TAU);c.fill();
        }
      }
      if (t.kind === 'road' || t.kind === 'bridge') {
        const hor = isRoad(y) && !isRoad(x), ver = isRoad(x) && !isRoad(y);
        c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = Math.max(1, S * 1.2); c.setLineDash([4 * S, 5 * S]); c.beginPath();
        if (hor) { c.moveTo(...P(x, y + .5)); c.lineTo(...P(x + 1, y + .5)); } if (ver) { c.moveTo(...P(x + .5, y)); c.lineTo(...P(x + .5, y + 1)); }
        c.stroke(); c.setLineDash([]);
        if (t.kind === 'bridge') { c.strokeStyle = '#5b4632'; c.lineWidth = Math.max(1, S * 1.4); c.beginPath(); for (const off of hor ? [.04, .96] : []) { c.moveTo(...P(x, y + off, 4)); c.lineTo(...P(x + 1, y + off, 4)); } for (const off of ver ? [.04, .96] : []) { c.moveTo(...P(x + off, y, 4)); c.lineTo(...P(x + off, y + 1, 4)); } c.stroke(); }
      }
      if (t.kind !== 'road' && t.kind !== 'bridge' && t.kind !== 'water') for (const [dx, dy] of DIRS) { const n = tile(x + dx, y + dy); if (n && n.kind === 'road') { c.fillStyle = '#d6d9de'; const s = .14; if (dx === 1) diamond(c, x + 1 - s, y, s, 1); if (dx === -1) diamond(c, x, y, s, 1); if (dy === 1) diamond(c, x, y + 1 - s, 1, s); if (dy === -1) diamond(c, x, y, 1, s); c.fill(); } }
    }
    // The town sits on a thick slab of earth, like a toy on a table.
    const a = P(0, N), b = P(N, N), e = P(N, 0), d = 26;
    let g = c.createLinearGradient(0, a[1], 0, a[1] + d * S); g.addColorStop(0, '#9c7a55'); g.addColorStop(1, '#7a5c3e');
    c.fillStyle = g; c.lineJoin = 'round'; c.lineWidth = 4 * S; c.strokeStyle = g; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(b[0], b[1] + d * S); c.lineTo(a[0], a[1] + d * S); c.closePath(); c.fill(); c.stroke();
    g = c.createLinearGradient(0, e[1], 0, b[1] + d * S); g.addColorStop(0, '#7f6045'); g.addColorStop(1, '#5e4630');
    c.fillStyle = g; c.strokeStyle = g; c.beginPath(); c.moveTo(...b); c.lineTo(...e); c.lineTo(e[0], e[1] + d * S); c.lineTo(b[0], b[1] + d * S); c.closePath(); c.fill(); c.stroke();
    for (const bd of buildings) softShadow(c, bd.x + .5, bd.y + .5, .55 + Math.min(.5, bd.h / 160), .2);
    for (const p of props) if (p.kind === 'tree') softShadow(c, p.x, p.y, .3 * p.s, .18);
  }
  function drawHeroFacade(c,b,night) {
    if (!b.hero) return;
    const x=b.x+.5, y=b.y+.5, h=b.h;
    c.save(); c.lineCap='round'; c.lineJoin='round';
    if (b.kind==='house') {
      // A low stone plinth, eaves and two narrow shutters tie the window into the wall.
      box(c,x,y,.375,.375,0,2,'#b5a18b','#ded1bb');
      const a=P(x-.4,y+.38,h-1), d=P(x+.4,y+.38,h-1);
      c.strokeStyle='rgba(255,245,215,.8)';c.lineWidth=Math.max(1.2,S*1.6);
      c.beginPath();c.moveTo(...a);c.lineTo(...d);c.stroke();
      for(const side of [-1,1]){
        const xx=x-.17+side*.075, p=P(xx,y+.373,h*.55);
        c.fillStyle=side<0?'#8c987c':'#708e7e';
        c.fillRect(p[0]-1.1*S,p[1]-4*S,2.2*S,8*S);
      }
      const flower=P(x-.18,y+.41,h*.54-7);
      c.fillStyle='#ae7650';c.fillRect(flower[0]-5*S,flower[1],10*S,1.7*S);
      for(let k=0;k<3;k++){c.fillStyle=k===1?'#e7ad96':'#fff0cf';
        c.beginPath();c.arc(flower[0]+(k-1)*3*S,flower[1]-1.6*S,1.3*S,0,TAU);c.fill();}
    }else if(b.kind==='shop'){
      // A low shop sill and hanging sign use the same wall-space perspective.
      box(c,x,y+.43,.37,.035,2,3,'#b6a997','#ecdfd0');
      const sign=P(x+.25,y+.44,h*.8);
      c.strokeStyle='#574c42';c.lineWidth=Math.max(1,S);
      c.beginPath();c.moveTo(sign[0],sign[1]-10*S);c.lineTo(sign[0],sign[1]-3*S);c.stroke();
      c.fillStyle='#fff2db';c.beginPath();c.roundRect(sign[0]-7*S,sign[1]-3*S,14*S,8*S,1.5*S);c.fill();
      c.strokeStyle=b.awning;c.lineWidth=Math.max(.8,S);c.stroke();
      c.fillStyle=b.awning;c.font=`800 ${Math.max(5,4.5*S)}px system-ui`;
      c.textAlign='center';c.fillText(b.name==='BAKERY'?'BREAD':'READ',sign[0],sign[1]+2*S);
    }
    c.restore();
  }
  function drawBuilding(c, b, night) {
    // Offscreen culling is important now that each shop has material layers:
    // keep its full roof height in the vertical margin.
    const foot = P(b.x+.5,b.y+.5);
    if (foot[0] < -100*S || foot[0] > W+100*S ||
        foot[1] < -95*S || foot[1] > H+(b.h+60)*S) return;
    // All everyday houses and shops share one richer architectural language:
    // pitched roofs, real glazing, deep awnings, inset doors and tactile trim.
    if ((b.kind === 'house' || b.kind === 'shop') && typeof ToyTownDiorama !== 'undefined') {
      ToyTownDiorama.building(c, b, night, {P, box, shade, S, TAU}); return;
    }
    const cx = b.x + .5, cy = b.y + .5;
    // House and shop lights are attached to the facade, not floating sprites.
    const wallGlow = (x, y, power = .34) => {
      if (!night) return;
      const [sx, sy] = P(x, y, 8), rad = 13 * S;
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, rad);
      g.addColorStop(0, `rgba(255,205,120,${power})`);
      g.addColorStop(1, 'rgba(255,205,120,0)');
      c.fillStyle = g; c.fillRect(sx - rad, sy - rad, 2 * rad, 2 * rad);
      c.restore();
    };
    if (b.kind === 'house') {
      box(c, cx, cy, .36, .36, 0, b.h, b.wall);
      const top = P(cx, cy, b.h + 16), corners = [[-.42, -.42], [.42, -.42], [.42, .42], [-.42, .42]].map(([x, y]) => P(cx + x, cy + y, b.h));
      c.fillStyle = shade(b.roof, .82); c.beginPath(); c.moveTo(...corners[3]); c.lineTo(...corners[2]); c.lineTo(...top); c.closePath(); c.fill();
      c.fillStyle = shade(b.roof, .66); c.beginPath(); c.moveTo(...corners[2]); c.lineTo(...corners[1]); c.lineTo(...top); c.closePath(); c.fill();
      if (b.hero) {
        // Roof courses follow the two actual sloped faces, giving zoomed-in
        // houses dimensional clay tiles instead of stripes on flat canvas.
        c.save(); c.strokeStyle = 'rgba(255,235,209,.46)';
        c.lineWidth = Math.max(.8, 1 * S); c.lineCap = 'round';
        for (let course = 1; course <= 4; course++) {
          const t = course / 5;
          const along = (a, d) => [top[0] + (a[0] - top[0])*t, top[1] + (a[1]-top[1])*t];
          for (const pair of [[3,2],[2,1]]) {
            const a = along(corners[pair[0]]), d = along(corners[pair[1]]);
            c.beginPath(); c.moveTo(...a); c.lineTo(...d); c.stroke();
          }
        }
        c.strokeStyle = 'rgba(91,61,43,.34)'; c.lineWidth = Math.max(.7, S);
        c.beginPath(); c.moveTo(...top); c.lineTo(...corners[2]); c.stroke();
        c.restore();
      }
      win(c, cx - .17, cy + .36, 5, b.h * .55, night, 'y');
      win(c, cx + .36, cy - .13, 4.5, b.h * .58, night, 'x');
      box(c, cx - .17, cy - .16, .08, .08, b.h + 11, 12, '#b97657', '#d99b72');
      c.fillStyle = '#7a4a2b'; door(c, cx + .1, cy + .36);
      const porch = P(cx + .1, cy + .39, 0);
      c.fillStyle = '#d2bea2'; c.beginPath(); c.ellipse(porch[0], porch[1] + 1.5 * S, 4.5 * S, 1.6 * S, 0, 0, TAU); c.fill();
      const lamp = P(cx + .29, cy + .37, b.h * .36);
      c.fillStyle = night ? '#ffe4a0' : '#fff7dc'; c.beginPath(); c.arc(lamp[0], lamp[1], 1.5 * S, 0, TAU); c.fill();
      wallGlow(cx + .29, cy + .37, .28);
      drawHeroFacade(c,b,night);
    } else if (b.kind === 'shop') {
      box(c, cx, cy, .4, .4, 0, b.h, b.wall);
      box(c, cx, cy, .43, .43, b.h, 2, shade(b.wall, .75), shade(b.wall, 1.08));
      c.fillStyle = b.awning; c.beginPath(); c.moveTo(...P(cx - .4, cy + .4, b.h * .62)); c.lineTo(...P(cx + .4, cy + .4, b.h * .62)); c.lineTo(...P(cx + .4, cy + .56, b.h * .45)); c.lineTo(...P(cx - .4, cy + .56, b.h * .45)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(...P(cx - .4 + k * .2, cy + .4, b.h * .62)); c.lineTo(...P(cx - .3 + k * .2, cy + .4, b.h * .62)); c.lineTo(...P(cx - .3 + k * .2, cy + .56, b.h * .45)); c.lineTo(...P(cx - .4 + k * .2, cy + .56, b.h * .45)); c.closePath(); c.fill(); }
      win(c, cx, cy + .4, 9, b.h * .3, night, 'y'); win(c, cx + .4, cy, 6, b.h * .7, night, 'x');
      // A pair of planted flowerpots are anchored at the storefront threshold.
      for (const side of [-1, 1]) {
        const px = cx + side * .32, py = cy + .46;
        box(c, px, py, .055, .06, 0, 4, '#ac7958', '#d5a079');
        const leaf = P(px, py, 6);
        c.fillStyle = '#509b5d'; c.beginPath();
        c.ellipse(leaf[0] - 1.6 * S, leaf[1], 2.1 * S, 3.5 * S, -.5, 0, TAU);
        c.ellipse(leaf[0] + 1.8 * S, leaf[1] - 1 * S, 2.1 * S, 3.7 * S, .4, 0, TAU); c.fill();
      }
      wallGlow(cx, cy + .4, .26);
      drawHeroFacade(c,b,night);
      const s = P(cx, cy + .2, b.h + 7); c.fillStyle = '#ffffff'; const fs = Math.max(6, 6.5 * S); c.font = `800 ${fs}px system-ui`; c.textAlign = 'center'; const tw = c.measureText(b.name).width + 6; c.fillRect(s[0] - tw / 2, s[1] - fs * .8, tw, fs * 1.25); c.fillStyle = b.awning; c.fillText(b.name, s[0], s[1] + fs * .3);
    } else if (b.kind === 'tower') {
      box(c, cx, cy, .4, .4, 0, b.h, b.wall);
      for (let z = 8; z < b.h - 6; z += 9) { win(c, cx - .2, cy + .4, 4, z, night, 'y'); win(c, cx + .15, cy + .4, 4, z, night, 'y'); win(c, cx + .4, cy - .15, 4, z, night, 'x'); win(c, cx + .4, cy + .2, 4, z, night, 'x'); }
      box(c, cx, cy, .44, .44, b.h, 2.5, '#8c9dac', '#d7e3ec');
      box(c, cx + .15, cy - .12, .1, .1, b.h + 2.5, 8, '#c9cfd8');
    } else if (b.kind === 'fire') {
      box(c, cx, cy, .44, .42, 0, b.h, b.wall);
      c.fillStyle = '#5a1d18'; const d0 = P(cx - .25, cy + .42, 0), d1 = P(cx + .25, cy + .42, 0), d2 = P(cx + .25, cy + .42, 16), d3 = P(cx - .25, cy + .42, 16); c.beginPath(); c.moveTo(...d0); c.lineTo(...d1); c.lineTo(...d2); c.lineTo(...d3); c.closePath(); c.fill();
      const s = P(cx, cy + .42, b.h - 5); c.fillStyle = '#fff'; c.font = `900 ${Math.max(6, 7 * S)}px system-ui`; c.textAlign = 'center'; c.fillText('FIRE', s[0], s[1]);
    } else if (b.kind === 'site') {
      box(c, cx, cy, .9, .9, 0, b.h * .5, '#c9b07a', '#b39760');
      c.strokeStyle = '#e0a020'; c.lineWidth = Math.max(1, 1.4 * S); for (const [x, y] of [[-.9, .9], [.9, .9], [.9, -.9]]) { c.beginPath(); c.moveTo(...P(cx + x, cy + y, b.h * .5)); c.lineTo(...P(cx + x, cy + y, b.h * 1.4)); c.stroke(); }
    }
  }
  function win(c, x, y, size, z, night, face) {
    const s = size / 64, a = face === 'y' ? P(x - s, y, z) : P(x, y - s, z), b = face === 'y' ? P(x + s, y, z) : P(x, y + s, z);
    const tv = night && TV_DAYS.includes(theme) && Math.sin(x * 53 + y * 71 + z * 3) > .55;   // the night of a big story: windows flicker blue with the telly
    c.fillStyle = tv ? (Math.sin(clock * 9 + x * 7) > 0 ? '#8fb8ff' : '#5f86d6') : night ? (Math.sin(x * 91 + y * 37 + z) > -.3 ? '#ffe59a' : '#3b4660') : '#cfe9ff';
    c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(b[0], b[1] - size * .9 * S); c.lineTo(a[0], a[1] - size * .9 * S); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,253,240,.8)'; c.lineWidth = Math.max(.55, .8 * S); c.stroke();
    c.strokeStyle = 'rgba(88,111,137,.42)'; c.lineWidth = Math.max(.4, .6 * S);
    c.beginPath(); c.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); c.lineTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - size * .9 * S); c.stroke();
  }
  function door(c, x, y) { const a = P(x - .07, y, 0), b = P(x + .07, y, 0); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(b[0], b[1] - 9 * S); c.lineTo(a[0], a[1] - 9 * S); c.closePath(); c.fill(); }
  // A ball on a stick, lit from the upper left, swaying a touch in the breeze.
  function drawTree(c, p) {
    const foot = P(p.x,p.y);
    if (foot[0] < -65*S || foot[0] > W+65*S ||
        foot[1] < -65*S || foot[1] > H+65*S) return;
    if (typeof ToyTownDiorama !== 'undefined') {
      ToyTownDiorama.tree(c, p, {P, S, shade, TAU, clock}); return;
    }
    const [x, y] = P(p.x, p.y), k = S * p.s, sway = Math.sin(clock * .8 + p.x * 3) * .8 * k;
    c.strokeStyle = '#7a5235'; c.lineWidth = 3 * k; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y - 1 * k); c.lineTo(x + sway * .5, y - 12 * k); c.stroke();
    for (const [dy, r] of [[17, 8.5], [24, 6.5]]) { const cx = x + sway, cy = y - dy * k, g = c.createRadialGradient(cx - r * .4 * k, cy - r * .45 * k, r * .1 * k, cx, cy, r * k); g.addColorStop(0, shade(p.c, 1.3)); g.addColorStop(.55, p.c); g.addColorStop(1, shade(p.c, .72)); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r * k, 0, TAU); c.fill(); }
  }
  function drawProp(c, p, night) {
    const [x, y] = P(p.x, p.y);
    if (p.kind === 'tree') drawTree(c, p);
    else if (p.kind === 'bench') { box(c, p.x, p.y, .25, .08, 3, 2, '#b8784a'); }
    else if (p.kind === 'hero-bench') {
      for(const d of [-.19,.19]) {box(c,p.x+d,p.y,.04,.075,0,5,'#41494b');}
      box(c,p.x,p.y,.29,.12,5,2.3,'#a56b47','#c99366');
      box(c,p.x,p.y-.09,.29,.035,8,10,'#a56b47','#d2a77c');
      c.strokeStyle='#f6d0a0';c.lineWidth=Math.max(.5,S*.8);
      for(const d of [-.12,.04]){const a=P(p.x-.26,p.y-.12,11+d*7),b=P(p.x+.26,p.y-.12,11+d*7);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();}
    }
    else if (p.kind === 'hero-table') {
      box(c,p.x,p.y,.17,.17,7,1.4,'#c9a37a','#e7c49a');
      for(const d of [-.13,.13])for(const e of [-.13,.13])box(c,p.x+d,p.y+e,.025,.025,0,8,'#8b684c');
      const [tx,ty]=P(p.x,p.y,10);
      c.fillStyle='#fff6d8';c.beginPath();c.ellipse(tx,ty,3*S,1.6*S,0,0,TAU);c.fill();
      c.fillStyle='#c77b55';c.beginPath();c.arc(tx,ty-1*S,1.2*S,0,TAU);c.fill();
    }
    else if (p.kind === 'hero-lamp') {
      const a=P(p.x,p.y),b=P(p.x,p.y,25);
      c.strokeStyle='#4b5557';c.lineWidth=Math.max(1.3,2.2*S);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
      c.fillStyle='#fff0bd';c.beginPath();c.arc(b[0],b[1]-2*S,3*S,0,TAU);c.fill();
      c.fillStyle='#475257';c.fillRect(b[0]-4*S,b[1]-6*S,8*S,2*S);
      if(night){const g=c.createRadialGradient(b[0],b[1],0,b[0],b[1],23*S);
        g.addColorStop(0,'rgba(255,210,129,.36)');g.addColorStop(1,'rgba(255,210,129,0)');
        c.fillStyle=g;c.fillRect(b[0]-23*S,b[1]-23*S,46*S,46*S);}
    }
    else if (p.kind === 'hero-mail') {
      box(c,p.x,p.y,.09,.1,7,9,'#4788a8','#79b7d1');box(c,p.x,p.y,.05,.05,0,7,'#4b5557');
      const s=P(p.x,p.y+.1,12);c.fillStyle='#ecf7ff';c.fillRect(s[0]-2*S,s[1]-S,4*S,.8*S);
    }
    else if (p.kind === 'hero-rack') {
      c.strokeStyle='#6a777a';c.lineWidth=Math.max(1,1.7*S);
      for(const k of [-1,0,1]){const q=P(p.x+k*.16,p.y,0);c.beginPath();c.arc(q[0],q[1]-3*S,3*S,Math.PI,0);c.lineTo(q[0]+3*S,q[1]);c.stroke();}
    }
    else if (p.kind === 'hero-shrub') {
      box(c,p.x,p.y,.16,.16,0,3,'#b58c67','#d5ac85');
      for(const [dx,dy,rad] of [[-2.7,-8,3.8],[2.6,-8,4.1],[0,-12,4.5]]){
        const grad=c.createRadialGradient(x+dx*S-1.3*S,y+dy*S-1.3*S,.3*S,x+dx*S,y+dy*S,rad*S);
        grad.addColorStop(0,'#a1d69b');grad.addColorStop(1,p.col);c.fillStyle=grad;
        c.beginPath();c.arc(x+dx*S,y+dy*S,rad*S,0,TAU);c.fill();}
    }
    else if (p.kind === 'fountain') { diamond(c, p.x - .6, p.y - .6, 1.2, 1.2); c.fillStyle = '#c9d2dc'; c.fill(); diamond(c, p.x - .5, p.y - .5, 1, 1); c.fillStyle = '#7fd3ff'; c.fill(); if (Math.random() < .5) burst(p.x, p.y, 6, 1, '#bfe9ff', {up: 40, spread: .3, life: .9, r: 1.2}); }
    else if (p.kind === 'crane') {
      c.strokeStyle = '#e0a020'; c.lineWidth = Math.max(1.5, 2.4 * S); const b0 = P(p.x, p.y, 0), b1 = P(p.x, p.y, 120); c.beginPath(); c.moveTo(...b0); c.lineTo(...b1); c.stroke();
      const a = clock * .25, jx = Math.cos(a) * 2.6, jy = Math.sin(a) * 2.6, tip = P(p.x + jx, p.y + jy, 118), back = P(p.x - jx * .4, p.y - jy * .4, 118);
      c.beginPath(); c.moveTo(...back); c.lineTo(...tip); c.stroke(); c.lineWidth = 1; c.strokeStyle = '#333'; const hook = P(p.x + jx * .8, p.y + jy * .8, 60 + Math.sin(clock * .7) * 25); c.beginPath(); c.moveTo(...P(p.x + jx * .8, p.y + jy * .8, 118)); c.lineTo(...hook); c.stroke();
      box(c, p.x + jx * .8, p.y + jy * .8, .18, .18, 60 + Math.sin(clock * .7) * 25 - 8, 8, '#e98a3a');
    }
    else if (p.kind === 'duck') { c.fillStyle = '#ffd23f'; c.beginPath(); c.ellipse(x, y - 2 * S, 3.5 * S, 2.2 * S, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 2.5 * S * Math.sign(p.vx || 1), y - 5 * S, 1.8 * S, 0, TAU); c.fill(); }
    else if (p.kind === 'stadium') {
      diamond(c, p.x - 2, p.y - 2, 4, 4); c.fillStyle = '#c4c9d1'; c.fill(); diamond(c, p.x - 1.5, p.y - 1.5, 3, 3); c.fillStyle = '#5fbf5a'; c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, S); diamond(c, p.x - 1.3, p.y - 1, 2.6, 2); c.stroke(); c.beginPath(); c.moveTo(...P(p.x, p.y - 1)); c.lineTo(...P(p.x, p.y + 1)); c.stroke();
      for (let k = 0; k < 40; k++) { const side = k % 4, u = (k >> 2) / 10 * 3.6 - 1.8, q = side === 0 ? [p.x + u, p.y - 1.8] : side === 1 ? [p.x + 1.8, p.y + u] : side === 2 ? [p.x + u, p.y + 1.8] : [p.x - 1.8, p.y + u], s = P(q[0], q[1], 4 + Math.abs(Math.sin(clock * 4 + k)) * 3); c.fillStyle = PASTEL[k % PASTEL.length]; c.beginPath(); c.arc(s[0], s[1], 1.6 * S, 0, TAU); c.fill(); }
      if (p.sport === 'cricket') { diamond(c, p.x - .15, p.y - .9, .3, 1.8); c.fillStyle = '#d9c38a'; c.fill(); for (const e of [-.9, .9]) box(c, p.x, p.y + e, .08, .02, 0, 6, '#f2e6c8'); }
      if (p.sport === 'tennis') { diamond(c, p.x - 1.2, p.y - .7, 2.4, 1.4); c.fillStyle = '#5b8fd6'; c.fill(); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(...P(p.x, p.y - .7)); c.lineTo(...P(p.x, p.y + .7)); c.stroke(); }
      if (p.ball) { const s = P(p.x + p.ball.x, p.y + p.ball.y, 3); c.fillStyle = p.sport === 'tennis' ? '#d7f25a' : '#fff'; c.beginPath(); c.arc(s[0], s[1], 2 * S, 0, TAU); c.fill(); }
    }
    else if (p.kind === 'launchpad') {
      diamond(c, p.x - .8, p.y - .8, 1.6, 1.6); c.fillStyle = '#9aa3ad'; c.fill();
      const z = p.launched || 0, base = P(p.x, p.y, z); c.fillStyle = '#f2f2f2'; c.fillRect(base[0] - 4 * S, base[1] - 34 * S, 8 * S, 34 * S); c.fillStyle = '#e2463a'; c.beginPath(); c.moveTo(base[0] - 4 * S, base[1] - 34 * S); c.lineTo(base[0], base[1] - 44 * S); c.lineTo(base[0] + 4 * S, base[1] - 34 * S); c.fill(); c.fillRect(base[0] - 7 * S, base[1] - 8 * S, 3 * S, 8 * S); c.fillRect(base[0] + 4 * S, base[1] - 8 * S, 3 * S, 8 * S);
      if (!z) { c.strokeStyle = '#6b7380'; c.lineWidth = Math.max(1, 2 * S); c.beginPath(); c.moveTo(...P(p.x + .5, p.y - .5, 0)); c.lineTo(...P(p.x + .5, p.y - .5, 46)); c.stroke(); }
    }
    else if (p.kind === 'stage' || p.kind === 'lab' || p.kind === 'market') {
      if (p.kind === 'stage') { box(c, p.x, p.y, 1.4, .8, 0, 6, '#7a4fb3', '#9b6fd4'); c.fillStyle = '#ffd23f'; for (let k = -1; k <= 1; k++) { const s = P(p.x + k * .9, p.y - .8, 30); c.beginPath(); c.arc(s[0], s[1], 2.4 * S, 0, TAU); c.fill(); } }
      else if (p.kind === 'lab') { box(c, p.x, p.y, 1.1, 1.1, 0, 28, '#e4eef5'); box(c, p.x + .4, p.y - .4, .3, .3, 28, 12, '#c4d4e0'); const s = P(p.x, p.y + 1.1, 18); c.fillStyle = '#2f9e7a'; c.font = `900 ${Math.max(6, 7 * S)}px system-ui`; c.textAlign = 'center'; c.fillText('LAB', s[0], s[1]); }
      else for (let k = 0; k < 6; k++) { const sx = p.x - 1.4 + (k % 3) * 1.4, sy = p.y - .8 + (k >> 1 & 1) * 1.6; box(c, sx, sy, .35, .25, 0, 7, '#e9d4a8'); box(c, sx, sy, .4, .3, 12, 2, ['#e2463a', '#3f8fd6', '#2f9e7a'][k % 3]); }
    }
    else if (p.kind === 'animal') drawAnimal(c, p);
    else if (p.kind === 'times') {
      const [bx, by] = P(p.x, p.y, p.z || 0), u = Math.max(S, .9), w = 130 * u, h = 74 * u, top = by - 16 * u - h, stories = today_.filter(v => v.story), v = stories.length ? stories[Math.floor(clock / 14) % stories.length] : null;
      c.strokeStyle = '#4a4f5a'; c.lineWidth = 2.2 * S; c.beginPath(); for (const k of [-.22, .22]) { const [lx, ly] = P(p.x + k, p.y - k * .3, p.z || 0); c.moveTo(lx, ly); c.lineTo(bx + k * w * 1.3, top + h); } c.stroke();   // steel legs on the roof
      c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.roundRect(bx - w / 2 + 2 * S, top + 3 * S, w, h, 5 * S); c.fill();
      c.fillStyle = '#fffaf0'; c.beginPath(); c.roundRect(bx - w / 2, top, w, h, 5 * S); c.fill(); c.strokeStyle = '#2d3440'; c.lineWidth = Math.max(1, S); c.stroke();
      c.fillStyle = '#2d3440'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `900 ${10 * u}px Georgia,serif`; c.fillText('TOY TOWN TIMES', bx, top + 14 * u);
      c.fillRect(bx - w / 2 + 6 * u, top + 18 * u, w - 12 * u, 1 * u);
      const text = v ? `${v.emoji} ${headline(v.story)}` : 'Nothing much happened today. Lovely.', fs = 7.6 * u; c.font = `700 ${fs}px system-ui`; c.textAlign = 'left';
      const words = text.split(' '), lines = []; let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 14 * u && line) { lines.push(line); line = wd; } else line = t; } lines.push(line);
      lines.slice(0, 5).forEach((l, i) => c.fillText(l, bx - w / 2 + 7 * u, top + 29 * u + i * fs * 1.25));
    }
    else if (p.kind === 'kiosk') { box(c, p.x, p.y, .16, .16, 0, 13, '#2f9e7a'); box(c, p.x, p.y, .21, .21, 13, 2, '#e2463a'); const [kx, ky] = P(p.x, p.y + .17, 7); c.fillStyle = '#fffaf0'; c.fillRect(kx - 4 * S, ky - 3 * S, 8 * S, 5 * S); c.fillStyle = '#2d3440'; c.fillRect(kx - 3 * S, ky - 2 * S, 6 * S, .7 * S); c.fillRect(kx - 3 * S, ky - .5 * S, 4 * S, .5 * S); }
    else if (p.kind === 'bunting') {
      const [ax, ay] = p.along === 'x' ? P(p.x - .5, p.y, 30) : P(p.x, p.y - .5, 30), [bx2, by2] = p.along === 'x' ? P(p.x + .5, p.y, 30) : P(p.x, p.y + .5, 30), sag = 8 * S;
      c.strokeStyle = 'rgba(60,60,60,.55)'; c.lineWidth = Math.max(.8, .8 * S); c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo((ax + bx2) / 2, (ay + by2) / 2 + sag * 2, bx2, by2); c.stroke();
      for (let k = 1; k < 9; k++) { const u = k / 9, fx = ax + (bx2 - ax) * u, fy = ay + (by2 - ay) * u + 4 * sag * u * (1 - u), sw = Math.sin(clock * 2 + k + p.x) * .6 * S; c.fillStyle = p.cols[k % p.cols.length]; c.beginPath(); c.moveTo(fx - 2.4 * S, fy); c.lineTo(fx + 2.4 * S, fy); c.lineTo(fx + sw, fy + 5 * S); c.closePath(); c.fill(); }
    }
    else if (p.kind === 'flowers') { for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? p.c[0] : p.c[1]; c.beginPath(); c.arc(x + (k - 2) * 2.6 * S, y - 2 * S - (k % 2) * 1.2 * S + Math.sin(clock * 1.5 + k) * .4 * S, 1.5 * S, 0, TAU); c.fill(); } c.fillStyle = '#4f9e4a'; c.fillRect(x - 6.5 * S, y - 1 * S, 13 * S, 1.6 * S); }
    else if (p.kind === 'picnic') { diamond(c, p.x - .45, p.y - .3, .9, .6); c.fillStyle = '#e2463a'; c.fill(); c.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 3; k++) { diamond(c, p.x - .45 + k * .3, p.y - .3, .15, .6); c.fill(); } box(c, p.x + .25, p.y + .1, .1, .07, 0, 5, '#b8784a'); }
    else if (p.kind === 'easel') { const [ex, ey] = P(p.x, p.y, 0); c.strokeStyle = '#7a5235'; c.lineWidth = 1.2 * S; c.beginPath(); c.moveTo(ex - 3 * S, ey); c.lineTo(ex, ey - 16 * S); c.lineTo(ex + 3 * S, ey); c.stroke(); c.fillStyle = '#fffaf0'; c.fillRect(ex - 5 * S, ey - 17 * S, 10 * S, 8 * S); const k = Math.min(1, p.t / 25); c.fillStyle = '#7fd3ff'; c.fillRect(ex - 4 * S, ey - 12 * S, 8 * S * k, 2.5 * S); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(ex + 2 * S, ey - 15 * S, 1.3 * S * k, 0, TAU); c.fill(); c.fillStyle = '#5cb85c'; c.fillRect(ex - 4 * S, ey - 10.5 * S, 8 * S * Math.max(0, k * 1.4 - .4), 1.2 * S); }
    else if (p.kind === 'diya') { const f = .7 + .3 * Math.sin(clock * 9 + p.ph * 5); c.fillStyle = '#b5652d'; c.beginPath(); c.ellipse(x, y - 1 * S, 2.6 * S, 1.2 * S, 0, 0, TAU); c.fill(); c.fillStyle = `rgba(255,${180 + 40 * f | 0},60,${.9})`; c.beginPath(); c.ellipse(x, y - 3.5 * S * f, 1.1 * S, 2.2 * S * f, 0, 0, TAU); c.fill(); }
    else if (p.kind === 'rangoli') { for (let k = 4; k > 0; k--) { c.fillStyle = ['#ff5d9e', '#ffd23f', '#5dd36b', '#5d9eff'][k % 4]; diamond(c, p.x - k * .18, p.y - k * .18, k * .36, k * .36); c.fill(); } }
    else if (p.kind === 'xtree') { for (let k = 0; k < 3; k++) { c.fillStyle = '#2f8f4a'; c.beginPath(); c.moveTo(x - (14 - k * 4) * S, y - (8 + k * 12) * S); c.lineTo(x + (14 - k * 4) * S, y - (8 + k * 12) * S); c.lineTo(x, y - (26 + k * 12) * S); c.fill(); } for (let k = 0; k < 9; k++) { c.fillStyle = Math.sin(clock * 4 + k) > 0 ? ['#ff5d5d', '#ffd23f', '#5dd3ff'][k % 3] : '#ffffff'; c.beginPath(); c.arc(x + Math.sin(k * 2.3) * 9 * S, y - (12 + k * 3.4) * S, 1.4 * S, 0, TAU); c.fill(); } c.fillStyle = '#ffd23f'; c.font = `${12 * S}px system-ui`; c.textAlign = 'center'; c.fillText('★', x, y - 50 * S); }
    else if (p.kind === 'pumpkin') { c.fillStyle = '#ef8a2b'; c.beginPath(); c.ellipse(x, y - 3 * S, 4 * S, 3 * S, 0, 0, TAU); c.fill(); c.fillStyle = '#ffe07a'; c.fillRect(x - 2 * S, y - 4 * S, 1.2 * S, 1.2 * S); c.fillRect(x + .8 * S, y - 4 * S, 1.2 * S, 1.2 * S); c.fillStyle = '#4f7a2e'; c.fillRect(x - .5 * S, y - 7 * S, 1 * S, 2 * S); }
    else if (p.kind === 'lantern') { const [lx, ly] = P(p.x, p.y, 26), g = .6 + .4 * Math.sin(clock * 2 + p.ph); c.fillStyle = `rgba(255,170,60,${.25 * g})`; c.beginPath(); c.arc(lx, ly, 8 * S, 0, TAU); c.fill(); c.fillStyle = '#e2463a'; c.beginPath(); c.ellipse(lx, ly, 3 * S, 4 * S, 0, 0, TAU); c.fill(); c.strokeStyle = '#6b4a2b'; c.lineWidth = S; c.beginPath(); c.moveTo(lx, ly - 4 * S); c.lineTo(lx, ly - 10 * S); c.stroke(); }
    else if (p.kind === 'podium') { box(c, p.x, p.y, .18, .2, 0, 14, '#ffd23f'); box(c, p.x - .4, p.y, .18, .2, 0, 9, '#c0c8d4'); box(c, p.x + .4, p.y, .18, .2, 0, 6, '#c98b4e'); if (p.winners) for (const [dx, z] of [[0, 14], [-.4, 9], [.4, 6]]) { const [wx, wy] = P(p.x + dx, p.y, z); c.fillStyle = PASTEL[(dx * 10 + 3) | 0]; c.fillRect(wx - 2 * S, wy - 8 * S, 4 * S, 7 * S); c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(wx, wy - 10 * S, 2.4 * S, 0, TAU); c.fill(); } }
    else if (p.kind === 'rover') { box(c, p.x, p.y, .2, .14, 2, 5, '#d8dde4'); c.fillStyle = '#3b3f4a'; for (const k of [-1, 0, 1]) { const [wx, wy] = P(p.x + k * .14, p.y + .16, 1); c.beginPath(); c.arc(wx, wy, 1.6 * S, 0, TAU); c.fill(); } const [ax, ay] = P(p.x, p.y, 14); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(ax, ay, 1.6 * S, 0, TAU); c.fill(); }
    else if (p.kind === 'billboard') { const [bx, by] = P(p.x, p.y, p.z + 4); c.fillStyle = '#2d3440'; c.fillRect(bx - 8 * S, by - 30 * S, 16 * S, 28 * S); c.fillStyle = `hsl(${clock * 60 % 360},70%,65%)`; c.fillRect(bx - 6.5 * S, by - 28 * S, 13 * S, 22 * S); c.fillStyle = '#fff'; c.font = `800 ${5 * S}px system-ui`; c.textAlign = 'center'; c.fillText('NEW!', bx, by - 15 * S); }
    else if (p.kind === 'finish') { const a = P(p.x, p.y - .5, 0), b = P(p.x, p.y + .5, 0); c.strokeStyle = '#3b3f4a'; c.lineWidth = 1.5 * S; c.beginPath(); c.moveTo(...a); c.lineTo(a[0], a[1] - 22 * S); c.moveTo(...b); c.lineTo(b[0], b[1] - 22 * S); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(a[0], a[1] - 22 * S); c.lineTo(b[0], b[1] - 22 * S); c.lineTo(b[0], b[1] - 16 * S); c.lineTo(a[0], a[1] - 16 * S); c.closePath(); c.fill(); c.fillStyle = '#d0543a'; c.font = `800 ${4.5 * S}px system-ui`; c.textAlign = 'center'; c.fillText('FINISH', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 17.5 * S); }
    else if (p.kind === 'panda') { c.fillStyle = '#f7f7f2'; c.beginPath(); c.ellipse(x, y - 7 * S, 6 * S, 5 * S, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 1 * S, y - 14 * S, 4 * S, 0, TAU); c.fill(); c.fillStyle = '#222'; for (const k of [-1, 1]) { c.beginPath(); c.arc(x + 1 * S + k * 3 * S, y - 17.5 * S, 1.5 * S, 0, TAU); c.fill(); c.beginPath(); c.ellipse(x + 1 * S + k * 1.6 * S, y - 14.5 * S, 1 * S, 1.4 * S, 0, 0, TAU); c.fill(); } c.fillRect(x - 6 * S, y - 6 * S, 3 * S, 5 * S); c.fillRect(x + 3 * S, y - 6 * S, 3 * S, 5 * S); c.strokeStyle = '#5cb85c'; c.lineWidth = 1.4 * S; c.beginPath(); c.moveTo(x + 4 * S, y - 9 * S); c.lineTo(x + 10 * S, y - 20 * S + Math.sin(clock * 3) * 1.5 * S); c.stroke(); }
  }
  function drawAnimal(c, p) {
    const [x, y] = P(p.x, p.y), s = S;
    if (p.a === 'elephant') { c.fillStyle = '#9aa3b0'; c.beginPath(); c.ellipse(x, y - 9 * s, 9 * s, 6 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 8 * s, y - 12 * s, 4.5 * s, 0, TAU); c.fill(); c.fillRect(x - 6 * s, y - 5 * s, 3 * s, 5 * s); c.fillRect(x + 3 * s, y - 5 * s, 3 * s, 5 * s); c.strokeStyle = '#9aa3b0'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(x + 12 * s, y - 11 * s); c.quadraticCurveTo(x + 14 * s, y - 4 * s, x + 11 * s, y - 2 * s); c.stroke(); }
    else if (p.a === 'giraffe') { c.fillStyle = '#f2c14e'; c.beginPath(); c.ellipse(x, y - 9 * s, 6 * s, 4 * s, 0, 0, TAU); c.fill(); c.fillRect(x + 3 * s, y - 26 * s, 2.5 * s, 16 * s); c.beginPath(); c.ellipse(x + 5 * s, y - 27 * s, 3 * s, 2 * s, 0, 0, TAU); c.fill(); c.fillRect(x - 4 * s, y - 6 * s, 1.6 * s, 6 * s); c.fillRect(x + 3 * s, y - 6 * s, 1.6 * s, 6 * s); }
    else { c.fillStyle = '#222'; c.beginPath(); c.ellipse(x, y - 5 * s, 2.6 * s, 4.2 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + .6 * s, y - 4.5 * s, 1.5 * s, 3 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#f2a33a'; c.fillRect(x + 1.2 * s, y - 8 * s, 2 * s, 1 * s); }
  }
  // A small rotated prism preserves the isometric perspective as vehicles turn.
  function vehicleBox(c, cx, cy, halfLength, halfWidth, z, height, color, roof, angle) {
    const co = Math.cos(angle), si = Math.sin(angle);
    const corners = [[-halfLength, -halfWidth], [halfLength, -halfWidth],
      [halfLength, halfWidth], [-halfLength, halfWidth]]
      .map(([u, v]) => [cx + co * u - si * v, cy + si * u + co * v]);
    const bottom = corners.map(([x, y]) => P(x, y, z));
    const top = corners.map(([x, y]) => P(x, y, z + height));
    const sides = corners.map((p, i) => {
      const j = (i + 1) % 4;
      return {i, j, depth: (corners[i][0] + corners[i][1] + corners[j][0] + corners[j][1]) / 2};
    }).sort((a, b) => a.depth - b.depth);
    c.save(); c.lineJoin = 'round'; c.lineWidth = Math.max(.6, S * .6);
    for (const {i, j, depth} of sides) {
      c.fillStyle = shade(color, depth < cx + cy ? .72 : .83);
      c.beginPath(); c.moveTo(...bottom[i]); c.lineTo(...bottom[j]);
      c.lineTo(...top[j]); c.lineTo(...top[i]); c.closePath(); c.fill();
    }
    c.fillStyle = roof || shade(color, 1.14); c.beginPath();
    c.moveTo(...top[0]); for (const pt of top.slice(1)) c.lineTo(...pt);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.42)'; c.lineWidth = Math.max(.5, .75 * S);
    c.beginPath(); c.moveTo(...top[3]); c.lineTo(...top[2]); c.lineTo(...top[1]); c.stroke();
    c.restore();
  }
  function drawMover(c, m, night) {
    const [ox, oy] = laneOffset(m), mx = m.x + (m.path ? 0 : ox), my = m.y + (m.path ? 0 : oy), [x, y] = P(mx, my, m.lift || 0), s = S;
    // A contact shadow stays on the road while the person, bicycle or car moves above it.
    const [gx, gy] = P(mx, my, 0);
    c.fillStyle = 'rgba(38,52,54,.19)'; c.beginPath();
    c.ellipse(gx + 1.2 * s, gy + 1.5 * s, (m.type === 'car' ? 10 : 3.5) * s, (m.type === 'car' ? 3.3 : 1.4) * s, 0, 0, TAU); c.fill();
    if (m.kind === 'bike') {
      const f = DIRS[m.d], [ax, ay] = P(mx - f[0] * .18, my - f[1] * .18, 3), [bx, by] = P(mx + f[0] * .18, my + f[1] * .18, 3);
      const spin = (m.travel || 0) * 27, pedal = (m.travel || 0) * 20 + (m.ph || 0);
      c.lineCap = 'round'; c.strokeStyle = '#303d49'; c.lineWidth = Math.max(1, 1.05 * s);
      for (const [wx, wy] of [[ax, ay], [bx, by]]) {
        c.beginPath(); c.arc(wx, wy, 3.5 * s, 0, TAU); c.stroke();
        for (let k = 0; k < 3; k++) { const a = spin + k * TAU / 3; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * 3.2 * s, wy + Math.sin(a) * 3.2 * s); c.stroke(); }
      }
      const midX = (ax + bx) / 2, midY = (ay + by) / 2 - 5.3 * s;
      c.strokeStyle = shade(m.col, .85); c.lineWidth = 2 * s; c.beginPath();
      c.moveTo(ax, ay); c.lineTo(midX, midY); c.lineTo(bx, by); c.lineTo(ax, ay);
      c.moveTo(midX, midY); c.lineTo(midX + 2 * s, midY - 2 * s); c.stroke();
      const [rx, ry] = P(mx, my, 12), lean = m.d < 2 ? 1 : -1, leg = Math.sin(pedal) * 2.7 * s;
      c.strokeStyle = '#364451'; c.lineWidth = 2.1 * s; c.beginPath();
      c.moveTo(rx, ry - 1.2 * s); c.lineTo(midX - 1.2 * s, midY + leg);
      c.moveTo(rx, ry - 1.2 * s); c.lineTo(midX + 1.2 * s, midY - leg); c.stroke();
      c.strokeStyle = m.col; c.lineWidth = 4.5 * s; c.beginPath(); c.moveTo(rx - lean * 2 * s, ry - 8 * s); c.lineTo(rx, ry - 1 * s); c.stroke();
      c.strokeStyle = m.skin; c.lineWidth = 1.8 * s; c.beginPath();
      c.moveTo(rx - lean * 1.5 * s, ry - 6 * s); c.lineTo(bx, by - 6 * s); c.stroke();
      c.fillStyle = m.skin; c.beginPath(); c.arc(rx - lean * 2.2 * s, ry - 10 * s, 3 * s, 0, TAU); c.fill();
      c.fillStyle = shade(m.col, .78); c.beginPath(); c.arc(rx - lean * 2.2 * s, ry - 11 * s, 3.2 * s, Math.PI, 0); c.fill();
      c.fillStyle = '#f9f1d9'; c.beginPath(); c.arc(rx - lean * .7 * s, ry - 10 * s, .5 * s, 0, TAU); c.fill();
      return;
    }
    if (m.type === 'car') {
      const along = m.d < 2, len = m.kind === 'bus' ? .42 : m.kind === 'fire' ? .38 : m.kind === 'racer' ? .3 : .26, wid = .14;
      const hx = along ? len : wid, hy = along ? wid : len, hgt = m.kind === 'bus' ? 13 : m.kind === 'racer' ? 4 : 8;
      const angle = Number.isFinite(m.heading) ? m.heading : directionAngle(m.d);
      const co = Math.cos(angle), si = Math.sin(angle);
      c.fillStyle = '#2d3440'; const wheelSpin = (m.travel || 0) * 21;
      for (const k of [-.6, .6]) {
        const [wx, wy] = P(mx + co * len * k - si * (wid + .01), my + si * len * k + co * (wid + .01), (m.lift || 0) + 2);
        c.beginPath(); c.ellipse(wx, wy, 2.5 * s, 2.5 * s, 0, 0, TAU); c.fill();
        c.strokeStyle = '#b7c4ce'; c.lineWidth = .7 * s; c.beginPath(); c.moveTo(wx - Math.cos(wheelSpin) * 1.3 * s, wy - Math.sin(wheelSpin) * 1.3 * s); c.lineTo(wx + Math.cos(wheelSpin) * 1.3 * s, wy + Math.sin(wheelSpin) * 1.3 * s); c.stroke();
      }
      vehicleBox(c, mx, my, len, wid, (m.lift || 0) + 3, hgt, m.col, null, angle);
      if (m.kind !== 'bus' && m.kind !== 'racer')
        vehicleBox(c, mx - co * .05, my - si * .05, len * .55, wid * .88,
          (m.lift || 0) + 3 + hgt, 5, m.col, '#cfe9ff', angle);
      if (m.kind === 'racer') { const t = P(mx, my, hgt + 3); c.fillStyle = '#fff'; c.font = `900 ${5 * s}px system-ui`; c.textAlign = 'center'; c.fillText(String(m.num || 1), t[0], t[1]); }
      if (m.kind === 'bus') { const dest = {sports: 'STADIUM', space: 'LAUNCH SITE', election: 'POLLS', festival: 'FESTIVAL', awards: 'PREMIERE', animals: 'ZOO', market: 'BANK', science: 'LAB', tech: 'EXPO'}[theme] || 'TOWN CENTRE', [tx, ty] = P(mx, my + (along ? hy : 0), hgt * .7); c.fillStyle = '#1d2230'; c.fillRect(tx - 11 * s, ty - 3 * s, 22 * s, 5 * s); c.fillStyle = '#ffb020'; c.font = `800 ${3.6 * s}px system-ui`; c.textAlign = 'center'; c.fillText(dest, tx, ty + .6 * s); }
      if (m.kind === 'taxi') { const t = P(mx, my, (m.lift || 0) + hgt + 9); c.fillStyle = '#222'; c.fillRect(t[0] - 3 * s, t[1] - 2 * s, 6 * s, 2.5 * s); }
      if (m.kind === 'icecream') { const t = P(mx, my, hgt + 13); c.fillStyle = '#f7d9a8'; c.beginPath(); c.moveTo(t[0] - 3 * s, t[1]); c.lineTo(t[0] + 3 * s, t[1]); c.lineTo(t[0], t[1] + 7 * s); c.fill(); c.fillStyle = '#ff8fd0'; c.beginPath(); c.arc(t[0], t[1] - 1 * s, 3.4 * s, 0, TAU); c.fill(); }
      if (m.siren && Math.sin(clock * 14) > 0) { const t = P(mx, my, hgt + 6); c.fillStyle = '#4da3ff'; c.beginPath(); c.arc(t[0], t[1], 2.4 * s, 0, TAU); c.fill(); }
      if (m.ladder) { c.strokeStyle = '#d9d9d9'; c.lineWidth = Math.max(1, 1.6 * s); c.beginPath(); c.moveTo(...P(mx, my, hgt + 3)); c.lineTo(...P(mx, my - 1, 40)); c.stroke(); }
      if (night) { const f = DIRS[m.d], h = P(mx + f[0] * len, my + f[1] * len, 6); c.fillStyle = 'rgba(255,240,170,.9)'; c.beginPath(); c.arc(h[0], h[1], 1.6 * s, 0, TAU); c.fill(); }
      return;
    }
    const moving = (m.v || 0) > .035 && !m.sit && !m.stopUntil || ((m.v || 0) > .035 && !m.sit && clock >= m.stopUntil);
    const phase = (m.travel || 0) * 28 + (m.ph || 0), step = moving ? Math.sin(phase) * Math.min(1, m.v * 2.5) : 0;
    const bob = m.dance ? Math.abs(Math.sin(clock * 7 + (m.ph || 0))) * 3 * s :
      moving ? Math.abs(Math.sin(phase)) * 1.15 * s : (!m.sit ? .15 * Math.sin(clock * .85 + (m.ph || 0)) * s : 0);
    if (m.kind === 'cart') { box(c, mx, my, .12, .12, 3, 6, '#b8c2cc', '#dfe6ee'); return; }
    if (m.kind === 'dog') { c.fillStyle = '#b07a45'; c.beginPath(); c.ellipse(x, y - 4 * s - bob, 4.5 * s, 2.6 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 4 * s * (m.d === 1 || m.d === 3 ? -1 : 1), y - 6.5 * s - bob, 2.2 * s, 0, TAU); c.fill(); c.strokeStyle = '#d95b5b'; c.lineWidth = 1.4 * s; c.beginPath(); c.moveTo(x + 5 * s, y - 6 * s - bob); c.quadraticCurveTo(x + 9 * s, y - 2 * s, x + 12 * s, y - 6 * s); c.stroke(); return; }
    if (m.kind === 'hen') { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - 3.5 * s - bob, 3 * s, 2.4 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#e2463a'; c.fillRect(x + 1.5 * s, y - 7 * s - bob, 1.6 * s, 1.6 * s); return; }
    if (m.kind === 'llama') { c.fillStyle = '#f3ead6'; c.beginPath(); c.ellipse(x, y - 8 * s, 5 * s, 3.5 * s, 0, 0, TAU); c.fill(); c.fillRect(x + 3 * s, y - 18 * s, 2.4 * s, 10 * s); c.beginPath(); c.ellipse(x + 4.5 * s, y - 19 * s, 2.6 * s, 1.8 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#222'; c.fillRect(x + 3 * s, y - 20 * s, 3.5 * s, 1.2 * s); return; }
    if (m.kind === 'penguin') { c.fillStyle = '#222'; c.beginPath(); c.ellipse(x, y - 5 * s, 2.8 * s, 4.4 * s, Math.sin(clock * 6 + m.ph) * .2, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + .6 * s, y - 4.5 * s, 1.6 * s, 3 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#f2a33a'; c.fillRect(x + 1.4 * s, y - 8 * s, 2 * s, 1 * s); return; }
    if (m.kind === 'ghost') { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y - 10 * s - bob, 4 * s, Math.PI, 0); c.lineTo(x + 4 * s, y - 2 * s - bob); for (let k = 0; k < 4; k++) c.lineTo(x + (4 - k * 2.6) * s, y - (k % 2 ? 3.5 : 1.5) * s - bob); c.closePath(); c.fill(); c.fillStyle = '#222'; c.fillRect(x - 2 * s, y - 11 * s - bob, 1.2 * s, 1.6 * s); c.fillRect(x + .8 * s, y - 11 * s - bob, 1.2 * s, 1.6 * s); return; }
    if (m.kind === 'dino') { const g = '#7cc65a'; c.fillStyle = g; c.beginPath(); c.ellipse(x, y - 14 * s - bob, 12 * s, 7 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - 10 * s, y - 14 * s); c.quadraticCurveTo(x - 22 * s, y - 12 * s, x - 26 * s, y - 6 * s); c.lineTo(x - 9 * s, y - 10 * s); c.fill(); c.beginPath(); c.moveTo(x + 6 * s, y - 18 * s); c.quadraticCurveTo(x + 10 * s, y - 34 * s, x + 14 * s, y - 36 * s); c.lineTo(x + 18 * s, y - 34 * s); c.quadraticCurveTo(x + 12 * s, y - 26 * s, x + 11 * s, y - 15 * s); c.fill(); c.beginPath(); c.ellipse(x + 17 * s, y - 37 * s, 5 * s, 3.4 * s, 0, 0, TAU); c.fill(); c.fillRect(x - 6 * s, y - 9 * s, 3.5 * s, 9 * s); c.fillRect(x + 3 * s, y - 9 * s, 3.5 * s, 9 * s); c.fillStyle = '#222'; c.beginPath(); c.arc(x + 18.5 * s, y - 38 * s, .9 * s, 0, TAU); c.fill(); c.fillStyle = '#4f9e4a'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x - 6 * s + k * 4 * s, y - 20 * s, 1.6 * s, 0, TAU); c.fill(); } return; }
    const slip = m.slip && clock - m.slip < 2.5, body = m.kind === 'robot' ? '#c0c8d4' : m.kind === 'runner' ? '#ffffff' : m.kind === 'band' ? '#d9533e' : m.col;
    c.save(); c.translate(x, y - bob + (m.sit ? 3 * s : 0));
    const facing = m.d === 0 || m.d === 3 ? 1 : -1; c.scale(facing, 1);
    if (slip) c.rotate(Math.PI / 2 * Math.min(1, (clock - m.slip) * 4));
    // Opposite arm/leg swing; the planted shoe compensates for the body's vertical bob.
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const stride = side * step, toeX = (side * 1.25 + stride * 2.5) * s;
      const lift = Math.max(0, stride) * 1.9 * s;
      c.strokeStyle = '#405068'; c.lineWidth = 1.75 * s; c.beginPath();
      c.moveTo(side * 1.1 * s, -3.4 * s);
      c.lineTo((side * 1.15 + stride * .6) * s, -1.35 * s);
      c.lineTo(toeX, bob - .85 * s - lift); c.stroke();
      c.strokeStyle = '#253647'; c.lineWidth = 2 * s; c.beginPath();
      c.moveTo(toeX - .5 * s, bob - .6 * s - lift); c.lineTo(toeX + 1.15 * s, bob - .6 * s - lift); c.stroke();
      c.strokeStyle = m.kind === 'robot' ? '#9aa6b5' : shade(body.startsWith('#') ? body : '#cccccc', .78);
      c.lineWidth = 1.55 * s; c.beginPath(); c.moveTo(side * 2.15 * s, -8 * s);
      c.lineTo((side * 3.3 - stride * 1.5) * s, -5.8 * s); c.stroke();
      c.fillStyle = m.kind === 'robot' ? '#bdc7d3' : m.skin;
      c.beginPath(); c.arc((side * 3.3 - stride * 1.5) * s, -5.8 * s, .8 * s, 0, TAU); c.fill();
    }
    if (m.bag && m.kind !== 'robot') {
      c.fillStyle = '#7e634b'; c.beginPath(); c.roundRect(-3.7 * s, -8.7 * s, 3.5 * s, 5.2 * s, 1.3 * s); c.fill();
      c.strokeStyle = '#c6a57a'; c.lineWidth = .75 * s; c.beginPath();
      c.moveTo(-2.2 * s, -8.2 * s); c.lineTo(-2.2 * s, -4.3 * s); c.stroke();
    }
    { const g = c.createLinearGradient(-2.4 * s, 0, 2.4 * s, 0);
      g.addColorStop(0, shade(body.startsWith('#') ? body : '#cccccc', 1.12));
      g.addColorStop(1, shade(body.startsWith('#') ? body : '#cccccc', .8));
      c.fillStyle = g; c.beginPath(); c.roundRect(-2.4 * s, -9.5 * s, 4.8 * s, 7.6 * s, 2.2 * s); c.fill();
      c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-1.7 * s, -8.6 * s, .55 * s, 4.7 * s);
    }
    { const hc = m.kind === 'robot' ? '#9aa6b5' : m.skin,
      g = c.createRadialGradient(-1 * s, -12.5 * s, .3 * s, 0, -11.5 * s, 2.8 * s);
      g.addColorStop(0, shade(hc, 1.18)); g.addColorStop(1, shade(hc, .85));
      c.fillStyle = g; c.beginPath(); c.arc(0, -11.8 * s, 2.8 * s, 0, TAU); c.fill();
      if (m.kind !== 'robot') { // A small hairline, face and nose make each pedestrian legible.
        c.fillStyle = m.hair || '#514034'; c.beginPath(); c.arc(-.25 * s, -12.7 * s, 2.8 * s, Math.PI * 1.08, Math.PI * 1.93); c.fill();
        c.fillStyle = '#2d3440'; c.beginPath(); c.arc(1.45 * s, -11.9 * s, .43 * s, 0, TAU); c.fill();
        c.fillStyle = shade(hc, .85); c.beginPath(); c.arc(2.3 * s, -10.85 * s, .65 * s, 0, TAU); c.fill();
      }
    }
    if (m.scarf && m.kind !== 'robot') {
      c.fillStyle = '#f4c661'; c.beginPath(); c.roundRect(-2.5 * s, -9.4 * s, 5 * s, 1.6 * s, .6 * s); c.fill();
      c.fillRect(-1.1 * s, -8.5 * s, 1.2 * s, 3.1 * s);
    }
    if (m.hat && m.kind !== 'chef' && m.kind !== 'newsie') {
      c.fillStyle = m.hat === 'beanie' ? '#9b6ed3' : '#387ea6';
      c.beginPath(); c.ellipse(-.3 * s, -14.3 * s, 3.3 * s, m.hat === 'beanie' ? 2.6 * s : 1.8 * s, 0, Math.PI, TAU); c.fill();
      if (m.hat === 'cap') c.fillRect(1.2 * s, -14.1 * s, 3.1 * s, .9 * s);
    }
    if (m.waveUntil && clock < m.waveUntil) {
      c.strokeStyle = m.skin || '#d8a77c'; c.lineWidth = 1.5 * s; c.beginPath();
      c.moveTo(2.1 * s, -8 * s); c.lineTo(5.5 * s, -12.5 * s - Math.sin(clock * 10) * s); c.stroke();
    }
    if (m.kind === 'chef') { c.fillStyle = '#fff'; c.fillRect(-2.4 * s, -16.5 * s, 4.8 * s, 3.5 * s); }
    if (m.kind === 'robot') { c.fillStyle = '#ff5d5d'; c.fillRect(-.6 * s, -16 * s, 1.2 * s, 2.4 * s); }
    if (m.kind === 'newsie') { c.fillStyle = '#e9dcc0'; c.fillRect(1.5 * s, -7 * s, 4 * s, 5 * s); c.fillStyle = '#2d3440'; c.fillRect(2 * s, -6 * s, 3 * s, .6 * s); c.fillRect(2 * s, -4.8 * s, 3 * s, .6 * s); c.fillStyle = '#3f78c9'; c.beginPath(); c.arc(0, -13.5 * s, 2.8 * s, Math.PI, 0); c.fill(); }
    if (m.kind === 'sweeper') { c.strokeStyle = '#8a6f55'; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(2 * s, -8 * s); c.lineTo(5 * s + Math.sin(clock * 4) * 2 * s, 0); c.stroke(); }
    if (m.can) { c.fillStyle = '#5b8fd6'; c.fillRect(2 * s, -6 * s, 3.4 * s, 3 * s); }
    if (m.brush) { c.strokeStyle = '#7a5235'; c.lineWidth = s; c.beginPath(); c.moveTo(2 * s, -7 * s); c.lineTo(5 * s, -9 * s + Math.sin(clock * 3) * s); c.stroke(); }
    if (m.book) { c.fillStyle = '#d0543a'; c.fillRect(-2.5 * s, -9 * s, 5 * s, 3 * s); }
    if (m.kind === 'runner') { c.fillStyle = '#d0543a'; c.font = `800 ${3.6 * s}px system-ui`; c.textAlign = 'center'; c.fillText(String(7 + (m.ph * 10 | 0) % 90), 0, -5 * s); }
    if (m.kind === 'band') { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(2 * s, -8 * s); c.lineTo(7 * s, -11 * s); c.lineTo(7 * s, -5 * s); c.closePath(); c.fill(); c.fillStyle = '#2d3440'; c.fillRect(-2.6 * s, -16.5 * s, 5.2 * s, 3 * s); }
    if (m.guitar) { c.fillStyle = '#b5652d'; c.beginPath(); c.ellipse(2.5 * s, -5 * s, 2.6 * s, 2 * s, -.6, 0, TAU); c.fill(); c.fillRect(3 * s, -10 * s, 1 * s, 5 * s); }
    if (m.phone) { c.fillStyle = '#2d3440'; c.fillRect(1.6 * s, -10 * s, 2 * s, 3 * s); c.fillStyle = 'rgba(160,220,255,.9)'; c.fillRect(1.9 * s, -9.7 * s, 1.4 * s, 2.2 * s); }
    if (m.umbrella) { c.fillStyle = m.col; c.beginPath(); c.arc(0, -15 * s, 7 * s, Math.PI, 0); c.fill(); }
    if (m.sign) { c.fillStyle = '#fff'; c.fillRect(-7 * s, -27 * s, 14 * s, 7 * s); c.fillStyle = '#d0543a'; c.font = `800 ${Math.max(5, 5 * s)}px system-ui`; c.textAlign = 'center'; c.fillText(m.sign, 0, -22 * s); c.fillStyle = '#7a5235'; c.fillRect(-.5 * s, -20 * s, 1 * s, 8 * s); }
    c.restore();
  }
  function drawBubble(c, b) {
    const w = b.who, [x, y] = w.type ? P(w.x + (w.path ? 0 : laneOffset(w)[0]), w.y + (w.path ? 0 : laneOffset(w)[1]), (w.type === 'car' ? 20 : 26) + (w.lift || 0)) : P(w.x, w.y, w.z || 20);
    const fs = Math.max(11, 10 * S), a = Math.min(1, (b.until - clock) * 3);
    c.save(); c.globalAlpha = a; c.font = `800 ${fs}px system-ui`; const tw = c.measureText(b.text).width, bw = tw + fs, bh = fs * 1.7;
    c.fillStyle = '#fff'; c.strokeStyle = '#2d3440'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x - bw / 2, y - bh - 6, bw, bh, bh / 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 4, y - 7); c.lineTo(x, y); c.lineTo(x + 4, y - 7); c.fill();
    c.fillStyle = '#2d3440'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.text, x, y - bh / 2 - 6); c.restore();
  }
  function drawEventExtras(c, e, push) {
    if (e.balloons) for (const q of e.balloons) push(q.x + q.y + 1, () => { const [x, y] = P(q.x, q.y, q.z); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 8 * S); c.stroke(); c.fillStyle = q.col; c.beginPath(); c.ellipse(x, y - 4 * S, 3.6 * S, 4.6 * S, 0, 0, TAU); c.fill(); });
    if (e.cat && !e.cat.down) push(e.cat.b.x + e.cat.b.y + 1.1, () => { const [x, y] = P(e.cat.b.x + .5, e.cat.b.y + .5, e.cat.z + 8); c.fillStyle = '#ff9c3a'; c.beginPath(); c.ellipse(x, y, 4 * S, 2.6 * S, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 3.5 * S, y - 3 * S, 2.4 * S, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x + 2 * S, y - 4.5 * S); c.lineTo(x + 2.6 * S, y - 7 * S); c.lineTo(x + 3.6 * S, y - 5 * S); c.moveTo(x + 4 * S, y - 5 * S); c.lineTo(x + 5 * S, y - 7 * S); c.lineTo(x + 5.6 * S, y - 4.5 * S); c.fill(); });
    if (e.flock) for (const f of e.flock) push(f.x + f.y + .5, () => { const [x, y] = P(f.x, f.y, f.z + 2); c.fillStyle = '#8b8f9a'; c.beginPath(); c.ellipse(x, y, 2.6 * S, 1.6 * S, 0, 0, TAU); c.fill(); c.strokeStyle = '#8b8f9a'; c.lineWidth = S; if (f.z > 4) { const w = Math.sin(clock * 20 + f.x) * 3 * S; c.beginPath(); c.moveTo(x - 4 * S, y - w); c.lineTo(x, y); c.lineTo(x + 4 * S, y - w); c.stroke(); } });
    if (e.ufo) push(e.x + e.y + 3, () => { const [x, y] = P(e.x, e.y, e.ufo.z); if (e.t > 2.5 && e.t < 9.5) { c.fillStyle = 'rgba(180,255,170,.28)'; c.beginPath(); const g = P(e.x, e.y); c.moveTo(x - 6 * S, y); c.lineTo(x + 6 * S, y); c.lineTo(g[0] + 14 * S, g[1]); c.lineTo(g[0] - 14 * S, g[1]); c.closePath(); c.fill(); } c.fillStyle = '#9aa6b5'; c.beginPath(); c.ellipse(x, y, 16 * S, 5 * S, 0, 0, TAU); c.fill(); c.fillStyle = '#aef0ff'; c.beginPath(); c.ellipse(x, y - 4 * S, 7 * S, 5 * S, 0, Math.PI, 0); c.fill(); for (let k = 0; k < 5; k++) { c.fillStyle = Math.sin(clock * 10 + k) > 0 ? '#ffd23f' : '#ff5d5d'; c.beginPath(); c.arc(x - 12 * S + k * 6 * S, y + 1 * S, 1.3 * S, 0, TAU); c.fill(); } });
    if (e.banner) push(e.x + e.y + 4, () => { const [x, y] = P(e.x, e.y, 46), fs = Math.max(9, 8.5 * S), wave = Math.sin(clock * 2) * 2 * S; c.save(); c.font = `900 ${fs}px system-ui`; const w = c.measureText(e.banner).width + fs * 1.6, h = fs * 1.8; c.strokeStyle = '#7a5235'; c.lineWidth = Math.max(1, 1.4 * S); c.beginPath(); c.moveTo(x - w / 2, y - h); c.lineTo(x - w / 2, y + 26 * S); c.moveTo(x + w / 2, y - h); c.lineTo(x + w / 2, y + 26 * S); c.stroke(); c.fillStyle = '#fff6dc'; c.beginPath(); c.moveTo(x - w / 2, y - h); c.quadraticCurveTo(x, y - h + wave, x + w / 2, y - h); c.lineTo(x + w / 2, y); c.quadraticCurveTo(x, y + wave + 4 * S, x - w / 2, y); c.closePath(); c.fill(); c.strokeStyle = '#d0543a'; c.lineWidth = Math.max(1, 1.2 * S); c.stroke(); c.fillStyle = '#d0543a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e.banner, x, y - h / 2 + wave * .4); c.restore(); });
    if (e.sky) push(e.sky.x + e.sky.y + 40, () => { const q = e.sky, [x, y] = P(q.x, q.y, q.z), s = S;
      if (q.kind === 'hotair') { const cols = ['#e2463a', '#ffd23f', '#3f8fd6']; for (let k = 0; k < 3; k++) { c.fillStyle = cols[k]; c.beginPath(); c.ellipse(x, y - 22 * s, (14 - k * 4.5) * s, 17 * s, 0, 0, TAU); c.fill(); } c.strokeStyle = '#6b4a2b'; c.lineWidth = s; c.beginPath(); c.moveTo(x - 8 * s, y - 10 * s); c.lineTo(x - 4 * s, y); c.moveTo(x + 8 * s, y - 10 * s); c.lineTo(x + 4 * s, y); c.stroke(); c.fillStyle = '#a8784a'; c.fillRect(x - 4 * s, y, 8 * s, 5 * s); }
      else if (q.kind === 'plane') {
        c.fillStyle = '#f2f2f2'; c.beginPath(); c.ellipse(x, y, 11 * s, 3 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#d9533e'; c.beginPath(); c.moveTo(x - 3 * s, y); c.lineTo(x - 9 * s, y + 9 * s); c.lineTo(x - 5 * s, y + 9 * s); c.lineTo(x + 2 * s, y); c.fill(); c.fillRect(x - 12 * s, y - 6 * s, 3 * s, 6 * s); c.fillStyle = '#9cc7ef'; c.fillRect(x + 4 * s, y - 2.2 * s, 3.4 * s, 1.6 * s);
        if (e.towed) { const fs = Math.max(10, 9 * s); c.font = `800 ${fs}px system-ui`; const tw = c.measureText(e.towed).width + fs, bx0 = x - 26 * s - tw, wave = Math.sin(clock * 3) * 2 * s; c.strokeStyle = 'rgba(60,60,60,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 11 * s, y); c.lineTo(bx0 + tw, y + wave); c.stroke(); c.fillStyle = '#fffaf0'; c.beginPath(); c.moveTo(bx0, y - fs * .8); c.quadraticCurveTo(bx0 + tw / 2, y - fs * .8 + wave, bx0 + tw, y - fs * .8); c.lineTo(bx0 + tw, y + fs * .8); c.quadraticCurveTo(bx0 + tw / 2, y + fs * .8 + wave, bx0, y + fs * .8); c.closePath(); c.fill(); c.strokeStyle = '#d0543a'; c.stroke(); c.fillStyle = '#d0543a'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e.towed, bx0 + tw / 2, y + wave * .5); }
      }
      else if (q.kind === 'comet') { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 4 * s, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x, y, 9 * s, 0, TAU); c.fill(); }
      else if (q.kind === 'sleigh') { c.fillStyle = '#d9533e'; c.beginPath(); c.moveTo(x - 8 * s, y - 6 * s); c.lineTo(x + 6 * s, y - 6 * s); c.lineTo(x + 8 * s, y); c.lineTo(x - 10 * s, y); c.closePath(); c.fill(); c.strokeStyle = '#ffd23f'; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(x - 11 * s, y + 2 * s); c.lineTo(x + 9 * s, y + 2 * s); c.stroke(); c.fillStyle = '#d9533e'; c.beginPath(); c.arc(x - 2 * s, y - 10 * s, 3.4 * s, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 2 * s, y - 7.6 * s, 2.4 * s, 0, Math.PI); c.fill(); for (let k = 1; k <= 3; k++) { c.fillStyle = '#9b6a3e'; c.beginPath(); c.ellipse(x + (6 + k * 9) * s, y - (4 + Math.sin(clock * 6 + k) * 2) * s, 4 * s, 2.2 * s, 0, 0, TAU); c.fill(); } } });
    if (e.lanterns) for (const l of e.lanterns) push(l.x + l.y + 30, () => { const [x, y] = P(l.x, l.y, l.z); c.fillStyle = 'rgba(255,170,60,.3)'; c.beginPath(); c.arc(x, y, 7 * S, 0, TAU); c.fill(); c.fillStyle = '#ffb347'; c.fillRect(x - 2.5 * S, y - 3.5 * S, 5 * S, 7 * S); });
    if (e.bats) for (const b of e.bats) push(b.x + b.y + 20, () => { const [x, y] = P(b.x, b.y, b.z), w = Math.sin(clock * 18 + b.ph) * 3 * S; c.fillStyle = '#2d2a3a'; c.beginPath(); c.moveTo(x - 6 * S, y - w); c.lineTo(x - 2 * S, y); c.lineTo(x, y - 2 * S); c.lineTo(x + 2 * S, y); c.lineTo(x + 6 * S, y - w); c.lineTo(x, y + 2 * S); c.closePath(); c.fill(); });
    if (e.whale) push(e.x + 13.9 + .5, () => { const [x, y] = P(e.x, 13.9, 0), s = S * 2.6; c.fillStyle = '#3f5f8a'; c.beginPath(); c.ellipse(x, y - 2 * s, 10 * s, 4 * s, 0, Math.PI, 0); c.fill(); c.beginPath(); c.moveTo(x - 9 * s, y - 2 * s); c.lineTo(x - 15 * s, y - 7 * s); c.lineTo(x - 13 * s, y - 1 * s); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 6 * s, y - 3.6 * s, .8 * s, 0, TAU); c.fill(); });
    if (e.hat) push(e.hat.x + e.hat.y + 1, () => { const [x, y] = P(e.hat.x, e.hat.y, e.hat.z); c.fillStyle = '#3b3f4a'; c.beginPath(); c.ellipse(x, y, 5 * S, 1.6 * S, Math.sin(clock * 5) * .4, 0, TAU); c.fill(); c.fillRect(x - 2.6 * S, y - 5 * S, 5.2 * S, 5 * S); });
    if (e.ball) push(e.ball.x + e.ball.y + 2, () => { const [x, y] = P(e.ball.x, e.ball.y, e.ball.z); c.fillStyle = '#c23b2b'; c.beginPath(); c.arc(x, y, 2.4 * S, 0, TAU); c.fill(); });
    if (e.glow) push(e.x + e.y + .5, () => { const [x, y] = P(e.x, e.y, 10), g = c.createRadialGradient(x, y, 0, x, y, 40 * S); g.addColorStop(0, 'rgba(255,200,90,.35)'); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.fillRect(x - 40 * S, y - 40 * S, 80 * S, 80 * S); });
    if (e.kite && e.kite.kid) push(e.kite.kid.x + e.kite.kid.y + 30, () => { const k = e.kite.kid, [hx, hy] = P(k.x, k.y, 12), t = clock * .8 + e.kite.ph, [kx, ky] = P(k.x + 1.2 + Math.sin(t) * .3, k.y - 1.6 + Math.cos(t * 1.3) * .2, 90 + Math.sin(t * 1.7) * 8); c.strokeStyle = 'rgba(60,60,60,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, hy); c.quadraticCurveTo((hx + kx) / 2, (hy + ky) / 2 + 20 * S, kx, ky); c.stroke(); c.fillStyle = '#e2463a'; c.beginPath(); c.moveTo(kx, ky - 7 * S); c.lineTo(kx + 5 * S, ky); c.lineTo(kx, ky + 8 * S); c.lineTo(kx - 5 * S, ky); c.closePath(); c.fill(); c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(kx, ky - 7 * S); c.lineTo(kx + 5 * S, ky); c.lineTo(kx, ky); c.closePath(); c.fill(); c.strokeStyle = '#3f8fd6'; c.beginPath(); c.moveTo(kx, ky + 8 * S); for (let j = 1; j < 5; j++) c.lineTo(kx + Math.sin(t * 3 + j) * 3 * S, ky + 8 * S + j * 4 * S); c.stroke(); });
    if (e.flies) for (const f of e.flies) push(e.x + e.y + 1.5, () => { const a = clock * .6 + f.ph, [x, y] = P(e.x + Math.cos(a) * 1.2, e.y + Math.sin(a * 1.3) * 1.2, 14 + Math.sin(a * 2) * 6), w = Math.abs(Math.sin(clock * 9 + f.ph)) * 3 * S + .6 * S; c.fillStyle = f.c; c.beginPath(); c.ellipse(x - w * .6, y, w, 2.4 * S, -.4, 0, TAU); c.ellipse(x + w * .6, y, w, 2.4 * S, .4, 0, TAU); c.fill(); });
    if (e.nap) push(e.nap.b.x + e.nap.b.y + 1.1, () => { const [x, y] = P(e.nap.b.x + .5, e.nap.b.y + .5, e.nap.z + 4), br = 1 + Math.sin(clock * 1.2) * .06; c.fillStyle = '#ff9c3a'; c.beginPath(); c.ellipse(x, y, 5 * S * br, 2.8 * S * br, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 4.5 * S, y - 1 * S, 2.4 * S, 0, TAU); c.fill(); c.strokeStyle = '#ff9c3a'; c.lineWidth = 1.6 * S; c.beginPath(); c.moveTo(x - 5 * S, y); c.quadraticCurveTo(x - 9 * S, y + 2 * S, x - 6 * S, y + 4 * S); c.stroke(); c.fillStyle = 'rgba(45,52,64,.7)'; c.font = `700 ${7 * S}px system-ui`; c.fillText('z', x + 8 * S, y - 8 * S - (clock % 2) * 4 * S); c.fillText('z', x + 12 * S, y - 14 * S - ((clock + 1) % 2) * 4 * S); });
    if (e.bigduck) push(e.x + 13.9 + .5, () => { const [x, y] = P(e.x, 13.9, 0), s = S * 3.2; c.fillStyle = '#ffd23f'; c.beginPath(); c.ellipse(x, y - 4 * s, 7 * s, 4 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 5 * s, y - 9 * s, 3.6 * s, 0, TAU); c.fill(); c.fillStyle = '#ff8a3d'; c.beginPath(); c.ellipse(x + 9 * s, y - 8.5 * s, 2 * s, 1 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(x + 6 * s, y - 10 * s, .7 * s, 0, TAU); c.fill(); });
    if (e.drones) for (const d of e.drones) push(d.x + d.y + 2, () => { const [x, y] = P(d.x, d.y, d.z); c.fillStyle = '#3b3f4a'; c.fillRect(x - 6 * S, y - 1 * S, 12 * S, 2 * S); c.fillStyle = 'rgba(200,210,220,.7)'; for (const k of [-6, 6]) { c.beginPath(); c.ellipse(x + k * S, y - 2 * S, 3 * S, .8 * S, 0, 0, TAU); c.fill(); } if (d.box) { c.fillStyle = '#c79a5a'; c.fillRect(x - 2.5 * S, y + 1 * S, 5 * S, 4 * S); } });
  }

  /* ---------------- frame ---------------- */
  function layout() {
    zoomAnchor = null;
    dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const fit = Math.min(W / (N * TW * 2 + 60), H / (N * TH * 2 + 200));
    base = innerWidth < 700 ? Math.max(fit, (W / (9 * TW * 2))) : fit;   // phones start closer for legibility
    fitZoom = clamp(MIN_ZOOM, fit / base, 1);  // "Fit" shows the whole city, even on a narrow phone
    sprites.clear(); ground = null;
  }
  // A five-minute day in real time, though moving things run at 60% speed.
  function nightLevel() { return clamp(0, -Math.cos(clock / (300 * PACE) * TAU) * 2 - 1, 1); }
  // Neighbours notice each other: when two walkers pass close by on the same
  // pavement they stop for a few seconds of real chat (stride clock frozen,
  // looking at each other), then both carry on. Never near a crossing or across a road.
  function passingGreetings() {
    // Finish real, stationary conversations before looking for new ones.
    // A greeting is never a stationary walking loop; the stride clock stays
    // frozen while both people look at one another and gesture.
    for(const m of movers)if(m.briefChatUntil&&clock>=m.briefChatUntil){
      if(m.intent==='chat'){
        m.intent='walking';m.attention=null;
        if((m.stopUntil||0)<=clock)m.stopUntil=0;
      }
      m.busy=false;m.briefChatUntil=0;
    }
    if(movers.filter(m=>m.briefChatUntil>clock).length>=4)return;
    const walkers=movers.filter(m=>freeWalker(m)&&m.max>.05&&
      (m.v||0)>.06&&clock>=(m.greetNext||0));
    const nearCrossing=m=>LINES.some(l=>
      Math.abs((m.d<2?m.x:m.y)-(l+.5))<.65);
    for(let i=0;i<walkers.length;i++)for(let j=i+1;j<walkers.length;j++){
      const a=walkers[i],b=walkers[j];
      // Compare *drawn pavement coordinates*, not road-centre values.
      // A wave across the road should not freeze two people meters apart.
      if((a.d<2)!==(b.d<2)||nearCrossing(a)||nearCrossing(b))continue;
      const pa=vehiclePoint(a),pb=vehiclePoint(b);
      const gap=Math.hypot(pa.x-pb.x,pa.y-pb.y);
      if(gap<.25||gap>.58)continue;
      const across=a.d<2?Math.abs(pa.y-pb.y):Math.abs(pa.x-pb.x);
      if(across>.17)continue; // same sidewalk, not opposite pavements
      const until=clock+2.4+Math.random()*1.2;
      a.greetNext=b.greetNext=clock+32+Math.random()*20;
      for(const [m,other] of [[a,b],[b,a]]){
        m.briefChatUntil=until;m.stopUntil=until;
        m.intent='chat';m.attention={x:other.x,y:other.y};
        m.busy=true;m.v=0;m.moved=0;
      }
      (Math.random()<.5?a:b).waveUntil=clock+1.1;
      greetings++;
      return; // a quiet, readable encounter, not a crowded synchronized chorus
    }
  }
  let greetings = 0;
  /* Whims: now and then a free walker does something of their own instead of
     just walking the pavement: sits on a bench, visits the fountain (and may
     toss a coin), wanders into the park to look around, stops for a chat with a
     passer-by, or breaks into a jog. Afterwards they walk back to the street. */
  let feedings = 0, shopBags = 0;
  let whims = {bench: 0, fountain: 0, park: 0, chat: 0, jog: 0, gather: 0, ducks: 0, shop: 0};
  const freeWalker = m => m.type === 'person' && !m.kind && !m.heroResident && !m.shopRole && !m.routine && !m.path && !m.busy && !m.sit && !(m.stopUntil && clock < m.stopUntil);
  const nearestRoad = (x, y) => { const lx = LINES.reduce((a, l) => Math.abs(l + .5 - x) < Math.abs(a - x) ? l + .5 : a, LINES[0] + .5), ly = LINES.reduce((a, l) => Math.abs(l + .5 - y) < Math.abs(a - y) ? l + .5 : a, LINES[0] + .5);
    return Math.abs(lx - x) < Math.abs(ly - y) ? {x: lx, y: clamp(1.6, y, 16.4), d: Math.random() < .5 ? 2 : 3} : {x: clamp(1.6, x, 16.4), y: ly, d: Math.random() < .5 ? 0 : 1}; };
  function whimTo(m, x, y, dwell, onArrive, kind) {
    m.busy = true; m.whim = kind; whims[kind]++;
    m.path = walkFrom(m, x, y, m.max).concat([{x, y, speed: Math.min(.45, m.max), then: q => { q.stopUntil = clock + dwell; q.whimUntil = clock + dwell; if (onArrive) onArrive(q); }}]);
  }
  function endWhim(m) {
    m.sit = false; m.attention = null; m.intent = 'walking'; m.whimUntil = 0; m.whim = null;
    const r = nearestRoad(m.x, m.y), vertical = r.d >= 2, side = vertical ? (m.x >= r.x ? 1 : -1) : (m.y >= r.y ? 1 : -1);
    const px = vertical ? r.x + side * PAVE : r.x, py = vertical ? r.y : r.y + side * PAVE;
    // Arrive on the pavement, then continue as an ordinary walker on that side (drawn at centre + lane).
    m.path = [{x: px, y: py, speed: .4, then: q => { q.busy = false; q.d = r.d; q.x = r.x; q.y = r.y; q.lane = vertical ? -side * PAVE : side * PAVE; }}];
  }
  function updateWhims() {
    // Duck feeders toss a handful of crumbs every few seconds; the ducks swim over.
    for (const m of movers) if (m.feedUntil) {
      if (clock >= m.feedUntil || (m.path && m.path.length)) { m.feedUntil = 0; continue; }
      if (clock >= m.feedNext) { m.feedNext = clock + 2.6 + Math.random() * 1.4; m.tossAt = clock; m.waveUntil = clock + .9; feedDucks(m.x, 14); feedings++; }
    }
    for (const m of movers) if (m.whimUntil && clock > m.whimUntil && !m.path) endWhim(m);
    for (const m of movers) if (m.shopBag >= 0 && clock > (m.bagUntil || 0)) m.shopBag = -1;
    for (const m of movers) if (m.jogUntil && clock > m.jogUntil) { m.max = m.walkMax || m.max; m.gait = m.walkGait || m.gait; m.jogUntil = 0; }
    if (clock < (updateWhims.next || 0)) return;
    updateWhims.next = clock + 1.5 + Math.random() * 2.5;
    const free = movers.filter(freeWalker); if (!free.length || movers.filter(m => m.whim).length >= 5) return;
    const m = free[Math.random() * free.length | 0], roll = Math.random();
    const benches = props.filter(p => p.kind === 'bench' || p.kind === 'hero-bench').filter(p => Math.hypot(p.x - m.x, p.y - m.y) < 5);
    const fountain = props.find(p => p.kind === 'fountain' && Math.hypot(p.x - m.x, p.y - m.y) < 6);
    // Someone near the river walks to the bank and tosses crumbs to the ducks.
    const bankY = m.y < 14 ? 12.84 : 15.16;
    if (roll > .93 && Math.abs(m.y - bankY) < 4.5 && !movers.some(o => o.whim === 'ducks')) {
      const bx = clearOfBridges(clamp(1.5, m.x + (Math.random() - .5) * 2, 16.5)), dur = 8 + Math.random() * 6;
      whimTo(m, bx, bankY, dur, q => { q.attention = {x: bx, y: 14}; q.feedUntil = clock + dur; q.feedNext = clock + 1; }, 'ducks');
      return;
    }
    if (roll < .22 && benches.length) { const b = benches[Math.random() * benches.length | 0]; whimTo(m, b.x, b.y + .05, 7 + Math.random() * 8, q => { q.sit = true; }, 'bench'); }
    else if (roll < .38 && fountain) { const a = Math.random() * TAU; whimTo(m, fountain.x + Math.cos(a) * .7, fountain.y + Math.sin(a) * .7, 5 + Math.random() * 3, q => { q.attention = {x: fountain.x, y: fountain.y}; if (Math.random() < .4) { q.cheerUntil = clock + 1; say(q, 'Make a wish!', 2); } }, 'fountain'); }
    else if (roll < .55) { const spots = []; for (let y = 2; y < 16; y++) for (let x = 2; x < 16; x++) if (tile(x, y) && tile(x, y).kind === 'park' && !tile(x, y).used) spots.push([x + .3 + Math.random() * .4, y + .3 + Math.random() * .4]);
      const near = spots.filter(([x, y]) => Math.hypot(x - m.x, y - m.y) < 5); if (near.length) { const [x, y] = near[Math.random() * near.length | 0]; whimTo(m, x, y, 3 + Math.random() * 4, q => { q.lookAt = {x: x + Math.random() * 2 - 1, y: y + Math.random() * 2 - 1}; q.lookUntil = clock + 4; }, 'park'); } }
    else if (roll < .78) { const o = free.find(o => o !== m && Math.hypot(o.x - m.x, o.y - m.y) < 1.4);
      if (o) { const dur = 6 + Math.random() * 4; for (const [a, b] of [[m, o], [o, m]]) { a.stopUntil = clock + dur; a.whimUntil = clock + dur; a.whim = 'chat'; a.busy = true; a.intent = 'chat'; a.attention = {x: b.x, y: b.y}; }
        m.waveUntil = clock + 1.2; whims.chat++; } }
    else if (roll < .9) {   // a shopping trip: walk to a shopfront, look in, and come away carrying a paper bag for a while
      const shops = buildings.filter(b => b.kind === 'shop' && Math.hypot(b.x + .5 - m.x, b.y + .5 - m.y) < 6);
      if (shops.length && !(m.shopBag >= 0)) {
        const b = shops[Math.random() * shops.length | 0];
        whimTo(m, b.x + .5, b.y + 1.38, 2.5 + Math.random() * 2, q => { q.attention = {x: b.x + .5, y: b.y + .5}; q.shopBag = (b.x * 3 + b.y * 5 + shopBags++) % 6; q.bagUntil = clock + 70 + Math.random() * 70; }, 'shop');
      }
    }
    else if (!m.jogUntil) { m.walkMax = m.max; m.walkGait = m.gait; m.max = .95; m.gait = 'brisk'; m.jogUntil = clock + 10 + Math.random() * 8; whims.jog++; }
  }
  // A tap on open ground in 3D: the nearest few walkers come over to see.
  function gather(x, y) {
    const near = movers.filter(freeWalker).map(m => [m, Math.hypot(m.x - x, m.y - y)]).filter(([, d]) => d < 3.6).sort((a, b) => a[1] - b[1]).slice(0, 4);
    near.forEach(([m], i) => { const a = i * TAU / 4 + .6; whimTo(m, x + Math.cos(a) * .55, y + Math.sin(a) * .55, 4.5, q => { q.attention = {x, y}; q.cheerUntil = clock + 1.4; }, 'gather'); });
    return near.length;
  }
  /* Nobody stays stuck. A mover that has not moved for a while although its
     own light is green (or there is no light to wait for) first runs out of
     patience and stops yielding for a moment; if that does not free it, it
     turns round; and if it is still stuck it leaves town, and a fresh car or
     walker arrives in its place. Deliberate stops never count. */
  let unstuck = {patience: 0, turned: 0, left: 0};
  function unstick(dt) {
    const phase = lightPhase();
    for (const m of movers.slice()) {
      if (m.path || m.max === 0 || m.sit || m.shopRole || m.heroResident || (m.yieldUntil && clock < m.yieldUntil) || (m.stopUntil && clock < m.stopUntil) || clock < (m.observeUntil || 0)) { m.stuckT = 0; continue; }
      if (m.type !== 'car' && m.type !== 'person') continue;
      const axis = m.d < 2 ? 'x' : 'y', red = phase.green !== axis || phase.amber;
      const nearLight = LINES.some(l => { const d = ((l + .5) - (m.d < 2 ? m.x : m.y)) * (m.d === 0 || m.d === 2 ? 1 : -1); return d > 0 && d < 1; });
      // Only the front of a queue counts: the ones behind simply wait their turn.
      const [qx, qy] = DIRS[m.d], reach = m.type === 'car' ? 1.0 : .45;
      const queued = movers.some(o => o !== m && o.type === m.type && o.d === m.d && !o.path && (() => { const a = (o.x - m.x) * qx + (o.y - m.y) * qy, side = Math.abs((o.x - m.x) * qy - (o.y - m.y) * qx); return a > 0 && a < reach && side < .3; })());
      if (queued) { m.stuckT = 0; m.anchorT = undefined; continue; }
      // Progress is judged over a whole second, so a crawl of a few millimetres still counts as stuck.
      if (m.anchorT === undefined || clock - m.anchorT > 1) {
        const moved = m.anchorT === undefined ? 1 : Math.hypot(m.x - m.ax, m.y - m.ay);
        m.ax = m.x; m.ay = m.y; m.anchorT = clock;
        if (moved > .05 || (red && nearLight)) m.stuckT = 0; else m.stuckT = (m.stuckT || 0) + 1;
      }
      if (m.stuckT < 3) continue;
      m.stuckT = 0; m.unstickCount = (m.unstickCount || 0) + 1;
      if (clock - (m.lastUnstick || 0) > 30) m.unstickCount = 1;
      m.lastUnstick = clock;
      if (m.unstickCount === 1) { m.patienceUntil = clock + 2.5; unstuck.patience++; }
      else if (m.unstickCount === 2) { m.d ^= 1; m.v = 0; m.patienceUntil = clock + 2.5; unstuck.turned++; }
      else { remove(m); unstuck.left++; }
    }
  }
  // Crumbs tossed on the river (a tap on the water in 3D).
  let crumbs = null;
  function feedDucks(x, y) { crumbs = {x: clamp(.5, x, 17.5), y: clamp(13.15, y, 14.85), until: clock + 14}; tick('Someone is feeding the ducks. They are very pleased about it.'); return crumbs; }
  // Following a resident: the camera keeps them centred until they leave town
  // or the map is dragged.
  let followRef = null;
  // Glide the camera to a spot and zoom (used by Moments to watch, then to return).
  function viewTo(x, y, z) { followRef = null; cam.tx = clamp(PAN, x, N - PAN); cam.ty = clamp(PAN, y, N - PAN); if (z) cam.tz = clamp(MIN_ZOOM, z, MAX_ZOOM); return {x: cam.tx, y: cam.ty, z: cam.tz}; }
  function follow(m, zoom = 2.6) { followRef = m && movers.includes(m) ? m : null; if (followRef && cam.tz < zoom) cam.tz = clamp(MIN_ZOOM, zoom, MAX_ZOOM); return followRef; }   // ~3 frames a person close up in 3D
  /* ---------------- a day in the life ----------------
     The town clock gives an hour of day (noon when it is brightest, midnight
     at the darkest). Morning: commuters with briefcases leave their homes for
     the edge of town and children set off in pairs with their backpacks.
     Lunch: people stand at the café tables with something to eat. Evening:
     residents walk home and go in, and their house counts as lit after dusk.
     Each routine sends new walkers; nobody already busy is taken. */
  let crowdTrimmed = 0;
  const rushFactor = () => { const h = hourOfDay(); return h >= 7 && h < 9.5 ? 1.5 : h >= 16.5 && h < 19 ? 1.5 : h >= 11.5 && h < 14 ? 1.2 : (h >= 22 || h < 5.5) ? .55 : 1; };
  const hourOfDay = () => (12 + (clock / (300 * PACE)) % 1 * 24) % 24;
  const DAYPART = h => h >= 6 && h < 9.5 ? 'morning' : h >= 11.5 && h < 14 ? 'lunch' : h >= 17 && h < 21 ? 'evening' : null;
  const homes = () => buildings.filter(b => b.kind === 'house');
  const doorOf = b => ({x: b.x + .5, y: b.y + 1.08});
  const edgeOf = r => [{x: 1.07, y: LINES[1 + (r * 2 | 0)] + .5 + .43}, {x: 16.93, y: LINES[1 + (r * 2 | 0)] + .5 + .43}, {x: LINES[1 + (r * 2 | 0)] + .5 + .43, y: 1.07}][r * 3 | 0];   // the outer pavement where a street leaves town
  const CAFE = [{x: 7.74, y: 8.75}, {x: 10.25, y: 9.95}];
  let daypart = null, routineNext = 0, routine = {morning: 0, lunch: 0, evening: 0};
  function routineWalker(opts, from) {
    const m = spawnPerson(Math.random, opts); m.x = from.x; m.y = from.y; m.busy = true; m.routine = opts.routine; return m;
  }
  function updateRoutines() {
    const h = hourOfDay(), part = DAYPART(h);
    if (part !== daypart) {
      daypart = part; routineNext = clock + 1;
      if (part) tick({morning: 'Good morning! Toy Town is off to work and school.', lunch: 'Lunchtime: the café tables are filling up.', evening: 'Evening: everyone is heading home, and the lights are coming on.'}[part]);
      if (part === 'morning') for (const b of homes()) b.home = true;   // everyone slept at home
    }
    if (!part || clock < routineNext) return;
    routineNext = clock + 2.2 + Math.random() * 2.5;
    const active = movers.filter(m => m.routine).length;
    if (active >= 8) return;                                                      // a lively street, never a crowd
    if (part === 'morning') {
      const house = homes().filter(b => b.home !== false)[Math.random() * homes().length | 0];
      if (!house) return;
      const door = doorOf(house), out = edgeOf(Math.random());
      if (active <= 6 && Math.random() < .4) {   // two children set off together (room for both under the cap)
        for (let k = 0; k < 2; k++) { const kid = routineWalker({routine: 'school', kid: true, backpack: PASTEL[Math.random() * 8 | 0], gait: 'skip', max: .66}, {x: door.x + k * .2, y: door.y}); kid.path = walk(kid.x, kid.y, out.x, out.y, .62).concat([{x: out.x, y: out.y, speed: .6, then: q => { q.home = true; }}]); }
      } else {
        const c = routineWalker({routine: 'work', briefcase: true, gait: 'brisk', max: .74}, door); c.path = walk(c.x, c.y, out.x, out.y, .7).concat([{x: out.x, y: out.y, speed: .68, then: q => { q.home = true; }}]);
      }
      house.home = false; routine.morning++;
    } else if (part === 'lunch') {
      const spot = CAFE[Math.random() * 2 | 0], k = movers.filter(m => m.routine === 'lunch').length;
      if (k >= 4) return;
      const a = (k % 4) * Math.PI / 2 + .4, sx = spot.x + Math.cos(a) * .42, sy = spot.y + Math.sin(a) * .42, from = edgeOf(Math.random());
      const d = routineWalker({routine: 'lunch'}, from);
      d.path = walk(d.x, d.y, sx, sy, .5).concat([{x: sx, y: sy, speed: .35, then: q => { q.stopUntil = clock + 14; q.attention = {x: spot.x, y: spot.y}; q.shopAction = 'eating'; q.lunchUntil = clock + 14; }}]);
      routine.lunch++;
    } else if (part === 'evening') {
      const house = homes().filter(b => !b.home)[0] || homes()[Math.random() * homes().length | 0];
      if (!house) return;
      const door = doorOf(house), from = edgeOf(Math.random());
      const w = routineWalker({routine: 'home', briefcase: Math.random() < .5}, from);
      w.path = walk(w.x, w.y, door.x, door.y, .55).concat([{x: door.x, y: door.y, speed: .4, then: q => { q.home = true; house.home = true; house.homeAt = clock; }}]);
      routine.evening++;
    }
  }
  function finishRoutines() {
    // Walkers who reached the edge of town or their front door go inside / out of sight;
    // diners finish their lunch and drift off.
    for (const m of movers.slice()) {
      if (m.routine && m.home && !m.path) remove(m);
      else if (m.routine === 'lunch' && m.lunchUntil && clock > m.lunchUntil) { m.shopAction = null; m.attention = null; m.lunchUntil = 0; const out = edgeOf(Math.random()); m.path = walk(m.x, m.y, out.x, out.y, .5).concat([{x: out.x, y: out.y, speed: .5, then: q => { q.home = true; }}]); }
    }
  }
  // Two stopped cars whose drawn bodies overlap (they came to rest nose to flank in a junction, or one
  // was dropped beside another) ease apart: the later one rolls gently back along its own lane.
  function tightOverlap(A,B){
    const p=vehiclePoint(A),q=vehiclePoint(B),ax=tightExtent(A,1,0),bx=tightExtent(B,1,0),ay=tightExtent(A,0,1),by=tightExtent(B,0,1);
    return Math.abs(p.x-q.x)<ax.front+bx.front&&Math.abs(p.y-q.y)<ay.front+by.front;
  }
  function separateCars(dt){
    const cars=movers.filter(o=>o.type==='car'&&!o.path&&!o.stopUntil);
    let rolled=0;
    for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
      const A=cars[i],B=cars[j];
      if(Math.min(A.v,B.v)>.35||!tightOverlap(A,B))continue;
      // the slower one (or, if equal, the later one) rolls gently back along its own lane
      const order=A.v<B.v-.05?[[A,B],[B,A]]:B.v<A.v-.05?[[B,A],[A,B]]:[[B,A],[A,B]];
      for(const [Y,other] of order){
        if(Y.v>.35)continue;
        const [dx,dy]=DIRS[Y.d],px=Y.x,py=Y.y,s=.7*dt,nx=px-dx*s,ny=py-dy*s;
        if(nx<1.45||nx>16.55||ny<1.45||ny>16.55)continue;
        Y.x=nx;Y.y=ny;
        if(cars.some(o=>o!==Y&&o!==other&&tightOverlap(Y,o))){Y.x=px;Y.y=py;continue;}   // never back into a third car
        Y.v=0;Y.braking=true;rolled++;break;
      }
    }
    separated+=rolled?dt:0;
  }
  function update(dt) {
    clock += dt;
    updateNeighborhoodLife(dt);
    updateStreetTrade();
    updateDistrictLife();
    for (const m of movers.slice()) { step(m, dt); easeHeading(m, dt); updateHeroResident(m); }
    passingGreetings();
    updateWhims();
    unstick(dt);
    separateCars(dt);
    updateRoutines(); finishRoutines();
    for (const e of events.slice()) { e.t += dt; if (e.follow) { e.x = e.follow.x; e.y = e.follow.y; } if (e.update) e.update(e, dt); if (e.t > e.dur) { if (e.end) e.end.call(e); events.splice(events.indexOf(e), 1); } }
    for (const m of movers.slice()) if (m.home && !m.path) remove(m);
    // Event callbacks can reposition actors independently of the ordinary
    // road stepper. Maintain a strict miniature-board boundary for every
    // entity without interfering with paths, turn choices, or zoom gestures.
    for (const m of movers.slice()) {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) { remove(m); continue; }
      m.x=clamp(.08,m.x,17.92);m.y=clamp(.08,m.y,17.92);
    }
    for(const p of props)if(p.kind==='duck'&&crumbs&&clock<crumbs.until){
      // Crumbs on the water: every duck paddles over, quickest first, and nibbles.
      const dx=crumbs.x-p.x,dy=crumbs.y-p.y,d=Math.hypot(dx,dy);
      if(d>.22){const sp=Math.min(.42,.16+d*.12);p.vx=dx/d*sp;const nx=p.x+dx/d*sp*dt;if(!onBridge(nx)||onBridge(p.x))p.x=nx;else p.vx=0;p.y=clamp(13.12,p.y+dy/d*sp*dt,14.88);}
      else{p.vx=(Math.sign(p.vx)||1)*.001;p.nibble=clock;}
      continue;
    }
    for(const p of props)if(p.kind==='duck'){
      // Water birds notice activity near the bank and swim away gradually.
      // They stay on their existing water line, never across the paving.
      const near=movers.find(m=>m.type==='person'&&
        Math.hypot(m.x-p.x,m.y-p.y)<1.12);
      if(near){
        const away=Math.sign(p.x-near.x)||1;
        p.vx=away*Math.min(.18,Math.max(.065,Math.abs(p.vx||0)));
        p.alertUntil=clock+1.5;
      }else if(clock>(p.alertUntil||0)){
        p.vx+=(Math.sign(p.vx||1)*.065-p.vx)*Math.min(1,dt*.5);
      }
      const nx=p.x+p.vx*dt;
      p.x=nx;   // the bridges are arches now: ducks swim underneath
      if(p.x<.3||p.x>17.5)p.vx*=-1;
      p.x=clamp(.3,p.x,17.5);
    }
    for (const p of props) if (p.kind === 'rover') { if (clock > p.t) { p.tx = p.x + (Math.random() - .5) * 2; p.ty = p.y + (Math.random() - .5) * 2; p.t = clock + 4; } p.x += (p.tx - p.x) * dt * .15; p.y += (p.ty - p.y) * dt * .15; }
    for (const p of props) if (p.kind === 'animal' && !p.out) { if (!p.t || clock > p.t) { const z = props.find(q => q.kind === 'zoo'); if (z) { p.tx = z.x + (Math.random() - .5) * 2.8; p.ty = z.y + (Math.random() - .5) * 2.8; } p.t = clock + 3 + Math.random() * 4; } p.x += (p.tx - p.x) * dt * .3; p.y += (p.ty - p.y) * dt * .3; }
    for (const q of parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= q.g * dt; if (q.z < 0) { q.z = 0; q.vz *= -.3; } }
    parts = parts.filter(q => q.t < q.life); if (parts.length > 700) parts.splice(0, parts.length - 700);
    bubbles = bubbles.filter(b => b.until > clock);
    const raining = events.some(e => e.rain), snowing = events.some(e => e.snow);
    if (snowing) for (let k = 0; k < 3; k++) parts.push({x: Math.random() * 18, y: Math.random() * 18, z: 160, vx: .1, vy: 0, vz: -40, g: 0, life: 4, t: 0, col: '#ffffff', r: 1.6});
    for (const e of events) if (e.leaves && Math.random() < dt * 8) parts.push({x: Math.random() * 6, y: Math.random() * 18, z: 30 + Math.random() * 40, vx: 2.5, vy: .4, vz: 0, g: 4, life: 4, t: 0, col: ['#e2a33a', '#d9533e', '#7cc65a'][Math.random() * 3 | 0], r: 1.8});
    for (const e of events) if (e.notes && Math.random() < dt * 3) { const w = e.notes[Math.random() * e.notes.length | 0]; parts.push({x: w.x, y: w.y, z: 22, vx: (Math.random() - .5) * .3, vy: 0, vz: 18, g: 0, life: 2, t: 0, col: '#7a4fb3', r: 2, note: true}); }
    for (const m of movers) if (m.type === 'person') m.umbrella = raining && !m.kind;
    if (raining) for (let k = 0; k < 6; k++) parts.push({x: Math.random() * 18, y: Math.random() * 18, z: 160, vx: 0, vy: 0, vz: -260, g: 0, life: .6, t: 0, col: 'rgba(120,170,220,.7)', r: 1, rain: true});
    // Chaos: keep a few things going at once.
    if ((nextHeadline -= dt) <= 0) {
      // Real headlines stay in the attributed source panel. The ticker is
      // exclusively fictional neighborhood life, never unsourced news.
      const sale=streetTrade?.latestSale;
      if(sale&&clock-sale.at<35)
        tick(sale.product==='bread'?'Fresh bread just sold at the bakery!':
          'A neighbor picked up a book and found a reading spot.');
      else tick('The village is open: neighbors meet, shops trade and bicycles pass.');
      nextHeadline=26;
    }
    if ((nextEvent -= dt) <= 0) { if (events.length < 3) randomEvent(); nextEvent = 7 + Math.random() * 6; }
    if (clock >= nextStreetMoment) { streetMoment(); nextStreetMoment = clock + 20 + Math.random() * 8; }   // an unhurried rhythm
    if(clock>=nextPerformance){
      // One scheduled live performance roughly every two miniature minutes,
      // only when there is room in the event budget. This is visible civic
      // life, not a burst of extra permanent residents.
      if(events.length<5&&!events.some(e=>e.streetConcert)){
        startEvent('busker');
      }
      nextPerformance=clock+88;
    }
    // Traffic: keep the streets busy as cars leave and events come and go.
    // The streets breathe with the day: fuller at the morning and evening rush, thinner late at night.
    const rush = rushFactor(), carsWanted = Math.round(CARS * rush), walkersWanted = Math.round(PEOPLE * rush);
    const carsNow = () => movers.filter(m => m.type === 'car' && (m.kind === 'car' || m.kind === 'bus' || m.kind === 'taxi')).length;
    while (carsNow() < Math.min(carsWanted, 11)) spawnCar(Math.random, movers.some(m => m.kind === 'bus') ? undefined : 'bus');
    while (movers.filter(m => m.kind === 'bike').length < BIKES) spawnBike();
    while (movers.filter(m => m.type === 'person' && !m.kind).length < Math.min(walkersWanted, 22)) spawnPerson();
    if (clock >= (update.trim || 0)) {   // when the town is over-full, one car or walker leaves at the edge now and then
      update.trim = clock + 2;
      const extraCar = carsNow() > carsWanted && movers.find(m => m.type === 'car' && !m.path && m.kind === 'car' && ((m.d === 0 && m.x >= 15.9) || (m.d === 1 && m.x <= 2.1) || (m.d === 2 && m.y >= 15.9) || (m.d === 3 && m.y <= 2.1)));
      if (extraCar) { remove(extraCar); crowdTrimmed++; }
      const extraWalker = movers.filter(m => m.type === 'person' && !m.kind).length > walkersWanted && movers.find(m => freeWalker(m) && (m.x < 1.4 || m.x > 16.6 || m.y < 1.4 || m.y > 16.6));
      if (extraWalker) { remove(extraWalker); crowdTrimmed++; }
    }
    // Preserve the pointed-at block while easing wheel/button zoom.
    if (Math.abs(cam.tz - cam.z) > .0002) {
      cam.z = lerp(cam.z, cam.tz, Math.min(1, dt * 12));
      if (zoomAnchor) focusCamera(zoomAnchor.world, zoomAnchor.sx, zoomAnchor.sy);
    } else if (zoomAnchor) {
      cam.z = cam.tz;
      focusCamera(zoomAnchor.world, zoomAnchor.sx, zoomAnchor.sy);
      zoomAnchor = null;
    }
    if (followRef) { if (!movers.includes(followRef)) followRef = null; else { cam.tx = clamp(PAN, followRef.x, N - PAN); cam.ty = clamp(PAN, followRef.y, N - PAN); } }
    if (!zoomAnchor) {
      const k = Math.min(1, dt * 4);
      cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k;
    }
    cam.yaw = wrapAngle(cam.yaw + wrapAngle(cam.tyaw - cam.yaw) * Math.min(1, dt * 6));
  }
  function render() {
    // Keep the original 2D simulation alive for all gestures, news and traffic,
    // but avoid drawing a duplicate city when WebGL is successfully visible.
    if (typeof window !== 'undefined' && window.ToyTown3D?.active) return;
    S = base * cam.z;
    const night = nightLevel();
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, night > .5 ? '#1d2747' : '#bfe6f7'); sky.addColorStop(1, night > .5 ? '#2e3a63' : '#e8f6fb');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // Static streets, earth and contact shadows are cached between camera movements.
    // Reuse the same buffer during panning instead of allocating a canvas every frame.
    if (!ground || ground.w !== W || ground.h !== H || ground.x !== cam.x || ground.y !== cam.y || ground.s !== S) {
      const buffer = ground ? ground.canvas : document.createElement('canvas');
      if (buffer.width !== W) buffer.width = W;
      if (buffer.height !== H) buffer.height = H;
      const gc = buffer.getContext('2d');
      gc.clearRect(0, 0, W, H);
      drawGround(gc);
      ground = {canvas: buffer, w: W, h: H, x: cam.x, y: cam.y, s: S};
    }
    ctx.drawImage(ground.canvas, 0, 0);
    // Water glints.
    ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 40; k++) { const x = (k * 7.3 + clock * .2) % 18, y = 13 + (k * .37) % 2, s = P(x, y); if (Math.sin(clock * 2 + k) > .6) ctx.fillRect(s[0], s[1], 4 * S, 1.2 * S); }
    const list = [], push = (k, f) => list.push([k, f]);
    for (const b of buildings) push(b.x + b.y + 1, () => drawBuilding(ctx, b, night > .5));
    for (const p of props) if (p.kind === 'skymoon' || p.kind === 'skymars') push(-99, () => { const [x, y] = [W * .8, H * .16], r = Math.min(W, H) * .06; ctx.fillStyle = p.kind === 'skymars' ? '#d9603e' : '#fff6d8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = p.kind === 'skymars' ? 'rgba(120,40,20,.35)' : 'rgba(200,190,160,.35)'; for (const [dx, dy, k] of [[-.3, -.2, .22], [.25, .2, .16], [.1, -.4, .1]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, k * r, 0, TAU); ctx.fill(); } if (p.crescent) { ctx.fillStyle = night > .5 ? '#1d2747' : '#bfe6f7'; ctx.beginPath(); ctx.arc(x + r * .45, y - r * .15, r * .9, 0, TAU); ctx.fill(); } });
    else if (p.kind === 'rangoli') push(p.x + p.y - 3, () => drawProp(ctx, p, night));
    else if (p.kind === 'bunting') push(p.x + p.y + .9, () => drawProp(ctx, p, night));
    else if (p.kind === 'times') push(p.x + p.y + .02, () => drawProp(ctx, p, night));
    else if (p.kind !== 'fountain' && p.kind !== 'stadium' && p.kind !== 'launchpad' && p.kind !== 'duck') push(p.x + p.y, () => drawProp(ctx, p, night)); else push(p.kind === 'duck' ? p.x + p.y : -1 + p.x + p.y - 2, () => drawProp(ctx, p, night));
    for (const m of movers) push(m.x + m.y + .05, () => drawMover(ctx, m, night > .5));
    const Lp = lightPhase();
    for (const l of LINES) for (const k of LINES) push(l + k + 1.9, () => { const x = l + .96, y = k + .96, [bx, by] = P(x, y, 0), [tx, ty] = P(x, y, 20); ctx.strokeStyle = '#3b3f4a'; ctx.lineWidth = Math.max(1, 1.4 * S); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke(); ctx.fillStyle = '#2d3440'; ctx.fillRect(tx - 2.6 * S, ty - 9 * S, 5.2 * S, 10 * S);
      const col = a => a === Lp.green ? (Lp.amber ? '#ffb020' : '#3ddc5a') : '#ff4d4d'; ctx.fillStyle = col('x'); ctx.beginPath(); ctx.arc(tx - 1.2 * S, ty - 6 * S, 1.3 * S, 0, TAU); ctx.fill(); ctx.fillStyle = col('y'); ctx.beginPath(); ctx.arc(tx + 1.2 * S, ty - 2.5 * S, 1.3 * S, 0, TAU); ctx.fill(); });
    for (const e of events) drawEventExtras(ctx, e, push);
    for (const q of parts) push(q.x + q.y + (q.rain ? 50 : .2), () => { const [x, y] = P(q.x, q.y, q.z); ctx.globalAlpha = Math.max(0, 1 - q.t / q.life); ctx.fillStyle = q.col; if (q.rain) ctx.fillRect(x, y, 1 * S, 6 * S); else if (q.star || q.note) { ctx.font = `${(q.note ? 12 : 10) * S}px system-ui`; ctx.fillText(q.note ? '♪' : '★', x, y); } else { ctx.beginPath(); ctx.arc(x, y, q.r * S, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; });
    list.sort((a, b) => a[0] - b[0]); for (const [, f] of list) f();
    if (night > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(70,80,140,${night * .55})`; ctx.fillRect(0, 0, W, H); ctx.restore();
      // Street lamps and lit windows glow through the dusk.
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const l of LINES) for (const m of LINES) { const s = P(l + .5, m + .5, 18); const g = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], 26 * S); g.addColorStop(0, `rgba(255,214,120,${.35 * night})`); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(s[0] - 26 * S, s[1] - 26 * S, 52 * S, 52 * S); } ctx.restore(); }
    for (const b of bubbles) drawBubble(ctx, b);
  }
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    if (!playing || document.hidden) return;
    update(dt * PACE); render();
  }

  /* ---------------- start ---------------- */
  function setCard(list,linkedToNews=false) {
    const lead = list[0];
    document.getElementById('date').textContent = new Date().toLocaleDateString(undefined,
      {weekday:'short',day:'numeric',month:'short'});
    document.getElementById('theme').textContent = `${lead.emoji} ${lead.title}`;
    document.getElementById('news').textContent = linkedToNews?
      `A playful town scene staged from “${headline(lead.story)}”; the town crier reads the other light headlines out. Actual reporting is linked below.`:
      'Storybook city life · not a real news report.';
  }
  async function start() {
    layout();
    // Start on the living village instead of a distant map of tiny boxes.
    // "Fit" is always available when someone wants the whole city.
    cam.z = cam.tz = innerWidth < 700 ? 1.52 : 1.72;
    const h = location.hash.slice(1), random = h.startsWith('new');
    day=today();
    const daySeed=hash(+day.replace(/-/g,''),0x70e);
    const service=typeof window!=='undefined'?window.ToyTownNews:null;
    service?.init();
    // The daily town always exists, even if publishers or GitHub are offline.
    // Factual headlines and whimsical city events have separate labels.
    const snapshot=!random&&service?await service.load():null;
    const liveStories=snapshot?.stories||[];
    if(!random)setNews(liveStories);
    const matched=random?[]:newsThemes(liveStories.map(item=>item.title));
    const linkedToNews=matched.length>0;
    today_=linkedToNews?matched:[
      VARIANTS[((random?Math.random()*1e9|0:daySeed)>>>0)%VARIANTS.length]
    ];
    build(random?(Math.random()*1e9)|0:daySeed,today_[0].key);
    decorate(today_);
    if(linkedToNews)reactToNews(today_[0]);
    setCard(today_,linkedToNews);
    service?.paint(snapshot);
    clock=0;nextEvent=1.5;
    setTimeout(()=>randomEvent(),400);
    setTimeout(()=>startEvent(today_[0].variant),3500);
    requestAnimationFrame(frame);
    setTimeout(()=>{const el=document.getElementById('hint');if(el)el.style.opacity='0';},6000);
    // Refresh independently of animation and rebuild on the next local day,
    // instead of displaying yesterday's city and stories indefinitely.
    if(service&&!random){
      let fetching=false;
      const refresh=async()=>{
        if(fetching||document.hidden)return;
        if(today()!==day){location.reload();return;}
        fetching=true;
        try{
          const next=await service.load();
          service.paint(next);
          setNews(next.stories||[]);
          const selected=newsThemes((next.stories||[]).map(item=>item.title));
          if(selected.length){
            if(selected[0].story!==today_[0].story){
              today_=selected;
              reactToNews(today_[0]);
              setCard(today_,true);
              startEvent(today_[0].variant); // update activity, never teleport the town
            }else setCard(today_,true);
          }else setCard(today_,false);
        }finally{fetching=false;}
      };
      setInterval(refresh,15*60*1000);
      document.addEventListener('visibilitychange',()=>{
        if(!document.hidden)refresh();
      });
    }
  }
  // A tap pokes the town: something happens right there.
  // Inverse isometric projection used by both pokes and gestures.
  // The view can be turned all the way round (cam.yaw). Every screen-to-world step goes through rotBy, so panning,
  // pinch-zoom anchoring and taps stay right at any heading.
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
  // The 3D camera looks along (7.4, 24) rather than the 45 degrees of the old isometric drawing: about 28 degrees of
  // azimuth (measured) that panning and taps must account for, or a drag would slide the town off-line with the finger.
  const BASE_AZ = .49;
  const rotBy = (a, b) => { const c = Math.cos(cam.yaw + BASE_AZ), s = Math.sin(cam.yaw + BASE_AZ); return [a * c - b * s, a * s + b * c]; };
  function rotateBy(rad) { cam.tyaw = wrapAngle(cam.tyaw + rad); return cam.tyaw; }
  function rotateTo(rad) { cam.tyaw = wrapAngle(rad); return cam.tyaw; }
  function screenWorld(sx, sy) {
    const scale = base * cam.z || S || 1;
    const u = (sx - W / 2) / (TW * scale), v = (sy - H / 2) / (TH * scale), [a, b] = rotBy((u + v) / 2, (v - u) / 2);
    return {x: cam.x + a, y: cam.y + b};
  }
  function focusCamera(world, sx, sy) {
    const scale = base * cam.z || 1;
    const u = (sx - W / 2) / (TW * scale), v = (sy - H / 2) / (TH * scale), [a, b] = rotBy((u + v) / 2, (v - u) / 2);
    cam.x = cam.tx = clamp(PAN, world.x - a, N - PAN);
    cam.y = cam.ty = clamp(PAN, world.y - b, N - PAN);
  }
  function zoomAt(factor, cx = innerWidth / 2, cy = innerHeight / 2) {
    const sx = cx * dpr, sy = cy * dpr;
    zoomAnchor = {world: screenWorld(sx, sy), sx, sy};
    cam.tz = clamp(MIN_ZOOM, cam.tz * factor, MAX_ZOOM);
    if (!playing) { cam.z = cam.tz; focusCamera(zoomAnchor.world, sx, sy); zoomAnchor = null; render(); }
    return cam.tz;
  }
  function resetView() {
    zoomAnchor = {world: {x: N / 2, y: N / 2}, sx: W / 2, sy: H / 2};
    cam.tz = fitZoom; cam.tyaw = 0;
    if (!playing) { cam.z = fitZoom; cam.yaw = 0; focusCamera(zoomAnchor.world, W / 2, H / 2); zoomAnchor = null; render(); }
  }
  function fitView() { return fitZoom; }
  function pinchTo(scale, centerX, centerY, anchorWorld) {
    cam.z = cam.tz = clamp(MIN_ZOOM, scale, MAX_ZOOM);
    zoomAnchor = null;
    focusCamera(anchorWorld, centerX * dpr, centerY * dpr);
    if (!playing) render();
  }
  function poke(e) {
    // In 3D the tap is hit-tested against the real scene: a resident, a car, a building or the ground.
    if (typeof window !== 'undefined' && window.ToyTown3D?.active && window.ToyTown3D.tap?.(e.clientX, e.clientY)) return;
    const r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr;
    const {x: gx, y: gy} = screenWorld(sx, sy);
    const names = ['balloon', 'butterflies', 'kite', 'pigeons', 'busker'];
    startEvent(names[Math.random() * names.length | 0], clamp(1.5, gx, 16.5), clamp(1.5, gy, 16.5));
  }
  // A still press of about half a second is a hold, not a tap.
  const stopTimer = t => { if (typeof clearTimeout === 'function') clearTimeout(t); };   // headless test pages have no clearTimeout
  function armHold(state, x, y) {
    state.holdTimer = setTimeout(() => {
      if (state.moved || !window.ToyTown3D?.active) return;
      if (window.ToyTown3D.hold?.(x, y)) state.held = true;
    }, 520);
  }
  if (typeof window !== 'undefined' && cv) {
    addEventListener('resize', layout);
    // Single pointer: drag or poke. Two pointers: pinch and pan with a stable anchor.
    const fingers = new Map();
    let down = null, pinch = null;
    const pair = () => [...fingers.values()].slice(0, 2);
    const beginPinch = () => {
      const [a, b] = pair(); if (!a || !b) return;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      pinch = {distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        scale: cam.z, world: screenWorld(cx * dpr, cy * dpr)};
      cam.tz = cam.z; zoomAnchor = null; down = null;
    };
    cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return; // iOS uses dedicated TouchEvents below
      fingers.set(e.pointerId, {x: e.clientX, y: e.clientY});
      cv.setPointerCapture(e.pointerId);
      if (fingers.size === 1) { pinch = null; zoomAnchor = null; cam.tz = cam.z;
        down = {x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, turn: e.button === 2 || e.shiftKey || e.altKey, yaw0: cam.yaw};
        if (down.turn) { down.moved = true; followRef = null; } else armHold(down, e.clientX, e.clientY); }
      else beginPinch();
    });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' || !fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, {x: e.clientX, y: e.clientY});
      if (fingers.size >= 2) {
        if (!pinch) beginPinch();
        const [a, b] = pair();
        pinchTo(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance,
          (a.x + b.x) / 2, (a.y + b.y) / 2, pinch.world);
      } else if (down) {
        const dx = (e.clientX - down.x) * dpr / (TW * base * cam.z);
        const dy = (e.clientY - down.y) * dpr / (TH * base * cam.z);
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down.moved = true; followRef = null; }
        if (down.turn) { cam.tyaw = cam.yaw = wrapAngle(down.yaw0 + (e.clientX - down.x) * .008); if (!playing) render(); }
        else if (down.moved) { const [pa, pb] = rotBy((dx + dy) / 2, (dy - dx) / 2);
          cam.tx = cam.x = clamp(PAN, down.cx - pa, N - PAN);
          cam.ty = cam.y = clamp(PAN, down.cy - pb, N - PAN);
          if (!playing) render(); }
      }
    });
    function releasePointer(e, cancelled = false) {
      if (!fingers.has(e.pointerId)) return;
      const wasPinch = !!pinch || fingers.size > 1;
      fingers.delete(e.pointerId);
      if (!cancelled && !wasPinch && down && !down.moved && !down.held) poke(e);
      if (down) stopTimer(down.holdTimer);
      down = null;
      if (fingers.size === 1) {
        const remaining = [...fingers.values()][0];
        down = {x: remaining.x, y: remaining.y, cx: cam.x, cy: cam.y, moved: true};
      } else pinch = null;
    }
    cv.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') releasePointer(e); });
    cv.addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') releasePointer(e, true); });
    // Mobile Safari can cancel the second PointerEvent of a pinch inside an
    // iframe. TouchEvents are therefore the primary mobile gesture path.
    let touchStart = null, touchPinch = null, hadPinch = false;
    const centerOf = (a, b) => ({x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2});
    const startPinch = ts => {
      const {x, y} = centerOf(ts[0], ts[1]);
      const rect = cv.getBoundingClientRect();
      touchPinch = {distance: Math.max(1, Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY)),
        scale: cam.z, world: screenWorld((x - rect.left) * dpr, (y - rect.top) * dpr),
        angle: Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX), yaw0: cam.yaw};
      touchStart = null; hadPinch = true; cam.tz = cam.z; zoomAnchor = null;
    };
    cv.addEventListener('touchstart', e => {
      e.preventDefault();
      const ts = e.touches;
      if (ts.length >= 2) startPinch(ts);
      else if (ts.length === 1 && !hadPinch) {
        const t = ts[0]; const rect = cv.getBoundingClientRect();
        cam.tz = cam.z; zoomAnchor = null;
        touchStart = {x: t.clientX, y: t.clientY, cx: cam.x, cy: cam.y,
          left: rect.left, top: rect.top, moved: false};
        armHold(touchStart, t.clientX, t.clientY);
      }
    }, {passive: false});
    cv.addEventListener('touchmove', e => {
      e.preventDefault();
      const ts = e.touches;
      if (ts.length >= 2) {
        if (!touchPinch) startPinch(ts);
        const c = centerOf(ts[0], ts[1]), rect = cv.getBoundingClientRect();
        const dist = Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
        // Twisting two fingers turns the view (with a small dead zone so a plain pinch never rotates it).
        const twist = wrapAngle(Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX) - touchPinch.angle);
        if (touchPinch.turning || Math.abs(twist) > .14) { touchPinch.turning = true; cam.tyaw = cam.yaw = wrapAngle(touchPinch.yaw0 - twist); }
        pinchTo(touchPinch.scale * dist / touchPinch.distance,
          c.x - rect.left, c.y - rect.top, touchPinch.world);
      } else if (ts.length === 1 && touchStart && !hadPinch) {
        const dx = (ts[0].clientX - touchStart.x) * dpr / (TW * base * cam.z);
        const dy = (ts[0].clientY - touchStart.y) * dpr / (TH * base * cam.z);
        if (Math.hypot(ts[0].clientX - touchStart.x, ts[0].clientY - touchStart.y) > 7)
          { touchStart.moved = true; followRef = null; }
        if (touchStart.moved) {
          const [pa, pb] = rotBy((dx + dy) / 2, (dy - dx) / 2);
          cam.tx = cam.x = clamp(PAN, touchStart.cx - pa, N - PAN);
          cam.ty = cam.y = clamp(PAN, touchStart.cy - pb, N - PAN);
          if (!playing) render();
        }
      }
    }, {passive: false});
    cv.addEventListener('touchend', e => {
      e.preventDefault();
      if (!e.touches.length) {
        if (!hadPinch && touchStart && !touchStart.moved && !touchStart.held && e.changedTouches[0])
          poke(e.changedTouches[0]);
        if (touchStart) stopTimer(touchStart.holdTimer);
        touchStart = null; touchPinch = null; hadPinch = false;
      } else if (hadPinch) { touchStart = null; touchPinch = null; }
    }, {passive: false});
    cv.addEventListener('touchcancel', e => {
      e.preventDefault(); touchStart = null; touchPinch = null; hadPinch = false;
    }, {passive: false});
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      zoomAt(Math.exp(-clamp(-120, e.deltaY, 120) * .0025),
        e.clientX - rect.left, e.clientY - rect.top);
    }, {passive: false});
    for (const [id, factor] of [['zoom-in', 1.35], ['zoom-out', 1 / 1.35]]) {
      const button = document.getElementById(id);
      if (button) button.addEventListener('click', () => zoomAt(factor));
    }
    for (const [id, delta] of [['rotate-left', -Math.PI / 6], ['rotate-right', Math.PI / 6]]) {
      const button = document.getElementById(id);
      if (button) button.addEventListener('click', () => rotateBy(delta));
    }
    addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'q' || e.key === 'Q' || e.key === '[') rotateBy(-Math.PI / 12);
      else if (e.key === 'e' || e.key === 'E' || e.key === ']') rotateBy(Math.PI / 12);
    });
    const resetButton = document.getElementById('zoom-reset');
    if (resetButton) resetButton.addEventListener('click', resetView);
    // The parent page has its own zoom buttons so iOS users can adjust the
    // camera even if their browser doesn't deliver multi-pointer events in an iframe.
    addEventListener('message', e => {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === 'town:zoom' && Number.isFinite(e.data.factor) && e.data.factor > 0)
        zoomAt(clamp(.5, e.data.factor, 2));
      else if (e.data.type === 'town:fit') resetView();
      else if (e.data.type === 'town:rotate' && Number.isFinite(e.data.delta)) rotateBy(clamp(-Math.PI, e.data.delta, Math.PI));
    });
    addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'town:motion') playing = !!e.data.playing; });
    addEventListener('hashchange', () => location.reload());
    start();
  }
  return {BUS_STOPS, news: () => newsFeed, setNews, gather, rotateBy, rotateTo, yaw: () => cam.yaw, viewTo, view: () => ({x: cam.tx, y: cam.ty, z: cam.tz, yaw: cam.tyaw}), follow, following: () => followRef, feedDucks, layout, render, zoomAt, resetView, fitView, pinchTo, screenWorld, streetMoment, reactToNews, hero: () => town.blocks.find(b => b.hero), TALK, nameOf, headline, dateKey, CALM, lightPhase, themeFromNews, newsThemes, VARIANTS, VARIANT_EVENTS: () => Object.keys(VARIANT_EVENTS), decorate, setToday: l => { today_ = l; }, PACE, THEMES, GRIM, build, update, events: () => events, movers: () => movers, buildings: () => buildings, props: () => props, startEvent, randomEvent, setPlaying: v => { playing = v; }, debug: () => ({separated, busStops: BUS_STOPS.length, buses: movers.filter(m => m.kind === 'bus').map(m => m.stops || 0), clock, theme, seed, greetings, whims: {...whims}, feedings, crowdTrimmed, rush: rushFactor(), unstuck: {...unstuck}, hour: hourOfDay(), daypart, routines: {...routine}, night: nightLevel(), cam: {...cam}, fitZoom, streetMoments,communityEncounters,communityVisits,streetTransactions,streetShopVisits,newsReactions,streetPerformances,
    districts:{count:districts.length,visits:districtVisits,
      meetings:districtMeetings,tasks:districtTasks,
      areas:districts.map(a=>({role:a.role,block:a.block,
        arrivals:a.arrivals,interactions:a.interactions,x:a.x,y:a.y}))},
    trade:streetTrade?{mood:streetTrade.newsMood,staff:streetTrade.stalls.length,
      customers:streetTrade.customers.length,latestSale:streetTrade.latestSale}:null,
    community:community?{meetingUntil:community.meetingUntil,nextMeeting:community.nextMeeting,meetingCount:community.meetingCount}:null})};
})();
