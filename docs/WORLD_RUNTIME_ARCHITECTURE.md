# Asympta World Runtime Architecture

## Product invariant

Asympta World is a world for agents, not a chatroom for agents. Agents may propose intents, but only the canonical world runtime is allowed to decide whether an intent is valid and mutate authoritative world state.

The product path is:

```text
observation -> agent/task -> intent -> validation -> execution -> state mutation
            -> scheduled event -> consequence -> new observation -> UI/WebMCP
```

Dialogue is a presentation of information transfer. It is never the source of world truth.

## Integration strategy

The existing Atlas movement/workflow engine remains the renderer-facing task and movement layer. `lib/atlas-canonical-world.ts` wraps that proven surface and adds the persistent runtime in `lib/agentic-world-runtime.ts`.

Application imports of `@/lib/atlas-simulation` resolve to the canonical wrapper through `tsconfig.json`. The legacy file remains available to the wrapper and existing engine tests. This avoids a risky full rewrite while making the production UI and WebMCP entry points consume the canonical world path.

`@/lib/atlas-demo` similarly resolves to `lib/atlas-canonical-demo.ts`, preserving visible travel behavior while routing approvals through the runtime before the visual task may continue.

## Canonical state

`AgenticWorldRuntimeState` is serializable and versioned. It contains:

- simulation clock and speed/pause state
- money accounts
- inventory and in-transit quantities
- finite capacities
- reservations
- orders
- commitments and contracts
- information packets with visibility/freshness
- relationships and reputation
- structured agent memories
- scheduled future events
- append-style causal history
- metrics
- deterministic seed

The Atlas state embeds the runtime and adds schema version, seed and history cursor. UI-specific map marker state remains outside the runtime.

## World clock and event queue

Simulation time is distinct from rendering. `requestAnimationFrame` remains a display concern. Runtime time advances through `advanceAgenticWorldRuntime()` and processes a serializable event queue.

Implemented scheduled events include:

- supplier capacity shock
- later independent market discovery
- delivery arrival
- commitment deadline
- scheduled intent
- autonomous reasoning tick

There are no hidden `setTimeout` objects inside canonical state, so save/restore cannot duplicate pending timers.

## Intent and validation pipeline

Runtime actions include:

- `reserve_capacity`
- `authorize_payment`
- `release_shipment`
- `send_customer_update`
- `transfer_inventory`
- `send_information`
- `create_commitment`
- `schedule_task`

Validation happens before mutation and returns a structured result:

```text
allowed
reason
missingRequirements
possibleAlternatives
```

For example, a capacity reservation verifies finite inventory and finite fulfilment capacity. If the primary supplier cannot satisfy the request, the runtime can score feasible suppliers and adapt to an alternate source instead of pretending the original action succeeded.

## Scarcity and conservation

The runtime uses explicit ledgers for money, physical inventory and capacity. Reservations lock finite stock, so two agents cannot consume the same units. Shipment release changes stock from on-hand/reserved to in-transit; delivery arrival transfers the quantity to the buyer.

Development invariants reject negative money/inventory/capacity, impossible reservations, orphan reservations and inconsistent commitment states.

## Observation and information asymmetry

`observeRuntime(world, agentId)` is the agent observation boundary. It does not return global state. It filters:

- own account/inventory/capacity
- orders in which the agent is a participant
- commitments where the agent is a party
- public information or information sourced by/sent to that agent
- relevant relationships
- that agent's structured memory

A supplier disruption is initially private to supplier/operations participants. Other agents cannot react until they receive communication or a later discovery event. This makes communication necessary because of information boundaries rather than decorative dialogue.

## Commitments, contracts and consequences

Workflows create an explicit delivery commitment and contract. If the delivery reaches the buyer before its deadline, the commitment is fulfilled. If the deadline is missed, the runtime records a violation, applies the simulated penalty and changes relationship/reputation state.

Consequences are causal history events with `causeIds`, actors, targets and visibility. `explainRuntimeCausality()` reconstructs the available causal chain.

## Autonomy

The runtime periodically reevaluates meaningful state rather than invoking reasoning on every render frame. A current autonomous rule detects when the customer lacks fresh order-status information and produces a support update without a user click. Further planners can attach to the same event-driven decision boundary.

Randomness is seeded. It changes event timing/conditions, not arbitrary visual actions.

## Workflow bridge

The canonical wrapper compares Atlas task state before/after an engine step. Newly completed tasks publish structured information only to dependent agents. Approval-gated Atlas actions become runtime intents before the visual workflow is allowed to proceed.

If the runtime rejects an approved intent because the world constraints still cannot be satisfied, the task becomes blocked with a reason. Human approval is permission to attempt an action; it is not permission to violate world rules.

## WebMCP

The mounted WebMCP core tools already route through the Atlas imports used by the product. Because those imports resolve to the canonical wrapper:

- workflow requests remain approval-gated
- consequential action requests remain approval-gated
- approved actions run the same runtime action pipeline as the visual product
- `asympta_observe_living_city` exposes the canonical runtime snapshot, including resources, commitments, scheduled events, metrics, causal history and invariant status

No WebMCP approval-resolution tool is exposed. The browser/tool boundary cannot silently convert simulated actions into real external side effects.

## Persistence

