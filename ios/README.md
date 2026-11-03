# Asympta World for iPhone

A native, offline pencil-sketch world matching the user-designated [living sketch reference](https://asympta-world-sketch.vercel.app/). UIKit draws pale graphite paths over warm paper, with small hand-drawn companions, a floating menu unfolding to the left and coordinated paper panels. iPhone-only portrait; iPad uses the system's phone compatibility presentation.

## Experience and preserved state

- Drag, pinch, zoom, recenter, see the whole world and meet five companions.
- The lower-right menu unfolds World, Meet, Aura and Me vertically, with map actions underneath.
- Favorites, Aura, nickname, dated local notes, three languages and reduced motion remain supported.
- The existing version1 personal-world file and resident identifiers are unchanged. No account, network, location or messaging service is added.

## Artwork and architecture

`Art/Sketch` contains the exact reference route knots, original SVG creature paths, their rasterized copies and reference paper grain. `provenance.json` records the retrieval/hash and stable resident mapping. Original watercolor assets are preserved as history; the native entry point now loads Sketch resources. The shared [architecture map](../docs/WORLD_RUNTIME_ARCHITECTURE.md#native-iphone-app-independent-of-web-runtime) describes ownership, camera/rendering and persistence boundaries.

## Distribution

Generate with `xcodegen generate --spec ios/project.yml`, archive/sign `AsymptaWorld` for generic iOS, export with `ios/ExportOptions.plist`, then distribute the exact frozen commit to existing Internal TestFlight. Compile/sign/package are distribution steps; functional and visual acceptance use the same official installed build on a connected physical iPad. Do not substitute Simulator or a sideloaded product.

Existing ASC app `6828764417` · bundle `com.asympta.world` · team `3P7YJW4D3Z` · candidate **1.0 (5)**. Fresh provider state is checked before publishing. Build4 functional and data-preservation evidence is recorded; build5 corrects the actual system-blue panel Close treatment, with affected-panel physical verification pending. Public App Review is outside this request.
