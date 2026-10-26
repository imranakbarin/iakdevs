# Infinite World Scrolls

A standalone canvas experience at https://imranakbarin.github.io/iakdevs/.

## Modes

- **World art** — endless living paintings: Gond, Warli, Madhubani, Kangra, Japanese, Chinese and Mexican folk-art inspired. Live art uses each tradition's procedural chunk grammar; Artworks → Painting uses the authored panoramas in `assets/art-*-living.webp` (see `assets/living-art-notes.md`).
- **Road trip** — distance-based perspective road with weather, five environments, a touring car and at most one other vehicle. An animated drive, not a traffic simulator.
- **Zen garden** — raked-sand patterns over painted gardens.
- **Cozy Worlds** — calming illustrated scenes.

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

## Rendering notes

World tiles are 600 world units wide and cached per chunk. Tiles are blitted only up to the next tile's origin so translucent paint (hills, paper grain) never doubles along a seam. Bump the `?v=` query on a script tag when its file changes.
