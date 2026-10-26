# Infinite World Scrolls

A standalone canvas experience at https://imranakbarin.github.io/iakdevs/.

## Modes

- **World art** — endless living paintings: Gond, Warli, Madhubani, Kangra, Japanese, Chinese and Mexican folk-art inspired. Live art uses each tradition's procedural chunk grammar; Artworks → Painting uses the authored panoramas in `assets/art-*-living.webp` (see `assets/living-art-notes.md`).
- **Road trip** — distance-based perspective road with weather, five environments, a touring car and at most one other vehicle. An animated drive, not a traffic simulator.
- **Zen garden** — raked-sand patterns over painted gardens.
- **Cozy Worlds** — calming illustrated scenes.

## Deep links

`#<style>-<seed>` opens a style at a seed, e.g. `#gond-12345`, `#warli-7`. Prefix `painting-` for the painted panorama (`#painting-kangra-3`). `#zen-…`, `#road-…` and `#cozy-…` open the other modes. Seeds vary the starting layout; they do not regenerate painted panoramas.

## Gond benchmark

`assets/gond-benchmark.js` replaces the Gond chunk grammar with a composition-first layout: one hero tree per chapter, an optional support tree whose placement is planned from a separate seeded stream so neighbouring chunks never collide, one animal story, rooted bank plants and patterned distant rises that run down behind the bank.

## Rendering notes

World tiles are 600 world units wide and cached per chunk. Tiles are blitted only up to the next tile's origin so translucent paint (hills, paper grain) never doubles along a seam. Bump the `?v=` query on a script tag when its file changes.
