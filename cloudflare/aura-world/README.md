# Native Aura World backend

Source and contracts are mapped in [the canonical architecture](../../docs/WORLD_RUNTIME_ARCHITECTURE.md#real-surroundings-furry-auras-and-cloudflare--build12-candidate-2026-11-05).

`npm ci`, `npm run types`, `npm run check`, `npm run deploy` use pinned Wrangler4.127.0. The account/Worker are explicit in wrangler.jsonc; deployment does not modify existing World web Workers or billing.

GET /health is public. All /v1 routes require a random43-character base64url capability in Authorization: Bearer; never put it in URLs. /v1/profile GET/PUT stores five monotonic completion counts. GET /v1/map?x=...&y=... reads the bounded real-world geometry for a projected cell. GET /v1/world?x=...&y=... upgrades to a neighborhood WebSocket and assigns its capability-derived identity server-side. Messages accept only bounded coarse presence and simulated activity abilities. Stored profiles contain no location/name/journal.

Map source: OpenStreetMap contributors, ODbL; visible attribution is mandatory. Cached extracts are served through Private.coffee's public Overpass API, whose published policy permits use in any project and asks advance contact for large scale. This initial service is bounded and cached; it does not establish large-scale production capacity. No paid subscription is created. Source/attribution: https://www.openstreetmap.org/copyright and https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances.

Remote validation should use fresh task-owned capabilities, preserve exact receipts and avoid altering real personal records. For the native app, only official TestFlight scenes on the physical iPad count as app acceptance.