`serializeAtlasWorld()` and `restoreAtlasWorld()` provide a schema-versioned round trip. Browser persistence stores the canonical world periodically and at important transitions. `lib/atlas-canonical-demo.ts` restores a valid active world on reload; invalid persisted worlds are rejected rather than guessed back into shape.

## Performance boundaries

- rendering loop remains separate from simulation
- expensive reasoning is event-driven
- runtime state uses bounded history/memory
- scheduled events are simple serializable records
- the legacy movement engine keeps its existing frame-independent stepping
- browser persistence is throttled

## Debugging and replay

A seed plus serialized world, event queue and causal history are sufficient to reproduce major stochastic decisions and inspect why an order, supplier choice, commitment or delivery changed.

The product UI remains calm and map-first; canonical state is available through snapshots/WebMCP and tests without turning the customer surface into a debug dashboard.

## Native iPhone and iPad app (independent of web runtime)

`ios/AsymptaWorld/AppDelegate.swift` → `NativeWorldViewController` owns `WorldCanvasView`, gesture-based camera control and native `WorldPanels`. The iOS app does not load the web runtime. `WorldStore` retains the version1 atomic personal file at `Application Support/AsymptaWorld/personal-world-v1.json`; nickname, favorites, journal, language, Aura and movement contracts do not change.

### Historical paper/character design — build6, 2026-11-03 (superseded)

The user-approved reference is the five characters and auras on paper (concept v6 in the originating chat), followed by the explicit correction to make the paper whiter while preserving character/aura colors. No title, bird, terrain, tree, river, route, flower, stamp or poster is drawn. `WorldArt` loads `Art/Halftone/companions.png`, crops its five equal transparent source cells in memory, and produces a near-white 192px paper tile with subtle deterministic fiber specks. The source sheet and mapping are recorded in `Art/Halftone/provenance.json`; previous art remains historical and is not loaded by the canvas.

Stable resident IDs map to new visual identities: fox → hooded traveler, cat → cat, tea → rabbit, reader → hedgehog, bear → sheep. Their normalized viewport positions keep all five visible on initial phone presentation. The canvas projects those positions through a bounded, transient pan/zoom camera. Each separate96pt native resident control draws a small image plus a seeded stipple aura. Auras use dusty blue, pale straw and the selected traveler mood (gentle defaults to faded coral). Build7 replaces all character controls with the aura-only simulation below; this paragraph records historical build6 behavior. Paper and colored halftone textures are rasterized once, then composited without redraw during motion or camera updates.

`PaperMenuView` exposes Home (`me` profile/settings/journal), Explore (`world`, resets camera), Friends (`meet`) in an always-visible bottom row. Home also links to the existing Aura panel; all capabilities remain reachable. Labels inherit the single saved `WorldStrings` language state, including Home/Explore/Friends in English, Traditional Chinese and Japanese. `WorldTheme` owns near-white paper, muted ink colors and scalable typewriter fonts. Panels use the same portraits, palette and fonts.44pt Close controls retain the prior iOS26 background fix. No account, network or location permission is added by this native visual change.

The native source is integrated from the earlier delivered iOS branch without replacing the current remote main web code. iPhone-only portrait remains explicitly pinned at both project and target level; actual exported IPA family is authoritative. Historical build4/5 TestFlight evidence remains in [IOS_SKETCH_RELEASE.md](IOS_SKETCH_RELEASE.md). Build6 source `5fec447c3512cd61499ae3bab96af3515a7b40b6` compiled/signed/exported successfully; IPA family[1] and bundled halftone source matched. Apple build `418ebdc2-373f-4128-b4a3-36b50f299c86` is VALID and independently available to existing Internal Testers. After user reconnect/unlock, the exact official TestFlight1.0(6) installed on exclusively held Dev iPad. Actual images and native scenes verified five-character near-white presentation, resident detail/dismiss, Friends visit/focus, Explore restoration, pan/pinch, Home/Aura change and restore, three-language navigation and restore, background/cold reopen. Personal data was byte-identical; release receipt confirms session released. Earlier offline/readiness/system-overlay failures remain historical. See [build6 results and limits](IOS_HALFTONE_RELEASE.md). This is phone-compatibility iPad evidence, not all-device or human artistic acceptance.

### Current aura-only activity model — introduced build7, retained in build11

The latest user direction removes characters entirely and replaces them with many moving aura dots doing different simulated activities. `WorldArt` now produces paper and cached identity-colored dot textures procedurally; no character bitmap is loaded by native screens. Historical resources stay preserved in Git. Retained resident raw IDs/favorites map to the first five familiar lights rather than changing the version1 save contract.

`AuraWorldSimulation.swift` owns72 transient agents in a1000×1400 paper world. Each has position, curved travel segment, activity, travel/work phase, energy, ideas, completion count and optional partner. Exploring chooses nearby new places; learning/creating gather near shared invisible hubs and complete work after arrival; rest stays nearby and replenishes energy. Meeting reserves a resting peer, approaches its actual location, then completes a five-second encounter and exchanges ideas only in proximity. Both participants leave afterward; one encounter is counted once. These are local simulation events with no external communications, tasks or purchases. Simulation state is transient, not personal saved data.

