# HANDOFF — Mushroom Island (October 26, 2026)

## v8.1 — Fix flashing during Pip's pose transitions (October 27, 2026)

- User reported visible flickering after the v8 animation polish.
- **Code-level root cause:** `spriteMix` evaluated anticipation *after* the character was airborne, briefly fading back to grounded running frames and snapping to airborne art. Multiple semi-transparent complete-body sprites were drawn simultaneously, causing doubled or translucent limbs.
- `assets/mushroom-cinematic.js` now draws a **single, full-opacity authored sprite per frame**. Preparatory pose stays coherent through takeoff; authored airborne frames continue until landing and recovery leads to the original 16-frame running cycle. Soft preparation, squash, shadow and landing dust remain. No new background art, physics or hurdles.
- `mushroom-island.html` loads `mushroom-cinematic.js?v=9` to bypass cached v8 JavaScript.
- Test: `node tests/mushroom-cinematic.test.cjs` validates exactly one sprite per render across all ten stunt types and explicitly asserts there is no reversion to grounded running artwork during takeoff. Existing responsive, pause/resume/visibility tests remain.
- Remaining: actual desktop/physical iPhone visual playback and performance check. Other art worlds and Claude's code remain untouched.

---

## v8 — Motion polish for approved Pip run (October 27, 2026)

**Direction:** Keep v7's approved cinematic Pip, 16 grounded run poses, six special poses, textured foreground and kingdom composition exactly as they are. Improve continuity around actions **without reintroducing the rejected physics or vector hurdles**.

- Branch: `feature/pip-motion-polish-v8-20261027` based on v7 merge `2322e3c841c53dd4e25cfcdaf560567afab3820f`.
- `assets/mushroom-cinematic.js`: added distance-based `animationAt` to ease a few centimeters before takeoff and gently settle on contact; special poses crossfade only at their transitions, while the 16-frame grounded run remains crisp and *never* ghost-blended. Shadow changes with jump altitude continuously instead of popping at a height cutoff. Landing adds tiny, sunlit ground-contact dust; slides smoothly unfold without false impact dust, and dashes preserve momentum.
- `mushroom-island.html`: bumped `mushroom-cinematic.js?v=8` to avoid stale browser caches.
- `tests/mushroom-cinematic.test.cjs`: checks continuous jump height/squash at both boundary coordinates, graded preparation and recovery, transition frame mixing, unchanged distinct run frames, lack of spurious dash/slide landing events, 4 responsive layouts, and balanced Canvas alpha states with no state leakage; existing security and pause/resume tests remain.
- No new controls, artwork, hurdles, external libraries, physics simulations, or modifications to `index.html` or Claude's other worlds.
- **QA caveat:** production code and simulated Canvas draw calls are tested, but actual full-speed live browser/physical phone playback was not verified in this session. Visual acceptance remains essential before describing this as final character animation. Do not discard the v7 running poses if a future physics revision fails visually.

---

## v7 — Pip's actual running cycle (October 26, 2026)

**User acceptance issue:** Pip was not running: the eight v5 frames were nearly identical and the complete sprite was rocked side to side, appearing to wave. v6's physics and mismatched hurdle graphics were rolled back as documented below.

