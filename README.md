# Infinite World Scrolls

A standalone canvas experience at https://imranakbarin.github.io/iakdevs/.

## Modes

- **World art** — endless living paintings: Gond, Warli, Madhubani, Kangra, Japanese, Chinese and Mexican folk-art inspired. Live art uses each tradition's procedural chunk grammar; Artworks → Painting uses the authored panoramas in `assets/art-*-living.webp` (see `assets/living-art-notes.md`).
- **Road trip** — distance-based perspective road with weather, five environments, a touring car and at most one other vehicle. An animated drive, not a traffic simulator.
- **Zen garden** — raked-sand patterns over painted gardens.
- **Cozy Worlds** — calming illustrated scenes.
- **Pip Run** — a small original platformer you can play (`#pip-run`).

## Deep links

`#<style>-<seed>` opens a style at a seed, e.g. `#gond-12345`, `#warli-7`. Prefix `painting-` for the painted panorama (`#painting-kangra-3`). `#zen-…`, `#road-…` and `#cozy-…` open the other modes. Seeds vary the starting layout; they do not regenerate painted panoramas. Editing the hash in an open tab loads that world.

## Gond benchmark

`assets/gond-benchmark.js` replaces the Gond chunk grammar with a composition-first layout: one hero tree per chapter, an optional support tree whose placement is planned from a separate seeded stream so neighbouring chunks never collide, one animal story, rooted bank plants and patterned distant rises that run down behind the bank.

## Creature behaviour

`assets/creature-mind.js` gives live-art creatures simple intentions. `wander` alternates rests (with an idle action) and purposeful walks between seeded waypoints; `flight` tours perches for birds and butterflies. Both are pure functions of time and seed, so paused redraws stay pixel-identical and evicted chunks rebuild exactly; gait phase follows distance actually covered, so nothing moonwalks.

- **Gond:** each chapter's animal keeps to its own chapter by half its body width (no cross-seam overlaps). Deer graze, rabbits nibble, peacocks shiver their fans and peck; prey next to a tiger chapter stops, faces and watches it while the tiger crouches into a stalk. Birds commute between the real crowns of neighbouring trees (crown geometry is replayed from the tree painter's seed, which `add()` now returns).
- **Warli / Madhubani / Kangra:** grazing animals and strollers walk-and-rest; walkers' and the plough team's legs stop at the turn. Kangra's boat moors and faces its direction of travel. Madhubani zone names now match what they paint.
- **Japan / China / Mexico:** flocks fly the way they face instead of flapping in place; a butterfly works each Mexican clearing's flowers and pond edge.
- **Road trip:** props fade with the share of their place in the ground under them, and roadside slots cross-fade to the new place, so the desert no longer carries alpine pines.

## Presence (calm interaction)

`assets/art-presence.js` lets live art respond to the viewer without new controls; every response fades within a few seconds and reduced motion disables it.

- **Attention:** a resting mouse pointer, or a finger held still for ~0.4s, is noticed by nearby creatures. Their own clock eases to a stop, they look up and face you, then resume from where they were (no jumps). Gond prey prick up; the tiger watches; a watched peacock displays.
- **Lean in:** while you attend, the scroll eases to ~30% speed, then returns.
- **Tap:** water ripples; fish, ducks and hens scatter and drift back; a tap near a perched Gond bird sends it to another tree; Mexican butterflies are shy of a close pointer.

Inputs are recorded on the scene clock, so paused redraws remain pixel-identical.

## Ambience

`assets/art-ambience.js` adds slow mist veils, cloud shadows and water glints to the painterly live-art styles (Kangra, Japan, China, Mexico). Mushroom Island's `assets/mushroom-life.js` animates the painted kingdom (mist, lamps, townsfolk, flocks, light shafts) and gives Pip's run star seeds to collect, a fairy companion and butterflies that lift off as he passes.

## Road trip journey

`assets/road-journey.js` turns the drive into a trip between named places (original names). Each stretch heads for a town in the next landscape and the status line counts down to it ("Saltwind Bay in 1.2 km"). Arriving, as the new landscape takes over, shows a postcard: the town, how far you came from the last one and the weather on the way, stamped into a trip log kept on this device ("Stamp 6 of 20"). With a fixed place, towns come every stretch within it. It only reads the road's state.

## Soundscapes

