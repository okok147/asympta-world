# Native iOS living-sketch update — 2026-11-03

The existing Asympta World iOS app now uses the visual language of https://asympta-world-sketch.vercel.app/: warm paper, pale graphite routes, tiny original doodle companions and a floating paper menu that unfolds to the left. It retains iPhone-only portrait presentation and the existing local personal data format.

## Delivered version

- Version1.0(5), product source `eb4410ec70d99071e9b7d1b8d3efdf911987c9df`.
- Existing bundle `com.asympta.world`, ASC app `6828764417`, Internal Testers group `03c11663-f390-47ae-8c72-797473d1cfd8`.
- Apple build `3d45f4a2-fdd7-40f8-b38b-24d4e20ec634`: VALID / IN_BETA_TESTING; en-US and zh-Hant test notes read back.
- Signed IPA SHA256 `7de6dbddca1645c2b0ddb35ea4a4f1c8ce983a0a344acfb64e05950f31340877`; exported family[1], portrait-only;24 art resources match frozen source.
- Official TestFlight Update/Open/two actual notices completed on Dev iPad; CoreDevice independently confirmed1.0(5). Actual phone compatibility window375×667.

## Physical evidence and scope

Build4 (`b81afbf7094774c29a51705cae53399e350c3242`, Apple `3527ac2e-bfb3-4d00-bc24-ba0732f39525`) established actual map/menu appearance, pan/pinch and zoom/recenter/overview, resident favorite/restore, Meet visit, Aura alternative/restore, all3language switch/restore, movement preference and background/cold reopen. A saturated system-blue Close pill remained a visible mismatch and was retained as a failure, rather than accepted from functional success.

Build5 changes only shared bar-control appearance/window tint/version. Unchanged canvas, menu, storage and art evidence from4 is reused. On the actual build5, Meet/Aura/Me/resident circular graphite Close controls were visibly inspected and dismissed to a usable map/menu. The empty journal editor showed a neutral disabled Save and returned through Back without writing. Native language menu remained neutral and retained selection; background return and one cold reopen were normal. Root independently viewed the raw corrected Meet/Aura/editor images.

Private state before/after each update/interaction batch was byte-identical. Nickname, favorites, Aura, language, movement and journal fields were preserved; no private state contents are committed. Dev ownership was released and independently observed idle with no owner/operation at04:21:03UTC. Other device owners were preserved.

Local evidence is retained under this task's `outputs/build4`, `outputs/build5` and versioned private work folders, with source/IPA/Apple/installed-build identities in each handoff. The final screenshot and redacted physical-result JSON are user deliverables. There is no remaining observed gap against this requested style update.

## Retained packaging correction

The first build4 export inherited XcodeGen's universal target family despite project-level iPhone-only settings. It was stopped before upload. Explicit target-level `TARGETED_DEVICE_FAMILY: 1` corrected the exported IPA; physical phone compatibility was verified. Build4's blue prominent Close was separately corrected by `WorldTheme.closeItem`, an ink window tint and plain journal Save. See the canonical [native architecture map](WORLD_RUNTIME_ARCHITECTURE.md#native-iphone-app-independent-of-web-runtime).

## Limits

Public App Store submission/release was not performed. Human artistic approval, every device/accessibility size, journal writing/deletion and long-duration stability are not claimed. Packaging and launch alone were not used as functional acceptance. Later documentation/main integration does not alter the frozen delivered iOS product files.
