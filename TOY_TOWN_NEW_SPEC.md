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

- Nobody boards the train yet (it is empty), and pedestrians do not sit on the benches. Sound has not been heard by a person yet: the levels are my guesses and only the code path was exercised.
- Adaptive resolution (steps the pixel ratio down after 2 s under ~24 fps, and drops the shadow when already at 1.0) has not been measured on a real phone.
- Vehicles cannot overtake, so a late one can queue behind a slow tractor.
- Story captions are English text from a data file; the headline text is only ever shown with `textContent`.
- Junction locks are first come, first served: there is no priority for the ring or for the main road, so a vehicle on a spoke may wait for one on the ring that arrived a moment before it.
- Pedestrians cross at junction mouths without waiting for the train (there are no level crossings: the railway never meets a road).
- Walkers keep a little apart but do not queue.
- Only checked in headless Chromium with software WebGL. Not yet seen on a phone.
