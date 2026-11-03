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

`ios/AsymptaWorld/AppDelegate.swift` → `NativeWorldViewController` owns the local native world, its canvas and paper menu. `WorldPanels` presents resident, Aura and personal panels. `WorldStore` owns the version-1 local file (`Application Support/AsymptaWorld/personal-world-v1.json`), atomic saves, favorite raw identifiers, journal and global language; these contracts must survive visual updates. `WorldStrings` translates all native UI from this one language state. The web runtime above is not loaded by the iOS app.

Implemented redesign source (2026-11-03, physical acceptance pending): https://asympta-world-sketch.vercel.app/ — bundled pencil topology, small original SVG-derived creatures, warm paper, left-unfolding vertical menu, understated panels. Retain iPhone-only portrait/system compatibility on iPad, original watercolor assets as historical source, all local state identifiers and existing capabilities. No network, location or messaging added. Native viewport rendering replaces the fixed watercolor raster; camera stays independent of persisted personal data. Same-build TestFlight physical acceptance remains required.

`WorldArt` loads `Art/Sketch/topology.json`, exact reference SVG-derived portraits and grain. `WorldCanvasView` samples the 14 original routes once, draws only its bounded camera viewport, and keeps 50×54pt resident controls separate from tiny visible art. Drag/pinch/zoom change the camera, not the store. Core Animation breathes only visible residents while active; Reduce Motion and the existing movement setting stop it. The map labels use `WorldStrings`. `PaperMenuView` unfolds four vertical destinations and four map actions; transparent space passes gestures through. `NativeWorldViewController` retains the familiar native sheet and journal navigation.

The native palette and typography live in `WorldTheme`; all new map action/landmark labels use the saved language. Favorite raw identifiers, local filename, format1 and atomic-write behavior are unchanged; there is no data migration. Original watercolor assets remain immutable, and `Art/Sketch/provenance.json` identifies the reference revision and derivation. Build4 must be compiled, distributed and observed on the official TestFlight install before visual/functional completion is claimed.

Packaging invariant: `TARGETED_DEVICE_FAMILY: 1` must be explicit in the AsymptaWorld target settings as well as the project settings. XcodeGen supplies a target default of `1,2` otherwise; the exported IPA `UIDeviceFamily` is authoritative. The first build4 export was caught as universal before upload and retained; corrected packaging/physical outcome must be checked separately.