- Feature branch: `feature/pip-articulated-run-v7-20261026`, based on the coherent v5 restoration `274c2f877ae77489ea5d2b8f387cfef535a94d38`.
- New `assets/pip-full-run-22.webp`: 5,368×305 RGBA WebP atlas, 22 frames of the **same cinematic Pip**. Sixteen grounded running frames feature independently repositioned opposite legs and arms (stride / passing / opposite contact), plus six dedicated takeoff / rise / tucked airborne / descend / contact / crouch poses. Built from cleanly masked regions of the **matching character image**, not new flat Canvas shapes.
- `assets/mushroom-cinematic.js`: uses `pipFrame()` to select frames by **distance traveled** (12 pixels/frame), so boots cycle consistently with world velocity; removes the side-to-side body rotation during running and suppresses full rigid-body rotations during stunts. Adds small vertical cadence bounce and corrected foot-to-ground alignment. Keeps old `assets/pip-cinematic-run.webp` as a load failure fallback.
- `mushroom-island.html` now requests `mushroom-cinematic.js?v=7` to invalidate cached scene code.
- `tests/mushroom-cinematic.test.cjs`: validates the new WebP asset is referenced, all 16 grounded frame indices, special jump/crouch poses, actual Canvas atlas image usage, varied source rectangles across a live simulated loop, four viewport sizes, image assets and secure pause/resume/visibility.
- Art and layout preserved: the v5 cinematic kingdom, textured rock/grass foreground, matching Pip appearance, waterfall effects, birds and ambient lighting. **No physics or mismatched vector hurdles reintroduced.** Other art/road/Cozy/Zen modules and `index.html` unchanged.
- **QA performed:** generated and visually inspected 22-frame sprite montage; source atlas inspected for pose changes/foot contact in Python/Pillow, JavaScript and mocked Canvas integration tests passed. **Actual Safari/Chromium live-site playback and physical iPhone FPS/landings are not yet verified**. The sprite pose changes are an illustrated cutout / image-part articulation—not a full rigged mesh; minor matte cleanup and truly bespoke hand-painted poses remain possible quality improvements.
- Subsequent priorities: visual inspect the full running animation in the live browser first. Only after it looks natural, design *cinematically matched* obstacles and physics separately, with full visual QA rather than unit tests alone.

---

## Corrective rollback after v6 visual review (October 26, 2026)

**Decision:** The user reported that the v6 rendered character, obstacle artwork, and animation were severely mismatched and unnatural. This is a **visual-quality failure**, despite v6's passing simulated physics tests.

- Live version is restored to the previously accepted **v5 matched-cinematic Pip, textured path and rendered bounce prop**, using the exact v5 code blobs from commit `3109070e8fb0790c4c6435059d6c36ae18d4f790`. No regeneration, restyling or change to other worlds.
- v6 `assets/mushroom-physics.js`, `assets/mushroom-hurdles.js` and `tests/mushroom-physics.test.cjs` are removed from the published tree; their source and tests are preserved in <https://github.com/imranakbarin/iakdevs/pull/66> and branch `feature/mushroom-physics-hurdles-20261026`.
- **Root cause:** v6 used a single largely rigid sprite for spinning/crouching, world-physics heights that did not map to believable full-body movement, vector obstacles visibly unlike the cinematic background, and rudimentary abrupt terrain gap masks. Numeric collision passes cannot establish natural motion.
- **Requirement for replacement:** Make an independently reviewed **8–12 pose coherent sprite sequence or properly joint-rigged character**, with distinct run contact/push-off/air/landing poses, synchronized feet to the terrain, and image-derived/rendered hurdles matching the kingdom's textures and light. Review recorded movement on an actual desktop and mobile browser before merging. Avoid shipping merely on mocked draw calls and code-based collision passes.
- Do not re-enable v6 by switching the script tags alone. Match foreground and animation first, then test physics against the authored animation and terrain. Coordinate with Claude's work via a separate branch and avoid changes to `index.html`.
- This rollback is not the finished new animation; it is a quality reset to the last visually preferred state.

---

## v6 — Physics-driven Pip and cinematic hurdles (October 26, 2026)

**Feature:** Automatic side-scrolling now uses **actual fixed-timestep gravity and collision logic**, not precomputed sine-wave stunt heights. This is still a watch-only, original mushroom-world character; do not introduce extra controls or official Nintendo characters/sprites.

