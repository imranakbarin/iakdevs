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

It is live at `toy-town-new.html` (or `toy-town.html?town=new`, or `index.html?town=new#toy-town`). The current
town is untouched and stays the default until the owner approves the switch.

## 2. Files

| File | Role | May import |
|---|---|---|
| `assets/town2/def.mjs` | The town as data: palette, island, roads, buildings, cast, vehicles, trees, `heightAt` | nothing |
| `assets/town2/graph.mjs` | Road graph, door-to-door walks, the vehicles' tour | `def` |
| `assets/town2/weather.mjs` | Spells of clear, cloud, rain, drizzle; `rain` eases 0..1 | `def` |
| `assets/town2/stories.mjs` | The small stories (data) and `newsStory(title, category)` | nothing |
| `assets/town2/sky.mjs` | `skyAt(hour, rain)`: sky, fog, sea, sun/moon, window glow, stars (hex strings) | nothing |
| `assets/town2/sim.mjs` | Who is where and when (residents, vehicles, weather, stories) | `def`, `graph`, `weather`, `stories` |
| `assets/town2/build.mjs` | Geometry builders (THREE) | `def`, `graph`, `three` |
| `assets/town2/main.mjs` | Renderer, camera, controls, loop, test hooks | all |
| `toy-town-new.html` | The page (import map for three 0.187 from the CDN) | |
| `tests/toy-town-new.test.cjs` | Logic test, no browser | |
| `tests/toy-town-new-visual.cjs` | Real-WebGL check and screenshots | |

Rule: `def`, `graph`, `weather`, `stories`, `sky` and `sim` are pure (no THREE, no DOM), so they run in Node. Keep it that way.

## 3. World model

- **Axes:** x east, z south, y up. One unit is about a cottage width. The island is a wobbly ellipse,
  13.8 × 10.4 half-axes (`shore(x,z)` < 1 is land).
- **Ground:** `heightAt(x,z)`. Flat inside ~4 units of the square, rolling beyond, Windmill Hill (+1.45) at
  (1.9, −8.3), falling under the sea (y = −0.12) at the shore. Everything is placed at `heightAt`.
- **Roads:** a ring of radius 2.4 round the square, travelled clockwise seen from above, and four spokes
  (High Street east, Station Road south, Cottage Lane west, Windmill Lane north). Each spoke is a
  Catmull-Rom curve through `SPOKES[i].points`, starting on the ring and ending in a turning circle.
  Road width 0.95; vehicles keep left, lane offset 0.22; pavements 0.66 from the centre line.
- **Graph:** 8 nodes (`ring:<id>`, `end:<id>`), 8 edges (4 ring arcs, 4 spokes), each a sampled polyline with
  running length (`line`), read with `along(line, s) → {x, z, tx, tz}`.
- **Buildings:** `{id, type, name, x, z, ry, door, …}`. `ry` turns the front (local +z) to face that way;
  `door` is the distance from the centre to the doorstep. `doorOf(b)` is the doorstep in world space.
  `graph.doors[id]` attaches each doorstep to its nearest edge, with the side of the road it is on.

### Adding things (data only)

- **A road:** add a spoke to `SPOKES` with an `angle` (its exit from the ring) and control points. The graph,
  the tour, the pavements and the drawing follow. Spokes only meet at the ring today; a road that joins two
  spokes needs `buildGraph` and `tour()` extending (the tour assumes a tree of spokes on one ring).
- **A building:** add to `BUILDINGS` and write `BUILD.<type>(bag, def, anim)` in `build.mjs`. It must be
  ≥ 1.9 from other buildings and ≥ 0.95 from every road sample (the logic test checks both).
- **A resident:** add to `CAST` with a `home`, optional `wake`/`sleep` hours and a `round` of `[buildingId, secondsToStay]`. Every place in
  a round must have a door.
- **A vehicle:** add to `VEHICLES` (`kind`: `car`, `van`, `bus`, `float`, `tractor`, `icecream`, `fire`; new kinds need a branch in `buildVehicle`) with a `home` building (its garage), the hours it works (`from`, `to`) or `onCall: true`. Vehicles are parked (invisible) in their garage outside their hours, leave and return only by their own garage, and an `onCall` one (the fire engine, `sim.dispatchFire()`) goes out for a run round the town and comes back.

## 4. Behaviour rules (tested)

1. **Doors only.** A resident is either `inside` (invisible) or `walking`. Walks start and end exactly on a
   doorstep. Nobody appears or vanishes anywhere else.
2. **Pavements.** Walks follow the pavement of each edge (the outer side on the ring), door to door, by the
   shortest way over the graph. At a junction the walk hops across the road mouth.
3. **One tour for all vehicles.** `graph.tour` is a single closed line covering every lane once: round the
   ring to an exit, out along the spoke on the left, round the turning circle, back on the other side, on
   round the ring. It never crosses itself, so a gap along the tour is all the collision avoidance needed.
   Vehicles also stop for anyone on the road just ahead, and the bus waits 4 s at each of `BUS_STOPS`.
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
8. **Determinism.** `createSim(seed)` gives the same town life for the same seed and step sequence.

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
| Draw calls, default view | 64–66 | 80 (night 62, rain 69) |
| Triangles, default view | 608 k | 800 k |
| Residents out at once | ~4–7 | — |

The limits are asserted in `tests/toy-town-new-visual.cjs`. Rounded boxes use 1 or 2 segments and small
spheres 8; keep that discipline (the first version was 1.05 M triangles from 3-segment boxes alone).

## 7. Test hooks (`window.ToyTownNew`)

- `sim`, `scene`, `camera`, `renderer`, `view`
- `info()` → `{calls, triangles, residentsOut, clock, pixelRatio, story, rain}`
- `setHour(h)`, `setWeather('rain'|'clear'|..., seconds)`; `?h=<hour>` starts at an hour, `?news=0` turns the news staging off, `?tune=0` turns the adaptive resolution off
- `look(x, z, dist, yaw)` puts the camera there and renders
- `advance(seconds)` steps the simulation and renders
- `freeze(on)` stops the animation loop (use before `look`/`advance` in screenshots)

## 8. How to test

```
node tests/toy-town-new.test.cjs          # definition, graph, tour, 15 simulated minutes of life
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

- No sound, tapping on things, puddles, snow or seasons. No lamplighter figure (lanterns simply glow).
- Adaptive resolution (steps the pixel ratio down after 2 s under ~24 fps, and drops the shadow when already at 1.0) has not been measured on a real phone.
- Vehicles cannot overtake, so a late one can queue behind a slow tractor.
- Story captions are English text from a data file; the headline text is only ever shown with `textContent`.
- Vehicles do not give way to each other at the ring (they do not need to: one tour), so it never looks like
  a junction negotiation.
- Walkers do not avoid each other.
- The first spoke sample sits on the ring, so each spoke's road ribbon overlaps the ring road slightly
  (same colour, not visible).
- Only checked in headless Chromium with software WebGL. Not yet seen on a phone.
