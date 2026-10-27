# HANDOFF — Mushroom Island (October 26, 2026)

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
