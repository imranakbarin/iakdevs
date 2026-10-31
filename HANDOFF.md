# HANDOFF — Mushroom Island (October 26, 2026)

## Step 3 — Cinematic spring-mushroom contact and rebound (October 27, 2026)

**Approved progression:** Step 1 grounded run (PR #71), step 2 single fallen log (PR #72). Improve **one existing spring mushroom interaction only**, not an obstacle pack.

- Branch: `feature/mushroom-spring-contact-20261027` from `master` commit `29d6bf95fc110d190cf4160aaabb636deab8cec3`.
- `assets/mushroom-cinematic.js`: reuse the **existing original rendered cap** `mushroom-bounce-cinematic.webp` instead of introducing unmatched vector props or a new asset. `springGeometry(chapter)` calculates the exact mushroom image size, heel-to-cap elevation and center position using the same desktop/portrait/landscape scaling as Pip. The cap image compresses 15% vertically while widening ~7.5%, keeping its base grounded; it returns to its original dimensions after the impact.
- `springBounceAt(local,chapter)` replaces only the **bounce chapter's old single sine-wave arc** with an authored two-stage path: leap onto cap, descend/press it at local x=385, rebound upward, and land back on terrain at x=550. Boot height is constrained against the compressed cap surface throughout the actual shared x-overlap; no tunneling or passing through. `pipFrame` uses the previously authored rising/contact/push-off/tucked/landing frames without blending complete-body sprites (v8.1 flicker fix preserved).
- The log from step 2, 16-frame approved grounded run, other nine stunt families, background, terrain, ambience, pause/resume and same-origin messaging are unchanged.
- `mushroom-island.html`: JS version `?v=12` invalidates the previous cached scene.
- `tests/mushroom-cinematic.test.cjs`: verifies center/world coordinates, bottom-rooted cap sprite, actual 15% compression and rebound, exact boot-to-cap contact, absence of penetration across the overlap, two positive vertical arcs, no one-pixel height teleports, correct frame stages and complete prior smoke suite on 1170×650, 390×844, 844×390, 1440×900.
- **Honest limitation:** this is synchronized deterministic *authored animation*, not a fully rigged 3D character or general real-time collision physics. Tests simulate Canvas draw calls, but visual acceptance on actual Chrome/Safari/iPhone and real FPS are not verified. Watch spring contact for integrated materials and silhouette before any next hurdle.
- No edits to main `index.html` or Claude's other worlds. Preserve PR #71 and #72 as baseline if a visual regression is reported.

---

## Step 2 — One grounded cinematic fallen log (October 27, 2026)

**Scope:** The running cadence from PR #71 was accepted. Add only **one hurdle design**, a fallen mossy log in the authored hop chapter, and preserve everything else.

- Branch: `feature/mushroom-one-cinematic-log-20261027` from master `a7ca9e038e6a1f3fdb3ae5cd804b646cea8cae53`.
- New `assets/mossy-fallen-log.svg`: original self-hosted, transparent scenic log prop with warm directional bark highlights, textured wood rings, moss, soft contact shadow and grass details. Rendered as an image rather than adding a separate vector obstacle drawing system. It should visually belong to the cinematic terrain; actual iPhone/browser visual approval remains required.
- `assets/mushroom-cinematic.js`: `logGeometry(chapter)` shares log location, size and effective body clearance across canvas rendering and tests. `cinematicLog()` paints a log **only in existing hop chapters** at world coordinate `chapter*750+385`, behind Pip, rooted at `ground()+13`. No change to original hop arc, running poses or scrolling. First encounter after approximately 2.5 seconds of running; repeats every ten chapters (~48 seconds).
- `mushroom-island.html` bumps `mushroom-cinematic.js?v=11` to avoid cached script.
- `tests/mushroom-cinematic.test.cjs` checks loading of the SVG, its unique placement, no appearance in other stunt chapters, return in the next hop chapter, shared terrain coordinates, and silhouette clearance throughout the hop on desktop/portrait/landscape sizes. Existing frame/opacity, 16-frame gait, pause/visibility and all-stunt regression tests still pass.
- **Honest status:** this is a precisely synchronized *authored jump*, not a new real-time collision physics engine. The rejected v6 simulated physics and mismatched vector obstacles remain disabled. The SVG obstacle has not yet received physical iPhone/desktop browser visual sign-off. Review composition and light matching before adding another obstacle.
- No other worlds or main `index.html` edits. Retain PR #71 as the known-good run baseline. Next step waits on visual review of this single obstacle.

---

## v9 — Step 1: grounded running rhythm (October 27, 2026)

**Scope:** The user approved improving Mushroom Island **one change at a time**. This step adjusts only Pip's *ordinary running*, and intentionally does not introduce obstacles, physics, new backgrounds, or change the approved authored character sprite.

- Branch: `feature/pip-foot-contact-rhythm-v9-20261027` based on master `ac31f327829a734864911384a32e6ace2baa6b24` (v8.1 flicker fix).
- `assets/mushroom-cinematic.js`: the 16-frame authored running atlas now advances every 9 world pixels instead of 12, giving a more natural ~0.93-second alternating-stride loop at 155px/sec world speed. Introduced pure `gaitAt(world)` for deterministic frame and alternate-foot contact timing. The character's global vertical running bob was removed so the boots stay on the same grass/dirt baseline rather than bouncing the entire body. Decorative dust appears briefly at actual alternate footfall timing, not continuously.
- The one-full-opacity-sprite-per-frame flicker fix from v8.1 is preserved; 6 separate action poses are unchanged; original 16 run poses and all cinematic background/foreground assets are unchanged.
- `mushroom-island.html` requests `mushroom-cinematic.js?v=10` to bust the cached script.
- `tests/mushroom-cinematic.test.cjs`: runs existing artwork, ten-stunt and pause/visibility tests and now checks the exact 16-pose/144px cycle, left/right contact separation at 72px, empty midstride contact, wrap continuity, safe long-run index, and no whole-sprite vertical bob. Tested against the actual branch source using mock Canvas rendering.
- **Visual acceptance outstanding:** Real desktop/mobile watch-through including feet on terrain, pace, and visible contact dust. Do not claim this pass introduces authentic foot IK, rendered rigging, new physics, or that a mocked test proves the perceived quality. If the cadence feels too fast, revert only `RUN_STRIDE_PX` (9 -> 12), keeping the grounded baseline and frame fix.
- Next task only **after reviewing this step**: improve takeoff-to-landing pose quality or introduce a *single* art-matched hurdle, according to the user's feedback. Avoid bundling several changes.

---

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

## Claude follow-up (Mushroom life + ambience)

- New `assets/mushroom-life.js` (loaded before `mushroom-cinematic.js` in `mushroom-island.html`). `render()` in `mushroom-cinematic.js` now builds one `state` object and calls `MushroomLife.back/beforePip/front`; if the file is absent the hooks are no-ops. Cinematic bumped to `?v=10`; `tests/mushroom-cinematic.test.cjs` regex updated to match. New `tests/mushroom-life.test.cjs`.
  - Kingdom (plate-anchored): drifting cloud shadows, breathing light shafts, mist at waterfall bases, lamp glow on the main bridge, mushroom-cap townsfolk strolling the bridge walk, a flock every ~31s.
  - Route: star seeds trace each stunt arc and burst as Pip collects them; a fairy companion trails Pip's path; butterflies lift off as Pip approaches; drifting petals.
  - All derived from `clock`/`world`, so frames are reproducible.
- Observed, not changed (your file): the textured terrace shows a faint vertical seam where `texturedLedge` repeats (visible around x≈720 at 1363×936). Mirroring alternate tiles or cross-fading the overlap would hide it.
- World art: new `assets/art-ambience.js` (mist, cloud shadows, water glints for Kangra/Japan/China/Mexico), installed next to `ArtPresence.install()`.

## Claude follow-up (Pip Run)

New, self-contained mode: `pip-run.html` + `assets/pip-run.js` (+ `tests/pip-run.test.cjs`). Reuses `assets/pip-full-run-22.webp` and `assets/mushroom-cinematic-kingdom.webp` read-only. Shared `index.html` anchors touched, mirroring the Mushroom integration:
- CSS block `.pip-mode …` and `#pip-host` right after the Mushroom CSS; `<div id="pip-host">` with `#pip-frame` before `#c`; `<option value="pip">Pip Run</option>`.
- `requestedPip` (`#pip-run`), `pipFrame`/`pipMotion` (posts `{type:'pip:motion',playing}`), play button and "New world" handling, `pip` flag in `modeBtn.onchange`, and `'pip'` added beside `'mushroom'` in the `drawScene`/`frame` early returns and the init lines.
- Release 4 (ghost links): `let pipShared` next to `requestedPip` holds the code from `#pip-run-<code>`; the frame opens `pip-run.html#r=<code>`, `modeBtn.onchange` keeps `#pip-run-<code>` in the address bar, and "New world" clears it and loads `pip-run.html#new-<time>` (a random world; the frame reacts to `hashchange`). `#pip-frame` has `allow="fullscreen; clipboard-write; web-share"`. The frame's Share button writes `#pip-run-<code>` into the parent's address bar (same origin only). Daily best lives in `localStorage['pip-run:best']`.

## Claude follow-up (Road trip journey and soundscapes)

New modules `assets/road-journey.js` and `assets/world-sound.js` (+ `tests/world-sound.test.cjs`). Both only read the page's own globals (`modeBtn`, `playing`, `speed`, `drag`, `journey`, `tripCue`, `roadAtmosphere`, `roadPlaceTransition`, `RoadTraffic`, `zenDistance`, `zenGarden`, `zenRipples`, `#sty`). Shared `index.html` anchors touched:
- CSS: `#sound` added to the always-visible bar items (`.bar>:where(:not(#mode):not(#play):not(#settings):not(#sound))`) and to the `#play/#settings` button styles (desktop and the 600px media query).
- `<button id="sound">` right after `#play`; script tags for both modules after `art-ambience.js`.
- `modeBtn.onchange`: `#sound` is hidden for cozy, mushroom and pip (they have their own sound).
- `roadFrame`: `tripLabel` comes from `RoadJourney.update({...})` when the module is present (old label as the fallback).
- Init: `WorldSound.install()` after `ArtPresence.install()`.

## Claude follow-up (Zen garden raking and visitors)

`assets/zen-garden.js` (now `?v=12`) gains `zenRakeStart/Move/End`, `zenScare`, `zenVisitors`, `zenHint` (drawn at the end of `zenFrame`). Shared `index.html` anchors touched: the canvas `pointerdown` zen branch (scare the bird, else start a rake on the sand, else ripple), a zen branch at the top of `pointermove` (`zenRakeMove`), and `zenRakeEnd()` in `endDrag`/`cancelArtDrag`. `world-sound.js` is `?v=2`.

## Claude follow-up (World art wonders)

New `assets/art-wonders.js` (+ `tests/art-wonders.test.cjs`) wraps every `STYLES[key].anim` (like `ArtAmbience`) and appends a `#art-moment` line inside `#art-caption`. Shared `index.html` anchors touched: its script tag after `art-ambience.js`, `ArtWonders.install()` after `ArtAmbience.install()`, and the art-mode bar CSS now also shows `#sound` (`:not(#sound)` in the hide rule, `#sound:not([hidden])` in the display rule, `order:3` after `#play`, and the 600px font rule).

## Claude follow-up (Today home screen)

New `assets/home.js` (loaded after `art-wonders.js`, before the inline script, so it can read the first hash). It wraps `modeBtn.onchange` in `Home.install()` (called last, after `WorldSound.install()`): choosing the `home` option shows the overlay and puts the menu back on the current mode, so `modeBtn.value` is never left as `home`. Shared anchors touched: `<option value="home">⌂ Today</option>` first in `#mode` with `selected` moved to World art; the script tag; the install call; Cozy Worlds' own menu (`assets/cozy-worlds-calm.js`, now `?v=3`) lists `⌂ Today` first. The overlay pauses the scene through `playBtn.click()` and resumes it the same way.


## Claude follow-up (Cozy Worlds pacing)

Narrow edits to your files, found by profiling (frames were ~50 ms on desktop and phone):
- `assets/cozy-scene-motion.js` (`?v=2`): `steam()` set `ctx.filter='blur(1.4px)'` on the full scene canvas every frame. It now draws the three strokes blurred into a small `steamBuf` (96×144 at the current scale) and composites that with `screen`; `dispose()` frees it. Same look, 16.7 ms frames in all three scenes.
- `assets/cozy-worlds-calm.js` (`?v=4`): the resting `.dock.soft` stays at `.35` with a mouse, `.62` on touch screens (no hover to bring it back).
- Shared `index.html` anchor touched: only the two `?v=` numbers in `openCozy()`.

## Claude follow-up (World art captions and Madhubani pacing)

Shared `index.html`, narrow edits in the live-art section:
- Live style names now read like the gallery cards: `Kangra`, `Japanese woodblock`, `Chinese ink`, `Mexican amate` (were `Kangra miniature`, `Evolving Japanese woodblock landscape`, `Chinese evolving ink landscape`, `Mexican folk inspired`). The live medium line in `drawScene` is `<country> · Live art · Drag to explore`, the country read from `LivingArt.collection`.
- New `leafHatch(c,len,w,hx,hy,ang,sp,lw)` after `hatch()`: hatching inside `leafPath(len,w)` clipped by arithmetic (segments cached per shape) instead of `c.save();c.clip();hatch();c.restore()`. Used by the animated Madhubani figures only: `mbFan` feathers, the `mbPeacock` tail (its clipped `fillRect` half is now a half-leaf path fill) and wing, and the `mbBird` tail. The outline drawn after covers the line ends; same-frame renders differ on at most ~130 faint pixels. Headless desktop: missed frames 62–91% → ~30%, median 33 → 16.7 ms. The fish (`mbFish`, ~48 clips a frame) still clip.
- World art wonders collection: `assets/art-wonders.js` is `?v=2` (shared anchor: only that number). It keeps first sightings in `localStorage['art-wonders:seen']` (`{style: [kind…]}`), adds "· new in your wonders" to the `#art-moment` line once, and appends `<section id="art-wonders-book">` to the end of `#art-gallery` (rendered on each `#art-browse` click via `addEventListener`, so `living-art.js`'s own `onclick` is untouched).

## Claude follow-up (Zen garden seasons)

New `assets/zen-seasons.js` (+ `tests/zen-seasons.test.cjs`), loaded right after `zen-garden.js` (now `?v=13`). Shared `index.html` anchor: only that script tag and the version. Hooks in `zen-garden.js`: `zenFrame` calls `ZenSeasons.under(...)` before `zenBall` and `ZenSeasons.over(...)` before `zenHint` (both only with the atmosphere on); the garden's own petal loop in `zenAtmosphereLayer` is skipped when the module is present (the seasons replace it); `zenRakeMove` calls `ZenSeasons.sweep(p.x,p.y,36)`; `zenScare` also asks `ZenSeasons.scare(x,y)`.

## Claude follow-up (Road trip stops, horn, arrival; pacing)

- New `assets/road-stops.js` (+ `tests/road-stops.test.cjs`), loaded after `road-journey.js` (now `?v=2`); `world-sound.js` is `?v=3` (adds `WorldSound.cue('honk'|'chime')`). Shared `index.html` anchors in `roadFrame` (outer call): `RoadWeather.snap()` first; the `RoadTraffic.drive(...)` cruise is multiplied by `RoadStops.cruise(journey*42)` and gets a sixth `flow` argument while pulled over; `roadPlaceWeights` and `RoadJourney.update` get `delta*pace` (the place cycle and leg clock wait while parked); `RoadStops.frame(c,w,h,dominant)` before the `return`. `RoadStops.install()` sits next to `WorldSound.install()`. Stops visited: `localStorage['road-trip:stops']`.
- Narrow edits to your files: `road-traffic.js` (`?v=5`) `drive(...,flow=0)` keeps other traffic at `flow` while the player slows below it, and passes `hold` to `tick` so no overtake starts while pulled over (traffic speeds are relative to the player's, so a parked car froze everything and then overtook a parked lead car). `road-weather-light.js` (`?v=3`): `capture()` only records the atmosphere and the source; the new `snap()` copies the previous frame into the 256×128 reflection buffer before the next frame draws. Copying the frame being drawn forced a mid-frame flush: headless render time 24 → 5 ms, desktop draws 30 → ~45/s.
- Frame loop (`frame()`): small screens (<700 px) now draw at 60 fps while `SceneMotion.renderMs` stays under 10 ms (back to 30 above it, returning under 7), instead of always 30. Larger screens unchanged (30 above 18 ms).

## Claude follow-up (softer sound)

`world-sound.js` (`?v=4`) and `pip-audio.js` (`?v=7`, in `pip-run.html`) were reported as irritating. Both now route the master through a high shelf, lowpass and a generated convolution room; bells use whole-number partials and lower pitches; plucks are filtered triangles; birds, crickets, rain and the sand bed moved down and got quieter; default attacks are 10–12 ms. Narrow edit to your Cozy file: `cozy-worlds-calm.js` (`?v=5`) rain filter is highpass 240 / lowpass 2300 (was 380 / 4200). Shared `index.html` anchors: only those version numbers.

## Claude follow-up (World art living gallery)

New `assets/art-gallery.js` (+ `tests/art-gallery.test.cjs`), loaded after `art-wonders.js`, installed next to `ArtWonders.install()`. It wraps `LivingArt.draw` (draws your painting into an offscreen at the framed size, then wall/frame, light and a near particle layer) and appends `#art-gallery-opts` after `#art-presentation` in the Artworks dialog. Shared `index.html` anchor: `artPresentation` now defaults to `'painted'` unless the hash is a live style link (`#gond-…` etc.). Body class `gallery-framed` restyles `#art-caption` as a plaque while framed.

## Claude follow-up (richer live paintings)

New `assets/art-richer.js` (+ `tests/art-richer.test.cjs`), loaded after `art-gallery.js`; `ArtRicher.install()` runs first on the init line (before `ArtAmbience.install()`), after `GondBenchmark.install()`. It wraps `STYLES[key].chunk` for gond, warli, kangra, japan, china and mexico: your grammar runs first unchanged, then extra `add(layer, fn)` calls (layers -1/0/1 sky and far, 3 for Warli huts, 6/7 foreground) seeded from `hash(seed^0x51c3, x0)`. It clears `OC`, `tiles`, `jobs` and `farTiles` once at install. Madhubani is untouched.
- Kangra additions trimmed after review: the ridge trees (floated off the hills), hilltop palaces and front shrubs are gone; clouds are blurred once into an offscreen at tile build. `art-richer.js` is `?v=5`.
- Kangra's added distant blue range is gone too (it overlaid the far hills and cut their trees at the roots). `art-richer.js` is `?v=6`.
- Kangra far trees: `ArtDepth.treeSite` (art-depth.js `?v=12`) moves a tree off a steep slope (|dy/dx| > .25) to the gentlest spot within ±120, and KangraWorld's distant foliage (kangra-world.js `?v=4`) skips steep valley sides; on steep slopes they read as floating.
- Kangra grounding: new `ArtDepth.groundShadow(c,x,y,rx,ry,a)` (art-depth.js `?v=13`) puts a soft pool of shade under the painted tree (replacing its thin ellipse), under `pavilionSite` and under `KangraWorld.cypress`; `KangraWorld.ground` (kangra-world.js `?v=5`) adds a darker lip and grass blades along `gy`, so the meadow reads as a floor in front of the same-green hills.

## Claude follow-up (Toy Town)

New, self-contained mode like Pip Run: `toy-town.html` + `assets/toy-town.js` (+ `tests/toy-town.test.cjs`). It fetches `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD` from the browser (cached in `localStorage['toy-town:news:<date>']`). Shared `index.html` anchors touched, mirroring Pip: `.town-mode`/`#town-host` CSS after `.pip-mode`; `<div id="town-host">` with `#town-frame` before `#pip-host`; `<option value="town">Toy Town</option>`; `requestedTown` (`#toy-town`); `townFrame`/`townMotion` (posts `{type:'town:motion',playing}`) next to `pipFrame`; play and "New town" handling; `town` flag in `modeBtn.onchange` (body class, iframe src, LivingArt.mode, seed/sound hidden, h1, labels, hash); `'town'` added beside `'pip'` in the `drawScene`/`frame` early returns and the init lines. `home.js` is `?v=3` with a Toy Town card.

## Toy Town follow-up (31 October 2026)

- Daily seeds now use the visitor's local calendar date rather than UTC. The visual day/night cycle takes five real minutes; town movement still runs at 60% speed.
- A reusable Canvas 2D buffer caches ground, roads, and tree/building contact shadows. It is invalidated by new town layouts, news decorations, resizes and camera movements. `toy-town.html` loads `toy-town.js?v=8`.
- Tests assert that all news variants finish, and cover local midnight and the real-time day/night period.

## Toy Town character and scene quality (31 October 2026)

- People walk with distance-based alternating legs and arms, planted shoes, facing-dependent head/face detail and subtle idle breathing. Their shadows remain on the road rather than bobbing with their bodies.
- Cyclists pedal and wheels turn according to accumulated distance, so stopping for traffic lights freezes their motion; vehicles also use travel-based wheel highlights and soft contact shadows.
- Houses have chimneys, second-side windows, porch lights and threshold stones. Shop and tower parapets plus mullioned window frames increase depth. Small seeded grass tufts sit in the cached ground layer, not floating as separate sprites.
- The isolated `assets/toy-town.js` public API exposes `layout` and `render` for deterministic canvas smoke tests. `toy-town.html` now loads `toy-town.js?v=9`.
 
## Toy Town camera and neighborhood life (31 October 2026)

- Wheel zoom anchors the point beneath the cursor; touch uses two tracked pointers for pinch-to-zoom and two-finger panning. One finger still drags the town or taps for a gentle event. Zoom is clamped to 0.52–3.25×, and the subtle − / Fit / + buttons provide an accessible fallback. Controls work when animation is paused.
- Camera zoom eases toward button/wheel targets; pinch is direct. The static-ground cache naturally invalidates on camera scale/position changes. The page uses toy-town.js?v=10.
- Vehicle visuals rotate smoothly toward their movement direction via a rotated isometric prism. Pedestrians have seeded hats, scarves, backpacks and hair colors. Periodic quiet shop interactions pause a passerby for a brief greeting, sometimes acknowledged by another walker.
- Regression coverage should include zoom bounds, cursor anchoring, Fit reset, accessible controls, scene render tests and shop interactions.

## Toy Town iPhone zoom repair and close-up environment (31 October 2026)

- iOS now uses native non-passive TouchEvents directly on the city canvas for pinch and one-finger pan; touch PointerEvents are ignored to avoid duplicate/cancelled gestures. Taps still trigger town interactions, but ending a pinch cannot trigger an accidental tap. The canvas explicitly disables browser gesture handling without disabling page-wide accessibility zoom.
- The main `index.html` now owns a tiny always-visible − / Fit / + HUD outside the town iframe. Buttons send origin-checked messages to the child; this works even when Safari fails to deliver multi-touch to a nested canvas. The direct `toy-town.html` page retains its own HUD; the embedded page hides duplicates.
- The parent loads `toy-town.html?v=11&embed=1` and the child loads `assets/toy-town.js?v=11`, busting stale mobile caches. Fit now calculates a true whole-city scale; for a typical 390px phone the target is roughly 0.475×, instead of always resetting to 1×.
- Houses and shops gain facade-attached warm evening light, and shopfronts gain grounded entrance planters for richer closer views. Avoid floating decorations and keep the calm tone.
- Test harness covers origin-checked cross-frame controls, iOS touchstart/touchmove/touchend, pointer suppression, pinch/tap separation, mobile Fit, and all previous traffic/news themes; simulated viewports 320–1440 px are also checked. Live Safari visual QA remains to be performed.

## Toy Town hero neighborhood — Phase A (31 October 2026)

- Reserve central land block x=7..10, y=7..10 for a stable four-by-four handcrafted `hero` neighborhood, regardless of date/news theme. The other five nonriver blocks continue using seeded shuffling for the day's special block, fire station, park, houses and occasional construction; the river remains unchanged.
- `fillHero`: exactly three distinct `house` footprints, `BAKERY` and `BOOKS` storefronts, central plaza tiles and anchored furniture (`hero-bench`, `hero-table`, two `hero-lamp` fixtures, mailbox, rack, shrubs and tree). Ground draws stone path tiles, soft edge paving and a striped crossing at the southern road. `drawHeroFacade` adds roof courses/ridge, house shutters/window box and storefront signs. Only hero buildings receive extra geometry.
- `spawnHeroResidents` places three intentional neighborhood people after the original pedestrians. `updateHeroResident` cycles through shopfront, bench, plaza and riverside destinations; waiting/dwelling is clock-based while walks are distance-based. They stop, wave and sit; a marked crossing is entered only when approaching road traffic is clear, and approaching cars yield while occupied. Generic ambient street greetings exclude active hero residents so crossings cannot be interrupted.
- Main-page New Town action now preserves the mobile `?embed=1` mode, and `index.html` uses `toy-town.html?v=12&embed=1` while the child uses `assets/toy-town.js?v=12` to avoid stale iPhone scripts.
- Tests cover central neighborhood determinism across themes, the 5 building footprints, grounded props, 3 local routes, marked-crossing car yields, and maintaining existing 36 news variants and iPhone zoom behavior. Additional simulated smoke: 80 scene renders, 4 screen sizes, 10 themes, no missing actors or invalid coordinates. Actual iPhone and desktop *visual* QA is still needed; Canvas simulation is not screenshot verification.

## Toy Town diorama renderer replacement (31 October 2026)

- Previous screenshot references showed richly modelled, rounded miniature buildings; the old town was still simple Canvas boxes. New classic-script module `assets/toy-town-diorama.js` draws **all houses and shops** with consistent world-space 2.5D materials: real gable polygons, ridge/eaves, roof courses, framed glass, mullions/reflection, arched doors, chimney, canopy scallops, signs and flower planters. Trees are now organic multi-lobe shaded crowns rather than two solid circles. World engine dispatches only these draw types to the module, so events, vehicles, traffic and touch gestures remain in the established simulation.
- Hero buildings and the rest of residential town use taller proportions. Terrain moves from high-saturation neon greens to subdued garden tones, with deterministic ground flowers/moss. Startup zoom targets 1.52 on phones and 1.72 on larger screens, centered on the established hero block; Fit still shows the entire city.
- `drawBuilding` and `drawTree` cull offscreen work with generous vertical margins, important for the added materials on mobile. Module is loaded ahead of engine: `toy-town-diorama.js?v=1`, then `toy-town.js?v=13`. Main iframe receives `toy-town.html?v=13&embed=1`; New Town preserves embed/cache flags.
- Tests now explicitly load the module into isolated scene simulations, verify glazes and gable functions, renderer script order, high-complexity drawing operations at two zoom levels, and retained core gameplay. 269 assertions passed in the isolated test runner, plus responsive 10-theme canvas-context smoke checks.
- **QA limitation:** The tests exercise Canvas drawing commands using simulated contexts, not real browser rasterization. Direct iPhone Safari and desktop screenshots have **not** been visually reviewed. This is a materially closer hand-painted diorama style but cannot honestly be called an exact 3D/Pixar match without visual iteration and potentially a real 3D renderer.

## Toy Town true 3D WebGL scene (31 October 2026)

- New `assets/toy-town-3d.js` ES module, fed by the original `ToyTown` object. Uses pinned Three.js v0.187.0 plus its `RoundedBoxGeometry` addon through an HTML importmap. **No changes to simulation data, daily news, traffic, touch gesture handlers or the parent-page controls.** The new canvas overlays the old one using `pointer-events:none` so gestures still hit the original controller.
- Real 3D models: clay ground slab, raised roads/bridges, riverside, hero paved courtyard, polygonal gable roofs, glass/door meshes, awnings, signs, benches, lamps, planters, shaded trees, pedestrian rigs with leg and arm gait, cars/buses and bicycles. Some special-news landmarks have initial 3D models; story-specific effects in the original Canvas remain incomplete in WebGL mode.
- The same `ToyTown.buildings()/props()/movers()/debug()` are reflected into meshes; `seed` or building identity triggers world rebuild; moving actors add/remove dynamically. An orthographic camera follows the original eased zoom and panning values. Day/night tint and shadow lighting follow existing clock state.
- WebGL2 feature detection; pinned CDN library import is caught so failure keeps the established classic 2.5D page. The original `render()` only skips work while `window.ToyTown3D.active` is true. WebGL context loss/render failure restores Canvas. Explicit classic option: direct `toy-town.html?classic=1` (or append `&classic=1` when embedded). The main page iframe and engine URLs advance to v14.
- Added independent `tests/toy-town-3d.test.cjs` for the actual 3D module lifecycle with a minimal Three test double: verify delayed activation until first render, actor movement/removal, world rebuild after new seed, camera synchronization, and GPU-failure fallback. Existing `tests/toy-town.test.cjs` carries forward gameplay/zoom tests and checks new loader wiring.
- Caveat: the validation uses instrumented Three mocks, **not a real GPU-rendered screenshot**. A final iPhone Safari and desktop visual review is essential before promising visual parity with the earlier illustrative reference images. The Three dependency requires access to cdn.jsdelivr.net; failing that it gracefully uses 2D.

## Toy Town WebGL quality pass (31 October 2026, v15)

- `assets/toy-town-3d.js?v=2`: adds porch columns/canopies, storefront framing, layered branching foliage, fixed garden borders and flowers, animated river ripples and ducks synced to existing 2D simulation coordinates. Animals (dog, hen, penguin, llama, dino, ghost) are rendered as creatures, not human people. Seated legs bend and car/bike group heights align wheel contact to raised road surfaces. Actor contact pads reinforce grounding; tiny mesh shadows are disabled on mobile while building/tree shadows stay active.
- Render continues to use the original city and event simulation. No new UI; 2D fallback unchanged; direct `?classic=1` still works. Parent iframe version changed to `toy-town.html?v=15&embed=1` to avoid cached 3D module. Engine stays `assets/toy-town.js?v=14` because it wasn't modified.
- 3D lifecycle test expands coverage for animated environment, modeled animals, seated people, wheel contact, and responsive portrait/landscape dimensions. Test doubles cannot establish pixel-perfect visual output. Live Safari/Chrome screenshot comparison is still needed and was not performed in this environment.
