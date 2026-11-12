# New Toy Town: build spec

A hand-authored storybook town (toy-box shapes, a roundabout square, curved lanes, rolling hills, a named cast)
that will replace the current grid town. Our own designs throughout: the *style* of a classic toy-town show,
never its characters, vehicles or buildings.

This document is for whoever continues or tests the work. Read `TOY_TOWN_COLLAB.md` first (shared protocol:
log a START entry before touching code, a DONE entry after, no force pushes).

## 1. Where things stand

| Phase | Scope | State |
|---|---|---|
| 1 | Town definition, road graph, terrain, camera, page | **Done** |
| 2 | The Square and first landmarks (14 buildings), a cast of 10, 3 vehicles | **Done** |
| 3 | Remaining districts: station and shuttle train, school with playground, farm with animals, garage, harbour hut with a jetty and boat, pond with ducks, a fifth cottage | **Done** (no stream, no extra cottages) |
| 4 | Full cast life: timetables by hour, named vehicles (milk float, tractor, fire engine, ice-cream van), a train | **Done** |
| 5 | Day and night, weather, small stories, the daily-news staging | **Done** (no sound, no tapping on things, no lamplighter figure: lanterns just glow) |
| 6 | Phone performance pass, then make it the default town | Adaptive resolution **done**; measuring on a real phone and the switch are **open** (the owner decides the switch) |
| 7 | A bigger city: 8 spokes and an outer ring road, a railway loop round the whole town with a four-car train and stations, buildings at 0.8 scale, 30 buildings and 26 residents, vehicles on a lane network | **Done** |
| 8 | The train gets work: commuters ride between stations, a goods wagon carries mail, milk and bread (picked up, walked to a platform, carried, collected, delivered), and the owner can send a parcel and watch a work board | **Done** |

It is live at `toy-town-new.html` (or `toy-town.html?town=new`, or `index.html?town=new#toy-town`). The current
town is untouched and stays the default until the owner approves the switch.

## 2. Files

| File | Role | May import |
|---|---|---|
| `assets/town2/curve.mjs` | Catmull-Rom curve sampling, shared by `def` (to place buildings along streets) and `graph` | nothing |
| `assets/town2/def.mjs` | The town as data: palette, island, roads, buildings (with a layout solver), lamps, cast, vehicles, bus lines, the railway, trees, `heightAt` | `curve` |
| `assets/town2/graph.mjs` | Road graph, door-to-door walks, lanes and route planning for vehicles, the railway loop | `def`, `curve` |
| `assets/town2/weather.mjs` | Spells of clear, cloud, rain, drizzle; `rain` eases 0..1 | `def` |
| `assets/town2/stories.mjs` | The small stories (data) and `newsStory(title, category)` | nothing |
| `assets/town2/sky.mjs` | `skyAt(hour, rain, season)`: sky, fog, sea, sun/moon, window glow, stars (hex strings); `seasonOf(date)`, `SEASONS` | nothing |
| `assets/town2/sound.mjs` | `soundPlan`, `chimeDue` (pure) and `createSound` (Web Audio, synthesised, opt-in) | nothing |
| `assets/town2/inspect.mjs` | What to say about a tapped resident, vehicle, animal, train or building | `def`, `stories` |
| `assets/town2/sim.mjs` | Who is where and when (residents, vehicles on lanes, the train, weather, stories) | `def`, `graph`, `weather`, `stories` |
| `assets/town2/build.mjs` | Geometry builders (THREE) | `def`, `graph`, `three` |
| `assets/town2/main.mjs` | Renderer, camera, controls, loop, test hooks | all |
| `toy-town-new.html` | The page (import map for three 0.187 from the CDN) | |
| `tests/toy-town-new.test.cjs` | Logic test, no browser | |
| `tests/toy-town-new-visual.cjs` | Real-WebGL check and screenshots | |

Rule: `def`, `graph`, `weather`, `stories`, `sky`, `sound` (its plan; the audio graph only needs an `AudioContext`), `inspect` and `sim` are pure (no THREE, no DOM), so they run in Node. Keep it that way.

**After editing anything under `assets/town2`, run `node scripts/stamp-town2.cjs`.** It stamps `toy-town-new.html` with a hash of the modules: the page's import map
points every module at `<file>?v=<hash>`, so a browser (Edge was seen mixing a cached old module with new page code) always fetches matching files. The logic test fails if
the stamp is stale. If the page cannot start, its panel now shows the real error (`#why`), and `main.mjs` retries the WebGL context with plainer options before giving up.

## 3. World model

- **Axes:** x east, z south, y up. One unit is about a cottage width at the old scale; houses and buildings are now drawn at `BUILD_SCALE` = 0.8
  (people, vehicles and trees follow). The island is a wobbly ellipse, 19.4 × 15.9 half-axes (`shore(x,z)` < 1 is land).
