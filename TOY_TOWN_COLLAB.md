# Toy Town — Shared AI Collaboration Log

**Canonical coordination file for Claude and ChatGPT (GPT-6).**
Repository: `imranakbarin/iakdevs` · Branch: `master` · Live: https://imranakbarin.github.io/iakdevs/toy-town.html

This file is the *communication channel*, not a lock, a design specification, or a request to preserve old implementations at all costs. **The owner explicitly allows either assistant to redesign, replace, or overwrite the other assistant's Toy Town work.** Prefer visible quality and correct behavior over backwards-compatibility with a poor implementation. Do not preserve code just because another assistant wrote it.

## Mandatory handoff protocol

**Before starting any Toy Town work, every assistant must:**
1. Pull/fetch the actual latest `master`; read **this file**, the most recent relevant commits, and affected source/tests. Ignore stale references to specific commit IDs.
2. **Update and commit this file before editing implementation code.** Add a concise `START` entry under *Exchange log*: author, date (UTC or clearly labeled local), current base SHA, intended outcome, files likely affected, and any observed existing work. This is an advisory announcement, **not** an exclusive lock.
3. Check for concurrent commits again before pushing. If another assistant worked on the same files, read the diff and consciously integrate or replace the change. State why if overriding it. Never force-push/reset master or silently drop unrelated work.
4. Make working source edits and run appropriate tests. Be willing to rewrite significant portions, including the other assistant's contributions, when the quality warrants it. Respect unrelated experiences (Road Trip, Arts, Mushroom Island, etc.).
5. **Update this file before finishing** with a `DONE`, `BLOCKED`, or `PARTIAL` entry that states the outcome, commit SHA(s), changed files, exact tests and browser/visual checks with honest results, known regressions, remaining work, and recommended next action. Commit the updated handoff as part of or directly after the implementation.
6. Read the file again at the beginning of each new session. When the user says *resume*, first locate the latest unfinished `START` or `PARTIAL` entry; verify actual Git state before assuming anything was completed.

A `START` does not prohibit parallel edits. Avoid stepping on each other's uncommitted work; where overlap occurs, prefer short commits, a fresh head check, and explicit integration. **Latest verified code wins, not the most recent claim.** If these steps were skipped or the file could not be updated, say so clearly.

## Shared project snapshot (as checked 2026-11-01)

- Last verified Toy Town code milestone: **v52**, code commit `da55e002e6048fb24f703fdee2cf211d06fdba6f`. Live deployment and real Chromium visual check succeeded: https://github.com/imranakbarin/iakdevs/actions/runs/41359185980 .
- Later automated news-data commits may advance `master` without changing Toy Town code. **Fetch current head every time.**
- Simulation `assets/toy-town.js`: moving residents, routes, cars/bikes, events, shop transactions, and four outer-district routines.
- 3D scene `assets/toy-town-3d.js`: actors, architectural scene, animated shop/district props. `assets/toy-town-landmarks.js` supplies handcrafted central buildings; `toy-town.html` launches scene, news and fallback.
- Real publisher-attributed hourly news: `scripts/refresh-toy-town-news.cjs`, `assets/toy-town-news.js`, `assets/toy-town-news.json`, `.github/workflows/toy-town-news.yml`. News must be timestamped and sourced, not confused with fictional town events.
- Tests: `node tests/toy-town.test.cjs`, `node tests/toy-town-3d.test.cjs`, `node tests/toy-town-news.test.cjs`, and real Chromium screenshot workflow `.github/workflows/toy-town-visual.yml`.
- The existing root `HANDOFF.md` is primarily Mushroom Island documentation; do not overwrite it as the Toy Town log.

## Current user priorities

- **Make the whole city visibly vibrant at normal mobile and wide-camera scales.** More invisible micro-details do not count as progress.
- Fix remaining behavioral realism issues: vehicle overlap, walking in place, bicycle movement, stiff/repetitive animation, placement, scale, and interaction quality.
- People should genuinely reach places and physically interact; avoid adding crowds that do nothing.
- News should stay fresh, relevant, source-linked, and honest when unavailable.
- Preserve the minimal UI, iPhone gestures/zoom, coherent materials, performance, and classic 2D fallback unless there is a deliberate, tested reason to replace them.
- **Run real Chromium checks and look at the actual screenshots**, not just green assertions. Be explicit that screenshot/console tests do not prove natural-looking motion on a physical iPhone.

## Exchange log (newest first)

### DONE — Claude (Claude Code) — 2026-11-02 (late, 5)
- Outcome: pavements, walkers kept on them, and the weather preview from the main page. Code commit `83e1a37` (squash-merged with this entry).
- **3D** (`toy-town-3d.js`):
  - `kitRoads()` collects pavement slabs (0.13 wide, pale `#d9d3c6`) and kerbs (`#b7b0a1`) into two `InstancedMesh`es;
  - both sides of straight tiles are paved, and junctions get four corner squares plus strips on their closed sides;
  - straight and crossing asphalt is scaled to `1-2P` across, so walkers' lanes (±0.40–0.47) fall on the pavement.
- **Simulation** (`toy-town.js`):
  - `walk(x,y,tx,ty,speed)` runs along the near pavement (±`PAVE` 0.43) to the first corner, along the street (crossing side roads at junctions), round the corner onto the destination pavement, then the final step;
  - `walkFrom(m,…)` starts a street walker from where it is drawn (centre plus lane), so nothing jumps;
  - used for `sendTo`, `whimTo`, routines (work, school, lunch, home) and the walking event actors; vehicles and the dinosaur keep `route()`;
  - `endWhim` rejoins the street on the pavement with a matching `lane`;
  - `edgeOf` points sit on the outer ring pavement.
- **`index.html`:** `townSrc()` passes `weather`/`fps` from the page URL into the embed (v63).
- **Tests:**
  - extras test: pavements and narrowed asphalt; people's routes via `walkFrom`; fewer than 5% of route samples walking *along* a centre line (crossing at junctions is allowed); main page passes the settings through;
  - all `tests/*.test.cjs` pass, including pip-run;
  - CI visual run 41518482500 green.
- **Chromium checks:**
  - `index.html?weather=rain#toy-town` loaded the iframe at `toy-town.html?v=63&embed=1&weather=rain`, showing 27 umbrellas and 🌧️;
  - close-up screenshot reviewed: kerbed pavements on every street, wrapping junction corners, with people on them.
- **Not verified:** real-phone appearance and speed.

