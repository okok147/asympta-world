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

## Native iPhone app (independent of web runtime)

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
