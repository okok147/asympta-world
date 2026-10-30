# Asympta World for iPhone and iPad

A native, quiet watercolor world based on the user's original **Whimsical Asympta World Map.png**. UIKit renders independent terrain, original character cutouts and paper controls. The app runs fully from bundled resources.

## Experience

- Pan, pinch, return to the whole map, and meet five small groups of residents.
- The lower-right paper menu unfolds to the left: World, Meet, Aura and Me.
- Keep favorite residents, choose an Aura, and save a nickname and dated journal locally.
- English, Traditional Chinese and Japanese; native accessibility, Dynamic Type and reduced motion.
- Local personal data persists across app launches. No account or network service is required.

## Artwork

The immutable reference is a 941 × 1672 PNG, SHA-256 `944096477b24070b5fb215371a23d0ba50a80b34e64769b947dc259c48ae49e3`. Character imagery is extracted from that original, with exterior alpha masks rather than redrawn faces. `Art/manifest.json` records original-canvas placement and extraction provenance. `terrain.png` is a derived background with baked controls and characters removed; its separate provenance explicitly distinguishes it from the original. The original website is not the native app entry point.

## Build and distribution

1. Finish the native source and asset batch, then complete the required repository checks.
2. Run `xcodegen generate --spec ios/project.yml`.
3. Run `node ios/validate-artwork.mjs`, then freeze the source commit and archive the `AsymptaWorld` scheme for a generic iOS device.
4. Export with `ios/ExportOptions.plist` using the existing signing account.
5. Upload one distinct build to the existing Internal TestFlight app.

XcodeGen and current Xcode are required; JavaScript export is not required for the native target. Generated projects/builds and local signing products remain ignored. Rebuild from the exact release commit.

Existing App Store Connect app: `6828764417` · bundle: `com.asympta.world` · team: `3P7YJW4D3Z` · version: `1.0`. Build 1 belonged to a superseded product candidate; the corrected native candidate starts at build 2, subject to a fresh Apple build-number check.

Processing, tester availability, official TestFlight installation and same-build physical interactions are separately verified. PR #39 can merge only after physical acceptance. Public App Review is outside this delivery.