- **Ground:** `heightAt(x,z)`. Flat inside ~4 units of the square, rolling beyond, Windmill Hill (`HILL`, +1.1) under the windmill in the north,
  falling under the sea (y = −0.12) at the shore. Everything is placed at `heightAt`.
- **Roads:** one connected network. An **inner ring** (radius 2.4, one way, clockwise seen from above) round the square; **eight spokes** every
  45° (High Street E, Harbour Road SE, Station Road S, School Road SW, Cottage Lane W, Farm Road NW, Windmill Lane N, Pond Road NE; the diagonal
  ones bow a little) out to an **outer ring road** (an ellipse 11.6 × 8.4, two-way). Nodes `in0..in7` (inner ring) and `out0..out7` (outer ring);
  every road is a `ROADS` entry `{id, kind: 'spoke' | 'ring' | 'outer', a, b, oneway, points}`, 24 in all. Road width 0.95, lane offset 0.22
  (vehicles keep left), pavements 0.66 from the centre line.
- **Railway:** a closed ellipse (`LOOP`, 16.0 × 13.4) round the whole town, outside every building and road, so it never crosses one. Stations
  (`STATIONS`, angles round the loop; Central beside the station building in the south, Harbour Halt, School Halt, Mill Halt) each have a platform,
  shelter, bench and sign. The harbour pier crosses the railway on a trestle (`PIER`) so the train runs under it.
- **Graph:** `buildGraph()` → `nodes`, `edges` (each a sampled polyline with running length, read with `along(line, s) → {x, z, tx, tz}`),
  `doors` (every doorstep and lamp spot attached to its nearest edge, with the side of the road), `walk(fromId, toId)`, the **lanes** and the `loop`.
- **Lanes:** each two-way road has a lane each way (`<edge id>+` is a→b, `-` is b→a, keeping left), the inner ring one lane clockwise;
  `graph.laneRoute(fromLane, toLane)` is the shortest list of lanes (no U-turns; the same lane means the way round to it), `graph.lanePoint(x, z)`
  the nearest lane point, and `graph.routeLine(lanes)` one smooth line to follow with `bounds` saying where each lane starts and ends along it.
- **Buildings:** `{id, type, name, x, z, ry, door, w, scale, street, s, side}`. `ry` turns the front (local +z) to face that way; `door` is the distance
  from the centre to the doorstep (already scaled), `w` the footprint width. `doorOf(b)` is the doorstep in world space. The landmarks round the square
  (`wedge`) are placed by hand, between the spokes and facing the clock; all the others come from the **layout solver** in `def.mjs`: each building
  lists the streets it likes (`[road, side, from]`) and takes the first spot along them that is clear of every other building, every road, the railway,
  the pond and the paddock, facing its street with its doorstep on the pavement. A building that fits nowhere is simply left out (the logic test checks
  that all expected ids exist).

### Adding things (data only)

- **A road:** add an entry to `ROADS` between two nodes (add a node to `NODES` if needed). The graph, the lanes, the pavements and the drawing follow;
  routing works for any connected network, one-way roads included (`oneway: true`).
- **A street house:** add a `put(id, type, name, prefs, extra)` line to the layout solver in `def.mjs` (the cottages are listed in `houses`).
- **A building of a new kind:** write `BUILD.<type>(bag, def, anim)` in `build.mjs` and add its `WIDTH`/`DOOR` to `def.mjs`; then `put` it. The logic test
  checks it overlaps nothing and is clear of the roads and the railway.
- **A resident:** add to `CAST` with a `home`, optional `wake`/`sleep` hours and a `round` of `[buildingId, secondsToStay]`. Every place in
  a round must have a door.
- **A vehicle:** add to `VEHICLES` (`kind`: `car`, `van`, `bus`, `float`, `tractor`, `icecream`, `fire`; new kinds need a branch in `buildVehicle`) with a `plan` (`line`, `taxi`, `round`, `stops`, `wander`, `call`) and `targets` (building ids) or a `BUS_LINES` line, a `home` building (its garage), the hours it works (`from`, `to`) or `onCall: true`. Vehicles are parked (invisible) in their garage outside their hours, leave and return only by their own garage, and an `onCall` one (the fire engine, `sim.dispatchFire()`) goes out for a run round the town and comes back.

## 4. Behaviour rules (tested)

1. **Doors only.** A resident is either `inside` (invisible) or `walking`. Walks start and end exactly on a
   doorstep. Nobody appears or vanishes anywhere else.
2. **Pavements.** Walks follow the pavement of each edge (the outer side on the ring), door to door, by the
   shortest way over the graph. At a junction the walk hops across the road mouth.
3. **Vehicles on a lane network.** Each vehicle has a plan (`VEHICLES[].plan`) that picks where to go next (a bus line stop, a random doorstep, the next house on a round);
   it routes there over the lanes (shortest path, no U-turns), follows one smooth line, stands for `dwell` seconds, plans the next leg, and drives home to its own
   garage when its hours end. Rules on the road: keep a gap behind whoever is ahead going my way (or across my path); stop for anyone walking in the road just
   ahead; **take the lock on a junction before going into it** (one vehicle at a time through each node, and only when the lane beyond has room), else stop short;
   a vehicle stuck for 20 s stops being polite for 6 s so nothing blocks the town for ever. Vehicles do not overtake.
