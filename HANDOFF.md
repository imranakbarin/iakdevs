# HANDOFF — Mushroom Island (October 26, 2026)

## Working state

- Repository: `imranakbarin/iakdevs`
- Branch: `feature/mushroom-island-autoplay-20261026`
- Base commit at branch creation: `24af548c7cedb35990cfdf6af7a9be813e8d2a99`. The feature was manually integrated on top of Claude PR #60 merged as `75b781ba65f9fc2a7ca0547032a8fe40c48f158c`, retaining Claude's rendering, creature and road fixes.
- Draft PR: https://github.com/imranakbarin/iakdevs/pull/61
- Status: integrated on the feature branch above Claude PR #60; smoke checks pass. Deployment/merge status must be checked against PR #61. Coordinate merge with Claude's separate in-flight changes; do not overwrite unrelated files.
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

## Remaining before merge / deployment

1. Preview the branch with desktop (wide) and portrait (phone) viewports, watch at least 2 complete stunt cycles, pause, resume, switch worlds and return.
2. Verify visual quality: hero silhouette, no ground/river floaters, chasm launch/landing, glide, wallkick, slide clearance, scenery seam continuity, no jitter, no clipped mushrooms, and no occluded controls.
3. Profile actual device FPS and verify reduced-motion behavior. Tune density if needed, keeping the scene a passive show with **no new controls**.
4. Review draft PR #61 and re-read latest `master` and Claude's changes. Rebase/cherry-pick only this feature; protect everything else.
5. Merge/deploy only after these checks; confirm GitHub Pages run and published `#mushroom-island` route.

## Constraints

- Keep existing Road Trip, World Art, Cozy Worlds and Zen Garden unchanged.
- Do not substitute official Nintendo sprites, sounds, logos, or level art. The island and character are original.
- No external assets, tracking, API calls, audio, data collection, ads or gameplay prompts were introduced.