- Branch: `feature/mushroom-physics-hurdles-20261026`, based on v5 master `3109070e8fb0790c4c6435059d6c36ae18d4f790`.
- New `assets/mushroom-physics.js`: isolated deterministic 120 Hz physical simulator, world-space obstacle authoring, vertical position/velocity, actual takeoff and touchdown, sprung mushroom collisions, variable gravity glide, ducking below low arches, brief dash acceleration, safe real ravine crossings, landing compression, anticipation, stunt rotation and event counters. Ten existing stunt chapters preserved: hop, dash, bounce, flip, slide, glide, vault, cartwheel, twirl, longjump.
- New `assets/mushroom-hurdles.js`: cohesive soft-lit obstacle renderer for fallen logs, stone obstacles, stepping stones, spring mushrooms, flowering low arches, wind gates, lantern flowers and ravine lips. Geometry comes from **the same physics module**, so visual placements are not independently guessed.
- `assets/mushroom-cinematic.js`: uses physics world position and snapshot for the existing rendered Pip sprite; clips actual holes in the cinematic foreground at long-jump ravines, paints matching hurdles, adds short physically triggered contact dust and retains the original city image, terrace texture, lighting, birds, water effects and existing fallback rendering.
- `mushroom-island.html`: load physics and hurdle modules before cinematic renderer; bump main script to `?v=6`. Parent same-origin pause/resume and simple selector in `index.html` unchanged.
- Tests: `node tests/mushroom-physics.test.cjs` runs 240 seconds at each of 30, 60 and 144 FPS; checks obstacle geometry, fixed-step deterministic travel, the 10 stunt families, spring contacts, zero falls, zero hurdle impacts and continued auto-run. `node tests/mushroom-cinematic.test.cjs` checks actual integration and rendering calls, assets, pause/resume, visibility and cross-origin guard. Both should pass on Node 18+.
- No changes to Claude's Gond, Road, art, Cozy or Zen source. No physics library, tracking, audio, buttons, external assets or user controls added.
- Before any future modification, review latest master and work only on scoped module files; do not overwrite shared `index.html`.
- **Remaining QA:** browser screenshots at stunt takeoff, spring contact, crouch under arch, ravine crossing and landing; actual iPhone frame-rate profiling and a longer autoplay watch-through. The test harness exercises drawing commands and dynamics but is not proof of real-device visuals or physical-device FPS.
- **Visual limitation:** Pip still uses a light-matched cinematic 2D frame sheet with transform-based stunt poses, not a fully joint-rigged character; separate authentic poses and transition sprites would improve foot articulation. The kingdom remains a large slowly moving painted cinematic plate behind interactive foreground scenery.

---

## v5 — Matched cinematic foreground and Pip (October 26, 2026)

**User finding:** the v4 kingdom's 3D cinematic architecture did not match its flat vector foreground, path, and runner. v5 deliberately replaces the three offending pieces with *rendered artwork from the same coherent scene*.

- **Branch:** `feature/mushroom-foreground-style-match-v5`, based on v4 production commit `0edd1374954827cd53916384fb002012eae131ef`; kept `index.html`, Claude's work, and all other world files untouched.
- **Pip:** `assets/pip-cinematic-run.webp` — original character matte taken from the agreed cinematic scene, 8 subtly limb-deformed run frames on a 1952×305 transparent WebP sprite sheet. Character proportions, soft film-like materials, warm sunlight and tiny shadows match the castle and path. The sprite rotates/scales for the original ten stunt types; it is *not* a full articulated 3D rig.
- **Foreground:** `assets/mushroom-terrace-cinematic.webp` — 760×211 alpha-textured grass, stone and earthen path extracted from the matching cinematic scene and leveled/tile-blended. Replaces v4's untextured gray polygon and bright flat green horizontal stripes. Foreground scrolls independently from the city, and Pip's boots and contact shadow share its ground line.
- **Bounce prop:** `assets/mushroom-bounce-cinematic.webp` — a rendered mushroom from the same lighting and color palette, in place of the flat procedural mushroom used for bounces/vaults.
- **Script:** `assets/mushroom-cinematic.js` loads three optional local assets and uses `cinematicTerrace`, `cinematicPip`, `cinematicSetPieces`. Previous Canvas shapes remain as load-error fallbacks. The original kingdom background, slow pan, water highlights, birds, particles, pause/resume and ten authored stunt sequences are unchanged.
- **Cache:** `mushroom-island.html` references `mushroom-cinematic.js?v=5` so deployed users receive the new script.
- **Validation:** `node tests/mushroom-cinematic.test.cjs` checks all four WebP assets, actual image drawing calls, 46 chapter instances, ten stunts, multiple portrait/landscape viewports and parent cross-origin pause/resume. Locally rendered and inspected actual Skia Canvas screenshots at 1440×900, 390×844 and 844×390, including grounded running and midair stunt poses. Chromium headless startup failed in this execution environment; physical iPhone and real-browser runtime/FPS checks remain outstanding.
- **Remaining quality limits:** the background remains a single gently moving cinematic art plate, and the hero's eight frames are a stylized 2D sprite sheet rather than full-body 3D animation. Build separately authored rigged sprite poses, higher-quality landscape tiles and multiple cinematic districts when pursuing greater fluidity and full-depth exploration. Avoid reverting to simple geometric vector layers.