`WorldCanvasView` drives this model with one weak-target CADisplayLink and updates72 cached image layers. Layer positions and hit-test locations read the same canonical agent points. Each stable local agent ID has one pale identity hue, shared by the map, profile and familiar-light portrait. Activity changes do not change that identity color. The global Aura mood adjusts pale ink strength. All72 identity textures are prepared before the clock starts; no halo generation, character decode, text layout or user save occurs per frame. Camera geometry/scale is updated only when needed. White paper is a stable tiled background. System low-power/serious thermal conditions request30Hz; otherwise30–60Hz, preferred60. Requested frame rate is not guaranteed displayed FPS. Paused/offscreen background, native sheets, touch holds, active gestures, movement-off, Reduce Motion and VoiceOver suspend the clock. Resuming resets its timestamp; delayed movement deltas are capped50ms to avoid teleporting.

Zoom0.45–3.5 scales the complete dots/halos around the pinch anchor. Pinch, pan, double-tap return and current-dot focus use the same camera; build9 has no visible zoom, location or menu controls. Nearest-dot touch selection uses a22pt minimum reach; custom native accessibility elements expose each light’s current position and activity without72 subview layout passes. Their frames are computed on demand, and VoiceOver focus centers the selected light. `NativeWorldViewController` captures a real model snapshot on tap; `WorldPanels.agent` shows activity/phase/progress/energy/completions and explicitly states local simulation. Opening the sheet pauses the world; the text labels the opening-time snapshot. All new text follows the existing single global language.

Caches/WorldSceneMetrics.json retains only bounded aggregate actual-scene callback/CPU work, camera work, activity populations/completion counts. A serial utility writer flushes on background/cover/finished gestures. No notes, coordinates or personal identities are recorded. The counters do not measure GPU FPS or matched build6 speedup. Build7 source `f9be7bca7c8e9c6280e2c8976f4e17b1718da507`, Apple `39d3e420-e4c5-4a3b-9b20-c106631b2ebf`, reached VALID/Internal and installed1.0(7) on Dev. Its actual no-character72-dot image was viewed. Full build7 scenes were superseded by the new camera/navigation request, not claimed passed; its device lease was released. Build9 retains this model/rendering foundation and the current camera/entry below. Build8 had partial real movement/camera evidence; see the supersession record below. Build9 camera, activity, language, save and lifecycle evidence is recorded in [native aura release](IOS_AURA_WORLD_RELEASE.md). Build10 adds individual identity hues and simulated per-activity completion histories. Each dot opens a five-skill profile; dominant activity determines displayed specialty/level. Build10 compiled and reached VALID/Internal TestFlight (Apple182945d1-cf79-45c8-bde9-44e2e53ab6c0); its physical verification was not completed.