3b. **The train.** `sim.train` circles the railway loop clockwise at up to 1.25 units a second, slows into each station (`stationStops`, a point 1.5 past the platform's
   middle so the four cars stand along it), stands 7–10 s (`train.at` names the station), then goes on. `train.s` is the head's distance round the loop and the cars follow at
   `train.gap` spacing; `train.laps` and `train.stopsMade` count laps and stops.
4. **The day.** One day is `DAY` = 480 s of simulation, starting at 06:00 (`sim.hour`, `sim.setHour(h)`). Residents wake and
   sleep by their own hours and everybody heads home after hours, so the town is nearly empty at night. Vehicles
   work their hours, then drive on to their own garage (never any other) and park out of sight.
5. **Weather.** `sim.weather` (`kind`, `rain`, `cloud`) runs in the sim. In rain vehicles slow by up to 18 %, walkers speed up by 15 %,
   every resident puts up an umbrella (a small hidden mesh each, shown when `rain > .25`), streaks fall round the view,
   and the sky and sun dull. `sim.weather.force('rain', seconds)` makes it rain.
6. **Small stories.** `sim.story` runs one story at a time from `STORIES`: when its hours, weather and cast fit, each resident in it gets
   a queue of `errands` (`[place, seconds]`) that they walk door to door before resuming their round. The least-seen stories are favoured and
   each has a 180 s cooldown. The news stages the same stories: `main.mjs` reads `assets/toy-town-news.json` (light headlines), maps each with
   `newsStory(title, category)` and calls `sim.stage(id, headline)`; it waits for half the cast to be up, then the caption shows "In the news: ...".
7. **Light.** `sky.mjs` gives dawn about 06:00, day, dusk about 18:30 and a dark blue night; at night every window pane and lantern glows
   (one extra draw call: the `glow` mesh, collected by `Bag` pieces made with `glow: true`) and stars and a moon appear.
8. **Tapping.** A tap (under 10 px of movement, under 600 ms, one finger) picks the nearest mover on screen (residents 34 px, vehicles 40,
   animals 26, the train 44), else the building nearest the ground point under the finger (within 1.5 units). It puts a ring on it and shows a
   card (name and what it is doing, refreshed every 0.4 s); the camera follows anything that moves until the next drag; the x or a second tap
   on a building closes it. Wording lives in `inspect.mjs` so it can be tested without a browser.
9. **Seasons.** The season comes from today's date (Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Nov autumn) or `?season=`; the chip's
   four icons reload with another. It is fixed at build time: `setSeason` swaps only the palette names `leaf`, `leafLight`, `grass`, `grassDark`
   (foliage and grass; never use these names for anything else), so trees, bushes and the ground change colour at no cost. `buildFall(season)` is one
   `Points` mesh: petals (spring), fireflies (summer nights), leaves (autumn), snow (winter, heavier in a rain spell, which in winter draws no rain
   streaks). `skyAt` tints the daytime sky and weakens and lowers the winter sun. Four stories are seasonal (`season` in `STORIES`) and the sim only
   runs a seasonal story in its season.
10. **Sound.** Off until the visitor taps the speaker button (top right; remembered in `localStorage`, and a remembered "on" starts at the first tap
   because browsers need a gesture). Everything is synthesised (no files): wind and waves (looped noise through filters), rain (more with zoom, none in
   snow), birds by day, crickets on warm nights, the clock tower striking the hour from 07:00 to 21:00, the little train's whistle, a soft blip on a
   tap. It pauses when the tab is hidden. `soundPlan(state)` decides the levels and is tested in Node; the graph is tested against a fake `AudioContext`.
11. **Pedestrian manners.** People leave their doors one at a time (at least 2.2 s apart, at most 7 out at once outside curfew), walk a hand's width
   to the left of the pavement's middle (so two people going opposite ways pass cleanly), wait behind a slower person ahead (never for more than 5 s),
   and stop for a moment to say hello when they meet head on (once per 45 s per person; they turn to face each other, shown on the tap card).
12. **The lamplighter.** Mr Wick (`lamplighter: true` in `CAST`, home Lantern Cottage) tends `LAMPS` (the square's eight and one every couple of units
   along each street). From 17:12 to 20:36 he walks, briskly and nearest-first, to every lamp that is still off and lights it (0.55 s each); from 04:36 to 07:30 he puts
   them out. Outside those hours the clock decides (lit from 20:36 to 04:36, out from 07:30 to 17:12). Each lantern's glow is one instance of a single `InstancedMesh`
   (`built.lampGlow`), so they come on one by one at no extra cost; they glow faintly in daylight and fully in the dark. `sim.lamps` (`on`, `lit`), `sim.lampsTended`.
