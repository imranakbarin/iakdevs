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

## Pip Run

`pip-run.html` + `assets/pip-run.js` (~40 KB of source, 13 KB gzipped) is a real game rather than an animation:

- **Hero feel:** the painted Pip with classic platformer feel: squash and stretch, a braced skid pose, a forward lean at speed and distinct take-off/apex/landing poses.
- **Golden Sprout:** some star blocks release a sprout that slides and drops; catching it makes Pip bigger. Big Pip smashes bricks from below and takes one hit (shrinking, with a flicker) instead of tumbling. The planner values bumping star blocks and predicts a sprout's slide-and-drop, so the demo grows in most runs.
- **Director (viewers vs. the AI):** while the demo plays, pick a tool (brick, creature, spring; keys 1 2 3 or the round buttons) and place it just ahead of Pip; 3 charges recharge every 6 s. The planner referees each placement by imagining Pip's futures with it: if every future tumbles, or no surviving future gets past a spot that one could before (a trap), it is refused as "Too cruel". Accepted placements force a visible replan and score: a reroute earns 20–100, a tumble on a fair trap "Gotcha! +150", and Pip using your spring +40. Springs are part of the shared physics, so the AI can use them.

- **Physics:** fixed 60 Hz with sub-pixel motion; acceleration, skids, variable jump height (hold to jump higher), coyote time and jump buffering.
- **World:** an endless seeded tile world from a chunk grammar (runs, gaps, steps, pipes, stone pyramids, block tiers). Gap widths come from simulating the jump arc, so every stretch is clearable; difficulty ramps with distance.
- **Creatures:** Mossbud walks and turns at walls; Shellback snail turns at ledges and retreats into a kickable shell that bowls others over; Puddlehop leaps toward Pip on a timer; Puffwing bobs through the air. Stomp them, or bump blocks from below to knock them off.
- **Demo player:** when idle it presses the same buttons a person would. Every few frames it simulates ~40 candidate plans for 1.6 s against the real physics and predicted creature motion (including hopper arcs), then continues each rollout with a default policy (run, and leap where ground ends or a wall/creature is ahead, waiting for headroom under block rows). Average-position scoring and plan commitment stop it from procrastinating. Any key or tap hands control to the player; 9 s idle hands it back.
- **Controls:** ← → / A D to run, Space / ↑ / W / Z to jump. On touch: a pad below the stage.
- **Visible mind:** in demo play, each replan's rollouts are drawn as arcs: white futures, red ones that end in a tumble (with a break), gold for the chosen path.
- **Planner-driven drama:** tension (the share of imagined futures that tumble within 40 frames) eases time down to ~0.55× and pushes the camera in; nothing is scripted.
- **Instant replays:** a 6 s ring of recorded frames; close calls (a lethal option within 12 frames was avoided) and stomp chains replay at half speed with letterbox bars, at most every 30 s.
- **Memory:** each tumble leaves a faint ghost mark. Rollouts near a mark keep a wider berth and avoid retracing it, a "!" shows when Pip approaches one, and a risk level rises after tumbles and relaxes with clean distance (≈2.4 tumbles per 3 min, down from ≈3.6).
- `tests/pip-run.test.cjs` checks the gap table, finite physics and steady demo progress on four worlds.

## Rendering notes

World tiles are 600 world units wide and cached per chunk. Tiles are blitted only up to the next tile's origin so translucent paint (hills, paper grain) never doubles along a seam. Bump the `?v=` query on a script tag when its file changes.