---

## v4 — Cinematic Mushroom Island rebuild (October 26, 2026)

**Reason for rewrite:** The previous v1–v3 vector/Canvas scenery could not achieve the user's supplied richly rendered mushroom kingdom reference. A static generated picture alone was also not an app. This implementation combines an original authored *cinematic art plate* with a newly written live runner, motion and scene renderer.

- **Branch / PR:** `feature/mushroom-cinematic-rebuild-20261026`. Based on master commit `517026c15b8ee2cf4c86248dd25dd2809817dcbc`. Keep Claude's previous changes intact.
- **Visual asset:** `assets/mushroom-cinematic-kingdom.webp` — optimized 1172×659 WebP of a freshly generated original mushroom city image derived from the agreed cinematic visual direction, cropped to remove the stationary main character. Approx. 149 KB, versioned and self-hosted in this repository; no external image hotlinks. Under the user-visible live island this preserves authored detail (terraced castles, waterfalls, arches, glowing mushroom villages, floating islands).
- **New renderer:** `assets/mushroom-cinematic.js` — complete rewrite, no dependence on the old v1/v2/v3 render modules; slow pan on the cinematic image, restrained image-aligned waterfall glints, airborne birds and fairy lights, independent raised moss path, grounded shrubs/flowers/mushroom bounce props, illustrated original Pip, 10 continuous stunts and transitions.
- **App entry:** `mushroom-island.html` rewritten as a tiny responsive standalone page. Main `index.html` **untouched**; existing `#mushroom-island` route, parent play/pause postMessage, and loading remain compatible.
- **Tests:** `node tests/mushroom-cinematic.test.cjs`. Legacy entry `node tests/mushroom-island.test.cjs` delegates to it. Verifies embedded WebP signature and realistic asset size, all ten stunt chapters, grounded starts/landings, parent pause/resume, visibility policy, cross-origin message rejection, landscape/portrait redraws and repeated animation calls.
- **Visual QA:** Rendered locally using Skia Canvas at desktop 1440×900, phone portrait 390×844, and landscape 844×390, and inspected screenshots. This is **real Canvas pixel output but not Chromium / physical iPhone testing**. A container browser navigation policy blocked the independent Chromium preview. QA still needed in the published browser and on a physical phone.
- **Important limitation:** The cinematic kingdom art plate itself is not a 3D live environment. The image gently moves as one plane; birds, waterfall highlights, particles, foreground props, and Pip animate on separate layers. For full depth/panning between districts, author additional painted depth plates and matching transparent foreground assets. This rebuild prioritizes getting the **visual quality** right before adding more procedural complexity.
- **Collaboration:** Do not overwrite Claude's `index.html`, Gond, Road, Cozy or Zen edits. When continuing from here, read the current `master` before editing, and improve this separate `mushroom-cinematic.js` feature.

---

## Grand Mushroom Kingdom v3 — reference-driven panoramic world (October 26, 2026)

**Visual target:** user-supplied reference of a cinematic, highly dimensional mushroom archipelago, with a giant mushroom-topped city, floating rock islands, clustered village houses, bridges, waterfalls, glowing windows, foreground runner, clear blue skies and atmospheric depth. This is the art direction reference, **not** an asset copied into the app.

