# Asympta World for iPhone and iPad

The native app runs the repository's actual React world from bundled resources. It does not download a remote app document at launch. The existing deterministic simulation, global English / Traditional Chinese / Japanese control and approval boundaries remain the product source of truth.

## Build

Use Node.js 22.13+, the current Xcode SDK and XcodeGen. This initial release uses Xcode 27.1.

1. Install the locked JavaScript dependencies with `npm ci`.
2. Complete the repository's required checks and freeze the source commit.
3. Run `npm run export:mobile` to create `AsymptaWorld/Web` with its source and asset manifest.
4. Run `xcodegen generate --spec ios/project.yml`.
5. Archive the `AsymptaWorld` scheme for a generic iOS device and export using `ios/ExportOptions.plist` with the existing Apple signing account.

The generated web directory and build products are ignored. Rebuild from the exact release commit. Do not replace an in-flight archive with different source.

## Native boundary

- `asympta://localhost/asympta-world/` serves only packaged files, with canonical path confinement and content types.
- WebKit's normal persistent website data store preserves local preferences. The web app controls explicit task and draft persistence.
- The main-frame bridge accepts only `locale`, `share`, `export` and `connect`. Share and JSON export use the native share sheet. Remote frames cannot call it.
- `connect` opens only the existing fixed GitHub Pages product in a system Safari view. Production public-agent origin and verification checks are preserved. The local app does not impersonate that origin or embed credentials.
- iOS controls background suspension. Returning uses the existing foreground catch-up behavior; the app does not claim continuous background computation.
- The icon is rendered from the repository's original cat favicon. No tracking, advertising SDK or model API credential is added.

App Store Connect app: `6828764417` · bundle: `com.asympta.world` · version: `1.0` · initial build: `1`.

TestFlight processing, group availability, installation and full physical-device scenes require separate evidence. Compilation alone establishes none of those outcomes. Any eventual public App Review is submitted by the user.