Reference: [Apple CADisplayLink](https://developer.apple.com/documentation/quartzcore/cadisplaylink) / targetTimestamp / preferredFrameRateRange. The native source, Apple build, device scenes and scope must be reconciled before delivery.

### User-centered camera, individual aura abilities and no visible controls — build10 / build11 refinement

Agent0 is the device-local user's light, initially centered in the world. This is a local presentation identity, not an account/location claim or a save migration. The initial camera follows its current simulation point at2.4×; a thin pale ring identifies it. Panning/pinching release follow and preserve the focal world point. No top/bottom menu or permanent zoom/location control is created. Pinch zooms and drag explores; double-tap paper returns2.4× follow. Zoom/overview/return accessibility actions are attached to each native light element. The world viewport uses the newly freed bottom space. `PaperMenuView.swift` is removed; there is no hidden bottom menu instance.

Tapping light0 opens the real activity snapshot with localized Your Light title and a Your Space button. This pushes the existing personal panel; Aura, language, motion, familiar-light favorites and journal remain reachable there. Familiar-light visits focus the current corresponding agent and turn off follow for other lights. Closing a sheet resumes the world without changing personal state. New labels inherit WorldStrings; simulation energy is explicitly labeled as simulated. Historical build6 imagery and release evidence are retained, while current native surfaces never load character art.

Build8 source18edd8f3f0bb74b9a1d725da8479be765da4386a / Apple879e4569-4cf5-464e-b06f-d96a03af789e installed on Dev; real motion/zoom/default camera scene ran and raw images were inspected. The latest removal of all top controls supersedes its remaining scenes. Original8 receipts are retained; no complete8 acceptance is claimed. Build9 additionally keeps zero-callback launch snapshots from overwriting real scene metrics; initial8 post-background metrics were zero despite visible activity, so they are not performance evidence. Official TestFlight9/source d75cd38937646e060fb40f5cbd69d2659864c4e8 / Apple7c7d029c-3184-4782-8d12-f61200c706fe reached VALID/Internal and installed on exclusive Dev. Actual image/motion/gesture/settings/language/lifecycle scenes passed; personal save remained byte-identical and lease was released. The valid sample has5115callbacks/87.799s,484activities/83encounters; callback/CPU evidence does not measure displayed FPS or matched speedup. [Results and limits](IOS_AURA_WORLD_RELEASE.md).

### Individual aura abilities — build10 / build11 refinement

`AuraWorldSimulation.Agent.abilities` counts completed actions by the five existing activity types during the local simulation. The selected dot panel summarizes its strongest activity, bounded ability level and all five activity levels. Each stable agent ID receives an individual pale hue; the layer and profile sample share that identity color. Histories are transient with the simulated agents and reset on cold launch; no version1 personal data is modified. English, Traditional Chinese and Japanese labels use `WorldStrings`. Build10 physical TestFlight acceptance remains pending.

### Stable identity and balanced growth — build11 candidate, 2026-11-05

`AuraWorldSimulation.Agent.auraInk` is immutable and calculated at agent creation. `WorldCanvasView` preloads every identity texture before motion and reads the stored ink without creating snapshots, sorting abilities or converting colors each frame. `WorldArt` uses the same color contract for familiar lights; the own-light ring shares agent0's hue. Personal version1 saves remain untouched.

Both participants of one completed meeting gain one connect completion, while the world counts one encounter and two completed activities. `AuraAbility` defines a single level/progress contract: level1 at0 completions, level10/full bar at81. The profile shows each activity's completion count in a vertical, wrapping layout, and untrained lights no longer claim an established strongest ability. All new copy uses `WorldStrings` in en/zh-Hant/ja.

Actual-scene metrics now expose the real texture count, distinct identity hues, five aggregate ability totals and the number of agents whose ability sum disagrees with completed activities. These are bounded local-simulation aggregates, never account/online-user evidence. Physical acceptance must observe moving distinct lights, map/profile consistency, reciprocal growth, count conservation, gestures, pause/resume and preserved personal data in exact official TestFlight11. Compilation/distribution/device results remain pending until receipts exist.

### Real surroundings, furry auras and Cloudflare — introduced build12, retained build13

The latest user direction requires actual important roads/buildings around permissioned device location, selectively hand-drawn, plus large furry aura regions instead of precise pins, cross-device presence and persistent own growth. This supersedes the earlier prohibition on all scenery; invented terrain remains out of scope.

`WorldGeography.swift` owns foreground `WorldLocation` permission/update handling, `WorldMapCell` projection and sparse `WorldSketchMap` linework. `NativeWorldViewController` presents the localized permission explanation, calls CoreLocation only after authorization, anchors the own aura to a quantized area, loads real geometry through the cloud session, and shows OSM attribution. Denial leaves the local simulation usable. A geographic cell change clears obsolete geometry before installing the matching new sheet. Map paths and aura layers use the same1000×1400 world camera; hand-pencil echoes decorate actual OSM polylines without creating fictional streets/buildings. Coverage is deliberately selective and depends on OSM data.

`AuraInk` creates cached broad furry textures with fine curved fibers and no pinpoint center, eyes or character art. The exact-position ring is removed. In geographic mode, the72 local simulated companions are hidden; the visible auras represent this installation and actual connected nearby devices. Their shared positions are rounded to a200-unit projected grid and their broad radii are at least200 projected meters or the reported location uncertainty, whichever is larger; this is approximate area presentation, not a formal anonymity guarantee. Before location is enabled, the local companion world remains explicit simulation.

`WorldCloudSession.swift` owns a random256-bit per-installation capability stored in Keychain; the app never embeds a server credential. It keeps an independent `aura-growth-v1.json`, merges per-activity counts monotonically, saves locally on own activity completion and synchronizes periodically/background to `/v1/profile`. Unreadable growth files are protected from default overwrites. `AuraWorldSimulation` restores own counts with explicit baseline metrics and anchors the user after a location fix. Local personal version1 saves/journal/favorites are unchanged. Cloud identity is anonymous per installation, not an account/sign-in or cross-device account recovery system.

`cloudflare/aura-world/src/index.ts` implements three SQLite Durable Object boundaries: `MapCell` caches a bounded real OSM extract for a geographic cell for24h; `AuraProfile` stores only the authenticated installation's growth; `AuraRoom` uses hibernating WebSockets for one neighborhood. Short-lived attachments carry only approximate positions, aura color, self-reported simulated ability counts and activity. Rooms cap80 connections; peers expire from broadcasts after45s. Exact GPS, personal names, notes and journal contents are never uploaded. Map data uses bounded sequential public Overpass providers (see the timeout correction below), one in-flight fetch/cell and cache; attribution links OSM's copyright. No paid data subscription or billing setting is introduced. Public-service availability and broad geographic coverage are not guaranteed.

The native client connects only while active, sends bounded coarse presence on a15s heartbeat and removes peers on disconnect. Live profiles identify a connected device and the approximate aura area; they do not claim externally verified human actions. A native per-peer accessibility element and ordinary touch selection use the same positions as rendering. Existing web `asympta-public-intent-agent` remains deployed and unchanged; task-kernel was absent in the current account. Native coordinates/journals are never routed to the existing intent AI. New service URL:`https://asympta-world-aura.asympta-invitation-service.workers.dev`.

Wrangler4.127.0 and TypeScript5.9.3 are pinned in the service package. Generated binding/runtime types match its config; compatibility2026-11-05, accountd469a1fd0ddc60f7960d3f8765eebb46. Provider versionde219972-ab55-4644-8c45-459f2e5a51cd deployed successfully. Actual remote profile/isolation/invalid-write, map/cache/attribution and two-client WebSocket/coarse-position/departure checks passed. Public Clock Tower reference extract reports OSM source timestamp2026-07-28; no claim of today’s complete road coverage. Official TestFlight12/Applee5fa97d6-00b6-4dce-ad63-ae3f24d9bb25 isVALID/Internal and installed/read back on exclusively held Air. Actual furry-world/location explanation image was inspected. Exact real-map/cloud/persistence physical acceptance remains pending; the OS location prompt is visible, and its dedicated native owner is being resolved. Required affected scenes: permission/denial contract, real source-matched roads/landmarks, fuzzy area appearance, actual nearby connection/removal, ability cloud save/reopen, map/profile interactions and languages, gestures/lifecycle and preserved personal data. Backend remote checks supplement, not replace, the installed physical app.

Historical build12 owner choice reserved Air; the latest user now permits either iPad through the common queue. See the current build13 acceptance state below; physical release history is retained in IOS_AURA_WORLD_RELEASE.md.

The native Worker is an isolated package: root web TypeScript/ESLint excludecloudflare/aura-world so its generated Worker globals and own compiler settings do not enter the existing DOM/Next.js program. Its own pinned package check and remote runtime checks remain responsible for that service. This changes no shipped native/Worker source after source41eee93.

### Build13 published correction and physical core acceptance

Broad rounded aura centers can coincide; the old nearest-center tap selects only one identity on ties. Preserve every visible identity by opening a temporary native chooser for overlapping touch targets, then its captured profile; no exact-position marker or permanent control is added. Growth HTTP synchronization state must also be distinct from the neighborhood socket state: before location authorization, growth can be online while nearby presence is unavailable. Track actual successful profile responses and show saved/pending truthfully, with bounded private aggregate response evidence (no tokens/location). Build13 is published. The chooser and nearby peer lifecycle subsequently passed the Dev13 physical scenes below; actual growth HTTP synchronization was also observed independently of neighborhood presence.

### Current physical acceptance and handoff

App source18c7a699ff282311c19632afd0aa037610a71f56 is official13/Apple5243f4bf-fcd9-40dd-b552-a8cf35b2fdef VALID/Internal. Dev official Update/Open and fresh installed13 identity were verified. Actual own furry aura/profile/five abilities, PUT200 and post-reopen GET200 with matching counters, and foreground Allow While Using App consent were observed. A bounded real Mac WebSocket client joined the native observed coarse cell, appeared with its own furry hue, and produced an overlapping-aura chooser. Both correct captured profiles were selected. After normalclose1000, the peer element disappeared while ownlight remained. This is technical-client evidence, not a human or second native iPad.

Window9 returned Home (raw image inspected), confirmed the exact designated own operator absent, preserved byte-identical personal state (SHA2561bbbb6a53bc5003964c16d50fb9250791199d234983051cd1bd49bec561d7397), and formally released revision2557 before its deadline. No other-app authentication/purchase, note, name or favorite action was performed. Earlier interrupted lifecycle evidence remains partial. Air13 subsequently verified geographic map appearance, source alignment, gestures, nearby interactions and cold restoration below. Remaining language scenes and retained-process background resume stay outside acceptance.

The user permits either iPad through the shared queue; system Location Services changes remain Dev-only and were verifiedON. Foreground app presence alone is not human ownership. A safe handoff requires a valid exact grant, no running/unknown previous device operation, current human-release evidence where needed and no outstanding Apple/manual dialog. Preserve actual human protection. Return Home, stop only the exact own designated operator and release before the time buffer expires. Historical Air system-service classification and build12 prompt-control limitations are not universal OS/device claims.

### Map provider timeout correction - 2026-11-05

Actual native13 map requests returned503 while nearby presence was active. The same coarse-cell Private.coffee extraction timedout28s; a bounded same-query VK Maps extraction returned complete200/680sourceelements/1,284,683bytes. This establishes an upstream-path failure for those requests, not a permanent global outage. A first failover deployment also returned503; that individual cause was not uniquely established.

MapCell now attempts providers sequentially: Private.coffee at8s/query6s, then VK Maps at24s/query20s;32s total network budget fits the unchanged native35s request. Only complete JSON with an elements array and no provider remark is accepted. The existing4MiB response bound,249feature cap, single in-flight extraction/cell,24h cache and7day stale fallback remain. Optional sourceProvider records provenance without changing schema1 native decoding. Both providers receive only the same broad cell, never installation capability tokens, exactGPS or notes. Safe provider/phase/type diagnostics exclude URLs, cells, queries and credentials. Public provider reliability remains a dependency; [documented endpoints and usage](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).

Worker source2b1cb12d59ad14a7d3eaab7018cb26678aab89cd deployed as86a18156-ecb9-44b9-8c00-85c9f7939b98. Actual same-cell live API then returned200 in31.246s:241features (190roads/45buildings/6landmarks), source timestamp2026-11-05T10:41:15Z. This verifies service data, not queued native rendering. App13 source/binary remains unchanged. No paid plan, resource migration, profile-data change or repeat native upload was introduced.

The task-local designated MuzhuSceneOperator has a compiled Air-only visual consent fallback, still physically unverified. It requires an explicitly enabled phase after inspecting the actual World prompt, World foreground identity, high-confidence exact World/location title and all three foreground-consent options, no authentication context, and matching upright screenshot/native frame geometry. It taps only the recognized Allow While Using App center once; otherwise stops. Native accessibility remains the first route. No Air global setting change or other-app login is authorized by this path. Product build13 is unchanged.

Home handoff correction2026-11-05: actual read-only Air image showed App Library/no authentication, while DVT reported only SpringBoard plus InputUI/DockFolderViewService. The configured probe now removes only those two shell-helper identifiers when SpringBoard is present; every other app and all unknown observations remain. Human reservation, queue fairness and operation locks stay enabled. This is a dependent-tool signal normalization, not product source or a blanket Apple-app allowlist. Original probe and SHA/change receipts are retained privately. New native observations/physical scene acceptance remain required; no claim that other chats or the persistent service reloaded code.

The exact dependent-probe change is retained as [a bounded patch](patches/ipad-home-signal.patch). The proposed temporary protection exclusion was never applied: another Bonk lease appeared and the precondition stopped it. Its restoration observer had lacked an own-change flag; whether that observer performed a configuration write or a no-op was not retained. The observer is stopped and future restoration code requires an own-applied receipt; this route is no longer used. Latest device direction is Air through the normal protected queue; exact mutable ownership belongs in the private continuation record. The subsequent normal Air17 lease completed the core physical scenes below.

The task driver now records the actual foreground World/TestFlight identity only after a successful native phase, using the existing finished callback. This updates last_test_bundle without clearing any independent human hold. The designated operator logs the observed foreground identity; installation or phase success still does not accept a feature. User volume, mute, orientation, rotation lock and viewing direction are preserved: no such test operations are present, and the driver rejects those action names.

### Air13 real-map and nearby core outcome — 2026-11-05

Under the latest explicit Air direction, exact prior Wish completion/no owner/no running native operation and an actual no-auth screenshot established handoff. The existing guard finished callback reconciled the observed prior com.asympta.wish identity; a supported passive recheck retained protection and normal queue fairness. Normal priority1 Air17 acquired, then independent CoreDevice read installed1.0(13). Official TestFlight exact13/Open and both actually displayed notices were processed. No update was needed, no product sideload/reupload and no Air global-location change. No location prompt appeared, so the OCR consent route remains unused/unverified.

Actual raw images show the sparse real roads/building footprints/limited original labels, broad furry own aura and OSM credit. The copied native map contains241features (190majorRoad segments/45buildings/6landmarks), VK Maps/source2026-11-05T10:41:15Z/stalefalse; its feature geometry hashes exactly match the previously verified live service response from the same coarse cell. Coordinates, place names, raw maps and capabilities remain private. Physical pinch changed240%to123%; pan moved the same map/aura camera and double-tap returned own240%.

A bounded actual Mac WebSocket client joined that native cell and published only at the existing public coarse point. Air showed a second furry hue, the overlap chooser and both correct captured profiles (peerzero, ownnonzero). After normalclose1000, the native tree no longer contained peer1000 while own0/mapcredit remained. This verifies a technical-client/native interaction, not a second native iPad, human behavior or formal location anonymity.

The20s background scene failed its retained-process assertion: World state1 and subsequent native process inventory showed no World. No same-time World report was present in the then-available read-only crash list; termination cause remains unknown and no crash is asserted. A distinct actual reopening restored the map, own profile and nearby connection. Native growth GET200 synchronized local/server[40,23,21,4,7], monotonic from[32,20,19,4,6]. That is cold restoration, not a passed direct resume. The failure is retained in the canonical WORLD-20261105-BACKGROUND-RETENTION-01 case.

Air personal-v1 was absent before and after; no name/journal/favorite/settings mutation was made. Actual Home image was inspected, exact designated own operator absence confirmed, releaseok/revision1648 occurred before the deadline, and own active/pool/native waiting counts were all0. Device volume/mute/rotation/view remained without test setters. The product remains iPhone family1 in an iPad compatibility window; raw evidence retains its black margins. Remaining scope: retained-process background cause/resume, new-map full zh-Hant/ja scenes, cross-cell physical travel and long-duration multi-native-device behavior are not verified. See release history for exact private evidence names.

### Warm-paper atlas and place hierarchy — native build14

The November 6 user reference informs a native visual language: cream paper, broad color with feathered edges, ink typography and space around each label. Color can establish atmosphere and hierarchy. A place always has a readable name, and a person's aura is recognizable by its fibrous texture and existing selection behavior. Use the same family of materials in secondary screens, such as the profile's paper surface, color sample and ink impressions for real ability progress. Retain a quiet gesture-first canvas, localized controls and legible fallback states. The reference's navigation, words and timeline describe another product.

- `WorldTheme` owns paper and text contrast. `WorldArt` rasterizes the paper grain and `AuraInk` caches each broad, fibrous identity image. Local companions have reduced emphasis around the focal user and named hubs. Geographic presence retains installation identity, radius and gesture-based selection.
- `WorldSketchMap.make` turns the active `WorldMapSheet` into pencil geometry and place candidates. Landmarks and named buildings take priority, followed by named roads in neutral ink. Place color is stable and decorative. OSM names retain their source spelling and receive attribution through the existing button.
- `WorldPlaceOverlay` projects at most four screen-sized captions through `WorldCanvasView`'s camera, clearing room for existing interface elements and rejecting collisions. Pigment sits under the lights and type over them. Captions are readable by VoiceOver and allow normal map touch interaction. Typography updates with Dynamic Type. `AuraWorldSimulation` supplies names and coordinates from its existing learning and making hubs only in the local world. Loading a geographic cell clears local names; changing cells removes the old geometry and captions together.
- `WorldPanels` keeps the existing profile and progress contract, with printed ticks showing the same `AuraAbility.progress` fraction. No schema, device setting, geographic precision, network payload, activity rule, zoom range or gesture changes are required by this presentation.
- When extending this direction, give each new surface one focal action or reading order. Reuse the ink and paper system, reserve large washes for spatial context, and verify caption hierarchy, contrast, gestures and state truth in the actual TestFlight scene. See [native release evidence](IOS_AURA_WORLD_RELEASE.md) for what is installed and physically verified.


### Native atlas workspace — build15

The same app and bundle now target iPhone and iPad. The iPad supports all four orientations and uses the current window geometry; iPhone remains portrait. Orientation support is declared per device family in the target plist. [Apple iPad multitasking guidance](https://developer.apple.com/documentation/uikit/multitasking-on-ipad-mac-and-apple-vision-pro).

`NativeWorldViewController` owns the atlas host, native map-mode menu, personal-space entry and two camera actions. The same UIKit navigation stack appears as an inspector beside the atlas in wide windows and as a system sheet when opened from a narrow window. If a wide window narrows while the inspector is open, its existing stack reflows below the atlas. Map interaction leaves an active journal editor in place.

The atlas keeps one world camera as its available space changes. Caption placement reserves the header, location explanation and camera controls. The actual geographic view and OSM credit appear together when an active cell has usable geometry. Local exploration and nearby mode are explicit choices, stored independently from the personal journal file. The local world is available while waiting for location or map geometry. Leaving nearby mode stops location updates, cancels the active map task, clears its cell and disconnects presence. `AuraWorldSimulation` restores the preceding local position and keeps earned abilities. A return to nearby starts a fresh location flow and accepts map and peers only for the current geographic state. Existing ability sync remains independent of geographic mode.

Scene activation gates the simulation clock, location updates and socket. The installed release and physically observed layouts are tracked in [native release evidence](IOS_AURA_WORLD_RELEASE.md).


### Social Atlas · invitation-only Circles — native build16

[Product commission and acceptance](WORLD_SOCIAL_PRODUCT_BRIEF.md) and [Circles API contract](WORLD_CIRCLES_CONTRACT.md).

- `NativeWorldViewController` attaches the Circles navigator to the existing wide inspector or compact sheet. It receives only the currently loaded map cell as optional social context. A count tab routes to the selected circle's area filter and an unread badge reflects actual reply activity. Neither UI marker represents a person's position. The existing live aura and camera remain independent.
- `WorldSocialClient` uses an ephemeral request session and asks `WorldCloudSession` for a request bearing the existing installation Keychain capability. The local list contains circle IDs and titles. The remote circle owns membership, posts, replies, acknowledgement state and moderation. There is no implicit upload of the device journal or the user's saved nickname.
- `WorldCirclesViewController` owns creation/join, feed filters, invitation share sheet, return activity, style selection and host safety tools. `WorldMomentViewController` owns native composition and reading. Photo selection produces a fresh bounded raster from the chosen file, then posts only on explicit Share. Area disclosure defaults off. UUID contribution IDs and frozen submitted payloads support retries. The author advances the reply read boundary to the last visible server timestamp.
- The Worker validates route, request size, coarse cell, JPEG structure and rate before dispatching to `WorldCircle`. Each SQLite Durable Object isolates one circle. Member IDs are scoped to a circle. Visibility and writes enforce membership and block state. Only the host can manage invitations, the roster and the report queue. Deletion/leave affect only the circle's contributions. Media stays behind the same authorized detail route.
- `WorldCircleInkStyle` renders four original engraved marks above cached pigment. A selection changes only the caller's display mark in one circle. This internal expression study carries no product, price, paid entitlement or social advantage.
- Initial moderation is a direct-threat text filter plus member reporting/blocking and host action. This is an invite-only beta with no staffed platform-level moderation, public discovery, image analysis or outbound push. Product receipts must distinguish actual service interactions from physical native acceptance.


### Circles draft and host review follow-up — native build17

`WorldMomentViewController` invalidates an unsent area opt-in when the displayed map cell changes, while keeping the words and photo. A frozen send keeps the original idempotency identity and does not re-send an old area's payload from a different map state. An atomic, file-protected per-circle draft stores the user's prepared photo and text on this installation. A pre-send snapshot permits exact reconciliation after a cold return. Unsent drafts restore with location attachment off. The feed renders a bounded initial set and can reveal earlier moments without creating more cards than needed.

Report reasons and a host-only pending review route are additive to build16. Hosts can see the reported content and its own attached photo on a dedicated reading page. The service aggregates reason counts, excludes reporter identity, and keeps photo access tied to the exact pending report. Existing circle databases acquire the optional reason field with a bounded additive SQL migration.

### Cross-circle reply inbox — native build18

`WorldSocialClient.inbox()` sends batches of locally remembered IDs to the Worker. Each `WorldCircle` verifies current membership and uses the same unread and visibility query as the existing per-circle activity. The Worker returns only permitted previews and distinguishes temporary failures from inaccessible circles. The inbox adds no server-side cross-circle index, local reply cache, or notification permission.

`WorldCircleInboxViewController` lists recent unread replies with the circle and time, opens the existing moment reader, and reloads on return, foreground activation or manual refresh. The reader keeps the existing per-moment read boundary. Successful read and visibility changes refresh the atlas badge, which now covers all remembered circles. Area counts continue to follow the selected circle and displayed map cell independently. Partial or bounded results never imply a complete unread total.

### Stage4 library, collections and keepsakes — build19

The canonical product specification is [prompt.md](https://app.notion.com/p/41125c63c3ea812ca00ac577983d3a24). Its working text remains in `WORLD_SOCIAL_PRODUCT_BRIEF.md`. The native app adapts the user-selected Bump, Retro and Are.na references.

`WorldLibraryViewController.swift` adds text/author/description search, local-calendar weekly reading and shared collections. The feed opens the library, and each original moment offers the collection picker. `WorldSocialClient` owns DTOs and authenticated requests. The existing circle-scoped `WorldCircle` owns bounded collection metadata and references with a transactional lazy migration. Original moment visibility controls collection contents and counts. Leave, removal and moderation affect these references. Browse uses chronological timestamp/ID cursors and accepts an explicit local week end for daylight-saving boundaries.

`WorldKeepsakeExportViewController` prepares original paper PDFs from accessible collection moments and selected images, with a preview and three pigment palettes. Free text archives and paid PDF sharing use protected temporary files and the native share sheet. Export rechecks current collection visibility before opening the sheet. Photo reads are paced within the shared service budget. `WorldKeepsakesStore` starts at root launch and owns Apple-only product and signed transaction state, restore and subscription management. Its paywall uses actual localized product prices. No server resource entitlement is derived from local paid state.

The service publishes its current beta data practices at `/privacy`. Identity recovery, complete installation-data removal, sandbox purchase acceptance, photos and new native scenes remain open until separately evidenced in the Stage4 specification. Public release stays independent from internal TestFlight availability.


### Identity recovery and circle-directory persistence — build20

`WorldIdentityRecovery.swift` defines the bounded versioned encrypted file, protected circle-directory storage and Keychain commit journal. `WorldRecoveryViewController` and `WorldRecoveryStrings` provide explicit save/import, passphrase, live-membership verification, skipped-circle review and confirmation. The personal-space panel opens this flow. CryptoKit AES-256-GCM authenticates a fixed format identifier; CommonCrypto PBKDF2-HMAC-SHA256 uses a random 16-byte salt and fixed 600,000 rounds. Passphrases remain in memory; only ciphertext enters the system share sheet. The bounded document reader uses security-scoped access. A file restores identity, circle references and aura counts; it contains no posts, drafts, journal or location fields.

`WorldCircleDirectory` atomically migrates valid legacy circle links/selection to `circle-directory-v2.json`, retaining legacy preferences as recovery evidence. All current selection/create/join/leave writes use that canonical protected file. Malformed/unwritable storage fails closed instead of being overwritten with an empty list. Leaving commits the directory before forgetting its link; an interrupted server response remains retryable.

Replacement requires no remembered circles or draft files. Import checks each candidate circle with the candidate credential without changing the active credential; connectivity errors stop before switching. Confirmed inaccessible circles are disclosed in the review. After confirmation, `WorldRecoveryCommit.stage` keeps the prior anonymous credential/growth privately in Keychain and records the validated target there. The root retires location, animation, social requests, cloud sockets and uploads; stopped flags reject delayed completions. `SceneDelegate.installWorld` replays the journal before constructing any cloud session. Atomic growth and directory writes precede journal removal. Any replay error shows a native retry surface and never constructs a random replacement identity. Personal journal/preferences and StoreKit entitlement are independent.

Build20 source17fadddb998c1af28267d0dbd78f3df63a380eef compiled, was signed/exported, reached VALID/Internal TestFlight and installed1.0(20) on Air. Its actual native library search/week, shared collection creation/listing and PDF cover preview were observed; encrypted backup/share/import, wrong-phrase, interrupted replay and migration observations remain pending. Complete all-data deletion remains an open S4-08 requirement. Supporting design references: [Apple AES.GCM](https://developer.apple.com/documentation/cryptokit/aes/gcm), [OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html). Crypto primitives are provided by the Apple operating system; no bundled cryptographic implementation or proprietary cipher is added.


### Native artifact and reading refinement — build21

Actual build20 PDFKit cover observation showed a saturated hard disk from the transparent radial gradient. `WorldKeepsakePDF` now uses fully opaque RGB stops preblended with the exact paper color, fading restrained pigment to paper across four stops. This avoids PDF transparency in the color field while keeping text/vector output, three palettes, permission rechecks and the free-preview/paid-share boundary. Device confirmation of the changed artifact is pending.

`WorldStrings.count` centralizes English singular handling for circle members, replies, acknowledgements, reports and area moments. The shared circle page and atlas area label use it; zero/plural and selected Traditional Chinese/Japanese formats retain their existing locale. `NativeWorldViewController.layoutInspector` retains one width constraint, adapts landscape width to36% of view bounded360–520pt and at least480pt of atlas, updates the constant on same-mode resizes, and clears it when removing/changing the panel. Existing side/bottom eligibility and phone presentation remain. This responds to the observed narrow PDF preview; same-build device layout confirmation is pending.

Native20 evidence is retained in task work/build20: exact installed identity, fresh keep-draft/reopen, text publish/independent reply, native search/week, collection picker and two-item listing, PDF cover. The initial interrupted draft attempt is inconclusive. At lease expiry, Home and test-circle cleanup had not run; an expired/not_owner response is not a successful closeout. No foreign-owner operation followed. These limits remain separate from verified content scenes.