- Branch: `feature/mushroom-kingdom-grand-v3-20261026`, based on v2 merge commit `955eac78e0f2a10cd905e5f81d113aa8cb058c93`.
- Added `assets/mushroom-kingdom-v3.js`: procedural, parallax-scrolling epic kingdom with **physically supported** inhabited rock terraces, mushroom palace, smaller villages, connected bridges, flowing falls reaching the lagoon, floating distance islands, warm window glow, decorative foliage, moving atmospheric lights and layered cloud banks.
- Kept existing `assets/mushroom-island-v2.js` foreground running lane, Pip, and **all ten stunt sequences**. It now delegates its sky/city/background to `window.MushroomKingdom.paint()` and uses `waterVeil()` between the lagoon and foreground platforms. It falls back to the existing v2 sky/distant mushrooms if the optional module is absent.
- `mushroom-island.html` now loads v3 before v2. No modification to app selector `index.html` or Claude's Gond / other art / road code.
- Test: `node tests/mushroom-island.test.cjs`. Smoke tests exercised the v3 drawing routines at **269 sampled world poses across responsive sizes**, including negative chunk offsets, water overlay, scripted stunt transitions, fade-safe module load and pause/origin guard.
- **Quality note:** the referenced image has high-end rendered 3D texture, dense architectural modeling, indirect lighting and intricate illustration. This Canvas upgrade moves toward its **composition and depth** but cannot honestly be described as pixel-equivalent film quality. For that result the next step requires genuinely rendered layered art assets or a 3D-render-to-sprites production workflow—not just more primitive vector decoration.
- **Remaining QA:** Real Chromium/phone screenshots, timing/performance and visual inspection on a live device are outstanding; mock rendering checks are not visual QA. Look for tiny architecture at mobile scale, waterfalls at the lagoon, repetitive district silhouettes, foreground clearance, and performance while moving.

---

## Mushroom Island v2 — 2.5D storybook upgrade (October 26, 2026)

