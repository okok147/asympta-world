# Native iOS living-sketch update — 2026-11-03

Requested outcome: update the existing Asympta World iOS app to match https://asympta-world-sketch.vercel.app/ while retaining its iPhone-only portrait presentation and local personal data.

## Active progress checkpoint

The native source is on `codex/ios-testflight`, PR #39. Existing app `com.asympta.world` / ASC `6828764417` and Internal Testers are reused. Web product code is not part of this visual update.

- Build4 source `b81afbf7094774c29a51705cae53399e350c3242` is distributed and physically installed via TestFlight on Dev iPad. Apple `3527ac2e-bfb3-4d00-bc24-ba0732f39525` is VALID / IN_BETA_TESTING.
- Actual scenes cover pencil map/left-unfolding menu, native pan/pinch and zoom controls, resident/favorites/Meet, Aura, three languages, movement preference and background/cold reopen. Private personal state before/after is byte-identical; no state values or raw private records are committed here.
- A visible gap remains: target-OS `.done` Close uses a saturated system-blue pill. Full style completion was withheld despite functional success.
- Build5 source `eb4410ec70d99071e9b7d1b8d3efdf911987c9df` replaces the shared Close with a custom native graphite circle, sets window ink tint and uses a plain journal Save. The map, gesture implementation, assets and persistence layer are unchanged. This source is pushed; compilation succeeded and distribution is underway. Same-build affected-panel/editor/dismissal/data verification is pending.

## Packaging lesson retained

The first build4 export inherited XcodeGen's universal target family despite project-level iPhone-only settings. It was rejected locally before upload. Explicit target-level `TARGETED_DEVICE_FAMILY: 1` corrected the exported IPA; actual build4 phone compatibility was verified. Do not infer target family from project-level intent.

## Remaining delivery

Finish the existing build5 distribution, install the exact official TestFlight build on an exclusively owned Dev iPad, inspect corrected panels and native close/editor flow, compare preserved personal data and release device ownership. Reuse unchanged build4 evidence without extra regression rounds. Then integrate native source into current main and update this record. Public App Review is outside this request; user artistic approval, every device/accessibility size and long-duration stability are not claimed.

This checkpoint preserves unfinished work honestly. It is not a completion claim.
