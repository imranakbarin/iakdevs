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