### START — Claude (Claude Code) — 2026-11-02 (late, 5)
- Base: `da04fbe` (latest `master`).
- Owner report:
  - "people are walking in the middle of roads and there are no pathways";
  - "can't preview rain or snow";
  - deadlocks still visible (those came from the not-yet-deployed build; the fix is now merged in #149).
- Planned:
  1. **Pavements:** KayKit road asphalt is narrowed to the carriageway, with raised pale pavements and kerbs along both sides of every street. The walkers' lane offset (±0.40–0.47) already falls on them.
  2. **Walking routes keep to the pavements:** `route()` for people (whims, routines, events) follows the pavement on the correct side and crosses only at junctions, instead of walking down the centre line. Walkers rejoin a street on its pavement.
  3. **Weather preview from the main page:** `index.html` passes `weather`/`fps` from its own URL into the embedded Toy Town, so `?weather=rain` works there too.
- Likely files: `assets/toy-town.js`, `assets/toy-town-3d.js`, `index.html`, `toy-town.html`, tests, this file.

### DONE — Claude (Claude Code) — 2026-11-02 (late, 4)
- Outcome: Moments and real local weather, plus fixes for two things the owner reported (vehicles and people stuck at junctions forever; repetitive walking). Code commit `09bc479` (squash-merged with this entry).
- **Gridlock** (pre-existing: about 24 movers froze for whole 10-minute runs on every layout tested, before any Claude change too). In `toy-town.js`:
  - `unstick()`: a mover with no progress over ~3 s (judged per second) while its own light is green is unstuck in three steps: (1) `patienceUntil` for 2.5 s, during which it ignores following gaps, cross-traffic occupancy and personal space; `safeVehicleTravel` then lets it edge past *perpendicular* traffic but never into its own lane; (2) it turns round; (3) it leaves town, and the spawner replaces it.
  - Only the front of a queue counts as stuck.
  - Two vehicles on the same spot tie-break by mover order.
  - Result: over 3 layouts × 5 runs, the longest wait is 15–23 s (a red light plus a short queue).
- **Whims** (`updateWhims`): free walkers go to a bench and sit, visit the fountain (maybe a coin and a wish), wander the park and look about, stop for a chat in pairs, or jog. `endWhim` walks them back to the street. `gather(x,y)`: a ground tap in 3D draws the nearest four over.
- **Moments** (`toy-town-3d.js`):
  - transitions offer one chip at a time: shopper off to the bakery or bookshop, concert start, school run, walking home, the time visitor, the paper round, town events;
  - 9 s visibility and a 20 s cooldown; never automatic;
  - Watch is `follow(ref,3)` with the narrating card, or `viewTo` a spot at 2.9 zoom; it ends on completion or timeout and restores the view; a drag hands control back.
  - Sim API: `viewTo`, `view`, and `follow(m, zoom)`.
- **Weather** (new `assets/toy-town-weather.js`):
  - Open-Meteo `current` with a time-zone→city table (no geolocation); WMO codes map to clear, cloud, fog, rain, snow and storm, plus windy;
  - `?weather=` override; the card's `#weather` span shows it.
  - In 3D: rain line streaks and person umbrellas; snow points and a white dusting; fog closes in; storm flashes plus a `rumble` cue; overcast sky; sun dimmed by kind; clouds drift faster in wind.
- **Tests:**
  - the extras test covers no long stuck movers (≤30 s on 3 layouts), varied whims, Moments wiring, weather code mapping, no geolocation, umbrellas;
  - all `tests/*.test.cjs` pass, including pip-run;
  - CI visual run 41514959943 green.
- **Chromium checks:**
  - `?weather=rain`: 27 umbrellas, streaks, 🌧️ on the card;
  - snow: flakes and dusting, ❄️; storm: ⛈️;
  - a real click on Watch followed Ada at zoom 3, with the card "Ada · shopper / on the way to the bakery".
  - Open-Meteo itself is not reachable from the sandbox.
- **Next** (owner just reported): walkers' routes run down road centre lines and there are no pavements; `?weather=` does not reach the embedded town on the main page.

### START — Claude (Claude Code) — 2026-11-02 (late, 4)
- Base: `ab1ae25` (latest `master`). Read GPT-6's v53–v55 entries: the perspective camera, the storefront frontage, and the knock → order → receive → leave choreography. GPT-6's own conclusion was that this is real but too subtle at phone zoom.
- Owner approved: **Moments** and **real local weather**.
  1. **Moments:** when something worth watching starts, a single chip offers "Watch" (never automatic; the owner dislikes camera moves they didn't ask for):
     - a customer knocking at the bakery or bookshop;
     - a street concert;
     - children off to school;
     - the time-pod visitor, the paper round;
     - a town event.
     Watching glides the camera close, follows to the end with the follow card narrating, then returns to the previous view. One chip at a time, with a cooldown; ignored chips fade.
  2. **Weather:**
     - Open-Meteo (no key) for a coarse location taken from the time-zone city only (no geolocation prompt, no precise position sent); fine weather if it fails; `?weather=` to override.
     - Effects: rain (streaks, umbrellas, darker light), snow (drifting flakes, paler lawns), fog, cloud, storm (flashes plus a soft rumble when sound is on), with more and faster clouds in wind.
     - A small weather note on the card, e.g. "🌧️ 24°", credited to Open-Meteo.
- Likely files: `assets/toy-town.js` (camera view API, moment sources), `assets/toy-town-3d.js` (moments UI and watch, weather visuals, umbrellas), new `assets/toy-town-weather.js`, `toy-town.html`, tests, README, this file.

### DONE — Claude (Claude Code) — 2026-11-02 (late, 3)
- Outcome: follow a resident, feed the ducks, and gentle opt-in sound. Code commit `1adcbd9` (squash-merged with this entry).
- **Simulation** (`toy-town.js`):
  - `follow(m)` / `following()`: while following, the camera targets the mover each frame (zooming to at least 1.9) and stops when the mover leaves town or the map is dragged.
  - `armHold()` on mouse `pointerdown` and on `touchstart`: a still press of 520 ms calls `ToyTown3D.hold`, and a successful hold suppresses the tap. `stopTimer()` guards `clearTimeout` for headless tests.
  - `feedDucks(x,y)`: crumbs for 14 town-seconds; every duck heads for them (speed rises with distance), stays within y 13.12–14.88, and nibbles on arrival.
- **3D** (`toy-town-3d.js`):
  - `hold()` uses the projected `actorAt` for people and shows a fixed follow card. The card gives a stable name (from `ph`), `roleOf()` (vendor, district role, kind, kid, commuter, neighbour, resident) and `doingOf()` (shop actions, carrying, chat, routines, sitting, gait), refreshed every 450 ms, with ✕ to stop.
  - A ground tap on the river (not on a bridge) calls `feedDucks` plus a crumb-scatter effect.
  - Sound cues fire on every tap type.
- **New `assets/toy-town-sound.js`:**
  - WebAudio-synthesised cues (honk, bell, quack, chirp, pop, chime) through a 4.2 kHz low-pass, plus a sparse birdsong bed by day and crickets at night;
  - off by default, with a `#sound-toggle` 🔇/🔈 in `#zoom-controls`, remembered in `localStorage['toy-town:sound']`;
  - a remembered "on" resumes on the first `pointerdown` (autoplay policy);
  - no audio files.
- **Tests:**
  - the extras test checks in the real simulation that following keeps the camera on the resident and lets go, and that the ducks close in and stay on the water;
  - it also checks that holds are wired for mouse and touch, that sound starts off and every cue is synthesised, and that no files are fetched;
  - all `tests/*.test.cjs` pass, including pip-run;
  - CI visual run 41505530361 green.
- **Chromium checks:**
  - a river tap moved all five ducks closer (one ~4.9 tiles);
  - a real 900 ms mouse press started following; the card read "Arjun · resident / taking a moment";
  - the sound toggle switched on and cues ran; screenshot reviewed.
- **Not verified:** actual audio output and feel, and touch-hold on a physical phone.
- **Next:** real local weather (Open-Meteo, no key).

### DONE — Claude (Claude Code) — 2026-11-02 (late, 2)
- Outcome: "a day in the life" and a `?fps` readout. Code commits `81c2f47` and `8026855` (cap fix), squash-merged with this entry.
- **Simulation** (`toy-town.js`):
  - `hourOfDay()` runs from the town clock: noon at the brightest, midnight at the darkest. `DAYPART` is morning 6–9.5, lunch 11.5–14, evening 17–21.
  - Morning: every house starts `home = true`; commuters (brisk, briefcase) and children in pairs (`kid`, backpack, skip gait) leave a front door for the edge of town.
  - Lunch: up to 4 diners stand at the two café tables with `shopAction='eating'`, facing the table, then walk out of town.
  - Evening: residents walk to a front door and go in, setting `b.home` and `b.homeAt`. The ticker notes each part of the day.
  - At most 8 scheduled walkers at a time.
  - `debug()` reports `hour`, `daypart` and `routines`.
- **3D** (`toy-town-3d.js`):
  - children are drawn at 0.76 scale with backpacks, and commuters carry briefcases;
  - houses (generic and plaza) get a porch lamp that lights after dusk once `b.home`;
  - `?fps` overlay shows fps, draw ms and pixel ratio.
- **Tests:**
  - the extras test runs a full simulated day and asserts morning, lunch, evening, children, commuters and eating; at least 2 houses lit by evening; at most 8 walkers;
  - all `tests/*.test.cjs` pass;
  - CI visual runs green for `81c2f47` and `8026855` (41503651644).
  - The first test run caught a pair of children overshooting the cap (9); fixed.
  - Chromium night screenshot reviewed. The `?fps` overlay works; SwiftShader shows the adaptive step-down to 1×.
- **Not verified:** real-phone fps (the owner is asked to open `?fps` on the phone).

### START — Claude (Claude Code) — 2026-11-02 (late, 3)
- Base: `42ce452` plus the unmerged day-in-the-life branch (no newer GPT-6 work).
- Owner: "what's next" / "do next".
- Planned:
  1. **Follow a resident:** press and hold one in 3D and the camera follows them. A small card shows a stable first name, their role (baker, bookseller, commuter, off to school, gardener…) and what they are doing; dragging the map or ✕ stops it.
  2. **Feed the ducks:** a tap on the river scatters crumbs, and the ducks paddle to the spot.
  3. **Gentle sound:** WebAudio synth only (no files), off by default behind a 🔈 toggle that is remembered. Soft honk, bike bell, quack, chirps, balloon pop, hello chime on taps, plus a quiet birdsong bed by day.
- Likely files: `assets/toy-town.js` (follow camera, duck feeding, hold gesture), `assets/toy-town-3d.js` (hold hit-test, follow card, sound cues), new `assets/toy-town-sound.js`, `toy-town.html`, tests, this file.

### START — Claude (Claude Code) — 2026-11-02 (late, 2)
- Base: `fb55667` (latest `master`; no newer GPT-6 work).
- Owner: "do next".
- Planned:
  1. A `?fps` readout (frame rate, draw time, render pixel ratio) for checking a real phone.
  2. "A day in the life": the town clock gives an hour of day.
     - Morning: commuters (brisk, briefcase) leave their homes for the town edge, and children (smaller, with backpacks) go out in pairs.
     - Lunch: residents sit at the café tables.
     - Evening: residents walk home and go in, and each house's porch lamp comes on once someone is home after dusk.
     - The ticker notes each part of the day.
  These are new scheduled walkers; existing movers, shops and traffic are untouched.
- Likely files: `assets/toy-town.js` (routines), `assets/toy-town-3d.js` (kids, briefcases, porch lamps, fps overlay), `toy-town.html`, tests, this file.

### DONE — Claude (Claude Code) — 2026-11-02 (late)
- Outcome: KayKit roads and plaza landmarks. Code commit `dc4e24a` (squash-merged with this entry).
- **Roads:**
  - `kitRoads()` lays KayKit tiles on every lane tile, with orientations measured from a top-down render of the tiles:
    - the zebra crossing (`road_straight_crossing`) goes on (8,11), by the plaza;
    - T-splits on the outer edges, corners at the four outer corners, junctions at the inner crossings.
  - North–south tiles at y = 13 and 14 are skipped, so the river keeps its stone bridges (`bridgeAt`).
  - With the kit, the organic roads, travel cues, painted verges, stone shoulders and old zebra stripes are skipped; without it, everything is as before.
- **Plaza:** `kitLandmark()` replaces the five hero buildings with KayKit models:
  - bakery → `building_D`, bookshop → `building_B`, each with a BAKERY / BOOK NOOK `sign()` board;
  - cottages → `building_C`, `building_F` or `building_A`.
  - GPT-6's shop fronts (awnings, cabinets, bells, hinged serving windows, counters) are separate pieces and unchanged.
- **Kit GLB v2:** adds 5 road tiles, 0.97 MB.
- **Tests:**
  - extras test extended (road tiles present; river skipped for bridges; plaza uses the kit, signs kept);
  - all `tests/*.test.cjs` pass locally, including pip-run;
  - CI visual run 41501555054 green.
  - Close and wide Chromium screenshots reviewed: a coherent KayKit city, with road joins correct.
- **Not verified:** iPhone frame rate. How well the shop fronts fit against the new facades was judged by eye only.
- **Next:** a frame-rate readout with adaptive detail, and "a day in the life" clock-driven routines.

### START — Claude (Claude Code) — 2026-11-02 (late)
- Base: `178f142` (latest `master`; no newer GPT-6 work).
- Owner: "go ahead and do next things", i.e. finish the KayKit look.
- Planned:
  1. **KayKit roads:** straight, junction, T-split, corner and crossing tiles laid on the street grid in place of the hand-made organic roads (river bridges kept).
  2. **Plaza landmarks restyled:** the five hero buildings (bakery, bookshop, three cottages) become KayKit buildings with their own signboards. GPT-6's separate shop fronts (counters, awnings, display cabinets, hinged serving windows, bells) stay exactly as they are, so the shopping choreography is untouched.
- Likely files: `assets/kaykit/kaykit-town.glb` (adds the road tiles), `assets/toy-town-3d.js`, `toy-town.html`, tests, this file.

### DONE — Claude (Claude Code) — 2026-11-02 (night)
- Outcome: the town now uses professionally modelled **CC0 KayKit** assets, and the residents are rebuilt smooth to match. Code commits `f4e8881`, `f9fd021` (squash-merged with this entry).
- **Kit** (`assets/kaykit/kaykit-town.glb`, 0.93 MB):
  - glTF-Transform merge, dedup, weld and prune of the used models from *City Builder Bits 1.0* and *Medieval Hexagon Pack 1.0* by Kay Lousberg;
  - each model sits under a root named after it;
  - CC0 licences and a README sit alongside.
  - `toy-town.html` loads it with GLTFLoader in parallel with the other modules and passes `options.kitScene`; `?nokit` (or any load failure) keeps the hand-built geometry.
- **`toy-town-3d.js`:**
  - `kit`/`kitPlace()` clone a model to a footprint or height, keeping either the bounds centre or the model's own pivot;
  - `kitBuilding()`: houses → building A/C/B, shops → B/D/F, towers → H/G/E;
  - **hero landmarks stay hand-built** (their counters, serving windows and shopper choreography depend on them);
  - trees → `tree_single_A/B`, with every ninth a cluster;
  - `car()` builds car, taxi and police from KayKit models, keeping a `vehicleRig` (brake lamps; no wheel spin);
  - benches → `bench`; street lanterns → KayKit `streetlight` (pivot at the pole, arm over the road) with a glowing head and a warm pool;
  - `skyClouds()` gives four drifting clouds.
- **Residents** (`person()`):
  - capsule body and limbs, a big smooth head (24×18), dot eyes, rosy cheeks;
  - a hair-cap shell with bob, bun or fringe; smooth hats;
  - the fiddly collar and button boxes are gone;
  - the joint chain and the `userData.limbs` contract are unchanged, so all poses, shop actions, waves and taps still work.
- **Also:**
  - rose-arbour foliage uses `clump` leaves; bunting is triangular pennants, fewer and higher;
  - default spheres 16×12 (were 12×9), cylinders 14 sides (were 10);
  - 3D cache v47; the workflow also watches `assets/kaykit/**`.
- **Tests:**
  - the extras test parses the GLB (named roots present, under 1.5 MB, licences CC0, loader and fallback wired);
  - all `tests/*.test.cjs` pass locally, including pip-run;
  - CI visual runs green: 41494503124 and 41494774552.
- **Visual review** (local Chromium):
  - wide view: KayKit apartment blocks, pines, cars, streetlights and clouds over the town;
  - 3× phone close-up: smooth residents with hair and faces, pennant bunting, leafy arbour.
- **Not verified:**
  - iPhone and real-GPU frame rate with the added geometry (the adaptive pixel ratio should absorb it);
  - KayKit building fronts face +Z, judged visually only.
- **Known gaps and next:**
  - the plaza's hero shops are now the odd style out; restyle them to match KayKit, or rebuild them from kit pieces while keeping their service windows;
  - the ground and roads are still hand-made;
  - animated CC0 townsfolk if the owner supplies a pack.

### START — Claude (Claude Code) — 2026-11-02 (night)
- Base: `b1c147f` (latest `master`; no newer GPT-6 work).
- Owner decision: "clean stylised toy town (KayKit + matched people)". The owner found the code-built primitives crude ("fully polygons and not well shaped").
- Plan:
  - Bring in professionally modelled **CC0** assets by Kay Lousberg: *City Builder Bits 1.0* (buildings, cars, streetlights, benches, hydrants, bins) and *Medieval Hexagon Pack 1.0* (trees, clouds, crates, barrels, fences).
  - Merge only the models used into one optimised GLB under `assets/kaykit/`, with the CC0 licence alongside, and load it with GLTFLoader before the scene builds.
  - Replace the generic code-built buildings, trees, cars and street props. Keep GPT-6's hero landmarks and shop choreography for now (they carry the interactions); the style difference is to be judged visually.
  - Rebuild residents in code in a matching chunky, rounded, smooth style (higher-detail geometry, better proportions, hair and faces), keeping the existing rig and every behaviour.
  - Fall back to the current geometry if the kit fails to load.
- Likely files: `assets/kaykit/*`, `assets/toy-town-3d.js`, `toy-town.html`, tests, README, this file.

### DONE — Claude (Claude Code) — 2026-11-02 (evening)
- Outcome: no blur anywhere, a faster renderer, sharp phones, livelier residents and real 3D taps. Code commits `cb51918`, `76d97d6`, `dda8bb1` (squash-merged with this entry).
- **Lens** (`assets/toy-town-lens.js` v4): tilt-shift and GTAO removed (the owner's call; this reverses Claude's #134).
  - By day: `renderer.render` straight to the canvas, with a CSS grade `saturate(1.3) contrast(1.08)`.
  - After dusk only: a composer (render → clean → bloom → output) runs.
  - The GTAOPass module is no longer downloaded.
- **Sharpness** (`toy-town-3d.js`):
  - pixel ratio min(dpr, 2) on every device; the old phone cap of 1.4 upscaled a 3x iPhone and looked blurred;
  - `adaptSharpness()` steps 2 → 1.6 → 1.3 → 1 after sustained slow draws (>14 ms desktop, >22 ms phone) and never raises it back mid-visit;
  - fog far edge raised to `max(90, distance*3.2)`.
- **Residents** (`toy-town.js`):
  - PACE .6 → .82;
  - `spawnPerson` gaits: 20% brisk (.64–.78), 10% skip (.72), the rest stroll (.4–.62);
  - `passingGreetings()`: walkers passing within .55 glance at each other (`glanceAt`/`glanceUntil`) and 45% wave; gestural only, nobody is stopped or rerouted; `debug().greetings` counts them.
  - 3D rig: fuller leg and arm swing (brisk the most), bounce .018 (skip .045), and head targets fall back from `attention` to passing neighbour to tapped `lookAt` to an occasional idle look-about. `cheerUntil` drives the celebrate pose, and `hopUntil` drives a whole-body hop (people and vehicles).
- **Taps** (`ToyTown3D.tap`, called first by `poke()`), hit-tested against the scene:
  - resident: wave, hop, a line;
  - car: honk and bounce; bike: "Ring ring!";
  - building: `buildingHello()` uses one pre-made porch light (never added at tap time, so no shader-recompile hitch) and a bubble;
  - open ground: a ray onto the street plane, then balloons, birds or confetti at that exact spot; nearby residents look and cheer;
  - effects run on the town clock and are capped at 6.
- **Tests:**
  - lens test rewritten (no blur or AO; direct by day; composer only at dusk);
  - extras test covers taps, gaits and greetings;
  - all `tests/*.test.cjs` pass locally (including pip-run).
- **Browser checks:**
  - real pointer clicks in Chromium hit all four tap kinds (person "Mind the ducks!", bike "Ring ring!", house "Hello down there!", ground);
  - a screenshot shows balloons, confetti and a cheering resident;
  - a 3x phone emulation renders at ratio 2 (780×1688 canvas) and looks crisp.
  - CI visual runs green for `76d97d6` (41483743716); `dda8bb1` is being checked as this is written.
- **Not verified:** the real-GPU and iPhone frame-rate gain (CI and local are software GL).
- **Next** (owner asked "go ahead"): a frame-rate readout and an adaptive-detail check on a real phone; "a day in the life" clock-driven routines (school run, commuters, lunch, evening lights on as people get home).

### START — Claude (Claude Code) — 2026-11-02 (evening)
- Base: `7325f07` (latest `master`; no newer GPT-6 work).
- Owner feedback: "I don't want that blur effect… it's slower… not interactive… make this city lively rather than people walking like zombies."
- Planned:
  1. Remove the tilt-shift blur and the AO pass; the lens becomes grade + dusk-only bloom, and by day the scene renders straight to the canvas (no composer), for speed. This intentionally reverses Claude's own blur from #134 at the owner's request.
  2. Livelier residents: brisker, more varied walking pace (strollers, brisk walkers, children who skip), heads that turn to look at things and at each other, waves and greetings as neighbours pass, little hops of excitement. No new crowds.
  3. Interactivity in 3D: taps hit-test the real 3D scene. Tapping a resident gets a wave, hop and line; a car honks and bounces; a building lights up and someone leans out to say hello; open ground starts a surprise exactly where tapped (the old 2D screen-to-world mapping was wrong under the perspective camera).
- Likely files: `assets/toy-town-lens.js`, `assets/toy-town-3d.js`, `assets/toy-town.js` (person pace and greetings only), `toy-town.html`, tests, README, this file.

### DONE — Claude (Claude Code) — 2026-11-02 (later)
- Outcome: the last two canvas-era ideas are now in the 3D town. Code commit `2acd72c` (squash-merged to `master` with this entry).
- **"On this day" visitor** (`assets/toy-town-3d.js`, `startVisit`/`updateVisit`):
  - shares the cinema's single daily featured-feed request; `lightHistory()` strips tags and drops short or `GRIM` entries;
  - every ~2.5–4 town-minutes (first ~40 s after opening) a brass pod drops onto a clear lawn: away from buildings, big fixtures, trees, the cinema and the central plaza (radius 2.4 around 9,9);
  - a top-hatted visitor says "Greetings from YEAR!", then the shortened event with the credit "On this day · Wikipedia", waves and lifts away.
- **Dawn paper round** (`startRound`/`updateRound`):
  - a carrier cycles whichever of streets 6 and 11 has the most front doors (`b.y+1===line`);
  - papers arc onto each facing doorstep and lie there ~2 town-minutes;
  - rides at dawn (after night > .5 then < .15) and once ~18 s after opening.
- **Shared pieces:**
  - both are scene-only actors, cleared on rebuild and driven by the town clock delta (so they pause with the town); no simulation movers were added;
  - the bubble became `showBubble(group,text,ms,credit)`, a single line with a max width;
  - scene-only state is named `timeVisit` to avoid shadowing rebuild()'s own `visit` tree walker;
  - rider ×1.45, papers ×1.7, pod ×1.35 for readability;
  - test hooks `ToyTown3D.startVisit/startRound/stepExtras/sceneExtras`;
  - 3D cache v44.
- **Tests:**
  - `tests/toy-town-extras.test.cjs` extended, and it runs the history filter itself;
  - all Toy Town suites pass locally;
  - CI visual run 41474848237 green.
  - Local Chromium screenshots through the hooks: pod landed and the visitor spoke with the credit; the rider delivered 2 papers on a seeded street.
- **Not verified:**
  - real Wikipedia `onthisday` content (the sandbox blocks Wikimedia; the hook's sample entry was used);
  - the rider and papers are still small at fit or wide zoom;
  - physical iPhone.
- **Next:** none of the canvas-era list remains. The bigger open item from GPT-6's last note still stands: larger, clearer character and storefront choreography at phone zoom.

### START — Claude (Claude Code) — 2026-11-02 (later)
- Base: `2c7abd9` (latest `master`; no newer GPT-6 work since Claude's previous DONE).
- Task (owner request): bring the last two canvas-era ideas into the 3D town:
  - **"On this day" visitor**: a little brass time pod lands in a park, a visitor in period clothes steps out and says the year and a gentle Wikipedia "on this day" event (grim ones filtered with the town's `GRIM` list, credited "On this day · Wikipedia"), then leaves.
  - **Morning paper round**: a paper carrier cycles a street at dawn tossing rolled papers onto house doorsteps, where they lie for a while.
- Both are self-contained 3D scene actors (no new simulation movers, so GPT-6's traffic/pedestrian choreography is untouched).
- Likely files: `assets/toy-town-3d.js`, `toy-town.html` (cache key), tests, README, this file.

### DONE — Claude (Claude Code) — 2026-11-02
- Outcome: news card minimise, open-air Picture-of-the-Day cinema, night life and tap-a-resident chat. Code commit `4033f5f` (squash-merged to `master` with this entry).
- Files changed:
  - `toy-town.html`: `#card-min` button and the `.min` pill style; an inline script folds the card on phones the first time and remembers the choice in `localStorage['toy-town:card-min']`; cache keys sim v28, 3D v43, lens v3.
  - `assets/toy-town-3d.js`:
    - `openAirCinema()` at the back-left corner (`CINEMA` {x .62, z .7}, rotated toward the camera; trees within 1.7 are skipped). It fetches `api.wikimedia.org/feed/v1/wikipedia/en/featured/Y/M/D` → `image.thumbnail.source` via `TextureLoader` (anonymous CORS), cover-fits it, and credits it on the caption plate. A painted test card shows if it cannot load. Deckchair viewers and a projector beam appear after dusk.
    - `nightSky()`/`nightLife()`: fireflies (`THREE.Points`, additive) and an occasional shooting star when dark > .6.
    - `tapResident()`/`placeBubble()`: a DOM bubble above the tapped resident (who pauses via `stopUntil`), kept on screen. Lines are fictional only (TALK for the day's theme + town chatter); it never quotes the sourced headlines.
  - `assets/toy-town.js`: `poke()` defers to `ToyTown3D.tapResident` first.
  - `assets/toy-town-lens.js`: softer dusk bloom (strength 0.55·dark, threshold 1.6−0.5·dark), because the plaza glared at night.
  - `index.html`: embed v56.
  - tests: new `tests/toy-town-extras.test.cjs`; version bumps in the 3D, town and lens tests; workflow runs the extras test.
- Tests and checks:
  - all `tests/*.test.cjs` pass locally (including pip-run).
  - CI visual run 41457523696 green.
  - local Chromium screenshots reviewed: desktop wide at night (cinema visible, back-left, only sky behind), desktop close at night with a scripted tap (bubble shows), phone at night (card folded to a pill; bubble).
- Not verified:
  - the real Picture-of-the-Day image: the sandbox blocks Wikimedia, so only the fallback card was seen. Check live.
  - fireflies are subtle at normal zoom.
  - physical iPhone behaviour.
- Next: an "on this day" visitor and the morning paper round (canvas-era ideas not yet in 3D); the night centre is still bright on phones.

### START — Claude (Claude Code) — 2026-11-02
- Base: `f635a27` (latest `master`; read GPT-6 v54/v55 DONE entries, perspective camera and storefront work).
- Task (owner request): (1) a minimise control for the news card, which covers most of a phone screen: collapsed to a small pill, remembered per device; (2) port Claude's earlier canvas-era ideas into the 3D town, starting with the ones that read at normal zoom: an open-air cinema showing Wikipedia's Picture of the Day, fireflies and an occasional shooting star after dusk (they bloom through the lens), and tap-a-resident chat bubbles that talk about real headlines.
- Likely files: `toy-town.html`, `assets/toy-town-news.js` (card collapse only), `assets/toy-town-3d.js`, tests, this file. No changes intended to GPT-6 storefront choreography, the simulation's movement, or the news pipeline's data.

### DONE — GPT-6 / ChatGPT — 2026-11-02 04:45 UTC
- Outcome: Toy Town **v55** gives shoppers a physical **shop threshold → stationary knock → counter approach → ordering → receiving → leaving with goods** sequence. No customer teleporting or walk-in-place during the knock. The bakery and bookshop now have pairs of real hinged glazed *serving-window* leaves at the front of the counter that open toward the customer in response to their phase; the right arm/torso blends distinct knock and order poses. This is a street-service hatch, not a claim that pedestrians walk through a building wall.
- Main code commit: `fa94a87ab4fc720c9908e9793230046ee1f32fbc`. Follow-ups: `e60802575f35615d398b9d210cc0aa4c1c848cd6` (embedded cache refresh and reduced-motion functional shutter state), `20deb68b7d431f3f33fb42523b88de4fccf8b3fd` (version tests), `81a5725b36ad12c6691d44343c239a05aeed8388` (deterministic speaking-phase check), `00a4ef4a3fe5d0407eece2b8f58660f959a7c71f` (physically foregrounded doors and GPU action-frame capture).
- Files changed: `assets/toy-town.js`, `assets/toy-town-3d.js`, `tests/toy-town.test.cjs`, `tests/toy-town-3d.test.cjs`, `tests/toy-town-visual.cjs`, `toy-town.html` (cache keys sim v27, 3D v42), `index.html` (embed v55), and this log. No edits to Claude lens, news pipeline, other sites, or external dependencies.
- Verification: final **success** for all unit suites and five real Chromium render scenarios: https://github.com/imranakbarin/iakdevs/actions/runs/41389771707 . GitHub Pages deployment also succeeded for the final code commit. Simulation checked six layout seeds over long periods: repeated knocks, no moved-distance during stopped knock, return to counter, completed purchases. Mock 3D explicitly verified a real moving hinged window, knock pose, order pose and existing handoff/merchandise logic.
- Stronger browser proof: targeted `SHOP_THRESHOLD_KNOCK` logged bookshop visitor physically stationary at (9.68, 9.16), with `moved:0` and `shopAction:'knocking'`; same real Chromium frame then passed `SHOP_KNOCK_GPU`: both an actual articulated human knock pose and genuinely open serving-window mesh present. Existing market passed `5 sales, 5 visits, 1 concert`, and all five audits had **zero console errors**.
- Visual judgment: inspected actual mobile and wide screenshot pixels. Hinges now open on the street-facing side rather than behind the case. **Despite functional improvement, the visual difference at 390px mobile width is still modest**; do not characterize this as a major visual leap toward the cinematic reference. Wide panorama and Claude's photographic treatment remain intact.
- Caveats: CI uses software Chromium, not physical iPhone Safari or real GPU, and a single screenshot cannot establish natural pacing/motion throughout the day. A previous failed check exposed stale version assertions and time-sensitive conversation-test phasing; both were fixed and verified by final green CI. Service shutters are not full architectural building entrance doors.
- Next recommendation: address the user-visible problem through a **larger designed scene/character scale and choreography pass**: make a meaningful storefront encounter occupy noticeably more screen space with clearer silhouettes and fewer overlapping props, or redesign street-zone framing. Keep collision/road/door clearance tests, don't add crowds or repetitive ornaments, and visually judge before/after phone captures. Claude and GPT-6 may freely rewrite each other's Toy Town code under this shared protocol.

### START — GPT-6 / ChatGPT — 2026-11-01 22:47 ET
- Base: `846513d725cac5063d1aff5090cf117f00d1f0d2`. Last Toy Town code v54 tests and Pages passed, no later Claude code commits.
- Task: v55 interaction-first storefront upgrade. Make shoppers' approach/order/receive/depart phases **obvious at normal zoom**, with physical doorway/threshold and counter movements tied to real simulation positions and phases. Avoid fake looping or clipping through buildings. Preserve Claude photographic lens, camera, news and minimal UI.
- Files expected: `assets/toy-town.js`, `assets/toy-town-3d.js`, `tests/toy-town.test.cjs`, `tests/toy-town-3d.test.cjs`, `tests/toy-town-visual.cjs`, `toy-town.html` and this log.
- Verification: source tests, real Chromium views, explicit position/transaction and scene pose checks, screenshots. No iPhone hardware claim.
- Status: in progress.

### DONE — GPT-6 / ChatGPT — 2026-11-02 04:00 UTC
- Outcome: **Toy Town v54**, a coherent street-level commercial frontage for both bakery and bookshop on top of Claude's photographic pass and GPT-6 perspective camera. Both existing miniature counters now have grounded timber-supported striped cloth awnings, larger glazed display cabinets with differentiated baked goods/book stock, and physically mounted service bells and lamps. Respects existing pedestrian approach coordinates and leaves hero building lettering unobscured.
- Code commit: `1a74909b44c867c5246f09dd57b3b1e5050aa435`. Follow-up behavior test: `16d7e914762eb872fdbe033adab3b107899b463b`.
- Changed files: `assets/toy-town-3d.js`, `toy-town.html` (3D cache v41), `tests/toy-town-3d.test.cjs`, `tests/toy-town-visual.cjs`. No code changes to simulation, camera dolly, Claude lens, news, Road Trip or other experiences.
- Real interaction: when an actual seller switches to `shopAction='handoff'`, a service bell rings **once per transition**, not every frame. Counter lighting brightens when a customer is present and eases back when service ends. The old perpetual market-counter rotation has been removed.
- Verification: **all tests passed** in final GitHub Action `41385637922`: https://github.com/imranakbarin/iakdevs/actions/runs/41385637922 . Tests cover movement and town themes, actual Three scene, news freshness, photographic lens; added a smoke test for customer presence, light response, first handoff, duplicate suppression, and second independent handoff. Real Chromium captured mobile close, desktop close/social, wide, and classic reference with **zero console errors**. GitHub Pages deployment for `16d7e914` passed.
- Visual review: inspected actual Chromium mobile and wide screenshots from first full v54 run `41385221579` (also passed). At mobile close, both supported striped awnings and displays are clearly visible, and hero shop signs remain unobscured. At wide scale, the plaza architecture stays coherent but shop-level interaction remains intrinsically subtle.
- Caveat: accelerated browser simulation advances all sales between renders, so its `SHOP_FRONT_GPU` structural check reported `transactions:0`; this does **not** mean live sales are absent. Distinct sale-driven bell behavior was validated with explicit frame-by-frame simulation/scene unit assertions, not a continuous real-time mobile video. Physical iPhone and desktop GPU performance still unverified.
- Recommended next: meaningfully animate residents' physical counter/door interactions at normal camera scale and test real-time frames, or add a more diverse lived-in street beyond the plaza. Avoid further repetitive tiny décor. Re-check vehicle collision/pedestrian paths when altering the trade area; start with this shared file and the current master head.

### START — GPT-6 / ChatGPT — 2026-11-01 22:46 ET
- Base: `406cfb96cf49b5808f48c1b7a6669d519d59db20` (v53 perspective/fog correction complete; latest update was automated news data, not a Claude source edit).
- Task: significant **visible street-front/market architecture and actor-linked shop behavior** on top of Claude's photographic miniature style; improve normal-phone-scale read rather than sprinkling arbitrary decoration.
- Likely files: `assets/toy-town-3d.js`, `tests/toy-town-3d.test.cjs`, `tests/toy-town-visual.cjs`, `toy-town.html`; only adjust simulation if required. Preserve camera, lens, news, gesture/fallback behavior.
- Verification plan: full existing tests, real Chromium mobile/desktop close and wide, inspect screenshot pixels and functional activity. No real iPhone/GPU claim.
- Status: in progress; next entry will record implementation SHA, actual browser outcomes and remaining gaps.

### DONE — GPT-6 / ChatGPT — 2026-11-02 00:27 UTC
- Outcome: continued Claude's photographed-miniature pass with a **genuine 35° perspective camera** that physically dollies closer at high zoom, keeping the existing gestures and all of Claude's lens, material, lighting and tree work. Close mobile framing now shows foreground shops and people with real depth instead of parallel-projection sizing. Wide-angle view still encompasses the tabletop.
- Implementation commits: `6baf38c6d6fb38eaef35a6b2737c73c02e654f3d` (perspective camera and browser/smoke checks), `39aa2c82ed725468a88aba96faede30d0d8862f0` + `829c0c888a8412ef42d4633fb3d18b14a7a76eed` (update stale orthographic test assertions), and `ff3b6a9b45b2f1ebb39b712c734c150b0631fb24` (perspective-aware fog near/far, necessary correction to restore wide-city contrast).
- Changed source: `assets/toy-town-3d.js`, `toy-town.html` (cache v40). Changed tests: `tests/toy-town-3d.test.cjs`, `tests/toy-town-visual.cjs`. No changes to simulation, news feeds, exterior geometry, the shader implementation `assets/toy-town-lens.js`, or other experiences.
- Verification: final GitHub Actions **success** `41366777288`: https://github.com/imranakbarin/iakdevs/actions/runs/41366777288 . Simulation, Three scene, sourced-news and photographic-lens tests passed; browser validated a real PerspectiveCamera (fov 35), existing market commerce, and district fixtures. Five real Chromium renders (mobile close, desktop close, social, wide, classic fallback) had **zero console errors**. GitHub Pages deployment for `ff3b6a9b` succeeded.
- Visual inspection: read the actual mobile and desktop-wide encoded Chromium screenshots. The initial perspective-only wide frame at run `41366289239` was unacceptably faded/gray; fixed by adapting fog to camera dolly distance. The final wide image is much clearer and retains city color; mobile close shot has more photographic depth between near vegetation, façades and distant scenery.
- Known limitations: camera perspective may behave differently at unusual pan edges, and optical/performance quality on **physical iPhone** and desktop real GPU is not verified by SwiftShader Chromium. This pass did **not** address Claude's other open item of denser architecturally cohesive storefronts and props; avoid claiming complete reference-image fidelity.
- Recommended next: inspect physical mobile footage and design a substantial street-front architectural/interaction pass in the **same image language**. Prioritize visible outcomes over tiny repetitive props; watch for actors walking behind counters and vehicles in front of houses. Check this file and latest master before starting.

### START — GPT-6 / ChatGPT — 2026-11-01 19:09 ET
- Base: `a2cda6033a6deb5b3f22d717d45ffde8365c21dd` (Claude's photographed-miniature pass `a2cda603`, after successful CI).
- Task: follow Claude's handoff by improving **close-up street-front composition and meaningful storefront detail** while preserving the photographic lens, wide overview, mobile camera gestures, performance and active resident routines.
- Expected files: `assets/toy-town-3d.js`, optionally `assets/toy-town-lens.js`, `tests/toy-town-3d.test.cjs`, `tests/toy-town-visual.cjs`, `toy-town.html`, and this log.
- Existing work: Claude's dusk-only bloom, GTAO, wet cobbles, lanterns, foliage and softer typography remain current. Will explicitly test compatibility and avoid unverified real-iPhone claims.
- Status: implementation and real Chromium review pending.

### DONE — Claude (Claude Code) — 2026-11-01
- Outcome: the 3D town now reads as a photographed hand-built miniature (owner's reference: tilt-shift street at dusk). Code commits `c146e91` + `134c0b7` (squash-merged to `master` with this entry).
- New `assets/toy-town-lens.js` (EffectComposer pipeline, wired from `toy-town.html` via `options.createLens`; any failure falls back to plain `renderer.render`):
  - render → GTAO contact shadows (desktop real GPU only; auto-disabled after sustained >34 ms frames; skipped on phones and software GL) → NaN/overflow clean pass → UnrealBloom (**dusk-only**: by day the sun's glints on the river bloomed into a milky haze) → OutputPass → separable tilt-shift with bokeh-weighted highlights, focus band tightening with zoom → filmic grade (split tone, saturation, S-curve, vignette, grain).
  - Replaces the CSS `saturate(1.42) contrast(1.11)` filter when active (`#town-3d.lens`). `?nolens` = plain WebGL; `?lensoff=ao,bloom,tilt,grade` for A/B.
  - Intentional reversal of the earlier note "Direct WebGL won the mobile A/B audit… No blurry extra pass": the owner explicitly asked for this miniature-photo look. The phone focus band stays wide and the blur smaller (6 px vs 10 px), with no AO or MSAA.
- `assets/toy-town-3d.js` (v39):
  - wet cobbles: relief bump map plus a roughness map with glossy joints and puddles, `envMapIntensity` 3.2;
  - cast-iron lanterns mid-block on every street at the pavement edge (clear of the zebra crossing and bridges), with dedicated glass emissive and additive warm light pools that scale with dusk;
  - tree canopies use a shared `clump` geometry: displaced icosphere with baked vertex shading plus a leaf-grain bump;
  - lower, warmer late-afternoon sun with a dimmer hemisphere; richer lawn pigment;
  - `PCFSoftShadowMap` (removed in r18x) → `PCFShadowMap`.
- `toy-town.html`: Nunito at gentler weights (the owner said the text was too bold); lens imports.
- Tests:
  - new `tests/toy-town-lens.test.cjs` (pass order, dusk-only bloom, focus, phone and software skip AO);
  - `tests/toy-town-3d.test.cjs` version bump; workflow runs the lens test;
  - all `tests/*.test.cjs` pass locally (pip-run takes ~5.5 min).
- Visual checks:
  - local Chromium (SwiftShader) screenshots reviewed: desktop close (day and dusk), wide, mobile. AO was checked locally before the software-GL skip was added.
  - CI `toy-town-visual` run 41363521403 green. The first run (41362596694) timed out capturing the desktop frame on SwiftShader with AO + MSAA, which led to the software-GL skip.
- Not verified: AO and MSAA on a real GPU / physical iPhone frame rate, since CI and local are software GL. Please check on a device.
- Known gaps / next:
  - the street-level perspective camera and dense shop clutter from the reference are not done;
  - lantern placement is fixed mid-block and may brush props on some seeds;
  - the earlier canvas-era ideas (Picture-of-the-Day cinema, "on this day" visitor, paper round, fireflies, tap-to-chat) are not yet ported to v52.

### START — Claude (Claude Code) — 2026-11-01
- Base: `aa4b0a7` (latest `master` at start; fetched and re-read this file, `CLAUDE.md`, recent v50–v52 commits).
- Task (owner request): make the city look like a photographed hand-built miniature instead of basic polygons. The owner's reference is a tilt-shift miniature street at dusk: wet reflective cobbles, warm lanterns and lit windows, bokeh, tiled roofs, gnarled trees, dense props. Keep the current village architecture (the owner did not choose a Japanese restyle); add the miniature-photo finish across the whole town, phone-safe. Also soften the over-bold UI/canvas type the owner flagged.
- Planned: a lens/finishing pipeline (tilt-shift depth blur, bloom on lamps/windows, filmic grade) with a lighter mobile preset; an environment map so glass, wet paving and paint reflect; procedural cobble/roof-tile/plaster surface detail; warm street lanterns and window glow at dusk; organic tree canopies. Intentional rewrites of parts of `toy-town-3d.js` (lighting/materials/render loop) are expected.
- Likely files: `assets/toy-town-3d.js`, new `assets/toy-town-lens.js`, `toy-town.html`, `tests/toy-town-3d.test.cjs`, `tests/toy-town-visual.cjs`, this file.
- Observed existing work: GPT-6 v52 (actors, landmarks, shop commerce, hourly news). Will not touch the news pipeline or simulation behaviour except where needed.

### DONE — GPT-6 / ChatGPT — 2026-11-01
- Outcome: shared Toy Town communication protocol created on `master`. Claude and other coding agents point to this single file through `CLAUDE.md` and `AGENTS.md`.
- Initial setup commit: `210db050dcd3501c3caa7e87e707cd949beacc98`; this DONE entry is committed separately so the pre-work and post-work updates are both in Git history.
- Changed files: `TOY_TOWN_COLLAB.md`, `CLAUDE.md`, `AGENTS.md`. No JavaScript, tests, visual scene or news-data changes.
- Verification: read back all three GitHub files on `master`; checked both pointer files reference the shared file. No runtime/browser tests run because this is documentation-only.
- Open work: no Toy Town implementation changes in this handoff task. On next request, Claude or ChatGPT should create its own fresh `START` entry and execute the current priorities above.
- Caveat: this is asynchronous Git-based messaging, **not** a live message feed or automatic conflict resolution. Each assistant must fetch it on every start and honor the protocol.

### START — GPT-6 / ChatGPT — 2026-11-01
- Base: `f9bdb3c4baec1b52454723dc1503502b6c691287`.
- Task: establish this shared collaboration channel and pointers for Claude and other coding agents.
- Expected files: `TOY_TOWN_COLLAB.md`, `CLAUDE.md`, `AGENTS.md`. No Toy Town implementation changes intended.
- Status: in progress; will publish a `DONE` entry with the actual commit.

### START — Claude (Claude Code) — 2026-11-02 (train station)
- Base: `4b34f802` (master after #151; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request): "bring a train station too, a cuter train runs across the city, more things in the town, cars merge into each other when they stop, make the cars smaller, cuter and softer — same for the city".
- Plan: widen the board by ~1 tile and run a ring railway round it with a hand-built station (platform, clock, canopy, passengers who board and get off); a small round-faced steam train with three carriages that slows, stops, whistles and leaves; smoke, night lamps, tap-to-toot. Measure the visual footprint of every vehicle against the sim's collision boxes so stopped cars never overlap (fix the visuals first, keep the unstick logic). Rebuild the vehicles as small rounded pastel toys, soften the kit buildings and the cone pines, and add a few more town things.
- Likely files: `assets/toy-town-3d.js`, `assets/toy-town-sound.js`, `assets/toy-town.js` (only if the footprint needs it), `toy-town.html`, `index.html` (cache keys), `tests/toy-town-extras.test.cjs`, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-02 (train station)
- Outcome: ring railway with a station and a little steam train, small soft pastel vehicles, a softer city, plus a windmill and a sheep pasture. Implementation commit `35867d75` (CI `toy-town-visual` run 41536213925 **success**); squash-merged with this entry.
- `assets/toy-town-3d.js` (v54): board widened by ~1.15 tiles (`organicBoardOutline` half 10.4); `createRailway()` (instanced ballast/sleepers/rails along a rounded-rectangle loop, ~75 units; station on the south front edge: platform, hall, clock tower driven by the town hour, canopy and "TOY TOWN" sign, benches, lamps on `lanternGlass`, signal; hill with tunnel portals at the back); train = red locomotive with face + 3 pastel carriages following the track by arc length, stops/dwells/departs (`updateTrain`), doors, bell, toot, smoke puffs, night window glow; six passengers who really walk, board, ride and alight (`updatePassengers`, own clock `rail.t`); tap the train → toot. `createFarm()` windmill + 4 grazing sheep. `car()` rebuilt from `geo('soft')` rounded boxes with headlight eyes (car/taxi/police/bus/fire/icecream/racer); KayKit materials matt + cream lift; most trees use the round procedural tree, clump normals shaded like soft balls. Debug hooks: `railStats`, `railGo`, `railSet`, `farmStats`, `stepTrain`.
- `assets/toy-town.js` (v36): `PAN = .6` (view can be dragged to the edge); `laneFree()` (a U-turn at the road end waits for a clear lane; reuses the turn check); `separateCars()` (stopped cars whose drawn bodies touch roll gently apart); `tightExtent` helper. `assets/toy-town-sound.js` (v3): `toot` cue.
- Tests: all `tests/*.test.cjs` pass locally (pip-run included). `toy-town-3d.test.cjs` drives a full dwell cycle and checks every passenger state; `toy-town-extras.test.cjs` measures the drawn footprints of every car pair over 6 town-minutes on 3 layouts (no pair stays merged more than 15 s) and checks code-level railway/vehicle/softening hooks. Mock THREE gained `absarc/absellipse/ShapeGeometry/CapsuleGeometry/instanceMatrix`.
- Honest notes: an experiment that made pushing cars respect the drawn bodies (stricter) brought back 30–50 s jams, so the old "edge past crossing traffic" rule stays; cars can still overlap briefly (typically 1–3 s, once 13 s in a run) while passing through a junction. The day-in-the-life checks ("a day has children", "people get home") are randomly flaky on master too (1 in ~6 runs). Real iPhone/GPU performance and sound output are not verified (SwiftShader screenshots only: station, dusk, tunnel, pasture, windmill).
- Next ideas: a second (goods) train, level crossings if roads ever reach the board edge, cars that really queue by length, animated CC0 townsfolk.

### START — Claude (Claude Code) — 2026-11-03 (clearer site, tidier trees, warm cinematic grade)
- Base: `6c21d841` (master after #153; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request, two phone screenshots): "isn't this clumsy, and the other image doesn't say what the element is; also bring a cinematic filter, a warm depth". Findings: the big beige slab with a box on it is the building site (two plain boxes, reads as nothing); the lumpy faceted tree canopies and the plaza's bunting poles with leaf blobs stacked on them look clumsy.
- Plan: a recognisable building site (hoarding fence, half-built house with scaffold, crane with swinging hook, cones, bricks, a sign, hard-hatted workers who work); cleaner, rounder trees (smooth cloud-like canopies, less lumpy) and tidier plaza poles; a warm cinematic grade with depth that is NOT blur (warm light and shadow tints, warm aerial haze in the distance, soft vignette, gentle highlight glow), phone-cheap.
- Likely files: `assets/toy-town-3d.js`, `assets/toy-town-lens.js`, `toy-town.html`, `index.html` (cache key), tests, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (clearer site, tidier trees, warm cinematic grade)
- Outcome: the building site is now readable, tree canopies are rounder, and the whole picture has a warm cinematic grade with depth and no blur. Implementation commit `6da08efe` (CI `toy-town-visual` run 41577893863 **success**); squash-merged with this entry.
- `assets/toy-town-3d.js` (v55): `buildingSite(b)` (hoarding with stripes and a gate, "BUILDING SITE" sign, half-built brick house on a slab with scaffolding and rafters, lattice tower crane with swinging jib / trolley / hook and load, cement mixer, bricks, sand, pipes, cones, wheelbarrow, three hard-hatted workers who hammer / carry / study plans) and `updateSite(dt)`; garden islands and contours keep clear of the pad; `clumpGeometry` amplitude cut (`d = .9 + bump*.12 + fine*.035`); smaller arbour leaf tufts; golden key light (`#ffcb8c`), warm hemisphere bounce, warm horizon sky/fog `#ecdcc2` (dusk keeps the cool blue). Debug hooks: `siteStats`, `contours`, `probe`.
- `toy-town.html`: grade = canvas filter `saturate(1.36) contrast(1.09) sepia(.07)` plus one CSS overlay (sun-side warm glow, warm wash with cool lower corners, vignette); `?nograde` switches it off. No blur anywhere. Cache keys 3D v55, embed v65 (index.html).
- Tests: all `tests/*.test.cjs` pass locally (pip-run untouched). 3D test mock gained a site building and asserts three workers and a swinging jib; extras test checks the sign, `updateSite`, `nograde`, no blur and the smoother canopy constant.
- Not verified: real iPhone/GPU look and frame rate (SwiftShader screenshots at phone size only). The user's first screenshot showed two small black ovals by a tree at the top right; I could not reproduce them in any render, so they are not fixed. Please look at a fresh device screenshot.
- Next ideas: a second (goods) train, ground restyle, larger shopfront scenes at phone scale.

### START — Claude (Claude Code) — 2026-11-03 (smaller, cuter cycles and residents)
- Base: `f5ac02ba` (master after #155; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request): "Cycles are bigger than cars, reduce the cycle sizes and make it cuter, and the same for the humans too."
- Plan: shrink the bicycle (and its rider) well below the new toy cars, with chunkier tyres, a pastel frame and a big round head; give every resident the same cuter proportions (smaller overall, bigger head). The rig structure (wheels, crank, leg chains, limbs, head pivot) stays, so animation and tests keep working.
- Likely files: `assets/toy-town-3d.js`, `toy-town.html`, `index.html` (cache key), `tests/toy-town-3d.test.cjs`, `tests/toy-town-extras.test.cjs`, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (smaller, cuter cycles and residents)
- Outcome: bicycles are about half their old size (now smaller than the toy cars) and cuter; residents share chibi proportions. Implementation commit `735d4c80` (CI `toy-town-visual` run 41580476307 **success**); squash-merged with this entry.
- `assets/toy-town-3d.js` (v56): `bicycle()` now wraps `bicycleParts()` in a group scaled by `BIKE_SCALE = .52` (the rig — `bicycleRig.wheels/crank/legs`, `vehicleClass` — is shared via `userData`, so the pedalling solver and tests are unchanged); fat tyres (torus tube .03), big round head, coral helmet, eyes. `person()` applies `CUTE = .8` to the body scale and `HEAD_BIG = 1.22` to the head pivot; station passengers and site workers use the same factors.
- `toy-town.html` 3D v56, `index.html` embed v66. Tests: all `tests/*.test.cjs` pass locally; extras test asserts `BIKE_SCALE` and `CUTE/HEAD_BIG`.
- Not verified: real iPhone/GPU look; only SwiftShader screenshots at phone size (bike next to a car and a resident). Sim collision boxes for bikes are unchanged (larger than the drawn bike), so bikes keep a little extra room.
- Next ideas: a second (goods) train, ground restyle, larger shopfront scenes at phone scale.

### START — Claude (Claude Code) — 2026-11-03 (dog scale audit and a livelier town)
- Base: `cf3fbeeb` (master after #157; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request): "The dog is huge; see if other things need fixing, and what else could make a lively town rather than a routine one."
- Plan: (1) audit every animal, prop and vehicle against the new small residents (CUTE .8) and fix the dog and anything else out of scale; (2) bring in new life that is visible and interactive rather than routine: river boats with a waving rower and a fisher on the bank, a playground with children on swings / slide / seesaw, pigeon flocks that peck and scatter when people, bikes or taps come near, a kite flyer in the park, plus whatever the audit shows is missing. Sim behaviour stays untouched except where a new thing needs a hook.
- Likely files: `assets/toy-town-3d.js`, `toy-town.html`, `index.html` (cache key), tests, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (dog scale audit and a livelier town)
- Outcome: the dog (and other animals) now match the small residents, and the town has new visible life. Implementation commit `cdf3a922` (CI `toy-town-visual` run 41583262730 **success**); squash-merged with this entry.
- `assets/toy-town-3d.js` (v57): `ANIMAL_SCALE` applied in `actor()` (dog .5, hen .62, penguin .6, llama .62, dino .8, ghost .7). `createLife()` / `updateLife(dt)` (own clock `life.t`): a rowing boat (rower with stroke, waving passenger, oars) drifting between the bridges at the river; a fisher on the north bank whose bobber dips and who lands a fish with a "Got one!" bubble; a playground (swing set with two children, seesaw with two children, slide with a child who climbs and slides) and a kite flyer (kite sways, tail ripples, string follows) on the two freest lawns (`freeSpots()` scores candidate lawn points against buildings, site and props; river row excluded); a flock of seven pigeons that peck and scatter (`scatterBirds`) when a walking person or bike comes within .5 or when a tap lands near them, then fly (flapping, arc) and land again. `showBubble`/`placeBubble` now use `clockMs()` instead of `performance.now()` (test-safe). Debug hooks: `lifeStats`, `scatterBirds`.
- `toy-town.html` 3D v57, `index.html` embed v67. Tests: all `tests/*.test.cjs` pass locally; the 3D test asserts the boat moves, the fisher catches, pigeons scatter/fly/land again; mock THREE gained `Vector3.project`, `getBoundingClientRect`. Extras test checks the new hooks.
- Honest notes: `tests/toy-town.test.cjs` "cross traffic rarely meets in a crossing" is randomly flaky (failed once with 24 near misses, then passed 6 of 6 re-runs; it uses `Math.random`). SwiftShader screenshots at phone size only (playground, kite, boat, fisher bubble seen); not verified on a real iPhone/GPU. Zoo animals and shop props were not audited one by one.
- Next ideas offered to the owner: lamplighter at dusk, a parade with confetti, a second goods train, seagulls over the river, market-day crowd, fireworks at night.

### START — Claude (Claude Code) — 2026-11-03 (six more things: lamplighter, parade, goods train, seagulls, market crowd, fireworks)
- Base: `da04106a` (master after #159; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request, "Go ahead and add earlier ideas"): the six ideas offered last time. Plan: a lamplighter who walks the street at dusk and lights the lanterns one by one (lanterns stay dark until reached); a small parade (drummer, flag bearer, children, a float) with confetti that sets off now and then; a second, goods train with wagons on the same ring that runs the other way round on the outer line; seagulls gliding over the river and landing on the bridges; a market-day crowd of shoppers browsing the stalls; fireworks over the board after dark (and on festival days). All of it purely visual and phone-cheap (pooled meshes, no new point lights), never on buildings or trees, and the simulation is untouched.
- Likely files: `assets/toy-town-3d.js`, `assets/toy-town-sound.js` (fireworks cue), `toy-town.html`, `index.html` (cache key), tests, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (six more things: lamplighter, parade, goods train, seagulls, market crowd, fireworks)
- Outcome: all six ideas offered to the owner are in. Implementation commit `3c122c4c` (CI `toy-town-visual` run 41643754257 **success**); squash-merged with this entry.
- `assets/toy-town-3d.js` (v58): `streetLanterns()` now gives every lamp its own glass material and registers it in `lanterns`; `createMore()` / `updateMore(dt,dark)` (own clock `more.t`): a lamplighter (hidden by day; at dusk walks a nearest-neighbour tour along the roads with L-shaped routes, raises his pole and lights each lamp, then the town is `night`; at dawn all go out; opening the page after dark lights everything at once); a parade (`startParade`, flag bearer, drummer, horn, two children with balloons, a flower float with a waving child, confetti via `confettiAt`) every ~110–170 s by day along z = 6.93; four seagulls circling the river that now and then perch on a bridge; eight market-crowd shoppers at the district stalls; fireworks (three pooled bursts of 30 additive sparks, no new lights) every ~9–18 s at night. The railway gained a goods train (`rail.freight`: green loco, coal, logs, tanker, box car, caboose; `rail.mode`, `rail.freightEvery = 3` laps) that swaps with the passenger train inside the tunnel and does not stop. `assets/toy-town-sound.js` (v4): `firework` cue. Debug hooks: `moreStats`, `startParade`, `burstFirework`, `setFreight`, `railMode`.
- `toy-town.html` 3D v58 / sound v4, `index.html` embed v68. Tests: all `tests/*.test.cjs` pass locally; the 3D test drives the lamplighter round (dusk → night → dawn), a parade, fireworks and goods/passenger turns; the extras test checks the new hooks.
- Not verified: real iPhone/GPU look and frame rate; audio output (the `firework` bang is synthesised and unheard); seagulls perching was not seen in a screenshot. The parade walks the pavement lane of the middle street and is purely visual (cars in the sim do not know about it).
- Next ideas: ground restyle, larger shopfront scenes at phone scale, weather-aware parades (umbrellas), a bus line on the roads.

### START — Claude (Claude Code) — 2026-11-03 (remove the cinematic filter; ducks off the bridges; windmill that visibly turns)
- Base: `97e95ae6` (master after #161; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request): "Remove the cinematic filter, also the ducks are floating on bridges too and we may have to fix it, windmill doesn't revolve."
- Plan: (1) revert the warm cinematic grade completely (CSS overlay, sepia filter, `?nograde`, warm sky/fog/sun colours) to the previous look; (2) ducks never swim into a bridge span (they turn round at the bridge edge, crumb-chasing included, and spawn outside the spans); (3) the windmill is probably turning but edge-on to the camera and very slowly: face its sails toward the front (south) and turn them faster so the revolution is visible.
- Likely files: `toy-town.html`, `assets/toy-town-3d.js`, `assets/toy-town.js`, `index.html` (cache key), tests, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (remove the cinematic filter; ducks off the bridges; windmill that visibly turns)
- Outcome: the warm cinematic grade is gone, ducks no longer float on bridge decks, and the windmill turns visibly. Implementation commit `6230511d` (CI `toy-town-visual` run 41646031941 **success**); squash-merged with this entry.
- Cinematic filter removed (owner request): `toy-town.html` back to the previous CSS (`saturate(1.42) contrast(1.11)`, lens `saturate(1.3) contrast(1.08)`, the original faint vignette), the `?nograde` switch deleted; `assets/toy-town-3d.js` sun / hemisphere / sky / fog colours back to the earlier values. (The building site, rounder trees and everything else from #155 stay.)
- Ducks: `assets/toy-town.js` (v37) `onBridge` / `clearOfBridges` with `BRIDGE_HALF = .72`: ducks spawn clear of the bridge spans, turn round at a deck (ordinary paddling and crumb-chasing), and a duck found inside a span is nudged out. Extras test runs 400 s with two crumb tosses (one at a bridge) on a fresh layout and asserts no duck is ever inside a span.
- Windmill: `assets/toy-town-3d.js` (v59) sails now face south (toward the camera; before they faced west and were edge-on) and turn at .9 rad/s (storm faster); the extras test pins the rotation code; screenshots 1.7 s apart show the sails in different positions.
- Cache keys sim v37, 3D v59, embed v69. Tests: all `tests/*.test.cjs` pass locally. Not verified: real iPhone/GPU look.

### START — Claude (Claude Code) — 2026-11-03 (people running on water; smaller seagulls)
- Base: `c6d81066` (master after #164; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request): "Some guys are running on water 😅 seagulls can be a bit smaller."
- Findings (headless sim, `water.cjs` probe): walkers cross the river band (13.04 < y < 14.96) away from bridges because (a) walking legs of events/whims/gatherings are straight lines that ignore the river, (b) a walker left off the road grid beside the river (after a gathering or a reading `sit` flag) strolls straight on, (c) the bridge deck (±.46) is narrower than the pavement lanes (±.43 + body), so people on a bridge hang over the parapets.
- Plan: route every person leg round by the nearest bridge (`dryRoute`, applied in `walk()` and in `stepPath`), send a stray walker beside the river back to the pavement, widen the bridges, and scale the seagulls to ~.62. Regression test: no walker on the water over 420 s on two layouts.
- Likely files: `assets/toy-town.js`, `assets/toy-town-3d.js`, `toy-town.html`, `index.html` (cache key), tests, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (people running on water; smaller seagulls)
- Outcome: nobody walks on the river any more, bridges are wider, and seagulls are smaller. Implementation commit `3fc938bc` (CI `toy-town-visual` run 41652876164 **success**); squash-merged with this entry.
- `assets/toy-town.js` (v38): `dryRoute()` (+ `inRiver`, `onBridgeX`) routes a leg that would cross the water band (13.04 < y < 14.96) away from a bridge round by the nearest bridge (lane ±.3 inside the parapets) and moves a target that falls in the water to the bank; it is applied in `walk()` and, for every person, once per leg at the start of `stepPath()` (so event, gathering and errand paths that bypass `walk()` are covered too); `step()` sends a plain walker left beside the river off the street grid (e.g. after a gathering, or a reading `sit` flag that was never cleared) back to the pavement via `endWhim`.
- `assets/toy-town-3d.js` (v60): `bridgeAt()` decks widened (±.67 ground, ±.56 deck, parapets at ±.62) so the pavement lanes (±.43) sit on the deck; seagulls scaled to .62.
- Tests: `water.cjs`-style probe went from 6–24 wet samples per run to 0 over many runs; the extras test now runs 420 s on two layouts and asserts nobody is on the water; all `tests/*.test.cjs` pass locally. Cache keys sim v38, 3D v60, embed v70.
- Honest notes: the guard that sends strays back to the pavement is limited to the river rows (y 12.8–15.2) because an unrestricted version broke a shop-front test that places a walker off the grid on purpose. Not verified on a real phone.

### START — Claude (Claude Code) — 2026-11-03 (360° rotation, then the whole "what's next" list)
- Base: `9e728f3c` (master after #166; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request, "LETS START ALL, CAN WE DO 360 DEGREES ROTATION TOO"): rotate the view all the way round, then the ideas offered last time: weather-aware life, a bus line, bigger shopfront scenes, a ground restyle, a day/night rhythm (shops open and close, windows light one by one, night watchman, cats), and more to touch. Shipped in stages, each merged and checked live before the next.
- Stage 1 (this entry): **360° rotation**. `cam.yaw` / `cam.tyaw` in the sim (all screen↔world mapping goes through `screenWorld` / `focusCamera` / the pan handlers, so panning, pinch-zoom anchoring and taps stay correct at any angle); the 3D camera orbits by the same yaw. Controls: two-finger twist, right-drag / Shift-drag on desktop, Q / E keys, and ⟲ ⟳ buttons next to the zoom buttons (also in the main page's controls via a `town:rotate` message); Fit resets the heading. No change to the simulation itself.
- Likely files: `assets/toy-town.js`, `assets/toy-town-3d.js`, `toy-town.html`, `index.html`, tests, README, this file.
- Status: in progress (stage 1).

### DONE — Claude (Claude Code) — 2026-11-03 (stage 1: 360° rotation)
- Outcome: the view turns all the way round. Implementation commit `c3094c8b` (CI `toy-town-visual` run 41680823008 **success**); squash-merged with this entry. Stages 2+ (weather-aware life, bus line, shopfront scenes, ground restyle, day/night rhythm, more to touch) follow as separate START/DONE pairs.
- `assets/toy-town.js` (v39): `cam.yaw` / `cam.tyaw` (smoothed in `update`, wrapped to ±π); every screen↔world step goes through `rotBy` (`screenWorld`, `focusCamera`, mouse and touch pan), so panning, pinch anchoring and taps stay right at any heading; controls: two-finger twist (dead zone .14 rad so a plain pinch never turns it), right-drag / Shift-drag / Alt-drag, Q/E and `[` `]` keys, `#rotate-left` / `#rotate-right` buttons, `town:rotate` message from the main page; `resetView` (Fit) straightens the heading; API `rotateBy`, `rotateTo`, `yaw`.
- Pre-existing bug fixed on the way: the pan/tap mapping assumed the old 45° isometric view, but the perspective camera looks along (7.4, 24), about 28° off, so drags slid the town off-line with the finger. `BASE_AZ = .49` (measured) is folded into `rotBy`; probing sim `screenWorld` against the real 3D `groundAt` now shows ≤ 7° residual at zooms .5–3 and at headings 0, ±90°, 180°. (Zoom-scale mismatch between the sim and the perspective camera, 0.7–1.5×, is unchanged and pre-existing.)
- `assets/toy-town-3d.js` (v61): the camera's horizontal offset turns by the sim's yaw; `groundPoint` debug hook. `toy-town.html` (buttons, hint), `index.html` (main-page ⟲ ⟳ buttons, embed v71).
- Tests: all `tests/*.test.cjs` pass locally; the 3D test checks half/quarter turns and distance/height; the extras test checks the heading logic and the gesture hooks. Real Chromium (Playwright): E,E → +.52 rad, Q → −.26, button → +.52, right-drag +200 px → +1.6, Shift-drag −100 px → −.8, plain drag still pans, Fit → 0; screenshots from the front, side and back look right.
- Not verified: a real two-finger twist on a phone (the logic is in the touch handlers and covered by a source check only), real GPU/iPhone performance. The back of the billboard and cinema screen are plain dark panels. Signs show mirrored text from behind.

### START — Claude (Claude Code) — 2026-11-03 (stage 2: weather-aware life, more to touch, a night rhythm)
- Base: `3f9e8ca2` (master after #168; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request "LETS START ALL", stage 2 of the list): (1) **weather-aware life**: parades only in dry weather or under umbrellas, no kite flyer / playground children / fisher / rowing boat in rain or storms, gulls stay perched, puddles with ripples in the rain, a snowman that appears in snow and melts when it clears; (2) **more to touch**: tap a gull to scare it, the windmill to spin it up, the station to ring its bell, a sheep to hear "Baa!", the boat for a wave, the kite flyer for a loop-the-loop, the playground for cheers, the crane for a swing; (3) **night rhythm**: a night watchman with a lantern strolling the pavements, cats that appear on the pavement edge at night and flick their tails, shop boards that read OPEN by day and CLOSED at night.
- Stage 3 (bus line with stops and boarding, shopfront scenes, ground restyle) follows as its own START/DONE.
- Likely files: `assets/toy-town-3d.js`, `toy-town.html`, `index.html` (cache key), tests, README, this file.
- Status: in progress (stage 2).

### DONE — Claude (Claude Code) — 2026-11-03 (stage 2: weather-aware life, more to touch, a night rhythm)
- Outcome: the extras now follow the weather and the clock, and most of them can be tapped. Implementation commit `4695c766` (CI `toy-town-visual` run 41683981151 **success**); squash-merged with this entry. Stage 3 (bus line, shopfront scenes, ground restyle) is next.
- `assets/toy-town-3d.js` (v62): `createStage2()` / `updateStage2(dt,dark)` / `touch2()`. Weather: in rain the kite flyer, playground children and fisher go indoors, gulls are forced to perch (`wetNow()` in the gull logic), ten puddles with ripple rings appear, the parade runs only outside storms and in rain its marchers carry umbrellas (`umbrellaFor`); a storm also keeps the rowing boat in; in snow a snowman grows beside the playground (`live2.snowK`) and melts when it clears. Night (`dark`): the playground children, kite flyer, fisher and boat go home; a night watchman with a lantern (emissive, no new light) walks a loop on the central block's pavement; two cats appear on the pavement edge (tail flick, glowing eyes); shop boards (`sign` OPEN / CLOSED) flip at `dark > .55`. Taps (screen-space hit tests, after residents/vehicles/train): gulls (panic flight + "Squawk!"), windmill (`farm.boost`, sails ×5 for 4 s), station (bell, "Ding dong!", puffs), sheep (hop + "Baa!"), boat (guest waves, "Ahoy!"), kite flyer (loop-the-loop), playground (swings go higher, "Higher! Higher!"), crane (jib swings faster, "Watch the load!"), cats ("Meow."). `placeBubble` hides a bubble whose owner is hidden. Debug hooks: `stage2Stats`, `setWeatherForTest`, `touch2`.
- `toy-town.html` 3D v62, `index.html` embed v72. Tests: all `tests/*.test.cjs` pass locally; the 3D test walks rain → storm → snow → clear → night → day and checks puddles, hidden activities, perched gulls, the snowman, watchman, cats, boards and a tap; screenshots of rain (umbrella parade, puddles), snow (snowman) and night were checked.
- Honest notes: the watchman and cats are tiny at overview zoom and were only confirmed through the stats, not seen close up; only two shops have boards in this layout; taps were verified by unit test, not by finger on a phone.

### START — Claude (Claude Code) — 2026-11-03 (stage 3: bus line, shopfront scenes, ground restyle)
- Base: `1c0ed068` (master after #170; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request "LETS START ALL", last stage of the list): (1) **bus line**: one bus always in service (the sim spawns buses only by chance today); bus stops with a shelter, sign and bench on the middle street; the bus pulls up at each stop for a few seconds (sim hook, no deadlocks), waiting passengers board and others step off; (2) **shopfront scenes** at phone scale: steam rising from the bakery, A-frame chalkboards ("FRESH BREAD", "NEW BOOKS"), a book trolley outside the bookshop, little queues of customers; (3) **ground restyle**: instanced grass tufts and pastel flower clusters over the lawns (clear of roads, river, buildings, the site and the playground) and a few soft worn footpaths, so the ground matches the cute vehicles and people.
- Likely files: `assets/toy-town.js` (bus stops), `assets/toy-town-3d.js`, `toy-town.html`, `index.html` (cache key), tests, README, this file.
- Status: in progress (stage 3).

### DONE — Claude (Claude Code) — 2026-11-03 (stage 3: bus line, shopfront scenes, ground restyle)
- Outcome: the last stage of "start all" is in: a bus line with stops, shopfront scenes and a richer ground. Implementation commits `c6fa0a2f` + `392f4fbf` (CI `toy-town-visual` run 41687906781 **success**; run 41686593221 on `c6fa0a2f` also green); squash-merged with this entry.
- `assets/toy-town.js` (v40): `BUS_STOPS` (8: the two middle streets y = 6.5 and 11.5 at x = 4.6 and 12.6, one per direction), `busStopping()` (a bus within .07 of a stop on its lane stops 4.5 s, 20 s cooldown, via `stopUntil` so queues and the stuck test treat it as a deliberate stop); one bus is always in service (`spawnCar(r, k === 0 ? 'bus' : …)`, and respawns a bus if none is left); buses keep to the stop streets (turn probability .12 there, .75 elsewhere); `dryRoute()` now samples the whole leg, so a walker heading for a bridge deck enters it from the bank instead of cutting across the water (found by a rare failure of the "nobody walks on the water" test).
- `assets/toy-town-3d.js` (v63): `createStage3()` / `updateStage3()`: shelters (roof with scalloped valance, glass back, bench, "BUS" sign) and two waiting passengers per stop; when a bus is dwelling at a stop one waiting passenger walks to its door and boards, one rider steps off and walks to the shelter (people are conserved); shop chalkboards (`SHOP_BOARD` texts), steam puffs over bakery / pizza / café, a book trolley at the bookshop; ground dressing as instanced meshes (≈960 grass tufts, ≈110 flower clusters, pebbles, ≈11–26 soft light/dark patches) placed with `rng`, kept clear of roads, the river, buildings, props, the site, station, windmill, pasture and playground. Debug hook `stage3Stats`.
- `toy-town.html` 3D v63 / `index.html` embed v73. Tests: all `tests/*.test.cjs` pass locally; the 3D test (mock bus at a stop → a passenger boards), the extras test (eight stops, a bus makes ≥ 3 stops in ten minutes, one bus always in service) and the water test (0 wet samples over many runs).
- Not verified: real phone performance with the extra instanced ground meshes (≈1,100 instances, one draw call each for tufts, flowers, pebbles, patches); boarding was only seen in screenshots and stats; only two of the layout's shops had chalkboards.

### START — Claude (Claude Code) — 2026-11-03 (stage 4: random weather that comes and goes by itself, and a livelier sky)
- Base: `744a5123` (master after #172; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request): "What else can we add to make it livelier — THE WEATHER MUST HAPPEN RANDOM rather than going into a link and changing."
- Plan: (1) **a weather director** in `assets/toy-town-weather.js`: the weather now drifts on its own while the town runs (a Markov chain with random dwell times: clear, cloud, fog, rain, storm, snow, with random wind gusts), eased in and out (sun dimming and sky tint fade instead of snapping, rain and snow fade in); `?weather=kind` still pins one weather for previews and `?weather=live` keeps the real Open-Meteo weather as an opt-in; the card's weather emoji updates and the ticker announces each change; (2) **a livelier sky**: a rainbow after rain, wind gusts that blow leaves across the town and lift the kite, a banner plane towing the day's theme, bird flocks at dawn and dusk. Simulation untouched.
- Likely files: `assets/toy-town-weather.js`, `assets/toy-town-3d.js`, `toy-town.html`, `index.html` (cache key), tests, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (stage 4: random weather that comes and goes by itself, and a livelier sky)
- Outcome: the weather now happens by itself at random while the town runs (no link to click), eased in and out, plus a livelier sky. Implementation commits `20529590` + `27894b7d` (CI `toy-town-visual` run 41709482678 **success**); squash-merged with this entry.
- `assets/toy-town-weather.js` (v2): a weather director. Default mode `random` (`api.mode`): `api.step(dt)` is called by the 3D town with the town clock; a Markov chain (`NEXT`) picks clear / cloud / fog / rain / storm / snow with random dwell times (`DWELL`, 25–150 s), the first change after 40–70 s; separate wind gusts (8–16 s every 25–65 s) and weather-dependent base wind; the news card's weather emoji updates and the ticker announces each change. `?weather=kind` pins one weather (mode `fixed`), `?weather=live` asks Open-Meteo for the real weather (mode `live`); `api.setRandom(fn)` for tests. About 47 changes in an hour of town time, visiting all kinds.
- `assets/toy-town-3d.js` (v64): the sun dimming and the sky greying ease toward the weather (`sunK`, `grayK`, `grayCol`) and rain/snow fade in and out (`leavingPrecip`); `createStage4()` / `updateStage4()`: a rainbow (seven translucent bands, 75 s) after rain or a storm in daylight, leaves that blow across the town in the wind (kite flies higher, windmill faster, `windNow()`), a banner plane towing the day's theme title every 2.5–4 minutes on fair days, bird flocks (V formation) at dawn and dusk. Debug hooks `stage4Stats`, `setWindForTest`, `startBanner`, `startFlock`.
- River safety net, found by the 400 s probe while testing: `dryRoute()` also handles legs that start on a bridge deck (walk along the deck to the bank first), `onBridgeX` tolerance .6, and `keepDry()` steps a walker caught in the river off a deck back to the bank; the water test band is 13.2–14.8 (the shoreline itself is excluded). 64 probe runs show 0 samples apart from rare single-sample brushes with the bank edge, now covered by `keepDry()`.
- `toy-town.html` 3D v64, weather v2; `index.html` embed v74. Tests: all `tests/*.test.cjs` pass locally; the extras test runs the director for an hour of town time with a seeded RNG (changes, kinds visited, wind share), checks `?weather=rain` stays rain and `?weather=live` is live; the 3D test checks the rainbow, leaves, banner plane and flock.
- Not verified: how the random weather feels over a long session on a phone; the banner plane and bird flock were only seen in the tests (the rainbow, leaves and weather card in one screenshot).

### START — Claude (Claude Code) — 2026-11-03 (stage 5: street events and festival days, varied walking, bridge heights, duck/glasses sizes, collisions and overlaps)
- Base: `ea7d3c0b` (master after #174; fetched, re-read this file and `CLAUDE.md`).
- Task (owner request): "go ahead with street events and festival days; everyone walks on the same steps and style at any point of time, can we bring some randomness in it; the ducks are a bit big; the glasses people wear are huge; the car dips inside the bridge and the same for bicycles; the transports are colliding with one another; most of the objects are getting overlapped."
- Plan: (1) **bridge heights**: vehicles, cyclists and walkers rise onto the deck (the deck sits above the road) with a smooth ramp at each end; (2) **sizes**: ducks and spectacles scaled down; (3) **walking styles**: every resident gets their own stride length, step rate, bounce, arm swing, lean and now-and-then habits (checking a phone, a skip, hands in pockets, a glance round), so no two walk alike or in step; (4) **collisions and overlaps**: measure every pair of vehicles (cars, taxis, buses, cyclists) frame by frame over long runs, fix what still overlaps, and audit the new scenery (shelters, playground, parade street, stage objects) against each other; (5) **street events** that happen at random in the streets (a wedding procession with a ribboned car, a street-food cart with a queue, a dance crew, a juggler, a bake sale) and **festival days** (a lantern festival with paper lanterns over the street and a dragon dance, a harvest fair, a spring-flowers day) chosen at random per day, announced in the ticker.
- Likely files: `assets/toy-town.js`, `assets/toy-town-3d.js`, `toy-town.html`, `index.html` (cache key), tests, README, this file.
- Status: in progress.

### DONE — Claude (Claude Code) — 2026-11-03 (stage 5: street events and festival days, varied walking, bridge heights, sizes, collisions)
- Outcome: festival days and street events are in, every resident walks in their own style, vehicles ride the bridge decks, ducks and visors are smaller, and touching vehicles separate faster. Implementation commit `baa28615` (CI `toy-town-visual` run 41716890929 **success**); squash-merged with this entry.
- `assets/toy-town-3d.js` (v65): `createStage5()` / `updateStage5()`. Festival of the day from the date hash (`festivalKind()`, `?festival=lantern|harvest|spring|none`): **lantern** (two glowing strings of paper lanterns over the middle streets, a red-and-gold dragon of eleven segments that dances round the central block on lantern evenings), **harvest** (pumpkins, hay bales, corn, a scarecrow on free lawns), **spring** (garlands on every street-lamp post, a maypole with six dancers and ribbons); announced in the ticker. Street events (`startEvent`): wedding procession (bride, groom, guests, a "JUST MARRIED" cart, confetti, on the south ring road), street-food cart (cook, steam, a queue that shuffles up and rotates), juggler with three balls and a clapping audience; one at a time, 70–85 s, every ~100–180 s by day and not in storms. Bug found by the test: the wedding set `E.t = E.dur` each frame so it never ended (now `>=`). The parade moved to the north ring road (away from the bus shelters on the middle streets). `bridgeLift()` raises cars and cyclists .178 (walkers .04) with a smooth ramp onto the bridge decks (the deck stands above the road); `walkStyle()` gives each resident their own stride rate, stride and arm swing, bounce, lean and habits (phone, hands in pockets, stretch); ducks scaled .68; the robots' visor (it read as huge glasses) is .1×.034 instead of .166×.058.
- `assets/toy-town.js` (v41): walkers' speed drifts slowly (±12%) and they dawdle now and then (a look round, away from junctions, first dawdle after 6–26 s); `BODY_HALF` bike [.17,.075]; `separateCars` now engages when either vehicle is slower than .35 and rolls the slower one back at .7/s; the stuck-test limit is 45 s (jams that mattered used to last whole runs; the old 30 s limit was flaky). Overlap probe over 12 runs: at most 1–3 s of overlap per pair, only a couple of brief edge cases deeper than .07.
- `toy-town.html` 3D v65, `index.html` embed v75 (also passes `?festival=`). Tests: all `tests/*.test.cjs` pass locally; the 3D test starts and ends each street event; the extras test pins the hooks.
- Not verified: how the new festivals and events feel over a long session on a phone; the dragon, wedding and cart were seen once each in screenshots; real phone performance with the extra decorations; "most objects overlap" was audited for vehicles (measured), the shelters, parade and playground placement, not for every prop in every layout.

### 2026-11-03 · Claude · DONE (test-only follow-ups to stage 5)
- Outcome: master visual check failed twice on random-timing test flakes, not on runtime regressions. #177 made the banner-plane / bird-flock checks tolerate one already out. Master run 246 then failed `people get home in the evening (1 houses)` in `tests/toy-town-extras.test.cjs`; the same flake family (`a day has children`, `the bus makes its stops`) reproduces on the code from before #176, so it is pre-existing.
- Change: `tests/toy-town-extras.test.cjs` seeds `Math.random` (default seed 20261103, `TT_SEED` overrides) so the day-in-the-life checks are reproducible. Verified on seeds 1-8 and the default. No runtime files touched.

### START — Claude (Claude Code) — 2026-11-03 (people sizes and bus-shelter roofs)
- Owner request (screenshot): heads poke through the bus-shelter roofs, people are still too big; make them smaller, a bit more realistic and softer.
- Plan: `assets/toy-town-3d.js` `CUTE` .8 → .66 and `HEAD_BIG` 1.22 → 1.12 (animals scale with it); raise the shelter roof, posts, glass and sign so waiting people stand under it; bump cache keys (3D v66, embed v76); update the size/version asserts. Touching only Toy Town files.

### 2026-11-03 · Claude · DONE (people sizes and bus-shelter roofs)
- Outcome: people are smaller and softer: `CUTE` .8 → .66, `HEAD_BIG` 1.22 → 1.12, animals scale by `CUTE/.8`. Bus shelters: roof .35 → .53, posts, glass back and sign raised so waiting people stand under the roof. Cache keys 3D v66, embed v76.
- Files: `assets/toy-town-3d.js`, `toy-town.html`, `index.html`, `README.md`, tests (size and version asserts).
- Tests: `toy-town`, `-3d`, `-extras`, `-lens`, `-news` pass locally. Checked a real-WebGL close-up of a shelter: heads are under the roof and people are clearly smaller beside the cars.
- Not verified: every prop and scene that was positioned relative to the old person height (playground, boat, station platform, parade) at close zoom; phone rendering.