13. **Puddles.** `weather.wet` (0..1) rises in rain and drains in about 45 s of dry weather. `buildPuddles` makes 50 flat ovals on roads, pavements and
   verges as one `InstancedMesh`; each appears at its own wetness and grows as the ground gets wetter. There are none in winter (the rain is snow).
14. **Determinism.** `createSim(seed)` gives the same town life for the same seed and step sequence.

### Freight and passengers (sim.mjs, tested)

- **Cargo** `{id, kind: mail|milk|bread|parcel, from, to, originStation, destStation, state: ready|carried|station|train, holder, direct}`. Templates live in `def.FREIGHT` (what, from where, to where, which hours). `stationOf(id)` is the platform nearest by walking. If two buildings share a station, or are under 12 units apart on foot, the carrier just walks it over (`direct`).
- **Chain**: the nearest idle resident picks it up (errand `pickup:ID`), walks to the origin platform (`station:ID`: it waits there), the train takes it when it stops (wagon holds `train.wagon`), unloads at the destination station, the nearest idle resident collects it (`pickup:ID` at the platform) and `deliver:ID` at the door. Carriers hurry (x1.8) and are exempt from the walker cap; anybody going to bed with work in hand calls the job off (counted in `freightStats.cancelled`; the goal is 0). Anything older than 900 s is dropped.
- **Passengers**: round entries `['platform:central', 0, 'ride:harbour']` (and stories such as `harbourtrip`, `milltrip`, `schooltrip`) wait on the platform (`onPlatform`, standing, not on the road), board when the train stops there (also while it stands there), ride on the coaches (`state: 'riding'`, at most `train.seats`) and step off at their stop. Platform spots are `'platform:<stationId>'` in `graph.doors`. Nobody waiting on a platform is given other errands.
- **Owner**: `sendParcel(from, to)` makes a parcel job (button on a building's card, then tap the destination); `freightStats` and `freightLog` feed the work board.

### Market, signals, settings, needs (sim.mjs, needs.mjs, settings.mjs, smoke.mjs, tested)

- **Market** (`the Market`, a building with a doorstep, three stalls on a cobbled patch): open every third day (`def.MARKET`, day 0 is the first morning) from 9 to 15. `sim.market = {open, visits, opens}`. On opening a story caption says so, then every 9 to 19 s the nearest free resident goes to stand at the stalls (at most 7 there or on the way); people at the market are `onPlatform` (standing, visible) with `at === 'market'`. Goods and sellers are one small mesh shown only while open. Milk and bread jobs may be delivered to the market, only while it is open.
- **Station signals**: `sim.signalFor(stationId)` is `'red'` while the train stands at the station or is within 2.4 units of stopping there, else `'green'`. Posts are in the railway mesh, the lamps are one instanced mesh. The bell (`sound.stationBell`) rings once when the train pulls in; the engine's smoke is `smoke.mjs` (a ring of puffs, more when moving).
- **Settings** (gear button, `settings.mjs`, remembered in `localStorage`, bad or blocked storage falls back to defaults): speed of the day (0.5, 1, 2, 4; a frame takes up to 10 steps of at most 50 ms), work for the train (`sim.setBusy`: quiet 0.4, normal 1, busy 2 times as many jobs) and whether the news stages stories.
- **Needs and moods** (`needs.mjs`): hunger, tiredness and loneliness run 0 to 1. Hunger rises over 12 waking hours, tiredness over 15, loneliness over 10 when alone; sleep rests; a bite at the bakery, cafe or market and company at the cafe, market, school, bandstand, toy shop or post office bring them down; a hello on the pavement eases loneliness. A need above its threshold (hunger over .75, loneliness over .85) sends an idle resident to the nearest food or company (`sim.needsStats`); hunger over .9 breaks a wait. `r.mood = {score, label, why}` (cheerful, content, grumpy, hungry, tired, lonely) shows in the card; the work board shows the town's mood.

### Picture quality and the natural look (quality.mjs, nature.mjs, build.mjs shaders; tested)

- **Tiers** `low`, `medium`, `high` (`quality.PROFILE`): water waves, shore foam, wind sway, grass tufts (0, 900, 2200), sky glow and the colour grade. A phone starts on `medium`, everything else on `high`. `?quality=low|medium|high` (or the Picture quality row in the settings) fixes a tier; otherwise a governor takes the average frame time every 2 s, goes a tier down after two slow samples (over 45 ms), a tier up after five fast ones (under 20 ms, and only when the resolution is at its maximum), and caps a tier it just left for a couple of minutes. The render resolution only goes down once the lowest tier is reached. `?debug=1` shows fps, ms, draw calls, triangles, resolution and tier.
- **Wind** (`nature.wind(t)`): one slowly swelling and veering breeze. Foliage (round trees, pines, bushes) has a per-vertex `sway` weight and leans in the vertex shader (`windify`); the grass tufts lean in their own shader; smoke and petals drift with it. `prefers-reduced-motion` cuts the sway to 30 percent.
- **Water**: the sea plane has slow swells and soft glints in the fragment shader (`waterify`); the shallows band (a ring from the waterline out to 1.35 of the island radius, alpha fading) carries the shore foam, a second pulsing ring and the wave tint.
- **Ground and light**: lawn colour has big soft patches (lighter, darker, dry yellowish) and bare soil beside the pavements (a grid of road points answers "how far to a road"); walls and undersides are shaded darker near the ground when the mesh is built (no run-time cost); the sky is a gradient dome (haze colour at the horizon, deeper blue above) with a glow round a low sun; a CSS overlay gives the vignette and a warm dawn and dusk or cool night tint (high tier only).

### The week, memory, timetable and parcel tracking (tested)

- **The week**: `sim.weekday` (0 Monday to 6 Sunday; the page starts on today's real day, `?day=mon..sun` overrides, tests pass `{weekday}`) moves on every 480 s. Saturday and Sunday: `def.weekend` rounds for Dot, Dash, Miss Chalk and Nurse Nell (no school), stories flagged `days: 'week'` do not run, `days: 'weekend'` ones do and are favoured, and set pieces per season (harvest fair, blossom picnic, day by the harbour, snow day) plus Sunday lunch run with only half their cast needed (`relaxed`). Markets: Wednesday small (9 to 15, up to 5 shoppers) and Sunday big (9 to 16, up to 9), `def.MARKET.days`.
- **Memory** (`memory.mjs`): `r.friends` counts meetings (a hello counts 1, being in the same public place 0.5; 2 is a friend, 5 a close friend), `r.visits` counts visits per public place. A lonely resident joins the closest friend who is in a public place (`friendSpot`) before going to the café; cards say who they are friends with and where they are often found.
- **Train**: six stations (Central, Harbour, School, Farm, East, Mill), so a lap is about 108 s. `sim.timetable()` guesses arrival times (`track.etas`, median error under 12 s in the test); the station building's card lists them and the train's card gives the next stop with its time. Cargo put down while the train is standing at the station is loaded at once.
- **Parcel tracking** (`track.mjs`): `stageOf(cargo)` gives the step (six by train: waiting, to the station, at the station, on the train, at the far station, to the door; three if walked), shown in a yellow strip under the work board with dots, with a toast when it arrives; `freightLog` entries carry the cargo id.

### Fishing, professions and life stories (tested)

- **Fishing**: `pier` is a place (the end of the pier, a standing spot like a platform). Finn and Captain Salt have `pier` in their rounds; whoever stands there catches a fish every 11 s (85 percent, less in rain) into `sim.fishing.stock`. A `fish` freight template (`def.FREIGHT`, `fish: true`) only spawns when there is stock: a basket of up to 3 goes from the hut to the café, the market, the bakery, the school or a house; each fish delivered pays `FISH.price` coins (`sim.fishing = {stock, caught, sold, coins}`), and visitors to an open market buy a fish from the stock too. The work board shows fish sold and coins. Fishermen are drawn with a rod and float (hidden unless they are on the pier) facing out to sea.
- **Professions**: every cast member has a `job` (from `lives.mjs`, shown on the card). New: Mrs Gill the fishmonger, Mr Apple the greengrocer and Dr Mint. On market days `def.VENDORS` (Gill, Apple, Farmer Hay) are sent to stand at their stalls from opening to closing (fish, apples, milk on the counters).
- **Life stories** (`lives.mjs`, 31 of them): each one has a `star` (whom it is about); every cast member has at least one. They are ordinary stories needing only half their cast (`relaxed`). A card says "Their story right now" or "Stories told: n of m". In a simulated week at least 14 people have had a story of their own told.

### Draw calls, the town paper and journals (tested)

- **Draw calls**: all umbrellas are one instanced mesh (`buildUmbrellas`: white canopies tinted per instance), and the figures and vehicles stop casting shadows when the camera is more than 27 units away (a draw each in the shadow pass). Measured in the headless renderer: a rainy crowd went from 106 to 75 calls, a clear noon from 81 to 66 (with more people out). Crowded-scene budget in the visual test stays at 135.
- **The ledger**: `sim.days[d]` is a snapshot of the counters (deliveries, rides, fish caught and sold, coins, market visits, seconds of rain, friend pairs, story count, mood) taken at the start of each day. `sim.paper('today' | 'yesterday')` builds an edition (`paper.mjs`): weather, the harbour, goods and travel, the market, the stories told, new friendships, the town's mood, and tomorrow (market, school). The headline is the biggest news: a big fish day, a busy market, the first story, a busy train, else "A quiet day".
- **Journals**: `r.journal` keeps the last 40 entries `{h, text}`: places visited, meals, fish caught, deliveries, train arrivals, new friends, the stories they were part of (and "Their story:" for the one it is about); no doubled entries.
- **UI**: a newspaper button (under the gear) opens the paper with Today and Yesterday tabs; a resident's card has a Journal button that opens their day in the same panel. Both are finger-sized and checked against the other buttons on the phone emulation.

### Emergencies, elections, seasons, the saga, mysteries and photos (tested)

- **Emergencies** (`events.mjs`, `sim.incident`, `sim.trigger(type)`, off with `?` setting "Emergencies"): about one a day, only 08:00 to 17:30. *Fire*: the fire engine is sent to the burning building (`v.callTarget`), the fire chief, the mechanic, the constable and the nurse hurry there (act `respond`), three neighbours watch; flames and dark smoke are drawn; it lasts 75 s. *Lost child*: Dot or Dash hides somewhere, the constable and three helpers search places in order until one is where the child is. *Storm*: heavy rain, the sea rises, branches lie at four doorsteps until a crew has visited each. The start and end are announced in the caption and appear in the paper.
- **Elections** (`vote.mjs`): from 10:00 to 18:00 on days 2, 5, 8 ...; every resident votes by a steady taste nudged by mood, your vote counts three (`sim.castVote(id)`, a Town hall tab in the paper panel). The winner stays (`sim.effects`, saved with the saga): a fountain or flower beds on a lawn, two hours longer market, a Saturday concert or film night (stories gated by `effect`), lights or a bench at the harbour.
- **Seasons change the map** (`buildSeasonDecor`): ice on the pond (winter), a flooded meadow (spring), leaf piles (autumn), beach umbrellas by the hut (summer), each with a story that goes with it.
- **The saga** (`saga.mjs`): ages (`AGES`), a birthday once a week of days (`YEAR_DAYS` = 7), weddings between adult close friends (held at the café with their friends), babies (at most two per couple, four in the town). Marriages, babies, ages and election results are saved in `localStorage` (`toytown-new-saga`; `?fresh=1` ignores it) and restored with `createSim(seed, {saga})`. Cards show age and marriage.
- **Mysteries** (`mystery.mjs`): after the first day, at midday, something goes missing (the prize pie, the golden top, the rare stamps). The thief really visits the place and then a hideout (it is in their journal), five clues come out over two minutes (coat colour, hat, footprints, a red herring who was really there, "look in the journals"), and you accuse from the Case tab: two wrong accusations end the case.
- **Photo mode**: the camera button grabs the current picture and frames it as a postcard, a polaroid or plain with a caption (the day's headline or the caption showing), to save as a JPEG or share. `ToyTownNew.photo({style, caption})` is the test hook; `advance(seconds, true)` steps without drawing (a test that loops must use it, or it queues hundreds of frames for the software renderer).

- **Nature** (`garden.mjs`, `wildlife.mjs`, `wild3d.mjs`, `wildscene.mjs`): a belt of 14 garden plots found from free ground (rose, tulip, lavender, sunflower, herb, wildflower, allotment, a greenhouse and the hen yard; the ground under each is levelled and the beds follow the season, bare and snowy in winter), hedges along the outer side of the ring road, reeds and rocks on the beaches, willows by the pond, pine and birch trees, and drifts of instanced wild flowers (800 on high, 350 medium, none on low). Six hens (one rooster) keep to the yard by day and are shut in at night; three dogs follow their owners (Biscuit with Granny Moss, Pepper with Dot, Bruno with Constable Bell) and wait at the owner's door, sleep there at night, and are put back on open ground if a building traps them; four cats keep to their own doorstep (wander by day, sit in the rain, curl up at night). Pets and hens are hidden on the low tier. A pod of three dolphins swims round the island close to the shore and leaps together every 12.5 s; a whale and her calf cruise far out and blow a spout and flick their tails every 34 s (both are pure functions of time, so they do not depend on the sim clock). **Dwarf Rock** is a rocky islet with a cave off the south-east coast: on about half the evenings 1 to 3 dwarfs come out at dusk (`dwarfWindow(day)`), walk a loop past the lantern post, the boat and the mine cart and go back in; the cave glows at night. Whoever is at the harbour (`pier`, `hut`) while they are out sees the lanterns, once an evening (`sim.wild.sightings`, a journal line, the saga and the paper's Nature notes). Butterflies fly over the beds by day in spring to autumn when it is dry. Seven new stories use the pets, hens, dolphins and dwarfs; the fishermen are kept out of them because a story that pulls them off the pier stops the fishing.

- **Voices** (`sound.mjs`, `wildDue`): hens cluck, dogs bark, cats mew (only when the camera is close), dolphins chirp as they leap, the whale sings as she blows, the dwarfs' chime sounds as they come out and their picks tink while they are out. Synthesised, off until the sound button is pressed.
- **Dwarf gems**: after an evening the lanterns were seen, the dwarfs leave a gem on the harbour beach (a blue crystal at the hut's doorstep); the next person at the hut finds it, it is worth 10 coins (counted apart from the fish money), goes in the journal, the saga and the paper. A **Nature** tab in the paper panel shows the dwarf watch (lights now, evenings seen, gems found, the last sightings), the pets and hens, and the gardens.
- **Dusk, night and dawn**: the evening is warmer and brighter, the night is bluer and readable (moonlight strength .6, hemisphere .95) and there is a path of moonlight on the sea on clear nights (not in lite mode); dawn is bright by 06:00 so a visit begins in daylight.
- **Menu**: the front page's experience list has a **Toy Town Storybook** entry that opens `toy-town-new.html`; the classic Toy Town stays where it was and stays the default for `?town=`.
- **Fishing is a job** (`stepFishers`): Finn (now living in the harbour hut, a short walk from the pier) fishes from 07:00 to 14:00 and Captain Salt from 11:00 to 17:30, except in heavy rain or an emergency, as a job in hand (so nobody holds them back). On the default start somebody is at the end of the pier by about 07:50 (before this, on the default start nobody fished all day). The rod is bigger, with a long line to a red float, a ring of ripples that spreads when a fish is caught and a bucket; the work board says who is fishing.
- **Fishing game** (`angling.mjs`): tap somebody fishing and press "Fish with them": cast, wait for a bite, then press Reel in while the red marker is over the green zone; one fish in seven is golden and needs the middle of the zone (`sim.angle`). Fish go to the harbour stall; a golden fish adds 20 coins to `fishing.bonus` (kept apart from the sales).
- **The harbour boat** (`sail.mjs`): tap the boat tied up off the end of the pier and press "Take the boat out". Tap the sea to steer (or the arrow keys); it keeps off the beach, the pier and the rock, goes round the island and round Dwarf Rock to the landing in front of the cave, leaves a foam trail and the camera follows it. Events count once each in the sea log (`sim.sea`): a pod leap within 7 units, the whale's spout within 13, a landing (the dwarfs are met if they are out); the first landing of a day finds a gem worth 10 coins (`sea.bonus`). The sea log is on the Nature page. "Back to the harbour" ends the trip.
- **The town chest** (`chest.mjs`): every coin the town earns (fish sold at the stall, golden fish, the dwarfs' gems, gems found at Dwarf Rock) goes in one chest that is saved between visits (`sagaState().chest`: earned, spent, bought). The **Chest** tab in the paper panel sells five things you can see: bunting along the pier (15), lights along the pier (25), a fountain on a new lawn (30), a second boat (40) and a lighthouse on Dwarf Rock with a turning beam (60). Buying one is announced, goes in the saga and makes a few residents go and look.
- **Treasure maps** (`treasure.mjs`): once the dwarfs have been met (a gem found or a landing with them out) the Nature page offers a map: five riddles, four are buildings to tap and the last is Dwarf Rock (sail to the landing). Three maps in turn (the baker's, the gardener's, the captain's) paying 40, 45 and 50 coins into the chest.
- **Lantern Festival** (`festival.mjs`, `festscene.mjs`): every Saturday evening from 18:30 to 22:00 the town stays up and goes to the harbour hut (the story is always staged and counts as a job in hand), the shore is hung with lanterns on stakes, 12 paper lantern boats drift out from the pier from 19:30 and five fireworks burst over the sea from 21:00 (a pop for each). The dwarfs come out for it. The paper announces it on Saturday and the day before.
- **Weather you can believe in** (`weather3d.mjs`): rain is 1700 long streaks at different depths slanted by the wind, with splash rings on the ground and in the puddles, haze that closes in (the fog now follows the sky colour and is nearer in rain) and a darker light; puddles are soft irregular patches that mirror the sky and fill and dry with the weather; snow is big soft flakes of three sizes that swirl; autumn leaves and spring petals are flat quads that tumble. Summer keeps its fireflies.
- **Formal gardens** (`formalGarden` in `wild3d.mjs`): rose, tulip, lavender, sunflower, herb and wildflower plots now have a low box hedge with an opening towards the town, a gravel cross, four stone-edged beds with a colour each and a feature in the middle (rose arch, birdbath, bench, scarecrow, sundial, beehives). The allotment, greenhouse and hen yard are as before.
- **Lite mode** (`lite` in `main.mjs`): a TV or other weak browser (user agent contains SmartTV, Tizen, webOS, VIDAA, HbbTV, BRAVIA, Android TV, Fire TV, Roku, Hisense and so on) or `?lite=1` gets the low picture tier (locked), no shadows, no antialiasing, a render size of at most 1280 pixels wide, about 30 frames a second and no hedges or wild-flower drifts; at 1080p it draws about 40 calls and 280k triangles. `?lite=0` turns it off. Not verified on a real TV.

## 5. Art rules

- Fat, rounded, slightly wonky. No sharp corners: `bag.box` is a rounded box; roofs overhang.
- Colours only from `PALETTE` (plus `lighten`/`darken` of them). Each landmark owns one main colour.
- Doors are big (0.6 tall), residents about 0.5 tall, so people read at the default zoom.
- Every building: a door with a frame, knob and step; windows with frames, bars and sills; something that
  says what it is (a loaf-shaped bakery, a teapot café, an envelope on the post office).
- The whole static town goes into one `Bag` and becomes **one mesh** with vertex colours. Moving parts are
  separate small meshes: currently the spinning top, the windmill sails, the clock hands, each resident, each
  vehicle, the clouds. Do not add per-building meshes or new materials without a reason.
- `Bag` API: `push(x,y,z,ry,scale)` / `pop()` set a local frame; `box, cyl, sph, dome, cone, torus, gable,
  tube` add a coloured piece (options `x y z rx ry rz sx sy sz s seg r centre`); `mesh(material)` merges.
  Pieces stand on their base unless `centre: true`.

## 6. Budgets

| | Now | Limit |
|---|---|---|
| Draw calls, default view | 46–67 | 80 by default; 120 at night, in rain or at dusk, when a crowd of residents each have an umbrella |
| Triangles, default view | 460–500 k | 800 k |
| Residents out at once | ~4–7 | — |

The limits are asserted in `tests/toy-town-new-visual.cjs`. Rounded boxes use 1 or 2 segments and small
spheres 8; keep that discipline (the first version was 1.05 M triangles from 3-segment boxes alone).

## 7. Test hooks (`window.ToyTownNew`)

- `sim`, `scene`, `camera`, `renderer`, `view`
- `info()` → `{calls, triangles, residentsOut, clock, pixelRatio, story, rain, wet, lampsLit, season}`
- `tapAt(clientX, clientY)`, `selected()`, `select(obj|null)`, `project(x, z, y)` → client coordinates of a ground point
- `fxState()` (flames, branches, flood, decor), `photo({style, caption})`
- `paperText()`, `openPaper(mode)`, `closePaper()`
- `rodsOut()` (fishing rods showing)
- `trackText()`, `trackState()`; `?day=`
- `tier()`, `gov` (the governor), `setQuality(tier|'auto')`, `tufts`, `U` (shader inputs); `?quality=` and `?debug=1`
- `settings`, `applySettings()`; `info()` also has `market, marketVisits`
- `trainPos()` (head of the train), `sendParcel(from, to)`, `jobsText()` (the work board text); `info()` also has `delivered, cargoNow, riders`
- `season`, `sound` (`enabled`, `started`, `toggle()`); `?season=spring|summer|autumn|winter`
- `setHour(h)`, `setWeather('rain'|'clear'|..., seconds)`; `?h=<hour>` starts at an hour, `?news=0` turns the news staging off, `?tune=0` turns the adaptive resolution off
- `look(x, z, dist, yaw)` puts the camera there and renders
- `advance(seconds)` steps the simulation and renders
- `freeze(on)` stops the animation loop (use before `look`/`advance` in screenshots)

## 8. How to test

```
node tests/toy-town-new.test.cjs          # definition and layout, road network, lanes, railway, two simulated days of life
node scripts/check-toy-town.cjs           # every Toy Town logic suite, old and new
node tests/toy-town-new-visual.cjs        # real WebGL: needs Playwright; THREE_LOCAL=<path to three> if offline
```

CI (`.github/workflows/toy-town-visual.yml`) runs all three on any change under `assets/town2/**`; the
visual step uploads `new-town-*.png` (wide, square, high street, cottage lane, windmill, from behind).

### What a tester should check that the tests cannot

- **The look, on a real phone and a laptop:** does each landmark read as what it is at the default zoom? Are
  any colours harsh? Do the shadows look right?
- **Motion:** residents waddle rather than slide; vehicles sit on the road on Windmill Hill; nothing floats
  or sinks where the ground slopes.
- **Controls:** drag pans, pinch and wheel zoom, twist / right-drag / Q and E turn, `0` resets. Nothing
  jumps when a second finger lands.
- **Crossings:** walkers hop the road mouth at junctions; vehicles should wait for them (rule 3). Watch the
  square for a minute for anyone walked through.
- **Frame rate** on a mid-range phone (target 30 fps). No measurement exists yet.

## 9. Known gaps

- Passengers and goods ride, but nobody is drawn inside the coaches in detail (riders are small figures on the seats), parcels are only from building to building, and pedestrians do not sit on the benches. Sound has not been heard by a person yet: the levels are my guesses and only the code path was exercised.
- Adaptive resolution (steps the pixel ratio down after 2 s under ~24 fps, and drops the shadow when already at 1.0) has not been measured on a real phone.
- Vehicles cannot overtake, so a late one can queue behind a slow tractor.
- Story captions are English text from a data file; the headline text is only ever shown with `textContent`.
- Junction locks are first come, first served: there is no priority for the ring or for the main road, so a vehicle on a spoke may wait for one on the ring that arrived a moment before it.
- Pedestrians cross at junction mouths without waiting for the train (there are no level crossings: the railway never meets a road).
- Walkers keep a little apart but do not queue.
- Only checked in headless Chromium with software WebGL. Not yet seen on a phone.