`assets/world-sound.js` gives World art, Road trip and Zen garden sound, synthesized with WebAudio (no audio files). Road trip: an engine that follows the speed and pulls harder when overtaking, road and wind noise, rain, night crickets, waves on the coast, birds in the forest, a far horn in the city and a whoosh as an oncoming car passes. Zen garden: sand hissing under the steel ball (it follows the ball's speed), the bamboo fountain, a splash where you tap the pond, now and then a wind chime or a singing bowl, crickets and frogs by moonlight. World art: river and wind beds, birds and insects, and every so often a short phrase in a voice suited to the tradition (a breathy flute for the Indian styles, plucked strings for Japan and China, a guitar-like pluck for Mexico). Off by default: **♪** in the bar (or M); the choice is remembered and resumes on the first tap. Cozy Worlds, Mushroom Island and Pip Run keep their own sound, so the button hides there. `tests/world-sound.test.cjs` covers both modules.

## Pip Run

`pip-run.html` + `assets/pip-run.js` (~40 KB of source, 13 KB gzipped) is a real game rather than an animation:

- **Hero feel:** the painted Pip with classic platformer feel: squash and stretch, a braced skid pose, a forward lean at speed and distinct take-off/apex/landing poses.
- **Golden Sprout:** some star blocks release a sprout that slides and drops; catching it makes Pip bigger. Big Pip smashes bricks from below and takes one hit (shrinking, with a flicker) instead of tumbling. The planner values bumping star blocks and predicts a sprout's slide-and-drop, so the demo grows in most runs.
- **Biomes with their own rules (release 3):** regions of ~288 m run Mushroom Meadow, then Frost Ridge, Sky Isles and Glow Caves in a seeded order, with Meadow between cycles. Rules live in the shared physics, so the planner adapts without special cases: ice has low friction and acceleration (long skids), the sky has lighter gravity and gusting wind that drifts Pip, and caves are dark, lit only by Pip, crystals, seeds and star blocks (the thought lines glow above the dark). Each biome has its own terrain grammar (floating two-tile islands and spring pads in the sky; a jagged roof, guaranteed headroom and crystals in the caves) and its own tiles, parallax backdrop and weather. Gap tables are computed per biome from the take-off speed a short run-up can build, under a worst-case headwind. The next region's landmark (Mushroom Gate, Frost Spire, Sky Harbor, Crystal Heart) rises on the horizon and grows as Pip approaches, the HUD counts down to it, and a title card announces each region.
- **Director (viewers vs. the AI):** while the demo plays, pick a tool (brick, creature, spring; keys 1 2 3 or the round buttons) and place it just ahead of Pip; 3 charges recharge every 6 s. The planner referees each placement by imagining Pip's futures with it: if every future tumbles, or no surviving future gets past a spot that one could before (a trap), it is refused as "Too cruel". Accepted placements force a visible replan and score: a reroute earns 20–100, a tumble on a fair trap "Gotcha! +150", and Pip using your spring +40. Springs are part of the shared physics, so the AI can use them.

- **Sound (release 8):** `assets/pip-audio.js` synthesizes everything with WebAudio (no audio files). Effects follow game events: footsteps that know the ground (grass, ice, cloud, stone, wood, crystal), jumps, landings weighted by impact, seeds that climb a pentatonic scale as you chain them, bumps, springs, stomps, crumbling planks, pods, tumbles, discoveries and an arrival fanfare. Each biome has a quiet ambience bed with occasional details (birds, ice tinkles, wind chimes, cave drips; sky wind follows the gusts). An optional sparse score plays a pad and a slow melody in each biome's own key and voice, a little fuller when the planner is tense. Off by default: the **♪** button (or M) cycles off → sound → sound + music, the choice is remembered, and sound pauses with the host's Pause and when the tab is hidden. A ghost rebuild and the planner's imagining are silent. `tests/pip-audio.test.cjs` runs it against a stub AudioContext.
- **Journey (release 7):** each region is a chapter that ends at the next region's landmark (Frost Spire, Sky Harbor, Crystal Heart, Mushroom Gate), standing full size on a quiet plaza (creatures turn back at plaza edges, so the rule is part of the world). Pip slows to a walk across it, reaches the landmark and hops, the camera settles in, and a chapter card sums up the region: seeds, time, tumbles, new finds and, when racing a ghost, how far ahead or behind you were at that spot. The next region's title follows. The walk goes through the input log like any other input, so ghosts replay it exactly.
- **Set pieces, wonders and a calmer pace (releases 5–6):** top speed is about 22% lower (gap sizes re-derive from the jump), and the simulation clock runs at 46 ticks a second with the renderer interpolating between ticks, so the whole game moves ~40% slower than at first while staying smooth. Each biome now lasts ~288 m (about a minute), set pieces come roughly every 65 m, and the planner's thought lines are reduced to a faint chosen path and its closest alternatives. Pieces are dealt from a bag that remembers the last six, so the route does not repeat itself, and new set pieces unlock as you go: **drift ferries** across chasms too wide to jump, **lifts** up cliffs too tall to jump, **crumble bridges** whose planks fall half a second after you land on them (and grow back), **floating steps** over a pit, and **podspitters** that spit seed pods along the ground. Ferries and lifts are one-way platforms whose position is a pure function of time, so the planner foresees them (it waits for a ferry, rides it, and steps off when ground is within a hop) and ghosts replay them exactly. Most regions also hold one **wonder** in the sky (a sky whale, lantern rise, balloon drift, meteor shower or aurora), never the same twice in a row. The first time you meet each piece or wonder, a small card names it ("3 of 10 found"), remembered on this device.
- **Ghost links and the daily world (release 4):** the default world is the day's (UTC), the same for everyone. A run is stored as its seed, the simulation width and one 3-bit input per tick (run-length coded), plus the director's placements; the engine is deterministic (its sine is plain arithmetic, so browsers agree bit for bit), so that log rebuilds the run exactly. **Share run** copies a `#pip-run-<code>` link (about 1 KB for three minutes) that opens the same world with your run racing as a translucent ghost, with an ahead/behind readout and a flag where the ghost's run ended. Your best run of the day (once you have played yourself) is kept on this device and raced as "your best"; **Race again** (or R) restarts the same world. "New world" picks a random one.
- **Physics:** fixed 60 Hz with sub-pixel motion; acceleration, skids, variable jump height (hold to jump higher), coyote time and jump buffering.
- **World:** an endless seeded tile world from a chunk grammar (runs, gaps, steps, pipes, stone pyramids, block tiers). Gap widths come from simulating the jump arc, so every stretch is clearable; difficulty ramps with distance.
- **Creatures:** Mossbud walks and turns at walls; Shellback snail turns at ledges and retreats into a kickable shell that bowls others over; Puddlehop leaps toward Pip on a timer; Puffwing bobs through the air. Stomp them, or bump blocks from below to knock them off.
- **Demo player:** when idle it presses the same buttons a person would. Every few frames it simulates ~40 candidate plans for 1.6 s against the real physics and predicted creature motion (including hopper arcs), then continues each rollout with a default policy (run, and leap where ground ends or a wall/creature is ahead, waiting for headroom under block rows). Average-position scoring and plan commitment stop it from procrastinating. Any key or tap hands control to the player; 9 s idle hands it back.
- **Controls:** ← → / A D to run, Space / ↑ / W / Z to jump. On touch: a pad below the stage.
- **Visible mind:** in demo play, each replan's rollouts are drawn as arcs: white futures, red ones that end in a tumble (with a break), gold for the chosen path.
- **Planner-driven drama:** tension (the share of imagined futures that tumble within 40 frames) eases time down to ~0.55× and pushes the camera in; nothing is scripted.
- **Instant replays:** a 6 s ring of recorded frames; close calls (a lethal option within 12 frames was avoided) and stomp chains replay at half speed with letterbox bars, at most every 30 s.
- **Memory:** each tumble leaves a faint ghost mark. Rollouts near a mark keep a wider berth and avoid retracing it, a "!" shows when Pip approaches one, and a risk level rises after tumbles and relaxes with clean distance (≈2.4 tumbles per 3 min, down from ≈3.6).
- **Phones (portrait):** the stage sits right under the host bar with larger tiles (12–13 across), and a console below it holds a journey strip (chapter, a mini Pip on the track, the ghost, the next landmark and the metres to it), the director tools, Sound/Restart/Share and the hint. Once you play by touch it becomes a thumb pad: the left quarter runs left, the next quarter runs right, the right half jumps, so thumbs need not aim. Tall phones show the chapter so far (seeds, time, finds, your best today) in the spare space. Where the browser supports it, landings, stomps, springs and tumbles give a light vibration while you play. Landscape keeps the full-height stage.
- **Never stuck:** under a block row the demo leaps only under open sky, running off a lip and jumping in the coyote window when the row reaches the edge. After ~3 s without progress the planner grows impatient and commits to its best attempt instead of waiting forever (a late fall otherwise scores better than an early one). The generator leaves open sky after every block row, shrinks a gap after a short run-up, and brings the ground back into each biome's height range (so nothing is wedged under a cave roof). Two world rules guarantee progress: after three falls into the same gap a bridge grows across it, and after 30 s without progress a breeze carries Pip to the next safe ground. Both depend only on the world's state, so ghosts replay them.
- `tests/pip-run.test.cjs` checks the gap table, finite physics, steady demo progress on four worlds, the director's referee, and that a shared run (with a placement and a resize) replays frame for frame.

## Rendering notes

World tiles are 600 world units wide and cached per chunk. Tiles are blitted only up to the next tile's origin so translucent paint (hills, paper grain) never doubles along a seam. Bump the `?v=` query on a script tag when its file changes.