- Branch: `feature/mushroom-island-v2-diorama-20261026` (based on `748957877521ea42167e6e456b68f006f14e037f`, after Claude #60 and Mushroom #61).
- Goal: noticeably richer, dimensional, side-scrolling *storybook* world reminiscent of joyful platform-adventure art. The mascot, props and world are original and do not reuse commercial characters or assets.
- New `assets/mushroom-island-v2.js`: standalone procedural 2.5D visual renderer. Sculpted terrain with beveled turf, carved rock faces, shadowed mushroom stems, glossy highlights, soft sun and layered atmospheric perspective, rounded fantasy towers, distant toy pipes, floating story blocks, flower clusters, waterfalls and bridges. Pip now has dimensional shading, a leaf cap, articulated boots, satchel, fluttering scarf, glider and subtle dust/sparkles.
- `mushroom-island.html` loads the optional v2 script and calls its renderer within the *existing* deterministic auto-run choreography. Original v1 Canvas renderer remains as a fallback if the add-on cannot load.
- `tests/mushroom-island.test.cjs` now tests production module exposure, 98 full diorama stunt poses, scene script syntax, gradient/shape coordinates, 90 desktop frames, 30 portrait frames, 10 stunt types and pause/resume/origin guard. Reproduce with `node tests/mushroom-island.test.cjs`.
- No changes to `index.html`, live arts, Gond, Road Trip, Cozy or Zen; existing selector/deep link `#mushroom-island` preserved.
- **QA still required:** actual Chromium/iPhone-size *visual* captures and real-device frame profiling, collision observation, and aesthetics review. Mock drawing validates function calls, not appearance. Do not represent this as screenshot-tested.
- Merge/deploy status: see the v2 pull request and GitHub Pages workflow; do not assume deployed solely from passing unit tests.

---

## Working state

- Repository: `imranakbarin/iakdevs`
- Original feature branch: `feature/mushroom-island-autoplay-20261026` (merged)
- Base commit at branch creation: `24af548c7cedb35990cfdf6af7a9be813e8d2a99`. The feature was manually integrated on top of Claude PR #60 merged as `75b781ba65f9fc2a7ca0547032a8fe40c48f158c`, retaining Claude's rendering, creature and road fixes.
- Merged PR: https://github.com/imranakbarin/iakdevs/pull/61
- Merge commit on `master`: `d70125df0e61d2817c5f5fd21babd4007bc52f90`, after Claude PR #60.
- GitHub Pages deployment workflow for this merge: https://github.com/imranakbarin/iakdevs/actions/runs/40393884399
- Status: **merged into master** after Claude PR #60. Smoke checks pass. Check the linked Pages workflow for publication success; actual full visual and device QA remains pending. Continue protecting unrelated files and Claude improvements.
- Experience: standalone, original character "Pip" in a cheerful illustrated mushroom fantasy island; watch-only automatic runner. This is not an official Mario/Nintendo asset or game.

## Changed files

- `mushroom-island.html` — a complete independent zero-dependency Canvas animation: seeded parallax islands, land/lagoon/gaps, forest mushrooms, colored skies, star seeds, original character, coherent ground-contact, 10 types of timed stunts (leap, bounce, spin, slide, vault, glide, twirl, dash, wallkick, cartwheel), bounded time-step and pause/restart handling.
- `index.html` — adds `Mushroom Island` to the existing experience selector, isolated same-origin iframe lazy load, URL `#mushroom-island`, parent play/pause sync, resume/stop when changing modes, and minimal watch-only presentation. Road/Zen/Cozy/Gond engines remain separate.
- `tests/mushroom-island.test.cjs` — dependency-free repeatable rendering, choreography and integration smoke test.
- `HANDOFF.md` — this operational status and QA list.

## Entry points and integration

- Direct standalone preview on a branch build: `/iakdevs/mushroom-island.html`
- In the app: `/iakdevs/#mushroom-island`
- `index.html` lazy-creates `#mushroom-frame` by assigning `mushroom-island.html` as the iframe source.
- Parent sends `{type:'mushroom:motion', playing:boolean}` using same-origin `postMessage`.
- Frame validates `event.origin === location.origin`, pauses when hidden, and uses its own requestAnimationFrame only while running.
- If Claude changes `index.html` concurrently, manually transplant the scoped `mushroom` integration anchors. Do not replace his entire file.

## Checks performed

- To reproduce: `node tests/mushroom-island.test.cjs` from repository root (Node 18+).
- Standalone JavaScript and the parent inline script parse successfully.
- Mock Canvas rendering ran for 90 desktop frames and 30 portrait frames without exceptions.
- Sampled 30 world sections and 3 points per section (90 trajectory checks); stunt lift returns to zero at landing and spin/squash values remain finite. Bounce timing is aligned with a mushroom-cap contact; slide roof is raised to clear the crouch.
- Verified all 10 stunt types encountered, offscreen culling, pause/resume scheduling, and rejected cross-origin messages.
- No screenshots, real Chromium/mobile profiling, collision pixel review or real visual QA were possible in this connector-only execution. Do not claim them as passed.

## Remaining visual QA and future improvements

1. Preview the branch with desktop (wide) and portrait (phone) viewports, watch at least 2 complete stunt cycles, pause, resume, switch worlds and return.
2. Verify visual quality: hero silhouette, no ground/river floaters, chasm launch/landing, glide, wallkick, slide clearance, scenery seam continuity, no jitter, no clipped mushrooms, and no occluded controls.
3. Profile actual device FPS and verify reduced-motion behavior. Tune density if needed, keeping the scene a passive show with **no new controls**.
4. For subsequent changes, re-read latest `master` and coordinate with Claude before editing shared `index.html`. Do not overwrite his work.
5. Verify GitHub Pages workflow success and the published `#mushroom-island` route. The deployment is automatic from `master`.

## Constraints

- Keep existing Road Trip, World Art, Cozy Worlds and Zen Garden unchanged.
- Do not substitute official Nintendo sprites, sounds, logos, or level art. The island and character are original.
- No external assets, tracking, API calls, audio, data collection, ads or gameplay prompts were introduced.

## Claude follow-up (Presence) — shared `index.html` anchors touched

Scoped edits only; Mushroom Island integration untouched:
- Script tags: `creature-mind.js?v=2`, new `art-presence.js?v=1`, `art-depth.js?v=11`, `gond-benchmark.js?v=4`.
- `ArtPresence.install();` right after the `hashchange` listener (needs `cv`, so it must stay after the canvas setup).
- `drawScene`: live/painted camera target is multiplied by `(1-.7*ArtPresence.level(SceneMotion.time))`.
- `walkA`, the Warli grazing animal and Kangra strollers call `ArtPresence.creature(...)` instead of `CreatureMind.wander(...)`.
