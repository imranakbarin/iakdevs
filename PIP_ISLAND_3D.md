# Pip's Mushroom Island — 3D pass

The real WebGL island is a separate renderer in `assets/mushroom-island-3d.mjs`. It models an island/cliff, castle, mushroom village, wooden bridge, waterfall, small woodland and flower beds, and a 3D Pip (teal leaf cap, purple coat, scarf, satchel, boots). Pip animates along a visible walking circuit. Orbit via drag, zoom via wheel or pinch, tap landmarks to learn more.

The original `mushroom-cinematic.js` and `mushroom-life.js` remain untouched; they are available through the single 2D toggle and automatically used if Three.js/WebGL cannot start. Parent `mushroom:motion` events, visibility and reduced-motion settings are handled. Portrait starts at island-wide zoom. Pip Run's independent platformer engine is untouched.

Tests: `node tests/mushroom-island-3d.test.cjs` and Playwright Chromium `node tests/mushroom-island-3d-visual.cjs`. Screenshots save as `visual-artifacts/pip-island-*.png`. Physical Safari/iPhone quality not independently verified. Preserve the clean original 2D fallback on future edits.
