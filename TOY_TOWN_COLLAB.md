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
