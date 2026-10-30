/* Toy Town: a busy little isometric town where something silly is always
 * happening. A new town is laid out every day (seeded by the date), and the
 * day's theme comes from the news: a light story from Wikipedia's "In the
 * news" (sport, space, elections, festivals, awards, tech, animals, markets,
 * science) turns into a rocket launch, a big match, a rally, fireworks…
 * Stories about deaths, wars, attacks or disasters are never used; without a
 * usable story (or offline) the date picks the theme. Cars and people move on
 * the streets and chaos events overlap: runaway carts, burst hydrants, cats
 * on roofs and the fire truck that comes for them, escaping balloons,
 * pigeons, banana peels, a UFO now and then. A director camera glides to the
 * action, a ticker reports it, and a tap anywhere pokes the town. */
const ToyTown = (() => {
  const cv = document.getElementById('town'), ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  const N = 18, TW = 32, TH = 16, LINES = [1, 6, 11, 16];
  const isRoad = i => LINES.includes(i);
  const hash = (a, b) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35); h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; return h >>> 0; };
  const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const clamp = (a, x, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;
  const today = () => new Date().toISOString().slice(0, 10), narrow = () => typeof innerWidth === 'number' && innerWidth < 700;
  let rnd = Math.random, seed = 0, day = '', theme = null, newsLine = '', today_ = [];
  let W = 0, H = 0, dpr = 1, S = 1, cam = {x: N / 2, y: N / 2, z: 1, tx: N / 2, ty: N / 2, tz: 1}, base = 1;
  let grid = [], buildings = [], props = [], movers = [], events = [], parts = [], bubbles = [], ground = null, sprites = new Map();
  const PACE = .6, CARS = 7, BIKES = 4, PEOPLE = 14, LIGHT = 10;   // a calm town: few cars, a handful of cyclists, people taking their time   // the whole town runs at 60% speed: easier to follow, calmer to watch
  let clock = 0, playing = true, last = 0, nextEvent = 2, director = null, directorUntil = 0;
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
      if (v && !out.some(o => o.key === v.key)) out.push({...v, story});
    }
    return out;
  }
  function themeFromNews(stories) { return newsThemes(stories, 1)[0] || null; }
  const strip = html => String(html).replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  async function fetchNews(date) {
    const key = 'toy-town:news:' + date;
    try { const c = JSON.parse(localStorage.getItem(key)); if (c) return c; } catch (_) {}
    const [y, m, d] = date.split('-');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = setTimeout(() => ctl && ctl.abort(), 4000);
    try {
      const res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`, ctl ? {signal: ctl.signal} : {});
      const data = await res.json(), stories = (data.news || []).map(n => strip(n.story)).filter(Boolean);
      try { localStorage.setItem(key, JSON.stringify(stories)); } catch (_) {}
      return stories;
    } catch (_) { return []; } finally { clearTimeout(timer); }
  }

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
    const blocks = [];
    for (const [ya, yb] of [[2, 5], [7, 10], [12, 15]]) for (const [xa, xb] of [[2, 5], [7, 10], [12, 15]]) blocks.push({xa, xb, ya, yb, river: ya === 12});
    const land = blocks.filter(b => !b.river), order = land.map(b => b).sort(() => r() - .5);
    const special = {sports: 'stadium', space: 'launchpad', election: 'stage', festival: 'stage', awards: 'stage', tech: 'lab', animals: 'zoo', market: 'market', science: 'lab', weather: 'park'}[themeKey] || 'park';
    const kinds = [special, 'fire', special === 'park' ? 'towers' : 'park', 'shops', 'houses', r() < .5 ? 'construction' : 'houses'];
    order.forEach((b, i) => { b.type = kinds[i] || 'houses'; });
    for (const b of blocks.filter(b => b.river)) b.type = 'riverside';
    for (const b of blocks) fill(b, r);
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (tile(x, y).kind === 'edge' && r() < .55) props.push({kind: 'tree', x: x + .5, y: y + .5, s: .8 + r() * .4, c: r() < .5 ? '#5cb85c' : '#7cc65a'});
    for (let k = 0; k < CARS; k++) spawnCar(r);
    for (let k = 0; k < BIKES; k++) spawnBike(r);
    for (let k = 0; k < PEOPLE; k++) spawnPerson(r);
    for (const b of buildings) if (b.kind === 'house' && r() < .75) props.push({kind: 'flowers', x: b.x + .5, y: b.y + .88, c: [PASTEL[r() * 8 | 0], PASTEL[r() * 8 | 0]]});
    for (let k = 0; k < 5; k++) props.push({kind: 'duck', x: 1 + r() * 16, y: 13.2 + r() * 1.6, vx: (r() - .5) * .3, ph: r() * 6});
    sprites.clear(); ground = null;
    theme = themeKey; town.blocks = blocks;
  }
  const town = {blocks: []};
  function addBuilding(b) { buildings.push(b); tile(b.x, b.y).used = true; }
  function fill(b, r) {
    const tiles = []; for (let y = b.ya; y <= b.yb; y++) for (let x = b.xa; x <= b.xb; x++) { tile(x, y).block = b; tiles.push([x, y]); }
    const edge = ([x, y]) => x === b.xa || x === b.xb || y === b.ya || y === b.yb;
    const pastel = () => PASTEL[r() * PASTEL.length | 0], roof = () => ROOFS[r() * ROOFS.length | 0];
    if (b.type === 'houses') for (const [x, y] of tiles) { if (edge([x, y]) && r() < .8) addBuilding({x, y, kind: 'house', h: 16 + r() * 8, wall: pastel(), roof: roof()}); else props.push({kind: 'tree', x: x + .5, y: y + .5, s: .7 + r() * .4, c: '#6cc35a'}); }
    else if (b.type === 'shops') for (const [x, y] of tiles) { if (edge([x, y])) addBuilding({x, y, kind: 'shop', h: 22 + r() * 14, wall: pastel(), awning: roof(), name: ['BAKERY', 'PIZZA', 'TOYS', 'BOOKS', 'CAFE', 'SWEETS', 'PETS'][r() * 7 | 0]}); else tile(x, y).kind = 'plaza'; }
    else if (b.type === 'towers') for (const [x, y] of tiles) { if (r() < .7) addBuilding({x, y, kind: 'tower', h: 50 + r() * 70, wall: ['#9fc4e8', '#b9d2e6', '#a8b8d8', '#c8d6e0'][r() * 4 | 0], roof: '#6b7c93'}); else tile(x, y).kind = 'plaza'; }
    else if (b.type === 'fire') { for (const [x, y] of tiles) { if (x === b.xa && y === b.yb) addBuilding({x, y, kind: 'fire', h: 26, wall: '#e2463a', roof: '#a8281f'}); else if (edge([x, y]) && r() < .6) addBuilding({x, y, kind: 'house', h: 16 + r() * 8, wall: pastel(), roof: roof()}); else tile(x, y).kind = 'plaza'; } b.station = {x: b.xa + .5, y: b.yb + .5}; }
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
  function spawnCar(r = Math.random, kind) {
    const p = randomRoadPoint(r), k = kind || (r() < .12 ? 'bus' : r() < .15 ? 'taxi' : 'car');
    const m = {type: 'car', kind: k, x: p.x, y: p.y, d: p.d, v: 0, max: k === 'bus' ? .9 : 1.2 + r() * .5, col: k === 'taxi' ? '#f6c541' : k === 'bus' ? '#3f8fd6' : PASTEL[r() * PASTEL.length | 0], wait: 0, lane: .2};
    movers.push(m); return m;
  }
  function spawnPerson(r = Math.random, opts = {}) {
    const p = randomRoadPoint(r);
    const m = Object.assign({type: 'person', x: p.x, y: p.y, d: p.d, v: 0, max: .35 + r() * .25, col: PASTEL[r() * PASTEL.length | 0], skin: ['#f1c9a5', '#d8a77c', '#a8754f', '#7a4e33'][r() * 4 | 0], lane: (r() < .5 ? 1 : -1) * (.4 + r() * .07), ph: r() * 6, wait: 0}, opts);
    movers.push(m); return m;
  }
  function spawnBike(r = Math.random) {
    const p = randomRoadPoint(r), m = {type: 'car', kind: 'bike', x: p.x, y: p.y, d: p.d, v: 0, max: .55 + r() * .15, col: PASTEL[r() * PASTEL.length | 0], skin: ['#f1c9a5', '#d8a77c', '#a8754f', '#7a4e33'][r() * 4 | 0], wait: 0, lane: .36, ph: r() * 6};
    movers.push(m); return m;
  }
  // Traffic lights: the two directions take turns, with a short amber in between.
  const lightPhase = () => { const u = clock % (LIGHT * 2); return {green: u < LIGHT ? 'x' : 'y', amber: u % LIGHT > LIGHT - 2}; };
  // Is m held at the next crossing? Movers along x wait while y has green, and the other way round.
  function heldAtLight(m, stopAt) {
    const L = lightPhase(), axis = m.d < 2 ? 'x' : 'y', pos = m.d < 2 ? m.x : m.y, sign = m.d === 0 || m.d === 2 ? 1 : -1;
    if (L.green === axis && !L.amber) return false;
    for (const l of LINES) { const dist = (l + .5 - pos) * sign; if (dist > stopAt - .3 && dist < stopAt + .35) return true; }
    return false;
  }
  function laneOffset(m) { const s = m.type === 'car' ? (m.d === 0 || m.d === 3 ? 1 : -1) * m.lane : m.lane; return m.d < 2 ? [0, s] : [-s, 0]; }
  function atNode(m) { return LINES.some(l => Math.abs((m.d < 2 ? m.x : m.y) - (l + .5)) < .02); }
  function step(m, dt) {
    if (m.stopUntil && clock < m.stopUntil) { m.v = 0; return; }
    if (m.path) return stepPath(m, dt);
    const [dx, dy] = DIRS[m.d];
    let want = m.max;
    if (m.type === 'car') {   // keep a gap to whatever is ahead in the lane, and stop for red lights
      for (const o of movers) if (o !== m && o.type === 'car' && o.d === m.d) {
        const ahead = (o.x - m.x) * dx + (o.y - m.y) * dy, side = Math.abs((o.x - m.x) * dy) + Math.abs((o.y - m.y) * dx);
        if (ahead > 0 && ahead < 1 && side < .3) want = Math.min(want, o.v * .9, ahead < .6 ? 0 : want);
      }
      if (heldAtLight(m, .75)) want = 0;
      for (const e of events) if (e.blocks && Math.hypot(e.x - m.x, e.y - m.y) < 1.1) want = 0;
    } else if (!m.kind || m.kind === 'chef' || m.kind === 'farmer' || m.kind === 'keeper') {   // walkers wait at the crossing and keep a little room
      if (heldAtLight(m, .62)) want = 0;
      for (const o of movers) if (o !== m && o.type === 'person' && o.d === m.d) { const ahead = (o.x - m.x) * dx + (o.y - m.y) * dy, side = Math.abs((o.x - m.x) * dy) + Math.abs((o.y - m.y) * dx); if (ahead > 0 && ahead < .3 && side < .1) want = Math.min(want, o.v * .8); }
    }
    m.v += (want - m.v) * Math.min(1, dt * 3);
    const before = m.d < 2 ? m.x : m.y;
    m.x += dx * m.v * dt; m.y += dy * m.v * dt;
    const now = m.d < 2 ? m.x : m.y;
    for (const l of LINES) {   // crossing an intersection centre: maybe turn
      const c = l + .5;
      if ((before - c) * (now - c) <= 0 && before !== now) {
        const opts = DIRS.map((_, i) => i).filter(i => i !== (m.d ^ 1)).filter(i => { const nx = Math.round((m.d < 2 ? c : m.x) - .5 + DIRS[i][0]), ny = Math.round((m.d < 2 ? m.y : c) - .5 + DIRS[i][1]); const t = tile(nx, ny); return t && (t.kind === 'road' || t.kind === 'bridge'); });
        if (opts.length && (Math.random() < .45 || !opts.includes(m.d))) { const nd = opts[Math.random() * opts.length | 0]; if (nd !== m.d) { if (m.d < 2) m.x = c; else m.y = c; m.d = nd; } }
      }
    }
    if (m.x < 1.4 || m.x > 16.6 || m.y < 1.4 || m.y > 16.6) { m.d ^= 1; m.x = clamp(1.45, m.x, 16.55); m.y = clamp(1.45, m.y, 16.55); }
  }
  // Scripted movement (an event's chase, a fire truck's run): straight to each point in turn.
  function stepPath(m, dt) {
    const p = m.path[0]; if (!p) { m.path = null; return; }
    const dx = p.x - m.x, dy = p.y - m.y, dist = Math.hypot(dx, dy), sp = (p.speed || m.max) * dt;
    m.v = p.speed || m.max;
    if (Math.abs(dx) > Math.abs(dy)) m.d = dx > 0 ? 0 : 1; else m.d = dy > 0 ? 2 : 3;
    if (dist <= sp) { m.x = p.x; m.y = p.y; m.path.shift(); if (p.then) p.then(m); } else { m.x += dx / dist * sp; m.y += dy / dist * sp; }
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
      cart.path = route(cart.x, cart.y, b.x, b.y, 1.6); chaser.path = route(chaser.x, chaser.y, b.x, b.y, 1.25);
      say(chaser, 'COME BACK!', 3); tick(`Runaway shopping cart speeding down ${streetOf(cart.x, cart.y)}!`);
      return {x: cart.x, y: cart.y, dur: 12, follow: cart, end() { remove(cart); chaser.path = null; say(chaser, 'Phew…'); }};
    },
    dog(x, y) {
      const a = randomRoadPoint(Math.random), b = randomRoadPoint(Math.random);
      const dog = spawnPerson(Math.random, {kind: 'dog', max: 1.4, lane: .3}), chef = spawnPerson(Math.random, {kind: 'chef', max: 1.1, col: '#ffffff'});
      dog.x = x ?? a.x; dog.y = y ?? a.y; chef.x = dog.x - 1; chef.y = dog.y;
      dog.path = route(dog.x, dog.y, b.x, b.y, 1.4); chef.path = route(chef.x, chef.y, b.x, b.y, 1.05);
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
      const star = spawnPerson(Math.random, {kind: 'llama', max: .5}); star.path = route(star.x, star.y, stage.x, stage.y + 1.5, .7);
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
      const keeper = spawnPerson(Math.random, {kind: 'keeper', col: '#c9a25a', max: .8}); keeper.x = zoo.x; keeper.y = zoo.y + 2; keeper.path = route(keeper.x, keeper.y, b.x, b.y, .8);
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
      const m = movers.find(o => o.type === 'person' && !o.kind && !o.path) || spawnPerson();
      m.stopUntil = clock + 16; m.guitar = true; say(m, '♪ la la laaa ♪', 3);
      tick(`A street musician on ${streetOf(m.x, m.y)} has started a dance party.`);
      const fans = peopleNear(m.x, m.y, 3).filter(o => o !== m).slice(0, 4);
      for (const f of fans) { f.stopUntil = clock + 14; f.dance = true; }
      return {x: m.x, y: m.y, dur: 16, notes: [m], end() { m.guitar = false; for (const f of fans) f.dance = false; }};
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
  function sendTo(m, x, y, then) { m.busy = true; m.path = route(m.x, m.y, x, y, .45).concat([{x, y, speed: .4, then}]); }
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
  // What the town does on its own when the news is quiet: gentle things, mostly.
  const CALM = ['kite', 'picnic', 'gardener', 'painter', 'reading', 'butterflies', 'catnap', 'balloon', 'sweeper', 'icecream', 'busker', 'hotair', 'pigeons', 'band', 'duck'];

  /* ---------------- the news, toy-sized ---------------- */
  const sky = (kind, x, y, z, vx = 0, vy = 0) => ({kind, x, y, z, vx, vy});
  const VARIANT_EVENTS = {
    cricket() {
      const st = props.find(p => p.kind === 'stadium');
      const from = st || {x: 9, y: 9}, b = randomRoadPoint(Math.random);
      tick('SIX! The ball has left the stadium. A dog is on the case.');
      say({x: from.x, y: from.y, z: 40}, 'SIIIX!', 2);
      const ball = {x: from.x, y: from.y, z: 10, t: 0};
      return {x: from.x, y: from.y, dur: 12, ball, update(e, dt) { ball.t = Math.min(1, ball.t + dt / 3); ball.x = lerp(from.x, b.x, ball.t); ball.y = lerp(from.y, b.y, ball.t); ball.z = 10 + Math.sin(ball.t * Math.PI) * 120; e.x = ball.x; e.y = ball.y; if (ball.t >= 1 && !e.dog) { e.dog = spawnPerson(Math.random, {kind: 'dog', max: 1}); e.dog.path = route(e.dog.x, e.dog.y, b.x, b.y, 1); say(e.dog, 'woof!', 1.5); } }, end() { if (this.dog) remove(this.dog); }};
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
  function decorate(list) {
    const has = v => list.some(x => x.variant === v), plaza = () => { const t = []; for (let y = 2; y < 16; y++) for (let x = 2; x < 16; x++) if (tile(x, y).kind === 'plaza' && !tile(x, y).used) t.push([x, y]); return t[(t.length * .5) | 0] || [9, 9]; };
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
    if (has('cricket') || has('tennis')) { const st = props.find(p => p.kind === 'stadium'); if (st) st.sport = has('cricket') ? 'cricket' : 'tennis'; }
  }

  /* ---------------- drawing ---------------- */
  // Iso projection: grid (x, y) and height z (px at scale 1) to screen pixels.
  const P = (x, y, z = 0) => [W / 2 + ((x - cam.x) - (y - cam.y)) * TW * S, H / 2 + ((x - cam.x) + (y - cam.y)) * TH * S - z * S];
  function diamond(c, x, y, w = 1, d = 1) { const a = P(x, y), b = P(x + w, y), e = P(x + w, y + d), f = P(x, y + d); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...e); c.lineTo(...f); c.closePath(); }
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = v => clamp(0, Math.round(v * k), 255); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
  // A box centred on (cx, cy) with half sizes hx, hy, from z0 up h.
  function box(c, cx, cy, hx, hy, z0, h, col, top) {
    const A = (x, y, z) => P(cx + x, cy + y, z0 + z);
    c.beginPath(); c.moveTo(...A(-hx, hy, 0)); c.lineTo(...A(hx, hy, 0)); c.lineTo(...A(hx, hy, h)); c.lineTo(...A(-hx, hy, h)); c.closePath(); c.fillStyle = shade(col, .88); c.fill();
    c.beginPath(); c.moveTo(...A(hx, -hy, 0)); c.lineTo(...A(hx, hy, 0)); c.lineTo(...A(hx, hy, h)); c.lineTo(...A(hx, -hy, h)); c.closePath(); c.fillStyle = shade(col, .72); c.fill();
    c.beginPath(); c.moveTo(...A(-hx, -hy, h)); c.lineTo(...A(hx, -hy, h)); c.lineTo(...A(hx, hy, h)); c.lineTo(...A(-hx, hy, h)); c.closePath(); c.fillStyle = top || shade(col, 1.08); c.fill();
  }
  const GROUND = {lot: '#a6d877', edge: '#94cf6a', park: '#8fd16a', plaza: '#e9dcc0', dirt: '#d7b98a', road: '#6a7280', bridge: '#8a6f55', water: '#62c2ea'};
  function drawGround(c) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = tile(x, y); diamond(c, x, y); c.fillStyle = (x + y) % 2 && t.kind !== 'road' ? shade(GROUND[t.kind], .97) : GROUND[t.kind]; c.fill();
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
    c.fillStyle = '#8c6a48'; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(b[0], b[1] + d * S); c.lineTo(a[0], a[1] + d * S); c.closePath(); c.fill();
    c.fillStyle = '#6f5238'; c.beginPath(); c.moveTo(...b); c.lineTo(...e); c.lineTo(e[0], e[1] + d * S); c.lineTo(b[0], b[1] + d * S); c.closePath(); c.fill();
  }
  function drawBuilding(c, b, night) {
    const cx = b.x + .5, cy = b.y + .5;
    if (b.kind === 'house') {
      box(c, cx, cy, .36, .36, 0, b.h, b.wall);
      const top = P(cx, cy, b.h + 16), corners = [[-.42, -.42], [.42, -.42], [.42, .42], [-.42, .42]].map(([x, y]) => P(cx + x, cy + y, b.h));
      c.fillStyle = shade(b.roof, .82); c.beginPath(); c.moveTo(...corners[3]); c.lineTo(...corners[2]); c.lineTo(...top); c.closePath(); c.fill();
      c.fillStyle = shade(b.roof, .66); c.beginPath(); c.moveTo(...corners[2]); c.lineTo(...corners[1]); c.lineTo(...top); c.closePath(); c.fill();
      win(c, cx - .12, cy + .36, 5, b.h * .55, night, 'y'); c.fillStyle = '#7a4a2b'; door(c, cx + .1, cy + .36);
    } else if (b.kind === 'shop') {
      box(c, cx, cy, .4, .4, 0, b.h, b.wall);
      c.fillStyle = b.awning; c.beginPath(); c.moveTo(...P(cx - .4, cy + .4, b.h * .62)); c.lineTo(...P(cx + .4, cy + .4, b.h * .62)); c.lineTo(...P(cx + .4, cy + .56, b.h * .45)); c.lineTo(...P(cx - .4, cy + .56, b.h * .45)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(...P(cx - .4 + k * .2, cy + .4, b.h * .62)); c.lineTo(...P(cx - .3 + k * .2, cy + .4, b.h * .62)); c.lineTo(...P(cx - .3 + k * .2, cy + .56, b.h * .45)); c.lineTo(...P(cx - .4 + k * .2, cy + .56, b.h * .45)); c.closePath(); c.fill(); }
      win(c, cx, cy + .4, 9, b.h * .3, night, 'y'); win(c, cx + .4, cy, 6, b.h * .7, night, 'x');
      const s = P(cx, cy + .2, b.h + 7); c.fillStyle = '#ffffff'; const fs = Math.max(6, 6.5 * S); c.font = `800 ${fs}px system-ui`; c.textAlign = 'center'; const tw = c.measureText(b.name).width + 6; c.fillRect(s[0] - tw / 2, s[1] - fs * .8, tw, fs * 1.25); c.fillStyle = b.awning; c.fillText(b.name, s[0], s[1] + fs * .3);
    } else if (b.kind === 'tower') {
      box(c, cx, cy, .4, .4, 0, b.h, b.wall);
      for (let z = 8; z < b.h - 6; z += 9) { win(c, cx - .2, cy + .4, 4, z, night, 'y'); win(c, cx + .15, cy + .4, 4, z, night, 'y'); win(c, cx + .4, cy - .15, 4, z, night, 'x'); win(c, cx + .4, cy + .2, 4, z, night, 'x'); }
      box(c, cx + .15, cy - .12, .1, .1, b.h, 8, '#c9cfd8');
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
    c.fillStyle = night ? (Math.sin(x * 91 + y * 37 + z) > -.3 ? '#ffe59a' : '#3b4660') : '#cfe9ff';
    c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(b[0], b[1] - size * .9 * S); c.lineTo(a[0], a[1] - size * .9 * S); c.closePath(); c.fill();
  }
  function door(c, x, y) { const a = P(x - .07, y, 0), b = P(x + .07, y, 0); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(b[0], b[1] - 9 * S); c.lineTo(a[0], a[1] - 9 * S); c.closePath(); c.fill(); }
  function drawTree(c, p) { const [x, y] = P(p.x, p.y); c.fillStyle = '#7a5235'; c.fillRect(x - 1.5 * S, y - 10 * S * p.s, 3 * S, 10 * S * p.s); for (const [dy, r, k] of [[16, 8, .85], [22, 6.5, 1], [27, 4.5, 1.12]]) { c.fillStyle = shade(p.c, k); c.beginPath(); c.arc(x, y - dy * S * p.s, r * S * p.s, 0, TAU); c.fill(); } }
  function drawProp(c, p, night) {
    const [x, y] = P(p.x, p.y);
    if (p.kind === 'tree') drawTree(c, p);
    else if (p.kind === 'bench') { box(c, p.x, p.y, .25, .08, 3, 2, '#b8784a'); }
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
  function drawMover(c, m, night) {
    const [ox, oy] = laneOffset(m), mx = m.x + (m.path ? 0 : ox), my = m.y + (m.path ? 0 : oy), [x, y] = P(mx, my, m.lift || 0), s = S;
    if (m.kind === 'bike') {
      const f = DIRS[m.d], [ax, ay] = P(mx - f[0] * .1, my - f[1] * .1, 3), [bx, by] = P(mx + f[0] * .1, my + f[1] * .1, 3), spin = clock * 10 * m.v;
      c.strokeStyle = '#2d3440'; c.lineWidth = Math.max(1, s); for (const [wx, wy] of [[ax, ay], [bx, by]]) { c.beginPath(); c.arc(wx, wy, 2.6 * s, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(spin) * 2.6 * s, wy + Math.sin(spin) * 2.6 * s); c.stroke(); }
      c.strokeStyle = m.col; c.lineWidth = 1.6 * s; c.beginPath(); c.moveTo(ax, ay); c.lineTo((ax + bx) / 2, (ay + by) / 2 - 4 * s); c.lineTo(bx, by); c.stroke();
      const [rx, ry] = P(mx, my, 10); c.fillStyle = m.col; c.fillRect(rx - 2 * s, ry - 6 * s, 4 * s, 6 * s); c.fillStyle = m.skin; c.beginPath(); c.arc(rx, ry - 8.5 * s, 2.4 * s, 0, TAU); c.fill(); c.fillStyle = shade(m.col, .8); c.beginPath(); c.arc(rx, ry - 9.5 * s, 2.6 * s, Math.PI, 0); c.fill();
      return;
    }
    if (m.type === 'car') {
      const along = m.d < 2, len = m.kind === 'bus' ? .42 : m.kind === 'fire' ? .38 : m.kind === 'racer' ? .3 : .26, wid = .14;
      const hx = along ? len : wid, hy = along ? wid : len, hgt = m.kind === 'bus' ? 13 : m.kind === 'racer' ? 4 : 8;
      box(c, mx, my, hx, hy, (m.lift || 0) + 2, hgt, m.col);
      if (m.kind !== 'bus' && m.kind !== 'racer') box(c, mx - (along ? (m.d === 0 ? .05 : -.05) : 0), my - (along ? 0 : (m.d === 2 ? .05 : -.05)), hx * .55, hy * .9, (m.lift || 0) + 2 + hgt, 5, m.col, '#cfe9ff');
      if (m.kind === 'racer') { const t = P(mx, my, hgt + 3); c.fillStyle = '#fff'; c.font = `900 ${5 * s}px system-ui`; c.textAlign = 'center'; c.fillText(String(m.num || 1), t[0], t[1]); }
      if (m.kind === 'taxi') { const t = P(mx, my, (m.lift || 0) + hgt + 9); c.fillStyle = '#222'; c.fillRect(t[0] - 3 * s, t[1] - 2 * s, 6 * s, 2.5 * s); }
      if (m.kind === 'icecream') { const t = P(mx, my, hgt + 13); c.fillStyle = '#f7d9a8'; c.beginPath(); c.moveTo(t[0] - 3 * s, t[1]); c.lineTo(t[0] + 3 * s, t[1]); c.lineTo(t[0], t[1] + 7 * s); c.fill(); c.fillStyle = '#ff8fd0'; c.beginPath(); c.arc(t[0], t[1] - 1 * s, 3.4 * s, 0, TAU); c.fill(); }
      if (m.siren && Math.sin(clock * 14) > 0) { const t = P(mx, my, hgt + 6); c.fillStyle = '#4da3ff'; c.beginPath(); c.arc(t[0], t[1], 2.4 * s, 0, TAU); c.fill(); }
      if (m.ladder) { c.strokeStyle = '#d9d9d9'; c.lineWidth = Math.max(1, 1.6 * s); c.beginPath(); c.moveTo(...P(mx, my, hgt + 3)); c.lineTo(...P(mx, my - 1, 40)); c.stroke(); }
      if (night) { const f = DIRS[m.d], h = P(mx + f[0] * len, my + f[1] * len, 6); c.fillStyle = 'rgba(255,240,170,.9)'; c.beginPath(); c.arc(h[0], h[1], 1.6 * s, 0, TAU); c.fill(); }
      return;
    }
    const bob = m.dance ? Math.abs(Math.sin(clock * 7 + m.ph)) * 4 * s : Math.abs(Math.sin(clock * 8 * m.v + m.ph)) * 1.5 * s;
    if (m.kind === 'cart') { box(c, mx, my, .12, .12, 3, 6, '#b8c2cc', '#dfe6ee'); return; }
    if (m.kind === 'dog') { c.fillStyle = '#b07a45'; c.beginPath(); c.ellipse(x, y - 4 * s - bob, 4.5 * s, 2.6 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 4 * s * (m.d === 1 || m.d === 3 ? -1 : 1), y - 6.5 * s - bob, 2.2 * s, 0, TAU); c.fill(); c.strokeStyle = '#d95b5b'; c.lineWidth = 1.4 * s; c.beginPath(); c.moveTo(x + 5 * s, y - 6 * s - bob); c.quadraticCurveTo(x + 9 * s, y - 2 * s, x + 12 * s, y - 6 * s); c.stroke(); return; }
    if (m.kind === 'hen') { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y - 3.5 * s - bob, 3 * s, 2.4 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#e2463a'; c.fillRect(x + 1.5 * s, y - 7 * s - bob, 1.6 * s, 1.6 * s); return; }
    if (m.kind === 'llama') { c.fillStyle = '#f3ead6'; c.beginPath(); c.ellipse(x, y - 8 * s, 5 * s, 3.5 * s, 0, 0, TAU); c.fill(); c.fillRect(x + 3 * s, y - 18 * s, 2.4 * s, 10 * s); c.beginPath(); c.ellipse(x + 4.5 * s, y - 19 * s, 2.6 * s, 1.8 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#222'; c.fillRect(x + 3 * s, y - 20 * s, 3.5 * s, 1.2 * s); return; }
    if (m.kind === 'penguin') { c.fillStyle = '#222'; c.beginPath(); c.ellipse(x, y - 5 * s, 2.8 * s, 4.4 * s, Math.sin(clock * 6 + m.ph) * .2, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + .6 * s, y - 4.5 * s, 1.6 * s, 3 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#f2a33a'; c.fillRect(x + 1.4 * s, y - 8 * s, 2 * s, 1 * s); return; }
    if (m.kind === 'ghost') { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y - 10 * s - bob, 4 * s, Math.PI, 0); c.lineTo(x + 4 * s, y - 2 * s - bob); for (let k = 0; k < 4; k++) c.lineTo(x + (4 - k * 2.6) * s, y - (k % 2 ? 3.5 : 1.5) * s - bob); c.closePath(); c.fill(); c.fillStyle = '#222'; c.fillRect(x - 2 * s, y - 11 * s - bob, 1.2 * s, 1.6 * s); c.fillRect(x + .8 * s, y - 11 * s - bob, 1.2 * s, 1.6 * s); return; }
    if (m.kind === 'dino') { const g = '#7cc65a'; c.fillStyle = g; c.beginPath(); c.ellipse(x, y - 14 * s - bob, 12 * s, 7 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - 10 * s, y - 14 * s); c.quadraticCurveTo(x - 22 * s, y - 12 * s, x - 26 * s, y - 6 * s); c.lineTo(x - 9 * s, y - 10 * s); c.fill(); c.beginPath(); c.moveTo(x + 6 * s, y - 18 * s); c.quadraticCurveTo(x + 10 * s, y - 34 * s, x + 14 * s, y - 36 * s); c.lineTo(x + 18 * s, y - 34 * s); c.quadraticCurveTo(x + 12 * s, y - 26 * s, x + 11 * s, y - 15 * s); c.fill(); c.beginPath(); c.ellipse(x + 17 * s, y - 37 * s, 5 * s, 3.4 * s, 0, 0, TAU); c.fill(); c.fillRect(x - 6 * s, y - 9 * s, 3.5 * s, 9 * s); c.fillRect(x + 3 * s, y - 9 * s, 3.5 * s, 9 * s); c.fillStyle = '#222'; c.beginPath(); c.arc(x + 18.5 * s, y - 38 * s, .9 * s, 0, TAU); c.fill(); c.fillStyle = '#4f9e4a'; for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x - 6 * s + k * 4 * s, y - 20 * s, 1.6 * s, 0, TAU); c.fill(); } return; }
    const slip = m.slip && clock - m.slip < 2.5, body = m.kind === 'robot' ? '#c0c8d4' : m.kind === 'runner' ? '#ffffff' : m.kind === 'band' ? '#d9533e' : m.col;
    c.save(); c.translate(x, y - bob + (m.sit ? 3 * s : 0)); if (slip) c.rotate(Math.PI / 2 * Math.min(1, (clock - m.slip) * 4));
    c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(0, bob, 3 * s, 1.2 * s, 0, 0, TAU); c.fill();
    c.fillStyle = body; c.fillRect(-2.2 * s, -9 * s, 4.4 * s, 7 * s); c.fillStyle = '#3b3f4a'; c.fillRect(-2 * s, -2 * s, 1.6 * s, 2 * s); c.fillRect(.4 * s, -2 * s, 1.6 * s, 2 * s);
    c.fillStyle = m.kind === 'robot' ? '#9aa6b5' : m.skin; c.beginPath(); c.arc(0, -11.5 * s, 2.6 * s, 0, TAU); c.fill();
    if (m.kind === 'chef') { c.fillStyle = '#fff'; c.fillRect(-2.4 * s, -16.5 * s, 4.8 * s, 3.5 * s); }
    if (m.kind === 'robot') { c.fillStyle = '#ff5d5d'; c.fillRect(-.6 * s, -16 * s, 1.2 * s, 2.4 * s); }
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
    if (e.sky) push(e.sky.x + e.sky.y + 40, () => { const q = e.sky, [x, y] = P(q.x, q.y, q.z), s = S;
      if (q.kind === 'hotair') { const cols = ['#e2463a', '#ffd23f', '#3f8fd6']; for (let k = 0; k < 3; k++) { c.fillStyle = cols[k]; c.beginPath(); c.ellipse(x, y - 22 * s, (14 - k * 4.5) * s, 17 * s, 0, 0, TAU); c.fill(); } c.strokeStyle = '#6b4a2b'; c.lineWidth = s; c.beginPath(); c.moveTo(x - 8 * s, y - 10 * s); c.lineTo(x - 4 * s, y); c.moveTo(x + 8 * s, y - 10 * s); c.lineTo(x + 4 * s, y); c.stroke(); c.fillStyle = '#a8784a'; c.fillRect(x - 4 * s, y, 8 * s, 5 * s); }
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
    dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = Math.round(innerWidth * dpr); H = cv.height = Math.round(innerHeight * dpr);
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const fit = Math.min(W / (N * TW * 2 + 60), H / (N * TH * 2 + 200));
    base = innerWidth < 700 ? Math.max(fit, (W / (9 * TW * 2))) : fit;   // phones see part of the town and follow the action
    sprites.clear();
  }
  // A five-minute day: about three minutes of daylight, a dusk, a night and a dawn.
  function nightLevel() { return clamp(0, -Math.cos(clock / 300 * TAU) * 2 - 1, 1); }
  function update(dt) {
    clock += dt;
    for (const m of movers.slice()) step(m, dt);
    for (const e of events.slice()) { e.t += dt; if (e.follow) { e.x = e.follow.x; e.y = e.follow.y; } if (e.update) e.update(e, dt); if (e.t > e.dur) { if (e.end) e.end.call(e); events.splice(events.indexOf(e), 1); } }
    for (const m of movers.slice()) if (m.home && !m.path) remove(m);
    for (const p of props) if (p.kind === 'duck') { p.x += p.vx * dt; if (p.x < .3 || p.x > 17.5) p.vx *= -1; }
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
    if ((nextEvent -= dt) <= 0) { if (events.length < 3) randomEvent(); nextEvent = 7 + Math.random() * 6; }   // an unhurried rhythm
    // Traffic: keep the streets busy as cars leave and events come and go.
    while (movers.filter(m => m.type === 'car' && (m.kind === 'car' || m.kind === 'bus' || m.kind === 'taxi')).length < CARS) spawnCar();
    while (movers.filter(m => m.kind === 'bike').length < BIKES) spawnBike();
    while (movers.filter(m => m.type === 'person' && !m.kind).length < PEOPLE) spawnPerson();
    // The camera stays put (no zooming after events); a drag pans it, and it eases to where it was dragged.
    const k = Math.min(1, dt * 4); cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z = 1;
  }
  function render() {
    S = base * cam.z * dpr / dpr; S = base * cam.z;
    const night = nightLevel();
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, night > .5 ? '#1d2747' : '#bfe6f7'); sky.addColorStop(1, night > .5 ? '#2e3a63' : '#e8f6fb');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    drawGround(ctx);
    // Water glints.
    ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 40; k++) { const x = (k * 7.3 + clock * .2) % 18, y = 13 + (k * .37) % 2, s = P(x, y); if (Math.sin(clock * 2 + k) > .6) ctx.fillRect(s[0], s[1], 4 * S, 1.2 * S); }
    const list = [], push = (k, f) => list.push([k, f]);
    for (const b of buildings) push(b.x + b.y + 1, () => drawBuilding(ctx, b, night > .5));
    for (const p of props) if (p.kind === 'skymoon' || p.kind === 'skymars') push(-99, () => { const [x, y] = [W * .8, H * .16], r = Math.min(W, H) * .06; ctx.fillStyle = p.kind === 'skymars' ? '#d9603e' : '#fff6d8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.fillStyle = p.kind === 'skymars' ? 'rgba(120,40,20,.35)' : 'rgba(200,190,160,.35)'; for (const [dx, dy, k] of [[-.3, -.2, .22], [.25, .2, .16], [.1, -.4, .1]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, k * r, 0, TAU); ctx.fill(); } if (p.crescent) { ctx.fillStyle = night > .5 ? '#1d2747' : '#bfe6f7'; ctx.beginPath(); ctx.arc(x + r * .45, y - r * .15, r * .9, 0, TAU); ctx.fill(); } });
    else if (p.kind === 'rangoli') push(p.x + p.y - 3, () => drawProp(ctx, p, night));
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
  function setCard(list) {
    const lead = list[0], short = t => t.length > 100 ? t.slice(0, 97) + '…' : t;
    document.getElementById('date').textContent = new Date().toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});
    document.getElementById('theme').textContent = `${lead.emoji} Today: ${lead.title}`;
    document.getElementById('news').textContent = lead.story ? `Inspired by today's news: ${short(lead.story)}` + (list.length > 1 ? `  Also in town: ${list.slice(1).map(v => v.emoji + ' ' + v.title).join(', ')}.` : '') : 'A gentle little town, new every day.';
  }
  async function start() {
    layout();
    const h = location.hash.slice(1), random = h.startsWith('new');
    day = today();
    const daySeed = hash(+day.replace(/-/g, ''), 0x70e);
    today_ = random ? [] : newsThemes(await fetchNews(day));
    if (!today_.length) today_ = [VARIANTS[(random ? Math.random() * 1e9 | 0 : daySeed) % VARIANTS.length]];   // no usable story: the date (or chance) picks one
    build(random ? (Math.random() * 1e9) | 0 : daySeed, today_[0].key);
    decorate(today_);
    setCard(today_);
    clock = 0; nextEvent = 1.5;
    setTimeout(() => randomEvent(), 400);
    setTimeout(() => startEvent(today_[0].variant), 3500);
    requestAnimationFrame(frame);
    setTimeout(() => { const el = document.getElementById('hint'); if (el) el.style.opacity = '0'; }, 6000);
  }
  // A tap pokes the town: something happens right there.
  function poke(e) {
    const r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) * dpr, sy = (e.clientY - r.top) * dpr;
    const u = (sx - W / 2) / (TW * S), v = (sy - H / 2) / (TH * S), gx = (u + v) / 2 + cam.x, gy = (v - u) / 2 + cam.y;
    const names = ['balloon', 'butterflies', 'kite', 'pigeons', 'busker'];
    startEvent(names[Math.random() * names.length | 0], clamp(1.5, gx, 16.5), clamp(1.5, gy, 16.5));
  }
  if (typeof window !== 'undefined' && cv) {
    addEventListener('resize', layout);
    // A drag looks around (useful on phones, where the town is wider than the screen); a tap pokes.
    let down = null;
    cv.addEventListener('pointerdown', e => { down = {x: e.clientX, y: e.clientY, cx: cam.tx, cy: cam.ty, moved: false}; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = (e.clientX - down.x) * dpr / (TW * S), dy = (e.clientY - down.y) * dpr / (TH * S);
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
      if (down.moved) { cam.tx = clamp(2, down.cx - (dx + dy) / 2, N - 2); cam.ty = clamp(2, down.cy - (dy - dx) / 2, N - 2); cam.x = cam.tx; cam.y = cam.ty; }
    });
    cv.addEventListener('pointerup', e => { if (down && !down.moved) poke(e); down = null; });
    cv.addEventListener('pointercancel', () => { down = null; });
    addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.type === 'town:motion') playing = !!e.data.playing; });
    addEventListener('hashchange', () => location.reload());
    start();
  }
  return {CALM, lightPhase, themeFromNews, newsThemes, VARIANTS, VARIANT_EVENTS: () => Object.keys(VARIANT_EVENTS), decorate, setToday: l => { today_ = l; }, PACE, THEMES, GRIM, build, update, events: () => events, movers: () => movers, buildings: () => buildings, props: () => props, startEvent, randomEvent, setPlaying: v => { playing = v; }, debug: () => ({clock, theme, seed, night: nightLevel(), cam: {...cam}})};
})();
