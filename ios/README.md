# Asympta World for iPhone

Native offline paper world. Build6 candidate adopts the approved five halftone companions with translucent stipple auras on near-white lightly textured paper. No scenery or decorative collage. Bottom Home/Explore/Friends navigation preserves profile, favorites, journal, Aura, languages and movement. Existing version1 saves and resident IDs are unchanged. Pan/pinch still work; Explore restores the initial five-character composition.

See the canonical [native architecture](../docs/WORLD_RUNTIME_ARCHITECTURE.md#native-iphone-app-independent-of-web-runtime) and [historical build4/5 release record](../docs/IOS_SKETCH_RELEASE.md). Build6 physical acceptance remains pending.

Generate with `xcodegen generate --spec ios/project.yml`, archive/sign AsymptaWorld for generic iOS, export using `ios/ExportOptions.plist`, then existing Internal TestFlight. Bundle `com.asympta.world`, ASC app `6828764417`, team `3P7YJW4D3Z`. iPhone-only portrait (compatibility presentation on iPad). No Simulator or sideloaded product acceptance; use exact TestFlight build on exclusively held physical iPad. No public App Review submission.
