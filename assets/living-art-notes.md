# Living collection production notes

These are original AI-generated digital interpretations, not reproductions of historic paintings. Built-in ImageGen was used for the five new backdrops. Original PNGs remain in `generated_images`; production copies are WebP at quality 88. All five new sources are 2172 × 724. China and Mexico reuse the existing detailed project assets.

| Tradition | Production asset |
| --- | --- |
| Gond | assets/art-gond-living.webp |
| Warli | assets/art-warli-living.webp |
| Madhubani | assets/art-madhubani-living.webp |
| Kangra | assets/art-kangra-living.webp |
| Japan | assets/art-japan-living.webp |
| China | assets/chinese-ink-panorama.webp |
| Mexico | assets/mexican-amate-panorama.webp |

## Generation specifications

Shared specification for the four Indian artworks: Use case: illustration-story. Website asset: exquisite high definition continuous panoramic living painting backdrop. Extremely wide 3:1 composition, 1920x640 or larger. Art fills the frame edge to edge. Carefully composed three distinct connected areas with no panel divisions, no text or lettering, no watermark, no UI. Important subjects fully inside the frame, calm thoughtful visual rhythm. Do not draw airborne particles as they will be animated separately. This must look like a sophisticated handmade work of art, absolutely not basic SVG geometric shapes. Preserve the tradition's flat or miniature perspective rather than artificial 3D.

Gond: Gond-inspired original contemporary folk painting of a vast interwoven tree of life, intricately patterned deer and peacocks, birds nested in branches, river fish below. Fine rhythmic dots, feathered dashes and nested scales fill expressive organic silhouettes. Ivory handmade paper, black contour, rich vermilion, emerald, ochre and indigo. Create a connected composition with branches linking left woodland animals through central tree to right river creatures, exquisite craft, not cartoon.

Warli: Warli-inspired original mural on warm earthen terracotta plaster, beautiful white handpainted linework. A village unfolds from left farmers and rice fields, center a large circular tarpa dance beneath a tree with intricate small figures and musicians, right women carrying water, huts and cattle. Rhythmic triangular human silhouettes, fine architectural details, open negative space and simple symbolic sun. Authentic handpainted irregular strokes, restrained cream on ochre and umber, not generic cartoon.

Madhubani: Madhubani-inspired original intricate folk painting, large paired fish, lotus pond, peacocks and connected branching trees. Confident double black outlines, fine crosshatching and elaborate nested patterned motifs, intricate floral perimeter, warm cream handmade paper with vermilion, mustard, deep indigo and emerald pigments. Left pond fish flows to center two majestic peacocks then right birds and tree, elegant densely ornamented but highly composed.

Kangra: Kangra miniature-inspired original peaceful painting, richly detailed royal garden terraces in a lush river valley, tiny elegantly robed people walking and tending flowers, graceful deer beneath flowering trees, distant blue mountains, left pavilion among cypress trees, center garden pond with lotus and delicate paths, right arched pavilion with figures. Finely brushed miniature details, exquisite foliage, muted mineral green, dusty pink, pale gold and lapis, creamy parchment, poetic calm, no photographic realism.

Japan: Use case: illustration-story. Asset: high definition panoramic backdrop for an animated Japanese woodblock-inspired living painting. Generate an exceptionally sophisticated handprinted ukiyo-e inspired landscape, extremely wide 3:1 composition 1920x640 or larger. A continuous unfolding scene: left a riverside village at blue dawn with wooden houses, footbridge and distant travelers; center dramatic irregular mountain silhouettes behind an expansive quiet river and old sculptural pine; right a red wooden bridge and cherry branches over the river with a tiny traditional boat. True woodblock carved contour line, restrained indigo, mineral turquoise, persimmon and muted cream, soft bokashi pigment gradients, fine washi fibre grain, imperfect pigment registration. Beautiful authored composition with asymmetric visual rhythm, intricate but restrained detail, atmospheric perspective, elegantly hand carved flowing waves. The river occupies much of the lower quarter so it can be animated in code. Do not draw falling petals, birds, rain or flying particles; those will be animated separately. Art fills edge to edge, no text, no panels, no white borders, no logos, no UI, not photorealistic, no plastic digital gradients, not geometric low-poly. Make this a rich peaceful original artwork that is striking at phone size.

## Rendering contract

The painted view uses a finite authored composition for each tradition. Journey explores that composition slowly in both directions. Contemplate stops the camera but preserves ambient actions. It does not generate new artwork while running. The separate Infinite generative scroll mode retains the original seeded scene generator and its actors.

Water motion is clipped to explicit water regions. Canopy patches are sampled and feathered once, then lightly sheared around an anchored base. Other details include falling petals, ink birds, patterned birds, butterflies, waterfall streaks, Warli dancers and lotus ripples. These are restrained stylized motions rather than a physics simulation of every painted subject.

Caches: seven decoded source images, at most three 384-pixel canopy patches per applicable tradition, one last-frame canvas and one temporary transition canvas. No postprocessing or external rendering library was added. Still camera + details off, paused playback, and hidden pages do not retain an animation-frame loop. Reduced-motion preferences initially select Contemplate with details off. Failed or pending backdrop loads fall back to the existing generator.

Native canvas QA covers seven styles at 1363 × 936, 390 × 844 and 844 × 390, opaque coverage, stationary-camera detail motion, journey movement, pixel-identical paused redraws, immediate paused style changes and integrated syntax. Native timings are not mobile-device benchmarks.
