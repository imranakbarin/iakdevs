# iadevTools · Indian Scrolls

An endless, interactive landscape inspired by Gond, Warli, Madhubani, and Kangra painting traditions. Built from the supplied Indian Scrolls artwork with a responsive interface, bounded canvas caches, and original synthesized accompaniment.

## Run locally

No package installation or build is required. From the repository root:

```sh
python3 -m http.server 4174 --bind 0.0.0.0
```

Open the served root in your browser. The app also supports project subpaths because all asset URLs are relative. `index.html` and `assets/` are the complete application; `.nojekyll` supports direct GitHub Pages hosting.

## Explore

- Choose an art style, pause/play, and adjust scroll speed.
- Drag, scroll, or focus the canvas and use the arrow keys. Shift + arrow moves farther.
- Space pauses the landscape; H hides or restores controls.
- New landscape generates a seed; the URL preserves its style and seed.
- Save the current canvas as a PNG. About includes a copy-link control and cultural context.
- Sound is off by default. Enable it to hear an original, Indian-inspired synthesized drone, flute-like melody, and soft percussion. Adjust its volume in About.

The music is generated locally with the Web Audio API. No third-party recording, API key, audio download, analytics, remote fonts, or runtime library is used. These are generative interpretations, not reproductions or claims of authentic traditional performance.

## Rendering and accessibility

Static scenery is incrementally generated into cached canvas tiles. Tiles and object caches are bounded around the camera. Paused scenes stop requesting animation frames after pending tiles finish. Hidden tabs suspend rendering and audio. Desktop animation is capped at 60fps; compact screens at 30fps. Canvas resolution has a pixel budget on high-density displays.

Reduced motion starts the scene paused and freezes decorative motion. Controls remain keyboard accessible, use explicit accessible names, and support native focus treatment. Dark mode follows the system. The About dialog includes descriptions of the visual traditions.

## Hosting

GitHub Pages can publish directly from `master` at `/ (root)`. The repository contains `.nojekyll`; no build workflow or secrets are necessary. Changes pushed to the publishing branch trigger GitHub Pages deployment.

## Validation

JavaScript syntax checks:

```sh
node --check assets/landscape.js
node --check assets/audio.js
```

Functional browser checks performed during implementation: all four art styles, deterministic seed links, new landscapes, keyboard/drag/wheel navigation, bounded caches, true pause/idle, hide/show, PNG download, synthesized audio signal, mute/suspend, volume, About dialog, reduced motion, dark mode, and responsive layouts from 320px to 1920px. Verification used Playwright with Chromium; real iOS/Safari and physical audio-device listening were not tested.
